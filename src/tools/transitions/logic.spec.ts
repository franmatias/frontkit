import { expect,it } from 'vitest'
import { css, defaults, tailwind } from './logic'
it('keeps ordered transition lists and reduced motion',()=>{
  const state=defaults()
  expect(css(state)).toContain('opacity 200ms ease-out 0ms, transform 200ms ease-out 0ms')
  expect(tailwind(state)).toContain('transition-[opacity,transform]')
  expect(css(state)).toContain('prefers-reduced-motion')
})
it('exports timed scroll enhancements with a static fallback',()=>{
  const state={...defaults(),mode:'scroll' as const}
  expect(css(state)).toContain('@supports (animation-timeline: view())')
  expect(css(state)).toContain('animation-range: entry 0% cover 85%')
  expect(css(state)).toContain('animation: none')
})
