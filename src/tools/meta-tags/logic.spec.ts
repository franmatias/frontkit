import { expect,it } from 'vitest'
import { checks,defaults,head,httpUrl } from './logic'
it('escapes text, adds matching metadata and refuses non-http preview addresses',()=>{
  const s={...defaults(),title:'" <Inicio> & ayuda',image:'https://ejemplo.es/img?x=1&y=2',imageAlt:'Cartel "uno"',width:1200,height:630,type:'article' as const,published:'2026-11-26'}
  const output=head(s)
  expect(output).toContain('&quot; &lt;Inicio&gt; &amp; ayuda')
  expect(output).toContain('og:image:alt')
  expect(output).toContain('twitter:image:alt')
  expect(output).toContain('article:published_time')
  expect(output).toContain('x=1&amp;y=2')
  expect(httpUrl('javascript:void(0)')).toBe('')
  expect(checks(s).find(rule=>rule.text.includes('1,91'))?.level).toBe('correcto')
})
