// PublishToDirectoryModal — Phase 18.2 — publish a Claim to the Public Directory.
//
// Restores the V2.0/V2.1 "publish a Claim to the Radiant Network" mechanic.
// The Claim owner picks a disclosure type (Full / Selective / Proof-Only) +
// scope + expiry; on Submit a Disclosure Agreement is minted with
// grantee = Radiant Network and pushed into v22Provisionals.disclosureAgreements
// (the V2App handler). The existing Directory builder detects
// grantee.party === 'Radiant Network' + subject.kind === 'claim' and surfaces
// the Claim as a dot in the active actor's cluster — no new merge helper.
//
// Two sequential steps, mirroring RfpCreationModal's StepDots + footer pattern:
//   Step 1 — Form: disclosure-type radios + branched scope picker + expiry.
//   Step 2 — Review: labeled summary + Back / Publish to Directory.
//
// On Submit fires onSubmit({ type, scope, expiryIso }). Post-creation
// orchestration (auto-route to Directory + variant load animation + auto-select
// + NEW badge) is deferred to Phase 18.2.1.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, ExpiryPicker, expiryLabel,
} from './ModalShared'
import Tooltip from '../Tooltip'

// Disclosure-type visual config (mirrors V22NodeDetailPanel's SDA_TYPE_CFG +
// ModalShared's SDA_TYPES). Inlined so the modal doesn't couple to Detail
// Panel internals.
const DISCLOSURE_TYPE_CFG = {
  full: {
    color: 'var(--accent-indigo)', dasharray: null,
    label: 'Full Disclosure',
    subtitle: "Publish the full Claim — every Asset's contents accessible from the Public Directory.",
  },
  selective: {
    color: 'var(--accent-amber)', dasharray: '6 3',
    label: 'Selective Disclosure',
    subtitle: 'Publish a curated view — pick which parsed fields from which Assets are visible.',
  },
  proofonly: {
    color: 'var(--accent-green)', dasharray: '2 3',
    label: 'Proof-Only Disclosure',
    subtitle: 'Publish proof that this Claim has been evaluated — Eval Result details remain private.',
  },
}

const PROOF_ONLY_DISABLED_TOOLTIP =
  'This Claim has no Proofs of Evaluation yet. Run an evaluation under an Evaluation Agreement to create one.'

const ROW_LABEL_STYLE = {
  fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
  letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 120, flexShrink: 0,
}

// SDA line illustration — recreated from V22NodeDetailPanel.jsx's SdaLine.
function SdaLine({ type }) {
  const cfg = DISCLOSURE_TYPE_CFG[type] || DISCLOSURE_TYPE_CFG.full
  return (
    <svg width={22} height={8} viewBox="0 0 22 8" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1="1" y1="4" x2="21" y2="4" stroke={cfg.color} strokeWidth="2"
            strokeLinecap="round" strokeDasharray={cfg.dasharray || undefined} />
    </svg>
  )
}

// Globe icon — matches the RfpCreationModal / LibraryModal convention for
// "published to the Radiant Network".
function GlobeIcon({ size = 12, color = 'var(--accent-blue)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  )
}

// One disclosure-type radio row (vertical stack). Disabled rows render muted
// with cursor: not-allowed and wrap in a Tooltip explaining why.
function DisclosureTypeRow({ type, selected, onSelect, disabled, disabledTooltip }) {
  const cfg = DISCLOSURE_TYPE_CFG[type]
  const active = selected === type
  const [hov, setHov] = useState(false)
  const row = (
    <div
      onClick={disabled ? undefined : () => onSelect(type)}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px', borderRadius: 8,
        border: `1.5px ${cfg.dasharray ? (type === 'selective' ? 'dashed' : 'dotted') : 'solid'} ${active ? cfg.color : hov ? 'var(--border-hover)' : 'var(--border)'}`,
        background: active ? `color-mix(in srgb, ${cfg.color} 6%, transparent)` : hov ? 'var(--bg-raised)' : 'var(--bg-card)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 150ms',
      }}
    >
      {/* radio dot */}
      <div style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        border: `1.5px solid ${active ? cfg.color : 'var(--border-hover)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <SdaLine type={type} />
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: active ? cfg.color : 'var(--text-primary)',
          }}>{cfg.label}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.55 }}>{cfg.subtitle}</div>
      </div>
    </div>
  )
  return disabled && disabledTooltip
    ? <Tooltip content={disabledTooltip} width={260}>{row}</Tooltip>
    : row
}

// Checkbox primitive shared by the Full / Selective / Proof-Only pickers.
function Check({ checked }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: 3, flexShrink: 0,
      border: `1.5px solid ${checked ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
      background: checked ? 'var(--accent-indigo)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </div>
  )
}

const HELP_STYLE = { fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.6 }
const LIST_STYLE = { maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }
const ROW_STYLE = {
  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-faint)',
  display: 'flex', alignItems: 'center', gap: 10, transition: 'background 120ms',
}

