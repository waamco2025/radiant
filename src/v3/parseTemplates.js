export const PARSE_TEMPLATES = {
  'actor-bob': [
    {
      id: 'pt-gov-systems-v1',
      lineageId: 'lineage-pt-gov-systems',
      version: 1,
      name: 'Defense Systems Profile',
      description: 'Extract program metadata, classification, contractor info, and milestone status from defense program documentation.',
      context: 'Expect military program documentation with MIL-STD formatting, CAGE codes, and ITAR markings. Documents may include CDRLs, SOWs, and program status reports.',
      created: '2026-02-10',
      artifactUri: 'qs://govco/templates/defense-systems-profile.json',
      fields: [
        { id: 'f-program', name: 'Program name', instruction: 'Extract the official program designation as stated in the document header or title page. Include any numerical identifier (e.g., "Sentinel-4").', format: 'text', category: 'identification', required: true },
        { id: 'f-classification', name: 'Classification level', instruction: 'Identify the highest classification marking on the document. Look for banner markings, portion markings, or classification authority blocks. Return the full marking string.', format: 'text', category: 'compliance', required: true },
        { id: 'f-contractor', name: 'Prime contractor', instruction: 'Identify the prime contractor organization. Check the title page, distribution statement, or contract data block. Return the full legal entity name.', format: 'text', category: 'identification', required: true },
        { id: 'f-contract', name: 'Contract number', instruction: 'Extract the contract or task order number. Look for FAR/DFARS-formatted contract numbers (e.g., FA8802-26-C-0042). Include all segments.', format: 'text', category: 'identification', required: true },
        { id: 'f-milestone', name: 'Current milestone', instruction: 'Determine the current acquisition milestone or program phase. Common values: MSA, TMRR, EMD, PDR, CDR, TRR, LRIP, FRP. Return the abbreviation.', format: 'text', category: 'process', required: false },
        { id: 'f-trl', name: 'Technology readiness level', instruction: 'Extract or infer the technology readiness level (TRL 1-9). If not explicitly stated, infer from program phase and maturity indicators described in the document.', format: 'text', category: 'process', required: false },
      ],
    },
  ],
  'actor-alice': [
    {
      id: 'pt-electronics-v1',
      lineageId: 'lineage-pt-electronics',
      version: 1,
      name: 'Electronics Component Profile',
      description: 'Standard extraction for electronic components — electrical specs, environmental ratings, compliance status.',
      context: 'Expect component datasheets with tabular electrical specifications, absolute maximum ratings, and package drawings. May follow JEDEC or manufacturer-specific formatting.',
      created: '2026-01-15',
      artifactUri: 'qs://microco/templates/electronics-component-profile.json',
      fields: [
        { id: 'f-voltage', name: 'Operating voltage', instruction: 'Extract the recommended operating voltage range and tolerance from the electrical characteristics table. Include unit (V) and tolerance notation.', format: 'range', category: 'electrical', required: true },
        { id: 'f-power', name: 'Power dissipation', instruction: 'Extract the maximum power dissipation at rated current and ambient temperature. Look in the absolute maximum ratings or thermal characteristics section.', format: 'value', category: 'electrical', required: true },
        { id: 'f-temp', name: 'Temperature range', instruction: 'Extract the operating temperature range from the recommended operating conditions. Return as min to max with unit (°C).', format: 'range', category: 'environmental', required: true },
        { id: 'f-radiation', name: 'Radiation tolerance', instruction: 'Extract the total ionizing dose (TID) tolerance if specified. Look for radiation hardness assurance data or single-event effects ratings. May not be present in commercial datasheets.', format: 'value', category: 'environmental', required: false },
        { id: 'f-itar', name: 'ITAR classification', instruction: 'Identify any ITAR or EAR export control markings. Look for USML category references, ECCNs, or export control notices. Return the classification code.', format: 'text', category: 'compliance', required: false },
        { id: 'f-rohs', name: 'RoHS status', instruction: 'Determine RoHS compliance status. Look for RoHS compliance declarations, lead-free designations, or environmental compliance markings on the datasheet.', format: 'boolean', category: 'compliance', required: true },
        { id: 'f-package', name: 'Package type', instruction: 'Extract the IC package type designation from the ordering information or package outline section. Return the standard abbreviation (e.g., CQFP-44, SOIC-8, QFN-32).', format: 'text', category: 'mechanical', required: true },
        { id: 'f-leads', name: 'Lead count', instruction: 'Extract the number of leads/pins from the pin configuration or package outline. Return as an integer.', format: 'number', category: 'mechanical', required: true },
      ],
    },
    {
      id: 'pt-mechanical-v1',
      lineageId: 'lineage-pt-mechanical',
      version: 1,
      name: 'Mechanical Assembly Profile',
      description: 'For machined parts, assemblies, and structural components — dimensions, materials, tolerances.',
      context: 'Expect engineering drawings, material certifications, and test reports. Documents may reference ASTM, AMS, or MIL standards for material specifications.',
      created: '2026-01-20',
      artifactUri: 'qs://microco/templates/mechanical-assembly-profile.json',
      fields: [
        { id: 'f-material', name: 'Material specification', instruction: 'Extract the primary material specification including alloy designation and governing standard. Look for callouts like "6061-T6 per AMS-QQ-A-200/8" or ASTM/AMS references.', format: 'text', category: 'material', required: true },
        { id: 'f-tensile', name: 'Tensile strength', instruction: 'Extract the ultimate tensile strength value from the material test report or certification. Include unit (MPa or psi).', format: 'value', category: 'mechanical', required: true },
        { id: 'f-yield', name: 'Yield strength', instruction: 'Extract the 0.2% offset yield strength from the material test report. Include unit (MPa or psi).', format: 'value', category: 'mechanical', required: true },
        { id: 'f-hardness', name: 'Hardness', instruction: 'Extract the hardness measurement and scale used (Rockwell HRC, Brinell HB, Vickers HV) from the test report or material cert.', format: 'value', category: 'mechanical', required: true },
        { id: 'f-dimensions', name: 'Critical dimensions', instruction: 'Extract the tightest dimensional tolerance callout from the engineering drawing. Return the tolerance value with unit (e.g., ±0.05mm).', format: 'text', category: 'mechanical', required: false },
        { id: 'f-tolerance', name: 'Tolerance class', instruction: 'Identify the general tolerance standard applied to the part (e.g., ISO 2768-m, ASME Y14.5). Look in the title block or general notes.', format: 'text', category: 'mechanical', required: false },
        { id: 'f-surface', name: 'Surface finish', instruction: 'Extract the required surface roughness value (Ra) from the drawing or spec. Include unit (μm or μin).', format: 'value', category: 'mechanical', required: true },
        { id: 'f-heat-treat', name: 'Heat treatment', instruction: 'Extract the heat treatment condition or specification. Look for temper designations (e.g., T6) and governing specs (e.g., AMS 2770, AMS 5664).', format: 'text', category: 'process', required: false },
      ],
    },
  ],
}

