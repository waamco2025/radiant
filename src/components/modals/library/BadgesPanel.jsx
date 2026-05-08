// BadgesPanel — Phase 14.0 (#169 part 1), narrowed Phase 14.6.1.
//
// Library tab for Badge Templates. Parallel to RequirementsPanel: split
// left/right layout, own templates only, versioning UI.
// Saves through `onSave(template, { isNewVersion, priorTemplateId })` so
// V2App's `handleSaveBadgeTemplate` can update `supersededBy` on the prior
// version when applicable.
//
// Phase 14.6.1 (Bug A): narrowed from network-wide visibility to own-only.
// Original 14.0 design surfaced other parties' templates in alphabetical
// sections, but the canonical rule is that badge templates are private to
// their owner — only Published Standards (RSes) are cross-actor
// referenceable. Other actors' templates are now filtered out at the
// parent level before being passed to TemplateList.
//
// 14.0 ships the template + CRUD surface. Phase 14.1 layers Badge
// Issuance on top — that work surfaces issuance counts + actions in this
// panel's right side and adds a separate Issuance Detail Panel.
//
// Globe icon convention: every Badge Template is `published: true` in
// 14.0 (network-wide, no draft/private state). The globe still renders
// inline so the convention matches Published Standards rows in
// RequirementsPanel.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { makeArtifactId, makeBadgeTemplate, getLatestBadgeTemplateVersion } from '../../../v2/v2_2Data.js'
import ExpandedArtifactModal from '../ExpandedArtifactModal.jsx'

/* ─── Globe icon (matches LibraryModal pattern) ─── */
function GlobeIcon({ size = 11, color = 'var(--accent-blue)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  )
}

/* ─── Shield silhouette placeholder graphic ─── */
// Phase 14.0 placeholder until #181 ships user-uploaded badge graphics.
function BadgeShieldGlyph({ size = 18, color = 'var(--accent-indigo)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color }}>
      <path
        d="M8 1.5 L13 3.2 L13 8 C13 11.2 10.8 13.5 8 14.5 C5.2 13.5 3 11.2 3 8 L3 3.2 Z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="color-mix(in srgb, currentColor 12%, transparent)"
      />
      <path d="M5.6 8.2 L7.3 9.9 L10.4 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/* ─── Own templates list ─── */
// Phase 14.6.1 (Bug A): templates passed in are already pre-filtered to
// the active actor's own templates at the parent level. This list still
// renders the "MY BADGES · N" header for visual structure, but no longer
// renders cross-actor sections.
function TemplateList({ templates, activeParty, selectedId, onSelect }) {
  // Sort own templates by version (latest first within each lineage).
  const own = useMemo(() => {
    const list = templates.filter((t) => t.ownerParty === activeParty)
    list.sort((a, b) => (b.version || 1) - (a.version || 1))
    return list
  }, [templates, activeParty])

  const renderRow = (t) => {
    const isSelected = t.id === selectedId
    const isLatest = !t.supersededBy
    return (
      <div
        key={t.id}
        onClick={() => onSelect(t.id)}
        style={{
          padding: '10px 12px', borderRadius: 6, marginBottom: 6,
          cursor: 'pointer',
          background: isSelected
            ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'
            : 'var(--bg-deep)',
          border: `1px solid ${isSelected ? 'var(--accent-indigo)' : 'var(--border)'}`,
          transition: 'background 120ms, border-color 120ms',
          opacity: isLatest ? 1 : 0.78,
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
          <BadgeShieldGlyph size={14} />
          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.name}
          </span>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '1px 5px', borderRadius: 3, flexShrink: 0,
            color: 'var(--accent-indigo)',
            background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
          }}>v{t.version || 1}</span>
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{t.ownerParty}</span>
          <span>·</span>
          <span>{(t.referencedRequirementsSetIds || []).length} req set{(t.referencedRequirementsSetIds || []).length === 1 ? '' : 's'}</span>
          {t.supersededBy && (
            <>
              <span>·</span>
              <span style={{ color: 'var(--text-dim)' }}>SUPERSEDED</span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {own.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.7 }}>
            No badge templates yet.
          </div>
        )}
        {/* Phase 14.6.1 (Bug A): own templates only — cross-actor sections
            removed. The "MY BADGES · N" header still renders so the list
            has visible structure even with one section. */}
        {own.length > 0 && (
          <>
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.1em', color: 'var(--text-tertiary)',
              textTransform: 'uppercase', padding: '4px 4px 8px',
            }}>
              My Badges · {own.length}
            </div>
            {own.map(renderRow)}
          </>
        )}
      </div>
    </div>
  )
}

