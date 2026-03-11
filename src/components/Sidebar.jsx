import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { List } from 'react-window';
import { TT, CS } from '../data/tokens';
import NodeIcon from './NodeIcon';

const ROW_HEIGHT = 36;
let sidebarClickTimer = null;

/* ═══ Type ordering for tier buttons and grouped list headers ═══ */
const TYPE_ORDER = ['customer','system','assembly','subassembly','component','process','material','chemical','rawsource'];

/* ═══ Status button definitions ═══ */
const STATUS_BTNS = [
  { key: 'verified',    icon: '✓', color: 'var(--accent-green)', label: 'VERIFIED' },
  { key: 'expired',     icon: '✗', color: 'var(--accent-amber)', label: 'EXPIRED' },
  { key: 'contested',   icon: '⚠', color: 'var(--accent-red)', label: 'CONTESTED' },
  { key: 'revoked',     icon: '⊘', color: 'var(--accent-red-muted)', label: 'REVOKED' },
  { key: 'pending',     icon: '…', color: 'var(--accent-amber)', label: 'PENDING' },
  { key: 'unevaluated', icon: '?', color: 'var(--accent-purple)', label: 'UNEVALUATED' },
  { key: 'expiring',    icon: '◷', color: 'var(--accent-amber)', label: 'EXPIRING', tooltip: 'Claims expiring within 30 days' },
];

/* ═══ Type (attestation category) buttons ═══ */
const TYPE_CATS = ['Provenance','Quality','Calibration','Custody','Qualification','Transformation','Evaluation','Other'];

/* ═══ Status colors for filter chips ═══ */
const SC = { verified: 'var(--accent-green)', expired: 'var(--accent-amber)', contested: 'var(--accent-red)', revoked: 'var(--accent-red-muted)', pending: 'var(--accent-amber)', unevaluated: 'var(--accent-purple)', expiring: 'var(--accent-amber)' };

/* ═══ Tree flatten — standard tree mode ═══ */
function flattenTree(node, depth, ex) {
  const rows = [];
  function walk(n, d) {
    rows.push({ node: n, depth: d });
    const hk = (n.children?.length > 0) || n.placeholder;
    const isE = ex[n.id];
    if (hk && isE && !n.placeholder) {
      n.children.forEach(c => walk(c, d + 1));
    }
  }
  walk(node, depth);
  return rows;
}

/* ═══ Flat grouped list — filter active mode ═══ */
function flattenFiltered(data, matchSet, nodeTypeLabels) {
  if (!matchSet || matchSet.size === 0) return [];
  const allNodes = [];
  function walk(n, parent) {
    if (matchSet.has(n.id)) allNodes.push({ node: n, parent });
    if (n.children) n.children.forEach(c => walk(c, n));
  }
  walk(data, null);
  const groups = {};
  for (const entry of allNodes) {
    const t = entry.node.type;
    if (!groups[t]) groups[t] = [];
    groups[t].push(entry);
  }
  const rows = [];
  for (const type of TYPE_ORDER) {
    if (!groups[type]) continue;
    const tt = TT[type] || TT.component;
    rows.push({ typeHeader: true, type, label: nodeTypeLabels?.[type] || tt.label, count: groups[type].length });
    for (const entry of groups[type]) {
      rows.push({ node: entry.node, depth: 0, parentLabel: entry.parent?.name || null });
    }
  }
  return rows;
}

