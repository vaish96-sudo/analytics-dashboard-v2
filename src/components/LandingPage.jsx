import React, { useState, useRef, useEffect } from 'react'
import {
  BarChart3, Sparkles, ArrowRight, Upload, FileSpreadsheet, Share2,
  TrendingUp, Wand2, FileDown, Shield, Zap, Users, Check, MessageSquare,
  Globe, ArrowUpRight, LayoutDashboard, PieChart
} from 'lucide-react'

const C = { dark: '#0c1425', mid: '#162236', cyan: '#0ea5e9', cyanLight: '#38bdf8', cyanGlow: 'rgba(14,165,233,0.12)', bg: '#f8fafc' }

/* === HOOKS === */
function useInView(ref, threshold = 0.15) {
  const [v, setV] = useState(false)
  useEffect(() => { if (!ref.current) return; const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold }); o.observe(ref.current); return () => o.disconnect() }, [ref, threshold]); return v
}
function useParallax() {
  const [y, setY] = useState(0)
  useEffect(() => { const h = () => setY(window.scrollY); window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h) }, []); return y
}

function FadeIn({ children, className = '', delay = 0, y = 30 }) {
  const ref = useRef(null); const vis = useInView(ref)
  return <div ref={ref} className={className} style={{ opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : `translateY(${y}px)`, transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}s` }}>{children}</div>
}

function CountUp({ target, prefix = '', suffix = '', duration = 1800 }) {
  const [val, setVal] = useState(0); const ref = useRef(null); const started = useRef(false); const vis = useInView(ref, 0.5)
  useEffect(() => { if (!vis || started.current) return; started.current = true; const s = performance.now(); const t = (n) => { const p = Math.min((n - s) / duration, 1); setVal(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(t) }; requestAnimationFrame(t) }, [vis, target, duration])
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>
}

function MuLogo({ size = 32 }) {
  const r = Math.round(size * 0.22)
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: `linear-gradient(135deg, ${C.dark}, ${C.mid})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 56 56">
        <defs><linearGradient id={`lmu${size}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={C.cyanLight} /><stop offset="100%" stopColor="#fff" /></linearGradient></defs>
        <text x="28" y="46" textAnchor="middle" fontSize="58" fontWeight="800" fontStyle="italic" fontFamily="Georgia,serif" fill={`url(#lmu${size})`}>µ</text>
      </svg>
    </div>
  )
}

/* === NAVBAR === */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h) }, [])
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ background: scrolled ? 'rgba(248,250,252,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none', borderBottom: scrolled ? '1px solid #e2e8f0' : '1px solid transparent' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MuLogo size={30} />
          <span className="text-sm font-bold tracking-tight" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>Meuris</span>
          <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>Analytics</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Pricing'].map(l => <a key={l} href={`#${l.toLowerCase()}`} className="text-sm transition-colors hover:opacity-60" style={{ color: '#475569' }}>{l}</a>)}
          <a href="/instant" className="text-sm transition-colors hover:opacity-60" style={{ color: '#475569' }}>Try Free</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/#login" className="text-sm font-medium hidden sm:inline hover:opacity-60" style={{ color: '#475569' }}>Log in</a>
          <a href="/#login" className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-all hover:scale-[1.03] hover:shadow-lg"
            style={{ background: C.dark, boxShadow: `0 2px 8px rgba(12,20,37,0.2)` }}>Get started</a>
        </div>
      </div>
    </nav>
  )
}

