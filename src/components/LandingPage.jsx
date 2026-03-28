import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  BarChart3, Sparkles, ArrowRight, Upload, FileSpreadsheet, Share2,
  TrendingUp, Wand2, FileDown, Shield, Zap, Users, Check, MessageSquare,
  Globe, ArrowUpRight, LayoutDashboard
} from 'lucide-react'

const C = { dark: '#0c1425', mid: '#162236', cyan: '#0ea5e9', cyanLight: '#38bdf8', cyanGlow: 'rgba(14,165,233,0.12)' }
const COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#0369a1', '#0c4a6e', '#06b6d4', '#22d3ee']

/* ============================================================
   HOOKS
   ============================================================ */
function useInView(ref, threshold = 0.15) {
  const [v, setV] = useState(false)
  useEffect(() => { if (!ref.current) return; const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold }); o.observe(ref.current); return () => o.disconnect() }, [ref, threshold]); return v
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

/* ============================================================
   PARTICLE HERO
   ============================================================ */
function ParticleHero() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const particles = useRef([])
  const mouse = useRef({ x: -999, y: -999 })
  const scrollPct = useRef(0)
  const dims = useRef({ w: 800, h: 600 })

  useEffect(() => {
    const cv = canvasRef.current
    const cx = cv.getContext('2d')
    const container = containerRef.current

    function resize() {
      dims.current.w = container.offsetWidth
      dims.current.h = container.offsetHeight
      cv.width = dims.current.w * 2
      cv.height = dims.current.h * 2
      cx.scale(2, 2)
      setTargets()
    }

    function initParticles() {
      const W = dims.current.w, H = dims.current.h
      particles.current = []
      for (let i = 0; i < 160; i++) {
        particles.current.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 3.5 + 1.5,
          c: COLORS[Math.floor(Math.random() * COLORS.length)],
          a: 0.25 + Math.random() * 0.45,
          tx: 0, ty: 0,
        })
      }
    }

    function setTargets() {
      const W = dims.current.w, H = dims.current.h
      const bx = W * 0.2, by = H * 0.48, bw = W * 0.6, bh = H * 0.38
      const barW = bw / 7
      const heights = [0.78, 0.55, 0.72, 0.4, 0.58, 0.92, 0.48]
      particles.current.forEach((p, i) => {
        const bar = i % 7
        const bTop = by + bh * (1 - heights[bar])
        p.tx = bx + bar * barW + barW * 0.15 + Math.random() * barW * 0.7
        p.ty = bTop + Math.random() * (by + bh - bTop)
      })
    }

    initParticles()
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e) => {
      const r = container.getBoundingClientRect()
      mouse.current.x = e.clientX - r.left
      mouse.current.y = e.clientY - r.top
    }
    const onLeave = () => { mouse.current.x = -999; mouse.current.y = -999 }
    const onScroll = () => {
      const r = container.getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, -r.top / (r.height * 0.5)))
      scrollPct.current = progress
    }

    container.addEventListener('mousemove', onMove)
    container.addEventListener('touchmove', (e) => { const t = e.touches[0]; const r = container.getBoundingClientRect(); mouse.current.x = t.clientX - r.left; mouse.current.y = t.clientY - r.top }, { passive: true })
    container.addEventListener('mouseleave', onLeave)
    window.addEventListener('scroll', onScroll, { passive: true })

    let raf
    function draw() {
      const W = dims.current.w, H = dims.current.h
      const mx = mouse.current.x, my = mouse.current.y
      const org = scrollPct.current
      cx.clearRect(0, 0, W, H)

      particles.current.forEach(p => {
        // Blend between float and organized based on scroll
        if (org > 0.1) {
          const strength = Math.min(org * 1.5, 1) * 0.06
          p.vx += (p.tx - p.x) * strength
          p.vy += (p.ty - p.y) * strength
          p.vx *= 0.92
          p.vy *= 0.92
        } else {
          p.vx += (Math.random() - 0.5) * 0.06
          p.vy += (Math.random() - 0.5) * 0.06
          p.vx *= 0.997
          p.vy *= 0.997
        }

        // Mouse attraction
        if (mx > 0) {
          const dx = mx - p.x, dy = my - p.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 140 && d > 1) {
            const f = 0.6 / d
            p.vx += dx * f * 0.12
            p.vy += dy * f * 0.12
          }
        }

        p.x += p.vx; p.y += p.vy
        if (p.x < 0) { p.x = 0; p.vx *= -0.5 }
        if (p.x > W) { p.x = W; p.vx *= -0.5 }
        if (p.y < 0) { p.y = 0; p.vy *= -0.5 }
        if (p.y > H) { p.y = H; p.vy *= -0.5 }

        cx.beginPath()
        cx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        cx.fillStyle = p.c
        cx.globalAlpha = p.a
        cx.fill()
      })

      // Connection lines
      cx.globalAlpha = 1
      const ps = particles.current
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 55) {
            cx.beginPath()
            cx.moveTo(ps[i].x, ps[i].y)
            cx.lineTo(ps[j].x, ps[j].y)
            cx.strokeStyle = `rgba(14,165,233,${0.06 * (1 - d / 55)})`
            cx.lineWidth = 0.5
            cx.stroke()
          }
        }
      }

      // Chart axes fade in as particles organize
      if (org > 0.3) {
        const fade = Math.min((org - 0.3) / 0.4, 1) * 0.35
        const bx = W * 0.2, by = H * 0.48, bw = W * 0.6, bh = H * 0.38
        cx.globalAlpha = fade
        cx.strokeStyle = C.cyan
        cx.lineWidth = 0.5
        cx.beginPath(); cx.moveTo(bx, by + bh); cx.lineTo(bx + bw, by + bh); cx.stroke()
        cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx, by + bh); cx.stroke()
        cx.fillStyle = '#94a3b8'; cx.font = '11px system-ui, sans-serif'; cx.textAlign = 'center'
        ;['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((l, i) => {
          cx.fillText(l, bx + bw / 7 * i + bw / 14, by + bh + 16)
        })
        cx.globalAlpha = 1
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll)
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <section ref={containerRef} className="relative" style={{ height: '100vh', minHeight: 600, maxHeight: 900, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {/* Content overlay */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2, pointerEvents: 'none', paddingTop: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 500, padding: '5px 16px', borderRadius: 20, background: C.cyanGlow, color: C.dark, border: '1px solid rgba(14,165,233,0.15)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles style={{ width: 14, height: 14, color: C.cyan }} /> Intelligence, simplified
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 56px)', fontWeight: 700, color: C.dark, fontFamily: 'Lora, Georgia, serif', textAlign: 'center', lineHeight: 1.1, margin: '0 0 16px' }}>
          Upload a spreadsheet.<br />
          <span style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.dark})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Get answers in seconds.</span>
        </h1>
        <p style={{ fontSize: 'clamp(14px, 1.8vw, 18px)', color: '#475569', textAlign: 'center', maxWidth: 520, lineHeight: 1.6, margin: '0 0 28px', padding: '0 20px' }}>
          Drop any CSV or connect Google Sheets. AI builds your dashboard — no code, no setup.
        </p>
        <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/#login" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, background: C.dark, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 20px rgba(12,20,37,0.25)', transition: 'transform 0.15s', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            Start free — no credit card <ArrowRight style={{ width: 16, height: 16 }} />
          </a>
          <a href="/instant" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, background: '#fff', color: C.dark, fontSize: 14, fontWeight: 500, textDecoration: 'none', border: '1px solid #e2e8f0', transition: 'all 0.15s', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0' }}>
            <Upload style={{ width: 16, height: 16, color: C.cyan }} /> Try with your CSV
          </a>
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, textAlign: 'center' }}>
          Move your mouse to attract the data points · Scroll to watch chaos become a chart
        </p>
      </div>
    </section>
  )
}

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h) }, [])
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ background: scrolled ? 'rgba(248,250,252,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none', borderBottom: scrolled ? '1px solid #e2e8f0' : '1px solid transparent' }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MuLogo size={30} />
          <span className="text-[15px] font-bold tracking-tight" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Meuris</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Pricing'].map(l => <a key={l} href={`#${l.toLowerCase()}`} className="text-sm transition-colors hover:opacity-60" style={{ color: '#475569', textDecoration: 'none' }}>{l}</a>)}
          <a href="/instant" className="text-sm transition-colors hover:opacity-60" style={{ color: '#475569', textDecoration: 'none' }}>Try Free</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/#login" className="text-sm font-medium hidden sm:inline hover:opacity-60" style={{ color: '#475569', textDecoration: 'none' }}>Log in</a>
          <a href="/#login" className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-all hover:scale-[1.03]"
            style={{ background: C.dark, textDecoration: 'none', boxShadow: '0 2px 8px rgba(12,20,37,0.18)' }}>Get started</a>
        </div>
      </div>
    </nav>
  )
}

