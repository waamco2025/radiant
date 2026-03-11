// AutoCo Motors — Blank-slate automotive vertical (single Organization node)

function mulberry32(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function generateDataset(seed = 77) {
  const rand = mulberry32(seed);
  const HEX = '0123456789abcdef';
  const mkHash = () => { let h = '0x'; for (let i = 0; i < 8; i++) h += HEX[Math.floor(rand() * 16)]; return h; };

  const SIG_NAMES = ['M. Chen', 'R. Patel', 'A. Johansson', 'K. Okafor', 'S. Leclerc'];
  function mkSignatory(predicate) {
    if (predicate === 'evaluated_against_requirements') return { name: 'Automated', title: 'AI System' };
    const name = SIG_NAMES[Math.abs(predicate.charCodeAt(0)) % SIG_NAMES.length];
    const titles = { supplied_by: 'VP Procurement', registered_on_chain: 'Systems Administrator', certified: 'Lead Auditor' };
    return { name, title: titles[predicate] || 'Director' };
  }

  function mkAtt(actor, predicate, subject, evidenceType, opts = {}) {
    return {
      actor,
      predicate,
      subject,
      evidence: { hash: opts.evidenceHash || mkHash(), type: evidenceType, storageRef: `vault://radiant-vault/${mkHash().slice(2)}-${mkHash().slice(2)}`, accessLevel: opts.accessLevel || 'internal' },
      timestamp: opts.timestamp || '2025-06-15T10:00:00Z',
      validUntil: opts.validUntil !== undefined ? opts.validUntil : null,
      signature: mkHash(),
      status: opts.status || 'verified',
      signatory: mkSignatory(predicate),
    };
  }

  const autocoActor = { name: 'AutoCo Motors Inc.', id: 'org-autoco-motors-01' };
  const RADIANT_SYSTEM = { name: 'Radiant Provenance Engine', id: 'sys-radiant-001' };

  const root = {
    id: 'autoco',
    name: 'AutoCo Motors',
    type: 'customer',
    location: 'Detroit, MI, USA',
    lat: 42.33,
    lng: -83.05,
    attestations: [
      mkAtt(autocoActor, 'supplied_by', 'autoco', 'corporate_charter',
        { timestamp: '2021-03-01T00:00:00Z' }),
      mkAtt(RADIANT_SYSTEM, 'registered_on_chain', 'autoco', 'block_1',
        { evidenceHash: mkHash(), timestamp: '2026-02-01T08:00:00Z' }),
      mkAtt({ name: 'IATF', id: 'org-iatf-01' }, 'certified', 'autoco', 'IATF 16949',
        { timestamp: '2025-01-10T00:00:00Z', validUntil: '2028-01-10', status: 'verified' }),
    ],
    children: [],
  };

  return root;
}

// Module-level cache
let _cached = null;
export function getDataset() {
  if (!_cached) _cached = generateDataset();
  return _cached;
}
