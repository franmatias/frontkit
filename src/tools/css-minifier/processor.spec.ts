
import { expect, it } from 'vitest'
import { processCss, type Options } from './processor'

const options: Options = { mode: 'minify', removeComments: true, removeEmptyRules: true, restructure: true, indentSize: 2 }
it('minifica sin modificar cadenas, variables o bloques condicionales', () => {
  const css = '@layer first {} .test { color: red; color: red; --x:  2; content: "x ; }"; @media (width > 20px) { color: blue; } } .empty {}'
  const min = processCss(css, options)
  expect(min).toBe('@layer first{}.test{color:red;--x:  2;content:"x ; }";@media (width > 20px){color:blue}}')
  const clean = processCss(min, { ...options, mode: 'clean', indentSize: 4 })
  expect(clean).toContain('        color: blue;')
  expect(processCss(clean, options)).toBe(min)
})
