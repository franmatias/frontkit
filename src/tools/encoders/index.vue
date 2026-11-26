<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { useClipboard } from '../../composables/useClipboard'
import { useWorker } from '../../composables/useWorker'
import { algorithms, base64, escapes, hash, htmlCode, logic, modes, timestamp, ulid, urlCode, uuid7, type Algorithm, type State } from './logic'
import type { RegexJob, RegexResult } from './regex.worker'

const modeNames={base64:'Base64',url:'URL',html:'Entidades HTML',hash:'Hash / HMAC',ids:'UUID / ULID',time:'Timestamp Unix',regex:'Regex',escape:'Escapes'}
const variants={base64:['standard','url'],url:['component','uri','form'],html:['minimal','named','numeric'],escape:['json','unicode']}
const variantNames:Record<string,string>={standard:'Base64 estándar',url:'Base64URL',component:'Componente de URL',uri:'URI completa',form:'Formulario (+ por espacio)',minimal:'Escapado mínimo',named:'Entidades con nombre',numeric:'Entidades numéricas',json:'Cadena JSON',unicode:'Secuencias Unicode'}
const copy = useClipboard()
const tabInputs=ref<Record<string,string>>({})
const algorithm=ref<Algorithm>('SHA-256')
const secret=ref('')
const hashInput=ref('')
const hmac=ref(false)
const chosen=ref<File>()
const dataUri=ref('')
const idKind=ref('v4')
const count=ref(1)
const zone=ref('Europe/Madrid')
const now=ref(Date.now())
const pattern=ref('')
const flags=ref('g')
const replacement=ref('')
const output=ref('')
const feedback=ref('')
const working=ref(false)
const regex = useWorker<RegexJob,RegexResult>(()=>new Worker(new URL('./regex.worker.ts',import.meta.url),{type:'module'}))
let clock: ReturnType<typeof setInterval>
let deadline: ReturnType<typeof setTimeout>
let revision = 0
onMounted(()=>{clock=setInterval(()=>{now.value=Date.now()},1000)})
onScopeDispose(()=>{clearInterval(clock);clearTimeout(deadline);revision++})
watch(regex.result,result=>{
  if(!result)return
  clearTimeout(deadline)
  if('error' in result)feedback.value=result.error
  else output.value=result.output
})
watch(regex.failed,failed=>{if(failed){clearTimeout(deadline);feedback.value='No se pudo iniciar el worker.'}})
const matches=computed(()=>regex.result.value && 'matches' in regex.result.value ? regex.result.value.matches:[])
function input(state:State,text:string) {
  state.input=text
  tabInputs.value[state.mode]=text
}
function switchMode(state:State, mode:State['mode']) {
  tabInputs.value[state.mode]=state.input ?? ''
  state.mode=mode
  state.input=tabInputs.value[mode] ?? ''
  state.variant=getVariants(mode)[0] ?? ''
  state.reverse=false
  clearTimeout(deadline)
  regex.cancel()
  regex.result.value=undefined
  output.value=''
  dataUri.value=''
  feedback.value=''
  revision++
  working.value=false
}
function getVariants(mode:State['mode']) { return mode in variants ? variants[mode as keyof typeof variants] : [] }
function typeFile(event:Event) {
  const file=(event.target as HTMLInputElement).files?.[0]
  chosen.value=file?.size && file.size<=100_000_000 ? file : undefined
  feedback.value=file&&!chosen.value?'El archivo debe tener entre 1 byte y 100 MB.':''
  revision++
  working.value=false
}
async function run(state:State) {
  feedback.value=''
  output.value=''
  dataUri.value=''
  const job=++revision
  working.value=true
  try {
    if(state.mode==='base64' && chosen.value) {
      if(chosen.value.size>5_000_000) throw new Error('El límite para data URI es 5 MB.')
      const data = await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader()
        reader.onload=()=>resolve(String(reader.result))
        reader.onerror=()=>reject(reader.error)
        reader.readAsDataURL(chosen.value!)
      })
      if(job===revision){dataUri.value=data;output.value=data}
    } else if(state.mode==='base64')output.value=base64((state.input ?? ''),state.reverse,state.variant==='url')
    else if(state.mode==='url')output.value=urlCode((state.input ?? ''),state.reverse,state.variant)
    else if(state.mode==='html')output.value=htmlCode((state.input ?? ''),state.reverse,state.variant)
    else if(state.mode==='escape')output.value=escapes((state.input ?? ''),state.reverse,state.variant==='unicode')
    else if(state.mode==='time')output.value=timestamp((state.input ?? ''),zone.value)
    else if(state.mode==='ids')output.value=Array.from({length:Math.max(1,Math.min(200,Math.round(count.value)||1))},()=>idKind.value==='v7'?uuid7():idKind.value==='ulid'?ulid():crypto.randomUUID()).join('\n')
    else if(state.mode==='hash') {
      if(hmac.value && !secret.value)throw new Error('Introduce una clave HMAC.')
      const bytes=chosen.value ? new Uint8Array(await chosen.value.arrayBuffer()) : new TextEncoder().encode(hashInput.value)
      const result=await hash(bytes,algorithm.value,hmac.value?secret.value:undefined)
      if(job===revision)output.value=result
    } else if(state.mode==='regex') {
      clearTimeout(deadline)
      regex.send({pattern:pattern.value,flags:flags.value,input:(state.input ?? ''),replacement:replacement.value})
      if(regex.busy.value)deadline=setTimeout(()=>{
        regex.cancel()
        feedback.value='La expresión superó el límite de 500 ms.'
      },500)
    }
  } catch(error){if(job===revision)feedback.value=error instanceof Error?error.message:'No se pudo procesar la entrada.'}
  finally {if(job===revision)working.value=false}
}
const fileMode=(mode:State['mode'])=>mode==='base64'||mode==='hash'
function tokens(pattern:string) {
  const known:Record<string,string>={'\\d':'dígito','\\w':'carácter de palabra','\\s':'espacio','^':'inicio','$':'fin','*':'cero o más','+':'uno o más','?':'opcional','[':'clase de caracteres','(':'grupo','|':'alternativa'}
  return Object.entries(known).filter(([token])=>pattern.includes(token))
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <label>Utilidad<select :value="state.mode" @change="update(d=>switchMode(d,($event.target as HTMLSelectElement).value as State['mode'])); chosen=undefined">
        <option v-for="mode in modes" :key="mode" :value="mode">{{modeNames[mode]}}</option>
      </select></label>
      <label v-if="getVariants(state.mode).length">Variante<select :value="state.variant" @change="update(d=>{d.variant=($event.target as HTMLSelectElement).value})">
        <option v-for="item in getVariants(state.mode)" :key="item" :value="item">{{variantNames[item]}}</option>
      </select></label>
      <label v-if="getVariants(state.mode).length" class="check"><input type="checkbox" :checked="state.reverse" @change="update(d=>{d.reverse=($event.target as HTMLInputElement).checked})" />Decodificar</label>
      <p v-if="state.mode==='url'">Componente codifica cada valor. URI conserva sus separadores. Formulario usa + para los espacios.</p>
      <template v-if="state.mode==='hash'">
        <label>Algoritmo<select v-model="algorithm"><option v-for="name in algorithms" :key="name">{{name}}</option></select></label>
        <p v-if="algorithm==='SHA-1'">SHA-1 es antiguo. Para nuevas verificaciones usa SHA-256 o superior.</p>
        <label class="check"><input v-model="hmac" type="checkbox" />Calcular HMAC</label>
        <label v-if="hmac">Clave HMAC<input v-model="secret" type="password" maxlength="100000" autocomplete="off" /></label>
        <label>Texto para hash<textarea v-model="hashInput" rows="5" maxlength="100000" /></label>
        <p>La clave y el texto para hash son temporales.</p>
      </template>
      <template v-else-if="state.mode==='ids'">
        <label>Tipo de ID<select v-model="idKind"><option value="v4">UUID v4</option><option value="v7">UUID v7</option><option value="ulid">ULID</option></select></label>
        <label>Cantidad<input v-model.number="count" type="number" min="1" max="200" /></label>
      </template>
      <template v-else>
        <label>{{state.mode==='time'?'Timestamp o ISO':'Texto de entrada'}}<textarea rows="5" maxlength="100000" :value="state.input" @input="update(d=>input(d,($event.target as HTMLTextAreaElement).value),'input')" /></label>
      </template>
      <template v-if="state.mode==='time'">
        <label>Zona horaria<input v-model="zone" type="text" maxlength="80" /></label><p>Ahora: {{new Date(now).toISOString()}}</p>
      </template>
      <template v-if="state.mode==='regex'">
        <label>Patrón<input v-model="pattern" type="text" maxlength="1000" /></label>
        <label>Banderas<input v-model="flags" type="text" maxlength="8" /></label>
        <label>Sustitución<input v-model="replacement" type="text" maxlength="500" /></label>
        <p>La expresión se ejecuta en un worker con límite de 500 ms.</p>
        <p v-for="[token, meaning] in tokens(pattern)" :key="token"><code>{{token}}</code> · {{meaning}}</p>
      </template>
      <label v-if="fileMode(state.mode)">Archivo opcional<input type="file" @change="typeFile" /></label>
      <button type="button" class="btn primary" :disabled="working||regex.busy.value" @click="run(state)">Procesar</button>
      <p v-if="feedback" role="alert">{{feedback}}</p>
    </template>
    <template #preview>
      <div class="result">
        <h3>Resultado</h3>
        <img v-if="/^data:image\/(?:png|jpeg|gif|webp);base64,/.test(dataUri)" :src="dataUri" alt="Imagen del archivo elegido" />
        <pre>{{output.slice(0,20000)}}</pre>
        <button type="button" class="btn" :disabled="!output" @click="copy(output)">Copiar resultado</button>
        <ul v-if="matches.length"><li v-for="(match,index) in matches" :key="index"><mark>{{match.text || 'Vacío'}}</mark> · posición {{match.index}} <code>{{match.named ?? match.groups}}</code></li></ul>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>.result{display:grid;gap:.55rem;width:100%;min-width:0;padding:.75rem;overflow-wrap:anywhere}.result pre{max-height:18rem;overflow:auto;white-space:pre-wrap;font-size:.85rem}.result img{max-width:100%;max-height:15rem}.result mark{background:#f6d678;color:#241e10}</style>
