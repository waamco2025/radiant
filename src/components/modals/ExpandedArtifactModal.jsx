// ExpandedArtifactModal — Phase 11B port of the V2/V2.1 Detail Panel expand
// modal that was lost in the V2.2 retreat. Phase 13.4 (#175) generalized the
// modal to a uniform `[Output] [JSON]` two-tab convention across all artifact
// types and added Eval Result + PoE rich Output content.
//
// Schemas supported:
//   • 'asset'                 — Output: AssetEvidenceViewer (Full / owner) or
//                               SelectiveDisclosurePanel (Selective grantee).
//                               Phase 13.4: tab label is "Output" (was "Asset
//                               Details").
//   • 'parse-output'          — Output: parsed-fields table.
//   • 'eval-output'           — Output: Phase 13.4 — header (name + minibar +
//                               aggregate + date + evaluator) + per-RS results
//                               tables (Requirement | Value | Status |
//                               Confidence). N/A rows dropped.
//   • 'claim'                 — Output: Phase 13.4 — Claim summary (description
//                               + reference counts). Convention scaffold; rich
//                               content lands with Detail Panel cleanup phase.
//   • 'poe'                   — Output: Phase 13.4 — Section 1 (wrapped Eval
//                               Result content per the eval-output Output
//                               convention) + Section 2 (Evaluation Provenance
//                               supersession chain, oldest-first, clickable).
//   • 'disclosure-agreement'  — Output: Phase 13.4 — DA summary (parties +
//                               subject + scope + terms). Convention scaffold.
//   • 'evaluation-agreement'  — Output: Phase 13.4 — EA summary (parties +
//                               claim + restrictions + terms). Pre-13.4 this
//                               was JSON-only; the Output tab is now also
//                               populated.
//
// The JSON tab on every type renders a realistic distributed-storage record
// from `src/v2/data/jsonRecords.js` — references are ID-only (a Claim's
// `referencedAssetIds: ["asset-a3k7m2x9", ...]`, not embedded Asset objects).
// Selective Asset views render a disclosed-portion-only record so file
// metadata (hash, URI, size) stays private.
//
// Output and JSON tabs each carry a "Download" button in their header — Phase
// 13.4 renders it disabled with a "Export coming soon" tooltip. Real export
// wires up under #58 in a future phase.

import { useState, useEffect, useRef } from 'react'
import { Backdrop } from './ModalShared.jsx'
import {
  AssetEvidenceViewer,
  SelectiveDisclosurePanel,
  // Phase 15.1.2: split sub-components let the eval-output / poe Output
  // tabs render the file viewer first + a combined 6-row metadata block
  // (Filename, Size, MIME, Hash, Owner, Registered) below it.
  AssetFileViewer,
  AssetFileMetadata,
} from '../AssetEvidencePanel.jsx'
// Phase 15.0 (#172 part 1): per-Requirements-Set color palette for the
// annotation overlay dots in the eval-output / poe Output tabs.
import { buildRsColorMap } from '../../v2/data/rsColors.js'
// Phase 15.1 (#172 part 2): synthesized anchor IDs for bidirectional
// row↔dot interaction.
import { synthesizeAnchorId } from '../../v2/data/anchorIds.js'
import {
  getAssetJsonRecord,
  getClaimJsonRecord,
  getParseResultJsonRecord,
  getEvalResultJsonRecord,
  getPoeJsonRecord,
  getDaJsonRecord,
  getEaJsonRecord,
  // Phase 14.0 (#169 part 1): Badge Template record.
  getBadgeTemplateJsonRecord,
  // Phase 14.1 (#169 part 2): Badge Issuance record.
  getBadgeIssuanceJsonRecord,
} from '../../v2/data/jsonRecords.js'

// ─── Shared status / confidence chip configs ──────────────────────────────
const STATUS_CFG = {
  satisfactory:    { label: 'SAT',     color: 'var(--accent-green)' },
  unsatisfactory:  { label: 'UNSAT',   color: 'var(--accent-red)' },
  missing:         { label: 'MISSING', color: 'var(--accent-amber)' },
  na:              { label: 'N/A',     color: 'var(--text-dim)' },
}

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] || { label: status?.toUpperCase() || '—', color: 'var(--text-dim)' }
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
      color: cfg.color, background: `color-mix(in srgb, ${cfg.color} 14%, transparent)`,
      whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

function ConfidenceText({ confidence }) {
  if (typeof confidence !== 'number') {
    return <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
  }
  const pct = Math.round(confidence * 100)
  const level = confidence >= 0.85 ? 'HIGH' : confidence >= 0.65 ? 'MED' : 'LOW'
  const color = confidence >= 0.85
    ? 'var(--accent-green)'
    : confidence >= 0.65
      ? 'var(--accent-amber)'
      : 'var(--accent-red)'
  return (
    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
      <span style={{ color, fontWeight: 700 }}>{level}</span>
      <span style={{ color: 'var(--text-dim)' }}> · {pct}%</span>
    </span>
  )
}

// ─── Tab nav + Download action header ─────────────────────────────────────
function TabBar({ active, onChange, hideOutput = false }) {
  const tabs = hideOutput
    ? [{ id: 'json', label: 'JSON' }]
    : [
      { id: 'output', label: 'Output' },
      { id: 'json', label: 'JSON' },
    ]
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-surface)', flexShrink: 0,
    }}>
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <div
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '12px 18px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent-indigo)' : 'var(--text-tertiary)',
              borderBottom: isActive ? '2px solid var(--accent-indigo)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            {t.label}
          </div>
        )
      })}
    </div>
  )
}

