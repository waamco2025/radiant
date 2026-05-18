// Phase 17.2 — Solicitor's UI to create an RFP Solicitation.
//
// Solicitor (active actor) picks one of their existing Claims and writes
// an optional message. Submit calls onSubmit with the (rfpId, claimId,
// message) payload — V2App's handleCreateSolicitation handler builds the
// RfpSolicitation artifact via `makeRfpSolicitation` and fires the
// notification to the RFP owner.
//
// Defaults to zero selected per CLAUDE.md picker-default convention:
// the user must explicitly pick a Claim before Submit enables.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

const MESSAGE_MAX_CHARS = 500

export default function SolicitationCreateModal({
  rfp,                  // target RFP
  activeClaims = [],    // active actor's Claims (filtered by parent)
  onSubmit,             // ({ rfpId, claimId, message }) => void
  onCancel,
}) {
  const [selectedClaimId, setSelectedClaimId] = useState(null)
  const [messageText, setMessageText] = useState('')

  const hasClaims = activeClaims.length > 0
  const canSubmit = hasClaims && !!selectedClaimId

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit?.({
      rfpId: rfp.id,
      claimId: selectedClaimId,
      message: messageText.trim(),
    })
  }

  return (
    <Backdrop onClose={onCancel}>
      <Modal width={620}>
        <ModalHeader
          title={`Solicit with my Claim — Re: ${rfp?.name || 'RFP'}`}
          subtitle="Pick one of your Claims to suggest as a match for this RFP's required standards. The RFP owner will be notified and can choose to formalize an evaluation."
          onClose={onCancel}
        />
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Claim picker */}
            <div>
              <FieldLabel label="Your Claim" required />
              {hasClaims ? (
                <div style={{
                  maxHeight: 300,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                }}>
                  {activeClaims.map((c) => {
                    const isSelected = selectedClaimId === c.id
                    const refCount = Array.isArray(c.referencedAssetIds) ? c.referencedAssetIds.length : 0
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedClaimId(c.id)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: isSelected
                            ? 'color-mix(in srgb, var(--accent-indigo) 12%, var(--bg-card))'
                            : 'transparent',
                          borderLeft: isSelected
                            ? '3px solid var(--accent-indigo)'
                            : '3px solid transparent',
                          transition: 'background 120ms',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--bg-raised)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 4,
                        }}>
                          <span style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: '1.5px solid ' + (isSelected ? 'var(--accent-indigo)' : 'var(--text-dim)'),
                            background: isSelected ? 'var(--accent-indigo)' : 'transparent',
                            boxShadow: isSelected ? 'inset 0 0 0 2.5px var(--bg-card)' : 'none',
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            flex: 1,
                            wordBreak: 'break-word',
                          }}>{c.name || c.id}</span>
                          <span style={{
                            fontSize: 9,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            color: 'var(--text-tertiary)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'var(--bg-deep)',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                          }}>{c.owner}</span>
                        </div>
                        <div style={{
                          fontSize: 11,
                          color: 'var(--text-dim)',
                          paddingLeft: 24,
                          fontFamily: 'var(--font-mono)',
                        }}>{refCount} referenced asset{refCount === 1 ? '' : 's'}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  padding: '14px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-deep)',
                  fontSize: 13,
                  color: 'var(--text-dim)',
                  fontStyle: 'italic',
                }}>You have no Claims to solicit with.</div>
              )}
              {hasClaims && !selectedClaimId && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--accent-amber)',
                  fontStyle: 'italic',
                  marginTop: 8,
                }}>Select at least one Claim to continue.</div>
              )}
            </div>

            {/* Message */}
            <div>
              <FieldLabel label="Message to RFP owner" />
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
                placeholder="Add a note to the RFP owner (optional)…"
                rows={4}
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
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn label="Cancel" onClick={onCancel} />
          <Btn
            label="Submit Solicitation"
            accent
            disabled={!canSubmit}
            onClick={handleSubmit}
          />
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
