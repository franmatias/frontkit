<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { sliderKey } from '../../lib/a11y'
import { clamp } from '../../lib/css'
import { addStop, gradientTypes, hueModes, image, logic, polar, radialSizes, sortedStops, spaces, type GradientState, type Stop } from './logic'

const { t } = useI18n()
const selected = ref('')
let dragging = ''
let draggingControl: 'angle' | 'center' | undefined
const angles = [0, 45, 90, 135, 180, 270]
const key = (name: string) => t('detail.gradient.' + name)
const checked = (event: Event) => (event.target as HTMLInputElement).checked
const value = (event: Event) => (event.target as HTMLInputElement).value
const current = (state: GradientState) => state.stops.find(item => item.id === selected.value) ?? sortedStops(state)[0]
const active = (state: GradientState, item: Stop) => current(state).id === item.id
const supported = (state: GradientState) => CSS.supports('background-image', image(state))

function patch(draft: GradientState, id: string, values: Partial<Stop>) {
  const item = draft.stops.find(stop => stop.id === id)
  if (item) Object.assign(item, values)
}
function erase(state: GradientState, id: string) {
  if (state.stops.length <= 2) return
  state.stops = state.stops.filter(stop => stop.id !== id)
  state.hints = state.hints.filter(hint => hint.after !== id)
}
function reverse(state: GradientState) {
  const old = sortedStops(state)
  state.stops = old.map(stop => ({
    ...stop, position: 100 - Math.max(stop.position, stop.position2 ?? stop.position),
    position2: stop.position2 === undefined ? undefined : 100 - stop.position,
  })).reverse()
  state.hints = state.hints.flatMap(hint => {
    const next = old[old.findIndex(stop => stop.id === hint.after) + 1]
    return next ? [{ after: next.id, position: 100 - hint.position }] : []
  })
}
function distribute(state: GradientState) {
  const ordered = sortedStops(state)
  ordered.forEach((item, index) => {
    const next = 100 * index / (ordered.length - 1)
    if (item.position2 !== undefined) item.position2 = clamp(next + item.position2 - item.position, next, 100)
    item.position = next
  })
}
function hint(draft: GradientState, id: string, position: number | undefined) {
  draft.hints = draft.hints.filter(hint => hint.after !== id)
  if (position !== undefined) draft.hints.push({ after: id, position })
}
type Update = (apply: (draft: GradientState) => void, group?: string) => void
function add(update: Update, position: number) {
  update(draft => { selected.value = addStop(draft, position) ?? selected.value })
}
function markerKey(event: KeyboardEvent, item: Stop, update: Update) {
  if (event.key === 'Delete') {
    event.preventDefault()
    update(draft => erase(draft, item.id))
    return
  }
  if (event.key === 'Enter') {
    selected.value = item.id
    document.getElementById('gradient-color')?.focus()
    return
  }
  const position = sliderKey(event, item.position, 0, 100)
  if (position !== undefined) update(draft => patch(draft, item.id, { position }), 'stop-' + item.id)
}
function pointerPosition(event: MouseEvent, element: Element) {
  const box = element.getBoundingClientRect()
  return Math.round(clamp((event.clientX - box.left) * 100 / box.width, 0, 100))
}
function start(event: PointerEvent, item: Stop) {
  if (event.button !== 0) return
  const target = event.currentTarget as HTMLButtonElement
  selected.value = item.id
  dragging = item.id
  target.setPointerCapture(event.pointerId)
}
function drag(event: PointerEvent, item: Stop, update: Update) {
  const parent = (event.currentTarget as HTMLElement).parentElement
  if (dragging === item.id && parent) update(draft => patch(draft, item.id, {
    position: pointerPosition(event, parent),
  }), 'stop-' + item.id)
}
function geometry(event: PointerEvent, kind: 'angle' | 'center', update: Update) {
  if (draggingControl !== kind) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1)
  update(draft => {
    if (kind === 'angle') draft.angle = (Math.round(Math.atan2(x - 0.5, 0.5 - y) * 180 / Math.PI) + 360) % 360
    else draft.position = { x: Math.round(x * 100), y: Math.round(y * 100) }
  }, kind)
}
function startGeometry(event: PointerEvent, kind: 'angle' | 'center', update: Update) {
  if (event.button !== 0) return
  const target = event.currentTarget as HTMLElement
  draggingControl = kind
  target.setPointerCapture(event.pointerId)
  geometry(event, kind, update)
}
</script>

