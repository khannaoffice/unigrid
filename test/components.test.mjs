import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Cell, Unigrid } from '../dist/index.js'

test('SSR fallback is one fixed-size module and never fluid-scales geometry', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { showGrid: true, minRows: 3 }, createElement(Cell, { w: 12, h: 2 }, 'A')))
  assert.match(html, /data-kho-unigrid-authored-columns="12"/)
  assert.match(html, /data-kho-unigrid-columns="1"/)
  assert.match(html, /data-kho-unigrid-module-width="84"/)
  assert.match(html, /data-kho-unigrid-module-height="80"/)
  assert.match(html, /data-kho-unigrid-w="12"/)
  assert.match(html, /data-kho-unigrid-field-overflow="true"/)
  assert.match(html, /data-kho-unigrid-cell-overflow="true"/)
  assert.match(html, /overflow-x:auto/)
})

test('preserve strategy keeps the twelve-column composition scrollable', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { strategy: 'preserve' }, createElement(Cell, { x: 8, y: 2, w: 4, h: 2 }, 'A')))
  assert.match(html, /data-kho-unigrid-columns="12"/)
  assert.match(html, /data-kho-unigrid-state="preserve"/)
  assert.match(html, /grid-column-start:9/)
})

test('inline geometry overrides are filtered', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { style: { display: 'block', background: 'white' } }, createElement(Cell, { w: 1, h: 1, style: { margin: 99, transform: 'translateX(10px)', background: 'black' } })))
  assert.match(html, /display:grid/)
  assert.match(html, /background:white/)
  assert.match(html, /background:black/)
  assert.match(html, /margin:0(?:px)?/)
  assert.match(html, /transform:none/)
})

test('fragments are accepted and arbitrary children rejected', () => {
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(Unigrid, null, createElement(Fragment, null, createElement(Cell, { w: 1, h: 1 })))))
  assert.throws(() => renderToStaticMarkup(createElement(Unigrid, null, createElement('div'))), /accepts only .* Cell/)
})

test('preview capacity preserves the authored span and overflows rather than shrinking', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { x: 0, y: 0, w: 8, h: 2 }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-columns="3"/)
  assert.match(html, /data-kho-unigrid-capacity="3"/)
  assert.match(html, /data-kho-unigrid-module-width="84"/)
  assert.match(html, /data-kho-unigrid-w="8"/)
  assert.match(html, /data-kho-unigrid-cell="reflow"/)
  assert.match(html, /data-kho-unigrid-field-overflow="true"/)
  assert.match(html, /data-kho-unigrid-cell-overflow="true"/)
  assert.match(html, /overflow-x:auto/)
})

test('a cell that fits its active field never forces the container into scroll mode', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 6 },
    createElement(Cell, { x: 0, y: 0, w: 4, h: 2 }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-field-overflow="false"/)
  assert.match(html, /data-kho-unigrid-cell-overflow="false"/)
  assert.match(html, /overflow-x:clip/)
})

test('compactAlign never produces a start line below 1, even when the span exceeds the active field', () => {
  const centered = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { w: 4, h: 1, compactAlign: 'center' }, 'A'),
  ))
  assert.match(centered, /grid-column-start:1/)
  assert.doesNotMatch(centered, /grid-column-start:0/)
  assert.doesNotMatch(centered, /grid-column-start:-/)

  const ended = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { w: 4, h: 1, compactAlign: 'end' }, 'A'),
  ))
  assert.match(ended, /grid-column-start:1/)
  assert.doesNotMatch(ended, /grid-column-start:0/)
  assert.doesNotMatch(ended, /grid-column-start:-/)
})

