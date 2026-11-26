import { expect, it, vi } from 'vitest'
import { inflesz, measureLines, syllables, textMetrics } from './readability'

it('calcula las métricas y aplica la fórmula de Szigriszt-Pazos', () => {
  expect(syllables('canción')).toBe(2)
  expect(syllables('país')).toBe(2)
  const result = textMetrics('Casa clara. Día lento.')
  expect(result.words).toBe(4)
  expect(result.sentences).toBe(2)
  expect(result.index).toBeCloseTo(inflesz(4,8,2)!, 8)
})
it('agrupa rectángulos de los grafemas en líneas reales', () => {
  const root = document.createElement('p')
  root.textContent = 'mañana'
  let offset = 0
  const create = vi.spyOn(document, 'createRange').mockReturnValue({
    setStart: (_: Node, index: number) => { offset = index },
    setEnd: () => {},
    getClientRects: () => [{ top: offset < 4 ? 12 : 36, width: 6, height: 18 }],
  } as unknown as Range)
  try { expect(measureLines(root)).toEqual({ lines: 2, min: 2, max: 4, average: 3 }) }
  finally { create.mockRestore() }
})
