import { describe, expect, it } from 'vitest'
import { protectLoops, previewDocument } from './preview'
import { createProject, exportHtml, importProject, sourceOnly, templates } from './project'
import { decodeShare, encodeShare } from '../../composables/share'
import { logic } from './project'

describe('proyectos', () => {
  it('conserva las tres fuentes y el layout al exportar, importar y compartir', () => {
    for (const source of Object.values(templates)) {
      const project = createProject('Ejemplo', source)
      expect(importProject(JSON.stringify(project))).toEqual(project)
      expect(decodeShare(logic, encodeShare(logic, sourceOnly(project)))).toEqual(source)
    }
  })
  it('rechaza versiones desconocidas y propiedades inesperadas', () => {
    const stored = createProject('Ejemplo', templates.blank)
    expect(() => importProject(JSON.stringify({ ...stored, schemaVersion: 2 }))).toThrow()
    expect(() => importProject(JSON.stringify({ ...stored, extra: true }))).toThrow()
  })
  it('conserva el código con etiquetas de cierre en ambos formatos', () => {
    const code = { ...templates.blank, js: 'console.log("</script>")' }
    expect(exportHtml(code).match(/<\/script>/gi)).toHaveLength(1)
    expect(previewDocument(code, 'test', true, 'bucle').html.match(/<\/script>/gi)).toHaveLength(1)
  })
})
describe('instrumentación', () => {
  it('instrumenta cuerpos simples, anidados, do/while y for/of', () => {
    const input = 'for (const x of [1,2]) while (x) break; do {} while(false)'
    const source = protectLoops(input, 'tick')
    expect(source.match(/tick\(\)/g)).toHaveLength(3)
    expect(() => protectLoops(source, 'again')).not.toThrow()
  })
  it('conserva el diagnóstico cuando falla el análisis', () => {
    expect(previewDocument({ ...templates.blank, js: 'for (' }, 'test', true, 'bucle').parsed).toBe(false)
  })
})
