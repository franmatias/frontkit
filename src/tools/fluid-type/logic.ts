import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { fluidClamp, sassFluid } from '../../lib/css/fluid'
import { arbitrary } from '../../lib/tailwind'

export const properties = ['font-size','padding','margin','gap','width','height','border-radius'] as const
const utilities = ['text','p','m','gap','w','h','rounded'] as const
const space = v.pipe(v.number(), v.minValue(0), v.maxValue(1200))
const viewport = v.pipe(v.number(), v.minValue(160), v.maxValue(3840))
const row = v.strictObject({
  id: v.pipe(v.string(), v.regex(/^[a-z\d-]{1,40}$/)),
  name: v.pipe(v.string(), v.regex(/^[a-z][a-z\d-]{0,31}$/)), start: space, end: space,
})
const schema = v.strictObject({
  property: v.picklist(properties), minViewport: viewport, maxViewport: viewport,
  root: v.pipe(v.number(), v.minValue(8), v.maxValue(40)), unit: v.picklist(['px','rem']),
  rows: v.pipe(v.array(row), v.minLength(1), v.maxLength(12), v.check(rows => new Set(rows.map(row => row.name)).size === rows.length && new Set(rows.map(row => row.id)).size === rows.length)),
})
export type State = v.InferOutput<typeof schema>
export type Row = v.InferOutput<typeof row>
export const valid = (state: State) => state.maxViewport > state.minViewport
export const range = (state: State, row: Row) => ({
  start: row.start, end: row.end, minViewport: state.minViewport, maxViewport: state.maxViewport, root: state.root, unit: state.unit,
})
export const logic = defineTool<State>({
  id: 'fluid-type', schema, defaultState: () => ({
    property: 'font-size', minViewport: 320, maxViewport: 1280, unit: 'rem', root: 16,
    rows: [{ id: 'default', name: 'fluid-lg', start: 16, end: 24 }],
  }),
  outputs: {
    css: s => valid(s) ? s.rows.map(row => '.' + row.name + ' {\n  ' + s.property + ': ' + fluidClamp(range(s, row)) + ';\n}').join('\n\n') : '',
    tailwind: s => {
      if (!valid(s)) return ''
      const namespace = s.property === 'font-size' ? 'text' : s.property === 'border-radius' ? 'radius' : 'spacing'
      const theme = s.rows.map(row => '  --' + namespace + '-' + row.name + ': ' + fluidClamp(range(s, row)) + ';')
      return '@theme {\n' + theme.join('\n') + '\n}\n\n/* ' + s.rows.map(row => arbitrary(utilities[properties.indexOf(s.property)], fluidClamp(range(s,row)))).join(' ') + ' */'
    },
    scss: s => valid(s) ? sassFluid + '\n\n' + s.rows.map(row => '$' + row.name + ': fluid(' +
      [row.start,row.end,s.minViewport,s.maxViewport,s.root,s.unit === 'rem'].join(', ') + ');').join('\n') : '',
    json: s => valid(s) ? JSON.stringify(Object.fromEntries(s.rows.map(row => [row.name, fluidClamp(range(s, row))])), null, 2) : '',
  },
  presets: [],
})
