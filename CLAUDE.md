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
- [x] Phase 6: Amendment Flows
- [x] Phase 7: Directory Layer + AI Shopper

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

### Phase 6 completion notes (2026-04-18)

**Nine Phase 5 carry-over fixes folded in:**
1. *EA authorization is advisory, not enforced.* Spec §10.5 updated; `CombinedResponseModal`'s "Authorized Requirements Sets" step removed (the response flow is now 4 steps for accept paths: Type → Scope → Terms (expiry only) → Review); `V22RunEvaluationModal` no longer filters the library by `authorizedRequirementsSetIds`; the original suggestions surface as a `SUGGESTED` chip. The EA field still stores the suggestions for context.
2. *`CombinedRequestModal` anchor prop.* V2App now passes `v22RequestAnchor` (the clicked Asset) as `requesterAsset`, falling back to the first owned Asset only for the banner entry.
3. *Pan-to-node + NEW badge on provisional creation.* The adapter sets `_isNew: true` on provisional Claim nodes so the NEW badge persists for the whole provisional duration; `setV22PanToClaimId(claim.id)` pans to the new provisional node on the requester's canvas.
4. *Duplicate PROVISIONAL / DECLINED / SUPERSEDED tags.* The adapter no longer appends `· PROVISIONAL` / `· DECLINED` suffixes to `v22Type`, and eval results use a bare `'EVAL RESULT'` label regardless of superseded status. Separate inline badges in `AssetNode.jsx` are the single source of truth.
5. *Provisional nodes stay off the grantor's canvas.* View builder skips pull-in when `da.type === 'provisional'`; the grantor sees the request only as a `'v22-request'` notification until they accept.
6. *Notification-driven response flow.* `handleV22RequestSubmit` now enqueues a `'v22-request'` notification on the grantor's inbox; the notification click handler dispatches to `setV22RespondingTo({ daId })`, opening the `CombinedResponseModal` directly. Accept/decline auto-dismiss the original `'v22-request'` entry.
7. *Proof-Only requires Eval Result scope selection.* New Step 2 branch in `CombinedResponseModal` lists `evalResultsForClaim` with a toggle picker; when none exist, an informational message suggests switching to Full or Selective. `buildScope()` returns `evaluationResultIds: [...selectedEvalResultIds]`.
8. *"Run Evaluation" button.* Renamed from "Save Evaluation". `canSubmit` no longer requires evidence selection; rows initialize from `requirementSet.requirements` (the V2.1 req-set shape — previously the modal looked for `claims` which is why the button stayed disabled).
9. *Legacy Connect Asset path.* `V2Canvas`'s `onConnect` prop is now `V2_2_ENABLED ? undefined : ...`; `RequestDisclosureModal` and `DisclosureResponseModal` mounts are guarded with `!V2_2_ENABLED`. In V2.2 mode, the per-Asset entry is exclusively the `V22AssetPanel`'s "Request Agreement" footer button.

**Phase 6 own scope (spec §13):**
- `AmendClaimModal.jsx` (new): Alice picks additional Assets she owns and appends them to a Claim's `referencedAssetIds`. The factory helper `makeAmendedClaim` also generates new internal claim-ref DAs so the new Asset → Claim edges render.
- `AmendDisclosureModal.jsx` (new): Alice adjusts a DA's scope. Behaviour branches on `da.type` (assets for Full / parse fields for Selective / eval results for Proof-Only). §11.2 enforcement: items already evaluated (via `er.evidenceUsed` for assets / `er.id` for eval results) are pre-selected and locked with a `not-allowed` cursor + `EVALUATED` badge.
- Cross-role amendment notification. `handleV22AmendDisclosureSubmit` enqueues a `'v22-amendment'` entry on the grantee's inbox; click deep-links to the Claim on the grantee's canvas and pans to it.
- Self-evaluation flow. Owner clicks `Self-Evaluate` on their own Claim panel footer → `V22RunEvaluationModal` opens in self-eval mode (no EA context, library shows all Req Sets, no SUGGESTED chips). The resulting Eval Result + internal proof-of-eval DA + ownership DA are added to `v22Provisionals`; `deriveAgreementEdges` grew a new branch for internal-proof-of-eval edges (self-eval renders visually identical to non-self proof-of-eval).
- `V22ClaimPanel` footer is owner-aware: for the Claim's owner → `Amend Claim` + `Self-Evaluate`; for a counterparty with an active EA → `Run Evaluation`.
- `DisclosureAgreementDetailPanel`'s Amend button now branches: provisional + grantor → response flow; active + grantor → `AmendDisclosureModal` via `setV22AmendingDaId`.

