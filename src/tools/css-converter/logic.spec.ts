import postcss from 'postcss'
import { expect, it } from 'vitest'
import { convert, defaults } from './logic'

it('keeps cascade order and handles nested conditionals without merging selector lists', () => {
  const css = '.card{color:red}.card:hover{color:blue}.other:hover{color:purple}.card:hover{color:black}@media (min-width: 768px){.card{color:white}}.a,.b{color:black}'
  const result = convert(css, defaults())
  const root = postcss.parse(result.css)
  expect(root.nodes.map(node => node.type === 'rule' ? node.selector : node.type)).toEqual(['.card', '.other', '.card', '.a,.b'])
  expect(result.css).toContain('&:hover')
  expect(result.css).toContain('@media')
  expect(result.report.some(entry => entry.selector === '.a,.b' && entry.status === 'kept')).toBe(true)
})
it('keeps BEM flat by default and reports opt-in specificity changes', () => {
  const input = '.card__title{color:black}'
  expect(convert(input, defaults()).css).toBe(input)
  expect(convert(input, { ...defaults(), target: 'scss', bem: 'scss' }).css).toContain('&__title')
  expect(convert(input, { ...defaults(), bem: 'nest-descendant', preserveSpecificity: false }).report[0].status).toBe('review')
})
it('preserves raw declarations when configured and uses Tailwind v4 important suffixes', () => {
  const out = convert('.x:hover{display:flex!important;letter-spacing:.2em}', { ...defaults(), target: 'tailwind-apply', unknown: 'keep' })
  expect(out.css).toContain('@apply flex!')
  expect(out.css).toContain('letter-spacing:.2em')
})
