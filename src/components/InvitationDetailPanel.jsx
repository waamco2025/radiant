import { useState, useCallback, useMemo, useEffect } from 'react';
import { getVerticalConfig } from '../data/verticals';
import { TT } from '../data/tokens';

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
  { key: 'full', color: 'var(--accent-blue)', label: 'Full Disclosure', desc: 'Share complete supply chain data with this buyer' },
  { key: 'selective', color: 'var(--accent-amber)', label: 'Selective Disclosure', desc: 'Choose which data fields to disclose' },
  { key: 'derivative', color: 'var(--accent-green)', label: 'Derivative Disclosure', desc: 'Share evaluation results (POE) without raw data' },
];

export default function InvitationDetailPanel({ invitation, onAccept, onDecline, onClose, customerData, chainAsset, onCreateDisclosure }) {
  const [declining, setDeclining] = useState(false);
  const [phase, setPhase] = useState('detail'); // 'detail' | 'type-select'

  const vertConfig = useMemo(
    () => invitation?.verticalKey ? getVerticalConfig(invitation.verticalKey) : null,
    [invitation?.verticalKey]
  );

  const requirements = vertConfig?.inviteRequirements || [];
  const isPending = invitation?.status === 'pending';

  /* Reset phase when invitation changes */
  useEffect(() => { setPhase('detail'); setDeclining(false); }, [invitation?.id]);

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

  /* ═══ Type Selection Phase ═══ */
  if (phase === 'type-select' && activeAsset) {
    const hasEvals = activeAsset.evaluations?.length > 0;
    const tk = TT[activeAsset.type] || TT.component;

    return <div style={{ flex: 1, overflow: 'auto', padding: '40px 48px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>

        {/* Back button */}
        {existingAsset && <button onClick={() => setPhase('detail')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 20, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >← Back to Invitation</button>}

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
            Choose Disclosure Type
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            Select how you want to disclose <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeAsset.name}</span> to <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invitation.customer}</span>
          </div>
        </div>

        {/* Asset summary card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24,
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
                {hasEvals ? `${evalCount} POE${evalCount > 1 ? 's' : ''} available` : 'Requires a completed evaluation'}
              </div>}
            </div>;
          })}
        </div>

        {/* Cancel — closes entire invitation flow, leaves invitation pending */}
        <div style={{ paddingTop: 20, borderTop: '1px solid var(--border)', marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{
              padding: '9px 20px', fontSize: 12, background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-tertiary)', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          >Cancel</button>
        </div>

      </div>
    </div>;
  }

  /* ═══ Detail Phase ═══ */
  return <div style={{ flex: 1, overflow: 'auto', padding: '40px 48px' }}>
    <div style={{ maxWidth: 620, margin: '0 auto' }}>

      {/* Back button */}
      <button onClick={onClose}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 20, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >← Back to Dashboard</button>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isPending ? 'var(--accent-amber)' : invitation.status === 'accepted' ? 'var(--accent-green)' : 'var(--text-muted)',
          }} />
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.06em',
            color: isPending ? 'var(--accent-amber)' : invitation.status === 'accepted' ? 'var(--accent-green)' : 'var(--text-muted)',
            textTransform: 'uppercase',
          }}>{invitation.status}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
          Invitation from {invitation.customer}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          {existingAsset
            ? <>Requesting disclosure for <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invitation.asset}</span></>
            : <>Requesting you register <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{invitation.asset}</span> as an upstream supplier asset</>
          }
        </div>
      </div>

      {/* Message (if present) */}
      {invitation.message && <div style={{
        padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 28,
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic',
      }}>
        "{invitation.message}"
      </div>}

      {/* Info grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28,
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20,
      }}>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>NETWORK</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{invitation.customer}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>VERTICAL</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{vertConfig?.name || invitation.verticalKey}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>REQUESTED ASSET</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{invitation.asset}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>DATE RECEIVED</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{invitation.date}</div>
        </div>
      </div>

      {/* Existing asset info card */}
      {existingAsset && isPending && (() => {
        const tk = TT[existingAsset.type] || TT.component;
        const hasEvals = existingAsset.evaluations?.length > 0;
        return <div style={{ marginBottom: 28 }}>
          <div style={SECTION_LABEL}>EXISTING ASSET</div>
          <div style={{
            padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: tk.border, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{existingAsset.name}</span>
              {hasEvals && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-green-bg)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', color: 'var(--accent-green)', fontFamily: 'monospace', fontWeight: 600, marginLeft: 'auto' }}>POE ✓</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              This asset is already in your network. Choose a disclosure type for {invitation.customer}.
            </div>
          </div>
        </div>;
      })()}

      {/* SDA Terms */}
      {!existingAsset && <div style={{ marginBottom: 28 }}>
        <div style={SECTION_LABEL}>SELECTIVE DISCLOSURE TERMS</div>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
        }}>
          {SDA_TERMS.map((term, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}>
              <span style={{ fontSize: 10, color: 'var(--accent-green)', flexShrink: 0, marginTop: 2 }}>✓</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{term}</span>
            </div>
          ))}
        </div>
      </div>}

      {/* Required Attestations (only for new asset path) */}
      {!existingAsset && requirements.length > 0 && <div style={{ marginBottom: 28 }}>
        <div style={SECTION_LABEL}>REQUIRED ATTESTATIONS</div>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
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

      {/* Actions */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 10,
        paddingTop: 16, borderTop: '1px solid var(--border)',
      }}>
        {isPending ? <>
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
              {existingAsset
                ? <button onClick={() => setPhase('type-select')}
                    style={{
                      padding: '9px 20px', fontSize: 12, fontWeight: 600,
                      background: 'var(--accent-indigo)', border: 'none', borderRadius: 6,
                      color: 'var(--text-bright)', cursor: 'pointer',
                    }}
                  >Create Disclosure</button>
                : <button onClick={() => onAccept(invitation)}
                    style={{
                      padding: '9px 20px', fontSize: 12, fontWeight: 600,
                      background: 'var(--accent-indigo)', border: 'none', borderRadius: 6,
                      color: 'var(--text-bright)', cursor: 'pointer',
                    }}
                  >Accept & Register Asset</button>
              }
            </>
          )}
        </> : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            This invitation has been {invitation.status}. No actions available.
          </div>
        )}
      </div>

    </div>
  </div>;
}
