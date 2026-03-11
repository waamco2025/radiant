import { useState, useMemo } from "react";

/*
 * Radiant IA Map v7 — Post Batch 38
 * Updated after batches 27a–38
 *
 * Changes since v6:
 *  - Light Mode: Complete CSS custom properties theme infrastructure (~80+ variables),
 *    dark/light toggle in Header, bulk migration of ~2000+ hardcoded hex colors across
 *    38+ component files, warm off-white light palette, Google Fonts (Lora + JetBrains Mono).
 *  - Batch 36: Light mode refinements — REVOKED button visibility fix, NEW badge gradient
 *    theme-awareness, breadcrumb pillbox + supplier legend overlay fix, systemic
 *    color-mix() fix for hex-alpha appending pattern across 17 files.
 *  - P3 (Light Mode) story fully completed.
 *  - Batch 37: Refinements polish pass — 8 items from Refinements Backlog: SDA revocation
 *    reason guard, eval modal checklist headers, approve/reject visual separation,
 *    disclosure offer radio + revoke, supplier SDA revocation, network event type audit,
 *    sidebar approval status filter.
 *  - Batch 38: Final feature batch — seed evidence, disclosure offer field selection,
 *    eval checklist dropdown, filter badge counts, FILTERED badge on NetGraph, NEW badge
 *    logic (localStorage-based), posted requirements (supplier browse), manage attestations.
 *
 * Prior changes (v5→v6):
 *  - Batches 29a–35: Detail Panel tabs, Activity Log, SDA Revocation, Sidebar filter
 *    reactivity, Disclosure Offer/Request, DetailPanel decomposition, Evidence-aware
 *    re-evaluation loop, Disclosure Request Approval. See v6 header for details.
 */

const C = {
  bg: "#08090d", surface: "#0f1117", surfaceAlt: "#161a24",
  card: "#111520", border: "#1c2030", borderHi: "#2a3148",
  text: "#e8eaf0", textSoft: "#9ba3b8", textDim: "#5c6580", textFaint: "#3a4058",
  accent: "#818cf8", accentDim: "#2d2f5e",
  green: "#22c55e", greenDim: "#0a2918",
  amber: "#f59e0b", amberDim: "#2a1f08",
  red: "#ef4444", redDim: "#2a0f0f",
  cyan: "#22d3ee", cyanDim: "#0a2028",
  purple: "#a78bfa", purpleDim: "#1f1838",
  orange: "#fb923c", orangeDim: "#2a1a0a",
  blue: "#3b82f6", blueDim: "#0f1a30",
};

const font = `"DM Sans", system-ui, -apple-system, sans-serif`;
const mono = `"JetBrains Mono", "SF Mono", monospace`;

function Badge({ color, bg, children, small }) {
  return (
    <span style={{
      fontSize: small ? 8 : 9, fontFamily: mono, fontWeight: 700,
      color, background: bg || color + "18", padding: small ? "1px 5px" : "2px 8px",
      borderRadius: 3, letterSpacing: ".03em", whiteSpace: "nowrap",
      border: `1px solid ${color}22`,
    }}>{children}</span>
  );
}

function SectionCard({ title, subtitle, accent, children }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      overflow: "hidden", marginBottom: 16,
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ width: 3, height: 20, borderRadius: 2, background: accent || C.accent }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: "14px 18px" }}>{children}</div>
    </div>
  );
}

/* ─── User Story Data ─── */

