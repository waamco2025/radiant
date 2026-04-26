// V22DismissEvalResultModal — Phase 9D.1.4 Fix 2.
//
// Confirmation modal for the orphaned-Eval-Result Dismiss action. Replaces
// the prior `window.confirm` that surfaced from V22EvalResultPanel's footer.
// State lives in V2App; this component just renders the confirmation surface
// and threads Cancel / Confirm callbacks back.
//
// Pattern-matched against V22RevocationConfirmModal — same Backdrop/Modal/
// header/body/footer primitives, accent (indigo) Confirm button on the right
// matching the destructive-action layout.

import { Backdrop, Modal, ModalHeader, ModalBody, ModalFooter, Btn } from './ModalShared.jsx'

export default function V22DismissEvalResultModal({
  evalResultArtifact,
  onConfirm,
  onClose,
}) {
  if (!evalResultArtifact) return null

  const erName = evalResultArtifact.name
    || evalResultArtifact.requirementsSet?.name
    || 'this Evaluation Result'

  return (
    <Backdrop onClose={onClose}>
      <Modal width={520}>
        <ModalHeader title="Dismiss Evaluation Result" subtitle={erName} onClose={onClose} />
        <ModalBody>
          <div style={{
            padding: '16px 18px',
            background: 'var(--bg-card)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            Dismissing this Evaluation Result removes it from your canvas view only.
            The Evaluation Result remains in your Qualified Storage and its data
            lineage is preserved in the ledger.
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn label="Cancel" onClick={onClose} />
          <Btn label="Dismiss" accent onClick={onConfirm} />
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
