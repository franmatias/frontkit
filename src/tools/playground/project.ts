import * as v from 'valibot'
import { safeJson } from '../../core/storage/backup'
import { defineTool } from '../../core/tool'

export const languages = ['html', 'css', 'js'] as const
export const layouts = ['quad', 'side', 'left', 'columns', 'bottom', 'tabs'] as const
const code = v.pipe(v.string(), v.maxLength(120_000))
const schema = v.strictObject({ html: code, css: code, js: code, layout: v.picklist(layouts) })
export type Source = v.InferOutput<typeof schema>
export const templates: Record<string, Source> = {
  blank: { html: '', css: '', js: '', layout: 'quad' },
  card: { html: '<article><h1>FrontKit</h1><p>HTML · CSS · JS</p></article>',
    css: 'body { background: #e8f3e8; font: 16px system-ui; }\narticle { background: white; margin: 2rem; padding: 2rem; border-radius: 1rem; transition: transform .3s; }\narticle:hover { transform: translateY(-4px); }',
    js: '', layout: 'tabs' },
  grid: { html: '<main><div>A</div><div>B</div><div>C</div></main>',
    css: 'main { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; }\ndiv { padding: 2rem; background: #c3ebcd; text-align: center; }',
    js: '', layout: 'columns' },
  counter: { html: '<button id="counter">0</button>',
    css: 'button { margin: 2rem; padding: 1rem 2rem; border-radius: .75rem; font-size: 2rem; }',
    js: "let count = 0\nconst button = document.querySelector('#counter')\nbutton.onclick = () => {\n  button.textContent = String(++count)\n  console.log(count)\n}", layout: 'side' },
}
export const logic = defineTool<Source>({
  id: 'playground', schema, defaultState: () => ({ ...templates.card }), outputs: {}, presets: [],
})
const projectSchema = v.strictObject({
  schemaVersion: v.literal(1), id: v.pipe(v.string(), v.uuid()),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  ...schema.entries,
})
export type Project = v.InferOutput<typeof projectSchema>
export const parseProject = (raw: unknown) => v.parse(projectSchema, raw)
export const importProject = (raw: string) => parseProject(safeJson(raw))
export function createProject(name: string, source: Source): Project {
  const now = Date.now()
  return parseProject({ ...sourceOnly(source), id: crypto.randomUUID(), name, schemaVersion: 1, createdAt: now, updatedAt: now })
}
export function sourceOnly({ html, css, js, layout }: Source): Source {
  return { html, css, js, layout }
}
export function exportHtml(source: Source) {
  const args = JSON.stringify([source.css, source.js]).replaceAll('<', '\\u003c')
  return '<!doctype html>\n<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>\n'
    + source.html + '\n<script>((css,js)=>{const s=document.createElement("style");s.textContent=css;document.head.append(s);const j=document.createElement("script");j.textContent=js;document.body.append(j)})(...'
    + args + ')</script>\n</body></html>'
}
