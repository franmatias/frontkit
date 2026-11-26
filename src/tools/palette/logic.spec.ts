
import { describe, expect, it } from 'vitest'
import { apca, simulateVision } from '../../lib/color/vision'
import { channels, logic, regenerate, shuffleColors } from './logic'

describe('Paletas de color', () => {
  it('conserva los colores bloqueados y genera once niveles tonales', () => {
    const state = logic.defaultState()
    state.swatches[0].locked = true
    const locked = { ...state.swatches[0] }
    shuffleColors(state)
    expect(state.swatches[0]).toEqual(locked)
    state.swatches[0].locked = false
    state.mode = 'scale'
    regenerate(state)
    expect(state.swatches).toHaveLength(11)
    expect(new Set(state.swatches.map(color => color.name)).size).toBe(11)
    const levels = state.swatches.map(color => channels(color.color).l)
    expect(levels).toEqual([...levels].sort((a, b) => b - a))
    expect(logic.outputs.tailwind(state)).toContain('--color-brand-950')
  })

  it('conserva la polaridad de APCA y simula acromatopsia', () => {
    expect(apca('#000000', '#ffffff')).toBeCloseTo(106.04, 1)
    expect(apca('#ffffff', '#000000')).toBeCloseTo(-107.88, 1)
    expect(apca('#aabbaa', '#aabbaa')).toBe(0)
    expect(simulateVision('#ff0000', 'achromatopsia')).toMatch(/^#([a-f0-9]{2})\1\1$/)
  })
})
