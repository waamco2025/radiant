import { useState, useCallback } from 'react';

/* ═══ Status visual encoding ═══ */
const ST = {
  verified:  { c: 'var(--accent-green)', bg: 'var(--accent-green-bg)', border: 'var(--accent-green)', label: 'VERIFIED',  icon: '✓' },
  expired:   { c: 'var(--accent-amber)', bg: 'var(--accent-amber-bg)', border: 'var(--accent-amber)', label: 'EXPIRED',   icon: '⧖' },
  contested: { c: 'var(--accent-red)', bg: 'var(--accent-red-bg)', border: 'var(--accent-red)', label: 'CONTESTED', icon: '⚡' },
  revoked:   { c: 'var(--accent-red-bg)', bg: 'var(--accent-red-bg)', border: 'var(--accent-red-bg)', label: 'REVOKED',   icon: '✕' },
  pending:   { c: 'var(--accent-amber)', bg: 'var(--accent-amber-bg)', border: 'var(--accent-amber)', label: 'PENDING',   icon: '…' },
};

const REF = new Date('2026-02-17');
const MS_DAY = 86400000;

/* ═══ Helpers ═══ */
const fmtPredicate = s => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const fmtDate = iso => iso ? iso.split('T')[0] : '';
const truncHash = (h, n = 8) => h && h.length > n ? h.slice(0, n) + '\u2026' : h || '';

function timeInfo(att) {
  if (!att.validUntil) return { label: null, color: 'var(--text-muted)' };
  const exp = new Date(att.validUntil);
  const diff = (exp - REF) / MS_DAY;
  if (diff <= 0) return { label: `Expired ${fmtDate(att.validUntil)}`, color: 'var(--accent-amber)' };
  if (diff <= 30) return { label: `Expires ${fmtDate(att.validUntil)}`, color: 'var(--accent-amber)', warn: true };
  return { label: `Valid until ${fmtDate(att.validUntil)}`, color: 'var(--text-muted)' };
}

/* ═══ Copy button ═══ */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(e => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, [text]);
  return <span onClick={copy}
    style={{ cursor: 'pointer', fontSize: 10, color: copied ? 'var(--accent-green)' : 'var(--text-muted)', marginLeft: 4, userSelect: 'none', transition: 'color .2s' }}
    title="Copy to clipboard">{copied ? '✓' : '⎘'}</span>;
}

/* ═══ Compact variant (~72px) ═══
 * Shows: status border, predicate headline, actor, time, status badge
 */
function Compact({ att, onClick }) {
  const s = ST[att.status] || ST.pending;
  const ti = timeInfo(att);
  return <div onClick={onClick}
    style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '10px 12px', cursor: onClick ? 'pointer' : 'default', transition: 'background .15s' }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}>
    {/* Row 1: predicate + status badge */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>{fmtPredicate(att.predicate)}</div>
      <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: s.c, background: `${s.bg}`, padding: '2px 6px', borderRadius: 3, letterSpacing: '.04em', border: `1px solid color-mix(in srgb, ${s.border} 20%, transparent)` }}>{s.icon} {s.label}</span>
    </div>
    {/* Row 2: actor */}
    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {att.actor.name}<span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', marginLeft: 6, fontSize: 9 }}>{att.actor.id}</span>
    </div>
    {/* Signatory */}
    {att.signatory && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.signatory.name} · {att.signatory.title}</div>}
    {/* Row 3: time */}
    {ti.label && <div style={{ fontSize: 9, color: ti.color, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
      {ti.warn && <span style={{ color: 'var(--accent-amber)' }}>⚠</span>}{ti.label}
    </div>}
    {!ti.label && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{fmtDate(att.timestamp)}</div>}
  </div>;
}

/* ═══ Expanded variant (~160px) ═══
 * Shows all 7 fields: status, actor, predicate, subject, time, evidence, signature
 */
function Expanded({ att, onClick, onEvidenceClick }) {
  const s = ST[att.status] || ST.pending;
  const ti = timeInfo(att);
  return <div onClick={onClick}
    style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '12px 14px', cursor: onClick ? 'pointer' : 'default', transition: 'background .15s' }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}>
    {/* Row 1: predicate + status badge */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)' }}>{fmtPredicate(att.predicate)}</div>
      <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: s.c, background: `${s.bg}`, padding: '2px 6px', borderRadius: 3, letterSpacing: '.04em', border: `1px solid color-mix(in srgb, ${s.border} 20%, transparent)` }}>{s.icon} {s.label}</span>
    </div>

    {/* Actor */}
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 400 }}>{att.actor.name}</div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{att.actor.id}</div>
      {att.signatory && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{att.signatory.name} · {att.signatory.title}</div>}
    </div>

    {/* Time */}
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 9, fontFamily: 'monospace' }}>
      <div><span style={{ color: 'var(--text-tertiary)' }}>Issued </span><span style={{ color: 'var(--text-tertiary)' }}>{fmtDate(att.timestamp)}</span></div>
      {ti.label && <div style={{ color: ti.color, display: 'flex', alignItems: 'center', gap: 3 }}>{ti.warn && <span>⚠</span>}{ti.label}</div>}
    </div>

    {/* Evidence — clickable */}
    <div onClick={e => { if (onEvidenceClick) { e.stopPropagation(); onEvidenceClick(att); } }}
      style={{ background: 'var(--bg-app-header)', borderRadius: 4, padding: '8px 10px', marginBottom: 6, border: '1px solid var(--border)44', cursor: onEvidenceClick ? 'pointer' : 'default', transition: 'border-color .15s, background .15s' }}
      onMouseEnter={e => { if (onEvidenceClick) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-surface)'; } }}
      onMouseLeave={e => { if (onEvidenceClick) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-app-header)'; } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 700 }}>EVIDENCE</div>
        {onEvidenceClick && <span style={{ fontSize: 8, color: 'var(--accent-indigo)', fontFamily: 'monospace', fontWeight: 600 }}>View →</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{att.evidence.type}</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{truncHash(att.evidence.hash, 10)}</span>
          <CopyBtn text={att.evidence.hash} />
        </div>
      </div>
    </div>

    {/* Signature + Subject (subtle footer) */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: 8, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
        sig: {truncHash(att.signature, 10)}<CopyBtn text={att.signature} />
      </div>
      <div style={{ fontSize: 8, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
        ref: {att.subject}
      </div>
    </div>
  </div>;
}

/* ═══ Main export ═══ */
export default function AttestationCard({ attestation, expanded = false, onClick, highlight, onEvidenceClick }) {
  if (!attestation) return null;
  const card = expanded
    ? <Expanded att={attestation} onClick={onClick} onEvidenceClick={onEvidenceClick} />
    : <Compact att={attestation} onClick={onClick} />;
  if (!highlight) return card;
  return <div style={{ animation: 'claimglow 1.5s ease-out forwards', borderRadius: 6 }}>{card}</div>;
}

export { ST as ATTESTATION_STATUS, fmtPredicate, timeInfo };
