# Radiant by Provenance — Repository Operating Manual

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`.

For historical phase notes (every per-phase completion entry from Phase 1 through Phase 11E.1), see [`CLAUDE-phase-log.md`](./CLAUDE-phase-log.md). For the architectural model, see [`architecture-spec.md`](./architecture-spec.md). For the open / partial / deferred work queue, see [`polish-backlog.md`](./polish-backlog.md). For the next-conversation foundation upload checklist, see [`ROUND-13-CONTEXT.md`](./ROUND-13-CONTEXT.md).

**Commands:**
- `npm run dev` — development server
- `npm run build` — must pass clean before shipping any change

---

## Architecture

The canonical source of truth for the platform architecture is `architecture-spec.md` in the repo root. Read it first; return to this file only for repo conventions and the (archived) phase history.

The architecture rests on two foundational rules:

1. **Assets are distinct from Claims.** Claims *reference* Assets; they don't *contain* them. Assets are first-class parent-layer nodes.
2. **Evaluation Agreements gate Claim visibility.** A Disclosure Agreement alone grants visibility; the paired Evaluation Agreement is what pulls another party's Claim onto your canvas.

There is one edge type (the Agreement Edge). Ownership, Proof-of-Evaluation, and Public Directory relationships are all modeled as implicit Disclosure Agreements on the same edge primitive. See spec §4 for the rationale.

### File layout

- `src/v2/` — application code (V2App, V2Canvas, DirectoryLayer, boot screen, PrimeRadiant, data model).
- `src/v3/` — archived V3 reference (UI patterns only, not active).
- `src/components/modals/` — modal components.
- `src/components/DetailPanel/` — node + agreement detail panels.
- `src/v2/animations/` — animation primitives (`reveal.js`, `unravel.js`).
- `src/assets/`, `src/index.css` — shared styling + static assets.
- Entry points: `v2.html` (primary), `v3.html` (archived reference).

### Demo actors

- **Bob Donloe** @ GovCo (buyer) — DOT: `DONLOE.BOB.J.1384297560`
- **Alice Nakamura** @ MicroCo (supplier)
- **Carol** @ AuditCo (auditor)
- **Dave** @ ChipCo (supplier — added Phase 11A; switchable role since 11C)
- Role switching via user menu; does not replay boot animation.

### Boot sequence

CAC login → Prime Radiant 3D → golden ripple → network build animation. Session storage key: `radiant-v2-booted`.

---

## Working Conventions

### Code style

- CSS variables always; never hardcode colors. Use `color-mix()` for alpha blends.
- SVG icons only. Unicode symbols (✓, ×, ▸, ◂, ■, ◆, ◇) are acceptable. No emojis.
- Timestamps use `date` + `dateTime` fields. Display format: `YYYY-MM-DD · HH:MM UTC`.
- Escape key handling: input/textarea focused → blur only; editor mode → exit to view; nothing focused → close modal.
- Click-to-copy on all PIN displays with visual feedback.
- Type labels (`ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`) in mono font, informational only — see spec §3. State badges (`PROVISIONAL` / `DECLINED` / `SUPERSEDED` / `NEW`) render as separate inline badges.

### UX patterns

- **Accept/decline in modals, not notifications.** Party-to-party action responses (accept, decline, amend, etc.) open a modal for the user's decision. The notification is the *entry point* — it surfaces that an action is required — but the decision itself happens in a modal following the Disclosure Response pattern (`CombinedResponseModal`). Do not embed accept/decline buttons inline within notification rows. When declining, the decline-reason textarea lives inside the modal, not inline.
- **Picker defaults + scroll containers.** Multi-select artifact pickers that require at least one selection (Assets, Claims, Requirements Sets, Eval Results, etc.) default to zero selected — force the user to make an explicit choice. Empty-state help text uses amber italic inline styling and states the requirement ("Select at least one Asset to continue."). Picker lists render inside scroll containers (`max-height` + `overflow-y: auto`, typically 240–320px) so they scale to N>>10 without breaking the modal layout. Optional pickers (e.g., evaluation evidence, which can be run as self-attestation) may sensibly pre-select, but default to zero whenever selection is required.
- **Reciprocal notifications for all party-to-party actions.** Every party-to-party action that requires counterparty acknowledgment (accept, decline, cancel, amend, etc.) MUST fire reciprocal notifications on each state change. A transfer request creates `v22-transfer-request` on the recipient; acceptance creates `v22-transfer-accepted` on the sender; decline creates `v22-transfer-declined`; cancellation creates `v22-transfer-cancelled`. Both sides see every transition in their notification chrome. Missing reciprocal notifications are bugs regardless of whether the state change is visible elsewhere in the UI.

### Autonomous workflow

- Work at `xhigh` effort.
- Perform a structured review against the task's acceptance criteria before declaring a change complete.
- **Runtime verification is required** for any change that touches a React component. Start the Vite dev server (`npm run dev`), confirm the app loads with no console errors, and exercise the affected flow. Build success and pure-data sanity scripts are insufficient — they don't catch TDZ errors, hook-rule violations, or other init-time exceptions. If a real browser isn't reachable, fall back to a JSDOM render check.
- When you hit a genuine ambiguity (a contradiction in the spec, a missing piece of information required for a correct decision), **stop and surface it.** Do not guess.
- The V2Canvas 3D raycaster does not respond to DOM-dispatched events — scripted UI walkthroughs of canvas-click flows are not possible from the agent session. Manual mouse interaction is the canonical verification path for canvas clicks; data-layer probes + module-load verification are the structural backstops. This limitation has been documented since Phase 9A.6.

### Documentation conventions

- **Per-phase completion notes** go into [`CLAUDE-phase-log.md`](./CLAUDE-phase-log.md) under a new `### Phase X.Y completion notes (YYYY-MM-DD) — short title` heading. Each note covers what shipped, deviations from the brief, fold-ins, runtime verification, known scope boundaries, and a `**Status:** [x] Complete.` footer.
- **Spec changes** go into `architecture-spec.md` Changelog section as a `- **§X.Y — Phase Z:** ...` bullet. Substantial new behavior gets a new subsection inline at the relevant section.
- **Open backlog items** go into `polish-backlog.md` topic sections with `Status` + `Effort` fields. Completed items move to the bottom-of-file `## Completed` section preserving full Status entries.
- **In-app Changelog modal** entries go in `src/v2/V2App.jsx`'s Changelog releases array, prepended above the previous version. Footer version constant in V2App.jsx is also bumped.
- **Cross-role notification fan-out** is documented in `architecture-spec.md` §7.4 as new rows in the notification table.

