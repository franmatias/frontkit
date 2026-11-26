import { expect,it } from 'vitest'
import { css,defaults,html,parseGrid,replaceRows } from './logic'
it('parses quoted CSV and restores semantic roles in narrow cards',()=>{
  const rows=parseGrid('\uFEFFNombre,Nota\r\n"Sol ""M""","línea 1\nlínea 2"\r\nLuna,10')
  expect(rows).toEqual([['Nombre','Nota'],['Sol "M"','línea 1\nlínea 2'],['Luna','10']])
  expect(parseGrid('A\tB\n1\t2')).toEqual([['A','B'],['1','2']])
  const s=defaults();replaceRows(s,rows.shift()!,rows);s.mode='cards';s.footer='<Fin>';s.sort=true
  const output=html(s)
  expect(output).toContain('role="table"')
  expect(output).toContain('scope="row" role="rowheader"')
  expect(output).toContain('data-label="Nombre"')
  expect(output).toContain('&lt;Fin&gt;')
  expect(output).toContain('data-sort-table')
  expect(css(s)).toContain('clip-path: inset(50%)')
  expect(html(s,true)).toContain('before:content-[attr(data-label)]')
})
