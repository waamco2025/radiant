// RequirementsSetPicker — Phase 12.1 (#120).
//
// Shared multi-select picker for Referenced Standards on a Claim. Used by
// V22CreateClaimModal (initial selection) and AmendClaimModal (add to
// existing). Two tabs: "My Requirements Sets" (owner's authored pool) and
// "Published" (Public Directory pool, filtered to RS authored by other
// parties — own-published-but-also-authored RS naturally show up under
// "My" via the same lineage).
//
// Selection model: ids are version-pinned. The picker hands back an
// array of RS ids; the caller stamps `addedDate` at submit time.
//
// Disabled rows: when `lockedIds` contains an RS id, the row is rendered
// non-clickable with a "Already referenced" hint badge. AmendClaim uses
// this to surface (but disable) RS already on the Claim, so the user
// sees both pools without an awkward filtered-vs-unfiltered toggle.

import { useMemo, useState } from 'react'

export default function RequirementsSetPicker({
  ownRequirementSets = [],
  publicRequirementSets = [],   // already filtered to "not authored by me"
  selectedIds = [],             // controlled
  onToggle,                     // (rsId) => void
  lockedIds = [],
  // Phase 12.1: minimal hint copy reused by helper text in callers.
  emptyOwnHint = 'You have not authored any Requirements Sets yet. Open Library → Requirement Sets to create one.',
  emptyPublicHint = 'No publicly published Requirements Sets are available right now.',
}) {
  const [tab, setTab] = useState('own')
  const [search, setSearch] = useState('')

  const lockedSet = useMemo(() => new Set(lockedIds), [lockedIds])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const activePool = tab === 'own' ? ownRequirementSets : publicRequirementSets
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activePool
    return activePool.filter((rs) => {
      const name = (rs.name || '').toLowerCase()
      const desc = (rs.description || '').toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [activePool, search])

  const counts = {
    own: ownRequirementSets.length,
    public: publicRequirementSets.length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'own', label: 'My Requirements Sets', count: counts.own },
          { id: 'public', label: 'Published', count: counts.public },
        ].map((t) => {
          const isActive = tab === t.id
          return (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent-indigo)' : 'var(--text-tertiary)',
                borderBottom: isActive
                  ? '2px solid var(--accent-indigo)'
                  : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 100ms',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{t.label}</span>
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)',
                color: isActive ? 'var(--accent-indigo)' : 'var(--text-dim)',
                background: isActive
                  ? 'color-mix(in srgb, var(--accent-indigo) 14%, transparent)'
                  : 'var(--bg-raised)',
                padding: '1px 6px', borderRadius: 8,
              }}>{t.count}</span>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or description…"
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 5,
          border: '1px solid var(--border)', background: 'var(--bg-card)',
          color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 12,
          outline: 'none', boxSizing: 'border-box',
        }}
      />

      {/* List */}
      <div style={{
        maxHeight: 240, overflowY: 'auto',
        border: '1px solid var(--border)', borderRadius: 8,
        background: 'var(--bg-card)',
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 14, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {tab === 'own' ? emptyOwnHint : emptyPublicHint}
            {search.trim() && (
              <span> No matches for &ldquo;{search.trim()}&rdquo;.</span>
            )}
          </div>
        ) : (
          filtered.map((rs, i) => {
            const sel = selectedSet.has(rs.id)
            const locked = lockedSet.has(rs.id)
            return (
              <div
                key={rs.id}
                onClick={locked ? undefined : () => onToggle?.(rs.id)}
                role="checkbox"
                aria-checked={sel}
                aria-disabled={locked}
                tabIndex={locked ? -1 : 0}
                onKeyDown={(e) => {
                  if (locked) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggle?.(rs.id)
                  }
                }}
                style={{
                  padding: '10px 14px',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  background: locked
                    ? 'color-mix(in srgb, var(--text-dim) 4%, transparent)'
                    : sel ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)' : 'transparent',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-faint)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 10,
                  opacity: locked ? 0.55 : 1,
                  transition: 'background 120ms',
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  border: `1.5px solid ${locked ? 'var(--text-dim)' : sel ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
                  background: locked ? 'var(--text-dim)' : sel ? 'var(--accent-indigo)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {(sel || locked) && <span style={{ color: 'var(--bg-deep)', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{rs.name}</div>
                    {rs.version != null && (
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)',
                        color: 'var(--text-dim)',
                        flexShrink: 0,
                      }}>v{rs.version}</span>
                    )}
                    {locked && (
                      <span style={{
                        fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        letterSpacing: '0.1em',
                        padding: '1px 5px', borderRadius: 3,
                        color: 'var(--text-dim)',
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border)',
                        flexShrink: 0,
                      }}>ALREADY REFERENCED</span>
                    )}
                  </div>
                  {rs.description && (
                    <div style={{
                      fontSize: 10, color: 'var(--text-dim)', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{rs.description}</div>
                  )}
                  {tab === 'public' && rs._publishedBy && (
                    <div style={{
                      fontSize: 9, color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)', marginTop: 2,
                    }}>
                      Published by {rs._publishedBy}
                      {rs._publishedDate ? ` · ${rs._publishedDate}` : ''}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
