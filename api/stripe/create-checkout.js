import { validateSession, checkOrigin } from '../lib/validateSession.js'
import { applyRateLimit } from '../lib/rateLimit.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await validateSession(req)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (applyRateLimit(req, res, session.userId, 5, 60_000)) return
  if (checkOrigin(req, res)) return

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe not configured' })
  }

  try {
    const { priceId, successUrl, cancelUrl } = req.body

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' })
    }

    // Get user email for Stripe customer
    const { data: user } = await session.supabase
      .from('users')
      .select('email, name')
      .eq('id', session.userId)
      .single()

    // Check if user already has a Stripe customer ID
    const { data: profile } = await session.supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', session.userId)
      .single()

    const checkoutParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.origin || 'https://analytics-dashboard-v2-zeta.vercel.app'}/?upgrade=success`,
      cancel_url: cancelUrl || `${req.headers.origin || 'https://analytics-dashboard-v2-zeta.vercel.app'}/#pricing`,
      client_reference_id: session.userId,
      metadata: { userId: session.userId },
    }

    // Attach existing customer or set email for new customer
    if (profile?.stripe_customer_id) {
      checkoutParams.customer = profile.stripe_customer_id
    } else {
      checkoutParams.customer_email = user?.email
    }

    // Allow trial if configured
    if (req.body.trial) {
      checkoutParams.subscription_data = { trial_period_days: 14 }
    }

    // Create Stripe Checkout Session via API (no SDK needed)
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(flattenParams(checkoutParams)).toString(),
    })

    const stripeData = await stripeRes.json()

    if (!stripeRes.ok) {
      return res.status(400).json({ error: stripeData.error?.message || 'Stripe error' })
    }

    return res.status(200).json({ url: stripeData.url, sessionId: stripeData.id })
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' })
  }
}

// Stripe API expects flat form-encoded params like line_items[0][price]=xxx
function flattenParams(obj, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') {
          Object.assign(result, flattenParams(item, `${fullKey}[${i}]`))
        } else {
          result[`${fullKey}[${i}]`] = String(item)
        }
      })
    } else if (typeof value === 'object') {
      Object.assign(result, flattenParams(value, fullKey))
    } else {
      result[fullKey] = String(value)
    }
  }
  return result
}
