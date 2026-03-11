# Batch 5 — Cascade Disclosures

Adds cascading disclosure support: the ability for an intermediary to forward upstream assets to a downstream party. Two entry points sharing a common upstream asset picker. Reference file: `/references/cascade-disclosure-reference.html`.

**Read the reference file before starting.** It contains working implementations of both entry points with exact layout, step logic, card structure, and tooltip content.

---

## Overview

| Feature | Location | Purpose |
|---------|----------|---------|
| Cascade policy toggle | Flow A + Flow B response Set Terms step | Upstream owner sets open/closed |
| Entry A — At disclosure time | DisclosureResponseModal, new optional step | Include cascading assets when accepting a request |
| Entry B — Manage existing | DisclosuresTab SDA card body | Add/review cascading assets on an active SDA |
| Upstream asset picker | Shared component used by both entries | Select which children to cascade |

---

## 1. Add cascade policy toggle to existing disclosure modals

### Flow A — PublishModal.jsx

In the **Set Expiration / Review** step (the final step before publish), add a toggle before the expiration picker:

```jsx
<FieldLabel label="Allow cascading?" />
<div style={{ /* info text */ }}>
  If enabled, the receiving party can include this asset in their own cascading disclosures to downstream parties.
</div>
<div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
  <ToggleCard
    selected={cascadePolicy === 'open'}
    onClick={() => setCascadePolicy('open')}
    label="Open"
    desc="Receiving parties can cascade this asset to their downstream network."
  />
  <ToggleCard
    selected={cascadePolicy === 'closed'}
    onClick={() => setCascadePolicy('closed')}
    label="Closed"
    desc="This asset cannot be cascaded. Only the direct recipient has access."
  />
</div>
```

Default: `closed`. Add `const [cascadePolicy, setCascadePolicy] = useState('closed')` to PublishModal state. Include the policy in the review summary.

`ToggleCard` is a simple two-option selector (not a full SDATypeCard — just a small card with a radio-style dot, label, and description). Add it to `ModalShared.jsx`:

```jsx
function ToggleCard({ selected, onClick, label, desc }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
        border: `1.5px solid ${selected ? 'var(--accent-indigo)' : hov ? 'var(--border-hover)' : 'var(--border)'}`,
        background: selected ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : hov ? 'var(--bg-raised)' : 'var(--bg-surface)',
        transition: 'all 150ms',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: selected ? 'var(--accent-indigo)' : 'var(--text-dim)',
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: selected ? 'var(--accent-indigo)' : 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>{desc}</div>
    </div>
  )
}
```

### Flow B Response — DisclosureResponseModal.jsx

In the **Set Terms** step (both Accept and Counter paths), add the same cascade policy toggle after the expiration picker, before the summary box. Same component, same default (`closed`), same state.

---

## 2. Create shared UpstreamAssetPicker

**Create `src/components/modals/UpstreamPicker.jsx`**

Port directly from the reference file's `UpstreamPicker` component. It accepts:

```jsx
{ assets, selected, setSelected, downstreamLevel, alreadyIds }
```

Each card row layout (top to bottom):
1. **[Checkbox] [Chain icon] "Disclose this asset"** — the action label, right next to checkbox. Green "Cascading to [party]" if already done. Grey "Cannot disclose this asset" if closed.
2. **Category** — icon + label in category color (e.g. blue "■ PRODUCT")
3. **Asset name + PIN badge**
4. **Owner name + DOT badge**

Top-right corner: **OPEN** or **CLOSED** policy badge with tooltip. Tooltip text is owner-specific:
- OPEN: "[Owner] has permitted [level] disclosure of this asset to all parties connected to your asset. [Owner] may revoke their disclosure at any time."
- CLOSED: "[Owner] has not permitted disclosure of their asset to other parties. To enable disclosure of this asset, contact [Owner] to request a policy change."

Card states:
- **Selectable** (open, not already cascaded) — clickable, purple border when selected, checkbox
- **Already cascaded** (green) — green border, green check, "Cascading to [party]", non-clickable
- **Closed** (disabled) — 45% opacity, X in checkbox, "Cannot disclose this asset"

Gap between cards: 14px. Card padding: 18px 20px. Border radius: 10px.

Use CSS variables for all colors. Import `CopyBadge` from `ModalShared.jsx`. The chain icon SVG and category config can be defined locally or imported from DetailPanel's constants.

