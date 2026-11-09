import {
  Children,
  cloneElement,
  createElement,
  Fragment,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ForwardedRef,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { CELL_EXPECTATION, CELL_MARKER, type CellProps } from './Cell.js'
import { UnigridContext, type UnigridContextValue, type UnigridResponsiveStrategy } from './context.js'
import {
  anyPlacementOverflowsField,
  assertLayout,
  assertCapacityBreakpoints,
  assertMaterialColumns,
  assertReflowFlow,
  assertUnigridConfig,
  AUTHORED_COLUMNS,
  fieldWidthForColumns,
  FLUID_COLUMNS,
  isFluidColumns,
  MAX_AUTHORED_COLUMNS,
  PACKAGE_NAME,
  resolveEffectiveHeight,
  resolvePackedRows,
  resolveResponsivePlacement,
  resolveUnigrid,
  WEB_TEMPLATE_SPEC,
  type AuthoredColumns,
  type LayoutValidationOptions,
  type CapacityBreakpoints,
  type MaterialColumns,
  type PackablePlacement,
  type PackedPosition,
  type ReflowFlow,
  type UnigridMetrics,
  type UnigridPlacement,
} from './spec.js'
import { protectStyle } from './style.js'

export type UnigridElement = 'div' | 'main' | 'section' | 'article' | 'figure' | 'ol' | 'ul'

const UNIGRID_ELEMENTS: ReadonlySet<string> = new Set<UnigridElement>([
  'div', 'main', 'section', 'article', 'figure', 'ol', 'ul',
])

const ROOT_GEOMETRY_STYLE_KEYS: ReadonlySet<string> = new Set([
  'all', 'display', 'position', 'boxSizing', 'grid', 'gridTemplate', 'gridTemplateAreas',
  'gridTemplateColumns', 'gridTemplateRows', 'gridAutoColumns', 'gridAutoRows',
  'gridAutoFlow', 'gridColumnGap', 'gridRowGap', 'columnGap', 'rowGap', 'gap',
  'alignContent', 'justifyContent', 'placeContent', 'alignItems', 'justifyItems',
  'placeItems', 'direction', 'writingMode', 'padding', 'paddingTop', 'paddingRight',
  'paddingBottom', 'paddingLeft', 'paddingBlock', 'paddingInline', 'border',
  'borderWidth', 'width', 'inlineSize', 'minWidth', 'minInlineSize', 'maxWidth', 'maxInlineSize',
  'height', 'blockSize', 'minHeight', 'minBlockSize', 'maxHeight', 'maxBlockSize',
  'overflow', 'overflowX', 'overflowY', 'overflowBlock', 'overflowInline',
  'transform', 'transformOrigin', 'transformBox', 'translate', 'rotate', 'scale',
  'offset', 'offsetPath', 'offsetDistance', 'offsetRotate', 'offsetAnchor', 'offsetPosition', 'zoom',
])

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type MaybeRef<T> = Ref<T> | undefined

function mergeRefs<T>(...refs: MaybeRef<T>[]): (value: T | null) => void {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value)
      else if (ref != null) (ref as MutableRefObject<T | null>).current = value
    }
  }
}

function assertUnigridElement(value: unknown): asserts value is UnigridElement {
  if (typeof value !== 'string' || !UNIGRID_ELEMENTS.has(value)) {
    throw new Error(`[${PACKAGE_NAME}] Unsupported Unigrid element "${String(value)}"`)
  }
}

function assertStrategy(value: unknown): asserts value is UnigridResponsiveStrategy {
  if (value !== 'reflow' && value !== 'preserve') {
    throw new Error(`[${PACKAGE_NAME}] strategy must be "reflow" or "preserve"`)
  }
}

function isCellElement(node: ReactElement): node is ReactElement<CellProps> {
  const type = node.type as unknown as Record<symbol, unknown>
  return type[CELL_MARKER] === true
}

function invalidChildError(): Error {
  return new Error(`[${PACKAGE_NAME}] Unigrid accepts only ${CELL_EXPECTATION} children or React fragments`)
}

interface InternalCellProps {
  __khoPackedPlacement?: PackedPosition | null
}

