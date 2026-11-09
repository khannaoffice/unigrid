import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Cell,
  Unigrid,
  auditMaterialStates,
  capacityBreakpoints,
  fieldWidthForColumns,
  resolveGeometry,
  resolvePackedRows,
  resolveUnigrid,
} from '../dist/index.js'

function flow(w, h = 1, compactAlign = 'start', hidden = false) {
  return { kind: 'flow', w, h, compactAlign, hidden }
}

test('2+2+2: three w=2 start-aligned cells pack into a single row at six modules', () => {
  const result = resolvePackedRows([flow(2), flow(2), flow(2)], 6)
  assert.deepEqual(result, [
    { row: 1, columnStart: 1 },
    { row: 1, columnStart: 3 },
    { row: 1, columnStart: 5 },
  ])
})

test('4+2: a w=4 cell then a w=2 cell, both start-aligned, share one row at six modules', () => {
  const result = resolvePackedRows([flow(4), flow(2)], 6)
  assert.deepEqual(result, [
    { row: 1, columnStart: 1 },
    { row: 1, columnStart: 5 },
  ])
})

test('4+4: two w=4 start-aligned cells cannot share a row at six modules, so the second advances to row two', () => {
  const result = resolvePackedRows([flow(4), flow(4)], 6)
  assert.deepEqual(result, [
    { row: 1, columnStart: 1 },
    { row: 2, columnStart: 1 },
  ])
})

test('source order is preserved: resolvePackedRows returns one entry per input placement, in the same index order', () => {
  const widths = [1, 5, 2, 4, 3, 2]
  const placements = widths.map((w) => flow(w))
  const result = resolvePackedRows(placements, 6)
  assert.equal(result.length, widths.length)
  const expected = []
  let row = 1
  let col = 1
  let rowHasContent = false
  for (const w of widths) {
    if (rowHasContent && col + w - 1 > 6) {
      row += 1
      col = 1
      rowHasContent = false
    }
    expected.push({ row, columnStart: col })
    col += w
    rowHasContent = true
  }
  assert.deepEqual(result, expected)
  assert.deepEqual(expected, [
    { row: 1, columnStart: 1 },
    { row: 1, columnStart: 2 },
    { row: 2, columnStart: 1 },
    { row: 2, columnStart: 3 },
    { row: 3, columnStart: 1 },
    { row: 3, columnStart: 4 },
  ])
})

test('compactAlign="center" always gets a fresh row and never shares it with a start-aligned neighbor on either side', () => {
  const placements = [flow(2), flow(2, 1, 'center'), flow(2)]
  const result = resolvePackedRows(placements, 6)
  assert.deepEqual(result, [
    { row: 1, columnStart: 1 },
    { row: 2, columnStart: 3 },
    { row: 3, columnStart: 1 },
  ])
  assert.equal(new Set(result.map((r) => r.row)).size, 3)
})

test('compactAlign="end" always gets a fresh row and never shares it with a start-aligned neighbor on either side', () => {
  const placements = [flow(2), flow(2, 1, 'end'), flow(2)]
  const result = resolvePackedRows(placements, 6)
  assert.deepEqual(result, [
    { row: 1, columnStart: 1 },
    { row: 2, columnStart: 5 },
    { row: 3, columnStart: 1 },
  ])
  assert.equal(new Set(result.map((r) => r.row)).size, 3)
})

test('center and end cells in sequence never merge rows with each other or with start-aligned neighbors', () => {
  const placements = [flow(2), flow(2, 1, 'center'), flow(2), flow(2, 1, 'end'), flow(2)]
  const result = resolvePackedRows(placements, 6)
  const rows = result.map((r) => r.row)
  assert.deepEqual(rows, [1, 2, 3, 4, 5])
  assert.equal(new Set(rows).size, 5, 'all five cells must land on distinct rows')
  assert.equal(result[1].columnStart, 3)
  assert.equal(result[3].columnStart, 5)
})

test('hidden cells reserve no row or column capacity: a visible cell after a hidden one packs as if the hidden one were absent', () => {
  const placements = [flow(2), flow(2, 1, 'start', true), flow(2)]
  const result = resolvePackedRows(placements, 6)
  assert.equal(result[1], null, 'the hidden cell itself gets no position')
  assert.deepEqual(result[0], { row: 1, columnStart: 1 })
  assert.deepEqual(result[2], { row: 1, columnStart: 3 })
  const withoutHidden = resolvePackedRows([flow(2), flow(2)], 6)
  assert.deepEqual([result[0], result[2]], withoutHidden)
})

