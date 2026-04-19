// V22RunEvaluationModal — V2.2 evaluation runner.
//
// Spec §13 Phase 5 acceptance: requires an active Evaluation Agreement;
// authorized Requirements Sets come from the agreement; output is a parent-layer
// Eval Result; same Req Set lineage supersedes the prior result.
//
// Spec §17.1 future-direction constraint: structurally identical to the parse
// modal — split-panel layout (evidence summary on the left, row-by-row review
// on the right), same row component shape, same ConfidenceBadge style. Eval
// adds SAT/UNSAT/MISSING/N/A status cycling per row; Parse does not.

import { useState, useMemo } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, FieldLabel,
} from './ModalShared'
import PrimeRadiant from '../../v2/PrimeRadiant.jsx'

const STATUS_CYCLE = ['satisfactory', 'unsatisfactory', 'missing', 'na']
const STATUS_CFG = {
  satisfactory:   { label: 'SAT',     color: 'var(--accent-green)' },
  unsatisfactory: { label: 'UNSAT',   color: 'var(--accent-red)' },
  missing:        { label: 'MISSING', color: 'var(--accent-amber)' },
  na:             { label: 'N/A',     color: 'var(--text-dim)' },
}

function ConfidenceBadge({ confidence }) {
  // Match the V2.1 ConfidenceBadge palette so Parse & Eval rows feel identical.
  const c = confidence ?? 0
  const tier = c >= 0.85 ? 'high' : c >= 0.65 ? 'medium' : 'low'
  const palette = {
    high:   { color: 'var(--accent-green)', label: 'HIGH' },
    medium: { color: 'var(--accent-amber)', label: 'MED' },
    low:    { color: 'var(--accent-red)',   label: 'LOW' },
  }[tier]
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
      color: palette.color, background: `color-mix(in srgb, ${palette.color} 12%, transparent)`,
    }}>{palette.label} · {Math.round(c * 100)}%</span>
  )
}

// Shared row component — used here for Eval rows and intended for Parse rows
// in a Phase 6 unification. The status badge cycles only when `cyclable` is true.
function ReviewRow({ label, description, value, onValueChange, confidence, status, onStatusCycle }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: '1px solid var(--border-faint)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, flex: 1 }}>{label}</span>
        {confidence != null && <ConfidenceBadge confidence={confidence} />}
        {status && (
          <span
            onClick={onStatusCycle}
            title="Cycle SAT → UNSAT → MISSING → N/A"
            style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 8px', borderRadius: 3, letterSpacing: '0.06em',
              cursor: 'pointer', userSelect: 'none',
              color: STATUS_CFG[status].color,
              background: `color-mix(in srgb, ${STATUS_CFG[status].color} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${STATUS_CFG[status].color} 30%, transparent)`,
            }}
          >{STATUS_CFG[status].label}</span>
        )}
      </div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{description}</div>
      )}
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="Extracted value"
        style={{
          fontSize: 12, fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '6px 10px',
          outline: 'none',
        }}
      />
    </div>
  )
}

