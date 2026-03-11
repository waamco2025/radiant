export const SH = { fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '.08em', marginBottom: 6, fontFamily: 'var(--font-mono-plain)', fontWeight: 700 };
export const FILTER_LABEL = { fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono-plain)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 };

/* ═══ Filter category mapping ═══ */
export const TYPE_CATS = {
  Provenance: ['provenance_claimed', 'supplied_by'],
  Quality: ['quality_approved', 'inspected'],
  Calibration: ['calibrated'],
  Custody: ['registered_on_chain'],
  Qualification: ['certified'],
  Transformation: ['assembled_from', 'material_tested'],
  Risk: ['risk_assessed', 'itar_controlled'],
  Evaluation: ['evaluated_against_requirements'],
};

export const CAT_ORDER = ['Provenance', 'Quality', 'Calibration', 'Transformation', 'Custody', 'Qualification', 'Risk', 'Evaluation', 'Other'];
export const CAT_COLORS = { Provenance: 'var(--accent-cyan)', Quality: 'var(--accent-green)', Calibration: 'var(--accent-blue)', Transformation: 'var(--accent-orange)', Custody: 'var(--accent-purple-light)', Qualification: 'var(--accent-indigo)', Risk: 'var(--accent-red)', Evaluation: 'var(--accent-amber)', Other: 'var(--text-tertiary)' };
export const PRED_TO_CAT = {};
for (const [cat, preds] of Object.entries(TYPE_CATS)) for (const p of preds) PRED_TO_CAT[p] = cat;

export const SDA_FIELD_TO_CATS = {
  material_specs: ['Provenance', 'Transformation'],
  processing_specs: ['Calibration'],
  test_results: ['Quality'],
};

export const SDA_TYPE_COLORS = { full: 'var(--accent-sda-full)', selective: 'var(--accent-sda-selective)', derivative: 'var(--accent-sda-derivative)', cascade: 'var(--accent-sda-cascade)' };
export const SDA_LINE_DASH = { full: 'none', selective: '4,3', derivative: '2,2', cascade: '8,3,2,3' };
export const SDA_STATUS_COLORS = { active: 'var(--accent-green)', expired: 'var(--accent-red)', pending: 'var(--accent-amber)' };

export const LOG_COLORS = {
  asset_approved: 'var(--accent-green)', asset_rejected: 'var(--accent-red)', evaluation_complete: 'var(--accent-amber)',
  evidence_submitted: 'var(--accent-cyan)', evidence_accepted: 'var(--accent-green)', evidence_rejected: 'var(--accent-red)',
  sda_revoked: 'var(--accent-red)', invitation_sent: 'var(--accent-indigo)', sda_created: 'var(--accent-sda-full)',
  disclosure_offer_created: 'var(--accent-indigo)', disclosure_requested: 'var(--accent-sda-full)',
  cascade_requested: 'var(--accent-sda-cascade)', cascade_accepted: 'var(--accent-sda-cascade)', cascade_declined: 'var(--accent-red)',
};

export const TYPE_FILTERS = ['All', ...Object.keys(TYPE_CATS)];
export const STATUS_FILTERS = ['All', 'verified', 'expired', 'contested', 'revoked', 'pending'];

/* ═══ Pill button — sized to match sidebar filters ═══ */
export function Pill({ label, active, onClick }) {
  return <button onClick={onClick} style={{
    padding: '4px 8px', fontSize: 11, fontFamily: 'var(--font-mono-plain)', fontWeight: 600, minHeight: 28,
    border: '1px solid ' + (active ? 'var(--accent-indigo)' : 'var(--border)'), borderRadius: 4,
    background: active ? 'var(--accent-indigo-bg)' : 'transparent',
    color: active ? 'var(--accent-indigo-light)' : 'var(--text-muted)', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '.03em', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center',
  }}>{label}</button>;
}

/* ═══ Sort helper ═══ */
export function sortAtts(atts, mode) {
  const sorted = [...atts];
  if (mode === 'oldest') {
    sorted.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  } else if (mode === 'expiring') {
    sorted.sort((a, b) => {
      const av = a.validUntil || '\uffff';
      const bv = b.validUntil || '\uffff';
      return av.localeCompare(bv);
    });
  } else {
    sorted.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }
  return sorted;
}