<template>
  <ToolWorkspace :logic="logic" :supported="supported">
    <template #controls="{ state, update }">
      <div class="field-grid">
        <label>{{ key('type') }}<select :value="state.type" @change="update(d => { d.type = value($event) as GradientState['type'] })">
          <option v-for="type in gradientTypes" :key="type" :value="type">{{ key('types.' + type) }}</option>
        </select></label>
        <label>{{ key('interpolation') }}<select :value="state.interpolation" @change="update(d => { d.interpolation = value($event) as GradientState['interpolation'] })">
          <option v-for="space in spaces" :key="space" :value="space">{{ space === 'default' ? key('default') : space }}</option>
        </select></label>
        <label v-if="polar(state.interpolation)">{{ key('hue') }}<select :value="state.hueMethod" @change="update(d => { d.hueMethod = value($event) as GradientState['hueMethod'] })">
          <option v-for="mode in hueModes" :key="mode" :value="mode">{{ key('modes.' + mode) }}</option>
        </select></label>
        <label v-if="state.type === 'radial'">{{ key('shape') }}<select :value="state.radialShape" @change="update(d => { d.radialShape = value($event) as GradientState['radialShape'] })">
          <option value="circle">{{ key('circle') }}</option><option value="ellipse">{{ key('ellipse') }}</option>
        </select></label>
        <label v-if="state.type === 'radial'">{{ key('size') }}<select :value="state.radialSize" @change="update(d => { d.radialSize = value($event) as GradientState['radialSize'] })">
          <option v-for="size in radialSizes" :key="size" :value="size">{{ key('sizes.' + size) }}</option>
        </select></label>
        <label class="check"><input type="checkbox" :checked="state.repeating" @change="update(d => { d.repeating = checked($event) })" />{{ key('repeat') }}</label>
        <label class="check"><input type="checkbox" :checked="state.text" @change="update(d => { d.text = checked($event) })" />{{ key('clip') }}</label>
      </div>
      <div v-if="state.type !== 'radial'" class="control-group">
        <div class="gradient-dial" aria-hidden="true" :style="{ '--angle': state.angle + 'deg' }"
          @pointerdown="startGeometry($event, 'angle', update)" @pointermove="geometry($event, 'angle', update)"
          @lostpointercapture="draggingControl = undefined"><i /></div>
        <RangeField :label="key('angle')" :model-value="state.angle" :min="0" :max="360" @update:model-value="update(d => { d.angle = $event }, 'angle')" />
        <div class="actions">
          <button v-for="angle in angles" :key="angle" class="btn pill" type="button" @click="update(d => { d.angle = angle })">{{ angle }}°</button>
        </div>
      </div>
      <div v-if="state.type !== 'linear'" class="control-group">
        <div class="gradient-pad" aria-hidden="true" :style="{ '--x': state.position.x + '%', '--y': state.position.y + '%' }"
          @pointerdown="startGeometry($event, 'center', update)" @pointermove="geometry($event, 'center', update)"
          @lostpointercapture="draggingControl = undefined"><i /></div>
        <RangeField :label="key('centerX')" :model-value="state.position.x" :min="0" :max="100" @update:model-value="update(d => { d.position.x = $event }, 'x')" />
        <RangeField :label="key('centerY')" :model-value="state.position.y" :min="0" :max="100" @update:model-value="update(d => { d.position.y = $event }, 'y')" />
      </div>
      <div class="control-group">
        <h3>{{ key('stops') }}</h3>
        <div class="stop-bar" :style="{ backgroundImage: 'linear-gradient(90deg, ' + sortedStops(state).map(item => item.color + ' ' + item.position + '%').join(', ') + ')' }"
          @click.self="add(update, pointerPosition($event, $event.currentTarget as Element))">
          <button v-for="(item, index) in sortedStops(state)" :key="item.id" type="button" role="slider" class="stop-mark"
            :class="{ selected: active(state, item) }" :style="{ left: item.position + '%', '--swatch': item.color }"
            :aria-label="key('stop') + ' ' + (index + 1)" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="item.position"
            @focus="selected = item.id" @keydown="markerKey($event, item, update)" @pointerdown="start($event, item)"
            @pointermove="drag($event, item, update)" @lostpointercapture="dragging = ''" />
        </div>
        <div class="actions">
          <button class="btn" type="button" :disabled="state.stops.length >= 20" @click="add(update, 50)">{{ key('add') }}</button>
          <button class="btn" type="button" @click="update(reverse)">{{ key('reverse') }}</button>
          <button class="btn" type="button" @click="update(distribute)">{{ key('distribute') }}</button>
        </div>
        <label class="color-label">{{ t('tool.color') }}<input id="gradient-color" type="color" :value="current(state).color" @input="update(d => patch(d, current(state).id, { color: value($event) }), 'color')" /></label>
        <RangeField :label="t('tool.opacity')" :model-value="current(state).opacity" :min="0" :max="100" @update:model-value="update(d => patch(d, current(state).id, { opacity: $event }), 'alpha-' + current(state).id)" />
        <RangeField :label="key('position')" :model-value="current(state).position" :min="0" :max="100" @update:model-value="update(d => patch(d, current(state).id, { position: $event }), 'stop-' + current(state).id)" />
        <label class="check"><input type="checkbox" :checked="current(state).position2 !== undefined" @change="update(d => patch(d, current(state).id, { position2: checked($event) ? Math.min(100, current(state).position + 10) : undefined }))" />{{ key('hard') }}</label>
        <RangeField v-if="current(state).position2 !== undefined" :label="key('end')" :model-value="Math.max(current(state).position, current(state).position2 ?? 0)" :min="Math.ceil(current(state).position)" :max="100" @update:model-value="update(d => patch(d, current(state).id, { position2: $event }), 'end-' + current(state).id)" />
        <label v-if="current(state).id !== sortedStops(state).at(-1)?.id" class="check">
          <input type="checkbox" :checked="state.hints.some(h => h.after === current(state).id)" @change="update(d => hint(d, current(state).id, checked($event) ? (current(state).position + (sortedStops(state).find(s => s.position > current(state).position)?.position ?? 100)) / 2 : undefined))" />{{ key('hint') }}
        </label>
        <RangeField v-if="state.hints.some(h => h.after === current(state).id)" :label="key('hintPosition')" :model-value="state.hints.find(h => h.after === current(state).id)?.position ?? 50" :min="0" :max="100" @update:model-value="update(d => hint(d, current(state).id, $event), 'hint-' + current(state).id)" />
        <button type="button" class="btn danger" :disabled="state.stops.length <= 2" @click="update(d => erase(d, current(state).id))">{{ t('app.remove') }}</button>
      </div>
    </template>
    <template #preview="{ state }">
      <div v-if="state.text" class="gradient-text" :style="{ backgroundImage: image(state) }">FrontKit</div>
      <div v-else class="gradient-sample" :style="{ backgroundImage: image(state) }" />
    </template>
  </ToolWorkspace>
</template>
