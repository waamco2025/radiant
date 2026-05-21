// RfpCreationModal — Phase 17.5.1 — cold-path RFP creation flow.
//
// The active actor publishes a Request for Proposals anchored to one of
// their own Assets (entry point: the Asset card action bar / Detail Panel
// footer "Create RFP" button shipped in Phase 17.5). Two sequential steps,
// mirroring CombinedRequestModal's StepDots + footer pattern:
//   Step 1 — Form: RFP name + description + Requirements Sets multi-select.
//   Step 2 — Review/Confirm: labeled summary + Back / Submit.
//
// On Submit, fires onSubmit({ name, description, requirementsSetIds }). The
// V2App handler builds the full RFP via makeRfp (asset.id → assetId,
// activeRole → owner/ownerDot) and adds it to the v22CreatedRfps session map.
// Post-creation orchestration (layer switch + pan/zoom + NEW badge) is
// Phase 17.5.2.

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel,
} from './ModalShared'
import Tooltip from '../Tooltip'

const OWN_PUBLISHED_TOOLTIP = 'This Requirements Set has been published to the Radiant Network for any party to evaluate against.'

// Globe icon — matches the LibraryModal / BadgesPanel / CombinedRequestModal
// convention. Indicates a Requirements Set is published on the public network.
function GlobeIcon({ size = 11, color = 'var(--accent-blue)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  )
}

const SECTION_HEADER_STYLE = {
  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  letterSpacing: '0.08em', textTransform: 'uppercase',
  padding: '10px 14px 6px', borderBottom: '1px solid var(--border-faint)',
}

const ROW_LABEL_STYLE = {
  fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
  letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 110, flexShrink: 0,
}

// Phase 17.5.1.1 (Fix 3): three render variants keyed on isOwn/isPublished.
//   • own + unpublished  → name + version only (no globe)
//   • own + published    → name + version + trailing globe (right) w/ tooltip
//   • non-own published  → leading globe + name + version + "Published by" line
function RsRow({ rs, selected, onToggle }) {
  const isOwn = !!rs.isOwn
  const isPublished = !!rs.isPublished
  const ownerParty = rs.ownerParty || null
  return (
    <div
      onClick={onToggle}
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
          {!isOwn && isPublished && <GlobeIcon size={11} />}
          <span>{rs.name}</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
            v{rs.version ?? 1}
          </span>
          {isOwn && isPublished && (
            <Tooltip content={OWN_PUBLISHED_TOOLTIP} width={240}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><GlobeIcon size={11} /></span>
            </Tooltip>
          )}
        </div>
        {!isOwn && isPublished && ownerParty && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            Published by <span style={{ color: 'var(--text-secondary)' }}>{ownerParty}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RfpCreationModal({
  asset,                        // { id, name, ... } — pre-selected anchor
  activeRole,                   // { party, partyDot } — RFP owner
  availableRequirementsSets = [], // [{ id, name, version, isPublished, ownerParty }]
  onSubmit,                     // ({ name, description, requirementsSetIds }) => void
  onClose,
}) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedRsIds, setSelectedRsIds] = useState(() => new Set())
  const totalSteps = 2

  const toggleRs = (id) => {
    setSelectedRsIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Phase 17.5.1.1 (Fix 3): section by isOwn (Your first), not isPublished.
  const ownRows = availableRequirementsSets.filter((r) => r.isOwn)
  const publishedRows = availableRequirementsSets.filter((r) => !r.isOwn && r.isPublished)
  const rsById = new Map(availableRequirementsSets.map((r) => [r.id, r]))

  const canContinue = name.trim().length > 0 && description.trim().length > 0 && selectedRsIds.size > 0

  const handleSubmit = () => {
    if (!canContinue) return
    onSubmit?.({
      name: name.trim(),
      description: description.trim(),
      requirementsSetIds: [...selectedRsIds],
    })
  }

  const assetName = asset?.name || 'this Asset'

  return (
    <Backdrop onClose={onClose}>
      <Modal width={640}>
        {/* Phase 17.5.1.4 (Fix B): dim the name + description placeholders so
            the empty fields don't read as pre-filled. Inline styles can't
            target ::placeholder, so a scoped rule keys off the shared class. */}
        <style>{`.rfp-create-field::placeholder { color: color-mix(in srgb, var(--text-muted) 70%, transparent); opacity: 1; }`}</style>
        <ModalHeader
          title={step === 1 ? `Create RFP for ${assetName}` : 'Review RFP details'}
          subtitle={
            step === 1
              ? 'Publish a Request for Proposals anchored to this Asset. Other organizations will discover it from the Radiant Network and solicit their Claims to be evaluated against your requirements.'
              : 'Confirm the RFP before publishing. Once published, it will appear in your Directory and on the Radiant Network.'
          }
          step={step}
          totalSteps={totalSteps}
          onClose={onClose}
        />

        <ModalBody>
          {/* ─── STEP 1 — Form ───────────────────────────────────── */}
          {step === 1 && (
            <>
              <FieldLabel label="RFP Name" required />
              <input
                type="text"
                className="rfp-create-field"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sentinel-4 Power Subsystem Sourcing"
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
                  marginBottom: 20,
                }}
              />

              <FieldLabel label="Description" required />
              <textarea
                rows={5}
                className="rfp-create-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you're sourcing, the evaluation context, and any constraints suppliers should know about…"
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
                  marginBottom: 22,
                }}
              />

              <FieldLabel label="Requirements Sets" required />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.6 }}>
                Solicitors' Claims will be evaluated against these Requirements Sets. Select at least one.
              </div>
              <div style={{
                maxHeight: 280, overflowY: 'auto',
                border: '1px solid var(--border)', borderRadius: 8,
              }}>
                {availableRequirementsSets.length === 0 ? (
                  <div style={{ padding: '16px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
                    No Requirements Sets available. Create one in the Library.
                  </div>
                ) : (
                  <>
                    {ownRows.length > 0 && (
                      <>
                        <div style={SECTION_HEADER_STYLE}>Your Requirements Sets</div>
                        {ownRows.map((rs) => (
                          <RsRow key={rs.id} rs={rs} selected={selectedRsIds.has(rs.id)} onToggle={() => toggleRs(rs.id)} />
                        ))}
                      </>
                    )}
                    {publishedRows.length > 0 && (
                      <>
                        <div style={SECTION_HEADER_STYLE}>Published Requirements Sets</div>
                        {publishedRows.map((rs) => (
                          <RsRow key={rs.id} rs={rs} selected={selectedRsIds.has(rs.id)} onToggle={() => toggleRs(rs.id)} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* ─── STEP 2 — Review / Confirm ───────────────────────── */}
          {step === 2 && (
            <div style={{
              padding: '16px 18px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={ROW_LABEL_STYLE}>For Asset</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{assetName}</div>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={ROW_LABEL_STYLE}>RFP Name</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{name.trim()}</div>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={ROW_LABEL_STYLE}>Description</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', minWidth: 0, flex: 1 }}>{description.trim()}</div>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                <div style={ROW_LABEL_STYLE}>Requirements Sets</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0, flex: 1 }}>
                  {[...selectedRsIds].map((id) => {
                    const rs = rsById.get(id)
                    if (!rs) return null
                    return (
                      <span key={id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 6,
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        fontSize: 11, color: 'var(--text-primary)',
                      }}>
                        {rs.isPublished && <GlobeIcon size={10} />}
                        <span>{rs.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>v{rs.version ?? 1}</span>
                      </span>
                    )
                  })}
                </div>
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
              <Btn label="Publish RFP" accent disabled={!canContinue} onClick={handleSubmit} />
            )}
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
