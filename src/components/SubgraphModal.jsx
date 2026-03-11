import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { TT } from '../data/tokens';
import SvgMark from './SvgMark';
import DetailPanel from './DetailPanel';
import EvaluationModal from './EvaluationModal';

const CW = 195, CH = 58, GAP = 6, TOTAL = CW * 2 + GAP;
const ROW_H = 78, COL_W = 480;
const MIN_ZOOM = 0.20, MAX_ZOOM = 1.50;
const DECAY = 0.92, VEL_STOP = 0.5;
const PAD = 100;

const displayZoom = z => Math.round(((z - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 90 + 10);

export default function SubgraphModal({ focusIds, centerId, gN, gE, byId, title, subtitle, supplierHighlightId, onSelect, sel, onCloseSel, onViewChain, onClose, rev, onRev, initialZoom, credits, setCredits, onEvaluationComplete, nodeTypeLabels, dataRev, revealedSet, onRevealNode, invitedSet, onInvite, onRevokeInvite, vert, terminalTypes, onRequirementsClick, onOpenSystemModal, onOpenSDAModal, onCreateDerivativeDisclosure, approvalStates, evidenceRequests }) {
  const [hov, setHov] = useState(null);
  const [selId, setSelId] = useState(null);
  const [edgeTooltip, setEdgeTooltip] = useState(null);
  const [evalNode, setEvalNode] = useState(null);
  const initZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom || 0.6));
  const [zoom, setZoom] = useState(initZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cSize, setCSize] = useState({ w: 800, h: 600 });

  const wrapperRef = useRef(null);
  const graphRef = useRef(null);
  const svgRef = useRef(null);
  const innerGRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0, wasDrag: false });
  const clickTimerRef = useRef(null);
  const momentumRef = useRef(null);
  const velRef = useRef({ vx: 0, vy: 0 });
  const lastMouseRef = useRef({ x: 0, y: 0, t: 0 });
  const initializedRef = useRef(false);
  const lastShiftRef = useRef(null);

  // ── Cleanup momentum on unmount ─────────────────────────────────────
  useEffect(() => () => { if (momentumRef.current) cancelAnimationFrame(momentumRef.current); }, []);

  // ── Clear CSS transform after pan state update (fixes snap-back) ──
  useLayoutEffect(() => {
    if (!dragRef.current.active && innerGRef.current) {
      innerGRef.current.style.transform = "";
    }
  }, [pan]);

  // ── Container resize ────────────────────────────────────────────────
  useEffect(() => {
    const el = graphRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) setCSize({ w: width, h: height });
      }
    });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // ── Layout ──────────────────────────────────────────────────────────
  const { nodes, edges, dataCX, dataCY, bounds } = useMemo(() => {
    const filtered = gN.filter(n => focusIds.has(n.id));
    const byDepth = {};
    filtered.forEach(n => {
      if (!byDepth[n.depth]) byDepth[n.depth] = [];
      byDepth[n.depth].push(n);
    });
    const positioned = [];
    Object.entries(byDepth).forEach(([d, dns]) => {
      const depth = parseInt(d);
      const x = 80 + depth * COL_W;
      const startY = -(dns.length - 1) * ROW_H / 2;
      dns.forEach((n, i) => positioned.push({ ...n, mx: x, my: startY + i * ROW_H }));
    });
    const mEdges = gE.filter(e => focusIds.has(e.from) && focusIds.has(e.to));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    positioned.forEach(n => {
      x0 = Math.min(x0, n.mx); x1 = Math.max(x1, n.mx + TOTAL);
      y0 = Math.min(y0, n.my - CH / 2); y1 = Math.max(y1, n.my + CH / 2);
    });
    const cx = positioned.length > 0 ? (x0 + x1) / 2 : 0;
    const cy = positioned.length > 0 ? (y0 + y1) / 2 : 0;
    return {
      nodes: positioned, edges: mEdges, dataCX: cx, dataCY: cy,
      bounds: { minX: x0 - PAD, maxX: x1 + PAD, minY: y0 - PAD, maxY: y1 + PAD }
    };
  }, [focusIds, gN, gE]);

  const mById = useMemo(() => { const m = {}; nodes.forEach(n => m[n.id] = n); return m; }, [nodes]);

  // ── Attestation health per node ──────────────────────────────────
  const healthMap = useMemo(() => {
    const m = {};
    const REF_T = new Date('2026-02-17').getTime();
    nodes.forEach(n => {
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
  }, [nodes, dataRev]);

  // ── Unrevealed / ghost node sets ──────────────────────────────────
  const unrevealedSet = useMemo(() => {
    const s = new Set();
    nodes.forEach(n => { if (n.isNew && revealedSet && !revealedSet.has(n.id)) s.add(n.id); });
    return s;
  }, [nodes, revealedSet]);

  const [revealAnim, setRevealAnim] = useState(new Set());

  // ── Adjacency lists for chain computation ─────────────────────────
  const { adjUp, adjDown } = useMemo(() => {
    const up = {}, dn = {};
    edges.forEach(e => {
      if (!up[e.to]) up[e.to] = []; up[e.to].push(e.from);
      if (!dn[e.from]) dn[e.from] = []; dn[e.from].push(e.to);
    });
    return { adjUp: up, adjDown: dn };
  }, [edges]);

  // ── Selected node's chain (ancestors + descendants) ─────────────────
  const selChain = useMemo(() => {
    if (!selId) return null;
    const s = new Set([selId]);
    const traceUp = id => { (adjUp[id] || []).forEach(from => { if (!s.has(from)) { s.add(from); traceUp(from); } }); };
    const traceDown = id => { (adjDown[id] || []).forEach(to => { if (!s.has(to)) { s.add(to); traceDown(to); } }); };
    traceUp(selId); traceDown(selId);
    return s;
  }, [selId, adjUp, adjDown]);

  // ── Split edges: regular vs convergence ─────────────────────────────
  const { regularEdges, convEdges } = useMemo(() => {
    const reg = [], conv = [];
    edges.forEach((e, i) => {
      if (e.conv) conv.push({ edge: e, idx: i });
      else reg.push({ edge: e, idx: i });
    });
    return { regularEdges: reg, convEdges: conv };
  }, [edges]);

  // ── Convergence edges visible only for selected chain ──────────────
  const visConvEdges = useMemo(() => {
    if (!selChain) return [];
    return convEdges.filter(({ edge }) => selChain.has(edge.from) && selChain.has(edge.to));
  }, [selChain, convEdges]);

  // ── Center on selected node on first render ─────────────────────────
  useEffect(() => {
    if (initializedRef.current || !centerId || nodes.length === 0) return;
    const target = mById[centerId];
    if (!target) return;
    initializedRef.current = true;
    const nodeX = target.mx + TOTAL / 2;
    const nodeY = target.my;
    setPan({ x: (dataCX - nodeX) * initZoom, y: (dataCY - nodeY) * initZoom });
  }, [centerId, nodes, mById, dataCX, dataCY, initZoom]);

  // ── Smart shift: keep selected node visible when DetailPanel opens ──
  useEffect(() => {
    if (!selId || selId === lastShiftRef.current) return;
    lastShiftRef.current = selId;
    const node = mById[selId];
    if (!node) return;
    const vw = cSize.w / zoom;
    const curVbX = dataCX - vw / 2 - pan.x / zoom;
    const nodeRight = (node.mx + TOTAL - curVbX) * zoom;
    const safeRight = cSize.w - 380;
    if (nodeRight > safeRight) {
      const shift = nodeRight - safeRight;
      setPan(p => {
        const nx = p.x - shift;
        const rExtra = 400;
        const vw2 = cSize.w / zoom, vh2 = cSize.h / zoom;
        const maxPX = (dataCX - vw2 / 2 - bounds.minX) * zoom;
        const minPX = (dataCX + vw2 / 2 - (bounds.maxX + rExtra)) * zoom;
        return {
          x: minPX > maxPX ? (minPX + maxPX) / 2 : Math.max(minPX, Math.min(maxPX, nx)),
          y: p.y
        };
      });
    }
  });

  // ── Pan clamping — extra right padding when DetailPanel open ───────
  const clampPan = useCallback((px, py, z) => {
    const rightExtra = sel ? 400 : 0;
    const vw = cSize.w / z, vh = cSize.h / z;
    const maxPX = (dataCX - vw / 2 - bounds.minX) * z;
    const minPX = (dataCX + vw / 2 - (bounds.maxX + rightExtra)) * z;
    const maxPY = (dataCY - vh / 2 - bounds.minY) * z;
    const minPY = (dataCY + vh / 2 - bounds.maxY) * z;
    return {
      x: minPX > maxPX ? (minPX + maxPX) / 2 : Math.max(minPX, Math.min(maxPX, px)),
      y: minPY > maxPY ? (minPY + maxPY) / 2 : Math.max(minPY, Math.min(maxPY, py))
    };
  }, [cSize, dataCX, dataCY, bounds, sel]);

  // ── Block ALL mouse events from reaching graph underneath ───────────
  const stopAll = useCallback(e => e.stopPropagation(), []);

  // ── Refs for current state (used by native event handlers) ─────────
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const panRef = useRef(pan); panRef.current = pan;
  const cSizeRef = useRef(cSize); cSizeRef.current = cSize;

  // ── Wheel zoom: on graph container, only when cursor is over the SVG ──
  useEffect(() => {
    const el = graphRef.current; if (!el) return;
    const handler = e => {
      // Only zoom when cursor is directly over the SVG graph — let DetailPanel scroll normally
      if (!svgRef.current || !svgRef.current.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.985 : 1.015;
      const z = zoomRef.current;
      const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor));
      if (nz === z) return;
      const p = panRef.current;
      const cs = cSizeRef.current;
      const newPx = sx - cs.w / 2 - (sx - cs.w / 2 - p.x) * nz / z;
      const newPy = sy - cs.h / 2 - (sy - cs.h / 2 - p.y) * nz / z;
      setZoom(nz);
      setPan({ x: newPx, y: newPy });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ── Double-click on background: zoom in one step at click point ────
  const onBgDblClick = useCallback(e => {
    if (dragRef.current.wasDrag) return;
    e.stopPropagation();
    const rect = graphRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = 1.5;
    const z = zoom;
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor));
    if (nz === z) return;
    const newPx = sx - cSize.w / 2 - (sx - cSize.w / 2 - pan.x) * nz / z;
    const newPy = sy - cSize.h / 2 - (sy - cSize.h / 2 - pan.y) * nz / z;
    setZoom(nz);
    setPan({ x: newPx, y: newPy });
  }, [zoom, pan, cSize]);

  // ── ViewBox ─────────────────────────────────────────────────────────
  const vbW = cSize.w / zoom, vbH = cSize.h / zoom;
  const vbX = dataCX - vbW / 2 - pan.x / zoom;
  const vbY = dataCY - vbH / 2 - pan.y / zoom;

  // ── Drag pan ────────────────────────────────────────────────────────
  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, wasDrag: false };
    lastMouseRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    velRef.current = { vx: 0, vy: 0 };
    if (graphRef.current) graphRef.current.style.cursor = "grabbing";
  }, [pan]);

  const onMouseMove = useCallback(e => {
    e.stopPropagation();
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
    e.stopPropagation();
    const d = dragRef.current; if (!d.active) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    let px = d.panX + dx, py = d.panY + dy;
    const clamped = clampPan(px, py, zoom);
    px = clamped.x; py = clamped.y;
    d.active = false;
    if (graphRef.current) graphRef.current.style.cursor = "grab";
    setPan({ x: px, y: py });
    const now = performance.now();
    const dt = now - lastMouseRef.current.t;
    const v = dt < 50 ? velRef.current : { vx: 0, vy: 0 };
    if (Math.abs(v.vx) > VEL_STOP || Math.abs(v.vy) > VEL_STOP) {
      let vx = v.vx, vy = v.vy;
      const animate = () => {
        vx *= DECAY; vy *= DECAY;
        if (Math.abs(vx) < VEL_STOP && Math.abs(vy) < VEL_STOP) { momentumRef.current = null; return; }
        px += vx; py += vy;
        const c = clampPan(px, py, zoom);
        px = c.x; py = c.y;
        setPan({ x: px, y: py });
        momentumRef.current = requestAnimationFrame(animate);
      };
      momentumRef.current = requestAnimationFrame(animate);
    }
  }, [clampPan, zoom]);

  // ── Node click: single = select, double = switch chain ─────────────
  const onNodeClick = useCallback((e, n) => {
    e.stopPropagation();
    if (dragRef.current.wasDrag) return;
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    if (n.isNew && revealedSet && !revealedSet.has(n.id) && onRevealNode) {
      onRevealNode(n.id);
      setRevealAnim(s => { const ns = new Set(s); ns.add(n.id); return ns; });
      setTimeout(() => setRevealAnim(s => { const ns = new Set(s); ns.delete(n.id); return ns; }), 600);
      clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; setSelId(n.id); onSelect(n); }, 600);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      setSelId(n.id);
      onSelect(n);
      if (n.isNew && !rev.has(n.id)) onRev(n.id);
    }, 250);
  }, [onSelect, rev, onRev, revealedSet, onRevealNode]);

  const onNodeDblClick = useCallback((e, n) => {
    e.stopPropagation();
    if (n.type === 'customer') return;
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    if (onViewChain) onViewChain(n);
  }, [onViewChain]);

  // ── Background click: deselect, close DetailPanel ──────────────────
  const onBgClick = useCallback(() => {
    if (dragRef.current.wasDrag) return;
    if (selId) { setSelId(null); if (onCloseSel) onCloseSel(); }
  }, [selId, onCloseSel]);

  // ── Supplier placeholder (no upstream children) ────────────────────
  const supplierPlaceholder = useMemo(() => {
    if (!supplierHighlightId) return null;
    const sn = mById[supplierHighlightId];
    if (!sn) return null;
    if (edges.some(e => e.from === supplierHighlightId)) return null;
    return { x: sn.mx + TOTAL + 60, y: sn.my };
  }, [supplierHighlightId, mById, edges]);

  // ── Panel open state for zoom control shift ────────────────────────
  const panelOpen = !!sel;

  return <div ref={wrapperRef} style={{ position: "fixed", inset: 0, zIndex: 50 }}
    onMouseDown={stopAll} onMouseMove={stopAll} onMouseUp={stopAll}>
    {/* Backdrop — blocks all pointer events */}
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", pointerEvents: "all" }} onClick={onClose} />

    {/* Modal — 85% viewport */}
    <div style={{ position: "absolute", inset: "7.5% 7.5%", background: "var(--bg-app-header)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", userSelect: "none", WebkitUserSelect: "none" }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "monospace" }}>{title}</span>
        {subtitle && <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>· {subtitle}</span>}
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{nodes.length} nodes</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button>
      </div>

      {/* Graph area */}
      <div ref={graphRef} style={{ flex: 1, overflow: "hidden", cursor: "grab", position: "relative" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}
        onClick={onBgClick} onDoubleClick={onBgDblClick}>

        {/* Zoom controls — shift left when DetailPanel is open */}
        <div style={{ position: "absolute", top: 10, right: panelOpen ? 372 : 12, zIndex: 10, display: "flex", flexDirection: "column", gap: 2, transition: "right .3s ease" }}>
          {[["+", () => setZoom(z => Math.min(MAX_ZOOM, z * 1.15))], ["\u2212", () => setZoom(z => Math.max(MIN_ZOOM, z * 0.87))]].map(([l, fn]) =>
            <button key={l} onClick={e => { e.stopPropagation(); fn(); }} style={{ width: 24, height: 24, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</button>)}
          <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "monospace", textAlign: "center", marginTop: 2 }}>{displayZoom(zoom)}%</div>
        </div>

        <svg ref={svgRef} style={{ width: "100%", height: "100%" }}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="m-arr" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-indigo)" /></marker>
            <marker id="m-arr-full" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-sda-full)" /></marker>
            <marker id="m-arr-sel" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-amber)" /></marker>
            <marker id="m-arr-der" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-green)" /></marker>
            <marker id="m-arr-casc" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto"><polygon points="0 0,6 2,0 4" fill="var(--accent-sda-cascade)" /></marker>
            <marker id="m-conv" markerWidth="4" markerHeight="3" refX="4" refY="1.5" orient="auto"><polygon points="0 0,4 1.5,0 3" fill="var(--accent-purple-light)" /></marker>
            <filter id="m-gl"><feGaussianBlur stdDeviation="3" result="g" /><feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <g ref={innerGRef}>
            {/* Regular edges (no convergence) */}
            {regularEdges.map(({ edge: e, idx: i }) => {
              const from = mById[e.from], to = mById[e.to];
              if (!from || !to) return null;
              const mx = (from.mx + TOTAL + to.mx) / 2;
              const inChain = !selChain || (selChain.has(e.from) && selChain.has(e.to));
              const sda = to.sda;
              const sdaType = sda?.type;
              const isCascade = sda?.scope === 'cascade' || (to.sdas || []).some(s => s.scope === 'cascade');
              const isPending = sda?.status === 'pending';
              const isExpired = sda?.status === 'expired';
              const stroke = !sda ? 'var(--accent-indigo)' : isPending ? 'var(--border-hover)' : isCascade ? 'var(--accent-sda-cascade)' : sdaType === 'full' ? 'var(--accent-sda-full)' : sdaType === 'selective' ? 'var(--accent-amber)' : sdaType === 'derivative' ? 'var(--accent-green)' : 'var(--accent-indigo)';
              const dash = isCascade ? '8,3,2,3' : sdaType === 'selective' ? '4,3' : sdaType === 'derivative' ? '2,4' : undefined;
              const sw = isCascade ? 1.3 : (sda && !isPending && sdaType === 'full') ? 2 : 1.5;
              const baseOpacity = isExpired ? 0.15 : !sda ? 0.6 : sdaType === 'full' ? 0.45 : 0.6;
              const marker = !sda || isPending ? 'url(#m-arr)' : isCascade ? 'url(#m-arr-casc)' : sdaType === 'full' ? 'url(#m-arr-full)' : sdaType === 'selective' ? 'url(#m-arr-sel)' : sdaType === 'derivative' ? 'url(#m-arr-der)' : 'url(#m-arr)';
              const d = `M${from.mx + TOTAL} ${from.my} C${mx} ${from.my},${mx} ${to.my},${to.mx - 6} ${to.my}`;
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
                  opacity={inChain ? baseOpacity : 0.08} markerEnd={marker} style={{ pointerEvents: 'none' }} />
                <path d={d} fill="none" stroke="transparent" strokeWidth={12}
                  style={{ cursor: 'default', pointerEvents: zoom >= 0.55 ? 'all' : 'none' }}
                  onMouseEnter={ev => {
                    const r = graphRef.current?.getBoundingClientRect();
                    if (r) setEdgeTooltip({ x: ev.clientX - r.left, y: ev.clientY - r.top, text: tipText });
                  }}
                  onMouseLeave={() => setEdgeTooltip(null)} />
              </g>;
            })}

            {/* Convergence edges — only for selected chain */}
            {visConvEdges.map(({ edge: e, idx: i }) => {
              const from = mById[e.from], to = mById[e.to];
              if (!from || !to) return null;
              const mx = (from.mx + TOTAL + to.mx) / 2;
              return <path key={`conv-${i}`} d={`M${from.mx + TOTAL} ${from.my} C${mx} ${from.my},${mx} ${to.my},${to.mx - 6} ${to.my}`}
                fill="none" stroke="var(--accent-purple-light)" strokeWidth={1}
                strokeDasharray="5,4" opacity={0.6}
                markerEnd="url(#m-conv)" />;
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const t = TT[n.type] || TT.component;
              const isNew = n.isNew && !rev.has(n.id) && !(revealedSet && revealedSet.has(n.id));
              const isH = hov === n.id;
              const isS = selId === n.id;
              const h = healthMap[n.id] || { ok: 0, warn: 0, bad: 0, expSoon: false, total: 0, hasEval: false };
              const hDot = h.bad > 0 ? 'var(--accent-red)' : h.warn > 0 || h.expSoon ? 'var(--accent-amber)' : h.total > 0 ? 'var(--accent-green)' : 'var(--text-faint)';
              const bW = 36, gW = h.total > 0 ? Math.round(h.ok / h.total * bW) : 0, wW = h.total > 0 ? Math.round(h.warn / h.total * bW) : 0, rW = h.total > 0 ? bW - gW - wW : 0;
              const lx = n.mx, rx = n.mx + CW + GAP;
              const nodeOpacity = selChain ? (selChain.has(n.id) ? 1 : 0.15) : 1;
              const isUnrev = unrevealedSet.has(n.id) && !revealAnim.has(n.id);
              const isRevN = revealAnim.has(n.id);
              if (isUnrev) return <g key={n.id} style={{ cursor: 'pointer', opacity: nodeOpacity, transition: 'opacity .2s' }}
                onClick={e => onNodeClick(e, n)}>
                <rect x={lx} y={n.my - CH / 2} width={CW} height={CH} rx={6} fill="var(--bg-card)" stroke="var(--border)" strokeWidth={1} />
                <rect x={rx} y={n.my - CH / 2} width={CW} height={CH} rx={6} fill="var(--bg-card)" stroke="var(--border)" strokeWidth={1} />
                <rect x={lx - 2} y={n.my - CH / 2 - 2} width={TOTAL + 4} height={CH + 4} rx={8} fill="none" stroke="var(--accent-indigo)" strokeWidth={1.5}>
                  <animate attributeName="opacity" values=".2;.6;.2" dur="2s" repeatCount="indefinite" />
                </rect>
                <rect x={lx + TOTAL / 2 - 22} y={n.my - 7} width={44} height={14} rx={4} fill="var(--accent-indigo-bg)" />
                <text x={lx + TOTAL / 2} y={n.my + 3.5} fontSize="8" fill="var(--accent-indigo-light)" textAnchor="middle" fontWeight="700" fontFamily="monospace">✦ NEW</text>
              </g>;
              return <g key={n.id}
                onMouseEnter={() => setHov(n.id)} onMouseLeave={() => setHov(null)}
                onClick={e => onNodeClick(e, n)}
                onDoubleClick={e => onNodeDblClick(e, n)}
                style={isRevN ? { cursor: 'pointer', opacity: nodeOpacity, transition: 'opacity .2s', animation: 'revealIn 0.4s ease-out' } : { cursor: "pointer", opacity: nodeOpacity, transition: "opacity .2s" }}>
                {h.bad > 0 && <rect x={lx - 3} y={n.my - CH / 2 - 3} width={TOTAL + 6} height={CH + 6} rx={9} fill="none" stroke="var(--accent-red)" strokeWidth="1.5" opacity=".2" />}
                {(isH || isS) && <rect x={lx - 3} y={n.my - CH / 2 - 3} width={TOTAL + 6} height={CH + 6} rx={9} fill="none" stroke={t.border} strokeWidth={isS ? "2" : "1.5"} opacity={isS ? ".5" : ".35"} filter="url(#m-gl)" />}
                {supplierHighlightId === n.id && <rect x={lx - 4} y={n.my - CH / 2 - 4} width={TOTAL + 8} height={CH + 8} rx={10} fill="none" stroke="var(--accent-cyan)" strokeWidth={2} opacity=".6" />}
                {n.type === 'customer' ? <>
                  {/* ── Organization: single full-width card ── */}
                  <rect x={lx} y={n.my - CH / 2} width={TOTAL} height={CH} rx={6} fill={t.bg} stroke={(isH || isS) ? t.border : `color-mix(in srgb, ${t.border} 27%, transparent)`} strokeWidth={(isH || isS) ? 1.5 : 1} />
                  <rect x={lx + 4} y={n.my - CH / 2 + 4} width={TOTAL - 8} height={12} rx={2} fill={t.border} fillOpacity=".08" />
                  <SvgMark type={n.type} cx={lx + 14} cy={n.my - CH / 2 + 10} r={4} />
                  <text x={lx + 24} y={n.my - CH / 2 + 12.5} fontSize="9" fill={t.border} fontWeight="700" fontFamily="monospace" opacity=".7">{nodeTypeLabels?.[n.type] || t.label}</text>
                  <text x={lx + 10} y={n.my + 2} fontSize="10.5" fill={t.text} fontWeight="600">{n.name.length > 42 ? n.name.slice(0, 40) + "\u2026" : n.name}</text>
                  {h.total > 0 ? <><rect x={lx + 8} y={n.my + 8} width={bW + 4} height={7} rx={3.5} fill="var(--bg-deep)" opacity=".7" /><rect x={lx + 10} y={n.my + 10} width={bW} height={3} rx={1.5} fill="var(--border)" />{gW > 0 && <rect x={lx + 10} y={n.my + 10} width={gW} height={3} fill="var(--accent-green)" opacity=".8" />}{wW > 0 && <rect x={lx + 10 + gW} y={n.my + 10} width={wW} height={3} fill="var(--accent-amber)" opacity=".8" />}{rW > 0 && <rect x={lx + 10 + gW + wW} y={n.my + 10} width={rW} height={3} fill="var(--accent-red)" opacity=".8" />}<text x={lx + 50} y={n.my + 14} fontSize="7" fill="var(--text-muted)" fontFamily="monospace">{h.total}</text></> : <text x={lx + 10} y={n.my + 14} fontSize="7" fill="var(--text-faint)" fontFamily="monospace">No claims</text>}
                  <circle cx={lx + TOTAL - 14} cy={n.my - CH / 2 + 10} r="3.5" fill={hDot} opacity=".9" />
                  {h.expSoon && !h.bad && <circle cx={lx + TOTAL - 14} cy={n.my - CH / 2 + 10} r="5" fill="none" stroke="var(--accent-amber)" strokeWidth=".8"><animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values=".6;.15;.6" dur="2s" repeatCount="indefinite" /></circle>}
                  {isNew && <g><rect x={lx + TOTAL - 32} y={n.my - CH / 2 - 5} width={28} height={12} rx={3} fill="var(--accent-indigo-bg)" /><text x={lx + TOTAL - 18} y={n.my - CH / 2 + 3} fontSize="7" fill="var(--accent-indigo-light)" textAnchor="middle" fontWeight="700" fontFamily="monospace">✦ NEW</text></g>}
                </> : <>
                  {/* ── Standard dual-card node ── */}
                  <rect x={lx} y={n.my - CH / 2} width={CW} height={CH} rx={6} fill={t.bg} stroke={(isH || isS) ? t.border : `color-mix(in srgb, ${t.border} 27%, transparent)`} strokeWidth={(isH || isS) ? 1.5 : 1} />
                  <rect x={lx + 4} y={n.my - CH / 2 + 4} width={CW - 8} height={12} rx={2} fill={t.border} fillOpacity=".08" />
                  <SvgMark type={n.type} cx={lx + 14} cy={n.my - CH / 2 + 10} r={4} />
                  <text x={lx + 24} y={n.my - CH / 2 + 12.5} fontSize="9" fill={t.border} fontWeight="700" fontFamily="monospace" opacity=".7">{nodeTypeLabels?.[n.type] || t.label}</text>
                  <text x={lx + 10} y={n.my + 2} fontSize="10.5" fill={t.text} fontWeight="600">{n.name.length > 20 ? n.name.slice(0, 18) + "\u2026" : n.name}</text>
                  {h.total > 0 ? <><rect x={lx + 8} y={n.my + 8} width={bW + 4} height={7} rx={3.5} fill="var(--bg-deep)" opacity=".7" /><rect x={lx + 10} y={n.my + 10} width={bW} height={3} rx={1.5} fill="var(--border)" />{gW > 0 && <rect x={lx + 10} y={n.my + 10} width={gW} height={3} fill="var(--accent-green)" opacity=".8" />}{wW > 0 && <rect x={lx + 10 + gW} y={n.my + 10} width={wW} height={3} fill="var(--accent-amber)" opacity=".8" />}{rW > 0 && <rect x={lx + 10 + gW + wW} y={n.my + 10} width={rW} height={3} fill="var(--accent-red)" opacity=".8" />}<text x={lx + 50} y={n.my + 14} fontSize="7" fill="var(--text-muted)" fontFamily="monospace">{h.total}</text></> : <text x={lx + 10} y={n.my + 14} fontSize="7" fill="var(--text-faint)" fontFamily="monospace">No claims</text>}
                  <circle cx={lx + CW - 10} cy={n.my - CH / 2 + 10} r="3.5" fill={hDot} opacity=".9" />
                  {h.expSoon && !h.bad && <circle cx={lx + CW - 10} cy={n.my - CH / 2 + 10} r="5" fill="none" stroke="var(--accent-amber)" strokeWidth=".8"><animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values=".6;.15;.6" dur="2s" repeatCount="indefinite" /></circle>}
                  <rect x={rx} y={n.my - CH / 2} width={CW} height={CH} rx={6} fill="var(--bg-app-header)" stroke={(isH || isS) ? `color-mix(in srgb, ${t.border} 53%, transparent)` : "var(--border)"} strokeWidth={(isH || isS) ? 1.5 : 1} />
                  <rect x={rx + 4} y={n.my - CH / 2 + 4} width={CW - 8} height={12} rx={2} fill="var(--border)" fillOpacity=".5" />
                  <text x={rx + 10} y={n.my - CH / 2 + 12.5} fontSize="9" fill="var(--text-tertiary)" fontWeight="600" fontFamily="monospace" opacity=".7">Supplier</text>
                  <text x={rx + 10} y={n.my + 2} fontSize="10" fill="var(--text-primary)" fontWeight="500">{(n.supplier || "").length > 20 ? n.supplier.slice(0, 18) + "\u2026" : n.supplier}</text>
                  <text x={rx + 10} y={n.my + 14} fontSize="7.5" fill="var(--text-muted)" fontFamily="monospace">{(n.location || "").length > 22 ? n.location.slice(0, 20) + "\u2026" : n.location}</text>
                  {isNew && <g><rect x={lx + TOTAL - 32} y={n.my - CH / 2 - 5} width={28} height={12} rx={3} fill="var(--accent-indigo-bg)" /><text x={lx + TOTAL - 18} y={n.my - CH / 2 + 3} fontSize="7" fill="var(--accent-indigo-light)" textAnchor="middle" fontWeight="700" fontFamily="monospace">✦ NEW</text></g>}
                  {n.itar && <g><rect x={rx + CW - 26} y={n.my + CH / 2 - 12} width={22} height={10} rx={2} fill="var(--accent-red-bg)" /><text x={rx + CW - 15} y={n.my + CH / 2 - 4.5} fontSize="6" fill="var(--accent-red)" textAnchor="middle" fontWeight="700" fontFamily="monospace">ITAR</text></g>}
                  {n.isConv && <rect x={lx} y={n.my + CH / 2 - 1} width={TOTAL} height="2" rx="1" fill="var(--accent-purple-light)" opacity=".3" />}
                  {!h.hasEval && <g><rect x={lx + CW - 29} y={n.my - CH / 2 + 3} width="14" height="14" rx="3" fill="var(--accent-purple)" opacity=".85" /><text x={lx + CW - 22} y={n.my - CH / 2 + 13.5} fontSize="9" fill="var(--text-bright)" fontFamily="monospace" fontWeight="700" textAnchor="middle">?</text></g>}
                </>}
              </g>;
            })}
            {supplierPlaceholder && <g>
              <rect x={supplierPlaceholder.x} y={supplierPlaceholder.y - CH / 2} width={CW * 1.5} height={CH} rx={6} fill="none" stroke="var(--border)" strokeWidth={1} strokeDasharray="6,4" />
              <text x={supplierPlaceholder.x + CW * 0.75} y={supplierPlaceholder.y + 3} fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="monospace">No upstream suppliers registered</text>
            </g>}
          </g>
        </svg>

        {/* Edge hover tooltip */}
        {edgeTooltip && <div style={{ position: "absolute", left: edgeTooltip.x + 14, top: edgeTooltip.y - 8, zIndex: 41, pointerEvents: "none", padding: "6px 8px", background: "var(--bg-surface)", border: "1px solid #2a3452", borderRadius: 4, maxWidth: 260, boxShadow: "0 4px 12px rgba(0,0,0,.5)" }}>
          <div style={{ fontSize: 9, color: "var(--text-primary)", lineHeight: 1.4, whiteSpace: "normal" }}>{edgeTooltip.text}</div>
        </div>}

        {/* DetailPanel inside modal */}
        {sel && <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 360, zIndex: 10 }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}>
          <DetailPanel node={sel} onClose={onCloseSel} onViewChain={onViewChain} onSelect={onSelect} chainRootId={centerId} credits={credits} setCredits={setCredits} onEvaluationComplete={onEvaluationComplete} nodeTypeLabels={nodeTypeLabels} invitedSet={invitedSet} onInvite={onInvite} onRevokeInvite={onRevokeInvite} vert={vert} terminalTypes={terminalTypes} onRequirementsClick={onRequirementsClick} onOpenSystemModal={onOpenSystemModal} onOpenSDAModal={onOpenSDAModal} onCreateDerivativeDisclosure={onCreateDerivativeDisclosure} onOpenEvalModal={node => setEvalNode(node)} approvalStates={approvalStates} evidenceRequests={evidenceRequests} />
        </div>}
      </div>
    </div>
    {/* Evaluation modal — self-managed for SubgraphModal parity */}
    <EvaluationModal
      isOpen={!!evalNode}
      node={evalNode}
      onClose={() => setEvalNode(null)}
      onComplete={(node, summary) => { if (onEvaluationComplete) onEvaluationComplete(node, summary); setEvalNode(null); }}
      credits={credits}
    />
  </div>;
}
