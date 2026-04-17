import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import V3BootScreen from './V3BootScreen.jsx'
import V3Canvas from './V3Canvas.jsx'
import PrimeRadiant from '../v2/PrimeRadiant.jsx'
import { actors, getVisibleEdges, getVisibleObjects, addObject, addEdge, resetDynamicData } from './v3Data.js'
import DetailPanel, { PANEL_W } from './DetailPanel.jsx'
import ParseFlow from './ParseFlow.jsx'
import EvalFlow from './EvalFlow.jsx'
import DiscloseFlow from './DiscloseFlow.jsx'
import LibraryModal from './LibraryModal.jsx'
import { getParseTemplatesForActor } from './parseTemplates.js'
import { getRequirementSetsForActor } from './requirementSets.js'
import { getPublishedStandards } from './publishedStandards.js'

const ROLES = [
  { id: 'bob', actorId: 'actor-bob' },
  { id: 'alice', actorId: 'actor-alice' },
]

const CHANGELOG = [
  { version: '3.0.0', date: '2026-04-09', label: 'V3 Batch 1–3', items: [
    'V3 scaffold — Actor + Object data model, provenance-based relationships, artifact-aware rendering',
    'Three.js canvas with orthographic camera, dot grid, pan/zoom, momentum scrolling',
    'ObjectNode — universal node card (full, mini, dot LOD tiers)',
    'Boot sequence — CAC login, Prime Radiant 3D, golden ripple, network build animation',
    'Role switching via user menu dropdown (no boot replay)',
    'Health minibars derived from evaluation-schema artifacts in child objects',
    'Provenance edges (bezier curves) and disclosure edges between actors',
    'Zoom controls with +/−/FIT and percentage readout',
    'Dot grid snapping for all node positions',
    'Header bar: Prime Radiant logo, credits menu, notifications, requirements library button',
    'Footer bar with QS connection indicator and changelog',
    'Disclosure type legend with hover tooltips',
    'Header button reorder: Theme, Notifications, Library, Credits, User Menu',
    'Disclosure type legend matches V2 — horizontal, four types (Full, Selective, Proof-only, Provisional)',
    'Actor nodes on canvas — GovCo/MicroCo rendered as rounded-square party cards',
    'Disclosure edge topology matching V2 — object-to-object connections with SDA type styling',
    'V2-style card treatment — schema-based tints (blue product, purple parse, indigo eval, amber disclosure)',
    'Manual layout positions per role matching V2 spatial arrangement',
    'Bob Donloe rename (was Bob Chen)',
    'Removed gold left border on disclosed nodes — replaced with V2 card styling',
    'Single edge system — removed separate provenance edge rendering, all connections are disclosure edges',
    'Uniform node cards — removed category labels (PRODUCT/PARSE/EVALUATION), icons, and schema-based color tints',
    'Actors rendered as standard object nodes (GovCo, MicroCo)',
    'Edge hover tooltips — raycaster-based hover shows disclosure type, label, and connected nodes',
    'Fixed duplicate/overlapping edges between parent and child nodes',
    'Fixed duplicate disclosure edges — deduplicated by node pair per actor perspective',
    'Detail panel — Overview tab with identity, provenance, connections, and children sections',
    'Detail panel — Artifact tab with schema-aware JSON display (parse fields, eval requirements, disclosure terms)',
    'Removed isDisclosed prop remnants from node cards',
    'Fixed zoom controls closing detail panel (click propagation guard)',
    'Action buttons on selected nodes — Parse, Evaluate, Disclose (placeholder handlers)',
    'Detail panel footer with contextual action buttons',
    'Clickable children and connections in detail panel — navigates to node with pan animation',
    'Detail panel connections now filtered by actor visibility — no phantom edges to unseen nodes',
    'Detail panel slide-in animation on open',
    'Auto-pan to selected node on click (offset for panel width)',
    'Node card hover effects (border highlight, subtle shadow)',
    'Detail panel tab resets to Overview when selecting a different node',
    'Removed PIN and date from node cards — moved to detail panel only',
    'Fixed card dimensions (220x72) — uniform size with or without health minibar',
    'Minibar stats reformatted to compact "N · N" (green · red) right-aligned',
    'Detail panel expanded evaluation summaries — "N satisfactory · N unsatisfactory" with hover tooltips',
    'Reduced auto-pan offset for better centering with panel open',
    'Chain highlighting — selecting a node dims non-chain nodes to 25% opacity',
    'Edge animation — solid chain edges pulse, dashed chain edges march',
    'Non-chain edges dim to 8% opacity when a node is selected',
    'Eval result nodes show their own SAT/UNSAT health minibar',
    'Minibar stats moved inline with bar (right side, same row)',
    'Improved node spacing to reduce card overlap',
    'Fixed edge chain dimming — removed rebuild dependency on selection, dimming persists across zoom/theme changes',
    'Parse process flow — orchestrated visual story: source node, process panel, provisional output, confirmation',
    'Template selection with field preview and credit cost',
    'Prime Radiant processing spinner with progress bar',
    'Parse results display with fields grouped by category and confidence badges',
    'Immutability confirmation step before registering parse output',
    'Dynamic node/edge creation — new parse results appear on canvas immediately',
    'Parse templates stored per-actor in parseTemplates.js',
    'Full parent names on output nodes (e.g., "TH-400 Thermal Sensor Parse Result")',
    'Parse flow layout polish — fixed panel dimensions, proper scrollbox scoping, centered vertically',
    'Source and output cards in parse flow use same ObjectNodeFull component as canvas',
    'Template dropdown portaled above panel (not clipped by overflow)',
    'Fixed canvas not showing dynamically created nodes (stale useMemo dependency)',
    'Fixed parse flow panel maintaining consistent height across all stages',
    'Parse completion opens detail panel to Artifact tab',
    'Duplicate template prevention — already-parsed templates disabled in dropdown',
    'Parse flow panel height increased to 512px with footer pinned to bottom',
    'Realistic template fields — instruction, format, and required flag on every extraction field',
    'Template context field — document type hints shown during template selection',
    'Enriched field tables — instruction text, format badge, category badge, required indicator',
    'Enriched results table — extracted value prominent with instruction reference for verification',
    'Parse flow panel widened to 620px for instruction text',
    'Description and context moved into scrollbox for more field list space',
    'Required field legend (* required) shown inline with section headers',
    'Description and context in dark bordered boxes matching field table styling',
    'Increased vertical padding in field and result rows for readability',
    'Evaluate process flow — mirrors parse flow with SAT/UNSAT review stage',
    'Requirement sets with instruction, criterion, format, and required fields',
    'AI-suggested SAT/UNSAT with toggleable human override in review stage',
    'Live SAT/UNSAT summary updates as user toggles assessments',
    'Evaluator owns eval results (Bob can evaluate Alice\'s objects, owns the output)',
    'Standardized eval output names to "{Parent Name} Evaluation"',
    'Split-panel eval review — evidence viewer on left, human review form on right (1100px)',
    'Four-state assessment cycle — SAT, UNSAT, MISSING, N/A with chevron cycling',
    'Editable extracted values in eval review — click to edit, Enter to confirm, Esc to cancel',
    'N/A requirements excluded from evaluation output artifact',
    'Mock evidence viewer with document placeholder in left panel',
    'Minibar draw animation on evaluation output card at confirm stage',
    'Status badge clickable to cycle forward, larger chevron buttons',
    'Permanently editable extracted values in eval review (always-visible input)',
    'Escape key blurs focused input without closing modal',
    'Parent node minibar previews pending eval results on confirm stage',
    'Three-segment minibar — green SAT, grey MISSING, red UNSAT',
    'Eval artifacts store status string (sat/unsat/missing) alongside boolean for three-state health tracking',
    'Health functions aggregate missing counts from child evaluations',
    'Detail panel header shows minibar for eval output nodes (own artifact health)',
    'Unified requirements table in Artifact tab — status badges, detail text inline, summary below',
    'Expanded eval modal with Results table and JSON tabs',
    'Parse/eval artifact parity — both store id, name, instruction, value, confidence per item',
    'Unified ArtifactRow component renders parse and eval items identically',
    'ExpandedArtifactModal works for both parse and eval with Results + JSON tabs',
    'Expand button uses outward-arrow icon (no label)',
    'Renamed eval detail to value for consistency with parse fields',
    'Fixed expand modal setter name mismatch',
    'Removed timestamp from panel header — shown in provenance section instead',
    'Universal provenance section — root nodes show "Registration" process with org name',
    'Clickable "Derived from" in provenance navigates to parent node',
    'Renamed table sections to "Results" for both parse and eval',
    'Template row shows owner org alongside template name',
    'Enriched all static parse artifacts — id, name, instruction, value, confidence per field',
    'Enriched all static eval artifacts — instruction, criterion, value, confidence per requirement',
    'Template names match actual requirement set and parse template names',
    'Parse results split panel — evidence viewer on left, extracted fields on right (1100px)',
    'Library modal — unified browser for parse templates, requirement sets, and published standards',
    'Three tabs: Parse Templates, Requirement Sets, Published Standards',
    'View details with version history, metadata, and field/requirement listings',
    'Create and version templates and requirement sets with editor form',
    'Published standards: OSHA, NIST SP 800-171, ISO 9001:2015 as demo data',
    'Library-created templates available in parse and eval flows',
    'Disclosure request flow — horizontal layout with source node, process panel, and recipient node',
    'PIN resolution with validation indicator (validating, valid, invalid)',
    'Three disclosure types: Full, Selective, Proof-Only with visual card selection',
    'Scope toggle for including derivatives, duration selection (1yr/2yr/none)',
    'Request sent confirmation with summary, disclosure agreement object + edge created',
    'Connect Asset flow — requester sends PIN + evaluation intent + message',
    'Disclosure type, scope, and terms deferred to responder (future batch)',
    'Duplicate detection: prevents requesting to already-connected assets',
    'Requirement set picker with checkbox selection',
    'Pending edge type renders as grey dashed on canvas',
    'Edge-aware fallback positioning for disclosed assets (placed to right of connected node)',
    'Disclosure flow "Done" button replaces auto-close timer on request sent',
    'BFS stops at pending targets — downstream children stay hidden until disclosure accepted',
    'Pending nodes show no minibar (health data hidden)',
    'Pending edge tooltip shows "Pending — Awaiting Response"',
  ]},
]

