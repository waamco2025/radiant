import { useState, useCallback } from 'react';
import { fmtPredicate } from './AttestationCard';
import { TT } from '../data/tokens';
import NodeIcon from './NodeIcon';

/* ═══ Evidence type → file icon + simulated filename ═══ */
const FILE_META = {
  evaluation_report:      { icon: '📋', ext: 'pdf', prefix: 'EVAL' },
  inspection_certificate: { icon: '🔍', ext: 'pdf', prefix: 'INSP' },
  inspection_report:      { icon: '🔍', ext: 'pdf', prefix: 'INSP' },
  test_data:              { icon: '🧪', ext: 'csv', prefix: 'TEST' },
  test_report:            { icon: '🧪', ext: 'pdf', prefix: 'TEST' },
  calibration_record:     { icon: '⚙', ext: 'pdf', prefix: 'CAL' },
  calibration_certificate:{ icon: '⚙', ext: 'pdf', prefix: 'CAL' },
  provenance_document:    { icon: '📄', ext: 'pdf', prefix: 'PROV' },
  origin_certificate:     { icon: '📄', ext: 'pdf', prefix: 'ORIG' },
  shipping_manifest:      { icon: '📦', ext: 'json', prefix: 'SHIP' },
  qualification_record:   { icon: '✅', ext: 'pdf', prefix: 'QUAL' },
  quality_release:        { icon: '✅', ext: 'pdf', prefix: 'QUAL' },
  work_order:             { icon: '🔧', ext: 'pdf', prefix: 'WO' },
  supplier_agreement:     { icon: '📝', ext: 'pdf', prefix: 'AGR' },
  itar_classification:    { icon: '🛡', ext: 'pdf', prefix: 'ITAR' },
  corporate_charter:      { icon: '🏢', ext: 'pdf', prefix: 'CORP' },
};

const STATUS_COLORS = {
  verified:  'var(--accent-green)',
  expired:   'var(--accent-amber)',
  contested: 'var(--accent-red)',
  revoked:   'var(--accent-red-bg)',
  pending:   'var(--accent-amber)',
};

const ACCESS_COLORS = {
  restricted:   { c: 'var(--accent-red)', bg: 'var(--accent-red-bg)' },
  confidential: { c: 'var(--accent-amber)', bg: 'var(--accent-amber-bg)' },
  internal:     { c: 'var(--accent-blue)', bg: 'var(--accent-indigo-bg)' },
  public:       { c: 'var(--accent-green)', bg: 'var(--accent-green-bg)' },
};

/* Copy button */
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
    style={{ cursor: 'pointer', fontSize: 10, color: copied ? 'var(--accent-green)' : 'var(--text-muted)', marginLeft: 4, userSelect: 'none', transition: 'color .2s' }}>{copied ? '✓' : '⎘'}</span>;
}

/* Section header */
function SectionHeader({ label }) {
  return <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', marginBottom: 6, fontWeight: 700 }}>{label}</div>;
}

/* Row inside a section */
function Row({ label, value, mono, copyable }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all', textAlign: 'right', maxWidth: 260 }}>{value || '\u2014'}</span>
      {copyable && value && <CopyBtn text={value} />}
    </div>
  </div>;
}

