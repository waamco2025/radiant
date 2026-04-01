import { useState, useMemo, useEffect, useCallback } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter, Btn, FieldLabel, InfoRow, CopyBadge, StepDots } from './ModalShared.jsx'
import PrimeRadiant from '../../v2/PrimeRadiant.jsx'
import { CLAIM_STATUS, CREDITS_PER_REQUIREMENT, calculateEvalCost, generateMockAIResults } from '../../v2/evaluationHelpers.js'

const PROCESSING_MESSAGES = [
  'Extracting data fields from PEP output…',
  'Running inference against requirement definitions…',
  'Cross-referencing extraction values with evidence…',
  'Computing confidence scores…',
  'Preparing human review summary…',
]

function StepSetup({ assetNode, requirementSets, selectedSetId, setSelectedSetId, credits, disclosureType, activeEvalsByLineage, activeParty }) {
  // Deduplicate by lineageId — show latest version per lineage
  const deduped = useMemo(() => {
    const map = new Map()
    requirementSets.forEach(rs => {
      const key = rs.lineageId || rs.id
      const existing = map.get(key)
      if (!existing || (rs.version || 1) > (existing.version || 1)) {
        map.set(key, rs)
      }
    })
    return [...map.values()]
  }, [requirementSets])

  const selectedSet = requirementSets.find(s => s.id === selectedSetId)
  const cost = selectedSet ? calculateEvalCost(selectedSet) : 0
  const canAfford = credits >= cost

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Asset info card */}
      <div style={{
        padding: '14px 16px', borderRadius: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{assetNode.name}</span>
          <CopyBadge value={assetNode.pin} truncated />
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-dim)' }}>
          <span>Owner: <strong style={{ color: 'var(--text-secondary)' }}>{assetNode.owner}</strong></span>
          <span>Access: <strong style={{ color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{disclosureType || 'full'}</strong></span>
        </div>
      </div>

      {/* Requirement set picker */}
      <div>
        <FieldLabel label="Select requirement set" required />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deduped.map(rs => {
            const active = selectedSetId === rs.id
            const lineageKey = rs.lineageId || rs.id
            const existingEval = activeEvalsByLineage?.get(lineageKey)
            const hasActiveEval = !!existingEval
            const existingVersion = existingEval?.requirementSetVersion || existingEval?.evalVersion || 1
            const isNewerVersion = hasActiveEval && (rs.version || 1) > existingVersion
            const isSameVersion = hasActiveEval && (rs.version || 1) <= existingVersion
            const isBlocked = isSameVersion && !active
            return (
              <div
                key={rs.id}
                onClick={() => !isBlocked && setSelectedSetId(rs.id)}
                style={{
                  padding: '14px 16px', borderRadius: 8,
                  cursor: isBlocked ? 'default' : 'pointer',
                  opacity: isBlocked ? 0.45 : 1,
                  border: `1.5px solid ${active ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  background: active ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : 'var(--bg-card)',
                  transition: 'all 150ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: active ? 'var(--accent-indigo)' : 'var(--text-dim)',
                    transition: 'background 150ms',
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: active ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                    transition: 'color 150ms',
                  }}>{rs.name}</span>
                  {rs.version && (
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '1px 5px', borderRadius: 3,
                      background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                      color: 'var(--accent-indigo)',
                    }}>v{rs.version}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginLeft: 16 }}>
                  {rs.description}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 6, marginLeft: 16 }}>
                  {rs.requirements.length} requirements · {rs.requirements.filter(r => r.type === 'extraction').length} extraction · {rs.requirements.filter(r => r.type === 'inference').length} inference
                </div>
                {isSameVersion && (
                  <div style={{
                    marginTop: 8, marginLeft: 16, padding: '6px 10px', borderRadius: 5,
                    background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', lineHeight: 1.6,
                  }}>
                    Active evaluation exists on this asset — amend the existing evaluation instead.
                  </div>
                )}
                {isNewerVersion && (
                  <div style={{
                    marginTop: 8, marginLeft: 16, padding: '6px 10px', borderRadius: 5,
                    background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)', lineHeight: 1.6,
                  }}>
                    Will supersede v{existingVersion} evaluation on this asset.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cost estimate */}
      {selectedSet && (
        <div style={{
          padding: '14px 16px', borderRadius: 8,
          background: canAfford
            ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)'
            : 'color-mix(in srgb, var(--accent-red) 5%, transparent)',
          border: `1px solid ${canAfford ? 'color-mix(in srgb, var(--accent-indigo) 20%, transparent)' : 'color-mix(in srgb, var(--accent-red) 20%, transparent)'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Evaluation cost: <strong style={{ fontFamily: 'var(--font-mono)' }}>{cost} credits</strong>
            </span>
            <span style={{ fontSize: 12, color: canAfford ? 'var(--text-dim)' : 'var(--accent-red)' }}>
              Balance: <strong style={{ fontFamily: 'var(--font-mono)' }}>{credits}</strong>
            </span>
          </div>
          {!canAfford && (
            <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 8 }}>
              Insufficient credits to run this evaluation.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StepProcessing({ messageIndex }) {
  const msg = PROCESSING_MESSAGES[messageIndex % PROCESSING_MESSAGES.length]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <PrimeRadiant size={80} fps={30} strutScale={2.2} brightness={0.4} />
      <div style={{ marginTop: 28, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.7, minHeight: 40 }}>
        {msg}
      </div>
      {/* Progress bar */}
      <div style={{
        width: 200, height: 3, borderRadius: 2, marginTop: 20,
        background: 'var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'var(--accent-indigo)',
          animation: 'eval-progress 4s ease-in-out forwards',
        }} />
      </div>
      <style>{`@keyframes eval-progress { from { width: 5% } to { width: 95% } }`}</style>
    </div>
  )
}

function ClaimCard({ claim, onUpdateClaim }) {
  const isExtraction = claim.type === 'extraction'

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 8,
      background: 'var(--bg-card)',
      border: claim._carriedForward ? '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)' : '1px solid var(--border)',
      borderLeft: claim._carriedForward ? '3px solid var(--accent-green)' : undefined,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '2px 6px', borderRadius: 3,
          background: isExtraction
            ? 'color-mix(in srgb, var(--accent-cyan) 10%, transparent)'
            : 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
          color: isExtraction ? 'var(--accent-cyan)' : 'var(--accent-amber)',
        }}>{isExtraction ? 'EXTRACTION' : 'INFERENCE'}</span>
        {claim._carriedForward && (
          <span style={{
            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '2px 6px', borderRadius: 3,
            background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
            color: 'var(--accent-green)', flexShrink: 0,
          }}>PRESERVED</span>
        )}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>{claim.label}</span>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
        }}>
          {Math.round(claim.aiConfidence * 100)}% conf.
        </span>
      </div>

      {/* Description */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.6 }}>
        {claim.description}
      </div>

      {/* AI result */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 60, flexShrink: 0 }}>AI value</span>
        <span style={{
          fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
          padding: '4px 8px', borderRadius: 4,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
        }}>{claim.aiValue}</span>
      </div>

      {/* Human value */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 60, flexShrink: 0 }}>Your value</span>
        {isExtraction ? (
          <input
            value={claim.humanValue === null ? '' : claim.humanValue}
            onChange={e => onUpdateClaim({ ...claim, humanValue: e.target.value })}
            onFocus={e => {
              if (claim.humanValue === null && claim.aiValue) {
                onUpdateClaim({ ...claim, humanValue: claim.aiValue })
              }
            }}
            placeholder={claim.aiValue}
            style={{
              flex: 1, height: 32, padding: '0 10px', borderRadius: 5,
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: claim.humanValue === null ? 'var(--text-dim)' : 'var(--text-primary)',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              outline: 'none',
            }}
          />
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            {['Yes', 'No'].map(v => {
                const active = claim.humanValue === v
                return (
                  <button
                    key={v}
                    onClick={() => onUpdateClaim({ ...claim, humanValue: v })}
                    style={{
                      padding: '5px 14px', borderRadius: 5, fontSize: 12,
                      fontFamily: 'var(--font-mono)', fontWeight: 600,
                      border: `1px solid ${active ? 'var(--accent-indigo)' : 'var(--border)'}`,
                      background: active ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'transparent',
                      color: active ? 'var(--accent-indigo)' : 'var(--text-tertiary)',
                      cursor: 'pointer', transition: 'all 150ms',
                    }}
                  >{v}</button>
                )
              })}
          </div>
        )}
      </div>

      {/* Status radio */}
      <div style={{ display: 'flex', gap: 6 }}>
        {Object.entries(CLAIM_STATUS).map(([key, cfg]) => {
          const active = claim.status === key
          return (
            <button
              key={key}
              onClick={() => onUpdateClaim({ ...claim, status: key })}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 5, fontSize: 11,
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                background: active ? `color-mix(in srgb, ${cfg.color} 8%, transparent)` : 'transparent',
                color: active ? cfg.color : 'var(--text-dim)',
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              {cfg.icon} {cfg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepConfirmation({ assetNode, selectedSet, claims, creditCost, amendingEval }) {
  const summary = useMemo(() => {
    const s = { ok: 0, bad: 0, miss: 0 }
    claims.forEach(c => {
      if (c.status === 'satisfactory') s.ok++
      else if (c.status === 'unsatisfactory') s.bad++
      else if (c.status === 'missing') s.miss++
    })
    return s
  }, [claims])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
      {/* Green checkmark */}
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
        border: '2px solid var(--accent-green)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, fontSize: 24, color: 'var(--accent-green)',
      }}>✓</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        {amendingEval ? 'Evaluation Amendment Complete' : 'Evaluation Complete'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 24 }}>
        Results have been recorded on-chain.
      </div>

      {/* Summary card */}
      <div style={{
        width: '100%', padding: '16px 18px', borderRadius: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <InfoRow label="Asset" value={assetNode.name} />
        <InfoRow label="Requirement set" value={selectedSet.name} />
        <InfoRow label="Claims" value={`${claims.length} total`} mono />
        <InfoRow label="Results" value={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <span style={{ color: 'var(--accent-green)' }}>{summary.ok} SAT</span>
            {summary.bad > 0 && <span style={{ color: 'var(--accent-red)' }}> · {summary.bad} UNSAT</span>}
            {summary.miss > 0 && <span style={{ color: 'var(--text-dim)' }}> · {summary.miss} MISS</span>}
          </span>
        } />
        <InfoRow label="Credits used" value={`${creditCost}`} mono />
      </div>
      {amendingEval && (() => {
        const preserved = claims.filter(c => c._carriedForward).length
        const reEvaluated = claims.filter(c => !c._carriedForward).length
        const newSat = claims.filter(c => c.status === 'satisfactory').length
        const newUnsat = claims.filter(c => c.status === 'unsatisfactory').length
        const newMiss = claims.filter(c => c.status === 'missing').length
        const oldSat = amendingEval.claims.filter(c => c.status === 'satisfactory' || c.status === 'verified').length
        const oldUnsat = amendingEval.claims.filter(c => c.status === 'unsatisfactory' || c.status === 'failed' || c.status === 'contested').length
        const oldMiss = amendingEval.claims.filter(c => c.status === 'missing').length
        const newVersion = (amendingEval.version || 1) + 1
        return (
          <div style={{
            width: '100%', marginTop: 12, padding: '14px 16px', borderRadius: 8,
            background: 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-indigo)', letterSpacing: '0.05em', marginBottom: 10 }}>
              AMENDMENT SUMMARY
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 4 }}>PREVIOUS (v{amendingEval.version || 1})</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--accent-green)' }}>{oldSat} SAT</span>
                  {oldUnsat > 0 && <span style={{ color: 'var(--accent-red)', marginLeft: 8 }}>{oldUnsat} UNSAT</span>}
                  {oldMiss > 0 && <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{oldMiss} MISS</span>}
                </div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 4 }}>AMENDED (v{newVersion})</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--accent-green)' }}>{newSat} SAT</span>
                  {newUnsat > 0 && <span style={{ color: 'var(--accent-red)', marginLeft: 8 }}>{newUnsat} UNSAT</span>}
                  {newMiss > 0 && <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{newMiss} MISS</span>}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              {preserved} claim{preserved !== 1 ? 's' : ''} preserved &middot; {reEvaluated} re-evaluated &middot; Previous version superseded
            </div>
          </div>
        )
      })()}
    </div>
  )
}

