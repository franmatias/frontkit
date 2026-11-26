import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { graphemes } from '../../lib/text/clean'

const schema = v.strictObject({
  mode: v.picklist(['paragraphs','sentences','words','characters']),
  count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2000)),
  language: v.picklist(['latin','es']),
  seed: v.pipe(v.string(), v.maxLength(80)),
  exact: v.boolean(), opening: v.boolean(),
  structure: v.picklist(['paragraph','list','heading']),
  width: v.pipe(v.number(), v.integer(), v.minValue(12), v.maxValue(100)),
  lines: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)),
  singleLine: v.boolean(),
  stripInvisible: v.boolean(), replaceNbsp: v.boolean(), straightQuotes: v.boolean(), collapse: v.boolean(), markdown: v.boolean(),
})
export type State = v.InferOutput<typeof schema>
export const limits = { paragraphs: 60, sentences: 250, words: 2000, characters: 2000 } as const
const units = {
  latin: 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim minim veniam quis nostrud ullamco laboris nisi aliquip commodo consequat duis aute irure reprehenderit velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt officia deserunt mollit anim laborum'.split(' '),
  es: 'alba bosque cielo camino palabra viento lectura página rama luz agua canción lugar montañas aire hojas historia tiempo piedra viaje sombra paisaje huella orilla tranquilo aprende tarde nueva oriente sendero abierto suave crea ventana lago norte pueblo día cercano tramo'.split(' '),
}
function randomFrom(seed: string) {
  let value = 5381
  for (const ch of seed) value = Math.imul(value, 33) ^ ch.codePointAt(0)!
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) | 0
    return (value >>> 0) / 4294967296
  }
}
function capitalize(word: string) {
  return word[0].toLocaleUpperCase() + word.slice(1)
}
const opening = 'Lorem ipsum dolor sit amet'
export function blocks(state: State) {
  const list = units[state.language]
  const random = randomFrom(state.seed || 'frontkit')
  const phrase = (n: number) => Array.from({ length: n }, () => list[Math.floor(random() * list.length)]).join(' ')
  const sentence = (i: number) => (state.opening && i === 0 ? opening + ' ' + phrase(5) : capitalize(phrase(7 + Math.floor(random() * 8)))) + '.'
  const count = Math.min(state.count, limits[state.mode])
  if (state.mode === 'words') {
    const prefix = state.opening ? opening.split(' ').slice(0,count) : []
    return [[...prefix, ...(count > prefix.length ? phrase(count - prefix.length).split(' ') : [])].join(' ')]
  }
  if (state.mode === 'characters') {
    const source = (state.opening ? opening + ' ' : '') + phrase(count)
    const result = graphemes(source).slice(0,count).join('')
    if (state.exact || source[result.length] === ' ' || result.endsWith(' ')) return [state.exact ? result : result.trimEnd()]
    return [result.includes(' ') ? result.slice(0, result.lastIndexOf(' ')) : result]
  }
  if (state.mode === 'sentences') return Array.from({ length: count }, (_, i) => sentence(i))
  return Array.from({ length: count }, (_, i) => Array.from({ length: 4 }, (_, j) => sentence(i * 4 + j)).join(' '))
}
export function truncation(state: State) {
  const common = 'max-width: ' + state.width + 'ch;\noverflow: hidden;'
  return state.singleLine ? common + '\nwhite-space: nowrap;\ntext-overflow: ellipsis;' :
    common + '\ndisplay: -webkit-box;\n-webkit-box-orient: vertical;\n-webkit-line-clamp: ' + state.lines + ';\nline-clamp: ' + state.lines + ';'
}
const escapeMarkup = (text: string) => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
function html(state: State) {
  const lines = blocks(state).map(escapeMarkup)
  if (state.structure === 'list') return '<ul>\n' + lines.map(line => '  <li>' + line + '</li>').join('\n') + '\n</ul>'
  if (state.structure === 'heading') return '<h2>' + lines[0] + '</h2>' + lines.slice(1).map(line => '\n<p>' + line + '</p>').join('')
  return lines.map(line => '<p>' + line + '</p>').join('\n')
}
function markdown(state: State) {
  const lines = blocks(state)
  if (state.structure === 'list') return lines.map(line => '- ' + line).join('\n')
  if (state.structure === 'heading') return ['## ' + lines[0], ...lines.slice(1)].join('\n\n')
  return lines.join('\n\n')
}
export const logic = defineTool<State>({
  id: 'lorem', schema, defaultState: () => ({ mode: 'paragraphs', count: 3, language: 'latin', seed: '', exact: true,
    opening: true, structure: 'paragraph', width: 44, lines: 2, singleLine: false,
    stripInvisible: true, replaceNbsp: true, straightQuotes: false, collapse: true, markdown: false }),
  presets: [],
  outputs: {
    plaintext: state => blocks(state).join(state.mode === 'paragraphs' ? '\n\n' : ' '),
    html, markdown, css: truncation,
    tailwind: state => 'max-w-[' + state.width + 'ch] ' + (state.singleLine ? 'truncate' : 'line-clamp-' + state.lines),
  },
})
