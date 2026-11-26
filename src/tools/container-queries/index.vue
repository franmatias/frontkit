<script setup lang="ts">
import { ref } from 'vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { baseCsp, previewFragment, styleText } from '../../lib/html-sandbox'
import { active, baseRule, condition, cqUnits, css, directions, logic, preset, presets, testKinds, types, type State } from './logic'

const scopeSupported='CSSScopeRule' in window
const styleSupported='CSSContainerRule' in window && (()=>{try{const sheet=new CSSStyleSheet();sheet.insertRule('@container style(--dense: on){}');return true}catch{return false}})()
const setValue=(e:Event)=>(e.target as HTMLInputElement).value
const scopeInfo=ref<{ hits:number; closest:number|null; overlapping:number }[]>([])
const selectorOk=(selector:string)=> /^[^{}<>;@]*$/.test(selector)
let drag: {origin:number;width:number} | undefined
type Update=(fn:(s:State)=>void,key?:string)=>void
function resize(e:PointerEvent,state:State){
  drag={origin:e.clientX,width:state.width}
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
const clamp=(n:number)=>Math.min(1100,Math.max(220,Math.round(n)))
function move(e:PointerEvent,update:Update) {
  if(!drag)return
  const next=clamp(drag.width+e.clientX-drag.origin)
  update(s=>{s.width=next},'width')
}
const size=(e:KeyboardEvent,update:Update)=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return
  e.preventDefault()
  const delta=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?50:10)
  update(s=>{s.width=clamp(s.width+delta)},'width')
}
function prepareScope(state:State){
  const results:{hits:number;closest:number|null;overlapping:number}[]=[]
  const markup=previewFragment(state.markup,root=>{
    const matches=new Map<Element,{distance:number;index:number}[]>()
    for(const [index,rule] of state.scopes.entries()){
      const distances:number[]=[]
      try{
        for(const scope of root.querySelectorAll(rule.root)){
          const candidates=rule.selector.trim()===':scope'?[scope]:[...scope.querySelectorAll(rule.selector)]
          for(const node of candidates){
            const limit=rule.limit?node.closest(rule.limit):null
            if(limit&&scope.contains(limit))continue
            let distance=0
            for(let parent:Element|null=node;parent&&parent!==scope;parent=parent.parentElement)distance++
            distances.push(distance)
            const list=matches.get(node)??[]
            list.push({distance,index})
            matches.set(node,list)
          }
        }
      }catch{ /* Invalid draft selector. */ }
      results.push({hits:distances.length,closest:distances.length?Math.min(...distances):null,overlapping:0})
    }
    for(const [node,match] of matches){
      const sorted=[...match].sort((a,b)=>a.distance-b.distance||b.index-a.index)
      node.setAttribute('data-preview-hit',String(sorted[0].index+1))
      if(match.length>1)for(const row of match)results[row.index].overlapping++
    }
  })
  return {results,markup}
}
function refreshScope(state:State){scopeInfo.value=prepareScope(state).results}
function sample(state:State){
  const clean={...state,scopes:state.scopes.filter(row=>[row.root,row.limit,row.selector].every(selectorOk))}
  const code=styleText(css(clean))
  const markup=state.mode==='scope'?prepareScope(state).markup:
    '<section class="demo-container"><article class="query-card"><div class="sample-photo">Vista</div><div><h2>Componente adaptable</h2><p>La tarjeta responde al espacio de su contenedor.</p></div></article></section>'
  return '<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+baseCsp+
    '"><title>Consulta CSS</title><style>body{margin:0;padding:0;font:1rem system-ui;color:#1d332a;background:#edf5f0}.query-card{padding:.8rem;border:1px solid #6a9a80;border-radius:.5rem;background:#fff}.sample-photo{background:#2c6954;color:#fff;padding:1rem}.demo-container{height:'+state.height+'px}h2{font-size:1.1rem}p{margin:.4rem 0}[data-preview-hit]{outline:2px dashed #315b80;outline-offset:2px}.panel-demo{padding:1rem}.inner,.limit{padding:.45rem;border:1px solid #73988b}'+
    code+'</style><body>'+markup+'</body></html>'
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <label>Modo<select :value="state.mode" @change="update(d=>{d.mode=setValue($event) as State['mode']})"><option value="query">Container Queries</option><option value="scope">@scope</option></select></label>
      <template v-if="state.mode==='query'">
        <label>Plantilla<select @change="update(d=>Object.assign(d,preset(setValue($event) as typeof presets[number])))"><option value="" disabled selected>Elige un ejemplo</option><option v-for="item in presets" :key="item">{{item}}</option></select></label>
        <label>Nombre del contenedor<input type="text" maxlength="32" :value="state.name" @change="update(d=>{const v=setValue($event); if(/^(?:[a-z][\w-]{0,31})?$/.test(v))d.name=v})" /></label>
        <label>Tipo de contenedor<select :value="state.type" @change="update(d=>{d.type=setValue($event) as State['type']})"><option v-for="item in types" :key="item">{{item}}</option></select></label>
        <label class="check"><input type="checkbox" :checked="state.style" @change="update(d=>{d.style=($event.target as HTMLInputElement).checked})" />Activar propiedad para style()</label>
        <p v-if="!styleSupported">El navegador no acepta consultas de estilo. Esta opción es experimental.</p>
        <div v-for="(row,index) in state.rules" :key="index" class="rule">
          <label>Condición {{index+1}}<select :value="row.kind" @change="update(d=>{d.rules[index].kind=setValue($event) as typeof row.kind})"><option v-for="kind in testKinds" :key="kind">{{kind}}</option></select></label>
          <div class="field-grid">
            <label>Mínimo (px)<input type="number" min="0" max="1200" :value="row.min" @change="update(d=>{d.rules[index].min=Math.max(0,Math.min(1200,Math.round(Number(setValue($event)))||0))})" /></label>
            <label>Máximo (px)<input type="number" min="0" max="1200" :value="row.max" @change="update(d=>{d.rules[index].max=Math.max(0,Math.min(1200,Math.round(Number(setValue($event)))||0))})" /></label>
            <label>Dirección<select :value="row.dir" @change="update(d=>{d.rules[index].dir=setValue($event) as typeof row.dir})"><option v-for="item in directions" :key="item">{{item}}</option></select></label>
            <label>Fondo<input type="color" :value="row.color" @input="update(d=>{d.rules[index].color=setValue($event)},'bg'+index)" /></label>
          </div>
          <button type="button" class="btn" :disabled="state.rules.length<2" @click="update(d=>{d.rules.splice(index,1)})">Eliminar consulta</button>
        </div>
        <button type="button" class="btn" :disabled="state.rules.length>=6" @click="update(d=>{d.rules.push(baseRule())})">Añadir consulta</button>
        <RangeField label="Altura del contenedor (px)" :min="180" :max="480" :model-value="state.height" @update:model-value="update(d=>{d.height=$event},'height')" />
      </template>
      <template v-else>
        <p v-if="!scopeSupported" role="status">Tu navegador no aplica @scope. El contorno muestra las coincidencias calculadas.</p>
        <p>@scope limita reglas al interior de un ámbito. En conflictos de igual especificidad importa la proximidad al ámbito.</p>
        <label>HTML de muestra<textarea rows="4" maxlength="4000" :value="state.markup" @input="update(d=>{d.markup=setValue($event)},'html')" /></label>
        <div v-for="(row,index) in state.scopes" :key="index" class="rule">
          <label v-for="field in (['root','limit','selector'] as const)" :key="field">{{ {root:'Raíz',limit:'Límite',selector:'Selector'}[field] }} {{index+1}}
            <input type="text" maxlength="160" :value="row[field]" @change="update(d=>{const v=setValue($event);if(selectorOk(v))d.scopes[index][field]=v})" />
          </label>
          <label>Color del ámbito<input type="color" :value="row.color" @input="update(d=>{d.scopes[index].color=setValue($event)},'scope-bg'+index)" /></label>
          <button type="button" class="btn" :disabled="state.scopes.length<2" @click="update(d=>{d.scopes.splice(index,1)})">Eliminar ámbito</button>
        </div>
        <button type="button" class="btn" :disabled="state.scopes.length>=4" @click="update(d=>{d.scopes.push({root:'.inner',limit:'',selector:'.title',color:'#176442'})})">Añadir ámbito</button>
      </template>
    </template>
    <template #preview="{state,update}">
      <div class="layout-demo">
        <div class="scroll" v-if="state.mode==='query'">
          <div class="resizable" :style="{width:state.width+'px'}">
            <iframe sandbox="" title="Demostración CSS" :srcdoc="sample(state)" :style="{height:state.height+'px'}" />
            <button role="slider" type="button" class="handle" aria-label="Ancho de vista previa" aria-valuemin="220" aria-valuemax="1100" :aria-valuenow="state.width"
              @pointerdown="resize($event,state)" @pointermove="move($event,update)" @lostpointercapture="drag=undefined" @keydown="size($event,update)">↔</button>
          </div>
        </div>
        <iframe v-else sandbox="" title="Demostración CSS" :srcdoc="sample(state)" @load="refreshScope(state)" />
        <template v-if="state.mode==='query'">
          <p>{{state.width}} px · {{state.height}} px</p>
          <ul><li v-for="(row,i) in state.rules" :key="i">{{condition(row)}} · {{active(state,row)?'Activa':'Inactiva'}}</li></ul>
          <p v-if="state.type!=='size'">Las unidades del eje de bloque usan el viewport de muestra si falta un contenedor apto.</p>
          <p class="units"><span v-for="(value,name) in cqUnits(state.width,state.height)" :key="name">1 {{name}} = {{value.toFixed(2)}} px</span></p>
        </template>
        <p v-for="(info,index) in (state.mode==='scope'?scopeInfo:[])" :key="index">Ámbito {{index+1}} · {{info.hits}} coincidencias · proximidad {{info.closest??'—'}} · {{info.overlapping}} solapamientos</p>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>.rule{display:grid;gap:.45rem;border:1px solid var(--line);padding:.45rem;border-radius:.4rem}.layout-demo{width:100%;padding:.65rem;display:grid;gap:.6rem;min-width:0}.scroll{overflow:auto}.resizable{position:relative;margin-inline-end:1.6rem;max-width:none}.handle{position:absolute;inset-inline-start:100%;top:0;width:1.6rem;height:100%;border:1px solid var(--line);touch-action:none;cursor:ew-resize}iframe{display:block;width:100%;height:225px;border:1px solid var(--line);background:#fff}.units{display:flex;flex-wrap:wrap;gap:.45rem}.units span{padding:.18rem .4rem;background:var(--panel);border:1px solid var(--line)}</style>
