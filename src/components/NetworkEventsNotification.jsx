import { useState, useEffect, useRef, useCallback } from 'react';
import { TT } from '../data/tokens';

const TYPE_ICONS = {
  supplier: '◈', asset: '◆', claim: '✓', evaluation: '◎', invitation: '✉',
  evaluation_complete: '◎', evidence_submitted: '↑', evidence_accepted: '✓', evidence_rejected: '✗',
  sda_published: '◇', sda_revoked: '⊘',
  disclosure_offer_created: '◈', disclosure_offer_revoked: '⊘',
  disclosure_requested: '✉', disclosure_approved: '✓', disclosure_declined: '✗',
};
const TYPE_COLORS = {
  supplier: 'var(--accent-cyan)', asset: 'var(--accent-green)', claim: 'var(--accent-indigo)', evaluation: 'var(--accent-amber)', invitation: 'var(--accent-purple-light)',
  evaluation_complete: 'var(--accent-amber)', evidence_submitted: 'var(--accent-cyan)', evidence_accepted: 'var(--accent-green)', evidence_rejected: 'var(--accent-red)',
  sda_published: 'var(--accent-indigo)', sda_revoked: 'var(--accent-red)',
  disclosure_offer_created: 'var(--accent-indigo)', disclosure_offer_revoked: 'var(--accent-red)',
  disclosure_requested: 'var(--accent-purple-light)', disclosure_approved: 'var(--accent-green)', disclosure_declined: 'var(--accent-red)',
  cascade_requested: 'var(--accent-sda-cascade)', cascade_accepted: 'var(--accent-sda-cascade)', cascade_declined: 'var(--accent-red)',
};
const TYPE_TITLES = {
  supplier: 'New Supplier', asset: 'New Asset', claim: 'Claim Verified', evaluation: 'Evaluation Complete', invitation: 'Invitation Accepted',
  evaluation_complete: 'Evaluation Complete', evidence_submitted: 'Evidence Submitted', evidence_accepted: 'Evidence Accepted', evidence_rejected: 'Evidence Rejected',
  sda_published: 'Disclosure Published', sda_revoked: 'Disclosure Revoked',
  disclosure_offer_created: 'Disclosure Offer Created', disclosure_offer_revoked: 'Disclosure Offer Revoked',
  disclosure_requested: 'Disclosure Requested', disclosure_approved: 'Disclosure Approved', disclosure_declined: 'Disclosure Declined',
  cascade_requested: 'Cascade Requested', cascade_accepted: 'Cascade Accepted', cascade_declined: 'Cascade Declined',
};
const NODE_TYPE_MARK = {
  customer: '⬡', system: '⬢', assembly: '◆', subassembly: '⊛', component: '⬣',
  process: '⚙', material: '◧', chemical: '◎', rawsource: '✦',
};

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/* ── SVG Bell Icons ──────────────────────────────────────── */
function BellIcon({ size = 16, stroke = 'var(--text-muted)', strokeWidth = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 2.5-1 4-2 5h13c-1-1-2-2.5-2-5 0-2.5-2-4.5-4.5-4.5z"
        stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 11c.2.9.8 1.5 1.5 1.5s1.3-.6 1.5-1.5"
        stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RingingBellIcon({ size = 16, stroke = 'var(--accent-amber)', strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 16" fill="none" style={{ display: 'block' }}>
      <path d="M10 1.5C7.5 1.5 5.5 3.5 5.5 6c0 2.5-1 4-2 5h13c-1-1-2-2.5-2-5 0-2.5-2-4.5-4.5-4.5z"
        stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 11c.2.9.8 1.5 1.5 1.5s1.3-.6 1.5-1.5"
        stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4.5c-.6-.8-.8-1.8-.4-2.8" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" opacity=".7" />
      <path d="M16.5 4.5c.6-.8.8-1.8.4-2.8" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

/* ── Countdown Timer ─────────────────────────────────────── */
function CountdownTimer({ running, resetKey }) {
  const R = 9, C = 2 * Math.PI * R; // ≈ 56.549
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" style={{ display: 'block', transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={10} cy={10} r={R} fill="none" stroke="var(--border)" strokeWidth={2} />
      <circle key={resetKey} cx={10} cy={10} r={R} fill="none" stroke="var(--accent-indigo)" strokeWidth={2}
        strokeDasharray={C} strokeDashoffset={0} strokeLinecap="round"
        style={{ animation: 'countdown 4s linear forwards', animationPlayState: running ? 'running' : 'paused' }} />
      {!running && (
        <g transform="rotate(90 10 10)">
          <rect x={6.5} y={7} width={2} height={6} rx={0.5} fill="var(--text-muted)" />
          <rect x={11.5} y={7} width={2} height={6} rx={0.5} fill="var(--text-muted)" />
        </g>
      )}
    </svg>
  );
}

/* ── Nav button helper ───────────────────────────────────── */
function NavBtn({ children, onClick, disabled, fontSize = 14 }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov && !disabled ? 'var(--bg-raised)' : 'transparent',
        border: `1px solid ${hov && !disabled ? 'var(--border-hover)' : 'var(--border)'}`,
        borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--text-muted)' : (hov ? 'var(--text-primary)' : 'var(--text-tertiary)'),
        fontSize, lineHeight: 1, padding: 0,
        opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto',
        transition: 'border-color .15s, background .15s, color .15s',
      }}>
      {children}
    </button>
  );
}

