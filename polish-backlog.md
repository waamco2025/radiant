# V2.2 Polish Backlog

Running list of refinements, enhancements, and UX adjustments identified during V2.2 migration work. Intended to be addressed in a dedicated polish phase after Phase 7 is complete and the V2.1 code paths are deleted.

Claude Code: update this file as new items are identified during migration work. Do not address any item on this list during the migration itself unless it gates a Phase's acceptance criteria.

Each item includes:
- **Status** — one of `Open` / `Partial` / `Deferred to Phase X` / `Investigation`
- **Effort** — `S` (small, <2h), `M` (medium, 2–6h), `L` (large, 6–12h), `XL` (multi-phase), `?` (unknown)
- **Source** — which phase or conversation surfaced it
- **Depends on** — prerequisites, if any

Item numbers are permanent IDs; they are never resequenced. Gaps (#84, #92, #109) are historical artifacts. Phase 11.5 hygiene pass moved completed items to the bottom-of-file `## Completed` section — open / partial / deferred items live in their topic sections above.

---

## Visual & Rendering

### 4. Layout density improvements
- **Status:** Open
- **Effort:** L
- **Source:** Phase 2 visual review
- **Context:** Alice's canvas is crowded with Assets, Parse Results, Claims, and Eval Results all on the parent layer. Nodes overlap in edge paths; edge crossings are frequent.
- **Proposed fix:** Evaluate orthogonal edge routing, edge bundling, or tighter node clustering by relationship. May require V2Canvas refactor.

### 39. Decline dismiss "ravel-out" animation
- **Status:** Open
- **Effort:** S
- **Source:** Phase 6.5+ #2 / #3 review
- **Context:** Dismissing a declined Claim removes it instantly from Bob's canvas. A short ravel-out animation (border collapse + edge fade) would communicate "this is going away" instead of a hard cut. Pairs with #124 (revoked-node unravel — now shipped); same primitive could apply.

### 44. Radiant Network Actor node on owner canvas
- **Status:** Open
- **Effort:** S
- **Source:** Phase 7 gap — spec §3.6
- **Context:** §3.6 says the Radiant Network node appears on the user's canvas only if they have Claims publicly disclosed. On Alice's canvas today we derive the public-directory edges correctly but do NOT add a Radiant Network Actor node to the view. Add `isPublicDirectory` pseudo-actor to `buildViewForActor` when the actor has any DA where grantee.party === 'Radiant Network'.

### 46. Corner-node morph on Directory entry/exit
- **Status:** Deferred to Phase 14
- **Effort:** M
- **Source:** Spec §8.1 — unimplemented in Phase 7
- **Context:** Spec calls for the Radiant Network chrome button to morph mid-animation into the Directory Layer's corner anchor node (and vice versa on exit). Currently the two are visually distinct: the chrome icon stays in place, and the corner anchor fades in via the clip-path wipe. A continuous transform (translate + scale + shape interpolation) would sell the "one animation, not two" principle more convincingly.

### 56. Keyboard accessibility
- **Status:** Open
- **Effort:** M
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Context:** Flows today assume mouse input — canvas panning, edge clicks, modal chevron pickers, confidence cycling all fire on click without a clear keyboard equivalent. A pass to wire Tab/Arrow/Enter/Escape through each flow (modal traversal order, canvas-focus-ring, chevron picker via arrow keys, confidence cycle via Space) before a broader a11y audit.

### 57. Mobile/responsive (tablet-friendly max)
- **Status:** Open
- **Effort:** L
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Context:** Layout is desktop-first; the canvas and Detail Panel both assume ≥1280px. Tablet is a realistic demo surface (iPad landscape ≈ 1024×768). Phone is out of scope. Audit: canvas pan/zoom ergonomics on touch, Detail Panel width on narrower viewports, modal widths, chrome icon spacing.

<!-- Phase 11E.1: #108 moved to Completed section below. -->


### 110. Edge glow + marching-ants animations (V2.1 restoration)
- **Status:** Open
- **Effort:** M
- **Source:** Phase 9B deviation — these effects existed in V2.1 but don't exist in V2.2.
- **Context:** V2.1 had two persistent edge animations: a glow effect on Full Disclosure edges, and marching-ants (animated dashed line) on Selective, Proof-only, and Provisional edges. Both effects were lost during V2.2 migration cleanup. Both should persist through selection state (additive brightening on top, not replacing). Reference V2.1 backups for original implementation.
- **Proposed fix:** Port the V2.1 edge-animation logic to V2Canvas.jsx. Glow likely a Three.js shader or post-processing effect; marching-ants is a stroke-dashoffset animation. Ensure both additively compose with selection brightening (+1.5px stroke, 65% white blend from 9A.1) and with Phase 9B's 30% hover brightening.

---

## Edge Interactions

### 6. Selected-edge state persistence through layer changes
- **Status:** Open
- **Effort:** S
- **Source:** Phase 3 open question
- **Context:** If user selects an edge then triggers a layer change (dive/surface), the highlight resets because material mutation doesn't survive rebuild.
- **Proposed fix:** Re-apply selected-edge material in the effect that handles layer changes. Low-priority given V2.2's empty child layer — matters more if we later reuse child layer.

### 9. Richer provisional → active transition
- **Status:** Open
- **Effort:** M
- **Source:** Phase 4 deviation #3
- **Context:** Current transition reuses V2.1's `_isNew` 900ms reveal. Phase 11C.3–11C.5 wired the flip-from-provisional → active card animation back; pairs with #139 for the edge geometry animation that should accompany it.
- **Proposed fix:** Dashed-to-solid edge morph animation. May share primitive with the unravel `playEdgeRetract` (inverse: edge draws from anchor toward target instead of trimming back).

### 35. Edge-draw animation for new Amend Claim references
- **Status:** Open
- **Effort:** S
- **Source:** Phase 6.5 #12 review — when an amendment adds new Asset references, the new claim ↔ asset edges appear without animation.
- **Context:** Existing `_isNew` flag drives node reveals; needs an analogous edge-level signal so newly-derived edges from amendment also draw with V2Canvas's existing edge-draw animation pattern.
- **Proposed fix:** Tag the new claim-ref DAs with `_isNew: true` in the amendment factory output; have the canvas adapter pass that flag through to the derived edges; V2Canvas already animates edges with `_isNew` (see Phase 4 reveal infrastructure).

### 71. Restore provisional → disclosed card transform animation
- **Status:** Open
- **Effort:** M
- **Source:** Phase 9A.3 QA — existed in V2.1, lost during migration cleanup.
- **Context:** Card-level animation that played when a provisional node transitioned to disclosed (active). Distinct from #9 (edge dashed-to-solid animation) — this is the node-card transform/reveal. Phase 11C.3 wired the `_showAsProvisional` flag during reveal; could now layer richer transform keyframes on top. Pairs with #139.
- **Proposed fix:** Reinstate the V2.1 card transform keyframes in `AssetNode.jsx` (or CSS sibling). Trigger on `_showAsProvisional` flipping false after `handleV22Accept`.

---

## Detail Panels

### 11. Two-tab Overview/Artifact layout for DA and EA Detail Panels
- **Status:** Deferred to Phase 15
- **Effort:** M
- **Source:** Phase 3 visual review
- **Context:** DA and EA Detail Panels currently use a flat layout. Node Detail Panels use Overview + Artifact tabs. Matching the node panel structure would give DA/EA panels a consistent mental model (Overview: parties, subject, scope, terms — Artifact: raw JSON viewer).
- **Proposed fix:** Refactor `DisclosureAgreementDetailPanel.jsx` and `EvaluationAgreementDetailPanel.jsx` to use the same tab structure as node DetailPanels, with a JSON artifact view under the Artifact tab.

### 48. Candidate preview before Request Agreement
- **Status:** Deferred to Phase 15
- **Effort:** M
- **Source:** Phase 7 scope boundary (spec §9)
- **Context:** Spec §9 lists "View a Claim's public-directory Detail Panel (owner, description, posted date, aggregate stats)" as a capability. Currently the candidate card jumps straight to Request Agreement. Add a secondary "Preview" CTA that opens a read-only panel showing what's publicly disclosed about the Claim (respecting the public DA's scope).

### 58. Export JSON (functional) + Export PDF (placeholder)
- **Status:** Open
- **Effort:** M
- **Source:** Phase 9A.3 preamble — handoff roster. **High priority.**
- **Context:** Detail Panels for each artifact type (Asset, Claim, Parse Result, Eval Result, DA, EA) should offer Export actions. JSON export is trivial — serialise the `v22Artifact` (or the underlying artifact) and trigger a browser download; this is functional from day one. PDF export is placeholder-grade (stub button that opens a "coming soon" dialog or generates a minimal PDF via a lightweight library) — the intent is to surface the capability in the UI so client discussions around export formats have a visible hook.
- **Proposed fix:** Add a shared `<ExportActions>` strip to each Detail Panel footer, above the primary action. Two buttons: "Export JSON" (functional) + "Export PDF" (placeholder). Consider a single dropdown if footers get crowded.

### 74. Provenance lineage UI in Detail Panels
- **Status:** Open
- **Effort:** M
- **Source:** Phase 9A.4 — `dot.lineage[]` is populated correctly but not yet visualised. (Rehoused from Process Flows during Phase 11.5 hygiene — this is a Detail Panel surface item.)
- **Context:** Every Asset, Claim, and Eval Result now carries `dot.lineage[]` — an append-only chronological list of state transitions (transfers so far; registration events in a later phase). Surface this in a new "Provenance" section on each Detail Panel: chronological list of entries (timestamp + from DID + to DID + status + optional reason).

### 104. Click-to-jump navigation from Detail Panel association lists
- **Status:** Deferred to Phase 15
- **Effort:** M
- **Source:** Phase 9A.6.1 QA — V2.1 capability lost in V2.2 migration.
- **Context:** V2.1 Detail Panels supported clicking a node listed by association (e.g., a Referenced Asset in a Claim panel, an Eval Result in an Asset panel, etc.) to jump the canvas to that node and select it. V2.2 panels render these lists as static text. Phase 11D.3 wired Eval Result row click in V22ClaimPanel; remaining lists (Parse Results, etc.) deferred. Restore the click-to-jump pattern: each associated-node item becomes a clickable row that calls the existing pan-to-selection helper (`canvasRef.current?.animatedPanToWithZoom`) and sets `sel`. Affects V22NodeDetailPanel and possibly the Agreement panels too.

### 116. Agreements section on Eval Result + Parse Result Detail Panels
- **Status:** Open
- **Effort:** S
- **Source:** Phase 9C QA — Andrew's observation that Eval Result panels don't show related Agreements.
- **Context:** Phase 9C shipped the Agreements section on Actor, Asset, and Claim Detail Panels. Parse Result and Eval Result panels were explicitly out of scope. An Eval Result is the subject of at least one Proof-of-Evaluation DA (flowing from the evaluator back to the Claim owner), and may be subject to additional DAs if the owner chooses to disclose the Eval Result to a third party (e.g., Alice discloses Bob's Eval Result to Carol). Currently these aren't surfaced anywhere in the Eval Result's own panel. Same holds for Parse Results (if/when they become subject to their own DAs — today they're generally not, but §6 pull-in semantics may evolve).
- **Proposed fix:** Extend the 9C Agreements section pattern to V22EvalResultPanel and V22ParseResultPanel. Filter DAs by `subject.kind === 'evalResult'` and `subject.id === node.id` (Eval Result case); parse result filtering TBD per data model. Reuse existing row components from 9C — no new primitives needed.