// Phase 15.1.2: 24×24 download icon-button rendered at the right edge of
// the EVALUATION RESULTS title bar in eval-output / poe Output tabs.
// Disabled until #58; the icon-button affordance is here so the wiring
// shape is final. Tooltip via native `title`.
function DownloadIconButton({ label = 'Download Evaluation Results JSON' }) {
  return (
    <button
      type="button"
      disabled
      title={label}
      aria-label={label}
      style={{
        width: 24, height: 24, padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 4,
        color: 'var(--text-dim)',
        cursor: 'not-allowed',
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 2 L8 11 M4 7.5 L8 11.5 L12 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 13 L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  )
}

// Phase 13.4: a small "Download" button rendered above the active tab body.
// Disabled in 13.4 — wires up under #58. The affordance is here so future
// callers don't have to restructure the modal.
function DownloadButton({ label = 'Download' }) {
  return (
    <button
      type="button"
      disabled
      title="Export coming soon."
      style={{
        background: 'transparent',
        border: '1px dashed var(--border)',
        borderRadius: 4,
        padding: '4px 10px',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--text-dim)',
        cursor: 'not-allowed',
      }}
    >
      ↓ {label}
    </button>
  )
}

// Phase 13.4: layered container — a relative-positioned wrapper that hosts
// primary content. #172 (PDF annotation overlay) will mount its dot layer
// inside this wrapper as a position:absolute sibling, so the structure
// doesn't need to change when annotation lands.
function LayeredOutputContainer({ children }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {children}
    </div>
  )
}

function TabHeaderActions() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      gap: 8, marginBottom: 12,
    }}>
      <DownloadButton />
    </div>
  )
}

// ─── Generic Output rows / sections ───────────────────────────────────────

function ArtifactRow({ row, schema }) {
  const isEval = schema === 'eval-output'
  const status = row.status
  const confidence = row.confidence

  const statusBadge = isEval && status ? <StatusChip status={status} /> : null
  const confidenceBadge = !isEval && typeof confidence === 'number' ? (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.04em',
      color: confidence >= 0.85 ? 'var(--accent-green)' : confidence >= 0.65 ? 'var(--accent-amber)' : 'var(--accent-red)',
      background: 'var(--bg-raised)',
      flexShrink: 0,
    }}>{Math.round(confidence * 100)}%</span>
  ) : null

  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--bg-deep)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {row.label || row.name || row.id || '—'}
        </span>
        {statusBadge}
        {confidenceBadge}
      </div>
      {row.value != null && row.value !== '' && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
          {String(row.value)}
        </div>
      )}
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      letterSpacing: '0.12em', color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      marginBottom: 8,
    }}>{children}</div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12,
      padding: '6px 0',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{
        fontSize: 11, color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)', textAlign: 'right',
        flex: 1,
      }}>{value}</span>
    </div>
  )
}

// ─── Eval Result Output content (Phase 13.4 — Step 3) ─────────────────────

function formatYMDHM(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
    const da = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return `${y}-${mo}-${da} · ${h}:${mi} UTC`
  } catch {
    return iso
  }
}

function MinibarBlock({ totals }) {
  // SAT/UNSAT/MISSING three-segment bar with numeric labels — full LOD.
  const total = totals.sat + totals.unsat + totals.missing
  if (total === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
        No evaluation rows recorded.
      </div>
    )
  }
  const seg = [
    { color: 'var(--accent-green)', count: totals.sat,     label: 'SAT' },
    { color: 'var(--accent-red)',   count: totals.unsat,   label: 'UNSAT' },
    { color: 'var(--accent-amber)', count: totals.missing, label: 'MISSING' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        display: 'flex', height: 10, borderRadius: 3, overflow: 'hidden',
        border: '1px solid var(--border)', background: 'var(--bg-raised)',
      }}>
        {seg.map((s, i) => s.count > 0 ? (
          <div
            key={i}
            style={{
              flex: s.count, background: s.color,
              borderLeft: i > 0 ? '1px solid var(--bg-deep)' : 'none',
            }}
            title={`${s.label}: ${s.count}`}
          />
        ) : null)}
      </div>
      <div style={{
        display: 'flex', gap: 14, fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)', letterSpacing: '0.04em',
      }}>
        {seg.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            {s.label} · {s.count}
          </span>
        ))}
      </div>
    </div>
  )
}

