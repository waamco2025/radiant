import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getVerticalConfig } from '../data/verticals';
import { TT, VERTICALS } from '../data/tokens';

const SECTION_LABEL = {
  fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)',
  letterSpacing: '.08em', fontWeight: 700, marginBottom: 8,
};

const SDA_TERMS = [
  'Supplier may view limited downstream context (SDA Level 3)',
  'Attestation data shared only with requesting network owner',
  'Asset identity recorded on-chain upon registration',
  'Supplier retains ownership of upstream sub-tier data',
];

const DISCLOSURE_TYPES = [
  { key: 'full', color: 'var(--accent-blue)', label: 'Full Disclosure', desc: 'Share complete supply chain data with this buyer', help: 'All supply chain data fields are shared with the buyer.' },
  { key: 'selective', color: 'var(--accent-amber)', label: 'Selective Disclosure', desc: 'Choose which data fields to disclose', help: 'You choose which fields to share and which to redact.' },
  { key: 'derivative', color: 'var(--accent-green)', label: 'Derivative Disclosure', desc: 'Share evaluation results (POE) without raw data', help: 'Only evaluation results (Proof of Evaluation) are shared. Raw data stays private.' },
];

const STATUS_COLORS = { pending: 'var(--accent-amber)', accepted: 'var(--accent-green)', expired: 'var(--text-muted)', declined: 'var(--accent-red)' };

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