### 161. Notification deep-link with diff highlighting in Detail Panel
- **Status:** Open
- **Effort:** M
- **Priority:** Medium
- **Source:** Phase 11E.1 QA — UX gap when an amendment notification deep-links to the affected node.
- **Context:** When a user clicks an amendment notification (EA amendment today; DA + Claim amendments once #102 ships), the deep-link pans/selects the target node and opens the Detail Panel — but the panel is undifferentiated from a fresh open. The user still has to hunt for what changed. The flow should make the diff visible: scroll the panel to the changed section (Terms, Acknowledgments, Referenced Assets) and render NEW badges + highlighted rows on the specific added / edited rows.
- **Persistence rule:** Highlighting persists until the Detail Panel is closed, then clears. Reopening the panel from the same notification re-applies the highlight; reopening via a different path (canvas click, agreement edge) does not.
- **Proposed fix:** Notification deep-link payload extended with a `diff` field carrying `{ changedSections: [...], newRowIds: [...], editedRowIds: [...] }`. Detail Panel reads diff state on mount when triggered via notification; applies amber row highlighting + NEW badge to the specified rows; clears on unmount. Cross-cuts EA amendment (live), DA amendment (#102 scope), Claim amendment.
- **Depends on:** Pairs naturally with #102 (reciprocal DA-amendment notifications) — both shape the same notification → Detail Panel UX. May ship together or as #102's polish follow-up.

---

## V1 File Cleanup

### 49. Rename `src/v2/` to `src/` (or `src/app/`)
- **Status:** Open
- **Effort:** M
- **Source:** Phase 8 consolidation — deferred from the main cleanup pass.
- **Context:** With V2.1 deleted and V2.2 the only shipped version, the `v2/` subdirectory is vestigial. Cascading import-path changes across every file (`src/components/modals/V22RunEvaluationModal.jsx` has `import PrimeRadiant from '../../v2/PrimeRadiant.jsx'` and similar relative-path stubs throughout) make this a high-blast-radius change. Should happen in a dedicated atomic pass with a codebase-wide find-and-replace, followed by a full build + runtime verification.

### 50. Dead V2.1 handler sweep in V2App.jsx
- **Status:** Open
- **Effort:** M
- **Source:** Phase 8 consolidation — some handlers deferred for focused pass.
- **Context:** After the Phase 8 V2.1 modal + DetailPanel deletion, several V2.1-era handlers remain in `V2App.jsx` as dead code: `handlePanelViewChain`, `handlePanelExpandStack`, `handlePanelSurface`, `handleValidatePins`, `handleSubmitRequest`, plus state setters like `setClaimContext`, `setCascadeContext`, `setPublishNode`, `setReviseContext`, etc. Build tree-shakes these but they add file noise. Sweep them in a dedicated pass with no functional changes.

---

## Notifications

### 15. Notification system enhancements for V2.2 flows
- **Status:** Open
- **Effort:** ?
- **Source:** Phase 4 open question #4
- **Context:** Basic accept/decline notifications shipped in Phase 5; further refinements (amendment notifications via #102, proof-of-evaluation notifications, etc.) tracked separately.

### 16. Deep-linking from notifications
- **Status:** Open
- **Effort:** S
- **Source:** Phase 4 open question #4
- **Context:** Click on a notification should pan/select/open the relevant artifact. Several variants shipped through Phase 5–11 (acceptance, decline, amendment, EA-only request); a final audit + cleanup pass would fold any remaining gaps.

---

## Data Model & Content

### 17. Terminology reconciliation with client canon
- **Status:** Open
- **Effort:** M
- **Source:** Andrew's client feedback post-spec-review
- **Context:** Client analysis confirmed the architecture model holds, but noted deviations from their canon terminology. No structural changes required — just naming drift to reconcile.
- **Proposed fix:** After V2.2 stabilizes, update nomenclature (artifact names, field names, UI labels) to match client canon. Then update the architecture spec markdown to reflect the shipped reality. Client re-runs their analysis.

### 18. Third-actor Carol demo data expansion
- **Status:** Open
- **Effort:** S
- **Source:** Spec §7.3 (Story 3)
- **Context:** Carol's demo data currently covers only the AuditCo PRM audit scenario. Stories that walk through Carol disclosing her Eval Result to Bob may need richer seeded data.
- **Proposed fix:** Seed Carol with additional audit Claims and the full Story 3 flow (Carol → Bob proof-only disclosure).

### 19. Published standards data
- **Status:** Open
- **Effort:** S
- **Source:** Spec §17.1 (future direction), Phase 6 self-evaluation flow
- **Context:** Alice's self-evaluation story requires published Requirements Sets from external actors (OSHA, NIST, ISO). These exist in V2.1 demo data but need verification that they're reachable in V2.2.
- **Proposed fix:** Verify published standards are accessible from the Library modal in V2.2 mode. Add if missing.

### 36. Option B — view builder pulls disclosed Assets onto grantee canvas
- **Status:** Open
- **Effort:** M
- **Source:** Phase 6.5 #5 — chose Option A (resolve evidence Assets from shared dataset in the eval modal) as the smaller change. Option B is the architecturally consistent counterpart.
- **Context:** Today, counterparty Assets in scope of an active inter-party DA aren't pulled onto the grantee's canvas (only the Claim is, per §6 pull-in semantics). The eval modal works around this by resolving Assets directly from the shared dataset. Bob can't see the in-scope Assets on his canvas — he sees them only inside modals/panels.
- **Proposed fix:** Update `buildViewForActor` to also pull in Assets named in `da.scope.assetIds` for active inter-party DAs where the actor is grantee. Re-evaluate canvas density after; may pair with item #4 (Layout density improvements).

### 45. Real dot-cloud data sourcing
- **Status:** Deferred to Phase 14
- **Effort:** M
- **Source:** Phase 7 placeholder implementation
- **Context:** The three mock supplier clusters (NovaFab Inc, Precision Components Co, plus the real ChipCo cluster added in Phase 11A) are mostly visual-only. Replace with (a) real counts derived from any actor in the dataset with public-directory DAs, and (b) a realistic number of other parties once demo data grows. Also: the current random-seeded positions should transition to a force-directed or stratified layout at scale.

### 53. Session persistence via localStorage
- **Status:** Open
- **Effort:** S
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Context:** Current state (role, selection, provisional artifacts, notifications, in-progress modals) lives entirely in React memory. A page reload wipes everything. Persist the user-facing state slice to localStorage so demo sessions survive accidental refreshes. Be conservative about what's persisted — only what the user would expect to see after returning (role, provisionals, dismissedReqs), not ephemeral UI state (hover, pan/zoom mid-animation).

### 54. Total reset button in user menu
- **Status:** Open
- **Effort:** S
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Depends on:** #53 (session persistence — reset is the dual).
- **Context:** Once session state persists, demos need a clear "blow it all away" exit. Add a "Reset demo" item to the user menu dropdown (next to role switcher) that clears localStorage, clears in-memory provisionals, and re-plays the boot sequence so the demo returns to first-load state.

### 61. Factory audit — flag preservation through `makeX`
- **Status:** Open
- **Effort:** S
- **Source:** Phase 9A.3 preamble — handoff roster. **Medium priority.**
- **Context:** Factory functions (`makeAsset`, `makeClaim`, `makeParseResult`, `makeEvaluationResult`, `makeDisclosureAgreement`, `makeEvaluationAgreement`) should preserve runtime-only flags on passed-in data without dropping them. Known flags: `_isNew`, `_isEdgeEndpoint`, `_edgeEndpointSide`, `_aiOriginalValue`, `confidence`, `_isDeclined`, `_declineMeta`, `_showAsProvisional`. Future additions should similarly round-trip. Audit each factory's output object construction — spread-then-override is the safe pattern; explicitly listing known fields risks dropping new flags silently.

### 82. Parse Result DOT + layer placement
- **Status:** Investigation
- **Effort:** M
- **Priority:** **Design blocker**
- **Source:** Phase 9A.5 planning — deferred due to missing architectural decision.
- **Context:** Parse Results today are parent-layer nodes without a DOT (only Assets, Claims, and Eval Results carry `dot` per spec §2.6). Open questions: (a) should Parse Results also have DOTs (would make them first-class identity-anchored artifacts, enabling Parse Result transfer + provenance lineage)? (b) should Parse Results live on a child layer under their source Asset rather than the parent layer (they're always derived, never standalone)? Both questions blocked on client decision — DOT semantics touch canon X.1–X.10 and layer placement touches the canvas density story.

### 114. Umbrella Disclosure concept + second seller role with pre-existing DA to Bob
- **Status:** Partial (Phase 11A seeded ChipCo + warm-path DA; full umbrella semantics + Asset-hierarchy interaction still scoping)
- **Effort:** M
- **Priority:** High (enables #113's two-flow contrast — already shipped in 11C as the warm-path EA-only flow)
- **Source:** Andrew planning conversation post-9C — modeling realistic procurement relationships.
- **Context:** Real procurement doesn't ad-hoc request disclosure on every transaction. Mature buyer-supplier relationships have framework agreements covering visibility broadly, with specific actions exercised under those frameworks. The platform supports this via "umbrella" Disclosure Agreements at the Radiant Network layer — a standing DA from a seller to a buyer covering the seller's entire published catalog. Set up administratively (out-of-app, like a master service agreement at onboarding); not a UX flow within Radiant. Phase 11A added Dave/ChipCo as the second seller actor with a pre-existing DA to Bob; Phase 11C exercised the warm-path EA flow against it.
- **Remaining work:**
  - Full umbrella semantics — does it cover an entire catalog dynamically (auto-extend to new published Claims), or a static enumerated list?
  - Visual treatment at Directory layer — pairs with #132 (umbrella DA edge visualization on directory layer).
  - Cascade through Asset hierarchy — if a new Asset is added to a parent Program covered by an umbrella, does the umbrella auto-extend? Worth resolving as part of #131's design conversation.
- **Depends on:** Pairs with #132. Touches the Public Directory Cloud work (#43, #45).

### 115. Evaluation Agreement terms checkboxes + metadata schema
- **Status:** Partial (Phase 11C shipped two acknowledgments + expiry; remaining terms list deferred for Andrew's ideation pass)
- **Effort:** M
- **Priority:** Medium
- **Source:** Andrew planning conversation post-9C — making EA terms first-class.
- **Phase 11C ship:** Two acknowledgment booleans on `ea.terms` — `resultConfidentiality` and `attribution` — plus `evaluationDeadline` (defaults to 1 year, demo-only enforcement at evaluation time). Phase 11C.1 architectural correction: terms are responder-authored; the requester acknowledges pre-set commitments the Claim owner authored on the Claim's `acknowledgments[]` field (§10.3). EA carries `acknowledgmentsAccepted: [id, ...]` as an audit trail.
- **Remaining work (Andrew to ideate):**
  - "Permitted Requirements Sets" — multi-select from Bob's proposed list, plus Alice's option to add others
  - "Bob may re-disclose Eval Results to [no one / specific parties / public]" (paired with #141 EA permission gate for proof-only re-disclosure)
  - "Re-evaluation permitted [unlimited / N times / not permitted]"
  - "Self-evaluation by Alice required before Bob's evaluation [yes / no]"
- **Display:** EA Detail Panel shows the granted terms in a readable list. Amend EA modal (#108) lets Alice modify any term mid-flight.
- **Future enhancement:** attach an actual legal document (PDF / structured agreement) to the EA, alongside the structured terms.
- **Depends on:** Pairs with #141, #108. Scope finalization waits on Andrew's ideation pass on the term list.

---

## Process Flows

### 20. Selective Disclosure: fields vs. assets scope
- **Status:** Open
- **Effort:** S
- **Source:** Phase 4 open question #5
- **Context:** Spec §2.3 says "Selective Disclosure references specific parsed fields." V2.1 also allowed asset-level selection. Current V2.2 implementation is fields-only; Phase 11D.2 documented and wired the field-counts UI for grantees.
- **Proposed fix:** Confirm with client whether asset-level scope is still needed. If yes, add asset selection to Selective disclosure flow. If no, document the constraint as final.

### 55. Error states + edge-case review
- **Status:** Open
- **Effort:** M
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Context:** Each flow has happy-path error messaging but edge cases aren't systematically reviewed: PIN not found, self-PIN rejection, clipboard API failure, localStorage quota exceeded, network-offline (currently unused but will matter once a real backend arrives), modal cancelled mid-submit, role-switch during an open modal, decline/cancel from a revealed notification. Walk each V2.2 flow and surface where the failure mode is silent or ambiguous.

### 72. Extend Transferring to Claims and Eval Results
- **Status:** Open
- **Effort:** M
- **Source:** Phase 9A.4 — Assets-only scope limitation.
- **Context:** Canon X.5 applies uniformly across data elements; the UI patterns from Asset transfer (V22TransferAssetModal + notification Accept/Decline + `dot.lineage` append) should port directly to Claims and Eval Results. Open questions: does a Claim transfer bring its `referencedAssetIds[]` Assets along, or just the Claim? Does an Eval Result transfer require co-signing by the Claim owner (since the Eval Result is entangled with the Claim lineage)?

### 73. Transfer constraint — Asset backing a disclosed Claim
- **Status:** Open
- **Effort:** S
- **Source:** Phase 9A.4 — known limitation.
- **Context:** Today an Asset can be transferred even if it's the sole evidence backing an active Claim disclosed under an inter-party Disclosure Agreement. The counterparty's view would then show a Claim referencing an Asset that's no longer the Claim owner's to disclose. Options: (a) block the transfer with a hard error, (b) render a warning in the transfer review step listing the affected DAs and require acknowledgment, (c) force the Claim to auto-revise (drop the transferred Asset from `referencedAssetIds[]`) on transfer completion. Client decision needed.

### 75. Transfer timeout
- **Status:** Open
- **Effort:** S
- **Source:** Phase 9A.4 — recipient inaction creates an indefinite pending state.
- **Context:** Demo behaviour: pending transfers stay pending until the recipient accepts / declines or the sender cancels. Real implementation would need a configurable timeout (e.g., 14 days) after which pending transfers auto-decline. Also: a UI cue in the sender's TRANSFERRING badge showing days-until-timeout.

### 80. Accepted-transfer animation sequence on both canvases
- **Status:** Open
- **Effort:** L
- **Source:** Phase 9A.5 planning — deferred. Pairs with #71 and the broader animation-restoration phase.
- **Context:** On transfer accept, the recipient-side reveal (pan-to + NEW badge) works; the sender-side UX is abrupt — the Asset vanishes from the sender's canvas without a retreat animation. Target: choreographed sequence on both canvases — sender canvas shows the Asset fading out with a short "transferred" micro-animation; recipient canvas shows the Asset arriving with a reveal pulse. The Phase 9D.2 unravel primitive provides the leaving-canvas pattern; could be reused here.

### 81. Reciprocal acceptance notification audit
- **Status:** Open
- **Effort:** M
- **Source:** Phase 9A.5 planning — pairs with animation work (#80). Explicit known gap: Disclosure Request acceptance doesn't currently notify the requester; the notification is the trigger for the provisional → whole-node transformation animation (#71).
- **Context:** Inventory every party-to-party action that should reciprocally notify (Disclosure accept, Disclosure decline, Amend Claim, Amend Disclosure, Run Evaluation, Cancel Request, Transfer accept/decline/cancel, etc.) and verify each fires both directions. CLAUDE.md now codifies this as a convention ("Reciprocal notifications for all party-to-party actions") so new work should comply; this audit item closes the gap for existing flows.

### 88. Transfer cascade — Parse Results and dependent Claims on sender side
- **Status:** Open
- **Effort:** M
- **Priority:** **Medium — data integrity**
- **Source:** Phase 9A.5 QA — data integrity concern from 9A.4.
- **Context:** When an Asset transfers out, its Parse Results orphan on the sender's canvas (should transfer with the Asset — they're derivatives per canon). Claims referencing only the transferred Asset are broken (need user decision in the transfer review step — warn / auto-revise to drop reference / block). Related to #73 (transfer constraint on disclosed Claims) but distinct: #73 is about the counterparty's visibility of disclosed Claims post-transfer, #88 is about the sender's own orphaned derivatives and broken Claim references.

### 95. QS picker re-add files preserves custom labels
- **Status:** Investigation (root cause confirmed; fix blocked on V22CreateAssetModal restructure scope)
- **Effort:** S
- **Source:** Phase 9A.6.1 QA.
- **Context:** Root cause confirmed: V22CreateAssetModal's `handlePickerSelect` calls `setRows(newRows)` on every picker return, replacing the entire rows array and losing user-edited labels. Picker-only fix explored (accept `initialSelected` prop to pre-check files on re-open) but insufficient — the modal would still `setRows(newRows)` on return, overwriting labels. Clean fix requires editing V22CreateAssetModal's return handler to merge rows keyed by stable file identity (e.g., `filename + size` or `file.path`). Phase 9E-parallel.2 + Phase 10.1 both excluded V22CreateAssetModal restructure. Pairs naturally with Phase 10.2 hierarchy work where the row-construction path will be revisited.

### 98. Credit warning copy + add-credits modal link
- **Status:** Open
- **Effort:** S
- **Priority:** Medium
- **Source:** Phase 9A.6.1 QA.
- **Context:** When credits are insufficient, the CreditCostRow shows "Only 0 available" in red. Replace with "0 available" (drop the "Only") plus a small "Add credits →" link that opens a separate modal (layered above the current modal, on its own Backdrop). The sub-modal would offer demo credit grants (reuse V2App's existing +100 / reset credits affordances). Keeps the user in the Register/Claim flow rather than forcing a cancel-retry loop.

### 99. Create Claim picker: pre-selected + newly-registered Assets at top with NEW badges
- **Status:** Open
- **Effort:** S
- **Priority:** Medium
- **Source:** Phase 9A.6.1 QA.
- **Context:** In V22CreateClaimModal's Asset picker, pre-selected Assets (via `initialAssetIds` or nested Register auto-select) should float to the top of the list with a NEW badge so they're obvious. Clear the NEW badge after the user goes through a select-then-deselect cycle (confirming they've seen and considered the Asset). Pairs with the nested Register flow — freshly-created Assets land ticked but currently get lost in the full Asset list.

### 105. Run Evaluation modal: empty-evidence copy update
- **Status:** Deferred to Phase 12
- **Effort:** S
- **Priority:** Medium
- **Source:** Phase 9A.6.1 QA.
- **Context:** When a Claim has no evidence (no referenced Assets or no parseable content), the Run Evaluation modal's evidence pane shows a generic empty state. Split by role: owner: "There is no evidence associated with this Claim. Add evidence to self-evaluate."; non-owner: "There is no evidence associated with this Claim. Ask the owner of this Claim to add evidence to evaluate." Surfaces the right next step.

### 106. Remove evidence picker from Run Evaluation modal
- **Status:** Deferred to Phase 12
- **Effort:** M
- **Priority:** Medium
- **Source:** Phase 9A.6.1 QA — larger design question.
- **Context:** Evaluations are Claim-level, not Asset-level. Bob evaluates the Claim against requirements; all in-scope evidence is automatically included. When Alice amends the Claim (adds/removes Assets), Bob's evaluation is marked stale and re-runs against ALL evidence — no partial/selective combinations. Proposal: remove the evidence picker from V22RunEvaluationModal entirely; the modal becomes a review-rows-only surface. Pairs with #88 (transfer cascade) — both deal with Claim-vs-evidence boundary semantics and should be scoped together.

### 117. Re-Run Evaluation: permissive Asset selection with audit metadata
- **Status:** Deferred to Phase 12
- **Effort:** M
- **Priority:** High
- **Source:** Phase 9C QA observation, reversed mid-chat from the original locked-Assets framing to a permissive framing.
- **Context:** When Bob clicks "Re-Run Evaluation" on a Claim that has been amended (new Assets added, or existing Assets removed), the Asset selection step should be fully permissive — Bob can freely include, exclude, or add to the set of Assets being evaluated, including previously-evaluated ones. No locking. No hard rules preventing particular selections. This respects Bob's autonomy as evaluator: the platform's job is to record what was evaluated, not to enforce what *must* be evaluated. The originally-evaluated Asset set is pre-populated as the default selection, but it's a default, not a constraint.
- **Audit behavior:** Any deviation from the originally-evaluated Asset set is recorded in the new Eval Result's metadata — which Assets were added to this run, which were dropped, which carried over unchanged. Preserves evaluation traceability without constraining Bob's choices. Surfaced in the Eval Result Detail Panel under a "Changes from prior evaluation" section when applicable.
- **NEW badges:** Freshly disclosed Assets (since last evaluation) still carry a NEW badge in the Asset selection step, purely as an informational cue so Bob notices "there are new Assets available since I last evaluated." The badge is non-enforcing — Bob can still skip those Assets if he chooses.
- **Proposed fix:** V22RunEvaluationModal's evidence selection step — pre-populate with the previously-evaluated set as default selection. Render NEW badges on freshly-disclosed Assets. Allow full freedom to toggle any selection. On submit, diff the final selection against the previous evaluated set, store the diff in the new Eval Result's metadata. Surface the diff in the Eval Result Detail Panel.
- **Note on prior framing:** An earlier backlog draft framed previously-evaluated Assets as locked (non-removable in re-run), mirroring the AmendClaimModal lock where Alice can't remove evaluated Assets from her own Claim. That framing was reversed. The asymmetry is intentional: Alice locking evaluated Assets on her side preserves the integrity of evaluations Bob has already made; Bob's own re-run is a fresh evaluation event — he decides its scope.
- **Depends on:** Pairs with #106 (evidence picker removal). If #106 ships first and evaluation becomes Claim-level rather than Asset-picker-level, #117 reshapes around surfacing the diff in the review UI rather than via an explicit picker.

### 141. EA permission gate for proof-only re-disclosure (default-allow today)
- **Status:** Open
- **Effort:** M
- **Priority:** Future
- **Source:** Phase 11D.2 scoping — flagged as out-of-scope future polish.
- **Context:** Today, when a Claim is disclosed Selectively, the grantee can run an evaluation against the disclosed fields under a paired EA without any explicit permission from the grantor about whether the grantee can later re-disclose the resulting Eval Result via Proof-Only to a third party. The current model defaults to allow — POE DAs flow naturally as a Disclosure type. A future iteration may want to gate this at EA terms time (a `terms.allowProofOnlyRedisclosure` boolean the grantor authors during response, similar to other responder-authored terms per §10.5). Pairs with #115 (terms metadata schema growth) and §11.6a (warm-path EA-only response flow).
- **Proposed fix:** Add `terms.allowProofOnlyRedisclosure` to EA terms schema (default true to preserve current behavior). Surface as a checkbox in `CombinedResponseModal` step 3 alongside expiry. When false, suppress Proof-Only entries in the grantee's options when they later attempt to share their Eval Result.

### 160. Production: Option C acknowledgment audit semantics for EAs
- **Status:** Investigation
- **Effort:** L
- **Priority:** Future (production data layer)
- **Source:** Phase 11E.1 scoping — out-of-scope until production data layer is built.
- **Context:** Phase 11E.1 (#108) shipped Amend EA with **Option B** semantics: acknowledgments live on the underlying Claim, and editing them via Amend EA mutates the Claim directly. The EA's `acknowledgmentsAccepted` audit-trail field preserves what the Evaluator originally accepted, but doesn't carry a snapshot of the acknowledgment text itself. Two known limitations: (1) **Multi-EA implicit propagation** — when a Claim has Evaluation Agreements to multiple grantees, editing acknowledgments via one EA changes effective terms for all grantees, but only the targeted EA's grantee receives a `v22-ea-amendment` notification. (2) **Lineage chaining** — each amendment record stores `termsBefore.evaluationDeadline` for diffing against the *current* EA terms; older amendments don't chain through.
- **Proposed fix (Option C, production target):** Snapshot acknowledgments per-EA (`acknowledgmentsAtTimeOfRequest: [{ id, title, description }]` separate from the live Claim state). Multi-grantee notification fan-out when any current grantee's snapshot is amended. Chain `termsBefore` through prior amendments so the diff display is correct for older entries. Migration: snapshot the current Claim's acknowledgments onto each existing EA at migration time; subsequent amendments operate on the snapshot.
- **Architecture spec coverage:** §11.2a documents the full Option B vs Option C shape.

---

## Spec Updates

### 24. Update spec §4.4 with actual selected-edge values
- **Status:** Open
- **Effort:** S
- **Source:** Phase 3 deviation, confirmed by Andrew in Phase 4 review
- **Context:** Spec specifies 40% white blend + 0.5px stroke increase; implementation empirically required 65% / +1.5px for visibility on dashed/dotted edges. The 11D.x Changelog entries reflect the shipped values; this item tracks reconciling §4.4 prose itself.

---

## Future Features (from V2.1 backlog, carried forward)

Items from the V2.1 backlog (`radiant-v2-archive.md`) that remain relevant post-V2.2 migration:

### 26. Cascading Disclosures
- **Status:** Deferred to Phase 13
- **Effort:** XL
- **Source:** V2.1 backlog #12
- **Context:** When Alice discloses an Asset to Bob, and Bob creates a Claim referencing Alice's Asset, the cascading disclosure behavior should propagate correctly through Bob's Claim to his own counterparties.

### 27. Search + aggregate metrics/filters
- **Status:** Open
- **Effort:** M
- **Source:** V2.1 backlog #6
- **Context:** At scale, the canvas becomes hard to navigate. A search surface (find a PIN, filter by owner, filter by disclosure type) becomes useful.

### 28. Amend proof-only: select eval nodes not evidence
- **Status:** Open
- **Effort:** M
- **Source:** V2.1 backlog #18
- **Context:** Proof-only disclosure amendments currently operate on evidence (the AmendDisclosureModal's evidence list). Should instead operate on Eval Result selection since proof-only shares eval results, not evidence — Phase 11D.3 wired the response-flow side correctly (subject = Eval Results); the amend flow needs the same shape.

### 30. Network Events Log
- **Status:** Open
- **Effort:** L
- **Source:** V2.1 backlog #24
- **Context:** Time-series log of all events (creations, disclosures, evaluations, amendments) across the user's network. Useful for audit and analysis.

---

## Exploratory / Experimental

### 31. Parse-less app branch (§17.1 unification)
- **Status:** Investigation
- **Effort:** XL
- **Source:** Andrew's note from client architecture discussion
- **Context:** Thesis: Parse Templates and Requirements Sets can be unified because Parsing is essentially Evaluation without criteria. A "self-evaluation with unified templates" architecture could replace Parsing entirely. Explicit future direction per spec §17.1. Implement in V2.3 or later.

### 32. Multi-party agreements
- **Status:** Investigation
- **Effort:** XL
- **Source:** Spec §17.4
- **Context:** Current Agreements are two-party (grantor + grantee). Client model hints at support for additional participants. Keep `participants[]` array extensible in schemas.

### 43. Clickable Directory Layer dots
- **Status:** Deferred to Phase 14
- **Effort:** L
- **Source:** Phase 7 scope boundary (spec §8.2 — "visual density only in V2.2")
- **Context:** Each dot is backed by a public-directory Claim artifact already, so per-dot interactivity is a pure wiring task: on hover show the Claim name + owner + posted date; on click open a read-only preview panel with a "Request Agreement" CTA. Architecturally the dot data should come from a view builder helper (not hard-coded) so the three mock supplier clusters disappear once more real parties exist.

### 47. Real AI Shopper result streaming
- **Status:** Deferred to Phase 14
- **Effort:** L
- **Source:** Phase 7 placeholder implementation
- **Context:** The mock agent returns results in a single 2.2s batch. A real LLM-backed shopper would stream candidates as the search runs. Keep the split-screen pattern, but let rows appear one at a time with a short delay, each with a per-row confidence score that updates as more context is gathered. UI shape is already designed to absorb this — `results` array just needs incremental append instead of single assignment in `runMockSearch`.

### 120. Reference published Requirements Sets on a Claim (non-binding)
- **Status:** Deferred to Phase 12
- **Effort:** M
- **Priority:** Low
- **Source:** Client planning discussion post-9C.
- **Context:** Today Claims have no formal relationship to Requirements Sets — the relationship is established only when someone evaluates the Claim against a Requirements Set. The client suggested that a Claim owner (or anyone) could reference owner-created or publicly published Requirements Sets *on the Claim itself*, as a non-binding signal of intent: "this Claim is built to satisfy these standards." This would surface in the Claim's Detail Panel as a list of referenced Requirements Sets.
- **Implications:** Opens up a discoverability path — counterparties browsing the Public Directory could filter Claims by referenced standards. Pairs conceptually with #114 umbrella disclosures + #115 EA terms (if a Claim references a Requirements Set, an EA over that Claim is pre-suggested against that same set). Also pairs with the unified Library (#25, shipped in 10.3).
- **Open questions:** Can the reference change over the Claim's lifecycle? Who's authoritative for the reference (the Claim owner always, or does the Claim inherit references from its Assets)?

### 121. Evaluate a Claim against multiple Requirements Sets simultaneously
- **Status:** Deferred to Phase 12
- **Effort:** L
- **Priority:** Low
- **Source:** Client planning discussion post-9C.
- **Context:** Currently Run Evaluation is 1:1 — one Claim, one Requirements Set, one Eval Result. Real evaluations often cover multiple standards (e.g., "does this part meet both MIL-STD-810 AND RoHS AND ITAR export-control?"). Extending the modal to accept N Requirements Sets would produce either N distinct Eval Results (one per set) or a single Eval Result that rolls up multi-set satisfaction.
- **Open design questions:**
  - Single Eval Result (multi-set) vs. multiple Eval Results (one per set)? The former is cleaner in the netgraph; the latter preserves per-set separability for partial supersede/amend.
  - If multi-set, how does the Eval Result Detail Panel present per-set breakdown?
  - Interaction with #117 (permissive re-run) — what if Bob originally evaluated against Set A, and now wants to expand to Set A + Set B?
- **Depends on:** Pairs with #106 (remove evidence picker — if evaluations are Claim-level, multi-Set-at-once is more tractable).

### 122. Remove evidence from a Claim despite prior evaluation (e.g., expired license)
- **Status:** Deferred to Phase 12
- **Effort:** M
- **Priority:** Low
- **Source:** Client planning discussion post-9C.
- **Context:** Today the platform locks evaluated Assets — they can't be removed from a Claim's scope once referenced by an Eval Result, to preserve the integrity of historical evaluations. Client's scenario: an Asset like an expired operating license becomes invalid over time. The Claim owner should be able to remove the expired Asset, which would mark prior Eval Results as needing re-evaluation.
- **Implications:**
  - Breaks a current platform invariant (evaluation locks on the Claim-owner side). Needs to decide the new invariant — probably "removal triggers supersede-required state on prior Eval Results."
  - Adds a new Eval Result status beyond ACTIVE / SUPERSEDED — perhaps STALE or REQUIRES_RE-EVAL.
  - Counterparty-side effect: Bob's old Eval Result on Alice's Claim is now marked STALE. Notification to Bob. His canvas might badge it. If he cares, he re-runs.
  - Interaction with transfer flows (#73): if an Asset backs a Claim that's been disclosed, removing it has amend-cascade implications.
- **Open design questions:** Scope carefully before implementing — this is a model-level change, not a UX addition.

### 123. "Reverse AI Shopper" — publish an Evaluation Agreement as an open RFP
- **Status:** Investigation
- **Effort:** L
- **Priority:** Low
- **Source:** Client planning discussion post-9C.
- **Context:** Flips the current AI Shopper model. Today, Bob (buyer) asks the platform "who can provide X?" and discovers sellers' published Claims. Proposed: Bob publishes an Evaluation Agreement as an RFP referencing specific Requirements Sets — "I'm looking for suppliers whose Claims can satisfy these requirements." Sellers discover the RFP, create Claims targeted at satisfying it (or point existing Claims at it), and engage the EA as grantees.
- **Implications:**
  - EAs become first-class discoverable objects in the Public Directory, not just downstream of disclosures.
  - Creates a new Claim-creation flow ("create a Claim targeting RFP X") — possibly auto-populates referenced Requirements Sets.
  - Shifts the directionality of the whole procurement model — sellers respond to buyer demand rather than buyers discovering seller supply.
  - Natural pair with #114 (umbrella disclosure) — a mature buyer with umbrella relationships could publish RFPs against their umbrella supplier pool without needing wide public visibility.
- **Open design questions:** Big one — does this change Radiant from "transparency infrastructure" to "procurement marketplace"? That's a positioning shift worth discussing with the client before scoping implementation.

### 129. Terminal-style scrambling-text erase during unravel
- **Status:** Open
- **Effort:** M
- **Priority:** Low
- **Source:** Phase 9D.2 scoping discussion — Andrew's deferred refinement to the unravel animation.
- **Context:** The Phase 9D.2 unravel currently fades content via a coordinated CSS keyframe — type label, name, owner row, and minibar all dissolve into transparency together. A more distinctive treatment Andrew flagged: replace the content fade with a scrambling-text "terminal erase" effect — characters flicker through a randomized glyph sequence (e.g., latin → katakana → bullets → empty) before each line clears, evoking a CRT terminal wipe. Reads as "data being scrubbed" rather than "card fading away."
- **Implementation sketch:** add a per-character text-scramble pass during the existing 600-1000ms unravel window. Could use a small RAF helper that mutates innerText on a target span every ~30ms with progressively-more-erased glyph pools. The text targets would be: type label first, name second, owner row third (each ~150-200ms staggered to match the existing Stage 3 spec). Need to be careful not to fight React's reconciliation — likely requires uncontrolled DOM access via ref during the animation window. The keyframe-driven opacity fade still runs underneath as the final clear.
- **Why it's deferred:** the current coordinated-fade unravel already meets the "card visibly leaves the canvas" bar set by the original spec. The scrambling text is a refinement that adds tonal character but doesn't change information conveyance. Worth picking up alongside other animation polish (#110 V2.1 marching ants restoration; #80 transfer accept reveal).
- **Depends on:** Phase 9D.2 unravel primitive (already shipped).

### 130. Asset hierarchy — squeeze child Assets into rows aligned with their parent
- **Status:** Open
- **Effort:** M
- **Priority:** Low
- **Source:** Phase 10.2 scoping — flagged as deferred polish.
- **Context:** Phase 10.2 places each owned Asset at `COL_OWN_ASSET + (depth × ASSET_COL_GAP)`. Within a depth group, vertical position uses the asset's index inside that group (root Assets stack `i*ROW_STEP`, depth-1 children also stack `i*ROW_STEP` within their column). Visual consequence: when you have a Sentinel-4 root and 3 children, the Sentinel-4 root sits at `y=0` and the three children sit at `y=0, 260, 520`. The children don't visually align with their parent — they spread vertically as if they were independent. Tighter UX would group children directly to the right of their parent, occupying rows adjacent to the parent rather than starting from `y=0` in the next column.
- **Implementation sketch:** instead of `i = peers.indexOf(asset)` for the within-depth row index, walk the hierarchy from roots and assign Y positions in tree-traversal order — each child cluster's first member sits at the parent's Y + vertical offset, subsequent siblings stack below. Roots without parents stack normally.

### 131. Asset dismissal flow with re-parenting + Claim-reference protection
- **Status:** Open
- **Effort:** L
- **Priority:** Medium
- **Source:** Phase 10.2 scoping — out-of-scope acknowledgement.
- **Context:** V2.2 has no Asset dismissal flow today — Assets are registered and persist. With Phase 10.2 hierarchy, dismissal raises new questions: (1) what happens to children of a dismissed Asset? Options: cascade-dismiss them, re-parent to grandparent, or re-parent to Actor (root). (2) What about Claims that reference the dismissed Asset? Cannot leave dangling references — either block dismissal or auto-revise Claims to drop the reference (requires user confirmation). (3) Effect on Parse Results / Eval Results derived from the Asset?
- **Design decisions needed:**
  - Cascade vs. re-parent semantics on dismissal — likely user choice in a confirmation modal.
  - Claim-reference protection — block dismissal vs. auto-revise Claim to drop the reference.
  - Audit trail — should dismissed Assets be retrievable later, or hard-deleted?

### 132. Umbrella DA edge visualization on directory layer
- **Status:** Deferred to Phase 14
- **Effort:** M
- **Priority:** Medium
- **Source:** Phase 11A scoping.
- **Context:** Phase 11A seeded a warm-path umbrella DA from ChipCo to GovCo. Phase 11B's cluster-click flow materializes a single Claim card on top of the cluster, but doesn't visualize the underlying umbrella DA itself — the relationship Bob has with ChipCo as a whole isn't drawn. A future phase could render an edge from the active actor's corner card to the cluster (or to its centroid), styled like the parent-layer DA edges (color + dash pattern by SDA type), making the umbrella relationship visible at a glance. Pairs with #114 (umbrella disclosure data model) — visualization should follow the schema work.

### 133. Passive Evaluation Agreement expiry notifications
- **Status:** Open
- **Effort:** S
- **Priority:** Low
- **Source:** Phase 11C scoping — flagged in the task brief as out-of-scope and filed as future polish.
- **Context:** Phase 11C added a demo-only `evaluationDeadline` check at Run Evaluation time — clicking Run Evaluation on an EA whose deadline is past blocks with a copy hint. There's no proactive surface for EA expiry: no "your EA expires in X days" notification, no "your EA expired Y days ago" follow-up. Production would handle this via platform eventing; the prototype could surface lightweight pre-expiry / post-expiry notifications on the grantee's inbox (`v22-ea-expiring-soon`, `v22-ea-expired`) for demo polish.
- **Proposed fix:** Periodic check (in-memory, on role load or render) over the active actor's EAs. Surface a `v22-ea-expiring-soon` notification at `deadline - 7 days` and a `v22-ea-expired` notification at `deadline + 0`. Click deep-links to the Claim. Both auto-dismiss when the user takes terminal action (e.g., requesting a fresh EA via the warm path).
- **Depends on:** Pairs with #115 (EA terms metadata schema).

### 163. Anchor Asset picker for EA-only requests on Directory Layer Claims
- **Status:** Deferred to Phase 14
- **Effort:** M
- **Source:** Phase 11E.1.6 QA — Andrew noticed the warm path's hardcoded anchor Asset.
- **Context:** When Bob requests an Evaluation Agreement on a Claim he discovered via the Radiant Network (Directory Layer), the resulting EA pulls the Claim onto Bob's canvas as a child of a hardcoded anchor Asset (currently Bob's Avionics Module). Bob should be able to choose which of his Assets to anchor against — the anchor Asset determines where the Claim materializes on his netgraph and which evidence the Claim's evaluation will reference.
- **Proposed fix:** Add an anchor-Asset picker step to `EARequestModal` when the request originates from a Directory Layer entry point. Picker defaults to no selection (per CLAUDE.md UX pattern: "Multi-select artifact pickers that require at least one selection… default to zero selected"). User explicitly chooses an Asset before continuing to the expiration + acknowledgments step.
- **Out of scope for this item:** Multi-anchor Claims (one Claim associated with multiple Assets on the requester's side) — future consideration if the model supports it.
- **Depends on:** Phase 14 Directory Layer work — pairs naturally with #43 (Clickable Directory Layer dots) and #46 (Corner-node morph on Directory entry/exit) since those define the entry-point UX.

### 162. EA revocation copy + Directory Layer post-revocation visualization
- **Status:** Deferred to Phase 14
- **Effort:** S (copy) + part of #132 (visualization)
- **Source:** Phase 11E.1.3 QA — Andrew's architectural note on revocation semantics.
- **Context:** When a grantor revokes an Evaluation Agreement, the affected Claim node is removed from both parties' netgraphs (the grantor's immediately; the grantee's after notification → Detail Panel notice → Dismiss). However, the underlying Disclosure Agreement persists — the grantee retains visibility into the Claim's Assets / fields / Eval Result per the DA's disclosure type, just no longer pulled onto their canvas. Today this creates a "where did it go" UX gap on the grantee side: the DA is still active but neither party's netgraph reflects the relationship visually.
- **Architectural resolution:** The DA-only relationship surfaces on the Radiant Network (Directory Layer). The grantee's corner card carries a disclosure edge to the grantor's cluster (paralleling #132 Umbrella DA edge visualization), styled by DA type. The Claim itself remains visible as a dot in the grantor's cluster via the Public Directory mechanism when the Claim has a published listing. The "still have access via DA" relationship lives in the Directory rather than on the netgraph.
- **Proposed fix (two parts):**
  1. **Copy update (Phase 14, alongside #132):** EA revocation flow's grantee-side notice gains a line referencing where the DA lives post-revocation, e.g. "Your Disclosure Agreement to this Claim remains active. View it in the Radiant Network." Same on the grantee-side Dismiss confirmation.
  2. **Visualization (already scoped under #132):** Render the DA-only edge from grantee's corner card to grantor's cluster on the Directory Layer.
- **Depends on:** Pairs with #132 (Umbrella DA edge visualization) and #43 (Clickable Directory Layer dots). Both are Phase 14.

---

## Exploratory Ideas Not Yet Scoped

- Animation refinements — subchain morph, surface shared-element (V2 backlog #3)
- Chain effect flagging — counterfeit parts use case (V2 backlog #35)
- Claim templates — bulk-create Claims across Assets (V2 backlog #28)

---

## Completed

(All items marked ✅ Complete, ✅ Verified, or ✅ Superseded — preserved with their Status entries, phase references, and commit hashes for archive value. Phase 11.5 hygiene pass moved them to this section to keep the topic sections above focused on remaining work.)

### Notifications — completed

### 102. Disclosure amendment notifications missing on counterparty side
- **Status:** ✅ Complete (Phase 11E.2). Three deliverables: (a) the existing DA-amendment notification was renamed `v22-amendment` → `v22-da-amendment` (parallel to `v22-ea-amendment`), with click handler updated to deep-link directly to the DA Detail Panel via `setOpenAgreement({ kind: 'disclosure', disclosureAgreementId })` and badge label `DA AMENDED`. (b) New `v22-claim-amendment` type fires from `handleV22AmendClaimSubmit` to every counterparty with an active DA on the affected Claim — fan-out, deduped by party; "active" excludes provisional, declined, revoked, and expired DAs. Click pans to the Claim and opens its node Detail Panel; badge `CLAIM AMENDED`. (c) Notification body copy now includes the Claim name + optional `(Note: …)` suffix for both new types. Architecture spec §7.4 notification table extended with `v22-da-amendment` + `v22-claim-amendment` rows; §11.2 prototype notes updated; §6 worked example + §11.3 evaluation-amendment narrative now reference both new types.

### Visual & Rendering — completed

### 139. Edge geometry animation during reveal flip
- **Status:** ✅ Complete (Phase 11E.3). New animation primitive `src/v2/animations/edgeDrawIn.js` exports `playEdgeDrawIn({ nodeId, canvasRef, durationMs })`. New `playEdgeDrawIn(nodeId, durationMs = 500)` method on V2Canvas mirrors `playEdgeRetract` in reverse: per-frame point-trim grows the visible curve from a 2-point stub at the anchor to full length over `durationMs`, with material opacity ramping 0 → base over the first 30% so the edge fades in at the head of the draw. `startReveal` in V2App.jsx schedules the draw-in at `setTimeout(500ms)` so it fires after the reveal pan settles and completes before the flip starts (`PHASE_FLIP_MS = 1100`). The edge's `_showAsProvisional` stamp clears at flip-midpoint via the existing reveal infrastructure, so the dashed-grey provisional edge becomes its final typed style at the visual hand-off — capturing the spirit of "typed edge draws in" using the existing single-edge-with-stamp architecture rather than maintaining two parallel edges.

### 1. Warmer grey border on all nodes
- **Status:** ✅ Complete (Phase 9A). `warmBorder = color-mix(in srgb, var(--accent-indigo) 22%, var(--border))` — reads as a cool indigo-grey that stops node terminations from fading into the dark canvas without competing with indigo edges. Red UNSAT border treatment unchanged.

### 2. Visual distinction for counterparty-pulled-in nodes
- **Status:** ✅ Complete (Phase 9A). Counterparty cards (where `node.owner !== activeParty`, excluding Actor nodes) render a muted tint: `color-mix(in srgb, var(--bg-card) 82%, var(--bg-deep))`. Subtle flattening, no opacity/chip changes.

### 3. Subtle de-emphasis for internal/ownership edges
- **Status:** ✅ Complete (Phase 9A). Internal edges (where `edge.grantorParty === edge.granteeParty`, carried through from `deriveAgreementEdges`) now render at 70% of the default stroke width. Selected and NEW edges keep their emphasis regardless.

### 5. Node label truncation legibility
- **Status:** ✅ Complete (Phase 9A, expanded). Claim and Eval Result names wrap to two lines via `-webkit-line-clamp: 2`; Actor and Asset names stay on one line with ellipsis. Also in Phase 9A: vertical spacing above the name increased so the `CLAIM` / `EVAL RESULT` type badge no longer crowds the name, and the health minibar's wrapper flex-space-between-s the inner content so the whitespace between the owner row and the card edge equalises.

### 40. Node card action button reassessment post-migration
- **Status:** ✅ Complete (Phase 9A). V2.2 nodes route through a new `V22ActionBar` component that mirrors the Detail Panel footer one-to-one per type: ASSET (owner) → Request Agreement + Parse Evidence + Create Claim; CLAIM (owner) → Amend Claim + Self-Evaluate; CLAIM (non-owner + active EA) → Run Evaluation; EVAL RESULT (owner, not superseded) → Re-run Evaluation; PARSE RESULT / ACTOR → none. Single dispatch prop `onV22CardAction(actionName, node)` routes from card click → V2Canvas → V2App's action handlers, the same handlers V22NodeDetailPanel's footer fires. Legacy V2.1 ActionBar is retained as fallback for non-V2.2 nodes.

### 52. "Human-validated" indicator on Eval/Parse review rows
- **Status:** ✅ Complete (Phase 9A item 10). `_aiOriginalValue` snapshot tracked per row from initialization (set to the AI's extracted value, or empty string for fresh rows). When `row.value !== row._aiOriginalValue` the modal + Detail Panel render a small amber pencil SVG next to the ConfidenceBadge with the tooltip "Human-edited from AI's original extraction." Persisted onto the submitted Parse Result `fields` and Eval Result `results` so the Detail Panel can render the pencil later. AI confidence remains unchanged by human edits (the Phase 8.5 rule).

### 60. Dot-LOD alignment with background dot matrix
- **Status:** ✅ Complete (Phase 9E-parallel initial approach → 9E-parallel.1 correction, commit 7d03982). Initial 9E-parallel approach lowered background opacity at base depth — wrong direction per Andrew's feedback: background matrix is intentional visual infrastructure and should stay at full brightness. 9E-parallel.1 corrected: restored uniform background opacity across all depths (0.28 dark / 0.32 light); brightened AssetNodeDot inner-circle ring stroke 1px → 1.5px and color `WARM_BORDER` (40% indigo blend) → `color-mix(in srgb, var(--accent-indigo) 70%, var(--border))`. Grid alignment was already in place via the existing `snapToGrid` function — no alignment work required. Contrast between nodes and background is now carried by the node dot's ring, not by dimming the background.

### 63. Mini/dot LOD warmer borders
- **Status:** ✅ Complete (Phase 9A.1.5). `WARM_BORDER` (40% indigo blend) extended to mini and dot LOD renderings — mini cards now match full cards; dots grow a 1px indigo ring so they don't fade into canvas at zoom-out. Red UNSAT borders unchanged.

### 100. Mini/dot LOD action buttons on hover
- **Status:** ✅ Complete (9A.6.1; reverted to click-only behavior in 9A.6.1.1 — hover-to-show was visually present but impractical as the pointer couldn't reach the buttons before they dismissed). Action bar renders at mini/dot LODs on node selection, matching full-card LOD behavior. `onV22CardAction` threading through AssetNodeMini + AssetNodeDot from 9A.6.1 is retained — that plumbing remains needed for click-selected action bar dispatch. The `forceActionBar` prop on AssetNode was removed.

### 107. Border shorthand vs. longhand style warning
- **Status:** ✅ Complete (Phase 9E-parallel, commit b29fdc9). Original diagnosis was "shorthand `border:` paired with a side-specific longhand like `borderTopColor`." Code audit during 9E-parallel found no such pattern in AssetNode.jsx. **Actual root cause:** React's style reconciler has trouble tracking `border-color` transitions when the border is set via shorthand `border: ...`. Fix: convert every shorthand paired with a `transition: border-color` to longhand (`borderWidth` + `borderStyle` + `borderColor`). Four call sites fixed in AssetNode.jsx: full-card selection border, full-card main div, mini selection border, mini main div. Dot-card borders and other static non-transitioning borders left as shorthand.

### 124. Revoked node unravel animation sequence
- **Status:** ✅ Complete (Phase 9D.2; revisited in Phase 9D.2.1 to ship the proper staged choreography + revoked-edge persistence + visibility-based pan skip; further refined in 9D.2.2 / 9D.2.3 / 9D.2.4 / 9D.4.1).
- **Phase 9D.2 (initial ship, 2026-04-26):** `src/v2/animations/unravel.js` exports `playUnravelAnimation` returning a Promise. Stages: (0) pan/zoom to node, (1) Three.js edge retract, (2-4) CSS card unravel. New V2Canvas methods: `getNodeWorldPos`, `isFocusedOnPoint`, `playEdgeRetract`. New `v22UnravelingNodeId` state in V2App. Wired into `handleV22DismissRevoked` + `handleV22DismissOrphanedEvalResult` — both `async` and `await` the primitive before mutating state.
- **Phase 9D.2.1 (revision, 2026-04-27):** revoked DAs/EAs persist as styled edges through Dismiss; new `isNodeVisibleInViewport` accounts for Detail Panel offset; three layered keyframes replace the single coordinated keyframe (border erosion + per-row content fade + card-level fade).
- **Phase 9D.2.2 (corrections, 2026-04-27):** revoked-edge color persistence in `applyEdgeStylingRef`; `unravelingRef` suppresses selection-pan effect; `SLOW_MODE_MULTIPLIER` constant for QA.
- **Phase 9D.2.3 (refinements, 2026-04-27):** point-trim edge retract (was lerp); deselect + panel close before unravel; clip-path right-to-left text wipe.
- **Phase 9D.2.4 (correction, 2026-04-27):** suppress edge rebuild during the unravel via `unravelingRef.current` early-return on the edge-rebuild useEffect.

### 127. Tooltip arrow alignment
- **Status:** ✅ Complete (Phase 9D.1.2 W2). Tooltip arrow sat ~ARROW_SIZE px off-center on the Agreements Section Amend / Revoke rows. Fix in `Tooltip.jsx`: replace `left: '50%'; transform: translateX(calc(-50% + Xpx))` with direct pixel math `left: calc(50% - ARROW_SIZEpx + Xpx)` (no transform). Arrow center now sits exactly at the anchor center regardless of browser's reference-box interpretation.

### Edge Interactions — completed

### 7. Hover tooltip conflicts with edge menu position
- **Status:** ✅ Complete (Phase 9B). Resolved by unifying the hover tooltip and the click-menu into a single `EdgeHoverMenu` component — two modes (`hover` + `pinned`) on the same component rather than two competing surfaces.

### 8. Glow indicators on edge-connected nodes
- **Status:** ✅ Complete (Phase 9A). The `v22DataWithReveal` memo stamps `_isEdgeEndpoint: true` on the two nodes touched by the currently-selected edge; AssetNode applies a static indigo glow that sits 5px outside the card border. Distinct from the selected-node amber border so users can tell "I selected this" apart from "this is an edge endpoint."

### 10. "NEW" badge and pan-to-node on provisional creation
- **Status:** ✅ Complete (Phase 6 carry-over fix; clarified Phase 9A.4 preamble). `_isNew` persists on the node until the user deselects it; the NEW badge renders for the same duration. The 900ms reveal is a separate fade-in animation on initial render — not a NEW-badge timer. `setV22PanToClaimId` pans to the new provisional Claim on the requester's canvas.

### 59. Edge hover overhaul — tooltip IS the menu, on-edge dot, click to pin
- **Status:** ✅ Complete (Phase 9B). Unified into a single `EdgeHoverMenu` component with two modes: `hover` (cursor-anchored, pointer-events disabled, dismisses on mouse-leave) and `pinned` (click-point-anchored, clickable rows, dismisses on menu action / different edge / empty canvas click). Old `EdgeMenu.jsx` deleted.

### 62. Carry-over defects from 9A.2
- **Status:** ✅ Complete (Phase 9A.3 Gate C). All four defects addressed (dot-LOD endpoint ring re-geometred; bell chrome tooltip; in-modal tooltip z-index bumped 6000 → 10100).

### 68. Hashing / processing sequence UI per file
- **Status:** ✅ Complete (Phase 9A.6 Gate B; reconciled with V2.1 pattern in 9A.6.1). Three-state sequence per file row — `pending` → `hashing` (amber spinner ~1000ms) → `endorsing` (blue spinner ~1200ms) → `done` (green ✓ + truncated CopyBadge). Multi-file stagger 600ms.

### 76. Transfer accept — ownership edge on recipient canvas
- **Status:** ✅ Complete (Phase 9A.5 Gate A). On transfer accept, `handleV22TransferAccept` now emits a replacement ownership DA with grantor = recipient. `mergeById` in `mergeProvisionals` handles id-based replacement.

### 83. Claim-to-owner edge redundancy
- **Status:** ✅ Complete (Phase 9A.5 Gate C). Removed the Actor → Claim ownership edge branch from `deriveAgreementEdges`. Ownership cascades through referenced Assets (spec §3.4 requires `referencedAssetIds.length >= 1` on every Claim). Ownership DA stays in state for provenance.

### Detail Panels — completed

### 108. Missing Amend Evaluation Agreement modal
- **Status:** ✅ Complete (Phase 11E.1). New `AmendEvaluationAgreementModal.jsx` mirrors the AmendDisclosureModal pattern with two amendable surfaces: `terms.evaluationDeadline` and the underlying Claim's `acknowledgments[]`. New factory `makeAmendedEvaluationAgreement` + helper `diffAcknowledgments`. `makeEvaluationAgreement` extended with `amendments[]`. New notification type `v22-ea-amendment` (single-grantee, informational) deep-links to the Claim + opens the EA Detail Panel. EA Detail Panel: new Amendments section between Status and paired-DA navigation; Amend footer button gated to grantor + active + non-revoked. Acknowledgments shipped with **Option B** semantics (acknowledgments live on the Claim — editing mutates the Claim directly while the EA's `acknowledgmentsAccepted` audit trail is preserved). Multi-EA implicit propagation + lineage chaining are documented limitations; Option C (per-EA snapshots, multi-grantee fan-out, chained lineage) deferred to production via #160. See architecture-spec §11.2a for the full shape.

### 12. Agreement amend actions accessible from node Detail Panels
- **Status:** ✅ Superseded by #111 (Phase 9C shipped the Agreements section in Detail Panels; Amend on DAs wired from the row, Amend on EAs shipped in Phase 11E.1 #108).

### 64. Asset DOT / hash / URI click-to-copy badge
- **Status:** ✅ Complete (Phase 9A.4 preamble). Applied `<CopyBadge value={...} truncated />` treatment to three long identifiers on the Asset Detail Panel: owner DOT, file hash, file URI. Null-value guard handles Assets registered via Phase 9A.3's Create Asset flow where `file.hash` is null pending a real hashing implementation.

### 87. Raw JSON tab on expanded Detail Panel modal
- **Status:** ✅ Verified (Phase 9A.5 Gate C). No code change required at the time. The expanded Detail Panel modal referenced in the original task does not exist in the V2.2 codebase as of 9A.5 — it was removed during Phase 8 cleanup. (Phase 11B subsequently restored an `ExpandedArtifactModal` with Output + JSON tabs.) Lineage rendering tracked separately as #74.

### 89. Actor Detail Panel DOT click-to-copy
- **Status:** ✅ Complete (resolved by removal in Phase 9A.6.1.1). The DOT row was removed from the Actor panel entirely. DOTs per canon X.1 identify data elements (Assets / Claims / Eval Results), not actors — actors have DIDs per canon X.2. Earlier 9A.6 + 9A.6.1 work on this row (CopyBadge wrapping, `partyDot` read fix) is superseded.

### 101. Actor Detail Panel narrative fields cleanup
- **Status:** ✅ Complete (Phase 9A.6.1.1 Fix 1). Role, Vertical, and User rows removed from V22ActorPanel body. Role labels remain in the user-menu role switcher.

### 103. Referenced Assets missing from Claim Detail Panel on counterparty canvas
- **Status:** ✅ Complete (Phase 9A.6.2.1). Root cause: two call sites in V2App.jsx read `buildV22SharedArtifacts()` without merging provisionals, so newly-registered Assets never reached the counterparty view. Fix: replace with `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)` at both sites. Audit of 13 call sites identified 4 additional notification-metadata sites; those also fixed.

### 111. Agreements section in node Detail Panels (primary access path for Amend / Revoke)
- **Status:** ✅ Complete (Phase 9C). Agreements section added to Actor, Asset, and Claim Detail Panels. DAs filtered per node. Amend wired for DAs (opens `AmendDisclosureModal` for active DAs, `CombinedResponseModal` for provisionals). Amend for EAs + Revoke for both remain placeholder-disabled pending #108 + #112. Supersedes #12.

### 112. Revocation flow restoration
- **Status:** ✅ Complete (Phase 9D; UX redo in Phase 9D.1; refinements through 9D.1.6).
- **Phase 9D:** DAs + EAs both revocable by either grantor or grantee. `V22RevocationConfirmModal.jsx` (new) is the revoker-side confirmation. `_revokedMeta` annotations drive view-layer filtering. DA revocation cascades to paired EA + grantee's Eval Results under that EA. Self-revocation scoped out.
- **9D.1 UX redo (2026-04-22):** counterparty-side `V22RevocationNoticeModal` replaced with a Detail Panel pattern. Notification-click pans/selects + opens panel + renders shared `RevocationNoticeSection` inline.
- **9D.1.1 corrections (2026-04-22):** seven fixes from QA — single Dismiss in footer; revocation date in revoked rows; grantee can revoke; Revoke button on DA + EA Detail Panel footers; Case C notice rendering; **critical dismiss regression fix** (annotate `_dismissedRevoked: true` instead of filtering); RevocationNoticeSection redesign.
- **9D.1.2 (2026-04-24):** Per-EA inline revocation pattern for Cases C/D — notification opens Claim panel + scrolls to + expands the targeted EA row with red inline block + inline Dismiss.
- **9D.1.3 (2026-04-24):** Case B inline pattern; Eval Results no longer cascade on DA revocation (they're independent artifacts in the grantee's QS); Orphaned Eval Result Dismiss; AssetNode badge precedence (REVOKED outranks PROVISIONAL/DECLINED); revoked card opaque red-tinted background.
- **9D.1.4 (2026-04-26):** orphaned-ER Dismiss handles seed-only ERs via tombstone append; DA revocation cascade-annotates Proof-of-Evaluation DAs tied to the cascade-revoked EA; `window.confirm` replaced with new `V22DismissEvalResultModal.jsx`.
- **9D.1.5 (2026-04-26):** one-line view-layer filter — `proofDaEvalResultIds` now skips `_revokedMeta`-annotated POE DAs.
- **9D.1.6 (2026-04-26):** internal-DA carve-out on POE cascade so Bob's ER keeps its ownership edge to his Asset on his canvas.

### V1 File Cleanup — completed

### 13. Delete V1 files
- **Status:** ✅ Complete (Phase 8). `src/App.jsx`, `src/App.css`, `src/main.jsx`, `src/ia-map-entry.jsx`, `src/data/`, `src/reference/`, and every `src/components/*.jsx` file outside `modals/` and `DetailPanel/` removed. `index.html` deleted. `vite.config.js` updated to drop the `main` input.

### 14. Delete V2.1-specific code paths
- **Status:** ✅ Complete (Phase 8). `V2_2_ENABLED` flag removed. All 23 conditional sites in `V2App.jsx` collapsed. 13 V2.1 modal files deleted. 10 V2.1 DetailPanel files deleted. V2.1 merge pipeline (~270 lines) removed. Bundle dropped from 638 kB → 345 kB (46% shrinkage).

### 51. V2Canvas.jsx V2.1 prop pruning
- **Status:** ✅ Complete (Phase 9E-parallel, commit b29fdc9). V2Canvas signature cleaned of seven V2.1-era props (`onConnect`, `onDisclose`, `onAddEvidence`, `onParseEvidence`, `onRunEvaluation`, `onAmendEval`, `onCreateClaim`) + forward sites in full-card, mini, and dot LOD branches. V2.2 nodes route card actions through `onV22CardAction` exclusively.

### Data Model & Content — completed

### 65. Credit charge for Asset registration + Claim creation
- **Status:** ✅ Complete (Phase 9A.6 Gate A). `CREDITS_PER_ASSET = 5`, `CREDITS_PER_CLAIM = 25` constants. `CreditCostRow` shared component. Submit disabled when under-funded.

### 70. Asset hierarchy — Asset-from-Asset registration
- **Status:** ✅ Complete (Phase 10.2). Decision (a) chosen — `parentAssetId` field on the Asset schema. Constraints: child Assets must share the parent's owner; cycles forbidden; counterparties never see hierarchy; Claims do NOT implicitly include child Assets. Layout uses depth-based elastic columns. Detail Panel surfaces clickable Parent + Children sections. Spec §3.2 + §10.1 + §6.4 updated.

### 119. "Evidence" → "Assets" terminology audit
- **Status:** ✅ Complete for the V22RunEvaluationModal call sites (Phase 11D W6). "Evidence in scope (N)" → "Assets in scope (N)"; "...without evidence (self-attestation)" → "...as a self-attestation"; "Select at least one evidence Asset" → "Select at least one Asset"; "(Requirements Set, evidence) combination" → "(Requirements Set, Asset selection) combination"; processing subtitle "across N evidence file(s)" → "across N Asset(s)". Internal variable names kept per the user-facing-vs-internal boundary. Pairs with the broader #17 client-canon reconciliation.

### Process Flows — completed

### 21. Per-Asset request entry point
- **Status:** ✅ Complete (Phase 6). `V22NodeDetailPanel`'s Asset panel renders a "Request Agreement" footer button.

### 22. "Disclosure Declined" surface
- **Status:** ✅ Complete (Phase 5 / Phase 6). Decline records persist on `v22Provisionals.declineRecords`; declined Claim renders on requester's canvas with red DECLINED badge; Dismiss CTA removes the record.

### 23. "Awaiting Response" state on provisional nodes
- **Status:** ✅ Complete (Phase 5 / Phase 6). `V22ClaimPanel` provisional branch shows AWAITING RESPONSE badge + request metadata; "Respond to Request" CTA for the grantor opens `CombinedResponseModal`; "Cancel Request" CTA for the grantee withdraws the provisional artifacts.

### 33. Transferring process (ownership transfer)
- **Status:** ✅ Complete (Phase 9A.4). Asset transfer flow with recipient acceptance. V22TransferAssetModal drives 2-step flow. PIN resolution catches self/Radiant Network/unknown. Provisional transfer lands on `v22Provisionals.transfers`; sender's Asset gets TRANSFERRING badge. Recipient's Accept flips ownership and appends to `dot.lineage[]`. Decline appends declined record without changing ownership.
- **Known limitations carried to backlog:** #72 (Claims + Eval Results not yet transferable), #73 (Asset-as-evidence-backing constraint not enforced), #74 (provenance lineage UI), #75 (transfer timeout).

### 34. Register new Asset during Amend Claim flow
- **Status:** ✅ Complete (Phase 9A.3 Gate B). V22CreateAssetModal is the V2.2 Asset-registration flow. AmendClaimModal and V22CreateClaimModal both expose an inline "+ Register new Asset…" CTA that opens V22CreateAssetModal nested.

### 37. Full Disclosure last-Asset deselect handling
- **Status:** ✅ Complete (Phase 9A). Deselecting all Assets no longer snaps back; an amber italic inline help line renders beneath the count footer.

### 38. Run Evaluation review-stage UX improvements
- **Status:** ✅ Complete (Phase 9A). `StatusChevronPicker` renders ◂ SATISFACTORY ▸ with full words; rows pre-populate from prior result on supersede; every row renders a confidence chip (`AWAITING AI` for null).

### 42. "Re-Evaluate" entry point on existing Eval Result nodes
- **Status:** ✅ Complete (Phase 9A). V22EvalResultPanel's "Re-run Evaluation" footer button (owner, not superseded) opens `V22RunEvaluationModal` with `lockedRequirementsSetId` set to the prior result's Req Set id.

### 66. Multi-file Asset registration in single flow
- **Status:** ✅ Complete (Phase 9A.6 Gate B). V22CreateAssetModal rebuilt as a 3-step flow: Pick → Per-file review → Final review. Multi-file callers receive array of new Asset ids and auto-select all N.

### 67. Local-storage upload tab in QS picker
- **Status:** ✅ Complete (Phase 9A.6 Gate B). V22QualifiedStoragePicker gains a tab header: Qualified Storage | Local Storage. Local tab simulates upload with progress bar; uploaded files merge into the payload.

### 69. User-editable Asset label
- **Status:** ✅ Complete (Phase 9A.6 Gate B). Each per-file row in V22CreateAssetModal renders an editable text input pre-populated with the filename-stem derivation. 100-char max, trimmed on submit.

### 77. Transfer accept/decline response modal
- **Status:** ✅ Complete (Phase 9A.5 Gate B). New `V22TransferResponseModal.jsx` replaces the inline notification Accept/Decline buttons. Two phases: Decide → Reason (decline path only). Spec §11.7 updated.

### 78. Transfer modal "Resolved" box shows party only
- **Status:** ✅ Complete (Phase 9A.5 Gate B). `V22TransferAssetModal`'s resolved-recipient chip now shows "Resolved: {party}" only — not "{user} @ {party}" + role.

### 79. PIN resolution error messaging split
- **Status:** ✅ Complete (Phase 9A.5 Gate B). Three semantically distinct messages: self / Radiant Network / unknown. Self + Radiant Network are safe to message specifically; unknown stays generic.

### 85. Disclosure Request Response + all Asset pickers: zero-default + scroll
- **Status:** ✅ Complete (Phase 9A.5 Gate C). `CombinedResponseModal`'s Full-disclosure Asset picker defaults to zero selected. Audited peer pickers across the codebase.

### 90. Notification bell tooltip persistence
- **Status:** ✅ Complete (Phase 9A.6 Gate C). Effect that clears `visible` when `shouldRender` becomes false, plus mousedown clears `visible` synchronously.

### 91. Parse Template picker scroll box
- **Status:** ✅ Complete (Phase 9A.6 Gate C). V22ParseEvidenceModal's template list now renders inside a scroll container (`maxHeight: 300, overflowY: 'auto'`). Audited V22RunEvaluationModal's Requirements Set picker concurrently — applied same treatment.

### 94. QS picker preview pane multi-select summary
- **Status:** ✅ Complete (Phase 9E-parallel.3, cleaned up in 9E-parallel.4). Initial implementation in 9E-parallel.2 didn't render in practice (`!previewFile` guard collided with row-click `previewFile` setter). Corrected by inverting precedence to match macOS Finder column-view multi-select. 9E-parallel.4 follow-up: tightened single-preview render condition to `selected.size === 1 && previewFile`.

### 96. Local Storage tab: indicate destination folder for uploads
- **Status:** ✅ Complete (Phase 9E-parallel.2). Drop-zone copy reads "Files will be uploaded to **{bucket}/uploads** in your Qualified Storage."

### 97. Local Storage uploads default-checked + Select All toggle
- **Status:** ✅ Complete (Phase 9E-parallel.2). Newly-uploaded local files auto-flip into `selected` at the `status: 'uploading' → 'ready'` transition. Select All / Deselect All text toggle renders between the drop zone and the file list.

### 113. Split Combined Request into distinct Disclosure + Evaluation steps
- **Status:** ✅ Complete (Phase 11C). Cold-path `CombinedRequestModal` is now a two-step modal — Step 1 (Disclosure: PIN + Req Sets + message) → Step 2 (Evaluation: expiry + acknowledgments). Warm-path is a separate single-step `EARequestModal`. `CombinedResponseModal` extended with `eaOnlyMode`. Three new notifications. Spec §11.6a documents the warm-path lifecycle in full.

### 118. Bob's Asset shouldn't get NEW badge on disclosure accept
- **Status:** ✅ Complete (Phase 11D W5). `v22DataWithReveal` skips the `_isNew` stamp for Asset reveals where the Asset is owned by the active party. Trade-off: also skips NEW on freshly-registered Assets and transfer-accepted Assets. Per-role reveal-id scoping deferred.

### 125. QS picker cross-tab mutual exclusion
- **Status:** ✅ Complete (Phase 9E-parallel.3). Selections in QS tab and Local Storage tab are now mutually exclusive. Tab-change handler clears `selected` and `previewFile` before flipping `source`.

### 126. Request new Evaluation Agreement on a Claim with an existing Disclosure Agreement
- **Status:** ✅ Complete (Phase 11C, shipped alongside #113). The warm-path "Request Evaluation Agreement" CTA renders on the Claim Detail Panel footer + canvas action bar (▷ icon) when (a) the viewer is non-owner, (b) at least one active DA on this Claim exists with viewer as grantee, and (c) no active EA exists. Click opens `EARequestModal` (single-step). Spec §11.6a.

### 128. Dismiss orphaned Evaluation Results from their Detail Panel
- **Status:** ✅ Complete (Phase 9D.1.3 Fix 6). When an Eval Result's backing Evaluation Agreement is no longer in the active view (revoked or already-dismissed), the Eval Result Detail Panel footer swaps from "Re-Run Evaluation" to "Dismiss" with a confirmation dialog. ER annotated with `_dismissedRevoked: true`.

### 134. PIN-existing-Claim validation in cold path Step 1
- **Status:** ✅ Complete (Phase 11D W1). `CombinedRequestModal` Step 1 PIN resolution gained an `already-disclosed` state. Submit gated. Copy: "This Claim is already on your network." (Phase 11D.1 trimmed the second-sentence steering hint.)

### 135. Hide FILE / REGISTRATION sections on counterparty-pulled Assets
- **Status:** ✅ Complete (Phase 11D W2). `V22AssetPanel` gates the `Identity > DOT` row, the `File` section's metadata fields, and the `Registration` section on `isOwner`. Non-owners see a "File" section with a single "Open Evidence Viewer" button.

### 136. Cancel Request action bar button on provisional Claims
- **Status:** ✅ Complete (Phase 11D W3). New `cancelRequest` verb in `V22ActionBar`'s CLAIM case — the ✕ button renders for the requester. Async handler plays unravel before mutation; dismisses responder's matching `v22-request-*` notification.

### Spec Updates — completed

### 86. DID glossary entry in architecture-spec.md §2.6
- **Status:** ✅ Complete (Phase 9A.5 Gate C). §2.6 now expands DID on first use with a link to [w3.org/TR/did-core/](https://www.w3.org/TR/did-core/).

### 93. Transfer file custody semantics (Model 1 pointer vs Model 2 replication)
- **Status:** ✅ Spec note shipped (Phase 9A.6.1 Fix 5). architecture-spec.md §11.7 documents the prototype's working assumption: replication model — on accept, the file is independently held in each owner's qualified storage. Design conversation pending with client to confirm production semantics.

### Future Features — completed

### 25. Library Modal (unified Parse Templates + Req Sets + Published Standards)
- **Status:** ✅ Complete (Phase 10.3). Single chrome "Library" button replaces the prior two buttons. Three tabs: **Parsing Templates**, **Requirement Sets**, **Published Requirements**. Implementation: `LibraryModal.jsx` provides the frame + tab bar; existing `RequirementsLibraryModal` and `PEPLibraryModal` files gained an `embedded` prop (relocated to `library/RequirementsPanel.jsx` + `library/ParsingTemplatesPanel.jsx` in Phase 10.4).

### 29. Public Directory Cloud visualization
- **Status:** ✅ Phase 7 placeholder shipped — `DirectoryLayer.jsx` renders 4 actor-party dot clusters behind a circular-wipe transition. Full visualization (real force-directed layout, thousands of dots at scale, per-dot interactivity) tracked via items #43, #45, and #46.

### Notifications — completed

### 137. Cross-role notification indicators in user menu
- **Status:** ✅ Complete (Phase 11D). Yellow dot on the user menu chrome trigger button when any other role has un-dismissed notifications. Yellow dot on each non-active role row in the SWITCH USER dropdown when that role has un-dismissed notifications.

### 138. NEW badge persistence audit across all node types
- **Status:** ✅ Complete (Phase 11D W7). Comprehensive scan of all 10 `setV22RecentlyAcceptedClaimId` / `setV22RecentlyAcceptedAssetId` call sites. No `setTimeout`-based clearing found. The Phase 11C.5 decoupling holds across all paths. No regressions found beyond the #118 fix shipped alongside this audit.

---

## Update Log

- 2026-04-18: Initial compilation from V2.2 migration conversation history (Phases 1-4).
- 2026-04-18: Phase 6 — items #10, #21, #22, #23 marked complete.
- 2026-04-19: Phase 6.5 bug-fix pass — added items #34, #35, #36 below for follow-up after migration stabilizes.
- 2026-04-19: Phase 6.5+ visual-review pass — added items #37, #38, #39, #40, #41, #42.
- 2026-04-19: Phase 7 — added Phase 7+ polish items #43, #44, #45, #46, #47, #48.
- 2026-04-19: Phase 8 consolidation — items #13 (Delete V1 files) and #14 (Delete V2.1-specific code paths) marked ✅ Complete; added #49, #50, #51.
- 2026-04-19: Phase 8.5 bug-fix pass — five bugs fixed; added polish item #52.
- 2026-04-19: Phase 9A polish pass — items #1, #2, #3, #5, #8 sub-items, #37, #38, #40, #42, #52 all shipped.
- 2026-04-19: Phase 9A.1 corrections pass — nine visual-review fixes + one bug fix.
- 2026-04-19: Phase 9A.1.5 polish pass — five items.
- 2026-04-19: Phase 9A.2 — three defect fixes + new Tooltip primitive + app-wide sweep.
- 2026-04-19 (late): Phase 9A.3 preamble hygiene — added items #53–62.
- 2026-04-20: Phase 9A.4 preamble — added items #64–71; #64 shipped in same session.
- 2026-04-20: Phase 9A.4 main — Transferring process shipped (Assets only); structured DOT data model added; backlog #72, #73, #74, #75 filed.
- 2026-04-20: Phase 9A.5 — fast-follower polish; #76, #77, #78, #79, #83, #85, #86, #87 shipped.
- 2026-04-20: Phase 9A.6 — Asset registration batch (#65, #66, #67, #68, #69, #89, #90, #91 shipped).
- 2026-04-20: Phase 9A.6.1 — corrective fixes (5 fixes; backlog #93–106 filed).
- 2026-04-21: Phase 9A.6.1.1 — three small fixes (#89, #100, #101 status updates).
- 2026-04-21: Phase 9A.6.2 — investigation phase for #103.
- 2026-04-21: Phase 9A.6.2.1 — #103 fixed; #108 filed.
- 2026-04-21: Phase 9B — edge hover & selection polish (#7, #59 shipped); #110 filed.
- 2026-04-21: Phase 9B.1 — refinements; #110 shipped.
- 2026-04-21: Phase 9B.2 — bug fixes; #111, #112 filed.
- 2026-04-21: Phase 9B.3 — edge menu midpoint anchor.
- 2026-04-21: Phase 9C — Agreements section (#111 shipped).
- 2026-04-21: Phase 9D — Revocation flow (#112 shipped).
- 2026-04-21: Phase 9E-parallel — #51 + #107 + initial #60; co-shipped with 9D.
- 2026-04-21: Phase 9E-parallel.1 — #60 correction.
- 2026-04-22: Phase 9E-parallel.2 — QS picker cluster (#94, #96, #97; #95 investigation).
- 2026-04-22: Phase 9E-parallel.3 — #94 correction + #125 + backlog file merge.
- 2026-04-22: Phase 9E-parallel.4 — two fast-followers.
- 2026-04-22: Phase 9D.1 — Revocation UX redo.
- 2026-04-22: Phase 9D.1.1 — seven corrective fixes.
- 2026-04-24: Phase 9D.1.2 — per-EA inline revocation (#127 shipped).
- 2026-04-24: Phase 9D.1.3 — Case B inline + Eval Result persistence cascade revision (#128 shipped).
- 2026-04-26: Phase 9D.1.4 — four fixes from QA.
- 2026-04-26: Phase 9D.1.5 — POE DA cascade view-layer filter.
- 2026-04-26: Phase 9D.1.6 — internal-DA carve-out.
- 2026-04-26: Phase 9D.2 — unravel animation primitive (#124 shipped); #129 filed.
- 2026-04-27: Phase 9D.2.1 — staged choreography overhaul.
- 2026-04-27: Phase 9D.2.2 — three corrections.
- 2026-04-27: Phase 9D.2.3 — three refinements from slow-mode QA.
- 2026-04-27: Phase 9D.2.4 — single-line guard against edge rebuild during unravel.
- 2026-04-27: Phase 10.1 — Register Asset modal copy rewrite.
- 2026-04-27: Phase 10.2 — Asset hierarchy (#70 shipped); #130, #131 filed.
- 2026-04-28: Phase 10.2.1 — Layout: grid alignment + per-column row offsets.
- 2026-04-28: Phase 10.3 — Library Modal unification (#25 shipped).
- 2026-04-28: Phase 10.4 — legacy modal cleanup + spec sync.
- 2026-04-28: Phase 11A — DA/EA flow foundations.
- 2026-04-28: Phase 11A.1 — actor corner tooltip surgical fix.
- 2026-04-28: Phase 11B — ChipCo cluster interactivity + ExpandedArtifactModal restoration; #132 filed.
- 2026-04-29: Phase 11C — DA/EA flow separation (#113, #126, partial #115); #133 filed.
- 2026-04-29: Phase 11C.1 — Acknowledgments architecture correction.
- 2026-04-29: Phase 11C.2 — reveal animation diagnosis + acknowledgments display + EA Expand modal.
- 2026-04-29: Phase 11C.3 — reveal animation timing fix + reveal primitive migration + Expand icon consistency.
- 2026-04-29: Phase 11C.4 — edge reveal animation + warm-path notification handler.
- 2026-04-29: Phase 11C.5 — NEW badge persistence + reveal animation cleanup; #138, #139 filed.
- 2026-04-29: Phase 11D — Polish punch-list (#118, #119, #134, #135, #136, #137, #138 shipped).
- 2026-04-29: Phase 11D.1 — copy fixes for #134 + #119.
- 2026-04-29: Phase 11D.2 — Selective Disclosure: grantee view of Claim's referenced Assets; #141 filed.
- 2026-04-29: Phase 11D.3 — Proof-only Disclosure: Eval Result materialization on grantee canvas.
- 2026-04-30: Phase 11D.4 — layout spacing fix + Referenced Assets count fix.
- 2026-04-30: Phase 11D.4.1 — Eval Result placement derived from source Claim + AssetNode tooltip z-index fix.
- 2026-04-30: **Phase 11.5 — Dev hygiene pass.** Reorganized this file: ~70 ✅ Complete / ✅ Verified / ✅ Superseded items moved into a new `## Completed` section at the bottom of the file (preserved verbatim with their Status entries, phase references, and commit hashes). The topic sections above (Visual & Rendering, Edge Interactions, Detail Panels, V1 File Cleanup, Notifications, Data Model & Content, Process Flows, Spec Updates, Future Features, Exploratory) now contain only Open / Partial / Deferred / Investigation items. **Status vocabulary standardized** to one of: `Open`, `Partial`, `Deferred to Phase X`, `Investigation`. **Effort field** added to every remaining open item: `S` / `M` / `L` / `XL` / `?`. **Phase queue assignments** baked into Status fields: Phase 11E (`#108`, `#102`, `#139`); Phase 12 (`#117`, `#105`, `#106`, `#120`, `#121`, `#122`); Phase 13 (`#26`); Phase 14 (`#43`, `#45`, `#46`, `#47`, `#132`); Phase 15 (`#11`, `#48`, `#104`). **Misfilings rehoused:** #74 (Provenance lineage UI) moved from Process Flows → Detail Panels. **No item triage** (no kills, no merges beyond the existing `#12 → #111` superseded). #84, #92, #109 ID gaps left as historical artifacts. Architecture spec audited and Phase 11 summary entry added; `ROUND-13-CONTEXT.md` created at the repo root as a setup checklist for the next conversation.
- 2026-04-30: **Phase 11E.1 — Amend Evaluation Agreement (#108).** Wired the EA amendment flow end-to-end: new modal `AmendEvaluationAgreementModal.jsx` (expiration via shared `ExpiryPicker` + acknowledgment editor list + amendment note), new factory `makeAmendedEvaluationAgreement` mirroring `makeAmendedDisclosureAgreement` shape, new pure helper `diffAcknowledgments(before, after)`, `makeEvaluationAgreement` extended with `amendments[]`. New notification type `v22-ea-amendment` (single-grantee, informational; deep-links to Claim + opens EA Detail Panel). EA Detail Panel: Amendments section between Status and paired-DA navigation; Amend footer button gated to grantor + active + non-revoked. Acknowledgments shipped with **Option B** semantics — acknowledgments live on the Claim and Amend EA mutates the Claim directly while the EA's `acknowledgmentsAccepted` audit trail is preserved. Multi-EA implicit propagation + lineage chaining are documented limitations; Option C target deferred to production via new backlog item #160. Architecture spec §11.2a (new subsection) + §7.4 (notification table extended) + Changelog entry. #108 moved to Completed; #12 superseded note updated.
- 2026-05-01: **Phase 11E.1.1 — Amend EA polish + bug fixes.** Five fixes from 11E.1 QA. **Fix 1 (P1):** `AmendEvaluationAgreementModal` `hasChanges` was reporting true on modal open for EAs with non-`T00:00:00Z` deadlines — the picker pre-fill normalized to midnight UTC while the original ISO carried a time component, so raw-string comparison short-circuited to "different" and the Submit button was enabled before any user input. Fix: normalize both sides to `YYYY-MM-DD` (`toDateOnly` helper) before comparing. **Fix 2 (P1):** `EdgeHoverMenu` was reading `evaluationAgreement?.terms?.expires` — wrong field name; the EA schema carries `terms.evaluationDeadline` (`expires` is on the DA). Tooltip always fell back to "Never expires" pre-fix, regardless of actual deadline. Fix: read the correct field with the legacy fallback retained for migration safety. Post-amend updates now propagate via the live merged-view lookup. **Fix 3 (P1, contradicted §11.2a):** Carol's canvas was showing a NEW badge on Alice's Claim after Alice amended the EA-to-Bob — `setV22RecentlyAcceptedClaimId(claimIdForPan)` is global state and stamps NEW for every viewer until deselect. Per Option B (§11.2a), only the targeted EA grantee receives a notification; Carol's silent inheritance is documented but the NEW badge is not. Fix: removed the `setV22RecentlyAcceptedClaimId` call from the EA-amend handler entirely. The grantor (amender) gets pan + select for visual confirmation, which is sufficient post-modal-submit; no NEW badge needed. Per-role reveal-id scoping tracked under existing #138 audit scope. **Fix 4:** `ExpiryPicker` preset card labels read "Expires March 2027" / "Expires March 2028" — wrong-month (1 year from 2026-04-30 is 2027-04-30, not March) AND non-conforming with the codebase's YYYY-MM-DD display convention. Fix: dynamic computation via new `expiryPresetIso(yearsFromNow)` helper; labels now read e.g. "Expires 2027-05-01" relative to today. `expiryLabel` updated to match. Inherited correctly by other ExpiryPicker call sites (CombinedRequestModal, EARequestModal, CombinedResponseModal). **Fix 5:** Modal header subtitle now weaves the grantee party name + Claim name into the description prose, both bolded (`<strong>` tags). Subtitle accepts JSX since `ModalHeader` renders `{subtitle}`. **Bonus:** footer summary upgraded from "Expiration changed" to explicit "Expiration: 2026-04-04 → 2027-05-01" before/after with `YYYY-MM-DD` precision; "No expiry" rendered for null on either side. Filed new backlog item **#161 — Notification deep-link with diff highlighting in Detail Panel** (Open, M effort, Medium priority) for the future-phase UX where amendment notifications deep-link to the panel + highlight the diff. No spec changes; §11.2a contract preserved. Footer v0.11.13 → v0.11.14.
- 2026-05-01: **Phase 11E.1.2 — Detail Panel EA-deadline read audit + tooltip wrap fix.** Two small fixes closing out the Amend EA epic before Phase 11E.2 (#102). **Fix 1 (P2):** `V22NodeDetailPanel.jsx` `EvaluationAgreementRow` was reading `ea.terms?.resultExpiry || ea.terms?.expires || null` — wrong field. The EA carries `terms.evaluationDeadline` (`resultExpiry` is a separate concept — when the eval RESULT itself expires post-evaluation; `terms.expires` exists only on the DA schema). Pre-fix the row always rendered "Never expires" regardless of actual deadline AND post-amend never updated. Fix: read `terms.evaluationDeadline` first with `resultExpiry` + `expires` retained as legacy fallbacks for migration safety. Same pattern as Phase 11E.1.1 Fix 2 in `EdgeHoverMenu.jsx`. Audit confirmed no other stale read sites: `EvaluationAgreementDetailPanel.jsx` already reads `terms?.evaluationDeadline` correctly (line 186); `DisclosureAgreementDetailPanel.jsx` reads `terms?.expires` correctly for DAs (DAs use a different field). Single-line fix touches only the `EvaluationAgreementRow` helper which is shared across V22ClaimPanel, V22AssetPanel, and V22ActorPanel — all three Detail Panel surfaces inherit the fix automatically. **Fix 2:** edge hover tooltip title was wrapping with "Agreement" orphaned on line 2 for "Selective Disclosure Agreement" + "Proof-only Disclosure Agreement". `MENU_WIDTH` was 320 — too narrow to fit the 31-char "Proof-only" label at 12px/600 alongside the SDA illustration + 80px right padding for the pinned-mode "View →" affordance. Fix: bumped `MENU_WIDTH` to 380 + added `whiteSpace: 'nowrap'` to both DA + EA title elements (parity). Body party→party line continues to wrap normally on long names. No spec changes; §11.2a contract preserved. Footer v0.11.14 → v0.11.15.
- 2026-05-02: **Phase 11E.2 (#102) + Phase 11E.3 (#139).** Two parallel features closing out Phase 11E. **Phase 11E.2 (#102):** reciprocal cross-role notifications wired for Claim + DA amendments, closing the long-standing convention violation flagged in CLAUDE.md. (a) Existing `v22-amendment` (DA-amendment) renamed → `v22-da-amendment` for parallel naming with `v22-ea-amendment` and the new `v22-claim-amendment`. Click handler now deep-links to the DA Detail Panel directly via `setOpenAgreement({ kind: 'disclosure', disclosureAgreementId })`, mirroring the EA amendment routing instead of pan-only. Inbox badge `AMENDED` → `DA AMENDED`. (b) New `v22-claim-amendment` fires from `handleV22AmendClaimSubmit` to every counterparty with an active DA on the affected Claim — fan-out, deduped by party; "active" filter excludes provisional / declined / revoked / expired DAs, plus self-grant (internal DAs) and Radiant Network public-directory DAs. Click pans to the Claim and opens its node Detail Panel; badge `CLAIM AMENDED`. (c) Notification body branches added for both new types — body reads "Claim amended: <claim name>" / "Disclosure Agreement amended: <claim name>" with optional `(Note: …)` suffix. Pre-fix DA-amendment body fell through to a bare `req.asset?.name`; Claim-amendment had no notification at all. Architecture spec §7.4 notification table extended with two new rows; §11.2 prototype notes updated for both Claim + DA amendment to reference Phase 11E.2; §6 worked example + §11.3 evaluation-amendment narrative now reference both new types. New Changelog entry. **Phase 11E.3 (#139):** edge draw-in animation on reveal — inverse of `playEdgeRetract`. New `playEdgeDrawIn(nodeId, durationMs)` method on V2Canvas (mirrors retract's per-frame point-trim, but `pointsToShow` grows from 2 → ptCount instead of shrinking). New animation primitive `src/v2/animations/edgeDrawIn.js` exports `playEdgeDrawIn({ nodeId, canvasRef, durationMs })`. `startReveal` in V2App.jsx schedules the draw-in via `setTimeout(500ms)` so it fires after the reveal pan settles and completes before the flip starts (`PHASE_FLIP_MS = 1100`). The edge's `_showAsProvisional` stamp clears at flip-midpoint via the existing reveal infrastructure, so the dashed-grey provisional edge becomes its final typed style at the visual hand-off — capturing the spirit of "typed edge draws in" using the existing single-edge-with-stamp architecture rather than maintaining two parallel edges. Material opacity ramps 0 → base over the first 30% of the draw-in so the curve fades in at the head rather than popping in. Backlog items #102 + #139 moved to Completed. Footer v0.11.20 → v0.11.21.
- 2026-05-02: **Phase 11E.1.7 — Step 4 copy expansion + modal max-height + Detail Panel close on Directory Layer + Amend DA zero-Asset gating + #163 filing.** Five small fixes closing out the DA/EA separation arc before Phase 11E.2 (#102). **Fix 1:** CombinedResponseModal Step 4 review labels expanded — "DA EXPIRES" → "DISCLOSURE AGREEMENT EXPIRES" + "EA EXPIRES" → "EVALUATION AGREEMENT EXPIRES". Label column `minWidth` widened from 130 → 230 to fit the longer mono-uppercase strings without wrapping. Other rows in the same labeled-list (Disclosure type, Assets in scope, etc.) inherit the new width so the column edges stay aligned. The earlier `{isEaOnly ? 'Agreement expires' : 'EA expires'}` ternary collapsed to a single "Evaluation Agreement expires" string since both branches now read identically. **Fix 2:** CombinedResponseModal renders at a fixed 720px height so steps 1-4 (and warm-path 3-4) all sit at the same size and the footer button row no longer jumps as content varies between steps. Implemented by adding an optional `height` prop to the shared `Modal` component (defaults to undefined → existing behavior unchanged for all other modals) and passing `height={720}` from CombinedResponseModal. Cap is `min(90vh, 720px)` so small viewports gracefully shrink. ModalBody already has `flex: 1, overflow: auto`, so longer steps scroll within the body and the footer stays anchored. Per Andrew's call, scope is CombinedResponseModal cold + warm paths only this round; CombinedRequestModal / EARequestModal / other modals are untouched pending broader modal-flow plans. **Fix 3:** Detail Panels (node + DA + EA) now close when the user enters the Radiant Network Directory Layer. The globe-button onClick already cleared `setSel` / `setForcePanelTab` / `setForceExpandSda` (Phase 11C.1 W11), but it didn't clear `setSelectedEdgeId` / `setOpenAgreement` — the agreement Detail Panels are driven by edge selection, so a DA / EA panel persisted over the directory. Added both clears to the same handler. Toggle behavior unchanged — the same handler fires on entry AND exit, so the canvas returns with no selection (per Andrew's call). **Fix 4:** AmendDisclosureModal blocks Submit when current scope is empty for the active type (Full → ≥1 Asset, Selective → ≥1 field, Proof-only → ≥1 Eval Result). Pre-fix the user could uncheck the lone item, trip `hasChanges`, and submit a DA whose scope had nothing in it. New `scopeIsEmpty` + `baselineWasNonEmpty` derived state; `canSubmit = hasChanges && !scopeIsEmpty`; footer Submit button now reads `disabled={!canSubmit}`. Inline amber italic empty-state message ("At least one Asset must be in scope.", or field / Eval Result variant) renders only when `showEmptyScopeWarning` (= `scopeIsEmpty && baselineWasNonEmpty`) — i.e., after the user has interacted to reach zero, not on initial open. CombinedResponseModal Step 2 sweep confirmed: existing `canAdvanceFromStep2Accept` already gates ≥1 selection across all three branches; full's existing inline empty-state message stays as-is (selective + proofonly inline messages are out of scope this round). **Fix 5:** filed new backlog item **#163 — Anchor Asset picker for EA-only requests on Directory Layer Claims** (Deferred to Phase 14, M effort). Captures Andrew's note from 11E.1.6 QA that `EARequestModal` currently anchors against a hardcoded Asset (Bob's Avionics Module) when triggered from a Directory Layer Claim; Bob should pick which Asset to anchor against since that determines where the Claim materializes on his netgraph. Pairs with #43 (Clickable Directory Layer dots) and #46 (Corner-node morph) — all Phase 14. No spec changes. Footer v0.11.19 → v0.11.20.
- 2026-05-02: **Phase 11E.1.6 — DA expiration UX in Response + Amend flows + EA "Never expires" coercion fix + Amend DA title.** Four fixes closing out the DA/EA separation arc before Phase 11E.2 (#102). Spec §11.2 (DA amendment) and §11.6 (DA+EA response flow) are now reflected more faithfully by the UI; no spec text changed. **Fix 1 (P1):** clicking the ExpiryPicker's "No expiry" preset card in CombinedResponseModal silently produced an EA `evaluationDeadline` ~1 year out instead of `null`. Root cause: `computeExpiryIso` switch handled stale picker ids (`'never'`, `'6-months'`, `'2-years'`) but the picker actually emits `'1-year'`, `'2-year'`, `'none'`, `'custom'` — so `'none'` fell to the `default` branch and got coerced to +1 year. Fix: rewrite the switch to use the picker's actual ids; add a shared `isoFromPicker(mode, customDate)` helper. Also fixed the same null-coercion bug in `finalizeProvisionalAgreementPair` and `finalizeProvisionalEvaluationAgreement` (cold + warm paths) where `??` collapsed an explicit null `eaTerms.expires` back to the provisional fallback — switched both to `!== undefined ? : (fallback ?? null)`. **Fix 2:** DA expiration is now grantor-set at response time (Andrew's Option A). CombinedResponseModal Step 2 gains a `<FieldLabel>Disclosure Agreement expiry</FieldLabel>` + `<ExpiryPicker>` above the scope picker; new state `daExpiry` / `daCustomExpiry` parallels the EA state. Step 3 copy tightened to be EA-specific (the section's intent is no longer ambiguous). Step 4 review shows DA + EA expirations on separate rows. New helper `computeDaExpiryIso()` mirrors `computeExpiryIso()`. Submit payload extended with `daTerms: { expires }`. `handleV22Accept` in V2App forwards `daTerms` to `finalizeProvisionalAgreementPair`. The factory was extended with a `daTerms` parameter so the DA's `terms.expires` is set independently of the EA's `terms.evaluationDeadline`. Pre-fix the same value was assigned to both fields, conflating two distinct contracts. Defaults: both pickers default to `'none'` ("Never expires") so the responder consciously opts in to a finite term. Warm path (`eaOnlyMode = true`) is unchanged — Step 2 doesn't render, no DA exists in the EA-only path; Step 4 review hides the DA expires row when `isEaOnly`. **Fix 3:** AmendDisclosureModal gains an Expiration section above the scope picker, mirroring AmendEvaluationAgreementModal's layout. New state `expiry` / `customExpiry` pre-fills to `'custom'` with the existing expires (or `'none'` if Never expires). `hasChanges` extended to include `expiryChanged` (date-precision compare via `toDateOnly` to avoid the same time-component drift Phase 11E.1.1 Fix 1 hit). Footer summary surfaces "Expiration: <before> → <after>" alongside the scope summary. Submit payload extended with `terms: { expires }`. `makeAmendedDisclosureAgreement` factory in `v2_2Data.js` now accepts an optional `terms` argument, applies `terms.expires` (preserving null), and records `termsBefore: { expires }` on the appended amendment record — parity with `makeAmendedEvaluationAgreement` and the EA Detail Panel's amendment cards. DA Detail Panel's prior count-only "Amendments: N" Row replaced with a full Amendments section: each card shows the amendment timestamp, "Expiration: before → current" delta when expires changed, "Scope amended." line when scopeBefore is present, and the optional grantor note. Older scope-only amendments without `termsBefore.expires` continue to render correctly (no expiration delta line). Lineage chaining caveat (older entries diff against current expires not expires-at-amendment-time) is the same documented limitation as EA's §11.2a Option C TODO. **Fix 4:** AmendDisclosureModal title `"Amend Disclosure" → "Amend Disclosure Agreement"` (parity with "Amend Evaluation Agreement"); footer Submit button label matches. Subtitle replaced with parallel JSX structure to AmendEvaluationAgreementModal: "Update the expiration date and scope for the Disclosure Agreement with **{grantee}** on Claim **{claimName}**. Changes are unilateral — {grantee} will be notified and may revoke if they don't accept the new terms. Items already evaluated are locked and cannot be removed from scope." Bolded grantee + Claim name via `<strong>`. New `claim` prop wired through V2App's modal mount (uses already-resolved `claim` from the surrounding closure). Falls back to `agreement.subject?.id` if claim isn't passed (legacy callers). No spec changes; UI now reflects spec §11.2 and §11.6 more faithfully. Footer v0.11.18 → v0.11.19.
- 2026-05-01: **Phase 11E.1.5 — REVOKED badge placement + "Never expires" copy unification.** Two cleanup fixes closing out the Amend EA epic before Phase 11E.2 (#102). **Fix 1:** the `REVOKED` lifecycle-state badge on revoked node cards was rendering inline with the node name in the title row (Phase 9D era), where it crowded long names ("Power Regulation …" with the badge eating the right side). Per CLAUDE.md Code style, lifecycle-state badges (PROVISIONAL / DECLINED / SUPERSEDED / NEW) are separate from the type label. Fix: moved REVOKED to the V2.2 type-label header row (`AssetNode.jsx` Row 0), alongside the `CLAIM` / `ASSET` / `PARSE RESULT` / `EVAL RESULT` mono label. Row 0 wrapper switched from a default block to a flex container with gap so the type label + REVOKED badge sit on a single line. Title row (Row 1) now displays only the node name + remaining badges (PROVISIONAL / TRANSFERRING / SUPERSEDED / DECLINED / StackBadge) with full available width. REVOKED's badge precedence over PROVISIONAL/DECLINED is preserved — the existing `!isRevoked` gates on those Row 1 badges remain so REVOKED still wins when multiple states would otherwise qualify. Mini LOD already used a dashed-red-border + red-tinted-background indicator (no text badge); no regression. Dot LOD doesn't render state badges. The italic "Disclosure revoked" subtitle line on the revoked card is preserved (Andrew confirmed the redundancy with the header badge is fine). **Fix 2:** copy unification across the app — the no-expiration state now reads "Never expires" everywhere it's rendered as a status display. Phase 11E.1.4's `DisclosureAgreementRow` addition originally used "No expiry"; pre-existing surfaces (`EvaluationAgreementRow`, `EdgeHoverMenu`) used "Never expires". Sweep updated four files: `V22NodeDetailPanel.jsx` (`DisclosureAgreementRow` status text), `AmendEvaluationAgreementModal.jsx` (`formatDateTime` helper + footer summary before/after for amendment expiration changes), `ModalShared.jsx` (`expiryLabel` resolved-state display for `'none'`), `EvaluationAgreementDetailPanel.jsx` (Evaluation deadline + Result expiry rows + amendment-row "Expiration: before → after"), `DisclosureAgreementDetailPanel.jsx` (Expires row). Detail Panel "Expires" rows previously rendered an em dash "—" for null; now read "Never expires" — clearer than the generic dash. Judgment call preserved: the ExpiryPicker preset card in `ModalShared.jsx:367` keeps `label: 'No expiry'` since that title labels a *user action* of opting out of an expiry, not a status display; the comment at `expiryLabel` documents why. `formatDateTime` helpers in the Detail Panels left intact — null fallback there is still '—' for non-expiration fields like Created date; the expiration-specific rows wrap with an inline conditional so only those rows show "Never expires" on null. No spec changes. Footer v0.11.17 → v0.11.18.
- 2026-05-01: **Phase 11E.1.4 — Revoked-EA AMEND removal + DA row expiration + response modal titles + Directory backlog filing.** Four small fixes closing remaining Amend-EA cleanup before Phase 11E.2 (#102). **Fix 1:** `EvaluationAgreementRow` (`V22NodeDetailPanel.jsx`) was rendering the AMEND `<ActionLabel>` (disabled with tooltip) on revoked rows. Inconsistent with REVOKE (already hidden on revoked rows per Phase 9D.1.x precedent) and with `DisclosureAgreementRow`'s `actionsHidden = isInternal || isProofOfEval || isRevoked` rule. Fix: AMEND now hidden entirely on revoked rows (`showAmend = !isInternal && !isRevoked`); the two remaining gating branches (`isGrantor` enabled / `!isGrantor` disabled-with-tooltip) are unchanged. Auto-propagates across V22ActorPanel + V22AssetPanel + V22ClaimPanel via the shared `AgreementsSection`. **Fix 2:** `DisclosureAgreementRow` right-column read `Active · {creationDate}` (e.g. "Active · 2026-03-04") for active rows, but EA rows in the same Agreements section read "Expires YYYY-MM-DD" — inconsistent. Fix: active DA rows now read `Expires YYYY-MM-DD` from `agreement.terms?.expires` (or `No expiry` if null/undefined), matching the EA-row pattern. The "Active" status prefix is removed entirely — the row's presence in the active Agreements section already implies active. Revoked / declined / provisional rows keep their existing label + color + date. **Fix 3:** Audit of all DA factory call sites in `v2_2Data.js` — all five cross-party DAs (`daAliceToBobPrm`, `daAliceToBobVreg`, `daAliceToCarolPrm`, `daChipcoToBobPrmIc`, `daAliceToDavePrmProof`) already carry `terms.expires` 2027-MM-DD values. Public-directory DAs, internal/ownership DAs, and proof-of-evaluation DAs legitimately have no expiry (their lifetimes tie to the publishing channel, the asset/claim, or the eval result respectively); these continue to render gracefully as "No expiry" per Fix 2. No seed mutations required — the audit was a no-op. **Fix 4:** `CombinedResponseModal` modal title was a single generic line shared across all four steps. Fix: step-aware accept-path title resolver. Cold path: Steps 1-2 (Type / Scope) → "Respond to Disclosure Request"; Step 3 (EA Terms) → "Respond to Evaluation Request"; Step 4 (Review) → "Review your Disclosure + Evaluation Agreement Response". Warm path (`eaOnlyMode = true`): Step 3 inherits the cold-path EA copy; Step 4 → "Review your Evaluation Agreement Response". Decline-path titles preserved (out of scope this round). **Backlog:** filed new item **#162 — EA revocation copy + Directory Layer post-revocation visualization** (Deferred to Phase 14, S copy + part of #132) capturing Andrew's architectural note from 11E.1.3 QA: when a grantor revokes an EA the Claim leaves both netgraphs but the underlying DA persists, and the "still have access via DA" relationship should surface on the Radiant Network rather than the netgraph. Pairs with #132 (Umbrella DA edge visualization) + #43 (Clickable Directory Layer dots). No spec changes. Footer v0.11.16 → v0.11.17.
- 2026-05-01: **Phase 11E.1.3 — Inline EA Amend button + seed data date refresh.** Two cleanup items closing out the Amend EA epic before Phase 11E.2 (#102). **Fix 1 (P2):** `EvaluationAgreementRow` in `V22NodeDetailPanel.jsx` had a stale hardcoded `<ActionLabel label="Amend" disabled title="Amend Evaluation Agreements coming soon" />` from the pre-Phase-11E.1 placeholder era — never updated when the modal shipped. Wired through the prop chain: V2App new `handleAmendEaFromRow` (gates grantor + active + non-revoked, then `setV22AmendingEaId(ea.id)` + `setSel(null)` to clear the panel) → passes `onAmendEa` to V22NodeDetailPanel → forwards to V22ActorPanel + V22AssetPanel + V22ClaimPanel → forwards to AgreementsSection → forwards to EvaluationAgreementRow's new `onAmendEa` prop. EvaluationAgreementRow now renders the AMEND ActionLabel with three-branch gating mirroring `EvaluationAgreementDetailPanel.jsx`'s footer logic: enabled (grantor + active + non-revoked) with onClick + descriptive tooltip; disabled with grantor-only tooltip ("Only {grantor} can amend this agreement.") for non-grantors; disabled with revoked tooltip for revoked EAs. Single-source fix propagates automatically to all three Detail Panel surfaces (Phase 9C / #111 AgreementsSection). Sweep confirmed no other Amend-EA "coming soon" stragglers in the codebase. **Fix 2:** seed-data EA `evaluationDeadline` values bumped from 2026-04-04 / 2026-04-15 / 2026-04-20 → 2028-04-04 / 2028-04-15 / 2028-04-20 (preserved month + day; just bumped the year by 24 months per the brief). DAs already had 2027 `expires` values and didn't need bumping. Creation/effective `terms.createdDate` values left in 2026 — those are historical timestamps. Demo no longer shows "Expires 2026-04-XX" on Active EAs. No spec changes. Footer v0.11.15 → v0.11.16.
