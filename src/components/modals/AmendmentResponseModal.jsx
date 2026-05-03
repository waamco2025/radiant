// AmendmentResponseModal — Phase 11.6 (#164) / spec §11.2a major revision.
//
// Grantee-side response to an Evaluation Agreement amendment proposal.
// Opens when the grantee clicks a `v22-ea-amendment-proposal` notification.
// The grantor (Claim owner) submitted a proposal that's now sitting on
// the EA with `status: 'pending-acceptance'`; the matching amendment
// record on the EA's `amendments[]` carries the proposed snapshot
// (acknowledgment changes + expiration change) plus the grantor's
// optional message.
//
// Three sections in the body:
//   1. Acknowledgment changes — diff display per change kind:
//      • added (green +): new acknowledgment, full content
//      • edited (yellow ~): before/after side-by-side
//      • removed (red −): original content, strikethrough
//      Each change row has a checkbox the grantee must tick to accept.
//   2. Expiration change — single confirm checkbox if the proposal
//      changed terms.evaluationDeadline. Hidden when expiration is
//      unchanged.
//   3. Response message — optional textarea, free-text response that
//      flows into the accept/reject notification on the grantor's side.
//
// Footer: Reject (left, always enabled) + Accept (right, gated on every
// change checkbox + the expiration confirm checkbox if shown). Both
// fire response handlers that flip the EA back to `status: 'active'`
// and enqueue the appropriate notification on the grantor's inbox.
//
// Accept also mutates the Claim's acknowledgments[] to match the
// proposal's snapshot. Reject leaves the Claim untouched.

import { useMemo, useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'

function formatDateOnly(iso) {
  if (!iso) return 'Never expires'
  return iso.slice(0, 10)
}

function ChangeBadge({ kind }) {
  const palette = {
    added:   { bg: 'color-mix(in srgb, var(--accent-green) 15%, transparent)', border: 'color-mix(in srgb, var(--accent-green) 35%, transparent)', color: 'var(--accent-green)', label: 'ADDED' },
    edited:  { bg: 'color-mix(in srgb, var(--accent-amber) 15%, transparent)', border: 'color-mix(in srgb, var(--accent-amber) 35%, transparent)', color: 'var(--accent-amber)', label: 'EDITED' },
    removed: { bg: 'color-mix(in srgb, var(--accent-red) 15%, transparent)',   border: 'color-mix(in srgb, var(--accent-red) 35%, transparent)',   color: 'var(--accent-red)',   label: 'REMOVED' },
  }[kind] || { bg: 'var(--bg-raised)', border: 'var(--border)', color: 'var(--text-tertiary)', label: kind?.toUpperCase() || '' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      letterSpacing: '0.08em',
      color: palette.color,
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: 3,
      flexShrink: 0,
    }}>{palette.label}</span>
  )
}

