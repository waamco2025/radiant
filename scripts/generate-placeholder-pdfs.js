// Phase 11B: generate placeholder PDFs for ChipCo's Assets so the
// AssetEvidenceViewer's iframe has something real to render.
//
// Run: `node scripts/generate-placeholder-pdfs.js`
//
// Writes 3 single-page PDFs to /public/. Each PDF carries the Asset's
// title + a brief filler description. Re-run safely; existing files are
// overwritten.
//
// The same script can be extended to backfill placeholder PDFs for any
// future Assets that need them — add to the `placeholders` array.

import PDFDocument from 'pdfkit'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')
mkdirSync(publicDir, { recursive: true })

const placeholders = [
  {
    filename: 'prm-3a-ic-datasheet.pdf',
    title: 'PRM-3A IC Datasheet',
    body: 'Buck-converter IC qualified for use in MicroCo\'s PRM-3A power regulation module. Operating voltage range 6V-36V; output 3.3V at 3A continuous; conversion efficiency at full load >= 92%; radiation tolerance TID > 75 krad(Si).\n\nThis is a placeholder document generated for prototype demo purposes. Real datasheets would carry full electrical, mechanical, and qualification information.',
  },
  {
    filename: 'prm-3a-ic-qualification-report.pdf',
    title: 'PRM-3A IC Qualification Report',
    body: 'Bench characterization and radiation qualification report for the PRM-3A IC. Includes thermal cycling (-55C to +125C), TID exposure to 75 krad(Si), and full electrical re-test post-environmental.\n\nThis is a placeholder document generated for prototype demo purposes. A real qualification report would include detailed test setups, raw data tables, statistical analyses, and test-article serialization.',
  },
  {
    filename: 'voltage-reference-ic-datasheet.pdf',
    title: 'Voltage Reference IC Datasheet',
    body: 'VREF-IC-220 precision voltage reference, +/-0.05% initial accuracy, 2 ppm/C temperature coefficient. SOT-23-5 package; 1.5 mA max supply current; output drives capacitive loads up to 100 nF without compensation.\n\nThis is a placeholder document generated for prototype demo purposes. Real datasheets would include full DC characteristics, AC parameters, and application circuits.',
  },
]

for (const p of placeholders) {
  const outPath = resolve(publicDir, p.filename)
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 72, bottom: 72, left: 72, right: 72 } })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  doc.on('end', () => {
    writeFileSync(outPath, Buffer.concat(chunks))
    const sizeKb = Math.round(Buffer.concat(chunks).length / 1024)
    console.log(`wrote ${outPath} (${sizeKb} KB)`)
  })

  // Title.
  doc.fontSize(20).font('Helvetica-Bold').text(p.title, { align: 'left' })
  doc.moveDown(0.5)
  // Subtitle line.
  doc.fontSize(10).font('Helvetica').fillColor('#666666').text('Placeholder document — generated for prototype demo')
  doc.moveDown(1)
  // Body.
  doc.fontSize(11).fillColor('#000000').text(p.body, { align: 'left', lineGap: 4 })

  doc.end()
}