function EvalResultsTable({
  rows,
  // Phase 15.1 (#172 part 2): row indicators + bidirectional click.
  // When `onAnchorClick` is null, indicators are not rendered (preserves
  // legacy behavior for any caller that doesn't need interaction).
  assetOrdinal = null,
  rsColorByRsId = {},
  highlightedAnchorId = null,
  onAnchorClick = null,
  rowOrdinalById = null,  // { [`${rsId}|${requirementId}`]: rowOrdinal }
}) {
  // Phase 13.4 (criterion 6): drop status='na' rows.
  const filtered = rows.filter((r) => r.status !== 'na')
  if (filtered.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 4px' }}>
        No requirements to display.
      </div>
    )
  }
  // Phase 15.1: 5-col grid (was 4-col) when interaction is wired —
  // leftmost column is the row indicator slot (~38px). Falls back to
  // the legacy 4-col grid when onAnchorClick is null.
  const interactive = !!onAnchorClick
  const gridTemplate = interactive
    ? '38px minmax(180px, 1.6fr) minmax(160px, 2fr) 110px 130px'
    : 'minmax(180px, 1.6fr) minmax(160px, 2fr) 110px 130px'
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 6,
      background: 'var(--bg-deep)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border)',
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        letterSpacing: '0.1em', color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
      }}>
        {interactive && <div style={{ padding: '8px 4px', textAlign: 'center' }}>#</div>}
        <div style={{ padding: '8px 12px' }}>Requirement</div>
        <div style={{ padding: '8px 12px' }}>Value</div>
        <div style={{ padding: '8px 12px' }}>Status</div>
        <div style={{ padding: '8px 12px' }}>Confidence</div>
      </div>
      {filtered.map((r, i) => {
        // Phase 15.1: row anchors get enriched with the row's
        // (requirementsSetId, requirementId) so synthesizeAnchorId
        // produces the SAME ID the AnnotatedPdfViewer would synthesize
        // for the same anchor coming from the consumer's enriched build.
        const rawAnchors = Array.isArray(r.evidenceAnchors) ? r.evidenceAnchors : []
        const anchors = rawAnchors.map((a) => ({
          ...a,
          requirementsSetId: r.requirementsSetId,
          requirementId: r.requirementId,
          label: r.label,
          value: r.value,
        }))
        // Pick a primary anchor for the row indicator. Prefer one whose
        // synthesized ID matches highlightedAnchorId; otherwise first.
        let primaryAnchor = null
        if (interactive && anchors.length > 0) {
          primaryAnchor = anchors.find((a) => synthesizeAnchorId(a) === highlightedAnchorId) || anchors[0]
        }
        const primaryAnchorId = primaryAnchor ? synthesizeAnchorId(primaryAnchor) : null
        // A row is "highlighted" if any of its anchors matches the
        // highlightedAnchorId. (For a row with anchors in multiple
        // Assets, highlighting matches whichever side's been clicked.)
        const isRowHighlighted = !!highlightedAnchorId && anchors.some((a) => synthesizeAnchorId(a) === highlightedAnchorId)
        const color = rsColorByRsId[r.requirementsSetId] || 'var(--accent-indigo)'
        const rowKey = `${r.requirementsSetId || ''}-${r.requirementId || r.label || i}`
        const ordinalKey = `${r.requirementsSetId || ''}|${r.requirementId || ''}`
        const rowOrdinal = (rowOrdinalById && rowOrdinalById[ordinalKey])
          ?? (i + 1)
        // Phase 15.1.1: drop the `{assetOrdinal}.` prefix — the row's
        // number is stable across Asset switches; RS color distinguishes
        // RS membership.
        const indicatorLabel = `${rowOrdinal}`
        return (
        <div
          key={rowKey}
          data-row-anchor-id={primaryAnchorId || undefined}
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            background: isRowHighlighted
              ? `color-mix(in srgb, ${color} 8%, var(--bg-deep))`
              : (i % 2 === 0 ? 'var(--bg-deep)' : 'color-mix(in srgb, var(--bg-deep) 80%, var(--bg-raised))'),
            transition: 'background 120ms',
          }}
        >
          {interactive && (
            <div style={{ padding: '6px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {primaryAnchor ? (
                <button
                  type="button"
                  aria-label={`Highlight evidence ${indicatorLabel}`}
                  onClick={() => onAnchorClick(primaryAnchor)}
                  style={{
                    // Phase 15.1.1: rounded rectangle (was 22px circle)
                    // matching the PDF dot shape language.
                    width: 28, height: 20, borderRadius: 6,
                    background: color,
                    border: '2px solid #fff',
                    boxShadow: isRowHighlighted
                      ? `0 1px 3px rgba(0,0,0,0.4), 0 0 0 2px ${color}`
                      : '0 1px 3px rgba(0,0,0,0.4)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >{indicatorLabel}</button>
              ) : (
                // No anchors for this row (e.g., status `missing`) —
                // empty space holds the column width.
                <span style={{ width: 28, height: 20 }} />
              )}
            </div>
          )}
          <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
            {r.label || r.requirementId || '—'}
          </div>
          <div style={{
            padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)', lineHeight: 1.5, wordBreak: 'break-word',
          }}>
            {r.value != null && r.value !== '' ? String(r.value) : '—'}
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
            <StatusChip status={r.status} />
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
            <ConfidenceText confidence={r.confidence} />
          </div>
        </div>)
      })}
    </div>
  )
}

