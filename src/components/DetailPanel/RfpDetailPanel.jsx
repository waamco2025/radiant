// Phase 17.0 — Read-only RFP Detail Panel.
//
// Mounted by V2App when `v22DirectorySelectedRfp` is non-null and the
// Directory layer is open. Mirrors the panel-shell visual treatment used
// by V22NodeDetailPanel (header pillbox + name + body + close button at
// top-right), without depending on its internals — RFPs are a distinct
// schema with no shared Claim/Asset/EvalResult fields.
//
// Phase 17.0 was read-only — no footer actions. Phase 17.1 adds an
// owner-only footer with Close / Reopen direct-action buttons and the
// CLOSED status badge + Closed-date row.
//
// Phase 17.2 — Solicitations section above the footer:
//   • Owner (status open): heading "Incoming Solicitations (N)" + cards
//     listing every solicitation; empty case shows muted "No solicitations yet."
//   • Solicitor (non-owner, has existing solicitation): heading "Your
//     Solicitation" + single card; footer Solicit button replaced by
//     muted "Already solicited" text.
//   • Other non-owner (open): no section; footer Solicit button is the entry
//     point to SolicitationCreateModal.
// Closed-status RFPs: the owner still sees their incoming solicitations
// (must be able to act on them); the Solicit button is hidden because
// closed RFPs aren't visible to non-owners (Phase 17.1 directory filter).

import { useState } from 'react'
import SolicitationCard from './SolicitationCard.jsx'

const TYPE_BADGE_BG = 'var(--bg-raised)'

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
    const da = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    return `${y}-${mo}-${da} · ${h}:${mi} UTC`
  } catch {
    return iso
  }
}

function StatusBadge({ status }) {
  // Phase 17.0: skeletal status taxonomy. Phase 17.1: introduces 'closed'
  // alongside 'open'. Future status values surface via the raw-uppercased
  // fallback under a neutral treatment so this component doesn't need
  // editing each time the taxonomy extends.
  const value = String(status || 'open').toLowerCase()
  const label = value.toUpperCase()
  if (value === 'closed') {
    // Phase 17.1: muted treatment — grey background, dim text, dim border.
    // Visually quieter than OPEN to signal the dormant lifecycle state.
    return (
      <span style={{
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--text-tertiary)',
        padding: '2px 6px',
        borderRadius: 3,
        border: '1px solid var(--border)',
        background: 'var(--bg-deep)',
      }}>{label}</span>
    )
  }
  if (value === 'open') {
    return (
      <span style={{
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'var(--accent-green)',
        padding: '2px 6px',
        borderRadius: 3,
        border: '1px solid color-mix(in srgb, var(--accent-green) 40%, var(--border))',
        background: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-raised))',
      }}>{label}</span>
    )
  }
  // Fallback for unknown statuses (future-proofing).
  return (
    <span style={{
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'var(--text-secondary)',
      padding: '2px 6px',
      borderRadius: 3,
      border: '1px solid var(--border)',
      background: 'var(--bg-raised)',
    }}>{label}</span>
  )
}

function SectionHeading({ children }) {
  return (
    <div style={{
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      marginBottom: 8,
    }}>{children}</div>
  )
}

