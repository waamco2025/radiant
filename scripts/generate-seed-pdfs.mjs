// Phase 15.0 (#172 part 1): generate the seed PDFs for the evaluation
// flow's annotated evidence overlay. This script is the single source of
// truth for both:
//   1. The PDF bytes (committed under public/seed-pdfs/).
//   2. The anchor coordinates referenced by Eval Result `evidenceAnchors[]`
//      entries in the seed data (committed as src/v2/data/evidenceAnchors.js).
//
// Determinism: every text draw that's also an anchor target is rendered at
// known (x, y) coordinates derived from a flowing layout, and the same
// (x, y) is captured as an anchor entry. Re-running the script produces
// PDFs with the same text in the same positions; the anchor map is
// regenerated alongside so seed and PDFs never drift.
//
// Run: `node scripts/generate-seed-pdfs.mjs`
//
// Output:
//   - public/seed-pdfs/microco-prm-datasheet.pdf
//   - public/seed-pdfs/microco-prm-test-report.pdf
//   - public/seed-pdfs/microco-vreg-datasheet.pdf
//   - src/v2/data/evidenceAnchors.js  (generated; do not hand-edit)

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = resolve(__dirname, '..', 'public', 'seed-pdfs')
const SEED_DATA_DIR = resolve(__dirname, '..', 'src', 'v2', 'data')
mkdirSync(PUBLIC_DIR, { recursive: true })
mkdirSync(SEED_DATA_DIR, { recursive: true })

// US Letter, PDF points (1 pt = 1/72 inch).
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 50
const TOP = PAGE_H - MARGIN
const BOTTOM = MARGIN

// Owner accent colors (mirrors CSS --accent-* palette).
const COLOR_MICROCO = rgb(0.133, 0.773, 0.369)  // accent-green
const COLOR_GOVCO   = rgb(0.961, 0.620, 0.043)  // accent-amber
const COLOR_AUDITCO = rgb(0.506, 0.549, 0.973)  // accent-indigo
const COLOR_CHIPCO  = rgb(0.231, 0.510, 0.965)  // accent-blue
const COLOR_INK = rgb(0.07, 0.07, 0.10)
const COLOR_DIM = rgb(0.40, 0.40, 0.45)
const COLOR_BG_BANNER = rgb(0.96, 0.97, 0.99)

const FIXED_DATE = new Date('2026-03-08T12:00:00Z')

// Anchor accumulator. One entry per `(file, requirementId)` pair. PDF.js
// `convertToViewportRectangle([x, y, x+w, y+h])` consumes these directly.
// Storage shape: { [filename]: { [requirementId]: { page, x, y, w, h } } }
const anchorMap = {}

function recordAnchor(filename, requirementId, anchor) {
  if (!anchorMap[filename]) anchorMap[filename] = {}
  // Round to integer points — PDF.js handles fractional coords fine, but
  // integer values keep the generated seed file readable.
  anchorMap[filename][requirementId] = {
    page: anchor.page,
    x: Math.round(anchor.x * 10) / 10,
    y: Math.round(anchor.y * 10) / 10,
    w: Math.round(anchor.w * 10) / 10,
    h: Math.round(anchor.h * 10) / 10,
  }
}

// ─── Layout primitives ──────────────────────────────────────────────────

async function startDoc({ ownerParty }) {
  const doc = await PDFDocument.create({ updateMetadata: false })
  doc.setCreationDate(FIXED_DATE)
  doc.setModificationDate(FIXED_DATE)
  doc.setProducer('Radiant Phase 15')
  doc.setCreator('Radiant')
  doc.setAuthor(ownerParty)
  return doc
}

function newPage(doc) {
  const page = doc.addPage([PAGE_W, PAGE_H])
  return page
}

function drawHeader(page, fonts, { ownerParty, accentColor, docType, revision, generated }) {
  // Owner color band along the top edge.
  page.drawRectangle({
    x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6,
    color: accentColor,
  })
  // Header text block.
  page.drawText(ownerParty.toUpperCase(), {
    x: MARGIN, y: PAGE_H - 32,
    size: 11, font: fonts.bold, color: accentColor,
  })
  page.drawText(docType, {
    x: MARGIN, y: PAGE_H - 50,
    size: 16, font: fonts.bold, color: COLOR_INK,
  })
  page.drawText(`${revision}  ·  Generated ${generated}`, {
    x: MARGIN, y: PAGE_H - 65,
    size: 9, font: fonts.regular, color: COLOR_DIM,
  })
  // Thin rule below header.
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - 80 },
    end:   { x: PAGE_W - MARGIN, y: PAGE_H - 80 },
    thickness: 0.5, color: COLOR_DIM,
  })
}

