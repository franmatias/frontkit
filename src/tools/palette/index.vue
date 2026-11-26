<script setup lang="ts">
import { ArrowLeft, ArrowRight, Copy, Lock, Unlock } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PaletteScene from './PaletteScene.vue'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { useClipboard } from '../../composables/useClipboard'
import { receivePalette, sendPalette } from '../../core/storage/palette-handoff'
import { wcagContrast } from '../../lib/color'
import { apca, simulateVision, visionModes } from '../../lib/color/vision'
import { useNotificationsStore } from '../../stores/notifications'
import { channels, colorOf, harmonies, logic, outputColor, regenerate, shuffleColors, steps, tokenName, type PaletteState, type Swatch } from './logic'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const incoming = ref<Awaited<ReturnType<typeof receivePalette>>>()
watch(() => route.query.handoff, async (id, _, cleanup) => {
  let active = true
  cleanup(() => { active = false })
  incoming.value = undefined
  const result = await receivePalette('palette', id).catch(() => undefined)
  if (active) incoming.value = result
}, { immediate: true })
function importColors(state: PaletteState) {
  if (!incoming.value) return
  state.swatches = incoming.value.map((item, index) => ({
    ...state.swatches[Math.min(index, state.swatches.length - 1)], ...item, id: crypto.randomUUID(),
  }))
  const query = { ...route.query }
  delete query.handoff
  void router.replace({ query })
}
const copy = useClipboard()
const notifications = useNotificationsStore()
const label = (key: string) => t('detail.palette.' + key)
const value = (event: Event) => (event.target as HTMLInputElement).value
const selected = ref('')
const dragging = ref('')
const sending = ref(false)
const swatchOf = (state: PaletteState) => state.swatches.find(color => color.id === selected.value) ?? state.swatches[0]
function updateGeneration(state: PaletteState, patch: Partial<PaletteState>) {
  Object.assign(state, patch)
  regenerate(state)
}
function changeHex(event: Event, apply: (color: string) => void) {
  const input = event.target as HTMLInputElement
  const color = input.value.trim()
  input.setCustomValidity(/^#[\da-f]{6}$/i.test(color) ? '' : label('invalidColor'))
  if (input.reportValidity()) apply(color.toLowerCase())
}
function rename(state: PaletteState, event: Event) {
  const input = event.target as HTMLInputElement
  const color = swatchOf(state)
  const name = input.value.trim().toLowerCase()
  const valid = tokenName.test(name) && !state.swatches.some(item => item.id !== color.id && item.name === name)
  input.setCustomValidity(valid ? '' : label('invalidName'))
  if (input.reportValidity()) {
    input.value = name
    color.name = name
  }
}
function move(state: PaletteState, from: string, target: number) {
  const index = state.swatches.findIndex(color => color.id === from)
  if (index < 0 || target < 0 || target >= state.swatches.length || target === index) return
  const [color] = state.swatches.splice(index, 1)
  state.swatches.splice(target, 0, color)
}
function adjust(color: Swatch, axis: 'l' | 'c' | 'h', amount: number) {
  const next = { ...channels(color.color), [axis]: amount }
  color.color = colorOf(next.l / 100, next.c, next.h)
}
function keydown(event: KeyboardEvent, update: (apply: (state: PaletteState) => void) => void) {
  if (event.code !== 'Space' || event.repeat || event.target !== event.currentTarget) return
  event.preventDefault()
  update(shuffleColors)
}
function contrast(state: PaletteState, foreground: Swatch, background: Swatch) {
  return state.contrastMethod === 'apca' ? apca(foreground.color, background.color) : wcagContrast(foreground.color, background.color)
}
function criteria(state: PaletteState, ratio: number) {
  if (state.contrastMethod === 'apca') {
    const lc = Math.abs(ratio)
    if (lc >= 90) return label('apca90')
    if (lc >= 75) return label('apca75')
    if (lc >= 60) return label('apca60')
    return label('apcaLow')
  }
  if (ratio >= 7) return label('aaa')
  if (ratio >= 4.5) return label('aa')
  if (ratio >= 3) return label('aaLarge')
  return label('low')
}
const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 1 })
async function send(state: PaletteState, to: 'gradient' | 'tokens' | 'backgrounds') {
  if (sending.value) return
  sending.value = true
  try {
    const handoff = await sendPalette(to, state.swatches.map(({ name, color }) => ({ name, color })))
    await router.push({ name: to, query: { handoff } })
  } catch { notifications.push('tool.storageError') }
  finally { sending.value = false }
}
</script>

