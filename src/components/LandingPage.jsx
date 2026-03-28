import React, { useState, useRef, useEffect } from 'react'
import {
  BarChart3, Sparkles, ArrowRight, Upload, FileSpreadsheet, Share2,
  Zap, Users, Check, MessageSquare, FileDown, Shield, Globe, ArrowUpRight
} from 'lucide-react'

const C = { dark: '#0c1425', mid: '#162236', cyan: '#0ea5e9', cyanLight: '#38bdf8', cyanGlow: 'rgba(14,165,233,0.12)' }
const BAR_C = ['#38bdf8','#0ea5e9','#0284c7','#0369a1','#0ea5e9','#0c1425','#38bdf8']
const PIE_C = ['#0ea5e9','#0369a1','#38bdf8','#06b6d4','#0c4a6e']

/* === HOOKS === */
function useInView(ref, threshold = 0.15) {
  const [v, setV] = useState(false)
  useEffect(() => { if (!ref.current) return; const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold }); o.observe(ref.current); return () => o.disconnect() }, [ref, threshold]); return v
}
function FadeIn({ children, className = '', delay = 0 }) {
  const ref = useRef(null); const vis = useInView(ref)
  return <div ref={ref} className={className} style={{ opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(28px)', transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}s` }}>{children}</div>
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
   PARTICLE CHART HERO — smooth morphing between chart types
   ============================================================ */
function ParticleChartHero() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const cv = canvasRef.current, ctx = cv.getContext('2d')
    const container = containerRef.current
    let W, H, mx = -999, my = -999, SZ, N
    let particles = [], shapeIdx = 0
    const SHAPES = ['bar', 'line', 'kpi']

    function computeSize() {
      W = container.offsetWidth; H = container.offsetHeight
      // Scale particle size with screen — bigger screen = bigger particles to keep count reasonable
      SZ = W > 1200 ? 7 : W > 800 ? 6 : 5
      // Estimate max particles needed for the bar chart (largest shape)
      const cL = W * 0.18, cR = W * 0.85, cB = H * 0.88, cT = H * 0.5
      const cW = cR - cL, cH = cB - cT
      const bW = (cW - cW * 0.025 * 8) / 7
      let est = 0
      ;[0.62, 0.45, 0.72, 0.32, 0.55, 0.88, 0.4].forEach(h => { est += Math.ceil(bW / SZ) * Math.ceil(h * cH / SZ) })
      est += Math.ceil(cW / SZ) * 2 + Math.ceil(cH / SZ) + 100 // axes + grid + spare
      N = Math.min(est, 4000) // cap for performance
    }

    function resize() {
      const oldN = N
      computeSize()
      cv.width = W * 2; cv.height = H * 2
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      if (N !== oldN) init()
      genTargets(SHAPES[shapeIdx])
    }

    function init() {
      particles = []
      for (let i = 0; i < N; i++) particles.push({ x: W * 0.1 + Math.random() * W * 0.8, y: H * 0.4 + Math.random() * H * 0.5, vx: 0, vy: 0, tx: 0, ty: 0, c: '#0ea5e9', tc: '#0ea5e9', sq: true })
    }

    function genTargets(shape) {
      const cL = W * 0.15, cR = W * 0.82, cB = H * 0.86, cT = H * 0.48
      const cW = cR - cL, cH = cB - cT
      let idx = 0

      if (shape === 'bar') {
        const heights = [0.62, 0.45, 0.72, 0.32, 0.55, 0.88, 0.4]
        const bCnt = 7, gap = cW * 0.025, tGap = gap * (bCnt + 1), bW = (cW - tGap) / bCnt
        const colors = ['#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#0ea5e9', '#0c1425', '#38bdf8']
        for (let b = 0; b < bCnt; b++) {
          const bx = cL + gap + b * (bW + gap), bh = heights[b] * cH, by = cB - bh
          for (let py = by; py < cB; py += SZ) for (let px = bx; px < bx + bW; px += SZ) {
            if (idx < N) { particles[idx].tx = px; particles[idx].ty = py; particles[idx].tc = colors[b]; particles[idx].sq = true; idx++ }
          }
        }
        for (let px = cL; px <= cR && idx < N; px += SZ) { particles[idx].tx = px; particles[idx].ty = cB; particles[idx].tc = '#cbd5e1'; particles[idx].sq = true; idx++ }
        for (let py = cT; py <= cB && idx < N; py += SZ) { particles[idx].tx = cL - 2; particles[idx].ty = py; particles[idx].tc = '#cbd5e1'; particles[idx].sq = true; idx++ }
        for (let g = 0; g < 4; g++) { const gy = cT + g * (cH / 4); for (let px = cL; px <= cR && idx < N; px += SZ * 4) { particles[idx].tx = px; particles[idx].ty = gy; particles[idx].tc = '#e2e8f0'; particles[idx].sq = true; idx++ } }
      } else if (shape === 'line') {
        const dY = [0.55, 0.42, 0.58, 0.35, 0.48, 0.22, 0.3, 0.14, 0.24, 0.1, 0.18, 0.06]
        for (let i = 0; i < dY.length - 1; i++) {
          const x1 = cL + i / (dY.length - 1) * cW, x2 = cL + (i + 1) / (dY.length - 1) * cW
          const y1 = cT + dY[i] * cH, y2 = cT + dY[i + 1] * cH
          for (let x = x1; x < x2 && idx < N; x += SZ) {
            const t = (x - x1) / (x2 - x1), lY = y1 + (y2 - y1) * t
            if (idx < N) { particles[idx].tx = x; particles[idx].ty = lY; particles[idx].tc = '#0ea5e9'; particles[idx].sq = true; idx++ }
            for (let y = lY + SZ * 2; y < cB && idx < N; y += SZ * 1.5) { particles[idx].tx = x; particles[idx].ty = y; particles[idx].tc = 'rgba(14,165,233,0.12)'; particles[idx].sq = true; idx++ }
          }
        }
        dY.forEach((v, i) => { const dx = cL + i / (dY.length - 1) * cW, dy = cT + v * cH; for (let a = 0; a < Math.PI * 2 && idx < N; a += 0.5) { particles[idx].tx = dx + Math.cos(a) * 5; particles[idx].ty = dy + Math.sin(a) * 5; particles[idx].tc = '#0ea5e9'; particles[idx].sq = true; idx++ } })
        for (let px = cL; px <= cR && idx < N; px += SZ) { particles[idx].tx = px; particles[idx].ty = cB; particles[idx].tc = '#cbd5e1'; particles[idx].sq = true; idx++ }
        for (let py = cT; py <= cB && idx < N; py += SZ) { particles[idx].tx = cL - 2; particles[idx].ty = py; particles[idx].tc = '#cbd5e1'; particles[idx].sq = true; idx++ }
      } else if (shape === 'kpi') {
        const cards = [
          { label: 'REVENUE', value: '$142K', color: '#3b82f6' },
          { label: 'ORDERS', value: '2,847', color: '#10b981' },
          { label: 'GROWTH', value: '+23%', color: '#8b5cf6' },
          { label: 'AVG ORDER', value: '$49.80', color: '#f97316' },
        ]
        const cardW = cW * 0.22, cardH = cH * 0.55, gap2 = (cW - cardW * 4) / 5
        const cardY = cT + (cH - cardH) * 0.4
        cards.forEach((card, ci) => {
          const cx0 = cL + gap2 + ci * (cardW + gap2)
          for (let py = cardY; py < cardY + cardH && idx < N; py += SZ) for (let px = cx0; px < cx0 + cardW && idx < N; px += SZ) { particles[idx].tx = px; particles[idx].ty = py; particles[idx].tc = `${card.color}15`; particles[idx].sq = true; idx++ }
          for (let px = cx0; px < cx0 + cardW && idx < N; px += SZ) { particles[idx].tx = px; particles[idx].ty = cardY; particles[idx].tc = card.color; particles[idx].sq = true; idx++ }
          for (let px = cx0; px < cx0 + cardW && idx < N; px += SZ) { particles[idx].tx = px; particles[idx].ty = cardY + SZ; particles[idx].tc = card.color; particles[idx].sq = true; idx++ }
        })
      }
      while (idx < N) { particles[idx].tx = W * 0.1 + Math.random() * W * 0.8; particles[idx].ty = cB + 15 + Math.random() * 30; particles[idx].tc = '#e2e8f0'; particles[idx].sq = false; idx++ }
      particles._m = { shape, cL, cR, cB, cT, cW, cH }
    }

    computeSize(); init(); resize()
    window.addEventListener('resize', resize)
    container.addEventListener('mousemove', e => { const r = container.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top })
    container.addEventListener('touchmove', e => { const t = e.touches[0]; const r = container.getBoundingClientRect(); mx = t.clientX - r.left; my = t.clientY - r.top }, { passive: true })
    container.addEventListener('mouseleave', () => { mx = -999; my = -999 })

    // Phase machine: 'forming' → 'holding' → 'drifting' → 'forming' ...
    let phase = 'forming', phaseTimer = 0
    const FORM_TIME = 180, HOLD_TIME = 180, DRIFT_TIME = 300 // ~3s form, 3s hold, 5s drift

    // Set drift targets — scatter across entire viewport
    function setDriftTargets() {
      particles.forEach(p => {
        p.tx = Math.random() * W
        p.ty = Math.random() * H
        p.tc = '#0ea5e9'
        p.sq = false
      })
      particles._m = null
    }

    let raf
    function draw() {
      ctx.clearRect(0, 0, W, H)
      phaseTimer++

      // Phase transitions
      if (phase === 'forming' && phaseTimer > FORM_TIME) {
        phase = 'holding'; phaseTimer = 0
      } else if (phase === 'holding' && phaseTimer > HOLD_TIME) {
        phase = 'drifting'; phaseTimer = 0
        setDriftTargets()
      } else if (phase === 'drifting' && phaseTimer > DRIFT_TIME) {
        phase = 'forming'; phaseTimer = 0
        shapeIdx = (shapeIdx + 1) % SHAPES.length
        genTargets(SHAPES[shapeIdx])
      }

      // Physics — gentle springs, slow and smooth
      const springStrength = phase === 'forming' ? 0.025 : phase === 'holding' ? 0.1 : 0.012
      const friction = phase === 'holding' ? 0.8 : 0.92

      let settled = 0
      particles.forEach(p => {
        const dx = p.tx - p.x, dy = p.ty - p.y
        p.vx += dx * springStrength
        p.vy += dy * springStrength
        // Gentle noise during drift for organic floating
        if (phase === 'drifting') {
          p.vx += (Math.random() - 0.5) * 0.15
          p.vy += (Math.random() - 0.5) * 0.15
        }
        p.vx *= friction; p.vy *= friction
        p.x += p.vx; p.y += p.vy
        p.c = p.tc
        // Keep particles on screen
        if (p.x < -20) p.x = -20
        if (p.x > W + 20) p.x = W + 20
        if (p.y < -20) p.y = -20
        if (p.y > H + 20) p.y = H + 20
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) settled++
      })
      const sPct = settled / N

      // Mouse repel
      if (mx > 0) {
        particles.forEach(p => {
          const dx = mx - p.x, dy = my - p.y, dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 80 && dist > 1) { p.vx -= dx * 0.4 / dist; p.vy -= dy * 0.4 / dist }
        })
      }

      // Draw particles — squares when formed, circles when transitioning
      const showSquare = phase === 'holding' || (phase === 'forming' && sPct > 0.7)
      particles.forEach(p => {
        const isLight = typeof p.tc === 'string' && (p.tc.includes('rgba') || p.tc === '#e2e8f0' || p.tc === '#cbd5e1')
        ctx.globalAlpha = phase === 'drifting' ? 0.5 : isLight ? 0.4 : 0.85
        ctx.fillStyle = p.c
        if (showSquare && p.sq) {
          ctx.fillRect(p.x, p.y, SZ, SZ)
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, phase === 'drifting' ? 2.5 : 2, 0, Math.PI * 2); ctx.fill()
        }
      })
      ctx.globalAlpha = 1

      // Connection lines during drift/forming
      if (phase === 'drifting' || (phase === 'forming' && sPct < 0.5)) {
        const step = Math.max(4, Math.floor(N / 400))
        for (let i = 0; i < N; i += step) {
          for (let j = i + step; j < N; j += step) {
            const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y, dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 35) { ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.strokeStyle = `rgba(14,165,233,${0.04 * (1 - dist / 35)})`; ctx.lineWidth = 0.4; ctx.stroke() }
          }
        }
      }

      // Labels when holding or mostly formed
      const showLabels = phase === 'holding' || (phase === 'forming' && sPct > 0.8)
      if (showLabels && particles._m) {
        const m = particles._m
        const fade = phase === 'holding' ? Math.min(phaseTimer / 20, 1) * 0.75 : Math.min((sPct - 0.8) / 0.15, 1) * 0.5
        ctx.globalAlpha = fade
        if (m.shape === 'bar') {
          ctx.font = '600 13px system-ui,sans-serif'; ctx.fillStyle = '#0c1425'; ctx.textAlign = 'center'
          ctx.fillText('Revenue by channel', W * 0.5, m.cT - 10)
          ctx.font = '400 10px system-ui,sans-serif'; ctx.fillStyle = '#94a3b8'
          ;['Direct', 'Email', 'Social', 'Referral', 'Organic', 'Paid', 'Other'].forEach((l, i) => ctx.fillText(l, m.cL + (i + 0.5) * (m.cW / 7), m.cB + 16))
          ctx.textAlign = 'right'
          ;['$0', '$25K', '$50K', '$75K', '$100K'].forEach((l, i) => ctx.fillText(l, m.cL - 8, m.cB - i * (m.cH / 4) + 3))
        } else if (m.shape === 'line') {
          ctx.font = '600 13px system-ui,sans-serif'; ctx.fillStyle = '#0c1425'; ctx.textAlign = 'center'
          ctx.fillText('Monthly revenue trend', W * 0.5, m.cT - 10)
          ctx.font = '400 10px system-ui,sans-serif'; ctx.fillStyle = '#94a3b8'
          ;['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].forEach((l, i) => ctx.fillText(l, m.cL + (i + 0.5) * (m.cW / 12), m.cB + 16))
          ctx.textAlign = 'right'
          ;['$0', '$25K', '$50K', '$75K', '$100K'].forEach((l, i) => ctx.fillText(l, m.cL - 8, m.cB - i * (m.cH / 4) + 3))
        } else if (m.shape === 'kpi') {
          const cards = [{ label: 'REVENUE', value: '$142K', color: '#3b82f6' }, { label: 'ORDERS', value: '2,847', color: '#10b981' }, { label: 'GROWTH', value: '+23%', color: '#8b5cf6' }, { label: 'AVG ORDER', value: '$49.80', color: '#f97316' }]
          const cardW = m.cW * 0.22, gap2 = (m.cW - cardW * 4) / 5, cardH = m.cH * 0.55, cardY = m.cT + (m.cH - cardH) * 0.4
          ctx.font = '600 13px system-ui,sans-serif'; ctx.fillStyle = '#0c1425'; ctx.textAlign = 'center'
          ctx.fillText('Key performance indicators', W * 0.5, m.cT - 10)
          cards.forEach((c, ci) => { const cx0 = m.cL + gap2 + ci * (cardW + gap2), midX = cx0 + cardW / 2; ctx.font = '700 8px system-ui,sans-serif'; ctx.fillStyle = c.color; ctx.textAlign = 'center'; ctx.fillText(c.label, midX, cardY + cardH * 0.35); ctx.font = '700 20px Georgia,serif'; ctx.fillStyle = '#0c1425'; ctx.fillText(c.value, midX, cardY + cardH * 0.65) })
        }
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <section ref={containerRef} className="relative" style={{ height: '100vh', minHeight: 640, maxHeight: 960, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', zIndex: 2, pointerEvents: 'none', paddingTop: 'max(80px, 12vh)' }}>
        <div style={{ fontSize: 11, fontWeight: 500, padding: '5px 16px', borderRadius: 20, background: C.cyanGlow, color: C.dark, border: '1px solid rgba(14,165,233,0.15)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles style={{ width: 14, height: 14, color: C.cyan }} /> Intelligence, simplified
        </div>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 56px)', fontWeight: 700, color: C.dark, fontFamily: 'Lora, Georgia, serif', textAlign: 'center', lineHeight: 1.1, margin: '0 0 16px' }}>
          Upload a spreadsheet.<br />
          <span style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.dark})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Get answers in seconds.</span>
        </h1>
        <p style={{ fontSize: 'clamp(14px, 1.8vw, 18px)', color: '#475569', textAlign: 'center', maxWidth: 520, lineHeight: 1.6, margin: '0 0 28px', padding: '0 20px' }}>
          Drop any CSV or connect Google Sheets. AI builds your dashboard with charts, KPIs, and insights — no code, no setup.
        </p>
        <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/#login" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, background: C.dark, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 20px rgba(12,20,37,0.25)', transition: 'transform 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            Start free — no credit card <ArrowRight style={{ width: 16, height: 16 }} />
          </a>
          <a href="/instant" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.9)', color: C.dark, fontSize: 14, fontWeight: 500, textDecoration: 'none', border: '1px solid #e2e8f0', transition: 'all 0.15s', backdropFilter: 'blur(8px)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0' }}>
            <Upload style={{ width: 16, height: 16, color: C.cyan }} /> Try with your CSV
          </a>
        </div>
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
        style={{ background: '#fff', border: '1px solid #e2e8f0', transform: h ? 'translateY(-6px)' : 'none', boxShadow: h ? `0 16px 40px rgba(12,20,37,0.06)` : 'none' }}>
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
                  <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(105deg, transparent 40%, rgba(14,165,233,0.06) 45%, rgba(14,165,233,0.12) 50%, rgba(14,165,233,0.06) 55%, transparent 60%)`, backgroundSize: '200% 100%', animation: 'sh 4s ease-in-out infinite' }} />
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
      <ParticleChartHero />
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
