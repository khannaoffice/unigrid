import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Cell,
  Unigrid,
  auditMaterialStates,
  breakpointWidths,
  capacityBreakpoints,
  fieldWidthForColumns,
  resolveCapacityBreakpoint,
  resolveUnigrid,
  unigridRect,
  validateCapacityBreakpoints,
  validateUnigridConfig,
} from '../dist/index.js'

const SPEC_84_80 = Object.freeze({
  moduleWidth: 84,
  moduleHeight: 80,
  columnGap: 16,
  rowGap: 16,
})

function expectedRawCapacity(width, moduleWidth = 84, columnGap = 16) {
  if (width === 0) return 1
  return Math.min(12, Math.max(1, Math.floor((width + columnGap) / (moduleWidth + columnGap))))
}

test('84 × 80 geometry resolves every exact boundary without a partial field', () => {
  for (let columns = 1; columns <= 12; columns += 1) {
    const threshold = fieldWidthForColumns(columns, SPEC_84_80)
    const exact = resolveUnigrid(threshold, SPEC_84_80)
    assert.equal(exact.capacityColumns, columns)
    assert.equal(exact.activeColumns, columns)
    assert.equal(exact.fieldWidth, threshold)
    assert.equal(exact.fieldFits, true)
    assert.equal(exact.residualInlineSpace, 0)
    assert.equal(exact.overflowInlineSpace, 0)

    if (columns > 1) {
      const below = resolveUnigrid(threshold - 0.000001, SPEC_84_80)
      assert.equal(below.capacityColumns, columns - 1)
      assert.equal(below.activeColumns, columns - 1)
      assert.ok(below.fieldWidth < threshold)
      assert.equal(below.fieldFits, true)
    }
  }
})

test('exhaustive width sweep maps every display to complete cells only', () => {
  for (let quarterPixel = 0; quarterPixel <= 40_000; quarterPixel += 1) {
    const width = quarterPixel / 4
    const metrics = resolveUnigrid(width, SPEC_84_80)
    const raw = expectedRawCapacity(width)
    assert.equal(metrics.capacityColumns, raw)
    assert.equal(metrics.activeColumns, raw)
    assert.equal(metrics.fieldWidth, fieldWidthForColumns(raw, SPEC_84_80))
    assert.equal(metrics.moduleWidth, 84)
    assert.equal(metrics.moduleHeight, 80)
    assert.equal(metrics.columnGap, 16)
    assert.equal(metrics.rowGap, 16)
    assert.equal(metrics.fieldFits, width >= 84)
    if (width >= 84) {
      assert.ok(metrics.fieldWidth <= width)
      assert.equal(metrics.overflowInlineSpace, 0)
      assert.equal(metrics.fieldWidth + metrics.residualInlineSpace, width)
    } else {
      assert.equal(metrics.activeColumns, 1)
      assert.equal(metrics.fieldWidth, 84)
      assert.equal(metrics.overflowInlineSpace, 84 - width)
    }
  }
})

test('ultrawide material remains a centered twelve-cell field', () => {
  for (const width of [1184, 1184.5, 1440, 2560, 5120, 100_000]) {
    const metrics = resolveUnigrid(width, SPEC_84_80)
    assert.equal(metrics.capacityColumns, 12)
    assert.equal(metrics.activeColumns, 12)
    assert.equal(metrics.fieldWidth, 1184)
    assert.equal(metrics.residualInlineSpace, width - 1184)
    assert.equal(metrics.marginInlineStart, (width - 1184) / 2)
    assert.equal(metrics.marginInlineEnd, (width - 1184) / 2)
    assert.equal(metrics.overflowInlineSpace, 0)
    assert.equal(metrics.fieldFits, true)
  }
})

test('centered margins preserve exact integer and half-pixel residuals', () => {
  for (const [width, expectedColumns, expectedMargin] of [
    [430, 4, 23],
    [675, 6, 45.5],
    [1280, 12, 48],
    [2560, 12, 688],
  ]) {
    const metrics = resolveUnigrid(width, {
      ...SPEC_84_80,
      breakpoints: capacityBreakpoints(2),
    })
    assert.equal(metrics.activeColumns, expectedColumns)
    assert.equal(metrics.marginInlineStart, expectedMargin)
    assert.equal(metrics.marginInlineEnd, expectedMargin)
    assert.equal(
      metrics.marginInlineStart + metrics.fieldWidth + metrics.marginInlineEnd,
      width,
    )
  }
})