**Runtime verification (both modes):** JSDOM render harness passes for `V2_2_ENABLED=true` and `V2_2_ENABLED=false`; no init-time exceptions. Phase 6 data-layer sanity script covers: provisional-stays-off-grantor, adapter badge dedup, eval run + supersede (7 SAT 1 UNSAT rollup), amend-claim edge generation, amend-DA scope replacement, self-eval proof-edge rendering.

**Spec updates folded in:**
- §10.5 — `authorizedRequirementsSetIds` documented as advisory / informational.

**Polish-backlog:** items #10, #21, #22, #23 moved to ✅ Complete.

**Known gaps (not Phase 6 blockers):**
- *Published standards seed.* Self-evaluation works against any of Alice's existing Requirements Sets. A dedicated "OSHA" mock set in the published standards library is a seeding follow-up — the flow doesn't require it.
- *Pan-to-Eval-Result after self-eval.* Pan still targets the Claim, not the new Eval Result. Cosmetic.
- *Amend Claim from a Claim that lives on a pulled-in counterparty canvas.* Only owners see the Amend button (rendered conditionally), which is correct.

### Phase 6.5 completion notes (2026-04-19) — bug-fix pass

End-to-end review against Andrew's numbered list (#1–17) after the Phase 6 commit (6800bf9). Thirteen fixes folded in; items #34 (inline "Register new Asset" in Amend Claim), #35 (edge-draw animation for new Amend Claim refs), and #36 (Option B — pull disclosed Assets onto grantee canvas) deferred to the polish backlog.

1. *#3 Declined artifacts persist instead of being deleted.* `handleV22Decline` no longer removes the provisional DA/EA; it annotates them with `_declineMeta` + `_declined` so the synthetic edge from Bob's anchor Asset to Alice's Claim persists in DECLINED state until the requester explicitly dismisses. `handleV22DismissDeclined` strips the annotations as a pair. `buildViewForActor` derives decline state from annotated DAs. Decline takes precedence over "awaiting response" in `provisionalClaimIds`. Spec §11.4 was rewritten accordingly (see spec changelog entry).
2. *#4 Grantor-side reveal on acceptance.* `handleV22Accept` now also tags the grantee's anchor Asset with `_isNew` on the grantor's canvas and pans there; previously only the grantee's canvas got the post-acceptance reveal. New `v22RecentlyAcceptedAssetId` state threads through `v22DataWithReveal`.
3. *#5 Eval-modal evidence resolution (Option A).* Counterparty Assets aren't pulled onto Bob's canvas today, so the V22RunEvaluationModal mount in V2App resolves evidence Assets by unioning `buildV22SharedArtifacts().assets` with `v22View.assets`, filtering to the DA's `scope.assetIds`. Option B (update `buildViewForActor` to pull disclosed Assets onto grantee's canvas) is the architecturally consistent counterpart and deferred to polish-backlog item #36.
4. *#6 Evaluation-completed notification (new `v22-evaluation` type).* `handleV22EvaluationSubmit` enqueues a notification on the Claim owner's inbox with `supersedesPriorResultId` + `requirementsSetName`. V2App's notification renderer adds an `isV22Evaluation` branch (badge label EVALUATED / RE-EVALUATED), and the click handler deep-links to the new Eval Result node.
5. *#7 Inert "Connect Asset" button hidden in V2.2 mode.* `AssetNode.jsx`'s `handleCreateAsset` gates on `typeof onConnect === 'function'`; V2Canvas passes `onConnect={undefined}` when `V2_2_ENABLED`, so the "+" plus-button no longer renders on V2.2 Asset cards.
6. *#8 `v22-request` notification persists until terminal action.* Click on the request notification opens the response modal but does NOT dismiss the notification; dismissal now happens inside `handleV22Accept` / `handleV22Decline` via explicit `dismissedReqs` push. Accidental modal close no longer loses the request.
7. *#9 Amend Claim shows already-referenced Assets as read-only cards.* `AmendClaimModal` replaced the "{N} Assets already referenced" text line with rendered read-only Asset cards, so Alice can see what's already on the Claim while picking additions.
8. *#11 Full Disclosure Asset checklist.* `CombinedResponseModal`'s Step 2 Full branch is now a selectable checklist (was a read-only display that auto-included all Claim-referenced Assets). `buildScope()` returns `selectedAssetIds`; `canAdvanceFromStep2Accept` requires ≥1 Asset. Polish-backlog item #37 captures the last-Asset deselect inline help polish.
9. *#12 Amendment pan + reveal.* `handleV22AmendDisclosureSubmit` and `handleV22AmendClaimSubmit` now pan to the amended Claim and set `_isNew` via the existing reveal infrastructure.
10. *#13 Banner z-index.* V2.2 banner dropped to `zIndex: 10` so the notification dropdown (z-index 200) renders above it.
11. *#16 Counterparty referenced-Asset filtering in the Claim Detail Panel.* When a non-owner opens a Claim panel, the referenced-Asset list is filtered to only those in-scope under an active DA where the viewer is grantee. Prevents leaking private reference names.
12. *#17 Eval Result row offset.* Eval Result nodes now render with `EVAL_ROW_OFFSET = ROW_STEP / 2` to avoid edge-path collision with the Claim ↔ Asset row.
13. *Also included:* pendingRequests pass-through to the notification inbox (was hardcoded `[]`), self-evaluation plumbing (`handleV22OpenSelfEvaluation`), and cross-role amendment notification wiring. These were Phase 6 carry-overs surfaced during the 6.5 review.

