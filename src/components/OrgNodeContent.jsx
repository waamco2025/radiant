import { LOG_COLORS } from './detailPanelUtils';

export default function OrgNodeContent({ node, isSupplier, isSupplierOrg, activityLog, disclosureRequests, onApproveDisclosureRequest, onDeclineDisclosureRequest, decliningReqId, setDecliningReqId, declineReason, setDeclineReason }) {
  return <>
    {/* ── Buyer disclosure summary ── */}
    {node.disclosureSummary && (() => {
      const ds = node.disclosureSummary;
      const SDA_BADGE = [['full', 'var(--accent-sda-full)', 'Full'], ['selective', 'var(--accent-amber)', 'Selective'], ['derivative', 'var(--accent-green)', 'Derivative'], ['cascade', 'var(--accent-sda-cascade)', 'Cascade']];
      return <div style={{ marginBottom: 12, marginTop: 4 }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.06em', marginBottom: 8 }}>DISCLOSURES TO THIS BUYER</div>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 8 }}>{ds.totalAssets} asset{ds.totalAssets !== 1 ? 's' : ''} disclosed</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {SDA_BADGE.map(([key, color, label]) => ds.sdaTypes[key] > 0 && <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 3, background: `color-mix(in srgb, ${color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`, color }}>{label} ({ds.sdaTypes[key]})</span>)}
        </div>
        {ds.assets.map((a, i) => {
          const sdaColor = a.sdaType === 'full' ? 'var(--accent-sda-full)' : a.sdaType === 'selective' ? 'var(--accent-amber)' : a.sdaType === 'derivative' ? 'var(--accent-green)' : a.sdaType === 'cascade' ? 'var(--accent-sda-cascade)' : 'var(--text-muted)';
          return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)22' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sdaColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{a.type}</div>
            </div>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: sdaColor, textTransform: 'uppercase', flexShrink: 0 }}>{a.sdaType || '\u2014'}</span>
          </div>;
        })}
      </div>;
    })()}

    {/* ── Supplier network summary ── */}
    {node.networkSummary && (() => {
      const ns = node.networkSummary;
      const SDA_BADGE = [['full', 'var(--accent-sda-full)', 'Full'], ['selective', 'var(--accent-amber)', 'Selective'], ['derivative', 'var(--accent-green)', 'Derivative'], ['cascade', 'var(--accent-sda-cascade)', 'Cascade']];
      return <div style={{ marginBottom: 12, marginTop: 4 }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.06em', marginBottom: 8 }}>MY NETWORK</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>Assets: {ns.totalAssets} registered</div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>Buyers: {ns.totalBuyers} organization{ns.totalBuyers !== 1 ? 's' : ''}</div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>Active Disclosures: {ns.activeDisclosures}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SDA_BADGE.map(([key, color, label]) => ns.sdaTypes[key] > 0 && <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 3, background: `color-mix(in srgb, ${color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`, color }}>{label} ({ns.sdaTypes[key]})</span>)}
        </div>
      </div>;
    })()}

    {/* ── Disclosure Requests (supplier self-org node) ── */}
    {isSupplier && node.networkSummary && (() => {
      const reqs = (disclosureRequests || []).filter(r => r.status !== 'declined');
      if (reqs.length === 0) return null;
      const pendingCount = reqs.filter(r => r.status === 'pending').length;
      const typeColor = t => t === 'full' ? 'var(--accent-sda-full)' : t === 'selective' ? 'var(--accent-amber)' : t === 'derivative' ? 'var(--accent-green)' : t === 'cascade' ? 'var(--accent-sda-cascade)' : 'var(--accent-indigo)';
      const statusColor = s => s === 'approved' ? 'var(--accent-green)' : s === 'declined' ? 'var(--accent-red)' : 'var(--accent-purple-light)';
      return <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--border-hover)', letterSpacing: '.06em' }}>DISCLOSURE REQUESTS ({reqs.length})</span>
          {pendingCount > 0 && <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-purple-light)', background: 'color-mix(in srgb, var(--accent-purple-light) 9%, transparent)', padding: '1px 5px', borderRadius: 8 }}>{pendingCount} pending</span>}
        </div>
        {reqs.map(r => {
          const isDeclining = decliningReqId === r.id;
          const tc = typeColor(r.requestedType);
          const sc = statusColor(r.status);
          return <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg-deep)', border: `1px solid color-mix(in srgb, ${sc} 13%, transparent)`, borderRadius: 6, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.requestedBy || 'Buyer'}</span>
              <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: `color-mix(in srgb, ${tc} 8%, transparent)`, color: tc, border: `1px solid color-mix(in srgb, ${tc} 20%, transparent)` }}>{r.requestedType}</span>
              {r.status !== 'pending' && <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: sc, textTransform: 'uppercase' }}>{r.status}</span>}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>{r.assetName}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>Requested {r.requestedAt?.slice(0, 10)}</div>

            {r.status === 'pending' && !isDeclining && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => { if (onApproveDisclosureRequest) onApproveDisclosureRequest(r.id); }}
                style={{ flex: 2, height: 28, background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 27%, transparent)', borderRadius: 4, color: 'var(--accent-green)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green) 15%, transparent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-green) 8%, transparent)'; }}
              >Approve & Create SDA</button>
              <button onClick={() => { setDecliningReqId(r.id); setDeclineReason(''); }}
                style={{ flex: 1, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}>Decline</button>
            </div>}

            {r.status === 'pending' && isDeclining && <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 3 }}>Decline reason (optional)</div>
              <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={2} placeholder="Reason for declining..."
                style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => { setDecliningReqId(null); setDeclineReason(''); }}
                  style={{ flex: 1, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => { if (onDeclineDisclosureRequest) onDeclineDisclosureRequest(r.id, declineReason); setDecliningReqId(null); setDeclineReason(''); }}
                  style={{ flex: 2, height: 28, background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 27%, transparent)', borderRadius: 4, color: 'var(--accent-red)', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}>Confirm Decline</button>
              </div>
            </div>}

            {r.status === 'approved' && <div style={{ marginTop: 6, fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace' }}>
              ✓ SDA created · Node added to buyer network
            </div>}

            {r.status === 'declined' && <div style={{ marginTop: 6 }}>
              {r.declineReason ? <div style={{ fontSize: 9, color: 'var(--accent-red)', fontFamily: 'monospace' }}>Reason: {r.declineReason}</div>
                : <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', fontStyle: 'italic' }}>No reason provided</div>}
            </div>}
          </div>;
        })}
      </div>;
    })()}

    {/* ── Activity Log (org nodes) ── */}
    {(node.type === 'customer' || isSupplierOrg) && (() => {
      const filterRole = isSupplier ? 'supplier' : 'buyer';
      const logEntries = (activityLog || []).filter(e => e.actorRole === filterRole);
      return <div style={{ marginBottom: 12, marginTop: 4 }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--border-hover)', letterSpacing: '.06em', marginBottom: 6 }}>
          ACTIVITY LOG{logEntries.length > 0 ? ` (${logEntries.length})` : ''}
        </div>
        <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          {logEntries.length === 0
            ? <div style={{ fontSize: 10, color: 'var(--border-hover)', fontFamily: 'monospace', fontStyle: 'italic', padding: '6px 0' }}>
                No activity recorded yet
              </div>
            : logEntries.slice(0, 50).map((entry, i) => {
                const dotColor = LOG_COLORS[entry.type] || 'var(--text-muted)';
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(entry.timestamp).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 1) return 'just now';
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  const days = Math.floor(hrs / 24);
                  return `${days}d ago`;
                })();
                return <div key={entry.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0',
                  borderBottom: i < Math.min(logEntries.length, 50) - 1 ? '1px solid var(--border)22' : 'none',
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace', lineHeight: 1.4 }}>
                    {entry.description}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--border-hover)', fontFamily: 'monospace', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo}</div>
                </div>;
              })
          }
        </div>
      </div>;
    })()}
  </>;
}
