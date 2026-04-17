# Radiant by Provenance — Repository Operating Manual

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`.

**Commands:**
- `npm run dev` — development server
- `npm run build` — must pass clean before any phase is complete

---

## Current Target: V2.2

All active development follows `v2.2-architecture-migration-spec.md` in the repo root. **That spec is the single source of truth** for what V2.2 is and how to build it. Read it first; return to this file only for repo conventions.

V2.2 introduces two core corrections to V2.1: (1) Assets are distinct from Claims and exist as first-class parent-layer nodes, (2) Evaluation Agreements gate Claim visibility between parties. See spec §1 for the full summary.

### Feature flag

- `V2_2_ENABLED` controls which mode renders.
  - `false` (default during migration) → V2.1 behavior, unchanged.
  - `true` → V2.2 behavior per the spec.
- V2.1 code paths remain functional until Phase 7 completes. Do not delete V2.1 code during the migration.

### File layout

- `src/v2/` — active V2.1 and V2.2 code. All migration work happens here and in `src/components/`.
- `src/v3/` — archived V3 (reference for UI patterns only, not active).
- V1 files (`src/App.jsx`, `src/data/`, `src/components/Header.jsx`, etc.) — archived, delete after Phase 7.
- `tokens.js`, `index.css` — shared across versions.
- Entry points: `/v2.html` (primary), `/v3.html` (reference), `/index.html` (archived V1).

### V2.1 conventions reference

For components carrying forward unchanged from V2.1 (roughly 80% of the codebase — canvas, boot, modal framework, notifications, child layer mechanics), V2.1 conventions still apply. See `CLAUDE-v2.1-archive.md` for the full V2.1 doc.

---

## Forbidden Changes (from spec §14.3)

Do not, without explicit approval:

- Add new node types beyond spec §3.
- Add a second edge type — the Agreement Edge is the only edge type. Do not introduce separate Ownership, Proof-of-Evaluation, or Public Directory edge types; those are all modeled as implicit Disclosure Agreements on the same edge primitive.
- Change the data model in `v2Data.js` beyond what spec §12.5 specifies.
- Alter the boot sequence.
- Alter child layer dive/surface behavior or delete child layer code. The child layer is intentionally retained but unused in V2.2 (see spec §5).
- Remove or substantially rework the notification system.
- Unify Parsing and Evaluating processes in V2.2. That's §17.1 future work; for V2.2, maintain them as separate processes with structurally identical UI.

---

## Working Conventions

### Autonomous workflow

- Work at `xhigh` effort.
- Run `/ultrareview` before declaring a phase complete.
- When you hit a genuine ambiguity (an actual contradiction between spec sections, or a missing piece of information you need to make a correct decision), **stop and surface it.** Do not guess.
- Review happens at phase boundaries, not mid-phase. Andrew reviews completed phases against their acceptance criteria.

### Code style

- CSS variables always; never hardcode colors. Use `color-mix()` for alpha blends.
- SVG icons only. Unicode symbols (✓, ×, ▸, ◂, ■, ◆, ◇) are acceptable. No emojis.
- Timestamps use `date` + `dateTime` fields. Display format: `YYYY-MM-DD · HH:MM UTC`.
- Escape key handling: input/textarea focused → blur only; editor mode → exit to view; nothing focused → close modal.
- Click-to-copy on all PIN displays with visual feedback.
- No category labels on node cards (PRODUCT, PROCESS, etc.). Type labels (`ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`) in mono font, informational only — see spec §3.

### Demo actors

- **Bob Donloe** @ GovCo (buyer) — DOT: `DONLOE.BOB.J.1384297560`
- **Alice Nakamura** @ MicroCo (supplier)
- **Carol** @ AuditCo (auditor) — added in V2.2
- Role switching via user menu; does not replay boot animation.

### Boot sequence

CAC login → Prime Radiant 3D → golden ripple → network build animation. Session storage key: `radiant-v2-booted`. Shared across V2.1 and V2.2.

---

## Phase Status

Track progress here as phases complete. Format: `[ ]` pending, `[x]` complete, `[~]` in progress.

- [x] Phase 1: Data Model Foundation
- [ ] Phase 2: Parent Layer Restructure
- [ ] Phase 3: Edge Clickability + Agreement Panels
- [ ] Phase 4: Combined Request + Response Flows
- [ ] Phase 5: Evaluation Flow + Eval Results on Parent Layer
- [ ] Phase 6: Amendment Flows
- [ ] Phase 7: Directory Layer + AI Shopper

On phase completion, update this checklist and note any deviations from the spec in a phase completion comment.

### Phase 1 completion notes (2026-04-17)

- Split V2.2 data model into a new file `src/v2/v2_2Data.js` (spec §12.5 says v2Data.js "will grow substantially"; keeping V2.1 and V2.2 data side-by-side during migration is cleaner in separate files). `v2Data.js` is unchanged; `V2App.jsx` has two additions only: an import of `V2_2_ENABLED` and a conditional banner.
- Added the six §10 factories (`makeAsset`, `makeParseResult`, `makeClaim`, `makeDisclosureAgreement`, `makeEvaluationAgreement`, `makeEvaluationResult`) plus helpers per §12.5: `makeInternalDisclosureAgreement`, `makeProofOfEvalDisclosureAgreement`, `makePublicDirectoryDisclosureAgreement`. Also added a small `makeActor` helper for dataset bookkeeping.
- Shared artifact set (`buildV22SharedArtifacts`) seeds Bob, Alice, Carol, and the Radiant Network pseudo-actor; 7 Assets; 3 Parse Results; 3 Claims; 25 Disclosure Agreements (ownership, claim→asset refs, 3 explicit inter-party, 3 public-directory, 2 proof-of-eval, 2 eval-ownership); 3 Evaluation Agreements; 2 Evaluation Results (Bob's MIL-PRF result, Carol's audit result). This covers Story 1 and seeds Stories 2–3.
- View builders `buildAliceView`, `buildBobView`, `buildCarolView` are Phase 1 stubs — they return `{ actor, shared }` unfiltered; per-role filtering lands in Phase 2.
- Feature flag: `V2_2_ENABLED` in `v2_2Data.js`. Default is `false` (V2.1 behavior unchanged). Two ways to enable: flip `FORCE_V2_2 = true` in the file for local dev, or set `VITE_V2_2_ENABLED=true` in the env.
- **Open question surfaced for Phase 2:** ownership Disclosure Agreements (Actor → Asset) use the asset's own id as `claimId` since §10.4 schema marks `claimId` as required but no Claim exists for a bare-asset ownership relationship. Phase 2's edge-derivation layer may need a different convention (e.g., allow nullable `claimId` for pure ownership DAs).
- **Note on workflow:** `/ultrareview` is referenced in CLAUDE.md and the spec but is not defined as a slash command in this workspace or user-level commands. Phase 1 review was performed manually against the §13 acceptance criteria.
