export const PACKAGE_NAME = '@khannaoffice/unigrid' as const

export const WEB_TEMPLATE_SPEC = Object.freeze({
  authoredColumns: 12 as const,
  moduleWidthPx: 84,
  moduleHeightPx: 80,
  columnGapPx: 12,
  rowGapPx: 10,
  guideStrokePx: 2,
  guideTickStrokePx: 1,
})

export const AUTHORED_COLUMNS = WEB_TEMPLATE_SPEC.authoredColumns

export const MAX_AUTHORED_COLUMNS = 10_000

export const FLUID_COLUMNS = 'fluid' as const

export const DEFAULT_MODULE_WIDTH = WEB_TEMPLATE_SPEC.moduleWidthPx
export const DEFAULT_MODULE_HEIGHT_RATIO = WEB_TEMPLATE_SPEC.moduleHeightPx / WEB_TEMPLATE_SPEC.moduleWidthPx
export const DEFAULT_COLUMN_GAP_RATIO = WEB_TEMPLATE_SPEC.columnGapPx / WEB_TEMPLATE_SPEC.moduleWidthPx
export const DEFAULT_ROW_GAP_RATIO = WEB_TEMPLATE_SPEC.rowGapPx / WEB_TEMPLATE_SPEC.moduleWidthPx

export type MaterialColumns = number
export type AuthoredColumns = number | typeof FLUID_COLUMNS
export type MaterialState = 'authored' | 'reflow' | 'fluid'
export type CompactWidth = 'auto' | MaterialColumns
export type CompactBehavior = 'reflow' | 'overflow'
export type CompactAlign = 'start' | 'center' | 'end'
export type ReflowFlow = 'stack' | 'pack'
export type CapacityBreakpoints = readonly MaterialColumns[]

export const DEFAULT_CAPACITY_BREAKPOINTS: CapacityBreakpoints = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
])

export interface UnigridConfig {
  authoredColumns?: AuthoredColumns
  moduleWidth?: number
  moduleHeight?: number
  columnGap?: number
  rowGap?: number
  initialColumns?: MaterialColumns
  breakpoints?: CapacityBreakpoints
  reflowFlow?: ReflowFlow
}

export interface UnigridMetrics {
  authoredColumns: AuthoredColumns
  activeColumns: MaterialColumns
  capacityColumns: MaterialColumns
  breakpoints: CapacityBreakpoints | null
  moduleWidth: number
  moduleHeight: number
  columnGap: number
  rowGap: number
  columnPitch: number
  rowPitch: number
  fieldWidth: number
  authoredFieldWidth: number | null
  measuredWidth: number
  residualInlineSpace: number
  marginInlineStart: number
  marginInlineEnd: number
  overflowInlineSpace: number
  fieldFits: boolean
  materialState: MaterialState
}

export interface UnigridPlacement {
  x?: number
  y?: number
  w?: number
  h?: number
  id?: string
  compactW?: CompactWidth
  compactBehavior?: CompactBehavior
  compactAlign?: CompactAlign
  compactH?: 'auto' | number
  hideBelowColumns?: MaterialColumns
}

export interface ResolvedPlacement {
  kind: 'flow' | 'explicit'
  x?: number
  y?: number
  w: number
  h: number
  id?: string
}

export interface ResponsivePlacement extends ResolvedPlacement {
  authoredKind: ResolvedPlacement['kind']
  authoredW: number
  compacted: boolean
  columnStart?: number
  row?: number
  hidden: boolean
}

