import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Modal, ModalHeader, ModalBody, ModalFooter, Btn, StepDots, FieldLabel } from './ModalShared.jsx'
import { PEP_TEMPLATES, FIELD_CATEGORIES, generateMockParsedFields } from '../../v2/pepTemplates.js'
import PrimeRadiant from '../../v2/PrimeRadiant.jsx'

function groupFieldsByCategory(fields) {
  const groups = {}
  fields.forEach(f => {
    if (!groups[f.category]) groups[f.category] = []
    groups[f.category].push(f)
  })
  return groups
}

export default function ParseEvidenceModal({ evidenceNode, parentAssetName, activeParty, existingParseTemplateIds, onClose, onComplete, _noBackdrop }) {
  const [step, setStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [parsedFields, setParsedFields] = useState([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownTriggerRef = useRef(null)
  const dropdownPanelRef = useRef(null)

  const parsedIds = existingParseTemplateIds || new Set()

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e) => {
      if (dropdownTriggerRef.current && dropdownTriggerRef.current.contains(e.target)) return
      if (dropdownPanelRef.current && dropdownPanelRef.current.contains(e.target)) return
      setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleStartParse = () => {
    setStep(1)
    const fields = generateMockParsedFields(selectedTemplate, evidenceNode.name)
    setParsedFields(fields)
    setTimeout(() => setStep(2), 1500)
  }

  const content = (
    <Modal width={620}>
      {step === 0 && (
        <>
          <ModalHeader
            title="Parse Evidence"
            subtitle={<>Extract structured data from <strong style={{ color: 'var(--text-primary)' }}>{evidenceNode.name}</strong> under {parentAssetName}</>}
            step={1} totalSteps={3} onClose={onClose}
          />
          <ModalBody>
            <div style={{
              padding: '14px 16px', borderRadius: 8, marginBottom: 18,
              background: 'color-mix(in srgb, var(--accent-purple, #a78bfa) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-purple, #a78bfa) 15%, transparent)',
              fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
            }}>
              PEP (Parse & Extract Protocol) reads your evidence file and extracts structured metadata fields
              using a template. This is the only process that accesses raw evidence — all evaluations and
              disclosures operate on the parsed output. This action costs credits.
            </div>

            <FieldLabel label="Select parsing template" required />

            <div style={{ position: 'relative', marginBottom: 16 }}>
              {/* Trigger */}
              <div
                ref={dropdownTriggerRef}
                onClick={() => setDropdownOpen(prev => !prev)}
                style={{
                  width: '100%', minHeight: 42, padding: '10px 36px 10px 14px', borderRadius: 6,
                  border: `1px solid ${selectedTemplate ? 'var(--accent-purple, #a78bfa)' : dropdownOpen ? 'var(--border-hover)' : 'var(--border)'}`,
                  background: selectedTemplate
                    ? 'color-mix(in srgb, var(--accent-purple, #a78bfa) 4%, transparent)'
                    : 'var(--bg-card)',
                  cursor: 'pointer', position: 'relative',
                  transition: 'border-color 150ms',
                }}
              >
                {selectedTemplate ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {selectedTemplate.name}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>
                      {selectedTemplate.fieldCount} fields · {selectedTemplate.fields.map(f => f.category).filter((v, i, a) => a.indexOf(v) === i).length} categories
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Choose a template...</div>
                )}
                {/* Chevron */}
                <span style={{
                  position: 'absolute', right: 14, top: '50%', transform: `translateY(-50%) rotate(${dropdownOpen ? '180deg' : '0deg'})`,
                  fontSize: 20, color: 'var(--text-dim)', transition: 'transform 150ms',
                }}>▾</span>
              </div>

              {/* Dropdown panel — portaled to body for z-index */}
              {dropdownOpen && createPortal(
                <div
                  ref={dropdownPanelRef}
                  style={{
                    position: 'fixed',
                    fontFamily: 'var(--font-display)',
                    top: (() => {
                      const rect = dropdownTriggerRef.current?.getBoundingClientRect()
                      return rect ? rect.bottom + 4 : 0
                    })(),
                    left: (() => {
                      const rect = dropdownTriggerRef.current?.getBoundingClientRect()
                      return rect ? rect.left : 0
                    })(),
                    width: (() => {
                      const rect = dropdownTriggerRef.current?.getBoundingClientRect()
                      return rect ? rect.width : 300
                    })(),
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: 8, overflow: 'hidden', zIndex: 10001,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}
                >
                  {PEP_TEMPLATES.map(t => {
                    const isSelected = selectedTemplate?.id === t.id
                    const alreadyParsed = parsedIds.has(t.id)
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (alreadyParsed) return
                          setSelectedTemplate(t)
                          setDropdownOpen(false)
                        }}
                        style={{
                          padding: '12px 14px',
                          cursor: alreadyParsed ? 'default' : 'pointer',
                          opacity: alreadyParsed ? 0.4 : 1,
                          background: isSelected
                            ? 'color-mix(in srgb, var(--accent-purple, #a78bfa) 8%, transparent)'
                            : 'transparent',
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 100ms',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected && !alreadyParsed) e.currentTarget.style.background = 'var(--bg-raised)'
                        }}
                        onMouseLeave={e => {
                          if (!isSelected && !alreadyParsed) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div style={{
                          fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                          color: alreadyParsed ? 'var(--text-dim)' : isSelected ? 'var(--accent-purple, #a78bfa)' : 'var(--text-primary)',
                        }}>
                          {t.name}
                          {alreadyParsed && (
                            <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 8, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                              ALREADY PARSED
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 10, fontFamily: 'var(--font-mono)',
                          color: 'var(--text-dim)', marginTop: 3,
                        }}>
                          {alreadyParsed
                            ? 'This template has already been run on this evidence'
                            : `${t.fieldCount} fields · ${t.description.slice(0, 60)}...`
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>,
                document.body
              )}
            </div>

            {selectedTemplate && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 14 }}>
                  {selectedTemplate.description}
                </div>
                <div style={{
                  maxHeight: 200, overflow: 'auto', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                }}>
                  <div style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: 'var(--text-dim)', letterSpacing: '0.06em',
                    padding: '10px 14px 6px',
                  }}>
                    FIELDS TO EXTRACT
                  </div>
                  {selectedTemplate.fields.map((f, i) => {
                    const catConfig = FIELD_CATEGORIES[f.category] || { label: f.category, color: 'var(--text-secondary)' }
                    return (
                      <div key={f.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 14px',
                        borderTop: i === 0 ? '1px solid var(--border)' : 'none',
                        borderBottom: i < selectedTemplate.fields.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <span style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                          color: catConfig.color, minWidth: 70,
                        }}>{catConfig.label}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.name}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Credit cost */}
            {selectedTemplate && (
              <div style={{
                marginTop: 14, padding: '12px 16px',
                background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Credit cost</span>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>
                  ◇ {selectedTemplate.fieldCount * 2}
                </span>
              </div>
            )}

            {PEP_TEMPLATES.every(t => parsedIds.has(t.id)) && (
              <div style={{
                marginTop: 16, padding: '14px 16px', borderRadius: 8,
                background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
                fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
              }}>
                <strong style={{ color: 'var(--accent-amber)' }}>All available templates have been used</strong> on this evidence.
                To extract additional data, add a new parsing template to your library or attach new evidence to the parent asset.
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <StepDots current={0} total={3} />
            <Btn label="Parse Evidence →" purple disabled={!selectedTemplate} onClick={handleStartParse} />
          </ModalFooter>
        </>
      )}

      {step === 1 && (
        <>
          <ModalHeader title="Parse Evidence" subtitle="Processing evidence file..." step={2} totalSteps={3} onClose={onClose} />
          <ModalBody>
            <div style={{ padding: '60px 36px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 28px' }}>
                <PrimeRadiant size={80} fps={30} strutScale={1.8} brightness={0.3} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Parsing evidence...
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Extracting structured data using {selectedTemplate.name}
              </div>
              <div style={{
                width: '60%', height: 3, borderRadius: 2,
                background: 'var(--border)', margin: '24px auto 0',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: 'var(--accent-purple, #a78bfa)',
                  animation: 'progress 1.5s ease forwards',
                }} />
              </div>
              <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
            </div>
          </ModalBody>
        </>
      )}

      {step === 2 && (
        <>
          <ModalHeader title="Parse Evidence" subtitle="Review extracted data" step={3} totalSteps={3} onClose={onClose} />
          <ModalBody>
            {/* Summary */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
              padding: '12px 16px', borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-purple, #a78bfa) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-purple, #a78bfa) 20%, transparent)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-purple, #a78bfa)' }}>
                {parsedFields.length} fields extracted
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                using {selectedTemplate.name}
              </span>
            </div>

            {/* Fields grouped by category */}
            {Object.entries(groupFieldsByCategory(parsedFields)).map(([catKey, fields]) => {
              const catConfig = FIELD_CATEGORIES[catKey] || { label: catKey, color: 'var(--text-secondary)' }
              return (
                <div key={catKey} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: catConfig.color, letterSpacing: '0.06em', marginBottom: 8,
                  }}>
                    {catConfig.label.toUpperCase()}
                  </div>
                  {fields.map((f, i) => (
                    <div key={f.id} style={{
                      display: 'flex', alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < fields.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ width: 160, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)' }}>{f.name}</span>
                      <span style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{f.value}</span>
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                        padding: '2px 6px', borderRadius: 4,
                        color: f.confidence === 'high' ? 'var(--accent-green)' : f.confidence === 'medium' ? 'var(--accent-amber)' : 'var(--accent-red)',
                        background: f.confidence === 'high'
                          ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                          : f.confidence === 'medium'
                            ? 'color-mix(in srgb, var(--accent-amber) 10%, transparent)'
                            : 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
                      }}>
                        {f.confidence.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}

            {/* Credit cost */}
            <div style={{
              marginTop: 8, padding: '14px 16px',
              background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Credit cost</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>
                ◇ {selectedTemplate.fieldCount * 2}
              </span>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn label="← Back" onClick={() => setStep(0)} />
            <Btn label="Confirm Parse" purple onClick={() => {
              onComplete({
                template: selectedTemplate,
                parsedFields,
                creditCost: selectedTemplate.fieldCount * 2,
              })
            }} />
          </ModalFooter>
        </>
      )}
    </Modal>
  )

  if (_noBackdrop) return content
  return content
}