function drawFooter(page, fonts, { pageNum, totalPages, ownerParty }) {
  page.drawLine({
    start: { x: MARGIN, y: BOTTOM + 30 },
    end:   { x: PAGE_W - MARGIN, y: BOTTOM + 30 },
    thickness: 0.5, color: COLOR_DIM,
  })
  page.drawText(`${ownerParty} · Confidential demo content`, {
    x: MARGIN, y: BOTTOM + 18,
    size: 8, font: fonts.regular, color: COLOR_DIM,
  })
  page.drawText(`Page ${pageNum} of ${totalPages}`, {
    x: PAGE_W - MARGIN - 60, y: BOTTOM + 18,
    size: 8, font: fonts.regular, color: COLOR_DIM,
  })
}

function drawSectionHeading(page, fonts, { x, y, text }) {
  page.drawText(text, { x, y, size: 12, font: fonts.bold, color: COLOR_INK })
  // Subtle underline.
  const w = fonts.bold.widthOfTextAtSize(text, 12)
  page.drawLine({
    start: { x, y: y - 3 }, end: { x: x + w, y: y - 3 },
    thickness: 0.4, color: COLOR_DIM,
  })
}

// Draw a single "Label: Value" row. Returns the anchor box around the
// VALUE text (PDF point coords, bottom-left origin), so callers can stamp
// an anchor entry. Caller passes pageNum so the anchor records page index.
function drawSpecRow(page, fonts, { x, y, label, value, pageNum }) {
  const labelSize = 10
  const valueSize = 11
  const labelText = `${label}:`
  const labelW = fonts.regular.widthOfTextAtSize(labelText, labelSize)
  // Two-column layout: label column ~220pt; value column starts at x + 230.
  const VALUE_X = x + 230
  page.drawText(labelText, {
    x, y, size: labelSize, font: fonts.regular, color: COLOR_DIM,
  })
  page.drawText(value, {
    x: VALUE_X, y, size: valueSize, font: fonts.bold, color: COLOR_INK,
  })
  // Anchor box wraps the value text. PDF text baseline sits at y; the
  // visual cap-height extends up by ~size (Helvetica). Pad a couple pt
  // below the baseline for descenders.
  const valueW = fonts.bold.widthOfTextAtSize(value, valueSize)
  return {
    page: pageNum,
    x: VALUE_X - 2,
    y: y - 2,
    w: valueW + 4,
    h: valueSize + 4,
  }
}

function drawParagraph(page, fonts, { x, y, w, text, size = 10, color = COLOR_INK }) {
  // Word wrap to width w.
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word
    if (fonts.regular.widthOfTextAtSize(trial, size) > w) {
      if (cur) lines.push(cur)
      cur = word
    } else {
      cur = trial
    }
  }
  if (cur) lines.push(cur)
  const lineHeight = size * 1.4
  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], {
      x, y: y - i * lineHeight, size, font: fonts.regular, color,
    })
  }
  return y - lines.length * lineHeight
}

// ─── PDF specs ──────────────────────────────────────────────────────────
// Each spec lists `rows[]` = [{ requirementId, label, value }, ...]. The
// generator places rows in the order given, captures anchors keyed by
// requirementId, and stamps owner metadata on the page header.

