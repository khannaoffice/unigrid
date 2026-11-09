import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { vendorModuleKey } from './react-vendor-policy.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', ...options })
}

function check(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
    throw new Error(message)
  }
  console.log(`ok: ${message}`)
}

const reactVersion = process.env.REACT_VERSION
  || JSON.parse(await readFile(join(repoRoot, 'node_modules', 'react', 'package.json'), 'utf8')).version
const typesMajor = reactVersion.split('.')[0]

const workDir = await mkdtemp(join(tmpdir(), 'unigrid-consumer-'))
console.log(`consumer workspace: ${workDir} (React ${reactVersion})`)
const packOutput = run(npm, ['pack', '--json', '--pack-destination', workDir], { cwd: repoRoot })
const packed = JSON.parse(packOutput)[0]
const tarball = join(workDir, packed.filename)
console.log(`packed: ${packed.filename} (${packed.files.length} files)`)

const forbidden = /^package\/(research\/|browser-tests\/|test\/|verification\/|scripts\/|docs\/|examples\/)|b6/i
for (const file of packed.files) {
  check(!forbidden.test(file.path), `tarball entry is core-only: ${file.path}`)
}

const consumer = join(workDir, 'consumer')
await mkdir(join(consumer, 'src'), { recursive: true })
await writeFile(join(consumer, 'package.json'), JSON.stringify({
  name: 'unigrid-consumer-smoke',
  private: true,
  type: 'module',
}, null, 2))
run(npm, ['install', '--no-audit', '--no-fund', '--loglevel=error',
  tarball,
  `react@${reactVersion}`,
  `react-dom@${reactVersion}`,
  `@types/react@${typesMajor}`,
  `@types/react-dom@${typesMajor}`,
  'typescript@5.5.3',
], { cwd: consumer, stdio: 'inherit' })
console.log('ok: package installation succeeds')

await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2020',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
    jsx: 'react-jsx',
    strict: true,
    skipLibCheck: false,
    outDir: 'dist',
    rootDir: 'src',
  },
  include: ['src'],
}, null, 2))

await writeFile(join(consumer, 'src', 'App.tsx'), `import { Cell, Unigrid, useUnigrid } from '@khannaoffice/unigrid'

function Probe({ id }: { id: string }) {
  const { activeColumns, moduleWidth, moduleHeight, columnGap, rowGap, fieldWidth, materialState } = useUnigrid()
  return (
    <div
      className="probe"
      data-probe={id}
      data-columns={activeColumns}
      data-module-width={moduleWidth}
      data-module-height={moduleHeight}
      data-column-gap={columnGap}
      data-row-gap={rowGap}
      data-field-width={fieldWidth}
      data-state={materialState}
    />
  )
}

export function Authored({ host, width }: { host: string; width: number }) {
  return (
    <div id={host} style={{ width }}>
      <Unigrid>
        <Cell x={0} y={0} w={8} h={4}>
          Main
          <Probe id={host} />
        </Cell>
        <Cell x={8} y={0} w={4} h={4}>
          Aside
        </Cell>
      </Unigrid>
    </div>
  )
}

export function Fluid({ host, width }: { host: string; width: number }) {
  return (
    <div id={host} style={{ width }}>
      <Unigrid authoredColumns="fluid" reflowFlow="pack">
        <Cell w={4} h={3}>
          One
          <Probe id={host} />
        </Cell>
        <Cell w={6} h={3}>Two</Cell>
        <Cell w={2} h={2}>Three</Cell>
      </Unigrid>
    </div>
  )
}

export function FittingAt390({ host, width }: { host: string; width: number }) {
  // Cells that fit the four-column 372px field, so the residual material
  // (390 - 372 = 18px, 9px per side) divides evenly around the field.
  return (
    <div id={host} style={{ width }}>
      <Unigrid>
        <Cell x={0} y={0} w={4} h={2}>
          Fits
          <Probe id={host} />
        </Cell>
      </Unigrid>
    </div>
  )
}

export function App() {
  return (
    <>
      <Authored host="authored-1260" width={1260} />
      <Authored host="authored-390" width={390} />
      <Authored host="authored-60" width={60} />
      <FittingAt390 host="fitting-390" width={390} />
      <Fluid host="fluid-1260" width={1260} />
    </>
  )
}
`)

