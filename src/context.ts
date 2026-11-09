import { createContext, useContext } from 'react'
import type { AuthoredColumns, CapacityBreakpoints, MaterialColumns, MaterialState } from './spec.js'

export type UnigridResponsiveStrategy = 'reflow' | 'preserve'

export interface UnigridContextValue {
  authoredColumns: AuthoredColumns
  activeColumns: MaterialColumns
  capacityColumns: MaterialColumns
  breakpoints: CapacityBreakpoints | null
  moduleWidth: number
  moduleHeight: number
  columnGap: number
  rowGap: number
  measuredWidth: number
  fieldWidth: number
  residualInlineSpace: number
  marginInlineStart: number
  marginInlineEnd: number
  overflowInlineSpace: number
  fieldFits: boolean
  materialState: MaterialState | 'preserve'
  strategy: UnigridResponsiveStrategy
}

export const UnigridContext = createContext<UnigridContextValue | null>(null)

export function useUnigrid(): UnigridContextValue {
  const value = useContext(UnigridContext)
  if (value == null) {
    throw new Error('[@khannaoffice/unigrid] useUnigrid must be used inside Unigrid')
  }
  return value
}
