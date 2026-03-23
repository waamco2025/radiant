// Evaluation helpers — claim statuses, cost calculator, mock AI result generator

export const CLAIM_STATUS = {
  satisfactory: { label: 'Satisfactory', color: 'var(--accent-green)', short: 'SAT', icon: '✓' },
  unsatisfactory: { label: 'Unsatisfactory', color: 'var(--accent-red)', short: 'UNSAT', icon: '✕' },
  missing: { label: 'Missing', color: 'var(--text-dim)', short: 'MISS', icon: '?' },
}

export const EVAL_STATUS = {
  'in-progress': { label: 'In Progress', color: 'var(--accent-amber)' },
  completed: { label: 'Completed', color: 'var(--accent-green)' },
}

export const CREDITS_PER_REQUIREMENT = 10

export function calculateEvalCost(requirementSet) {
  if (!requirementSet?.requirements) return 0
  return requirementSet.requirements.length * CREDITS_PER_REQUIREMENT
}

function generateMockExtractionValue(req, parsedFields) {
  const label = req.label.toLowerCase()

  if (parsedFields && parsedFields.length > 0) {
    const match = parsedFields.find(f =>
      f.name?.toLowerCase().includes(label.slice(0, 8)) ||
      label.includes(f.name?.toLowerCase().slice(0, 8))
    )
    if (match?.value) return match.value
  }

  if (label.includes('voltage') || label.includes('power')) return `${(2.5 + Math.random() * 3).toFixed(1)}V ±${(0.1 + Math.random() * 0.5).toFixed(1)}%`
  if (label.includes('temperature') || label.includes('thermal')) return `${-40 + Math.floor(Math.random() * 20)}°C to +${85 + Math.floor(Math.random() * 40)}°C`
  if (label.includes('frequency') || label.includes('clock')) return `${(50 + Math.floor(Math.random() * 200))} MHz`
  if (label.includes('lead') || label.includes('pin')) return `${[8, 14, 16, 24, 32, 48, 64][Math.floor(Math.random() * 7)]}`
  if (label.includes('package')) return ['QFN-24', 'SOIC-8', 'BGA-256', 'TSSOP-16', 'DIP-14'][Math.floor(Math.random() * 5)]
  if (label.includes('material')) return ['FR-4 / Copper / Tin-Lead', 'Silicon / Gold wire bond', 'Ceramic / Kovar'][Math.floor(Math.random() * 3)]
  if (label.includes('itar') || label.includes('classification')) return ['EAR99', 'USML Cat XI(b)', 'USML Cat XII(d)', '9A003.a'][Math.floor(Math.random() * 4)]
  if (label.includes('radiation') || label.includes('dose')) return `${(50 + Math.floor(Math.random() * 150))} krad(Si)`
  if (label.includes('lot') || label.includes('batch')) return `LOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  if (label.includes('date')) return `${2025 + Math.floor(Math.random() * 2)}-WK${String(Math.floor(Math.random() * 52) + 1).padStart(2, '0')}`

  return `${(Math.random() * 100).toFixed(2)} ${['units', 'mm', 'µA', 'dB', 'Ω'][Math.floor(Math.random() * 5)]}`
}

export function generateMockAIResults(requirementSet, disclosureType, parsedFields) {
  return requirementSet.requirements.map(req => {
    const confidence = 0.7 + Math.random() * 0.28

    if (req.type === 'extraction') {
      return {
        requirementId: req.id,
        label: req.label,
        description: req.description,
        type: 'extraction',
        aiValue: generateMockExtractionValue(req, parsedFields),
        aiConfidence: Math.round(confidence * 100) / 100,
        humanValue: null,
        status: null,
      }
    } else {
      const aiResult = Math.random() > 0.15
      return {
        requirementId: req.id,
        label: req.label,
        description: req.description,
        type: 'inference',
        aiValue: aiResult ? 'Yes' : 'No',
        aiConfidence: Math.round(confidence * 100) / 100,
        humanValue: null,
        status: null,
      }
    }
  })
}

export function summarizeEvaluation(claims) {
  const summary = { ok: 0, warn: 0, bad: 0, total: 0 }
  if (!claims) return summary

  claims.forEach(c => {
    summary.total++
    if (c.status === 'satisfactory') summary.ok++
    else if (c.status === 'unsatisfactory') summary.bad++
    else if (c.status === 'missing') summary.warn++
  })

  return summary
}