const PDF_SPECS = [
  {
    filename: 'microco-prm-datasheet.pdf',
    ownerParty: 'MicroCo',
    accentColor: COLOR_MICROCO,
    docType: 'PRM-3A · Power Regulation Module · Datasheet',
    revision: 'Rev 2.4',
    generated: '2026-03-08',
    description: 'Primary specification document for MicroCo\'s PRM-3A Power Regulation Module. Issued for design integration into Sentinel-4 mission avionics.',
    pages: [
      {
        title: 'Specifications',
        intro: 'Electrical and environmental performance specifications for the PRM-3A under the documented operating envelope. All values quoted at nominal supply unless otherwise indicated.',
        sections: [
          {
            heading: 'Electrical Performance',
            rows: [
              { requirementId: 'req-001', label: 'Power output stability', value: '3.3V ±0.5% under load' },
              { requirementId: 'req-013', label: 'Interface voltage', value: '3.3V LVCMOS' },
            ],
          },
          {
            heading: 'Mechanical / Packaging',
            rows: [
              { requirementId: 'req-011', label: 'Package type', value: 'CQFP-128 (ceramic quad flat pack)' },
              { requirementId: 'req-012', label: 'Lead count', value: '128 pins' },
            ],
          },
          {
            heading: 'Environmental',
            rows: [
              { requirementId: 'req-003', label: 'Operating temperature range', value: '-55°C to +125°C' },
            ],
          },
        ],
      },
      {
        title: 'Compliance & System Integration',
        intro: 'Regulatory classification and integration parameters required for incorporation into hosted-payload systems.',
        sections: [
          {
            heading: 'Regulatory & Export',
            rows: [
              { requirementId: 'req-005', label: 'ITAR classification', value: 'Category XV, §121.1' },
            ],
          },
          {
            heading: 'System Integration',
            rows: [
              { requirementId: 'req-014', label: 'Compatible with Sentinel-4 bus', value: 'Yes (verified per SI-4-IF-12)' },
            ],
          },
        ],
      },
    ],
  },
  {
    filename: 'microco-prm-test-report.pdf',
    ownerParty: 'MicroCo',
    accentColor: COLOR_MICROCO,
    docType: 'PRM-3A · Compliance Test Report',
    revision: 'Rev 1.0',
    generated: '2026-03-08',
    description: 'Bench-measured performance and qualification results for the PRM-3A. Test articles: PRM-3A serial numbers 0142 through 0148 (n=7). All tests performed under ambient lab conditions unless otherwise noted.',
    pages: [
      {
        title: 'Thermal & Power Performance',
        intro: 'Steady-state thermal and power-loss measurements taken at the rated operating point. Results expressed as the worst-case across the test cohort.',
        sections: [
          {
            heading: 'Thermal Performance',
            rows: [
              { requirementId: 'req-002', label: 'Thermal dissipation (rated load)', value: '< 2W at rated current' },
            ],
          },
        ],
      },
      {
        title: 'Radiation Qualification',
        intro: 'Total Ionizing Dose (TID) qualification was conducted per MIL-STD-883 Method 1019. Test articles were exposed in cumulative steps with electrical re-test between exposures.',
        sections: [
          {
            heading: 'TID Results',
            rows: [
              { requirementId: 'req-004', label: 'Radiation tolerance (TID)', value: 'TID > 100 krad(Si)' },
            ],
          },
        ],
      },
    ],
  },
  {
    filename: 'microco-vreg-datasheet.pdf',
    ownerParty: 'MicroCo',
    accentColor: COLOR_MICROCO,
    docType: 'VReg-12C · Voltage Regulator IC · Datasheet',
    revision: 'Rev 1.2',
    generated: '2026-02-15',
    description: 'Primary specification document for MicroCo\'s VReg-12C Voltage Regulator IC. Linear regulator targeted at avionics power-rail conditioning.',
    pages: [
      {
        title: 'Specifications',
        intro: 'Electrical and environmental performance for the VReg-12C under the documented operating envelope.',
        sections: [
          {
            heading: 'Electrical Performance',
            rows: [
              { requirementId: 'req-001', label: 'Power output stability', value: '5.0V ±0.5% under load' },
              { requirementId: 'req-002', label: 'Thermal dissipation (rated load)', value: '< 1.7W at rated current' },
            ],
          },
          {
            heading: 'Environmental',
            rows: [
              { requirementId: 'req-003', label: 'Operating temperature range', value: '-55°C to +125°C' },
            ],
          },
        ],
      },
      {
        title: 'Compliance & Qualification',
        intro: 'Regulatory classification and qualification status for incorporation into mission-class systems.',
        sections: [
          {
            heading: 'Regulatory & Export',
            rows: [
              { requirementId: 'req-005', label: 'ITAR classification', value: 'Category XV, §121.1' },
            ],
          },
          {
            heading: 'Radiation Qualification',
            rows: [
              { requirementId: 'req-004', label: 'Radiation tolerance (TID)', value: 'TID ~ 80 krad(Si)' },
            ],
          },
        ],
      },
    ],
  },
]