await writeFile(join(consumer, 'src', 'readme-api.tsx'), `import { useState } from 'react'
import {
  Cell,
  Unigrid,
  configForAuthoredFieldWidth,
  useUnigrid,
} from '@khannaoffice/unigrid'

const geometry = configForAuthoredFieldWidth(1440)

function Measure() {
  const { activeColumns, moduleWidth, fieldWidth, materialState } = useUnigrid()
  return <span>{activeColumns} {moduleWidth} {fieldWidth} {materialState}</span>
}

export function ReadmeApis() {
  const [showGrid, setShowGrid] = useState(false)
  return (
    <>
      <Unigrid>
        <Cell x={0} y={0} w={8} h={4}>Main</Cell>
        <Cell x={8} y={0} w={4} h={4}>Aside</Cell>
      </Unigrid>
      <Unigrid authoredColumns={16} reflowFlow="stack">
        <Cell x={0} y={0} w={16} h={1} compactW={4} compactH={2} compactBehavior="reflow">Wide</Cell>
      </Unigrid>
      <Unigrid reflowFlow="pack" strategy="preserve" breakpoints={[1, 6, 12]}>
        <Cell x={0} y={0} w={8} h={4}>Main</Cell>
        <Cell x={8} y={0} w={4} h={4}>Aside</Cell>
      </Unigrid>
      <Unigrid
        moduleWidth={96}
        moduleHeight={91.428571}
        columnGap={13.714286}
        rowGap={11.428571}
      >
        <Cell x={0} y={0} w={1} h={1}>Custom geometry</Cell>
      </Unigrid>
      <Unigrid {...geometry}>
        <Cell x={0} y={0} w={1} h={1}>Derived geometry</Cell>
      </Unigrid>
      <button onClick={() => setShowGrid((value) => !value)}>Grid</button>
      <Unigrid
        authoredColumns="fluid"
        reflowFlow="pack"
        showGrid={showGrid}
        guideColor="rgb(255 0 0 / 0.25)"
        guideNotchColor="rgb(0 0 255 / 0.6)"
      >
        <Cell w={4} h={3}>
          <Measure />
        </Cell>
      </Unigrid>
    </>
  )
}
`)

await writeFile(join(consumer, 'src', 'ssr.tsx'), `import { renderToStaticMarkup } from 'react-dom/server'
import { App } from './App.js'

console.log(renderToStaticMarkup(<App />))
`)

await writeFile(join(consumer, 'src', 'client.tsx'), `import { createRoot } from 'react-dom/client'
import { App } from './App.js'

const root = document.getElementById('root')
if (!root) throw new Error('no root')
createRoot(root).render(<App />)
requestAnimationFrame(() => requestAnimationFrame(() => {
  document.documentElement.dataset.ready = 'true'
}))
`)

