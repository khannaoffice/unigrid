import { test, expect } from '@playwright/test'

async function waitForCapacity(page, columns) {
  await page.waitForFunction((value) => document.documentElement.dataset.capacity === String(value), columns)
}

test('actual React package keeps module geometry fixed while material capacity changes', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  await waitForCapacity(page, 12)

  const desktop = await page.locator('.kho-unigrid').first().evaluate((grid) => {
    const host = document.getElementById('resize-host').getBoundingClientRect()
    const main = document.getElementById('main-cell').getBoundingClientRect()
    const aside = document.getElementById('aside-cell').getBoundingClientRect()
    return {
      host,
      main,
      aside,
      columns: grid.dataset.khoUnigridColumns,
      moduleWidth: grid.dataset.khoUnigridModuleWidth,
      moduleHeight: grid.dataset.khoUnigridModuleHeight,
      columnGap: grid.dataset.khoUnigridColumnGap,
      rowGap: grid.dataset.khoUnigridRowGap,
    }
  })
  expect(desktop.columns).toBe('12')
  expect(Number(desktop.moduleWidth)).toBe(84)
  expect(Number(desktop.moduleHeight)).toBe(80)
  expect(Number(desktop.columnGap)).toBe(12)
  expect(Number(desktop.rowGap)).toBe(10)
  expect(desktop.main.width).toBe(8 * 84 + 7 * 12)
  expect(desktop.aside.width).toBe(4 * 84 + 3 * 12)

  await page.locator('#resize-host').evaluate((host) => { host.style.width = '390px' })
  await waitForCapacity(page, 4)

  const phone = await page.locator('.kho-unigrid').first().evaluate((grid) => {
    const host = document.getElementById('resize-host').getBoundingClientRect()
    const main = document.getElementById('main-cell').getBoundingClientRect()
    const aside = document.getElementById('aside-cell').getBoundingClientRect()
    return {
      host,
      main,
      aside,
      columns: grid.dataset.khoUnigridColumns,
      moduleWidth: grid.dataset.khoUnigridModuleWidth,
      moduleHeight: grid.dataset.khoUnigridModuleHeight,
      mainSpan: document.getElementById('main-cell').dataset.khoUnigridW,
      asideSpan: document.getElementById('aside-cell').dataset.khoUnigridW,
      mainPlacement: getComputedStyle(document.getElementById('main-cell')).gridColumnStart,
      asidePlacement: getComputedStyle(document.getElementById('aside-cell')).gridColumnStart,
    }
  })
  expect(phone.columns).toBe('4')
  expect(Number(phone.moduleWidth)).toBe(84)
  expect(Number(phone.moduleHeight)).toBe(80)
  expect(phone.mainSpan).toBe('8')
  expect(phone.asideSpan).toBe('4')
  expect(phone.main.width).toBe(8 * 84 + 7 * 12)
  expect(phone.aside.width).toBe(4 * 84 + 3 * 12)
  expect(phone.mainPlacement).toBe('1')
  expect(phone.asidePlacement).toBe('1')
})

test('diagnostic guide follows the same capacity and can be hidden without changing content', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  await waitForCapacity(page, 12)
  const ownedGuide = page.locator('#resize-host > .kho-unigrid > .kho-unigrid-guide')
  await expect(ownedGuide).toBeVisible()
  const before = await page.locator('#main-cell').boundingBox()
  await page.locator('#toggle-grid').click()
  await expect(ownedGuide).toHaveCount(0)
  const after = await page.locator('#main-cell').boundingBox()
  expect(after).toEqual(before)
})

