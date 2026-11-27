export type RegexState = { pattern: string; flags: string; text: string }
type Range = [start: number, end: number]
export type Capture = { value: string | undefined; range: Range | undefined }
export type Match = { value: string; range: Range; captures: Capture[]; named: Record<string, Capture> }
export type Transformation = { mode: 'replace' | 'literal' | 'upper' | 'lower'; template: string }
export type RegexRequest = RegexState & { transformation?: Transformation }
export type Transformed = { text: string } | { limited: true }
export type RegexResult =
  | { matches: Match[]; limited: boolean; transformed?: Transformed }
  | { error: string }

export const maxPattern = 2000
export const maxReplacement = 2000
export const maxTransformed = 200_000
export const maxText = 50_000
export const maxMatches = 300
export const maxResultChars = 250_000
export const maxCaptures = 3000

export const presets = [
  { id: 'dni', name: 'DNI / NIE · formato', pattern: String.raw`\b(?:\d{8}|[XYZ]\d{7})[A-Z]\b`, flags: 'gi', text: 'DNI: 12345678Z, NIE: X1234567L, inválido: 1234Z' },
  { id: 'iban', name: 'IBAN · formato', pattern: String.raw`\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b`, flags: 'gi', text: 'IBAN: ES91 2100 0418 4502 0005 1332\nEjemplo incorrecto: ES12' },
  { id: 'email', name: 'Correo electrónico', pattern: String.raw`(?<usuario>[\w.+-]+)@(?<dominio>[\w.-]+\.[A-Z]{2,})\b`, flags: 'gi', text: 'Escribe a aula@example.org o a soporte+web@example.net.' },
  { id: 'date', name: 'Fecha ISO · formato', pattern: String.raw`\b(?<año>\d{4})-(?<mes>0[1-9]|1[0-2])-(?<día>0[1-9]|[12]\d|3[01])\b`, flags: 'g', text: 'Inicio: 2026-09-15\nFin: 2027-06-22\nFormato incorrecto: 2027-13-01' },
  { id: "phone", name: "Teléfono español · formato", pattern: String.raw`(?:\+34[ .-]?)?\b[6789](?:[ .-]?\d){8}\b`, flags: "g", text: "Móvil: +34 612 345 678\nFijo: 958-123-456\nIncompleto: 612 34" },
  { id: "postal", name: "Código postal español · formato", pattern: String.raw`\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b`, flags: "g", text: "Granada: 18001\nCeuta: 51001\nFuera de rango: 99001" },
  { id: "time", name: "Hora de 24 h", pattern: String.raw`\b(?<hora>[01]\d|2[0-3]):(?<minutos>[0-5]\d)(?::(?<segundos>[0-5]\d))?\b`, flags: "g", text: "Apertura: 08:30\nCierre: 21:45:15\nFuera de rango: 26:00" },
  { id: "hex", name: "Color CSS hexadecimal", pattern: String.raw`#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w-])`, flags: "gi", text: "Color: #FA0, #369c, #1b7f63, #40c6ba99\nIncorrecto: #12456" },
  { id: "uuid", name: "UUID · formato", pattern: String.raw`\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b`, flags: "gi", text: "ID: 550e8400-e29b-41d4-a716-446655440000\nIncompleto: 550e8400-e29b" },
  { id: "slug", name: "Slug para una URL", pattern: String.raw`^[a-z0-9]+(?:-[a-z0-9]+)*$`, flags: "gm", text: "curso-html-2026\nmis-proyectos\nslug--incorrecto\nUna página" },
  { id: "version", name: "Versión con tres componentes", pattern: String.raw`\bv?(?<mayor>0|[1-9]\d*)\.(?<menor>0|[1-9]\d*)\.(?<parche>0|[1-9]\d*)\b`, flags: "g", text: "Estable: v2.14.0\nAnterior: 1.8.3\nIncompleta: 2.14" },
  { id: "repeated", name: "Palabras repetidas", pattern: String.raw`\b(?<palabra>[a-z]+)\s+\k<palabra>\b`, flags: "gi", text: "El el texto tiene un un duplicado.\nAquí no hay duplicados." },
  { id: "unicode", name: "Palabras con letras Unicode", pattern: String.raw`\p{L}[\p{L}\p{M}]*`, flags: "gu", text: "Andalucía · café · Ελληνικά · 東京 · 2026" },
  { id: "lookahead", name: "Números seguidos de una unidad", pattern: String.raw`\b\d+(?:[.,]\d+)?(?=\s*kg\b)`, flags: "g", text: "Pesos: 4 kg, 12,5 kg\nDistancia: 8 km" },
]

export const flagOptions = [
  ['g', 'Todas las coincidencias', 'Recorre el texto y muestra todas las coincidencias. Sin g, el kit muestra la primera.'],
  ['i', 'Ignorar mayúsculas', 'Compara letras sin distinguir entre mayúsculas y minúsculas.'],
  ['m', 'Anclas por línea', 'Permite que ^ y $ marquen el inicio y el final de cada línea.'],
  ['s', 'El punto incluye saltos de línea', 'Permite que el comodín . también coincida con saltos de línea.'],
  ['u', 'Unicode', 'Interpreta el patrón por puntos de código Unicode y permite clases como \\p{L}.'],
  ['v', 'Conjuntos Unicode', 'Amplía las clases Unicode con operaciones como intersección y diferencia. Se usa en lugar de u.'],
] as const

export function changeFlag(flags: string, flag: string, enabled: boolean) {
  let next = flags.replaceAll(flag, '')
  if (enabled) {
    if (flag === 'u' || flag === 'v') next = next.replace(/[uv]/g, '')
    next += flag
  }
  return [...next].sort().join('')
}

export function presetState(preset: RegexState): RegexState {
  return { pattern: preset.pattern, flags: preset.flags, text: preset.text }
}
