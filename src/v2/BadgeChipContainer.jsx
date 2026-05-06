// BadgeChipContainer — Phase 14.3 (#176a), polished Phase 14.4 (#176b),
// tuned Phase 14.5 (#176c).
//
// Single rounded-rectangle container holding all visible badge shields +
// a "+N" indicator when total > 3.
//
// Idle: shields render with horizontal overlap (right-anchored). Each
// shield carries a 2px halo in the rectangle's exact background color so
// adjacent shields read as having a negative-space cut between them — the
// classic overlapping-tokens look.
//
// Hover (when total >= 2): rectangle expands leftward; previously-overlapped
// shields slide left to un-overlap with 4px spacing. Rightmost shield +
// "+N" stay anchored to the right edge.
//
// Single-shield case: the rectangle becomes a small square-ish container
// and the lone shield centers horizontally + vertically inside it.
//
// Per-shield tooltip: badge name + version (line 1) + issuer party (line
// 2). "+N" tooltip: list of buried badges with `Badge Name · Issuer Party`
// per line. Tooltips use the shared Tooltip primitive (auto-flip).

import { useState } from 'react'
import BadgeShieldIcon from './BadgeShieldIcon.jsx'
import Tooltip from '../components/Tooltip.jsx'

const SHIELD_SIZE = 18
const STEP_IDLE = 12  // ~33% overlap; the 2px halo cuts adjacent shields visually
const STEP_FAN = 22   // SHIELD_SIZE + 4px gap (no overlap during fan-out)
const PADDING = 3
const HEIGHT = SHIELD_SIZE + PADDING * 2  // 24
const OVERFLOW_TEXT_W = 20
const OVERFLOW_GAP = 4
const ANIM_MS = 180

// Exact background of the chip rectangle — used as the shield halo color
// so adjacent overlapping shields show a negative-space cut.
const RECT_BG = 'color-mix(in srgb, var(--accent-indigo) 18%, var(--bg-card))'
const RECT_BORDER = '1px solid color-mix(in srgb, var(--accent-indigo) 50%, var(--border))'

function ShieldTooltipContent({ badge }) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-bright)',
        lineHeight: 1.3, whiteSpace: 'nowrap',
      }}>
        {badge.badgeName} v{badge.badgeVersion}
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-dim)', marginTop: 2,
        whiteSpace: 'nowrap',
      }}>
        Issued by {badge.issuerParty}
      </div>
    </div>
  )
}

function OverflowTooltipContent({ buried }) {
  return (
    <div style={{ minWidth: 160 }}>
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        letterSpacing: '0.06em', color: 'var(--text-tertiary)',
        textTransform: 'uppercase', marginBottom: 4,
      }}>
        {buried.length} more badge{buried.length === 1 ? '' : 's'}
      </div>
      {buried.map((b) => (
        <div key={b.id} style={{
          fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
          whiteSpace: 'nowrap',
        }}>
          {b.badgeName} <span style={{ color: 'var(--text-dim)' }}>·</span>{' '}
          <span style={{ color: 'var(--text-dim)' }}>{b.issuerParty}</span>
        </div>
      ))}
    </div>
  )
}

export default function BadgeChipContainer({ badges, rightOffset, top = -8 }) {
  const [hovered, setHovered] = useState(false)
  const total = badges.length
  if (total === 0) return null

  const visibleCount = Math.min(3, total)
  const overflow = Math.max(0, total - 3)
  const buried = overflow > 0 ? badges.slice(visibleCount) : []
  const canFan = total >= 2
  const isSingleShield = total === 1

  // Inner content widths (shields + optional +N gap + +N text budget).
  // The container's outer width = inner + 2*PADDING.
  const overflowFootprint = overflow > 0 ? OVERFLOW_GAP + OVERFLOW_TEXT_W : 0
  const idleInner = (visibleCount - 1) * STEP_IDLE + SHIELD_SIZE + overflowFootprint
  const fanInner = (visibleCount - 1) * STEP_FAN + SHIELD_SIZE + overflowFootprint
  const idleWidth = idleInner + PADDING * 2
  const fanWidth = fanInner + PADDING * 2
  const expanded = hovered && canFan
  const containerWidth = expanded ? fanWidth : idleWidth
  const step = expanded ? STEP_FAN : STEP_IDLE

  const shields = badges.slice(0, visibleCount)
  const overflowRight = PADDING
  const lastShieldRight = overflowRight + overflowFootprint
  // Vertical centering: top offset places the SHIELD_SIZE-tall shield at
  // the rectangle's vertical midline. With HEIGHT = SHIELD_SIZE + PADDING*2,
  // this resolves to PADDING — but compute from the relation so future
  // HEIGHT tunings stay correct.
  const shieldTop = (HEIGHT - SHIELD_SIZE) / 2

  const containerStyle = {
    position: 'absolute',
    top,
    right: rightOffset,
    zIndex: 6,
    height: HEIGHT,
    width: containerWidth,
    borderRadius: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    background: RECT_BG,
    border: RECT_BORDER,
    transition: `width ${ANIM_MS}ms ease-out`,
    pointerEvents: 'auto',
    cursor: 'default',
    overflow: 'visible',
  }

  // Single-shield case: render the lone shield centered (horizontal +
  // vertical) inside the square-ish rectangle. No fan-out; tooltip-only on
  // hover.
  if (isSingleShield) {
    const b = shields[0]
    return (
      <div
        style={containerStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto',
        }}>
          <Tooltip content={<ShieldTooltipContent badge={b} />} position="auto">
            <BadgeShieldIcon
              size={SHIELD_SIZE}
              color="var(--accent-indigo)"
              strokeColor={RECT_BG}
            />
          </Tooltip>
        </div>
      </div>
    )
  }

  return (
    <div
      style={containerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Shields — right-anchored, animated `right`. Each shield carries
          a 2px halo matching the rectangle background so adjacent shields
          show a negative-space cut where they overlap. zIndex: leftmost
          shield on top so the stack reads as a fan from the right. */}
      {shields.map((b, i) => {
        const distFromRight = (visibleCount - 1 - i) * step
        return (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              top: shieldTop,
              right: lastShieldRight + distFromRight,
              width: SHIELD_SIZE,
              height: SHIELD_SIZE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10 - i,
              transition: `right ${ANIM_MS}ms ease-out`,
              pointerEvents: 'auto',
            }}
          >
            <Tooltip content={<ShieldTooltipContent badge={b} />} position="auto">
              <BadgeShieldIcon
                size={SHIELD_SIZE}
                color="var(--accent-indigo)"
                strokeColor={RECT_BG}
              />
            </Tooltip>
          </div>
        )
      })}

      {/* "+N" indicator — plain indigo monospaced text, no pill chrome,
          vertically centered. */}
      {overflow > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: overflowRight,
            width: OVERFLOW_TEXT_W,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: 'var(--accent-indigo)',
            pointerEvents: 'auto',
            zIndex: 11,
            lineHeight: 1,
          }}
        >
          <Tooltip content={<OverflowTooltipContent buried={buried} />} position="auto" width={260}>
            <span style={{ display: 'inline-block', lineHeight: 1 }}>+{overflow}</span>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
