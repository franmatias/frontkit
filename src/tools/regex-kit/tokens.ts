export type TokenKind = 'literal' | 'escape' | 'class' | 'anchor' | 'group' | 'quantifier' | 'operator' | 'reference'
type Explanation = { title: string; description: string }
export type Token = Explanation & { text: string; kind: TokenKind }

export const glossary: Token[] = [
  { text: '.', kind: 'class', title: 'Cualquier carácter', description: 'Coincide con un carácter. La bandera s incluye los saltos de línea.' },
  { text: '\\d', kind: 'class', title: 'Dígito', description: 'Coincide con un dígito del 0 al 9.' },
  { text: '\\D', kind: 'class', title: 'Carácter que no es dígito', description: 'Coincide con cualquier carácter fuera de [0-9].' },
  { text: '\\w', kind: 'class', title: 'Carácter de palabra', description: 'Incluye letras ASCII, dígitos y el guion bajo. Con i y u/v también cubre equivalentes Unicode de esas letras.' },
  { text: '\\W', kind: 'class', title: 'Carácter que no es de palabra', description: 'Coincide con cualquier carácter que quede fuera de \\w.' },
  { text: '\\s', kind: 'class', title: 'Espacio en blanco', description: 'Incluye espacios, tabulaciones y saltos de línea.' },
  { text: '\\S', kind: 'class', title: 'Carácter que no es espacio', description: 'Coincide con cualquier carácter que quede fuera de \\s.' },
  { text: '\\b', kind: 'anchor', title: 'Límite de palabra', description: 'Comprueba la transición entre un carácter de palabra y uno que no lo es.' },
  { text: '\\B', kind: 'anchor', title: 'Posición sin límite de palabra', description: 'Comprueba que la posición no se encuentre en un límite de palabra.' },
  { text: '^', kind: 'anchor', title: 'Inicio', description: 'Marca el inicio del texto. Con m también marca el inicio de cada línea.' },
  { text: '$', kind: 'anchor', title: 'Final', description: 'Marca el final del texto. Con m también marca el final de cada línea.' },
  { text: '[a-z]', kind: 'class', title: 'Clase de caracteres', description: 'Coincide con un carácter incluido en la lista o intervalo.' },
  { text: '[^0-9]', kind: 'class', title: 'Clase negada', description: 'El ^ al comienzo de una clase excluye los caracteres de la lista.' },
  { text: '\\.', kind: 'escape', title: 'Punto literal', description: 'Busca un punto exacto. La barra inversa le quita su función de comodín.' },
  { text: '|', kind: 'operator', title: 'Alternativa', description: 'Intenta las alternativas de izquierda a derecha.' },
  { text: '?', kind: 'quantifier', title: 'Cero o una vez', description: 'Hace opcional el elemento anterior.' },
  { text: '*', kind: 'quantifier', title: 'Cero o más veces', description: 'Repite el elemento anterior tantas veces como sea posible.' },
  { text: '+', kind: 'quantifier', title: 'Una o más veces', description: 'Exige una aparición del elemento anterior y permite más.' },
  { text: '{2,4}', kind: 'quantifier', title: 'Entre dos y cuatro veces', description: 'Limita el número de repeticiones del elemento anterior. Añade ? para intentar primero la menor cantidad.' },
  { text: '(…)', kind: 'group', title: 'Grupo de captura', description: 'Agrupa una parte del patrón y permite consultar lo que capturó.' },
  { text: '(?:…)', kind: 'group', title: 'Grupo sin captura', description: 'Agrupa elementos sin guardar lo que coincidió.' },
  { text: '(?<dia>…)', kind: 'group', title: 'Grupo nombrado', description: 'Asigna un nombre a la captura. Puedes usar $<dia> al sustituir.' },
  { text: '\\1', kind: 'reference', title: 'Referencia a una captura', description: 'Busca el texto capturado por el primer grupo. Para una captura nombrada, usa \\k<nombre>.' },
  { text: '(?=…)', kind: 'group', title: 'Anticipación positiva', description: 'Comprueba lo que sigue a la posición actual sin incluirlo en la coincidencia.' },
]

const definitions = new Map(glossary.map(item => [item.text, item]))

