export default function CreditsModal({ credits, setCredits, onClose }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
    <div style={{ position: 'relative', width: 340, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,.6)', animation: 'pfade .2s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '.06em' }}>EVALUATION CREDITS</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
      </div>

      {/* Balance */}
      <div style={{ textAlign: 'center', padding: '20px 0', marginBottom: 16, background: 'var(--bg-app-header)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent-indigo)', fontFamily: "'JetBrains Mono', monospace" }}>{credits}</div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 4 }}>credits remaining</div>
      </div>

      {/* Usage history (stub) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'monospace', letterSpacing: '.06em', marginBottom: 8, fontWeight: 700 }}>RECENT ACTIVITY</div>
        <div style={{ padding: '12px', background: 'var(--bg-app-header)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', fontStyle: 'italic', textAlign: 'center' }}>
          No recent activity
        </div>
      </div>

      {/* Add credits */}
      <button onClick={() => setCredits(c => c + 100)}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
        style={{ width: '100%', padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent-indigo)', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, transition: 'border-color .2s, background .2s' }}>
        + Add 100 Credits
      </button>
    </div>
  </div>;
}
