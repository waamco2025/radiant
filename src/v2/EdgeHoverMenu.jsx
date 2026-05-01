// EdgeHoverMenu — rich tooltip + menu for edge hover and selection states.
// Phase 9B: unified hover + click menu. Phase 9B.1 refined visual language.
//
// Two modes:
//   mode='hover'  — appears top-left of cursor while cursor is over an edge.
//                    Header "Select Edge to View" centered above options.
//                    Options are rendered in rounded-rectangle containers but
//                    are not clickable; pointer-events: none on the outer
//                    wrapper keeps edge hover events intact.
//   mode='pinned' — appears at (or follows) the click point. Header is
//                    hidden; "View →" affordance fades in on the right side
//                    of each option simultaneously (~200ms). Options are
//                    clickable and open their respective Agreement panels.
//
// Phase 9B.1 simplifies each option to 2 rows:
//   Disclosure Agreement option:
//     Row 1: short SDA illustration (half length vs 9B) + "{Type} Disclosure Agreement"
//     Row 2: "{From} ({grantor}) → {To} ({grantee})"
//   Evaluation Agreement option (only when paired EA exists):
//     Row 1: "Evaluation Agreement"
//     Row 2: "Expires YYYY-MM-DD" | "Never expires"

import { createPortal } from 'react-dom'

const SDA_TYPE_STYLE = {
  full:        { color: '#6b8aff', typeLabel: 'Full',        dasharray: null },
  selective:   { color: '#f59e0b', typeLabel: 'Selective',   dasharray: '6 3' },
  proofonly:   { color: '#22c55e', typeLabel: 'Proof-only',  dasharray: '2 3' },
  provisional: { color: '#888888', typeLabel: 'Provisional', dasharray: '5 4' },
  cascade:     { color: '#a78bfa', typeLabel: 'Cascade',     dasharray: '4 3' },
}

// Phase 11E.1.2 Fix 2: was 320 — too narrow to fit the longest type label
// ("Proof-only Disclosure Agreement", 31 chars) on one line at 12px/600
// alongside the SDA illustration + the reserved 80px right padding for
// the pinned-mode "View →" affordance. Bumped to 380 so all four labels
// (Full / Selective / Proof-only / Evaluation) render single-line.
const MENU_WIDTH = 380
const MENU_OFFSET = 12
// Phase 9B.1 §2: reserves space for "View →" in pinned state so layout
// doesn't shift. Phase 9B.2 Fix 4: bumped 48→80px because "View →" was
// overlapping endpoint text like "Power Regulation Module Assembly
// (MicroCo) → Avionics Module (GovCo)".
const OPTION_RIGHT_PADDING = 80

