// V22TransferAssetModal — Phase 9A.4 Gate B.
//
// Transfers ownership of an Asset from the active actor to a recipient
// Actor identified by PIN. Canon X.5 / spec §11.7: the file doesn't move;
// the DOT updates (ownerDid flips, lineage[] grows) and the Asset
// materialises on the recipient's canvas after acceptance.
//
// Two-step flow:
//   1  Recipient  — enter PIN, live resolve, optional note.
//   2  Review     — summary + irreversibility warning + Send Transfer.
//
// Submit builds a provisional transfer record. The Asset on the sender's
// canvas is stamped with `_pendingTransfer` and renders a TRANSFERRING
// badge until the recipient accepts/declines or the sender cancels.
//
// PIN resolution rejects: own PIN (self-transfer), Radiant Network PIN
// (transfer to public-directory pseudo-actor), unknown PIN.

import { useMemo, useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, InfoRow, StepDots,
} from './ModalShared'
import { resolveActorByPin } from '../../v2/v2_2Data.js'

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function resolutionState(pinInput, activeParty) {
  const trimmed = pinInput.trim()
  if (trimmed.length === 0) return { resolvedActor: null, tone: null, message: null }
  if (!trimmed.startsWith('PIN-')) {
    // Demo PIN shape is `PIN-0x...`; don't spam red errors while typing.
    return { resolvedActor: null, tone: 'neutral', message: 'PINs start with "PIN-0x…" — keep typing…' }
  }
  const r = resolveActorByPin(trimmed, { activeParty })
  // Phase 9A.5 #79: split resolution errors into three semantically distinct
  // messages. Self + Radiant Network cases can be specific without leaking
  // information — the sender already knows their own PIN and the Radiant
  // Network PIN is a pseudo-constant. Unknown PIN stays generic.
  if (r.isSelf) {
    return { resolvedActor: null, tone: 'error', message: 'You cannot transfer an Asset to yourself.' }
  }
  if (r.isNetwork) {
    return { resolvedActor: null, tone: 'error', message: 'Assets cannot be transferred to the Radiant Network.' }
  }
  if (!r.actor) {
    return { resolvedActor: null, tone: 'error', message: 'No actor was found at this PIN. Check the recipient and try again.' }
  }
  return { resolvedActor: r.actor, tone: 'success', message: null }
}

export default function V22TransferAssetModal({
  activeParty,        // sender party name
  asset,              // the Asset artifact being transferred
  onClose,
  onComplete,         // ({ recipientActor, note }) => void — V2App creates the provisional transfer
}) {
  const [step, setStep] = useState(0)
  const [pinInput, setPinInput] = useState('')
  const [note, setNote] = useState('')

  const { resolvedActor, tone, message } = useMemo(
    () => resolutionState(pinInput, activeParty),
    [pinInput, activeParty],
  )
  const canReview = !!resolvedActor

  // Resolution chip rendered under the PIN input.
  let resolutionUi = null
  if (tone === 'success' && resolvedActor) {
    resolutionUi = (
      <div style={{
        padding: '12px 14px', borderRadius: 8, marginTop: 10,
        background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--accent-green)',
          color: '#000', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, flexShrink: 0,
        }}>✓</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Phase 9A.5 #78: show party only. The platform knows parties, not
              users or roles — surfacing "Bob @ GovCo / buyer" over-specifies. */}
          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
            Resolved: {resolvedActor.party}
          </div>
        </div>
      </div>
    )
  } else if (tone) {
    const isError = tone === 'error'
    resolutionUi = (
      <div style={{
        padding: '10px 14px', borderRadius: 8, marginTop: 10,
        background: isError ? 'color-mix(in srgb, var(--accent-red) 6%, transparent)' : 'transparent',
        border: `1px solid ${isError ? 'color-mix(in srgb, var(--accent-red) 25%, transparent)' : 'var(--border)'}`,
        fontSize: 11, color: isError ? 'var(--accent-red)' : 'var(--text-dim)', lineHeight: 1.5,
      }}>
        {message}
      </div>
    )
  }

  const handleSubmit = () => {
    if (!resolvedActor) return
    onComplete?.({ recipientActor: resolvedActor, note: note.trim() })
  }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={620}>
        <ModalHeader
          title="Transfer Asset"
          subtitle={
            <>Transfer ownership of <strong style={{ color: 'var(--text-primary)' }}>{asset?.name || 'this Asset'}</strong> to another actor.</>
          }
          step={step + 1}
          totalSteps={2}
          onClose={onClose}
        />
        <ModalBody>
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                  {asset?.file?.filename}
                  {asset?.file?.size != null && <> · {formatBytes(asset.file.size)}</>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                  Current owner: <span style={{ color: 'var(--text-secondary)' }}>{asset?.owner || activeParty}</span>
                </div>
              </div>

              <div>
                <FieldLabel label="Recipient Actor PIN" required />
                <input
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="PIN-0x…"
                  autoFocus
                  spellCheck={false}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12,
                    outline: 'none',
                  }}
                />
                {resolutionUi}
              </div>

              <div>
                <FieldLabel label="Note to recipient" />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional message shown alongside the transfer request."
                  rows={2}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                    outline: 'none', resize: 'vertical', lineHeight: 1.5,
                  }}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                padding: 18, borderRadius: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
                <div style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 10,
                }}>TRANSFER REVIEW</div>
                <InfoRow label="Asset" value={asset?.name} />
                <InfoRow label="File" value={asset?.file?.filename} />
                <InfoRow label="Current owner" value={asset?.owner || activeParty} />
                <InfoRow label="Recipient" value={
                  <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                    {resolvedActor?.party}
                  </span>
                } />
                {note.trim() && <InfoRow label="Note" value={<span style={{ fontStyle: 'italic' }}>"{note.trim()}"</span>} />}
              </div>
              <div style={{
                padding: '12px 14px', borderRadius: 8,
                background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                <strong style={{ color: 'var(--accent-amber)' }}>Irreversible.</strong>{' '}
                On accept, ownership of this Asset transfers to{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{resolvedActor?.party}</strong>.
                This Asset will no longer appear on your canvas. The transfer is recorded on the
                ledger and cannot be reversed.
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {step > 0 && <Btn label="← Back" onClick={() => setStep(0)} />}
            <StepDots current={step} total={2} />
          </div>
          {step === 0 && (
            <Btn
              label="Review →"
              accent
              disabled={!canReview}
              onClick={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <Btn
              label="Send Transfer Request"
              accent
              onClick={handleSubmit}
            />
          )}
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
