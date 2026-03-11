import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { TT } from '../data/tokens';
import SvgMark from './SvgMark';

/* ── Network Updates constants ── */
const EVT_ICONS = { disclosure: '◈', invitation: '✉', asset: '◆', evaluation: '◎', claim: '✓' };
const EVT_COLORS = { disclosure: 'var(--accent-sda-full)', invitation: 'var(--accent-purple-light)', asset: 'var(--accent-green)', evaluation: 'var(--accent-amber)', claim: 'var(--accent-indigo)' };
const EVT_TITLES = { disclosure: 'Disclosure Created', invitation: 'Invitation Received', asset: 'Asset Registered', evaluation: 'Evaluation Shared', claim: 'Claim Updated' };

function relTime(ts) {
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const dy = Math.floor(h / 24);
  return dy === 1 ? 'Yesterday' : `${dy} days ago`;
}

function BellSvg({ size = 16, stroke = 'var(--text-muted)', sw = 1.5 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
    <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 2.5-1 4-2 5h13c-1-1-2-2.5-2-5 0-2.5-2-4.5-4.5-4.5z" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.5 11c.2.9.8 1.5 1.5 1.5s1.3-.6 1.5-1.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
function RingBellSvg({ size = 16, stroke = 'var(--accent-amber)', sw = 2 }) {
  return <svg width={size} height={size} viewBox="0 0 20 16" fill="none" style={{ display: 'block' }}>
    <path d="M10 1.5C7.5 1.5 5.5 3.5 5.5 6c0 2.5-1 4-2 5h13c-1-1-2-2.5-2-5 0-2.5-2-4.5-4.5-4.5z" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 11c.2.9.8 1.5 1.5 1.5s1.3-.6 1.5-1.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.5 4.5c-.6-.8-.8-1.8-.4-2.8" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" opacity=".7" />
    <path d="M16.5 4.5c.6-.8.8-1.8.4-2.8" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" opacity=".7" />
  </svg>;
}
function EvtCountdown({ running, resetKey }) {
  const R = 9, C = 2 * Math.PI * R;
  return <svg width={20} height={20} viewBox="0 0 20 20" style={{ display: 'block', transform: 'rotate(-90deg)', flexShrink: 0 }}>
    <circle cx={10} cy={10} r={R} fill="none" stroke="var(--border)" strokeWidth={2} />
    <circle key={resetKey} cx={10} cy={10} r={R} fill="none" stroke="var(--accent-indigo)" strokeWidth={2}
      strokeDasharray={C} strokeDashoffset={0} strokeLinecap="round"
      style={{ animation: 'countdown 4s linear forwards', animationPlayState: running ? 'running' : 'paused' }} />
    {!running && <g transform="rotate(90 10 10)">
      <rect x={6.5} y={7} width={2} height={6} rx={0.5} fill="var(--text-muted)" />
      <rect x={11.5} y={7} width={2} height={6} rx={0.5} fill="var(--text-muted)" />
    </g>}
  </svg>;
}
function EvtNavBtn({ children, onClick, disabled, fontSize = 14 }) {
  const [hov, setHov] = useState(false);
  return <button onClick={disabled ? undefined : onClick}
    onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{
      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: hov && !disabled ? 'var(--bg-raised)' : 'transparent',
      border: `1px solid ${hov && !disabled ? 'var(--border-hover)' : 'var(--border)'}`,
      borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
      color: disabled ? 'var(--text-muted)' : (hov ? 'var(--text-primary)' : 'var(--text-tertiary)'),
      fontSize, lineHeight: 1, padding: 0,
      opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto',
      transition: 'border-color .15s, background .15s, color .15s',
    }}>
    {children}
  </button>;
}

function generateSupplierEvents(customerData, persona) {
  if (!customerData || customerData.length === 0) return [];
  const allAssets = [];
  for (const cd of customerData) {
    for (const a of (cd.assets || [])) allAssets.push({ ...a, customerName: cd.customerName });
  }
  if (allAssets.length === 0) return [];

  let seed = 42;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };
  const now = Date.now();
  const ago = days => new Date(now - days * 86400000).toISOString();
  const events = [];

  // Disclosure events — one per asset with an active SDA
  for (const a of allAssets) {
    const sdas = a.node.sdas || (a.node.sda ? [a.node.sda] : []);
    const active = sdas.find(s => s.status === 'active' && s.type);
    if (active) {
      events.push({
        id: `sevt-${events.length + 1}`, type: 'disclosure',
        message: `${active.type.charAt(0).toUpperCase() + active.type.slice(1)} disclosure created for ${a.node.name}`,
        detail: `${persona.org} → ${a.customerName} · ${active.type} SDA`,
        timestamp: ago(rand() * 5 + 0.1), nodeId: a.node.id, read: false,
      });
    }
  }

  // Evaluation events — assets with evaluations
  for (const a of allAssets) {
    if (a.node.evaluations?.length > 0) {
      const ev = a.node.evaluations[0];
      events.push({
        id: `sevt-${events.length + 1}`, type: 'evaluation',
        message: `${a.node.name} evaluation ${ev.overallResult === 'pass' ? 'passed' : 'completed'}`,
        detail: `${ev.checklist || 'Compliance'} · ${ev.requirementCount || 0} requirements`,
        timestamp: ago(rand() * 4 + 0.3), nodeId: a.node.id, read: false,
      });
    }
  }

  // Asset registration events
  for (const a of allAssets.slice(0, 3)) {
    events.push({
      id: `sevt-${events.length + 1}`, type: 'asset',
      message: `${a.node.name} registered on-chain`,
      detail: `${(TT[a.node.type] || TT.component).label} · ${a.node.location || 'Unknown'}`,
      timestamp: ago(rand() * 6 + 1), nodeId: a.node.id, read: false,
    });
  }

  // Claim events
  for (const a of allAssets.slice(0, 2)) {
    const raw = a.node.rawAttestations || [];
    const att = raw.length > 0 ? raw[Math.floor(rand() * raw.length)] : null;
    if (att) {
      events.push({
        id: `sevt-${events.length + 1}`, type: 'claim',
        message: `Claim verified: ${att.predicate?.replace(/_/g, ' ') || 'attestation'} on ${a.node.name}`,
        detail: `${att.actor?.name || 'Issuer'} · ${att.predicate?.replace(/_/g, ' ') || 'claim'}`,
        timestamp: ago(rand() * 5 + 0.5), nodeId: a.node.id, read: false,
      });
    }
  }

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events;
}

/* ── Constants (match buyer-side NetGraph) ── */
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const DECAY = 0.92;
const VEL_STOP = 0.3;
const CW = 195, CH = 58;
const SUPPLIER_ORG_W = 280;
const DBL_CLICK_MS = 280;
const PAN_DURATION = 300;

/* ── SDA badge helpers ── */
const SDA_COLORS = {
  full: { color: 'var(--accent-sda-full)', label: 'FULL' },
  selective: { color: 'var(--accent-amber)', label: 'SELECTIVE' },
  derivative: { color: 'var(--accent-green)', label: 'DERIVATIVE' },
  cascade: { color: 'var(--accent-sda-cascade)', label: 'CASCADE' },
};

