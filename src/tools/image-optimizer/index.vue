<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import CodeOutputPanel from '../../components/shared/CodeOutputPanel.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { useWorker } from '../../composables/useWorker'
import { defaults, formats, logic, picture, type State, type Format, type Optimised } from './logic'
import type { Job, Result } from './optimise.worker'

const files=shallowRef<File[]>([])
const done=shallowRef(new Map<number,Optimised>())
const warnings=ref('')
const selected=ref(0)
const process=ref(-1)
const queue=shallowRef<{ indices:number[]; options:State }>()
const ratio=ref(50)
const accepted=ref(false)
const left=ref('')
const right=ref('')
const active=useWorker<Job,Result>(()=>new Worker(new URL('./optimise.worker.ts',import.meta.url),{type:'module'}))
const ready='OffscreenCanvas' in window && 'Worker' in window
const result=computed(()=>done.value.get(selected.value))
const image=computed(()=>files.value[selected.value])
const variant=computed(()=>result.value?.variants.at(-1))
const needsCodec=(s:State)=>{
  const kinds=s.responsive?s.formats:[s.format]
  return kinds.includes('avif')||s.optimised&&(kinds.includes('jpeg')||kinds.includes('png'))
}
function reset(){
  active.cancel()
  queue.value=undefined
  done.value=new Map()
  process.value=-1
}
function choose(list:FileList|null){
  const picked=Array.from(list??[])
  if(picked.length>30||picked.reduce((total,file)=>total+file.size,0)>100_000_000){
    warnings.value='Selecciona hasta 30 archivos y 100 MB en total.'
    return
  }
  reset()
  selected.value=0
  files.value=picked.filter(file=>/^image\/(?:avif|webp|png|jpeg)$/i.test(file.type))
  warnings.value=files.value.length!==picked.length?'Se omitieron formatos distintos de PNG, JPEG, WebP y AVIF.':''
}
function advance(){
  const current=queue.value,index=current?.indices.shift()
  if(current&&index!==undefined){
    process.value=index
    active.send({file:files.value[index],options:current.options})
  }else resetQueue()
}
function resetQueue(){queue.value=undefined;process.value=-1}
function start(state:State,all:boolean){
  warnings.value=''
  queue.value={indices:all?files.value.map((_,i)=>i):[selected.value],options:structuredClone(state)}
  advance()
}
watch(active.result,output=>{
  if(!output)return
  if('error' in output)warnings.value=output.error
  else done.value=new Map(done.value).set(process.value,output)
  advance()
})
watch(active.failed,failed=>{if(failed){warnings.value='No se pudo iniciar el worker.';resetQueue()}})
function skip(){
  active.cancel()
  advance()
}
function revoke(){if(left.value)URL.revokeObjectURL(left.value);if(right.value)URL.revokeObjectURL(right.value)}
watch([image,variant],()=>{revoke();left.value=image.value?URL.createObjectURL(image.value):'';right.value=variant.value?URL.createObjectURL(variant.value.blob):''})
onScopeDispose(revoke)
function save(file:Blob,name:string){
  const url=URL.createObjectURL(file),link=document.createElement('a')
  link.href=url;link.download=name;link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
async function archive(state:State){
  if(!done.value.size)return
  const { strToU8,zipSync }=await import('fflate')
  const entries:Record<string,Uint8Array>={}
  for(const [i,output] of done.value){
    for(const row of output.variants)entries[(i+1)+'/'+row.file]=new Uint8Array(await row.blob.arrayBuffer())
    entries[(i+1)+'/picture.html']=strToU8(picture(output,state))
  }
  const zip=zipSync(entries,{level:0})
  save(new Blob([new Uint8Array(zip)],{type:'application/zip'}),'frontkit-imagenes.zip')
}
const value=(e:Event)=>(e.target as HTMLInputElement).value
function setFormat(state:State,format:Format){
  state.formats=state.formats.includes(format)?state.formats.length>1?state.formats.filter(item=>item!==format):state.formats:[...state.formats,format]
}
const byte=(x:number)=>new Intl.NumberFormat('es',{maximumFractionDigits:1}).format(x/1024)+' kB'
const bounds={width:'Ancho máximo',height:'Alto máximo'}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <p v-if="!ready" role="status">Este navegador necesita Worker y OffscreenCanvas para recodificar.</p>
      <label>Archivos de imagen<input type="file" accept="image/png,image/jpeg,image/avif,image/webp,.svg" multiple :disabled="Boolean(queue)" @change="choose(($event.target as HTMLInputElement).files)" /></label>
      <RouterLink :to="{name:'svg-optimizer'}">Abrir optimizador SVG</RouterLink>
      <label v-if="files.length">Imagen seleccionada<select v-model.number="selected"><option v-for="(file,i) in files" :key="i" :value="i">{{file.name}}</option></select></label>
      <label>Formato de salida<select :value="state.format" @change="update(d=>{d.format=value($event) as Format})"><option v-for="id in formats" :key="id">{{id}}</option></select></label>
      <RangeField :label="state.format==='png'?'Nivel PNG':'Calidad del formato'" :min="state.format==='png'?0:1" :max="state.format==='png'?6:100"
        :model-value="state[state.format]" @update:model-value="update(d=>{d[state.format]=$event},'quality')" />
      <label class="check"><input type="checkbox" :checked="state.optimised" @change="update(d=>{d.optimised=($event.target as HTMLInputElement).checked})" />Codificador optimizado JPEG / PNG</label>
      <p>La recodificación aplica la orientación y descarta los metadatos de origen, incluido el GPS.</p>
      <label class="check"><input type="checkbox" :checked="state.keepIcc" @change="update(d=>{d.keepIcc=($event.target as HTMLInputElement).checked})" />Conservar perfil ICC RGB</label>
      <p v-if="state.keepIcc">Disponible en PNG, JPEG y WebP con perfiles RGB compatibles. Las variantes AVIF se recodifican con la gestión de color del navegador.</p>
      <div class="field-grid">
        <label v-for="(label,field) in bounds" :key="field">{{label}}<input type="number" min="0" max="8192" :value="state[field]" @change="update(d=>{d[field]=Math.round(Math.max(0,Math.min(8192,Number(value($event))||0)))})" /></label>
      </div>
      <label class="check"><input type="checkbox" :checked="state.lockAspect" @change="update(d=>{d.lockAspect=($event.target as HTMLInputElement).checked})" />Mantener proporciones</label>
      <label v-if="!state.lockAspect">Ajuste<select :value="state.fit" @change="update(d=>{d.fit=value($event) as State['fit']})"><option value="contain">Contener</option><option value="cover">Cubrir</option></select></label>
      <button type="button" class="btn" :disabled="Boolean(queue)" @click="update(d=>Object.assign(d,defaults()))">Restablecer opciones</button>
      <label class="check"><input type="checkbox" :checked="state.responsive" @change="update(d=>{d.responsive=($event.target as HTMLInputElement).checked})" />Generar conjunto responsivo</label>
      <template v-if="state.responsive">
        <label>Anchos separados por comas<input type="text" maxlength="80" :value="state.widths" @input="update(d=>{d.widths=value($event)},'widths')" /></label>
        <label v-for="format in formats" :key="format" class="check"><input type="checkbox" :checked="state.formats.includes(format)" @change="update(d=>setFormat(d,format))" />{{format}}</label>
      </template>
      <label>Marcador de posición<select :value="state.placeholder" @change="update(d=>{d.placeholder=value($event) as State['placeholder']})"><option value="none">Ninguno</option><option value="dominant">Color dominante</option><option value="tiny">Miniatura en línea</option></select></label>
      <label>Texto alternativo<input type="text" maxlength="200" :value="state.alt" @input="update(d=>{d.alt=value($event)},'alt')" /></label>
      <label>sizes<input type="text" maxlength="240" :value="state.sizes" @input="update(d=>{d.sizes=value($event)},'sizes')" /></label>
      <p v-if="needsCodec(state)">El formato seleccionado puede cargar un códec WebAssembly al empezar (AVIF ronda 0,92 MB comprimidos).</p>
      <label v-if="needsCodec(state)" class="check"><input v-model="accepted" type="checkbox" />Cargar códec al convertir</label>
      <div class="actions">
        <button type="button" class="btn primary" :disabled="!ready||!image||Boolean(queue)||needsCodec(state)&&!accepted" @click="start(state,false)">Optimizar imagen</button>
        <button type="button" class="btn" :disabled="!ready||!files.length||Boolean(queue)||needsCodec(state)&&!accepted" @click="start(state,true)">Optimizar lote</button>
        <button v-if="queue" type="button" class="btn" @click="skip">Cancelar imagen actual</button>
      </div>
      <label v-if="queue">Progreso de {{files[process]?.name}}<progress :value="active.progress.value" max="100" /></label>
      <p v-if="warnings" role="alert">{{warnings}}</p>
    </template>
    <template #preview="{state}">
      <div class="compare">
        <div v-if="left" class="viewport">
          <img :src="left" alt="Imagen de origen" />
          <img v-if="right" :src="right" alt="Imagen recodificada" :style="{clipPath:'inset(0 '+(100-ratio)+'% 0 0)'}" />
        </div>
        <RangeField v-if="right" label="Divisor antes/después" :min="0" :max="100" v-model="ratio" />
        <p v-if="image">Original: {{byte(image.size)}} <template v-if="result">{{result.original.width}} × {{result.original.height}}</template></p>
        <p v-if="variant && image">Resultado: {{byte(variant.blob.size)}} · {{variant.width}} × {{variant.height}} · Ahorro {{Math.round((1-variant.blob.size/image.size)*100)}} %</p>
        <p v-if="result?.iccRequested" role="status">Perfil ICC conservado en {{result.variants.filter(row=>row.icc).length}} de {{result.variants.length}} variantes.</p>
        <div v-if="result" class="actions"><button v-for="row in result.variants" :key="row.file" type="button" class="btn" @click="save(row.blob,row.file)">{{row.file}}</button></div>
        <button v-if="done.size" type="button" class="btn" @click="archive(state)">Descargar ZIP de resultados</button>
        <CodeOutputPanel v-if="result" name="imagen" :outputs="{html:picture(result,state),tailwind:'block h-auto max-w-full'}" />
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>.compare{display:grid;gap:.65rem;width:100%;min-width:0;padding:.6rem}.viewport{position:relative;display:grid;min-height:7rem;aspect-ratio:3/2;background:#ecf2ed;overflow:hidden}.viewport img{grid-area:1/1;width:100%;height:100%;object-fit:contain}.compare p{overflow-wrap:anywhere}</style>
