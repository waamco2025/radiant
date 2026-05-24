// V22NodeDetailPanel — central Detail Panel router for V2.2 parent-layer nodes.
// Routes by `node.v22Type` into per-kind sub-panels. Each sub-panel mirrors the
// V2.1 PanelShell layout (header / body / footer) without taking on V2.1's
// merge-pipeline assumptions.
//
// Special states for Claim panels:
//   • Awaiting Response (spec Phase 5 add #3) — when node.isProvisional, show
//     request metadata + "Respond to Request" (grantor) or "Cancel Request"
//     (grantee) CTA.
//   • Disclosure Declined (spec §11.4 + Phase 5 add #5) — when node.isDeclined,
//     show owner's decline reason + "Dismiss" CTA.

import { useEffect, useRef, useState } from 'react'
import CopyBadge from './shared/CopyBadge'
import ExpandButton from './shared/ExpandButton'
import Tooltip from '../Tooltip'
import { HealthBar } from '../../v2/AssetNode'
// Phase 14.1 (#169 part 2): shared shield icon used by all Badge surfaces.
import BadgeShieldIcon from '../../v2/BadgeShieldIcon'

const TYPE_BADGE_BG = 'var(--bg-raised)'

// Phase 9A item 10: pencil icon rendered when a Parse Result field's or an
// Eval Result row's current value differs from the AI's original extraction.
// Kept identical to the icon inside the Parse / Eval modals.
function HumanEditedIcon() {
  return (
    <Tooltip content="Human-edited from AI's original extraction.">
      <span
        aria-label="Human-edited"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 12, height: 12, color: 'var(--accent-amber)', marginLeft: 4,
        }}
      >
        <svg width={10} height={10} viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M12.146 1.854a1.5 1.5 0 0 1 2.121 2.121L5.5 12.743 2 13l.257-3.5L10.146 1.854a1.5 1.5 0 0 1 2 0Z"
                stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
        </svg>
      </span>
    </Tooltip>
  )
}

function isHumanEdited(item) {
  // Item's `_aiOriginalValue` is set when the artifact was created via our
  // Parse / Eval modal. Seeded artifacts don't carry it, so the pencil only
  // appears for user-created rows that were subsequently edited.
  return item && item._aiOriginalValue != null && item.value !== item._aiOriginalValue
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
    const da = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return `${y}-${mo}-${da} · ${h}:${mi} UTC`
  } catch {
    return iso
  }
}

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function Section({ title, children, action }) {
  // Phase 11B.1: optional `action` slot rendered on the right side of the
  // section title row. Used by V22AssetPanel's File section to surface an
  // Expand button next to the FILE label without adding a new dedicated row.
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          letterSpacing: '0.12em', color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
        }}>{title}</div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', gap: 12 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{
        fontSize: 11,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        color: 'var(--text-primary)',
        textAlign: 'right',
        wordBreak: mono ? 'break-all' : 'normal',
        flex: 1,
      }}>{value}</span>
    </div>
  )
}

// Phase 11C.3 W4: ExpandButton extracted to shared/ExpandButton.jsx so the
// EA Detail Panel can use the same icon + styling without duplicating the
// component. The local helper used to inline the SVG body — now imported.

// Phase 10.2: small clickable row for Parent / Children sections in the Asset
// Detail Panel. Renders as `[ASSET]  {name}` — clicking pans/zooms and opens
// the target Asset's panel via `onSelectAsset(id)`.
function AssetHierarchyRow({ asset, onSelect }) {
  const handleClick = () => {
    if (onSelect && asset?.id) onSelect(asset.id)
  }
  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', marginTop: 6,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => {
        if (!onSelect) return
        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, var(--bg-raised))'
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 35%, var(--border))'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-raised)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
        color: 'var(--text-tertiary)', padding: '2px 6px',
        borderRadius: 4, background: 'var(--bg-deep)',
      }}>ASSET</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{asset?.name || '—'}</span>
    </div>
  )
}

function FooterButton({ icon, label, onClick, accent, danger, amber, disabled, title }) {
  const [hovered, setHovered] = useState(false)
  const bg = disabled
    ? 'var(--bg-raised)'
    : amber
      ? 'var(--accent-amber)'
      : danger
        ? 'var(--accent-red)'
        : accent
          ? 'var(--accent-indigo)'
          : 'transparent'
  const color = disabled ? 'var(--text-dim)' : (accent || danger || amber ? 'var(--bg-deep)' : 'var(--text-primary)')
  // Phase 9A.2: tooltips are instant-on-hover via the Tooltip primitive.
  // Only render one when `title` is explicitly passed — plain label buttons
  // don't need a tooltip repeating their own label.

  // Phase 17.5: icon-with-hover-expand mode. When `icon` is provided the
  // button collapses to an icon-only square and animates its width on hover
  // to reveal the label inline (the explanatory Tooltip from `title` still
  // pops on hover too — label = verb, tooltip = explanation). When `icon` is
  // omitted, the legacy label-only button (flex: 1, always-visible label)
  // renders unchanged — this preserves every other FooterButton call site
  // (Claim / Eval Result / dismiss / etc.) that doesn't pass an icon.
  if (icon != null) {
    // Phase 17.5.0.1: neutral-default styling polish. For the neutral state
    // (no accent/danger/amber/disabled) the border picks up a 40% indigo
    // blend (matching AssetNode.jsx's WARM_BORDER), the background tints to
    // var(--bg-raised) on hover, and the border deepens to a 60% indigo
    // blend on hover. Variant buttons (accent/danger/amber) and disabled keep
    // their existing treatment. Scoped to icon-mode (the Asset footer) — the
    // legacy label-only branch (other panels' neutral buttons) is untouched;
    // cross-panel propagation is a later phase.
    const isNeutral = !accent && !danger && !amber && !disabled
    const neutralBorder = hovered
      ? 'color-mix(in srgb, var(--accent-indigo) 60%, var(--border))'
      : 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))'
    const neutralBg = hovered ? 'var(--bg-raised)' : 'transparent'
    const iconButton = (
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={disabled ? undefined : onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        style={{
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          padding: '10px 12px',
          // Phase 17.5.0.1: backgroundColor longhand (the properly animatable
          // property) tints to var(--bg-raised) on hover; border-color
          // deepens its indigo blend. Both fade over 120ms.
          backgroundColor: isNeutral ? neutralBg : bg,
          border: `1px solid ${isNeutral ? neutralBorder : 'var(--border)'}`,
          borderRadius: 4,
          color,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          transition: 'background-color 120ms ease, border-color 120ms ease',
        }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 14, fontSize: 14, lineHeight: 1,
        }}>{icon}</span>
        <span style={{
          maxWidth: hovered ? 220 : 0,
          opacity: hovered ? 1 : 0,
          marginLeft: hovered ? 8 : 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: 'max-width 150ms ease, opacity 150ms ease, margin-left 150ms ease',
        }}>{label}</span>
      </button>
    )
    return title
      ? <Tooltip content={title} width={280} wrapperStyle={{ flex: '0 0 auto' }}>{iconButton}</Tooltip>
      : iconButton
  }

  const button = (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        flex: 1,
        padding: '10px 14px',
        background: bg,
        border: '1px solid var(--border)',
        borderRadius: 4,
        color,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >{label}</button>
  )
  // wrapperStyle flex:1 preserves the existing equal-width-in-flex-container
  // layout — FooterButton is used inside `{display: 'flex', gap: 8}` rows.
  return title
    ? <Tooltip content={title} width={280} wrapperStyle={{ flex: 1 }}>{button}</Tooltip>
    : button
}

function PanelHeader({ typeLabel, name, pin, onClose, badge, actions }) {
  // Phase 13.4 (#175): optional `actions` slot rendered to the left of the
  // close button. Used by Claim / Eval Result / PoE / Parse Result panels to
  // surface an Expand button alongside the type badge — the same affordance
  // location used on the EA Detail Panel since 11C.2.
  // Phase 17.3 (#202): `typeLabel` is optional (panels may omit it).
  // Phase 17.5.2.1: ACTOR + ASSET panels pass it again ("ACTOR" / "ASSET")
  // so every Detail Panel header carries its type badge consistently —
  // reversing the 17.3 #202 removal for these two. Claim / Eval Result /
  // Parse Result / PoE / Badge Template have always kept their type pill.
  return (
    <div style={{ padding: '18px 18px 14px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {typeLabel && (
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            letterSpacing: '0.12em', color: 'var(--text-tertiary)', textTransform: 'uppercase',
            padding: '2px 6px', background: TYPE_BADGE_BG, borderRadius: 3,
          }}>{typeLabel}</span>
        )}
        {badge}
        <div style={{ flex: 1 }} />
        {actions}
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          style={{
            background: 'none', border: 'none', fontSize: 15,
            color: 'var(--text-tertiary)', cursor: 'pointer',
            padding: '2px 4px', borderRadius: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >✕</button>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{name}</div>
      {pin && <CopyBadge value={pin} truncated />}
    </div>
  )
}

function PanelLayout({ header, body, footer }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'var(--font-display)',
    }}>
      {header}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>{body}</div>
      {footer && (
        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>{footer}</div>
      )}
    </div>
  )
}

/* ─── Actor Panel ─────────────────────────────────────────────────────── */
// Phase 9A.3: owner-only Register Asset CTA. Radiant Network (the public
// directory pseudo-actor) has no footer actions — it isn't an owner of
// anything in the conventional sense. Counterparty Actor nodes don't
// render on the canvas in V2.2 so we don't need to branch for them here.
function V22ActorPanel({
  node, activeParty, onClose, onRegisterAsset, ownedAssetCount = 0,
  disclosureAgreementsForNode = [],
  evaluationAgreementsForNode = [],
  resolveSubjectName,
  resolveClaimName,
  onAgreementRowClick,
  onAmendDa,
  onAmendEa,
  onRevokeDa,
  onRevokeEa,
  // Phase 14.1 (#169 part 2): Badges section — received-only (badges
  // ISSUED by this actor are NOT shown here per design huddle decision 4).
  // `badgesForActor` is resolved by V2App via `getBadgesForRecipient`.
  badgesForActor = [],
  badgeTemplateLookup = {},
  onSelectBadgeIssuance,
  onRevokeBadge,
}) {
  const isOwner = activeParty === node.name && !node.isNetworkNode
  return (
    <PanelLayout
      header={<PanelHeader typeLabel="ACTOR" name={node.name} pin={node.pin} onClose={onClose} />}
      body={
        <>
          {/* Phase 9A.6.1.1 Fix 1: stripped DOT, Role, Vertical, User rows.
              DOTs per canon X.1 identify data elements (Assets / Claims /
              Eval Results), not actors — actors have DIDs per canon X.2.
              Role / Vertical / User are V2.1 narrative fields without real
              platform meaning. The Actor's PIN in the header serves as the
              user-facing identifier; role labels remain in the user-menu
              role switcher. See backlog #89, #101. */}
          <Section title="Party">
            <Row label="Name" value={node.name} />
          </Section>
          <Section title="Assets">
            <Row label="Registered" value={ownedAssetCount} />
          </Section>
          {/* Phase 14.1 (#169 part 2): Received Badges section. Section
              omitted when zero received. Issued-by-this-Actor badges are
              NOT shown here. */}
          {Array.isArray(badgesForActor) && badgesForActor.length > 0 && (
            <BadgesSection
              badges={badgesForActor}
              activeParty={activeParty}
              badgeTemplateLookup={badgeTemplateLookup}
              onSelectBadgeIssuance={onSelectBadgeIssuance}
              onRevokeBadge={onRevokeBadge}
              title="Badges Received"
            />
          )}
          <AgreementsSection
            disclosureAgreements={disclosureAgreementsForNode}
            evaluationAgreements={evaluationAgreementsForNode}
            activeParty={activeParty}
            resolveSubjectName={resolveSubjectName}
            resolveClaimName={resolveClaimName}
            onRowClick={onAgreementRowClick}
            onAmendDa={onAmendDa}
            onAmendEa={onAmendEa}
            onRevokeDa={onRevokeDa}
            onRevokeEa={onRevokeEa}
          />
        </>
      }
      footer={
        isOwner && onRegisterAsset ? (
          <FooterButton icon="＋" label="Register Asset" onClick={onRegisterAsset} title="Register a new Asset from a file in your Qualified Storage." />
        ) : null
      }
    />
  )
}

