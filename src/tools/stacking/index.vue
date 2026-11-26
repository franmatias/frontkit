<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { buildStackingTree, canFix, containers, contains, diagnoseSticky, diagnoseZIndex, displays, documentFor, fix, logic,
  overflows, paintOrder, positions, scenarios, willChanges, type Box, type Scenario, type Style } from './logic'

const { t } = useI18n()
const key = (id: string) => t('detail.stacking.' + id)
const tree = ref<HTMLElement>()
const highlight = ref('')
const choices = computed(() => [
  { id: 'position', values: positions }, { id: 'overflow', values: overflows }, { id: 'display', values: displays },
  { id: 'align', values: ['stretch', 'start', 'center'] }, { id: 'contain', values: contains },
  { id: 'willChange', values: willChanges }, { id: 'containerType', values: containers },
] as const)
const numbers = [{ id: 'top', min: -250, max: 250, empty: true }, { id: 'bottom', min: -250, max: 250, empty: true },
  { id: 'left', min: -250, max: 250, empty: true }, { id: 'zIndex', min: -9999, max: 9999, empty: true },
  { id: 'height', min: 0, max: 1000, empty: false }, { id: 'width', min: 0, max: 500, empty: false }] as const
const toggles = ['transform', 'isolation', 'filter', 'perspective', 'clipPath', 'mask', 'blend'] as const
const current = (state: Scenario) => state.nodes.find(item => item.id === state.selected) ?? state.nodes[0]
const name = (state: Scenario, id: string) => state.nodes.find(item => item.id === id)?.label || id
const findings = (state: Scenario) => {
  const box = state.nodes.find(item => item.id === state.target)
  return !box || box.styles.position === 'sticky' || box.styles.position === 'fixed'
    ? diagnoseSticky(state.nodes, state.target) : diagnoseZIndex(state.nodes, state.target, state.against)
}
function depth(nodes: Box[], item: Box) {
  let level = 1, parent = item.parentId
  while (parent) { level++; parent = nodes.find(box => box.id === parent)?.parentId ?? null }
  return level
}
function pick(state: Scenario, id: string) {
  const newState = scenarios.find(row => row[0] === id)?.[1]()
  if (newState) Object.assign(state, newState)
}
type Update = (fn: (value: Scenario) => void, group?: string) => void
function keyDown(event: KeyboardEvent, state: Scenario, id: string, update: Update) {
  const index = state.nodes.findIndex(node => node.id === id)
  let next: string | undefined
  if (event.key === 'ArrowDown') next = state.nodes[index + 1]?.id
  if (event.key === 'ArrowUp') next = state.nodes[index - 1]?.id
  if (event.key === 'ArrowRight') next = state.nodes.find(box => box.parentId === id)?.id
  if (event.key === 'ArrowLeft') next = state.nodes[index]?.parentId ?? undefined
  if (event.key === 'Home') next = state.nodes[0].id
  if (event.key === 'End') next = state.nodes.at(-1)?.id
  if (!next) return
  event.preventDefault()
  update(draft => { if (next) draft.selected = next })
  void nextTick(() => tree.value?.querySelector<HTMLElement>('[data-tree="' + next + '"]')?.focus())
}
function setValue(draft: Scenario, property: keyof Style, value: string | number | boolean | null) {
  Object.assign(current(draft).styles, { [property]: value })
}
function inputNumber(event: Event, draft: Scenario, property: keyof Style, empty: boolean) {
  const input = event.target as HTMLInputElement
  if (!input.value) setValue(draft, property, empty ? null : 0)
  else if (input.checkValidity()) setValue(draft, property, input.valueAsNumber)
}
</script>

