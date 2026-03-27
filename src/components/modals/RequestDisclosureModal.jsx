import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter,
  Btn, StepDots, FieldLabel, InfoRow, CopyBadge,
} from './ModalShared'


/* ─── Step 1: Choose path ─── */
function StepPath({ onSelectPath, onRegisterAsset, onSelectDirectory }) {
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

        {/* Public Directory — enabled */}
        <div
          onClick={onSelectDirectory}
          onMouseEnter={() => setHov('directory')}
          onMouseLeave={() => setHov(null)}
          style={{
            padding: '22px 20px', borderRadius: 10,
            border: `1.5px solid ${hov === 'directory' ? '#38bdf8' : 'var(--border)'}`,
            background: hov === 'directory' ? 'var(--bg-raised)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 180ms',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: hov === 'directory' ? 'color-mix(in srgb, #38bdf8 10%, transparent)' : 'var(--bg-raised)',
              border: `1px solid ${hov === 'directory' ? 'color-mix(in srgb, #38bdf8 25%, transparent)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke={hov === 'directory' ? '#38bdf8' : 'var(--text-dim)'} strokeWidth="1.2" />
                <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke={hov === 'directory' ? '#38bdf8' : 'var(--text-dim)'} strokeWidth="0.9" />
                <line x1="2" y1="8" x2="14" y2="8" stroke={hov === 'directory' ? '#38bdf8' : 'var(--text-dim)'} strokeWidth="0.9" />
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: hov === 'directory' ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'color 150ms' }}>
              Browse Public Directory
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, paddingLeft: 46 }}>
            Search the public asset directory for assets that owners have made discoverable. Request disclosure directly from the directory listing.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Requirement Set Picker with expandable details ─── */
function ReqSetPicker({ latestSets, selectedReqSets, setSelectedReqSets }) {
  const [expandedSets, setExpandedSets] = useState({})

  return (
    <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 8, marginBottom: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {latestSets.map(rs => {
          const sel = selectedReqSets.includes(rs.id)
          const isExpanded = expandedSets[rs.id]
          const extCount = rs.requirements.filter(r => r.type === 'extraction').length
          const infCount = rs.requirements.filter(r => r.type === 'inference').length
          return (
            <div key={rs.id} onClick={() => setSelectedReqSets(p => sel ? p.filter(x => x !== rs.id) : [...p, rs.id])} style={{
              padding: '14px 16px', borderRadius: 8,
              border: `1px solid ${sel ? 'var(--accent-indigo)' : 'var(--border)'}`,
              background: sel ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : 'var(--bg-card)',
              cursor: 'pointer', transition: 'all 150ms',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: `1.5px solid ${sel ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  background: sel ? 'var(--accent-indigo)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms', flexShrink: 0,
                }}>
                  {sel && <span style={{ fontSize: 11, color: '#fff', lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: sel ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{rs.name}</span>
                    {rs.version && (
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        padding: '2px 6px', borderRadius: 4,
                        color: 'var(--accent-indigo)',
                        background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                      }}>v{rs.version}</span>
                    )}
                  </div>
                  {rs.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.5 }}>{rs.description}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
                  <span>{rs.requirements.length} req{rs.requirements.length !== 1 ? 's' : ''}</span>
                  <span>{extCount}E</span>
                  <span>{infCount}I</span>
                </div>
              </div>
              {/* Expand trigger */}
              <div
                onClick={e => { e.stopPropagation(); setExpandedSets(p => ({ ...p, [rs.id]: !p[rs.id] })) }}
                style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                  cursor: 'pointer', marginTop: 6, transition: 'color 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-indigo)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >
                {isExpanded ? '▾ Hide requirements' : '▸ View requirements'}
              </div>
              {/* Expanded requirement list */}
              {isExpanded && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    maxHeight: 200, overflowY: 'auto', marginTop: 8, padding: '10px 12px',
                    background: 'var(--bg-deep)', borderRadius: 6,
                    border: '1px solid var(--border)',
                  }}
                >
                  {rs.requirements.map((req, i) => (
                    <div key={req.id || i} style={{
                      padding: '8px 0',
                      borderBottom: i < rs.requirements.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        padding: '2px 7px', borderRadius: 4, flexShrink: 0, marginTop: 1,
                        color: req.type === 'extraction' ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                        background: req.type === 'extraction'
                          ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)'
                          : 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                      }}>
                        {req.type === 'extraction' ? 'EXTRACT' : 'INFER'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{req.label}</div>
                        {req.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 1 }}>{req.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Directory Browser ─── */
const DIR_CAT_COLORS = { product: 'var(--accent-blue)', process: 'var(--accent-amber)', place: 'var(--accent-green)', person: 'var(--accent-cyan)', party: 'var(--accent-indigo)' }
const DIR_CAT_ICONS = { product: '■', process: '◎', place: '◆', person: '●', party: '⬡' }

function DirectoryBrowser({ listings, selectedAsset, onSelect, contextNodeName }) {
  const [search, setSearch] = useState('')

  const filtered = listings.filter(a => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return a.name.toLowerCase().includes(q) ||
      a.owner?.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <svg width={18} height={18} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="6" stroke="#38bdf8" strokeWidth="1.2" />
          <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="#38bdf8" strokeWidth="0.9" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="#38bdf8" strokeWidth="0.9" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Public Asset Directory</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{listings.length} discoverable</span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.7 }}>
        Select an asset to request disclosure. The owner will be notified and can accept or decline.
        Any accepted disclosure will connect to <strong style={{ color: 'var(--text-primary)' }}>{contextNodeName}</strong>.
      </div>

      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search assets by name, owner, or category..."
        style={{
          width: '100%', padding: '8px 12px', fontSize: 12,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--text-primary)', fontFamily: 'var(--font-display)', outline: 'none',
          marginBottom: 14,
        }}
      />

      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
            {search ? `No assets match "${search}"` : 'No assets listed in the public directory.'}
          </div>
        )}
        {filtered.map(asset => {
          const isSelected = selectedAsset?.id === asset.id
          return (
            <div
              key={asset.id}
              onClick={() => onSelect(asset)}
              style={{
                padding: '14px 16px', borderRadius: 8,
                border: `1px solid ${isSelected ? '#38bdf8' : 'var(--border)'}`,
                background: isSelected ? 'color-mix(in srgb, #38bdf8 5%, transparent)' : 'var(--bg-card)',
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isSelected ? '#38bdf8' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms',
                }}>
                  {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{asset.name}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: DIR_CAT_COLORS[asset.category] || 'var(--text-dim)' }}>
                      {DIR_CAT_ICONS[asset.category] || '■'} {asset.category?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>
                    Owner: {asset.owner}
                    {asset.disclosureType && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {asset.disclosureType.toUpperCase()} ACCESS
                      </span>
                    )}
                  </div>
                  {asset.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asset.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    {asset.hasEvidence && <span>◧ Evidence</span>}
                    {asset.hasParsedData && <span>⊞ Parsed</span>}
                    {asset.hasEvaluations && <span>◆ Evaluated</span>}
                    <span>{asset.childCount} children</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
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
export default function RequestDisclosureModal({ contextNode, requirementSets, publicListings, onClose, onRegisterAsset, onSubmitRequest, onValidatePins, _noBackdrop }) {
  const [pinRows, setPinRows] = useState([''])
  const [message, setMessage] = useState('')
  const [selectedReqSets, setSelectedReqSets] = useState([])
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [path, setPath] = useState(null) // null, 'pins', 'directory'
  const [selectedDirAsset, setSelectedDirAsset] = useState(null) // single asset
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
      <Modal width={680}>
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
          <div style={{ padding: '18px 22px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 28, textAlign: 'left' }}>
            <InfoRow label="Asset" value={
              path === 'directory' && selectedDirAsset ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedDirAsset.name}</span>
                  <CopyBadge value={selectedDirAsset.pin} truncated />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 10 }}>{selectedDirAsset.owner}</span>
                </div>
              ) : validEntries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {validEntries.map(([pin, r], i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.resolved?.name}</span>
                      <CopyBadge value={pin} truncated />
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 10 }}>{r.resolved?.owner}</span>
                    </div>
                  ))}
                </div>
              ) : pins.length + ' asset(s)'
            } />
            <InfoRow label="Requirements" value={
              selectedReqSets.length === 0
                ? <span style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>None</span>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {selectedReqSets.map(id => {
                      const rs = requirementSets?.find(s => s.id === id)
                      return rs ? <span key={id} style={{ fontSize: 11 }}>{rs.name}</span> : null
                    })}
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
    <Modal width={680}>
      <ModalHeader title="Connect Asset" subtitle="Find and request disclosure of an asset to connect it to your network." step={step + 1} totalSteps={3} onClose={onClose} />
      <ModalBody>
        {step === 0 && <StepPath onSelectPath={() => { setPath('pins'); setStep(1) }} onRegisterAsset={onRegisterAsset} onSelectDirectory={() => { setPath('directory'); setStep(1) }} />}
        {step === 1 && path === 'pins' && (
          <div>
            <FieldLabel label="Asset PIN(s)" required />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Enter one PIN per line. Press Enter to add a row. You can paste multiple PINs.</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <div data-pin-grid style={{
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--bg-card)', overflow: 'hidden',
            }}>
              {pinRows.map((row, i) => {
                const trimmed = row.trim()
                // Detect duplicate: same PIN appears earlier in the list
                const isDuplicate = (() => {
                  if (!trimmed) return false
                  const lines = pinRows.map(l => l.trim())
                  const firstIndex = lines.indexOf(trimmed)
                  return firstIndex !== -1 && firstIndex < i
                })()
                const rv = isDuplicate ? null : getRowValidation(i)
                const borderColor = isDuplicate ? 'color-mix(in srgb, var(--accent-amber) 25%, transparent)'
                  : rv?.status === 'valid' ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)'
                  : rv?.status === 'error' ? 'color-mix(in srgb, var(--accent-red) 25%, transparent)'
                  : 'transparent'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center',
                    borderBottom: i < pinRows.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isDuplicate ? 'color-mix(in srgb, var(--accent-amber) 3%, transparent)'
                      : rv?.status === 'valid' ? 'color-mix(in srgb, var(--accent-green) 3%, transparent)'
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
                      {isDuplicate && (
                        <span style={{ fontSize: 10, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                          Duplicate — ignored
                        </span>
                      )}
                      {!isDuplicate && rv?.status === 'pending' && (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>···</span>
                      )}
                      {!isDuplicate && rv?.status === 'validating' && (
                        <span style={{
                          display: 'inline-block', width: 12, height: 12,
                          border: '2px solid var(--border)', borderTopColor: 'var(--accent-indigo)',
                          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                        }} />
                      )}
                      {!isDuplicate && rv?.status === 'valid' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)' }}>✓</span>
                          <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rv.resolved?.name}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{rv.resolved?.owner}</span>
                        </span>
                      )}
                      {!isDuplicate && rv?.status === 'error' && (
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
        {step === 1 && path === 'directory' && (
          <DirectoryBrowser
            listings={publicListings || []}
            selectedAsset={selectedDirAsset}
            contextNodeName={contextNode?.name}
            onSelect={(asset) => setSelectedDirAsset(prev => prev?.id === asset.id ? null : asset)}
          />
        )}
        {step === 2 && (
          <div>
            {path === 'directory' && selectedDirAsset && (
              <div style={{ padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: DIR_CAT_COLORS[selectedDirAsset.category] || 'var(--text-dim)' }}>
                  {DIR_CAT_ICONS[selectedDirAsset.category] || '■'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{selectedDirAsset.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CopyBadge value={selectedDirAsset.pin} truncated />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{selectedDirAsset.owner}</span>
                  </div>
                </div>
              </div>
            )}
            <FieldLabel label="Requirements you plan to evaluate" />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.7 }}>
              Select requirement sets to include with your request. This helps the owner understand your evaluation scope and prepare appropriate evidence.
            </div>

            {(!requirementSets || requirementSets.length === 0) && (
              <div style={{
                padding: '24px 20px', textAlign: 'center', color: 'var(--text-dim)',
                fontSize: 12, lineHeight: 1.7, marginBottom: 22,
                border: '1px dashed var(--border)', borderRadius: 8,
              }}>
                No requirement sets in your library. You can still send the request without requirements, or create sets in the Requirements Library first.
              </div>
            )}

            {requirementSets && requirementSets.length > 0 && (() => {
              // Deduplicate by lineage — keep only latest version
              const byLineage = {}
              requirementSets.forEach(rs => {
                const lid = rs.lineageId || rs.id
                if (!byLineage[lid] || (rs.version || 1) > (byLineage[lid].version || 1)) {
                  byLineage[lid] = rs
                }
              })
              const latestSets = Object.values(byLineage)

              return (
                <ReqSetPicker
                  latestSets={latestSets}
                  selectedReqSets={selectedReqSets}
                  setSelectedReqSets={setSelectedReqSets}
                />
              )
            })()}

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
              <InfoRow label="Asset" value={
                path === 'directory' && selectedDirAsset ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedDirAsset.name}</span>
                    <CopyBadge value={selectedDirAsset.pin} truncated />
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 10 }}>{selectedDirAsset.owner}</span>
                  </div>
                ) : validEntries.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {validEntries.map(([pin, r], i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.resolved?.name}</span>
                        <CopyBadge value={pin} truncated />
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 10 }}>{r.resolved?.owner}</span>
                      </div>
                    ))}
                  </div>
                ) : pins.length + ' asset(s)'
              } />
              <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: 34, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-dim)', paddingLeft: 4, paddingTop: 8 }}>Requirements</div>
                <div style={{ flex: 1, paddingTop: 6, paddingBottom: 6 }}>
                  {selectedReqSets.length === 0
                    ? <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.8 }}>None selected</div>
                    : selectedReqSets.map(id => {
                        const rs = requirementSets?.find(s => s.id === id)
                        return rs ? <div key={id} style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>{rs.name}</div> : null
                      })
                  }
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
          {step > 0 && <Btn label="← Back" onClick={() => {
            if (step === 1) { setPath(null); setStep(0); setSelectedDirAsset(null) }
            else setStep(s => s - 1)
          }} />}
          <StepDots current={step} total={3} />
        </div>
        {step === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Choose a path above</div>}
        {step === 1 && path === 'pins' && (
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
        {step === 1 && path === 'directory' && (
          <Btn
            label={selectedDirAsset ? 'Request Disclosure →' : 'Select an asset above'}
            accent
            disabled={!selectedDirAsset}
            onClick={() => setStep(2)}
          />
        )}
        {step === 2 && <Btn label="Send Request" accent onClick={() => {
          if (path === 'directory' && selectedDirAsset) {
            const fullSets = selectedReqSets
              .map(id => requirementSets?.find(s => s.id === id))
              .filter(Boolean)
            if (onSubmitRequest) {
              onSubmitRequest({
                pins: [selectedDirAsset.pin],
                requirements: fullSets,
                message,
                contextNode,
                fromDirectory: true,
              })
            }
          } else {
            const validPinValues = validEntries.map(([pin]) => pin)
            const fullSets = selectedReqSets
              .map(id => requirementSets?.find(s => s.id === id))
              .filter(Boolean)
            if (onSubmitRequest) {
              onSubmitRequest({
                pins: validPinValues.length > 0 ? validPinValues : pins,
                requirements: fullSets,
                message,
                contextNode,
              })
            }
          }
          setSubmitted(true)
        }} />}
      </ModalFooter>
    </Modal>
  )
  return _noBackdrop ? formContent : <Backdrop onClose={onClose}>{formContent}</Backdrop>
}