/* ─── Asset Panel ─────────────────────────────────────────────────────── */
function V22AssetPanel({
  node, activeParty, onClose,
  onRequestAgreement, onCreateClaim, onParseEvidence,
  onTransferAsset, onCancelTransfer,
  onRegisterChildAsset,
  // Phase 17.5: Create RFP entry point (pass-through to the new footer
  // button). Handler is a placeholder logger in 17.5; the RfpCreationModal
  // lands in 17.5.1.
  onCreateRfp,
  parseResultsForAsset = [],
  childAssets = [],
  parentAsset = null,
  onSelectAsset,
  // Phase 11B.1: Expand button on the File section opens the file viewer
  // for this Asset directly. Same wiring shape as the Expand button on
  // Asset rows in V22ClaimPanel — receives the Asset artifact.
  onExpandAsset,
  disclosureAgreementsForNode = [],
  evaluationAgreementsForNode = [],
  resolveSubjectName,
  resolveClaimName,
  onAgreementRowClick,
  onAmendDa,
  onAmendEa,
  onRevokeDa,
  onRevokeEa,
  // Phase 17.5.1.5: Anchored RFPs section. `anchoredRfps` is the merged,
  // newest-first list of RFPs whose assetId === this Asset; the handlers
  // mirror the RfpDetailPanel + Directory action-bar lifecycle wiring.
  anchoredRfps = [],
  onOpenRfp,
  onCloseRfp,
  onReopenRfp,
  onRemoveRfp,
}) {
  const asset = node.v22Artifact
  const isOwner = activeParty === node.owner
  // Phase 9A.4 Gate B: while a transfer is pending the owner can only
  // cancel. Post-accept the Asset moves off this canvas entirely; pre-accept
  // the other actions would be ambiguous under a change of ownership.
  const isPendingTransfer = !!node._pendingTransfer
  // Phase 18.0 (Part 2): unified "View File" button — the large full-width
  // button (formerly only on the non-owner branch, labeled "Open Evidence
  // Viewer") now renders on BOTH owner + non-owner File sections. The owner
  // branch drops its small ExpandButton header icon in favor of this. Same
  // onExpandAsset handler regardless of ownership — the action is identical.
  const viewFileButton = asset && onExpandAsset ? (
    <button
      onClick={() => onExpandAsset(asset)}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 6,
        cursor: 'pointer',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600,
        transition: 'background 120ms, border-color 120ms, color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'
        e.currentTarget.style.borderColor = 'var(--accent-indigo)'
        e.currentTarget.style.color = 'var(--accent-indigo)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-card)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
    >
      View File
    </button>
  ) : null
  return (
    <PanelLayout
      header={<PanelHeader typeLabel="ASSET" name={node.name} pin={node.pin} onClose={onClose} />}
      body={
        <>
          {asset?.description && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{asset.description}</div>
          )}
          {/* Phase 11D #135: Identity section gates on isOwner — counterparties
              who view a pulled-in Asset don't see the file's DOT (canonical
              identifier of the Asset on the platform). Owner row stays
              visible since the disclosure already implies the counterparty
              knows the owner. */}
          <Section title="Identity">
            {/* Phase 9A.4 Gate A: DOT row now sources from the Asset's own
                structured DOT (spec §2.4 / canon X.1–X.10) — not the
                party-level identifier that the preamble surfaced. The
                owner DID is accessible via `asset.dot.ownerDid` but not
                rendered here yet (will land with the provenance lineage
                UI in a future phase — backlog #74).
                Hash + URI keep their existing sourcing (`file.hash` /
                `file.uri`); `dot.hash` mirrors `file.hash` for Assets. */}
            <Row label="Owner" value={node.owner} />
            {isOwner && (
              <Row label="DOT" value={asset?.dot?.pin ? <CopyBadge value={asset.dot.pin} truncated /> : '—'} />
            )}
          </Section>
          {/* Phase 11D #135: File metadata is owner-only. Counterparties with
              an active DA can still open the evidence viewer (the disclosure
              grants viewing rights), but the file's metadata fields
              (filename, size, MIME, hash, URI) stay private. */}
          {/* Phase 18.0 (Part 2): unified File section. Owner sees the
              owner-only metadata rows (Phase 11D #135) PLUS the large "View
              File" button (was a small ExpandButton header icon). Non-owner
              sees just the "View File" button (was "Open Evidence Viewer").
              Both branches render the same `viewFileButton`. */}
          {isOwner ? (
            <Section title="File">
              <Row label="Filename" value={asset?.file?.filename} mono />
              <Row label="Size" value={formatBytes(asset?.file?.size)} />
              <Row label="MIME" value={asset?.file?.mimeType} mono />
              <Row label="Hash" value={asset?.file?.hash ? <CopyBadge value={asset.file.hash} truncated /> : '—'} />
              <Row label="URI" value={asset?.file?.uri ? <CopyBadge value={asset.file.uri} truncated /> : '—'} />
              {viewFileButton && <div style={{ marginTop: 12 }}>{viewFileButton}</div>}
            </Section>
          ) : (
            viewFileButton && (
              <Section title="File">
                {viewFileButton}
              </Section>
            )
          )}
          {/* Phase 11D #135: Registration section is owner-only. Counterparties
              don't see when the Asset was registered or how many Parse Results
              it has — that's owner-side metadata. */}
          {isOwner && (
            <Section title="Registration">
              <Row label="Registered" value={formatDateTime(asset?.registrationDate)} />
              <Row label="Parse Results" value={parseResultsForAsset.length} />
            </Section>
          )}
          {/* Phase 10.2: Asset hierarchy. Parent shown above Children so the
              tree reads top-down; sections only render when non-empty. */}
          {parentAsset && (
            <Section title="Parent">
              <AssetHierarchyRow asset={parentAsset} onSelect={onSelectAsset} />
            </Section>
          )}
          {childAssets.length > 0 && (
            <Section title={`Children (${childAssets.length})`}>
              {childAssets.map((child) => (
                <AssetHierarchyRow key={child.id} asset={child} onSelect={onSelectAsset} />
              ))}
            </Section>
          )}
          {isPendingTransfer && (
            <Section title="Pending Transfer">
              <Row label="Recipient" value={node._pendingTransfer.toParty} />
              <Row label="Initiated" value={formatDateTime(node._pendingTransfer.initiatedTimestamp)} />
              {node._pendingTransfer.note && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Note to recipient</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>"{node._pendingTransfer.note}"</div>
                </div>
              )}
            </Section>
          )}
          <AgreementsSection
            disclosureAgreements={disclosureAgreementsForNode}
            evaluationAgreements={evaluationAgreementsForNode}
            activeParty={activeParty}
            resolveSubjectName={resolveSubjectName}
            resolveClaimName={resolveClaimName}
            onRowClick={onAgreementRowClick}
            onAmendDa={onAmendDa}
            onAmendEa={onAmendEa}
            onRevokeDa={onRevokeDa}
            onRevokeEa={onRevokeEa}
          />
          {/* Phase 17.5.1.5: Anchored RFPs — the parent-canvas surface for
              RFPs anchored to this Asset (RFPs are Directory-layer-only).
              Always rendered (even empty) so the feature is discoverable. */}
          <AnchoredRfpsSection
            anchoredRfps={anchoredRfps}
            activeParty={activeParty}
            onOpenRfp={onOpenRfp}
            onCloseRfp={onCloseRfp}
            onReopenRfp={onReopenRfp}
            onRemoveRfp={onRemoveRfp}
          />
        </>
      }
      footer={
        isOwner ? (
          isPendingTransfer ? (
            <FooterButton icon="✕" label="Cancel Transfer" danger onClick={onCancelTransfer} title="Withdraw the pending transfer — no ledger record, recipient notification dismisses." />
          ) : (
            // Phase 17.5: icon-with-hover-expand footer (replaces the Phase
            // 10.2 crowded label-only five-button row, closing that polish
            // flag and fixing the Transfer cut-off). Six actions, each
            // collapsed to an icon and expanding its label inline on hover.
            // flex:0 0 auto buttons + flex-start so hover expansion doesn't
            // squeeze siblings; overflow:hidden + nowrap as a layout guard.
            // Order: Register Asset → Request Agreement → Parse Evidence →
            // Create Claim → Create RFP → Transfer.
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start', flexWrap: 'nowrap', overflow: 'hidden', flex: 1 }}>
              <FooterButton icon="＋" label="Register Asset" onClick={onRegisterChildAsset} disabled={!onRegisterChildAsset} title="Register a new Asset as a child of this Asset" />
              <FooterButton icon="⤴" label="Request Agreement" onClick={onRequestAgreement} title="Request a Disclosure + Evaluation Agreement anchored to this Asset" />
              <FooterButton icon="⊞" label="Parse Asset" onClick={onParseEvidence} disabled={!onParseEvidence} title="Parse this Asset's evidence file with a parsing template to extract structured fields." />
              <FooterButton icon="◇" label="Create Claim" onClick={onCreateClaim} disabled={!onCreateClaim} title="Create a Claim referencing this Asset" />
              <FooterButton icon="⬚" label="Create RFP" onClick={onCreateRfp} disabled={!onCreateRfp} title="Post a public RFP anchored to this Asset — other actors will be able to solicit their Claims for review" />
              <FooterButton icon="→" label="Transfer" onClick={onTransferAsset} disabled={!onTransferAsset} title="Transfer ownership of this Asset to another actor" />
            </div>
          )
        ) : null
      }
    />
  )
}