test('compactH defaults to the authored height always; an override must be explicit', () => {
  const authoredHeightOnly = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { w: 1, h: 2 }, 'A'),
  ))
  assert.match(authoredHeightOnly, /data-kho-unigrid-h="2"/)
  assert.match(authoredHeightOnly, /grid-row-end:span 2/)

  const explicitOverride = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { w: 1, h: 2, compactH: 5 }, 'A'),
  ))
  assert.match(explicitOverride, /data-kho-unigrid-h="5"/)
  assert.match(explicitOverride, /grid-row-end:span 5/)

  const authoredState = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 12 },
    createElement(Cell, { w: 1, h: 2, compactH: 5 }, 'A'),
  ))
  assert.match(authoredState, /data-kho-unigrid-h="2"/)
})

test('an explicit numeric compactW is a fixed alternate span, applied unconditionally', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { x: 0, y: 0, w: 8, h: 2, compactW: 2 }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-w="2"/)
  assert.doesNotMatch(html, /data-kho-unigrid-field-overflow="true"/)
})

test('compactBehavior="overflow" keeps a cell pinned at its authored coordinates below capacity', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { x: 8, y: 0, w: 4, h: 2, compactBehavior: 'overflow' }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-cell="explicit"/)
  assert.match(html, /grid-column-start:9/)
  assert.match(html, /grid-column-end:span 4/)
  assert.match(html, /data-kho-unigrid-field-overflow="true"/)
})

test('hideBelowColumns hides a cell exactly at its declared threshold', () => {
  const above = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 4 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 4 }, 'A'),
  ))
  assert.doesNotMatch(above, / hidden(?:=|[\s>])/)
  assert.match(above, /display:block/)

  const below = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 4 }, 'A'),
  ))
  assert.match(below, / hidden=""/)
  assert.match(below, /display:none/)
  assert.doesNotMatch(below, /data-kho-unigrid-cell-overflow="true"/)
})

test('hideBelowColumns at the boundary value 1 never hides the cell, since no active capacity is below 1', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 1 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 1 }, 'A'),
  ))
  assert.doesNotMatch(html, / hidden(?:=|[\s>])/)
  assert.match(html, /display:block/)
})

test('hideBelowColumns at the boundary value 12 hides the cell at every capacity except the full authored state', () => {
  const hiddenAtEleven = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 11 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 12 }, 'A'),
  ))
  assert.match(hiddenAtEleven, / hidden=""/)
  assert.match(hiddenAtEleven, /display:none/)

  const visibleAtTwelve = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 12 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 12 }, 'A'),
  ))
  assert.doesNotMatch(visibleAtTwelve, / hidden(?:=|[\s>])/)
  assert.match(visibleAtTwelve, /display:block/)
})

test('a hidden cell pinned by compactBehavior="overflow" is excluded from the container overflow decision', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 3 },
    createElement(Cell, { x: 8, y: 0, w: 4, h: 2, compactBehavior: 'overflow', hideBelowColumns: 4 }, 'A'),
  ))
  assert.match(html, / hidden=""/)
  assert.match(html, /display:none/)
  assert.match(html, /data-kho-unigrid-field-overflow="true"/)
  assert.match(html, /data-kho-unigrid-cell-overflow="false"/)
  assert.match(html, /overflow-x:clip/)
})

test('compact alignment preserves an invariant span on integer tracks', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { previewColumns: 8 },
    createElement(Cell, {
      x: 4,
      y: 2,
      w: 4,
      h: 3,
      compactAlign: 'center',
    }, 'Image'),
  ))
  assert.match(html, /data-kho-unigrid-w="4"/)
  assert.match(html, /data-kho-unigrid-compact-align="center"/)
  assert.match(html, /grid-column-start:3/)
  assert.match(html, /grid-column-end:span 4/)
  assert.throws(() => renderToStaticMarkup(createElement(
    Unigrid,
    null,
    createElement(Cell, { compactAlign: 'middle' }, 'invalid'),
  )))
})

test('preserve strategy distinguishes visible field from actual material capacity', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { strategy: 'preserve', initialColumns: 3 },
    createElement(Cell, { x: 0, y: 0, w: 12, h: 1 }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-columns="12"/)
  assert.match(html, /data-kho-unigrid-capacity="3"/)
  assert.match(html, /data-kho-unigrid-state="preserve"/)
})

