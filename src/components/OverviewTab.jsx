import { TT } from '../data/tokens';
import NodeIcon from './NodeIcon';
import { SH, SDA_TYPE_COLORS, SDA_LINE_DASH, SDA_STATUS_COLORS } from './detailPanelUtils';

export default function OverviewTab({ node, sdaList, onRevokeSDA, approvalStates, revokeConfirmSdaId, setRevokeConfirmSdaId, revokeReason, setRevokeReason, onInvite, terminalTypes, setShowInvite, invites, evidenceRequests, onSelect, cascadeRequests, onCreateCascadeRequest }) {
  return <>
    {/* SDA provenance cards */}
    {(() => {
      if (!sdaList.length) return null;
      return <div style={{ marginBottom: 12, marginTop: 4 }}>
        {sdaList.length > 1 && <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--border-hover)', letterSpacing: '.06em', marginBottom: 6 }}>DISCLOSURE AGREEMENTS ({sdaList.length})</div>}
        {sdaList.map((sda, idx) => {
          const tc = SDA_TYPE_COLORS[sda.type] || 'var(--text-muted)';
          const sc = SDA_STATUS_COLORS[sda.status] || 'var(--text-tertiary)';
          const dash = SDA_LINE_DASH[sda.type] || 'none';
          return <div key={sda.id || idx} style={{ padding: '10px 12px', background: 'var(--bg-deep)', border: `1px solid color-mix(in srgb, ${tc} 20%, transparent)`, borderRadius: 6, marginBottom: idx < sdaList.length - 1 ? 6 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '.06em' }}>DISCLOSURE AGREEMENT</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: tc, textTransform: 'uppercase' }}>{sda.type}</span>
                <span style={{ fontSize: 9, color: sc, fontFamily: 'monospace' }}>● {sda.status}</span>
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-primary)' }}>{sda.discloser}</span>
              <svg width="24" height="8" style={{ flexShrink: 0 }}><line x1="0" y1="4" x2="24" y2="4" stroke={tc} strokeWidth="2" strokeDasharray={dash} /></svg>
              <span style={{ color: 'var(--text-primary)' }}>{sda.receiver}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
              Created {sda.created}{sda.expires ? ` · Expires ${sda.expires}` : ' · No expiry'}
            </div>
            {sda.type === 'selective' && sda.redactedFields?.length > 0 && <div style={{ marginTop: 5, fontSize: 9, color: 'var(--accent-amber)', fontFamily: 'monospace' }}>
              {sda.redactedFields.length} field categor{sda.redactedFields.length === 1 ? 'y' : 'ies'} redacted from this disclosure
            </div>}
            {sda.type === 'derivative' && sda.sourceEvalId && <div style={{ marginTop: 5, fontSize: 9, color: 'var(--accent-green)', fontFamily: 'monospace' }}>
              Eval ref: {sda.sourceEvalId} · Result: {sda.evalResult}
            </div>}
            {onRevokeSDA && approvalStates?.[node.id]?.status === 'approved' && <>
              {revokeConfirmSdaId !== sda.id
                ? <button onClick={(e) => { e.stopPropagation(); setRevokeConfirmSdaId(sda.id); }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    style={{ marginTop: 8, width: '100%', padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                      background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
                      color: 'var(--text-muted)', cursor: 'pointer', transition: 'color .15s, border-color .15s' }}>
                    Revoke Disclosure</button>
                : <div style={{ marginTop: 8, padding: '10px', background: 'var(--accent-red-bg)', border: '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)', borderRadius: 6 }}>
                    <div style={{ fontSize: 9, color: 'var(--accent-red)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 6 }}>CONFIRM REVOCATION</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 6, lineHeight: 1.5 }}>
                      This will permanently remove <span style={{ color: 'var(--text-primary)' }}>{node.name}</span> from your supply network. This action cannot be undone.
                    </div>
                    <textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} rows={2} placeholder="Reason for revocation..."
                      style={{ width: '100%', padding: '6px 8px', fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setRevokeConfirmSdaId(null); setRevokeReason(''); }}
                        style={{ flex: 1, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                      <button disabled={!revokeReason.trim()} onClick={() => { onRevokeSDA(node.id, sda.id, revokeReason); }}
                        style={{ flex: 2, padding: '5px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, background: revokeReason.trim() ? 'color-mix(in srgb, var(--accent-red) 8%, transparent)' : 'var(--bg-surface)', border: `1px solid ${revokeReason.trim() ? 'color-mix(in srgb, var(--accent-red) 27%, transparent)' : 'var(--border)'}`, borderRadius: 4, color: revokeReason.trim() ? 'var(--accent-red)' : 'var(--text-muted)', cursor: revokeReason.trim() ? 'pointer' : 'not-allowed', opacity: revokeReason.trim() ? 1 : 0.5 }}>Confirm Revoke</button>
                    </div>
                  </div>
              }
            </>}
          </div>;
        })}
      </div>;
    })()}

    {/* Invite upstream button */}
    {onInvite && terminalTypes && !terminalTypes.includes(node.type) && <button
      onClick={() => setShowInvite(true)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
      style={{ width: '100%', height: 36, padding: 0, marginBottom: 8, background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--accent-indigo)', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      + Invite Upstream Supplier</button>}

    {/* Request cascade button */}
    {onCreateCascadeRequest && sdaList.length > 0 && terminalTypes && !terminalTypes.includes(node.type) && <button
      onClick={() => onCreateCascadeRequest(node.id, '')}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-sda-cascade)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-sda-cascade) 33%, transparent)'; e.currentTarget.style.background = 'transparent'; }}
      style={{ width: '100%', height: 36, padding: 0, marginBottom: 8, background: 'transparent', border: '1px solid color-mix(in srgb, var(--accent-sda-cascade) 33%, transparent)', borderRadius: 5, color: 'var(--accent-sda-cascade)', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      ↯ Request Cascade</button>}

    {/* Pending cascade requests */}
    {(() => {
      const nodeCasc = (cascadeRequests || []).filter(r => r.requesterNodeId === node.id);
      if (!nodeCasc.length) return null;
      return <div style={{ marginBottom: 10 }}>
        <div style={SH}>CASCADE REQUESTS ({nodeCasc.length})</div>
        {nodeCasc.map(cr => {
          const isPending = cr.status === 'pending';
          const isAccepted = cr.status === 'accepted';
          const dotColor = isPending ? 'var(--accent-sda-cascade)' : isAccepted ? 'var(--accent-green)' : 'var(--text-muted)';
          return <div key={cr.id} style={{ padding: '8px 10px', background: 'var(--bg-deep)', border: `1px solid color-mix(in srgb, var(--accent-sda-cascade) 20%, transparent)`, borderRadius: 5, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: 'var(--text-primary)', fontFamily: 'monospace' }}>Cascade Request</span>
              </div>
              <span style={{ fontSize: 8, color: isPending ? 'var(--accent-sda-cascade)' : isAccepted ? 'var(--accent-green)' : 'var(--text-muted)', fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 700 }}>{cr.status}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
              To: {cr.supplierOrg}
              {isAccepted && cr.upstreamAssetName && <> · Upstream: <span style={{ color: 'var(--text-primary)' }}>{cr.upstreamAssetName}</span> · <span style={{ color: 'var(--accent-sda-cascade)' }}>{cr.cascadePolicy}</span></>}
            </div>
          </div>;
        })}
      </div>;
    })()}

    {/* Pending invitations */}
    {invites.length > 0 && <div style={{ marginBottom: 10 }}>
      <div style={SH}>PENDING INVITATIONS ({invites.length})</div>
      {invites.map((inv, i) => <div key={i} style={{ padding: '6px 8px', background: 'var(--bg-deep)', border: '1px solid var(--border)66', borderRadius: 5, marginBottom: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{inv.supplierName || inv.name || 'Invited'}</span>
        <span style={{ fontSize: 8, color: 'var(--accent-amber)', fontFamily: 'monospace', textTransform: 'uppercase' }}>{inv.status || 'pending'}</span>
      </div>)}
    </div>}

    {/* Evidence summary badges */}
    {(() => {
      const nodeReqs = (evidenceRequests || []).filter(r => r.nodeId === node.id);
      if (!nodeReqs.length) return null;
      const pending = nodeReqs.filter(r => r.status === 'pending').length;
      const submitted = nodeReqs.filter(r => r.status === 'submitted' || r.status === 'resubmitted').length;
      const accepted = nodeReqs.filter(r => r.status === 'accepted').length;
      return <div style={{ marginBottom: 10 }}>
        <div style={SH}>EVIDENCE REQUESTS</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pending > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)', color: 'var(--accent-amber)' }}>{pending} pending</span>}
          {submitted > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-cyan) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-cyan) 20%, transparent)', color: 'var(--accent-cyan)' }}>{submitted} submitted</span>}
          {accepted > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', color: 'var(--accent-green)' }}>{accepted} accepted</span>}
        </div>
      </div>;
    })()}

    {/* Inputs (buyer overview) */}
    {node.children?.length > 0 && <div style={{ marginTop: 14, marginBottom: 14 }}>
      <div style={SH}>INPUTS ({node.children.length})</div>
      {node.children.map(c => <div key={c.id}
        onClick={() => { if (onSelect) onSelect(c); }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        style={{ fontSize: 11, padding: '4px 6px', marginBottom: 1, color: TT[c.type]?.text || 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, cursor: onSelect ? 'pointer' : 'default', borderRadius: 4, transition: 'background .1s' }}>
        <NodeIcon type={c.type} size={11} />{c.name}
      </div>)}
    </div>}
  </>;
}
