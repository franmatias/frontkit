import * as v from 'valibot'
import { radius as organicRadius, radiusSchema } from '../blob/logic'
import { defineTool } from '../../core/tool'
import { decimal } from '../../lib/css'
import { hexColor, identifier, numberBetween } from '../../lib/schema'

export const presets = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'] as const
export const jumps = ['jump-start', 'jump-end', 'jump-none', 'jump-both'] as const
export const directions = ['normal', 'reverse', 'alternate', 'alternate-reverse'] as const
export const fills = ['none', 'forwards', 'backwards', 'both'] as const
const frame = v.strictObject({
  id: identifier, percentage: numberBetween(0, 100), translateX: numberBetween(-240, 240), translateY: numberBetween(-240, 240),
  rotate: numberBetween(-360, 360), scale: numberBetween(0, 4), opacity: numberBetween(0, 100),
  color: v.union([hexColor, v.literal('')]), radius: numberBetween(0, 100), organic: v.optional(radiusSchema),
})
export const timingSchema = v.strictObject({
    kind: v.picklist(['preset', 'bezier', 'steps', 'linear']), preset: v.picklist(presets), jump: v.picklist(jumps),
    steps: numberBetween(1, 24), x1: numberBetween(0, 1), y1: numberBetween(-.5, 1.5),
    x2: numberBetween(0, 1), y2: numberBetween(-.5, 1.5),
    mass: numberBetween(.2, 4), stiffness: numberBetween(15, 300), damping: numberBetween(1, 45),
  })
const schema = v.strictObject({
  name: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,31}$/)), duration: numberBetween(50, 10000), delay: numberBetween(-3000, 5000),
  iterations: v.pipe(numberBetween(0, 30), v.integer()), direction: v.picklist(directions), fillMode: v.picklist(fills),
  playState: v.picklist(['running', 'paused']), reduce: v.boolean(),
  timing: timingSchema,
  keyframes: v.pipe(v.array(frame), v.minLength(2), v.maxLength(24), v.check(items => new Set(items.map(item => item.id)).size === items.length)),
})
export type Frame = v.InferOutput<typeof frame>
export type State = v.InferOutput<typeof schema>
export const newFrame = (id: string, percentage: number, changes: Partial<Frame> = {}): Frame => ({
  id, percentage, translateX: 0, translateY: 0, rotate: 0, scale: 1, opacity: 100, color: '', radius: 16, ...changes,
})
const end = () => newFrame('end', 100)
function initial(name = 'fade-in-up', frames = [newFrame('start', 0, { translateY: 32, opacity: 0 }), end()]): State {
  return { name, duration: 700, delay: 0, iterations: 1, direction: 'normal', fillMode: 'both', playState: 'running', reduce: true,
    timing: { kind: 'preset', preset: 'ease-out', jump: 'jump-end', steps: 4,
      x1: .25, y1: .1, x2: .25, y2: 1, mass: 1, stiffness: 115, damping: 10 },
    keyframes: frames,
  }
}
export const sorted = (state: State) => [...state.keyframes].sort((a, b) => a.percentage - b.percentage)
export function spring(timing: State['timing']) {
  const { mass, stiffness, damping } = timing
  const stops = [0]
  const dt = Math.min(.004, .1 / Math.sqrt(stiffness / mass), .25 * mass / damping)
  const tick = Math.ceil(1.7 / (20 * dt))
  let x = 0
  let velocity = 0
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < tick; j++) {
      velocity += (stiffness * (1 - x) - damping * velocity) / mass * dt
      x += velocity * dt
    }
    stops.push(Number.isFinite(x) ? decimal(x) : 1)
  }
  stops[stops.length - 1] = 1
  return stops
}
export function timingFunction(state: Pick<State, 'timing'>) {
  const t = state.timing
  if (t.kind === 'preset') return t.preset
  if (t.kind === 'bezier') return 'cubic-bezier(' + [t.x1, t.y1, t.x2, t.y2].join(', ') + ')'
  if (t.kind === 'steps') return 'steps(' + Math.max(t.jump === 'jump-none' ? 2 : 1, Math.round(t.steps)) + ', ' + t.jump + ')'
  return 'linear(' + spring(t).join(', ') + ')'
}
export function frameStyle(frame: Frame) {
  return { transform: 'translate(' + frame.translateX + 'px, ' + frame.translateY + 'px) rotate(' + frame.rotate + 'deg) scale(' + frame.scale + ')',
    opacity: String(frame.opacity / 100), borderRadius: frame.organic ? organicRadius(frame.organic) : frame.radius + 'px', ...(frame.color ? { backgroundColor: frame.color } : {}) }
}
export function keyframes(state: State) {
  const rules = sorted(state).map(frame => {
    const css = frameStyle(frame)
    return '  ' + frame.percentage + '% { transform: ' + css.transform + '; opacity: ' + css.opacity +
      '; border-radius: ' + css.borderRadius + ';' + (css.backgroundColor ? ' background-color: ' + css.backgroundColor + ';' : '') + ' }'
  })
  return ['@keyframes ' + state.name + ' {', ...rules, '}'].join('\n')
}
const shorthand = (s: State) => [s.name, s.duration + 'ms', timingFunction(s), s.delay + 'ms', s.iterations || 'infinite', s.direction, s.fillMode, s.playState].join(' ')
function css(state: State) {
  const selector = '.animate-' + state.name
  const reduction = state.reduce ? '\n\n@media (prefers-reduced-motion: reduce) {\n  ' + selector + ' { animation: none; }\n}' : ''
  return keyframes(state) + '\n\n' + selector + ' { animation: ' + shorthand(state) + '; }' + reduction
}
function tailwind(state: State) {
  return '@theme {\n  --animate-' + state.name + ': ' + shorthand(state) + ';\n' +
    keyframes(state).split('\n').map(line => '  ' + line).join('\n') + '\n}\n\n/* animate-' + state.name +
    (state.reduce ? ' motion-reduce:animate-none' : '') + ' */'
}
const examples: [string, string, Frame[]][] = [
  ['fade-in-up', 'Fade In Up', initial().keyframes],
  ['bounce', 'Bounce', [newFrame('start', 0), newFrame('middle', 45, { translateY: -54 }), end()]],
  ['pulse', 'Pulse', [newFrame('start', 0), newFrame('middle', 50, { scale: 1.15 }), end()]],
  ['shake', 'Shake', [newFrame('start', 0), newFrame('left', 25, { translateX: -18 }), newFrame('right', 65, { translateX: 18 }), end()]],
  ['spin', 'Spin', [newFrame('start', 0), newFrame('end', 100, { rotate: 360 })]],
  ['float', 'Float', [newFrame('start', 0), newFrame('middle', 50, { translateY: -25 }), end()]],
]
export const logic = defineTool<State>({
  id: 'animation', schema, defaultState: () => initial(), outputs: { css, tailwind },
  presets: examples.map(([id, name, frames]) => ({ id, name, builtin: true, state: initial(id, frames) })),
})