// Phase 17.3.1 — canonical globe icon, matches the LibraryModal /
// BadgesPanel / RequirementsPanel / CombinedRequestModal / RequirementsSet-
// DetailModal copies. Indicates a Requirements Set is published on the
// public network.
function GlobeIcon({ size = 12, color = 'var(--accent-blue)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  )
}

// Phase 17.3.1 — full-width clickable row for the Requirements section.
// Replaces the horizontal-chip layout: each RS gets its own row with the
// name at full width and the version rendered as a small badge pill on
// the right edge. Click opens RequirementsSetDetailModal (V2App mounts).
// `onClick === undefined` renders the row non-clickable + no hover state.
//
// Phase 17.5.1.2 (Fix 3) — two-line layout:
//   • Line 1: name → spacer → GlobeIcon (only when `isPublished`, regardless
//     of who owns it or who's viewing) → version pill (right-aligned).
//   • Line 2: owner party name in muted secondary text (matches the
//     "Published by {ownerParty}" treatment in CombinedRequestModal's RS
//     scrollbox). No "YOU" pill even when the viewer is the owner — the RFP
//     panel header already carries the YOU indicator for the RFP itself.
function RequirementRow({ name, version, owner, isPublished, onClick }) {
  const [hovered, setHovered] = useState(false)
  const clickable = !!onClick
  const bg = (clickable && hovered)
    ? 'color-mix(in srgb, var(--accent-indigo) 10%, var(--bg-raised))'
    : 'var(--bg-raised)'
  const border = (clickable && hovered)
    ? 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))'
    : 'var(--border-faint)'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => clickable && setHovered(true)}
      onMouseLeave={() => clickable && setHovered(false)}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      } : undefined}
      title={clickable ? `Open ${name}` : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 12px 8px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12,
          color: 'var(--text-primary)',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{name}</span>
        {isPublished && <GlobeIcon size={12} />}
        {version != null && (
          <span style={{
            flexShrink: 0,
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
            padding: '2px 6px',
            borderRadius: 3,
            background: 'var(--bg-deep)',
            border: '1px solid var(--border-faint)',
          }}>v{version}</span>
        )}
      </div>
      {owner && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}>{owner}</div>
      )}
    </div>
  )
}

function RsChip({ name, version, raw }) {
  // raw = chip renders the rsId itself (RS not found in the lookup); use
  // muted treatment so the reader knows it's a fallback, not a canonical name.
  if (raw) {
    return (
      <span style={{
        display: 'inline-block',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-dim)',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '4px 8px',
        marginRight: 6,
        marginBottom: 6,
      }}>{raw}</span>
    )
  }
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      color: 'var(--text-primary)',
      background: 'color-mix(in srgb, var(--accent-indigo) 10%, var(--bg-raised))',
      border: '1px solid color-mix(in srgb, var(--accent-indigo) 40%, var(--border))',
      borderRadius: 4,
      padding: '4px 8px',
      marginRight: 6,
      marginBottom: 6,
    }}>{name}{version != null ? <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>v{version}</span> : null}</span>
  )
}

// Phase 17.1: owner-only footer action button. Close uses muted styling
// (the action isn't destructive — the owner can always reopen — but it's
// also not affirming, so neutral grey-on-dim reads as "discrete state
// change"). Reopen uses indigo, matching the affirming-action treatment
// V22NodeDetailPanel's accent buttons use.
// Phase 17.5.1.4: `danger` variant (red) for the irreversible Remove RFP
// action + optional `title` tooltip + optional `icon` glyph.
function ActionButton({ label, onClick, variant, title, icon }) {
  const isAffirm = variant === 'affirm'
  const isDanger = variant === 'danger'
  const bg = isAffirm ? 'var(--accent-indigo)'
    : isDanger ? 'color-mix(in srgb, var(--accent-red) 12%, var(--bg-raised))'
    : 'var(--bg-raised)'
  const border = isAffirm ? 'var(--accent-indigo)'
    : isDanger ? 'color-mix(in srgb, var(--accent-red) 50%, var(--border))'
    : 'var(--border)'
  const color = isAffirm ? 'var(--bg-deep)'
    : isDanger ? 'var(--accent-red)'
    : 'var(--text-primary)'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        flex: 1,
        padding: '10px 14px',
        background: bg,
        border: '1px solid ' + border,
        borderRadius: 4,
        color,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >{icon ? <span style={{ marginRight: 6 }}>{icon}</span> : null}{label}</button>
  )
}

