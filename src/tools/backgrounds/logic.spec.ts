import { expect,it } from 'vitest'
import { css,defaults,svg,uri } from './logic'
it('emits CSS for simple layers and safely encodes complex SVG patterns',()=>{
  const s=defaults()
  expect(css(s)).toContain('radial-gradient(circle at 18% 24%')
  s.mode='pattern';s.pattern='waves';s.rotate=12
  expect(svg(s)).toContain('patternTransform="rotate(12)"')
  const original='<svg fill="#fff" data-name="hello world\'"/>'
  expect(decodeURIComponent(uri(original,'url').split(',')[1]!)).toBe(original)
  expect(uri(original,'url')).not.toContain('#')
  expect(atob(uri(original,'base64').split(',')[1]!)).toBe(original)
})
