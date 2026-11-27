<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RefactorWorkspace from '../../components/shared/RefactorWorkspace.vue'
import RefactorPane from '../../components/shared/RefactorPane.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { receiveCleaned } from '../../core/storage/html-cleaner-handoff'
import { receiveAudit } from '../../core/storage/audit-handoff'
import { read, remove, writeRememberedInput } from '../../core/storage/db'
import { useSettingsStore } from '../../stores/settings'
import { documentFor, exportsFor, impacts, lineOf, manualChecks, tags, type Report, type ReportNode } from './logic'

const route=useRoute(),router=useRouter()
const settings=useSettingsStore()
const html=ref(receiveCleaned('a11y-audit') ?? '<main><h1>Ejemplo para auditar</h1><img src="foto.jpg"><input type="text"><button></button></main>')
const css=ref('')
const options=ref<string[]>(['wcag2a','wcag2aa','wcag21aa'])
const width=ref(520)
const dark=ref(false)
const remember=ref(false)
const loading=ref(false)
const error=ref('')
const token=ref('')
const frame=ref<HTMLIFrameElement>()
const documentHtml=ref('')
const report=ref<Report>()
const incoming=ref<Awaited<ReturnType<typeof receiveAudit>>>()
const labels={critical:'Crítico',serious:'Grave',moderate:'Moderado',minor:'Leve'}
const results=computed(()=>report.value?exportsFor(report.value):undefined)
const groups=computed(()=>impacts.map(impact=>({impact,items:report.value?.violations.filter(item=>item.impact===impact)??[]})).filter(group=>group.items.length))
let deadline:ReturnType<typeof setTimeout>
let job=0
const bytes=(str:string)=>new TextEncoder().encode(str).length
watch(()=>route.query.handoff,async(id,_,cleanup)=>{
  let active=true
  cleanup(()=>{active=false})
  incoming.value=undefined
  const draft=await receiveAudit(id).catch(()=>undefined)
  if(active)incoming.value=draft
},{immediate:true})
function loadIncoming(){
  if(!incoming.value)return
  html.value=incoming.value.html
  css.value=incoming.value.css
  const id=route.query.handoff
  if(typeof id==='string')void remove('handoff','inbox:'+id).catch(()=>{})
  const query={...route.query};delete query.handoff
  void router.replace({query})
}
const stop=()=>{
  job++;token.value='';loading.value=false
  clearTimeout(deadline)
}
watch([html,css,dark,options],()=>{stop();documentHtml.value='';report.value=undefined;error.value=''})
watch(remember,enabled=>{if(!enabled)void remove('kv','a11y-audit:input').catch(()=>{})})
onMounted(async()=>{
  window.addEventListener('message',receive)
  if(!settings.data.preferences.rememberInput)return
  try {
    const record=(await read('kv','a11y-audit:input'))?.state as {html?:unknown;css?:unknown}|undefined
    if(record && typeof record.html==='string' && typeof record.css==='string' && bytes(record.html)+bytes(record.css)<=100_000){
      html.value=record.html;css.value=record.css;remember.value=true
    }
  }catch{ /* Storage unavailable. */ }
})
onScopeDispose(()=>{stop();window.removeEventListener('message',receive)})
function receive(event:MessageEvent){
  if(event.source!==frame.value?.contentWindow || event.origin!=='null'||event.data?.channel!=='frontkit-audit'||!token.value||event.data.token!==token.value)return
  clearTimeout(deadline)
  loading.value=false
  if(event.data.error){error.value=String(event.data.error);return}
  const value=event.data.report as Report|undefined
  if(value && Array.isArray(value.violations) && Array.isArray(value.manual))report.value=value
}
function reveal(node:ReportNode){
  if(node.selector)frame.value?.contentWindow?.postMessage({channel:'frontkit-audit',token:token.value,selector:node.selector},'*')
}
async function run(){
  stop()
  report.value=undefined;error.value=''
  if(bytes(html.value)>500_000||bytes(css.value)>200_000){error.value='El máximo es 500 KB de HTML y 200 KB de CSS.';return}
  if(!options.value.length){error.value='Activa al menos un conjunto de reglas.';return}
  const current=job
  loading.value=true
  try {
    const {bundle}=await import('./audit-engine')
    if(current!==job)return
    token.value=crypto.randomUUID().replaceAll('-','')
    documentHtml.value=documentFor({html:html.value,css:css.value,rules:options.value,dark:dark.value},token.value,bundle)
    if(remember.value&&settings.data.preferences.rememberInput){
      if(bytes(html.value)+bytes(css.value)<=100_000)void writeRememberedInput('a11y-audit:input',{html:html.value,css:css.value}).catch(()=>{})
      else void remove('kv','a11y-audit:input').catch(()=>{})
    }
    deadline=setTimeout(()=>{if(current===job && loading.value){stop();error.value='La auditoría agotó el tiempo disponible.'}},12000)
  }catch(e){
    if(current===job){loading.value=false;error.value=e instanceof Error?e.message:'No se pudo cargar el auditor.'}
  }
}
</script>
<template>
  <RefactorWorkspace id="a11y-audit" options-title="Opciones de auditoría" :outputs="results">
    <template #editors>
      <RefactorPane kind="html" title="HTML">
        <template #action><button v-if="incoming" type="button" class="btn" @click="loadIncoming">Importar código enviado</button></template>
        <textarea v-model="html" aria-label="HTML que se va a auditar" maxlength="500000" spellcheck="false" autocapitalize="off" />
      </RefactorPane>
      <RefactorPane kind="css" title="CSS opcional">
        <textarea v-model="css" aria-label="CSS opcional" maxlength="200000" spellcheck="false" autocapitalize="off" />
      </RefactorPane>
    </template>
    <fieldset><legend>Conjuntos de reglas</legend>
      <label v-for="tag in tags" :key="tag" class="check"><input v-model="options" :value="tag" type="checkbox" />{{tag}}</label>
    </fieldset>
    <label class="check"><input v-model="dark" type="checkbox" />Esquema oscuro</label>
    <label v-if="settings.data.preferences.rememberInput" class="check"><input v-model="remember" type="checkbox" />Recordar HTML y CSS en este equipo (hasta 100 KB)</label>
    <RangeField label="Ancho de la vista (px)" v-model="width" :min="280" :max="1000" />
    <template #action><button type="button" class="btn primary" :disabled="loading||!html.trim()" @click="run">Auditar HTML</button></template>
    <template #status>
    <p>La vista se abre aislada. Se quitan scripts y recursos remotos antes de analizar el documento.</p>
    <p v-if="loading" role="status">Analizando la vista aislada…</p>
    <p v-if="error" role="alert">{{error}}</p>
    </template>
    <template #review>
      <RefactorPane kind="review" title="Vista auditada"><div class="tool-controls audit-review">
        <div v-if="documentHtml" class="frame-wrap"><iframe ref="frame" title="Documento auditado" sandbox="allow-scripts" :width="width" :srcdoc="documentHtml" /></div>
        <template v-if="report">
          <p role="status">{{report.violations.length}} infracciones · {{report.passes}} reglas superadas · {{report.manual.length}} a revisar manualmente · {{report.inapplicable}} no aplicables</p>
          <section v-for="group in groups" :key="group.impact">
            <h3>{{labels[group.impact]}}</h3>
            <details v-for="item in group.items" :key="item.id">
              <summary>{{item.help}} · <code>{{item.id}}</code></summary>
              <p>{{item.description}}</p>
              <a v-if="/^https?:\/\//.test(item.helpUrl)" :href="item.helpUrl" target="_blank" rel="noopener noreferrer">Documentación de la regla</a>
              <ul><li v-for="(node,i) in item.nodes" :key="i">
                <code>{{node.html}}</code><p v-if="node.reason">{{node.reason}}</p>
                <p v-if="lineOf(html,node)">Línea aproximada {{lineOf(html,node)}}</p>
                <button type="button" class="btn" :disabled="!node.selector" @click="reveal(node)">Resaltar elemento</button>
              </li></ul>
            </details>
          </section>
          <details v-if="report.manual.length"><summary>Reglas que requieren revisión manual</summary>
            <ul><li v-for="item in report.manual" :key="item.id">{{item.help}} · {{item.id}}</li></ul>
          </details>
          <h3>Comprobaciones manuales</h3>
          <ul><li v-for="rule in manualChecks" :key="rule">{{rule}}</li></ul>
        </template>
      </div></RefactorPane>
    </template>
  </RefactorWorkspace>
</template>
<style scoped>.audit-review{padding:.8rem 1rem;min-width:0}.frame-wrap{overflow:auto;max-width:100%}iframe{max-width:none;height:245px;border:1px solid var(--line);background:#fff}.tool-controls li{overflow-wrap:anywhere;margin-block:.3rem}details{margin-block:.35rem}fieldset{display:grid;gap:.35rem}</style>
