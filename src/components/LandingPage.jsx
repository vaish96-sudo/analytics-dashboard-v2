import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  BarChart3, Sparkles, ArrowRight, Upload, FileSpreadsheet, Share2,
  TrendingUp, Wand2, FileDown, Shield, Zap, Users, Check, MessageSquare,
  PieChart, LayoutDashboard, Globe, ArrowUpRight
} from 'lucide-react'

/* ============================================================
   SCROLL ANIMATION
   ============================================================ */
function useInView(ref, threshold = 0.15) {
  const [v, setV] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref, threshold])
  return v
}

function FadeIn({ children, className = '', delay = 0, y = 28 }) {
  const ref = useRef(null)
  const vis = useInView(ref)
  return (
    <div ref={ref} className={className} style={{
      opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : `translateY(${y}px)`,
      transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}s`,
    }}>{children}</div>
  )
}

/* ============================================================
   COUNTING ANIMATION
   ============================================================ */
function CountUp({ target, prefix = '', suffix = '', duration = 1600 }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)
  const vis = useInView(ref, 0.5)
  useEffect(() => {
    if (!vis || started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * ease))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [vis, target, duration])
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>
}

/* ============================================================
   MU LOGO (inline, for landing page use)
   ============================================================ */
function MuLogo({ size = 32 }) {
  const r = Math.round(size * 0.22)
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: 'linear-gradient(135deg, #0a1f3d, #1a3f6b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 56 56">
        <defs><linearGradient id={`lmu${size}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5ba3e0" /><stop offset="100%" stopColor="#fff" /></linearGradient></defs>
        <text x="28" y="46" textAnchor="middle" fontSize="58" fontWeight="800" fontStyle="italic" fontFamily="Georgia,serif" fill={`url(#lmu${size})`}>µ</text>
      </svg>
    </div>
  )
}

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ background: scrolled ? 'rgba(244,246,248,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none', borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MuLogo size={30} />
          <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>Meuris</span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Analytics</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Features</a>
          <a href="#pricing" className="text-sm transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Pricing</a>
          <a href="/instant" className="text-sm transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Try Free</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/#login" className="text-sm font-medium hidden sm:inline transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Log in</a>
          <a href="/#login" className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-transform hover:scale-[1.03]" style={{ background: 'linear-gradient(135deg, #1a3f6b, #0a1f3d)' }}>Get started free</a>
        </div>
      </div>
    </nav>
  )
}

/* ============================================================
   HERO — animated dashboard mockup
   ============================================================ */
