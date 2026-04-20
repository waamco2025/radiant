// DirectoryLayer — Phase 7 (spec §8).
//
// Placeholder-grade Public Directory view. Per spec §8.5, the minimum viable
// Directory Layer is an empty-ish canvas with distinct styling; dots visible
// but non-clickable, so a later phase can wire per-dot Detail Panels without
// schema changes. The full clouds-and-globe visualization is tracked on the
// polish backlog.
//
// Entry/exit transition: a CSS `clip-path` circle expands from the bottom-left
// corner on entry and contracts on exit. Implementation note: per spec §8.1
// this is explicitly NOT the V2.1 child-layer dive — different transition,
// different mechanics. Single sweep; no intermediate "everything hidden"
// state.

import { useEffect, useState, useMemo, useRef } from 'react'
import Tooltip from '../components/Tooltip.jsx'
import { buildV22SharedArtifacts } from './v2_2Data.js'

// Deterministic PRNG so cluster dot positions stay stable across renders.
function seededRandom(seed) {
  let x = seed
  return () => {
    x = (x * 9301 + 49297) % 233280
    return x / 233280
  }
}

function ClusterDots({ center, count, colorVar, seed, label, partyName }) {
  const dots = useMemo(() => {
    const rand = seededRandom(seed)
    const out = []
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2
      // Biased radius — tighter clumping near the centre, a long tail outward.
      const radius = Math.pow(rand(), 0.7) * 120 + 18
      const r = 1 + rand() * 2.5
      out.push({
        dx: Math.cos(angle) * radius,
        dy: Math.sin(angle) * radius,
        r,
        opacity: 0.45 + rand() * 0.45,
      })
    }
    return out
  }, [count, seed])

  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(${center.xPct}% - 8px)`,
        top: `calc(${center.yPct}% - 8px)`,
        pointerEvents: 'none',
      }}
    >
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: d.dx,
            top: d.dy,
            width: d.r * 2,
            height: d.r * 2,
            borderRadius: '50%',
            background: `color-mix(in srgb, ${colorVar} ${Math.round(d.opacity * 100)}%, transparent)`,
            boxShadow: `0 0 ${d.r * 2}px color-mix(in srgb, ${colorVar} 50%, transparent)`,
          }}
        />
      ))}
      {/* Cluster label — light annotation so the user can read the party */}
      <div
        style={{
          position: 'absolute',
          left: -60,
          top: -140,
          width: 160,
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ color: colorVar, fontWeight: 700 }}>{partyName}</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

export default function DirectoryLayer({ open, activeParty, onOpenAIShopper, onClose }) {
  // Track whether the wipe should expand (opening) or contract (closing).
  // `phase` is 'in' | 'out' | 'closed'. We keep the layer mounted during the
  // out-phase so the reverse animation plays before unmount.
  const [phase, setPhase] = useState('closed')

  // Keep a ref to the current phase so the opening-effect can read it
  // without putting phase in the deps array. Putting phase in deps meant the
  // effect re-ran as soon as phase became 'opening' and the cleanup cancelled
  // the scheduled RAF that was about to flip to 'in' — so the CSS transition
  // never fired.
  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    if (open) {
      // Phase 8 polish #1: animate opening the same way we animate closing.
      // Mount in `opening` (clip-path = 0%), then flip to `in` (clip-path =
      // 180%) after the browser has had a chance to paint the opening frame
      // so the CSS transition has a real from-state to animate from.
      // Two nested RAFs: the first waits for layout, the second for paint.
      if (phaseRef.current === 'closed') {
        setPhase('opening')
        let raf2 = 0
        const raf1 = requestAnimationFrame(() => {
          raf2 = requestAnimationFrame(() => setPhase('in'))
        })
        return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2) }
      }
    } else if (phaseRef.current !== 'closed') {
      setPhase('out')
      const t = setTimeout(() => setPhase('closed'), 600)
      return () => clearTimeout(t)
    }
  }, [open])

  // Clip-path circle grows from the bottom-left corner to ~180vmax (covers
  // the whole viewport). Reversed on exit. Opening (first render) sits at
  // clipCollapsed for one frame before transitioning to clipExpanded so the
  // CSS transition has a from-state to animate from.
  const clipCollapsed = 'circle(0% at 0% 100%)'
  const clipExpanded = 'circle(180% at 0% 100%)'
  const clipPath = phase === 'in' ? clipExpanded : clipCollapsed

  // Alice's 3 publicly-disclosed Claims form the only real cluster in the
  // seeded dataset. To make the Directory feel populated (per spec §8.2's
  // "thousands of dots"), we add a handful of mock supplier clusters that are
  // visual-only — no backing artifacts. Future polish item #NEW captures the
  // path to real per-dot data.
  // NOTE: useMemo must run on every render (rules of hooks). The conditional
  // `return null` below gates only the rendered output, not hook calls.
  const publicClaimCount = useMemo(() => {
    const shared = buildV22SharedArtifacts()
    return shared.disclosureAgreements.filter(
      (d) => d.grantee?.party === 'Radiant Network' && d.subject?.kind === 'claim',
    ).length
  }, [])

  if (phase === 'closed') return null

  // Clusters are positioned in viewport percentages so they scale with resize.
  // Seeds are arbitrary but stable.
  const clusters = [
    { partyName: 'MicroCo', label: `${publicClaimCount} public Claim${publicClaimCount === 1 ? '' : 's'}`, center: { xPct: 48, yPct: 42 }, count: 28 + publicClaimCount * 6, colorVar: 'var(--accent-indigo)', seed: 101 },
    { partyName: 'ElectroGrid Ltd', label: 'mock supplier · 41 public', center: { xPct: 22, yPct: 62 }, count: 34, colorVar: 'var(--accent-blue)', seed: 203 },
    { partyName: 'NovaFab Inc', label: 'mock supplier · 17 public', center: { xPct: 74, yPct: 30 }, count: 22, colorVar: 'var(--accent-green)', seed: 307 },
    { partyName: 'Precision Components Co', label: 'mock supplier · 8 public', center: { xPct: 68, yPct: 70 }, count: 14, colorVar: 'var(--accent-amber)', seed: 409 },
  ]

  return (
    <div
      data-v22-directory-layer
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150, // below chrome (300) + modals (1000), above main canvas.
        clipPath,
        WebkitClipPath: clipPath,
        transition: 'clip-path 550ms cubic-bezier(0.65, 0, 0.35, 1), -webkit-clip-path 550ms cubic-bezier(0.65, 0, 0.35, 1)',
        background: 'radial-gradient(ellipse at bottom left, color-mix(in srgb, var(--accent-amber) 6%, var(--bg-deep)) 0%, var(--bg-deep) 70%)',
        overflow: 'hidden',
      }}
    >
      {/* User's corner node anchor (spec §8.1 — morphs from the chrome button
          into the Directory's bottom-left anchor node). */}
      <Tooltip content="Exit Directory" position="top">
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          left: 32,
          bottom: 32,
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: 'var(--bg-raised)',
          border: '2px solid var(--accent-amber)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 0 24px color-mix(in srgb, var(--accent-amber) 40%, transparent)',
          fontFamily: 'var(--font-display)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--accent-amber)',
        }}
      >
        {activeParty || 'You'}
      </div>
      </Tooltip>

      {/* Cluster dot clouds */}
      {clusters.map((c) => (
        <ClusterDots key={c.partyName} {...c} />
      ))}

      {/* Header + AI Shopper CTA (spec §8.3 — Directory Layer exposes the
          AI Shopper as a prominent entry point). */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        fontFamily: 'var(--font-display)',
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'var(--text-dim)', marginBottom: 6,
        }}>
          Radiant Network · Public Directory
        </div>
        <div style={{
          fontSize: 22, fontWeight: 300, color: 'var(--text-primary)',
          marginBottom: 16, letterSpacing: '-0.01em',
        }}>
          {clusters.length} parties · {clusters.reduce((n, c) => n + c.count, 0)} published Claims
        </div>
        <button
          onClick={onOpenAIShopper}
          style={{
            padding: '10px 22px',
            borderRadius: 999,
            border: '1px solid var(--accent-amber)',
            background: 'color-mix(in srgb, var(--accent-amber) 15%, transparent)',
            color: 'var(--accent-amber)',
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-amber) 25%, transparent)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-amber) 15%, transparent)'}
        >
          <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <line x1="10" y1="10" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M12 3 L12.5 4.5 L14 5 L12.5 5.5 L12 7 L11.5 5.5 L10 5 L11.5 4.5 Z" fill="currentColor" />
          </svg>
          Launch AI Shopper
        </button>
      </div>

      {/* Exit hint */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        cursor: 'pointer',
        fontFamily: 'var(--font-display)',
        fontSize: 11,
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
      }}
        onClick={onClose}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        <span>← Back to Network</span>
      </div>
    </div>
  )
}