export default function InvitationModal({ invitation, onAccept, onDecline, onClose, customerData, chainAsset, onCreateDisclosure }) {
  const [declining, setDeclining] = useState(false);
  const [phase, setPhase] = useState('detail'); // 'detail' | 'type-select'
  const [sdaTermsOpen, setSdaTermsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const backdropRef = useRef(null);

  const vertConfig = useMemo(
    () => invitation?.verticalKey ? getVerticalConfig(invitation.verticalKey) : null,
    [invitation?.verticalKey]
  );

  const vertDisplay = useMemo(() => {
    if (!invitation?.verticalKey) return null;
    return VERTICALS.find(v => v.id === invitation.verticalKey) || null;
  }, [invitation?.verticalKey]);

  const requirements = vertConfig?.inviteRequirements || [];
  const isPending = invitation?.status === 'pending';

  /* Reset phase when invitation changes */
  useEffect(() => { setPhase('detail'); setDeclining(false); setSdaTermsOpen(false); setHelpOpen(false); }, [invitation?.id]);

  /* Auto-transition to type-select when chainAsset arrives (after asset registration) */
  useEffect(() => {
    if (chainAsset && phase === 'detail') setPhase('type-select');
  }, [chainAsset]);

  const handleDecline = useCallback(() => {
    if (!declining) { setDeclining(true); return; }
    onDecline(invitation.id);
  }, [declining, invitation?.id, onDecline]);

  /* Detect existing asset via targetAssetId */
  const existingAsset = useMemo(() => {
    if (!invitation?.targetAssetId || !customerData) return null;
    for (const cd of customerData) {
      for (const a of (cd.assets || [])) {
        if (a.node.id === invitation.targetAssetId) return a.node;
      }
    }
    return null;
  }, [invitation?.targetAssetId, customerData]);

  /* The asset for type-select is either the existing one or the newly registered one */
  const activeAsset = existingAsset || chainAsset;

  if (!invitation) return null;

  const statusColor = STATUS_COLORS[invitation.status] || 'var(--text-muted)';

  /* ═══ Type Selection Phase ═══ */
  const renderTypeSelect = () => {
    if (!activeAsset) return null;
    const hasEvals = activeAsset.evaluations?.length > 0;
    const tk = TT[activeAsset.type] || TT.component;

    return <>
      {/* Header */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
              Choose Disclosure Type
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Select how you want to disclose <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeAsset.name}</span> to <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invitation.customer}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >&times;</button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        {/* Asset summary card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: tk.border, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{activeAsset.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tk.label}{activeAsset.id ? ` · ${activeAsset.id}` : ''}</div>
          </div>
          {hasEvals && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 3, background: 'var(--accent-green-bg)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', color: 'var(--accent-green)', fontFamily: 'monospace', fontWeight: 600 }}>POE ✓</span>}
        </div>

        {/* Disclosure type cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DISCLOSURE_TYPES.map(dt => {
            const isDerivative = dt.key === 'derivative';
            const disabled = isDerivative && !hasEvals;
            const evalCount = activeAsset.evaluations?.length || 0;

            return <div key={dt.key}
              onClick={() => {
                if (disabled) return;
                const latestEval = isDerivative ? activeAsset.evaluations[activeAsset.evaluations.length - 1] : null;
                onCreateDisclosure(invitation, activeAsset, dt.key, latestEval);
              }}
              style={{
                padding: '16px 20px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
                border: `1px solid ${disabled ? 'var(--border)' : `color-mix(in srgb, ${dt.color} 27%, transparent)`}`,
                background: disabled ? 'var(--bg-deep)' : 'transparent',
                opacity: disabled ? 0.5 : 1,
                transition: 'border-color .15s, background .15s',
              }}
              onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = dt.color; e.currentTarget.style.background = `color-mix(in srgb, ${dt.color} 3%, transparent)`; } }}
              onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = `color-mix(in srgb, ${dt.color} 27%, transparent)`; e.currentTarget.style.background = 'transparent'; } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: disabled ? 'var(--border-hover)' : dt.color, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: disabled ? 'var(--text-muted)' : 'var(--text-bright)' }}>{dt.label}</span>
              </div>
              <div style={{ fontSize: 12, color: disabled ? 'var(--border-hover)' : 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: 20 }}>
                {dt.desc}
              </div>
              {isDerivative && <div style={{ fontSize: 10, fontFamily: 'monospace', color: disabled ? 'var(--border-hover)' : 'var(--accent-green)', marginTop: 6, paddingLeft: 20 }}>
                {hasEvals
                  ? `${evalCount} POE${evalCount > 1 ? 's' : ''} available`
                  : 'Run an evaluation on this asset first, then return here to create a derivative disclosure.'}
              </div>}
            </div>;
          })}
        </div>

        {/* What are these? collapsible help */}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setHelpOpen(!helpOpen)} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 600,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <span style={{ fontSize: 8, transition: 'transform .15s', transform: helpOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
            What are these?
          </button>
          {helpOpen && <div style={{ marginTop: 8, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
            {DISCLOSURE_TYPES.map(dt => (
              <div key={dt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dt.color, flexShrink: 0, marginTop: 5 }} />
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{dt.label}: </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{dt.help}</span>
                </div>
              </div>
            ))}
          </div>}
        </div>
      </div>

      {/* Actions row */}
      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        {existingAsset && !chainAsset
          ? <button onClick={() => setPhase('detail')}
              style={{ padding: '9px 20px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'monospace' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >&larr; Back to Details</button>
          : <div />
        }
        <button onClick={onClose}
          style={{ padding: '9px 20px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-tertiary)', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >Cancel</button>
      </div>
    </>;
  };

  /* ═══ Detail Phase ═══ */
  const renderDetail = () => {
    return <>
      {/* Header */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            {/* Status pill + timestamp row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.06em',
                color: statusColor, textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 3,
                background: `color-mix(in srgb, ${statusColor} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${statusColor} 20%, transparent)`,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
                {invitation.status}
              </span>
              {invitation.date && <span
                style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}
                title={invitation.date}
              >{relativeTime(invitation.date)}</span>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
              Invitation from {invitation.customer}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {existingAsset
                ? <>Requesting disclosure for <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invitation.asset}</span></>
                : <>Requesting you register <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invitation.asset}</span> as an upstream supplier asset</>
              }
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >&times;</button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
        {/* Message from buyer */}
        <div style={{ marginBottom: 20 }}>
          <div style={SECTION_LABEL}>MESSAGE FROM BUYER</div>
          <div style={{
            padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
            fontSize: 12, color: invitation.message ? 'var(--text-secondary)' : 'var(--border-hover)', lineHeight: 1.5, fontStyle: 'italic',
          }}>
            {invitation.message ? `"${invitation.message}"` : 'No message included'}
          </div>
        </div>

        {/* Asset details — 2-column grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={SECTION_LABEL}>ASSET DETAILS</div>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>ASSET</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{invitation.asset}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>PART NO.</div>
                <div style={{ fontSize: 13, color: invitation.partNumber ? 'var(--text-primary)' : 'var(--border-hover)', fontStyle: invitation.partNumber ? 'normal' : 'italic' }}>{invitation.partNumber || 'Not specified'}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>LOCATION</div>
                <div style={{ fontSize: 13, color: invitation.location ? 'var(--text-primary)' : 'var(--border-hover)', fontStyle: invitation.location ? 'normal' : 'italic' }}>{invitation.location || 'Not specified'}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>DATE RECEIVED</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{invitation.date}</div>
              </div>
            </div>
            {invitation.description && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>DESCRIPTION</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{invitation.description}</div>
            </div>}
          </div>
        </div>

        {/* Network context */}
        <div style={{ marginBottom: 20 }}>
          <div style={SECTION_LABEL}>NETWORK CONTEXT</div>
          <div style={{
            padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            {vertDisplay && <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{vertDisplay.icon}</span>}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You're being invited to supply <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invitation.asset}</span> into <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invitation.customer}</span>'s <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{vertConfig?.name || invitation.verticalKey}</span> network.
            </div>
          </div>
        </div>

        {/* Existing asset info card */}
        {existingAsset && isPending && (() => {
          const tk = TT[existingAsset.type] || TT.component;
          const hasEvals = existingAsset.evaluations?.length > 0;
          const attCount = existingAsset.rawAttestations?.length || 0;
          return <div style={{ marginBottom: 20 }}>
            <div style={SECTION_LABEL}>EXISTING ASSET</div>
            <div style={{
              padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: tk.border, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{existingAsset.name}</span>
                {hasEvals && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-green-bg)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', color: 'var(--accent-green)', fontFamily: 'monospace', fontWeight: 600, marginLeft: 'auto' }}>POE ✓</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                <span>{tk.label}</span>
                <span>{attCount} attestation{attCount !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 8 }}>
                This asset is already in your network. Choose a disclosure type for {invitation.customer}.
              </div>
            </div>
          </div>;
        })()}

        {/* SDA Terms — collapsible */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setSdaTermsOpen(!sdaTermsOpen)} style={{
            ...SECTION_LABEL, marginBottom: sdaTermsOpen ? 8 : 0,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <span style={{ fontSize: 8, transition: 'transform .15s', transform: sdaTermsOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
            SELECTIVE DISCLOSURE TERMS
          </button>
          {sdaTermsOpen && <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
          }}>
            {SDA_TERMS.map((term, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}>
                <span style={{ fontSize: 10, color: 'var(--accent-green)', flexShrink: 0, marginTop: 2 }}>✓</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{term}</span>
              </div>
            ))}
          </div>}
        </div>

        {/* Offered visibility */}
        <div style={{ marginBottom: 20 }}>
          <div style={SECTION_LABEL}>OFFERED VISIBILITY</div>
          <div style={{
            padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
            fontSize: 12, color: 'var(--border-hover)', lineHeight: 1.5, fontStyle: 'italic',
          }}>
            The buyer will share limited downstream context (SDA Level 3) once disclosure is active. Visibility scope will be shown here in a future update.
          </div>
        </div>

        {/* Required Attestations (new asset path only) */}
        {!existingAsset && requirements.length > 0 && <div style={{ marginBottom: 20 }}>
          <div style={SECTION_LABEL}>REQUIRED ATTESTATIONS</div>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
          }}>
            {requirements.map((req, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', flexShrink: 0,
                  border: '1px solid var(--border-hover)',
                }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{req}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 8 }}>
              These attestations will need to be provided after asset registration.
            </div>
          </div>
        </div>}

        {/* Accepted state */}
        {invitation.status === 'accepted' && <div style={{
          padding: '12px 16px', background: 'var(--accent-green-bg)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', borderRadius: 8,
          fontSize: 12, color: 'var(--accent-green)', fontWeight: 600,
        }}>
          This invitation has been accepted.
        </div>}
      </div>

      {/* Actions row */}
      {isPending && <div style={{
        padding: '12px 24px 20px', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'flex-end', gap: 10,
      }}>
        {declining ? (
          <>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--accent-amber)', lineHeight: 1.4, alignSelf: 'center' }}>
              Are you sure? This invitation will be permanently declined.
            </div>
            <button onClick={() => setDeclining(false)}
              style={{
                padding: '9px 20px', fontSize: 12, background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-tertiary)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >Cancel</button>
            <button onClick={handleDecline}
              style={{
                padding: '9px 20px', fontSize: 12, fontWeight: 600,
                background: 'var(--accent-red)', border: 'none', borderRadius: 6,
                color: 'var(--text-bright)', cursor: 'pointer',
              }}
            >Confirm Decline</button>
          </>
        ) : (
          <>
            <button onClick={() => setDeclining(true)}
              style={{
                padding: '9px 20px', fontSize: 12, background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-tertiary)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >Decline</button>
            <button disabled style={{
              padding: '9px 20px', fontSize: 12, background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)',
              opacity: .4, cursor: 'not-allowed',
            }} title="Coming soon — Ask the buyer for clarification before responding">Request More Info</button>
            {existingAsset
              ? <button onClick={() => setPhase('type-select')}
                  style={{
                    height: 40, padding: '0 24px', fontSize: 12, fontWeight: 600,
                    background: 'var(--accent-indigo)', border: 'none', borderRadius: 6,
                    color: 'var(--text-bright)', cursor: 'pointer', transition: 'background .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-indigo-dim)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-indigo)'; }}
                >Choose Disclosure Type &rarr;</button>
              : <button onClick={() => onAccept(invitation)}
                  style={{
                    height: 40, padding: '0 24px', fontSize: 12, fontWeight: 600,
                    background: 'var(--accent-indigo)', border: 'none', borderRadius: 6,
                    color: 'var(--text-bright)', cursor: 'pointer', transition: 'background .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-indigo-dim)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-indigo)'; }}
                >Register Asset &rarr;</button>
            }
          </>
        )}
      </div>}
    </>;
  };

  /* ═══ Modal Shell ═══ */
  return <div ref={backdropRef}
    onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    style={{
      position: 'fixed', inset: 0, zIndex: 45,
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
      {phase === 'type-select' && activeAsset ? renderTypeSelect() : renderDetail()}
    </div>
  </div>;
}
