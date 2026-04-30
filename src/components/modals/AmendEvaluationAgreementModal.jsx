// AmendEvaluationAgreementModal — Phase 11E.1 / spec §11.2a.
//
// The Claim owner unilaterally amends the Evaluation Agreements they have
// granted. Two amendable surfaces:
//   1. `terms.evaluationDeadline` — the EA's expiration date.
//   2. The underlying Claim's `acknowledgments[]` — Option B (prototype)
//      mutates the Claim directly, NOT a per-EA snapshot. The EA's
//      `acknowledgmentsAccepted` audit-trail field is preserved.
//
// On submit, V2App's handler stages both the amended EA + the mutated Claim
// atomically, then enqueues a single `v22-ea-amendment` notification on the
// EA grantee's inbox.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, ExpiryPicker,
} from './ModalShared'

function formatDateTime(iso) {
  if (!iso) return 'No expiry'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} · ${hh}:${min} UTC`
}

function AcknowledgmentCard({ ack, onChange, onRemove }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input
          type="text"
          value={ack.title}
          onChange={(e) => onChange({ ...ack, title: e.target.value })}
          placeholder="Acknowledgment title…"
          style={{
            flex: 1, minWidth: 0,
            padding: '6px 10px',
            fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            background: 'var(--bg-deep)', border: '1px solid var(--border)',
            borderRadius: 4, outline: 'none',
          }}
        />
        <button
          onClick={onRemove}
          style={{
            padding: '4px 10px',
            fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: 'var(--accent-red)',
            background: 'transparent',
            border: '1px solid color-mix(in srgb, var(--accent-red) 35%, transparent)',
            borderRadius: 4, cursor: 'pointer',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-red) 10%, transparent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          REMOVE
        </button>
      </div>
      <textarea
        rows={3}
        value={ack.description}
        onChange={(e) => onChange({ ...ack, description: e.target.value })}
        placeholder="Description of what the requester is acknowledging…"
        style={{
          width: '100%', padding: '8px 10px', boxSizing: 'border-box',
          fontSize: 11, fontFamily: 'var(--font-display)',
          color: 'var(--text-secondary)', lineHeight: 1.5,
          background: 'var(--bg-deep)', border: '1px solid var(--border)',
          borderRadius: 4, outline: 'none', resize: 'vertical',
        }}
      />
    </div>
  )
}

export default function AmendEvaluationAgreementModal({
  agreement,
  claim,
  onSubmit,
  onClose,
}) {
  // Initial expiry state derived from the EA's current evaluationDeadline.
  // Pre-fills the picker to 'custom' so the user adjusts from the existing
  // value instead of re-entering. Uses the existing ExpiryPicker option
  // ids ('1-year', '2-year', 'none', 'custom') — the picker doesn't expose
  // '6-months' / '2-years' / 'never' as user-clickable options, so we map
  // null → 'none' and any non-null deadline → 'custom' with prefill.
  const initialDeadline = agreement.terms?.evaluationDeadline ?? null
  const [expiry, setExpiry] = useState(initialDeadline ? 'custom' : 'none')
  const [customExpiry, setCustomExpiry] = useState(
    initialDeadline ? initialDeadline.slice(0, 10) : '',
  )

  const [acknowledgments, setAcknowledgments] = useState(
    (claim.acknowledgments || []).map((a) => ({ ...a })),
  )
  const [note, setNote] = useState('')

  const computeExpiryIso = () => {
    const now = new Date()
    switch (expiry) {
      case '1-year':
        now.setUTCFullYear(now.getUTCFullYear() + 1); return now.toISOString()
      case '2-year':
        now.setUTCFullYear(now.getUTCFullYear() + 2); return now.toISOString()
      case 'custom':
        return customExpiry ? new Date(customExpiry).toISOString() : null
      case 'none':
        return null
      default:
        return initialDeadline
    }
  }

  const updateAck = (idx, next) => {
    setAcknowledgments((prev) => prev.map((a, i) => (i === idx ? next : a)))
  }
  const removeAck = (idx) => {
    setAcknowledgments((prev) => prev.filter((_, i) => i !== idx))
  }
  const addAck = () => {
    const id = `ack-${claim.id}-${Date.now().toString(36)}`
    setAcknowledgments((prev) => [...prev, { id, title: '', description: '' }])
  }

  // Diff vs initial state — drives footer summary + Submit gating.
  const initialAcks = claim.acknowledgments || []
  const computedIso = computeExpiryIso()
  const expiryChanged = (initialDeadline ?? null) !== (computedIso ?? null)

  const acksAdded = acknowledgments.filter(
    (a) => !initialAcks.find((x) => x.id === a.id),
  )
  const acksRemoved = initialAcks.filter(
    (a) => !acknowledgments.find((x) => x.id === a.id),
  )
  const acksEdited = acknowledgments.filter((a) => {
    const initial = initialAcks.find((x) => x.id === a.id)
    if (!initial) return false
    return initial.title !== a.title || initial.description !== a.description
  })
  const acksChanged = acksAdded.length > 0 || acksRemoved.length > 0 || acksEdited.length > 0

  const hasChanges = expiryChanged || acksChanged

  // Block submission when newly-added or edited acknowledgments have empty
  // titles — keeps the underlying Claim from gaining unnamed acks.
  const allAcksValid = acknowledgments.every((a) => (a.title || '').trim().length > 0)
  const canSubmit = hasChanges && allAcksValid

  // Footer summary copy.
  const summaryParts = []
  if (expiryChanged) summaryParts.push('Expiration changed')
  if (acksAdded.length > 0) summaryParts.push(`${acksAdded.length} acknowledgment${acksAdded.length === 1 ? '' : 's'} added`)
  if (acksRemoved.length > 0) summaryParts.push(`${acksRemoved.length} removed`)
  if (acksEdited.length > 0) summaryParts.push(`${acksEdited.length} edited`)
  const summaryText = summaryParts.length === 0 ? 'No changes' : summaryParts.join(' · ')

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit?.({
      terms: { evaluationDeadline: computedIso },
      acknowledgments: acknowledgments.map((a) => ({
        id: a.id,
        title: a.title.trim(),
        description: (a.description || '').trim(),
      })),
      note: note.trim(),
    })
  }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={680}>
        <ModalHeader
          title="Amend Evaluation Agreement"
          subtitle={`Update the expiration date and acknowledgments for the Evaluation Agreement to ${agreement.grantee.party}. Changes are unilateral — ${agreement.grantee.party} will be notified and may revoke if they don't accept the new terms.`}
          onClose={onClose}
        />
        <ModalBody>
          <FieldLabel label="Expiration" />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
            Current: {formatDateTime(initialDeadline)}
          </div>
          <ExpiryPicker
            expiry={expiry}
            setExpiry={setExpiry}
            customDate={customExpiry}
            setCustomDate={setCustomExpiry}
          />

          <FieldLabel label={`Acknowledgments (${acknowledgments.length})`} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
            Acknowledgments live on the Claim. Edits here update the underlying Claim and apply to all current Evaluation Agreements on it. Only this Agreement's grantee is notified.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {acknowledgments.length === 0 ? (
              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-card)', border: '1px dashed var(--border)',
                borderRadius: 6,
                fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
              }}>
                No acknowledgments on this Claim.
              </div>
            ) : (
              acknowledgments.map((ack, idx) => (
                <AcknowledgmentCard
                  key={ack.id}
                  ack={ack}
                  onChange={(next) => updateAck(idx, next)}
                  onRemove={() => removeAck(idx)}
                />
              ))
            )}
          </div>
          <button
            onClick={addAck}
            style={{
              padding: '8px 14px',
              fontSize: 11, fontWeight: 600,
              color: 'var(--accent-indigo)',
              background: 'transparent',
              border: '1px dashed color-mix(in srgb, var(--accent-indigo) 40%, transparent)',
              borderRadius: 6, cursor: 'pointer',
              marginBottom: 18,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            + Add acknowledgment
          </button>

          <FieldLabel label="Amendment note (optional)" />
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Briefly describe what's changing and why…"
            style={{
              width: '100%', padding: '10px 12px',
              fontSize: 12, fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, boxSizing: 'border-box', outline: 'none', resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
        </ModalBody>
        <ModalFooter>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {summaryText}
            {hasChanges && !allAcksValid && (
              <span style={{ color: 'var(--accent-amber)', marginLeft: 8 }}>
                · Acknowledgments must have a title.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Amend Evaluation Agreement" accent disabled={!canSubmit} onClick={handleSubmit} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
