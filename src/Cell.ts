import {
  createElement,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type MutableRefObject,
  type Ref,
} from 'react'
import { useUnigrid } from './context.js'
import {
  assertCompactAlign,
  assertCompactBehavior,
  assertPlacement,
  AUTHORED_COLUMNS,
  isFluidColumns,
  MAX_AUTHORED_COLUMNS,
  isHiddenAtCapacity,
  isMaterialColumns,
  PACKAGE_NAME,
  resolveEffectiveHeight,
  resolvedPlacementOverflowsField,
  resolveResponsivePlacement,
  type CompactAlign,
  type CompactBehavior,
  type CompactWidth,
  type MaterialColumns,
  type PackedPosition,
  type UnigridPlacement,
} from './spec.js'
import { protectStyle } from './style.js'

export const CELL_MARKER = Symbol.for('@khannaoffice/unigrid/Cell')

export type CellElement =
  | 'div' | 'main' | 'section' | 'article' | 'header' | 'footer' | 'aside'
  | 'nav' | 'figure' | 'figcaption' | 'li'

const CELL_ELEMENTS: ReadonlySet<string> = new Set<CellElement>([
  'div', 'main', 'section', 'article', 'header', 'footer', 'aside', 'nav',
  'figure', 'figcaption', 'li',
])

const CELL_GEOMETRY_STYLE_KEYS: ReadonlySet<string> = new Set([
  'all', 'display', 'position', 'boxSizing', 'inset', 'insetBlock', 'insetBlockStart',
  'insetBlockEnd', 'insetInline', 'insetInlineStart', 'insetInlineEnd', 'top',
  'right', 'bottom', 'left', 'grid', 'gridArea', 'gridColumn', 'gridColumnStart',
  'gridColumnEnd', 'gridRow', 'gridRowStart', 'gridRowEnd', 'order', 'alignSelf',
  'justifySelf', 'placeSelf', 'width', 'height', 'inlineSize', 'blockSize',
  'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'minInlineSize', 'minBlockSize',
  'maxInlineSize', 'maxBlockSize', 'margin', 'marginTop', 'marginRight',
  'marginBottom', 'marginLeft', 'marginBlock', 'marginBlockStart', 'marginBlockEnd',
  'marginInline', 'marginInlineStart', 'marginInlineEnd', 'transform',
  'transformOrigin', 'transformBox', 'translate', 'rotate', 'scale', 'offset',
  'offsetPath', 'offsetDistance', 'offsetRotate', 'offsetAnchor', 'offsetPosition', 'zoom',
  'overflow', 'overflowX', 'overflowY', 'overflowBlock', 'overflowInline', 'contain',
])

