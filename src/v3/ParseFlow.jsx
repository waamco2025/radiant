import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import PrimeRadiant from '../v2/PrimeRadiant.jsx'
import { actors, generatePin, getChildObjects, getArtifactSchema } from './v3Data.js'
import { ObjectNodeFull, CARD_W } from './ObjectNode.jsx'
import { generateMockFields, FIELD_CATEGORIES } from './parseTemplates.js'

const cancelBtnStyle = {
  padding: '8px 18px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'all 150ms',
  fontFamily: 'var(--font-display)',
}

const primaryBtnStyle = {
  padding: '8px 20px', borderRadius: 6,
  border: '1px solid var(--accent-purple, #a78bfa)',
  background: 'var(--accent-purple, #a78bfa)',
  color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'all 150ms',
  fontFamily: 'var(--font-display)',
}

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
          }}>{filename}</div>
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
        padding: '20px 16px', overflow: 'auto',
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', lineHeight: 2.0,
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

export default function ParseFlow({ sourceObj, actorId, templates, onComplete, onClose }) {
  const [stage, setStage] = useState('select')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
  const [parsedFields, setParsedFields] = useState([])
  const dropdownTriggerRef = useRef(null)
  const [dropdownRect, setDropdownRect] = useState(null)

  // Used templates — prevent duplicates
  const usedTemplateNames = useMemo(() => {
    const children = getChildObjects(sourceObj.id)
    const parseChildren = children.filter(c => getArtifactSchema(c.artifact) === 'parse-output')
    return new Set(parseChildren.map(c => c.provenance?.template).filter(Boolean))
  }, [sourceObj.id])

  const availableTemplates = templates.filter(t => !usedTemplateNames.has(t.name))
  const allUsed = availableTemplates.length === 0

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  useEffect(() => {
    if (!showTemplateDropdown) return
    const handleClick = () => setShowTemplateDropdown(false)
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTemplateDropdown])

  const openDropdown = useCallback(() => {
    if (dropdownTriggerRef.current) {
      setDropdownRect(dropdownTriggerRef.current.getBoundingClientRect())
    }
    setShowTemplateDropdown(v => !v)
  }, [])

  const handleStartParse = useCallback(() => {
    if (!selectedTemplate) return
    setStage('processing')
    const fields = generateMockFields(selectedTemplate)
    setParsedFields(fields)
    setTimeout(() => setStage('results'), 2000)
  }, [selectedTemplate])

  const handleConfirm = useCallback(() => {
    const now = new Date().toISOString()
    const newId = `obj-parse-${Date.now().toString(36)}`
    const owner = actors.find(a => a.id === sourceObj.owner)

    const newObject = {
      id: newId,
      name: `${sourceObj.name} Parse Result`,
      pin: generatePin(),
      dot: `DOT-${owner?.org?.toUpperCase()?.replace(/\s+/g, '-') || 'UNK'}-${Date.now().toString(36).toUpperCase().slice(-3)}`,
      owner: sourceObj.owner,
      artifactUri: `qs://${owner?.org?.toLowerCase() || 'unknown'}/${sourceObj.name.toLowerCase().replace(/\s+/g, '-')}-parse.json`,
      artifact: {
        schema: 'parse-output',
        template: selectedTemplate.name,
        fields: parsedFields.map(f => ({
          id: f.key, name: f.name, instruction: f.instruction,
          value: f.value, confidence: f.confidence,
        })),
      },
      provenance: {
        derivedFrom: sourceObj.id,
        process: 'parse',
        template: selectedTemplate.name,
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

    onComplete({ newObject, newEdge, creditCost: selectedTemplate.fields.length * 10 })
  }, [sourceObj, selectedTemplate, parsedFields, onComplete])

  const creditCost = selectedTemplate ? selectedTemplate.fields.length * 10 : 0

  const fieldsByCategory = {}
  parsedFields.forEach(f => {
    if (!fieldsByCategory[f.category]) fieldsByCategory[f.category] = []
    fieldsByCategory[f.category].push(f)
  })

  const outputMock = {
    id: '_provisional',
    name: `${sourceObj.name} Parse Result`,
    pin: 'PIN-0x················',
    dot: '—',
    owner: sourceObj.owner,
    artifactUri: null,
    artifact: null,
    provenance: null,
    date: new Date().toISOString().slice(0, 10),
    dateTime: new Date().toISOString(),
  }

  // Footer content per stage
  const renderFooter = () => {
    if (stage === 'processing') return null
    if (stage === 'select') {
      return (
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={handleStartParse}
            disabled={!selectedTemplate}
            style={{
              ...primaryBtnStyle,
              opacity: selectedTemplate ? 1 : 0.4,
              cursor: selectedTemplate ? 'pointer' : 'default',
            }}
          >
            Parse Artifact →
          </button>
        </div>
      )
    }
    if (stage === 'results') {
      return (
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => setStage('select')} style={cancelBtnStyle}>← Back</button>
          <button onClick={() => setStage('confirm')} style={primaryBtnStyle}>Confirm Parse</button>
        </div>
      )
    }
    if (stage === 'confirm') {
      return (
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => setStage('results')} style={cancelBtnStyle}>← Back</button>
          <button onClick={handleConfirm} style={primaryBtnStyle}>Confirm & Register</button>
        </div>
      )
    }
    return null
  }

  return (
    <>
      <style>{`
        @keyframes v3-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes v3-parse-progress { from { width: 0% } to { width: 100% } }
      `}</style>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'v3-fade-in 200ms ease',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxHeight: '90vh', overflow: 'auto',
        }}>
          {/* Source node card */}
          <div style={{ pointerEvents: 'none' }}>
            <ObjectNodeFull obj={sourceObj} selected={true} />
          </div>

          {/* Edge: source → process panel */}
          <svg width="2" height="40" style={{ display: 'block', flexShrink: 0 }}>
            <line x1="1" y1="0" x2="1" y2="40" stroke="#6b8aff" strokeWidth="2" />
          </svg>

          {/* Process panel — fixed height shell */}
          <div style={{
            width: stage === 'results' ? 1100 : 620,
            height: stage === 'results' ? 560 : 512,
            transition: 'width 300ms ease, height 300ms ease',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column',
            flexShrink: 0,
          }}>
            {/* Header — fixed */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {stage === 'results' || stage === 'confirm'
                      ? `Parse Results — ${sourceObj.name}`
                      : `Parse ${sourceObj.name}`}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Artifact: {sourceObj.artifact?.filename || sourceObj.artifactUri || '—'}
                  </div>
                </div>
                <button onClick={onClose} style={{
                  background: 'none', border: 'none', fontSize: 14,
                  color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px',
                }}>✕</button>
              </div>
            </div>

            {/* Body — flex: 1, scrollable */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

              {/* ── select ── */}
              {stage === 'select' && (
                <>
                  {/* Fixed: template dropdown */}
                  <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: 8 }}>
                      SELECT TEMPLATE
                    </div>
                    <button
                      ref={dropdownTriggerRef}
                      onClick={openDropdown}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'var(--bg-card, var(--bg-surface))',
                        border: '1px solid var(--border)',
                        borderRadius: 6, cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 13, color: selectedTemplate ? 'var(--text-primary)' : 'var(--text-dim)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      <div>
                        <div>{selectedTemplate ? selectedTemplate.name : 'Choose a parse template...'}</div>
                        {selectedTemplate && (
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>
                            {selectedTemplate.fields.length} fields · {selectedTemplate.fields.filter(f => f.required).length} required
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
                        <strong style={{ color: 'var(--accent-amber)' }}>All available templates have been used</strong> on this artifact. Add a new parsing template to your library to extract additional data.
                      </div>
                    )}
                  </div>

                  {/* Scrollable: description + context + fields */}
                  {selectedTemplate && (
                    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 0', marginTop: 16 }}>
                      <div style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6,
                      }}>
                        DESCRIPTION
                      </div>
                      <div style={{
                        fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16,
                        padding: '10px 12px', borderRadius: 6,
                        background: 'var(--bg-card, var(--bg-surface))',
                        border: '1px solid var(--border)',
                      }}>
                        {selectedTemplate.description}
                      </div>

                      {selectedTemplate.context && (
                        <>
                          <div style={{
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                            color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6,
                          }}>
                            DOCUMENT CONTEXT
                          </div>
                          <div style={{
                            fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16,
                            padding: '10px 12px', borderRadius: 6,
                            background: 'var(--bg-card, var(--bg-surface))',
                            border: '1px solid var(--border)',
                            fontStyle: 'italic',
                          }}>
                            {selectedTemplate.context}
                          </div>
                        </>
                      )}

                      <div style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span>FIELDS TO EXTRACT</span>
                        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 400, letterSpacing: '0.02em' }}>
                          <span style={{ color: 'var(--accent-red)' }}>*</span> required
                        </span>
                      </div>
                      <div style={{
                        border: '1px solid var(--border)', borderRadius: 6,
                        background: 'var(--bg-card, var(--bg-surface))', overflow: 'hidden',
                        marginBottom: 8,
                      }}>
                        {selectedTemplate.fields.map((f, i) => {
                          const cat = FIELD_CATEGORIES[f.category]
                          return (
                            <div key={f.id} style={{
                              padding: '10px 12px',
                              borderBottom: i < selectedTemplate.fields.length - 1 ? '1px solid var(--border)' : 'none',
                              background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
                                  {f.required && <span style={{ fontSize: 9, color: 'var(--accent-red)', marginLeft: 4, fontWeight: 600 }}>*</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <span style={{
                                    fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600,
                                    padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em',
                                    background: 'color-mix(in srgb, var(--text-tertiary) 10%, transparent)',
                                    color: 'var(--text-tertiary)',
                                    border: '1px solid color-mix(in srgb, var(--text-tertiary) 20%, transparent)',
                                  }}>
                                    {f.format?.toUpperCase() || 'TEXT'}
                                  </span>
                                  <span style={{
                                    fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600,
                                    padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em',
                                    background: `color-mix(in srgb, ${cat?.color || 'var(--text-muted)'} 10%, transparent)`,
                                    color: cat?.color || 'var(--text-muted)',
                                    border: `1px solid color-mix(in srgb, ${cat?.color || 'var(--text-muted)'} 20%, transparent)`,
                                  }}>
                                    {cat?.label?.toUpperCase() || f.category?.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              {f.instruction && (
                                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 5 }}>
                                  {f.instruction}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fixed: credit cost */}
                  {selectedTemplate && (
                    <div style={{ padding: '12px 24px', flexShrink: 0 }}>
                      <div style={{
                        padding: '10px 16px', borderRadius: 8,
                        background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Credit cost</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>
                          ◇ {creditCost}
                        </span>
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
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                      Parsing artifact...
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      Extracting structured data using {selectedTemplate.name}
                    </div>
                    <div style={{
                      width: '60%', height: 3, borderRadius: 2,
                      background: 'var(--border)', margin: '20px auto 0', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: 'var(--accent-purple, #a78bfa)',
                        animation: 'v3-parse-progress 1.8s ease forwards',
                      }} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── results (split panel) ── */}
              {stage === 'results' && (
                <>
                  <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
                    <div style={{
                      padding: '10px 14px', borderRadius: 6,
                      background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)',
                      fontSize: 12, color: 'var(--text-secondary)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span>
                        <strong style={{ color: 'var(--accent-green)' }}>{parsedFields.length} fields</strong> extracted using {selectedTemplate.name}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>*</span> required
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

                    {/* RIGHT: Extracted Fields */}
                    <div style={{ width: '50%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', flexShrink: 0 }}>
                        EXTRACTED FIELDS
                      </div>
                      <div style={{ flex: 1, overflow: 'auto' }}>
                        {Object.entries(fieldsByCategory).map(([cat, fields], groupIdx) => {
                          const catCfg = FIELD_CATEGORIES[cat]
                          return (
                            <div key={cat}>
                              <div style={{
                                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                                color: catCfg?.color || 'var(--text-muted)',
                                letterSpacing: '0.08em',
                                padding: groupIdx === 0 ? '10px 14px 6px' : '16px 14px 6px',
                              }}>
                                {catCfg?.label?.toUpperCase() || cat.toUpperCase()}
                              </div>
                              {fields.map((f, i) => (
                                <div key={f.key} style={{
                                  padding: '10px 14px',
                                  borderBottom: '1px solid var(--border)',
                                  background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <div style={{ flex: 1 }}>
                                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
                                      {f.required && <span style={{ fontSize: 9, color: 'var(--accent-red)', marginLeft: 4, fontWeight: 600 }}>*</span>}
                                    </div>
                                    <ConfidenceBadge value={f.confidence} />
                                  </div>
                                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600, marginTop: 4 }}>
                                    {f.value}
                                  </div>
                                  {f.instruction && (
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 5 }}>
                                      {f.instruction}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '8px 24px', flexShrink: 0 }}>
                    <div style={{
                      padding: '8px 16px', borderRadius: 6,
                      background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Credit cost</span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>
                        ◇ {creditCost}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* ── confirm ── */}
              {stage === 'confirm' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textAlign: 'center' }}>
                      Confirm Parse Result
                    </div>
                    <div style={{
                      padding: '14px 16px', borderRadius: 8, marginBottom: 20,
                      background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
                      fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, textAlign: 'left',
                    }}>
                      This action is <strong style={{ color: 'var(--accent-amber)' }}>immutable</strong>.
                      The parse result will be permanently registered in your qualified storage as a new object
                      derived from <strong style={{ color: 'var(--text-primary)' }}>{sourceObj.name}</strong>.
                      The artifact hash will be locked — any modification will invalidate the object.
                    </div>
                    <div style={{
                      padding: '12px 16px', borderRadius: 8,
                      background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Credit cost</span>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>
                        ◇ {creditCost}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer — pinned to bottom, sibling of body */}
            {renderFooter()}
          </div>

          {/* Edge: process panel → output */}
          <svg width="2" height="40" style={{ display: 'block', flexShrink: 0 }}>
            <line x1="1" y1="0" x2="1" y2="40"
              stroke={stage === 'confirm' ? '#6b8aff' : '#888'}
              strokeWidth="2"
              strokeDasharray={stage === 'confirm' ? '0' : '6 5'}
              style={{ transition: 'all 400ms ease' }}
            />
          </svg>

          {/* Output node card (provisional) */}
          <div style={{
            opacity: stage === 'confirm' ? 1 : 0.5,
            transition: 'opacity 400ms ease',
            pointerEvents: 'none',
            filter: stage === 'confirm' ? 'none' : 'saturate(0)',
          }}>
            <div style={{
              border: stage === 'confirm' ? undefined : '1.5px dashed #888',
              borderRadius: 8,
            }}>
              <ObjectNodeFull obj={outputMock} selected={stage === 'confirm'} />
            </div>
          </div>
        </div>
      </div>

      {/* Template dropdown portal */}
      {showTemplateDropdown && dropdownRect && createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: dropdownRect.bottom + 4,
            left: dropdownRect.left,
            width: dropdownRect.width,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
            zIndex: 10001,
            boxShadow: 'var(--shadow-dropdown)',
          }}
        >
          {templates.map(t => {
            const isUsed = usedTemplateNames.has(t.name)
            return (
              <div
                key={t.id}
                onClick={() => { if (!isUsed) { setSelectedTemplate(t); setShowTemplateDropdown(false) } }}
                style={{
                  padding: '10px 14px',
                  cursor: isUsed ? 'default' : 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 100ms',
                  opacity: isUsed ? 0.4 : 1,
                }}
                onMouseEnter={e => { if (!isUsed) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t.name}
                  </span>
                  {isUsed && (
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em',
                      background: 'color-mix(in srgb, var(--accent-amber) 15%, transparent)',
                      color: 'var(--accent-amber)',
                      border: '1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)',
                    }}>
                      ALREADY PARSED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 3 }}>
                  {t.fields.length} fields · {t.fields.filter(f => f.required).length} required · {t.description.slice(0, 50)}...
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