test('under strategy="preserve", hideBelowColumns={12} never hides the cell even when previewColumns simulates a narrow three-column material capacity', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { strategy: 'preserve', previewColumns: 3 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 12 }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-columns="12"/)
  assert.match(html, /data-kho-unigrid-capacity="3"/)
  assert.match(html, /data-kho-unigrid-state="preserve"/)
  assert.doesNotMatch(html, / hidden(?:=|[\s>])/)
  assert.match(html, /display:block/)
})

test('under strategy="preserve", hideBelowColumns={1} never hides the cell either, for the same structural reason', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { strategy: 'preserve', previewColumns: 1 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 1 }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-columns="12"/)
  assert.match(html, /data-kho-unigrid-capacity="1"/)
  assert.match(html, /data-kho-unigrid-state="preserve"/)
  assert.doesNotMatch(html, / hidden(?:=|[\s>])/)
  assert.match(html, /display:block/)
})

test('root height and display-contents escape hatches are filtered', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { style: { height: 20, maxHeight: 20 } },
    createElement(Cell, { w: 1, h: 1, style: { display: 'contents' } }, 'A'),
  ))
  assert.match(html, /height:auto/)
  assert.match(html, /max-height:none/)
  assert.match(html, /display:block/)
  assert.doesNotMatch(html, /display:contents/)
})

function normalizeGuideId(markup) {
  const match = /<pattern id="(kho-unigrid-[^"]+)"/.exec(markup)
  if (!match) return markup
  const [, id] = match
  assert.ok(markup.includes(`url(#${id})`), 'guide pattern id and its url(#...) reference must agree')
  return markup.split(id).join('kho-unigrid-GUIDE')
}