test('strict 84 × 80 field snaps every width to full cells and two-column layout states', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  const host = page.locator('#strict-host')
  const expected = [1, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10, 12]
  const FULL_FIELD_WIDTH = 12 * 84 + 11 * 16
  const INVARIANT_WIDTH = 4 * 84 + 3 * 16

  for (let raw = 1; raw <= 12; raw += 1) {
    const threshold = raw * 84 + (raw - 1) * 16
    await host.evaluate((element, width) => { element.style.width = `${width}px` }, threshold)
    await page.waitForFunction(
      ({ capacity, columns }) => {
        const element = document.getElementById('strict-host')
        return element.dataset.capacity === String(capacity) && element.dataset.columns === String(columns)
      },
      { capacity: raw, columns: expected[raw - 1] },
    )
    const values = await host.evaluate((element) => {
      const grid = element.querySelector('.kho-unigrid')
      const gridRect = grid.getBoundingClientRect()
      const guide = element.querySelector('.kho-unigrid-guide').getBoundingClientRect()
      const cell = document.getElementById('strict-cell').getBoundingClientRect()
      const invariant = document.getElementById('invariant-image-cell').getBoundingClientRect()
      const endAlign = document.getElementById('end-align-cell').getBoundingClientRect()
      const hostRect = element.getBoundingClientRect()
      return {
        host: { x: hostRect.x, width: hostRect.width },
        grid: { x: gridRect.x, width: gridRect.width },
        guide: { x: guide.x, width: guide.width, right: guide.right },
        cell: { x: cell.x, width: cell.width, right: cell.right },
        invariant: { x: invariant.x, width: invariant.width, right: invariant.right },
        endAlign: { x: endAlign.x, width: endAlign.width, right: endAlign.right },
        capacity: Number(grid.dataset.khoUnigridCapacity),
        columns: Number(grid.dataset.khoUnigridColumns),
        fieldWidth: Number(grid.dataset.khoUnigridFieldWidth),
        overflow: getComputedStyle(document.getElementById('strict-cell')).overflow,
        snap: document.getElementById('strict-cell').dataset.khoUnigridSnap,
        strictColumnStart: getComputedStyle(document.getElementById('strict-cell')).gridColumnStart,
        invariantColumnStart: getComputedStyle(document.getElementById('invariant-image-cell')).gridColumnStart,
        endAlignColumnStart: getComputedStyle(document.getElementById('end-align-cell')).gridColumnStart,
        overflowX: getComputedStyle(grid).overflowX,
      }
    })
    const columns = expected[raw - 1]
    const fieldWidth = columns * 84 + (columns - 1) * 16
    expect(values.capacity).toBe(raw)
    expect(values.columns).toBe(columns)
    expect(values.fieldWidth).toBe(fieldWidth)
    expect(values.guide.width).toBe(fieldWidth)

    expect(values.cell.width).toBe(FULL_FIELD_WIDTH)
    expect(values.strictColumnStart).toBe('1')
    expect(values.cell.x).toBeCloseTo(values.grid.x, 4)

    expect(values.invariant.width).toBe(INVARIANT_WIDTH)
    const expectedInvariantStart = columns === 12
      ? 5
      : Math.max(1, Math.floor((columns - 4) / 2) + 1)
    expect(values.invariantColumnStart).toBe(String(expectedInvariantStart))
    expect(values.invariant.x).toBeCloseTo(
      values.grid.x + (expectedInvariantStart - 1) * (84 + 16),
      4,
    )

    expect(values.endAlign.width).toBe(INVARIANT_WIDTH)
    const expectedEndAlignStart = columns === 12 ? 9 : Math.max(1, columns - 3)
    expect(values.endAlignColumnStart).toBe(String(expectedEndAlignStart))
    expect(values.endAlign.x).toBeCloseTo(
      values.grid.x + (expectedEndAlignStart - 1) * (84 + 16),
      4,
    )

    expect(values.overflow).toBe('clip')
    expect(values.snap).toBe('strict')

    expect(values.overflowX).toBe(raw === 12 ? 'clip' : 'auto')

    if (raw > 1) {
      await host.evaluate((element, width) => { element.style.width = `${width}px` }, threshold - 0.25)
      await page.waitForFunction(
        (capacity) => document.getElementById('strict-host').dataset.capacity === String(capacity),
        raw - 1,
      )
    }
  }
})

