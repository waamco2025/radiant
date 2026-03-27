import { useState, useCallback, useEffect } from 'react'
import { BTN_H, SDA_CONFIG, REVOKE_WARNINGS } from './constants'
import GridRow from './shared/GridRow'
import CopyBadge from './shared/CopyBadge'
import SDABadge from './shared/SDABadge'
import { Tip } from './shared/Tooltip'

function Chev({ open }) {
  return (
    <span style={{
      fontSize: 20, color: 'var(--text-tertiary)',
      transition: 'transform 180ms ease',
      transform: open ? 'rotate(90deg)' : 'rotate(0)',
      display: 'inline-block', marginLeft: 2,
    }}>▸</span>
  )
}

function TinyBtn({ icon, tip, onClick }) {
  return (
    <Tip text={tip}>
      <span
        onClick={e => { e.stopPropagation(); onClick && onClick() }}
        style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
          cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
          transition: 'color 150ms, background 150ms',
        }}
        onMouseEnter={e => { e.target.style.color = 'var(--text-primary)'; e.target.style.background = 'var(--bg-raised)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-tertiary)'; e.target.style.background = 'transparent' }}
      >
        {icon}
      </span>
    </Tip>
  )
}

function Btn({ label, onClick, accent, style: sx }) {
  const [h, setH] = useState(false)
  const c = accent ? 'var(--accent-indigo)' : 'var(--text-secondary)'
  const bc = accent ? 'color-mix(in srgb, var(--accent-indigo) 40%, transparent)' : 'var(--border)'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: BTN_H, padding: '0 14px', borderRadius: 5,
        border: `1px solid ${h ? 'var(--border-hover)' : bc}`,
        background: h ? (accent ? 'color-mix(in srgb, var(--accent-indigo) 7%, transparent)' : 'var(--bg-raised)') : 'transparent',
        color: c, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500,
        cursor: 'pointer', transition: 'all 180ms', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(sx || {}),
      }}
    >
      {label}
    </button>
  )
}