/* ── Health stats (matches NetGraph healthMap) ── */
const REF_T = new Date('2026-02-17').getTime();
function nodeHealthStats(node) {
  const raw = node?.rawAttestations || [];
  let ok = 0, warn = 0, bad = 0, expSoon = false;
  for (const a of raw) {
    if (a.status === 'contested' || a.status === 'revoked') bad++;
    else if (a.status === 'expired' || a.status === 'pending') warn++;
    else ok++;
    if (a.status === 'verified' && a.validUntil) {
      const d = (new Date(a.validUntil).getTime() - REF_T) / 86400000;
      if (d > 0 && d <= 30) expSoon = true;
    }
  }
  return { ok, warn, bad, total: raw.length, expSoon };
}

/* ── SDA edge style ── */
function sdaEdgeStyle(sda) {
  if (!sda) return { stroke: 'var(--text-muted)', dash: undefined, sw: 1, opacity: 0.45 };
  if (sda.status === 'pending') return { stroke: 'var(--text-tertiary)', dash: '2,3', sw: 1, opacity: 0.5 };
  if (sda.status === 'expired') return { stroke: 'var(--border-hover)', dash: undefined, sw: 1, opacity: 0.15 };
  const t = sda.type;
  if (t === 'full') return { stroke: 'var(--accent-sda-full)', dash: undefined, sw: 1.5, opacity: 0.55 };
  if (t === 'selective') return { stroke: 'var(--accent-amber)', dash: '4,3', sw: 1.2, opacity: 0.6 };
  if (t === 'derivative') return { stroke: 'var(--accent-green)', dash: '2,4', sw: 1.2, opacity: 0.6 };
  if (sda.scope === 'cascade') return { stroke: 'var(--accent-sda-cascade)', dash: '8,3,2,3', sw: 1.3, opacity: 0.6 };
  return { stroke: 'var(--text-muted)', dash: undefined, sw: 1, opacity: 0.45 };
}

/* ── Tooltip text ── */
function sdaTooltipText(sda, assetName, buyerName) {
  if (!sda) return `${assetName} \u2192 ${buyerName}`;
  if (sda.status === 'expired') return `Expired Disclosure \u00b7 ${assetName} \u2192 ${buyerName}`;
  if (sda.status === 'pending') return `Pending Disclosure \u00b7 ${assetName} \u2192 ${buyerName}`;
  const t = sda.type;
  const status = sda.status || 'active';
  if (t === 'full') return `Full Disclosure \u00b7 ${assetName} \u2192 ${buyerName} \u00b7 Status: ${status}`;
  if (t === 'selective') return `Selective Disclosure \u00b7 ${assetName} \u2192 ${buyerName} \u00b7 ${sda.redactedFields?.length || 0} fields redacted`;
  if (t === 'derivative') return `Derivative Disclosure \u00b7 ${assetName} \u2192 ${buyerName} \u00b7 Status: ${status}`;
  if (sda.scope === 'cascade') return `Cascaded Disclosure \u00b7 ${assetName} \u2192 ${buyerName} \u00b7 ${sda.cascadePolicy || 'open'}`;
  return `${assetName} \u2192 ${buyerName}`;
}

/* ── Legend ── */
const NODE_LEGEND = [
  { type: 'customer', label: 'Buyer Org' },
  { type: 'assembly', label: 'Assembly' },
  { type: 'subassembly', label: 'Sub-Assembly' },
  { type: 'component', label: 'Component' },
  { type: 'process', label: 'Process' },
  { type: 'material', label: 'Material' },
  { type: 'rawsource', label: 'Raw Source' },
];
const DISC_LEGEND = [
  { stroke: 'var(--accent-sda-full)', dash: undefined, label: 'Full Disclosure', tip: 'Complete data disclosure — all fields shared' },
  { stroke: 'var(--accent-amber)', dash: '4,3', label: 'Selective', tip: 'Partial disclosure — some fields redacted' },
  { stroke: 'var(--accent-green)', dash: '2,4', label: 'Derivative', tip: 'Evaluation-based disclosure — POE shared, raw data withheld' },
  { stroke: 'var(--accent-sda-cascade)', dash: '8,3,2,3', label: 'Cascade', tip: 'Upstream supplier propagated visibility through the supply chain' },
  { stroke: 'var(--text-tertiary)', dash: '2,3', label: 'Pending', tip: 'Invitation accepted, disclosure not yet created' },
  { stroke: 'var(--text-muted)', dash: undefined, label: 'Structural', tip: 'Structural connection — no disclosure agreement' },
];
const HEALTH_LEGEND = [
  { color: 'var(--accent-green)', label: 'Healthy', tip: 'Healthy: All claims verified, no expirations within 90 days' },
  { color: 'var(--accent-amber)', label: 'Warning', tip: 'Warning: Some claims expiring soon or requiring attention' },
  { color: 'var(--accent-red)', label: 'Critical', tip: 'Critical: Expired claims, failed evaluations, or contested attestations' },
];