<template>
  <ToolWorkspace :logic="logic" :preview-background="false">
    <template #controls="{ state, update }">
      <button v-if="incoming" type="button" class="btn" @click="update(importColors)">Importar colores del conversor</button>
      <div class="field-grid">
        <label>{{ label('mode') }}
          <select :value="state.mode" @change="update(d => updateGeneration(d, { mode: value($event) === 'scale' ? 'scale' : 'harmony' }))">
            <option value="harmony" :disabled="state.swatches.every(c => c.locked) && state.swatches.length === 11">{{ label('harmony') }}</option>
            <option value="scale">{{ label('scale') }}</option>
          </select>
        </label>
        <label>{{ label('format') }}
          <select :value="state.format" @change="update(d => { d.format = value($event) === 'oklch' ? 'oklch' : 'hex' })">
            <option value="hex">HEX</option><option value="oklch">OKLCH</option>
          </select>
        </label>
        <label>{{ label('picker') }}
          <input type="color" :value="state.baseColor" @input="update(d => updateGeneration(d, { baseColor: value($event) }), 'base-color')" />
        </label>
        <label>{{ label('base') }}
          <input :value="state.baseColor" maxlength="7" @input="($event.target as HTMLInputElement).setCustomValidity('')"
            @change="changeHex($event, color => update(d => updateGeneration(d, { baseColor: color })))" />
        </label>
        <label v-if="state.mode === 'harmony'">{{ label('harmonyType') }}
          <select :value="state.harmonyType" @change="update(d => updateGeneration(d, { harmonyType: value($event) as PaletteState['harmonyType'] }))">
            <option v-for="harmony in harmonies" :key="harmony" :value="harmony">{{ label(harmony) }}</option>
          </select>
        </label>
        <label>{{ label('vision') }}
          <select :value="state.colorBlindnessPreview" @change="update(d => { d.colorBlindnessPreview = value($event) as PaletteState['colorBlindnessPreview'] })">
            <option v-for="mode in visionModes" :key="mode" :value="mode">{{ label(mode) }}</option>
          </select>
        </label>
      </div>
      <RangeField v-if="state.mode === 'harmony'" :label="label('count')" :min="Math.max(3, Math.min(10, state.swatches.filter(c => c.locked).length))" :max="10" :model-value="state.count"
        @update:model-value="update(d => updateGeneration(d, { count: Math.round($event) }), 'count')" />
      <RangeField :label="label('spread')" :min="0" :max="100" :model-value="state.spread"
        @update:model-value="update(d => updateGeneration(d, { spread: $event }), 'spread')" />
      <div class="actions palette-actions">
        <button type="button" class="btn" @click="update(shuffleColors)">{{ label('random') }}</button>
        <button type="button" class="btn" :disabled="sending" @click="send(state, 'gradient')">{{ label('gradient') }}</button>
        <button type="button" class="btn" :disabled="sending" @click="send(state, 'tokens')">{{ label('tokens') }}</button>
        <button type="button" class="btn" @click="send(state, 'backgrounds')">Enviar a Fondos</button>
      </div>
      <fieldset class="inspector">
        <legend>{{ label('edit') }}</legend>
        <div class="field-grid">
          <label>{{ label('swatch') }}
            <select :value="swatchOf(state).id" @change="selected = value($event)">
              <option v-for="color in state.swatches" :key="color.id" :value="color.id">{{ color.name }}</option>
            </select>
          </label>
          <label>{{ label('name') }}
            <input :key="swatchOf(state).id" :value="swatchOf(state).name" maxlength="32"
              @input="($event.target as HTMLInputElement).setCustomValidity('')" @change="update(d => rename(d, $event))" />
          </label>
        </div>
        <RangeField :label="label('lightness')" :min="0" :max="100" :step=".1" :model-value="Math.round(channels(swatchOf(state).color).l * 10) / 10"
          @update:model-value="update(d => adjust(swatchOf(d), 'l', $event), 'lightness')" />
        <RangeField :label="label('chroma')" :min="0" :max=".4" :step=".001" :model-value="Math.round(channels(swatchOf(state).color).c * 1000) / 1000"
          @update:model-value="update(d => adjust(swatchOf(d), 'c', $event), 'chroma')" />
        <RangeField :label="label('hue')" :min="0" :max="360" :step="1" :model-value="Math.round(channels(swatchOf(state).color).h)"
          @update:model-value="update(d => adjust(swatchOf(d), 'h', $event), 'hue')" />
        <div class="actions">
          <button class="btn" type="button" :aria-label="label('moveBack')" :disabled="swatchOf(state).id === state.swatches[0].id"
            @click="update(d => move(d, swatchOf(d).id, d.swatches.indexOf(swatchOf(d)) - 1))"><ArrowLeft :size="16" /></button>
          <button class="btn" type="button" :aria-label="label('moveForward')" :disabled="swatchOf(state).id === state.swatches.at(-1)?.id"
            @click="update(d => move(d, swatchOf(d).id, d.swatches.indexOf(swatchOf(d)) + 1))"><ArrowRight :size="16" /></button>
        </div>
      </fieldset>
    </template>

    <template #preview="{ state, update }">
      <div class="palette-preview">
        <PaletteScene :swatches="state.swatches" :primary="swatchOf(state)" :vision="state.colorBlindnessPreview" />
        <h3 class="swatch-heading">{{ label('swatchTitle') }}</h3>
        <div class="swatches" role="group" tabindex="0" :aria-label="label('swatches')" @keydown="keydown($event, update)">
          <article v-for="(color, index) in state.swatches" :key="color.id" class="swatch" @dragover.prevent @drop.prevent="update(d => move(d, dragging, index))">
            <button type="button" class="sample" :style="{ background: simulateVision(color.color, state.colorBlindnessPreview) }"
              :aria-label="color.name + ' ' + color.color" :aria-pressed="swatchOf(state).id === color.id" draggable="true"
              @dragstart="dragging = color.id; $event.dataTransfer?.setData('text/plain', color.id)" @dragend="dragging = ''" @click="selected = color.id" />
            <div class="swatch-info">
              <strong>{{ color.name }}</strong>
              <small v-if="state.mode === 'scale'">{{ steps[index] }}</small>
              <code>{{ color.color }}</code>
              <div class="actions">
                <button type="button" class="icon-btn" :aria-label="label('lock') + ' ' + color.name" :aria-pressed="color.locked"
                  @click="update(d => { d.swatches[index].locked = !d.swatches[index].locked })"><Lock v-if="color.locked" :size="15" /><Unlock v-else :size="15" /></button>
                <button type="button" class="icon-btn" :aria-label="label('copy') + ' ' + color.name" @click="copy(outputColor(state, color.color))"><Copy :size="15" /></button>
              </div>
            </div>
          </article>
        </div>
        <details class="contrast">
          <summary>{{ label('contrast') }}</summary>
          <label>{{ label('method') }}
            <select :value="state.contrastMethod" @change="update(d => { d.contrastMethod = value($event) === 'apca' ? 'apca' : 'wcag' })">
              <option value="wcag">WCAG 2.1</option><option value="apca">APCA Lc</option>
            </select>
          </label>
          <div class="contrast-table" tabindex="0" role="region" :aria-label="label('contrast')">
            <table>
              <thead><tr><th scope="col">{{ label('axes') }}</th><th v-for="color in state.swatches" :key="color.id" scope="col">{{ color.name }}</th></tr></thead>
              <tbody>
                <tr v-for="text in state.swatches" :key="text.id">
                  <th scope="row">{{ text.name }}</th>
                  <td v-for="background in state.swatches" :key="background.id">
                    <strong>{{ number.format(contrast(state, text, background)) }}{{ state.contrastMethod === 'wcag' ? ':1' : '' }}</strong>
                    <small>{{ criteria(state, contrast(state, text, background)) }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </template>
  </ToolWorkspace>
</template>

<style scoped>
.palette-preview { display:grid;gap:.85rem;width:100%;min-width:0; }
.swatch-heading { margin-top:.25rem; }
.swatches { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%, 6rem),1fr));gap:.4rem; }
.swatch { min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:.65rem;background:var(--surface); }
.sample { display:block;width:100%;height:2.85rem;cursor:grab; }
.sample[aria-pressed=true] { box-shadow:inset 0 0 0 2px white,inset 0 0 0 4px #192c26; }
.sample:focus-visible { outline-offset:-4px; }
.swatch-info { padding:.4rem;display:grid;gap:.15rem;overflow-wrap:anywhere;font-size:.74rem; }
.swatch-info code { font-size:.73rem;color:var(--muted); }
.swatch-info .actions { gap:.1rem; }
.swatch-info .icon-btn { min-width:32px;min-height:32px;padding:.2rem; }
.inspector { min-width:0;border:1px solid var(--line);border-radius:8px;padding:.65rem;margin:.75rem 0; }
.palette-actions { margin-top:.65rem; }
.contrast { color:var(--text);background:var(--surface);padding:.62rem;border:1px solid var(--line);border-radius:.65rem;min-width:0; }
.contrast summary { cursor:pointer;font-weight:650;font-size:.84rem; }
.contrast > label { width:max-content;max-width:100%;margin-block:.45rem; }
.contrast-table { overflow:auto;margin-top:.55rem;max-height:23rem; }
table { border-collapse:collapse;font-size:.8rem; }
th,td { border:1px solid var(--line);min-width:5.5rem;padding:.35rem;vertical-align:top;text-align:left; }
td small { display:block; }
</style>
