import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 30 }

// Stripe sends raw body — we need to verify the signature
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY

  if (!stripeKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Get raw body for signature verification
    const chunks = []
    for await (const chunk of req) { chunks.push(chunk) }
    const rawBody = Buffer.concat(chunks).toString('utf8')
    const event = JSON.parse(rawBody)

    // If webhook secret is set, verify signature
    if (webhookSecret) {
      const sig = req.headers['stripe-signature']
      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' })
      }
      // Simple HMAC verification (without Stripe SDK)
      const crypto = await import('crypto')
      const timestamp = sig.split(',').find(s => s.startsWith('t='))?.split('=')[1]
      const v1Sig = sig.split(',').find(s => s.startsWith('v1='))?.split('=')[1]
      if (!timestamp || !v1Sig) {
        return res.status(400).json({ error: 'Invalid signature format' })
      }
      const payload = `${timestamp}.${rawBody}`
      const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex')
      if (expected !== v1Sig) {
        return res.status(400).json({ error: 'Invalid signature' })
      }
      // Check timestamp freshness (5 min tolerance)
      if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
        return res.status(400).json({ error: 'Timestamp too old' })
      }
    }

    // Handle events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.client_reference_id || session.metadata?.userId
      const customerId = session.customer
      const subscriptionId = session.subscription

      if (userId) {
        // Update user profile with Stripe info and Pro tier
        await supabase
          .from('user_profiles')
          .upsert({
            user_id: userId,
            tier: 'pro',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_status: 'active',
            upgraded_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object
      const customerId = sub.customer
      const status = sub.status // active, past_due, canceled, unpaid

      // Find user by stripe_customer_id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        const tier = (status === 'active' || status === 'trialing') ? 'pro' : 'free'
        await supabase
          .from('user_profiles')
          .update({
            tier,
            stripe_status: status,
          })
          .eq('user_id', profile.user_id)
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      const customerId = sub.customer

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        await supabase
          .from('user_profiles')
          .update({
            tier: 'free',
            stripe_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('user_id', profile.user_id)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
