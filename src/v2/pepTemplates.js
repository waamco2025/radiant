// PEP (Parse & Extract Protocol) — Templates and mock data generation
//
// Phase 9A.1 item 9: every field carries `aiValue` + `aiConfidence`. The
// Parse modal pre-populates each row with these values so a freshly-opened
// review stage shows believable AI extractions — no empty placeholders.

export const DEMO_PEP_TEMPLATES = {
  'alice-microco': [
    {
      id: 'pep-electronics-v1',
      lineageId: 'lineage-pep-electronics',
      version: 1,
      name: 'Electronics Component Profile',
      description: 'Standard extraction for electronic components — electrical specs, environmental ratings, compliance status.',
      created: '2026-01-15',
      fields: [
        { id: 'f-voltage', name: 'Operating voltage', category: 'electrical', type: 'range', instruction: 'Extract the nominal operating voltage and tolerance from the datasheet specifications section', format: 'Voltage with tolerance (e.g., "3.3V ±5%")', required: true, aiValue: '3.3V \u00b15%', aiConfidence: 0.95 },
        { id: 'f-power', name: 'Power dissipation', category: 'electrical', type: 'value', instruction: 'Extract the maximum power dissipation at rated current from the absolute maximum ratings', format: 'Power value with unit (e.g., "< 2W")', required: true, aiValue: '< 2W at rated current', aiConfidence: 0.91 },
        { id: 'f-temp', name: 'Temperature range', category: 'environmental', type: 'range', instruction: 'Extract the operating temperature range from the environmental specifications', format: 'Min to max range (e.g., "-55\u00b0C to +125\u00b0C")', required: true, aiValue: '-55\u00b0C to +125\u00b0C', aiConfidence: 0.97 },
        { id: 'f-radiation', name: 'Radiation tolerance', category: 'environmental', type: 'value', instruction: 'Extract total ionizing dose tolerance from radiation hardness assurance section', format: 'TID value (e.g., "TID > 100 krad(Si)")', required: true, aiValue: 'TID > 100 krad(Si)', aiConfidence: 0.88 },
        { id: 'f-itar', name: 'ITAR classification', category: 'compliance', type: 'text', instruction: 'Extract ITAR/EAR classification category and section reference', format: 'Category and section (e.g., "Category XV, \u00a7121.1")', required: true, aiValue: 'USML Category XV, \u00a7121.1', aiConfidence: 0.86 },
        { id: 'f-rohs', name: 'RoHS status', category: 'compliance', type: 'boolean', instruction: 'Determine RoHS compliance status from environmental compliance section', format: '"Compliant" or "Non-compliant"', required: false, aiValue: 'Compliant', aiConfidence: 0.92 },
        { id: 'f-package', name: 'Package type', category: 'mechanical', type: 'text', instruction: 'Extract the IC package type designation from the mechanical specifications', format: 'Package code (e.g., "CQFP-44")', required: true, aiValue: 'CQFP-128', aiConfidence: 0.93 },
        { id: 'f-leads', name: 'Lead count', category: 'mechanical', type: 'number', instruction: 'Extract the total pin/lead count from the pinout or package section', format: 'Integer', required: false, aiValue: '128', aiConfidence: 0.99 },
        { id: 'f-material', name: 'Material composition', category: 'material', type: 'text', instruction: 'Extract die, bond wire, and package material composition', format: 'Comma-separated materials', required: false, aiValue: 'Si die, Au bond wires, ceramic (Al\u2082O\u2083) body', aiConfidence: 0.83 },
        { id: 'f-lot', name: 'Lot number', category: 'identification', type: 'text', instruction: 'Extract the manufacturing lot or batch number if present', format: 'Lot identifier string', required: false, aiValue: 'LOT-2026-PRM3A-0047', aiConfidence: 0.96 },
      ],
    },
    {
      id: 'pep-mechanical-v1',
      lineageId: 'lineage-pep-mechanical',
      version: 1,
      name: 'Mechanical Assembly Profile',
      description: 'For machined parts, assemblies, and structural components — dimensions, materials, tolerances.',
      created: '2026-01-20',
      fields: [
        { id: 'f-material-spec', name: 'Material specification', category: 'material', type: 'text', instruction: 'Extract the material specification and governing standard (e.g., AMS, ASTM)', format: 'Material name and spec number', required: true, aiValue: 'AMS 5643 (17-4 PH stainless steel)', aiConfidence: 0.90 },
        { id: 'f-tensile', name: 'Tensile strength', category: 'mechanical', type: 'value', instruction: 'Extract the ultimate tensile strength from the mechanical properties table', format: 'Value with unit (e.g., "1,034 MPa")', required: true, aiValue: '1,034 MPa', aiConfidence: 0.94 },
        { id: 'f-yield', name: 'Yield strength', category: 'mechanical', type: 'value', instruction: 'Extract the 0.2% offset yield strength from the mechanical properties', format: 'Value with unit (e.g., "827 MPa")', required: true, aiValue: '827 MPa', aiConfidence: 0.92 },
        { id: 'f-hardness', name: 'Hardness (Rockwell)', category: 'mechanical', type: 'value', instruction: 'Extract the Rockwell hardness value and scale', format: 'Scale and value (e.g., "HRC 36")', required: false, aiValue: 'HRC 36', aiConfidence: 0.87 },
        { id: 'f-dimensions', name: 'Critical dimensions', category: 'mechanical', type: 'text', instruction: 'Extract critical mating surface dimensions and tolerances from the drawing', format: 'Tolerance expression', required: true, aiValue: '25.4 \u00b1 0.02 mm (mating bore)', aiConfidence: 0.81 },
        { id: 'f-tolerance', name: 'Tolerance class', category: 'mechanical', type: 'text', instruction: 'Identify the general tolerance class per ISO 2768 or equivalent', format: 'ISO class (e.g., "ISO 2768-m")', required: true, aiValue: 'ISO 2768-m', aiConfidence: 0.89 },
        { id: 'f-surface', name: 'Surface finish', category: 'mechanical', type: 'value', instruction: 'Extract the surface roughness (Ra) requirement from the finish specification', format: 'Ra value with unit', required: false, aiValue: 'Ra 0.8 \u03bcm', aiConfidence: 0.85 },
        { id: 'f-heat-treat', name: 'Heat treatment', category: 'process', type: 'text', instruction: 'Extract the heat treatment process and governing specification', format: 'Process description with spec reference', required: false, aiValue: 'H1025 per AMS 2759/3', aiConfidence: 0.78 },
      ],
    },
    {
      id: 'pep-compliance-v1',
      lineageId: 'lineage-pep-compliance',
      version: 1,
      name: 'Regulatory Compliance Profile',
      description: 'Extracts certifications, export controls, and regulatory status from compliance documentation.',
      created: '2026-02-01',
      fields: [
        { id: 'f-cert-body', name: 'Certifying body', category: 'compliance', type: 'text', instruction: 'Identify the certification body or accreditation organization', format: 'Organization name', required: true, aiValue: 'DSCC (Defense Supply Center Columbus)', aiConfidence: 0.92 },
        { id: 'f-cert-id', name: 'Certificate number', category: 'identification', type: 'text', instruction: 'Extract the certificate or accreditation number', format: 'Certificate ID string', required: true, aiValue: 'CERT-2026-PRM3A-0091', aiConfidence: 0.94 },
        { id: 'f-issue-date', name: 'Issue date', category: 'identification', type: 'text', instruction: 'Extract the certificate issue date', format: 'YYYY-MM-DD', required: true, aiValue: '2026-01-15', aiConfidence: 0.97 },
        { id: 'f-expiry-date', name: 'Expiry date', category: 'identification', type: 'text', instruction: 'Extract the certificate expiration date', format: 'YYYY-MM-DD', required: true, aiValue: '2029-01-15', aiConfidence: 0.97 },
        { id: 'f-export-class', name: 'Export classification', category: 'compliance', type: 'text', instruction: 'Extract the export control classification (ITAR, EAR, etc.)', format: 'Classification code', required: true, aiValue: 'ITAR USML Category XV', aiConfidence: 0.89 },
        { id: 'f-jurisdiction', name: 'Jurisdiction', category: 'compliance', type: 'text', instruction: 'Identify the regulatory jurisdiction and governing body', format: 'Country and regulatory framework', required: false, aiValue: 'United States — U.S. Dept. of State / DDTC', aiConfidence: 0.88 },
        { id: 'f-restrictions', name: 'Use restrictions', category: 'compliance', type: 'text', instruction: 'Extract any use restrictions, end-user limitations, or prohibited activities', format: 'Free text description', required: false, aiValue: 'No re-export to ITAR-excluded jurisdictions; defense end-users only', aiConfidence: 0.76 },
      ],
    },
  ],
  'bob-govco': [],
}

export function getPEPTemplatesForRole(roleId) {
  return DEMO_PEP_TEMPLATES[roleId] || []
}

// Keep legacy export for backward compatibility
export const PEP_TEMPLATES = DEMO_PEP_TEMPLATES['alice-microco']

// Field category colors
export const FIELD_CATEGORIES = {
  electrical: { label: 'Electrical', color: 'var(--accent-blue)' },
  environmental: { label: 'Environmental', color: 'var(--accent-green)' },
  compliance: { label: 'Compliance', color: 'var(--accent-amber)' },
  mechanical: { label: 'Mechanical', color: 'var(--accent-cyan)' },
  material: { label: 'Material', color: 'var(--accent-orange, #fb923c)' },
  identification: { label: 'Identification', color: 'var(--text-secondary)' },
  process: { label: 'Process', color: 'var(--accent-purple, #a78bfa)' },
}

// Field type options for the editor
export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'value', label: 'Value (with unit)' },
  { value: 'range', label: 'Range' },
  { value: 'boolean', label: 'Yes/No' },
]

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
    'Surface finish': 'Ra 0.8 \u03BCm',
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
    value: mockValues[field.name] || `${field.name} value`,
    confidence: confidence(field.name),
  }))
}
