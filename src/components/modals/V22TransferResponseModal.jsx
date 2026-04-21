// V22TransferResponseModal — Phase 9A.5 Gate B (#77).
//
// Recipient's response surface for an incoming Asset transfer request.
// Refactored from inline notification-row buttons into a modal so the
// UX matches the established V2.2 pattern: notification is the entry
// point, the decision itself happens in a modal (see CLAUDE.md
// "Accept/decline in modals, not notifications" convention).
//
// Two phases:
//   1  Decide     — sender + asset summary + optional note; Accept /
//                   Decline primary actions.
//   2  Reason     — only reached via Decline; optional reason textarea
//                   with BACK / CONFIRM DECLINE.
//
// Accept closes the modal; V2App fires the existing accept handler
// which replaces the ownership DA, moves the Asset, and emits the
// reciprocal notifications.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, InfoRow,
} from './ModalShared'

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function V22TransferResponseModal({
  notif,              // the v22-transfer-request notification
  asset,              // { name, file: { filename, size }, ... } — the Asset being transferred
  senderParty,        // party name (e.g., "MicroCo")
  senderDate,         // initiated date (string)
  note,               // optional note from sender
  onAccept,           // (notif) => void
  onDecline,          // (notif, reason) => void
  onClose,
}) {
  const [phase, setPhase] = useState('decide') // 'decide' | 'reason'
  const [reason, setReason] = useState('')

  const handleAccept = () => {
    onAccept?.(notif)
    onClose?.()
  }

  const handleConfirmDecline = () => {
    onDecline?.(notif, reason)
    onClose?.()
  }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={560}>
        <ModalHeader
          title="Transfer Request"
          subtitle={
            phase === 'decide'
              ? <><strong style={{ color: 'var(--text-primary)' }}>{senderParty}</strong> is offering to transfer an Asset to you.</>
              : <>Decline the transfer of <strong style={{ color: 'var(--text-primary)' }}>{asset?.name}</strong>?</>
          }
          onClose={onClose}
        />
        <ModalBody>
          {phase === 'decide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                padding: 14, borderRadius: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
                <div style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 8,
                }}>ASSET</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {asset?.name}
                </div>
                {asset?.file?.filename && (
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    {asset.file.filename}
                    {asset.file?.size != null && <> · {formatBytes(asset.file.size)}</>}
                  </div>
                )}
              </div>

              <div style={{
                padding: 14, borderRadius: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
                <InfoRow label="Sender" value={senderParty} />
                {senderDate && <InfoRow label="Initiated" value={senderDate} />}
                {note && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 4 }}>
                      NOTE FROM SENDER
                    </div>
                    <div style={{
                      padding: '8px 10px', borderRadius: 4,
                      background: 'var(--bg-raised)',
                      fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5,
                    }}>"{note}"</div>
                  </div>
                )}
              </div>

              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                Accepting moves ownership of this Asset to you. The transfer is
                recorded on the Asset's provenance chain and cannot be reversed.
              </div>
            </div>
          )}

          {phase === 'reason' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FieldLabel label="Decline reason (optional)" />
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The sender will see this message."
                rows={4}
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                  outline: 'none', resize: 'vertical', lineHeight: 1.5,
                }}
              />
              <div style={{
                fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5,
              }}>
                The Asset will stay with {senderParty}. A declined transfer record
                is appended to its provenance chain.
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {phase === 'decide' && (
            <>
              <Btn label="Decline" onClick={() => setPhase('reason')} />
              <Btn label="Accept Transfer" accent onClick={handleAccept} />
            </>
          )}
          {phase === 'reason' && (
            <>
              <Btn label="← Back" onClick={() => setPhase('decide')} />
              <Btn label="Confirm Decline" danger onClick={handleConfirmDecline} />
            </>
          )}
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