function TreeRow({ node, depth, ex, tog, onSel, selId, rev, onRev, onDblClickNode, attFilterMatch, parentLabel, invitedSet, terminalTypes }) {
  const dimmed = attFilterMatch && !attFilterMatch.has(node.id);
  const t = TT[node.type] || TT.component;
  const hk = (node.children?.length > 0) || node.placeholder;
  const isE = ex[node.id];
  const isSel = selId === node.id;
  const isNew = node.isNew && !rev.has(node.id);
  const cs = node.compliance ? CS[node.compliance] : null;
  const canDbl = onDblClickNode && node.type !== 'customer' && depth > 0;

  if (node.placeholder && isE) {
    return <div style={{ paddingLeft: depth * 14 + 26, padding: "6px", color: "var(--text-muted)", fontSize: 10, fontStyle: "italic", fontFamily: "monospace", height: ROW_HEIGHT, display: "flex", alignItems: "center" }}>
      {node.childCount} pending…
    </div>;
  }

  const handleClick = () => {
    if (canDbl) {
      if (sidebarClickTimer) { clearTimeout(sidebarClickTimer); sidebarClickTimer = null; onDblClickNode(node); return; }
      sidebarClickTimer = setTimeout(() => { sidebarClickTimer = null; if (isNew) onRev(node.id); onSel(node); if (hk) tog(node.id); }, 250);
    } else {
      if (isNew) onRev(node.id); onSel(node); if (hk) tog(node.id);
    }
  };

  return <div style={{ paddingLeft: parentLabel != null ? 4 : depth * 14, opacity: dimmed ? 0.25 : 1, height: ROW_HEIGHT, display: "flex", alignItems: "center" }}>
    <div onClick={handleClick}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 6px", borderRadius: 5, cursor: "pointer", flex: 1, minWidth: 0,
        background: isNew ? "linear-gradient(90deg,var(--accent-indigo-bg),color-mix(in srgb, var(--accent-purple) 15%, var(--bg-deep)),var(--accent-indigo-bg))" : isSel ? t.bg : "transparent",
        backgroundSize: isNew ? "200% 100%" : undefined,
        animation: isNew ? "pshim 3s linear infinite,pglow 2s ease-in-out infinite" : undefined,
        borderLeft: `3px solid ${isSel ? t.border : isNew ? "var(--accent-indigo-dim)" : "transparent"}` }}
      onMouseEnter={e => { if (!isSel && !isNew) e.currentTarget.style.background = `color-mix(in srgb, ${t.bg} 53%, transparent)`; }}
      onMouseLeave={e => { if (!isSel && !isNew) e.currentTarget.style.background = "transparent"; }}>
      {parentLabel == null && <span style={{ fontFamily: "monospace", fontSize: 12, color: hk ? t.border : "var(--text-faint)", width: 12, flexShrink: 0, display: "inline-block" }}>{hk ? (isE ? "▾" : "›") : "·"}</span>}
      <NodeIcon type={node.type} size={12} />
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.name}</span>
          {node.itar && <span style={{ fontSize: 7, background: "var(--accent-red-bg)", color: "var(--accent-red)", padding: "0 3px", borderRadius: 2, fontWeight: 700, flexShrink: 0 }}>ITAR</span>}
          {isNew && <span style={{ fontSize: 7, background: "var(--accent-indigo-bg)", color: "var(--accent-indigo-light)", padding: "0 4px", borderRadius: 2, fontWeight: 700, animation: "ppulse 1.5s ease-in-out infinite", flexShrink: 0 }}>✦ NEW</span>}
          {cs && node.compliance !== "compliant" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: cs.c, flexShrink: 0 }} />}
          {!(node.rawAttestations||[]).some(a=>a.predicate==='evaluated_against_requirements')&&node.type!=='customer'&&<span style={{fontSize:7,background:'var(--accent-purple)',color:'var(--text-bright)',padding:'0 3px',borderRadius:2,fontWeight:700,flexShrink:0,lineHeight:'12px'}}>?</span>}
          {(invitedSet instanceof Map?invitedSet.has(node.id):invitedSet?.has?.(node.id))&&(!node.children||node.children.length===0)&&!(terminalTypes||['rawsource']).includes(node.type)&&<span style={{fontSize:7,background:'var(--accent-amber-bg)',color:'var(--accent-amber)',padding:'0 4px',borderRadius:2,fontWeight:700,flexShrink:0,border:'1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)'}}>INVITED</span>}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {parentLabel != null ? <span style={{ color: "var(--text-muted)" }}>↳ {parentLabel}</span> : node.supplier}
        </div>
      </div>
    </div>
  </div>;
}

/* ═══ Approval status button definitions ═══ */
const APPROVAL_BTNS = [
  { key: 'approved',    icon: '✓', color: 'var(--accent-green)', label: 'APPROVED' },
  { key: 'provisional', icon: '◌', color: 'var(--accent-amber)', label: 'PROVISIONAL' },
  { key: 'rejected',    icon: '✗', color: 'var(--accent-red)', label: 'REJECTED' },
];

