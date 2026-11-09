import { test, expect } from '@playwright/test'

const MODULE = 84
const MODULE_HEIGHT = 80
const COLUMN_GAP = 12
const ROW_GAP = 10
const PITCH = MODULE + COLUMN_GAP

const fieldWidthFor = (columns) => columns * MODULE + (columns - 1) * COLUMN_GAP
const capacityFor = (width) => Math.floor((width + COLUMN_GAP) / PITCH)

async function readFluidHost(page) {
  return page.evaluate(() => {
    const host = document.getElementById('fluid-host')
    const rect = (id) => {
      const element = document.getElementById(id)
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { left: box.left, top: box.top, width: box.width, height: box.height }
    }
    return {
      dataset: { ...host.dataset },
      hostWidth: host.getBoundingClientRect().width,
      a: rect('fluid-cell-a'),
      b: rect('fluid-cell-b'),
      c: rect('fluid-cell-c'),
      wide: rect('fluid-cell-wide'),
      hidden: rect('fluid-cell-hidden'),
      hiddenAttr: document.getElementById('fluid-cell-hidden')?.hasAttribute('hidden') ?? null,
    }
  })
}

async function waitForColumns(page, columns) {
  await page.waitForFunction(
    (columns) => document.getElementById('fluid-host')?.dataset.columns === String(columns),
    columns,
  )
}

async function waitForSettled(page) {
  await page.waitForFunction(() => {
    const host = document.getElementById('fluid-host')
    if (!host || host.dataset.measuredWidth == null) return false
    const style = getComputedStyle(host)
    const content = host.getBoundingClientRect().width
      - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')
      - parseFloat(style.borderLeftWidth || '0') - parseFloat(style.borderRightWidth || '0')
    return Math.abs(Number(host.dataset.measuredWidth) - content) < 1.5
  })
}

