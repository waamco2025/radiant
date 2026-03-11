import { useState } from 'react';

export default function HealthDot({ health, summary, size = 8 }) {
  const [hovered, setHovered] = useState(false);
  const color = health === 'critical' ? 'var(--accent-red)'
    : health === 'warning' ? 'var(--accent-amber)'
    : health === 'healthy' ? 'var(--accent-green)' : 'var(--border-hover)';

  const tooltipText = health === 'critical'
    ? `${summary?.contested || 0} contested · ${summary?.verified || 0} verified`
    : health === 'warning'
    ? `${(summary?.expired || 0) + (summary?.pending || 0)} expiring/pending · ${summary?.verified || 0} verified`
    : health === 'healthy'
    ? `All ${summary?.total || 0} claims verified`
    : 'No claims on record';

  return <div style={{ position: 'relative', display: 'inline-flex' }}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}>
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />
    {hovered && <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
      transform: 'translateX(-50%)', background: 'var(--border)',
      border: '1px solid var(--text-faint)', borderRadius: 4, padding: '4px 8px',
      fontSize: 9, color: 'var(--text-primary)', whiteSpace: 'nowrap',
      pointerEvents: 'none', zIndex: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,.5)',
    }}>{tooltipText}</div>}
  </div>;
}
