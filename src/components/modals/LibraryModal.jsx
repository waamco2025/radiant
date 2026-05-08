// LibraryModal — Phase 10.3 unification of:
//   • Requirements Library (Requirement Sets, user's own + globe-marked publications)
//   • PEP Template Library (renamed to "Parsing Templates" in user-facing copy)
//   • Published Requirements (network-wide; includes user's own publications)
//
// Phase 10.4: legacy library modals relocated to `./library/` subdirectory and
// renamed as `RequirementsPanel` + `ParsingTemplatesPanel`. They keep their
// `embedded` prop and existing API; only the file path + export identifier
// changed.

import { useState, useEffect, useMemo } from 'react'
import { Backdrop } from './ModalShared.jsx'
import RequirementsPanel from './library/RequirementsPanel.jsx'
import ParsingTemplatesPanel from './library/ParsingTemplatesPanel.jsx'
// Phase 14.0 (#169 part 1): Badge Template tab.
import BadgesPanel from './library/BadgesPanel.jsx'

const TAB_DEFS = [
  { id: 'parsing',      label: 'Parsing Templates' },
  { id: 'requirements', label: 'Requirement Sets' },
  { id: 'published',    label: 'Published Requirements' },
  { id: 'badges',       label: 'Badges' },
]

function TabBar({ active, onChange, counts }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border)',
      background: 'var(--bg-surface)', flexShrink: 0,
    }}>
      {TAB_DEFS.map((t) => {
        const isActive = t.id === active
        return (
          <div
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '12px 18px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent-indigo)' : 'var(--text-tertiary)',
              borderBottom: isActive
                ? '2px solid var(--accent-indigo)'
                : '2px solid transparent',
              marginBottom: -1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-tertiary)'
            }}
          >
            <span>{t.label}</span>
            {counts && typeof counts[t.id] === 'number' && (
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: isActive ? 'var(--accent-indigo)' : 'var(--text-dim)',
                opacity: 0.85,
              }}>{counts[t.id]}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Published Requirements (read-only) ─── */
function PublishedRequirementsPanel({ publishedRequirementSets = [], initialSelectedId = null }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return publishedRequirementSets
    const q = search.toLowerCase()
    return publishedRequirementSets.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.requirements || []).some((r) =>
        (r.label || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      )
    )
  }, [publishedRequirementSets, search])

  const selected = useMemo(
    () => publishedRequirementSets.find((s) => s.id === selectedId) || null,
    [publishedRequirementSets, selectedId]
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left: list */}
      <div style={{
        width: 320, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search published requirements…"
            style={{
              width: '100%', padding: '8px 10px',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-primary)', fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {filtered.length === 0 && (
            <div style={{
              fontSize: 11, color: 'var(--text-dim)', textAlign: 'center',
              padding: '32px 12px', lineHeight: 1.6,
            }}>
              {publishedRequirementSets.length === 0
                ? 'No published requirements yet.'
                : 'No matches.'}
            </div>
          )}
          {filtered.map((s) => {
            const isSelected = s.id === selectedId
            return (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  padding: '10px 12px', borderRadius: 6, marginBottom: 6,
                  cursor: 'pointer',
                  background: isSelected
                    ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'
                    : 'var(--bg-deep)',
                  border: `1px solid ${isSelected ? 'var(--accent-indigo)' : 'var(--border)'}`,
                  transition: 'background 120ms, border-color 120ms',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--border-hover)'
                    e.currentTarget.style.background = 'var(--bg-raised)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--bg-deep)'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {/* Globe icon — indicates published */}
                  <svg width={11} height={11} viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="var(--accent-indigo)" strokeWidth="1.2" fill="none" />
                    <ellipse cx="8" cy="8" rx="3" ry="6" stroke="var(--accent-indigo)" strokeWidth="1" fill="none" />
                    <line x1="2" y1="8" x2="14" y2="8" stroke="var(--accent-indigo)" strokeWidth="1" />
                  </svg>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{s.name}</span>
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                  v{s.version || 1} · {s.requirements?.length || 0} requirement{(s.requirements?.length || 0) === 1 ? '' : 's'}
                  {s._publishedByParty && (
                    <> · by {s._publishedByParty}</>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
            }}>Published · Read-only</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
              {selected.name}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 16 }}>
              v{selected.version || 1}
              {selected._publishedByParty && <> · published by {selected._publishedByParty}</>}
              {selected.created && <> · {selected.created}</>}
            </div>
            {selected.description && (
              <div style={{
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                padding: '12px 14px', background: 'var(--bg-deep)',
                border: '1px solid var(--border)', borderRadius: 6,
                marginBottom: 18,
              }}>
                {selected.description}
              </div>
            )}
            <div style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
            }}>Requirements ({selected.requirements?.length || 0})</div>
            {(selected.requirements || []).map((r) => (
              <div key={r.id || r.label} style={{
                padding: '10px 12px', marginBottom: 6,
                background: 'var(--bg-deep)', border: '1px solid var(--border)',
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{r.description}</div>
              </div>
            ))}
            <div style={{
              marginTop: 24, padding: '12px 14px', borderRadius: 6,
              background: 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 20%, transparent)',
              fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6,
            }}>
              Published Requirement Sets are read-only here. Use them to evaluate Claims you have an Evaluation Agreement with.
            </div>
          </div>
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 40, textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
              {publishedRequirementSets.length === 0
                ? <>No published requirements visible to your network yet.</>
                : <>Select a published requirement set to view its details.</>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LibraryModal({
  pepTemplates = [],
  requirementSets = [],
  publishedRequirementSets = [],
  // Phase 14.0 (#169 part 1): Badge Templates — network-wide, public-by-
  // default Library artifact. The pool is shared (every Actor sees every
  // template); only own templates render with edit affordances. The
  // `activeParty` prop drives the own-vs-other gating in BadgesPanel.
  badgeTemplates = [],
  // Phase 14.1 (#169 part 2): Active Issuances data + handlers.
  // Phase 14.6 (#187): replaced `proofsOfEvaluation` with `allClaims` —
  // post-14.2 issuances reference Claims, so the Active Issuances rows
  // need a Claim-keyed lookup instead of a PoE-keyed one.
  badgeIssuances = [],
  allClaims = [],
  onSelectBadgeIssuance,
  onSavePepTemplate,
  onSaveRequirementSet,
  onPublishRequirementSet,
  onSaveBadgeTemplate,
  activeParty = null,
  initialTab = 'requirements',
  initialSelectedId = null,
  onClose,
  _noBackdrop = false,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'requirements')

  // ESC closes the modal — but only when the embedded child isn't editing.
  // The embedded child's own ESC handler intercepts in edit mode (capture
  // phase + stopPropagation); this listener fires when the child lets the
  // event through (view mode).
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const counts = {
    parsing: pepTemplates.length,
    requirements: requirementSets.length,
    published: publishedRequirementSets.length,
    // Phase 14.6.2 Item 1 — match BadgesPanel's own-only filter so the tab
    // count parallels the panel toolbar count (Bug A from 14.6.1 covered the
    // panel; this covers the tab strip).
    badges: activeParty
      ? badgeTemplates.filter((t) => t.ownerParty === activeParty).length
      : badgeTemplates.length,
  }

  const content = (
    <div style={{
      width: 1080, height: '82vh', background: 'var(--bg-surface)',
      borderRadius: 14, border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>Library</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Parsing templates, requirement sets, and published standards
          </div>
        </div>
        <span
          onClick={onClose}
          style={{
            fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer',
            padding: '4px 8px', borderRadius: 4, transition: 'color 100ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
        >×</span>
      </div>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} counts={counts} />

      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 'parsing' && (
          <ParsingTemplatesPanel
            pepTemplates={pepTemplates}
            onClose={onClose}
            onSave={onSavePepTemplate}
            initialSelectedId={activeTab === initialTab ? initialSelectedId : null}
            embedded
          />
        )}
        {activeTab === 'requirements' && (
          <RequirementsPanel
            requirementSets={requirementSets}
            onClose={onClose}
            onSave={onSaveRequirementSet}
            onPublish={onPublishRequirementSet}
            publishedSets={publishedRequirementSets}
            initialSelectedId={activeTab === initialTab ? initialSelectedId : null}
            embedded
          />
        )}
        {activeTab === 'published' && (
          <PublishedRequirementsPanel
            publishedRequirementSets={publishedRequirementSets}
            initialSelectedId={activeTab === initialTab ? initialSelectedId : null}
          />
        )}
        {activeTab === 'badges' && (
          <BadgesPanel
            badgeTemplates={badgeTemplates}
            requirementSets={requirementSets}
            publishedRequirementSets={publishedRequirementSets}
            badgeIssuances={badgeIssuances}
            allClaims={allClaims}
            onSelectBadgeIssuance={onSelectBadgeIssuance}
            activeParty={activeParty}
            onSave={onSaveBadgeTemplate}
            onClose={onClose}
            initialSelectedId={activeTab === initialTab ? initialSelectedId : null}
          />
        )}
      </div>
    </div>
  )

  return _noBackdrop ? content : <Backdrop onClose={onClose}>{content}</Backdrop>
}