test('REGRESSION: a default composition (no authoredColumns anywhere) renders BYTE-IDENTICAL markup — the most important backward-compat guarantee, locked in as a full-string comparison rather than piecemeal regex checks', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { showGrid: true, previewColumns: 6 },
    createElement(Cell, { x: 0, y: 0, w: 4, h: 2, id: 'a' }, 'A'),
    createElement(Cell, { w: 2, h: 1, id: 'b', compactAlign: 'center' }, 'B'),
  ))
  assert.equal(
    normalizeGuideId(html),
    '<div class="kho-unigrid" style="--kho-unigrid-columns:6;--kho-unigrid-module-width:84px;--kho-unigrid-module-height:80px;--kho-unigrid-column-gap:12px;--kho-unigrid-row-gap:10px;--kho-unigrid-column-pitch:96px;--kho-unigrid-row-pitch:90px;--kho-unigrid-field-width:564px;display:grid;position:relative;box-sizing:border-box;grid-template-columns:repeat(var(--kho-unigrid-columns), var(--kho-unigrid-module-width));grid-auto-columns:var(--kho-unigrid-module-width);grid-auto-rows:var(--kho-unigrid-module-height);grid-auto-flow:row;column-gap:var(--kho-unigrid-column-gap);row-gap:var(--kho-unigrid-row-gap);align-content:start;justify-content:center;place-content:start center;align-items:stretch;justify-items:stretch;place-items:stretch;direction:ltr;writing-mode:horizontal-tb;padding:0;border:0;width:100%;min-width:0;height:auto;min-height:0px;max-height:none;overflow-x:clip;overflow-y:visible;transform:none;transform-origin:50% 50%;transform-box:border-box;translate:none;rotate:none;scale:none;offset-path:none;offset-distance:0;offset-rotate:auto;offset-anchor:auto;offset-position:normal;zoom:normal" data-kho-unigrid="website" data-kho-unigrid-authored-columns="12" data-kho-unigrid-columns="6" data-kho-unigrid-capacity="6" data-kho-unigrid-breakpoints="1,2,3,4,5,6,7,8,9,10,11,12" data-kho-unigrid-state="reflow" data-kho-unigrid-preview="6" data-kho-unigrid-module-width="84" data-kho-unigrid-module-height="80" data-kho-unigrid-column-gap="12" data-kho-unigrid-row-gap="10" data-kho-unigrid-field-width="564" data-kho-unigrid-residual="0" data-kho-unigrid-margin-inline-start="0" data-kho-unigrid-margin-inline-end="0" data-kho-unigrid-overflow-inline="564" data-kho-unigrid-cell-overflow="false"><svg aria-hidden="true" focusable="false" class="kho-unigrid-guide" data-kho-unigrid-guide-columns="6" data-kho-unigrid-guide-notch-y="40" data-kho-unigrid-guide-notch-length="6" style="position:absolute;inset-block:0;inset-inline-start:calc((100% - 564px) / 2);width:564px;height:100%;overflow:hidden;pointer-events:none;color:rgb(17 17 17 / 0.2);z-index:2;transform:none"><defs><pattern id="kho-unigrid-GUIDE" patternUnits="userSpaceOnUse" width="96" height="90"><rect x="1" y="1" width="82" height="78" fill="transparent" stroke="currentColor" stroke-width="2"></rect><line x1="1" y1="40" x2="7" y2="40" stroke="rgb(17 17 17 / 0.2)" stroke-width="1"></line><line x1="77" y1="40" x2="83" y2="40" stroke="rgb(17 17 17 / 0.2)" stroke-width="1"></line></pattern></defs><rect width="100%" height="100%" fill="url(#kho-unigrid-GUIDE)"></rect></svg><div id="a" class="kho-unigrid-cell" style="display:block;position:relative;box-sizing:border-box;inset:auto;top:auto;right:auto;bottom:auto;left:auto;grid-column-start:1;grid-column-end:span 4;grid-row-start:auto;grid-row-end:span 2;order:0;align-self:stretch;justify-self:stretch;place-self:stretch;width:auto;height:auto;min-width:0;min-height:0;max-width:none;max-height:none;margin:0;transform:none;transform-origin:50% 50%;transform-box:border-box;translate:none;rotate:none;scale:none;offset-path:none;offset-distance:0;offset-rotate:auto;offset-anchor:auto;offset-position:normal;zoom:normal;z-index:1;overflow:clip;contain:paint" data-kho-unigrid-cell="reflow" data-kho-unigrid-authored-x="0" data-kho-unigrid-authored-y="0" data-kho-unigrid-authored-w="4" data-kho-unigrid-authored-h="2" data-kho-unigrid-w="4" data-kho-unigrid-compact-w="auto" data-kho-unigrid-compact-align="start" data-kho-unigrid-compact-behavior="reflow" data-kho-unigrid-h="2" data-kho-unigrid-snap="strict" data-kho-unigrid-overflow="false" data-kho-unigrid-field-overflow="false"><div class="kho-unigrid-cell__content" style="position:relative;box-sizing:border-box;width:100%;min-width:0;max-width:100%;margin:0;transform:none;translate:none;rotate:none;scale:none;zoom:normal">A</div></div><div id="b" class="kho-unigrid-cell" style="display:block;position:relative;box-sizing:border-box;inset:auto;top:auto;right:auto;bottom:auto;left:auto;grid-column-start:3;grid-column-end:span 2;grid-row-start:auto;grid-row-end:span 1;order:0;align-self:stretch;justify-self:stretch;place-self:stretch;width:auto;height:auto;min-width:0;min-height:0;max-width:none;max-height:none;margin:0;transform:none;transform-origin:50% 50%;transform-box:border-box;translate:none;rotate:none;scale:none;offset-path:none;offset-distance:0;offset-rotate:auto;offset-anchor:auto;offset-position:normal;zoom:normal;z-index:1;overflow:clip;contain:paint" data-kho-unigrid-cell="reflow" data-kho-unigrid-authored-w="2" data-kho-unigrid-authored-h="1" data-kho-unigrid-w="2" data-kho-unigrid-compact-w="auto" data-kho-unigrid-compact-align="center" data-kho-unigrid-compact-behavior="reflow" data-kho-unigrid-h="1" data-kho-unigrid-snap="strict" data-kho-unigrid-overflow="false" data-kho-unigrid-field-overflow="false"><div class="kho-unigrid-cell__content" style="position:relative;box-sizing:border-box;width:100%;min-width:0;max-width:100%;margin:0;transform:none;translate:none;rotate:none;scale:none;zoom:normal">B</div></div></div>',
  )
})

