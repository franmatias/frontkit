<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { receiveAnimation } from '../../core/storage/animation-handoff'
import { presets as easings } from '../animation/logic'
import { css, demos, logic, newRow, properties, transitionLists, triggers, type State } from './logic'

const route=useRoute(),router=useRouter()
const incoming=ref<Awaited<ReturnType<typeof receiveAnimation>>>()
const active=ref(false)
const track=ref<HTMLElement>()
const supported=CSS.supports('animation-timeline','scroll()')
watch(()=>route.query.handoff, async(id,_,cleanup)=>{
  let current=true
  cleanup(()=>{current=false})
  incoming.value=undefined
  const result=await receiveAnimation(id).catch(()=>undefined)
  if(current)incoming.value=result
},{immediate:true})
function accept(state:State){
  if(!incoming.value)return
  state.custom=incoming.value.css;state.customName=incoming.value.name;state.mode='scroll'
  const query={...route.query};delete query.handoff
  void router.replace({query})
}
const value=(e:Event)=>(e.target as HTMLInputElement).value
const selectFields={axis:['x','y'],enforce:['mandatory','proximity'],align:['start','center','end'],stop:['normal','always']} as const
const numeric={padding:'Relleno de scroll',margin:'Margen de ítem',gap:'Separación',count:'Número de tarjetas'}
const propertyLabel={axis:'Eje',enforce:'Ajuste',align:'Alineación',stop:'Parada'}
const easingKinds=['preset','bezier','steps','linear'] as const
const bezier={x1:[0,1],y1:[-.5,1.5],x2:[0,1],y2:[-.5,1.5]} as const
function scroll(state:State,direction:number){
  track.value?.scrollBy({left:state.axis==='x'?160*direction:0,top:state.axis==='y'?95*direction:0})
}
function scrollFrame(state:State){
  const style=css(state).replace(/<\/style/gi,'<\\/style')
  return '<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;"><title>Animación de scroll</title><style>'+style+
    'body{margin:0;background:#f1f7f3;color:#20352d;font:1rem system-ui} .sheet{height:100vh;overflow:auto;padding:0 1rem} p{margin:0;padding:2rem 0}.scroll-effect{background:#8ed2ac;padding:1rem;border-radius:.5rem}'+
    (state.demo==='progress'?'.scroll-effect{position:sticky;top:0;height:1rem;padding:0}':'')+'</style><body><section class="sheet" tabindex="0" aria-label="Área de desplazamiento"><p>Desplaza la muestra</p>'+
    (state.demo==='progress'?'<div class="scroll-effect"></div>':'')+'<p>Antes de la animación</p><p>Continúa desplazando</p>'+
    (state.demo==='progress'?'':'<div class="scroll-effect">Elemento animado</div>')+'<p>Después de la animación</p><p>Final de la muestra</p></section></body></html>'
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <label>Modo<select :value="state.mode" @change="update(d=>{d.mode=value($event) as State['mode']})">
        <option value="transition">Transiciones</option><option value="snap">Scroll snap</option><option value="scroll">Animación por scroll</option>
      </select></label>
      <button v-if="incoming" type="button" class="btn" @click="update(accept)">Importar fotogramas desde Animaciones</button>
      <template v-if="state.mode==='transition'">
        <label>Disparador<select :value="state.trigger" @change="update(d=>{d.trigger=value($event) as State['trigger']})"><option v-for="item in triggers" :key="item">{{item}}</option></select></label>
        <label class="check"><input type="checkbox" :checked="state.discrete" @change="update(d=>{d.discrete=($event.target as HTMLInputElement).checked})" />Permitir propiedades discretas</label>
        <details v-for="(row,index) in state.rows" :key="index" :open="index===0"><summary>{{row.prop}}</summary>
          <label>Propiedad<select :value="row.prop" @change="update(d=>{d.rows[index].prop=value($event) as typeof row.prop})"><option v-for="item in properties" :key="item">{{item}}</option></select></label>
          <RangeField label="Duración (ms)" :min="0" :max="5000" :model-value="row.duration" @update:model-value="update(d=>{d.rows[index].duration=$event},'duration'+index)" />
          <RangeField label="Retardo (ms)" :min="-1000" :max="5000" :model-value="row.delay" @update:model-value="update(d=>{d.rows[index].delay=$event},'delay'+index)" />
          <label>Función de ritmo<select :value="row.timing.kind" @change="update(d=>{d.rows[index].timing.kind=value($event) as typeof row.timing.kind})"><option v-for="kind in easingKinds" :key="kind">{{kind}}</option></select></label>
          <label v-if="row.timing.kind==='preset'">Preajuste<select :value="row.timing.preset" @change="update(d=>{d.rows[index].timing.preset=value($event) as typeof row.timing.preset})"><option v-for="preset in easings" :key="preset">{{preset}}</option></select></label>
          <template v-if="row.timing.kind==='bezier'"><RangeField v-for="(range,id) in bezier" :key="id" :label="id" :min="range[0]" :max="range[1]" :step=".01" :model-value="row.timing[id]" @update:model-value="update(d=>{d.rows[index].timing[id]=$event},id+index)" /></template>
          <RangeField v-if="row.timing.kind==='steps'" label="Pasos" :min="1" :max="24" :model-value="row.timing.steps" @update:model-value="update(d=>{d.rows[index].timing.steps=$event},'steps'+index)" />
          <RangeField v-if="row.timing.kind==='linear'" label="Amortiguación" :min="1" :max="45" :model-value="row.timing.damping" @update:model-value="update(d=>{d.rows[index].timing.damping=$event},'linear'+index)" />
          <button type="button" class="btn" :disabled="state.rows.length<=1" @click="update(d=>{d.rows.splice(index,1)})">Eliminar transición</button>
        </details>
        <button type="button" class="btn" :disabled="state.rows.length>=5" @click="update(d=>{d.rows.push(newRow('background-color'))})">Añadir transición</button>
      </template>
      <template v-else-if="state.mode==='snap'">
        <label v-for="(choices,field) in selectFields" :key="field">{{propertyLabel[field]}}<select :value="state[field]" @change="update(d=>Object.assign(d,{[field]:value($event)}))"><option v-for="item in choices" :key="item">{{item}}</option></select></label>
        <RangeField v-for="(label,field) in numeric" :key="field" :label="label" :min="field==='count'?2:0" :max="field==='count'?10:field==='gap'?48:64" :model-value="state[field]"
          @update:model-value="update(d=>{d[field]=$event},field)" />
        <p>El carrusel admite teclado y botones de avance. También puedes arrastrar su barra de desplazamiento.</p>
      </template>
      <template v-else>
        <p v-if="!supported" role="status">El navegador usará el respaldo sin animación.</p>
        <label>Ejemplo<select :value="state.demo" @change="update(d=>{d.demo=value($event) as State['demo']; d.timeline=d.demo==='reveal'?'view':'scroll'})"><option v-for="item in demos" :key="item">{{item}}</option></select></label>
        <label>Línea de tiempo<select :value="state.timeline" @change="update(d=>{d.timeline=value($event) as State['timeline']})"><option>view</option><option>scroll</option></select></label>
        <RangeField label="Inicio del rango (%)" :min="0" :max="100" :model-value="state.start" @update:model-value="update(d=>{d.start=$event},'range-start')" />
        <RangeField label="Fin del rango (%)" :min="0" :max="100" :model-value="state.end" @update:model-value="update(d=>{d.end=$event},'range-end')" />
        <button v-if="state.customName" type="button" class="btn" @click="update(d=>{d.custom='';d.customName=''})">Volver a los fotogramas del ejemplo</button>
      </template>
    </template>
    <template #preview="{state}">
      <div class="work">
        <button v-if="state.mode==='transition'" type="button" class="motion btn" :data-trigger="state.trigger"
          :class="{on:active&&(state.trigger==='click'||state.trigger==='class')}" :style="{transitionProperty:transitionLists(state).props,transitionDuration:transitionLists(state).duration,transitionDelay:transitionLists(state).delay,transitionTimingFunction:transitionLists(state).timing}"
          @click="active=!active">Probar transición</button>
        <template v-else-if="state.mode==='snap'">
          <div class="actions"><button class="btn" type="button" @click="scroll(state,-1)">Anterior</button><button class="btn" type="button" @click="scroll(state,1)">Siguiente</button></div>
          <div ref="track" tabindex="0" aria-label="Carrusel" class="track" :style="{scrollSnapType:state.axis+' '+state.enforce,gridAutoFlow:state.axis==='x'?'column':'row',gap:state.gap+'px',scrollPadding:state.padding+'px'}">
            <div v-for="i in state.count" :key="i" :style="{scrollSnapAlign:state.align,scrollSnapStop:state.stop,scrollMargin:state.margin+'px'}">{{i}}</div>
          </div>
        </template>
        <iframe v-else title="Animación al desplazar" sandbox="" :srcdoc="scrollFrame(state)" />
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.work{width:100%;min-width:0;padding:.65rem;display:grid;gap:.5rem}.motion{justify-self:center;padding:1.5rem}.motion[data-trigger="hover"]:hover,.motion[data-trigger="focus"]:focus-visible,.motion.on{transform:translateY(-.4rem) scale(1.03);opacity:.65;background:#b3e3d2;border-radius:1rem}.track{display:grid;grid-auto-columns:minmax(7rem,40%);max-height:13rem;overflow:auto}.track div{display:grid;place-items:center;min-height:5rem;background:#d6ede1;border-radius:.6rem;color:#163728}iframe{height:220px;width:100%;border:1px solid var(--line)}@media(prefers-reduced-motion:reduce){.motion{transition:none!important}}
</style>