test('ultrawide and sub-module displays have explicit deterministic behavior', async ({ page }) => {
  await page.setViewportSize({ width: 3200, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  const host = page.locator('#strict-host')

  await host.evaluate((element) => { element.style.width = '3000px'; element.style.maxWidth = 'none' })
  await page.waitForFunction(() => document.getElementById('strict-host').dataset.columns === '12')
  const wide = await host.evaluate((element) => {
    const hostRect = element.getBoundingClientRect()
    const cell = document.getElementById('strict-cell').getBoundingClientRect()
    return { hostRect, cell, columns: element.dataset.columns }
  })
  expect(wide.columns).toBe('12')
  expect(wide.cell.width).toBe(1184)
  expect(wide.cell.x - wide.hostRect.x).toBeCloseTo((3000 - 1184) / 2, 4)

  await host.evaluate((element) => { element.style.width = '40px' })
  await page.waitForFunction(() => document.getElementById('strict-host').dataset.capacity === '1')
  const narrow = await host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    const cell = document.getElementById('strict-cell').getBoundingClientRect()
    return {
      cellWidth: cell.width,
      columns: element.dataset.columns,
      overflowX: getComputedStyle(grid).overflowX,
      scrollWidth: grid.scrollWidth,
      clientWidth: grid.clientWidth,
    }
  })
  expect(narrow.columns).toBe('1')
  expect(narrow.cellWidth).toBe(1184)
  expect(narrow.overflowX).toBe('auto')
  expect(narrow.scrollWidth).toBeGreaterThanOrEqual(1184)
  expect(narrow.clientWidth).toBe(40)
})

test('very distant rows remain addressable on the actual CSS grid', async ({ page }) => {
  await page.goto('/distant')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  const distant = await page.locator('#distant-cell').evaluate((cell) => ({
    y: cell.getBoundingClientRect().y,
    authoredY: cell.dataset.khoUnigridAuthoredY,
    rowStart: getComputedStyle(cell).gridRowStart,
  }))
  expect(distant.authoredY).toBe('100000')
  expect(distant.rowStart).toBe('100001')
  expect(distant.y).toBeGreaterThan(500_000)
})

test('server-rendered package hydrates with the actual React client API', async ({ page }) => {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/hydration')
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true')
  await expect(page.locator('#hydrated-cell')).toHaveAttribute('data-kho-unigrid-w', '12')
  expect(errors).toEqual([])
})

test('compactBehavior="overflow" pins authored coordinates and reports live field overflow', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  const host = page.locator('#overflow-host')
  await page.waitForFunction(() => document.getElementById('overflow-host').dataset.columns === '6')

  const fitted = await host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    const cell = document.getElementById('overflow-api-cell')
    const gridStyle = getComputedStyle(grid)
    const cellStyle = getComputedStyle(cell)
    return {
      columns: grid.dataset.khoUnigridColumns,
      cellKind: cell.dataset.khoUnigridCell,
      columnStart: cellStyle.gridColumnStart,
      rowStart: cellStyle.gridRowStart,
      overflowX: gridStyle.overflowX,
      justifyContent: gridStyle.justifyContent,
      cellOverflow: grid.dataset.khoUnigridCellOverflow,
      cellWidth: cell.getBoundingClientRect().width,
    }
  })
  expect(fitted.columns).toBe('6')
  expect(fitted.cellKind).toBe('explicit')
  expect(fitted.columnStart).toBe('1')
  expect(fitted.rowStart).toBe('1')
  expect(fitted.overflowX).toBe('clip')
  expect(fitted.justifyContent).toBe('center')
  expect(fitted.cellOverflow).toBe('false')
  expect(fitted.cellWidth).toBe(6 * 84 + 5 * 12)

  await host.evaluate((element) => { element.style.width = '276px' })
  await page.waitForFunction(() => document.getElementById('overflow-host').dataset.columns === '3')

  const compact = await host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    const cell = document.getElementById('overflow-api-cell')
    const gridStyle = getComputedStyle(grid)
    const cellStyle = getComputedStyle(cell)
    return {
      columns: grid.dataset.khoUnigridColumns,
      cellKind: cell.dataset.khoUnigridCell,
      columnStart: cellStyle.gridColumnStart,
      rowStart: cellStyle.gridRowStart,
      overflowX: gridStyle.overflowX,
      justifyContent: gridStyle.justifyContent,
      cellOverflow: grid.dataset.khoUnigridCellOverflow,
      cellWidth: cell.getBoundingClientRect().width,
    }
  })
  expect(compact.columns).toBe('3')
  expect(compact.cellKind).toBe('explicit')
  expect(compact.columnStart).toBe('1')
  expect(compact.rowStart).toBe('1')
  expect(compact.cellWidth).toBe(6 * 84 + 5 * 12)
  expect(compact.cellOverflow).toBe('true')
  expect(compact.overflowX).toBe('auto')
  expect(compact.justifyContent).toBe('start')
})