/* ============================================================
   SOCIAL PROOF
   ============================================================ */
function SocialProof() {
  return (
    <FadeIn>
      <section className="py-14 px-6" style={{ borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-6" style={{ color: '#94a3b8' }}>Built for teams who move fast</p>
          <div className="flex items-center justify-center gap-8 sm:gap-14 flex-wrap">
            {['Marketing', 'Sales Ops', 'Finance', 'E-commerce', 'Startups', 'Agencies'].map(t => (
              <span key={t} className="text-sm font-medium" style={{ color: '#94a3b8', letterSpacing: '0.05em' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>
    </FadeIn>
  )
}

/* ============================================================
   FEATURES
   ============================================================ */
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
        <h3 className="text-base font-bold mb-2" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
      </div>
    </FadeIn>
  )
}

function Features() {
  const features = [
    { icon: Sparkles, title: 'AI Insights in Seconds', desc: 'Claude analyzes your data and surfaces trends, anomalies, and opportunities with specific numbers and actionable recommendations.', color: '#8b5cf6' },
    { icon: BarChart3, title: 'Interactive Charts', desc: 'Auto-generated bar, line, pie, and area charts. Click any bar to filter, switch dimensions on the fly, expand to full screen.', color: C.cyan },
    { icon: MessageSquare, title: 'Ask AI Anything', desc: '"What\'s my top product by margin?" Ask questions in plain English and get answers backed by your actual data.', color: '#10b981' },
    { icon: FileDown, title: 'Executive Reports', desc: 'Export consulting-grade PDFs with your branding — executive summary, insight cards, and charts, ready for the boardroom.', color: '#f97316' },
    { icon: Users, title: 'Team Collaboration', desc: 'Invite your team with role-based access. Share dashboards per client, per project. Everyone sees what they need.', color: '#ec4899' },
    { icon: Globe, title: 'Google Sheets Live Sync', desc: 'Connect a Sheet and set auto-refresh. Your dashboard updates daily — always fresh data without re-uploading.', color: '#06b6d4' },
  ]
  return (
    <section id="features" className="py-24 px-6" style={{ background: '#f8fafc' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Everything you need, nothing you don't</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#64748b' }}>From upload to insight in under a minute. No onboarding calls, no 50-page docs.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{features.map((f, i) => <FeatureCard key={f.title} {...f} delay={i * 0.06} />)}</div>
      </div>
    </section>
  )
}

/* ============================================================
   HOW IT WORKS
   ============================================================ */
function HowItWorks() {
  const steps = [
    { num: '01', title: 'Upload your data', desc: 'Drop a CSV, connect Google Sheets, or paste a link. Sales, marketing, HR, finance, ops — any dataset.', icon: Upload },
    { num: '02', title: 'AI builds your dashboard', desc: 'Columns classified, charts selected, KPIs computed, insights generated. Under 10 seconds, zero configuration.', icon: Zap },
    { num: '03', title: 'Explore and share', desc: 'Click charts to filter, ask AI follow-ups, export branded PDFs, invite your team.', icon: Share2 },
  ]
  return (
    <section className="py-24 px-6" style={{ background: '#fff' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Three steps. Sixty seconds.</h2>
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
                <h3 className="text-lg font-bold mb-2" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   TRY IT NOW
   ============================================================ */
function TryItNow() {
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState(false)
  const fileRef = useRef(null)
  const handleFile = (f) => {
    if (!f) return
    const r = new FileReader()
    r.onload = (e) => {
      try { sessionStorage.setItem('nb_instant_file', e.target.result); sessionStorage.setItem('nb_instant_filename', f.name) } catch {}
      window.location.href = '/instant'
    }
    r.readAsText(f)
  }
  const active = dragging || hover
  return (
    <section className="py-24 px-6" style={{ background: '#f8fafc' }}>
      <div className="max-w-3xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>Try it now</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>See it with your own data</h2>
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
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `2px solid ${C.cyan}`, opacity: 0, animation: 'pulse-ring 3s ease-out infinite' }} />
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `2px solid ${C.cyan}`, opacity: 0, animation: 'pulse-ring 3s ease-out infinite 1.5s' }} />
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs" style={{ color: '#94a3b8' }}>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Your data stays in your browser</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Dashboard in under 10 seconds</span>
          </div>
        </FadeIn>
      </div>
      <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:0.12}100%{transform:scale(1.04);opacity:0}}`}</style>
    </section>
  )
}

/* ============================================================
   PRICING
   ============================================================ */
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Simple pricing, no surprises</h2>
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
                    <span className="text-4xl font-bold" style={{ color: p.accent ? '#fff' : C.dark, fontFamily: 'Lora, Georgia, serif' }}>{p.price}</span>
                    {p.period && <span className="text-sm" style={{ color: p.accent ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>{p.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3 flex-1 mb-8 relative">
                  {p.features.map(f => <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: p.accent ? 'rgba(255,255,255,0.7)' : '#64748b' }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.cyan }} />{f}
                  </li>)}
                </ul>
                <a href={p.href} className="relative block text-center px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background: p.accent ? C.cyan : 'transparent', color: p.accent ? '#fff' : C.dark, border: p.accent ? 'none' : `1.5px solid ${C.dark}`, textDecoration: 'none' }}>{p.cta}</a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </section>
  )
}

/* ============================================================
   FINAL CTA
   ============================================================ */
function FinalCTA() {
  return (
    <section className="py-24 px-6" style={{ background: '#f8fafc' }}>
      <FadeIn>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>
            Your data is sitting there.<br />Let it talk.
          </h2>
          <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: '#64748b' }}>
            Join teams who stopped wrestling with spreadsheets and started making decisions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/#login" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.03]"
              style={{ background: C.dark, boxShadow: '0 4px 20px rgba(12,20,37,0.25)', textDecoration: 'none' }}>
              Get started free <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/instant" className="flex items-center gap-2 text-sm font-medium hover:opacity-60 transition-colors" style={{ color: '#64748b', textDecoration: 'none' }}>
              Or try now — no signup <ArrowUpRight className="w-4 h-4" />
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
    <footer className="py-12 px-6" style={{ borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <MuLogo size={28} />
              <span className="text-[15px] font-bold tracking-tight" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Meuris Analytics</span>
            </div>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: '#94a3b8' }}>Intelligence, simplified. AI-powered dashboards from any spreadsheet.</p>
          </div>
          <div className="flex gap-16">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Product</p>
              <div className="space-y-2">{['Features', 'Pricing', 'Instant Tool'].map(l => <a key={l} href={l === 'Instant Tool' ? '/instant' : `#${l.toLowerCase()}`} className="block text-sm hover:opacity-60 transition-colors" style={{ color: '#64748b', textDecoration: 'none' }}>{l}</a>)}</div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Company</p>
              <div className="space-y-2">{['About', 'Privacy', 'Terms', 'Contact'].map(l => <a key={l} href="#" className="block text-sm hover:opacity-60 transition-colors" style={{ color: '#64748b', textDecoration: 'none' }}>{l}</a>)}</div>
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

/* ============================================================
   EXPORT
   ============================================================ */
export default function LandingPage() {
  return (
    <div style={{ background: '#f8fafc' }}>
      <Navbar />
      <ParticleHero />
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
