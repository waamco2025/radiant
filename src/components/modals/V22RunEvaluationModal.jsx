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
  availableRequirementsSets = [],  // full library — filtered by EA.authorizedRequirementsSetIds below
  priorActiveResult,      // optional prior result with same Req Set lineage (will be superseded)
  onSubmit,               // ({ requirementsSet, rows, evidenceUsed }) => void
  onClose,
}) {
  // Filter to authorized req sets only.
  const authorized = useMemo(() => {
    const allowed = new Set(evaluationAgreement?.authorizedRequirementsSetIds || [])
    return availableRequirementsSets.filter((rs) => allowed.has(rs.id))
  }, [evaluationAgreement, availableRequirementsSets])

  const [selectedReqSetId, setSelectedReqSetId] = useState(authorized[0]?.id || null)
  const selectedReqSet = authorized.find((rs) => rs.id === selectedReqSetId) || null

  // Initial rows: from the selected req set's `claims` definitions if available;
  // otherwise from the prior result (re-eval scenario).
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
    if (selectedReqSet?.claims?.length) {
      return selectedReqSet.claims.map((c) => ({
        requirementId: c.requirementId || c.id || c.label,
        label: c.label || c.requirement || c.name,
        description: c.description,
        value: '',
        confidence: 0.0,
        status: 'missing',
      }))
    }
    return []
  }, [selectedReqSet, selectedReqSetId, priorActiveResult])

  const [rows, setRows] = useState(initialRows)
  const [evidenceSelection, setEvidenceSelection] = useState(() => evidenceAssets.map((a) => a.id))

  // Reset rows when selectedReqSetId changes
  const lastReqSetIdRef = useState({ value: selectedReqSetId })[0]
  if (lastReqSetIdRef.value !== selectedReqSetId) {
    lastReqSetIdRef.value = selectedReqSetId
    setRows(initialRows)
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

  const canSubmit = selectedReqSet && rows.length > 0 && evidenceSelection.length > 0

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

  return (
    <Backdrop onClose={onClose}>
      <Modal width={920}>
        <ModalHeader
          title="Run Evaluation"
          subtitle={`Evaluating ${claim?.name || ''} under EA ${evaluationAgreement?.id || ''}.`}
          onClose={onClose}
        />
        <ModalBody>
          {/* Req Set selection — only authorized sets */}
          <FieldLabel label="Requirements Set" required />
          {authorized.length === 0 ? (
            <div style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--accent-red)', borderRadius: 6, fontSize: 11, color: 'var(--accent-red)', marginBottom: 16 }}>
              No authorized Requirements Sets on this Evaluation Agreement. The grantor must amend the EA before evaluation can proceed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {authorized.map((rs) => {
                const selected = selectedReqSetId === rs.id
                return (
                  <div
                    key={rs.id}
                    onClick={() => setSelectedReqSetId(rs.id)}
                    style={{
                      padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
                      background: selected ? 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)' : 'var(--bg-card)',
                      border: `1px solid ${selected ? 'var(--accent-indigo)' : 'var(--border)'}`,
                      transition: 'all 120ms',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{rs.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{rs.id} · v{rs.version ?? 1}</div>
                  </div>
                )
              })}
            </div>
          )}

          {supersedeNotice && (
            <div style={{
              padding: '10px 14px', borderRadius: 6, marginBottom: 16,
              background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
              fontSize: 11, color: 'var(--text-secondary)',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span aria-hidden style={{ color: 'var(--accent-amber)' }}>⚠</span>
              An active Eval Result with this Requirements Set lineage already exists. Submitting will mark it <code style={{ fontFamily: 'var(--font-mono)' }}>SUPERSEDED</code> per spec §11.3.
            </div>
          )}

          {/* Split-panel: evidence (left) | rows (right) — same shape Parse will adopt */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18, alignItems: 'start' }}>
            <div>
              <FieldLabel label={`Evidence (${evidenceAssets.length})`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {evidenceAssets.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No Assets in scope.</div>
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
            </div>
            <div>
              <FieldLabel label={`Requirement Rows (${rows.length})`} />
              <div style={{
                border: '1px solid var(--border)', borderRadius: 8,
                maxHeight: 420, overflowY: 'auto',
              }}>
                {rows.length === 0 ? (
                  <div style={{ padding: 14, fontSize: 11, color: 'var(--text-dim)' }}>
                    Select a Requirements Set above to populate rows.
                  </div>
                ) : rows.map((r, i) => (
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
            <Btn label="Cancel" onClick={onClose} />
            <Btn label="Save Evaluation" accent disabled={!canSubmit} onClick={handleSubmit} />
          </div>
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
