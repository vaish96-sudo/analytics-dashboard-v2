import React, { useState, useRef, useEffect } from 'react'
import {
  BarChart3, Sparkles, ArrowRight, Upload, Share2,
  Zap, Users, Check, MessageSquare, FileDown, Shield, Globe, ArrowUpRight
} from 'lucide-react'

const C = { dark: '#0c1425', mid: '#162236', cyan: '#0ea5e9', cyanLight: '#38bdf8', cyanGlow: 'rgba(14,165,233,0.12)' }

/* === HOOKS & UTILS === */
function useInView(ref, threshold = 0.15) {
  const [v, setV] = useState(false)
  useEffect(() => { if (!ref.current) return; const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold }); o.observe(ref.current); return () => o.disconnect() }, [ref, threshold]); return v
}
function FadeIn({ children, className = '', delay = 0 }) {
  const ref = useRef(null); const vis = useInView(ref)
  return <div ref={ref} className={className} style={{ opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(28px)', transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}s` }}>{children}</div>
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
   MINI PARTICLE CHART — small, decorative, floats in whitespace
   ============================================================ */
function MiniParticleChart({ type, width, height, style, className = '' }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const cv = canvasRef.current, ctx = cv.getContext('2d')
    const W = width, H = height
    cv.width = W * 2; cv.height = H * 2; ctx.scale(2, 2)
    const SZ = 3
    const particles = []
    const blues = ['#38bdf8', '#0ea5e9', '#0284c7', '#7dd3fc', '#0369a1']

    // Generate chart shape targets
    function genChart() {
      if (type === 'bar') {
        const heights = [0.55, 0.4, 0.7, 0.3, 0.6]
        const bW = W * 0.15, gap = (W - bW * 5) / 6
        heights.forEach((h, i) => {
          const bx = gap + i * (bW + gap), by = H * (1 - h) * 0.85, bh = h * H * 0.75
          for (let py = by; py < by + bh; py += SZ) for (let px = bx; px < bx + bW; px += SZ) {
            particles.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, tx: px, ty: py, c: blues[i], dtx: 0, dty: 0 })
          }
        })
      } else if (type === 'line') {
        const pts = [0.6, 0.45, 0.55, 0.3, 0.4, 0.15, 0.25, 0.1]
        for (let i = 0; i < pts.length - 1; i++) {
          const x1 = i / (pts.length - 1) * W * 0.9 + W * 0.05
          const x2 = (i + 1) / (pts.length - 1) * W * 0.9 + W * 0.05
          const y1 = pts[i] * H * 0.7 + H * 0.1, y2 = pts[i + 1] * H * 0.7 + H * 0.1
          for (let x = x1; x < x2; x += SZ) {
            const t = (x - x1) / (x2 - x1), lY = y1 + (y2 - y1) * t
            particles.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, tx: x, ty: lY, c: '#0ea5e9', dtx: 0, dty: 0 })
            for (let y = lY + SZ; y < H * 0.85; y += SZ * 2) {
              particles.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, tx: x, ty: y, c: '#bae6fd', dtx: 0, dty: 0 })
            }
          }
        }
      } else if (type === 'donut') {
        const cx0 = W / 2, cy0 = H / 2, R = Math.min(W, H) * 0.4, iR = R * 0.55
        const slices = [0.35, 0.25, 0.2, 0.2]
        let sA = -Math.PI / 2
        slices.forEach((s, si) => {
          const eA = sA + s * Math.PI * 2
          for (let a = sA; a < eA; a += 0.04) for (let r = iR; r < R; r += SZ) {
            particles.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, tx: cx0 + Math.cos(a) * r, ty: cy0 + Math.sin(a) * r, c: blues[si], dtx: 0, dty: 0 })
          }
          sA = eA
        })
      } else if (type === 'scatter') {
        for (let i = 0; i < 40; i++) {
          const px = W * 0.1 + Math.random() * W * 0.8
          const py = H * 0.8 - (px / W) * H * 0.6 + (Math.random() - 0.5) * H * 0.2
          for (let a = 0; a < Math.PI * 2; a += 0.8) {
            particles.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, tx: px + Math.cos(a) * 3, ty: py + Math.sin(a) * 3, c: blues[i % blues.length], dtx: 0, dty: 0 })
          }
        }
      }
      // Set drift targets
      particles.forEach(p => { p.dtx = Math.random() * W; p.dty = Math.random() * H })
    }
    genChart()

    let phase = 'forming', timer = 0
    const FORM = 150, HOLD = 200, DRIFT = 250
    let raf

    function draw() {
      ctx.clearRect(0, 0, W, H)
      timer++
      if (phase === 'forming' && timer > FORM) { phase = 'holding'; timer = 0 }
      else if (phase === 'holding' && timer > HOLD) { phase = 'drifting'; timer = 0; particles.forEach(p => { p.dtx = Math.random() * W; p.dty = Math.random() * H }) }
      else if (phase === 'drifting' && timer > DRIFT) { phase = 'forming'; timer = 0 }

      const spring = phase === 'forming' ? 0.03 : phase === 'holding' ? 0.1 : 0.015
      const fric = phase === 'holding' ? 0.8 : 0.91
      const tx = phase === 'drifting' ? 'dtx' : 'tx'
      const ty = phase === 'drifting' ? 'dty' : 'ty'

      let settled = 0
      particles.forEach(p => {
        const dx = p[tx] - p.x, dy = p[ty] - p.y
        p.vx += dx * spring; p.vy += dy * spring
        if (phase === 'drifting') { p.vx += (Math.random() - 0.5) * 0.08; p.vy += (Math.random() - 0.5) * 0.08 }
        p.vx *= fric; p.vy *= fric
        p.x += p.vx; p.y += p.vy
        if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) settled++
      })

      const isSolid = phase === 'holding' || (phase === 'forming' && settled / particles.length > 0.75)
      particles.forEach(p => {
        ctx.globalAlpha = phase === 'drifting' ? 0.35 : p.c === '#bae6fd' ? 0.3 : 0.7
        ctx.fillStyle = p.c
        if (isSolid) ctx.fillRect(p.x, p.y, SZ, SZ)
        else { ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill() }
      })

      if (phase === 'drifting') {
        ctx.globalAlpha = 1
        for (let i = 0; i < particles.length; i += 6) {
          for (let j = i + 6; j < particles.length; j += 6) {
            const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y, d = Math.sqrt(dx * dx + dy * dy)
            if (d < 20) { ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.strokeStyle = `rgba(14,165,233,${0.04 * (1 - d / 20)})`; ctx.lineWidth = 0.3; ctx.stroke() }
          }
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [type, width, height])

  return (
    <div ref={containerRef} className={className} style={{ width, height, ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

/* ============================================================
   HERO
   ============================================================ */
function Hero() {
  return (
    <section className="relative pt-28 sm:pt-36 pb-24 px-6" style={{ overflow: 'hidden', minHeight: '100vh' }}>
      {/* Ambient mini charts in whitespace */}
      <div className="absolute inset-0 pointer-events-none hidden lg:block" style={{ zIndex: 0 }}>
        <MiniParticleChart type="bar" width={140} height={100} style={{ position: 'absolute', top: '15%', left: '4%', opacity: 0.6 }} />
        <MiniParticleChart type="line" width={160} height={90} style={{ position: 'absolute', top: '12%', right: '5%', opacity: 0.5 }} />
        <MiniParticleChart type="donut" width={90} height={90} style={{ position: 'absolute', bottom: '20%', left: '6%', opacity: 0.5 }} />
        <MiniParticleChart type="scatter" width={130} height={100} style={{ position: 'absolute', bottom: '15%', right: '4%', opacity: 0.45 }} />
        <MiniParticleChart type="bar" width={100} height={70} style={{ position: 'absolute', top: '55%', left: '12%', opacity: 0.35 }} />
        <MiniParticleChart type="line" width={120} height={70} style={{ position: 'absolute', top: '50%', right: '10%', opacity: 0.35 }} />
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto text-center relative" style={{ zIndex: 2 }}>
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-medium"
            style={{ background: C.cyanGlow, color: C.dark, border: '1px solid rgba(14,165,233,0.15)' }}>
            <Sparkles style={{ width: 14, height: 14, color: C.cyan }} /> Intelligence, simplified
          </div>
        </FadeIn>

        <FadeIn delay={0.06}>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.08] mb-6 tracking-tight" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>
            Upload a spreadsheet.<br />
            <span style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.dark})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Get answers in seconds.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.12}>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: '#475569' }}>
            Drop any CSV or connect Google Sheets. AI builds your dashboard with charts, KPIs, and strategic insights — no code, no setup, no data team needed.
          </p>
        </FadeIn>

        <FadeIn delay={0.18}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <a href="/#login" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.03]"
              style={{ background: C.dark, textDecoration: 'none', boxShadow: '0 4px 20px rgba(12,20,37,0.25)' }}>
              Start free — no credit card <ArrowRight style={{ width: 16, height: 16 }} />
            </a>
            <a href="/instant" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-medium transition-all hover:shadow-md"
              style={{ background: '#fff', color: C.dark, textDecoration: 'none', border: '1px solid #e2e8f0' }}>
              <Upload style={{ width: 16, height: 16, color: C.cyan }} /> Try with your CSV
            </a>
          </div>
        </FadeIn>

        {/* Animated dashboard mockup */}
        <FadeIn delay={0.25}>
          <DashboardMockup />
        </FadeIn>
      </div>
    </section>
  )
}

