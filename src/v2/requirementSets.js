// Requirement types:
// 'extraction' — find a specific value (AI extracts, human confirms/edits)
// 'inference'  — determine if a condition holds (AI infers, human confirms yes/no)
//
// Phase 9A.1 item 9: every requirement carries `aiValue` + `aiConfidence` so
// a freshly-opened Run Evaluation modal shows believable AI extractions up
// front — no "AWAITING AI" state. Inference-type rows carry the AI's
// inferred verdict as an aiValue string ("Yes" / "No" / etc.).

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
        { id: 'req-001', label: 'Power output stability', type: 'extraction', description: 'Rated output voltage and tolerance under load', criterion: 'Must meet \u00b11% tolerance at rated current per MIL-PRF-55681 \u00a74.6.2', instruction: 'Verify voltage stability under full load conditions', required: true, aiValue: '3.3V \u00b10.5% under load', aiConfidence: 0.94 },
        { id: 'req-002', label: 'Thermal dissipation', type: 'extraction', description: 'Maximum power dissipation at rated current', criterion: 'Must not exceed 2W at rated current per \u00a74.6.4', instruction: 'Check thermal derating curve at max ambient', required: true, aiValue: '< 2W at rated current', aiConfidence: 0.91 },
        { id: 'req-003', label: 'Operating temperature range', type: 'extraction', description: 'Minimum and maximum operating temperature', criterion: 'Must operate across -55\u00b0C to +125\u00b0C per MIL-STD-883', instruction: 'Verify against environmental test data', required: true, aiValue: '-55\u00b0C to +125\u00b0C', aiConfidence: 0.97 },
        { id: 'req-004', label: 'Radiation tolerance', type: 'extraction', description: 'Total ionizing dose tolerance level', criterion: 'TID must exceed 100 krad(Si) per MIL-STD-883 TM 1019', instruction: 'Reference radiation test report or wafer lot data', required: true, aiValue: 'TID > 100 krad(Si)', aiConfidence: 0.88 },
        { id: 'req-005', label: 'ITAR classification', type: 'extraction', description: 'Export control classification under ITAR', criterion: 'Must have valid ITAR classification with category and section reference', instruction: 'Extract from export compliance documentation', required: true, aiValue: 'USML Category XV (c)', aiConfidence: 0.86 },
        { id: 'req-006', label: 'Meets MIL-PRF-55681?', type: 'inference', description: 'Does the component meet all MIL-PRF-55681 requirements?', criterion: 'All quantitative thresholds in \u00a74.6 must be satisfied', instruction: 'Assess overall compliance based on extracted values', required: false, aiValue: 'Yes \u2014 4 of 5 quantitative thresholds satisfied; radiation tolerance above threshold', aiConfidence: 0.82 },
      ],
    },
    // Phase 12.1 (#120): v2 of MIL-PRF-55681 to seed the supersession
    // surfacing flow. Adds an EMI/EMC requirement on top of v1's six rows
    // \u2014 when a Claim references v1, the Detail Panel's
    // "Newer version available" pill points readers at this v2 entry.
    {
      id: 'reqset-mil-prf-55681-v2',
      lineageId: 'lineage-mil-prf-55681',
      version: 2,
      name: 'MIL-PRF-55681 Compliance',
      description: 'Military specification for electronic component qualification \u2014 power, thermal, radiation, EMI, and export compliance. v2 adds EMI/EMC requirement.',
      created: '2026-04-12',
      requirements: [
        { id: 'req-001', label: 'Power output stability', type: 'extraction', description: 'Rated output voltage and tolerance under load', criterion: 'Must meet \u00b11% tolerance at rated current per MIL-PRF-55681 \u00a74.6.2', instruction: 'Verify voltage stability under full load conditions', required: true, aiValue: '3.3V \u00b10.5% under load', aiConfidence: 0.94 },
        { id: 'req-002', label: 'Thermal dissipation', type: 'extraction', description: 'Maximum power dissipation at rated current', criterion: 'Must not exceed 2W at rated current per \u00a74.6.4', instruction: 'Check thermal derating curve at max ambient', required: true, aiValue: '< 2W at rated current', aiConfidence: 0.91 },
        { id: 'req-003', label: 'Operating temperature range', type: 'extraction', description: 'Minimum and maximum operating temperature', criterion: 'Must operate across -55\u00b0C to +125\u00b0C per MIL-STD-883', instruction: 'Verify against environmental test data', required: true, aiValue: '-55\u00b0C to +125\u00b0C', aiConfidence: 0.97 },
        { id: 'req-004', label: 'Radiation tolerance', type: 'extraction', description: 'Total ionizing dose tolerance level', criterion: 'TID must exceed 100 krad(Si) per MIL-STD-883 TM 1019', instruction: 'Reference radiation test report or wafer lot data', required: true, aiValue: 'TID > 100 krad(Si)', aiConfidence: 0.88 },
        { id: 'req-005', label: 'ITAR classification', type: 'extraction', description: 'Export control classification under ITAR', criterion: 'Must have valid ITAR classification with category and section reference', instruction: 'Extract from export compliance documentation', required: true, aiValue: 'USML Category XV (c)', aiConfidence: 0.86 },
        { id: 'req-007', label: 'EMI/EMC compliance', type: 'extraction', description: 'Conducted and radiated emissions compliance', criterion: 'Must meet MIL-STD-461 limits for conducted (CE102) and radiated (RE102) emissions', instruction: 'Reference EMI/EMC test report or pre-compliance scan', required: true, aiValue: 'CE102 / RE102 within MIL-STD-461 limits', aiConfidence: 0.81 },
        { id: 'req-006', label: 'Meets MIL-PRF-55681?', type: 'inference', description: 'Does the component meet all MIL-PRF-55681 requirements (including v2 EMI scope)?', criterion: 'All quantitative thresholds in \u00a74.6 plus EMI/EMC compliance must be satisfied', instruction: 'Assess overall compliance based on extracted values', required: false, aiValue: 'Yes \u2014 5 of 6 quantitative thresholds satisfied; EMI/EMC within limits', aiConfidence: 0.80 },
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
        { id: 'req-011', label: 'Package type', type: 'extraction', description: 'IC package form factor', criterion: 'Must be compatible with Sentinel-4 PCB footprint library', instruction: 'Extract package designation from mechanical drawing', required: true, aiValue: 'CQFP-128 (ceramic quad flat pack)', aiConfidence: 0.93 },
        { id: 'req-012', label: 'Lead count', type: 'extraction', description: 'Number of electrical leads/pins', criterion: 'Must match allocated connector pin count', instruction: 'Count pins from pinout diagram', required: true, aiValue: '128 pins', aiConfidence: 0.99 },
        { id: 'req-013', label: 'Interface voltage', type: 'extraction', description: 'Logic level voltage for I/O interfaces', criterion: 'Must be 3.3V LVCMOS compatible', instruction: 'Extract from electrical characteristics table', required: true, aiValue: '3.3V LVCMOS', aiConfidence: 0.95 },
        { id: 'req-014', label: 'Compatible with Sentinel-4 bus?', type: 'inference', description: 'Is the component compatible with the Sentinel-4 power and data bus?', criterion: 'Power and data interfaces must match Sentinel-4 ICD rev. C', instruction: 'Cross-reference against bus specification', required: false, aiValue: 'Yes \u2014 logic level and package footprint match Sentinel-4 ICD rev. C', aiConfidence: 0.79 },
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
        { id: 'req-021', label: 'Material composition', type: 'extraction', description: 'Primary materials used in construction', criterion: 'All materials must be identified and traceable', instruction: 'Extract from bill of materials or material declaration', required: true, aiValue: 'Ceramic (Al\u2082O\u2083) body; Kovar leads; Au/Sn solder', aiConfidence: 0.84 },
        { id: 'req-022', label: 'RoHS compliant?', type: 'inference', description: 'Does the component meet RoHS directive requirements?', criterion: 'Must comply with EU RoHS Directive 2011/65/EU', instruction: 'Check compliance certificate or material declaration', required: true, aiValue: 'Yes \u2014 datasheet cites EU RoHS Directive 2011/65/EU compliance', aiConfidence: 0.92 },
        { id: 'req-023', label: 'REACH compliant?', type: 'inference', description: 'Does the component meet REACH regulation requirements?', criterion: 'No SVHC above 0.1% w/w per REACH Article 33', instruction: 'Check REACH compliance statement', required: true, aiValue: 'Yes \u2014 REACH statement on file; no SVHC above 0.1% w/w', aiConfidence: 0.90 },
        { id: 'req-024', label: 'Conflict mineral free?', type: 'inference', description: 'Are materials sourced from conflict-free origins?', criterion: 'Must provide CMRT or equivalent conflict mineral report', instruction: 'Review conflict minerals reporting template', required: false, aiValue: 'Yes \u2014 CMRT on file dated 2026-01-12', aiConfidence: 0.77 },
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
        { id: 'req-031', label: 'Visual inspection passed?', type: 'inference', description: 'No visible damage, corrosion, or defects', criterion: 'No cracks, chips, bent leads, or discoloration per IPC-A-610', instruction: 'Perform visual inspection under 10x magnification', required: true, aiValue: 'Yes \u2014 no visible defects noted on incoming inspection report', aiConfidence: 0.88 },
        { id: 'req-032', label: 'Lot number', type: 'extraction', description: 'Manufacturer lot/batch number', criterion: 'Must be traceable to manufacturer COC', instruction: 'Read from component marking or packaging label', required: true, aiValue: 'LOT-2026-PRM3A-0047', aiConfidence: 0.96 },
        { id: 'req-033', label: 'Date code', type: 'extraction', description: 'Manufacturing date code', criterion: 'Must be within 24 months of receipt date', instruction: 'Read from component marking', required: true, aiValue: '2604 (Q1 2026)', aiConfidence: 0.93 },
        { id: 'req-034', label: 'Electrical test passed?', type: 'inference', description: 'Component passes standard electrical functional test', criterion: 'All parameters within datasheet limits at 25\u00b0C', instruction: 'Reference incoming electrical test report', required: false, aiValue: 'Yes \u2014 all parameters within datasheet limits at 25\u00b0C', aiConfidence: 0.85 },
      ],
    },
  ],
}

