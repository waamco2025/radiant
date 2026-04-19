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
- Perform a structured review against the phase's acceptance criteria before declaring the phase complete. Walk each criterion in the spec's Phase N section and verify it is met; surface any failures in the completion report.
- **Runtime verification is required.** Before declaring a phase complete, start the Vite dev server (`npm run dev`) and confirm the app actually loads with no console errors. Build success and pure-data sanity scripts are insufficient for React component changes — they don't catch TDZ errors, hook-rule violations, or other init-time exceptions. If a real browser isn't reachable, run a JSDOM render check that imports `src/v2/main.jsx` through esbuild and waits one tick after `createRoot(...).render(...)` to surface init-time exceptions (Three.js / WebGL errors are expected in JSDOM and don't count as failures).
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
- [x] Phase 2: Parent Layer Restructure
- [x] Phase 3: Edge Clickability + Agreement Panels
- [x] Phase 4: Combined Request + Response Flows
- [x] Phase 5: Evaluation Flow + Eval Results on Parent Layer
- [ ] Phase 6: Amendment Flows
- [ ] Phase 7: Directory Layer + AI Shopper

On phase completion, update this checklist and note any deviations from the spec in a phase completion comment.

### Phase 1 completion notes (2026-04-17)

- Split V2.2 data model into a new file `src/v2/v2_2Data.js` (spec §12.5 says v2Data.js "will grow substantially"; keeping V2.1 and V2.2 data side-by-side during migration is cleaner in separate files). `v2Data.js` is unchanged; `V2App.jsx` has two additions only: an import of `V2_2_ENABLED` and a conditional banner.
- Added the six §10 factories (`makeAsset`, `makeParseResult`, `makeClaim`, `makeDisclosureAgreement`, `makeEvaluationAgreement`, `makeEvaluationResult`) plus helpers per §12.5: `makeInternalDisclosureAgreement`, `makeProofOfEvalDisclosureAgreement`, `makePublicDirectoryDisclosureAgreement`. Also added a small `makeActor` helper for dataset bookkeeping.
- Shared artifact set (`buildV22SharedArtifacts`) seeds Bob, Alice, Carol, and the Radiant Network pseudo-actor; 7 Assets; 3 Parse Results; 3 Claims; 25 Disclosure Agreements (ownership, claim→asset refs, 3 explicit inter-party, 3 public-directory, 2 proof-of-eval, 2 eval-ownership); 3 Evaluation Agreements; 2 Evaluation Results (Bob's MIL-PRF result, Carol's audit result). This covers Story 1 and seeds Stories 2–3.
- View builders `buildAliceView`, `buildBobView`, `buildCarolView` are Phase 1 stubs — they return `{ actor, shared }` unfiltered; per-role filtering lands in Phase 2.
- Feature flag: `V2_2_ENABLED` in `v2_2Data.js`. Default is `false` (V2.1 behavior unchanged). Two ways to enable: flip `FORCE_V2_2 = true` in the file for local dev, or set `VITE_V2_2_ENABLED=true` in the env.
- **Schema resolution (post-review):** spec §10.4 was updated to replace the Disclosure Agreement's `claimId` field with `subject: { kind: 'asset' | 'claim' | 'evalResult' | 'parseResult', id }`. `makeDisclosureAgreement` + helpers and the seeded dataset were updated accordingly. See the spec §10.4 subject-assignment table for Phase 2's edge-derivation model.
- **Workflow note (post-review):** CLAUDE.md and the spec were updated to replace references to `/ultrareview` with "perform a structured review against the phase's acceptance criteria." Manual review remains the process.

### Phase 2 completion notes (2026-04-17)

- All V2.2 rendering work landed in `src/v2/v2_2Data.js` (role-filtered views, edge derivation, canvas adapter with layout), `src/v2/V2App.jsx` (roleData branch on `V2_2_ENABLED`, short-circuit of the V2.1 merge pipeline in V2.2 mode), and `src/v2/AssetNode.jsx` (type-label badge in the full card and mini card).
- **Role filtering** (`buildViewForActor`): owner sees own Assets, Claims, Parse Results, and Eval Results; pulled-in Claims appear on grantee's canvas via paired DA + EA; counterparty Assets are asymmetric per §6.1 vs §6.4 — the grantee-side anchor (`granteeAssetId`) is pulled in on the grantor's canvas, but the grantor's individual Assets are NOT pulled in on the grantee's canvas.
- **Edge derivation** (`deriveAgreementEdges`): single algorithm walks DAs and emits Agreement Edges per spec §10.4 subject-assignment table. Each edge carries `{ from, to, sdaType, disclosureAgreementId, pairedEvaluationAgreementId }` — `pairedEvaluationAgreementId` is populated when an EA references the DA, wiring Phase 3's edge menu.
- **Canvas adapter** (`buildV22Canvas`): converts view → `{ nodes, edges, nodeMap }` with deterministic column-based layout. Claim health rollups and Eval Result health minibars computed from evaluation results, excluding `na` rows per §3.5. `v22Type` and `v22Artifact` fields added to each node.
- **AssetNode.jsx type labels**: small mono badges (`ACTOR`, `ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`) rendered inline before the node name in both full-card and mini-card views. Hidden for V2.1 nodes (absent `v22Type`), so V2.1 rendering is visually unchanged.
- **V2App**: `roleData` branches on `V2_2_ENABLED`; when true, the V2.1 merge/roll-up useMemo short-circuits and passes the pre-built `{ nodes, edges, nodeMap }` straight through. `pendingRequests` and `existingCascades` are empty arrays in V2.2 mode (phase 4+ features).
- **Known scope boundaries (not bugs):** edge clicks still follow V2.1 behaviour (Phase 3); the existing Detail Panel may render unfamiliarly for Parse Result / Eval Result parent-layer nodes until Phase 3; modal actions triggered from V2.2 node footers will open V2.1 modals that are not wired to V2.2 state — those rewires come in Phase 4+.

### Phase 3 completion notes (2026-04-17)

- **Pre-Phase-3 adjustments folded in:**
  - *Orphaned Eval Result ownership:* `buildViewForActor` grew a second-pass inclusion for counterparty internal DAs whose endpoints are all visible on the actor's canvas. Today it applies to Eval-Result ownership DAs (subject=evalResult + scope.assetIds non-empty). Concretely: Alice's canvas now renders `erBobPrm ↔ asset-bob-avionics` and `erCarolPrm ↔ asset-carol-audit-workspace` ownership edges in addition to the Proof-of-Evaluation edges, resolving the "orphaned Eval Result" feedback without adding a new edge type or pulling in counterparty Actor nodes.
  - *Multi-line node label:* `v22Type` badge moved to its own line (Row 0) above the name on the full card; mini-card title stacks the badge above the name vertically. Name is no longer truncated by the inline badge.
- **Phase 3 proper:**
  - `V2Canvas.jsx`: `selectedEdgeId` + `onEdgeClick` props. `handleBackgroundClick` raycasts against the edge group; if a line hits, it emits `onEdgeClick(edgeId, { x, y })`. A dedicated `useEffect` applies the §4.4 selected-edge treatment (40% white blend + 0.5px stroke) by mutating existing edge materials, so no buildEdges refactor was needed.
  - `src/v2/EdgeMenu.jsx` (new): portal-rendered contextual menu anchored at click coords. Offers "View Disclosure Agreement" (always) and "View Evaluation Agreement" (when paired). Closes on outside click, Escape, or item select. Viewport-clamped positioning.
  - `src/components/DetailPanel/DisclosureAgreementDetailPanel.jsx` (new): slide-over panel at zIndex 55. Header label branches across Internal / Proof-of-Evaluation / Public-Directory / inter-party variants per §4.1. Renders Parties, Subject, Grantee Anchor, Type & Scope, Terms, Status, Amendments count. "View paired Evaluation Agreement →" quick-jump when paired. Amend action in footer, enabled only when `activeParty === grantor.party`.
  - `src/components/DetailPanel/EvaluationAgreementDetailPanel.jsx` (new): same structure, renders §10.5 fields (authorized requirements sets, restrictions, terms, incentives) and quick-jumps back to the paired DA.
  - `resolveAgreementsForEdge(edgeId, view, edges)` in `v2_2Data.js`: single lookup that returns `{ edge, disclosureAgreement, evaluationAgreement }`.
  - V2App wiring: tracks `selectedEdgeId`, `edgeMenu`, `openAgreement`. Clears edge selection when a node is selected (§4.4). Amend callbacks are stubs with a Phase 6 comment — the buttons are surfaced per acceptance criterion but do not yet mutate state.
- **V2.1 mode regression check:** `onEdgeClick` is only passed to V2Canvas when `V2_2_ENABLED` is true; `handleBackgroundClick` short-circuits edge hit-testing when the prop is absent. V2.1 background-click → deselect behaviour is unchanged.
- **Ambiguity resolved during Phase 3:** on Alice's canvas, should Carol's ownership of her Eval Result be conveyed via a pulled-in Carol Actor node or via the existing eval-ownership DA's edge? Chose the latter (no new node, no new edge type, pre-existing DA, both endpoints already visible) rather than the former (violates §6.4's "counterparty internals are private" spirit). Documented as the second-pass inclusion rule.

