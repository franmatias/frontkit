<script setup lang="ts">
import { computed,onScopeDispose,ref,shallowRef,watch } from 'vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import CodeOutputPanel from '../../components/shared/CodeOutputPanel.vue'
import FileDropZone from '../../components/shared/FileDropZone.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { useWorker } from '../../composables/useWorker'
import { downloadBlob } from '../../lib/binary-download'
import { example, type VectorRequest, type VectorResult, type VectorSource } from '../../lib/svg/model'
import { zipFiles } from '../../lib/svg/downloads'
import { basePath, logic, tags, type Request, type Result, type State } from './logic'
const file=shallowRef<File>(),error=ref('')
const preview=ref<{tab?:string;apple?:string;android?:string;mask?:string}>({})
const worker=useWorker<Request,{ok:true;result:Result}|{ok:false;error:string}>(()=>new Worker(new URL('./favicon-worker.ts',import.meta.url),{type:'module'}))
const vector=useWorker<VectorRequest,VectorResult>(()=>new Worker(new URL('../../lib/svg/svg-worker.ts',import.meta.url),{type:'module'}))
const decoding=ref(false)
const busy=computed(()=>worker.busy.value||vector.busy.value||decoding.value)
let current=0
let options:State|undefined
const result=computed(()=>worker.result.value?.ok?worker.result.value.result:undefined)
const supported=typeof OffscreenCanvas!=='undefined'&&typeof Worker!=='undefined'
const label={appName:'Nombre de la aplicación',shortName:'Nombre corto',startUrl:'Inicio relativo al sitio',basePath:'Ruta base'}
const limits={appName:80,shortName:30,startUrl:150,basePath:150}
const color={themeColor:'Color de tema',backgroundColor:'Fondo opaco',maskColor:'Fondo maskable',darkColor:'Fondo SVG oscuro'}
const val=(e:Event)=>(e.target as HTMLInputElement).value
function select(items:File[]){
  const item=items[0]
  error.value=''
  if(!item)return
  if(!/\.(?:svg|png|jpe?g|webp)$/i.test(item.name)||item.size>15_000_000){error.value='Selecciona un SVG, PNG, JPEG o WebP de hasta 15 MB.';return}
  cancel();worker.result.value=undefined;file.value=item
}
function sample(){select([new File([example],'brujula.svg',{type:'image/svg+xml'})])}
function cancel(){
  current++;worker.cancel();vector.cancel();decoding.value=false;options=undefined
}
async function run(state:State){
  const image=file.value
  if(!image)return
  cancel();error.value='';worker.result.value=undefined
  const job=current
  if(image.type==='image/svg+xml'||/\.svg$/i.test(image.name)){
    if(image.size>2_000_000){error.value='El SVG no puede superar 2 MB.';return}
    options={...state};decoding.value=true
    try{
      const source=await image.text()
      if(job===current)vector.send({kind:'vector',source})
    }catch{if(job===current)error.value='No se pudo leer el SVG.'}
    finally{if(job===current)decoding.value=false}
  }else worker.send({file:image,options:{...state}})
}
function rasterize(source:VectorSource){
  const url=URL.createObjectURL(new Blob([source.raster],{type:'image/svg+xml'}))
  const image=new Image()
  image.src=url
  return image.decode().then(()=>new Promise<Blob>((resolve,reject)=>{
    const canvas=document.createElement('canvas')
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
    const ctx=canvas.getContext('2d')
    if(!ctx||!canvas.width||!canvas.height){reject(new Error('No se pudo dibujar el SVG.'));return}
    ctx.drawImage(image,0,0)
    canvas.toBlob(blob=>{if(blob)resolve(blob);else reject(new Error('No se pudo rasterizar el SVG.'))},'image/png')
  })).finally(()=>URL.revokeObjectURL(url))
}
watch(vector.result,async value=>{
  if(!value||!options)return
  if(!value.ok){error.value=value.error;return}
  const state=options,job=current
  decoding.value=true
  try{
    const png=await rasterize(value.vector)
    if(current===job)worker.send({file:png,vector:value.vector,options:state})
  }catch{if(current===job)error.value='No se pudo rasterizar el SVG saneado.'}
  finally{if(current===job)decoding.value=false}
})
function revoke(){for(const url of Object.values(preview.value))if(url)URL.revokeObjectURL(url)}
watch(result,value=>{
  revoke();preview.value={}
  if(!value)return
  const url=(name:string)=>value.files[name]?URL.createObjectURL(value.files[name]!):undefined
  preview.value={tab:url('icon-16.png'),apple:url('apple-touch-icon.png'),android:url('icon-192.png'),mask:url('icon-512-maskable.png')}
})
onScopeDispose(()=>{cancel();revoke()})
async function archive(){
  if(!result.value)return
  const files=Object.entries(result.value.files)
  const entries=await Promise.all(files.map(async ([name,blob])=>[name,new Uint8Array(await blob.arrayBuffer())] as const))
  downloadBlob(zipFiles(Object.fromEntries(entries)),'favicons-frontkit.zip')
}
function linkPreview(state:State){return {html:tags(state,result.value?.svg)}}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <FileDropZone label="Imagen de origen" accept=".svg,.png,.jpg,.jpeg,.webp" :disabled="busy" @choose="select" />
      <button type="button" class="btn" :disabled="busy" @click="sample">Usar SVG de ejemplo</button>
      <p v-if="file">Archivo seleccionado · {{file.name}}</p>
      <p v-if="!supported" role="status">Este navegador necesita Worker y OffscreenCanvas para generar iconos.</p>
      <div class="field-grid">
        <label v-for="(title,key) in label" :key="key">{{title}}<input type="text" :maxlength="limits[key]" :value="state[key]" @input="update(s=>{s[key]=val($event)},key)" /></label>
        <label>Modo de pantalla<select :value="state.display" @change="update(s=>{s.display=val($event) as State['display']})"><option v-for="mode in ['standalone','fullscreen','minimal-ui','browser']" :key="mode">{{mode}}</option></select></label>
      </div>
      <p>Ruta aplicada · {{basePath(state.basePath)}}</p>
      <div class="field-grid">
        <label v-for="(title,key) in color" :key="key">{{title}}<input type="color" :value="state[key]" @input="update(s=>{s[key]=val($event)},key)" /></label>
      </div>
      <RangeField label="Margen (%)" :model-value="state.padding" :min="0" :max="40" @update:model-value="update(s=>{s.padding=$event},'icon-padding')" />
      <label class="check"><input type="checkbox" :checked="state.maskable" @change="update(s=>{s.maskable=!s.maskable})" /> Incluir icono maskable</label>
      <label class="check"><input type="checkbox" :checked="state.darkSvg" @change="update(s=>{s.darkSvg=!s.darkSvg})" /> Fondo adaptable al tema para icon.svg</label>
      <div class="actions">
        <button type="button" class="btn primary" :disabled="!supported||!file||busy" @click="run(state)">Generar favicons</button>
        <button v-if="busy" type="button" class="btn" @click="cancel">Cancelar</button>
      </div>
      <label v-if="busy">Progreso de generación<progress :value="worker.progress.value" max="100" /></label>
      <p v-if="error || vector.failed.value || worker.failed.value || worker.result.value?.ok===false" role="alert">{{error || (worker.result.value?.ok===false?worker.result.value.error:'El generador no está disponible.')}}</p>
    </template>
    <template #preview="{state}">
      <div class="devices">
        <div class="tab-preview"><img v-if="preview.tab" :src="preview.tab" alt="" /> {{state.appName}}</div>
        <div v-if="result" class="device-grid">
          <figure><img :src="preview.apple" class="squircle" alt="" /><figcaption>iOS</figcaption></figure>
          <figure><img :src="preview.android" class="rounded" alt="" /><figcaption>Android</figcaption></figure>
          <template v-if="preview.mask">
            <figure><img :src="preview.mask" class="round" alt="" /><figcaption>Máscara circular</figcaption></figure>
            <figure><img :src="preview.mask" class="squircle" alt="" /><figcaption>Máscara squircle</figcaption></figure>
          </template>
        </div>
        <p v-if="result && result.width!==result.height">Origen no cuadrado. Se ha centrado con su proporción original.</p>
        <p v-if="result">Origen · {{Math.round(result.width)}} × {{Math.round(result.height)}}</p>
        <div v-if="result" class="actions">
          <button type="button" class="btn primary" @click="archive">Descargar paquete ZIP</button>
          <button v-for="(data,name) in result.files" :key="name" type="button" class="btn" @click="downloadBlob(data,String(name))">{{name}}</button>
        </div>
        <CodeOutputPanel name="etiquetas-favicon" :outputs="linkPreview(state)" />
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>.devices{width:100%;min-width:0;display:grid;gap:.75rem}.tab-preview{background:#e0eee7;color:#183329;padding:.6rem .8rem;border-radius:.6rem .6rem 0 0;display:flex;gap:.5rem;align-items:center}.tab-preview img{width:16px;height:16px}.device-grid{display:flex;flex-wrap:wrap;gap:.7rem}.device-grid figure{margin:0;text-align:center}.device-grid img{width:3.5rem;height:3.5rem;object-fit:contain;background:#e4eee9}.round{border-radius:50%}.rounded{border-radius:.6rem}.squircle{border-radius:26%}</style>
