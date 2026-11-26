<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { useClipboard } from '../../composables/useClipboard'
import { sendPalette } from '../../core/storage/palette-handoff'
import { adjust, contrast, description, logic, mix, values, variations, type State } from './logic'

const router = useRouter()
const copy = useClipboard()
const batch = ref('')
const batchFormat = ref<'HEX' | 'OKLCH'>('HEX')
const output = ref<Awaited<ReturnType<typeof import('./batch')['replaceColors']>>>()
const warning = ref('')
const supportsDropper = 'EyeDropper' in window
const p3 = matchMedia('(color-gamut: p3)').matches
const value = (e: Event) => (e.target as HTMLInputElement).value
type Update = (apply: (state: State) => void, group?: string) => void
async function pick(update: Update) {
  const browser = window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }
  try { const { sRGBHex } = await new browser.EyeDropper().open(); update(state => { state.first = sRGBHex }) } catch { /* Cancelled. */ }
}
function setContrast(state: State) {
  const candidate = adjust(state.first, state.second)
  if (candidate) state.first = candidate
  warning.value = candidate ? '' : 'No se alcanza AA ajustando solo la luminosidad.'
}
async function convertBatch() {
  try { output.value = (await import('./batch')).replaceColors(batch.value, batchFormat.value); warning.value = '' }
  catch { warning.value = 'Revisa la sintaxis y el tamaño del CSS.' }
}
async function send(state: State, to: 'palette' | 'gradient' | 'tokens') {
  const colors = [description(state.first)?.hex, description(state.second)?.hex, description(mix(state)?.value ?? '')?.hex]
  if (colors.some(color => !color)) return
  try {
    const id = await sendPalette(to, colors.map((color, index) => ({ name: ['principal','fondo','mezcla'][index], color: (color ?? '').slice(0, 7) })), 'color-converter')
    await router.push({ name: to, query: { handoff: id } })
  } catch { warning.value = 'No se pudo enviar la muestra.' }
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <label>Color CSS<input type="text" maxlength="180" :value="state.first" @input="update(d => { d.first = value($event) }, 'first')" /></label>
      <button v-if="supportsDropper" type="button" class="btn" @click="pick(update)">Cuentagotas</button>
      <label>Color de fondo<input type="text" maxlength="180" :value="state.second" @input="update(d => { d.second = value($event) }, 'second')" /></label>
      <p v-if="!description(state.first) || !description(state.second)" role="status">Introduce dos colores CSS válidos.</p>
      <label>Espacio de mezcla<select :value="state.space" @change="update(d => { d.space = value($event) as State['space'] })">
        <option value="rgb">sRGB</option><option value="oklab">OKLab</option><option value="oklch">OKLCH</option>
      </select></label>
      <label>Porcentaje del primer color<input type="range" min="0" max="100" :value="state.ratio" @input="update(d => { d.ratio = Number(value($event)) }, 'mix')" />{{ state.ratio }} %</label>
      <button type="button" class="btn" @click="update(setContrast)">Ajustar luminosidad a AA</button>
      <div class="actions">
        <button type="button" class="btn" @click="send(state, 'palette')">Enviar a Paleta</button>
        <button type="button" class="btn" @click="send(state, 'gradient')">Enviar a Gradientes</button>
        <button type="button" class="btn" @click="send(state, 'tokens')">Enviar a Tokens</button>
      </div>
      <label>CSS para convertir por lotes<textarea v-model="batch" rows="4" maxlength="200000" /></label>
      <label>Formato del lote<select v-model="batchFormat"><option>HEX</option><option>OKLCH</option></select></label>
      <button type="button" class="btn" :disabled="!batch.trim()" @click="convertBatch">Convertir CSS</button>
      <template v-if="output">
        <p role="status">{{ output.total }} colores convertidos. {{ output.unresolved.join(', ') }}</p>
        <button type="button" class="btn" @click="copy(output.css)">Copiar CSS convertido</button>
      </template>
      <p v-if="warning" role="status">{{ warning }}</p>
    </template>
    <template #preview="{ state }">
      <div class="preview-colors" v-if="description(state.first)">
        <div class="sample" :style="{ color: state.first, background: state.second }">Aa · FrontKit</div>
        <p>{{ description(state.first)?.name }} · Tailwind {{ description(state.first)?.tailwind }}</p>
        <p v-if="!description(state.first)?.srgb">Fuera del gamut sRGB. HEX usa el color mapeado. Pantalla P3: {{ p3 ? 'sí' : 'no' }}.</p>
        <p v-if="contrast(state.first, state.second)">
          WCAG {{ contrast(state.first, state.second)?.ratio.toFixed(2) }}:1 · APCA Lc {{ contrast(state.first, state.second)?.lc.toFixed(1) }}
          · {{ (contrast(state.first, state.second)?.ratio ?? 0) >= 7 ? 'AAA' : (contrast(state.first, state.second)?.ratio ?? 0) >= 4.5 ? 'AA' : 'Por debajo de AA' }}
        </p>
        <button v-for="(val, key) in values(state.first)" :key="key" type="button" class="btn" @click="copy(val ?? '')">{{ key }} · {{ val }}</button>
        <button v-if="mix(state)" type="button" class="btn" @click="copy(mix(state)?.code ?? '')">Mezcla · {{ mix(state)?.value }}</button>
        <div class="actions"><button v-for="(color, index) in variations(state.first)" :key="index" type="button" class="swatch"
          :style="{ background: color }" :aria-label="'Copiar ' + color" @click="copy(color)" /></div>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.preview-colors{display:grid;gap:.44rem;padding:.8rem;width:100%;min-width:0;overflow-wrap:anywhere}.sample{padding:1rem;font-weight:700;font-size:1.6rem}.swatch{width:2rem;height:2rem;border:1px solid var(--line);border-radius:.4rem}
</style>