function ChainIcon({ s = 13, c = 'var(--accent-purple)' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6.5 9.5l3-3" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 7l2.5-2.5a1.5 1.5 0 00-2.12-2.12L7 4.75" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 9l-2.5 2.5a1.5 1.5 0 002.12 2.12L9 11.25" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export default function DisclosuresTab({ sdas, onDisclose, node, onManageCascade, isOwner, onSelectAsset, onRevokeSda }) {
  const [allOpen, setAllOpen] = useState(false)
  const [exp, setExp] = useState(null)
  const [rev, setRev] = useState(null)
  const [revokeMessage, setRevokeMessage] = useState('')

  // Reset expand/revoke state when switching nodes
  useEffect(() => {
    setExp(null)
    setRev(null)
    setRevokeMessage('')
    setAllOpen(false)
  }, [node?.id])

  const toggleAll = useCallback((open) => {
    setAllOpen(open)
    if (!open) { setExp(null); setRev(null) }
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7, flex: 1 }}>Active disclosure agreements.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TinyBtn icon="⊞" tip="Expand all" onClick={() => toggleAll(true)} />
          <TinyBtn icon="⊟" tip="Collapse all" onClick={() => toggleAll(false)} />
        </div>
      </div>

      {sdas.map((sda, i) => {
        const s = SDA_CONFIG[sda.type] || SDA_CONFIG.full
        const o = allOpen || exp === i
        const isRevoking = rev === i
        const w = REVOKE_WARNINGS[sda.type]

        return (
          <div key={i} style={{
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            marginBottom: 10,
          }}>
            {/* Header */}
            <div
              onClick={() => {
                if (allOpen) { setAllOpen(false); setExp(o ? null : i) }
                else { setExp(o ? null : i) }
                if (o) setRev(null)
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', cursor: 'pointer',
                borderRadius: o ? '8px 8px 0 0' : '8px',
                background: o ? 'var(--bg-raised)' : 'transparent',
                transition: 'background 150ms',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <SDABadge type={sda.type} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{sda.party}</span>
                {sda.partyLabel && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{sda.partyLabel}</span>}
                {sda.assetName && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>&middot;&nbsp;</span>
                    <Tip text={sda.assetName}>
                      <span style={{
                        fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 160, cursor: 'default',
                        borderBottom: '1px dashed transparent',
                        transition: 'border-color 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'color-mix(in srgb, var(--text-dim) 40%, transparent)'}
                      onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
                      >
                        {sda.assetName}
                      </span>
                    </Tip>
                  </span>
                )}
              </div>
              <Chev open={o} />
            </div>

            {/* Body */}
            {o && (
              <div style={{ padding: '6px 14px 16px' }}>
                <GridRow label="Created" value={sda.created} />
                <GridRow label="Expires" value={sda.expires || 'Never'} />
                <GridRow label="Disclosure type" value={
                  <Tip text={s.permTip} w={240}>
                    <span style={{
                      color: s.color, fontFamily: 'var(--font-mono)', fontSize: 11,
                      cursor: 'default',
                      borderBottom: `1px dashed color-mix(in srgb, ${s.color} 30%, transparent)`,
                    }}>{s.label}</span>
                  </Tip>
                } />
                {sda.partyLabel !== 'internal' && (
                  <GridRow label="Connected asset" value={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {(sda.assetName || node?.name) && (
                        <span
                          onClick={e => {
                            e.stopPropagation()
                            if (onSelectAsset && sda.assetPin) onSelectAsset(sda.assetPin)
                          }}
                          style={{
                            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
                            cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', maxWidth: 120, flexShrink: 1,
                            borderBottom: '1px solid transparent', transition: 'border-color 150ms',
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--accent-indigo)'}
                          onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
                        >
                          {sda.assetName || node?.name}
                        </span>
                      )}
                      <CopyBadge value={sda.assetPin || node?.pin} truncated />
                    </div>
                  } />
                )}
                {sda.pins && <GridRow label="PINs" value={`${sda.pins.length} asset${sda.pins.length > 1 ? 's' : ''}`} />}
                {sda.type === 'proofonly' && (
                  <>
                    <GridRow label="POE" value={'✓ ' + sda.poeResult} vc="var(--accent-green)" />
                    <GridRow label="Source eval" value={sda.evalRef} />
                  </>
                )}

                {/* Cascade chain */}
                {sda.type === 'cascade' && sda.chain && (
                  <div style={{
                    marginTop: 14, padding: '12px 14px',
                    background: 'color-mix(in srgb, var(--accent-purple) 4%, transparent)',
                    borderRadius: 6,
                    border: '1px solid color-mix(in srgb, var(--accent-purple) 15%, transparent)',
                  }}>
                    <div style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: 'var(--accent-purple)', letterSpacing: '0.04em',
                      marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <ChainIcon s={13} c="var(--accent-purple)" />
                      CASCADE CHAIN
                    </div>
                    {sda.chain.map((hop, hi) => (
                      <div key={hi} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: hi < sda.chain.length - 1 ? 8 : 0,
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: 'color-mix(in srgb, var(--accent-purple) 12%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--accent-purple) 30%, transparent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)',
                          fontWeight: 700, flexShrink: 0,
                        }}>{hi + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{hop.from} → {hop.to}</div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 2 }}>{hop.sdaType} · {hop.status}</div>
                        </div>
                        {hi < sda.chain.length - 1 && <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>↓</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Manage cascade */}
                {node?.upstreamAssets?.some(a => a.upstreamSda) && (
                  <div style={{ marginTop: 10 }}>
                    <Btn
                      label="⛓ Manage Cascading Disclosures"
                      onClick={() => onManageCascade && onManageCascade(sda)}
                      style={{ color: 'var(--accent-purple)', borderColor: 'color-mix(in srgb, var(--accent-purple) 40%, transparent)' }}
                    />
                  </div>
                )}

                {/* Revoke flow */}
                {(() => {
                  const isSelfSda = sda.partyLabel === 'internal' || sda.party === node?.owner
                  const warning = isSelfSda
                    ? { title: '⚠ Remove from network?', message: `This will revoke all disclosures to ${node?.name || 'this asset'} and remove it from your network. All disclosure parties will be notified. This action is recorded on-chain and cannot be undone.` }
                    : w

                  return (
                    <div style={{ marginTop: 14 }}>
                      {!isRevoking ? (
                        <Btn label={isSelfSda ? 'Remove from Network' : 'Revoke SDA'} onClick={() => setRev(i)} />
                      ) : (
                        <div>
                          {/* Warning box — always shown, above actions */}
                          {warning && (
                            <div style={{
                              marginBottom: 12, padding: '12px 14px',
                              background: 'color-mix(in srgb, var(--accent-red) 4%, transparent)',
                              borderRadius: 6,
                              border: '1px solid color-mix(in srgb, var(--accent-red) 12%, transparent)',
                            }}>
                              <div style={{
                                fontSize: 12, color: 'var(--accent-amber)',
                                fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: 5,
                              }}>{warning.title}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{warning.message}</div>
                            </div>
                          )}

                          {/* Optional message for external SDAs */}
                          {!isSelfSda && (
                            <div style={{ marginBottom: 10 }}>
                              <textarea
                                value={revokeMessage}
                                onChange={e => setRevokeMessage(e.target.value)}
                                placeholder="Optional message to the other party..."
                                rows={2}
                                style={{
                                  width: '100%', padding: '8px 10px', borderRadius: 6,
                                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                                  color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
                                  fontSize: 11, resize: 'none', outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </div>
                          )}

                          {/* Action buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              onClick={() => {
                                if (onRevokeSda) {
                                  onRevokeSda({ sda, nodeId: node?.id, message: revokeMessage })
                                }
                                setRev(null)
                                setRevokeMessage('')
                              }}
                              style={{
                                height: BTN_H - 2,
                                background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
                                border: '1px solid var(--accent-red)',
                                borderRadius: 5, padding: '0 12px', fontSize: 11,
                                fontFamily: 'var(--font-mono)', fontWeight: 600,
                                color: 'var(--accent-red)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isSelfSda ? 'Confirm Removal' : 'Confirm Revocation'}
                            </button>
                            <button
                              onClick={() => { setRev(null); setRevokeMessage('') }}
                              style={{
                                height: BTN_H - 2,
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: 5, padding: '0 12px', fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-tertiary)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )
      })}

      {!node?.isEvidence && isOwner && (
        <div style={{ marginTop: 12 }}>
          <Btn label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
            </svg>
            Publish this Asset
          </span>} accent onClick={onDisclose} />
        </div>
      )}
    </div>
  )
}
