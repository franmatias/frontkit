<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { remove } from '../../core/storage/db'
import { receivePalette } from '../../core/storage/palette-handoff'
import { receiveTypography } from '../../core/storage/typography-handoff'
import { fonts } from '../readability/logic'
import { receiveStyle } from '../../core/storage/style-handoff'
import { wcagContrast } from '../../lib/color'
import { apca } from '../../lib/color/vision'
import { useSettingsStore } from '../../stores/settings'
import { darkFor, declarations, logic, radiusKeys, roles, shadowKeys, type TokenState } from './logic'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const settings = useSettingsStore()
const label = (key: string) => t('detail.tokens.' + key)
const mode = ref<'light' | 'dark'>('light')
const selected = ref('primary')
const newName = ref('')
const palette = ref<Awaited<ReturnType<typeof receivePalette>>>()
const style = ref<Awaited<ReturnType<typeof receiveStyle>>>()
const typography = ref<Awaited<ReturnType<typeof receiveTypography>>>()
const contrastMethod = computed(() => settings.data.preferences.colorContrastMethod)
const pairs = [['text', 'background'], ['text', 'surface'], ['primary', 'background']] as const
const typographyFields = { baseSizePx: [8, 40, 1], scaleRatio: [1, 2, .01], lineHeightBody: [1, 3, .01], lineHeightHeading: [1, 3, .01] } as const
const fluidFields = { minViewportPx: [200, 1000, 1], maxViewportPx: [600, 3000, 1], minScaleRatio: [1, 2, .01], maxScaleRatio: [1, 2, .01] } as const
const value = (event: Event) => (event.target as HTMLInputElement).value
const chosen = (state: TokenState) => state.colors.find(item => item.name === selected.value) ?? state.colors[0]
watch(() => route.query.handoff, async (id, _, cleanup) => {
  let current = true
  cleanup(() => { current = false })
  const results = await Promise.all([receivePalette('tokens', id), receiveStyle(id), receiveTypography(id)]).catch(() => undefined)
  if (current) {
    palette.value = results?.[0]
    style.value = results?.[1]
    typography.value = results?.[2]
  }
}, { immediate: true })
function clear() {
  const id = route.query.handoff
  if (typeof id === 'string') void remove('handoff', 'inbox:' + id).catch(() => {})
  palette.value = undefined
  style.value = undefined
  typography.value = undefined
  const query = { ...route.query }
  delete query.handoff
  void router.replace({ query, hash: route.hash })
}
function importTokens(state: TokenState) {
  for (const { name, color } of palette.value ?? []) {
    const existing = state.colors.find(c => c.name === name)
    if (existing) Object.assign(existing, { light: color, dark: darkFor(color) })
    else if (state.colors.length < 48) state.colors.push({ name, light: color, dark: darkFor(color) })
  }
  if (style.value) state[style.value.kind].md = style.value.payload
  if (typography.value) {
    const next = typography.value
    const standard = next.scale.find(step => step.name === 'base' || step.name === 'step-0')
    Object.assign(state.typography, { baseSizePx: next.base, scaleRatio: next.ratio, fontSans: fonts[next.font],
      scale: next.scale, ...(standard ? { lineHeightBody: standard.lineHeight } : {}) })
  }
  clear()
}
function add(state: TokenState) {
  const name = newName.value.trim().toLowerCase()
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name) || state.colors.some(item => item.name === name) || state.colors.length >= 48) return
  const light = chosen(state).light
  state.colors.push({ name, light, dark: darkFor(light) })
  selected.value = name
  newName.value = ''
}
function updateCss(event: Event, property: string, change: (input: string) => void) {
  const input = event.target as HTMLInputElement
  const next = input.value.trim()
  const valid = next.length <= 2400 && /^[\w\s.,#%/'"()+-]+$/.test(next) && CSS.supports(property, next)
  input.setCustomValidity(valid ? '' : label('invalid'))
  if (input.reportValidity()) change(next)
}
function stepValues(event: Event) {
  const input = event.target as HTMLInputElement
  const steps = input.value.split(',').map(item => item.trim()).filter(Boolean).map(Number)
  const valid = steps.length >= 1 && steps.length <= 20 && steps.every(item => Number.isFinite(item) && item >= 0 && item <= 64)
  input.setCustomValidity(valid ? '' : label('invalid'))
  return input.reportValidity() ? [...new Set(steps)] : undefined
}
function contrast(state: TokenState, pair: typeof pairs[number]) {
  const color = (name: string) => state.colors.find(c => c.name === name)![mode.value]
  const first = color(pair[0])
  const second = color(pair[1])
  return contrastMethod.value === 'apca' ? apca(first, second).toFixed(1) + ' Lc' : wcagContrast(first, second).toFixed(2) + ':1'
}
const previewStyle = (state: TokenState) => ({
  ...declarations(state, 'light', false), ...declarations(state, mode.value, false),
  colorScheme: mode.value,
})
</script>

<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <div v-if="palette || style || typography" class="notice">
        <div v-if="palette" class="actions"><span v-for="item in palette" :key="item.name" class="badge" :style="{ borderLeft: '8px solid ' + item.color }">{{ item.name }}</span></div>
        <code v-if="style">{{ style.payload }}</code>
        <div v-if="typography" class="actions"><span class="badge" v-for="step in typography.scale" :key="step.name">{{ step.name }} · {{ step.value }}</span></div>
        <div class="actions">
          <button type="button" class="btn" @click="update(importTokens)">{{ label(typography ? 'importTypography' : style ? style.from : 'palette') }}</button>
          <button type="button" class="btn" @click="clear">{{ t('tool.discard') }}</button>
        </div>
      </div>
      <label>{{ label('prefix') }}
        <input :value="state.prefix" maxlength="32" pattern="[a-z][a-z0-9\-]{0,31}"
          @change="($event.target as HTMLInputElement).reportValidity() && update(d => { d.prefix = value($event) })" />
      </label>
      <details open>
        <summary>{{ label('colors') }}</summary>
        <label>{{ label('token') }}
          <select :value="chosen(state).name" @change="selected = value($event)"><option v-for="color in state.colors" :key="color.name">{{ color.name }}</option></select>
        </label>
        <div class="field-grid">
          <label v-for="variant in ['light', 'dark'] as const" :key="variant">{{ label(variant) }}
            <input type="color" :value="chosen(state)[variant]" @input="update(d => { chosen(d)[variant] = value($event) }, variant + selected)" />
          </label>
        </div>
        <div class="actions">
          <button type="button" class="btn" @click="update(d => { chosen(d).dark = darkFor(chosen(d).light) })">{{ label('derive') }}</button>
          <button v-if="!roles.includes(chosen(state).name)" type="button" class="btn"
            @click="update(d => { d.colors = d.colors.filter(c => c.name !== chosen(d).name); selected = '' })">{{ t('app.remove') }}</button>
        </div>
        <form class="actions" @submit.prevent="update(add)">
          <label>{{ label('new') }}<input v-model="newName" maxlength="32" pattern="[a-z][a-z0-9\-]{0,31}" required /></label>
          <button type="submit" class="btn" :disabled="state.colors.some(item => item.name === newName.trim().toLowerCase()) || state.colors.length >= 48">{{ label('add') }}</button>
        </form>
        <label class="check"><input type="checkbox" :checked="state.systemDark" @change="update(d => { d.systemDark = !d.systemDark })" />{{ label('systemDark') }}</label>
      </details>
      <details>
        <summary>{{ label('typography') }}</summary>
        <button v-if="state.typography.scale" class="btn" type="button" @click="update(d => { delete d.typography.scale })">{{ label('clearScale') }}</button>
        <label v-for="field in ['fontSans', 'fontMono'] as const" :key="field">{{ label(field) }}
          <input :value="state.typography[field]" @input="($event.target as HTMLInputElement).setCustomValidity('')"
            @change="updateCss($event, 'font-family', next => update(d => { d.typography[field] = next }))" />
        </label>
        <RangeField v-for="(limits, field) in typographyFields" :key="field" :label="label(field)" :min="limits[0]" :max="limits[1]" :step="limits[2]"
          :model-value="state.typography[field]" @update:model-value="update(d => { d.typography[field] = $event }, field)" />
        <label class="check"><input type="checkbox" :checked="state.typography.fluid.enabled"
          @change="update(d => { d.typography.fluid.enabled = !d.typography.fluid.enabled })" />{{ label('fluid') }}</label>
        <template v-if="state.typography.fluid.enabled">
          <RangeField v-for="(limits, field) in fluidFields" :key="field" :label="label(field)" :min="limits[0]" :max="limits[1]" :step="limits[2]"
            :model-value="state.typography.fluid[field]" @update:model-value="update(d => {
              const fluid = d.typography.fluid
              fluid[field] = $event
              if (fluid.maxViewportPx <= fluid.minViewportPx) {
                if (field === 'minViewportPx') fluid.maxViewportPx = fluid.minViewportPx + 1
                else fluid.minViewportPx = fluid.maxViewportPx - 1
              }
            }, field)" />
        </template>
      </details>
      <details>
        <summary>{{ label('spacing') }}</summary>
        <RangeField :label="label('basePx')" :min="1" :max="32" :model-value="state.spacing.basePx"
          @update:model-value="update(d => { d.spacing.basePx = $event }, 'spacing')" />
        <label>{{ label('steps') }}
          <input :value="state.spacing.steps.join(', ')" @input="($event.target as HTMLInputElement).setCustomValidity('')"
            @change="update(d => { const steps = stepValues($event); if (steps) d.spacing.steps = steps })" />
        </label>
      </details>
      <details>
        <summary>{{ label('elevation') }}</summary>
        <label v-for="key in radiusKeys" :key="key">{{ label('radius') }} {{ key }}
          <input :value="state.radii[key]" @input="($event.target as HTMLInputElement).setCustomValidity('')"
            @change="updateCss($event, 'border-radius', next => update(d => { d.radii[key] = next }))" />
        </label>
        <label v-for="key in shadowKeys" :key="key">{{ label('elevation') }} {{ key }}
          <input :value="state.shadows[key]" @input="($event.target as HTMLInputElement).setCustomValidity('')"
            @change="updateCss($event, 'box-shadow', next => update(d => { d.shadows[key] = next }))" />
        </label>
      </details>
    </template>

    <template #preview="{ state }">
      <div class="kit-wrap">
        <div class="actions" role="group" :aria-label="label('theme')">
          <button v-for="variant in ['light', 'dark'] as const" :key="variant" type="button" class="btn"
            :aria-pressed="mode === variant" @click="mode = variant">{{ label(variant) }}</button>
        </div>
        <section class="kit" :style="previewStyle(state)" :aria-label="label('kit')">
          <div class="kit-card">
            <h3>{{ label('kit') }}</h3><p>{{ label('sampleText') }}</p>
            <div class="actions">
              <button type="button" class="sample primary-sample">{{ label('primary') }}</button>
              <button type="button" class="sample secondary-sample">{{ label('secondary') }}</button>
              <button type="button" class="sample">{{ label('outline') }}</button>
              <button type="button" class="sample" disabled>{{ label('disabled') }}</button>
            </div>
            <label>{{ label('sampleInput') }}<input :placeholder="label('placeholder')" /></label>
            <span class="kit-badge">{{ label('badge') }}</span>
            <p class="kit-alert">{{ label('alert') }}</p>
          </div>
        </section>
        <dl class="checks"><div v-for="pair in pairs" :key="pair.join()"><dt>{{ pair.join(' / ') }}</dt><dd>{{ contrast(state, pair) }}</dd></div></dl>
      </div>
    </template>
  </ToolWorkspace>