export function getParseTemplatesForActor(actorId) {
  return PARSE_TEMPLATES[actorId] || []
}

export const FIELD_CATEGORIES = {
  electrical: { label: 'Electrical', color: 'var(--accent-blue)' },
  environmental: { label: 'Environmental', color: 'var(--accent-green)' },
  compliance: { label: 'Compliance', color: 'var(--accent-amber)' },
  mechanical: { label: 'Mechanical', color: 'var(--accent-cyan, #22d3ee)' },
  material: { label: 'Material', color: 'var(--accent-orange, #fb923c)' },
  identification: { label: 'Identification', color: 'var(--text-secondary)' },
  process: { label: 'Process', color: 'var(--accent-purple, #a78bfa)' },
}

export function generateMockFields(template) {
  const mockValues = {
    'Program name': 'Sentinel-4',
    'Classification level': 'UNCLASSIFIED//FOUO',
    'Prime contractor': 'Northvane Aerospace',
    'Contract number': 'FA8802-26-C-0042',
    'Current milestone': 'CDR',
    'Technology readiness level': 'TRL 6',
    'Operating voltage': '3.3V ±5%',
    'Power dissipation': '< 2W at rated current',
    'Temperature range': '-55°C to +125°C',
    'Radiation tolerance': 'TID > 100 krad(Si)',
    'ITAR classification': 'Category XV, §121.1',
    'RoHS status': 'Compliant',
    'Package type': 'CQFP-44',
    'Lead count': '44',
    'Material specification': 'Aluminum 6061-T6 per AMS-QQ-A-200/8',
    'Tensile strength': '310 MPa',
    'Yield strength': '276 MPa',
    'Hardness': 'Brinell 95 HB',
    'Critical dimensions': '±0.05mm on all mating surfaces',
    'Tolerance class': 'ISO 2768-m',
    'Surface finish': 'Ra 0.8 μm',
    'Heat treatment': 'T6 temper per AMS 2770',
  }

  const confidence = (name) => {
    const low = ['Radiation tolerance', 'Heat treatment', 'Technology readiness level']
    const med = ['Critical dimensions', 'Tolerance class', 'Current milestone']
    if (low.includes(name)) return 0.72
    if (med.includes(name)) return 0.85
    return 0.90 + Math.random() * 0.08
  }

  return template.fields.map(f => ({
    key: f.id,
    name: f.name,
    instruction: f.instruction,
    category: f.category,
    format: f.format,
    required: f.required,
    value: mockValues[f.name] || `[extracted: ${f.name}]`,
    confidence: parseFloat(confidence(f.name).toFixed(2)),
  }))
}
