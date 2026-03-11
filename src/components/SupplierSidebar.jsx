import { useState, useRef, useMemo } from 'react';
import { TT } from '../data/tokens';
import NodeIcon from './NodeIcon';

const REF_T = new Date('2026-02-17').getTime();

/* Invitations are now passed as props from App.jsx */

function healthDot(rawAtts) {
  const raw = rawAtts || [];
  for (const a of raw) {
    if (a.status === 'contested' || a.status === 'revoked') return 'var(--accent-red)';
  }
  for (const a of raw) {
    if (a.status === 'expired' || a.status === 'pending') return 'var(--accent-amber)';
    if (a.status === 'verified' && a.validUntil) {
      const d = (new Date(a.validUntil).getTime() - REF_T) / 86400000;
      if (d > 0 && d <= 30) return 'var(--accent-amber)';
    }
  }
  return raw.length > 0 ? 'var(--accent-green)' : 'var(--border-hover)';
}

/* ── Asset row ── */
function AssetRow({ node, depth, dot, tk, onClick }) {
  return <div onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `4px 12px 4px ${12 + depth * 16}px`, cursor: 'pointer', minWidth: 0 }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
    <NodeIcon type={node.type} size={11} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: depth > 0 ? 'var(--text-secondary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tk.label}</div>
    </div>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
  </div>;
}

/* ── Invitation row ── */
function InvitationRow({ inv, onClick }) {
  const isPending = inv.status === 'pending';
  const isAccepted = inv.status === 'accepted';
  const dotColor = isPending ? 'var(--accent-amber)' : isAccepted ? 'var(--accent-green)' : 'var(--text-muted)';
  return <div onClick={onClick}
    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px', cursor: 'pointer', opacity: isPending ? 1 : 0.7 }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 4 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.customer}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Requesting: {inv.asset}</div>
    </div>
    {isAccepted
      ? <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-bg)', padding: '1px 5px', borderRadius: 3, flexShrink: 0, marginTop: 2 }}>ACCEPTED</span>
      : <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0, paddingTop: 2 }}>{inv.date.slice(5)}</div>
    }
  </div>;
}

const SDA_SEGS = [
  { key: 'full', color: 'var(--accent-sda-full)', label: 'Full Disclosure' },
  { key: 'selective', color: 'var(--accent-amber)', label: 'Selective Disclosure' },
  { key: 'derivative', color: 'var(--accent-green)', label: 'Derivative Disclosure' },
  { key: 'cascade', color: 'var(--accent-sda-cascade)', label: 'Cascade Disclosure' },
];

/* ── Buyer row ── */
function BuyerRow({ name, assetCount, sdaCounts, onClick }) {
  const [segTip, setSegTip] = useState(null);
  const segs = SDA_SEGS.filter(s => sdaCounts?.[s.key] > 0);
  return <div onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer' }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{assetCount} asset{assetCount !== 1 ? 's' : ''}</div>
    </div>
    {segs.length > 0 && <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
      {segs.map(s => {
        const count = sdaCounts[s.key];
        return <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}
          onMouseEnter={e => { e.stopPropagation(); setSegTip({ key: s.key, x: e.clientX, y: e.clientY }); }}
          onMouseMove={e => setSegTip(p => p ? { ...p, x: e.clientX, y: e.clientY } : p)}
          onMouseLeave={() => setSegTip(null)}>
          <svg width={12} height={8} style={{ flexShrink: 0 }}><line x1={0} y1={4} x2={12} y2={4} stroke={s.color} strokeWidth={2} /></svg>
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: s.color }}>{count}</span>
          {segTip?.key === s.key && <div style={{
            position: 'fixed', left: segTip.x + 8, top: segTip.y - 28, zIndex: 200,
            background: 'var(--border)', border: '1px solid var(--border-hover)', borderRadius: 4,
            padding: '3px 8px', fontSize: 10, color: 'var(--text-primary)', whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>{s.label} ({count} asset{count !== 1 ? 's' : ''})</div>}
        </div>;
      })}
    </div>}
  </div>;
}

