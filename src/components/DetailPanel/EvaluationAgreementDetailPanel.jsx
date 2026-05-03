// Evaluation Agreement Detail Panel — spec §10.5.
// Opens from the EdgeMenu's "View Evaluation Agreement" option when an Agreement
// Edge has a paired Evaluation Agreement.
//
// The Evaluation Agreement gates evaluation visibility of the Claim as a node on
// the grantee's canvas. It pairs with a Disclosure Agreement (referenced by
// `disclosureAgreementId`); restrictions + incentives + authorized requirements
// sets are carried alongside the DA scope.

import CopyBadge from './shared/CopyBadge'
// Phase 11C.3 W4: shared Expand affordance — same component the V22 node
// Detail Panels use, so the icon + styling stay consistent across surfaces.
import ExpandButton from './shared/ExpandButton'
import Tooltip from '../Tooltip'

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

export default function EvaluationAgreementDetailPanel({
  agreement,
  resolveNodeName,
  activeParty,
  onClose,
  onAmend,
  onRevoke, // Phase 9D.1.1 (Fix 4): opens V22RevocationConfirmModal
  onViewDisclosureAgreement,
  // Phase 11C.2 W3: opens ExpandedArtifactModal in JSON-only mode for the
  // EA artifact (Output tab is hidden for the 'evaluation-agreement' schema
  // since the EA has no file or structured rows). Optional — when omitted,
  // no Expand affordance renders.
  onExpand,
}) {
  if (!agreement) return null

  const isGrantor = activeParty && activeParty === agreement.grantor.party
  // Phase 9D.1.1 (Fix 3 + Fix 4): grantee may revoke the EA.
  const isGrantee = activeParty && activeParty === agreement.grantee.party
  const isInternal = agreement.grantor.party === agreement.grantee.party
  const isRevoked = !!agreement._revokedMeta
  const claimName = resolveNodeName?.(agreement.claimId) || agreement.claimId
  const granteeAssetName = agreement.granteeAssetId
    ? (resolveNodeName?.(agreement.granteeAssetId) || agreement.granteeAssetId)
    : null

  // Phase 11E.1: Amend gating — grantor only, must be active + non-revoked.
  // `isRevoked` is _revokedMeta-driven and orthogonal to `status` so we
  // check both.
  // Phase 11.6 (#164): pending-acceptance branch. While a prior
  // proposal is awaiting the grantee's response, the grantor cannot
  // submit a new one (single proposal in flight). Revoke is the only
  // override during this state — see spec §11.2b.
  const isPendingAcceptance = agreement.status === 'pending-acceptance'
  const amendDisabled = !isGrantor || isRevoked || agreement.status !== 'active'
  const amendTooltip = !isGrantor
    ? `Only ${agreement.grantor.party} (the grantor) can amend this agreement.`
    : isRevoked
      ? 'This Evaluation Agreement has been revoked; amendments are disabled.'
      : isPendingAcceptance
        ? `Cannot amend: prior amendment proposal awaiting ${agreement.grantee.party}'s response.`
        : agreement.status !== 'active'
          ? `This agreement is ${agreement.status}; amendments are disabled.`
          : null

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
          }}>Evaluation Agreement</span>
          <div style={{ flex: 1 }} />
          {onExpand && (
            <ExpandButton onClick={onExpand} title="Expand to view raw EA JSON" />
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
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--accent-purple, #a78bfa)', flexShrink: 0,
          }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {agreement.grantor.party} → {agreement.grantee.party}
          </span>
        </div>
        <CopyBadge value={agreement.id} truncated />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        <Section title="Parties">
          <Row label="Grantor" value={agreement.grantor.party} />
          <Row label="Grantee" value={agreement.grantee.party} />
        </Section>

        <Section title="Evaluation Target">
          <Row label="Claim" value={claimName} />
          <Row label="Claim ID" value={agreement.claimId} mono />
          {granteeAssetName && (
            <>
              <Row label="Grantee Asset" value={granteeAssetName} />
              <Row label="Grantee Asset ID" value={agreement.granteeAssetId} mono />
            </>
          )}
        </Section>

        {/* Phase 9B.1 §5: "Authorized Requirements Sets" section removed.
            The Requirements Sets a grantee proposed in their original
            request are advisory (spec §10.5) — not binding — and labelling
            them "Authorized" implied enforcement that doesn't exist.
            Amendments also change what's in play without a visible log,
            creating stale-data risk. Omitted entirely; agreement.
            authorizedRequirementsSetIds still exists on the data model
            for future phases that want to surface it differently. */}

        <Section title="Restrictions">
          <Row
            label="Prior evaluation required"
            value={agreement.restrictions?.priorEvaluationRequired ?? '—'}
          />
          <Row
            label="Additional participants"
            value={
              Array.isArray(agreement.restrictions?.additionalParticipants) && agreement.restrictions.additionalParticipants.length > 0
                ? agreement.restrictions.additionalParticipants.join(', ')
                : 'None'
            }
          />
        </Section>

        <Section title="Terms">
          <Row label="Created" value={formatDateTime(agreement.terms?.createdDate)} />
          <Row label="Evaluation deadline" value={agreement.terms?.evaluationDeadline ? formatDateTime(agreement.terms.evaluationDeadline) : 'Never expires'} />
          <Row label="Result expiry" value={agreement.terms?.resultExpiry ? formatDateTime(agreement.terms.resultExpiry) : 'Never expires'} />
          {Array.isArray(agreement.terms?.flowDownRequirements) && agreement.terms.flowDownRequirements.length > 0 && (
            <Row
              label={`Flow-down requirements (${agreement.terms.flowDownRequirements.length})`}
              value={agreement.terms.flowDownRequirements.join(', ')}
              mono
            />
          )}
        </Section>

        <Section title="Incentives">
          <Row label="On satisfactory" value={agreement.incentives?.onSatisfactory ?? '—'} />
          <Row label="On unsatisfactory" value={agreement.incentives?.onUnsatisfactory ?? '—'} />
        </Section>

        <Section title="Status">
          <Row label="Status" value={agreement.status} />
          <Row label="Paired DA" value={agreement.disclosureAgreementId} mono />
        </Section>

        {/* Phase 11E.1 (#108): Amendments section. Each entry surfaces the
            evaluationDeadline transition and the acknowledgment delta
            (added / removed / edited counts), plus the grantor's optional
            note. Note: for amendments older than the most recent, the
            "Expiration: before → current" display is not chained through
            the prior amendment's termsAfter — see architecture-spec
            §11.2a Option C TODO. */}
        {Array.isArray(agreement.amendments) && agreement.amendments.length > 0 && (
          <Section title={`Amendments (${agreement.amendments.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agreement.amendments.map((am, i) => {
                const expiryChanged = am.termsBefore?.evaluationDeadline !== undefined
                  && am.termsBefore.evaluationDeadline !== agreement.terms?.evaluationDeadline
                const ackAdded = am.acknowledgmentChanges?.added?.length || 0
                const ackRemoved = am.acknowledgmentChanges?.removed?.length || 0
                const ackEdited = am.acknowledgmentChanges?.edited?.length || 0
                return (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      {formatDateTime(am.date)}
                    </div>
                    {expiryChanged && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Expiration: {am.termsBefore.evaluationDeadline ? formatDateTime(am.termsBefore.evaluationDeadline) : 'Never expires'} → {agreement.terms?.evaluationDeadline ? formatDateTime(agreement.terms.evaluationDeadline) : 'Never expires'}
                      </div>
                    )}
                    {(ackAdded > 0 || ackRemoved > 0 || ackEdited > 0) && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Acknowledgments:
                        {ackAdded > 0 && ` +${ackAdded} added`}
                        {ackRemoved > 0 && ` −${ackRemoved} removed`}
                        {ackEdited > 0 && ` ~${ackEdited} edited`}
                      </div>
                    )}
                    {am.note && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 6, lineHeight: 1.5 }}>
                        "{am.note}"
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {onViewDisclosureAgreement && (
          <button
            type="button"
            onClick={onViewDisclosureAgreement}
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
            ← View paired Disclosure Agreement
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 18px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <Tooltip content={amendTooltip || 'Amend the Evaluation Agreement'} width={280} wrapperStyle={{ flex: 1 }}>
          <button
            type="button"
            onClick={amendDisabled ? undefined : onAmend}
            disabled={amendDisabled}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: amendDisabled ? 'var(--bg-raised)' : 'var(--accent-purple, #a78bfa)',
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
            Amend Evaluation Agreement
          </button>
        </Tooltip>
        {/* Phase 9D.1.1 (Fix 4): Revoke EA — either party, non-internal,
            non-revoked, active. */}
        {(() => {
          const canRevoke = (isGrantor || isGrantee) && !isInternal
            && !isRevoked && agreement.status === 'active'
          if (!canRevoke) return null
          return (
            <Tooltip content="Revoke this Evaluation Agreement — removes evaluation rights for both sides. Historical results are preserved." width={280} wrapperStyle={{ flex: 1 }}>
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
