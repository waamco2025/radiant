// Phase 15.1 (#172 part 2): synthesized anchor IDs.
//
// Seed Eval Result anchors don't carry explicit `id` fields — they're
// embedded objects on `result.evidenceAnchors[]`. For Phase 15.1's
// bidirectional row↔dot interaction, both the PDF dot and the results-
// table row need a stable identity to coordinate via shared state. We
// synthesize at consumer time from a tuple of fields that uniquely
// identifies an anchor across all anchors a given Eval Result emits:
//
//   { sourceAssetId, requirementsSetId, requirementId, page, x, y }
//
// `(rsId, requirementId)` is unique within a single Eval Result; adding
// `sourceAssetId` makes the ID stable when the same requirement has
// anchors in multiple Assets (rare but possible). Adding `(page, x, y)`
// disambiguates the unlikely case where one row anchors twice in the
// same Asset (e.g., a value cited at two different locations).
//
// The synthesized form is a string suitable for DOM attributes
// (`data-anchor-id`) and for React keys.

export function synthesizeAnchorId(anchor) {
  if (!anchor) return ''
  const {
    sourceAssetId = '',
    requirementsSetId = '',
    requirementId = '',
    page = 0,
    x = 0,
    y = 0,
  } = anchor
  return `${sourceAssetId}|${requirementsSetId}|${requirementId}|${page}|${Math.round(x)}|${Math.round(y)}`
}