export interface PlacementRect {
  x: number
  y: number
  w: number
  h: number
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type ValidationCode =
  | 'invalid-config'
  | 'invalid-placement'
  | 'non-integer'
  | 'non-positive-span'
  | 'incomplete-coordinate'
  | 'negative-coordinate'
  | 'invalid-id'
  | 'invalid-layout'
  | 'duplicate-id'
  | 'overlap'
  | 'outside-columns'
  | 'invalid-option'
  | 'source-order'
  | 'removed-option'
  | 'unsupported-in-fluid'

export interface ValidationIssue {
  code: ValidationCode
  message: string
  index?: number
  otherIndex?: number
}

export interface LayoutValidationOptions {
  overlap?: 'reject' | 'allow'
  columnBoundary?: number
  requireResponsiveSourceOrder?: boolean
  authoredColumns?: AuthoredColumns
}

export interface MaterialAuditState {
  columns: MaterialColumns
  capacityColumns: MaterialColumns
  width: number
  placements: readonly ResponsivePlacement[]
}

export interface MaterialAudit {
  valid: boolean
  issues: readonly ValidationIssue[]
  states: readonly MaterialAuditState[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value)
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function nonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isValidAuthoredColumns(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= MAX_AUTHORED_COLUMNS
}

export function isFluidColumns(value: unknown): value is typeof FLUID_COLUMNS {
  return value === FLUID_COLUMNS
}

function columnCeiling(authoredColumns: AuthoredColumns): number {
  return isFluidColumns(authoredColumns) ? MAX_AUTHORED_COLUMNS : authoredColumns
}

function formatIssues(heading: string, issues: readonly ValidationIssue[]): string {
  return `[${PACKAGE_NAME}] ${heading}:\n  - ${issues.map((issue) => issue.message).join('\n  - ')}`
}

export function isMaterialColumns(value: unknown, maxColumns: number = AUTHORED_COLUMNS): value is MaterialColumns {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= maxColumns
}

export function assertMaterialColumns(value: unknown, name = 'columns', maxColumns: number = AUTHORED_COLUMNS): asserts value is MaterialColumns {
  if (!isMaterialColumns(value, maxColumns)) {
    throw new Error(`[${PACKAGE_NAME}] ${name} must be a safe integer from 1 to ${maxColumns} (got ${String(value)})`)
  }
}

export function validateCapacityBreakpoints(input: unknown, authoredColumns: number = AUTHORED_COLUMNS): ValidationIssue[] {
  if (!Array.isArray(input)) {
    return [{ code: 'invalid-option', message: 'breakpoints must be an array of complete column counts' }]
  }
  const minLength = authoredColumns === 1 ? 1 : 2
  if (input.length < minLength) {
    return [{
      code: 'invalid-option',
      message: authoredColumns === 1
        ? 'breakpoints must include at least the 1-column state'
        : `breakpoints must include at least the 1- and ${authoredColumns}-column states`,
    }]
  }
  const issues: ValidationIssue[] = []
  let previous = 0
  input.forEach((value, index) => {
    if (!isMaterialColumns(value, authoredColumns)) {
      issues.push({ code: 'invalid-option', message: `breakpoints[${index}] must be a safe integer from 1 to ${authoredColumns} (got ${String(value)})`, index })
      return
    }
    if (value <= previous) {
      issues.push({ code: 'invalid-option', message: `breakpoints must be strictly ascending without duplicates (index ${index} is ${value} after ${previous})`, index })
    }
    previous = value
  })
  if (input[0] !== 1) {
    issues.push({ code: 'invalid-option', message: 'breakpoints must begin with 1 so every material has a deterministic fallback' })
  }
  if (input[input.length - 1] !== authoredColumns) {
    issues.push({ code: 'invalid-option', message: `breakpoints must end with ${authoredColumns} so ultrawide material resolves to the authored field` })
  }
  return issues
}

export function assertCapacityBreakpoints(input: unknown, authoredColumns: number = AUTHORED_COLUMNS): asserts input is CapacityBreakpoints {
  const issues = validateCapacityBreakpoints(input, authoredColumns)
  if (issues.length) throw new Error(formatIssues('Invalid capacity breakpoints', issues))
}

export function capacityBreakpoints(step = 1, authoredColumns: number = AUTHORED_COLUMNS): CapacityBreakpoints {
  if (isFluidColumns(authoredColumns)) {
    throw new Error(`[${PACKAGE_NAME}] capacityBreakpoints() builds a closed set of states ending at the authored ceiling, and authoredColumns: "${FLUID_COLUMNS}" has none. A fluid composition needs no breakpoints — every capacity its material can hold is already a valid state.`)
  }
  if (!(Number.isSafeInteger(authoredColumns) && authoredColumns >= 1 && authoredColumns <= MAX_AUTHORED_COLUMNS)) {
    throw new Error(`[${PACKAGE_NAME}] authoredColumns must be a safe integer from 1 to ${MAX_AUTHORED_COLUMNS} (got ${String(authoredColumns)})`)
  }
  if (!(Number.isSafeInteger(step) && step >= 1 && step <= authoredColumns)) {
    throw new Error(`[${PACKAGE_NAME}] breakpoint step must be a safe integer from 1 to ${authoredColumns} (got ${String(step)})`)
  }
  const values = new Set<MaterialColumns>([1, authoredColumns])
  for (let columns = step; columns <= authoredColumns; columns += step) {
    if (isMaterialColumns(columns, authoredColumns)) values.add(columns)
  }
  return Object.freeze([...values].sort((a, b) => a - b))
}

const defaultCapacityBreakpointsCache = new Map<number, CapacityBreakpoints>()

function defaultCapacityBreakpointsFor(authoredColumns: number): CapacityBreakpoints {
  if (authoredColumns === AUTHORED_COLUMNS) return DEFAULT_CAPACITY_BREAKPOINTS
  const cached = defaultCapacityBreakpointsCache.get(authoredColumns)
  if (cached != null) return cached
  const computed = capacityBreakpoints(1, authoredColumns)
  defaultCapacityBreakpointsCache.set(authoredColumns, computed)
  return computed
}

function findActiveBreakpoint(capacityColumns: number, breakpoints: CapacityBreakpoints): MaterialColumns {
  let low = 0
  let high = breakpoints.length - 1
  let result: MaterialColumns = 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const value = breakpoints[mid]
    if (value != null && value <= capacityColumns) {
      result = value
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return result
}

export function resolveCapacityBreakpoint(
  capacityColumns: MaterialColumns | number,
  breakpoints: CapacityBreakpoints = DEFAULT_CAPACITY_BREAKPOINTS,
  authoredColumns: number = AUTHORED_COLUMNS,
): MaterialColumns {
  assertMaterialColumns(capacityColumns, 'capacityColumns', authoredColumns)
  assertCapacityBreakpoints(breakpoints, authoredColumns)
  return findActiveBreakpoint(capacityColumns, breakpoints)
}

function resolveCapacityBreakpointTrusted(capacityColumns: MaterialColumns, breakpoints: CapacityBreakpoints): MaterialColumns {
  return findActiveBreakpoint(capacityColumns, breakpoints)
}

export function configForAuthoredFieldWidth(fieldWidth: number): Readonly<Required<Pick<UnigridConfig, 'moduleWidth' | 'moduleHeight' | 'columnGap' | 'rowGap'>>> {
  if (!positiveFinite(fieldWidth)) {
    throw new Error(`[${PACKAGE_NAME}] fieldWidth must be a finite number > 0 (got ${String(fieldWidth)})`)
  }
  const moduleWidth = fieldWidth / (AUTHORED_COLUMNS + (AUTHORED_COLUMNS - 1) * DEFAULT_COLUMN_GAP_RATIO)
  const scale = moduleWidth / DEFAULT_MODULE_WIDTH
  return Object.freeze({
    moduleWidth,
    moduleHeight: WEB_TEMPLATE_SPEC.moduleHeightPx * scale,
    columnGap: WEB_TEMPLATE_SPEC.columnGapPx * scale,
    rowGap: WEB_TEMPLATE_SPEC.rowGapPx * scale,
  })
}

export function fieldWidthForColumns(columns: MaterialColumns | number, config: UnigridConfig = {}): number {
  assertUnigridConfig(config)
  const geometry = resolveGeometry(config)
  assertMaterialColumns(columns, 'columns', columnCeiling(geometry.authoredColumns))
  return columns * geometry.moduleWidth + (columns - 1) * geometry.columnGap
}

export function resolveGeometry(config: UnigridConfig = {}): Omit<UnigridMetrics, 'activeColumns' | 'capacityColumns' | 'breakpoints' | 'fieldWidth' | 'measuredWidth' | 'residualInlineSpace' | 'marginInlineStart' | 'marginInlineEnd' | 'overflowInlineSpace' | 'fieldFits' | 'materialState'> {
  assertUnigridConfig(config)
  const authoredColumns = config.authoredColumns ?? AUTHORED_COLUMNS
  const moduleWidth = config.moduleWidth ?? DEFAULT_MODULE_WIDTH
  const scale = moduleWidth / DEFAULT_MODULE_WIDTH
  const moduleHeight = config.moduleHeight ?? WEB_TEMPLATE_SPEC.moduleHeightPx * scale
  const columnGap = config.columnGap ?? WEB_TEMPLATE_SPEC.columnGapPx * scale
  const rowGap = config.rowGap ?? WEB_TEMPLATE_SPEC.rowGapPx * scale
  const authoredFieldWidth = isFluidColumns(authoredColumns)
    ? null
    : authoredColumns * moduleWidth + (authoredColumns - 1) * columnGap
  return Object.freeze({
    authoredColumns,
    moduleWidth,
    moduleHeight,
    columnGap,
    rowGap,
    columnPitch: moduleWidth + columnGap,
    rowPitch: moduleHeight + rowGap,
    authoredFieldWidth,
  })
}

export function validateUnigridConfig(input: unknown = {}): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ code: 'invalid-config', message: 'configuration must be an object' }]
  }
  const issues: ValidationIssue[] = []
  const { moduleWidth, moduleHeight, columnGap, rowGap, initialColumns, breakpoints, authoredColumns } = input
  if (moduleWidth != null && !positiveFinite(moduleWidth)) issues.push({ code: 'invalid-config', message: `moduleWidth must be a finite number > 0 (got ${String(moduleWidth)})` })
  if (moduleHeight != null && !positiveFinite(moduleHeight)) issues.push({ code: 'invalid-config', message: `moduleHeight must be a finite number > 0 (got ${String(moduleHeight)})` })
  if (columnGap != null && !nonNegativeFinite(columnGap)) issues.push({ code: 'invalid-config', message: `columnGap must be a finite number ≥ 0 (got ${String(columnGap)})` })
  if (rowGap != null && !nonNegativeFinite(rowGap)) issues.push({ code: 'invalid-config', message: `rowGap must be a finite number ≥ 0 (got ${String(rowGap)})` })
  let effectiveAuthoredColumns: AuthoredColumns = AUTHORED_COLUMNS
  if (authoredColumns != null) {
    if (isFluidColumns(authoredColumns)) {
      effectiveAuthoredColumns = FLUID_COLUMNS
    } else if (!isValidAuthoredColumns(authoredColumns)) {
      issues.push({ code: 'invalid-config', message: `authoredColumns must be "${FLUID_COLUMNS}" or a safe integer from 1 to ${MAX_AUTHORED_COLUMNS} (got ${String(authoredColumns)})` })
    } else {
      effectiveAuthoredColumns = authoredColumns
    }
  }
  const ceiling = columnCeiling(effectiveAuthoredColumns)
  if (initialColumns != null && !isMaterialColumns(initialColumns, ceiling)) {
    issues.push({ code: 'invalid-config', message: `initialColumns must be a safe integer from 1 to ${ceiling} (got ${String(initialColumns)})` })
  }
  if (breakpoints != null) {
    if (isFluidColumns(effectiveAuthoredColumns)) {
      issues.push({
        code: 'unsupported-in-fluid',
        message: 'breakpoints cannot be used with authoredColumns: "fluid". A breakpoint list is a closed set of complete-column states ending at the authored ceiling, and a fluid composition has no ceiling to end at — every capacity its material can hold is already a valid state. Declare a numeric authoredColumns to use breakpoints.',
      })
    } else {
      issues.push(...validateCapacityBreakpoints(breakpoints, effectiveAuthoredColumns))
    }
  }
  return issues
}

