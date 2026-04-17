import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import PrimeRadiant from '../v2/PrimeRadiant.jsx'
import { actors, generatePin, getChildObjects, getArtifactSchema, getObjectHealth } from './v3Data.js'
import { ObjectNodeFull } from './ObjectNode.jsx'
import { generateMockEvalResults } from './requirementSets.js'
import { FIELD_CATEGORIES } from './parseTemplates.js'

const cancelBtnStyle = {
  padding: '8px 18px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'all 150ms',
  fontFamily: 'var(--font-display)',
}

const primaryBtnStyle = {
  padding: '8px 20px', borderRadius: 6,
  border: '1px solid var(--accent-indigo)',
  background: 'var(--accent-indigo)',
  color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'all 150ms',
  fontFamily: 'var(--font-display)',
}

const STATUS_CONFIG = {
  sat:     { label: 'SAT',     icon: '✓', color: 'var(--accent-green)',  bgMix: 12 },
  unsat:   { label: 'UNSAT',   icon: '✕', color: 'var(--accent-red)',    bgMix: 12 },
  missing: { label: 'MISSING', icon: '?', color: 'var(--accent-amber)',  bgMix: 12 },
  na:      { label: 'N/A',     icon: '—', color: 'var(--text-tertiary)', bgMix: 8 },
}

const STATUS_ORDER = ['sat', 'unsat', 'missing', 'na']

function ConfidenceBadge({ value }) {
  const pct = Math.round(value * 100)
  let label, color
  if (pct >= 90) { label = 'HIGH'; color = 'var(--accent-green)' }
  else if (pct >= 80) { label = 'MED'; color = 'var(--accent-amber)' }
  else { label = 'LOW'; color = 'var(--accent-red)' }
  return (
    <span style={{
      fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
      padding: '0 6px', height: 24, display: 'inline-flex', alignItems: 'center',
      borderRadius: 3, letterSpacing: '0.06em',
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    }}>
      {label} {pct}%
    </span>
  )
}

function EvidenceViewer({ artifact, artifactUri }) {
  const filename = artifact?.filename || artifactUri?.split('/').pop() || 'document'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{
        padding: '10px 12px', borderRadius: 6,
        background: 'var(--bg-card, var(--bg-surface))',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
          <rect x="3" y="1" width="14" height="18" rx="2" stroke="var(--accent-red)" strokeWidth="1.2" fill="none" />
          <text x="10" y="13" textAnchor="middle" fill="var(--accent-red)" fontSize="5" fontWeight="700" fontFamily="var(--font-mono)">PDF</text>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {filename}
          </div>
          {artifact?.size && (
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}>
              {(artifact.size / 1024 / 1024).toFixed(1)} MB
            </div>
          )}
        </div>
      </div>

      <div style={{
        flex: 1, borderRadius: 6,
        background: 'color-mix(in srgb, var(--bg-deep) 80%, var(--bg-surface))',
        border: '1px solid var(--border)',
        padding: '20px 16px',
        overflow: 'auto',
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
        lineHeight: 2.0,
      }}>
        <div style={{ opacity: 0.6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 12, textAlign: 'center' }}>
            ▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓▓
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>
            ▓▓▓▓▓▓▓▓ · ▓▓▓▓▓ · ▓▓▓▓▓▓▓
          </div>
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 2, marginBottom: 8,
              background: 'var(--border)',
              opacity: 0.3 + (i * 37 % 10) * 0.04,
              width: `${50 + (i * 53 % 45)}%`,
            }} />
          ))}
          <div style={{
            marginTop: 16, padding: '10px', borderRadius: 4,
            border: '1px solid var(--border)', opacity: 0.5,
          }}>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>TABLE</div>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <div style={{ height: 5, flex: 1, background: 'var(--border)', borderRadius: 1, opacity: 0.4 }} />
                <div style={{ height: 5, flex: 2, background: 'var(--border)', borderRadius: 1, opacity: 0.3 }} />
                <div style={{ height: 5, flex: 1, background: 'var(--border)', borderRadius: 1, opacity: 0.4 }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 9, color: 'var(--text-muted)' }}>
            Document preview — actual PDF rendering in production
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewRow({ result, index, onCycleStatus, onUpdateValue, isLast }) {
  const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.sat

  const chevronStyle = {
    width: 20, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 12, padding: 0, transition: 'color 100ms',
  }

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      background: index % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{result.name}</span>
          {result.required && <span style={{ fontSize: 9, color: 'var(--accent-red)', marginLeft: 4, fontWeight: 600 }}>*</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <ConfidenceBadge value={result.confidence} />
          <button
            onClick={() => onCycleStatus(index, -1)}
            style={chevronStyle}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >◂</button>
          <div
            onClick={() => onCycleStatus(index, 1)}
            style={{
              minWidth: 64, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              background: `color-mix(in srgb, ${cfg.color} ${cfg.bgMix}%, transparent)`,
              border: `1px solid ${cfg.color}`,
              borderRadius: 4, color: cfg.color,
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.04em', transition: 'all 150ms', userSelect: 'none',
              cursor: 'pointer',
            }}
          >
            {cfg.icon} {cfg.label}
          </div>
          <button
            onClick={() => onCycleStatus(index, 1)}
            style={chevronStyle}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >▸</button>
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        <input
          value={result.extractedValue}
          onChange={e => onUpdateValue(index, e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); e.target.blur() } }}
          style={{
            width: '100%', padding: '5px 8px',
            fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: 'var(--text-primary)',
            background: 'var(--bg-deep, var(--bg-card))',
            border: '1px solid var(--border)',
            borderRadius: 4, outline: 'none',
            transition: 'border-color 150ms',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-indigo)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
      </div>

      <div style={{
        fontSize: 9, color: 'var(--accent-amber)', lineHeight: 1.5, marginTop: 4,
        padding: '3px 6px', borderRadius: 3,
        background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-amber) 12%, transparent)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 600, letterSpacing: '0.06em' }}>CRITERION </span>
        {result.criterion}
      </div>
    </div>
  )
}