export default function Sidebar({ data, exMap, tog, onSel, selId, rev, onRev, stats, colAll, onDblClickNode, attFilter, onAttFilterChange, attFilterMatch, sidebarTitle, nodeTypeLabels, focusSearchKey, searchMatchCount, onRevealAll, revealedSet, invitedSet, terminalTypes, approvalStates }) {
  const [sideCol, setSC] = useState(false);
  const containerRef = useRef(null);
  const [listHeight, setListHeight] = useState(400);
  const searchRef = useRef(null);
  const [traceTooltip, setTraceTooltip] = useState(null);
  const [metricTooltip, setMetricTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [searchFocus, setSearchFocus] = useState(false);
  const [recents, setRecents] = useState([]);
  const [sideFilterOpen, setSideFilterOpen] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setListHeight(entry.contentRect.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [sideCol]);

  /* ═══ Cmd+K focus ═══ */
  useEffect(() => {
    if (focusSearchKey > 0 && searchRef.current) {
      if (sideCol) setSC(false);
      searchRef.current.focus();
    }
  }, [focusSearchKey]);

  /* ═══ Available tiers from dataset ═══ */
  const availableTiers = useMemo(() => {
    const found = new Set();
    function walk(n) { found.add(n.type); if (n.children) n.children.forEach(walk); }
    walk(data);
    return TYPE_ORDER.filter(t => found.has(t));
  }, [data]);

  /* ═══ Unrevealed count ═══ */
  const unrevealedCount = useMemo(() => {
    if (!revealedSet) return stats.newN;
    let count = 0;
    const walk = n => { if (n.isNew && !revealedSet.has(n.id)) count++; if (n.children) n.children.forEach(walk); };
    walk(data);
    return count;
  }, [data, revealedSet, stats.newN]);

  /* ═══ Filter callbacks ═══ */
  const hasActive = attFilter.statuses.size > 0 || attFilter.types.size > 0 || attFilter.tiers.size > 0 || attFilter.approvalStatuses.size > 0 || attFilter.isNew || attFilter.converge || attFilter.compliant || !!attFilter.search;
  const activeCount = attFilter.statuses.size + attFilter.types.size + attFilter.tiers.size + attFilter.approvalStatuses.size + (attFilter.isNew ? 1 : 0) + (attFilter.converge ? 1 : 0) + (attFilter.compliant ? 1 : 0) + (attFilter.search ? 1 : 0);
  const filterSectionCount = attFilter.statuses.size + attFilter.types.size + attFilter.tiers.size + attFilter.approvalStatuses.size;

  const toggleStatus = useCallback(s => {
    const ns = new Set(attFilter.statuses);
    if (ns.has(s)) ns.delete(s); else ns.add(s);
    onAttFilterChange({ ...attFilter, statuses: ns });
  }, [attFilter, onAttFilterChange]);

  const toggleType = useCallback(t => {
    const nt = new Set(attFilter.types);
    if (nt.has(t)) nt.delete(t); else nt.add(t);
    onAttFilterChange({ ...attFilter, types: nt });
  }, [attFilter, onAttFilterChange]);

  const toggleTier = useCallback(t => {
    const nt = new Set(attFilter.tiers);
    if (nt.has(t)) nt.delete(t); else nt.add(t);
    onAttFilterChange({ ...attFilter, tiers: nt });
  }, [attFilter, onAttFilterChange]);

  const toggleApprovalStatus = useCallback(s => {
    const ns = new Set(attFilter.approvalStatuses);
    if (ns.has(s)) ns.delete(s); else ns.add(s);
    onAttFilterChange({ ...attFilter, approvalStatuses: ns });
  }, [attFilter, onAttFilterChange]);

  const setSearch = useCallback(val => {
    onAttFilterChange({ ...attFilter, search: val });
  }, [attFilter, onAttFilterChange]);

  const toggleIsNew = useCallback(() => {
    onAttFilterChange({ ...attFilter, isNew: !attFilter.isNew });
  }, [attFilter, onAttFilterChange]);

  const toggleConverge = useCallback(() => {
    onAttFilterChange({ ...attFilter, converge: !attFilter.converge });
  }, [attFilter, onAttFilterChange]);

  const toggleCompliant = useCallback(() => {
    onAttFilterChange({ ...attFilter, compliant: !attFilter.compliant });
  }, [attFilter, onAttFilterChange]);

  const clearFilters = useCallback(() => {
    onAttFilterChange({ statuses: new Set(), types: new Set(), tiers: new Set(), approvalStatuses: new Set(), isNew: false, converge: false, compliant: false, search: '' });
  }, [onAttFilterChange]);

  /* ═══ Recent searches (debounced save) ═══ */
  const addRecent = useCallback(q => {
    if (!q || q.trim().length < 3) return;
    setRecents(prev => {
      const filtered = prev.filter(r => r !== q);
      return [q, ...filtered].slice(0, 8);
    });
  }, []);

  /* Debounce: save to history after 1500ms of no typing */
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (attFilter.search && attFilter.search.trim().length >= 3) {
      debounceRef.current = setTimeout(() => { addRecent(attFilter.search); }, 1500);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [attFilter.search, addRecent]);

  const showRecents = searchFocus && !attFilter.search && recents.length > 0;

  /* ═══ Collapse All: show when any node beyond root is expanded ═══ */
  const showCollapseAll = useMemo(() => {
    const rootId = data.id;
    return Object.keys(exMap).some(k => k !== rootId && exMap[k]);
  }, [exMap, data.id]);

  /* ═══ Two-mode flatten ═══ */
  const flatRows = useMemo(() => {
    if (hasActive && attFilterMatch) {
      return flattenFiltered(data, attFilterMatch, nodeTypeLabels);
    }
    return flattenTree(data, 0, exMap);
  }, [data, exMap, hasActive, attFilterMatch, nodeTypeLabels]);

  const RowComponent = useCallback(({ index, style }) => {
    const row = flatRows[index];
    if (row.typeHeader) {
      const tt = TT[row.type] || TT.component;
      return <div style={{ ...style, display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid var(--border)66" }}>
        <NodeIcon type={row.type} size={11} />
        <span style={{ fontSize: 10, fontWeight: 700, color: tt.text, fontFamily: "monospace" }}>{row.label}</span>
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace" }}>{row.count}</span>
      </div>;
    }
    const { node, depth, parentLabel } = row;
    return <div style={style}>
      <TreeRow node={node} depth={depth} ex={exMap} tog={tog} onSel={onSel} selId={selId} rev={rev} onRev={onRev} onDblClickNode={onDblClickNode} attFilterMatch={attFilterMatch} parentLabel={parentLabel} invitedSet={invitedSet} terminalTypes={terminalTypes} />
    </div>;
  }, [flatRows, exMap, tog, onSel, selId, rev, onRev, onDblClickNode, attFilterMatch, invitedSet]);

  /* ═══ Metric buttons ═══ */
  const metricBtnStyle = (active, color) => ({
    display: "flex", alignItems: "baseline", gap: 3, cursor: active !== undefined ? "pointer" : "default",
    padding: "2px 6px", borderRadius: 4,
    border: active ? `1px solid color-mix(in srgb, ${color} 27%, transparent)` : "1px solid transparent",
    background: active ? `color-mix(in srgb, ${color} 6%, transparent)` : "transparent",
    transition: "all .15s",
  });

  return <div style={{ width: sideCol ? 40 : 360, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", background: "var(--bg-deep)", transition: "width .25s", overflow: "hidden" }}>
    {/* ═══ Header bar ═══ */}
    <div style={{ padding: sideCol ? "10px 8px" : "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <button onClick={() => setSC(!sideCol)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>{sideCol ? "»" : "«"}</button>
      {!sideCol && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "monospace" }}>{sidebarTitle||"SUPPLY CHAIN"}</span>}
    </div>

    {!sideCol && <>
      {/* ═══ FILTERS panel (always visible, scrollable) ═══ */}
      <div style={{ maxHeight: '55vh', overflowY: 'auto', flexShrink: 0 }}>
        {/* ── Metrics row ── */}
        <div style={{ padding: "6px 10px", display: "flex", gap: 4, flexWrap: "wrap" }}>
          <div style={metricBtnStyle(undefined, 'var(--accent-blue)')}
            onMouseEnter={e => { setMetricTooltip('tokens'); setTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={() => setMetricTooltip(null)}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-blue)", fontFamily: "monospace" }}>{stats.total}</span>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>TOKENS</span>
          </div>
          <div style={metricBtnStyle(undefined, 'var(--accent-cyan)')}
            onMouseEnter={e => { setMetricTooltip('depth'); setTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={() => setMetricTooltip(null)}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "monospace" }}>{stats.depth}</span>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>DEPTH</span>
          </div>
          <div onClick={toggleConverge} style={metricBtnStyle(attFilter.converge, 'var(--accent-purple-light)')}
            onMouseEnter={e => { setMetricTooltip('converge'); setTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={() => setMetricTooltip(null)}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-purple-light)", fontFamily: "monospace" }}>{stats.conv}</span>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>CONVERGE</span>
          </div>
          <div onClick={toggleCompliant} style={metricBtnStyle(attFilter.compliant, 'var(--accent-green)')}
            onMouseEnter={e => { setMetricTooltip('ok'); setTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={() => setMetricTooltip(null)}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-green)", fontFamily: "monospace" }}>{stats.comp.compliant}</span>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>OK</span>
          </div>
          {stats.comp.expiring > 0 && <div onClick={() => toggleStatus('expiring')} style={metricBtnStyle(attFilter.statuses.has('expiring'), 'var(--accent-amber)')}
            onMouseEnter={e => { setMetricTooltip('warning'); setTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={() => setMetricTooltip(null)}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-amber)", fontFamily: "monospace" }}>{stats.comp.expiring}</span>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>⚠</span>
          </div>}
          {stats.newN > 0 && <div onClick={toggleIsNew} style={{ ...metricBtnStyle(attFilter.isNew, 'var(--accent-indigo)'), animation: attFilter.isNew ? undefined : "ppulse 2s ease-in-out infinite" }}
            onMouseEnter={e => { setMetricTooltip('new'); setTooltipPos({ x: e.clientX, y: e.clientY }); }} onMouseLeave={() => setMetricTooltip(null)}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-indigo)", fontFamily: "monospace" }}>{unrevealedCount}</span>
            <span style={{ fontSize: 9, color: "var(--accent-indigo)" }}>✦ NEW</span>
            {onRevealAll && unrevealedCount > 0 && <span onClick={e => { e.stopPropagation(); onRevealAll(); }} style={{ fontSize: 9, color: "var(--accent-indigo)", fontFamily: "monospace", cursor: "pointer", fontWeight: 600, marginLeft: 4 }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-indigo-light)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--accent-indigo)"; }}>Reveal All →</span>}
          </div>}
        </div>
        {/* ── Fixed-position metric tooltip ── */}
        {metricTooltip && <div style={{ position: "fixed", left: tooltipPos.x, top: tooltipPos.y + 20, minWidth: 180, maxWidth: 240, background: "var(--border)", border: "1px solid #333", borderRadius: 4, padding: "6px 8px", fontSize: 9, color: "var(--text-primary)", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,.5)", pointerEvents: "none" }}>
          {{ tokens: "Total assets and entities tracked on this network", depth: "Maximum supply chain depth from network owner to raw sources", converge: "Nodes that appear in multiple supply chain branches", ok: "Nodes with all claims verified and current", warning: "Nodes with expired, contested, or expiring claims", new: "Recently added nodes not yet fully attested" }[metricTooltip]}
        </div>}

        {/* ── Traceability bars with tooltips ── */}
        <div style={{ padding: "0 10px 8px" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4, letterSpacing: ".06em" }}>TRACEABILITY</div>
          {[
            { l: "Active Depth", v: stats.trace.ad, cl: "var(--accent-cyan)", g: "linear-gradient(90deg,#22d3ee,#3b82f6)", t: `${stats.trace.raw}/${stats.trace.raw + stats.trace.other} → raw`, tip: "Percentage of maximum possible supply chain depth that has been traced." },
            { l: "Coverage", v: stats.trace.nc, cl: "var(--accent-indigo)", g: "linear-gradient(90deg,#818cf8,#6366f1)", t: `~${stats.trace.ph} pending`, tip: "Percentage of nodes with at least one verified attestation." },
          ].map(x =>
            <div key={x.l} style={{ marginBottom: 6, position: "relative" }}
              onMouseEnter={() => setTraceTooltip(x.l)}
              onMouseLeave={() => setTraceTooltip(null)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>{x.l}</span>
                <span style={{ fontSize: 9, color: x.cl, fontWeight: 700, fontFamily: "monospace" }}>{x.v}%</span>
              </div>
              <div style={{ height: 3, background: "var(--bg-surface)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${x.v}%`, background: x.g, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>{x.t}</div>
              {traceTooltip === x.l && <div style={{
                position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0,
                background: "var(--border)", border: "1px solid #333", borderRadius: 4,
                padding: "6px 8px", fontSize: 9, color: "var(--text-primary)", zIndex: 60,
                boxShadow: "0 4px 12px rgba(0,0,0,.5)",
              }}>{x.tip}</div>}
            </div>
          )}
        </div>

        {/* ── SEARCH ── */}
        <div style={{ padding: "4px 10px", marginBottom: 12, position: "relative" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4, letterSpacing: ".06em" }}>SEARCH</div>
          <div style={{ position: "relative" }}>
            <input
              ref={searchRef}
              value={attFilter.search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              onKeyDown={e => { if (e.key === 'Escape') { if (debounceRef.current) clearTimeout(debounceRef.current); if (attFilter.search) addRecent(attFilter.search); setSearch(''); e.target.blur(); } }}
              placeholder="Search suppliers, parts, actors…"
              style={{
                width: "100%", padding: "8px 10px", paddingRight: attFilter.search ? 60 : 10,
                fontSize: 14, fontFamily: "var(--font-display)",
                height: 40, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 5,
                color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
              }}
            />
            {attFilter.search && <button onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); addRecent(attFilter.search); setSearch(''); }} style={{ position: "absolute", right: searchMatchCount > 0 ? 40 : 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12, padding: "0 4px", fontFamily: "monospace" }}>✕</button>}
            {searchMatchCount > 0 && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: "var(--accent-purple-light)", background: "var(--accent-indigo-bg)", padding: "2px 7px", borderRadius: 10, fontFamily: "monospace", fontWeight: 700, pointerEvents: "none", lineHeight: "14px" }}>{searchMatchCount}</span>}
          </div>
          {/* Recent searches dropdown */}
          {showRecents && <div style={{
            position: "absolute", left: 10, right: 10, top: "100%", zIndex: 60,
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,.5)", padding: 4, marginTop: 2,
          }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", padding: "4px 8px", letterSpacing: ".08em" }}>RECENT SEARCHES</div>
            {recents.map(q => <div key={q}
              onMouseDown={e => { e.preventDefault(); setSearch(q); }}
              style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 4, fontSize: 11, color: "var(--text-primary)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              {q}
            </div>)}
          </div>}
        </div>

        {/* ── Collapsible FILTERS toggle ── */}
        <div style={{ padding: "0 10px", marginBottom: 8 }}>
          <div onClick={() => setSideFilterOpen(p => !p)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", padding: "4px 0", marginBottom: sideFilterOpen ? 8 : 0 }}>
            <span style={{ fontSize: 9, color: filterSectionCount > 0 ? "var(--accent-indigo)" : "var(--text-muted)", fontFamily: "monospace", fontWeight: 700, letterSpacing: ".06em" }}>FILTERS{filterSectionCount > 0 ? ` (${filterSectionCount} active)` : ""}</span>
            <span style={{ fontSize: 8, color: "var(--text-muted)", transition: "transform .15s", transform: sideFilterOpen ? "rotate(180deg)" : "none" }}>▾</span>
          </div>
        </div>

        {sideFilterOpen && <>
        {/* ── STATUS ── */}
        <div style={{ padding: "0 10px", marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4, letterSpacing: ".06em" }}>STATUS</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {STATUS_BTNS.map(s => {
              const on = attFilter.statuses.has(s.key);
              const ac = SC[s.key] || s.color;
              return <button key={s.key} onClick={() => toggleStatus(s.key)} title={s.tooltip || s.label} style={{
                padding: "4px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 600, minHeight: 28,
                border: "1px solid " + (on ? `color-mix(in srgb, ${ac} 53%, transparent)` : "var(--border)"), borderRadius: 4,
                background: on ? `color-mix(in srgb, ${ac} 13%, transparent)` : "transparent",
                color: on ? ac : "var(--text-muted)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}><span style={{ fontSize: 12 }}>{s.icon}</span>{s.label}</button>;
            })}
          </div>
        </div>

        {/* ── CLAIM TYPE ── */}
        <div style={{ padding: "0 10px", marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4, letterSpacing: ".06em" }}>CLAIM TYPE</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {TYPE_CATS.map(t => {
              const on = attFilter.types.has(t);
              return <button key={t} onClick={() => toggleType(t)} style={{
                padding: "4px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: on ? 600 : 400, minHeight: 28,
                border: "1px solid " + (on ? "var(--accent-indigo)" : "var(--border)"), borderRadius: 4,
                background: on ? "var(--accent-indigo-bg)" : "transparent",
                color: on ? "var(--accent-indigo-light)" : "var(--text-muted)", cursor: "pointer",
              }}>{t}</button>;
            })}
          </div>
        </div>

        {/* ── TIER ── */}
        <div style={{ padding: "0 10px", marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4, letterSpacing: ".06em" }}>TIER</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {availableTiers.map(k => {
              const tt = TT[k] || TT.component;
              const on = attFilter.tiers.has(k);
              return <button key={k} onClick={() => toggleTier(k)} style={{
                padding: "3px 7px", fontSize: 11, fontFamily: "monospace", fontWeight: on ? 600 : 400, minHeight: 28,
                border: "1px solid " + (on ? tt.border : "var(--border)"), borderRadius: 4,
                background: on ? tt.bg : "transparent",
                color: on ? tt.text : "var(--text-muted)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}><NodeIcon type={k} size={10} />{nodeTypeLabels?.[k] || tt.label}</button>;
            })}
          </div>
        </div>

        {/* ── APPROVAL STATUS ── */}
        <div style={{ padding: "0 10px", marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 4, letterSpacing: ".06em" }}>APPROVAL STATUS</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {APPROVAL_BTNS.map(s => {
              const on = attFilter.approvalStatuses.has(s.key);
              return <button key={s.key} onClick={() => toggleApprovalStatus(s.key)} style={{
                padding: "4px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 600, minHeight: 28,
                border: "1px solid " + (on ? `color-mix(in srgb, ${s.color} 53%, transparent)` : "var(--border)"), borderRadius: 4,
                background: on ? `color-mix(in srgb, ${s.color} 13%, transparent)` : "transparent",
                color: on ? s.color : "var(--text-muted)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}><span style={{ fontSize: 12 }}>{s.icon}</span>{s.label}</button>;
            })}
          </div>
        </div>
        </>}
      </div>

      {/* ── Clear Filters (outside scroll container, always visible when active) ── */}
      {hasActive && <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <button onClick={clearFilters}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          style={{
            width: "100%", padding: "6px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 600,
            border: "1px solid var(--border)", borderRadius: 4,
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            transition: "background .15s",
          }}>Clear Filters{activeCount > 0 ? ` (${activeCount})` : ""}{attFilterMatch ? ` · ${attFilterMatch.size} matches` : ""}</button>
      </div>}

      {/* ═══ Pending Invitations ═══ */}
      <div style={{ padding: "6px 10px 2px", borderTop: "1px solid var(--border)", flexShrink: 0, marginTop: 4 }}>
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", fontWeight: 700, letterSpacing: ".06em" }}>PENDING INVITATIONS</span>
      </div>
      <div style={{ padding: "6px 10px 10px", flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "var(--border-hover)", fontFamily: "monospace", fontStyle: "italic" }}>Sent invitations will appear here</div>
      </div>

      {/* ═══ List Panel ═══ */}
      <div style={{ padding: "6px 10px 2px", borderTop: "1px solid var(--border)", flexShrink: 0, marginTop: 4 }}>
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", fontWeight: 700, letterSpacing: ".06em" }}>NODES</span>
      </div>
      {!hasActive && showCollapseAll && <div style={{ padding: "4px 10px", flexShrink: 0, display: "flex", justifyContent: "center" }}>
        <button onClick={colAll} style={{ width: 340, fontSize: 9, padding: "2px 6px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-tertiary)", cursor: "pointer", fontFamily: "monospace" }}>Collapse All</button>
      </div>}

      {hasActive && attFilterMatch && attFilterMatch.size === 0
        ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>No matches</div>
            <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "monospace" }}>Try adjusting your filters</div>
          </div>
        : <div ref={containerRef} style={{ flex: 1, overflow: "hidden", padding: "2px 0", userSelect: "none", WebkitUserSelect: "none" }}>
            <List
              height={listHeight}
              rowCount={flatRows.length}
              rowHeight={ROW_HEIGHT}
              rowComponent={RowComponent}
              rowProps={{}}
              overscanCount={20}
              style={{ padding: "0 8px", overflow: "auto" }}
            />
          </div>}
    </>}
  </div>;
}
