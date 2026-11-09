import { test, expect } from '@playwright/test'
import { fieldWidthForColumns, resolvePackedRows } from '../dist/index.js'

const MODULE_WIDTH = 84
const MODULE_HEIGHT = 80
const COLUMN_GAP = 12
const ROW_GAP = 10
const COLUMN_PITCH = MODULE_WIDTH + COLUMN_GAP
const ROW_PITCH = MODULE_HEIGHT + ROW_GAP

function installCellGeometryHelper() {
  window.__cellGeometry = (id) => {
    const element = document.getElementById(id)
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      columnStart: style.gridColumnStart,
      rowStart: style.gridRowStart,
      rowEnd: style.gridRowEnd,
    }
  }
}

async function ready(page) {
  await page.addInitScript(installCellGeometryHelper)
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
}

async function mountPack(page, hostId, cells, unigridProps = {}) {
  await page.evaluate(async ({ hostId, cells, unigridProps }) => {
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')
    const { Cell, Unigrid } = await import('@khannaoffice/unigrid')
    let host = document.getElementById(hostId)
    if (!host) {
      host = document.createElement('div')
      host.id = hostId
      host.style.maxWidth = '100%'
      document.body.appendChild(host)
    }
    await new Promise((resolve) => {
      const root = createRoot(host)
      root.render(React.createElement(
        Unigrid,
        { reflowFlow: 'pack', onMetricsChange: () => resolve(), ...unigridProps },
        ...cells.map((props, index) => React.createElement(Cell, { key: index, id: `${hostId}-${index}`, h: 1, ...props })),
      ))
    })
  }, { hostId, cells, unigridProps })
}

test('pack: 2+2+2 (three w=2 start-aligned cells) packs into one row at six modules', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-222-host')
  await expect(host.locator('.kho-unigrid')).toHaveAttribute('data-kho-unigrid-columns', '6')

  const values = await host.evaluate((element) => {
    const gridRect = element.querySelector('.kho-unigrid').getBoundingClientRect()
    return {
      grid: { x: gridRect.x, y: gridRect.y },
      a: window.__cellGeometry('pack222-a'),
      b: window.__cellGeometry('pack222-b'),
      c: window.__cellGeometry('pack222-c'),
      domOrder: Array.from(element.querySelectorAll('.kho-unigrid-cell')).map((el) => el.id),
    }
  })

  expect(values.domOrder).toEqual(['pack222-a', 'pack222-b', 'pack222-c'])

  const width = 2 * MODULE_WIDTH + 1 * COLUMN_GAP
  for (const cell of [values.a, values.b, values.c]) {
    expect(cell.width).toBe(width)
    expect(cell.y).toBeCloseTo(values.grid.y, 4)
  }
  expect(values.a.columnStart).toBe('1')
  expect(values.b.columnStart).toBe('3')
  expect(values.c.columnStart).toBe('5')
  expect(values.a.rowStart).toBe('1')
  expect(values.b.rowStart).toBe('1')
  expect(values.c.rowStart).toBe('1')

  expect(values.a.x).toBeCloseTo(values.grid.x, 4)
  expect(values.b.x).toBeCloseTo(values.grid.x + 2 * COLUMN_PITCH, 4)
  expect(values.c.x).toBeCloseTo(values.grid.x + 4 * COLUMN_PITCH, 4)
})

