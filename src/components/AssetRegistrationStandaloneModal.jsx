import { useState, useRef } from 'react';
import SvgMark from './SvgMark';

const SEC = { fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '.08em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' };
const CARD = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 };
const INPUT = { width: '100%', padding: '10px 14px', fontSize: 13, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: "var(--font-display)", transition: 'border-color .15s' };
const ASSET_TYPES = ['Assembly', 'Component', 'Process', 'Material', 'Raw Source'];
const TYPE_MAP = { 'Component': 'component', 'Material': 'material', 'Raw Source': 'rawsource', 'Assembly': 'assembly', 'Process': 'process' };

const MOCK_DOCS = [
  { name: 'Certificate_of_Conformance.pdf', type: 'application/pdf', size: '2.4 MB' },
  { name: 'Material_Test_Report.pdf', type: 'application/pdf', size: '1.8 MB' },
  { name: 'Quality_Inspection_Record.pdf', type: 'application/pdf', size: '3.1 MB' },
  { name: 'Calibration_Certificate.pdf', type: 'application/pdf', size: '1.2 MB' },
];

export default function AssetRegistrationStandaloneModal({ onClose, onRegister }) {
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'evidence' | 'confirm'
  const [evidence, setEvidence] = useState([]);
  const [wantOffer, setWantOffer] = useState(true);
  const [offerTypes, setOfferTypes] = useState(['full']);
  const [offerDiscoverable, setOfferDiscoverable] = useState(true);
  const backdropRef = useRef(null);
  const mockDocIdx = useRef(0);
  const canSubmit = name.trim() && assetType && location.trim();

  const assetData = { name: name.trim(), type: TYPE_MAP[assetType] || 'component', partNumber: partNumber.trim() || undefined, description: desc.trim() || undefined, location: location.trim() };

  const handleContinueToEvidence = () => {
    if (!canSubmit) { setShowErrors(true); return; }
    setStep('evidence');
  };

  const handleAddDoc = () => {
    const doc = MOCK_DOCS[mockDocIdx.current % MOCK_DOCS.length];
    mockDocIdx.current++;
    setEvidence(prev => [...prev, { id: 'ev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), ...doc }]);
  };

  const handleRemoveDoc = (id) => {
    setEvidence(prev => prev.filter(e => e.id !== id));
  };

  const handleConfirm = () => {
    if (onRegister) onRegister({
      ...assetData,
      evidence,
      disclosureOffer: wantOffer && offerTypes.length > 0 ? { types: offerTypes, discoverable: offerDiscoverable } : null,
    });
  };

  const stepLabel = step === 'form' ? 'Step 1 of 3 — Asset Details' : step === 'evidence' ? 'Step 2 of 3 — Evidence & Offer' : 'Step 3 of 3 — Confirmation';

  return <div ref={backdropRef}
    onClick={e => { if (e.target === backdropRef.current && onClose) onClose(); }}
    style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'pfade .2s ease',
    }}
  >
    <div style={{
      width: 640, maxWidth: '90vw', maxHeight: '80vh',
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      boxShadow: '0 16px 48px rgba(0,0,0,.6)',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>Register New Asset</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Create an on-chain identity for a new asset</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >&times;</button>
        </div>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 12 }}>{stepLabel}</div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>

        {/* ── STEP 1: FORM ── */}
        {step === 'form' && <>
          <div style={SEC}>ASSET DETAILS</div>
          <div style={CARD}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Asset Name <span style={{ color: 'var(--accent-red)' }}>*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., MOSFET Module"
                style={{ ...INPUT, borderColor: showErrors && !name.trim() ? 'var(--accent-red)' : undefined }} onFocus={e => { e.target.style.borderColor = 'var(--accent-indigo)'; }} onBlur={e => { e.target.style.borderColor = showErrors && !name.trim() ? 'var(--accent-red)' : 'var(--border)'; }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: showErrors && !assetType ? 'var(--accent-red)' : 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Asset Type <span style={{ color: 'var(--accent-red)' }}>*</span></label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ASSET_TYPES.map(t => (
                  <button key={t} onClick={() => setAssetType(t)} style={{
                    padding: '7px 10px', fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                    background: assetType === t ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)' : 'transparent',
                    border: `1px solid ${assetType === t ? 'var(--accent-indigo)' : 'var(--border)'}`,
                    borderRadius: 5, color: assetType === t ? 'var(--accent-indigo-text)' : 'var(--text-tertiary)', cursor: 'pointer',
                    transition: 'border-color .15s, background .15s',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}><svg width={12} height={12}><SvgMark type={TYPE_MAP[t]} cx={6} cy={6} r={4} /></svg>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Part Number <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input value={partNumber} onChange={e => setPartNumber(e.target.value)} placeholder="e.g., CW-MOS-7700"
                style={INPUT} onFocus={e => { e.target.style.borderColor = 'var(--accent-indigo)'; }} onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description of this asset..."
                rows={3} style={{ ...INPUT, resize: 'vertical' }} onFocus={e => { e.target.style.borderColor = 'var(--accent-indigo)'; }} onBlur={e => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>
          </div>

          <div style={SEC}>LOCATION</div>
          <div style={CARD}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Manufacturing Location <span style={{ color: 'var(--accent-red)' }}>*</span></label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., Toronto, Canada"
                style={{ ...INPUT, borderColor: showErrors && !location.trim() ? 'var(--accent-red)' : undefined }} onFocus={e => { e.target.style.borderColor = 'var(--accent-indigo)'; }} onBlur={e => { e.target.style.borderColor = showErrors && !location.trim() ? 'var(--accent-red)' : 'var(--border)'; }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>Required for compliance verification (ITAR, export controls)</div>
            </div>
          </div>
        </>}

        {/* ── STEP 2: EVIDENCE & OFFER ── */}
        {step === 'evidence' && <>
          <div style={SEC}>SUPPORTING EVIDENCE</div>
          <div style={CARD}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.5 }}>
              Attach supporting documents for <strong style={{ color: 'var(--text-secondary)' }}>{name.trim()}</strong>. These are stored in qualified storage with on-chain hash references.
            </div>

            {evidence.length > 0 && <div style={{ marginBottom: 12 }}>
              {evidence.map(doc => <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                background: 'var(--bg-deep)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', borderRadius: 5, marginBottom: 4,
              }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>&#128206;</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{doc.type} · {doc.size}</div>
                </div>
                <button onClick={() => handleRemoveDoc(doc.id)} style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1,
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >&times;</button>
              </div>)}
            </div>}

            <button onClick={handleAddDoc} style={{
              width: '100%', height: 36, padding: 0,
              background: 'var(--bg-surface)', border: '1px dashed #1e2433', borderRadius: 5,
              color: 'var(--accent-indigo)', fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
              cursor: 'pointer', transition: 'border-color .15s, background .15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 3%, transparent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
            >+ Add Document</button>
            <div style={{ fontSize: 10, color: 'var(--border-hover)', marginTop: 8, lineHeight: 1.5 }}>Documents stored in qualified storage. On-chain record confirms existence and timestamp.</div>
          </div>

          <div style={SEC}>DISCLOSURE OFFER</div>
          <div style={CARD}>
            <div onClick={() => setWantOffer(prev => !prev)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer',
              border: '1px solid var(--border)', borderRadius: 6, marginBottom: wantOffer ? 14 : 0, transition: 'all .15s',
              background: wantOffer ? 'color-mix(in srgb, var(--accent-green) 3%, transparent)' : 'transparent',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: `1px solid ${wantOffer ? 'var(--accent-green)' : 'var(--border-hover)'}`,
                background: wantOffer ? 'color-mix(in srgb, var(--accent-green) 9%, transparent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: 'var(--accent-green)', fontWeight: 700,
              }}>{wantOffer ? '\u2713' : ''}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: wantOffer ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>Make this asset discoverable to buyers</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Buyers can find and request disclosure via the Asset Directory</div>
              </div>
            </div>

            {wantOffer && <>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, letterSpacing: '.06em' }}>DISCLOSURE TYPES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {[{ key: 'full', label: 'Full', desc: 'All data fields', color: 'var(--accent-sda-full)' }, { key: 'selective', label: 'Selective', desc: 'Specific fields only', color: 'var(--accent-amber)' }, { key: 'derivative', label: 'Derivative', desc: 'Eval results only', color: 'var(--accent-green)' }].map(dt => {
                  const checked = offerTypes.includes(dt.key);
                  return <div key={dt.key} onClick={() => {
                    setOfferTypes(prev => checked ? prev.filter(k => k !== dt.key) : [...prev, dt.key]);
                  }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                      background: checked ? `color-mix(in srgb, ${dt.color} 3%, transparent)` : 'transparent',
                      border: `1px solid color-mix(in srgb, ${checked ? `${dt.color} 27%, transparent)` : 'var(--border)'}`,
                      borderRadius: 4, cursor: 'pointer', transition: 'all .15s',
                    }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                      border: `1px solid ${checked ? dt.color : 'var(--border-hover)'}`,
                      background: checked ? `color-mix(in srgb, ${dt.color} 9%, transparent)` : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: dt.color,
                    }}>{checked ? '\u2713' : ''}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: checked ? dt.color : 'var(--text-tertiary)' }}>{dt.label}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 6 }}>{dt.desc}</span>
                    </div>
                  </div>;
                })}
              </div>

              <div onClick={() => setOfferDiscoverable(prev => !prev)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                  border: `1px solid ${offerDiscoverable ? 'var(--accent-green)' : 'var(--border-hover)'}`,
                  background: offerDiscoverable ? 'color-mix(in srgb, var(--accent-green) 9%, transparent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, color: 'var(--accent-green)',
                }}>{offerDiscoverable ? '\u2713' : ''}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: offerDiscoverable ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>Discoverable in Asset Directory</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Other participants can find and request this offer</div>
                </div>
              </div>
            </>}
          </div>
        </>}

        {/* ── STEP 3: CONFIRMATION ── */}
        {step === 'confirm' && <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 16px' }}>
            <svg width={48} height={48} viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16 }}>
              <circle cx={24} cy={24} r={22} stroke="var(--accent-amber)" strokeWidth={2} fill="color-mix(in srgb, var(--accent-amber) 6%, transparent)" />
              <rect x={22} y={14} width={4} height={14} rx={2} fill="var(--accent-amber)" />
              <circle cx={24} cy={33} r={2.5} fill="var(--accent-amber)" />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 6 }}>Confirm On-Chain Registration</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, textAlign: 'center', maxWidth: 420 }}>
              This action is immutable. Once registered, this asset's identity will be permanently recorded on-chain.
            </div>
          </div>

          {/* Summary card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            {[
              { label: 'ASSET NAME', value: name.trim() },
              { label: 'ASSET TYPE', value: assetType, icon: true },
              { label: 'PART NUMBER', value: partNumber.trim() || '\u2014' },
              { label: 'LOCATION', value: location.trim() },
              { label: 'DESCRIPTION', value: desc.trim() || '\u2014' },
              { label: 'EVIDENCE', value: evidence.length > 0 ? `${evidence.length} document${evidence.length !== 1 ? 's' : ''} attached` : 'None' },
              { label: 'DISCLOSURE', value: wantOffer && offerTypes.length > 0 ? offerTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') + (offerDiscoverable ? ' (discoverable)' : '') : 'No offer' },
            ].map((row, i) => <div key={i} style={{
              display: 'flex', alignItems: 'center', padding: '8px 0',
              borderBottom: i < 6 ? '1px solid var(--border)22' : 'none',
            }}>
              <div style={{ width: 120, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{row.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {row.icon && <svg width={12} height={12}><SvgMark type={TYPE_MAP[assetType]} cx={6} cy={6} r={4} /></svg>}
                {row.value}
              </div>
            </div>)}
          </div>

          {/* Warning bar */}
          <div style={{
            background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)', borderRadius: 6,
            padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>&#9888;</span>
            <span style={{ fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.5 }}>
              This action is permanent and will be recorded on-chain. It cannot be undone.
            </span>
          </div>

          {/* Confirm buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button onClick={() => setStep('evidence')} style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 20px', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer',
              fontFamily: "var(--font-display)",
              transition: 'border-color .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >&larr; Back</button>
            <button onClick={handleConfirm} style={{
              background: 'var(--accent-amber)', border: 'none', borderRadius: 8,
              padding: '10px 20px', color: 'var(--text-bright)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: "var(--font-display)",
              transition: 'background .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-amber)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-amber)'; }}
            >Confirm & Register</button>
          </div>
        </>}

      </div>

      {/* Footer — steps 1 and 2 only */}
      {step === 'form' && <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer',
          fontFamily: "var(--font-display)", padding: '8px 16px',
        }}>Cancel</button>
        <button onClick={handleContinueToEvidence} style={{
          padding: '14px 28px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
          fontFamily: "var(--font-display)", minHeight: 44,
          background: 'var(--accent-indigo)', color: 'var(--text-bright)', opacity: canSubmit ? 1 : .4, cursor: canSubmit ? 'pointer' : 'default',
          transition: 'opacity .15s, background .15s',
        }}
          onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = 'var(--accent-indigo-dim)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-indigo)'; }}
        >Continue &rarr;</button>
      </div>}

      {step === 'evidence' && <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => setStep('form')} style={{
          background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer',
          fontFamily: "var(--font-display)", padding: '8px 16px',
        }}>&larr; Back</button>
        <button onClick={() => setStep('confirm')} style={{
          padding: '14px 28px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
          fontFamily: "var(--font-display)", minHeight: 44,
          background: 'var(--accent-indigo)', color: 'var(--text-bright)', cursor: 'pointer',
          transition: 'opacity .15s, background .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-indigo-dim)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-indigo)'; }}
        >Continue to Confirmation &rarr;</button>
      </div>}
    </div>
  </div>;
}
