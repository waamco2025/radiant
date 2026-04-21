// V22ParseEvidenceModal — V2.2 parse flow. Phase 8.
//
// Pattern-matches V22RunEvaluationModal's 3-stage layout (select template →
// processing with PrimeRadiant + progress bar → review + edit rows) so Parse
// and Evaluate feel like siblings. Per spec §17.1, the two processes are
// unified by structure even if kept distinct by terminology.
//
// Inputs: a source Asset (owned by the current actor) + the PEP template
// library. Output: a new Parse Result artifact and the internal Full DA
// that wires it back to the source Asset (so the parse→asset edge derives
// the same way as the seeded parseResultRefEdges).
//
// Parse flow differs from Eval flow in one place: rows edit the parsed
// field VALUE (free text) and CONFIDENCE badge only — there is no
// SAT/UNSAT/MISSING/N/A assessment cycling, because parsing extracts
// values rather than assessing them.

import { useState, useEffect } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel, ConfidenceBadge, StepDots,
} from './ModalShared'
import PrimeRadiant from '../../v2/PrimeRadiant.jsx'
import Tooltip from '../Tooltip'

// Deterministic mock for "parsed" field values when the user hasn't yet
// supplied real text. Mirrors the evaluation modal's mock-row initialisation:
// rows start with empty strings and a 'medium' confidence; the user edits
// values and optionally bumps confidence before confirming.
function initialRowsFromTemplate(template) {
  if (!template?.fields) return []
  // Phase 9A.1 item 9: pre-populate each row from the template field's
  // `aiValue` + `aiConfidence` so the review stage starts with believable
  // AI extractions. Fall back to empty value + 'medium' confidence when
  // a legacy template doesn't carry AI hints. `_aiOriginalValue` snapshots
  // the AI's value so the Phase 9A item 10 pencil fires on edits.
  return template.fields.map((f) => {
    const aiValue = f.aiValue ?? ''
    // The modal displays the level string via the shared V2.1 ConfidenceBadge,
    // so convert numeric aiConfidence into the tier string. The confidence
    // cycle button lets the user bump it after they review.
    let confidenceLevel = 'medium'
    if (typeof f.aiConfidence === 'number') {
      confidenceLevel = f.aiConfidence >= 0.85 ? 'high' : f.aiConfidence >= 0.65 ? 'medium' : 'low'
    }
    return {
      id: f.id,
      name: f.name,
      instruction: f.instruction,
      required: !!f.required,
      value: aiValue,
      confidence: confidenceLevel,
      _aiOriginalValue: aiValue,
    }
  })
}

// Phase 9A item 10: pencil icon rendered in both Parse + Eval review rows
// when the current value differs from the AI's original extraction. Tooltip
// wording matches the one in V22RunEvaluationModal.
function HumanEditedIcon() {
  return (
    <Tooltip content="Human-edited from AI's original extraction.">
      <span
        aria-label="Human-edited"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, color: 'var(--accent-amber)',
        }}
      >
        <svg width={11} height={11} viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M12.146 1.854a1.5 1.5 0 0 1 2.121 2.121L5.5 12.743 2 13l.257-3.5L10.146 1.854a1.5 1.5 0 0 1 2 0Z"
                stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
        </svg>
      </span>
    </Tooltip>
  )
}

const CONFIDENCE_CYCLE = ['high', 'medium', 'low']
function nextConfidence(current) {
  const idx = CONFIDENCE_CYCLE.indexOf(current)
  return CONFIDENCE_CYCLE[(idx + 1) % CONFIDENCE_CYCLE.length]
}

// Phase 8.5 Bug 1: the Detail Panel's Parse Result renderer expects numeric
// 0–1 confidences (seeded Parse Results use 0.95 / 0.91 / ...) and calls
// `.toFixed(2)` on them. Rows inside the modal track confidence as the level
// string because the ConfidenceBadge UI cycles high/medium/low — map to the
// numeric format on submit so stored artifacts match the schema.
const CONFIDENCE_TO_NUMERIC = { high: 0.9, medium: 0.7, low: 0.4 }

