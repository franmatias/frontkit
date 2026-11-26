import { expect,it } from 'vitest'
import { parseCss } from '../../lib/css-ast'
import { active, condition, cqUnits, css, defaults, preset,presets,tailwind } from './logic'
it('serializes ranges and named containers and identifies active widths',()=>{
  const state=defaults()
  const rule={...state.rules[0],kind:'range' as const,min:600,max:400}
  expect(condition(rule)).toBe('(400px <= width <= 600px)')
  expect(active(state,rule,400)).toBe(true)
  expect(active(state,rule,601)).toBe(false)
  expect(css(state)).toContain('@container card (min-width: 460px)')
  expect(tailwind(state)).toContain('@min-[460px]/card:')
  expect(cqUnits(480,250)).toMatchObject({cqw:4.8,cqh:2.5,cqmin:2.5,cqmax:4.8})
  for(const name of presets)expect(()=>parseCss(css(preset(name)))).not.toThrow()
})
