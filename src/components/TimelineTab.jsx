import ClaimTimeline from './ClaimTimeline';
import AttestationCard from './AttestationCard';

export default function TimelineTab({ raw, tlSelIdx, setTlSelIdx, tlSelected, setEvidenceAtt }) {
  return <>
    <ClaimTimeline atts={raw} selectedIdx={tlSelIdx} onSelect={idx => setTlSelIdx(prev => prev === idx ? null : idx)} width={324} />
    {tlSelected && <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '.06em', marginBottom: 4, fontWeight: 700 }}>SELECTED CLAIM</div>
      <AttestationCard attestation={tlSelected} expanded onEvidenceClick={setEvidenceAtt} />
    </div>}
  </>;
}
