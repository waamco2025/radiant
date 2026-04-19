// Evaluation Agreement Detail Panel — spec §10.5.
// Opens from the EdgeMenu's "View Evaluation Agreement" option when an Agreement
// Edge has a paired Evaluation Agreement.
//
// The Evaluation Agreement gates evaluation visibility of the Claim as a node on
// the grantee's canvas. It pairs with a Disclosure Agreement (referenced by
// `disclosureAgreementId`); restrictions + incentives + authorized requirements
// sets are carried alongside the DA scope.

import CopyBadge from './shared/CopyBadge'

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
  onViewDisclosureAgreement,
}) {
  if (!agreement) return null

  const isGrantor = activeParty && activeParty === agreement.grantor.party
  const claimName = resolveNodeName?.(agreement.claimId) || agreement.claimId
  const granteeAssetName = agreement.granteeAssetId
    ? (resolveNodeName?.(agreement.granteeAssetId) || agreement.granteeAssetId)
    : null

  const amendDisabled = !isGrantor || agreement.status !== 'active'
  const amendTooltip = !isGrantor
    ? `Only ${agreement.grantor.party} (the grantor) can amend this agreement.`
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

        <Section title="Authorized Requirements Sets">
          {Array.isArray(agreement.authorizedRequirementsSetIds) && agreement.authorizedRequirementsSetIds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {agreement.authorizedRequirementsSetIds.map((id) => (
                <div key={id} style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)', padding: '4px 6px',
                  background: 'var(--bg-raised)', borderRadius: 3,
                }}>{id}</div>
              ))}
            </div>
          ) : (
            <Row label="—" value="None authorized" />
          )}
        </Section>

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
          <Row label="Evaluation deadline" value={formatDateTime(agreement.terms?.evaluationDeadline)} />
          <Row label="Result expiry" value={formatDateTime(agreement.terms?.resultExpiry)} />
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
        <button
          type="button"
          onClick={amendDisabled ? undefined : onAmend}
          title={amendTooltip || 'Amend the Evaluation Agreement'}
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
      </div>
    </div>
  )
}
