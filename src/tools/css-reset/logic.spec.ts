import { expect, it } from 'vitest'
import { parseCss } from '../../lib/css-ast'
import { resetCss, start, types } from './logic'
it('generates valid layers and equivalent declarations when minified', () => {
  for (const base of types) {
    const options = start(base)
    const declarations = (source: string) => {
      const data: string[] = []
      parseCss(source).walkDecls(node => { data.push(node.prop + ':' + node.value) })
      return data
    }
    expect(declarations(resetCss(options))).toEqual(declarations(resetCss({ ...options, minify: true })))
    expect(resetCss(options)).toContain('@layer reset')
    expect(resetCss(options, true)).toContain('@layer base')
  }
  expect(resetCss(start('preflight-complement'))).not.toContain('box-sizing')
})
