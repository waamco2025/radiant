import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import V2Canvas from './V2Canvas.jsx'
import V2SubgraphModal from './V2SubgraphModal.jsx'
import V2BootScreen from './V2BootScreen.jsx'
import PrimeRadiant from './PrimeRadiant.jsx'
import { ROLES, getDataForRole } from './v2Data.js'
import DetailPanel from '../components/DetailPanel/index.jsx'
import PublishModal from '../components/modals/PublishModal.jsx'
import RequestDisclosureModal from '../components/modals/RequestDisclosureModal.jsx'
import DisclosureResponseModal from '../components/modals/DisclosureResponseModal.jsx'
import CascadeModal from '../components/modals/CascadeModal.jsx'

const SESSION_KEY = 'radiant-v2-booted'

export default function V2App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('radiant-theme') || 'dark')
  const [roleId, setRoleId] = useState('bob-govco')
  const [sel, setSel] = useState(null)
  const [modalNode, setModalNode] = useState(null)

  const activeRole = ROLES.find(r => r.id === roleId) || ROLES[0]
  const { nodes, edges, nodeMap, pendingRequests, existingCascades } = useMemo(() => getDataForRole(roleId), [roleId])
  const [credits, setCredits] = useState(activeRole.credits)
  const [showCredits, setShowCredits] = useState(false)
  const [showAcct, setShowAcct] = useState(false)
  const [layerInfo, setLayerInfo] = useState({ depth: 0, anchorId: null })
  const canvasRef = useRef(null)
  const [publishNode, setPublishNode] = useState(null)
  const [connectNode, setConnectNode] = useState(null)
  const [responseRequest, setResponseRequest] = useState(null)
  const [showInbox, setShowInbox] = useState(false)
  const [dismissedReqs, setDismissedReqs] = useState([])
  const [cascadeContext, setCascadeContext] = useState(null)
  const inboxRef = useRef(null)

  const visibleRequests = pendingRequests.filter(r => !dismissedReqs.includes(r.id))
  const [glowIntensity, setGlowIntensity] = useState(0) // 0 = no glow, >0 = glow factor
  const [booted, setBooted] = useState(() => {
    const nav = performance.getEntriesByType?.('navigation')?.[0]
    if (nav?.type === 'reload') {
      sessionStorage.removeItem(SESSION_KEY)
      return false
    }
    return sessionStorage.getItem(SESSION_KEY) === '1'
  })

  const creditsRef = useRef(null)
  const acctRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('radiant-theme', theme)
  }, [theme])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (showCredits && creditsRef.current && !creditsRef.current.contains(e.target)) setShowCredits(false)
      if (showAcct && acctRef.current && !acctRef.current.contains(e.target)) setShowAcct(false)
      if (showInbox && inboxRef.current && !inboxRef.current.contains(e.target)) setShowInbox(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCredits, showAcct, showInbox])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  const handleGlowChange = useCallback((isGlowing, speedFactor) => {
    setGlowIntensity(isGlowing ? Math.min(speedFactor - 1, 3) / 3 : 0) // normalize 0-1
  }, [])

  const handleBootComplete = useCallback(() => {
    setBooted(true)
    sessionStorage.setItem(SESSION_KEY, '1')
  }, [])

  const handleSelect = useCallback((node) => {
    setSel(node.id)
  }, [])

  const handleCloseSel = useCallback(() => {
    setSel(null)
  }, [])

  const handleOpenSubgraph = useCallback((node) => {
    setModalNode(node)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalNode(null)
  }, [])

  const handleSwitchRole = useCallback((newRoleId) => {
    if (newRoleId === roleId) return
    setRoleId(newRoleId)
    setSel(null)
    setModalNode(null)
    const role = ROLES.find(r => r.id === newRoleId)
    if (role) setCredits(role.credits)
    setShowAcct(false)
    setDismissedReqs([])
  }, [roleId])

  // Detail Panel footer actions
  const handlePanelViewChain = useCallback(() => {
    if (sel && nodeMap[sel]) handleOpenSubgraph(nodeMap[sel])
  }, [sel, nodeMap, handleOpenSubgraph])

  const handlePanelExpandStack = useCallback(() => {
    if (sel && nodeMap[sel]) canvasRef.current?.dive(nodeMap[sel])
  }, [sel, nodeMap])

  const handlePanelSurface = useCallback(() => {
    canvasRef.current?.surface()
  }, [])

  const isAnchorSelected = layerInfo.depth > 0 && sel === layerInfo.anchorId

  const pillStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    height: 28,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    transition: 'border-color .2s',
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-deep)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-display)',
      overflow: 'hidden',
    }}>
      {/* Boot screen */}
      {!booted && <V2BootScreen onComplete={handleBootComplete} />}

      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        zIndex: 100,
        background: 'var(--bg-deep)',
      }}>
        {/* Left group: 3D radiant + RADIANT logotype */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div
            className="radiant-logo-hover"
            style={{
              lineHeight: 0,
              cursor: 'grab',
              padding: 4,
              borderRadius: '50%',
              boxShadow: glowIntensity > 0
                ? `0 0 ${14 + glowIntensity * 16}px ${4 + glowIntensity * 6}px rgba(212, 175, 55, ${0.3 + glowIntensity * 0.3}), 0 0 ${30 + glowIntensity * 20}px ${8 + glowIntensity * 10}px rgba(212, 175, 55, ${0.1 + glowIntensity * 0.15})`
                : undefined,
              transition: 'box-shadow 0.3s ease',
            }}
          >
            <PrimeRadiant size={36} fps={30} strutScale={1.8} brightness={0.2} interactive onGlowChange={handleGlowChange} />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
          }}>
            RADIANT
          </span>
        </div>

        {/* Right group: theme toggle + credits + user menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 16,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '2px 6px',
            }}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          {/* Notification inbox */}
          <div ref={inboxRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowInbox(v => !v); setShowCredits(false); setShowAcct(false) }}
              style={{
                ...pillStyle,
                color: visibleRequests.length > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)',
                position: 'relative',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = visibleRequests.length > 0 ? 'var(--accent-amber)' : 'var(--border-hover)' }}
              onMouseLeave={e => { if (!showInbox) e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 2.5-1.5 4-1.5 4h12s-1.5-1.5-1.5-4A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {visibleRequests.length > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--accent-amber)',
                  color: '#000', fontSize: 8, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                }}>{visibleRequests.length}</span>
              )}
            </button>

            {showInbox && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 0,
                zIndex: 200,
                minWidth: 300,
                maxWidth: 340,
                boxShadow: 'var(--shadow-dropdown)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.08em' }}>DISCLOSURE REQUESTS</div>
                </div>
                {visibleRequests.length === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
                    No pending requests
                  </div>
                ) : (
                  visibleRequests.map(req => (
                    <div
                      key={req.id}
                      onClick={() => {
                        const reqNode = req.asset?.pin ? Object.values(nodeMap).find(n => n.pin === req.asset.pin) : null
                        setResponseRequest(reqNode ? { ...req, node: reqNode } : req)
                        setShowInbox(false)
                      }}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: 'var(--accent-indigo)',
                          fontFamily: 'var(--font-mono)', flexShrink: 0,
                        }}>{req.from.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{req.from.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{req.date}</div>
                        </div>
                        <span style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                          color: req.requestedLevel === 'full' ? '#6b8aff' : '#fbbf24',
                          padding: '2px 6px',
                          background: req.requestedLevel === 'full'
                            ? 'color-mix(in srgb, #6b8aff 10%, transparent)'
                            : 'color-mix(in srgb, #fbbf24 10%, transparent)',
                          borderRadius: 4,
                        }}>
                          {req.requestedLevel === 'full' ? 'FULL' : 'SELECTIVE'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 30 }}>
                        {req.asset.name}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Credits pill */}
          <div ref={creditsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowCredits(v => !v); setShowAcct(false) }}
              style={{
                ...pillStyle,
                color: 'var(--accent-indigo)',
                fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <span style={{ fontSize: 13 }}>◇</span>
              {credits}
              <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 400 }}>credits</span>
            </button>

            {/* Credits dropdown */}
            {showCredits && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 0,
                zIndex: 200,
                minWidth: 220,
                boxShadow: 'var(--shadow-dropdown)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', marginBottom: 6 }}>CREDIT BALANCE</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)' }}>{credits}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>credits remaining</span>
                  </div>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  <button
                    onClick={() => setCredits(c => c + 100)}
                    style={{
                      width: '100%',
                      padding: '7px 0',
                      background: 'var(--accent-indigo)',
                      border: 'none',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'opacity .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                  >
                    + Add 100 Credits
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={acctRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowAcct(v => !v); setShowCredits(false) }}
              style={{
                ...pillStyle,
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { if (!showAcct) e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#6366f1,#818cf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--text-bright)',
              }}>{activeRole.user[0]}</div>
              <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeRole.user}</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>▾</span>
            </button>

            {/* Account dropdown */}
            {showAcct && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 0,
                zIndex: 200,
                minWidth: 240,
                boxShadow: 'var(--shadow-dropdown)',
                overflow: 'hidden',
              }}>
                {/* Current user header */}
                <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#6366f1,#818cf8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-bright)',
                      flexShrink: 0,
                    }}>{activeRole.user[0]}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-bright)' }}>{activeRole.user}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{activeRole.party}</div>
                    </div>
                  </div>
                </div>

                {/* Role switching */}
                <div style={{ padding: '6px 0' }}>
                  <div style={{ padding: '4px 14px 6px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em' }}>SWITCH USER</div>
                  {ROLES.map(r => {
                    const isCurrent = r.id === roleId
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleSwitchRole(r.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 14px',
                          cursor: isCurrent ? 'default' : 'pointer',
                          background: isCurrent ? 'rgba(99,102,241,.08)' : 'transparent',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: isCurrent ? 'linear-gradient(135deg,#6366f1,#818cf8)' : 'var(--bg-raised)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 700,
                          color: isCurrent ? 'var(--text-bright)' : 'var(--text-tertiary)',
                        }}>{r.user[0]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: isCurrent ? 'var(--accent-indigo-text)' : 'var(--text-primary)' }}>{r.user}</div>
                          <div style={{ fontSize: 9, color: isCurrent ? 'var(--accent-indigo)' : 'var(--text-muted)' }}>{r.party} · {r.role}</div>
                        </div>
                        {isCurrent && <span style={{ fontSize: 8, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>ACTIVE</span>}
                      </div>
                    )
                  })}
                </div>

                {/* Account actions */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                  {[
                    { icon: '⚙', label: 'Account Settings' },
                    { icon: '☰', label: 'Preferences' },
                    { icon: '↗', label: 'Logout' },
                  ].map(a => (
                    <div
                      key={a.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 14px',
                        cursor: 'default',
                        opacity: 0.4,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 16, textAlign: 'center' }}>{a.icon}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{a.label}</span>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>COMING SOON</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <V2Canvas
          ref={canvasRef}
          key={roleId}
          nodes={nodes}
          edges={edges}
          nodeMap={nodeMap}
          selectedId={sel}
          onSelect={handleSelect}
          onCloseSel={handleCloseSel}
          onOpenSubgraph={handleOpenSubgraph}
          modalOpen={!!modalNode}
          panelWidth={sel && nodeMap[sel] && nodeMap[sel].category !== 'party' ? 480 : 0}
          onLayerChange={setLayerInfo}
          onConnect={(node) => setConnectNode(node)}
          onDisclose={(node) => setPublishNode(node)}
        />

        {/* Detail Panel overlay */}
        {sel && nodeMap[sel] && nodeMap[sel].category !== 'party' && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 480,
            zIndex: 50,
            animation: 'detail-panel-slide-in 200ms ease',
          }}>
            <DetailPanel
              node={nodeMap[sel]}
              onClose={handleCloseSel}
              onViewChain={handlePanelViewChain}
              onExpandStack={handlePanelExpandStack}
              onSurface={handlePanelSurface}
              onPinToSurface={() => console.log('Pin to surface:', sel)}
              isAnchor={isAnchorSelected}
              depth={layerInfo.depth}
              onDisclose={() => sel && nodeMap[sel] && setPublishNode(nodeMap[sel])}
              onConnect={() => sel && nodeMap[sel] && setConnectNode(nodeMap[sel])}
              onManageCascade={(sda) => sel && nodeMap[sel] && setCascadeContext({ node: nodeMap[sel], sda })}
              isOwner={nodeMap[sel]?.owner === activeRole.party}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg-deep)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent-green, #22c55e)',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--accent-green, #22c55e)',
            letterSpacing: '0.04em',
          }}>
            Connected to AWS S3
          </span>
          <span style={{ margin: '0 8px', color: 'var(--border)' }}>·</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            {activeRole.vertical}
          </span>
        </div>
        <a
          href="/index.html"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            textDecoration: 'none',
          }}
        >
          v1
        </a>
      </div>

      {/* SubgraphModal */}
      {modalNode && (
        <V2SubgraphModal node={modalNode} onClose={handleCloseModal} />
      )}

      {/* Disclosure modals */}
      {publishNode && (
        <PublishModal node={publishNode} onClose={() => setPublishNode(null)} />
      )}
      {connectNode && (
        <RequestDisclosureModal contextNode={connectNode} onClose={() => setConnectNode(null)} />
      )}
      {responseRequest && (
        <DisclosureResponseModal request={responseRequest} onClose={() => {
          setDismissedReqs(prev => [...prev, responseRequest.id])
          setResponseRequest(null)
        }} />
      )}
      {cascadeContext && (
        <CascadeModal
          node={cascadeContext.node}
          sda={cascadeContext.sda}
          existingCascades={existingCascades || []}
          onClose={() => setCascadeContext(null)}
        />
      )}
    </div>
  )
}
