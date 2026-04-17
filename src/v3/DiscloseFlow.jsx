import { useState, useEffect, useCallback, useRef } from 'react'
import { actors, generatePin, objects as staticObjects } from './v3Data.js'
import { ObjectNodeFull } from './ObjectNode.jsx'

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

export default function DiscloseFlow({ sourceObj, actorId, allObjects, requirementSets, existingEdges, onComplete, onClose }) {
  const [pin, setPin] = useState('')
  const [pinStatus, setPinStatus] = useState(null)
  const [pinError, setPinError] = useState(null)
  const [resolvedTarget, setResolvedTarget] = useState(null)
  const [selectedReqSets, setSelectedReqSets] = useState([])
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const pendingResult = useRef(null)

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          document.activeElement.blur()
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // PIN resolution with duplicate detection
  useEffect(() => {
    const trimmed = pin.trim()
    if (!trimmed || trimmed.length < 10) {
      setPinStatus(null)
      setPinError(null)
      setResolvedTarget(null)
      return
    }

    setPinStatus('validating')
    setPinError(null)

    const timer = setTimeout(() => {
      // Search all known objects (static + visible) for PIN resolution
      const searchPool = [...new Map([...staticObjects, ...allObjects].map(o => [o.id, o])).values()]
      const match = searchPool.find(o => o.pin === trimmed)

      if (match) {
        if (match.owner === actorId) {
          setPinStatus('invalid')
          setPinError('Cannot connect to your own asset.')
          setResolvedTarget(null)
          return
        }

        // Check if already visible in network (any connection, not just from sourceObj)
        const alreadyInNetwork = allObjects.some(o => o.id === match.id)
        if (alreadyInNetwork) {
          setPinStatus('duplicate')
          setPinError('This asset is already in your network.')
          setResolvedTarget(null)
          return
        }

        const ownerActor = actors.find(a => a.id === match.owner)
        setPinStatus('valid')
        setResolvedTarget({ id: match.id, name: match.name, owner: match.owner, org: ownerActor?.org || 'Unknown', pin: match.pin })
      } else {
        setPinStatus('valid')
        setResolvedTarget({
          id: `ext-${Date.now().toString(36)}`,
          name: 'External Asset',
          owner: 'actor-unknown',
          org: 'Unknown Org',
          pin: trimmed,
          isExternal: true,
        })
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [pin, allObjects, actorId, existingEdges, sourceObj.id])

  const handleSend = useCallback(() => {
    if (!resolvedTarget) return
    const now = new Date().toISOString()
    const newId = `obj-disc-${Date.now().toString(36)}`
    const requester = actors.find(a => a.id === actorId)

    const disclosureObj = {
      id: newId,
      name: `${sourceObj.name} ↔ ${resolvedTarget.name} Disclosure`,
      pin: generatePin(),
      dot: `DOT-DIS-${Date.now().toString(36).toUpperCase().slice(-3)}`,
      owner: actorId,
      artifactUri: `qs://shared/disc-${sourceObj.id}-${resolvedTarget.id}.json`,
      artifact: {
        schema: 'disclosure-agreement',
        type: null,
        status: 'pending',
        parties: {
          requester: { actorId, name: requester?.name || 'Unknown', org: requester?.org || 'Unknown' },
          responder: { actorId: resolvedTarget.owner, name: resolvedTarget.name, org: resolvedTarget.org },
        },
        scope: { sourceObjectId: sourceObj.id, targetObjectId: resolvedTarget.id },
        request: {
          requirementSets: selectedReqSets.map(id => {
            const rs = requirementSets.find(r => r.id === id)
            return rs ? { id: rs.id, name: rs.name, version: rs.version } : { id }
          }),
          message: message.trim() || null,
          timestamp: now,
        },
        terms: null,
        executedAt: null,
      },
      provenance: null,
      date: now.slice(0, 10),
      dateTime: now,
    }

    const newEdge = {
      id: `e-disc-${Date.now().toString(36)}`,
      from: sourceObj.id,
      to: resolvedTarget.id,
      sdaType: 'pending',
      agreementObjectId: newId,
      status: 'pending',
    }

    setSubmitted(true)
    pendingResult.current = {
      disclosureObj, newEdge, resolvedTarget,
      requestDetails: {
        requirementSets: selectedReqSets.map(id => {
          const rs = requirementSets.find(r => r.id === id)
          return rs ? { id: rs.id, name: rs.name, version: rs.version } : { id }
        }),
        message: message.trim() || null,
        timestamp: now,
        requestedVia: sourceObj.name,
      },
    }
  }, [sourceObj, actorId, resolvedTarget, selectedReqSets, requirementSets, message, onComplete])

  const handleDone = useCallback(() => {
    if (pendingResult.current) onComplete(pendingResult.current)
  }, [onComplete])

  const owner = actors.find(a => a.id === sourceObj.owner)
  const canSend = pinStatus === 'valid' && resolvedTarget

  const recipientMock = {
    id: resolvedTarget?.id || '_provisional',
    name: resolvedTarget?.name || 'Recipient Asset',
    pin: resolvedTarget?.pin || 'PIN-0x················',
    dot: '—',
    owner: resolvedTarget?.owner || 'actor-unknown',
    artifactUri: null,
    artifact: null,
    provenance: null,
    date: new Date().toISOString().slice(0, 10),
    dateTime: new Date().toISOString(),
    _noHealth: true,
  }

  return (
    <>
      <style>{`
        @keyframes v3-disc-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes v3-spin { to { transform: rotate(360deg) } }
      `}</style>
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'v3-disc-fade 200ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: '95vw' }}>
          {/* Source node */}
          <div style={{ pointerEvents: 'none', flexShrink: 0 }}>
            <ObjectNodeFull obj={sourceObj} selected={true} />
          </div>

          {/* Edge: source → panel (dashed grey — pending) */}
          <svg width="40" height="2" style={{ flexShrink: 0 }}>
            <line x1="0" y1="1" x2="40" y2="1" stroke="#888" strokeWidth="2" strokeDasharray="6 5" />
          </svg>

          {/* Process panel */}
          <div style={{
            width: 520, flexShrink: 0,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column',
          }}>
            {submitted ? (
              <div style={{ padding: '48px 36px', textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 18px', border: '2px solid var(--accent-indigo)',
                }}>
                  <span style={{ fontSize: 22, color: 'var(--accent-indigo)' }}>↗</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Request Sent
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 20 }}>
                  Your connection request has been sent to the asset owner.<br />
                  They will be notified and can accept or decline.
                </div>
                <div style={{
                  padding: '12px 16px', borderRadius: 8,
                  background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)',
                  textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Recipient</span>
                    <span style={{ color: 'var(--text-primary)' }}>{resolvedTarget?.name} · {resolvedTarget?.org}</span>
                  </div>
                  {selectedReqSets.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Evaluation</span>
                      <span style={{ color: 'var(--text-primary)' }}>{selectedReqSets.length} requirement set{selectedReqSets.length !== 1 ? 's' : ''} attached</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Message</span>
                    <span style={{ color: 'var(--text-primary)' }}>{message.trim() ? 'Included' : 'None'}</span>
                  </div>
                </div>
                <button onClick={handleDone} style={{ ...primaryBtnStyle, marginTop: 20 }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Connect Asset</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {sourceObj.name} · {owner?.org}
                      </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                  </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
                  {/* 1. Recipient PIN */}
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>
                    RECIPIENT ASSET PIN
                  </div>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <input
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      placeholder="PIN-0x..."
                      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); e.target.blur() } }}
                      style={{
                        width: '100%', padding: '10px 40px 10px 12px',
                        fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
                        background: 'var(--bg-card, var(--bg-surface))',
                        border: `1px solid ${pinStatus === 'valid' ? 'var(--accent-green)' : (pinStatus === 'invalid' || pinStatus === 'duplicate') ? 'var(--accent-red)' : 'var(--border)'}`,
                        borderRadius: 6, outline: 'none', transition: 'border-color 200ms',
                      }}
                    />
                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12 }}>
                      {pinStatus === 'validating' && <span style={{ color: 'var(--text-dim)', display: 'inline-block', animation: 'v3-spin 1s linear infinite' }}>⟳</span>}
                      {pinStatus === 'valid' && <span style={{ color: 'var(--accent-green)' }}>✓</span>}
                      {(pinStatus === 'invalid' || pinStatus === 'duplicate') && <span style={{ color: 'var(--accent-red)' }}>✕</span>}
                    </div>
                  </div>
                  {pinStatus === 'valid' && resolvedTarget && (
                    <div style={{
                      padding: '8px 12px', borderRadius: 6, marginBottom: 16,
                      background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent-green) 15%, transparent)',
                      fontSize: 11, color: 'var(--text-secondary)',
                    }}>
                      Resolved: <strong style={{ color: 'var(--text-primary)' }}>{resolvedTarget.name}</strong> · {resolvedTarget.org}
                    </div>
                  )}
                  {pinError && (
                    <div style={{
                      padding: '8px 12px', borderRadius: 6, marginBottom: 16,
                      background: 'color-mix(in srgb, var(--accent-red) 6%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent-red) 15%, transparent)',
                      fontSize: 11, color: 'var(--accent-red)',
                    }}>
                      {pinError}
                    </div>
                  )}

                  {/* 2. Requirement Sets */}
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>
                    EVALUATION INTENT <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.6 }}>
                    Select requirement sets you intend to evaluate against this asset. The asset owner will see these in your request.
                  </div>
                  {requirementSets.length > 0 ? (
                    <div style={{
                      maxHeight: 160, overflow: 'auto', marginBottom: 16,
                      border: '1px solid var(--border)', borderRadius: 6,
                    }}>
                      {requirementSets.map((rs, i) => {
                        const selected = selectedReqSets.includes(rs.id)
                        return (
                          <div key={rs.id}
                            onClick={() => setSelectedReqSets(prev => selected ? prev.filter(id => id !== rs.id) : [...prev, rs.id])}
                            style={{
                              padding: '8px 12px', cursor: 'pointer',
                              borderBottom: i < requirementSets.length - 1 ? '1px solid var(--border)' : 'none',
                              display: 'flex', alignItems: 'center', gap: 10,
                              transition: 'background 100ms',
                              background: selected ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : 'transparent',
                            }}
                          >
                            <div style={{
                              width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                              border: `1.5px solid ${selected ? 'var(--accent-indigo)' : 'var(--border)'}`,
                              background: selected ? 'var(--accent-indigo)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 150ms',
                            }}>
                              {selected && <span style={{ fontSize: 9, color: '#fff' }}>✓</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{rs.name}</div>
                              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 1 }}>
                                {rs.requirements?.length || 0} requirements
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{
                      padding: '12px', borderRadius: 6, marginBottom: 16,
                      background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)',
                      fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
                    }}>
                      No requirement sets in your library. You can still connect without specifying evaluation intent.
                    </div>
                  )}

                  {/* 3. Message */}
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>
                    MESSAGE <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional)</span>
                  </div>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Include a message with your request..."
                    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); e.target.blur() } }}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px',
                      fontSize: 12, fontFamily: 'var(--font-display)',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-card, var(--bg-surface))',
                      border: '1px solid var(--border)',
                      borderRadius: 6, outline: 'none', resize: 'vertical', lineHeight: 1.6,
                    }}
                  />
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                  <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSend} disabled={!canSend}
                    style={{ ...primaryBtnStyle, opacity: canSend ? 1 : 0.4, cursor: canSend ? 'pointer' : 'default' }}>
                    Send Request →
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Edge: panel → recipient (dashed grey) */}
          <svg width="40" height="2" style={{ flexShrink: 0 }}>
            <line x1="0" y1="1" x2="40" y2="1"
              stroke={resolvedTarget ? '#888' : '#555'} strokeWidth="2" strokeDasharray="6 5"
              style={{ transition: 'all 400ms ease' }}
            />
          </svg>

          {/* Recipient node */}
          <div style={{
            opacity: resolvedTarget ? 0.8 : 0.4,
            transition: 'opacity 400ms ease',
            pointerEvents: 'none',
            filter: resolvedTarget ? 'none' : 'saturate(0)',
            flexShrink: 0,
          }}>
            <div style={{ border: resolvedTarget ? undefined : '1.5px dashed #888', borderRadius: 8 }}>
              <ObjectNodeFull obj={recipientMock} selected={false} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
