import { useState, useCallback, useEffect } from 'react'
import { BTN_H, SDA_CONFIG, REVOKE_WARNINGS } from './constants'
import GridRow from './shared/GridRow'
import ClaimsTable from './shared/ClaimsTable'
import { TableActions, claimsToCSV } from './shared/TableActions'
import TableModal from './shared/TableModal'
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

function ProofOnlyEvalDisplay({ evals }) {
  const [expandedEval, setExpandedEval] = useState(null)
  const [modalEval, setModalEval] = useState(null)

  if (!evals || evals.length === 0) {
    return (
      <div style={{ marginTop: 8 }}>
        <GridRow label="POE" value={
          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: 11 }}>No evaluations attached</span>
        } />
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
        color: 'var(--accent-green)', letterSpacing: '0.05em', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>✓</span>
        PROOF OF EVALUATION · {evals.length}
      </div>

      {evals.map((ev, ei) => {
        const isExpanded = expandedEval === ei
        const ok = ev.satisfied || 0
        const bad = ev.unsatisfied || 0
        const miss = ev.missing || 0

        return (
          <div key={ev.id || ei} style={{
            background: 'var(--bg-deep)',
            borderRadius: 6,
            border: '1px solid var(--border)',
            marginBottom: 6,
            overflow: 'hidden',
          }}>
            <div
              onClick={() => setExpandedEval(isExpanded ? null : ei)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', cursor: 'pointer',
                background: isExpanded ? 'var(--bg-raised)' : 'transparent',
                transition: 'background 150ms',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{ev.org}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  <span style={{ color: 'var(--accent-green)' }}>{ok}</span>
                  {bad > 0 && <span style={{ color: 'var(--accent-red)' }}> · {bad}</span>}
                  {miss > 0 && <span style={{ color: 'var(--text-dim)' }}> · {miss}</span>}
                </span>
                <TableActions
                  onExpand={() => setModalEval(ev)}
                  onDownload={() => claimsToCSV(ev.claims, `${ev.name}-poe.csv`)}
                />
                <Chev open={isExpanded} />
              </div>
            </div>

            {isExpanded && ev.claims && ev.claims.length > 0 && (
              <div style={{ padding: '4px 12px 10px' }}>
                {ev.date && (
                  <div style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                    marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)',
                  }}>
                    Evaluated {ev.date}
                  </div>
                )}
                <ClaimsTable claims={ev.claims} proofOnly />
              </div>
            )}
          </div>
        )
      })}
      {modalEval && (
        <TableModal title={`${modalEval.name} — Proof of Evaluation`} onClose={() => setModalEval(null)}>
          <ClaimsTable claims={modalEval.claims} maxHeight={9999} proofOnly />
        </TableModal>
      )}
    </div>
  )
}

export default function DisclosuresTab({ sdas, onDisclose, node, onManageCascade, isOwner, onSelectAsset, onRevokeSda, onReviseSda, nodes }) {
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
                {sda.selectedEvidenceIds && sda.selectedEvidenceIds.length > 0 && sda.partyLabel !== 'internal' && (
                  <GridRow label="Evidence" value={
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11, color: 'var(--accent-orange, #fb923c)' }}>
                      {sda.selectedEvidenceIds.length} document{sda.selectedEvidenceIds.length !== 1 ? 's' : ''}
                    </span>
                  } />
                )}
                {sda.type === 'selective' && sda.selectedFieldIds && sda.selectedFieldIds.length > 0 && sda.partyLabel !== 'internal' && (
                  <GridRow label="Fields" value={
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11, color: 'var(--accent-amber)' }}>
                      {sda.selectedFieldIds.length} field{sda.selectedFieldIds.length !== 1 ? 's' : ''} disclosed
                    </span>
                  } />
                )}
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
                {sda.pins && <GridRow label="PINs" value={sda.pins.length === 0 ? <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: 11 }}>No assets</span> : `${sda.pins.length} asset${sda.pins.length !== 1 ? 's' : ''}`} />}

                {/* Disclosed evidence */}
                {sda.selectedEvidenceIds && sda.selectedEvidenceIds.length > 0 && sda.partyLabel !== 'internal' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: 'var(--accent-orange, #fb923c)', letterSpacing: '0.05em',
                      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 12 }}>&#9703;</span>
                      DISCLOSED EVIDENCE &middot; {sda.selectedEvidenceIds.length}
                    </div>
                    <div style={{
                      borderRadius: 6, overflow: 'hidden',
                      border: '1px solid var(--border)', background: 'var(--bg-deep)',
                    }}>
                      {sda.selectedEvidenceIds.map((evId, ei) => {
                        const evNode = node?.children?.find(c => c.id === evId)
                          || (nodes || []).flatMap(n => n.children || []).find(c => c.id === evId)
                        return (
                          <div key={evId} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px',
                            borderBottom: ei < sda.selectedEvidenceIds.length - 1 ? '1px solid var(--border)' : 'none',
                          }}>
                            <span style={{
                              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              padding: '2px 5px', borderRadius: 3,
                              background: 'color-mix(in srgb, var(--accent-orange, #fb923c) 12%, transparent)',
                              color: 'var(--accent-orange, #fb923c)', flexShrink: 0,
                            }}>EV</span>
                            <span style={{
                              flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {evNode?.name || evNode?.evidence?.filename || evId}
                            </span>
                            {evNode?._isParsed && (
                              <span style={{
                                fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                                color: 'var(--accent-green)', flexShrink: 0,
                              }}>PARSED</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Disclosed fields (selective) */}
                {sda.type === 'selective' && sda.selectedFieldIds && sda.selectedFieldIds.length > 0 && sda.partyLabel !== 'internal' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: 'var(--accent-amber)', letterSpacing: '0.05em',
                      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 12 }}>&#8862;</span>
                      DISCLOSED FIELDS &middot; {sda.selectedFieldIds.length}
                    </div>
                    <div style={{
                      borderRadius: 6, overflow: 'hidden',
                      border: '1px solid var(--border)', background: 'var(--bg-deep)',
                      maxHeight: 200, overflowY: 'auto',
                    }}>
                      {sda.selectedFieldIds.map((fieldKey, fi) => {
                        const [parseNodeId, fieldId] = fieldKey.split('::')
                        const parseNode = node?.children?.find(c => c.id === parseNodeId)
                          || (nodes || []).flatMap(n => n.children || []).find(c => c.id === parseNodeId)
                        const field = parseNode?.parsedFields?.find(f => f.id === fieldId)
                        return (
                          <div key={fieldKey} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '5px 10px',
                            borderBottom: fi < sda.selectedFieldIds.length - 1 ? '1px solid var(--border)' : 'none',
                          }}>
                            <span style={{ width: 120, flexShrink: 0, fontSize: 10, color: 'var(--text-dim)' }}>
                              {field?.name || fieldId}
                            </span>
                            <span style={{
                              flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {field?.value || '\u2014'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {sda.type === 'proofonly' && (
                  <ProofOnlyEvalDisplay evals={sda.selectedEvals} />
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isOwner && sda.partyLabel !== 'internal' && sda.party !== 'Radiant Network' && sda._isGrantor && (
                            <Btn label="Revise SDA" accent onClick={() => onReviseSda && onReviseSda({ sda, nodeId: node?.id })} />
                          )}
                          <Btn label={isSelfSda ? 'Remove from Network' : 'Revoke SDA'} onClick={() => setRev(i)} />
                        </div>
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

    </div>
  )
}