export default function V22RunEvaluationModal({
  evaluationAgreement,    // active EA (paired with the DA being evaluated)
  claim,                  // the Claim being evaluated
  evidenceAssets = [],    // [{ id, name, file: { filename, ... } }] — Assets in DA scope
  availableRequirementsSets = [],  // full library — see Phase 6 carry-over #1
  priorActiveResult,      // optional prior result with same Req Set lineage (will be superseded)
  // Phase 6.5+ #6: Eval Results that already exist on this Claim (any owner).
  // Used to detect exact duplicates of (Req Set, evidence selection).
  existingEvalResults = [],   // [{ id, pin, requirementsSet: { id, name }, evidenceUsed: [...] }]
  onJumpToExistingEvalResult, // (evalResultId) => void — closes modal + pans
  onSubmit,               // ({ requirementsSet, rows, evidenceUsed }) => void
  onClose,
  // Self-evaluation flow (spec §13 Phase 6) skips the EA gate; pass `selfEvaluation`
  // to render an "Owner self-evaluation" header context instead of the EA id.
  selfEvaluation = false,
}) {
  // EA `authorizedRequirementsSetIds` is advisory per spec §10.5 (Phase 6
  // product decision). Show ALL Req Sets from the evaluator's library; the EA
  // suggestions are surfaced inline as a chip on each suggested set.
  const suggestedSetIds = new Set(evaluationAgreement?.authorizedRequirementsSetIds || [])

  const [selectedReqSetId, setSelectedReqSetId] = useState(availableRequirementsSets[0]?.id || null)
  const selectedReqSet = availableRequirementsSets.find((rs) => rs.id === selectedReqSetId) || null

  // Initial rows: prior result (re-eval) takes precedence; otherwise pull from
  // the req set's `requirements` (V2.1 demo data shape) or `claims` (legacy).
  const initialRows = useMemo(() => {
    if (priorActiveResult && priorActiveResult.requirementsSet?.id === selectedReqSetId) {
      return priorActiveResult.results.map((r) => ({
        requirementId: r.requirementId,
        label: r.label,
        value: r.value,
        confidence: 0.9,
        status: r.status,
      }))
    }
    const defs = selectedReqSet?.requirements || selectedReqSet?.claims || []
    if (defs.length > 0) {
      return defs.map((c) => ({
        requirementId: c.id || c.requirementId || c.label,
        label: c.label || c.requirement || c.name,
        description: c.description || c.criterion,
        value: '',
        confidence: 0.0,
        status: 'missing',
      }))
    }
    return []
  }, [selectedReqSet, selectedReqSetId, priorActiveResult])

  const [rows, setRows] = useState(initialRows)
  const [evidenceSelection, setEvidenceSelection] = useState(() => evidenceAssets.map((a) => a.id))
  // Phase 6.5 #2: multi-stage flow matching ParseEvidenceModal —
  //   step 0: select Req Set + scope
  //   step 1: processing (PrimeRadiant + progress bar, 1.5s)
  //   step 2: review rows (split-panel)
  const [step, setStep] = useState(0)

  // Reset rows when selectedReqSetId changes
  const lastReqSetIdRef = useState({ value: selectedReqSetId })[0]
  if (lastReqSetIdRef.value !== selectedReqSetId) {
    lastReqSetIdRef.value = selectedReqSetId
    setRows(initialRows)
  }

  const handleRunEvaluation = () => {
    // canSubmit captures: selected req set + non-zero rows + non-zero evidence
    // + not a duplicate (Phase 6.5+ #6 + #8).
    if (!canSubmit) return
    setStep(1)
    setTimeout(() => setStep(2), 1500)
  }

  const cycleStatus = (idx) => {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r
      const cur = STATUS_CYCLE.indexOf(r.status)
      const next = STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length]
      return { ...r, status: next }
    }))
  }

  const updateValue = (idx, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value, confidence: r.confidence || 0.85 } : r)))
  }

  const toggleEvidence = (id) => {
    setEvidenceSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Phase 6.5+ #6: detect an exact (Req Set, evidence selection) duplicate of
  // an existing Eval Result. Set comparison is order-independent.
  const sameSet = (a, b) => {
    if (a.length !== b.length) return false
    const A = new Set(a)
    for (const x of b) if (!A.has(x)) return false
    return true
  }
  const duplicateOfExisting = selectedReqSet
    ? existingEvalResults.find((er) =>
        er.requirementsSet?.id === selectedReqSet.id
        && sameSet(er.evidenceUsed || [], evidenceSelection)
      )
    : null

  // Phase 6.5+ #8: require at least one evidence Asset to be selected.
  // Phase 6.5+ #6: also block submission when the (Req Set, evidence) combo
  // exactly duplicates an existing result.
  const canSubmit = !!selectedReqSet && rows.length > 0 && evidenceSelection.length > 0 && !duplicateOfExisting

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit?.({
      requirementsSet: { id: selectedReqSet.id, name: selectedReqSet.name, version: selectedReqSet.version ?? 1 },
      rows: rows.map((r) => ({
        requirementId: r.requirementId,
        label: r.label,
        value: r.value,
        status: r.status,
      })),
      evidenceUsed: [...evidenceSelection],
    })
  }

  const supersedeNotice = priorActiveResult && priorActiveResult.requirementsSet?.id === selectedReqSetId

  const headerSubtitle =
    selfEvaluation
      ? `Self-evaluating ${claim?.name || ''} (no Evaluation Agreement required).`
      : `Evaluating ${claim?.name || ''} under EA ${evaluationAgreement?.id || ''}.`

  return (
    <Backdrop onClose={onClose}>
      <Modal width={step === 2 ? 920 : 720}>
        {/* ── Stage 0: Select Req Set + scope ───────────────────────── */}
        {step === 0 && (
          <>
            <ModalHeader
              title="Run Evaluation"
              subtitle={headerSubtitle}
              step={1} totalSteps={3} onClose={onClose}
            />
            <ModalBody>
              <FieldLabel label="Requirements Set" required />
              {availableRequirementsSets.length === 0 ? (
                <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--accent-amber)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  No Requirements Sets in your library. Add one before running an evaluation.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                  {availableRequirementsSets.map((rs) => {
                    const selected = selectedReqSetId === rs.id
                    const suggested = suggestedSetIds.has(rs.id)
                    return (
                      <div
                        key={rs.id}
                        onClick={() => setSelectedReqSetId(rs.id)}
                        style={{
                          padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
                          background: selected ? 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)' : 'var(--bg-card)',
                          border: `1px solid ${selected ? 'var(--accent-indigo)' : 'var(--border)'}`,
                          transition: 'all 120ms',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{rs.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{rs.id} · v{rs.version ?? 1}</div>
                        </div>
                        {suggested && (
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                            color: 'var(--accent-amber)',
                            background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                          }}>SUGGESTED</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {supersedeNotice && !duplicateOfExisting && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, marginBottom: 16,
                  background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
                  fontSize: 11, color: 'var(--text-secondary)',
                  display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <span aria-hidden style={{ color: 'var(--accent-amber)' }}>⚠</span>
                  An active Eval Result with this Requirements Set lineage already exists. Running this evaluation will mark it <code style={{ fontFamily: 'var(--font-mono)' }}>SUPERSEDED</code>.
                </div>
              )}
              {duplicateOfExisting && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, marginBottom: 16,
                  background: 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-indigo) 30%, transparent)',
                  fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <span aria-hidden style={{ color: 'var(--accent-indigo)', flexShrink: 0, marginTop: 1 }}>ⓘ</span>
                  <span>
                    This evaluation already exists as <strong style={{ color: 'var(--text-primary)' }}>{duplicateOfExisting.requirementsSet?.name || duplicateOfExisting.id}</strong>{' '}
                    {duplicateOfExisting.pin && (
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', background: 'var(--bg-raised)', borderRadius: 3 }}>
                        {duplicateOfExisting.pin.length > 24
                          ? duplicateOfExisting.pin.slice(0, 10) + '…' + duplicateOfExisting.pin.slice(-4)
                          : duplicateOfExisting.pin}
                      </code>
                    )}
                    .{' '}
                    <span
                      onClick={() => onJumpToExistingEvalResult?.(duplicateOfExisting.id)}
                      style={{
                        color: 'var(--accent-indigo)', cursor: 'pointer',
                        borderBottom: '1px dashed var(--accent-indigo)',
                      }}
                    >View it on the canvas →</span>
                  </span>
                </div>
              )}

              <FieldLabel label={`Evidence in scope (${evidenceAssets.length})`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {evidenceAssets.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No Assets in scope. The evaluation will run without evidence (self-attestation).</div>
                ) : evidenceAssets.map((a) => {
                  const selected = evidenceSelection.includes(a.id)
                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleEvidence(a.id)}
                      style={{
                        padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                        background: selected ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'var(--bg-card)',
                        border: `1px solid ${selected ? 'var(--accent-indigo)' : 'var(--border)'}`,
                        display: 'flex', gap: 8, alignItems: 'center',
                      }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: 2,
                        border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                        background: selected ? 'var(--accent-indigo)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {selected && <span style={{ color: 'var(--bg-deep)', fontSize: 8, fontWeight: 900 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {a.file?.filename || a.id}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ModalBody>
            <ModalFooter>
              {/* Phase 6.5+ #8: surface the disabled reason so the user knows
                  why "Run Evaluation" is greyed out. */}
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {!selectedReqSet
                  ? 'Pick a Requirements Set to continue.'
                  : evidenceSelection.length === 0
                    ? 'Select at least one evidence Asset to evaluate.'
                    : duplicateOfExisting
                      ? 'This (Requirements Set, evidence) combination already has an Eval Result.'
                      : ''}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn label="Cancel" onClick={onClose} />
                <Btn
                  label="Run Evaluation"
                  accent
                  disabled={!canSubmit}
                  onClick={handleRunEvaluation}
                />
              </div>
            </ModalFooter>
          </>
        )}

        {/* ── Stage 1: Processing ────────────────────────────────────── */}
        {step === 1 && (
          <>
            <ModalHeader
              title="Run Evaluation"
              subtitle={headerSubtitle}
              step={2} totalSteps={3} onClose={onClose}
            />
            <ModalBody>
              <div style={{ padding: '60px 36px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 28px' }}>
                  <PrimeRadiant size={80} fps={30} strutScale={1.8} brightness={0.3} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Evaluating against {selectedReqSet?.name || 'Requirements Set'}…
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Running {rows.length} requirement{rows.length !== 1 ? 's' : ''} across {evidenceSelection.length} evidence file{evidenceSelection.length !== 1 ? 's' : ''}
                </div>
                <div style={{
                  width: '60%', height: 3, borderRadius: 2,
                  background: 'var(--border)', margin: '24px auto 0',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'var(--accent-indigo)',
                    animation: 'v22evalprogress 1.5s ease forwards',
                  }} />
                </div>
                <style>{`@keyframes v22evalprogress { from { width: 0% } to { width: 100% } }`}</style>
              </div>
            </ModalBody>
          </>
        )}

        {/* ── Stage 2: Review rows ───────────────────────────────────── */}
        {step === 2 && (
          <>
            <ModalHeader
              title="Run Evaluation"
              subtitle="Review extracted values and assessment statuses"
              step={3} totalSteps={3} onClose={onClose}
            />
            <ModalBody>
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18, alignItems: 'start' }}>
                <div>
                  <FieldLabel label={`Evidence (${evidenceSelection.length})`} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {evidenceAssets.filter(a => evidenceSelection.includes(a.id)).map((a) => (
                      <div key={a.id} style={{
                        padding: '8px 10px', borderRadius: 4,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {a.file?.filename || a.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel label={`Requirement Rows (${rows.length})`} />
                  <div style={{
                    border: '1px solid var(--border)', borderRadius: 8,
                    maxHeight: 420, overflowY: 'auto',
                  }}>
                    {rows.map((r, i) => (
                      <ReviewRow
                        key={r.requirementId}
                        label={r.label}
                        description={r.description}
                        value={r.value}
                        onValueChange={(v) => updateValue(i, v)}
                        confidence={r.confidence}
                        status={r.status}
                        onStatusCycle={() => cycleStatus(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {rows.length > 0 && (
                  <>
                    {rows.filter(r => r.status === 'satisfactory').length} SAT ·{' '}
                    {rows.filter(r => r.status === 'unsatisfactory').length} UNSAT ·{' '}
                    {rows.filter(r => r.status === 'missing').length} MISSING ·{' '}
                    {rows.filter(r => r.status === 'na').length} N/A
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn label="Back" onClick={() => setStep(0)} />
                <Btn label="Save Evaluation Result" accent disabled={!canSubmit} onClick={handleSubmit} />
              </div>
            </ModalFooter>
          </>
        )}
      </Modal>
    </Backdrop>
  )
}
