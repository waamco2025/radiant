import AttestationCard from './AttestationCard';
import { FILTER_LABEL, TYPE_CATS, STATUS_FILTERS, CAT_COLORS, Pill } from './detailPanelUtils';

export default function ClaimsTab({ isSupplier, typeFilt, setTypeFilt, statusFilt, setStatusFilt, filtersActive, filtered, grouped, redactedCats, expandedSet, toggle, setEvidenceAtt, raw }) {
  return <>
    {/* Filter pills (buyer mode) */}
    {!isSupplier && <div style={{ marginBottom: 8, marginTop: 4 }}>
      <div style={FILTER_LABEL}>CLAIM TYPE</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {['All', ...Object.keys(TYPE_CATS)].map(c => <Pill key={c} label={c} active={typeFilt === c} onClick={() => setTypeFilt(c)} />)}
      </div>
      <div style={FILTER_LABEL}>STATUS</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {STATUS_FILTERS.map(s => <Pill key={s} label={s} active={statusFilt === s} onClick={() => setStatusFilt(s)} />)}
      </div>
      {filtersActive && <button onClick={() => { setTypeFilt('All'); setStatusFilt('All'); }}
        style={{ fontSize: 9, color: 'var(--accent-indigo)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'monospace', marginBottom: 4 }}>Clear filters</button>}
    </div>}
    {filtered.length > 0
      ? grouped
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grouped.map(g => {
            const cc = CAT_COLORS[g.cat] || 'var(--text-tertiary)';
            const isCatRedacted = redactedCats.has(g.cat);
            return <div key={g.cat}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.06em', color: isCatRedacted ? 'var(--border-hover)' : cc, textTransform: 'uppercase', borderLeft: `2px solid ${isCatRedacted ? 'var(--border-hover)' : cc}`, paddingLeft: 6, marginTop: 8, marginBottom: 4 }}>{g.cat}{isCatRedacted ? '' : ` (${g.items.length})`}</div>
              {isCatRedacted
                ? <div style={{ padding: '8px 10px', background: 'var(--bg-deep)', border: '1px dashed #1e2433', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--border-hover)', fontFamily: 'monospace' }}>▬▬▬</span>
                    <span style={{ fontSize: 10, color: 'var(--border-hover)', fontFamily: 'monospace', fontStyle: 'italic' }}>REDACTED UNDER SDA</span>
                  </div>
                : g.items.map(({ att, fi }) => <AttestationCard key={`${att.predicate}-${att.actor.id}-${att.timestamp}-${fi}`}
                    attestation={att} expanded={expandedSet.has(fi)} onClick={() => toggle(fi)} onEvidenceClick={setEvidenceAtt} />)}
            </div>;
          })}
        </div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((att, i) => <AttestationCard
            key={`${att.predicate}-${att.actor.id}-${att.timestamp}-${i}`}
            attestation={att}
            expanded={expandedSet.has(i)}
            onClick={() => toggle(i)}
            onEvidenceClick={setEvidenceAtt}
          />)}
        </div>
      : <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', fontStyle: 'italic', padding: '12px 0' }}>
        {raw.length === 0 ? 'No attestations' : 'No matches for current filters'}
      </div>
    }
  </>;
}
