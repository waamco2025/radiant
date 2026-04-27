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

import { useEffect, useRef } from 'react'
import CopyBadge from './shared/CopyBadge'
import Tooltip from '../Tooltip'

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

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        letterSpacing: '0.12em', color: 'var(--text-tertiary)',
        marginBottom: 8, textTransform: 'uppercase',
      }}>{title}</div>
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

function FooterButton({ label, onClick, accent, danger, amber, disabled, title }) {
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

function PanelHeader({ typeLabel, name, pin, onClose, badge }) {
  return (
    <div style={{ padding: '18px 18px 14px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          letterSpacing: '0.12em', color: 'var(--text-tertiary)', textTransform: 'uppercase',
          padding: '2px 6px', background: TYPE_BADGE_BG, borderRadius: 3,
        }}>{typeLabel}</span>
        {badge}
        <div style={{ flex: 1 }} />
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
  onRevokeDa,
  onRevokeEa,
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
          <AgreementsSection
            disclosureAgreements={disclosureAgreementsForNode}
            evaluationAgreements={evaluationAgreementsForNode}
            activeParty={activeParty}
            resolveSubjectName={resolveSubjectName}
            resolveClaimName={resolveClaimName}
            onRowClick={onAgreementRowClick}
            onAmendDa={onAmendDa}
            onRevokeDa={onRevokeDa}
            onRevokeEa={onRevokeEa}
          />
        </>
      }
      footer={
        isOwner && onRegisterAsset ? (
          <FooterButton label="Register Asset" accent onClick={onRegisterAsset} title="Register a new Asset from a file in your Qualified Storage." />
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
  parseResultsForAsset = [],
  childAssets = [],
  parentAsset = null,
  onSelectAsset,
  disclosureAgreementsForNode = [],
  evaluationAgreementsForNode = [],
  resolveSubjectName,
  resolveClaimName,
  onAgreementRowClick,
  onAmendDa,
  onRevokeDa,
  onRevokeEa,
}) {
  const asset = node.v22Artifact
  const isOwner = activeParty === node.owner
  // Phase 9A.4 Gate B: while a transfer is pending the owner can only
  // cancel. Post-accept the Asset moves off this canvas entirely; pre-accept
  // the other actions would be ambiguous under a change of ownership.
  const isPendingTransfer = !!node._pendingTransfer
  return (
    <PanelLayout
      header={<PanelHeader typeLabel="ASSET" name={node.name} pin={node.pin} onClose={onClose} />}
      body={
        <>
          {asset?.description && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{asset.description}</div>
          )}
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
            <Row label="DOT" value={asset?.dot?.pin ? <CopyBadge value={asset.dot.pin} truncated /> : '—'} />
          </Section>
          <Section title="File">
            <Row label="Filename" value={asset?.file?.filename} mono />
            <Row label="Size" value={formatBytes(asset?.file?.size)} />
            <Row label="MIME" value={asset?.file?.mimeType} mono />
            <Row label="Hash" value={asset?.file?.hash ? <CopyBadge value={asset.file.hash} truncated /> : '—'} />
            <Row label="URI" value={asset?.file?.uri ? <CopyBadge value={asset.file.uri} truncated /> : '—'} />
          </Section>
          <Section title="Registration">
            <Row label="Registered" value={formatDateTime(asset?.registrationDate)} />
            <Row label="Parse Results" value={parseResultsForAsset.length} />
          </Section>
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
            onRevokeDa={onRevokeDa}
            onRevokeEa={onRevokeEa}
          />
        </>
      }
      footer={
        isOwner ? (
          isPendingTransfer ? (
            <FooterButton label="Cancel Transfer" danger onClick={onCancelTransfer} title="Withdraw the pending transfer — no ledger record, recipient notification dismisses." />
          ) : (
            <>
              {/* Phase 10.2: Register child Asset under this Asset. Five-button
                  footer is intentionally crowded for now — auto-collapsing
                  affordance is a future polish phase. */}
              <FooterButton label="Register Asset" onClick={onRegisterChildAsset} disabled={!onRegisterChildAsset} title="Register a new Asset as a child of this Asset" />
              <FooterButton label="Request Agreement" accent onClick={onRequestAgreement} title="Request a Disclosure + Evaluation Agreement anchored to this Asset" />
              <FooterButton label="Parse Evidence" onClick={onParseEvidence} disabled={!onParseEvidence} title="Extract structured fields from this Asset using a PEP template" />
              <FooterButton label="Create Claim" onClick={onCreateClaim} disabled={!onCreateClaim} title="Create a Claim referencing this Asset" />
              <FooterButton label="Transfer" onClick={onTransferAsset} disabled={!onTransferAsset} title="Transfer ownership of this Asset to another actor" />
            </>
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
  referencedAssetNames = [],
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
        header={<PanelHeader typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} badge={awaitingBadge} />}
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
            <FooterButton label="Respond to Request" amber onClick={onRespondToRequest} />
          ) : (
            <FooterButton label="Cancel Request" danger onClick={onCancelRequest} title="Withdraw the pending request — both provisional artifacts will be removed." />
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
        header={<PanelHeader typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} badge={declinedBadge} />}
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
        footer={<FooterButton label="Dismiss" onClick={onDismissDeclined} title="Remove the declined Claim from your canvas." />}
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
        header={<PanelHeader typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} badge={revokedBadge} />}
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
        footer={<FooterButton label="Dismiss" accent onClick={onDismissRevoked} title="Remove the revoked Claim and its paired Evaluation Agreement from your canvas. Your Evaluation Results remain in your Qualified Storage and stay on your canvas — dismiss them individually from each Evaluation Result's Detail Panel if you wish. Historical records are preserved for audit." />}
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
      header={<PanelHeader typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} />}
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
          {claim?.description && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{claim.description}</div>
          )}
          <Section title="Owner">
            <Row label="Party" value={node.owner} />
            <Row label="Created" value={formatDateTime(claim?.createdDate)} />
          </Section>
          <Section title={`Referenced Assets (${claim?.referencedAssetIds?.length || 0})`}>
            {referencedAssetNames.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No referenced Assets.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {referencedAssetNames.map((n) => (
                  <div key={n.id} style={{ fontSize: 12, color: 'var(--text-primary)', padding: '4px 6px', background: 'var(--bg-raised)', borderRadius: 3 }}>
                    {n.name}
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section title={`Evaluation Results (${evaluationResultsForClaim.length})`}>
            {evaluationResultsForClaim.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No evaluations run yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {evaluationResultsForClaim.map((er) => {
                  const isSuper = er.status === 'superseded'
                  const ok = er.results.filter(r => r.status === 'satisfactory').length
                  const bad = er.results.filter(r => r.status === 'unsatisfactory').length
                  return (
                    <div key={er.id} style={{
                      fontSize: 11, color: isSuper ? 'var(--text-dim)' : 'var(--text-primary)',
                      padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 3,
                      opacity: isSuper ? 0.6 : 1,
                    }}>
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
        const hasOwnerActions = isOwner
        const hasEvalAction = !isOwner && !!evaluationAgreementForActor
        if (!noticeForPanel && !hasOwnerActions && !hasEvalAction) return null
        return (
          <>
            {noticeForPanel && (
              <FooterButton label="Dismiss" onClick={onDismissRevocationNotice} title="Dismiss this revocation notice. Your Claim and any remaining agreements are unaffected." />
            )}
            {hasOwnerActions ? (
              <>
                <FooterButton label="Amend Claim" onClick={onAmendClaim} disabled={!onAmendClaim} title="Add Asset references to this Claim." />
                {onSelfEvaluate && (
                  <FooterButton label="Self-Evaluate" accent onClick={onSelfEvaluate} title="Run an evaluation against this Claim under your own authority — no Evaluation Agreement required." />
                )}
              </>
            ) : hasEvalAction ? (
              <FooterButton label="Run Evaluation" accent onClick={onRunEvaluation} title={`Run an evaluation under EA ${evaluationAgreementForActor.id}`} />
            ) : null}
          </>
        )
      })()}
    />
  )
}

/* ─── Parse Result Panel ──────────────────────────────────────────────── */
function V22ParseResultPanel({ node, onClose, sourceAsset }) {
  const pr = node.v22Artifact
  return (
    <PanelLayout
      header={<PanelHeader typeLabel="PARSE RESULT" name={node.name} pin={node.pin} onClose={onClose} />}
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
        </>
      }
    />
  )
}

/* ─── Eval Result Panel ───────────────────────────────────────────────── */
function V22EvalResultPanel({
  node, activeParty, onClose, onReRunEvaluation,
  // Phase 9D.1.3 Fix 6: orphaned Eval Result — backing DA or EA has been
  // revoked. When true, the footer swaps from Re-Run Evaluation to Dismiss
  // (with inline confirmation copy explaining that the artifact stays in QS
  // but leaves the canvas view).
  isOrphaned = false,
  onDismissOrphanedEvalResult,
}) {
  const er = node.v22Artifact
  const isOwner = activeParty === node.owner
  const isSuperseded = er?.status === 'superseded'
  const supersededBadge = isSuperseded ? (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
      color: 'var(--text-dim)', background: 'var(--bg-raised)',
    }}>SUPERSEDED</span>
  ) : null
  return (
    <PanelLayout
      header={<PanelHeader typeLabel="EVAL RESULT" name={node.name} pin={node.pin} onClose={onClose} badge={supersededBadge} />}
      body={
        <>
          <Section title="Evaluator">
            <Row label="Party" value={node.owner} />
            <Row label="Evaluated" value={formatDateTime(er?.evaluationDate)} />
            <Row label="Agreement" value={er?.evaluationAgreementId} mono />
          </Section>
          <Section title="Requirements Set">
            <Row label="Name" value={er?.requirementsSet?.name} />
            <Row label="ID" value={er?.requirementsSet?.id} mono />
            <Row label="Version" value={`v${er?.requirementsSet?.version ?? 1}`} />
          </Section>
          <Section title={`Results (${er?.results?.length || 0})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(er?.results || []).map((r) => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.missing
                return (
                  <div key={r.requirementId} style={{ padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 3 }}>
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
          </Section>
          {isSuperseded && er?.supersededBy && (
            <Section title="Supersession">
              <Row label="Superseded by" value={er.supersededBy} mono />
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
              label="Dismiss"
              accent
              onClick={() => onDismissOrphanedEvalResult && onDismissOrphanedEvalResult(er)}
              title="Remove this orphaned Evaluation Result from your canvas. The artifact stays in your QS."
            />
          )
        }
        if (onReRunEvaluation) {
          return <FooterButton label="Re-run Evaluation" accent onClick={onReRunEvaluation} title="Run a new evaluation; this result will be marked superseded." />
        }
        return null
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

function ActionLabel({ label, onClick, disabled, title }) {
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
        e.currentTarget.style.color = 'var(--accent-indigo)'
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      style={{
        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: disabled ? 'var(--text-dim)' : 'var(--text-primary)',
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

  // Status label.
  let statusLabel
  let statusColor = 'var(--text-tertiary)'
  if (isRevoked) { statusLabel = 'Revoked'; statusColor = 'var(--accent-red)' }
  else if (isDeclined) { statusLabel = 'Declined'; statusColor = 'var(--accent-red)' }
  else if (isProvisional) { statusLabel = 'Provisional'; statusColor = 'var(--accent-amber)' }
  else { statusLabel = 'Active'; statusColor = 'var(--accent-green)' }
  // Phase 9D.1.1 (Fix 2): show the revocation date on revoked rows rather
  // than the DA's original createdDate — that's what the user cares about
  // once the agreement is terminal.
  const dateStr = isRevoked
    ? formatShortDate(da._revokedMeta?.revokedDate)
    : formatShortDate(da.terms?.createdDate)

  // Action visibility gating. Internal + proof-of-eval DAs hide both actions.
  // Revoked DAs suppress all actions (historical, no operations remain).
  // Phase 9D.1.1 (Fix 3): grantee may also revoke — either side can terminate
  // the agreement. Amend remains grantor-only (scope changes are the
  // grantor's prerogative).
  const actionsHidden = isInternal || isProofOfEval || isRevoked
  const showAmend = !actionsHidden && isGrantor && !isDeclined
  const showRevoke = !actionsHidden && (isGrantor || isGrantee) && !isProvisional && !isDeclined
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
          {statusLabel}{dateStr ? ` · ${dateStr}` : ''}
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

  const expiresIso = ea.terms?.resultExpiry || ea.terms?.expires || null
  // Phase 9D.1.1 (Fix 2): revoked EAs show the revocation date beside the
  // Revoked status so the grantee/grantor sees *when* it happened.
  const revokedDate = ea._revokedMeta?.revokedDate
  const expiresStr = isRevoked
    ? (revokedDate ? `Revoked · ${formatShortDate(revokedDate)}` : 'Revoked')
    : (expiresIso ? `Expires ${formatShortDate(expiresIso)}` : 'Never expires')

  // Phase 9D.1.1 (Fix 3): grantee may also revoke EA; Amend stays grantor-
  // only (placeholder pending #108).
  const showAmend = isGrantor && !isInternal && !isRevoked
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
          <ActionLabel label="Amend" disabled title="Amend Evaluation Agreements coming soon" />
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
    default: return null
  }
}