const STORIES = [
  // ═══ BUYER STORIES ═══
  {
    id: "B1", role: "buyer", title: "Explore Supply Network",
    desc: "Navigate multi-tier supply chain, view node details, filter attestations",
    steps: [
      { label: "View Network Graph with card pairs", status: "done", batch: "pre-27" },
      { label: "Click nodes → Detail Panel with attestations", status: "done", batch: "pre-27" },
      { label: "Filter by attestation type/status (sidebar)", status: "done", batch: "pre-27" },
      { label: "Breadcrumb navigation", status: "done", batch: "pre-27" },
      { label: "Zoom/pan/fit controls", status: "done", batch: "pre-27" },
      { label: "Network Events overlay (4-stage)", status: "done", batch: "pre-27" },
      { label: "Provisional vs approved node visual treatment", status: "done", batch: "27e" },
      { label: "~97% pre-seeded approved, ~3% provisional for demo", status: "done", batch: "27e-fix2" },
      { label: "Legend entry for provisional nodes", status: "done", batch: "27e-fix" },
    ],
  },
  {
    id: "B2", role: "buyer", title: "Evaluate Supplier Asset",
    desc: "Run AI evaluation against requirements checklist, review results, approve/reject",
    steps: [
      { label: "Select checklist + evaluator type", status: "done", batch: "pre-27" },
      { label: "Credit check + deduction", status: "done", batch: "pre-27" },
      { label: "AI evaluation engine (PRNG results, triage)", status: "done", batch: "pre-27" },
      { label: "Human review: Confirm / Override / Request Evidence", status: "done", batch: "pre-27" },
      { label: "Approve All quick action", status: "done", batch: "27e" },
      { label: "Adaptive finalize button (green/grey/red)", status: "done", batch: "27e-fix2" },
      { label: "Evidence dominates fail in finalize button", status: "done", batch: "27e-fix3" },
      { label: "Eval result uses post-decision counts", status: "done", batch: "27e-fix2" },
      { label: "Finalize → Proof of Evaluation attestation", status: "done", batch: "pre-27" },
      { label: "Buyer sees evaluation results in Detail Panel", status: "done", batch: "27a" },
      { label: "Evidence requests created from review decisions", status: "done", batch: "27e" },
      { label: "Evidence requests visible in Detail Panel (PENDING badges)", status: "done", batch: "27e" },
      { label: "Camera stays on node after eval (no jump to org)", status: "done", batch: "27e-fix2" },
      { label: "Review submitted evidence inline (accept/reject)", status: "done", batch: "28" },
      { label: "Evidence-aware re-evaluation (scores boosted by evidence)", status: "done", batch: "34" },
      { label: "Re-evaluate button on failed evals with accepted evidence", status: "done", batch: "34" },
      { label: "Checklist-locked modal with evidence trail", status: "done", batch: "34" },
      { label: "Combined Accept→Re-Evaluate shortcut (saves click)", status: "done", batch: "34" },
      { label: "Multi-round evidence accumulation (resolved status)", status: "done", batch: "34" },
    ],
  },
  {
    id: "B3", role: "buyer", title: "Approve or Reject Assets",
    desc: "Gate provisional assets into verified network or remove them",
    steps: [
      { label: "Approve asset → permanent network member (fills in card)", status: "done", batch: "27d" },
      { label: "Approval gated behind first evaluation", status: "done", batch: "27d" },
      { label: "Reject asset → node removed from tree entirely", status: "done", batch: "27e-fix2" },
      { label: "Rejection ungated (no eval needed)", status: "done", batch: "27e-fix2" },
      { label: "Confirmation dialogs with notes/reason", status: "done", batch: "27d" },
      { label: "APPROVED status in Detail Panel header", status: "done", batch: "27d" },
      { label: "SDA revocation for removing approved nodes", status: "done", batch: "30" },
      { label: "Activity Log for rejection audit trail", status: "done", batch: "30" },
    ],
  },
  {
    id: "B4", role: "buyer", title: "Invite Supplier to Network",
    desc: "Send invitation, supplier accepts, node added to buyer network",
    steps: [
      { label: "Invite Supplier button in Detail Panel", status: "done", batch: "pre-27" },
      { label: "Standalone invite panel (header button)", status: "done", batch: "pre-27" },
      { label: "Invitation dispatched to supplier", status: "done", batch: "pre-27" },
      { label: "Supplier receives invitation (InvitationModal)", status: "done", batch: "27a" },
      { label: "Supplier registers asset or selects existing", status: "done", batch: "pre-27" },
      { label: "Supplier selects disclosure type", status: "done", batch: "pre-27" },
      { label: "SDA created → node appears in buyer network", status: "done", batch: "pre-27" },
      { label: "New node appears as provisional (hollow card)", status: "done", batch: "27e" },
    ],
  },
  {
    id: "B5", role: "buyer", title: "Browse Asset Directory",
    desc: "Discover platform-registered assets, preview disclosures, request access",
    steps: [
      { label: "Asset Directory modal opens from header", status: "done", batch: "27b-fix" },
      { label: "Browse platform assets (not buyer's network)", status: "done", batch: "27c" },
      { label: "Search by name/type/supplier/location", status: "done", batch: "27c" },
      { label: "Sort by name/type/health/claims", status: "done", batch: "27c" },
      { label: "View asset detail (in-modal)", status: "done", batch: "27b-fix2" },
      { label: "Preview disclosed fields (full/selective/derivative)", status: "done", batch: "27c" },
      { label: "Redacted fields shown for selective", status: "done", batch: "27c" },
      { label: "Derivative shows eval summary only", status: "done", batch: "27c" },
      { label: "Health dot tooltips on cards", status: "done", batch: "27c" },
      { label: "Request Disclosure action", status: "done", batch: "32" },
    ],
  },
  {
    id: "B6", role: "buyer", title: "View Supply Map",
    desc: "Geographic visualization of supply chain nodes",
    steps: [
      { label: "World map with node markers", status: "done", batch: "pre-27" },
      { label: "Country-level aggregation", status: "done", batch: "pre-27" },
      { label: "Sidebar filter reactivity (dimmed markers, filtered panels, badge)", status: "done", batch: "31" },
    ],
  },
  {
    id: "B7", role: "buyer", title: "Assess Risk Matrix",
    desc: "Evaluate supply chain risk across nodes",
    steps: [
      { label: "Risk matrix visualization", status: "done", batch: "pre-27" },
      { label: "Node placement by risk factors", status: "done", batch: "pre-27" },
      { label: "Sidebar filter reactivity (dimmed dots, filtered stats, badge)", status: "done", batch: "31" },
    ],
  },
  {
    id: "B8", role: "buyer", title: "Manage Programs & Systems",
    desc: "Create organizational structure within network",
    steps: [
      { label: "Create Program via modal", status: "done", batch: "pre-27" },
      { label: "Create System under Program", status: "done", batch: "pre-27" },
      { label: "Tree insertion + graph pan-to", status: "done", batch: "pre-27" },
    ],
  },
  {
    id: "B9", role: "buyer", title: "Post Requirements for Suppliers",
    desc: "Publish requirements that suppliers can browse and respond to",
    steps: [
      { label: "Header button entry point", status: "done", batch: "26b" },
      { label: "RequirementsLibraryModal with per-vertical data", status: "done", batch: "pre-27" },
      { label: "Supplier-visible listing (Browse Requirements in SupplierSidebar)", status: "done", batch: "38" },
    ],
  },
  // ═══ SUPPLIER STORIES ═══
  {
    id: "S1", role: "supplier", title: "View Buyer Networks",
    desc: "See assets disclosed to each buyer, manage relationships",
    steps: [
      { label: "3-column graph (Org → Assets → Buyers)", status: "done", batch: "pre-27" },
      { label: "Asset cards with health/SDA/POE indicators", status: "done", batch: "pre-27" },
      { label: "Click org → network summary", status: "done", batch: "pre-27" },
      { label: "Click buyer → disclosure summary", status: "done", batch: "pre-27" },
      { label: "SDA edge styling by type", status: "done", batch: "pre-27" },
      { label: "Network Updates overlay (4-stage)", status: "done", batch: "pre-27" },
    ],
  },
  {
    id: "S2", role: "supplier", title: "Accept Invitation & Disclose",
    desc: "Receive invitation, register asset, create SDA",
    steps: [
      { label: "Invitation appears in sidebar", status: "done", batch: "pre-27" },
      { label: "InvitationModal with detail + context", status: "done", batch: "27a" },
      { label: "Register new asset (in-flow)", status: "done", batch: "pre-27" },
      { label: "Select existing asset for re-invitation", status: "done", batch: "pre-27" },
      { label: "Choose disclosure type (Full/Selective/Derivative)", status: "done", batch: "pre-27" },
      { label: "SDA Creation Wizard", status: "done", batch: "pre-27" },
      { label: "Decline invitation (2-step confirm)", status: "done", batch: "27a" },
    ],
  },
  {
    id: "S3", role: "supplier", title: "Register Standalone Asset",
    desc: "Register assets on-chain outside of invitation flow",
    steps: [
      { label: "Register Asset button in header", status: "done", batch: "27b" },
      { label: "Modal with name/type/location fields", status: "done", batch: "27b" },
      { label: "Type icons + downstream→upstream ordering", status: "done", batch: "27b-fix2" },
      { label: "Confirmation step (on-chain immutability warning)", status: "done", batch: "27c" },
      { label: "Asset appears in graph + sidebar with default claims", status: "done", batch: "27b" },
    ],
  },
  {
    id: "S4", role: "supplier", title: "Manage Attestations",
    desc: "View, add, revoke attestations on registered assets",
    steps: [
      { label: "Manage Attestations panel in supplier Detail Panel", status: "done", batch: "38" },
      { label: "Attestation list with status badges", status: "done", batch: "38" },
      { label: "Add new claim by predicate dropdown", status: "done", batch: "38" },
      { label: "Revoke attestation with reason + confirmation", status: "done", batch: "38" },
    ],
  },
  {
    id: "S5", role: "supplier", title: "Respond to Evidence Requests",
    desc: "Receive buyer evidence requests, upload documentation",
    steps: [
      { label: "Evidence requests visible in supplier Detail Panel", status: "done", batch: "28-fix" },
      { label: "See which requirements need evidence", status: "done", batch: "28-fix" },
      { label: "Respond with Evidence button + mock upload form", status: "done", batch: "28-fix" },
      { label: "Submit → status changes to SUBMITTED (cyan)", status: "done", batch: "28-fix" },
      { label: "Resubmit after rejection (see rejection reason, resubmit)", status: "done", batch: "28" },
      { label: "Buyer accepts → ACCEPTED (green) on both sides", status: "done", batch: "28" },
      { label: "Evidence-aware re-evaluation (AI scores boosted)", status: "done", batch: "34" },
      { label: "Evidence accumulation display (prior submissions trail)", status: "done", batch: "34" },
      { label: "Resolved status for evidence used in re-evaluation", status: "done", batch: "34" },
    ],
  },
  {
    id: "S6", role: "supplier", title: "Create Standing Disclosure Offer",
    desc: "Offer disclosure types visible to any buyer on the platform",
    steps: [
      { label: "Inline offer creation form (type checkboxes, discoverable toggle)", status: "done", batch: "32" },
      { label: "Existing offer card display with type badges", status: "done", batch: "32" },
      { label: "Network event + activity log on creation", status: "done", batch: "32" },
      { label: "Buyer requests disclosure from Asset Directory", status: "done", batch: "32" },
      { label: "Supplier reviews request → approves → SDA created", status: "done", batch: "35" },
    ],
  },
  // ═══ CASCADING DISCLOSURE ═══
  {
    id: "B10", role: "buyer", title: "Request Cascading Disclosure",
    desc: "Ask a tier-1 supplier to propagate disclosure requests upstream, building multi-tier chains",
    steps: [
      { label: "Header '+ Invite' button enabled with node-selection step", status: "gap", batch: "—" },
      { label: "Request cascade on existing tier-1 node (buyer Detail Panel)", status: "gap", batch: "—" },
      { label: "Cascade request dispatched to supplier", status: "gap", batch: "—" },
      { label: "Cascaded nodes appear as tier-2+ in NetGraph", status: "gap", batch: "—" },
      { label: "Cascade edge styling (dash-dot, purple)", status: "gap", batch: "—" },
      { label: "Cascade provenance visible in Detail Panel (chain origin)", status: "gap", batch: "—" },
    ],
  },
  {
    id: "S7", role: "supplier", title: "Propagate Cascade Upstream",
    desc: "Receive cascade request from buyer, ask own suppliers to disclose up the chain",
    steps: [
      { label: "Cascade request visible in supplier sidebar + Detail Panel", status: "gap", batch: "—" },
      { label: "Select upstream asset to cascade through", status: "gap", batch: "—" },
      { label: "Choose cascade policy: open (any downstream) vs scoped (specific buyer network)", status: "gap", batch: "—" },
      { label: "Forward cascade invitation to own suppliers", status: "gap", batch: "—" },
      { label: "Cascaded SDA created with originChainId reference", status: "gap", batch: "—" },
      { label: "Cascade status tracking (pending → accepted → active)", status: "gap", batch: "—" },
    ],
  },
  // ═══ SHARED / PLATFORM STORIES ═══
  {
    id: "P1", role: "platform", title: "Vertical Switching",
    desc: "Switch between Aerospace, Healthcare, GovSat, Microelectronics",
    steps: [
      { label: "Vertical selector in header", status: "done", batch: "pre-27" },
      { label: "Full state reset on switch", status: "done", batch: "pre-27" },
      { label: "Vertical-specific nomenclature", status: "done", batch: "pre-27" },
      { label: "Vertical-specific asset directory content", status: "done", batch: "27c" },
      { label: "Approval states re-seeded on vertical switch", status: "done", batch: "27e-fix2" },
    ],
  },
  {
    id: "P2", role: "platform", title: "Role Switching",
    desc: "Toggle between Buyer and Supplier modes",
    steps: [
      { label: "Role toggle in header", status: "done", batch: "pre-27" },
      { label: "Mode-specific views/panels/modals", status: "done", batch: "pre-27" },
      { label: "Separate credit pools", status: "done", batch: "pre-27" },
      { label: "Both roles start with 2400 credits", status: "done", batch: "28-fix" },
    ],
  },
  {
    id: "P3", role: "platform", title: "Light Mode",
    desc: "Full light theme implementation",
    steps: [
      { label: "CSS custom properties infrastructure (~80+ variables)", status: "done", batch: "36" },
      { label: "Light token palette (warm off-white, not pure white)", status: "done", batch: "36" },
      { label: "Dark/light toggle in Header (sun/moon button)", status: "done", batch: "36" },
      { label: "Bulk migration of ~2000+ hardcoded hex → var() across 38+ files", status: "done", batch: "36" },
      { label: "Token layer: TT/CS objects + detailPanelUtils color maps → CSS vars", status: "done", batch: "36" },
      { label: "SVG components themed (NetGraph, SupplierNetGraph, WorldMap, etc.)", status: "done", batch: "36" },
      { label: "Theme persistence via localStorage", status: "done", batch: "36" },
      { label: "BootScreen stays hardcoded dark regardless of theme", status: "done", batch: "36" },
      { label: "Refinements: REVOKED button, NEW badge, breadcrumb, legend, color-mix()", status: "done", batch: "36" },
    ],
  },
];

/* ─── Bob & Alice Walkthrough Stories ─── */

