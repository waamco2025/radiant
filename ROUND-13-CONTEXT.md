# Round 13 — Foundational Context

This is a setup checklist for the next Claude Code conversation. It identifies what foundational files Round 13 needs at conversation start, plus the queue of phases to work through.

## Files to upload at conversation start

These are the canonical reference files that should be in the foundation upload set when starting a new Round 13 conversation:

1. **architecture-spec.md** — the leading scripture; describes the V2.2 architecture (Phase 11 work integrated; §6.5 cross-canvas pull-in rules, §7.4 notifications, §10.4 grantee view derivation, §11.5a revocation, §11.6a EA-only request lifecycle).
2. **CLAUDE.md** — codebase conventions (Working Conventions, UX patterns, current state-of-the-world). Slim file (~12 KB after the Phase 11.6 split).
3. **CLAUDE-phase-log.md** — historical per-phase completion notes back through Phase 11E.1. Archive reference; attach only when phase history matters for the current task.
4. **polish-backlog.md** — open / partial / deferred items only at the top of the file (Phase 11.5 hygiene moved completed items into a `## Completed` section at the bottom). Each open item has standardised `Status` + `Effort` fields.
5. Latest source files for active development:
   - **src/v2/V2App.jsx** — root state management, panel mounts, handler routing, notification inbox, Changelog modal.
   - **src/components/DetailPanel/V22NodeDetailPanel.jsx** — Detail Panel routing and rendering for V2.2 nodes (Actor / Asset / Claim / Parse Result / Eval Result).
   - **src/v2/v2_2Data.js** — data model factories, view derivation (`buildViewForActor`), edge derivation (`deriveAgreementEdges`), canvas adapter (`buildV22Canvas`).
   - **src/v2/V2Canvas.jsx** — canvas rendering, edge derivation, pan/zoom, raycaster, LOD switching.
   - **src/v2/AssetNode.jsx** — node card rendering (full / mini / dot LOD), V22ActionBar.

## Additional files as needed per phase

Other source files (modals, animation primitives, etc.) are loaded into context as each phase scopes:

- `src/components/modals/CombinedRequestModal.jsx`, `CombinedResponseModal.jsx`, `EARequestModal.jsx` — Disclosure / Evaluation request flows (Phase 11C foundation).
- `src/components/modals/V22RunEvaluationModal.jsx`, `V22ParseEvidenceModal.jsx` — evaluation + parse processing flows.
- `src/components/modals/AmendDisclosureModal.jsx`, `AmendClaimModal.jsx` — amendment flows.
- `src/components/modals/V22RevocationConfirmModal.jsx`, `V22DismissEvalResultModal.jsx` — revocation flows.
- `src/components/modals/ExpandedArtifactModal.jsx` — Detail Panel expand modal (Phase 11B / 11D.x).
- `src/v2/animations/reveal.js`, `src/v2/animations/unravel.js` — animation primitives.
- `src/components/DetailPanel/DisclosureAgreementDetailPanel.jsx`, `EvaluationAgreementDetailPanel.jsx` — Agreement panels.

## Round 12 closing state

- **Phases completed:** 11A, 11A.1, 11B, 11B.1, 11B.2, 11C, 11C.1, 11C.2, 11C.3, 11C.4, 11C.5, 11D, 11D.1, 11D.2, 11D.3, 11D.4, 11D.4.1, 11.5 (this hygiene pass).
- **Last commit:** see `git log -1 --oneline` after the Phase 11.5 commit.
- **Footer version:** v0.11.12 (after Phase 11.5).
- **Disclosure types:** Full, Selective, Proof-only all wired end-to-end across canvas, edges, panels, modals (Phase 11D.2 + 11D.3 + 11D.4 + 11D.4.1).
- **Demo roles:** Alice (MicroCo, supplier), Bob (GovCo, buyer), Carol (AuditCo, auditor), Dave (ChipCo, supplier) — all switchable.
- **Animation primitives:** `playUnravelAnimation` (Phase 9D.2.x) for nodes leaving the canvas; `playRevealAnimation` (Phase 11C.3) for provisional → active flip.

## Phase 11E queue

When starting Round 13, the natural first phase is the three items deferred during Phase 11:

