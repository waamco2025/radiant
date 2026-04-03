import { useState, useMemo, useRef } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter, Btn, StepDots, FieldLabel } from './ModalShared.jsx'

export default function CreateClaimModal({
  parentNode,
  editingClaim,
  requirementSets,
  publishedSets,
  activeParty,
  onClose,
  onComplete,
  _noBackdrop,
}) {
  const isEditing = !!editingClaim
  const [step, setStep] = useState(isEditing ? 1 : 0)
  const [selectedReqSet, setSelectedReqSet] = useState(isEditing
    ? { id: editingClaim.requirementSetId, name: editingClaim.requirementSetName, version: editingClaim.requirementSetVersion, lineageId: editingClaim.requirementSetLineageId }
    : null)
  const [title, setTitle] = useState(isEditing ? editingClaim.name : '')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState(() =>
    isEditing ? new Set(editingClaim.referencedEvidenceIds || []) : new Set()
  )
  const [reqSetSearch, setReqSetSearch] = useState('')
  const prevReqSetNameRef = useRef('')

  const evidenceNodes = useMemo(() => {
    if (!parentNode?.children) return []
    return parentNode.children.filter(c => c.isEvidence || c.category === 'evidence')
  }, [parentNode])

  // Dedup requirement sets by lineage
  const deduped = useMemo(() => {
    const map = new Map()
    ;(requirementSets || []).forEach(rs => {
      const key = rs.lineageId || rs.id
      const existing = map.get(key)
      if (!existing || (rs.version || 1) > (existing.version || 1)) map.set(key, rs)
    })
    return [...map.values()]
  }, [requirementSets])

  const dedupedPublished = useMemo(() => {
    if (!publishedSets || publishedSets.length === 0) return []
    const map = new Map()
    publishedSets.forEach(rs => {
      const key = rs.lineageId || rs.id
      const existing = map.get(key)
      if (!existing || (rs.version || 1) > (existing.version || 1)) map.set(key, rs)
    })
    return [...map.values()]
  }, [publishedSets])

  const filteredOwn = reqSetSearch.trim()
    ? deduped.filter(rs => rs.name.toLowerCase().includes(reqSetSearch.toLowerCase()))
    : deduped

  const filteredPublished = reqSetSearch.trim()
    ? dedupedPublished.filter(rs => rs.name.toLowerCase().includes(reqSetSearch.toLowerCase()))
    : dedupedPublished

  const handleSelectReqSet = (rs) => {
    setSelectedReqSet(rs)
    if (!title || title === prevReqSetNameRef.current) {
      setTitle(rs.name)
    }
    prevReqSetNameRef.current = rs.name
  }

  const handleComplete = () => {
    onComplete({
      title: title || selectedReqSet.name,
      requirementSet: selectedReqSet,
      referencedEvidenceIds: [...selectedEvidenceIds],
    })
  }

  const allEvidenceSelected = evidenceNodes.length > 0 && evidenceNodes.every(e => selectedEvidenceIds.has(e.id))

  const renderReqSetCard = (rs) => {
    const active = selectedReqSet?.id === rs.id
    const isPublished = !!rs._published
    return (
      <div
        key={rs.id}
        onClick={() => handleSelectReqSet(rs)}
        style={{
          padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
          border: `1.5px solid ${active ? 'var(--accent-teal, #2dd4bf)' : 'var(--border)'}`,
          background: active ? 'color-mix(in srgb, var(--accent-teal, #2dd4bf) 5%, transparent)' : 'var(--bg-card)',
          transition: 'all 150ms',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: active ? 'var(--accent-teal, #2dd4bf)' : 'var(--text-dim)',
            transition: 'background 150ms',
          }} />
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: active ? 'var(--accent-teal, #2dd4bf)' : 'var(--text-secondary)',
            transition: 'color 150ms',
          }}>{rs.name}</span>
          {rs.version && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '1px 5px', borderRadius: 3,
              background: 'color-mix(in srgb, var(--accent-teal, #2dd4bf) 10%, transparent)',
              color: 'var(--accent-teal, #2dd4bf)',
            }}>v{rs.version}</span>
          )}
          {isPublished && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '1px 5px', borderRadius: 3,
              background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
              color: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <svg width={9} height={9} viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="1" />
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1" />
              </svg>
              {rs._publishedBy}
            </span>
          )}
        </div>
        {rs.description && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginLeft: 16 }}>
            {rs.description}
          </div>
        )}
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4, marginLeft: 16 }}>
          {rs.requirements?.length || 0} requirements
        </div>
      </div>
    )
  }

  const content = (
    <Modal width={640}>
      <ModalHeader
        title={isEditing ? 'Edit Claim Evidence' : 'Create Claim'}
        subtitle={parentNode?.name}
        step={isEditing ? 1 : step + 1}
        totalSteps={isEditing ? 1 : 3}
        onClose={onClose}
      />
      <ModalBody>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Title */}
            <div>
              <FieldLabel label="Claim title" />
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Auto-populates from requirement set"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Requirement set picker */}
            <div>
              <FieldLabel label="Requirement set" required />
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <input
                  value={reqSetSearch}
                  onChange={e => setReqSetSearch(e.target.value)}
                  placeholder="Search requirement sets..."
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {filteredOwn.map(rs => renderReqSetCard(rs))}

                {filteredPublished.length > 0 && (
                  <>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginTop: 12, marginBottom: 4,
                    }}>
                      <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="6" stroke="var(--accent-blue)" strokeWidth="1.2" />
                        <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="var(--accent-blue)" strokeWidth="0.9" />
                        <line x1="2" y1="8" x2="14" y2="8" stroke="var(--accent-blue)" strokeWidth="0.9" />
                      </svg>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: 'var(--accent-blue)', letterSpacing: '0.06em',
                      }}>PUBLISHED STANDARDS</span>
                    </div>
                    {filteredPublished.map(rs => renderReqSetCard(rs))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Reference Evidence (Optional)
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Select evidence from this asset to reference in the claim. You can skip this step or add evidence later.
              </div>
            </div>

            {evidenceNodes.length > 0 && (
              <div
                onClick={() => {
                  if (allEvidenceSelected) {
                    setSelectedEvidenceIds(new Set())
                  } else {
                    setSelectedEvidenceIds(new Set(evidenceNodes.map(e => e.id)))
                  }
                }}
                style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-teal, #2dd4bf)',
                  cursor: 'pointer', marginBottom: 4,
                }}
              >
                {allEvidenceSelected ? 'Deselect All' : 'Select All'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evidenceNodes.map(ev => {
                const checked = selectedEvidenceIds.has(ev.id)
                const isParsed = parentNode?.children?.some(c =>
                  (c.isParse || c.category === 'parse') && c.sourceEvidenceId === ev.id
                )
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvidenceIds(prev => {
                      const next = new Set(prev)
                      if (next.has(ev.id)) next.delete(ev.id)
                      else next.add(ev.id)
                      return next
                    })}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${checked ? 'var(--accent-teal, #2dd4bf)' : 'var(--border)'}`,
                      background: checked ? 'color-mix(in srgb, var(--accent-teal, #2dd4bf) 4%, transparent)' : 'var(--bg-card)',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 150ms',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${checked ? 'var(--accent-teal, #2dd4bf)' : 'var(--border)'}`,
                      background: checked ? 'var(--accent-teal, #2dd4bf)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 150ms',
                    }}>
                      {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>&#10003;</span>}
                    </div>
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                      background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                      color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
                    }}>EV</span>
                    <span style={{
                      fontSize: 12, color: 'var(--text-primary)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ev.name || ev.evidence?.filename || ev.id}
                    </span>
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '1px 5px', borderRadius: 3,
                      background: isParsed
                        ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)'
                        : 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                      color: isParsed ? 'var(--accent-green)' : 'var(--accent-amber)',
                    }}>
                      {isParsed ? 'PARSED' : 'UNPARSED'}
                    </span>
                  </div>
                )
              })}
              {evidenceNodes.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', padding: '12px 0' }}>
                  No evidence attached to this asset yet.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Confirm Claim
            </div>
            <div style={{
              padding: '16px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {title || selectedReqSet?.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '2px 6px', borderRadius: 3,
                  background: 'color-mix(in srgb, var(--accent-teal, #2dd4bf) 10%, transparent)',
                  color: 'var(--accent-teal, #2dd4bf)',
                }}>
                  {selectedReqSet?.name}
                </span>
                {selectedReqSet?.version && (
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '1px 5px', borderRadius: 3,
                    background: 'color-mix(in srgb, var(--accent-teal, #2dd4bf) 10%, transparent)',
                    color: 'var(--accent-teal, #2dd4bf)',
                  }}>v{selectedReqSet.version}</span>
                )}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 8 }}>
                {selectedEvidenceIds.size > 0
                  ? `${selectedEvidenceIds.size} evidence file${selectedEvidenceIds.size !== 1 ? 's' : ''} referenced`
                  : 'No evidence referenced'}
              </div>
              {selectedEvidenceIds.size > 0 && (
                <div style={{
                  borderRadius: 6, overflow: 'hidden',
                  border: '1px solid var(--border)', background: 'var(--bg-deep)',
                }}>
                  {[...selectedEvidenceIds].map((evId, i) => {
                    const evNode = evidenceNodes.find(e => e.id === evId)
                    return (
                      <div key={evId} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        borderBottom: i < selectedEvidenceIds.size - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                          background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                          color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
                        }}>EV</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {evNode?.name || evNode?.evidence?.filename || evId}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <StepDots current={isEditing ? 0 : step} total={isEditing ? 1 : 3} />
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && !isEditing && (
            <Btn label="Back" onClick={() => setStep(s => s - 1)} />
          )}
          {step === 0 && !isEditing && (
            <Btn label={"Select Evidence \u2192"} disabled={!selectedReqSet} onClick={() => setStep(1)}
              style={selectedReqSet ? { background: 'var(--accent-teal, #2dd4bf)', color: '#fff', border: 'none' } : undefined}
            />
          )}
          {step === 1 && isEditing && (
            <Btn label="Update Evidence" onClick={handleComplete}
              style={{ background: 'var(--accent-teal, #2dd4bf)', color: '#fff', border: 'none' }}
            />
          )}
          {step === 1 && !isEditing && (
            <Btn label={"Review \u2192"} onClick={() => setStep(2)}
              style={{ background: 'var(--accent-teal, #2dd4bf)', color: '#fff', border: 'none' }}
            />
          )}
          {step === 2 && (
            <Btn label="Create Claim" onClick={handleComplete}
              style={{ background: 'var(--accent-teal, #2dd4bf)', color: '#fff', border: 'none' }}
            />
          )}
        </div>
      </ModalFooter>
    </Modal>
  )

  return _noBackdrop ? content : (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {content}
    </div>
  )
}