const BOB_ALICE_STORIES = [
  {
    id: "BA1",
    title: "First Contact: Alice Invites Bob",
    subtitle: "Alice discovers a gap in her supply chain and brings Bob in as a new supplier",
    color: C.green,
    steps: [
      { actor: "alice", label: "Alice notices a component node has no upstream supplier", status: "done", ref: "B1" },
      { actor: "alice", label: "Clicks '+ Invite Upstream Supplier' on the node's Detail Panel", status: "done", ref: "B4" },
      { actor: "alice", label: "Fills out invitation with component requirements", status: "done", ref: "B4" },
      { actor: "bob", label: "Bob sees invitation appear in Supplier Portal sidebar", status: "done", ref: "S2" },
      { actor: "bob", label: "Opens InvitationModal — sees buyer context + requested component", status: "done", ref: "S2" },
      { actor: "bob", label: "Selects 'Register New Asset' (or picks existing)", status: "done", ref: "S3" },
      { actor: "bob", label: "Chooses disclosure type: Full Disclosure", status: "done", ref: "S2" },
      { actor: "bob", label: "Completes SDA Creation Wizard → agreement signed on-chain", status: "done", ref: "S2" },
      { actor: "alice", label: "New provisional node appears in Alice's network (hollow card)", status: "done", ref: "B1" },
      { actor: "alice", label: "Alice runs first evaluation against AS9100 Rev D", status: "done", ref: "B2" },
      { actor: "alice", label: "Reviews results, all pass → clicks Approve Asset", status: "done", ref: "B3" },
      { actor: "alice", label: "Node fills in with tier color — permanent network member", status: "done", ref: "B3" },
    ],
  },
  {
    id: "BA2",
    title: "The Evidence Dance: Alice Needs Proof from Bob",
    subtitle: "Evaluation reveals gaps, triggering an evidence request → response → re-evaluation loop",
    color: C.amber,
    steps: [
      { actor: "alice", label: "Alice runs CMMC Level 2 evaluation on Bob's MOSFET Module", status: "done", ref: "B2" },
      { actor: "alice", label: "AI flags 'Practice 70 · CMMC L2' as NOT EVIDENCED (43% confidence)", status: "done", ref: "B2" },
      { actor: "alice", label: "In human review, marks it as 'Request Evidence' instead of override", status: "done", ref: "B2" },
      { actor: "alice", label: "Clicks 'Request Evidence (1) & Finalize →' — grey adaptive button", status: "done", ref: "B2" },
      { actor: "alice", label: "Evidence request created: PENDING badge appears in Detail Panel", status: "done", ref: "B2" },
      { actor: "bob", label: "Bob opens MOSFET Module → sees EVIDENCE REQUESTS (1) · 1 pending", status: "done", ref: "S5" },
      { actor: "bob", label: "Clicks 'Respond with Evidence' → upload form expands inline", status: "done", ref: "S5" },
      { actor: "bob", label: "Selects file (practice_70_cmmc_l2_evidence.pdf) + adds notes", status: "done", ref: "S5" },
      { actor: "bob", label: "Clicks 'Submit Evidence' → status changes to SUBMITTED (cyan)", status: "done", ref: "S5" },
      { actor: "alice", label: "Alice sees SUBMITTED badge + Bob's file + notes in her Detail Panel", status: "done", ref: "B2" },
      { actor: "alice", label: "Clicks '✓ Accept' — evidence request resolves to ACCEPTED (green)", status: "done", ref: "B2" },
      { actor: "alice", label: "Clicks 'Re-Evaluate' on submitted evidence — accepts + opens locked modal", status: "done", ref: "B2" },
      { actor: "alice", label: "Re-runs CMMC L2 evaluation — engine sees attached evidence", status: "done", ref: "B2" },
      { actor: "alice", label: "Practice 70 now scores PASS · HIGH (boosted by evidence, EV badge)", status: "done", ref: "B2" },
      { actor: "alice", label: "All items pass → green 'Finalize & Issue Credential →' button", status: "done", ref: "B2" },
      { actor: "alice", label: "CMMC L2 eval now shows PASS in Detail Panel (was FAIL)", status: "done", ref: "B2" },
    ],
  },
  {
    id: "BA3",
    title: "The Rejection Loop: Alice Pushes Back",
    subtitle: "Alice rejects Bob's evidence, Bob resubmits with better docs",
    color: C.red,
    steps: [
      { actor: "alice", label: "Alice reviews Bob's submitted evidence for Practice 70", status: "done", ref: "B2" },
      { actor: "alice", label: "Clicks '✗ Reject' → rejection reason textarea expands", status: "done", ref: "B2" },
      { actor: "alice", label: "Types: 'Report is from 2024, need current year certification'", status: "done", ref: "B2" },
      { actor: "alice", label: "Confirms rejection → status changes to REJECTED (red)", status: "done", ref: "B2" },
      { actor: "bob", label: "Bob sees REJECTED badge + Alice's rejection reason in red", status: "done", ref: "S5" },
      { actor: "bob", label: "Button now says 'Resubmit Evidence' instead of 'Respond'", status: "done", ref: "S5" },
      { actor: "bob", label: "Uploads new file with 2026 cert → submits → RESUBMITTED (cyan)", status: "done", ref: "S5" },
      { actor: "alice", label: "Alice sees resubmitted evidence → accepts this time → ACCEPTED", status: "done", ref: "B2" },
    ],
  },
  {
    id: "BA4",
    title: "Discovery: Bob Makes Himself Findable",
    subtitle: "Bob creates a standing offer, Alice finds him through the Asset Directory",
    color: C.purple,
    steps: [
      { actor: "bob", label: "Bob opens his MOSFET Module in Supplier Portal", status: "done", ref: "S1" },
      { actor: "bob", label: "Clicks '+ Create Disclosure Offer' — inline form with type checkboxes", status: "done", ref: "S6" },
      { actor: "bob", label: "Toggles 'Discoverable in Asset Directory' ON, clicks Create Offer", status: "done", ref: "S6" },
      { actor: "alice", label: "Alice opens Asset Directory from header", status: "done", ref: "B5" },
      { actor: "alice", label: "Searches for 'MOSFET' → sees Bob's asset with disclosure badge", status: "done", ref: "B5" },
      { actor: "alice", label: "Previews disclosed fields (full/selective/derivative)", status: "done", ref: "B5" },
      { actor: "alice", label: "Clicks 'Request Disclosure' → selects type → sends request to Bob", status: "done", ref: "B5" },
      { actor: "bob", label: "Bob reviews request → approves → SDA created automatically", status: "done", batch: "35", ref: "S6" },
      { actor: "alice", label: "Node appears in Alice's network as provisional", status: "done", batch: "35", ref: "B1" },
    ],
  },
  {
    id: "BA5",
    title: "The Chain Grows: Alice Asks Bob to Cascade Upstream",
    subtitle: "Alice wants visibility into Bob's suppliers — Bob propagates a cascade disclosure request up the chain",
    color: C.cyan,
    steps: [
      { actor: "alice", label: "Alice selects Bob's MOSFET Module (tier-1) in her network", status: "gap", ref: "B10" },
      { actor: "alice", label: "Clicks 'Request Cascade' — asks Bob to disclose his upstream suppliers", status: "gap", ref: "B10" },
      { actor: "bob", label: "Bob sees cascade request in Supplier Portal — Alice wants upstream visibility", status: "gap", ref: "S7" },
      { actor: "bob", label: "Selects his Silicon Wafer supplier (Carol) as the upstream asset to cascade", status: "gap", ref: "S7" },
      { actor: "bob", label: "Chooses 'Scoped' cascade — only Alice's network can see Carol's data", status: "gap", ref: "S7" },
      { actor: "bob", label: "Forwards cascade invitation to Carol with field selection (selective cascade)", status: "gap", ref: "S7" },
      { actor: "carol", label: "Carol receives cascade invitation — sees it originates from Alice's network via Bob", status: "gap", ref: "S7" },
      { actor: "carol", label: "Accepts with selective disclosure — redacts pricing + supplier_identity", status: "gap", ref: "S7" },
      { actor: "carol", label: "Cascaded SDA created with originChainId linking back to Bob's SDA with Alice", status: "gap", ref: "S7" },
      { actor: "alice", label: "Carol's Silicon Wafer appears as tier-2 node in Alice's NetGraph (purple dash-dot edge)", status: "gap", ref: "B10" },
      { actor: "alice", label: "Detail Panel shows cascade provenance: Carol → Bob → Alice", status: "gap", ref: "B10" },
      { actor: "alice", label: "Alice can evaluate Carol's asset (with redacted fields showing NOT EVIDENCED)", status: "gap", ref: "B2" },
    ],
  },
];

/* ─── Computed stats ─── */
function computeStats(stories) {
  let total = 0, done = 0, inProgress = 0, scaffolded = 0, gap = 0;
  stories.forEach(s => s.steps.forEach(st => {
    total++;
    if (st.status === "done") done++;
    else if (st.status === "in-progress") inProgress++;
    else if (st.status === "scaffolded") scaffolded++;
    else if (st.status === "gap") gap++;
  }));
  return { total, done, inProgress, scaffolded, gap };
}

function storyCompletion(story) {
  const done = story.steps.filter(s => s.status === "done").length;
  return { done, total: story.steps.length, pct: Math.round((done / story.steps.length) * 100) };
}

function statusColor(status) {
  return status === "done" ? C.green
    : status === "in-progress" ? C.amber
    : status === "scaffolded" ? C.accent
    : C.red;
}
function statusLabel(status) {
  return status === "done" ? "DONE"
    : status === "in-progress" ? "IN PROGRESS"
    : status === "scaffolded" ? "SCAFFOLDED"
    : "GAP";
}

