import { useState, useMemo } from 'react';
import AttestationCard from './AttestationCard';

/* ═══ Collect sample attestations from the dataset ═══
 * Pulls rawAttestations from multiple nodes, ensuring all 5 statuses
 * and a mix of predicate types are represented.
 */
function collectSamples(root) {
  const byStatus = { verified: [], expired: [], contested: [], revoked: [], pending: [] };
  const byPredicate = {};
  const all = [];

  function walk(n) {
    if (n.rawAttestations) {
      for (const att of n.rawAttestations) {
        const entry = { att, nodeName: n.name, nodeType: n.type };
        all.push(entry);
        if (byStatus[att.status]) byStatus[att.status].push(entry);
        if (!byPredicate[att.predicate]) byPredicate[att.predicate] = [];
        byPredicate[att.predicate].push(entry);
      }
    }
    if (n.children) n.children.forEach(walk);
  }
  walk(root);

  // Pick representative samples: at least 2 of each status, spread of predicates
  const picked = new Set();
  const samples = [];
  const add = entry => { if (!picked.has(entry)) { picked.add(entry); samples.push(entry); } };

  // Ensure every status is represented
  for (const status of ['verified', 'expired', 'contested', 'revoked', 'pending']) {
    const pool = byStatus[status];
    if (pool.length > 0) add(pool[0]);
    if (pool.length > 1) add(pool[Math.floor(pool.length / 2)]);
  }

  // Ensure every predicate type is represented
  for (const pred of Object.keys(byPredicate)) {
    const pool = byPredicate[pred];
    if (pool.length > 0 && !samples.some(s => s.att.predicate === pred)) {
      add(pool[0]);
    }
  }

  // Fill up to ~24 total with a spread
  const stride = Math.max(1, Math.floor(all.length / 20));
  for (let i = 0; i < all.length && samples.length < 24; i += stride) {
    add(all[i]);
  }

  return samples;
}

export default function AttestationTestPanel({ data, onClose }) {
  const samples = useMemo(() => collectSamples(data), [data]);
  const [expandedIdx, setExpandedIdx] = useState(new Set());
  const [filter, setFilter] = useState('all');

  const toggle = idx => setExpandedIdx(prev => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });

  const statuses = ['all', 'verified', 'expired', 'contested', 'revoked', 'pending'];
  const predicates = useMemo(() => [...new Set(samples.map(s => s.att.predicate))].sort(), [samples]);

  const filtered = filter === 'all' ? samples
    : statuses.includes(filter) ? samples.filter(s => s.att.status === filter)
    : samples.filter(s => s.att.predicate === filter);

  return <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'var(--bg-overlay)', overflow: 'auto', backdropFilter: 'blur(4px)' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>AttestationCard Test Panel</h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>{samples.length} samples from dataset · click cards to toggle expanded</div>
        </div>
        <button onClick={onClose} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, padding: '6px 14px', fontFamily: 'monospace' }}>Close (Esc)</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {statuses.map(s => <button key={s} onClick={() => setFilter(s)}
          style={{ padding: '4px 10px', fontSize: 9, fontFamily: 'monospace', fontWeight: 700, border: '1px solid ' + (filter === s ? 'var(--accent-indigo)' : 'var(--border)'), borderRadius: 4, background: filter === s ? 'var(--accent-indigo-bg)' : 'var(--bg-surface)', color: filter === s ? 'var(--accent-indigo-light)' : 'var(--text-tertiary)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s}</button>)}
        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
        {predicates.map(p => <button key={p} onClick={() => setFilter(p)}
          style={{ padding: '4px 10px', fontSize: 9, fontFamily: 'monospace', border: '1px solid ' + (filter === p ? 'var(--accent-indigo)' : 'var(--border)'), borderRadius: 4, background: filter === p ? 'var(--accent-indigo-bg)' : 'var(--bg-surface)', color: filter === p ? 'var(--accent-indigo-light)' : 'var(--text-muted)', cursor: 'pointer' }}>{p}</button>)}
      </div>

      {/* Section: Compact cards */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '.08em', marginBottom: 8, fontFamily: 'monospace', fontWeight: 700 }}>COMPACT VARIANT ({filtered.length})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 6 }}>
          {filtered.map((s, i) => <div key={i}>
            <AttestationCard attestation={s.att} expanded={expandedIdx.has(i)} onClick={() => toggle(i)} />
            <div style={{ fontSize: 8, color: 'var(--text-faint)', fontFamily: 'monospace', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>from: {s.nodeName} ({s.nodeType})</div>
          </div>)}
        </div>
      </div>

      {/* Section: All expanded */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '.08em', marginBottom: 8, fontFamily: 'monospace', fontWeight: 700 }}>EXPANDED VARIANT (first 12)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
          {filtered.slice(0, 12).map((s, i) => <div key={`exp-${i}`}>
            <AttestationCard attestation={s.att} expanded />
            <div style={{ fontSize: 8, color: 'var(--text-faint)', fontFamily: 'monospace', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>from: {s.nodeName} ({s.nodeType})</div>
          </div>)}
        </div>
      </div>

      {/* Section: Side-by-side comparison per status */}
      <div>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '.08em', marginBottom: 8, fontFamily: 'monospace', fontWeight: 700 }}>STATUS COMPARISON — COMPACT vs EXPANDED</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['verified', 'expired', 'contested', 'revoked', 'pending'].map(status => {
            const sample = samples.find(s => s.att.status === status);
            if (!sample) return null;
            return <div key={status} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'color-mix(in srgb, var(--bg-deep) 40%, transparent)', borderRadius: 8, padding: 10, border: '1px solid var(--border)22' }}>
              <div>
                <div style={{ fontSize: 8, color: 'var(--text-faint)', fontFamily: 'monospace', marginBottom: 4 }}>COMPACT · {status.toUpperCase()}</div>
                <AttestationCard attestation={sample.att} />
              </div>
              <div>
                <div style={{ fontSize: 8, color: 'var(--text-faint)', fontFamily: 'monospace', marginBottom: 4 }}>EXPANDED · {status.toUpperCase()}</div>
                <AttestationCard attestation={sample.att} expanded />
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
}