### Phase 4 completion notes (2026-04-18)

- **Pre-Phase-4 bug fixes (folded in):**
  - *Bug 1 — Parse Result → source Asset edges missing:* added a `parseResultRefEdges` seeding block in `buildV22SharedArtifacts` (one DA per parse result, subject={kind:'parseResult', id:pr.id}, scope.assetIds=[pr.sourceAssetId]). Extended `deriveAgreementEdges` to handle `subject.kind='parseResult'` with scope.assetIds, and added parse-result IDs to `isRenderable`. Alice's canvas now shows 3 new edges (parse → source asset).
  - *Bug 2 — Selected-edge invisible on dashed/dotted lines:* spec called for 40% white blend + 0.5px stroke, but those values were imperceptible on amber/green dashed lines against the dark canvas. Bumped to 65% white blend + 1.5px stroke. Visible across all four disclosure types.
  - *Bug 3 — Selection race:* the reactive effect that watched `[sel, selectedEdgeId]` to enforce mutual exclusion was firing on the user's NEXT edge click (after a node was already selected), wiping the fresh edge state in the same render. Removed the effect; replaced with explicit clears inside the `handleSelect`, `onEdgeClick`, and `handleCloseSel` paths. Bug repro (edge → node → edge) now succeeds; background clicks now also deselect edges.