function EvalResultOutputBody({ evalResult, evidenceAssets = [] }) {
  // Phase 15.0.1: multi-Asset switcher state (Previous/Next arrows).
  // Phase 15.1 (#172 part 2): also acts as the auto-flip target when the
  // user clicks a row indicator whose anchor lives in a non-current Asset.
  const displayableAssets = (evidenceAssets || []).filter((a) => a?.file?.localPath)
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0)
  // Phase 15.1: lifted state for bidirectional row↔dot interaction.
  // Single source of truth — both the AnnotatedPdfViewer dots and the
  // EvalResultsTable row indicators read/write this.
  const [highlightedAnchorId, setHighlightedAnchorId] = useState(null)
  // Phase 15.1: responsive layout breakpoint. Below 900px the modal
  // collapses to a vertical stack (full-width PDF + full-width tables).
  const [stacked, setStacked] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setStacked(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Clamp on prop change (e.g. modal reopens with a different eval result).
  useEffect(() => {
    if (currentAssetIndex >= displayableAssets.length) setCurrentAssetIndex(0)
  }, [displayableAssets.length, currentAssetIndex])
  if (!evalResult) {
    return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No evaluation result.</div>
  }
  const allRows = evalResult.results || []
  const totals = { sat: 0, unsat: 0, missing: 0 }
  for (const r of allRows) {
    if (r.status === 'satisfactory') totals.sat += 1
    else if (r.status === 'unsatisfactory') totals.unsat += 1
    else if (r.status === 'missing') totals.missing += 1
  }
  const rsList = evalResult.requirementsSets
    || (evalResult.requirementsSet ? [evalResult.requirementsSet] : [])
  const rsCount = rsList.length

  // Phase 15.0 (#172 part 1) + 15.0.1: Asset evidence panel for the Output
  // tab. Multi-Asset switcher (Phase 15.0.1) lets the user flip between
  // displayable Assets via Previous/Next arrows; the displayed Asset
  // drives both the PDF.js render and the anchor filter.
  const displayAsset = displayableAssets[currentAssetIndex] || null
  const assetOrdinal = displayAsset
    ? Math.max(1, (evidenceAssets || []).findIndex((a) => a?.id === displayAsset.id) + 1)
    : null
  const rsColorByRsId = buildRsColorMap(rsList.map((rs) => rs.id))
  // Build anchors with rowOrdinal + RS id + label/value for the displayed
  // Asset. rowOrdinal scoped per-RS so each RS's rows enumerate from 1.
  // Also build a `rowOrdinalById` map so EvalResultsTable can render the
  // correct ordinal next to each row regardless of filter state.
  const { anchorsForAsset, rowOrdinalById } = (() => {
    const out = []
    const ordById = {}
    const cursors = new Map()
    for (const row of allRows) {
      const ord = (cursors.get(row.requirementsSetId) || 0) + 1
      cursors.set(row.requirementsSetId, ord)
      ordById[`${row.requirementsSetId || ''}|${row.requirementId || ''}`] = ord
      if (!displayAsset) continue
      for (const a of (row.evidenceAnchors || [])) {
        if (a.sourceAssetId !== displayAsset.id) continue
        out.push({
          ...a,
          rowOrdinal: ord,
          // Phase 15.1: stamp requirementsSetId + requirementId so the
          // synthesized anchor ID is stable + matches what the row
          // indicator computes from the same row.
          requirementsSetId: row.requirementsSetId,
          requirementId: row.requirementId,
          label: row.label,
          value: row.value,
        })
      }
    }
    return { anchorsForAsset: out, rowOrdinalById: ordById }
  })()

  // Phase 15.1: row-click handler. If the row's selected anchor is on a
  // different Asset than the currently displayed one, flip the switcher
  // first; AnnotatedPdfViewer's scroll-into-view effect picks it up after
  // the new mount loads. Same handler fires from PDF dot clicks (where
  // the anchor is by definition for the current Asset, so no flip needed).
  const handleAnchorActivate = (anchor) => {
    if (!anchor) return
    const anchorId = synthesizeAnchorId(anchor)
    setHighlightedAnchorId(anchorId)
    if (anchor.sourceAssetId && anchor.sourceAssetId !== displayAsset?.id) {
      const targetIdx = displayableAssets.findIndex((a) => a.id === anchor.sourceAssetId)
      if (targetIdx >= 0) setCurrentAssetIndex(targetIdx)
    }
  }
  // Phase 15.1: scroll the highlighted row into view when state changes.
  // Uses data-row-anchor-id attribute set in EvalResultsTable.
  const tableScrollContainerRef = useRef(null)
  useEffect(() => {
    if (!highlightedAnchorId || !tableScrollContainerRef.current) return
    const handle = requestAnimationFrame(() => {
      const target = tableScrollContainerRef.current?.querySelector(
        `[data-row-anchor-id="${CSS.escape(highlightedAnchorId)}"]`
      )
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(handle)
  }, [highlightedAnchorId])

  return (
    <LayeredOutputContainer>
      {/* Phase 15.1.2: thin header band removed — eval/poe metadata
          (Evaluated date + Evaluator) now lives in the canonical modal
          header above the tab bar. Output tab body starts directly with
          the side-by-side row.

          Phase 15.1 (#172 part 2): side-by-side layout for the Output
          tab. Left column (~60%) hosts the Asset evidence panel + PDF.js
          + annotations. Right column (~40%) hosts per-RS results
          tables. Both columns scroll independently within the modal
          body. Below 900px viewport width the layout falls back to a
          vertical stack (full-width PDF + full-width tables). */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: stacked ? '1fr' : 'minmax(0, 60fr) minmax(0, 40fr)',
        gap: 16,
        alignItems: 'start',
      }}>
        {/* Left column — evidence panel.
            Phase 15.1.2 layout: [ASSET title bar] → [file viewer] →
            [combined 6-row metadata block]. Title bar badge renamed
            EVIDENCE → ASSET. */}
        {displayAsset && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            position: stacked ? 'static' : 'sticky',
            top: 0,
            minWidth: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 4,
              background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
            }}>
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                color: 'var(--accent-amber)',
                background: 'color-mix(in srgb, var(--accent-amber) 14%, transparent)',
              }}>ASSET</span>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayAsset.name}
              </span>
              {displayableAssets.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous Asset"
                    disabled={currentAssetIndex === 0}
                    onClick={() => setCurrentAssetIndex((i) => Math.max(0, i - 1))}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      color: currentAssetIndex === 0 ? 'var(--text-dim)' : 'var(--text-primary)',
                      cursor: currentAssetIndex === 0 ? 'default' : 'pointer',
                      fontSize: 11,
                      padding: '2px 8px',
                      opacity: currentAssetIndex === 0 ? 0.4 : 1,
                    }}
                  >◀</button>
                  <button
                    type="button"
                    aria-label="Next Asset"
                    disabled={currentAssetIndex >= displayableAssets.length - 1}
                    onClick={() => setCurrentAssetIndex((i) => Math.min(displayableAssets.length - 1, i + 1))}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      color: currentAssetIndex >= displayableAssets.length - 1 ? 'var(--text-dim)' : 'var(--text-primary)',
                      cursor: currentAssetIndex >= displayableAssets.length - 1 ? 'default' : 'pointer',
                      fontSize: 11,
                      padding: '2px 8px',
                      opacity: currentAssetIndex >= displayableAssets.length - 1 ? 0.4 : 1,
                    }}
                  >▶</button>
                </>
              )}
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                Asset {currentAssetIndex + 1} of {displayableAssets.length}
              </span>
            </div>
            <AssetFileViewer
              key={displayAsset.id}
              asset={displayAsset}
              iframeHeight={stacked ? 480 : 640}
              usePdfJs={true}
              evidenceAnchors={anchorsForAsset}
              assetOrdinal={assetOrdinal}
              rsColorByRsId={rsColorByRsId}
              highlightedAnchorId={highlightedAnchorId}
              onAnchorClick={(anchorId) => {
                // Dot click — find matching anchor in current Asset's
                // anchors and dispatch through the same activate handler.
                const match = anchorsForAsset.find((a) => synthesizeAnchorId(a) === anchorId)
                if (match) handleAnchorActivate(match)
              }}
            />
            <AssetFileMetadata asset={displayAsset} variant="combined" />
          </div>
        )}
        {/* Right column — title bar + healthbar + per-RS results.
            Phase 15.1.1: title bar matches left panel's ASSET strip;
            healthbar lives in this panel. Phase 15.1.2: Download button
            promoted into the title bar as a 24×24 icon button at the
            right edge — replaces the standalone "Download" button that
            previously sat in the healthbar block. Amber accent kept for
            both strips so they read as a paired "ASSET ↔ EVALUATION
            RESULTS" header row. */}
        <div
          ref={tableScrollContainerRef}
          style={{
            display: 'flex', flexDirection: 'column', gap: 12,
            minWidth: 0,
          }}
        >
          {/* Title bar — analog to the ASSET strip on the left, with a
              Download icon button at the right edge. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 4,
            background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
          }}>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
              color: 'var(--accent-amber)',
              background: 'color-mix(in srgb, var(--accent-amber) 14%, transparent)',
            }}>EVALUATION RESULTS</span>
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {evalResult.name || evalResult.id}
            </span>
            <DownloadIconButton />
          </div>

          {/* Healthbar block — Phase 15.1.2: Download button promoted to
              the title bar above; this block now hosts the aggregate
              count + 3-segment minibar only. */}
          <div style={{
            padding: '12px 14px', background: 'var(--bg-deep)',
            border: '1px solid var(--border)', borderRadius: 6,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              {totals.sat} SAT · {totals.unsat} UNSAT · {totals.missing} MISSING
              {' · across '}{rsCount} Requirements Set{rsCount === 1 ? '' : 's'}
            </div>
            <MinibarBlock totals={totals} />
          </div>

          {rsList.map((rs) => {
            const rsRows = allRows.filter((r) => (r.requirementsSetId || rsList[0]?.id) === rs.id)
            const renderable = rsRows.filter((r) => r.status !== 'na').length
            return (
              <div key={rs.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 4,
                  background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                }}>
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
                    color: 'var(--accent-indigo)',
                    background: 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)',
                  }}>REQUIREMENTS SET</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {rs.name}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    v{rs.version ?? 1} · {renderable} requirement{renderable === 1 ? '' : 's'}
                  </span>
                </div>
                <EvalResultsTable
                  rows={rsRows}
                  assetOrdinal={assetOrdinal}
                  rsColorByRsId={rsColorByRsId}
                  highlightedAnchorId={highlightedAnchorId}
                  rowOrdinalById={rowOrdinalById}
                  onAnchorClick={handleAnchorActivate}
                />
              </div>
            )
          })}
        </div>
      </div>
    </LayeredOutputContainer>
  )
}