**Spec updates folded in during Phase 6.5:**
- §6 — new §6.5 "Cross-canvas pull-in rules" codifying counterparty internal DA inclusion, provisional non-pull-in, and the post-acceptance reveal on both canvases.
- §7.1 — request flow anchored at the Asset Detail Panel footer (primary) + banner (secondary); provisional node now described as requester-canvas-only with notification delivery to the grantor.
- §7.4 (new) — notification types (`v22-request`, `v22-amendment`, `v22-evaluation`) with delivery + persistence semantics.
- §10.4 — new Parse Result → source Asset row in the subject-assignment table (the pre-Phase-4 bug fix formalised).
- §11.4 — decline retention with `_declineMeta` annotation (replacing the prior "both artifacts deleted" rule).
- §12.6 (new) — demo dataset composition, including Bob's 3 Assets (Avionics, Guidance Computer, Thermal Subsystem) and Carol's 2 Assets (AuditCo Workspace, Compliance Audit Queue).

**Polish-backlog:** items #34, #35, #36 added for deferred 6.5 review points.

**Runtime verification:** JSDOM render harness + Phase 6.5 data-layer sanity script covering: decline-retain + dismiss-strip symmetry, v22-evaluation notification wiring, Full checklist ≥1 guard, counterparty Detail-Panel filter, Asset eval-evidence resolver falling back to shared dataset.

### Phase 6.5+ completion notes (2026-04-19) — visual-review pass

Second review iteration against Andrew's numbered list (#1–11) after Phase 6.5 landed. Eight fixes folded in; items #37 (last-Asset deselect inline help), #38 (full-word status cycling + prior-lineage pre-fill + AI confidence chip), #39 (decline dismiss ravel-out animation), #40 (node-card action button audit), #41 (PDF viewer in eval modal), and #42 ("Re-Evaluate" entry on Eval Result panels) deferred to the polish backlog.

