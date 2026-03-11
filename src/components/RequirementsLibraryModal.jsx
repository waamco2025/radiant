import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

const CAT_COLORS = {
  Security: 'var(--accent-red)',
  Quality: 'var(--accent-green)',
  Compliance: 'var(--accent-amber)',
  Safety: 'var(--accent-orange)',
  Environmental: 'var(--accent-cyan)',
  Reliability: 'var(--accent-purple-light)',
};

export default function RequirementsLibraryModal({ isOpen, onClose, vertical }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedSets, setExpandedSets] = useState(new Set());
  const backdropRef = useRef(null);
  const searchRef = useRef(null);

  // Reset state when modal opens/closes or vertical changes
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setDebouncedSearch('');
      setExpandedSets(new Set());
      setTimeout(() => { if (searchRef.current) searchRef.current.focus(); }, 50);
    }
  }, [isOpen, vertical?.id]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const sets = vertical?.requirementSets || [];

  // Filter logic
  const { filteredSets, matchingReqIds, autoExpandIds } = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return { filteredSets: sets, matchingReqIds: new Set(), autoExpandIds: new Set() };

    const result = [];
    const reqMatches = new Set();
    const autoExp = new Set();

    for (const s of sets) {
      const setMatch = s.name.toLowerCase().includes(q)
        || s.description.toLowerCase().includes(q)
        || s.issuingBody.toLowerCase().includes(q);

      const matchingReqs = s.requirements.filter(r =>
        r.text.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
      );

      if (setMatch || matchingReqs.length > 0) {
        result.push(s);
        if (!setMatch && matchingReqs.length > 0) {
          autoExp.add(s.id);
          for (const r of matchingReqs) reqMatches.add(r.id);
        }
        if (setMatch && matchingReqs.length > 0) {
          for (const r of matchingReqs) reqMatches.add(r.id);
        }
      }
    }

    return { filteredSets: result, matchingReqIds: reqMatches, autoExpandIds: autoExp };
  }, [sets, debouncedSearch]);

  const toggleSet = useCallback((id) => {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const isExpanded = useCallback((id) => {
    return expandedSets.has(id) || autoExpandIds.has(id);
  }, [expandedSets, autoExpandIds]);

  if (!isOpen) return null;

  const vertName = vertical?.name || 'Unknown';

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
        width: 700, maxHeight: '80vh',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,.6)',
      }}>
        {/* Header (not scrollable) */}
        <div style={{ padding: '24px 28px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>Requirements Library</div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: 16, padding: 0, lineHeight: 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >×</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
            Published requirement sets for {vertName}
          </div>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search requirements…"
            className="dim-ph"
            style={{
              width: '100%', padding: '8px 12px', fontSize: 12,
              background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              fontFamily: "var(--font-display)",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
        </div>

        {/* Body (scrollable) */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px 24px' }}>
          {filteredSets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
              No requirements match '{debouncedSearch}'
            </div>
          ) : (
            filteredSets.map(s => {
              const catColor = CAT_COLORS[s.category] || 'var(--text-tertiary)';
              const expanded = isExpanded(s.id);

              return (
                <div key={s.id} style={{
                  background: 'var(--bg-deep)', borderRadius: 8,
                  border: '1px solid var(--border)', borderLeft: `3px solid ${catColor}`,
                  marginBottom: 8, padding: '14px 16px',
                }}>
                  {/* Card header */}
                  <div
                    onClick={() => toggleSet(s.id)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 3 }}>
                        {s.issuingBody} · v{s.version} · {s.requirements.length} requirements
                      </div>
                      {!expanded && (
                        <div style={{
                          fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{s.description}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2,
                      transition: 'transform .15s',
                    }}>{expanded ? '▾' : '▸'}</span>
                  </div>

                  {/* Expanded content */}
                  {expanded && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 8 }}>
                        {s.description}
                      </div>
                      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                      {s.requirements.map((r, i) => {
                        const isMatch = matchingReqIds.has(r.id);
                        return (
                          <div key={r.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: isMatch ? '8px 8px' : '8px 0',
                            borderBottom: i < s.requirements.length - 1 ? '1px solid var(--border)' : 'none',
                            background: isMatch ? 'rgba(107,138,255,0.08)' : 'transparent',
                            margin: isMatch ? '0 -8px' : 0,
                            borderRadius: isMatch ? 4 : 0,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginRight: 8 }}>{r.id}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.text}</span>
                            </div>
                            <span style={{
                              fontSize: 9, fontFamily: 'monospace', color: 'var(--text-tertiary)',
                              background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4,
                              whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2,
                            }}>{r.category}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