// ─── PoE Output content (Phase 13.4 — Step 4) ─────────────────────────────

function PoeOutputBody({ poe, wrappedEvalResult, provenanceChain = [], onSelectEvalResult, evidenceAssets = [] }) {
  // Section 1 — wrapped Eval Result Output content (sourced from the wrapped
  // Eval Result, falls back to PoE-level metadata when the wrapped object
  // hasn't been resolved by the caller).
  const wrappedFallback = wrappedEvalResult || {
    id: poe?.wrappedEvalResultId,
    name: poe?.name || 'Wrapped Eval Result',
    results: [],
    requirementsSets: (poe?.requirementsSetIds || []).map((id) => ({ id, name: id, version: 1 })),
    evaluationDate: poe?.createdDate,
    owner: poe?.owner,
  }

  return (
    <LayeredOutputContainer>
      {/* Phase 15.1.2: PoE header card removed — PoE name + Created date
          + Owner now live in the canonical modal header above the tab
          bar. "Final Evaluation" section heading also removed; the
          wrapped Eval Result's own EVALUATION RESULTS title bar makes
          the context unambiguous. */}

      {/* Section 1: wrapped Eval Result content (eval-output layout). */}
      <EvalResultOutputBody evalResult={wrappedFallback} evidenceAssets={evidenceAssets} />

      {/* Section 2: Evaluation Provenance — full supersession chain. */}
      <div>
        <SectionHeading>Evaluation Provenance ({provenanceChain.length || 1})</SectionHeading>
        <ProvenanceList
          chain={provenanceChain.length > 0
            ? provenanceChain
            : (wrappedFallback.id
              ? [{
                id: wrappedFallback.id,
                name: wrappedFallback.name,
                status: wrappedFallback.status || 'active',
                evaluationDate: wrappedFallback.evaluationDate,
              }]
              : [])}
          onSelectEvalResult={onSelectEvalResult}
        />
      </div>
    </LayeredOutputContainer>
  )
}