function ProgressBar({ pct, color, height = 4 }) {
  return (
    <div style={{ height, background: C.border, borderRadius: height / 2, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color || C.green, borderRadius: height / 2, transition: "width .3s" }} />
    </div>
  );
}


/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function IAMapV7() {
  const [tab, setTab] = useState("stories");
  const [roleFilter, setRoleFilter] = useState("all");

  const stats = useMemo(() => computeStats(STORIES), []);
  const filteredStories = useMemo(() =>
    roleFilter === "all" ? STORIES : STORIES.filter(s => s.role === roleFilter),
    [roleFilter]
  );

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: font, minHeight: "100vh", padding: "24px 20px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>Radiant IA Map</span>
            <Badge color={C.accent}>v7</Badge>
            <Badge color={C.green} small>Post Batch 38</Badge>
          </div>
          <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
            User story tracker + Bob & Alice walkthroughs · Updated through batch 38
          </div>
        </div>

        {/* Global stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20,
        }}>
          {[
            { label: "Total Steps", value: stats.total, color: C.textSoft },
            { label: "Done", value: stats.done, color: C.green },
            { label: "In Progress", value: stats.inProgress, color: C.amber },
            { label: "Scaffolded", value: stats.scaffolded, color: C.accent },
            { label: "Gaps", value: stats.gap, color: C.red },
          ].map(s => (
            <div key={s.label} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "12px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: mono }}>{s.value}</div>
              <div style={{ fontSize: 9, color: C.textDim, fontFamily: mono, letterSpacing: ".04em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: mono, whiteSpace: "nowrap" }}>OVERALL</div>
          <ProgressBar pct={Math.round((stats.done / stats.total) * 100)} height={6} />
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: mono, whiteSpace: "nowrap" }}>
            {Math.round((stats.done / stats.total) * 100)}%
          </div>
          <div style={{ fontSize: 10, color: C.textDim, whiteSpace: "nowrap" }}>
            {stats.done}/{stats.total} steps
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 2, marginBottom: 20, background: C.surface, borderRadius: 8, padding: 3, width: "fit-content" }}>
          {[
            { id: "stories", label: "User Stories" },
            { id: "alice", label: "Bob & Alice" },
            { id: "batches", label: "Batch Log" },
            { id: "gaps", label: "Open Gaps" },
            { id: "model", label: "Approval Model" },
            { id: "next", label: "What's Next" },
            { id: "refinements", label: "Refinements" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 11, fontFamily: font, fontWeight: 600,
              background: tab === t.id ? C.accent : "transparent",
              color: tab === t.id ? "#fff" : C.textDim,
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "stories" && <StoriesTab stories={filteredStories} roleFilter={roleFilter} setRoleFilter={setRoleFilter} />}
        {tab === "alice" && <BobAliceTab />}
        {tab === "batches" && <BatchesTab />}
        {tab === "gaps" && <GapsTab />}
        {tab === "model" && <ApprovalModelTab />}
        {tab === "next" && <NextTab />}
        {tab === "refinements" && <RefinementsTab />}
      </div>
    </div>
  );
}


/* ═══ STORIES TAB ═══ */
function StoriesTab({ stories, roleFilter, setRoleFilter }) {
  const [expanded, setExpanded] = useState(new Set());
  const toggle = (id) => setExpanded(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "all", label: "All", color: C.textSoft },
          { id: "buyer", label: "Buyer", color: C.green },
          { id: "supplier", label: "Supplier", color: C.cyan },
          { id: "platform", label: "Platform", color: C.purple },
        ].map(r => (
          <button key={r.id} onClick={() => setRoleFilter(r.id)} style={{
            padding: "5px 12px", borderRadius: 5, border: `1px solid ${roleFilter === r.id ? r.color + "66" : C.border}`,
            background: roleFilter === r.id ? r.color + "15" : "transparent",
            color: roleFilter === r.id ? r.color : C.textDim,
            fontSize: 10, fontFamily: mono, fontWeight: 600, cursor: "pointer",
          }}>{r.label}</button>
        ))}
      </div>

      {stories.map(story => {
        const comp = storyCompletion(story);
        const isOpen = expanded.has(story.id);
        const roleColor = story.role === "buyer" ? C.green : story.role === "supplier" ? C.cyan : C.purple;
        const allDone = comp.pct === 100;
        const hasGaps = story.steps.some(s => s.status === "gap");

        return (
          <div key={story.id} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            marginBottom: 8, overflow: "hidden",
          }}>
            <div onClick={() => toggle(story.id)} style={{
              padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              borderBottom: isOpen ? `1px solid ${C.border}` : "none",
            }}>
              <Badge color={roleColor} small>{story.id}</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: allDone ? C.green : C.text }}>
                  {allDone && <span style={{ marginRight: 4 }}>✓</span>}
                  {story.title}
                  {hasGaps && <span style={{ marginLeft: 6, fontSize: 9, color: C.red, fontFamily: mono }}>HAS GAPS</span>}
                </div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 1 }}>{story.desc}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ width: 80 }}>
                  <ProgressBar pct={comp.pct} color={allDone ? C.green : comp.pct > 70 ? C.amber : C.accent} />
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: mono, width: 36, textAlign: "right",
                  color: allDone ? C.green : comp.pct > 70 ? C.amber : C.textDim,
                }}>{comp.pct}%</span>
                <span style={{ fontSize: 10, color: C.textFaint, transition: "transform .15s", transform: isOpen ? "rotate(90deg)" : "none" }}>›</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: "8px 16px 12px" }}>
                {story.steps.map((step, i) => {
                  const sc = statusColor(step.status);
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                      borderBottom: i < story.steps.length - 1 ? `1px solid ${C.border}22` : "none",
                      opacity: step.status === "done" ? 0.65 : 1,
                    }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                        border: `1.5px solid ${sc}`,
                        background: step.status === "done" ? sc : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, color: step.status === "done" ? "#fff" : sc,
                      }}>
                        {step.status === "done" ? "✓" : step.status === "in-progress" ? "◌" : step.status === "scaffolded" ? "◇" : "✗"}
                      </span>
                      <span style={{ flex: 1, fontSize: 11, color: step.status === "gap" ? C.red : C.textSoft }}>{step.label}</span>
                      <Badge color={sc} small>{statusLabel(step.status)}</Badge>
                      {step.batch !== "—" && (
                        <span style={{ fontSize: 8, color: C.textFaint, fontFamily: mono, width: 56, textAlign: "right" }}>{step.batch}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}


/* ═══ BOB & ALICE TAB ═══ */
function BobAliceTab() {
  const [expanded, setExpanded] = useState(new Set(["BA2"])); // default open the evidence dance

  const toggle = (id) => setExpanded(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const aliceColor = C.green;
  const bobColor = C.cyan;

  return (
    <>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "14px 18px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Two-Sided Walkthrough Stories
        </div>
        <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.6, marginBottom: 10 }}>
          These stories show how Alice (buyer at Stellar Dynamics Aerospace) and Bob (supplier at Curtiss-Wright Defense Solutions) interact through the platform. Each step shows which side acts, whether it's built, and which user story it maps to.
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: aliceColor }} />
            <span style={{ color: aliceColor, fontWeight: 600 }}>Alice</span>
            <span style={{ color: C.textDim }}>· Buyer · Thomas Crowley</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: bobColor }} />
            <span style={{ color: bobColor, fontWeight: 600 }}>Bob</span>
            <span style={{ color: C.textDim }}>· Supplier · David Park</span>
          </div>
        </div>
      </div>

      {BOB_ALICE_STORIES.map(story => {
        const isOpen = expanded.has(story.id);
        const doneCount = story.steps.filter(s => s.status === "done").length;
        const totalCount = story.steps.length;
        const pct = Math.round((doneCount / totalCount) * 100);
        const allDone = pct === 100;

        return (
          <div key={story.id} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            marginBottom: 10, overflow: "hidden",
          }}>
            <div onClick={() => toggle(story.id)} style={{
              padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              borderBottom: isOpen ? `1px solid ${C.border}` : "none",
            }}>
              <div style={{ width: 4, height: 36, borderRadius: 2, background: story.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: allDone ? C.green : C.text }}>{story.title}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{story.subtitle}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ width: 80 }}>
                  <ProgressBar pct={pct} color={allDone ? C.green : pct > 70 ? C.amber : C.accent} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: mono, color: allDone ? C.green : C.textDim }}>{pct}%</span>
                <span style={{ fontSize: 10, color: C.textFaint, transition: "transform .15s", transform: isOpen ? "rotate(90deg)" : "none" }}>›</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: "4px 18px 14px" }}>
                {story.steps.map((step, i) => {
                  const isAlice = step.actor === "alice";
                  const actorColor = isAlice ? aliceColor : bobColor;
                  const sc = statusColor(step.status);
                  const prevActor = i > 0 ? story.steps[i - 1].actor : null;
                  const switchedSide = prevActor && prevActor !== step.actor;

                  return (
                    <div key={i}>
                      {switchedSide && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0 2px" }}>
                          <div style={{ flex: 1, height: 1, background: C.border }} />
                          <span style={{ fontSize: 8, color: C.textFaint, fontFamily: mono }}>SWITCH TO {step.actor.toUpperCase()}</span>
                          <div style={{ flex: 1, height: 1, background: C.border }} />
                        </div>
                      )}
                      <div style={{
                        display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0",
                        opacity: step.status === "done" ? 0.6 : 1,
                      }}>
                        {/* Actor dot */}
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                          background: actorColor + "20", border: `1.5px solid ${actorColor}66`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 7, fontWeight: 700, color: actorColor, fontFamily: mono,
                        }}>{isAlice ? "A" : "B"}</div>
                        {/* Step content */}
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 11, color: step.status === "gap" ? C.red : C.textSoft }}>{step.label}</span>
                        </div>
                        {/* Status + ref */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <Badge color={sc} small>{step.status === "done" ? "✓" : "GAP"}</Badge>
                          <span style={{ fontSize: 8, color: C.textFaint, fontFamily: mono }}>{step.ref}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}


