// CombinedResponseModal — V2.2 replacement for DisclosureResponseModal.
// Alice responds to Bob's combined request by setting disclosure type, scope,
// and Evaluation Agreement terms in a single sequential flow (spec §7.1 step 4,
// §13 Phase 4). Visual language inherits the V2.1 response modal: four-card
// type grid (Full / Selective / Proof-Only / Decline) per Batches 14–16, then
// a scope step, then an EA-terms step, then a review step.
//
// On accept → V2App flips the provisional DA + EA to active with the chosen
// settings. On decline → V2App removes both provisional artifacts.

import { useState, useMemo, useEffect } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, DecisionCard, SDATypeCard, ExpiryPicker, expiryLabel,
} from './ModalShared'

/* Step layout per action:
 *   full / selective / proofonly → 4 steps: Type → Scope → EA Terms → Review
 *   decline                       → 2 steps: Type → Decline Reason
 */

const TYPE_DECISIONS = [
  { id: 'full',       label: 'Full',        desc: 'Evaluators can extract data fields and run evaluations.', color: '#7e8ef8',            icon: '◆' },
  { id: 'selective',  label: 'Selective',   desc: 'Evaluators can run evaluations on specific fields only.', color: '#fbbf24',            icon: '◇' },
  { id: 'proofonly',  label: 'Proof-Only',  desc: 'Share a pass/fail result only. No access to evidence.',   color: '#36d49a',            icon: '◎' },
  { id: 'decline',    label: 'Decline',     desc: 'Reject the request. Both provisional artifacts are deleted.', color: 'var(--accent-red)', icon: '✕' },
]

