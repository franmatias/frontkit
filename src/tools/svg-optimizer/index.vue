<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import RefactorPane from '../../components/shared/RefactorPane.vue'
import RefactorWorkspace from '../../components/shared/RefactorWorkspace.vue'
import FileDropZone from '../../components/shared/FileDropZone.vue'
import { useWorker } from '../../composables/useWorker'
import { downloadBlob } from '../../lib/binary-download'
import { dataUrl, optimizedArchive, optimizedFiles, zipFiles } from '../../lib/svg/downloads'
import { defaultSvgOptions, example, isPaint, type SvgRequest, type SvgResult, type SvgSource } from '../../lib/svg/model'
const input=ref(example), files=shallowRef<SvgSource[]>([]), active=ref(0), dark=ref(false), error=ref('')
const config=ref(defaultSvgOptions())
const tabs={svg:'SVG',tsx:'React TSX',jsx:'React JSX',vue:'Vue',svelte:'Svelte 5',plaintext:'data URI'}
const options={removeMetadata:'Quitar metadatos',removeComments:'Quitar comentarios',removeEditors:'Quitar datos del editor',removeTitle:'Quitar title',removeDesc:'Quitar desc',cleanupIds:'Limpiar identificadores',prefix:'Prefijar identificadores',multipass:'Optimizar en varias pasadas',removeDimensions:'Quitar ancho y alto',currentColor:'Convertir rellenos y trazos a currentColor'} as const
const optionGroups = [
  { title: 'Limpieza', keys: ['removeMetadata','removeComments','removeEditors','removeTitle','removeDesc'] },
  { title: 'Identificadores', keys: ['cleanupIds','prefix'] },
  { title: 'Salida', keys: ['multipass','removeDimensions','currentColor'] },
] as const
const worker=useWorker<SvgRequest,SvgResult>(()=>new Worker(new URL('../../lib/svg/svg-worker.ts',import.meta.url),{type:'module'}))
const entry=computed(()=>worker.result.value?.entries[active.value])
const outputs=computed(()=>{
  const item=entry.value
  return item?optimizedFiles(item):undefined
})
const original=computed(()=>worker.result.value?.entries[active.value]?.before??0)
const outputSize=computed(()=>entry.value?new TextEncoder().encode(entry.value.svg).length:0)
const colorOf=(name:string)=>{
  const value=config.value.changes[name]??name
  return /^#[\da-f]{6}$/i.test(value)?value:/^#[\da-f]{3}$/i.test(value)?'#'+[...value.slice(1)].map(char=>char+char).join(''):'#000000'
}
let sourceJob=0
function resetInput(){
  sourceJob++
  files.value=[]
  worker.cancel()
  worker.result.value=undefined
}
async function choose(items:File[]){
  const job=++sourceJob
  error.value=''
  const matched=items.filter(file=>/\.svg$/i.test(file.name)&&file.size<=2_000_000).slice(0,40)
  let total=0
  const retained=matched.filter(file=>{total+=file.size;return total<=8_000_000})
  if(retained.length!==items.length)error.value='Se omitieron archivos que superan el límite de 2 MB por SVG u 8 MB por lote.'
  try{
    const batch=await Promise.all(retained.map(async file=>({name:file.name,text:await file.text()})))
    if(job!==sourceJob||!batch.length)return
    files.value=batch;input.value=batch[0]!.text
    run()
  }catch{if(job===sourceJob)error.value='No se pudieron leer los archivos.'}
}
function run(){
  const inputs=files.value.length?files.value:[{name:'brujula.svg',text:input.value}]
  active.value=0
  worker.send({kind:'optimize',sources:inputs,options:{...config.value,changes:{...config.value.changes}}})
}
function replacePaint(key:string,value:string){
  if(!isPaint(value))return
  config.value.changes={...config.value.changes,[key]:value}
}
function archive(){
  if(worker.result.value)downloadBlob(zipFiles(optimizedArchive(worker.result.value.entries)),'svg-optimizados.zip')
}
</script>
<template>
  <RefactorWorkspace id="svg-optimizer" options-title="Opciones de optimización" :outputs="outputs" :extensions="{vue:'.vue',svelte:'.svelte',tsx:'.tsx',jsx:'.jsx'}">
    <template #editors>
      <RefactorPane kind="html" title="Código SVG">
        <div class="svg-files">
          <FileDropZone label="Archivos SVG" accept=".svg,image/svg+xml" multiple :disabled="worker.busy.value" @choose="choose" />
          <p v-if="files.length">{{files.length}} archivos seleccionados.</p>
        </div>
        <textarea v-model="input" aria-label="Código SVG" maxlength="2000000" spellcheck="false" @input="resetInput" />
      </RefactorPane>
    </template>
    <fieldset v-for="group in optionGroups" :key="group.title" class="svg-group">
      <legend>{{group.title}}</legend>
      <label v-for="key in group.keys" :key="key" class="check"><input v-model="config[key]" type="checkbox" />{{options[key]}}</label>
      <label v-if="group.title==='Salida'">Precisión decimal<input v-model.number="config.precision" type="number" min="0" max="6" /></label>
    </fieldset>
    <p class="svg-note">La salida conserva el viewBox. La vista previa elimina scripts, estilos incrustados y referencias externas.</p>
    <p v-if="config.currentColor" class="svg-note">La conversión agrupa varios colores bajo currentColor. Revisa los iconos multicolor.</p>
    <template #action>
      <button v-if="worker.busy.value" type="button" class="btn" @click="worker.cancel">Cancelar optimización</button>
      <button v-else type="button" class="btn primary" :disabled="!input.trim()" @click="run">Optimizar SVG</button>
    </template>
    <template #status>
    <label v-if="worker.busy.value">Progreso de optimización<progress :value="worker.progress.value" max="100" /></label>
    <p v-if="error || worker.failed.value" role="alert">{{error || 'No se pudo ejecutar el optimizador.'}}</p>
    <ul v-if="worker.result.value?.warnings.length"><li v-for="(text,i) in worker.result.value.warnings" :key="i">{{text}}</li></ul>
    </template>
    <fieldset v-if="entry && Object.keys(entry.colors).length" class="svg-paints">
      <legend>Colores del SVG</legend>
      <div v-for="(count,key) in entry.colors" :key="key" class="actions paint">
        <label>{{key}} · {{count}} usos<input type="color" :value="colorOf(key)" @input="replacePaint(key,($event.target as HTMLInputElement).value)" /></label>
        <span v-if="config.changes[key]">{{config.changes[key]}}</span>
      </div>
    </fieldset>
    <template #review>
      <RefactorPane kind="review" title="Comparación SVG">
        <div class="tool-controls svg-review">
        <label class="check"><input v-model="dark" type="checkbox" /> Fondo oscuro</label>
        <label v-if="(worker.result.value?.entries.length ?? 0)>1">Archivo<select v-model.number="active"><option v-for="(item,i) in worker.result.value?.entries" :key="i" :value="i">{{item.name}}</option></select></label>
        <div class="compare" :class="{dark}">
          <figure><figcaption>Origen saneado</figcaption><img v-if="entry" :src="dataUrl(entry.original)" alt="SVG antes de optimizar" /></figure>
          <figure><figcaption>Optimizado</figcaption><img v-if="entry" :src="dataUrl(entry.svg)" alt="SVG optimizado" /></figure>
        </div>
        <p v-if="entry">{{original}} → {{outputSize}} bytes · Ahorro {{Math.round((1-outputSize/original)*100)}} %</p>
        <p v-if="entry">Formatos disponibles · {{Object.values(tabs).join(', ')}}</p>
        <button v-if="entry && (worker.result.value?.entries.length ?? 0)>1" type="button" class="btn" @click="archive">Descargar lote ZIP</button>
        </div>
      </RefactorPane>
    </template>
  </RefactorWorkspace>
</template>
<style scoped>
.svg-files,.svg-review { padding:.8rem 1rem; }
.svg-group { display:grid;gap:.25rem;align-self:start;min-width:0; }
.svg-group legend,.svg-paints legend { font-weight:650;margin-bottom:.35rem; }
.svg-note,.svg-paints { grid-column:1/-1; }
.svg-note { color:var(--muted);font-size:.85rem; }
.svg-paints { display:flex;flex-wrap:wrap;gap:.5rem 1rem; }

.compare{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}.compare figure{margin:0;min-width:0;padding:.5rem;border-radius:.55rem;background:conic-gradient(#fff 25%,#e0e7e2 0 50%,#fff 0 75%,#e0e7e2 0) 0 0 / 22px 22px;color:#112b23;text-align:center}.compare.dark figure{background:conic-gradient(#223731 25%,#172922 0 50%,#223731 0 75%,#172922 0) 0 0 / 22px 22px;color:#fff}.compare img{width:100%;height:145px;object-fit:contain}.paint{margin-block:.25rem}
</style>