/* ═══ BATCHES TAB ═══ */
function BatchesTab() {
  const batches = [
    {
      id: "27a", title: "Eval Status + Invitation Rebuild", date: "Mar 1",
      tasks: [
        { label: "Buyer-side Evaluation Status renders records", status: "done" },
        { label: "InvitationModal full rebuild (detail + type-select)", status: "done" },
      ],
    },
    {
      id: "27b", title: "Orientation Flip + Asset Reg + Directory", date: "Mar 1",
      tasks: [
        { label: "NetGraph orientation flip (explored → reverted)", status: "reverted" },
        { label: "Standalone Asset Registration wired", status: "done" },
        { label: "Asset Directory inline (wrong approach)", status: "replaced" },
      ],
    },
    {
      id: "27b-fix", title: "Revert Flip + Directory Modal", date: "Mar 1",
      tasks: [
        { label: "Full revert of orientation flip", status: "done" },
        { label: "Asset Registration polish (icons, sizing)", status: "done" },
        { label: "Asset Directory converted to modal", status: "done" },
      ],
    },
    {
      id: "27b-fix2", title: "Button Layout + In-Modal Detail", date: "Mar 1",
      tasks: [
        { label: "Asset type buttons reordered + fitted", status: "done" },
        { label: "Asset Directory in-modal detail view", status: "done" },
      ],
    },
    {
      id: "27c", title: "Platform Dataset + Disclosed Fields", date: "Mar 1",
      tasks: [
        { label: "Registration confirmation step", status: "done" },
        { label: "Platform asset dataset (80 per vertical)", status: "done" },
        { label: "Disclosed fields (full/selective/derivative preview)", status: "done" },
        { label: "Health dot tooltips", status: "done" },
      ],
    },
    {
      id: "27d", title: "Polish + Asset Approval State Machine", date: "Mar 1",
      tasks: [
        { label: "Remove duplicate disclosure badge", status: "done" },
        { label: "Chevrons on data field headers", status: "done" },
        { label: "Registration confirmation orange styling", status: "done" },
        { label: "Approval state model (approve/reject)", status: "done" },
        { label: "Confirmation dialogs with notes", status: "done" },
        { label: "NetGraph approval badges (✓/✗)", status: "done" },
        { label: "Approval gating (requires evaluation)", status: "done" },
      ],
    },
    {
      id: "27e", title: "Approve All + Provisional + Evidence Requests", date: "Mar 1",
      tasks: [
        { label: "Approve All button in human review", status: "done" },
        { label: "Provisional node visual treatment (hollow cards)", status: "done" },
        { label: "Evidence request state tracking", status: "done" },
        { label: "Buyer-side evidence request display (PENDING badges)", status: "done" },
        { label: "Supplier-side evidence request display", status: "done" },
      ],
    },
    {
      id: "27e-fix", title: "Container Exclusion + Hollow Card Design", date: "Mar 1",
      tasks: [
        { label: "Container types excluded from provisional", status: "done" },
        { label: "Hollow card design: #0d0f13 bg, dashed grey outlines", status: "done" },
        { label: "Eval result uses post-decision counts", status: "done" },
        { label: "Approval model simplified: no revoke, no reconsider", status: "done" },
        { label: "Legend entry for provisional nodes", status: "done" },
      ],
    },
    {
      id: "27e-fix2", title: "Rejection Removes + Eval Jump + Adaptive Button", date: "Mar 1",
      tasks: [
        { label: "Rejection removes node from tree + closes panel", status: "done" },
        { label: "Eval completion no longer jumps to org node", status: "done" },
        { label: "~97% nodes pre-seeded as approved for demo", status: "done" },
        { label: "Rejection ungated (no eval needed)", status: "done" },
        { label: "Adaptive finalize button (green=pass, grey=evidence, red=fail)", status: "done" },
      ],
    },
    {
      id: "27e-fix3", title: "Button Dominance + Event Cleanup", date: "Mar 1",
      tasks: [
        { label: "Evidence dominates fail in finalize button ordering", status: "done" },
        { label: "Remove network event on rejection", status: "done" },
      ],
    },
    {
      id: "28", title: "Evidence Upload Round-Trip", date: "Mar 1",
      tasks: [
        { label: "Evidence state machine + handlers (App.jsx)", status: "done" },
        { label: "Supplier response form (initially in buyer block — wrong target)", status: "replaced" },
        { label: "Buyer inline review (accept/reject with reasons)", status: "done" },
        { label: "Status badge colors (5 states)", status: "done" },
        { label: "Evidence request count breakdown in header", status: "done" },
      ],
    },
    {
      id: "28-fix", title: "Supplier-Side Block + Credits", date: "Mar 1",
      tasks: [
        { label: "New isSupplierAsset evidence block (was inside !isSupplier)", status: "done" },
        { label: "Supplier response form moved to correct block", status: "done" },
        { label: "Dead isSupplier code removed from buyer block", status: "done" },
        { label: "Both roles start with 2400 credits", status: "done" },
      ],
    },
    {
      id: "29a", title: "Detail Panel Tab Restructure + Polish", date: "Mar 2",
      tasks: [
        { label: "4-tab bar: Overview | Evals | Claims | Timeline (buyer non-org)", status: "done" },
        { label: "2-tab bar: Claims | Timeline (buyer program/system + supplier)", status: "done" },
        { label: "SDA cards + invite + evidence badges → Overview tab", status: "done" },
        { label: "Eval records + Run Evaluation + approval + evidence review → Evals tab", status: "done" },
        { label: "Filter pills + grouped attestations → Claims tab", status: "done" },
        { label: "ClaimTimeline + selected claim card → Timeline tab", status: "done" },
        { label: "Inputs list in buyer Overview tab", status: "done" },
      ],
    },
    {
      id: "30", title: "Activity Log + SDA Revocation", date: "Mar 2",
      tasks: [
        { label: "Activity Log on org nodes (buyer + supplier, role-filtered)", status: "done" },
        { label: "addLogEntry callback in App.jsx (type, role, nodeId, description, details)", status: "done" },
        { label: "Log entries for: eval, approval, rejection, evidence, SDA, invitation", status: "done" },
        { label: "SDA Revocation: confirm dialog + reason textarea on Overview tab", status: "done" },
        { label: "Revoke removes node from tree, creates network event + log entry", status: "done" },
      ],
    },
    {
      id: "30-fix", title: "addLogEntry Hoisting", date: "Mar 2",
      tasks: [
        { label: "Fix addLogEntry used before declaration in App.jsx", status: "done" },
      ],
    },
    {
      id: "30a", title: "Eval Persistence + Rejection Reason", date: "Mar 2",
      tasks: [
        { label: "Eval records persist on node across rerenders", status: "done" },
        { label: "Rejection reason required (disabled button until filled)", status: "done" },
      ],
    },
    {
      id: "30a-fix", title: "Eval Record Invisible Fix", date: "Mar 2",
      tasks: [
        { label: "Stale node reference in handleEvalComplete — re-lookup from customerData", status: "done" },
      ],
    },
    {
      id: "31", title: "Sidebar Filter Reactivity (WorldMap + RiskMatrix)", date: "Mar 2",
      tasks: [
        { label: "attFilterMatch prop passed to WorldMap + RiskMatrix", status: "done" },
        { label: "WorldMap: dimmed markers, filtered country/region/ITAR panels, FILTERED badge", status: "done" },
        { label: "RiskMatrix: dimmed dots, filtered stats (fst) across all 9 panels, FILTERED badge", status: "done" },
      ],
    },
    {
      id: "32", title: "Disclosure Offer + Request Disclosure", date: "Mar 2",
      tasks: [
        { label: "App.jsx: disclosureOffers + disclosureRequests state, handlers, vertical reset", status: "done" },
        { label: "AssetDirectoryModal: 3-state Request Disclosure UI (button → confirm → REQUESTED)", status: "done" },
        { label: "DetailPanel: inline Disclosure Offer creation (type checkboxes, discoverable toggle)", status: "done" },
        { label: "Network events + activity log entries for both actions", status: "done" },
      ],
    },
    {
      id: "33", title: "DetailPanel Decomposition", date: "Mar 2",
      tasks: [
        { label: "detailPanelUtils.jsx: shared constants, helpers, Pill component", status: "done" },
        { label: "OverviewTab.jsx: SDA cards, invite, evidence badges, inputs", status: "done" },
        { label: "EvalsTab.jsx: eval records, approval controls, evidence review", status: "done" },
        { label: "ClaimsTab.jsx: filter pills, grouped attestation list", status: "done" },
        { label: "TimelineTab.jsx: ClaimTimeline + selected claim card", status: "done" },
        { label: "SupplierAssetSection.jsx: supplier SDA, offers, eval history, evidence", status: "done" },
        { label: "OrgNodeContent.jsx: disclosure summary, network summary, activity log", status: "done" },
        { label: "DetailPanel.jsx shell reduced from 1031 → 367 lines (64% reduction)", status: "done" },
      ],
    },
    {
      id: "34", title: "Evidence-Aware Re-Evaluation Loop", date: "Mar 2",
      tasks: [
        { label: "Fix applyEvidenceBoost to match 'accepted' + 'resolved' status", status: "done" },
        { label: "presetChecklistId prop: locked checklist, re-evaluate header, evidence trail", status: "done" },
        { label: "evalModalPresetChecklist state + handleOpenEvalModal 2nd arg in App.jsx", status: "done" },
        { label: "Re-evaluate with Evidence button on latest failed eval per checklist", status: "done" },
        { label: "Combined Accept→Re-Evaluate button (accepts evidence + opens modal)", status: "done" },
        { label: "Cancel button (grey/neutral) replaces Reject for evidence review", status: "done" },
        { label: "Evidence accumulation: previousResponses trail, resolved status (buyer + supplier)", status: "done" },
        { label: "checklistId added to evidence request objects for modal preset", status: "done" },
      ],
    },
    {
      id: "35", title: "Disclosure Request Approval", date: "Mar 2",
      tasks: [
        { label: "handleApproveDisclosureRequest: creates node + SDA, deducts credits", status: "done" },
        { label: "handleDeclineDisclosureRequest: updates status + event + log", status: "done" },
        { label: "SupplierSidebar: DISCLOSURE REQUESTS section with pending count badge", status: "done" },
        { label: "SupplierAssetSection: request cards with approve/decline UI", status: "done" },
        { label: "AssetDirectoryModal: status-aware badges (approved/declined/requested)", status: "done" },
        { label: "Props threaded through DetailPanel to SupplierAssetSection", status: "done" },
      ],
    },
    {
      id: "36", title: "Light Mode + Theme System", date: "Mar 2–3",
      tasks: [
        { label: "CSS custom properties infrastructure (~80+ vars on :root + [data-theme=light])", status: "done" },
        { label: "Warm off-white light palette (backgrounds, borders, text, accents, TT tokens)", status: "done" },
        { label: "Theme state in App.jsx (localStorage persistence, data-theme attribute)", status: "done" },
        { label: "Sun/moon toggle button in Header", status: "done" },
        { label: "Token layer: TT/CS objects + detailPanelUtils → CSS variables", status: "done" },
        { label: "Bulk migration: ~2000+ hardcoded hex → var() across 38+ files", status: "done" },
        { label: "SVG components themed (presentation attributes work with CSS vars)", status: "done" },
        { label: "BootScreen isolated (hardcoded dark, never themed)", status: "done" },
        { label: "Google Fonts loaded (Lora + JetBrains Mono)", status: "done" },
        { label: "Refinement: REVOKED filter button visibility (--accent-red-muted)", status: "done" },
        { label: "Refinement: NEW badge gradient → CSS variable-based", status: "done" },
        { label: "Refinement: Breadcrumb pillbox → var(--bg-overlay)", status: "done" },
        { label: "Refinement: Supplier NetGraph legend → var(--bg-overlay)", status: "done" },
        { label: "Refinement: Systemic color-mix() fix for ${color}XX pattern (17 files)", status: "done" },
      ],
    },
    {
      id: "37", title: "Refinements Polish Pass", date: "Mar 3",
      tasks: [
        { label: "SDA revocation reason → required field (disabled button guard)", status: "done" },
        { label: "Eval modal: checklist name in processing/results headers", status: "done" },
        { label: "Approve/Reject visual separation (danger zone pattern)", status: "done" },
        { label: "Disclosure offer: single radio selection (replaced multi-checkbox)", status: "done" },
        { label: "Disclosure offer: revoke capability with reason + network event", status: "done" },
        { label: "Supplier-side SDA revocation (status change, not tree removal)", status: "done" },
        { label: "Network event type audit: 11 specific types → icon/color/title mappings", status: "done" },
        { label: "Sidebar: APPROVAL STATUS filter (Approved/Provisional/Rejected)", status: "done" },
      ],
    },
    {
      id: "38", title: "Final Feature Batch", date: "Mar 3",
      tasks: [
        { label: "Seed evidence on pre-existing assets (~40% of approved nodes, 1-3 docs)", status: "done" },
        { label: "Disclosure offer field selection for selective/derivative (8 categories, 2 locked)", status: "done" },
        { label: "Eval checklist selector → dropdown (select element + detail panel)", status: "done" },
        { label: "Filter badge node counts on WorldMap + RiskMatrix (N of M)", status: "done" },
        { label: "FILTERED badge on NetGraph (absolute positioned, N of M)", status: "done" },
        { label: "NEW badge logic → localStorage-based (new since last sign-in)", status: "done" },
        { label: "Posted Requirements: supplier-side Browse Requirements button in SupplierSidebar", status: "done" },
        { label: "Manage Attestations: interactive panel (list, add claim, revoke with reason)", status: "done" },
      ],
    },
  ];

  return (
    <>
      {batches.map(b => (
        <div key={b.id} style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "14px 18px", marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Badge color={C.accent}>{b.id}</Badge>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{b.title}</span>
            <span style={{ fontSize: 9, color: C.textFaint, fontFamily: mono }}>{b.date}</span>
          </div>
          {b.tasks.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
              <span style={{
                fontSize: 9, color:
                  t.status === "done" ? C.green :
                  t.status === "in-progress" ? C.amber :
                  t.status === "reverted" ? C.red :
                  t.status === "replaced" ? C.orange : C.textDim,
              }}>
                {t.status === "done" ? "✓" : t.status === "in-progress" ? "◌" : t.status === "reverted" ? "↩" : "→"}
              </span>
              <span style={{ fontSize: 10, color: C.textSoft }}>{t.label}</span>
              {(t.status === "reverted" || t.status === "replaced") && (
                <Badge color={t.status === "reverted" ? C.red : C.orange} small>{t.status.toUpperCase()}</Badge>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}


/* ═══ GAPS TAB ═══ */
function GapsTab() {
  const gaps = [
    // Resolved
    { severity: "resolved", title: "Buyer Eval Status never shows results", batch: "27a" },
    { severity: "resolved", title: "InvitationModal needed rebuild", batch: "27a" },
    { severity: "resolved", title: "AssetRegistrationStandaloneModal orphaned", batch: "27b+27c" },
    { severity: "resolved", title: "Asset Directory placeholder only", batch: "27b→27c" },
    { severity: "resolved", title: "Asset Approval state machine missing", batch: "27d+27e" },
    { severity: "resolved", title: "NetGraph orientation flip", batch: "27b (removed)" },
    { severity: "resolved", title: "Evidence Request flow missing", batch: "27e" },
    { severity: "resolved", title: "Provisional node visual treatment", batch: "27e+fixes" },
    { severity: "resolved", title: "Eval-completion jump to org node", batch: "27e-fix2" },
    { severity: "resolved", title: "Eval result used triage counts not decision counts", batch: "27e-fix2" },
    { severity: "resolved", title: "Supplier-side evidence requests invisible (inside !isSupplier block)", batch: "28-fix" },
    { severity: "resolved", title: "Evidence upload + submit + review + accept/reject round-trip", batch: "28+28-fix" },
    { severity: "resolved", title: "Detail Panel crowding — evals + evidence push claims below fold", batch: "29a" },
    { severity: "resolved", title: "SDA revocation for removing approved nodes", batch: "30" },
    { severity: "resolved", title: "Activity Log (audit trail)", batch: "30" },
    { severity: "resolved", title: "WorldMap + RiskMatrix sidebar filter reactivity", batch: "31" },
    { severity: "resolved", title: "Supplier: Disclosure Offer — no component", batch: "32" },
    { severity: "resolved", title: "Request Disclosure from Asset Directory", batch: "32" },
    { severity: "resolved", title: "DetailPanel monolith (1031 lines, hard to maintain)", batch: "33" },
    { severity: "resolved", title: "Evidence-aware re-evaluation loop (multi-round)", batch: "34" },
    { severity: "resolved", title: "Disclosure request approval flow (supplier side)", batch: "35" },
    { severity: "resolved", title: "Light mode (CSS custom properties + warm off-white palette)", batch: "36" },
    // Open
    { severity: "open", title: "Posted Requirements — no component", detail: "Buyer header button scaffolded but no component behind it." },
    { severity: "open", title: "Supplier: Manage Attestations — no component", detail: "Button disabled in supplier Detail Panel." },
    { severity: "open", title: "NEW badge logic revision", detail: "Should mean 'new since user last signed in,' not 'new to system.'" },
  ];

  const resolved = gaps.filter(g => g.severity === "resolved");
  const open = gaps.filter(g => g.severity === "open");

  return (
    <>
      <SectionCard title={`Resolved (${resolved.length})`} subtitle="Closed in batches 27a–38" accent={C.green}>
        {resolved.map((g, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <span style={{ color: C.green, fontSize: 10 }}>✓</span>
            <span style={{ fontSize: 10, color: C.textDim, textDecoration: "line-through", textDecorationColor: C.textFaint, flex: 1 }}>{g.title}</span>
            <Badge color={C.green} small>{g.batch}</Badge>
          </div>
        ))}
      </SectionCard>

      <SectionCard title={`Open Gaps (${open.length})`} subtitle="Remaining work" accent={C.red}>
        {open.map((g, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: i < open.length - 1 ? `1px solid ${C.border}22` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ color: C.red, fontSize: 10 }}>✗</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{g.title}</span>
            </div>
            {g.detail && <div style={{ fontSize: 10, color: C.textDim, marginLeft: 18, lineHeight: 1.5 }}>{g.detail}</div>}
          </div>
        ))}
      </SectionCard>
    </>
  );
}


/* ═══ APPROVAL MODEL TAB ═══ */
function ApprovalModelTab() {
  return (
    <>
      <SectionCard title="Asset Approval State Machine" subtitle="Finalized in 27e-fix2 · Binary gate model" accent={C.green}>
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "stretch" }}>
          {[
            { state: "PROVISIONAL", color: C.textDim, bg: "#0d0f13", border: "dashed", desc: "Node exists but not 'in' network yet", visual: "Hollow card, dashed grey outlines, dimmer text", trigger: "Created by: invitation acceptance, asset registration, SDA creation" },
            { state: "APPROVED", color: C.green, bg: C.greenDim, border: "solid", desc: "Permanent network member. Card fills with tier color.", visual: "Full color card, solid outlines, normal text", trigger: "Requires: at least one evaluation → Approve button" },
            { state: "REJECTED", color: C.red, bg: C.redDim, border: "none", desc: "Node removed from tree entirely. No undo.", visual: "Node disappears. Detail Panel closes.", trigger: "Available: anytime for provisional nodes (no eval needed)" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, background: C.card, borderRadius: 8, padding: "16px", border: `1px ${s.border === "dashed" ? "dashed" : "solid"} ${s.color}44` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: s.bg, border: `1.5px ${s.border === "dashed" ? "dashed" : "solid"} ${s.color}` }} />
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: mono, color: s.color }}>{s.state}</span>
              </div>
              <div style={{ fontSize: 10, color: C.text, marginBottom: 8, lineHeight: 1.5 }}>{s.desc}</div>
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4 }}><span style={{ color: C.textFaint, fontFamily: mono }}>VISUAL:</span> {s.visual}</div>
              <div style={{ fontSize: 9, color: C.textDim }}><span style={{ color: C.textFaint, fontFamily: mono }}>TRIGGER:</span> {s.trigger}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 10 }}>Transitions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { from: "Provisional", to: "Approved", color: C.green, condition: "After evaluation + Approve button + confirmation", note: "ONE-TIME gate. Multiple evaluations can follow." },
            { from: "Provisional", to: "Rejected (removed)", color: C.red, condition: "Reject button (always available) + reason + confirmation", note: "Binary. Node deleted. No undo." },
            { from: "Approved", to: "Removed", color: C.amber, condition: "Revoke the node's SDA → confirm + reason", note: "Built in batch 30." },
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <Badge color={C.textDim} small>{t.from}</Badge>
              <span style={{ color: t.color, fontSize: 14 }}>→</span>
              <Badge color={t.color} small>{t.to}</Badge>
              <div style={{ flex: 1, marginLeft: 4 }}>
                <div style={{ fontSize: 10, color: C.textSoft }}>{t.condition}</div>
                <div style={{ fontSize: 9, color: C.textFaint }}>{t.note}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Finalize Button Behavior" subtitle="Adaptive button in EvaluationModal footer" accent={C.accent}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { decisions: "All confirm / override-pass", button: "Finalize & Issue Credential →", color: C.green, bg: "#052e16" },
            { decisions: "Any evidence requested (dominates)", button: "Request Evidence (N) & Finalize →", color: "#d1d5db", bg: "#1f2937" },
            { decisions: "Failures only, no evidence", button: "Fail & Issue Credential →", color: C.red, bg: "#450a0a" },
          ].map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, fontSize: 10, color: C.textSoft }}>{b.decisions}</div>
              <div style={{ padding: "6px 14px", borderRadius: 5, fontSize: 10, fontFamily: mono, fontWeight: 700, background: b.bg, color: b.color, border: `1px solid ${b.color}44` }}>{b.button}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}