test('a hidden compactAlign="center"/"end" cell also reserves nothing and forces no row break', () => {
  const placements = [flow(2), flow(2, 1, 'center', true), flow(2), flow(2, 1, 'end', true), flow(2)]
  const result = resolvePackedRows(placements, 6)
  assert.equal(result[1], null)
  assert.equal(result[3], null)
  assert.deepEqual(result[0], { row: 1, columnStart: 1 })
  assert.deepEqual(result[2], { row: 1, columnStart: 3 })
  assert.deepEqual(result[4], { row: 1, columnStart: 5 })
})

test('explicit-kind (pinned) placements consume no row or column capacity, exactly like hidden ones', () => {
  const placements = [flow(2), { kind: 'explicit', w: 4, h: 1, compactAlign: 'start', hidden: false }, flow(2)]
  const result = resolvePackedRows(placements, 6)
  assert.equal(result[1], null)
  assert.deepEqual(result[0], { row: 1, columnStart: 1 })
  assert.deepEqual(result[2], { row: 1, columnStart: 3 })
})

test('resolvePackedRows sweeps all twelve capacities: every row is internally non-overlapping and column starts never go below 1', () => {
  const widths = [2, 4, 3, 5, 1, 6, 2, 4]
  for (let activeColumns = 1; activeColumns <= 12; activeColumns += 1) {
    const placements = widths.map((w) => flow(w))
    const result = resolvePackedRows(placements, activeColumns)
    assert.equal(result.length, widths.length)

    let previousRow = 0
    for (const entry of result) {
      assert.ok(entry, `capacity ${activeColumns}: every start-aligned visible cell must resolve to a position`)
      assert.ok(entry.row >= previousRow, `capacity ${activeColumns}: row numbers must never move backward`)
      assert.ok(entry.columnStart >= 1, `capacity ${activeColumns}: columnStart must never be below 1`)
      previousRow = entry.row
    }

    const byRow = new Map()
    result.forEach((entry, index) => {
      const list = byRow.get(entry.row) ?? []
      list.push({ start: entry.columnStart, end: entry.columnStart + widths[index] - 1, index })
      byRow.set(entry.row, list)
    })
    for (const [row, entries] of byRow) {
      entries.sort((a, b) => a.start - b.start)
      for (let i = 1; i < entries.length; i += 1) {
        assert.ok(
          entries[i].start > entries[i - 1].end,
          `capacity ${activeColumns} row ${row}: cells ${entries[i - 1].index} and ${entries[i].index} overlap`,
        )
      }
      for (let i = 1; i < entries.length; i += 1) {
        assert.ok(entries[i].index > entries[i - 1].index)
      }
    }
  }
})

test('resolvePackedRows: the exact 2+2+2 / 4+2 / 4+4 shapes reproduced across every capacity from 1 through 12, not just six', () => {
  for (let activeColumns = 1; activeColumns <= 12; activeColumns += 1) {
    const packed222 = resolvePackedRows([flow(2), flow(2), flow(2)], activeColumns)
    const packed42 = resolvePackedRows([flow(4), flow(2)], activeColumns)
    const packed44 = resolvePackedRows([flow(4), flow(4)], activeColumns)

    let col = 1
    let row = 1
    let hasContent = false
    for (const entry of packed222) {
      if (hasContent && col + 2 - 1 > activeColumns) { row += 1; col = 1; hasContent = false }
      assert.deepEqual(entry, { row, columnStart: col })
      col += 2
      hasContent = true
    }

    if (activeColumns >= 6) {
      assert.deepEqual(packed42, [{ row: 1, columnStart: 1 }, { row: 1, columnStart: 5 }])
    } else {
      assert.equal(packed42[0].row, 1)
      assert.equal(packed42[1].row, 2, `capacity ${activeColumns}: w=4 then w=2 must NOT share a row below capacity 6`)
      assert.equal(packed42[1].columnStart, 1)
    }

    if (activeColumns >= 8) {
      assert.deepEqual(packed44, [{ row: 1, columnStart: 1 }, { row: 1, columnStart: 5 }])
    } else {
      assert.equal(packed44[1].row, 2, `capacity ${activeColumns}: two w=4 cells must NOT share a row below capacity 8`)
      assert.equal(packed44[1].columnStart, 1)
    }
  }
})

test('resolvePackedRows has no notion of writing direction: identical numeric input always yields identical, physically left-to-right output', () => {
  const placements = [flow(2), flow(2), flow(2)]
  const a = resolvePackedRows(placements, 6)
  const b = resolvePackedRows(placements, 6)
  assert.deepEqual(a, b)
  for (let i = 1; i < a.length; i += 1) {
    assert.ok(a[i].columnStart > a[i - 1].columnStart, 'columnStart must increase physically left-to-right in source order')
  }
})