/* ── Supplier Sidebar ── */
/* ── Disclosure request row ── */
function DisclosureRequestRow({ req }) {
  const isPending = req.status === 'pending';
  const isApproved = req.status === 'approved';
  const isDeclined = req.status === 'declined';
  const dotColor = isPending ? 'var(--accent-purple-light)' : isApproved ? 'var(--accent-green)' : isDeclined ? 'var(--accent-red)' : 'var(--text-muted)';
  const typeColor = req.requestedType === 'full' ? 'var(--accent-sda-full)' : req.requestedType === 'selective' ? 'var(--accent-amber)' : req.requestedType === 'derivative' ? 'var(--accent-green)' : 'var(--accent-indigo)';
  return <div
    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px', opacity: isPending ? 1 : 0.7 }}>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 4 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.requestedBy || 'Buyer'}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Requesting: {req.assetName}</div>
    </div>
    {isApproved
      ? <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-bg)', padding: '1px 5px', borderRadius: 3, flexShrink: 0, marginTop: 2 }}>APPROVED</span>
      : isDeclined
        ? <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-red)', background: 'var(--accent-red-bg)', padding: '1px 5px', borderRadius: 3, flexShrink: 0, marginTop: 2 }}>DECLINED</span>
        : <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: `color-mix(in srgb, ${typeColor} 8%, transparent)`, color: typeColor, border: `1px solid color-mix(in srgb, ${typeColor} 20%, transparent)`, flexShrink: 0, marginTop: 2 }}>{req.requestedType}</span>
    }
  </div>;
}