1. *#2 DECLINED inline badge renders.* The canvas adapter now sets both `isDeclined` (V2.2-side state) and `_isDeclined` + `_declineReason` (underscore-prefixed, which V2.1 `AssetNode` badge rendering reads). Previously the PROVISIONAL badge was winning the precedence race. DECLINED is documented as outranking PROVISIONAL in spec §3.
2. *#3 Decline-notification animated pan.* Clicking the DECLINED notification now selects + `animatedPanToWithZoom`s to the node instead of a bare `setSel` with a 100ms delay.
3. *#4 ACCEPTED / amendment notification pan.* Notification click now always `animatedPanToWithZoom(target, 1.28)` to the target node. Previously computed a midpoint toward a paired node at zoom 0.7, which felt under-panned.
4. *#5 Panel-compensated pan (no secondary jump).* The pan-to-node effect now pre-applies the exact `panelWidth` + `containerHeight` offset that V2Canvas's selection-pan uses, so the initial animated pan lands where the selection-pan would have landed. Eliminates the "re-adjust after animation completes" hop. Also added explicit `setSel` before every `setV22PanToClaimId` call across handlers to keep selection in sync with pan.
5. *#6 Run Evaluation duplicate detection + "Re-Evaluate" jump-to-existing.* `V22RunEvaluationModal` now takes `existingEvalResults` + `onJumpToExistingEvalResult` props. On Req Set selection + evidence selection, the modal detects a `(Req Set, evidence Set)` exact match against an existing active result, blocks submission, and surfaces a "View it on the canvas →" link. V2App feeds filtered non-superseded results to the modal and wires the jump. Different evidence on same Req Set → supersede path (unchanged); different Req Set → new active result (unchanged).
6. *#7 Amend Disclosure submit guard.* `AmendDisclosureModal` blocks submit when the active scope dimension (assets / fields / evalResults per DA type) is empty.
7. *#8 Run Evaluation staged flow.* Modal converted from single-pane to a 3-stage flow (select Req Set + evidence → processing stage with PrimeRadiant + progress bar → review rows), mirroring the Parse modal shape. Footer surfaces the specific reason "Run Evaluation" is disabled. Evidence list messaging updated ("will run without evidence (self-attestation)" when zero selected).
8. *Long-PIN truncation in Agreement panel headers.* `DisclosureAgreementDetailPanel`, `EvaluationAgreementDetailPanel`, and `V22NodeDetailPanel` each get a `CopyBadge value={...} truncated` one-line fix so long agreement PINs no longer break the header layout.

**Spec updates folded in during Phase 6.5+:**
- §3 — state badges: type label on own line above name; PROVISIONAL / DECLINED / SUPERSEDED as separate inline badges (not suffixes on `v22Type`); DECLINED precedence over PROVISIONAL.
- §11.3 — re-evaluation duplicate detection codified: same Req Set + same evidence set blocks; same Req Set + different evidence supersedes; different Req Set produces a new active result.
- §13 Phase 5 — "Parse and Eval modals look and feel nearly identical" acceptance criterion tightened with the staged-flow parity shipped here.

**Polish-backlog:** items #37–#42 added for deferred 6.5+ review points.

**Runtime verification:** JSDOM render harness passes. Manual walkthrough in dev server of the Phase 6.5+ surfaces: DECLINED badge renders on pure declines and on post-accept/declines, animated pan lands on target with no secondary hop, duplicate-evaluation blocking + jump-to works end-to-end.

### Phase 7 completion notes (2026-04-19) — Directory Layer + AI Shopper

Three carry-over fixes plus Phase 7 own scope (spec §8 Directory Layer, §9 AI Shopper, §7.2 Story 2).

**Carry-over fixes:**