// El lexer describe el patrón mientras se escribe. El motor del navegador valida su sintaxis.
export function tokenize(pattern: string, unicodeSets: boolean): Token[] {
  const tokens: Token[] = []
  const escapedToken = /\\(?:[pPq]\{[^}]*\}|u\{[^}]*\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|c[A-Za-z]|k<[^>]*>|[1-9]\d*|[\s\S])?/y
  const group = /\(\?(?:<[=!]|<[^>]*>|[=!]|[ims]*(?:-[ims]+)?:)/y
  const quantifier = /(?:\{\d+(?:,\d*)?\}|[?*+])\??/y
  let pos = 0

  const read = (regex: RegExp) => {
    regex.lastIndex = pos
    return regex.exec(pattern)?.[0]
  }
  while (pos < pattern.length) {
    const start = pos
    const char = pattern[pos]
    let item: Omit<Token, 'text'>
    if (char === '\\') {
      const value = read(escapedToken)!
      pos += value.length
      item = definitions.get(value) ?? explainEscape(value)
    } else if (char === '[') {
      let depth = 1
      pos++
      while (pos < pattern.length && depth) {
        if (pattern[pos] === '\\') pos += read(escapedToken)!.length
        else {
          if (pattern[pos] === ']') depth--
          if (pattern[pos] === '[' && unicodeSets) depth++
          pos++
        }
      }
      item = depth
        ? { kind: 'class', title: 'Clase sin cerrar', description: 'Completa la clase con un corchete de cierre.' }
        : definitions.get(pattern.slice(start, start + 2) === '[^' ? '[^0-9]' : '[a-z]')!
    } else if (char === '(' || char === ')') {
      const value = read(group) ?? char
      pos += value.length
      item = explainGroup(value)
    } else if ('.^$|'.includes(char)) {
      pos++
      item = definitions.get(char)!
    } else {
      const value = read(quantifier)
      if (value) {
        pos += value.length
        const lazy = value.length > 1 && value.endsWith('?')
        const base = lazy ? value.slice(0, -1) : value
        item = {
          kind: 'quantifier',
          title: (definitions.get(base)?.title ?? 'Repetición contada') + (lazy ? ' · mínima' : ''),
          description: 'Establece cuántas veces puede aparecer el elemento anterior. Intenta primero la cantidad ' + (lazy ? 'menor' : 'mayor') + ' permitida.',
        }
      } else {
        pos++
        const previous = tokens.at(-1)
        if (previous?.kind === 'literal') {
          previous.text += char
          continue
        }
        item = { kind: 'literal', title: 'Texto literal', description: 'Busca este texto. La bandera i ignora las diferencias entre mayúsculas y minúsculas.' }
      }
    }
    tokens.push({ ...item, text: pattern.slice(start, pos) })
  }
  return tokens
}

function explainEscape(value: string): Omit<Token, 'text'> {
  if (/^\\(?:[1-9]|k<)/.test(value)) return { kind: 'reference', title: 'Referencia a una captura', description: 'Busca el mismo texto que capturó el grupo indicado.' }
  if (/^\\[pP]\{/.test(value)) return { kind: 'class', title: 'Propiedad Unicode', description: 'Selecciona caracteres de una propiedad Unicode con \\p o su complemento con \\P. Requiere u o v.' }
  const special = new Map([['\\n', 'Salto de línea'], ['\\r', 'Retorno de carro'], ['\\t', 'Tabulación'], ['\\f', 'Salto de página'], ['\\v', 'Tabulación vertical'], ['\\0', 'Carácter nulo']])
  const title = special.get(value)
  if (title) return { kind: 'escape', title, description: 'Busca el carácter de control representado por esta secuencia.' }
  if (/^\\[uxc]/.test(value)) return { kind: 'escape', title: 'Carácter codificado', description: 'Usa un valor hexadecimal, Unicode o una letra de control para indicar un carácter.' }
  return value === '\\'
    ? { kind: 'escape', title: 'Escape incompleto', description: 'Añade el carácter que quieres escapar.' }
    : { kind: 'escape', title: 'Carácter escapado', description: 'La barra inversa permite buscar un metacarácter de forma literal.' }
}

function explainGroup(value: string): Omit<Token, 'text'> {
  switch (value) {
    case '(': return { kind: 'group', title: 'Grupo de captura', description: 'Abre un grupo. Su posición de apertura determina el número de captura.' }
    case ')': return { kind: 'group', title: 'Cierre de grupo', description: 'Termina el grupo y permite aplicar un cuantificador al conjunto.' }
    case '(?:': return { kind: 'group', title: 'Grupo sin captura', description: 'Agrupa partes del patrón sin guardar una captura.' }
    case '(?=': return { kind: 'group', title: 'Anticipación positiva', description: 'Comprueba que la posición actual esté seguida de este patrón.' }
    case '(?!': return { kind: 'group', title: 'Anticipación negativa', description: 'Comprueba que la posición actual no esté seguida de este patrón.' }
    case '(?<=': return { kind: 'group', title: 'Retrospección positiva', description: 'Comprueba que la posición actual esté precedida por este patrón.' }
    case '(?<!': return { kind: 'group', title: 'Retrospección negativa', description: 'Comprueba que la posición actual no esté precedida por este patrón.' }
  }
  if (value.startsWith('(?<')) {
    const name = value.slice(3, -1)
    return { kind: 'group', title: 'Grupo nombrado', description: 'Captura el texto como «' + name + '». Inserta su valor al sustituir con $<' + name + '>.' }
  }
  return { kind: 'group', title: 'Banderas de grupo', description: 'Aplica las banderas indicadas solo dentro de este grupo.' }
}
