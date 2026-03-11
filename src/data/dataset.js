/* ═══ Compatibility layer ═════════════════════════════════════════════
 * The generator produces thin nodes where all meaningful data lives in
 * a rich `attestations` array. This layer walks the tree and derives
 * the old flat properties that existing UI components expect.
 *
 * New format preserved as `node.rawAttestations`.
 * Old format written to `node.attestations` (cert/cal entries only).
 * ═══════════════════════════════════════════════════════════════════ */

const REF = new Date('2026-02-17');
const MS_DAY = 86400000;

export function applyCompat(node) {
  // If already processed, rawAttestations holds the originals — use that.
  // (Generators cache their tree; StrictMode + vertical switching can re-enter.)
  const raw = node.rawAttestations || node.attestations || [];

  node.rawAttestations = raw;

  // ── supplier ──
  const supAtt = raw.find(a => a.predicate === 'supplied_by');
  node.supplier = supAtt ? supAtt.actor.name : '';

  // ── block & token & createdAt ──
  const regAtt = raw.find(a => a.predicate === 'registered_on_chain');
  if (regAtt) {
    node.token = regAtt.evidence.hash;
    const m = regAtt.evidence.type.match(/^block_(\d+)$/);
    node.block = m ? parseInt(m[1]) : 0;
    node.createdAt = regAtt.timestamp;
    const regDate = new Date(regAtt.timestamp);
    if ((REF - regDate) / MS_DAY <= 30) node.isNew = true;
  } else {
    node.token = '0x00000000';
    node.block = 0;
  }

  // ── itar ──
  if (raw.some(a => a.predicate === 'itar_controlled')) node.itar = true;

  // ── compliance (worst status among certified + calibrated) ──
  const certAtts = raw.filter(a => a.predicate === 'certified' || a.predicate === 'calibrated');
  if (certAtts.length > 0) {
    if (certAtts.some(a => a.status === 'expired' || a.status === 'revoked' || a.status === 'contested')) {
      node.compliance = 'expired';
    } else if (certAtts.some(a => a.status === 'pending')) {
      node.compliance = 'pending';
    } else if (certAtts.some(a => {
      if (!a.validUntil) return false;
      const exp = new Date(a.validUntil);
      return exp > REF && (exp - REF) / MS_DAY <= 180;
    })) {
      node.compliance = 'expiring';
    } else {
      node.compliance = 'compliant';
    }
  } else {
    node.compliance = 'compliant';
  }

  // ── evaluated ──
  const inspAtt = raw.find(a => a.predicate === 'inspected');
  if (inspAtt) {
    node.evaluated = {
      date: inspAtt.timestamp.split('T')[0],
      by: inspAtt.actor.name,
      result: inspAtt.status === 'verified' ? 'pass' : 'fail',
    };
  }

  // ── notes ──
  const riskAtt = raw.find(a => a.predicate === 'risk_assessed');
  if (riskAtt) node.notes = riskAtt.evidence.type;

  // ── Old-format attestations (for attestCoverage / compat) ──
  node.attestations = certAtts.map(a => {
    let status;
    if (a.status === 'expired' || a.status === 'revoked') {
      status = 'expired';
    } else if (a.status === 'pending') {
      status = 'pending';
    } else if (a.validUntil) {
      const exp = new Date(a.validUntil);
      const diff = (exp - REF) / MS_DAY;
      status = diff <= 0 ? 'expired' : diff <= 180 ? 'expiring' : 'compliant';
    } else {
      status = 'compliant';
    }
    return {
      name: a.evidence.type,
      issuer: a.actor.name,
      expires: a.validUntil || 'N/A',
      status,
    };
  });

  // Recurse
  if (node.children) node.children.forEach(applyCompat);
}

/* ═══ Utility functions (unchanged — work via compat properties) ═══ */

export function countN(n){let c=1+(n.childCount||0);if(n.children)n.children.forEach(x=>c+=countN(x));return c;}
export function maxD(n,d=0){if((!n.children||!n.children.length)&&!n.childCount)return d;if(n.children?.length)return Math.max(...n.children.map(c=>maxD(c,d+1)));return d+2;}
export function colLocs(n,a=[]){if(n.lat!==undefined)a.push(n);if(n.children)n.children.forEach(c=>colLocs(c,a));return a;}
export function convKeys(n,s={},d=new Set()){if(n.convergenceKey){if(s[n.convergenceKey])d.add(n.convergenceKey);else s[n.convergenceKey]=true;}if(n.children)n.children.forEach(c=>convKeys(c,s,d));return d;}
export function compCounts(n,c={compliant:0,expiring:0,expired:0,pending:0}){if(n.compliance)c[n.compliance]=(c[n.compliance]||0)+1;if(n.children)n.children.forEach(x=>compCounts(x,c));return c;}
export function newCount(n){let c=n.isNew?1:0;if(n.children)n.children.forEach(x=>c+=newCount(x));return c;}
export function traceability(n){let raw=0,other=0,ph=0;function w(x){if(x.placeholder){ph+=(x.childCount||0)*3;return;}if(!x.children||!x.children.length){if(x.type==="rawsource")raw++;else other++;return;}x.children.forEach(w);}w(n);const at=raw+other;return{raw,other,ph,ad:at>0?Math.round(raw/at*100):0,nc:(at+ph)>0?Math.round(at/(at+ph)*100):0};}
export function itarCount(n){let c=n.itar?1:0;if(n.children)n.children.forEach(x=>c+=itarCount(x));return c;}
export function evalStats(n){let e=0,ne=0;function w(x){if(x.type!=="customer"&&x.type!=="system"){if(x.evaluated)e++;else ne++;}if(x.children)x.children.forEach(w);}w(n);return{e,ne};}
export function countryBk(n){const c={};function w(x){if(x.location){const co=x.location.split(",").pop().trim();c[co]=(c[co]||0)+1;}if(x.children)x.children.forEach(w);}w(n);return c;}
export function typeBk(n){const c={};function w(x){if(x.type!=="customer"){c[x.type]=(c[x.type]||0)+1;}if(x.children)x.children.forEach(w);}w(n);return c;}
export function singleSourceNodes(n){const r=[];function w(x){if(x.type!=="customer"&&x.type!=="system"&&x.notes&&/SOLE|~75%/.test(x.notes))r.push(x);if(x.children)x.children.forEach(w);}w(n);return r;}
export function itarNodes(n){const r=[];function w(x){if(x.itar)r.push(x);if(x.children)x.children.forEach(w);}w(n);return r;}
export function certNodes(n){const r=[];function w(x){if(x.type!=="customer"&&x.type!=="system"&&x.compliance&&x.compliance!=="compliant")r.push(x);if(x.children)x.children.forEach(w);}w(n);return r;}
export function attestCoverage(n){const byType={};function w(x){if(x.type!=="customer"&&x.type!=="system"){if(!byType[x.type])byType[x.type]={v:0,u:0};const hasValid=x.attestations?.some(a=>a.status!=="expired");if(hasValid)byType[x.type].v++;else byType[x.type].u++;}if(x.children)x.children.forEach(w);}w(n);let tv=0,tu=0;Object.values(byType).forEach(t=>{tv+=t.v;tu+=t.u;});return{byType,tv,tu};}
