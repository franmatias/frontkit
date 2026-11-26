import { expect, it } from 'vitest'
import { fluidClamp } from '../../lib/css/fluid'
import { logic, scaleName, size, steps } from './logic'

it('calcula potencias, redondea y nombra los pasos', () => {
  expect(size(16, 1.25, 2, 1)).toBe(25)
  expect(size(16, 1.25, 2, 4)).toBe(24)
  expect(scaleName(-2, 'steps')).toBe('step--2')
  expect(scaleName(10, 'tailwind')).toBe('9xl')
})
it('genera la escala fluida con el mismo motor de clamp', () => {
  const state = { ...logic.defaultState(), fluid: true }
  const step = steps(state).find(row => row.step === 0)!
  expect(step.value).toBe(fluidClamp(step.range))
  expect(logic.outputs.tailwind(state)).toContain('--text-base--line-height:')
  const exported = JSON.parse(logic.outputs.json(state))
  expect(exported.scale.base.size.$type).toBe('dimension')
  expect(exported.scale.base.size.$extensions['frontkit.css'].fluid).toBe(step.value)
})