- **Phase 4 proper:**
  - `src/components/modals/CombinedRequestModal.jsx` (new): single-step flow — PIN input with live resolution (✓ found / not found / self-owned errors), optional Requirements Sets multi-select, optional message, "Send Request" footer button. Inherits Backdrop/Modal/ModalHeader/Body/Footer/Btn/FieldLabel from V2.1's ModalShared.
  - `src/components/modals/CombinedResponseModal.jsx` (new): inherits V2.1's four-card type grid (Full / Selective / Proof-Only / Decline) via `DecisionCard` from ModalShared. Step progression: Type → (scope or decline reason) → EA terms (authorized req sets + expiry via `ExpiryPicker`) → Review. Decline path skips to the reason step. All step transitions guarded by per-step validation.
  - `src/v2/v2_2Data.js`: added `mergeProvisionals`, `getV22DataForRole(roleId, provisionals)` overload, `resolveClaimByPinInShared`, `makeProvisionalAgreementPair`, `finalizeProvisionalAgreementPair`. View builder now computes `provisionalClaimIds` and `provisionalAssetIds`. Adapter marks pulled-in nodes with `isProvisional: true` and appends `· PROVISIONAL` to `v22Type`.
  - `src/v2/V2App.jsx`: added `v22Provisionals`, `v22RequestOpen`, `v22RespondingTo`, `v22RecentlyAcceptedClaimId` state. `handleV22RequestSubmit` / `handleV22Accept` / `handleV22Decline` callbacks. "Request Agreement…" button in V2.2 banner. Reveal animation triggered via existing `_isNew` flag pipeline for ~900ms after acceptance.
  - `src/components/DetailPanel/DisclosureAgreementDetailPanel.jsx`: footer button label/colour adapt for provisional DAs ("Respond to Request" amber for grantor; "Awaiting Response" disabled for grantee).
- **Spec-vs-implementation note:** §7.1 step 1 calls for the Request flow to launch from "Bob's Asset's Detail Panel footer." For Phase 4 I anchored the entry point to the V2.2 banner's "Request Agreement…" button (always visible, deterministic asset selection) to avoid touching V2.1's PanelShell action footer mid-migration. Fold in the Asset-panel entry point in Phase 5+ when DetailPanel hardening for V2.2 nodes lands.

### Phase 5 completion notes (2026-04-18)

**Spec § update (§4.4):** revised the selected-edge values from the Round 11 spec defaults (40% white blend, +0.5px stroke) to the values shipped in Phase 3/4 (65% blend, +1.5px stroke). The spec entry now documents the change and the rationale (visibility on dashed/dotted edges).

**Andrew's six Phase 5 additions (folded in alongside Phase 5 own scope):**
1. *Per-Asset request entry point.* `V22NodeDetailPanel.jsx` (new) renders an Asset panel with a "Request Agreement" footer button for owners. V2App stamps the Asset as the request anchor and pre-populates the modal. The banner button is retained as a secondary entry point; it remains useful when no specific Asset is selected and disambiguates "I want to request something but don't have an anchor in mind yet."
2. *Multiple Asset demo data.* Added Bob's Guidance Computer + Thermal Subsystem (3 Bob assets total) and Carol's Compliance Audit Queue (2 Carol assets total). The Avionics anchor's existing inter-party DAs no longer block end-to-end testing of Phase 4's response flow.
3. *Provisional "Awaiting Response" Detail Panel state.* `V22ClaimPanel` branches on `node.isProvisional` — header amber AWAITING RESPONSE badge, request metadata section (requester, anchor, date, suggested req sets, message), CTA = "Respond to Request" for the grantor or "Cancel Request" for the grantee. New handler `handleV22CancelRequest` mirrors decline but is initiated by the requester.
4. *Notification on accept/decline.* `enqueueV22NotificationForRequester` adds an entry to the requester's `perRoleState.addedRequests`. The existing V2.1 inbox UI surfaces ACCEPTED / DECLINED badges and the deep-link click pans to the Claim node and opens its panel.
5. *"Disclosure Declined" surface (§11.4).* `makeDeclineRecord` + new `declineRecords` field in `v22Provisionals`. View builder includes declined claims as visible nodes with `isDeclined`. `V22ClaimPanel` declined branch shows decline reason in a red-bordered panel + "Dismiss" CTA. `handleV22DismissDeclined` removes the record.
6. *NEW badge + pan-to-node.* `setV22PanToClaimId` triggers `canvasRef.current.panToWithZoom`; `setV22RecentlyAcceptedClaimId` tags `_isNew` on the claim node for ~900 ms. Fires for both initial provisional creation and post-accept activation, reusing V2.1 reveal infrastructure.