export default function RfpDetailPanel({
  rfp,
  activeParty,
  requirementsSets = [],
  onClose,
  onCloseRfp,
  onReopenRfp,
  // Phase 17.5.1.4: owner-only Remove action, available only on closed RFPs.
  // Silently destroys the RFP + any open solicitations against it.
  onRemoveRfp,
  // Phase 17.5.2 (Part B): clicking the "For Asset" row routes to that Asset's
  // Detail Panel on the parent canvas (closes the Directory). Available to all
  // viewers; when omitted the row renders as static text.
  onOpenAsset,
  // Phase 17.2: solicitations + activeClaims + handlers.
  solicitations = [],
  activeClaims = [],
  claimsById = null,    // optional Map<claimId, claim> used to resolve Claim metadata for SolicitationCard
  onOpenSolicitModal,    // ({ rfp }) => void — parent opens SolicitationCreateModal
  onRejectSolicitation,  // (solicitation) => void — parent opens SolicitationRejectModal
  // Phase 18.3.1: clicking a SolicitationCard body navigates to the offered
  // Claim on Directory. Threaded to both the owner-side (incoming) and
  // solicitor-side (your-solicitation) card mounts.
  onSelectSolicitation,  // (solicitation) => void
  // Phase 17.2.1: owner-side accept entry point. Click on the
  // SolicitationCard's "Request Agreement" button fires this; V2App opens
  // the CombinedRequestModal pre-filled with the RFP's assetId + Claim.
  // (Phase 17.2.1.1 simplified the chain — the intermediate AssetPickerModal
  // step is gone; the RFP carries its anchor Asset from creation.)
  onRequestAgreement,    // (solicitation) => void
  // Phase 17.2.1.1: assetsById Map<id, asset> used to resolve the RFP's
  // bound Asset for the "For Asset" row. Optional; if absent or the
  // assetId doesn't resolve, the row renders "(Asset not found)".
  assetsById = null,
  // Phase 17.3.1: click handler for the Requirements rows. Opens
  // V2App's RequirementsSetDetailModal for the clicked RS. Optional —
  // when omitted, rows render non-clickable.
  onRequirementClick,
}) {
  if (!rfp) return null

  // Phase 17.0: requirementsSets is the lookup array (id → {name, version}).
  // We accept any source — V2App passes `publishedRequirementSets` which
  // already covers the seeded RFP's two RSes (MIL-PRF-55681 v2 + System
  // Integration v1). When future RFPs reference RSes not in this catalog,
  // the chip falls back to the raw id under a muted treatment.
  const rsById = new Map()
  for (const rs of requirementsSets) {
    if (rs && rs.id) rsById.set(rs.id, rs)
  }

  const description = rfp.description || ''
  const reqIds = Array.isArray(rfp.requirementsSetIds) ? rfp.requirementsSetIds : []

  // Phase 17.1: owner detection drives the action footer + the YOU badge.
  // `activeParty` is the party of the currently-active actor (passed from
  // V2App). When the RFP's owner matches, the active actor IS the owner
  // and gets the Close / Reopen footer.
  const isOwner = !!activeParty && rfp.owner === activeParty
  const isClosed = rfp.status === 'closed'

  // Phase 17.2: solicitation view-state.
  // userSolicitation — the active actor's own outgoing solicitation against
  //   this RFP (null when none exists). Identifies the "solicitor" branch.
  // incomingSolicitations — owner view shows all; everyone else gets [].
  // showSolicitButton — non-owner + status open + no existing solicitation.
  // The Solicit button is gated on `status === 'open'`; closed RFPs aren't
  // reachable by non-owners (Directory filter, Phase 17.1) but the gate is
  // defensive in case future code surfaces the panel anyway.
  const userSolicitation = !isOwner
    ? (solicitations || []).find((s) => s.solicitor === activeParty) || null
    : null
  const incomingSolicitations = isOwner ? (solicitations || []) : []
  const showSolicitButton = !isOwner && !userSolicitation && rfp.status === 'open'
  const showAlreadySolicited = !isOwner && !!userSolicitation && rfp.status === 'open'

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'var(--font-display)',
    }}>
      {/* Header — type pill + status badge + close button + name. */}
      <div style={{ padding: '18px 18px 14px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            padding: '2px 6px',
            background: TYPE_BADGE_BG,
            borderRadius: 3,
          }}>RFP</span>
          <StatusBadge status={rfp.status} />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 15,
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >✕</button>
        </div>
        <div style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 8,
          wordBreak: 'break-word',
        }}>{rfp.name || '(Unnamed RFP)'}</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {/* Posted by row */}
        {/* Phase 17.3.1 (#202 follow-up): categorical "ACTOR" pill removed.
            The "POSTED BY" section header conveys the relationship; the
            party name + optional "YOU" relational indicator are sufficient. */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>Posted by</SectionHeading>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 13,
              color: 'var(--text-primary)',
            }}>{rfp.owner || '—'}</span>
            {isOwner && (
              <span style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
                padding: '2px 6px',
                borderRadius: 3,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
              }}>YOU</span>
            )}
          </div>
        </div>

        {/* Phase 17.2.1.1: For Asset row — the buyer-side Asset that
            anchors this RFP. Set at RFP creation; flows to the Accept
            flow's CombinedRequestModal pre-fill so the requested EA+DA
            pair attaches to this specific Asset on the buyer's parent
            canvas. */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>For Asset</SectionHeading>
          {(() => {
            const boundAsset = rfp.assetId && assetsById ? assetsById.get(rfp.assetId) : null
            if (!boundAsset) {
              return (
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  fontStyle: 'italic',
                }}>(Asset not found)</div>
              )
            }
            // Phase 17.5.2 (Part B): the row click-navigates to the Asset's
            // Detail Panel on the parent canvas (closes the Directory). Hover
            // treatment matches the clickable RequirementRow / AssetPanelRfpRow
            // pattern. Renders as static text when onOpenAsset is absent.
            const clickable = !!onOpenAsset
            return (
              <div
                onClick={clickable ? () => onOpenAsset(rfp.assetId) : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAsset(rfp.assetId) }
                } : undefined}
                title={clickable ? `Open ${boundAsset.name || boundAsset.id} on the parent canvas` : undefined}
                onMouseEnter={clickable ? (e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 10%, var(--bg-raised))'
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))'
                } : undefined}
                onMouseLeave={clickable ? (e) => {
                  e.currentTarget.style.background = 'var(--bg-raised)'
                  e.currentTarget.style.borderColor = 'var(--border-faint)'
                } : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px',
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-faint)',
                  borderRadius: 6,
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'background 120ms, border-color 120ms',
                }}
              >
                <span style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  wordBreak: 'break-word',
                }}>{boundAsset.name || boundAsset.id}</span>
                {clickable && (
                  <span style={{ flexShrink: 0, fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1 }}>›</span>
                )}
              </div>
            )
          })()}
        </div>

        {/* Description */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>Description</SectionHeading>
          {description ? (
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}>{description}</div>
          ) : (
            <div style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              fontStyle: 'italic',
            }}>No description provided.</div>
          )}
        </div>

        {/* Phase 17.3.1 — Requirements section (was "Required Standards").
            Renamed per Andrew's preference for the broader term. Layout
            converted from horizontal chips to vertical full-width rows;
            each clickable row opens RequirementsSetDetailModal (V2App
            mounts it; this panel just fires `onRequirementClick(rsId)`).
            Version number renders as a small badge pill at the row's
            right edge. Missing-RS rows render muted "Standard not found"
            and are non-clickable. */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>Requirements</SectionHeading>
          {reqIds.length === 0 ? (
            <div style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              fontStyle: 'italic',
            }}>No standards listed.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reqIds.map((rsId) => {
                const rs = rsById.get(rsId)
                if (!rs) {
                  return (
                    <div
                      key={rsId}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-raised)',
                        border: '1px dashed var(--border)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: 'var(--text-dim)',
                        fontStyle: 'italic',
                      }}
                    >Standard not found ({rsId})</div>
                  )
                }
                const clickable = !!onRequirementClick
                return (
                  <RequirementRow
                    key={rsId}
                    name={rs.name || rsId}
                    version={rs.version}
                    // Phase 17.5.1.2 (Fix 3): owner party (line 2) + globe
                    // gate (line 1). Both derived into the v22RfpRsLookupPool
                    // shape by V2App; `isPublished` reflects publishedRequirementSets
                    // membership independent of owner/viewer.
                    owner={rs.owner}
                    isPublished={rs.isPublished}
                    onClick={clickable ? () => onRequirementClick(rsId) : undefined}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Posted date */}
        <div style={{ marginBottom: 18 }}>
          <SectionHeading>Posted</SectionHeading>
          <div style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
          }}>{formatDateTime(rfp.createdDate)}</div>
        </div>

        {/* Phase 17.1: Closed date row (only when status === 'closed'). */}
        {isClosed && (
          <div style={{ marginBottom: 18 }}>
            <SectionHeading>Closed</SectionHeading>
            <div style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}>{formatDateTime(rfp.closedDate)}</div>
          </div>
        )}

        {/* Phase 17.2: Solicitations section.
            Three branches drive what renders:
              • Owner view → "Incoming Solicitations (N)" + cards (or muted
                empty-state copy when N === 0). Owner sees this on BOTH open
                and closed RFPs (must be able to act on existing solicitations
                even after closing).
              • Solicitor view → "Your Solicitation" + the single card showing
                their own outgoing solicitation.
              • Other non-owner → no section.
            Section sits inside the scrollable body so long lists scroll
            with the rest of the body content (Required Standards, etc). */}
        {isOwner && (
          <div style={{ marginBottom: 18 }}>
            <SectionHeading>Incoming Solicitations ({incomingSolicitations.length})</SectionHeading>
            {incomingSolicitations.length === 0 ? (
              <div style={{
                fontSize: 12,
                color: 'var(--text-dim)',
                fontStyle: 'italic',
              }}>No solicitations yet.</div>
            ) : (
              <div>
                {incomingSolicitations.map((s) => {
                  const claim = claimsById ? claimsById.get(s.claimId) : null
                  return (
                    <SolicitationCard
                      key={s.id}
                      solicitation={s}
                      claim={claim}
                      viewerRole="owner"
                      onReject={onRejectSolicitation}
                      onRequestAgreement={onRequestAgreement}
                      onSelectSolicitation={onSelectSolicitation}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
        {!isOwner && userSolicitation && (
          <div style={{ marginBottom: 18 }}>
            <SectionHeading>Your Solicitation</SectionHeading>
            <SolicitationCard
              solicitation={userSolicitation}
              claim={claimsById ? claimsById.get(userSolicitation.claimId) : null}
              viewerRole="solicitor"
              onSelectSolicitation={onSelectSolicitation}
            />
          </div>
        )}
      </div>

      {/* Phase 17.1: owner-only footer — Close (open) or Reopen (closed).
          Phase 17.5.1.4: closed RFPs gain a second "Remove RFP" button
          (danger variant) — irreversible destruction of the RFP + any open
          solicitations against it. Remove is NEVER shown on an open RFP
          (Andrew's explicit constraint: Close must happen first — which
          fires solicitor notifications — Remove is the silent cleanup
          afterward).
          Phase 17.2: non-owner footer extension — "Solicit with my Claim"
          button on open RFPs without an existing solicitation, or a muted
          "Already solicited" line when the active actor has one. Other
          non-owner cases (closed RFP) see no footer; that path is also
          gated by the Directory filter (closed RFPs aren't visible to
          non-owners) but the defensive render is intentional. */}
      {isOwner && (
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}>
          {isClosed ? (
            <>
              <ActionButton
                label="Reopen this RFP"
                variant="affirm"
                onClick={() => onReopenRfp?.(rfp)}
              />
              <ActionButton
                label="Remove RFP"
                variant="danger"
                icon="⊟"
                title="Permanently remove this RFP from the network. Any open solicitations against it will also be removed. This action cannot be undone."
                onClick={() => onRemoveRfp?.(rfp)}
              />
            </>
          ) : (
            <ActionButton
              label="Close this RFP"
              variant="neutral"
              onClick={() => onCloseRfp?.(rfp)}
            />
          )}
        </div>
      )}
      {showSolicitButton && (
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}>
          <ActionButton
            label="Solicit with my Claim"
            variant="affirm"
            onClick={() => onOpenSolicitModal?.({ rfp })}
          />
        </div>
      )}
      {showAlreadySolicited && (
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          fontSize: 12,
          color: 'var(--text-dim)',
          fontStyle: 'italic',
          textAlign: 'center',
        }}>Already solicited — see above.</div>
      )}
    </div>
  )
}