// ── Main Component ──

export default function EvalFlow({ sourceObj, actorId, reqSets, onComplete, onClose }) {
  const [stage, setStage] = useState('select')
  const [selectedReqSet, setSelectedReqSet] = useState(null)
  const [evalResults, setEvalResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownTriggerRef = useRef(null)
  const [dropdownRect, setDropdownRect] = useState(null)

  const usedReqSetNames = useMemo(() => {
    const children = getChildObjects(sourceObj.id)
    const evalChildren = children.filter(c => getArtifactSchema(c.artifact) === 'eval-output')
    return new Set(evalChildren.map(c => c.provenance?.template).filter(Boolean))
  }, [sourceObj.id])

  const allUsed = reqSets.every(rs => usedReqSetNames.has(rs.name))

  const statusCounts = useMemo(() => {
    const counts = { sat: 0, unsat: 0, missing: 0, na: 0 }
    evalResults.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
    return counts
  }, [evalResults])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur()
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  useEffect(() => {
    if (!showDropdown) return
    const handleClick = () => setShowDropdown(false)
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  const openDropdown = useCallback(() => {
    if (dropdownTriggerRef.current) setDropdownRect(dropdownTriggerRef.current.getBoundingClientRect())
    setShowDropdown(v => !v)
  }, [])

  const handleStartEval = useCallback(() => {
    if (!selectedReqSet) return
    setStage('processing')
    const results = generateMockEvalResults(selectedReqSet)
    setEvalResults(results)
    setTimeout(() => setStage('review'), 2500)
  }, [selectedReqSet])

  const cycleStatus = useCallback((idx, direction = 1) => {
    setEvalResults(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const currentIdx = STATUS_ORDER.indexOf(r.status)
      const nextIdx = (currentIdx + direction + STATUS_ORDER.length) % STATUS_ORDER.length
      return { ...r, status: STATUS_ORDER[nextIdx] }
    }))
  }, [])

  const updateValue = useCallback((idx, newValue) => {
    setEvalResults(prev => prev.map((r, i) => i === idx ? { ...r, extractedValue: newValue } : r))
  }, [])

  const handleConfirm = useCallback(() => {
    const now = new Date().toISOString()
    const newId = `obj-eval-${Date.now().toString(36)}`
    const evaluatorOrg = actors.find(a => a.id === actorId)?.org
    const activeResults = evalResults.filter(r => r.status !== 'na')

    const newObject = {
      id: newId,
      name: `${sourceObj.name} Evaluation`,
      pin: generatePin(),
      dot: `DOT-${evaluatorOrg?.toUpperCase()?.replace(/\s+/g, '-') || 'UNK'}-${Date.now().toString(36).toUpperCase().slice(-3)}`,
      owner: actorId,
      artifactUri: `qs://${evaluatorOrg?.toLowerCase() || 'unknown'}/${sourceObj.name.toLowerCase().replace(/\s+/g, '-')}-eval.json`,
      artifact: {
        schema: 'eval-output',
        template: selectedReqSet.name,
        requirements: activeResults.map(r => ({
          id: r.id, name: r.name, instruction: r.instruction, criterion: r.criterion,
          value: r.extractedValue, sat: r.status === 'sat', status: r.status, confidence: r.confidence,
        })),
      },
      provenance: {
        derivedFrom: sourceObj.id,
        process: 'evaluate',
        template: selectedReqSet.name,
        timestamp: now,
      },
      date: now.slice(0, 10),
      dateTime: now,
    }

    const newEdge = {
      id: `e-${sourceObj.id}-${newId}`,
      from: sourceObj.id,
      to: newId,
      sdaType: 'full',
    }

    onComplete({ newObject, newEdge, creditCost: selectedReqSet.requirements.length * 10 })
  }, [sourceObj, actorId, selectedReqSet, evalResults, onComplete])

  const creditCost = selectedReqSet ? selectedReqSet.requirements.length * 10 : 0

  const previewSourceObj = useMemo(() => {
    if (stage !== 'confirm' || evalResults.length === 0) return sourceObj
    const activeResults = evalResults.filter(r => r.status !== 'na')
    const newSat = activeResults.filter(r => r.status === 'sat').length
    const newMissing = activeResults.filter(r => r.status === 'missing').length
    const newUnsat = activeResults.filter(r => r.status === 'unsat').length
    const existingHealth = getObjectHealth(sourceObj.id)
    return {
      ...sourceObj,
      _previewHealth: {
        sat: (existingHealth?.sat || 0) + newSat,
        missing: (existingHealth?.missing || 0) + newMissing,
        unsat: (existingHealth?.unsat || 0) + newUnsat,
        total: (existingHealth?.sat || 0) + (existingHealth?.unsat || 0) + newSat + newMissing + newUnsat,
      },
    }
  }, [sourceObj, stage, evalResults])

  const outputMock = {
    id: '_provisional',
    name: `${sourceObj.name} Evaluation`,
    pin: 'PIN-0x················',
    dot: '—',
    owner: actorId,
    artifactUri: null,
    artifact: stage === 'confirm' && evalResults.length > 0
      ? { schema: 'eval-output', requirements: evalResults.filter(r => r.status !== 'na').map(r => ({
          id: r.id, name: r.name, instruction: r.instruction, criterion: r.criterion,
          value: r.extractedValue, sat: r.status === 'sat', status: r.status, confidence: r.confidence,
        })) }
      : null,
    provenance: null,
    date: new Date().toISOString().slice(0, 10),
    dateTime: new Date().toISOString(),
  }

  const renderFooter = () => {
    if (stage === 'processing') return null
    if (stage === 'select') {
      return (
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handleStartEval} disabled={!selectedReqSet} style={{ ...primaryBtnStyle, opacity: selectedReqSet ? 1 : 0.4, cursor: selectedReqSet ? 'pointer' : 'default' }}>
            Evaluate Artifact →
          </button>
        </div>
      )
    }
    if (stage === 'review') {
      return (
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => setStage('select')} style={cancelBtnStyle}>← Back</button>
          <button onClick={() => setStage('confirm')} style={primaryBtnStyle}>Confirm Evaluation</button>
        </div>
      )
    }
    if (stage === 'confirm') {
      return (
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => setStage('review')} style={cancelBtnStyle}>← Back</button>
          <button onClick={handleConfirm} style={primaryBtnStyle}>Confirm & Register</button>
        </div>
      )
    }
    return null
  }

  const isReview = stage === 'review'
  const panelW = isReview ? 1100 : 620
  const panelH = isReview ? 560 : 512

  return (
    <>
      <style>{`
        @keyframes v3-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes v3-eval-progress { from { width: 0% } to { width: 100% } }
      `}</style>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'v3-fade-in 200ms ease',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxHeight: '90vh', overflow: 'auto' }}>
          <div style={{ pointerEvents: 'none' }}>
            <ObjectNodeFull obj={previewSourceObj} selected={true} />
          </div>

          <svg width="2" height="40" style={{ display: 'block', flexShrink: 0 }}>
            <line x1="1" y1="0" x2="1" y2="40" stroke="#6b8aff" strokeWidth="2" />
          </svg>

          {/* Process panel */}
          <div style={{
            width: panelW, height: panelH,
            transition: 'width 300ms ease, height 300ms ease',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', flexShrink: 0,
          }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {stage === 'review' ? `Review Evaluation — ${sourceObj.name}`
                      : stage === 'confirm' ? `Confirm Evaluation — ${sourceObj.name}`
                      : `Evaluate ${sourceObj.name}`}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Artifact: {sourceObj.artifact?.filename || sourceObj.artifactUri || '—'}
                  </div>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

              {/* ── select ── */}
              {stage === 'select' && (
                <>
                  <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: 8 }}>
                      SELECT REQUIREMENT SET
                    </div>
                    <button ref={dropdownTriggerRef} onClick={openDropdown} style={{
                      width: '100%', padding: '10px 14px',
                      background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)',
                      borderRadius: 6, cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13, color: selectedReqSet ? 'var(--text-primary)' : 'var(--text-dim)',
                      fontFamily: 'var(--font-display)',
                    }}>
                      <div>
                        <div>{selectedReqSet ? selectedReqSet.name : 'Choose a requirement set...'}</div>
                        {selectedReqSet && (
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>
                            {selectedReqSet.requirements.length} requirements · {selectedReqSet.requirements.filter(r => r.required).length} required
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span>
                    </button>
                    {allUsed && (
                      <div style={{
                        padding: '14px 16px', borderRadius: 8, marginTop: 12,
                        background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
                        fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
                      }}>
                        <strong style={{ color: 'var(--accent-amber)' }}>All available requirement sets have been used</strong> on this artifact.
                      </div>
                    )}
                  </div>

                  {selectedReqSet && (
                    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 0' }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>DESCRIPTION</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)' }}>
                        {selectedReqSet.description}
                      </div>
                      {selectedReqSet.context && (
                        <>
                          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>EVALUATION CONTEXT</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)', fontStyle: 'italic' }}>
                            {selectedReqSet.context}
                          </div>
                        </>
                      )}
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>REQUIREMENTS TO CHECK</span>
                        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 400 }}><span style={{ color: 'var(--accent-red)' }}>*</span> required</span>
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card, var(--bg-surface))', overflow: 'hidden', marginBottom: 8 }}>
                        {selectedReqSet.requirements.map((r, i) => {
                          const cat = FIELD_CATEGORIES[r.category]
                          return (
                            <div key={r.id} style={{
                              padding: '10px 12px',
                              borderBottom: i < selectedReqSet.requirements.length - 1 ? '1px solid var(--border)' : 'none',
                              background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                                  {r.required && <span style={{ fontSize: 9, color: 'var(--accent-red)', marginLeft: 4, fontWeight: 600 }}>*</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em', background: 'color-mix(in srgb, var(--text-tertiary) 10%, transparent)', color: 'var(--text-tertiary)', border: '1px solid color-mix(in srgb, var(--text-tertiary) 20%, transparent)' }}>
                                    {r.format?.toUpperCase() || 'TEXT'}
                                  </span>
                                  <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em', background: `color-mix(in srgb, ${cat?.color || 'var(--text-muted)'} 10%, transparent)`, color: cat?.color || 'var(--text-muted)', border: `1px solid color-mix(in srgb, ${cat?.color || 'var(--text-muted)'} 20%, transparent)` }}>
                                    {cat?.label?.toUpperCase() || r.category?.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 5 }}>{r.instruction}</div>
                              <div style={{ fontSize: 10, color: 'var(--accent-amber)', lineHeight: 1.5, marginTop: 5, padding: '4px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-amber) 12%, transparent)' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600, letterSpacing: '0.06em' }}>CRITERION </span>{r.criterion}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {selectedReqSet && (
                    <div style={{ padding: '12px 24px', flexShrink: 0 }}>
                      <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Credit cost</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>◇ {creditCost}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── processing ── */}
              {stage === 'processing' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', padding: '0 36px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                      <PrimeRadiant size={80} fps={30} strutScale={1.8} brightness={0.3} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Evaluating artifact...</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>Checking requirements using {selectedReqSet.name}</div>
                    <div style={{ width: '60%', height: 3, borderRadius: 2, background: 'var(--border)', margin: '20px auto 0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent-indigo)', animation: 'v3-eval-progress 2.2s ease forwards' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── review (split panel) ── */}
              {stage === 'review' && (
                <>
                  <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
                    <div style={{
                      padding: '10px 14px', borderRadius: 6,
                      background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent-indigo) 20%, transparent)',
                      fontSize: 12, color: 'var(--text-secondary)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span><strong style={{ color: 'var(--accent-indigo)' }}>{evalResults.length} requirements</strong> assessed using {selectedReqSet.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', gap: 8 }}>
                        {statusCounts.sat > 0 && <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{statusCounts.sat} SAT</span>}
                        {statusCounts.unsat > 0 && <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{statusCounts.unsat} UNSAT</span>}
                        {statusCounts.missing > 0 && <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{statusCounts.missing} MISSING</span>}
                        {statusCounts.na > 0 && <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{statusCounts.na} N/A</span>}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', overflow: 'hidden', marginTop: 12 }}>
                    {/* LEFT: Evidence */}
                    <div style={{ width: '50%', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', flexShrink: 0 }}>
                        EVIDENCE
                      </div>
                      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                        <EvidenceViewer artifact={sourceObj.artifact} artifactUri={sourceObj.artifactUri} />
                      </div>
                    </div>

                    {/* RIGHT: Review */}
                    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>HUMAN REVIEW</span>
                        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 400 }}><span style={{ color: 'var(--accent-red)' }}>*</span> required</span>
                      </div>
                      <div style={{ flex: 1, overflow: 'auto' }}>
                        {evalResults.map((r, i) => (
                          <ReviewRow key={r.id} result={r} index={i} onCycleStatus={cycleStatus} onUpdateValue={updateValue} isLast={i === evalResults.length - 1} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '8px 24px', flexShrink: 0 }}>
                    <div style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Credit cost</span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>◇ {creditCost}</span>
                    </div>
                  </div>
                </>
              )}

              {/* ── confirm ── */}
              {stage === 'confirm' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textAlign: 'center' }}>Confirm Evaluation Result</div>
                    <div style={{ padding: '14px 16px', borderRadius: 8, marginBottom: 20, background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, textAlign: 'left' }}>
                      This action is <strong style={{ color: 'var(--accent-amber)' }}>immutable</strong>.
                      The evaluation result will be permanently registered in your qualified storage as a new object
                      derived from <strong style={{ color: 'var(--text-primary)' }}>{sourceObj.name}</strong>.
                      The artifact hash will be locked — any modification will invalidate the object.
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 12, background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Result</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, display: 'flex', gap: 10 }}>
                        {statusCounts.sat > 0 && <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{statusCounts.sat} SAT</span>}
                        {statusCounts.unsat > 0 && <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{statusCounts.unsat} UNSAT</span>}
                        {statusCounts.missing > 0 && <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{statusCounts.missing} MISSING</span>}
                        {statusCounts.na > 0 && <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{statusCounts.na} N/A</span>}
                      </div>
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Credit cost</span>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>◇ {creditCost}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {renderFooter()}
          </div>

          <svg width="2" height="40" style={{ display: 'block', flexShrink: 0 }}>
            <line x1="1" y1="0" x2="1" y2="40" stroke={stage === 'confirm' ? '#6b8aff' : '#888'} strokeWidth="2" strokeDasharray={stage === 'confirm' ? '0' : '6 5'} style={{ transition: 'all 400ms ease' }} />
          </svg>

          <div style={{ opacity: stage === 'confirm' ? 1 : 0.5, transition: 'opacity 400ms ease', pointerEvents: 'none', filter: stage === 'confirm' ? 'none' : 'saturate(0)' }}>
            <div style={{ border: stage === 'confirm' ? undefined : '1.5px dashed #888', borderRadius: 8 }}>
              <ObjectNodeFull obj={outputMock} selected={stage === 'confirm'} />
            </div>
          </div>
        </div>
      </div>

      {showDropdown && dropdownRect && createPortal(
        <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', top: dropdownRect.bottom + 4, left: dropdownRect.left, width: dropdownRect.width, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', zIndex: 10001, boxShadow: 'var(--shadow-dropdown)' }}>
          {reqSets.map(rs => {
            const isUsed = usedReqSetNames.has(rs.name)
            return (
              <div key={rs.id} onClick={() => { if (!isUsed) { setSelectedReqSet(rs); setShowDropdown(false) } }}
                style={{ padding: '10px 14px', cursor: isUsed ? 'default' : 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 100ms', opacity: isUsed ? 0.4 : 1 }}
                onMouseEnter={e => { if (!isUsed) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{rs.name}</span>
                  {isUsed && <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em', background: 'color-mix(in srgb, var(--accent-amber) 15%, transparent)', color: 'var(--accent-amber)', border: '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)' }}>ALREADY EVALUATED</span>}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 3 }}>
                  {rs.requirements.length} requirements · {rs.requirements.filter(r => r.required).length} required · {rs.description.slice(0, 50)}...
                </div>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}