function ProvenanceList({ chain, onSelectEvalResult }) {
  if (chain.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>—</div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {chain.map((entry, idx) => {
        const isLatest = idx === chain.length - 1
        const sBadge = entry.status === 'superseded'
          ? { label: 'SUPERSEDED', color: 'var(--text-dim)' }
          : entry.status === 'outdated'
            ? { label: 'OUTDATED', color: 'var(--accent-amber)' }
            : { label: isLatest ? 'WRAPPED' : 'ACTIVE', color: 'var(--accent-green)' }
        const clickable = !!onSelectEvalResult
        return (
          <div
            key={entry.id}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onSelectEvalResult(entry.id) : undefined}
            onKeyDown={clickable ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectEvalResult(entry.id)
              }
            } : undefined}
            title={clickable ? 'Open this Eval Result' : undefined}
            style={{
              padding: '10px 12px',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: clickable ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 12,
              transition: 'background 100ms, border-color 100ms',
            }}
            onMouseEnter={clickable ? (e) => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 6%, var(--bg-deep))'
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 35%, var(--border))'
            } : undefined}
            onMouseLeave={clickable ? (e) => {
              e.currentTarget.style.background = 'var(--bg-deep)'
              e.currentTarget.style.borderColor = 'var(--border)'
            } : undefined}
          >
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)', minWidth: 18, textAlign: 'right', flexShrink: 0,
            }}>{idx + 1}.</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{entry.name}</div>
              {entry.evaluationDate && (
                <div style={{
                  fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2,
                }}>{entry.evaluationDate.slice(0, 10)}</div>
              )}
            </div>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em',
              color: sBadge.color, background: `color-mix(in srgb, ${sBadge.color} 14%, transparent)`,
              flexShrink: 0,
            }}>{sBadge.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Claim / DA / EA scaffold Output content (Phase 13.4 convention) ──────
//
// Phase 13.4 establishes the convention. Substantive Output for these types
// waits for the Detail Panel cleanup phase (priority #7 on the locked queue,
// see polish-backlog #180).

function ClaimOutputBody({ claim }) {
  if (!claim) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No claim.</div>
  const refCount = (claim.referencedAssetIds || []).length
  const stdCount = (claim.referencedRequirementsSets || []).length
  const ackCount = (claim.acknowledgments || []).length
  return (
    <LayeredOutputContainer>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          {claim.name || claim.id}
        </div>
        {claim.description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {claim.description}
          </div>
        )}
      </div>
      <div style={{
        padding: '12px 14px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>Summary</SectionHeading>
        <MetaRow label="Owner" value={claim.owner || '—'} />
        <MetaRow label="Created" value={formatYMDHM(claim.createdDate)} />
        <MetaRow label="Referenced Assets" value={refCount} />
        <MetaRow label="Referenced Standards" value={stdCount} />
        <MetaRow label="Acknowledgments" value={ackCount} />
        <MetaRow label="Amendments" value={(claim.amendments || []).length} />
      </div>
    </LayeredOutputContainer>
  )
}

function DaOutputBody({ agreement }) {
  if (!agreement) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No agreement.</div>
  const a = agreement
  const scopeBits = []
  if (Array.isArray(a.scope?.assetIds) && a.scope.assetIds.length) scopeBits.push(`${a.scope.assetIds.length} Asset(s)`)
  if (Array.isArray(a.scope?.fieldIds) && a.scope.fieldIds.length) scopeBits.push(`${a.scope.fieldIds.length} Field(s)`)
  if (Array.isArray(a.scope?.evaluationResultIds) && a.scope.evaluationResultIds.length) scopeBits.push(`${a.scope.evaluationResultIds.length} Eval Result(s)`)
  if (Array.isArray(a.scope?.poeIds) && a.scope.poeIds.length) scopeBits.push(`${a.scope.poeIds.length} PoE(s)`)
  return (
    <LayeredOutputContainer>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>Parties</SectionHeading>
        <MetaRow label="Grantor" value={a.grantor?.party || '—'} />
        <MetaRow label="Grantee" value={a.grantee?.party || '—'} />
      </div>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>Subject &amp; Scope</SectionHeading>
        <MetaRow label="Subject kind" value={a.subject?.kind || '—'} />
        <MetaRow label="Subject id" value={a.subject?.id || '—'} />
        <MetaRow label="Disclosure type" value={a.type || '—'} />
        <MetaRow label="Scope" value={scopeBits.length ? scopeBits.join(' · ') : '—'} />
        <MetaRow label="Include derivatives" value={a.scope?.includeDerivatives ? 'Yes' : 'No'} />
      </div>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>Terms</SectionHeading>
        <MetaRow label="Created" value={formatYMDHM(a.terms?.createdDate)} />
        <MetaRow label="Expires" value={a.terms?.expires ? formatYMDHM(a.terms.expires) : 'Never expires'} />
        <MetaRow label="Auto-renew" value={a.terms?.autoRenew ? 'Yes' : 'No'} />
        <MetaRow label="Status" value={a.status || '—'} />
      </div>
    </LayeredOutputContainer>
  )
}

// ─── Badge Template Output content (Phase 14.0 #169 part 1) ──────────────

function BadgeTemplateOutputBody({ template, referencedRequirementSets }) {
  if (!template) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No template.</div>
  const refIds = template.referencedRequirementsSetIds || []
  return (
    <LayeredOutputContainer>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <svg width={32} height={32} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color: 'var(--accent-indigo)' }}>
            <path
              d="M8 1.5 L13 3.2 L13 8 C13 11.2 10.8 13.5 8 14.5 C5.2 13.5 3 11.2 3 8 L3 3.2 Z"
              stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
              fill="color-mix(in srgb, currentColor 12%, transparent)"
            />
            <path d="M5.6 8.2 L7.3 9.9 L10.4 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {template.name || template.id}
            </div>
            <div style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4,
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              <span style={{ color: 'var(--accent-blue)' }}>{template.ownerParty || '—'}</span>
              <span>·</span>
              <span>v{template.version ?? 1}</span>
              <span>·</span>
              <span>Created {(template.createdDate || '').slice(0, 10)}</span>
              {template.supersededBy && (
                <>
                  <span>·</span>
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>SUPERSEDED</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {template.description && (
        <div style={{
          padding: '14px 16px', background: 'var(--bg-deep)',
          border: '1px solid var(--border)', borderRadius: 6,
          fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {template.description}
        </div>
      )}

      <div>
        <SectionHeading>Referenced Requirements Sets ({refIds.length})</SectionHeading>
        {refIds.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>—</div>
        ) : (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--bg-deep)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 2fr) 90px minmax(220px, 1.4fr)',
              background: 'var(--bg-raised)',
              borderBottom: '1px solid var(--border)',
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.1em', color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
            }}>
              <div style={{ padding: '8px 12px' }}>Requirements Set</div>
              <div style={{ padding: '8px 12px' }}>Version</div>
              <div style={{ padding: '8px 12px' }}>ID</div>
            </div>
            {refIds.map((rsId, i) => {
              const rs = (referencedRequirementSets || []).find((r) => r.id === rsId)
              return (
                <div
                  key={rsId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 2fr) 90px minmax(220px, 1.4fr)',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {rs?.name || rsId}
                  </div>
                  <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    v{rs?.version ?? 1}
                  </div>
                  <div style={{
                    padding: '10px 12px', fontSize: 11, color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
                  }}>
                    {rsId}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </LayeredOutputContainer>
  )
}

// ─── Badge Issuance Output content (Phase 14.1 #169 part 2) ──────────────

function BadgeIssuanceOutputBody({ issuance, context }) {
  if (!issuance) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No issuance.</div>
  const { template = null, recipientParty = null, targetClaimName = null } = context || {}
  const isRevoked = issuance.status === 'revoked'
  return (
    <LayeredOutputContainer>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <svg width={36} height={36} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color: 'var(--accent-indigo)' }}>
          <path
            d="M8 1.5 L13 3.2 L13 8 C13 11.2 10.8 13.5 8 14.5 C5.2 13.5 3 11.2 3 8 L3 3.2 Z"
            stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
            fill="color-mix(in srgb, currentColor 12%, transparent)"
          />
          <path d="M5.6 8.2 L7.3 9.9 L10.4 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {template ? template.name : 'Badge Issuance'}
            {template && (
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '1px 5px', borderRadius: 3, marginLeft: 8,
                color: 'var(--accent-indigo)',
                background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
              }}>v{template.version || 1}</span>
            )}
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 3, marginLeft: 8,
              color: 'var(--bg-deep)',
              background: isRevoked ? 'var(--accent-red)' : 'var(--accent-green)',
            }}>{isRevoked ? 'REVOKED' : 'ACTIVE'}</span>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4 }}>
            {issuance.issuerParty} → {recipientParty || 'recipient'} · {(issuance.createdDate || '').slice(0, 10)}
          </div>
        </div>
      </div>

      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>Parties</SectionHeading>
        <MetaRow label="Issuer" value={issuance.issuerParty || '—'} />
        <MetaRow label="Recipient" value={recipientParty || '—'} />
      </div>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>References</SectionHeading>
        <MetaRow label="Target Claim" value={targetClaimName || issuance.targetClaimId} />
        <MetaRow label="Target Claim id" value={issuance.targetClaimId} />
        <MetaRow label="Badge Template" value={template ? `${template.name} · v${template.version || 1}` : issuance.badgeTemplateId} />
        <MetaRow label="Badge Template id" value={issuance.badgeTemplateId} />
      </div>
      {issuance.description && (
        <div style={{
          padding: '14px 16px', background: 'var(--bg-deep)',
          border: '1px solid var(--border)', borderRadius: 6,
        }}>
          <SectionHeading>Description</SectionHeading>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {issuance.description}
          </div>
        </div>
      )}
      {isRevoked && (
        <div style={{
          padding: '14px 16px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent-red) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-red) 25%, transparent)',
        }}>
          <SectionHeading>Revocation</SectionHeading>
          <MetaRow label="Revoked" value={(issuance.revokedDate || '').slice(0, 10)} />
          {issuance.revocationReason && (
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, marginTop: 8 }}>
              &ldquo;{issuance.revocationReason}&rdquo;
            </div>
          )}
        </div>
      )}
    </LayeredOutputContainer>
  )
}

