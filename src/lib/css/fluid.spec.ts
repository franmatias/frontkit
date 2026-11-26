import { expect, it } from 'vitest'
import { fluidClamp, fluidValue } from './fluid'

const range = { start: 16, end: 24, minViewport: 320, maxViewport: 1280, root: 16, unit: 'rem' as const }
it('reproduce el caso dorado y mantiene valores fuera del intervalo', () => {
  expect(fluidClamp(range)).toBe('clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)')
  expect(fluidValue(range, 800)).toBe(20)
  expect(fluidValue(range, 10)).toBe(16)
  expect(fluidValue(range, 1500)).toBe(24)
  expect(fluidClamp({ ...range, unit: 'px' })).toBe('clamp(16px, 13.3333px + 0.8333vw, 24px)')
  expect(fluidClamp({ ...range, end: 16 })).toBe('1rem')
  expect(fluidClamp({ ...range, start: 24, end: 16 })).toContain(' - 0.8333vw')
  expect(() => fluidClamp({ ...range, maxViewport: 320 })).toThrow(RangeError)
})
