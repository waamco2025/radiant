import { useState, useRef, useEffect } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow,
} from './ModalShared'

const REQ_OPTS = [
  'MIL-PRF-55681 Compliance',
  'System Integration Requirements',
  'Component Screening',
  'Material Compliance',
  'Calibration Verification',
]

/* ─── Step 1: Choose path ─── */
function StepPath({ onSelectPath, onRegisterAsset }) {
  const [hov, setHov] = useState(null)
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.7 }}>
        Choose how you'd like to connect assets to your network. Register a new asset, enter PINs shared with you off-platform, or browse the public asset directory.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Register New Asset — enabled */}
        <div
          onClick={() => onRegisterAsset?.()}
          onMouseEnter={() => setHov('register')}
          onMouseLeave={() => setHov(null)}
          style={{
            padding: '22px 20px', borderRadius: 10,
            border: `1.5px solid ${hov === 'register' ? 'var(--accent-green)' : 'var(--border)'}`,
            background: hov === 'register' ? 'var(--bg-raised)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 180ms',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-green) 25%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, color: 'var(--accent-green)', fontWeight: 700 }}>+</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: hov === 'register' ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'color 150ms' }}>
              Register New Asset
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, paddingLeft: 46 }}>
            Create a new asset on your network. You can attach evidence and run evaluations after registration.
          </div>
        </div>

        {/* Known PINs — enabled */}
        <div
          onClick={onSelectPath}
          onMouseEnter={() => setHov('pins')}
          onMouseLeave={() => setHov(null)}
          style={{
            padding: '22px 20px', borderRadius: 10,
            border: `1.5px solid ${hov === 'pins' ? 'var(--accent-indigo)' : 'var(--border)'}`,
            background: hov === 'pins' ? 'var(--bg-raised)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 180ms',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 14, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>PIN</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: hov === 'pins' ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'color 150ms' }}>
              Enter known PINs
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, paddingLeft: 46 }}>
            You have asset PINs from an off-platform conversation with the asset owner. Enter them to send a disclosure request directly.
          </div>
        </div>

        {/* Public Directory — disabled */}
        <div style={{
          padding: '22px 20px', borderRadius: 10,
          border: '1.5px solid var(--border)', background: 'var(--bg-card)',
          cursor: 'default', opacity: 0.4, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 12, right: 14,
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: 'var(--text-dim)', letterSpacing: '0.06em',
            padding: '3px 8px', background: 'var(--bg-raised)', borderRadius: 6,
          }}>COMING SOON</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="var(--text-dim)" strokeWidth="1.3" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="var(--text-dim)" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>Browse Public Directory</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, paddingLeft: 46 }}>
            Search the public asset directory for assets that owners have made discoverable. Request disclosure directly from the directory listing.
          </div>
        </div>
      </div>
    </div>
  )
}