/* === HERO === */
function Hero() {
  const scrollY = useParallax()
  return (
    <section className="pt-28 sm:pt-36 pb-24 px-6 relative overflow-hidden">
      {/* Mesh background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 70% 50% at 60% 0%, ${C.cyanGlow}, transparent), radial-gradient(ellipse 50% 40% at 20% 10%, rgba(14,165,233,0.04), transparent)` }} />

      <div className="max-w-5xl mx-auto text-center relative">
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-medium"
            style={{ background: C.cyanGlow, color: C.dark, border: `1px solid rgba(14,165,233,0.18)` }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: C.cyan }} /> Intelligence, simplified
          </div>
        </FadeIn>

        <FadeIn delay={0.06}>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.08] mb-6 tracking-tight" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>
            Upload a spreadsheet.<br />
            <span style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.dark})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Get answers in seconds.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.12}>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: '#475569' }}>
            Drop any CSV or connect a Google Sheet. AI classifies your columns, builds charts, 
            and delivers strategic insights — no code, no setup, no waiting.
          </p>
        </FadeIn>

        <FadeIn delay={0.18}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <a href="/#login" className="group flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.03]"
              style={{ background: C.dark, boxShadow: `0 4px 20px rgba(12,20,37,0.25)` }}>
              Start free — no credit card <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a href="/instant" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-medium transition-all hover:shadow-md hover:border-[rgba(14,165,233,0.3)]"
              style={{ background: '#fff', color: C.dark, border: '1px solid #e2e8f0' }}>
              <Upload className="w-4 h-4" style={{ color: C.cyan }} /> Try with your CSV
            </a>
          </div>
        </FadeIn>

        {/* FLOATING DASHBOARD MOCKUP */}
        <FadeIn delay={0.25}>
          <div className="relative max-w-4xl mx-auto" style={{ transform: `translateY(${scrollY * 0.04}px)` }}>
            <div className="rounded-2xl overflow-hidden transition-shadow duration-500"
              style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 25px 100px rgba(12,20,37,0.08), 0 8px 32px rgba(14,165,233,0.04), 0 1px 3px rgba(0,0,0,0.03)',
                animation: 'float 6s ease-in-out infinite' }}>
              {/* Chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fca5a5' }} /><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fcd34d' }} /><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#86efac' }} /></div>
                <div className="flex-1 flex justify-center"><div className="px-10 py-0.5 rounded text-[10px]" style={{ background: '#f8fafc', color: '#94a3b8' }}>app.meuris.io</div></div>
              </div>
              <div className="p-5 grid grid-cols-12 gap-3">
                {/* Sidebar */}
                <div className="col-span-2 space-y-1.5 hidden lg:block">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md relative" style={{ background: C.cyanGlow }}>
                    <div style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 2.5, borderRadius: 2, background: C.cyan }} />
                    <LayoutDashboard className="w-3 h-3" style={{ color: C.cyan }} />
                    <span className="text-[9px] font-semibold" style={{ color: C.dark }}>Overview</span>
                  </div>
                  {['Data', 'AI', 'Builder'].map(t => (
                    <div key={t} className="flex items-center gap-1.5 px-2 py-1.5 text-[9px]" style={{ color: '#94a3b8' }}>
                      <div className="w-3 h-3 rounded" style={{ background: '#f1f5f9' }} />{t}
                    </div>
                  ))}
                </div>
                {/* Main */}
                <div className="col-span-12 lg:col-span-10 space-y-3">
                  {/* Insight */}
                  <div className="rounded-lg p-2 flex items-center gap-2" style={{ background: C.cyanGlow, border: `1px solid rgba(14,165,233,0.08)` }}>
                    <Sparkles className="w-3 h-3" style={{ color: C.cyan }} />
                    <span className="text-[9px] font-medium" style={{ color: C.dark }}>AI found 5 insights — revenue up 23%, West region outperforming</span>
                    <span className="ml-auto text-[8px] font-medium" style={{ color: C.cyan }}>View →</span>
                  </div>
                  {/* KPIs */}
                  <div className="grid grid-cols-4 gap-2">
                    {[{ l: 'Revenue', v: 142000, p: '$', c: '#3b82f6' }, { l: 'Orders', v: 2847, p: '', c: '#10b981' }, { l: 'Avg Order', v: 49, p: '$', s: '.80', c: '#f97316' }, { l: 'Growth', v: 23, p: '+', s: '%', c: '#8b5cf6' }].map(k => (
                      <div key={k.l} className="p-2 rounded-lg" style={{ background: '#fff', border: `1.5px solid ${k.c}12` }}>
                        <span className="text-[7px] font-bold uppercase tracking-wider block" style={{ color: k.c }}>{k.l}</span>
                        <div className="text-sm font-bold mt-0.5" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>
                          <CountUp target={k.v} prefix={k.p} suffix={k.s || ''} duration={2000} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Charts */}
                  <div className="grid grid-cols-2 gap-2">
                    <AnimatedBarChart />
                    <AnimatedLineChart />
                  </div>
                </div>
              </div>
            </div>
            {/* Glow under mockup */}
            <div className="absolute -inset-8 -z-10 rounded-3xl" style={{ background: `radial-gradient(ellipse at 50% 60%, rgba(14,165,233,0.06), transparent 65%)` }} />
          </div>
        </FadeIn>
      </div>
      <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
    </section>
  )
}