/* ═══ Inline evidence panel — fills parent container ═══ */
export function EvidencePanel({ attestation, onClose, node, nodeTypeLabels }) {
  if (!attestation) return null;
  const att = attestation;
  const ev = att.evidence || {};
  const fm = FILE_META[ev.type] || FILE_META.provenance_document || { icon: '📄', ext: 'pdf', prefix: 'DOC' };
  const filename = `${fm.prefix}-${(att.subject || 'unknown').toUpperCase()}-${(ev.hash || '').slice(2, 8)}.${fm.ext}`;
  const sc = STATUS_COLORS[att.status] || 'var(--text-tertiary)';
  const ac = ACCESS_COLORS[ev.accessLevel] || ACCESS_COLORS.internal;
  const blockRef = ev.type && ev.type.startsWith('block_') ? ev.type : null;
  const nt = node ? (TT[node.type] || TT.component) : null;

  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {/* Header */}
    <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
      {/* Node context header */}
      {node && <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <NodeIcon type={node.type} size={16} />
          <span style={{ fontSize: 9, color: nt.border, fontFamily: 'monospace', fontWeight: 700 }}>{nodeTypeLabels?.[node.type] || nt.label}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>{node.name}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {node.token && <span style={{ fontSize: 9, background: 'var(--bg-surface)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>{node.token}</span>}
          {node.block != null && <span style={{ fontSize: 9, background: 'var(--bg-surface)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>BLK #{node.block}</span>}
        </div>
      </div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>Evidence Block</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{fmtPredicate(att.predicate)}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
      </div>
    </div>

    {/* Scrollable content */}
    <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
      {/* Document */}
      <div style={{ background: 'var(--bg-app-header)', borderRadius: 6, padding: 12, marginBottom: 12, border: '1px solid var(--border)44' }}>
        <SectionHeader label="DOCUMENT" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>{fm.icon}</span>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, wordBreak: 'break-all' }}>{filename}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{ev.type || '\u2014'}</div>
          </div>
        </div>
        <div style={{ height: 60, background: 'var(--bg-deep)', borderRadius: 4, border: '1px dashed #1e2433', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'monospace' }}>Document preview not available</span>
        </div>
      </div>

      {/* Verification */}
      <div style={{ background: 'var(--bg-app-header)', borderRadius: 6, padding: 12, marginBottom: 12, border: '1px solid var(--border)44' }}>
        <SectionHeader label="VERIFICATION" />
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 2 }}>SHA-256 Hash</div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-deep)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)44' }}>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{ev.hash || '\u2014'}</span>
            {ev.hash && <CopyBtn text={ev.hash} />}
          </div>
        </div>
        <Row label="Status" value={<span style={{ color: sc, fontWeight: 600 }}>{att.status?.toUpperCase()}</span>} />
        {blockRef && <Row label="On-Chain Ref" value={blockRef} mono />}
        {!blockRef && <Row label="On-Chain Ref" value={att.subject ? `node:${att.subject}` : '\u2014'} mono />}
      </div>

      {/* Storage */}
      <div style={{ background: 'var(--bg-app-header)', borderRadius: 6, padding: 12, marginBottom: 12, border: '1px solid var(--border)44' }}>
        <SectionHeader label="STORAGE" />
        <Row label="Provider" value={ev.storageRef ? ev.storageRef.split('://')[1]?.split('/')[0]?.replace(/-/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) : '\u2014'} />
        <Row label="Reference URI" value={ev.storageRef || '\u2014'} mono copyable />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>Access Level</span>
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: ac.c, background: ac.bg, padding: '2px 6px', borderRadius: 3, border: `1px solid color-mix(in srgb, ${ac.c} 20%, transparent)` }}>{(ev.accessLevel || '\u2014').toUpperCase()}</span>
        </div>
        <Row label="Retention Policy" value="7 years (regulatory minimum)" />
      </div>

      {/* Authorization */}
      <div style={{ background: 'var(--bg-app-header)', borderRadius: 6, padding: 12, marginBottom: 12, border: '1px solid var(--border)44' }}>
        <SectionHeader label="AUTHORIZATION" />
        <Row label="Organization" value={att.actor?.name || '\u2014'} />
        <Row label="Signatory" value={att.signatory ? `${att.signatory.name} \u00B7 ${att.signatory.title}` : '\u2014'} />
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 2 }}>Cryptographic Signature</div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-deep)', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)44' }}>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{att.signature || '\u2014'}</span>
            {att.signature && <CopyBtn text={att.signature} />}
          </div>
        </div>
        <Row label="Timestamp" value={att.timestamp ? att.timestamp.split('T')[0] : '\u2014'} mono />
      </div>

      {/* Footer */}
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.5 }}>
        Evidence artifacts are stored in qualified, tamper-evident storage with cryptographic integrity verification.
      </div>
    </div>
  </div>;
}

/* ═══ Legacy modal export (kept for backward compat) ═══ */
export default function EvidenceModal({ attestation, onClose }) {
  if (!attestation) return null;
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
    <div style={{ position: 'relative', width: 440, maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.6)', animation: 'pfade .2s ease' }}>
      <EvidencePanel attestation={attestation} onClose={onClose} />
    </div>
  </div>;
}
