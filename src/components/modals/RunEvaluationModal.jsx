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

function StepSetup({ assetNode, requirementSets, selectedSetId, setSelectedSetId, credits, disclosureType }) {
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
            return (
              <div
                key={rs.id}
                onClick={() => setSelectedSetId(rs.id)}
                style={{
                  padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
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
      background: 'var(--bg-card)', border: '1px solid var(--border)',
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

function StepConfirmation({ assetNode, selectedSet, claims, creditCost }) {
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
        Evaluation Complete
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
    </div>
  )
}

export default function RunEvaluationModal({
  assetNode, evidenceNode, disclosureType, requirementSets, activeParty, activeUser,
  credits, onClose, onComplete, parsedFields: passedParsedFields, _noBackdrop,
}) {
  const [step, setStep] = useState(0) // 0=setup, 1=processing, 2=review, 3=confirmation
  const [selectedSetId, setSelectedSetId] = useState(null)
  const [claims, setClaims] = useState([])
  const [messageIndex, setMessageIndex] = useState(0)

  const selectedSet = requirementSets.find(s => s.id === selectedSetId)
  const cost = selectedSet ? calculateEvalCost(selectedSet) : 0
  const canAfford = credits >= cost

  // Use directly passed fields (resolved by V2App), fallback to extracting from children
  const parsedFields = useMemo(() => {
    if (passedParsedFields && passedParsedFields.length > 0) return passedParsedFields
    if (!assetNode?.children) return []
    return assetNode.children
      .filter(c => c.isParse || c.category === 'parse')
      .flatMap(pn => pn.parsedFields || [])
  }, [passedParsedFields, assetNode])

  const isFullDisclosure = disclosureType === 'full'

  // Evidence data from the specific evidence node being evaluated
  const evidenceData = useMemo(() => {
    if (!evidenceNode?.evidence) return []
    return [{
      id: evidenceNode.id,
      filename: evidenceNode.evidence.filename || evidenceNode.name,
      hash: evidenceNode.evidence.hash,
      block: evidenceNode.evidence.block,
      provider: evidenceNode.evidence.provider,
      retention: evidenceNode.evidence.retention,
      localPath: evidenceNode.evidence.localPath || null,
      uri: evidenceNode.evidence.uri || null,
    }]
  }, [evidenceNode])

  const showSplitView = parsedFields.length > 0 || (isFullDisclosure && evidenceData.length > 0)

  // Processing step — cycle messages + auto-advance
  useEffect(() => {
    if (step !== 1) return
    const msgInterval = setInterval(() => {
      setMessageIndex(prev => prev + 1)
    }, 1200)
    const advanceTimer = setTimeout(() => {
      // Generate AI results
      if (selectedSet) {
        const results = generateMockAIResults(selectedSet, disclosureType, parsedFields)
        setClaims(results)
      }
      setStep(2)
    }, 4000)
    return () => { clearInterval(msgInterval); clearTimeout(advanceTimer) }
  }, [step, selectedSet, disclosureType, parsedFields])

  const unreviewedCount = claims.filter(c => c.status === null).length
  const allReviewed = claims.length > 0 && unreviewedCount === 0

  const totalSteps = 4

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
    if (step === 0 && selectedSet && canAfford) {
      setStep(1)
    } else if (step === 2 && allReviewed) {
      setStep(3)
    } else if (step === 3) {
      onComplete({ requirementSet: selectedSet, claims, creditCost: cost })
    }
  }

  return (
    <Modal width={step === 2 ? (showSplitView ? 1100 : 760) : 680}>
      <ModalHeader
        title="Run Evaluation"
        subtitle={step === 0 ? 'Select a requirement set to evaluate this asset against.'
          : step === 2 ? `${assetNode.name} — Review AI findings`
          : undefined}
        step={step < 3 ? step + 1 : undefined}
        totalSteps={step < 3 ? 3 : undefined}
        onClose={onClose}
      />

      {/* Fixed summary tally — outside ModalBody, does not scroll (non-split only) */}
      {step === 2 && !showSplitView && (
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
          </div>
        </div>
      )}

      {/* Split view for Step 2 review */}
      {step === 2 && showSplitView ? (
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
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                {isFullDisclosure && evidenceData.length > 0 ? (
                  <>
                    <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {evidenceData[0]?.uri?.replace(/[^/]+$/, '') || 'provenance://evidence/'}
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, flexShrink: 0 }}>
                      {evidenceData[0]?.filename}
                    </span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>
                    {parsedFields.length} field{parsedFields.length !== 1 ? 's' : ''} · {isFullDisclosure ? 'Full' : 'Selective'} access
                  </span>
                )}
              </div>
            </div>

            {/* Left content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {isFullDisclosure && evidenceData.length > 0 && evidenceData[0]?.localPath ? (
                <iframe
                  src={evidenceData[0].localPath}
                  style={{ flex: 1, width: '100%', border: 'none', background: 'var(--bg-deep)', minHeight: 400 }}
                  title="Evidence document"
                />
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                  {parsedFields.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: 'var(--accent-purple)', letterSpacing: '0.06em', marginBottom: 8,
                      }}>
                        {isFullDisclosure ? 'PARSED DATA' : 'DISCLOSED FIELDS'} ({parsedFields.length})
                      </div>
                      <div style={{
                        borderRadius: 6, overflow: 'hidden',
                        border: '1px solid var(--border)', background: 'var(--bg-deep)',
                      }}>
                        {parsedFields.map((f, i) => (
                          <div key={f.id || i} style={{
                            display: 'flex', alignItems: 'center', padding: '6px 10px',
                            borderBottom: i < parsedFields.length - 1 ? '1px solid var(--border)' : 'none',
                          }}>
                            <span style={{ width: 120, flexShrink: 0, fontSize: 10, color: 'var(--text-dim)' }}>{f.name}</span>
                            <span style={{ flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{f.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {parsedFields.length === 0 && (
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
                    <div>
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
          {step === 0 && (
            <StepSetup
              assetNode={assetNode}
              requirementSets={requirementSets}
              selectedSetId={selectedSetId}
              setSelectedSetId={setSelectedSetId}
              credits={credits}
              disclosureType={disclosureType}
            />
          )}
          {step === 1 && <StepProcessing messageIndex={messageIndex} />}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {claims.map(claim => (
                <ClaimCard key={claim.requirementId} claim={claim} onUpdateClaim={(updated) => {
                  setClaims(prev => prev.map(c => c.requirementId === updated.requirementId ? updated : c))
                }} />
              ))}
            </div>
          )}
          {step === 3 && (
            <StepConfirmation
              assetNode={assetNode}
              selectedSet={selectedSet}
              claims={claims}
              creditCost={cost}
            />
          )}
        </ModalBody>
      )}
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <StepDots current={step} total={totalSteps} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {step === 0 && (
            <Btn
              label={`Run Evaluation · ${cost} credits`}
              accent
              onClick={handleNext}
              disabled={!selectedSet || !canAfford}
            />
          )}
          {step === 2 && (
            <Btn
              label={unreviewedCount > 0 ? `Review ${unreviewedCount} Remaining` : 'Complete Evaluation →'}
              accent
              onClick={handleNext}
              disabled={unreviewedCount > 0}
            />
          )}
          {step === 3 && (
            <Btn label="Done" accent onClick={handleNext} />
          )}
        </div>
      </ModalFooter>
    </Modal>
  )
}
