// CombinedRequestModal — V2.2 cold-path request flow.
// Bob requests a Disclosure Agreement + Evaluation Agreement pair in two
// sequential steps (spec §7.1, §11.6a):
//   Step 1 — Disclosure Agreement
//     • Enter the target Claim's PIN (with live resolution).
//     • (Optional) Suggest one or more Requirements Sets to authorize.
//     • Optional message for the grantor.
//   Step 2 — Acknowledge the Claim owner's terms (Phase 11C.1 architectural
//     correction): the Claim's pre-set `acknowledgments[]` render as required
//     checkboxes. All must be checked before Submit enables. If the Claim
//     has no acknowledgments, the step explains the user can proceed directly.
//     The agreement's expiry + responder-authored terms are set by the
//     responder on accept (CombinedResponseModal Step 3).
//
// Submission creates a provisional DA + EA pair on the requester's canvas
// carrying the ids of the acknowledgments the requester checked
// (`acknowledgmentsAccepted`).

import { useState, useMemo } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel,
} from './ModalShared'

const PIN_PREFIX = 'PIN-0x'

// Phase 17.2.1.1 — globe icon, matches the LibraryModal / BadgesPanel /
// RequirementsPanel convention. Indicates a Requirements Set is published
// on the public network.
function GlobeIcon({ size = 11, color = 'var(--accent-blue)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  )
}

function isValidPinShape(pin) {
  return typeof pin === 'string' && pin.startsWith(PIN_PREFIX) && pin.length >= PIN_PREFIX.length + 8
}

export default function CombinedRequestModal({
  requesterParty,        // e.g. 'GovCo'
  requesterAsset,        // { id, name, pin } — anchor on the requester's canvas
  availableRequirementsSets = [], // [{ id, name, version }]
  resolveClaimByPin,     // (pin) => { claim, ownerParty } | null
  // Phase 11D #134: ids of Claims already on the requester's canvas via an
  // active DA. PIN resolution flags these as `already-disclosed` so the user
  // can't fire a duplicate request when a satisfactory agreement is in place.
  claimsOnRequesterCanvas,
  onSubmit,              // ({ claimPin, claim, selectedRequirementsSetIds, message, eaTerms }) => void
  onClose,
  initialPin = '',                // Phase 7 — AI Shopper pre-populates the target PIN
  initialRequirementsSetIds = [], // Phase 7 — AI Shopper pre-selects its suggested Req Set
}) {
  const [step, setStep] = useState(1)
  const [pin, setPin] = useState(initialPin)
  const [message, setMessage] = useState('')
  const [selectedReqSets, setSelectedReqSets] = useState(() => [...initialRequirementsSetIds])
  // Phase 11C.1 — Step 2 state: ids of the Claim's acknowledgments that the
  // requester has checked. All required acknowledgments must be checked
  // before Submit enables (when the Claim has any).
  const [ackChecked, setAckChecked] = useState(new Set())

  const trimmed = pin.trim()
  const pinShapeOk = isValidPinShape(trimmed)

  const resolution = useMemo(() => {
    if (!pinShapeOk) return { state: 'idle' }
    const lookup = resolveClaimByPin?.(trimmed)
    if (!lookup || !lookup.claim) return { state: 'missing' }
    if (lookup.ownerParty === requesterParty) return { state: 'self' }
    // Phase 11D #134: a Claim already on the requester's canvas means an
    // active DA exists — re-requesting would create an orphan. Surface as
    // `already-disclosed` so Submit is gated and the user is steered to
    // the Detail Panel.
    if (claimsOnRequesterCanvas?.has?.(lookup.claim.id)) {
      return { state: 'already-disclosed', claim: lookup.claim, ownerParty: lookup.ownerParty }
    }
    return { state: 'ok', claim: lookup.claim, ownerParty: lookup.ownerParty }
  }, [trimmed, pinShapeOk, resolveClaimByPin, requesterParty, claimsOnRequesterCanvas])

  const canAdvanceFromStep1 = resolution.state === 'ok' && !!requesterAsset
  const claimAcks = (resolution.state === 'ok' ? resolution.claim?.acknowledgments : null) || []
  const allAcksChecked = claimAcks.every((a) => ackChecked.has(a.id))
  // Step 2 enables submission only when every Claim ack has been checked.
  // Zero-ack Claims trivially satisfy the "all checked" gate.
  const canSubmit = canAdvanceFromStep1 && allAcksChecked

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
      claimPin: trimmed,
      claim: resolution.claim,
      ownerParty: resolution.ownerParty,
      selectedRequirementsSetIds: selectedReqSets,
      message: message.trim(),
      // Phase 11C.1: forward the ids the requester checked. Zero-ack Claims
      // produce an empty array (audit-trail still records "nothing required").
      acknowledgmentsAccepted: claimAcks
        .filter((a) => ackChecked.has(a.id))
        .map((a) => a.id),
    })
  }

  const totalSteps = 2

  return (
    <Backdrop onClose={onClose}>
      <Modal width={640}>
        <ModalHeader
          title="Request Agreement"
          subtitle={
            step === 1
              ? 'Step 1 — Identify the Claim. The owner sets the agreement’s terms when they respond; only their pre-set acknowledgments require your action up front.'
              : 'Step 2 — Acknowledge the Claim owner’s pre-set terms. All required acknowledgments must be checked before submission.'
          }
          step={step}
          totalSteps={totalSteps}
          onClose={onClose}
        />

        <ModalBody>
          {/* Context — who's requesting and against what (always visible) */}
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
            {requesterAsset && (
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Anchor</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{requesterAsset.name}</div>
              </div>
            )}
            {step === 2 && resolution.state === 'ok' && (
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Target</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                  {resolution.claim.name} <span style={{ color: 'var(--text-secondary)' }}>— {resolution.ownerParty}</span>
                </div>
              </div>
            )}
          </div>

          {/* ─── STEP 1 — Disclosure Agreement ───────────────────── */}
          {step === 1 && (
            <>
              <FieldLabel label="Claim PIN" required />
              <input
                type="text"
                autoFocus
                spellCheck={false}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN-0x..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  border: `1px solid ${['missing', 'self', 'already-disclosed'].includes(resolution.state) ? 'var(--accent-red)' : 'var(--border)'}`,
                  borderRadius: 6,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <div style={{ minHeight: 22, marginTop: 6, marginBottom: 18 }}>
                {resolution.state === 'ok' && (
                  <div style={{ fontSize: 11, color: 'var(--accent-green)' }}>
                    ✓ Found: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{resolution.claim.name}</span>
                    {' — '}
                    <span style={{ color: 'var(--text-secondary)' }}>{resolution.ownerParty}</span>
                  </div>
                )}
                {resolution.state === 'missing' && trimmed.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>PIN not found on the network.</div>
                )}
                {resolution.state === 'self' && (
                  <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>This Claim is owned by you — no agreement needed.</div>
                )}
                {resolution.state === 'already-disclosed' && (
                  <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>
                    This Claim is already on your network.
                  </div>
                )}
              </div>

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
                    // Phase 17.2.1.1 — published RSes carry isPublished +
                    // ownerParty so the row can render a globe icon and a
                    // "Published by {owner}" line. Rows without those
                    // fields render in the pre-17.2.1.1 minimal form.
                    const isPublished = !!rs.isPublished
                    const ownerParty = rs.ownerParty || null
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
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isPublished && <GlobeIcon size={11} />}
                            <span>{rs.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
                              v{rs.version ?? 1}
                            </span>
                          </div>
                          {isPublished && ownerParty && (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                              Published by <span style={{ color: 'var(--text-secondary)' }}>{ownerParty}</span>
                            </div>
                          )}
                          {!isPublished && (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                              {rs.id}
                            </div>
                          )}
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
            </>
          )}

          {/* ─── STEP 2 — Acknowledge the Claim owner's terms (Phase 11C.1) ─── */}
          {step === 2 && (
            <>
              <FieldLabel label={`Acknowledge ${resolution.ownerParty || 'the Claim owner'}'s terms`} required={claimAcks.length > 0} />
              {claimAcks.length === 0 ? (
                <div style={{
                  padding: '14px 16px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, var(--border))',
                  fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{resolution.ownerParty || 'The Claim owner'}</strong> has set no acknowledgments on this Claim. You can proceed directly.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    Before requesting access, please acknowledge the following terms set by <strong style={{ color: 'var(--text-secondary)' }}>{resolution.ownerParty}</strong>. All acknowledgments are required.
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
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <StepDots current={step} total={totalSteps} />
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && <Btn label="Back" onClick={() => setStep((s) => s - 1)} />}
            {step < totalSteps && (
              <Btn label="Continue" accent disabled={!canAdvanceFromStep1} onClick={() => setStep((s) => s + 1)} />
            )}
            {step === totalSteps && (
              <Btn label="Send Request" accent disabled={!canSubmit} onClick={handleSubmit} />
            )}
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}

// Phase 11C — checkbox row for EA acknowledgments. Same visual rhythm as
// the request modal's Req Set picker rows but a single line + description.
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
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}
