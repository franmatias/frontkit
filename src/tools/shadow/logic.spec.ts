import { describe, expect, it } from 'vitest'
import { initial, layer, logic, shadow } from './logic'

describe('shadow', () => {
  it('omits disabled layers and handles an inset layer', () => {
    const state = initial([
      layer('a', { enabled: false }),
      layer('b', { inset: true, blur: 0, color: '#333333', opacity: 100 }),
    ])
    expect(logic.outputs.css(state)).toBe('box-shadow: inset 0px 7px 0px -5px #333333;')
    state.layers[1].enabled = false
    expect(shadow(state)).toBe('none')
  })
  it('omits spread and inset in text mode while keeping multiple layers', () => {
    const state = initial([layer('a', { inset: true }), layer('b', { offsetX: 2, opacity: 100 })])
    state.mode = 'text'
    expect(logic.outputs.css(state)).toBe('text-shadow: 0px 7px 20px rgb(36 56 45 / 28%),\n  2px 7px 20px #24382d;')
    expect(logic.outputs.tailwind(state)).toMatch(/^text-shadow-\[/)
  })
  it('uses the Tailwind 4.1 scale when the dimensions and alpha match', () => {
    const state = initial([layer('a', { color: '#000000', opacity: 5, offsetY: 1, blur: 2, spread: 0 })])
    expect(logic.outputs.tailwind(state)).toBe('shadow-xs')
  })
})
