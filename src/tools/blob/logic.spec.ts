import { expect, it } from 'vitest'
import { changeRadius, factor, normalised, path, randomRadii } from './logic'
it('scales all eight corners using the largest adjacent pair',()=>{
  const radii={horizontal:[75,65,30,63],vertical:[90,20,25,85]} as Parameters<typeof factor>[0]
  expect(factor(radii)).toBeCloseTo(100/175)
  expect(normalised(radii).vertical[0]+normalised(radii).vertical[3]).toBeCloseTo(100)
  expect(path(radii,250)).toMatch(/^M .* C .* Z$/)
  expect(randomRadii('Patio',95,'both')).toEqual(randomRadii('Patio',95,'both'))
  changeRadius(radii,'horizontal',0,42,'both')
  expect(radii.horizontal).toEqual([42,42,42,42])
})