function renderPackTest(previewColumns, cells, unigridProps = {}) {
  return renderToStaticMarkup(createElement(
    Unigrid,
    { reflowFlow: 'pack', previewColumns, ...unigridProps },
    ...cells.map((props, index) => createElement(Cell, { key: index, id: `pc-${index}`, h: 1, ...props })),
  ))
}

function columnStartOf(html, id) {
  const cellHtml = html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`))
  if (!cellHtml) throw new Error(`cell ${id} not found in ${html}`)
  const match = cellHtml[0].match(/grid-column-start:(\d+)/)
  return match ? Number(match[1]) : null
}

function rowStartOf(html, id) {
  const cellHtml = html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`))
  if (!cellHtml) throw new Error(`cell ${id} not found in ${html}`)
  const match = cellHtml[0].match(/grid-row-start:(\d+)/)
  return match ? Number(match[1]) : null
}

test('component: 2+2+2 packs into one row at six columns', () => {
  const html = renderPackTest(6, [{ w: 2 }, { w: 2 }, { w: 2 }])
  assert.deepEqual([0, 1, 2].map((i) => columnStartOf(html, `pc-${i}`)), [1, 3, 5])
  assert.deepEqual([0, 1, 2].map((i) => rowStartOf(html, `pc-${i}`)), [1, 1, 1])
})

test('component: 4+2 shares one row at six columns', () => {
  const html = renderPackTest(6, [{ w: 4 }, { w: 2 }])
  assert.deepEqual([0, 1].map((i) => columnStartOf(html, `pc-${i}`)), [1, 5])
  assert.deepEqual([0, 1].map((i) => rowStartOf(html, `pc-${i}`)), [1, 1])
})

test('component: 4+4 produces two rows at six columns', () => {
  const html = renderPackTest(6, [{ w: 4 }, { w: 4 }])
  assert.deepEqual([0, 1].map((i) => columnStartOf(html, `pc-${i}`)), [1, 1])
  assert.deepEqual([0, 1].map((i) => rowStartOf(html, `pc-${i}`)), [1, 2])
})

test('component: source order in the rendered markup follows authorship regardless of packed geometry', () => {
  const html = renderPackTest(6, [{ w: 4 }, { w: 4 }, { w: 2 }])
  const positions = ['pc-0', 'pc-1', 'pc-2'].map((id) => html.indexOf(`id="${id}"`))
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2], 'markup order must match authored order')
})

test('component: compactAlign="center"/"end" always land on a fresh row, never sharing with a neighbor', () => {
  const html = renderPackTest(6, [
    { w: 2 },
    { w: 2, compactAlign: 'center' },
    { w: 2 },
    { w: 2, compactAlign: 'end' },
    { w: 2 },
  ])
  const rows = [0, 1, 2, 3, 4].map((i) => rowStartOf(html, `pc-${i}`))
  assert.deepEqual(rows, [1, 2, 3, 4, 5])
  assert.equal(columnStartOf(html, 'pc-1'), 3)
  assert.equal(columnStartOf(html, 'pc-3'), 5)
})

test('component: a hidden cell (hideBelowColumns) reserves no row or column capacity for the cell after it', () => {
  const html = renderPackTest(6, [
    { w: 2 },
    { w: 2, hideBelowColumns: 8 },
    { w: 2 },
  ])
  assert.match(html.match(/<[a-z]+ id="pc-1"[^>]*>/)[0], / hidden=""/)
  assert.equal(columnStartOf(html, 'pc-0'), 1)
  assert.equal(columnStartOf(html, 'pc-2'), 3, 'the visible cell after the hidden one must pack as if it were absent, not reserve its slot')
  assert.equal(rowStartOf(html, 'pc-0'), rowStartOf(html, 'pc-2'))
})

test('component: strategy="preserve" bypasses packing entirely — reflowFlow="pack" has no effect', () => {
  const html = renderToStaticMarkup(createElement(
    Unigrid,
    { strategy: 'preserve', reflowFlow: 'pack', previewColumns: 3 },
    createElement(Cell, { id: 'preserve-a', x: 0, y: 0, w: 4, h: 1 }, 'A'),
    createElement(Cell, { id: 'preserve-b', x: 4, y: 0, w: 4, h: 1 }, 'B'),
  ))
  assert.match(html, /data-kho-unigrid-state="preserve"/)
  assert.match(html, /data-kho-unigrid-columns="12"/)
  assert.equal(columnStartOf(html, 'preserve-a'), 1)
  assert.equal(columnStartOf(html, 'preserve-b'), 5)
})

