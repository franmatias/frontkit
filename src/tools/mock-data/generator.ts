import { fieldName, type Field, type State } from './logic'

export type Value = null | string | number | boolean | Row | Value[]
export interface Row { [key: string]: Value }
export type Generation = { kind: 'result'; output: string; preview: Row[] } | { kind: 'error'; code: string; field: string }
const localeData = {
  'es-ES': {
    first: ['Ana','Lucía','Alejandro','Irene','Noa','Hugo','Claudia','Mateo','Carmen','Sergio','Nuria','Leo'],
    last: ['García','Ruiz','Martín','Vega','López','Romero','Gil','Díaz','Moreno','Molina','Santos','Navarro'],
    cities: ['Granada','Almería','Sevilla','Cádiz','Málaga','Jaén','Córdoba','Huelva','Madrid','Valencia'],
    streets: ['del Río','de la Luna','del Prado','de los Olivos','del Molino','del Sol'],
    jobs: ['Diseñador','Analista','Desarrolladora','Docente','Ilustradora','Ingeniero'],
    words: ['luz','mar','norte','taller','nube','ruta','verde','origen','bosque','costa','plaza','puente'],
  },
  'en-US': {
    first: ['Diana','John','Eva','Noah','Lily','James','Maya','Amelia','Liam','Oliver','Nora','Ava'],
    last: ['Smith','Taylor','Chen','Lee','Johnson','Young','Miller','Allen','Hall','Evans','Bailey','Wright'],
    cities: ['Cleveland','Denver','Raleigh','Boston','Austin','Portland','Seattle','Atlanta','Chicago','Phoenix'],
    streets: ['River Road','Mill Lane','Oak Street','High Street','Market Road','Park Avenue'],
    jobs: ['Designer','Analyst','Developer','Teacher','Illustrator','Engineer'],
    words: ['light','sea','north','workshop','cloud','trail','green','origin','forest','coast','square','bridge'],
  },
}
function seeded(text: string) {
  let state = 2166136261
  for (const character of text) state = Math.imul(state ^ character.codePointAt(0)!, 16777619)
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let mix = state
    mix = Math.imul(mix ^ mix >>> 15, mix | 1)
    mix ^= mix + Math.imul(mix ^ mix >>> 7, mix | 61)
    return ((mix ^ mix >>> 14) >>> 0) / 4294967296
  }
}
class FieldError extends Error {
  constructor(readonly code: string, readonly field: string) { super(code) }
}
const slug = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
const bytes = new TextEncoder()
const firstUpper = (word: string) => word[0].toLocaleUpperCase() + word.slice(1)
const csvCell = (value: Value) => {
  let text = typeof value === 'string' ? value : value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"','""') + '"' : text
}
const minDate = (str: string) => Date.parse(str + 'T00:00:00.000Z')
function validate(fields: Field[], depth = 1): number {
  const seen = new Set<string>()
  let count = 0
  for (const f of fields) {
    if (!fieldName.test(f.name) || seen.has(f.name)) throw new FieldError('name', f.name)
    seen.add(f.name)
    const compound = f.type === 'array' || f.type === 'object'
    if (compound && (!f.children.length || depth >= 3)) throw new FieldError('nested', f.name)
    if ((f.type === 'integer' || f.type === 'decimal' || f.type === 'array') && f.from > f.to) throw new FieldError('range', f.name)
    if (f.type === 'array' && (f.from < 0 || f.to > 5)) throw new FieldError('arraySize', f.name)
    if (f.type === 'date' || f.type === 'datetime') {
      const start = minDate(f.dateStart)
      const end = minDate(f.dateEnd)
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end ||
        new Date(start).toISOString().slice(0, 10) !== f.dateStart || new Date(end).toISOString().slice(0, 10) !== f.dateEnd) {
        throw new FieldError('range', f.name)
      }
    }
    count += 1 + (compound ? validate(f.children, depth + 1) : 0)
  }
  return count
}
function shape(fields: Field[]): string {
  function type(field: Field): string {
    if (field.type === 'object') return shape(field.children)
    if (field.type === 'array') return 'Array<' + shape(field.children) + '>'
    if (field.type === 'reference') return 'unknown'
    if (field.type === 'boolean') return 'boolean'
    return ['integer','decimal','autoincrement'].includes(field.type) || (['date','datetime'].includes(field.type) && field.epoch) ? 'number' : 'string'
  }
  return '{ ' + fields.map(f => JSON.stringify(f.name) + ': ' + type(f) + (f.nullablePercent ? ' | null' : '') + ';').join(' ') + ' }'
}
export function generate(state: State, progress: (percent: number) => void = () => {}): Generation {
  try {
    if (validate(state.fields) > 45) throw new FieldError('complexity', '')
    const random = seeded(state.seed)
    const int = (min: number, max: number) => Math.floor(min + random() * (max - min + 1))
    const choose = (items: readonly string[]) => items[int(0, items.length - 1)]
    const language = localeData[state.locale]
    const used = new Map<string, Set<string>>()
    const hex = (count: number) => Array.from({ length: count }, () => int(0, 15).toString(16)).join('')
    function object(fields: Field[], index: number, root?: Row, path = ''): Row {
      const names = fields.filter(f => f.unique && f.nullablePercent < 100 && ['givenName','familyName','fullName'].includes(f.type))
      let identity: [string, string] = [choose(language.first), choose(language.last)]
      for (let attempt = 0; attempt < 150 && names.some(f => {
        const token = f.type === 'givenName' ? identity[0] : f.type === 'familyName' ? identity[1] : identity.join(' ')
        return used.get(path + '/' + f.name)?.has(JSON.stringify(token))
      }); attempt++) identity = [choose(language.first), choose(language.last)]
      const row: Row = Object.create(null)
      for (const f of fields) {
        const uniqueKey = path + '/' + f.name
        const set = used.get(uniqueKey) ?? new Set<string>()
        if (f.unique) used.set(uniqueKey, set)
        let accepted = false
        for (let attempt = 0; attempt < (f.unique ? 150 : 1); attempt++) {
          const nullValue = f.nullablePercent && random() * 100 < f.nullablePercent
          const result = nullValue ? null : value(f, index, identity, row, root ?? row, uniqueKey)
          const token = result === null ? '' : JSON.stringify(result)
          if (f.unique && token && set.has(token)) continue
          row[f.name] = result
          if (f.unique && token) set.add(token)
          accepted = true
          break
        }
        if (!accepted) throw new FieldError('unique', f.name)
      }
      return row
    }
    function value(f: Field, index: number, identity: [string, string], row: Row, root: Row, path: string): Value {
      const [first, last] = identity
      const handle = slug(first + '.' + last)
      switch (f.type) {
        case 'uuid': return hex(8) + '-' + hex(4) + '-4' + hex(3) + '-' + int(8, 11).toString(16) + hex(3) + '-' + hex(12)
        case 'autoincrement': return f.from + index
        case 'givenName': return first
        case 'familyName': return last
        case 'fullName': return first + ' ' + last
        case 'email': return handle + (f.unique ? index + 1 : '') + '@example.test'
        case 'username': return handle + (f.unique ? index + 1 : '')
        case 'avatar': {
          const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="18" fill="#' + hex(6) +
            '"/><text x="40" y="49" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white">' + first[0] + last[0] + '</text></svg>'
          return 'data:image/svg+xml,' + encodeURIComponent(svg)
        }
        case 'date':
        case 'datetime': {
          const at = f.type === 'date' ? int(minDate(f.dateStart) / 86400000, minDate(f.dateEnd) / 86400000) * 86400000
            : int(minDate(f.dateStart), minDate(f.dateEnd) + 86399999)
          return f.epoch ? Math.floor(at / 1000) : f.type === 'date' ? new Date(at).toISOString().slice(0, 10) : new Date(at).toISOString()
        }
        case 'phone': return state.locale === 'es-ES' ? '+34 000 ' + String(int(0, 999)).padStart(3,'0') + ' ' + String(int(0,999)).padStart(3,'0') :
          '+1 202 555 ' + int(100, 199).toString().padStart(4, '0')
        case 'address': return state.locale === 'es-ES' ? 'Calle ' + choose(language.streets) + ', ' + int(1, 120) : int(1, 120) + ' ' + choose(language.streets)
        case 'city': return choose(language.cities)
        case 'company': return firstUpper(choose(language.words)) + (state.locale === 'es-ES' ? ' Estudio' : ' Studio')
        case 'job': return choose(language.jobs)
        case 'phrase': return firstUpper(Array.from({ length: int(4, 10) }, () => choose(language.words)).join(' ')) + '.'
        case 'integer': return int(f.from, f.to)
        case 'decimal': return Math.round((f.from + random() * (f.to - f.from)) * 100) / 100
        case 'boolean': return random() < .5
        case 'enum': {
          const items = f.text.split(',').map(part => {
            const match = /^(.*?)(?::(\d+))?$/.exec(part.trim())!
            return [match[1].trim(), Math.min(100000, Number(match[2] ?? 1))] as const
          }).filter(([name, weight]) => name && weight > 0)
          if (!items.length) throw new FieldError('enum', f.name)
          let pick = random() * items.reduce((sum, [,weight]) => sum + weight, 0)
          for (const [name, weight] of items) {
            pick -= weight
            if (pick < 0) return name
          }
          return items.at(-1)![0]
        }
        case 'ipv4': return '192.0.2.' + int(1, 254)
        case 'url': return 'https://example.test/' + slug(choose(language.words)) + '/' + int(1, 10000)
        case 'color': return '#' + hex(6)
        case 'pattern': return (f.text || 'USR-{####}').replace(/\{#+\}/g, match => Array.from({ length: match.length - 2 }, () => int(0, 9)).join(''))
        case 'reference': {
          const name = f.text.trim()
          if (Object.hasOwn(row, name)) return row[name]
          if (Object.hasOwn(root, name)) return root[name]
          throw new FieldError('reference', f.name)
        }
        case 'object': return object(f.children, index, root, path)
        case 'array': return Array.from({ length: int(f.from, f.to) }, (_, i) => object(f.children, index * 5 + i, root, path))
      }
    }
    const rows: Row[] = []
    const compact: string[] = []
    let produced = 0
    for (let i = 0; i < state.count; i++) {
      const row = object(state.fields, i)
      const line = JSON.stringify(row)
      produced += bytes.encode(line).length
      if (produced > 6 * 1024 * 1024) throw new FieldError('size', '')
      rows.push(row)
      compact.push(line)
      if (i % 25 === 0 || i === state.count - 1) progress(Math.round((i + 1) / state.count * 100))
    }
    let output: string
    if (state.format === 'ndjson') output = compact.join('\n')
    else if (state.format === 'csv') {
      const columns = state.fields.map(f => f.name)
      output = [columns.map(csvCell).join(','), ...rows.map(row => columns.map(name => csvCell(row[name])).join(','))].join('\r\n')
    } else if (state.format === 'typescript') {
      const definitions = 'export interface Fila ' + shape(state.fields) + '\n'
      output = definitions + '\nexport const datos' + (state.constant ? ' = ' : ': Fila[] = ') + JSON.stringify(rows, null, 2) + (state.constant ? ' as const;\n' : ';\n')
    } else output = JSON.stringify(rows, null, 2)
    return { kind: 'result', output, preview: rows.slice(0, 20) }
  } catch (err) {
    return err instanceof FieldError ? { kind: 'error', code: err.code, field: err.field } : { kind: 'error', code: 'complexity', field: '' }
  }
}