/* ═══ WHAT'S NEXT TAB ═══ */
function NextTab() {
  return (
    <>
      <SectionCard title="Completed Batches (29a–37)" subtitle="Since last IA map update" accent={C.green}>
        {[
          { batch: "29a", title: "Detail Panel Tab Restructure", scope: "Overview|Evals|Claims|Timeline tabs. Claims filters. Eval/approval/evidence in Evals tab.", color: C.green },
          { batch: "30", title: "Activity Log + SDA Revocation", scope: "Persistent audit trail on org nodes. Revoke disclosure → remove approved node.", color: C.green },
          { batch: "31", title: "Sidebar Filter Reactivity", scope: "WorldMap + RiskMatrix respond to attFilterMatch. Dimmed markers, filtered stats.", color: C.green },
          { batch: "32", title: "Disclosure Offer + Request Disclosure", scope: "Supplier creates standing offers. Buyer requests disclosure from Asset Directory.", color: C.green },
          { batch: "33", title: "DetailPanel Decomposition", scope: "7 sub-components + utils. Shell reduced 64%. Pure structural refactor.", color: C.green },
          { batch: "34", title: "Evidence-Aware Re-Evaluation Loop", scope: "Re-evaluate button, locked modal, evidence trail, multi-round accumulation. Completes B2 + S5.", color: C.green },
          { batch: "35", title: "Disclosure Request Approval", scope: "Supplier reviews disclosure requests. Approve → SDA + node created. Decline with reason. Completes S6 + BA4.", color: C.green },
          { batch: "36", title: "Light Mode + Theme System", scope: "CSS custom properties, warm off-white palette, Header toggle, bulk migration of 2000+ hex colors, refinements. Completes P3.", color: C.green },
          { batch: "37", title: "Refinements Polish Pass", scope: "8 backlog items: SDA revocation guard, eval headers, approve/reject separation, offer radio+revoke, supplier SDA revocation, event audit, approval status filter.", color: C.green },
        ].map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < 8 ? `1px solid ${C.border}22` : "none" }}>
            <Badge color={b.color}>{b.batch}</Badge>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{b.title}</span>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 1 }}>{b.scope}</div>
            </div>
            <span style={{ fontSize: 10, color: C.green }}>✓</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Remaining Work" subtitle="Updated after batch 38" accent={C.green}>
        {[
          {
            batch: "38", title: "Posted Requirements + Manage Attestations",
            scope: "Supplier Browse Requirements + interactive attestation management (add/revoke).",
            status: "done",
            color: C.green,
          },
        ].map((b, i) => (
          <div key={i} style={{ padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Badge color={b.color}>{b.batch}</Badge>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{b.title}</span>
              <span style={{ fontSize: 10, color: C.green }}>✓</span>
            </div>
            <div style={{ fontSize: 10, color: C.textSoft, marginLeft: 4, marginBottom: 2 }}>{b.scope}</div>
          </div>
        ))}

        <div style={{ marginTop: 16, padding: "12px 16px", background: C.card, border: `1px solid ${C.borderHi}`, borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.green, marginBottom: 4 }}>
            Feature complete — all IA Map items resolved
          </div>
          <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.5 }}>
            All planned features implemented across 12 batches (27a–38). Major structural, flow, theme,
            refinements, and remaining feature work all done. Ready for architectural reassessment.
          </div>
        </div>
      </SectionCard>

      <SectionCard title="User Story Loop Status" subtitle="End-to-end workflows" accent={C.green}>
        {[
          { loop: "Navigate → Inspect → Filter", status: "complete" },
          { loop: "Evaluate → Review → Approve/Reject", status: "complete" },
          { loop: "Invite → Register → Disclose → SDA", status: "complete" },
          { loop: "Browse Directory → Preview Fields", status: "complete" },
          { loop: "Programs & Systems → Tree Creation", status: "complete" },
          { loop: "Evidence Request → Submit → Accept/Reject → Resubmit", status: "complete" },
          { loop: "Revoke SDA → Remove Approved Node", status: "complete", note: "Batch 30. Confirm + reason → node removed." },
          { loop: "Activity Log (audit trail)", status: "complete", note: "Batch 30. Both roles, role-filtered on org nodes." },
          { loop: "WorldMap + RiskMatrix Filter Reactivity", status: "complete", note: "Batch 31. Dimmed markers/dots, filtered panels." },
          { loop: "Create Disclosure Offer → Buyer Discovers → Requests → Approved", status: "complete", note: "Batches 32 + 35. Full offer → request → approve/decline loop." },
          { loop: "Evidence → Re-Evaluate → PASS", status: "complete", note: "Batch 34. Multi-round evidence loop with accumulation." },
          { loop: "Light Mode (CSS custom properties + toggle)", status: "complete", note: "Batch 36. ~2000+ colors migrated, warm off-white palette." },
          { loop: "Refinements Polish (8 backlog items)", status: "complete", note: "Batch 37. SDA guards, offer revoke, event audit, approval filter." },
          { loop: "Browse Requirements (Supplier)", status: "complete", note: "Batch 38. SupplierSidebar Browse Requirements button → RequirementsLibraryModal." },
          { loop: "Manage Attestations → Add/Revoke", status: "complete", note: "Batch 38. Interactive panel: list, add claim by predicate, revoke with reason." },
        ].map((l, i) => {
          const color = l.status === "complete" ? C.green : l.status === "partial" ? C.amber : l.status === "scaffolded" ? C.accent : C.red;
          const icon = l.status === "complete" ? "✓" : l.status === "partial" ? "◐" : l.status === "scaffolded" ? "◇" : "✗";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < 13 ? `1px solid ${C.border}22` : "none" }}>
              <span style={{ fontSize: 12, color, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.text, flex: 1 }}>{l.loop}</span>
              <Badge color={color} small>{l.status.toUpperCase().replace("-", " ")}</Badge>
              {l.note && <span style={{ fontSize: 9, color: C.textFaint, maxWidth: 240, textAlign: "right" }}>{l.note}</span>}
            </div>
          );
        })}
      </SectionCard>
    </>
  );
}