test('hideBelowColumns toggles live visibility across an actual capacity-crossing resize', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  const host = page.locator('#hide-host')
  await page.waitForFunction(() => document.getElementById('hide-host').dataset.columns === '6')

  const visible = await host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    const cell = document.getElementById('hide-api-cell')
    return {
      columns: grid.dataset.khoUnigridColumns,
      hidden: cell.hidden,
      display: getComputedStyle(cell).display,
      cellOverflow: grid.dataset.khoUnigridCellOverflow,
    }
  })
  expect(visible.columns).toBe('6')
  expect(visible.hidden).toBe(false)
  expect(visible.display).toBe('block')
  expect(visible.cellOverflow).toBe('false')

  await host.evaluate((element) => { element.style.width = '468px' })
  await page.waitForFunction(() => document.getElementById('hide-host').dataset.columns === '5')

  const hidden = await host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    const cell = document.getElementById('hide-api-cell')
    return {
      columns: grid.dataset.khoUnigridColumns,
      hidden: cell.hidden,
      display: getComputedStyle(cell).display,
      cellOverflow: grid.dataset.khoUnigridCellOverflow,
    }
  })
  expect(hidden.columns).toBe('5')
  expect(hidden.hidden).toBe(true)
  expect(hidden.display).toBe('none')
  expect(hidden.cellOverflow).toBe('false')

  await host.evaluate((element) => { element.style.width = '564px' })
  await page.waitForFunction(() => document.getElementById('hide-host').dataset.columns === '6')
  const restored = await host.evaluate((element) => {
    const cell = document.getElementById('hide-api-cell')
    return { hidden: cell.hidden, display: getComputedStyle(cell).display }
  })
  expect(restored.hidden).toBe(false)
  expect(restored.display).toBe('block')
})