const CONTENT_GEOMETRY_STYLE_KEYS: ReadonlySet<string> = new Set([
  'all', 'position', 'inset', 'top', 'right', 'bottom', 'left',
  'boxSizing', 'width', 'inlineSize', 'minWidth', 'minInlineSize', 'maxWidth',
  'maxInlineSize', 'margin', 'marginTop', 'marginRight', 'marginBottom',
  'marginLeft', 'marginBlock', 'marginInline', 'transform', 'translate',
  'rotate', 'scale', 'zoom',
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

export interface CellProps extends HTMLAttributes<HTMLElement>, UnigridPlacement {
  as?: CellElement
  compactW?: CompactWidth
  compactAlign?: CompactAlign
  compactBehavior?: CompactBehavior
  hideBelowColumns?: MaterialColumns
  compactH?: 'auto' | number
  snap?: 'strict' | 'overflow'
  contentClassName?: string
  contentStyle?: CSSProperties
}

interface InternalCellProps {
  __khoPackedPlacement?: PackedPosition | null
}

function assertCellElement(value: unknown): asserts value is CellElement {
  if (typeof value !== 'string' || !CELL_ELEMENTS.has(value)) {
    throw new Error(`[${PACKAGE_NAME}] Unsupported Cell element "${String(value)}"`)
  }
}

function assertCompactH(value: unknown): asserts value is 'auto' | number | undefined {
  if (value === undefined || value === 'auto') return
  if (!(Number.isSafeInteger(value) && (value as number) > 0)) {
    throw new Error(`[${PACKAGE_NAME}] compactH must be "auto" or a safe integer > 0 when supplied`)
  }
}

function assertHideBelowColumns(value: unknown, maxColumns: number = AUTHORED_COLUMNS): asserts value is MaterialColumns | undefined {
  if (value !== undefined && !isMaterialColumns(value, maxColumns)) {
    throw new Error(`[${PACKAGE_NAME}] hideBelowColumns must be a safe integer from 1 to ${maxColumns} when supplied`)
  }
}

function assertSnap(value: unknown): asserts value is 'strict' | 'overflow' {
  if (value !== 'strict' && value !== 'overflow') {
    throw new Error(`[${PACKAGE_NAME}] snap must be "strict" or "overflow"`)
  }
}

export const Cell = forwardRef<HTMLElement, CellProps>(function Cell(props, forwardedRef) {
  const {
    as: Tag = 'div',
    x,
    y,
    w = 1,
    h = 1,
    compactW = 'auto',
    compactAlign = 'start',
    compactBehavior = 'reflow',
    hideBelowColumns,
    compactH,
    snap = 'strict',
    id,
    hidden,
    className,
    style,
    contentClassName,
    contentStyle,
    __khoPackedPlacement,
    children,
    ...rest
  } = props as CellProps & InternalCellProps
  assertCellElement(Tag)
  const grid = useUnigrid()
  const fluid = isFluidColumns(grid.authoredColumns)
  const columnCeiling = fluid ? MAX_AUTHORED_COLUMNS : (grid.authoredColumns as number)
  const authoredCompactW = (props as CellProps).compactW !== undefined
  const authoredCompactBehavior = (props as CellProps).compactBehavior !== undefined
  const authoredCompactH = (props as CellProps).compactH !== undefined
  assertCompactAlign(compactAlign)
  if (!fluid) assertCompactBehavior(compactBehavior)
  assertHideBelowColumns(hideBelowColumns, columnCeiling)
  assertCompactH(compactH)
  assertSnap(snap)
  const input = fluid
    ? {
        x,
        y,
        w,
        h,
        id,
        hideBelowColumns,
        ...(authoredCompactW ? { compactW } : {}),
        ...(authoredCompactBehavior ? { compactBehavior } : {}),
        ...(authoredCompactH ? { compactH } : {}),
      }
    : { x, y, w, h, id, compactW, compactBehavior, hideBelowColumns }
  assertPlacement(input, grid.authoredColumns)
  const reflowing = grid.materialState === 'reflow' || grid.materialState === 'fluid'
  const resolved = resolveResponsivePlacement(
    input,
    grid.activeColumns,
    grid.strategy,
    compactW,
    compactBehavior,
    compactAlign,
    grid.authoredColumns,
  )
  const effectiveW = resolved.w
  const effectiveH = resolveEffectiveHeight(resolved.h, reflowing, compactH)
  const usePackedPlacement = reflowing && __khoPackedPlacement != null
  const gridColumnStart = usePackedPlacement
    ? (__khoPackedPlacement as PackedPosition).columnStart
    : resolved.kind === 'explicit' ? (resolved.x as number) + 1 : resolved.columnStart ?? 'auto'
  const gridRowStart = usePackedPlacement
    ? (__khoPackedPlacement as PackedPosition).row
    : resolved.kind === 'explicit' ? (resolved.y as number) + 1 : 'auto'
  const capacityHidden = isHiddenAtCapacity(hideBelowColumns, grid.activeColumns)
  const isHidden = Boolean(hidden) || capacityHidden
  const fieldOverflow = resolvedPlacementOverflowsField(resolved, grid.activeColumns)

  const outerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const setRef = useMemo(() => mergeRefs<HTMLElement>(outerRef, forwardedRef), [forwardedRef])
  const [contentOverflow, setContentOverflow] = useState(false)

  useIsomorphicLayoutEffect(() => {
    const outer = outerRef.current
    const content = contentRef.current
    if (!outer || !content) return

    const measure = () => {
      const computed = getComputedStyle(outer)
      const verticalExtras =
        parseFloat(computed.paddingTop || '0') + parseFloat(computed.paddingBottom || '0') +
        parseFloat(computed.borderTopWidth || '0') + parseFloat(computed.borderBottomWidth || '0')
      const naturalHeight = content.getBoundingClientRect().height + verticalExtras
      const assignedHeight = effectiveH * grid.moduleHeight + (effectiveH - 1) * grid.rowGap
      setContentOverflow(naturalHeight > assignedHeight + 0.5)
    }

    measure()
    if (typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [effectiveH, grid.moduleHeight, grid.rowGap])

  const canonicalStyle = {
    display: isHidden ? 'none' : 'block',
    position: 'relative',
    boxSizing: 'border-box',
    inset: 'auto',
    top: 'auto',
    right: 'auto',
    bottom: 'auto',
    left: 'auto',
    gridColumnStart,
    gridColumnEnd: `span ${effectiveW}`,
    gridRowStart,
    gridRowEnd: `span ${effectiveH}`,
    order: 0,
    alignSelf: 'stretch',
    justifySelf: 'stretch',
    placeSelf: 'stretch',
    width: 'auto',
    height: 'auto',
    minWidth: 0,
    minHeight: 0,
    maxWidth: 'none',
    maxHeight: 'none',
    margin: 0,
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
    zIndex: 1,
    overflow: snap === 'strict' ? 'clip' : 'visible',
    contain: snap === 'strict' ? 'paint' : 'none',
  } satisfies CSSProperties

  const innerStyle = {
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    margin: 0,
    transform: 'none',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    zoom: 'normal',
  } satisfies CSSProperties

  return createElement(
    Tag as ElementType,
    {
      ...rest,
      ref: setRef as Ref<HTMLElement>,
      id,
      hidden: isHidden,
      className: className ? `kho-unigrid-cell ${className}` : 'kho-unigrid-cell',
      style: protectStyle(style, canonicalStyle, CELL_GEOMETRY_STYLE_KEYS),
      'data-kho-unigrid-cell': resolved.kind === 'flow' && reflowing ? 'reflow' : resolved.kind,
      'data-kho-unigrid-authored-x': x,
      'data-kho-unigrid-authored-y': y,
      'data-kho-unigrid-authored-w': w,
      'data-kho-unigrid-authored-h': h,
      'data-kho-unigrid-w': effectiveW,
      'data-kho-unigrid-compact-w': compactW,
      'data-kho-unigrid-compact-align': compactAlign,
      'data-kho-unigrid-compact-behavior': compactBehavior,
      'data-kho-unigrid-h': effectiveH,
      'data-kho-unigrid-snap': snap,
      'data-kho-unigrid-overflow': contentOverflow ? 'true' : 'false',
      'data-kho-unigrid-field-overflow': fieldOverflow ? 'true' : 'false',
      'data-kho-unigrid-hidden-below-columns': hideBelowColumns,
    },
    createElement(
      'div',
      {
        ref: contentRef,
        className: contentClassName ? `kho-unigrid-cell__content ${contentClassName}` : 'kho-unigrid-cell__content',
        style: protectStyle(contentStyle, innerStyle, CONTENT_GEOMETRY_STYLE_KEYS),
      },
      children,
    ),
  )
})

Object.defineProperty(Cell, CELL_MARKER, { value: true })
Cell.displayName = 'Cell'

export const CELL_EXPECTATION = `${PACKAGE_NAME} Cell` as const
