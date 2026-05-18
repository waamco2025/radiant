// Phase 17.2 — RFP owner's UI to reject an incoming Solicitation.
//
// Optional rejection message (max 300 chars). Submit normalises empty
// string to null and calls onSubmit with (solicitationId, rejectionMessage).
//
// Rejection is final in 17.2 (no undo) — the parent renders the
// rejection in the SolicitationCard, and the rejected status persists.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

const MESSAGE_MAX_CHARS = 300

export default function SolicitationRejectModal({
  solicitation,
  solicitorClaimName,
  onSubmit,
  onCancel,
}) {
  const [messageText, setMessageText] = useState('')

  const handleSubmit = () => {
    const trimmed = messageText.trim()
    onSubmit?.({
      solicitationId: solicitation.id,
      rejectionMessage: trimmed.length > 0 ? trimmed : null,
    })
  }

  return (
    <Backdrop onClose={onCancel}>
      <Modal width={560}>
        <ModalHeader
          title="Reject solicitation"
          subtitle={
            <>Reject <strong style={{ color: 'var(--text-primary)' }}>{solicitation?.solicitor || 'the seller'}</strong>'s solicitation re:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{solicitorClaimName || 'their Claim'}</strong>?</>
          }
          onClose={onCancel}
        />
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <FieldLabel label="Reply to solicitor" />
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
                placeholder="Add a brief reply to the solicitor (optional)…"
                rows={4}
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{
                fontSize: 10,
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                textAlign: 'right',
                marginTop: 4,
              }}>{messageText.length} / {MESSAGE_MAX_CHARS}</div>
            </div>
            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              The solicitor will receive a notification of your rejection. They will see your reply (if any) on their next visit to this RFP.
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn label="Cancel" onClick={onCancel} />
          <Btn
            label="Reject Solicitation"
            danger
            onClick={handleSubmit}
          />
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
