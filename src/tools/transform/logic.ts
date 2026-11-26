import * as v from 'valibot'
import { defineTool } from '../../core/tool'
import { decimal } from '../../lib/css'
import { numberBetween } from '../../lib/schema'
import { arbitrary } from '../../lib/tailwind'

export const operations = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ',
  'scaleX', 'scaleY', 'scaleZ', 'skewX', 'skewY'] as const
export type Operation = (typeof operations)[number]
export const in3d = (op: Operation) => ['translateZ', 'rotateX', 'rotateY', 'rotateZ', 'scaleZ'].includes(op)
export const neutral = (op: Operation) => op.startsWith('scale') ? 1 : 0
export const limits = (op: Operation): readonly [number, number, number] =>
  op.startsWith('scale') ? [-4, 4, .01] : op.startsWith('skew') ? [-85, 85, 1] : [-360, 360, 1]
const schema = v.strictObject({
  mode: v.picklist(['2d', '3d']), unit: v.picklist(['px', '%']), lockAspect: v.boolean(), grid: v.boolean(),
  values: v.record(v.picklist(operations), numberBetween(-360, 360)),
  order: v.pipe(v.array(v.picklist(operations)), v.length(operations.length), v.check(order => new Set(order).size === operations.length)),
  perspective: numberBetween(0, 2000), perspectiveX: numberBetween(0, 100), perspectiveY: numberBetween(0, 100),
  originX: numberBetween(0, 100), originY: numberBetween(0, 100), originZ: numberBetween(-200, 200),
  transformStyle: v.picklist(['flat', 'preserve-3d']), backface: v.picklist(['visible', 'hidden']),
})
export type State = v.InferOutput<typeof schema>
export function initial(overrides: Partial<State> = {}): State {
  return { mode: '2d', unit: 'px', lockAspect: false, grid: false, values: { rotate: 16 }, order: [...operations],
    perspective: 600, perspectiveX: 50, perspectiveY: 50, originX: 50, originY: 50, originZ: 0,
    transformStyle: 'preserve-3d', backface: 'visible', ...overrides }
}
export function active(state: State) {
  return state.order.filter(op => (state.mode === '3d' || !in3d(op)) && (state.values[op] ?? neutral(op)) !== neutral(op))
}
function suffix(state: State, op: Operation) {
  if (op.startsWith('scale')) return ''
  if (op === 'translateZ') return 'px'
  return op.startsWith('translate') ? state.unit : 'deg'
}
export function transform(state: State) {
  return active(state).map(op => op + '(' + decimal(state.values[op]!) + suffix(state, op) + ')').join(' ') || 'none'
}
export const parentStyle = (state: State) => state.mode === '3d' ? {
  perspective: state.perspective ? state.perspective + 'px' : 'none',
  'perspective-origin': state.perspectiveX + '% ' + state.perspectiveY + '%',
} : {}
export const elementStyle = (state: State) => ({
  transform: transform(state),
  'transform-origin': state.originX + '% ' + state.originY + '%' + (state.mode === '3d' ? ' ' + state.originZ + 'px' : ''),
  ...(state.mode === '3d' ? { 'transform-style': state.transformStyle, 'backface-visibility': state.backface } : {}),
})
const cssRule = (selector: string, entries: Record<string, string | undefined>) => selector + ' {\n' +
  Object.entries(entries).filter(([,value]) => value !== undefined).map(([key, value]) => '  ' + key + ': ' + value + ';').join('\n') + '\n}'
function tailwind(state: State) {
  const style = elementStyle(state)
  const ops = active(state)
  const [op] = ops
  const utility = op === 'rotateZ' ? 'rotate-z' : op?.replace(/[XYZ]$/, axis => '-' + axis.toLowerCase())
  const effect = ops.length === 1 && op !== 'rotateZ'
    ? arbitrary(utility!, decimal(state.values[op]!) + (op.startsWith('scale') ? '' : suffix(state, op)))
    : ops.length ? arbitrary('transform', style.transform) : 'transform-none'
  const element = [effect, arbitrary('origin', style['transform-origin'])]
  if (state.mode === '3d') element.push(state.transformStyle === 'flat' ? 'transform-flat' : 'transform-3d', 'backface-' + state.backface)
  return [
    ...(state.mode === '3d' ? ['<div class="' + (state.perspective ? arbitrary('perspective', state.perspective + 'px') : 'perspective-none') +
      ' ' + arbitrary('perspective-origin', state.perspectiveX + '% ' + state.perspectiveY + '%') + '">'] : []),
    '<div class="' + element.join(' ') + '"></div>', ...(state.mode === '3d' ? ['</div>'] : []),
  ].join('\n')
}
export const logic = defineTool<State>({
  id: 'transform', schema, defaultState: initial,
  outputs: { css: state => [state.mode === '3d' ? cssRule('.scene', parentStyle(state)) : '', cssRule('.element', elementStyle(state))].filter(Boolean).join('\n\n'), tailwind },
  presets: [
    { id: 'tilt', name: 'Inclinación', builtin: true, state: initial({ values: { rotate: -12, translateX: 24 } }) },
    { id: 'card', name: 'Tarjeta 3D', builtin: true, state: initial({ mode: '3d', grid: true, values: { rotateY: -36, rotateX: 18 } }) },
  ],
})
