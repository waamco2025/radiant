export const REQUIREMENT_SETS = {
  'actor-bob': [
    {
      id: 'rs-mil-prf-55681-v1',
      lineageId: 'lineage-rs-mil-prf-55681',
      version: 1,
      name: 'MIL-PRF-55681 Compliance',
      description: 'Military specification for electronic component qualification — power, thermal, radiation, and export compliance checks.',
      context: 'Evaluate against MIL-PRF-55681 requirements for space-qualified electronic components. Documents should contain electrical specifications, environmental test data, and compliance certifications.',
      created: '2026-02-15',
      artifactUri: 'qs://govco/reqsets/mil-prf-55681-compliance.json',
      requirements: [
        { id: 'req-001', name: 'Power output stability', instruction: 'Extract the rated output voltage and tolerance under load from the electrical specifications.', criterion: 'Output voltage must be within ±5% of nominal under rated load conditions.', format: 'value', category: 'electrical', required: true },
        { id: 'req-002', name: 'Thermal dissipation', instruction: 'Extract the maximum power dissipation at rated current from the thermal characteristics section.', criterion: 'Power dissipation must not exceed 2.5W at maximum rated current and 85°C ambient.', format: 'value', category: 'electrical', required: true },
        { id: 'req-003', name: 'Operating temperature range', instruction: 'Extract the operating temperature range from the recommended operating conditions.', criterion: 'Must support full military temperature range: -55°C to +125°C minimum.', format: 'range', category: 'environmental', required: true },
        { id: 'req-004', name: 'Radiation tolerance', instruction: 'Extract total ionizing dose (TID) tolerance from radiation hardness assurance data.', criterion: 'TID tolerance must exceed 100 krad(Si) for LEO mission profile.', format: 'value', category: 'environmental', required: true },
        { id: 'req-005', name: 'ITAR classification', instruction: 'Identify export control classification from compliance markings or distribution statements.', criterion: 'Must have a valid USML or CCL classification. Unclassified items require EAR99 or explicit ECCN.', format: 'text', category: 'compliance', required: true },
      ],
    },
    {
      id: 'rs-system-integration-v1',
      lineageId: 'lineage-rs-system-integration',
      version: 1,
      name: 'Sentinel-4 Integration Requirements',
      description: 'Verify component compatibility with the Sentinel-4 satellite bus — mechanical, electrical, and interface specifications.',
      context: 'Check compatibility with Sentinel-4 bus specifications: 3.3V logic, MIL-STD-1553B data bus, and SWaP constraints.',
      created: '2026-02-20',
      artifactUri: 'qs://govco/reqsets/sentinel4-integration.json',
      requirements: [
        { id: 'req-011', name: 'Logic interface voltage', instruction: 'Extract the I/O logic level voltage from the digital interface specifications.', criterion: 'Must be 3.3V LVCMOS compatible (2.97V-3.63V range).', format: 'value', category: 'electrical', required: true },
        { id: 'req-012', name: 'Package compatibility', instruction: 'Extract the IC package type and dimensions from the mechanical specifications.', criterion: 'Must be compatible with CQFP or CLCC surface-mount footprints per IPC-7351.', format: 'text', category: 'mechanical', required: true },
        { id: 'req-013', name: 'Power consumption', instruction: 'Extract the typical and maximum power consumption from the electrical characteristics.', criterion: 'Total power must not exceed 3W to stay within Sentinel-4 SWaP allocation.', format: 'value', category: 'electrical', required: true },
        { id: 'req-014', name: 'Data bus compatibility', instruction: 'Determine if the component supports MIL-STD-1553B or SpaceWire data bus interfaces.', criterion: 'Must support at least one of: MIL-STD-1553B, SpaceWire, or CAN bus.', format: 'text', category: 'electrical', required: false },
      ],
    },
  ],
  'actor-alice': [
    {
      id: 'rs-incoming-qc-v1',
      lineageId: 'lineage-rs-incoming-qc',
      version: 1,
      name: 'Incoming Quality Control',
      description: 'Standard incoming inspection for electronic components — visual, electrical, and dimensional verification.',
      context: 'Incoming inspection per MicroCo IQC-SOP-2025. Check component condition, lot traceability, and basic electrical function.',
      created: '2026-01-10',
      artifactUri: 'qs://microco/reqsets/incoming-qc.json',
      requirements: [
        { id: 'req-031', name: 'Visual inspection', instruction: 'Assess the component condition based on any photographic evidence, inspection notes, or receiving reports in the document.', criterion: 'No visible damage, corrosion, bent leads, or foreign material contamination.', format: 'boolean', category: 'mechanical', required: true },
        { id: 'req-032', name: 'Lot traceability', instruction: 'Extract the manufacturer lot number and date code from the packaging label or certificate of conformance.', criterion: 'Must have a valid, traceable lot number and date code within 24 months.', format: 'text', category: 'identification', required: true },
        { id: 'req-033', name: 'Electrical function test', instruction: 'Check for electrical test results or functional verification data in the documentation.', criterion: 'Component must pass standard functional test per manufacturer test specification.', format: 'boolean', category: 'electrical', required: true },
        { id: 'req-034', name: 'Certificate of conformance', instruction: 'Verify presence of a manufacturer certificate of conformance (C of C) or certificate of analysis (C of A).', criterion: 'A valid C of C or C of A must be present and reference the correct lot number.', format: 'boolean', category: 'compliance', required: true },
      ],
    },
    {
      id: 'rs-ipc-610-v1',
      lineageId: 'lineage-rs-ipc-610',
      version: 1,
      name: 'IPC-A-610 Workmanship',
      description: 'PCB assembly workmanship standards — solder joints, trace integrity, via quality, and component placement.',
      context: 'Evaluate against IPC-A-610 Class 3 (high reliability) criteria for PCB assemblies intended for defense applications.',
      created: '2026-02-01',
      artifactUri: 'qs://microco/reqsets/ipc-610-workmanship.json',
      requirements: [
        { id: 'req-041', name: 'Solder joint quality', instruction: 'Assess solder joint quality from inspection reports or X-ray imagery data referenced in the documentation.', criterion: 'All solder joints must meet IPC-A-610 Class 3 criteria. No cold joints, bridges, or insufficient wetting.', format: 'boolean', category: 'mechanical', required: true },
        { id: 'req-042', name: 'Trace width and spacing', instruction: 'Extract minimum trace width and spacing from the PCB design documentation or fab drawing.', criterion: 'Trace width and spacing must meet IPC-2221B Class 3 minimums for the voltage class.', format: 'value', category: 'electrical', required: true },
        { id: 'req-043', name: 'Via integrity', instruction: 'Check via reliability data from cross-section analysis, microsection reports, or thermal cycling test results.', criterion: 'Vias must pass IPC-TM-650 thermal stress test. No barrel cracking or separation.', format: 'boolean', category: 'mechanical', required: true },
        { id: 'req-044', name: 'Component placement accuracy', instruction: 'Check component placement data from AOI (automated optical inspection) reports or placement verification records.', criterion: 'All components placed within IPC-A-610 Class 3 alignment tolerances.', format: 'boolean', category: 'mechanical', required: true },
      ],
    },
  ],
}

