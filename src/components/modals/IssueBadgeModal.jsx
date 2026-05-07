// IssueBadgeModal — Phase 14.1 (#169 part 2).
//
// Two-step issuance flow:
//   • Step 1: Badge Template picker — single un-sectioned list of the
//     current actor's own templates with latest-version auto-suggest
//     within each lineage. Phase 14.3 dropped the cross-actor section:
//     Badge Templates can only be issued by their owner, so showing
//     other actors' templates was misleading.
//   • Step 2: Optional description textarea + Cancel / Confirm.
//
// Self-issuance is forbidden. The PoE Detail Panel + action bar gate the
// entry points; this modal renders an error state if the gate is somehow
// bypassed (issuer === poe.ownerParty).
//
// Save callback shape: `onIssue(targetClaimId, badgeTemplateId, description)`
// — V2App constructs the artifact + fires the notification.

import { useEffect, useMemo, useState } from 'react'
import { Backdrop } from './ModalShared.jsx'
import BadgeShieldIcon from '../../v2/BadgeShieldIcon.jsx'
// Phase 14.6 (#189): shared Tooltip primitive for the disabled-row
// hover affordance — auto-flips below when viewport top-space is tight.
import Tooltip from '../Tooltip.jsx'

function TemplateRow({ template, isSuggested, isLatest, disabledReason = null, onClick }) {
  // Phase 14.6 (#189): when `disabledReason` is non-null the row enters
  // a greyed-out, non-interactive state — no hover background change,
  // no click handler, SUGGESTED badge suppressed. The whole row gets
  // wrapped in a Tooltip (below) explaining the gate.
  const isDisabled = !!disabledReason
  const row = (
    <div
      onClick={isDisabled ? undefined : onClick}
      style={{
        padding: '10px 12px', marginBottom: 6, borderRadius: 6,
        background: 'var(--bg-deep)', border: '1px solid var(--border)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'background 100ms, border-color 100ms',
        opacity: isDisabled ? 0.45 : (isLatest ? 1 : 0.7),
      }}
      onMouseEnter={isDisabled ? undefined : (e) => {
        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 8%, var(--bg-deep))'
        e.currentTarget.style.borderColor = 'var(--accent-indigo)'
      }}
      onMouseLeave={isDisabled ? undefined : (e) => {
        e.currentTarget.style.background = 'var(--bg-deep)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <BadgeShieldIcon size={14} />
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {template.name}
        </span>
        {/* Phase 14.6 (#189): SUGGESTED label suppressed when the row
            is disabled — matches the Phase 13.3 pattern of hiding the
            suggestion affordance on rows the user can't act on. */}
        {isSuggested && !isDisabled && (
          <span style={{
            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em',
            padding: '1px 5px', borderRadius: 3, flexShrink: 0,
            color: 'var(--accent-amber)',
            background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
          }}>SUGGESTED</span>
        )}
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '1px 5px', borderRadius: 3, flexShrink: 0,
          color: 'var(--accent-indigo)',
          background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
        }}>v{template.version || 1}</span>
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', display: 'flex', gap: 6 }}>
        <span>{template.ownerParty}</span>
        <span>·</span>
        <span>{(template.referencedRequirementsSetIds || []).length} req set{(template.referencedRequirementsSetIds || []).length === 1 ? '' : 's'}</span>
        {!isLatest && (
          <>
            <span>·</span>
            <span>SUPERSEDED</span>
          </>
        )}
      </div>
    </div>
  )
  if (!isDisabled) return row
  // Phase 14.6 (#189): Tooltip's wrapper span breaks the row's
  // marginBottom flow if it doesn't claim the same outer block-level
  // shape. wrapperStyle: { display: 'block' } keeps the row's vertical
  // spacing intact.
  return (
    <Tooltip content={disabledReason} position="auto" wrapperStyle={{ display: 'block' }}>
      {row}
    </Tooltip>
  )
}

