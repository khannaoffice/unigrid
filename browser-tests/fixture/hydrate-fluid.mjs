import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { FluidHydrationFixture } from './fluid-hydration.mjs'

const problems = []
for (const level of ['error', 'warn']) {
  const original = console[level].bind(console)
  console[level] = (...args) => {
    problems.push(String(args[0]))
    original(...args)
  }
}
window.__UNIGRID_HYDRATION_PROBLEMS__ = problems

hydrateRoot(document.getElementById('root'), createElement(FluidHydrationFixture), {
  onRecoverableError: (error) => {
    problems.push(`recoverable: ${String(error?.message ?? error)}`)
  },
})

requestAnimationFrame(() => {
  document.documentElement.dataset.hydratedFluid = 'true'
})
