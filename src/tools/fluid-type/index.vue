<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { fluidValue, rounded } from '../../lib/css/fluid'
import { logic, properties, range, valid, type Row, type State } from './logic'

const { t } = useI18n()
const label = (key: string) => t('detail.fluid-type.' + key)
const selected = ref('')
const viewport = ref(800)
const comparison = ref(false)
const fixed = ref(16)
const fields = { minViewport: [160,3840], maxViewport: [160,3840], root: [8,40] } as const
const value = (event: Event) => (event.target as HTMLInputElement).value
const active = (state: State) => state.rows.find(row => row.id === selected.value) ?? state.rows[0]
const size = (state: State) => valid(state) ? rounded(fluidValue(range(state, active(state)), viewport.value)) : active(state).start
const risky = (state: State) => state.property === 'font-size' && state.rows.some(row => Math.max(row.start, row.end) > 2.5 * Math.min(row.start, row.end))
function add(state: State) {
  let step = state.rows.length + 1
  while (state.rows.some(row => row.name === 'fluido-' + step)) step++
  const id = crypto.randomUUID()
  state.rows.push({ id, name: 'fluido-' + step, start: 14, end: 20 })
  selected.value = id
}
function rename(state: State, row: Row, event: Event) {
  const input = event.target as HTMLInputElement
  const name = input.value.trim()
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name) || state.rows.some(item => item.id !== row.id && item.name === name)) {
    input.setCustomValidity(label('badName'))
    input.reportValidity()
    return
  }
  row.name = name
}
function graph(state: State) {
  const row = active(state)
  const min = Math.min(row.start, row.end, comparison.value ? fixed.value : Infinity)
  const max = Math.max(row.start, row.end, comparison.value ? fixed.value : -Infinity)
  const span = Math.max(1, max - min)
  const y = (value: number) => 103 - 73 * (value - min) / span
  const position = Math.min(1, Math.max(0, (viewport.value - state.minViewport) / (state.maxViewport - state.minViewport)))
  return { x: 30 + position * 278, point: y(size(state)), begin: y(row.start), end: y(row.end), fixed: y(fixed.value) }
}
function sampleStyle(state: State, amount: number) {
  return { [state.property]: amount + 'px' }
}
</script>
<template>
  <ToolWorkspace :logic="logic" :supported="valid">
    <template #controls="{ state, update }">
      <label>{{ label('property') }}<select :value="state.property" @change="update(d => { d.property = value($event) as State['property'] })">
        <option v-for="property in properties" :key="property">{{ property }}</option>
      </select></label>
      <div class="field-grid">
        <label>{{ label('unit') }}<select :value="state.unit" @change="update(d => { d.unit = value($event) === 'px' ? 'px' : 'rem' })"><option>rem</option><option>px</option></select></label>
        <label>{{ label('row') }}<select :value="active(state).id" @change="selected = value($event)">
          <option v-for="row in state.rows" :key="row.id" :value="row.id">{{ row.name }}</option>
        </select></label>
      </div>
      <RangeField v-for="(limits, key) in fields" :key="key" :label="label(key)" :min="limits[0]" :max="limits[1]"
        :model-value="state[key]" @update:model-value="update(d => { d[key] = Math.round($event) }, key)" />
      <p v-if="!valid(state)" class="notice" role="alert">{{ label('invalidViewport') }}</p>
      <label>{{ label('name') }}<input :key="active(state).id" :value="active(state).name" maxlength="32"
        @input="($event.target as HTMLInputElement).setCustomValidity('')" @change="update(d => rename(d, active(d), $event))" /></label>
      <RangeField v-for="edge in ['start','end'] as const" :key="edge" :label="label(edge)" :min="0" :max="1200" :step=".1"
        :model-value="active(state)[edge]" @update:model-value="update(d => { active(d)[edge] = $event }, edge)" />
      <div class="actions">
        <button type="button" class="btn" :disabled="state.rows.length >= 12" @click="update(add)">{{ label('add') }}</button>
        <button type="button" class="btn" :disabled="state.rows.length === 1"
          @click="update(d => { d.rows = d.rows.filter(row => row.id !== active(d).id); selected = '' })">{{ label('remove') }}</button>
      </div>
      <p v-if="risky(state)" class="notice">
        {{ label('zoom') }} <a href="https://www.w3.org/WAI/WCAG22/Techniques/failures/F94" target="_blank" rel="noopener noreferrer">WCAG 1.4.4</a>
      </p>
    </template>
    <template #preview="{ state }">
      <div class="preview-fluid">
        <RangeField :label="label('viewport')" :min="160" :max="3840" :model-value="viewport" @update:model-value="viewport = $event" />
        <p class="result" role="status">{{ label('value') }} <strong>{{ size(state) }} px</strong></p>
        <svg v-if="valid(state)" viewBox="0 0 340 134" role="img" :aria-label="label('graph')">
          <path d="M30 14V103H308" fill="none" stroke="currentColor" opacity=".5" />
          <path :d="'M30 ' + graph(state).begin + 'L308 ' + graph(state).end" fill="none" stroke="#307959" stroke-width="3" />
          <path v-if="comparison" :d="'M30 ' + graph(state).fixed + 'H308'" stroke="#a6355a" stroke-width="2" stroke-dasharray="5 4" />
          <circle :cx="graph(state).x" :cy="graph(state).point" r="5" fill="#1e4e3a" />
          <text x="30" y="124" fill="currentColor" font-size="11">{{ state.minViewport }} px</text>
          <text x="308" y="124" text-anchor="end" fill="currentColor" font-size="11">{{ state.maxViewport }} px</text>
        </svg>
        <label class="check"><input v-model="comparison" type="checkbox" />{{ label('compare') }}</label>
        <RangeField v-if="comparison" :label="label('fixed')" :min="1" :max="1200" :model-value="fixed" @update:model-value="fixed = $event" />
        <div class="samples">
          <div class="sample" :style="sampleStyle(state,size(state))"><span>{{ label('fluidSample') }}</span><span v-if="state.property === 'gap'">Aa</span></div>
          <div v-if="comparison" class="sample" :style="sampleStyle(state,fixed)"><span>{{ label('fixedSample') }}</span><span v-if="state.property === 'gap'">Aa</span></div>
        </div>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.preview-fluid { width:100%;min-width:0; }
.preview-fluid svg { width:100%;max-width:35rem;display:block;color:var(--text); }
.samples { display:grid;gap:.7rem;overflow:auto; }
.sample { display:flex;min-height:2rem;align-items:center;max-width:100%;background:var(--surface);border:1px solid var(--line);overflow:hidden;overflow-wrap:anywhere; }
.result strong { font-size:1.2rem; }
</style>
