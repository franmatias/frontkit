<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { clamp } from '../../lib/css'
import { declarations, logic, sides, styles, units, type BorderState, type Side } from './logic'

const { t } = useI18n()
const selected = ref<(typeof sides)[number]>('top')
const corners = ['tl', 'tr', 'br', 'bl'] as const
type Axis = 'horizontal' | 'vertical'
type Corner = 0 | 1 | 2 | 3
const handles = (['horizontal', 'vertical'] as const).flatMap(axis =>
  ([0, 1, 2, 3] as const).map(corner => ({ axis, corner, id: axis + '-' + corner })))
const sample = ref<HTMLElement>()
let dragging = ''
const key = (name: string) => t('detail.border.' + name)
const value = (event: Event) => (event.target as HTMLInputElement).value
const checked = (event: Event) => (event.target as HTMLInputElement).checked
const current = (state: BorderState) => state.border[state.border.linked ? 'top' : selected.value]
function patch(state: BorderState, values: Partial<Side>) {
  if (state.border.linked) {
    for (const side of sides) state.border[side] = { ...state.border.top, ...values }
  } else Object.assign(state.border[selected.value], values)
}
function link(state: BorderState, linked: boolean) {
  if (linked) {
    const side = state.border[selected.value]
    for (const target of sides) state.border[target] = { ...side }
  }
  state.border.linked = linked
}
function handleStyle(state: BorderState, axis: Axis, corner: Corner) {
  const value = state.radius[axis][corner]
  const limit = state.radius.unit === '%' ? '45%' : '45% - 1px'
  const distance = 'min(' + value + state.radius.unit + ', calc(' + limit + '))'
  const x = axis === 'horizontal' ? distance : '0px'
  const y = axis === 'vertical' ? distance : '0px'
  return {
    left: corner === 1 || corner === 2 ? 'calc(100% - ' + x + ')' : x,
    top: corner >= 2 ? 'calc(100% - ' + y + ')' : y,
  }
}
function startDrag(event: PointerEvent, id: string) {
  if (event.button !== 0) return
  dragging = id
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function drag(event: PointerEvent, state: BorderState, axis: Axis, corner: Corner) {
  if (dragging !== axis + '-' + corner || !sample.value) return
  const rect = sample.value.getBoundingClientRect()
  const horizontal = axis === 'horizontal'
  const offset = horizontal
    ? (corner === 1 || corner === 2 ? rect.right - event.clientX : event.clientX - rect.left)
    : (corner >= 2 ? rect.bottom - event.clientY : event.clientY - rect.top)
  const unit = state.radius.unit
  const amount = unit === '%' ? offset * 100 / (horizontal ? rect.width : rect.height)
    : unit === 'rem' ? offset / Number.parseFloat(getComputedStyle(document.documentElement).fontSize) : offset
  state.radius[axis][corner] = clamp(unit === 'rem' ? Math.round(amount * 10) / 10 : Math.round(amount), 0, 200)
}
</script>

<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <label class="check"><input type="checkbox" :checked="state.border.linked" @change="update(d => link(d, checked($event)))" />{{ key('linked') }}</label>
      <div v-if="!state.border.linked" class="actions">
        <button v-for="side in sides" :key="side" type="button" class="btn pill" :aria-pressed="selected === side" @click="selected = side">{{ key(side) }}</button>
      </div>
      <div class="field-grid">
        <label>{{ t('tool.style') }}<select :value="current(state).style" @change="update(d => patch(d, { style: value($event) as Side['style'] }))">
          <option v-for="style in styles" :key="style" :value="style">{{ style }}</option>
        </select></label>
        <label class="color-label">{{ t('tool.color') }}<input type="color" :value="current(state).color"
          @input="update(d => patch(d, { color: value($event) }), 'color-' + selected)" /></label>
      </div>
      <RangeField :label="t('tool.width')" :model-value="current(state).width" :min="0" :max="32"
        @update:model-value="update(d => patch(d, { width: $event }), 'width-' + selected)" />
      <RangeField :label="t('tool.opacity')" :model-value="current(state).opacity" :min="0" :max="100"
        @update:model-value="update(d => patch(d, { opacity: $event }), 'opacity-' + selected)" />
      <div class="control-group">
        <h3>{{ key('radius') }}</h3>
        <div class="field-grid">
          <label>{{ key('mode') }}<select :value="state.radius.mode" @change="update(d => { d.radius.mode = value($event) as BorderState['radius']['mode'] })">
            <option value="simple">{{ key('simple') }}</option><option value="organic">{{ key('organic') }}</option>
          </select></label>
          <label>{{ key('unit') }}<select :value="state.radius.unit" @change="update(d => { d.radius.unit = value($event) as BorderState['radius']['unit'] })">
            <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
          </select></label>
        </div>
        <RangeField v-for="(corner, index) in corners" :key="corner" :label="key(corner) + (state.radius.mode === 'organic' ? ' · ' + key('horizontal') : '')"
          :model-value="state.radius.horizontal[index]" :min="0" :max="200" :step="state.radius.unit === 'rem' ? 0.1 : 1"
          @update:model-value="update(d => { d.radius.horizontal[index] = $event }, corner)" />
        <template v-if="state.radius.mode === 'organic'">
          <RangeField v-for="(corner, index) in corners" :key="corner" :label="key(corner) + ' · ' + key('vertical')"
            :model-value="state.radius.vertical[index]" :min="0" :max="200" :step="state.radius.unit === 'rem' ? 0.1 : 1"
            @update:model-value="update(d => { d.radius.vertical[index] = $event }, corner + '-vertical')" />
        </template>
      </div>
      <div class="control-group">
        <label class="check"><input type="checkbox" :checked="state.outline.enabled" @change="update(d => { d.outline.enabled = checked($event) })" />{{ key('outline') }}</label>
        <template v-if="state.outline.enabled">
          <div class="field-grid">
            <label>{{ t('tool.style') }}<select :value="state.outline.style" @change="update(d => { d.outline.style = value($event) as Side['style'] })">
              <option v-for="style in styles" :key="style" :value="style">{{ style }}</option>
            </select></label>
            <label class="color-label">{{ t('tool.color') }}<input type="color" :value="state.outline.color" @input="update(d => { d.outline.color = value($event) }, 'outline-color')" /></label>
          </div>
          <RangeField :label="key('outlineWidth')" :model-value="state.outline.width" :min="0" :max="32" @update:model-value="update(d => { d.outline.width = $event }, 'outline-width')" />
          <RangeField :label="key('outlineOffset')" :model-value="state.outline.offset" :min="-20" :max="40" @update:model-value="update(d => { d.outline.offset = $event }, 'outline-offset')" />
        </template>
      </div>
    </template>
    <template #preview="{ state, update }">
      <div ref="sample" class="border-stage">
        <div class="border-sample" :style="declarations(state)">FrontKit</div>
        <template v-if="state.radius.mode === 'organic'">
          <span v-for="handle in handles" :key="handle.id" class="radius-handle" aria-hidden="true"
            :class="'radius-' + handle.axis" :style="handleStyle(state, handle.axis, handle.corner)"
            @pointerdown="startDrag($event, handle.id)"
            @pointermove="update(d => drag($event, d, handle.axis, handle.corner), handle.id)"
            @lostpointercapture="dragging = ''" />
        </template>
      </div>
    </template>
  </ToolWorkspace>
</template>
