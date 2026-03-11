import { TT } from './tokens';

export function generateNetworkEvents(data, verticalKey) {
  const nodes = [];
  const convSeen = {};
  const walk = n => {
    // Match graph layout dedup: skip convergence nodes on second encounter
    if (n.convergenceKey && convSeen[n.convergenceKey]) return;
    if (n.convergenceKey) convSeen[n.convergenceKey] = n.id;
    if (n.type !== 'customer') nodes.push(n);
    if (n.children) n.children.forEach(walk);
  };
  walk(data);
  if (nodes.length < 5) return [];

  // Seeded PRNG — deterministic per vertical
  let seed = 0;
  for (let i = 0; i < verticalKey.length; i++) seed = ((seed << 5) - seed + verticalKey.charCodeAt(i)) | 0;
  seed = Math.abs(seed) || 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };
  const pick = () => nodes[Math.floor(rand() * nodes.length)];

  const now = Date.now();
  const ago = days => new Date(now - days * 86400000).toISOString();
  const typeLabel = n => TT[n.type]?.label || n.type;

  const events = [];

  // 3 supplier events
  for (let i = 0; i < 3; i++) {
    const n = pick();
    events.push({
      id: `evt-${String(events.length + 1).padStart(3, '0')}`,
      type: 'supplier',
      message: `New supplier: ${n.supplier || n.name} registered on the network`,
      detail: `${n.location || 'Unknown location'} · ${typeLabel(n)} supplier`,
      timestamp: ago(rand() * 6 + 0.2),
      nodeId: n.id,
      read: false,
    });
  }

  // 3 asset events
  for (let i = 0; i < 3; i++) {
    const n = pick();
    events.push({
      id: `evt-${String(events.length + 1).padStart(3, '0')}`,
      type: 'asset',
      message: `New asset: ${n.name} registered by ${n.supplier || 'network'}`,
      detail: `${typeLabel(n)} · Block #${n.block || '—'}`,
      timestamp: ago(rand() * 6 + 0.2),
      nodeId: n.id,
      read: false,
    });
  }

  // 3 claim events
  for (let i = 0; i < 3; i++) {
    const n = pick();
    const raw = n.rawAttestations || [];
    const att = raw.length > 0 ? raw[Math.floor(rand() * raw.length)] : null;
    const predLabel = att ? att.predicate.replace(/_/g, ' ') : 'certification';
    events.push({
      id: `evt-${String(events.length + 1).padStart(3, '0')}`,
      type: 'claim',
      message: `New claim: ${predLabel} on ${n.name} verified`,
      detail: `${att?.actor?.name || n.supplier || 'Issuer'} · ${predLabel}`,
      timestamp: ago(rand() * 6 + 0.2),
      nodeId: n.id,
      read: false,
    });
  }

  // 2 evaluation events
  for (let i = 0; i < 2; i++) {
    const n = pick();
    events.push({
      id: `evt-${String(events.length + 1).padStart(3, '0')}`,
      type: 'evaluation',
      message: `${n.name} evaluation completed — passed`,
      detail: `Radiant AI Evaluator · Compliance check`,
      timestamp: ago(rand() * 6 + 0.2),
      nodeId: n.id,
      read: false,
    });
  }

  // 1 invitation event
  {
    const n = pick();
    events.push({
      id: `evt-${String(events.length + 1).padStart(3, '0')}`,
      type: 'invitation',
      message: `${n.supplier || n.name} accepted invitation to disclose`,
      detail: `Invited by Radiant Network · ${n.location || 'Unknown location'}`,
      timestamp: ago(rand() * 6 + 0.2),
      nodeId: n.id,
      read: false,
    });
  }

  // Sort: supplier events first, then by timestamp descending
  events.sort((a, b) => {
    if (a.type === 'supplier' && b.type !== 'supplier') return -1;
    if (a.type !== 'supplier' && b.type === 'supplier') return 1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return events;
}
