import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUTHORED_COLUMNS,
  auditMaterialStates,
  WEB_TEMPLATE_SPEC,
  capacityBreakpoints,
  configForAuthoredFieldWidth,
  fieldWidthForColumns,
  isHiddenAtCapacity,
  layoutExtent,
  placementsOverlap,
  resolveCapacityBreakpoint,
  resolveCompactSpan,
  resolveGeometry,
  resolveResponsivePlacement,
  resolveUnigrid,
  responsiveWidths,
  rowsForContentHeight,
  unigridRect,
  validateCapacityBreakpoints,
  validateCompactWidth,
  validateLayout,
  validatePlacement,
  validateUnigridConfig,
} from '../dist/index.js'

function close(actual, expected, tolerance = 1e-8) { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`) }

const MAX_AUTHORED_COLUMNS = 10_000

test('fixed template geometry yields twelve modules at 1140px', () => {
  const metrics = resolveUnigrid(1140)
  assert.equal(metrics.activeColumns, 12)
  assert.equal(metrics.authoredColumns, 12)
  assert.equal(metrics.moduleWidth, 84)
  assert.equal(metrics.moduleHeight, 80)
  assert.equal(metrics.columnGap, 12)
  assert.equal(metrics.rowGap, 10)
  assert.equal(metrics.fieldWidth, 1140)
  assert.equal(metrics.materialState, 'authored')
})

test('module geometry is constant while material capacity changes', () => {
  const widths = [320, 390, 600, 900, 1140, 2000]
  const results = widths.map((width) => resolveUnigrid(width))
  assert.deepEqual(results.map((m) => m.activeColumns), [3, 4, 6, 9, 12, 12])
  for (const metrics of results) {
    assert.equal(metrics.moduleWidth, 84)
    assert.equal(metrics.moduleHeight, 80)
    assert.equal(metrics.columnGap, 12)
    assert.equal(metrics.rowGap, 10)
  }
})

test('one module-width adjustment scales the default geometry proportionally', () => {
  const metrics = resolveUnigrid(1000, { moduleWidth: 168 })
  assert.equal(metrics.moduleWidth, 168)
  assert.equal(metrics.moduleHeight, 160)
  assert.equal(metrics.columnGap, 24)
  assert.equal(metrics.rowGap, 20)
})

test('a chosen twelve-module desktop field can be converted once into invariant geometry', () => {
  const geometry = configForAuthoredFieldWidth(1140)
  close(geometry.moduleWidth, 84)
  close(geometry.moduleHeight, 80)
  close(geometry.columnGap, 12)
  close(geometry.rowGap, 10)
  const wider = configForAuthoredFieldWidth(1440)
  close(fieldWidthForColumns(12, wider), 1440)
  const desktop = resolveUnigrid(1440, wider)
  const phone = resolveUnigrid(390, wider)
  close(desktop.moduleWidth, phone.moduleWidth)
  close(desktop.moduleHeight, phone.moduleHeight)
})

test('capacity thresholds are complete and breakpoint-free', () => {
  const widths = responsiveWidths()
  assert.equal(widths.length, AUTHORED_COLUMNS)
  for (let columns = 1; columns <= AUTHORED_COLUMNS; columns += 1) {
    assert.equal(widths[columns - 1], fieldWidthForColumns(columns))
    assert.equal(resolveUnigrid(widths[columns - 1]).activeColumns, columns)
    if (columns > 1) assert.equal(resolveUnigrid(widths[columns - 1] - 0.01).activeColumns, columns - 1)
  }
})

test('authoredColumns defaults to 12: every existing composition resolves byte-identically whether the config omits it or sets it to 12 explicitly', () => {
  assert.deepEqual(resolveGeometry({}), resolveGeometry({ authoredColumns: 12 }))
  for (const width of [0, 1, 320, 390, 600, 900, 1140, 1140.5, 2000, 100_000]) {
    assert.deepEqual(resolveUnigrid(width), resolveUnigrid(width, { authoredColumns: 12 }))
  }
  assert.deepEqual(responsiveWidths(), responsiveWidths({ authoredColumns: 12 }))
  assert.deepEqual(capacityBreakpoints(), capacityBreakpoints(1, 12))
  const layout = [
    { x: 0, y: 0, w: 8, h: 2, id: 'main' },
    { x: 8, y: 0, w: 4, h: 2, compactW: 2, id: 'aside', hideBelowColumns: 6 },
  ]
  assert.deepEqual(auditMaterialStates(layout), auditMaterialStates(layout, { authoredColumns: 12 }))
})

test('authoredColumns configures a non-default ceiling: capacity, breakpoints, and authored state resolve relative to it instead of a hardcoded 12', () => {
  const geometry = resolveGeometry({ authoredColumns: 20 })
  assert.equal(geometry.authoredColumns, 20)
  close(geometry.authoredFieldWidth, 20 * 84 + 19 * 12)

  const widths = responsiveWidths({ authoredColumns: 20 })
  assert.equal(widths.length, 20)
  for (let columns = 1; columns <= 20; columns += 1) {
    assert.equal(widths[columns - 1], fieldWidthForColumns(columns, { authoredColumns: 20 }))
    const metrics = resolveUnigrid(widths[columns - 1], { authoredColumns: 20 })
    assert.equal(metrics.activeColumns, columns)
    assert.equal(metrics.authoredColumns, 20)
    assert.equal(metrics.materialState, columns === 20 ? 'authored' : 'reflow')
    if (columns > 1) assert.equal(resolveUnigrid(widths[columns - 1] - 0.01, { authoredColumns: 20 }).activeColumns, columns - 1)
  }
  const ultrawide = resolveUnigrid(widths[19] * 10, { authoredColumns: 20 })
  assert.equal(ultrawide.activeColumns, 20)
  assert.equal(ultrawide.capacityColumns, 20)
  assert.equal(ultrawide.materialState, 'authored')
  assert.equal(resolveGeometry({ authoredColumns: 3 }).authoredColumns, 3)
  assert.equal(resolveUnigrid(fieldWidthForColumns(3, { authoredColumns: 3 }), { authoredColumns: 3 }).activeColumns, 3)
  assert.equal(resolveUnigrid(10_000, { authoredColumns: 3 }).activeColumns, 3)
})

test('capacityBreakpoints(step, authoredColumns) generates the correct stepped sequence for a non-default ceiling', () => {
  assert.deepEqual(capacityBreakpoints(5, 20), [1, 5, 10, 15, 20])
  assert.deepEqual(capacityBreakpoints(1, 20), Array.from({ length: 20 }, (_, index) => index + 1))
  assert.deepEqual(capacityBreakpoints(7, 20), [1, 7, 14, 20])
  assert.deepEqual(capacityBreakpoints(2), [1, 2, 4, 6, 8, 10, 12])
  assert.deepEqual(
    Array.from({ length: 20 }, (_, index) => resolveCapacityBreakpoint(index + 1, capacityBreakpoints(5, 20), 20)),
    [1, 1, 1, 1, 5, 5, 5, 5, 5, 10, 10, 10, 10, 10, 15, 15, 15, 15, 15, 20],
  )
})

test('auditMaterialStates enumerates exactly the configured authoredColumns states, not always twelve', () => {
  const layout = [{ x: 0, y: 0, w: 20, h: 2, id: 'wide' }]
  const audit20 = auditMaterialStates(layout, { authoredColumns: 20 })
  assert.equal(audit20.valid, true)
  assert.equal(audit20.states.length, 20)
  assert.deepEqual(audit20.states.map((state) => state.capacityColumns), Array.from({ length: 20 }, (_, index) => index + 1))
  assert.equal(audit20.states[19].placements[0].kind, 'explicit')
  assert.equal(audit20.states[19].placements[0].w, 20)

  const audit5 = auditMaterialStates([{ x: 0, y: 0, w: 5, h: 1 }], { authoredColumns: 5 })
  assert.equal(audit5.states.length, 5)
  assert.deepEqual(audit5.states.map((state) => state.columns), [1, 2, 3, 4, 5])

  assert.equal(auditMaterialStates([{ x: 0, y: 0, w: 1, h: 1 }]).states.length, 12)
})

test('authoredColumns validation rejects zero, negative, non-integer, and absurdly large values, and accepts the sanity boundary', () => {
  for (const bad of [0, -1, -12, 1.5, -1.5, NaN, Infinity, -Infinity, 10_001, 1_000_000, '12', true, [], {}]) {
    assert.notDeepEqual(validateUnigridConfig({ authoredColumns: bad }), [], `authoredColumns ${JSON.stringify(bad)} should be rejected`)
    assert.throws(() => resolveUnigrid(100, { authoredColumns: bad }), `resolveUnigrid should throw for authoredColumns ${JSON.stringify(bad)}`)
  }
  assert.deepEqual(validateUnigridConfig({ authoredColumns: 2 }), [])
  assert.equal(resolveUnigrid(100, { authoredColumns: 2 }).authoredColumns, 2)
  assert.deepEqual(validateUnigridConfig({ authoredColumns: 10_000 }), [])
  assert.deepEqual(validateUnigridConfig({ authoredColumns: 20 }), [])
  assert.deepEqual(validateUnigridConfig({ authoredColumns: null }), [])
  assert.equal(resolveUnigrid(100, { authoredColumns: null }).authoredColumns, 12)
})

test('authoredColumns=1 no longer throws from resolveUnigrid, auditMaterialStates, or SSR render — regression for the fixed single-column-ceiling breakpoints bug', () => {
  assert.deepEqual(validateUnigridConfig({ authoredColumns: 1 }), [])

  const metrics = resolveUnigrid(100, { authoredColumns: 1 })
  assert.equal(metrics.authoredColumns, 1)
  assert.equal(metrics.capacityColumns, 1)
  assert.equal(metrics.activeColumns, 1)
  assert.deepEqual(metrics.breakpoints, [1])

  assert.equal(resolveUnigrid(0, { authoredColumns: 1 }).activeColumns, 1)
  assert.equal(resolveUnigrid(1_000_000, { authoredColumns: 1 }).activeColumns, 1)

  assert.deepEqual(validateCapacityBreakpoints([1], 1), [])
  assert.doesNotThrow(() => resolveUnigrid(100, { authoredColumns: 1, breakpoints: [1] }))
  assert.equal(resolveUnigrid(100, { authoredColumns: 1, breakpoints: [1] }).activeColumns, 1)

  const audit = auditMaterialStates([{ x: 0, y: 0, w: 1, h: 1, id: 'a' }], { authoredColumns: 1 })
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 1)
  assert.equal(audit.states[0].capacityColumns, 1)
  assert.equal(audit.states[0].columns, 1)
})

test('breakpoints validation still requires length >= 2 for every authoredColumns >= 2 — the length-1 relaxation is scoped to authoredColumns=1 only', () => {
  for (const authoredColumns of [2, 3, 5, 12, 20, 5000, MAX_AUTHORED_COLUMNS]) {
    const issues = validateCapacityBreakpoints([1], authoredColumns)
    assert.notDeepEqual(issues, [], `breakpoints:[1] should still be rejected at authoredColumns=${authoredColumns}`)
    assert.match(issues[0].message, /breakpoints must include at least the 1- and .+-column states/)
    assert.throws(
      () => resolveUnigrid(100, { authoredColumns, breakpoints: [1] }),
      `resolveUnigrid should still throw for breakpoints:[1] at authoredColumns=${authoredColumns}`,
    )
  }
  assert.deepEqual(validateCapacityBreakpoints([1, 5], 5), [])
})

test('auditMaterialStates at a large authoredColumns ceiling completes in well under the O(N^2) regression range', () => {
  const layout = [{ x: 0, y: 0, w: 1, h: 1, id: 'a' }]
  auditMaterialStates(layout, { authoredColumns: MAX_AUTHORED_COLUMNS })

  const start = performance.now()
  const audit = auditMaterialStates(layout, { authoredColumns: MAX_AUTHORED_COLUMNS })
  const elapsedMs = performance.now() - start

  assert.equal(audit.states.length, MAX_AUTHORED_COLUMNS)
  assert.ok(
    elapsedMs < 500,
    `auditMaterialStates(authoredColumns=${MAX_AUTHORED_COLUMNS}) took ${elapsedMs.toFixed(2)}ms, ` +
    'expected well under 500ms; a large regression here means resolveUnigrid/resolveCapacityBreakpoint ' +
    'went back to doing O(N) work (linear scan and/or full re-validation) per column inside this O(N)-column loop',
  )
})

test('initialColumns and breakpoints validate against the CONFIGURED ceiling, not a hardcoded 12', () => {
  assert.deepEqual(validateUnigridConfig({ authoredColumns: 20, initialColumns: 15 }), [])
  assert.notDeepEqual(validateUnigridConfig({ initialColumns: 15 }), [])
  assert.notDeepEqual(validateUnigridConfig({ authoredColumns: 20, initialColumns: 21 }), [])
  assert.deepEqual(validateUnigridConfig({ authoredColumns: 20, breakpoints: [1, 5, 10, 15, 20] }), [])
  assert.notDeepEqual(validateUnigridConfig({ breakpoints: [1, 5, 10, 15, 20] }), [])
})

test('compactW and hideBelowColumns validation is ceiling-aware: 15 is illegal under the default (12) ceiling but legal once a wider ceiling (20) is actually supplied', () => {
  assert.notDeepEqual(validateCompactWidth(15), [])
  assert.deepEqual(validateCompactWidth(12), [])
  assert.deepEqual(validateCompactWidth(15, 20), [])
  assert.deepEqual(validateCompactWidth(20, 20), [])
  assert.notDeepEqual(validateCompactWidth(21, 20), [])

  assert.notDeepEqual(validatePlacement({ w: 20, h: 1, hideBelowColumns: 15 }), [])
  assert.deepEqual(validatePlacement({ w: 20, h: 1, hideBelowColumns: 12 }), [])
  assert.deepEqual(validatePlacement({ w: 20, h: 1, hideBelowColumns: 15 }, 20), [])
  assert.notDeepEqual(validatePlacement({ w: 20, h: 1, hideBelowColumns: 21 }, 20), [])

  assert.throws(
    () => resolveResponsivePlacement({ x: 0, y: 0, w: 20, h: 1, compactW: 15 }, 10, 'reflow', 'auto', 'reflow', 'start'),
    /compactW must be "auto" or a safe integer from 1 to 12/,
  )
  assert.doesNotThrow(
    () => resolveResponsivePlacement({ x: 0, y: 0, w: 20, h: 1, compactW: 15 }, 10, 'reflow', 'auto', 'reflow', 'start', 20),
  )

  assert.deepEqual(validateLayout([{ x: 0, y: 0, w: 1, h: 1, hideBelowColumns: 15 }], { authoredColumns: 20 }), [])
  assert.notDeepEqual(validateLayout([{ x: 0, y: 0, w: 1, h: 1, hideBelowColumns: 15 }]), [])

  const auditCompactW = auditMaterialStates([{ x: 0, y: 0, w: 20, h: 1, compactW: 15 }], { authoredColumns: 20 })
  assert.equal(auditCompactW.valid, true)
  assert.equal(auditCompactW.states[19].placements.length, 1)
  const auditHideBelow = auditMaterialStates([{ x: 0, y: 0, w: 20, h: 1, hideBelowColumns: 15 }], { authoredColumns: 20 })
  assert.equal(auditHideBelow.valid, true)
  assert.equal(auditHideBelow.states[19].placements.length, 1)

  const auditCompactWDefault = auditMaterialStates([{ x: 0, y: 0, w: 1, h: 1, compactW: 15 }])
  assert.equal(auditCompactWDefault.valid, false)
  const auditHideBelowDefault = auditMaterialStates([{ x: 0, y: 0, w: 1, h: 1, hideBelowColumns: 15 }])
  assert.equal(auditHideBelowDefault.valid, false)
  const auditCompactWNarrower = auditMaterialStates([{ x: 0, y: 0, w: 1, h: 1, compactW: 15 }], { authoredColumns: 14 })
  assert.equal(auditCompactWNarrower.valid, false)

  const auditOk = auditMaterialStates([{ x: 0, y: 0, w: 20, h: 1, compactW: 10, hideBelowColumns: 6 }], { authoredColumns: 20 })
  assert.equal(auditOk.valid, true)
})

test('desktop placements become source-order flow when fewer modules fit, span never clamped', () => {
  const authored = resolveUnigrid(1140)
  const mobile = resolveUnigrid(320)
  assert.deepEqual(resolveResponsivePlacement({ x: 8, y: 2, w: 4, h: 5 }, authored.activeColumns), {
    kind: 'explicit', x: 8, y: 2, w: 4, h: 5, id: undefined, authoredKind: 'explicit', authoredW: 4, compacted: false, hidden: false,
  })
  assert.equal(mobile.activeColumns, 3)
  assert.deepEqual(resolveResponsivePlacement({ x: 8, y: 2, w: 4, h: 5 }, mobile.activeColumns), {
    kind: 'flow', w: 4, h: 5, id: undefined, columnStart: 1, authoredKind: 'explicit', authoredW: 4, compacted: true, hidden: false,
  })
})

test('compactBehavior="overflow" pins authored coordinates instead of joining flow', () => {
  const mobile = resolveUnigrid(320)
  const pinned = resolveResponsivePlacement(
    { x: 8, y: 2, w: 4, h: 5, compactBehavior: 'overflow' },
    mobile.activeColumns,
  )
  assert.deepEqual(pinned, {
    kind: 'explicit', x: 8, y: 2, w: 4, h: 5, id: undefined, authoredKind: 'explicit', authoredW: 4, compacted: false, hidden: false,
  })
  const noCoords = resolveResponsivePlacement({ w: 5, h: 1, compactBehavior: 'overflow' }, mobile.activeColumns)
  assert.equal(noCoords.kind, 'flow')
  assert.equal(noCoords.w, 5)
})

test('compact widths preserve fixed spans and are never clamped to capacity', () => {
  assert.equal(resolveCompactSpan(2), 2)
  assert.equal(resolveCompactSpan(8), 8)
  assert.equal(resolveCompactSpan(2, 6), 6)
  assert.equal(resolveCompactSpan(8, 4), 4)
  assert.throws(() => resolveCompactSpan(8, 'full'), /removed in the canonical geometry model/)
})

test('material audit enumerates all twelve possible capacities from one layout, never shrinking a span', () => {
  const layout = [
    { x: 0, y: 0, w: 8, h: 2, id: 'main' },
    { x: 8, y: 0, w: 4, h: 2, id: 'aside' },
  ]
  const audit = auditMaterialStates(layout)
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 12)
  assert.equal(audit.states[2].columns, 3)
  assert.deepEqual(audit.states[2].placements.map((p) => p.w), [8, 4])
  assert.equal(audit.states[11].placements[0].kind, 'explicit')
})

test('material audit applies each cell compact-width policy, never clamping the override either', () => {
  const audit = auditMaterialStates([
    { x: 0, y: 0, w: 8, h: 2, id: 'main' },
    { x: 8, y: 0, w: 4, h: 2, compactW: 2, id: 'aside' },
  ])
  assert.equal(audit.valid, true)
  assert.deepEqual(audit.states[2].placements.map((placement) => placement.w), [8, 2])
  assert.deepEqual(audit.states[5].placements.map((placement) => placement.w), [8, 2])
})

test('resolveResponsivePlacement resolves span and columnStart at every capacity from 1 through 12, never clamping the span', () => {
  for (let activeColumns = 1; activeColumns <= 12; activeColumns += 1) {
    for (const authoredW of [1, activeColumns, 12]) {
      const explicit = resolveResponsivePlacement({ x: 0, y: 0, w: authoredW, h: 1 }, activeColumns)
      if (activeColumns === 12) {
        assert.deepEqual(explicit, {
          kind: 'explicit', x: 0, y: 0, w: authoredW, h: 1, id: undefined, authoredKind: 'explicit', authoredW, compacted: false, hidden: false,
        })
        continue
      }
      assert.equal(explicit.kind, 'flow')
      assert.equal(explicit.w, authoredW, `span must stay ${authoredW} at capacity ${activeColumns}, never clamped`)
      assert.equal(explicit.columnStart, 1)

      for (const [align, expectedColumnStart] of [
        ['center', Math.max(1, Math.floor((activeColumns - authoredW) / 2) + 1)],
        ['end', Math.max(1, activeColumns - authoredW + 1)],
      ]) {
        const aligned = resolveResponsivePlacement({ w: authoredW, h: 1, compactAlign: align }, activeColumns)
        assert.equal(aligned.kind, 'flow')
        assert.equal(aligned.w, authoredW)
        assert.equal(aligned.columnStart, expectedColumnStart)
        assert.ok(aligned.columnStart >= 1, `columnStart must never resolve below 1 (capacity=${activeColumns}, w=${authoredW}, align=${align})`)
      }
    }
  }
})

test('auditMaterialStates never shrinks a span at any of the twelve capacities', () => {
  const audit = auditMaterialStates([
    { x: 0, y: 0, w: 8, h: 2, id: 'main' },
    { x: 8, y: 0, w: 4, h: 2, compactW: 2, id: 'aside' },
  ])
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 12)
  for (let index = 0; index < 12; index += 1) {
    const activeColumns = index + 1
    const state = audit.states[index]
    assert.equal(state.capacityColumns, activeColumns)
    assert.equal(state.columns, activeColumns)
    if (activeColumns === 12) {
      assert.deepEqual(state.placements.map((placement) => placement.w), [8, 4])
    } else {
      assert.deepEqual(state.placements.map((placement) => placement.w), [8, 2])
    }
  }
})

test('auditMaterialStates.placements[*].hidden agrees with isHiddenAtCapacity directly, across all twelve states', () => {
  const layout = [
    { x: 0, y: 0, w: 8, h: 2, id: 'main' },
    { x: 8, y: 0, w: 4, h: 2, id: 'aside', hideBelowColumns: 6 },
    { w: 2, h: 1, id: 'badge', hideBelowColumns: 3 },
  ]
  const audit = auditMaterialStates(layout)
  assert.equal(audit.valid, true)
  assert.equal(audit.states.length, 12)
  for (const state of audit.states) {
    assert.equal(state.placements.length, layout.length)
    layout.forEach((placement, index) => {
      const expected = isHiddenAtCapacity(placement.hideBelowColumns, state.columns)
      assert.equal(
        state.placements[index].hidden,
        expected,
        `columns=${state.columns} placement ${index} (${placement.id}) expected hidden=${expected}`,
      )
    })
  }
  assert.ok(audit.states.every((state) => state.placements[0].hidden === false))
  assert.deepEqual(audit.states.filter((s) => s.placements[1].hidden).map((s) => s.columns), [1, 2, 3, 4, 5])
  assert.deepEqual(audit.states.filter((s) => s.placements[2].hidden).map((s) => s.columns), [1, 2])
  assert.equal(audit.states[0].placements.length, 3)
})

test('compactW is silently ignored whenever a cell is pinned by compactBehavior="overflow"', () => {
  const mobile = resolveUnigrid(320)
  const pinned = resolveResponsivePlacement(
    { x: 8, y: 2, w: 4, h: 5, compactW: 2, compactBehavior: 'overflow' },
    mobile.activeColumns,
  )
  assert.deepEqual(pinned, {
    kind: 'explicit', x: 8, y: 2, w: 4, h: 5, id: undefined, authoredKind: 'explicit', authoredW: 4, compacted: false, hidden: false,
  })
})

test('content height resolves to whole module rows', () => {
  assert.equal(rowsForContentHeight(1, 87, 9), 1)
  assert.equal(rowsForContentHeight(87, 87, 9), 1)
  assert.equal(rowsForContentHeight(88, 87, 9), 2)
  assert.equal(rowsForContentHeight(183, 87, 9), 2)
  assert.equal(rowsForContentHeight(184, 87, 9), 3)
})

test('configuration is twelve-column invariant and rejects malformed values', () => {
  for (const config of [{ moduleWidth: 0 }, { moduleHeight: -1 }, { columnGap: -1 }, { rowGap: Infinity }, { initialColumns: 0 }, { initialColumns: 13 }]) {
    assert.notDeepEqual(validateUnigridConfig(config), [])
  }
})

test('horizontal authored field is bounded while rows remain unlimited', () => {
  assert.deepEqual(validateLayout([{ x: 0, y: 1_000_000, w: 12, h: 50_000 }], { columnBoundary: 12 }), [])
  assert.ok(validateLayout([{ x: 11, y: 0, w: 2, h: 1 }], { columnBoundary: 12 }).some((i) => i.code === 'outside-columns'))
  assert.deepEqual(layoutExtent([{ x: 0, y: 1_000_000, w: 12, h: 50_000 }]), { columns: 12, rows: 1_050_000 })
})

test('responsive source order can be audited without viewport breakpoints', () => {
  assert.deepEqual(validateLayout([
    { x: 0, y: 0, w: 8, h: 2 },
    { x: 8, y: 0, w: 4, h: 2 },
    { x: 0, y: 2, w: 12, h: 2 },
  ], { columnBoundary: 12, requireResponsiveSourceOrder: true }), [])
  assert.ok(validateLayout([
    { x: 8, y: 0, w: 4, h: 2 },
    { x: 0, y: 0, w: 8, h: 2 },
  ], { columnBoundary: 12, requireResponsiveSourceOrder: true }).some((i) => i.code === 'source-order'))
})

test('placement, overlap, and rectangle math remain deterministic', () => {
  assert.deepEqual(validatePlacement({ w: 4, h: 3 }), [])
  assert.equal(placementsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 0, w: 4, h: 4 }), false)
  assert.equal(placementsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 3, y: 3, w: 4, h: 4 }), true)
  const rect = unigridRect({ x: 8, y: 20, w: 4, h: 3 }, resolveUnigrid(1140))
  close(rect.left, 8 * 96)
  close(rect.top, 20 * 90)
  close(rect.right, 1140)
})
