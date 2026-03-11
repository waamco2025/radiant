import { useState, useCallback } from 'react';

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13, height: 40,
  background: 'var(--bg-app-header)', border: '1px solid var(--border)', borderRadius: 5,
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  fontFamily: "var(--font-display)",
};
const labelStyle = { fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', letterSpacing: '.06em', marginBottom: 4, fontWeight: 700 };

/* ═══ Inline invite panel — fills parent container ═══ */
export function InviteSupplierPanel({ node, requirements, onInvite, onClose, onCascade }) {
  const [mode, setMode] = useState('direct'); // direct | cascade
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [assetName, setAssetName] = useState('');
  const [checked, setChecked] = useState(() => new Set());
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | sending | done
  const [cascadeMessage, setCascadeMessage] = useState('');
  const [cascadePhase, setCascadePhase] = useState('idle'); // idle | sending | done

  const toggleReq = useCallback(r => {
    setChecked(prev => {
      const ns = new Set(prev);
      if (ns.has(r)) ns.delete(r); else ns.add(r);
      return ns;
    });
  }, []);

  const canSend = company.trim() && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && (!requirements?.length || checked.size > 0);

  const handleSend = useCallback(() => {
    if (!canSend || phase !== 'idle') return;
    setPhase('sending');
    setTimeout(() => {
      setPhase('done');
      const details = { company: company.trim(), email: email.trim(), contact: contact.trim(), assetName: assetName.trim(), timestamp: new Date().toISOString() };
      if (onInvite) onInvite(node.id, details);
      setTimeout(() => { if (onClose) onClose(); }, 1200);
    }, 1500);
  }, [canSend, phase, node, onInvite, onClose, company, email, contact, assetName]);

  const handleCascadeSend = useCallback(() => {
    if (!onCascade || cascadePhase !== 'idle') return;
    setCascadePhase('sending');
    setTimeout(() => {
      setCascadePhase('done');
      onCascade(node.id, cascadeMessage.trim());
      setTimeout(() => { if (onClose) onClose(); }, 1200);
    }, 1500);
  }, [onCascade, node, cascadeMessage, cascadePhase, onClose]);

  return <>
    {/* Mode tab bar */}
    <div style={{ display: 'flex', gap: 1, marginBottom: 12, background: 'var(--bg-surface)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <button onClick={() => setMode('direct')} style={{ flex: 1, padding: '6px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === 'direct' ? 'var(--border)' : 'transparent', color: mode === 'direct' ? 'var(--text-primary)' : 'var(--text-muted)' }}>Direct Invite</button>
      <button onClick={() => setMode('cascade')} style={{ flex: 1, padding: '6px 0', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === 'cascade' ? 'var(--border)' : 'transparent', color: mode === 'cascade' ? 'var(--accent-sda-cascade)' : 'var(--text-muted)' }}>Request Cascade</button>
    </div>

    {mode === 'cascade' ? <>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-sda-cascade)', marginBottom: 6 }}>Request Cascade Disclosure</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5 }}>
        Ask the supplier of <span style={{ color: 'var(--text-primary)' }}>{node?.name}</span> to propagate visibility upstream, creating tier-2+ nodes in your network.
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>MESSAGE (OPTIONAL)</div>
        <textarea value={cascadeMessage} onChange={e => setCascadeMessage(e.target.value)} placeholder="Describe what upstream visibility you need..." disabled={cascadePhase !== 'idle'} className="dim-ph" rows={4} style={{ ...inputStyle, height: 'auto', resize: 'vertical', minHeight: 80, fontFamily: 'var(--font-display)' }} />
      </div>
      {cascadePhase === 'idle' && <button onClick={handleCascadeSend} disabled={!onCascade}
        onMouseEnter={e => { if (onCascade) { e.currentTarget.style.borderColor = 'var(--accent-sda-cascade)'; e.currentTarget.style.background = 'var(--bg-card)'; } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = onCascade ? 'color-mix(in srgb, var(--accent-sda-cascade) 33%, transparent)' : 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
        style={{ width: '100%', height: 40, padding: 0, background: 'var(--bg-surface)', border: `1px solid ${onCascade ? 'color-mix(in srgb, var(--accent-sda-cascade) 33%, transparent)' : 'var(--border)'}`, borderRadius: 6, color: onCascade ? 'var(--accent-sda-cascade)' : 'var(--text-muted)', cursor: onCascade ? 'pointer' : 'default', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s', opacity: onCascade ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Send Cascade Request</button>}
      {cascadePhase === 'sending' && <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
        <div style={{ width: 14, height: 14, border: '2px solid var(--accent-sda-cascade)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'pspin 1s linear infinite' }} />
        <span style={{ fontSize: 11, color: 'var(--accent-sda-cascade)', fontFamily: 'monospace', fontWeight: 600 }}>Sending...</span>
      </div>}
      {cascadePhase === 'done' && <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'color-mix(in srgb, var(--accent-sda-cascade) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-sda-cascade) 20%, transparent)', borderRadius: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--accent-sda-cascade)' }}>✓</span>
        <span style={{ fontSize: 11, color: 'var(--accent-sda-cascade)', fontFamily: 'monospace', fontWeight: 600 }}>Cascade Request Sent</span>
      </div>}
    </> : <>
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 12 }}>Invite Upstream Supplier</div>

    {/* Supplier info inputs */}
    <div style={{ marginBottom: 16 }}>
      <div style={labelStyle}>SUPPLIER DETAILS</div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Company Name *</div>
        <input value={company} onChange={e => setCompany(e.target.value)}
          placeholder="Acme Industries" disabled={phase !== 'idle'} className="dim-ph" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Contact Email *</div>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email"
          placeholder="procurement@example.com" disabled={phase !== 'idle'} className="dim-ph" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Contact Name</div>
        <input value={contact} onChange={e => setContact(e.target.value)}
          placeholder="J. Smith" disabled={phase !== 'idle'} className="dim-ph" style={inputStyle} />
      </div>

      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Expected Asset Name (optional)</div>
        <input value={assetName} onChange={e => setAssetName(e.target.value)}
          placeholder="e.g. Ti-6Al-4V Bar Stock" disabled={phase !== 'idle'} className="dim-ph" style={inputStyle} />
      </div>
    </div>

    {/* Requirements checklist */}
    {requirements && requirements.length > 0 && <div style={{ marginBottom: 16 }}>
      <div style={labelStyle}>REQUIRED ATTESTATIONS</div>
      <div style={{ background: 'var(--bg-app-header)', borderRadius: 6, padding: '8px 10px', border: '1px solid var(--border)44' }}>
        {requirements.map(r => {
          const on = checked.has(r);
          return <div key={r} onClick={() => { if (phase === 'idle') toggleReq(r); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: phase === 'idle' ? 'pointer' : 'default', borderRadius: 4 }}
            onMouseEnter={e => { if (phase === 'idle') e.currentTarget.style.background = 'var(--bg-surface)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{
              width: 16, height: 16, borderRadius: 3, flexShrink: 0,
              border: `1px solid ${on ? 'var(--accent-indigo)' : 'var(--border)'}`,
              background: on ? 'var(--accent-indigo-bg)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: 'var(--accent-indigo-light)', transition: 'all .15s',
            }}>{on ? '✓' : ''}</div>
            <span style={{ fontSize: 11, color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{r}</span>
          </div>;
        })}
      </div>
    </div>}

    {/* Message */}
    <div style={{ marginBottom: 16 }}>
      <div style={labelStyle}>MESSAGE (OPTIONAL)</div>
      <textarea value={message} onChange={e => setMessage(e.target.value)}
        placeholder="Add a note to the supplier..."
        disabled={phase !== 'idle'}
        className="dim-ph"
        rows={3}
        style={{
          ...inputStyle, height: 'auto', resize: 'vertical', minHeight: 60,
          fontFamily: "var(--font-display)",
        }} />
    </div>

    {/* Send button */}
    {phase === 'idle' && <button onClick={handleSend}
      onMouseEnter={e => { if (canSend) { e.currentTarget.style.borderColor = 'var(--accent-sda-full)'; e.currentTarget.style.background = 'var(--bg-card)'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = canSend ? 'color-mix(in srgb, var(--accent-sda-full) 33%, transparent)' : 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
      style={{
        width: '100%', height: 40, padding: 0,
        background: 'var(--bg-surface)', border: `1px solid ${canSend ? 'color-mix(in srgb, var(--accent-sda-full) 33%, transparent)' : 'var(--border)'}`, borderRadius: 6,
        color: canSend ? 'var(--accent-sda-full)' : 'var(--text-muted)', cursor: canSend ? 'pointer' : 'default',
        fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
        transition: 'border-color .2s, background .2s',
        opacity: canSend ? 1 : 0.5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>Send Invitation</button>}

    {phase === 'sending' && <div style={{
      height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6,
    }}>
      <div style={{ width: 14, height: 14, border: '2px solid var(--accent-sda-full)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'pspin 1s linear infinite' }} />
      <span style={{ fontSize: 11, color: 'var(--accent-sda-full)', fontFamily: 'monospace', fontWeight: 600 }}>Sending...</span>
    </div>}

    {phase === 'done' && <div style={{
      height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      background: 'var(--accent-green-bg)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', borderRadius: 6,
    }}>
      <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>✓</span>
      <span style={{ fontSize: 11, color: 'var(--accent-green)', fontFamily: 'monospace', fontWeight: 600 }}>Invitation Sent</span>
    </div>}
    </>}
  </>;
}

/* ═══ Legacy modal export (kept for backward compat) ═══ */
export default function InviteSupplierModal({ node, requirements, onInvite, onClose }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
    <div style={{ position: 'relative', width: 420, maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,.6)', animation: 'pfade .2s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>Invite Upstream Supplier</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>for {node?.name || 'Unknown Node'}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
      </div>
      <InviteSupplierPanel node={node} requirements={requirements} onInvite={onInvite} onClose={onClose} />
    </div>
  </div>;
}
