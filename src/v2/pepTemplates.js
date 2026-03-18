// PEP (Parse & Extract Protocol) — Templates and mock data generation

export const PEP_TEMPLATES = [
  {
    id: 'pep-electronics',
    name: 'Electronics Component Profile',
    description: 'Standard extraction for electronic components — electrical specs, environmental ratings, compliance status.',
    fieldCount: 10,
    fields: [
      { id: 'f-voltage', name: 'Operating voltage', category: 'electrical', type: 'range' },
      { id: 'f-power', name: 'Power dissipation', category: 'electrical', type: 'value' },
      { id: 'f-temp', name: 'Temperature range', category: 'environmental', type: 'range' },
      { id: 'f-radiation', name: 'Radiation tolerance', category: 'environmental', type: 'value' },
      { id: 'f-itar', name: 'ITAR classification', category: 'compliance', type: 'text' },
      { id: 'f-rohs', name: 'RoHS status', category: 'compliance', type: 'boolean' },
      { id: 'f-package', name: 'Package type', category: 'mechanical', type: 'text' },
      { id: 'f-leads', name: 'Lead count', category: 'mechanical', type: 'number' },
      { id: 'f-material', name: 'Material composition', category: 'material', type: 'text' },
      { id: 'f-lot', name: 'Lot number', category: 'identification', type: 'text' },
    ],
  },
  {
    id: 'pep-mechanical',
    name: 'Mechanical Assembly Profile',
    description: 'For machined parts, assemblies, and structural components — dimensions, materials, tolerances.',
    fieldCount: 8,
    fields: [
      { id: 'f-material-spec', name: 'Material specification', category: 'material', type: 'text' },
      { id: 'f-tensile', name: 'Tensile strength', category: 'mechanical', type: 'value' },
      { id: 'f-yield', name: 'Yield strength', category: 'mechanical', type: 'value' },
      { id: 'f-hardness', name: 'Hardness (Rockwell)', category: 'mechanical', type: 'value' },
      { id: 'f-dimensions', name: 'Critical dimensions', category: 'mechanical', type: 'text' },
      { id: 'f-tolerance', name: 'Tolerance class', category: 'mechanical', type: 'text' },
      { id: 'f-surface', name: 'Surface finish', category: 'mechanical', type: 'value' },
      { id: 'f-heat-treat', name: 'Heat treatment', category: 'process', type: 'text' },
    ],
  },
  {
    id: 'pep-compliance',
    name: 'Regulatory Compliance Profile',
    description: 'Extracts certifications, export controls, and regulatory status from compliance documentation.',
    fieldCount: 7,
    fields: [
      { id: 'f-cert-body', name: 'Certifying body', category: 'compliance', type: 'text' },
      { id: 'f-cert-id', name: 'Certificate number', category: 'identification', type: 'text' },
      { id: 'f-issue-date', name: 'Issue date', category: 'identification', type: 'text' },
      { id: 'f-expiry-date', name: 'Expiry date', category: 'identification', type: 'text' },
      { id: 'f-export-class', name: 'Export classification', category: 'compliance', type: 'text' },
      { id: 'f-jurisdiction', name: 'Jurisdiction', category: 'compliance', type: 'text' },
      { id: 'f-restrictions', name: 'Use restrictions', category: 'compliance', type: 'text' },
    ],
  },
]

// Field category colors (for grouping in results)
export const FIELD_CATEGORIES = {
  electrical: { label: 'Electrical', color: 'var(--accent-blue)' },
  environmental: { label: 'Environmental', color: 'var(--accent-green)' },
  compliance: { label: 'Compliance', color: 'var(--accent-amber)' },
  mechanical: { label: 'Mechanical', color: 'var(--accent-cyan)' },
  material: { label: 'Material', color: 'var(--accent-orange, #fb923c)' },
  identification: { label: 'Identification', color: 'var(--text-secondary)' },
  process: { label: 'Process', color: 'var(--accent-purple, #a78bfa)' },
}

export function generateMockParsedFields(template, evidenceName) {
  const mockValues = {
    'Operating voltage': '3.3V ±5%',
    'Power dissipation': '< 2W at rated current',
    'Temperature range': '-55°C to +125°C',
    'Radiation tolerance': 'TID > 100 krad(Si)',
    'ITAR classification': 'Category XV, §121.1',
    'RoHS status': 'Compliant',
    'Package type': 'CQFP-44',
    'Lead count': '44',
    'Material composition': 'Silicon die, gold bond wires, ceramic package',
    'Lot number': 'LOT-2025-11-4410',
    'Material specification': 'Inconel 718 per AMS 5662',
    'Tensile strength': '1,034 MPa',
    'Yield strength': '827 MPa',
    'Hardness (Rockwell)': 'HRC 36',
    'Critical dimensions': '±0.005" on all mating surfaces',
    'Tolerance class': 'ISO 2768-m',
    'Surface finish': 'Ra 0.8 μm',
    'Heat treatment': 'Solution treated + aged per AMS 5664',
    'Certifying body': 'NADCAP',
    'Certificate number': 'NC-2025-08841',
    'Issue date': '2025-06-15',
    'Expiry date': '2026-06-15',
    'Export classification': 'EAR99',
    'Jurisdiction': 'United States, EAR',
    'Use restrictions': 'None identified',
  }

  const confidence = (fieldName) => {
    const lowConf = ['Radiation tolerance', 'Use restrictions', 'Heat treatment']
    const medConf = ['Material composition', 'Critical dimensions', 'Tolerance class']
    if (lowConf.includes(fieldName)) return 'low'
    if (medConf.includes(fieldName)) return 'medium'
    return 'high'
  }

  return template.fields.map(field => ({
    ...field,
    value: mockValues[field.name] || 'N/A',
    confidence: confidence(field.name),
  }))
}
