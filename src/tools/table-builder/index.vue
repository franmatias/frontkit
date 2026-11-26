<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute,useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { receiveTableDraft } from '../../core/storage/table-handoff'
import { useWorker } from '../../composables/useWorker'
import type { Generation } from '../mock-data/generator'
import { logic as mockLogic, type State as Recipe } from '../mock-data/logic'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import RangeField from '../../components/shared/RangeField.vue'
import { css,html,logic,makeColumn,modes,parseGrid,replaceRows,sortCode,type State } from './logic'
const route=useRoute(),router=useRouter(),{t}=useI18n()
const incoming=ref<Awaited<ReturnType<typeof receiveTableDraft>>>(), importRows=ref<{headers:string[];values:string[][]}>()
const source=ref(''),firstHeaders=ref(true), error=ref(''), start=ref(0), width=ref(460)
const worker=useWorker<Recipe,Generation>(()=>new Worker(new URL('../mock-data/mock-worker.ts',import.meta.url),{type:'module'}))
const modesLabel={scroll:'Desplazamiento horizontal',sticky:'Primera columna fija',cards:'Tarjetas',priority:'Ocultar columnas secundarias'}
const pageStart = (s: State) => Math.min(start.value, Math.floor(Math.max(0, s.rows.length - 1) / 20) * 20)
const tableFlags={rowHeaders:'Encabezados de fila',sort:'Ordenación con JavaScript',striped:'Filas alternas',compact:'Densidad compacta'} as const
watch(()=>route.query.handoff,async(id,_,cleanup)=>{
  let active=true;cleanup(()=>{active=false});incoming.value=undefined
  const value=await receiveTableDraft(id).catch(()=>undefined);if(active)incoming.value=value
},{immediate:true})
function loadMock(){
  try{
    if(!incoming.value)return
    const recipe=mockLogic.migrate(incoming.value.recipe,1)
    worker.send({...recipe,format:'json'})
  }catch{error.value='El esquema enviado no es válido.'}
}
watch(worker.result,value=>{
  if(value?.kind!=='result'||!incoming.value){if(value?.kind==='error')error.value='No se pudieron generar las filas enviadas.';return}
  try {
    const headers=incoming.value.columns
    const rows=JSON.parse(value.output) as Record<string,unknown>[]
    importRows.value={headers,values:rows.map(row=>headers.map(key=>typeof row[key]==='string'?row[key]:JSON.stringify(row[key])??''))}
  }catch{error.value='El esquema enviado no produjo una tabla.'}
})
function paste(s:State){
  error.value=''
  try{
    if(source.value.length>1_000_000)throw new Error('El límite de entrada es 1 MB.')
    const rows=parseGrid(source.value)
    if(!rows.length)throw new Error('Pega primero texto CSV o TSV.')
    const headers=firstHeaders.value?rows.shift()!:Array.from({length:Math.max(...rows.map(row=>row.length))},(_,i)=>'Columna '+(i+1))
    replaceRows(s,headers,rows);start.value=0
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo importar el texto.'}
}
function applyMock(s:State){
  if(!importRows.value)return
  replaceRows(s,importRows.value.headers,importRows.value.values)
  start.value=0;importRows.value=undefined;incoming.value=undefined;void router.replace({query:{}})
}
function key(e:KeyboardEvent,row:number,col:number){
  if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return
  const input=e.target as HTMLInputElement
  const offset={ArrowUp:[-1,0],ArrowDown:[1,0],Enter:[1,0],
    ArrowLeft:input.selectionStart===0&&input.selectionEnd===0?[0,-1]:null,
    ArrowRight:input.selectionStart===input.value.length?[0,1]:null}[e.key]
  if(!offset)return
  const next=input.closest('table')?.querySelector<HTMLInputElement>('[data-cell="'+(row+offset[0]!)+':'+(col+offset[1]!)+'"]')
  if(next){e.preventDefault();next.focus()}
}
const val=(e:Event)=>(e.target as HTMLInputElement).value
function scene(s:State){
  return '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vista previa de tabla</title><style>body{margin:0;font-family:system-ui}'+css(s)+'</style>'+html(s)+
    (s.sort?'<script>'+sortCode+'<'+ '/script>':'')+'</html>'
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <div v-if="incoming" class="notice"><p>{{t('tool.tableDraft',{count:incoming.count})}}</p><button type="button" class="btn" :disabled="worker.busy.value" @click="loadMock">Preparar filas enviadas</button></div>
      <button v-if="importRows" type="button" class="btn" @click="update(applyMock)">Importar {{importRows.values.length}} filas</button>
      <label>Título de la tabla<input type="text" maxlength="180" :value="state.caption" @input="update(s=>{s.caption=val($event)},'caption')" /></label>
      <label>Pie de tabla<input type="text" maxlength="180" :value="state.footer" @input="update(s=>{s.footer=val($event)},'footer')" /></label>
      <label>Diseño estrecho<select :value="state.mode" @change="update(s=>{s.mode=val($event) as State['mode']})"><option v-for="mode in modes" :key="mode" :value="mode">{{modesLabel[mode]}}</option></select></label>
      <RangeField label="Punto de corte (px)" :model-value="state.breakpoint" :min="300" :max="900" @update:model-value="update(s=>{s.breakpoint=$event},'table-breakpoint')" />
      <label v-for="(label,flag) in tableFlags" :key="flag" class="check"><input type="checkbox" :checked="state[flag]" @change="update(s=>{s[flag]=!s[flag]})" /> {{label}}</label>
      <details><summary>Importar CSV o TSV</summary>
        <label>Datos pegados<textarea v-model="source" maxlength="1000000" rows="4" /></label>
        <label class="check"><input v-model="firstHeaders" type="checkbox" /> La primera fila contiene los encabezados</label>
        <button type="button" class="btn" @click="update(paste)">Sustituir datos</button>
      </details>
      <p v-if="error" role="alert">{{error}}</p>
      <div class="actions">
        <button type="button" class="btn" :disabled="state.columns.length>=16" @click="update(s=>{s.columns.push(makeColumn('Columna '+(s.columns.length+1)));s.rows.forEach(row=>row.push(''))})">Añadir columna</button>
        <button type="button" class="btn" :disabled="state.rows.length>=1000" @click="update(s=>{s.rows.push(s.columns.map(()=>''));start=Math.floor((s.rows.length-1)/20)*20})">Añadir fila</button>
      </div>
      <details><summary>Configurar columnas</summary>
        <fieldset v-for="(column,i) in state.columns" :key="i">
          <legend>Columna {{i+1}}</legend>
          <label>Encabezado {{i+1}}<input type="text" maxlength="80" :value="column.header" @input="update(s=>{s.columns[i]!.header=val($event)},'header-'+i)" /></label>
          <label>Alineación<select :value="column.align" @change="update(s=>{s.columns[i]!.align=val($event) as typeof column.align})"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label>
          <label>Ordenación<select :value="column.type" @change="update(s=>{s.columns[i]!.type=val($event) as typeof column.type})"><option value="text">Texto</option><option value="number">Número</option></select></label>
          <label class="check"><input type="checkbox" :checked="column.priority" @change="update(s=>{s.columns[i]!.priority=!s.columns[i]!.priority})" /> Secundaria en móvil</label>
          <button type="button" class="btn" :disabled="state.columns.length<=1" @click="update(s=>{s.columns.splice(i,1);s.rows.forEach(row=>row.splice(i,1))})">Eliminar columna {{i+1}}</button>
        </fieldset>
      </details>
      <div class="editor">
        <table>
          <caption>Edición de celdas</caption>
          <thead><tr><th scope="col">Fila</th><th v-for="(col,i) in state.columns" :key="i" scope="col">{{col.header || 'Columna '+(i+1)}}</th><th scope="col">Acciones</th></tr></thead>
          <tbody><tr v-for="(row,i) in state.rows.slice(pageStart(state),pageStart(state)+20)" :key="i">
            <th scope="row">{{i+pageStart(state)+1}}</th>
            <td v-for="(col,j) in state.columns" :key="j"><input type="text" maxlength="300" :aria-label="'Fila '+(i+pageStart(state)+1)+', '+(col.header || 'columna '+(j+1))" :data-cell="i+':'+j" :value="row[j]||''" @keydown="key($event,i,j)"
              @input="update(s=>{s.rows[i+pageStart(s)]![j]=val($event)},'cell-'+start+'-'+i+'-'+j)" /></td>
            <td><button type="button" class="btn" :aria-label="'Eliminar fila '+(i+pageStart(state)+1)" @click="update(s=>{s.rows.splice(i+pageStart(s),1)})">Quitar</button></td>
          </tr></tbody>
        </table>
      </div>
      <div v-if="state.rows.length>20" class="actions">
        <button type="button" class="btn" :disabled="start===0" @click="start=Math.max(0,start-20)">Filas anteriores</button>
        <button type="button" class="btn" :disabled="start+20>=state.rows.length" @click="start+=20">Filas siguientes</button>
        <span>{{state.rows.length}} filas</span>
      </div>
    </template>
    <template #preview="{state}">
      <div class="table-view">
        <RangeField v-model="width" label="Ancho de vista (px)" :min="300" :max="920" />
        <div class="frame-scroll"><iframe title="Tabla HTML generada" sandbox="allow-scripts" :srcdoc="scene(state)" :width="width" /></div>
        <h3>Comprobaciones de accesibilidad</h3>
        <ul>
          <li>{{state.caption.trim()?'Título definido':'Añade un título que describa los datos.'}}</li>
          <li>{{state.columns.every(c=>c.header.trim())?'Encabezados de columna definidos':'Hay encabezados vacíos. Se usa un nombre provisional.'}}</li>
          <li>{{state.rowHeaders?'La primera columna identifica cada fila.':'Activa los encabezados de fila si la primera columna identifica los registros.'}}</li>
          <li v-if="state.mode==='cards'">La vista en tarjetas conserva roles de tabla y muestra las etiquetas por celda.</li>
        </ul>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>.editor,.frame-scroll{overflow:auto;max-width:100%}.editor input{min-width:6rem}.editor caption{text-align:left;font-weight:700}.table-view{width:100%;min-width:0;display:grid;gap:.5rem}.frame-scroll iframe{max-width:none;border:1px solid var(--line);height:265px}fieldset label{margin-block:.25rem}</style>
