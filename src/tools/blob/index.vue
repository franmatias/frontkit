<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import { useRouter } from 'vue-router'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import OrganicRadiusEditor from '../../components/shared/OrganicRadiusEditor.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { sendBlob } from '../../core/storage/blob-handoff'
import { changeRadius, factor, fill, logic, normalised, radius, randomRadii, symmetry, type State } from './logic'
const axes=['horizontal','vertical'] as const
const corners=['superior izquierda','superior derecha','inferior derecha','inferior izquierda']
const phase=ref<'radii'|'target'>('radii'), photo=ref(''), error=ref('')
const router=useRouter()
const val=(e:Event)=>(e.target as HTMLInputElement).value
function input(e:Event){
  const file=(e.target as HTMLInputElement).files?.[0]
  if(!file || !/^image\/(png|webp|jpeg|avif|gif)$/.test(file.type)||file.size>10_000_000)return
  if(photo.value)URL.revokeObjectURL(photo.value)
  photo.value=URL.createObjectURL(file)
}
onScopeDispose(()=>{if(photo.value)URL.revokeObjectURL(photo.value)})
async function transfer(s:State){
  try{await router.push({name:'animation',query:{handoff:await sendBlob(s.radii,s.target)}})}
  catch{error.value='No se pudo enviar la forma.'}
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <label>Simetría<select :value="state.symmetry" @change="update(s=>{s.symmetry=val($event) as State['symmetry']})"><option v-for="id in symmetry" :key="id" :value="id">{{{none:'Ninguna',horizontal:'Horizontal',vertical:'Vertical',both:'Ambas'}[id]}}</option></select></label>
      <div class="field-grid">
        <label>Semilla<input type="text" :value="state.seed" maxlength="50" @input="update(s=>{s.seed=val($event)},'seed')" /></label>
        <RangeField label="Complejidad" :model-value="state.complexity" :min="0" :max="100" @update:model-value="update(s=>{s.complexity=$event},'complexity')" />
      </div>
      <div class="actions">
        <button type="button" class="btn" @click="update(s=>{s[phase]=randomRadii(s.seed,s.complexity,s.symmetry)})">Generar con semilla</button>
        <button type="button" class="btn" @click="update(s=>{s.complexity=Math.max(0,s.complexity-15);s[phase]=randomRadii(s.seed,s.complexity,s.symmetry)})">Suavizar</button>
        <button type="button" class="btn" @click="update(s=>{s.complexity=Math.min(100,s.complexity+15);s[phase]=randomRadii(s.seed,s.complexity,s.symmetry)})">Más irregular</button>
      </div>
      <label>Relleno<select :value="state.fill" @change="update(s=>{s.fill=val($event) as State['fill']})"><option value="color">Color</option><option value="gradient">Degradado</option><option value="image">Imagen local</option></select></label>
      <label>Color principal<input type="color" :value="state.color" @input="update(s=>{s.color=val($event)},'blob-color')" /></label>
      <label v-if="state.fill==='gradient'">Segundo color<input type="color" :value="state.second" @input="update(s=>{s.second=val($event)},'blob-second')" /></label>
      <label v-if="state.fill==='image'">Imagen del relleno<input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" @change="input" /></label>
      <RangeField label="Tamaño SVG y clip-path (px)" :model-value="state.size" :min="120" :max="320" @update:model-value="update(s=>{s.size=$event},'blob-size')" />
      <label>Editar forma<select v-model="phase"><option value="radii">Inicio</option><option value="target">Destino</option></select></label>
      <div v-for="axis in axes" :key="axis" class="field-grid">
        <label v-for="(name,i) in corners" :key="name">Radio {{axis}} {{name}} (%)<input type="number" min="0" max="100" :value="state[phase][axis][i]"
          @change="update(s=>changeRadius(s[phase],axis,i,Math.max(0,Math.min(100,Number(val($event))||0)),s.symmetry))" /></label>
      </div>
      <label class="check"><input type="checkbox" :checked="state.animate" @change="update(s=>{s.animate=!s.animate})" /> Mostrar morph y generar animación CSS</label>
      <button type="button" class="btn" @click="transfer(state)">Enviar a Animaciones CSS</button>
      <p v-if="error" role="alert">{{error}}</p>
    </template>
    <template #preview="{state,update}">
      <div class="blob-stage" :style="{maxWidth:state.size+'px'}">
        <OrganicRadiusEditor :radii="state[phase]" @change="(axis,i,n)=>update(s=>changeRadius(s[phase],axis,i,n,s.symmetry),axis+'-'+i)">
          <div class="blob-sample" :class="{morph:state.animate}" :style="{background:fill(state),borderRadius:radius(normalised(state[phase])),'--from':radius(state.radii),'--to':radius(state.target)}">
            <img v-if="state.fill==='image'&&photo" :src="photo" alt="Relleno de la forma" />
          </div>
        </OrganicRadiusEditor>
      </div>
      <p v-if="factor(state[phase])<1">Radios reducidos ×{{factor(state[phase]).toFixed(2)}}</p>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.blob-stage{width:100%}.blob-sample{position:absolute;inset:0;pointer-events:none;overflow:hidden}.blob-sample img{width:100%;height:100%;object-fit:cover}.morph{animation:blob-shape 2.4s ease-in-out infinite alternate}
@keyframes blob-shape{from{border-radius:var(--from)}to{border-radius:var(--to)}}@media(prefers-reduced-motion:reduce){.morph{animation:none}}
</style>
