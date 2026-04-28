import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Backdrop } from './ModalShared.jsx'
import { FIELD_CATEGORIES, FIELD_TYPES } from '../../v2/pepTemplates.js'

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

/* ─── Version Item ─── */
function VersionItem({ v, isSelected, onSelect }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onSelect(v.id) }}
      style={{
        padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginTop: 6,
        background: isSelected
          ? 'color-mix(in srgb, var(--accent-purple, #a78bfa) 6%, transparent)'
          : 'var(--bg-deep)',
        border: `1px solid ${isSelected ? 'var(--accent-purple, #a78bfa)' : 'var(--border)'}`,
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
        color: isSelected ? 'var(--accent-purple, #a78bfa)' : 'var(--text-dim)',
        background: isSelected
          ? 'color-mix(in srgb, var(--accent-purple, #a78bfa) 10%, transparent)'
          : 'var(--bg-raised)',
      }}>v{v.version || 1}</span>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
        Created {v.created}
      </span>
    </div>
  )
}

/* ─── Left Panel: Template List ─── */
function TemplateList({ templates, selectedId, onSelect, search, setSearch, expandedLineages, toggleLineage }) {
  const lineageGroups = useMemo(() => {
    const map = new Map()
    for (const t of templates) {
      const lid = t.lineageId || t.id
      if (!map.has(lid)) map.set(lid, [])
      map.get(lid).push(t)
    }
    for (const [, arr] of map) arr.sort((a, b) => (b.version || 1) - (a.version || 1))
    return [...map.entries()]
      .map(([lid, versions]) => ({ lineageId: lid, versions, latest: versions[0] }))
      .sort((a, b) => (b.latest.created || '').localeCompare(a.latest.created || ''))
  }, [templates])

  const { filtered, autoExpandIds } = useMemo(() => {
    if (!search.trim()) return { filtered: lineageGroups, autoExpandIds: new Set() }
    const q = search.toLowerCase()
    const matched = []
    const autoIds = new Set()
    for (const g of lineageGroups) {
      const anyMatch = g.versions.some(t =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.fields.some(f => f.name.toLowerCase().includes(q))
      )
      if (!anyMatch) continue
      matched.push(g)
      const latestMatches =
        g.latest.name.toLowerCase().includes(q) ||
        (g.latest.description || '').toLowerCase().includes(q) ||
        g.latest.fields.some(f => f.name.toLowerCase().includes(q))
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
      <div style={{ padding: '12px 14px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
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
            >&times;</span>
          )}
        </div>
      </div>

      {search.trim() && (
        <div style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
          padding: '4px 14px', background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
        {templates.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.7 }}>
            No Parsing Templates yet.
          </div>
        )}
        {templates.length > 0 && filtered.length === 0 && (
          <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            No templates match &lsquo;{search}&rsquo;
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <HighlightMatch text={latest.name} query={search} />
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
                  {latest.fields.length} field{latest.fields.length !== 1 ? 's' : ''}
                </span>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                  color: 'var(--accent-purple, #a78bfa)',
                  background: 'color-mix(in srgb, var(--accent-purple, #a78bfa) 10%, transparent)',
                }}>v{latest.version || 1}</span>
              </div>

              {latest.description && (
                <div style={{
                  fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{latest.description}</div>
              )}

              <VersionItem v={latest} isSelected={latest.id === selectedId} onSelect={onSelect} />

              {hasMultiple && (
                <>
                  <div
                    onClick={() => toggleLineage(g.lineageId)}
                    style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                      cursor: 'pointer', padding: '4px 0', marginTop: 4, transition: 'color 100ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-purple, #a78bfa)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  >
                    <span style={{ fontSize: 20, verticalAlign: 'middle' }}>{isExpanded ? '\u25BE' : '\u25B8'}</span> {olderCount} older version{olderCount !== 1 ? 's' : ''}
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
    </div>
  )
}

/* ─── Right Panel: View Details ─── */
function ViewDetails({ template, onNewVersion, allTemplates, searchQuery }) {
  const newerExists = useMemo(() => {
    if (!template.lineageId) return false
    return allTemplates.some(t => t.lineageId === template.lineageId && (t.version || 1) > (template.version || 1))
  }, [template, allTemplates])

  // Group fields by category
  const groupedFields = useMemo(() => {
    const map = new Map()
    for (const f of template.fields) {
      const cat = f.category || 'other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(f)
    }
    return [...map.entries()]
  }, [template.fields])

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', flex: 1, minWidth: 0 }}>{template.name}</div>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '2px 7px', borderRadius: 4, flexShrink: 0,
          color: 'var(--accent-purple, #a78bfa)',
          background: 'color-mix(in srgb, var(--accent-purple, #a78bfa) 10%, transparent)',
        }}>v{template.version || 1}</span>
        <span
          onClick={onNewVersion}
          style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple, #a78bfa)',
            cursor: 'pointer', padding: '5px 10px', borderRadius: 4, flexShrink: 0,
            border: '1px solid color-mix(in srgb, var(--accent-purple, #a78bfa) 25%, transparent)',
            transition: 'background 100ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-purple, #a78bfa) 8%, transparent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >New Version</span>
      </div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4 }}>Created {template.created}</div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginTop: 10 }}>{template.description}</div>

      {newerExists && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
          fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.5,
        }}>
          A newer version of this template exists. You are viewing v{template.version || 1}.
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          FIELDS
        </span>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)',
          padding: '1px 6px', borderRadius: 4, background: 'var(--bg-raised)',
        }}>{template.fields.length}</span>
      </div>

      {groupedFields.map(([cat, fields]) => {
        const catConfig = FIELD_CATEGORIES[cat] || { label: cat, color: 'var(--text-dim)' }
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: catConfig.color, letterSpacing: '0.06em', marginBottom: 6,
            }}>
              {catConfig.label.toUpperCase()} ({fields.length})
            </div>
            {fields.map((f, i) => (
              <div key={f.id || i} style={{
                padding: '8px 0',
                borderBottom: i < fields.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                  color: catConfig.color,
                  background: `color-mix(in srgb, ${catConfig.color} 12%, transparent)`,
                  textTransform: 'uppercase',
                }}>{f.type}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <HighlightMatch text={f.name} query={searchQuery} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Right Panel: Editor Form ─── */
function EditorForm({ isNewVersion, sourceName, draftVersion, editName, setEditName, editDescription, setEditDescription,
  editFields, setEditFields, onSave, onCancel }) {

  const [activeTab, setActiveTab] = useState('manual')
  const [csvStatus, setCsvStatus] = useState(null)
  const fileInputRef = useRef(null)

  const catKeys = Object.keys(FIELD_CATEGORIES)

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
        if (['name', 'field name', 'field', 'label'].includes(first)) continue
      }
      if (fields.length < 1 || !fields[0]) continue
      const name = fields[0]
      const category = (fields[1] || 'mechanical').toLowerCase()
      const type = (fields[2] || 'text').toLowerCase()
      results.push({
        id: `f-csv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        name, category, type,
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
        setCsvStatus({ type: 'error', msg: 'No valid fields found in file' })
        return
      }
      const nameFromFile = file.name.replace(/\.[^.]+$/, '')
      setEditName(nameFromFile)
      setEditDescription('')
      setEditFields(parsed)
      setCsvStatus({ type: 'success', msg: `Imported ${parsed.length} fields from ${file.name}` })
      setTimeout(() => { setActiveTab('manual'); setCsvStatus(null) }, 1500)
    }
    reader.onerror = () => setCsvStatus({ type: 'error', msg: 'Failed to read file' })
    reader.readAsText(file)
    e.target.value = ''
  }

  const addField = () => {
    const id = `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
    setEditFields(prev => [...prev, { id, name: '', category: 'mechanical', type: 'text' }])
  }

  const updateField = (id, key, value) => {
    setEditFields(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f))
  }

  const removeField = (id) => {
    setEditFields(prev => prev.filter(f => f.id !== id))
  }

  const completeFieldCount = editFields.filter(f => f.name.trim()).length
  const canSave = editName.trim() && editDescription.trim() && completeFieldCount > 0

  const headerText = isNewVersion
    ? `New Version: ${sourceName || editName || 'Untitled'}`
    : 'Create Parsing Template'

  const tabs = [
    { id: 'manual', label: 'Manual' },
    { id: 'csv', label: 'Import CSV' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>{headerText}</div>
          {isNewVersion && draftVersion && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '1px 5px', borderRadius: 3,
              color: 'var(--accent-purple, #a78bfa)',
              background: 'color-mix(in srgb, var(--accent-purple, #a78bfa) 10%, transparent)',
            }}>v{draftVersion}</span>
          )}
        </div>

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
                    background: activeTab === t.id ? 'var(--accent-purple, #a78bfa)' : 'transparent',
                    color: activeTab === t.id ? '#fff' : 'var(--text-tertiary)',
                    transition: 'all 180ms',
                  }}
                >{t.label}</button>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Name, Category, Type</span>
              <br /><br />
              Template name will be derived from the filename. You can review and edit before saving.
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileSelect} style={{ display: 'none' }} />
            <span
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple, #a78bfa)',
                padding: '8px 20px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid color-mix(in srgb, var(--accent-purple, #a78bfa) 30%, transparent)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-purple, #a78bfa) 8%, transparent)'}
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
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.03em' }}>NAME</div>
            <input
              value={editName} onChange={e => setEditName(e.target.value)}
              placeholder="e.g. Electronics Component Profile"
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

            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.03em' }}>DESCRIPTION</div>
            <textarea
              value={editDescription} onChange={e => setEditDescription(e.target.value)}
              placeholder="What does this template extract?"
              rows={3}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                outline: 'none', resize: 'none', marginBottom: 20,
              }}
            />

            <div style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: 'var(--text-dim)', marginBottom: 10, letterSpacing: '0.03em',
            }}>
              FIELDS ({editFields.length})
            </div>

            {editFields.map((field, fi) => (
              <div key={field.id} style={{
                marginBottom: 8, padding: '10px 12px',
                background: 'var(--bg-card)', borderRadius: 6,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    data-field-name-input
                    value={field.name}
                    onChange={e => updateField(field.id, 'name', e.target.value)}
                    placeholder="Field name"
                    style={{
                      flex: 1, padding: '4px 8px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 12,
                      outline: 'none', minWidth: 0,
                    }}
                  />
                  <select
                    value={field.category}
                    onChange={e => updateField(field.id, 'category', e.target.value)}
                    style={{
                      width: 120, padding: '4px 6px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'var(--bg-card)',
                      color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 10,
                      outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {catKeys.map(k => (
                      <option key={k} value={k}>{FIELD_CATEGORIES[k].label}</option>
                    ))}
                  </select>
                  <select
                    value={field.type}
                    onChange={e => updateField(field.id, 'type', e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Tab' && !e.shiftKey && fi === editFields.length - 1) {
                        e.preventDefault()
                        addField()
                        setTimeout(() => {
                          const inputs = document.querySelectorAll('[data-field-name-input]')
                          if (inputs.length > 0) inputs[inputs.length - 1].focus()
                        }, 50)
                      }
                    }}
                    style={{
                      width: 90, padding: '4px 6px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'var(--bg-card)',
                      color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 10,
                      outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                  <span
                    onClick={() => removeField(field.id)}
                    style={{
                      fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer',
                      padding: '2px 4px', flexShrink: 0, transition: 'color 100ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  >&times;</span>
                </div>
              </div>
            ))}

            <span
              onClick={addField}
              style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple, #a78bfa)',
                cursor: 'pointer', padding: '6px 10px', borderRadius: 4,
                border: '1px solid color-mix(in srgb, var(--accent-purple, #a78bfa) 25%, transparent)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-purple, #a78bfa) 5%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >+ Add Field</span>
          </>
        ) : null}
      </div>

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
            background: 'var(--accent-purple, #a78bfa)', transition: 'opacity 100ms',
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
   MAIN MODAL — PEP Template Library (Split Panel)
   ═══════════════════════════════════════════════════════════════════════ */
export default function PEPLibraryModal({ pepTemplates, onClose, onSave, initialSelectedId, _noBackdrop, embedded = false }) {
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('view')
  const [search, setSearch] = useState('')
  const [expandedLineages, setExpandedLineages] = useState({})

  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editFields, setEditFields] = useState([])

  const [sourceLineageId, setSourceLineageId] = useState(null)
  const [sourceName, setSourceName] = useState('')
  const [draftVersion, setDraftVersion] = useState(null)

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId)
      setMode('view')
      const t = pepTemplates.find(s => s.id === initialSelectedId)
      if (t?.lineageId) {
        setExpandedLineages(prev => ({ ...prev, [t.lineageId]: true }))
      }
    }
  }, [initialSelectedId])

  const selectedTemplate = useMemo(() => pepTemplates.find(t => t.id === selectedId), [pepTemplates, selectedId])

  const toggleLineage = useCallback((lid) => {
    setExpandedLineages(prev => ({ ...prev, [lid]: !prev[lid] }))
  }, [])

  const handleModalClose = useCallback(() => {
    if (mode !== 'view') {
      setMode('view')
      setEditFields([])
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
        // Phase 10.3: in embedded mode, only intercept ESC while editing.
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
    setEditFields([])
    setSourceLineageId(null)
    setSourceName('')
    setDraftVersion(null)
    setMode('create')
  }

  const handleNewVersion = () => {
    if (!selectedTemplate) return
    const lid = selectedTemplate.lineageId || selectedTemplate.id
    const maxVersion = pepTemplates
      .filter(t => (t.lineageId || t.id) === lid)
      .reduce((max, t) => Math.max(max, t.version || 1), 0)
    setEditName(selectedTemplate.name)
    setEditDescription(selectedTemplate.description || '')
    setEditFields(selectedTemplate.fields.map(f => ({ ...f, id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}` })))
    setSourceLineageId(lid)
    setSourceName(selectedTemplate.name)
    setDraftVersion(maxVersion + 1)
    setMode('newversion')
  }

  const handleSave = () => {
    const completeFields = editFields.filter(f => f.name.trim())
    const trimmedName = editName.trim()

    let lineageId, version
    if (mode === 'newversion' && sourceLineageId) {
      lineageId = sourceLineageId
      version = draftVersion
    } else {
      lineageId = `lineage-pep-${Date.now().toString(36)}`
      version = 1
    }

    const template = {
      id: `pep-${Date.now().toString(36)}-v${version}`,
      lineageId,
      version,
      name: trimmedName,
      description: editDescription.trim(),
      created: new Date().toISOString().slice(0, 10),
      fields: completeFields,
    }
    onSave(template)
    setSelectedId(template.id)
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
        editFields={editFields} setEditFields={setEditFields}
        onSave={handleSave}
        onCancel={handleCancelEdit}
      />
    )
  } else if (selectedTemplate) {
    rightContent = (
      <ViewDetails
        template={selectedTemplate}
        onNewVersion={handleNewVersion}
        allTemplates={pepTemplates}
        searchQuery={search}
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
            <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="var(--text-dim)" strokeWidth="1.3" fill="none" />
            <line x1="2" y1="6" x2="14" y2="6" stroke="var(--text-dim)" strokeWidth="1" />
            <line x1="6" y1="6" x2="6" y2="13" stroke="var(--text-dim)" strokeWidth="1" />
            <line x1="10" y1="6" x2="10" y2="13" stroke="var(--text-dim)" strokeWidth="1" />
          </svg>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
            Select a template to view details,<br />or create a new one.
          </div>
        </div>
      </div>
    )
  }

  // Phase 10.3: shared inner two-panel body for embedded + standalone modes.
  const innerBody = (
    <>
      {embedded && (
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {pepTemplates.length} template{pepTemplates.length !== 1 ? 's' : ''}
          </div>
          {!isEditing && (
            <span
              onClick={handleCreate}
              style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: 'var(--accent-purple, #a78bfa)', cursor: 'pointer',
                padding: '6px 12px', borderRadius: 6,
                border: '1px solid color-mix(in srgb, var(--accent-purple, #a78bfa) 30%, transparent)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-purple, #a78bfa) 8%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >+ Create Parsing Template</span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <TemplateList
          templates={pepTemplates}
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
      <div style={{
        padding: '18px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>PEP Template Library</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {pepTemplates.length} template{pepTemplates.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isEditing && (
            <span
              onClick={handleCreate}
              style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: 'var(--accent-purple, #a78bfa)', cursor: 'pointer',
                padding: '6px 12px', borderRadius: 6,
                border: '1px solid color-mix(in srgb, var(--accent-purple, #a78bfa) 30%, transparent)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-purple, #a78bfa) 8%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >+ Create Template</span>
          )}
          <span
            onClick={onClose}
            style={{
              fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4, transition: 'color 100ms',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          >&times;</span>
        </div>
      </div>

      {innerBody}
    </div>
  )

  return _noBackdrop ? content : <Backdrop onClose={handleModalClose}>{content}</Backdrop>
}
