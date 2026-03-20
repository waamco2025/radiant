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
        { id: 'req-001', label: 'Power output stability', type: 'extraction', description: 'Rated output voltage and tolerance under load' },
        { id: 'req-002', label: 'Thermal dissipation', type: 'extraction', description: 'Maximum power dissipation at rated current' },
        { id: 'req-003', label: 'Operating temperature range', type: 'extraction', description: 'Minimum and maximum operating temperature' },
        { id: 'req-004', label: 'Radiation tolerance', type: 'extraction', description: 'Total ionizing dose tolerance level' },
        { id: 'req-005', label: 'ITAR classification', type: 'extraction', description: 'Export control classification under ITAR' },
        { id: 'req-006', label: 'Meets MIL-PRF-55681?', type: 'inference', description: 'Does the component meet all MIL-PRF-55681 requirements?' },
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
        { id: 'req-011', label: 'Package type', type: 'extraction', description: 'IC package form factor' },
        { id: 'req-012', label: 'Lead count', type: 'extraction', description: 'Number of electrical leads/pins' },
        { id: 'req-013', label: 'Interface voltage', type: 'extraction', description: 'Logic level voltage for I/O interfaces' },
        { id: 'req-014', label: 'Compatible with Sentinel-4 bus?', type: 'inference', description: 'Is the component compatible with the Sentinel-4 power and data bus?' },
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
        { id: 'req-021', label: 'Material composition', type: 'extraction', description: 'Primary materials used in construction' },
        { id: 'req-022', label: 'RoHS compliant?', type: 'inference', description: 'Does the component meet RoHS directive requirements?' },
        { id: 'req-023', label: 'REACH compliant?', type: 'inference', description: 'Does the component meet REACH regulation requirements?' },
        { id: 'req-024', label: 'Conflict mineral free?', type: 'inference', description: 'Are materials sourced from conflict-free origins?' },
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
        { id: 'req-031', label: 'Visual inspection passed?', type: 'inference', description: 'No visible damage, corrosion, or defects' },
        { id: 'req-032', label: 'Lot number', type: 'extraction', description: 'Manufacturer lot/batch number' },
        { id: 'req-033', label: 'Date code', type: 'extraction', description: 'Manufacturing date code' },
        { id: 'req-034', label: 'Electrical test passed?', type: 'inference', description: 'Component passes standard electrical functional test' },
      ],
    },
  ],
}

export function getRequirementSetsForRole(roleId) {
  return DEMO_REQUIREMENT_SETS[roleId] || []
}
