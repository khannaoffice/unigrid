import React, { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Cell, Unigrid } from '@khannaoffice/unigrid'

function DistantFixture() {
  return createElement(
    'div',
    { id: 'distant-host', style: { width: '1140px', maxWidth: '100%' } },
    createElement(
      Unigrid,
      { previewColumns: 12 },
      createElement(Cell, { id: 'distant-cell', x: 0, y: 100000, w: 12, h: 1 }, 'Distant'),
    ),
  )
}

createRoot(document.getElementById('root')).render(createElement(DistantFixture))
requestAnimationFrame(() => {
  document.documentElement.dataset.ready = 'true'
})