test('REGRESSION: the plain default SSR fallback (no measured width, no previewColumns, no authoredColumns configured at all) renders BYTE-IDENTICAL markup', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, null,
    createElement(Cell, { x: 0, y: 0, w: 6, h: 1, id: 'solo' }, 'A'),
  ))
  assert.equal(
    html,
    '<div class="kho-unigrid" style="--kho-unigrid-columns:1;--kho-unigrid-module-width:84px;--kho-unigrid-module-height:80px;--kho-unigrid-column-gap:12px;--kho-unigrid-row-gap:10px;--kho-unigrid-column-pitch:96px;--kho-unigrid-row-pitch:90px;--kho-unigrid-field-width:84px;display:grid;position:relative;box-sizing:border-box;grid-template-columns:repeat(var(--kho-unigrid-columns), var(--kho-unigrid-module-width));grid-auto-columns:var(--kho-unigrid-module-width);grid-auto-rows:var(--kho-unigrid-module-height);grid-auto-flow:row;column-gap:var(--kho-unigrid-column-gap);row-gap:var(--kho-unigrid-row-gap);align-content:start;justify-content:start;place-content:start start;align-items:stretch;justify-items:stretch;place-items:stretch;direction:ltr;writing-mode:horizontal-tb;padding:0;border:0;width:100%;min-width:0;height:auto;min-height:0px;max-height:none;overflow-x:auto;overflow-y:visible;transform:none;transform-origin:50% 50%;transform-box:border-box;translate:none;rotate:none;scale:none;offset-path:none;offset-distance:0;offset-rotate:auto;offset-anchor:auto;offset-position:normal;zoom:normal" data-kho-unigrid="website" data-kho-unigrid-authored-columns="12" data-kho-unigrid-columns="1" data-kho-unigrid-capacity="1" data-kho-unigrid-breakpoints="1,2,3,4,5,6,7,8,9,10,11,12" data-kho-unigrid-state="reflow" data-kho-unigrid-module-width="84" data-kho-unigrid-module-height="80" data-kho-unigrid-column-gap="12" data-kho-unigrid-row-gap="10" data-kho-unigrid-field-width="84" data-kho-unigrid-residual="0" data-kho-unigrid-margin-inline-start="0" data-kho-unigrid-margin-inline-end="0" data-kho-unigrid-overflow-inline="84" data-kho-unigrid-cell-overflow="true"><div id="solo" class="kho-unigrid-cell" style="display:block;position:relative;box-sizing:border-box;inset:auto;top:auto;right:auto;bottom:auto;left:auto;grid-column-start:1;grid-column-end:span 6;grid-row-start:auto;grid-row-end:span 1;order:0;align-self:stretch;justify-self:stretch;place-self:stretch;width:auto;height:auto;min-width:0;min-height:0;max-width:none;max-height:none;margin:0;transform:none;transform-origin:50% 50%;transform-box:border-box;translate:none;rotate:none;scale:none;offset-path:none;offset-distance:0;offset-rotate:auto;offset-anchor:auto;offset-position:normal;zoom:normal;z-index:1;overflow:clip;contain:paint" data-kho-unigrid-cell="reflow" data-kho-unigrid-authored-x="0" data-kho-unigrid-authored-y="0" data-kho-unigrid-authored-w="6" data-kho-unigrid-authored-h="1" data-kho-unigrid-w="6" data-kho-unigrid-compact-w="auto" data-kho-unigrid-compact-align="start" data-kho-unigrid-compact-behavior="reflow" data-kho-unigrid-h="1" data-kho-unigrid-snap="strict" data-kho-unigrid-overflow="false" data-kho-unigrid-field-overflow="true"><div class="kho-unigrid-cell__content" style="position:relative;box-sizing:border-box;width:100%;min-width:0;max-width:100%;margin:0;transform:none;translate:none;rotate:none;scale:none;zoom:normal">A</div></div></div>',
  )
})