export function getRequirementSetsForActor(actorId) {
  return REQUIREMENT_SETS[actorId] || []
}

export function generateMockEvalResults(reqSet) {
  const mockValues = {
    'Power output stability': '3.3V ±3% under 500mA load',
    'Thermal dissipation': '1.8W at rated current, 25°C ambient',
    'Operating temperature range': '-55°C to +125°C',
    'Radiation tolerance': 'TID > 100 krad(Si), SEL immune to 80 MeV·cm²/mg',
    'ITAR classification': 'Category XV, §121.1 — USML controlled',
    'Logic interface voltage': '3.3V LVCMOS, VOH=2.4V, VOL=0.4V',
    'Package compatibility': 'CQFP-44, 10×10mm body, 0.8mm pitch',
    'Power consumption': '2.1W typical, 2.8W maximum',
    'Data bus compatibility': 'MIL-STD-1553B dual redundant, SpaceWire 200Mbps',
    'Visual inspection': 'No defects noted in receiving inspection report',
    'Lot traceability': 'Lot 2025-11-4410, date code 2548',
    'Electrical function test': 'All parameters within datasheet limits per test report TR-2025-0891',
    'Certificate of conformance': 'C of C present, references lot 2025-11-4410, signed by QA manager',
    'Solder joint quality': 'X-ray inspection passed — no voids >25%, no bridges detected',
    'Trace width and spacing': '4mil trace / 4mil space minimum, exceeds Class 3 requirement',
    'Via integrity': 'Microsection analysis: barrel intact, no cracking after 6x reflow',
    'Component placement accuracy': 'AOI passed — all components within ±0.1mm of nominal',
  }

  const failSet = new Set(['Radiation tolerance', 'Via integrity'])
  const missingSet = new Set(['Data bus compatibility'])

  const confidence = (name) => {
    const low = ['Radiation tolerance', 'Data bus compatibility']
    const med = ['Component placement accuracy', 'Via integrity']
    if (low.includes(name)) return 0.72
    if (med.includes(name)) return 0.82
    return 0.88 + Math.random() * 0.10
  }

  return reqSet.requirements.map(r => ({
    id: r.id,
    name: r.name,
    instruction: r.instruction,
    criterion: r.criterion,
    category: r.category,
    format: r.format,
    required: r.required,
    extractedValue: mockValues[r.name] || `[assessed: ${r.name}]`,
    status: missingSet.has(r.name) ? 'missing' : failSet.has(r.name) ? 'unsat' : 'sat',
    confidence: parseFloat(confidence(r.name).toFixed(2)),
  }))
}