/* ═══ REFINEMENTS TAB ═══ */
function RefinementsTab() {
  const refinements = [
    // ── Batch 34 refinements ──
    {
      area: "Evidence",
      title: "Seed evidence on pre-existing assets",
      detail: "Pre-existing assets (e.g., MOSFET Module) don't have seed evidence from initial registration, so the first evaluation runs against no evidence. First evidence only appears after a supplier responds to a request. Consider seeding registration-time evidence so the first eval has something to work with.",
      severity: "low",
      discovered: "34",
      status: "done", batch: "38",
    },
    // ── User refinements backlog (done in Batch 37) ──
    {
      area: "Disclosure",
      title: "Disclosure offer: single type radio selection",
      detail: "Converted from Set-based multi-checkbox to single radio selection. Removed discoverable toggle. File: SupplierAssetSection.jsx.",
      severity: "medium",
      discovered: "34",
      status: "done", batch: "37",
    },
    {
      area: "Disclosure",
      title: "Disclosure offer: revoke capability",
      detail: "Revoke button on active offers with reason + confirmation. Network event + activity log. File: SupplierAssetSection.jsx + App.jsx.",
      severity: "medium",
      discovered: "34",
      status: "done", batch: "37",
    },
    {
      area: "Disclosure",
      title: "Disclosure offer: field selection modal for selective/derivative",
      detail: "When creating a selective or derivative disclosure offer, there's no UI to choose which fields to disclose vs redact. Currently the offer just records the type. Need a modal or inline picker showing the 8 SDA field categories (shipment_details, part_identification, material_specs, processing_specs, test_results, certifications, pricing, supplier_identity) with checkboxes. part_identification and certifications are always-disclosed per the SDA model.",
      severity: "low",
      discovered: "34",
      status: "done", batch: "38",
    },
    {
      area: "SDA",
      title: "Supplier-side SDA revocation (status change, not tree removal)",
      detail: "Revoke button on active SDAs in SupplierAssetSection. Changes status to 'revoked', SDA remains visible with badge. Network event + activity log. File: SupplierAssetSection.jsx + App.jsx.",
      severity: "medium",
      discovered: "34",
      status: "done", batch: "37",
    },
    {
      area: "Evals",
      title: "Approve/Reject button visual isolation",
      detail: "Approve in primary action area, Reject moved to DANGER ZONE section with divider + warning text. File: EvalsTab.jsx.",
      severity: "medium",
      discovered: "34",
      status: "done", batch: "37",
    },
    {
      area: "Evals",
      title: "Eval modal: show checklist name in processing/results headers",
      detail: "Header shows 'Evaluating CMMC Level 2…' and 'CMMC Level 2 — Results'. File: EvaluationModal.jsx.",
      severity: "low",
      discovered: "34",
      status: "done", batch: "37",
    },
    {
      area: "Evals",
      title: "Run Evaluation: checklist selector → dropdown",
      detail: "EvaluationModal setup phase uses radio-card style list for checklist selection (one card per checklist with name, description, requirement count, credit cost). Works but takes vertical space. Consider converting to a dropdown/select to save space, especially if more checklists are added. Current implementation: checklists.map() renders cards with onClick → setSelectedChecklist. File: EvaluationModal.jsx setup phase.",
      severity: "low",
      discovered: "34",
      status: "done", batch: "38",
    },
    {
      area: "SDA",
      title: "Buyer SDA revocation reason → required field",
      detail: "Disabled revoke button until reason.length > 0. Conditional styling (opacity, cursor). File: OverviewTab.jsx.",
      severity: "high",
      discovered: "34",
      status: "done", batch: "37",
    },
    {
      area: "Sidebar",
      title: "Sidebar filter panel reassessment + provisional status filter",
      detail: "APPROVAL STATUS filter section added: Approved/Provisional/Rejected toggle buttons. attFilter extended with approvalStatuses Set. Filter logic in App.jsx attFilterMatch. Files: Sidebar.jsx + App.jsx.",
      severity: "medium",
      discovered: "34",
      status: "done", batch: "37",
    },
    {
      area: "Events",
      title: "Network event rendering for evaluation/evidence types",
      detail: "All 11 event types mapped: evaluation_complete, evidence_submitted/accepted/rejected, sda_published/revoked, disclosure_offer_created/revoked, disclosure_requested/approved/declined. File: NetworkEventsNotification.jsx.",
      severity: "medium",
      discovered: "34",
      status: "done", batch: "37",
    },
    {
      area: "Evidence",
      title: "Supplier evidence submission without buyer invitation",
      detail: "Currently suppliers can only submit evidence in response to buyer-created evidence requests (the request→respond pattern). Consider allowing suppliers to proactively submit evidence on their own assets without waiting for a buyer evaluation + evidence request. This would require a new 'Submit Evidence' button in SupplierAssetSection that creates an evidence record without a parent request, plus buyer-side UI to discover and review unsolicited evidence.",
      severity: "low",
      discovered: "34",
    },
    {
      area: "Filters",
      title: "Filter badge: show node count on WorldMap + RiskMatrix",
      detail: "WorldMap and RiskMatrix both show a 'FILTERED' badge when sidebar filters are active, but display generic '(filtered)' text rather than showing how many nodes match. Should show e.g. 'FILTERED · 42 nodes' or '42 of 128 nodes'. Both components receive filtered data — need to pass total count for comparison. Files: WorldMap.jsx, RiskMatrix.jsx — look for FILTERED badge rendering.",
      severity: "low",
      discovered: "34",
      status: "done", batch: "38",
    },
    {
      area: "Filters",
      title: "Data panel filter indicator: FILTERED badge top-right corner",
      detail: "When sidebar filters are active, the main data panels (NetGraph, WorldMap, RiskMatrix) should show a persistent 'FILTERED' badge in the top-right corner so users always know their view is filtered. WorldMap and RiskMatrix already have some version of this. Verify NetGraph has it too, and ensure consistent badge placement/styling across all three views.",
      severity: "low",
      discovered: "34",
      status: "done", batch: "38",
    },
    {
      area: "Evidence",
      title: "Pre-existing assets lack original evidence attachments",
      detail: "Same as seed evidence item above but from user perspective: when evaluating a pre-existing asset like MOSFET Module, the first evaluation has zero evidence to work with. The registration-time data (supplier claims, certifications, material specs) should be represented as evidence attachments so the first eval can reference them. This is the user-facing symptom of the seed evidence gap.",
      severity: "low",
      discovered: "34",
      status: "done", batch: "38",
    },
  ];

  const done = refinements.filter(r => r.status === "done");
  const open = refinements.filter(r => r.status !== "done");
  const bySeverity = { high: [], medium: [], low: [] };
  open.forEach(r => (bySeverity[r.severity] || bySeverity.low).push(r));

  const severityConfig = {
    high: { color: C.red, label: "HIGH", icon: "!" },
    medium: { color: C.amber, label: "MEDIUM", icon: "~" },
    low: { color: C.accent, label: "LOW", icon: "·" },
  };

  return (
    <>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "14px 18px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Refinements Backlog
        </div>
        <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.6 }}>
          Polish, UX improvements, and minor fixes discovered during QA. Not blocking feature completeness. Tracked here instead of Claude Chat.
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 10 }}>
          <span style={{ color: C.green, fontFamily: mono, fontWeight: 600 }}>{done.length} done</span>
          <span style={{ color: C.red, fontFamily: mono, fontWeight: 600 }}>{bySeverity.high.length} high</span>
          <span style={{ color: C.amber, fontFamily: mono, fontWeight: 600 }}>{bySeverity.medium.length} medium</span>
          <span style={{ color: C.accent, fontFamily: mono, fontWeight: 600 }}>{bySeverity.low.length} low</span>
          <span style={{ color: C.textDim, fontFamily: mono }}>{refinements.length} total</span>
        </div>
      </div>

      {done.length > 0 && (
        <SectionCard title={`DONE (${done.length})`} subtitle="Completed in Batches 37–38" accent={C.green}>
          {done.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < done.length - 1 ? `1px solid ${C.border}22` : "none" }}>
              <span style={{ color: C.green, fontSize: 10 }}>✓</span>
              <span style={{ fontSize: 10, color: C.textDim, flex: 1 }}>{r.title}</span>
              <Badge color={C.textDim} small>{r.area}</Badge>
              <Badge color={C.green} small>B{r.batch}</Badge>
            </div>
          ))}
        </SectionCard>
      )}

      {["high", "medium", "low"].map(sev => {
        const items = bySeverity[sev];
        if (!items.length) return null;
        const cfg = severityConfig[sev];
        return (
          <SectionCard key={sev} title={`${cfg.label} (${items.length})`} subtitle={`${sev} priority refinements`} accent={cfg.color}>
            {items.map((r, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${C.border}22` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: cfg.color, fontWeight: 700 }}>{cfg.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.text, flex: 1 }}>{r.title}</span>
                  <Badge color={C.textDim} small>{r.area}</Badge>
                  {r.discovered && <span style={{ fontSize: 8, color: C.textFaint, fontFamily: mono }}>B{r.discovered}</span>}
                </div>
                <div style={{ fontSize: 10, color: C.textDim, marginLeft: 18, lineHeight: 1.5 }}>{r.detail}</div>
              </div>
            ))}
          </SectionCard>
        );
      })}
    </>
  );
}
