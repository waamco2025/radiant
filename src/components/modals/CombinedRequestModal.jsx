// CombinedRequestModal — V2.2 cold-path request flow.
// Bob requests a Disclosure Agreement + Evaluation Agreement pair in two
// sequential steps (spec §7.1, §11.6a):
//   Step 1 — Disclosure Agreement
//     • Enter the target Claim's PIN (with live resolution).
//     • (Optional) Suggest one or more Requirements Sets to authorize.
//     • Optional message for the grantor.
//   Step 2 — Evaluation Agreement (Phase 11C / #115)
//     • Set the EA's expiry date (default: 1 year from today).
//     • Acknowledgments: result confidentiality + attribution.
//
// Submission creates a provisional DA + EA pair on the requester's canvas.
// Visual language inherits the V2.1 modal primitives (Backdrop / Modal /
// ModalHeader / ModalBody / ModalFooter, Btn, StepDots).

import { useState, useMemo } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel,
} from './ModalShared'

const PIN_PREFIX = 'PIN-0x'
const DEFAULT_EXPIRY_DAYS = 365

function isValidPinShape(pin) {
  return typeof pin === 'string' && pin.startsWith(PIN_PREFIX) && pin.length >= PIN_PREFIX.length + 8
}

// Default expiry — 1 year from today, formatted as YYYY-MM-DD for the date input.
function defaultExpiryIsoDate() {
  const d = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export default function CombinedRequestModal({
  requesterParty,        // e.g. 'GovCo'
  requesterAsset,        // { id, name, pin } — anchor on the requester's canvas
  availableRequirementsSets = [], // [{ id, name, version }]
  resolveClaimByPin,     // (pin) => { claim, ownerParty } | null
  onSubmit,              // ({ claimPin, claim, selectedRequirementsSetIds, message, eaTerms }) => void
  onClose,
  initialPin = '',                // Phase 7 — AI Shopper pre-populates the target PIN
  initialRequirementsSetIds = [], // Phase 7 — AI Shopper pre-selects its suggested Req Set
}) {
  const [step, setStep] = useState(1)
  const [pin, setPin] = useState(initialPin)
  const [message, setMessage] = useState('')
  const [selectedReqSets, setSelectedReqSets] = useState(() => [...initialRequirementsSetIds])
  // Phase 11C — Step 2 state. Default expiry = today + 1y; both checkboxes
  // default to false (acknowledgments require explicit opt-in).
  const [expiryDate, setExpiryDate] = useState(() => defaultExpiryIsoDate())
  const [resultConfidentiality, setResultConfidentiality] = useState(false)
  const [attribution, setAttribution] = useState(false)

  const trimmed = pin.trim()
  const pinShapeOk = isValidPinShape(trimmed)

  const resolution = useMemo(() => {
    if (!pinShapeOk) return { state: 'idle' }
    const lookup = resolveClaimByPin?.(trimmed)
    if (!lookup || !lookup.claim) return { state: 'missing' }
    if (lookup.ownerParty === requesterParty) return { state: 'self' }
    return { state: 'ok', claim: lookup.claim, ownerParty: lookup.ownerParty }
  }, [trimmed, pinShapeOk, resolveClaimByPin, requesterParty])

  const canAdvanceFromStep1 = resolution.state === 'ok' && !!requesterAsset
  // Step 2 — expiry is optional (empty = "no expiry"); checkboxes default off
  // and don't gate submission. Always advanceable once Step 1 is valid.
  const canSubmit = canAdvanceFromStep1

  const toggleReqSet = (id) => {
    setSelectedReqSets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit?.({
      claimPin: trimmed,
      claim: resolution.claim,
      ownerParty: resolution.ownerParty,
      selectedRequirementsSetIds: selectedReqSets,
      message: message.trim(),
      eaTerms: {
        // Empty string → null (no expiry); else ISO timestamp at end of day UTC.
        expires: expiryDate ? new Date(`${expiryDate}T23:59:59Z`).toISOString() : null,
        resultConfidentiality,
        attribution,
      },
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
              ? 'Step 1 — Disclosure Agreement. Identify the Claim and suggest the Requirements Sets you want to evaluate against.'
              : 'Step 2 — Evaluation Agreement. Set the agreement’s expiry and acknowledgments.'
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
                  border: `1px solid ${resolution.state === 'missing' || resolution.state === 'self' ? 'var(--accent-red)' : 'var(--border)'}`,
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
            </>
          )}

          {/* ─── STEP 2 — Evaluation Agreement (Phase 11C / #115) ─── */}
          {step === 2 && (
            <>
              <FieldLabel label="Agreement expiry" />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                Set when both agreements expire. Defaults to one year from today. Leave blank for no expiry.
              </div>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                style={{
                  width: '100%', height: 38, padding: '0 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  outline: 'none',
                  marginBottom: 22,
                  boxSizing: 'border-box',
                }}
              />

              <FieldLabel label="Acknowledgments" />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                These commitments ride along with the Evaluation Agreement and are surfaced to the grantor for review.
              </div>
              <CheckboxRow
                checked={resultConfidentiality}
                onToggle={() => setResultConfidentiality(v => !v)}
                label="Result confidentiality"
                desc="Evaluation results are for internal use only and will not be shared with third parties."
              />
              <CheckboxRow
                checked={attribution}
                onToggle={() => setAttribution(v => !v)}
                label="Attribution"
                desc="If results are referenced externally (audits, certifications), the evaluator will be credited."
              />
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