test('pack: 4+2 (w=4 then w=2, both start-aligned) shares one row at six modules', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-42-host')
  await expect(host.locator('.kho-unigrid')).toHaveAttribute('data-kho-unigrid-columns', '6')

  const values = await host.evaluate((element) => {
    const gridRect = element.querySelector('.kho-unigrid').getBoundingClientRect()
    return {
      grid: { x: gridRect.x, y: gridRect.y },
      a: window.__cellGeometry('pack42-a'),
      b: window.__cellGeometry('pack42-b'),
      domOrder: Array.from(element.querySelectorAll('.kho-unigrid-cell')).map((el) => el.id),
    }
  })

  expect(values.domOrder).toEqual(['pack42-a', 'pack42-b'])
  expect(values.a.width).toBe(4 * MODULE_WIDTH + 3 * COLUMN_GAP)
  expect(values.b.width).toBe(2 * MODULE_WIDTH + 1 * COLUMN_GAP)
  expect(values.a.y).toBeCloseTo(values.b.y, 4)
  expect(values.a.columnStart).toBe('1')
  expect(values.b.columnStart).toBe('5')
  expect(values.a.rowStart).toBe('1')
  expect(values.b.rowStart).toBe('1')
  expect(values.a.x).toBeCloseTo(values.grid.x, 4)
  expect(values.b.x).toBeCloseTo(values.grid.x + 4 * COLUMN_PITCH, 4)
})

test('pack: 4+4 (two w=4 start-aligned cells) produces two rows at six modules', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-44-host')
  await expect(host.locator('.kho-unigrid')).toHaveAttribute('data-kho-unigrid-columns', '6')

  const values = await host.evaluate((element) => {
    const gridRect = element.querySelector('.kho-unigrid').getBoundingClientRect()
    return {
      grid: { x: gridRect.x, y: gridRect.y },
      a: window.__cellGeometry('pack44-a'),
      b: window.__cellGeometry('pack44-b'),
      domOrder: Array.from(element.querySelectorAll('.kho-unigrid-cell')).map((el) => el.id),
    }
  })

  expect(values.domOrder).toEqual(['pack44-a', 'pack44-b'])
  expect(values.a.columnStart).toBe('1')
  expect(values.b.columnStart).toBe('1')
  expect(values.a.rowStart).toBe('1')
  expect(values.b.rowStart).toBe('2')
  expect(values.a.x).toBeCloseTo(values.grid.x, 4)
  expect(values.b.x).toBeCloseTo(values.grid.x, 4)
  expect(values.b.y).toBeCloseTo(values.a.y + ROW_PITCH, 4)
})

test('pack: compactAlign="center" and "end" cells always get a fresh row, never sharing with a neighbor on either side', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-align-host')
  await expect(host.locator('.kho-unigrid')).toHaveAttribute('data-kho-unigrid-columns', '6')

  const values = await host.evaluate(() => ({
    c0: window.__cellGeometry('pack-align-0'),
    c1: window.__cellGeometry('pack-align-1'),
    c2: window.__cellGeometry('pack-align-2'),
    c3: window.__cellGeometry('pack-align-3'),
    c4: window.__cellGeometry('pack-align-4'),
  }))

  const rows = [values.c0, values.c1, values.c2, values.c3, values.c4].map((c) => c.rowStart)
  expect(rows).toEqual(['1', '2', '3', '4', '5'])
  const distinctYs = new Set([values.c0.y, values.c1.y, values.c2.y, values.c3.y, values.c4.y].map((y) => Math.round(y)))
  expect(distinctYs.size).toBe(5)

  expect(values.c1.columnStart).toBe('3')
  expect(values.c3.columnStart).toBe('5')
  expect(values.c0.columnStart).toBe('1')
  expect(values.c2.columnStart).toBe('1')
  expect(values.c4.columnStart).toBe('1')

  expect(values.c1.y).toBeCloseTo(values.c0.y + ROW_PITCH, 4)
  expect(values.c2.y).toBeCloseTo(values.c1.y + ROW_PITCH, 4)
  expect(values.c3.y).toBeCloseTo(values.c2.y + ROW_PITCH, 4)
  expect(values.c4.y).toBeCloseTo(values.c3.y + ROW_PITCH, 4)
})