function AnimatedBarChart() {
  const ref = useRef(null); const vis = useInView(ref, 0.3)
  const bars = [82, 60, 74, 45, 55, 90, 65]
  return (
    <div ref={ref} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #f1f5f9', height: 115 }}>
      <div className="text-[9px] font-medium mb-2" style={{ color: '#475569' }}>Revenue by channel</div>
      <div className="flex items-end gap-1 h-12">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t" style={{
            height: vis ? `${h}%` : '0%', background: i === 5 ? C.dark : `rgba(14,165,233,${0.15 + i * 0.06})`,
            transition: `height ${0.5 + i * 0.07}s cubic-bezier(.34,1.56,.64,1) ${0.15 + i * 0.05}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

function AnimatedLineChart() {
  const ref = useRef(null); const vis = useInView(ref, 0.3)
  return (
    <div ref={ref} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #f1f5f9', height: 115 }}>
      <div className="text-[9px] font-medium mb-2" style={{ color: '#475569' }}>Monthly trend</div>
      <svg viewBox="0 0 200 50" className="w-full h-12" style={{ overflow: 'visible' }}>
        <path d="M0,42 Q25,36 50,28 T100,14 T150,18 T200,6" fill="none" stroke={C.cyan} strokeWidth="2" strokeLinecap="round"
          strokeDasharray="300" strokeDashoffset={vis ? 0 : 300} style={{ transition: 'stroke-dashoffset 2s cubic-bezier(.16,1,.3,1) 0.4s' }} />
        <path d="M0,42 Q25,36 50,28 T100,14 T150,18 T200,6 L200,50 L0,50 Z" fill={C.cyanGlow}
          opacity={vis ? 1 : 0} style={{ transition: 'opacity 0.6s ease 1.5s' }} />
      </svg>
    </div>
  )
}

/* === STATS BAR === */
function Stats() {
  return (
    <section className="py-14 px-6" style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
      <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
        {[{ v: 10000, s: '+', l: 'Datasets analyzed' }, { v: 60, s: 's', l: 'Avg time to dashboard' }, { v: 500, s: '+', l: 'AI insights generated' }, { v: 99, s: '%', l: 'Uptime SLA' }].map((s, i) => (
          <FadeIn key={s.l} delay={i * 0.08}>
            <div>
              <div className="text-3xl sm:text-4xl font-bold mb-1" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>
                <CountUp target={s.v} suffix={s.s} duration={2000} />
              </div>
              <p className="text-xs" style={{ color: '#94a3b8' }}>{s.l}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  )
}

/* === FEATURES === */
function FeatureCard({ icon: Icon, title, desc, color, delay }) {
  const [h, setH] = useState(false)
  return (
    <FadeIn delay={delay}>
      <div className="p-6 rounded-2xl h-full cursor-default transition-all duration-300"
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ background: '#fff', border: '1px solid #e2e8f0', transform: h ? 'translateY(-6px)' : 'translateY(0)', boxShadow: h ? `0 16px 40px rgba(12,20,37,0.06), 0 0 0 1px ${color}15` : 'none' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
          style={{ background: `${color}08`, transform: h ? 'scale(1.1) rotate(-3deg)' : 'scale(1)' }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="text-base font-bold mb-2" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
      </div>
    </FadeIn>
  )
}

function Features() {
  const features = [
    { icon: Sparkles, title: 'AI Insights in Seconds', desc: 'Claude analyzes your data and surfaces trends, anomalies, and opportunities — with specific numbers and actionable recommendations.', color: '#8b5cf6' },
    { icon: BarChart3, title: 'Interactive Charts', desc: 'Auto-generated bar, line, pie, and area charts. Click any bar to filter, switch dimensions on the fly, expand to full screen.', color: C.cyan },
    { icon: MessageSquare, title: 'Ask AI Anything', desc: '"What\'s my top product by margin?" Ask questions in plain English and get answers backed by your actual data.', color: '#10b981' },
    { icon: FileDown, title: 'Executive Reports', desc: 'Export consulting-grade PDFs with your branding — executive summary, insight cards, and interactive charts, ready for the boardroom.', color: '#f97316' },
    { icon: Users, title: 'Team Collaboration', desc: 'Invite your team with role-based access. Share dashboards per client, per project. Everyone sees what they need.', color: '#ec4899' },
    { icon: Globe, title: 'Google Sheets Live Sync', desc: 'Connect a Sheet and set auto-refresh. Your dashboard updates daily — always fresh data without re-uploading.', color: '#06b6d4' },
  ]
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>Everything you need, nothing you don't</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#64748b' }}>From upload to insight in under a minute. No onboarding calls, no 50-page docs.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{features.map((f, i) => <FeatureCard key={f.title} {...f} delay={i * 0.06} />)}</div>
      </div>
    </section>
  )
}

/* === HOW IT WORKS === */
function HowItWorks() {
  const steps = [
    { num: '01', title: 'Upload your data', desc: 'Drop a CSV, connect Google Sheets, or paste a link. Any format, any industry — sales, marketing, HR, finance, ops.', icon: Upload },
    { num: '02', title: 'AI builds your dashboard', desc: 'Columns classified, charts picked, KPIs computed, insights generated. All in under 10 seconds, no configuration.', icon: Zap },
    { num: '03', title: 'Explore and share', desc: 'Interact with charts, ask AI follow-up questions, export branded PDFs, invite your team. Your data, working for you.', icon: Share2 },
  ]
  return (
    <section className="py-24 px-6" style={{ background: '#fff' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>Three steps. Sixty seconds.</h2>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.1}>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center relative" style={{ background: C.cyanGlow }}>
                  <s.icon className="w-7 h-7" style={{ color: C.dark }} />
                  <span className="absolute -top-2 -right-2 text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: C.cyan }}>{s.num}</span>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

/* === TRY IT NOW === */
function TryItNow() {
  const [dragging, setDragging] = useState(false); const [hover, setHover] = useState(false); const fileRef = useRef(null)
  const handleFile = (f) => { if (!f) return; const r = new FileReader(); r.onload = (e) => { try { sessionStorage.setItem('nb_instant_file', e.target.result); sessionStorage.setItem('nb_instant_filename', f.name) } catch {}; window.location.href = '/instant' }; r.readAsText(f) }
  const active = dragging || hover
  return (
    <section className="py-24 px-6" style={{ background: '#f8fafc' }}>
      <div className="max-w-3xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>Try it now</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>See it with your own data</h2>
          <p className="text-base mb-10" style={{ color: '#64748b' }}>Drop any CSV below. No signup, no email, completely free.</p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="relative">
            <div className="border-2 border-dashed rounded-2xl p-16 transition-all duration-300 cursor-pointer relative z-10"
              style={{ borderColor: active ? C.cyan : '#e2e8f0', background: active ? 'rgba(14,165,233,0.02)' : '#fff', transform: active ? 'scale(1.005)' : 'scale(1)' }}
              onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
              onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}>
              <div className="transition-transform duration-300" style={{ transform: active ? 'translateY(-6px)' : 'translateY(0)' }}>
                <Upload className="w-12 h-12 mx-auto mb-5 transition-colors duration-300" style={{ color: active ? C.cyan : '#94a3b8' }} />
                <p className="text-base font-semibold mb-2" style={{ color: C.dark }}>Drop your CSV here</p>
                <p className="text-sm" style={{ color: '#94a3b8' }}>or click to browse · up to 20MB</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.tsv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `2px solid ${C.cyan}`, opacity: 0, animation: 'pulse-ring 3s ease-out infinite' }} />
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `2px solid ${C.cyan}`, opacity: 0, animation: 'pulse-ring 3s ease-out infinite 1.5s' }} />
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs" style={{ color: '#94a3b8' }}>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Your data stays in your browser</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Dashboard in under 10 seconds</span>
          </div>
        </FadeIn>
      </div>
      <style>{`@keyframes pulse-ring { 0%{transform:scale(1);opacity:0.15} 100%{transform:scale(1.04);opacity:0} }`}</style>
    </section>
  )
}

/* === PRICING === */
function Pricing() {
  const plans = [
    { name: 'Free', price: '$0', period: 'forever', accent: false, features: ['1 project', '1 dataset per project', '5 AI insight runs / month', '3 AI questions / month', 'Basic charts & KPIs', 'CSV upload'], cta: 'Get started free', href: '/#login' },
    { name: 'Pro', price: '$19', period: '/month', accent: true, features: ['Unlimited projects', 'Unlimited datasets', 'Unlimited AI insights', 'Unlimited AI questions', 'PDF export with branding', 'Google Sheets live sync', 'Team sharing (up to 5)', 'White-label dashboards', 'Scheduled reports', 'Priority support'], cta: 'Start Pro — 14 day trial', href: '/#login' },
    { name: 'Enterprise', price: 'Custom', period: '', accent: false, features: ['Everything in Pro', 'Unlimited team members', 'SSO / SAML', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'Custom data connectors', 'On-premise option'], cta: 'Contact us', href: 'mailto:hello@meuris.io' },
  ]
  return (
    <section id="pricing" className="py-24 px-6" style={{ background: '#fff' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>Simple pricing, no surprises</h2>
            <p className="text-base" style={{ color: '#64748b' }}>Start free. Upgrade when you need more.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((p, i) => (
            <FadeIn key={p.name} delay={i * 0.08}>
              <div className="rounded-2xl p-7 h-full flex flex-col relative overflow-hidden"
                style={{ background: p.accent ? `linear-gradient(135deg, ${C.dark}, ${C.mid})` : '#f8fafc', border: p.accent ? 'none' : '1px solid #e2e8f0', boxShadow: p.accent ? '0 24px 60px rgba(12,20,37,0.18)' : 'none' }}>
                {p.accent && <>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: C.cyan }}>Most popular</div>
                  <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(105deg, transparent 40%, rgba(14,165,233,0.06) 45%, rgba(14,165,233,0.12) 50%, rgba(14,165,233,0.06) 55%, transparent 60%)`, backgroundSize: '200% 100%', animation: 'shimmer 4s ease-in-out infinite' }} />
                </>}
                <div className="mb-6 relative">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: p.accent ? 'rgba(255,255,255,0.45)' : '#94a3b8' }}>{p.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold" style={{ color: p.accent ? '#fff' : C.dark, fontFamily: 'Lora, serif' }}>{p.price}</span>
                    {p.period && <span className="text-sm" style={{ color: p.accent ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>{p.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3 flex-1 mb-8 relative">
                  {p.features.map(f => <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: p.accent ? 'rgba(255,255,255,0.7)' : '#64748b' }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.cyan }} />{f}
                  </li>)}
                </ul>
                <a href={p.href} className="relative block text-center px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background: p.accent ? C.cyan : 'transparent', color: p.accent ? '#fff' : C.dark, border: p.accent ? 'none' : `1.5px solid ${C.dark}` }}>{p.cta}</a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </section>
  )
}