- **#108** Amend EA modal — Effort: L. Pattern-match `AmendDisclosureModal.jsx` into `AmendEvaluationAgreementModal.jsx`. Wire the Amend action from EA edges + EA Detail Panel footers (matching DA parity).
- **#102** Reciprocal DA-amendment notifications — Effort: M. **High priority — UX confusion.** When Alice amends a Claim, Bob (counterparty) sees a NEW badge without notification context. Fire `v22-amendment` to every counterparty with an active Disclosure Agreement on the affected Claim.
- **#139** Edge geometry animation during reveal flip — Effort: M. As the Claim card flips during reveal, an edge "draws" from the requester's anchor Asset toward the now-active Claim. Could share primitive with `playEdgeRetract` (inverse).

Order suggestion: ship #102 first (smallest effort, highest priority), then #108, then #139 if time. Or split #108 into a phase of its own and combine #102 + #139 as "notifications + animation polish."

## Phase 12 queue (after 11E) — Evaluation Enhancements

- **#117** Re-Run Evaluation: permissive Asset selection with audit metadata — Effort: M. Pre-populate prior set as default; allow free toggling; record diff in metadata.
- **#105** Run Evaluation modal: empty-evidence copy update — Effort: S. Role-split copy.
- **#106** Remove evidence picker from Run Evaluation modal — Effort: M. Larger design question — evaluation becomes Claim-level rather than Asset-picker-level.
- **#120** Reference published Requirements Sets on a Claim (non-binding) — Effort: M. Discoverability path; pairs with #114.
- **#121** Evaluate a Claim against multiple Requirements Sets simultaneously — Effort: L. Open design questions on output shape (1 vs N Eval Results).
- **#122** Remove evidence from a Claim despite prior evaluation (e.g., expired license) — Effort: M. Breaks current platform invariant; needs design pass.

## Phase 13 queue (after 12)

- **#26** Cascading Disclosures — Effort: XL. When Alice discloses an Asset to Bob, and Bob creates a Claim referencing Alice's Asset, the cascading disclosure behavior should propagate correctly through Bob's Claim to his own counterparties.

## Phase 14 queue (after 13) — Radiant Network refinements

- **#43** Clickable Directory Layer dots — Effort: L. Per-dot interactivity (hover + click) backed by public-directory Claim artifacts.
- **#45** Real dot-cloud data sourcing — Effort: M. Replace mock supplier clusters with view-builder-derived counts.
- **#46** Corner-node morph on Directory entry/exit — Effort: M. Continuous transform of the chrome icon → corner anchor.
- **#47** Real AI Shopper result streaming — Effort: L. Streaming candidates as the search runs.
- **#132** Umbrella DA edge visualization — Effort: M. Render an edge from active actor's corner card to the cluster, styled by SDA type.

## Phase 15 queue (after 14) — Detail Panel + chrome polish

- **#11** Two-tab Overview/Artifact layout for DA + EA Detail Panels — Effort: M. Match node panel structure.
- **#48** Candidate preview before Request Agreement — Effort: M. Read-only panel showing public-directory Claim metadata.
- **#104** Click-to-jump navigation from Detail Panel association lists — Effort: M. Phase 11D.3 wired Eval Result row click; remaining lists (Parse Results, Agreements) deferred.

## Beyond Phase 15

Items in the polish backlog without explicit phase assignment continue to live in their topic sections with `Status: Open` or `Status: Investigation`. They surface for triage at phase boundaries. Notable design-blocker items:

- **#82** Parse Result DOT + layer placement — needs client decision on DOT semantics + child vs parent layer.
- **#114** Umbrella Disclosure full semantics — partial (Phase 11A seeded Dave/ChipCo); auto-extend rules for catalogs + Asset hierarchy interaction still scoping.
- **#115** Evaluation Agreement terms checkboxes — partial (two acknowledgments shipped); full term list waits on Andrew's ideation pass.

## What's NOT in the queue

These were deliberately deferred or blocked during Phase 11 and shouldn't be picked up without explicit revisit:

- **#49** Rename `src/v2/` to `src/` — high-blast-radius cascading import-path changes; needs a dedicated atomic pass.
- **#50** Dead V2.1 handler sweep in V2App.jsx — file noise but no functional issue; sweep when convenient.
- Any items with `Status: Investigation` until the blocking decision is resolved.

---

**Phase 11.5 (this hygiene pass) deliverables:**
- `polish-backlog.md` reorganised — completed items in `## Completed` section at the bottom; open items have standardised `Status` + `Effort` fields.
- `architecture-spec.md` audited — Phase 11 summary entry added; §6.5 cross-canvas pull-in rule for proof-only added; §7.4 notification table extended with transfer + revocation types; §14 staleness flagged inline; "Sections requiring expansion" closing note added.
- `ROUND-13-CONTEXT.md` (this file) created.
- `CLAUDE.md` Phase 11.5 hygiene-pass note appended.
