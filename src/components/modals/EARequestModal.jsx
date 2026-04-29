// EARequestModal — Phase 11C / spec §11.6a warm-path Evaluation Agreement
// request flow.
//
// Used when the requester already has an active Disclosure Agreement on the
// target Claim and wants to add an Evaluation Agreement to gain evaluation
// rights. Single-step modal — the DA scope/type is fixed (already
// negotiated), and per the Phase 11C.1 architectural correction the EA's
// terms are responder-authored. The only requester-side action up front is
// acknowledging the Claim owner's pre-set terms (the Claim's
// `acknowledgments[]` array), which the requester must check off before
// submission.
//
// Submission creates a provisional EA referencing the existing active DA.
// The Claim flips to provisional state on the requester's canvas; the
// grantor receives a `v22-request-ea-only` notification and responds via
// CombinedResponseModal in `eaOnlyMode`.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

export default function EARequestModal({
  requesterParty,        // e.g. 'GovCo'
  requesterAsset,        // { id, name } — anchor on the requester's canvas
  claim,                 // { id, name, ownerParty, acknowledgments[] } — target Claim
  ownerParty,            // grantor (= claim.owner)
  existingDisclosureAgreementId, // the active DA's id (warm path anchor)
  availableRequirementsSets = [], // [{ id, name, version }]
  onSubmit,              // ({ claim, ownerParty, existingDisclosureAgreementId, requesterAsset, selectedRequirementsSetIds, message, acknowledgmentsAccepted }) => void
  onClose,
}) {
  const [message, setMessage] = useState('')
  const [selectedReqSets, setSelectedReqSets] = useState([])
  const [ackChecked, setAckChecked] = useState(new Set())

  const claimAcks = Array.isArray(claim?.acknowledgments) ? claim.acknowledgments : []
  const allAcksChecked = claimAcks.every((a) => ackChecked.has(a.id))
  const canSubmit = allAcksChecked

  const toggleReqSet = (id) => {
    setSelectedReqSets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleAck = (ackId) => {
    setAckChecked((prev) => {
      const next = new Set(prev)
      if (next.has(ackId)) next.delete(ackId)
      else next.add(ackId)
      return next
    })
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit?.({
      claim,
      ownerParty,
      existingDisclosureAgreementId,
      requesterAsset,
      selectedRequirementsSetIds: selectedReqSets,
      message: message.trim(),
      acknowledgmentsAccepted: claimAcks
        .filter((a) => ackChecked.has(a.id))
        .map((a) => a.id),
    })
  }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={640}>
        <ModalHeader
          title="Request Evaluation Agreement"
          subtitle={`Request evaluation rights on ${claim?.name || 'this Claim'} from ${ownerParty}. Your existing Disclosure Agreement remains in place. ${ownerParty} sets the agreement's terms when they respond.`}
          onClose={onClose}
        />

        <ModalBody>
          {/* Context — who's requesting and against what */}
          <div style={{
            padding: '12px 16px', borderRadius: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            marginBottom: 20,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Requester</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{requesterParty}</div>
            </div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Target</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{claim?.name} <span style={{ color: 'var(--text-secondary)' }}>— {ownerParty}</span></div>
            </div>
            {requesterAsset && (
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Anchor</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{requesterAsset.name}</div>
              </div>
            )}
          </div>

          {/* Phase 11C.1: acknowledgments — required gate before Submit. */}
          <FieldLabel label={`Acknowledge ${ownerParty}'s terms`} required={claimAcks.length > 0} />
          {claimAcks.length === 0 ? (
            <div style={{
              padding: '14px 16px', borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, var(--border))',
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
              marginBottom: 22,
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>{ownerParty}</strong> has set no acknowledgments on this Claim. You can proceed directly.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                Before requesting an Evaluation Agreement, please acknowledge the following terms set by <strong style={{ color: 'var(--text-secondary)' }}>{ownerParty}</strong>. All acknowledgments are required.
              </div>
              {claimAcks.map((a) => (
                <CheckboxRow
                  key={a.id}
                  checked={ackChecked.has(a.id)}
                  onToggle={() => toggleAck(a.id)}
                  label={a.title || '(Untitled acknowledgment)'}
                  desc={a.description || ''}
                />
              ))}
            </>
          )}

          <FieldLabel label="Requested Requirements Sets (optional)" />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.6 }}>
            Suggest the Requirements Sets you'd like to evaluate against. The grantor decides which to authorize in their response.
          </div>
          <div style={{
            maxHeight: 200, overflowY: 'auto',
            border: '1px solid var(--border)', borderRadius: 8,
            marginBottom: 22,
          }}>
            {availableRequirementsSets.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                No Requirements Sets available in your library.
              </div>
            ) : (
              availableRequirementsSets.map((rs) => {
                const selected = selectedReqSets.includes(rs.id)
                return (
                  <div
                    key={rs.id}
                    onClick={() => toggleReqSet(rs.id)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      background: selected ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'transparent',
                      borderBottom: '1px solid var(--border-faint)',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--bg-raised)' }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: 3,
                      border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                      background: selected ? 'var(--accent-indigo)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {selected && (
                        <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{rs.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {rs.id} · v{rs.version ?? 1}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <FieldLabel label="Message (optional)" />
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Briefly explain the context of this request…"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
        </ModalBody>

        <ModalFooter>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Will request from <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{ownerParty}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Send Request" accent disabled={!canSubmit} onClick={handleSubmit} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}

// Acknowledgment checkbox row — same visual rhythm as
// CombinedRequestModal Step 2.
function CheckboxRow({ checked, onToggle, label, desc }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '12px 14px',
        marginBottom: 10,
        cursor: 'pointer',
        background: checked ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'var(--bg-card)',
        border: `1px solid ${checked ? 'color-mix(in srgb, var(--accent-indigo) 35%, var(--border))' : 'var(--border)'}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'flex-start', gap: 12,
        transition: 'background 120ms, border 120ms',
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: 3,
        border: `1.5px solid ${checked ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
        background: checked ? 'var(--accent-indigo)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
      }}>
        {checked && (
          <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
        {desc && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
        )}
      </div>
    </div>
  )
}
