<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import PointCanvas from '../../components/shared/PointCanvas.vue'
import { addEdge, clip, logic, mirrors, moved, shapes, template, templates, type State } from './logic'
const photo = ref('')
const target = ref('sample')
const fields = { top:'Arriba',right:'Derecha',bottom:'Abajo',left:'Izquierda',radius:'Redondeo',x:'Centro horizontal',y:'Centro vertical',rx:'Radio horizontal',ry:'Radio vertical' }
const polygonFields = ['x','y'] as const
const otherFields = { inset:['top','right','bottom','left','radius'],circle:['x','y','rx'],ellipse:['x','y','rx','ry'] } as const
function local(event:Event) {
  const file=(event.target as HTMLInputElement).files?.[0]
  if (!file || !/^image\/(png|jpeg|webp|avif|gif)$/.test(file.type) || file.size>10_000_000) return
  if(photo.value) URL.revokeObjectURL(photo.value)
  photo.value=URL.createObjectURL(file);target.value='local'
}
onScopeDispose(()=>{if(photo.value) URL.revokeObjectURL(photo.value)})
function convert(state:State, unit:State['unit']){
  if(state.unit===unit)return
  const ratio=unit==='px'?3:1/3
  state.unit=unit
  state.points=state.points.map(({x,y})=>({x:x*ratio,y:y*ratio}))
  for(const key of Object.keys(fields) as (keyof typeof fields)[])state[key]*=ratio
}
const stage = (s:State, point:{x:number;y:number}) => {
  const ratio=s.unit==='px'?3:1
  const x=s.mirror==='h'||s.mirror==='both'?100-point.x:point.x
  const y=s.mirror==='v'||s.mirror==='both'?100-point.y:point.y
  return {x:moved(s,x*ratio),y:moved(s,y*ratio)}
}
const handles = (s:State) => s.points.map(({x,y})=>{
  const ratio=s.unit==='px'?3:1
  return {x:s.mirror==='h'||s.mirror==='both'?100-x/ratio:x/ratio,y:s.mirror==='v'||s.mirror==='both'?100-y/ratio:y/ratio}
})
const val=(event:Event)=>(event.target as HTMLInputElement).value
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <label>Forma<select :value="state.shape" @change="update(s=>{s.shape=val($event) as State['shape']})"><option v-for="shape in shapes" :key="shape">{{shape}}</option></select></label>
      <label>Unidad<select :value="state.unit" @change="update(s=>convert(s,val($event) as State['unit']))"><option>%</option><option>px</option></select></label>
      <p v-if="state.unit==='px'" role="status">Los píxeles fijan el recorte a medidas absolutas.</p>
      <label>Muestra<select v-model="target"><option value="sample">Degradado</option><option value="box">Caja de color</option><option v-if="photo" value="local">Imagen local</option></select></label>
      <label>Imagen local<input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" @change="local" /></label>
      <template v-if="state.shape==='polygon'">
        <label>Plantilla<select value="" @change="update(s=>{s.points=template(val($event) as keyof typeof templates,s.unit)})"><option value="" disabled>Elige una plantilla</option><option v-for="(_,name) in templates" :key="name">{{name}}</option></select></label>
        <label>Ajuste a rejilla<select :value="state.snap" @change="update(s=>{s.snap=Number(val($event)) as State['snap']})"><option v-for="n in [0,1,5,10]" :key="n" :value="n">{{n || 'Sin ajuste'}}</option></select></label>
        <label>Espejo<select :value="state.mirror" @change="update(s=>{s.mirror=val($event) as State['mirror']})"><option v-for="mode in mirrors" :key="mode" :value="mode">{{{none:'Sin espejo',h:'Horizontal',v:'Vertical',both:'Ambos'}[mode]}}</option></select></label>
        <label class="check"><input type="checkbox" :checked="state.grid" @change="update(s=>{s.grid=!s.grid})" /> Mostrar rejilla</label>
        <p>Pulsa junto a una arista para añadir un vértice. Usa las flechas para moverlo y Supr para eliminarlo.</p>
        <div v-for="(point,i) in state.points" :key="i" class="field-grid">
          <label v-for="key in polygonFields" :key="key">Vértice {{i+1}} {{key.toUpperCase()}}<input type="number" min="0" :max="state.unit==='px'?300:100" :value="point[key]" @change="update(s=>{s.points[i]![key]=moved(s,Number(val($event)))})" /></label>
          <button type="button" class="btn" :disabled="state.points.length<=3" @click="update(s=>{s.points.splice(i,1)})">Eliminar vértice {{i+1}}</button>
        </div>
      </template>
      <label v-for="key in state.shape==='polygon'?[]:otherFields[state.shape]" :key="key">{{fields[key]}}<input type="number" min="0" :max="state.unit==='px'?300:100" :value="state[key]" @change="update(s=>{s[key]=moved(s,Number(val($event)))})" /></label>
    </template>
    <template #preview="{state,update}">
      <PointCanvas label="Lienzo de recorte" :points="state.shape==='polygon'?handles(state):[]" :grid="state.grid"
        @move="(i,p)=>update(s=>{s.points[i]=stage(s,p)},'vertex-'+i)"
        @edge="p=>{if(state.shape==='polygon')update(s=>{addEdge(s,stage(s,p))})}"
        @remove="i=>{if(state.points.length>3)update(s=>{s.points.splice(i,1)})}">
        <div class="sample" :class="{ solid:target==='box' }" :style="{clipPath:clip(state)}"><img v-if="target==='local' && photo" :src="photo" alt="Imagen recortada" /></div>
      </PointCanvas>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.sample{position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,#17475a,#1d9577 56%,#f1bb48);}
.sample.solid{background:#1c795e}.sample img{width:100%;height:100%;object-fit:cover}
</style>