export function assertUnigridConfig(input: unknown = {}): asserts input is UnigridConfig {
  const issues = validateUnigridConfig(input)
  if (issues.length) throw new Error(formatIssues('Invalid configuration', issues))
}

export function resolveUnigrid(width: number, config: UnigridConfig = {}): UnigridMetrics {
  assertUnigridConfig(config)
  if (!nonNegativeFinite(width)) throw new Error(`[${PACKAGE_NAME}] width must be a finite number ≥ 0 (got ${String(width)})`)
  const geometry = resolveGeometry(config)
  const fluid = isFluidColumns(geometry.authoredColumns)
  const ceiling = columnCeiling(geometry.authoredColumns)
  const fallback = config.initialColumns ?? 1
  const breakpoints = fluid ? null : (config.breakpoints ?? defaultCapacityBreakpointsFor(geometry.authoredColumns as number))
  const rawCapacity = width > 0
    ? Math.floor((width + geometry.columnGap) / geometry.columnPitch)
    : fallback
  const capacityColumns = Math.min(ceiling, Math.max(1, rawCapacity)) as MaterialColumns
  assertMaterialColumns(capacityColumns, 'capacityColumns', ceiling)
  const activeColumns = breakpoints ? resolveCapacityBreakpointTrusted(capacityColumns, breakpoints) : capacityColumns
  const fieldWidth = activeColumns * geometry.moduleWidth + (activeColumns - 1) * geometry.columnGap
  const residualInlineSpace = Math.max(0, width - fieldWidth)
  const centeredMargin = residualInlineSpace / 2
  const overflowInlineSpace = Math.max(0, fieldWidth - width)
  return Object.freeze({
    ...geometry,
    activeColumns,
    capacityColumns,
    breakpoints: breakpoints ? Object.freeze([...breakpoints]) : null,
    fieldWidth,
    measuredWidth: width,
    residualInlineSpace,
    marginInlineStart: centeredMargin,
    marginInlineEnd: centeredMargin,
    overflowInlineSpace,
    fieldFits: overflowInlineSpace === 0,
    materialState: fluid ? 'fluid' : (activeColumns === geometry.authoredColumns ? 'authored' : 'reflow'),
  })
}

