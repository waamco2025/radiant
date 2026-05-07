# Phase 15 — PDF Annotation Demo Walkthrough

Canonical demo + QA walkthrough for the PDF annotation feature shipped
across Phases 15.0 → 15.2 (issue #172). Use this guide to drive client
demos and as a regression checklist after future changes to the
annotation surfaces.

## 1. Overview

The PDF annotation feature renders an Eval Result's source evidence
(PDF) alongside its parsed results table, with numbered indicators
linking each requirement row to the cited rectangle inside the PDF.
Clicking a row scrolls the PDF to the matching indicator and highlights
both; clicking an indicator scrolls the table the other direction. When
an Eval Result references multiple Assets, an Asset switcher in the
left panel auto-flips on cross-Asset interactions.

### Demo scenarios at a glance

| # | Scenario | Role | Key feature exercised |
|---|----------|------|-----------------------|
| [1](#scenario-1--multi-rs-eval-result-on-prm-claim-erbobprm) | PRM Eval Result Expand | Bob | Multi-Asset switcher, multi-RS color coding, bidirectional click |
| [2](#scenario-2--single-rs-eval-result-on-vreg-claim-erbobvreg) | VReg Eval Result Expand | Bob | Multi-Asset (Datasheet + Test Report), single-RS, full chain head |
| [3](#scenario-3--poe-expand-modal) | PoE Expand | Bob | Same layout inherited via the wrapped Eval Result |
| [4](#scenario-4--run-evaluation-re-run-flow) | Re-Run flow Step 2 | Alice → Bob | Multi-Asset annotations carried forward into the Run Evaluation flow |

### Prerequisites

- Dev server running: `npm run dev` from the repo root.
- Browser at viewport ≥1280px wide so the side-by-side ASSET ↔
  EVALUATION RESULTS layout is readable. Below 900px the layout
  collapses to a vertical stack — still functional, but Scenarios 1–3
  read more naturally on a wide window.
- Boot the app to Bob's canvas (default role on a fresh boot).

---

## 2. Scenario 1 — Multi-RS Eval Result on PRM Claim (`erBobPrm`)

The richest annotation surface: two Assets, two Requirements Sets, and
the most rows. Best opening demo.

**Role:** Bob (GovCo).

**Setup**

1. **Switch to Bob** — open the user menu in the top-right; pick "Bob"
   if not already active. (Default role on first boot.)

**Navigation**

1. On Bob's canvas, find the Eval Result node attached to Alice's
   "Power Regulation Module Assembly" Claim. It sits in the Eval
   Results column, with a green/red SAT/UNSAT/MISSING minibar.
2. **Click** the Eval Result node → Detail Panel slides in.
3. **Click** the "Expand" action in the Detail Panel header.
4. The Output tab is the default; if not, **click** "Output".

**Expected outcome**

- Modal canonical header shows: `EVAL RESULT` badge, the result name,
  and a mono metadata line `Evaluated: YYYY-MM-DD · HH:MM UTC ·
  Evaluator: GovCo`.
- Side-by-side body: left panel ~60%, right panel ~40%.
- **Left panel:**
  - `ASSET` strip + filename (`microco-prm-datasheet.pdf`) + `◀ ▶`
    arrows + `Asset 1 of 2` counter.
  - PDF.js renders the datasheet (2 pages, fit-to-width).
  - Numbered rectangle indicators overlay the rendered text — labels
    `1`, `2`, `3` … (per Requirements Set, 1-indexed). Color-coded:
    one color for MIL-PRF-55681 Compliance, a different color for
    System Integration Requirements.
  - Below the PDF: a 6-row metadata card (Filename, Size, MIME, Hash,
    Owner, Registered).
- **Right panel:**
  - `EVALUATION RESULTS` strip + name + a 24×24 download icon at the
    right edge.
  - Aggregate summary + 3-segment SAT/UNSAT/MISSING minibar.
  - Per-RS results tables. Each row has a numbered indicator on the
    left matching the PDF dot.

**Try the interactions**

- **Asset switcher** — **click** ▶: PDF flips to
  `microco-prm-test-report.pdf` (Asset 2 of 2) with its own indicators.
  **Click** ◀: returns to the datasheet. Arrow buttons disable at
  boundaries.
- **Row click** — in the right panel, **click** any row indicator: the
  PDF scrolls to its corresponding indicator, the indicator picks up a
  3px ring in its RS color, the value's highlight rectangle bumps to
  30% opacity, the row gets a tinted background.
- **Indicator click** — in the PDF, **click** an indicator: the right
  panel scrolls to the matching row and applies the same highlight
  state.
- **Cross-Asset click** — **click** a row whose anchor lives on the
  OTHER Asset (e.g. row labeled in System Integration RS while the
  Datasheet is showing): the switcher auto-flips to the target Asset,
  then scrolls + highlights.
- **Download** — **hover** the download icon: tooltip "Download
  Evaluation Results JSON" appears within ~200ms. **Click**: a JSON
  file `eval-result-eval-bob-prm.json` (or similar id) downloads.

---

## 3. Scenario 2 — Single-RS Eval Result on VReg Claim (`erBobVreg`)

Multi-Asset, single-RS variant (Phase 15.3 update — was single-Asset
through Phase 15.2). Each requirement row carries anchors on both the
Datasheet and the Test Report so Asset-switching shows annotations in
both PDFs.

**Role:** Bob (GovCo).

**Navigation**

1. On Bob's canvas, find the **active** chain head Eval Result on
   Alice's "Voltage Regulator IC" Claim — the most recent one, not
   marked SUPERSEDED.
2. **Click** → Detail Panel → **click** Expand → Output tab.

**Expected outcome**

- Modal canonical header: `EVAL RESULT` + name + `Evaluated: ... ·
  Evaluator: GovCo`.
- Left panel: `ASSET` strip + `microco-vreg-datasheet.pdf` + `◀ ▶`
  arrows + `Asset 1 of 2` counter (Phase 15.3: VReg now has two
  pre-existing Assets).
- Indicators labeled `1` through `5`, all the same RS color
  (single-RS — MIL-PRF-55681 v1).
- Right panel: single per-RS results table.

**Try the interactions**

- **Asset switcher** — **click** ▶: PDF flips to
  `microco-vreg-test-report.pdf` (Asset 2 of 2) with the same five
  indicators on the test-report side (each requirement row has anchors
  on both Assets).
- **Row click** → PDF scrolls + highlights in whichever Asset hosts the
  primary anchor for that row. **Cross-Asset row click** → switcher
  auto-flips to the target Asset.
- **Indicator click** → results table scrolls + row highlights.
- Status `missing` rows have empty `evidenceAnchors[]` and render an
  empty indicator slot in the row — and no dot on the PDF for that row.
- Download icon works the same as Scenario 1.

The two `superseded` Eval Results in the VReg chain (V0 + V1) still
carry single-Asset anchors (datasheet only) — they predate the test
report Asset and weren't retroactively re-anchored. To inspect them,
open the chain-head's Detail Panel and use the supersession chain
navigation, or explore via the Provenance section in Scenario 3's PoE.

---

## 4. Scenario 3 — PoE Expand modal

Confirms the PoE Output tab inherits the eval-output layout cleanly.

**Role:** Bob (GovCo).

**Navigation**

1. On Bob's canvas, find the PoE node wrapping `erBobPrm`. It sits
   adjacent to the PRM Eval Result and has a different node visual
   (PoE chrome).
2. **Click** → Detail Panel → **click** Expand → Output tab.

**Expected outcome**

- Modal canonical header: `PROOF OF EVALUATION` badge + PoE name +
  mono line `Created: YYYY-MM-DD · HH:MM UTC · Owner: GovCo`.
- Body is structurally identical to Scenario 1 — same `ASSET` strip,
  same PDFs, same indicators, same `EVALUATION RESULTS` strip with
  download icon, same per-RS tables.
- Below the wrapped Eval Result, an "Evaluation Provenance" section
  lists the wrapped result's full supersession chain (oldest first,
  clickable rows).

**Try the interactions**

All Scenario 1 interactions work identically here. The download icon
exports the wrapped Eval Result's JSON (label is "Download Evaluation
Results JSON", not "PoE JSON"). The Provenance rows are clickable to
jump to specific Eval Results in the chain.

---

## 5. Scenario 4 — Run Evaluation re-run flow

The only scenario with a setup prerequisite. Confirms annotations
render inside the Run Evaluation modal Step 2/3 review surface (not
just the Expand modal).

**Roles:** Alice (MicroCo) → then Bob (GovCo).

### 5a. Prerequisite — Alice amends the VReg Claim

Why this is needed: the Re-Run gate from Phase 13.3 requires
`hasNewAssetsForRerun` — re-runs only unblock when new Assets have been
added since the prior evaluation. Without this prerequisite step, Bob's
"Re-Run Evaluation" button stays disabled.

1. **Switch to Alice** — open the user menu (top-right) → Switch User →
   Alice.
2. On Alice's canvas, find the "Voltage Regulator IC" Claim node.
3. **Click** the Claim → Detail Panel opens.
4. **Click** "Amend Claim" in the Detail Panel.
5. In the Amend Claim modal:
   - Add the **"Voltage Regulator IC Compliance Notes"** Asset
     (pre-seeded for this demo — Alice owns it but it isn't yet
     attached to the VReg Claim).
   - **Update the DA scope** to include the new Asset so Bob has full
     disclosure access.
6. **Save** the amendment. Alice's canvas updates; the Claim now
   references three Assets (Datasheet + Test Report + Compliance
   Notes).

**Why this Asset specifically:** Phase 15.3 pre-seeded the "VReg
Compliance Notes" Asset as Alice's owned-but-unattached Asset
specifically for this demo. Alice could add any of her unattached
Assets to satisfy the `hasNewAssetsForRerun` gate, but the Compliance
Notes Asset is named and positioned for this exact prerequisite — it
represents the kind of supplementary documentation Alice might attach
when expanding evaluation scope.

### 5b. Bob runs the re-run

1. **Switch to Bob** — user menu → Switch User → Bob.
2. On Bob's canvas, find the latest VReg Eval Result (now sitting on
   the amended Claim).
3. **Click** the Eval Result → Detail Panel.
4. **Click** "Re-Run Evaluation" in the footer (now enabled since new
   Assets exist).
5. Run Evaluation modal opens at Step 1. Requirements Sets are
   pre-selected (carried forward from the prior eval per Phase 13.3).
6. **Click** "Continue" → Step 2 opens.

**Expected outcome at Step 2**

- Left panel: Asset accordion with three Assets:
  - **VReg Datasheet** (originally in scope) — has annotation markers
    `1` through `5` from the prior evaluation.
  - **VReg Test Report** (originally in scope, Phase 15.3 addition) —
    has annotation markers `1` through `5` from the prior evaluation
    on the bench-measurement values.
  - **VReg Compliance Notes** (newly added by Alice in Step 5a) — no
    markers (no prior evaluation context — it's documentation that
    didn't exist when the prior Eval Result was authored).
- Right panel: parsed result rows inherited from the prior Eval Result
  ready for review, with the same numbered indicators on the left of
  each row.

**Try the interactions**

- **Click** any row indicator → PDF scrolls + highlights in whichever
  pre-existing Asset hosts the anchor (Datasheet or Test Report).
- **Cross-Asset row click** — if the accordion is showing the Datasheet
  and the user clicks a row primarily anchored to the Test Report (or
  vice versa), the accordion auto-flips its expanded Asset and scrolls
  there. The Compliance Notes Asset has no anchors so no row click
  routes to it.

Fresh evaluations triggered via "Run Evaluation" (not Re-Run) similarly
render PDFs without indicators on first opening — Phase 15 ships
read-only annotation rendering; live evaluator-driven anchor authoring
is a future feature.

---

## 6. Notes for QA + demos

### Known acceptable warnings

- **"Knockout groups not supported"** PDF.js console warning is
  cosmetic — a transparency-rendering limitation in pdfjs-dist v5, not
  a functional bug. Ignore.

### Behavior reminders

- **Asset switcher** only shows arrows when an Eval Result references
  more than one displayable Asset. Assets without a `localPath` (e.g.
  pre-Phase-15.0 placeholder Assets) don't count toward the switcher.
- **Annotation labels** are `{rowOrdinal}` only (Phase 15.1.1).
  Numbers are stable per row across Asset switches; RS color
  distinguishes which Requirements Set a row belongs to.
- **Indicator shapes** — rounded rectangles (32×22 in the PDF, 28×20
  in the right panel + Run Eval review rows), 12px mono bold label.
- **Highlighted state** — indicator gets a 3px ring in the RS color
  outside its 2px white border; highlight rectangle bumps from 15% to
  30% opacity; matching results-table row tints at 8% RS color.
- **Download icon** lives in the `EVALUATION RESULTS` strip (right
  panel). Tooltip "Download Evaluation Results JSON". Hover to read
  the tooltip; click to download. Filename: `eval-result-<id>.json`.

### Common gotchas

- **Stale Vite dev process** can serve cached pdfjs-dist bytes after
  `npm install` upgrades. If PDF rendering disagrees with the on-disk
  module version, run `lsof -i :5173` and kill any older Vite PIDs
  before debugging further.
- **PDF.js v5 `canvas` API** is required — the legacy `canvasContext`
  parameter still paints the canvas but the render-task promise never
  resolves. See the v15.0 phase log for the diagnosis history.
- **Status `missing` rows** carry empty `evidenceAnchors[]` arrays by
  design; their requirement renders no dot on the PDF and an empty
  indicator slot in the results table.
- **The `evidence` AssetNode subtype label** (V2.1 holdover) is
  unrelated to the Phase 15.1.2 EVIDENCE → ASSET title-bar rename —
  it labels a node-card subtype, not a modal title bar.
