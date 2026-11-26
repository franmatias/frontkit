import ts from 'typescript'
import { expect,it } from 'vitest'
import { iconFiles, optimizedFiles } from './downloads'
import { processBatch } from './engine'
import { defaultSvgOptions,example } from './model'
const symbol='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="24"><defs><linearGradient id="color"><stop stop-color="#ff0000"/></linearGradient></defs><rect width="18" height="24" fill="url(#color)"/></svg>'
it('normalises SVG, keeps accessibility text and produces valid JSX',()=>{
  const unsafe=example.replace('<title>','<script>window.sample=true</script><image href="https://example.test/pixel"/><g onload="window.sample=true"/><title>')
  const r=processBatch({kind:'optimize',sources:[{name:'mi-icono.svg',text:unsafe}],options:defaultSvgOptions()})
  const icon=r.entries[0]!
  expect(icon.svg).toContain('viewBox="0 0 120 120"')
  expect(icon.svg).toContain('<title>Brújula</title>')
  expect(icon.svg).toContain('<desc>')
  expect(icon.svg).not.toMatch(/onload|script|example\.test/)
  expect(icon.original).not.toMatch(/onload|script|example\.test/)
  const jsx=optimizedFiles(icon).tsx
  const result=ts.transpileModule(jsx,{fileName:'MiIcono.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX}})
  expect(result.diagnostics).toHaveLength(0)
  expect(result.outputText).toContain('MiIcono')
})
it('deduplicates icons, disambiguates names and prefixes their internal paint references',()=>{
  const r=processBatch({kind:'sprite',sources:[
    {name:'Acentuádo.svg',text:symbol},{name:'Acentuado.svg',text:symbol.replace('#ff0000','#268542')},{name:'Copia.svg',text:symbol},
  ],options:{...defaultSvgOptions(),cleanupIds:false}})
  expect(r.icons.map(icon=>icon.id)).toEqual(['acentuado','acentuado-2'])
  expect(r.icons[0]!.symbol).toContain('url(#acentuado-color)')
  expect(r.icons[1]!.symbol).toContain('id="acentuado-2-color"')
  expect(r.icons[0]!.symbol).toContain('viewBox="0 0 18 24"')
  expect(iconFiles(r.icons)['icons.d.ts']).toBe('export type IconName = "acentuado" | "acentuado-2";\n')
})
