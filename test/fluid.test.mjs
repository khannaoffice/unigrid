import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  AUTHORED_COLUMNS,
  Cell,
  FLUID_COLUMNS,
  MAX_AUTHORED_COLUMNS,
  Unigrid,
  anyPlacementOverflowsField,
  auditMaterialStates,
  breakpointWidths,
  capacityBreakpoints,
  fieldWidthForColumns,
  isFluidColumns,
  resolveEffectiveHeight,
  resolvePackedRows,
  resolveResponsivePlacement,
  resolveUnigrid,
  responsiveWidths,
} from '../dist/index.js'

const NPS = { moduleWidth: 84, moduleHeight: 80, columnGap: 12, rowGap: 10 }
const FLUID = { ...NPS, authoredColumns: FLUID_COLUMNS }

function sweepWidths(config, throughColumns = 60) {
  const widths = new Set()
  for (let columns = 1; columns <= throughColumns; columns += 1) {
    const exact = fieldWidthForColumns(columns, config)
    widths.add(exact - 1)
    widths.add(exact)
    widths.add(exact + 1)
  }
  for (const width of [1, 2, 100, 320, 390, 768, 1024, 1280, 1440, 1512, 1920, 2560, 3440, 3840, 7680]) widths.add(width)
  return [...widths].filter((width) => width > 0).sort((a, b) => a - b)
}

const flowCell = (w, h) => ({ w, h })
const explicitCell = (x, y, w, h) => ({ x, y, w, h })

test('MODE STABILITY: a fluid composition reports the same semantic model at every width from 1px to 8K', () => {
  const states = new Set()
  for (const width of sweepWidths(FLUID)) {
    states.add(resolveUnigrid(width, FLUID).materialState)
  }
  assert.deepEqual([...states], ['fluid'], 'width must never change a fluid composition\'s model')
})

test('MODE STABILITY: every cell in a fluid composition resolves to the same kind at every capacity', () => {
  const kinds = new Set()
  const compactedFlags = new Set()
  for (let active = 1; active <= 120; active += 1) {
    for (const cell of [flowCell(1, 1), flowCell(4, 3), flowCell(7, 5), flowCell(40, 2)]) {
      const resolved = resolveResponsivePlacement(cell, active, 'reflow', 'auto', 'reflow', 'start', FLUID_COLUMNS)
      kinds.add(resolved.kind)
      compactedFlags.add(resolved.compacted)
    }
  }
  assert.deepEqual([...kinds], ['flow'])
  assert.deepEqual([...compactedFlags], [false])
})

test('MODE STABILITY: an authored composition changes model at exactly one documented threshold and nowhere else', () => {
  const config = { ...NPS, authoredColumns: 12 }
  const transitions = []
  const widths = sweepWidths(FLUID, 20)
  let previous = null
  for (const width of widths) {
    const { materialState, activeColumns } = resolveUnigrid(width, config)
    if (previous != null && previous.materialState !== materialState) {
      transitions.push({ width, from: previous.materialState, to: materialState, activeColumns })
    }
    previous = { materialState, activeColumns }
  }
  assert.equal(transitions.length, 1, `expected exactly one mode transition, got ${JSON.stringify(transitions)}`)
  const [transition] = transitions
  assert.deepEqual({ from: transition.from, to: transition.to }, { from: 'reflow', to: 'authored' })
  assert.equal(transition.activeColumns, 12)
  assert.equal(resolveUnigrid(fieldWidthForColumns(12, config), config).materialState, 'authored')
  assert.equal(resolveUnigrid(fieldWidthForColumns(12, config) - 1, config).materialState, 'reflow')
})

test('REGRESSION: the pre-9.0.0 workaround is no longer required — a fluid field needs no fake ceiling', () => {
  const hack = { ...NPS, authoredColumns: 200 }
  for (const active of [4, 13, 20]) {
    const resolved = resolveResponsivePlacement(explicitCell(4, 0, 4, 2), active, 'reflow', 'auto', 'reflow', 'start', 200)
    assert.equal(resolved.kind, 'flow', 'authored coordinates still collapse under a fake ceiling')
    assert.equal(resolved.compacted, true)
  }
  assert.equal(resolveUnigrid(3840, hack).capacityColumns, 40)
  assert.equal(resolveUnigrid(3840, FLUID).capacityColumns, 40)
  assert.equal(resolveUnigrid(3840, FLUID).materialState, 'fluid')
})