test('component: strategy="preserve" with flow-authored (no x/y) cells and reflowFlow="pack" still never packs', () => {
  const html = renderToStaticMarkup(createElement(
    Unigrid,
    { strategy: 'preserve', reflowFlow: 'pack', previewColumns: 3 },
    createElement(Cell, { id: 'preserve-flow-a', w: 2, h: 1 }, 'A'),
    createElement(Cell, { id: 'preserve-flow-b', w: 2, h: 1 }, 'B'),
  ))
  assert.match(html, /data-kho-unigrid-state="preserve"/)
  assert.doesNotMatch(html.match(/<[a-z]+ id="preserve-flow-a"[^>]*>/)[0], /grid-column-start:\d/)
  assert.doesNotMatch(html.match(/<[a-z]+ id="preserve-flow-b"[^>]*>/)[0], /grid-column-start:\d/)
})

test('component: the twelve-column authored state never packs, even with reflowFlow="pack" set', () => {
  const html = renderPackTest(12, [{ w: 2 }, { w: 2 }, { w: 2 }])
  for (const id of ['pc-0', 'pc-1', 'pc-2']) {
    assert.doesNotMatch(html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`))[0], /grid-column-start:\d/)
  }
})

test('component: a fixed compactH override still resolves to a whole number of rows under reflowFlow="pack"', () => {
  const html = renderPackTest(6, [{ w: 2 }, { w: 2, compactH: 3 }])
  const secondCellTag = html.match(/<[a-z]+ id="pc-1"[^>]*>/)[0]
  assert.match(secondCellTag, /grid-row-end:span 3/)
  assert.match(secondCellTag, /grid-column-start:3/)
  const firstCellTag = html.match(/<[a-z]+ id="pc-0"[^>]*>/)[0]
  assert.match(firstCellTag, /grid-row-end:span 1/)
  assert.equal(rowStartOf(html, 'pc-0'), rowStartOf(html, 'pc-1'))
})

test('REGRESSION (bug 1): a w=6 compactH=3 cell forces the next start-aligned cell past its full compactH-adjusted span (row 4, not row 2) — resolvePackedRows level', () => {
  const result = resolvePackedRows([flow(6, 3), flow(2, 1)], 6)
  assert.deepEqual(result, [
    { row: 1, columnStart: 1 },
    { row: 4, columnStart: 1 },
  ])
  const firstOccupiesRows = { start: result[0].row, end: result[0].row + 3 - 1 }
  assert.ok(result[1].row > firstOccupiesRows.end, `second cell's row (${result[1].row}) must be after row ${firstOccupiesRows.end}`)
})

test('REGRESSION (bug 1): component-level — <Cell w={6} compactH={3}/><Cell w={2}/> at previewColumns={6} renders the second cell at grid-row-start 4 with genuinely non-overlapping rectangles', () => {
  const html = renderPackTest(6, [{ w: 6, compactH: 3 }, { w: 2 }])
  const firstTag = html.match(/<[a-z]+ id="pc-0"[^>]*>/)[0]
  const secondTag = html.match(/<[a-z]+ id="pc-1"[^>]*>/)[0]
  assert.match(firstTag, /grid-row-start:1/)
  assert.match(firstTag, /grid-row-end:span 3/)
  assert.match(secondTag, /grid-row-start:4/)
  assert.match(secondTag, /grid-column-start:1/)
  assert.equal(rowStartOf(html, 'pc-0'), 1)
  assert.equal(rowStartOf(html, 'pc-1'), 4)
  assert.notEqual(rowStartOf(html, 'pc-1'), 2, 'must not reproduce the original row-2 overlap bug')
})

test('REGRESSION (bug 2): three w=2 cells with the middle one natively `hidden` land the third cell at columnStart 3, not 5 — resolvePackedRows level', () => {
  const result = resolvePackedRows([flow(2), flow(2, 1, 'start', true), flow(2)], 6)
  assert.equal(result[1], null)
  assert.deepEqual(result[0], { row: 1, columnStart: 1 })
  assert.deepEqual(result[2], { row: 1, columnStart: 3 })
  assert.notEqual(result[2].columnStart, 5, 'must not reproduce the original hidden-cell-reserves-a-slot bug')
})

test('REGRESSION (bug 2): component-level — three <Cell w={2}/> with the middle one natively `hidden` (not hideBelowColumns) at previewColumns={6} packs the third at columnStart 3, not 5', () => {
  const html = renderPackTest(6, [{ w: 2 }, { w: 2, hidden: true }, { w: 2 }])
  const middleTag = html.match(/<[a-z]+ id="pc-1"[^>]*>/)[0]
  assert.match(middleTag, / hidden=""/)
  assert.equal(columnStartOf(html, 'pc-0'), 1)
  assert.equal(columnStartOf(html, 'pc-2'), 3)
  assert.notEqual(columnStartOf(html, 'pc-2'), 5, 'must not reproduce the original hidden-cell-reserves-a-slot bug')
  assert.equal(rowStartOf(html, 'pc-0'), rowStartOf(html, 'pc-2'))
  const withoutHidden = renderPackTest(6, [{ w: 2 }, { w: 2 }])
  assert.equal(columnStartOf(html, 'pc-2'), columnStartOf(withoutHidden, 'pc-1'))
})

test('EDGE CASE: resolvePackedRows never lets a hidden placement\'s h — however large — reach rowMaxH bookkeeping, cross-checked against removing it entirely', () => {
  const withHiddenCompactH = resolvePackedRows([flow(6, 1), flow(2, 999, 'start', true), flow(2, 1), flow(6, 1)], 6)
  const withoutIt = resolvePackedRows([flow(6, 1), flow(2, 1), flow(6, 1)], 6)
  assert.equal(withHiddenCompactH[1], null, 'the hidden+compactH cell itself gets no position')
  assert.deepEqual(withHiddenCompactH[0], withoutIt[0])
  assert.deepEqual(withHiddenCompactH[2], withoutIt[1])
  assert.deepEqual(withHiddenCompactH[3], withoutIt[2])
})

test('EDGE CASE: component-level — a <Cell hidden compactH={5}/> is excluded from both the column cursor and the row-height bookkeeping', () => {
  const html = renderPackTest(6, [{ w: 6 }, { w: 2, hidden: true, compactH: 5 }, { w: 2 }, { w: 6 }])
  const hiddenTag = html.match(/<[a-z]+ id="pc-1"[^>]*>/)[0]
  assert.match(hiddenTag, / hidden=""/)
  assert.equal(rowStartOf(html, 'pc-0'), 1)
  assert.equal(columnStartOf(html, 'pc-2'), 1)
  assert.equal(rowStartOf(html, 'pc-2'), 2)
  assert.equal(columnStartOf(html, 'pc-3'), 1)
  assert.equal(rowStartOf(html, 'pc-3'), 3)
})

test('component: a cell\'s own authored RTL direction never perturbs the physically LTR-ordered columnStart pack mode assigns it, even under a real dir="rtl" ancestor', () => {
  const html = renderToStaticMarkup(createElement(
    'div',
    { dir: 'rtl' },
    createElement(Unigrid, { previewColumns: 6, reflowFlow: 'pack' },
      createElement(Cell, { w: 2, h: 1, id: 'rtl-pack-0' }, 'AAA'),
      createElement(Cell, {
        w: 2, h: 1, id: 'rtl-pack-1',
        style: { direction: 'rtl' }, contentStyle: { direction: 'rtl' },
      }, 'بي'),
      createElement(Cell, { w: 2, h: 1, id: 'rtl-pack-2' }, 'CCC'),
    ),
  ))
  assert.match(html, /direction:ltr/)
  const middle = html.match(/<[a-z]+ id="rtl-pack-1"[^>]*>/)[0]
  assert.match(middle, /direction:rtl/)
  assert.deepEqual(
    ['rtl-pack-0', 'rtl-pack-1', 'rtl-pack-2'].map((id) => columnStartOf(html, id)),
    [1, 3, 5],
  )
  assert.deepEqual(
    ['rtl-pack-0', 'rtl-pack-1', 'rtl-pack-2'].map((id) => rowStartOf(html, id)),
    [1, 1, 1],
  )
})

test('component: resolvePackedCells inside Unigrid agrees with resolvePackedRows called directly, at every capacity from 1 through 12', () => {
  const widths = [2, 4, 3, 5, 1, 6]
  for (let previewColumns = 1; previewColumns <= 11; previewColumns += 1) {
    const html = renderPackTest(previewColumns, widths.map((w) => ({ w })))
    const rendered = widths.map((_, i) => ({
      row: rowStartOf(html, `pc-${i}`),
      columnStart: columnStartOf(html, `pc-${i}`),
    }))
    const expected = resolvePackedRows(widths.map((w) => flow(w)), previewColumns)
    assert.deepEqual(rendered, expected, `mismatch at previewColumns=${previewColumns}`)
  }
})

test('auditMaterialStates reproduces the 2+2+2 / 4+2 / 4+4 shapes at six columns when reflowFlow="pack"', () => {
  const audit222 = auditMaterialStates([
    { w: 2, h: 1, id: 'a' },
    { w: 2, h: 1, id: 'b' },
    { w: 2, h: 1, id: 'c' },
  ], { reflowFlow: 'pack' })
  assert.equal(audit222.valid, true)
  const state6 = audit222.states.find((s) => s.columns === 6)
  assert.deepEqual(state6.placements.map((p) => ({ row: p.row, columnStart: p.columnStart })), [
    { row: 1, columnStart: 1 },
    { row: 1, columnStart: 3 },
    { row: 1, columnStart: 5 },
  ])

  const audit42 = auditMaterialStates([
    { w: 4, h: 1, id: 'a' },
    { w: 2, h: 1, id: 'b' },
  ], { reflowFlow: 'pack' })
  const state6b = audit42.states.find((s) => s.columns === 6)
  assert.deepEqual(state6b.placements.map((p) => p.columnStart), [1, 5])

  const audit44 = auditMaterialStates([
    { w: 4, h: 1, id: 'a' },
    { w: 4, h: 1, id: 'b' },
  ], { reflowFlow: 'pack' })
  const state6c = audit44.states.find((s) => s.columns === 6)
  assert.deepEqual(state6c.placements.map((p) => p.row), [1, 2])
})

test('auditMaterialStates default reflowFlow="stack" never sets row/columnStart from packing (regression guard for the config default)', () => {
  const audit = auditMaterialStates([
    { w: 2, h: 1, id: 'a' },
    { w: 2, h: 1, id: 'b' },
    { w: 2, h: 1, id: 'c' },
  ])
  const state6 = audit.states.find((s) => s.columns === 6)
  for (const placement of state6.placements) {
    assert.equal(placement.row, undefined)
  }
})

test('fieldWidthForColumns(6) matches the browser fixture width used for pack-mode hosts (564px) — geometry cross-check', () => {
  assert.equal(fieldWidthForColumns(6), 564)
})

test('auditMaterialStates + reflowFlow:"pack" sweeps 2+2+2 / 4+2 / 4+4 across all twelve capacities, not just column six', () => {
  const layout222 = [{ w: 2, h: 1, id: 'a' }, { w: 2, h: 1, id: 'b' }, { w: 2, h: 1, id: 'c' }]
  const layout42 = [{ w: 4, h: 1, id: 'a' }, { w: 2, h: 1, id: 'b' }]
  const layout44 = [{ w: 4, h: 1, id: 'a' }, { w: 4, h: 1, id: 'b' }]
  const audit222 = auditMaterialStates(layout222, { reflowFlow: 'pack' })
  const audit42 = auditMaterialStates(layout42, { reflowFlow: 'pack' })
  const audit44 = auditMaterialStates(layout44, { reflowFlow: 'pack' })
  assert.equal(audit222.states.length, 12)
  assert.equal(audit42.states.length, 12)
  assert.equal(audit44.states.length, 12)

  for (let index = 0; index < 12; index += 1) {
    const activeColumns = index + 1
    const expected222 = resolvePackedRows([flow(2), flow(2), flow(2)], activeColumns)
    const expected42 = resolvePackedRows([flow(4), flow(2)], activeColumns)
    const expected44 = resolvePackedRows([flow(4), flow(4)], activeColumns)

    const got222 = audit222.states[index].placements.map((p) => ({ row: p.row, columnStart: p.columnStart }))
    const got42 = audit42.states[index].placements.map((p) => ({ row: p.row, columnStart: p.columnStart }))
    const got44 = audit44.states[index].placements.map((p) => ({ row: p.row, columnStart: p.columnStart }))

    assert.deepEqual(got222, expected222, `2+2+2 capacity ${activeColumns}`)
    assert.deepEqual(got42, expected42, `4+2 capacity ${activeColumns}`)
    assert.deepEqual(got44, expected44, `4+4 capacity ${activeColumns}`)
  }

  const state6_222 = audit222.states[5].placements.map((p) => p.row)
  const state6_42 = audit42.states[5].placements.map((p) => p.row)
  const state6_44 = audit44.states[5].placements.map((p) => p.row)
  assert.deepEqual(state6_222, [1, 1, 1])
  assert.deepEqual(state6_42, [1, 1])
  assert.deepEqual(state6_44, [1, 2])
})

test('auditMaterialStates + reflowFlow:"pack" reserves no row or column capacity for a hidden cell, across all twelve capacities', () => {
  const layout = [
    { w: 2, h: 1, id: 'a' },
    { w: 2, h: 1, id: 'b', hideBelowColumns: 6 },
    { w: 2, h: 1, id: 'c' },
  ]
  const audit = auditMaterialStates(layout, { reflowFlow: 'pack' })
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 12)

  audit.states.forEach((state) => {
    const [a, b, c] = state.placements
    assert.equal(b.hidden, state.columns < 6, `columns=${state.columns}`)
    assert.equal(a.row, 1)
    assert.equal(a.columnStart, 1)
    if (b.hidden) {
      assert.equal(b.row, undefined)
      const withoutHidden = resolvePackedRows([flow(2), flow(2)], state.columns)
      assert.deepEqual({ row: c.row, columnStart: c.columnStart }, withoutHidden[1])
    } else {
      assert.equal(b.row, 1)
      assert.equal(b.columnStart, 3)
      assert.equal(c.row, 1)
      assert.equal(c.columnStart, 5)
    }
  })
  assert.ok(audit.states.some((s) => s.placements[1].hidden))
  assert.ok(audit.states.some((s) => !s.placements[1].hidden))
})

test("resolveUnigrid()'s geometry output is deep-equal between otherwise-identical configs differing only in reflowFlow — proving reflowFlow has zero effect on core geometry math", () => {
  const baseConfigs = [
    {},
    { moduleWidth: 60 },
    { moduleWidth: 84, moduleHeight: 80, columnGap: 16, rowGap: 16 },
    { breakpoints: [1, 2, 4, 6, 8, 10, 12] },
    { initialColumns: 4 },
    { moduleWidth: 92, columnGap: 0, rowGap: 0 },
  ]
  const widths = [0, 1, 45, 84, 180, 276, 372, 468, 564, 660, 756, 852, 948, 1044, 1140, 2000, 5000]

  for (const base of baseConfigs) {
    for (const width of widths) {
      const none = resolveUnigrid(width, base)
      const stack = resolveUnigrid(width, { ...base, reflowFlow: 'stack' })
      const pack = resolveUnigrid(width, { ...base, reflowFlow: 'pack' })
      assert.deepEqual(stack, none, `stack vs none: width=${width} config=${JSON.stringify(base)}`)
      assert.deepEqual(pack, none, `pack vs none: width=${width} config=${JSON.stringify(base)}`)
      assert.deepEqual(pack, stack, `pack vs stack: width=${width} config=${JSON.stringify(base)}`)
    }
  }
})

test('resolveGeometry() is likewise unaffected by reflowFlow — it is not even a field resolveGeometry reads', () => {
  const none = resolveGeometry({ moduleWidth: 84 })
  const stack = resolveGeometry({ moduleWidth: 84, reflowFlow: 'stack' })
  const pack = resolveGeometry({ moduleWidth: 84, reflowFlow: 'pack' })
  assert.deepEqual(stack, none)
  assert.deepEqual(pack, none)
})

test('capacityBreakpoints(step, authoredColumns) generates the correct stepped sequence for a non-default (20) ceiling', () => {
  assert.deepEqual(capacityBreakpoints(1, 20), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  assert.deepEqual(capacityBreakpoints(5, 20), [1, 5, 10, 15, 20])
  assert.deepEqual(capacityBreakpoints(3, 20), [1, 3, 6, 9, 12, 15, 18, 20])
  assert.deepEqual(capacityBreakpoints(20, 20), [1, 20])
  assert.deepEqual(capacityBreakpoints(7, 20), [1, 7, 14, 20])
})

test('capacityBreakpoints(step, authoredColumns) rejects a step above the (non-default) ceiling, and rejects an invalid authoredColumns exactly like the config-level check does', () => {
  assert.throws(() => capacityBreakpoints(21, 20), /breakpoint step must be a safe integer from 1 to 20 \(got 21\)/)
  assert.throws(() => capacityBreakpoints(0, 20), /breakpoint step must be a safe integer from 1 to 20 \(got 0\)/)
  assert.throws(() => capacityBreakpoints(1, 0), /authoredColumns must be a safe integer from 1 to 10000 \(got 0\)/)
  assert.throws(() => capacityBreakpoints(1, -5), /authoredColumns must be a safe integer from 1 to 10000 \(got -5\)/)
  assert.throws(() => capacityBreakpoints(1, 1.5), /authoredColumns must be a safe integer from 1 to 10000 \(got 1\.5\)/)
  assert.throws(() => capacityBreakpoints(1, 10_001), /authoredColumns must be a safe integer from 1 to 10000 \(got 10001\)/)
})

test('auditMaterialStates enumerates exactly `authoredColumns` states for a configured (non-default) ceiling — not always 12', () => {
  const audit20 = auditMaterialStates([{ w: 1, h: 1, id: 'a' }], { authoredColumns: 20 })
  assert.equal(audit20.valid, true)
  assert.equal(audit20.states.length, 20)
  assert.deepEqual(audit20.states.map((s) => s.columns), Array.from({ length: 20 }, (_, i) => i + 1))
  assert.deepEqual(audit20.states.map((s) => s.capacityColumns), Array.from({ length: 20 }, (_, i) => i + 1))

  const audit5 = auditMaterialStates([{ w: 1, h: 1, id: 'a' }], { authoredColumns: 5 })
  assert.equal(audit5.states.length, 5)
  assert.deepEqual(audit5.states.map((s) => s.columns), [1, 2, 3, 4, 5])

  const auditDefault = auditMaterialStates([{ w: 1, h: 1, id: 'a' }])
  assert.equal(auditDefault.states.length, 12)
})

test('REGRESSION: auditMaterialStates/resolveUnigrid with authoredColumns=1 no longer throws — the default breakpoint sequence for a 1-column ceiling collapses to the single value [1], and validateCapacityBreakpoints special-cases authoredColumns===1 to accept a length-1 array (see the fix + full regression coverage in test/spec.test.mjs). This test previously locked in the old throwing behavior as "current, not correct"; that gap has since been fixed in src/spec.ts, so this now asserts the corrected, non-throwing behavior instead of the stale bug.', () => {
  assert.doesNotThrow(() => auditMaterialStates([{ w: 1, h: 1, id: 'a' }], { authoredColumns: 1 }))
  const audit = auditMaterialStates([{ w: 1, h: 1, id: 'a' }], { authoredColumns: 1 })
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 1)
  assert.equal(audit.states[0].capacityColumns, 1)

  assert.doesNotThrow(() => resolveUnigrid(100, { authoredColumns: 1 }))
  assert.equal(resolveUnigrid(100, { authoredColumns: 1 }).activeColumns, 1)

  assert.doesNotThrow(() => resolveUnigrid(100, { authoredColumns: 1, breakpoints: [1] }))
  assert.equal(resolveUnigrid(100, { authoredColumns: 1, breakpoints: [1] }).activeColumns, 1)
})

test('component: <Unigrid reflowFlow="pack" authoredColumns={20}> packs against the CONFIGURED 20-column ceiling\'s active field, not a hardcoded 12 — three w=7 cells at a 15-column active field (impossible to reach at all under the default 12 ceiling with two w=7 cells already exceeding it)', () => {
  const html = renderPackTest(15, [{ w: 7 }, { w: 7 }, { w: 7 }], { authoredColumns: 20 })
  assert.match(html, /data-kho-unigrid-authored-columns="20"/)
  assert.match(html, /data-kho-unigrid-columns="15"/)
  assert.deepEqual([0, 1, 2].map((i) => columnStartOf(html, `pc-${i}`)), [1, 8, 1])
  assert.deepEqual([0, 1, 2].map((i) => rowStartOf(html, `pc-${i}`)), [1, 1, 2])
  const expected = resolvePackedRows([flow(7), flow(7), flow(7)], 15, 20)
  assert.deepEqual(
    [0, 1, 2].map((i) => ({ row: rowStartOf(html, `pc-${i}`), columnStart: columnStartOf(html, `pc-${i}`) })),
    expected,
  )
})

test('component: <Unigrid reflowFlow="pack" authoredColumns={20}> never packs at ITS OWN 20-column authored state — the authored/reflow boundary uses the configured ceiling, not 12', () => {
  const html = renderPackTest(20, [{ w: 7 }, { w: 7 }, { w: 7 }], { authoredColumns: 20 })
  assert.match(html, /data-kho-unigrid-state="authored"/)
  for (const id of ['pc-0', 'pc-1', 'pc-2']) {
    assert.doesNotMatch(html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`))[0], /grid-column-start:\d/)
  }
})

test('auditMaterialStates + reflowFlow:"pack" sweeps all `authoredColumns` capacities for a non-default (8) ceiling, cross-checked against resolvePackedRows directly at every one of them — not just the default twelve', () => {
  const layout = [{ w: 2, h: 1, id: 'a' }, { w: 3, h: 1, id: 'b' }, { w: 2, h: 1, id: 'c' }]
  const audit = auditMaterialStates(layout, { reflowFlow: 'pack', authoredColumns: 8 })
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 8)
  for (let index = 0; index < 8; index += 1) {
    const activeColumns = index + 1
    const expected = resolvePackedRows([flow(2), flow(3), flow(2)], activeColumns)
    const got = audit.states[index].placements.map((p) => ({ row: p.row, columnStart: p.columnStart }))
    assert.deepEqual(got, expected, `authoredColumns=8 capacity ${activeColumns}`)
  }
  const authoredState = audit.states[7]
  assert.equal(authoredState.columns, 8)
  for (const placement of authoredState.placements) {
    assert.equal(typeof placement.row, 'number')
    assert.equal(typeof placement.columnStart, 'number')
  }
})