export function responsiveWidths(config: UnigridConfig = {}): readonly number[] {
  assertUnigridConfig(config)
  const authoredColumns = config.authoredColumns ?? AUTHORED_COLUMNS
  if (isFluidColumns(authoredColumns)) {
    throw new Error(`[${PACKAGE_NAME}] responsiveWidths() enumerates every state up to the authored ceiling, and authoredColumns: "${FLUID_COLUMNS}" has none — the sequence is unbounded. Call fieldWidthForColumns(columns, config) for the specific column counts you need.`)
  }
  return Object.freeze(Array.from({ length: authoredColumns }, (_, index) => fieldWidthForColumns(index + 1, config)))
}

export function breakpointWidths(config: UnigridConfig = {}): readonly number[] {
  assertUnigridConfig(config)
  const authoredColumns = config.authoredColumns ?? AUTHORED_COLUMNS
  if (isFluidColumns(authoredColumns)) {
    throw new Error(`[${PACKAGE_NAME}] breakpointWidths() measures a breakpoint policy, and authoredColumns: "${FLUID_COLUMNS}" has none — every capacity is already a valid state. Call fieldWidthForColumns(columns, config) for the specific column counts you need.`)
  }
  const breakpoints = config.breakpoints ?? defaultCapacityBreakpointsFor(authoredColumns)
  return Object.freeze(breakpoints.map((columns) => fieldWidthForColumns(columns, config)))
}

export function validateCompactWidth(input: unknown, maxColumns: number = AUTHORED_COLUMNS): ValidationIssue[] {
  if (input === 'auto') return []
  if (input === 'full') {
    return [{ code: 'removed-option', message: `compactW "full" was removed in the canonical geometry model — a cell's span never changes with capacity. Author a fixed compactW number for the compact state, or build a separately named fluid cell outside this component.` }]
  }
  if (!isMaterialColumns(input, maxColumns)) {
    return [{ code: 'invalid-option', message: `compactW must be "auto" or a safe integer from 1 to ${maxColumns} (got ${String(input)})` }]
  }
  return []
}

export function assertCompactWidth(input: unknown, maxColumns: number = AUTHORED_COLUMNS): asserts input is CompactWidth {
  const issues = validateCompactWidth(input, maxColumns)
  if (issues.length) throw new Error(formatIssues('Invalid compact width', issues))
}

export function validateCompactBehavior(input: unknown): ValidationIssue[] {
  if (input === 'reflow' || input === 'overflow') return []
  return [{ code: 'invalid-option', message: `compactBehavior must be "reflow" or "overflow" (got ${String(input)})` }]
}

export function assertCompactBehavior(input: unknown): asserts input is CompactBehavior {
  const issues = validateCompactBehavior(input)
  if (issues.length) throw new Error(formatIssues('Invalid compact behavior', issues))
}

export function validateCompactAlign(input: unknown): ValidationIssue[] {
  if (input === 'start' || input === 'center' || input === 'end') return []
  return [{ code: 'invalid-option', message: `compactAlign must be "start", "center", or "end" (got ${String(input)})` }]
}

export function assertCompactAlign(input: unknown): asserts input is CompactAlign {
  const issues = validateCompactAlign(input)
  if (issues.length) throw new Error(formatIssues('Invalid compact alignment', issues))
}

export function validateReflowFlow(input: unknown): ValidationIssue[] {
  if (input === 'stack' || input === 'pack') return []
  return [{ code: 'invalid-option', message: `reflowFlow must be "stack" or "pack" (got ${String(input)})` }]
}

export function assertReflowFlow(input: unknown): asserts input is ReflowFlow {
  const issues = validateReflowFlow(input)
  if (issues.length) throw new Error(formatIssues('Invalid reflow flow', issues))
}