test('authoredColumns prop configures a non-default ceiling end-to-end: previewColumns, initialColumns, and rendered data attributes resolve relative to it', () => {
  const preview = renderToStaticMarkup(createElement(
    Unigrid,
    { authoredColumns: 20, previewColumns: 15 },
    createElement(Cell, { w: 1, h: 1 }, 'x'),
  ))
  assert.match(preview, /data-kho-unigrid-authored-columns="20"/)
  assert.match(preview, /data-kho-unigrid-columns="15"/)
  assert.match(preview, /data-kho-unigrid-capacity="15"/)
  assert.match(preview, /data-kho-unigrid-preview="15"/)
  assert.match(preview, /data-kho-unigrid-breakpoints="1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20"/)

  const ssrFallback = renderToStaticMarkup(createElement(
    Unigrid,
    { authoredColumns: 20, initialColumns: 15 },
    createElement(Cell, { w: 1, h: 1 }, 'x'),
  ))
  assert.match(ssrFallback, /data-kho-unigrid-columns="15"/)

  const snapped = renderToStaticMarkup(createElement(
    Unigrid,
    { authoredColumns: 20, breakpoints: capacityBreakpoints(5, 20), initialColumns: 17 },
    createElement(Cell, { w: 1, h: 1 }, 'x'),
  ))
  assert.match(snapped, /data-kho-unigrid-columns="15"/)
})

test('previewColumns validates against the CONFIGURED ceiling, not a hardcoded 12', () => {
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { previewColumns: 15 }, createElement(Cell, { w: 1, h: 1 }, 'x'))),
    /previewColumns must be a safe integer from 1 to 12/,
  )
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(
    Unigrid, { authoredColumns: 20, previewColumns: 15 }, createElement(Cell, { w: 1, h: 1 }, 'x'),
  )))
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 21 }, createElement(Cell, { w: 1, h: 1 }, 'x'))),
    /previewColumns must be a safe integer from 1 to 20/,
  )
})

test('authoredColumns prop rejects zero, negative, non-integer, and absurdly large values', () => {
  for (const bad of [0, -1, -12, 1.5, NaN, Infinity, 10_001]) {
    assert.throws(
      () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: bad }, createElement(Cell, { w: 1, h: 1 }, 'x'))),
      /authoredColumns must be "fluid" or a safe integer from 1 to 10000/,
      `authoredColumns=${bad} should throw`,
    )
  }
})

test('omitting authoredColumns renders byte-identical markup to explicitly passing authoredColumns={12} — the required no-op default', () => {
  const bareImplicit = renderToStaticMarkup(createElement(Unigrid, {}, createElement(Cell, { x: 0, y: 0, w: 4, h: 2 }, 'a')))
  const bareExplicit = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 12 }, createElement(Cell, { x: 0, y: 0, w: 4, h: 2 }, 'a')))
  assert.equal(bareImplicit, bareExplicit)

  const customGeometryImplicit = renderToStaticMarkup(createElement(
    Unigrid, { ...SPEC_84_80, initialColumns: 4 }, createElement(Cell, { x: 0, y: 0, w: 4, h: 2 }, 'a'),
  ))
  const customGeometryExplicit = renderToStaticMarkup(createElement(
    Unigrid, { ...SPEC_84_80, initialColumns: 4, authoredColumns: 12 }, createElement(Cell, { x: 0, y: 0, w: 4, h: 2 }, 'a'),
  ))
  assert.equal(customGeometryImplicit, customGeometryExplicit)
})

test('authoredColumns={1} renders successfully via SSR with default breakpoints — regression for the fixed single-column-ceiling breakpoints bug', () => {
  const html = renderToStaticMarkup(createElement(
    Unigrid, { authoredColumns: 1 }, createElement(Cell, { w: 1, h: 1 }, 'x'),
  ))
  assert.match(html, /data-kho-unigrid-authored-columns="1"/)
  assert.match(html, /data-kho-unigrid-columns="1"/)
  assert.match(html, /data-kho-unigrid-capacity="1"/)
  assert.match(html, /data-kho-unigrid-breakpoints="1"/)
  assert.match(html, />x</)

  assert.doesNotThrow(() => renderToStaticMarkup(createElement(
    Unigrid, { authoredColumns: 1, breakpoints: [1] }, createElement(Cell, { w: 1, h: 1 }, 'x'),
  )))
})