/* ─── Step: Evidence Selection for Multi-Evidence Eval ─── */
function StepEvidenceSelect({ assetNode, selectedEvidenceIds, setSelectedEvidenceIds }) {
  const evidenceNodes = useMemo(() => {
    if (!assetNode?.children) return []
    return assetNode.children.filter(c => c.isEvidence)
  }, [assetNode])

  const toggleEvidence = (evId) => {
    setSelectedEvidenceIds(prev => {
      const next = new Set(prev)
      if (next.has(evId)) next.delete(evId)
      else next.add(evId)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedEvidenceIds.size === evidenceNodes.length) setSelectedEvidenceIds(new Set())
    else setSelectedEvidenceIds(new Set(evidenceNodes.map(e => e.id)))
  }

  useEffect(() => {
    if (evidenceNodes.length > 0 && selectedEvidenceIds.size === 0) {
      setSelectedEvidenceIds(new Set(evidenceNodes.map(e => e.id)))
    }
  }, [evidenceNodes])

  return (
    <div>
      <FieldLabel label="Select evidence to evaluate" />
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.7 }}>
        The evaluation will run against parsed data from the selected evidence files.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {selectedEvidenceIds.size} of {evidenceNodes.length} selected
        </span>
        <span onClick={toggleAll} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', cursor: 'pointer' }}>
          {selectedEvidenceIds.size === evidenceNodes.length ? 'Deselect All' : 'Select All'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {evidenceNodes.map(ev => {
          const checked = selectedEvidenceIds.has(ev.id)
          const isParsed = assetNode.children?.some(c => (c.isParse || c.category === 'parse') && c.sourceEvidenceId === ev.id)
          const fieldCount = isParsed
            ? assetNode.children.filter(c => (c.isParse || c.category === 'parse') && c.sourceEvidenceId === ev.id)
                .reduce((acc, pn) => acc + (pn.parsedFields?.length || 0), 0)
            : 0
          return (
            <div key={ev.id} onClick={() => toggleEvidence(ev.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${checked ? 'var(--accent-orange)' : 'var(--border)'}`,
              background: checked ? 'color-mix(in srgb, var(--accent-orange) 4%, transparent)' : 'var(--bg-card)',
              transition: 'all 150ms', opacity: isParsed ? 1 : 0.5,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                border: `2px solid ${checked ? 'var(--accent-orange)' : 'var(--border)'}`,
                background: checked ? 'var(--accent-orange)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>&#10003;</span>}
              </span>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-orange)' }}>EV</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{ev.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                  {ev.evidence?.filename && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{ev.evidence.filename}</span>
                  )}
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: isParsed ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'var(--bg-raised)',
                    color: isParsed ? 'var(--accent-green)' : 'var(--text-dim)',
                  }}>{isParsed ? `PARSED \u00b7 ${fieldCount} fields` : 'UNPARSED'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {evidenceNodes.length === 0 && (
        <div style={{
          padding: '24px 16px', textAlign: 'center', borderRadius: 8,
          background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 8 }}>No evidence to evaluate</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Additional evidence and parsing is required to evaluate this asset. Evidence provides the data fields that evaluations run against.
          </div>
        </div>
      )}
      {evidenceNodes.length > 0 && !evidenceNodes.some(ev =>
        assetNode.children?.some(c => (c.isParse || c.category === 'parse') && c.sourceEvidenceId === ev.id)
      ) && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
          fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.6,
        }}>
          All evidence is unparsed. Parsed data provides the fields that evaluations run against.
        </div>
      )}
    </div>
  )
}

export default function RunEvaluationModal({
  assetNode, evidenceNode, disclosureType, requirementSets, activeParty, activeUser,
  credits, onClose, onComplete, parsedFields: passedParsedFields, _noBackdrop, amendingEval,
}) {
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState(new Set())

  const hasMultipleEvidence = useMemo(() => {
    if (!assetNode?.children) return false
    return assetNode.children.filter(c => c.isEvidence).length > 0
  }, [assetNode])

  const isAmend = !!amendingEval
  const showEvidenceStep = !evidenceNode
  const evidenceStep = showEvidenceStep ? 0 : -1
  const setupStep = !isAmend ? (showEvidenceStep ? 1 : 0) : -1
  const processingStep = isAmend
    ? (showEvidenceStep ? 1 : 0)
    : (showEvidenceStep ? 2 : 1)
  const reviewStep = processingStep + 1
  const confirmStep = reviewStep + 1
  const totalStepCount = confirmStep + 1

  // Scoped to the current evaluator — each party has their own lineage chain
  const activeEvalsByLineage = useMemo(() => {
    if (!assetNode?.children) return new Map()
    const map = new Map()
    const allChildren = assetNode.children || []
    allChildren
      .filter(c =>
        (c.isEvaluation || c.category === 'evaluation') &&
        c.status !== 'superseded' &&
        c.evaluatorParty === activeParty
      )
      .forEach(ev => {
        const lineage = ev.requirementSetLineageId || ev.requirementSetId
        const existing = map.get(lineage)
        if (!existing || (ev.evalVersion || 1) > (existing.evalVersion || 1)) {
          map.set(lineage, ev)
        }
      })
    return map
  }, [assetNode, activeParty])

  const [step, setStep] = useState(showEvidenceStep ? 0 : 0)
  const [selectedSetId, setSelectedSetId] = useState(null)
  const [claims, setClaims] = useState([])
  const [messageIndex, setMessageIndex] = useState(0)
  const [expandedEvidence, setExpandedEvidence] = useState(new Set())
  const [evExpandInit, setEvExpandInit] = useState(false)

  const selectedSet = requirementSets.find(s => s.id === selectedSetId)
  const cost = selectedSet ? calculateEvalCost(selectedSet) : 0
  const canAfford = credits >= cost

  // Auto-select requirement set in amend mode
  useEffect(() => {
    if (amendingEval?.requirementSetId) {
      const matching = requirementSets.find(s => s.id === amendingEval.requirementSetId)
      if (matching) setSelectedSetId(matching.id)
    }
  }, [amendingEval, requirementSets])

  // Use directly passed fields, or filter by selected evidence, or extract all
  const parsedFields = useMemo(() => {
    if (passedParsedFields && passedParsedFields.length > 0) return passedParsedFields
    if (!assetNode?.children) return []

    const getFieldsFromParseNodes = (parseNodes) => {
      return parseNodes.flatMap(pn => {
        const sourceEv = assetNode.children.find(c => c.isEvidence && c.id === pn.sourceEvidenceId)
        return (pn.parsedFields || []).map(f => ({
          ...f,
          templateName: pn.name,
          parseNodeId: pn.id,
          sourceEvidenceId: pn.sourceEvidenceId,
          sourceEvidenceName: sourceEv?.name || sourceEv?.evidence?.filename || pn.sourceEvidenceId,
        }))
      })
    }

    if (showEvidenceStep && selectedEvidenceIds.size > 0) {
      const parseNodes = assetNode.children
        .filter(c => (c.isParse || c.category === 'parse') && selectedEvidenceIds.has(c.sourceEvidenceId))
      return getFieldsFromParseNodes(parseNodes)
    }
    const parseNodes = assetNode.children
      .filter(c => c.isParse || c.category === 'parse')
    return getFieldsFromParseNodes(parseNodes)
  }, [passedParsedFields, assetNode, selectedEvidenceIds, showEvidenceStep])

  const isFullDisclosure = disclosureType === 'full'

  // Evidence data — single node (child layer) or multi-evidence (asset level)
  const evidenceData = useMemo(() => {
    // Single evidence entry point (child layer)
    if (evidenceNode?.evidence) {
      return [{
        id: evidenceNode.id,
        filename: evidenceNode.evidence.filename || evidenceNode.name,
        hash: evidenceNode.evidence.hash,
        block: evidenceNode.evidence.block,
        provider: evidenceNode.evidence.provider,
        localPath: evidenceNode.evidence.localPath || null,
        uri: evidenceNode.evidence.uri || null,
      }]
    }
    // Multi-evidence entry point (asset level)
    if (assetNode?.children && selectedEvidenceIds.size > 0) {
      return assetNode.children
        .filter(c => c.isEvidence && selectedEvidenceIds.has(c.id))
        .map(ev => ({
          id: ev.id,
          filename: ev.evidence?.filename || ev.name,
          hash: ev.evidence?.hash,
          block: ev.evidence?.block,
          provider: ev.evidence?.provider,
          localPath: ev.evidence?.localPath || null,
          uri: ev.evidence?.uri || null,
          name: ev.name,
        }))
    }
    return []
  }, [evidenceNode, assetNode, selectedEvidenceIds])

  const showSplitView = parsedFields.length > 0 || (isFullDisclosure && evidenceData.length > 0)

  // Initialize first evidence expanded when entering review step
  useEffect(() => {
    if (step === reviewStep && evidenceData.length > 0 && !evExpandInit) {
      setExpandedEvidence(new Set([evidenceData[0].id]))
      setEvExpandInit(true)
    }
  }, [step, reviewStep, evidenceData, evExpandInit])

  // Processing step — cycle messages + auto-advance
  useEffect(() => {
    if (step !== processingStep) return
    const msgInterval = setInterval(() => {
      setMessageIndex(prev => prev + 1)
    }, 1200)
    const advanceTimer = setTimeout(() => {
      if (selectedSet) {
        let results = generateMockAIResults(selectedSet, disclosureType, parsedFields)
        // Amend mode: preserve SAT claims from predecessor
        if (amendingEval?.claims) {
          results = results.map(claim => {
            const prev = amendingEval.claims.find(c => c.requirementId === claim.requirementId || c.label === claim.label)
            if (prev && (prev.status === 'satisfactory' || prev.status === 'verified')) {
              return { ...claim, aiValue: prev.humanValue || prev.aiValue, humanValue: prev.humanValue || prev.aiValue, aiConfidence: 0.98, status: 'satisfactory', _carriedForward: true }
            }
            return claim
          })
        }
        setClaims(results)
      }
      setStep(reviewStep)
    }, 4000)
    return () => { clearInterval(msgInterval); clearTimeout(advanceTimer) }
  }, [step, selectedSet, disclosureType, parsedFields, processingStep, reviewStep, amendingEval])

  const unreviewedCount = claims.filter(c => c.status === null).length
  const allReviewed = claims.length > 0 && unreviewedCount === 0

  const totalSteps = totalStepCount

  // Compute summary tallies for fixed bar in step 2
  const reviewSummary = useMemo(() => {
    const s = { sat: 0, unsat: 0, miss: 0 }
    claims.forEach(c => {
      if (c.status === 'satisfactory') s.sat++
      else if (c.status === 'unsatisfactory') s.unsat++
      else if (c.status === 'missing') s.miss++
    })
    return s
  }, [claims])

  const handleNext = () => {
    if (step === evidenceStep && showEvidenceStep) {
      setStep(isAmend ? processingStep : setupStep)
    } else if (step === setupStep && !isAmend && selectedSet && canAfford) {
      setStep(processingStep)
    } else if (step === reviewStep && allReviewed) {
      setStep(confirmStep)
    } else if (step === confirmStep) {
      onComplete({ requirementSet: selectedSet, claims, creditCost: cost, selectedEvidenceIds: [...selectedEvidenceIds] })
    }
  }

  return (
    <Modal width={step === reviewStep ? (showSplitView ? 1100 : 760) : 680}>
      <ModalHeader
        title={amendingEval ? 'Amend Evaluation' : 'Run Evaluation'}
        subtitle={step === evidenceStep && showEvidenceStep ? 'Select evidence to evaluate against.'
          : step === setupStep ? (amendingEval ? `Amending v${amendingEval.version} · ${assetNode.name}` : 'Select a requirement set to evaluate this asset against.')
          : step === reviewStep ? `${assetNode.name} — Review AI findings`
          : undefined}
        step={step < confirmStep ? step + 1 : undefined}
        totalSteps={step < confirmStep ? totalSteps - 1 : undefined}
        onClose={onClose}
      />

      {/* Fixed summary tally — outside ModalBody, does not scroll (non-split only) */}
      {step === reviewStep && !showSplitView && (
        <div style={{
          padding: '10px 28px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '8px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            fontSize: 11, fontFamily: 'var(--font-mono)', flex: 1,
          }}>
            <span style={{ color: 'var(--text-dim)' }}>{claims.length} claims</span>
            <span style={{ color: 'var(--accent-green)' }}>{reviewSummary.sat} satisfactory</span>
            <span style={{ color: 'var(--accent-red)' }}>{reviewSummary.unsat} unsatisfactory</span>
            <span style={{ color: 'var(--text-dim)' }}>{reviewSummary.miss} missing</span>
            {unreviewedCount > 0 && <span style={{ color: 'var(--accent-amber)' }}>{unreviewedCount} unreviewed</span>}
            {claims.some(c => c._carriedForward) && (
              <span style={{ color: 'var(--accent-green)' }}>{claims.filter(c => c._carriedForward).length} preserved</span>
            )}
          </div>
        </div>
      )}

      {/* Split view for Step 2 review */}
      {step === reviewStep && showSplitView ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left panel — Evidence / Disclosed Fields */}
          <div style={{
            flex: 1,
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Left header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--accent-orange)' }}>◧</span>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: 'var(--accent-orange)', letterSpacing: '0.06em',
                }}>EVIDENCE</span>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                {evidenceData.length > 1
                  ? `${evidenceData.length} evidence files · ${parsedFields.length} fields · ${isFullDisclosure ? 'Full' : 'Selective'} access`
                  : evidenceData.length === 1
                    ? evidenceData[0].filename
                    : `${parsedFields.length} field${parsedFields.length !== 1 ? 's' : ''} · ${isFullDisclosure ? 'Full' : 'Selective'} access`
                }
              </div>
            </div>

            {/* Left content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {isFullDisclosure && evidenceData.length > 0 ? (
                // Full disclosure — stacked evidence viewers
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {evidenceData.map((ev, ei) => {
                    const isExpanded = evidenceData.length === 1 || expandedEvidence.has(ev.id)
                    return (
                      <div key={ev.id} style={{ borderBottom: ei < evidenceData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        {/* Evidence file header — always visible, clickable when multiple */}
                        {evidenceData.length > 1 && (
                          <div
                            onClick={() => setExpandedEvidence(prev => {
                              const next = new Set(prev)
                              if (next.has(ev.id)) next.delete(ev.id)
                              else next.add(ev.id)
                              return next
                            })}
                            style={{
                              padding: '20px 16px',
                              background: 'var(--bg-card)',
                              display: 'flex', alignItems: 'center', gap: 8,
                              cursor: 'pointer',
                              borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                              transition: 'background 150ms',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                          >
                            <span style={{
                              fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                              background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                              color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
                            }}>EV</span>
                            <span style={{
                              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                            }}>{ev.filename}</span>
                            <span style={{
                              fontSize: 16, color: 'var(--text-tertiary)',
                              transition: 'transform 180ms ease',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                              display: 'inline-block', flexShrink: 0,
                            }}>▸</span>
                          </div>
                        )}
                        {/* Content — collapsible */}
                        {isExpanded && (
                          ev.localPath ? (
                            <iframe
                              src={ev.localPath}
                              style={{
                                width: '100%',
                                height: evidenceData.length > 1 ? 350 : 400,
                                border: 'none',
                                background: 'var(--bg-deep)',
                              }}
                              title={`Evidence: ${ev.filename}`}
                            />
                          ) : (
                            // No PDF available — show parsed fields for this evidence
                            <div style={{ padding: '12px 16px' }}>
                              {(() => {
                                const fieldsForEv = parsedFields.filter(f => f.sourceEvidenceId === ev.id)
                                if (fieldsForEv.length === 0) return (
                                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                    No parsed data for this evidence.
                                  </div>
                                )
                            return (
                              <div style={{
                                borderRadius: 6, overflow: 'hidden',
                                border: '1px solid var(--border)', background: 'var(--bg-deep)',
                              }}>
                                {fieldsForEv.map((f, i) => (
                                  <div key={f.id || i} style={{
                                    display: 'flex', alignItems: 'center', padding: '6px 10px',
                                    borderBottom: i < fieldsForEv.length - 1 ? '1px solid var(--border)' : 'none',
                                  }}>
                                    <span style={{ width: 120, flexShrink: 0, fontSize: 10, color: 'var(--text-dim)' }}>{f.name}</span>
                                    <span style={{ flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{f.value}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      )
                    )}
                    </div>
                  )
                  })}
                </div>
              ) : (
                // Selective disclosure — fields grouped by source evidence
                <div style={{ flex: 1, padding: '12px 16px' }}>
                  {parsedFields.length > 0 ? (
                    (() => {
                      // Group by sourceEvidenceId
                      const groups = new Map()
                      parsedFields.forEach(f => {
                        const key = f.sourceEvidenceId || 'unknown'
                        if (!groups.has(key)) groups.set(key, { name: f.sourceEvidenceName || f.templateName || key, fields: [] })
                        groups.get(key).fields.push(f)
                      })
                      return [...groups.entries()].map(([evId, group]) => (
                        <div key={evId} style={{ marginBottom: 16 }}>
                          {groups.size > 1 && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              marginBottom: 8,
                            }}>
                              <span style={{
                                fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                                background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                                color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
                              }}>EV</span>
                              <span style={{
                                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                                color: 'var(--text-secondary)',
                              }}>{group.name}</span>
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                                {group.fields.length} fields
                              </span>
                            </div>
                          )}
                          {/* Parse template sub-header if fields come from different templates */}
                          {(() => {
                            const byTemplate = new Map()
                            group.fields.forEach(f => {
                              const tName = f.templateName || 'Fields'
                              if (!byTemplate.has(tName)) byTemplate.set(tName, [])
                              byTemplate.get(tName).push(f)
                            })
                            return [...byTemplate.entries()].map(([tName, tFields]) => (
                              <div key={tName} style={{ marginBottom: 12 }}>
                                <div style={{
                                  fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                  color: 'var(--accent-purple)', letterSpacing: '0.06em', marginBottom: 6,
                                }}>
                                  {tName} ({tFields.length})
                                </div>
                                <div style={{
                                  borderRadius: 6, overflow: 'hidden',
                                  border: '1px solid var(--border)', background: 'var(--bg-deep)',
                                }}>
                                  {tFields.map((f, i) => (
                                    <div key={f.id || i} style={{
                                      display: 'flex', alignItems: 'center', padding: '6px 10px',
                                      borderBottom: i < tFields.length - 1 ? '1px solid var(--border)' : 'none',
                                    }}>
                                      <span style={{ width: 120, flexShrink: 0, fontSize: 10, color: 'var(--text-dim)' }}>{f.name}</span>
                                      <span style={{ flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{f.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          })()}
                        </div>
                      ))
                    })()
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 8 }}>
                      No parsed data available.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right panel — Evaluation */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Right header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--accent-indigo)' }}>◆</span>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: 'var(--accent-indigo)', letterSpacing: '0.06em',
                }}>EVALUATION</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedSet?.name || 'Evaluation'}
              </div>
            </div>

            {/* Tally bar */}
            <div style={{
              padding: '8px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 14,
              fontSize: 11, fontFamily: 'var(--font-mono)', flexShrink: 0,
            }}>
              <span style={{ color: 'var(--text-dim)' }}>{claims.length} claims</span>
              <span style={{ color: 'var(--accent-green)' }}>{reviewSummary.sat} satisfactory</span>
              <span style={{ color: 'var(--accent-red)' }}>{reviewSummary.unsat} unsatisfactory</span>
              <span style={{ color: 'var(--text-dim)' }}>{reviewSummary.miss} missing</span>
              {unreviewedCount > 0 && <span style={{ color: 'var(--accent-amber)' }}>{unreviewedCount} unreviewed</span>}
              {claims.some(c => c._carriedForward) && (
                <span style={{ color: 'var(--accent-green)' }}>{claims.filter(c => c._carriedForward).length} preserved</span>
              )}
            </div>

            {/* Scrollable claims in page container */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8,
                border: '1px solid var(--border)', padding: '20px',
              }}>
                {claims.map((claim, i) => (
                  <div key={claim.requirementId}>
                    {i > 0 && <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />}
                    <div style={claim._carriedForward ? {
                      borderLeft: '3px solid var(--accent-green)',
                      paddingLeft: 12,
                    } : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          padding: '2px 6px', borderRadius: 3,
                          color: claim.type === 'extraction' ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                          background: claim.type === 'extraction'
                            ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)'
                            : 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                        }}>
                          {claim.type === 'extraction' ? 'EXT' : 'INF'}
                        </span>
                        {claim._carriedForward && (
                          <span style={{
                            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '2px 6px', borderRadius: 3,
                            background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                            color: 'var(--accent-green)', flexShrink: 0,
                          }}>PRESERVED</span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{claim.label}</span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                          {Math.round(claim.aiConfidence * 100)}% conf.
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 12, opacity: 0.85 }}>
                        {claim.description}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 60, flexShrink: 0 }}>AI value</span>
                        <span style={{
                          fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                          padding: '4px 8px', borderRadius: 4,
                          background: 'var(--bg-surface)', border: '1px solid var(--border)',
                        }}>{claim.aiValue}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 60, flexShrink: 0 }}>Your value</span>
                        {claim.type === 'extraction' ? (
                          <input
                            value={claim.humanValue === null ? '' : claim.humanValue}
                            onChange={e => setClaims(prev => prev.map(c => c.requirementId === claim.requirementId ? { ...c, humanValue: e.target.value } : c))}
                            onFocus={() => {
                              if (claim.humanValue === null && claim.aiValue) {
                                setClaims(prev => prev.map(c => c.requirementId === claim.requirementId ? { ...c, humanValue: claim.aiValue } : c))
                              }
                            }}
                            placeholder={claim.aiValue}
                            style={{
                              flex: 1, height: 32, padding: '0 10px', borderRadius: 5,
                              border: '1px solid var(--border)', background: 'var(--bg-surface)',
                              color: claim.humanValue === null ? 'var(--text-dim)' : 'var(--text-primary)',
                              fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {['Yes', 'No'].map(v => {
                              const active = claim.humanValue === v
                              return (
                                <button key={v} onClick={() => setClaims(prev => prev.map(c => c.requirementId === claim.requirementId ? { ...c, humanValue: v } : c))}
                                  style={{
                                    padding: '5px 14px', borderRadius: 5, fontSize: 12,
                                    fontFamily: 'var(--font-mono)', fontWeight: 600,
                                    border: `1px solid ${active ? 'var(--accent-indigo)' : 'var(--border)'}`,
                                    background: active ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'transparent',
                                    color: active ? 'var(--accent-indigo)' : 'var(--text-tertiary)',
                                    cursor: 'pointer', transition: 'all 150ms',
                                  }}
                                >{v}</button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {Object.entries(CLAIM_STATUS).map(([key, cfg]) => {
                          const active = claim.status === key
                          return (
                            <button key={key} onClick={() => setClaims(prev => prev.map(c => c.requirementId === claim.requirementId ? { ...c, status: key } : c))}
                              style={{
                                flex: 1, padding: '6px 0', borderRadius: 5, fontSize: 11,
                                fontFamily: 'var(--font-mono)', fontWeight: 600,
                                border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                                background: active ? `color-mix(in srgb, ${cfg.color} 8%, transparent)` : 'transparent',
                                color: active ? cfg.color : 'var(--text-dim)',
                                cursor: 'pointer', transition: 'all 150ms',
                              }}
                            >
                              {cfg.icon} {cfg.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ModalBody>
          {step === evidenceStep && showEvidenceStep && (
            <StepEvidenceSelect
              assetNode={assetNode}
              selectedEvidenceIds={selectedEvidenceIds}
              setSelectedEvidenceIds={setSelectedEvidenceIds}
            />
          )}
          {step === setupStep && (
            <div>
              {amendingEval && (
                <div style={{
                  padding: '14px 16px', borderRadius: 8, marginBottom: 16,
                  background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
                  fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
                }}>
                  <strong style={{ color: 'var(--accent-indigo)' }}>Amending evaluation v{amendingEval.version}</strong> — previously satisfactory claims will be preserved. Missing and unsatisfactory claims will be re-evaluated against the expanded evidence pool.
                </div>
              )}
              <StepSetup
                assetNode={assetNode}
                requirementSets={requirementSets}
                selectedSetId={selectedSetId}
                setSelectedSetId={setSelectedSetId}
                credits={credits}
                disclosureType={disclosureType}
                activeEvalsByLineage={activeEvalsByLineage}
                activeParty={activeParty}
              />
            </div>
          )}
          {step === processingStep && <StepProcessing messageIndex={messageIndex} />}
          {step === reviewStep && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {claims.map(claim => (
                <ClaimCard key={claim.requirementId} claim={claim} onUpdateClaim={(updated) => {
                  setClaims(prev => prev.map(c => c.requirementId === updated.requirementId ? updated : c))
                }} />
              ))}
            </div>
          )}
          {step === confirmStep && (
            <StepConfirmation
              assetNode={assetNode}
              selectedSet={selectedSet}
              claims={claims}
              creditCost={cost}
              amendingEval={amendingEval}
            />
          )}
        </ModalBody>
      )}
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <StepDots current={step} total={totalSteps} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {step === evidenceStep && showEvidenceStep && (() => {
            const hasParsedSelected = assetNode?.children && [...selectedEvidenceIds].some(evId =>
              assetNode.children.some(c => (c.isParse || c.category === 'parse') && c.sourceEvidenceId === evId)
            )
            const noEvidence = !assetNode?.children?.some(c => c.isEvidence)
            const btnDisabled = selectedEvidenceIds.size === 0 || !hasParsedSelected || noEvidence
            const btnLabel = noEvidence
              ? 'No Evidence Available'
              : selectedEvidenceIds.size === 0
                ? 'Select Evidence'
                : !hasParsedSelected
                  ? 'Selected evidence needs parsing'
                  : isAmend
                    ? `${selectedEvidenceIds.size} Evidence \u2014 Amend Evaluation \u2192`
                    : `${selectedEvidenceIds.size} Evidence \u2014 Select Requirement Set \u2192`
            return <Btn label={btnLabel} accent={!btnDisabled} disabled={btnDisabled} onClick={() => setStep(isAmend ? processingStep : setupStep)} />
          })()}
          {step === setupStep && setupStep >= 0 && (
            <Btn
              label={`Run Evaluation \u00b7 ${cost} credits`}
              accent
              onClick={handleNext}
              disabled={!selectedSet || !canAfford}
            />
          )}
          {isAmend && !showEvidenceStep && step === 0 && (
            <Btn
              label={`Amend Evaluation \u00b7 ${cost} credits`}
              accent
              onClick={() => setStep(processingStep)}
              disabled={!selectedSet || !canAfford}
            />
          )}
          {step === reviewStep && (
            <Btn
              label={unreviewedCount > 0 ? `Review ${unreviewedCount} Remaining` : 'Complete Evaluation \u2192'}
              accent
              onClick={handleNext}
              disabled={unreviewedCount > 0}
            />
          )}
          {step === confirmStep && (
            <Btn label="Done" accent onClick={handleNext} />
          )}
        </div>
      </ModalFooter>
    </Modal>
  )
}
