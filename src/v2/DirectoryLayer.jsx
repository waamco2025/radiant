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

  // Alice's 3 publicly-disclosed Claims form the only real MicroCo cluster.
  // Other clusters are visual-only mocks today (per spec §8.2 — full
  // dots-and-clouds visualization is tracked on the polish backlog).
  // Phase 11A: ChipCo replaces the previous ElectroGrid mock cluster, and
  // its visibility is gated per-role: only actors with at least one active
  // DA from ChipCo see the cluster. Today that's Bob (the warm-path DA
  // `da-chipco-bob-prm-ic` seeded in v2_2Data.js gives him visibility).
  // Alice and Carol don't see it.
  // NOTE: useMemo must run on every render (rules of hooks). The conditional
  // `return null` below gates only the rendered output, not hook calls.
  const sharedForDirectory = useMemo(() => buildV22SharedArtifacts(), [])
  const publicClaimCount = useMemo(() => {
    return sharedForDirectory.disclosureAgreements.filter(
      (d) => d.grantee?.party === 'Radiant Network' && d.subject?.kind === 'claim',
    ).length
  }, [sharedForDirectory])
  // Phase 11A: ChipCo cluster is gated on the active party having at least
  // one active (non-revoked) DA from ChipCo. The visibility check happens
  // at render time so role switches refresh the cluster set.
  const chipcoVisible = useMemo(() => {
    if (!activeParty) return false
    return sharedForDirectory.disclosureAgreements.some((d) =>
      d.grantor?.party === 'ChipCo' &&
      d.grantee?.party === activeParty &&
      !d._revokedMeta,
    )
  }, [sharedForDirectory, activeParty])
  // Phase 11A: ChipCo's Claim count for the cluster label — uses the
  // ChipCo-owned Claims in seed, giving the user a real number rather than
  // the previous "41 public" mock label.
  const chipcoClaimCount = useMemo(
    () => sharedForDirectory.claims.filter((c) => c.owner === 'ChipCo').length,
    [sharedForDirectory],
  )

  if (phase === 'closed') return null

  // Clusters are positioned in viewport percentages so they scale with resize.
  // Seeds are arbitrary but stable. The ChipCo cluster is filtered out
  // below for parties without a DA from ChipCo.
  const allClusters = [
    { partyName: 'MicroCo', label: `${publicClaimCount} public Claim${publicClaimCount === 1 ? '' : 's'}`, center: { xPct: 48, yPct: 42 }, count: 28 + publicClaimCount * 6, colorVar: 'var(--accent-indigo)', seed: 101 },
    { partyName: 'ChipCo', label: `supplier · ${chipcoClaimCount} public`, center: { xPct: 22, yPct: 62 }, count: 18 + chipcoClaimCount * 4, colorVar: 'var(--accent-blue)', seed: 203 },
    { partyName: 'NovaFab Inc', label: 'mock supplier · 17 public', center: { xPct: 74, yPct: 30 }, count: 22, colorVar: 'var(--accent-green)', seed: 307 },
    { partyName: 'Precision Components Co', label: 'mock supplier · 8 public', center: { xPct: 68, yPct: 70 }, count: 14, colorVar: 'var(--accent-amber)', seed: 409 },
  ]
  const clusters = allClusters.filter((c) => c.partyName !== 'ChipCo' || chipcoVisible)

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
      {/* Phase 11A: corner anchor refreshed from a circle button to a
          parent-layer-style Actor node card. Same look and feel as the
          ACTOR cards on the main canvas (CARD_W = 210px wide, ACTOR
          badge above the party name). Click returns to the parent
          canvas; hover applies the standard parent-layer node treatment.
          Phase 11A.1: positioning lifted from the inner card div onto
          the Tooltip's wrapper span via `wrapperStyle` so the Tooltip's
          hover detection has a real bounding box to bind to. The card
          itself sits inside the wrapper without absolute positioning. */}
      <Tooltip
        content="Return to your network"
        position="top"
        wrapperStyle={{ position: 'absolute', left: 32, bottom: 32 }}
      >
      <div
        onClick={onClose}
        style={{
          width: 210,
          minHeight: 88,
          padding: '14px 16px',
          borderRadius: 10,
          background: 'var(--bg-card)',
          // Parent-layer Actor card border: warm indigo blend (matches
          // AssetNode.jsx's WARM_BORDER convention from Phase 9A.1).
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          transition: 'border-color 150ms, background 150ms, box-shadow 150ms',
          boxShadow: '0 4px 14px rgba(0,0,0,0.32)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-indigo)'
          e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 6%, var(--bg-card))'
          e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.45)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))'
          e.currentTarget.style.background = 'var(--bg-card)'
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.32)'
        }}
      >
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '1px 4px', borderRadius: 3, letterSpacing: '0.1em',
          color: 'var(--text-tertiary)', background: 'var(--bg-raised)',
          alignSelf: 'flex-start',
        }}>ACTOR</span>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{activeParty || 'You'}</div>
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
