import React, { useState, useRef, useEffect } from 'react'
import {
  BarChart3, Sparkles, ArrowRight, Upload, FileSpreadsheet, Share2,
  TrendingUp, Wand2, FileDown, Shield, Zap, Users, ChevronRight,
  Check, MessageSquare, PieChart, LayoutDashboard, Globe, Clock,
  ArrowUpRight
} from 'lucide-react'

/**
 * LandingPage — the front door to Northern Bird Analytics.
 * 
 * Scroll sections: Hero → Logos → Features → How it works → 
 * Try it now (CSV drop) → Pricing → Final CTA → Footer
 */

// === SCROLL ANIMATION HOOK ===
function useInView(ref, threshold = 0.15) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref, threshold])
  return visible
}

function FadeIn({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const visible = useInView(ref)
  return (
    <div ref={ref} className={className}
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s` }}>
      {children}
    </div>
  )
}

// === NAVBAR ===
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ background: scrolled ? 'rgba(245,245,240,0.92)' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo_mark.png" alt="NB" className="w-8 h-8 object-contain" />
          <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>NORTHERN BIRD</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Features</a>
          <a href="#pricing" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pricing</a>
          <a href="/instant" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Instant Tool</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/#login" className="text-sm font-medium hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>Log in</a>
          <a href="/#login" className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ background: 'var(--accent)' }}>Get started free</a>
        </div>
      </div>
    </nav>
  )
}

// === HERO ===
function Hero() {
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(176,141,87,0.06), transparent)',
      }} />

      <div className="max-w-5xl mx-auto text-center relative">
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-medium"
            style={{ background: 'var(--border-accent)', color: 'var(--accent)', border: '1px solid rgba(176,141,87,0.2)' }}>
            <Sparkles className="w-3.5 h-3.5" /> AI-powered analytics for any dataset
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
            Upload a CSV.<br />
            <span style={{ color: 'var(--accent)' }}>Get a dashboard in seconds.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}>
            Northern Bird turns your spreadsheets into interactive dashboards with AI insights, 
            beautiful charts, and shareable reports — no setup, no code, no data team needed.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="/#login" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ background: 'var(--accent)' }}>
              Start free — no credit card <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/instant" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-medium transition-all hover:shadow-md"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              <Upload className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Try with your CSV — no signup
            </a>
          </div>
        </FadeIn>

        {/* Dashboard Mockup */}
        <FadeIn delay={0.4}>
          <div className="relative max-w-4xl mx-auto">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} /><div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} /><div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} /></div>
                <div className="flex-1 flex justify-center"><div className="px-12 py-1 rounded-md text-xs" style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}>analytics.northernbird.io</div></div>
              </div>
              {/* Stylized dashboard */}
              <div className="p-6 grid grid-cols-12 gap-4">
                {/* Sidebar hint */}
                <div className="col-span-2 space-y-3 hidden lg:block">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--border-accent)' }}>
                    <LayoutDashboard className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Overview</span>
                  </div>
                  {['Data', 'AI', 'Builder'].map(t => (
                    <div key={t} className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}><div className="w-3.5 h-3.5 rounded" style={{ background: 'var(--bg-overlay)' }} />{t}</div>
                  ))}
                </div>
                {/* Main content */}
                <div className="col-span-12 lg:col-span-10 space-y-4">
                  {/* Insight bar */}
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(176,141,87,0.06)', border: '1px solid rgba(176,141,87,0.12)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>AI found 5 insights in your data</span>
                    <div className="flex-1" />
                    <span className="text-[10px]" style={{ color: 'var(--accent)' }}>View all →</span>
                  </div>
                  {/* KPI cards */}
                  <div className="grid grid-cols-4 gap-3">
                    {[{ label: 'Revenue', value: '$142K', color: '#3b82f6' }, { label: 'Orders', value: '2,847', color: '#10b981' }, { label: 'Avg Order', value: '$49.80', color: '#f97316' }, { label: 'Growth', value: '+23%', color: '#8b5cf6' }].map(k => (
                      <div key={k.label} className="p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: `2px solid ${k.color}20` }}>
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: k.color }}>{k.label}</span>
                        <div className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Chart placeholders */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', height: 140 }}>
                      <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Revenue by Channel</div>
                      <div className="flex items-end gap-2 h-16">
                        {[85, 62, 74, 45, 55, 90, 68].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 5 ? 'var(--accent)' : 'rgba(176,141,87,0.2)' }} />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', height: 140 }}>
                      <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Monthly Trend</div>
                      <svg viewBox="0 0 200 60" className="w-full h-16">
                        <path d="M0,50 Q25,45 50,35 T100,20 T150,25 T200,10" fill="none" stroke="var(--accent)" strokeWidth="2" />
                        <path d="M0,50 Q25,45 50,35 T100,20 T150,25 T200,10 L200,60 L0,60 Z" fill="rgba(176,141,87,0.08)" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-4 -z-10 rounded-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(176,141,87,0.08), transparent 70%)' }} />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// === SOCIAL PROOF ===
function SocialProof() {
  return (
    <FadeIn>
      <section className="py-12 px-6" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-6" style={{ color: 'var(--text-muted)' }}>
            Built for teams who move fast
          </p>
          <div className="flex items-center justify-center gap-8 sm:gap-14 flex-wrap">
            {['Marketing Teams', 'Sales Ops', 'Finance', 'E-commerce', 'Startups', 'Agencies'].map(t => (
              <span key={t} className="text-sm font-medium" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}

// === FEATURES ===
function Features() {
  const features = [
    { icon: Sparkles, title: 'AI Insights in Seconds', desc: 'Claude analyzes your data and surfaces trends, anomalies, and opportunities — with specific numbers, not generic advice.', color: '#8b5cf6' },
    { icon: BarChart3, title: 'Interactive Charts', desc: 'Auto-generated bar, line, pie, and area charts. Click to filter, switch dimensions, expand — all without writing a single formula.', color: '#3b82f6' },
    { icon: MessageSquare, title: 'Ask AI Anything', desc: '"What\'s my top product?" "Show revenue by month." Ask questions in plain English and get answers from your data.', color: '#10b981' },
    { icon: FileDown, title: 'PDF Reports', desc: 'Export branded reports with executive summaries, insight cards, and charts — ready to share with clients or stakeholders.', color: '#f97316' },
    { icon: Users, title: 'Team Sharing', desc: 'Invite your team, control access by project or client, and collaborate on the same dashboards in real time.', color: '#ec4899' },
    { icon: Globe, title: 'Google Sheets Live', desc: 'Connect a Google Sheet and your dashboard updates automatically. Set daily auto-refresh — always fresh data.', color: '#06b6d4' },
  ]

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--accent)' }}>Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
              Everything you need,<br />nothing you don't
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              From upload to insight in under a minute. No onboarding calls, no 50-page docs.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.08}>
              <div className="p-6 rounded-2xl h-full transition-all hover:shadow-lg"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}10` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// === HOW IT WORKS ===
function HowItWorks() {
  const steps = [
    { num: '01', title: 'Upload your data', desc: 'Drop a CSV, connect Google Sheets, or paste a link. Any format, any industry.', icon: Upload },
    { num: '02', title: 'AI builds your dashboard', desc: 'Columns are classified, charts are picked, KPIs are computed — all automatically.', icon: Zap },
    { num: '03', title: 'Explore and share', desc: 'Interact with charts, ask AI questions, export PDFs, share with your team.', icon: Share2 },
  ]

  return (
    <section className="py-24 px-6" style={{ background: 'var(--bg-surface)' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--accent)' }}>How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
              Three steps. Sixty seconds.
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.12}>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{ background: 'var(--border-accent)' }}>
                  <s.icon className="w-7 h-7" style={{ color: 'var(--accent)' }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] block mb-2" style={{ color: 'var(--accent)' }}>{s.num}</span>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// === TRY IT NOW ===
function TryItNow() {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const handleFile = (file) => {
    if (!file) return
    // Store file in sessionStorage as data URL, redirect to /instant
    const reader = new FileReader()
    reader.onload = (e) => {
      try { sessionStorage.setItem('nb_instant_file', e.target.result); sessionStorage.setItem('nb_instant_filename', file.name) } catch {}
      window.location.href = '/instant'
    }
    reader.readAsText(file)
  }

  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--accent)' }}>Try it now</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
            See it with your own data
          </h2>
          <p className="text-base mb-10" style={{ color: 'var(--text-secondary)' }}>
            Drop any CSV below. No signup, no email, no strings attached.
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="border-2 border-dashed rounded-2xl p-14 transition-all cursor-pointer"
            style={{ borderColor: dragging ? 'var(--accent)' : 'var(--border)', background: dragging ? 'rgba(176,141,87,0.04)' : 'var(--bg-surface)' }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}>
            <Upload className="w-12 h-12 mx-auto mb-5" style={{ color: dragging ? 'var(--accent)' : 'var(--text-muted)' }} />
            <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Drop your CSV here</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>or click to browse · any CSV up to 20MB</p>
            <input ref={fileRef} type="file" accept=".csv,.tsv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Your data stays in your browser</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Dashboard in under 10 seconds</span>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// === PRICING ===
function Pricing() {
  const plans = [
    {
      name: 'Free', price: '$0', period: 'forever', accent: false,
      features: ['1 project', '1 dataset per project', '5 AI insight runs / month', '3 AI questions / month', 'Basic charts & KPIs', 'CSV upload'],
      cta: 'Get started free', href: '/#login',
    },
    {
      name: 'Pro', price: '$19', period: '/month', accent: true,
      features: ['Unlimited projects', 'Unlimited datasets', 'Unlimited AI insights', 'Unlimited AI questions', 'PDF export with branding', 'Google Sheets live sync', 'Team sharing (up to 5)', 'White-label dashboards', 'Scheduled reports', 'Priority support'],
      cta: 'Start Pro — 14 day trial', href: '/#login',
    },
    {
      name: 'Enterprise', price: 'Custom', period: '', accent: false,
      features: ['Everything in Pro', 'Unlimited team members', 'SSO / SAML', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'Custom data connectors', 'On-premise option'],
      cta: 'Contact us', href: 'mailto:hello@northernbird.io',
    },
  ]

  return (
    <section id="pricing" className="py-24 px-6" style={{ background: 'var(--bg-surface)' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--accent)' }}>Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
              Simple pricing, no surprises
            </h2>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>Start free. Upgrade when you need more.</p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.1}>
              <div className="rounded-2xl p-7 h-full flex flex-col relative"
                style={{
                  background: plan.accent ? 'var(--text-primary)' : 'var(--bg-primary)',
                  border: plan.accent ? 'none' : '1px solid var(--border)',
                  boxShadow: plan.accent ? '0 20px 40px rgba(0,0,0,0.12)' : 'none',
                }}>
                {plan.accent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ background: 'var(--accent)' }}>Most popular</div>
                )}
                <div className="mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3"
                    style={{ color: plan.accent ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold" style={{ color: plan.accent ? '#fff' : 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{plan.price}</span>
                    {plan.period && <span className="text-sm" style={{ color: plan.accent ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)' }}>{plan.period}</span>}
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm"
                      style={{ color: plan.accent ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                      <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: plan.accent ? 'var(--accent)' : 'var(--accent)' }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <a href={plan.href} className="block text-center px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{
                    background: plan.accent ? 'var(--accent)' : 'transparent',
                    color: plan.accent ? '#fff' : 'var(--accent)',
                    border: plan.accent ? 'none' : '1.5px solid var(--accent)',
                  }}>{plan.cta}</a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// === FINAL CTA ===
function FinalCTA() {
  return (
    <section className="py-24 px-6">
      <FadeIn>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
            Your data is sitting there.<br />Let it talk.
          </h2>
          <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Join teams who stopped wrestling with spreadsheets and started making decisions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/#login" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ background: 'var(--accent)' }}>
              Get started free <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/instant" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}>
              Or try it now — no signup <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

// === FOOTER ===
function Footer() {
  return (
    <footer className="py-12 px-6" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/logo_mark.png" alt="NB" className="w-7 h-7 object-contain" />
              <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>NORTHERN BIRD</span>
            </div>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>AI-powered analytics dashboards from any spreadsheet. Built for teams who need answers, not another tool to learn.</p>
          </div>
          <div className="flex gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Product</p>
              <div className="space-y-2">
                {['Features', 'Pricing', 'Instant Tool', 'Changelog'].map(l => (
                  <a key={l} href={l === 'Instant Tool' ? '/instant' : `#${l.toLowerCase()}`} className="block text-sm" style={{ color: 'var(--text-secondary)' }}>{l}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Company</p>
              <div className="space-y-2">
                {['About', 'Privacy', 'Terms', 'Contact'].map(l => (
                  <a key={l} href="#" className="block text-sm" style={{ color: 'var(--text-secondary)' }}>{l}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>&copy; {new Date().getFullYear()} Northern Bird Analytics. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

// =============================================
// MAIN EXPORT
// =============================================
export default function LandingPage() {
  return (
    <div style={{ background: 'var(--bg-primary)' }}>
      <Navbar />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <TryItNow />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  )
}
