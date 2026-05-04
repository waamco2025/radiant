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
}) {
  // EA `authorizedRequirementsSetIds` is advisory per spec §10.5 (Phase 6
  // product decision). Show ALL Req Sets from the evaluator's library; the EA
  // suggestions are surfaced inline as a chip on each suggested set.
  const suggestedSetIds = new Set(evaluationAgreement?.authorizedRequirementsSetIds || [])

  // Phase 12.2 (#121): primary RS (the one whose review rows are visible
  // in step 2). Multi-RS additions go into `additionalReqSetIds` — they
  // contribute Eval Results to the batch but don't surface review rows
  // (their rows use AI confidence + status verbatim per Phase 9A item 9).
  const [selectedReqSetId, setSelectedReqSetId] = useState(
    lockedRequirementsSetId || availableRequirementsSets[0]?.id || null,
  )
  const [additionalReqSetIds, setAdditionalReqSetIds] = useState([])
  const toggleAdditionalReqSet = (rsId) => {
    if (rsId === selectedReqSetId) return
    setAdditionalReqSetIds((prev) => prev.includes(rsId) ? prev.filter((x) => x !== rsId) : [...prev, rsId])
  }
  // Phase 9A item 6: when the Re-Evaluate flow passes a locked Req Set id
  // that isn't in the current actor's library (e.g., the Req Set lives on
  // the other party's side, or library ids drifted), synthesize a minimal
  // selectedReqSet from the prior result so the modal can still operate.
  const librarySelectedReqSet = availableRequirementsSets.find((rs) => rs.id === selectedReqSetId) || null
  const selectedReqSet = librarySelectedReqSet
    || (lockedRequirementsSetId
      && priorActiveResult
      && priorActiveResult.requirementsSet?.id === lockedRequirementsSetId
      ? {
          id: priorActiveResult.requirementsSet.id,
          name: priorActiveResult.requirementsSet.name,
          version: priorActiveResult.requirementsSet.version ?? 1,
          requirements: (priorActiveResult.results || []).map((r) => ({
            id: r.requirementId,
            label: r.label,
            description: r.description,
          })),
        }
      : null)

  // Initial rows: prior result (re-eval) takes precedence; otherwise pull from
  // the req set's `requirements` (V2.1 demo data shape) or `claims` (legacy).
  const initialRows = useMemo(() => {
    if (priorActiveResult && priorActiveResult.requirementsSet?.id === selectedReqSetId) {
      // Phase 9A item 8 sub-2: supersede / re-evaluate pre-populates every
      // row from the prior result — value, status, AND confidence (not a
      // hard-coded 0.9). Saves the user re-entering unchanged data.
      // Phase 9A item 10: `_aiOriginalValue` snapshots the prior value so
      // the Human-Edited pencil can fire if the user subsequently edits.
      return priorActiveResult.results.map((r) => ({
        requirementId: r.requirementId,
        label: r.label,
        value: r.value,
        confidence: typeof r.confidence === 'number' ? r.confidence : null,
        status: r.status,
        _aiOriginalValue: r.value,
      }))
    }
    const defs = selectedReqSet?.requirements || selectedReqSet?.claims || []
    if (defs.length > 0) {
      // Phase 9A.1 item 9: pre-populate each row from the Req Set
      // definition's `aiValue` + `aiConfidence`. If the definition happens
      // not to carry an AI value (legacy data or published standards), fall
      // back to an empty value with null confidence so the row still renders.
      // `_aiOriginalValue` snapshots the AI's extraction so the Phase 9A
      // item 10 pencil icon fires whenever the user edits.
      return defs.map((c) => {
        const aiValue = c.aiValue ?? ''
        return {
          requirementId: c.id || c.requirementId || c.label,
          label: c.label || c.requirement || c.name,
          description: c.description || c.criterion,
          value: aiValue,
          confidence: typeof c.aiConfidence === 'number' ? c.aiConfidence : null,
          // Status defaults to 'satisfactory' when an AI value is present
          // (the AI tentatively agrees), 'missing' when no value exists.
          // The user cycles via chevrons if they disagree.
          status: aiValue ? 'satisfactory' : 'missing',
          _aiOriginalValue: aiValue,
        }
      })
    }
    return []
  }, [selectedReqSet, selectedReqSetId, priorActiveResult])

  const [rows, setRows] = useState(initialRows)
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

  // Phase 9A item 8 sub-1: cycle accepts a direction (+1 for next, -1 for
  // previous) so chevrons on both sides of the status chip can step it.
  const cycleStatus = (idx, direction = 1) => {
    setRows((prev) => prev.map((r, i) => (
      i === idx ? { ...r, status: cycleNextStatus(r.status, direction) } : r
    )))
  }

  const updateValue = (idx, value) => {
    // Phase 8.5 Bug 4: human entry must not alter the AI's original confidence.
    // Previously this set `confidence: r.confidence || 0.85`, which bumped any
    // empty-confidence row to "High · 85%" the instant the user typed —
    // muddling human edits with the AI's own analysis. Confidence now stays
    // whatever the AI produced (or 0 if the row started empty). A future
    // polish item may surface a separate "human-validated" indicator.
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value } : r)))
  }

  // Phase 12.2 (#106): evidence is no longer selectable. The snapshot is
  // the full set of in-scope Assets at evaluation time.
  const evidenceUsedSnapshot = useMemo(() => evidenceAssets.map((a) => a.id), [evidenceAssets])

  // Phase 6.5+ #6 (rescoped Phase 12.2): duplicate detection now keys on
  // (Req Set, current evidence snapshot) — there's no user-selectable
  // evidence set anymore, but the snapshot is still the canonical input
  // for "is this run a duplicate of an existing result." Compare against
  // the primary selected RS only — multi-RS batches don't reuse the
  // duplicate-block UX (the UX matches the spec's §11 supersession path).
  const sameSet = (a, b) => {
    if (a.length !== b.length) return false
    const A = new Set(a)
    for (const x of b) if (!A.has(x)) return false
    return true
  }
  const duplicateOfExisting = selectedReqSet && additionalReqSetIds.length === 0
    ? existingEvalResults.find((er) =>
        er.requirementsSet?.id === selectedReqSet.id
        && sameSet(er.evidenceUsed || [], evidenceUsedSnapshot)
      )
    : null

  // Phase 12.2 (#106 + #105): submit gates simplified. No evidence-count
  // gate — empty-evidence Claims block submit via the empty-state copy
  // path (rendered above) which short-circuits the modal.
  const eaPendingAcceptance = evaluationAgreement?.status === 'pending-acceptance'
  const hasEvidence = evidenceUsedSnapshot.length > 0
  const canSubmit = !!selectedReqSet && rows.length > 0 && hasEvidence && !duplicateOfExisting && !eaPendingAcceptance

  const handleSubmit = () => {
    if (!canSubmit) return
    // Phase 12.2 (#121): build per-RS results. Primary RS uses the
    // human-edited rows. Additional RS use AI confidence + status
    // verbatim (no separate review surface this phase).
    const perRsResults = []
    perRsResults.push({
      requirementsSet: { id: selectedReqSet.id, name: selectedReqSet.name, version: selectedReqSet.version ?? 1 },
      rows: rows.map((r) => ({
        requirementId: r.requirementId,
        label: r.label,
        value: r.value,
        status: r.status,
        confidence: r.confidence,
        _aiOriginalValue: r._aiOriginalValue,
      })),
    })
    for (const rsId of additionalReqSetIds) {
      const rs = availableRequirementsSets.find((x) => x.id === rsId)
      if (!rs) continue
      const defs = rs.requirements || rs.claims || []
      const rsRows = defs.map((c) => {
        const aiValue = c.aiValue ?? ''
        return {
          requirementId: c.id || c.requirementId || c.label,
          label: c.label || c.requirement || c.name,
          value: aiValue,
          status: aiValue ? 'satisfactory' : 'missing',
          confidence: typeof c.aiConfidence === 'number' ? c.aiConfidence : null,
          _aiOriginalValue: aiValue,
        }
      })
      perRsResults.push({
        requirementsSet: { id: rs.id, name: rs.name, version: rs.version ?? 1 },
        rows: rsRows,
      })
    }
    // Generate batch id — V2App's orchestrator stamps each Eval Result.
    const batchId = `batch-${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
    onSubmit?.({
      batchId,
      perRsResults,
      evidenceUsed: [...evidenceUsedSnapshot],
      // Backwards compat: solo single-RS callers can read these top-level
      // fields if they don't want to walk perRsResults.
      requirementsSet: perRsResults[0].requirementsSet,
      rows: perRsResults[0].rows,
      // Phase 12.2 (#117): re-run audit fields plumbed by the orchestrator.
      priorEvalResultId: priorActiveResult?.id || null,
      evidenceDiff: evidenceDiff || null,
    })
  }

  const supersedeNotice = priorActiveResult && priorActiveResult.requirementsSet?.id === selectedReqSetId

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
              <FieldLabel label="Requirements Set" required />
              {lockedRequirementsSetId ? (
                // Phase 9A item 6: Re-Evaluate flow locks the Req Set to the
                // one the prior Eval Result used. Show as a read-only card
                // with a brief explainer; the user can still pick new
                // evidence below and re-run.
                <>
                  <div style={{
                    padding: 14, borderRadius: 6, marginBottom: 8,
                    background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                    border: '1px solid var(--accent-indigo)',
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'not-allowed',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedReqSet?.name || lockedRequirementsSetId}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {lockedRequirementsSetId} · v{selectedReqSet?.version ?? 1}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                      color: 'var(--accent-indigo)',
                      background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                    }}>LOCKED</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16, fontStyle: 'italic' }}>
                    To change Requirements Set, start a new evaluation from the Claim.
                  </div>
                </>
              ) : availableRequirementsSets.length === 0 ? (
                <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--accent-amber)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  No Requirements Sets in your library. Add one before running an evaluation.
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16,
                  // Phase 9A.6 Gate C (#91): scroll container for the
                  // Requirements Sets picker — matches the Parse Template
                  // picker treatment, per the CLAUDE.md picker convention.
                  maxHeight: 300, overflowY: 'auto',
                  paddingRight: 2,
                }}>
                  {availableRequirementsSets.map((rs) => {
                    // Phase 12.2 (#121): primary (radio-like) + additional
                    // (multi-select) selection. Click on the primary's row
                    // sets it as primary; click the +/− chip to toggle as
                    // a batch sibling. Primary RS drives the visible review
                    // rows; additional RS use AI values verbatim.
                    const isPrimary = selectedReqSetId === rs.id
                    const isAdditional = additionalReqSetIds.includes(rs.id)
                    const suggested = suggestedSetIds.has(rs.id)
                    return (
                      <div
                        key={rs.id}
                        style={{
                          padding: '10px 14px', borderRadius: 6,
                          background: isPrimary ? 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)' : isAdditional ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : 'var(--bg-card)',
                          border: `1px solid ${isPrimary ? 'var(--accent-indigo)' : isAdditional ? 'color-mix(in srgb, var(--accent-indigo) 50%, transparent)' : 'var(--border)'}`,
                          transition: 'all 120ms',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                      >
                        <div
                          onClick={() => {
                            if (isAdditional) {
                              // Promoting an additional RS to primary — drop
                              // it from the additional list to keep state
                              // mutually exclusive.
                              setAdditionalReqSetIds((prev) => prev.filter((x) => x !== rs.id))
                            }
                            setSelectedReqSetId(rs.id)
                          }}
                          style={{ flex: 1, cursor: 'pointer' }}
                        >
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
                        {isPrimary ? (
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                            color: 'var(--accent-indigo)',
                            background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                          }}>PRIMARY</span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleAdditionalReqSet(rs.id) }}
                            title={isAdditional ? 'Drop from this batch' : 'Also evaluate against this Requirements Set (creates a sibling Eval Result)'}
                            style={{
                              padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                              border: `1px solid ${isAdditional ? 'var(--accent-indigo)' : 'var(--border)'}`,
                              background: isAdditional ? 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)' : 'transparent',
                              color: isAdditional ? 'var(--accent-indigo)' : 'var(--text-dim)',
                              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                              letterSpacing: '0.04em',
                              flexShrink: 0,
                            }}
                          >{isAdditional ? '✓ BATCH' : '+ BATCH'}</button>
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
                  : !selectedReqSet
                    ? 'Pick a Requirements Set to continue.'
                    : !hasEvidence
                      ? (isOwnerView ? 'Add evidence to this Claim before evaluating.' : 'Ask the Claim owner to add evidence before evaluating.')
                      : duplicateOfExisting
                        ? 'This (Requirements Set, evidence) combination already has an Eval Result.'
                        : additionalReqSetIds.length > 0
                          ? `Will produce ${1 + additionalReqSetIds.length} Eval Results sharing a batch id.`
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
                  Running {rows.length} requirement{rows.length !== 1 ? 's' : ''} across {evidenceSelection.length} Asset{evidenceSelection.length !== 1 ? 's' : ''}
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
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <FieldLabel label={`Requirement Rows (${rows.length})`} />
                  <div style={{
                    border: '1px solid var(--border)', borderRadius: 8,
                    flex: 1, minHeight: 0, overflowY: 'auto',
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
                        onStatusCycle={(dir) => cycleStatus(i, dir)}
                        humanEdited={r._aiOriginalValue != null && r.value !== r._aiOriginalValue}
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
