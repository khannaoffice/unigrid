# Unigrid

Unigrid gives every format the same underlying structure, so a layout can move naturally from one size to another.

It is a grid for React with a module that keeps its size. You set the module once. As the space around it changes, the grid holds more modules or fewer, and each one stays whole.

## Where it comes from

Unigrid follows the publication system of the United States National Park Service. Development of the original system began in 1977 under Publications Chief Vincent Gleason, with Massimo Vignelli as its designer. The Service specified it for paper in 1985.

On paper, the B-module was 7 picas wide and 80 points high, with 1 pica between columns and 10 points between rows. In points that is 84 by 80, with 12 and 10 between. Unigrid uses the same numbers in CSS pixels. A pixel and a point are different lengths, so what carries over is the proportion and the way the modules relate.

Nothing in the original was designed for a screen. The reconstruction is KhannaOffice's, and the paper that sets it out is [Unigrid: The National Park Service Publication System, Reconstructed](https://khannaoffice.com/research/unigrid/).

## Install

```bash
npm install @khannaoffice/unigrid react
```

```tsx
import { Unigrid, Cell } from '@khannaoffice/unigrid'
```

Unigrid works with React 18 and React 19. It is an ES module.

## A first layout

```tsx
<Unigrid>
  <Cell x={0} y={0} w={8} h={4}>
    Main
  </Cell>

  <Cell x={8} y={0} w={4} h={4}>
    Aside
  </Cell>
</Unigrid>
```

While the full field fits, each cell sits exactly where you placed it. When the field no longer fits, the cells let go of their positions together and follow one another in source order. Each cell keeps the span you gave it.

## Four terms

```text
Unigrid    the field
Cell       a rectangle within the field
w / h      the span of a Cell
x / y      its position, when you place it
```

The module and the gaps between modules stay fixed once you set them. The material is the measured inline width of the `Unigrid` element. Unigrid watches that width and works out how many whole modules it holds.

A proportional grid stretches a layout as its frame changes. Unigrid keeps the module and changes how many of them the field holds, so a layout responds for a reason you can read in its own structure.

Unigrid has no phone grid, tablet grid or desktop grid. Those are names for devices. Unigrid works from the module and the width in front of it.

## The default module

The default is the B-module, measured from the Service's Unigrid Design Specifications of 1985.

```text
module width          84 px
module height         80 px
column gap            12 px
row gap               10 px
authored columns      12
rows                  unlimited
```

A full field of twelve columns is 1,140 px wide:

```text
12(84) + 11(12) = 1,140 px
```

In 390 px, four whole modules fit:

```text
4(84) + 3(12) = 372 px
```

Each of the four is still 84 by 80. The field becomes four modules wide, and nothing is compressed.

## Two kinds of layout

```text
authored    position + span
fluid       sequence + span
```

An authored layout has a field of a set width, and each cell has a position in it. A fluid layout has no set field: cells have spans, and they fill the field in source order. Both keep the same module.

### Authored

```tsx
<Unigrid>
  <Cell x={0} y={0} w={8} h={4}>
    Main
  </Cell>

  <Cell x={8} y={0} w={4} h={4}>
    Aside
  </Cell>
</Unigrid>
```

The authored field is twelve modules wide unless you set another width, for example with `authoredColumns={16}`. While the whole field fits, the layout appears exactly as you made it.

When the field no longer fits, every cell lets go of its position at once. A layout is one arrangement in two dimensions. Keeping the positions that happen to fit and moving the rest would make an arrangement you never designed.

Spans get the same care. A cell keeps its `w` and `h` after its position is released. If the cell is wider than the field, it keeps its width and the field scrolls sideways, so the whole cell can still be reached. When a narrower span is part of your design, say so with `compactW` or `compactH`.

Cells in source order can flow in two ways. `reflowFlow="stack"`, the default, gives each cell its own row. `reflowFlow="pack"` fills each row from left to right before starting the next.

```tsx
<Unigrid reflowFlow="pack">
  <Cell x={0} y={0} w={8} h={4}>Main</Cell>
  <Cell x={8} y={0} w={4} h={4}>Aside</Cell>
</Unigrid>
```

To keep an authored layout whole at every width, use `strategy="preserve"`. The full field stays, and it scrolls sideways when the material is narrower.

### Fluid

```tsx
<Unigrid
  authoredColumns="fluid"
  reflowFlow="pack"
>
  <Cell w={4} h={3}>One</Cell>
  <Cell w={6} h={3}>Two</Cell>
  <Cell w={2} h={2}>Three</Cell>
</Unigrid>
```

A fluid layout takes every whole module the material holds, and the cells fill it in source order. As the material grows, more modules appear. As it narrows, fewer remain. The module stays as you set it.

A fluid layout has no authored state, so Unigrid rejects the settings that describe one: `x`, `y`, `compactW`, `compactH`, `compactBehavior`, `breakpoints` and `strategy="preserve"`. You learn of the mismatch while you write the layout.

## Set another module

The B-module is the default, so these two are the same:

```tsx
<Unigrid>
  …
</Unigrid>
```

```tsx
<Unigrid
  moduleWidth={84}
  moduleHeight={80}
  columnGap={12}
  rowGap={10}
>
  …
</Unigrid>
```

Set another module when the work calls for one:

```tsx
<Unigrid
  moduleWidth={96}
  moduleHeight={91.428571}
  columnGap={13.714286}
  rowGap={11.428571}
>
  …
</Unigrid>
```

When you set only `moduleWidth`, the rest keep the proportions of the B-module:

```text
moduleHeight = moduleWidth × 80/84
columnGap    = moduleWidth × 12/84
rowGap       = moduleWidth × 10/84
```

