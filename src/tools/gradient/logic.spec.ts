import { describe, expect, it } from 'vitest'
import { image, logic } from './logic'

describe('gradient', () => {
  it('serializes three stops with their positions and interpolation', () => {
    expect(logic.outputs.css(logic.defaultState())).toBe(
      'background: linear-gradient(135deg in oklab, #5a235f 0%, #dd516e 50%, #f8b25d 100%);',
    )
  })
  it('keeps hard stops and hints for a repeating gradient', () => {
    const state = logic.defaultState()
    state.repeating = true
    state.stops[0].position2 = 10
    state.stops[0].opacity = 50
    state.hints.push({ after: state.stops[0].id, position: 25 })
    expect(image(state)).toContain('#5a235f80 0% 10%, 25%, #dd516e 50%')
    expect(logic.outputs.tailwind(state)).toMatch(/^bg-\[repeating-linear-gradient/)
  })
  it('supports two stops, a conic center, and a polar hue method', () => {
    const state = logic.defaultState()
    state.stops.splice(1, 1)
    state.type = 'conic'
    state.interpolation = 'oklch'
    state.hueMethod = 'longer'
    state.position = { x: 25, y: 75 }
    expect(image(state)).toBe('conic-gradient(from 135deg at 25% 75% in oklch longer hue, #5a235f 0%, #f8b25d 100%)')
  })
})