/* ============================================================
   ANIMATED DASHBOARD MOCKUP — self-building, professional
   ============================================================ */
function DashboardMockup() {
  const ref = useRef(null)
  const vis = useInView(ref, 0.2)
  const [stage, setStage] = useState(0) // 0=hidden, 1=frame, 2=kpis, 3=charts, 4=insight

  useEffect(() => {
    if (!vis) return
    const t1 = setTimeout(() => setStage(1), 100)
    const t2 = setTimeout(() => setStage(2), 500)
    const t3 = setTimeout(() => setStage(3), 1000)
    const t4 = setTimeout(() => setStage(4), 1600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [vis])

  const bars = [65, 48, 72, 35, 58, 88, 42]
  const show = (s) => stage >= s

  return (
    <div ref={ref} className="relative max-w-4xl mx-auto">
      <div className="rounded-2xl overflow-hidden transition-all duration-700"
        style={{ background: '#fff', border: '1px solid #e2e8f0',
          boxShadow: show(1) ? '0 25px 80px rgba(12,20,37,0.08), 0 1px 3px rgba(0,0,0,0.03)' : 'none',
          opacity: show(1) ? 1 : 0, transform: show(1) ? 'translateY(0)' : 'translateY(20px)' }}>

        {/* Chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fca5a5' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fcd34d' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#86efac' }} />
          </div>
          <div className="flex-1 text-center"><span className="text-[10px] px-8 py-0.5 rounded" style={{ background: '#f8fafc', color: '#94a3b8' }}>app.meuris.io</span></div>
        </div>

        <div className="p-4 sm:p-5">
          {/* Insight bar */}
          <div className="rounded-lg p-2.5 flex items-center gap-2 mb-4 transition-all duration-500"
            style={{ background: C.cyanGlow, border: '1px solid rgba(14,165,233,0.08)',
              opacity: show(4) ? 1 : 0, transform: show(4) ? 'translateY(0)' : 'translateY(-8px)' }}>
            <Sparkles style={{ width: 12, height: 12, color: C.cyan }} />
            <span className="text-[10px] font-medium" style={{ color: C.dark }}>AI found 5 insights — revenue up 23%, West region outperforming by 17%</span>
            <span className="ml-auto text-[9px] font-medium hidden sm:inline" style={{ color: C.cyan }}>View all →</span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
            {[
              { l: 'Revenue', v: '$142K', c: '#3b82f6' },
              { l: 'Orders', v: '2,847', c: '#10b981' },
              { l: 'Avg Order', v: '$49.80', c: '#f97316' },
              { l: 'Growth', v: '+23%', c: '#8b5cf6' },
            ].map((k, i) => (
              <div key={k.l} className="p-2 sm:p-3 rounded-lg transition-all duration-500"
                style={{ background: '#fff', border: `1.5px solid ${k.c}15`,
                  opacity: show(2) ? 1 : 0, transform: show(2) ? 'translateY(0)' : 'translateY(12px)',
                  transitionDelay: `${i * 100}ms` }}>
                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block" style={{ color: k.c }}>{k.l}</span>
                <div className="text-sm sm:text-lg font-bold mt-0.5" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="rounded-lg p-3 sm:p-4 transition-all duration-500"
              style={{ background: '#fff', border: '1px solid #f1f5f9', height: 140,
                opacity: show(3) ? 1 : 0, transform: show(3) ? 'translateY(0)' : 'translateY(12px)' }}>
              <div className="text-[9px] sm:text-[10px] font-medium mb-3" style={{ color: '#475569' }}>Revenue by channel</div>
              <div className="flex items-end gap-[4px] sm:gap-[5px]" style={{ height: 80 }}>
                {bars.map((h, i) => (
                  <div key={i} className="flex-1 rounded-t transition-all"
                    style={{ height: show(3) ? `${h}%` : '0%',
                      background: i === 5 ? C.dark : `rgba(14,165,233,${0.25 + i * 0.08})`,
                      transitionDuration: `${600 + i * 80}ms`,
                      transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)',
                      transitionDelay: `${show(3) ? 200 + i * 60 : 0}ms` }} />
                ))}
              </div>
            </div>
            <div className="rounded-lg p-3 sm:p-4 transition-all duration-500"
              style={{ background: '#fff', border: '1px solid #f1f5f9', height: 140,
                opacity: show(3) ? 1 : 0, transform: show(3) ? 'translateY(0)' : 'translateY(12px)',
                transitionDelay: '150ms' }}>
              <div className="text-[9px] sm:text-[10px] font-medium mb-3" style={{ color: '#475569' }}>Monthly trend</div>
              <svg viewBox="0 0 200 55" style={{ width: '100%', height: 80, overflow: 'visible' }}>
                <path d="M0,45 Q25,38 50,28 T100,14 T150,18 T200,6" fill="none" stroke={C.cyan} strokeWidth="2" strokeLinecap="round"
                  strokeDasharray="300" strokeDashoffset={show(3) ? 0 : 300} style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(.16,1,.3,1) 0.5s' }} />
                <path d="M0,45 Q25,38 50,28 T100,14 T150,18 T200,6 L200,55 L0,55 Z" fill="rgba(14,165,233,0.06)"
                  opacity={show(3) ? 1 : 0} style={{ transition: 'opacity 0.8s ease 1.5s' }} />
              </svg>
            </div>
          </div>
        </div>
      </div>
      {/* Glow behind */}
      <div className="absolute -inset-8 -z-10 rounded-3xl" style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(14,165,233,0.05), transparent 65%)' }} />
    </div>
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
          {['Features', 'Pricing'].map(l => <a key={l} href={`#${l.toLowerCase()}`} className="text-sm hover:opacity-60 transition-colors" style={{ color: '#475569', textDecoration: 'none' }}>{l}</a>)}
          <a href="/instant" className="text-sm hover:opacity-60 transition-colors" style={{ color: '#475569', textDecoration: 'none' }}>Try Free</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/#login" className="text-sm font-medium hidden sm:inline hover:opacity-60" style={{ color: '#475569', textDecoration: 'none' }}>Log in</a>
          <a href="/#login" className="text-sm font-medium px-4 py-2 rounded-lg text-white hover:scale-[1.03] transition-all"
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
              <span key={t} className="text-sm font-medium" style={{ color: '#94a3b8' }}>{t}</span>
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
        style={{ background: '#fff', border: '1px solid #e2e8f0', transform: h ? 'translateY(-6px)' : 'none', boxShadow: h ? '0 16px 40px rgba(12,20,37,0.06)' : 'none' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
          style={{ background: `${color}08`, transform: h ? 'scale(1.1) rotate(-3deg)' : 'none' }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="text-base font-bold mb-2" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
      </div>
    </FadeIn>
  )
}
function Features() {
  const f = [
    { icon: Sparkles, title: 'AI Insights in Seconds', desc: 'Claude analyzes your data and surfaces trends, anomalies, and opportunities with specific numbers and actionable recommendations.', color: '#8b5cf6' },
    { icon: BarChart3, title: 'Interactive Charts', desc: 'Auto-generated bar, line, pie, and area charts. Click any bar to filter, switch dimensions on the fly, expand to full screen.', color: C.cyan },
    { icon: MessageSquare, title: 'Ask AI Anything', desc: '"What\'s my top product by margin?" Ask in plain English, get answers backed by your data.', color: '#10b981' },
    { icon: FileDown, title: 'Executive Reports', desc: 'Export consulting-grade PDFs with your branding — executive summary, insight cards, charts. Boardroom ready.', color: '#f97316' },
    { icon: Users, title: 'Team Collaboration', desc: 'Role-based access, per-client dashboards, shared projects. Everyone sees what they need.', color: '#ec4899' },
    { icon: Globe, title: 'Google Sheets Live Sync', desc: 'Connect a Sheet, set auto-refresh. Your dashboard updates daily — always fresh, no re-uploads.', color: '#06b6d4' },
  ]
  return (
    <section id="features" className="py-24 px-6" style={{ background: '#f8fafc' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn><div className="text-center mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Everything you need, nothing you don't</h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: '#64748b' }}>From upload to insight in under a minute.</p>
        </div></FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{f.map((x, i) => <FeatureCard key={x.title} {...x} delay={i * 0.06} />)}</div>
      </div>
    </section>
  )
}

/* ============================================================
   HOW IT WORKS
   ============================================================ */
function HowItWorks() {
  const s = [
    { n: '01', t: 'Upload your data', d: 'Drop a CSV, connect Google Sheets, or paste a link. Any industry, any format.', i: Upload },
    { n: '02', t: 'AI builds your dashboard', d: 'Columns classified, charts selected, KPIs computed, insights generated. Under 10 seconds.', i: Zap },
    { n: '03', t: 'Explore and share', d: 'Click charts to filter, ask AI follow-ups, export branded PDFs, invite your team.', i: Share2 },
  ]
  return (
    <section className="py-24 px-6" style={{ background: '#fff' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn><div className="text-center mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Three steps. Sixty seconds.</h2>
        </div></FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {s.map((x, i) => (
            <FadeIn key={x.n} delay={i * 0.1}><div className="text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center relative" style={{ background: C.cyanGlow }}>
                <x.i className="w-7 h-7" style={{ color: C.dark }} />
                <span className="absolute -top-2 -right-2 text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: C.cyan }}>{x.n}</span>
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>{x.t}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{x.d}</p>
            </div></FadeIn>
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
  const [active, setActive] = useState(false); const fr = useRef(null)
  const hf = (f) => { if (!f) return; const r = new FileReader(); r.onload = (e) => { try { sessionStorage.setItem('nb_instant_file', e.target.result); sessionStorage.setItem('nb_instant_filename', f.name) } catch {}; window.location.href = '/instant' }; r.readAsText(f) }
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
              style={{ borderColor: active ? C.cyan : '#e2e8f0', background: active ? 'rgba(14,165,233,0.02)' : '#fff' }}
              onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
              onDragOver={e => { e.preventDefault(); setActive(true) }} onDragLeave={() => setActive(false)}
              onDrop={e => { e.preventDefault(); setActive(false); hf(e.dataTransfer.files[0]) }}
              onClick={() => fr.current?.click()}>
              <Upload className="w-12 h-12 mx-auto mb-5 transition-all duration-300" style={{ color: active ? C.cyan : '#94a3b8', transform: active ? 'translateY(-6px)' : 'none' }} />
              <p className="text-base font-semibold mb-2" style={{ color: C.dark }}>Drop your CSV here</p>
              <p className="text-sm" style={{ color: '#94a3b8' }}>or click to browse · up to 20MB</p>
              <input ref={fr} type="file" accept=".csv,.tsv" className="hidden" onChange={e => hf(e.target.files[0])} />
            </div>
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `2px solid ${C.cyan}`, opacity: 0, animation: 'pr 3s ease-out infinite' }} />
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ border: `2px solid ${C.cyan}`, opacity: 0, animation: 'pr 3s ease-out infinite 1.5s' }} />
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-xs" style={{ color: '#94a3b8' }}>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Data stays in your browser</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Dashboard in 10 seconds</span>
          </div>
        </FadeIn>
      </div>
      <style>{`@keyframes pr{0%{transform:scale(1);opacity:0.12}100%{transform:scale(1.04);opacity:0}}`}</style>
    </section>
  )
}

/* ============================================================
   PRICING
   ============================================================ */
function Pricing() {
  const plans = [
    { name: 'Free', price: '$0', period: 'forever', a: false, features: ['1 project', '1 dataset per project', '5 AI insight runs / month', '3 AI questions / month', 'Basic charts & KPIs', 'CSV upload'], cta: 'Get started free', href: '/#login' },
    { name: 'Pro', price: '$19', period: '/month', a: true, features: ['Unlimited projects', 'Unlimited datasets', 'Unlimited AI insights', 'Unlimited AI questions', 'PDF export with branding', 'Google Sheets live sync', 'Team sharing (up to 5)', 'White-label dashboards', 'Scheduled reports', 'Priority support'], cta: 'Start Pro — 14 day trial', href: '/#login' },
    { name: 'Enterprise', price: 'Custom', period: '', a: false, features: ['Everything in Pro', 'Unlimited team members', 'SSO / SAML', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'Custom data connectors', 'On-premise option'], cta: 'Contact us', href: 'mailto:hello@meuris.io' },
  ]
  return (
    <section id="pricing" className="py-24 px-6" style={{ background: '#fff' }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn><div className="text-center mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-3" style={{ color: C.cyan }}>Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Simple pricing, no surprises</h2>
          <p className="text-base" style={{ color: '#64748b' }}>Start free. Upgrade when you need more.</p>
        </div></FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((p, i) => (
            <FadeIn key={p.name} delay={i * 0.08}>
              <div className="rounded-2xl h-full flex flex-col relative overflow-hidden"
                style={{ background: p.a ? `linear-gradient(135deg, ${C.dark}, ${C.mid})` : '#f8fafc', border: p.a ? 'none' : '1px solid #e2e8f0', boxShadow: p.a ? '0 24px 60px rgba(12,20,37,0.18)' : 'none', padding: p.a ? '40px 28px 28px' : '28px' }}>
                {p.a && <>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-b-lg text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: C.cyan }}>Most popular</div>
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(14,165,233,0.06) 45%, rgba(14,165,233,0.12) 50%, rgba(14,165,233,0.06) 55%, transparent 60%)', backgroundSize: '200% 100%', animation: 'sh 4s ease-in-out infinite' }} />
                </>}
                <div className="mb-6 relative">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: p.a ? 'rgba(255,255,255,0.45)' : '#94a3b8' }}>{p.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold" style={{ color: p.a ? '#fff' : C.dark, fontFamily: 'Lora, Georgia, serif' }}>{p.price}</span>
                    {p.period && <span className="text-sm" style={{ color: p.a ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>{p.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3 flex-1 mb-8 relative">
                  {p.features.map(f => <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: p.a ? 'rgba(255,255,255,0.7)' : '#64748b' }}><Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.cyan }} />{f}</li>)}
                </ul>
                <a href={p.href} className="relative block text-center px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background: p.a ? C.cyan : 'transparent', color: p.a ? '#fff' : C.dark, border: p.a ? 'none' : `1.5px solid ${C.dark}`, textDecoration: 'none' }}>{p.cta}</a>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
      <style>{`@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </section>
  )
}

/* ============================================================
   FINAL CTA + FOOTER
   ============================================================ */
function FinalCTA() {
  return (
    <section className="py-24 px-6" style={{ background: '#f8fafc' }}>
      <FadeIn><div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Your data is sitting there.<br />Let it talk.</h2>
        <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: '#64748b' }}>Join teams who stopped wrestling with spreadsheets and started making decisions.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="/#login" className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white hover:scale-[1.03] transition-all"
            style={{ background: C.dark, boxShadow: '0 4px 20px rgba(12,20,37,0.25)', textDecoration: 'none' }}>Get started free <ArrowRight className="w-4 h-4" /></a>
          <a href="/instant" className="flex items-center gap-2 text-sm font-medium hover:opacity-60 transition-colors" style={{ color: '#64748b', textDecoration: 'none' }}>Or try now — no signup <ArrowUpRight className="w-4 h-4" /></a>
        </div>
      </div></FadeIn>
    </section>
  )
}
function Footer() {
  return (
    <footer className="py-12 px-6" style={{ borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3"><MuLogo size={28} /><span className="text-[15px] font-bold tracking-tight" style={{ color: C.dark, fontFamily: 'Lora, Georgia, serif' }}>Meuris Analytics</span></div>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: '#94a3b8' }}>Intelligence, simplified. AI-powered dashboards from any spreadsheet.</p>
          </div>
          <div className="flex gap-16">
            <div><p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Product</p><div className="space-y-2">{['Features', 'Pricing', 'Instant Tool'].map(l => <a key={l} href={l === 'Instant Tool' ? '/instant' : `#${l.toLowerCase()}`} className="block text-sm hover:opacity-60 transition-colors" style={{ color: '#64748b', textDecoration: 'none' }}>{l}</a>)}</div></div>
            <div><p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Company</p><div className="space-y-2">{['About', 'Privacy', 'Terms', 'Contact'].map(l => <a key={l} href="#" className="block text-sm hover:opacity-60 transition-colors" style={{ color: '#64748b', textDecoration: 'none' }}>{l}</a>)}</div></div>
          </div>
        </div>
        <div className="pt-6" style={{ borderTop: '1px solid #e2e8f0' }}><p className="text-xs" style={{ color: '#cbd5e1' }}>&copy; {new Date().getFullYear()} Meuris Analytics. All rights reserved.</p></div>
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
