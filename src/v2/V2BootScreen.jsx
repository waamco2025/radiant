import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { buildRadiantGroup } from './PrimeRadiant.jsx'

const BOOT_DURATION = 3800
const FADE_DURATION = 600
const RIPPLE_START = 400
const RIPPLE_DURATION = 1200
const WAVE_GAP = 200

export default function V2BootScreen({ onComplete, onFading, skipLogin }) {
  const radiantCanvasRef = useRef(null)
  const dotCanvasRef = useRef(null)
  // PHASE 20.6: ignore skipLogin so refresh always returns to the login
  // screen (temporary demo auth gate, Path C). Restore
  // `skipLogin ? 'boot' : 'login'` when removing the auth gate.
  const [phase, setPhase] = useState('login')
  const [bootText, setBootText] = useState('')

  const startBoot = useCallback(() => {
    setPhase('boot')
    setBootText('Initializing node explorer...')
  }, [])

  // ─────────────────────────────────────────────────────────────────────
  // PHASE 20.6: TEMPORARY DEMO AUTH GATE (Path C — perception-only security)
  // Hand-off period only. Remove this entire block, the credential UI in the
  // 'login' phase render below, and the phase initial-state overrides above
  // when migrating to production auth. Credentials documented in Phase 20.6
  // phase-log notes. Single shared credential, no session persistence.
  // Client-side SHA-256 compare — bypassable in DevTools by intent.
  // ─────────────────────────────────────────────────────────────────────
  const DEMO_AUTH_USERNAME = 'user@radiant.com'
  const DEMO_AUTH_PASSWORD_HASH = 'cd4a9521daa3bafc3a07e66c1813f237d024fb8fbab3f8bb34a612db39d2c517'

  async function sha256Hex(input) {
    const bytes = new TextEncoder().encode(input)
    const hashBuf = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState(null)
  const [authChecking, setAuthChecking] = useState(false)

  const handleAuthSubmit = async (e) => {
    e?.preventDefault?.()
    if (authChecking) return
    setAuthChecking(true)
    const usernameOk = authUsername.trim() === DEMO_AUTH_USERNAME
    const hashed = await sha256Hex(authPassword)
    const passwordOk = hashed === DEMO_AUTH_PASSWORD_HASH
    setAuthChecking(false)
    if (usernameOk && passwordOk) {
      setAuthError(null)
      startBoot()
    } else {
      setAuthError('Authentication failed. Check your credentials and try again.')
    }
  }

  // Clear the error message the moment the user starts editing either field.
  const handleUsernameChange = (e) => {
    setAuthUsername(e.target.value)
    if (authError) setAuthError(null)
  }
  const handlePasswordChange = (e) => {
    setAuthPassword(e.target.value)
    if (authError) setAuthError(null)
  }
  // ─────────────────────────────────────────────────────────────────────
  // END Phase 20.6 demo auth gate (remove the block above + the credential
  // UI in the 'login' phase render + the phase initial-state overrides
  // above). Grep for `PHASE 20.6` to find all sites.
  // ─────────────────────────────────────────────────────────────────────

  // Boot text + phase timers
  useEffect(() => {
    if (phase !== 'boot') return
    const t1 = setTimeout(() => setBootText('Loading supply chain graph...'), 1200)
    const t2 = setTimeout(() => setBootText('Establishing network connection...'), 2400)
    const t3 = setTimeout(() => { onFading?.(); setPhase('fading') }, BOOT_DURATION)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [phase])

  // Separate effect for onComplete — triggers when phase becomes 'fading',
  // waits for fade to finish, then calls onComplete
  useEffect(() => {
    if (phase !== 'fading') return
    const t = setTimeout(() => {
      setPhase('done')
      onComplete()
    }, FADE_DURATION)
    return () => clearTimeout(t)
  }, [phase, onComplete])

  // PrimeRadiant Three.js scene
  useEffect(() => {
    const canvas = radiantCanvasRef.current
    if (!canvas) return
    const px = Math.min(window.devicePixelRatio, 2)
    const w = 280, h = 280
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(px)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.8
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 4.5
    scene.add(new THREE.AmbientLight(0x332200, 1.0))
    const keyLight = new THREE.PointLight(0xffd700, 4.0, 25)
    keyLight.position.set(3, 3, 4)
    scene.add(keyLight)
    const fillLight = new THREE.PointLight(0xffd700, 2.5, 20)
    fillLight.position.set(-3, -1, 3)
    scene.add(fillLight)
    const rimLight = new THREE.PointLight(0xffe08a, 3.0, 20)
    rimLight.position.set(0, -3, -3)
    scene.add(rimLight)
    const topLight = new THREE.PointLight(0xfff1c1, 2.0, 15)
    topLight.position.set(0, 4, 0)
    scene.add(topLight)
    const { group, goldMat, innerGoldMat, particleMat } = buildRadiantGroup({ particles: true })
    scene.add(group)
    let animId = null
    function animate(time) {
      animId = requestAnimationFrame(animate)
      const t = time * 0.001
      group.rotation.x += 0.003
      group.rotation.y += 0.005
      keyLight.position.x = Math.sin(t * 0.5) * 4
      keyLight.position.z = Math.cos(t * 0.5) * 5
      fillLight.position.y = Math.sin(t * 0.3) * 3
      rimLight.position.x = Math.cos(t * 0.4) * 4
      const pulse = 0.45 + Math.sin(t * 2) * 0.15
      goldMat.emissiveIntensity = pulse
      innerGoldMat.emissiveIntensity = pulse + 0.15
      if (particleMat) particleMat.opacity = 0.3 + Math.sin(t * 1.5) * 0.2
      renderer.render(scene, camera)
    }
    animId = requestAnimationFrame(animate)
    return () => {
      if (animId) cancelAnimationFrame(animId)
      renderer.dispose()
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material.dispose()
        }
      })
    }
  }, [])

  // Dot matrix canvas — lightning during login, ripple during boot
  useEffect(() => {
    const canvas = dotCanvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio, 2)
    const vw = window.innerWidth
    const vh = window.innerHeight
    canvas.width = vw * dpr
    canvas.height = vh * dpr
    canvas.style.width = vw + 'px'
    canvas.style.height = vh + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const spacing = 70
    const dotRadius = 1.0
    const centerX = vw / 2
    const centerY = vh / 2
    const startX = centerX % spacing
    const startY = (centerY % spacing) + 16
    const dots = []
    const dotGrid = {}
    let maxDist = 0

    for (let x = startX; x <= vw; x += spacing) {
      for (let y = startY; y <= vh; y += spacing) {
        const dx = x - centerX
        const dy = y - centerY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const col = Math.round((x - startX) / spacing)
        const row = Math.round((y - startY) / spacing)
        const idx = dots.length
        dots.push({ x, y, dist, col, row, brightness: 0, fadeStart: 0, color: null })
        dotGrid[`${col},${row}`] = idx
        if (dist > maxDist) maxDist = dist
      }
    }
    if (maxDist === 0) maxDist = 1
    const maxCol = Math.max(...dots.map(d => d.col))
    const maxRow = Math.max(...dots.map(d => d.row))

    const bgR = 10, bgG = 12, bgB = 16
    const goldR = 212, goldG = 175, goldB = 55
    const normR = 59, normG = 61, normB = 64
    const waveFrontWidth = 0.10
    const fadeTailLength = 0.30

    // Phase 20.3: five-color palette for login-screen lightning. Each bolt
    // picks one color at spawn and holds it for its lifetime; dots inherit the
    // color of the brightest bolt that touched them. Three colors resolve from
    // the live design tokens (so the boot screen tracks the design system),
    // one is the provisional-edge grey, and the fifth is hardcoded white for
    // the lightning-strike feel. The boot-phase gold ripple is unaffected.
    const parseColor = (str) => {
      const s = (str || '').trim()
      let m = s.match(/^#([0-9a-fA-F]{6})$/)
      if (m) { const n = parseInt(m[1], 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 } }
      m = s.match(/^#([0-9a-fA-F]{3})$/)
      if (m) { const c = m[1]; return { r: parseInt(c[0] + c[0], 16), g: parseInt(c[1] + c[1], 16), b: parseInt(c[2] + c[2], 16) } }
      m = s.match(/^rgba?\(([^)]+)\)$/)
      if (m) { const p = m[1].split(',').map((x) => parseInt(x.trim(), 10)); if (p.length >= 3 && p.every((v) => Number.isFinite(v))) return { r: p[0], g: p[1], b: p[2] } }
      return null
    }
    const cs = getComputedStyle(document.documentElement)
    const tokenColor = (name, fallback) => parseColor(cs.getPropertyValue(name)) || fallback
    const PALETTE = [
      tokenColor('--accent-indigo', { r: 129, g: 140, b: 248 }),
      tokenColor('--accent-amber', { r: 245, g: 158, b: 11 }),
      tokenColor('--accent-green', { r: 34, g: 197, b: 94 }),
      tokenColor('--text-dim', { r: 122, g: 131, b: 153 }),
      { r: 255, g: 255, b: 255 },
    ]

    // Lightning system
    const activeBolts = []
    let lastBoltTime = 0
    const BOLT_INTERVAL = 1200
    const BOLT_SPEED = 4
    const BOLT_FADE = 2200

    function spawnBolt(now) {
      const originRow = Math.floor(Math.random() * Math.max(1, maxRow * 0.3))
      const originCol = Math.floor(Math.random() * (maxCol + 1))
      const originIdx = dotGrid[`${originCol},${originRow}`]
      if (originIdx === undefined) return
      const path = [originIdx]
      let currentCol = originCol
      let currentRow = originRow
      const length = 4 + Math.floor(Math.random() * 12)
      for (let step = 0; step < length; step++) {
        currentRow++
        const drift = Math.random()
        if (drift < 0.3) currentCol = Math.max(0, currentCol - 1)
        else if (drift > 0.7) currentCol = Math.min(maxCol, currentCol + 1)
        const nextIdx = dotGrid[`${currentCol},${currentRow}`]
        if (nextIdx === undefined) break
        path.push(nextIdx)
        if (step > 1 && Math.random() < 0.3) {
          let branchCol = currentCol + (Math.random() < 0.5 ? -1 : 1)
          let branchRow = currentRow + 1
          const branchLength = 2 + Math.floor(Math.random() * 4)
          for (let bs = 0; bs < branchLength; bs++) {
            const bIdx = dotGrid[`${branchCol},${branchRow}`]
            if (bIdx === undefined) break
            path.push(bIdx)
            branchRow++
            if (Math.random() < 0.4) {
              branchCol += Math.random() < 0.5 ? -1 : 1
              branchCol = Math.max(0, Math.min(maxCol, branchCol))
            }
          }
        }
      }
      // Phase 20.3: assign a stable random color from the palette to this bolt.
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      activeBolts.push({ path, spawnTime: now, revealedCount: 0, color })
    }

    // PHASE 20.6: ignore skipLogin (temporary demo auth gate). Restore
    // `skipLogin ? 'boot' : 'login'` + `skipLogin ? performance.now() : null`
    // when removing the gate.
    let phaseRef = 'login'
    let bootStartTime = null
    let animId = null
    const phaseCallback = (newPhase) => {
      phaseRef = newPhase
      if (newPhase === 'boot') bootStartTime = performance.now()
    }
    canvas._phaseCallback = phaseCallback

    function draw() {
      animId = requestAnimationFrame(draw)
      const now = performance.now()
      ctx.clearRect(0, 0, vw, vh)

      if (phaseRef === 'login') {
        // Spawn bolts
        if (now - lastBoltTime > BOLT_INTERVAL) { spawnBolt(now); lastBoltTime = now }
        // Update bolt reveals
        activeBolts.forEach(bolt => {
          bolt.revealedCount = Math.min(bolt.path.length, Math.floor((now - bolt.spawnTime) / 1000 * BOLT_SPEED))
        })
        // Reset fading dots
        dots.forEach(d => {
          if (d.fadeStart && now > d.fadeStart) {
            d.brightness = Math.max(0, 1 - (now - d.fadeStart) / BOLT_FADE)
          }
        })

        // Light up revealed dots with fade-in
        activeBolts.forEach(bolt => {
          for (let i = 0; i < bolt.revealedCount; i++) {
            const dotIdx = bolt.path[i]
            const dot = dots[dotIdx]
            if (!dot) continue
            const dotRevealTime = bolt.spawnTime + (i / BOLT_SPEED) * 1000
            const age = now - dotRevealTime
            const fadeIn = Math.min(1, age / 500)
            if (fadeIn > dot.brightness) {
              dot.brightness = fadeIn
              dot.fadeStart = dotRevealTime + 800
              dot.color = bolt.color  // Phase 20.3: brighter bolt wins → dot adopts its color
            }
          }
        })
        // Cleanup finished bolts
        for (let i = activeBolts.length - 1; i >= 0; i--) {
          const bolt = activeBolts[i]
          if (bolt.revealedCount >= bolt.path.length) {
            if (now - (bolt.spawnTime + (bolt.path.length / BOLT_SPEED) * 1000) > BOLT_FADE + 200) {
              activeBolts.splice(i, 1)
            }
          }
        }
        // Draw dots
        for (let i = 0; i < dots.length; i++) {
          const dot = dots[i]
          const b = dot.brightness
          if (b > 0.01) {
            // Phase 20.3: interpolate toward the dot's stored bolt color
            // (falls back to gold for any dot a bolt never colored).
            const target = dot.color || { r: goldR, g: goldG, b: goldB }
            const r = normR + (target.r - normR) * b
            const g = normG + (target.g - normG) * b
            const bl = normB + (target.b - normB) * b
            ctx.beginPath()
            ctx.arc(dot.x, dot.y, dotRadius + b * 0.5, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(bl)},${0.18 + b * 0.82})`
            ctx.fill()
          } else {
            ctx.beginPath()
            ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255,255,255,0.18)'
            ctx.fill()
          }
        }

      } else if (phaseRef === 'boot' && bootStartTime) {
        const elapsed = now - bootStartTime
        const rippleElapsed = elapsed - RIPPLE_START
        if (rippleElapsed <= 0) {
          for (let i = 0; i < dots.length; i++) {
            ctx.beginPath(); ctx.arc(dots[i].x, dots[i].y, dotRadius, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill()
          }
          return
        }
        const totalCycle = RIPPLE_DURATION + WAVE_GAP
        const waveIndex = Math.floor(rippleElapsed / totalCycle)
        const waveElapsed = rippleElapsed - (waveIndex * totalCycle)
        const waveT = waveIndex >= 2 ? 1 : Math.min(waveElapsed / RIPPLE_DURATION, 1)
        const waveFront = waveT * 1.4
        const isSecondWave = waveIndex >= 1

        for (let i = 0; i < dots.length; i++) {
          const dot = dots[i]
          const normDist = dot.dist / maxDist
          const behind = waveFront - normDist
          let r, g, b, alpha
          if (waveIndex >= 2) {
            r = normR; g = normG; b = normB; alpha = 1
          } else if (behind < 0) {
            if (isSecondWave) { r = normR; g = normG; b = normB; alpha = 1 }
            else {
              ctx.beginPath(); ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2)
              ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); continue
            }
          } else if (behind < waveFrontWidth) {
            const intensity = behind / waveFrontWidth
            r = normR + (goldR - normR) * intensity
            g = normG + (goldG - normG) * intensity
            b = normB + (goldB - normB) * intensity
            alpha = isSecondWave ? 1 : 0.18 + intensity * 0.82
          } else {
            const fadeProgress = Math.min((behind - waveFrontWidth) / fadeTailLength, 1)
            const ease = fadeProgress * fadeProgress * (3 - 2 * fadeProgress)
            r = goldR + (normR - goldR) * ease
            g = goldG + (normG - goldG) * ease
            b = goldB + (normB - goldB) * ease
            alpha = 1
          }
          ctx.beginPath(); ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`; ctx.fill()
        }
      }
    }
    animId = requestAnimationFrame(draw)
    return () => { if (animId) cancelAnimationFrame(animId) }
  }, [])

  // Sync phase to canvas
  useEffect(() => {
    const canvas = dotCanvasRef.current
    if (canvas?._phaseCallback) canvas._phaseCallback(phase)
  }, [phase])

  if (phase === 'done') return null
  const isLogin = phase === 'login'
  const isFading = phase === 'fading'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      paddingTop: 'calc(50vh - 220px)',
      background: '#0a0c10',
      opacity: isFading ? 0 : 1,
      transition: `opacity ${FADE_DURATION}ms ease`,
      pointerEvents: isFading ? 'none' : 'auto',
    }}>
      <canvas ref={dotCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <canvas ref={radiantCanvasRef} width={280} height={280} style={{ width: 280, height: 280, display: 'block', position: 'relative', zIndex: 1 }} />

      <div style={{
        marginTop: 24, fontFamily: 'var(--font-display, Georgia, serif)', fontWeight: 700,
        fontSize: 18, letterSpacing: '0.18em', color: 'rgba(212, 175, 55, 0.7)',
        textTransform: 'uppercase', position: 'relative', zIndex: 1,
      }}>RADIANT</div>

      {isLogin && (
        // ─────────────────────────────────────────────────────────────────
        // PHASE 20.6: TEMPORARY DEMO AUTH GATE — credential entry UI.
        // Replaces the prior CAC identity certificate panel (Identity
        // Certificate / Authentication / Credentials sections + a plain
        // ESTABLISH SESSION button). Remove this whole {isLogin && (...)}
        // block and restore the original CAC panel when removing the gate.
        // Grep for `PHASE 20.6` to find all sites.
        // ─────────────────────────────────────────────────────────────────
        <form onSubmit={handleAuthSubmit} style={{ marginTop: 28, position: 'relative', zIndex: 1, width: 300 }}>
          <div style={{
            border: '1px solid rgba(212, 175, 55, 0.35)', borderRadius: 8, overflow: 'hidden',
            background: 'rgba(180, 140, 50, 0.06)',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: 'rgba(212, 175, 55, 0.4)', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>Username</div>
              <input
                type="text"
                value={authUsername}
                onChange={handleUsernameChange}
                autoFocus
                autoComplete="username"
                spellCheck={false}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: 0,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'rgba(212, 175, 55, 0.85)',
                  letterSpacing: '0.02em',
                }}
              />
            </div>
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: 'rgba(212, 175, 55, 0.4)', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>Password</div>
              <input
                type="password"
                value={authPassword}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: 0,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'rgba(212, 175, 55, 0.85)',
                  letterSpacing: '0.02em',
                }}
              />
            </div>
          </div>
          {authError && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 4,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'rgba(239, 68, 68, 0.85)',
              fontSize: 10,
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.05em',
            }}>{authError}</div>
          )}
          <button type="submit" disabled={authChecking} style={{
            marginTop: 16, width: '100%', padding: '12px 0',
            border: '1px solid rgba(212, 175, 55, 0.5)', borderRadius: 6,
            background: 'rgba(212, 175, 55, 0.08)', color: 'rgba(212, 175, 55, 0.85)',
            fontSize: 11, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            cursor: authChecking ? 'not-allowed' : 'pointer',
            opacity: authChecking ? 0.6 : 1,
            transition: 'all 200ms ease',
          }}
            onMouseEnter={e => { if (authChecking) return; e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)'; e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.7)'; e.currentTarget.style.color = 'rgba(212, 175, 55, 1)' }}
            onMouseLeave={e => { if (authChecking) return; e.currentTarget.style.background = 'rgba(212, 175, 55, 0.08)'; e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.5)'; e.currentTarget.style.color = 'rgba(212, 175, 55, 0.85)' }}
          >ESTABLISH SESSION</button>
        </form>
        // END PHASE 20.6 demo auth gate UI
      )}

      {(phase === 'boot' || isFading) && (
        <>
          <div style={{
            marginTop: 16, fontFamily: 'var(--font-mono, "Courier New", monospace)',
            fontSize: 11, letterSpacing: '0.04em', color: 'rgba(255, 255, 255, 0.3)',
            position: 'relative', zIndex: 1,
          }}>{bootText}</div>
          <div style={{
            marginTop: 20, width: 120, height: 1,
            background: 'rgba(212, 175, 55, 0.15)', borderRadius: 1, overflow: 'hidden',
            position: 'relative', zIndex: 1,
          }}>
            <div style={{
              height: '100%', background: 'rgba(212, 175, 55, 0.5)',
              borderRadius: 1, animation: `boot-progress ${BOOT_DURATION / 1000}s ease forwards`,
            }} />
          </div>
        </>
      )}

      <style>{`
        @keyframes boot-progress {
          0% { width: 0%; }
          30% { width: 25%; }
          60% { width: 60%; }
          85% { width: 85%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