</template>

<style scoped>
details { padding:.55rem 0;border-bottom:1px solid var(--line); }
summary { cursor:pointer;font-weight:650; }
details label { margin:.35rem 0; }
.kit-wrap { width:100%;min-width:0;display:grid;gap:.7rem; }
.kit { background:var(--color-background);color:var(--color-text);padding:calc(var(--spacing) * 4);border-radius:var(--radius-lg);font:var(--text-base)/var(--leading-body) var(--font-sans); }
.kit h3 { font-size:var(--text-xl);line-height:var(--leading-heading); }
.kit-card { background:var(--color-surface);box-shadow:var(--shadow-md);border:1px solid var(--color-border);padding:calc(var(--spacing) * 4);border-radius:var(--radius-md); }
.sample { border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:.35rem .55rem; }
.sample:disabled { opacity:.5; }
.primary-sample { background:var(--color-primary);color:var(--color-background); }
.secondary-sample { background:var(--color-secondary);color:var(--color-background); }
.kit input { background:var(--color-background);color:var(--color-text);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin:.35rem 0; }
.kit-badge { display:inline-block;border-radius:var(--radius-full);padding:.15rem .5rem;color:var(--color-background);background:var(--color-success); }
.kit-alert { border-inline-start:4px solid var(--color-info);padding:.3rem .65rem; }
.checks { display:flex;flex-wrap:wrap;gap:.8rem;font-size:.85rem; }
.checks dd { font-weight:700; }
</style>
