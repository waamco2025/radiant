// Phase 11C.3 W4: shared Expand icon button.
//
// Extracted from the duplicate definitions previously inlined in
// V22NodeDetailPanel.jsx (`ExpandButton`, Phase 11B) and
// EvaluationAgreementDetailPanel.jsx (`ExpandIconButton`, Phase 11C.2).
// Both call sites now import this component so the icon stays consistent
// across Asset, Parse Result, Eval Result, and EA Detail Panel locations.
//
// The icon — two opposing-corner arrows pointing outward — was the EA
// version selected by the user as the canonical Expand affordance.

export default function ExpandButton({ onClick, title = 'Expand to view artifact' }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      title={title}
      aria-label={title}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '3px 5px',
        cursor: 'pointer',
        color: 'var(--text-tertiary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 100ms, border-color 100ms, color 100ms',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'
        e.currentTarget.style.borderColor = 'var(--accent-indigo)'
        e.currentTarget.style.color = 'var(--accent-indigo)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--text-tertiary)'
      }}
    >
      <svg width={11} height={11} viewBox="0 0 16 16" fill="none">
        <path d="M6 3 L13 3 L13 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 3 L7 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M3 7 L3 13 L9 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
