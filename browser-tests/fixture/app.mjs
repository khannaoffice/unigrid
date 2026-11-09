import React, { createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Cell,
  Unigrid,
  capacityBreakpoints,
} from '@khannaoffice/unigrid'

function WebsiteFixture() {
  const [showGrid, setShowGrid] = useState(true)
  return createElement(
    React.Fragment,
    null,
    createElement('button', { id: 'toggle-grid', type: 'button', onClick: () => setShowGrid((v) => !v) }, 'toggle'),
    createElement(
      'div',
      { id: 'resize-host', style: { width: '1140px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        {
          showGrid,
          minRows: 6,
          onMetricsChange: (metrics) => {
            window.__UNIGRID_METRICS__ = metrics
            document.documentElement.dataset.capacity = String(metrics.capacityColumns)
          },
        },
        createElement(Cell, { id: 'main-cell', x: 0, y: 0, w: 8, h: 2 },
          createElement('p', null, 'Main content that wraps into the compact material.')),
        createElement(Cell, { id: 'aside-cell', x: 8, y: 0, w: 4, h: 2 },
          createElement('p', null, 'Aside')),
      ),
    ),
    createElement(
      'div',
      { id: 'strict-host', style: { width: '1184px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        {
          moduleWidth: 84,
          moduleHeight: 80,
          columnGap: 16,
          rowGap: 16,
          breakpoints: capacityBreakpoints(2),
          showGrid: true,
          minRows: 4,
          onMetricsChange: (metrics) => {
            const host = document.getElementById('strict-host')
            host.dataset.capacity = String(metrics.capacityColumns)
            host.dataset.columns = String(metrics.activeColumns)
          },
        },
        createElement(Cell, {
          id: 'strict-cell',
          x: 0,
          y: 0,
          w: 12,
          h: 2,
          style: { background: '#1900ff' },
        }, 'Strict surface'),
        createElement(Cell, {
          id: 'invariant-image-cell',
          x: 4,
          y: 2,
          w: 4,
          h: 2,
          compactAlign: 'center',
          style: { background: '#003cff' },
        }, 'Invariant image surface'),
        createElement(Cell, {
          id: 'end-align-cell',
          x: 8,
          y: 2,
          w: 4,
          h: 2,
          compactAlign: 'end',
          style: { background: '#0057ff' },
        }, 'End-aligned surface'),
      ),
    ),
    createElement(
      'div',
      { id: 'overflow-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        {
          onMetricsChange: (metrics) => {
            document.getElementById('overflow-host').dataset.columns = String(metrics.activeColumns)
          },
        },
        createElement(Cell, {
          id: 'overflow-api-cell',
          x: 0,
          y: 0,
          w: 6,
          h: 1,
          compactBehavior: 'overflow',
        }, 'Pinned overflow content'),
      ),
    ),
    createElement(
      'div',
      { id: 'hide-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        {
          onMetricsChange: (metrics) => {
            document.getElementById('hide-host').dataset.columns = String(metrics.activeColumns)
          },
        },
        createElement(Cell, {
          id: 'hide-api-cell',
          x: 0,
          y: 0,
          w: 6,
          h: 1,
          hideBelowColumns: 6,
        }, 'Hidden below six columns'),
      ),
    ),
    createElement(
      'div',
      { id: 'preserve-host', style: { width: '1140px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        {
          strategy: 'preserve',
          onMetricsChange: (metrics) => {
            const host = document.getElementById('preserve-host')
            host.dataset.columns = String(metrics.activeColumns)
            host.dataset.capacity = String(metrics.capacityColumns)
          },
        },
        createElement(Cell, { id: 'preserve-cell', x: 0, y: 0, w: 12, h: 1 }, 'Preserved field'),
        createElement(Cell, {
          id: 'preserve-hide-cell',
          x: 0,
          y: 1,
          w: 4,
          h: 1,
          hideBelowColumns: 12,
        }, 'Would hide below twelve columns under reflow, but preserve pins the field at twelve'),
      ),
    ),
    createElement(
      'div',
      { id: 'rtl-ancestor', dir: 'rtl' },
      createElement(
        'div',
        { id: 'rtl-host', style: { width: '564px', maxWidth: '100%' } },
        createElement(
          Unigrid,
          { style: { direction: 'rtl' } },
          createElement(Cell, {
            id: 'rtl-cell',
            x: 0,
            y: 0,
            w: 3,
            h: 1,
            style: { direction: 'rtl' },
            contentStyle: { direction: 'rtl' },
          }, 'محتوى'),
        ),
      ),
      createElement(
        'div',
        { id: 'pack-rtl-host', style: { width: '564px', maxWidth: '100%' } },
        createElement(
          Unigrid,
          { reflowFlow: 'pack', style: { direction: 'rtl' } },
          createElement(Cell, {
            id: 'pack-rtl-0', w: 2, h: 1,
            style: { direction: 'rtl' }, contentStyle: { direction: 'rtl' },
          }, 'أ'),
          createElement(Cell, {
            id: 'pack-rtl-1', w: 2, h: 1,
            style: { direction: 'rtl' }, contentStyle: { direction: 'rtl' },
          }, 'ب'),
          createElement(Cell, {
            id: 'pack-rtl-2', w: 2, h: 1,
            style: { direction: 'rtl' }, contentStyle: { direction: 'rtl' },
          }, 'ج'),
        ),
      ),
    ),
    createElement(
      'div',
      { id: 'pack-222-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        { reflowFlow: 'pack' },
        createElement(Cell, { id: 'pack222-a', w: 2, h: 1 }, 'A'),
        createElement(Cell, { id: 'pack222-b', w: 2, h: 1 }, 'B'),
        createElement(Cell, { id: 'pack222-c', w: 2, h: 1 }, 'C'),
      ),
    ),
    createElement(
      'div',
      { id: 'pack-42-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        { reflowFlow: 'pack' },
        createElement(Cell, { id: 'pack42-a', w: 4, h: 1 }, 'A'),
        createElement(Cell, { id: 'pack42-b', w: 2, h: 1 }, 'B'),
      ),
    ),
    createElement(
      'div',
      { id: 'pack-44-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        { reflowFlow: 'pack' },
        createElement(Cell, { id: 'pack44-a', w: 4, h: 1 }, 'A'),
        createElement(Cell, { id: 'pack44-b', w: 4, h: 1 }, 'B'),
      ),
    ),
    createElement(
      'div',
      { id: 'pack-align-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        { reflowFlow: 'pack' },
        createElement(Cell, { id: 'pack-align-0', w: 2, h: 1 }, '0'),
        createElement(Cell, { id: 'pack-align-1', w: 2, h: 1, compactAlign: 'center' }, '1'),
        createElement(Cell, { id: 'pack-align-2', w: 2, h: 1 }, '2'),
        createElement(Cell, { id: 'pack-align-3', w: 2, h: 1, compactAlign: 'end' }, '3'),
        createElement(Cell, { id: 'pack-align-4', w: 2, h: 1 }, '4'),
      ),
    ),
    createElement(
      'div',
      { id: 'pack-hidden-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        { reflowFlow: 'pack' },
        createElement(Cell, { id: 'pack-hidden-a', w: 2, h: 1 }, 'A'),
        createElement(Cell, { id: 'pack-hidden-b', w: 2, h: 1, hideBelowColumns: 8 }, 'B'),
        createElement(Cell, { id: 'pack-hidden-c', w: 2, h: 1 }, 'C'),
      ),
    ),
    createElement(
      'div',
      { id: 'pack-compacth-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        { reflowFlow: 'pack' },
        createElement(Cell, { id: 'pack-ch-a', w: 2, h: 1 }, 'A'),
        createElement(Cell, { id: 'pack-ch-b', w: 2, h: 1, compactH: 3 }, 'B'),
      ),
    ),
    createElement(
      'div',
      { id: 'pack-preserve-host', style: { width: '564px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        {
          reflowFlow: 'pack',
          strategy: 'preserve',
          onMetricsChange: (metrics) => {
            document.getElementById('pack-preserve-host').dataset.columns = String(metrics.activeColumns)
          },
        },
        createElement(Cell, { id: 'pack-preserve-a', x: 0, y: 0, w: 4, h: 1 }, 'A'),
        createElement(Cell, { id: 'pack-preserve-b', x: 4, y: 0, w: 4, h: 1 }, 'B'),
      ),
    ),
    createElement(
      'div',
      {
        id: 'pack-resize-host',
        style: { width: '852px', maxWidth: '100%' },
      },
      createElement(
        Unigrid,
        {
          reflowFlow: 'pack',
          onMetricsChange: (metrics) => {
            document.getElementById('pack-resize-host').dataset.columns = String(metrics.activeColumns)
          },
        },
        createElement(Cell, { id: 'pack-resize-a', w: 4, h: 1 }, 'A'),
        createElement(Cell, { id: 'pack-resize-b', w: 4, h: 1 }, 'B'),
      ),
    ),
    createElement(
      'div',
      {
        id: 'pack-sweep-host',
        style: { width: '1140px', maxWidth: '100%' },
      },
      createElement(
        Unigrid,
        {
          reflowFlow: 'pack',
          onMetricsChange: (metrics) => {
            document.getElementById('pack-sweep-host').dataset.columns = String(metrics.activeColumns)
          },
        },
        createElement(Cell, { id: 'pack-sweep-0', w: 2, h: 1 }, '0'),
        createElement(Cell, { id: 'pack-sweep-1', w: 4, h: 1 }, '1'),
        createElement(Cell, { id: 'pack-sweep-2', w: 3, h: 1 }, '2'),
        createElement(Cell, { id: 'pack-sweep-3', w: 5, h: 1 }, '3'),
        createElement(Cell, { id: 'pack-sweep-4', w: 1, h: 1 }, '4'),
        createElement(Cell, { id: 'pack-sweep-5', w: 6, h: 1 }, '5'),
        createElement(Cell, { id: 'pack-sweep-6', w: 2, h: 1 }, '6'),
        createElement(Cell, { id: 'pack-sweep-7', w: 4, h: 1 }, '7'),
      ),
    ),
    createElement(
      'div',
      {
        id: 'wide-authored-host',
        style: { width: '1908px', maxWidth: '100%' },
      },
      createElement(
        Unigrid,
        {
          authoredColumns: 20,
          showGrid: true,
          onMetricsChange: (metrics) => {
            const host = document.getElementById('wide-authored-host')
            host.dataset.capacity = String(metrics.capacityColumns)
            host.dataset.columns = String(metrics.activeColumns)
            host.dataset.authoredColumns = String(metrics.authoredColumns)
          },
        },
        createElement(Cell, { id: 'wide-cell-full', x: 0, y: 0, w: 20, h: 1 }, 'Full twenty-column authored field'),
        createElement(Cell, { id: 'wide-cell-beyond12', x: 16, y: 1, w: 4, h: 1 }, 'Beyond the old twelve-column ceiling'),
        createElement(Cell, { id: 'wide-cell-compact', x: 0, y: 2, w: 6, h: 1, compactW: 3 }, 'Compacts to three below twenty'),
      ),
    ),
    createElement(
      'div',
      { id: 'fluid-host', style: { width: '1236px', maxWidth: '100%' } },
      createElement(
        Unigrid,
        {
          authoredColumns: 'fluid',
          moduleWidth: 84,
          moduleHeight: 80,
          columnGap: 12,
          rowGap: 10,
          reflowFlow: 'pack',
          initialColumns: 13,
          onMetricsChange: (metrics) => {
            const host = document.getElementById('fluid-host')
            host.dataset.capacity = String(metrics.capacityColumns)
            host.dataset.columns = String(metrics.activeColumns)
            host.dataset.authoredColumns = String(metrics.authoredColumns)
            host.dataset.state = String(metrics.materialState)
            host.dataset.fieldWidth = String(metrics.fieldWidth)
            host.dataset.measuredWidth = String(metrics.measuredWidth)
          },
        },
        createElement(Cell, { id: 'fluid-cell-a', w: 4, h: 3 }, 'a'),
        createElement(Cell, { id: 'fluid-cell-b', w: 7, h: 5 }, 'b'),
        createElement(Cell, { id: 'fluid-cell-c', w: 2, h: 2 }, 'c'),
        createElement(Cell, { id: 'fluid-cell-wide', w: 13, h: 1 }, 'thirteen'),
        createElement(Cell, { id: 'fluid-cell-hidden', w: 2, h: 1, hideBelowColumns: 10 }, 'hidden below ten'),
      ),
    ),
  )
}

createRoot(document.getElementById('root')).render(createElement(WebsiteFixture))
requestAnimationFrame(() => {
  document.documentElement.dataset.ready = 'true'
})
