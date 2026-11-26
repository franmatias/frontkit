<script setup lang="ts">
import { ArrowRight, Grip, MoveDiagonal } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import {
  alignment, containerRules, directions, distribution, flows, gapUnits, itemRules, logic,
  makeItem, makeTrack, resolved, self, units, validAreas, wraps,
  type Breakpoint, type Container, type Item, type LayoutState, type Track,
} from './logic'

const { t } = useI18n()
const label = (key: string) => t('detail.layout.' + key)
const selected = ref('')
const inspector = ref<'container' | 'item'>('container')
const viewport = ref('full')
const sizes: Record<string, number | undefined> = { full: undefined, mobile: 375, compact: 640, tablet: 768, desktop: 1024 }
const viewportBreakpoints: Record<string, Breakpoint> = { full: 'base', mobile: 'base', compact: 'sm', tablet: 'md', desktop: 'lg' }
const target = (state: LayoutState) => state.responsive ? viewportBreakpoints[viewport.value] : 'base'
const settings = (state: LayoutState) => resolved(state, target(state))
const selection = (state: LayoutState) => settings(state).items.find(item => item.id === selected.value) ?? settings(state).items[0]
const brush = ref('main')
const dragItem = ref('')
type Update = (apply: (draft: LayoutState) => void, group?: string) => void
const value = (event: Event) => (event.target as HTMLInputElement).value
function overrideAt(state: LayoutState, bp: Exclude<Breakpoint, 'base'>) {
  state.overrides[bp] ??= { container: {}, items: {} }
  return state.overrides[bp]
}
function changeContainer(state: LayoutState, patch: Partial<Container>) {
  const bp = target(state)
  if (bp === 'base') Object.assign(state.container, patch)
  else Object.assign(overrideAt(state, bp).container, patch)
}
function changeItem(state: LayoutState, id: string, patch: Partial<Item>) {
  const bp = target(state)
  if (bp === 'base') Object.assign(state.items.find(item => item.id === id)!, patch)
  else {
    const { items } = overrideAt(state, bp)
    items[id] = { ...items[id], ...patch }
  }
}
function move(state: LayoutState, from: string, to: string) {
  const index = state.items.findIndex(item => item.id === from)
  const destination = state.items.findIndex(item => item.id === to)
  if (index === destination || index < 0 || destination < 0) return
  state.items.splice(destination, 0, state.items.splice(index, 1)[0])
}
function moveKey(event: KeyboardEvent, state: LayoutState, update: Update, id: string) {
  const step: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }
  if (!event.altKey || !step[event.key]) return
  const index = state.items.findIndex(item => item.id === id)
  const destination = state.items[index + step[event.key]]
  if (!destination) return
  event.preventDefault()
  update(d => move(d, id, destination.id))
}
function remove(state: LayoutState, id: string) {
  state.items = state.items.filter(item => item.id !== id)
  for (const override of Object.values(state.overrides)) delete override.items[id]
  selected.value = state.items[0].id
}
function editTrack(state: LayoutState, axis: 'columns' | 'rows', index: number, patch?: Partial<Track>) {
  const tracks = [...settings(state).container[axis]]
  if (!patch) tracks.splice(index, 1)
  else tracks[index] = { ...makeTrack(), ...tracks[index], ...patch }
  changeContainer(state, { [axis]: tracks })
}
function resizeAreas(state: LayoutState, width: number, height: number) {
  const old = settings(state).container.areas
  const areas = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => old[y]?.[x] ?? '.'))
  changeContainer(state, { areas })
}
function paint(state: LayoutState, x: number, y: number) {
  const name = brush.value.trim() || '.'
  if (!/^(?:[a-zA-Z_][a-zA-Z0-9_-]{0,31}|\.)$/.test(name)) return
  const areas = settings(state).container.areas.map(row => [...row])
  areas[y][x] = name
  changeContainer(state, { areas })
}
let spanDrag: { id: string; x: number; y: number; width: number; height: number; columns: number; rows: number } | undefined
function startSpan(event: PointerEvent, item: Item) {
  if (event.button !== 0) return
  const handle = event.currentTarget as HTMLElement
  const box = handle.parentElement!.getBoundingClientRect()
  spanDrag = { id: item.id, x: event.clientX, y: event.clientY, width: Math.max(24, box.width / item.colSpan),
    height: Math.max(24, box.height / item.rowSpan), columns: item.colSpan, rows: item.rowSpan }
  handle.setPointerCapture(event.pointerId)
}
function dragSpan(event: PointerEvent, update: Update) {
  if (!spanDrag || !(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) return
  const { id, x, y, width, height, columns, rows } = spanDrag
  const clamp = (x: number) => Math.min(24, Math.max(1, x))
  update(d => changeItem(d, id, { colSpan: clamp(columns + Math.round((event.clientX - x) / width)),
    rowSpan: clamp(rows + Math.round((event.clientY - y) / height)) }), 'span-' + id)
}
const axes = ['columns', 'rows'] as const
const gaps = ['columnGap', 'rowGap'] as const
const align = ['justifyContent', 'alignContent', 'alignItems', 'justifyItems'] as const
const numberItems = ['order', 'colStart', 'colSpan', 'rowStart', 'rowSpan'] as const
const flexNumbers = ['order', 'grow', 'shrink'] as const
</script>

<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <div class="field-grid">
        <label>{{ label('system') }}
          <select :value="state.system" @change="update(d => { d.system = value($event) === 'flex' ? 'flex' : 'grid' })">
            <option value="grid">Grid</option><option value="flex">Flexbox</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" :checked="state.responsive" @change="update(d => { d.responsive = !d.responsive })" />{{ label('responsive') }}</label>
      </div>
      <div class="actions">
        <button class="btn pill" type="button" :aria-pressed="inspector === 'container'" @click="inspector = 'container'">{{ label('container') }}</button>
        <button class="btn pill" type="button" :aria-pressed="inspector === 'item'" @click="inspector = 'item'">{{ label('item') }}</button>
      </div>
      <template v-if="inspector === 'container'">
        <div class="field-grid">
          <template v-if="state.system === 'flex'">
            <label>{{ label('direction') }}
              <select :value="settings(state).container.direction" @change="update(d => changeContainer(d, { direction: value($event) as Container['direction'] }))">
                <option v-for="option in directions" :key="option">{{ option }}</option>
              </select>
            </label>
            <label>{{ label('wrap') }}
              <select :value="settings(state).container.wrap" @change="update(d => changeContainer(d, { wrap: value($event) as Container['wrap'] }))">
                <option v-for="option in wraps" :key="option">{{ option }}</option>
              </select>
            </label>
          </template>
          <label v-else>{{ label('flow') }}
            <select :value="settings(state).container.flow" @change="update(d => changeContainer(d, { flow: value($event) as Container['flow'] }))">
              <option v-for="option in flows" :key="option">{{ option }}</option>
            </select>
          </label>
          <label v-for="field in align.filter(key => key !== 'justifyItems' || state.system === 'grid')" :key="field">{{ label(field) }}
            <select :value="settings(state).container[field]" @change="update(d => changeContainer(d, { [field]: value($event) }))">
              <option v-for="option in field.endsWith('Content') ? distribution : alignment" :key="option">{{ option }}</option>
            </select>
          </label>
          <label v-for="field in gaps" :key="field">{{ label(field) }}
            <input type="number" min="0" max="200" :value="settings(state).container[field]" @change="update(d => changeContainer(d, { [field]: Math.max(0, Math.min(200, Number(value($event)))) }))" />
          </label>
          <label>{{ label('gapUnit') }}
            <select :value="settings(state).container.gapUnit" @change="update(d => changeContainer(d, { gapUnit: value($event) as Container['gapUnit'] }))">
              <option v-for="unit in gapUnits" :key="unit">{{ unit }}</option>
            </select>
          </label>
        </div>
        <template v-if="state.system === 'grid'">
          <fieldset v-for="axis in axes" :key="axis" class="tracks">
            <legend>{{ label(axis) }}</legend>
            <div v-for="(track, index) in settings(state).container[axis]" :key="index" class="track">
              <select :aria-label="label(axis) + ' ' + (index + 1)" :value="track.unit"
                @change="update(d => editTrack(d, axis, index, { unit: value($event) as Track['unit'] }))">
                <option v-for="unit in units" :key="unit">{{ unit }}</option>
              </select>
              <input v-if="['fr', 'px', '%', 'repeat'].includes(track.unit)" type="number" min="0" max="1200" step=".1"
                :aria-label="label('size')" :value="track.value"
                @change="update(d => editTrack(d, axis, index, { value: Math.max(0, Math.min(1200, Number(value($event)))) }))" />
              <input v-if="track.unit === 'repeat'" type="number" min="1" max="12" :aria-label="label('repetitions')" :value="track.count"
                @change="update(d => editTrack(d, axis, index, { count: Math.max(1, Math.min(12, Number(value($event)))) }))" />
              <template v-if="['minmax', 'auto-fit', 'auto-fill'].includes(track.unit)">
                <input v-for="limit in ['min', 'max'] as const" :key="limit" :aria-label="label(limit)" :value="track[limit]"
                  pattern="(auto|min-content|max-content|[0-9]{1,4}(\.[0-9]{1,2})?(fr|px|%|rem))"
                  @change="($event.target as HTMLInputElement).reportValidity() && update(d => editTrack(d, axis, index, { [limit]: value($event) }))" />
              </template>
              <button class="btn" type="button" :aria-label="label('removeTrack')" :disabled="settings(state).container[axis].length === 1" @click="update(d => editTrack(d, axis, index))">−</button>
            </div>
            <button class="btn" type="button" :disabled="settings(state).container[axis].length >= 12"
              @click="update(d => editTrack(d, axis, settings(d).container[axis].length, makeTrack()))">{{ label('addTrack') }}</button>
          </fieldset>
          <fieldset class="tracks">
            <legend>{{ label('areas') }}</legend>
            <div class="actions">
              <button class="btn" type="button" @click="update(d => resizeAreas(d, 3, 3))">{{ label('areaMatrix') }}</button>
              <button class="btn" type="button" :disabled="!settings(state).container.areas.length" @click="update(d => changeContainer(d, { areas: [] }))">{{ label('clearAreas') }}</button>
            </div>
            <template v-if="settings(state).container.areas.length">
              <div class="field-grid">
                <label v-for="axis in axes" :key="axis">{{ label(axis) }}
                  <input type="number" min="1" max="12" :value="axis === 'columns' ? settings(state).container.areas[0].length : settings(state).container.areas.length"
                    @change="update(d => { const matrix = settings(d).container.areas; const n = Math.max(1, Math.min(12, Math.round(Number(value($event))))); resizeAreas(d, axis === 'columns' ? n : matrix[0].length, axis === 'rows' ? n : matrix.length) })" />
                </label>
              </div>
              <label>{{ label('brush') }}<input v-model="brush" maxlength="32" /></label>
              <div class="area-matrix">
                <div v-for="(row, y) in settings(state).container.areas" :key="y" class="area-row">
                  <button v-for="(name, x) in row" :key="x" class="btn" type="button"
                    :aria-label="label('cell') + ' ' + (y + 1) + ', ' + (x + 1) + ' · ' + name" @click="update(d => paint(d, x, y))">{{ name }}</button>
                </div>
              </div>
              <p v-if="!validAreas(settings(state).container.areas)" class="notice" role="status">{{ label('invalidAreas') }}</p>
            </template>
          </fieldset>
        </template>
      </template>
      <template v-else>
        <label>{{ label('item') }}
          <select :value="selection(state).id" @change="selected = value($event)">
            <option v-for="item in state.items" :key="item.id" :value="item.id">{{ label('item') }} {{ item.id }}</option>
          </select>
        </label>
        <div class="field-grid">
          <label v-for="field in state.system === 'grid' ? numberItems : flexNumbers" :key="field">{{ label(field) }}
            <input type="number" :min="field === 'order' ? -24 : field.endsWith('Span') ? 1 : 0" :max="field === 'grow' || field === 'shrink' ? 20 : 24"
              :value="selection(state)[field]"
              @change="update(d => { const input = $event.target as HTMLInputElement; changeItem(d, selection(d).id, { [field]: Math.max(Number(input.min), Math.min(Number(input.max), Math.round(Number(input.value)))) }) })" />
          </label>
          <label v-for="field in state.system === 'grid' ? ['alignSelf', 'justifySelf'] as const : ['alignSelf'] as const" :key="field">{{ label(field) }}
            <select :value="selection(state)[field]" @change="update(d => changeItem(d, selection(d).id, { [field]: value($event) }))">
              <option v-for="option in self" :key="option">{{ option }}</option>
            </select>
          </label>
          <label v-if="state.system === 'grid'">{{ label('area') }}
            <select :value="selection(state).area" @change="update(d => changeItem(d, selection(d).id, { area: value($event) }))">
              <option value="">{{ label('lines') }}</option>
              <option v-for="name in [...new Set(settings(state).container.areas.flat().filter(name => name !== '.'))]" :key="name">{{ name }}</option>
            </select>
          </label>
          <label v-else>{{ label('basis') }}<input :value="selection(state).basis" pattern="(auto|content|[0-9]{1,4}(px|%|rem))"
            @change="($event.target as HTMLInputElement).reportValidity() && update(d => changeItem(d, selection(d).id, { basis: value($event) }))" /></label>
        </div>
      </template>
    </template>
    <template #preview="{ state, update }">
      <div class="layout-preview">
        <div class="canvas-tools">
          <label>{{ label('viewport') }}
            <select v-model="viewport">
              <option v-for="(_, key) in sizes" :key="key" :value="key">{{ label(key) }}</option>
            </select>
          </label>
          <button class="btn" type="button" :disabled="state.items.length >= 24" @click="update(d => d.items.push(makeItem(String(Math.max(...d.items.map(item => Number(item.id) || 0)) + 1))))">{{ label('addItem') }}</button>
          <button class="btn" type="button" :disabled="state.items.length <= 1" @click="update(d => remove(d, selection(d).id))">{{ label('removeItem') }}</button>
          <ArrowRight v-if="state.system === 'flex'" :aria-label="settings(state).container.direction" :size="22"
            :style="{transform: 'rotate(' + (directions.indexOf(settings(state).container.direction) * 180 + (settings(state).container.direction.startsWith('column') ? 90 : 0)) + 'deg)'}" />
        </div>
        <div class="canvas-scroll">
          <div class="canvas" :style="[containerRules(state.system, settings(state).container), { width: sizes[viewport] ? sizes[viewport] + 'px' : '100%' }]">
            <div v-for="(item, index) in settings(state).items" :key="item.id" class="tile"
              :style="itemRules(state.system, item)" @dragover.prevent @drop.prevent="update(d => move(d, dragItem, item.id))">
              <button type="button" class="tile-select" :aria-pressed="selection(state).id === item.id" draggable="true"
                @dragstart="dragItem = item.id; $event.dataTransfer?.setData('text/plain', item.id)" @dragend="dragItem = ''"
                @keydown="moveKey($event, state, update, item.id)" @click="selected = item.id; inspector = 'item'">
                <Grip :size="15" /> {{ label('item') }} {{ item.id }} <small v-if="item.area">{{ item.area }}</small>
              </button>
              <button v-if="state.system === 'grid' && !item.area" type="button" class="span-handle" :aria-label="label('resizeSpan') + ' ' + (index + 1)"
                @pointerdown="startSpan($event, item)" @pointermove="dragSpan($event, update)" @lostpointercapture="spanDrag = undefined"
                @click="selected = item.id; inspector = 'item'"><MoveDiagonal :size="15" /></button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </ToolWorkspace>
</template>

<style scoped>
.tracks { display:grid;gap:.5rem;min-width:0;border:1px solid var(--line);padding:.65rem;margin:.75rem 0;border-radius:8px; }
.track,.area-row { display:flex;gap:.35rem;flex-wrap:wrap; }
.track input { width:5.25rem; }
.area-matrix,.canvas-scroll { min-width:0;overflow:auto; }
.area-row { flex-wrap:nowrap; margin-block:.25rem; }
.layout-preview { width:100%;min-width:0;display:grid;gap:.75rem; }
.canvas-tools { display:flex;align-items:end;flex-wrap:wrap;gap:.5rem; }
.canvas { min-height:15rem;border:1px dashed #708779;padding:.65rem;box-sizing:border-box;background:#dce9df; }
.tile { display:grid;position:relative;min-width:0;min-height:3rem;background:#fff;color:#243d32;border:1px solid #738d7d;border-radius:5px; }
.tile-select { display:flex;align-items:center;gap:.25rem;text-align:left;padding:.35rem;overflow-wrap:anywhere;cursor:grab; }
.tile-select[aria-pressed=true] { background:#c9e5d4;box-shadow:inset 0 0 0 2px #236049; }
.tile-select small { color:#36594b; }
.span-handle { position:absolute;right:0;bottom:0;cursor:nwse-resize;touch-action:none;padding:.15rem;background:#c9e5d4; }
</style>
