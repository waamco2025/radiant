// Requirement types:
// 'extraction' — find a specific value (AI extracts, human confirms/edits)
// 'inference'  — determine if a condition holds (AI infers, human confirms yes/no)

export const DEMO_REQUIREMENT_SETS = {
  'bob-govco': [
    {
      id: 'reqset-mil-prf-55681-v1',
      lineageId: 'lineage-mil-prf-55681',
      version: 1,
      name: 'MIL-PRF-55681 Compliance',
      description: 'Military specification for electronic component qualification — power, thermal, radiation, and export compliance.',
      created: '2026-02-15',
      requirements: [
        { id: 'req-001', label: 'Power output stability', type: 'extraction', description: 'Rated output voltage and tolerance under load', criterion: 'Must meet \u00b11% tolerance at rated current per MIL-PRF-55681 \u00a74.6.2', instruction: 'Verify voltage stability under full load conditions', required: true },
        { id: 'req-002', label: 'Thermal dissipation', type: 'extraction', description: 'Maximum power dissipation at rated current', criterion: 'Must not exceed 2W at rated current per \u00a74.6.4', instruction: 'Check thermal derating curve at max ambient', required: true },
        { id: 'req-003', label: 'Operating temperature range', type: 'extraction', description: 'Minimum and maximum operating temperature', criterion: 'Must operate across -55\u00b0C to +125\u00b0C per MIL-STD-883', instruction: 'Verify against environmental test data', required: true },
        { id: 'req-004', label: 'Radiation tolerance', type: 'extraction', description: 'Total ionizing dose tolerance level', criterion: 'TID must exceed 100 krad(Si) per MIL-STD-883 TM 1019', instruction: 'Reference radiation test report or wafer lot data', required: true },
        { id: 'req-005', label: 'ITAR classification', type: 'extraction', description: 'Export control classification under ITAR', criterion: 'Must have valid ITAR classification with category and section reference', instruction: 'Extract from export compliance documentation', required: true },
        { id: 'req-006', label: 'Meets MIL-PRF-55681?', type: 'inference', description: 'Does the component meet all MIL-PRF-55681 requirements?', criterion: 'All quantitative thresholds in \u00a74.6 must be satisfied', instruction: 'Assess overall compliance based on extracted values', required: false },
      ],
    },
    {
      id: 'reqset-system-integration-v1',
      lineageId: 'lineage-system-integration',
      version: 1,
      name: 'System Integration Requirements',
      description: 'Verify component compatibility with the Sentinel-4 satellite bus — mechanical, electrical, and interface specs.',
      created: '2026-02-20',
      requirements: [
        { id: 'req-011', label: 'Package type', type: 'extraction', description: 'IC package form factor', criterion: 'Must be compatible with Sentinel-4 PCB footprint library', instruction: 'Extract package designation from mechanical drawing', required: true },
        { id: 'req-012', label: 'Lead count', type: 'extraction', description: 'Number of electrical leads/pins', criterion: 'Must match allocated connector pin count', instruction: 'Count pins from pinout diagram', required: true },
        { id: 'req-013', label: 'Interface voltage', type: 'extraction', description: 'Logic level voltage for I/O interfaces', criterion: 'Must be 3.3V LVCMOS compatible', instruction: 'Extract from electrical characteristics table', required: true },
        { id: 'req-014', label: 'Compatible with Sentinel-4 bus?', type: 'inference', description: 'Is the component compatible with the Sentinel-4 power and data bus?', criterion: 'Power and data interfaces must match Sentinel-4 ICD rev. C', instruction: 'Cross-reference against bus specification', required: false },
      ],
    },
    {
      id: 'reqset-material-compliance-v1',
      lineageId: 'lineage-material-compliance',
      version: 1,
      name: 'Material Compliance',
      description: 'Material composition and environmental compliance checks — RoHS, REACH, conflict minerals.',
      created: '2026-03-01',
      requirements: [
        { id: 'req-021', label: 'Material composition', type: 'extraction', description: 'Primary materials used in construction', criterion: 'All materials must be identified and traceable', instruction: 'Extract from bill of materials or material declaration', required: true },
        { id: 'req-022', label: 'RoHS compliant?', type: 'inference', description: 'Does the component meet RoHS directive requirements?', criterion: 'Must comply with EU RoHS Directive 2011/65/EU', instruction: 'Check compliance certificate or material declaration', required: true },
        { id: 'req-023', label: 'REACH compliant?', type: 'inference', description: 'Does the component meet REACH regulation requirements?', criterion: 'No SVHC above 0.1% w/w per REACH Article 33', instruction: 'Check REACH compliance statement', required: true },
        { id: 'req-024', label: 'Conflict mineral free?', type: 'inference', description: 'Are materials sourced from conflict-free origins?', criterion: 'Must provide CMRT or equivalent conflict mineral report', instruction: 'Review conflict minerals reporting template', required: false },
      ],
    },
  ],
  'alice-microco': [
    {
      id: 'reqset-incoming-qc-v1',
      lineageId: 'lineage-incoming-qc',
      version: 1,
      name: 'Incoming Quality Control',
      description: 'Standard incoming inspection for electronic components — visual, electrical, and dimensional checks.',
      created: '2026-01-10',
      requirements: [
        { id: 'req-031', label: 'Visual inspection passed?', type: 'inference', description: 'No visible damage, corrosion, or defects', criterion: 'No cracks, chips, bent leads, or discoloration per IPC-A-610', instruction: 'Perform visual inspection under 10x magnification', required: true },
        { id: 'req-032', label: 'Lot number', type: 'extraction', description: 'Manufacturer lot/batch number', criterion: 'Must be traceable to manufacturer COC', instruction: 'Read from component marking or packaging label', required: true },
        { id: 'req-033', label: 'Date code', type: 'extraction', description: 'Manufacturing date code', criterion: 'Must be within 24 months of receipt date', instruction: 'Read from component marking', required: true },
        { id: 'req-034', label: 'Electrical test passed?', type: 'inference', description: 'Component passes standard electrical functional test', criterion: 'All parameters within datasheet limits at 25\u00b0C', instruction: 'Reference incoming electrical test report', required: false },
      ],
    },
  ],
}

export function getRequirementSetsForRole(roleId) {
  return DEMO_REQUIREMENT_SETS[roleId] || []
}
