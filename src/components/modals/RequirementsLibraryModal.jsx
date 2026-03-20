import { useState, useEffect, useMemo, useCallback } from 'react'
import { Backdrop } from './ModalShared.jsx'

/* ─── Left Panel: Set List (grouped by lineage) ─── */
function SetList({ sets, selectedId, onSelect, search, setSearch, expandedLineages, toggleLineage }) {
  // Group by lineage, newest version first
  const lineageGroups = useMemo(() => {
    const map = new Map()
    for (const s of sets) {
      const lid = s.lineageId || s.id
      if (!map.has(lid)) map.set(lid, [])
      map.get(lid).push(s)
    }
    // Sort each group: newest version first
    for (const [, arr] of map) arr.sort((a, b) => (b.version || 1) - (a.version || 1))
    // Convert to array sorted by latest version's created date (newest first)
    return [...map.entries()]
      .map(([lid, versions]) => ({ lineageId: lid, versions, latest: versions[0] }))
      .sort((a, b) => (b.latest.created || '').localeCompare(a.latest.created || ''))
  }, [sets])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return lineageGroups
    const q = search.toLowerCase()
    return lineageGroups.filter(g =>
      g.versions.some(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        s.requirements.some(r => r.label.toLowerCase().includes(q))
      )
    )
  }, [lineageGroups, search])

  // Total matching sets for result count
  const matchingSetCount = useMemo(() => {
    return filtered.reduce((sum, g) => sum + g.versions.length, 0)
  }, [filtered])

  return (
    <div style={{
      width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {/* Search row */}
      <div style={{ padding: '12px 14px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sets…"
            style={{
              width: '100%', padding: '7px 10px', paddingRight: search ? 28 : 10, borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 12,
              outline: 'none',
            }}
          />
          {search && (
            <span
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 0, top: 0, bottom: 0,
                display: 'flex', alignItems: 'center',
                padding: '0 8px', fontSize: 12, color: 'var(--text-dim)',
                cursor: 'pointer', transition: 'color 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >×</span>
          )}
        </div>
      </div>

      {/* Result count subheader */}
      {search.trim() && (
        <div style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
          padding: '4px 14px', background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          {matchingSetCount} result{matchingSetCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
        {sets.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.7 }}>
            No requirement sets yet.
          </div>
        )}
        {sets.length > 0 && filtered.length === 0 && (
          <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            No sets match &lsquo;{search}&rsquo;
          </div>
        )}
        {filtered.map(g => {
          const latest = g.latest
          const isExpanded = expandedLineages[g.lineageId]
          const hasMultiple = g.versions.length > 1
          const isLatestSelected = latest.id === selectedId

          return (
            <div key={g.lineageId} style={{ marginBottom: 4, marginTop: 4 }}>
              {/* Latest version row */}
              <div
                onClick={() => onSelect(latest.id)}
                style={{
                  padding: '12px 14px', cursor: 'pointer', borderRadius: 8,
                  border: `1px solid ${isLatestSelected ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  background: isLatestSelected
                    ? 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)'
                    : 'var(--bg-card)',
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => { if (!isLatestSelected) e.currentTarget.style.background = 'var(--bg-raised)' }}
                onMouseLeave={e => { if (!isLatestSelected) e.currentTarget.style.background = isLatestSelected ? 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)' : 'var(--bg-card)' }}
              >
                {/* Row 1: Name + req count + version badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {latest.name}
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
                    {latest.requirements.length} req{latest.requirements.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                    color: 'var(--accent-indigo)',
                    background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                  }}>v{latest.version || 1}</span>
                </div>
                {/* Row 2: Description (max 2 lines) */}
                {latest.description && (
                  <div style={{
                    fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{latest.description}</div>
                )}
                {/* Row 3: Version expand trigger (only if multiple versions) */}
                {hasMultiple && (
                  <>
                    <div
                      onClick={e => { e.stopPropagation(); toggleLineage(g.lineageId) }}
                      style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                        cursor: 'pointer', marginTop: 6, transition: 'color 100ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-indigo)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                    >
                      {isExpanded ? '▾' : '▸'} {g.versions.length} versions
                    </div>

                    {/* Expanded sub-rows */}
                    {isExpanded && g.versions.slice(1).map((v, i) => {
                      const isSelected = v.id === selectedId
                      return (
                        <div
                          key={v.id}
                          onClick={e => { e.stopPropagation(); onSelect(v.id) }}
                          style={{
                            paddingLeft: 12, padding: '6px 0 6px 12px',
                            borderTop: '1px solid var(--border)',
                            marginTop: i === 0 ? 6 : 0,
                            display: 'flex', alignItems: 'center', gap: 8,
                            cursor: 'pointer', fontSize: 11, color: 'var(--text-dim)',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)', fontWeight: 600,
                              color: isSelected ? 'var(--accent-indigo)' : 'var(--text-tertiary)',
                              transition: 'color 100ms',
                            }}
                          >v{v.version || 1}</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>Created {v.created}</span>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Right Panel: View Details ─── */
function ViewDetails({ rs, onNewVersion, allSets }) {
  // Check if a newer version exists in same lineage
  const newerExists = useMemo(() => {
    if (!rs.lineageId) return false
    return allSets.some(s => s.lineageId === rs.lineageId && (s.version || 1) > (rs.version || 1))
  }, [rs, allSets])

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>{rs.name}</div>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '2px 7px', borderRadius: 4,
          color: 'var(--accent-indigo)',
          background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
        }}>v{rs.version || 1}</span>
      </div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4 }}>Created {rs.created}</div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginTop: 10 }}>{rs.description}</div>

      {/* Newer version notice */}
      {newerExists && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
          fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.5,
        }}>
          A newer version of this set exists. You are viewing v{rs.version || 1}.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <span
          onClick={onNewVersion}
          style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
            cursor: 'pointer', padding: '5px 10px', borderRadius: 4,
            border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
            transition: 'background 100ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >New Version</span>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          REQUIREMENTS
        </span>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)',
          padding: '1px 6px', borderRadius: 4, background: 'var(--bg-raised)',
        }}>{rs.requirements.length}</span>
      </div>
      {rs.requirements.map((req, i) => (
        <div key={req.id} style={{
          padding: '10px 0',
          borderBottom: i < rs.requirements.length - 1 ? '1px solid var(--border)' : 'none',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '2px 7px', borderRadius: 4, flexShrink: 0, marginTop: 2,
            color: req.type === 'extraction' ? 'var(--accent-cyan)' : 'var(--accent-amber)',
            background: req.type === 'extraction'
              ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)'
              : 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
          }}>
            {req.type === 'extraction' ? 'EXTRACT' : 'INFER'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{req.label}</div>
            {req.description && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 2 }}>{req.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Right Panel: Editor Form ─── */
function EditorForm({ isNewVersion, sourceName, draftVersion, editName, setEditName, editDescription, setEditDescription,
  editRequirements, setEditRequirements, onSave, onCancel }) {

  const [activeTab, setActiveTab] = useState('manual')

  const addRequirement = (type) => {
    const id = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
    setEditRequirements(prev => [...prev, { id, label: '', type, description: '' }])
  }

  const updateReq = (id, field, value) => {
    setEditRequirements(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const removeReq = (id) => {
    setEditRequirements(prev => prev.filter(r => r.id !== id))
  }

  // Save enabled when name + description filled AND ≥1 requirement with both label and description
  const completeReqCount = editRequirements.filter(r => r.label.trim() && r.description.trim()).length
  const canSave = editName.trim() && editDescription.trim() && completeReqCount > 0

  const headerText = isNewVersion
    ? `New Version: ${sourceName || editName || 'Untitled'}`
    : 'Create Requirement Set'

  const tabs = [
    { id: 'manual', label: 'Manual' },
    { id: 'csv', label: 'Import CSV' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>
            {headerText}
          </div>
          {isNewVersion && draftVersion && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '1px 5px', borderRadius: 3,
              color: 'var(--accent-indigo)',
              background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
            }}>v{draftVersion}</span>
          )}
        </div>

        {/* Tabs: Manual / Import CSV — only for brand new sets (PanelShell style) */}
        {!isNewVersion && (
          <div style={{ marginBottom: 16, flexShrink: 0 }}>
            <div style={{
              display: 'flex', gap: 4,
              background: 'var(--bg-surface)', borderRadius: 8,
              padding: 4, border: '1px solid var(--border)',
            }}>
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                    cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-display)',
                    fontWeight: activeTab === t.id ? 600 : 400,
                    background: activeTab === t.id ? 'var(--accent-indigo)' : 'transparent',
                    color: activeTab === t.id ? '#fff' : 'var(--text-tertiary)',
                    transition: 'all 180ms',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'csv' && !isNewVersion ? (
          /* CSV Import placeholder */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '48px 32px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
              Import from CSV
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 24, maxWidth: 340 }}>
              Upload a CSV file with columns:<br />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Type (Extract/Infer), Label, Description</span>
              <br /><br />
              Set name will be derived from the filename. You&apos;ll be asked to provide a description after import.
            </div>
            <span style={{
              fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
              padding: '8px 20px', borderRadius: 6,
              border: '1px solid var(--border)', opacity: 0.5, cursor: 'default',
            }}>Upload CSV</span>
            <div style={{
              marginTop: 16, fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: 'var(--text-dim)', letterSpacing: '0.06em',
              padding: '3px 8px', background: 'var(--bg-raised)', borderRadius: 6,
            }}>COMING SOON</div>
          </div>
        ) : (activeTab === 'manual' || isNewVersion) ? (
          /* Manual form */
          <>
            {/* Name */}
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.03em' }}>NAME</div>
            <input
              value={editName} onChange={e => setEditName(e.target.value)}
              placeholder="e.g. MIL-PRF-55681 Compliance"
              readOnly={isNewVersion}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 6,
                border: '1px solid var(--border)',
                background: isNewVersion ? 'var(--bg-deep)' : 'var(--bg-card)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                outline: 'none', marginBottom: 16,
                opacity: isNewVersion ? 0.6 : 1,
                cursor: isNewVersion ? 'default' : undefined,
              }}
            />

            {/* Description */}
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.03em' }}>DESCRIPTION</div>
            <textarea
              value={editDescription} onChange={e => setEditDescription(e.target.value)}
              placeholder="What does this requirement set evaluate?"
              rows={3}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                outline: 'none', resize: 'none', marginBottom: 20,
              }}
            />

            {/* Requirements */}
            <div style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: 'var(--text-dim)', marginBottom: 10, letterSpacing: '0.03em',
            }}>
              REQUIREMENTS ({editRequirements.length})
            </div>

            {editRequirements.map(req => (
              <div key={req.id} style={{
                marginBottom: 8, padding: '10px 12px',
                background: 'var(--bg-card)', borderRadius: 6,
                border: '1px solid var(--border)',
              }}>
                {/* Row 1: type toggle + label + delete */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Type toggle — fixed width column */}
                  <div style={{ width: 48, flexShrink: 0, display: 'flex', gap: 2 }}>
                    <span
                      onClick={() => updateReq(req.id, 'type', 'extraction')}
                      style={{
                        fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        padding: '3px 5px', borderRadius: '3px 0 0 3px', cursor: 'pointer',
                        color: req.type === 'extraction' ? 'var(--accent-cyan)' : 'var(--text-dim)',
                        background: req.type === 'extraction'
                          ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)'
                          : 'transparent',
                        border: req.type === 'extraction' ? 'none' : '1px solid var(--border)',
                        opacity: req.type === 'extraction' ? 1 : 0.4,
                        transition: 'all 100ms',
                      }}
                    >EXT</span>
                    <span
                      onClick={() => updateReq(req.id, 'type', 'inference')}
                      style={{
                        fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        padding: '3px 5px', borderRadius: '0 3px 3px 0', cursor: 'pointer',
                        color: req.type === 'inference' ? 'var(--accent-amber)' : 'var(--text-dim)',
                        background: req.type === 'inference'
                          ? 'color-mix(in srgb, var(--accent-amber) 12%, transparent)'
                          : 'transparent',
                        border: req.type === 'inference' ? 'none' : '1px solid var(--border)',
                        opacity: req.type === 'inference' ? 1 : 0.4,
                        transition: 'all 100ms',
                      }}
                    >INF</span>
                  </div>
                  <input
                    value={req.label}
                    onChange={e => updateReq(req.id, 'label', e.target.value)}
                    placeholder={req.type === 'extraction' ? 'Extraction requirement label' : 'Inference requirement label'}
                    style={{
                      flex: 1, padding: '4px 8px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 12,
                      outline: 'none', minWidth: 0,
                    }}
                  />
                  <span
                    onClick={() => removeReq(req.id)}
                    style={{
                      fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer',
                      padding: '2px 4px', flexShrink: 0, transition: 'color 100ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  >×</span>
                </div>
                {/* Row 2: description aligned with label (same left edge: 48px toggle + 8px gap = 56px) */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <div style={{ width: 48, flexShrink: 0 }} />
                  <input
                    value={req.description}
                    onChange={e => updateReq(req.id, 'description', e.target.value)}
                    placeholder={req.type === 'extraction'
                      ? 'Extraction prompt \u2014 what value should the AI extract?'
                      : 'Inference prompt \u2014 what condition should the AI evaluate?'}
                    style={{
                      flex: 1, padding: '4px 8px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 11,
                      outline: 'none', minWidth: 0,
                    }}
                  />
                </div>
              </div>
            ))}

            <span
              onClick={() => addRequirement('extraction')}
              style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
                cursor: 'pointer', padding: '6px 10px', borderRadius: 4,
                border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >+ Add Requirement</span>
          </>
        ) : null}
      </div>

      {/* Pinned footer */}
      <div style={{
        padding: '12px 28px', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
      }}>
        <span
          onClick={onCancel}
          style={{
            fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: '8px 16px', borderRadius: 6,
            border: '1px solid var(--border)', transition: 'background 100ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >Cancel</span>
        <span
          onClick={canSave ? onSave : undefined}
          style={{
            fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: '#fff', padding: '8px 16px', borderRadius: 6,
            background: 'var(--accent-indigo)', transition: 'opacity 100ms',
            cursor: canSave ? 'pointer' : 'default',
            opacity: canSave ? 1 : 0.35,
          }}
          onMouseEnter={e => { if (canSave) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = canSave ? '1' : '0.35' }}
        >Save</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN MODAL — Requirements Library (Split Panel)
   ═══════════════════════════════════════════════════════════════════════ */
export default function RequirementsLibraryModal({ requirementSets, onClose, onSave, _noBackdrop }) {
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('view')        // 'view' | 'create' | 'newversion'
  const [search, setSearch] = useState('')
  const [expandedLineages, setExpandedLineages] = useState({})

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRequirements, setEditRequirements] = useState([])

  // New version context
  const [sourceLineageId, setSourceLineageId] = useState(null)
  const [sourceName, setSourceName] = useState('')
  const [draftVersion, setDraftVersion] = useState(null)

  const selectedSet = useMemo(() => requirementSets.find(s => s.id === selectedId), [requirementSets, selectedId])

  const toggleLineage = useCallback((lid) => {
    setExpandedLineages(prev => ({ ...prev, [lid]: !prev[lid] }))
  }, [])

  // Escape handler — capture phase with stopImmediatePropagation to block Backdrop
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return

      if (mode === 'create' || mode === 'newversion') {
        e.stopPropagation()
        e.preventDefault()
        e.stopImmediatePropagation()
        setMode('view')
        return
      }
      // view or empty — do nothing, let Backdrop handle close
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [mode])

  const handleSelect = (id) => {
    setSelectedId(id)
    setMode('view')
  }

  const handleCreate = () => {
    setEditName('')
    setEditDescription('')
    setEditRequirements([])
    setSourceLineageId(null)
    setSourceName('')
    setDraftVersion(null)
    setMode('create')
  }

  const handleNewVersion = () => {
    if (!selectedSet) return
    const lid = selectedSet.lineageId || selectedSet.id
    // Find max version in this lineage
    const maxVersion = requirementSets
      .filter(s => (s.lineageId || s.id) === lid)
      .reduce((max, s) => Math.max(max, s.version || 1), 0)
    setEditName(selectedSet.name)
    setEditDescription(selectedSet.description || '')
    setEditRequirements(selectedSet.requirements.map(r => ({ ...r, id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}` })))
    setSourceLineageId(lid)
    setSourceName(selectedSet.name)
    setDraftVersion(maxVersion + 1)
    setMode('newversion')
  }

  const handleSave = () => {
    // Only include requirements with both label and description
    const completeReqs = editRequirements.filter(r => r.label.trim() && r.description.trim())
    const trimmedName = editName.trim()

    let lineageId, version
    if (mode === 'newversion' && sourceLineageId) {
      // Name is locked in new version mode, always same lineage
      lineageId = sourceLineageId
      version = draftVersion
    } else {
      // Brand new set
      lineageId = `lineage-${Date.now().toString(36)}`
      version = 1
    }

    const reqSet = {
      id: `reqset-${Date.now().toString(36)}-v${version}`,
      lineageId,
      version,
      name: trimmedName,
      description: editDescription.trim(),
      created: new Date().toISOString().slice(0, 10),
      requirements: completeReqs,
    }
    onSave(reqSet)
    setSelectedId(reqSet.id)
    setMode('view')
  }

  const handleCancelEdit = () => {
    setMode('view')
  }

  const isEditing = mode === 'create' || mode === 'newversion'

  // Right panel content
  let rightContent
  if (isEditing) {
    rightContent = (
      <EditorForm
        isNewVersion={mode === 'newversion'}
        sourceName={sourceName}
        draftVersion={draftVersion}
        editName={editName} setEditName={setEditName}
        editDescription={editDescription} setEditDescription={setEditDescription}
        editRequirements={editRequirements} setEditRequirements={setEditRequirements}
        onSave={handleSave}
        onCancel={handleCancelEdit}
      />
    )
  } else if (selectedSet) {
    rightContent = (
      <ViewDetails
        rs={selectedSet}
        onNewVersion={handleNewVersion}
        allSets={requirementSets}
      />
    )
  } else {
    rightContent = (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px', textAlign: 'center',
      }}>
        <div>
          <svg width={40} height={40} viewBox="0 0 16 16" fill="none" style={{ opacity: 0.3, marginBottom: 16 }}>
            <rect x="3" y="2.5" width="10" height="12" rx="1.5" stroke="var(--text-dim)" strokeWidth="1.3" fill="none" />
            <rect x="5.5" y="1" width="5" height="2.5" rx="1" stroke="var(--text-dim)" strokeWidth="1.2" fill="var(--bg-deep)" />
            <line x1="5.5" y1="7" x2="10.5" y2="7" stroke="var(--text-dim)" strokeWidth="1" strokeLinecap="round" />
            <line x1="5.5" y1="9.5" x2="10.5" y2="9.5" stroke="var(--text-dim)" strokeWidth="1" strokeLinecap="round" />
            <line x1="5.5" y1="12" x2="8.5" y2="12" stroke="var(--text-dim)" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
            Select a requirement set to view details,<br />or create a new one.
          </div>
        </div>
      </div>
    )
  }

  const content = (
    <div style={{
      width: 960, height: '80vh', background: 'var(--bg-surface)',
      borderRadius: 14, border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>Requirements Library</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {requirementSets.length} requirement set{requirementSets.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isEditing && (
            <span
              onClick={handleCreate}
              style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: 'var(--accent-indigo)', cursor: 'pointer',
                padding: '6px 12px', borderRadius: 6,
                border: '1px solid color-mix(in srgb, var(--accent-indigo) 30%, transparent)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >+ Create Requirement Set</span>
          )}
          <span
            onClick={onClose}
            style={{
              fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4, transition: 'color 100ms',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          >×</span>
        </div>
      </div>

      {/* Two-panel body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SetList
          sets={requirementSets}
          selectedId={selectedId}
          onSelect={handleSelect}
          search={search}
          setSearch={setSearch}
          expandedLineages={expandedLineages}
          toggleLineage={toggleLineage}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {rightContent}
        </div>
      </div>
    </div>
  )

  return _noBackdrop ? content : <Backdrop onClose={onClose}>{content}</Backdrop>
}