test('hideBelowColumns and compactW at the Cell level are now validated against the enclosing Unigrid\'s CONFIGURED authoredColumns, not a hardcoded default', () => {
  assert.throws(
    () => renderToStaticMarkup(createElement(
      Unigrid, {}, createElement(Cell, { w: 1, h: 1, hideBelowColumns: 15 }, 'x'),
    )),
    /hideBelowColumns must be a safe integer from 1 to 12 \(got 15\)/,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(
      Unigrid, {}, createElement(Cell, { x: 0, y: 0, w: 1, h: 1, compactW: 15 }, 'x'),
    )),
    /compactW must be "auto" or a safe integer from 1 to 12 \(got 15\)/,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(
      Unigrid, { authoredColumns: 14 }, createElement(Cell, { w: 1, h: 1, hideBelowColumns: 15 }, 'x'),
    )),
    /hideBelowColumns must be a safe integer from 1 to 14 \(got 15\)/,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(
      Unigrid, { authoredColumns: 14 }, createElement(Cell, { x: 0, y: 0, w: 1, h: 1, compactW: 15 }, 'x'),
    )),
    /compactW must be "auto" or a safe integer from 1 to 14 \(got 15\)/,
  )
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(
    Unigrid, { authoredColumns: 20, previewColumns: 20 }, createElement(Cell, { w: 1, h: 1, hideBelowColumns: 15 }, 'x'),
  )))
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(
    Unigrid, { authoredColumns: 20, previewColumns: 20 }, createElement(Cell, { x: 0, y: 0, w: 1, h: 1, compactW: 15 }, 'x'),
  )))
  assert.throws(
    () => renderToStaticMarkup(createElement(
      Unigrid, { authoredColumns: 20 }, createElement(Cell, { w: 1, h: 1, hideBelowColumns: 21 }, 'x'),
    )),
    /hideBelowColumns must be a safe integer from 1 to 20 \(got 21\)/,
  )
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(
    Unigrid, { authoredColumns: 20 }, createElement(Cell, { w: 20, h: 1, compactW: 10, hideBelowColumns: 6 }, 'x'),
  )))
})

test('guide midpoint notches and centering are formula-derived', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, {
    ...SPEC_84_80,
    initialColumns: 4,
    showGrid: true,
    guideColor: 'transparent',
    guideNotchColor: '#f00',
  }))
  assert.match(html, /data-kho-unigrid-guide-notch-y="40"/)
  assert.match(html, /data-kho-unigrid-guide-notch-length="8"/)
  assert.match(html, /inset-inline-start:calc\(\(100% - 384px\) \/ 2\)/)
  assert.match(html, /x1="[^"]*" y1="40" x2="[^"]*" y2="40" stroke="#f00"/)
  assert.match(html, /z-index:2/)
  assert.doesNotMatch(html, /translateX/)
})

test('two-column capacity breakpoints drop by two while preserving complete fields', () => {
  const breakpoints = capacityBreakpoints(2)
  assert.deepEqual(breakpoints, [1, 2, 4, 6, 8, 10, 12])
  const config = { ...SPEC_84_80, breakpoints }
  const expected = [1, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10, 12]

  for (let raw = 1; raw <= 12; raw += 1) {
    const width = fieldWidthForColumns(raw, config)
    const metrics = resolveUnigrid(width, config)
    assert.equal(metrics.capacityColumns, raw)
    assert.equal(metrics.activeColumns, expected[raw - 1])
    assert.equal(metrics.fieldWidth, fieldWidthForColumns(expected[raw - 1], config))
    assert.ok(metrics.fieldWidth <= width)
  }

  assert.deepEqual(
    breakpointWidths(config),
    breakpoints.map((columns) => fieldWidthForColumns(columns, config)),
  )
})

test('layout-defined breakpoint sets are deterministic', () => {
  const breakpoints = [1, 3, 6, 9, 12]
  assert.deepEqual(
    Array.from({ length: 12 }, (_, index) => resolveCapacityBreakpoint(index + 1, breakpoints)),
    [1, 1, 3, 3, 3, 6, 6, 6, 9, 9, 9, 12],
  )
  const audit = auditMaterialStates([
    { x: 0, y: 0, w: 8, h: 2 },
    { x: 8, y: 0, w: 4, h: 2 },
  ], { ...SPEC_84_80, breakpoints })
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 12)
  assert.deepEqual(audit.states.map((state) => state.capacityColumns), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  assert.deepEqual(audit.states.map((state) => state.columns), [1, 1, 3, 3, 3, 6, 6, 6, 9, 9, 9, 12])
})

