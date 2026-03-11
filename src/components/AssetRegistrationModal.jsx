import { useState, useRef, useEffect, useCallback } from 'react';

const SECTION_LABEL = {
  fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function AssetRegistrationModal({ isOpen, invitation, onRegister, onClose }) {
  const [assetName, setAssetName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [description, setDescription] = useState('');
  const [confirming, setConfirming] = useState(false);
  const backdropRef = useRef(null);

  // Reset form when modal opens or invitation changes
  useEffect(() => {
    if (isOpen && invitation) {
      setAssetName(invitation.asset || '');
      setPartNumber('');
      setDescription('');
      setConfirming(false);
    }
  }, [isOpen, invitation?.id]);

  const trimmedName = assetName.trim();
  const canCreate = trimmedName.length > 0;

  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    setConfirming(true);
  }, [canCreate]);

  const handleConfirm = useCallback(() => {
    onRegister({
      invitationId: invitation.id,
      assetName: trimmedName,
      partNumber: partNumber.trim(),
      description: description.trim(),
      verticalKey: invitation.verticalKey,
      targetParentNodeId: invitation.targetParentNodeId,
    });
    onClose();
  }, [invitation, trimmedName, partNumber, description, onRegister, onClose]);

  if (!isOpen || !invitation) return null;

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pfade .2s ease',
      }}
    >
      <div style={{
        width: 520, maxHeight: '90vh',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>
              Register Asset
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >×</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Register a new asset for <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{invitation.customer}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{
          overflowY: 'auto', flex: 1, padding: '0 28px 4px',
          opacity: confirming ? 0.5 : 1, pointerEvents: confirming ? 'none' : 'auto',
          transition: 'opacity .2s',
        }}>
          {/* Context line */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Invitation:</span>
            <span style={{ color: 'var(--accent-amber)' }}>●</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{invitation.asset}</span>
          </div>

          {/* ASSET NAME */}
          <div style={{ ...SECTION_LABEL, marginBottom: 8 }}>Asset Name</div>
          <input
            value={assetName}
            onChange={e => setAssetName(e.target.value)}
            placeholder="e.g., Thermal Interface Pad"
            autoFocus
            className="dim-ph"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13,
              background: 'var(--bg-deep)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              fontFamily: "var(--font-display)",
              transition: 'border-color .15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
          />

          {/* PART NUMBER */}
          <div style={{ ...SECTION_LABEL, marginTop: 20, marginBottom: 8 }}>Part Number (optional)</div>
          <input
            value={partNumber}
            onChange={e => setPartNumber(e.target.value)}
            placeholder="e.g., CW-TIP-4400"
            className="dim-ph"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13,
              background: 'var(--bg-deep)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              fontFamily: "var(--font-display)",
              transition: 'border-color .15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />

          {/* DESCRIPTION */}
          <div style={{ ...SECTION_LABEL, marginTop: 20, marginBottom: 8 }}>Description (optional)</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of this asset..."
            className="dim-ph"
            rows={3}
            style={{
              width: '100%', padding: '10px 14px', fontSize: 12,
              background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              fontFamily: "var(--font-display)",
              resize: 'vertical', transition: 'border-color .15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
          <div style={{ height: 4 }} />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 24px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          {!confirming && (
            <div style={{ fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.4, marginBottom: 12, textAlign: 'center' }}>
              This asset will be registered on-chain and visible to {invitation.customer}.
            </div>
          )}
          {confirming && (
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 12, textAlign: 'center' }}>
              Confirm registration of <strong>{trimmedName}</strong> as a supplier asset in the{' '}
              <strong>{invitation.customer}</strong> network.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {!confirming ? (
              <>
                <button onClick={onClose}
                  style={{
                    padding: '8px 20px', fontSize: 12,
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >Cancel</button>
                <button onClick={handleCreate}
                  disabled={!canCreate}
                  style={{
                    padding: '8px 20px', fontSize: 12, fontWeight: 600,
                    background: 'var(--accent-indigo)', border: 'none', borderRadius: 6,
                    color: 'var(--text-bright)', cursor: canCreate ? 'pointer' : 'not-allowed',
                    opacity: canCreate ? 1 : 0.4,
                    pointerEvents: canCreate ? 'auto' : 'none',
                    transition: 'opacity .15s',
                  }}
                >Register Asset</button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirming(false)}
                  style={{
                    padding: '8px 20px', fontSize: 12,
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >Go Back</button>
                <button onClick={handleConfirm}
                  style={{
                    padding: '8px 20px', fontSize: 12, fontWeight: 600,
                    background: 'var(--accent-amber)', border: 'none', borderRadius: 6,
                    color: 'var(--text-bright)', cursor: 'pointer', transition: 'opacity .15s',
                  }}
                >Confirm Registration</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