/* === FINAL CTA === */
function FinalCTA() {
  return (
    <section className="py-24 px-6" style={{ background: '#f8fafc' }}>
      <FadeIn>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>
            Your data is sitting there.<br />Let it talk.
          </h2>
          <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: '#64748b' }}>
            Join teams who stopped wrestling with spreadsheets and started making decisions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/#login" className="group flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.03]"
              style={{ background: C.dark, boxShadow: '0 4px 20px rgba(12,20,37,0.25)' }}>
              Get started free <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a href="/instant" className="flex items-center gap-2 text-sm font-medium hover:opacity-60 transition-colors" style={{ color: '#64748b' }}>
              Or try now — no signup <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

/* === FOOTER === */
function Footer() {
  return (
    <footer className="py-12 px-6" style={{ borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <MuLogo size={28} />
              <div>
                <span className="text-sm font-bold tracking-tight block" style={{ color: C.dark, fontFamily: 'Lora, serif' }}>Meuris</span>
                <span className="text-[9px] font-medium" style={{ color: '#94a3b8' }}>Analytics</span>
              </div>
            </div>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: '#94a3b8' }}>Intelligence, simplified. AI-powered dashboards from any spreadsheet.</p>
          </div>
          <div className="flex gap-16">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Product</p>
              <div className="space-y-2">{['Features', 'Pricing', 'Instant Tool'].map(l => <a key={l} href={l === 'Instant Tool' ? '/instant' : `#${l.toLowerCase()}`} className="block text-sm hover:opacity-60 transition-colors" style={{ color: '#64748b' }}>{l}</a>)}</div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Company</p>
              <div className="space-y-2">{['About', 'Privacy', 'Terms', 'Contact'].map(l => <a key={l} href="#" className="block text-sm hover:opacity-60 transition-colors" style={{ color: '#64748b' }}>{l}</a>)}</div>
            </div>
          </div>
        </div>
        <div className="pt-6" style={{ borderTop: '1px solid #e2e8f0' }}>
          <p className="text-xs" style={{ color: '#cbd5e1' }}>&copy; {new Date().getFullYear()} Meuris Analytics. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

/* === EXPORT === */
export default function LandingPage() {
  return (
    <div style={{ background: '#f8fafc' }}>
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <TryItNow />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  )
}
