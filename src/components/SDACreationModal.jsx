import { useState, useMemo, useRef, useEffect } from 'react';
import { TT } from '../data/tokens';
import NodeIcon from './NodeIcon';

const STEPS = ['Define Audience', 'Data Fields', 'Duration & Conditions', 'Review & Submit'];

const FIELD_GROUPS = [
  { key: 'shipment_details', label: 'Shipment details', items: ['Shipping names and addresses', 'Packing list number and details', 'Purchase order and order numbers', 'Shipment dates and method', 'Quantity shipped, on order, back order, etc.'] },
  { key: 'part_identification', label: 'Part identification', locked: true, items: ['Part name, number, revision', 'Part description and specifications'] },
  { key: 'material_specs', label: 'Material and processing specifications', items: ['Materials (specify alloy per ASTM or MIL-A spec.)', 'Surface heat code and lot number', 'Heat treatment data, RA, RMS values', 'Heat treat per MIL-H-6875', 'Carburize thread plating per MIL-C-26074'] },
  { key: 'processing_specs', label: 'Finishing and coating', items: ['Surface coating per MIL-STD-150', 'Deburring/cleaning per MIL-C-81562', 'Allaying, anodizing, requirements and application methods', 'Notes on conformance to NAS16, NAS18, NAS4, KLV requirements'] },
  { key: 'test_results', label: 'Test results and quality', items: ['Inspection and dimensional reports', 'Non-destructive testing (NDT) results', 'Certificates of conformance'] },
  { key: 'certifications', label: 'Certifications', locked: true, items: ['ISO, AS9100, NADCAP certifications', 'ITAR / EAR compliance status'] },
  { key: 'pricing', label: 'Pricing and commercial', items: ['Unit cost and volume pricing', 'Contract terms and conditions', 'Lead times and availability'] },
  { key: 'supplier_identity', label: 'Supplier identity', items: ['Full supplier org details and facility address', 'Key contacts and representatives', 'Sub-tier supplier information'] },
];

const ALL_FIELD_KEYS = FIELD_GROUPS.map(g => g.key);
const LOCKED_KEYS = new Set(['part_identification', 'certifications']);
const SDA_COST = 80;

const SEC = {
  fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)',
  letterSpacing: '.08em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase',
};

const MONO = { fontFamily: 'monospace' };

const RESTRICTIONS = [
  { key: 'vendor_only', label: 'Grant data to specific vendors' },
  { key: 'no_copy', label: 'No copying or redistribution' },
  { key: 'no_third_party', label: 'No sharing with third parties' },
  { key: 'other', label: 'Other' },
];

const DISCLOSURE_LABELS = { full: 'Full', selective: 'Selective', derivative: 'Derivative' };

const CARD = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16,
};

const INPUT = {
  width: '100%', padding: '10px 14px', fontSize: 13,
  background: 'var(--bg-deep)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  fontFamily: "var(--font-display)",
  transition: 'border-color .15s',
};

function makeLockedChecks() {
  const s = new Set();
  for (const g of FIELD_GROUPS) {
    if (LOCKED_KEYS.has(g.key)) g.items.forEach((_, idx) => s.add(`${g.key}:${idx}`));
  }
  return s;
}

/* ── Deterministic on-chain address hint ── */
function hashOrg(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h + name.charCodeAt(i)) | 0; }
  const hex = Math.abs(h).toString(16).padStart(8, '0');
  return `0x${hex.slice(0, 4)}...${hex.slice(-4)}`;
}

/* ── Checkbox primitive ── */
function Chk({ checked, locked, color, size = 14 }) {
  const c = color || 'var(--accent-indigo)';
  return <div style={{
    width: size, height: size, borderRadius: 3, flexShrink: 0,
    border: `1px solid ${locked ? 'var(--accent-green)' : checked ? c : 'var(--border-hover)'}`,
    background: locked ? 'var(--accent-green-bg)' : checked ? `color-mix(in srgb, ${c} 9%, transparent)` : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size - 5, color: locked ? 'var(--accent-green)' : c,
  }}>
    {(locked || checked) ? '✓' : ''}
  </div>;
}

/* ── Radio dot ── */
function Radio({ selected, disabled }) {
  return <div style={{
    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${disabled ? 'var(--border-hover)' : selected ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
    background: selected ? 'var(--accent-indigo)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    {selected && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-bright)' }} />}
  </div>;
}

