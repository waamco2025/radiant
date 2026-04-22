// V22RevocationConfirmModal — Phase 9D (#112)
//
// Revoker-side confirmation for a Disclosure or Evaluation Agreement revocation.
// This is a new V2.2 modal (no V2.1 precedent); the styling pattern-matches the
// V2.1 RevocationNoticeModal's red accent treatment for visual continuity.
//
// Shown when the revoker clicks the "Revoke" action label in the 9C Agreements
// section of a node Detail Panel. On confirm:
//   • State updates: DA/EA annotated with _revokedMeta (grantor-initiated DA
//     path) or dropped outright (grantee-initiated OR EA-only path)
//   • Cascade: DA revocation auto-cascades to paired EA + grantee's Eval Results
//     under that EA. The cascade summary is displayed here so the user sees
//     the impact before committing.
//   • Notifications fire to the counterparty (v22-da-revoked / v22-ea-revoked).
//
// Proof-of-Evaluation DAs are non-revocable by design; the 9C Agreements
// section already hides the Revoke action on those rows, so this modal is
// never invoked for them.

import { useState } from 'react'
import { Backdrop, Modal, ModalHeader, ModalBody, ModalFooter, Btn, FieldLabel } from './ModalShared.jsx'

export default function V22RevocationConfirmModal({
  agreement,
  agreementType,        // 'DA' | 'EA'
  counterpartyParty,
  cascadeInfo,          // { willRevokeEa: boolean, evalResultCount: number, evalResultNames: [] }
  subjectName,          // Claim name (for DA with claim subject) or Agreement summary (for EA)
  onConfirm,            // (reason: string) => void
  onClose,
}) {
  const [reason, setReason] = useState('')
  const isDa = agreementType === 'DA'
  const title = isDa ? 'Revoke Disclosure Agreement' : 'Revoke Evaluation Agreement'
  const subtitle = counterpartyParty
    ? `This will terminate the agreement with ${counterpartyParty}.`
    : 'This will terminate the agreement.'
  const cascade = cascadeInfo || { willRevokeEa: false, evalResultCount: 0, evalResultNames: [] }
  const hasCascade = isDa && (cascade.willRevokeEa || cascade.evalResultCount > 0)

  return (
    <Backdrop onClose={onClose}>
      <Modal width={520}>
        <ModalHeader title={title} subtitle={subtitle} onClose={onClose} />
        <ModalBody>
          {/* Irreversibility warning — red accent block matching V2.1
              RevocationNoticeModal's "Access Revoked" card. */}
          <div style={{
            padding: '16px 18px', borderRadius: 8,
            background: 'color-mix(in srgb, var(--accent-red) 4%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-red) 18%, transparent)',
            marginBottom: 16, display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-red)', fontSize: 13, fontWeight: 700,
            }}>✕</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                This action is irreversible.
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.55 }}>
                {isDa
                  ? 'Revoking this Disclosure Agreement terminates the counterparty’s visibility into the underlying Claim.'
                  : 'Revoking this Evaluation Agreement removes the counterparty’s right to run new evaluations. Historical Eval Results are preserved.'}
              </div>
            </div>
          </div>

          {/* Agreement subject summary */}
          {subjectName && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 8,
              border: '1px solid var(--border)', padding: '12px 14px', marginBottom: 16,
            }}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 4,
              }}>
                {isDa ? 'SUBJECT' : 'EVALUATING CLAIM'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {subjectName}
              </div>
            </div>
          )}

          {/* Cascade warning block — only when applicable */}
          {hasCascade && (
            <div style={{
              padding: '14px 16px', borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 24%, transparent)',
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: 'var(--accent-amber)', letterSpacing: '0.06em', marginBottom: 8,
                textTransform: 'uppercase',
              }}>
                Cascade
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 8 }}>
                Revoking this Disclosure Agreement will also revoke:
              </div>
              <ul style={{
                margin: 0, paddingLeft: 20, fontSize: 11, color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}>
                {cascade.willRevokeEa && (
                  <li>The paired Evaluation Agreement with {counterpartyParty}</li>
                )}
                {cascade.evalResultCount > 0 && (
                  <li>
                    {cascade.evalResultCount} Eval Result{cascade.evalResultCount > 1 ? 's' : ''} produced by {counterpartyParty} under that agreement
                  </li>
                )}
              </ul>
              {cascade.evalResultCount > 0 && (
                <div style={{
                  fontSize: 10, color: 'var(--text-dim)', marginTop: 8,
                  fontStyle: 'italic',
                }}>
                  Historical records are preserved for audit; the visible nodes are removed from both canvases.
                </div>
              )}
            </div>
          )}

          {/* Reason textarea — optional */}
          <FieldLabel label="Reason (optional)" />
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="Explain why you're revoking — the counterparty will see this on their notification."
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)',
              fontSize: 12, fontFamily: 'var(--font-display)', lineHeight: 1.5,
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textAlign: 'right' }}>
            {reason.length}/500
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn label="Cancel" onClick={onClose} />
          <Btn label="Revoke Agreement" danger onClick={() => onConfirm(reason.trim())} />
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
