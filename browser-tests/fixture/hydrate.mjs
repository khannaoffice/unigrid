import React, { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { Cell, Unigrid } from '@khannaoffice/unigrid'

export function HydrationFixture() {
  return createElement(
    Unigrid,
    { initialColumns: 1, previewColumns: 3 },
    createElement(Cell, { id: 'hydrated-cell', x: 0, y: 0, w: 12, h: 2 }, 'Hydrated'),
  )
}

hydrateRoot(document.getElementById('root'), createElement(HydrationFixture))
requestAnimationFrame(() => {
  document.documentElement.dataset.hydrated = 'true'
})