function focusAndHighlight(evt, onFocusNode, onHighlightNode, opts) {
  if (!evt) return;
  onFocusNode?.(evt.nodeId, opts);
  onHighlightNode?.({ nodeId: evt.nodeId, color: TYPE_COLORS[evt.type] || 'var(--accent-indigo)', k: Date.now() });
}

export default function NetworkEventsNotification({ events, onMarkAllRead, onEventClick, onFocusNode, onHighlightNode, onStageChange, nodes, nodeTypeLabels }) {
  const [stage, setStage] = useState(() => {
    const unread = events.filter(e => !e.read).length;
    return unread > 0 ? 1 : 0;
  });
  const [currentIdx, setCurrentIdx] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [cycleReset, setCycleReset] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [pausedBeforeStage3, setPausedBeforeStage3] = useState(false);
  const [radialKey, setRadialKey] = useState(0);
  const fadeTimeoutRef = useRef(null);

  // Refs to access latest values in timeout callbacks
  const currentIdxRef = useRef(currentIdx);
  currentIdxRef.current = currentIdx;
  const onFocusNodeRef = useRef(onFocusNode);
  onFocusNodeRef.current = onFocusNode;
  const onHighlightNodeRef = useRef(onHighlightNode);
  onHighlightNodeRef.current = onHighlightNode;

  const unreadEvents = events.filter(e => !e.read);
  const unreadCount = unreadEvents.length;
  const unreadEventsRef = useRef(unreadEvents);
  unreadEventsRef.current = unreadEvents;

  // Stage 3: maintain original event order — read events dim but stay in place
  const sortedEvents = events;

  // Safe index for cycling (no wrap — clamped)
  const safeIdx = unreadCount > 0 ? Math.min(currentIdx, unreadCount - 1) : 0;
  const cycleEvent = unreadEvents[safeIdx] || events[0];
  const atEnd = unreadCount <= 1 || safeIdx >= unreadCount - 1;
  const atStart = safeIdx <= 0;

  // Wrapped setStage that also notifies parent and clears highlight on exit from Stage 2
  const changeStage = useCallback(s => {
    setStage(s);
    onStageChange?.(s);
    if (s !== 2) onHighlightNodeRef.current?.(null);
  }, [onStageChange]);

  // Auto-transition: unread events appear → go to Stage 1; unread depleted in Stage 1 or 2 → Stage 0
  useEffect(() => {
    if (unreadCount === 0 && (stage === 1 || stage === 2)) changeStage(0);
    if (unreadCount > 0 && stage === 0) changeStage(1);
  }, [unreadCount, stage, changeStage]);

  // Clamp index when unread count shrinks
  useEffect(() => {
    if (unreadCount > 0 && currentIdx >= unreadCount) setCurrentIdx(0);
  }, [unreadCount, currentIdx]);

  // Advance event with opacity fade, then focus/highlight the new event
  const advanceEvent = useCallback((direction = 1) => {
    const evts = unreadEventsRef.current;
    const len = evts.length;
    const nextIdx = currentIdxRef.current + direction;
    if (nextIdx < 0 || nextIdx >= len) return; // stop at ends, don't wrap
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    setRadialKey(k => k + 1);
    setFadeOpacity(0);
    fadeTimeoutRef.current = setTimeout(() => {
      setCurrentIdx(nextIdx);
      setFadeOpacity(1);
      const evt = evts[nextIdx];
      if (evt) focusAndHighlight(evt, onFocusNodeRef.current, onHighlightNodeRef.current);
    }, 200);
  }, []);

  // Auto-cycle interval for Stage 2 — stops at last event
  useEffect(() => {
    if (stage !== 2 || hovering || manuallyPaused || unreadCount <= 1) return;
    const id = setInterval(() => {
      if (currentIdxRef.current >= unreadEventsRef.current.length - 1) {
        clearInterval(id);
        return;
      }
      advanceEvent(1);
    }, 4000);
    return () => {
      clearInterval(id);
      if (fadeTimeoutRef.current) { clearTimeout(fadeTimeoutRef.current); fadeTimeoutRef.current = null; }
    };
  }, [stage, hovering, manuallyPaused, unreadCount, cycleReset, advanceEvent]);

  // Cleanup fade timeout on unmount
  useEffect(() => () => { if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current); }, []);

  const navPrev = useCallback(() => { advanceEvent(-1); setCycleReset(k => k + 1); }, [advanceEvent]);
  const navNext = useCallback(() => { advanceEvent(1); setCycleReset(k => k + 1); }, [advanceEvent]);

  const goToStage3 = useCallback(() => {
    if (fadeTimeoutRef.current) { clearTimeout(fadeTimeoutRef.current); fadeTimeoutRef.current = null; }
    setFadeOpacity(1);
    setPausedBeforeStage3(manuallyPaused);
    changeStage(3);
  }, [changeStage, manuallyPaused]);

  // Close handler: go to Stage 1 if unread, Stage 0 if all read
  const closeToIdle = useCallback(() => {
    changeStage(unreadCount > 0 ? 1 : 0);
  }, [changeStage, unreadCount]);

  // Stage 3 close: return to Stage 2 restoring prior pause state
  const closeToStage2 = useCallback(() => {
    const evts = unreadEventsRef.current;
    let returnIdx = Math.min(currentIdxRef.current, evts.length - 1);
    if (returnIdx < 0) returnIdx = 0;
    setCurrentIdx(returnIdx);
    setManuallyPaused(pausedBeforeStage3);
    if (!pausedBeforeStage3) { setCycleReset(k => k + 1); setRadialKey(k => k + 1); }
    const evt = evts[returnIdx];
    if (evt) focusAndHighlight(evt, onFocusNodeRef.current, onHighlightNodeRef.current);
    changeStage(2);
  }, [pausedBeforeStage3, changeStage]);

  // Dynamic bottom position: Stages 0/1 = 100px, Stages 2/3 = 112px (raised above legend)
  const bottomPos = (stage === 2 || stage === 3) ? 112 : 100;

  // Look up referenced node for Stage 2 display
  const refNode = cycleEvent?.nodeId ? nodes?.find(n => n.id === cycleEvent.nodeId) : null;
  const refNodeTk = refNode ? (TT[refNode.type] || TT.component) : null;

  return (
    <div style={{
      position: 'absolute', bottom: bottomPos, left: '50%', transform: 'translateX(-50%)', zIndex: 35,
      transition: 'bottom 0.3s ease',
    }}>
      {/* ── Stage 0: Empty state — bell icon square ── */}
      {stage === 0 && (
        <div
          onClick={() => { setFadeOpacity(1); changeStage(3); }}
          style={{
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
            cursor: 'pointer', boxSizing: 'border-box',
            transition: 'border-color .15s, background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
        >
          <BellIcon size={16} stroke="var(--text-muted)" strokeWidth={1.5} />
        </div>
      )}

      {/* ── Stage 1: Awake indicator pill ── */}
      {stage === 1 && unreadCount > 0 && (
        <div
          onClick={() => {
            setManuallyPaused(false);
            changeStage(2);
            setCurrentIdx(0);
            setFadeOpacity(1);
            setCycleReset(k => k + 1);
            setRadialKey(k => k + 1);
            const evt = unreadEvents[0];
            if (evt) focusAndHighlight(evt, onFocusNode, onHighlightNode, { targetZoom: 1.0 });
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-raised)', border: '1px solid rgba(245,158,11,0.5)', borderRadius: 20,
            padding: '8px 16px', cursor: 'pointer',
            boxShadow: '0 0 12px rgba(251,191,36,0.15)',
            transition: 'border-color .15s, background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.7)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}
        >
          <RingingBellIcon size={16} stroke="var(--accent-amber)" strokeWidth={2} />
          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{unreadCount} new update{unreadCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── Stages 2 & 3: Shared container ── */}
      {(stage === 2 || stage === 3) && (
        <div style={{
          width: 448,
          maxHeight: stage === 3 ? 475 : 'auto',
          background: 'var(--bg-surface)', border: '1.5px solid #fb923c', borderRadius: 12,
          boxShadow: '0 6px 28px rgba(0,0,0,0.5)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'max-height 0.3s ease',
        }}>
          {/* Stage 2: Cycling event card */}
          {stage === 2 && cycleEvent && (
            <div
              style={{ padding: '16px 20px', flexShrink: 0 }}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              {/* Row 1: Event type icon + title + nav cluster */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, color: TYPE_COLORS[cycleEvent.type] || 'var(--text-tertiary)', flexShrink: 0, opacity: fadeOpacity, transition: 'opacity 0.2s' }}>
                  {TYPE_ICONS[cycleEvent.type] || '●'}
                </span>
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  opacity: fadeOpacity, transition: 'opacity 0.2s',
                }}>
                  {TYPE_TITLES[cycleEvent.type] || cycleEvent.type}
                </span>
                {/* Countdown timer — hidden at last event */}
                {!atEnd && (
                  <CountdownTimer running={!hovering && !manuallyPaused} resetKey={radialKey} />
                )}
                <button onClick={goToStage3} style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  fontSize: 11, fontFamily: 'monospace', color: 'var(--text-tertiary)', flexShrink: 0,
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
                  padding: '2px 6px', cursor: 'pointer', lineHeight: 1, height: 28,
                  transition: 'border-color .15s, color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                  {safeIdx + 1} / {unreadCount}<span style={{ fontSize: 8, marginLeft: 2 }}>▴</span>
                </button>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <NavBtn onClick={navPrev} disabled={atStart}>‹</NavBtn>
                  <NavBtn onClick={() => {
                    const nowPaused = !manuallyPaused;
                    setManuallyPaused(nowPaused);
                    if (!nowPaused) { setCycleReset(k => k + 1); setRadialKey(k => k + 1); }
                  }}>
                    {manuallyPaused
                      ? <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: 'block' }}><polygon points="2,1 9,5 2,9" fill="currentColor" /></svg>
                      : <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: 'block' }}><rect x="1" y="1" width="3" height="8" fill="currentColor" /><rect x="6" y="1" width="3" height="8" fill="currentColor" /></svg>
                    }
                  </NavBtn>
                  <NavBtn onClick={navNext} disabled={atEnd}>›</NavBtn>
                  <NavBtn onClick={closeToIdle} fontSize={12}>✕</NavBtn>
                </div>
              </div>
              {/* Row 2: Node type icon + type label */}
              {refNode && (
                <div style={{ marginTop: 6, opacity: fadeOpacity, transition: 'opacity 0.2s' }}>
                  <span style={{ fontSize: 12, color: refNodeTk.border }}>{NODE_TYPE_MARK[refNode.type] || '●'}</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginLeft: 4 }}>
                    {nodeTypeLabels?.[refNode.type] || refNodeTk.label || refNode.type}
                  </span>
                </div>
              )}
              {/* Row 3: Node display name */}
              <div style={{
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: refNode ? 2 : 6,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                opacity: fadeOpacity, transition: 'opacity 0.2s',
              }}>
                {refNode ? refNode.name : cycleEvent.message}
              </div>
              {/* Row 4: Event message */}
              <div style={{
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 6,
                opacity: fadeOpacity, transition: 'opacity 0.2s',
              }}>
                {cycleEvent.message}
              </div>
              {/* Row 5: Tertiary detail */}
              <div style={{
                fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                opacity: fadeOpacity, transition: 'opacity 0.2s',
              }}>
                {cycleEvent.detail}
              </div>
            </div>
          )}

          {/* Stage 3: Expanded list */}
          {stage === 3 && (
            <>
              {/* Header */}
              <div style={{
                padding: '14px 16px', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Network Updates</span>
                <NavBtn onClick={closeToStage2} fontSize={12}>✕</NavBtn>
              </div>

              {/* Scrollable event list */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {sortedEvents.map((evt, i) => (
                  <div
                    key={evt.id}
                    onClick={() => {
                      onEventClick(evt);
                      focusAndHighlight(evt, onFocusNode, onHighlightNode);
                      const remaining = unreadCount - (evt.read ? 0 : 1);
                      setTimeout(() => { changeStage(remaining > 0 ? 1 : 0); }, 300);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                      borderBottom: i < sortedEvents.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer', opacity: evt.read ? 0.5 : 1,
                      transition: 'background .15s, opacity .3s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-deep)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 14, color: TYPE_COLORS[evt.type] || 'var(--text-tertiary)', flexShrink: 0 }}>
                      {TYPE_ICONS[evt.type] || '●'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {evt.message}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {evt.detail}
                        </span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {relativeTime(evt.timestamp)}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <button
                  onClick={() => { onMarkAllRead(); changeStage(0); }}
                  style={{
                    width: '100%', padding: '6px 14px', fontSize: 11, textAlign: 'center',
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >Mark All as Read</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
