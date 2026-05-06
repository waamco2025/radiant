// Phase 15.0 (#172 part 1): per-Requirements-Set color palette for
// annotation dot rendering. Stable across renders — same RS id always
// resolves to the same color.
//
// The palette draws from the prototype's existing CSS accent variables.
// Indigo is reserved as a UI-chrome color elsewhere, so it's last in the
// palette to minimize collision with surrounding UI.

const PALETTE = [
  'var(--accent-amber)',
  'var(--accent-green)',
  'var(--accent-cyan)',
  'var(--accent-orange)',
  'var(--accent-purple)',
  'var(--accent-teal)',
  'var(--accent-blue)',
  'var(--accent-lime)',
  'var(--accent-red)',
  'var(--accent-indigo)',
]

// Deterministic color assignment via a small hash on the RS id. The
// alternative (positional assignment based on order of first observation)
// would shift colors when the seed RS list changes; hash-based stays
// stable as the RS catalog grows.
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function getRsColor(rsId) {
  if (!rsId) return PALETTE[0]
  return PALETTE[hashStr(rsId) % PALETTE.length]
}

// Build a `{ [rsId]: color }` map from a list of RS ids. Used by the
// annotation overlay so it can pick the correct color per anchor without
// re-hashing on every render.
export function buildRsColorMap(rsIds) {
  const map = {}
  for (const id of rsIds || []) {
    if (!map[id]) map[id] = getRsColor(id)
  }
  return map
}
