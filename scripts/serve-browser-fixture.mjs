import { createServer } from 'node:http'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import React, { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { Cell, Unigrid } from '../dist/index.js'
import { FluidHydrationFixture } from '../browser-tests/fixture/fluid-hydration.mjs'
import { vendorModuleKey } from './react-vendor-policy.mjs'

const root = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'))
const port = Number(process.env.UNIGRID_TEST_PORT || 4178)
const reactVersion = process.env.REACT_VERSION || React.version || '18.3.1'
const cdn = process.env.REACT_ESM_CDN || 'https://esm.unpkg.com'

const VENDOR_ROUTE = '/vendor-esm/'
const cacheDir = join(root, 'node_modules', '.cache', 'unigrid-esm')
const memory = new Map()

const vendorUrls = {
  react: `${cdn}/react@${reactVersion}?dev`,
  'react-dom-client': `${cdn}/react-dom@${reactVersion}/client?dev&external=react`,
}

function vendorKeyFor(url) {
  return vendorModuleKey(url, vendorUrls)
}

function rewriteCdnSpecifiers(source) {
  let out = ''
  let index = 0
  for (;;) {
    const at = source.indexOf(cdn, index)
    if (at === -1) return out + source.slice(index)
    const quote = source.lastIndexOf('"', at) > source.lastIndexOf("'", at) ? '"' : "'"
    const end = source.indexOf(quote, at)
    if (end === -1) return out + source.slice(index)
    out += source.slice(index, at) + VENDOR_ROUTE + vendorKeyFor(source.slice(at, end))
    index = end
  }
}

async function loadVendorModule(key) {
  if (memory.has(key)) return memory.get(key)
  const cachePath = join(cacheDir, `${key}-${reactVersion}.mjs`)
  if (!process.env.UNIGRID_ESM_NO_CACHE) {
    try {
      const cached = await readFile(cachePath, 'utf8')
      memory.set(key, cached)
      return cached
    } catch {}
  }
  const target = vendorUrls[key] ?? Buffer.from(key, 'base64url').toString('utf8')
  const response = await fetch(target, { redirect: 'follow' })
  if (!response.ok) throw new Error(`vendor fetch failed ${response.status} for ${target}`)
  const source = rewriteCdnSpecifiers(await response.text())
  memory.set(key, source)
  if (!process.env.UNIGRID_ESM_NO_CACHE) {
    try {
      await mkdir(cacheDir, { recursive: true })
      await writeFile(cachePath, source, 'utf8')
    } catch {}
  }
  return source
}

function importMap() {
  return JSON.stringify({
    imports: {
      react: `${VENDOR_ROUTE}react`,
      'react-dom/client': `${VENDOR_ROUTE}react-dom-client`,
      '@khannaoffice/unigrid': '/dist/index.js',
    },
  })
}

function shell(modulePath, body = '<div id="root"></div>') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script type="importmap">${importMap()}</script><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{font-family:Arial,sans-serif}#resize-host{margin:0 auto}.kho-unigrid-cell{outline:1px solid rgba(0,0,0,.2)}</style></head><body>${body}<script type="module" src="${modulePath}"></script></body></html>`
}

function HydrationFixture() {
  return createElement(
    Unigrid,
    { initialColumns: 1, previewColumns: 3 },
    createElement(Cell, { id: 'hydrated-cell', x: 0, y: 0, w: 12, h: 2 }, 'Hydrated'),
  )
}

const contentTypes = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`)
    if (url.pathname === '/') {
      response.setHeader('content-type', 'text/html; charset=utf-8')
      response.end(shell('/browser-tests/fixture/app.mjs'))
      return
    }
    if (url.pathname === '/distant') {
      response.setHeader('content-type', 'text/html; charset=utf-8')
      response.end(shell('/browser-tests/fixture/distant.mjs'))
      return
    }
    if (url.pathname === '/hydration') {
      const markup = renderToString(createElement(HydrationFixture))
      response.setHeader('content-type', 'text/html; charset=utf-8')
      response.end(shell('/browser-tests/fixture/hydrate.mjs', `<div id="root">${markup}</div>`))
      return
    }
    if (url.pathname.startsWith(VENDOR_ROUTE)) {
      const key = decodeURIComponent(url.pathname.slice(VENDOR_ROUTE.length))
      const source = await loadVendorModule(key)
      response.setHeader('content-type', 'text/javascript; charset=utf-8')
      response.setHeader('cache-control', 'public, max-age=31536000, immutable')
      response.end(source)
      return
    }
    if (url.pathname === '/hydration-fluid') {
      const markup = renderToString(createElement(FluidHydrationFixture))
      response.setHeader('content-type', 'text/html; charset=utf-8')
      response.end(shell('/browser-tests/fixture/hydrate-fluid.mjs', `<div id="root">${markup}</div>`))
      return
    }
    const relative = normalize(url.pathname).replace(/^[/\\]+/, '')
    const path = join(root, relative)
    if (!path.startsWith(root)) throw new Error('outside root')
    const info = await stat(path)
    if (!info.isFile()) throw new Error('not a file')
    response.setHeader('content-type', contentTypes[extname(path)] || 'application/octet-stream')
    response.end(await readFile(path))
  } catch (error) {
    response.statusCode = 404
    response.end(String(error))
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Unigrid browser fixture: http://127.0.0.1:${port} (React ${reactVersion})`)
})
