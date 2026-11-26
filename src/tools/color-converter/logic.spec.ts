import { expect, it } from 'vitest'
import { description, contrast, adjust, values, mix, logic } from './logic'
import { replaceColors } from './batch'
it('maps colors and preserves transparent alpha', () => {
  expect(values('#abc8').HEX).toBe('#aabbcc88')
  expect(description('color(display-p3 1 0 0)')?.srgb).toBe(false)
  expect(description('white')?.tailwind).toBe('white')
  expect(contrast('#000','#fff')?.ratio).toBe(21)
  expect(contrast(adjust('#aaa','#fff') ?? '', '#fff')?.ratio).toBeGreaterThanOrEqual(4.5)
  expect(mix(logic.defaultState())?.code).toContain('color-mix(in oklch,')
})
it('preserves URLs and reports unresolved colors', () => {
  const result = replaceColors('p{background:url(red.png);color:red;fill:var(--x)}', 'HEX')
  expect(result.total).toBe(1)
  expect(result.css).toContain('url(red.png)')
  expect(result.unresolved).toEqual(['var(--x)'])
})
