import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { actors } from './v3Data.js'
import { FIELD_CATEGORIES } from './parseTemplates.js'

const tabs = [
  { id: 'templates', label: 'Parse Templates', accent: 'var(--accent-purple, #a78bfa)' },
  { id: 'reqsets', label: 'Requirement Sets', accent: 'var(--accent-indigo)' },
  { id: 'published', label: 'Published Standards', accent: 'var(--accent-amber)' },
]

function ItemList({ items, selectedId, onSelect, search, setSearch, expandedLineages, toggleLineage, accent, isPublished }) {
  const filtered = items.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  )

  // Group by lineage for non-published
  const groups = useMemo(() => {
    if (isPublished) return filtered.map(t => ({ latest: t, versions: [t] }))
    const lineageMap = {}
    filtered.forEach(t => {
      const lid = t.lineageId || t.id
      if (!lineageMap[lid]) lineageMap[lid] = []
      lineageMap[lid].push(t)
    })
    return Object.entries(lineageMap).map(([lid, versions]) => {
      const sorted = [...versions].sort((a, b) => (b.version || 0) - (a.version || 0))
      return { lineageId: lid, latest: sorted[0], versions: sorted }
    })
  }, [filtered, isPublished])

  return (
    <div style={{
      width: 320, borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ padding: '12px 14px', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            width: '100%', padding: '7px 10px', fontSize: 11,
            fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
            background: 'var(--bg-deep, var(--bg-card))',
            border: '1px solid var(--border)', borderRadius: 5, outline: 'none',
          }}
          onFocus={e => e.currentTarget.style.borderColor = accent}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {groups.length === 0 && (
          <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
            No items found
          </div>
        )}
        {groups.map(g => {
          const expanded = expandedLineages[g.lineageId]
          const hasVersions = !isPublished && g.versions.length > 1
          return (
            <div key={g.lineageId || g.latest.id}>
              <div
                onClick={() => onSelect(g.latest.id)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: selectedId === g.latest.id ? `3px solid ${accent}` : '3px solid transparent',
                  background: selectedId === g.latest.id ? `color-mix(in srgb, ${accent} 6%, transparent)` : 'transparent',
                  transition: 'background 100ms, border-color 100ms',
                }}
                onMouseEnter={e => { if (selectedId !== g.latest.id) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (selectedId !== g.latest.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {hasVersions && (
                    <span
                      onClick={e => { e.stopPropagation(); toggleLineage(g.lineageId) }}
                      style={{ fontSize: 8, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {expanded ? '▾' : '▸'}
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.latest.name}
                  </span>
                  {!isPublished && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>
                      v{g.latest.version || 1}
                    </span>
                  )}
                  {isPublished && g.latest.publisher && (
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '1px 5px', borderRadius: 3,
                      color: 'var(--accent-amber)',
                      background: 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
                    }}>
                      {g.latest.publisher}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                  {(g.latest.fields || g.latest.requirements || []).length} {g.latest.fields ? 'fields' : 'requirements'} · {g.latest.created}
                </div>
              </div>
              {expanded && hasVersions && g.versions.slice(1).map(v => (
                <div
                  key={v.id}
                  onClick={() => onSelect(v.id)}
                  style={{
                    padding: '8px 14px 8px 32px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: selectedId === v.id ? `3px solid ${accent}` : '3px solid transparent',
                    background: selectedId === v.id ? `color-mix(in srgb, ${accent} 6%, transparent)` : 'transparent',
                    fontSize: 10, color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => { if (selectedId !== v.id) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (selectedId !== v.id) e.currentTarget.style.background = 'transparent' }}
                >
                  v{v.version || 1} · {v.created}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ViewDetails({ item, accent, isPublishedTab, onNewVersion }) {
  if (!item) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, textAlign: 'center' }}>
        Select an item to view details,<br />or create a new one.
      </div>
    </div>
  )

  const isTemplate = !!item.fields
  const items = isTemplate ? item.fields : item.requirements

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
            padding: '2px 8px', borderRadius: 4, color: accent,
            background: `color-mix(in srgb, ${accent} 10%, transparent)`,
          }}>
            v{item.version || 1}
          </span>
          {!isPublishedTab && (
            <button onClick={onNewVersion} style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              color: accent, background: 'transparent',
              border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
              transition: 'background 100ms',
            }}
              onMouseEnter={e => e.currentTarget.style.background = `color-mix(in srgb, ${accent} 8%, transparent)`}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              New Version
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 16 }}>
        {item.created}{item.publisher ? ` · ${item.publisherOrg}` : ''}
      </div>

      {isPublishedTab && item.publisherOrg && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 16,
          background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
          fontSize: 11, color: 'var(--text-secondary)',
        }}>
          Published by <strong style={{ color: 'var(--accent-amber)' }}>{item.publisherOrg}</strong>
        </div>
      )}

      {/* Description */}
      {item.description && (
        <>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>DESCRIPTION</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)' }}>
            {item.description}
          </div>
        </>
      )}

      {/* Context */}
      {item.context && (
        <>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>
            {isPublishedTab ? 'EVALUATION CONTEXT' : 'CONTEXT'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)', fontStyle: 'italic' }}>
            {item.context}
          </div>
        </>
      )}

      {/* Items */}
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{isTemplate ? 'FIELDS' : 'REQUIREMENTS'}</span>
        <span style={{ fontSize: 8, fontWeight: 400 }}><span style={{ color: 'var(--accent-red)' }}>*</span> required</span>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
        {(items || []).map((f, i) => {
          const cat = FIELD_CATEGORIES[f.category]
          return (
            <div key={f.id || i} style={{
              padding: '10px 12px',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
                  {f.required && <span style={{ fontSize: 9, color: 'var(--accent-red)', marginLeft: 4, fontWeight: 600 }}>*</span>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {f.format && (
                    <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em', background: 'color-mix(in srgb, var(--text-tertiary) 10%, transparent)', color: 'var(--text-tertiary)', border: '1px solid color-mix(in srgb, var(--text-tertiary) 20%, transparent)' }}>
                      {f.format.toUpperCase()}
                    </span>
                  )}
                  {cat && (
                    <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em', background: `color-mix(in srgb, ${cat.color} 10%, transparent)`, color: cat.color, border: `1px solid color-mix(in srgb, ${cat.color} 20%, transparent)` }}>
                      {cat.label.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              {f.instruction && <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 5 }}>{f.instruction}</div>}
              {f.criterion && (
                <div style={{ fontSize: 9, color: 'var(--accent-amber)', lineHeight: 1.5, marginTop: 5, padding: '3px 6px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-amber) 12%, transparent)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 600, letterSpacing: '0.06em' }}>CRITERION </span>{f.criterion}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Metadata */}
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>METADATA</div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
        {item.artifactUri && <div>URI: {item.artifactUri}</div>}
        <div>{(items || []).length} {isTemplate ? 'fields' : 'requirements'} · {(items || []).filter(f => f.required).length} required</div>
      </div>
    </div>
  )
}

function EditorForm({ activeTab, editName, setEditName, editDescription, setEditDescription, editContext, setEditContext, editItems, setEditItems, draftVersion, onSave, onCancel, accent }) {
  const isTemplate = activeTab === 'templates'

  const addItem = () => {
    setEditItems(prev => [...prev, {
      id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: '', instruction: '', format: 'text', category: 'identification', required: false,
      ...(isTemplate ? {} : { criterion: '' }),
    }])
  }

  const updateItem = (idx, field, value) => {
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const removeItem = (idx) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx))
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px', fontSize: 11,
    fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
    background: 'var(--bg-deep, var(--bg-card))',
    border: '1px solid var(--border)', borderRadius: 5, outline: 'none',
    transition: 'border-color 150ms',
  }

  const canSave = editName.trim() && editItems.some(f => f.name?.trim())

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {draftVersion ? `New Version (v${draftVersion})` : `Create ${isTemplate ? 'Template' : 'Requirement Set'}`}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 16 }}>
          {isTemplate ? 'Define fields to extract from artifacts.' : 'Define requirements to evaluate against.'}
        </div>

        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>NAME</div>
        <input value={editName} onChange={e => { if (!draftVersion) setEditName(e.target.value) }} readOnly={!!draftVersion}
          placeholder={isTemplate ? 'Template name...' : 'Requirement set name...'}
          style={{ ...inputStyle, marginBottom: 14, opacity: draftVersion ? 0.6 : 1, cursor: draftVersion ? 'default' : 'text' }}
          onFocus={e => { if (!draftVersion) e.currentTarget.style.borderColor = accent }}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'} />

        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>DESCRIPTION</div>
        <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Describe the purpose..." rows={2}
          style={{ ...inputStyle, resize: 'vertical', marginBottom: 14, fontFamily: 'var(--font-display)' }}
          onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'} />

        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>CONTEXT</div>
        <textarea value={editContext} onChange={e => setEditContext(e.target.value)} placeholder="Document type hints..." rows={2}
          style={{ ...inputStyle, resize: 'vertical', marginBottom: 14, fontFamily: 'var(--font-display)' }}
          onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'} />

        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>
          {isTemplate ? 'FIELDS' : 'REQUIREMENTS'}
        </div>

        {editItems.map((item, idx) => (
          <div key={item.id} style={{
            padding: '10px 12px', marginBottom: 8, borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-card, var(--bg-surface))',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                placeholder={isTemplate ? 'Field name' : 'Requirement name'}
                style={{ ...inputStyle, flex: 1, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-display)' }}
                onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={item.required || false} onChange={e => updateItem(idx, 'required', e.target.checked)} />
                Req
              </label>
              <button onClick={() => removeItem(idx)} style={{
                background: 'none', border: 'none', fontSize: 12,
                color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px',
              }}>✕</button>
            </div>
            <textarea value={item.instruction || ''} onChange={e => updateItem(idx, 'instruction', e.target.value)}
              placeholder="Extraction instruction..." rows={2}
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 6, fontSize: 10, fontFamily: 'var(--font-display)' }}
              onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'} />
            {!isTemplate && (
              <textarea value={item.criterion || ''} onChange={e => updateItem(idx, 'criterion', e.target.value)}
                placeholder="SAT/UNSAT criterion..." rows={2}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: 6, fontSize: 10, fontFamily: 'var(--font-display)' }}
                onFocus={e => e.currentTarget.style.borderColor = accent} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'} />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={item.format || 'text'} onChange={e => updateItem(idx, 'format', e.target.value)}
                style={{ ...inputStyle, width: 'auto', fontSize: 10 }}>
                <option value="text">Text</option>
                <option value="value">Value</option>
                <option value="range">Range</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>
              <select value={item.category || 'identification'} onChange={e => updateItem(idx, 'category', e.target.value)}
                style={{ ...inputStyle, width: 'auto', fontSize: 10 }}>
                {Object.entries(FIELD_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
        ))}

        {editItems.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', border: '1px dashed var(--border)', borderRadius: 6 }}>
            Click "+ Add" to add {isTemplate ? 'fields' : 'requirements'}
          </div>
        )}

        <button onClick={addItem} style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
          color: accent, cursor: 'pointer', padding: '6px 12px', borderRadius: 4,
          border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
          background: 'transparent', marginTop: 8, width: '100%',
          transition: 'background 100ms',
        }}
          onMouseEnter={e => e.currentTarget.style.background = `color-mix(in srgb, ${accent} 8%, transparent)`}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          + Add {isTemplate ? 'Field' : 'Requirement'}
        </button>
      </div>

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={onCancel} style={{
          padding: '8px 18px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={onSave} disabled={!canSave} style={{
          padding: '8px 20px', borderRadius: 6,
          border: `1px solid ${accent}`, background: accent,
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.4,
        }}>Save</button>
      </div>
    </div>
  )
}

export default function LibraryModal({ parseTemplates, requirementSets, publishedStandards, actorId, onClose, onSaveTemplate, onSaveReqSet }) {
  const [activeTab, setActiveTab] = useState('templates')
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('view')
  const [search, setSearch] = useState('')
  const [expandedLineages, setExpandedLineages] = useState({})

  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editContext, setEditContext] = useState('')
  const [editItems, setEditItems] = useState([])
  const [sourceLineageId, setSourceLineageId] = useState(null)
  const [draftVersion, setDraftVersion] = useState(null)

  const currentItems = useMemo(() => {
    if (activeTab === 'templates') return parseTemplates
    if (activeTab === 'reqsets') return requirementSets
    if (activeTab === 'published') return publishedStandards
    return []
  }, [activeTab, parseTemplates, requirementSets, publishedStandards])

  const selectedItem = useMemo(() => currentItems.find(t => t.id === selectedId), [currentItems, selectedId])
  const accent = tabs.find(t => t.id === activeTab)?.accent || 'var(--accent-amber)'

  const handleClose = useCallback(() => {
    if (mode !== 'view') { setMode('view'); return }
    onClose()
  }, [mode, onClose])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          document.activeElement.blur(); return
        }
        e.stopPropagation()
        handleClose()
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [handleClose])

  const handleSelect = useCallback((id) => { setSelectedId(id); setMode('view') }, [])
  const toggleLineage = useCallback((lid) => { setExpandedLineages(prev => ({ ...prev, [lid]: !prev[lid] })) }, [])

  const handleCreate = useCallback(() => {
    setEditName(''); setEditDescription(''); setEditContext(''); setEditItems([])
    setSourceLineageId(null); setDraftVersion(null); setMode('create')
  }, [])

  const handleNewVersion = useCallback(() => {
    if (!selectedItem) return
    const lid = selectedItem.lineageId || selectedItem.id
    const items = selectedItem.fields || selectedItem.requirements || []
    const maxVer = currentItems.filter(t => (t.lineageId || t.id) === lid).reduce((max, t) => Math.max(max, t.version || 1), 0)
    setEditName(selectedItem.name)
    setEditDescription(selectedItem.description || '')
    setEditContext(selectedItem.context || '')
    setEditItems(items.map(f => ({ ...f, id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}` })))
    setSourceLineageId(lid)
    setDraftVersion(maxVer + 1)
    setMode('newversion')
  }, [selectedItem, currentItems])

  const handleSave = useCallback(() => {
    const completeItems = editItems.filter(f => f.name?.trim())
    const now = new Date().toISOString().slice(0, 10)
    let lineageId, version
    if (mode === 'newversion' && sourceLineageId) { lineageId = sourceLineageId; version = draftVersion }
    else { lineageId = `lineage-${activeTab === 'templates' ? 'pt' : 'rs'}-${Date.now().toString(36)}`; version = 1 }

    const owner = actors.find(a => a.id === actorId)
    const orgSlug = owner?.org?.toLowerCase()?.replace(/\s+/g, '-') || 'unknown'

    const newItem = {
      id: `${activeTab === 'templates' ? 'pt' : 'rs'}-${Date.now().toString(36)}-v${version}`,
      lineageId, version,
      name: editName.trim(),
      description: editDescription.trim(),
      context: editContext.trim() || undefined,
      created: now,
      artifactUri: `qs://${orgSlug}/${activeTab === 'templates' ? 'templates' : 'reqsets'}/${editName.trim().toLowerCase().replace(/\s+/g, '-')}.json`,
    }

    if (activeTab === 'templates') { newItem.fields = completeItems; onSaveTemplate(newItem) }
    else { newItem.requirements = completeItems; onSaveReqSet(newItem) }

    setSelectedId(newItem.id); setMode('view')
  }, [editName, editDescription, editContext, editItems, mode, sourceLineageId, draftVersion, activeTab, actorId, onSaveTemplate, onSaveReqSet])

  const rightContent = mode === 'view'
    ? <ViewDetails item={selectedItem} accent={accent} isPublishedTab={activeTab === 'published'} onNewVersion={handleNewVersion} />
    : <EditorForm activeTab={activeTab} editName={editName} setEditName={setEditName} editDescription={editDescription} setEditDescription={setEditDescription} editContext={editContext} setEditContext={setEditContext} editItems={editItems} setEditItems={setEditItems} draftVersion={draftVersion} onSave={handleSave} onCancel={() => setMode('view')} accent={accent} />

  return createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 1000, height: '82vh',
        background: 'var(--bg-surface)', borderRadius: 14,
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Library</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeTab !== 'published' && mode === 'view' && (
                <button onClick={handleCreate} style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: accent, cursor: 'pointer', padding: '5px 12px', borderRadius: 6,
                  border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                  background: 'transparent', transition: 'background 100ms',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = `color-mix(in srgb, ${accent} 8%, transparent)`}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  + Create {activeTab === 'templates' ? 'Template' : 'Requirement Set'}
                </button>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >✕</button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, marginTop: 12 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSelectedId(null); setMode('view'); setSearch('') }}
              style={{
                padding: '10px 18px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-display)',
                color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: 'none', border: 'none',
                borderBottom: activeTab === t.id ? `2px solid ${t.accent}` : '2px solid transparent',
                cursor: 'pointer', marginBottom: -1, transition: 'color 100ms',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Two-panel body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ItemList items={currentItems} selectedId={selectedId} onSelect={handleSelect} search={search} setSearch={setSearch}
            expandedLineages={expandedLineages} toggleLineage={toggleLineage} accent={accent} isPublished={activeTab === 'published'} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {rightContent}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