test('pack: a hidden cell (hideBelowColumns) reserves no row or column capacity — the cell after it packs as if it were absent', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-hidden-host')
  await expect(host.locator('.kho-unigrid')).toHaveAttribute('data-kho-unigrid-columns', '6')

  const values = await host.evaluate(() => {
    const b = document.getElementById('pack-hidden-b')
    return {
      a: window.__cellGeometry('pack-hidden-a'),
      bHidden: b.hidden,
      bDisplay: getComputedStyle(b).display,
      c: window.__cellGeometry('pack-hidden-c'),
    }
  })

  expect(values.bHidden).toBe(true)
  expect(values.bDisplay).toBe('none')
  expect(values.a.columnStart).toBe('1')
  expect(values.c.columnStart).toBe('3')
  expect(values.a.rowStart).toBe(values.c.rowStart)
  expect(values.c.x).toBeCloseTo(values.a.x + COLUMN_PITCH * 2, 4)
})

test('pack: a fixed compactH override still resolves to a whole number of rows, composed with a live pack columnStart', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-compacth-host')
  await expect(host.locator('.kho-unigrid')).toHaveAttribute('data-kho-unigrid-columns', '6')

  const values = await host.evaluate(() => ({
    a: window.__cellGeometry('pack-ch-a'),
    b: window.__cellGeometry('pack-ch-b'),
  }))

  expect(values.a.rowEnd).toBe('span 1')
  expect(values.b.rowEnd).toBe('span 3')
  expect(values.a.height).toBe(1 * MODULE_HEIGHT)
  expect(values.b.height).toBe(3 * MODULE_HEIGHT + 2 * ROW_GAP)
  expect(values.a.columnStart).toBe('1')
  expect(values.b.columnStart).toBe('3')
  expect(values.a.rowStart).toBe('1')
  expect(values.b.rowStart).toBe('1')
})

test('pack REGRESSION (bug 1): a w=6 cell with compactH=3 forces the next cell to a genuinely non-overlapping row 4, not row 2', async ({ page }) => {
  await ready(page)
  await mountPack(page, 'pack-regress-compacth-host', [{ w: 6, compactH: 3 }, { w: 2 }], { previewColumns: 6 })

  const values = await page.evaluate(() => ({
    a: window.__cellGeometry('pack-regress-compacth-host-0'),
    b: window.__cellGeometry('pack-regress-compacth-host-1'),
  }))

  expect(values.a.rowStart).toBe('1')
  expect(values.a.rowEnd).toBe('span 3')
  expect(values.a.height).toBe(3 * MODULE_HEIGHT + 2 * ROW_GAP)
  expect(values.b.rowStart).toBe('4')
  expect(values.b.rowStart).not.toBe('2')
  expect(values.b.columnStart).toBe('1')
  expect(values.b.y).toBeCloseTo(values.a.y + values.a.height + ROW_GAP, 4)
  expect(values.b.y).toBeCloseTo(values.a.y + 3 * ROW_PITCH, 4)
  const overlaps = !(
    values.b.x >= values.a.x + values.a.width || values.a.x >= values.b.x + values.b.width ||
    values.b.y >= values.a.y + values.a.height || values.a.y >= values.b.y + values.b.height
  )
  expect(overlaps).toBe(false)
})

test('pack REGRESSION (bug 2): a native `hidden` (not hideBelowColumns) middle cell reserves no row or column capacity — the cell after it lands at columnStart 3, not 5', async ({ page }) => {
  await ready(page)
  await mountPack(page, 'pack-regress-hidden-host', [{ w: 2 }, { w: 2, hidden: true }, { w: 2 }], { previewColumns: 6 })

  const values = await page.evaluate(() => {
    const b = document.getElementById('pack-regress-hidden-host-1')
    return {
      a: window.__cellGeometry('pack-regress-hidden-host-0'),
      bHidden: b.hidden,
      bDisplay: getComputedStyle(b).display,
      c: window.__cellGeometry('pack-regress-hidden-host-2'),
    }
  })

  expect(values.bHidden).toBe(true)
  expect(values.bDisplay).toBe('none')
  expect(values.a.columnStart).toBe('1')
  expect(values.c.columnStart).toBe('3')
  expect(values.c.columnStart).not.toBe('5')
  expect(values.a.rowStart).toBe(values.c.rowStart)
  expect(values.c.x).toBeCloseTo(values.a.x + COLUMN_PITCH * 2, 4)
})

