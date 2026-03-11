import { useState, useMemo, useRef } from 'react';
import { ATTESTATION_STATUS, fmtPredicate } from './AttestationCard';

const REF = new Date('2026-02-17');
const MS_DAY = 86400000;
const ST = ATTESTATION_STATUS;

/* ═══ Time helpers ═══ */
const toDay = iso => iso ? new Date(iso).getTime() / MS_DAY : null;
const fmtShort = t => {
  const d = new Date(t * MS_DAY);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  return `${m} '${String(d.getUTCFullYear()).slice(2)}`;
};
const fmtDate = iso => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
};

const BAR_H = 20;
const BAR_GAP = 5;
const ROW_TOTAL = BAR_H + BAR_GAP;
const AXIS_H = 26;
const PAD_L = 0;
const PAD_R = 0;
const TOOLTIP_H = 82; // approximate tooltip height for positioning

/* ═══ ClaimTimeline ═══
 * Renders a horizontal timeline of attestation validity windows.
 * Props: atts (rawAttestations array), selectedIdx (int|null), onSelect (idx => void), width (px)
 */
export default function ClaimTimeline({ atts, selectedIdx, onSelect, width = 324 }) {
  if (!atts || atts.length === 0) return <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', fontStyle: 'italic', padding: '12px 0' }}>No attestations to display</div>;

  const [hoverIdx, setHoverIdx] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef(null);

  const todayT = toDay(REF.toISOString());

  /* Compute time range and bar layout */
  const { bars, minT, maxT, rows } = useMemo(() => {
    let mn = Infinity, mx = -Infinity;

    // First pass: compute time bounds
    const entries = atts.map((a, i) => {
      const start = toDay(a.timestamp) || todayT - 365;
      let end = toDay(a.validUntil);
      const openEnded = !a.validUntil;
      if (!end || end < start) end = todayT;
      mn = Math.min(mn, start);
      mx = Math.max(mx, end);
      return { a, i, start, end, openEnded };
    });

    // Add 5% padding to range
    const range = mx - mn || 1;
    mn -= range * 0.03;
    mx += range * 0.05;

    // Stack overlapping bars: greedy row assignment
    const rowEnds = []; // track the rightmost extent per row
    const result = entries.map(e => {
      let row = 0;
      for (let r = 0; r < rowEnds.length; r++) {
        if (e.start >= rowEnds[r]) { row = r; break; }
        row = r + 1;
      }
      if (row >= rowEnds.length) rowEnds.push(e.end);
      else rowEnds[row] = e.end;
      return { ...e, row };
    });

    return { bars: result, minT: mn, maxT: mx, rows: rowEnds.length };
  }, [atts, todayT]);

  const range = maxT - minT || 1;
  const chartW = width - PAD_L - PAD_R;
  const chartH = rows * ROW_TOTAL + AXIS_H;
  const toX = t => PAD_L + ((t - minT) / range) * chartW;

  /* Tick marks */
  const ticks = useMemo(() => {
    const result = [];
    const stepDays = range / 5;
    for (let i = 0; i <= 5; i++) {
      const t = minT + stepDays * i;
      result.push({ t, x: toX(t), label: fmtShort(t) });
    }
    return result;
  }, [minT, range, chartW]);

  /* Today marker */
  const todayX = toX(todayT);
  const todayInRange = todayX >= PAD_L && todayX <= PAD_L + chartW;

  /* Hovered bar data for tooltip */
  const hoveredAtt = hoverIdx !== null ? (bars.find(b => b.i === hoverIdx) || {}).a : null;

  return <div ref={wrapperRef} style={{ width, position: 'relative' }}>
    <svg width={width} height={chartH} style={{ display: 'block' }}
      onClick={e => {
        // Click on empty space deselects
        if (e.target.tagName === 'svg' || e.target.tagName === 'line') {
          onSelect(selectedIdx);
        }
      }}>
      {/* Today line */}
      {todayInRange && <line x1={todayX} y1={0} x2={todayX} y2={chartH - AXIS_H} stroke="var(--border-subtle)" strokeWidth={1} strokeDasharray="3,3" />}
      {todayInRange && <text x={todayX} y={chartH - AXIS_H + 12} fontSize="9" fill="var(--accent-indigo)" fontFamily="monospace" textAnchor="middle">Today</text>}

      {/* Bars */}
      {bars.map(b => {
        const s = ST[b.a.status] || ST.pending;
        const x1 = Math.max(PAD_L, toX(b.start));
        const x2 = Math.min(PAD_L + chartW, toX(b.end));
        const bw = Math.max(2, x2 - x1);
        const by = b.row * ROW_TOTAL;
        const isExpired = b.a.status === 'expired' || b.a.status === 'revoked';
        const isSel = selectedIdx === b.i;

        return <g key={b.i} style={{ cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onSelect(b.i); }}
          onMouseEnter={e => {
            setHoverIdx(b.i);
            const wr = wrapperRef.current?.getBoundingClientRect();
            if (wr) setHoverPos({ x: e.clientX - wr.left, y: e.clientY - wr.top });
          }}
          onMouseMove={e => {
            const wr = wrapperRef.current?.getBoundingClientRect();
            if (wr) setHoverPos({ x: e.clientX - wr.left, y: e.clientY - wr.top });
          }}
          onMouseLeave={() => setHoverIdx(null)}>
          {/* Selection highlight */}
          {isSel && <rect x={x1 - 1} y={by - 1} width={bw + 2} height={BAR_H + 2} rx={4} fill="none" stroke="var(--accent-indigo)" strokeWidth={1.5} />}

          {/* Bar */}
          <rect x={x1} y={by} width={bw} height={BAR_H} rx={3}
            fill={s.bg} stroke={s.border} strokeWidth={0.5}
            opacity={isExpired ? 0.5 : 1} />

          {/* Open-ended indicator (fade gradient) */}
          {b.openEnded && <rect x={x2 - 8} y={by} width={8} height={BAR_H} rx={0}
            fill="url(#fadeRight)" style={{ pointerEvents: 'none' }} />}

          {/* Status color accent (left edge) */}
          <rect x={x1} y={by} width={3} height={BAR_H} rx={1.5} fill={s.c}
            opacity={isExpired ? 0.4 : 0.8} />

          {/* Label (predicate) — only if bar is wide enough */}
          {bw > 40 && <text x={x1 + 7} y={by + 13} fontSize="8" fill={isExpired ? 'var(--text-muted)' : 'var(--text-secondary)'} fontFamily="monospace" style={{ pointerEvents: 'none' }}>
            {fmtPredicate(b.a.predicate).length > bw / 5.5 ? fmtPredicate(b.a.predicate).slice(0, Math.floor(bw / 5.5)) + '\u2026' : fmtPredicate(b.a.predicate)}
          </text>}
        </g>;
      })}

      {/* Time axis */}
      <line x1={PAD_L} y1={chartH - AXIS_H} x2={PAD_L + chartW} y2={chartH - AXIS_H} stroke="var(--border)" strokeWidth={1} />
      {ticks.map((tk, i) => <g key={i}>
        <line x1={tk.x} y1={chartH - AXIS_H} x2={tk.x} y2={chartH - AXIS_H + 4} stroke="var(--text-faint)" strokeWidth={1} />
        <text x={tk.x} y={chartH - AXIS_H + 16} fontSize="9" fill="var(--text-muted)" fontFamily="monospace" textAnchor="middle">{tk.label}</text>
      </g>)}

      {/* Defs */}
      <defs>
        <linearGradient id="fadeRight">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="var(--bg-app-header)" />
        </linearGradient>
      </defs>
    </svg>

    {/* ═══ Hover tooltip — absolute position above cursor ═══ */}
    {hoveredAtt && <div style={{
      position: 'absolute',
      left: Math.max(0, hoverPos.x - 90),
      top: Math.max(0, hoverPos.y - TOOLTIP_H - 12),
      background: 'var(--border)',
      border: '1px solid var(--text-faint)',
      borderRadius: 5,
      padding: '8px 10px',
      zIndex: 9999,
      boxShadow: '0 4px 16px rgba(0,0,0,.6)',
      pointerEvents: 'none',
      minWidth: 140,
      maxWidth: 200,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 4 }}>{fmtPredicate(hoveredAtt.predicate)}</div>
      <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'monospace', marginBottom: 2 }}>Issued: {fmtDate(hoveredAtt.timestamp) || 'Unknown'}</div>
      <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'monospace', marginBottom: 2 }}>Expires: {hoveredAtt.validUntil ? fmtDate(hoveredAtt.validUntil) : 'No expiration'}</div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{hoveredAtt.actor?.name || 'Unknown actor'}</div>
      {/* Downward caret */}
      <div style={{
        position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
        borderTop: '6px solid var(--text-faint)',
      }} />
      <div style={{
        position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        borderTop: '5px solid var(--border)',
      }} />
    </div>}

    {/* ═══ Legend ═══ */}
    <div style={{ display: 'flex', gap: 8, padding: '6px 0 2px', flexWrap: 'wrap' }}>
      {['verified', 'expired', 'contested', 'revoked', 'pending'].map(s => {
        const st = ST[s];
        return <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 8, height: 3, borderRadius: 1, background: st.c, opacity: s === 'expired' || s === 'revoked' ? 0.5 : 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{st.label}</span>
        </div>;
      })}
    </div>
  </div>;
}
