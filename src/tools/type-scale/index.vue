<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { useLocalFont } from '../../composables/useLocalFont'
import { sendTypography } from '../../core/storage/typography-handoff'
import { rounded } from '../../lib/css/fluid'
import { useNotificationsStore } from '../../stores/notifications'
import { fonts } from '../readability/logic'
import { logic, previewSize, ratios, steps, valid, type State } from './logic'

const { t } = useI18n()
const router = useRouter()
const notifications = useNotificationsStore()
const label = (key: string) => t('detail.type-scale.' + key)
const { fontName, fontError, localFont, clearLocal } = useLocalFont('FrontKitScale')
const viewport = ref(800)
const title = ref('Una jerarquía tipográfica')
const body = ref('Compara encabezados, texto principal, anotaciones y etiquetas dentro de una misma escala.')
const numbers = { base:[8,40,.5], ratio:[1,2,.001], down:[0,3,1], up:[0,10,1], lineHeight:[1,2.5,.01] } as const
const fluid = { upperBase:[8,40,.5], upperRatio:[1,2,.001], minViewport:[160,3840,1], maxViewport:[160,3840,1] } as const
const value = (event: Event) => (event.target as HTMLInputElement).value
const format = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 })
const tags = ['h1','h2','h3','h4','h5','h6'] as const
const sending = ref(false)
function sample(state: State, step: number) {
  const list = steps(state)
  const choice = list[state.down + Math.min(state.up, Math.max(-state.down, step))]
  const size = previewSize(state, choice, viewport.value)
  return { fontSize: Math.min(240, size) + 'px', lineHeight: choice.lineHeight }
}
async function transfer(state: State) {
  if (sending.value || !valid(state)) return
  sending.value = true
  try {
    const handoff = await sendTypography({
      base: state.base, ratio: state.ratio, font: state.font,
      scale: steps(state).map(({ name,value,lineHeight }) => ({ name,value,lineHeight })),
    })
    await router.push({ name: 'tokens', query: { handoff } })
  } catch { notifications.push('tool.storageError') }
  finally { sending.value = false }
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <div class="field-grid">
        <label>{{ label('preset') }}<select :value="ratios.some(([,ratio]) => ratio === state.ratio) ? String(state.ratio) : ''"
          @change="value($event) && update(d => { d.ratio = Number(value($event)) })">
          <option value="" :disabled="ratios.some(([,ratio]) => ratio === state.ratio)">{{ label('custom') }}</option>
          <option v-for="[name,ratio] in ratios" :key="ratio" :value="ratio">{{ name }} · {{ format.format(ratio) }}</option>
        </select></label>
        <label>{{ label('font') }}<select :value="state.font" @change="clearLocal(); update(d => { d.font = value($event) as State['font'] })">
          <option v-for="font in Object.keys(fonts)" :key="font" :value="font">{{ fonts[font as State['font']] }}</option>
        </select></label>
        <label>{{ label('naming') }}<select :value="state.naming" @change="update(d => { d.naming = value($event) as State['naming'] })">
          <option value="tailwind">xs…9xl</option><option value="steps">step--2…step-8</option>
        </select></label>
        <label>{{ label('round') }}<select :value="state.roundTo" @change="update(d => { d.roundTo = value($event) === '4' ? 4 : 1 })">
          <option value="1">1 px</option><option value="4">4 px</option>
        </select></label>
      </div>
      <label>{{ label('fontFile') }}<input type="file" accept=".woff,.woff2,.ttf,.otf" @change="localFont" /></label>
      <p v-if="fontError" role="alert">{{ label('badFont') }}</p>
      <button v-if="fontName" type="button" class="btn" @click="clearLocal">{{ label('clearFont') }} · {{ fontName }}</button>
      <RangeField v-for="(limits,key) in numbers" :key="key" :label="label(key)" :min="limits[0]" :max="limits[1]" :step="limits[2]"
        :model-value="state[key]" @update:model-value="update(d => { d[key] = key === 'down' || key === 'up' ? Math.round($event) : $event }, key)" />
      <label class="check"><input type="checkbox" :checked="state.compact" @change="update(d => { d.compact = !d.compact })" />{{ label('compact') }}</label>
      <label class="check"><input type="checkbox" :checked="state.fluid" @change="update(d => { d.fluid = !d.fluid })" />{{ label('fluid') }}</label>
      <template v-if="state.fluid">
        <RangeField v-for="(limits,key) in fluid" :key="key" :label="label(key)" :min="limits[0]" :max="limits[1]" :step="limits[2]"
        :model-value="state[key]" @update:model-value="update(d => { d[key] = $event }, key)" />
      </template>
      <p v-if="!valid(state)" role="alert" class="notice">{{ label('invalid') }}</p>
      <button class="btn" type="button" :disabled="!valid(state) || sending" @click="transfer(state)">{{ t('tool.sendTokens') }}</button>
    </template>
    <template #preview="{ state }">
      <div class="scale-preview">
        <RangeField v-if="state.fluid" :label="label('viewport')" :min="160" :max="3840" :model-value="viewport" @update:model-value="viewport = $event" />
        <div class="field-grid"><label>{{ label('title') }}<input v-model="title" maxlength="80" /></label><label>{{ label('body') }}<input v-model="body" maxlength="240" /></label></div>
        <div class="type-demo" :style="{ fontFamily: (fontName ? 'FrontKitScale, ' : '') + fonts[state.font] }">
          <div v-for="(tag,i) in tags" :key="tag" class="type-row">
            <code>{{ tag }}</code><component :is="tag" :style="sample(state,6-i)">{{ title }}</component>
          </div>
          <p :style="sample(state,0)">{{ body }}</p>
          <small :style="sample(state,-1)">{{ label('fine') }}</small>
          <span class="badge" :style="sample(state,-2)">{{ label('badge') }}</span>
        </div>
        <p v-if="steps(state).some(step => previewSize(state,step,viewport) > 240)">{{ label('previewLimit') }}</p>
        <div class="table-region" role="region" tabindex="0" :aria-label="label('sizes')">
          <table><caption>{{ label('sizes') }}</caption>
            <thead><tr><th scope="col">{{ label('step') }}</th><th scope="col">px</th><th scope="col">rem</th><th scope="col">{{ label('lineHeight') }}</th></tr></thead>
            <tbody><tr v-for="step in steps(state)" :key="step.step">
              <th scope="row"><code>{{ step.name }}</code></th><td>{{ format.format(previewSize(state,step,viewport)) }}</td>
              <td>{{ format.format(rounded(previewSize(state,step,viewport) / 16)) }}</td><td>{{ format.format(step.lineHeight) }}</td>
            </tr></tbody>
          </table>
        </div>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.scale-preview { width:100%;min-width:0; }
.type-demo { margin:.7rem 0;padding:.55rem;background:var(--surface);border:1px solid var(--line);border-radius:8px;max-height:28rem;overflow:auto; }
.type-row { display:grid;grid-template-columns:2rem minmax(0,1fr);align-items:baseline;border-bottom:1px solid var(--line);gap:.4rem; }
.type-row code { color:var(--muted); }
.type-row h1,.type-row h2,.type-row h3,.type-row h4,.type-row h5,.type-row h6,.type-demo p { margin:0;overflow-wrap:anywhere; }
.table-region { max-height:21rem;overflow:auto; }
table { width:100%;border-collapse:collapse; }
caption { text-align:left;font-weight:700; }
th,td { text-align:left;border-bottom:1px solid var(--line);padding:.35rem; }
</style>
