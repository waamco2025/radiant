import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { TT } from '../data/tokens';
import NodeIcon from './NodeIcon';
import SubgraphModal from './SubgraphModal';

const TYPE_ORDER = ['rawsource','material','chemical','process','component','subassembly','assembly','system'];

export default function SearchResultsModal({ query, data, onClose, onResultCount, rev, onRev }) {
  const [results, setResults] = useState(null);
  const [showLoading, setShowLoading] = useState(false);
  const [foundCount, setFoundCount] = useState(0);
  const [chainNodeId, setChainNodeId] = useState(null);
  const [modalSel, setModalSel] = useState(null);
  const [hovRow, setHovRow] = useState(null);
  const cancelledRef = useRef(false);

  // ── Graph layout for SubgraphModal ──────────────────────────────────
  const { gN, gE, byId } = useMemo(() => {
    const nodes = [], edges = [], conv = {};
    function walk(n, d, pid) {
      if (n.convergenceKey && conv[n.convergenceKey]) {
        if (pid) edges.push({ from: pid, to: conv[n.convergenceKey], conv: true });
        return;
      }
      nodes.push({ ...n, depth: d });
      if (n.convergenceKey) conv[n.convergenceKey] = n.id;
      if (pid) edges.push({ from: pid, to: n.id });
      if (n.children) n.children.forEach(c => walk(c, d + 1, n.id));
    }
    walk(data, 0, null);
    const m = {};
    nodes.forEach(n => m[n.id] = n);
    return { gN: nodes, gE: edges, byId: m };
  }, [data]);

  // ── Adjacency lists ────────────────────────────────────────────────
  const { adjUp, adjDown } = useMemo(() => {
    const up = {}, dn = {};
    gE.forEach(e => {
      if (!up[e.to]) up[e.to] = []; up[e.to].push(e.from);
      if (!dn[e.from]) dn[e.from] = []; dn[e.from].push(e.to);
    });
    return { adjUp: up, adjDown: dn };
  }, [gE]);

  // ── Chain for SubgraphModal ────────────────────────────────────────
  const chainIds = useMemo(() => {
    if (!chainNodeId) return null;
    const s = new Set([chainNodeId]);
    const traceUp = id => { (adjUp[id] || []).forEach(from => { if (!s.has(from)) { s.add(from); traceUp(from); } }); };
    const traceDown = id => { (adjDown[id] || []).forEach(to => { if (!s.has(to)) { s.add(to); traceDown(to); } }); };
    traceUp(chainNodeId); traceDown(chainNodeId);
    return s;
  }, [chainNodeId, adjUp, adjDown]);

  // ── Chunked search ─────────────────────────────────────────────────
  useEffect(() => {
    if (!query) { setResults([]); setShowLoading(false); setFoundCount(0); return; }
    const q = query.toLowerCase();
    cancelledRef.current = false;
    setResults(null);
    setFoundCount(0);
    setShowLoading(false);

    const allNodes = gN.filter(n => n.type !== 'customer');
    const matches = [];
    let i = 0;
    const BATCH = 200;

    const loadingTimer = setTimeout(() => {
      if (!cancelledRef.current) setShowLoading(true);
    }, 200);

    function processBatch() {
      if (cancelledRef.current) return;
      const end = Math.min(i + BATCH, allNodes.length);
      for (; i < end; i++) {
        const n = allNodes[i];
        const t = TT[n.type] || TT.component;
        const fields = [n.name, n.supplier, n.location, n.token].filter(Boolean);
        const otherMatch = fields.some(s => s.toLowerCase().includes(q));
        const typeMatch = n.type.toLowerCase().includes(q) || t.label.toLowerCase().includes(q);
        if (otherMatch || typeMatch) matches.push({ ...n, _typeMatch: typeMatch && !otherMatch });
      }
      setFoundCount(matches.length);
      if (i < allNodes.length) {
        setTimeout(processBatch, 0);
      } else {
        clearTimeout(loadingTimer);
        setShowLoading(false);
        setResults([...matches]);
        onResultCount(matches.length);
      }
    }

    const startTimer = setTimeout(processBatch, 1);
    return () => { cancelledRef.current = true; clearTimeout(loadingTimer); clearTimeout(startTimer); };
  }, [query, gN, onResultCount]);

  // ── Group results by type ──────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!results) return [];
    const groups = {};
    results.forEach(n => {
      if (!groups[n.type]) groups[n.type] = [];
      groups[n.type].push(n);
    });
    return TYPE_ORDER.filter(t => groups[t]?.length > 0).map(t => ({
      type: t, label: (TT[t] || TT.component).label, nodes: groups[t]
    }));
  }, [results]);

  // ── Highlight matching text ────────────────────────────────────────
  const hl = useCallback((text, q) => {
    if (!text || !q) return text || "";
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</span>{text.slice(idx + q.length)}</>;
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleRowClick = useCallback(n => { setChainNodeId(n.id); setModalSel(null); }, []);
  const handleViewChain = useCallback(node => { setChainNodeId(node.id); setModalSel(null); }, []);
  const closeSubchain = useCallback(() => { setChainNodeId(null); setModalSel(null); }, []);
  const closeModalSel = useCallback(() => setModalSel(null), []);
  const handleCancel = useCallback(() => { cancelledRef.current = true; onClose(); }, [onClose]);

  // ── Escape handler (capture phase — fires before App's) ────────────
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (modalSel) { setModalSel(null); return; }
      if (chainNodeId) { setChainNodeId(null); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [modalSel, chainNodeId, onClose]);

  const total = results?.length || 0;

  return <div style={{ position: "fixed", inset: 0, zIndex: 55 }}>
    {/* Backdrop */}
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />

    {/* Modal — 80% viewport */}
    <div style={{ position: "absolute", inset: "10% 10%", background: "var(--bg-app-header)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", animation: "pfade .2s ease" }}
      onClick={e => e.stopPropagation()}>

      {/* Title bar */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "monospace" }}>
          SEARCH: {query} · {results ? total : foundCount} results
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Loading state */}
        {showLoading && !results && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
          <div style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTop: "2px solid var(--accent-indigo)", borderRadius: "50%", animation: "pspin 1s linear infinite" }} />
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>Finding matches… {foundCount} found</div>
          <button onClick={handleCancel} style={{ padding: "6px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, fontFamily: "monospace" }}>Cancel</button>
        </div>}

        {/* Empty state */}
        {results && total === 0 && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
          <div style={{ fontSize: 14, color: "var(--text-tertiary)", fontWeight: 600 }}>No results for '{query}'</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Try searching by part name, supplier, location, or token hash.</div>
        </div>}

        {/* Results list */}
        {results && total > 0 && grouped.map(group => <div key={group.type}>
          {/* Sticky type header */}
          <div style={{ padding: "8px 18px 4px", fontSize: 9, color: (TT[group.type] || TT.component).border, fontFamily: "monospace", fontWeight: 700, letterSpacing: ".08em", background: "var(--bg-deep)", position: "sticky", top: 0, zIndex: 2, borderBottom: "1px solid var(--bg-surface)" }}>
            {group.label.toUpperCase()} ({group.nodes.length})
          </div>
          {group.nodes.map((n, i) => {
            const t = TT[n.type] || TT.component;
            const rowKey = `${group.type}-${i}`;
            const isHov = hovRow === rowKey;
            return <div key={n.id}
              onMouseEnter={() => setHovRow(rowKey)}
              onMouseLeave={() => setHovRow(null)}
              onClick={() => handleRowClick(n)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", cursor: "pointer", background: isHov ? "var(--bg-surface)" : "transparent", borderBottom: "1px solid #0d1117", transition: "background .15s" }}>
              <NodeIcon type={n.type} size={14} />
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{hl(n.name, query)}</span>
              </div>
              {n._typeMatch
                ? <span style={{ fontSize: 9, color: "var(--accent-amber)", fontFamily: "monospace", fontWeight: 700, flexShrink: 0, background: "var(--accent-amber-bg)", padding: "1px 4px", borderRadius: 3 }}>{hl(t.label, query)}</span>
                : <span style={{ fontSize: 9, color: t.border, fontFamily: "monospace", flexShrink: 0 }}>{t.label}</span>}
              <span style={{ fontSize: 10, color: "var(--text-secondary)", flexShrink: 0, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hl(n.supplier || "", query)}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", flexShrink: 0, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hl(n.location || "", query)}</span>
            </div>;
          })}
        </div>)}
      </div>
    </div>

    {/* SubgraphModal on top of search results */}
    {chainIds && <SubgraphModal
      key={chainNodeId}
      focusIds={chainIds}
      centerId={chainNodeId}
      gN={gN} gE={gE} byId={byId}
      title={`CHAIN: ${byId[chainNodeId]?.name || "Node"}`}
      onSelect={setModalSel}
      sel={modalSel} onCloseSel={closeModalSel} onViewChain={handleViewChain}
      onClose={closeSubchain}
      rev={rev} onRev={onRev}
      initialZoom={0.6}
    />}
  </div>;
}