A new module is a new fixed geometry. From then on the grid changes how many modules it holds. It does not resize the module as the window changes.

## Start from the width of the field

Sometimes you know how wide the full twelve-column field should be before you know the module. `configForAuthoredFieldWidth` works out the module once:

```tsx
import {
  Unigrid,
  configForAuthoredFieldWidth,
} from '@khannaoffice/unigrid'

const geometry = configForAuthoredFieldWidth(1440)

<Unigrid {...geometry}>
  …
</Unigrid>
```

For the default twelve columns:

```text
moduleWidth =
  authoredFieldWidth /
  (12 + 11 × 12/84)
```

`configForAuthoredFieldWidth` works for the twelve-column field. For a field of `N` columns the relation is the same, and you can pass the result to `Unigrid` yourself:

```text
moduleWidth =
  authoredFieldWidth /
  (N + (N - 1) × 12/84)
```

You choose the geometry when you design. The grid chooses the capacity when the width changes.

## Capacity

Capacity is the number of whole modules the material holds.

```text
raw =
  max(
    1,
    floor(
      (availableWidth + columnGap) /
      (moduleWidth + columnGap)
    )
  )
```

The minimum is one. When the material is narrower than a single module, Unigrid keeps one whole module and lets it overflow.

With the default module, each column takes 84 + 12 = 96 px, which gives these field widths:

```text
 1 module       84 px
 2 modules     180 px
 3 modules     276 px
 4 modules     372 px
 5 modules     468 px
 6 modules     564 px
 7 modules     660 px
 8 modules     756 px
 9 modules     852 px
10 modules     948 px
11 modules    1044 px
12 modules    1140 px
```

An authored layout stops at its own field:

```text
capacity =
  min(
    authoredColumns,
    raw
  )
```

A fluid layout has no such ceiling. It takes every whole module the material holds, up to a safety limit in the code that has no meaning for design.

## Read the field

A component inside a `Cell` can read the field with `useUnigrid`. `Unigrid` accepts only `Cell` children, so the component that reads belongs inside a `Cell`.

```tsx
import { Cell, Unigrid, useUnigrid } from '@khannaoffice/unigrid'

function Measure() {
  const {
    activeColumns,
    moduleWidth,
    fieldWidth,
    materialState,
  } = useUnigrid()

  // …
}

<Unigrid>
  <Cell w={4} h={2}>
    <Measure />
  </Cell>
</Unigrid>
```

`useUnigrid` reports the geometry that governs the layout on the page, so what you put in a cell does not need to repeat the arithmetic.

## Show the grid

The grid is usually invisible. While you work, you can draw it over the layout:

```tsx
import { useState } from 'react'
import {
  Unigrid,
  Cell,
} from '@khannaoffice/unigrid'

export function Page() {
  const [showGrid, setShowGrid] = useState(false)

  return (
    <>
      <button
        onClick={() =>
          setShowGrid(value => !value)
        }
      >
        Grid
      </button>

      <Unigrid
        authoredColumns="fluid"
        reflowFlow="pack"
        showGrid={showGrid}
        guideColor="rgb(255 0 0 / 0.25)"
        guideNotchColor="rgb(0 0 255 / 0.6)"
      >
        <Cell w={4} h={3}>
          …
        </Cell>
      </Unigrid>
    </>
  )
}
```

The guide is drawn from the same values that place your cells. Its modules, gaps, field width, alignment and capacity are those of the layout itself.

## The margin

When the field fits, the width left over is divided equally on either side of it. The margin comes from the geometry, and you do not set one.

The twelve-column field is 1,140 px wide. In 1,260 px of material:

```text
1,260 - 1,140 = 120 px
120 / 2 = 60 px
```

The field has 60 px on each side. At 390 px, the four-column field is 372 px wide:

```text
390 - 372 = 18 px
18 / 2 = 9 px
```

When a cell overflows the field, Unigrid aligns the field to the inline start, so all of the overflow can be reached by scrolling.

## Why it is strict

Vignelli understood the grid as a structure for organising information: a way to give relationships consistency, clarity and what he called intellectual elegance.

Unigrid is strict because a grid is worth what its rules lead to. It removes the decisions made by accident: scaling nobody chose, alignment by eye, a reading order that shifts, a response to width with no reason in the structure. The decisions you make on purpose are then easier to see.

The library is small for the same reason. A grid orders relationships. Taste, hierarchy and judgment stay with you, and a few plain relationships leave room for a great variety of work.

## Run the tests

```bash
npm install
npm test
```

`npm test` builds the library and runs the unit tests. The browser tests run in Chromium, Firefox and WebKit, with React 18 and React 19:

```bash
npx playwright install chromium firefox webkit
npm run test:browser:matrix
```

`npm run check:release` runs everything, then packs the library and installs the packed file in a fresh project, as a person installing it from npm would.

## Unigrid elsewhere

[unigrid.app](https://unigrid.app) lays out a Unigrid B6 sheet in the browser, on this library. The product page is at [khannaoffice.com](https://khannaoffice.com/products/unigrid/).

## Licence

Unigrid is source available under the KhannaOffice Unigrid License 1.0.

> Use Unigrid freely to make websites and web applications for yourself, your company, or your clients. Modify it. Make money from the things you build with it. Hand those projects to your clients. Use it across your practice.
>
> Just do not take Unigrid itself, repackage it, and turn it into your own library, framework, component system, template product, service, or software product.

See [`LICENSE`](LICENSE) for the complete terms.

Copyright © 2026 Rohan Khanna, carrying on business as KhannaOffice.
