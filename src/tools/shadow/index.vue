<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RangeField from '../../components/shared/RangeField.vue'
import SendStyleButton from '../../components/shared/SendStyleButton.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { move } from '../../lib/a11y'
import { layer, logic, shadow, type Layer, type ShadowState } from './logic'

const { t } = useI18n()
const dragging = ref('')
const focused = ref('')
const key = (name: string) => t('detail.shadow.' + name)
const value = (event: Event) => (event.target as HTMLInputElement).value
const checked = (event: Event) => (event.target as HTMLInputElement).checked
const ranges = [
  { id: 'offsetX', min: -100, max: 100 }, { id: 'offsetY', min: -100, max: 100 },
  { id: 'blur', min: 0, max: 150 }, { id: 'spread', min: -50, max: 100 },
  { id: 'opacity', min: 0, max: 100 },
] as const
const colors = ['backdrop', 'element', 'textColor'] as const
const current = (state: ShadowState) => state.layers.find(item => item.id === focused.value) ?? state.layers[0]

function patch(state: ShadowState, id: string, values: Partial<Layer>) {
  const item = state.layers.find(layer => layer.id === id)
  if (item) Object.assign(item, values)
}
function add(state: ShadowState, copy: Partial<Layer> = {}) {
  if (state.layers.length >= 12) return
  const id = crypto.randomUUID()
  state.layers.push(layer(id, { ...copy, id }))
  focused.value = id
}
function drop(state: ShadowState, target: string) {
  const index = state.layers.findIndex(layer => layer.id === dragging.value)
  const destination = state.layers.findIndex(layer => layer.id === target)
  move(state.layers, index, destination - index)
  dragging.value = ''
}
</script>

<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <SendStyleButton v-if="state.mode === 'box'" from="shadow" :value="shadow(state)" />
      <label>{{ key('mode') }}
        <select :value="state.mode" @change="update(d => { d.mode = value($event) as ShadowState['mode'] })">
          <option value="box">{{ key('box') }}</option><option value="text">{{ key('text') }}</option>
        </select>
      </label>
      <div class="control-group">
        <div class="panel-top">
          <h3>{{ key('layers') }}</h3>
          <button class="btn" type="button" :disabled="state.layers.length >= 12" @click="update(d => add(d))">{{ key('add') }}</button>
        </div>
        <ul class="layer-list">
          <li v-for="(item, index) in state.layers" :key="item.id" @dragover.prevent @drop.prevent="update(d => drop(d, item.id))">
            <button type="button" class="btn grow" draggable="true" :aria-pressed="current(state).id === item.id"
              @dragstart="dragging = item.id; $event.dataTransfer?.setData('text/plain', item.id)"
              @dragend="dragging = ''" @click="focused = item.id">
              <span class="swatch" :style="{ backgroundColor: item.color }" />{{ key('layer') }} {{ index + 1 }}
            </button>
            <button type="button" class="icon-btn" :disabled="index === 0" :aria-label="t('app.previous') + ' ' + key('layer') + ' ' + (index + 1)" @click="update(d => move(d.layers, index, -1))">↑</button>
            <button type="button" class="icon-btn" :disabled="index === state.layers.length - 1" :aria-label="t('app.next') + ' ' + key('layer') + ' ' + (index + 1)" @click="update(d => move(d.layers, index, 1))">↓</button>
          </li>
        </ul>
        <div class="actions">
          <label class="check"><input type="checkbox" :checked="current(state).enabled" @change="update(d => patch(d, current(state).id, { enabled: checked($event) }))" />{{ t('app.enabled') }}</label>
          <label v-if="state.mode === 'box'" class="check"><input type="checkbox" :checked="current(state).inset" @change="update(d => patch(d, current(state).id, { inset: checked($event) }))" />{{ key('inset') }}</label>
        </div>
        <label class="color-label">{{ t('tool.color') }}<input type="color" :value="current(state).color" @input="update(d => patch(d, current(state).id, { color: value($event) }), 'color-' + current(state).id)" /></label>
        <template v-for="range in ranges" :key="range.id">
          <RangeField v-if="range.id !== 'spread' || state.mode === 'box'" :label="key(range.id)"
            :model-value="current(state)[range.id]" :min="range.min" :max="range.max"
            @update:model-value="update(d => patch(d, current(state).id, { [range.id]: $event }), range.id + current(state).id)" />
        </template>
        <div class="actions">
          <button class="btn" type="button" :disabled="state.layers.length >= 12" @click="update(d => add(d, current(state)))">{{ t('app.duplicate') }}</button>
          <button class="btn danger" type="button" :disabled="state.layers.length < 2"
            @click="update(d => { d.layers = d.layers.filter(item => item.id !== current(state).id) })">{{ t('app.remove') }}</button>
        </div>
      </div>
      <details class="control-group">
        <summary>{{ key('previewSettings') }}</summary>
        <div class="field-grid">
          <label v-for="color in colors" :key="color" class="color-label">{{ key(color) }}
            <input type="color" :value="state.previewConfig[color]" @input="update(d => { d.previewConfig[color] = value($event) }, color)" />
          </label>
          <label>{{ key('shape') }}<select :value="state.previewConfig.shape" @change="update(d => { d.previewConfig.shape = value($event) as ShadowState['previewConfig']['shape'] })">
            <option v-for="shape in ['square', 'card', 'circle']" :key="shape" :value="shape">{{ key(shape) }}</option>
          </select></label>
          <label>{{ t('tool.sample') }}<input type="text" maxlength="100" :value="state.previewConfig.sampleText" @input="update(d => { d.previewConfig.sampleText = value($event) }, 'sample')" /></label>
        </div>
        <RangeField :label="key('radius')" :model-value="state.previewConfig.radius" :min="0" :max="100"
          @update:model-value="update(d => { d.previewConfig.radius = $event }, 'radius')" />
      </details>
    </template>
    <template #preview="{ state }">
      <div class="shadow-scene" :style="{ '--sample-backdrop': state.previewConfig.backdrop }">
        <div class="shadow-sample" :class="'shape-' + state.previewConfig.shape" :style="{
          backgroundColor: state.previewConfig.element, color: state.previewConfig.textColor,
          borderRadius: state.previewConfig.shape === 'circle' ? '50%' : state.previewConfig.radius + 'px',
          boxShadow: state.mode === 'box' ? shadow(state) : undefined, textShadow: state.mode === 'text' ? shadow(state) : undefined,
        }">{{ state.previewConfig.sampleText }}</div>
      </div>
    </template>
  </ToolWorkspace>
</template>
