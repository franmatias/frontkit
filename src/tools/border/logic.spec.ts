import { describe, expect, it } from 'vitest'
import { declarations, logic, radiusValue } from './logic'

describe('border', () => {
  it('collapses equivalent edges and separates independent sides', () => {
    const state = logic.defaultState()
    expect(declarations(state)).toEqual({ border: '2px solid #236049', 'border-radius': '20px' })
    state.border.linked = false
    state.border.right.width = 3
    expect(declarations(state)).toMatchObject({ 'border-top': '2px solid #236049', 'border-right': '3px solid #236049' })
  })
  it('serializes horizontal and vertical corners in CSS order', () => {
    const state = logic.defaultState()
    state.radius = { mode: 'organic', unit: '%', horizontal: [1, 2, 3, 4], vertical: [5, 6, 7, 8] }
    expect(radiusValue(state)).toBe('1% 2% 3% 4% / 5% 6% 7% 8%')
    expect(logic.outputs.tailwind(state)).toContain('rounded-[1%_2%_3%_4%_/_5%_6%_7%_8%]')
  })
})
