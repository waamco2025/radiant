// UpdateRSReferenceModal — Phase 12.1 (#120).
//
// Inline supersession-update modal for the Claim Detail Panel's
// "Newer version available" pill on a Referenced Standard row.
// Triggered exclusively from the Claim Detail Panel; the only inline
// mutation affordance on the Referenced Standards section. Adds and
// removes still go through AmendClaimModal.
//
// Confirm semantics:
//   • Records a Claim amendment with diff = removed [oldVersionId],
//     added [latestVersionId].
//   • Updates the Claim's referencedRequirementsSets[] entry: replaces
//     the entry's requirementsSetId with the latest, stamps a fresh
//     addedDate.
//   • DOES NOT mark Eval Results stale.
//   • DOES NOT generate notifications.
//   • Always jumps to the LATEST version in the supersession chain
//     (not the next link). Each row updated independently.

import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter, Btn,
} from './ModalShared'

export default function UpdateRSReferenceModal({
  fromRs,        // { id, name, version, lineageId, ... } — currently-referenced version
  toRs,          // { id, name, version, lineageId, ... } — latest version in lineage
  onConfirm,     // () => void
  onClose,
}) {
  if (!fromRs || !toRs) return null

  return (
    <Backdrop onClose={onClose}>
      <Modal width={460}>
        <ModalHeader
          title="Update Referenced Standard"
          subtitle="Bring this Claim's reference up to the latest version in the standard's lineage."
          onClose={onClose}
        />
        <ModalBody>
          <div style={{
            padding: '14px 16px', borderRadius: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            marginBottom: 14,
          }}>
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.12em', color: 'var(--text-tertiary)',
              marginBottom: 8, textTransform: 'uppercase',
            }}>UPDATE REFERENCE</div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-primary)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fromRs.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  v{fromRs.version ?? '?'}
                </div>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>→</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {toRs.name}
                </div>
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', marginTop: 2,
                  color: 'var(--accent-indigo)',
                }}>
                  v{toRs.version ?? '?'} (latest)
                </div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            This will be recorded in the Claim&rsquo;s amendment history. Existing evaluation
            results are not affected, and no counterparty notifications are sent.
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn label="Cancel" onClick={onClose} />
          <Btn label="Update reference" accent onClick={onConfirm} />
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
