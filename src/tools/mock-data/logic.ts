import * as v from 'valibot'
import { defineTool } from '../../core/tool'

export const fieldTypes = ['uuid', 'autoincrement', 'givenName', 'familyName', 'fullName', 'email', 'username', 'avatar',
  'date', 'datetime', 'phone', 'address', 'city', 'company', 'job', 'phrase', 'integer', 'decimal', 'boolean', 'enum',
  'ipv4', 'url', 'color', 'pattern', 'reference', 'object', 'array'] as const
export type FieldType = (typeof fieldTypes)[number]
export interface Field {
  id: string
  name: string
  type: FieldType
  nullablePercent: number
  unique: boolean
  from: number
  to: number
  text: string
  dateStart: string
  dateEnd: string
  epoch: boolean
  children: Field[]
}
const integer = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max))
export const fieldName = /^(?!__proto__$)[A-Za-z_$][\w$]{0,39}$/
const date = v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/))
const field = (depth: number): v.GenericSchema<Field> => v.strictObject({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9-]{1,50}$/)), name: v.pipe(v.string(), v.regex(fieldName)), type: v.picklist(fieldTypes),
  nullablePercent: integer(0, 100), unique: v.boolean(), from: integer(-999999, 999999), to: integer(-999999, 999999),
  text: v.pipe(v.string(), v.maxLength(160)), dateStart: date, dateEnd: date, epoch: v.boolean(),
  children: depth < 3 ? v.pipe(v.array(v.lazy(() => field(depth + 1))), v.maxLength(12)) : v.pipe(v.array(v.never()), v.length(0)),
})
const schema = v.strictObject({
  fields: v.pipe(v.array(field(1)), v.minLength(1), v.maxLength(16)),
  count: integer(1, 1000),
  seed: v.pipe(v.string(), v.maxLength(80)),
  locale: v.picklist(['es-ES', 'en-US']),
  format: v.picklist(['json', 'ndjson', 'csv', 'typescript']),
  constant: v.boolean(),
})
export type State = v.InferOutput<typeof schema>
export const newField = (id: string, name: string, type: FieldType = 'integer'): Field => ({
  id, name, type, nullablePercent: 0, unique: false, from: 1, to: 100, text: '',
  dateStart: '2020-01-01', dateEnd: '2025-12-31', epoch: false, children: [],
})
const sample = (fields: [string, FieldType][]): State => ({
  fields: fields.map(([name, type], i) => newField('field-' + i, name, type)),
  count: 10, seed: 'FrontKit', locale: 'es-ES', format: 'json', constant: false,
})
export const logic = defineTool<State>({
  id: 'mock-data', schema,
  defaultState: () => sample([['id','uuid'],['nombre','fullName'],['email','email'],['activo','boolean']]),
  outputs: {}, presets: [
    { id: 'users', name: 'Usuarios', builtin: true, state: sample([['id','uuid'],['nombre','fullName'],['email','email'],['avatar','avatar']]) },
    { id: 'products', name: 'Productos', builtin: true, state: sample([['id','autoincrement'],['producto','phrase'],['precio','decimal'],['stock','integer']]) },
    { id: 'blog', name: 'Artículos de blog', builtin: true, state: sample([['id','uuid'],['titulo','phrase'],['autor','fullName'],['publicado','datetime']]) },
    { id: 'orders', name: 'Pedidos', builtin: true, state: sample([['id','autoincrement'],['cliente','fullName'],['total','decimal'],['fecha','date']]) },
  ],
})