/* ═══ Health summary from rawAttestations ═══ */
export function healthSummary(atts) {
  let ok = 0, warn = 0, bad = 0;
  for (const a of atts) {
    if (a.status === 'verified') ok++;
    else if (a.status === 'expired' || a.status === 'pending') warn++;
    else bad++;
  }
  return { ok, warn, bad };
}

/* ═══ Derive compliance from attestation health ═══ */
export function deriveCompliance(atts) {
  const cert = atts.filter(a => a.predicate === 'certified' || a.predicate === 'calibrated');
  if (cert.length === 0) return { c: 'var(--cs-compliant-color)', bg: 'var(--cs-compliant-bg)', l: 'Compliant', i: '✓' };
  if (cert.some(a => a.status === 'contested' || a.status === 'revoked'))
    return { c: 'var(--cs-expired-color)', bg: 'var(--cs-expired-bg)', l: 'Non-Compliant', i: '✕' };
  if (cert.some(a => a.status === 'expired'))
    return { c: 'var(--cs-expired-color)', bg: 'var(--cs-expired-bg)', l: 'Non-Compliant', i: '✕' };
  if (cert.some(a => a.status === 'pending'))
    return { c: 'var(--cs-expiring-color)', bg: 'var(--cs-expiring-bg)', l: 'Pending Review', i: '...' };
  const REF = new Date('2026-02-17');
  if (cert.some(a => {
    if (!a.validUntil) return false;
    const diff = (new Date(a.validUntil) - REF) / 86400000;
    return diff > 0 && diff <= 180;
  })) return { c: 'var(--cs-expiring-color)', bg: 'var(--cs-expiring-bg)', l: 'Expiring Soon', i: '!' };
  return { c: 'var(--cs-compliant-color)', bg: 'var(--cs-compliant-bg)', l: 'Compliant', i: '✓' };
}

/* ═══ Deterministic mock address/signatory from node fields ═══ */
export const SHORT_COUNTRIES = { 'USA': 'United States', 'UK': 'United Kingdom', 'GB': 'United Kingdom' };

export function mockSupplierDetails(supplier, location) {
  const hash = s => { let h = 0; for (let i = 0; i < (s || '').length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h); };

  const streets = ['Industrial Blvd', 'Commerce Dr', 'Technology Way', 'Enterprise Ave', 'Manufacturing Pkwy', 'Aerospace Ct', 'Supply Chain Rd', 'Innovation Loop'];
  const firsts = ['J.', 'R.', 'M.', 'K.', 'S.', 'A.', 'D.', 'T.'];
  const lasts = ['Martinez', 'Nakamura', 'Okafor', 'Lindqvist', 'Patel', 'Chen', 'Rivera', 'Kowalski'];
  const titles = ['VP Supply Chain', 'Dir. Operations', 'Chief Quality Officer', 'VP Manufacturing', 'Compliance Director', 'VP Procurement', 'Dir. Engineering', 'VP Quality Assurance'];

  const h1 = hash(supplier || 'default');
  const h2 = hash(location || 'loc');
  const streetNum = 100 + (h1 % 9900);
  const postal = String(10000 + (h1 * 7 + h2 * 3) % 90000);

  // Parse country from location (e.g. "Portland, OR, USA" → "United States", "Gothenburg, Sweden" → "Sweden")
  const locParts = (location || '').split(',').map(s => s.trim()).filter(Boolean);
  const lastSeg = locParts.length >= 2 ? locParts[locParts.length - 1] : '';
  const country = lastSeg ? (SHORT_COUNTRIES[lastSeg] || lastSeg) : '';
  const cityPart = locParts.length >= 2 ? locParts.slice(0, -1).join(', ') : (locParts[0] || '');

  return {
    street: `${streetNum} ${streets[h1 % streets.length]}`,
    cityPostal: cityPart ? `${cityPart}, ${postal}` : postal,
    country,
    signatory: `${firsts[(h1 + h2) % firsts.length]} ${lasts[h1 % lasts.length]}`,
    sigTitle: titles[h2 % titles.length],
  };
}