export function isHiddenAtCapacity(hideBelowColumns: MaterialColumns | undefined, activeColumns: MaterialColumns): boolean {
  return hideBelowColumns != null && activeColumns < hideBelowColumns
}

export function resolveCompactSpan(authoredW: number, compactW: CompactWidth = 'auto', authoredColumns: number = AUTHORED_COLUMNS): number {
  if (!(Number.isSafeInteger(authoredW) && authoredW >= 1)) {
    throw new Error(`[${PACKAGE_NAME}] authoredW must be a safe integer ≥ 1 (got ${String(authoredW)})`)
  }
  assertCompactWidth(compactW, authoredColumns)
  return compactW === 'auto' ? authoredW : compactW
}

export function resolveEffectiveHeight(
  h: number,
  reflowing: boolean,
  compactH: 'auto' | number | undefined = 'auto',
): number {
  return reflowing && compactH != null && compactH !== 'auto' ? compactH : h
}

export function validatePlacement(input: unknown, authoredColumns: AuthoredColumns = AUTHORED_COLUMNS): ValidationIssue[] {
  if (!isRecord(input)) return [{ code: 'invalid-placement', message: 'placement must be an object' }]
  const issues: ValidationIssue[] = []
  const { x, y, w = 1, h = 1, id, compactW, compactH, compactBehavior, compactAlign, hideBelowColumns } = input
  const fluid = isFluidColumns(authoredColumns)
  const ceiling = columnCeiling(authoredColumns)
  const hasX = x != null
  const hasY = y != null
  if (fluid && (hasX || hasY)) {
    issues.push({
      code: 'unsupported-in-fluid',
      message: 'x/y coordinates cannot be used with authoredColumns: "fluid". Explicit coordinates address a fixed authored field, and a fluid composition has none — its field is however many modules the material currently holds. Compose with spans and source order (w/h alone), or declare a numeric authoredColumns to position cells.',
    })
  }
  if (fluid && compactW != null) {
    issues.push({
      code: 'unsupported-in-fluid',
      message: 'compactW cannot be used with authoredColumns: "fluid". It names an alternate span for the compact state below the authored ceiling, and a fluid composition has no ceiling and no compact state — w applies at every capacity.',
    })
  }
  if (fluid && compactH != null) {
    issues.push({
      code: 'unsupported-in-fluid',
      message: 'compactH cannot be used with authoredColumns: "fluid". It names an alternate row span for the compact/reflow regime below an authored ceiling, and a fluid composition has neither — h is the cell\'s fixed row span at every fluid capacity. This is rejected even as "auto": the option itself has no state to apply in.',
    })
  }
  if (fluid && compactBehavior != null) {
    issues.push({
      code: 'unsupported-in-fluid',
      message: 'compactBehavior cannot be used with authoredColumns: "fluid". It chooses whether a cell releases or pins its authored coordinates once they no longer fit, and a fluid composition has no authored coordinates to release or pin.',
    })
  }
  if (hasX !== hasY) issues.push({ code: 'incomplete-coordinate', message: 'x and y must be supplied together, or both omitted for flow placement' })
  if (hasX && !isSafeInteger(x)) issues.push({ code: 'non-integer', message: `x must be a safe integer (got ${String(x)})` })
  else if (hasX && (x as number) < 0) issues.push({ code: 'negative-coordinate', message: `x must be ≥ 0 (got ${String(x)})` })
  if (hasY && !isSafeInteger(y)) issues.push({ code: 'non-integer', message: `y must be a safe integer (got ${String(y)})` })
  else if (hasY && (y as number) < 0) issues.push({ code: 'negative-coordinate', message: `y must be ≥ 0 (got ${String(y)})` })
  if (!isSafeInteger(w)) issues.push({ code: 'non-integer', message: `w must be a safe integer (got ${String(w)})` })
  else if (w < 1) issues.push({ code: 'non-positive-span', message: `w must be ≥ 1 (got ${String(w)})` })
  if (!isSafeInteger(h)) issues.push({ code: 'non-integer', message: `h must be a safe integer (got ${String(h)})` })
  else if (h < 1) issues.push({ code: 'non-positive-span', message: `h must be ≥ 1 (got ${String(h)})` })
  if (id != null && typeof id !== 'string') issues.push({ code: 'invalid-id', message: `id must be a string when supplied (got ${String(id)})` })
  if (compactW != null && !fluid) issues.push(...validateCompactWidth(compactW, ceiling))
  if (compactBehavior != null && !fluid) issues.push(...validateCompactBehavior(compactBehavior))
  if (compactAlign != null) issues.push(...validateCompactAlign(compactAlign))
  if (hideBelowColumns != null && !isMaterialColumns(hideBelowColumns, ceiling)) {
    issues.push({ code: 'invalid-option', message: `hideBelowColumns must be a safe integer from 1 to ${ceiling} (got ${String(hideBelowColumns)})` })
  }
  return issues
}

export function assertPlacement(input: unknown, authoredColumns: AuthoredColumns = AUTHORED_COLUMNS): asserts input is UnigridPlacement {
  const issues = validatePlacement(input, authoredColumns)
  if (issues.length) throw new Error(formatIssues('Invalid placement', issues))
}

export function resolvePlacement(input: UnigridPlacement, authoredColumns: AuthoredColumns = AUTHORED_COLUMNS): ResolvedPlacement {
  assertPlacement(input, authoredColumns)
  const w = input.w ?? 1
  const h = input.h ?? 1
  if (input.x == null || input.y == null) return { kind: 'flow', w, h, id: input.id }
  return { kind: 'explicit', x: input.x, y: input.y, w, h, id: input.id }
}

