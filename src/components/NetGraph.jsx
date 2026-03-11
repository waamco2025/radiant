import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { TT } from '../data/tokens';
import SvgMark from './SvgMark';
import SubgraphModal from './SubgraphModal';

const MAX_RENDER = 200;
const CW = 195, CH = 58, GAP = 6, TOTAL = CW * 2 + GAP;
const LOD_THRESHOLD = 0.60;
const MIN_ZOOM = 0.20, MAX_ZOOM = 1.50;
const DECAY = 0.92, VEL_STOP = 0.5;

const displayZoom = z => Math.round(((z - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 90 + 10);

export default function NetGraph({ data, onSelect, sel, onCloseSel, onViewChain, rev, onRev, chainRequest, onClearChainRequest, resetZoomKey, fitViewKey, panTo, attFilterMatch, supplierLabel, nodeTypeLabels, credits, setCredits, onEvaluationComplete, dataRev, revealedSet, onRevealNode, invitedSet, onInvite, onRevokeInvite, vert, terminalTypes, onRequirementsClick, highlightedEventNode, eventsActive, onOpenSystemModal, approvalStates, evidenceRequests }) {
  // ── Core state ──────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hov, setHov] = useState(null);
  const [cSize, setCSize] = useState({ w: 1200, h: 800 });
  const [vpSnap, setVpSnap] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [tooltip, setTooltip] = useState(null);
  const [convTooltip, setConvTooltip] = useState(null);
  const [edgeTooltip, setEdgeTooltip] = useState(null);
  const [modalNodeId, setModalNodeId] = useState(null);

  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const innerGRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0, wasDrag: false });
  const clickTimerRef = useRef(null);
  const debounceRef = useRef(null);
  const momentumRef = useRef(null);
  const velRef = useRef({ vx: 0, vy: 0 });
  const lastMouseRef = useRef({ x: 0, y: 0, t: 0 });
  const panAnimRef = useRef(null);
  const hovClearRef = useRef(null);
  const initialPanDone = useRef(false);

  // ── Cleanup animations on unmount ────────────────────────────────
  useEffect(() => () => { if (momentumRef.current) cancelAnimationFrame(momentumRef.current); if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current); }, []);

  // ── Clear CSS transform after pan state update (fixes snap-back) ──
  useLayoutEffect(() => {
    if (!dragRef.current.active && innerGRef.current) {
      innerGRef.current.style.transform = "";
    }
  }, [pan]);

  // ── Container resize ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) setCSize({ w: width, h: height });
      }
    });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // ── Graph layout (stable) ──────────────────────────────────────────
  const { gN, gE } = useMemo(() => {
    const nodes = [], edges = [], conv = {}, dm = {};
    function walk(n, d, pid) {
      if (n.convergenceKey && conv[n.convergenceKey]) { if (pid) edges.push({ from: pid, to: conv[n.convergenceKey], conv: true }); return; }
      nodes.push({ ...n, depth: d }); if (n.convergenceKey) conv[n.convergenceKey] = n.id;
      if (pid) edges.push({ from: pid, to: n.id }); if (!dm[d]) dm[d] = []; dm[d].push(n.id);
      if (n.children) n.children.forEach(c => walk(c, d + 1, n.id));
    }
    walk(data, 0, null);
    const colW = 480, rowH = 78, pos = {};
    Object.entries(dm).forEach(([d, ids]) => { const depth = parseInt(d); const x = 80 + depth * colW; const startY = -(ids.length - 1) * rowH / 2; ids.forEach((id, i) => { pos[id] = { x, y: startY + i * rowH }; }); });
    return { gN: nodes.map(n => ({ ...n, x: pos[n.id]?.x || 0, y: pos[n.id]?.y || 0 })), gE: edges };
  }, [data]);

  const bds = useMemo(() => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; gN.forEach(n => { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }); return { minX: x0 - 60, maxX: x1 + 440, minY: y0 - 60, maxY: y1 + 60 }; }, [gN]);
  const byId = useMemo(() => { const m = {}; gN.forEach(n => m[n.id] = n); return m; }, [gN]);

  // ── Attestation health per node ──────────────────────────────────
  const healthMap = useMemo(() => {
    const m = {};
    const REF_T = new Date('2026-02-17').getTime();
    gN.forEach(n => {
      const raw = n.rawAttestations || [];
      let ok = 0, warn = 0, bad = 0, expSoon = false, hasEval = false;
      for (const a of raw) {
        if (a.status === 'contested' || a.status === 'revoked') bad++;
        else if (a.status === 'expired' || a.status === 'pending') warn++;
        else ok++;
        if (a.status === 'verified' && a.validUntil) {
          const diff = (new Date(a.validUntil).getTime() - REF_T) / 86400000;
          if (diff > 0 && diff <= 30) expSoon = true;
        }
        if (a.predicate === 'evaluated_against_requirements') hasEval = true;
      }
      m[n.id] = { ok, warn, bad, expSoon, total: raw.length, hasEval };
    });
    return m;
  }, [gN, dataRev]);

  // ── Unrevealed / ghost node sets ──────────────────────────────────
  const unrevealedSet = useMemo(() => {
    const s = new Set();
    gN.forEach(n => { if (n.isNew && !revealedSet.has(n.id)) s.add(n.id); });
    return s;
  }, [gN, revealedSet]);

  const [revealAnim, setRevealAnim] = useState(new Set());

  const dataW = bds.maxX - bds.minX, dataH = bds.maxY - bds.minY;
  const dataCX = (bds.minX + bds.maxX) / 2, dataCY = (bds.minY + bds.maxY) / 2;

  // ── Pan clamping (50% of chain dimensions as padding) ──────────────
  const clampPan = useCallback((px, py, z) => {
    const vw = cSize.w / z, vh = cSize.h / z;
    const padX = dataW * 0.5, padY = dataH * 0.5;
    const maxPX = (dataCX - vw / 2 - (bds.minX - padX)) * z;
    const minPX = (dataCX + vw / 2 - (bds.maxX + padX)) * z;
    const maxPY = (dataCY - vh / 2 - (bds.minY - padY)) * z;
    const minPY = (dataCY + vh / 2 - (bds.maxY + padY)) * z;
    return {
      x: minPX > maxPX ? (minPX + maxPX) / 2 : Math.max(minPX, Math.min(maxPX, px)),
      y: minPY > maxPY ? (minPY + maxPY) / 2 : Math.max(minPY, Math.min(maxPY, py))
    };
  }, [cSize, dataCX, dataCY, bds, dataW, dataH]);

  // ── Tier lines for LOD mode ─────────────────────────────────────────
  const tierLines = useMemo(() => {
    const byDepth = {};
    gN.forEach(n => {
      const cx = n.x + TOTAL / 2;
      if (!byDepth[n.depth]) byDepth[n.depth] = { x: cx, minY: n.y, maxY: n.y };
      else { byDepth[n.depth].minY = Math.min(byDepth[n.depth].minY, n.y); byDepth[n.depth].maxY = Math.max(byDepth[n.depth].maxY, n.y); }
    });
    return Object.values(byDepth);
  }, [gN]);

  // ── Adjacency lists (used for chain computation) ───────────────────
  const { adjUp, adjDown } = useMemo(() => {
    const up = {}, dn = {};
    gE.forEach((e, i) => {
      if (!up[e.to]) up[e.to] = []; up[e.to].push({ idx: i, from: e.from });
      if (!dn[e.from]) dn[e.from] = []; dn[e.from].push({ idx: i, to: e.to });
    });
    return { adjUp: up, adjDown: dn };
  }, [gE]);

  // ── Chain computation for modal ─────────────────────────────────────
  const chainIds = useMemo(() => {
    if (!modalNodeId) return null;
    const s = new Set([modalNodeId]);
    const traceUp = id => { (adjUp[id] || []).forEach(({ from }) => { if (!s.has(from)) { s.add(from); traceUp(from); } }); };
    const traceDown = id => { (adjDown[id] || []).forEach(({ to }) => { if (!s.has(to)) { s.add(to); traceDown(to); } }); };
    traceUp(modalNodeId); traceDown(modalNodeId);
    return s;
  }, [modalNodeId, adjUp, adjDown]);

  const modalTitle = modalNodeId ? `CHAIN: ${byId[modalNodeId]?.name || "Node"}` : "";

  // ── External chain request (from "View Chain →" button) ────────────
  useEffect(() => {
    if (chainRequest) {
      setModalNodeId(chainRequest);
      onClearChainRequest();
    }
  }, [chainRequest, onClearChainRequest]);

  // Escape to close modal
  useEffect(() => {
    if (!chainIds) return;
    const onKey = e => {
      if (e.key === "Escape") { setModalNodeId(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chainIds]);

  const closeModal = useCallback(() => { setModalNodeId(null); }, []);

  // ── Debounced viewport snapshot ────────────────────────────────────
  const scheduleSnap = useCallback((z, px, py) => {
    clearTimeout(debounceRef.current);
    if (dragRef.current.active || momentumRef.current) return;
    debounceRef.current = setTimeout(() => setVpSnap({ zoom: z, panX: px, panY: py }), 100);
  }, []);

  useEffect(() => { scheduleSnap(zoom, pan.x, pan.y); }, [zoom, pan, scheduleSnap]);

  // ── ViewBox ────────────────────────────────────────────────────────
  const vbW = cSize.w / zoom, vbH = cSize.h / zoom;
  const vbX = dataCX - vbW / 2 - pan.x / zoom;
  const vbY = dataCY - vbH / 2 - pan.y / zoom;
  const isLOD = zoom < LOD_THRESHOLD;

  // ── Viewport culling ───────────────────────────────────────────────
  const visibleNodes = useMemo(() => {
    const sz = vpSnap.zoom;
    const svbW = cSize.w / sz, svbH = cSize.h / sz;
    const svbX = dataCX - svbW / 2 - vpSnap.panX / sz;
    const svbY = dataCY - svbH / 2 - vpSnap.panY / sz;
    return gN.filter(n => n.x + TOTAL >= svbX && n.x <= svbX + svbW && n.y + CH / 2 >= svbY && n.y - CH / 2 <= svbY + svbH);
  }, [gN, vpSnap, cSize, dataCX, dataCY]);

  // ── Render cap ─────────────────────────────────────────────────────
  const { renderNodes, capped } = useMemo(() => {
    if (visibleNodes.length <= MAX_RENDER) return { renderNodes: visibleNodes, capped: false };
    const sz = vpSnap.zoom;
    const svbW = cSize.w / sz, svbH = cSize.h / sz;
    const cx = dataCX - svbW / 2 - vpSnap.panX / sz + svbW / 2;
    const cy = dataCY - svbH / 2 - vpSnap.panY / sz + svbH / 2;
    const scored = visibleNodes.map(n => ({ n, d: (n.x + TOTAL / 2 - cx) ** 2 + (n.y - cy) ** 2 }));
    scored.sort((a, b) => a.d - b.d);
    return { renderNodes: scored.slice(0, MAX_RENDER).map(s => s.n), capped: true };
  }, [visibleNodes, vpSnap, cSize, dataCX, dataCY]);

  const renderNodeIds = useMemo(() => { const s = new Set(); renderNodes.forEach(n => s.add(n.id)); return s; }, [renderNodes]);

  // ── Visible edges — hide convergence at card zoom ──────────────────
  const visibleEdges = useMemo(() => {
    if (isLOD) return []; // LOD: tier lines only
    const result = [];
    gE.forEach((e, i) => {
      if (e.conv) return; // convergence edges shown only on hover
      if (renderNodeIds.has(e.from) || renderNodeIds.has(e.to))
        result.push({ edge: e, idx: i });
    });
    return result;
  }, [gE, renderNodeIds, isLOD]);

  // ── Hover convergence edges — show only for hovered node's chain ───
  const hovConvEdges = useMemo(() => {
    if (!hov || isLOD) return [];
    const chain = new Set([hov]);
    const traceUp = id => { (adjUp[id] || []).forEach(({ from }) => { if (!chain.has(from)) { chain.add(from); traceUp(from); } }); };
    const traceDown = id => { (adjDown[id] || []).forEach(({ to }) => { if (!chain.has(to)) { chain.add(to); traceDown(to); } }); };
    traceUp(hov); traceDown(hov);
    const result = [];
    gE.forEach((e, i) => {
      if (e.conv && chain.has(e.from) && chain.has(e.to) && (renderNodeIds.has(e.from) || renderNodeIds.has(e.to)))
        result.push({ edge: e, idx: i });
    });
    return result;
  }, [hov, isLOD, adjUp, adjDown, gE, renderNodeIds]);

  // ── Native wheel handler — 1.5% zoom per tick ─────────────────────
  // Disabled when SubgraphModal is open so it can't intercept scroll/zoom
  // Disabled during Network Events cycling to prevent accidental scroll zoom
  const eventsActiveRef = useRef(eventsActive); eventsActiveRef.current = eventsActive;
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    if (modalNodeId) return;
    const h = e => {
      e.preventDefault();
      if (eventsActiveRef.current) return;
      const dir = e.deltaY > 0 ? 0.985 : 1.015;
      setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * dir)));
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [modalNodeId]);

  // ── CSS-transform pan with momentum ────────────────────────────────
  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, wasDrag: false };
    lastMouseRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    velRef.current = { vx: 0, vy: 0 };
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
  }, [pan]);

  const onMouseMove = useCallback(e => {
    const d = dragRef.current; if (!d.active) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.wasDrag = true;
    const now = performance.now();
    const last = lastMouseRef.current;
    const dt = now - last.t;
    if (dt > 0 && dt < 100) {
      velRef.current = { vx: (e.clientX - last.x) / dt * 16, vy: (e.clientY - last.y) / dt * 16 };
    }
    lastMouseRef.current = { x: e.clientX, y: e.clientY, t: now };
    if (innerGRef.current) innerGRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
  }, []);

  const endDrag = useCallback(e => {
    const d = dragRef.current; if (!d.active) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    let px = d.panX + dx, py = d.panY + dy;
    const clamped = clampPan(px, py, zoom);
    px = clamped.x; py = clamped.y;
    d.active = false;
    if (containerRef.current) containerRef.current.style.cursor = "grab";
    setPan({ x: px, y: py });
    const now = performance.now();
    const dt = now - lastMouseRef.current.t;
    const v = dt < 50 ? velRef.current : { vx: 0, vy: 0 };
    if (Math.abs(v.vx) > VEL_STOP || Math.abs(v.vy) > VEL_STOP) {
      let vx = v.vx, vy = v.vy;
      const animate = () => {
        vx *= DECAY; vy *= DECAY;
        if (Math.abs(vx) < VEL_STOP && Math.abs(vy) < VEL_STOP) { momentumRef.current = null; setVpSnap({ zoom, panX: px, panY: py }); return; }
        px += vx; py += vy;
        const c = clampPan(px, py, zoom);
        px = c.x; py = c.y;
        setPan({ x: px, y: py });
        momentumRef.current = requestAnimationFrame(animate);
      };
      momentumRef.current = requestAnimationFrame(animate);
    }
  }, [clampPan, zoom]);

  // ── Fit all ────────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    const zx = cSize.w / (dataW || 1);
    const zy = cSize.h / (dataH || 1);
    const cap = gN.length <= 5 ? 0.8 : MAX_ZOOM;
    const z = Math.max(MIN_ZOOM, Math.min(cap, Math.min(zx, zy) * 0.90));
    setZoom(z);
    setPan({ x: 0, y: 0 });
    setVpSnap({ zoom: z, panX: 0, panY: 0 });
  }, [cSize, dataW, dataH, gN.length]);

  // ── Center on org node on initial mount only ─────────────────────
  useEffect(() => {
    if (initialPanDone.current) return;
    const orgNode = gN.find(n => n.type === 'customer');
    if (!orgNode) return;
    initialPanDone.current = true;
    const tx = orgNode.x + TOTAL / 2, ty = orgNode.y;
    setZoom(1);
    setPan({ x: (dataCX - tx) * 1, y: (dataCY - ty) * 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── Keyboard zoom reset / fit ────────────────────────────────────
  useEffect(() => { if (resetZoomKey > 0) { setZoom(1); setPan({ x: 0, y: 0 }); } }, [resetZoomKey]);
  const fitAllRef = useRef(fitAll); fitAllRef.current = fitAll;
  useEffect(() => { if (fitViewKey > 0) fitAllRef.current(); }, [fitViewKey]);

  // ── Pan-to-node animation (breadcrumb click) ─────────────────────
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const panRef = useRef(pan); panRef.current = pan;

  useEffect(() => {
    if (!panTo) return;
    const node = byId[panTo.id];
    if (!node) { console.log('[NetGraph] panTo node NOT in byId:', panTo.id); return; }
    if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current);
    const tx = node.x + TOTAL / 2, ty = node.y;
    const startZ = zoomRef.current, startPx = panRef.current.x, startPy = panRef.current.y;
    const targetZ = panTo.targetZoom != null ? panTo.targetZoom : (startZ < LOD_THRESHOLD ? LOD_THRESHOLD : startZ);
    console.log('[NetGraph] panTo:', panTo.id, 'startZ:', startZ, '→ targetZ:', targetZ, 'targetZoom prop:', panTo.targetZoom);
    const targetPx = (dataCX - tx) * targetZ;
    const targetPy = (dataCY - ty) * targetZ;
    const cTarget = clampPan(targetPx, targetPy, targetZ);
    const dur = 400;
    const t0 = performance.now();
    const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const animate = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = ease(p);
      const z = startZ + (targetZ - startZ) * e;
      const px = startPx + (cTarget.x - startPx) * e;
      const py = startPy + (cTarget.y - startPy) * e;
      setZoom(z); setPan({ x: px, y: py });
      if (p < 1) panAnimRef.current = requestAnimationFrame(animate);
      else { panAnimRef.current = null; setTimeout(() => console.log('[NetGraph] zoom 500ms after panTo:', zoomRef.current, 'display:', displayZoom(zoomRef.current) + '%'), 500); }
    };
    panAnimRef.current = requestAnimationFrame(animate);
    return () => { if (panAnimRef.current) { cancelAnimationFrame(panAnimRef.current); panAnimRef.current = null; } };
  }, [panTo, byId, dataCX, dataCY, clampPan]);

  // ── Background click — close DetailPanel ──────────────────────────
  const onContainerClick = useCallback(() => {
    if (dragRef.current.wasDrag) return;
    setTooltip(null);
    if (onCloseSel) onCloseSel();
  }, [onCloseSel]);

  // ── LOD icon sizing ─────────────────────────────────────────────────
  const iconR = isLOD ? 14 / zoom : 8;
  const bgR = isLOD ? 18 / zoom : 14;

  // ── Node click: single = select (DetailPanel), double = open modal ─
  const onNodeClick = useCallback((e, n) => {
    e.stopPropagation();
    if (dragRef.current.wasDrag) return;
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    if (n.isNew && !revealedSet.has(n.id) && onRevealNode) {
      onRevealNode(n.id);
      setRevealAnim(s => { const ns = new Set(s); ns.add(n.id); return ns; });
      setTimeout(() => setRevealAnim(s => { const ns = new Set(s); ns.delete(n.id); return ns; }), 600);
      clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; onSelect(n); }, 600);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onSelect(n);
      if (n.isNew && !rev.has(n.id)) onRev(n.id);
    }, 250);
  }, [onSelect, rev, onRev, revealedSet, onRevealNode]);

  const onNodeDblClick = useCallback((e, n) => {
    e.stopPropagation();
    if (n.type === 'customer') return;
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    setModalNodeId(n.id);
  }, []);

  // ── Panel open state for zoom control shift ────────────────────────
  const panelOpen = !!sel && !chainIds;

  return <div ref={containerRef}
    style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", cursor: "grab", userSelect: "none", WebkitUserSelect: "none", boxSizing: 'border-box' }}
    onClick={onContainerClick}
    onMouseDown={onMouseDown}
    onMouseMove={onMouseMove}
    onMouseUp={endDrag}
    onMouseLeave={endDrag}>

    {/* Zoom controls — shift left when DetailPanel is open */}
    <div style={{ position: "absolute", top: 54, right: panelOpen ? 376 : 16, zIndex: 30, display: "flex", flexDirection: "column", gap: 2, transition: "right .3s ease" }}>
      {[["+", () => setZoom(z => Math.min(MAX_ZOOM, z * 1.15))], ["\u2212", () => setZoom(z => Math.max(MIN_ZOOM, z * 0.87))], ["FIT", fitAll]].map(([l, fn]) =>
        <button key={l} onClick={e => { e.stopPropagation(); fn(); }} style={{ width: 28, height: 28, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", fontSize: l === "FIT" ? 9 : 16, fontFamily: l === "FIT" ? "monospace" : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</button>)}
      <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "monospace", textAlign: "center", marginTop: 4 }}>{displayZoom(zoom)}%</div>
    </div>

    {/* Capped indicator */}
    {capped && <div style={{ position: "absolute", top: 54, left: 16, zIndex: 30, padding: "4px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 5, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
      Showing {MAX_RENDER}/{visibleNodes.length} nodes — zoom in to see all
    </div>}

    {/* Filter badge */}
    {attFilterMatch&&<div style={{position:"absolute",top:54,left:capped?200:16,zIndex:30,padding:"3px 8px",background:"var(--accent-indigo-bg)",border:"1px solid color-mix(in srgb, var(--accent-indigo) 20%, transparent)",borderRadius:4,fontSize:9,fontWeight:700,fontFamily:"monospace",color:"var(--accent-indigo)",letterSpacing:".04em",transition:"left .3s ease"}}>FILTERED · {attFilterMatch.size} of {visibleNodes.length}</div>}

    {/* Hover tooltip (LOD mode only) */}
    {tooltip && <div style={{ position: "absolute", left: tooltip.x + 14, top: tooltip.y - 8, zIndex: 40, pointerEvents: "none", padding: "5px 8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 5, maxWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tooltip.name}</div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tooltip.supplier}</div>
    </div>}

    {/* Convergence line tooltip */}
    {convTooltip && <div style={{ position: "absolute", left: convTooltip.x + 14, top: convTooltip.y - 8, zIndex: 42, pointerEvents: "none", padding: "6px 8px", background: "var(--border)", border: "1px solid #333", borderRadius: 4, maxWidth: 240, boxShadow: "0 4px 12px rgba(0,0,0,.5)" }}>
      <div style={{ fontSize: 9, color: "var(--text-primary)", lineHeight: 1.4, whiteSpace: "normal" }}>{convTooltip.text}</div>
    </div>}

    {/* Edge hover tooltip */}
    {edgeTooltip && <div style={{ position: "absolute", left: edgeTooltip.x + 14, top: edgeTooltip.y - 8, zIndex: 41, pointerEvents: "none", padding: "6px 8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, maxWidth: 260, boxShadow: "0 4px 12px rgba(0,0,0,.5)" }}>
      <div style={{ fontSize: 9, color: "var(--text-primary)", lineHeight: 1.4, whiteSpace: "normal" }}>{edgeTooltip.text}</div>
    </div>}

    <svg ref={svgRef} style={{ width: "100%", height: "100%", willChange: "viewBox" }}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--text-faint)" /></marker>
        <marker id="arr-full" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-sda-full)" /></marker>
        <marker id="arr-sel" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-amber)" /></marker>
        <marker id="arr-der" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-green)" /></marker>
        <marker id="arr-casc" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-sda-cascade)" /></marker>
        <filter id="gl"><feGaussianBlur stdDeviation="3" result="g" /><feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g ref={innerGRef} style={{ willChange: "transform" }}>
        {/* Tier lines in LOD mode */}
        {isLOD && tierLines.map((t, i) =>
          <line key={`tier-${i}`} x1={t.x} y1={t.minY} x2={t.x} y2={t.maxY}
            stroke="var(--border)" strokeWidth={2} opacity={0.3} />
        )}

        {/* Edges — supply links only, no convergence */}
        {visibleEdges.map(({ edge: e, idx: i }) => {
          const from = byId[e.from], to = byId[e.to]; if (!from || !to) return null;
          const mx = (from.x + TOTAL + to.x) / 2;
          const dim = attFilterMatch && (!attFilterMatch.has(e.from) || !attFilterMatch.has(e.to));
          const sda = to.sda;
          const sdaType = sda?.type;
          const isCascade = sda?.scope === 'cascade' || (to.sdas || []).some(s => s.scope === 'cascade');
          const isPending = sda?.status === 'pending';
          const isExpired = sda?.status === 'expired';
          const stroke = !sda ? 'var(--text-muted)' : isPending ? 'var(--border-hover)' : isCascade ? 'var(--accent-sda-cascade)' : sdaType === 'full' ? 'var(--accent-sda-full)' : sdaType === 'selective' ? 'var(--accent-amber)' : sdaType === 'derivative' ? 'var(--accent-green)' : 'var(--text-muted)';
          const provTarget = !['customer','program','system'].includes(byId[e.to]?.type) && approvalStates?.[e.to]?.status !== 'approved';
          const dash = isCascade ? '8,3,2,3' : sdaType === 'selective' ? '4,3' : sdaType === 'derivative' ? '2,4' : provTarget && !sda ? '6,4' : undefined;
          const sw = isCascade ? 1.3 : (sda && !isPending && sdaType === 'full') ? 1.5 : 1;
          const baseOpacity = isExpired ? 0.125 : !sda ? 0.55 : sdaType === 'full' ? 0.45 : 0.5;
          const marker = !sda || isPending ? 'url(#arr)' : isCascade ? 'url(#arr-casc)' : sdaType === 'full' ? 'url(#arr-full)' : sdaType === 'selective' ? 'url(#arr-sel)' : sdaType === 'derivative' ? 'url(#arr-der)' : 'url(#arr)';
          const d = `M${from.x + TOTAL} ${from.y} C${mx} ${from.y},${mx} ${to.y},${to.x - 6} ${to.y}`;
          const cascSda = isCascade ? (to.sdas || []).find(s => s.scope === 'cascade') : null;
          const tipText = !sda || isPending
            ? `Structural link · ${from.name} → ${to.name}`
            : isCascade
              ? `Cascaded Disclosure · ${to.name} · via ${cascSda?.discloser || sda.discloser} · ${cascSda?.cascadePolicy || 'open'}`
              : sdaType === 'full'
                ? `Full Disclosure · ${to.name} · disclosed by ${sda.discloser}`
                : sdaType === 'selective'
                  ? `Selective Disclosure · ${to.name} · ${sda.redactedFields?.length || 0} fields redacted`
                  : sdaType === 'derivative'
                    ? `Derivative Disclosure · ${to.name} · Based on evaluation ${sda.sourceEvalId}`
                    : `Structural link · ${from.name} → ${to.name}`;
          return <g key={i}>
            <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
              opacity={dim ? baseOpacity * 0.16 : baseOpacity} markerEnd={marker} style={{ pointerEvents: 'none' }} />
            <path d={d} fill="none" stroke="transparent" strokeWidth={12}
              style={{ cursor: 'default', pointerEvents: zoom >= 0.55 ? 'all' : 'none' }}
              onMouseEnter={ev => {
                setConvTooltip(null);
                const r = containerRef.current?.getBoundingClientRect();
                if (r) setEdgeTooltip({ x: ev.clientX - r.left, y: ev.clientY - r.top, text: tipText });
              }}
              onMouseLeave={() => setEdgeTooltip(null)} />
          </g>;
        })}

        {/* Hover convergence edges */}
        {hovConvEdges.map(({ edge: e, idx: i }) => {
          const from = byId[e.from], to = byId[e.to]; if (!from || !to) return null;
          const mx = (from.x + TOTAL + to.x) / 2;
          const d = `M${from.x + TOTAL} ${from.y} C${mx} ${from.y},${mx} ${to.y},${to.x - 6} ${to.y}`;
          const convTip = `Shared upstream source: ${to.name}. Concentration risk — disruption here affects multiple branches.`;
          return <g key={`conv-${i}`}>
            <path d={d} fill="none" stroke="var(--accent-purple-light)" strokeWidth={.8} strokeDasharray="5,4" opacity={.5} style={{ pointerEvents: 'none' }} />
            <path d={d} fill="none" stroke="transparent" strokeWidth={10}
              style={{ cursor: 'default' }}
              onMouseEnter={e => {
                if (hovClearRef.current) { clearTimeout(hovClearRef.current); hovClearRef.current = null; }
                setEdgeTooltip(null);
                const r = containerRef.current?.getBoundingClientRect();
                if (r) setConvTooltip({ x: e.clientX - r.left, y: e.clientY - r.top, text: convTip });
              }}
              onMouseLeave={() => {
                setConvTooltip(null);
                hovClearRef.current = setTimeout(() => { setHov(null); hovClearRef.current = null; }, 80);
              }} />
          </g>;
        })}

        {/* Nodes */}
        {isLOD
          ? renderNodes.map(n => {
              const cx = n.x + TOTAL / 2, cy = n.y;
              const isS = sel?.id === n.id;
              const h = healthMap[n.id];
              const hc = h?.bad > 0 ? 'var(--accent-red)' : h?.warn > 0 || h?.expSoon ? 'var(--accent-amber)' : h?.total > 0 ? 'var(--accent-green)' : null;
              const afDim = attFilterMatch && !attFilterMatch.has(n.id);
              const isUnrev = unrevealedSet.has(n.id) && !revealAnim.has(n.id);
              const isRevN = revealAnim.has(n.id);
              if (isUnrev) return <g key={n.id} opacity={afDim ? 0.15 : 1} style={{ cursor: 'pointer' }} onClick={e => onNodeClick(e, n)}>
                <rect x={cx - bgR} y={cy - bgR} width={bgR * 2} height={bgR * 2} rx={3/zoom} fill="var(--bg-card)" stroke="var(--border)" strokeWidth={1} />
                <rect x={cx - bgR - 2/zoom} y={cy - bgR - 2/zoom} width={(bgR + 2/zoom) * 2} height={(bgR + 2/zoom) * 2} rx={4/zoom} fill="none" stroke="var(--accent-indigo)" strokeWidth={1.5}>
                  <animate attributeName="opacity" values=".2;.6;.2" dur="2s" repeatCount="indefinite" />
                </rect>
                {highlightedEventNode?.nodeId === n.id && <rect key={`ehl-${highlightedEventNode.k}`} x={cx - bgR - 5/zoom} y={cy - bgR - 5/zoom} width={(bgR + 5/zoom) * 2} height={(bgR + 5/zoom) * 2} rx={6/zoom} fill="none" stroke={highlightedEventNode.color} strokeWidth={2.5} filter="url(#gl)" style={{ animation: 'eventglow 0.4s ease forwards' }} />}
                <text x={cx} y={cy + bgR + 10/zoom} fontSize={7/zoom} fill="var(--accent-indigo-light)" textAnchor="middle" fontWeight="700" fontFamily="monospace">NEW</text>
              </g>;
              return <g key={n.id} style={isRevN ? { cursor: 'pointer', animation: 'revealIn 0.4s ease-out' } : { cursor: 'pointer' }} opacity={afDim ? 0.2 : 1}
                onMouseEnter={e => {
                  e.stopPropagation(); setHov(n.id);
                  const r = containerRef.current?.getBoundingClientRect();
                  if (r) setTooltip({ x: e.clientX - r.left, y: e.clientY - r.top, name: n.name, supplier: n.supplier || "" });
                }}
                onMouseLeave={() => { setHov(null); setTooltip(null); }}
                onClick={e => onNodeClick(e, n)}
                onDoubleClick={e => onNodeDblClick(e, n)}>
                <rect x={cx - bgR} y={cy - bgR} width={bgR * 2} height={bgR * 2} rx={3/zoom} fill="var(--bg-deep)" stroke="var(--border)" strokeWidth={1} opacity={.85} />
                {hc && <rect x={cx - bgR - 1/zoom} y={cy - bgR - 1/zoom} width={(bgR + 1/zoom) * 2} height={(bgR + 1/zoom) * 2} rx={4/zoom} fill="none" stroke={hc} strokeWidth={2} opacity={.6} />}
                {isS && <rect x={cx - bgR - 4/zoom} y={cy - bgR - 4/zoom} width={(bgR + 4/zoom) * 2} height={(bgR + 4/zoom) * 2} rx={5/zoom} fill="none" stroke="var(--accent-indigo)" strokeWidth={2} opacity={.5} />}
                {highlightedEventNode?.nodeId === n.id && <rect key={`ehl-${highlightedEventNode.k}`} x={cx - bgR - 5/zoom} y={cy - bgR - 5/zoom} width={(bgR + 5/zoom) * 2} height={(bgR + 5/zoom) * 2} rx={6/zoom} fill="none" stroke={highlightedEventNode.color} strokeWidth={2.5} filter="url(#gl)" style={{ animation: 'eventglow 0.4s ease forwards' }} />}
                <SvgMark type={n.type} cx={cx} cy={cy} r={iconR} lod />
                {!healthMap[n.id]?.hasEval && n.type !== 'customer' && <g><rect x={cx + bgR * 0.3} y={cy - bgR * 1.1} width={12/zoom} height={12/zoom} rx={2/zoom} fill="var(--accent-purple)" opacity=".8" /><text x={cx + bgR * 0.3 + 6/zoom} y={cy - bgR * 1.1 + 9/zoom} fontSize={8/zoom} fill="var(--text-bright)" fontFamily="monospace" fontWeight="700" textAnchor="middle">?</text></g>}
              </g>;
            })
          : renderNodes.map(n => {
              const t = TT[n.type] || TT.component;
              const isH = hov === n.id;
              const isS = sel?.id === n.id;
              const isNew = n.isNew && !rev.has(n.id) && !revealedSet.has(n.id);
              const h = healthMap[n.id] || { ok: 0, warn: 0, bad: 0, expSoon: false, total: 0, hasEval: false };
              const hDot = h.bad > 0 ? 'var(--accent-red)' : h.warn > 0 || h.expSoon ? 'var(--accent-amber)' : h.total > 0 ? 'var(--accent-green)' : 'var(--text-faint)';
              const bW = 36, gW = h.total > 0 ? Math.round(h.ok / h.total * bW) : 0, wW = h.total > 0 ? Math.round(h.warn / h.total * bW) : 0, rW = h.total > 0 ? bW - gW - wW : 0;
              const lx = n.x, rx = n.x + CW + GAP;
              const afDim = attFilterMatch && !attFilterMatch.has(n.id);
              const isUnrev = unrevealedSet.has(n.id) && !revealAnim.has(n.id);
              const isRevN = revealAnim.has(n.id);
              if (isUnrev) return <g key={n.id} opacity={afDim ? 0.15 : 1} style={{ cursor: 'pointer' }}
                onClick={e => onNodeClick(e, n)}>
                <rect x={lx} y={n.y - CH / 2} width={CW} height={CH} rx={6} fill="var(--bg-card)" stroke="var(--border)" strokeWidth={1} />
                <rect x={rx} y={n.y - CH / 2} width={CW} height={CH} rx={6} fill="var(--bg-card)" stroke="var(--border)" strokeWidth={1} />
                <rect x={lx - 2} y={n.y - CH / 2 - 2} width={TOTAL + 4} height={CH + 4} rx={8} fill="none" stroke="var(--accent-indigo)" strokeWidth={1.5}>
                  <animate attributeName="opacity" values=".2;.6;.2" dur="2s" repeatCount="indefinite" />
                </rect>
                {highlightedEventNode?.nodeId === n.id && <rect key={`ehl-${highlightedEventNode.k}`} x={lx - 4} y={n.y - CH / 2 - 4} width={TOTAL + 8} height={CH + 8} rx={10} fill="none" stroke={highlightedEventNode.color} strokeWidth={2.5} filter="url(#gl)" style={{ animation: 'eventglow 0.4s ease forwards' }} />}
                <rect x={lx + TOTAL / 2 - 22} y={n.y - 7} width={44} height={14} rx={4} fill="var(--accent-indigo-bg)" />
                <text x={lx + TOTAL / 2} y={n.y + 3.5} fontSize="8" fill="var(--accent-indigo-light)" textAnchor="middle" fontWeight="700" fontFamily="monospace">✦ NEW</text>
              </g>;
              return <g key={n.id} opacity={afDim ? 0.2 : 1}
                onMouseEnter={() => { if (hovClearRef.current) { clearTimeout(hovClearRef.current); hovClearRef.current = null; } setHov(n.id); setConvTooltip(null); }}
                onMouseLeave={() => { hovClearRef.current = setTimeout(() => { setHov(null); hovClearRef.current = null; }, 80); }}
                onClick={e => onNodeClick(e, n)}
                onDoubleClick={e => onNodeDblClick(e, n)}
                style={isRevN ? { cursor: 'pointer', animation: 'revealIn 0.4s ease-out' } : { cursor: 'pointer' }}>
                {h.bad > 0 && <rect x={lx - 3} y={n.y - CH / 2 - 3} width={TOTAL + 6} height={CH + 6} rx={9} fill="none" stroke="var(--accent-red)" strokeWidth="1.5" opacity=".2" />}
                {(isH || isS) && <rect x={lx - 3} y={n.y - CH / 2 - 3} width={TOTAL + 6} height={CH + 6} rx={9} fill="none" stroke={t.border} strokeWidth={isS ? "2" : "1.5"} opacity={isS ? ".5" : ".35"} filter="url(#gl)" />}
                {highlightedEventNode?.nodeId === n.id && <rect key={`ehl-${highlightedEventNode.k}`} x={lx - 4} y={n.y - CH / 2 - 4} width={TOTAL + 8} height={CH + 8} rx={10} fill="none" stroke={highlightedEventNode.color} strokeWidth={2.5} filter="url(#gl)" style={{ animation: 'eventglow 0.4s ease forwards' }} />}
                {n.type === 'customer' ? <>
                  {/* ── Organization: single full-width card ── */}
                  <rect x={lx} y={n.y - CH / 2} width={TOTAL} height={CH} rx={6} fill={t.bg} stroke={(isH || isS) ? t.border : `color-mix(in srgb, ${t.border} 27%, transparent)`} strokeWidth={(isH || isS) ? 1.5 : 1} />
                  <rect x={lx + 4} y={n.y - CH / 2 + 4} width={TOTAL - 8} height={12} rx={2} fill={t.border} fillOpacity=".08" />
                  <SvgMark type={n.type} cx={lx + 14} cy={n.y - CH / 2 + 10} r={4} />
                  <text x={lx + 24} y={n.y - CH / 2 + 12.5} fontSize="8" fill={t.border} fontWeight="700" fontFamily="monospace" opacity=".7">{nodeTypeLabels?.[n.type] || t.label}</text>
                  <text x={lx + 10} y={n.y + 2} fontSize="10.5" fill={t.text} fontWeight="600">{n.name.length > 42 ? n.name.slice(0, 40) + "\u2026" : n.name}</text>
                  {h.total > 0 ? <><rect x={lx + 8} y={n.y + 8} width={bW + 4} height={7} rx={3.5} fill="var(--bg-deep)" opacity=".7" /><rect x={lx + 10} y={n.y + 10} width={bW} height={3} rx={1.5} fill="var(--border)" />{gW > 0 && <rect x={lx + 10} y={n.y + 10} width={gW} height={3} fill="var(--accent-green)" opacity=".8" />}{wW > 0 && <rect x={lx + 10 + gW + (gW > 0 ? 1 : 0)} y={n.y + 10} width={wW} height={3} fill="var(--accent-amber)" opacity=".8" />}{rW > 0 && <rect x={lx + 10 + gW + (gW > 0 ? 1 : 0) + wW + (wW > 0 ? 1 : 0)} y={n.y + 10} width={rW} height={3} fill="var(--accent-red)" opacity=".8" />}<text x={lx + 50} y={n.y + 14} fontSize="7" fill="var(--text-muted)" fontFamily="monospace">{h.total}</text></> : <text x={lx + 10} y={n.y + 14} fontSize="7" fill="var(--text-faint)" fontFamily="monospace">No claims</text>}
                  <circle cx={lx + TOTAL - 14} cy={n.y - CH / 2 + 10} r="3.5" fill={hDot} opacity=".9" />
                  {h.expSoon && !h.bad && <circle cx={lx + TOTAL - 14} cy={n.y - CH / 2 + 10} r="5" fill="none" stroke="var(--accent-amber)" strokeWidth=".8"><animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values=".6;.15;.6" dur="2s" repeatCount="indefinite" /></circle>}
                  {isNew && <g><rect x={lx + TOTAL - 32} y={n.y - CH / 2 - 5} width={28} height={12} rx={3} fill="var(--accent-indigo-bg)" /><text x={lx + TOTAL - 18} y={n.y - CH / 2 + 3} fontSize="7" fill="var(--accent-indigo-light)" textAnchor="middle" fontWeight="700" fontFamily="monospace">✦ NEW</text></g>}
                </> : <>
                  {/* ── Standard dual-card node ── */}
                  {(() => {
                    const isContainer = ['customer','program','system'].includes(n.type);
                    const prov = !isContainer && approvalStates?.[n.id]?.status !== 'approved';
                    return <>
                      {/* Asset card (left) */}
                      <rect x={lx} y={n.y - CH / 2} width={CW} height={CH} rx={6}
                        fill={prov ? 'var(--bg-card)' : t.bg}
                        stroke={(isH || isS) ? t.border : prov ? 'var(--border-hover)' : `color-mix(in srgb, ${t.border} 27%, transparent)`}
                        strokeWidth={(isH || isS) ? 1.5 : 1}
                        strokeDasharray={prov ? '4,3' : undefined} />
                      <rect x={lx + 4} y={n.y - CH / 2 + 4} width={CW - 8} height={12} rx={2}
                        fill={t.border} fillOpacity={prov ? '.04' : '.08'} />
                      <SvgMark type={n.type} cx={lx + 14} cy={n.y - CH / 2 + 10} r={4} />
                      <text x={lx + 24} y={n.y - CH / 2 + 12.5} fontSize="8"
                        fill={t.border} fontWeight="700" fontFamily="monospace"
                        opacity={prov ? '.5' : '.7'}>
                        {nodeTypeLabels?.[n.type] || t.label}
                      </text>
                      <text x={lx + 10} y={n.y + 2} fontSize="10.5"
                        fill={prov ? 'var(--text-tertiary)' : t.text} fontWeight="600">
                        {n.name.length > 20 ? n.name.slice(0, 18) + "\u2026" : n.name}
                      </text>
                      {h.total > 0
                        ? <>
                            <rect x={lx + 8} y={n.y + 8} width={bW + 4} height={7} rx={3.5} fill="var(--bg-deep)" opacity=".7" />
                            <rect x={lx + 10} y={n.y + 10} width={bW} height={3} rx={1.5} fill="var(--border)" />
                            {gW > 0 && <rect x={lx + 10} y={n.y + 10} width={gW} height={3} fill="var(--accent-green)" opacity=".8" />}
                            {wW > 0 && <rect x={lx + 10 + gW + (gW > 0 ? 1 : 0)} y={n.y + 10} width={wW} height={3} fill="var(--accent-amber)" opacity=".8" />}
                            {rW > 0 && <rect x={lx + 10 + gW + (gW > 0 ? 1 : 0) + wW + (wW > 0 ? 1 : 0)} y={n.y + 10} width={rW} height={3} fill="var(--accent-red)" opacity=".8" />}
                            <text x={lx + 50} y={n.y + 14} fontSize="7" fill="var(--text-muted)" fontFamily="monospace">{h.total}</text>
                          </>
                        : <text x={lx + 10} y={n.y + 14} fontSize="7" fill="var(--text-faint)" fontFamily="monospace">No claims</text>
                      }
                      <circle cx={lx + CW - 10} cy={n.y - CH / 2 + 10} r="3.5" fill={hDot} opacity=".9" />
                      {h.expSoon && !h.bad && (
                        <circle cx={lx + CW - 10} cy={n.y - CH / 2 + 10} r="5" fill="none" stroke="var(--accent-amber)" strokeWidth=".8">
                          <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values=".6;.15;.6" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}
                      {/* Supplier card (right) */}
                      <rect x={rx} y={n.y - CH / 2} width={CW} height={CH} rx={6}
                        fill="var(--bg-app-header)"
                        stroke={(isH || isS) ? `color-mix(in srgb, ${t.border} 53%, transparent)` : prov ? 'var(--border-hover)' : 'var(--border)'}
                        strokeWidth={(isH || isS) ? 1.5 : 1}
                        strokeDasharray={prov ? '4,3' : undefined} />
                      <rect x={rx + 4} y={n.y - CH / 2 + 4} width={CW - 8} height={12} rx={2} fill="var(--border)" fillOpacity=".5" />
                      <text x={rx + 10} y={n.y - CH / 2 + 12.5} fontSize="8" fill="var(--text-tertiary)" fontWeight="600" fontFamily="monospace" opacity=".7">{supplierLabel || "Supplier"}</text>
                      <text x={rx + 10} y={n.y + 2} fontSize="10" fill="var(--text-primary)" fontWeight="500">{(n.supplier || "").length > 20 ? n.supplier.slice(0, 18) + "\u2026" : n.supplier}</text>
                      <text x={rx + 10} y={n.y + 14} fontSize="7.5" fill="var(--text-muted)" fontFamily="monospace">{(n.location || "").length > 22 ? n.location.slice(0, 20) + "\u2026" : n.location}</text>
                      {/* Badges and overlays */}
                      {isNew && <g><rect x={lx + TOTAL - 32} y={n.y - CH / 2 - 5} width={28} height={12} rx={3} fill="var(--accent-indigo-bg)" /><text x={lx + TOTAL - 18} y={n.y - CH / 2 + 3} fontSize="7" fill="var(--accent-indigo-light)" textAnchor="middle" fontWeight="700" fontFamily="monospace">✦ NEW</text></g>}
                      {n.itar && <g><rect x={rx + CW - 26} y={n.y + CH / 2 - 12} width={22} height={10} rx={2} fill="var(--accent-red-bg)" /><text x={rx + CW - 15} y={n.y + CH / 2 - 4.5} fontSize="6" fill="var(--accent-red)" textAnchor="middle" fontWeight="700" fontFamily="monospace">ITAR</text></g>}
                      {n.isConv && <rect x={lx} y={n.y + CH / 2 - 1} width={TOTAL} height="2" rx="1" fill="var(--accent-purple-light)" opacity=".3" />}
                      {!h.hasEval && !isContainer && <g><rect x={lx + CW - 29} y={n.y - CH / 2 + 3} width="14" height="14" rx="3" fill="var(--accent-purple)" opacity=".85" /><text x={lx + CW - 22} y={n.y - CH / 2 + 13.5} fontSize="9" fill="var(--text-bright)" fontFamily="monospace" fontWeight="700" textAnchor="middle">?</text></g>}
                    </>;
                  })()}
                </>}
              </g>;
            })}
      </g>
    </svg>

    {/* Events-active border overlay — sits above SVG so node cards cannot overlap it */}
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 32,
      boxShadow: eventsActive ? 'inset 0 0 0 4px var(--bg-deep), inset 0 0 0 5px var(--accent-orange), inset 0 0 0 8px var(--bg-deep), inset 0 0 0 9px rgba(251,146,60,0.4)' : 'none',
      transition: 'box-shadow 0.3s ease',
    }} />

    {/* Legend — 2-row layout */}
    <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 0, padding: "6px 14px", background: "var(--bg-deep)", borderRadius: 6, border: "1px solid var(--border)" }}>
      {/* Row 1: node / health indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {[{ c: "var(--border)", l: "Supply Link", tip: "Structural connection between network-owned nodes (Programs, Systems). Not a disclosure." },
          { c: "var(--accent-purple-light)", l: "Convergence", dash: true, tip: "Two supply chain branches share a common upstream source — a potential single point of failure. Structural concentration risk." },
          { c: "var(--accent-green)", l: "All Claims Verified", dot: true, tip: "All attestations on this node have been verified and are current." },
          { c: "var(--accent-amber)", l: "Expiring Claims", dot: true, tip: "One or more attestations on this node are approaching expiration." },
          { c: "var(--accent-red)", l: "Contested Claims", dot: true, tip: "One or more attestations on this node have been contested or revoked." },
        ].map(x => <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}
          onMouseEnter={e => { e.currentTarget.querySelector('.leg-label').style.color = 'var(--text-primary)'; e.currentTarget.querySelector('.leg-tip').style.display = 'block'; }}
          onMouseLeave={e => { e.currentTarget.querySelector('.leg-label').style.color = 'var(--text-secondary)'; e.currentTarget.querySelector('.leg-tip').style.display = 'none'; }}>
          {x.dot ? <div style={{ width: 7, height: 7, borderRadius: "50%", background: x.c }} /> : <div style={{ width: 16, height: 2, background: x.c, opacity: x.dash ? .5 : .6, borderRadius: 1 }} />}
          <span className="leg-label" style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace", cursor: "default", transition: "color .15s" }}>{x.l}</span>
          <div className="leg-tip" style={{ display: "none", position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", minWidth: 200, maxWidth: 260, background: "var(--border)", border: "1px solid #333", borderRadius: 4, padding: "6px 8px", fontSize: 9, color: "var(--text-primary)", zIndex: 40, boxShadow: "0 4px 12px rgba(0,0,0,.5)", pointerEvents: "none", whiteSpace: "normal", textAlign: "center" }}>{x.tip}</div>
        </div>)}
      </div>
      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", margin: "5px 0" }} />
      {/* Row 2: disclosure types */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 9, color: "var(--border-hover)", fontFamily: "monospace", fontWeight: 700, letterSpacing: ".05em", flexShrink: 0 }}>DISCLOSURE</span>
        {[{ c: "var(--accent-sda-full)", l: "Full", border: "solid", tip: "Supplier shared all data fields for this asset. Complete visibility into evidence, specifications, and supplier identity." },
          { c: "var(--accent-amber)", l: "Selective", border: "dashed", tip: "Supplier shared specific data fields only. Some categories are redacted under SDA terms. Amber dashed edges indicate partial visibility." },
          { c: "var(--accent-green)", l: "Derivative", border: "dotted", tip: "Supplier shared evaluation results (POE) without revealing underlying product data. Green dotted edges indicate verified-but-opaque assets." },
          { c: "var(--accent-sda-cascade)", l: "Cascade", border: "dashed", dashSvg: true, tip: "Upstream supplier propagated visibility through the supply chain. Dash-dot edges indicate cascaded tier-2+ disclosures." },
        ].map(sd => <div key={sd.l} style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}
          onMouseEnter={e => { e.currentTarget.querySelector('.sd-tip').style.display = 'block'; }}
          onMouseLeave={e => { e.currentTarget.querySelector('.sd-tip').style.display = 'none'; }}>
          {sd.dashSvg ? <svg width={16} height={4} style={{ flexShrink: 0 }}><line x1={0} y1={2} x2={16} y2={2} stroke={sd.c} strokeWidth={1.5} strokeDasharray="8,3,2,3" /></svg> : <div style={{ width: 16, height: 0, borderTop: `1.5px ${sd.border} ${sd.c}`, opacity: .85 }} />}
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace", cursor: "default" }}>{sd.l}</span>
          <div className="sd-tip" style={{ display: "none", position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", minWidth: 200, maxWidth: 260, background: "var(--border)", border: "1px solid #333", borderRadius: 4, padding: "6px 8px", fontSize: 9, color: "var(--text-primary)", zIndex: 40, boxShadow: "0 4px 12px rgba(0,0,0,.5)", pointerEvents: "none", whiteSpace: "normal", textAlign: "center" }}>{sd.tip}</div>
        </div>)}
        <span style={{ width: 1, height: 12, background: "var(--border)", margin: "0 4px", display: "inline-block" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}
          onMouseEnter={e => { e.currentTarget.querySelector('.leg-label').style.color = 'var(--text-primary)'; e.currentTarget.querySelector('.leg-tip').style.display = 'block'; }}
          onMouseLeave={e => { e.currentTarget.querySelector('.leg-label').style.color = 'var(--text-secondary)'; e.currentTarget.querySelector('.leg-tip').style.display = 'none'; }}>
          <div style={{ width: 16, height: 10, borderRadius: 2, border: '1px dashed var(--border-hover)', background: 'var(--bg-card)' }} />
          <span className="leg-label" style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace", cursor: "default", transition: "color .15s" }}>Provisional</span>
          <div className="leg-tip" style={{ display: "none", position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", minWidth: 200, maxWidth: 260, background: "var(--border)", border: "1px solid #333", borderRadius: 4, padding: "6px 8px", fontSize: 9, color: "var(--text-primary)", zIndex: 40, boxShadow: "0 4px 12px rgba(0,0,0,.5)", pointerEvents: "none", whiteSpace: "normal", textAlign: "center" }}>Asset awaiting evaluation and buyer approval. Run an evaluation and approve to add this asset to your verified network.</div>
        </div>
      </div>
    </div>

    {/* Subgraph Modal */}
    {chainIds && <SubgraphModal
      key={modalNodeId}
      focusIds={chainIds}
      centerId={modalNodeId}
      gN={gN} gE={gE} byId={byId}
      title={modalTitle}
      onSelect={onSelect}
      sel={sel} onCloseSel={onCloseSel} onViewChain={onViewChain}
      onClose={closeModal}
      rev={rev} onRev={onRev}
      initialZoom={zoom}
      credits={credits} setCredits={setCredits} onEvaluationComplete={onEvaluationComplete} nodeTypeLabels={nodeTypeLabels} dataRev={dataRev} revealedSet={revealedSet} onRevealNode={onRevealNode} invitedSet={invitedSet} onInvite={onInvite} onRevokeInvite={onRevokeInvite} vert={vert} terminalTypes={terminalTypes} onRequirementsClick={onRequirementsClick} onOpenSystemModal={onOpenSystemModal} approvalStates={approvalStates} evidenceRequests={evidenceRequests}
    />}
  </div>;
}
