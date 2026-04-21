# Radiant by Provenance — Architecture Spec

**Architecture Reference**

This document is the single source of truth for the Radiant by Provenance architecture. It is designed for two audiences: Andrew (product) reading for comprehension and review, and Claude Code reading for autonomous implementation. The per-phase migration history from the V2.1 → V2.2 transition is preserved in the changelog at the end of this document.

---

## 1. Summary

The platform rests on two foundational rules established during the V2.1 → V2.2 architecture review:

**Rule 1 — Assets are distinct from Claims.** Claims *reference* Assets; they don't *contain* them. An Asset is an evidence file registered on the platform as a first-class node. A Claim is an assertion that references one or more Assets. Alice can have many Claims referencing overlapping Asset sets (the driver's license Asset might back both a Citizen Claim and an Age Verification Claim).

**Rule 2 — Evaluation Agreements are the gateway.** A Disclosure Agreement only grants visibility; it does not pull the Claim into another party's network. That requires a second artifact: an Evaluation Agreement. The Evaluation Agreement is what causes Alice's Claim to render as a node on Bob's canvas, with evaluation as the explicit purpose of the connection.

These two rules scale cleanly to auditors (Carol), self-evaluation (Alice using OSHA's requirements on her own factory), and the Public Directory at scale (the AI Shopper browsing thousands of Claims). The Disclosure → Evaluation Agreement sequence is the platform's fundamental inter-party relationship.

> **Document structure note.** Sections §1–§11, §15–§17 describe the current platform architecture. §12 (V2.1 → V2.2 Migration Map) and §13 (Phased Implementation Plan) are preserved verbatim as historical record of the 2026-04 migration — they're no longer operative guidance but remain useful for understanding *why* certain component decisions were made. §14 implementation guidelines have been collapsed into operating conventions; see `CLAUDE.md` for the authoritative working-conventions reference.

---

## 2. Core Data Model

### 2.1 Actors

An Actor is an entity on the platform with qualified storage, a public key, and the ability to own Assets and Claims. Actors are drawn from `ROLES` in `v2Data.js`. Each Actor has:

- `id`: internal identifier (`bob-govco`, `alice-microco`, `carol-auditco`)
- `user`: human name (`Bob`, `Alice`, `Carol`)
- `party`: organization name (`GovCo`, `MicroCo`, `AuditCo`)
- `partyDot`: cryptographic identifier (`DOT-0x...`)
- `role`: functional role (`buyer`, `seller`, `auditor`, etc.) — informational only, does not restrict actions
- `credits`: available platform credits
- `vertical`: industry context

The Public Directory (`Radiant Network`) is a pseudo-Actor that owns nothing but receives disclosures.

### 2.2 Inputs

Users provide exactly one kind of input: **Evidence**. An Evidence input is any file the user has in their qualified storage that they select for use on the platform. The file itself is not uploaded to the platform; its URI, hash, and metadata are registered on-chain and referenced by downstream artifacts.

### 2.3 Processes

Six processes operate on the platform. A seventh — Transferring (ownership transfer, producing a new DOT) — is defined in the model but out of scope for this migration. It will likely be added in a later phase; Claude Code should not plan around it but should not make data-model choices that preclude it (e.g., keep `ownerDot` on artifacts addressable rather than hardcoded).

| Process | Input | Output | Who can initiate |
|---------|-------|--------|------------------|
| Registering | Evidence file from QS | Asset node | Evidence owner |
| Parsing | An Asset + a Parse Template | Parse Result (parent-layer node) | Asset owner |
| Claiming | One or more Assets | Claim node | Asset owner |
| Disclosing | A Claim | Disclosure Agreement | Claim owner |
| Agreeing | A Disclosure Agreement | Evaluation Agreement | Both parties (grantor responds to grantee's request) |
| Evaluating | An Evaluation Agreement + Requirements Set | Evaluation Result | Grantee (evaluator) |

Parsing is formally optional, but it is a prerequisite for **Selective Disclosure**: Selective Disclosure discloses specific parsed fields rather than raw files, so a Parse Result must exist on an Asset for Selective Disclosure of that Asset's fields to be possible. Full Disclosure and Proof-Only Disclosure do not require parsing.

**Proof-Only Disclosure** requires an Eval Result to exist on the Claim at response time — it discloses one or more specific Eval Results rather than raw Assets or parsed fields. The response modal lists the Claim's existing active Eval Results with a toggle picker; if none exist, the modal surfaces an informational message and suggests switching to Full or Selective. (Phase 6 carry-over.)

**Parsing and Evaluating are deliberately similar processes.** Both apply a structured template to evidence and produce a structured output artifact with confidence-scored rows. Parsing's template is a Parse Template (extracted fields, no assessment). Evaluating's template is a Requirements Set (extracted values plus SAT/UNSAT/MISSING/N/A assessment per row). Both processes use the same split-panel UI pattern, the same row-level structure, and the same ConfidenceBadge/assessment cycling components. They are presented as distinct processes in V2.2 to match current client mental model; their unification is flagged as intended future direction in §17.

### 2.4 Outputs

Every process produces a stored artifact. All artifacts are JSON documents in the originating party's qualified storage, referenced by a URI and hash stored on-chain.

| Artifact | Stored as | Storage location |
|----------|-----------|------------------|
| Asset | Registered file metadata + the file itself | Owner's QS |
| Parse Result | JSON | Owner's QS |
| Claim | JSON | Claim owner's QS |
| Disclosure Agreement | JSON | Both parties' QS (bilateral) |
| Evaluation Agreement | JSON | Both parties' QS (bilateral) |
| Evaluation Result | JSON | Evaluator's QS |

Agreements are bilateral — both parties store identical copies as proof of mutual consent. Evaluation Results are unilateral — only the evaluator stores them, though they are visible to the Claim owner through the agreement relationship.

### 2.5 Storage

All artifacts live in qualified storage (QS). QS is an actor-controlled storage layer (think S3, Dropbox, or on-prem file servers) that the platform indexes but does not host. The platform maintains an indexing layer that maps URIs and PINs to storage locations; the actual content remains on the actor's infrastructure.

For the prototype, QS is mocked: a fake file picker shows pre-populated files per actor.

### 2.6 DOTs and Identity

Every registered data element — Asset, Claim, Evaluation Result — is anchored by a **DOT** (Data Object Title). The DOT is a cryptographically verifiable identity object: it carries a PIN (the everyday identifier, printed on the DOT), the content hash where applicable, the current owner's **DID** (Decentralized Identifier — a W3C-standardized format for verifiable digital identities, see [w3.org/TR/did-core/](https://www.w3.org/TR/did-core/)), the registration timestamp, free-form metadata, and an append-only ownership lineage. This structure follows client canon X.1–X.10.

**The car-title analogy.** A DOT is to a data element what a vehicle title is to a car. The PIN is the VIN — it's printed on the title and used as the everyday identifier, but the title (the DOT) is the thing that establishes and transfers ownership. Transferring a car doesn't move the car; it re-registers the title to a new owner and records the state change on the back. Transferring an Asset on the platform works the same way: the file doesn't move, but the DOT updates (the `ownerDid` field flips to the recipient) and an immutable transfer record is appended to `lineage[]` as a verifiable provenance chain (canon X.5).

**PIN vs DOT in the UI.** PINs render as click-to-copy badges throughout the app — they're the identifier users read, copy, and paste when referring to a specific Asset or Claim. The surrounding DOT is plumbing: it's what the ledger verifies and what transfers manipulate, but it isn't typically exposed in UI except in Detail Panels, where the DOT's own PIN is surfaced alongside the file hash and URI (the Asset Detail Panel's "DOT" row shows `asset.dot.pin`, not the owner DID — owner identity surfaces via the "Owner" row).

**Why DOTs matter for this build.** Without a structured DOT, ownership is denormalised: `asset.owner` is the current owner's party name, but there's no provenance chain to show who held it before, and no clean place to record "this transfer happened at this timestamp, from this DID to this DID." The DOT gives transfers a proper home in the data model and enables any auditor to verify the full chain independently — which is the whole point of the Trust Plane.

---

## 3. Node Types on the Parent Layer

Every parent-layer node has the same base structure: PIN, DOT, owner, name, artifact URI, timestamp, and a JSON artifact. They differ in what they represent and what fields their JSON contains. Every node renders a small mono type label in the card header (`ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`, etc.) to disambiguate across the crowded parent layer.

**Type label + state badges layout.** The mono type label sits on its own line above the node name (Phase 3 carry-over; the original inline badge truncated long names). Lifecycle-state badges — `PROVISIONAL`, `DECLINED`, `SUPERSEDED`, `NEW` — render as separate inline badges in the card header, independent of the type label. They are never concatenated as suffixes onto `v22Type`. When multiple states apply, `DECLINED` takes precedence over `PROVISIONAL` (a declined provisional Claim renders as DECLINED, not PROVISIONAL). `SUPERSEDED` applies only to Eval Result nodes and renders alongside a dimmed card style. (Phase 6 / Phase 6.5+.)

### 3.1 Actor Node

The user's own organization (GovCo for Bob, MicroCo for Alice, AuditCo for Carol). Always present, always in the same corner. Represents the user's identity on the platform.

- Rendering: single persistent node, typically top-left or center-left of the canvas.
- Connections: has Agreement Edges (styled as Full Disclosure) to every Asset and Claim the user owns, representing implicit internal full disclosure.
- Detail Panel: shows organization metadata, aggregate statistics (N Assets, N Claims, N active Agreements).

### 3.2 Asset Node

A registered evidence file. Contains the file's URI, hash, size, MIME type, and registration metadata. Assets are *private* — they only appear on their owner's network.

- Visual label: `ASSET` (small mono tag in card header).
- Identity: anchored by a DOT object (see §2.6). The Detail Panel's "DOT" row surfaces `asset.dot.pin` (the Asset's own DOT identifier). The "Hash" row surfaces `asset.file.hash` (identical to `asset.dot.hash` for Assets). The "URI" row surfaces `asset.file.uri`. `asset.dot.ownerDid` is also accessible on the artifact but not rendered in the panel UI yet — provenance lineage is a future phase.
- Display name: `asset.name` — the user-facing display name rendered on the card and panel header. Default is the filename stem (e.g., `power-supply-spec.pdf` → `power supply spec`); the registration modal exposes an editable per-file input so the user can refine the default before committing.
- Key JSON fields: `name`, `fileUri`, `filename`, `size`, `mimeType`, `hash`, `registrationDate`, `parseResultIds[]`, `dot`.
- Child layer: intentionally empty in V2.2 (child layer code retained but unused — see §5).
- Can be referenced by: one or more Claims owned by the same actor.
- Cannot be disclosed directly — only Claims can be disclosed.
- **Transferable** — Asset ownership can be transferred between parties; see §11.7.

### 3.3 Parse Result Node

The output of a Parsing process applied to an Asset. Contains extracted fields with confidence scores.

- Visual label: `PARSE RESULT`.
- Key JSON fields: `sourceAssetId`, `templateId`, `templateName`, `templateVersion`, `fields[]` (each with `id`, `name`, `value`, `confidence`), `parseDate`.
- Connections: Agreement Edge (Full Disclosure) to the source Asset (same owner, implicit internal disclosure).
- Rendered on: only the owner's network. Parse Results of an Asset are visible to a counterparty only through the Disclosure Agreement scope (Selective Disclosure references specific fields from specific Parse Results).
- Future direction: Parse Results may themselves become disclosable artifacts in a later phase — currently they travel with their source Asset through Disclosure scope.

### 3.4 Claim Node

An assertion backed by one or more Assets. The gateway to other parties. **Constraint: a Claim must reference ≥1 Asset** — Claims with zero `referencedAssetIds` are not permitted, and creation UI must enforce this at submit.

- Visual label: `CLAIM`.
- Identity: anchored by a DOT object (see §2.6). `claim.dot.hash` is null — Claims are derived artifacts without a canonical file.
- Key JSON fields: `name`, `description`, `referencedAssetIds[]`, `creationDate`, `amendments[]`, `dot`.
- Connections on owner's canvas: Agreement Edges (styled as Full Disclosure) to each referenced Asset, and Agreement Edges (styled by disclosure type) to each counterparty's Asset for each active Disclosure + Evaluation Agreement pair.
- Can be disclosed to: specific parties (via Disclosure Agreement) or to the Public Directory.

### 3.5 Evaluation Result Node

The output of an evaluation. Owned by the evaluator; visible to both evaluator and Claim owner (and any other party the evaluator grants disclosure to — e.g., Carol disclosing her audit result to Bob).

- Visual label: `EVAL RESULT` (or `SUPERSEDED` if superseded).
- Identity: anchored by a DOT object (see §2.6). `evalResult.dot.hash` is null; metadata carries `claimId` and `evaluationAgreementId` so the provenance chain can be navigated from the DOT alone.
- Key JSON fields: `evaluatorId`, `claimId`, `evaluationAgreementId`, `requirementsSet` (embedded snapshot: id, name, version), `results[]` (SAT/UNSAT/MISSING/N/A per requirement with values), `evidenceUsed[]` (Asset IDs), `supersededBy` (null or eval result ID), `status` (`active` | `superseded`), `dot`.
- Health minibar: rolls up from `results[]`, excluding N/A items.
- Connections: Agreement Edge to the Claim it evaluated (the Proof of Evaluation relationship, modeled as an implicit Full Disclosure Agreement from evaluator to Claim owner scoped to this Eval Result). Additional Agreement Edge to the evaluator's own Asset (ownership relationship).
- Rendered on: both the evaluator's network AND the Claim owner's network. On the Claim owner's side, it is displayed but action-restricted (Amend, Supersede, Disclose-to-other-parties live with the evaluator only). Ownership is conveyed by which actions are available, not by visual treatment — see §15 for future visual-distinction work.
- Superseded Eval Results remain visible with `SUPERSEDED` label and dimmed styling; they do not contribute to minibar rollups elsewhere.

### 3.6 Radiant Network Node

The Public Directory, appearing as a node on the user's canvas only if the user has Claims disclosed to the public directory. Double-clicking enters the Directory Layer (see §8).

- Visual: distinct styling (globe icon, different border color, etc.) to signal its cross-layer role.
- Connections: Agreement Edges (styled by disclosure type, with the Radiant Network as grantee) to every one of the user's Claims that have a public directory Disclosure.
- Detail Panel: summary of the user's published Claims and directory statistics.
- Note: the Radiant Network **button** in the canvas chrome is always present. The Radiant Network **node** on the canvas appears only if the user has published Claims.

---

## 4. Edge Type

V2.2 has **one edge type**: the **Agreement Edge**. Every visible connection on the canvas represents a Disclosure Agreement — explicit (between different parties) or implicit (within the same actor's own network, ownership relationships, and Proof-of-Evaluation relationships). Every edge is clickable; clicking opens the Disclosure Agreement Detail Panel, and if a paired Evaluation Agreement exists, an edge menu presents both options.

### 4.1 Why one edge type

The client model supports this simplification cleanly:

- **Ownership** (Actor → Asset, Actor → Claim, Claim → referenced Asset, Eval Result → evaluator's Asset) is modeled as an implicit Full Disclosure Agreement where the grantor and grantee are the same actor. The JSON artifact exists in the data model for consistency; its Detail Panel displays "Internal — MicroCo to MicroCo" or similar.
- **Proof of Evaluation** (Eval Result → Claim) is modeled as an implicit Full Disclosure Agreement from the evaluator (grantor) to the Claim owner (grantee), scoped to the Eval Result artifact. This naturally handles Carol disclosing her Eval Result to Bob later — same shape, different parties.
- **Public Directory disclosure** is a standard Disclosure Agreement with Radiant Network as grantee; no special edge type needed.
- **Explicit inter-party agreements** use the same edge type, styled by the Disclosure Agreement's `type` field.

Two benefits: cleaner mental model, fewer rendering cases in canvas code.

### 4.2 Visual styling

The Agreement Edge's appearance is determined by the backing Disclosure Agreement's `type`:

| Disclosure type | Style | Color |
|-----------------|-------|-------|
| `full` | Solid line | Indigo (`#6b8aff`) |
| `selective` | Dashed line | Amber (`#f59e0b`) |
| `proofonly` | Dotted line | Green (`#22c55e`) |
| `provisional` (pending response) | Dashed | Muted grey (`var(--border)`) |
| `expired` | Solid | Muted grey with reduced opacity + `EXPIRED` label tag on hover |

Styling applies to all Agreement Edges uniformly — internal/ownership edges use the same Full Disclosure indigo as an inter-party Full Disclosure. This signals "everything on this canvas is a relationship; the differences are about terms." For canvases that feel dense, we may later introduce subtle visual de-emphasis for internal edges (see §15 open questions).

### 4.3 Clickability and edge menu

Clicking an Agreement Edge opens a small contextual menu near the click point:

- **View Disclosure Agreement** — always present. Opens the Disclosure Agreement Detail Panel.
- **View Evaluation Agreement** — present only if the Disclosure Agreement has a paired Evaluation Agreement. Opens the Evaluation Agreement Detail Panel.

If an edge has no paired Evaluation Agreement (e.g., ownership edges, public directory edges), clicking it opens the Disclosure Agreement Detail Panel directly, skipping the menu.

### 4.4 Selected edge state

When an edge is selected (active Detail Panel open for it, or hovered in an interaction context), its visual treatment changes:

- Color shifts toward white: the disclosure-type color is lightened by blending 65% with pure white, producing a brighter variant of the same hue. (Original Round 11 spec called for 40%; bumped during Phase 3 visual testing — the lower blend was imperceptible on amber dashed and green dotted lines against the dark canvas.)
- Stroke width increases by +1.5px above the base disclosure-type stroke. (Original Round 11 spec called for +0.5px; bumped along with the colour blend for visibility parity across all four disclosure types.)
- Dash/dot pattern is preserved (Selective stays dashed, Proof-Only stays dotted).
- Adjacent nodes are *not* automatically selected; edge selection is independent of node selection.

Canvas rendering (`V2Canvas.jsx` or equivalent) needs a `selectedEdgeId` prop to drive this state. Edge selection clears when the Detail Panel closes or when a different edge/node is selected.

### 4.5 Edge routing

Edge routing logic carries forward from V2.1 unchanged. The parent layer will become significantly more crowded with Assets, Claims, Parse Results, and Eval Results all as first-class nodes; edge crossings are expected. Post-migration, we may revisit routing (orthogonal routing, edge bundling) if the canvas becomes unreadable in demo scenarios. For V2.2 implementation, accept current routing.

---

## 5. Child Layer

**In V2.2, the child layer is intentionally empty.** All artifacts (Assets, Parse Results, Claims, Evaluation Results) are rendered as first-class parent-layer nodes.

The child layer code — dive/surface mechanics, layer transition animations, child tree layout, `V2Canvas.jsx` layer state — is retained in full. It is not used in V2.2 demo paths, but is preserved so that a future phase can evaluate whether to collapse specific output types (e.g., Parse Results, Eval Results, or derived artifacts) back into child layers of their source nodes to reduce parent-layer clutter.

This is an intentional trade-off: V2.2 prioritizes "everything visible on the canvas" to let the client walk through full flows with nothing hidden. If the parent layer becomes unreadable in demo scenarios, the child layer scaffolding is ready to absorb lower-priority nodes in a V2.3 polish pass.

**Forbidden during this migration:** do not delete, refactor, or simplify the child layer code. Its presence is part of the migration strategy.

---

## 6. User Views

Each actor sees a different slice of the graph. What appears on a canvas is determined by (a) what the actor owns, (b) what has been disclosed to them via Disclosure + Evaluation Agreements, and (c) what Evaluation Results they are a party to.

### 6.1 Alice's View (seller/claim-maker)

- Her MicroCo Actor node.
- All her Assets, connected to her Actor node.
- All her Claims, connected to the Assets they reference.
- For each Disclosure + Evaluation Agreement she has granted: the counterparty's Asset (Bob's Asset, Carol's Asset), pulled into her canvas with an Agreement Edge to the relevant Claim.
- Every Evaluation Result produced against her Claims (owned by Bob, Carol, etc. but visible to her).
- Radiant Network node if any of her Claims are publicly disclosed.

### 6.2 Bob's View (buyer/evaluator)

- His GovCo Actor node.
- His own Assets (his internal registered evidence).
- His own Claims (if any).
- For each Evaluation Agreement he holds: the counterparty's Claim (Alice's Claim, Carol's Claim) pulled into his canvas with an Agreement Edge to his Asset.
- His own Evaluation Results, connected to the Claims he evaluated and to his Asset.
- Radiant Network button in the chrome (always present). Radiant Network node on canvas only if he has published Claims of his own.

### 6.3 Carol's View (auditor)

Carol's view is mechanically identical to Bob's. The "auditor" designation is informational; Carol's workflow uses the same processes as any other evaluator. Her Evaluation Results are her own and can be disclosed to other parties (e.g., to Bob as proof of audit completion), which in turn uses a proof-only Disclosure Agreement + Evaluation Agreement from Carol's Evaluation Result back to Bob's Asset.

### 6.4 What does NOT appear on each view

- Alice does not see Bob's internal Assets (the ones not involved in an Agreement with her).
- Bob does not see Alice's individual Assets — he only sees her Claim. He may see referenced Asset metadata inside the Claim's Detail Panel depending on the disclosure type, filtered to the in-scope subset when the viewer is a grantee rather than the owner. (Phase 6.5.)
- Neither party sees the other's Evaluation Agreements with third parties.

### 6.5 Cross-canvas pull-in rules

The view builder (`buildViewForActor`) follows these pull-in rules; they are a clarification of §6.1–6.4 rather than new behaviour:

1. **Accepted inter-party DA pull-in.** For every active inter-party Disclosure Agreement + Evaluation Agreement pair that names the actor, pull in the counterparty Claim (grantee side) or the grantee's anchor Asset (grantor side). The grantor's individual Assets are NOT pulled onto the grantee's canvas — only the Claim is (§6.4). (Option B in the polish backlog contemplates pulling scope-named Assets onto the grantee canvas too; currently the eval modal works around this by resolving evidence Assets from the shared dataset. Phase 6.5.)

2. **Provisional DAs do not pull anything onto the grantor's canvas.** While a request is awaiting response, the provisional Claim + provisional Agreement Edge appear only on the requester's canvas. The grantor learns about the request via a `v22-request` notification (see §7.4), not via a new node. On accept, the grantee anchor Asset additionally receives an `_isNew` reveal on the grantor's canvas — both canvases animate on the transition, not just the grantee's. (Phase 6 / Phase 6.5.)

3. **Second-pass counterparty internal DA inclusion ("Carol orphan fix").** After the first-pass actor-owned + accepted-DA pull-in, the builder runs a second pass: it includes counterparty-owned internal DAs whose endpoints are *all* already visible on the actor's canvas. Concretely this applies today to Eval-Result ownership DAs (subject=`evalResult` with `scope.assetIds` non-empty) — on Alice's canvas, Bob's PRM Eval Result and Carol's audit Eval Result render their ownership edges to the Assets that are already pulled in, so the Eval Result node isn't left visually orphaned. No new edge types and no new counterparty Actor nodes are introduced. (Phase 3.)

4. **Declined DA retention.** Declined DAs are not removed; they stay annotated with `_declineMeta` so the edge derives and the synthetic DECLINED edge from Bob's anchor Asset to Alice's Claim persists until the requester explicitly dismisses it (see §11.4). (Phase 6.5.)

---

## 7. Primary User Stories

Three stories cover the core flows. All other scenarios are compositions of these.

### 7.1 Story 1: Direct Disclosure + Evaluation

Bob knows Alice's Claim PIN (via referral, prior relationship, etc.).

1. **Bob** opens one of his Assets' Detail Panels and clicks **Request Agreement** in the footer. That Asset becomes the request's grantee anchor and pre-populates the modal. (A secondary "Request Agreement…" button on the V2.2 banner exists for when no specific Asset is selected; it falls back to the first owned Asset.) In the modal, Bob enters Alice's Claim PIN, optionally selects suggested Requirements Sets, and sends. (Phase 4 banner entry → Phase 5 per-Asset entry; Phase 6 carry-over made the per-Asset entry primary.)
2. Platform creates a provisional Disclosure Agreement + Evaluation Agreement pair. **On Bob's canvas only,** Alice's Claim appears as a provisional node (dashed border, `PROVISIONAL` badge) with a provisional Agreement Edge to Bob's anchor Asset. Bob's canvas pans to the new node with an `_isNew` reveal. Alice's canvas is unchanged — provisional DAs do not pull any node onto the grantor's canvas (§6.5 rule 2).
3. Alice receives a **`v22-request` notification** in her inbox. Clicking it opens the `CombinedResponseModal` directly, anchored on the provisional DA; the notification persists until Alice accepts or declines (see §7.4). Alice does not see a provisional Claim node on her canvas.
4. **Alice** responds via the combined modal. Accept flow has four steps (Type → Scope → Terms (expiry only) → Review); Decline path skips to a reason step. Type branches: Full shows a selectable Asset checklist (≥1 required; Phase 6.5), Selective shows parsed-field selection, Proof-Only shows an Eval Result picker (§2.3). Evaluation Agreement `authorizedRequirementsSetIds` are recorded as advisory intent only; they do not gate evaluation (§10.5).
5. Platform finalizes both agreements. Alice's Claim transitions from provisional to active on Bob's canvas with a reveal animation. Bob's anchor Asset additionally receives an `_isNew` reveal on **Alice's canvas** (§6.5 rule 1) and her canvas pans to it. Reciprocal Agreement Edges appear on both canvases. Bob receives an ACCEPTED notification that deep-links to Alice's Claim.
6. **Bob** runs an evaluation from Alice's Claim node footer (the spec's original "from the Agreement Edge" entry point is a Phase 6+ polish). Any Requirements Set in Bob's library is allowed; the `authorizedRequirementsSetIds` from the EA surface as a `SUGGESTED` chip on matching Req Sets, not a filter. The modal blocks submission if an existing active Eval Result exactly matches `(Req Set, evidence Set)` and offers a "View it on the canvas →" jump (§11.3 duplicate detection; Phase 6.5+).
7. Platform produces an Evaluation Result. It appears as a parent-layer node on Bob's canvas (connected to his Asset and to Alice's Claim) and on Alice's canvas (connected to her Claim). Alice receives a `v22-evaluation` notification (§7.4).
8. If the result is unsatisfactory, Alice can amend her Claim (add more Assets) and amend the Disclosure Agreement with Bob to include those new Assets. Bob gets a `v22-amendment` notification, re-runs the evaluation. Same Req Set + different evidence produces a new result that supersedes the old (§11.3).

### 7.2 Story 2: Public Directory Discovery

Bob does not know any specific Claim PIN. He wants to find a supplier.

1. **Bob** clicks the Radiant Network button in his canvas chrome.
2. Canvas transitions to the Directory Layer (see §8). Bob sees clouds of dots representing other parties' publicly disclosed Claims.
3. **Bob** launches the AI Shopper (see §9) with one of his Requirements Sets + a context prompt.
4. AI Shopper runs asynchronously, returns a notification with candidate Claim matches.
5. **Bob** selects a candidate Claim in the results. Clicking "Request Agreement" initiates a bundled Disclosure Agreement + Evaluation Agreement request to that Claim's owner.
6. **Alice** (the Claim owner) receives the combined request. She responds with the same modal from Story 1, setting all disclosure scope and evaluation terms at once.
7. From here, the flow matches Story 1 from step 5 onward.

### 7.3 Story 3: Auditor Referral

Carol audits Alice's Claim. Bob wants to use Carol's audit as proof without re-running the evaluation himself.

1. **Alice** and **Carol** have an existing Disclosure Agreement + Evaluation Agreement. Carol has produced an Evaluation Result on Alice's Claim.
2. **Carol** creates a Disclosure Agreement (proof-only type) on her Evaluation Result to **Bob**, paired with an Evaluation Agreement.
3. **Bob** now sees Carol's Evaluation Result on his canvas, connected via an Agreement Edge to his Asset.
4. Bob does not re-run the evaluation. The existing Evaluation Result stands as proof.
5. If Bob wants his own evaluation, he goes through Story 1 or 2 independently with Alice.

### 7.4 Notification Types

Three new notification types drive cross-role deep-links in V2.2. All three ride on the V2.1 notification inbox UI (no new surfaces); the `type` field branches rendering and click behaviour in `V2App.jsx`. (Phases 4–6.5.)

| Type | Delivered to | Fired by | Click behaviour | Persistence |
|---|---|---|---|---|
| `v22-request` | Grantor (Claim owner) | Requester submits `CombinedRequestModal` | Opens `CombinedResponseModal` anchored on the provisional DA. Does NOT auto-dismiss on click. | Persists until `handleV22Accept` or `handleV22Decline` explicitly dismisses (the grantor can accidentally close the modal without losing the request). |
| `v22-amendment` | Grantee of the amended DA | Grantor submits `AmendDisclosureModal` | Deep-links to the Claim on the grantee's canvas; animated pan + zoom 1.28 + `_isNew` reveal. | Dismisses on click or on the V2.1 inbox's standard dismissal UI. |
| `v22-evaluation` | Claim owner (grantor of the backing DA) | Evaluator submits `V22RunEvaluationModal` (inter-party or supersede) | Deep-links to the new Eval Result node on the grantor's canvas; animated pan + zoom 1.28. Badge renders as `EVALUATED` for first result or `RE-EVALUATED` when `supersedesPriorResultId` is set. | Dismisses on click or standard dismissal. |

Accept / decline outcomes for a `v22-request` also enqueue `v22-accepted` / `v22-declined` entries on the requester's inbox (same delivery, simpler metadata) — these exist today as renderer branches on the same inbox entry shape rather than separate types.

---

## 8. The Directory Layer

The Directory Layer is a separate canvas layer (not part of the parent or child layer). It is entered and exited via the Radiant Network button in the canvas chrome.

### 8.1 Entry

- Radiant Network button lives in the bottom-left of the canvas, always on top.
- Clicking it triggers a **single circular wipe animation** that simultaneously reveals the Directory Layer as it conceals the user's network. Implementation: render the Directory Layer behind the parent layer with a circular clip-path starting at 100% (fully clipped, invisible) anchored at the bottom-left corner. On click, animate the clip-path radius expanding outward from the corner, which hides the parent layer and reveals the Directory Layer in one sweep.
- The Radiant Network button's label/appearance morphs mid-animation to the user's corner node (e.g., "GovCo"), which persists as the Directory Layer's anchor point.
- One animation, not two. No intermediate "everything is hidden" state.

### 8.2 Directory Layer Content

- Background is distinct from the parent/child layer (different color, no dot matrix).
- Thousands of dots representing other parties' publicly disclosed Claims.
- Dots are loosely clustered around their owner actor nodes (Alice's cluster, other suppliers' clusters).
- In V2.2 demo implementation: dots have no hover details, no Detail Panels — they are visual density only. **Architected for future clickability:** each dot is backed by a public-directory Claim artifact (same JSON schema as any Claim), so a later phase can wire per-dot Detail Panels without data-model changes.
- Existing Disclosure Agreements between the user and other actors are shown as lines from the user's corner node to those parties' clusters (or to specific highlighted dots within those clusters, in a future phase).

### 8.3 AI Shopper Entry Point

- A prominent button/panel within the Directory Layer labeled "AI Shopper."
- Clicking it opens a modal: select a Requirements Set, enter a context prompt, launch.
- AI Shopper runs as a background agent. The user can exit the Directory Layer while it runs.
- On completion, a notification appears with a results panel of candidate Claims.

### 8.4 Exit

- Clicking the user's corner node (or a dedicated "Exit Directory" button) triggers the reverse single circular wipe: clip-path radius shrinks back to the corner, revealing the parent layer as the Directory Layer is concealed. Same one-animation principle as entry.

### 8.5 Implementation note

The Directory Layer is ambitious. It is explicitly a back-burner item until the core parent-layer restructure is complete. A minimal placeholder (empty canvas with title "Directory Layer") is acceptable for initial implementation; the full dots-and-clouds visualization can follow.

---

## 9. AI Shopper

The AI Shopper is a tool exposed via an icon in the canvas chrome, similar to the Library and Notifications. It is not a node on the network.

- **Input:** a Requirements Set (from the user's library) + a context prompt (free text).
- **Output:** a notification containing a results panel of candidate Claims discovered in the Public Directory.
- **UI surface:**
  - Icon in the chrome (always present).
  - Modal for launching a search.
  - Background-agent-at-work animation (for demo purposes, a fake 10–30 second progress sequence is acceptable).
  - Results panel accessible from notifications.
- **From results, user can:**
  - View a Claim's public-directory Detail Panel (owner, description, posted date, aggregate stats).
  - Request a bundled Disclosure + Evaluation Agreement from that Claim.

Like the Directory Layer, AI Shopper is a back-burner item. Its existence is specified for reference, but its implementation follows the core migration.

---

## 10. JSON Schemas

All schemas are mocked for the prototype. Real implementations would include cryptographic signatures, Merkle proofs, etc. — none of that is required here.

### 10.1 Asset artifact

```json
{
  "artifactType": "asset",
  "artifactUri": "provenance://assets/{id}",
  "pin": "PIN-0x...",
  "owner": "MicroCo",
  "ownerDot": "DOT-0x...",
  "name": "Power Regulation Module Datasheet",
  "description": "Official datasheet for PRM-3A rev. 4",
  "file": {
    "uri": "provenance://evidence/prm-datasheet-v4",
    "filename": "prm-datasheet-v4.pdf",
    "size": 2458792,
    "mimeType": "application/pdf",
    "hash": "sha256:..."
  },
  "registrationDate": "2026-02-10T14:18:00Z",
  "parseResultIds": ["parse-001", "parse-002"]
}
```

### 10.2 Parse Result artifact

```json
{
  "artifactType": "parseResult",
  "artifactUri": "provenance://artifacts/parse-{id}",
  "owner": "MicroCo",
  "sourceAssetId": "asset-prm",
  "templateId": "tmpl-electronics-component",
  "templateName": "Electronics Component Profile",
  "templateVersion": 2,
  "fields": [
    { "id": "f-voltage", "name": "Operating voltage", "value": "3.3V ±5%", "confidence": 0.95 }
  ],
  "parseDate": "2026-02-20T15:47:00Z"
}
```

### 10.3 Claim artifact

```json
{
  "artifactType": "claim",
  "artifactUri": "provenance://claims/{id}",
  "pin": "PIN-0x...",
  "owner": "MicroCo",
  "name": "Power Regulation Module Assembly",
  "description": "Certified assembly backed by datasheet, test report, and thermal analysis.",
  "referencedAssetIds": ["asset-prm-datasheet", "asset-prm-testreport"],
  "createdDate": "2026-03-01T10:00:00Z",
  "amendments": [
    {
      "date": "2026-04-05T12:00:00Z",
      "added": ["asset-prm-thermal"],
      "removed": []
    }
  ]
}
```

### 10.4 Disclosure Agreement artifact

The Disclosure Agreement's `subject` field identifies the artifact being disclosed. It replaces V2.1's `claimId` field, which was ambiguous for ownership (Actor → Asset), claim-internal (Claim → referenced Asset), proof-of-evaluation (Eval Result → Claim), and public-directory variants. `subject.kind` is one of `'asset' | 'claim' | 'evalResult' | 'parseResult'`.

```json
{
  "artifactType": "disclosureAgreement",
  "artifactUri": "provenance://agreements/disclosure-{id}",
  "grantor": { "party": "MicroCo", "dot": "DOT-0x..." },
  "grantee": { "party": "GovCo", "dot": "DOT-0x..." },
  "subject": { "kind": "claim", "id": "claim-prm-assembly" },
  "granteeAssetId": "asset-bob-avionics",
  "type": "full",
  "scope": {
    "assetIds": ["asset-prm-datasheet", "asset-prm-testreport"],
    "fieldIds": null,
    "evaluationResultIds": null,
    "includeDerivatives": true
  },
  "terms": {
    "createdDate": "2026-03-04T16:42:00Z",
    "expires": "2027-03-04T16:42:00Z",
    "autoRenew": false
  },
  "amendments": [],
  "status": "active"
}
```

Typical subject assignments across DA variants:

| Variant | subject | Edge endpoints (Phase 2 derivation) |
|---|---|---|
| Actor → Asset ownership | `{ kind: 'asset', id }` | grantor's Actor node ↔ subject |
| Actor → Claim ownership | `{ kind: 'claim', id }` | grantor's Actor node ↔ subject |
| Claim → referenced Asset (internal) | `{ kind: 'claim', id }` + `scope.assetIds: [assetId]` | subject ↔ each `scope.assetIds` entry |
| Inter-party Claim disclosure | `{ kind: 'claim', id }` + `granteeAssetId` | subject ↔ `granteeAssetId` |
| Public-directory disclosure | `{ kind: 'claim', id }` + grantee = Radiant Network | subject ↔ Radiant Network node |
| Proof-of-Evaluation | `{ kind: 'evalResult', id }` | subject ↔ the Claim it evaluated (resolved via the Eval Result's `claimId`) |
| Eval Result → evaluator's Asset (ownership) | `{ kind: 'evalResult', id }` + `scope.assetIds: [assetId]` | subject ↔ each `scope.assetIds` entry |
| Parse Result → source Asset (internal) | `{ kind: 'parseResult', id }` + `scope.assetIds: [sourceAssetId]` | subject ↔ each `scope.assetIds` entry (Phase 4 pre-fix; one seeded per Parse Result so `parse → asset` edges render on the owner's canvas) |

### 10.5 Evaluation Agreement artifact

The `authorizedRequirementsSetIds` field is **advisory / informational**, not enforced. It records the Requirements Sets the requester suggested when sending the original combined request, so the grantor sees the requester's stated intent during the response flow. Once an Evaluation Agreement exists, the grantee may run **any** Requirements Set from their library against the Claim — the platform does not gate evaluation by this list. (Earlier Round 11 spec drafts implied enforcement; the product decision in Phase 6 was that gating evaluation by an authorized list adds friction without meaningfully improving trust.)

```json
{
  "artifactType": "evaluationAgreement",
  "artifactUri": "provenance://agreements/evaluation-{id}",
  "grantor": { "party": "MicroCo", "dot": "DOT-0x..." },
  "grantee": { "party": "GovCo", "dot": "DOT-0x..." },
  "claimId": "claim-prm-assembly",
  "granteeAssetId": "asset-bob-avionics",
  "disclosureAgreementId": "disclosure-001",
  "authorizedRequirementsSetIds": ["req-mil-prf-55681-v1"],
  "restrictions": {
    "priorEvaluationRequired": null,
    "additionalParticipants": []
  },
  "terms": {
    "createdDate": "2026-03-04T16:42:00Z",
    "evaluationDeadline": "2026-04-04T16:42:00Z",
    "resultExpiry": null,
    "flowDownRequirements": []
  },
  "incentives": {
    "onSatisfactory": "Certificate of compliance issued to grantee",
    "onUnsatisfactory": null
  },
  "status": "active"
}
```

### 10.6 Evaluation Result artifact

```json
{
  "artifactType": "evaluationResult",
  "artifactUri": "provenance://artifacts/eval-{id}",
  "pin": "PIN-0x...",
  "owner": "GovCo",
  "ownerDot": "DOT-0x...",
  "evaluationAgreementId": "eval-agreement-001",
  "claimId": "claim-prm-assembly",
  "granteeAssetId": "asset-bob-avionics",
  "requirementsSet": {
    "id": "req-mil-prf-55681-v1",
    "name": "MIL-PRF-55681 Compliance",
    "version": 1
  },
  "results": [
    { "requirementId": "req-001", "label": "Power output stability", "value": "3.3V ±0.5%", "status": "satisfactory" },
    { "requirementId": "req-004", "label": "Radiation tolerance", "value": "TID > 100 krad(Si)", "status": "unsatisfactory" }
  ],
  "evidenceUsed": ["asset-prm-datasheet", "asset-prm-testreport"],
  "evaluationDate": "2026-03-09T14:32:00Z",
  "status": "active",
  "supersededBy": null
}
```

---

## 11. State Transitions

### 11.1 Claim amendment

Alice amends her Claim by adding one or more Asset references. Preconditions: she owns the Claim; she owns the Assets being added.

1. Alice selects a Claim node; footer action "Amend Claim" opens a modal.
2. She selects additional Assets from her canvas (or creates new ones inline).
3. Modal confirms the amendment.
4. Claim's JSON is updated with a new `amendments[]` entry (added Asset IDs, timestamp).
5. No Disclosure Agreements are automatically updated. Alice must explicitly amend each agreement to share the new evidence.

### 11.2 Disclosure Agreement amendment

Alice amends a Disclosure Agreement to include (or exclude) evidence.

1. Alice clicks the Agreement Edge between her Claim and a counterparty's Asset. Selects "Disclosure Agreement" from the edge menu.
2. Disclosure Agreement Detail Panel opens. Action: "Amend Disclosure."
3. Modal shows current scope; she adjusts which Assets/fields/eval results are included.
4. **Evidence can only be added in an amendment, not removed** — if the Disclosure has been used for an evaluation. (Evidence can be removed if no evaluation has been run against it yet. Final rule TBD; default is no removal.)
5. Counterparty receives a notification that the agreement was amended. Updated scope is immediately available.

### 11.3 Evaluation amendment (re-evaluation)

Bob re-runs an evaluation after Alice amends her Disclosure to include more evidence.

1. Bob receives the `v22-amendment` notification (§7.4).
2. Clicking the notification takes him to Alice's Claim on his canvas.
3. Bob initiates an evaluation from the Claim (or from the existing Evaluation Result). The modal allows any Requirements Set in Bob's library; the Evaluation Agreement's `authorizedRequirementsSetIds` surface as a `SUGGESTED` chip but do not gate the choice (§10.5).
4. **Duplicate detection (Phase 6.5+):** if the selected Requirements Set AND the selected evidence set both exactly match an existing non-superseded Evaluation Result, the modal blocks submission and surfaces a "View it on the canvas →" link to jump to that result. Re-running the same evaluation against the same inputs produces nothing new.
5. **Supersede path:** same Requirements Set + *different* evidence produces a new Evaluation Result. The prior result's `status` becomes `superseded` and `supersededBy` points to the new result.
6. **New-result path:** a *different* Requirements Set always produces a separate active Evaluation Result (does not supersede).
7. Both active and superseded results remain visible on both canvases; the superseded one has a `SUPERSEDED` label, dimmed styling, and does not contribute to health minibars.

### 11.4 Disclosure decline

Alice declines Bob's Disclosure + Evaluation Agreement request.

1. In the combined response modal, Alice selects "Decline" (fourth option alongside Full/Selective/Proof-Only).
2. Optional reason textarea. Empty reason falls back to "No reason given" in italic muted text on Bob's side (§15 rule 3).
3. **Decline retention (Phase 6.5):** the provisional Disclosure Agreement and Evaluation Agreement are **not** deleted. They are annotated with `_declineMeta` (reason, date, declining actor) + `_declined: true` and retained on `v22Provisionals`. (Earlier spec drafts deleted both artifacts; the product decision in Phase 6.5 was to keep them as a UI-layer affordance so the decline edge derives normally and remains visible to Bob until he dismisses it.)
4. The view builder derives the annotated DA into an Agreement Edge as normal; the canvas adapter tags the Claim node with `isDeclined` + `_isDeclined` + `_declineReason` so the red `DECLINED` badge renders (outranking `PROVISIONAL`; see §3). The edge and Claim persist on Bob's canvas.
5. Bob receives a `v22-declined` entry on his inbox; clicking it animated-pans to the DECLINED Claim.
6. Bob's Detail Panel for the declined Claim surfaces the reason in a red-bordered panel and offers a **Dismiss** CTA. Dismissal (`handleV22DismissDeclined`) strips the annotations and removes both DA and EA as a pair, which collapses the edge and the Claim node together.

### 11.5 Agreement expiry

When an agreement's `expires` date passes, its `status` transitions to `expired`.

- Expired Disclosure Agreement: scope visibility is revoked for the counterparty. The Claim node disappears from Bob's canvas (or is visually marked as expired).
- Expired Evaluation Agreement: Bob cannot run new evaluations against the Claim. Existing Evaluation Results remain valid.
- Auto-renewal (if enabled in terms): agreements automatically extend by the original duration at expiry.

### 11.6 Self-evaluation

Alice evaluates her own Claim against a Requirements Set without a counterparty.

1. Alice clicks **Self-Evaluate** on her own Claim's Detail Panel footer (owner-only CTA, alongside **Amend Claim**).
2. `V22RunEvaluationModal` opens in self-eval mode: no Evaluation Agreement is required or referenced. The Requirements Set library shows every Req Set in Alice's library (no `SUGGESTED` filtering since there's no EA to suggest from).
3. On submit, `makeEvaluationRunArtifacts` produces an Evaluation Result plus two internal Disclosure Agreements: a proof-of-evaluation DA (grantor = Alice, grantee = Alice, subject = evalResult) and an ownership DA (grantor = Alice, grantee = Alice, subject = evalResult with `scope.assetIds`). Both are internal (grantor == grantee); `granteeAssetId` is absent on the proof DA since there's no external anchor.
4. `deriveAgreementEdges` has a dedicated branch for internal proof-of-eval (`subject.kind === 'evalResult' && internal && !hasScopeAssets`) that renders the edge from the Eval Result to the Claim. Visually identical to a non-self proof-of-evaluation edge.
5. Duplicate detection and supersede semantics (§11.3) apply identically to self-evaluation.

### 11.7 Ownership transfer (Transferring process)

Alice transfers an Asset she owns to another actor. Canon X.5: the transfer is recorded as an immutable state transition; the ownership lineage is preserved as a verifiable provenance chain. (Assets only in Phase 9A.4 — Claim and Evaluation Result transfer deferred to a later phase, tracked as backlog #72.)

1. Alice clicks **Transfer** on her Asset's Detail Panel footer or card action bar (owner-only CTA). `V22TransferAssetModal` opens with the Asset in context.
2. **Step 1 — Recipient.** Alice enters the recipient's Actor PIN. Live PIN resolution runs against the demo Actor pool (Bob, Alice, Carol, Radiant Network). Three rejection cases: own PIN (cannot transfer to self), Radiant Network PIN (cannot transfer to the public-directory pseudo-actor), unknown PIN. Continue is gated on a valid recipient. Optional "note to recipient" textarea.
3. **Step 2 — Review & Confirm.** Asset summary, recipient card, note, and a warning: "On accept, ownership of this Asset transfers to {recipient}. This Asset will no longer appear on your canvas. The transfer is recorded on the ledger and cannot be reversed." Submit sends the transfer request.
4. **Provisional state.** On submit, a provisional transfer record is created (stashed on `v22Provisionals.transfers`) and the Asset is stamped with `_pendingTransfer: { recipientDid, initiatedTimestamp }`. Alice's Asset renders with a `TRANSFERRING` badge until the recipient responds. The recipient receives a `v22-transfer-request` notification; clicking the notification opens `V22TransferResponseModal` (matching the Disclosure Response pattern — notifications are entry points, decisions happen in modals).
5. **Cancel-while-pending.** The Asset's Detail Panel footer and card action bar expose a **Cancel Transfer** CTA while `_pendingTransfer` is set. Cancellation clears the badge, drops the provisional, and fires `v22-transfer-cancelled` to the recipient (which auto-dismisses their pending notification).
6. **Accept path.** Recipient clicks Accept in `V22TransferResponseModal`.
   - `asset.dot.ownerDid` updates to the recipient's DID; `asset.owner` and `asset.ownerDot` update to match.
   - A `makeTransferRecord(...)` with `status: 'accepted'` is appended to `asset.dot.lineage[]` (the provenance chain).
   - The Asset disappears from Alice's canvas and materialises on the recipient's canvas with an `_isNew` reveal (NEW badge persists to deselection per the standard rule) and an ownership Agreement Edge to the recipient's Actor node. Pan-to fires on the recipient's canvas to the new Asset.
   - Recipient notification dismisses; Alice receives a `v22-transfer-accepted` notification.
7. **Decline path.** Recipient clicks Decline in `V22TransferResponseModal`; the modal transitions to a decline-reason phase with an optional textarea (empty is acceptable) before Confirm Decline.
   - `asset.dot` does not change; ownership stays with Alice.
   - A `makeTransferRecord(...)` with `status: 'declined'` (and the reason if given) is appended to `asset.dot.lineage[]` for auditability — declined transfers are part of the provenance chain too.
   - The Asset's `_pendingTransfer` field clears and the `TRANSFERRING` badge removes. Alice receives a `v22-transfer-declined` notification that surfaces the reason.

**No cascading state.** The transferred Asset arrives "clean" on the recipient's canvas — existing Parse Results, Evaluation Results, and Disclosure Agreements against the Asset stay with Alice. Production cascade semantics (do derived Parse Results transfer too? what happens to Claims referencing the Asset on Alice's side?) are deferred. Similarly, transferring an Asset that is the sole evidence backing an active disclosed Claim is permitted in the demo but has no guardrail UI — backlog #73.

**File custody on transfer.** The DOT canon (X.1) specifies that the DOT contains the file's hash but not the file itself, leaving file custody as an implementation question. This prototype assumes a **replication model**: on transfer acceptance, the file is replicated from the sender's qualified storage to the recipient's qualified storage, both copies hashing identically. The DOT lineage records the transfer; the file content is independently held under each owner's custody. The alternative — a pointer model where the recipient's DOT references the sender's still-hosted file — is cryptographically valid but operationally fragile (sender deletion or modification breaks the recipient's reference). The prototype does not actually move file bytes; the mock URI travels with the DOT for demonstration purposes. Production semantics should be confirmed with the client; this section will be updated accordingly. (Andrew's call — surfaced for client review; tracked as backlog #93.)

### 11.8 Parse flow

Alice parses an Asset she owns to extract structured fields into a Parse Result artifact. Parsing is a prerequisite for Selective Disclosure (§2.3).

1. Alice selects one of her own Assets; the Asset Detail Panel footer exposes **Parse Evidence** (owner-only).
2. `V22ParseEvidenceModal` opens in a three-stage flow (select PEP template → processing → review + edit parsed fields). Templates already run on this Asset are shown with an `ALREADY PARSED` affordance and disabled.
3. On submit, `makeParseRunArtifacts({ ownerParty, ownerDot, sourceAssetId, template, rows })` produces a Parse Result plus an internal Full Disclosure Agreement (`subject={kind:'parseResult', id}` with `scope.assetIds=[sourceAssetId]`) that wires the new Parse Result to its source Asset. The ref DA's shape matches the seeded `parseResultRefEdges` so edge derivation treats the new Parse Result identically.
4. Both artifacts land on `v22Provisionals` and merge into the view; the new Parse Result node renders on Alice's canvas with an `_isNew` reveal.
5. Structural parity with `V22RunEvaluationModal`: same split-panel layout, same `ConfidenceBadge` + row shape. Parse rows edit the extracted value + confidence only (no SAT/UNSAT/MISSING/N/A cycling), per the Parsing-vs-Evaluating distinction in §2.3.

---

## 12. V2.1 → V2.2 Migration Map

This section identifies every V2.1 component and what happens to it in V2.2.

### 12.1 Components that carry forward unchanged

| Component | Status |
|-----------|--------|
| `V2Canvas.jsx` — dot grid, pan/zoom, camera | Keep |
| `V2BootScreen.jsx` — CAC login, Prime Radiant | Keep |
| `LayerBorder.jsx`, `LayerTransitionOverlay.jsx` | Keep |
| Dive/surface mechanic | Keep |
| Boot sequence (session storage key `radiant-v2-booted`) | Keep |
| Notification system | Keep |
| Credit system | Keep |
| `CopyBadge`, `HealthBar`, `Tooltip` utilities | Keep |
| `ArtifactRow`, `ExpandButton`, `ExpandedArtifactModal` | Keep |
| `ConfidenceBadge`, `SDABadge`, `SectionLabel` | Keep |
| PIN/DOT generation (`makePin`, `makeDot`) | Keep |
| Qualified Storage picker | Keep |

### 12.2 Components that need modification

| Component | Modification |
|-----------|--------------|
| `AssetNode.jsx` | Add type label display (`ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`, etc.) in card header. Support new node types on the parent layer. |
| `DetailPanel/index.jsx` | Add rendering for new node types (Asset distinct from Claim, Parse Result parent-layer nodes, Eval Result parent-layer nodes). |
| `DetailPanel/PanelShell.jsx` | Ownership-aware action footer: only owner sees Parse/Disclose/Amend actions; only counterparty with active Evaluation Agreement sees Evaluate. |
| `CreateClaimModal.jsx` | User picks Assets from their existing Asset nodes via a new picker UI, or creates new Assets inline by calling `CreateAssetModal.jsx`. |
| `ParseEvidenceModal.jsx` | Operates on Assets directly (not on Claims). Input: Asset selection; output: Parse Result node on the parent layer (not a child). **Must share UI layout structure with `RunEvaluationModal.jsx`** — both use the same split-panel, same row component shape, same ConfidenceBadge. See §17.1. |
| `RunEvaluationModal.jsx` | Requires an active Evaluation Agreement for inter-party evaluations. Authorized Requirements Sets (from the agreement) are the only ones shown. Self-evaluation (Alice on her own Claim) does not require an Evaluation Agreement. **Must share UI layout structure with `ParseEvidenceModal.jsx`** — see §17.1. |
| `RequestDisclosureModal.jsx` → `CombinedRequestModal.jsx` | Replaced. Requests both a Disclosure Agreement AND an Evaluation Agreement in one flow. Requester can optionally specify desired Requirements Sets. |
| `DisclosureResponseModal.jsx` → `CombinedResponseModal.jsx` | Replaced. Responds to the combined request. Grantor sets Disclosure type/scope/terms AND Evaluation Agreement terms (authorized req sets, deadlines, incentives) in sequential steps on the same modal. |
| `V2Canvas.jsx` | Add clickable edge support with `selectedEdgeId` state. Edge click handler surfaces the Agreement Edge menu (see `EdgeMenu.jsx`). Edge rendering uses new selected-edge styling (see §4.4). **Do not alter child layer transition code.** |
| `v2Data.js` | Major refactor. See §12.5. |
| `V2App.jsx` | Rewire state management for separate artifact arrays, parent-layer Eval Results and Parse Results, Agreement Edge derivation. |
| `LibraryModal.jsx` (or similar unified modal) | Ensure Parse Templates and Requirements Sets live in the same Library surface with matching UX. This is prep work for §17.1 Parsing/Evaluating unification. |

### 12.3 Components to remove or deprecate

| Component | Reason |
|-----------|--------|
| `RegisterAssetModal.jsx` | Already unused. Delete in a cleanup pass after Phase 1. |
| `AddEvidenceModal.jsx` | Superseded by `CreateAssetModal.jsx`. Delete after Phase 2. |
| V1 files (`src/App.jsx`, `src/data/*`, `src/components/Header.jsx`, `src/components/Footer.jsx`, `src/components/NetGraph.jsx`, etc.) | V1 is archived. Delete after migration stabilizes (post-Phase 7). |
| `SDACreationModal.jsx`, `SystemCreationModal.jsx` | Unused in V2.1. Review for deletion. |
| Separate "Ownership Edge" / "Proof of Evaluation Edge" rendering logic if any exists in V2.1 | Collapsed into single Agreement Edge model — see §4. |

### 12.4 New components to build

| Component | Purpose |
|-----------|---------|
| `CreateAssetModal.jsx` | Register an Asset (evidence file + metadata). Standalone and inline-callable from CreateClaimModal. |
| `AmendClaimModal.jsx` | Add Asset references to an existing Claim. |
| `AmendDisclosureModal.jsx` | Update a Disclosure Agreement's scope. |
| `AmendEvaluationAgreementModal.jsx` | Update an Evaluation Agreement's terms (if applicable to the demo). |
| `DisclosureAgreementDetailPanel.jsx` | Detail Panel for Disclosure Agreement artifacts (opened from edge click). |
| `EvaluationAgreementDetailPanel.jsx` | Detail Panel for Evaluation Agreement artifacts (opened from edge menu). |
| `EdgeMenu.jsx` | Small contextual menu that appears on Agreement Edge click; offers Disclosure Agreement / Evaluation Agreement options. |
| `CombinedRequestModal.jsx` | Unified request modal for Disclosure + Evaluation Agreement (replaces `RequestDisclosureModal`). |
| `CombinedResponseModal.jsx` | Unified response modal (replaces `DisclosureResponseModal`). |
| `DirectoryLayer.jsx` | Directory Layer view (initially a placeholder; Phase 7). |
| `AIShopper.jsx` | AI Shopper tool (initially a placeholder; Phase 7). |

### 12.5 Data model changes in `v2Data.js`

Current state (V2.1): nodes of many conflated types, `children` arrays holding evidence, parse, claim, eval. SDAs stored on each node.

Target state (V2.2):
- **Separate arrays for each artifact type:** `assets`, `claims`, `parseResults`, `disclosureAgreements`, `evaluationAgreements`, `evaluationResults`.
- **All Agreement Edges derived from Disclosure Agreements,** not stored independently. Ownership edges, Proof of Evaluation edges, Public Directory edges, and inter-party edges are all derived from Disclosure Agreement artifacts (some implicit, some explicit). See §4.1.
- **Parse Results are parent-layer nodes**, not children. The child layer is intentionally empty in V2.2.
- **Factory functions for each artifact type:** `makeAsset`, `makeParseResult`, `makeClaim`, `makeDisclosureAgreement` (with helpers for implicit internal/ownership/proof-of-eval variants), `makeEvaluationAgreement`, `makeEvaluationResult`.
- **Role-specific view builders** (`buildBobView`, `buildAliceView`, `buildCarolView`) that take the full shared artifact set and return the correct subset of nodes and derived edges for that actor's canvas.
- **Edge derivation function** (`deriveAgreementEdges(viewArtifacts)`) that walks the Disclosure Agreements visible to the current actor and returns the edge list for rendering.

### 12.6 Demo dataset composition (shipped reality as of Phase 6.5)

`buildV22SharedArtifacts` seeds the following fixed dataset. Story walkthroughs are tested against this composition; adjust intentionally when adding flows.

**Actors (4):** Alice Nakamura @ MicroCo (seller), Bob Donloe @ GovCo (buyer), Carol @ AuditCo (auditor), Radiant Network (Public Directory pseudo-actor).

**Bob's Assets (3)** — added in Phase 5 to unblock end-to-end testing of the response flow (Avionics alone had too many pre-seeded DAs to anchor new requests against):
- Avionics
- Guidance Computer
- Thermal Subsystem

**Carol's Assets (2)** — added in Phase 5:
- AuditCo Workspace
- Compliance Audit Queue

**Alice's Assets (7):** Power Regulation Module Datasheet + related evidence files covering Story 1 (PRM → Bob evaluates) and Story 3 (PRM → Carol audits → Carol discloses result to Bob).

**Parse Results (3):** one per Alice Asset that participates in Selective Disclosure. Each has a seeded internal Full DA with `subject.kind='parseResult'` + `scope.assetIds=[sourceAssetId]` so the parse → source-asset edge derives (§10.4 Phase 4 pre-fix).

**Claims (3):** Alice's Power Regulation Module Assembly + two additional Claims covering Story 2/3 variants.

**Evaluation Agreements (3):** Alice↔Bob PRM, Alice↔Carol PRM audit, Carol→Bob proof-of-audit (Story 3).

**Evaluation Results (2):** Bob's MIL-PRF result on Alice's PRM Claim, Carol's audit result on Alice's PRM Claim.

**Disclosure Agreements (25+):** ownership (actor → asset, actor → claim), claim-ref (claim → referenced asset), 3 explicit inter-party (Alice↔Bob, Alice↔Carol, Carol→Bob), 3 public-directory, 2 proof-of-evaluation, 2 eval-result ownership, 3 parse-result → source-asset internal refs. Counts grow as provisionals + amendments land during a session.

---

## 13. Phased Implementation Plan

Seven phases. Each phase is a unit of autonomous work with explicit acceptance criteria. Claude Code should run with `xhigh` effort and perform a structured review against the phase's acceptance criteria before declaring a phase complete.

### Phase 1: Data Model Foundation

**Goal:** Introduce V2.2 data structures alongside V2.1 structures. No visible UI changes.

- Define factory functions for all six artifact types in `v2Data.js`.
- Build shared artifact collections (not role-specific yet).
- Add `makeAsset`, `makeClaim` (updated to use `referencedAssetIds`), `makeDisclosureAgreement`, `makeEvaluationAgreement`, `makeEvaluationResult`, `makeParseResult`.
- Populate a parallel demo dataset using V2.2 structure.
- Add a feature flag `V2_2_ENABLED` (env variable or top-level constant). When false, V2.1 rendering remains. When true, V2.2 data is used.
- No modal or rendering changes yet.

**Acceptance criteria:**
- Running with `V2_2_ENABLED=false` produces the current V2.1 behavior, unchanged.
- Running with `V2_2_ENABLED=true` produces a placeholder banner "V2.2 mode active" but no other visible changes (actual rendering comes in later phases).
- Shared artifact collections are reachable from both Alice's and Bob's view builders.
- Unit-level sanity: factory functions produce valid JSON conforming to §10 schemas.
- `npm run build` passes clean.

### Phase 2: Parent Layer Restructure

**Goal:** Render V2.2 node types correctly when `V2_2_ENABLED`.

- `AssetNode.jsx` renders type labels (`ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`, etc.) in the card header.
- Parent layer renders Assets, Claims, Parse Results, and Evaluation Results as separate parent-layer nodes.
- Agreement Edges derived from Disclosure Agreements render connecting all related nodes (including implicit ownership/internal edges where grantor and grantee are the same actor).
- Child layer remains empty and untouched (dive/surface works mechanically but no nodes to show). **Do not delete or refactor child layer code.**
- V2.1 mode still works identically.

**Acceptance criteria:**
- Alice's canvas in V2.2 mode shows: MicroCo Actor, N Asset nodes, Parse Result nodes derived from those Assets (from demo data), M Claim nodes with edges to the Assets they reference, P Evaluation Result nodes.
- Bob's canvas in V2.2 mode shows: GovCo Actor, his Asset(s), Alice's Claims that he has active Evaluation Agreements with (connected to his Asset via Agreement Edges), his Evaluation Results.
- Type labels are visible on all node cards.
- All edges render as a single Agreement Edge type with appropriate styling (Full indigo solid, Selective amber dashed, Proof-Only green dotted, internal Full indigo solid).
- Dive/surface mechanic still works on Asset nodes (even if nothing to dive into).
- V2.1 mode unchanged.

### Phase 3: Edge Clickability + Agreement Panels

**Goal:** Edges are clickable and reveal agreement Detail Panels.

- Add `selectedEdgeId` state to `V2Canvas.jsx`. Clicked edges enter selected state (brighter color, +0.5px stroke).
- Implement `EdgeMenu.jsx` as a contextual menu on edge click for Agreement Edges with paired Evaluation Agreements.
- Implement `DisclosureAgreementDetailPanel.jsx` and `EvaluationAgreementDetailPanel.jsx`.
- Agreement Edges render styled per disclosure type (solid indigo / dashed amber / dotted green / muted grey for provisional / dimmed grey with EXPIRED for expired).
- Internal/ownership edges use Full Disclosure styling (solid indigo); their Detail Panels render as "Internal — {owner} to {owner}".
- Proof of Evaluation edges use Full Disclosure styling from evaluator to Claim owner; Detail Panel renders as Full Disclosure of the Eval Result artifact.

**Acceptance criteria:**
- Clicking any edge opens either the edge menu (for Agreement Edges with a paired Evaluation Agreement) or directly opens the Disclosure Agreement Detail Panel (for edges without a paired Evaluation Agreement).
- Disclosure Agreement panel shows full JSON artifact with Amend action (if grantor).
- Evaluation Agreement panel shows full JSON artifact with Amend action (if grantor).
- Edge styling correctly reflects disclosure type; selected edge state is visible and clears on Detail Panel close.
- Ownership and Proof of Evaluation edges are visually identical to inter-party Full Disclosure edges, but their Detail Panels correctly identify them as internal or proof-of-evaluation relationships.

### Phase 4: Combined Request + Response Flows

**Goal:** Update Disclosure + Evaluation Agreement flows to be combined.

- Implement `CombinedRequestModal.jsx`. Bob requests both artifacts in one flow: enters PIN, selects optional desired Requirements Sets, writes message.
- Implement `CombinedResponseModal.jsx`. Alice responds with disclosure type/scope/terms AND evaluation terms in one flow.
- Provisional nodes appear on both canvases during the request phase.
- Acceptance creates both artifacts; decline removes both.

**Acceptance criteria:**
- Bob can request an Agreement to Alice's Claim via her PIN. Alice's Claim appears on Bob's canvas as a provisional node.
- Alice responds via the combined modal. On accept, both artifacts are created, the provisional node transitions to active (reveal animation), Agreement Edges appear styled by disclosure type.
- On decline, both provisional artifacts are removed.
- Amending a Disclosure Agreement does not amend the Evaluation Agreement (they are separate artifacts amendable independently).

### Phase 5: Evaluation Flow + Eval Results on Parent Layer

**Goal:** Running an evaluation produces a parent-layer Eval Result node.

- `RunEvaluationModal.jsx` requires an active Evaluation Agreement for inter-party evaluations. Authorized Requirements Sets (from the agreement) are the only ones shown.
- Evaluation output becomes a parent-layer Eval Result node visible on both parties' canvases.
- Agreement Edges (derived from implicit Full Disclosure Agreements from evaluator to Claim owner) connect the Eval Result to the Claim it evaluated and to the evaluator's Asset.
- Superseding logic: re-running with the same Requirements Set lineage produces a new Eval Result, previous is marked `SUPERSEDED` with dimmed styling. Re-running with a different Requirements Set produces a separate active Eval Result (does not supersede).
- **Parse flow and Eval flow use structurally identical UI** (same split-panel layout, same row component shape, same ConfidenceBadge, same editable value field). Differences: Eval adds SAT/UNSAT/MISSING/N/A cycling; Parse does not. This structural parity is intentional per §17.1.

**Acceptance criteria:**
- Bob can initiate an evaluation from an Agreement Edge or from Alice's Claim footer (when he has an active Evaluation Agreement).
- Evaluation modal only allows Requirements Sets authorized by the Evaluation Agreement.
- Completed evaluation produces a new Eval Result node visible on both Bob's and Alice's canvases, connected via Agreement Edges.
- Supersede/amend cycle: Alice amends Claim + Disclosure, Bob re-evaluates with the same Req Set, new result supersedes old. Both results remain visible on both canvases; superseded is dimmed with SUPERSEDED label and does not contribute to any minibar rollups.
- Parse and Eval modals look and feel nearly identical when viewed side-by-side.

### Phase 6: Amendment Flows

**Goal:** All amendment flows function.

- `AmendClaimModal.jsx` — Alice adds Asset references to a Claim.
- `AmendDisclosureModal.jsx` — Alice adjusts scope of a Disclosure Agreement (only widening allowed if an evaluation has been run against it).
- `AmendEvaluationAgreementModal.jsx` — if in scope for demo; otherwise skip.
- Cross-role notification sync: Bob is notified when Alice amends her Disclosure Agreement with him; the notification deep-links to Alice's Claim on Bob's canvas.
- Self-evaluation flow: Alice evaluates her own Claim using an external Requirements Set (e.g., a published OSHA set). No Evaluation Agreement required for self-evaluation since Alice is both grantor and grantee.

**Acceptance criteria:**
- Alice can amend a Claim from the Claim's Detail Panel footer. New Assets appear as referenced. Existing Disclosure Agreements are **not** automatically amended.
- Alice can amend a Disclosure Agreement from the Agreement Edge menu. New scope takes effect immediately for the counterparty.
- Bob receives notifications for both amendment types and can click through to see amended content.
- Alice can run a self-evaluation on her own Claim using a published Requirements Set. Result is an Eval Result node owned by Alice, on her own canvas only. She can then disclose that Eval Result to others through a proof-only Disclosure Agreement.

### Phase 7: Directory Layer + AI Shopper (back burner)

**Goal:** Minimum viable Directory Layer and AI Shopper for demo.

- Radiant Network button in canvas chrome, always present (distinct from the Radiant Network **node**, which appears only if the user has published Claims).
- Single circular wipe transition on entry/exit (see §8.1). One animation, not two sequential ones.
- Placeholder Directory Layer: user's corner node anchored in bottom-left, distinct background (no dot matrix), loose clusters of dots representing other parties' publicly disclosed Claims. Dots are visual-only in V2.2 but architected for future per-dot Detail Panels (see §8.2 and §15.5).
- AI Shopper icon in chrome, modal that accepts Requirements Set + context prompt, fake progress animation (10-30 seconds), results panel with candidate Claims.
- Results panel allows requesting a combined Disclosure + Evaluation Agreement from a found Claim (same flow as Phase 4).

**Acceptance criteria:**
- Radiant Network button triggers single-wipe transition into Directory Layer; corner node transition works.
- Directory Layer renders with placeholder dots clustered around actor nodes.
- AI Shopper modal launches, progress animation plays, returns mock results.
- Clicking a result initiates the combined request flow (Phase 4) targeting that Claim's owner.
- Exit transition returns to the user's network correctly.

---

## 14. Implementation Guidelines

### 14.1 For autonomous work

- Use feature flag `V2_2_ENABLED` throughout. V2.1 remains functional until every phase is complete.
- Do not delete V2.1 code paths until Phase 7 is complete and approved.
- Perform a structured review against the phase's acceptance criteria at the end of each phase before reporting completion — walk each criterion in the spec and verify it is met.
- When encountering a genuine ambiguity (e.g., "spec says X should happen but data model implies Y"), stop and surface the conflict. Do not guess.
- Run `npm run build` at the end of every phase. Build must pass clean.
- Preserve the child layer dive/surface mechanic. Never touch `V2Canvas.jsx`'s layer transition code.

### 14.2 For Andrew's reviews

- Review at phase boundaries, not mid-phase.
- If a phase's acceptance criteria are all met, approve and proceed. If not, specify which criteria failed; Claude Code patches and re-reviews.
- Save architectural discussions for new artifacts or scope discoveries. Do not use review cycles for small visual tweaks — those can accumulate and ship in a Phase 8 polish pass.

### 14.3 Forbidden changes without explicit approval

- Adding new node types beyond §3.
- Adding a second edge type (the Agreement Edge is the only edge type — do not introduce separate Ownership, Proof-of-Evaluation, or Public Directory edge types).
- Changing the data model in `v2Data.js` beyond what's specified in §12.5.
- Altering the boot sequence.
- Altering child layer dive/surface behavior or deleting child layer code (child layer is intentionally retained but unused — see §5).
- Removing the notification system.
- Unifying Parsing and Evaluating processes in V2.2 (this is §17.1 future work; maintain them as separate processes with structurally identical UI for now).

### 14.4 Expected changes at the file level

- `v2Data.js` will grow substantially.
- `V2App.jsx` state management will be refactored to handle per-artifact-type state instead of `addedNodes`/`addedChildren`.
- `DetailPanel/index.jsx` may need to split into per-node-type panels for maintainability, OR keep a unified panel with clearer type-branching.
- All modal files updated per §12.2.

---

## 15. Confirmed Rules (previously open questions)

These rules were clarified during architecture review and are now locked:

1. **Multiple Requirements Sets per Claim.** If Bob evaluates with Req Set A and later with Req Set B on the same Claim, **both Eval Results remain active**. Only same-Req-Set re-evaluation supersedes (and supersedes only prior evaluations run against that same Req Set lineage).
2. **Agreement expiry rendering.** Expired agreements render with dimmed styling (reduced opacity on the edge) and an `EXPIRED` tag visible on hover and in the edge's Detail Panel header. Expired Disclosure Agreements hide the counterparty's pulled-in Claim node from the grantee's canvas (or render it dimmed with EXPIRED state — decide in Phase 3 implementation). Existing Eval Results from before expiry remain visible and valid.
3. **Decline reason.** Optional textarea on the response flow's Decline option; falls back to "No reason given" in italic muted text on the counterparty's side if left empty.
4. **Node type labels.** All parent-layer nodes show a small mono type label (`ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`, etc.) in the card header. Labels are informational, not colored/iconed categories.
5. **Edge consolidation.** One edge type (Agreement Edge) covers all parent-layer relationships. Ownership, Proof of Evaluation, and Public Directory edges are all implicit Disclosure Agreements with appropriate grantor/grantee combinations.

## 15.5 Remaining Open Questions

These are genuine decision points that may emerge during implementation. Surface them when encountered; do not guess.

1. **Carol's Eval Result disclosure flow.** The specific UX for "disclose my Eval Result as proof-only to another party" (entry point, modal shape, resulting edge rendering) needs definition. Surfaces in Phase 6 or Phase 7.
2. **Asset removal from Claims mid-lifecycle.** Current rule: no removal of Assets that have been evaluated. Open: can Alice remove an Asset from a Claim if no evaluation has been run against it yet? Default to not-allowed for V2.2 simplicity; revisit if a demo scenario requires it.
3. **Public directory Claims' Detail Panel content.** What the Radiant Network node's Detail Panel shows (aggregate stats? list of published Claims? platform-wide metrics?). Deferred to Phase 7 implementation.
4. **Visual distinction for counterparty-pulled-in nodes.** Pulled-in nodes (Alice's Claim on Bob's canvas) may need subtle visual treatment to signal "this isn't mine." Post-migration polish; not required for V2.2.
5. **AI Shopper real behavior.** Mock implementation (scripted progress + mock results) is the V2.2 target. Real agent integration is out of scope for the migration.
6. **Internal vs inter-party edge de-emphasis.** Since all edges use the same Agreement Edge type, internal ownership edges (Alice's own Actor → Asset → Claim chain) may visually compete with inter-party edges. Consider subtle de-emphasis (thinner stroke, lower opacity) for internal edges in a future polish pass.

---

## 16. Success Criteria for the Migration

The migration is complete when:

1. Andrew can walk through Story 1, Story 2, and Story 3 in the UI without encountering broken or missing behavior.
2. All three demo actors (Bob, Alice, Carol) can be selected and their canvases render correctly per §6.
3. Every process in §2.3 can be initiated through the UI and produces its expected artifact.
4. Every artifact type's Detail Panel displays the correct content and allows appropriate actions.
5. Edge click behavior is consistent: every edge reveals its backing Disclosure Agreement (and Evaluation Agreement if paired).
6. Amendment cycles work end to end (amend Claim → amend Disclosure → re-evaluate → supersede).
7. Feature flag can be removed; V2.1 code paths can be deleted.
8. Build passes clean. No console errors in demo paths.

---

## 17. Future Direction (Post-V2.2)

These are architectural intentions that V2.2 does not implement but should not preclude. Claude Code: when making tactical choices during V2.2 implementation, avoid patterns that would require rework to achieve these directions later.

### 17.1 Parsing and Evaluating unification

**Thesis:** Parsing and Evaluating are the same process with different authority models. Both apply a structured template (rows with id, label, description, instruction, format, required) to evidence and produce a structured output (rows with extracted/assessed values and confidence scores). The only semantic difference is that evaluation's template rows carry a `criterion` and assessment lifecycle (SAT/UNSAT/MISSING/N/A); parsing's template rows extract values only.

**Eventual unified model:**

- One Library artifact type: "Template" (or "Specification Set" — naming TBD). A Template has rows; each row may optionally have a `criterion` field and therefore participate in assessment.
- One process: "Apply Template." Run a Template on an Asset. Output: a structured result with extracted values and, if the Template has criteria, per-row SAT/UNSAT statuses.
- Self-evaluation becomes trivial: Alice runs OSHA's Template on her Assets. If the Template has criteria (it does — OSHA has requirements), she gets a self-assessed Evaluation Result. She can reference that result in her Claim to leverage OSHA's authority.
- Selective Disclosure references rows from any structured result artifact (whether it's a "parse" result or an "evaluation" result).
- Trust derives from Template provenance: who authored the Template matters more than which of the two processes produced the result.

**V2.2 implementation constraint:** Build Parsing and Evaluating with maximum structural similarity:

- Same split-panel UI layout (evidence viewer left, rows review right).
- Same row component shape (reuse `ReviewRow`-style components where possible).
- Same `ConfidenceBadge` component.
- Same `Library` modal (Parse Templates tab + Requirements Sets tab + Published Standards tab — three tabs, one modal).
- Same JSON output shape where possible (both have `rows[]` or `fields[]` with `id`, `label`, `value`, `confidence`; Evaluation Results add `status` per row).
- Similar edge styling for artifact provenance.

When the client asks "why are these two separate processes?" the correct answer is: "they don't have to be, and the UI is built so we can merge them without disrupting user workflows."

### 17.2 Ownership Transferring process

The seventh process defined in the platform model but out of scope for V2.2. Produces a new DOT (ownership token) that supersedes the previous owner's DOT on an Asset or Claim. Data model implication: `ownerDot` should be addressable and versioned, not hardcoded. Artifact JSON should allow a history of ownership transitions.

### 17.3 Parse Results as disclosable artifacts

Currently in V2.2, Parse Results travel with their source Asset's Disclosure scope (Selective Disclosure picks fields from a Parse Result, but the Parse Result itself isn't independently disclosed). A future phase may introduce Parse Results as first-class disclosable artifacts, with their own Disclosure Agreements and PINs. This aligns with the Parsing/Evaluating unification — both become disclosable structured result artifacts.

### 17.4 Multi-party agreements

The platform model hints at support for "multiple parties" on Agreements beyond the two-party grantor/grantee structure. Not specified in detail; not implemented in V2.2. Keep Agreement artifact schemas extensible (the current `participants` array in Evaluation Agreement JSON allows growth).

### 17.5 Child layer reuse

V2.2 leaves the child layer empty. If the parent layer becomes unreadable in demo scenarios, individual output artifact types (Parse Results, superseded Eval Results, older Claim amendments) could be collapsed into child layers of their parent/source nodes. Child layer code is preserved specifically to enable this without rewriting.

---

*End of spec. Claude Code: begin Phase 1 when Andrew approves. Work to `xhigh` effort, surface ambiguities, perform a structured review against the phase's acceptance criteria before declaring phase completion.*

---

## Changelog — Spec updates during migration

Each entry names the section updated, the phase that surfaced the deviation, and a one-line summary. The implementation is the source of truth for shipped reality; these entries record where the Round 11 baseline has been corrected.

- **§2.3 Proof-Only disclosure — Phase 6:** added the rule that Proof-Only disclosure requires at least one existing Eval Result on the Claim at response time; response modal lists existing Eval Results and blocks with an informational message when none exist.
- **§3 Node type labels + state badges — Phase 3 / Phase 6 / Phase 6.5+:** codified the multi-line layout (type label above name) and documented `PROVISIONAL` / `DECLINED` / `SUPERSEDED` as separate inline badges (not suffixes on `v22Type`), with `DECLINED` outranking `PROVISIONAL`.
- **§4.4 Selected-edge state — Phase 3 / Phase 4:** revised blend from 40% → 65% white and stroke from +0.5px → +1.5px; documented the rationale (visibility parity across all four disclosure styles against the dark canvas).
- **§6.4 Counterparty referenced-Asset filtering — Phase 6.5:** clarified that non-owner viewers of a Claim Detail Panel see only the referenced-Asset subset covered by an active DA in which they are grantee.
- **§6.5 Cross-canvas pull-in rules — Phase 3 / Phase 6 / Phase 6.5 (new subsection):** codified (1) accepted inter-party DA pull-in, (2) provisional DAs do not pull onto the grantor's canvas, (3) "Carol orphan fix" second-pass counterparty internal DA inclusion, (4) declined DA retention.
- **§7.1 Story 1 — Phase 4 / Phase 5 / Phase 6 / Phase 6.5:** step 1 anchored to the Asset Detail Panel footer (primary) with banner (secondary); step 2 provisional node is requester-canvas-only; step 3 introduced `v22-request` notification delivery to the grantor; step 4 response flow is 4 steps with Full Asset checklist, Proof-Only Eval Result picker, advisory EA terms; step 5 describes the two-canvas reveal (grantee anchor Asset gets `_isNew` on the grantor's canvas too); step 6 surfaced the duplicate-detection block with jump-to-existing.
- **§7.4 V2.2 Notification Types — Phase 4 / Phase 6 / Phase 6.5 (new subsection):** tabled `v22-request` / `v22-amendment` / `v22-evaluation` with grantor-vs-grantee delivery, click-through behaviour, and persistence semantics (request persists until terminal action; others dismiss on click).
- **§10.4 Disclosure Agreement subject — Phase 1:** replaced the V2.1 `claimId` field with `subject: { kind: 'asset' | 'claim' | 'evalResult' | 'parseResult', id }`; added the subject-assignment table.
- **§10.4 subject-assignment table — Phase 4 pre-fix:** added the Parse Result → source Asset row (one internal Full DA per Parse Result so `parse → asset` edges render on the owner's canvas).
- **§10.5 `authorizedRequirementsSetIds` — Phase 6:** downgraded from enforced gate to advisory / informational; the grantee may run any Requirements Set from their library against the Claim.
- **§11.3 Evaluation amendment — Phase 6.5+:** added the duplicate-detection rule (exact `(Req Set, evidence Set)` match blocks with a "View it on the canvas →" jump); clarified the three outcomes (block / supersede / new-result).
- **§11.4 Disclosure decline — Phase 6.5:** rewrote from "both artifacts deleted" to decline retention with `_declineMeta` annotation; declined DA derives its edge normally in DECLINED state; Dismiss strips annotations and collapses both artifacts + edge together.
- **§11.6 Self-evaluation — Phase 6 (new subsection):** documented the self-eval artifact shape (no EA; internal proof-of-evaluation DA + ownership DA with grantor == grantee); noted the `deriveAgreementEdges` internal-proof branch and that duplicate detection / supersede rules apply identically.
- **§12.6 Demo dataset composition — Phase 6.5 (new subsection):** enumerated actors + asset/claim/parse/eval/DA counts shipped in `buildV22SharedArtifacts`, including Bob's 3 Assets and Carol's 2 Assets added in Phase 5.
- **§1 Summary + document structure note — Phase 8:** reframed from "V2.2 migration spec" to "platform architecture spec" post-migration; added a note clarifying that §12 + §13 are preserved as historical record rather than operative guidance.
- **§7.4 Notification Types — Phase 8:** section title dropped the "V2.2" prefix.
- **§11.6 Self-evaluation — Phase 8:** section title dropped the "(Phase 6)" suffix.
- **§11.8 Parse flow — Phase 8 (new subsection):** documented the V2.2 Parse Evidence flow (`V22ParseEvidenceModal` + `makeParseRunArtifacts` factory + internal Full DA wiring the new Parse Result to its source Asset). Closes the one remaining gap in V2.2's process coverage — parsing was seeded in demo data but had no user-facing creation flow pre-Phase-8.
