import { test, expect } from '@playwright/test'

async function waitForHostColumns(page, hostId, columns) {
  await page.waitForFunction(
    ({ hostId, columns }) => document.getElementById(hostId)?.dataset.columns === String(columns),
    { hostId, columns },
  )
}

test.describe('authoredColumns (per-instance authored-column ceiling)', () => {
  test('authoredColumns=20 authors more than twelve columns and scales field width to the new ceiling at a wide real viewport', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1300 })
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    await waitForHostColumns(page, 'wide-authored-host', 20)

    const values = await page.evaluate(() => {
      const host = document.getElementById('wide-authored-host')
      const grid = host.querySelector('.kho-unigrid')
      const guide = host.querySelector('.kho-unigrid-guide')
      const full = document.getElementById('wide-cell-full')
      const beyond = document.getElementById('wide-cell-beyond12')
      const compact = document.getElementById('wide-cell-compact')
      return {
        authoredColumns: grid.dataset.khoUnigridAuthoredColumns,
        columns: grid.dataset.khoUnigridColumns,
        capacity: grid.dataset.khoUnigridCapacity,
        state: grid.dataset.khoUnigridState,
        fieldWidth: Number(grid.dataset.khoUnigridFieldWidth),
        breakpoints: grid.dataset.khoUnigridBreakpoints,
        guideColumns: guide ? guide.dataset.khoUnigridGuideColumns : null,
        full: { width: full.getBoundingClientRect().width, columnStart: getComputedStyle(full).gridColumnStart },
        beyond: { width: beyond.getBoundingClientRect().width, columnStart: getComputedStyle(beyond).gridColumnStart, hidden: beyond.hidden },
        compact: { width: compact.getBoundingClientRect().width, columnStart: getComputedStyle(compact).gridColumnStart },
      }
    })

    expect(values.authoredColumns).toBe('20')
    expect(values.columns).toBe('20')
    expect(values.capacity).toBe('20')
    expect(values.state).toBe('authored')
    expect(values.fieldWidth).toBe(20 * 84 + 19 * 12)
    expect(values.breakpoints).toBe(Array.from({ length: 20 }, (_, i) => i + 1).join(','))
    expect(values.guideColumns).toBe('20')

    expect(values.full.width).toBe(20 * 84 + 19 * 12)
    expect(values.full.columnStart).toBe('1')

    expect(values.beyond.hidden).toBe(false)
    expect(values.beyond.width).toBe(4 * 84 + 3 * 12)
    expect(values.beyond.columnStart).toBe('17')

    expect(values.compact.width).toBe(6 * 84 + 5 * 12)
    expect(values.compact.columnStart).toBe('1')
  })

  test('authoredColumns=20 still resolves capacity/reflow/compactW correctly below its ceiling on a live resize', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1300 })
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    await waitForHostColumns(page, 'wide-authored-host', 20)

    await page.locator('#wide-authored-host').evaluate((host) => { host.style.width = '660px' })
    await waitForHostColumns(page, 'wide-authored-host', 7)

    const values = await page.evaluate(() => {
      const host = document.getElementById('wide-authored-host')
      const grid = host.querySelector('.kho-unigrid')
      const full = document.getElementById('wide-cell-full')
      const beyond = document.getElementById('wide-cell-beyond12')
      const compact = document.getElementById('wide-cell-compact')
      return {
        columns: grid.dataset.khoUnigridColumns,
        capacity: grid.dataset.khoUnigridCapacity,
        state: grid.dataset.khoUnigridState,
        full: {
          width: full.getBoundingClientRect().width,
          columnStart: getComputedStyle(full).gridColumnStart,
          kind: full.dataset.khoUnigridCell,
        },
        beyond: { width: beyond.getBoundingClientRect().width, columnStart: getComputedStyle(beyond).gridColumnStart },
        compact: { width: compact.getBoundingClientRect().width, columnStart: getComputedStyle(compact).gridColumnStart },
      }
    })

    expect(values.columns).toBe('7')
    expect(values.capacity).toBe('7')
    expect(values.state).toBe('reflow')

    expect(values.full.kind).toBe('reflow')
    expect(values.full.columnStart).toBe('1')
    expect(values.full.width).toBe(20 * 84 + 19 * 12)

    expect(values.beyond.columnStart).toBe('1')
    expect(values.beyond.width).toBe(4 * 84 + 3 * 12)

    expect(values.compact.columnStart).toBe('1')
    expect(values.compact.width).toBe(3 * 84 + 2 * 12)
  })

  test('raw capacity past a 20-column ceiling still clamps to 20 — the ceiling is a real bound, not an unlimited one', async ({ page }) => {
    await page.setViewportSize({ width: 3200, height: 1300 })
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    await waitForHostColumns(page, 'wide-authored-host', 20)

    await page.locator('#wide-authored-host').evaluate((host) => { host.style.width = '3000px' })
    await waitForHostColumns(page, 'wide-authored-host', 20)

    const values = await page.evaluate(() => {
      const grid = document.querySelector('#wide-authored-host .kho-unigrid')
      return {
        columns: grid.dataset.khoUnigridColumns,
        capacity: grid.dataset.khoUnigridCapacity,
        fieldWidth: Number(grid.dataset.khoUnigridFieldWidth),
      }
    })

    expect(values.columns).toBe('20')
    expect(values.capacity).toBe('20')
    expect(values.fieldWidth).toBe(20 * 84 + 19 * 12)
  })

  test('the default (no authoredColumns prop) case is unaffected — existing fixture hosts stay pixel-identical', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    await page.waitForFunction(() => document.documentElement.dataset.capacity === '12')

    const values = await page.evaluate(() => {
      const resizeGrid = document.querySelector('#resize-host .kho-unigrid')
      const main = document.getElementById('main-cell').getBoundingClientRect()
      const aside = document.getElementById('aside-cell').getBoundingClientRect()
      const strictGrid = document.querySelector('#strict-host .kho-unigrid')
      const strictCell = document.getElementById('strict-cell').getBoundingClientRect()
      const invariant = document.getElementById('invariant-image-cell').getBoundingClientRect()
      return {
        resizeAuthoredColumns: resizeGrid.dataset.khoUnigridAuthoredColumns,
        resizeModuleWidth: Number(resizeGrid.dataset.khoUnigridModuleWidth),
        resizeModuleHeight: Number(resizeGrid.dataset.khoUnigridModuleHeight),
        resizeColumnGap: Number(resizeGrid.dataset.khoUnigridColumnGap),
        resizeRowGap: Number(resizeGrid.dataset.khoUnigridRowGap),
        mainWidth: main.width,
        asideWidth: aside.width,
        strictAuthoredColumns: strictGrid.dataset.khoUnigridAuthoredColumns,
        strictCellWidth: strictCell.width,
        invariantWidth: invariant.width,
        invariantColumnStart: getComputedStyle(document.getElementById('invariant-image-cell')).gridColumnStart,
      }
    })

    expect(values.resizeAuthoredColumns).toBe('12')
    expect(values.resizeModuleWidth).toBe(84)
    expect(values.resizeModuleHeight).toBe(80)
    expect(values.resizeColumnGap).toBe(12)
    expect(values.resizeRowGap).toBe(10)
    expect(values.mainWidth).toBe(8 * 84 + 7 * 12)
    expect(values.asideWidth).toBe(4 * 84 + 3 * 12)

    expect(values.strictAuthoredColumns).toBe('12')
    expect(values.strictCellWidth).toBe(12 * 84 + 11 * 16)
    expect(values.invariantWidth).toBe(4 * 84 + 3 * 16)
    expect(values.invariantColumnStart).toBe('5')
  })
})
