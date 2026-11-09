import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as api from '../dist/index.js'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('package identity matches the core-package release', async () => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.name, '@khannaoffice/unigrid')
  assert.equal(pkg.version, '1.0.0')
  assert.equal(pkg.description, 'A fixed-module grid for React, developed in the lineage of Massimo Vignelli’s Unigrid for the National Park Service.')
  assert.equal(pkg.license, 'SEE LICENSE IN LICENSE')
  assert.deepEqual(pkg.files, ['dist', 'src', 'README.md', 'LICENSE'])
})

test('the CI React matrix and the local release matrix are the same two versions', async () => {
  const workflow = await readFile(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const ciVersions = [...new Set([...workflow.matchAll(/react:\s*(\d+\.\d+\.\d+)/g)].map((m) => m[1]))].sort()
  const scriptVersions = [...new Set(
    Object.entries(pkg.scripts)
      .filter(([name]) => name.startsWith('test:browser:react'))
      .map(([, command]) => /run-browser-version\.mjs\s+(\d+\.\d+\.\d+)/.exec(command)?.[1])
      .filter(Boolean),
  )].sort()
  assert.deepEqual(ciVersions, scriptVersions, 'CI and release browser matrices must test identical React versions')
  assert.equal(ciVersions.length, 2)
  assert.equal(pkg.peerDependencies.react, '>=18 <20')
})

test('public API exposes material-capacity functions and a configurable authoredColumns ceiling, but no fluid column-count controls and no B6 research symbols', () => {
  for (const name of ['Unigrid','Cell','useUnigrid','resolveUnigrid','fieldWidthForColumns','configForAuthoredFieldWidth','responsiveWidths','breakpointWidths','capacityBreakpoints','resolveCapacityBreakpoint','validateCapacityBreakpoints','resolveCompactSpan','auditMaterialStates','rowsForContentHeight','AUTHORED_COLUMNS','MAX_AUTHORED_COLUMNS']) assert.ok(name in api, `missing ${name}`)
  for (const forbidden of ['Grid','GridStyle','solve','DEFAULT_COLUMNS','maxColumns','maxRows']) assert.equal(forbidden in api, false)
  for (const forbidden of ['B6Frame','B6GridLayer','B6Cell','B6TitleBar','B6BottomBar','B6DividerBar','B6_SPEC','B6_PROVENANCE','validateB6Placement','assertB6Placement','b6Rect','validateB6Layout','assertB6Layout','b6Extent','MM_PER_PT','PT_PER_MM']) assert.equal(forbidden in api, false, `B6 symbol leaked: ${forbidden}`)
})

test('the default authoredColumns ceiling remains 12, unchanged by the new per-instance configurability', () => {
  assert.equal(api.AUTHORED_COLUMNS, 12)
})

test('authoredColumns is a real per-instance config field / <Unigrid> prop, and MaterialColumns is now a runtime-validated number rather than a compile-time 1-12 literal union', async () => {
  const specDeclaration = await readFile(path.join(root, 'dist', 'spec.d.ts'), 'utf8')
  const unigridDeclaration = await readFile(path.join(root, 'dist', 'Unigrid.d.ts'), 'utf8')
  assert.match(specDeclaration, /export type MaterialColumns = number;/)
  assert.doesNotMatch(specDeclaration, /export type MaterialColumns = 1 \|/)
  assert.match(specDeclaration, /\n\s+authoredColumns\?: AuthoredColumns;/)
  assert.match(unigridDeclaration, /\n\s+authoredColumns\?: AuthoredColumns;/)
  assert.match(specDeclaration, /export type AuthoredColumns = number \| typeof FLUID_COLUMNS;/)
  assert.match(specDeclaration, /export declare const FLUID_COLUMNS: "fluid";/)
})

test('public API exposes the compaction primitives introduced for the never-clamp invariant', () => {
  for (const name of [
    'resolveResponsivePlacement',
    'resolvedPlacementOverflowsField',
    'anyPlacementOverflowsField',
    'isHiddenAtCapacity',
    'validateCompactBehavior',
    'assertCompactBehavior',
    'validateCompactAlign',
    'assertCompactAlign',
    'assertCompactWidth',
  ]) assert.ok(name in api, `missing ${name}`)
})

test('compactW "full" is unreachable from the public API — a cell span never fills the active field', () => {
  assert.throws(() => api.resolveCompactSpan(4, 'full'), /removed in the canonical geometry model/)
  assert.notDeepEqual(api.validateCompactWidth('full'), [])
})

test('declarations remove fluid and column-count controls', async () => {
  const unigridDeclaration = await readFile(path.join(root,'dist','Unigrid.d.ts'),'utf8')
  const declarations = [
    unigridDeclaration,
    await readFile(path.join(root,'dist','Cell.d.ts'),'utf8'),
    await readFile(path.join(root,'dist','spec.d.ts'),'utf8'),
  ].join('\n')
  assert.doesNotMatch(unigridDeclaration, /\n\s+columns\?: number/)
  assert.doesNotMatch(declarations, /minModuleWidth/)
  assert.match(declarations, /moduleWidth\?: number/)
  assert.match(declarations, /strategy\?: UnigridResponsiveStrategy/)
  assert.match(declarations, /initialColumns\?: MaterialColumns/)
  assert.match(declarations, /previewColumns\?: MaterialColumns/)
  assert.match(declarations, /breakpoints\?: CapacityBreakpoints/)
  assert.match(declarations, /snap\?: ['"]strict['"] \| ['"]overflow['"]/)
  assert.doesNotMatch(unigridDeclaration, /dense\?:/)
})

test('source contains no fluid module-width solver', async () => {
  const files = await readdir(path.join(root,'src'))
  const source = (await Promise.all(files.map((file)=>readFile(path.join(root,'src',file),'utf8')))).join('\n')
  assert.doesNotMatch(source, /minModuleWidth|fluidModuleWidth/)
})

test('source never clamps a resolved span against the active capacity', async () => {
  for (const file of ['Cell.ts', 'Unigrid.ts']) {
    const source = await readFile(path.join(root, 'src', file), 'utf8')
    assert.doesNotMatch(source, /Math\.min\(/, `${file} should not clamp span against capacity`)
  }
})

test('resolveResponsivePlacement never resolves a span narrower than the authored width or an explicit compactW override, at any capacity', () => {
  for (let activeColumns = 1; activeColumns <= 12; activeColumns += 1) {
    for (let authoredW = 1; authoredW <= 12; authoredW += 1) {
      const auto = api.resolveResponsivePlacement({ w: authoredW, h: 1 }, activeColumns)
      assert.equal(auto.w, authoredW, `compactW "auto" must preserve the authored width ${authoredW} at capacity ${activeColumns}, got ${auto.w}`)

      for (let compactW = 1; compactW <= 12; compactW += 1) {
        const overridden = api.resolveResponsivePlacement({ x: 0, y: 0, w: authoredW, h: 1, compactW }, activeColumns)
        const expected = activeColumns === 12 ? authoredW : compactW
        assert.equal(overridden.w, expected, `w should resolve to ${expected} (authored=${authoredW}, compactW=${compactW}, capacity=${activeColumns}), got ${overridden.w}`)
      }
    }
  }
})
