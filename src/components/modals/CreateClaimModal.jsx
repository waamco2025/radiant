import { useState, useCallback } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter, Btn, StepDots, FieldLabel } from './ModalShared.jsx'
import QualifiedStoragePicker from './QualifiedStoragePicker.jsx'

const CREDITS_PER_CLAIM = 25

export default function CreateClaimModal({
  activeParty,
  credits,
  onClose,
  onComplete,
  _noBackdrop,
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [showPicker, setShowPicker] = useState(false)

  const handleFilesSelected = useCallback((files) => {
    setSelectedFiles(prev => {
      const existingPaths = new Set(prev.map(f => f.path))
      const newFiles = files.filter(f => !existingPaths.has(f.path)).map(f => ({
        uri: f.path,
        filename: f.name,
        size: f.size,
        mimeType: f.type === 'pdf' ? 'application/pdf' : f.type === 'csv' ? 'text/csv' : 'application/octet-stream',
        label: f.name,
        hash: null,
      }))
      return [...prev, ...newFiles]
    })
    setShowPicker(false)
  }, [])

  const removeFile = useCallback((index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleComplete = () => {
    onComplete({
      name: name.trim(),
      evidenceFiles: selectedFiles,
      creditCost: CREDITS_PER_CLAIM,
    })
  }

  const canProceed = name.trim().length > 0 && selectedFiles.length > 0

  if (showPicker) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <QualifiedStoragePicker
          activeParty={activeParty}
          mode="multi"
          onSelect={handleFilesSelected}
          onCancel={() => setShowPicker(false)}
        />
      </div>
    )
  }

  const content = (
    <Modal width={560}>
      <ModalHeader
        title="Create Claim"
        step={step + 1}
        totalSteps={2}
        onClose={onClose}
      />
      <ModalBody>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Claim name */}
            <div>
              <FieldLabel label="Claim name" required />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. MC-7 Processor, Thermal Interface Pad"
                autoFocus
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Evidence files */}
            <div>
              <FieldLabel label="Evidence files" required />
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
                Every claim must reference at least one evidence file from Qualified Storage.
              </div>

              {selectedFiles.length > 0 && (
                <div style={{
                  borderRadius: 6, overflow: 'hidden',
                  border: '1px solid var(--border)', background: 'var(--bg-deep)',
                  marginBottom: 10,
                }}>
                  {selectedFiles.map((f, i) => (
                    <div key={f.uri + i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px',
                      borderBottom: i < selectedFiles.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                        background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                        color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
                      }}>EV</span>
                      <span style={{
                        fontSize: 11, color: 'var(--text-primary)', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {f.filename}
                      </span>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                      }}>
                        {f.size}
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-dim)', fontSize: 14, padding: '0 2px',
                          lineHeight: 1,
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowPicker(true)}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 6, cursor: 'pointer',
                  border: '1px dashed var(--border)',
                  background: 'transparent', color: 'var(--text-tertiary)',
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-amber)'; e.currentTarget.style.color = 'var(--accent-amber)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
              >
                + Select from Qualified Storage
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Review & Confirm
            </div>
            <div style={{
              padding: '16px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {name}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 4 }}>
                Owner: {activeParty}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 12 }}>
                {selectedFiles.length} evidence file{selectedFiles.length !== 1 ? 's' : ''} referenced
              </div>

              <div style={{
                borderRadius: 6, overflow: 'hidden',
                border: '1px solid var(--border)', background: 'var(--bg-deep)',
              }}>
                {selectedFiles.map((f, i) => (
                  <div key={f.uri + i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    borderBottom: i < selectedFiles.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                      background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                      color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
                    }}>EV</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>
                      {f.filename}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                      {f.size}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 12, paddingTop: 12,
                borderTop: '1px solid var(--border)',
                fontSize: 11, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ color: 'var(--text-dim)' }}>Credit cost</span>
                <span style={{ color: credits >= CREDITS_PER_CLAIM ? 'var(--accent-teal)' : 'var(--accent-red)', fontWeight: 600 }}>
                  {CREDITS_PER_CLAIM} credits
                </span>
              </div>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <StepDots current={step} total={2} />
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <Btn label="Back" onClick={() => setStep(0)} />
          )}
          {step === 0 && (
            <Btn
              label={"Review \u2192"}
              disabled={!canProceed}
              onClick={() => setStep(1)}
              style={canProceed ? { background: 'var(--accent-teal, #2dd4bf)', color: '#fff', border: 'none' } : undefined}
            />
          )}
          {step === 1 && (
            <Btn
              label={credits >= CREDITS_PER_CLAIM ? 'Create Claim' : 'Insufficient Credits'}
              onClick={handleComplete}
              disabled={credits < CREDITS_PER_CLAIM}
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
