<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { sendAnimation } from '../../core/storage/animation-handoff'
import { useI18n } from 'vue-i18n'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import AnimationPreview from './AnimationPreview.vue'
import { directions, fills, jumps, keyframes, logic, newFrame, presets, sorted, type State } from './logic'

const { t } = useI18n()
const router = useRouter()
const transferError = ref(false)
async function transfer(state: State) {
  try {
    const id = await sendAnimation(state.name, keyframes(state))
    await router.push({ name: 'transitions', query: { handoff: id } })
  } catch { transferError.value = true }
}
const label = (key: string) => t('detail.animation.' + key)
const selected = ref('')
const timeline = ref<HTMLElement>()
const bezier = ref<SVGSVGElement>()
const value = (event: Event) => (event.target as HTMLInputElement).value
const current = (state: State) => state.keyframes.find(k => k.id === selected.value) ?? state.keyframes[0]
const frameFields = { percentage: [0, 100, 1], translateX: [-240, 240, 1], translateY: [-240, 240, 1],
  rotate: [-360, 360, 1], scale: [0, 4, .01], opacity: [0, 100, 1], radius: [0, 100, 1] } as const
const timingFields = { x1: [0, 1], y1: [-.5, 1.5], x2: [0, 1], y2: [-.5, 1.5] } as const
const springFields = { mass: [.2, 4, .1], stiffness: [15, 300, 1], damping: [1, 45, 1] } as const
const playbackFields = { duration: [50, 10000], delay: [-3000, 5000], iterations: [0, 30] } as const
type Update = (mutate: (draft: State) => void, group?: string) => void
function add(state: State, percentage: number) {
  const existing = state.keyframes.find(k => k.percentage === percentage)
  if (existing) {
    selected.value = existing.id
  } else if (state.keyframes.length < 24) {
    selected.value = crypto.randomUUID()
    state.keyframes.push(newFrame(selected.value, percentage))
  }
}
function deleteFrame(state: State, id: string) {
  if (state.keyframes.length <= 2) return
  state.keyframes = state.keyframes.filter(frame => frame.id !== id)
  selected.value = state.keyframes[0].id
}
function position(event: PointerEvent) {
  const rect = timeline.value!.getBoundingClientRect()
  return Math.min(100, Math.max(0, Math.round((event.clientX - rect.left) * 100 / rect.width)))
}
function startFrame(event: PointerEvent, id: string) {
  selected.value = id
  if (event.button === 0) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function dragFrame(event: PointerEvent, id: string, update: Update) {
  if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) return
  update(d => { const frame = d.keyframes.find(k => k.id === id); if (frame) frame.percentage = position(event) }, 'frame-' + id)
}
function keyFrame(event: KeyboardEvent, id: string, update: Update) {
  if (event.key === 'Delete') {
    event.preventDefault()
    update(d => deleteFrame(d, id))
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    const delta = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 5 : 1)
    update(d => {
      const frame = d.keyframes.find(k => k.id === id)!
      frame.percentage = Math.max(0, Math.min(100, frame.percentage + delta))
    }, 'frame-' + id)
  }
}
const y = (point: number) => 112 - point * 80
function dragCurve(event: PointerEvent, handle: 1 | 2, update: Update) {
  const target = event.currentTarget as SVGCircleElement
  if (event.type === 'pointerdown' && event.button === 0) target.setPointerCapture(event.pointerId)
  if (!target.hasPointerCapture(event.pointerId)) return
  const svg = bezier.value!
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
  update(d => {
    d.timing[handle === 1 ? 'x1' : 'x2'] = Math.round(Math.min(1, Math.max(0, (point.x - 20) / 160)) * 100) / 100
    d.timing[handle === 1 ? 'y1' : 'y2'] = Math.round(Math.min(1.5, Math.max(-.5, (112 - point.y) / 80)) * 100) / 100
  }, 'curve-' + handle)
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <button type="button" class="btn" @click="transfer(state)">Usar fotogramas en animaciones por scroll</button>
      <p v-if="transferError" role="alert">No se pudieron enviar los fotogramas.</p>
      <label>{{ label('name') }}<input :value="state.name" maxlength="32" required pattern="[a-z][a-z0-9\-]{0,31}"
        @change="($event.target as HTMLInputElement).reportValidity() && update(d => { d.name = value($event) })" /></label>
      <RangeField v-for="(limits, field) in playbackFields" :key="field" :label="label(field)" :min="limits[0]" :max="limits[1]" :model-value="state[field]"
        @update:model-value="update(d => { d[field] = Math.round($event) }, field)" />
      <div class="field-grid">
        <label>{{ label('direction') }}<select :value="state.direction" @change="update(d => { d.direction = value($event) as State['direction'] })">
          <option v-for="option in directions" :key="option">{{ option }}</option></select></label>
        <label>{{ label('fillMode') }}<select :value="state.fillMode" @change="update(d => { d.fillMode = value($event) as State['fillMode'] })">
          <option v-for="option in fills" :key="option">{{ option }}</option></select></label>
      </div>
      <label class="check"><input type="checkbox" :checked="state.playState === 'paused'" @change="update(d => { d.playState = d.playState === 'paused' ? 'running' : 'paused' })" />{{ label('paused') }}</label>
      <label class="check"><input type="checkbox" :checked="state.reduce" @change="update(d => { d.reduce = !d.reduce })" />{{ label('reduce') }}</label>
      <details open><summary>{{ label('timing') }}</summary>
        <label>{{ label('kind') }}<select :value="state.timing.kind" @change="update(d => { d.timing.kind = value($event) as State['timing']['kind'] })">
          <option v-for="kind in ['preset','bezier','steps','linear']" :key="kind" :value="kind">{{ label(kind) }}</option>
        </select></label>
        <label v-if="state.timing.kind === 'preset'">{{ label('preset') }}<select :value="state.timing.preset" @change="update(d => { d.timing.preset = value($event) as State['timing']['preset'] })">
          <option v-for="item in presets" :key="item">{{ item }}</option></select></label>
        <template v-if="state.timing.kind === 'bezier'">
          <svg ref="bezier" viewBox="0 0 200 160" class="curve" :aria-label="label('curve')">
            <path d="M20 32H180V112H20Z" fill="#ebf4ee" stroke="#a2b6a9" />
            <path :d="'M20 112 C' + (20 + state.timing.x1 * 160) + ' ' + y(state.timing.y1) + ' ' + (20 + state.timing.x2 * 160) + ' ' + y(state.timing.y2) + ' 180 32'" fill="none" stroke="#216049" stroke-width="3" />
            <circle v-for="handle in [1, 2] as const" :key="handle" :cx="20 + state.timing[handle === 1 ? 'x1' : 'x2'] * 160"
              :cy="y(state.timing[handle === 1 ? 'y1' : 'y2'])" r="8" fill="#a73c56" @pointerdown="dragCurve($event, handle, update)" @pointermove="dragCurve($event, handle, update)" />
          </svg>
          <RangeField v-for="(limits, field) in timingFields" :key="field" :label="field.toUpperCase()" :min="limits[0]" :max="limits[1]" :step=".01"
            :model-value="state.timing[field]" @update:model-value="update(d => { d.timing[field] = $event }, field)" />
        </template>
        <template v-if="state.timing.kind === 'steps'">
          <RangeField :label="label('stepCount')" :min="state.timing.jump === 'jump-none' ? 2 : 1" :max="24"
            :model-value="Math.max(state.timing.jump === 'jump-none' ? 2 : 1, state.timing.steps)" @update:model-value="update(d => { d.timing.steps = Math.round($event) })" />
          <label>{{ label('jump') }}<select :value="state.timing.jump" @change="update(d => { d.timing.jump = value($event) as State['timing']['jump'] })">
            <option v-for="jump in jumps" :key="jump">{{ jump }}</option></select></label>
        </template>
        <template v-if="state.timing.kind === 'linear'">
          <RangeField v-for="(limits, field) in springFields" :key="field" :label="label(field)" :min="limits[0]" :max="limits[1]" :step="limits[2]"
            :model-value="state.timing[field]" @update:model-value="update(d => { d.timing[field] = $event }, field)" />
        </template>
      </details>
      <details open><summary>{{ label('frame') }}</summary>
        <label>{{ label('frame') }}<select :value="current(state).id" @change="selected = value($event)">
          <option v-for="frame in sorted(state)" :key="frame.id" :value="frame.id">{{ frame.percentage }} %</option>
        </select></label>
        <RangeField v-for="(limits, field) in frameFields" :key="field" :label="label(field)" :min="limits[0]" :max="limits[1]" :step="limits[2]"
          :model-value="current(state)[field]" @update:model-value="update(d => { current(d)[field] = $event }, 'frame-' + field)" />
        <label>{{ t('tool.color') }}<input type="color" :value="current(state).color || '#24664f'" @input="update(d => { current(d).color = value($event) }, 'frame-color')" /></label>
        <div class="actions">
          <button class="btn" type="button" :disabled="!current(state).color" @click="update(d => { current(d).color = '' })">{{ label('clearColor') }}</button>
          <button class="btn" type="button" :disabled="state.keyframes.length <= 2" @click="update(d => deleteFrame(d, current(d).id))">{{ label('delete') }}</button>
        </div>
      </details>
    </template>
    <template #preview="{ state, update }">
      <div class="preview-area">
        <AnimationPreview :state="state" />
        <div class="timeline-box">
          <div class="timeline-head">
            <h3>{{ label('timeline') }}</h3>
            <button type="button" class="btn" :disabled="state.keyframes.length >= 24"
              @click="update(d => add(d, Array.from({length:101},(_,i)=>i).find(i => !d.keyframes.some(f => f.percentage === i)) ?? 50))">{{ label('add') }}</button>
          </div>
          <div ref="timeline" class="timeline" @pointerdown.self="update(d => add(d, position($event)))">
            <button v-for="frame in sorted(state)" :key="frame.id" type="button" :style="{ left: frame.percentage + '%' }"
              :aria-label="label('frame') + ' ' + frame.percentage + ' %'" :aria-pressed="current(state).id === frame.id"
              @click="selected = frame.id" @keydown="keyFrame($event, frame.id, update)" @pointerdown="startFrame($event, frame.id)"
              @pointermove="dragFrame($event, frame.id, update)">{{ frame.percentage }}<span aria-hidden="true">%</span></button>
          </div>
        </div>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
details { padding:.5rem 0;border-bottom:1px solid var(--line); }
summary { cursor:pointer;font-weight:650; }
.curve { width:100%;max-width:240px;display:block; }
.curve circle { cursor:grab;touch-action:none; }
.preview-area { display:grid;gap:.8rem;width:100%;min-width:0; }
.timeline-box { padding:.35rem .6rem .65rem;border:1px solid var(--line);border-radius:8px;background:var(--surface); }
.timeline-head { display:flex;justify-content:space-between;align-items:center;gap:.4rem; }
.timeline { position:relative;margin:.4rem 1.2rem;min-height:3rem;background:linear-gradient(var(--line),var(--line)) center/100% 2px no-repeat; }
.timeline button { position:absolute;top:50%;transform:translate(-50%,-50%);touch-action:none;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:.22rem;font-size:.75rem; }
.timeline button[aria-pressed=true] { color:var(--accent-ink);background:var(--accent);z-index:1; }
</style>