test('strategy="preserve" always shows the full twelve-column field and forces scroll', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  const host = page.locator('#preserve-host')
  await page.waitForFunction(() => document.getElementById('preserve-host').dataset.capacity === '12')

  const wide = await host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    return {
      columns: grid.dataset.khoUnigridColumns,
      fieldWidth: Number(grid.dataset.khoUnigridFieldWidth),
      overflowX: getComputedStyle(grid).overflowX,
    }
  })
  expect(wide.columns).toBe('12')
  expect(wide.fieldWidth).toBe(1140)
  expect(wide.overflowX).toBe('auto')

  await host.evaluate((element) => { element.style.width = '600px' })
  await page.waitForFunction(() => document.getElementById('preserve-host').dataset.capacity === '6')

  const narrow = await host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    return {
      columns: grid.dataset.khoUnigridColumns,
      fieldWidth: Number(grid.dataset.khoUnigridFieldWidth),
      overflowX: getComputedStyle(grid).overflowX,
      scrollWidth: grid.scrollWidth,
      clientWidth: grid.clientWidth,
    }
  })
  expect(narrow.columns).toBe('12')
  expect(narrow.fieldWidth).toBe(1140)
  expect(narrow.overflowX).toBe('auto')
  expect(narrow.scrollWidth).toBeGreaterThanOrEqual(1140)
  expect(narrow.clientWidth).toBe(600)

  await host.evaluate((element) => { element.style.width = '2000px'; element.style.maxWidth = 'none' })
  await page.waitForFunction(() => document.getElementById('preserve-host').dataset.capacity === '12')

  const roomy = await host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    return {
      columns: grid.dataset.khoUnigridColumns,
      fieldWidth: Number(grid.dataset.khoUnigridFieldWidth),
      overflowX: getComputedStyle(grid).overflowX,
    }
  })
  expect(roomy.columns).toBe('12')
  expect(roomy.fieldWidth).toBe(1140)
  expect(roomy.overflowX).toBe('auto')
})

test('strategy="preserve" never hides a hideBelowColumns cell, even across a live resize that narrows measured capacity far below the threshold', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  const host = page.locator('#preserve-host')
  await page.waitForFunction(() => document.getElementById('preserve-host').dataset.capacity === '12')

  const readState = () => host.evaluate((element) => {
    const grid = element.querySelector('.kho-unigrid')
    const cell = document.getElementById('preserve-hide-cell')
    return {
      columns: grid.dataset.khoUnigridColumns,
      capacity: grid.dataset.khoUnigridCapacity,
      hidden: cell.hidden,
      display: getComputedStyle(cell).display,
    }
  })

  const wide = await readState()
  expect(wide.columns).toBe('12')
  expect(wide.capacity).toBe('12')
  expect(wide.hidden).toBe(false)
  expect(wide.display).toBe('block')

  await host.evaluate((element) => { element.style.width = '100px' })
  await page.waitForFunction(() => document.getElementById('preserve-host').dataset.capacity === '1')

  const narrow = await readState()
  expect(narrow.columns).toBe('12')
  expect(narrow.capacity).toBe('1')
  expect(narrow.hidden).toBe(false)
  expect(narrow.display).toBe('block')

  await host.evaluate((element) => { element.style.width = '600px' })
  await page.waitForFunction(() => document.getElementById('preserve-host').dataset.capacity === '6')

  const mid = await readState()
  expect(mid.columns).toBe('12')
  expect(mid.capacity).toBe('6')
  expect(mid.hidden).toBe(false)
  expect(mid.display).toBe('block')
})

test('Unigrid forces the grid root to ltr under an actual RTL ancestor, while Cell and contentStyle pass an authored RTL direction through unmodified', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
  const values = await page.evaluate(() => {
    const ancestor = document.getElementById('rtl-ancestor')
    const grid = document.querySelector('#rtl-host .kho-unigrid')
    const cell = document.getElementById('rtl-cell')
    const content = cell.querySelector('.kho-unigrid-cell__content')
    const gridRect = grid.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    return {
      ancestorDir: ancestor.getAttribute('dir'),
      gridDirection: getComputedStyle(grid).direction,
      gridWritingMode: getComputedStyle(grid).writingMode,
      cellDirection: getComputedStyle(cell).direction,
      contentDirection: getComputedStyle(content).direction,
      gridX: gridRect.x,
      cellX: cellRect.x,
    }
  })
  expect(values.ancestorDir).toBe('rtl')
  expect(values.gridDirection).toBe('ltr')
  expect(values.gridWritingMode).toBe('horizontal-tb')
  expect(values.cellDirection).toBe('rtl')
  expect(values.contentDirection).toBe('rtl')
  expect(values.cellX).toBeCloseTo(values.gridX, 4)
})
