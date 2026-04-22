// V22RevocationNoticeModal — Phase 9D (#112)
//
// Counterparty-side notification modal. Shown when the recipient clicks a
// `v22-da-revoked` or `v22-ea-revoked` notification in the inbox. Dismiss
// clears the notification AND (for grantor-initiated DA revocations) removes
// the revoked Claim + cascade-revoked EA + Eval Results from the recipient's
// canvas.
//
// Pattern-matched from V2.1 `RevocationNoticeModal.jsx` — the red-accented
// "Access Revoked" card, subject details block, message-from-revoker block,
// and "What this means" consequence block. V2.2 extends this with:
//   • DA / EA branching (V2.1 only knew DA revocations)
//   • Cascade copy — EA revocations triggered by a DA revocation surface the
//     cascade context in the consequence block rather than as a separate
//     warning (the warning lives on the revoker-side Confirm modal)

import { Backdrop, Modal, ModalHeader, ModalBody, ModalFooter, Btn, CopyBadge } from './ModalShared.jsx'

export default function V22RevocationNoticeModal({ notification, onClose }) {
  if (!notification) return null

  const isDa = notification.type === 'v22-da-revoked'
  const isEa = notification.type === 'v22-ea-revoked'
  const cascadedFromDa = !!notification.cascadedFromDa
  const cascadeIncludesEa = !!notification.cascadeIncludesEa
  const cascadeIncludesEvalResults = notification.cascadeIncludesEvalResults || []

  const title = isDa ? 'Disclosure Agreement Revoked' : 'Evaluation Agreement Revoked'
  const subtitle = `From ${notification.from.name} · ${notification.date}`

  // Consequence copy — adapts per agreement type + cascade context.
  let consequence
  if (isDa) {
    consequence = cascadeIncludesEa
      ? 'This Claim and its associated Assets have been removed from your network. The paired Evaluation Agreement and any Eval Results you produced under it were also revoked. You may re-request disclosure from the owner if needed.'
      : 'This Claim and its associated Assets have been removed from your network. Any Eval Results you produced under this agreement were also revoked. You may re-request disclosure from the owner if needed.'
  } else if (cascadedFromDa) {
    consequence = 'This Evaluation Agreement was automatically revoked because the underlying Disclosure Agreement was revoked. See the related Disclosure Agreement revocation notice for details.'
  } else {
    consequence = 'You may no longer run evaluations against this Claim. The Claim itself remains visible.'
  }

  const agreementTypeLabel = isDa ? 'DISCLOSURE AGREEMENT' : 'EVALUATION AGREEMENT'

  return (
    <Backdrop onClose={onClose}>
      <Modal width={520}>
        <ModalHeader title={title} subtitle={subtitle} onClose={onClose} />
        <ModalBody>
          {/* Red-accented "Access Revoked" callout */}
          <div style={{
            padding: '20px', borderRadius: 8, textAlign: 'center',
            background: 'color-mix(in srgb, var(--accent-red) 4%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-red) 15%, transparent)',
            marginBottom: 20,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
              border: '2px solid color-mix(in srgb, var(--accent-red) 30%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', fontSize: 18, color: 'var(--accent-red)',
            }}>✕</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              {cascadedFromDa ? 'Agreement Cascaded' : 'Access Revoked'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>{notification.from.name}</strong> has revoked {isDa
                ? <>the <strong style={{ color: 'var(--text-secondary)' }}>Disclosure Agreement</strong> covering the Claim below.</>
                : cascadedFromDa
                  ? <>the underlying Disclosure Agreement. The paired <strong style={{ color: 'var(--text-secondary)' }}>Evaluation Agreement</strong> was revoked with it.</>
                  : <>your <strong style={{ color: 'var(--text-secondary)' }}>Evaluation Agreement</strong> on the Claim below.</>}
            </div>
          </div>

          {/* Claim / subject details */}
          {notification.claim?.name && (
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 8,
              border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {notification.claim.name}
                </span>
                {notification.claim.pin && (
                  <CopyBadge value={notification.claim.pin} truncated />
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Owner: </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{notification.claimOwnerParty || notification.from.name}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Revoked by: </span>
                  <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {notification.from.name}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Type: </span>
                  <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {agreementTypeLabel}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Message from revoking party */}
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 8,
            border: '1px solid var(--border)', padding: '14px 16px',
          }}>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 8,
            }}>
              MESSAGE FROM {notification.from.name.toUpperCase()}
            </div>
            <div style={{
              fontSize: 12, color: notification.reason ? 'var(--text-secondary)' : 'var(--text-dim)',
              lineHeight: 1.7, fontStyle: 'italic',
            }}>
              {notification.reason
                ? `"${notification.reason}"`
                : '(No reason given)'
              }
            </div>
          </div>

          {/* Cascade list — only shown on DA notifications that carry an
              Eval Result cascade list, for additional context. */}
          {isDa && cascadeIncludesEvalResults.length > 0 && (
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
              fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: 'var(--accent-amber)', letterSpacing: '0.06em', marginBottom: 6,
                textTransform: 'uppercase',
              }}>Cascade</div>
              {cascadeIncludesEvalResults.length} Eval Result{cascadeIncludesEvalResults.length > 1 ? 's' : ''} you produced under this agreement were revoked with it.
            </div>
          )}

          {/* What this means */}
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8,
            background: 'var(--bg-card)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7,
          }}>
            {consequence}
          </div>
        </ModalBody>
        <ModalFooter>
          <div />
          <Btn label="Dismiss" accent onClick={onClose} />
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
