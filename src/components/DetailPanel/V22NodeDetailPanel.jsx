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
function V22ActorPanel({ node, activeParty, onClose, onRegisterAsset, ownedAssetCount = 0 }) {
  const actor = node.v22Artifact
  const isOwner = activeParty === node.name && !node.isNetworkNode
  return (
    <PanelLayout
      header={<PanelHeader typeLabel="ACTOR" name={node.name} pin={node.pin} onClose={onClose} />}
      body={
        <>
          <Section title="Party">
            <Row label="Name" value={node.name} />
            <Row label="DOT" value={node.dot} mono />
            {actor?.role && <Row label="Role" value={actor.role} />}
            {actor?.vertical && <Row label="Vertical" value={actor.vertical} />}
            {actor?.user && <Row label="User" value={actor.user} />}
          </Section>
          <Section title="Assets">
            <Row label="Registered" value={ownedAssetCount} />
          </Section>
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
function V22AssetPanel({ node, activeParty, onClose, onRequestAgreement, onCreateClaim, onParseEvidence, parseResultsForAsset = [] }) {
  const asset = node.v22Artifact
  const isOwner = activeParty === node.owner
  return (
    <PanelLayout
      header={<PanelHeader typeLabel="ASSET" name={node.name} pin={node.pin} onClose={onClose} />}
      body={
        <>
          {asset?.description && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{asset.description}</div>
          )}
          <Section title="Owner">
            <Row label="Party" value={node.owner} />
            {/* Phase 9A.4 preamble (feature 3): long identifiers render as
                truncated click-to-copy badges, matching the PIN treatment
                elsewhere in the app. Owner DOT is the party-level hash; the
                Asset has no distinct DOT per spec §3.2 — the file hash below
                is the true per-Asset cryptographic identifier. */}
            <Row label="DOT" value={node.dot ? <CopyBadge value={node.dot} truncated /> : '—'} />
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
        </>
      }
      footer={
        isOwner ? (
          <>
            <FooterButton label="Request Agreement" accent onClick={onRequestAgreement} title="Request a Disclosure + Evaluation Agreement anchored to this Asset" />
            <FooterButton label="Parse Evidence" onClick={onParseEvidence} disabled={!onParseEvidence} title="Extract structured fields from this Asset using a PEP template" />
            <FooterButton label="Create Claim" onClick={onCreateClaim} disabled={!onCreateClaim} title="Create a Claim referencing this Asset" />
          </>
        ) : null
      }
    />
  )
}

/* ─── Claim Panel (covers active / provisional / declined sub-states) ─── */
function V22ClaimPanel({
  node, activeParty, onClose,
  onRespondToRequest, onCancelRequest, onDismissDeclined,
  onRunEvaluation,
  onAmendClaim,
  onSelfEvaluate,
  referencedAssetNames = [],
  evaluationResultsForClaim = [],
  evaluationAgreementForActor,
}) {
  const claim = node.v22Artifact
  const isOwner = activeParty === node.owner
  const isProvisional = !!node.isProvisional
  const isDeclined = !!node.isDeclined
  const declineRecord = node._declineRecord
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
