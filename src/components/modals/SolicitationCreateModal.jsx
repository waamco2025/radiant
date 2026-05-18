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
//
// Phase 17.2.0.2 — RS details accordion. The modal now renders an
// expandable section above the Claim picker showing what each
// Requirements Set the RFP references actually requires, so the
// solicitor can intelligently pick a Claim that matches.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

const MESSAGE_MAX_CHARS = 500

// Phase 17.2.0.2: accordion entry for a single Requirements Set. Closed
// shows name + version pill + chevron; open expands to show the RS's
// requirements list. Each requirement renders id (mono pill), label
// (body), description (secondary), criterion (muted tertiary).
function RsAccordionEntry({ rsId, rs, isOpen, onToggle }) {
  const missing = !rs
  const chevron = isOpen ? '▾' : '▸'
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={onToggle}
        style={{
          padding: '10px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: isOpen ? 'var(--bg-raised)' : 'transparent',
          transition: 'background 120ms',
        }}
        onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-raised)' }}
        onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-dim)',
          width: 12,
          textAlign: 'center',
          flexShrink: 0,
        }}>{chevron}</span>
        <span style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 600,
          color: missing ? 'var(--text-dim)' : 'var(--text-primary)',
          wordBreak: 'break-word',
        }}>{missing ? rsId : rs.name}</span>
        {!missing && (
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
          }}>v{rs.version}</span>
        )}
      </div>
      {isOpen && (
        <div style={{
          padding: '6px 14px 12px 36px',
          background: 'var(--bg-deep)',
        }}>
          {missing ? (
            <div style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              fontStyle: 'italic',
            }}>(Standard not found)</div>
          ) : (
            <>
              {rs.description && (
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}>{rs.description}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(rs.requirements || []).map((req) => (
                  <div key={req.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    padding: '8px 10px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <span style={{
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'var(--text-tertiary)',
                        padding: '2px 5px',
                        borderRadius: 3,
                        background: 'var(--bg-deep)',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}>{req.id}</span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        flex: 1,
                        wordBreak: 'break-word',
                      }}>{req.label || req.description}</span>
                    </div>
                    {req.label && req.description && (
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        lineHeight: 1.5,
                        paddingLeft: 2,
                      }}>{req.description}</div>
                    )}
                    {req.criterion && (
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text-dim)',
                        lineHeight: 1.5,
                        paddingLeft: 2,
                        fontStyle: 'italic',
                      }}>Criterion: {req.criterion}</div>
                    )}
                  </div>
                ))}
                {(!rs.requirements || rs.requirements.length === 0) && (
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    fontStyle: 'italic',
                  }}>No requirements listed.</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function SolicitationCreateModal({
  rfp,                       // target RFP
  activeClaims = [],         // active actor's Claims (filtered by parent)
  requirementsSets = [],     // RS lookup array (Phase 17.2.0.2)
  onSubmit,                  // ({ rfpId, claimId, message }) => void
  onCancel,
}) {
  const [selectedClaimId, setSelectedClaimId] = useState(null)
  const [messageText, setMessageText] = useState('')
  // Phase 17.2.0.2: accordion expansion state. Set so multiple entries
  // can be open simultaneously.
  const [openRsIds, setOpenRsIds] = useState(() => new Set())

  const hasClaims = activeClaims.length > 0
  const canSubmit = hasClaims && !!selectedClaimId

  // Phase 17.2.0.2: build RS lookup from the prop list. Missing entries
  // surface as "(Standard not found)" in the accordion row.
  const rsById = new Map()
  for (const rs of requirementsSets) {
    if (rs && rs.id) rsById.set(rs.id, rs)
  }
  const rfpRsIds = Array.isArray(rfp?.requirementsSetIds) ? rfp.requirementsSetIds : []

  const toggleRs = (rsId) => {
    setOpenRsIds((prev) => {
      const next = new Set(prev)
      if (next.has(rsId)) next.delete(rsId)
      else next.add(rsId)
      return next
    })
  }

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
            {/* Phase 17.2.0.3: RFP description block. Pairs with the
                RfpDetailPanel's description treatment so the modal
                surfaces the buyer-written prose alongside the formal RS
                list. `white-space: pre-wrap` preserves any line breaks
                the buyer included. Empty case mirrors RfpDetailPanel's
                muted-italic "No description provided." fallback. */}
            <div>
              <FieldLabel label="RFP Description" />
              {rfp?.description ? (
                <div style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}>{rfp.description}</div>
              ) : (
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  fontStyle: 'italic',
                }}>No description provided.</div>
              )}
            </div>

            {/* Section divider between RFP Description and Required
                Standards — matches the divider below the accordion. */}
            <div style={{
              height: 1,
              background: 'var(--border)',
              opacity: 0.6,
            }} />

            {/* Phase 17.2.0.2: RS details accordion above the Claim picker
                so the solicitor can review what each RS requires before
                choosing a Claim. */}
            <div>
              <FieldLabel label={`Required Standards (${rfpRsIds.length})`} />
              {rfpRsIds.length > 0 ? (
                <div style={{
                  maxHeight: 240,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                }}>
                  {rfpRsIds.map((rsId) => (
                    <RsAccordionEntry
                      key={rsId}
                      rsId={rsId}
                      rs={rsById.get(rsId) || null}
                      isOpen={openRsIds.has(rsId)}
                      onToggle={() => toggleRs(rsId)}
                    />
                  ))}
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
                }}>No required standards specified.</div>
              )}
            </div>

            {/* Section divider between RS accordion and Claim picker. */}
            <div style={{
              height: 1,
              background: 'var(--border)',
              opacity: 0.6,
            }} />

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