function assertPreserveIsAuthored(authoredColumns: AuthoredColumns, strategy: 'reflow' | 'preserve'): void {
  if (isFluidColumns(authoredColumns) && strategy === 'preserve') {
    throw new Error(`[${PACKAGE_NAME}] strategy "preserve" cannot be used with authoredColumns: "${FLUID_COLUMNS}". Preserve holds the field at the full authored width regardless of capacity, and a fluid composition has no authored width to hold.`)
  }
}

function resolveFlowColumnStart(w: number, activeColumns: MaterialColumns, align: CompactAlign): number {
  if (align === 'center') return Math.max(1, Math.floor((activeColumns - w) / 2) + 1)
  if (align === 'end') return Math.max(1, activeColumns - w + 1)
  return 1
}

export function resolveResponsivePlacement(
  input: UnigridPlacement,
  activeColumns: MaterialColumns,
  strategy: 'reflow' | 'preserve' = 'reflow',
  compactW: CompactWidth = 'auto',
  compactBehavior: CompactBehavior = 'reflow',
  compactAlign: CompactAlign = 'start',
  authoredColumns: AuthoredColumns = AUTHORED_COLUMNS,
): ResponsivePlacement {
  const fluid = isFluidColumns(authoredColumns)
  assertMaterialColumns(activeColumns, 'activeColumns', columnCeiling(authoredColumns))
  if (strategy !== 'reflow' && strategy !== 'preserve') {
    throw new Error(`[${PACKAGE_NAME}] strategy must be "reflow" or "preserve" (got ${String(strategy)})`)
  }
  assertPreserveIsAuthored(authoredColumns, strategy)
  if (!fluid) assertCompactBehavior(compactBehavior)
  assertCompactAlign(compactAlign)
  const authored = resolvePlacement(input, authoredColumns)
  if (fluid) {
    const columnStart = resolveFlowColumnStart(authored.w, activeColumns, compactAlign)
    return Object.freeze({
      kind: 'flow',
      w: authored.w,
      h: authored.h,
      id: authored.id,
      columnStart,
      authoredKind: 'flow',
      authoredW: authored.w,
      compacted: false,
      hidden: isHiddenAtCapacity(input.hideBelowColumns, activeColumns),
    })
  }
  const ceiling = authoredColumns as number
  const responsiveWidth = input.compactW ?? compactW
  const responsiveBehavior = input.compactBehavior ?? compactBehavior
  const responsiveAlign = input.compactAlign ?? compactAlign
  assertCompactWidth(responsiveWidth, ceiling)
  const hidden = isHiddenAtCapacity(input.hideBelowColumns, activeColumns)
  const pinned = responsiveBehavior === 'overflow' && authored.kind === 'explicit'
  if (strategy === 'preserve' || activeColumns === ceiling || pinned) {
    return Object.freeze({ ...authored, authoredKind: authored.kind, authoredW: authored.w, compacted: false, hidden })
  }
  const w = resolveCompactSpan(authored.w, responsiveWidth, ceiling)
  const columnStart = resolveFlowColumnStart(w, activeColumns, responsiveAlign)
  return Object.freeze({
    kind: 'flow',
    w,
    h: authored.h,
    id: authored.id,
    columnStart,
    authoredKind: authored.kind,
    authoredW: authored.w,
    compacted: authored.kind === 'explicit' || w !== authored.w,
    hidden,
  })
}

export interface PackablePlacement {
  kind: 'flow' | 'explicit'
  w: number
  h: number
  compactAlign: CompactAlign
  hidden: boolean
}

export interface PackedPosition {
  row: number
  columnStart: number
}

export function resolvePackedRows(
  placements: readonly PackablePlacement[],
  activeColumns: MaterialColumns,
  authoredColumns: AuthoredColumns = AUTHORED_COLUMNS,
): ReadonlyArray<PackedPosition | null> {
  assertMaterialColumns(activeColumns, 'activeColumns', columnCeiling(authoredColumns))
  const result: Array<PackedPosition | null> = new Array(placements.length).fill(null)

  let rowTrack = 1
  let colCursor = 1
  let rowMaxH = 0
  let rowHasContent = false

  const startNewRow = () => {
    if (rowHasContent) rowTrack += rowMaxH
    colCursor = 1
    rowMaxH = 0
    rowHasContent = false
  }

  placements.forEach((placement, index) => {
    if (placement.hidden || placement.kind !== 'flow') {
      result[index] = null
      return
    }

    if (placement.compactAlign === 'center' || placement.compactAlign === 'end') {
      startNewRow()
      const columnStart = placement.compactAlign === 'center'
        ? Math.max(1, Math.floor((activeColumns - placement.w) / 2) + 1)
        : Math.max(1, activeColumns - placement.w + 1)
      result[index] = { row: rowTrack, columnStart }
      rowMaxH = placement.h
      rowHasContent = true
      startNewRow()
      return
    }

    if (rowHasContent && (colCursor + placement.w - 1) > activeColumns) {
      startNewRow()
    }
    result[index] = { row: rowTrack, columnStart: colCursor }
    colCursor += placement.w
    rowMaxH = Math.max(rowMaxH, placement.h)
    rowHasContent = true
  })

  return Object.freeze(result)
}

export function resolvedPlacementOverflowsField(resolved: ResponsivePlacement, activeColumns: MaterialColumns): boolean {
  const endColumn = resolved.kind === 'explicit'
    ? (resolved.x ?? 0) + resolved.w
    : (resolved.columnStart ?? 1) - 1 + resolved.w
  return endColumn > activeColumns
}