test('pack EDGE CASE: a cell that is both natively hidden and has a compactH override is excluded from both the column cursor and row-height bookkeeping', async ({ page }) => {
  await ready(page)
  await mountPack(
    page,
    'pack-regress-hidden-compacth-host',
    [{ w: 6 }, { w: 2, hidden: true, compactH: 5 }, { w: 2 }, { w: 6 }],
    { previewColumns: 6 },
  )

  const values = await page.evaluate(() => {
    const b = document.getElementById('pack-regress-hidden-compacth-host-1')
    return {
      a: window.__cellGeometry('pack-regress-hidden-compacth-host-0'),
      bHidden: b.hidden,
      c: window.__cellGeometry('pack-regress-hidden-compacth-host-2'),
      d: window.__cellGeometry('pack-regress-hidden-compacth-host-3'),
    }
  })

  expect(values.bHidden).toBe(true)
  expect(values.a.rowStart).toBe('1')
  expect(values.c.columnStart).toBe('1')
  expect(values.c.rowStart).toBe('2')
  expect(values.d.columnStart).toBe('1')
  expect(values.d.rowStart).toBe('3')
  expect(values.c.y).toBeCloseTo(values.a.y + ROW_PITCH, 4)
  expect(values.d.y).toBeCloseTo(values.c.y + ROW_PITCH, 4)
})

test('pack: strategy="preserve" bypasses packing entirely even with reflowFlow="pack" set', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-preserve-host')
  await page.waitForFunction(() => document.getElementById('pack-preserve-host').dataset.columns === '12')

  const values = await host.evaluate(() => ({
    state: document.querySelector('#pack-preserve-host .kho-unigrid').dataset.khoUnigridState,
    a: window.__cellGeometry('pack-preserve-a'),
    b: window.__cellGeometry('pack-preserve-b'),
  }))

  expect(values.state).toBe('preserve')
  expect(values.a.columnStart).toBe('1')
  expect(values.b.columnStart).toBe('5')
  expect(values.a.rowStart).toBe('1')
  expect(values.b.rowStart).toBe('1')
})

test('pack: a live resize across the 4+4 packing boundary re-packs the row assignment in both directions', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-resize-host')
  await page.waitForFunction(() => document.getElementById('pack-resize-host').dataset.columns === '9')

  const readState = () => host.evaluate(() => ({
    a: window.__cellGeometry('pack-resize-a'),
    b: window.__cellGeometry('pack-resize-b'),
  }))

  const wide = await readState()
  expect(wide.a.rowStart).toBe('1')
  expect(wide.b.rowStart).toBe('1')
  expect(wide.b.columnStart).toBe('5')
  expect(wide.b.y).toBeCloseTo(wide.a.y, 4)

  await host.evaluate((element) => { element.style.width = `${6 * 84 + 5 * 12}px` })
  await page.waitForFunction(() => document.getElementById('pack-resize-host').dataset.columns === '6')

  const narrow = await readState()
  expect(narrow.a.rowStart).toBe('1')
  expect(narrow.b.rowStart).toBe('2')
  expect(narrow.b.columnStart).toBe('1')
  expect(narrow.b.y).toBeCloseTo(narrow.a.y + ROW_PITCH, 4)

  await host.evaluate((element) => { element.style.width = '852px' })
  await page.waitForFunction(() => document.getElementById('pack-resize-host').dataset.columns === '9')

  const restored = await readState()
  expect(restored.a.rowStart).toBe('1')
  expect(restored.b.rowStart).toBe('1')
  expect(restored.b.columnStart).toBe('5')
  expect(restored.b.y).toBeCloseTo(restored.a.y, 4)
})