type CollectedPlacement = UnigridPlacement & {
  compactH?: 'auto' | number
  hidden?: boolean
}

interface CollectedCell {
  placement: CollectedPlacement
  element: ReactElement<CellProps & InternalCellProps>
}

function collectCells(children: ReactNode): CollectedCell[] {
  const cells: CollectedCell[] = []
  Children.forEach(children, (child) => {
    if (child == null || typeof child === 'boolean') return
    if (!isValidElement(child)) throw invalidChildError()
    const element = child as ReactElement
    if (element.type === Fragment) {
      cells.push(...collectCells((element.props as { children?: ReactNode }).children))
      return
    }
    if (!isCellElement(element)) throw invalidChildError()
    const { x, y, w, h, id, compactW, compactBehavior, compactAlign, hideBelowColumns, compactH, hidden } = element.props
    cells.push({
      placement: { x, y, w, h, id, compactW, compactBehavior, compactAlign, hideBelowColumns, compactH, hidden },
      element: element as ReactElement<CellProps & InternalCellProps>,
    })
  })
  return cells
}

function resolvePackedCells(
  cells: readonly CollectedCell[],
  activeColumns: MaterialColumns,
  strategy: UnigridResponsiveStrategy,
  authoredColumns: AuthoredColumns,
): ReadonlyArray<PackedPosition | null> {
  const fluid = isFluidColumns(authoredColumns)
  const packable: PackablePlacement[] = cells.map(({ placement }) => {
    const { x, y, w, h, id, compactW, compactBehavior, hideBelowColumns, compactH, hidden } = placement
    const resolvedCompactW = compactW ?? 'auto'
    const resolvedCompactBehavior = compactBehavior ?? 'reflow'
    const resolvedCompactAlign = placement.compactAlign ?? 'start'
    const resolved = resolveResponsivePlacement(
      fluid
        ? { w, h, id, hideBelowColumns }
        : { x, y, w, h, id, compactW: resolvedCompactW, compactBehavior: resolvedCompactBehavior, hideBelowColumns },
      activeColumns,
      strategy,
      resolvedCompactW,
      resolvedCompactBehavior,
      resolvedCompactAlign,
      authoredColumns,
    )
    const effectiveH = resolveEffectiveHeight(resolved.h, true, fluid ? undefined : compactH)
    return {
      kind: resolved.kind,
      w: resolved.w,
      h: effectiveH,
      compactAlign: resolvedCompactAlign,
      hidden: resolved.hidden || Boolean(hidden),
    }
  })
  return resolvePackedRows(packable, activeColumns, authoredColumns)
}

function px(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0px'
  return `${Number(value.toFixed(6))}px`
}

function guidePattern(
  id: string,
  metrics: UnigridMetrics,
  displayColumns: MaterialColumns,
  displayFieldWidth: number,
  outlineColor: string,
  fillColor: string,
  notchColor: string,
  align: 'start' | 'center',
): ReactElement {
  const stroke = Math.max(1, metrics.moduleWidth * (WEB_TEMPLATE_SPEC.guideStrokePx / WEB_TEMPLATE_SPEC.moduleWidthPx))
  const tickStroke = Math.max(1, metrics.moduleWidth * (WEB_TEMPLATE_SPEC.guideTickStrokePx / WEB_TEMPLATE_SPEC.moduleWidthPx))
  const halfStroke = stroke / 2
  const notchLength = metrics.columnGap / 2
  const innerLeft = halfStroke
  const innerRight = metrics.moduleWidth - halfStroke
  const midY = metrics.moduleHeight / 2

  return createElement(
    'svg',
    {
      'aria-hidden': 'true',
      focusable: 'false',
      className: 'kho-unigrid-guide',
      'data-kho-unigrid-guide-columns': displayColumns,
      'data-kho-unigrid-guide-notch-y': midY,
      'data-kho-unigrid-guide-notch-length': notchLength,
      style: {
        position: 'absolute',
        insetBlock: 0,
        insetInlineStart: align === 'center' ? `calc((100% - ${px(displayFieldWidth)}) / 2)` : 0,
        width: px(displayFieldWidth),
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        color: outlineColor,
        zIndex: 2,
        transform: 'none',
      } satisfies CSSProperties,
    },
    createElement(
      'defs',
      null,
      createElement(
        'pattern',
        { id, patternUnits: 'userSpaceOnUse', width: metrics.columnPitch, height: metrics.rowPitch },
        createElement('rect', {
          x: halfStroke,
          y: halfStroke,
          width: Math.max(0, metrics.moduleWidth - stroke),
          height: Math.max(0, metrics.moduleHeight - stroke),
          fill: fillColor,
          stroke: 'currentColor',
          strokeWidth: stroke,
        }),
        createElement('line', {
          x1: innerLeft,
          y1: midY,
          x2: innerLeft + notchLength,
          y2: midY,
          stroke: notchColor,
          strokeWidth: tickStroke,
        }),
        createElement('line', {
          x1: innerRight - notchLength,
          y1: midY,
          x2: innerRight,
          y2: midY,
          stroke: notchColor,
          strokeWidth: tickStroke,
        }),
      ),
    ),
    createElement('rect', { width: '100%', height: '100%', fill: `url(#${id})` }),
  )
}