test('activeColumns < authoredColumns: authored composition reflows, span never clamped', () => {
  const config = { ...NPS, authoredColumns: 12 }
  const metrics = resolveUnigrid(fieldWidthForColumns(5, config), config)
  assert.equal(metrics.activeColumns, 5)
  assert.equal(metrics.materialState, 'reflow')
  const resolved = resolveResponsivePlacement(explicitCell(8, 0, 4, 2), 5, 'reflow', 'auto', 'reflow', 'start', 12)
  assert.equal(resolved.kind, 'flow')
  assert.equal(resolved.w, 4, 'span is preserved, never shrunk to fit')
})

test('activeColumns === authoredColumns: authored coordinates are honoured whole', () => {
  const resolved = resolveResponsivePlacement(explicitCell(8, 2, 4, 3), 12, 'reflow', 'auto', 'reflow', 'start', 12)
  assert.equal(resolved.kind, 'explicit')
  assert.deepEqual({ x: resolved.x, y: resolved.y, w: resolved.w, h: resolved.h }, { x: 8, y: 2, w: 4, h: 3 })
  assert.equal(resolved.compacted, false)
})

test('activeColumns > authoredColumns is unreachable for an authored composition, and normal for a fluid one', () => {
  const config = { ...NPS, authoredColumns: 12 }
  const wide = resolveUnigrid(7680, config)
  assert.equal(wide.capacityColumns, 12)
  assert.equal(wide.activeColumns, 12)
  assert.ok(wide.residualInlineSpace > 0)
  const fluidWide = resolveUnigrid(7680, FLUID)
  assert.equal(fluidWide.capacityColumns, Math.floor((7680 + 12) / 96))
  assert.ok(fluidWide.capacityColumns > 12)
})

test('very small material: 1 through 4 columns resolve exactly, in both models', () => {
  for (const columns of [1, 2, 3, 4]) {
    const width = fieldWidthForColumns(columns, NPS)
    assert.equal(resolveUnigrid(width, FLUID).activeColumns, columns)
    assert.equal(resolveUnigrid(width, { ...NPS, authoredColumns: 12 }).activeColumns, columns)
    assert.equal(resolveUnigrid(width - 1, FLUID).activeColumns, Math.max(1, columns - 1))
  }
})

test('a fluid field never resolves below one module or above the sanity bound', () => {
  assert.equal(resolveUnigrid(1, FLUID).activeColumns, 1)
  assert.equal(resolveUnigrid(0, FLUID).activeColumns, 1)
  const absurd = resolveUnigrid(MAX_AUTHORED_COLUMNS * 1000, FLUID)
  assert.equal(absurd.activeColumns, MAX_AUTHORED_COLUMNS)
})

test('NPS geometry: the documented capacity ladder is exact', () => {
  const expected = [[390, 4], [768, 8], [1024, 10], [1280, 13], [1512, 15], [1920, 20], [2560, 26], [3840, 40]]
  for (const [width, columns] of expected) {
    assert.equal(resolveUnigrid(width, FLUID).capacityColumns, columns, `${width}px`)
    assert.equal(fieldWidthForColumns(columns, FLUID), columns * 84 + (columns - 1) * 12)
  }
})

test('flow cells (w/h only) are legal in both models', () => {
  assert.equal(resolveResponsivePlacement(flowCell(4, 3), 6, 'reflow', 'auto', 'reflow', 'start', 12).kind, 'flow')
  assert.equal(resolveResponsivePlacement(flowCell(4, 3), 6, 'reflow', 'auto', 'reflow', 'start', FLUID_COLUMNS).kind, 'flow')
})