test('<Unigrid authoredColumns={20}> reports the configured ceiling and a 1..20 breakpoint sequence, not 12', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 20 },
    createElement(Cell, { w: 20, h: 1 }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-authored-columns="20"/)
  assert.match(html, /data-kho-unigrid-columns="20"/)
  assert.match(html, /data-kho-unigrid-capacity="20"/)
  assert.match(html, /data-kho-unigrid-breakpoints="1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20"/)
  assert.match(html, /data-kho-unigrid-state="authored"/)
  assert.match(html, /data-kho-unigrid-field-width="1908"/)
  assert.match(html, /data-kho-unigrid-cell-overflow="false"/)
  assert.match(html, /data-kho-unigrid-field-overflow="false"/)
})

test('<Unigrid authoredColumns={20}> drops to "reflow" below its OWN 20-column ceiling, not below 12', () => {
  const html = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 19 },
    createElement(Cell, { w: 20, h: 1 }, 'A'),
  ))
  assert.match(html, /data-kho-unigrid-authored-columns="20"/)
  assert.match(html, /data-kho-unigrid-columns="19"/)
  assert.match(html, /data-kho-unigrid-state="reflow"/)
  assert.match(html, /data-kho-unigrid-cell-overflow="true"/)
  assert.match(html, /data-kho-unigrid-field-overflow="true"/)
})

test('previewColumns validates against the CONFIGURED ceiling: 15 is valid at authoredColumns=20, invalid (throws) at the default 12, and invalid above the 20 ceiling itself', () => {
  const valid = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 15 },
    createElement(Cell, { w: 1, h: 1 }, 'A'),
  ))
  assert.match(valid, /data-kho-unigrid-columns="15"/)
  assert.match(valid, /data-kho-unigrid-authored-columns="20"/)

  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { previewColumns: 15 }, createElement(Cell, { w: 1, h: 1 }))),
    /previewColumns must be a safe integer from 1 to 12 \(got 15\)/,
  )

  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 21 }, createElement(Cell, { w: 1, h: 1 }))),
    /previewColumns must be a safe integer from 1 to 20 \(got 21\)/,
  )
})

test('initialColumns (the SSR/no-measurement fallback) validates against the CONFIGURED ceiling the same way previewColumns does', () => {
  const valid = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, initialColumns: 15 },
    createElement(Cell, { w: 1, h: 1 }, 'A'),
  ))
  assert.match(valid, /data-kho-unigrid-capacity="15"/)
  assert.match(valid, /data-kho-unigrid-columns="15"/)

  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { initialColumns: 15 }, createElement(Cell, { w: 1, h: 1 }))),
    /initialColumns must be a safe integer from 1 to 12 \(got 15\)/,
  )

  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, initialColumns: 21 }, createElement(Cell, { w: 1, h: 1 }))),
    /initialColumns must be a safe integer from 1 to 20 \(got 21\)/,
  )
})

test('authoredColumns itself rejects zero, negative, non-integer, NaN, and absurdly large values; the 10,000 sanity boundary is still accepted', () => {
  const rejects = (authoredColumns) => assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns }, createElement(Cell, { w: 1, h: 1 }))),
    new RegExp(`authoredColumns must be "fluid" or a safe integer from 1 to 10000 \\(got ${String(authoredColumns)}\\)`),
  )
  rejects(0)
  rejects(-1)
  rejects(1.5)
  rejects(NaN)
  rejects(10_001)

  assert.doesNotThrow(() => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 10_000, previewColumns: 1 }, createElement(Cell, { w: 1, h: 1 }))))
})