export default function CombinedResponseModal({
  request,              // { claim, ownerParty, requesterParty, requesterAsset, message, provisionalDisclosureAgreement, provisionalEvaluationAgreement, requestedRequirementsSetIds }
  referencedAssets = [],  // [{ id, name }] — Assets referenced by the Claim (owned by Alice)
  parseResults = [],    // [{ id, sourceAssetId, templateName, fields: [{ id, name }] }] — Alice's parse results on her referenced assets
  availableRequirementsSets = [],
  onAccept,             // ({ type, scope, eaTerms }) => void
  onDecline,            // ({ reason }) => void
  onClose,
}) {
  const [action, setAction] = useState(null) // 'full' | 'selective' | 'proofonly' | 'decline'
  const [step, setStep] = useState(1)
  const [selectedAssetIds, setSelectedAssetIds] = useState([])
  const [selectedFieldIds, setSelectedFieldIds] = useState([])
  const [authorizedReqSetIds, setAuthorizedReqSetIds] = useState([])
  const [expiry, setExpiry] = useState('1-year')
  const [customExpiry, setCustomExpiry] = useState('')
  const [declineReason, setDeclineReason] = useState('')

  // Prime authorized req sets from the requester's suggested list.
  useEffect(() => {
    if (request?.requestedRequirementsSetIds?.length && authorizedReqSetIds.length === 0) {
      setAuthorizedReqSetIds([...request.requestedRequirementsSetIds])
    }
  }, [request, authorizedReqSetIds.length])

  // Prime selected assets — default to all referenced assets for Full, none for Selective.
  useEffect(() => {
    if (action === 'full' && selectedAssetIds.length === 0) {
      setSelectedAssetIds(referencedAssets.map((a) => a.id))
    }
  }, [action, referencedAssets, selectedAssetIds.length])

  const totalSteps = action === 'decline' ? 2 : action ? 4 : 1
  const isDecline = action === 'decline'

  const toggle = (arr, setArr, id) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  const computeExpiryIso = () => {
    const now = new Date()
    switch (expiry) {
      case '6-months': now.setUTCMonth(now.getUTCMonth() + 6); return now.toISOString()
      case '1-year':   now.setUTCFullYear(now.getUTCFullYear() + 1); return now.toISOString()
      case '2-years':  now.setUTCFullYear(now.getUTCFullYear() + 2); return now.toISOString()
      case 'custom':   return customExpiry ? new Date(customExpiry).toISOString() : null
      case 'never':    return null
      default:         now.setUTCFullYear(now.getUTCFullYear() + 1); return now.toISOString()
    }
  }

  const buildScope = () => {
    if (action === 'full') {
      return {
        assetIds: referencedAssets.map((a) => a.id),
        fieldIds: null,
        evaluationResultIds: null,
        includeDerivatives: true,
      }
    }
    if (action === 'selective') {
      return {
        assetIds: selectedAssetIds,
        fieldIds: selectedFieldIds,
        evaluationResultIds: null,
        includeDerivatives: false,
      }
    }
    if (action === 'proofonly') {
      return {
        assetIds: null,
        fieldIds: null,
        evaluationResultIds: null,
        includeDerivatives: false,
      }
    }
    return null
  }

  const handleSubmit = () => {
    if (action === 'decline') {
      onDecline?.({ reason: declineReason.trim() })
      return
    }
    onAccept?.({
      type: action,
      scope: buildScope(),
      eaTerms: {
        authorizedRequirementsSetIds: authorizedReqSetIds,
        expires: computeExpiryIso(),
      },
    })
  }

  const canAdvanceFromStep1 = action != null
  const canAdvanceFromStep2Accept = action === 'full' || (selectedAssetIds.length > 0 || (action === 'selective' && selectedFieldIds.length > 0)) || action === 'proofonly'
  const canAdvanceFromStep3 = authorizedReqSetIds.length > 0
  const canSubmitDecline = true // decline reason is optional per spec §11.4

  const header = isDecline
    ? { title: 'Decline Request', subtitle: `Decline ${request.requesterParty}'s request. Both provisional artifacts (Disclosure + Evaluation) will be deleted.` }
    : { title: 'Respond to Request', subtitle: `${request.requesterParty} has requested access to ${request.claim.name}. Set disclosure type, scope, and evaluation terms.` }

  return (
    <Backdrop onClose={onClose}>
      <Modal width={780}>
        <ModalHeader
          title={header.title}
          subtitle={header.subtitle}
          step={step}
          totalSteps={totalSteps}
          onClose={onClose}
        />

        <ModalBody>
          {/* Request summary (always visible) */}
          <div style={{
            padding: '12px 16px', borderRadius: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            marginBottom: 24,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Requester</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{request.requesterParty}</div>
            </div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Claim</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{request.claim.name}</div>
            </div>
            {request.message && (
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 90 }}>Message</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>"{request.message}"</div>
              </div>
            )}
          </div>

          {/* STEP 1 — Type decision (four-card grid) */}
          {step === 1 && (
            <>
              <FieldLabel label="Select how you'd like to respond" required />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 8 }}>
                {TYPE_DECISIONS.map((d) => (
                  <DecisionCard
                    key={d.id}
                    id={d.id}
                    label={d.label}
                    desc={d.desc}
                    color={d.color}
                    icon={d.icon}
                    active={action === d.id}
                    onClick={() => setAction(d.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* STEP 2 — Scope (or decline reason) */}
          {step === 2 && !isDecline && (
            <>
              {action === 'full' && (
                <>
                  <FieldLabel label="Full Disclosure — all referenced Assets will be shared" />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    With Full Disclosure, {request.requesterParty} gets access to every Asset referenced by this Claim.
                    You can't deselect individual Assets at this type (choose Selective if you want finer control).
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    {referencedAssets.map((a) => (
                      <div key={a.id} style={{
                        padding: '10px 14px', borderRadius: 6,
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        fontSize: 12, color: 'var(--text-primary)',
                        display: 'flex', gap: 10, alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-tertiary)', padding: '1px 6px', background: 'var(--bg-raised)', borderRadius: 3 }}>ASSET</span>
                        <span>{a.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {action === 'selective' && (
                <>
                  <FieldLabel label="Select fields from parsed Assets to disclose" required />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    Pick individual fields extracted by your Parse Results. Only selected fields will be exposed to {request.requesterParty}.
                  </div>
                  {parseResults.length === 0 ? (
                    <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                      No parsed Assets available. Selective Disclosure requires at least one Parse Result on a referenced Asset.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      {parseResults.map((pr) => (
                        <div key={pr.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                          <div style={{ padding: '8px 12px', background: 'var(--bg-raised)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                            {pr.templateName}
                          </div>
                          {pr.fields.map((f) => {
                            const fieldKey = `${pr.id}::${f.id}`
                            const selected = selectedFieldIds.includes(fieldKey)
                            return (
                              <div
                                key={fieldKey}
                                onClick={() => toggle(selectedFieldIds, setSelectedFieldIds, fieldKey)}
                                style={{
                                  padding: '8px 14px', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  background: selected ? 'color-mix(in srgb, var(--accent-amber) 8%, transparent)' : 'transparent',
                                  borderBottom: '1px solid var(--border-faint)',
                                  transition: 'background 120ms',
                                }}
                              >
                                <div style={{
                                  width: 14, height: 14, borderRadius: 3,
                                  border: `1.5px solid ${selected ? 'var(--accent-amber)' : 'var(--border-hover)'}`,
                                  background: selected ? 'var(--accent-amber)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {selected && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                                </div>
                                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{f.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                    {selectedFieldIds.length} field{selectedFieldIds.length !== 1 ? 's' : ''} selected
                  </div>
                </>
              )}
              {action === 'proofonly' && (
                <>
                  <FieldLabel label="Proof-Only Disclosure — share an evaluation result only" />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    {request.requesterParty} will see the pass/fail status of an evaluation run. No access to raw evidence. A Proof-of-Evaluation Disclosure is created when you run an evaluation under this agreement.
                  </div>
                </>
              )}
            </>
          )}

          {/* STEP 2 (decline path) — reason textarea */}
          {step === 2 && isDecline && (
            <>
              <FieldLabel label="Decline reason (optional)" />
              <textarea
                rows={4}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Explain why you're declining (optional — falls back to 'No reason given')"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 12,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: 1.5,
                }}
              />
            </>
          )}

          {/* STEP 3 — EA terms (accept flows only) */}
          {step === 3 && !isDecline && (
            <>
              <FieldLabel label="Authorize Requirements Sets for evaluation" required />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                {request.requesterParty} may run evaluations using <em>only</em> the Requirements Sets you authorize here.
                {request.requestedRequirementsSetIds?.length > 0 && (
                  <> They suggested: {request.requestedRequirementsSetIds.map((id) => <code key={id} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', background: 'var(--bg-raised)', borderRadius: 3, margin: '0 3px' }}>{id}</code>)}.</>
                )}
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 22 }}>
                {availableRequirementsSets.map((rs) => {
                  const selected = authorizedReqSetIds.includes(rs.id)
                  const suggested = request.requestedRequirementsSetIds?.includes(rs.id)
                  return (
                    <div
                      key={rs.id}
                      onClick={() => toggle(authorizedReqSetIds, setAuthorizedReqSetIds, rs.id)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        background: selected ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'transparent',
                        borderBottom: '1px solid var(--border-faint)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 3,
                        border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                        background: selected ? 'var(--accent-indigo)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selected && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{rs.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{rs.id} · v{rs.version ?? 1}</div>
                      </div>
                      {suggested && (
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)', padding: '2px 6px', background: 'color-mix(in srgb, var(--accent-amber) 10%, transparent)', borderRadius: 3 }}>SUGGESTED</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <FieldLabel label="Agreement expiry" />
              <ExpiryPicker
                expiry={expiry}
                setExpiry={setExpiry}
                customDate={customExpiry}
                setCustomDate={setCustomExpiry}
              />
            </>
          )}

          {/* STEP 4 — Review (accept flows only) */}
          {step === 4 && !isDecline && (
            <>
              <FieldLabel label="Review your response" />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
                Accepting creates an active Disclosure Agreement and Evaluation Agreement. Both parties' canvases will update.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 130, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Disclosure type</div>
                  <div style={{ color: 'var(--text-primary)' }}>{TYPE_DECISIONS.find((d) => d.id === action)?.label}</div>
                </div>
                {action === 'selective' && (
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 130, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Fields in scope</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedFieldIds.length}</div>
                  </div>
                )}
                {action === 'full' && (
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 130, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Assets in scope</div>
                    <div style={{ color: 'var(--text-primary)' }}>{referencedAssets.length}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 130, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Req sets authorized</div>
                  <div style={{ color: 'var(--text-primary)' }}>{authorizedReqSetIds.length}</div>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 130, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Agreement expires</div>
                  <div style={{ color: 'var(--text-primary)' }}>{expiryLabel(expiry, customExpiry)}</div>
                </div>
              </div>
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <StepDots current={step} total={totalSteps} />
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && <Btn label="Back" onClick={() => setStep((s) => s - 1)} />}
            {step < totalSteps && !isDecline && (
              <Btn
                label="Continue"
                accent
                disabled={
                  (step === 1 && !canAdvanceFromStep1) ||
                  (step === 2 && !canAdvanceFromStep2Accept) ||
                  (step === 3 && !canAdvanceFromStep3)
                }
                onClick={() => setStep((s) => s + 1)}
              />
            )}
            {step === 1 && isDecline && (
              <Btn label="Continue" danger onClick={() => setStep(2)} />
            )}
            {step === totalSteps && !isDecline && (
              <Btn label="Accept" accent onClick={handleSubmit} />
            )}
            {step === totalSteps && isDecline && (
              <Btn label="Decline" danger onClick={handleSubmit} disabled={!canSubmitDecline} />
            )}
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}

// Silence unused-import lint in projects that don't use the imported helper.
void SDATypeCard
