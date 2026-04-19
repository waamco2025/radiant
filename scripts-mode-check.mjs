// Verify which mode V2App renders by inspecting the rendered DOM for the V2.2
// banner. Tests both flag values explicitly.
import { JSDOM } from 'jsdom'
import esbuild from 'esbuild'
import path from 'path'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.localStorage = dom.window.localStorage
globalThis.sessionStorage = dom.window.sessionStorage
globalThis.WebGLRenderingContext = class {}
HTMLCanvasElement.prototype.getContext = function () { return null }

const repoRoot = '/Users/andrewmackenzie/Desktop/radiant-ui'
process.env.NODE_ENV = 'development'
const out = await esbuild.build({
  entryPoints: [path.join(repoRoot, 'src/v2/main.jsx')],
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  define: {
    'import.meta.env.VITE_V2_2_ENABLED': JSON.stringify(process.env.V22 || 'false'),
    'process.env.NODE_ENV': '"development"',
  },
  external: [], logLevel: 'silent',
  plugins: [{
    name: 'stub-css', setup(b) {
      b.onResolve({ filter: /\.css$/ }, () => ({ path: 'stub', namespace: 'stub-css' }))
      b.onLoad({ filter: /.*/, namespace: 'stub-css' }, () => ({ contents: '', loader: 'js' }))
    },
  }],
})
const blobUrl = 'data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64')
process.on('uncaughtException', () => {})
process.on('unhandledRejection', () => {})
await import(blobUrl)
await new Promise(r => setTimeout(r, 800))

// Bypass boot screen if it's in the way: simulate dismiss
const bannerEl = [...document.querySelectorAll('span')].find(el =>
  el.textContent && el.textContent.includes('V2.2 mode active')
)
const v22BootClass = document.querySelector('[role="status"]')
const root = document.getElementById('root')
const bodyHtml = root?.innerHTML || ''
const hasBanner = bodyHtml.includes('V2.2 mode active')
const hasBoot = bodyHtml.includes('CAC') || bodyHtml.includes('Prime Radiant') || bodyHtml.includes('Authenticate')

console.log(`Mode requested: V22=${process.env.V22 || 'false'}`)
console.log(`Banner rendered: ${hasBanner}`)
console.log(`Boot screen rendered: ${hasBoot}`)
console.log(`Root HTML length: ${bodyHtml.length}`)
