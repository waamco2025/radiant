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
// Phase 12.4 (#171): split-panel layout — left panel renders an Asset
// selector list + the disclosure-type-aware AssetEvidencePanel so Bob
// has the underlying evidence in view while curating per-requirement
// values on the right. The viewer is the same component used by
// ExpandedArtifactModal to keep the rendering coherent across surfaces.
import AssetEvidencePanel from '../AssetEvidencePanel.jsx'
// Phase 15.0 (#172 part 1): per-Requirements-Set color assignment for the
// annotation overlay dots. Stable across renders + reused on the Eval
// Result expand modal Output tab.
import { buildRsColorMap } from '../../v2/data/rsColors.js'

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
          onMouseDown={(e) => e.preventDefault()}
          style={{
            padding: '2px 2px',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'inline-block',
            // Phase 13.1 (#168a): explicit `user-select: none` on the
            // label span so double-clicking the rotating button doesn't
            // select the label text. Tooltip wrapper resets userSelect
            // for its children, so we pin it on the inner span itself.
            userSelect: 'none',
            WebkitUserSelect: 'none',
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
function ReviewRow({
  label, description, value, onValueChange, confidence, status, onStatusCycle, humanEdited,
  // Phase 15.1 (#172 part 2): bidirectional row↔dot interaction. When
  // `anchor` is set the row renders a numbered indicator; clicking it
  // fires `onAnchorClick(anchor)`. `highlighted` true draws a tinted
  // background + a 2px outer ring on the indicator.
  anchor = null,
  anchorLabel = null,
  anchorColor = null,
  anchorRowAnchorId = null,
  highlighted = false,
  onAnchorClick = null,
}) {
  return (
    <div
      data-row-anchor-id={anchorRowAnchorId || undefined}
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-faint)',
        display: 'flex', flexDirection: 'row', gap: 10,
        background: highlighted && anchorColor
          ? `color-mix(in srgb, ${anchorColor} 8%, transparent)`
          : 'transparent',
        transition: 'background 120ms',
      }}
    >
      {/* Indicator slot (always renders the column for layout stability). */}
      <div style={{ width: 28, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 2 }}>
        {anchor && onAnchorClick ? (
          <button
            type="button"
            aria-label={`Highlight evidence ${anchorLabel}`}
            onClick={() => onAnchorClick(anchor)}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: anchorColor || 'var(--accent-indigo)',
              border: '2px solid #fff',
              boxShadow: highlighted
                ? `0 1px 3px rgba(0,0,0,0.4), 0 0 0 2px ${anchorColor || 'var(--accent-indigo)'}`
                : '0 1px 3px rgba(0,0,0,0.4)',
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              fontSize: 11, fontWeight: 700, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >{anchorLabel}</button>
        ) : (
          <span style={{ width: 22, height: 22 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
  // Phase 13.2: Re-Run mode lock list. When non-empty, every id in the list
  // is pre-checked AND locked in the RS picker (carried over from the prior
  // Eval Result's `requirementsSets[]`). The user can still ADD additional
  // RSes (subject to PoE-coverage gating); they just can't unlock the
  // carried-over ones. Phase 9A item 6's original singular `lockedRequirementsSetId`
  // is retained as a backwards-compat fallback; new callers pass the array.
  lockedRequirementsSetId = null,
  lockedRequirementsSetIds = null,
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
  // Phase 13 (#168): existing PoEs owned by the evaluator wrapping
  // evaluations of this Claim. Submit-time gate consults this list and
  // blocks save when (selectedRS ∈ poe.requirementsSetIds) AND
  // (current Asset snapshot ⊆ poe.assetSnapshot). Termination is per-
  // (Asset set, RS, evaluator); changing the Claim's evidence releases
  // the gate naturally because the Asset set differs.
  existingPoEs = [],
}) {
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

  // Phase 13.3 (Step 8): EA `authorizedRequirementsSetIds` is advisory per
  // spec §10.5. The SUGGESTED badge surfaces the EA's hints, but the
  // version-pinned id may be stale — if a newer version of that RS family
  // exists in the library, the badge promotes to the latest. Walk each
  // suggested id's lineage in dedupedRsPool, picking the highest-version
  // entry sharing the same `lineageId`.
  const suggestedSetIds = useMemo(() => {
    const raw = evaluationAgreement?.authorizedRequirementsSetIds || []
    if (raw.length === 0) return new Set()
    const out = new Set()
    for (const sid of raw) {
      const seed = dedupedRsPool.find((rs) => rs.id === sid)
      if (!seed) {
        out.add(sid)
        continue
      }
      const lineageId = seed.lineageId
      if (!lineageId) {
        out.add(sid)
        continue
      }
      // Pick the highest-version entry sharing the same lineage.
      let best = seed
      for (const rs of dedupedRsPool) {
        if (rs.lineageId !== lineageId) continue
        if ((rs.version ?? 1) > (best.version ?? 1)) best = rs
      }
      out.add(best.id)
    }
    return out
  }, [evaluationAgreement, dedupedRsPool])

  // Phase 13.2: resolve locked id list from either the new `lockedRequirementsSetIds`
  // array or the legacy singular `lockedRequirementsSetId`.
  const lockedRsIdSet = useMemo(() => {
    const arr = lockedRequirementsSetIds && lockedRequirementsSetIds.length > 0
      ? lockedRequirementsSetIds
      : (lockedRequirementsSetId ? [lockedRequirementsSetId] : [])
    return new Set(arr)
  }, [lockedRequirementsSetIds, lockedRequirementsSetId])
  // Phase 12.3 (Pivot 1): checkbox multi-select replacing the prior
  // primary/additional split. Empty by default — user must check ≥1 RS to
  // proceed. Locked Re-Evaluate flow auto-checks every locked RS on mount.
  // Order is preserved as the order Bob checked the rows.
  const [selectedReqSetIds, setSelectedReqSetIds] = useState(() =>
    Array.from(lockedRsIdSet)
  )
  const toggleSelectedReqSet = (rsId) => {
    // Phase 13.2: locked RSes can't be unchecked. Other RSes can be added
    // freely — the prior single-locked behavior allowed only one RS total;
    // now Re-Run mode allows expanding the evaluation scope on top of the
    // carried-over set.
    if (lockedRsIdSet.has(rsId)) return
    setSelectedReqSetIds((prev) => prev.includes(rsId) ? prev.filter((x) => x !== rsId) : [...prev, rsId])
  }

  // Resolve a selected RS id to a full RS object (with requirements / claims
  // payload). Re-Evaluate flow synthesizes from `priorActiveResult` if the
  // locked id isn't in the active library. Phase 13.2: handles the multi-RS
  // prior shape — checks both `requirementsSets[]` (Phase 13.1) and the
  // legacy singular `requirementsSet` field for backwards compat.
  const resolveRsObject = (rsId) => {
    const fromLib = dedupedRsPool.find((rs) => rs.id === rsId)
      || availableRequirementsSets.find((rs) => rs.id === rsId)
      || publicRequirementSets.find((rs) => rs.id === rsId)
    if (fromLib) return fromLib
    if (lockedRsIdSet.has(rsId) && priorActiveResult) {
      const priorRsList = priorActiveResult.requirementsSets
        || (priorActiveResult.requirementsSet ? [priorActiveResult.requirementsSet] : [])
      const priorRs = priorRsList.find((rs) => rs.id === rsId)
      if (priorRs) {
        const rsRows = (priorActiveResult.results || []).filter(
          (r) => (r.requirementsSetId || priorRsList[0]?.id) === rsId,
        )
        return {
          id: priorRs.id,
          name: priorRs.name,
          version: priorRs.version ?? 1,
          requirements: rsRows.map((r) => ({
            id: r.requirementId,
            label: r.label,
            description: r.description,
          })),
        }
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
    // Phase 13.2: prior result may carry requirementsSets[] (plural,
    // post-13.1) or requirementsSet (singular, legacy). Match either.
    const priorRsList = priorActiveResult
      ? (priorActiveResult.requirementsSets
          || (priorActiveResult.requirementsSet ? [priorActiveResult.requirementsSet] : []))
      : []
    if (priorActiveResult && priorRsList.some((p) => p.id === rs.id)) {
      const priorPrimaryRsId = priorRsList[0]?.id
      const priorRows = (priorActiveResult.results || []).filter(
        (r) => (r.requirementsSetId || priorPrimaryRsId) === rs.id,
      )
      return priorRows.map((r) => ({
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

  // Phase 13.3 (Step 11): two-section RS picker — owner-authored set is
  // expanded by default, Published Standards is collapsed by default.
  const [ownExpanded, setOwnExpanded] = useState(true)
  const [publishedExpanded, setPublishedExpanded] = useState(false)

  // Phase 12.6 (#171b): single-expand accordion — only one Asset's evidence
  // renders at a time. Clicking a different row's header expands it and
  // collapses the previously-expanded row. Phase 12.5's auto-expand-on-
  // set-growth Set behavior is gone (no longer needed under single-expand).
  // Defaults to the first in-scope Asset on mount; null when zero Assets.
  // The expanded body lives in a dedicated `flex: 1` container below the
  // (capped, scrollable) row list so the body stretches to fill the column
  // height — matching the right panel and removing the fixed-iframe
  // height parity issue.
  // Phase 13.3 (Step 3): in Re-Run mode (a `priorActiveResult` was passed
  // in), all Asset rows start collapsed — the user is reviewing what's
  // already been evaluated, not re-curating the full evidence set. Fresh
  // evaluations keep the Phase 12.7 default of first-Asset-expanded.
  const [expandedAssetId, setExpandedAssetId] = useState(
    () => (priorActiveResult ? null : (evidenceAssets[0]?.id ?? null)),
  )
  // Phase 13.3 (Step 3): Asset id set NOT in the prior evaluation's
  // `evidenceUsed`. These rows render a NEW badge in the accordion header.
  const priorEvidenceSet = useMemo(
    () => new Set(priorActiveResult?.evidenceUsed || []),
    [priorActiveResult],
  )
  const toggleAssetExpanded = (assetId) => {
    setExpandedAssetId((prev) => (prev === assetId ? null : assetId))
  }
  // Phase 15.1 (#172 part 2): lifted highlightedAnchorId state for
  // bidirectional row↔dot interaction. Same SoT used in Expand modals.
  const [highlightedAnchorId, setHighlightedAnchorId] = useState(null)
  // Activate handler — called from both PDF dot clicks (anchor lives in
  // currently-displayed Asset) and review-row indicator clicks (anchor
  // may live in a different Asset, in which case we expand that Asset's
  // accordion row first).
  const handleAnchorActivate = (anchor) => {
    if (!anchor) return
    const id = `${anchor.sourceAssetId}|${anchor.requirementsSetId}|${anchor.requirementId}|${anchor.page}|${Math.round(anchor.x)}|${Math.round(anchor.y)}`
    setHighlightedAnchorId(id)
    if (anchor.sourceAssetId && anchor.sourceAssetId !== expandedAssetId) {
      setExpandedAssetId(anchor.sourceAssetId)
    }
  }
  const disclosureTypeLabel = (t) => {
    if (t === 'owner') return 'Owner'
    if (t === 'full') return 'Full'
    if (t === 'selective') return 'Selective'
    if (t === 'proofonly') return 'Proof-only'
    return null
  }
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
    ? existingEvalResults.find((er) => {
        const erRsIds = er.requirementsSets
          ? er.requirementsSets.map((rs) => rs.id)
          : (er.requirementsSet ? [er.requirementsSet.id] : [])
        return erRsIds.length === 1
          && erRsIds[0] === selectedReqSetIds[0]
          && sameSet(er.evidenceUsed || [], evidenceUsedSnapshot)
      })
    : null

  // Phase 12.3: submit gated on at-least-one RS checked + non-empty evidence
  // + EA not pending-acceptance + not a single-RS duplicate. No "primary RS"
  // concept anymore.
  const eaPendingAcceptance = evaluationAgreement?.status === 'pending-acceptance'
  const hasEvidence = evidenceUsedSnapshot.length > 0
  const hasAnyRsSelected = selectedReqSetIds.length > 0

  // Phase 13.1 (#168a): PoE termination moves from submit-time to RS
  // picker time. Compute the per-RS gate map; rows whose RS is already
  // covered by a PoE for the current Asset set render disabled with a
  // tooltip in the picker. Submit no longer fails — the picker prevents
  // the user from selecting a covered RS in the first place.
  const evidenceSet = new Set(evidenceUsedSnapshot)
  const poeBlockedRsIds = new Set()
  for (const poe of existingPoEs) {
    const poeAssets = new Set(poe.assetSnapshot || [])
    let isSubsetOrEqual = true
    for (const aid of evidenceSet) {
      if (!poeAssets.has(aid)) { isSubsetOrEqual = false; break }
    }
    if (!isSubsetOrEqual) continue
    for (const rsId of (poe.requirementsSetIds || [])) {
      poeBlockedRsIds.add(rsId)
    }
  }

  const canSubmit = hasAnyRsSelected && hasEvidence && !duplicateOfExisting && !eaPendingAcceptance

  const handleSubmit = () => {
    if (!canSubmit) return
    // Phase 13.1 (#168a): the modal still emits per-RS shape so the V2App
    // orchestrator (which knows the prior Eval Result, the EA, and the
    // claim owner) can bundle into one Eval Result. `batchId` is gone.
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
    onSubmit?.({
      perRsResults,
      evidenceUsed: [...evidenceUsedSnapshot],
      priorEvalResultId: priorActiveResult?.id || null,
      evidenceDiff: evidenceDiff || null,
    })
  }

  // Phase 13.2: prior result may carry requirementsSets[] (Phase 13.1) or
  // a singular requirementsSet (legacy). Surface the supersede notice when
  // any of the prior's RSes are in the current selection.
  const supersedeNotice = priorActiveResult && (() => {
    const priorRsIds = priorActiveResult.requirementsSets
      ? priorActiveResult.requirementsSets.map((rs) => rs.id)
      : (priorActiveResult.requirementsSet ? [priorActiveResult.requirementsSet.id] : [])
    return priorRsIds.some((id) => selectedReqSetIds.includes(id))
  })()

  const headerSubtitle =
    selfEvaluation
      ? `Self-evaluating ${claim?.name || ''} (no Evaluation Agreement required).`
      : `Evaluating ${claim?.name || ''} under Evaluation Agreement ${evaluationAgreement?.id || ''}.`

  // Phase 15.0 (#172 part 1): build the anchor lookup + RS color map once
  // per render so the inline-expanded Asset evidence panel can pass
  // anchors to AnnotatedPdfViewer. Anchors source from the priorActiveResult
  // when present (Re-Run mode); fresh evaluations have no committed anchors
  // until submit, so the array is empty and PDF.js renders the document
  // without overlays — that's intentional for Phase 15.0's static-only
  // scope. Phase 15.1 will surface live evaluator-driven anchor authoring.
  const anchorsByAssetId = useMemo(() => {
    const map = new Map()
    const rows = priorActiveResult?.results || []
    // Compute rowOrdinal per (rsId, row position within rs).
    const rsCursors = new Map()
    rows.forEach((row) => {
      const rsId = row.requirementsSetId
      const ord = (rsCursors.get(rsId) || 0) + 1
      rsCursors.set(rsId, ord)
      for (const a of (row.evidenceAnchors || [])) {
        if (!a?.sourceAssetId) continue
        if (!map.has(a.sourceAssetId)) map.set(a.sourceAssetId, [])
        map.get(a.sourceAssetId).push({
          ...a,
          rowOrdinal: ord,
          requirementsSetId: rsId,
          // Phase 15.1: stamp requirementId so the synthesized anchor
          // ID matches what the row indicator computes.
          requirementId: row.requirementId,
          label: row.label,
          value: row.value,
        })
      }
    })
    return map
  }, [priorActiveResult])
  const rsColorByRsId = useMemo(() => {
    const ids = (priorActiveResult?.requirementsSets || []).map((r) => r.id)
    return buildRsColorMap(ids)
  }, [priorActiveResult])
  // Asset ordinal: 1-indexed position within the in-scope evidence list.
  const assetOrdinalById = useMemo(() => {
    const map = new Map()
    evidenceAssets.forEach((a, i) => map.set(a.id, i + 1))
    return map
  }, [evidenceAssets])

  // Phase 12.4 (#171): left panel renders an Asset selector list at top
  // and the disclosure-type-aware AssetEvidencePanel below. Present in
  // every step so the reviewer can see the underlying evidence while
  // curating values; rendered as the empty-state on Claims with zero
  // in-scope Assets so the empty-evidence message mirrors the right-panel
  // copy from #105.
  const renderLeftPanel = () => {
    if (evidenceAssets.length === 0) {
      return (
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          padding: 14, borderRadius: 8,
          border: '1px dashed color-mix(in srgb, var(--accent-amber) 35%, transparent)',
          background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          {isOwnerView
            ? 'There is no evidence associated with this Claim. Add evidence to self-evaluate.'
            : 'There is no evidence associated with this Claim. Ask the owner of this Claim to add evidence to evaluate.'}
        </div>
      )
    }
    return (
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <FieldLabel label={`Assets in Scope (${evidenceAssets.length})`} />
        {/* Phase 12.7 (#171c): Option A — single overflow container holds
            rows with inline-expanded bodies. The split-container layout
            from 12.6 (capped row list + dedicated body) didn't scale to
            10+ Assets — the row list became too cramped. Inline expansion
            in natural flow scales to arbitrary Asset counts; the column
            still stretches via `flex: 1` so empty space below renders
            cleanly when content is short. */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 8,
          paddingRight: 2,
        }}>
          {evidenceAssets.map((a) => {
            const expanded = a.id === expandedAssetId
            const dtLabel = disclosureTypeLabel(a.disclosureType)
            // Phase 13.3 (Step 3): NEW badge on Re-Run Step 1 for Asset
            // rows that weren't in the prior evaluation's evidenceUsed —
            // a visual cue for the evaluator on what's actually new in
            // this re-run. Hidden in fresh-evaluation mode (no prior).
            const isNewRow = !!priorActiveResult && !priorEvidenceSet.has(a.id)
            return (
              <div key={a.id} style={{
                // Phase 13 (#173 fold-in): collapsed accordion rows
                // appeared to shrink when a sibling expanded because the
                // containing flex column's default flex-shrink: 1 caused
                // each card to give up vertical space to the expanded
                // sibling. Setting flex-shrink: 0 pins each card to its
                // natural content height regardless of sibling state.
                flexShrink: 0,
                border: `1px solid ${expanded ? 'var(--accent-indigo)' : 'var(--border)'}`,
                borderRadius: 6,
                background: 'var(--bg-card)',
                overflow: 'hidden',
                transition: 'border-color 120ms',
              }}>
                <div
                  onClick={() => toggleAssetExpanded(a.id)}
                  role="button"
                  aria-expanded={expanded}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleAssetExpanded(a.id)
                    }
                  }}
                  style={{
                    padding: '8px 10px', cursor: 'pointer',
                    background: expanded
                      ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)'
                      : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'background 120ms',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{a.name}</div>
                    <div style={{
                      fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{a.file?.filename || a.id}</div>
                  </div>
                  {dtLabel && (
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '1px 5px', borderRadius: 3, letterSpacing: '0.08em',
                      color: 'var(--text-dim)',
                      background: 'var(--bg-deep)',
                      border: '1px solid var(--border-faint)',
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}>{dtLabel}</span>
                  )}
                  {isNewRow && (
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '1px 5px', borderRadius: 3, letterSpacing: '0.08em',
                      color: 'var(--bg-deep)',
                      background: 'var(--accent-indigo)',
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}>NEW</span>
                  )}
                  <span aria-hidden style={{
                    fontSize: 12, color: 'var(--text-dim)', flexShrink: 0,
                    width: 14, textAlign: 'center',
                  }}>{expanded ? '▾' : '▸'}</span>
                </div>
                {expanded && (
                  <div style={{
                    padding: '10px 12px',
                    borderTop: '1px solid var(--border-faint)',
                    background: 'var(--bg-surface)',
                  }}>
                    <AssetEvidencePanel
                      assetRow={a}
                      iframeHeight={480}
                      // Phase 15.0 (#172 part 1): opt in to PDF.js +
                      // annotation overlay. evidenceAnchors are populated
                      // only when a priorActiveResult is in scope (Re-Run
                      // mode); fresh evaluations render the PDF cleanly.
                      usePdfJs={true}
                      evidenceAnchors={anchorsByAssetId.get(a.id) || []}
                      assetOrdinal={assetOrdinalById.get(a.id) || null}
                      rsColorByRsId={rsColorByRsId}
                      // Phase 15.1 (#172 part 2): bidirectional row↔dot
                      // interaction. Dot clicks fire onAnchorClick with the
                      // synthesized id; the activate handler resolves the
                      // anchor + flips the accordion if needed.
                      highlightedAnchorId={highlightedAnchorId}
                      onAnchorClick={(anchorId) => {
                        const found = (anchorsByAssetId.get(a.id) || []).find((an) =>
                          `${an.sourceAssetId}|${an.requirementsSetId}|${an.requirementId}|${an.page}|${Math.round(an.x)}|${Math.round(an.y)}` === anchorId
                        )
                        if (found) handleAnchorActivate(found)
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Phase 12.4 (#171): split-panel layout. Modal widens to 1280 (capped to
  // 94vw via Modal's existing maxWidth). Left and right columns share an
  // equal 1:1 ratio and a subtle vertical divider for visual structure.
  const renderSplitBody = (rightContent) => (
    <ModalBody>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        height: 'calc(90vh - 220px)',
        minHeight: 420, maxHeight: 720,
      }}>
        <div style={{
          minHeight: 0, display: 'flex', flexDirection: 'column',
          paddingRight: 24, borderRight: '1px solid var(--border-faint)',
        }}>
          {renderLeftPanel()}
        </div>
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {rightContent}
        </div>
      </div>
    </ModalBody>
  )

  return (
    <Backdrop onClose={onClose}>
      <Modal width={1280}>
        {/* ── Stage 0: Select Req Set + scope ───────────────────────── */}
        {step === 0 && (
          <>
            <ModalHeader
              title="Run Evaluation"
              subtitle={headerSubtitle}
              step={1} totalSteps={3} onClose={onClose}
            />
            {renderSplitBody(
              <div style={{ overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
              {/* Phase 12.3 (Pivot 1): checkbox multi-select. The label
                  hint reads "(check 1 or more)" so the multi behavior is
                  obvious. Locked Re-Evaluate flow auto-checks the locked
                  RS and disables every other row. */}
              <FieldLabel label={`Requirements Sets (${selectedReqSetIds.length} checked)`} required />
              {dedupedRsPool.length === 0 ? (
                <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--accent-amber)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  No Requirements Sets in your library. Add one before running an evaluation.
                </div>
              ) : (() => {
                // Phase 13.3 (Step 11): split the picker into two accordion
                // sections — owner-authored Requirements Sets (default
                // expanded) and Published Standards (default collapsed).
                // Sort published standards alphabetically by name. Selection
                // semantics are identical regardless of section.
                const ownRows = dedupedRsPool.filter((rs) => rs._provenance === 'own')
                const publicRows = dedupedRsPool.filter((rs) => rs._provenance === 'public')
                  .slice()
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                const renderRow = (rs) => {
                    const isChecked = selectedReqSetIds.includes(rs.id)
                    const lockedThis = lockedRsIdSet.has(rs.id)
                    // Phase 13.3 (Step 2): in Re-Run mode (locked set is
                    // non-empty), every RS NOT in the carried-over set is
                    // disabled. The user can no longer expand selection —
                    // Re-Run is locked to the prior Eval Result's exact
                    // `requirementsSets[]`. Phase 13.2's permissive "user
                    // can add new RSes" behavior is reverted by design.
                    const lockedOther = lockedRsIdSet.size > 0 && !lockedThis
                    // Phase 13.1 (#168a): PoE-covered RSes are gated at picker time.
                    const poeBlocked = poeBlockedRsIds.has(rs.id)
                    const disabled = lockedThis || lockedOther || poeBlocked
                    const provenanceLabel = rs._provenance === 'own' ? 'Authored by you'
                      : rs._provenance === 'public' ? 'Public' : null
                    // Phase 13.3 (Step 7): SUGGESTED badge hides on disabled
                    // rows so the visual signal doesn't conflict with the
                    // unselectable state.
                    const suggested = suggestedSetIds.has(rs.id) && !disabled
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
                        {/* Phase 13.3 (Step 11): Published Standards rows
                            surface the publishing actor + a globe icon
                            inline. Owner-authored rows keep the legacy
                            "Authored by you" badge. */}
                        {rs._provenance === 'public' && rs._publishedBy ? (
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '2px 6px', borderRadius: 3, letterSpacing: '0.04em',
                            color: 'var(--accent-blue)',
                            background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
                            flexShrink: 0,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            <svg width={9} height={9} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                              <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
                              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
                            </svg>
                            {rs._publishedBy}
                          </span>
                        ) : provenanceLabel && (
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
                          <Tooltip content="Carried over from prior evaluation.">
                            <span style={{
                              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                              color: 'var(--accent-indigo)',
                              background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                              flexShrink: 0,
                            }}>LOCKED</span>
                          </Tooltip>
                        )}
                        {poeBlocked && (
                          <Tooltip content="Already finalized as a Proof of Evaluation.">
                            <span style={{
                              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                              color: 'var(--accent-amber)',
                              background: 'color-mix(in srgb, var(--accent-amber) 14%, transparent)',
                              flexShrink: 0,
                            }}>PoE</span>
                          </Tooltip>
                        )}
                      </div>
                    )
                }
                const sectionHeaderStyle = {
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px',
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  letterSpacing: '0.06em', color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-faint)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  userSelect: 'none',
                }
                const ownExp = ownExpanded
                const pubExp = publishedExpanded
                return (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16,
                    maxHeight: 380, overflowY: 'auto',
                    paddingRight: 2,
                  }}>
                    {/* Section 1 — Your Requirements Sets (default expanded) */}
                    <div
                      onClick={() => setOwnExpanded((v) => !v)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOwnExpanded((v) => !v) } }}
                      style={sectionHeaderStyle}
                    >
                      <span>Your Requirements Sets ({ownRows.length})</span>
                      <span aria-hidden style={{ transform: ownExp ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 120ms', display: 'inline-block' }}>▸</span>
                    </div>
                    {ownExp && (
                      ownRows.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', padding: '4px 10px' }}>
                          You haven&rsquo;t authored any Requirements Sets yet. Use the Library to create one.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {ownRows.map(renderRow)}
                        </div>
                      )
                    )}

                    {/* Section 2 — Published Standards (default collapsed) */}
                    <div
                      onClick={() => setPublishedExpanded((v) => !v)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPublishedExpanded((v) => !v) } }}
                      style={sectionHeaderStyle}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <svg width={11} height={11} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                          <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
                          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
                        </svg>
                        Published Standards ({publicRows.length})
                      </span>
                      <span aria-hidden style={{ transform: pubExp ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 120ms', display: 'inline-block' }}>▸</span>
                    </div>
                    {pubExp && (
                      publicRows.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', padding: '4px 10px' }}>
                          No published standards available.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {publicRows.map(renderRow)}
                        </div>
                      )
                    )}
                  </div>
                )
              })()}
              {lockedRsIdSet.size > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16, fontStyle: 'italic' }}>
                  This is a re-evaluation. The Requirements Set selection is locked to the prior evaluation&rsquo;s {lockedRsIdSet.size === 1 ? 'set' : `${lockedRsIdSet.size} sets`}. To evaluate against a different Requirements Set, start a new evaluation from the Claim.
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
                    This evaluation already exists as <strong style={{ color: 'var(--text-primary)' }}>{(duplicateOfExisting.requirementsSets?.[0]?.name) || duplicateOfExisting.requirementsSet?.name || duplicateOfExisting.id}</strong>{' '}
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
                      Prior result: {(priorActiveResult.requirementsSets?.[0]?.name) || priorActiveResult.requirementsSet?.name || priorActiveResult.id}
                    </div>
                  )}
                </div>
              )}
              {/* Phase 12.4 (#171): the "Assets in scope" listing was
                  moved into the left-panel selector so the underlying
                  evidence is visible alongside the RS picker. The empty-
                  evidence message lives there too. */}
              </div>
            )}
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
                          ? `Will bundle ${selectedReqSetIds.length} Requirements Sets into one Eval Result.`
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
            {renderSplitBody(
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', padding: '40px 24px' }}>
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
            )}
          </>
        )}

        {/* ── Stage 2: Review rows ───────────────────────────────────── */}
        {step === 2 && (
          <>
            <ModalHeader
              title="Run Evaluation"
              subtitle={(() => {
                // Phase 13.3 (Step 6): Step 3 header reads
                // "Evaluating [Claim label] by [Claim owner]" so the
                // reviewer sees both the artifact and its provenance
                // context while curating values.
                if (claim?.name && claim?.owner) {
                  return `Evaluating ${claim.name} by ${claim.owner}`
                }
                if (claim?.name) return `Evaluating ${claim.name}`
                return 'Review extracted values and assessment statuses'
              })()}
              step={3} totalSteps={3} onClose={onClose}
            />
            {renderSplitBody(
              /* Phase 12.5 (#171a): unified right-panel scroll surface with
                  sticky RS group headers. Replaces the per-RS scroll boxes
                  from Phase 12.3 that didn't actually scroll. The diff
                  banner (#117) lives at the top of the same scroll surface
                  and scrolls away naturally as the user scrolls down.
                  Each RS group header uses `position: sticky` so it pins
                  while its rows scroll past, then yields to the next
                  group's header (standard sticky-header behavior). */
              <div style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                display: 'flex', flexDirection: 'column',
              }}>
                {evidenceDiff && (evidenceDiff.added.length + evidenceDiff.removed.length + evidenceDiff.superseded.length > 0) && (
                  <div style={{
                    padding: '8px 10px', borderRadius: 6,
                    background: 'color-mix(in srgb, var(--accent-amber) 7%, transparent)',
                    border: '1px dashed color-mix(in srgb, var(--accent-amber) 40%, transparent)',
                    fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4,
                    marginBottom: 10, flexShrink: 0,
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)', letterSpacing: '0.06em', marginBottom: 4 }}>
                      Δ EVIDENCE
                    </div>
                    +{evidenceDiff.added.length} / −{evidenceDiff.removed.length} / {evidenceDiff.superseded.length} superseded
                  </div>
                )}
                {selectedReqSetIds.map((rsId) => {
                  const rs = resolveRsObject(rsId)
                  const rsRows = rowsByRsId[rsId] || []
                  return (
                    <div key={rsId} style={{
                      display: 'flex', flexDirection: 'column',
                    }}>
                      {/* Sticky section header — pins to the top of the
                          scroll surface while its rows scroll past. Solid
                          background prevents row content from bleeding
                          through. */}
                      <div style={{
                        position: 'sticky', top: 0, zIndex: 2,
                        padding: '8px 12px',
                        background: 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border)',
                        borderTop: '1px solid var(--border)',
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
                        {rsRows.map((r, i) => {
                          // Phase 15.1 (#172 part 2): per-row indicator
                          // from priorActiveResult anchors. Returns null
                          // for fresh evals (no prior result) or rows
                          // where prior had no anchor for this requirement.
                          const priorRow = (priorActiveResult?.results || []).find(
                            (pr) => pr.requirementsSetId === rsId && pr.requirementId === r.requirementId
                          )
                          const priorAnchor = (priorRow?.evidenceAnchors || [])[0] || null
                          const enriched = priorAnchor ? {
                            ...priorAnchor,
                            requirementsSetId: rsId,
                            requirementId: r.requirementId,
                          } : null
                          const anchorRowAnchorId = enriched
                            ? `${enriched.sourceAssetId}|${enriched.requirementsSetId}|${enriched.requirementId}|${enriched.page}|${Math.round(enriched.x)}|${Math.round(enriched.y)}`
                            : null
                          // Compute rowOrdinal within this RS for the label.
                          const ord = i + 1
                          const ordinalNum = assetOrdinalById.get(enriched?.sourceAssetId) || null
                          const anchorLabel = (enriched && ordinalNum) ? `${ordinalNum}.${ord}` : null
                          const anchorColor = enriched ? (rsColorByRsId[rsId] || 'var(--accent-indigo)') : null
                          return (
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
                              anchor={enriched}
                              anchorLabel={anchorLabel}
                              anchorColor={anchorColor}
                              anchorRowAnchorId={anchorRowAnchorId}
                              highlighted={!!highlightedAnchorId && anchorRowAnchorId === highlightedAnchorId}
                              onAnchorClick={handleAnchorActivate}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
                <Btn label="Save Evaluation Result" accent disabled={!canSubmit} onClick={handleSubmit} />
              </div>
            </ModalFooter>
          </>
        )}
      </Modal>
    </Backdrop>
  )
}
