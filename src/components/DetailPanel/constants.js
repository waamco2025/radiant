// Detail Panel — layout constants and config

export const PANEL_W = 480
export const GUTTER = 18
export const LABEL_W = 170
export const BTN_H = 34
export const ROW_H = 36
export const MAX_ROWS = 8.5

export const SDA_CONFIG = {
  full: {
    color: 'var(--accent-sda-full)',
    label: 'Full access',
    short: 'FULL',
    borderStyle: 'solid',
    tip: 'Full disclosure. The receiving party can access all parsed data fields and run evaluations against them.',
    permTip: 'Full access to all parsed data fields. The receiving party can run any evaluation requirements against this data.',
  },
  selective: {
    color: 'var(--accent-sda-selective)',
    label: 'Selected fields only',
    short: 'SELECTIVE',
    borderStyle: 'dashed',
    tip: 'Selective disclosure. The receiving party can only access data fields chosen by the owner.',
    permTip: 'Access to owner-selected data fields only. Evaluations can only run against disclosed fields — undisclosed fields produce unevaluable results.',
  },
  proofonly: {
    color: 'var(--accent-sda-derivative)',
    label: 'Pass/fail results only',
    short: 'PROOF-ONLY',
    borderStyle: 'dotted',
    tip: 'Proof-only disclosure. The receiving party sees only pass/fail results from the owner\'s evaluations. No data field access.',
    permTip: 'No data access. The receiving party sees only pass/fail badges from existing evaluations. No new evaluations can be run.',
  },
  cascade: {
    color: 'var(--accent-sda-cascade)',
    label: 'Cascaded access',
    short: 'CASCADE',
    borderStyle: 'dashed',
    tip: 'Cascade disclosure. Access was forwarded through an intermediary. Permission is capped at the intermediary\'s own access level.',
    permTip: 'Access was received through a cascade chain. Permission cannot exceed what the intermediary was granted.',
  },
}

export const CATEGORY_CONFIG = {
  person:  { icon: '●', color: 'var(--accent-cyan)',   label: 'PERSON', tipText: 'Person — an individual actor in the supply chain' },
  party:   { icon: '⬡', color: 'var(--accent-indigo)', label: 'PARTY', tipText: 'Party — an organization or legal entity' },
  place:   { icon: '◆', color: 'var(--accent-green)',  label: 'PLACE', tipText: 'Place — a physical location or facility' },
  product: { icon: '■', color: 'var(--accent-blue)',   label: 'PRODUCT', tipText: 'Product — a manufactured item or component' },
  process: { icon: '◎', color: 'var(--accent-amber)',  label: 'PROCESS', tipText: 'Process — a manufacturing or operational workflow' },
  evidence:   { icon: '◧', color: 'var(--accent-orange, #fb923c)', label: 'EVIDENCE', tipText: 'Evidence — a source document or file attached to an asset' },
  parse:      { icon: '⊞', color: 'var(--accent-purple, #a78bfa)', label: 'PARSE', tipText: 'Parse — structured data extracted from evidence via PEP' },
  evaluation: { icon: '◆', color: 'var(--accent-indigo)', label: 'EVALUATION', tipText: 'AI-assisted evaluation of an asset against a published requirement set. Contains extraction values and inference determinations reviewed by a human evaluator.' },
}

export const REVOKE_WARNINGS = {
  full: {
    title: '⚠ Revoke full disclosure?',
    message: "Revoking removes the recipient's ability to extract data fields and run evaluations. The disclosed node and its children will be removed from their network. All disclosure parties will be notified. This action is recorded on-chain and cannot be undone.",
  },
  selective: {
    title: '⚠ Revoke selective disclosure?',
    message: "Revoking removes the recipient's access to the disclosed fields. Existing evaluation results on their network will be marked as revoked. All disclosure parties will be notified. This action is recorded on-chain and cannot be undone.",
  },
  proofonly: {
    title: '⚠ Revoke proof-only disclosure?',
    message: "Revoking invalidates the proof-of-evaluation shared with this party. Their pass/fail badge will be marked as revoked. This action is recorded on-chain and cannot be undone.",
  },
  cascade: {
    title: '⚠ Revoke cascade disclosure?',
    message: 'Revoking removes your cascaded access to this asset. If the upstream disclosure is also revoked, this cascade is automatically invalidated. This action is recorded on-chain and cannot be undone.',
  },
}
