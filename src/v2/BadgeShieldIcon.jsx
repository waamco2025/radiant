// BadgeShieldIcon — shared shield silhouette primitive.
//
// Phase 14.0 introduced the shield silhouette inline in BadgesPanel (see
// `BadgeShieldGlyph` there) and Badge Template Detail Panel. Phase 14.1 lifts
// the SVG to a shared module so card chip rendering on PoE + Claim node
// cards uses the same primitive — single source of truth for the badge
// graphic until #181 ships user-uploaded graphics.
//
// `size` is the rendered pixel size (square viewBox 16). `color` accepts
// any CSS color string; falls back to var(--accent-indigo) to match the
// Phase 14.0 pattern. `filled` adds a subtle fill at 12% color-mix tint —
// reads better at smaller card-chip sizes than the unfilled outline.
//
// Phase 14.5 (#176c): optional `strokeColor` prop renders a wider "halo"
// stroke beneath the silhouette so the shield reads as having a 2px outer
// outline in the caller-provided color. Used by `BadgeChipContainer` to
// paint a background-matching outline that produces the overlapping-tokens
// negative-space cut when shields overlap.

export default function BadgeShieldIcon({
  size = 14,
  color = 'var(--accent-indigo)',
  filled = true,
  strokeColor = 'none',
  style,
}) {
  const hasHalo = strokeColor !== 'none' && strokeColor != null
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden
      style={{ flexShrink: 0, color, overflow: 'visible', ...style }}
    >
      {hasHalo && (
        // Halo path — same silhouette geometry, wider stroke in the
        // caller's bg color, no fill. The inner half of the stroke renders
        // inside the silhouette where the silhouette fill (12% currentColor
        // over transparent) sits over it; against the rectangle's 18%
        // currentColor background, the inner halo blends to roughly the
        // same indigo tint as the rest of the shield interior, so the
        // inner ring is essentially invisible. The outer half of the
        // stroke produces the visible 2px halo that cuts adjacent shields.
        <path
          d="M8 1.5 L13 3.2 L13 8 C13 11.2 10.8 13.5 8 14.5 C5.2 13.5 3 11.2 3 8 L3 3.2 Z"
          stroke={strokeColor} strokeWidth="4" strokeLinejoin="round" fill="none"
        />
      )}
      <path
        d="M8 1.5 L13 3.2 L13 8 C13 11.2 10.8 13.5 8 14.5 C5.2 13.5 3 11.2 3 8 L3 3.2 Z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
        fill={filled ? 'color-mix(in srgb, currentColor 12%, transparent)' : 'none'}
      />
      <path d="M5.6 8.2 L7.3 9.9 L10.4 6.5"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