export interface UnigridProps extends HTMLAttributes<HTMLElement> {
  as?: UnigridElement
  authoredColumns?: AuthoredColumns
  moduleWidth?: number
  moduleHeight?: number
  columnGap?: number
  rowGap?: number
  initialColumns?: MaterialColumns
  breakpoints?: CapacityBreakpoints
  strategy?: UnigridResponsiveStrategy
  reflowFlow?: ReflowFlow
  previewColumns?: MaterialColumns
  overlap?: LayoutValidationOptions['overlap']
  showGrid?: boolean
  minRows?: number
  guideColor?: string
  guideFillColor?: string
  guideNotchColor?: string
  onMetricsChange?: (metrics: UnigridContextValue) => void
}

export const Unigrid = forwardRef<HTMLElement, UnigridProps>(function Unigrid(
  {
    as: Tag = 'div',
    authoredColumns,
    moduleWidth,
    moduleHeight,
    columnGap,
    rowGap,
    initialColumns = 1,
    breakpoints,
    strategy = 'reflow',
    reflowFlow = 'stack',
    previewColumns,
    overlap = 'reject',
    showGrid = false,
    minRows = 0,
    guideColor = 'rgb(17 17 17 / 0.2)',
    guideFillColor = 'transparent',
    guideNotchColor,
    onMetricsChange,
    className,
    style,
    children,
    ...rest
  },
  forwardedRef: ForwardedRef<HTMLElement>,
) {
  assertUnigridElement(Tag)
  assertStrategy(strategy)
  assertReflowFlow(reflowFlow)
  assertUnigridConfig({ moduleWidth, moduleHeight, columnGap, rowGap, initialColumns, breakpoints, authoredColumns })
  const resolvedAuthoredColumns = authoredColumns ?? AUTHORED_COLUMNS
  const fluid = isFluidColumns(resolvedAuthoredColumns)
  const columnCeiling = fluid ? MAX_AUTHORED_COLUMNS : (resolvedAuthoredColumns as number)
  if (fluid && strategy === 'preserve') {
    throw new Error(`[${PACKAGE_NAME}] strategy="preserve" cannot be combined with authoredColumns="${FLUID_COLUMNS}": preserve holds the field at the full authored width, and a fluid composition has no authored width to hold.`)
  }
  if (breakpoints != null && !fluid) assertCapacityBreakpoints(breakpoints, resolvedAuthoredColumns as number)
  if (previewColumns != null) assertMaterialColumns(previewColumns, 'previewColumns', columnCeiling)
  if (!(Number.isSafeInteger(minRows) && minRows >= 0)) {
    throw new Error(`[${PACKAGE_NAME}] minRows must be a safe integer ≥ 0`)
  }

  const cells = collectCells(children)
  const placements = cells.map((cell) => cell.placement)
  assertLayout(placements, {
    overlap,
    columnBoundary: fluid ? undefined : (resolvedAuthoredColumns as number),
    requireResponsiveSourceOrder: strategy === 'reflow',
    authoredColumns: resolvedAuthoredColumns,
  })

  const config = useMemo(
    () => ({ moduleWidth, moduleHeight, columnGap, rowGap, initialColumns, breakpoints, authoredColumns }),
    [moduleWidth, moduleHeight, columnGap, rowGap, initialColumns, breakpoints, authoredColumns],
  )
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const metrics = useMemo(() => resolveUnigrid(measuredWidth, config), [measuredWidth, config])
  const elementRef = useRef<HTMLElement | null>(null)
  const setRef = useMemo(() => mergeRefs<HTMLElement>(elementRef, forwardedRef), [forwardedRef])
  const rawId = useId()
  const patternId = `kho-unigrid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  useIsomorphicLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return
    const apply = (width: number) => setMeasuredWidth((previous) => Math.abs(previous - width) < 0.01 ? previous : width)
    apply(element.clientWidth)
    if (typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const raw = entry.contentBoxSize as unknown
      const size = Array.isArray(raw) ? (raw[0] as ResizeObserverSize | undefined) : (raw as ResizeObserverSize | undefined)
      apply(size ? size.inlineSize : entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const measuredCapacity = previewColumns ?? metrics.capacityColumns
  const selectedColumns = previewColumns ?? metrics.activeColumns
  const displayColumns = strategy === 'preserve' ? (resolvedAuthoredColumns as number) : selectedColumns
  const displayFieldWidth = fieldWidthForColumns(displayColumns, config)
  const materialState: UnigridContextValue['materialState'] = fluid
    ? 'fluid'
    : strategy === 'preserve'
      ? 'preserve'
      : displayColumns === resolvedAuthoredColumns ? 'authored' : 'reflow'
  const packedPositions = reflowFlow === 'pack' && (materialState === 'reflow' || materialState === 'fluid')
    ? resolvePackedCells(cells, displayColumns, strategy, resolvedAuthoredColumns)
    : null
  const renderedChildren: ReactNode = packedPositions
    ? cells.map((cell, index) => cloneElement(cell.element, {
        key: cell.element.key ?? cell.placement.id ?? `kho-unigrid-packed-${index}`,
        __khoPackedPlacement: packedPositions[index] ?? undefined,
      }))
    : children
  const isOverflowing = measuredWidth > 0 && displayFieldWidth > measuredWidth + 0.01
  const anyCellOverflows = anyPlacementOverflowsField(placements, displayColumns, strategy, resolvedAuthoredColumns)
  const fieldAlignment: 'start' | 'center' = isOverflowing || anyCellOverflows ? 'start' : 'center'
  const residualInlineSpace = Math.max(0, metrics.measuredWidth - displayFieldWidth)
  const centeredMargin = residualInlineSpace / 2

  const context = useMemo<UnigridContextValue>(() => ({
    authoredColumns: resolvedAuthoredColumns,
    activeColumns: displayColumns,
    capacityColumns: measuredCapacity,
    breakpoints: metrics.breakpoints,
    moduleWidth: metrics.moduleWidth,
    moduleHeight: metrics.moduleHeight,
    columnGap: metrics.columnGap,
    rowGap: metrics.rowGap,
    measuredWidth: metrics.measuredWidth,
    fieldWidth: displayFieldWidth,
    residualInlineSpace,
    marginInlineStart: centeredMargin,
    marginInlineEnd: centeredMargin,
    overflowInlineSpace: Math.max(0, displayFieldWidth - metrics.measuredWidth),
    fieldFits: metrics.measuredWidth === 0 || displayFieldWidth <= metrics.measuredWidth + 0.01,
    materialState,
    strategy,
  }), [centeredMargin, displayColumns, displayFieldWidth, materialState, measuredCapacity, metrics, residualInlineSpace, resolvedAuthoredColumns, strategy])

  useEffect(() => {
    onMetricsChange?.(context)
  }, [context, onMetricsChange])

  const minimumHeight = minRows > 0
    ? minRows * metrics.moduleHeight + (minRows - 1) * metrics.rowGap
    : 0

  const variables = {
    '--kho-unigrid-columns': displayColumns,
    '--kho-unigrid-module-width': px(metrics.moduleWidth),
    '--kho-unigrid-module-height': px(metrics.moduleHeight),
    '--kho-unigrid-column-gap': px(metrics.columnGap),
    '--kho-unigrid-row-gap': px(metrics.rowGap),
    '--kho-unigrid-column-pitch': px(metrics.columnPitch),
    '--kho-unigrid-row-pitch': px(metrics.rowPitch),
    '--kho-unigrid-field-width': px(displayFieldWidth),
  } as CSSProperties

  const canonicalStyle = {
    ...variables,
    display: 'grid',
    position: 'relative',
    boxSizing: 'border-box',
    gridTemplateColumns: 'repeat(var(--kho-unigrid-columns), var(--kho-unigrid-module-width))',
    gridAutoColumns: 'var(--kho-unigrid-module-width)',
    gridAutoRows: 'var(--kho-unigrid-module-height)',
    gridAutoFlow: 'row',
    columnGap: 'var(--kho-unigrid-column-gap)',
    rowGap: 'var(--kho-unigrid-row-gap)',
    alignContent: 'start',
    justifyContent: fieldAlignment,
    placeContent: `start ${fieldAlignment}`,
    alignItems: 'stretch',
    justifyItems: 'stretch',
    placeItems: 'stretch',
    direction: 'ltr',
    writingMode: 'horizontal-tb',
    padding: 0,
    border: 0,
    width: '100%',
    minWidth: 0,
    height: 'auto',
    minHeight: px(minimumHeight),
    maxHeight: 'none',
    overflowX: isOverflowing || anyCellOverflows || strategy === 'preserve' ? 'auto' : 'clip',
    overflowY: 'visible',
    transform: 'none',
    transformOrigin: '50% 50%',
    transformBox: 'border-box',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    offsetPath: 'none',
    offsetDistance: 0,
    offsetRotate: 'auto',
    offsetAnchor: 'auto',
    offsetPosition: 'normal',
    zoom: 'normal',
  } satisfies CSSProperties

  return createElement(
    UnigridContext.Provider,
    { value: context },
    createElement(
      Tag as ElementType,
      {
        ...rest,
        ref: setRef as Ref<HTMLElement>,
        className: className ? `kho-unigrid ${className}` : 'kho-unigrid',
        style: protectStyle(style, canonicalStyle, ROOT_GEOMETRY_STYLE_KEYS),
        'data-kho-unigrid': 'website',
        'data-kho-unigrid-authored-columns': resolvedAuthoredColumns,
        'data-kho-unigrid-columns': displayColumns,
        'data-kho-unigrid-capacity': measuredCapacity,
        'data-kho-unigrid-breakpoints': metrics.breakpoints?.join(',') ?? undefined,
        'data-kho-unigrid-state': materialState,
        'data-kho-unigrid-preview': previewColumns ?? undefined,
        'data-kho-unigrid-module-width': Number(metrics.moduleWidth.toFixed(6)),
        'data-kho-unigrid-module-height': Number(metrics.moduleHeight.toFixed(6)),
        'data-kho-unigrid-column-gap': Number(metrics.columnGap.toFixed(6)),
        'data-kho-unigrid-row-gap': Number(metrics.rowGap.toFixed(6)),
        'data-kho-unigrid-field-width': Number(displayFieldWidth.toFixed(6)),
        'data-kho-unigrid-residual': Number(residualInlineSpace.toFixed(6)),
        'data-kho-unigrid-margin-inline-start': Number(centeredMargin.toFixed(6)),
        'data-kho-unigrid-margin-inline-end': Number(centeredMargin.toFixed(6)),
        'data-kho-unigrid-overflow-inline': Number(Math.max(0, displayFieldWidth - metrics.measuredWidth).toFixed(6)),
        'data-kho-unigrid-cell-overflow': anyCellOverflows ? 'true' : 'false',
      },
      showGrid ? guidePattern(
        patternId,
        metrics,
        displayColumns,
        displayFieldWidth,
        guideColor,
        guideFillColor,
        guideNotchColor ?? guideColor,
        fieldAlignment,
      ) : null,
      renderedChildren,
    ),
  )
})

Unigrid.displayName = 'Unigrid'
