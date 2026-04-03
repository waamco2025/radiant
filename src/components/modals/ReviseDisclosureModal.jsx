import { useState, useMemo, useEffect } from 'react'
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots,
} from './ModalShared'
import { StepFieldSelection } from './DisclosureResponseModal'

export default function ReviseDisclosureModal({ sda, node, onClose, onComplete, _noBackdrop }) {
  const isSelective = sda.type === 'selective'
  const showFieldStep = isSelective
  const totalSteps = showFieldStep ? 2 : 1
  const [step, setStep] = useState(0)

  const evidenceNodes = useMemo(() => {
    if (!node?.children) return []
    return node.children.filter(c => c.isEvidence)
  }, [node])

  const currentEvidenceIds = useMemo(() => {
    if (sda.selectedEvidenceIds && sda.selectedEvidenceIds.length > 0) return new Set(sda.selectedEvidenceIds)
    return new Set()
  }, [sda])

  const lockedEvidenceIds = useMemo(() => {
    if (sda.selectedEvidenceIds && sda.selectedEvidenceIds.length > 0) return new Set(sda.selectedEvidenceIds)
    return new Set()
  }, [sda])

  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState(() =>
    new Set(sda.selectedEvidenceIds && sda.selectedEvidenceIds.length > 0
      ? sda.selectedEvidenceIds
      : [])
  )

  const addedCount = [...selectedEvidenceIds].filter(id => !currentEvidenceIds.has(id)).length

  const claimNodes = useMemo(() => {
    if (!node?.children) return []
    return node.children.filter(c => c.isClaim || c.category === 'claim')
  }, [node])

  const hasClaims = claimNodes.length > 0

  const currentClaimIds = useMemo(() => {
    if (sda.selectedClaimIds && sda.selectedClaimIds.length > 0) {
      const claimIdSet = new Set(claimNodes.map(c => c.id))
      return new Set(sda.selectedClaimIds.filter(id => claimIdSet.has(id)))
    }
    return new Set()
  }, [sda, claimNodes])

  const lockedClaimIds = useMemo(() => {
    if (sda.selectedClaimIds && sda.selectedClaimIds.length > 0) {
      const claimIdSet = new Set(claimNodes.map(c => c.id))
      return new Set(sda.selectedClaimIds.filter(id => claimIdSet.has(id)))
    }
    return new Set()
  }, [sda, claimNodes])

  const [selectedClaimIds, setSelectedClaimIds] = useState(() => {
    if (sda.selectedClaimIds && sda.selectedClaimIds.length > 0) {
      return new Set(sda.selectedClaimIds)
    }
    return new Set()
  })

  const addedClaimCount = [...selectedClaimIds].filter(id => !currentClaimIds.has(id)).length

  const pepFields = useMemo(() => {
    if (!node?.children) return []
    return node.children
      .filter(c => c.isParse || c.category === 'parse')
      .flatMap(pn => (pn.parsedFields || []).map(f => ({
        ...f, templateName: pn.name, parseNodeId: pn.id, parseDate: pn.date || pn.created || null,
        fieldKey: `${pn.id}::${f.id}`,
      })))
  }, [node])

  const filteredPepFields = useMemo(() => {
    if (selectedEvidenceIds.size === 0) return pepFields
    if (!node?.children) return pepFields
    const selectedParseNodeIds = new Set()
    node.children
      .filter(c => (c.isParse || c.category === 'parse') && selectedEvidenceIds.has(c.sourceEvidenceId))
      .forEach(c => selectedParseNodeIds.add(c.id))
    return pepFields.filter(f => selectedParseNodeIds.has(f.parseNodeId))
  }, [pepFields, selectedEvidenceIds, node])

  const currentFieldIds = useMemo(() => {
    if (sda.selectedFieldIds && sda.selectedFieldIds.length > 0) return new Set(sda.selectedFieldIds)
    return new Set()
  }, [sda])

  const [selectedFields, setSelectedFields] = useState(() => {
    if (sda.selectedFieldIds && sda.selectedFieldIds.length > 0) return new Set(sda.selectedFieldIds)
    if (isSelective) return new Set(pepFields.map(f => f.fieldKey))
    return new Set()
  })
  const [allFieldsSelected, setAllFieldsSelected] = useState(true)

  useEffect(() => {
    if (!isSelective) return
    const current = (sda.selectedFieldIds && sda.selectedFieldIds.length > 0)
      ? new Set(sda.selectedFieldIds)
      : new Set(pepFields.map(f => f.fieldKey))
    const validCurrent = new Set(
      [...current].filter(fk => filteredPepFields.some(f => f.fieldKey === fk))
    )
    setSelectedFields(validCurrent)
    setAllFieldsSelected(validCurrent.size === filteredPepFields.length)
  }, [filteredPepFields, isSelective])

  const addedFieldCount = isSelective
    ? [...selectedFields].filter(fk => !currentFieldIds.has(fk)).length
    : 0

  const canComplete = addedCount > 0 || addedFieldCount > 0 || addedClaimCount > 0

  const handleComplete = () => {
    onComplete({
      selectedEvidenceIds: [...selectedEvidenceIds],
      selectedFieldIds: isSelective ? [...selectedFields] : null,
      selectedClaimIds: hasClaims ? [...selectedClaimIds] : null,
    })
  }

  const content = (
    <Modal width={720}>
      <ModalHeader
        title="Amend Disclosure"
        subtitle={`${sda.type.charAt(0).toUpperCase() + sda.type.slice(1)} disclosure to ${sda.party}`}
        step={step + 1}
        totalSteps={totalSteps}
        onClose={onClose}
      />
      <ModalBody>
        {step === 0 && (
          <div>
            <div style={{
              padding: '14px 16px',
              background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
              borderRadius: 8, marginBottom: 20, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7,
            }}>
              Amend this disclosure by adding evidence or claims. Currently disclosed items cannot be removed — revoke the entire disclosure to remove access.
            </div>

            {hasClaims && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedClaimIds.size} claim{selectedClaimIds.size !== 1 ? 's' : ''} selected
                    {addedClaimCount > 0 && (
                      <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 8 }}>
                        +{addedClaimCount} new
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {claimNodes.map(claim => {
                    const checked = selectedClaimIds.has(claim.id)
                    const locked = lockedClaimIds.has(claim.id)
                    return (
                      <div
                        key={claim.id}
                        onClick={() => {
                          if (locked) return
                          setSelectedClaimIds(prev => {
                            const next = new Set(prev)
                            if (next.has(claim.id)) next.delete(claim.id)
                            else next.add(claim.id)
                            return next
                          })
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 8,
                          cursor: locked ? 'default' : 'pointer',
                          opacity: locked ? 0.7 : 1,
                          border: `1.5px solid ${checked ? (locked ? 'var(--border)' : 'var(--accent-teal)') : 'var(--border)'}`,
                          background: checked
                            ? (locked ? 'color-mix(in srgb, var(--text-dim) 3%, transparent)' : 'color-mix(in srgb, var(--accent-teal) 4%, transparent)')
                            : 'var(--bg-card)',
                          transition: 'all 150ms',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: `2px solid ${checked ? (locked ? 'var(--text-dim)' : 'var(--accent-teal)') : 'var(--border)'}`,
                          background: checked ? (locked ? 'var(--text-dim)' : 'var(--accent-teal)') : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 150ms',
                        }}>
                          {checked && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>&#10003;</span>}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, color: 'var(--accent-teal)' }}>{'\u25C7'}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{claim.name}</span>
                          </div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                            {(claim.referencedEvidenceIds || []).length} evidence
                          </div>
                        </div>
                        {locked && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', padding: '2px 6px', borderRadius: 3, background: 'var(--bg-raised)' }}>DISCLOSED</span>
                        )}
                        {!locked && checked && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-green)', padding: '2px 6px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)' }}>NEW</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedEvidenceIds.size} evidence document{selectedEvidenceIds.size !== 1 ? 's' : ''} selected
                {addedCount > 0 && (
                  <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 8 }}>
                    +{addedCount} new
                  </span>
                )}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evidenceNodes.map(ev => {
                const checked = selectedEvidenceIds.has(ev.id)
                const locked = lockedEvidenceIds.has(ev.id)
                return (
                  <div
                    key={ev.id}
                    onClick={() => {
                      if (locked) return
                      setSelectedEvidenceIds(prev => {
                        const next = new Set(prev)
                        if (next.has(ev.id)) next.delete(ev.id)
                        else next.add(ev.id)
                        return next
                      })
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 8,
                      cursor: locked ? 'default' : 'pointer',
                      opacity: locked ? 0.7 : 1,
                      border: `1.5px solid ${checked ? (locked ? 'var(--border)' : 'var(--accent-orange)') : 'var(--border)'}`,
                      background: checked
                        ? (locked ? 'color-mix(in srgb, var(--text-dim) 3%, transparent)' : 'color-mix(in srgb, var(--accent-orange) 4%, transparent)')
                        : 'var(--bg-card)',
                      transition: 'all 150ms',
                    }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${checked ? (locked ? 'var(--text-dim)' : 'var(--accent-orange)') : 'var(--border)'}`,
                      background: checked ? (locked ? 'var(--text-dim)' : 'var(--accent-orange)') : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 150ms',
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
                          background: ev._isParsed ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'var(--bg-raised)',
                          color: ev._isParsed ? 'var(--accent-green)' : 'var(--text-dim)',
                        }}>{ev._isParsed ? 'PARSED' : 'UNPARSED'}</span>
                      </div>
                    </div>
                    {locked && (
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: 'var(--text-dim)', padding: '2px 6px', borderRadius: 3,
                        background: 'var(--bg-raised)',
                      }}>DISCLOSED</span>
                    )}
                    {!locked && checked && (
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: 'var(--accent-green)', padding: '2px 6px', borderRadius: 3,
                        background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                      }}>NEW</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {step === 1 && isSelective && (
          <StepFieldSelection
            pepFields={filteredPepFields}
            selectedFields={selectedFields}
            setSelectedFields={(fn) => {
              if (typeof fn === 'function') {
                setSelectedFields(prev => {
                  const next = fn(prev)
                  currentFieldIds.forEach(fk => {
                    if (filteredPepFields.some(f => f.fieldKey === fk)) next.add(fk)
                  })
                  return next
                })
              } else {
                const next = new Set(fn)
                currentFieldIds.forEach(fk => {
                  if (filteredPepFields.some(f => f.fieldKey === fk)) next.add(fk)
                })
                setSelectedFields(next)
              }
            }}
            allFieldsSelected={allFieldsSelected}
            setAllFieldsSelected={setAllFieldsSelected}
            lockedFieldIds={currentFieldIds}
            isRevision
          />
        )}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={() => setStep(step - 1)} />}
          <StepDots current={step} total={totalSteps} />
        </div>
        {step === 0 && !showFieldStep && (
          <Btn
            label={canComplete
              ? `Amend Disclosure${addedClaimCount > 0 ? ` (+${addedClaimCount} claim${addedClaimCount !== 1 ? 's' : ''})` : ''}${addedCount > 0 ? ` (+${addedCount} evidence)` : ''}`
              : (hasClaims ? 'Select New Claims or Evidence' : 'Select New Evidence')}
            accent={canComplete}
            disabled={!canComplete}
            onClick={handleComplete}
          />
        )}
        {step === 0 && showFieldStep && (
          <Btn label="Select Fields →" accent onClick={() => setStep(1)} />
        )}
        {step === 1 && showFieldStep && (
          <Btn
            label={canComplete ? `Amend Disclosure (+${addedCount} ev, +${addedFieldCount} fields)` : 'Select New Items'}
            accent={canComplete}
            disabled={!canComplete}
            onClick={handleComplete}
          />
        )}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? content : null
}
