import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { TT } from '../data/tokens';

// Vertical-specific placeholders by vertical id
const PROGRAM_PLACEHOLDERS = {
  aerospace: 'e.g., Artemis IV Launch Campaign',
  healthcare: 'e.g., CardioSync Device Certification',
  govco: 'e.g., STARLINK-7 Constellation',
  microco: 'e.g., MC-7000 Microcontroller',
};

const SYSTEM_PLACEHOLDERS = {
  aerospace: 'e.g., Payload Integration',
  healthcare: 'e.g., FastCo Boston General',
  govco: 'e.g., Sentinel-6 Reconnaissance',
  microco: 'e.g., Titan-X 5nm SoC',
};

const SECTION_LABEL = {
  fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function SystemCreationModal({ isOpen, onClose, vertical, onCreateSystem, data, mode = 'program', parentNode = null }) {
  const hierarchy = vertical?.tierHierarchy || [];
  const programTier = hierarchy.find(t => t.key === 'program');
  const systemTier = hierarchy.find(t => t.key === 'system');
  const ownerTier = hierarchy.find(t => t.key === 'owner');

  // Derive labels from vertical config
  const programLabel = vertical?.nodeTypeLabels?.program || programTier?.label || 'Program';
  const systemLabel = vertical?.nodeTypeLabels?.system || systemTier?.label || 'System';
  const vertName = vertical?.name || 'Unknown';
  const vertId = vertical?.id || 'aerospace';

  const [tierName, setTierName] = useState('');
  const [description, setDescription] = useState('');
  const [confirming, setConfirming] = useState(false);
  const backdropRef = useRef(null);

  // Reset form when modal opens, mode, or vertical changes
  useEffect(() => {
    if (isOpen) {
      setTierName('');
      setDescription('');
      setConfirming(false);
    }
  }, [isOpen, vertical?.id, mode]);

  // Existing node names for duplicate validation
  const existingNames = useMemo(() => {
    const names = new Set();
    const walk = n => {
      if (n.name) names.add(n.name.toLowerCase());
      if (n.children) n.children.forEach(walk);
    };
    if (data) walk(data);
    return names;
  }, [data]);

  const trimmedName = tierName.trim();
  const isDuplicate = trimmedName.length > 0 && existingNames.has(trimmedName.toLowerCase());
  const canCreate = trimmedName.length > 0 && !isDuplicate;

  // Mode-derived values
  const isProgram = mode === 'program';
  const activeLabel = isProgram ? programLabel : systemLabel;
  const placeholder = isProgram
    ? (PROGRAM_PLACEHOLDERS[vertId] || `e.g., New ${programLabel}`)
    : (SYSTEM_PLACEHOLDERS[vertId] || `e.g., New ${systemLabel}`);

  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    setConfirming(true);
  }, [canCreate]);

  const handleConfirm = useCallback(() => {
    if (isProgram) {
      onCreateSystem({
        mode: 'program',
        name: trimmedName,
        description: description.trim(),
        verticalKey: vertId,
      });
    } else {
      onCreateSystem({
        mode: 'system',
        name: trimmedName,
        description: description.trim(),
        parentNodeId: parentNode?.id || null,
        verticalKey: vertId,
      });
    }
    onClose();
  }, [isProgram, trimmedName, description, vertId, parentNode, onCreateSystem, onClose]);

  if (!isOpen) return null;

  // Context line info
  const parentName = isProgram ? vertName : (parentNode?.name || vertName);
  const parentIcon = isProgram ? (ownerTier?.icon || '⬡') : (programTier?.icon || '◫');
  const parentType = parentNode?.type;
  const parentColor = parentType ? (TT[parentType]?.border || 'var(--accent-indigo)') : 'var(--accent-indigo)';

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
        {/* ── Header ── */}
        <div style={{ padding: '24px 28px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>
              Create {activeLabel}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >×</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {isProgram
              ? `Add a new ${programLabel.toLowerCase()} to ${vertName}`
              : `Add a new ${systemLabel.toLowerCase()} under ${parentNode?.name || vertName}`}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px 4px', opacity: confirming ? 0.5 : 1, pointerEvents: confirming ? 'none' : 'auto', transition: 'opacity .2s' }}>

          {/* Context line */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isProgram ? (
              <>
                <span>This {programLabel.toLowerCase()} will be created under</span>
                <span style={{ color: 'var(--accent-indigo)' }}>{ownerTier?.icon || '⬡'}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{vertName}</span>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--text-muted)' }}>Parent:</span>
                <span style={{ color: parentColor }}>{parentIcon}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{parentNode?.name || vertName}</span>
              </>
            )}
          </div>

          {/* NAME */}
          <div style={{ ...SECTION_LABEL, marginBottom: 8 }}>Name</div>
          <input
            value={tierName}
            onChange={e => setTierName(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="dim-ph"
            style={{
              width: '100%',
              padding: '10px 14px', fontSize: 13,
              background: 'var(--bg-deep)',
              border: `1px solid ${isDuplicate ? 'var(--accent-red)' : 'var(--border)'}`,
              borderRadius: 6, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              fontFamily: "var(--font-display)",
              transition: 'border-color .15s',
            }}
            onFocus={e => { if (!isDuplicate) e.currentTarget.style.borderColor = 'var(--accent-indigo)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = isDuplicate ? 'var(--accent-red)' : 'var(--border)'; }}
            onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
          />
          {isDuplicate && (
            <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>
              A node with this name already exists
            </div>
          )}

          {/* DESCRIPTION (optional) */}
          <div style={{ ...SECTION_LABEL, marginTop: 20, marginBottom: 8 }}>Description (optional)</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={`Brief description of this ${activeLabel.toLowerCase()}'s purpose…`}
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

        {/* ── Footer ── */}
        <div style={{ padding: '16px 28px 24px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          {/* Permanence warning */}
          {!confirming && (
            <div style={{ fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.4, marginBottom: 12, textAlign: 'center' }}>
              ⚠ Tier definitions are recorded on-chain and cannot be removed once created.
            </div>
          )}
          {confirming && (
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 12, textAlign: 'center' }}>
              This action is permanent. A new <strong>{trimmedName}</strong> {activeLabel.toLowerCase()} will be created under{' '}
              <strong>{parentName}</strong>.
            </div>
          )}
          {/* Button row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {!confirming ? (
              <>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 20px', fontSize: 12,
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!canCreate}
                  style={{
                    padding: '8px 20px', fontSize: 12, fontWeight: 600,
                    background: 'var(--accent-indigo)', border: 'none', borderRadius: 6,
                    color: 'var(--text-bright)', cursor: canCreate ? 'pointer' : 'not-allowed',
                    opacity: canCreate ? 1 : 0.4,
                    pointerEvents: canCreate ? 'auto' : 'none',
                    transition: 'opacity .15s',
                  }}
                >Create {activeLabel}</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirming(false)}
                  style={{
                    padding: '8px 20px', fontSize: 12,
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >Go Back</button>
                <button
                  onClick={handleConfirm}
                  style={{
                    padding: '8px 20px', fontSize: 12, fontWeight: 600,
                    background: 'var(--accent-amber)', border: 'none', borderRadius: 6,
                    color: 'var(--text-bright)', cursor: 'pointer', transition: 'opacity .15s',
                  }}
                >Confirm Creation</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