test('pack: resize-driven live re-pack matches resolvePackedRows at every capacity from 1 through 11 (12 is the authored state, pack never applies there)', async ({ page }) => {
  await ready(page)
  const host = page.locator('#pack-sweep-host')
  const ids = ['pack-sweep-0', 'pack-sweep-1', 'pack-sweep-2', 'pack-sweep-3', 'pack-sweep-4', 'pack-sweep-5', 'pack-sweep-6', 'pack-sweep-7']
  const widths = [2, 4, 3, 5, 1, 6, 2, 4]
  const placements = widths.map((w) => ({ kind: 'flow', w, h: 1, compactAlign: 'start', hidden: false }))

  await page.waitForFunction(() => document.getElementById('pack-sweep-host').dataset.columns === '12')

  for (let activeColumns = 1; activeColumns <= 11; activeColumns += 1) {
    const targetWidth = fieldWidthForColumns(activeColumns)
    await host.evaluate((element, width) => { element.style.width = `${width}px` }, targetWidth)
    await page.waitForFunction(
      (columns) => document.getElementById('pack-sweep-host').dataset.columns === String(columns),
      activeColumns,
    )

    const expected = resolvePackedRows(placements, activeColumns)

    const rendered = await host.evaluate((element, cellIds) => {
      const gridRect = element.querySelector('.kho-unigrid').getBoundingClientRect()
      return cellIds.map((id) => {
        const cell = document.getElementById(id)
        const rect = cell.getBoundingClientRect()
        const style = getComputedStyle(cell)
        return {
          columnStart: Number(style.gridColumnStart),
          rowStart: Number(style.gridRowStart),
          xOffset: rect.x - gridRect.x,
          yOffset: rect.y - gridRect.y,
        }
      })
    }, ids)

    rendered.forEach((cell, index) => {
      const expectedCell = expected[index]
      expect(expectedCell, `capacity ${activeColumns} cell ${index} should not be null`).not.toBeNull()
      expect(cell.columnStart, `capacity ${activeColumns} cell ${index} columnStart`).toBe(expectedCell.columnStart)
      expect(cell.rowStart, `capacity ${activeColumns} cell ${index} rowStart`).toBe(expectedCell.row)
      expect(cell.xOffset, `capacity ${activeColumns} cell ${index} x pixel offset`).toBeCloseTo(
        (expectedCell.columnStart - 1) * COLUMN_PITCH, 4,
      )
      expect(cell.yOffset, `capacity ${activeColumns} cell ${index} y pixel offset`).toBeCloseTo(
        (expectedCell.row - 1) * ROW_PITCH, 4,
      )
    })
  }
})

test('pack: an actual dir="rtl" ancestor with authored RTL content does not reverse the physical left-to-right pack order', async ({ page }) => {
  await ready(page)
  const values = await page.evaluate(() => {
    const ancestor = document.getElementById('rtl-ancestor')
    const grid = document.querySelector('#pack-rtl-host .kho-unigrid')
    const gridRect = grid.getBoundingClientRect()
    return {
      ancestorDir: ancestor.getAttribute('dir'),
      gridDirection: getComputedStyle(grid).direction,
      grid: { x: gridRect.x, y: gridRect.y },
      c0: window.__cellGeometry('pack-rtl-0'),
      c1: window.__cellGeometry('pack-rtl-1'),
      c2: window.__cellGeometry('pack-rtl-2'),
      c0Direction: getComputedStyle(document.getElementById('pack-rtl-0')).direction,
    }
  })

  expect(values.ancestorDir).toBe('rtl')
  expect(values.gridDirection).toBe('ltr')
  expect(values.c0Direction).toBe('rtl')

  expect(values.c0.columnStart).toBe('1')
  expect(values.c1.columnStart).toBe('3')
  expect(values.c2.columnStart).toBe('5')
  expect(values.c0.rowStart).toBe('1')
  expect(values.c1.rowStart).toBe('1')
  expect(values.c2.rowStart).toBe('1')

  expect(values.c0.x).toBeCloseTo(values.grid.x, 4)
  expect(values.c1.x).toBeCloseTo(values.grid.x + 2 * COLUMN_PITCH, 4)
  expect(values.c2.x).toBeCloseTo(values.grid.x + 4 * COLUMN_PITCH, 4)
  expect(values.c1.x).toBeGreaterThan(values.c0.x)
  expect(values.c2.x).toBeGreaterThan(values.c1.x)
})