export function getRequirementSetsForRole(roleId) {
  return DEMO_REQUIREMENT_SETS[roleId] || []
}

// Phase 12.1 (#120): seed entries for `publishedRequirementSets` so the
// "Public" picker tab in CreateClaim / AmendClaim and the Phase 12.1
// "Public" provenance badge are populated on first load — without
// requiring a user to manually publish via the Library first.
//
// Each entry mirrors the runtime publish-record shape produced by
// V2App.handlePublishRequirementSet (`_publishedBy` party label,
// `_publishedByRoleId` role id, `_publishedDate` YYYY-MM-DD). Both v1
// and v2 of MIL-PRF-55681 are seeded so the supersession chain is
// fully exercised cross-role: when Alice references v1 (via the seed
// data below), the Detail Panel correctly surfaces "Newer version
// available" because v2 also lives in this pool.
export const SEED_PUBLISHED_REQUIREMENT_SETS = [
  {
    ...DEMO_REQUIREMENT_SETS['bob-govco'][0],   // MIL-PRF-55681 v1
    _published: true,
    _publishedBy: 'GovCo',
    _publishedByRoleId: 'bob-govco',
    _publishedDate: '2026-02-16',
  },
  {
    ...DEMO_REQUIREMENT_SETS['bob-govco'][1],   // MIL-PRF-55681 v2
    _published: true,
    _publishedBy: 'GovCo',
    _publishedByRoleId: 'bob-govco',
    _publishedDate: '2026-04-13',
  },
  {
    ...DEMO_REQUIREMENT_SETS['bob-govco'][2],   // System Integration v1
    _published: true,
    _publishedBy: 'GovCo',
    _publishedByRoleId: 'bob-govco',
    _publishedDate: '2026-02-22',
  },
]
