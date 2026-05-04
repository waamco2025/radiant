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
import Tooltip from '../Tooltip'

const STATUS_CYCLE = ['satisfactory', 'unsatisfactory', 'missing', 'na']
const STATUS_CFG = {
  // Phase 9A item 8 sub-1: full status words in the cycling picker (was
  // three-letter abbreviations). Short labels retained for Detail Panel
  // rendering elsewhere.
  satisfactory:   { label: 'SATISFACTORY',   short: 'SAT',     color: 'var(--accent-green)' },
  unsatisfactory: { label: 'UNSATISFACTORY', short: 'UNSAT',   color: 'var(--accent-red)' },
  missing:        { label: 'MISSING',        short: 'MISSING', color: 'var(--accent-amber)' },
  na:             { label: 'N/A',            short: 'N/A',     color: 'var(--text-dim)' },
}
// Exported so V22NodeDetailPanel can render short labels using the same palette.
export { STATUS_CFG as REVIEW_STATUS_CFG }

function cycleNextStatus(current, direction = 1) {
  const idx = STATUS_CYCLE.indexOf(current)
  const n = STATUS_CYCLE.length
  return STATUS_CYCLE[((idx < 0 ? 0 : idx) + direction + n) % n]
}

function ConfidenceBadge({ confidence }) {
  // Phase 9A.1 item 9: AWAITING AI placeholder removed. Seeded Req Sets and
  // PEP templates now carry `aiValue` + `aiConfidence` on every row, so a
  // freshly-opened review stage always has real values to show. A null
  // confidence is unreachable in normal demo flow; render nothing rather
  // than a fallback pill to keep the row uncluttered.
  if (confidence == null) return null
  const c = confidence
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

// Phase 9A item 10: small pencil icon rendered when the row's current value
// differs from the AI's original extraction. Tooltip reads the spec wording.
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

// Phase 9A item 8 sub-1: chevron-flanked status picker — ◂ SATISFACTORY ▸ —
// left chevron cycles backward, right chevron (and the word) cycles forward.
// Phase 9A.1 item 8: word pinned to the width of UNSATISFACTORY (widest of
// the four) so chevrons stay in fixed positions as the user cycles.
function StatusChevronPicker({ status, onCycle }) {
  if (!status) return null
  const cfg = STATUS_CFG[status]
  const chipStyle = {
    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
    letterSpacing: '0.06em', userSelect: 'none',
    display: 'inline-flex', alignItems: 'center',
    border: `1px solid color-mix(in srgb, ${cfg.color} 30%, transparent)`,
    background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
    borderRadius: 3,
    color: cfg.color,
  }
  const chevStyle = {
    cursor: 'pointer', padding: '2px 6px', userSelect: 'none',
    color: cfg.color, lineHeight: 1,
  }
  return (
    <span style={chipStyle}>
      <Tooltip content="Previous status">
        <span
          onClick={(e) => { e.stopPropagation(); onCycle(-1) }}
          style={chevStyle}
        >◂</span>
      </Tooltip>
      <Tooltip content="Next status">
        <span
          onClick={(e) => { e.stopPropagation(); onCycle(+1) }}
          style={{
            padding: '2px 2px',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'inline-block',
            // Pin to the widest label's width ("UNSATISFACTORY" = 14 chars at
            // 10px mono). Phase 9A.1.5 item 3 bumped 96 → 100 because the
            // UNSATISFACTORY rendered width came in at ~95-96 and brushed up
            // against the pinned minimum, causing a sub-pixel width flicker
            // when cycling in/out. 100 leaves a clear margin and keeps all
            // four states pixel-stable.
            minWidth: 100,
          }}
        >{cfg.label}</span>
      </Tooltip>
      <Tooltip content="Next status">
        <span
          onClick={(e) => { e.stopPropagation(); onCycle(+1) }}
          style={chevStyle}
        >▸</span>
      </Tooltip>
    </span>
  )
}

// Shared row component — used here for Eval rows and intended for Parse rows
// in a Phase 6 unification.
function ReviewRow({ label, description, value, onValueChange, confidence, status, onStatusCycle, humanEdited }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: '1px solid var(--border-faint)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, flex: 1 }}>{label}</span>
        {/* Phase 9A item 8 sub-3: always render the confidence chip (AWAITING
            AI when null). Phase 9A item 10: pencil icon when the row's
            current value differs from the AI's original. */}
        <ConfidenceBadge confidence={confidence} />
        {humanEdited && <HumanEditedIcon />}
        <StatusChevronPicker status={status} onCycle={(dir) => onStatusCycle(dir)} />
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
  // Phase 12.2 (#106 + #121): submit shape extended for multi-RS batch.
  //   { batchId, perRsResults: [{ requirementsSet, rows }], evidenceUsed,
  //     priorEvalResultId, evidenceDiff } => void
  // Solo evaluations send a single-entry perRsResults array; the orchestrator
  // (V2App.handleV22EvaluationSubmit) generates N Eval Results sharing batchId.
  onSubmit,
  onClose,
  // Self-evaluation flow (spec §13 Phase 6) skips the EA gate; pass `selfEvaluation`
  // to render an "Owner self-evaluation" header context instead of the EA id.
  selfEvaluation = false,
  // Phase 9A item 6: Re-Evaluate flow from an Eval Result panel. When set,
  // the Req Set picker is replaced by a read-only card showing the locked
  // Req Set, and the user proceeds directly to scope / review.
  lockedRequirementsSetId = null,
  // Phase 12.2 (#117): pre-computed evidence diff vs. priorActiveResult.
  // V2App computes via `computeEvidenceDiff` against the current Claim
  // and passes it through. Renders as a banner above the review rows.
  evidenceDiff = null,
  // Phase 12.2 (#105): role context for the empty-state copy split.
  isOwnerView = false,
  // Phase 12.2 (#117): name lookup for diff banner asset references.
  assetNameLookup = {},
  // Phase 12.3 (Bug A + Pivot 1): public RS pool for the checkbox picker.
  // Deduped against `availableRequirementsSets` at composition time —
  // when the same RS id is reachable through both pools, the
  // owner-authored entry wins (provenance: 'own' badge).
  publicRequirementSets = [],
}) {
  // EA `authorizedRequirementsSetIds` is advisory per spec §10.5 (Phase 6
  // product decision). Show ALL Req Sets from the evaluator's library; the EA
  // suggestions are surfaced inline as a chip on each suggested set.
  const suggestedSetIds = new Set(evaluationAgreement?.authorizedRequirementsSetIds || [])

  // Phase 12.3 (Bug A): dedupe RS pool at composition time. Owner-authored
  // entries win on duplicate id (so the row's provenance badge reads
  // "Authored by you" rather than "Public" when the same RS is in both
  // pools). The `_provenance` flag is consumed only for badge rendering;
  // submit semantics treat all selected RSes uniformly.
  const dedupedRsPool = useMemo(() => {
    const map = new Map()
    for (const rs of availableRequirementsSets) {
      if (!map.has(rs.id)) map.set(rs.id, { ...rs, _provenance: 'own' })
    }
    for (const rs of publicRequirementSets) {
      if (!map.has(rs.id)) map.set(rs.id, { ...rs, _provenance: 'public' })
    }
    return Array.from(map.values())
  }, [availableRequirementsSets, publicRequirementSets])

  // Phase 12.3 (Pivot 1): checkbox multi-select replacing the prior
  // primary/additional split. Empty by default — user must check ≥1 RS to
  // proceed. Locked Re-Evaluate flow auto-checks the locked RS on mount.
  // Order is preserved as the order Bob checked the rows.
  const [selectedReqSetIds, setSelectedReqSetIds] = useState(() =>
    lockedRequirementsSetId ? [lockedRequirementsSetId] : []
  )
  const toggleSelectedReqSet = (rsId) => {
    if (lockedRequirementsSetId && rsId !== lockedRequirementsSetId) return
    setSelectedReqSetIds((prev) => prev.includes(rsId) ? prev.filter((x) => x !== rsId) : [...prev, rsId])
  }

  // Resolve a selected RS id to a full RS object (with requirements / claims
  // payload). Re-Evaluate flow synthesizes from `priorActiveResult` if the
  // locked id isn't in the active library.
  const resolveRsObject = (rsId) => {
    const fromLib = dedupedRsPool.find((rs) => rs.id === rsId)
      || availableRequirementsSets.find((rs) => rs.id === rsId)
      || publicRequirementSets.find((rs) => rs.id === rsId)
    if (fromLib) return fromLib
    if (lockedRequirementsSetId === rsId
      && priorActiveResult
      && priorActiveResult.requirementsSet?.id === rsId) {
      return {
        id: priorActiveResult.requirementsSet.id,
        name: priorActiveResult.requirementsSet.name,
        version: priorActiveResult.requirementsSet.version ?? 1,
        requirements: (priorActiveResult.results || []).map((r) => ({
          id: r.requirementId,
          label: r.label,
          description: r.description,
        })),
      }
    }
    return null
  }

  // Build initial rows for an RS — re-eval pre-populates from the prior
  // result, fresh evaluation pre-populates from the RS definition's AI
  // values (Phase 9A.1 item 9) with `_aiOriginalValue` snapshotted for
  // the human-edited pencil icon (Phase 9A item 10).
  const buildRowsForRs = (rs) => {
    if (!rs) return []
    if (priorActiveResult && priorActiveResult.requirementsSet?.id === rs.id) {
      return priorActiveResult.results.map((r) => ({
        requirementId: r.requirementId,
        label: r.label,
        value: r.value,
        confidence: typeof r.confidence === 'number' ? r.confidence : null,
        status: r.status,
        _aiOriginalValue: r.value,
      }))
    }
    const defs = rs.requirements || rs.claims || []
    return defs.map((c) => {
      const aiValue = c.aiValue ?? ''
      return {
        requirementId: c.id || c.requirementId || c.label,
        label: c.label || c.requirement || c.name,
        description: c.description || c.criterion,
        value: aiValue,
        confidence: typeof c.aiConfidence === 'number' ? c.aiConfidence : null,
        status: aiValue ? 'satisfactory' : 'missing',
        _aiOriginalValue: aiValue,
      }
    })
  }

  // Phase 12.3 (Pivot 2): rows tracked per RS. `rowsByRsId[rsId]` is the
  // editable row array for that RS. Sync against `selectedReqSetIds` —
  // newly-checked RSes get fresh rows; unchecked RSes drop their entries
  // (deselecting + re-selecting forfeits prior edits, which matches the
  // existing single-RS behavior of resetting on RS change).
  const [rowsByRsId, setRowsByRsId] = useState(() => {
    if (!selectedReqSetIds.length) return {}
    const out = {}
    for (const rsId of selectedReqSetIds) {
      const rs = resolveRsObject(rsId)
      if (rs) out[rsId] = buildRowsForRs(rs)
    }
    return out
  })
  const lastSelectionKeyRef = useState({ key: selectedReqSetIds.join('|') })[0]
  const currentSelectionKey = selectedReqSetIds.join('|')
  if (lastSelectionKeyRef.key !== currentSelectionKey) {
    lastSelectionKeyRef.key = currentSelectionKey
    setRowsByRsId((prev) => {
      const next = {}
      for (const rsId of selectedReqSetIds) {
        if (prev[rsId]) {
          next[rsId] = prev[rsId]
        } else {
          const rs = resolveRsObject(rsId)
          next[rsId] = rs ? buildRowsForRs(rs) : []
        }
      }
      return next
    })
  }
  // Phase 12.2 (#106): evidence is no longer user-selected; the snapshot
  // lives in `evidenceUsedSnapshot` (computed below from `evidenceAssets`).
  // The legacy `evidenceSelection` state is retained as a no-op placeholder
  // to keep the original processing-stage copy referencing the asset count
  // working unchanged — the array always equals all in-scope Assets.
  const evidenceSelection = useMemo(() => evidenceAssets.map((a) => a.id), [evidenceAssets])
  // Phase 6.5 #2: multi-stage flow matching ParseEvidenceModal —
  //   step 0: select Req Set + scope
  //   step 1: processing (PrimeRadiant + progress bar, 1.5s)
  //   step 2: review rows (split-panel)
  const [step, setStep] = useState(0)

  const handleRunEvaluation = () => {
    if (!canSubmit) return
    setStep(1)
    setTimeout(() => setStep(2), 1500)
  }

  // Phase 12.3 (Pivot 2): per-RS row mutators. `cycleStatus(rsId, idx, dir)`
  // and `updateValue(rsId, idx, value)` replace the prior single-RS shape.
  const cycleStatus = (rsId, idx, direction = 1) => {
    setRowsByRsId((prev) => {
      const rsRows = prev[rsId] || []
      return {
        ...prev,
        [rsId]: rsRows.map((r, i) => (i === idx ? { ...r, status: cycleNextStatus(r.status, direction) } : r)),
      }
    })
  }

  const updateValue = (rsId, idx, value) => {
    setRowsByRsId((prev) => {
      const rsRows = prev[rsId] || []
      return {
        ...prev,
        [rsId]: rsRows.map((r, i) => (i === idx ? { ...r, value } : r)),
      }
    })
  }

  // Phase 12.2 (#106): evidence is no longer selectable. The snapshot is
  // the full set of in-scope Assets at evaluation time.
  const evidenceUsedSnapshot = useMemo(() => evidenceAssets.map((a) => a.id), [evidenceAssets])

  // Phase 12.3 (Pivot 1): duplicate detection keys on each selected RS's id
  // + the current evidence snapshot. Solo selection (1 RS) keeps the §11
  // supersession-style block. Multi-RS batches skip the block — running
  // the same evidence against multiple RSes is the explicit feature.
  const sameSet = (a, b) => {
    if (a.length !== b.length) return false
    const A = new Set(a)
    for (const x of b) if (!A.has(x)) return false
    return true
  }
  const duplicateOfExisting = selectedReqSetIds.length === 1
    ? existingEvalResults.find((er) =>
        er.requirementsSet?.id === selectedReqSetIds[0]
        && sameSet(er.evidenceUsed || [], evidenceUsedSnapshot)
      )
    : null

  // Phase 12.3: submit gated on at-least-one RS checked + non-empty evidence
  // + EA not pending-acceptance + not a single-RS duplicate. No "primary RS"
  // concept anymore.
  const eaPendingAcceptance = evaluationAgreement?.status === 'pending-acceptance'
  const hasEvidence = evidenceUsedSnapshot.length > 0
  const hasAnyRsSelected = selectedReqSetIds.length > 0
  const canSubmit = hasAnyRsSelected && hasEvidence && !duplicateOfExisting && !eaPendingAcceptance

  const handleSubmit = () => {
    if (!canSubmit) return
    // Phase 12.3 (Pivot 2): build per-RS results from `rowsByRsId`. Each
    // selected RS contributes one Eval Result; submit-with-defaults works
    // because each RS's rows carry AI-suggested values out of the box.
    const perRsResults = []
    for (const rsId of selectedReqSetIds) {
      const rs = resolveRsObject(rsId)
      if (!rs) continue
      const rsRows = (rowsByRsId[rsId] || []).map((r) => ({
        requirementId: r.requirementId,
        label: r.label,
        value: r.value,
        status: r.status,
        confidence: r.confidence,
        _aiOriginalValue: r._aiOriginalValue,
      }))
      perRsResults.push({
        requirementsSet: { id: rs.id, name: rs.name, version: rs.version ?? 1 },
        rows: rsRows,
      })
    }
    if (perRsResults.length === 0) return
    const batchId = `batch-${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
    onSubmit?.({
      batchId,
      perRsResults,
      evidenceUsed: [...evidenceUsedSnapshot],
      requirementsSet: perRsResults[0].requirementsSet,
      rows: perRsResults[0].rows,
      priorEvalResultId: priorActiveResult?.id || null,
      evidenceDiff: evidenceDiff || null,
    })
  }

  const supersedeNotice = priorActiveResult
    && selectedReqSetIds.includes(priorActiveResult.requirementsSet?.id)

  const headerSubtitle =
    selfEvaluation
      ? `Self-evaluating ${claim?.name || ''} (no Evaluation Agreement required).`
      : `Evaluating ${claim?.name || ''} under Evaluation Agreement ${evaluationAgreement?.id || ''}.`

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
              {/* Phase 12.3 (Pivot 1): checkbox multi-select. The label
                  hint reads "(check 1 or more)" so the multi behavior is
                  obvious. Locked Re-Evaluate flow auto-checks the locked
                  RS and disables every other row. */}
              <FieldLabel label={`Requirements Sets (${selectedReqSetIds.length} checked)`} required />
              {dedupedRsPool.length === 0 ? (
                <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--accent-amber)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  No Requirements Sets in your library. Add one before running an evaluation.
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16,
                  maxHeight: 300, overflowY: 'auto',
                  paddingRight: 2,
                }}>
                  {dedupedRsPool.map((rs) => {
                    const isChecked = selectedReqSetIds.includes(rs.id)
                    const lockedOther = !!lockedRequirementsSetId && lockedRequirementsSetId !== rs.id
                    const lockedThis = lockedRequirementsSetId === rs.id
                    const disabled = lockedOther
                    const provenanceLabel = rs._provenance === 'own' ? 'Authored by you'
                      : rs._provenance === 'public' ? 'Public' : null
                    const suggested = suggestedSetIds.has(rs.id)
                    return (
                      <div
                        key={rs.id}
                        onClick={() => { if (!disabled) toggleSelectedReqSet(rs.id) }}
                        role="checkbox"
                        aria-checked={isChecked}
                        aria-disabled={disabled}
                        tabIndex={disabled ? -1 : 0}
                        onKeyDown={(e) => {
                          if (disabled) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleSelectedReqSet(rs.id)
                          }
                        }}
                        style={{
                          padding: '10px 14px', borderRadius: 6,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          background: isChecked ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'var(--bg-card)',
                          border: `1px solid ${isChecked ? 'var(--accent-indigo)' : 'var(--border)'}`,
                          opacity: disabled ? 0.5 : 1,
                          transition: 'all 120ms',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                      >
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          border: `1.5px solid ${isChecked ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                          background: isChecked ? 'var(--accent-indigo)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isChecked && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{rs.name}</span>
                            <span style={{
                              fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                              flexShrink: 0,
                            }}>v{rs.version ?? 1}</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {rs.id}
                          </div>
                        </div>
                        {provenanceLabel && (
                          <span style={{
                            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '1px 5px', borderRadius: 3, letterSpacing: '0.1em',
                            color: 'var(--text-dim)',
                            background: 'var(--bg-deep)',
                            border: '1px solid var(--border-faint)',
                            flexShrink: 0,
                            textTransform: 'uppercase',
                          }}>{provenanceLabel}</span>
                        )}
                        {suggested && (
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                            color: 'var(--accent-amber)',
                            background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                            flexShrink: 0,
                          }}>SUGGESTED</span>
                        )}
                        {lockedThis && (
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                            color: 'var(--accent-indigo)',
                            background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                            flexShrink: 0,
                          }}>LOCKED</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {lockedRequirementsSetId && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16, fontStyle: 'italic' }}>
                  This is a re-evaluation. To pick a different Requirements Set, start a new evaluation from the Claim.
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

              {/* Phase 12.2 (#106): Asset picker dropped. Evidence is the
                  snapshot of all in-scope Assets at submit time, computed
                  from `evidenceAssets`. The summary below replaces the
                  former picker — read-only acknowledgment. */}
              {/* Phase 12.2 (#117): re-run diff banner. Surfaces when
                  V2App passes a non-empty `evidenceDiff`. */}
              {evidenceDiff && (evidenceDiff.added.length + evidenceDiff.removed.length + evidenceDiff.superseded.length > 0) && (
                <div style={{
                  marginTop: 14, marginBottom: 8,
                  padding: '12px 14px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--accent-amber) 7%, transparent)',
                  border: '1px dashed color-mix(in srgb, var(--accent-amber) 40%, transparent)',
                  fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5,
                }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    CHANGES SINCE LAST EVALUATION
                  </div>
                  +{evidenceDiff.added.length} Asset{evidenceDiff.added.length === 1 ? '' : 's'} · −{evidenceDiff.removed.length} Asset{evidenceDiff.removed.length === 1 ? '' : 's'} · {evidenceDiff.superseded.length} superseded · {evidenceDiff.carried.length} carried over.
                  {priorActiveResult && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                      Prior result: {priorActiveResult.requirementsSet?.name || priorActiveResult.id}
                    </div>
                  )}
                </div>
              )}
              <FieldLabel label={`Assets in scope (${evidenceAssets.length}) — auto-snapshot at submit`} />
              {evidenceAssets.length === 0 ? (
                /* Phase 12.2 (#105): empty-evidence copy split by role. */
                <div style={{
                  padding: 14, borderRadius: 8, marginTop: 4,
                  border: '1px dashed color-mix(in srgb, var(--accent-amber) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
                  fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  {isOwnerView
                    ? 'There is no evidence associated with this Claim. Add evidence to self-evaluate.'
                    : 'There is no evidence associated with this Claim. Ask the owner of this Claim to add evidence to evaluate.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {evidenceAssets.map((a) => (
                    <div key={a.id} style={{
                      padding: '8px 10px', borderRadius: 4,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {a.file?.filename || a.id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              {/* Phase 6.5+ #8: surface the disabled reason so the user knows
                  why "Run Evaluation" is greyed out.
                  Phase 11.6 (#164): pending-acceptance branch. Wins over
                  other gates since it's the most actionable. */}
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {eaPendingAcceptance
                  ? `Cannot run evaluation: this Evaluation Agreement has a pending amendment proposal. Wait for ${evaluationAgreement?.grantor?.party || 'the grantor'}'s response, or respond to the proposal in your inbox.`
                  : !hasAnyRsSelected
                    ? 'Check at least one Requirements Set to continue.'
                    : !hasEvidence
                      ? (isOwnerView ? 'Add evidence to this Claim before evaluating.' : 'Ask the Claim owner to add evidence before evaluating.')
                      : duplicateOfExisting
                        ? 'This (Requirements Set, evidence) combination already has an Eval Result.'
                        : selectedReqSetIds.length > 1
                          ? `Will produce ${selectedReqSetIds.length} Eval Results sharing a batch id.`
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
                {(() => {
                  // Phase 12.3: aggregate counts across selected RSes for
                  // the processing-stage copy.
                  const totalRows = selectedReqSetIds.reduce((acc, rsId) => acc + (rowsByRsId[rsId]?.length || 0), 0)
                  const firstRs = selectedReqSetIds.length > 0 ? resolveRsObject(selectedReqSetIds[0]) : null
                  const headerLabel = selectedReqSetIds.length === 1
                    ? (firstRs?.name || 'Requirements Set')
                    : `${selectedReqSetIds.length} Requirements Sets`
                  return (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                        Evaluating against {headerLabel}…
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                        Running {totalRows} requirement{totalRows !== 1 ? 's' : ''} across {evidenceSelection.length} Asset{evidenceSelection.length !== 1 ? 's' : ''}
                      </div>
                    </>
                  )
                })()}
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
              {/* Phase 8.5 Bug 5: bound the split panel so each column scrolls
                  independently — the rows side already had its own
                  `maxHeight: 420, overflowY: auto`, but the evidence side
                  rode with ModalBody's outer scroll, pulling both into a
                  single scroll region on tall evidence sets. */}
              <div style={{
                display: 'grid', gridTemplateColumns: '260px 1fr',
                gap: 18, alignItems: 'stretch',
                height: 'calc(90vh - 220px)',
                minHeight: 360, maxHeight: 640,
              }}>
                <div style={{ minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  <FieldLabel label={`Assets (${evidenceUsedSnapshot.length})`} />
                  {/* Phase 12.2 (#117): repeat the diff banner here too, so the
                      reviewer sees the change context next to the rows. */}
                  {evidenceDiff && (evidenceDiff.added.length + evidenceDiff.removed.length + evidenceDiff.superseded.length > 0) && (
                    <div style={{
                      marginBottom: 10, padding: '8px 10px', borderRadius: 6,
                      background: 'color-mix(in srgb, var(--accent-amber) 7%, transparent)',
                      border: '1px dashed color-mix(in srgb, var(--accent-amber) 40%, transparent)',
                      fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4,
                    }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)', letterSpacing: '0.06em', marginBottom: 4 }}>
                        Δ EVIDENCE
                      </div>
                      +{evidenceDiff.added.length} / −{evidenceDiff.removed.length} / {evidenceDiff.superseded.length} superseded
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {evidenceAssets.map((a) => (
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
                {/* Phase 12.3 (Pivot 2): grouped requirement rows per
                    selected RS. Sections render in check order. Each
                    section shows the RS's name + version header band, then
                    the per-requirement rows. Submit-with-defaults works
                    because each row carries AI-suggested values out of
                    the box; the user can curate or skip directly to
                    Submit. */}
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(() => {
                    // Aggregate counts across all selected RSes for the
                    // footer SAT/UNSAT/MISSING/N/A summary.
                    const allRows = []
                    for (const rsId of selectedReqSetIds) {
                      for (const r of (rowsByRsId[rsId] || [])) allRows.push(r)
                    }
                    return null
                  })()}
                  <div style={{
                    flex: 1, minHeight: 0, overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: 14,
                  }}>
                    {selectedReqSetIds.map((rsId) => {
                      const rs = resolveRsObject(rsId)
                      const rsRows = rowsByRsId[rsId] || []
                      return (
                        <div key={rsId} style={{
                          border: '1px solid var(--border)', borderRadius: 8,
                          background: 'var(--bg-card)',
                          overflow: 'hidden',
                        }}>
                          {/* Section header band */}
                          <div style={{
                            padding: '8px 12px',
                            background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
                            borderBottom: '1px solid var(--border-faint)',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            <span style={{
                              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em',
                              color: 'var(--accent-indigo)',
                              background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                            }}>REQUIREMENTS SET</span>
                            <span style={{
                              fontSize: 12, color: 'var(--text-primary)', fontWeight: 700,
                              flex: 1, minWidth: 0,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{rs?.name || rsId}</span>
                            <span style={{
                              fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                            }}>v{rs?.version ?? 1} · {rsRows.length} requirement{rsRows.length === 1 ? '' : 's'}</span>
                          </div>
                          <div>
                            {rsRows.map((r, i) => (
                              <ReviewRow
                                key={`${rsId}-${r.requirementId}`}
                                label={r.label}
                                description={r.description}
                                value={r.value}
                                onValueChange={(v) => updateValue(rsId, i, v)}
                                confidence={r.confidence}
                                status={r.status}
                                onStatusCycle={(dir) => cycleStatus(rsId, i, dir)}
                                humanEdited={r._aiOriginalValue != null && r.value !== r._aiOriginalValue}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {(() => {
                  const allRows = []
                  for (const rsId of selectedReqSetIds) {
                    for (const r of (rowsByRsId[rsId] || [])) allRows.push(r)
                  }
                  if (allRows.length === 0) return ''
                  return (
                    <>
                      {allRows.filter(r => r.status === 'satisfactory').length} SAT ·{' '}
                      {allRows.filter(r => r.status === 'unsatisfactory').length} UNSAT ·{' '}
                      {allRows.filter(r => r.status === 'missing').length} MISSING ·{' '}
                      {allRows.filter(r => r.status === 'na').length} N/A
                      {selectedReqSetIds.length > 1 ? ` · across ${selectedReqSetIds.length} Requirements Sets` : ''}
                    </>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn label="Back" onClick={() => setStep(0)} />
                <Btn label={selectedReqSetIds.length > 1 ? `Save ${selectedReqSetIds.length} Eval Results` : 'Save Evaluation Result'} accent disabled={!canSubmit} onClick={handleSubmit} />
              </div>
            </ModalFooter>
          </>
        )}
      </Modal>
    </Backdrop>
  )
}