test('explicit cells are rejected by the fluid model at author time, not discarded at runtime', () => {
  assert.throws(
    () => resolveResponsivePlacement(explicitCell(0, 0, 2, 2), 6, 'reflow', 'auto', 'reflow', 'start', FLUID_COLUMNS),
    /x\/y coordinates cannot be used with authoredColumns: "fluid"/,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, FLUID, createElement(Cell, { x: 0, y: 0, w: 2, h: 2 }, 'x'))),
    /x\/y coordinates cannot be used with authoredColumns: "fluid"/,
  )
})

test('options defined relative to an authored state are rejected under fluid, individually', () => {
  const cases = [
    [{ w: 2, h: 2, compactW: 1 }, /compactW cannot be used with authoredColumns: "fluid"/],
    [{ w: 2, h: 2, compactBehavior: 'overflow' }, /compactBehavior cannot be used with authoredColumns: "fluid"/],
  ]
  for (const [props, pattern] of cases) {
    assert.throws(() => renderToStaticMarkup(createElement(Unigrid, FLUID, createElement(Cell, props, 'x'))), pattern)
  }
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { ...FLUID, breakpoints: [1, 6, 12] }, createElement(Cell, { w: 1, h: 1 }))),
    /breakpoints cannot be used with authoredColumns: "fluid"/,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { ...FLUID, strategy: 'preserve' }, createElement(Cell, { w: 1, h: 1 }))),
    /strategy="preserve" cannot be combined with authoredColumns="fluid"/,
  )
})

test('compactH is rejected under fluid, by presence rather than by value', () => {
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, FLUID, createElement(Cell, { w: 2, h: 3, compactH: 5 }, 'x'))),
    /compactH cannot be used with authoredColumns: "fluid"/,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, FLUID, createElement(Cell, { w: 2, h: 3, compactH: 'auto' }, 'x'))),
    /compactH cannot be used with authoredColumns: "fluid"/,
  )
})

test('an omitted compactH is not mistaken for an authored one', () => {
  const markup = renderToStaticMarkup(createElement(Unigrid, { ...FLUID, initialColumns: 8 },
    createElement(Cell, { w: 2, h: 3 }, 'x')))
  assert.match(markup, /data-kho-unigrid-state="fluid"/)
  assert.match(markup, /span 3/)
})

test('compactH behaviour under a numeric authored composition is unchanged', () => {
  assert.equal(resolveEffectiveHeight(3, true, 5), 5)
  assert.equal(resolveEffectiveHeight(3, false, 5), 3)
  assert.equal(resolveEffectiveHeight(3, true, 'auto'), 3)
  assert.equal(resolveEffectiveHeight(3, true, undefined), 3)
  const authoredMarkup = renderToStaticMarkup(createElement(Unigrid, { ...NPS, authoredColumns: 12, previewColumns: 4 },
    createElement(Cell, { w: 2, h: 3, compactH: 5 }, 'x')))
  assert.match(authoredMarkup, /span 5/)
})

test('pack-mode row bookkeeping matches the rendered cell height in both models', () => {
  const fluidMarkup = renderToStaticMarkup(createElement(Unigrid, { ...FLUID, reflowFlow: 'pack', initialColumns: 6 },
    createElement(Cell, { w: 3, h: 2 }, 'a'),
    createElement(Cell, { w: 3, h: 2 }, 'b')))
  assert.match(fluidMarkup, /data-kho-unigrid-state="fluid"/)
  const authoredMarkup = renderToStaticMarkup(createElement(Unigrid, { ...NPS, authoredColumns: 12, reflowFlow: 'pack', previewColumns: 6 },
    createElement(Cell, { w: 3, h: 2, compactH: 4 }, 'a'),
    createElement(Cell, { w: 3, h: 2 }, 'b')))
  assert.match(authoredMarkup, /span 4/)
})

