<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { logic, resetCss, rules, start, types, type Rule, type State } from './logic'
const { t } = useI18n()
const key = (id: string) => t('detail.css-reset.' + id)
const sample = '<main><h1>Un título de muestra para probar el ajuste de línea</h1><p>Prueba los márgenes y el interlineado.</p><figure><svg viewBox="0 0 180 36" width="180" height="36" role="img" aria-label="Muestra"><rect width="180" height="36" fill="#9acdb0"/></svg><figcaption>Ejemplo de medio</figcaption></figure><label>Nombre <input value="FrontKit"></label><button>Enviar</button><p hidden>Contenido oculto</p></main>'
const frame = (css = '') => '<!doctype html><html lang="es"><meta charset="utf-8"><title>Demo</title><style>' + css + '</style><body>' + sample + '</body></html>'
function toggle(state: State, id: Rule) {
  state.enabled = state.enabled.includes(id) ? state.enabled.filter(item => item !== id) : [...state.enabled,id]
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state, update}">
      <label>{{ key('base') }}<select :value="state.base" @change="update(d => Object.assign(d, start(($event.target as HTMLSelectElement).value as State['base'])))">
        <option v-for="id in types" :key="id" :value="id">{{ key(id) }}</option></select></label>
      <p v-if="state.base === 'preflight-complement'">{{ key('preflight') }}</p>
      <label v-for="flag in (['layer','minify','comments'] as const)" :key="flag" class="check"><input type="checkbox" :checked="state[flag]" @change="update(d => { d[flag] = ($event.target as HTMLInputElement).checked })" />{{ key(flag) }}</label>
      <label>{{ key('note') }}<input maxlength="120" type="text" :value="state.note" @input="update(d => { d.note = ($event.target as HTMLInputElement).value }, 'note')" /></label>
      <details v-for="(entry,id) in rules" :key="id">
        <summary>{{ key(id) }} · {{ entry[1] }}</summary>
        <label class="check"><input type="checkbox" :checked="state.enabled.includes(id)" @change="update(d => toggle(d,id))" />{{ key('include') }} · {{ entry[0] }}</label>
        <code>{{ entry[2] }}</code>
      </details>
    </template>
    <template #preview="{state}">
      <div class="compare">
        <p>{{ state.enabled.length }} {{ key('active') }}</p>
        <iframe sandbox="" :title="key('before')" :srcdoc="frame()" />
        <iframe sandbox="" :title="key('after')" :srcdoc="frame(resetCss(state))" />
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;width:100%;padding:.6rem}.compare p{grid-column:1/-1}iframe{width:100%;height:230px;border:1px solid var(--line);background:#fff}details code{overflow-wrap:anywhere}@media(max-width:600px){.compare{grid-template-columns:1fr}}
</style>
