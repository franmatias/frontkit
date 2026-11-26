<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { read } from '../../core/storage/db'
import { useSettingsStore } from '../../stores/settings'
import FontRequest from './FontRequest.vue'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { logic as scaleLogic, steps } from '../type-scale/logic'
import { families, googleUrl, logic, lookup, select, stack, type State } from './logic'
const store=useSettingsStore()
const category=ref(''),subset=ref(''),scale=ref<ReturnType<typeof steps>>([])
const roles=['heading','body'] as const
const label={heading:'Titular',body:'Cuerpo'}
let stylesheet:HTMLLinkElement|undefined
const cssUrl=ref('')
watch([()=>store.googleFonts,cssUrl],([accepted,url])=>{
  stylesheet?.remove();stylesheet=undefined
  if(!accepted||!url)return
  stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=url;stylesheet.referrerPolicy='no-referrer'
  document.head.append(stylesheet)
})
onScopeDispose(()=>stylesheet?.remove())
function changed(s:State,role:typeof roles[number],name:string){
  s[role]=select(name,s[role])
}
function suggest(s:State,match:boolean,random=false){
  const pick=(items:typeof families)=>items[random?Math.floor(Math.random()*items.length):0]
  if(!s.lockHeading){
    const body=lookup(s.body.family)
    const options=families.filter(f=>f.family!==body.family&&!f.files&&(match?f.category===body.category:f.category!==body.category))
    const next=pick(options);if(next)changed(s,'heading',next.family)
  }
  if(!s.lockBody&&(s.lockHeading||random)){
    const header=lookup(s.heading.family)
    const next=pick(families.filter(f=>f.family!==header.family&&!f.files&&(match?f.category===header.category:f.category!==header.category)))
    if(next)changed(s,'body',next.family)
  }
}
async function loadScale(){
  const record=await read('toolStates','type-scale').catch(()=>undefined)
  try{scale.value=steps(record?scaleLogic.migrate(record.state,record.schemaVersion):scaleLogic.defaultState())}catch{scale.value=[]}
}
const val=(e:Event)=>(e.target as HTMLInputElement).value
const fontStyle=(s:State,role:typeof roles[number])=>({
  fontFamily:stack(s[role].family,store.googleFonts),fontWeight:s[role].weight,fontStyle:s[role].italic?'italic':'normal',
  fontSize:(role==='heading'?s.headingSize:s.bodySize)+'px',lineHeight:role==='heading'?1.15:s.lineHeight,
})
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <p>Al activar Google Fonts, Google recibe tu dirección IP. Puedes revocar el permiso en Configuración.</p>
      <button type="button" class="btn" :aria-pressed="store.googleFonts" @click="store.setGoogleFonts(!store.googleFonts)">{{store.googleFonts?'Desactivar Google Fonts':'Permitir Google Fonts'}}</button>
      <div class="field-grid"><label>Categoría<select v-model="category"><option value="">Todas</option><option>serif</option><option>sans-serif</option><option>monospace</option></select></label>
        <label>Subconjunto<select v-model="subset"><option value="">Todos</option><option>latin</option><option>latin-ext</option><option>cyrillic</option><option>greek</option></select></label>
      </div>
      <fieldset v-for="role in roles" :key="role"><legend>{{label[role]}}</legend>
        <label>Familia {{label[role].toLowerCase()}}<select :value="state[role].family" @change="update(s=>changed(s,role,val($event)))">
          <option v-for="font in families.filter(f=>f.family===state[role].family||(!category||f.category===category)&&(!subset||f.subsets.includes(subset)))" :key="font.family">{{font.family}}</option>
        </select></label>
        <label>Peso {{label[role].toLowerCase()}}<select :value="state[role].weight" @change="update(s=>{s[role].weight=Number(val($event))})">
          <option v-for="weight in lookup(state[role].family).weights" :key="weight">{{weight}}</option>
        </select></label>
        <label class="check"><input type="checkbox" :disabled="!lookup(state[role].family).italic" :checked="state[role].italic" @change="update(s=>{s[role].italic=!s[role].italic})" /> Cursiva</label>
        <p v-if="!lookup(state[role].family).italic">Esta familia carece de cursiva.</p>
        <label class="check"><input type="checkbox" :checked="state[role==='heading'?'lockHeading':'lockBody']" @change="update(s=>{const key=role==='heading'?'lockHeading':'lockBody';s[key]=!s[key]})" /> Bloquear {{label[role].toLowerCase()}}</label>
      </fieldset>
      <div class="actions">
        <button type="button" class="btn" @click="update(s=>suggest(s,false))">Contraste</button>
        <button type="button" class="btn" @click="update(s=>suggest(s,true))">Misma categoría</button>
        <button type="button" class="btn" @click="update(s=>suggest(s,false,true))">Pareja aleatoria</button>
        <button type="button" class="btn" @click="loadScale">Cargar escala tipográfica</button>
      </div>
      <label v-if="scale.length">Paso de titular<select @change="update(s=>{if(val($event))s.headingSize=Math.max(12,Math.min(72,Number(val($event))))})"><option value="">Elige un paso</option><option v-for="step in scale" :key="step.name" :value="step.start">{{step.name}} · {{step.start}} px</option></select></label>
      <RangeField label="Tamaño de titular" :model-value="state.headingSize" :min="12" :max="72" @update:model-value="update(s=>{s.headingSize=$event},'heading-size')" />
      <RangeField label="Tamaño de cuerpo" :model-value="state.bodySize" :min="10" :max="36" @update:model-value="update(s=>{s.bodySize=$event},'body-size')" />
      <RangeField label="Interlineado" :model-value="state.lineHeight" :min="1" :max="2.5" :step=".05" @update:model-value="update(s=>{s.lineHeight=$event},'leading')" />
      <label>Escena<select :value="state.scene" @change="update(s=>{s.scene=val($event) as State['scene']})"><option value="product-card">Tarjeta de producto</option><option value="login">Acceso</option><option value="nav">Navegación</option><option value="article">Artículo</option></select></label>
      <label class="check"><input type="checkbox" :checked="state.dark" @change="update(s=>{s.dark=!s.dark})" /> Vista oscura</label>
    </template>
    <template #preview="{state}">
      <FontRequest :url="googleUrl([state.heading,state.body])" @change="cssUrl=$event" />
      <div class="font-demo" :class="{dark:state.dark}" :style="fontStyle(state,'body')">
        <p v-if="!store.googleFonts"><small>Vista con fuentes del sistema</small></p>
        <template v-if="state.scene==='product-card'"><div class="art" /><h2 :style="fontStyle(state,'heading')">Edición de estudio</h2><p>Pieza de papel artesanal. Una libreta de bolsillo diseñada para las primeras ideas.</p><button type="button" class="btn">Ver producto</button></template>
        <template v-else-if="state.scene==='login'"><h2 :style="fontStyle(state,'heading')">Acceso al estudio</h2><label>Correo electrónico<input type="email" placeholder="hola@ejemplo.es" /></label><button class="btn" type="button">Entrar</button></template>
        <template v-else-if="state.scene==='nav'"><h2 :style="fontStyle(state,'heading')">Estudio norte</h2><nav aria-label="Navegación de muestra">Inicio · Proyectos · Contacto</nav></template>
        <template v-else><h2 :style="fontStyle(state,'heading')">La medida de las palabras</h2><p>La tipografía marca el ritmo de un texto. Cambiar el tamaño, el peso o el interlineado permite comparar cómo se lee la misma frase.</p></template>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>.font-demo{padding:1rem;border-radius:.75rem;background:#f4f0e6;color:#24332c;width:100%;overflow-wrap:anywhere}.font-demo.dark{background:#162d28;color:#fbf5db}.font-demo h2{font-size:inherit;margin:.6em 0 .3em}.font-demo .art{height:5rem;border-radius:.45rem;background:linear-gradient(137deg,#78b198,#274e4b 52%,#e4af56)}fieldset label{margin:.3rem 0}</style>