const tsc = join(consumer, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
run(tsc, ['-p', '.'], { cwd: consumer, stdio: 'inherit' })
console.log('ok: TypeScript resolves declarations; consumer tsc build succeeds')

const consumerRequire = createRequire(join(consumer, 'src', 'x.js'))
const installedEntry = pathToFileURL(consumerRequire.resolve('@khannaoffice/unigrid')).href
const api = await import(installedEntry)
check(typeof api.Unigrid === 'function' || typeof api.Unigrid === 'object', 'ESM exports resolve; Unigrid resolves')
check(typeof api.Cell === 'function' || typeof api.Cell === 'object', 'Cell resolves')
for (const name of ['B6Frame', 'B6GridLayer', 'B6Cell', 'B6TitleBar', 'B6BottomBar', 'B6_SPEC', 'B6_PROVENANCE', 'b6Rect', 'MM_PER_PT']) {
  check(!(name in api), `B6 is unavailable from the public root API (${name})`)
}
const b6Missing = await stat(join(consumer, 'node_modules', '@khannaoffice', 'unigrid', 'dist', 'b6.js')).then(() => false, () => true)
check(b6Missing, 'no B6 runtime is present in the installed package')

const ssrHtml = run(process.execPath, [join(consumer, 'dist', 'ssr.js')], { cwd: consumer })
check(ssrHtml.includes('data-kho-unigrid-module-width="84"'), 'SSR: default module width is 84')
check(ssrHtml.includes('data-kho-unigrid-module-height="80"'), 'SSR: default module height is 80')
check(ssrHtml.includes('data-kho-unigrid-column-gap="12"'), 'SSR: default column gap is 12')
check(ssrHtml.includes('data-kho-unigrid-row-gap="10"'), 'SSR: default row gap is 10')
check(ssrHtml.includes('data-probe="authored-1260"'), 'authored composition builds and renders (SSR)')
check(ssrHtml.includes('data-probe="fluid-1260"') && ssrHtml.includes('data-state="fluid"'), 'fluid composition builds and renders (SSR)')

if (process.env.UNIGRID_CONSUMER_SKIP_BROWSER === '1') {
  console.log('skipping browser render (UNIGRID_CONSUMER_SKIP_BROWSER=1)')
} else {
  const cdn = process.env.REACT_ESM_CDN || 'https://esm.unpkg.com'
  const vendorUrls = {
    react: `${cdn}/react@${reactVersion}?dev`,
    'react-dom-client': `${cdn}/react-dom@${reactVersion}/client?dev&external=react`,
    'react-jsx-runtime': `${cdn}/react@${reactVersion}/jsx-runtime?dev&external=react`,
  }
  const vendorKeyFor = (url) => vendorModuleKey(url, vendorUrls)
  const rewrite = (source) => {
    let out = ''
    let index = 0
    for (;;) {
      const at = source.indexOf(cdn, index)
      if (at === -1) return out + source.slice(index)
      const quote = source.lastIndexOf('"', at) > source.lastIndexOf("'", at) ? '"' : "'"
      const end = source.indexOf(quote, at)
      if (end === -1) return out + source.slice(index)
      out += source.slice(index, at) + '/vendor-esm/' + vendorKeyFor(source.slice(at, end))
      index = end
    }
  }
  const vendorCache = new Map()
  const loadVendor = async (key) => {
    if (vendorCache.has(key)) return vendorCache.get(key)
    const target = new URL(vendorUrls[key] ?? Buffer.from(key, 'base64url').toString('utf8'))
    target.searchParams.set('external', 'react')
    target.searchParams.set('dev', '')
    const response = await fetch(target, { redirect: 'follow' })
    if (!response.ok) throw new Error(`vendor fetch failed ${response.status} for ${target}`)
    const source = rewrite(await response.text())
    vendorCache.set(key, source)
    return source
  }

  const importMap = JSON.stringify({
    imports: {
      react: '/vendor-esm/react',
      'react-dom/client': '/vendor-esm/react-dom-client',
      'react/jsx-runtime': '/vendor-esm/react-jsx-runtime',
      '@khannaoffice/unigrid': '/node_modules/@khannaoffice/unigrid/dist/index.js',
    },
  })
  const contentTypes = { '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.map': 'application/json; charset=utf-8' }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host}`)
      if (url.pathname === '/') {
        response.setHeader('content-type', 'text/html; charset=utf-8')
        response.end(`<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${importMap}</script><style>*{box-sizing:border-box}html,body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/dist/client.js"></script></body></html>`)
        return
      }
      if (url.pathname.startsWith('/vendor-esm/')) {
        response.setHeader('content-type', 'text/javascript; charset=utf-8')
        response.end(await loadVendor(decodeURIComponent(url.pathname.slice('/vendor-esm/'.length))))
        return
      }
      const path = join(consumer, decodeURIComponent(url.pathname))
      if (!path.startsWith(consumer)) throw new Error('outside root')
      response.setHeader('content-type', contentTypes[extname(path)] || 'application/octet-stream')
      response.end(await readFile(path))
    } catch (error) {
      response.statusCode = 404
      response.end(String(error))
    }
  })
  const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))

  const playwright = require('@playwright/test')
  const browser = await playwright.chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  check(pageErrors.length === 0, `browser rendering succeeds without page errors${pageErrors.length ? `: ${pageErrors[0]}` : ''}`)

  const read = (host) => page.evaluate((id) => {
    const hostElement = document.getElementById(id)
    const probe = hostElement.querySelector('.probe')
    const grid = hostElement.querySelector('.kho-unigrid')
    const hostRect = hostElement.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    const cells = [...hostElement.querySelectorAll('.kho-unigrid-cell')].map((cell) => {
      const rect = cell.getBoundingClientRect()
      return { width: rect.width, x: rect.x }
    })
    return {
      columns: Number(probe.dataset.columns),
      moduleWidth: Number(probe.dataset.moduleWidth),
      moduleHeight: Number(probe.dataset.moduleHeight),
      columnGap: Number(probe.dataset.columnGap),
      rowGap: Number(probe.dataset.rowGap),
      fieldWidth: Number(probe.dataset.fieldWidth),
      state: probe.dataset.state,
      hostX: hostRect.x,
      hostWidth: hostRect.width,
      gridScrollWidth: grid.scrollWidth,
      gridClientWidth: grid.clientWidth,
      overflowX: getComputedStyle(grid).overflowX,
      cells,
    }
  }, host)

  await page.waitForFunction(() => {
    const columnsOf = (id) => Number(document.getElementById(id)?.querySelector('.probe')?.dataset.columns)
    return columnsOf('authored-1260') === 12 && columnsOf('authored-390') === 4 && columnsOf('authored-60') === 1
  })

  const wide = await read('authored-1260')
  check(wide.moduleWidth === 84 && wide.moduleHeight === 80, 'browser: default module is 84 x 80 px')
  check(wide.columnGap === 12 && wide.rowGap === 10, 'browser: default intervals are 12 x 10 px')
  check(wide.columns === 12 && wide.fieldWidth === 1140, 'browser: twelve columns occupy 1,140 px')
  const wideMain = wide.cells[0]
  check(Math.abs(wideMain.width - (8 * 84 + 7 * 12)) < 0.5, 'browser: authored w=8 cell spans 756 px at the full field')
  const wideLeftResidual = wideMain.x - wide.hostX
  check(Math.abs(wideLeftResidual - 60) < 0.5, `browser: 1,260 px material leaves 60 px residual on the left (got ${wideLeftResidual})`)
  const wideRightResidual = wide.hostX + wide.hostWidth - (wideMain.x + wide.fieldWidth)
  check(Math.abs(wideRightResidual - 60) < 0.5, `browser: 1,260 px material leaves 60 px residual on the right (got ${wideRightResidual})`)

  const phone = await read('authored-390')
  check(phone.columns === 4 && phone.fieldWidth === 372, 'browser: 390 px resolves to four columns (372 px field)')
  const phoneFirstCell = phone.cells[0]
  check(Math.abs(phoneFirstCell.width - (8 * 84 + 7 * 12)) < 0.5, 'browser: authored w=8 span is preserved (756 px) beyond the 4-column field')
  check(phone.gridScrollWidth > phone.gridClientWidth && phone.overflowX === 'auto', 'browser: oversized authored span remains reachable through horizontal scrolling')
  check(phoneFirstCell.x >= phone.hostX - 0.5, 'browser: overflowing field anchors to inline start (no negative inline space)')

  const tiny = await read('authored-60')
  check(tiny.columns === 1 && tiny.fieldWidth === 84, 'browser: sub-84 px material preserves one complete 84 px module and overflows')

  await page.waitForFunction(() => Number(document.getElementById('fitting-390')?.querySelector('.probe')?.dataset.columns) === 4)
  const fitting = await read('fitting-390')
  check(fitting.fieldWidth === 372, 'browser: fitting 390 px host resolves a 372 px field')
  const fittingLeft = fitting.cells[0].x - fitting.hostX
  check(Math.abs(fittingLeft - 9) < 0.5, `browser: 390 px material leaves 9 px residual on the left (got ${fittingLeft})`)
  const fittingRight = fitting.hostX + fitting.hostWidth - (fitting.cells[0].x + fitting.fieldWidth)
  check(Math.abs(fittingRight - 9) < 0.5, `browser: 390 px material leaves 9 px residual on the right (got ${fittingRight})`)

  await page.waitForFunction(() => Number(document.getElementById('fluid-1260')?.querySelector('.probe')?.dataset.columns) === 13)
  const fluid = await read('fluid-1260')
  check(fluid.state === 'fluid' && fluid.columns === 13, 'browser: fluid composition admits every complete module (13 at 1,260 px)')
  check(fluid.moduleWidth === 84 && fluid.columnGap === 12, 'browser: fluid composition keeps the established module geometry')

  await browser.close()
  server.close()
}

console.log('\nconsumer test PASSED')
await rm(workDir, { recursive: true, force: true })
