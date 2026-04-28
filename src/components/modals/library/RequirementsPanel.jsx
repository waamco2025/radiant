import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Backdrop } from '../ModalShared.jsx'

function HighlightMatch({ text, query }) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span style={{
        background: 'color-mix(in srgb, var(--accent-amber) 25%, transparent)',
        color: 'var(--text-primary)',
        borderRadius: 2,
        padding: '0 1px',
      }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}

/* ─── Version Item (inner selectable card) ─── */
function VersionItem({ v, isSelected, onSelect }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onSelect(v.id) }}
      style={{
        padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginTop: 6,
        background: isSelected
          ? 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)'
          : 'var(--bg-deep)',
        border: `1px solid ${isSelected ? 'var(--accent-indigo)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'background 100ms, border-color 100ms',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-hover)'
          e.currentTarget.style.background = 'var(--bg-raised)'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.background = 'var(--bg-deep)'
        }
      }}
    >
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        padding: '1px 5px', borderRadius: 3, flexShrink: 0,
        color: isSelected ? 'var(--accent-indigo)' : 'var(--text-dim)',
        background: isSelected
          ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)'
          : 'var(--bg-raised)',
      }}>v{v.version || 1}</span>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
        Created {v.created}
      </span>
    </div>
  )
}

/* ─── Left Panel: Set List (grouped by lineage, nested cards) ─── */
function SetList({ sets, selectedId, onSelect, search, setSearch, expandedLineages, toggleLineage, publishedSets, pubExpanded, setPubExpanded }) {
  // Group by lineage, newest version first
  const lineageGroups = useMemo(() => {
    const map = new Map()
    for (const s of sets) {
      const lid = s.lineageId || s.id
      if (!map.has(lid)) map.set(lid, [])
      map.get(lid).push(s)
    }
    for (const [, arr] of map) arr.sort((a, b) => (b.version || 1) - (a.version || 1))
    return [...map.entries()]
      .map(([lid, versions]) => ({ lineageId: lid, versions, latest: versions[0] }))
      .sort((a, b) => (b.latest.created || '').localeCompare(a.latest.created || ''))
  }, [sets])

  // Filter by search + auto-expand if match is in older version
  const { filtered, autoExpandIds } = useMemo(() => {
    if (!search.trim()) return { filtered: lineageGroups, autoExpandIds: new Set() }
    const q = search.toLowerCase()
    const matched = []
    const autoIds = new Set()
    for (const g of lineageGroups) {
      const anyMatch = g.versions.some(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        s.requirements.some(r => r.label.toLowerCase().includes(q))
      )
      if (!anyMatch) continue
      matched.push(g)
      // Check if match is only in older versions (not latest)
      const latestMatches =
        g.latest.name.toLowerCase().includes(q) ||
        (g.latest.description || '').toLowerCase().includes(q) ||
        g.latest.requirements.some(r => r.label.toLowerCase().includes(q))
      if (!latestMatches && g.versions.length > 1) {
        autoIds.add(g.lineageId)
      }
    }
    return { filtered: matched, autoExpandIds: autoIds }
  }, [lineageGroups, search])

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
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
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
          const hasMultiple = g.versions.length > 1
          const olderCount = g.versions.length - 1
          const isExpanded = expandedLineages[g.lineageId] || autoExpandIds.has(g.lineageId)

          return (
            <div key={g.lineageId} style={{
              marginBottom: 6, marginTop: 6,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 10,
            }}>
              {/* Header row (not clickable) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <HighlightMatch text={latest.name} query={search} />
                </div>
                {publishedSets?.some(s => (s.lineageId || s.id) === g.lineageId) && (
                  <svg width={11} height={11} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="6" stroke="var(--accent-blue)" strokeWidth="1.2" />
                    <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="var(--accent-blue)" strokeWidth="0.9" />
                    <line x1="2" y1="8" x2="14" y2="8" stroke="var(--accent-blue)" strokeWidth="0.9" />
                  </svg>
                )}
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

              {/* Description */}
              {latest.description && (
                <div style={{
                  fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{latest.description}</div>
              )}

              {/* Latest version item (always visible) */}
              <VersionItem v={latest} isSelected={latest.id === selectedId} onSelect={onSelect} />

              {/* Expand trigger + older versions */}
              {hasMultiple && (
                <>
                  <div
                    onClick={() => toggleLineage(g.lineageId)}
                    style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                      cursor: 'pointer', padding: '4px 0', marginTop: 4,
                      transition: 'color 100ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-indigo)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  >
                    <span style={{ fontSize: 20, verticalAlign: 'middle' }}>{isExpanded ? '▾' : '▸'}</span> {olderCount} older version{olderCount !== 1 ? 's' : ''}
                  </div>

                  {isExpanded && (
                    <div style={olderCount > 5 ? { maxHeight: 180, overflowY: 'auto' } : undefined}>
                      {g.versions.slice(1).map(v => (
                        <VersionItem key={v.id} v={v} isSelected={v.id === selectedId} onSelect={onSelect} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Published standards — anchored to bottom */}
      {publishedSets && (() => {
        const externalSets = publishedSets.filter(s => !sets.some(own => own.id === s.id))
        if (externalSets.length === 0) return null

        return (
          <div style={{
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div
              onClick={() => setPubExpanded(prev => !prev)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '12px 14px', cursor: 'pointer',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="var(--accent-blue)" strokeWidth="1.2" />
                <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="var(--accent-blue)" strokeWidth="0.9" />
                <line x1="2" y1="8" x2="14" y2="8" stroke="var(--accent-blue)" strokeWidth="0.9" />
              </svg>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '0.06em', flex: 1 }}>
                PUBLISHED STANDARDS · {externalSets.length}
              </span>
              <span style={{
                fontSize: 16, color: 'var(--text-dim)',
                transform: pubExpanded ? 'rotate(90deg)' : 'rotate(0)',
                transition: 'transform 180ms', display: 'inline-block',
              }}>▸</span>
            </div>
            {pubExpanded && (
              <div style={{ maxHeight: 200, overflowY: 'auto', padding: '0 14px 12px' }}>
                {externalSets.map(s => (
                  <div key={s.id} style={{
                    padding: '8px 10px', marginBottom: 4, borderRadius: 6,
                    border: `1px solid ${selectedId === s.id ? 'var(--accent-blue)' : 'var(--border)'}`,
                    background: selectedId === s.id ? 'color-mix(in srgb, var(--accent-blue) 5%, transparent)' : 'transparent',
                    cursor: 'pointer', transition: 'all 100ms',
                  }}
                  onClick={() => onSelect(s.id)}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', display: 'flex', gap: 6 }}>
                      <span>{s._publishedBy}</span>
                      <span>v{s.version || 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

/* ─── Right Panel: View Details ─── */
function ViewDetails({ rs, onNewVersion, allSets, searchQuery, onPublish, publishedSets }) {
  const isPublished = useMemo(() => {
    if (!publishedSets) return false
    const lineage = rs.lineageId || rs.id
    return publishedSets.some(s => (s.lineageId || s.id) === lineage)
  }, [rs, publishedSets])

  const publishedVersion = useMemo(() => {
    if (!publishedSets) return null
    const lineage = rs.lineageId || rs.id
    const match = publishedSets.find(s => (s.lineageId || s.id) === lineage)
    return match?.version || null
  }, [rs, publishedSets])

  const [showPublishConfirm, setShowPublishConfirm] = useState(false)

  const newerExists = useMemo(() => {
    if (!rs.lineageId) return false
    return allSets.some(s => s.lineageId === rs.lineageId && (s.version || 1) > (rs.version || 1))
  }, [rs, allSets])

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
      {/* Title row: name + version + New Version button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', flex: 1, minWidth: 0 }}>{rs.name}</div>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '2px 7px', borderRadius: 4, flexShrink: 0,
          color: 'var(--accent-indigo)',
          background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
        }}>v{rs.version || 1}</span>
        <span
          onClick={onNewVersion}
          style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
            cursor: 'pointer', padding: '5px 10px', borderRadius: 4, flexShrink: 0,
            border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
            transition: 'background 100ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >New Version</span>
        {onPublish && !isPublished && (
          <span
            onClick={() => setShowPublishConfirm(true)}
            style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)',
              cursor: 'pointer', padding: '5px 10px', borderRadius: 4, flexShrink: 0,
              border: '1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent)',
              transition: 'background 100ms',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 8%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
            </svg>
            Publish
          </span>
        )}
        {isPublished && (
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: 'var(--accent-blue)', padding: '3px 8px', borderRadius: 4,
            background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)',
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          }}>
            <svg width={11} height={11} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
            </svg>
            PUBLISHED{publishedVersion && publishedVersion !== (rs.version || 1) ? ` (v${publishedVersion})` : ''}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4 }}>Created {rs.created}</div>
      {rs._published && (
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', marginTop: 2 }}>
          Published by {rs._publishedBy} · {rs._publishedDate}
        </div>
      )}
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
      {isPublished && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent-blue) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-blue) 15%, transparent)',
          fontSize: 11, color: 'var(--accent-blue)', lineHeight: 1.5,
        }}>
          This standard is published to the Radiant Network. Connected parties can evaluate against it.
        </div>
      )}
      {showPublishConfirm && (
        <div style={{
          marginTop: 12, padding: '14px 16px', borderRadius: 8,
          background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 8 }}>
            Confirm Publication
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 12 }}>
            Publishing this standard to the Radiant Network will make it visible to all connected parties. They will be able to evaluate their assets against it. This action cannot be undone — published standards remain available even if you create newer versions.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowPublishConfirm(false)} style={{
              padding: '6px 14px', borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)',
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={() => { onPublish(rs); setShowPublishConfirm(false) }} style={{
              padding: '6px 14px', borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
              border: '1px solid color-mix(in srgb, var(--accent-blue) 40%, transparent)',
              background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
              color: 'var(--accent-blue)', cursor: 'pointer',
            }}>Publish to Network</button>
          </div>
        </div>
      )}

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
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}><HighlightMatch text={req.label} query={searchQuery} /></div>
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
  const [csvStatus, setCsvStatus] = useState(null) // { type: 'success'|'error', msg }
  const fileInputRef = useRef(null)

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    const results = []
    for (let i = 0; i < lines.length; i++) {
      const fields = []
      let current = ''
      let inQuotes = false
      for (const char of lines[i]) {
        if (char === '"') { inQuotes = !inQuotes; continue }
        if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue }
        current += char
      }
      fields.push(current.trim())
      if (i === 0) {
        const first = fields[0]?.toLowerCase()
        if (['type', 'requirement type', 'req type', 'category'].includes(first)) continue
      }
      if (fields.length < 2) continue
      const typeRaw = (fields[0] || '').toLowerCase()
      const label = fields[1] || ''
      const description = fields[2] || ''
      if (!label) continue
      const type = ['infer', 'inference', 'inf', 'i'].includes(typeRaw) ? 'inference' : 'extraction'
      results.push({
        id: `req-csv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        type, label, description,
      })
    }
    return results
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target.result
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setCsvStatus({ type: 'error', msg: 'No valid requirements found in file' })
        return
      }
      const nameFromFile = file.name.replace(/\.[^.]+$/, '')
      setEditName(nameFromFile)
      setEditDescription('')
      setEditRequirements(parsed)
      const extCount = parsed.filter(r => r.type === 'extraction').length
      const infCount = parsed.filter(r => r.type === 'inference').length
      setCsvStatus({ type: 'success', msg: `Imported ${parsed.length} requirements from ${file.name} (${extCount} extraction, ${infCount} inference)` })
      setTimeout(() => { setActiveTab('manual'); setCsvStatus(null) }, 1500)
    }
    reader.onerror = () => {
      setCsvStatus({ type: 'error', msg: 'Failed to read file' })
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

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
              Set name will be derived from the filename. You can review and edit before saving.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <span
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
                padding: '8px 20px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid color-mix(in srgb, var(--accent-indigo) 30%, transparent)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Choose File</span>
            {csvStatus && (
              <div style={{
                marginTop: 16, fontSize: 12, lineHeight: 1.6,
                color: csvStatus.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
              }}>{csvStatus.msg}</div>
            )}
          </div>
        ) : (activeTab === 'manual' || isNewVersion) ? (
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

            {editRequirements.map((req, reqIdx) => (
              <div key={req.id} style={{
                marginBottom: 8, padding: '10px 12px',
                background: 'var(--bg-card)', borderRadius: 6,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                    data-req-label-input
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
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <div style={{ width: 48, flexShrink: 0 }} />
                  <input
                    value={req.description}
                    onChange={e => updateReq(req.id, 'description', e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Tab' && !e.shiftKey && reqIdx === editRequirements.length - 1) {
                        e.preventDefault()
                        addRequirement(req.type)
                        setTimeout(() => {
                          const inputs = document.querySelectorAll('[data-req-label-input]')
                          if (inputs.length > 0) inputs[inputs.length - 1].focus()
                        }, 50)
                      }
                    }}
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
export default function RequirementsPanel({ requirementSets, onClose, onSave, initialSelectedId, onPublish, publishedSets, _noBackdrop, embedded = false }) {
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('view')        // 'view' | 'create' | 'newversion'
  const [search, setSearch] = useState('')
  const [expandedLineages, setExpandedLineages] = useState({})
  const [pubExpanded, setPubExpanded] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRequirements, setEditRequirements] = useState([])

  // New version context
  const [sourceLineageId, setSourceLineageId] = useState(null)
  const [sourceName, setSourceName] = useState('')
  const [draftVersion, setDraftVersion] = useState(null)

  // Auto-select initial set when opened with a specific ID
  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId)
      setMode('view')
      const rs = requirementSets.find(s => s.id === initialSelectedId)
      if (rs?.lineageId) {
        setExpandedLineages(prev => ({ ...prev, [rs.lineageId]: true }))
      }
    }
  }, [initialSelectedId])

  const selectedSet = useMemo(() => requirementSets.find(s => s.id === selectedId) || publishedSets?.find(s => s.id === selectedId), [requirementSets, publishedSets, selectedId])

  const toggleLineage = useCallback((lid) => {
    setExpandedLineages(prev => ({ ...prev, [lid]: !prev[lid] }))
  }, [])

  // Wrap onClose so Escape / backdrop-click exits sub-mode before closing modal
  const handleModalClose = useCallback(() => {
    if (mode !== 'view') {
      setMode('view')
      setEditRequirements([])
      setSourceLineageId(null)
      setSourceName('')
      setDraftVersion(null)
      return
    }
    onClose()
  }, [mode, onClose])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        // Phase 10.3: in embedded mode, only intercept ESC while editing —
        // otherwise let the parent LibraryModal's handler close the whole
        // dialog. Non-embedded behaviour (own modal frame) unchanged.
        if (embedded && mode === 'view') return
        e.preventDefault()
        e.stopPropagation()
        handleModalClose()
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [handleModalClose, embedded, mode])

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
    const completeReqs = editRequirements.filter(r => r.label.trim() && r.description.trim())
    const trimmedName = editName.trim()

    let lineageId, version
    if (mode === 'newversion' && sourceLineageId) {
      lineageId = sourceLineageId
      version = draftVersion
    } else {
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
        searchQuery={search}
        onPublish={onPublish}
        publishedSets={publishedSets}
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

  // Phase 10.3: shared inner two-panel body — used by both standalone (with
  // own frame + header) and embedded (parent supplies frame + tab bar) modes.
  const innerBody = (
    <>
      {/* Embedded toolbar: just the Create button + count line, since the
          parent LibraryModal owns the title and close affordance. */}
      {embedded && (
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {requirementSets.length} requirement set{requirementSets.length !== 1 ? 's' : ''}
          </div>
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
        </div>
      )}
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
          publishedSets={publishedSets}
          pubExpanded={pubExpanded}
          setPubExpanded={setPubExpanded}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {rightContent}
        </div>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {innerBody}
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

      {innerBody}
    </div>
  )

  return _noBackdrop ? content : <Backdrop onClose={handleModalClose}>{content}</Backdrop>
}