**Tooltip for disclosure type badges:** Every `SDABadge` and `LevelInline` instance inside the picker's cards should have tooltips explaining the disclosure type. Use the same SDA_TIPS lookup from the reference.

---

## 3. Add cascade data to v2Data.js

Each node that has children needs upstream SDA metadata on those children so the picker knows what's available. Add a `cascadePolicy` field to relevant child nodes:

```javascript
// On child nodes that have an upstream SDA from an external supplier:
{
  // ...existing fields...
  upstreamSda: {
    type: 'selective',        // the SDA type from the upstream owner to this intermediary
    policy: 'open',           // 'open' | 'closed'
    owner: 'Murata Manufacturing',
    ownerDot: 'DOT-0x9f1b...c2e8',
  },
}
```

Add `upstreamSda` to 2-3 child nodes in Alice's MicroCo dataset (she's the seller/intermediary). At least one should have `policy: 'closed'` to demonstrate the disabled state. The Power Regulation Module's children are the natural candidates.

Also add an `existingCascades` array to the data return for tracking which assets are already cascaded to which parties:
```javascript
existingCascades: [
  { assetId: 'cap-array', toParty: 'GovCo' },
]
```

---

## 4. Entry A — Add cascade step to DisclosureResponseModal

**In `src/components/modals/DisclosureResponseModal.jsx`:**

After the Set Terms step (accept/counter) and before confirmation, add an optional cascade step. This step only appears if the disclosed node has children with `upstreamSda.policy === 'open'`.

**Step flow becomes:**
1. Review request + decide (accept/counter/decline) — unchanged
2. Set terms (expiration + cascade policy toggle) — modified, adds toggle
3. **NEW: Cascade step** — "Disclose connected assets?" title, UpstreamPicker, skip/review button
4. Confirmation summary — modified, includes cascaded assets if any

If no children have open upstream SDAs, skip step 3 entirely (same pattern as proof-only eval selection skipping in PublishModal).

The cascade step UI matches the reference's `EntryA` exactly:
- Amber/yellow info banner: "You are creating a SELECTIVE disclosure with GovCo for Power Regulation Module."
- Title: "Disclose connected assets?" at 20px bold with chain icon
- Body text: "Cascading disclosures enable you to disclose your connected assets to other parties. Permissions are capped at the lesser of your disclosure agreements. [Asset] is connected to [N] other assets that you can choose to include..." (dynamic values in white)
- UpstreamPicker below
- Footer: "Review (N cascading)" or "Skip — No Cascading Assets"

**The node prop must be threaded to this modal.** Currently the modal only receives `request` (which has `asset.name` and `asset.pin`). The modal also needs the full node object to access its children's `upstreamSda` data. Update the prop to include the node:

In `V2App.jsx`, when opening the response modal from the notification inbox, look up the node from nodeMap:
```jsx
onClick={() => {
  const node = Object.values(nodeMap).find(n => n.pin === req.asset.pin)
  setResponseRequest({ ...req, node })
  setShowInbox(false)
}}
```

---

## 5. Entry B — Add "Manage Cascading Disclosures" to DisclosuresTab

**Create `src/components/modals/CascadeModal.jsx`**

This is the standalone modal for managing cascades on an existing SDA. Port from the reference's `EntryB`. Props:

```jsx
{ node, sda, existingCascades, onClose }
```

- `node` — the parent asset node (to access children)
- `sda` — the specific SDA being managed (to get the downstream party and level)
- `existingCascades` — array of `{ assetId, toParty }` for this SDA

Two steps:
1. UpstreamPicker showing existing (green) and available assets
2. Review changes — "EXISTING" section (dimmed) + "ADDING" section (purple NEW badges)

Confirmation screen lists newly cascaded assets by name with SDA badges, plus: "You can manage cascading disclosures at any time from the Disclosures tab on [asset]'s Detail Panel."

**In `DisclosuresTab.jsx`**, add a "Manage Cascading Disclosures" button inside each SDA card's expanded body, below the existing "Revoke SDA" button. Only show it when the parent node has children with `upstreamSda` data:

```jsx
{node.children?.some(c => c.upstreamSda) && (
  <Btn
    label="Manage Cascading Disclosures"
    onClick={() => onManageCascade(sda)}
    style={{ marginTop: 8 }}
  />
)}
```

Thread the `onManageCascade` callback from DisclosuresTab → DetailPanel index → V2App, where it opens CascadeModal with the relevant SDA.