export default function SDACreationModal({ isOpen, onClose, onSubmit, prefilledAsset, prefilledReceiver, currentRole, networkOwnerName, supplierName, supplierAssets, credits, presetMode, presetEvaluation, fromInvitation, presetType }) {
  const effectivePresetMode = presetType === 'derivative' ? 'derivative' : presetMode;
  const makeInit = () => ({
    step: 1,
    direction: 'disclose',
    receivers: prefilledReceiver ? [prefilledReceiver] : [],
    audienceType: 'party',
    disclosureApproval: 'review',
    selectedAssets: prefilledAsset ? [prefilledAsset.id] : [],
    disclosureType: presetType || (effectivePresetMode === 'derivative' ? 'derivative' : 'full'),
    derivativeEvalId: effectivePresetMode === 'derivative' ? (presetEvaluation?.id || null) : null,
    selectedEvaluation: effectivePresetMode === 'derivative' ? (presetEvaluation || null) : null,
    expirationDate: '',
    maxUsers: 'unlimited',
    restrictions: ['no_copy'],
    otherRestriction: '',
    preSign: false,
  });

  const [wiz, setWiz] = useState(makeInit);
  const [recvInput, setRecvInput] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetDropOpen, setAssetDropOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState(makeLockedChecks);
  const [fullFieldsExpanded, setFullFieldsExpanded] = useState(false);
  const backdropRef = useRef(null);

  useEffect(() => {
    if (isOpen) { setWiz(makeInit()); setRecvInput(''); setAssetSearch(''); setAssetDropOpen(false); setCheckedItems(makeLockedChecks()); setFullFieldsExpanded(false); }
  }, [isOpen]);

  const setF = (k, v) => setWiz(p => ({ ...p, [k]: v }));

  /* ── Asset lookup ── */
  const assetById = useMemo(() => {
    const m = {};
    (supplierAssets || []).forEach(a => { m[a.id] = a; });
    if (prefilledAsset) m[prefilledAsset.id] = prefilledAsset;
    return m;
  }, [supplierAssets, prefilledAsset]);

  const filteredAssets = useMemo(() => {
    const q = assetSearch.toLowerCase();
    return (supplierAssets || [])
      .filter(a => !wiz.selectedAssets.includes(a.id))
      .filter(a => !q || a.label.toLowerCase().includes(q) || (a.type || '').toLowerCase().includes(q))
      .slice(0, 10);
  }, [supplierAssets, wiz.selectedAssets, assetSearch]);

  /* ── Field checkbox helpers ── */
  const toggleItem = (key, idx) => {
    if (LOCKED_KEYS.has(key)) return;
    setCheckedItems(s => { const ns = new Set(s); const k = `${key}:${idx}`; if (ns.has(k)) ns.delete(k); else ns.add(k); return ns; });
  };
  const toggleGroup = (key) => {
    if (LOCKED_KEYS.has(key)) return;
    const g = FIELD_GROUPS.find(fg => fg.key === key); if (!g) return;
    setCheckedItems(s => {
      const ns = new Set(s);
      const allChecked = g.items.every((_, idx) => ns.has(`${key}:${idx}`));
      g.items.forEach((_, idx) => { if (allChecked) ns.delete(`${key}:${idx}`); else ns.add(`${key}:${idx}`); });
      return ns;
    });
  };

  /* ── Derived disclosure fields ── */
  const disclosedFields = useMemo(() =>
    ALL_FIELD_KEYS.filter(key => {
      const g = FIELD_GROUPS.find(fg => fg.key === key);
      return g && g.items.some((_, idx) => checkedItems.has(`${key}:${idx}`));
    }), [checkedItems]);

  const redactedFields = useMemo(() => ALL_FIELD_KEYS.filter(k => !disclosedFields.includes(k)), [disclosedFields]);

  /* ── Receiver / asset helpers ── */
  const addReceiver = (name) => { const t = name.trim(); if (t && !wiz.receivers.includes(t)) setF('receivers', [...wiz.receivers, t]); setRecvInput(''); };
  const removeReceiver = (name) => setF('receivers', wiz.receivers.filter(r => r !== name));
  const addAsset = (id) => { setF('selectedAssets', [...wiz.selectedAssets, id]); setAssetSearch(''); };
  const removeAsset = (id) => setF('selectedAssets', wiz.selectedAssets.filter(a => a !== id));
  const toggleRestriction = (key) => setWiz(p => ({ ...p, restrictions: p.restrictions.includes(key) ? p.restrictions.filter(r => r !== key) : [...p.restrictions, key] }));

  /* ── Step validation ── */
  const canNext = useMemo(() => {
    switch (wiz.step) {
      case 1: return wiz.selectedAssets.length > 0 && (wiz.audienceType === 'anyone' || wiz.receivers.length > 0);
      case 2: {
        if (wiz.disclosureType === 'full') return true;
        if (wiz.disclosureType === 'selective') return disclosedFields.some(f => !LOCKED_KEYS.has(f));
        if (wiz.disclosureType === 'derivative') return true;
        return false;
      }
      case 3: return true;
      case 4: return (credits || 0) >= SDA_COST;
      default: return false;
    }
  }, [wiz, credits, disclosedFields]);

  /* ── Submit ── */
  const handleSubmit = () => {
    onSubmit({
      direction: wiz.direction,
      receivers: wiz.audienceType === 'anyone' ? ['*'] : wiz.receivers,
      audienceType: wiz.audienceType,
      disclosureApproval: wiz.disclosureApproval,
      selectedAssets: wiz.selectedAssets,
      disclosureType: wiz.disclosureType,
      disclosedFields,
      redactedFields,
      derivativeEvalId: wiz.derivativeEvalId,
      selectedEvaluation: wiz.selectedEvaluation || null,
      expirationDate: wiz.expirationDate,
      maxUsers: wiz.maxUsers,
      restrictions: wiz.restrictions.includes('other') ? [...wiz.restrictions.filter(r => r !== 'other'), wiz.otherRestriction].filter(Boolean) : wiz.restrictions,
      preSign: wiz.preSign,
      supplierName: supplierName || '',
    });
    onClose();
  };

  if (!isOpen) return null;

  /* ── First selected asset ref (for Step 2) ── */
  const firstAsset = assetById[wiz.selectedAssets[0]];
  const discTypeLabel = DISCLOSURE_LABELS[wiz.disclosureType] || 'Selective';
  const receiverName = wiz.receivers[0] || 'Receiver';

  return (
    <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pfade .2s ease',
      }}>
      <div style={{
        width: 640, maxWidth: '90vw', maxHeight: '80vh',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,.6)',
      }}>

        {/* ═══ Header ═══ */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Create {discTypeLabel} Disclosure Agreement</span>
                {fromInvitation && <span style={{ fontSize: 10, ...MONO, fontWeight: 700, color: 'var(--accent-green)', border: '1px solid color-mix(in srgb, var(--accent-green) 27%, transparent)', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>INVITATION-LINKED</span>}
              </div>
              {fromInvitation && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Asset and receiver pre-set from invitation</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}>×</button>
          </div>
        </div>

        {/* ═══ Progress stepper ═══ */}
        <div style={{ padding: '0 24px 24px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', marginTop: 16, marginBottom: 16 }}>
          {STEPS.flatMap((label, i) => {
            const stepNum = i + 1;
            const done = wiz.step > stepNum;
            const cur = wiz.step === stepNum;
            const items = [];
            if (i > 0) items.push(<div key={`line-${i}`} style={{ flex: 1, height: 2, background: done ? 'var(--accent-green)' : 'var(--border)', marginTop: 15, minWidth: 20 }} />);
            items.push(
              <div key={`s-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: done ? 'var(--accent-green)' : cur ? 'var(--accent-indigo)' : 'transparent',
                  border: `2px solid ${done ? 'var(--accent-green)' : cur ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: done ? 'var(--text-bright)' : cur ? 'var(--text-bright)' : 'var(--text-muted)', ...MONO,
                }}>{done ? '✓' : stepNum}</div>
                <div style={{ fontSize: 11, color: cur ? 'var(--text-bright)' : done ? 'var(--text-tertiary)' : 'var(--text-muted)', fontFamily: "var(--font-display)", whiteSpace: 'nowrap', textAlign: 'center', fontWeight: cur ? 600 : 400 }}>{label}</div>
              </div>
            );
            return items;
          })}
        </div>

        {/* ═══ Scrollable body ═══ */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>

          {/* ──────── STEP 1: Define Audience ──────── */}
          {wiz.step === 1 && <>
            {/* Direction toggle — hidden when invitation-linked */}
            {!fromInvitation && <>
              <div style={SEC}>I want to</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { key: 'receive', label: 'Receive data', disabled: true },
                  { key: 'disclose', label: 'Disclose data', disabled: false },
                ].map(opt => {
                  const sel = opt.key === 'disclose';
                  return <button key={opt.key}
                    style={{
                      padding: '9px 20px', fontSize: 12, fontWeight: sel ? 600 : 400,
                      background: sel ? 'var(--accent-indigo)' : 'transparent',
                      border: sel ? 'none' : '1px solid var(--border)',
                      borderRadius: 6, color: sel ? 'var(--text-bright)' : 'var(--text-tertiary)',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.4 : 1,
                    }}>{opt.label}</button>;
                })}
              </div>
            </>}

            {/* Asset card */}
            <div style={SEC}>Asset</div>
            <div style={CARD}>
              {wiz.selectedAssets.map(id => {
                const a = assetById[id]; if (!a) return null;
                const locked = fromInvitation || effectivePresetMode === 'derivative';
                const tk = TT[a.type] || TT.component;
                return <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tk.border, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', ...MONO }}>{tk.label}{a.id ? ` · ${a.id}` : ''}</div>
                  </div>
                  {locked && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔒</span>}
                  {!locked && <span onClick={() => removeAsset(id)} style={{ fontSize: 14, color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}>×</span>}
                </div>;
              })}
              {wiz.selectedAssets.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No asset selected</div>
              )}
              {!fromInvitation && effectivePresetMode !== 'derivative' && (
                <div style={{ position: 'relative', marginTop: wiz.selectedAssets.length > 0 ? 10 : 0 }}>
                  <input value={assetSearch} onChange={e => setAssetSearch(e.target.value)}
                    onFocus={e => { setAssetDropOpen(true); e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
                    onBlur={e => { setTimeout(() => setAssetDropOpen(false), 150); e.currentTarget.style.borderColor = 'var(--border)'; }}
                    placeholder="Search assets…" className="dim-ph"
                    style={INPUT} />
                  {assetDropOpen && filteredAssets.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 10, marginTop: 2 }}>
                      {filteredAssets.map(a => {
                        const tk = TT[a.type] || TT.component;
                        return <div key={a.id} onMouseDown={() => addAsset(a.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', transition: 'background .1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          <NodeIcon type={a.type} size={10} />
                          <span style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                          <span style={{ fontSize: 9, color: tk.border, ...MONO }}>{a.tier || tk.label}</span>
                        </div>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Receiving party card */}
            <div style={SEC}>Receiving party</div>
            <div style={CARD}>
              {/* Audience type toggle (non-invitation only) */}
              {!fromInvitation && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {[
                    { key: 'party', label: 'Specific Party' },
                    { key: 'anyone', label: 'Anyone' },
                  ].map(opt => {
                    const sel = wiz.audienceType === opt.key;
                    return <button key={opt.key} onClick={() => setF('audienceType', opt.key)}
                      style={{
                        padding: '4px 12px', fontSize: 10, ...MONO, fontWeight: 600,
                        background: sel ? 'color-mix(in srgb, var(--accent-indigo) 9%, transparent)' : 'transparent',
                        border: `1px solid ${sel ? 'var(--accent-indigo)' : 'var(--border)'}`,
                        borderRadius: 4, color: sel ? 'var(--accent-indigo)' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'border-color .15s',
                      }}>{opt.label}</button>;
                  })}
                </div>
              )}

              {/* Receiver chips */}
              {wiz.audienceType === 'party' && wiz.receivers.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: fromInvitation ? 0 : 10 }}>
                  {wiz.receivers.map(r => (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', ...MONO }}>{hashOrg(r)}</span>
                      </div>
                      {fromInvitation
                        ? <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔒</span>
                        : <span onClick={() => removeReceiver(r)} style={{ fontSize: 14, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}>×</span>
                      }
                    </div>
                  ))}
                </div>
              )}

              {/* Receiver search (non-invitation, party mode) */}
              {!fromInvitation && wiz.audienceType === 'party' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={recvInput} onChange={e => setRecvInput(e.target.value)} placeholder="Search for entity…" className="dim-ph"
                    onKeyDown={e => { if (e.key === 'Enter' && recvInput.trim()) addReceiver(recvInput); }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    style={{ ...INPUT, flex: 1 }} />
                  <button onClick={() => { if (recvInput.trim()) addReceiver(recvInput); }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    style={{ padding: '8px 14px', fontSize: 11, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent-indigo)', cursor: 'pointer', ...MONO, fontWeight: 600, whiteSpace: 'nowrap', transition: 'border-color .15s' }}>+ Add</button>
                </div>
              )}

              {/* Anyone note */}
              {wiz.audienceType === 'anyone' && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  This disclosure will be available to any network participant who discovers your asset.
                </div>
              )}

              {/* Empty state */}
              {wiz.audienceType === 'party' && wiz.receivers.length === 0 && fromInvitation && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No receiver specified</div>
              )}
            </div>

            {/* Approval mode card */}
            <div style={SEC}>Approval mode</div>
            <div style={CARD}>
              {[
                { key: 'review', label: 'Manual approval', desc: 'Review and approve each request to enter this SDA' },
                { key: 'auto', label: 'Auto-approve', desc: 'Grant access automatically when receiving party meets terms' },
              ].map(opt => {
                const sel = wiz.disclosureApproval === opt.key;
                return <div key={opt.key} onClick={() => setF('disclosureApproval', opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6,
                    background: sel ? 'color-mix(in srgb, var(--accent-indigo) 3%, transparent)' : 'transparent',
                    cursor: 'pointer', transition: 'background .15s',
                    marginBottom: opt.key === 'review' ? 4 : 0,
                  }}>
                  <Radio selected={sel} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: sel ? 600 : 400, color: sel ? 'var(--text-bright)' : 'var(--text-secondary)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </div>;
              })}
            </div>
          </>}

          {/* ──────── STEP 2: Data Fields ──────── */}
          {wiz.step === 2 && <>
            {effectivePresetMode === 'derivative' ? <>
              {/* ── Derivative preset: locked type + POE summary ── */}
              <div style={SEC}>Disclosure type</div>
              <div style={{ ...CARD, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--accent-green)' }}>✓</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>Derivative Disclosure</span>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-green) 15%, transparent)', color: 'var(--accent-green)', ...MONO, fontWeight: 600 }}>Evaluated</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Share evaluation results without disclosing the underlying product data or evidence.
                </div>
              </div>

              <div style={SEC}>Proof of Evaluation</div>
              {(() => {
                const selectedEval = wiz.selectedEvaluation || presetEvaluation;
                const isPass = selectedEval?.overallResult === 'pass';
                return selectedEval ? <div style={CARD}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 9, ...MONO, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.06em' }}>EVALUATION RESULT</span>
                    <span style={{ fontSize: 9, ...MONO, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: isPass ? 'var(--accent-green-bg)' : 'var(--accent-amber-bg)', color: isPass ? 'var(--accent-green)' : 'var(--accent-amber)' }}>{isPass ? 'PASS' : 'FAIL'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Checklist:</span> <span style={{ color: 'var(--text-primary)' }}>{selectedEval.checklist}</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Date:</span> <span style={{ color: 'var(--text-primary)' }}>{selectedEval.date}</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Requirements:</span> <span style={{ color: 'var(--text-primary)' }}>{selectedEval.requirementCount}</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Evaluator:</span> <span style={{ color: 'var(--text-primary)' }}>{selectedEval.evaluator === 'ai_auto' ? 'AI Auto' : selectedEval.evaluator}</span></div>
                    <div><span style={{ color: 'var(--accent-green)' }}>{selectedEval.passCount} passed</span></div>
                    <div>{selectedEval.failCount > 0 && <span style={{ color: 'var(--accent-red)' }}>{selectedEval.failCount} flagged</span>}</div>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', ...MONO, marginTop: 10 }}>Eval ref: {selectedEval.id}</div>
                </div> : <div style={{ ...CARD, fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.5, background: 'color-mix(in srgb, var(--accent-amber-bg) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)' }}>
                  No evaluation found. A derivative disclosure requires a completed evaluation.
                </div>;
              })()}

              {/* Privacy note */}
              <div style={{ ...CARD, display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 0 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>ℹ</span>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Privacy note:</span> The receiving party will see the evaluation result and checklist, but NOT the underlying evidence or raw data.
                </div>
              </div>
            </> : presetType === 'full' ? <>
              {/* ── Full disclosure preset: summary card + collapsible ── */}
              <div style={SEC}>Data fields</div>
              <div style={CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-bright)', flexShrink: 0 }}>✓</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-bright)' }}>Full Disclosure</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>All data fields will be disclosed to {receiverName}</div>
                  </div>
                </div>
              </div>

              <div onClick={() => setFullFieldsExpanded(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', marginBottom: 4, transition: 'background .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', ...MONO, fontWeight: 700, flex: 1 }}>VIEW ALL FIELDS ({FIELD_GROUPS.length} categories)</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fullFieldsExpanded ? '▴' : '▾'}</span>
              </div>
              {fullFieldsExpanded && <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4 }}>
                {FIELD_GROUPS.map(g => (
                  <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>✓</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.label}</span>
                  </div>
                ))}
              </div>}
            </> : <>
              {/* ── Normal mode: type selection + field content ── */}
              <div style={SEC}>What I want to disclose</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {[
                  { key: 'full', color: 'var(--accent-blue)', label: 'Full Disclosure', desc: 'Share complete supply chain data with this buyer' },
                  { key: 'selective', color: 'var(--accent-amber)', label: 'Selective Disclosure', desc: 'Choose which data fields to disclose' },
                  { key: 'derivative', color: 'var(--accent-green)', label: 'Derivative Disclosure', desc: 'Share evaluation results (POE) without raw data' },
                ].map(dt => {
                  const sel = wiz.disclosureType === dt.key;
                  return <div key={dt.key} onClick={() => setF('disclosureType', dt.key)}
                    style={{
                      padding: '16px 20px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${sel ? dt.color : 'var(--border)'}`,
                      background: sel ? `color-mix(in srgb, ${dt.color} 3%, transparent)` : 'transparent',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = `color-mix(in srgb, ${dt.color} 27%, transparent)`; } }}
                    onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = 'var(--border)'; } }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dt.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: sel ? 'var(--text-bright)' : 'var(--text-secondary)' }}>{dt.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, paddingLeft: 20 }}>
                      {dt.desc}
                    </div>
                  </div>;
                })}
              </div>

              {/* Conditional content per disclosure type */}
              {wiz.disclosureType === 'full' && (
                <div style={CARD}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-bright)', flexShrink: 0 }}>✓</div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>All data fields will be disclosed to {receiverName}. The receiving party will have complete visibility into this asset's evidence, specifications, and supplier identity.</span>
                  </div>
                </div>
              )}

              {wiz.disclosureType === 'selective' && <>
                <div style={{ ...SEC, marginTop: 0 }}>Select data fields</div>
                <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                  {FIELD_GROUPS.map(g => {
                    const isLocked = LOCKED_KEYS.has(g.key);
                    const groupChecked = g.items.map((_, idx) => checkedItems.has(`${g.key}:${idx}`));
                    const checkedCount = groupChecked.filter(Boolean).length;
                    const allChecked = checkedCount === g.items.length;
                    return <div key={g.key} style={{ ...CARD, marginBottom: 10, padding: 14 }}>
                      {/* Group header */}
                      <div onClick={() => toggleGroup(g.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: isLocked ? 'default' : 'pointer' }}>
                        {!isLocked && <Chk checked={allChecked} />}
                        <span style={{ fontSize: 11, fontWeight: 600, color: isLocked ? 'var(--text-secondary)' : 'var(--text-primary)', ...MONO, flex: 1 }}>{g.label}</span>
                        {isLocked && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-amber) 9%, transparent)', color: 'var(--accent-amber)', ...MONO, fontWeight: 600 }}>Required</span>}
                        {!isLocked && checkedCount > 0 && <span style={{ fontSize: 9, color: 'var(--accent-indigo)', ...MONO }}>{checkedCount} selected</span>}
                      </div>
                      {/* Items */}
                      {g.items.map((item, idx) => (
                        <div key={idx} onClick={() => toggleItem(g.key, idx)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0 3px 4px', cursor: isLocked ? 'default' : 'pointer' }}>
                          {isLocked
                            ? <span style={{ fontSize: 10, color: 'var(--accent-green)', flexShrink: 0 }}>✓</span>
                            : <Chk checked={checkedItems.has(`${g.key}:${idx}`)} size={12} />
                          }
                          <span style={{ fontSize: 11, color: isLocked ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>{item}</span>
                        </div>
                      ))}
                    </div>;
                  })}
                </div>
              </>}

              {wiz.disclosureType === 'derivative' && <>
                <div style={CARD}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, color: 'var(--accent-green)' }}>✓</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)' }}>Pass</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    This derivative disclosure will share the evaluation results and audit status, not the underlying product specifications.
                  </div>
                </div>
                {firstAsset ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', ...MONO, marginTop: 8 }}>
                    Based on evaluation: eval-auto-{firstAsset.id.slice(-4)} · Feb 2026 · Pass
                  </div>
                ) : (
                  <div style={{ ...CARD, marginTop: 8, fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.5, background: 'color-mix(in srgb, var(--accent-amber-bg) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)' }}>
                    No evaluation found for this asset. A derivative disclosure requires a completed evaluation. Run an evaluation first.
                  </div>
                )}
                {/* Privacy note */}
                <div style={{ ...CARD, marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>ℹ</span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Privacy note:</span> The receiving party will see the evaluation result and checklist, but NOT the underlying evidence or raw data.
                  </div>
                </div>
              </>}
            </>}
          </>}

          {/* ──────── STEP 3: Duration & Conditions ──────── */}
          {wiz.step === 3 && <>
            <div style={SEC}>Duration</div>
            <div style={CARD}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', ...MONO, marginBottom: 6 }}>EXPIRATION DATE</div>
                  <input type="date" value={wiz.expirationDate} onChange={e => setF('expirationDate', e.target.value)}
                    style={{ ...INPUT, colorScheme: 'dark' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', ...MONO, marginBottom: 6 }}>NUMBER OF USERS</div>
                  <input value={wiz.maxUsers} onChange={e => setF('maxUsers', e.target.value)} className="dim-ph"
                    style={INPUT}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} />
                </div>
              </div>
            </div>

            <div style={SEC}>Usage restrictions</div>
            <div style={CARD}>
              {RESTRICTIONS.map(r => (
                <div key={r.key}>
                  <div onClick={() => toggleRestriction(r.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                    <Chk checked={wiz.restrictions.includes(r.key)} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{r.label}</span>
                  </div>
                  {r.key === 'other' && wiz.restrictions.includes('other') && <input value={wiz.otherRestriction} onChange={e => setF('otherRestriction', e.target.value)}
                    placeholder="Specify restriction…" className="dim-ph"
                    style={{ ...INPUT, marginLeft: 22, width: 'calc(100% - 22px)', marginTop: 4 }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} />}
                </div>
              ))}
              {wiz.restrictions.length === 0 && <div style={{ padding: 12, background: 'color-mix(in srgb, var(--accent-amber-bg) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)', borderRadius: 6, marginTop: 8, fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.5 }}>
                If all usage restrictions are unchecked, the receiving party will have unrestricted use of disclosed data within the SDA scope.
              </div>}
            </div>

            <div style={SEC}>Pre-sign</div>
            <div style={CARD}>
              <div onClick={() => setF('preSign', !wiz.preSign)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <Chk checked={wiz.preSign} />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>Yes, I want to pre-sign now</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                    Pre-signing means this SDA becomes active immediately upon the receiving party's acceptance, without requiring your additional signature.
                  </div>
                </div>
              </div>
            </div>
          </>}

          {/* ──────── STEP 4: Review & Submit ──────── */}
          {wiz.step === 4 && <>
            {/* Audience card */}
            <div style={CARD}>
              <div style={{ fontSize: 10, ...MONO, color: 'var(--text-muted)', letterSpacing: '.06em', fontWeight: 700, marginBottom: 12 }}>AUDIENCE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 9, ...MONO, color: 'var(--text-muted)', marginBottom: 4 }}>RECEIVING PARTY</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{wiz.audienceType === 'anyone' ? 'Anyone' : wiz.receivers.join(', ') || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, ...MONO, color: 'var(--text-muted)', marginBottom: 4 }}>APPROVAL MODE</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{wiz.disclosureApproval === 'review' ? 'Manual approval' : 'Auto-approve'}</div>
                </div>
              </div>
              {/* Asset row */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 9, ...MONO, color: 'var(--text-muted)', marginBottom: 6 }}>ASSET</div>
                {wiz.selectedAssets.map(id => {
                  const a = assetById[id];
                  const tk = a ? (TT[a.type] || TT.component) : null;
                  return <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {tk && <div style={{ width: 8, height: 8, borderRadius: '50%', background: tk.border, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a?.label || id}</span>
                  </div>;
                })}
              </div>
            </div>

            {/* Data fields card */}
            <div style={CARD}>
              <div style={{ fontSize: 10, ...MONO, color: 'var(--text-muted)', letterSpacing: '.06em', fontWeight: 700, marginBottom: 10 }}>DATA FIELDS</div>
              {wiz.disclosureType === 'full' && <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Full disclosure — all data fields</div>}
              {wiz.disclosureType === 'selective' && <div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>{disclosedFields.length} of {FIELD_GROUPS.length} categories disclosed</div>
                {FIELD_GROUPS.filter(g => disclosedFields.includes(g.key)).map(g => {
                  const count = g.items.filter((_, idx) => checkedItems.has(`${g.key}:${idx}`)).length;
                  return <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                    <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>✓</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.label}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', ...MONO }}>({count})</span>
                  </div>;
                })}
                {redactedFields.length > 0 && <div style={{ fontSize: 10, color: 'var(--accent-amber)', ...MONO, marginTop: 6 }}>{redactedFields.length} categories redacted</div>}
              </div>}
              {wiz.disclosureType === 'derivative' && <div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Derivative — evaluation results only</div>
                {wiz.selectedEvaluation && <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Checklist:</span> <span style={{ color: 'var(--text-secondary)' }}>{wiz.selectedEvaluation.checklist}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Result:</span> <span style={{ color: wiz.selectedEvaluation.overallResult === 'pass' ? 'var(--accent-green)' : 'var(--accent-amber)' }}>{wiz.selectedEvaluation.overallResult === 'pass' ? 'PASS' : 'FAIL'}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Requirements:</span> <span style={{ color: 'var(--text-secondary)' }}>{wiz.selectedEvaluation.requirementCount}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Eval ref:</span> <span style={{ color: 'var(--text-secondary)', ...MONO }}>{wiz.selectedEvaluation.id}</span></div>
                </div>}
                {!wiz.selectedEvaluation && firstAsset && <div style={{ fontSize: 10, color: 'var(--text-muted)', ...MONO, marginTop: 4 }}>Eval ref: eval-auto-{firstAsset.id.slice(-4)}</div>}
              </div>}
            </div>

            {/* Duration & conditions card */}
            <div style={CARD}>
              <div style={{ fontSize: 10, ...MONO, color: 'var(--text-muted)', letterSpacing: '.06em', fontWeight: 700, marginBottom: 10 }}>DURATION & CONDITIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, ...MONO, color: 'var(--text-muted)', marginBottom: 4 }}>EXPIRATION</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{wiz.expirationDate || 'No expiry'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, ...MONO, color: 'var(--text-muted)', marginBottom: 4 }}>USERS</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{wiz.maxUsers}</div>
                </div>
              </div>
              {wiz.restrictions.length > 0 && <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {wiz.restrictions.map(r => {
                  const label = r === 'other' ? (wiz.otherRestriction || 'Other') : RESTRICTIONS.find(x => x.key === r)?.label || r;
                  return <div key={r} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 0' }}>• {label}</div>;
                })}
              </div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Pre-sign: {wiz.preSign ? 'Yes' : 'No'}</div>
            </div>

            {/* Credit cost card */}
            <div style={CARD}>
              <div style={{ fontSize: 10, ...MONO, color: 'var(--text-muted)', letterSpacing: '.06em', fontWeight: 700, marginBottom: 10 }}>CREDIT COST</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)', ...MONO, marginBottom: 6 }}>{SDA_COST} credits</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', ...MONO }}>Your balance: {credits ?? 0} credits</div>
              {(credits || 0) >= SDA_COST
                ? <div style={{ fontSize: 11, color: 'var(--accent-green)', ...MONO, marginTop: 4 }}>Remaining after publish: {(credits || 0) - SDA_COST} credits</div>
                : <div style={{ fontSize: 11, color: 'var(--accent-red)', ...MONO, marginTop: 6, fontWeight: 600 }}>⚠ Insufficient credits. You need {SDA_COST - (credits || 0)} more credits to publish this SDA.</div>
              }
            </div>
          </>}

        </div>

        {/* ═══ Footer ═══ */}
        <div style={{ padding: '16px 24px 20px', flexShrink: 0, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button onClick={onClose}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-bright)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: '8px 0', fontFamily: "var(--font-display)" }}>Cancel</button>
            {wiz.step > 1 && <button onClick={() => setF('step', wiz.step - 1)}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-bright)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: '8px 0', fontFamily: "var(--font-display)" }}>‹ Back</button>}
          </div>
          <button
            onClick={wiz.step === 4 ? handleSubmit : () => { if (canNext) setF('step', wiz.step + 1); }}
            disabled={!canNext}
            onMouseEnter={e => { if (canNext) e.currentTarget.style.background = 'var(--accent-indigo-dim)'; }}
            onMouseLeave={e => { if (canNext) e.currentTarget.style.background = 'var(--accent-indigo)'; }}
            style={{
              padding: '12px 24px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              fontFamily: "var(--font-display)",
              background: 'var(--accent-indigo)',
              color: 'var(--text-bright)', cursor: canNext ? 'pointer' : 'not-allowed',
              opacity: canNext ? 1 : 0.4,
              transition: 'opacity .15s, background .15s',
            }}>{wiz.step === 4 ? 'Submit Agreement' : 'Next ›'}</button>
        </div>

      </div>
    </div>
  );
}