<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <label>{{ key('scenario') }}<select value="" @change="update(d => pick(d, ($event.target as HTMLSelectElement).value)); ($event.target as HTMLSelectElement).value = ''">
        <option value="" disabled>{{ key('choose') }}</option>
        <option v-for="[id] in scenarios" :key="id" :value="id">{{ key('scenarios.' + id) }}</option>
      </select></label>
      <div ref="tree" role="tree" :aria-label="key('elements')" class="node-list">
        <button v-for="node in state.nodes" :key="node.id" type="button" role="treeitem" class="btn tree-node"
          :data-tree="node.id" :tabindex="state.selected === node.id ? 0 : -1"
          :aria-selected="state.selected === node.id" :aria-level="depth(state.nodes, node)"
          :class="{ culprit: highlight === node.id }" :style="{ marginInlineStart: (depth(state.nodes, node) - 1) + 'rem' }"
          @keydown="keyDown($event, state, node.id, update)" @click="update(d => { d.selected = node.id })">{{ node.label }}</button>
      </div>
      <label>{{ key('label') }}<input type="text" maxlength="70" :value="current(state).label"
        @input="update(d => { current(d).label = ($event.target as HTMLInputElement).value }, 'label')" /></label>
      <div class="field-grid">
        <label v-for="item in choices" :key="item.id">{{ key(item.id) }}
          <select :value="current(state).styles[item.id]" @change="update(d => setValue(d, item.id, ($event.target as HTMLSelectElement).value))">
            <option v-for="value in item.values" :key="value">{{ value }}</option>
          </select>
        </label>
        <label v-for="item in numbers" :key="item.id">{{ key(item.id) }}
          <input type="number" :min="item.min" :max="item.max" :value="current(state).styles[item.id] ?? ''"
            @change="update(d => inputNumber($event, d, item.id, item.empty), item.id)" />
        </label>
        <label>{{ key('opacity') }}<input type="number" min=".1" max="1" step=".05" :value="current(state).styles.opacity"
          @change="update(d => { const input = $event.target as HTMLInputElement; if (input.value && input.checkValidity()) current(d).styles.opacity = input.valueAsNumber }, 'opacity')" /></label>
      </div>
      <label v-for="item in toggles" :key="item" class="check"><input type="checkbox" :checked="current(state).styles[item]"
        @change="update(d => setValue(d, item, ($event.target as HTMLInputElement).checked))" />{{ key(item) }}</label>
      <div class="field-grid">
        <label>{{ key('target') }}<select :value="state.target" @change="update(d => { d.target = ($event.target as HTMLSelectElement).value })">
          <option v-for="node in state.nodes" :key="node.id" :value="node.id">{{ node.label }}</option>
        </select></label>
        <label>{{ key('comparison') }}<select :value="state.against" @change="update(d => { d.against = ($event.target as HTMLSelectElement).value })">
          <option v-for="node in state.nodes" :key="node.id" :value="node.id">{{ node.label }}</option>
        </select></label>
      </div>
    </template>
    <template #preview="{ state, update }">
      <div class="simulation">
        <iframe sandbox="" :title="key('frame')" :srcdoc="documentFor(state)" />
        <h3>{{ key('diagnosis') }}</h3>
        <p v-if="!findings(state).length">{{ key('uncertain') }}</p>
        <ul v-else class="node-list">
          <li v-for="item in findings(state)" :key="item.reason" @mouseenter="highlight = item.culprit" @mouseleave="highlight = ''">
            <span>{{ t('detail.stacking.reasons.' + item.reason, { culprit: name(state, item.culprit) }) }}</span>
            <button v-if="canFix(item.reason)" type="button" class="btn" @focus="highlight = item.culprit" @blur="highlight = ''"
              @click="update(d => fix(d, item))">{{ key('fix') }}</button>
          </li>
        </ul>
        <h3>{{ key('paint') }}</h3>
        <ol class="node-list">
          <li v-for="context in paintOrder(buildStackingTree(state.nodes))" :key="context.id" :style="{ marginInlineStart: context.depth + 'rem' }">
            {{ context.label }} · {{ context.zIndex }}
          </li>
        </ol>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.field-grid label { min-width: 0; display: grid; gap: .3rem; }
.simulation { display: grid; width: 100%; min-width: 0; gap: .65rem; padding: .7rem; }
iframe { width: 100%; height: 226px; border: 1px solid var(--line); border-radius: .5rem; background: white; }
.node-list { display: grid; gap: .35rem; margin: 0; }
.node-list li { overflow-wrap: anywhere; }
.node-list li button { margin-inline-start: .35rem; }
.tree-node { justify-self: start; overflow-wrap: anywhere; }
.tree-node[aria-selected="true"],.tree-node.culprit { outline: 2px solid var(--focus); }
</style>