export default function SupplierSidebar({ persona, customerData, invitations, onSidebarAssetSelect, onOpenInvitation, onGraphPanToBuyer, disclosureRequests, cascadeRequests, onBrowseRequirements }) {
  const [sideCol, setSideCol] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const [dotTip, setDotTip] = useState(null);

  /* Total asset count: all assets (supplier node + descendants) across all customers */
  const totalAssets = useMemo(() =>
    (customerData || []).reduce((s, cd) => s + (cd.assets?.length || 0), 0),
  [customerData]);

  const pendingInvCount = (invitations||[]).filter(i => i.status === 'pending').length;
  const pendingDreqCount = (disclosureRequests||[]).filter(r => r.status === 'pending').length;
  const pendingCascCount = (cascadeRequests||[]).filter(r => r.status === 'pending').length;

  /* Buyers summary — collect SDA type counts per buyer */
  const buyers = useMemo(() => {
    const map = new Map();
    const mkEntry = (name, verticalKey) => ({ name, verticalKey, assetCount: 0, sdaCounts: { full: 0, selective: 0, derivative: 0, cascade: 0 } });
    for (const cd of (customerData || [])) {
      if (!map.has(cd.customerName)) map.set(cd.customerName, mkEntry(cd.customerName, cd.verticalKey));
      const b = map.get(cd.customerName);
      b.assetCount += (cd.assets?.length || 0);
      for (const a of (cd.assets || [])) {
        for (const sda of (a.node.sdas || [])) {
          if (sda.status !== 'active') continue;
          if (sda.type && b.sdaCounts[sda.type] !== undefined) b.sdaCounts[sda.type]++;
          const rName = sda.receiver;
          if (rName && rName !== cd.customerName) {
            if (!map.has(rName)) map.set(rName, mkEntry(rName, cd.verticalKey));
            if (sda.type && map.get(rName).sdaCounts[sda.type] !== undefined) map.get(rName).sdaCounts[sda.type]++;
          }
        }
      }
    }
    return Array.from(map.values());
  }, [customerData]);

  /* Flat alphabetical asset list for MY ASSETS section */
  const flatAssets = useMemo(() => {
    const rows = [];
    for (const cd of (customerData || [])) {
      if (!cd.supplierNode) continue;
      rows.push({ cd, node: cd.supplierNode });
      for (const child of (cd.upstreamNodes || [])) {
        rows.push({ cd, node: child });
      }
    }
    rows.sort((a, b) => a.node.name.localeCompare(b.node.name));
    return rows;
  }, [customerData]);

  /* Search filter */
  const qLow = query.toLowerCase().trim();
  const isSearching = !!qLow;

  const filteredAssets = useMemo(() => {
    if (!qLow) return null;
    const results = [];
    for (const cd of (customerData || [])) {
      const nodes = [cd.supplierNode, ...(cd.upstreamNodes || [])].filter(Boolean);
      nodes.forEach((node, i) => {
        const tk = TT[node.type] || TT.component;
        if (node.name.toLowerCase().includes(qLow) ||
            cd.customerName.toLowerCase().includes(qLow) ||
            tk.label.toLowerCase().includes(qLow)) {
          results.push({ cd, node, depth: i === 0 ? 0 : 1 });
        }
      });
    }
    return results;
  }, [customerData, qLow]);

  const filteredInvitations = useMemo(() => {
    if (!qLow) return null;
    return (invitations||[]).filter(inv =>
      inv.customer.toLowerCase().includes(qLow) || inv.asset.toLowerCase().includes(qLow)
    );
  }, [qLow, invitations]);

  const filteredDisclosureRequests = useMemo(() => {
    if (!qLow) return null;
    return (disclosureRequests||[]).filter(r =>
      (r.requestedBy||'').toLowerCase().includes(qLow) || (r.assetName||'').toLowerCase().includes(qLow)
    );
  }, [qLow, disclosureRequests]);

  const filteredCascadeRequests = useMemo(() => {
    if (!qLow) return null;
    return (cascadeRequests||[]).filter(r =>
      (r.requesterNodeName||'').toLowerCase().includes(qLow) || (r.supplierOrg||'').toLowerCase().includes(qLow)
    );
  }, [qLow, cascadeRequests]);

  return <div style={{ width: sideCol ? 40 : 280, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg-deep)', transition: 'width .25s', overflow: 'hidden' }}>

    {/* ── Header bar ── */}
    <div style={{ padding: sideCol ? '10px 8px' : '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <button onClick={() => setSideCol(p => !p)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>{sideCol ? '\u00bb' : '\u00ab'}</button>
      {!sideCol && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace', letterSpacing: '.08em' }}>SUPPLIER PORTAL</span>}
    </div>

    {!sideCol && <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* ── Search ── */}
      <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); e.target.blur(); } }}
            placeholder="Search assets, customers…"
            className="dim-ph"
            style={{
              width: '100%', padding: '8px 10px', paddingRight: query ? 28 : 10,
              fontSize: 13, height: 36, background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 5, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              fontFamily: "var(--font-display)",
            }}
          />
          {query && <button onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 11, padding: '0 2px', fontFamily: 'monospace' }}>✕</button>}
        </div>
      </div>

      {isSearching ? (
        /* ── Flat search results ── */
        <div style={{ paddingTop: 4 }}>
          {filteredAssets && filteredAssets.length > 0 && <>
            <div style={{ padding: '4px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>ASSETS</div>
            {filteredAssets.map(({ cd, node, depth }, i) => {
              const tk = TT[node.type] || TT.component;
              const dot = healthDot(node.rawAttestations || node.attestations || []);
              return <AssetRow key={`${cd.verticalKey}-${node.id}-${i}`} node={node} depth={depth} dot={dot} tk={tk}
                onClick={() => onSidebarAssetSelect?.(cd.verticalKey, cd.supplierNodeId, node.id)} />;
            })}
          </>}
          {filteredInvitations && filteredInvitations.length > 0 && <>
            <div style={{ padding: '8px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>INVITATIONS</div>
            {filteredInvitations.map(inv => <InvitationRow key={inv.id} inv={inv} onClick={() => onOpenInvitation(inv.id)} />)}
          </>}
          {filteredDisclosureRequests && filteredDisclosureRequests.length > 0 && <>
            <div style={{ padding: '8px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>DISCLOSURE REQUESTS</div>
            {filteredDisclosureRequests.map(r => <DisclosureRequestRow key={r.id} req={r} />)}
          </>}
          {filteredCascadeRequests && filteredCascadeRequests.length > 0 && <>
            <div style={{ padding: '8px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>CASCADE REQUESTS</div>
            {filteredCascadeRequests.map(cr => {
              const isPending = cr.status === 'pending';
              const isAccepted = cr.status === 'accepted';
              const dotColor = isPending ? 'var(--accent-sda-cascade)' : isAccepted ? 'var(--accent-green)' : 'var(--text-muted)';
              return <div key={cr.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px', opacity: isPending ? 1 : 0.7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cr.requesterNodeName}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cascade from buyer</div>
                </div>
                <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: isPending ? 'var(--accent-sda-cascade)' : isAccepted ? 'var(--accent-green)' : 'var(--text-muted)', textTransform: 'uppercase', flexShrink: 0, marginTop: 2 }}>{cr.status}</span>
              </div>;
            })}
          </>}
          {filteredAssets?.length === 0 && filteredInvitations?.length === 0 && filteredDisclosureRequests?.length === 0 && filteredCascadeRequests?.length === 0 && (
            <div style={{ padding: '16px 12px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'monospace' }}>No results</div>
          )}
        </div>
      ) : <>

        {/* ── Browse Requirements ── */}
        {onBrowseRequirements && <div style={{ padding: '4px 12px 8px', flexShrink: 0 }}>
          <button onClick={onBrowseRequirements}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            style={{ width: '100%', padding: '6px 10px', fontSize: 10, fontFamily: 'monospace', fontWeight: 600, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'border-color .2s' }}>Browse Requirements</button>
        </div>}

        {/* ── MY ASSETS ── */}
        <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700 }}>MY ASSETS</span>
          <span style={{ fontSize: 9, background: 'var(--border)', color: 'var(--text-tertiary)', padding: '1px 5px', borderRadius: 8, fontFamily: 'monospace' }}>{totalAssets}</span>
        </div>

        {flatAssets.map(({ cd, node }) => {
          const tk = TT[node.type] || TT.component;
          const dot = healthDot(node.rawAttestations || node.attestations || []);
          return <div key={`${cd.verticalKey}-${node.id}`}
            onClick={() => onSidebarAssetSelect?.(cd.verticalKey, cd.supplierNode.id, node.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', cursor: 'pointer', minWidth: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <NodeIcon type={node.type} size={11} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tk.label}</div>
            </div>
            {node.evaluations?.length > 0 && <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-bg)', padding: '1px 4px', borderRadius: 2, flexShrink: 0 }}>POE</span>}
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }}
              onMouseEnter={e => { const t = dot === 'var(--accent-red)' ? 'Critical: Expired or contested claims' : dot === 'var(--accent-amber)' ? 'Warning: Claims need attention' : dot === 'var(--accent-green)' ? 'Healthy: All claims verified' : null; if (t) setDotTip({ text: t, x: e.clientX, y: e.clientY }); }}
              onMouseMove={e => setDotTip(p => p ? { ...p, x: e.clientX, y: e.clientY } : p)}
              onMouseLeave={() => setDotTip(null)} />
          </div>;
        })}

        {/* ── BUYERS ── */}
        {buyers.length > 0 && <div style={{ marginTop: 16 }}>
          <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700 }}>BUYERS</span>
            <span style={{ fontSize: 9, background: 'var(--border)', color: 'var(--text-tertiary)', padding: '1px 5px', borderRadius: 8, fontFamily: 'monospace' }}>{buyers.length}</span>
          </div>
          {buyers.map(b => <BuyerRow key={b.name} name={b.name} assetCount={b.assetCount} sdaCounts={b.sdaCounts}
            onClick={() => { if (onGraphPanToBuyer) onGraphPanToBuyer(`buyer-${b.name}`); }} />)}
        </div>}

        {/* ── INVITATIONS ── */}
        {(() => {
          const pending = (invitations||[]).filter(i => i.status === 'pending');
          const accepted = (invitations||[]).filter(i => i.status === 'accepted');
          return <div style={{ marginTop: 16 }}>
            <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700 }}>INVITATIONS</span>
              {pending.length > 0 && <span style={{ fontSize: 9, background: 'var(--accent-amber-bg)', color: 'var(--accent-amber)', padding: '1px 5px', borderRadius: 8, fontFamily: 'monospace', fontWeight: 700 }}>{pending.length}</span>}
            </div>
            {/* Pending */}
            {pending.length === 0
              ? <div style={{ padding: '4px 12px 6px', fontSize: 11, color: 'var(--border-hover)', fontStyle: 'italic', fontFamily: 'monospace' }}>No pending invitations</div>
              : pending.map(inv => <InvitationRow key={inv.id} inv={inv} onClick={() => onOpenInvitation(inv.id)} />)
            }
            {/* Accepted */}
            {accepted.length > 0 && <>
              <div style={{ padding: '8px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>ACCEPTED</div>
              {accepted.map(inv => (
                <div key={inv.id} onClick={() => onOpenInvitation(inv.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 12px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{inv.customer} · {inv.asset}</span>
                  </div>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-green)', flexShrink: 0 }}>ACCEPTED</span>
                </div>
              ))}
            </>}
          </div>;
        })()}

        {/* ── DISCLOSURE REQUESTS ── */}
        {(disclosureRequests||[]).length > 0 && (() => {
          const pending = (disclosureRequests||[]).filter(r => r.status === 'pending');
          const approved = (disclosureRequests||[]).filter(r => r.status === 'approved');
          const declined = (disclosureRequests||[]).filter(r => r.status === 'declined');
          return <div style={{ marginTop: 16 }}>
            <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700 }}>DISCLOSURE REQUESTS</span>
              {pendingDreqCount > 0 && <span style={{ fontSize: 9, background: 'var(--accent-indigo-bg)', color: 'var(--accent-purple-light)', padding: '1px 5px', borderRadius: 8, fontFamily: 'monospace', fontWeight: 700 }}>{pendingDreqCount}</span>}
            </div>
            {/* Pending */}
            {pending.length === 0
              ? <div style={{ padding: '4px 12px 6px', fontSize: 11, color: 'var(--border-hover)', fontStyle: 'italic', fontFamily: 'monospace' }}>No pending requests</div>
              : pending.map(r => <DisclosureRequestRow key={r.id} req={r} />)
            }
            {/* Approved */}
            {approved.length > 0 && <>
              <div style={{ padding: '8px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>APPROVED</div>
              {approved.map(r => <DisclosureRequestRow key={r.id} req={r} />)}
            </>}
            {/* Declined */}
            {declined.length > 0 && <>
              <div style={{ padding: '8px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>DECLINED</div>
              {declined.map(r => <DisclosureRequestRow key={r.id} req={r} />)}
            </>}
          </div>;
        })()}

        {/* ── CASCADE REQUESTS ── */}
        {(cascadeRequests||[]).length > 0 && (() => {
          const pending = (cascadeRequests||[]).filter(r => r.status === 'pending');
          const accepted = (cascadeRequests||[]).filter(r => r.status === 'accepted');
          const declined = (cascadeRequests||[]).filter(r => r.status === 'declined');
          return <div style={{ marginTop: 16 }}>
            <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700 }}>CASCADE REQUESTS</span>
              {pendingCascCount > 0 && <span style={{ fontSize: 9, background: 'color-mix(in srgb, var(--accent-sda-cascade) 15%, transparent)', color: 'var(--accent-sda-cascade)', padding: '1px 5px', borderRadius: 8, fontFamily: 'monospace', fontWeight: 700 }}>{pendingCascCount}</span>}
            </div>
            {pending.length === 0
              ? <div style={{ padding: '4px 12px 6px', fontSize: 11, color: 'var(--border-hover)', fontStyle: 'italic', fontFamily: 'monospace' }}>No pending cascade requests</div>
              : pending.map(cr => <div key={cr.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-sda-cascade)', flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cr.requesterNodeName}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cascade request from buyer</div>
                  </div>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-sda-cascade) 8%, transparent)', color: 'var(--accent-sda-cascade)', border: '1px solid color-mix(in srgb, var(--accent-sda-cascade) 20%, transparent)', flexShrink: 0, marginTop: 2 }}>PENDING</span>
                </div>)
            }
            {accepted.length > 0 && <>
              <div style={{ padding: '8px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>ACCEPTED</div>
              {accepted.map(cr => <div key={cr.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px', opacity: 0.7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cr.requesterNodeName}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cr.upstreamAssetName} · {cr.cascadePolicy}</div>
                </div>
                <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-green)', flexShrink: 0, marginTop: 2 }}>ACCEPTED</span>
              </div>)}
            </>}
            {declined.length > 0 && <>
              <div style={{ padding: '8px 12px 2px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>DECLINED</div>
              {declined.map(cr => <div key={cr.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px', opacity: 0.5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cr.requesterNodeName}</div>
                </div>
                <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>DECLINED</span>
              </div>)}
            </>}
          </div>;
        })()}

        {/* ── MY UPSTREAM SUPPLIERS ── */}
        <div style={{ marginTop: 16, paddingBottom: 20 }}>
          <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700 }}>MY UPSTREAM SUPPLIERS</span>
          </div>
          <div style={{ padding: '6px 12px 8px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No upstream suppliers registered yet
          </div>
        </div>

      </>}
    </div>}

    {dotTip && <div style={{
      position: 'fixed', left: dotTip.x + 10, top: dotTip.y - 28, zIndex: 200,
      background: 'var(--border)', border: '1px solid var(--border-hover)', borderRadius: 4,
      padding: '3px 8px', fontSize: 10, color: 'var(--text-primary)', whiteSpace: 'nowrap', pointerEvents: 'none',
    }}>{dotTip.text}</div>}
  </div>;
}
