<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { active, elementStyle, in3d, limits, logic, neutral, parentStyle, type Operation, type State } from './logic'

const { t } = useI18n()
const label = (key: string) => t('detail.transform.' + key)
const drag = ref<Operation>()
const value = (e: Event) => (e.target as HTMLInputElement).value
const axes = [0, 50, 100]
function set(state: State, op: Operation, amount: number) {
  state.values[op] = amount
  if (state.lockAspect && op.startsWith('scale')) {
    for (const axis of ['scaleX', 'scaleY', 'scaleZ'] as const) state.values[axis] = amount
  }
}
function move(state: State, from: Operation, to: Operation) {
  const index = state.order.indexOf(from)
  const target = state.order.indexOf(to)
  state.order.splice(target, 0, state.order.splice(index, 1)[0])
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <div class="field-grid">
        <label>{{ label('mode') }}<select :value="state.mode" @change="update(d => { d.mode = value($event) === '3d' ? '3d' : '2d' })"><option value="2d">2D</option><option value="3d">3D</option></select></label>
        <label>{{ label('unit') }}<select :value="state.unit" @change="update(d => { d.unit = value($event) === '%' ? '%' : 'px' })"><option>px</option><option>%</option></select></label>
      </div>
      <label class="check"><input type="checkbox" :checked="state.lockAspect" @change="update(d => { d.lockAspect = !d.lockAspect })" />{{ label('lock') }}</label>
      <details open><summary>{{ label('operations') }}</summary>
        <div v-for="op in state.order.filter(op => state.mode === '3d' || !in3d(op))" :key="op" class="operation">
          <RangeField class="operation-range" :label="op" :min="limits(op)[0]" :max="limits(op)[1]" :step="limits(op)[2]" :model-value="state.values[op] ?? neutral(op)"
            @update:model-value="update(d => set(d, op, $event), op)" />
          <button class="btn" type="button" :aria-label="label('neutral') + ' ' + op" @click="update(d => set(d, op, neutral(op)))">↺</button>
        </div>
      </details>
      <details open><summary>{{ label('order') }}</summary>
        <p>{{ label('notice') }}</p>
        <ol class="order">
          <li v-for="(op, i) in active(state)" :key="op" draggable="true" @dragstart="drag = op; $event.dataTransfer?.setData('text/plain', op)" @dragend="drag = undefined"
            @dragover.prevent @drop.prevent="drag && update(d => move(d, drag!, op))">
            <code>{{ op }}</code>
            <button type="button" class="btn" :disabled="i === 0" :aria-label="label('up') + ' ' + op" @click="update(d => move(d, op, active(d)[i - 1]))">↑</button>
            <button type="button" class="btn" :disabled="i === active(state).length - 1" :aria-label="label('down') + ' ' + op" @click="update(d => move(d, op, active(d)[i + 1]))">↓</button>
          </li>
        </ol>
      </details>
      <details><summary>{{ label('origin') }}</summary>
        <div class="origins" role="group" :aria-label="label('origin')">
          <template v-for="y in axes" :key="y"><button v-for="x in axes" :key="x" class="btn" type="button" :aria-label="x + ' %, ' + y + ' %'" :aria-pressed="state.originX === x && state.originY === y"
            @click="update(d => { d.originX = x; d.originY = y })">•</button></template>
        </div>
        <RangeField v-for="key in ['originX', 'originY'] as const" :key="key" :label="label(key)" :min="0" :max="100" :model-value="state[key]"
          @update:model-value="update(d => { d[key] = $event }, key)" />
      </details>
      <details v-if="state.mode === '3d'"><summary>{{ label('scene') }}</summary>
        <RangeField :label="label('distance')" :min="0" :max="2000" :model-value="state.perspective" @update:model-value="update(d => { d.perspective = $event }, 'perspective')" />
        <RangeField v-for="key in ['perspectiveX', 'perspectiveY'] as const" :key="key" :label="label(key)" :min="0" :max="100" :model-value="state[key]" @update:model-value="update(d => { d[key] = $event }, key)" />
        <RangeField :label="label('originZ')" :min="-200" :max="200" :model-value="state.originZ" @update:model-value="update(d => { d.originZ = $event }, 'originZ')" />
        <label class="check"><input type="checkbox" :checked="state.grid" @change="update(d => { d.grid = !d.grid })" />{{ label('grid') }}</label>
        <label class="check"><input type="checkbox" :checked="state.transformStyle === 'preserve-3d'" @change="update(d => { d.transformStyle = d.transformStyle === 'flat' ? 'preserve-3d' : 'flat' })" />preserve-3d</label>
        <label class="check"><input type="checkbox" :checked="state.backface === 'hidden'" @change="update(d => { d.backface = d.backface === 'hidden' ? 'visible' : 'hidden' })" />{{ label('backface') }}</label>
      </details>
    </template>
    <template #preview="{ state }">
      <div class="scene" :class="{grid:state.mode === '3d' && state.grid}" :style="parentStyle(state)">
        <div class="ghost"><span class="pivot" :style="{left: state.originX+'%',top: state.originY+'%'}" /></div>
        <div class="element" :style="elementStyle(state)">FrontKit</div>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.operation,.order li { display:flex; align-items:center;gap:.45rem; }
.operation-range { flex:1;min-width:0; }
.order li code { flex:1; }
details { padding:.5rem 0;border-bottom:1px solid var(--line); }
summary { cursor:pointer;font-weight:650; }
.origins { display:grid;grid-template-columns:repeat(3, 2.5rem);gap:.25rem; }
.origins button[aria-pressed=true] { background:var(--accent);color:var(--accent-ink); }
.scene { display:grid;place-items:center;width:100%;height:22rem;overflow:hidden;background-color:#e0ebe5;border-radius:10px; }
.scene.grid { background-image:linear-gradient(#94ab9f66 1px,transparent 1px),linear-gradient(90deg,#94ab9f66 1px,transparent 1px);background-size:24px 24px; }
.ghost,.element { grid-area:1/1;width:120px;height:90px;border-radius:12px; }
.ghost { border:2px dashed #35564a;position:relative; }
.pivot { position:absolute;width:10px;height:10px;border-radius:50%;background:#af294b;translate:-50% -50%;z-index:1; }
.element { display:grid;place-items:center;background:#1c624edb;color:white;font-weight:700; }
</style>
