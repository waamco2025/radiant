// CombinedResponseModal — V2.2 replacement for DisclosureResponseModal.
// Alice responds to Bob's combined request by setting disclosure type, scope,
// and Evaluation Agreement terms in a single sequential flow (spec §7.1 step 4,
// §13 Phase 4). Visual language inherits the V2.1 response modal: four-card
// type grid (Full / Selective / Proof-Only / Decline) per Batches 14–16, then
// a scope step, then an EA-terms step, then a review step.
//
// On accept → V2App flips the provisional DA + EA to active with the chosen
// settings. On decline → V2App removes both provisional artifacts.

import { useState, useEffect } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, DecisionCard, ExpiryPicker, expiryLabel,
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
  request,              // { claim, ownerParty, requesterParty, requesterAsset, message, requestedRequirementsSetIds, proposedEaTerms? }
  referencedAssets = [],   // [{ id, name }] — Assets referenced by the Claim (owned by the grantor)
  parseResults = [],       // [{ id, sourceAssetId, templateName, fields: [{ id, name }] }]
  // Phase 13 (#168): Proof-Only step now picks PoEs instead of individual
  // Eval Results. Each PoE wraps one or more active Eval Results;
  // share-PoE-shares-all auto-discloses every wrapped result.
  poesForClaim = [],       // [{ id, name, owner, wrappedCount, sat, unsat }]
  onAccept,             // ({ type, scope, eaTerms }) => void
  onDecline,            // ({ reason }) => void
  onClose,
  // Phase 11C: when true, hide the DA-type + scope steps and open directly
  // at the EA-Terms review step. Used by the warm-path EA-only response
  // (notification → modal). On accept, fires onAccept with `type: null`,
  // `scope: null`, and just the EA terms; the V2App handler routes to
  // handleV22AcceptEAOnly.
  eaOnlyMode = false,
}) {
  const [action, setAction] = useState(eaOnlyMode ? 'ea-only' : null) // 'full' | 'selective' | 'proofonly' | 'decline' | 'ea-only'
  // EA-only mode opens directly at step 3 (the EA-terms review step).
  const [step, setStep] = useState(eaOnlyMode ? 3 : 1)
  const [selectedAssetIds, setSelectedAssetIds] = useState([])
  const [selectedFieldIds, setSelectedFieldIds] = useState([])
  const [selectedPoeIds, setSelectedPoeIds] = useState([])
  // Phase 11E.1.6 Fix 2: separate DA + EA expiration state. Cold path lets
  // the responder set both independently — DA in Step 2, EA in Step 3.
  // Warm path (eaOnlyMode) doesn't render a DA picker; daExpiry stays at
  // 'none' and is ignored when the submit handler routes to the EA-only
  // path. Default for both = 'none' ("Never expires") per Andrew's call.
  const [daExpiry, setDaExpiry] = useState('none')
  const [daCustomExpiry, setDaCustomExpiry] = useState('')
  const [expiry, setExpiry] = useState('none')
  const [customExpiry, setCustomExpiry] = useState('')
  const [declineReason, setDeclineReason] = useState('')

  // The requester's suggested req sets are surfaced contextually in the Run Eval
  // modal as "SUGGESTED" chips (spec §10.5 — advisory, not enforced). The grantor
  // no longer authorizes a list here; those suggestions ride along on the EA
  // unchanged and are forwarded as the EA's `authorizedRequirementsSetIds` field
  // (preserved for context only). See Phase 6 carry-over #1.

  // Phase 9A.5 #85: Asset picker defaults to zero-selected. Forces the user
  // to explicitly select Assets to disclose — matches the picker-defaults
  // convention in CLAUDE.md. Reset selection whenever the disclosure action
  // changes so switching Full → Selective → Full doesn't carry stale state.
  useEffect(() => {
    setSelectedAssetIds([])
  }, [action])

  // In eaOnlyMode the user lands on step 3 (EA Terms) and progresses to
  // step 4 (Review). Decline path: we show a single decline-reason step
  // (numbered 4) so the StepDots indicator stays meaningful. Otherwise,
  // standard cold-path flow applies.
  const isDecline = action === 'decline'
  const isEaOnly = eaOnlyMode || action === 'ea-only'
  const totalSteps = isEaOnly
    ? (isDecline ? 4 : 4) // EA-only: step 3 (terms) → step 4 (review or decline reason)
    : (isDecline ? 2 : action ? 4 : 1)

  const toggle = (arr, setArr, id) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  // Phase 11E.1.6 Fix 1: align switch cases with the picker's actual
  // emitted ids ('1-year', '2-year', 'none', 'custom'). Pre-fix the switch
  // handled 'never' / '6-months' / '2-years' — none of which the picker
  // emits — so clicking "No expiry" (id 'none') silently fell to the
  // default branch and got coerced to +1 year, despite the UI claiming
  // "Never expires." `null` is a valid downstream value and renders as
  // "Never expires" everywhere (Phase 11E.1.5 copy unification).
  const isoFromPicker = (mode, customDate) => {
    const now = new Date()
    switch (mode) {
      case '1-year': now.setUTCFullYear(now.getUTCFullYear() + 1); return now.toISOString()
      case '2-year': now.setUTCFullYear(now.getUTCFullYear() + 2); return now.toISOString()
      case 'custom': return customDate ? new Date(customDate).toISOString() : null
      case 'none':   return null
      default:       return null
    }
  }
  const computeExpiryIso = () => isoFromPicker(expiry, customExpiry)
  const computeDaExpiryIso = () => isoFromPicker(daExpiry, daCustomExpiry)

  const buildScope = () => {
    if (action === 'full') {
      return {
        // Phase 6.5 #11: full now respects the user's Asset checklist (was
        // hardcoded to all referenced Assets).
        assetIds: [...selectedAssetIds],
        fieldIds: null,
        poeIds: null,
        includeDerivatives: true,
      }
    }
    if (action === 'selective') {
      return {
        assetIds: selectedAssetIds,
        fieldIds: selectedFieldIds,
        poeIds: null,
        includeDerivatives: false,
      }
    }
    if (action === 'proofonly') {
      return {
        assetIds: null,
        fieldIds: null,
        // Phase 13 (#168): proof-only DAs now target PoEs.
        poeIds: [...selectedPoeIds],
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
    // Phase 11C.1: terms are responder-authored. Only `expires` is set here.
    // Acknowledgments live on the provisional EA's `acknowledgmentsAccepted`
    // field (carried through finalize unchanged) — the responder reviews
    // them but doesn't mutate them.
    // Phase 11E.1.6 Fix 2: warm-path EA-only response carries no DA terms
    // (the DA already exists). Cold path emits separate `daTerms` and
    // `eaTerms` so the V2App handler can finalize each artifact's
    // expiration independently.
    if (isEaOnly) {
      onAccept?.({
        type: null,
        scope: null,
        eaTerms: {
          authorizedRequirementsSetIds: request?.requestedRequirementsSetIds || [],
          expires: computeExpiryIso(),
        },
      })
      return
    }
    onAccept?.({
      type: action,
      scope: buildScope(),
      daTerms: {
        expires: computeDaExpiryIso(),
      },
      eaTerms: {
        // §10.5: forward the original requester's suggestions as advisory only.
        authorizedRequirementsSetIds: request?.requestedRequirementsSetIds || [],
        expires: computeExpiryIso(),
      },
    })
  }

  const canAdvanceFromStep1 = action != null
  // Per Phase 6 carry-over #7: Proof-Only requires at least one Eval Result to be
  // selected. Per Phase 6.5 #11: Full now also requires at least one Asset.
  const canAdvanceFromStep2Accept = (
    (action === 'full' && selectedAssetIds.length > 0)
    || (action === 'selective' && selectedFieldIds.length > 0)
    || (action === 'proofonly' && selectedPoeIds.length > 0)
  )
  // Step 3 is now just expiry — always advanceable.
  const canAdvanceFromStep3 = true
  const canSubmitDecline = true // decline reason is optional per spec §11.4

  // Phase 11C.2 W4: header copy branches on (isDecline, isEaOnly).
  // Phase 11E.1.4 Fix 4: accept-path title is now step-aware so the user
  // sees that DA and EA are separate artifacts being responded to in
  // sequence. Decline-path copy is preserved (out of scope this round).
  //
  // Cold path (eaOnlyMode = false):
  //   Step 1-2 (Type / Scope) → "Respond to Disclosure Request"
  //   Step 3   (EA Terms)     → "Respond to Evaluation Request"
  //   Step 4   (Review)       → "Review your Disclosure + Evaluation Agreement Response"
  //
  // Warm path (eaOnlyMode = true):
  //   Step 3 (EA Terms) → "Respond to Evaluation Request" (shared with cold)
  //   Step 4 (Review)   → "Review your Evaluation Agreement Response"
  let acceptTitle
  if (step === 4) {
    acceptTitle = isEaOnly
      ? 'Review your Evaluation Agreement Response'
      : 'Review your Disclosure + Evaluation Agreement Response'
  } else if (isEaOnly || step === 3) {
    acceptTitle = 'Respond to Evaluation Request'
  } else {
    acceptTitle = 'Respond to Disclosure Request'
  }
  const acceptSubtitle = isEaOnly
    ? `${request.requesterParty} has requested an Evaluation Agreement on ${request.claim.name}. Review the proposed terms.`
    : `${request.requesterParty} has requested access to ${request.claim.name}. Set disclosure type, scope, and evaluation terms.`
  const header = isDecline
    ? isEaOnly
      ? { title: 'Decline Evaluation Agreement Request', subtitle: `Decline ${request.requesterParty}'s Evaluation Agreement request. The provisional EA will be removed.` }
      : { title: 'Decline Request', subtitle: `Decline ${request.requesterParty}'s request. Both provisional artifacts (Disclosure + Evaluation) will be deleted.` }
    : { title: acceptTitle, subtitle: acceptSubtitle }

  return (
    <Backdrop onClose={onClose}>
      {/* Phase 11E.1.7 Fix 2: fixed 720px modal height so steps 1-4 (and
          warm-path 3-4) render at a consistent size — the footer button
          row no longer jumps as content varies between steps. ModalBody
          already has `flex: 1, overflow: auto`, so longer steps scroll
          within the body. Capped to 90vh on small screens via the shared
          Modal component's height-prop branch. */}
      <Modal width={780} height={720}>
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
              {/* Phase 11E.1.6 Fix 2: DA expiration picker (Andrew's
                  Option A — DA gets its own expiration grantor-set at
                  response time, mirroring EA). Lives above the scope
                  picker because the user reads top-to-bottom: when does
                  the DA expire, then what's in scope. EA expiration stays
                  on Step 3. Default 'none' ("Never expires") so the
                  responder consciously opts in to a finite term. */}
              <FieldLabel label="Disclosure Agreement expiry" />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                Set when this Disclosure Agreement expires. Until then {request.requesterParty} retains visibility into the items disclosed below per the chosen Disclosure type.
              </div>
              <ExpiryPicker
                expiry={daExpiry}
                setExpiry={setDaExpiry}
                customDate={daCustomExpiry}
                setCustomDate={setDaCustomExpiry}
              />
              {action === 'full' && (
                <>
                  <FieldLabel label="Select Assets to disclose" required />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    Assets in scope will have their <strong>evidence files</strong> revealed to {request.requesterParty}. Pick which referenced Assets to include.
                  </div>
                  {referencedAssets.length === 0 ? (
                    <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                      This Claim has no referenced Assets to disclose.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      {referencedAssets.map((a) => {
                        const sel = selectedAssetIds.includes(a.id)
                        return (
                          <div
                            key={a.id}
                            onClick={() => toggle(selectedAssetIds, setSelectedAssetIds, a.id)}
                            style={{
                              padding: '10px 14px', cursor: 'pointer',
                              background: sel ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'transparent',
                              borderBottom: '1px solid var(--border-faint)',
                              display: 'flex', alignItems: 'center', gap: 10,
                            }}
                          >
                            <div style={{
                              width: 14, height: 14, borderRadius: 3,
                              border: `1.5px solid ${sel ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                              background: sel ? 'var(--accent-indigo)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {sel && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{a.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                    {selectedAssetIds.length} of {referencedAssets.length} Asset{referencedAssets.length !== 1 ? 's' : ''} selected
                  </div>
                  {/* Phase 9A item 7: inline help text when zero Assets are
                      selected. Continue is already disabled at this count;
                      this just makes the reason explicit. */}
                  {referencedAssets.length > 0 && selectedAssetIds.length === 0 && (
                    <div style={{
                      marginTop: 4, fontSize: 11, color: 'var(--accent-amber)',
                      fontStyle: 'italic',
                    }}>
                      Select at least one Asset to continue.
                    </div>
                  )}
                </>
              )}
              {action === 'selective' && (
                <>
                  <FieldLabel label="Select parsed fields to disclose" required />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    With <strong>Selective Disclosure</strong>, only the parsed fields you pick are exposed — the underlying evidence files stay private. (Compare to <strong>Full Disclosure</strong>, which reveals the evidence itself.)
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
                  <FieldLabel label="Select Evaluation Results to share" required />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    {request.requesterParty} will see only the pass/fail outcome of the selected Evaluation Results. No access to raw evidence is granted.
                  </div>
                  {poesForClaim.length === 0 ? (
                    <div style={{
                      padding: 14,
                      background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                      borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
                    }}>
                      No evaluations have been run on <em>{request.claim.name}</em> yet — there is nothing to disclose under Proof-Only.
                      Consider <strong>Full</strong> or <strong>Selective</strong> instead, which give {request.requesterParty} the access required to run an evaluation themselves.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      {poesForClaim.map((poe) => {
                        const selected = selectedPoeIds.includes(poe.id)
                        return (
                          <div
                            key={poe.id}
                            onClick={() => toggle(selectedPoeIds, setSelectedPoeIds, poe.id)}
                            style={{
                              padding: '10px 14px', cursor: 'pointer',
                              background: selected ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)' : 'transparent',
                              borderBottom: '1px solid var(--border-faint)',
                              display: 'flex', alignItems: 'center', gap: 10,
                            }}
                          >
                            <div style={{
                              width: 14, height: 14, borderRadius: 3,
                              border: `1.5px solid ${selected ? 'var(--accent-green)' : 'var(--border-hover)'}`,
                              background: selected ? 'var(--accent-green)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {selected && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                                {poe.name}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                by {poe.owner} · wraps {poe.wrappedCount || 1} · {poe.sat || 0} SAT · {poe.unsat || 0} UNSAT
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                    {selectedPoeIds.length} Proof{selectedPoeIds.length !== 1 ? 's' : ''} of Evaluation selected
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

          {/* STEP 3 — Agreement terms (accept flows only). Per Phase 11C.1
              architectural correction, the responder authors `expires` (the
              only term ahead of pure-platform terms today). The requester's
              acknowledgments — references to the Claim's pre-set
              acknowledgments[] — render as a read-only audit panel. */}
          {step === 3 && !isDecline && (() => {
            const claimAcks = Array.isArray(request?.claim?.acknowledgments) ? request.claim.acknowledgments : []
            const acceptedIds = Array.isArray(request?.proposedEaTerms?.acknowledgmentsAccepted)
              ? request.proposedEaTerms.acknowledgmentsAccepted
              : []
            const acceptedAcks = claimAcks.filter((a) => acceptedIds.includes(a.id))
            return (
              <>
                <FieldLabel label="Evaluation Agreement expiry" />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                  {/* Phase 11E.1.6 Fix 2: copy is now EA-specific. DA
                      expiration was moved to Step 2 (cold path) so this
                      step focuses solely on the EA. Warm path always
                      lands here as Step 3 with no Step 2 to fall back to. */}
                  Set when the Evaluation Agreement expires. {request.requesterParty} may use this EA to evaluate the Claim with any Requirements Set from their library until then
                  {!isEaOnly && request.requestedRequirementsSetIds?.length > 0 && (
                    <> (they suggested: {request.requestedRequirementsSetIds.map((id) => <code key={id} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', background: 'var(--bg-raised)', borderRadius: 3, margin: '0 3px' }}>{id}</code>)})</>
                  )}.
                </div>
                <ExpiryPicker
                  expiry={expiry}
                  setExpiry={setExpiry}
                  customDate={customExpiry}
                  setCustomDate={setCustomExpiry}
                />

                <FieldLabel label="Requester accepted these acknowledgments" />
                {acceptedAcks.length === 0 ? (
                  <div style={{
                    padding: '12px 14px', borderRadius: 6,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6,
                  }}>
                    No acknowledgments were required for this Claim.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.6 }}>
                      The requester accepted these pre-set terms when they submitted the request.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      {acceptedAcks.map((a) => (
                        <ReadonlyAck key={a.id} label={a.title || '(Untitled acknowledgment)'} desc={a.description || ''} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )
          })()}

          {/* STEP 4 — Review (accept flows only) */}
          {step === 4 && !isDecline && (
            <>
              <FieldLabel label="Review your response" />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
                {isEaOnly
                  ? 'Accepting flips the Evaluation Agreement to active. The existing Disclosure Agreement is unaffected.'
                  : 'Accepting creates an active Disclosure Agreement and Evaluation Agreement. Both parties\' canvases will update.'}
              </div>
              {/* Phase 11E.1.7 Fix 1: label column widened from 130 → 230
                  to accommodate "DISCLOSURE AGREEMENT EXPIRES" /
                  "EVALUATION AGREEMENT EXPIRES" without wrapping. Shorter
                  labels sit in extra column space — the labeled-list
                  alignment stays consistent across rows. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                {!isEaOnly && (
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 230, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Disclosure type</div>
                    <div style={{ color: 'var(--text-primary)' }}>{TYPE_DECISIONS.find((d) => d.id === action)?.label}</div>
                  </div>
                )}
                {action === 'selective' && (
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 230, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Fields in scope</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedFieldIds.length}</div>
                  </div>
                )}
                {action === 'full' && (
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 230, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Assets in scope</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedAssetIds.length} of {referencedAssets.length}</div>
                  </div>
                )}
                {action === 'proofonly' && (
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 230, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Eval Results shared</div>
                    <div style={{ color: 'var(--text-primary)' }}>{selectedPoeIds.length}</div>
                  </div>
                )}
                {/* Phase 11E.1.6 Fix 2: cold path shows DA + EA expirations
                    on separate rows. Warm path (no DA in this code path)
                    shows only the EA row.
                    Phase 11E.1.7 Fix 1: full artifact names (was the
                    abbreviated "DA EXPIRES" / "EA EXPIRES"). */}
                {!isEaOnly && (
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 230, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Disclosure Agreement expires</div>
                    <div style={{ color: 'var(--text-primary)' }}>{expiryLabel(daExpiry, daCustomExpiry)}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 230, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Evaluation Agreement expires</div>
                  <div style={{ color: 'var(--text-primary)' }}>{expiryLabel(expiry, customExpiry)}</div>
                </div>
                {(() => {
                  // Phase 11C.1: review step shows the count of acknowledgments
                  // the requester accepted (pre-set terms from the Claim).
                  const acceptedCount = Array.isArray(request?.proposedEaTerms?.acknowledgmentsAccepted)
                    ? request.proposedEaTerms.acknowledgmentsAccepted.length
                    : 0
                  return (
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 230, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Acknowledgments</div>
                      <div style={{ color: 'var(--text-primary)' }}>
                        {acceptedCount === 0 ? 'None required' : `${acceptedCount} accepted`}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </>
          )}

          {/* STEP 4 (decline path in EA-only mode) — reason textarea */}
          {step === 4 && isDecline && isEaOnly && (
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
        </ModalBody>

        <ModalFooter>
          <StepDots current={step} total={totalSteps} />
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Back: only in cold-path; EA-only mode has just two effective
                steps and lands at step 3 with no prior step to return to. */}
            {!isEaOnly && step > 1 && <Btn label="Back" onClick={() => setStep((s) => s - 1)} />}
            {isEaOnly && step === 4 && (
              <Btn label="Back" onClick={() => { setAction('ea-only'); setStep(3) }} />
            )}
            {/* Phase 11C: in EA-only mode, the grantor lands at step 3 with
                a Decline option alongside Continue. Decline routes to step 4
                with a reason textarea. */}
            {isEaOnly && step === 3 && !isDecline && (
              <>
                <Btn label="Decline" danger onClick={() => { setAction('decline'); setStep(4) }} />
                <Btn label="Continue" accent onClick={() => setStep(4)} />
              </>
            )}
            {/* Cold-path Continue button */}
            {!isEaOnly && step < totalSteps && !isDecline && (
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
            {!isEaOnly && step === 1 && isDecline && (
              <Btn label="Continue" danger onClick={() => setStep(2)} />
            )}
            {/* Final Accept / Decline buttons */}
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

// Phase 11C — read-only EA acknowledgment chip surfaced on the response
// modal's EA Terms step. The grantor is reviewing what the requester
// already accepted; the colour signals "this is locked, you can't change
// it." Phase 11C.2 W4: switched from indigo (active) to grey (inactive)
// since indigo read like an actionable checkbox.
function ReadonlyAck({ label, desc }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 3,
        border: `1.5px solid var(--text-dim)`,
        background: 'var(--text-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
      }}>
        <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}