function SdaEdgeIllustration({ sdaType }) {
  const style = SDA_TYPE_STYLE[sdaType] || SDA_TYPE_STYLE.full
  // Phase 9B.1 §2: half the 9B length (48 → 24px).
  return (
    <svg width={24} height={8} viewBox="0 0 24 8" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line
        x1="2" y1="4" x2="22" y2="4"
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

function OptionCard({ children, onClick, clickable, showViewArrow, accent }) {
  const isClickable = clickable && !!onClick
  return (
    <div
      role={isClickable ? 'menuitem' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={(e) => {
        if (!isClickable) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      onMouseEnter={(e) => {
        // Phase 9B.1 §2/§3: whole-option hover highlight, persists across hover + pinned modes.
        e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-card) 85%, var(--text-primary) 15%)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-raised)'
      }}
      style={{
        position: 'relative',
        borderRadius: 8,
        background: 'var(--bg-raised)',
        padding: `10px ${OPTION_RIGHT_PADDING}px 10px 14px`,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background 120ms',
      }}
    >
      {children}
      {/* Phase 9B.1 §3: "View →" affordance, right-centered, fades in on
          pinned mode. Always mounted; opacity drives visibility so the
          transition is smooth and layout doesn't shift. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: accent,
          letterSpacing: '0.04em',
          opacity: showViewArrow ? 1 : 0,
          transition: 'opacity 200ms ease',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        View →
      </span>
    </div>
  )
}

export default function EdgeHoverMenu({
  mode,                     // 'hover' | 'pinned'
  hidden = false,           // Phase 9B.2 Fix 3: fade-out while pan/zoom animation runs
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
  const isPinned = mode === 'pinned'

  // Phase 9B.1 §3/§4: top-left of anchor, flip at viewport edges.
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 2000
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 2000
  const wouldClipTop = anchorY - MENU_OFFSET < 60
  const wouldClipLeft = anchorX - MENU_OFFSET < MENU_WIDTH + 20

  let transform = `translate(calc(-100% - ${MENU_OFFSET}px), calc(-100% - ${MENU_OFFSET}px))`
  if (wouldClipTop && wouldClipLeft) {
    transform = `translate(${MENU_OFFSET}px, ${MENU_OFFSET}px)`
  } else if (wouldClipTop) {
    transform = `translate(calc(-100% - ${MENU_OFFSET}px), ${MENU_OFFSET}px)`
  } else if (wouldClipLeft) {
    transform = `translate(${MENU_OFFSET}px, calc(-100% - ${MENU_OFFSET}px))`
  }

  const fromName = fromNode?.name || disclosureAgreement?.grantor?.party || '—'
  const toName = toNode?.name || disclosureAgreement?.grantee?.party || '—'
  const grantorLabel = grantorParty || disclosureAgreement?.grantor?.party
  const granteeLabel = granteeParty || disclosureAgreement?.grantee?.party
  // Phase 11E.1.1 Fix 2: read from the correct field. The EA schema carries
  // `terms.evaluationDeadline` (spec §10.5); `terms.expires` exists only on
  // the DA schema. Pre-fix the tooltip always fell back to "Never expires"
  // for EAs (regardless of any actual deadline) and looked stale post-amend
  // because it never read the real field. `evaluationAgreement` is resolved
  // live from the merged view via `pairedEvaluationAgreementId` lookup, so
  // post-amend the new deadline propagates here automatically once the
  // field name is correct.
  const expiresIso = evaluationAgreement?.terms?.evaluationDeadline
    || evaluationAgreement?.terms?.expires    // legacy fallback
    || evaluationAgreement?.expiresDate
    || null

  return createPortal(
    <div
      role="menu"
      aria-label={`Agreement Edge options (${mode})`}
      style={{
        position: 'fixed',
        left: anchorX,
        top: anchorY,
        transform,
        width: MENU_WIDTH,
        background: 'var(--bg-surface)',
        border: `1px solid ${style.color}`,
        borderRadius: 8,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
        zIndex: 6000,
        overflow: 'hidden',
        userSelect: 'none',
        pointerEvents: isPinned && !hidden ? 'auto' : 'none',
        fontFamily: 'var(--font-display)',
        padding: 10,
        // Phase 9B.2 Fix 3: fade out during pan/zoom animation, fade back
        // in at the new anchor position on completion.
        opacity: hidden ? 0 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      {/* Phase 9B.1 §2: hover-mode header. Omitted in pinned mode. */}
      {!isPinned && (
        <div style={{
          textAlign: 'center',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 10,
          marginTop: 2,
        }}>
          Select Edge to View
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <OptionCard
          clickable={isPinned}
          onClick={isPinned ? onViewDisclosure : undefined}
          showViewArrow={isPinned}
          accent={style.color}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 4,
          }}>
            <SdaEdgeIllustration sdaType={effectiveType} />
            {/* Phase 11E.1.2 Fix 2: nowrap on the title alone so the long
                "Selective" / "Proof-only" labels don't orphan "Agreement"
                onto a second line. The party→party body line below
                continues to wrap normally on long names. */}
            <span style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}>
              {style.typeLabel} Disclosure Agreement
            </span>
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
        </OptionCard>

        {hasEa && (
          <OptionCard
            clickable={isPinned}
            onClick={isPinned ? onViewEvaluation : undefined}
            showViewArrow={isPinned}
            accent={style.color}
          >
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
              marginBottom: 4,
              whiteSpace: 'nowrap',  // Phase 11E.1.2 Fix 2: parity with DA title.
            }}>
              Evaluation Agreement
            </div>
            <div style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
            }}>
              {formatExpiryDate(expiresIso)}
            </div>
          </OptionCard>
        )}
      </div>
    </div>,
    document.body,
  )
}