1. *NEW badge persistence (#1).* Andrew's product intent: the NEW badge should persist until the user actively moves on (clicks empty canvas, closes the Detail Panel, or selects a different node), not auto-clear at 900ms. Ripped out six `setTimeout(() => setV22RecentlyAcceptedClaimId/AssetId(null), 900)` sites in `handleV22RequestSubmit`, `handleV22Accept` (both Claim and Asset reveals), `handleV22EvaluationSubmit`, `handleV22AmendClaimSubmit`, and `handleV22AmendDisclosureSubmit`. Added a selection-watcher `useEffect` right above the existing V2.1 `_isNew` clearing effect in V2App.jsx — it reads the same `prevSelRef` so role-switch semantics stay aligned. When `sel` changes away from a revealed node, the corresponding reveal id clears. Effect deps are `[sel, v22RecentlyAcceptedClaimId, v22RecentlyAcceptedAssetId]` so a freshly-set reveal doesn't race the setter. Works on both the grantee claim reveal and the grantor asset reveal simultaneously (Alice accepts, both her Claim and Bob's pulled-in Asset show NEW; clicking one clears only that node's badge).

2. *Amendment notification not reaching grantee (#2).* Root cause was a React setState updater-closure bug: `handleV22AmendDisclosureSubmit` captured `counterpartyParty`, `claimNameForNotif`, `claimPinForNotif` inside the `setV22Provisionals((prev) => { ... })` callback via mutable outer `let` vars, then read them downstream. React may defer the updater to the next render phase, so the downstream `if (counterpartyParty && ... && claimPinForNotif)` branch saw nulls and the enqueue was silently skipped. Fix: compute all notification values from the current-render `v22Provisionals` snapshot (with fallback to `buildV22SharedArtifacts()` seeded data), then call the state updater. Also added a guard to skip notification when `counterpartyParty === activeRole.party` (an internal DA would otherwise notify the amender of their own amendment). `v22Provisionals` added to the useCallback deps.

3. *Spec reference strings in UI copy (#3).* Audit found five user-visible strings referencing spec sections — all stripped, code comments retained. Changes: `AmendDisclosureModal.jsx` line 24 (locked-item tooltip) and line 147 (subtitle), `CombinedResponseModal.jsx` line 302 (Proof-Only explainer), `V22RunEvaluationModal.jsx` line 284 (supersede warning), `V22NodeDetailPanel.jsx` lines 365+367 (Amend Claim + Self-Evaluate tooltips). Remaining `§` occurrences in these files are all inside `//` comments.

**Phase 7 own scope:**

- *Chrome buttons.* Two new icon buttons added to the right-group chrome in V2App.jsx between the PEP Library and the notification bell: a globe icon (Radiant Network, opens Directory Layer) and a magnifier+sparkle icon (AI Shopper, opens the modal directly). Both gated on `V2_2_ENABLED` so V2.1 mode is unchanged. They reuse the existing `iconBtnStyle` + hover handlers — no new visual language introduced.

- *`src/v2/DirectoryLayer.jsx` (new).* Placeholder-grade Directory Layer per spec §8.5. Entry/exit transition is a CSS `clip-path: circle()` expanding from 0% at (0,0 bottom-left) to 180% — a single sweep, not the V2.1 child-layer dive. Internal `phase` state (`'closed' | 'in' | 'out'`) keeps the component mounted during the ~550ms exit animation. Renders GovCo/MicroCo/AuditCo corner node anchored bottom-left, a header ("Radiant Network · Public Directory · N parties · M published Claims"), a prominent "Launch AI Shopper" CTA (spec §8.3), and four dot clusters — MicroCo sized by the real public-directory DA count (3 today) plus three mock suppliers (ElectroGrid Ltd / NovaFab Inc / Precision Components Co) for density per §8.2's "thousands of dots" language. Dots are deterministic-random seeded so positions are stable across renders; each has a pulse-free static glow. Dots are visual-only this phase — the underlying Claim artifact is reachable via `buildV22SharedArtifacts` when a future phase wants to wire per-dot panels. Exit: click the corner node OR the "← Back to Network" chip.

- *`src/components/modals/AIShopperModal.jsx` (new).* Three-stage modal: `'setup'` (Requirements Set picker + prompt textarea) → `'searching'` (2.2s mock progress with a pulsing golden ripple) → `'results'` (top-3 candidate cards with MATCH score, owner party, PIN, rationale, Request Agreement CTA). The mock `runMockSearch` deterministically ranks all public-directory Claims from `buildV22SharedArtifacts`, biasing score by token overlap between the Claim name and the Req Set / prompt. Today that resolves to Alice's PRM / Voltage Regulator / EMI Shield publications; adding more public-directory DAs will grow the pool without modal changes. Default selected Req Set is `availableRequirementsSets[0]` (fixes a disabled-launch trap where the `<select>` visually showed the first option but state was empty). Clicking Request Agreement closes the Directory + AI Shopper, then opens `CombinedRequestModal` via two new props:
  - *`initialPin`* and *`initialRequirementsSetIds`* added to `CombinedRequestModal.jsx` — default empty strings / empty array, so existing call sites are unaffected. Feeds into the modal's `useState(initialPin)` / `useState(() => [...initialRequirementsSetIds])` so PIN resolution auto-fires and the Req Set checkbox is pre-ticked.

- *Story 2 walkthrough end-to-end.* Runtime-verified in dev server: chrome globe → Directory Layer wipes in → "Launch AI Shopper" → fill Req Set + prompt → Launch → mock progress → 3 candidates ranked 91/78/75 → Request Agreement on top candidate → CombinedRequestModal opens with the PRM PIN pre-populated and MIL-PRF-55681 pre-selected → Send Request → modal closes, canvas updates, and switching to Alice's role surfaces a `v22-request` notification with the PRM Claim name and GovCo sender. Console clean; no hooks-order violations (one was caught during initial build — `useMemo` after an early `return null` — and fixed by moving all hooks above the conditional return).

**Spec updates folded in during Phase 7:** None required for §8 / §9 / §7.2 — the shipped behaviour tracks the spec. One minor clarification fold-in candidate is the chrome placement of the Radiant Network button: spec §8.1 places it "bottom-left of the canvas, always on top"; the shipped build uses the chrome (top-right next to the notification bell) per Andrew's Phase 7 instruction. Noted in the phase task, not a spec deviation that requires section edits.

**Polish-backlog:** new items filed for Phase 7+ polish — clickable dots, real Actor grouping visualizations, streaming AI results, candidate preview cards. See `v2.2-polish-backlog.md` entries #43–#48.

**Runtime verification:** ran in Chrome against `VITE_V2_2_ENABLED=true npm run dev`.
- Directory Layer entry/exit transitions cleanly (single circular wipe).
- AI Shopper full round-trip (setup → searching → results → Request Agreement) works.
- CombinedRequestModal opens pre-populated; PIN resolves to PRM; MIL-PRF-55681 is pre-checked.
- Send Request closes the modal, flows the notification to Alice's inbox (verified by switching roles).
- Amendment notification fix (#2) — Alice amends DA, switches to Bob, notification appears. *(Not re-exercised in this session's Story 2 walkthrough because the amendment flow is separate; the code path is reasoned through against the Phase 6.5 bug repro.)*
- NEW badge (#1) — fresh provisional Claim on Bob's canvas retained the NEW badge post-submit (no 900ms auto-clear); clicking a different node clears it.
- V2.1 regression: boot sequence, canvas rendering, role switcher, and chrome all unchanged in V2.1 mode (`V2_2_ENABLED` gates the two new chrome buttons, DirectoryLayer, AIShopperModal, and the clear-reveal effect — V2.1 behaviour byte-identical to pre-Phase-7).

**Known scope boundaries (not bugs):**
- *Radiant Network button placement.* Lives in the chrome, not spec §8.1's "bottom-left of canvas." Andrew's Phase 7 task explicitly accepted chrome placement. The corner-node morph animation from §8.1 is also not implemented — the chrome icon and the Directory's bottom-left anchor node are visually distinct.
- *Clickable dots.* Spec §8.2 states "no hover details, no Detail Panels" in V2.2. We render dots as visual-only. Underlying public-directory Claim artifacts are reachable, so a later phase can wire per-dot interactivity without a schema change. Tracked as polish item #43.
- *Mock AI Shopper.* The "agent" is a deterministic scoring function that always returns publicly-disclosed Claims ranked by name/prompt token overlap. Placeholder-grade per the Phase 7 task.
- *Radiant Network node on canvas.* Spec §3.6 says the node appears only if the user has publicly-disclosed Claims. Not wired in Phase 7; Bob has no public disclosures today, so no node appears. Alice DOES have 3 public DAs; the node still doesn't render on her canvas — derivation rule is there in `deriveAgreementEdges` but the Actor node itself isn't added to her view. Tracked as polish item #44.
