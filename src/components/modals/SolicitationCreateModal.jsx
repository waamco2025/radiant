// Phase 17.2 / 18.3 — Solicitor's UI to create an RFP Solicitation.
//
// Phase 18.3 restructures this from a single-step Claim picker into a 4-step
// flow that mints a paired Disclosure Agreement alongside the solicitation:
//   Step 1 — Required Standards accordion + Claim picker
//   Step 2 — Disclosure Type (Full / Selective / Proof-Only; no Decline)
//   Step 3 — Disclosure Agreement expiry + scope picker + message
//   Step 4 — Review
//
// On submit, onSubmit fires { rfpId, claimId, message, disclosureType, scope,
// daExpiryIso } — V2App's handleCreateSolicitation mints the RfpSolicitation
// AND a Disclosure Agreement (grantor = solicitor, grantee = RFP owner,
// subject = the offered Claim) atomically, links them by id, and fires the
// v22-rfp-solicitation-received notification. The DA gives the RFP owner real
// visibility into the offered Claim instead of just a message + reference.
//
// Visual primitives mirror CombinedResponseModal's directoryPublishMode flow
// (Phase 18.2.2). Shared bits (DecisionCard, ExpiryPicker, StepDots) come from
// ModalShared; isoFromPicker + the SdaLine + the 3-card type set are inlined
// locally to avoid a cross-modal import on CombinedResponseModal.

import { useState, useEffect } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, DecisionCard, ExpiryPicker, expiryLabel, StepDots,
} from './ModalShared'
import Tooltip from '../Tooltip'

const MESSAGE_MAX_CHARS = 500

// Phase 18.3: disclosure-type cards (no Decline — you never decline your own
// outgoing solicitation). Mirrors CombinedResponseModal's TYPE_DECISIONS minus
// the decline entry; defined locally to avoid a cross-modal import.
const TYPE_DECISIONS_NO_DECLINE = [
  { id: 'full',      label: 'Full',       desc: 'Evaluators can extract data fields and run evaluations.', color: '#7e8ef8', icon: '◆' },
  { id: 'selective', label: 'Selective',  desc: 'Evaluators can run evaluations on specific fields only.', color: '#fbbf24', icon: '◇' },
  { id: 'proofonly', label: 'Proof-Only', desc: 'Share a pass/fail result only. No access to evidence.',   color: '#36d49a', icon: '◎' },
]

const PROOF_ONLY_DISABLED_TOOLTIP =
  'This Claim has no Proofs of Evaluation yet. Run an evaluation under an Evaluation Agreement to create one.'

const DISCLOSURE_LABEL = { full: 'Full', selective: 'Selective', proofonly: 'Proof-Only' }

// Phase 18.3: ISO from the ExpiryPicker selection — mirror of
// CombinedResponseModal's isoFromPicker, inlined to avoid a cross-modal dep.
// `customDate` is the date-input string emitted by the shared ExpiryPicker.
function isoFromPicker(mode, customDate) {
  const now = new Date()
  switch (mode) {
    case '1-year': now.setUTCFullYear(now.getUTCFullYear() + 1); return now.toISOString()
    case '2-year': now.setUTCFullYear(now.getUTCFullYear() + 2); return now.toISOString()
    case 'custom': return customDate ? new Date(customDate).toISOString() : null
    case 'none':   return null
    default:       return null
  }
}

// Phase 18.3: disclosure-type line illustration for the Step 4 review
// (indigo solid / amber dashed / green dotted). Inlined to avoid coupling to
// Detail-Panel internals.
const SDA_LINE_CFG = {
  full:      { color: 'var(--accent-indigo)', dash: null },
  selective: { color: 'var(--accent-amber)',  dash: '6 3' },
  proofonly: { color: 'var(--accent-green)',  dash: '2 3' },
}
function SdaLine({ type }) {
  const cfg = SDA_LINE_CFG[type] || SDA_LINE_CFG.full
  return (
    <svg width={22} height={8} viewBox="0 0 22 8" aria-hidden style={{ flexShrink: 0 }}>
      <line x1="1" y1="4" x2="21" y2="4" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={cfg.dash || undefined} />
    </svg>
  )
}

// Checkbox primitive shared by the Full / Selective / Proof-Only scope pickers.
function Check({ checked, color = 'var(--accent-indigo)' }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: 3, flexShrink: 0,
      border: `1.5px solid ${checked ? color : 'var(--border-hover)'}`,
      background: checked ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </div>
  )
}