**Phase 5 own scope:**
- New helpers in `v2_2Data.js`: `makeDeclineRecord`, `makeEvaluationRunArtifacts` (returns Eval Result + Proof-of-Eval DA + ownership DA + optional supersededPriorResult), `findPriorActiveEvaluationResult`. `mergeProvisionals` extended for `evaluationResults` + `declineRecords`.
- New modal `V22RunEvaluationModal.jsx`: split-panel (evidence left / rows right), shared `ConfidenceBadge` palette matching V2.1, shared `ReviewRow` component shape. Status cycling SAT → UNSAT → MISSING → N/A on click. Restricts library to EA-authorized req sets. Surfaces a SUPERSEDE warning when a prior active result with the same Req Set lineage exists.
- New Detail Panel router `V22NodeDetailPanel.jsx` (Asset / Claim / Parse Result / Eval Result). Eval Result panel shows status badges, supersede metadata, and a Re-run Evaluation footer for owners.
- Supersede semantics: same Req Set lineage → prior result's `status` flips to 'superseded' and `supersededBy` links to the new id. Health rollups in the canvas adapter exclude `status === 'superseded'` per spec §3.5. Different Req Set produces an independent active result.

**Known scope boundaries (not bugs):**
- *No V2.2 Parse Evidence modal yet.* Spec §13 Phase 5 calls for "Parse and Eval modals look and feel nearly identical when viewed side-by-side." The eval modal is built with the structural shape that the parse modal will inherit (same split-panel, same ReviewRow, same ConfidenceBadge). A V2.2 parse modal can drop in trivially when needed; it isn't required for the Phase 5 Story 1 walkthrough.
- *Run Evaluation entry from EA edge panel.* Spec uses an OR ("from an Agreement Edge or from Alice's Claim footer"). I shipped the Claim-footer entry point. Adding to the EA panel is a natural Phase 6+ polish.
- *Pan-to-zoom level.* Picked `zoom = 1.0` for the post-creation pan; V2.1's typical post-create zoom is 1.28. Cosmetic — adjust on visual review.

### Phase 5 hotfix (2026-04-18) — TDZ post-mortem

- **Symptom:** App crashed on load in V2.2 mode with `ReferenceError: Cannot access 'updateRoleState' before initialization` at V2App.jsx:124.
- **Root cause:** During Phase 5 I inserted the V2.2 handler block (lines 115–366: `enqueueV22NotificationForRequester`, `handleV22RequestSubmit`, accept/decline/cancel/dismiss/run-eval handlers, plus the pan-to-node `useEffect`) BEFORE the declaration of `updateRoleState` (line 395). The `useCallback(..., [updateRoleState])` deps array is evaluated at render time → temporal-dead-zone error.
- **Fix:** Relocated the entire handler block to immediately after `updateRoleState` is declared. State setters the handlers also reference (`setSelectedEdgeId`, `setOpenAgreement`, `setEdgeMenu`) were already declared earlier so no further moves were needed.
- **Verification additions baked into the workflow (above):**
  1. Ran a static scan over `V2App.jsx` checking that every `useCallback` / `useMemo` / `useEffect` deps array references only identifiers declared earlier in the function body. Now part of the pre-completion checklist.
  2. Ran a JSDOM render check (`createRoot(...).render(<V2App/>)` after esbuild-bundling the entry, with `sessionStorage`/`localStorage`/`navigator` stubs) and asserted no `uncaughtException` / `unhandledRejection` fires within 250ms of mount, in BOTH `V2_2_ENABLED=true` and `V2_2_ENABLED=false`. Three.js/WebGL errors are expected in JSDOM and do not count as failures.
  3. Confirmed the V2.2 Phase 5 runtime call chain (provisional → accept → run-eval → decline) executes against the data layer without throwing.
- **Lesson surfaced for future phases:** build success + pure-data sanity scripts are insufficient verification for React component changes. The runtime check above is now the floor for any phase that touches `V2App.jsx`.