export default function V3App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('radiant-v3-theme') || 'dark')
  const [role, setRole] = useState('bob')
  const [phase, setPhase] = useState('login')
  const [selectedObjectId, setSelectedObjectId] = useState(null)
  const [glowIntensity, setGlowIntensity] = useState(0)
  const [parseTarget, setParseTarget] = useState(null)
  const [evalTarget, setEvalTarget] = useState(null)
  const [discloseTarget, setDiscloseTarget] = useState(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [customTemplates, setCustomTemplates] = useState([])
  const [customReqSets, setCustomReqSets] = useState([])

  const [dataVersion, setDataVersion] = useState(0)
  const [forceTab, setForceTab] = useState(null)

  // Dropdowns
  const [showAcct, setShowAcct] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showInbox, setShowInbox] = useState(false)
  const acctRef = useRef(null)
  const creditsRef = useRef(null)
  const inboxRef = useRef(null)

  // Credits
  const [credits, setCredits] = useState(1000)

  // Footer
  const [showFooterTip, setShowFooterTip] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const footerTipRef = useRef(null)

  const canvasRef = useRef(null)

  const actorId = ROLES.find(r => r.id === role).actorId
  const actor = actors.find(a => a.id === actorId)

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('radiant-v3-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  // Prime Radiant glow
  const handleGlowChange = useCallback((isGlowing, speedFactor) => {
    setGlowIntensity(isGlowing ? Math.min(speedFactor - 1, 3) / 3 : 0)
  }, [])

  // Role switch — no boot replay
  const switchRole = useCallback((newRoleId) => {
    setSelectedObjectId(null)
    setParseTarget(null)
    setEvalTarget(null)
    setDiscloseTarget(null)
    setShowLibrary(false)
    setCustomTemplates([])
    setCustomReqSets([])
    resetDynamicData()
    setDataVersion(v => v + 1)
    setRole(newRoleId)
    setShowAcct(false)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (showAcct && acctRef.current && !acctRef.current.contains(e.target)) setShowAcct(false)
      if (showCredits && creditsRef.current && !creditsRef.current.contains(e.target)) setShowCredits(false)
      if (showInbox && inboxRef.current && !inboxRef.current.contains(e.target)) setShowInbox(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAcct, showCredits, showInbox])

  // Escape key closes changelog
  useEffect(() => {
    if (!showChangelog) return
    const handleEsc = (e) => { if (e.key === 'Escape') setShowChangelog(false) }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [showChangelog])

  // Boot callbacks
  const handleBootFading = useCallback(() => {
    setPhase('fading')
    canvasRef.current?.prepNetworkBuild?.()
  }, [])

  const handleBootComplete = useCallback(() => {
    setPhase('ready')
    setTimeout(() => {
      canvasRef.current?.playNetworkBuild?.()
    }, 100)
  }, [])

  // Selection
  const handleSelect = useCallback((id) => {
    setSelectedObjectId(id)
    setForceTab(null)
    canvasRef.current?.panToNode?.(id)
  }, [])

  const handleDeselect = useCallback(() => {
    setSelectedObjectId(null)
  }, [])

  // Navigate from detail panel: select + pan
  const handleNavigate = useCallback((nodeId) => {
    setSelectedObjectId(nodeId)
    canvasRef.current?.panToNode?.(nodeId)
  }, [])

  // Visible objects + edges for this role
  const visibleObjects = useMemo(() => getVisibleObjects(actorId), [actorId, dataVersion])
  const visibleEdges = useMemo(() => getVisibleEdges(actorId), [actorId, dataVersion])
  const allTemplates = useMemo(
    () => [...getParseTemplatesForActor(actorId), ...customTemplates],
    [actorId, customTemplates]
  )
  const allReqSets = useMemo(
    () => [...getRequirementSetsForActor(actorId), ...customReqSets],
    [actorId, customReqSets]
  )

  const handleSaveTemplate = useCallback((template) => {
    setCustomTemplates(prev => [...prev, template])
  }, [])
  const handleSaveReqSet = useCallback((reqSet) => {
    setCustomReqSets(prev => [...prev, reqSet])
  }, [])

  const selectedObj = useMemo(
    () => selectedObjectId ? visibleObjects.find(o => o.id === selectedObjectId) : null,
    [selectedObjectId, visibleObjects]
  )

  // Action handlers
  const handleParse = useCallback(() => {
    if (!selectedObj) return
    setParseTarget(selectedObj)
  }, [selectedObj])

  const handleParseComplete = useCallback(({ newObject, newEdge, creditCost }) => {
    addObject(newObject)
    addEdge(newEdge)
    setCredits(prev => Math.max(0, prev - creditCost))
    setParseTarget(null)
    setDataVersion(v => v + 1)
    setForceTab('artifact')
    setTimeout(() => {
      setSelectedObjectId(newObject.id)
      canvasRef.current?.panToNode?.(newObject.id)
    }, 300)
  }, [])

  const handleEvaluate = useCallback(() => {
    if (!selectedObj) return
    setEvalTarget(selectedObj)
  }, [selectedObj])

  const handleEvalComplete = useCallback(({ newObject, newEdge, creditCost }) => {
    addObject(newObject)
    addEdge(newEdge)
    setCredits(prev => Math.max(0, prev - creditCost))
    setEvalTarget(null)
    setDataVersion(v => v + 1)
    setForceTab('artifact')
    setTimeout(() => {
      setSelectedObjectId(newObject.id)
      canvasRef.current?.panToNode?.(newObject.id)
    }, 300)
  }, [])

  const handleDisclose = useCallback(() => {
    if (!selectedObj) return
    setDiscloseTarget(selectedObj)
  }, [selectedObj])

  const handleDiscloseComplete = useCallback(({ disclosureObj, newEdge, resolvedTarget, requestDetails }) => {
    addEdge(newEdge)
    if (resolvedTarget && !visibleObjects.find(o => o.id === resolvedTarget.id)) {
      addObject({
        id: resolvedTarget.id, name: resolvedTarget.name, pin: resolvedTarget.pin,
        dot: '—', owner: resolvedTarget.owner, artifactUri: null, artifact: null,
        provenance: null, date: new Date().toISOString().slice(0, 10), dateTime: new Date().toISOString(),
        _pending: true,
        _requestDetails: requestDetails,
      })
    }
    setDiscloseTarget(null)
    setDataVersion(v => v + 1)
  }, [visibleObjects])

  const showBoot = phase === 'login' || phase === 'booting' || phase === 'fading'
  const showCanvas = phase === 'fading' || phase === 'ready'

  const pillStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    height: 36,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    transition: 'border-color .2s',
  }

  const iconBtnStyle = {
    width: 36, height: 36, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    transition: 'background 100ms',
    color: 'var(--text-secondary)',
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-deep)',
      fontFamily: 'var(--font-display)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Bar */}
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
        {/* Left: Prime Radiant + RADIANT logotype */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
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

        {/* Right: Theme + Notifications + Requirements + Credits + User Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Theme toggle */}
          <div
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ ...iconBtnStyle, fontSize: 16 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </div>

          {/* Notifications bell */}
          <div ref={inboxRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowInbox(v => !v); setShowCredits(false); setShowAcct(false) }}
              style={{
                ...pillStyle,
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { if (!showInbox) e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 2.5-1.5 4-1.5 4h12s-1.5-1.5-1.5-4A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.08em' }}>NOTIFICATIONS</div>
                </div>
                <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
                  No pending notifications
                </div>
              </div>
            )}
          </div>

          {/* Requirements Library */}
          <div
            onClick={() => setShowLibrary(true)}
            title="Library"
            style={iconBtnStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <rect x="3" y="2.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <rect x="5.5" y="1" width="5" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="var(--bg-deep)" />
              <line x1="5.5" y1="7" x2="10.5" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="5.5" y1="9.5" x2="10.5" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="5.5" y1="12" x2="8.5" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>

          {/* Credits pill */}
          <div ref={creditsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowCredits(v => !v); setShowAcct(false); setShowInbox(false) }}
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
                  <button
                    onClick={() => setCredits(0)}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)',
                      cursor: 'pointer', transition: 'all 150ms', marginTop: 4,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
                  >
                    Reset to 0
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={acctRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowAcct(v => !v); setShowCredits(false); setShowInbox(false) }}
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
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                color: 'var(--text-bright)',
              }}>{actor.name[0]}</div>
              <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actor.name}</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>▾</span>
            </button>

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
                    }}>{actor.name[0]}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-bright)' }}>{actor.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{actor.org}</div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '6px 0' }}>
                  <div style={{ padding: '4px 14px 6px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em' }}>SWITCH USER</div>
                  {actors.map(a => {
                    const r = ROLES.find(r => r.actorId === a.id)
                    if (!r) return null
                    const isCurrent = a.id === actorId
                    return (
                      <div
                        key={a.id}
                        onClick={() => { if (!isCurrent) switchRole(r.id) }}
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
                        onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = isCurrent ? 'rgba(99,102,241,.08)' : 'transparent' }}
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
                        }}>{a.name[0]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: isCurrent ? 'var(--accent-indigo-text)' : 'var(--text-primary)' }}>{a.name}</div>
                          <div style={{ fontSize: 9, color: isCurrent ? 'var(--accent-indigo)' : 'var(--text-muted)' }}>{a.org}</div>
                        </div>
                        {isCurrent && <span style={{ fontSize: 8, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>ACTIVE</span>}
                      </div>
                    )
                  })}
                </div>

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

      {/* Canvas area + Detail Panel */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {showCanvas && (
            <V3Canvas
              ref={canvasRef}
              actorId={actorId}
              edges={visibleEdges}
              selectedObjectId={selectedObjectId}
              onSelect={handleSelect}
              onDeselect={handleDeselect}
              phase={phase}
              onParse={handleParse}
              onEvaluate={handleEvaluate}
              onDisclose={handleDisclose}
              dataVersion={dataVersion}
            />
          )}
        </div>
        {selectedObj && (
          <DetailPanel
            obj={selectedObj}
            onClose={handleDeselect}
            onNavigate={handleNavigate}
            onParse={selectedObj.owner === actorId && selectedObj.artifactUri ? handleParse : undefined}
            onEvaluate={selectedObj.artifactUri ? handleEvaluate : undefined}
            onDisclose={selectedObj.owner === actorId && selectedObj.artifactUri ? handleDisclose : undefined}
            visibleEdges={visibleEdges}
            forceTab={forceTab}
          />
        )}
      </div>

      {/* Parse Flow */}
      {parseTarget && (
        <ParseFlow
          sourceObj={parseTarget}
          actorId={actorId}
          templates={allTemplates}
          onComplete={handleParseComplete}
          onClose={() => setParseTarget(null)}
        />
      )}

      {evalTarget && (
        <EvalFlow
          sourceObj={evalTarget}
          actorId={actorId}
          reqSets={allReqSets}
          onComplete={handleEvalComplete}
          onClose={() => setEvalTarget(null)}
        />
      )}

      {discloseTarget && (
        <DiscloseFlow
          sourceObj={discloseTarget}
          actorId={actorId}
          allObjects={visibleObjects}
          requirementSets={allReqSets}
          existingEdges={visibleEdges}
          onComplete={handleDiscloseComplete}
          onClose={() => setDiscloseTarget(null)}
        />
      )}

      {showLibrary && (
        <LibraryModal
          parseTemplates={allTemplates}
          requirementSets={allReqSets}
          publishedStandards={getPublishedStandards()}
          actorId={actorId}
          onClose={() => setShowLibrary(false)}
          onSaveTemplate={handleSaveTemplate}
          onSaveReqSet={handleSaveReqSet}
        />
      )}

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
        <div
          ref={footerTipRef}
          onMouseEnter={() => setShowFooterTip(true)}
          onMouseLeave={() => setShowFooterTip(false)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'help' }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent-green, #22c55e)', flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--accent-green, #22c55e)', letterSpacing: '0.04em',
          }}>
            Connected to AWS S3
          </span>
        </div>
        <span
          onClick={() => setShowChangelog(true)}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-dim)', cursor: 'pointer',
            transition: 'color 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          v3.0.0 &middot; Changelog
        </span>
      </div>

      {/* Footer QS tooltip */}
      {showFooterTip && footerTipRef.current && createPortal(
        <div style={{
          position: 'fixed',
          left: footerTipRef.current.getBoundingClientRect().left,
          top: footerTipRef.current.getBoundingClientRect().top - 48,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 12px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          zIndex: 99999,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          {`s3://${actor.org.toLowerCase().replace(/\s+/g, '-')}-qualified-storage · Connected · All artifact files are hashed and endorsed on the ledger`}
        </div>,
        document.body
      )}

      {/* Changelog modal */}
      {showChangelog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowChangelog(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 560, maxHeight: '80vh', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 10,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Prototype Changelog</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>Radiant V3 — PCN Prototyping</div>
              </div>
              <span onClick={() => setShowChangelog(false)} style={{ fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px' }}>&#10005;</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
              {CHANGELOG.map(release => (
                <div key={release.version} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: 'var(--accent-indigo)', padding: '2px 8px', borderRadius: 4,
                      background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                    }}>v{release.version}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{release.label}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{release.date}</span>
                  </div>
                  {release.items.map((item, ii) => (
                    <div key={ii} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '3px 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                    }}>
                      <span style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }}>&middot;</span>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Boot Screen */}
      {showBoot && (
        <V3BootScreen
          onFading={handleBootFading}
          onComplete={handleBootComplete}
        />
      )}
    </div>
  )
}