test('PUBLIC HELPERS: every exported API that can see fluid+preserve rejects it consistently', () => {
  const pattern = /strategy "preserve" cannot be used with authoredColumns: "fluid"/
  assert.throws(
    () => resolveResponsivePlacement(flowCell(2, 2), 4, 'preserve', 'auto', 'reflow', 'start', FLUID_COLUMNS),
    pattern,
  )
  assert.throws(
    () => anyPlacementOverflowsField([flowCell(2, 2)], 4, 'preserve', FLUID_COLUMNS),
    pattern,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { ...FLUID, strategy: 'preserve' }, createElement(Cell, { w: 1, h: 1 }))),
    /strategy="preserve" cannot be combined with authoredColumns="fluid"/,
  )
  assert.equal(anyPlacementOverflowsField([flowCell(2, 2)], 4, 'reflow', FLUID_COLUMNS), false)
  assert.equal(anyPlacementOverflowsField([flowCell(40, 2)], 4, 'reflow', FLUID_COLUMNS), true)
  assert.equal(anyPlacementOverflowsField([flowCell(2, 2)], 4, 'preserve', 12), false)
})

test('a cell that authors none of the rejected options renders cleanly under fluid', () => {
  const markup = renderToStaticMarkup(createElement(Unigrid, FLUID,
    createElement(Cell, { w: 4, h: 3 }, 'a'),
    createElement(Cell, { w: 2, h: 2, compactAlign: 'center' }, 'b'),
    createElement(Cell, { w: 2, h: 2, hideBelowColumns: 6 }, 'c')))
  assert.match(markup, /data-kho-unigrid-state="fluid"/)
})

test('hideBelowColumns and compactAlign survive into the fluid model, and are capacity-relative', () => {
  const hidden = resolveResponsivePlacement({ w: 2, h: 2, hideBelowColumns: 6 }, 5, 'reflow', 'auto', 'reflow', 'start', FLUID_COLUMNS)
  assert.equal(hidden.hidden, true)
  const shown = resolveResponsivePlacement({ w: 2, h: 2, hideBelowColumns: 6 }, 6, 'reflow', 'auto', 'reflow', 'start', FLUID_COLUMNS)
  assert.equal(shown.hidden, false)
  const wide = resolveResponsivePlacement({ w: 2, h: 2, hideBelowColumns: 30 }, 40, 'reflow', 'auto', 'reflow', 'start', FLUID_COLUMNS)
  assert.equal(wide.hidden, false)
  const centered = resolveResponsivePlacement({ w: 4, h: 2 }, 12, 'reflow', 'auto', 'reflow', 'center', FLUID_COLUMNS)
  assert.equal(centered.columnStart, 5)
  const end = resolveResponsivePlacement({ w: 4, h: 2 }, 12, 'reflow', 'auto', 'reflow', 'end', FLUID_COLUMNS)
  assert.equal(end.columnStart, 9)
})

test('pack applies at every fluid capacity — no width-dependent packing discontinuity', () => {
  const cells = [flowCell(4, 3), flowCell(7, 5), flowCell(2, 2)]
  for (let active = 1; active <= 60; active += 1) {
    const packable = cells.map((cell) => ({ kind: 'flow', w: cell.w, h: cell.h, compactAlign: 'start', hidden: false }))
    const packed = resolvePackedRows(packable, active, FLUID_COLUMNS)
    assert.equal(packed.length, cells.length)
    for (const position of packed) {
      assert.ok(position, 'every visible flow cell must be positioned at every capacity')
      assert.ok(position.columnStart >= 1)
    }
  }
})

test('pack: rows fill left-to-right and never exceed the active field', () => {
  const spans = [4, 7, 2, 3, 6]
  for (const active of [4, 13, 20, 40]) {
    const packable = spans.map((w) => ({ kind: 'flow', w, h: 1, compactAlign: 'start', hidden: false }))
    const packed = resolvePackedRows(packable, active, FLUID_COLUMNS)
    const byRow = new Map()
    packed.forEach((position, index) => {
      const list = byRow.get(position.row) ?? []
      list.push({ start: position.columnStart, w: spans[index], index })
      byRow.set(position.row, list)
    })
    for (const [row, entries] of byRow) {
      entries.sort((a, b) => a.start - b.start)
      for (let i = 1; i < entries.length; i += 1) {
        assert.ok(entries[i].start >= entries[i - 1].start + entries[i - 1].w, `row ${row} cells overlap at active=${active}`)
      }
      if (entries.length > 1) {
        const last = entries[entries.length - 1]
        assert.ok(last.start + last.w - 1 <= active, `row ${row} exceeds ${active} columns`)
      }
    }
  }
})