export function anyPlacementOverflowsField(
  placements: readonly UnigridPlacement[],
  activeColumns: MaterialColumns,
  strategy: 'reflow' | 'preserve' = 'reflow',
  authoredColumns: AuthoredColumns = AUTHORED_COLUMNS,
): boolean {
  const fluid = isFluidColumns(authoredColumns)
  assertPreserveIsAuthored(authoredColumns, strategy)
  if (strategy === 'preserve') return false
  for (const placement of placements) {
    if (isHiddenAtCapacity(placement.hideBelowColumns, activeColumns)) continue
    const resolved = resolveResponsivePlacement(
      placement,
      activeColumns,
      strategy,
      fluid ? 'auto' : (placement.compactW ?? 'auto'),
      fluid ? 'reflow' : (placement.compactBehavior ?? 'reflow'),
      'start',
      authoredColumns,
    )
    if (resolvedPlacementOverflowsField(resolved, activeColumns)) return true
  }
  return false
}

export function rowsForContentHeight(contentHeight: number, moduleHeight: number, rowGap: number): number {
  if (!(typeof contentHeight === 'number' && Number.isFinite(contentHeight) && contentHeight >= 0)) throw new Error(`[${PACKAGE_NAME}] contentHeight must be finite and ≥ 0`)
  if (!positiveFinite(moduleHeight) || !nonNegativeFinite(rowGap)) throw new Error(`[${PACKAGE_NAME}] moduleHeight must be > 0 and rowGap must be ≥ 0`)
  return Math.max(1, Math.ceil((contentHeight + rowGap) / (moduleHeight + rowGap)))
}

export function unigridRect(input: UnigridPlacement, metrics: UnigridMetrics): PlacementRect {
  const placement = resolvePlacement(input)
  if (placement.kind !== 'explicit' || placement.x == null || placement.y == null) throw new Error(`[${PACKAGE_NAME}] unigridRect requires explicit x and y coordinates`)
  const left = placement.x * metrics.columnPitch
  const top = placement.y * metrics.rowPitch
  const width = placement.w * metrics.moduleWidth + (placement.w - 1) * metrics.columnGap
  const height = placement.h * metrics.moduleHeight + (placement.h - 1) * metrics.rowGap
  return Object.freeze({ x: placement.x, y: placement.y, w: placement.w, h: placement.h, left, top, right: left + width, bottom: top + height, width, height })
}

export function placementsOverlap(a: UnigridPlacement, b: UnigridPlacement): boolean {
  const first = resolvePlacement(a)
  const second = resolvePlacement(b)
  if (first.kind !== 'explicit' || second.kind !== 'explicit' || first.x == null || first.y == null || second.x == null || second.y == null) return false
  return !(first.x + first.w <= second.x || second.x + second.w <= first.x || first.y + first.h <= second.y || second.y + second.h <= first.y)
}

export function layoutExtent(items: readonly UnigridPlacement[]): { columns: number; rows: number } {
  let columns = 0
  let rows = 0
  for (const item of items) {
    const placement = resolvePlacement(item)
    if (placement.kind === 'explicit' && placement.x != null && placement.y != null) {
      columns = Math.max(columns, placement.x + placement.w)
      rows = Math.max(rows, placement.y + placement.h)
    }
  }
  return { columns, rows }
}

export function validateLayout(input: unknown, options: LayoutValidationOptions = {}): ValidationIssue[] {
  if (!Array.isArray(input)) return [{ code: 'invalid-layout', message: 'layout must be an array of placements' }]
  const issues: ValidationIssue[] = []
  const overlap = options.overlap ?? 'reject'
  const columns = options.columnBoundary
  const authoredColumns = options.authoredColumns ?? AUTHORED_COLUMNS
  if (overlap !== 'reject' && overlap !== 'allow') issues.push({ code: 'invalid-option', message: `overlap must be "reject" or "allow" (got ${String(overlap)})` })
  if (columns != null && !(Number.isSafeInteger(columns) && columns > 0)) issues.push({ code: 'invalid-option', message: `columns must be a safe integer > 0 when supplied (got ${String(columns)})` })

  const placements: Array<{ placement: UnigridPlacement; index: number }> = []
  const ids = new Map<string, number>()
  let previousCoordinate: { x: number; y: number; index: number } | null = null
  input.forEach((item, index) => {
    const itemIssues = validatePlacement(item, authoredColumns)
    for (const issue of itemIssues) issues.push({ ...issue, index })
    if (itemIssues.length) return
    const placement = item as UnigridPlacement
    const resolved = resolvePlacement(placement, authoredColumns)
    if (columns != null) {
      if (resolved.w > columns) issues.push({ code: 'outside-columns', message: `placement at index ${index} spans ${resolved.w} columns in a ${columns}-column grid`, index })
      else if (resolved.kind === 'explicit' && resolved.x != null && resolved.x + resolved.w > columns) issues.push({ code: 'outside-columns', message: `placement at index ${index} ends at column ${resolved.x + resolved.w}, beyond ${columns}`, index })
    }
    if (options.requireResponsiveSourceOrder && resolved.kind === 'explicit' && resolved.x != null && resolved.y != null) {
      if (previousCoordinate && (resolved.y < previousCoordinate.y || (resolved.y === previousCoordinate.y && resolved.x < previousCoordinate.x))) {
        issues.push({ code: 'source-order', message: `placement at index ${index} appears before index ${previousCoordinate.index} visually; source order must follow top-to-bottom, left-to-right order for automatic reflow`, index, otherIndex: previousCoordinate.index })
      }
      previousCoordinate = { x: resolved.x, y: resolved.y, index }
    }
    placements.push({ placement, index })
    if (placement.id != null) {
      const previous = ids.get(placement.id)
      if (previous != null) issues.push({ code: 'duplicate-id', message: `duplicate id "${placement.id}" at indices ${previous} and ${index}`, index, otherIndex: previous })
      else ids.set(placement.id, index)
    }
  })

  if (overlap !== 'allow') {
    const explicit = placements
      .map(({ placement, index }) => ({ placement: resolvePlacement(placement, authoredColumns), index }))
      .filter((item): item is { placement: ResolvedPlacement & { kind: 'explicit'; x: number; y: number }; index: number } => item.placement.kind === 'explicit' && item.placement.x != null && item.placement.y != null)
      .sort((a, b) => a.placement.x - b.placement.x || a.placement.y - b.placement.y || a.index - b.index)
    let active: typeof explicit = []
    for (const current of explicit) {
      active = active.filter((candidate) => candidate.placement.x + candidate.placement.w > current.placement.x)
      for (const candidate of active) {
        const yOverlaps = candidate.placement.y + candidate.placement.h > current.placement.y && current.placement.y + current.placement.h > candidate.placement.y
        if (yOverlaps) {
          const first = Math.min(candidate.index, current.index)
          const second = Math.max(candidate.index, current.index)
          issues.push({ code: 'overlap', message: `explicit placements at indices ${first} and ${second} overlap`, index: first, otherIndex: second })
        }
      }
      active.push(current)
    }
  }
  return issues
}