test.describe('fluid composition model', () => {
  test('the field exposes every complete module the material holds, far past a twelve-column clamp', async ({ page }) => {
    await page.setViewportSize({ width: 2400, height: 1200 })
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')

    await waitForColumns(page, 13)
    const values = await readFluidHost(page)

    expect(values.dataset.state).toBe('fluid')
    expect(values.dataset.authoredColumns).toBe('fluid')
    expect(Number(values.dataset.columns)).toBe(13)
    expect(Number(values.dataset.capacity)).toBe(13)
    expect(Number(values.dataset.fieldWidth)).toBeCloseTo(fieldWidthFor(13), 3)
    expect(Number(values.dataset.columns)).toBeGreaterThan(12)
  })

  test('module size is invariant while the module count changes across a live resize', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')

    const measurements = []
    for (const width of [420, 700, 1000, 1236, 2000]) {
      await page.setViewportSize({ width, height: 1000 })
      await waitForSettled(page)
      const values = await readFluidHost(page)
      measurements.push({ width, values })

      expect(values.a.width).toBeCloseTo(fieldWidthFor(4), 1)
      expect(values.a.height).toBeCloseTo(3 * MODULE_HEIGHT + 2 * ROW_GAP, 1)
    }

    const counts = new Set(measurements.map((m) => Number(m.values.dataset.columns)))
    expect(counts.size).toBeGreaterThan(1)
  })

  test('the semantic layout model never changes across a resize that crosses many thresholds', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')

    const states = new Set()
    for (const width of [360, 500, 640, 780, 900, 1100, 1236, 1600, 2400]) {
      await page.setViewportSize({ width, height: 1000 })
      await waitForSettled(page)
      const values = await readFluidHost(page)
      states.add(values.dataset.state)
    }
    expect([...states]).toEqual(['fluid'])
  })

  test('cells pack left-to-right in source order, at a capacity where the old gate would have disabled packing', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1400 })
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    await waitForColumns(page, 13)

    const values = await readFluidHost(page)
    expect(values.a.top).toBeCloseTo(values.b.top, 1)
    expect(values.b.left).toBeCloseTo(values.a.left + fieldWidthFor(4) + COLUMN_GAP, 1)
    expect(values.c.top).toBeCloseTo(values.a.top, 1)
    expect(values.c.left).toBeCloseTo(values.b.left + fieldWidthFor(7) + COLUMN_GAP, 1)
    expect(values.wide.top).toBeGreaterThan(values.a.top)
    expect(values.wide.width).toBeCloseTo(fieldWidthFor(13), 1)
  })

  test('a span wider than the field overflows it rather than shrinking, and stays reachable', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 1200 })
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')
    await waitForSettled(page)

    const values = await readFluidHost(page)
    const columns = Number(values.dataset.columns)
    expect(columns).toBeLessThan(13)

    expect(values.wide.width).toBeCloseTo(fieldWidthFor(13), 1)

    const scroll = await page.evaluate(() => {
      const grid = document.querySelector('#fluid-host .kho-unigrid')
      return {
        scrollWidth: grid.scrollWidth,
        clientWidth: grid.clientWidth,
        overflowX: getComputedStyle(grid).overflowX,
      }
    })
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth)
    expect(['auto', 'scroll']).toContain(scroll.overflowX)
  })

  test('hideBelowColumns still hides explicitly, and only below its declared capacity', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')

    await page.setViewportSize({ width: 1600, height: 1200 })
    await waitForColumns(page, 13)
    let values = await readFluidHost(page)
    expect(values.hiddenAttr).toBe(false)

    await page.setViewportSize({ width: 700, height: 1200 })
    await page.waitForFunction(() => {
      const host = document.getElementById('fluid-host')
      return host && Number(host.dataset.columns) < 10
    })
    values = await readFluidHost(page)
    expect(values.hiddenAttr).toBe(true)
  })

  test('capacity matches the documented formula at every measured width', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true')

    for (const width of [400, 600, 820, 1100]) {
      await page.setViewportSize({ width, height: 1000 })
      await waitForSettled(page)
      const values = await readFluidHost(page)
      const measured = Number(values.dataset.measuredWidth)
      expect(Number(values.dataset.capacity)).toBe(Math.max(1, capacityFor(measured)))
    }
  })

  test('server-rendered fluid markup hydrates, then measurement raises the capacity without changing the model', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error.message)))

    await page.setViewportSize({ width: 1400, height: 1200 })

    const response = await page.request.get('/hydration-fluid')
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).toContain('data-kho-unigrid-state="fluid"')
    expect(html).toContain('data-kho-unigrid-columns="4"')
    expect(html).toContain('data-kho-unigrid-authored-columns="fluid"')
    expect(html).not.toContain('data-kho-unigrid-breakpoints')
    for (const id of ['fluid-hydrated-a', 'fluid-hydrated-b', 'fluid-hydrated-c']) {
      expect(html).toContain(`id="${id}"`)
    }

    await page.goto('/hydration-fluid')
    await page.waitForFunction(() => document.documentElement.dataset.hydratedFluid === 'true')
    const problems = await page.evaluate(() => window.__UNIGRID_HYDRATION_PROBLEMS__ ?? [])
    const hydrationProblems = problems.filter((message) => /hydrat|did not match|mismatch|recoverable/i.test(message))
    expect(hydrationProblems).toEqual([])
    expect(errors).toEqual([])

    await page.waitForFunction(() => {
      const grid = document.querySelector('#fluid-hydration-host .kho-unigrid')
      return grid?.getAttribute('data-kho-unigrid-columns') === '13'
    })
    const client = await page.evaluate(() => {
      const grid = document.querySelector('#fluid-hydration-host .kho-unigrid')
      const box = (id) => {
        const rect = document.getElementById(id).getBoundingClientRect()
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      }
      return {
        columns: Number(grid.getAttribute('data-kho-unigrid-columns')),
        capacity: Number(grid.getAttribute('data-kho-unigrid-capacity')),
        state: grid.getAttribute('data-kho-unigrid-state'),
        breakpoints: grid.getAttribute('data-kho-unigrid-breakpoints'),
        a: box('fluid-hydrated-a'),
        b: box('fluid-hydrated-b'),
        c: box('fluid-hydrated-c'),
      }
    })
    expect(client.columns).toBe(13)
    expect(client.capacity).toBe(13)
    expect(client.state).toBe('fluid')
    expect(client.breakpoints).toBeNull()

    expect(client.a.width).toBeCloseTo(fieldWidthFor(4), 1)
    expect(client.a.height).toBeCloseTo(2 * MODULE_HEIGHT + ROW_GAP, 1)

    expect(client.b.top).toBeCloseTo(client.a.top, 1)
    expect(client.c.top).toBeCloseTo(client.a.top, 1)
    expect(client.b.left).toBeCloseTo(client.a.left + fieldWidthFor(4) + COLUMN_GAP, 1)
    expect(client.c.left).toBeCloseTo(client.b.left + fieldWidthFor(4) + COLUMN_GAP, 1)
  })

  test('a hydrated fluid grid crossing several capacities never changes composition model', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1200 })
    await page.goto('/hydration-fluid')
    await page.waitForFunction(() => document.documentElement.dataset.hydratedFluid === 'true')

    const observed = new Set()
    const counts = new Set()
    for (const width of [380, 560, 760, 1000, 1400]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.waitForFunction(() => {
        const grid = document.querySelector('#fluid-hydration-host .kho-unigrid')
        const host = document.getElementById('fluid-hydration-host')
        if (!grid || !host) return false
        const available = Math.min(host.getBoundingClientRect().width, 1236)
        const expected = Math.max(1, Math.floor((available + 12) / 96))
        return Number(grid.getAttribute('data-kho-unigrid-capacity')) === expected
      })
      const snapshot = await page.evaluate(() => {
        const grid = document.querySelector('#fluid-hydration-host .kho-unigrid')
        const rect = document.getElementById('fluid-hydrated-a').getBoundingClientRect()
        return {
          state: grid.getAttribute('data-kho-unigrid-state'),
          columns: Number(grid.getAttribute('data-kho-unigrid-columns')),
          cellWidth: rect.width,
        }
      })
      observed.add(snapshot.state)
      counts.add(snapshot.columns)
      expect(snapshot.cellWidth).toBeCloseTo(fieldWidthFor(4), 1)
    }
    expect([...observed]).toEqual(['fluid'])
    expect(counts.size).toBeGreaterThan(1)
  })
})