**In `V2App.jsx`**, add state and rendering:
```jsx
const [cascadeContext, setCascadeContext] = useState(null) // { node, sda }

// Render:
{cascadeContext && (
  <CascadeModal
    node={cascadeContext.node}
    sda={cascadeContext.sda}
    existingCascades={existingCascades}
    onClose={() => setCascadeContext(null)}
  />
)}
```

Pass the `node` object alongside the SDA when opening the modal. The node is already available in the DetailPanel's props.

---

## 6. Tooltip system for disclosure types

Ensure all `SDABadge` and `LevelInline` instances inside the cascade modals have descriptive tooltips. The tooltip text per type:

- **FULL:** "Full Disclosure: evaluators can extract data fields and run inference requirements against the evidence."
- **SELECTIVE:** "Selective Disclosure: evaluators can run inference requirements but cannot extract raw data from the evidence."
- **PROOF-ONLY:** "Proof-only Disclosure: shares only the pass/fail result of a completed evaluation. No access to evidence is granted."
- **CASCADE:** "Cascade Disclosure: access through an intermediary. Permission is capped at the lower of the upstream and downstream agreements."

Add a `tip` boolean prop to `SDABadge` and `LevelInline` in `ModalShared.jsx`. When `tip` is true, wrap in a tooltip. `LevelInline` with `tip` also gets a dashed underline as a hover affordance.

---

## Verification Checklist

**Cascade policy toggle:**
- [ ] PublishModal final step shows Open/Closed toggle, default Closed
- [ ] DisclosureResponseModal Set Terms step shows Open/Closed toggle
- [ ] Policy selection appears in review summary

**Entry A — At disclosure time:**
- [ ] Responding to a disclosure request for a node with cascadable children shows the cascade step
- [ ] Step shows "Disclose connected assets?" title at 20px bold
- [ ] UpstreamPicker shows correct assets with OPEN/CLOSED badges
- [ ] OPEN badge tooltip shows owner-specific text with SDA type
- [ ] CLOSED badge tooltip shows owner-specific text
- [ ] Closed-policy assets are greyed out and non-clickable
- [ ] Selecting assets updates footer button label with count
- [ ] "Skip — No Cascading Assets" proceeds without cascades
- [ ] Review step shows cascaded assets with SDA badges
- [ ] Confirmation includes cascade count
- [ ] If no children have open policies, cascade step is skipped entirely

**Entry B — Manage existing:**
- [ ] "Manage Cascading Disclosures" button appears in SDA card body
- [ ] Button only appears when node has children with upstreamSda data
- [ ] Modal shows already-cascaded assets in green (non-clickable)
- [ ] Modal shows available assets as selectable
- [ ] Review step shows EXISTING vs ADDING sections
- [ ] Confirmation lists new assets and tells user where to manage later

**Tooltips:**
- [ ] Every SELECTIVE/FULL badge in cascade modals has a hover tooltip
- [ ] Every inline level mention has a hover tooltip with dashed underline
- [ ] Policy badges have owner-specific tooltips

**General:**
- [ ] All modals respect light/dark theme
- [ ] Escape closes cascade modals
- [ ] Backdrop click closes cascade modals
- [ ] text-wrap: pretty applied

---

## Files Touched

| File | Action |
|------|--------|
| `src/components/modals/UpstreamPicker.jsx` | **CREATE** — shared asset picker |
| `src/components/modals/CascadeModal.jsx` | **CREATE** — Entry B standalone modal |
| `src/components/modals/ModalShared.jsx` | **MODIFY** — add ToggleCard, tip prop on SDABadge/LevelInline, SDA_TIPS |
| `src/components/modals/PublishModal.jsx` | **MODIFY** — add cascade policy toggle |
| `src/components/modals/DisclosureResponseModal.jsx` | **MODIFY** — add cascade policy toggle + cascade step |
| `src/v2/v2Data.js` | **MODIFY** — add upstreamSda to child nodes, existingCascades |
| `src/components/DetailPanel/DisclosuresTab.jsx` | **MODIFY** — add Manage Cascading Disclosures button |
| `src/components/DetailPanel/index.jsx` | **MODIFY** — thread onManageCascade prop |
| `src/v2/V2App.jsx` | **MODIFY** — cascade modal state, thread node to response modal |

**Do NOT modify:** `V2Canvas.jsx`, `AssetNode.jsx`, `PanelShell.jsx`, `LayerBorder.jsx`