export default function IssueBadgeModal({
  // Phase 14.2 (#169a): target shifted from PoE to Claim. Caller passes
  // a Claim envelope { id, name, ownerParty }; PoE-anchored entry points
  // resolve the Claim from PoE.claimId before invoking this modal.
  targetClaim,
  activeParty,
  badgeTemplates = [],
  // Phase 14.6 (#189): RS-coverage gate inputs.
  //   • `coveredRsIds`: Set<string> of RS ids covered by at least one
  //     ACTIVE PoE on the target Claim (V2App walks PoE → wrapped Eval
  //     Result → requirementsSets[].id). Empty Set when the Claim has
  //     no PoE coverage at all.
  //   • `requirementSetNameById`: Map<string, string> for tooltip text
  //     when the gate fails — translates missing RS ids to display
  //     names (falls back to the id when not found).
  // Defaults are forgiving: a caller that omits these props still gets
  // the previous behavior (no gating).
  coveredRsIds = new Set(),
  requirementSetNameById = new Map(),
  onIssue,
  onClose,
}) {
  const [step, setStep] = useState(1)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [description, setDescription] = useState('')

  // Self-issuance guard. Phase 14.2: gate is `activeParty === claim.ownerParty`.
  const targetOwner = targetClaim?.ownerParty || targetClaim?.owner
  const isSelfIssuance = !!activeParty && !!targetOwner && activeParty === targetOwner

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Per-lineage latest-version map for SUGGESTED auto-promotion.
  const latestByLineage = useMemo(() => {
    const map = new Map()
    for (const t of badgeTemplates) {
      const lid = t.lineageId || t.id
      const cur = map.get(lid)
      if (!cur || (t.version ?? 1) > (cur.version ?? 1)) map.set(lid, t)
    }
    return map
  }, [badgeTemplates])

  // Phase 14.3: own templates only. Badge Templates can only be issued by
  // their owner, so cross-actor templates are filtered out at the picker.
  // Latest-version-first within the user's own templates.
  const own = useMemo(() => {
    const list = badgeTemplates.filter((t) => t.ownerParty === activeParty)
    list.sort((a, b) => (b.version || 1) - (a.version || 1))
    return list
  }, [badgeTemplates, activeParty])

  const selectedTemplate = useMemo(
    () => badgeTemplates.find((t) => t.id === selectedTemplateId) || null,
    [badgeTemplates, selectedTemplateId],
  )

  const handleConfirm = () => {
    if (!selectedTemplate || !targetClaim?.id || isSelfIssuance) return
    onIssue?.(targetClaim.id, selectedTemplate.id, description.trim())
  }

  if (isSelfIssuance) {
    return (
      <Backdrop onClose={onClose}>
        <div style={{
          width: 520, background: 'var(--bg-surface)',
          borderRadius: 14, border: '1px solid var(--border)',
          padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 8 }}>
            Self-issuance not permitted
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            You cannot issue a Badge against your own Claim. Badges are external endorsements;
            try issuing against another party&rsquo;s Claim instead.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span
              onClick={onClose}
              style={{
                fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                cursor: 'pointer', padding: '8px 16px', borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >Close</span>
          </div>
        </div>
      </Backdrop>
    )
  }

  const renderRow = (template) => {
    const lid = template.lineageId || template.id
    const isLatest = !template.supersededBy
    const isSuggested = isLatest && latestByLineage.get(lid)?.id === template.id
    // Phase 14.6 (#189): RS-coverage gate. Compute `disabledReason`
    // per-template — null when every required RS id is covered, else
    // a tooltip string. Two failure shapes:
    //   • Claim has no PoE at all: generic "no Proof of Evaluation"
    //     wording (don't list every RS the template references — the
    //     missing-list is meaningless when nothing is covered).
    //   • Claim has SOME PoE but not all required RSes: list the
    //     missing RS names so the issuer knows what to evaluate.
    const requiredRsIds = template.referencedRequirementsSetIds || []
    const missingRsIds = requiredRsIds.filter((rsId) => !coveredRsIds.has(rsId))
    let disabledReason = null
    if (missingRsIds.length > 0) {
      if (coveredRsIds.size === 0) {
        disabledReason = 'Cannot issue: target Claim has no Proof of Evaluation.'
      } else {
        const missingNames = missingRsIds.map((rsId) => requirementSetNameById.get(rsId) || rsId)
        disabledReason = `Cannot issue: target Claim has no Proof of Evaluation covering ${missingNames.join(', ')}.`
      }
    }
    return (
      <TemplateRow
        key={template.id}
        template={template}
        isSuggested={isSuggested}
        isLatest={isLatest}
        disabledReason={disabledReason}
        onClick={() => {
          setSelectedTemplateId(template.id)
          setStep(2)
        }}
      />
    )
  }

  const headerLabel = step === 1 ? 'Step 1 · Pick a Badge Template' : 'Step 2 · Add a message (optional)'

  return (
    <Backdrop onClose={onClose}>
      <div style={{
        width: 720, height: '78vh', background: 'var(--bg-surface)',
        borderRadius: 14, border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>Issue Badge</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {headerLabel}
              {targetClaim?.name && (
                <>
                  {' · '}
                  <span style={{ color: 'var(--text-primary)' }}>{targetClaim.name}</span>
                  {' · '}
                  <span style={{ color: 'var(--text-tertiary)' }}>recipient: {targetOwner}</span>
                </>
              )}
            </div>
          </div>
          <span
            onClick={onClose}
            style={{
              fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4,
            }}
          >×</span>
        </div>

        {step === 1 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {own.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.7 }}>
                No badge templates available. Create one in the Library &raquo; Badges tab first.
              </div>
            ) : (
              own.map(renderRow)
            )}
          </div>
        )}

        {step === 2 && selectedTemplate && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{
              padding: '14px 16px', background: 'var(--bg-deep)',
              border: '1px solid var(--border)', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
            }}>
              <BadgeShieldIcon size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedTemplate.name}
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '1px 5px', borderRadius: 3, marginLeft: 8,
                    color: 'var(--accent-indigo)',
                    background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                  }}>v{selectedTemplate.version || 1}</span>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4 }}>
                  by {selectedTemplate.ownerParty}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.03em' }}>
              MESSAGE (OPTIONAL)
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why are you issuing this badge?"
              rows={5}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 13,
                outline: 'none', resize: 'none',
              }}
            />
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
              This message will appear in the recipient&rsquo;s notification.
            </div>
          </div>
        )}

        <div style={{
          padding: '12px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          {step === 2 ? (
            <span
              onClick={() => setStep(1)}
              style={{
                fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                cursor: 'pointer', padding: '8px 16px', borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >← Back</span>
          ) : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <span
              onClick={onClose}
              style={{
                fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                cursor: 'pointer', padding: '8px 16px', borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >Cancel</span>
            {step === 2 && (
              <span
                onClick={selectedTemplate ? handleConfirm : undefined}
                style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: '#fff', padding: '8px 16px', borderRadius: 6,
                  background: 'var(--accent-indigo)',
                  cursor: selectedTemplate ? 'pointer' : 'default',
                  opacity: selectedTemplate ? 1 : 0.35,
                }}
              >Issue Badge</span>
            )}
          </div>
        </div>
      </div>
    </Backdrop>
  )
}