export default function V22ParseEvidenceModal({
  sourceAsset,             // { id, name, owner, ownerDot? }
  availableTemplates = [], // [{ id, name, version, fields: [{ id, name, instruction, required }] }]
  existingParseResultIds = new Set(), // parse results that already exist on this asset (for "ALREADY PARSED" affordance)
  onSubmit,                // ({ template, rows }) => void — V2App creates the Parse Result + ref DA
  onClose,
}) {
  const [stage, setStage] = useState(0) // 0: select template, 1: processing, 2: review
  const [selectedTemplateId, setSelectedTemplateId] = useState(availableTemplates[0]?.id || null)
  const selectedTemplate = availableTemplates.find((t) => t.id === selectedTemplateId) || null
  const [rows, setRows] = useState(() => initialRowsFromTemplate(selectedTemplate))

  // Reset rows when the template changes.
  useEffect(() => {
    setRows(initialRowsFromTemplate(selectedTemplate))
  }, [selectedTemplateId])

  const canStart = !!selectedTemplate
  const canSubmit = rows.length > 0 && rows.every((r) => !r.required || (r.value && r.value.trim().length > 0))

  const handleStart = () => {
    if (!canStart) return
    setStage(1)
    // 1.5s processing animation, same length as V22RunEvaluationModal.
    setTimeout(() => setStage(2), 1500)
  }

  const handleConfirm = () => {
    if (!canSubmit || !selectedTemplate) return
    // Bug 1: convert confidence level strings → numeric 0–1 so the stored
    // Parse Result matches the seeded dataset shape (seeded rows carry
    // numerics like 0.95). The modal's ConfidenceBadge keeps displaying
    // the level string inside the modal; only the submitted payload changes.
    const rowsForSubmit = rows.map((r) => ({
      ...r,
      confidence: typeof r.confidence === 'number'
        ? r.confidence
        : (CONFIDENCE_TO_NUMERIC[r.confidence] ?? 0.7),
    }))
    onSubmit?.({ template: selectedTemplate, rows: rowsForSubmit })
  }

  return (
    <Backdrop onClose={onClose}>
      {stage === 2 ? (
        <Modal width={1040}>
          <ModalHeader
            title="Parse Evidence"
            subtitle={`Review extracted fields for ${sourceAsset?.name || 'this Asset'}`}
            step={3} totalSteps={3} onClose={onClose}
          />
          <ModalBody>
            {/* Phase 8.5 Bug 5: the left (evidence) and right (extracted
                fields) sides scroll independently. Giving the outer container
                a bounded height + `minHeight: 0` on each side is the key —
                without it, ModalBody's own overflow:auto ate the whole split
                panel as one scroll region. */}
            <div style={{
              display: 'flex', gap: 20,
              height: 'calc(90vh - 220px)',
              minHeight: 360, maxHeight: 640,
            }}>
              {/* Left: evidence metadata preview (parity with V22RunEvaluationModal's evidence panel). */}
              <div style={{
                width: '45%', flexShrink: 0,
                display: 'flex', flexDirection: 'column',
                minHeight: 0, overflowY: 'auto',
              }}>
                <div style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
                }}>Source Asset</div>
                <div style={{
                  flex: 1, padding: 14, borderRadius: 6, display: 'flex', flexDirection: 'column',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  gap: 12,
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {sourceAsset?.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Owner:</span>{' '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{sourceAsset?.owner}</span>
                  </div>
                  <div style={{
                    padding: 10, borderRadius: 4, fontSize: 11, color: 'var(--text-dim)',
                    background: 'var(--bg-deep)', border: '1px dashed var(--border)', fontStyle: 'italic', lineHeight: 1.6,
                  }}>
                    Evidence-file preview is placeholder-grade in this release. A PDF / image viewer lands with polish item #41.
                  </div>
                </div>
              </div>

              {/* Right: editable fields (parity with V22RunEvaluationModal's review rows). */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
                  padding: '10px 14px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-indigo) 20%, transparent)',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-indigo)' }}>
                    {rows.length} field{rows.length === 1 ? '' : 's'} extracted
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    using {selectedTemplate?.name}
                  </span>
                </div>

                {rows.map((row, i) => (
                  <div key={row.id} style={{
                    padding: '12px 0',
                    borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {row.name}
                        {row.required && <span style={{ color: 'var(--accent-red)', marginLeft: 2 }}>*</span>}
                      </span>
                      <Tooltip content="Click to cycle confidence">
                        <span
                          onClick={() => {
                            setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, confidence: nextConfidence(r.confidence) } : r))
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <ConfidenceBadge level={row.confidence} />
                        </span>
                      </Tooltip>
                      {/* Phase 9A item 10: human-edited pencil when the row's
                          current value differs from the AI's original extraction. */}
                      {row._aiOriginalValue != null && row.value !== row._aiOriginalValue && <HumanEditedIcon />}
                    </div>
                    {row.instruction && (
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
                        {row.instruction}
                      </div>
                    )}
                    <input
                      value={row.value}
                      onChange={(e) => {
                        const v = e.target.value
                        setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, value: v } : r))
                      }}
                      onKeyDown={(e) => { if (e.key === 'Escape') e.target.blur() }}
                      placeholder={row.required ? '(required)' : '(optional)'}
                      style={{
                        width: '100%', padding: '6px 10px', borderRadius: 4,
                        border: '1px solid var(--border)', background: 'var(--bg-deep)',
                        color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11,
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn label="← Back" onClick={() => setStage(0)} />
            <Btn
              accent
              label="Save Parse Result"
              onClick={handleConfirm}
              disabled={!canSubmit}
            />
          </ModalFooter>
        </Modal>
      ) : (
        <Modal width={620}>
          {stage === 0 && (
            <>
              <ModalHeader
                title="Parse Evidence"
                subtitle={<>Extract structured data from <strong style={{ color: 'var(--text-primary)' }}>{sourceAsset?.name}</strong></>}
                step={1} totalSteps={3} onClose={onClose}
              />
              <ModalBody>
                <div style={{
                  padding: '12px 16px', borderRadius: 8, marginBottom: 18,
                  background: 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
                  fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
                }}>
                  Parsing extracts structured fields from an Asset's evidence file. The resulting Parse Result
                  enables Selective Disclosure — where specific fields can be shared without revealing the full document.
                </div>

                <FieldLabel label="Parse Template" required />
                {availableTemplates.length === 0 ? (
                  <div style={{
                    padding: 14, background: 'var(--bg-card)',
                    border: '1px solid var(--accent-amber)', borderRadius: 6,
                    fontSize: 11, color: 'var(--text-secondary)',
                  }}>
                    No PEP Templates in your library. Add one via the Template Library before parsing.
                  </div>
                ) : (
                  <div role="radiogroup" aria-label="Parse Template" style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    // Phase 9A.6 Gate C (#91): scroll container sized per the
                    // CLAUDE.md picker convention so lists of N>>10 templates
                    // don't break the modal layout.
                    maxHeight: 300, overflowY: 'auto',
                    paddingRight: 2,
                  }}>
                    {availableTemplates.map((t) => {
                      const selected = selectedTemplateId === t.id
                      const alreadyParsed = existingParseResultIds.has?.(t.id) || (Array.isArray(existingParseResultIds) && existingParseResultIds.includes(t.id))
                      return (
                        <div
                          key={t.id}
                          role="radio"
                          aria-checked={selected}
                          aria-disabled={alreadyParsed}
                          tabIndex={alreadyParsed ? -1 : 0}
                          onClick={() => { if (!alreadyParsed) setSelectedTemplateId(t.id) }}
                          onKeyDown={(e) => {
                            if (alreadyParsed) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedTemplateId(t.id)
                            }
                          }}
                          style={{
                            padding: '10px 14px', borderRadius: 6,
                            cursor: alreadyParsed ? 'not-allowed' : 'pointer',
                            background: selected && !alreadyParsed ? 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)' : 'var(--bg-card)',
                            border: `1px solid ${selected && !alreadyParsed ? 'var(--accent-indigo)' : 'var(--border)'}`,
                            transition: 'all 120ms',
                            display: 'flex', alignItems: 'center', gap: 10,
                            opacity: alreadyParsed ? 0.5 : 1,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              {t.name}
                              {alreadyParsed && (
                                <span style={{
                                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                  padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                                  color: 'var(--text-dim)',
                                  background: 'var(--bg-deep)',
                                }}>ALREADY PARSED</span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              {t.id} · v{t.version ?? 1} · {t.fields?.length ?? 0} field{(t.fields?.length ?? 0) === 1 ? '' : 's'}
                            </div>
                          </div>
                          <div style={{
                            width: 12, height: 12, borderRadius: '50%',
                            border: `1.5px solid ${selected && !alreadyParsed ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                            background: selected && !alreadyParsed ? 'var(--accent-indigo)' : 'transparent',
                            flexShrink: 0,
                          }} />
                        </div>
                      )
                    })}
                  </div>
                )}

                {selectedTemplate && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 16, marginBottom: 10 }}>
                      {selectedTemplate.description || 'Extracts structured fields from evidence.'}
                    </div>
                    <div style={{
                      maxHeight: 160, overflow: 'auto', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--bg-card)',
                    }}>
                      <div style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: 'var(--text-dim)', letterSpacing: '0.06em',
                        padding: '10px 14px 4px',
                      }}>
                        FIELDS TO EXTRACT
                      </div>
                      {(selectedTemplate.fields || []).map((f, i) => (
                        <div key={f.id} style={{
                          padding: '8px 14px',
                          borderTop: '1px solid var(--border)',
                          fontSize: 12, color: 'var(--text-secondary)',
                        }}>
                          {f.name}
                          {f.required && <span style={{ color: 'var(--accent-red)', marginLeft: 2 }}>*</span>}
                          {f.instruction && (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                              {f.instruction}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <StepDots current={0} total={3} />
                <Btn label="Parse Evidence →" accent disabled={!canStart} onClick={handleStart} />
              </ModalFooter>
            </>
          )}

          {stage === 1 && (
            <>
              <ModalHeader
                title="Parse Evidence"
                subtitle="Processing evidence file…"
                step={2} totalSteps={3} onClose={onClose}
              />
              <ModalBody>
                <div style={{ padding: '60px 36px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 28px' }}>
                    <PrimeRadiant size={80} fps={30} strutScale={1.8} brightness={0.3} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                    Parsing against {selectedTemplate?.name || 'template'}…
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    Extracting {rows.length} field{rows.length === 1 ? '' : 's'} from {sourceAsset?.name}
                  </div>
                  <div style={{
                    width: '60%', height: 3, borderRadius: 2,
                    background: 'var(--border)', margin: '24px auto 0',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: 'var(--accent-indigo)',
                      animation: 'v22parseprogress 1.5s ease forwards',
                    }} />
                  </div>
                  <style>{`@keyframes v22parseprogress { from { width: 0% } to { width: 100% } }`}</style>
                </div>
              </ModalBody>
            </>
          )}
        </Modal>
      )}
    </Backdrop>
  )
}
