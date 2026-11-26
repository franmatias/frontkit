import { expect,it } from 'vitest'
import { documentFor,exportsFor,lineOf } from './logic'
it('cleans the inert fragment and creates a restricted audit document',()=>{
  const html=documentFor({html:'<img src="https://example.invalid/remote.png" onload="evil()"><script>evil()</script><a href="https://example.invalid/">Enlace</a>',css:'p{color:red}',rules:['wcag2a'],dark:false},'123456',{axe:'',language:'{}'})
  expect(html).toContain("default-src 'none'")
  expect(html).toContain("script-src 'nonce-123456'")
  expect(html).not.toMatch(/example\.invalid|evil\(\)/)
})
it('locates snippets and escapes generated HTML reports',()=>{
  const node={selector:'#demo',html:'<img id="demo">',reason:'Añade <alt>'}
  expect(lineOf('<main>\n<img id="demo">\n</main>',node)).toBe(2)
  const result=exportsFor({passes:3,manual:[],inapplicable:9,violations:[{id:'image-alt',impact:'critical',help:'Texto <alternativo>',description:'',helpUrl:'',nodes:[node]}]})
  expect(result.html).toContain('&lt;alternativo&gt;')
  expect(result.md).toContain('image-alt')
})