function ChangeRow({ kind, children, checked, onToggle }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          onClick={onToggle}
          style={{
            width: 16, height: 16, borderRadius: 3, marginTop: 1,
            border: `1.5px solid ${checked ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
            background: checked ? 'var(--accent-indigo)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: 'pointer', transition: 'all 120ms',
          }}
        >
          {checked && <span style={{ color: 'var(--bg-deep)', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ChangeBadge kind={kind} />
          {children}
        </div>
      </div>
    </div>
  )
}

export default function AmendmentResponseModal({
  agreement,        // the EA the proposal is on
  claim,            // the underlying Claim
  amendment,        // the pending amendment record (status: 'pending')
  onAccept,         // ({ responseMessage }) => void
  onReject,         // ({ responseMessage }) => void
  onClose,          // () => void
}) {
  const granterParty = agreement.grantor.party
  const granteeParty = agreement.grantee.party

  // Amendment proposal data — already split into added/edited/removed
  // by the grantor's submit handler via `diffAcknowledgments`.
  const acksAdded = amendment?.acknowledgmentChanges?.added || []
  const acksEdited = amendment?.acknowledgmentChanges?.edited || []
  const acksRemoved = amendment?.acknowledgmentChanges?.removed || []
  const allChanges = useMemo(() => [
    ...acksAdded.map((a) => ({ kind: 'added', key: `added-${a.id}`, ack: a })),
    ...acksEdited.map((e) => ({ kind: 'edited', key: `edited-${e.id}`, edit: e })),
    ...acksRemoved.map((a) => ({ kind: 'removed', key: `removed-${a.id}`, ack: a })),
  ], [acksAdded, acksEdited, acksRemoved])

  // Expiration delta — present when the proposal's `proposed.evaluationDeadline`
  // differs from `termsBefore.evaluationDeadline` at YYYY-MM-DD precision.
  const proposedDeadline = amendment?.proposed?.evaluationDeadline ?? null
  const beforeDeadline = amendment?.termsBefore?.evaluationDeadline ?? null
  const toDateOnly = (iso) => (iso ? iso.slice(0, 10) : null)
  const expiryChanged = toDateOnly(beforeDeadline) !== toDateOnly(proposedDeadline)

  // Per-change checkbox state — Accept requires every change ticked.
  // Stored as an object keyed by change.key for stable React.
  const [changeAcks, setChangeAcks] = useState(() => {
    const init = {}
    for (const c of allChanges) init[c.key] = false
    return init
  })
  const [expiryAck, setExpiryAck] = useState(false)
  const [responseMessage, setResponseMessage] = useState('')

  const allChangesTicked = allChanges.every((c) => changeAcks[c.key])
  const expiryOk = !expiryChanged || expiryAck
  const canAccept = allChangesTicked && expiryOk
  const noChanges = allChanges.length === 0 && !expiryChanged

  const toggleChangeAck = (key) => {
    setChangeAcks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleAccept = () => {
    if (!canAccept) return
    onAccept?.({ responseMessage: responseMessage.trim() })
  }
  const handleReject = () => {
    onReject?.({ responseMessage: responseMessage.trim() })
  }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={720} height={720}>
        <ModalHeader
          title="Amendment Proposal"
          subtitle={(
            <>
              <strong>{granterParty}</strong> has proposed an amendment to your
              Evaluation Agreement on Claim <strong>{claim.name}</strong>.
              Review each change and accept or reject the proposal. While
              this proposal is pending, evaluations on this Claim under
              this Evaluation Agreement are paused.
            </>
          )}
          onClose={onClose}
        />
        <ModalBody>
          {/* Grantor's optional proposal message at the top */}
          {amendment?.proposalMessage && (
            <div style={{
              padding: '12px 14px',
              background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
              borderRadius: 6,
              marginBottom: 18,
            }}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--accent-indigo)', marginBottom: 6,
              }}>
                Message from {granterParty}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{amendment.proposalMessage}"
              </div>
            </div>
          )}

          {/* Acknowledgment changes */}
          {allChanges.length > 0 && (
            <>
              <FieldLabel label={`Acknowledgment changes (${allChanges.length})`} required />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                Tick each change to confirm you accept it. All boxes must
                be ticked to accept the proposal.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {allChanges.map((c) => {
                  if (c.kind === 'added') {
                    return (
                      <ChangeRow key={c.key} kind="added" checked={changeAcks[c.key]} onToggle={() => toggleChangeAck(c.key)}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {c.ack.title || '(untitled)'}
                        </div>
                        {c.ack.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {c.ack.description}
                          </div>
                        )}
                      </ChangeRow>
                    )
                  }
                  if (c.kind === 'edited') {
                    return (
                      <ChangeRow key={c.key} kind="edited" checked={changeAcks[c.key]} onToggle={() => toggleChangeAck(c.key)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Before</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'line-through', textDecorationColor: 'var(--accent-amber)' }}>
                            {c.edit.before?.title || '(untitled)'}
                          </div>
                          {c.edit.before?.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', textDecoration: 'line-through', lineHeight: 1.5 }}>
                              {c.edit.before.description}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>After</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {c.edit.after?.title || '(untitled)'}
                          </div>
                          {c.edit.after?.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {c.edit.after.description}
                            </div>
                          )}
                        </div>
                      </ChangeRow>
                    )
                  }
                  return (
                    <ChangeRow key={c.key} kind="removed" checked={changeAcks[c.key]} onToggle={() => toggleChangeAck(c.key)}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                        {c.ack.title || '(untitled)'}
                      </div>
                      {c.ack.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', textDecoration: 'line-through', lineHeight: 1.5 }}>
                          {c.ack.description}
                        </div>
                      )}
                    </ChangeRow>
                  )
                })}
              </div>
            </>
          )}

          {/* Expiration change */}
          {expiryChanged && (
            <>
              <FieldLabel label="Expiration change" required />
              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: 18,
              }}>
                <div
                  onClick={() => setExpiryAck((v) => !v)}
                  style={{
                    width: 16, height: 16, borderRadius: 3, marginTop: 1,
                    border: `1.5px solid ${expiryAck ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                    background: expiryAck ? 'var(--accent-indigo)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, cursor: 'pointer', transition: 'all 120ms',
                  }}
                >
                  {expiryAck && <span style={{ color: 'var(--bg-deep)', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  Expiration: <span style={{ color: 'var(--text-secondary)' }}>{formatDateOnly(beforeDeadline)}</span> → <strong>{formatDateOnly(proposedDeadline)}</strong>
                </div>
              </div>
            </>
          )}

          {noChanges && (
            <div style={{
              padding: '14px',
              background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
              borderRadius: 6,
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
              marginBottom: 18,
            }}>
              This proposal contains no acknowledgment or expiration changes. You can accept or reject as a no-op.
            </div>
          )}

          <FieldLabel label="Response message (optional)" />
          <textarea
            rows={3}
            value={responseMessage}
            onChange={(e) => setResponseMessage(e.target.value)}
            placeholder={`Optional message back to ${granterParty}…`}
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
            {canAccept
              ? 'All changes confirmed — ready to accept.'
              : `${allChanges.filter((c) => changeAcks[c.key]).length}/${allChanges.length} changes confirmed${expiryChanged ? `, expiration ${expiryAck ? 'confirmed' : 'pending'}` : ''}.`
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="Reject Proposal" danger onClick={handleReject} />
            <Btn label="Accept Proposal" accent disabled={!canAccept} onClick={handleAccept} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
