
import { expect, it } from 'vitest'
import { initial, logic, transform } from './logic'

it('conserva el orden elegido en CSS y Tailwind y aísla perspectiva en el contenedor', () => {
  const state = initial({ mode: '3d', values: { rotate: 25, translateX: 30, translateZ: 15 }, unit: '%' })
  expect(transform(state)).toBe('translateX(30%) translateZ(15px) rotate(25deg)')
  state.order.reverse()
  expect(logic.outputs.css(state)).toContain('perspective: 600px')
  expect(logic.outputs.tailwind(state)).toContain('transform-[rotate(25deg)_translateZ(15px)_translateX(30%)]')
  state.mode = '2d'
  expect(transform(state)).toBe('rotate(25deg) translateX(30%)')
})
