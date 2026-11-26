import { property } from '..'

const direct: Record<string, string> = {
  'display:block': 'block', 'display:inline': 'inline', 'display:inline-block': 'inline-block', 'display:none': 'hidden',
  'display:flex': 'flex', 'display:inline-flex': 'inline-flex', 'display:grid': 'grid', 'display:inline-grid': 'inline-grid',
  'flex-direction:column': 'flex-col', 'flex-direction:row': 'flex-row', 'flex-wrap:wrap': 'flex-wrap',
  'align-items:center': 'items-center', 'align-items:stretch': 'items-stretch', 'align-items:flex-start': 'items-start',
  'justify-content:center': 'justify-center', 'justify-content:space-between': 'justify-between',
  'position:relative': 'relative', 'position:absolute': 'absolute', 'position:fixed': 'fixed', 'position:sticky': 'sticky',
  'font-weight:700': 'font-bold', 'font-weight:400': 'font-normal', 'text-align:center': 'text-center',
  'text-align:left': 'text-left', 'text-align:right': 'text-right',
  'color:black': 'text-black', 'color:white': 'text-white', 'background-color:black': 'bg-black',
  'background-color:white': 'bg-white', 'background-color:transparent': 'bg-transparent',
  'overflow:hidden': 'overflow-hidden',
}
const scale: Record<string, string> = {
  padding: 'p', 'padding-top': 'pt', 'padding-right': 'pr', 'padding-bottom': 'pb', 'padding-left': 'pl',
  'padding-inline': 'px', 'padding-block': 'py',
  margin: 'm', 'margin-top': 'mt', 'margin-right': 'mr', 'margin-bottom': 'mb', 'margin-left': 'ml',
  'margin-inline': 'mx', 'margin-block': 'my',
  gap: 'gap', 'row-gap': 'gap-y', 'column-gap': 'gap-x', width: 'w', height: 'h',
  'min-width': 'min-w', 'max-width': 'max-w', 'min-height': 'min-h', 'max-height': 'max-h',
  top: 'top', bottom: 'bottom', left: 'left', right: 'right',
}
const negativeScale = /^(?:margin(?:-|$)|top$|bottom$|left$|right$)/
function scaledUtility(prop: string, value: string) {
  if (!Object.hasOwn(scale, prop)) return
  if (value === '0') return scale[prop] + '-0'
  const match = value.match(/^(-?(?:\d+\.?\d*|\.\d+))rem$/)
  if (!match) return
  const amount = Number(match[1]) * 4
  if (!Number.isInteger(amount) || Math.abs(amount) > 384 || amount < 0 && !negativeScale.test(prop)) return
  return (amount < 0 ? '-' : '') + scale[prop] + '-' + Math.abs(amount)
}

export function utility(prop: string, value: string, allowArbitrary: boolean) {
  const normalized = value.trim().toLowerCase()
  const mapped = Object.hasOwn(direct, prop + ':' + normalized) ? direct[prop + ':' + normalized] : undefined
  if (mapped) return mapped
  const spacing = scaledUtility(prop, normalized)
  if (spacing) return spacing
  if (allowArbitrary && /^(?:--[\w-]+|[a-z][\w-]*)$/.test(prop) &&
    !/[\[\];{}\\]/.test(value) && !/\/\*/.test(value) && value.length <= 180 && ![...value].some(char => char.charCodeAt(0) < 32)) {
    return property(prop, value.trim())
  }
}
