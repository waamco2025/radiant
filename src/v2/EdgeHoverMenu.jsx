// EdgeHoverMenu — rich tooltip + menu for edge hover and selection states.
// Phase 9B — replaces the old small SDA hover tooltip AND the separate
// EdgeMenu. One surface, two modes:
//
//   mode='hover'  — appears top-left of cursor while the cursor is over an
//                    edge; cursor-centered dot handled separately by V2Canvas.
//                    pointer-events: none so the cursor-centered dot and the
//                    tooltip don't steal hover events from the edge itself.
//   mode='pinned' — appears at the click point; persistent until the user
//                    clicks an action (which opens the respective Agreement
//                    Detail Panel), clicks a different edge, or clicks
//                    empty canvas. pointer-events: auto so rows are clickable.
//
// Row structure per spec Phase 9B §6/§7:
//   View Disclosure Agreement
//     [mini SDA illustration]  [SDA type label]
//     [From node] ([owner]) → [To node] ([owner])
//   View Evaluation Agreement   (only when paired EA exists)
//     Expires [date] | Never expires
//
// SDA type illustration matches the live edge pattern (solid indigo for Full,
// dashed amber for Selective, dotted green for Proof-only, dashed grey for
// Provisional).

import { createPortal } from 'react-dom'

const SDA_TYPE_STYLE = {
  full:        { color: '#6b8aff', label: 'Full Disclosure',       dasharray: null },
  selective:   { color: '#f59e0b', label: 'Selective Disclosure',  dasharray: '6 3' },
  proofonly:   { color: '#22c55e', label: 'Proof-only Disclosure', dasharray: '2 3' },
  provisional: { color: '#888888', label: 'Provisional',           dasharray: '5 4' },
  cascade:     { color: '#a78bfa', label: 'Cascade Disclosure',    dasharray: '4 3' },
}

const MENU_MAX_WIDTH = 300
const MENU_OFFSET = 12

function SdaEdgeIllustration({ sdaType }) {
  const style = SDA_TYPE_STYLE[sdaType] || SDA_TYPE_STYLE.full
  return (
    <svg width={48} height={8} viewBox="0 0 48 8" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line
        x1="2" y1="4" x2="46" y2="4"
        stroke={style.color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={style.dasharray || undefined}
      />
    </svg>
  )
}

function formatExpiryDate(iso) {
  if (!iso) return 'Never expires'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'Never expires'
    return `Expires ${d.toISOString().slice(0, 10)}`
  } catch (_) {
    return 'Never expires'
  }
}

function MenuItem({ children, onClick }) {
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      style={{
        padding: '10px 14px',
        cursor: 'pointer',
        background: 'transparent',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => {
        // Phase 9B §8: whole-item hover highlight.
        e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-card) 85%, var(--text-primary) 15%)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </div>
  )
}

export default function EdgeHoverMenu({
  mode,                     // 'hover' | 'pinned'
  anchorX, anchorY,         // cursor or click-point screen coords
  sdaType,
  fromNode, toNode,         // { name }
  grantorParty, granteeParty,
  disclosureAgreement,
  evaluationAgreement,
  onViewDisclosure,
  onViewEvaluation,
}) {
  if (!disclosureAgreement) return null
  const effectiveType = sdaType || 'full'
  const style = SDA_TYPE_STYLE[effectiveType] || SDA_TYPE_STYLE.full
  const hasEa = !!evaluationAgreement

  // Phase 9B §3: tooltip anchors top-left of cursor. In pinned mode the
  // "cursor" is the click point. Flip to bottom-right if the top-left
  // position would clip the viewport.
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 2000
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 2000
  const wouldClipTop = anchorY - MENU_OFFSET < 60
  const wouldClipLeft = anchorX - MENU_OFFSET < MENU_MAX_WIDTH + 20

  const xBase = anchorX
  const yBase = anchorY
  // Default: top-left. Use transform to position via the menu's own bottom-right corner.
  let transform = `translate(calc(-100% - ${MENU_OFFSET}px), calc(-100% - ${MENU_OFFSET}px))`
  if (wouldClipTop && wouldClipLeft) {
    transform = `translate(${MENU_OFFSET}px, ${MENU_OFFSET}px)` // bottom-right fallback
  } else if (wouldClipTop) {
    transform = `translate(calc(-100% - ${MENU_OFFSET}px), ${MENU_OFFSET}px)` // bottom-left
  } else if (wouldClipLeft) {
    transform = `translate(${MENU_OFFSET}px, calc(-100% - ${MENU_OFFSET}px))` // top-right
  }

  // Endpoint owners — grantor → grantee direction per spec §4/DA schema.
  const fromName = fromNode?.name || disclosureAgreement?.grantor?.party || '—'
  const toName = toNode?.name || disclosureAgreement?.grantee?.party || '—'
  const grantorLabel = grantorParty || disclosureAgreement?.grantor?.party
  const granteeLabel = granteeParty || disclosureAgreement?.grantee?.party

  // Pull expiry — EA schema stores the end of the agreement under terms.expires.
  const expiresIso = evaluationAgreement?.terms?.expires || evaluationAgreement?.expiresDate || null

  return createPortal(
    <div
      role="menu"
      aria-label={`Agreement Edge options (${mode})`}
      style={{
        position: 'fixed',
        left: xBase,
        top: yBase,
        transform,
        width: MENU_MAX_WIDTH,
        background: 'var(--bg-surface)',
        border: `1px solid ${style.color}`,
        borderRadius: 6,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
        zIndex: 6000,
        overflow: 'hidden',
        userSelect: 'none',
        pointerEvents: mode === 'pinned' ? 'auto' : 'none',
        fontFamily: 'var(--font-display)',
      }}
    >
      <MenuItem onClick={mode === 'pinned' ? onViewDisclosure : undefined}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          marginBottom: 6,
        }}>
          View Disclosure Agreement
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 4,
        }}>
          <SdaEdgeIllustration sdaType={effectiveType} />
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: style.color, fontWeight: 600, letterSpacing: '0.03em',
          }}>{style.label}</span>
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45,
        }}>
          {fromName}
          {grantorLabel && <span style={{ color: 'var(--text-dim)' }}> ({grantorLabel})</span>}
          <span style={{ color: 'var(--text-dim)' }}> → </span>
          {toName}
          {granteeLabel && <span style={{ color: 'var(--text-dim)' }}> ({granteeLabel})</span>}
        </div>
      </MenuItem>

      {hasEa && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <MenuItem onClick={mode === 'pinned' ? onViewEvaluation : undefined}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              marginBottom: 4,
            }}>
              View Evaluation Agreement
            </div>
            <div style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
            }}>
              {formatExpiryDate(expiresIso)}
            </div>
          </MenuItem>
        </div>
      )}
    </div>,
    document.body,
  )
}
