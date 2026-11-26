import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { parseCss } from '../../lib/css-ast'
import { processCss } from '../css-minifier/processor'

export const rules = {
  box: ['Base','Seguro','*, *::before, *::after { box-sizing: border-box; }'],
  margin: ['Base','Con criterio','body, h1, h2, h3, p, figure { margin: 0; }'],
  sizing: ['Base','Seguro','html { text-size-adjust: 100%; }'],
  line: ['Tipografía','Seguro','body { line-height: 1.5; }'],
  viewport: ['Base','Con criterio','body { min-block-size: 100dvh; }'],
  image: ['Medios','Con criterio','img, picture, video, canvas, svg { display: block; max-inline-size: 100%; }'],
  form: ['Formulario','Seguro','button, input, select, textarea { font: inherit; }'],
  textarea: ['Formulario','Con criterio','textarea { resize: vertical; }'],
  balanced: ['Tipografía','Con criterio','h1, h2, h3 { text-wrap: balance; } p { text-wrap: pretty; }'],
  wrap: ['Tipografía','Seguro','p, li, dd { overflow-wrap: anywhere; }'],
  focus: ['Accesibilidad','Seguro',':focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }'],
  hidden: ['Accesibilidad','Seguro','[hidden]:not([hidden="until-found"]) { display: none !important; }'],
  motion: ['Accesibilidad','Con criterio','@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }'],
  smooth: ['Accesibilidad','Con criterio','@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }'],
  scheme: ['Base','Con criterio','html { color-scheme: light dark; }'],
  interpolate: ['Movimiento','Experimental','@supports (interpolate-size: allow-keywords) { :root { interpolate-size: allow-keywords; } }'],
  isolate: ['Apilamiento','Con criterio','#app { isolation: isolate; }'],
  font: ['Tipografía','Con criterio','body { font-family: var(--font-sans, system-ui, sans-serif); }'],
} as const
export type Rule = keyof typeof rules
const ids = Object.keys(rules) as Rule[]
export const types = ['modern','minimal','opinionated','preflight-complement'] as const
const schema = v.strictObject({
  base: v.picklist(types), enabled: v.pipe(v.array(v.picklist(ids)), v.maxLength(ids.length)),
  layer: v.boolean(), minify: v.boolean(), comments: v.boolean(),
  note: v.pipe(v.string(), v.maxLength(120)),
})
export type State = v.InferOutput<typeof schema>
const presets: Record<State['base'], Rule[]> = {
  modern: ['box','margin','line','sizing','image','form','textarea','wrap','focus','hidden','motion'],
  minimal: ['box','margin','image','form','focus'],
  opinionated: ['box','margin','sizing','line','viewport','image','form','textarea','balanced','wrap','focus','hidden','motion','smooth','scheme','isolate','font'],
  'preflight-complement': ['viewport','balanced','wrap','focus','motion','smooth','scheme','isolate','interpolate'],
}
export function start(base: State['base']) {
  return { base, enabled: [...presets[base]], layer: true, minify: false, comments: true, note: '' }
}
export function resetCss(state: State, tailwind = false) {
  const note = state.note.replaceAll('*/', '* /').replaceAll('<', '&lt;')
  const body = [(state.comments && note.trim()) ? '/* ' + note + ' */' : '', ...ids.filter(id => state.enabled.includes(id)).map(id => rules[id][2])].filter(Boolean).join('\n')
  const css = tailwind || state.layer ? '@layer ' + (tailwind ? 'base' : 'reset') + ' {\n' + body + '\n}' : body
  parseCss(css)
  return processCss(css, { mode: state.minify ? 'minify' : 'clean', removeComments: !state.comments, removeEmptyRules: true, restructure: false, indentSize: 2 })
}
export const logic = defineTool<State>({ id: 'css-reset', schema, defaultState: () => start('modern'),
  outputs: { css: resetCss, tailwind: state => resetCss(state,true) }, presets: [] })