// ─── Generator ──────────────────────────────────────────────────────────

async function generatePdf(spec) {
  const doc = await startDoc({ ownerParty: spec.ownerParty })
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold:    await doc.embedFont(StandardFonts.HelveticaBold),
  }

  const totalPages = spec.pages.length
  spec.pages.forEach((pageSpec, pageIdx) => {
    const pageNum = pageIdx + 1
    const page = newPage(doc)
    drawHeader(page, fonts, {
      ownerParty: spec.ownerParty,
      accentColor: spec.accentColor,
      docType: spec.docType,
      revision: spec.revision,
      generated: spec.generated,
    })
    drawFooter(page, fonts, {
      pageNum,
      totalPages,
      ownerParty: spec.ownerParty,
    })

    // Body cursor starts below the header rule.
    let y = TOP - HEADER_OFFSET

    // Page-title banner.
    page.drawRectangle({
      x: MARGIN, y: y - 22, width: PAGE_W - MARGIN * 2, height: 22,
      color: COLOR_BG_BANNER,
    })
    page.drawText(pageSpec.title, {
      x: MARGIN + 10, y: y - 16,
      size: 13, font: fonts.bold, color: COLOR_INK,
    })
    y -= 38

    // Intro paragraph.
    if (pageSpec.intro) {
      y = drawParagraph(page, fonts, {
        x: MARGIN, y, w: PAGE_W - MARGIN * 2,
        text: pageSpec.intro, size: 10, color: COLOR_DIM,
      })
      y -= 18
    }

    // Sections.
    for (const section of pageSpec.sections) {
      drawSectionHeading(page, fonts, { x: MARGIN, y, text: section.heading })
      y -= 22
      for (const row of section.rows) {
        const anchor = drawSpecRow(page, fonts, {
          x: MARGIN, y, label: row.label, value: row.value, pageNum,
        })
        recordAnchor(spec.filename, row.requirementId, anchor)
        y -= 22
      }
      y -= 12  // gap between sections
    }
  })

  return await doc.save({ updateFieldAppearances: false })
}

const HEADER_OFFSET = 95  // distance from page top to body start

// ─── Run ────────────────────────────────────────────────────────────────

async function main() {
  const summary = []
  for (const spec of PDF_SPECS) {
    const bytes = await generatePdf(spec)
    const out = resolve(PUBLIC_DIR, spec.filename)
    writeFileSync(out, bytes)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    summary.push({
      filename: spec.filename,
      ownerParty: spec.ownerParty,
      pages: spec.pages.length,
      bytes: bytes.length,
      sha256: `sha256:${sha256.slice(0, 16)}`,
    })
    console.log(`  wrote ${spec.filename}  (${bytes.length} bytes, ${spec.pages.length} pages, sha256:${sha256.slice(0, 16)})`)
  }

  // Emit the seed file consumed by v2_2Data.js. Includes both the anchor
  // map and the generated-file metadata so the seed can synchronize Asset
  // file metadata in lockstep.
  const seedBody =
    '// Generated by scripts/generate-seed-pdfs.mjs — do not hand-edit.\n' +
    '// Phase 15.0 (#172 part 1). Regenerate via `node scripts/generate-seed-pdfs.mjs`.\n' +
    '\n' +
    '// PDF anchor coordinates per requirement, indexed by generated PDF\n' +
    '// filename. Coordinates are PDF points (origin bottom-left). Consumed\n' +
    '// by Eval Result `evidenceAnchors[]` entries.\n' +
    'export const PDF_ANCHORS = ' + JSON.stringify(anchorMap, null, 2) + '\n' +
    '\n' +
    '// Generated-file metadata. Used by Asset seed entries that point at\n' +
    '// these PDFs for `file.size` + `file.hash` parity.\n' +
    'export const PDF_FILES = ' + JSON.stringify(
      Object.fromEntries(summary.map(s => [s.filename, {
        size: s.bytes,
        hash: s.sha256,
        ownerParty: s.ownerParty,
        pages: s.pages,
      }])),
      null, 2,
    ) + '\n'
  const seedPath = resolve(SEED_DATA_DIR, 'evidenceAnchors.js')
  writeFileSync(seedPath, seedBody)
  console.log(`\n  wrote ${seedPath.replace(process.cwd() + '/', '')}\n`)

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