function truncatePin(pin) {
  return pin && pin.length > 24 ? pin.slice(0, 10) + '...' + pin.slice(-4) : pin
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN MODAL
   ═══════════════════════════════════════════════════════════════════════ */
export default function RequestDisclosureModal({ contextNode, onClose, onRegisterAsset, onSubmitRequest, onValidatePins, _noBackdrop }) {
  const [pinRows, setPinRows] = useState([''])
  const [message, setMessage] = useState('')
  const [reqs, setReqs] = useState(['MIL-PRF-55681 Compliance'])
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const inputRefs = useRef([])

  // Inline validation state: { [pin]: { status: 'pending'|'validating'|'valid'|'error', error, resolved } }
  const [pinValidation, setPinValidation] = useState({})
  const validationTimerRef = useRef(null)
  const resolveTimerRef = useRef(null)

  // Derive deduplicated non-empty PINs from rows
  const pins = [...new Set(pinRows.map(p => p.trim()).filter(Boolean))]

  // Debounced auto-validation on input change — prunes stale entries (Fix 3)
  useEffect(() => {
    if (step !== 1) return

    if (pins.length === 0) {
      setPinValidation({})
      return
    }

    // Prune stale entries + show "pending" for new PINs
    const pinSet = new Set(pins)
    setPinValidation(prev => {
      const next = {}
      pins.forEach(pin => {
        if (prev[pin] && prev[pin].status !== 'pending') {
          next[pin] = prev[pin]
        } else {
          next[pin] = { status: 'pending' }
        }
      })
      // Only keep keys that are still in the current pin list (prune stale)
      return next
    })

    if (validationTimerRef.current) clearTimeout(validationTimerRef.current)
    if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current)

    validationTimerRef.current = setTimeout(() => {
      setPinValidation(prev => {
        const next = {}
        // Only update pins that are still current
        pins.forEach(pin => {
          if (prev[pin]?.status === 'pending') {
            next[pin] = { status: 'validating' }
          } else if (prev[pin]) {
            next[pin] = prev[pin]
          }
        })
        return next
      })

      resolveTimerRef.current = setTimeout(() => {
        if (!onValidatePins) return
        const results = onValidatePins(pins)
        setPinValidation(() => {
          const next = {}
          results.forEach(r => {
            // Only include if still in current pin list
            if (pins.includes(r.pin)) {
              next[r.pin] = {
                status: r.status,
                error: r.error,
                resolved: r.resolved,
              }
            }
          })
          return next
        })
      }, 1500)
    }, 1000)

    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current)
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current)
    }
  }, [pinRows.join('\n'), step, onValidatePins])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current)
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current)
    }
  }, [])

  const validEntries = Object.entries(pinValidation).filter(([_, r]) => r.status === 'valid')
  const validCount = validEntries.length
  const hasValidPins = validCount > 0
  // Fix 3: require ALL current PINs resolved AND at least one valid
  const allResolved = pins.length > 0 &&
    pins.every(pin => pinValidation[pin]?.status === 'valid' || pinValidation[pin]?.status === 'error')
  const [hoveredRow, setHoveredRow] = useState(null)

  // Grid input handlers
  const handleRowChange = (index, value) => {
    // If pasting multiple lines, split and fill rows
    if (value.includes('\n')) {
      const pasted = value.split('\n').map(v => v.trim()).filter(Boolean)
      setPinRows(prev => {
        const next = [...prev]
        next.splice(index, 1, ...pasted)
        return next
      })
      // Focus last pasted row
      setTimeout(() => inputRefs.current[index + pasted.length - 1]?.focus(), 0)
      return
    }
    setPinRows(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleRowKeyDown = (index, e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setPinRows(prev => {
        const next = [...prev]
        next.splice(index + 1, 0, '')
        return next
      })
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 0)
    } else if (e.key === 'Backspace' && pinRows[index] === '' && pinRows.length > 1) {
      e.preventDefault()
      setPinRows(prev => {
        const next = [...prev]
        next.splice(index, 1)
        return next
      })
      setTimeout(() => inputRefs.current[Math.max(0, index - 1)]?.focus(), 0)
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowDown' && index < pinRows.length - 1) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const getRowValidation = (index) => {
    const pin = pinRows[index]?.trim()
    if (!pin) return null
    return pinValidation[pin] || null
  }

  if (submitted) {
    const submittedContent = (
      <Modal width={540}>
        <div style={{ padding: '52px 36px', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 22px', border: '2px solid var(--accent-indigo)',
          }}>
            <span style={{ fontSize: 26, color: 'var(--accent-indigo)' }}>↗</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Request Sent</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 28 }}>
            Your disclosure request has been recorded on-chain. The asset owner will be notified and can accept or decline. If accepted, they will determine the disclosure type and terms.
          </div>
          <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28, textAlign: 'left' }}>
            <InfoRow label="Assets" value={
              validEntries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {validEntries.map(([pin, r], i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.resolved?.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 10 }}>{r.resolved?.owner}</span>
                    </div>
                  ))}
                </div>
              ) : pins.length + ' asset(s)'
            } />
            <InfoRow label="Requirements" value={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {reqs.map((r, i) => <span key={i} style={{ fontSize: 11 }}>{r}</span>)}
              </div>
            } />
            {message && <InfoRow label="Message" value={<span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{message.length > 80 ? message.slice(0, 80) + '…' : message}</span>} />}
          </div>
          <Btn label="Done" accent onClick={onClose} />
        </div>
      </Modal>
    )
    return _noBackdrop ? submittedContent : <Backdrop onClose={onClose}>{submittedContent}</Backdrop>
  }

  const formContent = (
    <Modal>
      <ModalHeader title="Connect Asset" subtitle="Find and request disclosure of an asset to connect it to your network." step={step + 1} totalSteps={3} onClose={onClose} />
      <ModalBody>
        {step === 0 && <StepPath onSelectPath={() => setStep(1)} onRegisterAsset={onRegisterAsset} />}
        {step === 1 && (
          <div>
            <FieldLabel label="Asset PIN(s)" required />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Enter one PIN per line. Press Enter to add a row. You can paste multiple PINs.</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <div data-pin-grid style={{
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--bg-card)', overflow: 'hidden',
            }}>
              {pinRows.map((row, i) => {
                const rv = getRowValidation(i)
                const trimmed = row.trim()
                const borderColor = rv?.status === 'valid' ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)'
                  : rv?.status === 'error' ? 'color-mix(in srgb, var(--accent-red) 25%, transparent)'
                  : 'transparent'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center',
                    borderBottom: i < pinRows.length - 1 ? '1px solid var(--border)' : 'none',
                    background: rv?.status === 'valid' ? 'color-mix(in srgb, var(--accent-green) 3%, transparent)'
                      : rv?.status === 'error' ? 'color-mix(in srgb, var(--accent-red) 3%, transparent)'
                      : 'transparent',
                    borderLeft: `3px solid ${borderColor}`,
                    transition: 'all 200ms',
                  }}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {/* Line number */}
                    <span style={{
                      width: 32, textAlign: 'right', paddingRight: 10, flexShrink: 0,
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                      userSelect: 'none',
                    }}>{i + 1}</span>
                    {/* Input */}
                    <input
                      ref={el => inputRefs.current[i] = el}
                      value={row}
                      onChange={e => handleRowChange(i, e.target.value)}
                      onKeyDown={e => handleRowKeyDown(i, e)}
                      onPaste={e => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text')
                        const pastedLines = pasted.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean)
                        if (pastedLines.length === 0) return
                        setPinRows(prev => {
                          const next = [...prev]
                          const after = next.slice(i + 1).filter(l => l.trim())
                          const before = next.slice(0, i)
                          const merged = [...before, ...pastedLines, ...after]
                          if (!merged[merged.length - 1] || merged[merged.length - 1].trim()) merged.push('')
                          return merged
                        })
                        setTimeout(() => inputRefs.current[i + pastedLines.length - 1]?.focus(), 0)
                      }}
                      placeholder={i === 0 ? 'PIN-0x5e9a3b7c4d8f...' : ''}
                      style={{
                        flex: 1, padding: '9px 0', border: 'none', background: 'transparent',
                        color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12,
                        outline: 'none', minWidth: 0,
                      }}
                    />
                    {/* Inline validation status */}
                    <span style={{ flexShrink: 0, padding: '0 10px 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {rv?.status === 'pending' && (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>···</span>
                      )}
                      {rv?.status === 'validating' && (
                        <span style={{
                          display: 'inline-block', width: 12, height: 12,
                          border: '2px solid var(--border)', borderTopColor: 'var(--accent-indigo)',
                          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                        }} />
                      )}
                      {rv?.status === 'valid' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)' }}>✓</span>
                          <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rv.resolved?.name}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{rv.resolved?.owner}</span>
                        </span>
                      )}
                      {rv?.status === 'error' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-red)' }}>✕</span>
                          <span style={{ fontSize: 10, color: 'var(--accent-red)' }}>{rv.error}</span>
                        </span>
                      )}
                    </span>
                    {/* Remove button — visible on hover for non-empty rows */}
                    {hoveredRow === i && trimmed ? (
                      <span
                        onClick={() => {
                          setPinRows(prev => {
                            const next = [...prev]
                            next.splice(i, 1)
                            if (next.length === 0) next.push('')
                            return next
                          })
                        }}
                        style={{
                          width: 20, flexShrink: 0, textAlign: 'center',
                          fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer',
                          transition: 'color 100ms',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                      >
                        ×
                      </span>
                    ) : (
                      <div style={{ width: 20, flexShrink: 0 }} />
                    )}
                  </div>
                )
              })}
              {/* Add row button */}
              <div
                onClick={() => setPinRows(prev => [...prev, ''])}
                style={{
                  padding: '6px 0', textAlign: 'center', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                  borderTop: '1px solid var(--border)',
                  transition: 'color 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-indigo)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >
                + Add row
              </div>
            </div>
            <div style={{
              marginTop: 18, padding: '14px 16px',
              background: 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
              borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
            }}>
              The asset owner will determine the disclosure type and terms when they respond to your request.
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <FieldLabel label="Requirements you plan to evaluate" />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.7 }}>
              Select the requirement sets you intend to run. This helps the owner understand your evaluation scope and prepare appropriate evidence.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {REQ_OPTS.map(r => {
                const sel = reqs.includes(r)
                return (
                  <div key={r} onClick={() => setReqs(p => sel ? p.filter(x => x !== r) : [...p, r])} style={{
                    padding: '12px 16px', borderRadius: 6,
                    border: `1px solid ${sel ? 'var(--accent-indigo)' : 'var(--border)'}`,
                    background: sel ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : 'var(--bg-card)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 150ms',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4,
                      border: `1.5px solid ${sel ? 'var(--accent-indigo)' : 'var(--border)'}`,
                      background: sel ? 'var(--accent-indigo)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 150ms', flexShrink: 0,
                    }}>
                      {sel && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 13, color: sel ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{r}</span>
                  </div>
                )
              })}
            </div>
            <FieldLabel label="Message to owner" />
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Explain why you're requesting disclosure and how the data will be used..."
              rows={4}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                resize: 'vertical', outline: 'none', lineHeight: 1.6,
              }}
            />
            {/* Review summary */}
            <div style={{ marginTop: 22, padding: '16px 18px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em', marginBottom: 12 }}>REVIEW</div>
              <InfoRow label="Assets" value={
                validEntries.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {validEntries.map(([pin, r], i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.resolved?.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 10 }}>{r.resolved?.owner}</span>
                      </div>
                    ))}
                  </div>
                ) : pins.length + ' asset(s)'
              } />
              <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 34, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)', paddingLeft: 4, paddingTop: 8 }}>Requirements</div>
                <div style={{ flex: 1, paddingTop: 6, paddingBottom: 6 }}>
                  {reqs.map((r, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>{r}</div>)}
                </div>
              </div>
              {message && (
                <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 34, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)', paddingLeft: 4, paddingTop: 8 }}>Message</div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8, paddingBottom: 8, lineHeight: 1.6 }}>{message}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && <Btn label="← Back" onClick={() => setStep(s => s - 1)} />}
          <StepDots current={step} total={3} />
        </div>
        {step === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Choose a path above</div>}
        {step === 1 && (
          <Btn
            label={
              !allResolved ? 'Validating...'
              : !hasValidPins ? 'No valid PINs'
              : `Connect ${validCount} Asset${validCount !== 1 ? 's' : ''} →`
            }
            accent
            disabled={!hasValidPins}
            onClick={() => setStep(2)}
          />
        )}
        {step === 2 && <Btn label="Send Request" accent disabled={!reqs.length} onClick={() => {
          const validPinValues = validEntries.map(([pin]) => pin)
          if (onSubmitRequest) {
            onSubmitRequest({
              pins: validPinValues.length > 0 ? validPinValues : pins,
              requirements: reqs,
              message,
              contextNode,
            })
          }
          setSubmitted(true)
        }} />}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
