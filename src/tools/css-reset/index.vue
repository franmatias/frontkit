<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { logic, resetCss, rules, start, types, type Rule, type State } from './logic'
const { t } = useI18n()
const key = (id: string) => t('detail.css-reset.' + id)
const sample = '<main><h1>Un título de muestra para probar el ajuste de línea</h1><p>Prueba los márgenes y el interlineado.</p><figure><svg viewBox="0 0 180 36" width="180" height="36" role="img" aria-label="Muestra"><rect width="180" height="36" fill="#9acdb0"/></svg><figcaption>Ejemplo de medio</figcaption></figure><label>Nombre <input value="FrontKit"></label><button>Enviar</button><p hidden>Contenido oculto</p></main>'
const frame = (css = '') => '<!doctype html><html lang="es"><meta charset="utf-8"><title>Demo</title><style>' + css + '</style><body>' + sample + '</body></html>'
const search = ref('')
const entries = Object.entries(rules) as [Rule, typeof rules[Rule]][]
const categories = [...new Set(entries.map(([,entry]) => entry[0]))]
const groups = computed(() => categories.map(category => ({category, items:entries.filter(([id, entry]) => {
  const query = search.value.trim().toLocaleLowerCase('es')
  return entry[0] === category && [key(id), ...entry].join(' ').toLocaleLowerCase('es').includes(query)
})})).filter(group => group.items.length))
function toggleGroup(state:State, items: [Rule, typeof rules[Rule]][]) {
  const ids=items.map(([id])=>id)
  state.enabled=ids.every(id=>state.enabled.includes(id))
    ? state.enabled.filter(id=>!ids.includes(id))
    : [...new Set([...state.enabled,...ids])]
}
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
      <section class="rule-picker" :aria-label="key('ruleList')">
        <div class="panel-top"><h3>{{ key('ruleList') }}</h3><span class="badge">{{ state.enabled.length }} / {{ entries.length }}</span></div>
        <label>{{ key('searchRules') }}<input v-model="search" type="search" :aria-label="key('searchRules')" /></label>
        <div class="actions">
          <button type="button" class="btn" @click="update(d=>{d.enabled=entries.map(([id])=>id)})">{{key('allRules')}}</button>
          <button type="button" class="btn" @click="update(d=>{d.enabled=[]})">{{key('noRules')}}</button>
        </div>
        <p v-if="!groups.length">{{ key('emptyRules') }}</p>
        <fieldset v-for="group in groups" :key="group.category" class="rule-group">
          <legend>{{ group.category }}</legend>
          <button type="button" class="btn pill" @click="update(d=>toggleGroup(d,group.items))">{{key(group.items.every(([id])=>state.enabled.includes(id))?'clearGroup':'enableGroup')}}</button>
          <label v-for="[id,entry] in group.items" :key="id" class="rule-row">
            <input type="checkbox" :checked="state.enabled.includes(id)" @change="update(d=>toggle(d,id))" />
            <span>{{ key(id) }}</span><small>{{ entry[1] }}</small>
          </label>
        </fieldset>
      </section>
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

.rule-picker { display:grid;gap:.6rem;min-width:0; }.rule-picker input[type=search] { width:100%; }
.rule-group { display:grid;gap:.25rem;border:1px solid var(--line);padding:.5rem;border-radius:.6rem;min-width:0; }
.rule-group legend { padding-inline:.3rem;font-weight:700; }.rule-group > button { justify-self:start; }
.rule-row { display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.5rem;padding:.38rem;border-radius:.35rem;cursor:pointer;font-size:.85rem; }
.rule-row:has(:checked) { background:var(--accent-soft); }.rule-row small { color:var(--muted);font-size:.69rem; }
</style>
