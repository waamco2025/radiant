// V22CreateClaimModal — Phase 9A.3.
//
// Creates a new V2.2 Claim referencing ≥1 Asset the active actor owns.
// Per spec §3.4:
//   • Claim = name + description + referencedAssetIds[] (≥ 1 required).
//   • Evidence requirement is transitive through Assets; no evidence field
//     on the Claim itself. Every Asset carries exactly one evidence file.
//
// This modal replaces V2.1's `CreateClaimModal` entirely. V2.1's single-step
// "name + N evidence files" UX split into two V2.2 flows:
//   1. V22CreateAssetModal — registers each evidence file as its own Asset.
//   2. this modal — names the Claim and picks ≥1 Asset to reference.
//
// Flow:
//   0  Name + Description + Asset picker  — multi-select list of the
//      active actor's Assets with "+ Register new Asset…" nested CTA.
//      Claim descriptions are optional; spec §3.4 carries it.
//   1  Review & Confirm                   — summary cards before commit.
//
// Entry points: Asset panel / card action bar "Create Claim" (which passes
// `initialAssetIds=[that.asset.id]` so the triggering Asset is pre-selected).

import { useState } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, InfoRow, StepDots, CreditCostRow,
} from './ModalShared'
import V22CreateAssetModal from './V22CreateAssetModal.jsx'

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function V22CreateClaimModal({
  activeParty,
  credits = Infinity,          // Phase 9A.6 Gate A (#65).
  creditsPerClaim = 0,
  creditsPerAsset = 0,         // forwarded to the nested Register-new-Asset modal
  ownedAssets = [],            // [{ id, name, file: { filename, size, mimeType } }]
  initialAssetIds = [],        // pre-selected when opened from an Asset's panel/card
  onClose,
  onComplete,                  // ({ name, description, referencedAssetIds }) => void
  onRegisterNewAsset,          // () => Promise<newAssetId> — wired by V2App (Gate B).
                               // If absent, the inline "+ Register new Asset…" CTA
                               // still renders a nested V22CreateAssetModal and
                               // calls the optional onNestedAssetCreated below.
  onNestedAssetCreated,        // optional ({ file, displayName }) => newAssetId — lets
                               // V2App create the Asset and return its id so the new
                               // row gets auto-selected in the picker.
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState(() => new Set(initialAssetIds))
  const [showNestedRegister, setShowNestedRegister] = useState(false)

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canReview = name.trim().length > 0 && selected.size > 0
  const selectedList = ownedAssets.filter(a => selected.has(a.id))
  const totalCost = creditsPerClaim
  const hasSufficientCredits = credits >= totalCost

  const handleComplete = () => {
    if (!canReview) return
    if (!hasSufficientCredits) return
    const referencedAssetIds = Array.from(selected)
    // TODO: remove after 9A.6.2 diagnoses #103
    // Phase 9A.6.2 Issue 1 diagnostic: confirm modal submit sends every
    // ticked Asset's id downstream.
    console.log('[9A.6.2 diag #103] V22CreateClaimModal submit', {
      selectedCount: selected.size,
      selectedIds: Array.from(selected),
      referencedAssetIdsSent: referencedAssetIds,
      ownedAssetIdsInPicker: ownedAssets.map(a => a.id),
    })
    onComplete?.({
      name: name.trim(),
      description: description.trim(),
      referencedAssetIds,
    })
  }

  // Inline "Register new Asset" nested flow. On completion, V2App hands
  // back either a single new Asset id (single-file) or an array of ids
  // (multi-file, Phase 9A.6 Gate B #66). Auto-select all new Assets in the
  // picker so the user doesn't need to tick them manually.
  const handleNestedAssetComplete = (payload) => {
    setShowNestedRegister(false)
    const newIds = onNestedAssetCreated?.(payload)
    const ids = Array.isArray(newIds) ? newIds : (newIds ? [newIds] : [])
    if (ids.length > 0) {
      setSelected(prev => {
        const next = new Set(prev)
        for (const id of ids) next.add(id)
        return next
      })
    }
  }

  const content = (
    <Modal width={640}>
      <ModalHeader
        title="Create Claim"
        subtitle={
          <>Create a new Claim under <strong style={{ color: 'var(--text-primary)' }}>{activeParty}</strong> that references one or more of your Assets.</>
        }
        step={step + 1}
        totalSteps={2}
        onClose={onClose}
      />
      <ModalBody>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <FieldLabel label="Claim name" required />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. MC-7 Processor, Thermal Interface Pad"
                autoFocus
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <FieldLabel label="Description" />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Short description — what does this Claim assert?"
                rows={2}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                  outline: 'none', resize: 'vertical', lineHeight: 1.5,
                }}
              />
            </div>

            <div>
              <FieldLabel label={`Referenced Assets (${selected.size} selected, ≥1 required)`} required />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
                Pick one or more Assets you own. Each referenced Asset contributes its
                evidence file to the Claim's coverage; evaluators will see the Assets
                in scope when you disclose the Claim.
              </div>

              {ownedAssets.length === 0 ? (
                <div style={{
                  padding: '14px 16px', borderRadius: 8,
                  border: '1px dashed var(--border)', background: 'var(--bg-card)',
                  fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  <div style={{ marginBottom: 10 }}>
                    You haven't registered any Assets yet. Register one to get started.
                  </div>
                  <button
                    onClick={() => setShowNestedRegister(true)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid var(--accent-green)',
                      background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
                      color: 'var(--accent-green)',
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    + Register new Asset…
                  </button>
                </div>
              ) : (
                <>
                  <div style={{
                    maxHeight: 240, overflowY: 'auto',
                    border: '1px solid var(--border)', borderRadius: 8,
                    background: 'var(--bg-card)',
                  }}>
                    {ownedAssets.map((a, i) => {
                      const sel = selected.has(a.id)
                      return (
                        <div
                          key={a.id}
                          onClick={() => toggle(a.id)}
                          role="checkbox"
                          aria-checked={sel}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggle(a.id)
                            }
                          }}
                          style={{
                            padding: '10px 14px', cursor: 'pointer',
                            background: sel ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'transparent',
                            borderBottom: i < ownedAssets.length - 1 ? '1px solid var(--border-faint)' : 'none',
                            display: 'flex', alignItems: 'center', gap: 10,
                            transition: 'background 120ms',
                          }}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                            border: `1.5px solid ${sel ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                            background: sel ? 'var(--accent-indigo)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {sel && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.file?.filename || a.id}
                              {a.file?.size != null && <span> · {formatBytes(a.file.size)}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setShowNestedRegister(true)}
                    style={{
                      width: '100%', padding: '9px 14px', marginTop: 10, borderRadius: 6, cursor: 'pointer',
                      border: '1px dashed var(--accent-green)',
                      background: 'transparent',
                      color: 'var(--accent-green)',
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      letterSpacing: '0.04em',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green) 5%, transparent)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    + Register new Asset…
                  </button>
                </>
              )}

              {selected.size === 0 && ownedAssets.length > 0 && (
                <div style={{
                  marginTop: 8, fontSize: 11, color: 'var(--accent-amber)',
                  fontStyle: 'italic', lineHeight: 1.5,
                }}>
                  Select at least one Asset to continue.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              padding: 18, borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                letterSpacing: '0.12em', color: 'var(--text-tertiary)',
                marginBottom: 10,
              }}>NEW CLAIM</div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                marginBottom: 6, lineHeight: 1.3,
              }}>{name.trim()}</div>
              {description.trim() && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                  {description.trim()}
                </div>
              )}
              <InfoRow label="Owner" value={activeParty} />
              <InfoRow label="Referenced Assets" value={`${selectedList.length}`} />
              <InfoRow label="Created" value="On submit" />
            </div>

            <div>
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                letterSpacing: '0.12em', color: 'var(--text-tertiary)',
                marginBottom: 8,
              }}>REFERENCED ASSETS</div>
              <div style={{
                borderRadius: 6, overflow: 'hidden',
                border: '1px solid var(--border)', background: 'var(--bg-deep)',
              }}>
                {selectedList.map((a, i) => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px',
                    borderBottom: i < selectedList.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                      background: 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)',
                      color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)',
                    }}>ASSET</span>
                    <span style={{
                      fontSize: 11, color: 'var(--text-primary)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {a.name}
                    </span>
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                    }}>
                      {formatBytes(a.file?.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {creditsPerClaim > 0 && (
              <CreditCostRow cost={totalCost} credits={credits} sufficient={hasSufficientCredits} />
            )}
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              The Claim will render on your canvas with a NEW badge and connect to each
              referenced Asset via an internal (Full) Disclosure Agreement. Claim
              creation is unilateral — no counterparty acceptance is required.
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={() => setStep(0)} />}
          <StepDots current={step} total={2} />
        </div>
        {step === 0 && (
          <Btn
            label="Review →"
            accent
            disabled={!canReview}
            onClick={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Btn
            label={hasSufficientCredits ? 'Create Claim' : 'Insufficient Credits'}
            accent
            disabled={!hasSufficientCredits}
            onClick={handleComplete}
          />
        )}
      </ModalFooter>
    </Modal>
  )

  return (
    <>
      <Backdrop onClose={onClose}>{content}</Backdrop>
      {/* Nested V22CreateAssetModal (Gate B / backlog #34). Rendered outside
          the parent Backdrop so the nested modal's own backdrop sits on top
          of the parent's. Nested mode skips pan-to-asset on V2App's side. */}
      {showNestedRegister && (
        <V22CreateAssetModal
          activeParty={activeParty}
          credits={credits}
          creditsPerAsset={creditsPerAsset}
          onClose={() => setShowNestedRegister(false)}
          onComplete={handleNestedAssetComplete}
        />
      )}
    </>
  )
}
