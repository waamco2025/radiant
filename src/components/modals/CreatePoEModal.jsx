// CreatePoEModal — Phase 13 (#168) / Phase 13.1 (#168a). Confirmation modal
// that finalizes an Eval Result into a Proof of Evaluation. 1:1 wrap — the
// PoE wraps exactly one Eval Result (which itself may bundle multiple
// Requirements Sets via the Phase 13.1 data shape). Termination is per-
// (Asset set, RS set, evaluator) — once a PoE wraps an evaluation, no
// further evaluations are possible against that combination unless the
// underlying evidence changes.

import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter, Btn,
} from './ModalShared'

export default function CreatePoEModal({
  // Source Eval Result the user clicked "Create PoE" on.
  evalResult,
  // Source Claim — used for the auto-name + body copy.
  claim,
  onConfirm,   // () => void
  onClose,
}) {
  const rsList = evalResult?.requirementsSets
    || (evalResult?.requirementsSet ? [evalResult.requirementsSet] : [])
  const rsNames = rsList.map((rs) => rs?.name || rs?.id || '?')
  const rsCopy = rsNames.length === 0
    ? 'this Requirements Set'
    : rsNames.length === 1
      ? rsNames[0]
      : `${rsNames.slice(0, -1).join(', ')} and ${rsNames[rsNames.length - 1]}`

  const handleConfirm = () => {
    onConfirm?.()
  }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={560}>
        <ModalHeader
          title="Create Proof of Evaluation"
          subtitle="Finalize this evaluation as an immutable on-chain proof."
          onClose={onClose}
        />
        <ModalBody>
          <div style={{
            padding: '14px 16px', borderRadius: 8, marginBottom: 16,
            background: 'color-mix(in srgb, var(--accent-amber) 7%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)',
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: 'var(--accent-amber)', letterSpacing: '0.08em', marginBottom: 6,
            }}>IRREVERSIBLE</div>
            Create Proof of Evaluation? This finalizes your evaluation of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{claim?.name || 'this Claim'}</strong>{' '}
            against <strong style={{ color: 'var(--text-primary)' }}>{rsCopy}</strong>. No further
            evaluations will be possible on this Asset+Requirements Set
            combination, and the underlying Eval Result will be locked from
            further changes. This action cannot be undone.
          </div>

          <div style={{
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--bg-card)', padding: '10px 14px',
            fontSize: 11, color: 'var(--text-tertiary)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: 'var(--text-dim)', letterSpacing: '0.06em',
              fontSize: 10, marginBottom: 6,
            }}>WRAPPING 1 EVAL RESULT</div>
            {rsList.map((rs) => (
              <div key={rs.id} style={{
                fontSize: 11, color: 'var(--text-secondary)',
                padding: '4px 0', borderTop: '1px solid var(--border-faint)',
              }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{rs.name || rs.id}</span>
                <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
                  v{rs.version ?? 1}
                </span>
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {rsList.length === 1
              ? 'Wraps 1 Eval Result · 1 Requirements Set.'
              : `Wraps 1 Eval Result · ${rsList.length} Requirements Sets.`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Create Proof of Evaluation" accent onClick={handleConfirm} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