export default function PublishToDirectoryModal({
  claim,                  // { id, name, owner, referencedAssetIds, ... }
  activeRole,             // { party, partyDot } — the publisher
  ownedAssets = [],       // [{ id, name, parsedFields: [{ id, name, parseResultName }] }]
  ownedPoEsOnClaim = [],  // [{ id, name, wrappedEvalResultId, evaluatorParty }]
  onSubmit,               // ({ type, scope, expiryIso }) => void
  onClose,
}) {
  const totalSteps = 2
  const [step, setStep] = useState(1)
  const [type, setType] = useState(null)
  // Full: default all Assets checked.
  const [selectedAssetIds, setSelectedAssetIds] = useState(() => new Set(ownedAssets.map((a) => a.id)))
  // Selective: which Asset rows are expanded + which composite field ids picked.
  const [expandedAssetId, setExpandedAssetId] = useState(null)
  const [selectedFieldIds, setSelectedFieldIds] = useState(() => new Set())
  // Proof-Only: default zero selected.
  const [selectedPoeIds, setSelectedPoeIds] = useState(() => new Set())
  // Expiry: default 'none' (Never expires) to match seeded public DAs.
  const [expiry, setExpiry] = useState('none')
  const [customDate, setCustomDate] = useState('')

  const proofOnlyDisabled = ownedPoEsOnClaim.length === 0

  const toggleSet = (setter) => (id) => setter((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAsset = toggleSet(setSelectedAssetIds)
  const toggleField = toggleSet(setSelectedFieldIds)
  const togglePoe = toggleSet(setSelectedPoeIds)

  // Assets that have ≥1 field picked (Selective scope.assetIds).
  const selectiveAssetIds = ownedAssets
    .filter((a) => (a.parsedFields || []).some((f) => selectedFieldIds.has(f.id)))
    .map((a) => a.id)

  const scopeValid =
    type === 'full' ? selectedAssetIds.size > 0
    : type === 'selective' ? selectedFieldIds.size > 0
    : type === 'proofonly' ? selectedPoeIds.size > 0
    : false
  const canContinue = type !== null && scopeValid
  const canSubmit = canContinue

  const expiryIso =
    expiry === 'none' ? null
    : expiry === 'custom' ? (customDate || null)
    : expiryLabel(expiry, customDate)  // '1-year' / '2-year' → YYYY-MM-DD

  const handleSubmit = () => {
    if (!canSubmit) return
    const scope =
      type === 'full' ? {
        assetIds: [...selectedAssetIds], fieldIds: null, evaluationResultIds: null, poeIds: null,
      }
      : type === 'selective' ? {
        assetIds: [...selectiveAssetIds], fieldIds: [...selectedFieldIds], evaluationResultIds: null, poeIds: null,
      }
      : {
        assetIds: null, fieldIds: null, evaluationResultIds: null, poeIds: [...selectedPoeIds],
      }
    onSubmit?.({ type, scope, expiryIso })
  }

  const claimName = claim?.name || 'this Claim'

  return (
    <Backdrop onClose={onClose}>
      <Modal width={640}>
        <ModalHeader
          title={step === 1 ? 'Publish to the Public Directory' : 'Review publication'}
          subtitle={
            step === 1
              ? `Publish "${claimName}" to the Radiant Network. Pick how much of the Claim other actors can see — then it appears as a dot in your Directory cluster.`
              : 'Confirm the disclosure before publishing. Once published, the Claim is discoverable on the Radiant Network until you revoke the agreement.'
          }
          step={step}
          totalSteps={totalSteps}
          onClose={onClose}
        />

        <ModalBody>
          {/* ─── STEP 1 — Form ───────────────────────────────────── */}
          {step === 1 && (
            <>
              <FieldLabel label="Disclosure Type" required />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                <DisclosureTypeRow type="full" selected={type} onSelect={setType} />
                <DisclosureTypeRow type="selective" selected={type} onSelect={setType} />
                <DisclosureTypeRow
                  type="proofonly"
                  selected={type}
                  onSelect={setType}
                  disabled={proofOnlyDisabled}
                  disabledTooltip={proofOnlyDisabled ? PROOF_ONLY_DISABLED_TOOLTIP : null}
                />
              </div>

              {/* Scope picker — branches on type. */}
              {type === 'full' && (
                <>
                  <FieldLabel label="Assets" required />
                  <div style={HELP_STYLE}>All checked Assets become network-readable. Uncheck any Asset to exclude it.</div>
                  <div style={LIST_STYLE}>
                    {ownedAssets.length === 0 ? (
                      <div style={{ padding: 16, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                        This Claim references no Assets you own.
                      </div>
                    ) : ownedAssets.map((a) => {
                      const checked = selectedAssetIds.has(a.id)
                      return (
                        <div key={a.id} onClick={() => toggleAsset(a.id)}
                          style={{ ...ROW_STYLE, background: checked ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'transparent' }}
                          onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'var(--bg-raised)' }}
                          onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                        >
                          <Check checked={checked} />
                          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {type === 'selective' && (
                <>
                  <FieldLabel label="Fields" required />
                  <div style={HELP_STYLE}>Pick the parsed fields from each Asset that you want to publish. Unpicked fields remain private.</div>
                  <div style={LIST_STYLE}>
                    {ownedAssets.length === 0 ? (
                      <div style={{ padding: 16, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                        This Claim references no Assets you own.
                      </div>
                    ) : ownedAssets.map((a) => {
                      const fields = a.parsedFields || []
                      const pickedCount = fields.filter((f) => selectedFieldIds.has(f.id)).length
                      const expanded = expandedAssetId === a.id
                      return (
                        <div key={a.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                          <div
                            onClick={() => setExpandedAssetId(expanded ? null : a.id)}
                            style={{ ...ROW_STYLE, borderBottom: 'none', justifyContent: 'space-between' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 10, flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                            </div>
                            <span style={{ fontSize: 10, color: pickedCount > 0 ? 'var(--accent-indigo)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                              {pickedCount}/{fields.length} fields
                            </span>
                          </div>
                          {expanded && (
                            <div style={{ padding: '0 14px 8px 32px' }}>
                              {fields.length === 0 ? (
                                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', padding: '4px 0' }}>No parsed fields on this Asset.</div>
                              ) : fields.map((f) => {
                                const checked = selectedFieldIds.has(f.id)
                                return (
                                  <div key={f.id} onClick={() => toggleField(f.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                                    <Check checked={checked} />
                                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{f.name}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {type === 'proofonly' && (
                <>
                  <FieldLabel label="Proofs of Evaluation" required />
                  <div style={HELP_STYLE}>Pick which Proofs of Evaluation to publish. Underlying Eval Result details remain private.</div>
                  <div style={LIST_STYLE}>
                    {ownedPoEsOnClaim.map((poe) => {
                      const checked = selectedPoeIds.has(poe.id)
                      return (
                        <div key={poe.id} onClick={() => togglePoe(poe.id)}
                          style={{ ...ROW_STYLE, background: checked ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'transparent' }}
                          onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'var(--bg-raised)' }}
                          onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                        >
                          <Check checked={checked} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{poe.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Evaluated by {poe.evaluatorParty}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {type && (
                <div style={{ marginTop: 22 }}>
                  <FieldLabel label="Expiration" />
                  <ExpiryPicker expiry={expiry} setExpiry={setExpiry} customDate={customDate} setCustomDate={setCustomDate} />
                </div>
              )}
            </>
          )}

          {/* ─── STEP 2 — Review ─────────────────────────────────── */}
          {step === 2 && type && (
            <div style={{
              padding: '16px 18px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={ROW_LABEL_STYLE}>For Claim</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{claimName}</div>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <div style={ROW_LABEL_STYLE}>Granted to</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <GlobeIcon size={13} color="var(--accent-blue)" />
                  Radiant Network
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <div style={ROW_LABEL_STYLE}>Disclosure Type</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SdaLine type={type} />
                  {DISCLOSURE_TYPE_CFG[type].label}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={ROW_LABEL_STYLE}>Scope</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {type === 'full' && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{selectedAssetIds.size} Asset{selectedAssetIds.size === 1 ? '' : 's'}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ownedAssets.filter((a) => selectedAssetIds.has(a.id)).map((a) => (
                          <span key={a.id} style={chipStyle}>{a.name}</span>
                        ))}
                      </div>
                    </>
                  )}
                  {type === 'selective' && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>
                        {selectedFieldIds.size} field{selectedFieldIds.size === 1 ? '' : 's'} across {selectiveAssetIds.length} Asset{selectiveAssetIds.length === 1 ? '' : 's'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {ownedAssets.filter((a) => selectiveAssetIds.includes(a.id)).map((a) => {
                          const n = (a.parsedFields || []).filter((f) => selectedFieldIds.has(f.id)).length
                          return (
                            <div key={a.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {a.name}: {n} field{n === 1 ? '' : 's'}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {type === 'proofonly' && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{selectedPoeIds.size} Proof{selectedPoeIds.size === 1 ? '' : 's'} of Evaluation</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ownedPoEsOnClaim.filter((p) => selectedPoeIds.has(p.id)).map((p) => (
                          <span key={p.id} style={chipStyle}>{p.name}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={ROW_LABEL_STYLE}>Expires</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{expiryLabel(expiry, customDate)}</div>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <StepDots current={step} total={totalSteps} />
          <div style={{ display: 'flex', gap: 8 }}>
            {step === 1 && <Btn label="Cancel" onClick={onClose} />}
            {step > 1 && <Btn label="Back" onClick={() => setStep((s) => s - 1)} />}
            {step < totalSteps && (
              <Btn label="Continue" accent disabled={!canContinue} onClick={() => setStep((s) => s + 1)} />
            )}
            {step === totalSteps && (
              <Btn label="Publish to Directory" accent disabled={!canSubmit} onClick={handleSubmit} />
            )}
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}

const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '4px 10px', borderRadius: 6,
  background: 'var(--bg-raised)', border: '1px solid var(--border)',
  fontSize: 11, color: 'var(--text-primary)',
}