function Hero() {
  return (
    <section className="pt-28 sm:pt-36 pb-20 px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59,139,212,0.07), transparent)' }} />

      <div className="max-w-5xl mx-auto text-center relative">
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-medium"
            style={{ background: 'rgba(59,139,212,0.08)', color: '#1a3f6b', border: '1px solid rgba(59,139,212,0.15)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#3b8bd4' }} /> AI-powered analytics for any dataset
          </div>
        </FadeIn>

        <FadeIn delay={0.08}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] mb-6 tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
            Upload a spreadsheet.<br />
            <span style={{ background: 'linear-gradient(135deg, #3b8bd4, #0a1f3d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Get answers in seconds.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.16}>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Meuris Analytics turns your CSV or Google Sheet into an interactive dashboard 
            with AI insights, beautiful charts, and shareable reports — no code, no setup.
          </p>
        </FadeIn>

        <FadeIn delay={0.24}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="/#login" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.03] hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1a3f6b, #0a1f3d)', boxShadow: '0 4px 14px rgba(10,31,61,0.25)' }}>
              Start free — no credit card <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/instant" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-medium transition-all hover:shadow-md"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              <Upload className="w-4 h-4" style={{ color: '#3b8bd4' }} /> Try with your CSV — no signup
            </a>
          </div>
        </FadeIn>

        {/* ANIMATED DASHBOARD MOCKUP */}
        <FadeIn delay={0.32}>
          <div className="relative max-w-4xl mx-auto">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 25px 80px rgba(10,31,61,0.10), 0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Chrome */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} /><div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} /><div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} /></div>
                <div className="flex-1 flex justify-center"><div className="px-12 py-1 rounded-md text-xs" style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}>app.meuris.io</div></div>
              </div>

              <div className="p-5 grid grid-cols-12 gap-4">
                {/* Sidebar hint */}
                <div className="col-span-2 space-y-2 hidden lg:block">
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(59,139,212,0.08)', borderLeft: '2px solid #3b8bd4' }}>
                    <LayoutDashboard className="w-3 h-3" style={{ color: '#3b8bd4' }} />
                    <span className="text-[10px] font-semibold" style={{ color: '#1a3f6b' }}>Overview</span>
                  </div>
                  {['Data', 'AI', 'Builder'].map(t => (
                    <div key={t} className="flex items-center gap-2 px-2.5 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}><div className="w-3 h-3 rounded" style={{ background: 'var(--bg-overlay)' }} />{t}</div>
                  ))}
                </div>

                {/* Main */}
                <div className="col-span-12 lg:col-span-10 space-y-3">
                  {/* Insight */}
                  <div className="rounded-xl p-2.5 flex items-center gap-2.5" style={{ background: 'rgba(59,139,212,0.05)', border: '1px solid rgba(59,139,212,0.1)' }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: '#3b8bd4' }} />
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>AI found 5 insights in your data</span>
                    <span className="ml-auto text-[9px]" style={{ color: '#3b8bd4' }}>View all →</span>
                  </div>

                  {/* KPIs — count up */}
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      { label: 'Revenue', value: 142000, prefix: '$', suffix: '', color: '#3b82f6', display: '142K' },
                      { label: 'Orders', value: 2847, prefix: '', suffix: '', color: '#10b981', display: '2,847' },
                      { label: 'Avg Order', value: 49, prefix: '$', suffix: '.80', color: '#f97316', display: '$49.80' },
                      { label: 'Growth', value: 23, prefix: '+', suffix: '%', color: '#8b5cf6', display: '+23%' },
                    ].map(k => (
                      <div key={k.label} className="p-2.5 rounded-xl transition-all" style={{ background: 'var(--bg-surface)', border: `1.5px solid ${k.color}18` }}>
                        <span className="text-[8px] font-bold uppercase tracking-wider block" style={{ color: k.color }}>{k.label}</span>
                        <div className="text-base font-bold mt-0.5" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>
                          <CountUp target={k.value} prefix={k.prefix} suffix={k.suffix === '.80' ? '.80' : k.suffix} duration={1800} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <AnimatedBarChart />
                    <AnimatedLineChart />
                  </div>
                </div>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute -inset-6 -z-10 rounded-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(59,139,212,0.08), transparent 70%)' }} />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

function AnimatedBarChart() {
  const ref = useRef(null)
  const vis = useInView(ref, 0.3)
  const bars = [82, 65, 74, 48, 58, 88, 70]
  return (
    <div ref={ref} className="rounded-xl p-3.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', height: 130 }}>
      <div className="text-[10px] font-medium mb-2.5" style={{ color: 'var(--text-secondary)' }}>Revenue by channel</div>
      <div className="flex items-end gap-[5px] h-14">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t transition-all" style={{
            height: vis ? `${h}%` : '0%',
            background: i === 5 ? '#1a3f6b' : `rgba(59,139,212,${0.2 + i * 0.05})`,
            transitionDuration: `${0.6 + i * 0.08}s`,
            transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)',
            transitionDelay: `${0.1 + i * 0.06}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

function AnimatedLineChart() {
  const ref = useRef(null)
  const vis = useInView(ref, 0.3)
  return (
    <div ref={ref} className="rounded-xl p-3.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', height: 130 }}>
      <div className="text-[10px] font-medium mb-2.5" style={{ color: 'var(--text-secondary)' }}>Monthly trend</div>
      <svg viewBox="0 0 200 55" className="w-full h-14" style={{ overflow: 'visible' }}>
        <path d="M0,45 Q25,38 50,30 T100,16 T150,20 T200,8" fill="none" stroke="#3b8bd4" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="300" strokeDashoffset={vis ? 0 : 300} style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(.16,1,.3,1) 0.3s' }} />
        <path d="M0,45 Q25,38 50,30 T100,16 T150,20 T200,8 L200,55 L0,55 Z" fill="rgba(59,139,212,0.06)"
          opacity={vis ? 1 : 0} style={{ transition: 'opacity 0.8s ease 1.2s' }} />
      </svg>
    </div>
  )
}

/* ============================================================
   SOCIAL PROOF
   ============================================================ */
function SocialProof() {
  return (
    <FadeIn>
      <section className="py-12 px-6" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-6" style={{ color: 'var(--text-muted)' }}>Built for teams who move fast</p>
          <div className="flex items-center justify-center gap-8 sm:gap-14 flex-wrap">
            {['Marketing', 'Sales Ops', 'Finance', 'E-commerce', 'Startups', 'Agencies'].map(t => (
              <span key={t} className="text-sm font-medium" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}

/* ============================================================
   FEATURES — hover animations
   ============================================================ */
function FeatureCard({ icon: Icon, title, desc, color, delay }) {
  const [hovered, setHovered] = useState(false)
  return (
    <FadeIn delay={delay}>
      <div className="p-6 rounded-2xl h-full transition-all duration-300 cursor-default"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', transform: hovered ? 'translateY(-4px)' : 'translateY(0)', boxShadow: hovered ? '0 12px 32px rgba(10,31,61,0.08)' : 'none' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300"
          style={{ background: `${color}10`, transform: hovered ? 'scale(1.1)' : 'scale(1)' }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
      </div>
    </FadeIn>
  )
}

function Features() {
  const features = [
    { icon: Sparkles, title: 'AI Insights in Seconds', desc: 'Claude analyzes your data and surfaces trends, anomalies, and opportunities — with specific numbers, not generic advice.', color: '#8b5cf6' },
    { icon: BarChart3, title: 'Interactive Charts', desc: 'Auto-generated bar, line, pie, and area charts. Click to filter, switch dimensions, expand — no formulas needed.', color: '#3b82f6' },
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
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: '#3b8bd4' }}>Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>Everything you need, nothing you don't</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>From upload to insight in under a minute. No onboarding calls, no 50-page docs.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => <FeatureCard key={f.title} {...f} delay={i * 0.07} />)}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   HOW IT WORKS
   ============================================================ */
function HowItWorks() {
  const steps = [
    { num: '01', title: 'Upload your data', desc: 'Drop a CSV, connect Google Sheets, or paste a link. Any format, any industry.', icon: Upload },
    { num: '02', title: 'AI builds your dashboard', desc: 'Columns classified, charts picked, KPIs computed — all in under 10 seconds.', icon: Zap },
    { num: '03', title: 'Explore and share', desc: 'Interact with charts, ask AI questions, export PDFs, share with your team.', icon: Share2 },
  ]
  return (
    <section className="py-24 px-6" style={{ background: 'var(--bg-surface)' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: '#3b8bd4' }}>How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>Three steps. Sixty seconds.</h2>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.12}>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(59,139,212,0.08)' }}>
                  <s.icon className="w-7 h-7" style={{ color: '#1a3f6b' }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] block mb-2" style={{ color: '#3b8bd4' }}>{s.num}</span>
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

/* ============================================================
   TRY IT NOW — CSV drop
   ============================================================ */
function TryItNow() {
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState(false)
  const fileRef = useRef(null)
  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => { try { sessionStorage.setItem('nb_instant_file', e.target.result); sessionStorage.setItem('nb_instant_filename', file.name) } catch {}; window.location.href = '/instant' }
    reader.readAsText(file)
  }
  const active = dragging || hover
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: '#3b8bd4' }}>Try it now</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>See it with your own data</h2>
          <p className="text-base mb-10" style={{ color: 'var(--text-secondary)' }}>Drop any CSV below. No signup, no email, no strings attached.</p>
        </FadeIn>
        <FadeIn delay={0.12}>
          <div className="border-2 border-dashed rounded-2xl p-14 transition-all duration-300 cursor-pointer"
            style={{ borderColor: active ? '#3b8bd4' : 'var(--border)', background: active ? 'rgba(59,139,212,0.03)' : 'var(--bg-surface)', transform: active ? 'scale(1.01)' : 'scale(1)' }}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}>
            <Upload className="w-12 h-12 mx-auto mb-5 transition-transform duration-300" style={{ color: active ? '#3b8bd4' : 'var(--text-muted)', transform: active ? 'translateY(-4px)' : 'translateY(0)' }} />
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

/* ============================================================
   PRICING — shimmer on Pro
   ============================================================ */
function Pricing() {
  const plans = [
    { name: 'Free', price: '$0', period: 'forever', accent: false,
      features: ['1 project', '1 dataset per project', '5 AI insight runs / month', '3 AI questions / month', 'Basic charts & KPIs', 'CSV upload'],
      cta: 'Get started free', href: '/#login' },
    { name: 'Pro', price: '$19', period: '/month', accent: true,
      features: ['Unlimited projects', 'Unlimited datasets', 'Unlimited AI insights', 'Unlimited AI questions', 'PDF export with branding', 'Google Sheets live sync', 'Team sharing (up to 5)', 'White-label dashboards', 'Scheduled reports', 'Priority support'],
      cta: 'Start Pro — 14 day trial', href: '/#login' },
    { name: 'Enterprise', price: 'Custom', period: '', accent: false,
      features: ['Everything in Pro', 'Unlimited team members', 'SSO / SAML', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'Custom data connectors', 'On-premise option'],
      cta: 'Contact us', href: 'mailto:hello@meuris.io' },
  ]
  return (
    <section id="pricing" className="py-24 px-6" style={{ background: 'var(--bg-surface)' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: '#3b8bd4' }}>Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>Simple pricing, no surprises</h2>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>Start free. Upgrade when you need more.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.1}>
              <div className="rounded-2xl p-7 h-full flex flex-col relative overflow-hidden"
                style={{ background: plan.accent ? 'linear-gradient(135deg, #0a1f3d, #1a3f6b)' : 'var(--bg-primary)', border: plan.accent ? 'none' : '1px solid var(--border)', boxShadow: plan.accent ? '0 20px 50px rgba(10,31,61,0.2)' : 'none' }}>
                {plan.accent && <>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: '#3b8bd4' }}>Most popular</div>
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(91,163,224,0.08) 45%, rgba(91,163,224,0.14) 50%, rgba(91,163,224,0.08) 55%, transparent 60%)', backgroundSize: '200% 100%', animation: 'shimmer 3s ease-in-out infinite' }} />
                </>}
                <div className="mb-6 relative">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: plan.accent ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)' }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold" style={{ color: plan.accent ? '#fff' : 'var(--text-primary)', fontFamily: 'Lora, serif' }}>{plan.price}</span>
                    {plan.period && <span className="text-sm" style={{ color: plan.accent ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)' }}>{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3 flex-1 mb-8 relative">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: plan.accent ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)' }}>
                      <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#3b8bd4' }} />{f}
                    </li>
                  ))}
                </ul>
                <a href={plan.href} className="relative block text-center px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background: plan.accent ? '#3b8bd4' : 'transparent', color: plan.accent ? '#fff' : '#1a3f6b', border: plan.accent ? 'none' : '1.5px solid #1a3f6b' }}>{plan.cta}</a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </section>
  )
}

/* ============================================================
   FINAL CTA
   ============================================================ */
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
            <a href="/#login" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg, #1a3f6b, #0a1f3d)', boxShadow: '0 4px 14px rgba(10,31,61,0.25)' }}>
              Get started free <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/instant" className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
              Or try it now — no signup <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  return (
    <footer className="py-12 px-6" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <MuLogo size={28} />
              <div>
                <span className="text-sm font-bold tracking-tight block" style={{ color: 'var(--text-primary)', fontFamily: 'Lora, serif' }}>Meuris</span>
                <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>Analytics</span>
              </div>
            </div>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>Intelligence, simplified. AI-powered dashboards from any spreadsheet.</p>
          </div>
          <div className="flex gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Product</p>
              <div className="space-y-2">
                {['Features', 'Pricing', 'Instant Tool'].map(l => (
                  <a key={l} href={l === 'Instant Tool' ? '/instant' : `#${l.toLowerCase()}`} className="block text-sm transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>{l}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Company</p>
              <div className="space-y-2">
                {['About', 'Privacy', 'Terms', 'Contact'].map(l => (
                  <a key={l} href="#" className="block text-sm transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>{l}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>&copy; {new Date().getFullYear()} Meuris Analytics. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

/* ============================================================
   EXPORT
   ============================================================ */
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
