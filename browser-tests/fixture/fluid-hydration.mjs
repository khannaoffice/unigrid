import { createElement } from 'react'
import { Cell, Unigrid } from '../../dist/index.js'

export function FluidHydrationFixture() {
  return createElement(
    'div',
    { id: 'fluid-hydration-host', style: { width: '1236px', maxWidth: '100%' } },
    createElement(
      Unigrid,
      {
        authoredColumns: 'fluid',
        moduleWidth: 84,
        moduleHeight: 80,
        columnGap: 12,
        rowGap: 10,
        reflowFlow: 'pack',
        initialColumns: 4,
      },
      createElement(Cell, { id: 'fluid-hydrated-a', w: 4, h: 2 }, 'a'),
      createElement(Cell, { id: 'fluid-hydrated-b', w: 4, h: 2 }, 'b'),
      createElement(Cell, { id: 'fluid-hydrated-c', w: 2, h: 1 }, 'c'),
    ),
  )
}
