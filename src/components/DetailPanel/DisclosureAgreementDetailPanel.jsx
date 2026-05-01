// Disclosure Agreement Detail Panel — spec §3/§4/§10.4.
// Opens when an Agreement Edge is clicked (either directly or via EdgeMenu).
//
// Handles all DA variants uniformly per §4.1:
//   • Inter-party → reads as a {type} Disclosure from {grantor} to {grantee}.
//   • Internal ownership (grantor===grantee) → reads "Internal — {party} to {party}".
//   • Proof-of-Evaluation → reads as "Full Disclosure of the Eval Result artifact,
//     from {evaluator} to {claim owner}".
//   • Public-directory → reads as a {type} Disclosure to the Radiant Network.
//
// Amend button is always present in the footer. Enabled only when the active
// actor is the grantor; otherwise rendered disabled with a tooltip. Actual
// amendment flow is Phase 6; this panel only surfaces the action, per the
// Phase 3 acceptance criterion ("... with Amend action (if grantor)").

import CopyBadge from './shared/CopyBadge'
import Tooltip from '../Tooltip'

const DISCLOSURE_TYPE_COLOR = {
  full: 'var(--accent-indigo)',
  selective: 'var(--accent-amber)',
  proofonly: 'var(--accent-green)',
  provisional: 'var(--text-dim)',
  expired: 'var(--text-dim)',
}

const DISCLOSURE_TYPE_LABEL = {
  full: 'Full',
  selective: 'Selective',
  proofonly: 'Proof-Only',
  provisional: 'Provisional',
  expired: 'Expired',
}

