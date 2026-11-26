import { expect, it } from 'vitest'
import { blocks, logic } from '../../tools/lorem/logic'
import { cleanText, graphemes, invisibleCount, pastedHtml } from './clean'

it('genera cantidades exactas por caracteres y palabras', () => {
  expect(graphemes('👩🏽‍💻á')).toHaveLength(2)
  const state = { ...logic.defaultState(), mode: 'characters' as const, count: 31 }
  expect(graphemes(blocks(state)[0])).toHaveLength(31)
  expect(blocks({ ...state, mode: 'words' })[0].split(/\s+/)).toHaveLength(31)
})
it('elimina invisibles y conserva el resultado al repetir la limpieza', () => {
  const original = '  “hola” \u200b\u2060\u00a0 mundo  '
  const options = { stripInvisible: true, straightQuotes: true, replaceNbsp: true, collapse: true }
  expect(invisibleCount(original)).toBe(2)
  expect(cleanText(original, options)).toBe('"hola" mundo')
  expect(cleanText(cleanText(original, options), options)).toBe('"hola" mundo')
})
it('convierte HTML de portapapeles a Markdown sin conservar atributos ni código activo', () => {
  const source = '<p class="MsoNormal">Hola&nbsp;<b>mundo</b><o:p></o:p></p><script>oculto</script><img src="https://externo.test/a"><ul><li>Uno</li><li>Dos</li></ul>'
  const result = pastedHtml(source, true)
  expect(result).toContain('Hola\u00a0**mundo**')
  expect(result).toContain('- Uno\n- Dos')
  expect(result).not.toMatch(/oculto|externo/)
})
