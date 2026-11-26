<script setup lang="ts">
import { watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { converter, formatHex } from 'culori'
import { receivePalette } from '../../core/storage/palette-handoff'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import PointCanvas from '../../components/shared/PointCanvas.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { defaults, logic, patterns, style, svg, type State } from './logic'
const route=useRoute(), router=useRouter()
const pending=ref<Awaited<ReturnType<typeof receivePalette>>>()
const error=ref('')
watch(()=>route.query.handoff,async(id,_,cleanup)=>{
  let active=true;cleanup(()=>{active=false});pending.value=undefined
  const data=await receivePalette('backgrounds',id).catch(()=>undefined)
  if(active)pending.value=data
},{immediate:true})
function usePalette(s:State){
  const colors=pending.value
  if(!colors)return
  s.points=colors.slice(0,8).map((item,i)=>({...defaults().points[i%3]!,x:(21+i*39)%87,y:(22+i*29)%84,color:item.color}))
  pending.value=undefined
  void router.replace({query:{}})
}
function harmony(s:State){
  const hue=Math.round(Math.random()*360)
  s.points=s.points.map((p,i)=>({...p,color:formatHex(converter('rgb')({mode:'oklch',l:.72,c:.14,h:(hue+i*108)%360}))??p.color}))
}
function save(blob:Blob,name:string){
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url;link.download=name;link.click()
  setTimeout(()=>URL.revokeObjectURL(url),500)
}
async function png(s:State){
  error.value=''
  try{
    const image=await createImageBitmap(new Blob([svg(s).replace('viewBox=','width="400" height="300" viewBox=')],{type:'image/svg+xml'}))
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600
    canvas.getContext('2d')?.drawImage(image,0,0,800,600);image.close()
    canvas.toBlob(blob=>{if(blob)save(blob,'fondo.png')})
  }catch{error.value='No se pudo exportar el PNG.'}
}
const val=(e:Event)=>(e.target as HTMLInputElement).value
const size={scale:[8,120,'Escala (px)'],thickness:[1,12,'Grosor (px)'],opacity:[0,100,'Opacidad (%)'],rotate:[0,360,'Rotación (°)']} as const
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <button v-if="pending" type="button" class="btn" @click="update(usePalette)">Importar colores enviados</button>
      <label>Modo<select :value="state.mode" @change="update(s=>{s.mode=val($event) as State['mode']})"><option value="mesh">Malla de color</option><option value="pattern">Patrón</option></select></label>
      <label>Color de fondo<input type="color" :value="state.base" @input="update(s=>{s.base=val($event)},'bg')" /></label>
      <template v-if="state.mode==='mesh'">
        <div class="actions">
          <button class="btn" type="button" :disabled="state.points.length>=12" @click="update(s=>{s.points.push({x:50,y:50,color:'#d0507e',size:45,opacity:90})})">Añadir foco</button>
          <button class="btn" type="button" @click="update(harmony)">Colores armónicos OKLCH</button>
        </div>
        <details v-for="(point,i) in state.points" :key="i">
          <summary>Foco {{i+1}}</summary>
          <label>Color del foco {{i+1}}<input type="color" :value="point.color" @input="update(s=>{s.points[i]!.color=val($event)},'focus-'+i)" /></label>
          <RangeField v-for="key in (['x','y','size','opacity'] as const)" :key="key" :label="({x:'X',y:'Y',size:'Tamaño',opacity:'Opacidad'})[key]+' · '+(i+1)" :model-value="point[key]" :min="key==='size'?5:0" :max="100" @update:model-value="update(s=>{s.points[i]![key]=$event},key+i)" />
          <button type="button" class="btn" :disabled="state.points.length===1" @click="update(s=>{s.points.splice(i,1)})">Eliminar foco {{i+1}}</button>
        </details>
        <RangeField label="Desenfoque SVG" :model-value="state.blur" :min="0" :max="32" @update:model-value="update(s=>{s.blur=$event},'blur')" />
        <RangeField label="Grano SVG" :model-value="state.grain" :min="0" :max="100" @update:model-value="update(s=>{s.grain=$event},'grain')" />
        <p v-if="state.blur && state.points.length>6">Muchas capas desenfocadas pueden ralentizar la vista.</p>
      </template>
      <template v-else>
        <label>Patrón<select :value="state.pattern" @change="update(s=>{s.pattern=val($event) as State['pattern']})"><option v-for="item in patterns" :key="item">{{item}}</option></select></label>
        <label>Color del patrón<input type="color" :value="state.color" @input="update(s=>{s.color=val($event)},'pattern-color')" /></label>
        <RangeField v-for="([min,max,label],key) in size" :key="key" :label="label" :model-value="state[key]" :min="min" :max="max" @update:model-value="update(s=>{s[key]=$event},key)" />
      </template>
      <label>Codificación SVG<select :value="state.encoding" @change="update(s=>{s.encoding=val($event) as State['encoding']})"><option value="url">URL-encoded</option><option value="base64">Base64</option></select></label>
      <p v-if="style(state).backgroundImage.startsWith('url')&&style(state).backgroundImage.length>4096">El data URI supera los 4 KB.</p>
      <button type="button" class="btn" @click="png(state)">Exportar PNG</button>
      <p v-if="error" role="alert">{{error}}</p>
    </template>
    <template #preview="{state,update}">
      <PointCanvas label="Lienzo de fondo" :points="state.mode==='mesh'?state.points:[]" @move="(i,p)=>update(s=>Object.assign(s.points[i]!,p),'mesh-'+i)">
        <div class="surface" :style="style(state)" />
      </PointCanvas>
    </template>
  </ToolWorkspace>
</template>
<style scoped>.surface{position:absolute;inset:0;pointer-events:none}details:not([open]){padding:.3rem 0}details label{margin-block:.4rem}</style>