const SUBJECT_KIND_LABEL = {
  asset: 'Asset',
  claim: 'Claim',
  evalResult: 'Evaluation Result',
  parseResult: 'Parse Result',
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

export default function DisclosureAgreementDetailPanel({
  agreement,
  resolveNodeName, // (id) => string | null — used to look up subject / grantee asset names
  activeParty,
  onClose,
  onAmend,
  onRevoke, // Phase 9D.1.1 (Fix 4): opens V22RevocationConfirmModal
  onViewEvaluationAgreement, // passed when a paired EA exists
}) {
  if (!agreement) return null

  const isInternal = agreement.grantor.party === agreement.grantee.party
  const isPublic = agreement.grantee.party === 'Radiant Network'
  const isProofOfEval = agreement.subject.kind === 'evalResult' && !isInternal
  const isGrantor = activeParty && activeParty === agreement.grantor.party
  // Phase 9D.1.1 (Fix 3 + Fix 4): grantee may revoke; agreement row already
  // reflects this. The DA Detail Panel footer now mirrors that symmetry.
  const isGrantee = activeParty && activeParty === agreement.grantee.party
  const isRevoked = !!agreement._revokedMeta

  // Header label — what kind of disclosure this is.
  const kindLabel = isInternal
    ? `Internal — ${agreement.grantor.party} to ${agreement.grantee.party}`
    : isPublic
      ? `${DISCLOSURE_TYPE_LABEL[agreement.type] || agreement.type} · Public Directory`
      : isProofOfEval
        ? `Proof of Evaluation · ${agreement.grantor.party} → ${agreement.grantee.party}`
        : `${DISCLOSURE_TYPE_LABEL[agreement.type] || agreement.type} · ${agreement.grantor.party} → ${agreement.grantee.party}`

  const typeColor = DISCLOSURE_TYPE_COLOR[agreement.type] || 'var(--text-primary)'
  const subjectName = resolveNodeName?.(agreement.subject.id) || agreement.subject.id
  const granteeAssetName = agreement.granteeAssetId
    ? (resolveNodeName?.(agreement.granteeAssetId) || agreement.granteeAssetId)
    : null

  const isProvisional = agreement.type === 'provisional'
  const amendDisabled = !isGrantor || agreement.status !== 'active'
  const amendTooltip = !isGrantor
    ? (isProvisional
        ? `Waiting for ${agreement.grantor.party} to respond.`
        : `Only ${agreement.grantor.party} (the grantor) can amend this agreement.`)
    : agreement.status !== 'active'
      ? `This agreement is ${agreement.status}; amendments are disabled.`
      : null
  const amendLabel = isProvisional && isGrantor
    ? 'Respond to Request'
    : isProvisional
      ? 'Awaiting Response'
      : 'Amend Disclosure'

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'var(--font-display)',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 14px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            letterSpacing: '0.12em', color: 'var(--text-tertiary)', textTransform: 'uppercase',
          }}>
            Disclosure Agreement
          </span>
          <div style={{ flex: 1 }} />
          {agreement.status === 'expired' && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
              color: 'var(--text-dim)', background: 'var(--bg-raised)',
            }}>EXPIRED</span>
          )}
          <button
            onClick={onClose}
            aria-label="Close agreement panel"
            style={{
              background: 'none', border: 'none', fontSize: 15,
              color: 'var(--text-tertiary)', cursor: 'pointer',
              padding: '2px 4px', borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >✕</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span aria-hidden style={{
            width: 10, height: 10, borderRadius: 2,
            background: typeColor, flexShrink: 0,
          }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {kindLabel}
          </span>
        </div>
        <CopyBadge value={agreement.id} truncated />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        <Section title="Parties">
          <Row label="Grantor" value={`${agreement.grantor.party}`} />
          <Row label="Grantee" value={`${agreement.grantee.party}`} />
        </Section>

        <Section title="Subject">
          <Row label="Kind" value={SUBJECT_KIND_LABEL[agreement.subject.kind] || agreement.subject.kind} />
          <Row label="Name" value={subjectName} />
          <Row label="ID" value={agreement.subject.id} mono />
        </Section>

        {granteeAssetName && (
          <Section title="Grantee Anchor">
            <Row label="Asset" value={granteeAssetName} />
            <Row label="ID" value={agreement.granteeAssetId} mono />
          </Section>
        )}

        <Section title="Type & Scope">
          <Row label="Disclosure type" value={DISCLOSURE_TYPE_LABEL[agreement.type] || agreement.type} />
          {Array.isArray(agreement.scope?.assetIds) && agreement.scope.assetIds.length > 0 && (
            <Row
              label={`Assets in scope (${agreement.scope.assetIds.length})`}
              value={agreement.scope.assetIds.join(', ')}
              mono
            />
          )}
          {Array.isArray(agreement.scope?.fieldIds) && agreement.scope.fieldIds.length > 0 && (
            <Row
              label={`Fields in scope (${agreement.scope.fieldIds.length})`}
              value={agreement.scope.fieldIds.join(', ')}
              mono
            />
          )}
          {Array.isArray(agreement.scope?.evaluationResultIds) && agreement.scope.evaluationResultIds.length > 0 && (
            <Row
              label={`Eval Results in scope (${agreement.scope.evaluationResultIds.length})`}
              value={agreement.scope.evaluationResultIds.join(', ')}
              mono
            />
          )}
          <Row label="Include derivatives" value={agreement.scope?.includeDerivatives ? 'Yes' : 'No'} />
        </Section>

        <Section title="Terms">
          <Row label="Created" value={formatDateTime(agreement.terms?.createdDate)} />
          <Row label="Expires" value={agreement.terms?.expires ? formatDateTime(agreement.terms.expires) : 'Never expires'} />
          <Row label="Auto-renew" value={agreement.terms?.autoRenew ? 'Yes' : 'No'} />
        </Section>

        <Section title="Status">
          <Row label="Status" value={agreement.status} />
          {Array.isArray(agreement.amendments) && agreement.amendments.length > 0 && (
            <Row label="Amendments" value={`${agreement.amendments.length}`} />
          )}
        </Section>

        {onViewEvaluationAgreement && (
          <button
            type="button"
            onClick={onViewEvaluationAgreement}
            style={{
              marginTop: 6,
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--accent-indigo)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              width: '100%',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            View paired Evaluation Agreement →
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 18px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <Tooltip content={amendTooltip || 'Amend the Disclosure Agreement'} width={280} wrapperStyle={{ flex: 1 }}>
          <button
            type="button"
            onClick={amendDisabled ? undefined : onAmend}
            disabled={amendDisabled}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: amendDisabled
                ? 'var(--bg-raised)'
                : (isProvisional ? 'var(--accent-amber)' : 'var(--accent-indigo)'),
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: amendDisabled ? 'var(--text-dim)' : 'var(--bg-deep)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: amendDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {amendLabel}
          </button>
        </Tooltip>
        {/* Phase 9D.1.1 (Fix 4): Revoke button. Gating mirrors the
            Agreements Section row: either party may revoke; internals,
            proof-of-eval, provisional, already-revoked, non-active
            agreements all hide the button. */}
        {(() => {
          const canRevoke = (isGrantor || isGrantee) && !isInternal && !isProofOfEval
            && !isRevoked && !isProvisional && agreement.status === 'active'
          if (!canRevoke) return null
          return (
            <Tooltip content="Revoke this Disclosure Agreement — terminates visibility for both sides." width={280} wrapperStyle={{ flex: 1 }}>
              <button
                type="button"
                onClick={onRevoke}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'transparent',
                  border: '1px solid var(--accent-red)',
                  borderRadius: 4,
                  color: 'var(--accent-red)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-red) 10%, transparent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                Revoke
              </button>
            </Tooltip>
          )
        })()}
      </div>
    </div>
  )
}
