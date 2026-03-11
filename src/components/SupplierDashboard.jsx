import { TT } from '../data/tokens';
import SupplierNetGraph from './SupplierNetGraph';

const VERTICAL_LABELS = {
  aerospace: 'AEROSPACE',
  govco: 'GOV / SATELLITE',
  healthcare: 'HEALTHCARE',
  microco: 'MICROELECTRONICS',
  autoco: 'AUTOMOTIVE',
};

const REF_T = new Date('2026-02-17').getTime();

/* ── Per-node attestation health ── */
function nodeHealth(node) {
  const raw = node?.rawAttestations || [];
  let verified = 0, expiring = 0, contested = 0;
  for (const a of raw) {
    if (a.status === 'verified') {
      if (a.validUntil) {
        const d = (new Date(a.validUntil).getTime() - REF_T) / 86400000;
        if (d > 0 && d <= 30) { expiring++; continue; }
      }
      verified++;
    } else if (a.status === 'contested' || a.status === 'revoked') {
      contested++;
    }
  }
  return { total: raw.length, verified, expiring, contested };
}

/* ── Last activity date for a node ── */
function lastActivity(node) {
  const raw = node?.rawAttestations || [];
  const ts = raw.map(a => a.timestamp).filter(Boolean).sort();
  if (!ts.length) return '\u2014';
  return new Date(ts[ts.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Compact chain box ── */
function ChainBox({ node, label, borderColor, isPlaceholder }) {
  const displayName = isPlaceholder ? label : (node?.name || label || '\u2014');
  const truncated = displayName.length > 13 ? displayName.slice(0, 11) + '\u2026' : displayName;
  const tk = !isPlaceholder && node ? (TT[node.type] || TT.component) : null;
  return <div style={{
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 8px',
    background: 'var(--bg-deep)',
    border: `1px solid ${borderColor}`,
    borderRadius: 5,
    flex: 1, minWidth: 0, maxWidth: 108,
  }}>
    {tk && <div style={{ width: 5, height: 5, borderRadius: '50%', background: tk.border, flexShrink: 0 }} />}
    <div style={{ fontSize: 9, color: isPlaceholder ? 'var(--border-hover)' : 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: isPlaceholder ? 'italic' : 'normal' }}>
      {truncated}
    </div>
  </div>;
}

/* ── Health dot + count ── */
function HealthPill({ count, color, label }) {
  if (!count) return null;
  return <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{count} {label}</span>
  </span>;
}

/* ── Asset Card ── */
function AssetCard({ asset, verticalKey, onOpenChain }) {
  const { node, downstream, upstream } = asset;
  const tk = TT[node.type] || TT.component;
  const health = nodeHealth(node);
  const date = lastActivity(node);

  return <div
    onClick={() => onOpenChain(verticalKey, node.id)}
    style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16,
      cursor: 'pointer', transition: 'border-color .18s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
  >
    {/* Top row: left / center / right */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

      {/* Left — name + type + part number */}
      <div style={{ flex: '1 1 140px', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</div>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 2 }}>{tk.label}</div>
        {node.partNumber && <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>P/N {node.partNumber}</div>}
      </div>

      {/* Center — mini-chain */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <ChainBox node={downstream} borderColor="var(--accent-indigo)" />
        <span style={{ fontSize: 10, color: 'var(--border-hover)', flexShrink: 0 }}>\u2192</span>
        <ChainBox node={node} borderColor="var(--accent-cyan)" />
        <span style={{ fontSize: 10, color: 'var(--border-hover)', flexShrink: 0 }}>\u2192</span>
        {upstream
          ? <ChainBox node={upstream} borderColor="var(--border-hover)" />
          : <ChainBox isPlaceholder label="No upstream" borderColor="var(--border)" />
        }
      </div>

      {/* Right — health + view chain */}
      <div style={{ flex: '0 0 120px', textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 4 }}>{health.total} claims</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <HealthPill count={health.verified} color="var(--accent-green)" label="verified" />
          <HealthPill count={health.expiring} color="var(--accent-amber)" label="expiring" />
          <HealthPill count={health.contested} color="var(--accent-red)" label="contested" />
        </div>
        <div style={{ marginTop: 6 }}>
          <span
            onClick={e => { e.stopPropagation(); onOpenChain(verticalKey, node.id); }}
            style={{ fontSize: 11, color: 'var(--accent-indigo)', cursor: 'pointer' }}
          >View Chain \u2192</span>
        </div>
      </div>
    </div>

    {/* Bottom — last activity */}
    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
      Last activity: {date}
    </div>
  </div>;
}

/* ── Customer Group ── */
function CustomerGroup({ entry, onOpenCustomerChain }) {
  const { verticalKey, customerName, assets } = entry;
  if (!assets || assets.length === 0) return null;

  return <div style={{ marginBottom: 32 }}>
    {/* Customer header */}
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 12,
    }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-bright)' }}>{customerName}</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.04em' }}>{VERTICAL_LABELS[verticalKey] || verticalKey.toUpperCase()}</span>
    </div>

    {/* Asset cards */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {assets.map(asset => (
        <AssetCard key={asset.node.id} asset={asset} verticalKey={verticalKey} onOpenChain={onOpenCustomerChain} />
      ))}
    </div>
  </div>;
}

/* ── Supplier Dashboard ── */
export default function SupplierDashboard({ persona, customerData, onOpenCustomerChain, graphPanTo, activeView, onActiveViewChange, onNodeSelect, selectedNodeId }) {
  const hasAssets = (customerData || []).some(cd => cd.assets && cd.assets.length > 0);

  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

    {/* ── Top bar: view toggle + actions ── */}
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-app-header)' }}>
      {/* View toggle pills */}
      <div style={{ display: 'flex', gap: 1, background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {[{ id: 'graph', label: 'Network Graph' }, { id: 'list', label: 'Dashboard' }].map(tab => (
          <button key={tab.id} onClick={() => onActiveViewChange?.(tab.id)} style={{
            padding: '6px 14px', fontSize: 11, fontFamily: 'monospace', border: 'none', cursor: 'pointer',
            background: activeView === tab.id ? 'var(--border)' : 'transparent',
            color: activeView === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
            transition: 'background .15s, color .15s',
          }}>{tab.label}</button>
        ))}
      </div>

    </div>

    {/* ── View body ── */}
    {activeView === 'graph'
      ? <SupplierNetGraph
          persona={persona}
          customerData={customerData}
          onNodeSelect={onNodeSelect}
          onNodeDblClick={onOpenCustomerChain}
          panToRequest={graphPanTo}
          selectedNodeId={selectedNodeId}
        />
      : <div style={{ flex: 1, overflow: 'auto', padding: '40px 48px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* Supplier identity */}
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-bright)' }}>{persona.org}</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{persona.title} \u00b7 {persona.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{persona.location}</div>
            <div style={{ height: 1, background: 'var(--border)', margin: '24px 0' }} />

            {/* MY ASSETS section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700 }}>MY ASSETS</div>
            </div>

            {!hasAssets && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No customer networks yet.</div>
            )}

            {(customerData || []).map(entry => (
              <CustomerGroup key={entry.verticalKey} entry={entry} onOpenCustomerChain={onOpenCustomerChain} />
            ))}
          </div>
        </div>
    }
  </div>;
}
