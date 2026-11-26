<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import RefactorWorkspace from '../../components/shared/RefactorWorkspace.vue'
import FileDropZone from '../../components/shared/FileDropZone.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { useWorker } from '../../composables/useWorker'
import { useClipboard } from '../../composables/useClipboard'
import { read, write } from '../../core/storage/db'
import { downloadBlob } from '../../lib/binary-download'
import { iconFiles, sprite, usage, zipFiles } from '../../lib/svg/downloads'
import { defaultSvgOptions, example, secondaryExample, type SvgRequest, type SvgResult, type SvgSource } from '../../lib/svg/model'
const batch=shallowRef<SvgSource[]>([{name:'brujula.svg',text:example},{name:'hoja.svg',text:secondaryExample}])
const mapped=ref<string[]>([]), all=ref(false),text=ref(''), search=ref(''), accessible=ref(false), external=ref(false), color=ref('#20604b'), size=ref(52), notice=ref(''), copied=ref('')
const worker=useWorker<SvgRequest,SvgResult>(()=>new Worker(new URL('../../lib/svg/svg-worker.ts',import.meta.url),{type:'module'}))
const copy=useClipboard()
const icons=computed(()=>worker.result.value?.icons??[])
const shown=computed(()=>icons.value.filter(icon=>icon.id.includes(search.value.trim().toLowerCase())||icon.name.toLowerCase().includes(search.value.toLowerCase())))
const outputs=computed(()=>icons.value.length?{svg:sprite(icons.value),html:iconFiles(icons.value)['catalog.html'],typescript:iconFiles(icons.value)['icons.d.ts']}:undefined)
const sizeOf=(files:SvgSource[])=>files.reduce((total,file)=>total+new TextEncoder().encode(file.text).length,0)
let selection=0
function run(){
  copied.value=''
  worker.send({kind:'sprite',sources:batch.value,options:{...defaultSvgOptions(),currentColor:all.value},recolor:[...mapped.value]})
}
function set(files:SvgSource[]){
  batch.value=files;worker.result.value=undefined;mapped.value=[];notice.value=''
}
async function select(items:File[]){
  notice.value=''
  const job=++selection
  let total=0
  const ok=items.filter(file=>/\.svg$/i.test(file.name)&&file.size<=2_000_000).slice(0,200).filter(file=>{total+=file.size;return total<=5_000_000})
  try{
    const sources=await Promise.all(ok.map(async f=>({name:f.name,text:await f.text()})))
    if(job!==selection)return
    if(sources.length)set(sources)
    if(sources.length!==items.length)notice.value='Se omitieron archivos. Límite de 200 SVG y 5 MB por conjunto.'
  }catch{if(job===selection)notice.value='No se pudo leer el lote.'}
}
function add(){
  const next=[...batch.value,{name:'icono-'+(batch.value.length+1)+'.svg',text:text.value}]
  if(next.length>200||sizeOf(next)>5_000_000){notice.value='El conjunto supera 200 SVG o 5 MB.';return}
  set(next);text.value=''
}
async function save(){
  try{await write('projects','svg-icon-set',batch.value);notice.value='Conjunto guardado en este dispositivo.'}catch{notice.value='No se pudo guardar el conjunto.'}
}
async function load(){
  try{
    const s=(await read('projects','svg-icon-set'))?.state
    if(!Array.isArray(s)||s.length>200||!s.every(item=>item&&typeof item.name==='string'&&typeof item.text==='string')||sizeOf(s)>5_000_000){
      notice.value='No hay un conjunto guardado que se pueda abrir.';return
    }
    set(s)
  }catch{notice.value='No se pudo abrir el conjunto.'}
}
async function copyIcon(id:string){copied.value=await copy(usage(id,accessible.value,external.value))?id:''}
function archive(){downloadBlob(zipFiles(iconFiles(icons.value)),'sprite-frontkit.zip')}
</script>
<template>
  <RefactorWorkspace id="svg-sprite" :outputs="outputs" :extensions="{typescript:'.d.ts'}">
    <FileDropZone label="Iconos SVG" accept=".svg,image/svg+xml" multiple :disabled="worker.busy.value" @choose="select" />
    <label>Añadir código SVG<textarea v-model="text" rows="5" maxlength="2000000" spellcheck="false" /></label>
    <div class="actions">
      <button type="button" class="btn" :disabled="worker.busy.value||!text.trim()" @click="add">Añadir a la lista</button>
      <button type="button" class="btn" :disabled="worker.busy.value||!batch.length" @click="set([])">Vaciar lista</button>
    </div>
    <details><summary>Archivos seleccionados · {{batch.length}}</summary>
      <ul><li v-for="(item,i) in batch" :key="i">
        {{item.name}}
        <label class="check"><input v-model="mapped" type="checkbox" :value="item.name" /> currentColor</label>
        <button type="button" class="btn" :aria-label="'Quitar '+item.name" @click="set(batch.filter((_,j)=>j!==i))">Quitar</button>
      </li></ul>
    </details>
    <label class="check"><input v-model="all" type="checkbox" /> Convertir todo a currentColor</label>
    <p v-if="all||mapped.length">Los iconos multicolor pueden perder sus colores originales.</p>
    <button type="button" class="btn primary" :disabled="worker.busy.value||!batch.length" @click="run">Generar sprite</button>
    <button v-if="worker.busy.value" type="button" class="btn" @click="worker.cancel">Cancelar</button>
    <div class="actions">
      <button type="button" class="btn" :disabled="!batch.length" @click="save">Guardar conjunto local</button>
      <button type="button" class="btn" @click="load">Abrir conjunto local</button>
    </div>
    <label v-if="worker.busy.value">Progreso del sprite<progress :value="worker.progress.value" max="100" /></label>
    <p v-if="notice" role="status">{{notice}}</p>
    <p v-if="worker.failed.value" role="alert">El motor SVG no está disponible.</p>
    <ul v-if="worker.result.value?.warnings.length"><li v-for="(item,i) in worker.result.value.warnings" :key="i">{{item}}</li></ul>
    <template #review>
      <section class="panel tool-controls sprite">
        <h2>Catálogo del sprite</h2>
        <p>Un enlace a sprite.svg#id funciona en su mismo origen. Para compartir un ejemplo autocontenido, incrusta el sprite en la página.</p>
        <label>Buscar iconos<input v-model="search" type="search" /></label>
        <label>Color de muestra<input v-model="color" type="color" /></label>
        <RangeField v-model="size" label="Tamaño de muestra" :min="20" :max="100" />
        <label class="check"><input v-model="accessible" type="checkbox" /> Copiar SVG con nombre accesible</label>
        <label class="check"><input v-model="external" type="checkbox" /> Copiar referencia a sprite.svg</label>
        <button v-if="icons.length" type="button" class="btn" @click="archive">Descargar sprite ZIP</button>
        <iframe v-if="icons.length" class="icons-sheet" title="Muestra visual de iconos" sandbox=""
          :srcdoc="'<!doctype html><meta charset=\'utf-8\'><meta http-equiv=\'Content-Security-Policy\' content=&quot;default-src \'none\'; img-src data:; style-src \'unsafe-inline\'&quot;><style>.embedded-sprite{position:absolute;width:0;height:0;overflow:hidden}body{margin:0;color:'+color+';font-family:system-ui;display:flex;gap:1rem;flex-wrap:wrap}svg.icon{width:'+size+'px;height:'+size+'px}figure{margin:.5rem;text-align:center}figcaption{font-size:.75rem}</style><div class=\'embedded-sprite\'>'+sprite(icons)+'</div>'+shown.map(icon=>'<figure>'+usage(icon.id)+'<figcaption>'+icon.id+'</figcaption></figure>').join('')" />
        <div class="icon-grid"><button v-for="icon in shown" :key="icon.id" type="button" class="btn" @click="copyIcon(icon.id)">{{copied===icon.id?'Copiado · ':''}}{{icon.id}}</button></div>
      </section>
    </template>
  </RefactorWorkspace>
</template>
<style scoped>.icon-grid{display:flex;gap:.35rem;flex-wrap:wrap}.icons-sheet{height:170px;width:100%;border:1px solid var(--line);background:#f4f6ee;padding:.35rem;border-radius:.45rem}.sprite ul{margin:0}.sprite{min-width:0}</style>