test('breakpoint configuration rejects ambiguous or incomplete policies', () => {
  for (const value of [
    null,
    [],
    [1],
    [2, 4, 6, 8, 10, 12],
    [1, 2, 4, 6, 8, 10],
    [1, 2, 2, 12],
    [1, 4, 3, 12],
    [1, 2.5, 12],
    [1, 13],
  ]) {
    assert.notDeepEqual(validateCapacityBreakpoints(value), [])
  }
  assert.deepEqual(validateCapacityBreakpoints([1, 2, 4, 6, 8, 10, 12]), [])
  assert.notDeepEqual(validateUnigridConfig({ breakpoints: [1, 2, 2, 12] }), [])
  for (const step of [0, -1, 1.5, 13, Infinity, NaN]) {
    assert.throws(() => capacityBreakpoints(step))
  }
})

test('invalid display widths fail closed and fractional geometry remains exact', () => {
  for (const width of [-1, -0.001, Infinity, -Infinity, NaN]) {
    assert.throws(() => resolveUnigrid(width, SPEC_84_80))
  }

  const fractional = {
    moduleWidth: 84.5,
    moduleHeight: 80.25,
    columnGap: 0.5,
    rowGap: 0.25,
  }
  const threshold = fieldWidthForColumns(12, fractional)
  const metrics = resolveUnigrid(threshold, fractional)
  assert.equal(metrics.activeColumns, 12)
  assert.equal(metrics.fieldWidth, threshold)
  assert.equal(resolveUnigrid(threshold - Number.EPSILON, fractional).activeColumns, 12)
  assert.equal(resolveUnigrid(threshold - 0.000001, fractional).activeColumns, 11)
})

test('all rectangle edges are derived from integer module coordinates', () => {
  const metrics = resolveUnigrid(1184, SPEC_84_80)
  for (let x = 0; x < 12; x += 1) {
    for (let w = 1; w <= 12 - x; w += 1) {
      for (const y of [0, 1, 2, 10, 100_000]) {
        for (const h of [1, 2, 5]) {
          const rect = unigridRect({ x, y, w, h }, metrics)
          assert.equal(rect.left, x * 100)
          assert.equal(rect.top, y * 96)
          assert.equal(rect.width, w * 84 + (w - 1) * 16)
          assert.equal(rect.height, h * 80 + (h - 1) * 16)
          assert.equal(rect.right, rect.left + rect.width)
          assert.equal(rect.bottom, rect.top + rect.height)
        }
      }
    }
  }
})

test('strict cells clip painting to the snapped rectangle by default', () => {
  const html = renderToStaticMarkup(createElement(
    Unigrid,
    { ...SPEC_84_80, initialColumns: 4, breakpoints: capacityBreakpoints(2) },
    createElement(Cell, {
      w: 4,
      h: 3,
      contentStyle: { width: 999, margin: 40, transform: 'translateX(40px)' },
    }, 'strict'),
  ))
  assert.match(html, /data-kho-unigrid-breakpoints="1,2,4,6,8,10,12"/)
  assert.match(html, /data-kho-unigrid-snap="strict"/)
  assert.match(html, /overflow:clip/)
  assert.match(html, /contain:paint/)
  assert.match(html, /max-width:100%/)
  assert.match(html, /margin:0(?:px)?/)
  assert.match(html, /transform:none/)
  assert.doesNotMatch(html, /width:999px|translateX/)
})

test('overflow is available only as an explicit cell exception', () => {
  const html = renderToStaticMarkup(createElement(
    Unigrid,
    { ...SPEC_84_80 },
    createElement(Cell, { w: 1, h: 1, snap: 'overflow' }, 'exception'),
  ))
  assert.match(html, /data-kho-unigrid-snap="overflow"/)
  assert.match(html, /overflow:visible/)
  assert.match(html, /contain:none/)
  assert.throws(() => renderToStaticMarkup(createElement(
    Unigrid,
    null,
    createElement(Cell, { snap: 'loose' }, 'invalid'),
  )))
})