test('hideBelowColumns, within its legal range, keeps hiding/showing correctly against a wider CONFIGURED ceiling\'s active-column count, not against a hardcoded 12', () => {
  const hiddenBelow = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 9 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 10 }, 'A'),
  ))
  assert.match(hiddenBelow, / hidden=""/)

  const visibleAtThreshold = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 10 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 10 }, 'A'),
  ))
  assert.doesNotMatch(visibleAtThreshold, / hidden(?:=|[\s>])/)

  const visibleAtCeiling = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 20 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 10 }, 'A'),
  ))
  assert.doesNotMatch(visibleAtCeiling, / hidden(?:=|[\s>])/)
})

test('CLOSED GAP: hideBelowColumns and compactW above 12 are now accepted under a widened authoredColumns, and still correctly rejected under the default (or a narrower configured) ceiling', () => {
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, {}, createElement(Cell, { w: 1, h: 1, hideBelowColumns: 15 }, 'A'))),
    /hideBelowColumns must be a safe integer from 1 to 12 \(got 15\)/,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 14 }, createElement(Cell, { w: 1, h: 1, hideBelowColumns: 15 }, 'A'))),
    /hideBelowColumns must be a safe integer from 1 to 14 \(got 15\)/,
  )
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 20 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 15 }, 'A'),
  )), 'hideBelowColumns=15 should be legal under authoredColumns=20')
  const hiddenBelow = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 14 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 15 }, 'A'),
  ))
  assert.match(hiddenBelow, / hidden=""/)
  const visibleAtThreshold = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 15 },
    createElement(Cell, { w: 1, h: 1, hideBelowColumns: 15 }, 'A'),
  ))
  assert.doesNotMatch(visibleAtThreshold, / hidden(?:=|[\s>])/)
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20 }, createElement(Cell, { w: 1, h: 1, hideBelowColumns: 21 }, 'A'))),
    /hideBelowColumns must be a safe integer from 1 to 20 \(got 21\)/,
  )

  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, {}, createElement(Cell, { x: 0, y: 0, w: 1, h: 1, compactW: 15 }, 'A'))),
    /compactW must be "auto" or a safe integer from 1 to 12 \(got 15\)/,
  )
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 14 }, createElement(Cell, { x: 0, y: 0, w: 1, h: 1, compactW: 15 }, 'A'))),
    /compactW must be "auto" or a safe integer from 1 to 14 \(got 15\)/,
  )
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 20 },
    createElement(Cell, { x: 0, y: 0, w: 1, h: 1, compactW: 15 }, 'A'),
  )), 'compactW=15 should be legal under authoredColumns=20')
  assert.throws(
    () => renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20 }, createElement(Cell, { x: 0, y: 0, w: 1, h: 1, compactW: 21 }, 'A'))),
    /compactW must be "auto" or a safe integer from 1 to 20 \(got 21\)/,
  )
})

test('compactBehavior\'s authored/pinned boundary reacts to the CONFIGURED ceiling, not a hardcoded 12: a default-reflow cell stays pinned only exactly at the configured authored state', () => {
  const atCeiling = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 20 },
    createElement(Cell, { x: 0, y: 0, w: 2, h: 1, compactBehavior: 'reflow' }, 'A'),
  ))
  assert.match(atCeiling, /data-kho-unigrid-cell="explicit"/)

  const belowCeiling = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 15 },
    createElement(Cell, { x: 0, y: 0, w: 2, h: 1, compactBehavior: 'reflow' }, 'A'),
  ))
  assert.match(belowCeiling, /data-kho-unigrid-cell="reflow"/)

  const pinnedBelowCeiling = renderToStaticMarkup(createElement(Unigrid, { authoredColumns: 20, previewColumns: 15 },
    createElement(Cell, { x: 0, y: 0, w: 2, h: 1, compactBehavior: 'overflow' }, 'A'),
  ))
  assert.match(pinnedBelowCeiling, /data-kho-unigrid-cell="explicit"/)
})