/* ─── Revocation Notice Section (Phase 9D.1) ──────────────────────────────
   Shared surface for the four revocation cases. Renders inside the Claim
   panel body — at the top for the grantee-side REVOKED branch (Cases A/C),
   and also at the top of the standard Claim panel for the grantor-side path
   (Cases B/D) when a `v22-da-revoked` / `v22-ea-revoked` notification was
   clicked and points at this Claim. Replaces V22RevocationNoticeModal.

   Props:
     viewerIsGrantor — true when activeParty is the Claim owner
     kind            — 'DA' | 'EA'
     daType          — 'full' | 'selective' | 'proofonly' (DA copy variant)
     revokerParty    — party that initiated the revocation
     revokedDate     — ISO timestamp
     reason          — revoker's free-text reason (optional)
     cascadeEa       — boolean: a paired EA was cascade-revoked
     cascadeEvalResultCount — count of Eval Results cascade-revoked
     onDismiss       — Dismiss CTA (required)
*/
function RevocationNoticeSection({
  viewerIsGrantor,
  kind,
  daType,
  revokerParty,
  revokedDate,
  reason,
  cascadeEa,
  cascadeEvalResultCount,
}) {
  const isDa = kind === 'DA'
  const DA_TYPE_LABEL = { full: 'full', selective: 'selective', proofonly: 'proof-only' }
  const daTypeLabel = DA_TYPE_LABEL[daType] || 'full'

  // Header summary — case-routed by viewer side + kind.
  let headerSummary
  if (isDa && !viewerIsGrantor) {
    // Case A: grantor-initiated DA revocation, grantee sees it.
    headerSummary = (
      <>
        <strong style={{ color: 'var(--text-secondary)' }}>{revokerParty}</strong> has revoked your <strong style={{ color: 'var(--text-secondary)' }}>{daTypeLabel}</strong> disclosure to this Claim.
      </>
    )
  } else if (isDa && viewerIsGrantor) {
    // Case B: grantee-initiated DA revocation, grantor sees it.
    headerSummary = (
      <>
        <strong style={{ color: 'var(--text-secondary)' }}>{revokerParty}</strong> has revoked their <strong style={{ color: 'var(--text-secondary)' }}>{daTypeLabel}</strong> disclosure access to this Claim.
      </>
    )
  } else if (!isDa && !viewerIsGrantor) {
    // Case C: grantor-initiated EA revocation, grantee sees it.
    headerSummary = (
      <>
        <strong style={{ color: 'var(--text-secondary)' }}>{revokerParty}</strong> has revoked your <strong style={{ color: 'var(--text-secondary)' }}>Evaluation Agreement</strong> for this Claim.
      </>
    )
  } else {
    // Case D: grantee-initiated EA revocation, grantor sees it.
    headerSummary = (
      <>
        <strong style={{ color: 'var(--text-secondary)' }}>{revokerParty}</strong> has revoked their <strong style={{ color: 'var(--text-secondary)' }}>Evaluation Agreement</strong> for this Claim.
      </>
    )
  }

  // "What this means" explainer — same case routing.
  // Phase 9D.1.3 Fix 7: all four cases updated to reflect the new cascade
  // semantics — Evaluation Results are independent artifacts owned by the
  // grantee and persist across DA/EA revocation (Fix 6). Phrasing uses
  // "Evaluation Results" (not "Eval Results") per Fix 3.
  let consequence
  if (isDa && !viewerIsGrantor) {
    // Case A — grantor revoked DA, grantee sees it.
    consequence = 'This Claim and its referenced Assets have been removed from your network. The paired Evaluation Agreement has also been terminated. Evaluation Results you previously produced against this Claim remain in your Qualified Storage and on your canvas; you can dismiss them from your canvas individually from each Evaluation Result\'s Detail Panel if you wish.'
  } else if (isDa && viewerIsGrantor) {
    // Case B — retained for completeness; in practice Case B no longer
    // routes through this component (inline DA row pattern handles it).
    // Phase 9D.1.4 Fix 3: party-name substitution if/when re-enabled.
    consequence = `${revokerParty} no longer has visibility into this Claim. The Evaluation Agreement with this Claim has also been terminated. Evaluation Results that ${revokerParty} previously produced remain in their Qualified Storage and on their network. Your Claim and its data remains on your network.`
  } else if (!isDa && !viewerIsGrantor) {
    consequence = 'You can still view this Claim under your existing Disclosure Agreement, but you can no longer run evaluations against it. Any Evaluation Results you previously submitted remain visible on your canvas.'
  } else {
    consequence = 'They no longer have the ability to run evaluations against this Claim. Prior Evaluation Results remain visible on both canvases. Your Claim and its disclosure to them remain active.'
  }

  // Cascade summary line — lists only non-zero categories.
  const cascadeBits = []
  if (cascadeEa) cascadeBits.push('1 Evaluation Agreement')
  if (cascadeEvalResultCount > 0) {
    cascadeBits.push(`${cascadeEvalResultCount} Evaluation Result${cascadeEvalResultCount > 1 ? 's' : ''}`)
  }
  const cascadeLine = cascadeBits.length > 0
    ? `This revocation also terminated: ${cascadeBits.join(', ')}.`
    : null

  const dateLabel = (() => {
    if (!revokedDate) return ''
    try {
      const d = new Date(revokedDate)
      const y = d.getUTCFullYear()
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
      const da = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${mo}-${da}`
    } catch { return '' }
  })()

  // Phase 9D.1.1 (Fix 1 + Fix 7): Section + Row layout matching the declined
  // branch's pattern rather than the modal-ported centered callout. Inline
  // Dismiss button removed — Dismiss is surfaced via the panel footer
  // (REVOKED branch footer for grantee Case A; added to the standard footer
  // when `revocationNotice` is active for Cases B / C / D).
  return (
    <>
      <Section title="Revocation Notice">
        <Row label="From" value={revokerParty} />
        <Row label="Date" value={dateLabel || '—'} />
        {cascadeLine && <Row label="Cascade" value={cascadeLine} />}
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
          borderRadius: 6,
          border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
        }}>
          <div style={{
            fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily: 'var(--font-mono)',
          }}>
            Summary
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {headerSummary}
          </div>
          <div style={{
            fontSize: 11, marginTop: 8,
            color: reason ? 'var(--text-secondary)' : 'var(--text-dim)',
            fontStyle: 'italic', lineHeight: 1.5,
          }}>
            {reason ? `"${reason}"` : '(No reason given)'}
          </div>
        </div>
      </Section>
      <div style={{
        fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6,
        marginBottom: 18, marginTop: -6,
      }}>
        {consequence}
      </div>
    </>
  )
}

/* ─── Claim Panel (covers active / provisional / declined sub-states) ─── */
function V22ClaimPanel({
  node, activeParty, onClose,
  onRespondToRequest, onCancelRequest, onDismissDeclined, onDismissRevoked,
  onRunEvaluation,
  onAmendClaim,
  onSelfEvaluate,
  // Phase 18.2 / 18.2.2: publish this Claim to the Public Directory (owner
  // only). Opens the publish modal (CombinedResponseModal in
  // directoryPublishMode). Receives the Claim artifact.
  onPublishToDirectory,
  // Phase 12.1 (#120): Referenced Standards section data + handlers.
  // `referencedStandardRows` is the resolved list of {requirementsSetId,
  // addedDate, name, version, provenance, latestVersionId}. Empty array
  // omits the section entirely.
  referencedStandardRows = [],
  onSelectRsReference,        // (rs) => void — open Library at the originally-referenced version
  onUpdateRsReference,        // (rs) => void — owner only; opens UpdateRSReferenceModal
  // Phase 11C: warm-path "Request Evaluation Agreement" footer button.
  // Renders when the viewer is non-owner, has an active DA on this Claim,
  // and does NOT yet have an EA. Click opens EARequestModal pre-populated
  // with the Claim + grantor + existing DA's id.
  onRequestEvaluationAgreement,
  hasActiveDaWithoutEa = false,
  // Phase 17.3 — Directory-layer Claim CTAs. When the panel is mounted from
  // the Directory layer (no DA exists between the viewer and the Claim
  // owner, the Claim isn't on the viewer's parent canvas), the panel's EA
  // status section + footer surface two new states:
  //   • no existing EA → "An Evaluation Agreement is required to evaluate
  //     this Claim." + Request Evaluation Agreement footer button. The
  //     button calls `onRequestEa(claim)`, which V2App routes through
  //     AssetPickerModal → CombinedRequestModal pre-filled (cold path).
  //   • existing EA → "An Evaluation Agreement is in place with {owner}." +
  //     View Evaluation Agreement footer button. The button calls
  //     `onViewEa(existingEa)`, which V2App closes the Directory and
  //     navigates the parent canvas to the EA artifact.
  // `existingEaForActor` is the resolved EA (or null) — V2App resolves it
  // via `getActiveEaForClaimAndRequester` from v2_2Data.js.
  existingEaForActor = null,
  onRequestEa,
  onViewEa,
  // Phase 18.3.1: Reject Solicitation entry point. Visible when
  // node._solicitationContext is set (i.e. the viewer is being offered this
  // Claim via a pending solicitation). Click fires the SolicitationRejectModal
  // via V2App, which on submit cascade-revokes the linked DA + transitions the
  // solicitation to 'rejected'. Receives the solicitation id (not the
  // artifact) — V2App resolves the full artifact from v22Solicitations.
  onRejectSolicitation,
  referencedAssetNames = [],
  // Phase 11D.3: when the viewer's active disclosure on this Claim is
  // proof-only (and only proof-only), the Referenced Assets section renders
  // "(0)" with a proof-only-specific empty hint instead of the generic
  // "No referenced Assets." copy. Owner + selective + full grantees see
  // the standard rendering.
  claimIsProofOnlyOnly = false,
  // Phase 11D.3: clickable Evaluation Results rows. Click → pan to the
  // Eval Result node + open its Detail Panel (replaces this Claim panel
  // since selection changes). Wired for all viewers (owner + grantees) as
  // a general UX improvement, not just proof-only.
  onSelectEvalResult,
  // Phase 11B: handler for the Expand button on referenced-Asset rows.
  // Receives the full Asset artifact so the modal can read file metadata
  // + dot lineage. Optional — when omitted, no Expand button renders.
  onExpandAsset,
  // Phase 14.0 polish: clicking a Referenced Asset row pans/zooms the
  // canvas to the Asset and selects it. Receives the Asset id (string).
  // Optional — when omitted, rows render without click affordances.
  onSelectAsset,
  // Phase 14.1 (#169 part 2): aggregated Badges section. `badgesForClaim`
  // is the resolved list (V2App computes via `getBadgesForClaim`); the
  // template lookup + select/revoke handlers are shared with the PoE panel.
  badgesForClaim = [],
  badgeTemplateLookup = {},
  onSelectBadgeIssuance,
  onRevokeBadge,
  // Phase 14.2 (#169a): Issue Badge footer button. Receives the Claim
  // artifact; V2App owns the gate (`!isOwner` of the Claim).
  onIssueBadge,
  // Phase 13.4 (#175): Expand button in the panel header — opens the Claim
  // expand modal. Receives the Claim artifact (note: the awaiting/declined/
  // revoked branches reuse this prop too — same artifact in every case).
  onExpand,
  evaluationResultsForClaim = [],
  evaluationAgreementForActor,
  disclosureAgreementsForNode = [],
  evaluationAgreementsForNode = [],
  // Phase 9D.1 (#112 UX redo): revoked DAs + EAs rendered in the Agreements
  // Section as dimmed rows while the grantee is reviewing the revocation
  // pre-Dismiss. Grantor-side panel doesn't receive these.
  revokedDisclosureAgreementsForNode = [],
  revokedEvaluationAgreementsForNode = [],
  // Phase 9D.1: grantor-side notice (Cases B/D) — notification object plus
  // resolved cascade counts. Null when there's no active revocation notice
  // for this Claim on the grantor's canvas.
  revocationNotice = null,
  onDismissRevocationNotice,
  // Phase 9D.1.2 W1: inline EA revocation pattern (Cases C/D). When
  // populated, V22ClaimPanel renders the standard panel (Claim persists)
  // and the targeted EA row expands with a red inline block + Dismiss.
  // Mutually exclusive with `revocationNotice` — Case routing in V2App
  // suppresses the Claim-level notice for kind='EA' and populates these
  // instead.
  expandedRevokedEaId = null,
  expandedRevokedEaInfo = null,
  onDismissExpandedRevokedEa,
  // Phase 9D.1.3 Fix 1: inline DA revocation pattern (Case B — grantor view
  // of grantee-initiated DA revocation). Same mechanic applied to DAs;
  // Case A (grantee view) still uses the REVOKED Claim branch since the
  // Claim itself is being removed.
  expandedRevokedDaId = null,
  expandedRevokedDaInfo = null,
  onDismissExpandedRevokedDa,
  resolveSubjectName,
  resolveClaimName,
  onAgreementRowClick,
  onAmendDa,
  onAmendEa,
  onRevokeDa,
  onRevokeEa,
}) {
  const claim = node.v22Artifact
  const isOwner = activeParty === node.owner
  const isProvisional = !!node.isProvisional
  const isDeclined = !!node.isDeclined
  const isRevoked = !!node.isRevoked
  const declineRecord = node._declineRecord
  const revokeRecord = node._revokeRecord
  const requestMeta = node._requestMeta

  // ── Awaiting Response state ─────────────────────────────────────────
  if (isProvisional) {
    const awaitingBadge = (
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
        color: 'var(--bg-deep)', background: 'var(--accent-amber)',
      }}>AWAITING RESPONSE</span>
    )
    // The grantor (owner of the Claim) sees Respond; the grantee (requester)
    // sees Cancel. Note: the active actor is the OWNER of the Claim node
    // when the request landed on their canvas as a pulled-in node. But the
    // request was sent BY the grantee; on the requester's canvas the
    // pulled-in claim is actually owned by the grantor (counterparty).
    // So `activeParty === node.owner` ↔ "Alice viewing Bob's request to her".
    return (
      <PanelLayout
        header={(
          <PanelHeader
            typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} badge={awaitingBadge}
            actions={onExpand ? <ExpandButton onClick={() => onExpand(claim)} title={`Expand ${node.name || 'Claim'}`} /> : null}
          />
        )}
        body={
          <>
            <Section title="Request">
              <Row label="Requester" value={requestMeta?.requesterParty || '—'} />
              <Row label="Anchor" value={requestMeta?.requesterAssetName || '—'} />
              <Row label="Submitted" value={formatDateTime(requestMeta?.createdDate)} />
              {requestMeta?.requestedRequirementsSetIds?.length > 0 && (
                <Row
                  label="Suggested Req Sets"
                  value={requestMeta.requestedRequirementsSetIds.join(', ')}
                  mono
                />
              )}
              {requestMeta?.message && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-raised)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Message</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>"{requestMeta.message}"</div>
                </div>
              )}
            </Section>
            <Section title="Claim">
              <Row label="Owner" value={node.owner} />
              <Row label="Description" value={claim?.description || '—'} />
              <Row label="Created" value={formatDateTime(claim?.createdDate)} />
            </Section>
          </>
        }
        footer={
          isOwner ? (
            <FooterButton icon="↪" label="Respond to Request" amber onClick={onRespondToRequest} />
          ) : (
            <FooterButton icon="✕" label="Cancel Request" danger onClick={onCancelRequest} title="Withdraw the pending request — both provisional artifacts will be removed." />
          )
        }
      />
    )
  }

  // ── Disclosure Declined state (spec §11.4) ──────────────────────────
  if (isDeclined) {
    const declinedBadge = (
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
        color: 'var(--bg-deep)', background: 'var(--accent-red)',
      }}>DECLINED</span>
    )
    return (
      <PanelLayout
        header={(
          <PanelHeader
            typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} badge={declinedBadge}
            actions={onExpand ? <ExpandButton onClick={() => onExpand(claim)} title={`Expand ${node.name || 'Claim'}`} /> : null}
          />
        )}
        body={
          <>
            <Section title="Decline Details">
              <Row label="Owner" value={declineRecord?.ownerParty || node.owner} />
              <Row label="Declined" value={formatDateTime(declineRecord?.declinedDate)} />
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Reason</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {declineRecord?.reason
                    ? `"${declineRecord.reason}"`
                    : <em style={{ color: 'var(--text-dim)' }}>No reason given.</em>}
                </div>
              </div>
            </Section>
            <Section title="Claim">
              <Row label="Description" value={claim?.description || '—'} />
            </Section>
          </>
        }
        footer={<FooterButton icon="⊠" label="Dismiss" onClick={onDismissDeclined} title="Remove the declined Claim from your canvas." />}
      />
    )
  }

  // ── Disclosure Revoked state (Phase 9D / #112; 9D.1 UX redo) ─────────
  // Grantee-side REVOKED path: triggered by `_revokedMeta` on the Claim or
  // on a scope DA → the view builder surfaces `node.isRevoked`. Renders the
  // shared RevocationNoticeSection (Cases A / C copy) at the top of the
  // body, dimmed Revoked Agreements list for pre-Dismiss context, Claim
  // summary underneath, and a prominent Dismiss footer. Non-Dismiss exit
  // (ESC, click canvas, select another node) preserves the REVOKED state
  // until the user explicitly Dismisses.
  if (isRevoked) {
    const revokedBadge = (
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
        color: 'var(--bg-deep)', background: 'var(--accent-red)',
      }}>REVOKED</span>
    )
    // The grantee-side view builder sets `node.isRevoked` only on the Claim
    // whose DA was revoked — i.e., a DA-revocation cascade. EA-only grantee
    // revocations leave the Claim visible (standard panel path, notice
    // section rendered via `revocationNotice` prop instead).
    const revokedCascadeEas = revokedEvaluationAgreementsForNode || []
    const cascadeEaPresent = revokedCascadeEas.length > 0
    const cascadeEvalResultCount = evaluationResultsForClaim.filter(er => er._revokedMeta).length
    return (
      <PanelLayout
        header={(
          <PanelHeader
            typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} badge={revokedBadge}
            actions={onExpand ? <ExpandButton onClick={() => onExpand(claim)} title={`Expand ${node.name || 'Claim'}`} /> : null}
          />
        )}
        body={
          <>
            <RevocationNoticeSection
              viewerIsGrantor={false}
              kind="DA"
              daType={revokeRecord?.daType || 'full'}
              revokerParty={revokeRecord?.revokerParty || revokeRecord?.grantorParty || node.owner}
              revokedDate={revokeRecord?.revokedDate}
              reason={revokeRecord?.reason}
              cascadeEa={cascadeEaPresent}
              cascadeEvalResultCount={cascadeEvalResultCount}
            />
            <Section title="Claim">
              <Row label="Owner" value={node.owner} />
              <Row label="Description" value={claim?.description || '—'} />
            </Section>
            {(revokedDisclosureAgreementsForNode.length > 0 || revokedCascadeEas.length > 0) && (
              <AgreementsSection
                disclosureAgreements={[]}
                evaluationAgreements={[]}
                revokedDisclosureAgreements={revokedDisclosureAgreementsForNode}
                revokedEvaluationAgreements={revokedCascadeEas}
                activeParty={activeParty}
                resolveSubjectName={resolveSubjectName}
                resolveClaimName={resolveClaimName}
                onRowClick={null /* Revoked rows are informational — no edge to frame. */}
              />
            )}
          </>
        }
        footer={<FooterButton icon="⊠" label="Dismiss" onClick={onDismissRevoked} title="Remove the revoked Claim and its paired Evaluation Agreement from your canvas. Your Evaluation Results remain in your Qualified Storage and stay on your canvas — dismiss them individually from each Evaluation Result's Detail Panel if you wish. Historical records are preserved for audit." />}
      />
    )
  }

  // ── Standard Claim panel ────────────────────────────────────────────
  // Phase 9D.1.1 (Fix 5): revocation notice renders on the standard panel
  // for both grantor and grantee viewers (Cases B / C / D). The prior
  // `activeParty === node.owner` gate rejected Case C (grantor-initiated
  // EA revocation seen by the grantee on a still-visible Claim). The
  // section's case-routing derives from `viewerIsGrantor` + `kind` and
  // handles all three cases correctly.
  const noticeForPanel = revocationNotice || null
  const panelViewerIsGrantor = activeParty === node.owner
  return (
    <PanelLayout
      header={(
        <PanelHeader
          typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose}
          actions={onExpand ? <ExpandButton onClick={() => onExpand(claim)} title={`Expand ${node.name || 'Claim'}`} /> : null}
        />
      )}
      body={
        <>
          {noticeForPanel && (
            <RevocationNoticeSection
              viewerIsGrantor={panelViewerIsGrantor}
              kind={noticeForPanel.kind || 'DA'}
              daType={noticeForPanel.daType || 'full'}
              revokerParty={noticeForPanel.revokerParty}
              revokedDate={noticeForPanel.revokedDate}
              reason={noticeForPanel.reason}
              cascadeEa={!!noticeForPanel.cascadeEa}
              cascadeEvalResultCount={noticeForPanel.cascadeEvalResultCount || 0}
            />
          )}
          {/* Phase 13.2 (#176): Claim minibar — aggregate SAT/UNSAT/MISSING
              across all non-superseded Eval Results referencing this Claim.
              Reuses the same HealthBar primitive as the node card so the
              two surfaces read consistently. Rendered above the description
              so it sits at the top of the panel body (V2.1 carryover
              restoration). Hides automatically when no rows have any data
              (HealthBar returns null on total === 0). */}
          {(() => {
            const dh = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
            const total = dh.ok + (dh.warn || 0) + dh.bad
            if (total === 0) return null
            return (
              <div style={{ marginBottom: 14, display: 'flex' }}>
                <HealthBar health={dh} withLabels />
              </div>
            )
          })()}
          {claim?.description && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{claim.description}</div>
          )}
          {/* Phase 11C: warm-path hint surfacing the next-action context for
              non-owner viewers with a DA but no EA. The footer's
              "Request Evaluation Agreement" button is the action; this strip
              tells the viewer why they don't see a Run Evaluation button. */}
          {!isOwner && hasActiveDaWithoutEa && !evaluationAgreementForActor && (
            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
              padding: '10px 12px', marginBottom: 14,
              background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
              borderRadius: 6,
            }}>
              An Evaluation Agreement is required to evaluate this Claim.
            </div>
          )}
          {/* Phase 17.3 — Directory-layer cold-path EA status section. Two
              variants: "EA required" (non-owner, no EA, no DA either) and
              "EA in place" (non-owner, EA exists). The warm-path strip above
              fires when a DA exists; this block fires in the other two cases.
              The `onRequestEa` / `onViewEa` props gate visibility — V2App only
              wires them on the Directory-layer mount, so the parent-canvas
              mount falls through cleanly. */}
          {!isOwner && !hasActiveDaWithoutEa && !!onRequestEa && !existingEaForActor && (
            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
              padding: '10px 12px', marginBottom: 14,
              background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
              borderRadius: 6,
            }}>
              An Evaluation Agreement is required to evaluate this Claim.
            </div>
          )}
          {!isOwner && !!existingEaForActor && !!onViewEa && (
            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
              padding: '10px 12px', marginBottom: 14,
              background: 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
              borderRadius: 6,
            }}>
              An Evaluation Agreement is in place with{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{node.owner}</span>.
            </div>
          )}
          <Section title="Owner">
            <Row label="Party" value={node.owner} />
            <Row label="Created" value={formatDateTime(claim?.createdDate)} />
          </Section>
          {/* Phase 11D.4 (#bug fix): the count reflects the FILTERED list
              (`referencedAssetNames.length`), not the Claim's full
              `referencedAssetIds.length`. Phase 11D.2 added DA-scope filtering
              to the rows but the section header was still reading the raw
              count, so a Selective grantee saw "Referenced Assets (3)" when
              only 1 row was visible. Owners always see the full list (V2App
              passes all referenced Assets unfiltered for them) so the count
              still equals the Claim's full size. */}
          <Section title={`Referenced Assets (${claimIsProofOnlyOnly ? 0 : referencedAssetNames.length})`}>
            {claimIsProofOnlyOnly ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>No Assets disclosed under this agreement.</div>
            ) : referencedAssetNames.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No referenced Assets.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {referencedAssetNames.map((n) => {
                  // Phase 14.0 polish: rows are clickable when an
                  // `onSelectAsset` handler is wired. Click pans/zooms the
                  // canvas to the Asset and selects it. The Expand button
                  // (own onClick + stopPropagation) is unaffected.
                  const rowClickable = !!onSelectAsset && !!n.id
                  return (
                    <div
                      key={n.id}
                      onClick={rowClickable ? () => onSelectAsset(n.id) : undefined}
                      role={rowClickable ? 'button' : undefined}
                      tabIndex={rowClickable ? 0 : undefined}
                      onKeyDown={rowClickable ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectAsset(n.id) }
                      } : undefined}
                      title={rowClickable ? `Open ${n.name} on the canvas` : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        padding: '6px 8px',
                        background: 'var(--bg-raised)',
                        borderRadius: 3,
                        cursor: rowClickable ? 'pointer' : 'default',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={rowClickable ? (e) => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, var(--bg-raised))'
                      } : undefined}
                      onMouseLeave={rowClickable ? (e) => {
                        e.currentTarget.style.background = 'var(--bg-raised)'
                      } : undefined}
                    >
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                      {/* Phase 11D.2: Selective grantees see a disclosed-field
                          count next to each Asset row. The owner sees no count
                          (they have full access); Full Disclosure grantees
                          also see no count (no field-level subset to surface). */}
                      {n.disclosureType === 'selective' && (
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--font-mono)',
                          color: 'var(--text-dim)', flexShrink: 0,
                        }}>
                          {n.disclosedFieldCount ?? 0} {(n.disclosedFieldCount === 1) ? 'field' : 'fields'}
                        </span>
                      )}
                      {/* Phase 11B / 11D.2: Expand button for Asset rows. The
                          full row is forwarded so the modal can render a
                          disclosure-type-aware view (PDF iframe vs. parsed-
                          fields table). */}
                      {n.asset && onExpandAsset && (
                        <ExpandButton onClick={() => onExpandAsset(n)} title={`Expand ${n.name}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
          {/* Phase 12.1 (#120): Referenced Standards section. Non-binding
              metadata. Owner can edit via AmendClaim; the inline "Newer
              version available" pill is the ONLY inline mutation affordance
              on this section (justified because version drift is passive
              state — the Library moved, not the Claim). Empty state omits
              the section. Non-owners see the pill as informational text
              only (not clickable). */}
          {referencedStandardRows.length > 0 && (
            <Section title={`Referenced Standards (${referencedStandardRows.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {referencedStandardRows.map((row) => {
                  const isSuperseded = row.latestVersionId && row.latestVersionId !== row.requirementsSetId
                  const provenanceLabel = row.provenance === 'own' ? 'Authored by you'
                    : row.provenance === 'public' ? 'Public' : null
                  const rowClickable = !!onSelectRsReference && !!row.requirementsSetId
                  const handleRowClick = rowClickable ? () => onSelectRsReference(row) : undefined
                  // Phase 12.1: pill click is owner-only. Non-owners see the
                  // pill as static informational text. The brief explicitly
                  // calls out this asymmetry so non-owners can see drift
                  // exists without being able to act on it.
                  const isOwnerView = activeParty === node.owner
                  const pillClickable = isSuperseded && isOwnerView && !!onUpdateRsReference
                  return (
                    <div
                      key={row.requirementsSetId}
                      style={{
                        padding: '8px 10px',
                        background: 'var(--bg-raised)',
                        borderRadius: 4,
                        border: '1px solid var(--border-faint)',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          onClick={(e) => { if (rowClickable) { e.stopPropagation(); handleRowClick() } }}
                          style={{
                            fontSize: 12, color: 'var(--text-primary)', fontWeight: 600,
                            flex: 1, minWidth: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            cursor: rowClickable ? 'pointer' : 'default',
                            textDecoration: rowClickable ? 'underline dotted color-mix(in srgb, var(--accent-indigo) 50%, transparent)' : 'none',
                            textUnderlineOffset: 3,
                          }}
                          onMouseEnter={rowClickable ? (e) => { e.currentTarget.style.color = 'var(--accent-indigo)' } : undefined}
                          onMouseLeave={rowClickable ? (e) => { e.currentTarget.style.color = 'var(--text-primary)' } : undefined}
                        >
                          {row.name || row.requirementsSetId}
                          {row.version != null && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginLeft: 6 }}>v{row.version}</span>
                          )}
                        </span>
                        {/* Phase 14.0 polish: replace the "PUBLIC" text badge
                            with the canonical globe icon used elsewhere
                            (LibraryModal lines 157-161, RequirementsPanel
                            published rows, BadgesPanel). Authored-by-you and
                            other provenance values keep the text badge —
                            the globe is reserved for "this is published on
                            the network". */}
                        {row.provenance === 'public' ? (
                          <Tooltip content="Published Standard" width={160}>
                            <svg
                              width={12} height={12} viewBox="0 0 16 16" fill="none"
                              aria-label="Published Standard"
                              style={{ flexShrink: 0, color: 'var(--accent-blue)' }}
                            >
                              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                              <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
                              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
                            </svg>
                          </Tooltip>
                        ) : provenanceLabel && (
                          <span style={{
                            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            letterSpacing: '0.1em',
                            padding: '1px 5px', borderRadius: 3,
                            color: 'var(--text-dim)',
                            background: 'var(--bg-deep)',
                            border: '1px solid var(--border-faint)',
                            flexShrink: 0,
                            textTransform: 'uppercase',
                          }}>{provenanceLabel}</span>
                        )}
                      </div>
                      {isSuperseded && (
                        <div
                          onClick={pillClickable ? (e) => { e.stopPropagation(); onUpdateRsReference(row) } : undefined}
                          title={pillClickable ? 'Click to update this reference to the latest version' : 'A newer version of this standard is available in the Library.'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            alignSelf: 'flex-start',
                            padding: '2px 7px', borderRadius: 10,
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: 'var(--accent-amber)',
                            background: 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--accent-amber) 35%, transparent)',
                            cursor: pillClickable ? 'pointer' : 'default',
                            textTransform: 'uppercase',
                          }}
                          onMouseEnter={pillClickable ? (e) => {
                            e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-amber) 20%, transparent)'
                          } : undefined}
                          onMouseLeave={pillClickable ? (e) => {
                            e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-amber) 10%, transparent)'
                          } : undefined}
                        >
                          NEWER VERSION AVAILABLE
                          {pillClickable && (
                            <span style={{ fontSize: 9, marginLeft: 2 }}>›</span>
                          )}
                        </div>
                      )}
                      {row.addedDate && (
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          Added {row.addedDate.slice(0, 10)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Phase 11C.2 W2: Acknowledgments section. Visible to all viewers
              (owner sees what they authored; counterparty sees what they
              agreed to or would need to agree to before requesting). The
              section doesn't render when the Claim has no acknowledgments. */}
          {/* Phase 14.1 (#169 part 2): aggregated Badges across all PoEs
              that wrap Eval Results referencing this Claim. Section
              omitted entirely when zero badges. */}
          {Array.isArray(badgesForClaim) && badgesForClaim.length > 0 && (
            <BadgesSection
              badges={badgesForClaim}
              activeParty={activeParty}
              badgeTemplateLookup={badgeTemplateLookup}
              onSelectBadgeIssuance={onSelectBadgeIssuance}
              onRevokeBadge={onRevokeBadge}
            />
          )}
          {claim?.acknowledgments?.length > 0 && (
            <Section title={`Acknowledgments (${claim.acknowledgments.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {claim.acknowledgments.map((ack) => (
                  <div key={ack.id} style={{
                    padding: '10px 12px',
                    background: 'var(--bg-raised)',
                    borderRadius: 4,
                    border: '1px solid var(--border-faint)',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {ack.title || '(Untitled acknowledgment)'}
                    </div>
                    {ack.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        {ack.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section title={`Evaluation Results (${evaluationResultsForClaim.length})`}>
            {evaluationResultsForClaim.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No evaluations run yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {evaluationResultsForClaim.map((er) => {
                  const isSuper = er.status === 'superseded'
                  const ok = er.results.filter(r => r.status === 'satisfactory').length
                  const bad = er.results.filter(r => r.status === 'unsatisfactory').length
                  const clickable = !!onSelectEvalResult
                  return (
                    <div
                      key={er.id}
                      onClick={clickable ? () => onSelectEvalResult(er) : undefined}
                      style={{
                        fontSize: 11, color: isSuper ? 'var(--text-dim)' : 'var(--text-primary)',
                        padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 3,
                        opacity: isSuper ? 0.6 : 1,
                        cursor: clickable ? 'pointer' : 'default',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-raised) 70%, var(--accent-indigo))' } : undefined}
                      onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = 'var(--bg-raised)' } : undefined}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 600 }}>
                        <span>{er.requirementsSet?.name || er.id}</span>
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>{isSuper ? 'SUPERSEDED' : 'ACTIVE'}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        by {er.owner} · {ok} satisfactory · {bad} unsatisfactory
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
          <AgreementsSection
            disclosureAgreements={disclosureAgreementsForNode}
            evaluationAgreements={evaluationAgreementsForNode}
            revokedDisclosureAgreements={revokedDisclosureAgreementsForNode}
            revokedEvaluationAgreements={revokedEvaluationAgreementsForNode}
            expandedRevokedEaId={expandedRevokedEaId}
            expandedRevokedEaInfo={expandedRevokedEaInfo}
            onDismissExpandedRevokedEa={onDismissExpandedRevokedEa}
            expandedRevokedDaId={expandedRevokedDaId}
            expandedRevokedDaInfo={expandedRevokedDaInfo}
            onDismissExpandedRevokedDa={onDismissExpandedRevokedDa}
            activeParty={activeParty}
            resolveSubjectName={resolveSubjectName}
            resolveClaimName={resolveClaimName}
            onRowClick={onAgreementRowClick}
            onAmendDa={onAmendDa}
            onAmendEa={onAmendEa}
            onRevokeDa={onRevokeDa}
            onRevokeEa={onRevokeEa}
          />
        </>
      }
      footer={(() => {
        // Phase 9D.1.1 (Fix 1): Dismiss lives in the footer when a
        // revocation notice is active — the inline section-level Dismiss
        // button was removed. Dismiss coexists with the normal owner /
        // evaluator actions so the viewer can dismiss the notice without
        // losing access to their Claim actions.
        // Owner: Amend Claim + (optional) Self-Evaluate (+ Dismiss).
        // Non-owner with active EA: Run Evaluation (+ Dismiss).
        // Phase 11C: Non-owner with active DA but no EA: Request Evaluation
        // Agreement (warm path).
        const hasOwnerActions = isOwner
        const hasEvalAction = !isOwner && !!evaluationAgreementForActor
        const hasWarmPathAction = !isOwner && !hasEvalAction && hasActiveDaWithoutEa && !!onRequestEvaluationAgreement
        // Phase 17.3 — Directory-layer cold-path CTAs. Two new states gated on
        // V2App wiring `onRequestEa` / `onViewEa` (the parent-canvas mount
        // doesn't wire them, so these branches stay off there).
        const hasViewEaAction = !isOwner && !!existingEaForActor && !!onViewEa
        const hasColdRequestAction = !isOwner && !hasEvalAction && !hasWarmPathAction && !hasViewEaAction && !existingEaForActor && !!onRequestEa
        // Phase 14.2 (#169a): Issue Badge footer button on Claim panel.
        // Visible to any non-owner with an Issue Badge handler wired.
        const hasIssueBadgeAction = !isOwner && !!onIssueBadge
        // Phase 18.3.1: Reject affordance composes additively with the existing
        // non-owner branches. The warm-path Request EA button continues to
        // render via hasWarmPathAction (the solicitation DA satisfies that
        // predicate); Reject appends after it.
        const hasRejectSolicitationAction = !isOwner && !!node._solicitationContext && !!onRejectSolicitation
        if (!noticeForPanel && !hasOwnerActions && !hasEvalAction && !hasWarmPathAction && !hasColdRequestAction && !hasViewEaAction && !hasIssueBadgeAction && !hasRejectSolicitationAction) return null
        return (
          <>
            {noticeForPanel && (
              <FooterButton icon="⊠" label="Dismiss" onClick={onDismissRevocationNotice} title="Dismiss this revocation notice. Your Claim and any remaining agreements are unaffected." />
            )}
            {hasOwnerActions ? (
              <>
                <FooterButton icon="✎" label="Amend Claim" onClick={onAmendClaim} disabled={!onAmendClaim} title="Add Asset references to this Claim." />
                {onSelfEvaluate && (
                  <FooterButton icon="◆" label="Self-Evaluate" onClick={onSelfEvaluate} title="Run an evaluation against this Claim under your own authority — no Evaluation Agreement required." />
                )}
                {/* Phase 18.2: publish this Claim to the Public Directory.
                    Phase 18.2.3 (B2): disabled with an explanatory tooltip once
                    the Claim already has an active Radiant Network DA
                    (`node._publishedToDirectory`) — revoke it first to republish. */}
                {onPublishToDirectory && (
                  <FooterButton
                    icon="⊕"
                    label="Publish to Directory"
                    onClick={node._publishedToDirectory ? undefined : () => onPublishToDirectory(claim)}
                    disabled={!!node._publishedToDirectory}
                    title={node._publishedToDirectory
                      ? "This Claim is already published to the Public Directory. Revoke the existing Disclosure Agreement in the Agreements section to republish."
                      : "Publish this Claim to the Public Directory. Other actors will be able to see it on the Radiant Network."}
                  />
                )}
              </>
            ) : hasEvalAction ? (
              evaluationAgreementForActor.status === 'pending-acceptance' ? (
                <FooterButton
                  icon="◆"
                  label="Run Evaluation"
                  disabled
                  title={`Cannot run evaluation: amendment proposal awaiting your response. Respond in your inbox to continue.`}
                />
              ) : (
                <FooterButton icon="◆" label="Run Evaluation" onClick={onRunEvaluation} title={`Run an evaluation under EA ${evaluationAgreementForActor.id}`} />
              )
            ) : hasWarmPathAction ? (
              <FooterButton icon="▷" label="Request Evaluation Agreement" onClick={onRequestEvaluationAgreement} title="Request evaluation rights on this Claim. Your Disclosure Agreement remains unchanged." />
            ) : hasViewEaAction ? (
              <FooterButton icon="◉" label="View Evaluation Agreement" onClick={() => onViewEa(existingEaForActor)} title={`Navigate to the existing Evaluation Agreement on your parent canvas (EA ${existingEaForActor?.id || ''}).`} />
            ) : hasColdRequestAction ? (
              <FooterButton icon="▷" label="Request Evaluation Agreement" onClick={() => onRequestEa(claim)} title="Request a Disclosure + Evaluation Agreement on this Claim." />
            ) : null}
            {/* Phase 18.3.1: Reject Solicitation — additive, after the
                Run Eval / Request EA / View EA branch and before Issue Badge.
                Fires SolicitationRejectModal via V2App, which cascade-revokes
                the linked DA on confirm. */}
            {hasRejectSolicitationAction && (
              <FooterButton
                icon="✕"
                label="Reject Solicitation"
                onClick={() => onRejectSolicitation(node._solicitationContext.solicitationId)}
                title="Reject this solicitation. The Disclosure Agreement will be revoked; the solicitor will be notified."
              />
            )}
            {hasIssueBadgeAction && (
              <FooterButton
                icon={<BadgeShieldIcon size={13} color="currentColor" />}
                label="Issue Badge"
                onClick={() => onIssueBadge(claim)}
                title="Issue a Badge against this Claim."
              />
            )}
          </>
        )
      })()}
    />
  )
}

/* ─── Parse Result Panel ──────────────────────────────────────────────── */
function V22ParseResultPanel({
  node, onClose, sourceAsset, onExpand,
  // Phase 18.0 (#116): Agreements section. Parse Results aren't the subject
  // of DAs in V2.2 (they flow through their parent Asset's disclosure), so
  // `disclosureAgreementsForNode` resolves empty and AgreementsSection renders
  // nothing — informationally correct + matches the 9C empty convention. Props
  // are threaded for parity / future-proofing if a parseResult subject kind
  // is ever introduced.
  activeParty,
  disclosureAgreementsForNode = [],
  evaluationAgreementsForNode = [],
  resolveSubjectName,
  resolveClaimName,
  onAgreementRowClick,
  onAmendDa,
  onAmendEa,
  onRevokeDa,
  onRevokeEa,
}) {
  const pr = node.v22Artifact
  return (
    <PanelLayout
      header={(
        <PanelHeader
          typeLabel="PARSE RESULT" name={node.name} pin={node.pin} onClose={onClose}
          actions={onExpand ? <ExpandButton onClick={() => onExpand(pr)} title={`Expand ${node.name || 'Parse Result'}`} /> : null}
        />
      )}
      body={
        <>
          <Section title="Source">
            <Row label="Asset" value={sourceAsset?.name || pr?.sourceAssetId} />
            <Row label="Template" value={pr?.templateName} />
            <Row label="Template id" value={pr?.templateId} mono />
            <Row label="Version" value={`v${pr?.templateVersion ?? 1}`} />
            <Row label="Parsed" value={formatDateTime(pr?.parseDate)} />
          </Section>
          <Section title={`Fields (${pr?.fields?.length || 0})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(pr?.fields || []).map((f) => (
                <div key={f.id} style={{ padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}>
                      {f.name}
                      {isHumanEdited(f) && <HumanEditedIcon />}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      conf {(f.confidence ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          {/* Phase 18.0 (#116): Agreements section — renders nothing in V2.2
              (no parseResult-subject DAs), matching the 9C empty convention. */}
          <AgreementsSection
            disclosureAgreements={disclosureAgreementsForNode}
            evaluationAgreements={evaluationAgreementsForNode}
            activeParty={activeParty}
            resolveSubjectName={resolveSubjectName}
            resolveClaimName={resolveClaimName}
            onRowClick={onAgreementRowClick}
            onAmendDa={onAmendDa}
            onAmendEa={onAmendEa}
            onRevokeDa={onRevokeDa}
            onRevokeEa={onRevokeEa}
          />
        </>
      }
    />
  )
}

/* ─── Eval Result Panel ───────────────────────────────────────────────── */
// Phase 12.2 (#117): inline diff readout for the Changes-from-prior section.
function ChangesFromPriorBlock({ diff, priorEvalResultId, assetNameLookup = {}, onSelectAsset }) {
  if (!diff) return null
  const { added = [], removed = [], superseded = [], carried = [] } = diff
  const totalDelta = added.length + removed.length + superseded.length
  if (totalDelta === 0) return (
    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
      No evidence changes since the prior evaluation; rows were re-run unchanged.
    </div>
  )
  const renderName = (assetId) => assetNameLookup[assetId]?.name || assetId
  const renderRow = (label, color, items, mode) => (
    items.length > 0 ? (
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color, letterSpacing: '0.06em', marginBottom: 4 }}>
          {label} ({items.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((entry, i) => {
            const isSupersede = mode === 'superseded'
            const fromId = isSupersede ? entry.from : entry
            const toId = isSupersede ? entry.to : null
            const clickableFrom = !!onSelectAsset && !!fromId
            return (
              <div key={isSupersede ? `${fromId}-${toId}-${i}` : `${fromId}-${i}`} style={{
                fontSize: 11, color: 'var(--text-secondary)', padding: '4px 8px',
                background: 'var(--bg-raised)', borderRadius: 3,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span
                  onClick={clickableFrom ? () => onSelectAsset(fromId) : undefined}
                  style={{
                    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: clickableFrom ? 'pointer' : 'default',
                    textDecoration: clickableFrom ? 'underline dotted color-mix(in srgb, var(--accent-indigo) 50%, transparent)' : 'none',
                    textUnderlineOffset: 3,
                  }}
                >
                  {renderName(fromId)}
                  {isSupersede && (
                    <>
                      {' → '}
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{renderName(toId)}</span>
                    </>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    ) : null
  )
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
        Compared to the prior Evaluation Result {priorEvalResultId ? `(${priorEvalResultId.slice(0, 24)}…)` : ''}.
      </div>
      {renderRow('ADDED', 'var(--accent-green)', added, 'added')}
      {renderRow('REMOVED', 'var(--accent-red)', removed, 'removed')}
      {renderRow('SUPERSEDED', 'var(--accent-amber)', superseded, 'superseded')}
      {carried.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
          {carried.length} carried over unchanged
        </div>
      )}
    </div>
  )
}

function V22EvalResultPanel({
  node, activeParty, onClose, onReRunEvaluation,
  // Phase 13 (#168): Create-PoE entry. Receives the Eval Result; V2App
  // routes to setV22CreatingPoEContext. The button is hidden when the
  // node already has `_alreadyWrapped: true` (a PoE owns this Eval
  // Result) or when the Eval Result is superseded / orphaned.
  onCreatePoE,
  // Phase 9D.1.3 Fix 6: orphaned Eval Result — backing DA or EA has been
  // revoked. When true, the footer swaps from Re-Run Evaluation to Dismiss
  // (with inline confirmation copy explaining that the artifact stays in QS
  // but leaves the canvas view).
  isOrphaned = false,
  onDismissOrphanedEvalResult,
  // Phase 11D.3: linked Claim name (resolved via claimId by V2App against
  // the merged shared dataset). Shown as a row in the Owner section when
  // available — useful for proof-only grantees who see an Eval Result pulled
  // in via a proof-only Claim DA and want to confirm what it evaluates.
  linkedClaimName,
  // Phase 13.1 (#168a): the batch-grouped sibling concept is retired.
  // `siblingEvalResults` retained as a successor lookup for the
  // Supersession section (V2App passes the supersededBy resolution in
  // a one-entry list when applicable).
  siblingEvalResults = [],
  onSelectSiblingEvalResult,
  // Phase 12.2 (#117): asset-name lookup for the "Changes from prior
  // evaluation" diff section.
  assetNameLookup = {},
  onSelectDiffAsset,
  // Phase 13.1 (#168a): true when this Eval Result has been wrapped by a
  // PoE owned by the active actor. The footer's "Re-Run Evaluation" button
  // disables with a tooltip explaining the gate.
  isPoeTerminated = false,
  // Phase 13.3 (Step 2): false when no new evidence Assets have been
  // disclosed since the prior `evidenceUsed` snapshot. Re-Run is disabled
  // with the explanatory tooltip when this is false.
  canRerun = true,
  // Phase 13.4 (#175): Expand button in the panel header — opens the Eval
  // Result expand modal with header + per-RS results tables.
  onExpand,
  // Phase 18.0 (#116): Agreements section — DAs that disclose this Eval
  // Result (the evaluator's Proof-of-Evaluation / auto-disclosure DA flowing
  // to the Claim owner + any further disclosures). Props mirror the
  // Actor/Asset/Claim AgreementsSection wiring; V2App filters
  // `disclosureAgreementsForNode` by subject.kind === 'evalResult'. No EAs
  // target an Eval Result subject, so `evaluationAgreementsForNode` is empty.
  disclosureAgreementsForNode = [],
  evaluationAgreementsForNode = [],
  resolveSubjectName,
  resolveClaimName,
  onAgreementRowClick,
  onAmendDa,
  onAmendEa,
  onRevokeDa,
  onRevokeEa,
}) {
  const er = node.v22Artifact
  const isOwner = activeParty === node.owner
  const isSuperseded = er?.status === 'superseded'
  const isOutdated = er?.status === 'outdated'
  const supersededBadge = isSuperseded ? (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
      color: 'var(--text-dim)', background: 'var(--bg-raised)',
    }}>SUPERSEDED</span>
  ) : isOutdated ? (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
      color: 'var(--accent-amber)',
      background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
      border: '1px dashed color-mix(in srgb, var(--accent-amber) 50%, transparent)',
    }}>OUTDATED</span>
  ) : null
  return (
    <PanelLayout
      header={(
        <PanelHeader
          typeLabel="EVAL RESULT" name={node.name} pin={node.pin} onClose={onClose} badge={supersededBadge}
          actions={onExpand ? <ExpandButton onClick={() => onExpand(er)} title={`Expand ${node.name || 'Eval Result'}`} /> : null}
        />
      )}
      body={
        <>
          {/* Phase 12.2 (#122): OUTDATED notice — the underlying Claim's
              evidence has changed since the evaluation. Surfaces near the
              top of the panel so the evaluator sees it before the
              now-stale results below. Re-Run is the resolution path; the
              footer's existing Re-Run Evaluation button covers it. */}
          {isOutdated && (
            <div style={{
              padding: '12px 14px', marginBottom: 14, borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
              border: '1px dashed color-mix(in srgb, var(--accent-amber) 45%, transparent)',
              fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-amber)', marginBottom: 4, fontSize: 11 }}>
                OUT OF DATE
              </div>
              This evaluation references evidence that has changed. Re-run to refresh.
            </div>
          )}
          {/* Phase 11D.3: section header reads "Owner" (the Eval Result is
              owned by the evaluator; the panel doesn't carry a separate
              "Evaluator" + "Owner" pair — they're the same party). */}
          <Section title="Owner">
            <Row label="Party" value={node.owner} />
            {linkedClaimName && <Row label="Claim" value={linkedClaimName} />}
            <Row label="Evaluated" value={formatDateTime(er?.evaluationDate)} />
            <Row label="Agreement" value={er?.evaluationAgreementId} mono />
          </Section>
          {/* Phase 13.1 (#168a): grouped rendering — one section header per
              Requirements Set in the bundled Eval Result. The aggregate row
              at the top reads "X SAT · Y UNSAT · Z MISSING · W N/A across
              N Requirements Sets". Sibling Evaluations section is gone with
              the batch-grouping concept. */}
          {(() => {
            const rsList = er?.requirementsSets || (er?.requirementsSet ? [er.requirementsSet] : [])
            const allRows = er?.results || []
            // Phase 13.2 (#176): drop N/A from displays. The model still
            // carries `status: 'na'` rows (unchanged); we just dim them in
            // the per-row UI so the structure stays visible without
            // pulling visual weight, and we exclude them from the
            // aggregate header. The minibar primitive `HealthBar` displays
            // SAT/UNSAT/MISSING with green/red/amber segments.
            const totals = { sat: 0, unsat: 0, missing: 0 }
            for (const r of allRows) {
              if (r.status === 'satisfactory') totals.sat += 1
              else if (r.status === 'unsatisfactory') totals.unsat += 1
              else if (r.status === 'missing') totals.missing += 1
            }
            const renderableRowCount = allRows.filter((r) => r.status !== 'na').length
            const aggHealth = { ok: totals.sat, warn: totals.missing, bad: totals.unsat }
            return (
              <>
                <Section title={`Results (${renderableRowCount})`}>
                  {(aggHealth.ok + aggHealth.warn + aggHealth.bad) > 0 && (
                    <div style={{ marginBottom: 10, display: 'flex' }}>
                      <HealthBar health={aggHealth} withLabels />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {rsList.map((rs) => {
                      const rsRows = allRows.filter((r) => (r.requirementsSetId || rsList[0].id) === rs.id)
                      // Backwards-compat: prior Eval Results without `requirementsSetId` per row
                      // are treated as belonging to the singular requirementsSet.
                      return (
                        <div key={rs.id}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 8px', borderRadius: 3,
                            background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                            marginBottom: 4,
                          }}>
                            <span style={{
                              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em',
                              color: 'var(--accent-indigo)',
                              background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                            }}>REQUIREMENTS SET</span>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rs.name}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                              v{rs.version ?? 1} · {rsRows.length} requirement{rsRows.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {rsRows.map((r) => {
                              const cfg = STATUS_CFG[r.status] || STATUS_CFG.missing
                              const isNa = r.status === 'na'
                              return (
                                <div
                                  key={`${rs.id}-${r.requirementId}`}
                                  style={{
                                    padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 3,
                                    // Phase 13.2 (#176): N/A rows render dimmed
                                    // so the structure stays visible but the
                                    // visual weight matches the "excluded
                                    // from display" semantics.
                                    opacity: isNa ? 0.45 : 1,
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}>
                                      {r.label}
                                      {isHumanEdited(r) && <HumanEditedIcon />}
                                    </span>
                                    <span style={{
                                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                      padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em',
                                      color: cfg.color, background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
                                    }}>{cfg.label}</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                    {r.value}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              </>
            )
          })()}
          {/* Phase 12.2 (#117): Changes from prior evaluation — persistent
              audit trail of the diff that led to this re-run. Only renders
              when this Eval Result was a re-run (evidenceDiff !== null). */}
          {er?.evidenceDiff && (
            <Section title="Changes from prior evaluation">
              <ChangesFromPriorBlock diff={er.evidenceDiff} priorEvalResultId={er.priorEvalResultId} assetNameLookup={assetNameLookup} onSelectAsset={onSelectDiffAsset} />
            </Section>
          )}
          {isSuperseded && er?.supersededBy && (
            <Section title="Supersession">
              {/* Phase 12.3 (Bug C): the Supersession list item is now
                  clickable — same row-click pattern as the Sibling
                  Evaluations section above. Click navigates to the
                  successor Eval Result's Detail Panel. Falls back to the
                  legacy read-only Row when no `onSelectSiblingEvalResult`
                  handler is wired (defensive). */}
              {onSelectSiblingEvalResult ? (() => {
                const successorId = er.supersededBy
                const successor = (siblingEvalResults || []).find((s) => s.id === successorId)
                  || { id: successorId, name: successorId, status: 'active' }
                const sucStatus = successor.status === 'superseded'
                  ? { label: 'SUPERSEDED', color: 'var(--text-dim)' }
                  : successor.status === 'outdated'
                    ? { label: 'OUTDATED', color: 'var(--accent-amber)' }
                    : { label: 'ACTIVE', color: 'var(--accent-green)' }
                return (
                  <div
                    onClick={() => onSelectSiblingEvalResult(successor)}
                    style={{
                      padding: '6px 8px', borderRadius: 3,
                      background: 'var(--bg-raised)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-raised) 70%, var(--accent-indigo))' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-raised)' }}
                  >
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {successor.name}
                    </span>
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: sucStatus.color, padding: '1px 5px', borderRadius: 3,
                      background: `color-mix(in srgb, ${sucStatus.color} 12%, transparent)`,
                    }}>{sucStatus.label}</span>
                  </div>
                )
              })() : (
                <Row label="Superseded by" value={er.supersededBy} mono />
              )}
            </Section>
          )}
          {isOwner && isOrphaned && !isSuperseded && (
            /* Phase 9D.1.3 Fix 6: orphan notice — the Evaluation Agreement
               that underpinned this result has been revoked. The artifact
               itself remains in the owner's QS but has no active access
               agreement anymore. */
            <Section title="Orphaned Evaluation Result">
              <div style={{
                padding: '10px 12px',
                background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
                borderRadius: 6,
                fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.6,
              }}>
                The Evaluation Agreement that backed this result has been
                revoked. The Evaluation Result itself remains in your
                Qualified Storage and on your canvas — you can dismiss it
                from the canvas view below, or leave it in place.
              </div>
            </Section>
          )}
          {/* Phase 18.0 (#116): Agreements section — extends the Phase 9C
              Actor/Asset/Claim pattern to Eval Results. Lists DAs that
              disclose this Eval Result (renders nothing when empty, matching
              the 9C convention). */}
          <AgreementsSection
            disclosureAgreements={disclosureAgreementsForNode}
            evaluationAgreements={evaluationAgreementsForNode}
            activeParty={activeParty}
            resolveSubjectName={resolveSubjectName}
            resolveClaimName={resolveClaimName}
            onRowClick={onAgreementRowClick}
            onAmendDa={onAmendDa}
            onAmendEa={onAmendEa}
            onRevokeDa={onRevokeDa}
            onRevokeEa={onRevokeEa}
          />
        </>
      }
      footer={(() => {
        if (!isOwner) return null
        if (isSuperseded) return null
        // Phase 9D.1.3 Fix 6: orphan state swaps Re-Run Evaluation for a
        // Dismiss action. Mutually exclusive — no overlap.
        if (isOrphaned) {
          // Phase 9D.1.4 Fix 2: V2App owns the dismiss-confirmation modal
          // (V22DismissEvalResultModal). The footer click just hands the
          // ER up; parent state-routes the Confirm/Cancel choice.
          return (
            <FooterButton
              icon="⊠"
              label="Dismiss"
              onClick={() => onDismissOrphanedEvalResult && onDismissOrphanedEvalResult(er)}
              title="Remove this orphaned Evaluation Result from your canvas. The artifact stays in your QS."
            />
          )
        }
        if (onReRunEvaluation || onCreatePoE) {
          // Phase 13.1 (#168a) + Phase 13.3 (Step 2): Re-Run disabled when
          // the Eval Result is PoE-terminated OR when no new evidence
          // Assets have been disclosed since the prior `evidenceUsed`.
          // Tooltip varies by reason. Both gates compose with the
          // existing visible-but-disabled pattern.
          // Phase 17.5.0.2: Create PoE now ALSO follows the visible-but-
          // disabled pattern when the chain is PoE-terminated
          // (`node._alreadyWrapped`) — it used to disappear; now it greys out
          // with an explanatory tooltip, mirroring Re-Run for symmetry.
          const reRunDisabled = isPoeTerminated || !canRerun
          const reRunTooltip = isPoeTerminated
            ? "An evaluation has already been finalized as a Proof of Evaluation. Modify the Claim's evidence or select a different Requirements Set to continue."
            : !canRerun
              ? 'No new evidence to evaluate. Wait for Asset additions or modify the Claim’s evidence.'
              : 'Run a new evaluation; this result will be marked superseded.'
          return (
            <>
              {onReRunEvaluation && (
                <FooterButton
                  icon="↻"
                  label="Re-run Evaluation"
                  onClick={reRunDisabled ? undefined : onReRunEvaluation}
                  disabled={reRunDisabled}
                  title={reRunTooltip}
                />
              )}
              {onCreatePoE && (
                node._alreadyWrapped ? (
                  <FooterButton
                    icon="◈"
                    label="Create Proof of Evaluation"
                    disabled
                    title="An evaluation has already been finalized as a Proof of Evaluation. The evaluation chain is closed."
                  />
                ) : (
                  <FooterButton
                    icon="◈"
                    label="Create Proof of Evaluation"
                    onClick={() => onCreatePoE(er)}
                    title="Finalize this evaluation as an immutable Proof of Evaluation. Terminates the evaluation chain for this Asset+Requirements Set combination."
                  />
                )
              )}
            </>
          )
        }
        return null
      })()}
    />
  )
}

/* ─── PoE Panel — Phase 13 (#168) ─────────────────────────────────────── */
//
// Renders the Proof-of-Evaluation node's Detail Panel. Sections per the
// design huddle (decision 13):
//   • Owner — evaluator + created date
//   • Source Claim — clickable, jumps to the wrapped Claim's panel
//   • Wrapped Eval Results — list of wrapped Eval Result names; rows
//     clickable to navigate to each Eval Result's panel
//   • Disclosures — active proof-only DAs targeting this PoE
//   • Badges — placeholder section ("No badges yet"; #169 will populate)
//
function V22PoEPanel({
  node, activeParty, onClose,
  // Resolution callbacks supplied by V2App against the merged shared
  // dataset. All optional — the panel falls back to opaque ids.
  resolveClaimName,
  resolveEvalResultName,
  resolveDaSummary,
  onSelectClaim,
  onSelectEvalResult,
  onSelectDa,
  // Active proof-only DAs whose scope.poeIds includes this PoE.
  // Each entry: { id, granteeParty, type, status }.
  disclosingAgreements = [],
  // Phase 13.2 (#177): full Eval Result supersession chain that ends at
  // this PoE's wrapped Eval Result. Entries ordered oldest-first so the
  // section reads as a timeline. Each: { id, name, status, evaluationDate }.
  // V2App resolves the chain by walking `priorEvalResultId` from the wrapped
  // Eval Result back to its origin.
  provenanceChain = [],
  // Phase 13.4 (#175): Expand button in the panel header — opens the PoE
  // expand modal (Section 1 = wrapped Eval Result content; Section 2 =
  // Evaluation Provenance with the full supersession chain).
  onExpand,
  // Phase 14.1 (#169 part 2): Badges. `badgesForPoE` is the active list
  // (resolved by V2App via `getBadgesForPoE`); `badgeTemplateLookup` maps
  // template ids → template artifacts for inline display. Handlers:
  //   • `onIssueBadge(poe)` — opens Issue Badge modal (entry-point gating
  //     keeps this hidden when current actor is the PoE owner).
  //   • `onSelectBadgeIssuance(badgeId)` — opens Badge Issuance Detail Panel.
  //   • `onRevokeBadge(badgeIssuanceId)` — opens Revoke Badge modal.
  badgesForPoE = [],
  badgeTemplateLookup = {},
  onIssueBadge,
  onSelectBadgeIssuance,
  onRevokeBadge,
  // Phase 14.2 (#169a): the PoE's parent Claim summary (id + name +
  // ownerParty) — resolved by V2App from `poe.claimId` against the merged
  // dataset. Drives both the "Badges earned by [Claim name]" subtext and
  // the Issue Badge footer gate.
  poeBadgesParentClaim,
  onSelectClaimFromBadgeSubtext,
}) {
  const poe = node.v22Artifact
  // Phase 13.1 (#168a): 1:1 wrap. The singular `wrappedEvalResultId` field
  // replaces the prior plural list.
  const wrappedId = poe?.wrappedEvalResultId || null
  const agg = node.poeAggregate || { sat: 0, unsat: 0, missing: 0, na: 0, rsCount: 0 }
  return (
    <PanelLayout
      header={(
        <PanelHeader
          typeLabel="PROOF OF EVALUATION" name={node.name} pin={node.pin} onClose={onClose}
          actions={onExpand ? <ExpandButton onClick={() => onExpand(poe)} title={`Expand ${node.name || 'Proof of Evaluation'}`} /> : null}
        />
      )}
      body={
        <>
          <Section title="Owner">
            <Row label="Evaluator" value={poe?.owner} />
            <Row label="Created" value={formatDateTime(poe?.createdDate)} />
            <Row label="Status" value={poe?.status || 'active'} />
          </Section>

          <Section title="Source Claim">
            {poe?.claimId
              ? (
                <div
                  onClick={() => onSelectClaim?.(poe.claimId)}
                  role={onSelectClaim ? 'button' : undefined}
                  tabIndex={onSelectClaim ? 0 : undefined}
                  style={{
                    padding: '6px 8px', borderRadius: 3,
                    background: 'var(--bg-raised)',
                    cursor: onSelectClaim ? 'pointer' : 'default',
                    fontSize: 11, color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                  title={onSelectClaim ? 'Open the source Claim' : undefined}
                >
                  <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: 2 }}>
                    {resolveClaimName ? resolveClaimName(poe.claimId) : poe.claimId}
                  </div>
                  <div>{poe.claimId}</div>
                </div>
              )
              : <Row label="Claim" value="—" />}
          </Section>

          {/* Phase 13.2 (#177): "Wrapped Eval Result" → "Evaluation
              Provenance". Renders the full supersession chain that ends at
              the wrapped Eval Result. When the wrapped Eval Result is its
              own origin (no priorEvalResultId), the section is a single
              row matching the pre-13.2 layout. The aggregate footer drops
              N/A from the displayed counts (Phase 13.2 #176). */}
          {(() => {
            // V2App passes provenanceChain ordered oldest-first. If a
            // caller didn't pass it, fall back to a one-entry chain
            // (legacy behavior pre-13.2).
            const chain = provenanceChain.length > 0
              ? provenanceChain
              : (wrappedId ? [{ id: wrappedId, name: resolveEvalResultName ? resolveEvalResultName(wrappedId) : wrappedId, status: 'active', evaluationDate: null }] : [])
            return (
              <Section title={`Evaluation Provenance (${chain.length})`}>
                {chain.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>—</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {chain.map((entry, idx) => {
                      const isLatest = idx === chain.length - 1
                      const sBadge = entry.status === 'superseded'
                        ? { label: 'SUPERSEDED', color: 'var(--text-dim)' }
                        : entry.status === 'outdated'
                          ? { label: 'OUTDATED', color: 'var(--accent-amber)' }
                          : { label: isLatest ? 'WRAPPED' : 'ACTIVE', color: 'var(--accent-green)' }
                      return (
                        <div
                          key={entry.id}
                          onClick={() => onSelectEvalResult?.(entry.id)}
                          role={onSelectEvalResult ? 'button' : undefined}
                          tabIndex={onSelectEvalResult ? 0 : undefined}
                          style={{
                            padding: '6px 8px', borderRadius: 3,
                            background: 'var(--bg-raised)',
                            cursor: onSelectEvalResult ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'background 100ms',
                          }}
                          onMouseEnter={onSelectEvalResult ? (e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-raised) 70%, var(--accent-indigo))' } : undefined}
                          onMouseLeave={onSelectEvalResult ? (e) => { e.currentTarget.style.background = 'var(--bg-raised)' } : undefined}
                          title={onSelectEvalResult ? 'Open this Eval Result' : undefined}
                        >
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0, minWidth: 16, textAlign: 'right' }}>{idx + 1}.</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {entry.name}
                            </div>
                            {entry.evaluationDate && (
                              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                {entry.evaluationDate.slice(0, 10)}
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            color: sBadge.color, padding: '1px 5px', borderRadius: 3,
                            background: `color-mix(in srgb, ${sBadge.color} 12%, transparent)`,
                            flexShrink: 0,
                          }}>{sBadge.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{
                  marginTop: 8, fontSize: 10,
                  color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                }}>
                  {agg.sat} SAT · {agg.unsat} UNSAT · {agg.missing} MISSING · across {agg.rsCount} Requirements Set{agg.rsCount === 1 ? '' : 's'}
                </div>
              </Section>
            )
          })()}

          <Section title={`Disclosures (${disclosingAgreements.length})`}>
            {disclosingAgreements.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                No active disclosures.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {disclosingAgreements.map((da) => (
                  <div
                    key={da.id}
                    onClick={() => onSelectDa?.(da.id)}
                    role={onSelectDa ? 'button' : undefined}
                    tabIndex={onSelectDa ? 0 : undefined}
                    style={{
                      padding: '6px 8px', borderRadius: 3,
                      background: 'var(--bg-raised)',
                      cursor: onSelectDa ? 'pointer' : 'default',
                    }}
                    title={onSelectDa ? 'Open this Disclosure Agreement' : undefined}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                      {resolveDaSummary ? resolveDaSummary(da) : `${da.granteeParty} · ${da.type}`}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {da.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <BadgesSection
            badges={badgesForPoE}
            activeParty={activeParty}
            badgeTemplateLookup={badgeTemplateLookup}
            onSelectBadgeIssuance={onSelectBadgeIssuance}
            onRevokeBadge={onRevokeBadge}
            subtext={poeBadgesParentClaim ? {
              prefix: 'Badges earned by',
              linkLabel: poeBadgesParentClaim.name,
              onClick: onSelectClaimFromBadgeSubtext
                ? () => onSelectClaimFromBadgeSubtext(poeBadgesParentClaim.id)
                : null,
            } : null}
          />

          <Section title="DOT">
            {/* Phase 13.3 (Step 10): PIN row removed — the click-to-copy
                PIN badge in the panel header is the canonical surface,
                and repeating the full PIN string here was visual noise. */}
            <Row label="Owner DID" value={poe?.ownerDot?.owner} mono />
            <Row label="Asset snapshot" value={`${(poe?.assetSnapshot || []).length} Asset(s)`} />
          </Section>
        </>
      }
      footer={(() => {
        // Phase 14.2 (#169a): Issue Badge footer gate is `activeParty !==
        // claim.ownerParty`. The parent Claim's owner is supplied via
        // `poeBadgesParentClaim.ownerParty` (resolved by V2App from the
        // PoE's `claimId` against the merged dataset). When the prop isn't
        // wired, fall back to the pre-14.2 PoE-owner gate.
        if (!onIssueBadge) return null
        const claimOwnerParty = poeBadgesParentClaim?.ownerParty
          || poeBadgesParentClaim?.owner
          || null
        const blocked = claimOwnerParty
          ? activeParty === claimOwnerParty
          : (poe?.owner === activeParty || poe?.ownerParty === activeParty)
        if (blocked) return null
        return (
          <FooterButton
            icon={<BadgeShieldIcon size={13} color="currentColor" />}
            label="Issue Badge"
            onClick={() => onIssueBadge(poe)}
            title="Issue a Badge against this Claim."
          />
        )
      })()}
    />
  )
}

const STATUS_CFG = {
  satisfactory:   { label: 'SAT',     color: 'var(--accent-green)' },
  unsatisfactory: { label: 'UNSAT',   color: 'var(--accent-red)' },
  missing:        { label: 'MISSING', color: 'var(--accent-amber)' },
  na:             { label: 'N/A',     color: 'var(--text-dim)' },
}

/* ─── BadgesSection — shared across PoE / Claim / Actor Detail Panels.
   Phase 14.1 (#169 part 2). Each row: shield + name + version + issuer +
   creation date. Row click → opens Badge Issuance Detail Panel. When
   the active actor is the issuer of a row, a Revoke affordance appears.
   Section is omitted by callers when zero badges (caller checks length). */
function BadgesSection({
  badges, activeParty, badgeTemplateLookup = {},
  onSelectBadgeIssuance, onRevokeBadge, title = 'Badges',
  // Phase 14.2 (#169a): optional subtext rendered between section header and
  // rows. Used on PoE Badges section to surface "Badges earned by [Claim
  // name]" with the Claim name clickable. Shape: { prefix, linkLabel, onClick }.
  subtext = null,
}) {
  const list = badges || []
  return (
    <Section title={`${title} (${list.length})`}>
      {subtext && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span>{subtext.prefix}</span>
          {subtext.onClick ? (
            <span
              onClick={subtext.onClick}
              role="button"
              tabIndex={0}
              style={{
                color: 'var(--accent-indigo)', cursor: 'pointer', fontWeight: 600,
                textDecoration: 'underline dotted color-mix(in srgb, var(--accent-indigo) 50%, transparent)',
                textUnderlineOffset: 3,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-amber)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--accent-indigo)' }}
            >{subtext.linkLabel}</span>
          ) : (
            <span style={{ color: 'var(--text-primary)' }}>{subtext.linkLabel}</span>
          )}
        </div>
      )}
      {list.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
          No badges yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {list.map((b) => {
            const template = badgeTemplateLookup[b.badgeTemplateId] || null
            const name = template?.name || b.badgeTemplateId
            const version = template?.version ?? null
            const isIssuer = b.issuerParty === activeParty
            const clickable = !!onSelectBadgeIssuance
            return (
              <div
                key={b.id}
                onClick={clickable ? (e) => {
                  // Don't fire row click if user clicked the Revoke affordance.
                  if (e.target.closest('[data-revoke-affordance]')) return
                  onSelectBadgeIssuance(b.id)
                } : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                style={{
                  padding: '8px 10px', borderRadius: 4,
                  background: 'var(--bg-raised)',
                  cursor: clickable ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 100ms',
                }}
                onMouseEnter={clickable ? (e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, var(--bg-raised))'
                } : undefined}
                onMouseLeave={clickable ? (e) => {
                  e.currentTarget.style.background = 'var(--bg-raised)'
                } : undefined}
              >
                <BadgeShieldIcon size={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 6,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{name}</span>
                    {version != null && (
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        padding: '1px 5px', borderRadius: 3,
                        color: 'var(--accent-indigo)',
                        background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                      }}>v{version}</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2,
                    display: 'flex', gap: 6,
                  }}>
                    <span>{b.issuerParty}</span>
                    <span>·</span>
                    <span>{(b.createdDate || '').slice(0, 10)}</span>
                  </div>
                </div>
                {isIssuer && onRevokeBadge && (
                  <span
                    data-revoke-affordance
                    onClick={(e) => { e.stopPropagation(); onRevokeBadge(b.id) }}
                    style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      letterSpacing: '0.06em',
                      padding: '4px 8px', borderRadius: 4, flexShrink: 0,
                      color: 'var(--accent-red)',
                      cursor: 'pointer',
                      border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-red) 8%, transparent)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >REVOKE</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

/* ─── Badge Template Panel — Phase 14.0 (#169 part 1) ─────────────────── */
//
// Mirrors the data shape of other V22 Detail Panels (header / sections / footer)
// for visual consistency. Phase 14.0 doesn't currently mount Badge Templates
// as canvas nodes — the panel is consumed by BadgesPanel's right-side detail
// view via direct import, and the router entry below is forward-looking
// scaffolding for Phase 14.1's Badge Issuance work.
//
// The Active Issuances section is a placeholder until 14.1 — once the
// Badge Issuance artifact ships, this section populates with the real list.
function V22BadgeTemplatePanel({
  template,
  activeParty,
  onClose,
  onNewVersion,
  onSelectRequirementsSet,
  onExpand,
  allRequirementSets = [],
  // Phase 14.1 (#169 part 2): Active Issuances section now populated.
  // `activeIssuances` is the list filtered to this exact template version
  // (caller filters by `issuance.badgeTemplateId === template.id`).
  // `lineageActiveIssuanceCount` is the total across ALL versions in the
  // template's lineage (for the subtext line).
  // Phase 14.6 (#187): `claimNameLookup` replaces `poeNameLookup` — issuances
  // reference Claims (post-Phase-14.2). Forward-looking surface; Badge
  // Template nodes aren't materialized on the canvas yet.
  activeIssuances = [],
  lineageActiveIssuanceCount = 0,
  claimNameLookup = {},
  onSelectBadgeIssuance,
}) {
  if (!template) return null
  const isOwn = template.ownerParty === activeParty
  const isLatest = !template.supersededBy
  return (
    <PanelLayout
      header={(
        <PanelHeader
          typeLabel="BADGE TEMPLATE"
          name={`${template.name} · v${template.version || 1}`}
          pin={template.pin}
          onClose={onClose}
          actions={onExpand ? <ExpandButton onClick={() => onExpand(template)} title={`Expand ${template.name || 'Badge Template'}`} /> : null}
        />
      )}
      body={
        <>
          <Section title="Owner">
            <Row label="Party" value={template.ownerParty} />
            <Row label="Created" value={formatDateTime(template.createdDate)} />
            <Row label="Version" value={`v${template.version ?? 1}`} />
          </Section>
          {!isLatest && (
            <Section title="Supersession">
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
                fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.5,
              }}>
                A newer version of this Badge Template exists. You are viewing v{template.version || 1}.
              </div>
            </Section>
          )}
          {template.description && (
            <Section title="Description">
              <div style={{
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                padding: '8px 10px', background: 'var(--bg-raised)', borderRadius: 4,
              }}>{template.description}</div>
            </Section>
          )}
          <Section title={`Referenced Requirements Sets (${(template.referencedRequirementsSetIds || []).length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(template.referencedRequirementsSetIds || []).map((rsId) => {
                const rs = allRequirementSets.find((r) => r.id === rsId)
                const clickable = !!onSelectRequirementsSet
                return (
                  <div
                    key={rsId}
                    onClick={clickable ? () => onSelectRequirementsSet(rsId) : undefined}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    style={{
                      padding: '6px 8px', borderRadius: 3,
                      background: 'var(--bg-raised)',
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={clickable ? (e) => {
                      e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, var(--bg-raised))'
                    } : undefined}
                    onMouseLeave={clickable ? (e) => {
                      e.currentTarget.style.background = 'var(--bg-raised)'
                    } : undefined}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rs?.name || rsId}
                      {rs && (
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginLeft: 6 }}>
                          v{rs.version || 1}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>
                      {rsId}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
          {/* Phase 14.1 (#169 part 2): Active Issuances populated. Lists
              issuances of THIS specific template version. Subtext line
              surfaces the total across the whole lineage so users can see
              "the badge as a whole" usage even when they're looking at a
              specific version. */}
          <Section title={`Active Issuances (${activeIssuances.length})`}>
            {activeIssuances.length === 0 ? (
              <div style={{
                padding: '10px 12px', borderRadius: 4,
                background: 'var(--bg-raised)',
                fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
              }}>
                No active issuances of this version.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {activeIssuances.map((b) => {
                  // Phase 14.6 (#187): post-14.2 migration. Read
                  // targetClaimId (was targetPoeId) and pull Claim
                  // label + ownerParty from the new claimNameLookup.
                  const lookupEntry = claimNameLookup[b.targetClaimId] || null
                  const claimLabel = lookupEntry?.name || b.targetClaimId
                  const ownerParty = lookupEntry?.ownerParty || null
                  const clickable = !!onSelectBadgeIssuance
                  return (
                    <div
                      key={b.id}
                      onClick={clickable ? () => onSelectBadgeIssuance(b.id) : undefined}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      style={{
                        padding: '8px 10px', borderRadius: 4,
                        background: 'var(--bg-raised)',
                        cursor: clickable ? 'pointer' : 'default',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={clickable ? (e) => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, var(--bg-raised))'
                      } : undefined}
                      onMouseLeave={clickable ? (e) => {
                        e.currentTarget.style.background = 'var(--bg-raised)'
                      } : undefined}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {claimLabel}
                      </div>
                      <div style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2,
                        display: 'flex', gap: 6,
                      }}>
                        {ownerParty && <><span>{ownerParty}</span><span>·</span></>}
                        <span>{(b.createdDate || '').slice(0, 10)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {lineageActiveIssuanceCount > 0 && (
              <div style={{
                marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--text-dim)', lineHeight: 1.6,
              }}>
                {lineageActiveIssuanceCount} total active issuance{lineageActiveIssuanceCount === 1 ? '' : 's'} across this badge&rsquo;s history.
              </div>
            )}
          </Section>
        </>
      }
      footer={isOwn && isLatest ? (
        <FooterButton icon="＋" label="Create new version" onClick={onNewVersion} title="Create a new version of this Badge Template. Prior versions remain in the Library." />
      ) : null}
    />
  )
}

// Re-export the panel so BadgesPanel (or any other Library surface) can
// embed the same component without owning its own forked layout.
export { V22BadgeTemplatePanel }

// Phase 14.1 (#169 part 2) introduced V22BadgeIssuancePanel as a standalone
// Detail Panel mount. Phase 14.2 (#169b) removed it: the Detail Panel-over-
// Detail Panel pattern violated the prototype's UX conventions. Badge
// Issuance row clicks now route directly to the expand modal (which is the
// correct overlay pattern for non-canvas artifacts).

/* ─── Agreements Section (Phase 9C — backlog #111) ────────────────────── */
// Shared sub-panel for Actor / Asset / Claim Detail Panels. Surfaces the
// DAs + EAs relevant to the node being viewed with Amend / Revoke action
// labels on the right side of each row. Primary UX path for agreement
// management; edge-click (9B) is the secondary path.
//
// Row click (anywhere except Amend/Revoke text) selects the agreement's
// edge on the canvas and opens its Detail Panel — same semantics as the
// edge-tooltip "View" actions.

const SDA_TYPE_CFG = {
  full:        { color: 'var(--accent-indigo)', label: 'Full Disclosure',      dasharray: null },
  selective:   { color: 'var(--accent-amber)',  label: 'Selective Disclosure', dasharray: '6 3' },
  proofonly:   { color: 'var(--accent-green)',  label: 'Proof-Only Disclosure', dasharray: '2 3' },
  provisional: { color: 'var(--text-dim)',      label: 'Provisional',          dasharray: '5 4' },
}

function SdaLine({ type }) {
  const cfg = SDA_TYPE_CFG[type] || SDA_TYPE_CFG.full
  return (
    <svg width={22} height={8} viewBox="0 0 22 8" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1="1" y1="4" x2="21" y2="4" stroke={cfg.color} strokeWidth="2"
            strokeLinecap="round" strokeDasharray={cfg.dasharray || undefined} />
    </svg>
  )
}

function formatShortDate(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  } catch { return null }
}

function truncate(s, n) {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function ActionLabel({ label, onClick, disabled, title, danger }) {
  // Phase 17.5.1.5: `danger` variant (red base + brightened-red hover) for the
  // irreversible "Remove RFP" row action. Default (false) preserves the
  // existing primary→indigo treatment used by every DA/EA row action.
  const baseColor = disabled ? 'var(--text-dim)' : danger ? 'var(--accent-red)' : 'var(--text-primary)'
  const hoverColor = danger ? 'color-mix(in srgb, var(--accent-red) 75%, var(--text-primary))' : 'var(--accent-indigo)'
  const span = (
    <span
      role={onClick && !disabled ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onClick={onClick && !disabled ? (e) => { e.stopPropagation(); onClick() } : (e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (!onClick || disabled) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClick() }
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        e.currentTarget.style.color = baseColor
      }}
      style={{
        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: baseColor,
        cursor: disabled ? 'default' : (onClick ? 'pointer' : 'default'),
        transition: 'color 120ms',
        userSelect: 'none',
      }}
    >{label}</span>
  )
  return title ? <Tooltip content={title} width={260}>{span}</Tooltip> : span
}

function AgreementRow({ children, onClick }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-raised) 85%, var(--text-primary) 15%)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-raised)'
      }}
      style={{
        display: 'flex', alignItems: 'stretch', gap: 12,
        padding: '8px 10px', borderRadius: 4,
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border-faint, var(--border))',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 120ms',
      }}
    >{children}</div>
  )
}

// Phase 18.1: subject-kind label map for the placeholder RELEASE tooltip.
// Mirrors the subject.kind discriminated union from architecture-spec §10.4
// (asset | claim | evalResult | parseResult) plus the Phase 13.1 'poe' extension.
const DA_SUBJECT_KIND_LABEL = {
  asset: 'Asset',
  claim: 'Claim',
  evalResult: 'Evaluation Result',
  parseResult: 'Parse Result',
  poe: 'Proof of Evaluation',
}

function DisclosureAgreementRow({
  da, activeParty, subjectName, onRowClick, onAmendDa, onRevokeDa,
  // Phase 9D.1.3 Fix 1: inline revocation block for Case B (grantor views
  // their own revoked DA — grantee terminated access). Mirrors the 9D.1.2
  // EA-row pattern. Populated when this DA is the one targeted by a
  // v22-da-revoked notification click AND the viewer is the grantor.
  expandedRevokedInfo = null,
  onDismissExpandedRevokedDa,
}) {
  const isInternal = da.grantor.party === da.grantee.party
  const isProofOfEval = da.subject?.kind === 'evalResult'
  const isGrantor = activeParty === da.grantor.party
  const isGrantee = activeParty === da.grantee.party
  const isProvisional = da.type === 'provisional'
  const isDeclined = !!da._declineMeta
  // Phase 9D.1 (#112 UX redo): revoked DAs appear in the Agreements Section
  // as dimmed rows with status "Revoked" and no action labels. 9D filtered
  // these out of the active list; the Claim panel now passes them through a
  // separate prop so the grantee can see pre-Dismiss context.
  const isRevoked = !!da._revokedMeta
  const typeKey = isProvisional ? 'provisional' : (da.type || 'full')
  const cfg = SDA_TYPE_CFG[typeKey] || SDA_TYPE_CFG.full

  // Counterparty label.
  let counterpartyLabel
  if (isInternal) counterpartyLabel = 'Internal'
  else if (da.grantor.party === activeParty) counterpartyLabel = `with ${da.grantee.party}`
  else if (da.grantee.party === activeParty) counterpartyLabel = `with ${da.grantor.party}`
  else counterpartyLabel = `${da.grantor.party} → ${da.grantee.party}`

  // Status text + color.
  // Phase 11E.1.4 Fix 2: active rows now show "Expires YYYY-MM-DD" (or
  // "Never expires") instead of "Active · {creationDate}" — matches the
  // EA-row pattern, since the row's presence in the active Agreements
  // section already implies active. Revoked / declined / provisional rows
  // keep their existing label + color + date.
  // Phase 11E.1.5 Fix 2: copy unification — "Never expires" replaces
  // the original "No expiry" so the no-expiration state reads identically
  // across DA rows, EA rows, edge tooltips, and amend modals.
  let statusText
  let statusColor = 'var(--text-tertiary)'
  if (isRevoked) {
    const dStr = formatShortDate(da._revokedMeta?.revokedDate)
    statusText = dStr ? `Revoked · ${dStr}` : 'Revoked'
    statusColor = 'var(--accent-red)'
  } else if (isDeclined) {
    const dStr = formatShortDate(da.terms?.createdDate)
    statusText = dStr ? `Declined · ${dStr}` : 'Declined'
    statusColor = 'var(--accent-red)'
  } else if (isProvisional) {
    const dStr = formatShortDate(da.terms?.createdDate)
    statusText = dStr ? `Provisional · ${dStr}` : 'Provisional'
    statusColor = 'var(--accent-amber)'
  } else {
    const expiresIso = da.terms?.expires
    statusText = expiresIso ? `Expires ${formatShortDate(expiresIso)}` : 'Never expires'
  }

  // Action visibility gating. Internal + proof-of-eval DAs hide both actions.
  // Revoked DAs suppress all actions (historical, no operations remain).
  // Phase 9D.1.1 (Fix 3): grantee may also revoke — either side can terminate
  // the agreement. Amend remains grantor-only (scope changes are the
  // grantor's prerogative).
  const actionsHidden = isInternal || isProofOfEval || isRevoked
  const showAmend = !actionsHidden && isGrantor && !isDeclined
  const showRevoke = !actionsHidden && (isGrantor || isGrantee) && !isProvisional && !isDeclined
  // Phase 18.1: placeholder RELEASE label on Internal DA rows. Disabled-only
  // surface; no handler. Tooltip noun resolves from the DA's own subject.kind
  // (not the panel's node type) so it accurately describes what releasing
  // THIS agreement would affect. Mutually exclusive with showAmend by
  // construction (showAmend requires !isInternal; showRelease requires
  // isInternal), so they share the slot-1 ternary safely.
  const showRelease = isInternal && !isRevoked
  const subjectLabel = DA_SUBJECT_KIND_LABEL[da.subject?.kind] || 'artifact'
  const amendLabel = isProvisional ? 'Respond' : 'Amend'

  const rowInner = (
    <AgreementRow onClick={isRevoked ? null : onRowClick}>
      {/* Left: type illustration + type label (Row 1) / subject name (Row 2) */}
      <div style={{ flex: '1.2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SdaLine type={typeKey} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
            {cfg.label}
          </span>
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }} title={subjectName || undefined}>
          {truncate(subjectName, 32)}
        </div>
      </div>
      {/* Middle: counterparty / status+date */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={counterpartyLabel}>
          {counterpartyLabel}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: statusColor, letterSpacing: '0.04em' }}>
          {statusText}
        </span>
      </div>
      {/* Right: actions (stacked) */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 52 }}>
        {showAmend ? (
          <ActionLabel
            label={amendLabel}
            onClick={onAmendDa ? () => onAmendDa(da) : undefined}
            title={isProvisional ? 'Open the response flow for this pending request' : 'Amend this Disclosure Agreement'}
          />
        ) : showRelease ? (
          /* Phase 18.1: placeholder RELEASE label on Internal DA rows.
             Disabled-only (var(--text-dim)); no onClick, no handler. */
          <ActionLabel
            label="Release"
            disabled
            title={`Releasing your disclosure agreement to this ${subjectLabel} will remove it from your network. Coming soon.`}
          />
        ) : <span style={{ height: 14 }} />}
        {/* Phase 9D (#112): Revoke is live — opens V22RevocationConfirmModal. */}
        {showRevoke ? (
          <ActionLabel
            label="Revoke"
            onClick={onRevokeDa ? () => onRevokeDa(da) : undefined}
            title="Revoke this Disclosure Agreement — terminates the counterparty's visibility"
          />
        ) : <span style={{ height: 14 }} />}
      </div>
    </AgreementRow>
  )

  // Phase 9D.1.3 Fix 1: scroll-to-row on notification click (Case B) AND
  // render the expanded inline revocation block beneath the row.
  const rowRef = useRef(null)
  const isExpanded = !!expandedRevokedInfo
  useEffect(() => {
    if (isExpanded && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [isExpanded])

  // Inline block: Case B — grantee-initiated DA revocation, grantor sees it.
  // Only Case B reaches this code path; Case A (grantee view) uses the
  // Claim-level Revocation Notice Section in the REVOKED Claim branch.
  const inlineBlock = isExpanded ? (() => {
    const info = expandedRevokedInfo
    const daTypeLabel = {
      full: 'full',
      selective: 'selective',
      proofonly: 'proof-only',
    }[info.daType] || 'full'
    // Phase 9D.1.4 Fix 3: substitute the grantee party name throughout the
    // copy instead of using "they/their" pronouns — reads more directly and
    // removes ambiguity about who's being discussed.
    const grantee = info.revokerParty
    const headerCopy = `${grantee} has revoked their ${daTypeLabel} disclosure access to this Claim.`
    const consequence = `${grantee} no longer has visibility into this Claim. The Evaluation Agreement with this Claim has also been terminated. Evaluation Results that ${grantee} previously produced remain in their Qualified Storage and on their network. Your Claim and its data remains on your network.`
    const dateStr = formatShortDate(info.revokedDate) || ''
    return (
      <div style={{
        marginTop: 6,
        padding: '10px 12px',
        background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
        borderRadius: 6,
      }}>
        <div style={{
          fontSize: 10, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)',
          fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          Disclosure Agreement Revoked{dateStr ? ` · ${dateStr}` : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {headerCopy}
        </div>
        <div style={{
          fontSize: 11, marginTop: 6,
          color: info.reason ? 'var(--text-secondary)' : 'var(--text-dim)',
          fontStyle: 'italic', lineHeight: 1.5,
        }}>
          {info.reason ? `"${info.reason}"` : '(No reason given)'}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 8,
        }}>
          {consequence}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (onDismissExpandedRevokedDa) onDismissExpandedRevokedDa(da.id)
            }}
            style={{
              padding: '6px 14px',
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--bg-deep)', background: 'var(--accent-indigo)',
              border: '1px solid var(--accent-indigo)', borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  })() : null

  // Phase 9D.1.3 Fix 1: outer wrapper follows the same pattern as
  // EvaluationAgreementRow — dim revoked rows by default; when expanded,
  // lift the dim so the inline Dismiss is clickable.
  const outerStyle = (isRevoked && !isExpanded)
    ? { opacity: 0.5, pointerEvents: 'none' }
    : null
  return (
    <div ref={rowRef} style={outerStyle}>
      {rowInner}
      {inlineBlock}
    </div>
  )
}

function EvaluationAgreementRow({
  ea, activeParty, claimName, onRowClick, onRevokeEa,
  // Phase 11E.1.3 Fix 1: inline AMEND wiring — same handler the EA Detail
  // Panel footer fires (`setV22AmendingEaId(ea.id)`). Three-branch gating
  // mirrors EvaluationAgreementDetailPanel.jsx's footer logic.
  onAmendEa,
  // Phase 9D.1.2 W1: inline revocation block for Cases C/D. Populated when
  // this EA is the one targeted by a v22-ea-revoked notification click.
  // Shape: { revokerParty, revokedDate, reason, cascadedFromDa }. When non-
  // null, the row renders an expanded red-tinted block beneath its content
  // with case-routed copy + inline Dismiss.
  expandedRevokedInfo,
  onDismissExpandedRevokedEa,
}) {
  const isGrantor = activeParty === ea.grantor.party
  const isGrantee = activeParty === ea.grantee.party
  const isInternal = ea.grantor.party === ea.grantee.party
  // Phase 9D.1: revoked EAs surface dimmed in the Revoked subsection.
  const isRevoked = !!ea._revokedMeta
  let counterpartyLabel
  if (isInternal) counterpartyLabel = 'Internal'
  else if (ea.grantor.party === activeParty) counterpartyLabel = `with ${ea.grantee.party}`
  else if (ea.grantee.party === activeParty) counterpartyLabel = `with ${ea.grantor.party}`
  else counterpartyLabel = `${ea.grantor.party} → ${ea.grantee.party}`

  // Phase 11E.1.2 Fix 1: read the correct EA schema field. The EA carries
  // `terms.evaluationDeadline` (spec §10.5) — `resultExpiry` is a separate
  // concept (when the eval RESULT itself expires post-evaluation), not the
  // EA's own expiration; `terms.expires` exists only on the DA schema.
  // Pre-fix the row always rendered "Never expires" and post-amend never
  // updated. Legacy fallbacks retained for migration safety.
  const expiresIso = ea.terms?.evaluationDeadline
    || ea.terms?.resultExpiry
    || ea.terms?.expires
    || null
  // Phase 9D.1.1 (Fix 2): revoked EAs show the revocation date beside the
  // Revoked status so the grantee/grantor sees *when* it happened.
  const revokedDate = ea._revokedMeta?.revokedDate
  const expiresStr = isRevoked
    ? (revokedDate ? `Revoked · ${formatShortDate(revokedDate)}` : 'Revoked')
    : (expiresIso ? `Expires ${formatShortDate(expiresIso)}` : 'Never expires')

  // Phase 9D.1.1 (Fix 3): grantee may also revoke EA.
  // Phase 11E.1.3 Fix 1: AMEND is now live (was placeholder pending #108
  // through Phase 11E.1; Phase 11E.1.3 wires the inline button to the
  // same handler the EA Detail Panel footer fires).
  // Phase 11E.1.4 Fix 1: AMEND is hidden entirely on revoked rows — matches
  // REVOKE's gating and the precedent set by DisclosureAgreementRow
  // (`actionsHidden = isInternal || isProofOfEval || isRevoked`). The
  // remaining two-branch gating mirrors EvaluationAgreementDetailPanel.jsx:
  //   • enabled  — isGrantor && active
  //   • disabled — !isGrantor → "Only {grantor} can amend…"
  // Phase 11.6 (#164): also disable AMEND while a prior proposal is
  // awaiting the grantee's response (status === 'pending-acceptance').
  // Mirrors the Detail Panel footer gating; spec §11.2b.
  const isPendingAcceptance = ea.status === 'pending-acceptance'
  const showAmend = !isInternal && !isRevoked
  const amendEnabled = isGrantor && !isPendingAcceptance
  const amendTooltip = !isGrantor
    ? `Only ${ea.grantor.party} (the grantor) can amend this agreement.`
    : isPendingAcceptance
      ? `Cannot amend: prior amendment proposal awaiting ${ea.grantee.party}'s response.`
      : 'Amend the expiration date and acknowledgments on this Evaluation Agreement.'
  const showRevoke = (isGrantor || isGrantee) && !isInternal && !isRevoked

  // Phase 9D.1.2 W1: scroll the row into view when it becomes the expanded-
  // revocation target. Fires once on mount (and again if the targeted id
  // changes to this row). `block: 'center'` centers vertically inside the
  // Detail Panel's scroll container.
  const rowRef = useRef(null)
  const isExpanded = !!expandedRevokedInfo
  useEffect(() => {
    if (isExpanded && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [isExpanded])

  const rowInner = (
    <AgreementRow onClick={isRevoked ? null : onRowClick}>
      <div style={{ flex: '1.2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
          Evaluation Agreement
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }} title={claimName || undefined}>
          {truncate(claimName, 32)}
        </div>
      </div>
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={counterpartyLabel}>
          {counterpartyLabel}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
          {expiresStr}
        </span>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 52 }}>
        {showAmend ? (
          <ActionLabel
            label="Amend"
            disabled={!amendEnabled}
            onClick={(amendEnabled && onAmendEa) ? () => onAmendEa(ea) : undefined}
            title={amendTooltip}
          />
        ) : <span style={{ height: 14 }} />}
        {/* Phase 9D (#112): Revoke is live for EAs too — opens the Confirm modal. */}
        {showRevoke ? (
          <ActionLabel
            label="Revoke"
            onClick={onRevokeEa ? () => onRevokeEa(ea) : undefined}
            title="Revoke this Evaluation Agreement — removes evaluation rights; historical results are preserved"
          />
        ) : <span style={{ height: 14 }} />}
      </div>
    </AgreementRow>
  )

  // Phase 9D.1.2 W1: inline revocation block — Cases C/D. Renders underneath
  // the standard row. Case routing is the same viewer-side + kind logic used
  // by `RevocationNoticeSection`, specialized to kind='EA' so only the C/D
  // copy variants apply.
  const inlineBlock = isExpanded ? (() => {
    const viewerIsGrantor = activeParty === ea.grantor.party
    const info = expandedRevokedInfo
    let headerCopy, consequence
    if (!viewerIsGrantor) {
      // Case C: grantor revoked your EA, you're the grantee.
      headerCopy = `${info.revokerParty} has revoked your Evaluation Agreement for this Claim.`
      consequence = 'You can still view this Claim under your existing Disclosure Agreement, but you can no longer run evaluations against it. Any Evaluation Results you previously submitted remain visible on your canvas.'
    } else {
      // Case D: grantee revoked their EA, you're the grantor.
      headerCopy = `${info.revokerParty} has revoked their Evaluation Agreement for this Claim.`
      consequence = 'They no longer have the ability to run evaluations against this Claim. Prior Evaluation Results remain visible on both canvases. Your Claim and its disclosure to them remain active.'
    }
    const dateStr = formatShortDate(info.revokedDate) || ''
    return (
      <div style={{
        marginTop: 6,
        padding: '10px 12px',
        background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
        borderRadius: 6,
      }}>
        <div style={{
          fontSize: 10, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)',
          fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          Evaluation Agreement Revoked{dateStr ? ` · ${dateStr}` : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {headerCopy}
        </div>
        <div style={{
          fontSize: 11, marginTop: 6,
          color: info.reason ? 'var(--text-secondary)' : 'var(--text-dim)',
          fontStyle: 'italic', lineHeight: 1.5,
        }}>
          {info.reason ? `"${info.reason}"` : '(No reason given)'}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 8,
        }}>
          {consequence}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (onDismissExpandedRevokedEa) onDismissExpandedRevokedEa(ea.id)
            }}
            style={{
              padding: '6px 14px',
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--bg-deep)', background: 'var(--accent-indigo)',
              border: '1px solid var(--accent-indigo)', borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  })() : null

  // Wrap in rowRef container so scrollIntoView can target the full row
  // (including any inline block beneath it). Revoked rows dim by default,
  // but when expanded (Cases C/D), the row lifts back to full opacity and
  // pointer-events so the inline Dismiss is clickable. Dimming the row
  // above the revocation block would read as "this isn't actionable."
  const outerStyle = (isRevoked && !isExpanded)
    ? { opacity: 0.5, pointerEvents: 'none' }
    : null
  return (
    <div ref={rowRef} style={outerStyle}>
      {rowInner}
      {inlineBlock}
    </div>
  )
}

function AgreementsSection({
  disclosureAgreements = [],
  evaluationAgreements = [],
  // Phase 9D.1 (#112 UX redo): revoked DAs + EAs render as dimmed rows in a
  // "Revoked" subsection below the active agreements. Grantee-side pre-
  // Dismiss context only — grantor side (no revoked artifact) skips this.
  revokedDisclosureAgreements = [],
  revokedEvaluationAgreements = [],
  // Phase 9D.1.2 W1: inline EA revocation pattern (Cases C/D). When
  // `expandedRevokedEaId` matches a revoked EA row, that row renders its
  // inline red block with the payload from `expandedRevokedEaInfo` and a
  // Dismiss button wired to `onDismissExpandedRevokedEa`.
  expandedRevokedEaId = null,
  expandedRevokedEaInfo = null,
  onDismissExpandedRevokedEa,
  // Phase 9D.1.3 Fix 1: inline DA revocation pattern (Case B — grantor view
  // of grantee-initiated DA revocation). Same mechanic applied to DAs.
  expandedRevokedDaId = null,
  expandedRevokedDaInfo = null,
  onDismissExpandedRevokedDa,
  activeParty,
  resolveSubjectName,
  resolveClaimName,
  onRowClick,
  onAmendDa,
  // Phase 11E.1.3 Fix 1: inline EA amend handler — same as the EA Detail
  // Panel footer's onAmend (V2App's `setV22AmendingEaId(ea.id)`).
  onAmendEa,
  onRevokeDa,
  onRevokeEa,
}) {
  const das = disclosureAgreements
  const eas = evaluationAgreements
  const revokedDas = revokedDisclosureAgreements
  const revokedEas = revokedEvaluationAgreements
  if (das.length === 0 && eas.length === 0 && revokedDas.length === 0 && revokedEas.length === 0) return null

  const subHeadingStyle = {
    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
    letterSpacing: '0.08em', color: 'var(--text-tertiary)',
    marginBottom: 6, marginTop: 4, textTransform: 'uppercase',
  }

  return (
    <Section title="Agreements">
      {das.length > 0 && (
        <div style={{ marginBottom: eas.length > 0 ? 14 : 0 }}>
          <div style={subHeadingStyle}>Disclosure Agreements ({das.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {das.map((da) => (
              <DisclosureAgreementRow
                key={da.id}
                da={da}
                activeParty={activeParty}
                subjectName={resolveSubjectName ? resolveSubjectName(da.subject) : null}
                onRowClick={onRowClick ? () => onRowClick('disclosure', da) : undefined}
                onAmendDa={onAmendDa}
                onRevokeDa={onRevokeDa}
                expandedRevokedInfo={expandedRevokedDaId === da.id ? expandedRevokedDaInfo : null}
                onDismissExpandedRevokedDa={onDismissExpandedRevokedDa}
              />
            ))}
          </div>
        </div>
      )}
      {eas.length > 0 && (
        <div style={{ marginBottom: (revokedDas.length > 0 || revokedEas.length > 0) ? 14 : 0 }}>
          <div style={subHeadingStyle}>Evaluation Agreements ({eas.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {eas.map((ea) => (
              <EvaluationAgreementRow
                key={ea.id}
                ea={ea}
                activeParty={activeParty}
                claimName={resolveClaimName ? resolveClaimName(ea.claimId) : null}
                onRowClick={onRowClick ? () => onRowClick('evaluation', ea) : undefined}
                onAmendEa={onAmendEa}
                onRevokeEa={onRevokeEa}
                expandedRevokedInfo={expandedRevokedEaId === ea.id ? expandedRevokedEaInfo : null}
                onDismissExpandedRevokedEa={onDismissExpandedRevokedEa}
              />
            ))}
          </div>
        </div>
      )}
      {(revokedDas.length > 0 || revokedEas.length > 0) && (
        <div>
          <div style={subHeadingStyle}>Revoked ({revokedDas.length + revokedEas.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {revokedDas.map((da) => (
              <DisclosureAgreementRow
                key={da.id}
                da={da}
                activeParty={activeParty}
                subjectName={resolveSubjectName ? resolveSubjectName(da.subject) : null}
                expandedRevokedInfo={expandedRevokedDaId === da.id ? expandedRevokedDaInfo : null}
                onDismissExpandedRevokedDa={onDismissExpandedRevokedDa}
                /* Revoked rows are informational — no row click, no actions (except the expanded inline block). */
              />
            ))}
            {revokedEas.map((ea) => (
              <EvaluationAgreementRow
                key={ea.id}
                ea={ea}
                activeParty={activeParty}
                claimName={resolveClaimName ? resolveClaimName(ea.claimId) : null}
                expandedRevokedInfo={expandedRevokedEaId === ea.id ? expandedRevokedEaInfo : null}
                onDismissExpandedRevokedEa={onDismissExpandedRevokedEa}
              />
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

/* ─── Anchored RFPs (Phase 17.5.1.5) ─────────────────────────────────────
   Parent-canvas surface for managing RFPs anchored to an Asset (RFPs live on
   the Directory layer, so the Asset Detail Panel is the only parent-canvas
   place to see + manage them). Mirrors the AgreementsSection row pattern:
   a clickable identity area (navigates to the RFP's Detail Panel on the
   Directory layer) + owner-only inline lifecycle ActionLabels on the right. */
function RfpStatusPill({ closed }) {
  const base = {
    fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
    letterSpacing: '0.1em', padding: '1px 5px', borderRadius: 3, flexShrink: 0,
  }
  if (closed) {
    // Muted treatment matching the closed-RFP marker / RfpDetailPanel CLOSED badge.
    return <span style={{ ...base, color: 'var(--text-tertiary)', border: '1px solid var(--border)', background: 'var(--bg-deep)' }}>CLOSED</span>
  }
  return <span style={{ ...base, color: 'var(--accent-green)', border: '1px solid color-mix(in srgb, var(--accent-green) 40%, var(--border))', background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-raised))' }}>OPEN</span>
}

function AssetPanelRfpRow({ rfp, isOwner, onOpenRfp, onCloseRfp, onReopenRfp, onRemoveRfp }) {
  const isClosed = rfp.status === 'closed'
  const reqCount = Array.isArray(rfp.requirementsSetIds) ? rfp.requirementsSetIds.length : 0
  return (
    <AgreementRow onClick={onOpenRfp ? () => onOpenRfp(rfp.id) : undefined}>
      {/* Left: identity (clickable via the row) */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }} title={rfp.name}>{rfp.name || '(Unnamed RFP)'}</span>
          <RfpStatusPill closed={isClosed} />
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
          Posted {formatDateTime(rfp.createdDate)}{reqCount ? ` · ${reqCount} requirement${reqCount === 1 ? '' : 's'}` : ''}
        </div>
      </div>
      {/* Right: owner-only lifecycle actions. Phase 17.5.2.1: text-only labels
          (icons dropped); when both Reopen + Remove render (closed RFP) they
          stack vertically, matching the AMEND/REVOKE column on EA rows above
          (flexDirection column, flex-end, gap 4, minWidth 52). Open RFP shows
          a single Close label in the same column. */}
      {isOwner && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 52 }}>
          {!isClosed && (
            <ActionLabel
              label="Close"
              onClick={onCloseRfp ? () => onCloseRfp(rfp) : undefined}
              title="Close this RFP"
            />
          )}
          {isClosed && (
            <>
              <ActionLabel
                label="Reopen"
                onClick={onReopenRfp ? () => onReopenRfp(rfp) : undefined}
                title="Reopen this RFP"
              />
              <ActionLabel
                label="Remove"
                danger
                onClick={onRemoveRfp ? () => onRemoveRfp(rfp) : undefined}
                title="Permanently remove this RFP. Open solicitations will also be removed. This action cannot be undone."
              />
            </>
          )}
        </div>
      )}
    </AgreementRow>
  )
}

function AnchoredRfpsSection({ anchoredRfps = [], activeParty, onOpenRfp, onCloseRfp, onReopenRfp, onRemoveRfp }) {
  return (
    <Section title="Anchored RFPs">
      {anchoredRfps.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
          No RFPs anchored to this Asset.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {anchoredRfps.map((rfp) => (
            <AssetPanelRfpRow
              key={rfp.id}
              rfp={rfp}
              isOwner={activeParty === rfp.owner}
              onOpenRfp={onOpenRfp}
              onCloseRfp={onCloseRfp}
              onReopenRfp={onReopenRfp}
              onRemoveRfp={onRemoveRfp}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

/* ─── Router ──────────────────────────────────────────────────────────── */
export default function V22NodeDetailPanel(props) {
  const { node } = props
  if (!node) return null
  switch (node.v22Type) {
    case 'ACTOR': return <V22ActorPanel {...props} />
    case 'ASSET': return <V22AssetPanel {...props} />
    case 'CLAIM': return <V22ClaimPanel {...props} />
    case 'PARSE RESULT': return <V22ParseResultPanel {...props} />
    case 'EVAL RESULT': return <V22EvalResultPanel {...props} />
    case 'PROOF OF EVALUATION': return <V22PoEPanel {...props} />
    // Phase 14.0 (#169 part 1): forward-looking router entry. Phase 14.1's
    // Badge Issuance work may surface Badge Templates as a node type; until
    // then this branch only triggers if a caller wraps a template artifact
    // in a node-shaped envelope (`{ v22Type: 'BADGE TEMPLATE', v22Artifact: template, ... }`).
    case 'BADGE TEMPLATE':
      return (
        <V22BadgeTemplatePanel
          template={node.v22Artifact}
          activeParty={props.activeParty}
          onClose={props.onClose}
          onNewVersion={props.onNewVersion}
          onSelectRequirementsSet={props.onSelectRequirementsSet}
          onExpand={props.onExpand}
          allRequirementSets={props.allRequirementSets}
          activeIssuances={props.activeIssuances}
          lineageActiveIssuanceCount={props.lineageActiveIssuanceCount}
          poeNameLookup={props.poeNameLookup}
          onSelectBadgeIssuance={props.onSelectBadgeIssuance}
        />
      )
    // Phase 14.2 (#169b): the 'BADGE ISSUANCE' router case has been
    // removed — Badge Issuances are no longer represented as standalone
    // Detail Panels. Row clicks open the expand modal directly.
    default: return null
  }
}
