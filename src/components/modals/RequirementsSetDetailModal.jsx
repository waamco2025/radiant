// Phase 17.3.1 — RequirementsSetDetailModal.
//
// Opens from RfpDetailPanel's new Requirements row click. Read-only view of
// a single published Requirements Set's full contents — name + version
// badge in the header, "Published by {owner}" + globe icon sub-header, and
// a scrollable list of requirements with id (mono pill), description, and
// optional criterion (muted italic). Mirrors the requirement-row treatment
// SolicitationCreateModal's RsAccordionEntry uses in its expanded state,
// inlined here so the modal doesn't depend on the accordion's local
// component (the accordion carries open/closed state coupling that doesn't
// belong in the modal context).
//
// Modal footer: Close button only. The modal is purely informational; no
// edit/copy/export actions in this phase.

import {
  Backdrop, Modal, ModalHeader, ModalBody, ModalFooter, Btn,
} from './ModalShared'

// Phase 17.3.1 — canonical globe icon, matches the LibraryModal /
// BadgesPanel / RequirementsPanel / CombinedRequestModal copies. Indicates
// a Requirements Set is published on the public network.
function GlobeIcon({ size = 12, color = 'var(--accent-blue)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color }}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  )
}

export default function RequirementsSetDetailModal({
  requirementsSet,      // resolved RS artifact (or null → no-op)
  onClose,
}) {
  if (!requirementsSet) return null
  const rs = requirementsSet
  // Phase 17.5.1.3 (Fix 2): branch the subheader on publication state.
  // The RS arrives via `v22RfpRsLookupPool` (Phase 17.5.1.2), whose entries
  // carry derived `owner` + `isPublished`. Published RSes show the globe +
  // "Published by {owner}"; unpublished RFP-referenced RSes show a plainer
  // "by {owner}" with no globe (they reach this modal via implicit-
  // publication-by-reference, but they aren't actually on the public
  // network, so the "Published by" framing + globe would misrepresent them).
  // Fallbacks keep the modal correct if mounted with a raw RS object.
  const owner = rs.owner || rs._publishedBy || null
  const isPublished = rs.isPublished != null ? rs.isPublished : !!rs._publishedBy
  const requirements = Array.isArray(rs.requirements) ? rs.requirements : []

  return (
    <Backdrop onClose={onClose}>
      <Modal width={640}>
        <ModalHeader
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span>{rs.name || rs.id}</span>
              {rs.version != null && (
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--text-tertiary)',
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'var(--bg-deep)',
                  border: '1px solid var(--border-faint)',
                }}>v{rs.version}</span>
              )}
            </span>
          )}
          subtitle={isPublished ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <GlobeIcon size={12} />
              <span>Published by <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{owner || 'an unknown actor'}</span></span>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>by <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{owner || 'an unknown actor'}</span></span>
            </span>
          )}
          onClose={onClose}
        />
        <ModalBody>
          {rs.description && (
            <div style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: 18,
            }}>{rs.description}</div>
          )}
          {requirements.length === 0 ? (
            <div style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              fontStyle: 'italic',
            }}>No requirements listed in this standard.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requirements.map((req) => (
                <div key={req.id} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  padding: '10px 12px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: 'var(--text-tertiary)',
                      padding: '2px 5px',
                      borderRadius: 3,
                      background: 'var(--bg-deep)',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}>{req.id}</span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      flex: 1,
                      wordBreak: 'break-word',
                    }}>{req.label || req.description || '—'}</span>
                  </div>
                  {req.label && req.description && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      lineHeight: 1.5,
                      paddingLeft: 2,
                    }}>{req.description}</div>
                  )}
                  {req.criterion && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      lineHeight: 1.5,
                      paddingLeft: 2,
                      fontStyle: 'italic',
                    }}>Criterion: {req.criterion}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Btn label="Close" onClick={onClose} />
        </ModalFooter>
      </Modal>
    </Backdrop>
  )
}
