import { useState, useMemo, useRef } from 'react';
import { TT } from '../data/tokens';
import { FIELD_TEMPLATE } from '../data/platformAssets';
import SvgMark from './SvgMark';
import HealthDot from './HealthDot';

const SEC = { fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' };

function sdaColor(type) {
  if (type === 'full') return 'var(--accent-sda-full)';
  if (type === 'selective') return 'var(--accent-amber)';
  if (type === 'derivative') return 'var(--accent-green)';
  return 'var(--text-tertiary)';
}

export default function AssetDirectoryModal({ platformAssets, onClose, nodeTypeLabels, onRequestDisclosure, disclosureRequests }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const backdropRef = useRef(null);

  /* Filter + sort */
  const filtered = useMemo(() => {
    const all = platformAssets || [];
    const q = search.toLowerCase().trim();
    let out = q ? all.filter(n => {
      const tt = TT[n.type] || TT.component;
      const typeLabel = (nodeTypeLabels?.[n.type] || tt.label).toLowerCase();
      return n.name.toLowerCase().includes(q) || (n.supplier || '').toLowerCase().includes(q) || (n.location || '').toLowerCase().includes(q) || typeLabel.includes(q);
    }) : [...all];

    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'type') out.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    else if (sort === 'health') {
      const score = h => h === 'critical' ? 2 : h === 'warning' ? 1 : 0;
      out.sort((a, b) => score(b.health) - score(a.health) || a.name.localeCompare(b.name));
    }
    else if (sort === 'claims') out.sort((a, b) => (b.claimsSummary?.total || 0) - (a.claimsSummary?.total || 0) || a.name.localeCompare(b.name));
    return out;
  }, [platformAssets, search, sort, nodeTypeLabels]);

  /* Detail view for selected asset */
  const renderDetail = () => {
    const n = selectedAsset;
    const tt = TT[n.type] || TT.component;
    const cs = n.claimsSummary || {};

    return <DetailView
      asset={n}
      tt={tt}
      cs={cs}
      nodeTypeLabels={nodeTypeLabels}
      onBack={() => setSelectedAsset(null)}
      onRequestDisclosure={onRequestDisclosure}
      disclosureRequests={disclosureRequests}
    />;
  };

  return <div ref={backdropRef}
    onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    style={{
      position: 'fixed', inset: 0, zIndex: 55,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'pfade .2s ease',
    }}
  >
    <div style={{
      width: 900, maxWidth: '92vw', minHeight: '70vh', height: '85vh',
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      boxShadow: '0 16px 48px rgba(0,0,0,.6)',
    }}>
      {selectedAsset
        ? renderDetail()
        : <>
          {/* Header (non-scrolling) */}
          <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>Asset Directory</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} discoverable assets on the Radiant platform</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >&times;</button>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginTop: 14, marginBottom: 10 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, type, supplier, location..."
                style={{
                  width: '100%', padding: '10px 14px 10px 36px', fontSize: 13,
                  background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  fontFamily: "var(--font-display)",
                  transition: 'border-color .15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-indigo)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Sort row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginRight: 4 }}>SORT</span>
              {[{ k: 'name', l: 'Name' }, { k: 'type', l: 'Type' }, { k: 'health', l: 'Health' }, { k: 'claims', l: 'Claims' }].map(s =>
                <button key={s.k} onClick={() => setSort(s.k)} style={{
                  padding: '4px 10px', fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                  background: sort === s.k ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'transparent',
                  border: `1px solid ${sort === s.k ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  borderRadius: 4, color: sort === s.k ? 'var(--accent-indigo-text)' : 'var(--text-tertiary)',
                  cursor: 'pointer', transition: 'all .15s',
                }}>{s.l}</button>)}
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
            {filtered.length === 0
              ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
                  <div style={{ color: 'var(--border-hover)', fontFamily: 'monospace', fontSize: 12 }}>No assets match your search</div>
                </div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {filtered.slice(0, 150).map(n => {
                    const tt = TT[n.type] || TT.component;
                    return <div key={n.id} style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '14px 16px', transition: 'border-color .15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      {/* Name + health dot */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <HealthDot health={n.health} summary={n.claimsSummary} size={6} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.name}</div>
                      </div>
                      {/* Type badge + disclosure availability */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <svg width={12} height={12} style={{ flexShrink: 0 }}><SvgMark type={n.type} cx={6} cy={6} r={4} /></svg>
                        <span style={{ fontSize: 10, color: tt.border, fontFamily: 'monospace', fontWeight: 600 }}>{nodeTypeLabels?.[n.type] || tt.label}</span>
                        {(n.disclosureTypes || []).map(dt => <span key={dt} style={{
                          fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                          padding: '1px 5px', borderRadius: 3,
                          background: `color-mix(in srgb, ${sdaColor(dt)} 8%, transparent)`, color: sdaColor(dt),
                          border: `1px solid color-mix(in srgb, ${sdaColor(dt)} 20%, transparent)`,
                        }}>{dt}</span>)}
                      </div>
                      {/* Supplier */}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.supplier}</div>
                      {/* Location */}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{n.location}</div>
                      {/* Claims */}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>{n.claimsSummary?.total || 0} claim{(n.claimsSummary?.total || 0) !== 1 ? 's' : ''}</div>
                      {(() => {
                        const req = (disclosureRequests || []).find(r => r.assetId === n.id);
                        if (!req) return null;
                        const c = req.status === 'approved' ? 'var(--accent-green)' : req.status === 'declined' ? 'var(--accent-red)' : 'var(--accent-indigo)';
                        const label = req.status === 'approved' ? 'APPROVED' : req.status === 'declined' ? 'DECLINED' : 'REQUESTED';
                        return <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: c, background: `color-mix(in srgb, ${c} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 20%, transparent)`, padding: '2px 6px', borderRadius: 3, display: 'inline-block', marginBottom: 4 }}>{label}</div>;
                      })()}
                      <div style={{ height: 6 }} />
                      {/* View Details */}
                      <button onClick={() => setSelectedAsset(n)} style={{
                        width: '100%', height: 32, padding: 0,
                        background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                        color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
                        transition: 'border-color .15s, color .15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >View Details</button>
                    </div>;
                  })}
                </div>}
          </div>
        </>}
    </div>
  </div>;
}


/* ─── Detail View (inner component) ─── */

function DetailView({ asset, tt, cs, nodeTypeLabels, onBack, onRequestDisclosure, disclosureRequests }) {
  const n = asset;
  const [previewDisclosure, setPreviewDisclosure] = useState(n.disclosureTypes?.[0] || 'full');
  const [showRequestConfirm, setShowRequestConfirm] = useState(false);
  const [requestType, setRequestType] = useState(null);
  const existingRequest = (disclosureRequests || []).find(r => r.assetId === n.id);
  const [expandedCats, setExpandedCats] = useState(() => {
    const cats = Object.keys(FIELD_TEMPLATE);
    return new Set(cats.slice(0, 2));
  });

  const toggleCat = cat => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const visibleFields = n.disclosureVisibility?.[previewDisclosure] || [];
  const visibleSet = new Set(visibleFields);

  return <>
    {/* Back button */}
    <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: 'var(--accent-indigo)', cursor: 'pointer',
        fontSize: 12, fontFamily: 'monospace', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6,
      }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-indigo-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--accent-indigo)'; }}
      >
        <span style={{ fontSize: 14 }}>&larr;</span> Back to Directory
      </button>
    </div>

    {/* Scrollable detail content */}
    <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px 24px' }}>
      {/* Asset Identity Card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width={28} height={28} style={{ flexShrink: 0 }}><SvgMark type={n.type} cx={14} cy={14} r={10} /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>{n.name}</div>
              <HealthDot health={n.health} summary={n.claimsSummary} size={8} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: tt.border, fontFamily: 'monospace', fontWeight: 600 }}>{nodeTypeLabels?.[n.type] || tt.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>Block #{n.block}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column grid: Supplier Info + Attestation Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Supplier Info */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={SEC}>SUPPLIER INFO</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{n.supplier}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{n.location}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Registered {n.registeredDate}</div>
        </div>
        {/* Attestation Summary */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={SEC}>ATTESTATION SUMMARY</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-bright)' }}>{cs.total || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>{cs.verified || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Verified</div>
            </div>
            {(cs.pending || 0) > 0 && <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-tertiary)' }}>{cs.pending}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pending</div>
            </div>}
            {(cs.expired || 0) > 0 && <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-amber)' }}>{cs.expired}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Expired</div>
            </div>}
            {(cs.contested || 0) > 0 && <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-red)' }}>{cs.contested}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Contested</div>
            </div>}
          </div>
        </div>
      </div>

      {/* Available Disclosures */}
      <div style={SEC}>AVAILABLE DISCLOSURES</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {(n.disclosureTypes || []).map(dt => {
          const c = sdaColor(dt);
          const active = previewDisclosure === dt;
          const desc = dt === 'full' ? 'Complete data sheet with all fields visible'
            : dt === 'selective' ? `Partial data sheet \u2014 ${n.disclosureVisibility?.selective?.length || 0} of 30 fields shared`
            : 'Evaluation results only \u2014 no raw data';
          return <div key={dt} onClick={() => setPreviewDisclosure(dt)} style={{
            background: active ? 'var(--bg-card)' : 'var(--bg-deep)', border: `1px solid color-mix(in srgb, ${active ? `${c} 27%, transparent)` : 'var(--border)'}`,
            borderRadius: 8, padding: 14, cursor: 'pointer', transition: 'border-color .15s',
          }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                padding: '2px 6px', borderRadius: 3,
                background: `color-mix(in srgb, ${c} 8%, transparent)`, color: c, border: `1px solid color-mix(in srgb, ${c} 20%, transparent)`,
              }}>{dt}</span>
              {active && <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)' }}>PREVIEWING</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{desc}</div>
          </div>;
        })}
      </div>

      {/* Disclosed Data Fields */}
      <div style={{ ...SEC, marginBottom: 12 }}>DATA FIELDS &mdash; {previewDisclosure.toUpperCase()} DISCLOSURE</div>

      {previewDisclosure === 'derivative'
        ? /* Derivative: eval summary only */
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              This asset has been evaluated. Raw data is not shared under derivative disclosure.
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>
                Evaluation: <span style={{ color: 'var(--accent-indigo)', fontWeight: 600 }}>{n.dataFields?.primaryCert || 'AS9100 Rev D'}</span> &middot; Result: <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>PASS</span> &middot; 47/47 requirements met
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Evaluated by: {n.dataFields?.certBody || 'Bureau Veritas'} &middot; Date: {n.dataFields?.certDate || '\u2014'}
              </div>
            </div>
          </div>
        : /* Full or Selective: field categories */
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            {Object.entries(FIELD_TEMPLATE).map(([catKey, cat]) => {
              const expanded = expandedCats.has(catKey);
              const visibleCount = cat.fields.filter(f => visibleSet.has(f.key)).length;
              return <div key={catKey} style={{ marginBottom: 8 }}>
                <div onClick={() => toggleCat(catKey)} className="cat-hdr" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0', cursor: 'pointer', userSelect: 'none',
                  borderBottom: expanded ? '1px solid var(--border)44' : 'none',
                }}
                  onMouseEnter={e => { const l = e.currentTarget.querySelector('.cat-lbl'); if (l) l.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { const l = e.currentTarget.querySelector('.cat-lbl'); if (l) l.style.color = 'var(--text-secondary)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)', display: 'inline-block', width: 16, textAlign: 'center', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>&rsaquo;</span>
                    <span className="cat-lbl" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', transition: 'color .15s' }}>{cat.label}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {previewDisclosure === 'selective' ? `${visibleCount}/${cat.fields.length}` : cat.fields.length}
                    </span>
                  </div>
                </div>
                {expanded && <div style={{ paddingTop: 4 }}>
                  {cat.fields.map(f => {
                    const isVisible = visibleSet.has(f.key);
                    const value = n.dataFields?.[f.key] || '\u2014';
                    return <div key={f.key} style={{
                      display: 'flex', alignItems: 'center', padding: '4px 0',
                      borderBottom: '1px solid var(--border)22',
                      opacity: isVisible ? 1 : 0.5,
                    }}>
                      <div style={{ width: 160, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                        {isVisible
                          ? value
                          : <span style={{
                              background: 'var(--border)', color: 'var(--border-hover)', fontSize: 9,
                              fontFamily: 'monospace', padding: '2px 6px', borderRadius: 3,
                            }}>REDACTED</span>}
                      </div>
                    </div>;
                  })}
                </div>}
              </div>;
            })}
          </div>}

      {/* Recent Activity */}
      <div style={SEC}>RECENT ACTIVITY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 20 }}>
        {(n.activity || []).map((a, i) => <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0',
          borderBottom: i < (n.activity || []).length - 1 ? '1px solid var(--border)22' : 'none',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-indigo)', marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{a.action}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.date} &middot; {a.actor}</div>
          </div>
        </div>)}
      </div>

      {/* Actions */}
      <div style={SEC}>ACTIONS</div>
      {existingRequest ? (
        (() => {
          const s = existingRequest.status;
          const c = s === 'approved' ? 'var(--accent-green)' : s === 'declined' ? 'var(--accent-red)' : 'var(--accent-indigo)';
          const label = s === 'approved' ? 'APPROVED' : s === 'declined' ? 'DECLINED' : 'REQUESTED';
          const desc = s === 'approved' ? 'Disclosure agreement active'
            : s === 'declined' ? (existingRequest.declineReason || 'Supplier declined this request')
            : 'Awaiting supplier response';
          return <div style={{ padding: '12px 16px', background: `color-mix(in srgb, ${c} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 20%, transparent)`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 13%, transparent)`, padding: '2px 8px', borderRadius: 3 }}>{label}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{existingRequest.requestedType} disclosure {s === 'approved' ? 'active' : s === 'declined' ? 'declined' : 'requested'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{existingRequest.requestedAt?.slice(0, 10)} · {desc}</div>
            </div>
          </div>;
        })()
      ) : showRequestConfirm ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Request Disclosure from {n.supplier}?</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5 }}>You are requesting access to data about <strong style={{ color: 'var(--text-secondary)' }}>{n.name}</strong>. The supplier will be notified and can approve or decline your request.</div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, letterSpacing: '.06em' }}>SELECT DISCLOSURE TYPE</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(n.disclosureTypes || []).map(dt => {
              const c = sdaColor(dt);
              const sel = requestType === dt;
              return <button key={dt} onClick={() => setRequestType(dt)} style={{
                flex: 1, padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                background: sel ? `color-mix(in srgb, ${c} 8%, transparent)` : 'transparent', border: `1px solid ${sel ? c : 'var(--border)'}`,
                borderRadius: 6, color: sel ? c : 'var(--text-muted)', cursor: 'pointer', transition: 'all .15s',
              }}>{dt}</button>;
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowRequestConfirm(false); setRequestType(null); }} style={{
              flex: 1, height: 36, background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
            }}>Cancel</button>
            <button disabled={!requestType} onClick={() => {
              if (onRequestDisclosure && requestType) {
                onRequestDisclosure(n, requestType);
                setShowRequestConfirm(false); setRequestType(null);
              }
            }} style={{
              flex: 2, height: 36,
              background: requestType ? 'var(--accent-indigo)' : 'var(--bg-surface)', border: `1px solid ${requestType ? 'var(--accent-indigo)' : 'var(--border)'}`,
              borderRadius: 6, color: requestType ? 'var(--text-bright)' : 'var(--text-muted)',
              fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
              cursor: requestType ? 'pointer' : 'not-allowed', opacity: requestType ? 1 : 0.5,
            }}>Send Request</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowRequestConfirm(true)} style={{
            flex: 1, height: 40, padding: 0,
            background: 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-indigo) 27%, transparent)', borderRadius: 6,
            color: 'var(--accent-indigo)', fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
            cursor: 'pointer', transition: 'background .15s, border-color .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 15%, transparent)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 40%, transparent)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          >Request Disclosure</button>
        </div>
      )}
    </div>
  </>;
}
