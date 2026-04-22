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
  parseResultsForAsset = [],
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

  // ── Disclosure Revoked state (Phase 9D / #112) ───────────────────────
  // Grantor-initiated DA revocation path. The Claim stays pulled in on the
  // grantee's canvas (with REVOKED badge) until they click Dismiss. Pattern-
  // matches the DECLINED state above, with copy adapted to revocation
  // semantics and a red-accented reason block that surfaces the revoker's
  // reason inline.
  if (isRevoked) {
    const revokedBadge = (
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
        color: 'var(--bg-deep)', background: 'var(--accent-red)',
      }}>REVOKED</span>
    )
    return (
      <PanelLayout
        header={<PanelHeader typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} badge={revokedBadge} />}
        body={
          <>
            <Section title="Revocation">
              <Row label="Revoked by" value={revokeRecord?.revokerParty || revokeRecord?.grantorParty || node.owner} />
              <Row label="Revoked" value={formatDateTime(revokeRecord?.revokedDate)} />
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Reason</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {revokeRecord?.reason
                    ? `"${revokeRecord.reason}"`
                    : <em style={{ color: 'var(--text-dim)' }}>No reason given.</em>}
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Dismissing will remove this Claim and any Eval Results you produced under the revoked agreement from your canvas. Historical records are preserved for audit.
              </div>
            </Section>
            <Section title="Claim">
              <Row label="Description" value={claim?.description || '—'} />
            </Section>
          </>
        }
        footer={<FooterButton label="Dismiss" onClick={onDismissRevoked} title="Remove the revoked Claim (and cascade-revoked EA + Eval Results) from your canvas." />}
      />
    )
  }

  // ── Standard Claim panel ────────────────────────────────────────────
  return (
    <PanelLayout
      header={<PanelHeader typeLabel="CLAIM" name={node.name} pin={node.pin} onClose={onClose} />}
      body={
        <>
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
        // Owner: Amend Claim + (optional) Self-Evaluate.
        // Non-owner with active EA: Run Evaluation.
        isOwner ? (
          <>
            <FooterButton label="Amend Claim" onClick={onAmendClaim} disabled={!onAmendClaim} title="Add Asset references to this Claim." />
            {onSelfEvaluate && (
              <FooterButton label="Self-Evaluate" accent onClick={onSelfEvaluate} title="Run an evaluation against this Claim under your own authority — no Evaluation Agreement required." />
            )}
          </>
        ) : evaluationAgreementForActor ? (
          <FooterButton label="Run Evaluation" accent onClick={onRunEvaluation} title={`Run an evaluation under EA ${evaluationAgreementForActor.id}`} />
        ) : null
      }
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
function V22EvalResultPanel({ node, activeParty, onClose, onReRunEvaluation }) {
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
        </>
      }
      footer={
        isOwner && !isSuperseded && onReRunEvaluation ? (
          <FooterButton label="Re-run Evaluation" accent onClick={onReRunEvaluation} title="Run a new evaluation; this result will be marked superseded." />
        ) : null
      }
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
}) {
  const isInternal = da.grantor.party === da.grantee.party
  const isProofOfEval = da.subject?.kind === 'evalResult'
  const isGrantor = activeParty === da.grantor.party
  const isProvisional = da.type === 'provisional'
  const isDeclined = !!da._declineMeta
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
  if (isDeclined) { statusLabel = 'Declined'; statusColor = 'var(--accent-red)' }
  else if (isProvisional) { statusLabel = 'Provisional'; statusColor = 'var(--accent-amber)' }
  else { statusLabel = 'Active'; statusColor = 'var(--accent-green)' }
  const dateStr = formatShortDate(da.terms?.createdDate)

  // Action visibility gating. Internal + proof-of-eval DAs hide both actions.
  const actionsHidden = isInternal || isProofOfEval
  const showAmend = !actionsHidden && isGrantor && !isDeclined
  const showRevoke = !actionsHidden && isGrantor && !isProvisional && !isDeclined
  const amendLabel = isProvisional ? 'Respond' : 'Amend'

  return (
    <AgreementRow onClick={onRowClick}>
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
}

function EvaluationAgreementRow({
  ea, activeParty, claimName, onRowClick, onRevokeEa,
}) {
  const isGrantor = activeParty === ea.grantor.party
  const isInternal = ea.grantor.party === ea.grantee.party
  let counterpartyLabel
  if (isInternal) counterpartyLabel = 'Internal'
  else if (ea.grantor.party === activeParty) counterpartyLabel = `with ${ea.grantee.party}`
  else if (ea.grantee.party === activeParty) counterpartyLabel = `with ${ea.grantor.party}`
  else counterpartyLabel = `${ea.grantor.party} → ${ea.grantee.party}`

  const expiresIso = ea.terms?.resultExpiry || ea.terms?.expires || null
  const expiresStr = expiresIso ? `Expires ${formatShortDate(expiresIso)}` : 'Never expires'

  const showAmend = isGrantor && !isInternal
  const showRevoke = isGrantor && !isInternal

  return (
    <AgreementRow onClick={onRowClick}>
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
}

function AgreementsSection({
  disclosureAgreements = [],
  evaluationAgreements = [],
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
  if (das.length === 0 && eas.length === 0) return null

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
              />
            ))}
          </div>
        </div>
      )}
      {eas.length > 0 && (
        <div>
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
