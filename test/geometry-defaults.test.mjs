import test from 'node:test'
import assert from 'node:assert/strict'
import {
  WEB_TEMPLATE_SPEC,
  fieldWidthForColumns,
  resolveGeometry,
  resolveResponsivePlacement,
  resolveUnigrid,
} from '../dist/index.js'

test('default geometry is the historical B-module: 84 x 80 px module, 12 x 10 px intervals, 12 authored columns', () => {
  assert.equal(WEB_TEMPLATE_SPEC.moduleWidthPx, 84)
  assert.equal(WEB_TEMPLATE_SPEC.moduleHeightPx, 80)
  assert.equal(WEB_TEMPLATE_SPEC.columnGapPx, 12)
  assert.equal(WEB_TEMPLATE_SPEC.rowGapPx, 10)
  assert.equal(WEB_TEMPLATE_SPEC.authoredColumns, 12)
  const geometry = resolveGeometry({})
  assert.equal(geometry.moduleWidth, 84)
  assert.equal(geometry.moduleHeight, 80)
  assert.equal(geometry.columnGap, 12)
  assert.equal(geometry.rowGap, 10)
  assert.equal(geometry.authoredColumns, 12)
})

test('complete default field widths follow the 96px pitch: 96n - 12 for every capacity', () => {
  const expected = [84, 180, 276, 372, 468, 564, 660, 756, 852, 948, 1044, 1140]
  for (let columns = 1; columns <= 12; columns += 1) {
    assert.equal(fieldWidthForColumns(columns), expected[columns - 1])
    assert.equal(fieldWidthForColumns(columns), 96 * columns - 12)
  }
})

test('the complete twelve-column field occupies 1,140 px', () => {
  assert.equal(fieldWidthForColumns(12), 12 * 84 + 11 * 12)
  assert.equal(fieldWidthForColumns(12), 1140)
  const metrics = resolveUnigrid(1140)
  assert.equal(metrics.activeColumns, 12)
  assert.equal(metrics.fieldWidth, 1140)
  assert.equal(metrics.materialState, 'authored')
})

test('390 px of material resolves to four complete columns (372 px field)', () => {
  const metrics = resolveUnigrid(390)
  assert.equal(metrics.capacityColumns, 4)
  assert.equal(metrics.activeColumns, 4)
  assert.equal(metrics.fieldWidth, 4 * 84 + 3 * 12)
  assert.equal(metrics.fieldWidth, 372)
})

test('residual material divides evenly around a fitting field: 1,260 px -> 60 px per side, 390 px -> 9 px per side', () => {
  const wide = resolveUnigrid(1260)
  assert.equal(wide.fieldWidth, 1140)
  assert.equal(wide.fieldFits, true)
  assert.equal((1260 - wide.fieldWidth) / 2, 60)

  const phone = resolveUnigrid(390)
  assert.equal(phone.fieldWidth, 372)
  assert.equal(phone.fieldFits, true)
  assert.equal((390 - phone.fieldWidth) / 2, 9)
})

test('material narrower than one module preserves one complete 84 px module and overflows; no fractional module is synthesized', () => {
  for (const width of [1, 40, 60, 83.9]) {
    const metrics = resolveUnigrid(width)
    assert.equal(metrics.capacityColumns, 1)
    assert.equal(metrics.activeColumns, 1)
    assert.equal(metrics.moduleWidth, 84, 'module never shrinks to fit')
    assert.equal(metrics.fieldWidth, 84)
    assert.equal(metrics.fieldFits, false)
  }
})

test('an authored span wider than the active field is preserved, never clamped, unless an explicit compact span is authored', () => {
  const preserved = resolveResponsivePlacement({ x: 0, y: 0, w: 8, h: 4 }, 4)
  assert.equal(preserved.w, 8)
  const compacted = resolveResponsivePlacement({ x: 0, y: 0, w: 8, h: 4, compactW: 3 }, 4)
  assert.equal(compacted.w, 3)
})