function EaOutputBody({ agreement }) {
  if (!agreement) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No agreement.</div>
  const a = agreement
  return (
    <LayeredOutputContainer>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>Parties</SectionHeading>
        <MetaRow label="Grantor" value={a.grantor?.party || '—'} />
        <MetaRow label="Grantee" value={a.grantee?.party || '—'} />
      </div>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>Anchor</SectionHeading>
        <MetaRow label="Claim id" value={a.claimId || '—'} />
        <MetaRow label="Paired DA id" value={a.disclosureAgreementId || '—'} />
        <MetaRow
          label="Authorized Requirements Sets"
          value={(a.authorizedRequirementsSetIds || []).length} />
      </div>
      <div style={{
        padding: '14px 16px', background: 'var(--bg-deep)',
        border: '1px solid var(--border)', borderRadius: 6,
      }}>
        <SectionHeading>Terms</SectionHeading>
        <MetaRow label="Created" value={formatYMDHM(a.terms?.createdDate)} />
        <MetaRow label="Evaluation deadline" value={a.terms?.evaluationDeadline ? formatYMDHM(a.terms.evaluationDeadline) : '—'} />
        <MetaRow label="Result expiry" value={a.terms?.resultExpiry ? formatYMDHM(a.terms.resultExpiry) : '—'} />
        <MetaRow label="Status" value={a.status || '—'} />
      </div>
    </LayeredOutputContainer>
  )
}

// ─── Modal entry point ────────────────────────────────────────────────────

