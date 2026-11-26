import { expect,it } from 'vitest'
import { addEdge,clip,defaults,svg,template } from './logic'
it('serialises each coordinate system and inserts a vertex on its actual edge',()=>{
  const s=defaults();s.points=template('Triángulo','%')
  expect(clip(s)).toBe('polygon(50% 0%, 100% 100%, 0% 100%)')
  addEdge(s,{x:49,y:98})
  expect(s.points[2]).toEqual({x:49,y:100})
  s.mirror='v'
  expect(clip(s)).toContain('49% 0%')
  s.shape='inset';s.unit='px'
  expect(clip(s)).toContain('round 16px')
  expect(svg(s)).toContain('objectBoundingBox')
})
