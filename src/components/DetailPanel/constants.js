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
    label: 'Extraction + Inference',
    short: 'FULL',
    borderStyle: 'solid',
    tip: 'Full access. Evaluator can run both extraction and inference requirements against the evidence.',
    permTip: 'Evaluator has full access — can extract specific values and run inference checks.',
  },
  selective: {
    color: 'var(--accent-sda-selective)',
    label: 'Inference only',
    short: 'SELECTIVE',
    borderStyle: 'dashed',
    tip: 'Selective access. Evaluator can only run inference requirements — no raw data extraction.',
    permTip: 'Evaluator can run inference checks (yes/no/valid) but cannot extract specific values.',
  },
  proofonly: {
    color: 'var(--accent-sda-derivative)',
    label: 'POE pass/fail only',
    short: 'PROOF-ONLY',
    borderStyle: 'dotted',
    tip: 'Proof-only. Recipient receives a pass/fail result from a prior evaluation — no evaluator access.',
    permTip: 'Recipient sees only a pass/fail badge from a prior evaluation. No new evaluation possible.',
  },
  cascade: {
    color: 'var(--accent-sda-cascade)',
    label: 'Cascaded access',
    short: 'CASCADE',
    borderStyle: 'dashed',
    tip: 'Cascade disclosure. Access was passed through an intermediary — not directly from the asset owner. Permission is constrained by the upstream SDA.',
    permTip: 'Permission was received through a cascade chain. The intermediary cannot grant more access than they received.',
  },
}

export const CATEGORY_CONFIG = {
  person:  { icon: '●', color: 'var(--accent-cyan)',   label: 'PERSON' },
  party:   { icon: '⬡', color: 'var(--accent-indigo)', label: 'PARTY' },
  place:   { icon: '◆', color: 'var(--accent-green)',  label: 'PLACE' },
  product: { icon: '■', color: 'var(--accent-blue)',   label: 'PRODUCT' },
  process: { icon: '◎', color: 'var(--accent-amber)',  label: 'PROCESS' },
}

export const REVOKE_WARNINGS = {
  full: {
    title: '⚠ Ownership disclosure',
    message: 'You are the sole owner. Revoking will archive this asset, terminate downstream disclosures, and remove it from your network.',
  },
  selective: {
    title: '⚠ Selective disclosure',
    message: "Revoking removes the recipient's ability to run inference requirements. Existing results on their network will be marked as revoked.",
  },
  proofonly: {
    title: '⚠ Proof-only disclosure',
    message: 'Revoking invalidates the POE shared with this party. Their badge will be marked as revoked.',
  },
  cascade: {
    title: '⚠ Cascade disclosure',
    message: 'Revoking removes your cascaded access to this asset. If the upstream SDA between the intermediary and the owner is also revoked, this cascade is automatically invalidated — two points of failure.',
  },
}