test('pack under fluid is deterministic and source-ordered', () => {
  const packable = [3, 3, 3, 3].map((w) => ({ kind: 'flow', w, h: 1, compactAlign: 'start', hidden: false }))
  const first = resolvePackedRows(packable, 9, FLUID_COLUMNS)
  const second = resolvePackedRows(packable, 9, FLUID_COLUMNS)
  assert.deepEqual(first, second)
  assert.deepEqual(first.map((position) => position.row), [1, 1, 1, 2])
  assert.deepEqual(first.map((position) => position.columnStart), [1, 4, 7, 1])
})

test('stack under fluid gives every cell its own row at every capacity', () => {
  const markup = renderToStaticMarkup(createElement(Unigrid, { ...FLUID, initialColumns: 20 },
    createElement(Cell, { w: 2, h: 1 }, 'a'),
    createElement(Cell, { w: 2, h: 1 }, 'b')))
  assert.match(markup, /data-kho-unigrid-state="fluid"/)
  assert.doesNotMatch(markup, /data-kho-unigrid-packed/)
})

test('oversized cells overflow the fluid field rather than shrinking into it', () => {
  const resolved = resolveResponsivePlacement(flowCell(40, 2), 4, 'reflow', 'auto', 'reflow', 'start', FLUID_COLUMNS)
  assert.equal(resolved.w, 40, 'span is never clamped to capacity')
  assert.equal(resolved.columnStart, 1, 'and never starts outside the grid')
  const centered = resolveResponsivePlacement({ w: 40, h: 2, compactAlign: 'center' }, 4, 'reflow', 'auto', 'reflow', 'center', FLUID_COLUMNS)
  assert.equal(centered.columnStart, 1, 'centering an overflowing span must not push it past the leading edge')
})

test('resize transitions are monotonic: capacity never decreases as width increases', () => {
  let previous = 0
  for (const width of sweepWidths(FLUID)) {
    const { capacityColumns } = resolveUnigrid(width, FLUID)
    assert.ok(capacityColumns >= previous, `capacity fell from ${previous} to ${capacityColumns} at ${width}px`)
    previous = capacityColumns
  }
})

test('resize transitions land exactly on complete-module thresholds', () => {
  for (let columns = 2; columns <= 40; columns += 1) {
    const threshold = fieldWidthForColumns(columns, FLUID)
    assert.equal(resolveUnigrid(threshold, FLUID).capacityColumns, columns)
    assert.equal(resolveUnigrid(threshold - 1, FLUID).capacityColumns, columns - 1)
  }
})

test('a resize that crosses many thresholds never passes through a different layout model', () => {
  const seen = new Set()
  for (let width = 100; width <= 4000; width += 7) {
    seen.add(resolveUnigrid(width, FLUID).materialState)
  }
  assert.deepEqual([...seen], ['fluid'])
})

test('SSR: a fluid composition renders without measurement and honours initialColumns', () => {
  const markup = renderToStaticMarkup(createElement(Unigrid, { ...FLUID, initialColumns: 15 },
    createElement(Cell, { w: 4, h: 3 }, 'a')))
  assert.match(markup, /data-kho-unigrid-columns="15"/)
  assert.match(markup, /data-kho-unigrid-state="fluid"/)
})

test('SSR: initialColumns above the old ceiling is legal under fluid and rejected under authored', () => {
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(Unigrid, { ...FLUID, initialColumns: 40 }, createElement(Cell, { w: 1, h: 1 }))))
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { ...NPS, authoredColumns: 12, initialColumns: 40 }, createElement(Cell, { w: 1, h: 1 }))),
    /initialColumns must be a safe integer from 1 to 12/,
  )
})