export default function SupplierNetGraph({
  persona, customerData, onNodeSelect, onNodeDblClick, panToRequest, selectedNodeId,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const velRef = useRef({ vx: 0, vy: 0 });
  const momentumRef = useRef(null);
  const clickTimerRef = useRef(null);
  const wasDragRef = useRef(false);
  const panAnimRef = useRef(null);

  const [hoverNodeId, setHoverNodeId] = useState(null);
  const [internalSelId, setInternalSelId] = useState(null);
  const [edgeTooltip, setEdgeTooltip] = useState(null);
  const [legendHover, setLegendHover] = useState(null);
  const [healthDotTooltip, setHealthDotTooltip] = useState(null);

  /* ── Network Updates state ── */
  const [supplierEvents, setSupplierEvents] = useState([]);
  const [evtStage, setEvtStage] = useState(0);
  const [evtIdx, setEvtIdx] = useState(0);
  const [evtHovering, setEvtHovering] = useState(false);
  const [evtFade, setEvtFade] = useState(1);
  const [evtCycleReset, setEvtCycleReset] = useState(0);
  const [evtPaused, setEvtPaused] = useState(false);
  const [evtPausedBefore3, setEvtPausedBefore3] = useState(false);
  const [evtRadialKey, setEvtRadialKey] = useState(0);
  const evtFadeRef = useRef(null);
  const evtIdxRef = useRef(0);
  evtIdxRef.current = evtIdx;
  const evtAnimatePanRef = useRef(null);

  /* Generate events when customerData changes */
  useEffect(() => {
    const evts = generateSupplierEvents(customerData, persona);
    setSupplierEvents(evts);
    setEvtStage(evts.filter(e => !e.read).length > 0 ? 1 : 0);
    setEvtIdx(0);
  }, [customerData, persona]);

  const unreadEvts = useMemo(() => supplierEvents.filter(e => !e.read), [supplierEvents]);
  const unreadEvtCount = unreadEvts.length;
  const unreadEvtsRef = useRef(unreadEvts);
  unreadEvtsRef.current = unreadEvts;

  const safeEvtIdx = unreadEvtCount > 0 ? Math.min(evtIdx, unreadEvtCount - 1) : 0;
  const cycleEvt = unreadEvts[safeEvtIdx] || supplierEvents[0];
  const atEvtEnd = unreadEvtCount <= 1 || safeEvtIdx >= unreadEvtCount - 1;
  const atEvtStart = safeEvtIdx <= 0;

  /* Stage transitions */
  useEffect(() => {
    if (unreadEvtCount === 0 && (evtStage === 1 || evtStage === 2)) setEvtStage(0);
    if (unreadEvtCount > 0 && evtStage === 0) setEvtStage(1);
  }, [unreadEvtCount, evtStage]);

  useEffect(() => {
    if (unreadEvtCount > 0 && evtIdx >= unreadEvtCount) setEvtIdx(0);
  }, [unreadEvtCount, evtIdx]);

  /* Advance with fade */
  const advanceEvt = useCallback((dir = 1) => {
    const evts = unreadEvtsRef.current;
    const next = evtIdxRef.current + dir;
    if (next < 0 || next >= evts.length) return;
    if (evtFadeRef.current) clearTimeout(evtFadeRef.current);
    setEvtRadialKey(k => k + 1);
    setEvtFade(0);
    evtFadeRef.current = setTimeout(() => {
      setEvtIdx(next);
      setEvtFade(1);
      const evt = evts[next];
      if (evt && evtAnimatePanRef.current) evtAnimatePanRef.current(evt.nodeId);
    }, 200);
  }, []);

  /* Auto-cycle for Stage 2 */
  useEffect(() => {
    if (evtStage !== 2 || evtHovering || evtPaused || unreadEvtCount <= 1) return;
    const id = setInterval(() => {
      if (evtIdxRef.current >= unreadEvtsRef.current.length - 1) { clearInterval(id); return; }
      advanceEvt(1);
    }, 4000);
    return () => { clearInterval(id); if (evtFadeRef.current) { clearTimeout(evtFadeRef.current); evtFadeRef.current = null; } };
  }, [evtStage, evtHovering, evtPaused, unreadEvtCount, evtCycleReset, advanceEvt]);

  useEffect(() => () => { if (evtFadeRef.current) clearTimeout(evtFadeRef.current); }, []);

  const evtNavPrev = useCallback(() => { advanceEvt(-1); setEvtCycleReset(k => k + 1); }, [advanceEvt]);
  const evtNavNext = useCallback(() => { advanceEvt(1); setEvtCycleReset(k => k + 1); }, [advanceEvt]);

  const evtGoList = useCallback(() => {
    if (evtFadeRef.current) { clearTimeout(evtFadeRef.current); evtFadeRef.current = null; }
    setEvtFade(1);
    setEvtPausedBefore3(evtPaused);
    setEvtStage(3);
  }, [evtPaused]);

  const evtCloseIdle = useCallback(() => { setEvtStage(unreadEvtCount > 0 ? 1 : 0); }, [unreadEvtCount]);

  const evtCloseList = useCallback(() => {
    const evts = unreadEvtsRef.current;
    let ri = Math.min(evtIdxRef.current, evts.length - 1);
    if (ri < 0) ri = 0;
    setEvtIdx(ri);
    setEvtPaused(evtPausedBefore3);
    if (!evtPausedBefore3) { setEvtCycleReset(k => k + 1); setEvtRadialKey(k => k + 1); }
    const evt = evts[ri];
    if (evt && evtAnimatePanRef.current) evtAnimatePanRef.current(evt.nodeId);
    setEvtStage(2);
  }, [evtPausedBefore3]);

  const evtMarkAllRead = useCallback(() => {
    setSupplierEvents(prev => prev.map(e => ({ ...e, read: true })));
    setEvtStage(0);
  }, []);

  const evtClickItem = useCallback((evt) => {
    setSupplierEvents(prev => prev.map(e => e.id === evt.id ? { ...e, read: true } : e));
    if (evt.nodeId && evtAnimatePanRef.current) evtAnimatePanRef.current(evt.nodeId);
    const remaining = unreadEvtCount - (evt.read ? 0 : 1);
    setTimeout(() => setEvtStage(remaining > 0 ? 1 : 0), 300);
  }, [unreadEvtCount]);

  /* Keep internalSelId in sync with external selectedNodeId */
  useEffect(() => { setInternalSelId(selectedNodeId || null); }, [selectedNodeId]);

  /* ── Resize observer ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Layout ── */
  const layout = useMemo(() => {
    if (!customerData || customerData.length === 0) return null;
    const PAD_Y = 80;
    const COL1_X = 0.15;
    const COL2_X = 0.46;
    const COL3_X = 0.81;
    const w = Math.max(size.w, 600);
    const nodes = [];
    const edges = [];
    const buyerMap = new Map();

    const allAssets = [];
    for (const cd of customerData) {
      for (const asset of (cd.assets || [])) {
        allAssets.push({ ...asset, verticalKey: cd.verticalKey, customerName: cd.customerName });
      }
    }
    if (allAssets.length === 0) return null;

    /* Column 2: asset nodes */
    const assetSpacing = Math.max(CH + 14, (size.h - PAD_Y * 2) / Math.max(allAssets.length, 1));
    const assetStartY = PAD_Y + (size.h - PAD_Y * 2 - assetSpacing * (allAssets.length - 1)) / 2;

    const assetNodes = allAssets.map((a, i) => {
      const sdas = a.node.sdas || (a.node.sda ? [a.node.sda] : []);
      return {
        id: a.node.id,
        node: a.node,
        x: w * COL2_X - CW / 2,
        y: assetStartY + i * assetSpacing,
        w: CW, h: CH,
        col: 'asset',
        verticalKey: a.verticalKey,
        customerName: a.customerName,
        sdas,
      };
    });
    nodes.push(...assetNodes);

    /* Column 1: supplier org */
    const supplierCy = assetNodes.length > 0
      ? (assetNodes[0].y + assetNodes[assetNodes.length - 1].y) / 2
      : size.h / 2;
    const supplierNode = {
      id: 'supplier-org',
      node: { id: 'supplier-org', type: 'customer', name: persona.org, rawAttestations: [] },
      x: Math.max(20, w * COL1_X - SUPPLIER_ORG_W / 2),
      y: supplierCy,
      w: SUPPLIER_ORG_W, h: CH,
      col: 'supplier',
      isOrg: true,
      assetCount: assetNodes.length,
    };
    nodes.push(supplierNode);

    /* Structural edges col1 → col2 */
    for (const an of assetNodes) {
      edges.push({ from: 'supplier-org', to: an.id, type: 'structural' });
    }

    /* Column 3: buyer org nodes — only include assets with SDAs */
    for (const an of assetNodes) {
      const bName = an.customerName;
      if (!bName) continue;
      const hasSDA = an.node.sdas?.length > 0 || an.node.sda;
      if (!hasSDA) continue;
      if (!buyerMap.has(bName)) buyerMap.set(bName, { name: bName, verticalKey: an.verticalKey, assets: [] });
      buyerMap.get(bName).assets.push(an);
    }

    /* Add additional SDA receivers (derivative + non-primary) as buyers */
    for (const an of assetNodes) {
      for (const s of (an.node.sdas || [])) {
        if (s === an.node.sda || s.status !== 'active' || !s.receiver) continue;
        const rName = s.receiver;
        if (rName === an.customerName) continue;
        if (!buyerMap.has(rName)) buyerMap.set(rName, { name: rName, verticalKey: an.verticalKey, assets: [] });
        if (!buyerMap.get(rName).assets.includes(an)) buyerMap.get(rName).assets.push(an);
      }
    }

    const buyers = Array.from(buyerMap.values());
    const buyerSpacing = Math.max(CH + 14, (size.h - PAD_Y * 2) / Math.max(buyers.length, 1));
    const buyerStartY = PAD_Y + (size.h - PAD_Y * 2 - buyerSpacing * (buyers.length - 1)) / 2;

    const buyerNodes = buyers.map((b, i) => {
      const sdaTypesSet = new Set();
      for (const a of b.assets) {
        const nodeSDAs = a.node.sdas || (a.node.sda ? [a.node.sda] : []);
        for (const s of nodeSDAs) {
          if (s.type) sdaTypesSet.add(s.type);
        }
      }
      return {
        id: `buyer-${b.name}`,
        node: { id: `buyer-${b.name}`, type: 'customer', name: b.name, rawAttestations: [] },
        x: w * COL3_X - CW / 2,
        y: buyerStartY + i * buyerSpacing,
        w: CW, h: CH,
        col: 'buyer',
        verticalKey: b.verticalKey,
        isOrg: true,
        assetCount: b.assets.length,
        sdaTypes: Array.from(sdaTypesSet),
      };
    });
    nodes.push(...buyerNodes);

    /* SDA edges col2 → col3 — only for nodes with SDAs */
    for (const an of assetNodes) {
      const sda = (an.node.sdas?.find(s => s.receiver === an.customerName)) || an.node.sda;
      if (!sda) continue;
      const buyerId = `buyer-${an.customerName}`;
      edges.push({ from: an.id, to: buyerId, type: 'sda', sda, buyerName: an.customerName });

      /* Additional SDA edges (derivative + non-primary) from node.sdas */
      for (const s of (an.node.sdas || [])) {
        if (s === an.node.sda || s.status !== 'active' || !s.receiver || s.receiver === an.customerName) continue;
        const sBuyerId = `buyer-${s.receiver}`;
        edges.push({ from: an.id, to: sBuyerId, type: 'sda', sda: s, buyerName: s.receiver });
      }
    }

    const byId = {};
    for (const n of nodes) byId[n.id] = n;

    return { nodes, edges, byId, supplierNode, assetNodes, buyerNodes };
  }, [customerData, persona, size]);

  /* ── Animated pan-to-node helper ── */
  const animatePanTo = useCallback((targetX, targetY, targetW) => {
    if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current);
    const cx = targetX + (targetW || CW) / 2;
    const cy = targetY;
    const endPanX = size.w / 2 - cx * zoom;
    const endPanY = size.h / 2 - cy * zoom;
    const startTime = performance.now();
    setPan(prev => {
      const startX = prev.x, startY = prev.y;
      const tick = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / PAN_DURATION, 1);
        const ease = t * (2 - t);
        const nx = startX + (endPanX - startX) * ease;
        const ny = startY + (endPanY - startY) * ease;
        setPan({ x: nx, y: ny });
        if (t < 1) panAnimRef.current = requestAnimationFrame(tick);
        else panAnimRef.current = null;
      };
      panAnimRef.current = requestAnimationFrame(tick);
      return prev;
    });
  }, [size, zoom]);

  /* ── Wire event pan ref to animatePanTo + layout ── */
  useEffect(() => {
    evtAnimatePanRef.current = (nodeId) => {
      if (!layout) return;
      const n = layout.byId[nodeId];
      if (n) animatePanTo(n.x, n.y, n.w);
    };
  }, [layout, animatePanTo]);

  /* ── panToRequest effect ── */
  useEffect(() => {
    if (!panToRequest || !layout) return;
    const node = layout.byId[panToRequest.id];
    if (!node) return;
    if (panToRequest.id.startsWith('buyer-')) {
      /* Sidebar buyer click — select + pan (same as direct graph click) */
      handleBuyerClick(node, layout.edges);
    } else {
      animatePanTo(node.x, node.y, node.w);
    }
  }, [panToRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fit all ── */
  const fitAll = useCallback(() => {
    if (!layout) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of layout.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y - n.h / 2);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h / 2);
    }
    const bw = maxX - minX + 80;
    const bh = maxY - minY + 80;
    const z = Math.min(Math.max(Math.min(size.w / bw, size.h / bh), MIN_ZOOM), MAX_ZOOM);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(z);
    setPan({ x: size.w / 2 - cx * z, y: size.h / 2 - cy * z });
  }, [layout, size]);

  /* ── Viewport-centered zoom (for buttons) ── */
  const zoomCentered = useCallback((factor) => {
    const mx = size.w / 2, my = size.h / 2;
    setZoom(z => {
      const nz = Math.min(Math.max(z * factor, MIN_ZOOM), MAX_ZOOM);
      setPan(p => ({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) }));
      return nz;
    });
  }, [size]);

  /* ── Fit all on first render ── */
  const didFit = useRef(false);
  useEffect(() => {
    if (!layout || didFit.current) return;
    didFit.current = true;
    fitAll();
  }, [layout, fitAll]);

  /* ── Keyboard shortcuts (R=reset, F=fit) ── */
  useEffect(() => {
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'r') { setZoom(1); setPan({ x: 0, y: 0 }); }
      if (k === 'f') fitAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fitAll]);

  /* ── Pan / drag ── */
  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return;
    if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
    if (panAnimRef.current) { cancelAnimationFrame(panAnimRef.current); panAnimRef.current = null; }
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, lastX: e.clientX, lastY: e.clientY, lastT: performance.now(), moved: false };
    velRef.current = { vx: 0, vy: 0 };
    setDragging(true);
  }, [pan]);

  const onMouseMove = useCallback(e => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    const now = performance.now();
    const dt = now - dragRef.current.lastT;
    if (dt > 0) {
      velRef.current.vx = (e.clientX - dragRef.current.lastX) / dt * 16;
      velRef.current.vy = (e.clientY - dragRef.current.lastY) / dt * 16;
    }
    dragRef.current.lastX = e.clientX; dragRef.current.lastY = e.clientY; dragRef.current.lastT = now;
    setPan({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
  }, []);

  const onMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    wasDragRef.current = dragRef.current.moved;
    dragRef.current = null;
    setDragging(false);
    if (wasDragRef.current) {
      const { vx, vy } = velRef.current;
      if (Math.abs(vx) >= VEL_STOP || Math.abs(vy) >= VEL_STOP) {
        const tick = () => {
          velRef.current.vx *= DECAY; velRef.current.vy *= DECAY;
          if (Math.abs(velRef.current.vx) < VEL_STOP && Math.abs(velRef.current.vy) < VEL_STOP) { momentumRef.current = null; return; }
          setPan(p => ({ x: p.x + velRef.current.vx, y: p.y + velRef.current.vy }));
          momentumRef.current = requestAnimationFrame(tick);
        };
        momentumRef.current = requestAnimationFrame(tick);
      }
    }
  }, []);

  useEffect(() => { return () => { if (momentumRef.current) cancelAnimationFrame(momentumRef.current); if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current); }; }, []);

  /* ── Scroll zoom ── */
  const onWheel = useCallback(e => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 0.985 : 1.015;
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * dir)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  /* ── Unified select + pan helper ── */
  const selectNode = useCallback((id, syntheticNode, layoutNode) => {
    const isToggle = internalSelId === id;
    const newId = isToggle ? null : id;
    setInternalSelId(newId);
    if (onNodeSelect) onNodeSelect(isToggle ? null : syntheticNode);
    if (!isToggle && layoutNode) animatePanTo(layoutNode.x, layoutNode.y, layoutNode.w);
  }, [internalSelId, onNodeSelect, animatePanTo]);

  /* ── Click handler for assets (single-click only — no SubgraphModal in supplier context) ── */
  const handleAssetClick = useCallback((n) => {
    selectNode(n.id, n.node, n);
  }, [selectNode]);

  /* ── Buyer click → Detail Panel with disclosure summary ── */
  const handleBuyerClick = useCallback((n, edges) => {
    const buyerAssets = edges.filter(e => e.to === n.id && e.type === 'sda');
    const sdaCounts = { full: 0, selective: 0, derivative: 0 };
    const assetList = [];
    for (const e of buyerAssets) {
      const t = e.sda?.type;
      if (t && sdaCounts[t] !== undefined) sdaCounts[t]++;
      const fromNode = layout?.byId[e.from];
      assetList.push({
        label: fromNode?.node?.name || e.from,
        type: (TT[fromNode?.node?.type] || TT.component).label,
        sdaType: e.sda?.type,
        sdaStatus: e.sda?.status,
      });
    }
    const syntheticNode = {
      id: n.id,
      name: n.node.name,
      type: 'customer',
      location: '\u2014',
      rawAttestations: [],
      disclosureSummary: {
        totalAssets: buyerAssets.length,
        sdaTypes: sdaCounts,
        assets: assetList,
      },
    };
    selectNode(n.id, syntheticNode, n);
  }, [layout, selectNode]);

  /* ── Supplier org click → Detail Panel with network summary ── */
  const handleSupplierClick = useCallback((n, edges, assetNodes, buyerNodes) => {
    const sdaCounts = { full: 0, selective: 0, derivative: 0 };
    let activeDisclosures = 0;
    for (const e of edges) {
      if (e.type !== 'sda') continue;
      const t = e.sda?.type;
      if (t && sdaCounts[t] !== undefined) sdaCounts[t]++;
      if (e.sda?.status === 'active') activeDisclosures++;
    }
    const syntheticNode = {
      id: n.id,
      name: n.node.name,
      type: 'customer',
      location: persona.location || '\u2014',
      rawAttestations: [],
      networkSummary: {
        totalAssets: assetNodes.length,
        totalBuyers: buyerNodes.length,
        activeDisclosures,
        sdaTypes: sdaCounts,
      },
    };
    selectNode(n.id, syntheticNode, n);
  }, [persona, selectNode]);

  /* ── Empty state ── */
  if (!layout) {
    return <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', userSelect: 'none' }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#x2B21;</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>No Assets Registered</div>
      <div style={{ fontSize: 12, color: 'var(--border-hover)', marginTop: 6, maxWidth: 280, textAlign: 'center', lineHeight: 1.5 }}>
        Accept an invitation and register your first asset to see your supplier network graph.
      </div>
    </div>;
  }

  const { nodes, edges, byId } = layout;
  const panelOpen = !!internalSelId;

  /* ── Edge/node dimming based on selection ── */
  const selLayoutNode = internalSelId ? byId[internalSelId] : null;
  const selCol = selLayoutNode?.col;

  const connectedIds = useMemo(() => {
    if (!selCol || !internalSelId) return null;
    const ids = new Set();
    ids.add(internalSelId);
    if (selCol === 'buyer') {
      for (const e of edges) {
        if (e.to === internalSelId && e.type === 'sda') { ids.add(e.from); ids.add('supplier-org'); }
      }
    } else if (selCol === 'asset') {
      ids.add('supplier-org');
      for (const e of edges) {
        if (e.from === internalSelId && e.type === 'sda') ids.add(e.to);
      }
    } else if (selCol === 'supplier') {
      for (const e of edges) {
        if (e.from === internalSelId && e.type === 'structural') ids.add(e.to);
      }
    }
    return ids;
  }, [internalSelId, selCol, edges]);

  const edgeDimmed = (e) => {
    if (!internalSelId) return false;
    if (selCol === 'buyer') {
      if (e.to === internalSelId) return false;
      if (e.type === 'structural' && connectedIds?.has(e.to)) return false;
      return true;
    }
    if (selCol === 'asset') {
      if (e.from === internalSelId || e.to === internalSelId) return false;
      if (e.type === 'structural' && e.to === internalSelId) return false;
      return true;
    }
    if (selCol === 'supplier') {
      if (e.from === internalSelId && e.type === 'structural') return false;
      return true;
    }
    return false;
  };

  const nodeDimmed = (n) => {
    if (!connectedIds) return false;
    return !connectedIds.has(n.id);
  };

  /* ── Render edges ── */
  const renderedEdges = edges.map((e, i) => {
    const from = byId[e.from]; const to = byId[e.to];
    if (!from || !to) return null;
    const x1 = from.x + from.w, y1 = from.y, x2 = to.x, y2 = to.y;
    const mx = (x1 + x2) / 2;
    const d = `M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}`;
    const es = e.type === 'sda' ? sdaEdgeStyle(e.sda) : { stroke: 'var(--text-muted)', dash: undefined, sw: 1.5, opacity: 0.45 };
    const dim = edgeDimmed(e);
    const tipText = e.type === 'sda'
      ? sdaTooltipText(e.sda, from.node.name, to.node.name)
      : `${from.node.name} \u2192 ${to.node.name}`;

    return <g key={`edge-${i}`}>
      <path d={d} fill="none" stroke={es.stroke} strokeWidth={es.sw} strokeDasharray={es.dash}
        opacity={dim ? 0.08 : es.opacity} style={{ pointerEvents: 'none' }} />
      <path d={d} fill="none" stroke="transparent" strokeWidth={12}
        style={{ cursor: 'default', pointerEvents: zoom >= 0.45 ? 'all' : 'none' }}
        onMouseEnter={ev => {
          const r = containerRef.current?.getBoundingClientRect();
          if (r) setEdgeTooltip({ x: ev.clientX - r.left, y: ev.clientY - r.top, text: tipText });
        }}
        onMouseLeave={() => setEdgeTooltip(null)} />
    </g>;
  });

  /* ── Render nodes ── */
  const renderedNodes = nodes.map(n => {
    const isSupplier = n.col === 'supplier';
    const isBuyer = n.col === 'buyer';
    const isAsset = n.col === 'asset';
    const tk = TT[n.node.type] || TT.component;
    const isH = hoverNodeId === n.id;
    const isS = internalSelId === n.id;
    const dimmed = nodeDimmed(n);

    /* ── Asset card (matches buyer-side left card) ── */
    if (isAsset) {
      const h = nodeHealthStats(n.node);
      const hDot = h.bad > 0 ? 'var(--accent-red)' : h.warn > 0 || h.expSoon ? 'var(--accent-amber)' : h.total > 0 ? 'var(--accent-green)' : 'var(--text-faint)';
      const bW = 36;
      const gW = h.total > 0 ? Math.round(h.ok / h.total * bW) : 0;
      const wW = h.total > 0 ? Math.round(h.warn / h.total * bW) : 0;
      const rW = h.total > 0 ? bW - gW - wW : 0;
      const activeSdas = (n.sdas || []).filter(s => s.status === 'active' || !s.status);
      const sdaTypeMap = {};
      for (const s of activeSdas) { if (s.type) sdaTypeMap[s.type] = (sdaTypeMap[s.type] || 0) + 1; }
      const sdaTypeKeys = Object.keys(sdaTypeMap);
      const truncName = n.node.name?.length > 20 ? n.node.name.slice(0, 18) + '\u2026' : n.node.name;
      const lx = n.x;

      return <g key={n.id}
        onMouseEnter={() => setHoverNodeId(n.id)}
        onMouseLeave={() => setHoverNodeId(null)}
        onClick={ev => { if (wasDragRef.current) return; ev.stopPropagation(); handleAssetClick(n); }}
        style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1 }}
      >
        {/* Card */}
        <rect x={lx} y={n.y - CH / 2} width={CW} height={CH} rx={6} fill={tk.bg} stroke={(isH || isS) ? tk.border : `color-mix(in srgb, ${tk.border} 27%, transparent)`} strokeWidth={(isH || isS) ? 1.5 : 1} />
        {/* Header bar */}
        <rect x={lx + 4} y={n.y - CH / 2 + 4} width={CW - 8} height={12} rx={2} fill={tk.border} fillOpacity=".08" />
        {/* Type icon */}
        <g style={{ pointerEvents: 'none' }}><SvgMark type={n.node.type} cx={lx + 14} cy={n.y - CH / 2 + 10} r={4} /></g>
        {/* Type label */}
        <text x={lx + 24} y={n.y - CH / 2 + 12.5} fontSize="8" fill={tk.border} fontWeight="700" fontFamily="monospace" opacity=".7" style={{ pointerEvents: 'none' }}>{tk.label}</text>
        {/* Health dot */}
        {hDot !== 'var(--text-faint)' && <circle cx={lx + CW - 10} cy={n.y - CH / 2 + 10} r="5" fill="transparent"
          onMouseEnter={e => { const hl = hDot === 'var(--accent-red)' ? 'Critical: Expired claims, failed evaluations, or contested attestations' : hDot === 'var(--accent-amber)' ? 'Warning: Some claims expiring soon or requiring attention' : 'Healthy: All claims verified, no expirations within 90 days'; setHealthDotTooltip({ text: hl, x: e.clientX, y: e.clientY }); }}
          onMouseMove={e => setHealthDotTooltip(p => p ? { ...p, x: e.clientX, y: e.clientY } : p)}
          onMouseLeave={() => setHealthDotTooltip(null)} />}
        <circle cx={lx + CW - 10} cy={n.y - CH / 2 + 10} r="3.5" fill={hDot} opacity=".9" style={{ pointerEvents: 'none' }} />
        {/* Expiring pulse */}
        {h.expSoon && !h.bad && <circle cx={lx + CW - 10} cy={n.y - CH / 2 + 10} r="5" fill="none" stroke="var(--accent-amber)" strokeWidth=".8" style={{ pointerEvents: 'none' }}><animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values=".6;.15;.6" dur="2s" repeatCount="indefinite" /></circle>}
        {/* Name */}
        <text x={lx + 10} y={n.y + 2} fontSize="10.5" fill={tk.text} fontWeight="600" style={{ pointerEvents: 'none' }}>{truncName}</text>
        {/* Health bar */}
        {h.total > 0 ? <>
          <rect x={lx + 8} y={n.y + 8} width={bW + 4} height={7} rx={3.5} fill="var(--bg-deep)" opacity=".7" />
          <rect x={lx + 10} y={n.y + 10} width={bW} height={3} rx={1.5} fill="var(--border)" />
          {gW > 0 && <rect x={lx + 10} y={n.y + 10} width={gW} height={3} fill="var(--accent-green)" opacity=".8" />}
          {wW > 0 && <rect x={lx + 10 + gW + (gW > 0 ? 1 : 0)} y={n.y + 10} width={wW} height={3} fill="var(--accent-amber)" opacity=".8" />}
          {rW > 0 && <rect x={lx + 10 + gW + (gW > 0 ? 1 : 0) + wW + (wW > 0 ? 1 : 0)} y={n.y + 10} width={rW} height={3} fill="var(--accent-red)" opacity=".8" />}
          <text x={lx + 50} y={n.y + 14} fontSize="7" fill="var(--text-muted)" fontFamily="monospace" style={{ pointerEvents: 'none' }}>{h.total}</text>
        </> : <text x={lx + 10} y={n.y + 14} fontSize="7" fill="var(--text-faint)" fontFamily="monospace" style={{ pointerEvents: 'none' }}>No claims</text>}
        {/* SDA type label (bottom-right) */}
        {sdaTypeKeys.length === 1 && (() => {
          const sc = SDA_COLORS[sdaTypeKeys[0]];
          return sc ? <text x={lx + CW - 8} y={n.y + 14} fontSize="7" fontWeight="700" fill={sc.color} textAnchor="end" fontFamily="monospace" opacity=".8" style={{ pointerEvents: 'none' }}>{sc.label}</text> : null;
        })()}
        {sdaTypeKeys.length > 1 && <g style={{ pointerEvents: 'none' }}>
          {sdaTypeKeys.map((t, i) => {
            const c = SDA_COLORS[t]?.color || 'var(--text-muted)';
            return <circle key={t} cx={lx + CW - 8 - (sdaTypeKeys.length - 1 - i) * 9} cy={n.y + 14} r={2.5} fill={c} />;
          })}
        </g>}
        {/* POE badge (bottom-right, inside card) */}
        {n.node.evaluations?.length > 0 && (() => {
          const allPass = n.node.evaluations.every(ev => ev.overallResult === 'pass');
          const badgeBg = allPass ? 'var(--accent-green-bg)' : 'var(--accent-amber-bg)';
          const badgeColor = allPass ? 'var(--accent-green)' : 'var(--accent-amber)';
          const badgeText = allPass ? 'POE \u2713' : 'POE \u2717';
          return <g style={{ pointerEvents: 'none' }}>
            <rect x={lx + CW - 32} y={n.y + CH / 2 - 12} width={28} height={10} rx={2} fill={badgeBg} />
            <text x={lx + CW - 18} y={n.y + CH / 2 - 4} fontSize="7" fill={badgeColor} textAnchor="middle" fontWeight="700" fontFamily="monospace">{badgeText}</text>
          </g>;
        })()}
      </g>;
    }

    /* ── Supplier org card (matches buyer-side Organization node) ── */
    if (isSupplier) {
      const custTk = TT.customer;
      const truncName = n.node.name?.length > 32 ? n.node.name.slice(0, 30) + '\u2026' : n.node.name;
      const lx = n.x;
      const cardW = n.w;

      return <g key={n.id}
        onMouseEnter={() => setHoverNodeId(n.id)}
        onMouseLeave={() => setHoverNodeId(null)}
        onClick={ev => { if (wasDragRef.current) return; ev.stopPropagation(); handleSupplierClick(n, edges, layout.assetNodes, layout.buyerNodes); }}
        style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1 }}
      >
        {/* Card */}
        <rect x={lx} y={n.y - CH / 2} width={cardW} height={CH} rx={6} fill={custTk.bg} stroke={(isH || isS) ? custTk.border : `color-mix(in srgb, ${custTk.border} 40%, transparent)`} strokeWidth={(isH || isS) ? 1.5 : 1} />
        {/* Header bar */}
        <rect x={lx + 4} y={n.y - CH / 2 + 4} width={cardW - 8} height={12} rx={2} fill={custTk.border} fillOpacity=".08" />
        {/* Hexagon icon */}
        <g style={{ pointerEvents: 'none' }}><SvgMark type="customer" cx={lx + 14} cy={n.y - CH / 2 + 10} r={4} /></g>
        {/* "Organization" label */}
        <text x={lx + 24} y={n.y - CH / 2 + 12.5} fontSize="8" fill={custTk.border} fontWeight="700" fontFamily="monospace" opacity=".7" style={{ pointerEvents: 'none' }}>Organization</text>
        {/* Health dot */}
        <circle cx={lx + cardW - 14} cy={n.y - CH / 2 + 10} r="3.5" fill="var(--text-faint)" opacity=".9" style={{ pointerEvents: 'none' }} />
        {/* Org name */}
        <text x={lx + 10} y={n.y + 2} fontSize="10.5" fill={custTk.text} fontWeight="600" style={{ pointerEvents: 'none' }}>{truncName}</text>
        {/* Bottom row */}
        <text x={lx + 10} y={n.y + 14} fontSize="7" fill="var(--text-muted)" fontFamily="monospace" style={{ pointerEvents: 'none' }}>{n.assetCount} asset{n.assetCount !== 1 ? 's' : ''} registered</text>
      </g>;
    }

    /* ── Buyer org card (matches buyer-side right/supplier card) ── */
    const truncName = n.node.name?.length > 20 ? n.node.name.slice(0, 18) + '\u2026' : n.node.name;
    const rx = n.x;

    return <g key={n.id}
      onMouseEnter={() => setHoverNodeId(n.id)}
      onMouseLeave={() => setHoverNodeId(null)}
      onClick={ev => { if (wasDragRef.current) return; ev.stopPropagation(); handleBuyerClick(n, edges); }}
      style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1 }}
    >
      {/* Card */}
      <rect x={rx} y={n.y - CH / 2} width={CW} height={CH} rx={6} fill="var(--bg-app-header)" stroke={(isH || isS) ? `color-mix(in srgb, ${tk.border} 53%, transparent)` : 'var(--border)'} strokeWidth={(isH || isS) ? 1.5 : 1} />
      {/* Header bar */}
      <rect x={rx + 4} y={n.y - CH / 2 + 4} width={CW - 8} height={12} rx={2} fill="var(--border)" fillOpacity=".5" />
      {/* "Buyer" label */}
      <text x={rx + 10} y={n.y - CH / 2 + 12.5} fontSize="8" fill="var(--text-tertiary)" fontWeight="600" fontFamily="monospace" opacity=".7" style={{ pointerEvents: 'none' }}>Buyer</text>
      {/* Buyer name */}
      <text x={rx + 10} y={n.y + 2} fontSize="10" fill="var(--text-primary)" fontWeight="500" style={{ pointerEvents: 'none' }}>{truncName}</text>
      {/* Asset count + SDA dots */}
      <text x={rx + 10} y={n.y + 14} fontSize="7.5" fill="var(--text-muted)" fontFamily="monospace" style={{ pointerEvents: 'none' }}>{n.assetCount} asset{n.assetCount !== 1 ? 's' : ''}</text>
      {(n.sdaTypes || []).map((t, i) => {
        const c = SDA_COLORS[t]?.color || 'var(--text-muted)';
        return <circle key={t} cx={rx + 52 + i * 9} cy={n.y + 14} r={2.5} fill={c} style={{ pointerEvents: 'none' }} />;
      })}
    </g>;
  });

  return <div ref={containerRef}
    style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-deep)', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', WebkitUserSelect: 'none' }}
    onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
    onClick={() => {
      if (wasDragRef.current) { wasDragRef.current = false; return; }
      setInternalSelId(null);
      if (onNodeSelect) onNodeSelect(null);
    }}>

    <svg width={size.w} height={size.h} style={{ position: 'absolute', top: 0, left: 0 }}>
      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        {renderedEdges}
        {renderedNodes}
      </g>
    </svg>

    {/* ── Edge tooltip ── */}
    {edgeTooltip && <div style={{
      position: 'absolute', left: edgeTooltip.x + 10, top: edgeTooltip.y - 32, zIndex: 60,
      background: 'var(--border)', border: '1px solid var(--border-hover)', borderRadius: 5,
      padding: '5px 10px', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace',
      whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.4)',
    }}>{edgeTooltip.text}</div>}

    {/* ── Health dot tooltip ── */}
    {healthDotTooltip && <div style={{
      position: 'fixed', left: healthDotTooltip.x + 10, top: healthDotTooltip.y - 32, zIndex: 60,
      background: 'var(--border)', border: '1px solid var(--border-hover)', borderRadius: 4,
      padding: '3px 8px', fontSize: 10, color: 'var(--text-primary)', whiteSpace: 'nowrap', pointerEvents: 'none',
    }}>{healthDotTooltip.text}</div>}

    {/* ── Zoom controls (top-right, shifts when panel open) ── */}
    <div style={{ position: 'absolute', top: 54, right: panelOpen ? 376 : 16, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 2, transition: 'right .3s ease' }}>
      {[['+', () => zoomCentered(1.15)],
        ['\u2212', () => zoomCentered(1 / 1.15)],
        ['FIT', fitAll],
      ].map(([l, fn]) =>
        <button key={l} onClick={e => { e.stopPropagation(); fn(); }}
          style={{
            width: 28, height: 28, background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer',
            fontSize: l === 'FIT' ? 9 : 16, fontFamily: l === 'FIT' ? 'monospace' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{l}</button>)}
      <div style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: 'monospace', textAlign: 'center', marginTop: 4 }}>{Math.round(zoom * 100)}%</div>
    </div>

    {/* ── Network Updates pillbox ── */}
    {(() => {
      const refNode = cycleEvt?.nodeId ? byId[cycleEvt.nodeId] : null;
      const refTk = refNode ? (TT[refNode.node.type] || TT.component) : null;
      const evtBottom = (evtStage === 2 || evtStage === 3) ? 112 : 100;
      return <div style={{
        position: 'absolute', bottom: evtBottom, left: '50%', transform: 'translateX(-50%)', zIndex: 35,
        transition: 'bottom 0.3s ease',
      }} onClick={e => e.stopPropagation()}>
        {/* Stage 0: Bell icon */}
        {evtStage === 0 && <div onClick={() => { setEvtFade(1); setEvtStage(3); }}
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', boxSizing: 'border-box', transition: 'border-color .15s, background .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}>
          <BellSvg size={16} stroke="var(--text-muted)" sw={1.5} />
        </div>}

        {/* Stage 1: Awake pill */}
        {evtStage === 1 && unreadEvtCount > 0 && <div
          onClick={() => {
            setEvtPaused(false); setEvtStage(2); setEvtIdx(0); setEvtFade(1);
            setEvtCycleReset(k => k + 1); setEvtRadialKey(k => k + 1);
            const evt = unreadEvts[0];
            if (evt && evtAnimatePanRef.current) evtAnimatePanRef.current(evt.nodeId);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', border: '1px solid rgba(245,158,11,0.5)', borderRadius: 20, padding: '8px 16px', cursor: 'pointer', boxShadow: '0 0 12px rgba(251,191,36,0.15)', transition: 'border-color .15s, background .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.7)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}>
          <RingBellSvg size={16} stroke="var(--accent-amber)" sw={2} />
          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{unreadEvtCount} new update{unreadEvtCount !== 1 ? 's' : ''}</span>
        </div>}

        {/* Stages 2 & 3: Shared container */}
        {(evtStage === 2 || evtStage === 3) && <div style={{
          width: 448, maxHeight: evtStage === 3 ? 475 : 'auto',
          background: 'var(--bg-surface)', border: '1.5px solid #fb923c', borderRadius: 12,
          boxShadow: '0 6px 28px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'max-height 0.3s ease',
        }}>
          {/* Stage 2: Cycling card */}
          {evtStage === 2 && cycleEvt && <div style={{ padding: '16px 20px', flexShrink: 0 }}
            onMouseEnter={() => setEvtHovering(true)} onMouseLeave={() => setEvtHovering(false)}>
            {/* Row 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, color: EVT_COLORS[cycleEvt.type] || 'var(--text-tertiary)', flexShrink: 0, opacity: evtFade, transition: 'opacity 0.2s' }}>
                {EVT_ICONS[cycleEvt.type] || '●'}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: evtFade, transition: 'opacity 0.2s' }}>
                {EVT_TITLES[cycleEvt.type] || cycleEvt.type}
              </span>
              {!atEvtEnd && <EvtCountdown running={!evtHovering && !evtPaused} resetKey={evtRadialKey} />}
              <button onClick={evtGoList} style={{
                display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-tertiary)', flexShrink: 0,
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', lineHeight: 1, height: 28,
                transition: 'border-color .15s, color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                {safeEvtIdx + 1} / {unreadEvtCount}<span style={{ fontSize: 8, marginLeft: 2 }}>▴</span>
              </button>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <EvtNavBtn onClick={evtNavPrev} disabled={atEvtStart}>‹</EvtNavBtn>
                <EvtNavBtn onClick={() => {
                  const np = !evtPaused; setEvtPaused(np);
                  if (!np) { setEvtCycleReset(k => k + 1); setEvtRadialKey(k => k + 1); }
                }}>
                  {evtPaused
                    ? <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: 'block' }}><polygon points="2,1 9,5 2,9" fill="currentColor" /></svg>
                    : <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: 'block' }}><rect x="1" y="1" width="3" height="8" fill="currentColor" /><rect x="6" y="1" width="3" height="8" fill="currentColor" /></svg>
                  }
                </EvtNavBtn>
                <EvtNavBtn onClick={evtNavNext} disabled={atEvtEnd}>›</EvtNavBtn>
                <EvtNavBtn onClick={evtCloseIdle} fontSize={12}>✕</EvtNavBtn>
              </div>
            </div>
            {/* Row 2: Node type */}
            {refNode && <div style={{ marginTop: 6, opacity: evtFade, transition: 'opacity 0.2s' }}>
              <span style={{ fontSize: 12, color: refTk?.border || 'var(--text-tertiary)' }}>{refNode.col === 'buyer' ? '⬡' : refNode.col === 'supplier' ? '⬡' : (TT[refNode.node.type] ? '⬣' : '●')}</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginLeft: 4 }}>
                {refNode.col === 'buyer' ? 'Buyer' : refNode.col === 'supplier' ? 'Organization' : (refTk?.label || refNode.node.type)}
              </span>
            </div>}
            {/* Row 3: Node name */}
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: refNode ? 2 : 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: evtFade, transition: 'opacity 0.2s' }}>
              {refNode ? refNode.node.name : cycleEvt.message}
            </div>
            {/* Row 4: Message */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 6, opacity: evtFade, transition: 'opacity 0.2s' }}>{cycleEvt.message}</div>
            {/* Row 5: Detail */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, opacity: evtFade, transition: 'opacity 0.2s' }}>{cycleEvt.detail}</div>
          </div>}

          {/* Stage 3: Expanded list */}
          {evtStage === 3 && <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Network Updates</span>
              <EvtNavBtn onClick={evtCloseList} fontSize={12}>✕</EvtNavBtn>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {supplierEvents.map((evt, i) => <div key={evt.id}
                onClick={() => evtClickItem(evt)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                  borderBottom: i < supplierEvents.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', opacity: evt.read ? 0.5 : 1, transition: 'background .15s, opacity .3s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-deep)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 14, color: EVT_COLORS[evt.type] || 'var(--text-tertiary)', flexShrink: 0 }}>
                  {EVT_ICONS[evt.type] || '●'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{evt.message}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{evt.detail}</span>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>{relTime(evt.timestamp)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
              </div>)}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button onClick={evtMarkAllRead}
                style={{ width: '100%', padding: '6px 14px', fontSize: 11, textAlign: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'border-color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}>Mark All as Read</button>
            </div>
          </>}
        </div>}
      </div>;
    })()}

    {/* ── Legend (bottom center) ── */}
    <div style={{
      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
      background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8,
      padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6,
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {NODE_LEGEND.map(l => (
          <div key={l.type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={12} height={12}><SvgMark type={l.type} cx={6} cy={6} r={5} /></svg>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{l.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {DISC_LEGEND.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative', cursor: 'default' }}
            onMouseEnter={() => setLegendHover(l.label)} onMouseLeave={() => setLegendHover(null)}>
            <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke={l.stroke} strokeWidth={l.dash ? 1.2 : 1.5} strokeDasharray={l.dash} /></svg>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{l.label}</span>
            {legendHover === l.label && <div style={{
              position: 'fixed', bottom: 60, left: 'auto', zIndex: 100,
              background: 'var(--border)', border: '1px solid var(--border-hover)', borderRadius: 4,
              padding: '3px 8px', fontSize: 10, color: 'var(--text-primary)', whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>{l.tip}</div>}
          </div>
        ))}
        <span style={{ width: 1, height: 10, background: 'var(--border)', margin: '0 2px', display: 'inline-block' }} />
        {HEALTH_LEGEND.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3, position: 'relative', cursor: 'default' }}
            onMouseEnter={() => setLegendHover(l.label)} onMouseLeave={() => setLegendHover(null)}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{l.label}</span>
            {legendHover === l.label && <div style={{
              position: 'fixed', bottom: 60, left: 'auto', zIndex: 100,
              background: 'var(--border)', border: '1px solid var(--border-hover)', borderRadius: 4,
              padding: '3px 8px', fontSize: 10, color: 'var(--text-primary)', whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>{l.tip}</div>}
          </div>
        ))}
      </div>
    </div>
  </div>;
}