/* ─── ViewDetails — right-panel detail content ─── */
//
// Design decision 6 (Phase 14.0): renders Badge Template detail content.
// Also used as the BadgesPanel's "Detail Panel" surface — Active Issuances
// is a placeholder until 14.1.
function ViewDetails({
  template, allRequirementSets, isOwn, isLatest, onNewVersion, onSelectRequirementsSet, onExpand,
  // Phase 14.1 (#169 part 2): Active Issuances populated.
  // Phase 14.6 (#187): renamed from `poeNameLookup` to `claimNameLookup`
  // to complete the Phase 14.2 `targetPoeId` → `targetClaimId` migration.
  // Each entry: `{ name: <claim label>, ownerParty: <claim grantor party> }`.
  activeIssuances = [],
  lineageActiveIssuanceCount = 0,
  claimNameLookup = {},
  onSelectBadgeIssuance,
  // Phase 14.6.2 Item 5 — used to attribute own-RS rows whose RS objects
  // don't carry a `_publishedBy` field (own RSes live in `requirementSets`
  // per role, no explicit owner field). Published Standards carry
  // `_publishedBy` and override.
  activeParty = null,
}) {
  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <BadgeShieldGlyph size={22} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', flex: 1, minWidth: 0 }}>
          {template.name}
        </div>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '2px 7px', borderRadius: 4, flexShrink: 0,
          color: 'var(--accent-indigo)',
          background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
        }}>v{template.version || 1}</span>
        {isOwn && isLatest && (
          <span
            onClick={onNewVersion}
            style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
              cursor: 'pointer', padding: '5px 10px', borderRadius: 4, flexShrink: 0,
              border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
              transition: 'background 100ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >New Version</span>
        )}
        {onExpand && (
          <button
            onClick={onExpand}
            title="Expand to view Badge Template details"
            aria-label="Expand to view Badge Template details"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '3px 5px',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 100ms, border-color 100ms, color 100ms',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'
              e.currentTarget.style.borderColor = 'var(--accent-indigo)'
              e.currentTarget.style.color = 'var(--accent-indigo)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-tertiary)'
            }}
          >
            <svg width={11} height={11} viewBox="0 0 16 16" fill="none">
              <path d="M6 3 L13 3 L13 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 3 L7 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M3 7 L3 13 L9 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <GlobeIcon size={11} />
        <span>Owned by <strong style={{ color: 'var(--accent-blue)' }}>{template.ownerParty}</strong></span>
        <span>·</span>
        <span>Created {(template.createdDate || '').slice(0, 10)}</span>
      </div>
      {!isLatest && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)',
          fontSize: 11, color: 'var(--accent-amber)', lineHeight: 1.5,
        }}>
          A newer version of this Badge Template exists. You are viewing v{template.version || 1}.
        </div>
      )}
      {template.description && (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginTop: 12 }}>
          {template.description}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0 16px' }} />

      {/* Referenced Requirements Sets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          REFERENCED REQUIREMENTS SETS
        </span>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)',
          padding: '1px 6px', borderRadius: 4, background: 'var(--bg-raised)',
        }}>{(template.referencedRequirementsSetIds || []).length}</span>
      </div>
      {(template.referencedRequirementsSetIds || []).map((rsId) => {
        const rs = allRequirementSets.find((r) => r.id === rsId)
        const isPublished = rs?._published === true || rs?._publishedBy
        // Phase 14.6.2 Item 5 — RS owner attribution. Published Standards
        // carry `_publishedBy` (e.g. 'GovCo'); own RSes from
        // `requirementSets` carry no explicit owner field, so they fall
        // back to the active actor's party (own-RSes are by definition
        // owned by the viewer).
        const rsOwner = rs?._publishedBy || activeParty
        return (
          <div
            key={rsId}
            onClick={onSelectRequirementsSet ? () => onSelectRequirementsSet(rsId) : undefined}
            style={{
              padding: '10px 12px', marginBottom: 6, borderRadius: 6,
              background: 'var(--bg-deep)', border: '1px solid var(--border)',
              cursor: onSelectRequirementsSet ? 'pointer' : 'default',
              transition: 'background 100ms, border-color 100ms',
            }}
            onMouseEnter={onSelectRequirementsSet ? (e) => {
              e.currentTarget.style.background = 'var(--bg-raised)'
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 35%, var(--border))'
            } : undefined}
            onMouseLeave={onSelectRequirementsSet ? (e) => {
              e.currentTarget.style.background = 'var(--bg-deep)'
              e.currentTarget.style.borderColor = 'var(--border)'
            } : undefined}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rs?.name || rsId}
              </span>
              {isPublished && <GlobeIcon size={11} color="var(--accent-blue)" />}
              {rs && (
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                  color: 'var(--accent-indigo)',
                  background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                }}>v{rs.version || 1}</span>
              )}
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              {rsOwner || rsId}
            </div>
          </div>
        )
      })}

      {/* Phase 14.1 (#169 part 2): Active Issuances populated. Lists
          issuances of THIS specific template version. Subtext line shows
          total across the whole lineage. */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0 16px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          ACTIVE ISSUANCES
        </span>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-dim)',
          padding: '1px 6px', borderRadius: 4, background: 'var(--bg-raised)',
        }}>{activeIssuances.length}</span>
      </div>
      {activeIssuances.length === 0 ? (
        <div style={{
          padding: '14px 16px', borderRadius: 6,
          background: 'var(--bg-deep)', border: '1px solid var(--border)',
          fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.6, fontStyle: 'italic',
        }}>
          No active issuances of this version yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeIssuances.map((b) => {
            // Phase 14.6 (#187): post-14.2 migration. Read targetClaimId
            // (was targetPoeId) and pull Claim label + ownerParty from
            // the new claimNameLookup. Falls back to bare id when the
            // Claim isn't resolvable (defensive — shouldn't happen at
            // runtime).
            const lookupEntry = claimNameLookup[b.targetClaimId] || null
            const claimLabel = lookupEntry?.name || b.targetClaimId
            const ownerParty = lookupEntry?.ownerParty || null
            const clickable = !!onSelectBadgeIssuance
            return (
              <div
                key={b.id}
                onClick={clickable ? () => onSelectBadgeIssuance(b.id) : undefined}
                style={{
                  padding: '10px 12px', borderRadius: 6,
                  background: 'var(--bg-deep)', border: '1px solid var(--border)',
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'background 100ms, border-color 100ms',
                }}
                onMouseEnter={clickable ? (e) => {
                  e.currentTarget.style.background = 'var(--bg-raised)'
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 35%, var(--border))'
                } : undefined}
                onMouseLeave={clickable ? (e) => {
                  e.currentTarget.style.background = 'var(--bg-deep)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                } : undefined}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {claimLabel}
                </div>
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2,
                  display: 'flex', gap: 6,
                }}>
                  {ownerParty && <><span>{ownerParty}</span><span>·</span></>}
                  <span>{(b.createdDate || '').slice(0, 10)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {lineageActiveIssuanceCount > 0 && (
        <div style={{
          marginTop: 10, fontSize: 10.5, fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)', lineHeight: 1.6,
        }}>
          {lineageActiveIssuanceCount} total active issuance{lineageActiveIssuanceCount === 1 ? '' : 's'} across this badge&rsquo;s history.
        </div>
      )}
    </div>
  )
}

/* ─── EditorForm — create + new-version ─── */
function EditorForm({
  isNewVersion, sourceName, draftVersion,
  editName, setEditName, editDescription, setEditDescription,
  editRsIds, setEditRsIds,
  ownRequirementSets, publishedRequirementSets, activeParty,
  onSave, onCancel,
}) {
  // Phase 14.6.2 Item 4 — create-mode header simplified from
  // "Create Badge Template" to "Create New Badge" (parallels the toolbar
  // button label). New-version mode header unchanged.
  const headerText = isNewVersion
    ? `New Version: ${sourceName || editName || 'Untitled'}`
    : 'Create New Badge'

  // Combined RS pool: own + Published (excluding own's already-included
  // copies). Group by section for the picker.
  const ownRsList = useMemo(() => ownRequirementSets || [], [ownRequirementSets])
  const externalPublished = useMemo(() => {
    return (publishedRequirementSets || []).filter((p) => !ownRsList.some((o) => o.id === p.id))
  }, [publishedRequirementSets, ownRsList])
  // Phase 14.6 (#188): membership set for own-RSes that are ALSO in the
  // Published Standards pool. Used to render the globe icon on own-RS
  // rows so the user can see at a glance which of their own sets are
  // also publicly published. Without this, an actor who authors all
  // Published Standards (e.g. Bob in seed) sees no published-marker on
  // his own rows because the published copies are filtered out of the
  // PUBLISHED STANDARDS section by `externalPublished` above.
  const publishedRsIdSet = useMemo(
    () => new Set((publishedRequirementSets || []).map((p) => p.id)),
    [publishedRequirementSets],
  )

  const toggleRs = useCallback((id) => {
    setEditRsIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }, [setEditRsIds])

  const canSave = editName.trim() && editDescription.trim() && editRsIds.length > 0

  const renderRsRow = (rs, fromSection) => {
    const isChecked = editRsIds.includes(rs.id)
    return (
      <div
        key={rs.id}
        onClick={() => toggleRs(rs.id)}
        style={{
          padding: '8px 10px', marginBottom: 4, borderRadius: 5, cursor: 'pointer',
          background: isChecked
            ? 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'
            : 'var(--bg-deep)',
          border: `1px solid ${isChecked ? 'var(--accent-indigo)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', gap: 10, transition: 'all 100ms',
        }}
      >
        <div style={{
          width: 14, height: 14, flexShrink: 0, borderRadius: 3,
          border: `1.5px solid ${isChecked ? 'var(--accent-indigo)' : 'var(--border-hover)'}`,
          background: isChecked ? 'var(--accent-indigo)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isChecked && (
            <svg width={9} height={9} viewBox="0 0 16 16" fill="none">
              <path d="M3 8 L7 12 L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rs.name}
        </span>
        {/* Phase 14.6 (#188): globe icon also renders on own-RS rows
            whose RS is in the Published Standards pool. Lets the user
            see at a glance which of their own sets are publicly
            published — previously only the dedicated PUBLISHED
            STANDARDS section showed the marker. */}
        {(fromSection === 'published' || (fromSection === 'own' && publishedRsIdSet.has(rs.id))) && <GlobeIcon size={11} />}
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '1px 5px', borderRadius: 3, flexShrink: 0,
          color: 'var(--accent-indigo)',
          background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
        }}>v{rs.version || 1}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <BadgeShieldGlyph size={20} />
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

        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.03em' }}>NAME</div>
        <input
          value={editName} onChange={(e) => setEditName(e.target.value)}
          placeholder="e.g. Aerospace Grade A"
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
          value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
          placeholder="What does this badge represent?"
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
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>REFERENCED REQUIREMENTS SETS</span>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: editRsIds.length === 0 ? 'var(--accent-amber)' : 'var(--text-dim)',
            padding: '1px 6px', borderRadius: 4, background: 'var(--bg-raised)',
          }}>{editRsIds.length}</span>
          {editRsIds.length === 0 && (
            <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--accent-amber)' }}>
              Select at least one requirements set.
            </span>
          )}
        </div>

        {ownRsList.length > 0 && (
          <>
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.08em', color: 'var(--text-tertiary)',
              padding: '4px 0 6px',
            }}>YOUR REQUIREMENTS SETS</div>
            <div style={{ marginBottom: 12 }}>
              {ownRsList.map((rs) => renderRsRow(rs, 'own'))}
            </div>
          </>
        )}
        {externalPublished.length > 0 && (
          <>
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.08em', color: 'var(--accent-blue)',
              padding: '4px 0 6px', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <GlobeIcon size={10} />
              <span>PUBLISHED STANDARDS</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              {externalPublished.map((rs) => renderRsRow(rs, 'published'))}
            </div>
          </>
        )}
        {ownRsList.length === 0 && externalPublished.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', padding: '14px 0' }}>
            No Requirements Sets available to reference. Author one in the &ldquo;Requirement Sets&rdquo; tab first.
          </div>
        )}
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
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-raised)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
          onMouseEnter={(e) => { if (canSave) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = canSave ? '1' : '0.35' }}
        >Save</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PANEL — embedded under the LibraryModal Badges tab.
   ═══════════════════════════════════════════════════════════════════════ */
export default function BadgesPanel({
  badgeTemplates = [],
  requirementSets = [],
  publishedRequirementSets = [],
  activeParty,
  onSave,
  initialSelectedId = null,
  // Phase 14.1 (#169 part 2): Active Issuances data + handlers.
  // Phase 14.6 (#187): replaced `proofsOfEvaluation` with `allClaims` to
  // complete the Phase 14.2 migration — issuances reference Claims now.
  badgeIssuances = [],
  allClaims = [],
  onSelectBadgeIssuance,
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [mode, setMode] = useState('view') // 'view' | 'create' | 'newversion'
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRsIds, setEditRsIds] = useState([])

  // New-version context.
  const [sourceLineageId, setSourceLineageId] = useState(null)
  const [sourceName, setSourceName] = useState('')
  const [priorTemplateId, setPriorTemplateId] = useState(null)
  const [draftVersion, setDraftVersion] = useState(null)

  // Expand modal toggle.
  const [expandedOpen, setExpandedOpen] = useState(false)

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId)
      setMode('view')
    }
  }, [initialSelectedId])

  const selectedTemplate = useMemo(
    () => badgeTemplates.find((t) => t.id === selectedId) || null,
    [badgeTemplates, selectedId],
  )

  // Phase 14.6.1 (Bug A): own templates only at the rendering layer.
  // Toolbar count + TemplateList input both consume this filtered list.
  // The full `badgeTemplates` list stays the source for `selectedTemplate`
  // resolution and the lineage walk in `handleNewVersion` (`maxVersion`
  // computation), since those flows may reference templates by id
  // independent of ownership at lookup time.
  const ownTemplates = useMemo(
    () => badgeTemplates.filter((t) => t.ownerParty === activeParty),
    [badgeTemplates, activeParty],
  )

  const allRequirementSets = useMemo(
    () => [...requirementSets, ...publishedRequirementSets],
    [requirementSets, publishedRequirementSets],
  )

  const isOwn = !!selectedTemplate && selectedTemplate.ownerParty === activeParty
  const isLatest = !!selectedTemplate && !selectedTemplate.supersededBy

  const handleSelect = (id) => {
    setSelectedId(id)
    setMode('view')
  }

  const handleCreate = () => {
    setEditName('')
    setEditDescription('')
    setEditRsIds([])
    setSourceLineageId(null)
    setSourceName('')
    setPriorTemplateId(null)
    setDraftVersion(null)
    setMode('create')
  }

  const handleNewVersion = () => {
    if (!selectedTemplate) return
    const lid = selectedTemplate.lineageId || selectedTemplate.id
    const maxVersion = badgeTemplates
      .filter((t) => (t.lineageId || t.id) === lid)
      .reduce((m, t) => Math.max(m, t.version || 1), 0)
    setEditName(selectedTemplate.name)
    setEditDescription(selectedTemplate.description || '')
    setEditRsIds([...(selectedTemplate.referencedRequirementsSetIds || [])])
    setSourceLineageId(lid)
    setSourceName(selectedTemplate.name)
    setPriorTemplateId(selectedTemplate.id)
    setDraftVersion(maxVersion + 1)
    setMode('newversion')
  }

  const handleSave = () => {
    if (!editName.trim() || !editDescription.trim() || editRsIds.length === 0) return
    let lineageId, version
    if (mode === 'newversion' && sourceLineageId) {
      lineageId = sourceLineageId
      version = draftVersion
    } else {
      lineageId = `badgetpl-lineage-${Date.now().toString(36)}`
      version = 1
    }
    const id = makeArtifactId('badgetpl', `${editName}-${version}-${Date.now()}`)
    const template = makeBadgeTemplate({
      id,
      ownerParty: activeParty,
      name: editName.trim(),
      description: editDescription.trim(),
      referencedRequirementsSetIds: [...editRsIds],
      lineageId,
      version,
      createdDate: new Date().toISOString(),
    })
    onSave?.(template, {
      isNewVersion: mode === 'newversion',
      priorTemplateId: mode === 'newversion' ? priorTemplateId : null,
    })
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
        editRsIds={editRsIds} setEditRsIds={setEditRsIds}
        ownRequirementSets={requirementSets}
        publishedRequirementSets={publishedRequirementSets}
        activeParty={activeParty}
        onSave={handleSave}
        onCancel={handleCancelEdit}
      />
    )
  } else if (selectedTemplate) {
    // Phase 14.1 (#169 part 2): compute active issuances scoped to this
    // template version, plus lineage-wide total for the subtext line.
    const activeIssuances = badgeIssuances.filter((b) =>
      b.status === 'active' && b.badgeTemplateId === selectedTemplate.id,
    )
    const lineageVersionIds = new Set(
      badgeTemplates
        .filter((t) => (t.lineageId || t.id) === (selectedTemplate.lineageId || selectedTemplate.id))
        .map((t) => t.id),
    )
    const lineageActiveIssuanceCount = badgeIssuances.filter((b) =>
      b.status === 'active' && lineageVersionIds.has(b.badgeTemplateId),
    ).length
    // Phase 14.6 (#187): build a Claim-keyed lookup for the Active
    // Issuances rows. Each entry carries the Claim's display name + its
    // owner party (which is the badge recipient — the Claim grantor).
    const claimNameLookup = {}
    for (const c of allClaims) {
      claimNameLookup[c.id] = {
        name: c.name,
        ownerParty: c.owner || c.ownerParty,
      }
    }
    rightContent = (
      <ViewDetails
        template={selectedTemplate}
        allRequirementSets={allRequirementSets}
        isOwn={isOwn}
        isLatest={isLatest}
        onNewVersion={handleNewVersion}
        onSelectRequirementsSet={(rsId) => {
          document.dispatchEvent(new CustomEvent('library-open-requirements-set', { detail: { rsId } }))
        }}
        onExpand={() => setExpandedOpen(true)}
        activeIssuances={activeIssuances}
        lineageActiveIssuanceCount={lineageActiveIssuanceCount}
        claimNameLookup={claimNameLookup}
        onSelectBadgeIssuance={onSelectBadgeIssuance}
        activeParty={activeParty}
      />
    )
  } else {
    rightContent = (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px', textAlign: 'center',
      }}>
        <div>
          <BadgeShieldGlyph size={40} color="var(--text-dim)" />
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, marginTop: 14 }}>
            Select a badge template to view details,<br />or create a new one.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top toolbar */}
      {/* Phase 14.6.2 Item 2 — minHeight: 50 prevents the toolbar row from
          collapsing when the "+ Create New Badge" button hides during
          create/new-version mode (button has 6px+12px padding + 11px font;
          the bare count line is shorter). */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, minHeight: 50,
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {ownTemplates.length} badge template{ownTemplates.length !== 1 ? 's' : ''}
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
            onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, transparent)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >+ Create New Badge</span>
        )}
      </div>

      {/* Two-panel body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <TemplateList
          templates={ownTemplates}
          activeParty={activeParty}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {rightContent}
        </div>
      </div>

      {/* Expand modal — Phase 13.4 Output/JSON convention. */}
      {expandedOpen && selectedTemplate && (
        <ExpandedArtifactModal
          artifact={selectedTemplate}
          schema="badge-template"
          referencedRequirementSets={allRequirementSets.filter((rs) =>
            (selectedTemplate.referencedRequirementsSetIds || []).includes(rs.id),
          )}
          onClose={() => setExpandedOpen(false)}
        />
      )}
    </div>
  )
}

// Re-export so other modules (e.g. `getLatestBadgeTemplateVersion` consumers)
// can pull from the same file. Keeps the cross-package surface narrow.
export { getLatestBadgeTemplateVersion }