export default function ExpandedArtifactModal({
  artifact,
  schema,
  // 'asset' | 'parse-output' | 'eval-output' | 'claim' | 'poe' |
  // 'disclosure-agreement' | 'evaluation-agreement' | 'badge-template'
  title,
  // Phase 11D.2: Asset disclosure context.
  disclosureType,
  disclosedFields,
  // Phase 13.4: PoE-only — caller-resolved wrapped Eval Result + provenance
  // chain. Both optional; the modal degrades to PoE-level metadata when not
  // supplied.
  wrappedEvalResult,
  provenanceChain,
  onSelectEvalResult,
  // Phase 14.0 (#169 part 1): Badge Template — caller-resolved
  // Requirements Set objects so the Output table can render names + versions.
  // When omitted, the table falls back to bare IDs only.
  referencedRequirementSets,
  // Phase 14.1 (#169 part 2): Badge Issuance — caller-resolved cross-
  // artifact context (target PoE name + recipient party + template).
  // Used both by Output rendering and to populate the JSON record's
  // computed-fields surfacing.
  badgeIssuanceContext,
  // Phase 15.0 (#172 part 1): caller-resolved evidence Assets for the
  // eval-output / poe schemas — drives the PDF.js + annotation overlay
  // rendering on the Output tab. Single-Asset display in 15.0; Phase 15.1
  // adds the multi-Asset switcher.
  evidenceAssets = [],
  onClose,
}) {
  const [tab, setTab] = useState('output')

  // Selective / proof-only Asset state (unchanged from Phase 11D.2/3).
  const isSelectiveAsset = schema === 'asset' && disclosureType === 'selective'
  const isProofOnlyAsset = schema === 'asset' && disclosureType === 'proofonly'

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const headerLabel = schema === 'asset' ? 'ASSET'
    : schema === 'parse-output' ? 'PARSE RESULT'
    : schema === 'eval-output' ? 'EVAL RESULT'
    : schema === 'claim' ? 'CLAIM'
    : schema === 'poe' ? 'PROOF OF EVALUATION'
    : schema === 'disclosure-agreement' ? 'DISCLOSURE AGREEMENT'
    : schema === 'evaluation-agreement' ? 'EVALUATION AGREEMENT'
    : schema === 'badge-template' ? 'BADGE TEMPLATE'
    : schema === 'badge-issuance' ? 'BADGE ISSUANCE'
    : 'ARTIFACT'

  const displayTitle = title || artifact?.name || artifact?.id || 'Artifact'

  // Phase 15.1.2: canonical modal header surfaces eval/poe metadata
  // (date + party) inline with the title — eliminates the thin header
  // band that previously sat above the side-by-side row.
  let headerMetadata = null
  if (schema === 'eval-output' && artifact) {
    const evDate = formatYMDHM(artifact.evaluationDate)
    const evParty = artifact.owner || '—'
    headerMetadata = `Evaluated: ${evDate} · Evaluator: ${evParty}`
  } else if (schema === 'poe' && artifact) {
    const cDate = formatYMDHM(artifact.createdDate)
    const cParty = artifact.owner || '—'
    headerMetadata = `Created: ${cDate} · Owner: ${cParty}`
  }

  // Output tab body branching.
  let outputBody
  if (schema === 'asset' && isProofOnlyAsset) {
    outputBody = (
      <LayeredOutputContainer>
        <div style={{
          height: 200,
          background: 'var(--bg-deep)',
          border: '2px dashed var(--border)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-dim)', fontSize: 12, textAlign: 'center',
          padding: 24, fontStyle: 'italic',
        }}>
          Under proof-only disclosure, Asset details are not available.
        </div>
      </LayeredOutputContainer>
    )
  } else if (schema === 'asset' && isSelectiveAsset) {
    outputBody = (
      <LayeredOutputContainer>
        <SelectiveDisclosurePanel asset={artifact} disclosedFields={disclosedFields} />
      </LayeredOutputContainer>
    )
  } else if (schema === 'asset') {
    outputBody = (
      <LayeredOutputContainer>
        <AssetEvidenceViewer asset={artifact} />
      </LayeredOutputContainer>
    )
  } else if (schema === 'parse-output') {
    const fields = artifact?.fields || []
    outputBody = (
      <LayeredOutputContainer>
        {fields.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No parsed fields.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.map((f) => <ArtifactRow key={f.id || f.name} row={f} schema={schema} />)}
          </div>
        )}
      </LayeredOutputContainer>
    )
  } else if (schema === 'eval-output') {
    outputBody = <EvalResultOutputBody evalResult={artifact} evidenceAssets={evidenceAssets} />
  } else if (schema === 'claim') {
    outputBody = <ClaimOutputBody claim={artifact} />
  } else if (schema === 'poe') {
    outputBody = (
      <PoeOutputBody
        poe={artifact}
        wrappedEvalResult={wrappedEvalResult}
        provenanceChain={provenanceChain}
        evidenceAssets={evidenceAssets}
        onSelectEvalResult={(id) => {
          if (onSelectEvalResult) {
            onClose?.()
            onSelectEvalResult(id)
          }
        }}
      />
    )
  } else if (schema === 'disclosure-agreement') {
    outputBody = <DaOutputBody agreement={artifact} />
  } else if (schema === 'evaluation-agreement') {
    outputBody = <EaOutputBody agreement={artifact} />
  } else if (schema === 'badge-template') {
    outputBody = (
      <BadgeTemplateOutputBody
        template={artifact}
        referencedRequirementSets={referencedRequirementSets}
      />
    )
  } else if (schema === 'badge-issuance') {
    outputBody = (
      <BadgeIssuanceOutputBody
        issuance={artifact}
        context={badgeIssuanceContext || {}}
      />
    )
  } else {
    outputBody = <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Unknown schema.</div>
  }

  // JSON tab body — realistic distributed-storage record per type.
  const jsonRecord = (() => {
    if (schema === 'asset' && isProofOnlyAsset) {
      return {
        assetId: artifact?.id,
        name: artifact?.name,
        owner: artifact?.owner,
        disclosureType: 'proofonly',
      }
    }
    if (schema === 'asset' && isSelectiveAsset) {
      return {
        assetId: artifact?.id,
        name: artifact?.name,
        owner: artifact?.owner,
        disclosureType: 'selective',
        disclosedFields: (disclosedFields || []).map((f) => ({
          id: f.id,
          name: f.name,
          value: f.value,
          confidence: f.confidence,
          parseResultId: f.parseResultId,
          parseResultName: f.parseResultName,
        })),
      }
    }
    switch (schema) {
      case 'asset': return getAssetJsonRecord(artifact)
      case 'parse-output': return getParseResultJsonRecord(artifact)
      case 'eval-output': return getEvalResultJsonRecord(artifact)
      case 'claim': return getClaimJsonRecord(artifact)
      case 'poe': return getPoeJsonRecord(artifact)
      case 'disclosure-agreement': return getDaJsonRecord(artifact)
      case 'evaluation-agreement': return getEaJsonRecord(artifact)
      case 'badge-template': return getBadgeTemplateJsonRecord(artifact)
      case 'badge-issuance': {
        // Phase 14.2: Resolve cross-artifact references at record build
        // time. Caller supplies allClaims + allBadgeTemplates via
        // badgeIssuanceContext. The recipient is derived from the target
        // Claim's owner.
        const ctx = badgeIssuanceContext || {}
        return getBadgeIssuanceJsonRecord(artifact, ctx.allClaims || [], ctx.allBadgeTemplates || [])
      }
      default: return artifact
    }
  })()

  return (
    <Backdrop onClose={onClose}>
      <div style={{
        width: 1280, maxWidth: '95vw', height: '85vh',
        background: 'var(--bg-surface)',
        borderRadius: 14, border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: 'var(--text-tertiary)', letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '1px 4px', borderRadius: 3,
              background: 'var(--bg-raised)',
              display: 'inline-block', marginBottom: 4,
            }}>{headerLabel}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>{displayTitle}</div>
            {headerMetadata && (
              <div style={{
                marginTop: 4,
                fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
              }}>{headerMetadata}</div>
            )}
          </div>
          <span
            onClick={onClose}
            style={{
              fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4, transition: 'color 100ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >×</span>
        </div>

        <TabBar active={tab} onChange={setTab} />

        {/* Tab content. Phase 15.1.1: suppress the global Download header
            for eval-output / poe Output tabs — the right panel hosts
            its own contextual Download button instead. JSON tab keeps
            the global Download for all schemas. */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {!(tab === 'output' && (schema === 'eval-output' || schema === 'poe')) && <TabHeaderActions />}
          {tab === 'output' && outputBody}
          {tab === 'json' && (
            <pre style={{
              margin: 0,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '14px 16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.5,
            }}>{JSON.stringify(jsonRecord, null, 2)}</pre>
          )}
        </div>
      </div>
    </Backdrop>
  )
}
