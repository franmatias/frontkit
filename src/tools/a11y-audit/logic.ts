import { baseCsp, htmlText, previewFragment, styleText } from '../../lib/html-sandbox'

export const tags=['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice'] as const
export const impacts=['critical','serious','moderate','minor'] as const
export type ReportNode={selector:string;html:string;reason:string}
export type Finding={id:string;impact:string;description:string;help:string;helpUrl:string;nodes:ReportNode[]}
export type Report={violations:Finding[];passes:number;manual:Finding[];inapplicable:number}
export type Inputs={html:string;css:string;rules:string[];dark:boolean}
const scriptText=(js:string)=>js.replace(/<\/script/gi,'<\\/script')
const inlineJson=(value:unknown)=>JSON.stringify(value).replaceAll('<','\\u003c')
export function documentFor(input:Inputs,token:string,bundle:{axe:string;language:string}) {
  const full=/^\s*(?:<!doctype[^>]*>\s*)?<html\b/i.test(input.html)
  const tag=input.html.match(/<html\b([^>]*)>/i)?.[1]??''
  const lang=full?(tag.match(/\blang\s*=\s*["']?([-a-z\d]+)/i)?.[1]??''):'es'
  const markup=previewFragment(input.html)
  const title=full?'':'<title>Muestra de accesibilidad</title>'
  const style=':root{color-scheme:'+(input.dark?'dark':'light')+'}[data-frontkit-audit]{outline:3px solid #ce5a07!important;outline-offset:2px!important}'+input.css
  const channel = 'const token='+inlineJson(token)+'; const rules='+inlineJson(input.rules)+'; const dictionary='+bundle.language+';\n'+
    'const signal = value => parent.postMessage({channel:"frontkit-audit",token,...value},"*");\n'+
    'document.addEventListener("click", event => { if(event.target instanceof Element && event.target.closest("a")) event.preventDefault(); });\n'+
    'addEventListener("message", event => { if(event.source!==parent || event.data?.channel!=="frontkit-audit" || event.data.token!==token || typeof event.data.selector!=="string") return;'+
    ' try { document.querySelector("[data-frontkit-audit]")?.removeAttribute("data-frontkit-audit"); const node=document.querySelector(event.data.selector); node?.setAttribute("data-frontkit-audit",""); node?.scrollIntoView({block:"center"}); }catch{} });\n'+
    'const entry=item=>({id:item.id,impact:item.impact||"minor",description:item.description,help:item.help,helpUrl:item.helpUrl,nodes:item.nodes.slice(0,100).map(node=>({selector:node.target.find(value=>typeof value==="string")||"",html:node.html.slice(0,1800),reason:node.failureSummary||""}))});\n'+
    'addEventListener("load", async()=>{ try { axe.configure({locale:dictionary}); const result=await axe.run(document,{runOnly:{type:"tag",values:rules},reporter:"v2",iframes:false}); signal({report:{violations:result.violations.map(entry),passes:result.passes.length,manual:result.incomplete.map(entry),inapplicable:result.inapplicable.length}}); }catch(error){signal({error:String(error.message||error)})} });'
  // axe compiles its bundled rule templates in the opaque-origin frame. Only the two nonce-bearing scripts can run.
  return '<!doctype html><html'+(lang?' lang="'+htmlText(lang)+'"':'')+'><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+
    baseCsp+"; script-src 'nonce-"+token+"' 'unsafe-eval'"+'">'+title+'<style>'+styleText(style)+'</style></head><body>'+markup+
    '<script nonce="'+token+'">'+scriptText(bundle.axe)+'</script><script nonce="'+token+'">'+scriptText(channel)+'</script></body></html>'
}
export function lineOf(input:string,node:ReportNode) {
  const id=node.selector.match(/^#([a-z][\w-]*)$/i)?.[1]
  const exact=input.indexOf(node.html)
  const approximate=id?input.search(new RegExp('\\bid\\s*=\\s*["\\x27]'+id+'["\\x27]','i')):-1
  const location=exact>=0&&node.html ? exact : approximate
  return location>=0 ? input.slice(0,location).split('\n').length : undefined
}
export const manualChecks=['Orden de foco y navegación solo con teclado','Textos alternativos con sentido en su contexto','Etiquetas y mensajes de error comprensibles','Comportamiento con zoom y lector de pantalla']
export function exportsFor(report:Report) {
  const heading='Superadas: '+report.passes+' · Revisión manual: '+report.manual.length+' · No aplicables: '+report.inapplicable
  const markdown=(value:string)=>value.replace(/[\x60<>\\]/g,'\\$&')
  const sections=report.violations.map(item=>'## '+item.impact+' · '+item.id+'\n\n'+markdown(item.help)+'\n\n'+
    item.nodes.map(node=>'- '+markdown(node.selector)+': '+markdown(node.reason.replace(/\r?\n/g,' '))).join('\n'))
  return {
    json:JSON.stringify(report,null,2),
    md:['# Auditoría HTML',heading,...sections,'## Comprobaciones manuales',manualChecks.map(rule=>'- '+rule).join('\n')].join('\n\n'),
    html:'<!doctype html><html lang="es"><meta charset="utf-8"><title>Auditoría HTML</title><h1>Auditoría HTML</h1><p>'+htmlText(heading)+'</p>'+
      report.violations.map(item=>'<section><h2>'+htmlText(item.id)+'</h2><p>'+htmlText(item.help)+'</p><ul>'+
        item.nodes.map(node=>'<li><code>'+htmlText(node.selector)+'</code> '+htmlText(node.reason)+'</li>').join('')+'</ul></section>').join('')+
      '<h2>Comprobaciones manuales</h2><ul>'+manualChecks.map(rule=>'<li>'+htmlText(rule)+'</li>').join('')+'</ul></html>',
  }
}