const LIST_STYLE = { maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }
const EMPTY_STYLE = { padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-dim)' }
const REVIEW_LABEL = { fontSize: 11, color: 'var(--text-tertiary)', minWidth: 210, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', flexShrink: 0 }

// Phase 17.2.0.2: accordion entry for a single Requirements Set. Closed shows
// name + version pill + chevron; open expands to show the RS's requirements.
function RsAccordionEntry({ rsId, rs, isOpen, onToggle }) {
  const missing = !rs
  const chevron = isOpen ? '▾' : '▸'
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={onToggle}
        style={{
          padding: '10px 14px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 10,
          background: isOpen ? 'var(--bg-raised)' : 'transparent',
          transition: 'background 120ms',
        }}
        onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-raised)' }}
        onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', width: 12, textAlign: 'center', flexShrink: 0 }}>{chevron}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: missing ? 'var(--text-dim)' : 'var(--text-primary)', wordBreak: 'break-word' }}>{missing ? rsId : rs.name}</span>
        {!missing && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-deep)', textTransform: 'uppercase', flexShrink: 0 }}>v{rs.version}</span>
        )}
      </div>
      {isOpen && (
        <div style={{ padding: '6px 14px 12px 36px', background: 'var(--bg-deep)' }}>
          {missing ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>(Standard not found)</div>
          ) : (
            <>
              {rs.description && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.5 }}>{rs.description}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(rs.requirements || []).map((req) => (
                  <div key={req.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-tertiary)', padding: '2px 5px', borderRadius: 3, background: 'var(--bg-deep)', textTransform: 'uppercase', flexShrink: 0 }}>{req.id}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, wordBreak: 'break-word' }}>{req.label || req.description}</span>
                    </div>
                    {req.label && req.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, paddingLeft: 2 }}>{req.description}</div>
                    )}
                    {req.criterion && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, paddingLeft: 2, fontStyle: 'italic' }}>Criterion: {req.criterion}</div>
                    )}
                  </div>
                ))}
                {(!rs.requirements || rs.requirements.length === 0) && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>No requirements listed.</div>
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
  evaluationAgreements = [], // Phase 17.2.1.1: grey-out already-on-network Claims
  solicitorParty = null,     // Phase 17.2.1.1: the solicitor's party
  // Phase 18.3: per-Claim scope sources, sliced at V2App mount time. Follow the
  // CombinedResponseModal contract so the Step 3 picker primitives transfer.
  referencedAssetsByClaim = {},  // { [claimId]: [{ id, name }] }
  parseResultsByClaim = {},      // { [claimId]: [{ id, sourceAssetId, templateName, fields: [{id,name}] }] }
  poesByClaim = {},              // { [claimId]: [{ id, name, owner, wrappedCount, sat, unsat }] }
  onSubmit,                  // ({ rfpId, claimId, message, disclosureType, scope, daExpiryIso }) => void
  onCancel,
}) {
  const [step, setStep] = useState(1)
  const [selectedClaimId, setSelectedClaimId] = useState(null)
  const [openRsIds, setOpenRsIds] = useState(() => new Set())
  // Phase 18.3 — Steps 2–3 state.
  const [disclosureType, setDisclosureType] = useState(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState(() => new Set())
  const [selectedFieldIds, setSelectedFieldIds] = useState(() => new Set())
  const [selectedPoeIds, setSelectedPoeIds] = useState(() => new Set())
  const [expiry, setExpiry] = useState('none')
  const [customExpiry, setCustomExpiry] = useState('')
  const [messageText, setMessageText] = useState('')

  // Reset scope picks whenever the disclosure type or the selected Claim
  // changes — switching never carries stale selections.
  useEffect(() => {
    setSelectedAssetIds(new Set())
    setSelectedFieldIds(new Set())
    setSelectedPoeIds(new Set())
  }, [disclosureType, selectedClaimId])

  const totalSteps = 4

  // Phase 17.2.1.1: Claims already on the buyer's network (active/provisional EA).
  const buyerParty = rfp?.owner || null
  const claimsOnBuyerNetwork = new Map()
  if (buyerParty && solicitorParty) {
    for (const ea of evaluationAgreements) {
      if (!ea) continue
      if (ea._declineMeta || ea._revokedMeta) continue
      if (ea.grantor?.party !== solicitorParty) continue
      if (ea.grantee?.party !== buyerParty) continue
      if (ea.claimId) claimsOnBuyerNetwork.set(ea.claimId, true)
    }
  }
  const isClaimOnBuyerNetwork = (claimId) => claimsOnBuyerNetwork.has(claimId)

  const hasClaims = activeClaims.length > 0
  const selectedClaim = selectedClaimId ? activeClaims.find((c) => c.id === selectedClaimId) : null

  // Scope sources for the selected Claim.
  const refAssets = selectedClaimId ? (referencedAssetsByClaim[selectedClaimId] || []) : []
  const parseResults = selectedClaimId ? (parseResultsByClaim[selectedClaimId] || []) : []
  const poes = selectedClaimId ? (poesByClaim[selectedClaimId] || []) : []
  const proofOnlyDisabled = poes.length === 0

  // Selective: assets that have ≥1 picked field (composite key `${pr.id}::${f.id}`).
  const selectiveAssetIds = [...new Set(
    parseResults
      .filter((pr) => (pr.fields || []).some((f) => selectedFieldIds.has(`${pr.id}::${f.id}`)))
      .map((pr) => pr.sourceAssetId),
  )]

  // Step gating.
  const canAdvanceFromStep1 = !!selectedClaimId && !isClaimOnBuyerNetwork(selectedClaimId)
  const canAdvanceFromStep2 = disclosureType !== null
  const canAdvanceFromStep3 = (
    (disclosureType === 'full' && selectedAssetIds.size > 0)
    || (disclosureType === 'selective' && selectedFieldIds.size > 0)
    || (disclosureType === 'proofonly' && selectedPoeIds.size > 0)
  )
  const canSubmit = canAdvanceFromStep1 && canAdvanceFromStep2 && canAdvanceFromStep3

  // Toggle helpers (Set-backed).
  const toggleSet = (setter) => (id) => setter((prev) => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const toggleAsset = toggleSet(setSelectedAssetIds)
  const toggleField = toggleSet(setSelectedFieldIds)
  const togglePoe = toggleSet(setSelectedPoeIds)

  const buildScope = () => {
    if (disclosureType === 'full') return { assetIds: [...selectedAssetIds], fieldIds: null, poeIds: null, includeDerivatives: true }
    if (disclosureType === 'selective') return { assetIds: selectiveAssetIds, fieldIds: [...selectedFieldIds], poeIds: null, includeDerivatives: false }
    if (disclosureType === 'proofonly') return { assetIds: null, fieldIds: null, poeIds: [...selectedPoeIds], includeDerivatives: false }
    return null
  }

  // RS lookup for the accordion.
  const rsById = new Map()
  for (const rs of requirementsSets) { if (rs && rs.id) rsById.set(rs.id, rs) }
  const rfpRsIds = Array.isArray(rfp?.requirementsSetIds) ? rfp.requirementsSetIds : []
  const toggleRs = (rsId) => setOpenRsIds((prev) => {
    const n = new Set(prev)
    if (n.has(rsId)) n.delete(rsId); else n.add(rsId)
    return n
  })

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit?.({
      rfpId: rfp.id,
      claimId: selectedClaimId,
      message: messageText.trim(),
      disclosureType,
      scope: buildScope(),
      daExpiryIso: isoFromPicker(expiry, customExpiry),
    })
  }

  const headerTitle = step === totalSteps
    ? 'Review your Solicitation'
    : `Solicit '${rfp?.name || 'RFP'}' with my Claim`
  const headerSubtitle = step === totalSteps
    ? `Confirm before sending to ${rfp?.owner || 'the RFP owner'}. A Disclosure Agreement is created so they can see the Claim you're offering.`
    : "Pick one of your Claims to offer against this RFP, choose how much of it to disclose, then send it to the RFP owner."

  return (
    <Backdrop onClose={onCancel}>
      <Modal width={680} height={720}>
        <ModalHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          step={step}
          totalSteps={totalSteps}
          onClose={onCancel}
        />
        <ModalBody>
          {/* ─── STEP 1 — Required Standards + Claim picker ───────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <FieldLabel label="RFP Description" />
                {rfp?.description ? (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{rfp.description}</div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>No description provided.</div>
                )}
              </div>

              <div style={{ height: 1, background: 'var(--border)', opacity: 0.6 }} />

              <div>
                <FieldLabel label={`Required Standards (${rfpRsIds.length})`} />
                {rfpRsIds.length > 0 ? (
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)' }}>
                    {rfpRsIds.map((rsId) => (
                      <RsAccordionEntry key={rsId} rsId={rsId} rs={rsById.get(rsId) || null} isOpen={openRsIds.has(rsId)} onToggle={() => toggleRs(rsId)} />
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-deep)', fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>No required standards specified.</div>
                )}
              </div>

              <div style={{ height: 1, background: 'var(--border)', opacity: 0.6 }} />

              <div>
                <FieldLabel label="Your Claim" required />
                {hasClaims ? (
                  <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)' }}>
                    {activeClaims.map((c) => {
                      const isSelected = selectedClaimId === c.id
                      const refCount = Array.isArray(c.referencedAssetIds) ? c.referencedAssetIds.length : 0
                      const isGreyed = isClaimOnBuyerNetwork(c.id)
                      const tooltipText = isGreyed && buyerParty ? `Already on ${buyerParty}'s network` : undefined
                      return (
                        <div
                          key={c.id}
                          title={tooltipText}
                          onClick={isGreyed ? undefined : () => setSelectedClaimId(c.id)}
                          style={{
                            padding: '10px 14px', borderBottom: '1px solid var(--border)',
                            cursor: isGreyed ? 'not-allowed' : 'pointer',
                            opacity: isGreyed ? 0.45 : 1,
                            background: isSelected ? 'color-mix(in srgb, var(--accent-indigo) 12%, var(--bg-card))' : 'transparent',
                            borderLeft: isSelected ? '3px solid var(--accent-indigo)' : '3px solid transparent',
                            transition: 'background 120ms',
                          }}
                          onMouseEnter={(e) => { if (isGreyed) return; if (!isSelected) e.currentTarget.style.background = 'var(--bg-raised)' }}
                          onMouseLeave={(e) => { if (isGreyed) return; if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid ' + (isSelected ? 'var(--accent-indigo)' : 'var(--text-dim)'), background: isSelected ? 'var(--accent-indigo)' : 'transparent', boxShadow: isSelected ? 'inset 0 0 0 2.5px var(--bg-card)' : 'none', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, wordBreak: 'break-word' }}>{c.name || c.id}</span>
                            {isGreyed && (
                              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 3, background: 'var(--bg-raised)', border: '1px solid var(--border)', textTransform: 'uppercase', flexShrink: 0 }}>ON NETWORK</span>
                            )}
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-deep)', textTransform: 'uppercase', flexShrink: 0 }}>{c.owner}</span>
                          </div>
                          {/* Phase 18.3.0.1: surface parse-result + PoE counts alongside
                              referenced assets so the user can see at a glance which Claims
                              support Selective (needs parse results) or Proof-Only (needs
                              PoEs) disclosure in Step 2. Counts come from the per-Claim props
                              V2App's mount already threads. Zero counts are shown, not
                              suppressed — "0 PoEs" is itself informative. */}
                          {(() => {
                            const parseCount = (parseResultsByClaim[c.id] || []).length
                            const poeCount = (poesByClaim[c.id] || []).length
                            const parts = [
                              `${refCount} referenced asset${refCount === 1 ? '' : 's'}`,
                              `${parseCount} parse result${parseCount === 1 ? '' : 's'}`,
                              `${poeCount} PoE${poeCount === 1 ? '' : 's'}`,
                            ]
                            return (
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', paddingLeft: 24, fontFamily: 'var(--font-mono)' }}>{parts.join(' • ')}</div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-deep)', fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>You have no Claims to solicit with.</div>
                )}
                {hasClaims && !selectedClaimId && (
                  <div style={{ fontSize: 11, color: 'var(--accent-amber)', fontStyle: 'italic', marginTop: 8 }}>Select at least one Claim to continue.</div>
                )}
              </div>
            </div>
          )}

          {/* ─── STEP 2 — Disclosure type ─────────────────────────────── */}
          {step === 2 && (
            <>
              <FieldLabel label="Choose disclosure type" required />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                Decide how much of <strong>{selectedClaim?.name || 'this Claim'}</strong> {rfp?.owner || 'the RFP owner'} can see through this solicitation.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
                {TYPE_DECISIONS_NO_DECLINE.map((d) => {
                  const isProofDisabled = d.id === 'proofonly' && proofOnlyDisabled
                  const card = (
                    <DecisionCard
                      id={d.id}
                      label={d.label}
                      desc={d.desc}
                      color={d.color}
                      icon={d.icon}
                      disabled={isProofDisabled}
                      active={disclosureType === d.id}
                      onClick={() => setDisclosureType(d.id)}
                    />
                  )
                  return isProofDisabled
                    ? <Tooltip key={d.id} content={PROOF_ONLY_DISABLED_TOOLTIP}>{card}</Tooltip>
                    : <div key={d.id} style={{ display: 'flex' }}>{card}</div>
                })}
              </div>
            </>
          )}

          {/* ─── STEP 3 — DA expiry + scope + message ─────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <FieldLabel label="Disclosure Agreement expiry" required />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                  Set when this Disclosure Agreement expires. Until then {rfp?.owner || 'the RFP owner'} retains visibility into the items disclosed below per the chosen Disclosure type. Acts as the solicitation's expiration.
                </div>
                <ExpiryPicker expiry={expiry} setExpiry={setExpiry} customDate={customExpiry} setCustomDate={setCustomExpiry} />
              </div>

              {/* Full — Asset checkbox list */}
              {disclosureType === 'full' && (
                <div>
                  <FieldLabel label="Select Assets to disclose" required />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    Assets in scope will have their <strong>evidence files</strong> revealed to {rfp?.owner || 'the RFP owner'}. Pick which referenced Assets to include.
                  </div>
                  {refAssets.length === 0 ? (
                    <div style={EMPTY_STYLE}>This Claim has no referenced Assets to disclose.</div>
                  ) : (
                    <div style={LIST_STYLE}>
                      {refAssets.map((a) => {
                        const sel = selectedAssetIds.has(a.id)
                        return (
                          <div key={a.id} onClick={() => toggleAsset(a.id)} style={{ padding: '10px 14px', cursor: 'pointer', background: sel ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'transparent', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Check checked={sel} />
                            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{a.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>{selectedAssetIds.size} of {refAssets.length} Asset{refAssets.length !== 1 ? 's' : ''} selected</div>
                  {refAssets.length > 0 && selectedAssetIds.size === 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--accent-amber)', fontStyle: 'italic' }}>Select at least one Asset to continue.</div>
                  )}
                </div>
              )}

              {/* Selective — per-Parse-Result field picker */}
              {disclosureType === 'selective' && (
                <div>
                  <FieldLabel label="Select parsed fields to disclose" required />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    With <strong>Selective Disclosure</strong>, only the parsed fields you pick are exposed — the underlying evidence files stay private.
                  </div>
                  {parseResults.length === 0 ? (
                    <div style={EMPTY_STYLE}>No parsed Assets available. Selective Disclosure requires at least one Parse Result on a referenced Asset.</div>
                  ) : (
                    <div style={LIST_STYLE}>
                      {parseResults.map((pr) => (
                        <div key={pr.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                          <div style={{ padding: '8px 12px', background: 'var(--bg-raised)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{pr.templateName}</div>
                          {(pr.fields || []).map((f) => {
                            const fieldKey = `${pr.id}::${f.id}`
                            const selected = selectedFieldIds.has(fieldKey)
                            return (
                              <div key={fieldKey} onClick={() => toggleField(fieldKey)} style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: selected ? 'color-mix(in srgb, var(--accent-amber) 8%, transparent)' : 'transparent', borderBottom: '1px solid var(--border-faint)', transition: 'background 120ms' }}>
                                <Check checked={selected} color="var(--accent-amber)" />
                                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{f.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>{selectedFieldIds.size} field{selectedFieldIds.size !== 1 ? 's' : ''} selected</div>
                </div>
              )}

              {/* Proof-Only — PoE checkbox list */}
              {disclosureType === 'proofonly' && (
                <div>
                  <FieldLabel label="Select Proofs of Evaluation to share" required />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
                    {rfp?.owner || 'The RFP owner'} will see only the pass/fail outcome of the selected Proofs of Evaluation. No access to raw evidence is granted.
                  </div>
                  {poes.length === 0 ? (
                    <div style={EMPTY_STYLE}>No Proofs of Evaluation available. Proof-Only Disclosure requires at least one Proof of Evaluation on this Claim.</div>
                  ) : (
                    <div style={LIST_STYLE}>
                      {poes.map((poe) => {
                        const selected = selectedPoeIds.has(poe.id)
                        return (
                          <div key={poe.id} onClick={() => togglePoe(poe.id)} style={{ padding: '10px 14px', cursor: 'pointer', background: selected ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)' : 'transparent', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Check checked={selected} color="var(--accent-green)" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{poe.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>by {poe.owner} · wraps {poe.wrappedCount || 1} · {poe.sat || 0} SAT · {poe.unsat || 0} UNSAT</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>{selectedPoeIds.size} Proof{selectedPoeIds.size !== 1 ? 's' : ''} of Evaluation selected</div>
                </div>
              )}

              {/* Message to RFP owner — moved from Step 1 */}
              <div>
                <FieldLabel label="Message to RFP owner" />
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
                  placeholder="Add a note to the RFP owner (optional)…"
                  rows={3}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textAlign: 'right', marginTop: 4 }}>{messageText.length} / {MESSAGE_MAX_CHARS}</div>
              </div>
            </div>
          )}

          {/* ─── STEP 4 — Review ──────────────────────────────────────── */}
          {step === 4 && (
            <>
              <FieldLabel label="Review your solicitation" />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
                Submitting sends the solicitation to {rfp?.owner || 'the RFP owner'} and creates an active Disclosure Agreement granting them visibility into the offered Claim.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 14 }}><div style={REVIEW_LABEL}>For RFP</div><div style={{ color: 'var(--text-primary)' }}>{rfp?.name || '—'}</div></div>
                <div style={{ display: 'flex', gap: 14 }}><div style={REVIEW_LABEL}>From</div><div style={{ color: 'var(--text-primary)' }}>{solicitorParty || '—'}</div></div>
                <div style={{ display: 'flex', gap: 14 }}><div style={REVIEW_LABEL}>To</div><div style={{ color: 'var(--text-primary)' }}>{rfp?.owner || '—'}</div></div>
                <div style={{ display: 'flex', gap: 14 }}><div style={REVIEW_LABEL}>Claim being offered</div><div style={{ color: 'var(--text-primary)' }}>{selectedClaim?.name || '—'}</div></div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={REVIEW_LABEL}>Disclosure type</div>
                  <div style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <SdaLine type={disclosureType} />{DISCLOSURE_LABEL[disclosureType] || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={REVIEW_LABEL}>Scope</div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    {disclosureType === 'full' && `${selectedAssetIds.size} of ${refAssets.length} Asset${refAssets.length !== 1 ? 's' : ''}`}
                    {disclosureType === 'selective' && `${selectedFieldIds.size} field${selectedFieldIds.size !== 1 ? 's' : ''} across ${selectiveAssetIds.length} Asset${selectiveAssetIds.length !== 1 ? 's' : ''}`}
                    {disclosureType === 'proofonly' && `${selectedPoeIds.size} Proof${selectedPoeIds.size !== 1 ? 's' : ''} of Evaluation`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14 }}><div style={REVIEW_LABEL}>Disclosure Agreement expires</div><div style={{ color: 'var(--text-primary)' }}>{expiryLabel(expiry, customExpiry)}</div></div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={REVIEW_LABEL}>Message</div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1, wordBreak: 'break-word' }}>
                    {messageText.trim() ? `"${messageText.trim().slice(0, 200)}${messageText.trim().length > 200 ? '…' : ''}"` : '(no message)'}
                  </div>
                </div>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <StepDots current={step} total={totalSteps} />
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && <Btn label="Back" onClick={() => setStep((s) => s - 1)} />}
            <Btn label="Cancel" onClick={onCancel} />
            {step < totalSteps && (
              <Btn
                label="Continue"
                accent
                disabled={
                  (step === 1 && !canAdvanceFromStep1) ||
                  (step === 2 && !canAdvanceFromStep2) ||
                  (step === 3 && !canAdvanceFromStep3)
                }
                onClick={() => setStep((s) => s + 1)}
              />
            )}
            {step === totalSteps && (
              <Btn label="Submit Solicitation" accent disabled={!canSubmit} onClick={handleSubmit} />
            )}
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