test('SSR: the breakpoints data attribute is absent under fluid, present under authored', () => {
  const fluidMarkup = renderToStaticMarkup(createElement(Unigrid, FLUID, createElement(Cell, { w: 1, h: 1 })))
  const authoredMarkup = renderToStaticMarkup(createElement(Unigrid, { ...NPS, authoredColumns: 12 }, createElement(Cell, { w: 1, h: 1 })))
  assert.doesNotMatch(fluidMarkup, /data-kho-unigrid-breakpoints/)
  assert.match(authoredMarkup, /data-kho-unigrid-breakpoints="1,2,3,4,5,6,7,8,9,10,11,12"/)
})

test('previewColumns forces any capacity a fluid field can reach', () => {
  for (const columns of [1, 4, 40]) {
    const markup = renderToStaticMarkup(createElement(Unigrid, { ...FLUID, previewColumns: columns }, createElement(Cell, { w: 1, h: 1 })))
    assert.match(markup, new RegExp(`data-kho-unigrid-columns="${columns}"`))
  }
})

test('auditMaterialStates requires an explicit bound under fluid rather than guessing one', () => {
  assert.throws(
    () => auditMaterialStates([flowCell(2, 2)], FLUID),
    /needs an explicit throughColumns bound/,
  )
  const audit = auditMaterialStates([flowCell(2, 2), flowCell(3, 1)], FLUID, 40)
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 40)
  assert.equal(audit.states.at(-1).columns, 40)
  for (const state of audit.states) {
    for (const placement of state.placements) assert.equal(placement.kind, 'flow')
  }
})

test('auditMaterialStates keeps its existing signature and behaviour for authored compositions', () => {
  const layout = [explicitCell(0, 0, 8, 2), explicitCell(8, 0, 4, 2)]
  const audit = auditMaterialStates(layout, { ...NPS, authoredColumns: 12 })
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 12)
  assert.throws(
    () => auditMaterialStates(layout, { ...NPS, authoredColumns: 12 }, 20),
    /exceeds authoredColumns/,
  )
})

test('collision detection still rejects overlapping explicit cells in the authored model', () => {
  const audit = auditMaterialStates([explicitCell(0, 0, 6, 2), explicitCell(3, 0, 6, 2)], { ...NPS, authoredColumns: 12 })
  assert.equal(audit.valid, false)
  assert.ok(audit.issues.some((issue) => issue.code === 'overlap'))
})

test('source-order violations are still rejected in the authored model', () => {
  const audit = auditMaterialStates([explicitCell(8, 2, 4, 2), explicitCell(0, 0, 4, 2)], { ...NPS, authoredColumns: 12 })
  assert.equal(audit.valid, false)
  assert.ok(audit.issues.some((issue) => issue.code === 'source-order'))
})

test('enumerating helpers refuse the fluid model instead of returning a truncated answer', () => {
  assert.throws(() => responsiveWidths(FLUID), /the sequence is unbounded/)
  assert.throws(() => breakpointWidths(FLUID), /has none/)
  assert.throws(() => capacityBreakpoints(2, FLUID_COLUMNS), /A fluid composition needs no breakpoints/)
})

test('isFluidColumns is the supported predicate, and the default model is unchanged', () => {
  assert.equal(isFluidColumns(FLUID_COLUMNS), true)
  assert.equal(isFluidColumns(12), false)
  assert.equal(isFluidColumns(undefined), false)
  assert.equal(AUTHORED_COLUMNS, 12)
  assert.equal(resolveUnigrid(1140, {}).materialState, 'authored')
  assert.equal(resolveUnigrid(1140, {}).authoredColumns, 12)
})

test('a fluid composition reports no authored field width, because it has none', () => {
  const metrics = resolveUnigrid(1512, FLUID)
  assert.equal(metrics.authoredFieldWidth, null)
  assert.equal(metrics.breakpoints, null)
  assert.equal(metrics.authoredColumns, FLUID_COLUMNS)
  assert.equal(metrics.fieldWidth, fieldWidthForColumns(metrics.activeColumns, FLUID))
})
