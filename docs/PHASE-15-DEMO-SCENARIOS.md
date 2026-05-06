# Phase 15 — Seeded Annotation Demo Scenarios

These scenarios exercise the PDF annotation overlay (#172) using seed data
shipped in Phase 15.0 + the layout / switcher fixes shipped in Phase 15.0.1.
They serve as QA targets and a rough template for the eventual Phase 15.2
walkthrough guide.

## Scenario 1 — Multi-RS, multi-Asset Eval Result on PRM Claim (`erBobPrm`)

**Role:** Bob (GovCo)
**Starting point:** Bob's canvas; find the Eval Result node on Alice's
"Power Regulation Module Assembly" Claim.
**Action:** Click the Eval Result node → open Detail Panel → click Expand →
the Output tab is the default.
**Expected:**

- An `EVIDENCE` section appears above the per-RS results tables.
- The first PDF (`microco-prm-datasheet.pdf`, the PRM Datasheet) renders
  via PDF.js inside the Output panel — fits column width, no horizontal
  scroll. Multi-page (2 pages stacked vertically with subtle drop shadow).
- Numbered annotation dots overlay the rendered PDF: amber dots
  (MIL-PRF-55681) on rows 1.1, 1.3, 1.5; cyan dots (System Integration)
  on 1.6, 1.7, 1.8, 1.9. Dot label format is `{assetOrdinal}.{rowOrdinal}`.
- Header strip shows `EVIDENCE | Power Regulation Module Datasheet
  [◀] [▶] | Asset 1 of 2`. Click ▶ — display flips to the second
  Asset (`microco-prm-test-report.pdf`) with anchors 1.2 (Thermal
  dissipation) and 1.4 (Radiation tolerance). Click ◀ — returns to
  the Datasheet.
- ▶ disables at boundary (Asset 2 of 2); ◀ disables at boundary
  (Asset 1 of 2).
- Per-RS result tables below remain unchanged from Phase 13.4.

## Scenario 2 — Single-RS Eval Result chain head on VReg Claim (`erBobVreg`)

**Role:** Bob (GovCo)
**Starting point:** Bob's canvas; find the chain-head Eval Result on
Alice's "Voltage Regulator IC" Claim (the latest in the V0 → V1 → V_main
chain — only V_main is `active`; the prior two are `superseded`).
**Action:** Click the Eval Result node → open Detail Panel → click Expand →
Output tab.
**Expected:**

- `EVIDENCE` section with `microco-vreg-datasheet.pdf` rendered via
  PDF.js. Fit-to-width, multi-page.
- Numbered dots labelled "1.1" through "1.5" — single RS, so all dots
  share the same color (amber for MIL-PRF-55681).
- Counter reads `Asset 1 of 1`; arrows hidden (single-Asset case).
- Per-RS result table below is unchanged.

The two superseded Eval Results in the chain (V0 + V1) carry the same
shape — V0's Thermal dissipation + Radiation tolerance rows have status
`missing`, so those rows have empty `evidenceAnchors[]` and render no dot
on the PDF.

## Scenario 3 — PoE expand modal, Output tab Section 1

**Role:** Bob (GovCo)
**Starting point:** Bob's canvas; find the PoE wrapping `erBobPrm` (the
PoE node sits adjacent to the Eval Result).
**Action:** Click the PoE node → Detail Panel → Expand → Output tab.
**Expected:**

- Section 1 of the PoE Output renders the same content as Scenario 1
  (PoE Output Section 1 inherits via the wrapped Eval Result render).
- Same EVIDENCE strip + same dots + same multi-Asset switcher behavior.
- Section 2 (Evaluation Provenance) is unchanged from Phase 13.4 — lists
  the wrapped Eval Result's full supersession chain, oldest first,
  clickable.

## Scenario 4 — Run Evaluation re-run flow

**Role:** Alice (MicroCo) → then Bob (GovCo)
**Starting point:** Alice's canvas, VReg Claim.
**Action:**

1. **As Alice:** AmendClaim → add a new Asset to the Claim's referenced
   Assets → update the DA scope to include the new Asset.
2. **As Bob:** find the latest VReg Eval Result → action bar → Re-Run
   Evaluation.
3. **Step 2 (review parsed values).** Expand any in-scope Asset row in
   the left panel.

**Expected:**

- The expanded `microco-vreg-datasheet.pdf` row renders via PDF.js with
  annotation dots from the prior result (`erBobVreg`'s anchors).
- The new Asset Alice added (whatever she chose) renders as a PDF or
  iframe (depending on file type) WITHOUT dots — fresh evals don't
  carry committed anchors yet (Phase 15.1 will add live evaluator-driven
  anchor authoring).
- Right panel shows the parsed value rows the user can curate before
  submit.

Fresh evaluations triggered via "Run Evaluation" (not Re-Run) similarly
render PDFs without dots — by design for Phase 15.0.1.

## Notes for QA

- **Status `missing` rows** carry empty `evidenceAnchors[]` arrays by
  design; their requirement renders no dot on the PDF.
- **Asset 1 of N indicator** in the EVIDENCE strip respects displayable
  Assets only — Assets without a `localPath` (e.g. Test Report Asset
  pre–Phase 15.0) wouldn't count and the switcher hides them.
- **PDF.js v5 `canvas` API** is required — the legacy `canvasContext`
  parameter still paints the canvas but the render-task promise never
  resolves. See the v15.0 phase-log entry for the diagnosis history.
- **"Knockout groups not supported"** PDF.js console warning is
  acceptable — it's a transparency-rendering limitation in v5, not a
  functional bug.
- **Stale Vite dev process** can serve cached pdfjs-dist bytes after
  `npm install` upgrades. If PDF rendering disagrees with the on-disk
  module version, run `lsof -i :5173` and kill any older Vite PIDs
  before debugging further.
