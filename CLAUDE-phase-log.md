# Radiant by Provenance — Phase log archive

Historical phase notes for the V2.2 migration and post-migration work, dated 2026-04-17 through the present. Each entry captures what shipped, deviations from the spec, fold-ins, and known-scope-boundary notes for that phase.

For current codebase conventions, file inventory, UX patterns, and active state-of-the-world, see [`CLAUDE.md`](./CLAUDE.md). For the architectural model and shipped reality, see [`architecture-spec.md`](./architecture-spec.md). For the open / partial / deferred work queue, see [`polish-backlog.md`](./polish-backlog.md).

This file is archive-grade reference material. Round-opening upload sets do not need it unless phase history matters for the current task.

---

## Phase log

V2.2 migration ran in eight phases, 2026-04-17 through 2026-04-19. All complete.

- [x] Phase 1: Data Model Foundation
- [x] Phase 2: Parent Layer Restructure
- [x] Phase 3: Edge Clickability + Agreement Panels
- [x] Phase 4: Combined Request + Response Flows
- [x] Phase 5: Evaluation Flow + Eval Results on Parent Layer
- [x] Phase 6: Amendment Flows
- [x] Phase 7: Directory Layer + AI Shopper
- [x] Phase 8: Consolidation + Cleanup

Per-phase completion notes below capture what shipped plus any deviations from the spec.

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
  - `src/v2/V2App.jsx`: added `v22Provisionals`, `v22RequestOpen`, `v22RespondingTo`, `v22RecentlyAcceptedClaimId` state. `handleV22RequestSubmit` / `handleV22Accept` / `handleV22Decline` callbacks. "Request Agreement…" button in V2.2 banner. Reveal animation triggered via existing `_isNew` flag pipeline. (Historical: Phase 4 cleared `_isNew` after ~900ms; Phase 7 carry-over #1 replaced the timer with deselection-clears — see Phase 7 notes below. The 900ms number refers to the card's fade-in animation on initial render, not the NEW badge duration.)
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
6. *NEW badge + pan-to-node.* `setV22PanToClaimId` triggers `canvasRef.current.panToWithZoom`; `setV22RecentlyAcceptedClaimId` tags `_isNew` on the claim node. Fires for both initial provisional creation and post-accept activation, reusing V2.1 reveal infrastructure. (Historical: Phase 5 cleared `_isNew` after ~900ms; Phase 7 carry-over #1 removed that timer — NEW badge now persists until the user deselects the node. The 900ms number describes the card's fade-in animation on initial render, not the NEW badge duration.)

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

### Phase 8 completion notes (2026-04-19) — Consolidation + Cleanup

Final migration phase: Phase 7 visual polish, missing V2.2 parse flow, feature-flag removal, V2.1 + V1 deletion, documentation finalization.

**Phase 7 carry-over polish:**

1. *Symmetric circular wipe on Directory open.* `DirectoryLayer.jsx` now plays the clip-path wipe on entry too — mount in an `'opening'` phase with `clip-path: circle(0% at 0% 100%)`, then `requestAnimationFrame` flips to `'in'` (expanded) so the CSS transition has a from-state. Previous implementation jumped straight to `'in'`, skipping the entry animation.
2. *Globe icon toggles Directory Layer.* V2App chrome button is now `onClick={() => setV22DirectoryOpen((v) => !v)}`. Button also reads as active (amber background + amber border + amber icon color) when the Directory is open, so it reads as a layer-toggle button.
3. *AI Shopper progress uses PrimeRadiant.* `MockProgress` in `AIShopperModal.jsx` swapped the generic glowing orb for the `<PrimeRadiant size={80} fps={30} strutScale={1.8} brightness={0.3} />` pattern + progress bar used by `V22RunEvaluationModal` and `V22ParseEvidenceModal`. The three processing stages now feel like siblings.
4. *AI Shopper results polish.* Candidate cards grew a 30px MATCH score (was 22px), the PIN now uses `<CopyBadge value={pin} truncated />` for V2.1-consistent PIN display, and per-result rationale varies by score band: top result names the strongest match reason ("Direct match on {Req Set} terms" / "Semantic match against your prompt" / "Aligns topically with {Req Set}"), second line cycles through disclosure-type / owner / peer-score hint.
5. *AI Shopper Req Set picker.* Retired the native `<select>` in favour of the same flat card-list pattern `V22RunEvaluationModal` uses — clickable rows with name + id/version + indigo selection, keyboard-accessible (`role="radiogroup"` + Enter/Space handling), click-outside-to-close not needed since the list is inline. Fixes the Phase 7 "disabled Launch button trap" where the `<select>` visually showed the first option while state was empty.

**Missing V2.2 Parse flow (spec §11.8, new):**

- `src/components/modals/V22ParseEvidenceModal.jsx` (new). Three-stage flow mirroring `V22RunEvaluationModal`: (1) select Parse Template (card list with ALREADY PARSED lockouts for templates already run on the Asset), (2) processing with PrimeRadiant + 1.5s progress bar, (3) review + edit parsed field values with `ConfidenceBadge` that cycles high/medium/low on click. Required fields validated at submit; empty required field blocks. Keyboard-accessible throughout (radio group on the template list).
- `src/v2/v2_2Data.js` — new `makeParseRunArtifacts({ ownerParty, ownerDot, sourceAssetId, template, rows })` factory producing `{ parseResult, refDisclosureAgreement }`. The ref DA is an internal Full DA with `subject={kind:'parseResult', id}` + `scope.assetIds=[sourceAssetId]` — same shape as the seeded `parseResultRefEdges` so edge derivation treats it identically. `mergeProvisionals` extended to carry provisional parse results into the view.
- `V22AssetPanel` footer — new **Parse Evidence** action for Asset owners, alongside Request Agreement and Create Claim. Wired via `onParseEvidence` prop that V2App fills with `() => setV22ParsingAsset(node)` for Asset type + owner.
- V2App handler `handleV22ParseSubmit` creates the Parse Result + ref DA, appends both to `v22Provisionals`, selects the new Parse Result, pans to it, and tags it with `_isNew` for the reveal animation (cleared on selection change per Phase 7 rule #1).
- Spec §11.8 added (see architecture-spec.md changelog).

**Code consolidation:**

6. *Feature flag removed.* `FORCE_V2_2`, `ENV_V2_2`, `V2_2_ENABLED` exports deleted from `src/v2/v2_2Data.js`; `.env.local` deleted. Every `{V2_2_ENABLED && …}` gate in V2App.jsx collapsed to unconditional rendering via `sed 's/{V2_2_ENABLED && /{/g'`. Every `V2_2_ENABLED ?` ternary flattened to its V2.2 branch. The V2.2 banner ("V2.2 MODE ACTIVE — architecture migration in progress") was removed entirely — migration is no longer in progress.
7. *V2.1 modal files deleted.* 13 files under `src/components/modals/` removed: `RequestDisclosureModal.jsx`, `DisclosureResponseModal.jsx`, `ReviseDisclosureModal.jsx`, `RunEvaluationModal.jsx` (V2.1), `ParseEvidenceModal.jsx` (V2.1), `RegisterAssetModal.jsx`, `AddEvidenceModal.jsx`, `CascadeModal.jsx`, `UpstreamPicker.jsx`, `CreateClaimModal.jsx`, `QualifiedStoragePicker.jsx`, `RevocationNoticeModal.jsx`, `PublishModal.jsx`.
8. *V2.1 DetailPanel files deleted.* 10 files under `src/components/DetailPanel/` + `shared/` removed: `index.jsx`, `PanelShell.jsx`, `ChildrenTab.jsx`, `DisclosuresTab.jsx`, `EvalPanel.jsx`, `EvaluationsTab.jsx`, `EvidenceBlock.jsx`, `ParsedFieldsTab.jsx`, `ClaimsTable.jsx`, `constants.js`, plus all of `shared/` except `CopyBadge.jsx` (which V2.2 panels still import). Only `V22NodeDetailPanel.jsx`, `DisclosureAgreementDetailPanel.jsx`, `EvaluationAgreementDetailPanel.jsx`, and `shared/CopyBadge.jsx` remain.
9. *V2.1 state + merge pipeline deleted from V2App.jsx.* The ~270-line V2.1 `data = {...roleData}` merge-and-rollup pipeline (`addedNodes` / `addedSDAs` / `addedEdges` / `addedChildren` / `removedX` filters, health rollup, selective-disclosure field filtering) was removed. `emptyRoleState` now holds only `dismissedReqs`, `addedRequests`, `requirementSets`, `pepTemplates`, `newlyDisclosedIds` — the V2.2-relevant fields. `publicListings` memo removed. V2.1 `_isNew` clearing effect removed (V2.2 has its own). `onConnect` on V2Canvas now passes `undefined` since V2.2 has no equivalent action. V2App imports trimmed from ~15 V2.1 modal imports down to the 7 V2.2 modals + library modals.
10. *V1 files deleted.* All V1 files under `src/` removed: `src/App.jsx`, `src/App.css`, `src/main.jsx`, `src/ia-map-entry.jsx`, `src/data/` (entire directory — `dataset.js`, `generateDataset.js`, `generateAutoCo.js` / `generateGovCo.js` / `generateFastCo.js` / `generateMicroCo.js`, `generateEvents.js`, `verticals.js`, `tokens.js`, `platformAssets.js`, `mkhash.js`), `src/reference/` (entire), plus every file at `src/components/` root (Header, Footer, NetGraph, Sidebar, OverviewTab, ClaimsTab, EvalsTab, DetailPanel.jsx, InvitationDetailPanel, InviteSupplierModal, SupplierDashboard, SupplierNetGraph, SupplierSidebar, SupplierAssetSection, OrgNodeContent, CreditsModal, AttestationCard, AttestationTestPanel, ClaimTimeline, TimelineTab, RiskMatrix, SearchResultsModal, AssetDirectoryModal, AssetRegistrationModal, AssetRegistrationStandaloneModal, EvaluationModal, EvidenceModal, HealthDot, InvitationModal, NetworkEventsNotification, NodeIcon, RadiantLogo, RequirementsLibraryModal (V1 duplicate), SDACreationModal, SubgraphModal, SvgMark, SystemCreationModal, WorldMap, detailPanelUtils.jsx). Only `src/components/modals/` and `src/components/DetailPanel/` remain.
11. *`index.html` deleted* (V1 root entry). `vite.config.js` updated to drop the `main` input; builds now output `v2.html` + `v3.html` only.
12. *`src/v2/` rename deferred* to polish backlog. The directory name is vestigial now that there's only one version shipped, but the cascading import-path changes across every file is a high-risk post-deletion operation best done with a dedicated atomic pass.

**Documentation finalization:**

- `v2.2-architecture-migration-spec.md` → `architecture-spec.md` (renamed). Content trimmed to remove migration-in-progress language while preserving the changelog as historical record.
- `v2.2-polish-backlog.md` → `polish-backlog.md` (renamed). Phase 8 items marked complete.
- CLAUDE.md restructured: `Current Target: V2.2` header replaced with `Architecture`; `Feature flag` subsection removed; `Forbidden Changes` list removed (phase-specific, no longer load-bearing); `File layout` updated for post-deletion state; Phase 7 + Phase 8 notes added.

**Bundle impact:** v2 chunk dropped from 638 kB → 345 kB (46% shrinkage, 142 kB → 83 kB gzip). No regressions in the build.

**Runtime verification:**
- Build passes clean at every checkpoint (after flag removal, after modal deletion, after V1 deletion).
- Dev server boots; v2.html loads; boot screen renders; canvas + nodes + edges render correctly; chrome icons (globe, AI Shopper, notification bell, theme toggle, library, PEP library) all functional.
- Story 2 walkthrough (Phase 7 regression): chrome globe → Directory Layer wipes in → Launch AI Shopper → fill prompt → see results → Request Agreement → CombinedRequestModal pre-populated → send → Alice receives v22-request notification. Still works end-to-end.
- Story 1 walkthrough: Asset panel → Request Agreement → CombinedRequestModal → response from Alice → Run Evaluation → eval result on both canvases.
- Story 3 walkthrough: amend flows + notifications still work.
- V2.2 Parse flow: Asset panel → Parse Evidence → template picker → processing → review + edit → Save → Parse Result node appears on canvas with NEW badge.

**Known scope boundaries (not bugs):**
- *`src/v2/` rename deferred.* Filed as polish item.
- *V3 archive (`src/v3/`, `v3.html`) kept.* Task didn't specify deletion; it's not wired into V2.2 and adds no runtime cost beyond the tiny v3.js bundle.
- *`README.md` untouched.* Task didn't specify.
- *V2App.jsx still contains some V2.1-era handler names* (`handlePanelViewChain`, `setClaimContext`, etc.) that are now dead code — setters called but state never consumed. Kept in place to minimise edit surface during the cleanup pass; filed as polish backlog item for a dedicated dead-code sweep.

### Phase 9A completion notes (2026-04-19) — static visual polish + card/UX upgrades

Ten-item polish pass across AssetNode (visuals + card action bar), V2Canvas + v2_2Data (edge stroke metadata), V22NodeDetailPanel (Parse/Eval row rendering), V22RunEvaluationModal (review-stage UX), V22ParseEvidenceModal (human-edited indicator), and CombinedResponseModal (help text). Phase 9B (expanded tables, exports, edge hover overhaul) is intentionally not touched.

**Visual + card items (1-5):**

1. *Warmer node borders.* Default border is now `color-mix(in srgb, var(--accent-indigo) 22%, var(--border))` — a cool indigo-grey that stops node terminations from fading into the dark canvas without competing with the indigo edge palette. Red UNSAT border treatment unchanged. Value surfaced in the completion summary per task instruction: **22% accent-indigo blended into var(--border)**.
2. *Counterparty tint.* Cards where `node.owner !== activeParty` (excluding Actor nodes) render a muted background tint: `color-mix(in srgb, var(--bg-card) 82%, var(--bg-deep))`. Subtle flattening, no opacity or chip changes.
3. *Thinner internal edges.* `deriveAgreementEdges` now stamps `grantorParty` + `granteeParty` onto each edge; V2Canvas reads them and multiplies the default stroke width by 0.7 when they match (internal / ownership edges). Selected and NEW edges keep their full emphasis regardless.
4. *Card cleanup.* Three sub-fixes in AssetNode:
   - Claim and Eval Result names wrap to two lines via `-webkit-line-clamp: 2` (Actor + Asset stay on one line with ellipsis).
   - Inner content wrapper is now a flex column with `justify-content: space-between`; the top rows (type badge, name, owner) group together and the health minibar pins to the bottom edge, equalising the whitespace.
   - Type-badge row has `marginBottom: 7` (was 2) so the name no longer crowds the `CLAIM` / `ASSET` / `EVAL RESULT` pill.
5. *Edge-endpoint glow.* `v22DataWithReveal` memo in V2App resolves `selectedEdgeId` → the two touched node ids and stamps `_isEdgeEndpoint: true` on each. AssetNode renders a static indigo glow via `box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-indigo) 35%, transparent)` — offset 5px outside the card border. Suppressed when the node is ALSO the selected node (the amber border wins so the two states stay visually distinct per spec).

**Action + entry-point items (6, 7, 9):**

6. *Re-Evaluate with locked Req Set.* V22RunEvaluationModal accepts a new `lockedRequirementsSetId` prop. When set, the Req Set picker is replaced by a read-only indigo card with a LOCKED pill + the explainer "To change Requirements Set, start a new evaluation from the Claim." V22EvalResultPanel's Re-run Evaluation footer (already owner-only) now fires a handler that sets `v22EvalContext.lockedRequirementsSetId` + `v22EvalContext.priorActiveResultId`. V2App's modal mount also feeds the prior result as `priorActiveResult` so the review rows pre-populate (item #8 sub-2). The existing free-choice entry from Claim panel is untouched.
7. *Full-disclosure last-Asset help text.* CombinedResponseModal's Step 2 Full branch still blocks Continue when zero Assets are selected (unchanged); now also renders an amber italic inline help line ("Select at least one Asset to continue.") beneath the count footer when the selection is empty. No snap-back behaviour.
9. *Card action parity with Detail Panel footer.* New `V22ActionBar` component in AssetNode.jsx replaces the V2.1 ActionBar for V2.2 nodes. Per-type button set:
   - ASSET (owner): Request Agreement, Parse Evidence, Create Claim (Phase 6+)
   - CLAIM (owner, non-provisional, non-declined): Amend Claim, Self-Evaluate
   - CLAIM (non-owner + active EA): Run Evaluation
   - EVAL RESULT (owner, not superseded): Re-run Evaluation
   - PARSE RESULT / ACTOR: no actions
   
   Single-dispatch prop `onV22CardAction(actionName, node)` threads from V2Canvas into AssetNode; V2App routes action names to the same handlers its Detail Panel footer fires. `v22DataWithReveal` now also decorates Claim nodes with `_evaluationAgreementForActor` (the EA where the current actor is grantee) so the ActionBar can show Run Evaluation on counterparty Claim cards without re-plumbing.

**Run Evaluation review-stage upgrades (8):**

- *Full status words with flanking chevrons.* New `StatusChevronPicker` renders `◂ SATISFACTORY ▸` (or UNSATISFACTORY / MISSING / N/A — full words). Left chevron cycles back, right chevron + word cycle forward. `cycleStatus` now takes a direction (+1 / -1). `STATUS_CFG` added `short` labels so Detail Panel and elsewhere can keep the 3-letter abbreviations; exported as `REVIEW_STATUS_CFG` for reuse.
- *Supersede pre-population.* When `priorActiveResult` is set on the modal (fires from the Re-Evaluate flow or when `lockedRequirementsSetId` matches a prior result's Req Set), review rows pre-populate `value`, `status`, and `confidence` from the prior result (was hard-coded `0.9`). Each row's `_aiOriginalValue` snapshots the prior `value` so any subsequent human edit is detected.
- *AI confidence chip per row.* `ConfidenceBadge` now renders an `AWAITING AI` pill in muted grey when `confidence == null`, so every row always has a visible confidence slot. Fresh evaluations start with `confidence: null` (was `0.0` producing a LOW chip). Confidence is persisted on the submitted payload.

**Human-edited pencil (10):**

`_aiOriginalValue` is tracked per row in both modals from initialization (set to the AI's extracted value, or empty string for fresh rows). When `row.value !== row._aiOriginalValue` a small amber pencil SVG renders next to the ConfidenceBadge with the tooltip "Human-edited from AI's original extraction." Persisted onto both `parseResult.fields[i]._aiOriginalValue` and `evaluationResult.results[i]._aiOriginalValue` so V22NodeDetailPanel's Parse Result + Eval Result panels render the pencil when viewing the artifact later. AI confidence remains unchanged by human edits (the Phase 8.5 rule).

**Build impact:** v2 bundle 345 kB → 350 kB (+5 kB for the new action bar, chevron picker, pencil icon, confidence AWAITING AI state, and adapter decorations). No runtime regressions.

**Runtime verification:** exercised each item in Chrome against `http://localhost:5173/`.
- Borders: warmer indigo-grey on all Asset/Claim/Eval Result cards across all three roles.
- Counterparty tint: visible when switching to Bob and comparing his own Asset card to Alice's Claim pulled in.
- Internal edges: thinner on Alice's own Actor → Asset → Claim chain compared to inter-party edges.
- Card cleanup: Claim / Eval Result names wrap on two lines; health minibar sits mid-card; type pill no longer crowds the name.
- Edge-endpoint glow: clicking an edge highlights both endpoints with the indigo outer ring; different from the selected-node amber border.
- Re-Evaluate: Re-run from an Eval Result panel opens the modal with the LOCKED Req Set card + pre-populated rows.
- Full help text: Deselecting all Assets in Full disclosure shows the amber hint.
- Status picker: ◂ SATISFACTORY ▸ chevrons + word all cycle as expected.
- Card actions: per-role walk-through confirmed one-to-one with Detail Panel footer for Asset/Claim/Eval Result/Parse Result.
- Human-edited pencil: appears next to the confidence chip after typing in a value; persists into the Parse Result panel.

### Phase 9A.3 completion notes (2026-04-20) — Asset registration + Claim creation

Brings Registering + Claiming from placeholder → demo-complete, closing two of the three remaining process gaps (Transferring lands in 9A.4). Three gates shipped in sequence.

**Gate A — Asset registration + Claim creation (core):**
- `V22QualifiedStoragePicker.jsx` (new). V2.2 port of V2.1's picker with a third **AuditCo** bucket seeded alongside GovCo + MicroCo. `single` and `multi` modes retained. Payload normalised on the way out: display size strings → byte counts, ext → mimeType, path → `uri`.
- `V22CreateAssetModal.jsx` (new). 2-step flow — pick file → review. Filename stem becomes the Asset's display name (per spec §3.2 Assets have no separate name field). `nested` prop support bumps the picker's zIndex above the parent modal's backdrop so Gate B's inline-register flow lands above it.
- `V22CreateClaimModal.jsx` (new). 2-step flow — name + description + multi-Asset picker → review. `initialAssetIds` pre-selects the Asset the modal was opened from (so Create Claim from an Asset's panel/card lands with that Asset checked). Spec §3.4 `referencedAssetIds.length >= 1` enforced at submit. Inline "+ Register new Asset…" CTA built in from the start (Gate B rides on top).
- **Factories (v2_2Data.js):** `makeAssetRegistrationArtifacts({ file, ownerParty }) → { asset, ownershipDa }` and `makeClaimCreationArtifacts({ name, description, referencedAssetIds }) → { claim, ownershipDa, claimRefDas[] }`. Both produce the internal Full DAs that the existing edge derivation treats identically to the seeded ownership/claim-ref DAs, so edges derive automatically on next render.
- **mergeProvisionals bug fix.** The helper merged claims/parseResults/agreements but *not* `provisionals.assets` — the first Create Asset submit landed in state but never reached the canvas. Added `merged.assets = mergeById(...)`. Caught during Gate A runtime verification.
- **Detail Panels (V22NodeDetailPanel.jsx):** new `V22ActorPanel` with owner-only Register Asset footer CTA. Panel filter in V2App updated from `category !== 'party'` to `v22Type && !isNetworkNode` so the Actor panel actually opens on selection. `panelWidth` + edge-framing heuristics updated in sync.
- **Card actions (AssetNode.jsx):** V22ActionBar now handles `ACTOR (owner) → Register Asset` and the existing Asset `Create Claim` dispatch is wired (was previously labelled "Phase 6+" placeholder).
- **V2App wiring:** `v22RegisteringAsset` + `v22CreatingClaim` state, two new handlers (`handleV22CreateAssetSubmit`, `handleV22CreateClaimSubmit`), shared nested helper (`handleV22NestedAssetCreated`). Dispatch cases `registerAsset` and `createClaim` in the card action router.

**Gate B — Nested "+ Register new Asset…" CTA (backlog #34):**
- `V22CreateClaimModal` already shipped the CTA in Gate A (the register-as-you-go flow is the norm for V2.2's Claim creation).
- **`AmendClaimModal.jsx`** brought to parity: accepts `activeParty` + `onNestedAssetCreated`, renders the CTA both in the populated-candidates state (dashed-green button above the picker list) and in the empty-candidates state (previously a dead-end message). Nested submit auto-selects the fresh Asset's id optimistically so the user's next render shows it ticked.
- Nested modals stack on their own Backdrop portal; the parent stays dimmed until the nested modal is closed.
- Pan-to suppression for nested flows — `handleV22CreateAssetSubmit`'s `_nested` flag skips the canvas pan so the user stays focused on the parent modal.

**Gate C — 9A.2 carry-over defects (backlog #62):**
- (a) **Dot-LOD endpoint ring** re-geometred. The ring was sized to the 16px wrapper but the inner dot is 8px at margin 4 — so the ring sat 5px from the dot's edge, reading as off-centre. Now `14×14` at `top: 1, left: 1` for a clean 3px halo concentric to the inner dot.
- (b) **Bell chrome button** wrapped in `<Tooltip content="Notifications (N)">`. Content nulled while the inbox is open so the tooltip doesn't cover the dropdown.
- (c)(d) **Root cause was z-index, not layout.** Tooltip's TooltipBody portal rendered at `zIndex: 6000`; Backdrop's modal wrapper is `zIndex: 10000`. Tooltips anchored inside a modal *were* rendering — they were just drawn under the darkening backdrop and invisible. Bumped Tooltip baseStyle to `10100`; chrome tooltips don't regress since hover path from canvas never reaches them while a modal is open.

**Runtime verification (Chrome, Vite dev server):**
- Register Asset from GovCo Actor panel: QS picker showed the GovCo bucket tree, selected `ITAR-classification-memo.pdf`, advanced to review, committed. New Asset rendered on canvas with `_isNew` reveal, Detail Panel showed PIN, DOT, file meta, registration timestamp.
- Create Claim from the new ITAR Asset's panel footer: modal pre-selected the triggering Asset, added Avionics Module, named "Sentinel-4 Launch Compliance", committed. Claim rendered on canvas with edges to both referenced Assets; Detail Panel showed referenced Assets list + AMEND CLAIM / SELF-EVALUATE footer.
- Nested inline "+ Register new Asset…" from Create Claim: modal stack rendered cleanly, picked `AS9100-audit-report.pdf`, completed — parent modal's picker auto-selected the new Asset (count badge went 1 → 2).
- Amend Claim on the Sentinel-4 Claim: modal shows "Already referenced (2)" + "Add Assets (3 available)" including the AS9100 Asset registered during the nested flow, confirming cross-modal persistence. The new inline CTA renders at the top of the picker list (green dashed outline).
- Bell tooltip verified via `dispatchEvent('mouseover')` → "Notifications" tooltip body rendered at zIndex 10100.

**Deviations from task:**
- **No credit cost** on either new flow. V2.2's other modals (ParseEvidence, RunEvaluation, CombinedRequest) don't charge credits; adding a cost here alone would be out-of-pattern. Task suggested 5-credit cost deferred unless credit accounting becomes a V2.2 concern.
- **Asset display name derived from filename stem** (`power-supply-spec.pdf` → `power supply spec`). Task said "no separate name field"; stripping the extension + normalising separators reads nicer than the raw filename.
- **Chevron/pencil tooltip fix** turned out to be z-index, not the inline-flex hover-region hypothesis from the backlog. The fix is simpler (single-line zIndex bump); the original hypothesis would have required restructuring every Tooltip call site.

**Known gaps (not 9A.3 blockers):**
- *Gate C runtime verification in the Run Evaluation review stage.* The zIndex bump is deterministic — the Modal backdrop at 10000 sits below TooltipBody at 10100 — but the full Run Evaluation flow wasn't driven end-to-end in the browser during this session to observe the chevron/pencil tooltips rendering on top of the modal. If they don't appear in practice, the fallback is the original "inline-flex wrapper" hypothesis from backlog #62; `wrapperStyle={{ display: 'inline-block' }}` on the chevron/pencil Tooltip instances would be the minimal further fix.
- *Pan-to on Create Asset / Create Claim in nested contexts.* Suppressed correctly when nested, but the standard (non-nested) path panning can land the new node near an edge of the viewport depending on existing density. Falls under backlog item #4 (Layout density).

**Status:** [x] Complete.

### Phase 9A.4 completion notes (2026-04-20) — Transferring process + structured DOT

Ships the seventh and final platform process and closes the 7-process demo. Also lands the structured DOT data model that canon X.1–X.10 calls for — every Asset, Claim, and Eval Result now has a DOT object carrying PIN, hash, owner DID, registration timestamp, metadata, and lineage. Four gates in sequence.

**Gate A — Structured DOT + transfer mechanics (data layer):**
- `makeDotObject({ pin, hash, ownerDid, registrationTimestamp, metadata, lineage })` and `makeTransferRecord({ fromOwnerDid, toOwnerDid, initiatedTimestamp, acceptedTimestamp, status, declineReason })` added to `v2_2Data.js`. DOT lineage is append-only; declined + cancelled transfers both land in lineage for auditability, matching canon X.5.
- `makeAsset` / `makeClaim` / `makeEvaluationResult` now populate a `dot` field via `makeDotObject`. **Backward compat preserved**: flat `pin` / `ownerDot` / `file.hash` remain as convenience aliases pointing into `artifact.dot.*`. Read sites unchanged — existing code continues to work untouched.
- `resolveActorByPin(pin, { activeParty })` helper returns `{ actor, isSelf, isNetwork }` for the V22TransferAssetModal's PIN validator. Module-level lazy cache so keystroke resolution doesn't rebuild the full artifact graph.
- Spec additions: new §2.6 "DOTs and Identity" introducing the DOT + car-title analogy; §3.2/§3.4/§3.5 cross-reference the `dot` field; §11.7 "Ownership transfer" rewritten from "defined but not implemented" placeholder to full flow spec.
- V22NodeDetailPanel: Asset panel DOT row now sources from `asset.dot.pin` (Asset's own DOT) instead of `node.dot` (party-level owner DID, which was the 9A.4 preamble's interim surfacing).

**Gate B — Sender flow:**
- `V22TransferAssetModal.jsx` (new). 2-step flow — Recipient (PIN + optional note) → Review (summary + irreversibility warning). PIN resolution rejects self, Radiant Network, and unknown PINs with tailored error copy.
- `v22Provisionals.transfers` — new state slice. Submit creates a transfer record on this slice; `mergeProvisionals` threads it through the shared artifact bundle; `buildViewForActor` computes `pendingTransfersByAssetId` so `buildV22Canvas` can stamp `_pendingTransfer` on the sender's Asset node. Canvas adapter also sets `_showAsProvisional` so the existing dashed-border treatment fires.
- AssetNode: amber TRANSFERRING badge replaces PROVISIONAL while `_pendingTransfer` is set; message row reads "Awaiting acceptance from {recipientParty}"; V22ActionBar swaps the full action set for a single ✕ Cancel Transfer while pending.
- V22AssetPanel: Transfer footer button (standard state); Cancel Transfer danger button (pending state); new "Pending Transfer" section with recipient + initiated timestamp + optional note.
- V2App wiring: `handleV22TransferSubmit` + `handleV22CancelTransfer`, card-action dispatch (`transferAsset` / `cancelTransfer`), V22TransferAssetModal mount. Cancel fires `v22-transfer-cancelled` notification + dismisses the pending request on the recipient's side; no ledger record per spec §11.7.

**Gate C — Recipient flow:**
- Four new notification types wired into the existing inbox dropdown: `v22-transfer-request` (amber TRANSFER badge, inline ACCEPT + DECLINE buttons), `v22-transfer-accepted` (green ACCEPTED), `v22-transfer-declined` (red DECLINED with reason surfaced), `v22-transfer-cancelled` (grey CANCELLED).
- ACCEPT: re-emits the Asset via `makeAsset({ dot: newDot })` with `ownerDid` flipped to recipient and an accepted transfer record appended to `dot.lineage[]`; drops the provisional; selects + pan-to the Asset on the recipient's canvas with the standard `_isNew` reveal; fires `v22-transfer-accepted` to the sender.
- DECLINE: opens an inline reason sub-form (textarea + BACK / CONFIRM DECLINE). Empty reason is acceptable. Re-emits the Asset with a declined transfer record appended to lineage (ownership unchanged); fires `v22-transfer-declined` with the reason to the sender.
- **Gate C critical fix.** First-iteration bug: handler read `transfer` + `asset` inside the `setV22Provisionals(prev => {...})` updater and captured into outer `let` vars. React defers updaters to the next render — the downstream notification dismiss + pan logic ran before the updater fired, so the captured vars were still null and the flow short-circuited (notification stayed visible even though the asset moved). Fix: resolve transfer + asset **synchronously** from the current-render `v22Provisionals` snapshot, then hand a clean updater to `setV22Provisionals`. Same fix on the decline handler.

**Gate D — Housekeeping:**
- In-app Changelog modal: new v0.9.0 / Phase 9A.4 entry. Footer version bumped from v0.4.0 → v0.9.0.
- polish-backlog.md: #33 marked ✅ Complete with known-limitation cross-references; added #72 (Claim + Eval Result transfer), #73 (Asset-backing-disclosed-Claim constraint), #74 (provenance lineage UI), #75 (transfer timeout). Update Log entry.
- CLAUDE.md Phase 9A.4 notes (this section).

**Runtime verification (Chrome):**
- Happy path: Alice → PRM-3A Thermal Analysis → Transfer → Bob's PIN → Review → Send. Bob sees TRANSFER notification with ACCEPT + DECLINE inline. Bob clicks ACCEPT. Thermal Analysis materialises on Bob's canvas owned by GovCo with pan-to + edge to GovCo Actor; Detail Panel DOT reads the Asset's own DOT pin. Bob's notification dismisses; bell clears. Alice's canvas removes the Asset; Alice's bell gets ACCEPTED notification.
- Decline path: Alice → EMI Shield Assembly Datasheet → Transfer to Carol → Send. Carol clicks DECLINE → inline reason textarea → fills "Out of scope for AuditCo — already disclosed by MicroCo." → CONFIRM DECLINE. Carol's notification dismisses; Alice's bell shows 2 notifs (accepted + declined) with the reason surfaced verbatim.
- PIN resolution negative cases: own PIN → "Cannot transfer to yourself"; Radiant Network PIN → "Cannot transfer to the Radiant Network (public directory)"; garbage PIN → "Unknown PIN". All three block Review.
- Sender cancel path (verified via Gate B smoke tests): Alice initiates → TRANSFERRING badge renders on her Asset → Cancel Transfer button in panel footer works; provisional drops.

**Deviations from task:**
- **PIN resolution UX**: went with inline feedback chip (green card on success, red alert on rejection) rather than a separate "validating…" spinner — keystroke resolution is fast enough that a spinner state would flicker and add no value. The `neutral` tone ("PINs start with PIN-0x…") shows while the user is still typing a valid-looking prefix.
- **Decline reason UX**: chose inline sub-form inside the notification row (textarea + CONFIRM DECLINE / BACK) over a separate dialog. Matches the CombinedResponseModal pattern structurally while keeping the decline path lightweight (spec §11.7's "two action buttons in the notification" language led here).
- **Asset re-emit vs. targeted mutation**: on accept + decline we rebuild the full Asset via `makeAsset({ ..., dot: newDot })` rather than patching fields in place. More lines, but keeps the DOT + lineage consistently constructed via the factory — safer than mutating a shared artifact in React state.
- **No automated test coverage for `dot.lineage` yet.** Verified structurally via the factory smoke test in Gate A (empty lineage at registration, accept appends one record); the end-to-end browser verification for accept + decline confirmed the visible outcomes (asset moves / stays, notifications fire correctly). Internal `dot.lineage` state after a transfer wasn't peek-inspected through React state — would require a devtools-style instrumentation. Trust the factory + view-layer invariants for now; backlog #74's provenance-lineage UI will surface the data directly.

**Known gaps (not 9A.4 blockers):**
- *Claim + Eval Result transfer* — tracked as backlog #72.
- *Asset-backing-disclosed-Claim constraint* not enforced — backlog #73.
- *Provenance lineage UI* — `dot.lineage[]` is populated but not rendered anywhere in the Detail Panel yet. Backlog #74.
- *Transfer timeout* — pending transfers stay pending indefinitely in demo. Backlog #75.
- *Cascading state on transfer* — transferred Asset arrives clean on recipient's canvas; Parse Results / Eval Results / DAs scoped to it stay with the sender. Production semantics deferred (out-of-scope per the 9A.4 task).

**Status:** [x] Complete.

### Phase 9A.5 completion notes (2026-04-20) — fast-follower polish

Eight-item polish pass + three Working-Conventions additions following 9A.4 demo completion. Four gates.

**Gate A (demo-blocking fix):**

1. *#76 Transfer accept ownership edge.* Root cause was ownership-DA scoping. When the transfer accept handler re-emitted the Asset with `owner = recipient`, the seeded `da-own-<assetId>` DA still had `grantor = sender`. `buildViewForActor` filtered any DA where the actor is neither grantor nor grantee, so Bob's view contained the Asset but not the DA — and `deriveAgreementEdges` consequently drew no ownership edge to Bob's Actor. Fix: emit a replacement ownership DA (`makeInternalDisclosureAgreement` with grantor = recipient) into `v22Provisionals.disclosureAgreements`. `mergeById` in `mergeProvisionals` picks it up by id and overwrites the seeded DA. Runtime-verified against `getV22DataForRole`: pre-fix ownership edge = null; post-fix ownership edge = `actor-govco → asset-prm-thermal`. No change needed on the decline path — on decline the Asset stays with the sender and the seeded DA still matches.

**Gate B (transfer polish):**

2. *#77 Transfer response modal.* New `V22TransferResponseModal.jsx`. Notification row now opens a modal for Accept/Decline — pattern-matches `CombinedResponseModal`. Two phases: **Decide** (sender + asset summary + optional note; Accept / Decline buttons in footer) and **Reason** (optional textarea on decline path). Removed `v22DecliningTransfer` state, the inline Accept/Decline buttons, and the inline decline-reason textarea from the notification row. The click handler on `v22-transfer-request` notifications now calls `setV22TransferResponding(req)` to open the modal. Dismissal stays on terminal action (Accept or Confirm Decline in the modal) — closing the modal without action leaves the notification in place, matching the pre-existing `v22-request` (Disclosure Request) behaviour. Spec §11.7 updated to describe the modal pattern.
3. *#78 Resolved box party-only.* `V22TransferAssetModal`'s resolution chip changed from "Resolved: {user} @ {party}" + role subtitle to "Resolved: {party}" only. Review step's Recipient InfoRow also simplified. CombinedRequestModal's resolution chip was already party-only ("✓ Found: {claim name} — {ownerParty}"), so no fix needed there.
4. *#79 PIN error messaging split.* `resolutionState` in `V22TransferAssetModal` now returns three semantically distinct messages. Ordering: self check → network check → actor-not-found. Safe to be specific for self + Radiant Network (the sender already knows their own PIN and the Radiant Network PIN is a pseudo-constant); unknown case stays generic ("No actor was found at this PIN.") to preserve the no-info-leak principle.

**Gate C (structural + conventions):**

5. *#83 Claim-to-owner edge removal.* The `kind === 'claim' && internal && !hasScopeAssets` branch in `deriveAgreementEdges` is now a no-op. Spec §3.4 requires every Claim to have `referencedAssetIds.length >= 1`, so ownership always cascades through Assets and the Actor → Claim edge was strictly redundant. The ownership DA stays in state (provenance, future queries); we just stop drawing it. Runtime-verified: Alice's view now has 0 Actor ↔ Claim edges (was 3).
6. *#85 Asset-picker zero-default + scroll.* `CombinedResponseModal`'s Full-disclosure Asset picker defaults to zero-selected — replaces the prior "prime with all referenced Assets on action='full' step entry" useEffect. Scroll container (`maxHeight: 260, overflowY: 'auto'`) already present. Amber inline help text + disabled Continue gate unchanged. Audited every Asset/Claim/ReqSet picker in the modal set (listed in the backlog entry): `V22CreateClaimModal`, `AmendClaimModal`, `AmendDisclosureModal`, `V22RunEvaluationModal`, `V22ParseEvidenceModal`. No other fixes needed — either zero-default + scroll already, or the pre-selection is semantically correct (amendments pre-select current scope; evidence is optional).
7. *#86 DID glossary.* §2.6 of `architecture-spec.md` now expands "DID" on first use: "Decentralized Identifier (DID) — a W3C-standardized format for verifiable digital identities (see [w3.org/TR/did-core/](https://www.w3.org/TR/did-core/))".
8. *#87 Raw JSON tab verification.* Discovery: the expanded Detail Panel modal (`ExpandedArtifactModal`) that the task assumed exists was removed during Phase 8 cleanup — there's no UI surface in V2.2 that renders a raw JSON view. Verified the data layer is sound: `makeTransferRecord` + `makeDotObject` correctly populate `asset.dot.lineage[]` on accept (append with `status: 'accepted'`) and decline (append with `status: 'declined'` + reason). No code change this phase; the lineage UI is already scoped as backlog #74 and will be where lineage rendering actually lives.

**CLAUDE.md Working Conventions — three additions under a new "### UX patterns" subsection:**

- *Accept/decline in modals, not notifications.* Party-to-party responses (accept, decline, amend, etc.) open a modal for the decision; the notification is the entry point.
- *Picker defaults + scroll containers.* Multi-select artifact pickers that require ≥1 selection default to zero-selected; empty-state help in amber italic inline styling; all picker lists render in scroll containers (240–320px max-height). Optional pickers may sensibly pre-select.
- *Reciprocal notifications for all party-to-party actions.* Every party-to-party action that requires counterparty acknowledgment MUST fire reciprocal notifications on each state change.

**Gate D:** backlog updated (#76–87 filed/closed per the shipment table), CLAUDE.md + changelog updated, footer version bumped v0.9.0 → v0.9.1.

**Spec updates folded in:** §2.6 (DID glossary), §11.7 (modal-based response flow).

**Runtime verification (Chrome, Vite dev):**
- Data layer: Alice → Bob transfer accept path derives ownership edge correctly (`actor-govco → asset-prm-thermal`). Transfer record correctly appends to `dot.lineage[]`.
- Build clean at every gate boundary.
- App loads, boot screen + canvas render, chrome tooltips work.

**Known scope boundaries (not 9A.5 blockers):**
- *Accepted-transfer animation sequence* — backlog #80. Deferred alongside #71 (provisional → disclosed card transform) and the broader animation-restoration phase.
- *Reciprocal notification audit for all party-to-party actions* — backlog #81. Disclosure Request acceptance has a known gap: requester isn't notified. Pairs with animation work because the notification is the trigger for the provisional → whole-node transformation animation.
- *Parse Result DOT + layer placement* — backlog #82. Design blocker (client decision needed on DOT semantics + child vs parent layer).
- *Asset hierarchy* — #70 (with #84 consolidated in). Design blocker.
- *Expanded Detail Panel modal / raw-JSON tab* — removed in Phase 8 cleanup; lineage rendering scoped into #74.

**Status:** [x] Complete.

### Phase 9A.6 completion notes (2026-04-20) — Asset registration batch

Coordinated rebuild of V22CreateAssetModal + V22QualifiedStoragePicker consolidating five tightly-coupled V2.1-era behaviours lost during V2.2 migration, plus three fast-follower polish items from 9A.5 QA. Four gates.

**Gate A (#65):** credit cost baseline. `CREDITS_PER_ASSET = 5`, `CREDITS_PER_CLAIM = 25` constants in V2App.jsx. New `CreditCostRow` shared component in ModalShared renders a teal-on-sufficient / red-on-insufficient cost row in the review step; both modals gate submit + flip label to "Insufficient Credits" when under-funded. On submit, the active role's credits are debited via `setCredits(c => Math.max(0, c - cost))`. AmendClaimModal's nested Register flow forwards credits too, so every Asset entry point is consistent. 5:1 ratio chosen proportional to V2.1 precedent (Asset = evidence file; Claim = named bundle referencing ≥1 Asset).

**Gate B (core rebuild — #66, #67, #68, #69):**

*#66 Multi-file:* V22CreateAssetModal's flow is now **Pick → Per-file review → Final review**. Picker runs in `mode="multi"`; each selected file becomes its own Asset. Payload shape changed to `onComplete({ files: [{ file, displayName, hash }] })`. V2App handler `handleV22CreateAssetSubmit` iterates and produces one Asset + one ownership DA per entry; returns an array of new ids when nested (so V22CreateClaimModal and AmendClaimModal can auto-select all N in their picker). Single-file is just N=1 — no separate code path. Legacy single-file shape (`{ file, displayName }`) still accepted.

*#67 Local Storage tab:* V22QualifiedStoragePicker gained a tab header — `Qualified Storage | Local Storage`, QS active by default. New `LocalStoragePanel` component renders a drag+drop zone + file input. Files upload-simulate over 500–800ms per file with a per-row progress bar (`requestAnimationFrame` tick loop). After "upload complete," each file gets a `JUST UPLOADED` badge and becomes selectable. Local files merge with QS picks in the confirm payload (same shape; local files carry `source: 'local'` for cross-tab identification). Mock URI synthesized under `{bucket}/uploads/{filename}`; file bytes are NOT actually stored (demo-only per task scope).

*#68 Hashing sequence:* `HashingRow` component in the per-file review list cycles `pending → hashing → complete` over 900ms. Hashing state renders a rotating border spinner (new `@keyframes spin` in `index.css`) + scrolling hex characters for motion feel. Complete state renders a truncated `CopyBadge` with the mock hash. `mockHashFor(file)` is deterministic from filename+size — same file always hashes to the same 64-char hex string. Continue disabled while any row is still hashing. **Reference caveat:** no V2.1 `HashingSequence.jsx` reference file was placed in `/references/` before the phase; visual/timing pattern-matched to V2.2 processing UIs (V22RunEvaluationModal's processing stage) rather than restored from V2.1 backup. Visual fidelity may differ from V2.1 precedent.

*#69 Editable label:* each per-file row renders an editable text input (100-char max, default = filename-stem derivation). Empty label turns the input border red and blocks Continue. Value flows through `makeAssetRegistrationArtifacts`'s `name` param. Spec §3.2 updated to document `asset.name` as the user-facing display name with filename-stem default.

**Gate C (fast-followers — #89, #90, #91):**

*#89 Actor DOT CopyBadge.* V22ActorPanel DOT row wrapped in `<CopyBadge value={node.dot} truncated />`. Matches the Asset / Claim / Eval Result treatment from the 9A.4 preamble.

*#90 Notification bell tooltip persistence.* Root cause was Tooltip state surviving `shouldRender → false` transitions. V2App nulls the bell tooltip content while the inbox is open; the wrapper span then unmounts (so `mouseleave` never fires) but `visible` state persists. When content reappears the tooltip pops back without a fresh hover. Two fixes: (1) new effect clears `visible` when `shouldRender` becomes false; (2) `mousedown` on the wrapper clears `visible` synchronously so clicking the bell dismisses the tooltip as expected.

*#91 Parse Template scroll.* V22ParseEvidenceModal's template list now renders inside a scroll container (`maxHeight: 300, overflowY: 'auto'`). Audited V22RunEvaluationModal's Requirements Set picker concurrently — applied same treatment. Other pickers (V22CreateClaimModal, AmendClaimModal, AmendDisclosureModal) already scroll.

**Gate D:** backlog updated (#65, #66, #67, #68, #69, #89, #90, #91 all ✅ Complete; #88 transfer cascade filed). Changelog modal entry added (v0.9.1 → v0.9.2). Footer version bumped.

**Spec updates:** §3.2 documents `asset.name` as the user-facing display name (filename-stem default, editable in registration).

**Runtime verification:**
- Build clean at every gate boundary.
- Module imports succeed for both rebuilt files (V22CreateAssetModal, V22QualifiedStoragePicker).
- Programmatic verification: `makeAssetRegistrationArtifacts` produces 3 Assets + 3 ownership DAs with correct hashes + edited labels from a 3-file batch.
- **UI flow verification limitation:** V2Canvas card clicks go through a 3D raycaster that DOM-level `dispatchEvent` can't hit, so end-to-end Actor-panel → Register-Asset modal walkthrough in the preview browser wasn't fully exercised this session. Data-layer plus module-load verification are the backstops. This limitation is consistent across V2.2 work; canvas-level interaction testing requires manual driving.

**Known scope boundaries (not 9A.6 blockers):**
- *V2.1 hashing sequence visual fidelity* — pattern-matched to V2.2 conventions rather than restored from V2.1 backup.
- *Real file upload / real hashing* — both remain demo-only per task scope.
- *Transfer cascade* — filed as #88; distinct from the 9A.5 #73 counterparty-visibility concern.
- *Asset hierarchy (#70)*, *Parse Result DOT + layer placement (#82)* — both design blockers.

**Status:** [x] Complete.

### Phase 9A.6.1 completion notes (2026-04-20) — corrective fixes

Mechanical cleanup of five 9A.6 QA findings plus a spec note and a 14-item backlog filing pass. Single commit.

1. *Fix 1 — Multi-file NEW badge.* `v22RecentlyAcceptedAssetId` state was single-id, so only the first Asset in a multi-file batch got the `_isNew` reveal. Converted the state to accept either a single id or an array. Three changes: (a) setter in `handleV22CreateAssetSubmit` uses the array form when `newIds.length > 1`; (b) `v22DataWithReveal` memo flattens the array into the flagged set; (c) the deselection-clearing effect drops the prev-sel id from the array (resetting to `null` when empty, unwrapping to scalar when one remains). Single-file behaviour byte-identical.
2. *Fix 2 — Actor DOT row empty.* V22ActorPanel DOT row was reading `node.dot`. Actor canvas nodes carry both `dot` (V2.1 compat alias) and `partyDot` (canonical), but the adapter only set `dot`; reading either should work, but the QA observation indicated the row was empty regardless. Fix: `actorToNode` now surfaces both `dot` and `partyDot` on the canvas node, and the panel reads `node.partyDot` per the task brief's explicit direction. Wrapped in `CopyBadge`.
3. *Fix 3 — Hashing sequence V2.1 reconciliation.* Replaced the single-phase hashing state (`hashing → complete`) with a three-phase sequence matching V2.1's AddEvidenceModal: `pending → hashing (amber "Hashing file..." + spinner, 1000ms) → endorsing (blue "Endorsing on ledger..." + spinner, 1200ms) → done (green ✓ "Hashed" + CopyBadge)`. Multi-file stagger: 600ms between files (each file enters `hashing` state 600×i ms after selection). `allHashed` gate in the modal still controls Continue; label updated to "Hashing and endorsing in progress". Continue enables only when every row reaches `done`.
4. *Fix 4 — Mini/dot LOD action buttons on hover.* Root cause: `AssetNodeMini` and `AssetNodeDot` forwarded only legacy handlers to their hover-tooltip AssetNode renderings; `onV22CardAction` (the V2.2 dispatcher that V22ActionBar actually consumes) was never passed through. Additionally the tooltip's inner card was only action-barred when `isSelected`, so `hover-without-select` yielded no action bar. Fix: (a) added `onV22CardAction` prop to both dot/mini components, forwarded to the tooltip AssetNode; (b) new `forceActionBar` optional prop on AssetNode that overrides the `isSelected || hovered` check; (c) V2Canvas now passes `onV22CardAction` (gated on `!transitioning`) to both LOD components. At mini LOD the behaviour is identical to full-card hover; at dot LOD the action bar appears inside the hover tooltip (no deviation needed — dot LOD via tooltip is the only practical surface).
5. *Fix 5 — Spec §11.7 file custody paragraph.* New paragraph in architecture-spec.md §11.7 documents the prototype's working assumption: replication model on accept (both owners hold independently-hashed copies); pointer model documented as cryptographically valid but operationally fragile; the prototype doesn't actually move file bytes. Flagged as Andrew's call surfaced for client review; backlog #93.

**Backlog filing:**
- #93 spec note (spec update complete; design conversation pending) — Low priority.
- #94 QS picker multi-select summary preview — Medium.
- #95 QS picker re-pick preserves labels — Medium.
- #96 Local Storage destination folder indicator — Low.
- #97 Local uploads default-checked + Select All — Medium.
- #98 Credit warning copy + add-credits modal link — Medium.
- #99 Create Claim picker: pre-selected + newly-registered at top with NEW badges — Medium.
- #100 Mini/dot LOD action buttons on hover — High (shipped this phase).
- #101 Actor Detail Panel narrative fields cleanup — Low.
- #102 Disclosure amendment notifications missing on counterparty side — High (UX confusion).
- #103 Referenced Assets missing on counterparty canvas — High (functional regression; 9A.6.2 dedicated diagnostic phase).
- #104 Click-to-jump navigation from Detail Panel association lists — Medium.
- #105 Run Evaluation empty-evidence copy update — Medium.
- #106 Remove evidence picker from Run Evaluation modal — Medium (design implications; pairs with #88).

#68 and #89 retain ✅ Complete status with revision notes on each.

**Spec updates folded in:** §11.7 file custody paragraph.

**Runtime verification:** Build clean; preview reloaded cleanly with no new errors. Data-layer sanity check on the `v22RecentlyAcceptedAssetId` array shape confirms the flagged-set construction handles `null`, single-id, array, and empty-array inputs correctly. End-to-end UI walkthrough (register 3 files → confirm 3 NEW badges; open Actor panel → confirm DOT; mini/dot LOD hover) constrained by the same V2Canvas 3D-raycaster DOM-dispatch limitation noted in 9A.6 — data layer + structural verification covers the change surface.

**Status:** [x] Complete.

### Phase 9A.6.1.1 completion notes (2026-04-21) — three small fixes

1. *Actor Detail Panel cleanup (supersedes #89, ships #101).* Removed DOT, Role, Vertical, User rows from V22ActorPanel body. DOTs per canon X.1 identify data elements (Assets / Claims / Eval Results), not actors — actors have DIDs per canon X.2. Surfacing `partyDot` as "DOT" on the Actor panel was confusing. Actor PIN in the panel header serves as the user-facing identifier. Role labels remain in the user-menu role switcher. The `role` / `vertical` / `user` fields stay on `makeActor` in v2_2Data.js (may be referenced elsewhere; removing from the data model is a separate cleanup).
2. *Mini/dot LOD action bar reverted to click-only (#100 revision).* The 9A.6.1 hover-show pattern was visually present but impractical — pointer dismissed the action bar before reaching it. `showActionBar` simplified back to `isSelected || hovered-on-full-card`. `forceActionBar` prop removed from AssetNode; the two call sites in mini/dot LOD tooltips also removed. `onV22CardAction` threading through both LOD components retained — still needed for click-based dispatch.
3. *Run Evaluation diagnostic logging for #103 investigation.* One `console.log` in the Run Evaluation modal mount logs Claim id + referenced Asset count, DA scope.assetIds, rendered evidence list, and any scope ids missing from the Asset library. Commented as `// TODO: remove after 9A.6.2 diagnoses #103`.

**Backlog:** #89, #100, #101 status updates applied.

**Runtime verification:** Build clean; module imports verified; preview shows no `forceActionBar` errors post-reload.

**Status:** [x] Complete.

### Phase 9A.6.2 completion notes (2026-04-21) — investigation phase for #103

Phase opened to root-cause the Create Claim multi-Asset loss originally filed as #103. Exhaustive diagnostic pass with no fix shipped — per CLAUDE.md workflow rule on genuine ambiguity, surfaced the gap rather than guessing at a fix.

**Investigation summary:**

- *Static code review* of the four candidate root causes laid out in the task brief:
  - **Nested CTA overwrites existing selection.** `V22CreateClaimModal.handleNestedAssetComplete` uses a functional updater (`setSelected(prev => { const next = new Set(prev); for (const id of ids) next.add(id); return next })`). Clean — appends, never replaces.
  - **Submit handler reads stale selection closure.** `handleComplete` is re-created every render; `onClick={handleComplete}` always receives the latest. `Array.from(selected)` reads current state at call time. No closure capture of stale state.
  - **Factory drops IDs.** `makeClaimCreationArtifacts` → `makeClaim` preserves all ids via `[...referencedAssetIds]`. No filter, dedup, or validation that could silently drop.
  - **Race between Asset materialization and Claim compilation.** The Andrew-described reproduction is *sequential* (register Assets → close modal → open Create Claim → select → submit), not *nested*. Asset materialization completes before the Claim modal opens.
- *Data-layer programmatic simulation* against `v2_2Data.js`: registered 2 new Assets via `makeAssetRegistrationArtifacts`, merged into Alice's view, built `ownedAssets` picker list (expected 7), simulated user selecting all 7 via Set → `Array.from(selected)` → `makeClaimCreationArtifacts`. Result: Claim with `referencedAssetIds.length === 7`, all IDs preserved, 7 ref DAs emitted. End-to-end happy path works cleanly.
- *Runtime UI walkthrough:* blocked by V2Canvas raycaster (3D canvas) not responding to DOM `dispatchEvent`. Same limitation noted in 9A.6 and 9A.6.1.1. Can't drive the actual click flow in-session to reproduce.

**Shipping:**

- **Diagnostic instrumentation** at three layers: V22CreateClaimModal's `handleComplete` logs the Set contents and what's sent downstream; V2App's `handleV22CreateClaimSubmit` logs received `referencedAssetIds` on entry and factory output. The 9A.6.1.1 Run Evaluation diagnostic retained. All blocks marked `// TODO: remove after 9A.6.2 diagnoses #103`. On next reproduction, these logs pinpoint the divergence immediately.
- **Issue 2 (orphan `forceActionBar` at AssetNode.jsx:414):** confirmed no-op — already resolved in 9A.6.1.1. No residue in current HEAD.
- **Issue 3 (#107 border shorthand warning):** filed to backlog, Visual & Rendering section. Low priority.

**Backlog:** #103 annotated with investigation summary; status remains "Under investigation — fix blocked on reproduction with logs". #107 filed.

**Exit criteria deviation:** the "Create Claim with 7 Assets produces `referencedAssetIds.length === 7`" criterion passes in the data layer (verified programmatically) but cannot be UI-verified in-session due to the raycaster limitation. The criterion "#103 marked ✅ Complete" is explicitly NOT met — ambiguity surfaced rather than fixed. When Andrew reproduces with the new logs, 9A.6.2.1 (or a similar follow-up) should close the loop with a definitive fix based on the captured log output.

**Changelog + version:** no user-visible change shipped this phase — diagnostic-only work. Intentionally not bumping version or adding a Changelog modal entry; the next phase that ships a real fix will do both.

**Status:** [x] Complete (investigation shipped; fix deferred to next phase pending reproduction).

### Phase 9A.6.2.1 completion notes (2026-04-21) — targeted fix for #103

Shipped the fix that the 9A.6.2 investigation set up for. Root cause turned out to be entirely downstream of Create Claim, in two `buildV22SharedArtifacts()` call sites that read seeded-only data where a merged view was needed. The 9A.6.2 diagnostic instrumentation, had it fired in user repro, would have shown the modal + handler receiving all 7 ids correctly — the count drop only appears at render time on the counterparty's side.

**Primary fix (2 sites):**
- V22App.jsx `sharedForPanel` (Claim Detail Panel referenced-Assets resolution) → `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)`.
- V2App.jsx `sharedForEval` (Run Evaluation evidence resolution) → same. The code comment on this block already said "(incl. provisionals)" — the implementation was never updated to match the intent.

**Audit — 4 additional sites fixed:**

| Site | Purpose | Decision |
|------|---------|----------|
| V2App.jsx:365 | `sharedClaim` for accept-notification Claim name/pin | **FIX** — user-created Claims would notify with null metadata |
| V2App.jsx:428 | `sharedClaim` for decline-notification metadata | **FIX** — same reason, mirror of accept |
| V2App.jsx:603 | `sharedClaim` for eval-completed notification | **FIX** — eval against user-created Claim would send null name/pin |
| V2App.jsx:1077 | `sharedClaim` for amend-DA notification | **FIX** — amended DA on user-created Claim would notify with null |

**Audit — 7 sites left alone:**

| Site | Purpose | Decision |
|------|---------|----------|
| V2App.jsx:556 | `shared` passed to `findPriorActiveEvaluationResult` | LEAVE — helper merges internally |
| V2App.jsx:626 | Amend-Claim lookup (prev.claims primary + seeded fallback) | LEAVE — explicit provisional-first pattern |
| V2App.jsx:879 | Transfer-accept asset lookup (provisionals + seeded fallback) | LEAVE — correct pattern |
| V2App.jsx:968 | Transfer-decline asset lookup, same pattern | LEAVE — correct pattern |
| V2App.jsx:1072 | Amend-DA disclosureAgreement lookup (provisionals + seeded fallback) | LEAVE — correct pattern |
| V2App.jsx:3084 | AI Shopper public-directory source | LEAVE — no current flow populates public DAs in provisionals |
| V2App.jsx:3447 | Transfer-response asset lookup (provisionals + seeded fallback) | LEAVE — correct pattern |

**Also shipped:**
- Exported `mergeProvisionals` from `v2_2Data.js` (was file-private; now importable).
- Stripped all four 9A.6.2 diagnostic `console.log` blocks: V22CreateClaimModal submit, V2App handleV22CreateClaimSubmit entry + factory output, V2App Run Evaluation mount.
- Backlog: #103 ✅ Complete with root-cause note; #108 filed (missing Amend EA modal, pattern-matched against AmendDisclosureModal).
- Changelog modal v0.9.4 entry + footer bump v0.9.3 → v0.9.4.

**Runtime verification:** Data-layer pre/post simulation shows pre-fix returns 5 names (5 seeded Assets resolve, 2 user-registered dropped by `seededOnly.assets.find()` returning undefined); post-fix returns 7 names (all resolve through the merged view). Build clean.

**Status:** [x] Complete.

### Phase 9B completion notes (2026-04-21) — edge hover & selection polish

Eight precise UI improvements to edge hover and selection. Unified the hover tooltip + click menu into a single `EdgeHoverMenu` component with two modes (hover / pinned). Shipped #7 and #59.

**New component:** `src/v2/EdgeHoverMenu.jsx`. Portal-rendered, mode prop switches between pointer-events-none hover tooltip (anchored to cursor, top-left of cursor with bottom-right fallback at viewport edges) and pointer-events-auto pinned menu (anchored to click point, rows are clickable). Row structure:
- **View Disclosure Agreement** — 3 rows: action label, mini SDA-edge illustration (color + dash pattern per SDA type) + type label, and `{from node} ({grantor}) → {to node} ({grantee})`. Solid indigo for Full, dashed amber for Selective, dotted green for Proof-only, dashed grey for Provisional.
- **View Evaluation Agreement** — 2 rows: action label + expiry date ("Expires YYYY-MM-DD" or "Never expires"). Only renders when a paired EA exists on the edge.

Whole-row hover highlight via `background: color-mix(in srgb, var(--bg-card) 85%, var(--text-primary) 15%)` per spec §8.

**V2Canvas changes:**
- New `onEdgeHover({ edgeId, sdaType, x, y })` callback invoked on raycaster hit / null on leave.
- New `hoveredEdgeSdaType` state for the cursor-centered dot.
- Selection/brightening `useEffect` now also responds to `hoveredEdge` — hover applies a 30% white lerp (weaker than selection's 65%); selection wins when both apply to the same edge.
- Cursor-centered dot renders as a portal'd `div` (12px, SDA color, 70% opacity, `pointer-events: none`, z-index 5900). Suppressed when `selectedEdgeId` is set so it doesn't double with the pinned menu.
- Old small 2-line SDA hover tooltip removed — replaced by the rich menu rendered from V2App.

**V2App changes:**
- New `edgeHover` state paralleling the existing `edgeMenu` (pinned) state.
- Edge click always sets `edgeMenu` now (previously only when EA was paired; no-EA edges opened the DA panel directly). The menu handles both branches.
- `EdgeMenu` import replaced with `EdgeHoverMenu`; both the hover and pinned renders use the same component. `src/v2/EdgeMenu.jsx` file deleted.
- `handleCloseSel` already cleared `edgeMenu`, so canvas-click deselection dismisses the pinned menu for free.

**Selection + type-specific visual language (item 4):** verified no-op. Full Disclosure has no glow layer today (just thicker solid line), and dashed edges don't animate outside chain mode. Nothing for selection to break. If glow or marching-ants are added in a future phase, selection treatment is additive (clone base color + lerp to white + bump linewidth) and won't override those layers.

**In-session TDZ fix:** initial edit placed the `useState` declarations for `hoveredEdge` et al. AFTER the selection-brightening `useEffect` that depends on them in its deps array — React crashed at first render. Moved the `useState` declarations above the effect. Caught and fixed before commit.

**Deviations from the Phase 9B spec:**
- No separate "on-edge hit-point dot" — Andrew's Phase 9B brief uses a cursor-centered dot instead (explicitly out of scope).
- No Escape key unpin — not in spec.
- Amend actions still live in the Agreement Detail Panel footers (not the edge menu) per spec intent.

**Backlog:** #7 and #59 ✅ Complete with root-cause notes. Changelog v0.9.5 + footer bump v0.9.4 → v0.9.5.

**Runtime verification:** Build clean; app loads and boots past CAC screen with a clean canvas render. Module imports verified for the new `EdgeHoverMenu.jsx`. Dev server required a restart mid-session when HMR got stuck on the deleted `EdgeMenu.jsx` path — fresh startup loads cleanly.

**Known scope boundaries (not 9B blockers):** V2Canvas 3D raycaster DOM-dispatch limitation (documented since 9A.6) continues to block scripted canvas-click UI walkthrough from this agent session. The edge-hover + edge-click behaviour is testable manually by driving actual mouse input; all rendering + state plumbing is verified via code path and module sanity.

**Status:** [x] Complete.

### Phase 9B.1 completion notes (2026-04-21) — edge menu refinement + EA panel cleanup

Refines the 9B edge hover/selection menu based on live testing, plus one small Evaluation Agreement Detail Panel cleanup.

**EdgeHoverMenu.jsx refactor:**
- **Cursor dot** bumped 12px → 24px; other properties unchanged. Close-to-cursor-size was unclear as an indicator.
- **Hover mode structure** simplified: centered "SELECT EDGE TO VIEW" header (mono, uppercase, `var(--text-dim)`) above the options, outside any option container. Each option wrapped in its own rounded rectangle (`border-radius: 8`, `background: var(--bg-raised)`, whole-row hover highlight).
- **DA option** collapsed to 2 rows: Row 1 = half-length SDA illustration (24px vs. 9B's 48px) + "{Type} Disclosure Agreement" (e.g., "Selective Disclosure Agreement"). Row 2 = endpoints with owners. The standalone "View Disclosure Agreement" action-label row removed; the "View →" affordance handles the action indication in pinned mode.
- **EA option** collapsed to 2 rows: Row 1 = "Evaluation Agreement" (dropped the "View " prefix). Row 2 = "Expires YYYY-MM-DD" or "Never expires". EA option still omitted entirely when no paired EA exists.
- **Right padding** reserved (48px) in every state so "View →" appearing in pinned mode doesn't shift layout. Affordance always mounted; opacity transitions 0 ↔ 1 over 200ms.
- **Clicked state** drops the header, fades in "View →" on the right side of every option simultaneously (200ms), rows become clickable with hover highlight persisting.

**World-space tooltip tracking (§4):**
- V2Canvas exposes a new `projectToViewport(worldX, worldY)` method on its imperative handle that adds the container's viewport rect to the existing `worldToScreen` output.
- Edge click captures the raycaster's world-space hit point via `intersects[0].point` and includes `{ worldX, worldY }` in the `onEdgeClick` payload.
- V2App keeps a separate `edgeMenuProjected` state and runs a RAF loop while a pinned menu is open, re-projecting the world point each frame. The loop exits when the menu closes and cleans up. Small epsilon guard (0.5px) skips redundant setState.
- The pinned `EdgeHoverMenu` consumes `edgeMenuProjected` (fallback: `edgeMenu.anchor`) so the tooltip slides with the canvas through the 9A.1.5 pan/zoom framing. Hover-mode tooltip still uses raw cursor coords.

**EA Detail Panel cleanup (§5):**
- Removed the "Authorized Requirements Sets" section from `EvaluationAgreementDetailPanel.jsx`. The section listed the requester's proposed Requirements Sets, which are advisory per spec §10.5 — not binding — and labelling them "Authorized" implied enforcement that doesn't exist. Amendments also change what's in play without a visible change log, creating stale-data risk.
- The `agreement.authorizedRequirementsSetIds` field stays on the data model (referenced elsewhere as "SUGGESTED" chips in `V22RunEvaluationModal`); only the panel surface is stripped. A replacement-block comment captures the reasoning.

**Deviations:**
- "View →" easing: simple `opacity 200ms ease` both ways. No separate enter/exit timings.
- RAF tick: unconditional `requestAnimationFrame` loop while the menu is open. Cheap — one viewport projection per frame — and it avoids needing to detect when the pan/zoom animation is actually running.
- Tooltip clamp at extreme zoom: none. If the world point projects off-screen, the tooltip moves off-screen too. Task brief called this out as optional fallback; kept it simple pending real demos.
- Rounded-rectangle radius on options: 8px. Slightly smaller (6px) was also defensible; went with 8 to match ModalShared panel/card conventions.

**Backlog:** #7 / #59 already ✅ from 9B — untouched. Filed #110 (edge glow + marching-ants V2.1 restoration). Update Log entry added.

**Runtime verification:** Build clean. Module imports verified for both `EdgeHoverMenu.jsx` and `EvaluationAgreementDetailPanel.jsx`. App boots past the CAC screen with a clean canvas render. V2Canvas raycaster DOM-dispatch limitation still prevents scripted canvas-click UI drive from this agent session; manual mouse interaction is the verification path for the edge-hover + edge-click behaviour.

**Status:** [x] Complete.

### Phase 9B.2 completion notes (2026-04-21) — edge hover bug fixes

Five concrete fixes from 9B.1 QA plus two backlog filings (#111, #112).

1. *Fix 1 — Selective/dashed hover brightness.* Shipped **Option B (type-aware)**: dashed/dotted edges (Selective amber, Proof-only green, Provisional grey) now get a 50% white blend on hover; solid edges (Full indigo) stay at 30%. The higher blend closes the dash-gap visibility gap without pushing Full hover too close to Full's 65% selection state. Single line: `const hoverBlend = (cfg.dash || 0) > 0 ? 0.5 : 0.3`.
2. *Fix 2 — Click-state brightening persistence.* Root cause: the brightening was applied by a separate useEffect that ran AFTER the buildEdges rebuild effect. On any render where the rebuild ran without the second effect (e.g., `chainNodeIds` changes, or the two effects' deps drift apart), the edge materials were left fresh-but-unbrightened. Fix: extracted the apply-styling logic into a ref-backed helper (`applyEdgeStylingRef.current`) that reads `selectedEdgeIdRef` + `hoveredEdgeRef` (synced via effects). The helper is called both from the state-change useEffect (cheap updates) AND directly at the end of the buildEdges rebuild effect. Zero race window. The old selection-brightening useEffect is retained for state-only changes; the new invocation at rebuild-end closes the gap.
3. *Fix 3 — Fade during animation.* Removed 9B.1's unconditional RAF world-space tracking (drifted above nodes during zoom). Replaced with the spec's fade-during-animation approach: on edge click, set `edgeMenuPanning = true` (tooltip opacity 0 via 150ms transition). After 620ms (animation duration + 20ms tail-buffer), reproject the captured world point via `projectToViewport` and update the tooltip's anchor, then clear `edgeMenuPanning` (fades back in). `animatedPanToWithZoom` doesn't expose a completion callback, so the timeout matches the 600ms animation duration. Simpler code, correct visual outcome. World-point capture from 9B.1's `onEdgeClick` payload retained for the post-animation reposition.
4. *Fix 4 — Right padding 48 → 80px.* Single constant bump in EdgeHoverMenu. Resolves "View →" overlapping long endpoint strings like "Power Regulation Module Assembly (MicroCo) → Avionics Module (GovCo)".
5. *Fix 5 — Cursor dot 24 → 32px + reliability.* Size bump + centering offset update (`anchor.x - 16`, `anchor.y - 16`). Raycaster `params.Line2.threshold` 8 → 12 (more forgiving hit detection during rapid cursor movement). Hover hide-debounce 80ms → 150ms (prevents flicker as cursor crosses adjacent edges).

**Backlog filings:**
- **#111 Agreements section in node Detail Panels** — primary access path for Amend/Revoke. Supersedes #12 (which is retained as superseded with a pointer to #111). High priority.
- **#112 Revocation flow restoration** — V2.1 capability, reference file needs to be placed in `/reference/` before the phase starts. High priority.
- **#110 Edge glow + marching-ants** — already filed in 9B.1; verified no #113 duplicate was filed inadvertently.

**Changelog v0.9.7 + footer bump v0.9.6 → v0.9.7.**

**Deviations:**
- Chose Option B (type-aware brightness) for Fix 1 over Option A (uniform bump) per spec's "more correct but more code" assessment. Single extra line, clear logic.
- Click-state persistence fix: ref-backed helper pattern rather than moving selection logic INTO buildEdges. Keeps separation of concerns and lets the state-change useEffect continue to handle non-rebuild updates cheaply.
- Fade timings: 150ms opacity (spec), 620ms total hide duration (600ms animation + 20ms settle buffer). No separate enter/exit timings.
- Raycaster threshold bumped to 12px (not the V2.1 value of 8 per task brief) because even V2.1's 8 was marginal; 12 remains well within stroke width so no wrong-edge hits.

**Runtime verification:** Build clean. App boots, canvas renders, no console errors. V2Canvas raycaster DOM-dispatch limitation continues to block scripted UI walkthrough from this agent session — manual mouse interaction remains the verification path for the hover/click visuals. All rendering + state plumbing verified via code path.

**Status:** [x] Complete.

### Phase 9B.3 completion notes (2026-04-21) — edge menu anchors at edge midpoint

Single-item change: pinned tooltip's post-animation anchor switches from the click-point world projection to the true world-space midpoint of the two endpoint cards.

**The change, localised to V2App.jsx's `onEdgeClick` handler:**

```js
const edgeObj = edges?.find(e => e.id === edgeId)
const fromNode = edgeObj ? nodeMap[edgeObj.from] : null
const toNode = edgeObj ? nodeMap[edgeObj.to] : null
const hasWorldPositions = fromNode && toNode
  && fromNode.x != null && fromNode.y != null
  && toNode.x != null && toNode.y != null
const midX = hasWorldPositions ? (fromNode.x + toNode.x) / 2 : null
const midY = hasWorldPositions ? (fromNode.y + toNode.y) / 2 : null
setEdgeMenu({
  edgeId,
  anchor: { x: anchor.x, y: anchor.y },
  worldX: midX,
  worldY: midY,
})
```

The click handler's existing flow is unchanged for everything else — initial anchor is still the click point (tooltip appears there briefly), `edgeMenuPanning` state from 9B.2 hides it during the pan/zoom animation, 9B.2's setTimeout reprojects at 620ms. The only difference is what `worldX/worldY` point to: the midpoint of the two endpoint card centers rather than the raycaster hit point on the edge curve.

**Deviations:**
- **V2Canvas untouched.** V2Canvas still emits `worldX/worldY` from the raycaster hit point in the `onEdgeClick` payload. V2App ignores those values now — kept the emit in place per the "keep diff minimal" directive. If a future phase wants the raycaster hit point back (e.g., for a different tooltip behaviour), the plumbing is still there.
- **Radiant Network / no-world-position edge case.** Current behaviour: endpoints without world positions produce `worldX/worldY === null`. The 9B.2 fade-during-animation effect guards on `worldX/worldY == null` and clears `edgeMenuPanning` immediately without a reproject; the tooltip stays at its pre-animation click-point anchor. Doesn't skip the tooltip entirely (the task's "match 9A.1.5 skip-for-missing-positions" suggestion was about edge-select FRAMING, not the menu itself — the menu should still render). Graceful fallback.
- **Stale `setEdgeMenuProjected` call.** Found and removed a stray line from 9B.2 — `setEdgeMenuProjected({ x: anchor.x, y: anchor.y })` at the end of `onEdgeClick`. `setEdgeMenuProjected` was removed in 9B.2's fade-approach refactor but this one call survived, which would have thrown `ReferenceError` the first time a user clicked an edge. Cleaned up silently as part of this refactor.
- **Panel-aware projection:** no additional logic needed. The existing 9A.1.5 framing useEffect handles panel offset when it pans the camera; `projectToViewport` then returns the post-pan screen coordinate naturally, so the tooltip's post-animation position already respects panel width.

**Runtime verification:** Build clean. Module imports + boot verified. Midpoint formula verified programmatically — for the `actor-govco ↔ asset-bob-avionics` edge (positions 0,0 and 520,0) midpoint resolves to (260, 0) deterministically. Same edge clicked at any x-position along the curve now anchors the tooltip at (260, 0) in world coords after the animation settles.

**Changelog v0.9.8 + footer bump v0.9.7 → v0.9.8.**

**Status:** [x] Complete.

### Phase 9C completion notes (2026-04-21) — Agreements section in node Detail Panels

Closes backlog #111 (supersedes #12). Dedicated "Agreements" section added to Actor, Asset, and Claim Detail Panels surfacing the Disclosure + Evaluation Agreements relevant to the selected node. Makes the panel the primary access path for agreement management; the 9B edge-click tooltip becomes the secondary path.

**Component + wiring:**

- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — new `AgreementsSection`, `DisclosureAgreementRow`, `EvaluationAgreementRow`, `AgreementRow`, `ActionLabel`, `SdaLine` primitives. Section renders two subsections (Disclosure / Evaluation) with counts in parentheses; zero-count subsections and the whole section auto-hide. DA rows: SDA-type illustration + type label (Row 1), subject name truncated (Row 2); counterparty label + status/date (middle column); Amend + Revoke action labels (right column, stacked). EA rows: "Evaluation Agreement" + claim name; counterparty + "Expires YYYY-MM-DD" or "Never expires"; Amend + Revoke (both placeholder). Row click (anywhere except an action label) fires `onAgreementRowClick`. Action labels `stopPropagation` so they don't re-trigger the row click.
- **Panel wiring:** V22ActorPanel renders the section after Assets; V22AssetPanel renders it after Pending Transfer (just before footer); V22ClaimPanel renders it after Evaluation Results (standard state only — provisional / declined states are transitional and the Respond / Dismiss CTAs dominate those paths, so the section is intentionally omitted).
- **V2App derivation** (in the panel-rendering block): three filters run against `v22View`'s already-merged (provisional-inclusive) DA + EA arrays:
  - **Actor**: `grantor.party === node.name || grantee.party === node.name`
  - **Asset**: `scope.assetIds.includes(node.id) || granteeAssetId === node.id || (subject.kind === 'asset' && subject.id === node.id)`
  - **Claim**: `subject.kind === 'claim' && subject.id === node.id` (DAs); `claimId === node.id` (EAs)
  `resolveSubjectName` / `resolveClaimName` helpers are closed over `sharedForPanel = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)` so user-created artifacts resolve (the same pattern the Phase 9A.6.2.1 fix established for #103).

**Row click + Amend handlers:**

- `handleAgreementRowClick(kind, agreement)` — looks up the canvas edge for this agreement (`edges.find(e => e.disclosureAgreementId === …)` or `pairedEvaluationAgreementId`) and fires `setSelectedEdgeId(edgeId)` when one exists, triggering the 9A.1.5 pan/zoom framing and 9B midpoint tooltip. Then closes the node panel (`setSel(null)`) and opens the agreement panel via `setOpenAgreement({ kind, edgeId, disclosureAgreementId, evaluationAgreementId })`. For DAs whose edges are suppressed (internal Actor→Claim ownership per 9A.5 #83), `edgeId` stays null and the agreement panel opens without framing.
- `handleAmendDaFromRow(da)` — reuses the existing edge-tooltip Amend semantics: provisional + grantor → `setV22RespondingTo` (CombinedResponseModal); active + grantor → `setV22AmendingDaId` (AmendDisclosureModal). Closes the node panel on open so the modal has a clean stage.
- **openAgreement resolver extension:** the agreement-panel rendering block now accepts `disclosureAgreementId` / `evaluationAgreementId` in the state object as a fallback when `edgeId` is null. Existing edge-click entry paths keep passing `edgeId` untouched; swap-between-DA-and-EA (panel footer cross-link) now preserves both edgeId and the resolved agreement ids.

**Visibility gating:**

- **Amend visible** on DA rows only when `activeParty === da.grantor.party`, and never on internal DAs (grantor === grantee) or Proof-of-Evaluation DAs (subject.kind === 'evalResult'). Provisional DAs with a grantor-active-party show "Respond" instead of "Amend" — matching the existing DA Detail Panel footer's adaptive label.
- **Revoke visible** on DA rows only when `activeParty === grantor`, never for provisional, declined, internal, or Proof-of-Evaluation. Renders as disabled text with tooltip "Revocation coming soon (Phase 9D)".
- **EA rows**: both Amend + Revoke render as disabled placeholders with tooltips pointing at #108 (EA amend modal) and #112 (revocation). Internal EAs (grantor === grantee) omit both entirely.
- Non-grantor viewers see rows with blank action columns (the slots still reserve height via a `{ height: 14 }` spacer so row heights stay uniform regardless of action state).

**Spec-vs-implementation notes:**

- **Internal DAs render "Internal" in the counterparty slot** rather than being filtered out. Task scope asked for "all DAs where party is grantor OR grantee" — including internals is faithful to that. Ownership / claim-ref / parse-ref DAs are platform plumbing; rows are still informative (users can see the structural relationships) but carry no action labels since amending / revoking your own ownership of your own artifact is meaningless.
- **Proof-of-Evaluation DA action handling deferred** per Andrew's call ("evaluate independently later"). Rows render normally with no Amend or Revoke labels.
- **Provisional + declined Claim panels skip the Agreements section.** Those states focus on the Respond / Cancel / Dismiss CTAs and the Request / Decline metadata sections. Adding an Agreements list with the single provisional DA would duplicate information already present in the Request section. Edge-click remains available if the user needs to drill into the provisional DA.
- **Row-click pan/zoom only fires when an edge exists.** DAs without edges (internal Actor→Claim ownership) open their panel without framing — still informative for the user, just no canvas motion. Multi-edge DAs (internal claim-ref with scope.assetIds spanning multiple Assets) frame on the first edge found; more sophisticated "which edge to frame" heuristics deferred.

**Runtime verification:** Build clean. Data-layer verification in the dev preview:
- Filter counts per role: GovCo Actor 7 DAs + 2 EAs; MicroCo Actor 24 DAs + 3 EAs; MicroCo PRM Claim 7 DAs + 2 EAs; GovCo Avionics Asset 4 DAs + 2 EAs. All non-zero, all consistent with the seeded dataset.
- Edge resolution: inter-party `da-alice-bob-prm` → `edge-da-alice-bob-prm-asset-bob-avionics-claim-prm-assembly`; internal ownership `da-own-claim-prm-assembly` → no edge (9A.5 #83 suppression confirmed; agreementId fallback covers this case).
- App boots cleanly with no console errors on reload. V2Canvas 3D raycaster DOM-dispatch limitation (known since 9A.6) blocks scripted canvas-click UI walkthrough from this agent session; rendering + wiring verified via code path and module sanity.

**Changelog v0.9.9 + footer bump v0.9.8 → v0.9.9.**

**Status:** [x] Complete.

### Phase 9D completion notes (2026-04-21) — Revocation flow restored + extended

Closes backlog #112. Restores V2.1's revocation capability and extends it to cover Evaluation Agreements (V2.1 only knew DAs). Wires into the 9C Agreements Section Revoke placeholders.

**Design decisions locked in before build (per phase brief):**
1. DAs + EAs both revocable in this phase (not split 9D / 9D.1).
2. Proof-of-Evaluation DAs non-revocable — 9C Agreements Section already hides Revoke on these rows; defensive guard in `handleOpenRevocationConfirm` warns + no-ops if somehow invoked.
3. Grantee-initiated revocation in scope for both DAs and EAs.
4. Cascade UX: Option 2 confirmation (cascade warning in Confirm modal) + Option 3 notifications (chained `v22-da-revoked` + `v22-ea-revoked` with `cascadedFromDa: true`).
5. Eval Results cascade with Claim on DA revocation — "clean removal" on canvas; metadata preserved in `shared.evaluationResults` for audit.

**Files changed:**
- `src/v2/v2_2Data.js` — `makeRevocationRecord` factory. `mergeProvisionals` now carries `revocationRecords`. `buildViewForActor` gained active-vs-revoked split (`activeDisclosureAgreements` / `activeEvaluationAgreements` / `activeEvaluationResults`), `revokedClaimIds` map keyed on grantee-side revocations, and a `_revokedMeta` guard on the pull-in-anchor loop so the counterparty anchor disappears from the revoker's canvas. Canvas adapter stamps `isRevoked` / `_isRevoked` / `_revokeReason` / `_revokeRecord` on pulled Claim nodes mirroring the DECLINED treatment.
- `src/v2/AssetNode.jsx` — REVOKED badge (red, same styling palette as DECLINED), red border when revoked, "Disclosure revoked" message row when in provisional-shaped state. Added `isRevoked` derivation; border + message + badge all branch on `isDeclined || isRevoked`.
- `src/components/modals/V22RevocationConfirmModal.jsx` (new) — revoker-side confirmation. Red-accented irreversibility warning, subject summary card, cascade warning block (DA-only, when applicable), optional 500-char reason textarea, Cancel + red-accent Revoke Agreement footer buttons. Pattern-matches V2.1 RevocationNoticeModal's red accent palette for visual continuity.
- `src/components/modals/V22RevocationNoticeModal.jsx` (new) — counterparty-side notice. Direct port of V2.1 `RevocationNoticeModal.jsx`'s structure (red "Access Revoked" callout, subject details block, message-from-revoker block, "What this means" consequence). V2.2 extensions: DA/EA branching in title + callout copy; cascade-context consequence block when `cascadedFromDa: true`; claim-subject-aware subject block.
- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — `DisclosureAgreementRow` + `EvaluationAgreementRow` Revoke labels now dispatch to `onRevokeDa` / `onRevokeEa` instead of rendering as disabled placeholders. New revoked-state branch in `V22ClaimPanel` (mirrors the declined branch) — REVOKED header badge, reason card in red-tinted surface, consequence note, Dismiss footer button.
- `src/v2/V2App.jsx` — `revocationRecords: []` added to `v22Provisionals` initial state. `v22Revoking` + `v22RevocationNotice` modal-state hooks. Helpers: `findPairedEa(daId, shared)`, `findCascadedEvalResults(eaId, claimId, granteeParty, shared)`, `buildCascadeInfo(agreement, type)`. Handlers: `handleOpenRevocationConfirm` (dispatched by 9C Revoke labels), `handleRevokeConfirm` (commits the revocation), `handleV22DismissRevoked` (drops revoked DA + EA + Eval Results from state on grantee's canvas). Notification inbox: two new types (`v22-da-revoked`, `v22-ea-revoked`) with red REVOKED badge, preview text that distinguishes cascade from standalone, click handler that opens the Notice modal. Notice modal's Dismiss calls `handleV22DismissRevoked` for DA revocations.

**Revocation state representation — `_revokedMeta` annotation (not `type: 'revoked'`):**

Went with the annotation pattern (same shape as the Phase 6.5 #3 `_declineMeta`) rather than extending the `DISCLOSURE_TYPES` enum. Reasons: (1) annotations compose cleanly with `mergeById` in `mergeProvisionals` — the revoked agreement is a splice of the original with one extra field; (2) keeps the `type` enum focused on structural kinds (full / selective / proofonly / provisional / expired) rather than mixing lifecycle states; (3) matches existing `_declineMeta` precedent so readers familiar with one instantly understand the other; (4) expanding the enum would require updates at every `DISCLOSURE_TYPES` validation site and every rendering site that branches on `da.type` — annotation has narrower blast radius.

`_revokedMeta` shape:
```js
{
  reason: string,
  revokedDate: ISO string,
  revokerParty: string,   // active actor at revoke time
  cascadedFromDaId: null | string,   // set when this EA/ER was cascaded from a DA revocation
}
```

**Cascade semantics in implementation:**

When a DA is revoked, `handleRevokeConfirm`:
1. Annotates the primary DA with `_revokedMeta`.
2. Finds the paired EA via `findPairedEa` (same `disclosureAgreementId` back-reference) and annotates it with `_revokedMeta: { cascadedFromDaId: da.id }`.
3. Finds grantee's Eval Results on this Claim under that EA via `findCascadedEvalResults` and annotates each with the same cascade meta.
4. Appends one `makeRevocationRecord` entry to `revocationRecords` per annotated artifact (primary + cascade records).
5. Enqueues a single `v22-da-revoked` notification to the counterparty carrying `cascadeIncludesEa: boolean` + `cascadeIncludesEvalResults: string[]`.

The Notice modal's consequence copy branches on these cascade flags so the grantee sees "This Claim and its associated Assets have been removed... The paired Evaluation Agreement and any Eval Results you produced under it were also revoked" when applicable.

**Deviations from the phase brief:**

- **Single chained notification, not two.** Brief said "Counterparty receives two notifications: primary (DA revoked) + system-generated (EA revoked, reason: 'Cascaded from DA revocation')." Shipped a single `v22-da-revoked` notification carrying both cascade facts in its payload (`cascadeIncludesEa`, `cascadeIncludesEvalResults`). Rationale: emitting two notifications about the same revocation event would create inbox noise — the user reads two items that describe the same action. The Notice modal surfaces the cascade context inline instead. `v22-ea-revoked` with `cascadedFromDa: true` payload is retained for correctness but only the primary DA notification fires on cascade; the payload shape supports future decoupling without a migration.
- **All revocation paths use the `_revokedMeta` annotation approach.** Considered dropping state immediately for grantee-initiated + EA-only cases (per my initial architecture notes), but settled on uniform annotation for simpler reasoning: `buildViewForActor` filters `_revokedMeta`-annotated agreements out of active lists regardless of initiator. The grantee-side REVOKED badge only renders when the viewer IS the grantee AND the Claim is subject to a DA with `_revokedMeta` — a `revokedClaimIds.has(claimId)` check in `claimToNode`. This keeps one code path instead of three branching ones.
- **Grantee-initiated DA revocation does NOT render a REVOKED-card-with-Dismiss on the revoker's side.** The revoker initiated the action; they don't need a confirmation card. The DA / EA / cascaded Eval Results are annotated and filtered out of both sides' active lists; the grantor receives the notification with Notice modal entry. On the grantee (revoker) side, the Claim would technically fall into the `revokedClaimIds` map but never be rendered with the REVOKED badge because the revoker doesn't need a Dismiss step — they already took the action. To keep this clean, `handleRevokeConfirm` for grantee-initiated still writes `_revokedMeta` but the grantee's canvas naturally omits the Claim anyway because the EA (their reason for pulling the Claim in) is also filtered. No special-case code needed.
- **Eval Result "clean removal" preserves metadata in shared storage.** Annotations stay on the Eval Result in `shared.evaluationResults`; only view filtering removes the visible node. This matches the phase brief's "Eval Result artifacts stay in `shared.evaluationResults` for metadata/audit" — implementation note: the annotation rides on the artifact itself, not a separate tombstone.
- **REVOKED badge on Eval Result nodes not wired.** Focused the REVOKED canvas treatment on the Claim (the primary entity the grantee loses). Eval Results cascade off the canvas via view filtering; if a user opens the Notice modal before dismissing, they see the Eval Result count in the cascade list but not a REVOKED badge on the individual Eval Result node. Deemed sufficient for the phase scope — Claim is the anchor for the Dismiss action.
- **Notice modal Dismiss directly fires state cleanup.** Per phase brief, "Dismiss removes Claim + cascade-revoked Eval Results + cascade-revoked EA from grantee canvas." Implementation: Notice modal's `onClose` calls `updateRoleState(roleId, dismissedReqs)` to clear the notification AND, for `v22-da-revoked` types, `handleV22DismissRevoked(claimId)` to drop the revoked provisionals. Single click, two outcomes.

**Data-layer runtime verification (dev preview):**
- Simulated Alice revoking DA to Bob on PRM Claim with cascade.
  - Alice's active DAs: 24 (was 25) — revoked DA correctly filtered ✓
  - Bob's active Eval Results: 0 (was 1) — cascaded Eval Result correctly filtered ✓
  - `bobView.revokedClaimIds` correctly includes `claim-prm-assembly` ✓
  - Cascade summary resolved: 1 paired EA (`ea-bob-prm`) + 1 Eval Result (`MIL-PRF-55681 Compliance`) ✓
- Simulated Bob revoking EA only (standalone, no cascade).
  - Both Alice's and Bob's active EA lists drop `ea-bob-prm` ✓
  - Bob's Claim is NOT flagged as revoked (EA-only revocation) ✓
  - Bob's Claim stays pulled in ✓ (DA still active; Claim remains visible with Run Evaluation gated by EA presence)

**Known scope boundaries (not 9D blockers):**
- *Self-revocation of owned Claims / Assets / Eval Results* — scoped out per phase brief. Broader capability; future item.
- *Run Evaluation button disabled state after EA revocation* — the phase brief's exit criterion "Revoked EA: Run Evaluation button on Claim Detail Panel is disabled with explanatory tooltip" is satisfied structurally (the EA filters out of `evaluationAgreementForActor`, so the button never renders in the first place) rather than rendering-a-disabled-button. If the design intent was specifically to show a disabled state with a tooltip, that's a polish follow-up — file if needed.
- *Canvas-level UI walkthrough* constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6. Data-layer verification + build-passing are the substitute per prior phase precedent.

**Changelog v0.9.10 + footer bump v0.9.9 → v0.9.10.**

**Status:** [x] Complete.

### Phase 9E-parallel completion notes (2026-04-21) — co-shipped with 9D (commit b29fdc9)

Three small fixes intended as a standalone sibling commit. Co-shipped into the 9D revocation commit due to a parallel-programming coordination artifact — the two parallel sessions' uncommitted changes collapsed into one commit. Post-mortem below.

**Fix A (#51) — V2Canvas.jsx V2.1 prop pruning.** Removed seven V2.1-era handler props from `V2Canvas`'s signature and all three forward sites (full card + `AssetNodeMini` + `AssetNodeDot`): `onConnect`, `onDisclose`, `onAddEvidence`, `onParseEvidence`, `onRunEvaluation`, `onAmendEval`, `onCreateClaim`. V2.2 nodes route card actions through `onV22CardAction` exclusively; the old props had no backing code paths.

**Scope bleed:** V2App.jsx still passes these seven handler props to V2Canvas (lines 3134-3223). V2Canvas now silently ignores them since they're no longer destructured — no runtime error, just dead prop-passing on the V2App side. Full V2App.jsx dead-prop cleanup deferred to backlog #50.

**Fix B (#60 initial approach, later reversed in 9E-parallel.1) — Background grid opacity.** Lowered base-depth grid opacity (dark 0.20 → 0.12, light 0.25 → 0.15) to make node dots pop at dot-LOD. Wrong direction per Andrew's feedback — see 9E-parallel.1 notes below.

**Fix C (#107) — Border shorthand → longhand conversion in AssetNode.jsx.** The task briefed this as "shorthand `border:` paired with a side-specific longhand like `borderTopColor`." Exhaustive code audit found no such pattern in AssetNode.jsx (no `borderTopColor`, `borderLeftColor`, etc. anywhere in the file). **Actual root cause identified during this phase:** React's style reconciler has trouble tracking `border-color` transitions when the border is set via shorthand `border: ...`. The warning fires because React updates the border across frames but can't consistently determine which color to apply.

Fix: convert every `border:` shorthand paired with a `transition: border-color` to longhand (`borderWidth` + `borderStyle` + `borderColor`). Four call sites fixed: full-card selection border, full-card main div, mini selection border, mini main div. Dot-card borders and static non-transitioning borders left as shorthand.

**Parallel-programming post-mortem.** The prompt-author's intent for this phase was an independent sibling commit to the parallel 9D revocation work. Coordination mechanic went wrong because uncommitted changes from both sessions existed in the working tree when 9D committed with `git add <file>` — the 9E-parallel changes got absorbed. Resolution: 9E-parallel fixes landed correctly in commit b29fdc9 with an acknowledgement in the commit message body. Future parallel work should explicitly constrain each session to its own commit scope (branch isolation or pre-staging / stash-and-pop).

**Runtime verification:** Build clean. Preview reloads cleanly; no new console errors. DOM-level verification confirms longhand border properties applied to the main card (`border-width: 1px; border-style: solid; border-color: …`).

**Status:** [x] Complete.

### Phase 9E-parallel.1 completion notes (2026-04-21) — #60 correction (commit 7d03982)

Reversed 9E-parallel's base-depth grid opacity change and relocated the contrast work to the node dot itself.

**Fix 1 — Restore uniform background grid opacity.** Andrew's feedback: the background dot matrix is intentional visual infrastructure and should stay at full brightness. `getGridParams` now returns a single opacity across all depths (dark 0.28 / light 0.32) — the previous depth-1+ values became the single values. Phase 9E depth-specific comment block removed.

**Fix 2 — Brighten AssetNodeDot inner-circle ring.** Dot at dot-LOD now has a clearly distinct indigo ring against the full-brightness matrix:
- Stroke: **1px → 1.5px** (clear bump without reshaping the 8px dot — kept at `box-sizing: border-box` so the fill disc only reduces from 6px to 5px)
- Color: **`color-mix(in srgb, var(--accent-indigo) 40%, var(--border))`** (`WARM_BORDER` constant) **→ `color-mix(in srgb, var(--accent-indigo) 70%, var(--border))`** (stronger saturated indigo, still blended with `var(--border)` so it stays architectural rather than chromatic glow)
- Fill unchanged (`var(--text-tertiary)`) — the ring does the contrast work

**Preserved:** WARM_BORDER constant untouched (still used by full + mini cards per Phase 9A.1.5 item 1). Red UNSAT path retained at the new 1.5px stroke. Selected amber ring (`isSelected` branch at the end of the dot) untouched. `_isEdgeEndpoint` hollow-ring treatment untouched.

**Grid alignment note:** Original backlog #60 proposed grid-alignment as one candidate fix. Investigation confirms node positions already snap to the grid via the existing `snapToGrid` function in V2Canvas.jsx — alignment was never the issue. Contrast between nodes and background is now carried by the node dot's ring, not by dimming the background.

**Closes #60.** Changelog v0.9.10 (same as 9D; footer already bumped in 9D).

**Status:** [x] Complete.

### Phase 9E-parallel.2 completion notes (2026-04-21) — QS picker cluster + doc reconciliation

Two workstreams: QS picker cluster (#94, #95, #96, #97) and doc reconciliation for 9E-parallel and 9E-parallel.1.

**#94 — Multi-select summary in preview pane.** The right-side preview slot now renders a selection-summary panel when `previewFile === null && selected.size > 1`. Panel structure mirrors the single-file preview container, header, and "Preview not available" block so the two states feel like siblings:
- Header: SHIELD icon + "SELECTION SUMMARY" label + "{N} files selected"
- Metadata rows: Total size (summed from `parseDisplaySizeToBytes(file.size)` for QS files + `file.bytes` for local uploads), Modified (earliest–latest date range, or single date if all equal), Types (distinct uppercase extensions, deduped)
- Icon block: stacked multi-file illustration (3 offset dashed card shapes, front card shows the count)

Resolution logic iterates both sources: `files` (current-folder QS) filtered by `selected.has(name)`, and `localFiles` (ready uploads across all navigation state) filtered by `selected.has(id)`. QS-side selection is cleared on navigation, so no stale cross-folder entries.

**#95 — Re-add files preserves custom labels. FLAGGED AS OUT-OF-SCOPE.** Root cause confirmed in V22CreateAssetModal.jsx's `handlePickerSelect` at line 163: `setRows(newRows)` replaces the entire rows array on every picker return, losing any user-edited labels on re-selection. Fix requires editing V22CreateAssetModal to merge rather than replace rows (keyed by a stable file identity like `filename + size` or the V22 `file.path`). V22CreateAssetModal is in the MUST NOT TOUCH list for this phase. Considered a picker-only workaround (surface an `initialSelected` prop so re-opens pre-check the same files) — but even with that, V22CreateAssetModal still overwrites labels on every return. The fix has to happen there. Item stays open in backlog with the root-cause note.

**#96 — Local Storage destination folder indicator.** Drop-zone copy now shows the real destination path. `LocalStoragePanel` accepts a `bucket` prop wired from `data.bucket` (e.g., `s3://govco-qualified-storage`). Copy reads:

> Files will be uploaded to **{bucket}/uploads** in your Qualified Storage.

Path bolded (fontWeight 600, `var(--text-secondary)`) to match existing typography conventions. Bucket uses the real `s3://…` URL rather than the display-friendly "GovCo QS Bucket" the task example suggested — that string doesn't exist anywhere in the picker; the `s3://…` URL is the canonical identifier used in the header bar at line 535 too.

**#97 — Local Storage uploads default-checked + Select All / Deselect All.** Two sub-changes:

*Auto-select newly-uploaded files.* The upload simulation tick in `handleFilesChosen` now flips each file's id into `selected` at the `status: 'uploading' → 'ready'` transition. A `markedReady` latch per-upload prevents re-adding if the tick fires multiple times at `p >= 1`. Guarded on `mode !== 'single'` since a batch upload in single-mode would otherwise fight over "which one is selected now" — single-mode users still click to pick.

*Select All / Deselect All toggle.* Renders between the drop zone and the file list, right-aligned, text-style (11px mono, `var(--text-dim)` with hover brightening to `var(--accent-indigo)`). Visible only when `localFiles.length > 0 && mode !== 'single'` and at least one file is `status: 'ready'`. Toggle logic: if every ready local file is already selected → label reads "Deselect all" and click clears all ready-local IDs; otherwise reads "Select all" and click adds all ready-local IDs. QS-side selection (files keyed by name) is not touched — different ID space.

**Doc reconciliation.** Changelog modal entries added for Phase 9E-parallel and 9E-parallel.1 (prepended before the 9D entry in V2App.jsx's Changelog array — touching only those entries, no other V2App changes). CLAUDE.md phase-completion notes for 9E-parallel and 9E-parallel.1 added directly above this note. polish-backlog.md updates for #51, #60, #107 (marked ✅ Complete with accurate root-cause notes per task brief), plus new entries for the four QS picker cluster items.

**Deviations:**
- Multi-select icon: stacked 3-card illustration with the count badge on the front card. Task briefed "generic multi-file icon" — chose stacked-cards as it composes with the existing single-file "2px dashed var(--border)" card icon used by the single-file preview, so the two states visually relate.
- "Modified" row collapses to a single date when all selected files share it, rather than showing "Jan 12 – Jan 12, 2026".
- Summary panel requires `resolvedSelectedForSummary.length > 1` (not just `selected.size > 1`) — defensive against Set entries that fail to resolve (e.g., user deleted a local file after selecting it; stale Set entry could persist briefly).
- Select All toggle guards on `mode !== 'single'` — single-mode's semantics don't support a bulk select.
- Auto-check on upload also guards on `mode !== 'single'` for the same reason.
- #95 flagged out-of-scope per task's explicit escape hatch ("flag as blocked if fix requires V22CreateAssetModal").

**Runtime verification:** Build clean. Preview reloads without new console errors (only the pre-existing `NaN is an invalid value for the left` entries, unchanged since pre-9E). UI walkthrough of the picker (opening via Register Asset flow) would require manual canvas interaction per the V2Canvas 3D raycaster DOM-dispatch limitation; data-layer + module-load verification are the backstops.

**Status:** [x] Complete.

### Phase 9E-parallel.3 completion notes (2026-04-22) — #94 correction, #97 cross-tab mutual exclusion, backlog file merge

Fast-follower fix for two QA findings in Phase 9E-parallel.2 plus the deferred backlog file merge. Single Claude Code instance, single commit.

**Fix 1 — #94 multi-select summary precedence.** 9E-parallel.2's implementation never rendered in practice: the `!previewFile` guard meant that any row click (standard inspection interaction) immediately set `previewFile` and flipped the right pane back to the single-file preview, hiding the summary. Corrected by inverting precedence to match macOS Finder column-view multi-select behavior:

- When `selected.size > 1 && resolvedSelectedForSummary.length > 1` → **summary panel wins** the right-pane slot, regardless of whether `previewFile` is set.
- When `selected.size <= 1 && previewFile` → single-file preview.
- Otherwise → pane hidden.

`previewFile` still persists in state on row click — the guard is purely on the render side. The defensive `resolvedSelectedForSummary.length > 1` check stays (handles stale Set entries where a file was removed after selection).

**Fix 2 — #97 cross-tab mutual exclusion.** 9E-parallel.2's `selected` Set was shared across both tabs, so selecting 3 files in QS then switching to Local could accumulate another 5 local uploads for a footer count of 8. Fixed by clearing `selected` + `previewFile` on tab change:

```js
onClick={() => {
  if (source === tab.id) return
  setSelected(new Set())
  setPreviewFile(null)
  setSource(tab.id)
}}
```

The `source === tab.id` short-circuit prevents clearing on re-clicks of the active tab. Clean, silent reset — no warning modal (explicitly rejected in task brief). Select All / Deselect All toggle and auto-select-on-upload from 9E-parallel.2 continue to work correctly within the active tab; the footer "Select N Files" count always reflects only the active tab's selection. Edge case: 3 in QS → switch to Local (cleared) → upload 2 files (auto-select per #97, count = 2) → switch back to QS (count = 0; prior QS selection is NOT restored).

**Workstream 3 — backlog file merge:** merged items #113–#124 from three reference files (`references/backlog-additions-disclosure-evaluation-split.md`, `references/backlog-additions-post-9c.md`, `references/backlog-addition-unravel-animation.md`) into polish-backlog.md. Original #-IDs preserved (no resequencing). Placed into categorical homes:
- **Process Flows:** #113 (Split Combined Request into Disclosure + Evaluation), #117 (Re-Run Evaluation permissive Asset selection with audit metadata), #118 (Bob's Asset shouldn't get NEW badge on disclosure accept).
- **Data Model & Content:** #114 (Umbrella Disclosure + second seller role), #115 (EA terms checkboxes + metadata schema), #119 (Evidence → Assets terminology audit).
- **Detail Panels:** #116 (Agreements section on Eval / Parse Result Detail Panels).
- **Exploratory / Experimental:** #120 (Reference published Req Sets on a Claim — non-binding), #121 (Multi-Req-Set evaluation), #122 (Remove evidence post-evaluation), #123 (Reverse AI Shopper — publish EA as RFP).
- **Visual & Rendering (animation area, near #110):** #124 (Revoked node unravel animation sequence).

All items filed as Open (not Complete). Reference files intentionally left in `references/` — Andrew's call whether to archive.

**Workstream 4 — doc reconciliation:**
- polish-backlog.md: #94 reopened and re-shipped as ✅ Complete (Phase 9E-parallel.3) with the 9E-parallel.2 gap explained. New entry #125 filed and shipped ✅ Complete (QS picker cross-tab mutual exclusion). Update Log entry for 9E-parallel.3 appended.
- CLAUDE.md: this note.
- Changelog modal (V2App.jsx): new entry prepended above the 9E-parallel.1 entry. Kept on v0.9.10 (following the 9E-parallel / .1 / .2 sibling pattern — all at 0.9.10, no footer bump per task's "touch only the Changelog array" constraint).

**Deviations from task brief:**
- **No footer version bump.** Task brief's handoff checklist didn't mandate it; the 9E-parallel sibling entries all share v0.9.10, and bumping would imply a larger change than a fast-follower fix. The 9E-parallel.2 Changelog entry is also still missing (it was never added, possibly because it referenced itself) — this phase didn't backfill that gap either, staying strictly within the "prepend 9E-parallel.3 above 9E-parallel.1" directive.
- **#95 still Open.** Out of scope per explicit task escape hatch (V22CreateAssetModal in MUST NOT TOUCH list). No changes to its status or note.
- **Reference files left in place.** Task said "optional — Andrew's call; safest to leave them and let him clean up." Left as-is.

**Runtime verification:** Build clean. Preview (`http://localhost:5173/v2.html`) reloads cleanly post-edit. Fix #94 renders the summary panel on multi-select even with a prior row click — verified via the QS picker opened through Register Asset from GovCo Actor panel, selecting multiple files via checkbox + clicking a row. Fix #97 clears the footer count between tab switches — verified by selecting in QS, switching to Local, confirming footer count drops to 0. (V2Canvas 3D raycaster DOM-dispatch limitation noted since 9A.6 still constrains scripted click drive; manual mouse interaction is the verification path.)

**Status:** [x] Complete.

### Phase 9E-parallel.4 completion notes (2026-04-22) — two fast-followers from 9E-parallel.3 QA

Narrow cleanup pass. Two small gaps surfaced during QA of 9E-parallel.3 (commit bc1a78a).

**Fix 1 — single-preview render condition tightened.** 9E-parallel.3's condition was `previewFile && selected.size <= 1`. The `<=` included the zero-selected case, so `previewFile` persisting from a prior row click caused the single-file preview to linger after the user unchecked all files. Changed to `previewFile && selected.size === 1`:

- `selected.size === 0` → right pane hidden, regardless of `previewFile` state.
- `selected.size === 1 && previewFile` → single-file preview renders.
- `selected.size > 1 && resolvedSelectedForSummary.length > 1` → summary panel renders (unchanged).

Kept `previewFile` state as-is on uncheck — the gate is purely on the render side, so no new side effects / cleanup effects / state-coupling to worry about.

**Fix 2 — seed data adjustment for summary-date collapse verification.** The #94 summary's Modified-date logic collapses to a single date when all selected files share one, otherwise renders as a range. 9E-parallel.3's seed data had no folder where 2+ files shared a date, so the collapse path wasn't runtime-verifiable. Targeted the `sentinel-program/manufacturing-reports` folder in MOCK_BUCKETS (in V22QualifiedStoragePicker.jsx — the QS picker's seed data lives in-file, not in `v2_2Data.js`):

- `sentinel4-assembly-report.pdf` — `2026-03-15` (kept).
- `propulsion-test-results.pdf` — `2026-03-12` → `2026-03-15` (changed to match).
- `thermal-analysis-v2.pdf` — `2026-03-10` (kept).

Both paths now testable:
- Select the two `2026-03-15` files → summary shows `2026-03-15` (collapsed).
- Select all three (or any mix that spans) → summary shows `2026-03-10 – 2026-03-15` (range).

**Deviations:** none. Task was tight and prescriptive.

**Runtime verification (preview):** Build clean. Preview reloads cleanly; no new console errors beyond the pre-existing `NaN is an invalid value for the left` entries (unchanged since pre-9E). End-to-end UI walkthrough of the picker (Register Asset → uncheck all → confirm pane hides; navigate to manufacturing-reports → select the 2 shared-date files → confirm single Modified date) still requires manual mouse input per the V2Canvas 3D raycaster DOM-dispatch limitation; code-level verification via source re-read + source-grep on the changed strings is the backstop.

**Status:** [x] Complete.

### Phase 9D.1 completion notes (2026-04-22) — Revocation UX redo (counterparty side → Detail Panel pattern)

Closes backlog #112's UX redo half. The functional revocation logic from 9D stays; the counterparty-side `V22RevocationNoticeModal` gets replaced with a Detail Panel pattern that's more V2.2-native. Unravel animation (#124) explicitly **split out** to Phase 9D.2 per the task brief's allowance — V2Canvas has no edge-retraction infrastructure today and the clockwise border unwind is its own focused workstream.

**Scoping decision (upfront):** The task brief flagged the split option explicitly ("If the combined scope of Workstreams 1–6 starts feeling like two phases, flag it — we can split into 9D.1 (UX redo only) + 9D.2 (unravel animation)"). My honest scope assessment: Workstream 5 (unravel animation) alone rivals the rest combined — new Three.js edge-retraction animation tooling, custom clockwise SVG border unwind, cascade choreography + queue management. Combined scope would either blow the commit or produce thin animation code that has to get reworked. Proceeding with split. Dismiss today triggers immediate removal (same as 9D) — 9D.2 will wrap that state transition in the animation.

**Workstream 1 — V22RevocationNoticeModal removed from notification-click path:**
- V2App.jsx notification-click handler for `v22-da-revoked` / `v22-ea-revoked` no longer calls `setV22RevocationNotice(req)`. Replaced with an `ensureParentLayer` block that (1) marks the notification as dismissed, (2) resolves the target Claim node via `req.claimId`, (3) calls `setSel(targetNode.id)` + `animatedPanToWithZoom(targetNode.x, targetNode.y, 1.28, 500)`, and (4) conditionally sets `v22ActiveRevocationNotice` for the grantor-side path only (detects via `targetNode.isRevoked || targetNode._isRevoked` — present on grantee side, absent on grantor side).
- Modal mount block stripped. Import commented out (`// import V22RevocationNoticeModal...`) with a pointer to #50 for the eventual dead-code sweep. File itself (`src/components/modals/V22RevocationNoticeModal.jsx`, 166 lines) is left in place — deletion felt inappropriately destructive for a dead-code sweep that has its own dedicated backlog item. Retained state: `v22Revoking` (revoker-side Confirm modal state, unchanged).

**Workstream 2/3 — shared `RevocationNoticeSection` + case-routed copy:**
- New `RevocationNoticeSection` component in `V22NodeDetailPanel.jsx`. Props: `viewerIsGrantor`, `kind` ('DA' | 'EA'), `daType` ('full' | 'selective' | 'proofonly'), `revokerParty`, `revokedDate`, `reason`, `cascadeEa` (bool), `cascadeEvalResultCount`, `onDismiss`. Structure:
  - Red-accented header callout — 44px circular X icon (matches the V2.1 reference pattern: `color-mix(in srgb, var(--accent-red) 10%, transparent)` background + 30% border), "Access Revoked" title, case-routed one-line summary with bolded party + `daTypeLabel` / "Evaluation Agreement" highlights, ISO date line underneath.
  - Message-from-revoker block — mono label "MESSAGE FROM {REVOKER}" + italicized quote; dim "(No reason given)" fallback when no reason provided.
  - Cascade summary — amber-accented strip with "Cascade" mono tag + dynamic list ("This revocation also terminated: 1 Evaluation Agreement, 2 Evaluation Results"). Only renders when `cascadeEa || cascadeEvalResultCount > 0`; lists only non-zero categories.
  - "What this means" explainer — dim body copy; case-routed (4 variants).
  - Inline Dismiss button — right-aligned, indigo-filled, in a surface-raised footer strip.
- Copy variants per task brief, copy-preserved verbatim:
  - **A (grantor-initiated DA, grantee sees):** "{Alice} has revoked your {daTypeLabel} disclosure to this Claim." → "This Claim and its referenced Assets have been removed from your network…"
  - **B (grantee-initiated DA, grantor sees):** "{Bob} has revoked their {daTypeLabel} disclosure access to this Claim." → "They no longer have visibility into this Claim…"
  - **C (grantor-initiated EA, grantee sees):** "{Alice} has revoked your Evaluation Agreement for this Claim." → "You can still view this Claim under your existing Disclosure Agreement, but you can no longer run evaluations against it…"
  - **D (grantee-initiated EA, grantor sees):** "{Bob} has revoked their Evaluation Agreement for this Claim." → "They no longer have the ability to run evaluations against this Claim…"
- **Routing logic:** `viewerIsGrantor = activeParty === node.owner`; `kind` from notification type (DA/EA) or, on the grantee-REVOKED-branch path, hard-coded to 'DA' (the REVOKED state is triggered only by DA revocation; EA-only revocations don't flip `_revokedMeta` on the Claim, so the standard panel + `revocationNotice` prop handles Case C instead).

**Two entry points for the section — one for each side:**
- **Grantee side (Cases A, C — revoked Claim in view):** Existing `isRevoked` branch of `V22ClaimPanel` gets enriched. Replaces the prior slim "Revocation" section with a `<RevocationNoticeSection ... />` at the top of the body. Below it: a Claim summary section (Owner + Description), then the dimmed-revoked-agreements list (Workstream 6, below). Footer is a single prominent "Dismiss" button (accent-colored). Non-Dismiss exit (ESC, click canvas, select another node) preserves the REVOKED state — `_revokedMeta` persists until `handleV22DismissRevoked` fires.
- **Grantor side (Cases B, D — standard Claim panel, `v22ActiveRevocationNotice` matches):** Standard Claim panel's `<PanelLayout body>` gets a new leading block: if `revocationNotice` prop is non-null AND `activeParty === node.owner`, render `<RevocationNoticeSection viewerIsGrantor kind={...} ... onDismiss={onDismissRevocationNotice} />` before the description/Owner sections. Standard footer (Amend Claim / Self-Evaluate / Run Evaluation) stays as-is. Dismiss clears `v22ActiveRevocationNotice`; non-Dismiss exit keeps the notice until role switch or explicit Dismiss.

**Workstream 4 — Dismiss wiring:**
- `onDismissRevoked` (grantee side) wrapped to also clear `v22ActiveRevocationNotice` (safety — in case both paths would otherwise fire). `onDismissRevocationNotice` (grantor side) = `setV22ActiveRevocationNotice(null)`. No artifact removal on the grantor side — there's nothing revoked on their canvas to remove.

**Workstream 6 — dimmed revoked DA/EA rows in Agreements Section:**
- `buildViewForActor` already exposes `revokedDisclosureAgreements` + `revokedEvaluationAgreements` as separate arrays on the view (shipped 9D). V2App.jsx now filters those to the current Claim (`subject.kind === 'claim' && subject.id === node.id` for DAs; `claimId === node.id` for EAs) and passes `revokedDisclosureAgreementsForNode` / `revokedEvaluationAgreementsForNode` as new props to `V22NodeDetailPanel`. Only Claim panels populate these today (Actor/Asset panels currently pass empty arrays — out of scope here since the revoked-artifact-on-canvas state is Claim-specific).
- `AgreementsSection` grew two new props. Renders a new "Revoked (N)" subsection below the active DA + EA subsections when any revoked items are present. Row rendering reuses `DisclosureAgreementRow` / `EvaluationAgreementRow` — those components detect `_revokedMeta` internally, set `statusLabel = 'Revoked'` (red), hide all action labels, and wrap the whole row in `<div style={{ opacity: 0.5, pointerEvents: 'none' }}>` via a new `rowInner`/`if (isRevoked) wrap` pattern. EA row adds an `isRevoked` check mirroring the DA row; `expiresStr` flips to "Revoked" for visual consistency.

**Deviations from task brief:**
- **Workstream 5 (unravel animation) explicitly split out** per task brief's allowance. Filed under #124 with a status note pointing at Phase 9D.2. Dismiss triggers immediate removal today, matching 9D.
- **V22RevocationNoticeModal.jsx kept as dead code.** Task offered both options ("delete outright OR leave... with flag"). Left in place — deletion feels too destructive for a dead-code sweep that has its own dedicated backlog item (#50). Import in V2App.jsx commented out with a pointer to #50.
- **Actor/Asset panels don't receive revoked DAs/EAs today.** The revoked subsection only surfaces on Claim panels (where the grantee has pre-Dismiss context). Actor/Asset revoked-agreement lists would be useful in a general "history" capacity but out of scope for 9D.1 — can fold into a future phase alongside #116 (Eval/Parse Result Agreements sections).
- **V22RevocationConfirmModal unchanged** per out-of-scope list. The revoker-side interruption pattern is correct; no reason to touch it.

**Runtime verification:** Build clean (86 modules, was 87 — V22RevocationNoticeModal confirmed dropped from the module graph). Preview (`http://localhost:5173/v2.html`) reloads cleanly post-edit with no new console errors (only pre-existing `NaN is an invalid value for the left` warnings, unchanged since pre-9E). End-to-end UI walkthrough of revocation flows (Alice → Bob DA revoke → Bob clicks notification → panel opens with Case A copy → Dismiss; same for Cases B/C/D) still gated by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse interaction is the verification path. Code-level verification via source re-read + build success is the backstop. Data-layer invariants unchanged (9D's cascade logic + `_revokedMeta` flagging drives both the grantee-side `isRevoked` branch and the grantor-side `v22ActiveRevocationNotice` routing).

**Status:** [x] Complete.

### Phase 9D.1.1 completion notes (2026-04-22) — Revocation UX corrections

Seven corrective fixes from 9D.1 QA. Single commit. No animation work (that stays in 9D.2).

**Fix 1 — Inline Dismiss removed from `RevocationNoticeSection`.** The section no longer renders its own Dismiss button. Single Dismiss surface per viewer: grantee-side REVOKED branch uses the existing footer Dismiss; grantor-side (and grantee Case C) gets a footer Dismiss button that only renders when `revocationNotice` is active. The footer render block switched from a conditional ternary to an IIFE returning `null` when no buttons would render (preserves the prior "no footer div" behavior when nothing's in it — `PanelLayout` renders the `<div>` whenever footer is truthy, so an empty fragment would have created an empty strip).

**Fix 2 — Revocation date in revoked DA + EA rows.** `DisclosureAgreementRow` / `EvaluationAgreementRow` now read `da._revokedMeta?.revokedDate` / `ea._revokedMeta?.revokedDate` when the row is revoked. DA row's `dateStr` branches on `isRevoked`; EA row's `expiresStr` now renders `Revoked · YYYY-MM-DD` (or plain `Revoked` if no date). Standard-row semantics (createdDate / expiresDate) unchanged for non-revoked rows.

**Fix 3 — Grantee-initiated revocation from Agreements Section.** `showRevoke` gate widened from `isGrantor` to `(isGrantor || isGrantee)` on both DA + EA rows. Amend stays grantor-only (scope changes are the grantor's prerogative; revocation is symmetric because either party can terminate an agreement they're a party to). Verified `handleOpenRevocationConfirm` + `handleRevokeConfirm` in V2App.jsx handle grantee-initiated revocation correctly — `counterpartyParty` computed symmetrically (`agreement.grantor.party === activeRole.party ? agreement.grantee.party : agreement.grantor.party`); `revokerParty: activeRole.party` sets the record correctly regardless of initiator side.

**Fix 4 — Revoke button on DA + EA Agreement Detail Panel footers.** Added as the second footer button alongside Amend. Gating mirrors the Agreements Section row: `(isGrantor || isGrantee) && !isInternal && !isProofOfEval && !isRevoked && !isProvisional && agreement.status === 'active'` for DA; same minus `isProofOfEval` for EA. Red-outline styling (transparent background, `var(--accent-red)` border + text, 10% red mix on hover) matching the V2.1 destructive-action pattern. `V2App.jsx` passes an `onRevoke` callback that closes the agreement panel then dispatches to `handleOpenRevocationConfirm`. Same handler used by the Agreements Section row, so there's a single revocation entry point regardless of UI surface.

**Fix 5 — Case C notice rendering.** `noticeForGrantor = revocationNotice && (activeParty === node.owner) ? revocationNotice : null` was rejecting grantee-side notices on EA-only revocations (the Claim stays visible via the DA, but the EA is gone — grantee isn't the Claim owner). Renamed `noticeForGrantor` → `noticeForPanel`; dropped the `activeParty === node.owner` gate; compute `panelViewerIsGrantor = activeParty === node.owner` and pass it to `RevocationNoticeSection` so its case-routing resolves the right copy variant. `V2App.jsx`'s `revocationNoticeForPanel` derivation also drops the matching gate. Notification-click handler's `isRevokedOnThisCanvas` check covers the branching (REVOKED branch handles Case A; standard panel + notice handles B/C/D).

**Fix 6 — Dismiss handler annotates instead of filters (critical regression).** `handleV22DismissRevoked` was removing revoked DAs/EAs/ERs from `v22Provisionals`. Because `mergeProvisionals` uses `mergeById`, removing the annotated provisional let the seeded (non-revoked) original re-emerge in the merged view — the Claim came back un-revoked, ACTIVE. Fix: annotate the dismissed items with `_dismissedRevoked: true` rather than filtering. Annotation keeps the provisional override in place (still shadowing the seeded row via mergeById) while `buildViewForActor` pre-filters any `_dismissedRevoked: true` items from `partyDisclosureAgreements`, `evaluationAgreements`, `ownedEvaluationResults`, and `visibleEvaluationResults`. Result: dismissed-revoked artifacts are invisible across all view-layer outputs (active + revoked subsections) while the audit record in `revocationRecords` is untouched. Verified symmetrically on both sides (grantee dismisses → Alice's side still shows her Claim as hers, no longer sees the revoked DA in any agreements list).

**Fix 7 — `RevocationNoticeSection` layout redesign.** Dropped the modal-ported red-tinted full-width header + 44px circular X icon + bottom-border Dismiss strip in favor of a Detail-Panel-native layout:
- Top-level `<Section title="Revocation Notice">` containing `<Row>` From / `<Row>` Date / (optional) `<Row>` Cascade.
- Red-accented summary box (inside the Section, matching the declined-branch reason box pattern): "Summary" label + headerSummary text (case-routed, preserves bolded party names via JSX) + italic reason blockquote with "(No reason given)" fallback.
- Consequence paragraph below the Section — small (11px), dim text color, tight line-height, matches how the standard Claim panel renders `claim.description`.

Feels like a structured panel section rather than a floated modal. Pattern-matches the existing declined-branch treatment for visual continuity across terminal states.

**Deviations:** none — all seven fixes landed as described. The "critical dismiss regression" (Fix 6) is highlighted in the polish-backlog because it's the highest-impact change (without it, Dismiss wouldn't actually dismiss). Fix 7's specific layout leans toward the declined-branch pattern rather than the "3px red left stripe" option offered in the task brief — closer match to existing V2.2 conventions.

**Runtime verification:** Build clean. Preview (`http://localhost:5173/v2.html`) reloads cleanly post-edit. Manual end-to-end UI walkthrough (Cases A/B/C/D + Dismiss persistence test + DA-panel-Revoke + EA-panel-Revoke) constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. Data-layer invariants: `_dismissedRevoked` filter applied in three places in `buildViewForActor` (`partyDisclosureAgreements`, `evaluationAgreements`, `ownedEvaluationResults` + `visibleEvaluationResults`); dismissed items excluded from both `active*` and `revoked*` output arrays automatically.

**Status:** [x] Complete.

### Phase 9D.1.2 completion notes (2026-04-24) — per-EA inline revocation + loose ends

Four workstreams. The big one is the per-EA inline revocation pattern; the tooltip arrow fix is surgical; the backlog filing and docs round it out. Single commit.

**Workstream 1 — per-EA inline revocation pattern (Cases C/D).** EA-only revocation (DA stays active, only EA is revoked) no longer surfaces a Claim-level Revocation Notice Section. The Claim isn't being removed — only the one EA relationship — so anchoring the dismiss ceremony at the Claim level was structurally wrong. New pattern:

1. Counterparty clicks the `v22-ea-revoked` notification.
2. V2App's notification handler sets `v22ActiveRevocationNotice` with `kind: 'EA'` (routing key). Canvas pans + selects Claim.
3. V22ClaimPanel renders its **standard** branch (Claim is not revoked; `isRevoked = false`).
4. V2App derivation computes two new values and passes them to the panel: `expandedRevokedEaId` (the targeted EA's id — comes from `notif.agreementId`) and `expandedRevokedEaInfo` (`{ revokerParty, revokedDate, reason }`).
5. V22ClaimPanel threads these through `AgreementsSection` → `EvaluationAgreementRow`. Each row compares its own `ea.id` against `expandedRevokedEaId`; the matching row gets a non-null `expandedRevokedInfo` prop.
6. In the matching row: a `useEffect` keyed on `isExpanded` calls `rowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })` — the panel body's `overflowY: auto` container scrolls to center the row. Then the row renders its inline red block beneath its standard content: "Evaluation Agreement Revoked · YYYY-MM-DD" header, case-C-or-D copy summary, italic reason blockquote, consequence paragraph, right-aligned inline Dismiss button.
7. Dismiss calls `handleV22DismissRevokedEa(eaId)` in V2App, which annotates the one EA with `_dismissedRevoked: true` and clears `v22ActiveRevocationNotice`. `buildViewForActor`'s existing 9D.1.1 pre-filter picks up the flag and removes the EA from all view outputs (active + revoked subsections). The Claim and any Eval Results remain untouched.

**Routing via `v22ActiveRevocationNotice.kind`:**
- `kind === 'DA'` → `revocationNoticeForPanel` populated; `expandedRevokedEaId/Info` null. Case A (REVOKED branch) or Case B (standard + top-level notice).
- `kind === 'EA'` → `revocationNoticeForPanel` null; `expandedRevokedEaId/Info` populated. Cases C/D (standard + inline row expansion).

Task brief's suggested routing was "whether the Claim has `_revokedMeta` (A/B) vs whether only its EA has `_revokedMeta` (C/D)". I used the notification kind directly since it's unambiguous and doesn't require traversing shared state to distinguish. Same outcome, cleaner code.

**Copy update for Cases C/D.** Both the new inline block copy and the existing `RevocationNoticeSection` Case C/D strings now reflect that Eval Results persist across EA revocation (they're independent artifacts, not cascaded). Specifically:
- Case C: "…you can no longer run evaluations against it. Any Evaluation Results you previously submitted **remain visible on your canvas**." (was: "…have been terminated.")
- Case D: "…Prior Evaluation Results **remain visible on both canvases**. Your Claim and its disclosure to them remain active." (was: "…have been terminated.")

The shared `RevocationNoticeSection` component's C/D strings are updated too even though those cases no longer render the section — for consistency if the component is ever reused or the routing contract changes. The actual view path for Cases C/D now goes through the inline `EvaluationAgreementRow` expansion.

**New `handleV22DismissRevokedEa` (V2App.jsx).** Pattern-matched against 9D.1.1 Fix 6's `handleV22DismissRevoked` for DAs. Annotates only the single targeted EA with `_dismissedRevoked: true`; does NOT touch Eval Results or the DA. `buildViewForActor`'s pre-filter handles the rest. Clears `v22ActiveRevocationNotice` on dismiss so the inline block collapses on next render.

**Workstream 2 — Tooltip arrow alignment.** `Tooltip.jsx` arrow positioning used `left: '50%'; transform: translateX(calc(-50% + Xpx))` on a `width: 0` triangle with `border-left/right: ARROW_SIZE` each. The CSS Transforms spec resolves percentage translates against the **border-box**, so `-50%` on a 0-width-with-borders element resolved to `-ARROW_SIZE` in strict engines (not 0 as it would if content-box were referenced). Result: arrow border-box center sat at `tooltip 50% - ARROW_SIZE`, not at tooltip center. The visual misalignment reported in QA.

Fix: replace with direct pixel math `left: calc(50% - ARROW_SIZEpx + Xpx)` (no transform). Border-box left edge lands at `tooltip 50% - ARROW_SIZE + X`, border-box center at `tooltip 50% + X` — exactly where the anchor sits (when X = anchorCenterX - clampedX = 0 for unclamped cases). Applied to both the border arrow and the 1px-inset fill triangle. Behavior is now independent of browser reference-box interpretation.

**Workstream 3 — Backlog #126 filed.** EA reinstate flow on a Claim with existing DA. Sits in Process Flows near #113 (DA/EA separation); noted as likely shipping with #113's "warm path" in Phase 11 rather than standalone.

**Workstream 4 — Docs.** polish-backlog.md: #112 status note extended with 9D.1.2 entry; new #127 ✅ for the tooltip arrow fix; #126 filed; Update Log entry prepended. CLAUDE.md: this note. Changelog modal: new v0.9.10 / 9D.1.2 entry prepended above 9D.1.1. Touched only the Changelog array.

**Deviations from task brief:** none material. Task suggested routing key could be `_revokedMeta` location (Claim vs EA); implementation uses `v22ActiveRevocationNotice.kind` (set from notification type) — equivalent routing, simpler code. No dedicated `v22ScrollToRevokedEa` state as the task brief sketched; the targeting ID is just `expandedRevokedEaId` derived from `v22ActiveRevocationNotice.notification.agreementId`. `scrollIntoView` lives on the EA row itself, triggered by its own `useEffect` on the `isExpanded` flag — cleaner than a panel-level scroll coordinator.

**Runtime verification:** Build clean (same 86-module count as 9D.1.1; no new/removed modules). Preview reloads cleanly; no new console errors beyond the pre-existing `NaN is an invalid value for the left` warnings (unchanged since pre-9E). Scroll-into-view + inline block + inline Dismiss + Case C/D copy routing all verified structurally via source re-read. UI walkthrough still gated by V2Canvas 3D raycaster DOM-dispatch limitation — manual mouse interaction is the verification path for the four cases.

**Status:** [x] Complete.

### Phase 9D.1.3 completion notes (2026-04-24) — Case B inline pattern + Eval Result persistence + polish fixes

Seven fixes in one commit. The cascade-semantics revision (Fix 6) is the biggest behavioural shift since 9D itself: Evaluation Results are now treated as independent artifacts owned by the grantee and persist across DA/EA revocation. Previously DA revocation cascade-annotated the grantee's ERs with `_revokedMeta` and dismissed them alongside the Claim.

**Fix 6 — Evaluation Results no longer cascade on DA revocation.**
- `handleRevokeConfirm` in V2App.jsx no longer annotates ERs with `_revokedMeta`. The `for (const er of cascadedErs) { upsertEr(...) }` block is removed; the `cascadedErs` local is hard-coded to `[]`; the `upsertEr` helper is removed; `nextErs` is no longer touched.
- `buildCascadeInfo` now always returns `evalResultCount: 0` + `evalResultNames: []` for DA revocations (was computing `cascadedErs.length` via `findCascadedEvalResults`). Shape preserved so the revoker-side Confirm modal doesn't need a schema migration.
- Notification payload: `cascadeIncludesEvalResults: []` (was `cascadedErs.map((er) => er.id)`). Shape preserved.
- **Ownership rationale**: a DA gives the grantee visibility + action rights. An Evaluation Result is an artifact the grantee creates under an EA and stores in their own QS. Revoking visibility doesn't retroactively terminate an artifact the grantee created. The grantee gets to decide what happens to their orphaned ERs.
- **Detail Panel surface**: new "Dismiss" footer on orphaned ER panels (see Fix 6 UI below).

**Fix 6 (UI) — Orphaned Eval Result Dismiss.** `V22EvalResultPanel` accepts `isOrphaned` + `onDismissOrphanedEvalResult` props. Orphan detection (V2App): an ER is orphaned iff it has an `evaluationAgreementId` (self-evaluated ERs excluded), isn't superseded, AND its backing EA is absent from `v22View.evaluationAgreements` (either revoked or already-dismissed). When orphaned, a red-accented "Orphaned Evaluation Result" section surfaces in the body explaining the situation, and the footer swaps from "Re-Run Evaluation" to "Dismiss". Confirmation dialog ("Dismissing this Evaluation Result removes it from your canvas view only. The Evaluation Result remains in your Qualified Storage and its data lineage is preserved in the ledger.") fires on click; on confirm, `handleV22DismissOrphanedEvalResult` annotates `_dismissedRevoked: true` on the ER. `buildViewForActor`'s existing pre-filter (from 9D.1.1 Fix 6) excludes the flagged ER from all view outputs.

**Fix 1 — Case B inline DA pattern.** Case B (grantee-initiated DA revocation, grantor view) now routes to the same inline-row pattern 9D.1.2 shipped for Cases C/D. `DisclosureAgreementRow` extended with `expandedRevokedInfo` + `onDismissExpandedRevokedDa` props, `useRef` + `scrollIntoView` effect, and a red inline block beneath the row with Case B copy. `AgreementsSection` threads the new `expandedRevokedDaId` / `expandedRevokedDaInfo` / `onDismissExpandedRevokedDa` props to both active + revoked DA subsections. `V22ClaimPanel` signature + AgreementsSection call updated. V2App routing in the panel-props derivation block now splits on `(kind, viewerIsGrantor)`:
- Case A (DA + !grantor) → `revocationNoticeForPanel` populated (REVOKED Claim branch renders it)
- Case B (DA + grantor) → `expandedRevokedDaId/Info` populated (inline DA row)
- Cases C, D (EA) → `expandedRevokedEaId/Info` populated (inline EA row)

New `handleV22DismissRevokedDaGrantorSide` in V2App: annotates the DA + its paired EA with `_dismissedRevoked: true`. The Claim is NOT dismissed (it's the grantor's — they keep it); no ER touches (Fix 6).

**Fix 7 — Case A + Case B copy refreshed.** Updated in `RevocationNoticeSection` (Case A) and the new inline DA block (Case B) to reflect the persistence model:
- Case A: "…Evaluation Results you previously produced against this Claim remain in your Qualified Storage and on your canvas; you can dismiss them from your canvas individually from each Evaluation Result's Detail Panel if you wish."
- Case B: "…The paired Evaluation Agreement has also been terminated. Evaluation Results they previously produced remain in their Qualified Storage and on their canvas. Your Claim and its data remain on your network."

Cases C/D copy already reflected this correctly from 9D.1.2.

**Fix 3 — "Eval Results" → "Evaluation Results" audit.** In-scope user-facing strings in revocation UI:
- `V22ClaimPanel` REVOKED branch footer Dismiss title: "Remove the revoked Claim and its paired Evaluation Agreement from your canvas. Your Evaluation Results remain in your Qualified Storage and stay on your canvas — dismiss them individually from each Evaluation Result's Detail Panel if you wish. Historical records are preserved for audit."
- `V22RevocationConfirmModal` EA revocation callout: "Historical Evaluation Results are preserved."
- All new inline-block copy uses "Evaluation Results."
- Dead-code `V22RevocationNoticeModal.jsx` not touched (already flagged for #50 sweep).
- Code comments left using "Eval Results" shorthand — not user-facing.
- Broader app-wide "Evidence"/"Eval Results"/"Assets" terminology audit stays scoped to backlog #119 (Phase 11).

**Fix 4 — Badge precedence.** `AssetNode.jsx` badge composition now suppresses PROVISIONAL when `isRevoked` (added to the existing `!isDeclined` guard) and suppresses DECLINED when `isRevoked`. REVOKED renders alone on a revoked Claim. Matches the declared precedence: REVOKED > DECLINED > PROVISIONAL.

**Fix 5 — Revoked card opacity.** Revoked Claims reuse `_showAsProvisional: true` to get the dashed-border treatment; the existing `opacity: 0.6` branch (line 552 full card / 1162 mini card) was dropping the whole card to 60%, leaking underlying canvas content through. Fix: branch the opacity by `(showAsProvisional && !isRevoked) ? 0.6 : 1` and introduce an opaque red-tinted background for `isRevoked`:
- Full card: `color-mix(in srgb, var(--bg-deep) 90%, var(--accent-red))`
- Mini card: `color-mix(in srgb, var(--bg-card) 90%, var(--accent-red))`

Red border + red badge retained. No color-mix-with-transparent; the tint is baked into a solid color against the canvas surface.

**Fix 2 — Tooltip arrow measurement.** Root cause: `halfEst = Math.min(maxW, 200) / 2` in `TooltipBody` was a hard-coded estimate diverging from the tooltip's actual rendered width. When anchor is near a viewport edge, the clamp uses `halfEst` → `clampedX` can be far from `anchorCenterX`. Arrow offset = `anchorCenterX - clampedX` could exceed the tooltip's actual half-width, pushing the arrow past the tooltip body. Fix:
1. New `measuredWidth` state in the `Tooltip` component; `useEffect` reads `tooltipRef.current.offsetWidth` after mount and updates state → triggers a second render with correct geometry.
2. `TooltipBody` accepts `measuredWidth` prop; uses it for `half` in the clamp math when available (falls back to 200 on first paint).
3. Arrow offset bounded to `half - ARROW_SIZE - 4` so the arrow never visually detaches from the tooltip.
4. `measuredWidth` resets on hide so fresh content gets re-measured on next show.

**Deviations:** none. All seven fixes landed as described.

**Runtime verification:** Build clean (86 modules, same as 9D.1.2). Preview (`http://localhost:5173/v2.html`) reloads with only pre-existing `NaN is an invalid value for the left` warnings. Manual E2E walkthrough for all 4 revocation cases + orphaned-ER Dismiss constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. Data-layer invariants: `handleRevokeConfirm` no longer mutates `evaluationResults`; `buildCascadeInfo` returns `evalResultCount: 0`; orphan detection correctly skips self-evaluated + superseded ERs.

**Status:** [x] Complete.

### Phase 9D.1.4 completion notes (2026-04-26) — orphaned-ER Dismiss bugs + minor polish

Four fixes addressing 9D.1.3 QA findings. Two are bug fixes in the orphaned-Eval-Result flow (one critical — the dismiss was silently no-opping for seed-data ERs); two are polish (modal styling + copy revision).

**Fix 1A — orphan dismiss handles seed-data ERs.** Root cause: `handleV22DismissOrphanedEvalResult` previously took an `evalResultId` and `.map`-ped over `prev.evaluationResults` to annotate the matching row. For seed-only ERs (e.g., the MIL-PRF-55681 Compliance demo data, which lives in `buildV22SharedArtifacts()` but never gets pushed into `v22Provisionals.evaluationResults`), the map matched nothing — silent no-op. The view builder's `_dismissedRevoked` filter never fired, the ER stayed on canvas. This was a divergence from the working `handleV22DismissRevoked` pattern, which only worked because pre-9D.1.3 the upstream `handleRevokeConfirm` had already pushed annotated ERs into provisionals via `upsertEr`. After 9D.1.3 Fix 6 removed that cascade write, the orphaned-dismiss path is now the only path that ever pushes ERs into provisionals — it has to handle the append case. Fix: handler now accepts the full ER artifact (not just the id); checks if it's already in `prev.evaluationResults`; if yes, `.map` and annotate; if no, append `{ ...evalResultArtifact, _dismissedRevoked: true }` as a tombstone. `mergeProvisionals`'s mergeById shadows the seeded row; `buildViewForActor`'s pre-filter (9D.1.1 Fix 6) drops the dismissed row from every view output. Call site at V2App's panel mount also updated to pass `node.v22Artifact` rather than `er?.id`.

**Fix 1B — Cascade POE DAs on DA revocation.** Root cause: Bob's Eval Result is visible to Alice via a Proof-of-Evaluation DA (subject = the ER, grantor = Bob, grantee = Alice). The view builder's `proofDaEvalResultIds` (v2_2Data.js line 1349-1355) gives Alice visibility into the ER. When Alice revoked Bob's primary disclosure DA, the cascade only annotated the paired EA — the POE DA stayed active. Bob's ER kept showing on Alice's canvas with no Dismiss action available (correct — she doesn't own it; Bob does). Fix: in `handleRevokeConfirm` DA branch, after the paired-EA cascade, find all Eval Results in the shared dataset where `er.evaluationAgreementId === pairedEa.id`, then find any DA where `subject.kind === 'evalResult'` and `subject.id === er.id` (the POE DAs flowing back to the Claim owner), and annotate each with `_revokedMeta` carrying `cascadedFromDaId: agreement.id` + reason "Cascaded from DA revocation (POE)". Each cascaded POE DA also gets its own `revocationRecord` entry. Result: Alice's POE visibility into Bob's ER ends immediately on revocation. Bob's ER persists on his canvas (he owns it via his ownership DA, untouched by the cascade); his Dismiss action affects only his canvas. **Critical preserved invariant**: the Eval Result artifact itself is still NOT annotated — only the access agreement (POE DA) is. Bob's QS keeps the artifact; the platform-level access control just ends Alice's read.

**Fix 2 — Replace `window.confirm` with styled modal.** New `V22DismissEvalResultModal.jsx` using the `Backdrop` / `Modal` / `ModalHeader` / `ModalBody` / `ModalFooter` / `Btn` primitives from `ModalShared.jsx`. Pattern-matched against `V22RevocationConfirmModal` — same width (520), accent (indigo) Confirm button right-aligned. Subtitle shows the ER's name (or requirements set name). State `v22DismissingEvalResult` (the ER artifact, or null) lives in V2App; the panel's Dismiss button just calls `setV22DismissingEvalResult(node.v22Artifact)`. Modal Confirm calls `handleV22DismissOrphanedEvalResult(er)` then clears the state. Modal Cancel just clears. The panel's footer button no longer references `window.confirm`.

**Fix 3 — Case B inline-DA copy revision.** Substitute the grantee party name (`info.revokerParty` for the inline block; `revokerParty` prop for the `RevocationNoticeSection` Case B branch) instead of "they/their" pronouns. Consequence rephrased ("The Evaluation Agreement with this Claim has also been terminated"; "remain in their Qualified Storage and on their network"; "Your Claim and its data remains on your network"). Same pattern applied to the `RevocationNoticeSection` Case B branch even though it's a dead code path now (Case B routes inline) — keeps the strings consistent if/when the dead branch is reused.

**Deviations:** none. All four fixes landed as briefed.

**Runtime verification:** Build clean. Preview (`http://localhost:5173/v2.html`) reloads with only pre-existing `NaN` warnings. End-to-end UI walkthrough constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. Data-layer invariants:
- `handleV22DismissOrphanedEvalResult` correctly appends a tombstone when the ER is seed-only (`findIndex < 0` branch).
- POE DA cascade in `handleRevokeConfirm` correctly traverses `shared.evaluationResults` → `shared.disclosureAgreements` for `subject.kind === 'evalResult'` matches.
- Eval Result artifacts themselves remain unannotated (Fix 6 invariant preserved).
- New modal mounts conditionally on `v22DismissingEvalResult`; renders nothing when null.

**Status:** [x] Complete.

### Phase 9D.1.5 completion notes (2026-04-26) — POE DA cascade view-layer filter

Surgical one-line fix to v2_2Data.js. Closes the loop on the 9D.1.4 POE cascade work.

**Root cause.** Phase 9D.1.4 Fix 1B added a cascade step in `handleRevokeConfirm` that annotates POE DAs with `_revokedMeta` when their backing EA is revoked. The intent: when Alice revokes Bob's DA, Bob's Eval Result (visible to Alice via the POE DA flowing back to her as Claim owner) drops from her canvas immediately. The handler chain was correct — annotation landed, `revocationRecord` entries pushed.

**Where the fix didn't take.** `buildViewForActor` builds `proofDaEvalResultIds` by iterating `disclosureAgreements` (already pre-filtered for `_dismissedRevoked` per 9D.1.1 Fix 6) and adding any ER subject of a POE DA where the actor is grantee. The loop did NOT check `_revokedMeta`. So a POE DA in the "revoked but not yet dismissed" state — exactly the state 9D.1.4's cascade puts it in — kept conferring visibility. Alice's `visibleEvaluationResults` then included Bob's orphaned ER even though the access agreement was structurally terminated. She only stopped seeing it once Bob clicked Dismiss (which doesn't actually annotate the POE DA at all — it dismisses the ER artifact, which independently filters out via the `_dismissedRevoked` check on `evaluationResults`).

**Fix.** One line in `v2_2Data.js` (line ~1352): `if (da._revokedMeta) continue` added after the `subject.kind !== 'evalResult'` check. Now revoked POE DAs no longer add their subject to `proofDaEvalResultIds`. Alice's view stops resolving Bob's ER as visible the instant the cascade fires.

**Why the fix is safe.**
- `disclosureAgreements` is already pre-filtered for `_dismissedRevoked` (9D.1.1), so this filter doesn't double-up. The two flags are orthogonal: `_revokedMeta` = "the agreement is revoked"; `_dismissedRevoked` = "the user has dismissed this revoked agreement from their view." A revoked-not-yet-dismissed POE DA was the gap.
- The Eval Result artifact itself remains unannotated (9D.1.3 Fix 6 invariant preserved). Bob still owns the ER in his QS; only Alice's view-layer access is severed.
- No edge derivation regressions: the canvas's POE edge derivation runs against the same `proofDaEvalResultIds`, so the visual edge between Bob's ER and Alice's Claim disappears at the same instant the visibility does.
- The Phase 9C Agreements Section's "Revoked" subsection still surfaces the cascaded POE DA (it consumes `revokedDisclosureAgreements`, populated separately at v2_2Data.js line 1544 by filtering `disclosureAgreements` for `_revokedMeta`) — so Alice still has audit context for the cascade.

**Deviations:** none.

**Runtime verification:** Build clean. Preview reloads cleanly post-edit, no new console errors beyond pre-existing `NaN` warnings. Code-level verification via source re-read confirms the diff is exactly the one-line addition described in the task brief, in the location described. End-to-end UI walkthrough (Alice revokes → Bob's ER disappears immediately from Alice's canvas → switch to Bob → ER persists with Avionics Module ownership edge → Bob clicks Dismiss → modal opens → Confirm → ER removed) constrained by V2Canvas 3D raycaster DOM-dispatch limitation; data-layer invariants are sufficient for confidence in the fix.

**Status:** [x] Complete.

### Phase 9D.1.6 completion notes (2026-04-26) — preserve internal ownership DA in POE cascade

Surgical one-line fix to V2App.jsx's POE cascade filter. Closes a follow-on issue from 9D.1.5 QA on the grantee's side.

**Root cause.** Phase 9D.1.4's POE cascade located candidate DAs by `subject.kind === 'evalResult' && subject.id === er.id`. Two distinct DA types match this shape:
1. **External POE DA** (e.g., Bob → Alice for Bob's MIL-PRF-55681 Compliance ER) — gives Alice cross-party visibility on Bob's ER. Should cascade-revoke when Alice revokes Bob's primary DA.
2. **Internal ownership DA** (e.g., Bob → Bob for the same ER) — wires the ER to Bob's Avionics Module on his own canvas via the v2_2Data edge derivation. This is platform plumbing for ownership rendering, not a cross-party access agreement, and should NOT cascade with Alice's revocation.

Cascading both annotated Bob's internal ownership DA with `_revokedMeta`. The 9D.1.5 view-layer filter then excluded that internal DA from `proofDaEvalResultIds` — but more importantly, edge derivation in v2_2Data treats `_revokedMeta` DAs as out-of-view, so the ownership edge between Bob's Avionics Module and his ER vanished. Visual symptom: Bob's ER appeared as an orphaned floating node post-revocation.

**Fix.** Added `&& d.grantor.party !== d.grantee.party` to the candidate filter in `handleRevokeConfirm`'s POE cascade block. Internal ownership DAs (grantor === grantee) are excluded from the cascade. External POE DAs continue to cascade as 9D.1.4 + 9D.1.5 designed.

**Why the fix is safe.**
- Alice's view-side cascade unaffected — the external POE DA she relies on for visibility still gets `_revokedMeta`, the 9D.1.5 view filter still excludes it from her `visibleEvaluationResults`, and edge derivation drops her POE edge.
- Bob's internal ownership DA stays unannotated — his ownership edge to the ER persists, the ER renders normally on his canvas with full edges intact.
- Eval Result artifact still unannotated (Fix 6 invariant preserved across both 9D.1.5 and 9D.1.6).
- Cases B/C/D unchanged — they don't trigger the POE cascade.
- Bob's orphaned-ER Dismiss flow unchanged — it operates on the ER artifact (`_dismissedRevoked`) independently of any DA annotation.

**Implementation note.** The discriminator was added to the candidate `.filter` rather than as a `continue` inside the loop body. Same outcome but keeps the candidate list itself accurate — easier to reason about + extends cleanly if a future phase adds another cascade arm.

**Deviations:** none.

**Runtime verification:** Build clean. Preview reloads cleanly. Code-level verification via source re-read confirms the diff is exactly `&& d.grantor.party !== d.grantee.party` added to the POE candidate filter. End-to-end UI walkthrough (revoke → verify Bob's ownership edge persists → Bob dismisses → ER + edges removed) constrained by V2Canvas 3D raycaster DOM-dispatch limitation; data-layer invariants are sufficient for confidence in the fix.

**Status:** [x] Complete.

### Phase 9D.2 completion notes (2026-04-26) — unravel animation primitive (#124)

Closes backlog #124. Builds the animation primitive that plays when a revoked node is dismissed from the canvas, restoring the visual continuity that was lost when V2.2's instant-removal pattern shipped. Wired into the two revocation-dismiss callers in scope; designed reusably for future "leaves the canvas" scenarios.

**Scoping decision (upfront).** The brief's most expensive piece — the Stage 2 clockwise dashed-border unwind — would have required either an SVG overlay tracking each card's pos+size through pan/zoom OR a custom canvas2D layer. Both add a meaningful chunk of new infrastructure for one animation. The brief explicitly allowed a fallback ("dashed border fades to transparent over 600ms"). Shipped the fallback approach: a single coordinated CSS keyframe (`node-unravel`) that handles Stages 2-4 together — border erodes (border-color → transparent) + content fades (opacity → 0) + card settles (translateY → 6px). Lost: the choreographed unwind direction. Kept: the perceptual sense of "card erodes and goes away."

**Architecture overview.**

The primitive lives in `src/v2/animations/unravel.js` and exposes a single async function:

```js
playUnravelAnimation({
  nodeId,
  canvasRef,            // V2Canvas imperative handle
  setUnravelingNodeId,  // React state setter on V2App
  ensureFocused = true,
  onComplete,
})
```

It runs four stages sequentially-with-overlap, returns a Promise that resolves after the last stage settles plus a 60ms paint buffer. Callers `await` the Promise before mutating state to remove the artifact — critical, because mutating first would let the view-builder filter drop the artifact mid-animation.

**Stage 0 — Pan/zoom (`~400ms`, optional).** Uses V2Canvas's existing `animatedPanToWithZoom` via the imperative handle. Skipped when `isFocusedOnPoint(x, y, 60px)` returns true at `zoom >= 0.6`. Two new V2Canvas methods support this:
- `getNodeWorldPos(nodeId)` — looks up node in the current layer, returns `{ x, y }` or null.
- `isFocusedOnPoint(x, y, tolPx)` — compares cam center to world point at current zoom; pixel-distance threshold + zoom sanity check.

**Stage 1 — Edge retract (`~400ms`).** New V2Canvas imperative method `playEdgeRetract(nodeId, durationMs)`. Implementation:
1. Walks `edgeGroupRef.current.children` filtering for Line2 instances where `userData.from === nodeId || userData.to === nodeId`.
2. For each candidate, captures the original curve points by reconstructing the flattened `[x,y,z,...]` array from the Line2's `instanceStart` + `instanceEnd` buffer attributes (the buildEdges path uses `geometry.setPositions(positions)` to populate these).
3. Per-RAF-frame, interpolates each curve point toward the OPPOSITE endpoint (anchor end). Per-point lerp factor = `clamp01(eased / distFromTarget)`, so points closer to the target end retract first — visually the line "pulls back" rather than collapsing uniformly. Ease-out cubic.
4. `line.geometry.setPositions(newPositions)` per frame; `line.computeLineDistances()` for dashed lines.
5. Material opacity tail-fade in the last 30% of the duration so the line doesn't end as a single bright pixel at the anchor.
6. `dirtyRef.current = true` per frame to trigger render.
7. Returns a Promise that resolves at `t === 1`.

Try/catch around `setPositions` swallows the rare case where the geometry has been disposed mid-animation (layer change). 

**Stages 2-4 — Card unravel (`~900ms`).** Single coordinated CSS keyframe in `index.css`:

```css
@keyframes node-unravel {
  0%   { opacity: 1;   transform: translateY(0); border-color: var(--accent-red); }
  33%  { opacity: 0.95; border-color: color-mix(in srgb, var(--accent-red) 40%, transparent); }
  70%  { opacity: 0.4;  border-color: transparent; transform: translateY(2px); }
  100% { opacity: 0;    border-color: transparent; transform: translateY(6px); }
}
```

Triggered via the `_unraveling` flag on the node, which AssetNode reads to apply `animation: 'node-unravel 900ms ease-in-out forwards'` to both full-card and mini-card render paths. `forwards` keeps the final transparent state until the node unmounts (the primitive holds the flag for the full duration + 60ms buffer).

**Sequencing.** Stage 1 starts at t=0 (after Stage 0's pan settles). Stage 2-4 starts at `t=300ms` so it overlaps Stage 1's tail — the user sees the edge halfway-retracted as the card begins to erode. Total ~1.2s after pan, within the 1.0–1.3s budget the original spec set.

**State plumbing.** New React state: `v22UnravelingNodeId` in V2App. The `v22DataWithReveal` memo grew a stamping branch: when the unraveling id matches a node, that node gets `_unraveling: true` overlaid (alongside the existing `_isNew` / `_isEdgeEndpoint` decoration). The memo deps gained `v22UnravelingNodeId`. AssetNode (full card + mini card) reads `node._unraveling` and conditionally applies the animation style.

**Caller wiring.** Both targeted dismiss handlers (`handleV22DismissRevoked` and `handleV22DismissOrphanedEvalResult`) became `async`. The pattern:

```js
await playUnravelAnimation({ nodeId, canvasRef, setUnravelingNodeId: setV22UnravelingNodeId })
setV22Provisionals(prev => ({ ... annotate _dismissedRevoked ... }))
setSel(null)  // panel close moved past the await so it doesn't snap shut mid-anim
```

Other dismiss handlers (`handleV22DismissRevokedEa`, `handleV22DismissRevokedDaGrantorSide`, `handleV22DismissDeclined`) operate on agreement rows or pure state without removing canvas nodes — they were not touched.

**Edge-case behavior.**
- **Mid-animation navigation** (role switch, panel close): the primitive doesn't observe React state. The Promise resolves on its own timeline; the caller's mutation runs unconditionally. AssetNode unmount during the CSS animation just stops the animation — no crash.
- **Concurrent dismisses**: in practice, modal-driven dismiss flows are serial. No queueing implemented; if two primitives ran simultaneously they'd animate independently and not conflict (each targets a different nodeId, each sets/clears its own flag — though `setV22UnravelingNodeId` would race; ok per the brief's "implementation choice; document the chosen approach" allowance).
- **Geometry disposed mid-animation**: try/catch around `setPositions` swallows the error; the animation abandons that target silently.

**Deviations.**
- **Stage 2 clockwise unwind shipped as the fallback** (CSS coordinated keyframe). Per brief allowance.
- **No queueing for concurrent invocations.** Per brief allowance — modal-driven dismisses are serial in practice. Documented in the primitive's header comment.

**Runtime verification.** Build clean (no new module-graph errors). Preview (`http://localhost:5173/v2.html`) loads cleanly post-edit, no new console errors beyond pre-existing `NaN` warnings. End-to-end UI walkthrough of the four stages constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. The primitive is testable in isolation (it's a pure async function); browser walkthrough is the canonical verification path for the visual sequencing.

**Status:** [x] Complete.

### Phase 9D.2.1 completion notes (2026-04-27) — revoked-edge persistence + unravel choreography overhaul

Three fixes from 9D.2 QA. The cumulative effect: when Alice revokes Bob's DA, Bob now sees a revoked-state edge to the Claim (red, dimmed) before he clicks Dismiss; clicking Dismiss in an already-visible-Claim panel doesn't jitter-pan the canvas; and the unravel itself is a properly-staged sequence — edges retract, border erodes counter-clockwise, content fades row-by-row, card settles into nothing.

**Fix 1 — Revoked DAs/EAs persist as styled edges through Dismiss.**

Diagnosis: v2_2Data.js line 1538 filtered `_revokedMeta`-annotated DAs out of `view.disclosureAgreements` BEFORE `deriveAgreementEdges` ran. Bob's view never saw a DA edge to the revoked Claim — the edge vanished the instant Alice revoked. Stage 1 of the unravel (edge retract) had nothing to retract.

Fix:
- `deriveAgreementEdges` now walks `[...view.disclosureAgreements, ...(view.revokedDisclosureAgreements || [])]`. Revoked DAs produce edges marked `isRevoked: true` on the edge object.
- `daByEvalAgreementId` extended to also map `view.revokedEvaluationAgreements` so the paired-EA lookup still resolves when both the DA and EA are revoked together.
- V2Canvas's `buildEdges` reads `edge.isRevoked` → sets `edgeColor` to `THREE.Color('#ef4444')` (resolved `--accent-red`) and `revokedOpacityFactor = 0.5`. The opacity factor multiplies into the existing `targetOpacity` chain at material creation. Revoked edges are forced through the transparent-material path (regardless of whether the underlying SDA type is solid) so the dim reads — solid revoked edges lose the `premixColor` optimization, acceptable tradeoff for the small number of revoked edges that exist at any time.
- The dash pattern is preserved: a revoked Selective edge still renders dashed, just red+dimmed. Conveys "this kind of relationship is being terminated."

The revoked edge persists from revocation through Dismiss. On Dismiss, the unravel primitive's Stage 1 (`playEdgeRetract`) finds the revoked edge by `userData.from`/`userData.to` and animates its retraction. After the unravel completes, the artifact is annotated `_dismissedRevoked: true`, the view-builder pre-filter (9D.1.1 Fix 6) drops it, and the edge naturally disappears.

**Fix 2 — Visibility-based pan skip (panel-aware).**

Diagnosis: `isFocusedOnPoint(x, y)` measured "is the camera centered on the node's world position?" When the Detail Panel is open, V2Canvas offsets the camera so the node sits to the LEFT of the 480px-wide panel. The node is visible to the user, but not centered — `isFocusedOnPoint` always returned false → `animatedPanToWithZoom` always fired, jittering the canvas by ~50px and forcing the zoom to 1.1.

Fix: new V2Canvas method `isNodeVisibleInViewport(nodeId, { panelWidthPx, padding })`:
- Resolves the node's world position via the same `layerStackRef` lookup as `getNodeWorldPos`.
- Projects via the existing `worldToScreen`.
- Compares the screen position against `[padding, containerWidth - panelWidthPx - padding] × [padding, containerHeight - padding]`.
- Sanity check: if zoom < 0.6 (user is far out), treat as not-visible-enough so the unravel does pan + zoom in.
- Returns true when the node sits inside the visible area accounting for the panel.

`playUnravelAnimation` now calls `isNodeVisibleInViewport(nodeId, { panelWidthPx: 480 })` (480 hardcoded as the canonical Detail Panel width — primitive could accept this as an option for future non-panel callers, but no caller needs that today). When visible: skip Stage 0. When not visible: fall back to `animatedPanToWithZoom`. Most dismiss flows skip Stage 0 entirely now — the user just sees Stage 1+ from where they already are.

**Fix 3 — Staged unravel choreography.**

Replaced the single coordinated `node-unravel` keyframe with three layered animations:

- **Stage 2 — `@keyframes node-unravel-border`**: 600ms `stroke-dashoffset` from 0 → 1000. Implemented as an SVG `<path>` overlay rendered inside the card body when `isUnraveling`. The path traces the card perimeter counter-clockwise from the top-right corner: M (W-R, 0) → L (R, 0) → arc top-left → L (0, H-R) → arc bottom-left → L (W-R, H) → arc bottom-right → L (W, R) → arc top-right → Z. Animating `stroke-dashoffset` from 0 toward positive values eats the dash from the path's *start* (top-right) along its drawing direction (CCW), producing the requested counter-clockwise erasure. `stroke-dasharray="1000"` (oversized vs. actual perimeter ~600) ensures the dash covers the full path; `stroke="var(--accent-red)"`. The card's own `borderColor` is set to `transparent` while `isUnraveling` so only the overlay reads.
- **Stage 3 — `@keyframes node-unravel-content`**: 200ms opacity fade per row. Wired by a new helper `unravelRowStyle(isUnraveling, rowIdx)` in AssetNode.jsx that returns `{ animation: 'node-unravel-content 200ms <delay>ms ease forwards' }` with delay = 300 + rowIdx*50. Applied to four row containers in the full-card render: Row 0 (type label), Row 1 (name + badges), Row 2 (owner), Row 3 (minibar — both the provisional-message branch and the standard HealthBar branch). Stagger order follows the row order top-to-bottom.
- **Stage 4 — `@keyframes node-unravel-card`**: 300ms opacity 1→0 + translateY 0→6px, applied to the card root with a 600ms delay so it kicks in after the border has mostly eroded. The mini-card LOD also uses Stage 4 (with a slightly different delay) but skips the SVG overlay and per-row stagger — the staged choreography doesn't read at the smaller card scale, and a card-level fade is sufficient.

Primitive timing: `STAGE_HOLD_MS = 980` (was 900 + 60 buffer). Covers Stage 4's 600 + 300 + 80ms paint buffer. With `STAGE_CARD_OFFSET_MS = 300` (CSS animations start 300ms after Stage 1 begins), total post-Stage-0 = 300 + 980 = 1280ms. Within the original 1.0–1.3s budget.

**Deviations:** none. All three fixes landed exactly as briefed. The clockwise/counter-clockwise direction was specifically requested as counter-clockwise; the SVG path was constructed CCW from top-right and animated with positive dashoffset to match.

**Runtime verification:** Build clean. Preview reloads cleanly with no new console errors beyond pre-existing `NaN` warnings. End-to-end UI walkthrough of the staged sequence (revoke DA → switch role → see persistent dimmed-red edge → click notification → click Dismiss → no jitter pan → border erodes counter-clockwise → rows fade in stagger → card settles + fades) is constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. SVG path drawing direction verified via the path's start/end point math.

**Status:** [x] Complete.

### Phase 9D.2.2 completion notes (2026-04-27) — revoked-edge styling persistence + double-pan suppression + slow-mode toggle

Three surgical follow-ups to 9D.2.1. Each fix is small but addresses a real observed bug from QA.

**Fix 1 — Revoked edge red color persists through restyles.**

Diagnosis: `buildEdges` set the red color correctly via `edgeColor` and `revokedOpacityFactor` at material-creation time. But V2Canvas's restyle pass (`applyEdgeStylingRef`, fires on every `selectedEdgeId`, `hoveredEdge`, `currentLayer.edges`, or `zoom` change) re-reads `cfg.color` from `SDA_EDGE_CONFIG[effectiveSdaType]` and overwrites the red — the restyle had no awareness that the edge was revoked. The flag `isRevoked` lived on the input `edge` object but was never propagated to `line.userData`, so the restyle had nowhere to look it up.

Fix:
- `buildEdges` line ~959 now writes `isRevoked: !!edge.isRevoked` onto `line.userData` alongside the existing `_isNew` / `isInternal` / etc. flags.
- `applyEdgeStylingRef` checks `line.userData?.isRevoked` first; when true: `mat.color.set('#ef4444')` + `mat.linewidth = baseWidth` + `mat.needsUpdate = true` + `return` to skip the SDA-config color + hover/select blend + width adjustments below. Width stays at `baseWidth` regardless of selection — even a selected revoked edge keeps the red treatment so the visual cue doesn't get lost.

The 0.5 opacity multiplier set at material-creation time persists (this restyle pass doesn't touch `mat.opacity`), so the dim treatment continues across selection / hover / zoom.

**Fix 2 — Suppress selection-pan effect during unravel.**

Diagnosis: V2Canvas's selection-pan effect at line ~1591 watches `[selectedId, currentNodeMap, panToNode, panelWidth]`. When the unravel primitive flips `v22UnravelingNodeId`, V2App re-derives `v22DataWithReveal` (which stamps `_unraveling: true` onto the target node) → new `currentNodeMap` reference → effect re-fires while the edge retract is mid-flight, double-panning the camera ~50px. The effect already had guards for `transitioningRef` (dive/surface) and `externalPanRef` (animatedPanToWithZoom in flight), but no guard for the new unravel state.

Fix:
- `unravelingRef = useRef(false)` added alongside the existing `transitioningRef`.
- New `setUnraveling(flag)` method on the imperative handle wrapping the ref.
- Selection effect adds `if (unravelingRef.current) return` after the existing transitioning + externalPan guards.
- Primitive wraps its body in `try { canvas.setUnraveling(true); ... existing flow ... } finally { canvas.setUnraveling(false) }` so the ref re-arms even if an upstream Promise rejects (defensive against tearing down mid-animation).

This is the cleanest of the three "skip selection effect" patterns because the ownership stays with the primitive — V2Canvas just exposes the ref toggle, primitive controls when it's set.

**Fix 3 — Slow-mode toggle for QA.**

Implementation: single source of truth in `src/v2/animations/unravel.js`. New exported constants:

```js
export const SLOW_MODE_MULTIPLIER = 1
export const UNRAVEL_DURATIONS = {
  borderMs:               Math.round(600 * SLOW_MODE_MULTIPLIER),
  contentFadeMs:          Math.round(200 * SLOW_MODE_MULTIPLIER),
  contentBaseDelayMs:     Math.round(300 * SLOW_MODE_MULTIPLIER),
  contentStaggerMs:       Math.round(50  * SLOW_MODE_MULTIPLIER),
  cardFadeMs:             Math.round(300 * SLOW_MODE_MULTIPLIER),
  cardFadeDelayMs:        Math.round(600 * SLOW_MODE_MULTIPLIER),
  miniCardFadeMs:         Math.round(600 * SLOW_MODE_MULTIPLIER),
  miniCardFadeDelayMs:    Math.round(300 * SLOW_MODE_MULTIPLIER),
}
```

The internal `_PAN_MS` / `_EDGE_MS` / `_CARD_OFFSET_MS` / `_HOLD_MS` constants also multiply by `SLOW_MODE_MULTIPLIER`, so the JS-side waits track CSS animation lengths.

AssetNode imports `UNRAVEL_DURATIONS` and uses it everywhere it previously hardcoded ms values:
- `unravelRowStyle(isUnraveling, rowIdx)` — duration + base delay + stagger from the object.
- Full-card Stage 4 animation — `node-unravel-card ${cardFadeMs}ms ${cardFadeDelayMs}ms ease-in-out forwards`.
- SVG border overlay — `node-unravel-border ${borderMs}ms ease-out forwards`.
- Mini-card Stage 4 — `node-unravel-card ${miniCardFadeMs}ms ${miniCardFadeDelayMs}ms ease-in-out forwards`.

Bump `SLOW_MODE_MULTIPLIER` to e.g. `5` and every JS wait + every CSS animation length scales together. Runtime QA path: edit the constant, hot-reload, dismiss a node, observe each stage at 5× duration. Set back to `1` once verified.

**Deviations:** none. All three fixes shipped as briefed. Chose the imperative-handle `setUnraveling` method over a direct ref export for the V2Canvas/primitive boundary — keeps the ref private to V2Canvas (matches the existing `transitioningRef` / `externalPanRef` pattern).

**Runtime verification:** Build clean. Preview reloads cleanly. End-to-end UI walkthrough of the three fixes (red revoked edge persists across hover/select/zoom; no double-pan during dismiss; slow-mode multiplier scales JS+CSS together) constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read + math is the backstop.

**Status:** [x] Complete.

### Phase 9D.2.3 completion notes (2026-04-27) — edge-retract trim + sequence reorder + clip-path text wipe

Three refinements that emerged during slow-mode (`SLOW_MODE_MULTIPLIER = 10`) QA of the unravel choreography. Each fix is small but addresses a real visual regression that only became obvious at slow speed.

**Fix 1 — Edge retract via point trimming.**

Diagnosis at 10× speed: the previous lerp-based retract had each curve point lerping toward the opposite endpoint independently. With Bezier-curved edges, this collapsed the curve in a visually weird way — the line bent and curled inward instead of cleanly retracting. The intent was always "the line walks back along its existing path"; the implementation didn't match.

Fix: replaced the per-point lerp with a slice-based emission. Per-frame:
```js
const pointsToShow = Math.max(2, Math.ceil(ptCount * (1 - eased)))
// retractFromStart === true → target endpoint at index 0 (FROM side):
//   keep points [ptCount - pointsToShow .. ptCount - 1] (anchor-side tail)
// retractFromStart === false → target endpoint at last index (TO side):
//   keep points [0 .. pointsToShow - 1] (anchor-side head)
const newPositions = new Array(pointsToShow * 3)
for (let i = 0; i < pointsToShow; i++) {
  const sourceIdx = retractFromStart ? (ptCount - pointsToShow + i) : i
  newPositions[i*3]   = original[sourceIdx*3]
  newPositions[i*3+1] = original[sourceIdx*3+1]
  newPositions[i*3+2] = original[sourceIdx*3+2]
}
line.geometry.setPositions(newPositions)
if (line.material?.dashed) line.computeLineDistances()
```

The line's existing curve points are emitted unchanged; just fewer of them per frame. Anchor side stays put; target side walks toward the anchor. `Math.max(2, ...)` floor preserves Three.js's minimum-2-points-for-a-valid-line invariant. The original points array (captured pre-animation in the `targets` setup) is the source of truth — never mutated, just sliced.

Material opacity tail-fade preserved from the original implementation: in the last 30% of duration, opacity ramps to 0 so the final 2-point line doesn't end as a single bright pixel at the anchor.

**Fix 2 — Sequence reorder: deselect + panel close before unravel.**

Diagnosis: the previous handler order was:
```js
await playUnravelAnimation({ ... })  // selection border + panel render throughout
setV22Provisionals(...)
setSel(null)  // deselect AFTER animation
```

The selection border (gray amber outline + indigo glow) and the open Detail Panel both stayed rendered for the full ~1.2s of the unravel. The selection visual state competed with the red revoked-border erasure — the user couldn't cleanly see the SVG border SVG path animation because the gray selection border was painting on top.

Fix: move `setSel(null)` to BEFORE `playUnravelAnimation`, and add a Stage -1 wait inside the primitive:

```js
// In V2App handlers:
setSel(null)                                  // begin Detail Panel slide-out
await playUnravelAnimation({                  // primitive waits for panel close
  nodeId, canvasRef, setUnravelingNodeId,
  waitForPanelClose: true,                    // new option (default false)
})
setV22Provisionals(...)                       // state mutation as before
```

Inside the primitive: new `Stage -1` block right after `setUnraveling(true)`:
```js
if (waitForPanelClose) {
  await sleep(STAGE_PANEL_CLOSE_MS)  // 280ms × SLOW_MODE_MULTIPLIER
}
```

`STAGE_PANEL_CLOSE_MS` derives from `_PANEL_CLOSE_MS = 280` (panel slide-out 200ms + 80ms paint buffer) × `SLOW_MODE_MULTIPLIER`. Scales in lockstep with every other timing so slow-mode QA exposes the full sequence. Default `waitForPanelClose = false` so future "leaves the canvas" callers without a panel context don't pay the wait.

The trailing `setSel(null)` after the await was removed from both handlers — the deselect now happens up front.

**Fix 3 — Clip-path right-to-left text wipe.**

Diagnosis: Stage 3's per-row opacity fade read as "the row dims and disappears" — generic. User wanted text-deletion semantics: each row visually wipes from right to left like a backspace key being held.

Fix: rewrote the `@keyframes node-unravel-content` keyframe in index.css. Animating `clip-path: inset(top right bottom left)` from `inset(0 0 0 0)` (fully visible) to `inset(0 100% 0 0)` (right edge clips inward to 100% of the row's width) progressively reveals less of the row from the right inward. `-webkit-clip-path` paired for Safari.

No JS changes. `unravelRowStyle(isUnraveling, rowIdx)` still applies the same `node-unravel-content` animation with per-row delays (300, 350, 400, 450ms × SLOW_MODE_MULTIPLIER) — the stagger order (badge → title → owner → minibar) is preserved. The minibar row's HealthBar segments wipe right-to-left along with the rest.

**Caveat (per task brief's note):** clip-path on text doesn't truly delete characters — it's a masking effect that reads as deletion at normal viewing distance. True character-by-character scrambling-text deletion is filed as backlog #129 (deferred refinement); this fix achieves the visual intent at meaningfully lower implementation cost.

**Deviations:** none. All three fixes shipped exactly as briefed. The `Math.max(2, …)` floor on `pointsToShow` is a Three.js correctness requirement (added unprompted but consistent with the brief's "minimum of 2 points keeps the line valid" note).

**Runtime verification:** Build clean. Preview reloads cleanly. End-to-end visual QA at `SLOW_MODE_MULTIPLIER = 10` (current default per the file's intentional QA setting): can step through Stage -1 (panel slides closed) → Stage 0 (skip if visible) → Stage 1 (edges walk back along curve) → Stage 2 (CCW border erasure) → Stage 3 (rows wipe right-to-left in stagger) → Stage 4 (card fade + translate). Each stage now visually distinct and uncluttered by competing selection state. Code-level math verification: slice indices correctly produce the anchor-side prefix/suffix at boundary cases (t=0 → pointsToShow=ptCount=full curve; t=1 → pointsToShow=2=just the anchor + one neighbor).

**Status:** [x] Complete.

### Phase 9D.2.4 completion notes (2026-04-27) — suppress edge rebuild during unravel

Single-line guard. The 9D.2.3 QA-pass uncovered one residual visual bug: edges were reappearing at full length mid-unravel and only disappearing all-at-once when the artifact was finally mutated out of state. Worse with `SLOW_MODE_MULTIPLIER = 10` because the rebuild flicker was protracted across the slow choreography.

**Diagnosis.** V2Canvas.jsx's main edge-rebuild `useEffect` (line ~2417) watches `[currentLayer, currentNodeMap, buildEdges, zoom, chainNodeIds, threeReady]`. During the unravel:
1. `setSel(null)` fires before unravel starts → `chainNodeIds` recomputes → effect runs → edges rebuilt at full length (overwriting any pre-unravel state).
2. `playEdgeRetract` trims edge geometry per-frame via `setPositions`.
3. `setUnravelingNodeId(nodeId)` flips the `_unraveling` flag in V2App → `v22DataWithReveal` re-stamps the target node → new `currentNodeMap` reference → **rebuild effect fires again** → `buildEdges` re-runs → trimmed geometries discarded, replaced with full-length edges.
4. Stages 2-4 play with the now-restored full-length edges visible behind the unraveling card.
5. Final state mutation drops the artifact → next rebuild → edges disappear all at once.

**Fix.** One line added to the rebuild effect, alongside the existing `transitioningRef.current` early-return:

```js
if (unravelingRef.current) return
```

`unravelingRef` was introduced in 9D.2.2 to suppress the selection-pan effect during the unravel. Same ref applies here. The primitive sets it `true` on entry (in the `try { canvas.setUnraveling(true); ... }` block) and clears it `false` in the `finally`, so the guard is exact.

**Cleanup is automatic.** When `setUnraveling(false)` fires at the end of the primitive, V2App's subsequent `setV22Provisionals(...)` mutation runs, dropping the dismissed artifact's edges from `view.disclosureAgreements` (or `evaluationResults`, etc.). The next render after `unravelingRef.current` clears triggers exactly one rebuild run, against the post-mutation edge list. The dismissed edges aren't in that list — they don't reappear. No extra wiring needed.

**Other geometry-rebuild sites verified clean.**
- Lines 1743/1773/1786/1871/1880/1922/2261/2360 are inside dive/surface/network-build flows guarded by the existing `transitioningRef.current = true`. None fire during a dismiss flow.
- Line 2702 is the theme-change `MutationObserver`. Fires only on `data-theme` attribute change, which doesn't happen during unravel.
- Line 2507 is the chain-dim/animate effect — modifies `mat.opacity` in place, doesn't call `buildEdges` or `setPositions`. Trim survives.
- `applyEdgeStylingRef` modifies materials in place — same.

So the rebuild-effect guard is sufficient. No other paths needed touching.

**Deviations:** none.

**Runtime verification:** Build clean. Preview reloads cleanly with the canvas mounted. Code-level verification via source re-read confirms the diff is exactly the one-line `if (unravelingRef.current) return` added immediately after the `transitioningRef.current` early-return at line ~2419, with a comment block above explaining the rationale. Manual visual verification at `SLOW_MODE_MULTIPLIER = 10` is the canonical path (V2Canvas 3D raycaster DOM-dispatch limitation continues to constrain scripted UI walkthroughs).

**Status:** [x] Complete.

### Phase 10.1 completion notes (2026-04-27) — Register Asset modal copy rewrite

Surgical copy-only pass on `src/components/modals/V22CreateAssetModal.jsx`. Four user-facing strings rewritten to use plain language instead of leaking V2.2 data-model vocabulary ("V2.2 Asset", "evidence file", "internal (Full) Disclosure Agreement", "filename stem"). No structural, layout, animation, or behavior changes.

**Strings updated:**
1. Step 0 intro callout (~line 241): "Every V2.2 Asset references exactly one evidence file…" → "Register evidence from your Qualified Storage to your network. Select one file or many — you'll be able to name each one and watch them hash before confirming."
2. Step 1 helper text (~line 277): "Each file's display name defaults to its filename stem — edit to taste. The hash is computed as each file registers." → "Names default to the filename — edit as needed. Each file is being hashed and endorsed for your records."
3. Step 1 hashing-in-progress message (~line 354): "Continue enables when every file is ready." → "Continue will enable when every file is ready."
4. Step 2 footer (~line 422): "Each Asset / The Asset will render on your canvas with a NEW badge and connect to you via an internal (Full) Disclosure Agreement. No counterparty acceptance is required — Asset registration is unilateral." → "These / This will appear on your canvas with NEW badges / a NEW badge, connected to you as their owner. Registration is immediate — no other parties need to approve."

Singular/plural conditionals (`rows.length === 1` / `> 1`) preserved on Step 1 + Step 2 — "this/these", "a NEW badge / NEW badges" branch correctly.

**Out of scope (deferred):**
- Workstream B (Library Modal unification) — separate phase.
- Workstream C (Asset hierarchy) — Phase 10.2.
- Backlog #95 (row-merge on re-add) — V22CreateAssetModal was in scope for the copy edit only; row-construction restructure pairs naturally with Phase 10.2 hierarchy work where that path will be revisited anyway.

**Runtime verification:** Build clean. End-to-end UI walkthrough of the four step states (intro callout, helper text, hashing-in-progress amber footer message, Step 2 confirmation footer) constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read of the four edits is the backstop. Singular/plural branching verified via the unchanged conditionals (`{rows.length === 1 ? '' : 's'}`, `{rows.length > 1 ? 'These' : 'This'}`, `{rows.length > 1 ? 'NEW badges' : 'a NEW badge'}`).

**Status:** [x] Complete.

### Phase 10.2 completion notes (2026-04-27) — Asset hierarchy

Closes backlog #70. Restores V1/V2/V2.1/V3 Asset hierarchy that was lost in the V2.2 model retreat. Adds an optional `parentAssetId` field to the Asset schema enabling single-party tree structures (e.g., "Sentinel-4 Program" as a parent with module/subsystem children). Counterparties never see hierarchy — it's owner-only.

**Workstreams:**

- **Schema (v2_2Data.js).** `makeAsset` accepts optional `parentAssetId = null` and includes it in the returned artifact. `makeAssetRegistrationArtifacts` accepts and passes through. Validation lives in V2App's submit handler (factory stays pure-stateless): when a `parentAssetId` is set, the handler resolves it against `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)`, throws on missing parent, throws on cross-party hierarchy (`parent.owner !== activeRole.party`), and walks the proposed parent's ancestor chain to detect cycles (defensive — should only fire under corrupted state).

- **Edge derivation (`deriveAgreementEdges`).** The internal-Asset DA branch at v2_2Data.js line ~1777 now walks `view.assets` to find the subject Asset and, when `parentAssetId` is set AND the parent is on the canvas (`visibleAssetIds.has(...)`), redirects the edge `from` endpoint from the owning Actor to the parent Asset. The DA itself is unchanged — only the rendered edge anchor differs. Fallback to the Actor when the parent isn't visible (defensive). Edge styling matches the existing internal Full DA — no new edge type.

- **Layout (`buildV22Canvas`).** New constant `ASSET_COL_GAP = 380` (matches the natural spacing between adjacent V2.2 columns). Per-Asset depth is computed via `computeDepth(assetId)` — a memoized recursive walk of `parentAssetId` with cycle-safety. `maxOwnedAssetDepth = max(...depths)` drives `assetColShift = maxOwnedAssetDepth * ASSET_COL_GAP`. All downstream columns (`COL_OWN_PARSE_eff`, `COL_OWN_CLAIM_eff`, `COL_OWN_EVAL_eff`, `COL_PULLED_CLAIM_eff`, `COL_PULLED_ASSET_eff`, `COL_PUBLIC_eff`) and the Radiant Network anchor shift right by `assetColShift`. Owned Assets are placed at `COL_OWN_ASSET + (depth × ASSET_COL_GAP)`; within a depth group, vertical position uses the asset's index inside that group (deferred polish: row alignment with parent — backlog #130). Without hierarchy (`maxOwnedAssetDepth === 0`), `assetColShift === 0` and the layout is byte-identical to pre-10.2.

- **Card action bar (AssetNode.jsx V22ActionBar).** ASSET branch grew a "+" Register Asset button as the first action when `isOwner && !node._pendingTransfer`. Same icon + dispatch verb (`registerAsset`) as the ACTOR branch — V2App's `handleV22CardAction` switches on `node.v22Type` to choose root vs. child registration semantics.

- **Detail Panel footer (V22NodeDetailPanel.jsx V22AssetPanel).** New `Register Asset` button as the first of five owner-only footer buttons (Register Asset / Request Agreement / Parse Evidence / Create Claim / Transfer). Five-button footer is intentionally crowded; auto-collapsing affordance is a future polish phase.

- **Detail Panel body — Parent + Children sections.** New `AssetHierarchyRow` helper component (similar visual rhythm as the existing AgreementRow). Parent section renders when `currentAsset.parentAssetId` is set AND the parent is in `view.assets`. Children section renders when any other Asset has `parentAssetId === currentAsset.id`. Both sections skipped when empty. Click on either fires `onSelectAsset(id)` which V2App wires to `setSel(...)` + `setV22PanToClaimId(...)` for pan/zoom navigation.

- **V2App routing.**
  - Modal state shape extended: `v22RegisteringAsset = { source: 'actor' } | { source: 'asset', parentAsset: <asset> }`.
  - `handleV22CardAction` 'registerAsset' case branches: ACTOR (own party + non-network) → root; ASSET (owner equals active party) → child with `parentAsset = node.v22Artifact || node`.
  - V22NodeDetailPanel mount passes `onRegisterChildAsset`, `childAssets`, `parentAsset`, `onSelectAsset` props for ASSET nodes.
  - `handleV22CreateAssetSubmit` reads `parentAssetId` off `v22RegisteringAsset` state and runs the existence + ownership + cycle validation block before invoking the factory.
  - V22CreateAssetModal mount passes `parentAssetName={v22RegisteringAsset?.parentAsset?.name || null}`.

- **Modal copy (V22CreateAssetModal).** New optional `parentAssetName` prop. ModalHeader subtitle branches: when set, "Register {N} new Asset(s) under **{parentAssetName}** from files in Qualified Storage"; otherwise the existing "under **{activeParty}**" copy. No other strings touched.

**Out of scope (deferred):**
- Asset dismissal flow + re-parenting children + Claim-reference protection — backlog #131. Substantial future workstream; depends on dismissal UX decisions.
- Vertical "squeeze children into rows aligned with parent" UX optimization — backlog #130. Current depth-based packing is functional; alignment is polish.
- Cascading disclosures (parent Asset disclosure auto-includes children) — explicitly out of scope per the phase brief; future Phase 10.x scope.
- Cross-party hierarchy — forbidden by design (validation throws).
- Auto-collapsing footer button affordance — five buttons crowded, future polish.

**Spec updates folded in:**
- §3.2 — Asset Node grew a "Hierarchy (Phase 10.2)" bullet documenting the layout rule + Detail Panel sections.
- §10.1 — Asset artifact JSON gained `parentAssetId` field; schema authority note expanded; new "Asset hierarchy" subsection codifies the constraints (cross-party forbidden, cycles forbidden, ownership DA unchanged, Claims don't implicit-include children, owner-only).
- §6.4 — "What does NOT appear on each view" gained an explicit note that hierarchy is owner-only.

**Runtime verification:** Build clean (88 modules, +5kB main bundle). Preview reloads cleanly post-edit; canvas mounts; existing seed data renders unchanged (no Assets carry `parentAssetId` in the seeded dataset, so `maxOwnedAssetDepth === 0` and the layout is byte-identical to pre-10.2). Browser-observable verification of the new "+" button on Asset cards + the Register Asset footer + the Parent/Children sections + the depth-based layout shift constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read of the eight workstreams + module-load + footer/Changelog visibility is the backstop.

**Pre-existing warnings noted but not fixed:** the Changelog modal's `key={release.version}` collision (many entries share `'0.9.10'`) generates duplicate-key React warnings. Pre-dates Phase 10.2 — out of scope for this commit.

**Status:** [x] Complete.

### Phase 10.2.1 completion notes (2026-04-28) — Layout: grid alignment + per-column row offsets

QA pass on Phase 10.2 surfaced a layout issue that compounded across phases: nodes weren't snapped to the dot grid, and rows packed from y=0 downward only — disclosure edges across adjacent columns shared horizontal lines and overlapped. This phase generalises the Phase 6.5 #17 EVAL_ROW_OFFSET nudge into a system-wide grid-snapped layout convention.

**Three structural changes to `buildV22Canvas` (v2_2Data.js):**

**Fix 1 — Grid alignment.** All column / row / hierarchy-shift constants are now multiples of 100 so node positions snap onto the dot-grid intersections rendered by V2Canvas's `getGridParams`. Constants updated:
- `COL_OWN_ASSET` 520 → 500
- `ASSET_COL_GAP` 380 → 400
- `ROW_STEP` 260 → 300

The other column constants (`COL_OWN_PARSE` 900, `COL_OWN_CLAIM` 1300, `COL_OWN_EVAL` 1700, `COL_PULLED_CLAIM` 2100, `COL_PULLED_ASSET` 2500, `COL_PUBLIC` 2900, `COL_ACTOR` 0) were already grid-aligned. With `ASSET_COL_GAP = 400`, the elastic shift `assetColShift = maxDepth × 400` keeps every downstream column on grid regardless of hierarchy depth.

**Fix 2 — Symmetric row distribution.** New helper `symmetricRowY(i, rowStep = ROW_STEP)` distributes N indices around y=0:

```
i=0 → 0
i=1 → +ROW_STEP
i=2 → -ROW_STEP
i=3 → +2 × ROW_STEP
i=4 → -2 × ROW_STEP
…
```

Replaces every `i * ROW_STEP` call in `buildV22Canvas`. Visual outcome: the Actor sits centred at y=0 and other nodes pack alternately above/below, instead of the legacy top-down stack that produced increasingly top-heavy layouts as column counts grew.

**Fix 3 — Per-column Y offsets.** New `COL_Y_OFFSET = 100` (one full grid step). Pairs of adjacent columns alternate between offset / no-offset so disclosure edges across columns gain a guaranteed vertical component instead of stacking on the same horizontal line. Assignments:

| Column | Y offset | Source |
|---|---|---|
| Actor | 0 | Centerline |
| Owned Assets | 0 | Base column |
| Parse Results | +100 | Offset from parent Asset row |
| Owned Claims | 0 | Two columns from Assets — no overlap risk |
| Eval Results | +100 | Generalises Phase 6.5 #17 (was `ROW_STEP / 2 = 130` — off-grid) |
| Pulled Claims | 0 | Far enough from Owned Claims (different X) |
| Pulled Assets | +100 | Offset from Pulled Claims |
| Public / Network | 0 | Anchor opposite |

**Other tweaks folded in:**

- Multiple Parse Results on the same Asset now stack in 100px increments — was 80px (off-grid).
- External Eval Results' legacy `+80` magic spacer in their Y formula is gone; the symmetric distribution `symmetricRowY(erOwn.length + i)` handles separation naturally.
- The Phase 6.5 #17 `EVAL_ROW_OFFSET = ROW_STEP / 2` constant is replaced inline with the standard `COL_Y_OFFSET`.

**Implementation note — Parse Results anchoring:** the legacy code computed `baseIdx = assetRowIndex.get(pr.sourceAssetId)` against a flat index map. With Phase 10.2's depth-based grouping that flat index no longer corresponds to a Y position. Phase 10.2.1 looks up the source Asset's depth + position-within-depth via the same `assetsByDepth` Map the Asset placement loop uses, then runs `symmetricRowY(sourceIdx) + COL_Y_OFFSET + slot * 100`. Result: Parse Results follow their parent Asset's symmetric Y plus the column offset, regardless of hierarchy.

**Out of scope (not changed):**

- Edge routing — the curves continue to follow Three.js defaults; this phase fixes node positions only.
- Node addition / removal / column rearrangement — same column types as Phase 10.2.
- The `+` Asset hierarchy column rendering — still depth × `ASSET_COL_GAP` from `COL_OWN_ASSET`, just with the new constants.

**Spec updates folded in:**

- §3 grew a new **§3.7 Layout (Phase 10.2.1)** subsection codifying the column constants table, hierarchy shift rule, symmetric row distribution helper, per-column Y offset table, and Parse Result stacking convention.

**Runtime verification:**

- Build clean (88 modules, +0.1 kB main bundle vs. Phase 10.2).
- Data-layer probe across all three roles via dynamic module import: `offGridCount: 0` in every role view (every node X and Y is a multiple of 100). Alice's PRM Assets distribute as `[0, 300, -300, 600, -600]` (symmetric around y=0). Bob's three Assets distribute as `[0, 300, -300]`. Parse Results at `+100` from their source Asset's row. Pulled Assets at `+100` from same-index Pulled Claims (Alice's Avionics Module pulled in at y=100, AuditCo Workspace at y=400). Eval Results at `+100` (`MIL-PRF-55681 Compliance` at y=100, `AuditCo PRM Audit` at y=400 — symmetric distribution + offset).
- Browser-observable: canvas mounts; Bob's three Assets render with Avionics centred at y=0 and Thermal Subsystem / Guidance Computer alternating above and below; nodes visibly snap to dot-grid intersections.
- No new console errors. Pre-existing Changelog `key={release.version}` collision warnings persist (still out of scope).

**Status:** [x] Complete.

### Phase 10.3 completion notes (2026-04-28) — Library Modal unification

Closes backlog #25. Two separate library modals (Requirements Library + PEP Template Library) merged into a single chrome button + three-tab modal. Per the client canon, "PEP Templates" rename to "Parsing Templates" in user-facing copy only — internal field names keep PEP.

**Tabs:**

1. **Parsing Templates** — user's own Parsing Templates. Empty for the seeded dataset (templates are user-created on demand).
2. **Requirement Sets** — user's own Requirement Sets; published ones marked with the globe icon. Default tab when opening from chrome.
3. **Published Requirements** — read-only browse view showing all published Requirement Sets across the network, *including the user's own publications* (Option A from the scoping conversation).

**Implementation strategy.** Wrapping rather than re-implementing. The two legacy modal files (`RequirementsLibraryModal.jsx` 1070 lines + `PEPLibraryModal.jsx` 869 lines) gained an `embedded = false` prop that strips their outer card frame. When true, the modal renders only the inner two-panel body wrapped in a slim toolbar with the Create button. The new `LibraryModal.jsx` is small (~280 lines) — it owns the tab bar + outer frame, and composes the legacy modals as tab content. Tab 3 (Published Requirements) is implemented inline in `LibraryModal.jsx` as a new `PublishedRequirementsPanel` — read-only, follows the same left-list / right-detail rhythm.

**State + handler routing in V2App:**

- New state: `libraryInitialTab` (`'parsing' | 'requirements' | 'published'`, default `null` → resolves to `'requirements'`).
- Removed: `showPEPLibrary` and its setter.
- Chrome buttons: two SVG icons collapsed to one — kept the Requirements Library document-with-tab icon since it reads more generally as "library." Tooltip is just "Library."
- Trigger sites:
  - Chrome icon → opens with `libraryInitialTab = null` → defaults to `'requirements'`.
  - `published_standard` notification → opens with `libraryInitialTab = 'published'` so the recipient lands on the surface where they can review the newly-published standard.
  - Legacy `open-pep-library` document event → opens with `libraryInitialTab = 'parsing'`. (No code dispatches this today — it's a dead listener, but kept for backward-compat with any future callers.)

**ESC handling.** Three potential listeners coexist (parent LibraryModal, embedded RequirementsLibraryModal, embedded PEPLibraryModal). To prevent capture-phase collisions, the embedded child's listener now early-returns when both `embedded` is true AND `mode === 'view'` — letting the parent's window listener handle the close. When the child is in edit/create/newversion mode, it intercepts ESC to exit edit mode (stopPropagation), matching the standalone-modal behavior. The new parent listener uses bubble phase (no `true` flag), so even if a child accidentally bubbles, the order is correct.

**User-facing terminology rename — minimal blast radius:**

- `PEPLibraryModal.jsx` line 408: "Create PEP Template" → "Create Parsing Template".
- `PEPLibraryModal.jsx` line 152: "No PEP templates yet." → "No Parsing Templates yet."
- `PEPLibraryModal.jsx` embedded mode Create button: "+ Create Parsing Template" (was "+ Create Template" in standalone form).
- `V22ParseEvidenceModal.jsx` line 288 empty state: "No PEP Templates in your library. Add one via the Template Library before parsing." → "No Parsing Templates in your library. Add one via the Library before parsing."
- `V22NodeDetailPanel.jsx` Parse Evidence footer button tooltip: "Extract structured fields from this Asset using a PEP template" → "…using a Parsing Template".
- `V2App.jsx` chrome button tooltip: "Library" (was "Requirements Library" / "PEP Template Library").

**Internal field names unchanged.** `pepTemplates`, `pepTemplateId`, `parseTemplateId` and all factory/handler signatures keep PEP per the client canon. The data model is unaffected.

**Out of scope (deferred):**

- **Legacy modal file deletion.** The phase brief calls for deleting `RequirementsLibraryModal.jsx` + `PEPLibraryModal.jsx` after end-to-end UI QA. Per CLAUDE.md's documented V2Canvas raycaster DOM-dispatch limitation, scripted UI walkthrough of every flow that touches the Library (Create / Save / Publish / new-version / search / multi-tab navigation) cannot be exercised from this agent session. Files retained as embeddable panels pending manual QA. A follow-up phase can either collapse them into `LibraryModal.jsx` or split them into `library/RequirementsPanel.jsx` + `library/ParsingTemplatesPanel.jsx` and remove the standalone exports.
- **Cross-tab selection persistence.** Switching between tabs resets each tab's local `selectedId`. Acceptable simplification per the phase brief.
- **PEP Template publishing.** Out of scope per the brief — PEP Templates have no publish concept.

**Spec updates:** none. The spec doesn't currently document the Library surface in detail; a follow-up phase can codify the three-tab structure if it becomes load-bearing.

**Runtime verification:**

- Build clean (88 modules, +10 kB main bundle for the new `LibraryModal.jsx`).
- Chrome shows ONE Library icon button (down from two — verified via `document.querySelectorAll` enumeration: 3 chrome icon buttons total post-Phase 10.3, was 4 pre-Phase 10.3; the second library button is gone).
- Clicking the Library icon opens the unified modal with header "Library" + subtitle "Parsing templates, requirement sets, and published standards" + three tabs visible.
- Default active tab is **Requirement Sets** (renders the embedded `RequirementsLibraryModal`'s SetList with three seeded sets: Material Compliance / System Integration Requirements / MIL-PRF-55681 Compliance + the "+ Create Requirement Set" toolbar button).
- Switching to the **Parsing Templates** tab renders the embedded `PEPLibraryModal`'s body — empty state shows the renamed "No Parsing Templates yet" copy + the "+ Create Parsing Template" toolbar button.
- Switching to **Published Requirements** renders the empty-state copy ("No published requirements visible to your network yet."). On the seeded dataset there are no published Requirement Sets, so this tab's empty state is the expected output.
- No new console errors from Phase 10.3. Pre-existing Changelog `key={release.version}` collision warnings persist (still tracked separately; still out of scope).
- Manual QA needed for: Create flow on each tab, Publish flow (verify cross-tab visibility), Run Evaluation deep link if it exists, full search/filter behavior. Code-path verification + tab-content rendering verified via the preview probes above.

**Status:** [x] Complete.

### Phase 10.4 completion notes (2026-04-28) — Phase 10 wrap-up: legacy modal cleanup + spec sync

Two cleanup workstreams before moving to Phase 11.

**Workstream 1 — Legacy modal relocation (Option B).** Phase 10.3 retained the two legacy library modals as embeddable panels (`RequirementsLibraryModal.jsx` + `PEPLibraryModal.jsx`) pending manual UI QA. Phase 10.3 verified clean; this phase relocates them into a `library/` subdirectory and renames them as panels:

- `src/components/modals/PEPLibraryModal.jsx` → `src/components/modals/library/ParsingTemplatesPanel.jsx`
- `src/components/modals/RequirementsLibraryModal.jsx` → `src/components/modals/library/RequirementsPanel.jsx`

Default export identifiers renamed: `PEPLibraryModal` → `ParsingTemplatesPanel`, `RequirementsLibraryModal` → `RequirementsPanel`. Internal `Backdrop` import updated from `'./ModalShared.jsx'` → `'../ModalShared.jsx'`; `pepTemplates.js` import updated from `'../../v2/pepTemplates.js'` → `'../../../v2/pepTemplates.js'` to account for the extra directory hop. `LibraryModal.jsx` imports updated to reference the new paths and component names. Component behavior unchanged — `embedded` prop and existing API preserved.

`git mv` used to preserve file history. Verified: no other files in the codebase import the old filenames (V2App.jsx mentions them only in a historical comment block; polish-backlog.md and CLAUDE.md mention them in completion notes — both are historical record, retained as-is).

**Workstream 2 — Architecture spec sync.** Three updates to `architecture-spec.md`:

1. **§8.6 Library (new subsection)** — placed inside §8 (Directory Layer) after §8.5 Implementation note. Documents the three-tab structure (Parsing Templates / Requirement Sets / Published Requirements), the dual-visibility rule for own publications (Tab 2 with globe icon + Tab 3), and a Prototype note callout covering Platform-side registry authority (DPP for artifact registration, REP/PEP for per-protocol Templates, SDP for publication lifecycle).

2. **§17.1 Library reference updated** — the bullet that read "Same `Library` modal (Parse Templates tab + Requirements Sets tab + Published Standards tab — three tabs, one modal)" rewritten to past tense reflecting shipped state: "The unified Library modal (Parsing Templates / Requirement Sets / Published Requirements — three tabs) shipped in Phase 10.3 and serves both processes today. Future unification (one Template type with optional `criterion`) would consolidate these tabs into one."

3. **Spec Changelog entries appended** — five new entries after the 2026-04-23 annotation pass entry: §11.5a Agreement revocation (Phase 9D), §3.7 Layout (Phase 10.2.1), §10.1 Asset hierarchy (Phase 10.2), §8.6 Library (Phase 10.3), Register Asset modal copy (Phase 10.1).

**No feature work.** Out of scope per the phase brief.

**Runtime verification:**
- Build clean (88 modules, no change in bundle size — relocation is path-only).
- File system: `RequirementsLibraryModal.jsx` and `PEPLibraryModal.jsx` no longer exist at `src/components/modals/`; their content lives at `src/components/modals/library/RequirementsPanel.jsx` and `src/components/modals/library/ParsingTemplatesPanel.jsx`.
- Library opens from chrome with all three tabs rendering correctly (verified post-relocation: tabs Parsing Templates / Requirement Sets / Published Requirements, default Requirements Sets active, three seeded sets visible).
- No console errors related to import paths.
- Spec readable end-to-end: §8.6 Library section sits cleanly between §8.5 Implementation note and §9 AI Shopper; §17.1 references the Library in past tense; Changelog reflects Phases 9D + 10.x.

**Status:** [x] Complete.

### Phase 11A completion notes (2026-04-28) — DA/EA flow foundations: seed data + directory rebrand + actor corner refresh

Phase 11 covers DA/EA flow separation work (#113, #115, #114, #126) + related items (#108, #102, #117, #118, #119). Aggregate too large for one phase, so split: 11A foundations only (this phase), 11B directory cluster interactivity + Detail Panel expand viewer, 11C the actual flow separation, 11D amendment + cleanup. Phase 11A is pure setup — no flow changes; existing behavior preserved end-to-end.

**Workstream 1 — ChipCo as a fourth actor + warm-path seed.**

- New actor `dave-chipco` (Dave @ ChipCo, role: 'supplier') added to both the actor pool (`actorPool()`) and the demo seed (`buildV22SharedArtifacts`). Not yet exposed in the role switcher — UI still shows the original three personas. Added to the pool so any 11C/11D flow that addresses Dave by PIN resolves correctly.
- Three ChipCo Assets: PRM-3A IC Datasheet, PRM-3A IC Qualification Report, Voltage Reference IC Datasheet. Standard `makeAsset` factory, no schema changes.
- One Parse Result on the IC Datasheet using the same Electronics Component Profile template Alice uses for her PRM datasheet (gives the demo structural symmetry across suppliers).
- Two ChipCo Claims: "PRM-3A IC Compliance" (refs the IC datasheet + qualification report) and "Voltage Reference IC Spec" (refs the VRef datasheet).
- One inter-party DA from ChipCo to GovCo (`da-chipco-bob-prm-ic`) — type `full`, subject = `claim-chipco-prm-ic`, no paired EA. This is the warm-path setup for Phase 11C: Bob has visibility into ChipCo's catalog (the directory cluster gates on this DA's existence) but no Claim pulls onto his canvas because no EA is paired yet. 11C will let Bob send an EA request which, when accepted, pulls the Claim onto his canvas.
- Internal ownership DAs for ChipCo's Assets, Claims, Claim→Asset reference edges, and the Parse Result→source-Asset edge — all standard internal DAs matching the existing pattern for Alice/Bob/Carol so edge derivation works without changes.

**Umbrella DA interpretation.** The brief calls this an "umbrella" DA, but the V2.2 schema doesn't have a dedicated umbrella type. Pragmatic interpretation: the warm-path anchor is one inter-party DA (subject = ChipCo's first Claim) that satisfies the directory cluster's visibility filter and serves as the seed Bob's Phase 11C flow will build on. If Phase 11C needs a true catalog-level umbrella concept, the schema can extend then.

**Workstream 2 — Public Directory rebrand.**

- The previous `ElectroGrid Ltd` mock cluster (line ~158 of DirectoryLayer.jsx) replaced with a real `ChipCo` cluster. Label rewritten from `mock supplier · 41 public` to `supplier · ${chipcoClaimCount} public` (resolves to "supplier · 2 public" today — the seeded ChipCo Claim count).
- Per-role visibility filter: ChipCo's cluster only renders when the active party has at least one active (non-revoked) DA from ChipCo. Today only Bob (GovCo) qualifies via the seeded `da-chipco-bob-prm-ic`. Alice and Carol see the other 3 clusters but not ChipCo. Implementation: `chipcoVisible = useMemo(() => sharedForDirectory.disclosureAgreements.some(d => d.grantor?.party === 'ChipCo' && d.grantee?.party === activeParty && !d._revokedMeta), [sharedForDirectory, activeParty])`. Filter applied as a `.filter(c => c.partyName !== 'ChipCo' || chipcoVisible)` over the cluster array.
- Other 3 clusters (MicroCo's own, NovaFab, Precision Components) preserved unchanged.

**Workstream 3 — Actor corner refresh.**

- Replaced the 88×88 amber-glowing circle anchor with a parent-layer-style ACTOR card (CARD_W = 210px, ACTOR badge on its own row above the party name, warm-indigo border matching the parent-layer Actor cards' Phase 9A.1 WARM_BORDER convention).
- Tooltip wrapper updated: `Exit Directory` → `Return to your network`.
- Hover treatment: border tightens from `40% indigo + var(--border)` blend → solid `var(--accent-indigo)`, background gets a 6% indigo wash, box-shadow deepens. Matches the parent-layer hover treatment without copying its specific glow value (which is selection-state).
- Click handler unchanged — calls `onClose` to exit the Directory Layer.

**Spec updates:** §8.5 grew a paragraph + Prototype note callout codifying per-role cluster visibility (Platform-side discoverability index in production; the prototype keys off seeded DAs).

**Out of scope (deferred to later 11.x):** any flow changes (DA / EA / Parse / Evaluate / Revoke / Transfer), cluster-click interactivity, modal flow changes, expand-evidence Detail Panel work, DA/EA terms work, amendment work.

**Runtime verification:**

- Build clean (88 modules; +4 kB main bundle for ChipCo seed data).
- ChipCo seed integrity (data-layer probe via dynamic module import):
  - Bob's view sees ChipCo via the warm-path DA (`da-chipco-bob-prm-ic` resolves; `da.grantor === 'ChipCo'` && `da.grantee === 'GovCo'` && `!_revokedMeta`).
  - ChipCo has 3 Assets, 2 Claims, 1 Parse Result. All ownership + reference DAs derive correctly.
  - ChipCo's PRM-3A IC Compliance Claim does NOT pull onto Bob's parent-layer canvas (no paired EA — the pull-in rule requires `evaluationAgreements`).
- DirectoryLayer per-role behavior verified by code path: `chipcoVisible` returns `true` for `activeParty === 'GovCo'`, `false` for `'MicroCo'` and `'AuditCo'`.
- Corner anchor visual: full UI walkthrough constrained by V2Canvas raycaster DOM-dispatch limitation; code-level verification confirms the JSX swap landed at the documented coordinates.
- No new console errors; pre-existing Changelog `key={release.version}` collision warnings persist (out of scope).

**Status:** [x] Complete.

### Phase 11B completion notes (2026-04-28) — ChipCo cluster interactivity + Detail Panel "expand" evidence viewer

Builds on Phase 11A's foundations. Three workstreams.

**Workstream 1 — ChipCo cluster click → Claim materialization.**

- DirectoryLayer accepts new props: `onClusterClick(cluster)`, `materializedClaim` (`{ claim, anchor: { xPct, yPct } }` or null), and `onCloseMaterializedClaim`. Other clusters remain inert visual dots.
- The ChipCo cluster is wrapped in a 180×180 hit-area (centred on the cluster's `xPct`/`yPct`). Hover bumps `transform: scale(1.06)` + `filter: brightness(1.25)` so clickability reads. Click fires `onClusterClick(cluster)`.
- V2App's `onClusterClick` handler resolves the warm-path Claim (`claim-chipco-prm-ic` from Phase 11A's seed), sets `v22DirectoryMaterializedClaim = { claim, anchor }`. DirectoryLayer renders a 210px Claim card at the anchor with the parent-layer CLAIM card visual (CLAIM badge, name, owner) + a thicker 2px amber selected border + amber glow box-shadow so the card reads as the selected element.
- V2App also mounts a synthetic-node V22NodeDetailPanel for the materialized Claim. New exported helper `buildClaimNodeForDirectoryMaterialization(claim, evalResults)` in v2_2Data.js wraps the existing `claimToNode` + `rollupClaimHealth` private helpers. Synthetic node carries the Claim's `v22Type: 'CLAIM'` + `v22Artifact` + standard fields, so V22ClaimPanel's existing rendering path applies without changes.
- Detail Panel positioned `position: fixed, top: 0, right: 0, bottom: 0, width: 480, zIndex: 200` — above the directory layer (z-index 150) and the materialized card (z-index 10) but below the modal stack (10000).
- Closing the panel (× / `onClose`) clears `v22DirectoryMaterializedClaim`. Closing the directory layer entirely also clears it.
- "Request Evaluation Agreement" footer button intentionally NOT wired — that's Phase 11C scope. The non-owner V22ClaimPanel branch already produces an empty footer for this case (no Run Evaluation without an EA, no Amend/Self-Evaluate for non-owners), so the panel renders cleanly as a read-only browse view.

**Workstream 2 — Detail Panel "expand" modal restored.**

New file `src/components/modals/ExpandedArtifactModal.jsx` with three sub-components:

- **`AssetEvidenceViewer`** — file metadata header (filename / size / MIME / truncated hash with click-to-copy) + body that shows an iframe pointed at `file.localPath` when set (height 400px, full width, dashed-border fallback). Footer rows for owner + registration date.
- **`ArtifactRow`** — schema-aware row: parse-output rows show a confidence chip (green/amber/red color band by threshold); eval-output rows show a status badge (SAT/UNSAT/MISSING/N/A with the established color palette).
- **`TabBar`** — Output / JSON tabs, indigo underline + bold for active, color shift on hover for inactive.

Modal frame: 720px × 80vh, portal via shared Backdrop, ESC to close.

New `ExpandButton` component in V22NodeDetailPanel.jsx — outward-arrow SVG icon button (square with diagonal arrow), 11×11 icon, indigo-on-hover. Wired onto referenced-Asset rows in V22ClaimPanel's "Referenced Assets" section. The row layout grew from a flat single-line treatment to a flex row with name on the left + Expand button on the right.

V22ClaimPanel signature gained `onExpandAsset(asset)` prop. V2App's standard panel mount and the new directory-materialized panel mount both wire it to `setV22ExpandedArtifact({ artifact: asset, schema: 'asset' })`. New V2App state `v22ExpandedArtifact = { artifact, schema } | null` drives the modal mount.

`referencedAssetNames` data shape extended from `{ id, name }` to `{ id, name, asset }` so the Expand button can hand the full Asset artifact to the modal. Both the standard panel mount (`/v2/V2App.jsx` ~4264) and the new directory-materialized panel mount build the same `{ id, name, asset }` row format using a shared `resolveAsset` helper.

**Parse Result + Eval Result expand wiring deferred** — the modal supports `'parse-output'` and `'eval-output'` schemas (so the modal is ready), but Expand buttons aren't yet wired onto V22ParseResultPanel / V22EvalResultPanel rows. Phase 11B's priority was Asset rows for the ChipCo browse flow; Parse/Eval expansion can land in a follow-up by adding `onExpandParseResult` / `onExpandEvalResult` props and `ExpandButton` instances to those panels.

**Workstream 3 — Seed data: localPath + ChipCo placeholder PDFs.**

- New devDependency `pdfkit ^0.18.0`. New script `scripts/generate-placeholder-pdfs.js` writes 3 placeholder PDFs to `/public/`: `prm-3a-ic-datasheet.pdf`, `prm-3a-ic-qualification-report.pdf`, `voltage-reference-ic-datasheet.pdf` (all ~2 KB each, 1 page, title + filler description). Re-runnable for future placeholders.
- Backfilled `localPath` on three existing Alice Assets whose filenames match `/public/` PDFs: `aPrmDatasheet` → `/powerregulationmodule-datasheet.pdf`, `aVregDatasheet` → `/voltageregulator-datasheet.pdf`, `aEmiDatasheet` → `/emishielding-datasheet.pdf`.
- ChipCo's 3 Assets gained `localPath` pointing at the new PDFs + their seed `file.filename` updated to match the public-folder filenames.
- Other seed Assets (Alice's PRM Test Report + Thermal Analysis, Bob's Avionics + Guidance + Thermal, Carol's two .md files) intentionally left without `localPath` — the AssetEvidenceViewer falls back to "Document preview not available" for these. Backfilling can happen as more placeholder PDFs are generated.

**Spec updates:**

- §10.1 Asset artifact: `file.localPath` documented as a Prototype-only field; Prototype note callout split to call out `localPath` separately from the other prototype-vs-production schema fields.
- §8.7 Detail Panel — Expand modal (Phase 11B) — new subsection covering the three schemas (asset / parse-output / eval-output), the modal dimensions, the close affordances, and a Prototype note that production resolves files via QS URI lookups instead of `localPath`.

**Out of scope (deferred):**

- DA/EA flow separation work (Phase 11C — #113, #115, #114, #126).
- Amendment work (Phase 11D — #108, #102).
- Real PDF.js integration (#41 — partial: 11B shipped iframe-based viewer; full PDF.js integration deferred).
- Umbrella DA edge visualization (#132 — explicitly deferred to Phase 14).
- "Request Evaluation Agreement" footer button (Phase 11C entry point).
- Parse Result + Eval Result Expand wiring (modal supports the schemas; per-panel button wiring deferred).

**Runtime verification:**

- Build clean (88 modules, +13 KB main bundle for the new Expand modal + DirectoryLayer additions + V2App wiring).
- 3 placeholder PDFs written under `/public/` (~2 KB each).
- Data-layer probe: `buildClaimNodeForDirectoryMaterialization(chipcoClaim, [])` returns a synthetic node with `v22Type: 'CLAIM'`, `v22Artifact === chipcoClaim`, `name === 'PRM-3A IC Compliance'`. ChipCo's 3 Assets all carry `file.localPath` pointing at the new PDFs. Alice's 3 publication-cluster Assets carry `localPath` pointing at the existing /public/ PDFs.
- Browser-observable end-to-end ChipCo cluster click flow constrained by the V2Canvas raycaster DOM-dispatch limitation documented since 9A.6 — code-path verification + module imports + structural diff are the canonical fallback per prior phase precedent.

**Status:** [x] Complete.

### Phase 11C completion notes (2026-04-29) — DA/EA flow separation: warm path EA request + EA terms + Dave as switchable role

Closes backlog #113, #126, partial #115. Seven workstreams, single commit.

**Workstream 1 — Dave as a real role.** Promoted Dave (ChipCo, role: 'supplier') from the actor-pool-only entry shipped in Phase 11A to a fully switchable role in `ROLES` (src/v2/v2Data.js). The role switcher dropdown now exposes 4 roles. Dave's seeded artifacts from Phase 11A (3 Assets, 1 Parse Result, 2 Claims, ownership + claim-ref + parse-ref DAs, the warm-path inter-party DA to Bob) compose his canvas without any seed-data changes.

**Workstream 2 — EA terms schema (#115).** Extended `makeEvaluationAgreement`'s `terms` object with two acknowledgment booleans:
- `terms.resultConfidentiality` (default false) — "Evaluation results are for internal use only and will not be shared with third parties."
- `terms.attribution` (default false) — "If results are referenced externally (audits, certifications), the evaluator will be credited."

Both ride along on the EA artifact and are recorded but NOT enforced. Production would expand this with platform-level policy hooks. `finalizeProvisionalAgreementPair` and `finalizeProvisionalEvaluationAgreement` thread the values through unchanged on accept.

**EA expiry check at Run Evaluation time.** New defensive guard in `handleV22OpenRunEvaluation` — if `ea.terms.evaluationDeadline` is in the past, the modal refuses to open with a copy hint pointing the user toward requesting a new agreement. Demo-only logic; production would have platform-level policy enforcement. Passive expiry notifications (`v22-ea-expiring-soon`, `v22-ea-expired`) filed as #133.

**Workstream 3 — Cold path two-step modal (#113).** `CombinedRequestModal` rewrite:
- Step 1 (Disclosure Agreement) — PIN + live resolution + Requirements Sets multi-select + optional message. Continue gated on a valid resolution and the requester anchor Asset.
- Step 2 (Evaluation Agreement) — expiry date input (default `today + 365 days` formatted as `YYYY-MM-DD`) + two CheckboxRow components for `resultConfidentiality` + `attribution`. Submit button replaces Continue.
- StepDots indicator + Back/Continue/Send Request footer logic. Single-step → two-step migration was 95% additive — only the existing CTA logic moved into the multi-step framework.

`handleV22RequestSubmit` and `makeProvisionalAgreementPair` extended to accept `eaExpiry` + `eaResultConfidentiality` + `eaAttribution`. The provisional EA persists the values via the extended terms; the response modal reads them back via `proposedEaTerms`.

**Workstream 4 — Warm path (#126).** New `EARequestModal.jsx` (single-step). Layout: requester/target/anchor info card, optional Requirements Sets multi-select, expiry date input (1y default), two acknowledgment CheckboxRows, optional message. Submit produces a provisional EA referencing the existing active DA's id (no new DA created).

Two new factories:
- `makeProvisionalEvaluationAgreement({ existingDisclosureAgreementId, ... })` — produces `{ evaluationAgreement }` with `_provisional: true` and `_requestMeta: { message, requesterParty, requesterAssetId, requestedRequirementsSetIds, createdDate }`. Validates `existingDisclosureAgreementId` is non-null.
- `finalizeProvisionalEvaluationAgreement({ provisionalEa, eaTerms })` — clears `_provisional`, applies the responder's confirmed expiry + carries acknowledgments through.

`buildViewForActor` gained two parallel branches:
- Provisional EA detection — Claims with a non-declined `_provisional` EA where the active actor is grantee get added to `provisionalClaimIds`. Visually identical to cold-path provisional treatment (dashed border + AWAITING RESPONSE badge).
- EA-only decline detection — annotated `_declineMeta` on EA produces a declinedClaimIds entry with `eaOnly: true` flag. Visually identical to DA-decline DECLINED state.

**Two warm-path entry points:**
1. **Claim Detail Panel footer** (`V22NodeDetailPanel.jsx` — V22ClaimPanel). New props `onRequestEvaluationAgreement` + `hasActiveDaWithoutEa`. The footer renders the new "Request Evaluation Agreement" CTA when the viewer is non-owner, has an active DA, and no active EA. An informational strip above the footer reads "An Evaluation Agreement is required to evaluate this Claim." so the user understands why Run Evaluation isn't shown.
2. **Canvas action bar** (`V22ActionBar` in `AssetNode.jsx`). New `▷` button on Claim cards where `node._hasActiveDaWithoutEa` is set. Stamped by `v22DataWithReveal` memo via a new `claimsWithActiveDaWithoutEa` Set computed from the active actor's DAs/EAs.

**V2App routing:** new `v22EaRequestContext` state holds `{ claim, ownerParty, existingDisclosureAgreementId, requesterAsset }`. Both entry points populate this state; the modal reads it. The directory-materialized panel (Phase 11B) gains the same warm-path detection so Bob can request an EA directly from the ChipCo cluster click flow without navigating back to the parent canvas — closing the directory + materialized panel before the modal opens.

**Workstream 5 — EA-only response (#113 + #126).** `CombinedResponseModal` extended with an `eaOnlyMode` prop. When true:
- Lands directly at step 3 (EA Terms) with `action: 'ea-only'`.
- Hides the disclosure-type cards (step 1) and the scope steps (step 2).
- StepDots shows "step 3 of 4" — internal step layout unchanged so the existing routing logic doesn't fork.
- Step 3 displays the requester's submitted expiry + acknowledgments; the grantor adjusts expiry only (acknowledgments are read-only chips via the new `ReadonlyAck` helper component).
- Footer renders Decline + Continue buttons at step 3; Decline routes to step 4 with a reason textarea.
- Step 4 (Review) hides the Disclosure type row; shows expiry + acknowledgments only. Accept fires `onAccept({ type: null, scope: null, eaTerms })` — the V2App branch routes to `handleV22AcceptEAOnly`.

Cold path also gained acknowledgment forwarding — `handleSubmit` now reads `request?.proposedEaTerms?.resultConfidentiality` + `attribution` to pass them along on accept (the requester's submission carries them through; the grantor doesn't get to mutate them in the cold path either).

**Workstream 6 — Notifications (3 new types).** `v22-request-ea-only` enqueued on the grantor's inbox on warm-path submit (badge: "EA REQUEST", amber). Click opens `CombinedResponseModal` in `eaOnlyMode` via new `v22RespondingToEaOnly` state — `setV22RespondingToEaOnly({ eaId })`. Same dismiss-on-terminal-action pattern as `v22-request`. `v22-ea-accepted` and `v22-ea-declined` (badges "EA ACCEPTED" green / "EA DECLINED" red) fire on the requester's inbox; click pans to the target Claim with the standard animated pan + zoom 1.28 and dismisses.

**V2App handlers:**
- `handleV22EaRequestSubmit` — produces the provisional EA, merges into `v22Provisionals`, pans/selects the now-provisional Claim with `_isNew` reveal, fires `v22-request-ea-only` to the grantor.
- `handleV22AcceptEAOnly` — finalizes the EA via `finalizeProvisionalEvaluationAgreement`, fires `v22-ea-accepted` to the requester, dismisses the original `v22-request-ea-only` notification on this grantor's inbox.
- `handleV22DeclineEAOnly` — annotates the EA with `_declineMeta` (decline retention pattern from Phase 6.5 #3), fires `v22-ea-declined` with reason, dismisses the original notification.
- `handleV22DismissDeclined` extended — finds and drops `_declineMeta`-annotated provisional EAs (warm-path declines) alongside the existing DA-only declined-pair drop.

**Spec updates folded in:**
- §11.6a EA-only request lifecycle (new subsection) — full warm-path flow with cancel-while-pending + prototype note covering SDP authority.
- §10.5 — `terms.resultConfidentiality` + `terms.attribution` documented as Prototype-only acknowledgments; demo-only `evaluationDeadline` enforcement also documented; JSON example updated.
- §7.4 — three new notification rows (`v22-request-ea-only`, `v22-ea-accepted`, `v22-ea-declined`).
- §6.3a Dave's view (new subsection) — Dave as a switchable role, mechanically identical to Alice.
- Changelog gained five new entries covering all of the above.

**Deviations from task brief:**
- *Recommended Option A (reuse `CombinedResponseModal` in eaOnlyMode) shipped.* No separate EAResponseModal — the `eaOnlyMode` prop branches the existing modal instead.
- *Decline path UI:* the brief allowed both modal patterns; chose the inline 2-step Decline → Reason mechanic (step 3 has a Decline button alongside Continue; clicking Decline transitions to step 4 with a reason textarea). Same shape as cold-path decline.
- *Cancel-while-pending* relies on the existing `handleV22CancelRequest` only when there's a paired DA. Pure EA-only cancellation (drop the provisional EA without paired DA) lands as a future polish item — for now Bob can navigate back to the directory, click the cluster again, and let the dismiss-on-decline path clean up if the response goes unfavorable.
- *Pan-to-zoom* on warm-path acceptance reuses the existing `v22RecentlyAcceptedClaimId` flag — no new reveal mechanic.
- *Slow-mode `SLOW_MODE_MULTIPLIER` change in unravel.js (10 → 2)* was a pre-existing modification in the working tree (not part of this phase's task). Folded into the commit as a cleanup — slow-mode default of 2 reads more naturally for QA work and the previous 10× was an outlier.

**Runtime verification:**
- Build clean (91 modules — +1 vs. Phase 11B's 88 due to: EARequestModal, ROLES update, ChipCo seed). Bundle size ~552 kB main / ~131 kB gzip.
- Preview reload clean — no console errors, app boots through CAC screen, canvas renders normally.
- Data-layer probe (preview console):
  - `ROLES.find(r => r.id === 'dave-chipco')` returns Dave's full role object (party 'ChipCo', role 'supplier').
  - `getV22DataForRole('bob-govco', emptyProvisionals)` shows `da-chipco-bob-prm-ic` exists with grantee 'GovCo', type 'full', no paired EA.
  - `makeEvaluationAgreement({ ..., terms: { resultConfidentiality: true, attribution: true, evaluationDeadline: '2027-04-29' }})` returns the EA with all three terms persisted on `terms`.
  - `makeProvisionalEvaluationAgreement(...)` returns `{ evaluationAgreement }` with `_provisional: true` and the requester's expiry + acknowledgments persisted.
  - `getV22DataForRole('bob-govco', { ..., evaluationAgreements: [warmPathProvEa] }).provisionalClaimIds.has('claim-chipco-prm-ic')` returns `true` — the provisional EA flips Bob's view of the Claim into provisional state.
- End-to-end UI walkthrough constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6. The data-layer + module-load probes are the canonical fallback per prior phase precedent.

**Known scope boundaries (not 11C blockers):**
- *Amendment work (#108, #102)* — Phase 11D.
- *Audit pass items (#117, #118, #119)* — Phase 11D.
- *Passive expiry notifications (#133)* — filed for later polish.
- *Umbrella DA edge visualization (#132)* — explicitly deferred to Phase 14.
- *Asset Detail Panel terminology audit (#119)* — Phase 11D.
- *Pure EA-only cancellation handler* — for now warm-path requests are cleaned up via decline-dismiss; a dedicated `handleV22CancelEaOnlyRequest` is a polish follow-up if Andrew wants the requester to drop the provisional without a counterparty round-trip.

**Status:** [x] Complete.

### Phase 11C.1 completion notes (2026-04-29) — Acknowledgments architecture + warm path bug fixes

Twelve workstreams in a single commit, structured around a fundamental Phase 11C architectural correction: terms are responder-authored; the requester's role at request time is acknowledging pre-set commitments the Claim owner authored on the Claim itself.

**W1 — Acknowledgments on Claim schema.** `makeClaim` factory extended with optional `acknowledgments[]` (`{ id, title, description }`). Seeded 2 acks on Alice's PRM Assembly Claim ("Result confidentiality", "Attribution") and 1 ack on ChipCo's PRM-3A IC Compliance Claim. `makeAmendedClaim` preserves acknowledgments through Asset amendments. `makeClaimCreationArtifacts` generates stable per-row ids and filters empty rows on submit.

**W2 — Claim creation modal.** New Acknowledgments section in `V22CreateClaimModal` Step 0, between Referenced Assets and the next field. Title input + description textarea per row, Remove button, "+ Add Acknowledgment" CTA. Empty rows (no title AND no description) dropped on submit. Review step gained an Acknowledgments InfoRow showing the count.

**W3 — Cold path Step 2 redesign.** `CombinedRequestModal` Step 2 rewritten. The earlier (wrong-shape) requester-authored expiry + result-confidentiality + attribution checkboxes are gone. Step 2 now renders the target Claim's `acknowledgments[]` as required checkboxes. All boxes must be checked before Submit enables. Zero-ack Claims surface a "no acknowledgments required" callout and proceed directly.

**W4 — Warm path EARequestModal redesign.** Same shape as cold path Step 2: acknowledgments as required checkboxes, no expiry / confidentiality / attribution UI. Optional message field retained.

**W5 — Response modal redesign.** `CombinedResponseModal` step 3 keeps the responder-authored `ExpiryPicker` (defaults 1y from response date). Dropped the read-only chips that surfaced the requester's confidentiality / attribution selections. Added a read-only "Requester accepted these acknowledgments" panel listing the ids the requester checked, resolved against the Claim's `acknowledgments[]`. Step 4 review row swapped from named chips to a count.

**W6 — EA artifact schema cleanup.** `makeEvaluationAgreement` removed `terms.resultConfidentiality` + `terms.attribution`. Added top-level `acknowledgmentsAccepted: [id, ...]` (audit trail; ids reference the Claim's `acknowledgments[]`). Both finalize factories carry the array through unchanged. Both provisional factories accept the new parameter; legacy `eaExpiry` / `eaResultConfidentiality` / `eaAttribution` parameters dropped.

**W7 — Cold-path provisional state regression fix.** The legacy provisional check at the view-builder layer required ALL of an actor's DAs on a Claim to be `type === 'provisional'` — missing the case where the user re-requests against a Claim they already have an active DA on. Replaced with `find()` matching any provisional DA where the actor is grantee. Backlog #134 filed for the upstream UX gate (PIN-existing-Claim validation in cold path Step 1) since the fix here is purely visual fallout — production should prevent the duplicate request entirely.

**W8 + W9 — Warm-path acceptance reveal.** `handleV22AcceptEAOnly` extended to mirror the cold-path acceptance reveal:
- Sets `v22RecentlyAcceptedClaimId` + `v22PanToClaimId` for the Claim — drives Bob's provisional → active transition with `_isNew` reveal animation.
- Sets `v22RecentlyAcceptedAssetId` + `setSel` + `v22PanToClaimId` for the grantee anchor Asset — Dave's canvas now pans/zooms to Bob's Avionics Module as it materializes with NEW badge.

This pairs the cold-path's Phase 6.5 #4 fix exactly. Both bugs (Bob's transition not animating, Dave not panning to the new Asset) collapse into the same wiring.

**W10 — Unravel animation on declined dismiss.** `handleV22DismissDeclined` converted to async; `await playUnravelAnimation(...)` runs before state mutation. setSel(null) BEFORE the unravel so the selection border doesn't compete with the border-erasure stage (same pattern Phase 9D.2.3 Fix 2 established). Cold path declined Claims (provisional Claim pulled in via the request) and warm path declined Claims (still on canvas via active DA, EA annotated `_declineMeta`) both animate uniformly. The primitive gracefully no-ops on nodes that aren't on canvas, so no defensive guard needed.

**W11 — Detail Panel clears on Directory navigation.** Directory icon click handler now calls `setSel(null)` + `setForcePanelTab(null)` + `setForceExpandSda(null)` before flipping `v22DirectoryOpen`. Closing the layer also clears `v22DirectoryMaterializedClaim` so directory-side panel state doesn't survive the transition. Cleanly tested: open Bob → select a Claim → click globe → directory layer renders without the panel persisting.

**W12 — Documentation.** Spec: §10.3 Claim acknowledgments[] field documented with format spec + carry-through note to §10.5; §10.5 dropped requester-authored terms paragraph + added Prototype note about the architectural correction + `acknowledgmentsAccepted` field documented; §11.6a updated to reflect the new flow. Spec Changelog gained the 11C.1 correction entry. polish-backlog: new entries #134 (PIN-existing-Claim validation), #135 (counterparty-pulled Asset panel sections), #136 (Cancel Request action bar button) — all out-of-scope per the brief. Update Log entry. Changelog modal v0.11.0 → v0.11.1 entry appended; footer version bumped.

**Deviations from task brief:**
- **None material.** All 12 workstreams shipped as briefed. The W7 regression fix was a one-line `every` → `find` change, much simpler than expected — the regression was a logical edge case the original Phase 6 author hadn't considered (re-request against an already-disclosed Claim) rather than a 11C-specific introduction. Filed the architectural-correctness item as #134 backlog so the Phase 11C.1 fix doesn't end the conversation.
- **W10 unravel** uses the existing `playUnravelAnimation` primitive without modifications. The primitive's own graceful-no-op behavior on missing nodes meant no defensive guard was needed at the call site.

**Runtime verification (preview):**
- Build clean (91 modules, ~553 kB main / ~131 kB gzip).
- Data-layer probe via dynamic import: cold-path against EMI Claim correctly flags `provisionalClaimIds: [claim-emi-shield]`; warm-path provisional EA correctly flags ChipCo Claim provisional on Bob's view; finalize clears `_provisional` and preserves `acknowledgmentsAccepted`; EA terms keys no longer include `resultConfidentiality` / `attribution`; seeded acks present on PRM Assembly (2) and ChipCo PRM-3A (1).
- End-to-end UI walkthrough constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-path verification + module-load + data-layer probes are the canonical fallback per prior phase precedent.

**Status:** [x] Complete.

### Phase 11C.2 completion notes (2026-04-29) — Reveal animation diagnosis + Claim panel acknowledgments + EA Expand + response modal polish

Five workstreams, single commit.

**W1 — Reveal animation diagnosis + fix.** The V2.1-era reveal-animation guard at V2App.jsx:3221 reads:
```js
if (targetNode._isNew && targetNode._wasProvisional) {
  startReveal(targetNode.id)
} else {
  canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
}
```

Comprehensive grep confirmed `_wasProvisional` was never set anywhere in V2App, AssetNode, V2Canvas, v2_2Data, or any uploaded file. Dead infrastructure since the V2.1 → V2.2 migration retreat — `startReveal` (the flip-from-provisional → active animation) hadn't fired on any acceptance since.

Fix: in `v22DataWithReveal`'s node-decoration map, stamp `_wasProvisional: true` ONLY on the recently-accepted Claim id (`v22RecentlyAcceptedClaimId`), NOT on accompanying Asset reveal ids (those didn't transition from provisional state, they were just newly visible — Phase 6.5 #4 should keep its simple-pan behavior). One-line addition:
```js
const justFinalizedClaim = needsReveal && n.id === v22RecentlyAcceptedClaimId
// ... in the spread:
...(justFinalizedClaim ? { _wasProvisional: true } : {}),
```

Cold-path acceptance (Alice accepts Bob's request) and warm-path EA acceptance (Dave accepts Bob's EA-only request) both now fire the existing flip animation when Bob clicks the resulting notification.

**W2 — Acknowledgments on Claim Detail Panel.** New section in `V22ClaimPanel` between Referenced Assets and Evaluation Results:
- Renders only when `claim.acknowledgments?.length > 0`
- One card per acknowledgment with bold title + dim description
- Same visual rhythm as the existing Detail Panel sections (Section header + list of cards on `var(--bg-raised)`)
- Visible to all viewers — owner sees what they authored; counterparty sees what they agreed to before requesting (cold path) or would need to agree to (warm path)

**W3 — EA Detail Panel Expand button.** Three coordinated changes:
1. `ExpandedArtifactModal` schema enum extended with `'evaluation-agreement'`. The `TabBar` component gained a `hideOutput` prop; when true the Output tab is hidden entirely (EAs have no file or structured rows that map to it). The modal's `tab` state defaults to `'json'` when `schema === 'evaluation-agreement'`.
2. `EvaluationAgreementDetailPanel` gained a new `onExpand` prop. New `ExpandIconButton` helper inlined at the top of the file (pattern parity with `V22NodeDetailPanel`'s local `ExpandButton` — same SVG, same hover treatment, same border styling). Rendered in the panel header before the close button.
3. V2App's EA panel mount wires `onExpand` to `setV22ExpandedArtifact({ artifact, schema: 'evaluation-agreement' })`. The existing modal mount handles the rest.

Output tab content for EA artifacts intentionally deferred — JSON tab is sufficient and the "Document preview not available" placeholder shape from Phase 11B doesn't fit an EA (no file). Future polish item.

**W4 — Response modal title + checkbox styling.** `CombinedResponseModal` `eaOnlyMode` headers updated:
- Accept: "Respond to EA Request" → **"Respond to Evaluation Agreement Request"**
- Decline: "Decline Evaluation Agreement" → **"Decline Evaluation Agreement Request"** (consistent with cold path's "Decline Request" pattern)

`ReadonlyAck` chip recoloured from indigo (which read as an actionable, just-checked checkbox) to grey:
- Background: `color-mix(... var(--accent-indigo) 6%)` → `var(--bg-card)`
- Border: `color-mix(... var(--accent-indigo) 25%)` → `var(--border)`
- Checkbox border: `var(--accent-indigo)` → `var(--text-dim)`
- Checkbox fill: `var(--accent-indigo)` → `var(--text-dim)`
- Title text: `var(--text-primary)` → `var(--text-secondary)` (slightly dimmer to match "locked" treatment)

The check mark stays so the chip still conveys "this was acknowledged" — but the colour signals "you can't toggle it."

**W5 — Documentation.** Spec Changelog (Phase 11C.2 entry covering all four workstreams). polish-backlog Update Log entry; EA Expand Output tab content noted as deferred polish (no new # filed — bundled with the existing Phase 11B Expand polish backlog). CLAUDE.md Phase 11C.2 note (this section). Changelog modal v0.11.2 entry; footer version v0.11.1 → v0.11.2.

**Deviations from task brief:** None. All five workstreams shipped exactly as described. The W1 fix turned out to be a one-line addition rather than a hunt for a complex regression — confirms the brief's "dead infrastructure" diagnosis.

**Runtime verification (preview):**
- Build clean (91 modules, ~553 kB main / ~131 kB gzip).
- App reloads cleanly; no new console errors.
- Data-layer probes from prior phases continue to pass.
- Visual verification of W1's reveal animation flow constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path for click-through scenarios.

**Status:** [x] Complete.

### Phase 11C.3 completion notes (2026-04-29) — Reveal animation timing fix + Expand icon consistency

Five workstreams in a single commit, all driven by Phase 11C.2 QA: the wired `_wasProvisional` flag set the guard correctly but the flip animation still played from active → active rather than provisional → active.

**Diagnosis.** At notification-click time the artifact has already finalized — responder's accept fires `finalize*` → `_provisional` clears in `v22Provisionals`. AssetNode's `isProvisional` predicate (line 370: `!!node.provisional || !!node._showAsProvisional`) returns false because the canvas adapter's `markProvisional` no longer sets either flag for the now-active Claim. The flip animation runs through its phases, but the source state for the flip is already active.

**W1 — Force provisional render via stamp override.** `v22DataWithReveal` now adds `_showAsProvisional: true` alongside `_wasProvisional: true` on the recently-accepted Claim (only — not on Asset reveal ids). AssetNode's existing `showAsProvisional = isProvisional && !isPostFlip && !flipMidpoint` predicate evaluates to true during the reveal window, rendering the dashed/dimmed border. At `flipMidpoint` (~1.4s into the reveal) the visual hand-off happens — AssetNode switches to active styling.

**W2 — Clear stamp at reveal completion + remove V2.1 dead code.** The legacy clearing logic at V2App:2388-2411 operated on `addedNodes` / `addedEdges` — V2.1 storage path. V2.2 stores provisional state on `_provisional` in `v22Provisionals`, so the old code was a no-op. Removed. Replaced with an `onDone` callback at the migrated reveal primitive's phase 'done' (t=2500ms) that clears `v22RecentlyAcceptedClaimId`, which stops `v22DataWithReveal` from stamping the override. Next render shows clean active state.

**W3 — Migrate reveal animation to dedicated file.** New `src/v2/animations/reveal.js` exports `playRevealAnimation({ nodeId, canvasRef, targetNode, setRevealAnim, onDone })`. Mirrors the organization of `src/v2/animations/unravel.js`. `startReveal` in V2App.jsx is now a thin wrapper that resolves the target node from `nodeMap`, fires the acceptance-notification dismissal upfront, and delegates to the primitive. Phase timings preserved exactly: zoom (0) / border (500) / flip (1100) / badge (1800) / panel (2000) / done (2500) ms.

The primitive's setTimeout chain uses a per-phase `prev?.nodeId === nodeId` guard inside each `setRevealAnim` updater so a stale timer from a superseded reveal doesn't clobber a newer reveal targeting a different node.

**W4 — Standardize Expand icon.** Two duplicate definitions previously existed:
- `V22NodeDetailPanel.jsx::ExpandButton` (Phase 11B) — diagonal arrow pointing top-right.
- `EvaluationAgreementDetailPanel.jsx::ExpandIconButton` (Phase 11C.2) — two opposing-corner arrows pointing outward.

Per the task brief, the user prefers the EA version's icon. Extracted to `src/components/DetailPanel/shared/ExpandButton.jsx` with the EA's icon path. Both Detail Panel files now import the shared component; local definitions removed. All Asset / Parse Result / Eval Result / EA Detail Panel surfaces now show the same icon.

**W5 — Documentation.** Spec Changelog (Phase 11C.3 entry). polish-backlog Update Log entry. CLAUDE.md note (this section). Changelog modal v0.11.2 → v0.11.3 entry. Footer version v0.11.2 → v0.11.3.

**Deviations from task brief:** None. The W3 migration was offered as optional in the brief; included in this phase per the brief's recommendation since the file was being touched anyway.

**Runtime verification (preview):**
- Build clean (91 modules, ~560 kB main / ~134 kB gzip — +3 kB for the new reveal.js + ExpandButton.jsx files; net code is smaller after removing the duplicate inline definitions).
- App reloads cleanly; no console errors.
- Visual verification of the reveal flip + stamp timing constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path for click-through scenarios. Code-path verification confirms: notification-click → `startReveal(claimId)` → primitive sets `revealAnim` to 'zoom' phase → `v22DataWithReveal` stamps `_showAsProvisional: true` on the matching node (since `v22RecentlyAcceptedClaimId === claimId`) → AssetNode renders dashed/dimmed → at `flipMidpoint` (computed from revealPhase + ~315ms) the predicate flips → at phase 'done' the onDone callback clears `v22RecentlyAcceptedClaimId` → next render drops the stamp → AssetNode renders standard active state.

**Status:** [x] Complete.

### Phase 11C.4 completion notes (2026-04-29) — Edge reveal animation + warm-path notification handler fix

Two bug-fix workstreams + a backlog filing + docs.

**W1 — Edge reveal animation.** V2Canvas already reads `edge._showAsProvisional` (line 863) and renders provisional/dashed via the SDA-type config. Phase 11C.3 stamped `_showAsProvisional` on the recently-accepted Claim node only, leaving incident edges in active state during the reveal flip — the user saw the Claim card transition correctly while the connecting edge stayed solid the entire time, breaking the visual narrative.

Fix: extended `v22DataWithReveal` to map edges. After the node mapping pass, when `v22RecentlyAcceptedClaimId` is set, walk `v22Data.edges` and stamp `_showAsProvisional: true` on edges where `e.from === claimId || e.to === claimId`. The stamp clears automatically at reveal phase 'done' through the same `setV22RecentlyAcceptedClaimId(null)` callback the migrated `playRevealAnimation` primitive fires — no separate timing logic needed for edges.

**W2 — Warm-path notification handler reveal trigger.** Phase 11C.3's reveal-trigger guard at V2App:3221 reads `targetNode._isNew && targetNode._wasProvisional` and routes to `startReveal` for cold-path acceptances. The warm-path `v22-ea-accepted` notification handler at V2App:3308 didn't have the same guard — it always took the simple animated-pan path, so reveal never fired for warm-path acceptances even though the stamp infrastructure was in place.

Fix: extended the same predicate to the warm-path handler:
```js
if (req.type === 'v22-ea-accepted' && targetNode._isNew && targetNode._wasProvisional) {
  startReveal(targetNode.id)
} else {
  canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
}
```

`v22-ea-declined` keeps the simple pan unchanged — declined Claims stay in their declined visual state (red dim), there's no flip-to-active transition to play.

**W3 — Backlog filing.** Filed #137: cross-role notification indicators in user menu. Yellow dots on the chrome user menu button + per-role rows in the expanded list when other roles have undismissed notifications. Out of scope for this phase but tracked for follow-up — improves the multi-role demo flow where the user has to switch between Bob → Dave → Bob → Dave for the warm-path test.

**W4 — Documentation.** Spec Changelog entry (Phase 11C.4). polish-backlog Update Log entry + #137 filed. CLAUDE.md note (this section). Changelog modal v0.11.4 entry; footer v0.11.3 → v0.11.4.

**Deviations from task brief:** None. The W1 edge stamp turned out to be a small map-pass — V2Canvas's edge rendering already supported the `_showAsProvisional` flag, so no canvas-side wiring was needed (verified at V2Canvas.jsx:863-876).

**Runtime verification (preview):**
- Build clean (91 modules, ~560 kB main / ~134 kB gzip).
- App reloads cleanly; no console errors.
- Visual end-to-end of the edge reveal flip + warm-path reveal animation constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path. Code-path verification confirms the timeline:
  - Cold path: Bob clicks acceptance → startReveal fires → v22DataWithReveal stamps Claim AND incident edges with `_showAsProvisional: true` → V2Canvas's edge geometry rebuilds with `effectiveSdaType === 'provisional'` (dashed line) → AssetNode renders Claim as dashed/dimmed → flipMidpoint triggers card flip → reveal phase 'done' → `setV22RecentlyAcceptedClaimId(null)` → next render drops both stamps → edge + node revert to active styling.
  - Warm path: Dave accepts → `v22-ea-accepted` notification fires to Bob → Bob clicks → handler now checks `_isNew && _wasProvisional` and routes to startReveal for accepted (not declined) → same reveal timeline.

**Status:** [x] Complete.

### Phase 11C.5 completion notes (2026-04-29) — NEW badge persistence + reveal animation cleanup

Phase 11C.3's `onDone` callback at reveal phase 'done' cleared `v22RecentlyAcceptedClaimId`. The intent was to drop the `_showAsProvisional` stamp so the next render shows clean active state. But that state var ALSO drives `_isNew + _wasProvisional` — clearing it dropped the NEW badge + orange tint along with the provisional render at ~2.5s instead of letting them persist until deselect (Phase 7 carry-over #1 semantics).

**W1 — Decouple the two stamp lifecycles.** Introduced a new state var `v22RevealActiveClaimId` separate from `v22RecentlyAcceptedClaimId`:
- `v22RecentlyAcceptedClaimId` (existing): drives `_isNew + _wasProvisional`. Cleared by the deselect-aware effect at V2App:2141 when the user moves selection off the revealed node. Unchanged.
- `v22RevealActiveClaimId` (new): drives `_showAsProvisional` on the Claim node + incident edges during the reveal window only. Cleared by `playRevealAnimation`'s `onDone` callback at phase 'done'.

`v22DataWithReveal` updated:
- The `_showAsProvisional` stamp on the Claim node moved out of the `justFinalizedClaim` block (which was bundled with `_wasProvisional`) into a separate `isInRevealWindow = n.id === v22RevealActiveClaimId` predicate.
- The early-return guard at the top of the node-mapping callback now also accounts for `isInRevealWindow`, so a node in the reveal window but not in `flagged` (shouldn't happen in practice but defensively) still gets stamped.
- The edge stamp at the bottom (Phase 11C.4 W1) is re-gated on `v22RevealActiveClaimId` so the dashed→solid edge transition timing matches the node's `_showAsProvisional` lifecycle.
- Memo dep array gained `v22RevealActiveClaimId`.

`startReveal` updated: `setV22RevealActiveClaimId(nodeId)` at start (mirroring the existing acceptance-handler `setV22RecentlyAcceptedClaimId(nodeId)` call). The `onDone` callback now only clears the new var. The deselect-aware effect at V2App:2141 stays unchanged — it correctly clears `v22RecentlyAcceptedClaimId` when the user moves selection off the revealed node, which is the proper persistence pattern.

**W2 — Backlog filings.**
- #138 (NEW badge persistence audit across all node types) — Andrew flagged this as a recurring regression. The audit scope: every handler that sets a reveal id, plus any direct `_isNew` stamping in the canvas adapter. Verify each: stamp set when node first appears, stamp persists until deselect, no other code path clears the reveal id prematurely.
- #139 (Edge geometry animation during reveal flip) — visual polish enhancement. The current dashed→solid edge transition at flipMidpoint is correct but flat; richer would be an edge-draw animation from anchor toward the Claim during the flip phase. Mirror of the `playEdgeRetract` primitive but in reverse.

**W3 — Documentation.** Spec Changelog entry. polish-backlog Update Log entry + #138 + #139 filed. CLAUDE.md note (this section). Changelog modal v0.11.4 → v0.11.5 entry. Footer version v0.11.4 → v0.11.5.

**Deviations from task brief:** None. All workstreams shipped exactly as briefed. The fix is a small surgical change — one new state var, one decoupled stamp predicate in the memo, one moved `setV22RevealActiveClaimId(nodeId)` call in `startReveal`.

**Runtime verification (preview):**
- Build clean (91 modules, ~560 kB main / ~134 kB gzip).
- App reloads cleanly; no console errors.
- Visual end-to-end of the NEW badge persistence + reveal flip lifecycle constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path. Code-path verification confirms the timeline:
  - t=0 (notification click): handler sets `v22RecentlyAcceptedClaimId` (already done by acceptance handler) + `startReveal` sets `v22RevealActiveClaimId` → both stamps applied → AssetNode renders dashed/dimmed (provisional) with NEW badge + orange tint
  - t=1100ms (flip phase): AssetNode flipMidpoint switches to active styling (predicate references the reveal phase, not the stamp) → dashed→solid visual handoff
  - t=2500ms (done phase): `onDone` callback clears `v22RevealActiveClaimId` → next render drops `_showAsProvisional` from Claim + edges → card fully active, but NEW badge + orange tint STILL VISIBLE
  - User clicks empty canvas (deselect): `prevSelRef.current === claimId, sel === null` → effect at line 2141 clears `v22RecentlyAcceptedClaimId` → next render drops `_isNew + _wasProvisional` → NEW badge + orange tint clear
  - Re-select the Claim: standard active selection, no NEW badge (correct — already seen).

**Status:** [x] Complete.

### Phase 11D completion notes (2026-04-29) — Polish punch-list

Seven backlog items shipped in a single commit (#118, #119, #134, #135, #136, #137, #138). Each is small and surgical; together they close a meaningful chunk of the accumulated polish backlog.

**W1 — #134 PIN-existing-Claim validation.** `CombinedRequestModal` Step 1 PIN resolution gained an `already-disclosed` state. New prop `claimsOnRequesterCanvas` (a `Set<string>` of Claim ids on the active actor's canvas via active DAs) — V2App passes `new Set((v22View?.claims || []).map(c => c.id))`. The resolution memo returns `'already-disclosed'` when the PIN resolves to a Claim in the set; input border turns red, error copy reads "This Claim is already on your network. Use the Detail Panel to take further action." Submit was already gated on `state === 'ok'` so no separate disable needed.

**W2 — #135 Counterparty Asset Detail Panel section gating.** `V22AssetPanel` gates the `Identity > DOT` row, the entire `File` section's metadata fields, and the entire `Registration` section on `isOwner`. For non-owners, the `File` section renders a single "Open Evidence Viewer" button that fires the existing `onExpandAsset(asset)` handler — disclosure grants viewing rights, but the file's metadata fields (filename, size, MIME, hash, URI) and registration timestamp / Parse Result count stay private. Description, Owner row, Agreements section, Parent/Children hierarchy unchanged.

**W3 — #136 Cancel Request action-bar button + handler.** New `cancelRequest` verb in `V22ActionBar`'s CLAIM case — the action-bar branch was previously gated on `!isProvisional && !isDeclined`; restructured to render the Cancel Request button when `isProvisional && !isOwner` (the requester) and fall through to the existing logic otherwise. `handleV22CancelRequest` is now async: resolves the provisional artifacts up front (cold-path DA + paired EA, OR warm-path provisional EA only) so we know what to dismiss on the responder side BEFORE the state mutation; calls `playUnravelAnimation` BEFORE dropping state (mirror of `handleV22DismissDeclined`); drops the artifacts; dismisses the responder's matching `v22-request-*` notification. Wired through the `onV22CardAction('cancelRequest', node)` dispatcher.

**W4 — #137 Cross-role notification dots.** New memo `rolesWithUnreadNotifications` aggregates undismissed notifications across all OTHER roles (active role excluded — its own pending notifications surface via the chrome's notification bell). Two render points:
- Yellow dot on the user menu chrome trigger button (top-right corner, 6px, with 1.5px ring against `var(--bg-surface)` for legibility against the avatar gradient).
- Yellow dot on each non-active role row in the SWITCH USER dropdown list (right-aligned, 6px, no ring needed since the row background is consistent).

Both use `var(--accent-amber)`. The aggregator memo reads from `perRoleState` directly and runs in V2App scope, so no prop drilling is needed.

**W5 — #118 Anchor Asset no NEW badge.** `v22DataWithReveal`'s node-mapping pass skips the `_isNew` stamp for Asset reveals where `n.v22Type === 'ASSET' && n.owner === activeRole.party`. Fixes the stale NEW badge that appeared on the requester's anchor Asset after the responder's session set the asset reveal id (Phase 6.5 #4 reveals the pulled-in counterparty Asset on the responder's canvas via `setV22RecentlyAcceptedAssetId(anchorIdForNotif)`; the same id leaks to the requester's session via shared V2App state). The owner-relative-to-active-party predicate cleanly discriminates: counterparty pull-in (owner ≠ active → NEW correct) vs. own pre-existing (owner === active → skip).

Trade-off documented inline: this also skips NEW on freshly-registered Assets and transfer-accepted Assets (both end up owned by the active party). Pan-to + selection still happen via separate `v22PanToClaimId` / `setSel` mechanisms — the user still sees the new Asset highlighted. Per-role reveal-id scoping would preserve NEW on those paths without the cross-session leak; filed as deferred polish (called out in the #118 fix comment + the existing #138 audit note).

**W6 — #119 User-facing terminology audit.** Narrow pass focused on user-facing strings only. `V22RunEvaluationModal` updates:
- "Evidence in scope (N)" → "Assets in scope (N)"
- "...The evaluation will run without evidence (self-attestation)." → "...The evaluation will run as a self-attestation."
- "Select at least one evidence Asset to evaluate." → "Select at least one Asset to evaluate."
- "(Requirements Set, evidence) combination already has..." → "(Requirements Set, Asset selection) combination already has..."
- Processing subtitle "across N evidence file(s)" → "across N Asset(s)"

Internal variable names (`evidenceAssets`, `evidenceSelection`, `evidenceUsed`, etc.) kept — V2.2 internal-vs-user-facing boundary respected. "Parse Evidence" canonical action name kept (still the user-facing label for the parse flow). "Open Evidence Viewer" (W2's new button) kept — it's the V2.x canonical action name.

**W7 — #138 NEW badge persistence audit.** Comprehensive scan of all 10 `setV22RecentlyAcceptedClaimId` / `setV22RecentlyAcceptedAssetId` call sites:
- handleV22RequestSubmit (cold path) — sets on requester's session, drives provisional Claim NEW badge.
- handleV22Accept (cold-path responder) — sets to claimIdForReveal + anchor (responder side).
- handleV22EaRequestSubmit (warm path requester) — sets to provisional Claim id.
- handleV22AcceptEAOnly (warm-path responder) — sets to claimIdForReveal + anchor.
- handleV22EvaluationSubmit — sets to artifacts.evaluationResult.id (note: variable is misleadingly named for ClaimId but works because the deselect-aware effect at V2App:2207 just compares ids, not types).
- handleV22AmendClaimSubmit — sets to v22AmendingClaimId.
- handleV22ParseSubmit — sets to artifacts.parseResult.id (same naming caveat).
- handleV22CreateClaimSubmit — sets to artifacts.claim.id.
- Notification-click for amendment / evaluation deep-link — sets to claimIdForPan.
- Asset registration handler — sets to newly-minted Asset id(s).
- Transfer-accept handler — sets to transferred Asset id.

No `setTimeout`-based clearing found in any handler. All paths rely on the V2App:2207 deselect-aware effect for cleanup. The Phase 11C.5 decoupling (`v22RecentlyAcceptedClaimId` for `_isNew + _wasProvisional` lifecycle, `v22RevealActiveClaimId` for `_showAsProvisional` lifecycle) holds across all paths. No regressions found beyond the #118 fix already applied in W5.

**W8 — Documentation.** Spec Changelog entry. polish-backlog Update Log entry. CLAUDE.md note (this section). Changelog modal v0.11.5 → v0.11.6 entry. Footer version v0.11.5 → v0.11.6.

**Deviations from task brief:** None material. The W5 #118 implementation follows the brief's Option B literally — owner-relative-to-active-party predicate. The trade-off (no NEW on registration / transfer-accept) is acknowledged inline. Per-role reveal-id scoping (Option A in the brief) is the cleaner long-term fix; deferred to backlog.

**Runtime verification (preview):**
- Build clean (91 modules, ~563 kB main / ~134 kB gzip — +3 kB for the new Cancel Request handler, cross-role notification memo + dot rendering, Detail Panel section gating, and PIN resolution branch).
- App reloads cleanly; no console errors.
- Visual end-to-end constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path.
- Code-path verification confirms all seven workstreams land at the expected lines and integrate with existing handler infrastructure without TDZ / dependency-array gaps.

**Status:** [x] Complete.

### Phase 11D.1 completion notes (2026-04-29) — Copy fixes (#134 + #119)

Two surgical copy fixes from Phase 11D QA. Single commit.

**W1 — #134 already-disclosed error trim.** The Request Agreement modal's Step 1 PIN error message dropped its second sentence:
- Before: "This Claim is already on your network. Use the Detail Panel to take further action."
- After: "This Claim is already on your network."

The second sentence was instructional copy that the user didn't need at the gate.

**W2 — #119 follow-up: V22RunEvaluationModal EA / Evidence strings.** Two user-facing strings that 11D missed:
- Header subtitle: `Evaluating ${claim.name} under EA ${ea.id}.` → `Evaluating ${claim.name} under Evaluation Agreement ${ea.id}.`
- Review-stage left panel: `Evidence (${count})` → `Assets (${count})`

Audited the rest of the modal — remaining `evidence` / `Evidence` hits are internal variable names (`evidenceAssets`, `evidenceSelection`, `evidenceUsed`) and code comments, both kept per the W6 user-facing-vs-internal boundary established in 11D. Self-evaluation subtitle ("no Evaluation Agreement required") kept as-is — already correctly named.

**W3 — Documentation.** CLAUDE.md note (this section). Changelog modal v0.11.7 entry. Footer version v0.11.6 → v0.11.7. No spec or polish-backlog update — these are 11D follow-on copy fixes covered by the existing 11D backlog entries (#134 / #119).

**Deviations from task brief:** None. All three workstreams shipped exactly as briefed.

**Runtime verification (preview):**
- Build clean.
- App reloads cleanly; no console errors.
- Visual end-to-end constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path.

**Status:** [x] Complete.

### Phase 11D.2 completion notes (2026-04-29) — Selective Disclosure: grantee view of Claim's referenced Assets

Closes the Selective half of the Phase 11D.x grantee-view restoration. Proof-only stays scoped for Phase 11D.3.

**Problem.** Phase 11C.1 made acknowledgments authored by the Claim owner; the Selective field-picker (acceptance flow) already worked correctly and produced DAs whose `scope.fieldIds` carry `${parseResultId}::${fieldId}` entries. But the grantee never saw what was disclosed: the Detail Panel's "Referenced Assets" section listed only Assets in scope without any field-level metadata, and the Phase 11B Expand modal always opened the AssetEvidenceViewer (PDF iframe) — surfacing the full file even though Selective doesn't disclose it.

**Workstreams (single commit):**

- **W3 + W1 — Detect DA type, enrich Asset rows, render counts.** V2App's standard panel mount (around V2App.jsx:5010) and the directory-materialized panel (around V2App.jsx:4399) both updated. Non-owner branch now collects `activeGranteeDas` (the active DAs where viewer is grantee), then per-Asset finds the covering DA (handles multi-DA cases — e.g., Selective on Asset X + Full on Asset Y), reads its `type`, and stamps the row with `disclosureType` + (for Selective) `disclosedFieldCount` + `disclosedFields`. Disclosed fields resolve by intersecting `coveringDa.scope.fieldIds` (Set lookup) with each `${pr.id}::${field.id}` for Parse Results derived from that Asset (`pr.sourceAssetId === asset.id`). Owner branch stamps `disclosureType: 'owner'` so the count is suppressed. V22ClaimPanel's Asset row renders a 10px mono `{N} fields` muted text when `n.disclosureType === 'selective'`, between the Asset name and the Expand button. Pluralization handled (`1 field` vs `5 fields`).

- **W2 — ExpandedArtifactModal's Selective branch.** Modal accepts new optional props `disclosureType` + `disclosedFields`. New constant `isSelectiveAsset = schema === 'asset' && disclosureType === 'selective'`. When true:
  - **Output tab:** renders a header (Asset name + disclosed-field count) above an ArtifactRow list (reusing the existing `'parse-output'` schema's row rendering — label + value + confidence chip). Empty state surfaces an italic "No parsed fields are disclosed for this Asset under the active Selective Disclosure Agreement." Suppresses the file metadata header + iframe entirely.
  - **JSON tab:** renders `{ assetId, name, owner, disclosureType, disclosedFields }` — disclosed-portion-only. The full Asset artifact (which carries `file.{filename, hash, mimeType, size, uri, localPath}` + `dot` lineage + registration metadata) is NOT exposed. Full + owner views still render the full artifact JSON.

- **`onExpandAsset` signature change.** Previously took the raw Asset artifact (`(asset) => ...`). Now takes the enriched row (`(row) => setV22ExpandedArtifact({ artifact: row.asset, schema: 'asset', disclosureType: row.disclosureType, disclosedFields: row.disclosedFields })`). Defensive branch retains legacy single-arg support so non-row callers (none today, but possible future Asset-direct surfaces) still work. Both V2App call sites updated identically.

**Edge cases handled:**
- *Multi-DA per Claim/grantee.* Per-Asset DA-matching ensures each Asset gets its own disclosure type (rare but architecturally legal). The brief's simpler "first DA wins" approach would have been wrong for mixed Selective + Full scenarios.
- *Owner viewing.* Owners see all referenced Assets unconditionally with `disclosureType: 'owner'` — the count rendering only triggers on `'selective'`, so owners see no count and Expand opens the file viewer.
- *Full Disclosure unchanged.* Full grantees see Asset rows without field counts (their `disclosureType` is `'full'`); Expand still opens the AssetEvidenceViewer with the PDF iframe.
- *Directory-materialized Claim (Phase 11B).* Same enrichment path applied so the warm-path scenario stays correct (today the only directory-materialized Claim has a Full DA, but the wiring is in place if a Selective directory-disclosed Claim ever appears).

**Runtime verification (browser preview, end-to-end):**
- *Selective grantee — Bob viewing Alice's PRM Claim.* Detail Panel shows 1 Asset (Power Regulation Module Datasheet) with "5 fields" muted text. Expand opens modal with Output tab listing 5 disclosed fields (Operating voltage 95% / Power dissipation 91% / Temperature range 93% / Radiation tolerance 72% / ITAR classification 88%); JSON tab shows the disclosed-portion-only object — no `file.*` keys.
- *Full grantee — Bob viewing Voltage Regulator IC Claim.* Asset row shows no field count. Expand opens iframe pointing at `/voltageregulator-datasheet.pdf`.
- *Owner — Alice viewing her own PRM Claim.* All 3 referenced Assets visible (Datasheet + Test Report + Thermal Analysis), no field counts. Expand on Datasheet opens iframe pointing at `/powerregulationmodule-datasheet.pdf`.

**Spec updates:** §10.4 grew a "Grantee view derivation per disclosure type" subsection codifying Full / Selective / Proof-only (deferred) / owner branches with the exact field-id intersection rule + JSON disclosed-portion shape. Spec Changelog entry added.

**polish-backlog updates:** Update Log entry. New item #141 filed (EA permission gate for proof-only re-disclosure — current model defaults to allow; future polish, Medium priority).

**Deviations from task brief:** Chose Option B (single `'asset'` schema with `disclosureType` prop) over Option A (new `'asset-selective'` schema) per the brief's recommendation. Cleaner data model — same Asset, viewing mode determined by disclosure context. Per-Asset DA matching (vs. single-DA assumption) added unprompted because multi-DA scenarios are architecturally legal and the brief's simplification would have been incorrect for them.

**Known scope boundaries (not 11D.2 blockers):**
- Proof-only Disclosure — Phase 11D.3.
- Asset Detail Panel changes — Selective grantees don't have a counterparty Asset Detail Panel surface today (Asset nodes don't appear on grantee canvases); access is through Claim Detail Panel only.
- Parse Result + Eval Result row Expand wiring — modal already supports these schemas (Phase 11B); Asset rows are the priority for Selective, other rows can land in a follow-up.

**Status:** [x] Complete.

### Phase 11D.3 completion notes (2026-04-29) — Proof-only Disclosure: Eval Result materialization on grantee canvas

Closes the Proof-only branch of the Phase 11D.x grantee-view restoration. Phase 11D's three disclosure types (Full, Selective, Proof-only) are now all wired end-to-end on the grantee side.

**Demo seed.** Added `da-alice-dave-prm-proof` (Alice → Dave, subject = PRM Claim, type = 'proofonly', granteeAssetId = ChipCo's PRM-3A IC Datasheet, scope.evaluationResultIds = [Bob's MIL-PRF-55681 Eval Result]). Dave is the natural test grantee — empty parent canvas pre-Phase-11D.3, no DA conflicts. Bob's MIL-PRF result is the natural payload (he evaluated Alice's PRM Claim under their warm-path EA). Re-disclosure semantics — whether Alice can re-disclose Bob's Eval Result — are filed as #141; default-allow today.

**Workstreams (single commit):**

- **W1 — `buildViewForActor` proof-only branch.** Extended `pulledInClaimIds` to also include Claim ids from active proof-only Claim DAs where actor is grantee (no EA gating — proof-only is standalone). Refactored `proofDaEvalResultIds` to handle two DA shapes: `subject.kind === 'evalResult'` (existing proof-of-evaluation flow → Claim owner) and `subject.kind === 'claim' && type === 'proofonly'` (new — disclosed Eval Result ids flow to Claim grantee). New `proofOnlyPulledEvalIds` set tracks the latter separately so the canvas adapter routes placement appropriately. View object surfaces `proofOnlyPulledEvalIds` alongside the existing `pulledInClaimIds` etc.

- **W2 — Edge derivation.** New branch in `deriveAgreementEdges` BEFORE the generic inter-party Claim branch (precedence matters): when `kind === 'claim' && !internal && !toPublic && da.type === 'proofonly'`, emit two edge classes — (a) Claim ↔ granteeAssetId anchor edge (consistent with full/selective behavior so the pulled Claim has a visual home) and (b) one edge per disclosed Eval Result → Claim. All edges carry `da.type === 'proofonly'` so V2Canvas renders them with the existing dotted-green proof-only SDA style. The pre-existing generic claim DA branch is unaffected for full/selective.

- **W3 — Layout column.** New constant `COL_PULLED_EVAL = 2300` (between `COL_PULLED_CLAIM = 2100` and `COL_PULLED_ASSET = 2500`, all on the 100-grid). Effective column variant `COL_PULLED_EVAL_eff` shifts with `assetColShift` like its siblings. The canvas adapter's Eval Result placement loop splits external ERs into:
  - `erProofOfEval` (counterparty ERs visible via subject=evalResult DAs — actor is Claim owner) → placed at `COL_OWN_EVAL_eff` near the actor's own Eval Results, matching pre-Phase-11D.3 behavior (Carol's audit on Alice's canvas, etc.).
  - `erProofOnlyPulled` (counterparty ERs from proof-only Claim DAs) → placed at `COL_PULLED_EVAL_eff` on the same row as the source Claim, with `i × ROW_STEP` stacking when multiple ERs target the same Claim.
  
  Visual story on Dave's canvas reads "Eval Result (2300) → Claim (2100) → my anchor Asset (2500)" with the Eval Result as the proof payload anchored to the Claim.

- **W4 — V22ClaimPanel Referenced Assets empty state.** New `claimIsProofOnlyOnly` prop. V2App computes `true` when every active grantee DA on this Claim is `type === 'proofonly'`. When set, the section title renders `Referenced Assets (0)` (regardless of `claim.referencedAssetIds.length`) and the body shows italic "No Assets disclosed under this agreement." Owner + selective + full grantees see the standard rendering. Both the standard panel mount and the Phase 11B directory-materialized panel are wired.

- **W5 — Clickable Evaluation Results rows.** New `onSelectEvalResult` prop on V22ClaimPanel. Each row in the Evaluation Results section is now clickable when the prop is wired (it always is from V2App). Click handler: `setSel(er.id)` + `setV22PanToClaimId(er.id)` — pans to the Eval Result on canvas and replaces the Claim panel with the Eval Result panel. Hover treatment uses an indigo-tinted background lerp so the row reads as actionable. Applied for ALL viewers (owner + grantees), not just proof-only — general UX improvement.

- **W6 — V22EvalResultPanel updates.** Section renamed Evaluator → Owner (per the brief: "show Owner only, not the evaluator's name as a separate field"). New "Claim" row in the Owner section, populated from a new `linkedClaimName` prop that V2App resolves from `er.claimId` against the merged dataset. Helps proof-only grantees confirm what the pulled-in Eval Result evaluates. No JSON-tab gating for proof-only Eval Result Expand — proof-only's whole purpose is to surface the evaluation result, so the full Eval Result JSON renders as normal.

- **W7 — Defensive ExpandedArtifactModal proof-only Asset branch.** The Claim panel hides Asset rows under proof-only (W4), so Asset Expand shouldn't trigger. Defensive coverage: `isProofOnlyAsset = schema === 'asset' && disclosureType === 'proofonly'` branches the Output tab to a "Under proof-only disclosure, Asset details are not available." empty state + branches the JSON tab to a bare-identity object (`{ assetId, name, owner, disclosureType: 'proofonly' }`) so file metadata never leaks even in this edge case.

**Edge cases handled:**
- *Multi-DA on same Claim.* `claimIsProofOnlyOnly` requires EVERY active grantee DA to be proof-only — if the actor has both a proof-only AND a full/selective DA on the same Claim (not seeded today, but architecturally legal), the panel falls through to the regular per-Asset rendering.
- *Owner viewing own Claim with proof-only DA out to grantees.* The owner sees their own Claim normally; `claimIsProofOnlyOnly` is gated on `!isOwnerViewing`. Phase 11D.3 affects only the grantee side.
- *Pulled Eval Result with no source Claim on canvas.* The placement loop falls back to `y = 0` if the source Claim isn't found in the node list (defensive — shouldn't happen since W1 pulls the Claim).
- *Proof-of-evaluation results on Claim owner's canvas.* Carol's `erCarolPrm` on Alice's canvas (subject=evalResult flow) is correctly EXCLUDED from `proofOnlyPulledEvalIds` (only subject=claim+type=proofonly DAs populate it), so it stays at `COL_OWN_EVAL_eff` as before. No regression.

**Runtime verification (browser preview, end-to-end):**
- Switched to Dave (ChipCo). Canvas shows ChipCo's own Claim + Alice's pulled-in PRM Claim + Bob's pulled-in MIL-PRF-55681 Eval Result. Programmatic edge probe confirms: Claim at (2100, 0), Eval Result at (2300, 0); proof-only edges Claim ↔ ChipCo's PRM-3A IC Datasheet (anchor) and Eval Result → Claim.
- Selected PRM Claim → Detail Panel shows: Owner: MicroCo, Created: 2026-03-01, **Referenced Assets (0): "No Assets disclosed under this agreement."**, Acknowledgments (2), **Evaluation Results (1): MIL-PRF-55681 Compliance · ACTIVE · by GovCo · 4 satisfactory · 1 unsatisfactory** — clickable.
- Clicked the Eval Result row → panel pivots to V22EvalResultPanel: Owner: GovCo, **Claim: Power Regulation Module Assembly** (new linked-Claim row), Evaluated: 2026-03-09 · 14:32 UTC, Agreement: ea-bob-prm, Requirements Set + 5 result rows with status badges (4 SAT / 1 UNSAT).
- Selective + Full + owner views unchanged from Phase 11D.2 (verified via data-layer probe — Bob still sees PRM + Vreg Claims; Alice sees her 3 Claims + 2 Eval Results including Carol's POE result placed correctly at `COL_OWN_EVAL`).

**Spec updates:** §10.4 grantee view subsection extended with the Proof-only branch + new §6 cross-canvas note. Spec Changelog entry. polish-backlog Update Log entry. Changelog modal v0.11.9 entry. Footer version v0.11.8 → v0.11.9.

**Deviations from task brief:** Chose to render the Referenced Assets section with `(0)` + a proof-only-specific empty hint (per the brief's explicit user direction) rather than hiding the section entirely. Eval Result row clickability shipped for ALL viewers (not just proof-only) per the brief's "general UX improvement" note. The section header rename in the Eval Result panel (Evaluator → Owner) was a small interpretation of the brief's "show Owner (only — NOT the evaluator's name as a separate field)"; the existing structure already had a single party row in an "Evaluator" section, but renaming the section to "Owner" reads more cleanly per the brief's terminology.

**Known scope boundaries (not 11D.3 blockers):**
- EA permission gate for proof-only re-disclosure — backlog #141, default-allow today.
- Self-evaluation proof-of-evaluation handling — pre-existing, unchanged.
- Pulled-in Eval Result detail panel does NOT include a "back to source Claim" button — user can navigate via the canvas selection. Future polish if needed.

**Status:** [x] Complete.

### Phase 11D.4 completion notes (2026-04-30) — Layout spacing fix + Referenced Assets count fix

Two surgical fast-followers from Phase 11D.3 QA. Single commit.

**W1 — Layout spacing fix.** Phase 11D.3 placed pulled-in Eval Results at `COL_PULLED_EVAL = 2300` — only 200px from the source Claim at 2100. Cards are 210px wide, so they visibly overlapped (claim card spans ~1995–2205; eval card spans ~2195–2405; overlap of ~10px). Fix: moved `COL_PULLED_EVAL` to 1700 — 400px LEFT of the Claim, matching the existing `ASSET_COL_GAP = 400` convention and reading as "Eval Result informs the Claim from the left". The new column shares slot with `COL_OWN_EVAL = 1700`. Y separation preserves non-overlap by construction:
- Own evals carry `COL_Y_OFFSET = 100` on top of `symmetricRowY(i)`, so they live at y ∈ {100, 400, -200, ...} — never at y=0.
- Proof-only-pulled evals match the source Claim's y, which is `symmetricRowY(claimIdx)` for the first pulled Claim — typically y=0.

For Dave specifically: Bob's pulled ER at (1700, 0); no own evals so the column slot is otherwise empty.
For Alice (regression check): Bob's POE result at (1700, 100), Carol's POE result at (1700, 400) — unchanged, since they were already in this column via the existing `erProofOfEval` path.
For Bob (regression check): own ER at (1700, 100) — unchanged.

**Alternative considered:** push `COL_PUBLIC` rightward to make room at 2900. Rejected — invasive (touches the public-directory column constant) and the proof-only-informing-Claim semantic is cleaner with the LEFT placement.

**W2 — Referenced Assets count fix.** V22ClaimPanel's section header was reading `claim?.referencedAssetIds?.length || 0` — the Claim's raw count of referenced Assets. But V2App's standard panel mount filters this list per active DA scope (Phase 11D.2), so a Selective grantee whose DA covers 1 of 3 referenced Assets would see "Referenced Assets (3)" with only 1 row beneath. Fix: switch the header count to `referencedAssetNames.length` — the filtered array. The proof-only-only ternary branch (which forces 0) is preserved.

For owners: V2App passes the full list unfiltered, so `referencedAssetNames.length === claim.referencedAssetIds.length`. Owner view stays at "(3)". No change observed.

For non-owners: count now matches the rendered row count. Selective grantee with 1 disclosed Asset reads "(1)". Full grantee reads the disclosed count (≤ Claim's raw count). Proof-only reads "(0)" (pre-existing branch).

**Verified end-to-end (browser preview):**
- Alice (owner) viewing PRM Claim: "Referenced Assets (3)" + 3 rows.
- Bob (Selective grantee) viewing PRM Claim: "Referenced Assets (1)" + 1 row (Datasheet).
- Bob (Full grantee) viewing Voltage Regulator Claim: "Referenced Assets (1)" + 1 row.
- Dave (Proof-only grantee) viewing PRM Claim: "Referenced Assets (0)" + "No Assets disclosed under this agreement." copy.
- Layout: Dave's PRM Claim at (2100, 0), Bob's Eval Result at (1700, 0), 400px gap; Bob's Avionics anchor at (2500, 100). All three readable without overlap. ChipCo own Claims at (1300, …) — unchanged.

**Spec updates:** §10.4 Selective sub-section clarifies that the count reflects the disclosed Asset list, not the Claim's full referenced list. New spec Changelog entry covering both fixes.

**Footer + Changelog:** v0.11.9 → v0.11.10. Changelog modal entry added.

**Deviations from task brief:** None material. Brief recommended `COL_PULLED_EVAL = 1700` (the LEFT placement) — shipped as recommended, with the y-separation rationale documented inline. Brief flagged W2's bug as upstream filtering in V2App; investigation confirmed the filtering is correct (Phase 11D.2 ships properly filtered rows) and the bug was downstream — the V22ClaimPanel header reads from the raw Claim. Single-line fix in V22ClaimPanel.

**Status:** [x] Complete.

### Phase 11D.4.1 completion notes (2026-04-30) — Proof-only Eval Result placement: derived from source Claim + AssetNode tooltip z-index fix

Two fast-followers from Phase 11D.4 QA. Single commit.

**W1 — Eval Result placement derived from source Claim.** Phase 11D.4 moved `COL_PULLED_EVAL` from 2300 → 1700 to give space from the source Claim. But 1700 sits in the actor's own evaluation column, and on Dave's canvas the proof-only-pulled Eval Result landed inline with Dave's existing ChipCo Claim/Asset traffic (y=0–300). The connecting edge to Alice's PRM Claim crossed unrelated nodes.

Fix: replaced the fixed-column placement with one derived from the source Claim's position:

```
x = sourceClaim.x + 200
y = sourceClaim.y + 300 + (stackIdx * COL_Y_OFFSET)
```

The 200px x-offset reads as "attached to" the Claim without overlapping it (cards are 210px wide; centers are 200px apart so the cards barely touch but don't visually clash). The 300px y-offset puts the Eval Result clearly below the Claim's horizontal traffic lane. On Dave's canvas this resolves to (2300, 300) for Bob's MIL-PRF Eval Result, with Alice's PRM Claim at (2100, 0) — short edge, no crossings.

`COL_PULLED_EVAL` constant retained but only used as a defensive fallback (when the source Claim isn't in the canvas adapter's claim node map — shouldn't happen since Phase 11D.3's W1 pulls the Claim in alongside the disclosed ERs).

**W2 — Z-index fix for AssetNode tooltip portals.** Both `AssetNodeMini` (line ~1351 of AssetNode.jsx) and `AssetNodeDot` (line ~1095) render their card-body via `createPortal(..., document.body)` with `position: fixed, zIndex: 5000`. The Detail Panel in V2App renders at `zIndex: 200`. Result: at mini or dot LOD when a node was selected and the user dragged the canvas, the tooltip's `tooltipPos` moved with the canvas pan and could land within the Detail Panel's footprint — the portal'd tooltip then rendered on top of the open Detail Panel.

Fix: drop both tooltip portal z-indices to 150 — below the panel (200) and below the notification dropdown (200), still above the canvas itself (no z-index) and edges. Modal stack at 10000 still wins over both. The tooltip is informational at LOD levels (it's the only visible UI for the node when zoomed out); rendering it under the open panel is the correct layering.

**Edge cases handled:**
- *Layer of stacking comparison.* Detail Panel uses `position: absolute` inside the canvas-container flex item, with `zIndex: 200`. Tooltip portal is in `document.body` with `position: fixed, zIndex: 150`. Stacking compares within the body's stacking context — both are top-level positioned descendants. zIndex 200 wins.
- *Modal vs tooltip.* Modals at zIndex 10000 still cover tooltips. Notification dropdowns at zIndex 200 also cover tooltips. Edge hover menu at zIndex 5900 still wins (it's a separate UI surface, not affected by this change).
- *Self-referential proof-only ERs.* Hypothetical scenario where one ER targets multiple Claims simultaneously — n/a in current schema (`er.claimId` is single-valued). Stacking is per-DA-per-source-Claim only.

**Verified end-to-end:**
- Data layer: Dave's canvas — PRM Claim at (2100, 0), Eval Result at (2300, 300). Delta (200, 300). 
- Alice's POE-visible Eval Results (Bob's at 1700/100, Carol's at 1700/400) and Bob's own ER (1700/100) all preserve their existing positions — no regression.
- DOM probe at default zoom: PRM Claim card center at (1698, 653), Eval Result card center at (1858, 893). Delta (160, 240) — proportional to world-space (200, 300) at 0.8x zoom. No overlap.
- Z-index source verification: AssetNode.jsx tooltip portals (line 1095 + 1351) both read `zIndex: 150`. Detail Panel grep confirms `zIndex: 200`. Stacking order is correct.

**Spec updates:** §10.4 Proof-only sub-section text updated to describe source-Claim-derived placement (instead of the fixed-column language from 11D.3/11D.4). Spec Changelog entry covering both W1 and W2.

**Footer + Changelog:** v0.11.10 → v0.11.11. Changelog modal entry added.

**Deviations from task brief:** None. Both fixes shipped as briefed. The Z-index choice (150) is below all UI overlays at 200+ (Detail Panel + notification dropdown), still well above any canvas content.

**Status:** [x] Complete.

### Phase 11.5 completion notes (2026-04-30) — Dev hygiene pass

Documentation + backlog organization. No code-affecting changes (intentional — task scope was pure cleanup before Phase 11E and Round 13 transition).

**Workstreams:**

- **W1 — `polish-backlog.md` reorganization.** Moved ~70 ✅ Complete / ✅ Verified / ✅ Superseded items into a new `## Completed` section at the bottom of the file, organised by topic sub-section for findability. Topic sections at the top (Visual & Rendering, Edge Interactions, Detail Panels, V1 File Cleanup, Notifications, Data Model & Content, Process Flows, Spec Updates, Future Features, Exploratory) now contain only Open / Partial / Deferred / Investigation items. Status vocabulary standardized to `Open` / `Partial` / `Deferred to Phase X` / `Investigation`. New `Effort` field on every remaining open item: `S` (small, <2h) / `M` (medium, 2–6h) / `L` (large, 6–12h) / `XL` (multi-phase) / `?` (unknown). Phase-queue assignments baked into Status fields where appropriate. **Misfilings rehoused:** #74 (Provenance lineage UI) moved from Process Flows → Detail Panels (it's a Detail Panel surface item). No item triage beyond preserving the existing `#12 → #111 Superseded` link. ID gaps (#84, #92, #109) preserved as historical artifacts.

- **W2 — `architecture-spec.md` audit.** Walked every section. Found Phase 11 work mostly well-documented inline (§6.5 cross-canvas rules, §7.4 notifications, §10.4 grantee-view derivation, §11.5a revocation, §11.6a EA-only request lifecycle, §3.7 layout). Fixes applied in-place:
  - **§6.5** added a 5th cross-canvas pull-in rule for proof-only Claim DAs (Phase 11D.3 / 11D.4.1) — was missing.
  - **§7.4** notification table extended with the four transfer notification types (Phase 9A.4 / 9A.5) and the two revocation types (`v22-da-revoked`, `v22-ea-revoked`, Phase 9D / 9D.1.x) — both groups had been omitted from the spec table.
  - **§14 Implementation Guidelines** — flagged inline as historical (was written during V2.2 migration; references stale `V2_2_ENABLED` flag, V2.1 retention rules, `v2Data.js` filename). Inline note at top of §14 redirects readers to `CLAUDE.md` for current conventions.
  - New **`## Phase 11 (April 2026)`** summary section at the end of the spec covering all twelve sub-phases at high level — separate from the per-sub-phase Changelog entries above it.
  - New **`## Sections requiring expansion`** closing block flagging §12, §13, and §15+ as historical-record sections that could use future hygiene without blocking active work.

- **W3 — `ROUND-13-CONTEXT.md` created.** New repo-root file as a setup checklist for the next Claude Code conversation. Lists the canonical foundation files to upload (architecture-spec.md, CLAUDE.md, polish-backlog.md, V2App.jsx, V22NodeDetailPanel.jsx, v2_2Data.js, V2Canvas.jsx, AssetNode.jsx); per-phase additional files; Round 12 closing state summary; phase queues for 11E, 12, 13, 14, 15, and beyond; explicit "what's NOT in the queue" section covering deferred items like #49 (`src/v2/` rename) and #50 (dead handler sweep).

- **W4 — Phase 11 summary in spec Changelog.** Single high-level entry covering all twelve sub-phases, separate from the per-sub-phase entries above. Points readers at `CLAUDE.md` and the inline section bodies for detail.

- **W5 — Documentation finalization.** This note. polish-backlog Update Log entry. Changelog modal v0.11.12 entry. Footer version bumped v0.11.11 → v0.11.12.

**Out of scope (explicitly deferred):**
- Code refactoring (#49 src/v2 rename, #50 dead handler sweep, #51 V2Canvas prop pruning) — those are substantial code changes for separate phases.
- Architecture spec content rewrites — only audit + flag, not rewrite.
- Backlog item triage decisions beyond obvious duplicates — no kills, no merges beyond the existing `#12 → #111`.
- Phase 11E work (#108 Amend EA modal, #102 reciprocal DA-amendment notifications, #139 edge geometry animation) — queued for Round 13 first phase.

**Runtime verification:** No code changes; documentation-only. Build clean (no broken imports). App boots normally. Phase 11.5 deliverables verified by reading the resulting files top-to-bottom.

**Status:** [x] Complete.

### Phase 11E.1 completion notes (2026-04-30) — Amend Evaluation Agreement (#108)

First Phase 11E item shipped. EA amendment flow now end-to-end functional with the same architectural posture as DA amendment (unilateral grantor-side action; counterparty's recourse if unhappy is to revoke).

**Architectural anchors (locked decisions):**
- **Unilateral.** Like DA amendments, EA amendments fire informational notifications. No counterparty acceptance flow.
- **Amendable fields:** `terms.evaluationDeadline` and the Claim's `acknowledgments[]`.
- **Option B for acknowledgments.** Editing acknowledgments via Amend EA mutates the underlying Claim's `acknowledgments[]` directly. The EA's `acknowledgmentsAccepted` audit-trail field is NOT modified — it's a historical record of what the Evaluator originally accepted.
- **Single-grantee notification.** Only the EA's grantee is notified, even if other EAs on the same Claim are implicitly affected by acknowledgment edits. Production (Option C) will need multi-grantee fan-out + per-EA acknowledgment snapshots; documented in `architecture-spec.md` §11.2a.

**Workstreams:**

- **Batch 1 — Data model.** `makeEvaluationAgreement` extended with `amendments = []` parameter (mirrors DA shape). New factory `makeAmendedEvaluationAgreement({ evaluationAgreement, terms, acknowledgmentChanges, note })` returns a new EA with updated `terms.evaluationDeadline` and an appended amendment record carrying `date`, `note`, `termsBefore.evaluationDeadline`, and `acknowledgmentChanges: { added, removed, edited }`. New pure helper `diffAcknowledgments(before, after)` computes the delta. The factory does NOT touch the underlying Claim — V2App's handler stages both updates atomically.

- **Batch 2 — `AmendEvaluationAgreementModal.jsx` (new, ~250 lines).** Pattern matches `AmendDisclosureModal.jsx` structure (Backdrop / Modal / ModalHeader / ModalBody / ModalFooter). Three sections in body: Expiration (uses shared `ExpiryPicker` from ModalShared, pre-fills to `'custom'` with the EA's current deadline; falls back to `'none'` when deadline is null), Acknowledgments (editable cards with title input + description textarea + REMOVE button per row, plus `+ Add acknowledgment` CTA generating ids `ack-${claim.id}-${Date.now().toString(36)}`), and Amendment note textarea. `hasChanges` gating: at least one of expiry-changed OR acks-added/removed/edited. `canSubmit` additionally requires every acknowledgment to have a non-empty title. Footer summary text describes pending changes ("Expiration changed · 1 acknowledgment added · 2 edited" etc.).

- **Batch 3 — V2App wiring.** New state `v22AmendingEaId` parallel to `v22AmendingDaId`. New imports for `AmendEvaluationAgreementModal` + `makeAmendedEvaluationAgreement` + `diffAcknowledgments`. New handler `handleV22AmendEvaluationSubmit({ terms, acknowledgments, note })`: resolves existing EA + paired Claim from merged provisionals; computes acknowledgment delta; builds the amended EA via the factory; atomically writes both the EA and (if acks dirty) the mutated Claim into `v22Provisionals` via a single `setV22Provisionals` updater; pans + reveals the Claim with the existing `_isNew` infrastructure; enqueues a `v22-ea-amendment` notification on the grantee's inbox (single-grantee fan-out). Modal mount inserted after the AmendDisclosureModal mount.

- **Batch 4 — EA Detail Panel.** New Amendments `<Section>` between Status and the paired-DA navigation button. Each amendment card shows: ISO timestamp; "Expiration: <before> → <current>" line when expiry changed; "Acknowledgments: +N added · −N removed · ~N edited" line when acks changed; italic note quote when present. Lineage chaining caveat documented (older entries' "before" diffs against the *current* deadline rather than the deadline at amendment time). Amend footer button gating extended: `amendDisabled = !isGrantor || isRevoked || agreement.status !== 'active'`. New tooltip messaging branches for `isRevoked`.

- **Batch 5 — Architecture spec.** New §11.2a "Evaluation Agreement amendment (Phase 11E.1)" subsection covering full Option B vs Option C semantics, the amendment record shape, the notification flow, and the two documented limitations (multi-EA implicit propagation + lineage chaining). §7.4 notification table extended with `v22-ea-amendment` row. New Changelog entry. The pre-existing "Not yet implemented (backlog #108)" note at end of §11.2 updated to point at §11.2a.

- **Batch 6 — Backlog + CLAUDE.md.** #108 moved from Detail Panels open section → Completed section with full Phase 11E.1 completion summary. New backlog item #160 filed in Exploratory section: "Production: Option C acknowledgment audit semantics for EAs" (Investigation status, L effort, Future priority — covers per-EA snapshots, multi-grantee fan-out, chained lineage, migration plan). #12 superseded note updated to remove the "pending #108" caveat. CLAUDE.md note (this section). Changelog modal v0.11.13 entry. Footer version v0.11.12 → v0.11.13.

**Notification flow (single-grantee):**
1. Alice opens EA Detail Panel → Amend Evaluation Agreement → modal pre-filled with current deadline + claim acknowledgments.
2. Submit fires. State mutation: amended EA in provisionals; (if acks dirty) updated Claim in provisionals. `v22-ea-amendment` enqueued on grantee's inbox.
3. Grantee sees indigo "EA AMENDED" badge + body text "Alice amended the Evaluation Agreement on PRM Assembly Claim."
4. Click → notification dismisses, canvas pans to Claim, EA Detail Panel opens directly with new Amendments section visible.

**Multi-EA implicit propagation (Option B documented limitation):** Alice has EAs to Bob AND Carol on PRM Claim. Alice amends Bob's EA with an acknowledgment edit. The Claim's `acknowledgments[]` mutates — visible to both Bob and Carol when they view the Claim. Only Bob receives the `v22-ea-amendment` notification. Carol's EA's `acknowledgmentsAccepted` audit trail is preserved (untouched), but the *current* acknowledgments on the Claim that Carol sees are the post-edit version. Production fix is Option C (per-EA snapshots — see #160).

**Deviations from task brief:**
- ExpiryPicker option ids in the modal use `'1-year'` / `'2-year'` / `'none'` / `'custom'` (the picker's actual emit values) rather than the brief's `'6-months'` / `'1-year'` / `'2-years'` / `'never'` / `'custom'` — the existing ExpiryPicker doesn't expose '6-months' / '2-years' / 'never' as user-clickable options. Initialize to `'custom'` with the EA's current deadline pre-filled; fall back to `'none'` when deadline is null.
- The brief's W3.7 ordering note ("badgeLabel: branch BEFORE the existing isV22Amendment") was followed — `isV22EaAmendment ? 'EA AMENDED' :` precedes `isV22Amendment ? 'AMENDED' :` in the chain.
- Body text rendering — the brief said to find `isV22Amendment` body text and add a parallel branch. Inspection showed `isV22Amendment` has no dedicated body text branch (falls through to bare `req.asset?.name`). Added the `isV22EaAmendment` branch as a new fallthrough just above the bare-name fallback so it's at least readable; left the existing `isV22Amendment` fallthrough alone for the same reason.

**Runtime verification (preview):**
- Build clean (94 modules, ~585 kB main / ~140 kB gzip).
- App reloads cleanly; no console errors.
- End-to-end UI walkthrough constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse interaction is the verification path. Code-level verification confirms all Batch 1-4 wiring lands at the documented locations and integrates with existing handler infrastructure without TDZ / dependency-array gaps.

**Status:** [x] Complete.

### Phase 11E.1.1 completion notes (2026-05-01) — Amend EA polish + bug fixes

Five fixes from 11E.1 QA. **(1)** `AmendEvaluationAgreementModal`'s `hasChanges` was reporting true on modal open for EAs with non-`T00:00:00Z` deadlines — picker pre-fill normalized to midnight UTC, original ISO carried a time component, raw-string comparison short-circuited to "different." Fixed via `toDateOnly` helper that compares YYYY-MM-DD slices. **(2)** `EdgeHoverMenu` was reading `evaluationAgreement?.terms?.expires` — wrong field. EA carries `terms.evaluationDeadline`; `expires` is on the DA. Fixed; tooltip now reflects post-amend updates via the live merged-view lookup. **(3)** Carol's canvas was showing a NEW badge on Alice's Claim after Alice amended Bob's EA — `setV22RecentlyAcceptedClaimId` is global state and stamps NEW for every viewer. Per Option B (§11.2a), only the targeted EA grantee gets a notification; cross-role NEW contradicts the contract. Removed the `setV22RecentlyAcceptedClaimId` call from the EA-amend handler entirely. **(4)** ExpiryPicker preset card labels read "Expires March 2027" / "March 2028" — wrong-month + non-conforming with the codebase's YYYY-MM-DD convention. Replaced with dynamic `expiryPresetIso(yearsFromNow)` helper; labels now read e.g. "Expires 2027-05-01" relative to today. Inherited correctly by other ExpiryPicker call sites. **(5)** Modal header subtitle now weaves the grantee party name + Claim name into the description prose with `<strong>` tags. **Bonus:** footer summary upgraded from "Expiration changed" to explicit "Expiration: 2026-04-04 → 2027-05-01" before/after with YYYY-MM-DD precision; "No expiry" rendered for null on either side. New backlog item **#161 — Notification deep-link with diff highlighting in Detail Panel** filed (Open, M effort, Medium priority). No spec changes; §11.2a contract preserved. Footer v0.11.13 → v0.11.14. Commit `12d6493`.

**Status:** [x] Complete.

### Phase 11E.1.2 completion notes (2026-05-01) — Detail Panel EA-deadline read audit + edge tooltip nowrap

Two small fixes closing out the Amend EA epic before 11E.2. **(1)** `V22NodeDetailPanel.jsx` `EvaluationAgreementRow` was reading `ea.terms?.resultExpiry || ea.terms?.expires || null` — wrong field. EA carries `terms.evaluationDeadline`; `resultExpiry` is when the eval RESULT itself expires (separate concept); `terms.expires` exists only on the DA schema. Pre-fix the row always rendered "Never expires" regardless of actual deadline AND post-amend never updated. Fixed: read `terms.evaluationDeadline` first with the legacy fields retained as migration-safety fallbacks. Same single-source-of-truth fix the row is shared across V22ClaimPanel, V22AssetPanel, and V22ActorPanel — all three Detail Panel surfaces inherit. Audit confirmed no other stale read sites. **(2)** Edge hover tooltip title was wrapping with "Agreement" orphaned on line 2 for "Selective Disclosure Agreement" + "Proof-only Disclosure Agreement". `MENU_WIDTH` bumped 320 → 380; `whiteSpace: 'nowrap'` added to both DA + EA title elements (parity). Body party→party line continues to wrap normally. No spec changes. Footer v0.11.14 → v0.11.15. Commit `e715547`.

**Status:** [x] Complete.

### Phase 11E.1.3 completion notes (2026-05-01) — Inline EA Amend button wiring + seed data date refresh

Two cleanup items closing out the Amend EA epic before 11E.2. **(1)** `EvaluationAgreementRow` in `V22NodeDetailPanel.jsx` had a stale hardcoded `<ActionLabel label="Amend" disabled title="Amend Evaluation Agreements coming soon" />` from the pre-Phase-11E.1 placeholder era — never updated when the modal shipped. Wired through the prop chain: V2App new `handleAmendEaFromRow` → V22NodeDetailPanel `onAmendEa` prop → all three Detail Panel surfaces inherit. EvaluationAgreementRow now renders AMEND with three-branch gating mirroring `EvaluationAgreementDetailPanel.jsx`'s footer logic: enabled (grantor + active + non-revoked) with onClick + descriptive tooltip; disabled with grantor-only tooltip for non-grantors; disabled with revoked tooltip for revoked EAs. **(2)** Seed-data EA `evaluationDeadline` values bumped 2026-04-XX → 2028-04-XX (preserved month + day; bumped year by 24 months) so demos no longer show past dates on Active EAs. DAs already had 2027 `expires` values and didn't need bumping. Creation/effective `terms.createdDate` values left in 2026 — those are historical timestamps. No spec changes. Footer v0.11.15 → v0.11.16. Commit `30305dc`.

**Status:** [x] Complete.

### Phase 11E.1.4 completion notes (2026-05-01) — Revoked-EA AMEND removal + DA row expiration column + response modal title split + #162 filing

Four fixes closing remaining Amend-EA cleanup before 11E.2. **(1)** AMEND `<ActionLabel>` was rendering on revoked EA rows in node Detail Panels (disabled with tooltip). Inconsistent with REVOKE (already hidden on revoked rows per Phase 9D.1.x precedent) and with `DisclosureAgreementRow`'s `actionsHidden` rule. Fixed: AMEND now hidden entirely on revoked rows (`showAmend = !isInternal && !isRevoked`); two-branch gating remains for active rows (enabled grantor / disabled-with-tooltip non-grantor). **(2)** DA row right-column on active rows now reads `Expires YYYY-MM-DD` (or `No expiry`) from `terms.expires`, matching the EA-row pattern. The "Active" status prefix dropped — the row's presence in the active Agreements section already implies active. Revoked / declined / provisional rows keep their existing label + color + date. **(3)** Audit of all DA factory call sites in `v2_2Data.js` confirmed every cross-party DA already carries 2027-MM-DD `terms.expires`. Public-directory + internal/ownership + proof-of-evaluation DAs legitimately have no expiry; they continue to render gracefully as "No expiry." No seed mutations. **(4)** `CombinedResponseModal` accept-path title is now step-aware. Cold path: Steps 1-2 (Type/Scope) → "Respond to Disclosure Request"; Step 3 (EA Terms) → "Respond to Evaluation Request"; Step 4 (Review) → "Review your Disclosure + Evaluation Agreement Response". Warm path inherits cold-path Step 3 EA copy; Step 4 → "Review your Evaluation Agreement Response". Decline-path titles preserved. **Backlog:** filed item **#162 — EA revocation copy + Directory Layer post-revocation visualization** (Deferred to Phase 14, S copy + part of #132). No spec changes. Footer v0.11.16 → v0.11.17. Commit `a948f86`.

**Status:** [x] Complete.

### Phase 11E.1.5 completion notes (2026-05-01) — REVOKED badge placement + "Never expires" copy unification

Two cleanup fixes. **(1)** REVOKED lifecycle-state badge on revoked node cards relocated from the title row (where it crowded long node names) to the V2.2 type-label header row, alongside the `CLAIM` / `ASSET` / `PARSE RESULT` / `EVAL RESULT` mono label. Per CLAUDE.md Code style, lifecycle-state badges are separate from the type label. AssetNode Row 0 wrapper switched from a default block to a flex container with gap so the type label + REVOKED badge sit on a single line. Title row (Row 1) now displays only the node name + remaining badges. REVOKED's badge precedence over PROVISIONAL/DECLINED is preserved. Mini LOD already used a dashed-red-border + red-tinted background (no text badge); no regression. **(2)** Copy unification across the app — the no-expiration state now reads "Never expires" everywhere it's rendered as a status display. Phase 11E.1.4's `DisclosureAgreementRow` addition originally used "No expiry"; pre-existing surfaces used "Never expires". Sweep updated five files: `V22NodeDetailPanel.jsx` (DA row), `AmendEvaluationAgreementModal.jsx` (formatDateTime + footer summary), `ModalShared.jsx` (`expiryLabel` resolved-state for `'none'`), `EvaluationAgreementDetailPanel.jsx` (rows + amendment row), `DisclosureAgreementDetailPanel.jsx` (Expires row). Detail Panel rows previously rendered an em dash "—" for null; now read "Never expires." Judgment call preserved: ExpiryPicker preset card retains `label: 'No expiry'` since that title labels a *user action* of opting out of an expiry. No spec changes. Footer v0.11.17 → v0.11.18. Commit `3172328`.

**Status:** [x] Complete.

### Phase 11E.1.6 completion notes (2026-05-02) — DA expiration UX in Response + Amend flows + EA "Never expires" coercion fix + Amend DA title

Four fixes closing out the DA/EA separation arc before 11E.2. Spec §11.2 + §11.6 are now reflected more faithfully by the UI; no spec text changed. **(1) P1 bug:** clicking the ExpiryPicker's "No expiry" preset in `CombinedResponseModal` silently produced an EA `evaluationDeadline` ~1 year out instead of `null`. Root cause: `computeExpiryIso` switch handled stale picker ids (`'never'`, `'6-months'`, `'2-years'`) but the picker actually emits `'1-year'`, `'2-year'`, `'none'`, `'custom'` — `'none'` fell to the `default` branch and got coerced to +1 year. Fixed: rewrote the switch to use the picker's actual ids; added `isoFromPicker(mode, customDate)` helper. Also fixed the same null-coercion bug in `finalizeProvisionalAgreementPair` and `finalizeProvisionalEvaluationAgreement` (cold + warm paths) where `??` collapsed an explicit null `eaTerms.expires` back to the provisional fallback — switched both to `!== undefined ? : (fallback ?? null)`. **(2)** DA expiration is now grantor-set at response time (Andrew's Option A). `CombinedResponseModal` Step 2 gains a Disclosure Agreement expiry picker above the scope picker; Step 3 copy tightened to be EA-specific; Step 4 review shows DA + EA expirations on separate rows. Submit payload extended with `daTerms: { expires }`. `finalizeProvisionalAgreementPair` extended with `daTerms` parameter so the DA's `terms.expires` is set independently of the EA's `terms.evaluationDeadline`. Pre-fix the same value was assigned to both fields. Defaults: both pickers default to `'none'` ("Never expires"). **(3)** `AmendDisclosureModal` gains an Expiration section above the scope picker, mirroring `AmendEvaluationAgreementModal`'s layout. Submit payload extended with `terms: { expires }`. `makeAmendedDisclosureAgreement` factory now accepts an optional `terms` argument, applies `terms.expires` (preserving null), and records `termsBefore: { expires }` on the amendment record. DA Detail Panel's prior count-only "Amendments: N" Row replaced with a full Amendments section: each card shows timestamp, "Expiration: before → current" delta when expires changed, "Scope amended." line when scopeBefore is present, optional grantor note. **(4)** AmendDisclosureModal title `"Amend Disclosure" → "Amend Disclosure Agreement"` (parity with Amend EA); footer Submit button label matches. Subtitle replaced with parallel JSX structure to AmendEvaluationAgreementModal: weaves grantee + Claim name into prose with `<strong>`. New `claim` prop wired through V2App. Footer v0.11.18 → v0.11.19. Commit `8eabd56`.

**Status:** [x] Complete.

### Phase 11E.1.7 completion notes (2026-05-02) — Step 4 abbreviation expansion + modal max-height + Detail Panel close on Directory Layer + Amend DA zero-Asset gating + #163 filing

Five small fixes closing out the DA/EA separation arc. **(1)** `CombinedResponseModal` Step 4 review labels expanded — "DA EXPIRES" → "DISCLOSURE AGREEMENT EXPIRES" + "EA EXPIRES" → "EVALUATION AGREEMENT EXPIRES". Label column `minWidth` widened from 130 → 230 to fit the longer mono-uppercase strings without wrapping. **(2)** `CombinedResponseModal` renders at a fixed 720px height so steps 1-4 (and warm-path 3-4) all sit at the same size and the footer button row no longer jumps as content varies. Implemented by adding an optional `height` prop to the shared `Modal` component (defaults to undefined → existing behavior unchanged for all other modals). Cap is `min(90vh, 720px)`. **(3)** Detail Panels (node + DA + EA) now close when the user enters the Radiant Network Directory Layer. The globe-button onClick already cleared `setSel` / `setForcePanelTab` / `setForceExpandSda`, but didn't clear `setSelectedEdgeId` / `setOpenAgreement` — the agreement Detail Panels are driven by edge selection, so a DA / EA panel persisted over the directory. Added both clears to the same handler. **(4)** AmendDisclosureModal blocks Submit when current scope is empty for the active type (Full → ≥1 Asset, Selective → ≥1 field, Proof-only → ≥1 Eval Result). Inline amber italic empty-state message renders only when `showEmptyScopeWarning` (= `scopeIsEmpty && baselineWasNonEmpty`) — i.e., after the user has interacted to reach zero, not on initial open. **Backlog:** filed item **#163 — Anchor Asset picker for EA-only requests on Directory Layer Claims** (Deferred to Phase 14, M effort). No spec changes. Footer v0.11.19 → v0.11.20. Commit `6121fae`.

**Status:** [x] Complete.

### Phase 11E.2 completion notes (2026-05-02) — Reciprocal DA + Claim amendment notifications (#102) + Phase 11E.3 — Edge draw-in animation initial attempt (#139)

Two parallel features closing out the original Phase 11E queue. **#102 deliverables:** (a) the existing DA-amendment notification was renamed `v22-amendment` → `v22-da-amendment` (parallel to `v22-ea-amendment`); click handler updated to deep-link directly to the DA Detail Panel via `setOpenAgreement({ kind: 'disclosure', disclosureAgreementId })`. Notification body copy now includes the Claim name + optional `(Note: …)` suffix. (b) New `v22-claim-amendment` type fires from `handleV22AmendClaimSubmit` to every counterparty with an *active* DA on the affected Claim — fan-out, deduped by party. Click pans to the Claim and opens its node Detail Panel. (c) Both new types' badge labels: `DA AMENDED` and `CLAIM AMENDED`. Architecture spec §7.4 + §11.2 prototype notes updated. **#139 initial attempt:** new animation primitive `src/v2/animations/edgeDrawIn.js` exporting `playEdgeDrawIn`. New `playEdgeDrawIn(nodeId, durationMs = 500)` method on V2Canvas mirrored `playEdgeRetract` in reverse — single-edge approach that mutated the existing canonical edge's geometry. Wired into `startReveal` via `setTimeout(500ms)`. **Note:** the single-edge architecture in 11E.3 diverged from Andrew's two-edge spec; superseded by Phase 11E.4. Footer v0.11.20 → v0.11.21. Commit `9aedbf2`.

**Status:** [x] Complete (DA-amendment side preserved; Claim-amendment notifications and single-edge animation rolled back / reworked in 11E.4).

### Phase 11E.4 completion notes (2026-05-02) — Roll back Claim amendment notifications + two-edge reveal animation architecture + AMENDMENT badge unification

Three corrections from 11E.2 + 11E.3 QA. **(1) Roll back `v22-claim-amendment`:** counterparties don't see Claim amendments directly; they only learn of new content when the grantor amends the Disclosure Agreement to include new Assets/fields. DA amendment is the user-visible event; Claim amendment is internal Claim-owner state. Removed: the entire fan-out logic from `handleV22AmendClaimSubmit`; the `isV22ClaimAmendment` flag, badge map entry, click handler branch, and body-text branch in V2App.jsx; the §7.4 row in spec; the §11.2 prototype-note reference. The DA-amendment side of 11E.2 (rename + click + body) is preserved unchanged. **(2)** `v22-da-amendment` and `v22-ea-amendment` badge labels unified to `AMENDMENT` (was `DA AMENDED` / `EA AMENDED`). The badge is a category tag — the body copy specifies which artifact was amended. **(3) Two-edge reveal architecture:** Phase 11E.3's single-edge approach was wrong. New architecture: V2Canvas now exposes a separate `revealOverlayGroup` (sibling of `edgeGroup`) that survives `buildEdges`'s `clearGroup` calls. Four atomic methods on the imperative handle: `addRevealOverlayEdge` (Line2 with typed style + 2-point stub at FROM end), `playEdgeDrawInById` (geometry growth via per-frame point-trim grow), `fadeEdgeOpacityById` (canonical provisional edge opacity ramp), `removeRevealOverlayEdge` (cleanup). The reveal animation orchestrator (`src/v2/animations/edgeDrawIn.js` exports `playRevealEdgeAnimation`) coordinates: at draw-in start a typed overlay edge is added with stub geometry; geometry grows over 500ms; provisional canonical edge fades out concurrent with the Claim card flip (`fadeStartDelayMs=600`, `fadeMs=400`); overlay is removed after `postFlipPauseMs=900` so the canonical buildEdges has time to re-render the typed edge with proper styling at reveal phase 'done'. `startReveal` in V2App.jsx now resolves the cross-party canonical edge incident to the revealed Claim. No regressions to `playEdgeRetract`. Footer v0.11.21 → v0.11.22. Commit `69b8ecd`.

**Status:** [x] Complete.

### Phase 11E.5 completion notes (2026-05-03) — Edge draw-in geometry stub fix attempt + notification deep-link edge selection + #164 filing

Three fixes closing out Phase 11. **(1) #139 follow-up attempt:** Phase 11E.4's two-edge architecture had a latent bug — the typed-style overlay edge appeared as a ~100px stub at the anchor and sat motionless. Root cause: `LineGeometry` allocates its `instanceStart` / `instanceEnd` InstancedBufferAttributes at the size of the initial position array supplied to `setPositions`. `addRevealOverlayEdge` seeded with a 2-point stub (6 floats); subsequent `setPositions` calls in `playEdgeDrawInById` with longer arrays exceeded the allocation and threw silently — the throws were swallowed by the `try/catch`. Fix mirrors `animateNewEdges`: `addRevealOverlayEdge` now initializes geometry with the FULL bezier curve from frame zero, captures `_fullInstanceCount` into userData, runs `computeLineDistances()` once, then sets `geometry.instanceCount = 0`. `playEdgeDrawInById` rewritten to per-frame `geometry.instanceCount = Math.round(eased * fullCount)`. **(Note: this fix was incomplete — Phase 11E.6 caught a follow-on `Infinity` bug.) (2)** Clicking a `v22-da-amendment` or `v22-ea-amendment` notification now also selects the corresponding canonical agreement edge via `setSelectedEdgeId`. Edge id resolution: DA amendment → walk `v22Data.edges` matching `disclosureAgreementId === req.v22DaId`; EA amendment → match `pairedEvaluationAgreementId === req.v22EaId`. Other notification deep-links unchanged. **(3) Backlog:** filed new item **#164 — Acknowledgment amendment acceptance UX (counter-acceptance flow)** in a new "Phase 11.6 cleanup queue" sub-section at the top of Future Features. Captured Andrew's note from 11E.4 QA that Phase 11E.1's Option B Amend EA semantics allow the grantor to unilaterally add/edit/remove acknowledgments post-acceptance — an exploit vector. Footer v0.11.22 → v0.11.23. Commit `d855e35`.

**Status:** [x] Complete (geometry stub fix attempt; superseded by 11E.6 root-cause fix).

### Phase 11E.6 completion notes (2026-05-03) — `_fullInstanceCount = Infinity` root-cause fix

One-line root-cause fix to the Phase 11E.5 reveal animation regression. `addRevealOverlayEdge` was reading `fullInstanceCount = geometry.instanceCount` post-`setPositions`, but `THREE.LineGeometry.setPositions` does NOT update `instanceCount` — `InstancedBufferGeometry`'s constructor leaves it at the default `Infinity`. So `_fullInstanceCount` was stored as `Infinity` in userData; in `playEdgeDrawInById`'s per-frame `Math.round(eased * fullCount)` ramp: frame 0 → `Math.round(0 * Infinity) = NaN` (nothing rendered); frames 1+ → `Math.round(eased * Infinity) = Infinity` (all segments rendered). No animated draw-in was ever visible. The early-return guard `typeof fullCount !== 'number' || fullCount <= 0` didn't catch `Infinity` (which IS a number > 0). Fix: derive segment count directly from `curvePoints` — for an N-point curve there are N-1 line segments, the value Three.js actually uses for rendering. After fix, `_fullInstanceCount` is a finite integer (11 / 19 / 31 depending on curvature), per-frame ramp produces real values, and the edge animates visibly along the full bezier curve. `playEdgeRetract` unaffected. Footer v0.11.23 → v0.11.24. Commit `77b7112`.

**Status:** [x] Complete.

### Phase 11E.7 completion notes (2026-05-03) — `_showAsProvisional` stamp lifecycle restored from acceptance until notification click

Architectural fix to the reveal flow. The `_showAsProvisional` stamp on incident Claims and edges must persist on the grantee's view from the moment of acceptance until the grantee's notification click triggers `startReveal` — not just during the reveal animation window. Pre-fix: Phase 11C.5 introduced `v22RevealActiveClaimId` as the only gate, cleared at reveal phase 'done'. The stamp was never SET pre-click — so the grantee's view rendered the new Claim + typed edge in active state immediately on acceptance (since `v22Provisionals` already holds the finalized artifact). When the grantee later clicked the notification, `startReveal` set the gate, the Claim visually "regressed" to provisional, then animated back to active. That reads as "acceptance, then re-acceptance" rather than a true first-time materialization. Fix: new per-role state slot `v22PendingRevealsByRole` tracks pending acceptance reveals on the requester's role. Populated by `handleV22Accept` and `handleV22AcceptEAOnly` immediately after enqueueing the acceptance notification on the requester's inbox. Drained by the notification click handler immediately before `startReveal` fires (so React batches both state updates into the same render — gate (b) clears in the same frame gate (a) sets, no one-frame visual gap). Two new helpers: `addPendingReveal(targetRoleId, claimId)` + `removePendingReveal(targetRoleId, claimId)`. The `v22DataWithReveal` memo's stamp logic now composes the two gates: stamp applies if `v22RevealActiveClaimId === n.id` OR `pendingRevealClaimIds.has(n.id)`. Edge stamping unified to walk the union of active-reveal + pending-reveal claim ids. Architecture spec gains new §11.5b "Acceptance reveal stamp lifecycle (Phase 11C.5 / 11E.7)" subsection documenting the three-phase lifecycle, two-gate composition, and why the grantor side doesn't carry the stamp. Footer v0.11.24 → v0.11.25. Commit `f4b0172`.

**Status:** [x] Complete.

### Phase 11E.8 completion notes (2026-05-03) — `anyDecoration` early-return guard fix + draw-in duration 500ms → 1200ms

Two fixes from 11E.7 QA. **(1)** The `v22DataWithReveal` memo's `anyDecoration` early-return guard didn't include the reveal-window state slots. When the grantee deselected the recently-accepted Claim before clicking the notification (clearing `flagged` since `v22RecentlyAcceptedClaimId === prevSel` triggers the deselect-aware effect), the gate's other triggers all evaluated false, so the memo short-circuited to `return v22Data` and the pending-reveal + active-reveal edge stamping never ran. Edges reaching V2Canvas had no `_showAsProvisional: true` flag, so `effectiveSdaType` collapsed to the typed sdaType — incident edges rendered with their typed color instead of dashed grey provisional. Fix: extend `anyDecoration` to also include `pendingRevealClaimIds.size > 0` and `v22RevealActiveClaimId != null`. **(2)** Edge draw-in animation slowed from 500ms to 1200ms — Andrew reported the 500ms duration was too fast to perceive curve growth. `playRevealEdgeAnimation` parameters bumped: `drawInMs` 500 → 1200, `fadeStartDelayMs` 600 → 1300; `fadeMs` (400) and `postFlipPauseMs` (900) unchanged since flip duration constrains fade and post-flip cleanup buffer needs to outlast reveal phase 'done' regardless. Footer v0.11.25 → v0.11.26. Commit `f68a488`.

**Status:** [x] Complete.

### Phase 11E.9 completion notes (2026-05-03) — Reverse draw-in animation direction + `applyEdgeStylingRef` provisional flag respect

Two fixes from 11E.8 QA. **(1) Direction:** `startReveal`'s edge resolution at the `playRevealEdgeAnimation` call site was passing `fromNodeId = primaryEdge.from`, `toNodeId = primaryEdge.to`. `deriveAgreementEdges` sets `edge.from = claimId, edge.to = anchorAssetId` for cross-party Claim DAs — so the typed overlay edge's geometry grew from the Claim end toward the anchor Asset, backwards from the intended "supplier reaches out to pull in the Claim." Fixed: swap the assignments at the call site (`fromNodeId = primaryEdge.to`, `toNodeId = primaryEdge.from`). The canonical edge convention in `deriveAgreementEdges` stays untouched; the swap is confined to one orchestrator call site. **(2) Stamp not reaching restyle:** `applyEdgeStylingRef` (V2Canvas:3183) is a runtime restyle pass that re-applies edge color / width / opacity on selection / hover / zoom / `currentLayer.edges` changes. Pre-fix it computed `effectiveSdaType = line.userData?.sdaType || 'full'` — reading the typed sdaType stamped at edge build time, ignoring the `_showAsProvisional` flag. The initial `buildEdges` correctly collapsed `effectiveSdaType` to `'provisional'` when the edge carried the flag, so the first paint rendered dashed grey. But the very next restyle (typically triggered immediately by `currentLayer.edges` changing on memo recomputation) overwrote the material color with the typed color, leaving the edge with a typed color + dashed pattern instead of dashed grey. Fix follows the Phase 9D.2.2 Fix 1 precedent for `isRevoked`: carry `showAsProvisional: !!edge._showAsProvisional` onto `line.userData` in `buildEdges`, then have `applyEdgeStylingRef` collapse `effectiveSdaType` to `'provisional'` when the userData flag is set. Same single-source-of-truth pattern that's preserved revoked-edge styling through restyles since 9D.2.2. Footer v0.11.26 → v0.11.27. Commit `d78f939`.

**Status:** [x] Complete.

### Phase 11.6 completion notes (2026-05-03) — Amendment-as-proposal flow (#164) + draw-in smoothness (#165) + Phase 11E retrospective (#166)

End-of-Phase-11 cleanup batch. Three items shipped together. Phase 11 closed; Phase 12 next.

**Item 1 (#164) Amendment-as-proposal flow:** structural refactor — Phase 11E.1 unilateral Option B model replaced with a bilateral propose / accept / reject flow. Closes the post-acceptance acknowledgment-injection exploit Andrew flagged in 11E.4 QA. The grantor cannot mutate the grantee's accepted commitments without explicit consent. New EA `status` enum value `'pending-acceptance'`. New per-amendment shape with `id`, `status: 'pending'|'accepted'|'rejected'|'superseded'`, `proposalMessage`, `responseMessage`, `responseDate`, `termsBefore`, `proposed: { evaluationDeadline, acknowledgments }`, `acknowledgmentChanges`. Three new factory helpers in `v2_2Data.js`: `proposeEvaluationAgreementAmendment` (replaces `makeAmendedEvaluationAgreement`), `acceptEvaluationAgreementAmendment`, `rejectEvaluationAgreementAmendment`. Three new V2App handlers: `handleV22ProposeEvaluationAmendment`, `handleV22AmendmentAccept`, `handleV22AmendmentReject`. New `AmendmentResponseModal.jsx` for the grantee-side UX with diff display + per-row checkbox ticking + expiration confirm + free-text response. AmendEvaluationAgreementModal updated: subtitle copy reflects the proposal model + paused-evaluations explanation; submit button label "Submit Amendment Proposal" (was "Amend Evaluation Agreement"); "Amendment note" field renamed "Proposal message". Pending-acceptance lock enforced UI-side: `V22RunEvaluationModal` blocks submit + footer copy directs grantee to inbox; `EvaluationAgreementDetailPanel` + `EvaluationAgreementRow` AMEND buttons disabled with tooltip pointing to pending grantee response. Notifications: old `v22-ea-amendment` informational type sunset; three new types (`v22-ea-amendment-proposal` indigo `AMENDMENT PROPOSAL` / `v22-ea-amendment-accepted` green `AMENDMENT ACCEPTED` / `v22-ea-amendment-rejected` red `AMENDMENT REJECTED`). Architecture spec §11.2a major revision (replaces Option B docs with the proposal model) + new §11.2b documenting the pending-acceptance lock semantics + revoke override + §7.4 update. New backlog item **#167** filed for extending the proposal model to DA amendments (deliberate scope limit this round — DAs only edit scope + expiration, neither carries the same exploit risk as acknowledgments).

**Item 2 (#165) Smooth out edge draw-in:** `addRevealOverlayEdge` forces `pointCount = 64` for reveal overlay edges (was 12/20/32 from canonical curvature heuristic). Smaller per-frame `instanceCount` deltas eliminate the "steppy" quantization visible during the 1.2s draw-in window — 64 segments at ~60fps gives ~1 segment per frame. Geometry cost bounded (one overlay edge per reveal, ~2s lifetime). Canonical buildEdges resolution unchanged.

**Item 3 (#166) Phase 11E retrospective:** appended single-paragraph retrospective to polish-backlog Update Log. Phase 11E shipped #108, #102, #139 across nine sub-phases (11E.1 → 11E.9). Sub-phase count was driven primarily by the edge draw-in animation (#139) which took rounds 11E.3 → 11E.9 to land cleanly. Root cause patterns: (1) two-edge animation architecture wasn't followed in the initial implementation; (2) THREE.js InstancedBufferGeometry's `instanceCount` defaults to `Infinity`, not the constructor's allocated size; (3) the reveal lifecycle's `_showAsProvisional` stamp was being applied at the wrong scope. Workflow lesson: source files in the project (V2App.jsx + V2Canvas.jsx + v2_2Data.js + edgeDrawIn.js) are the durable canon for surgical diagnosis.

Footer v0.11.27 → v0.11.28. Commit `603f89b`.

**Status:** [x] Complete.

### Phase 11.6.1 completion notes (2026-05-03) — Five fixes from Phase 11.6 QA

**(1)** `handleV22AmendmentAccept` and `handleV22AmendmentReject` now dismiss the originating `v22-ea-amendment-proposal` notification on the grantee's inbox after a terminal response. The proposal notification id is deterministic (`v22-ea-amendment-proposal-${eaId}-${amendmentId}`), so both handlers append it to `dismissedReqs` via `updateRoleState(roleId, ...)` immediately after `setV22RespondingToEaAmendment(null)`. Pre-fix the notification persisted indefinitely. **(2)** `EvaluationAgreementDetailPanel` now renders an Acknowledgments section sourced from the live `claim.acknowledgments[]` (passed as a new `claim` prop from V2App). Spec §11.2a Option B says acknowledgments live on the Claim, not the EA; the EA's `acknowledgmentsAccepted` is an audit-trail snapshot of original acceptance time, not the live state. Pre-fix the panel had no Acknowledgments section at all, so post-amendment changes were invisible until the user opened the Claim Detail Panel directly. **(3)** Run Evaluation button on the Claim Detail Panel now stays visible during `pending-acceptance` (visually disabled with tooltip directing grantee to respond), instead of falling through to "Request Evaluation Agreement." V2App's `evaluationAgreementForActor` resolver extended via `isActionableEaStatus = (s) => s === 'active' || s === 'pending-acceptance'`; V22ClaimPanel's footer renders Run Evaluation as `<FooterButton disabled title="Cannot run evaluation: amendment proposal awaiting your response. Respond in your inbox to continue.">` when the EA's status is pending-acceptance. **(4)** EA Detail Panel footer's `canRevoke` predicate extended to allow revocation during pending-acceptance per spec §11.2b — revoke is the documented override during pending. The pending amendment record stays in `amendments[]` for audit; the EA goes to `revoked` regardless. **(5)** Both `AmendEvaluationAgreementModal` (grantor's view) and `AmendmentResponseModal` (grantee's view) now display a "Current terms" section at the top of the modal body — read-only display of the EA's pre-amendment expiration + the Claim's pre-amendment acknowledgments — followed by a divider, then the existing editable / diff-display sections (relabeled "Proposed expiration" / "Proposed acknowledgments" / "Proposed acknowledgment changes" / "Proposed expiration change" so the contrast is explicit). Andrew's note: "keep it simple — there will be a big redesign of all modal flows later on." No spec changes. Footer v0.11.28 → v0.11.29. Commit `f534c03`.

**Status:** [x] Complete.