---

## Current state of the world

- **Footer version:** v0.11.23 (bumped during Phase 11E.5).
- **Last shipped phase:** Phase 11E.5 — Edge draw-in geometry growth fix + notification deep-link edge selection + #164 backlog filing.
- **Active phase queue:** Round 13 next-up is the rest of Phase 11E (#102 reciprocal DA-amendment notifications + #139 edge geometry animation), then Phase 12 (Evaluation Enhancements: #117, #105, #106, #120, #121, #122). Full queue lives in `ROUND-13-CONTEXT.md`.
- **Disclosure types fully wired end-to-end:** Full, Selective, Proof-only — all three branches of grantee view derivation (canvas + edges + Detail Panel + Expand modal) shipped through Phase 11D.
- **Animation primitives:** `playUnravelAnimation` (Phase 9D.2.x — node leaves canvas) and `playRevealAnimation` (Phase 11C.3 — provisional → active flip). Both live under `src/v2/animations/` and are await-able promises returning at phase 'done'.
- **Layout grid:** all node X / Y / column / hierarchy-shift constants are multiples of 100 (Phase 10.2.1 grid alignment); `symmetricRowY(i)` helper distributes rows alternately around y=0; per-column `COL_Y_OFFSET = 100` separates adjacent column traffic lanes.
- **Chrome surfaces:** notification bell (with unread badge + cross-role amber dot per Phase 11D), Library button (unified Parsing Templates + Requirement Sets + Published Requirements per Phase 10.3), AI Shopper magnifier, Radiant Network globe (toggle Directory Layer entry/exit), Credits pill, user menu (Switch User dropdown with per-role amber dot for cross-role notifications), Theme toggle.
- **Detail Panel surfaces:** V22ActorPanel / V22AssetPanel / V22ClaimPanel / V22ParseResultPanel / V22EvalResultPanel (in `V22NodeDetailPanel.jsx`), DisclosureAgreementDetailPanel, EvaluationAgreementDetailPanel. All node panels carry an Agreements section (Phase 9C). Modal Expand affordance restored Phase 11B + 11D.x.

---

## Phase log

The full per-phase completion log lives in [`CLAUDE-phase-log.md`](./CLAUDE-phase-log.md). It contains every phase note from Phase 1 (V2.2 data model foundation, 2026-04-17) through Phase 11E.1 (Amend Evaluation Agreement, 2026-04-30), in chronological order.

The original V2.2 migration ran in eight phases:

- [x] Phase 1: Data Model Foundation
- [x] Phase 2: Parent Layer Restructure
- [x] Phase 3: Edge Clickability + Agreement Panels
- [x] Phase 4: Combined Request + Response Flows
- [x] Phase 5: Evaluation Flow + Eval Results on Parent Layer
- [x] Phase 6: Amendment Flows
- [x] Phase 7: Directory Layer + AI Shopper
- [x] Phase 8: Consolidation + Cleanup

Post-migration work shipped through Phases 9A → 9E-parallel.x, 9D.1 → 9D.2.x, 10.x, and 11A → 11E.1. See `CLAUDE-phase-log.md` for the full narrative.