export function assertLayout(input: unknown, options: LayoutValidationOptions = {}): asserts input is UnigridPlacement[] {
  const issues = validateLayout(input, options)
  if (issues.length) throw new Error(formatIssues('Invalid layout', issues))
}

function withPackedPositions(
  resolvable: readonly UnigridPlacement[],
  placements: readonly ResponsivePlacement[],
  activeColumns: MaterialColumns,
  authoredColumns: AuthoredColumns = AUTHORED_COLUMNS,
): ResponsivePlacement[] {
  const packable: PackablePlacement[] = placements.map((resolved, index) => ({
    kind: resolved.kind,
    w: resolved.w,
    h: resolved.h,
    compactAlign: resolvable[index]?.compactAlign ?? 'start',
    hidden: resolved.hidden,
  }))
  const packed = resolvePackedRows(packable, activeColumns, authoredColumns)
  return placements.map((resolved, index) => {
    const position = packed[index]
    return position == null ? resolved : Object.freeze({ ...resolved, row: position.row, columnStart: position.columnStart })
  })
}

export function auditMaterialStates(
  input: readonly UnigridPlacement[],
  config: UnigridConfig = {},
  throughColumns?: number,
): MaterialAudit {
  assertUnigridConfig(config)
  const authoredColumns = config.authoredColumns ?? AUTHORED_COLUMNS
  const fluid = isFluidColumns(authoredColumns)
  if (fluid && throughColumns == null) {
    throw new Error(`[${PACKAGE_NAME}] auditMaterialStates() needs an explicit throughColumns bound under authoredColumns: "${FLUID_COLUMNS}" — a fluid composition has no ceiling, so there is no complete set of states to enumerate. Pass the widest column count you want audited, e.g. auditMaterialStates(layout, config, 40).`)
  }
  if (throughColumns != null && !isMaterialColumns(throughColumns, MAX_AUTHORED_COLUMNS)) {
    throw new Error(`[${PACKAGE_NAME}] throughColumns must be a safe integer from 1 to ${MAX_AUTHORED_COLUMNS} (got ${String(throughColumns)})`)
  }
  if (!fluid && throughColumns != null && throughColumns > (authoredColumns as number)) {
    throw new Error(`[${PACKAGE_NAME}] throughColumns (${throughColumns}) exceeds authoredColumns (${String(authoredColumns)}) — an authored composition's material never exposes more columns than its ceiling, so those states are unreachable.`)
  }
  const stateCount = throughColumns ?? (authoredColumns as number)
  const issues = validateLayout(input, {
    columnBoundary: fluid ? undefined : (authoredColumns as number),
    overlap: 'reject',
    requireResponsiveSourceOrder: true,
    authoredColumns,
  })
  const resolvable = input.filter((placement) => validatePlacement(placement, authoredColumns).length === 0)
  if (config.reflowFlow != null) assertReflowFlow(config.reflowFlow)
  const reflowFlow = config.reflowFlow ?? 'stack'
  const states = Array.from({ length: stateCount }, (_, index) => {
    const capacityColumns = (index + 1) as MaterialColumns
    const width = fieldWidthForColumns(capacityColumns, config)
    const metrics = resolveUnigrid(width, config)
    const placements = resolvable.map((placement) => resolveResponsivePlacement(
      placement,
      metrics.activeColumns,
      'reflow',
      'auto',
      'reflow',
      'start',
      metrics.authoredColumns,
    ))
    return Object.freeze({
      columns: metrics.activeColumns,
      capacityColumns,
      width,
      placements: Object.freeze(
        reflowFlow === 'pack' ? withPackedPositions(resolvable, placements, metrics.activeColumns, metrics.authoredColumns) : placements,
      ),
    })
  })
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues), states: Object.freeze(states) })
}
