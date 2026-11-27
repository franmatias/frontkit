<script setup lang="ts">
import highlight from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FileDropZone from '../../components/shared/FileDropZone.vue'
import { useClipboard } from '../../composables/useClipboard'
import { useToolState } from '../../composables/useToolState'
import { read, remove, writeRememberedInput } from '../../core/storage/db'
import { sendCleaned } from '../../core/storage/html-cleaner-handoff'
import { useSettingsStore } from '../../stores/settings'
import { highlightSegments } from '../../lib/code-highlight'
import { download } from '../../lib/download'
import { defaults, detect, logic, presets, type State } from './logic'
import { clipboardMarkup, extractTable, pipeline, previewDocument } from './pipeline'
import { serialize } from './serialize'
import { autoBytes, decode, encodings, fetchHtml, maxBytes, sizeOf, webAddress } from './source'

const {t,n}=useI18n()
const settings=useSettingsStore()
highlight.registerLanguage('xml',xml)
const l=(key:string)=>t('detail.html-cleaner.'+key)
const router=useRouter(),copy=useClipboard()
const {state,ready,shared,update,replace,url,canUndo,canRedo,changeHistory,discard,persist}=useToolState(logic)
const input=ref(''), filename=ref(''), sourceAddress=ref(''), base=ref(''), encoding=ref('auto'), usedEncoding=ref('')
const proxy=ref(''), address=ref(''), error=ref(''), notice=ref('')
const transport=ref<'direct'|'allorigins'|'jina'|'custom'>('direct')
const retryProxy=ref(false)
const panel=ref('input'), tab=ref('html'), remote=ref(false)
const inputBox=ref<HTMLTextAreaElement>(), diffBox=ref<HTMLElement>()
const result=shallowRef<Awaited<ReturnType<typeof pipeline>> & { output:ReturnType<typeof serialize>; input:string }>()
const inputBytes=computed(()=>sizeOf(input.value))
const suggestion=computed(()=>detect(input.value))
const progress=ref(0), busy=ref(false), fetching=ref(false)
let cleanTask:AbortController|undefined
let network:AbortController|undefined
let timer:ReturnType<typeof setTimeout>|undefined
let rememberTimer:ReturnType<typeof setTimeout>|undefined
let edited=false
let restoring=false
const inputKey='html-cleaner:input'
const remembersInput=computed(()=>settings.data.preferences.rememberInput&&settings.data.preferences.rememberHtmlCleaner)
const sections=['input','options','output'] as const
const visiblePanels=ref<string[]>([...sections])
function togglePanel(section:string){
  const visible=visiblePanels.value
  if(!visible.includes(section)) visiblePanels.value=[...visible,section]
  else if(visible.length>1) visiblePanels.value=visible.filter(item=>item!==section)
}
const columnWidths=computed(()=>sections.map((section,index)=>visiblePanels.value.includes(section)
  ? ['minmax(0,1fr)','minmax(0,.85fr)','minmax(0,1.14fr)'][index] : '').filter(Boolean).join(' '))
function resetOptions(){
  cancel()
  replace(defaults())
  tab.value='html'
  base.value=sourceAddress.value
  remote.value=false
  transport.value='direct'
  proxy.value=''
  encoding.value='auto'
  retryProxy.value=false
  error.value=''
  notice.value=''
  if(input.value.trim() && inputBytes.value<=maxBytes)void nextTick(run)
}
const tabs=['html','md','text','preview','diff','report'] as const
const normalization = ['semantic','underline','wordLists','emailTables','empty','spaces','invisibles','straight','paragraphs','headings','hierarchy','keepId','keepData','keepAria','stripParams','unwrapRedirects','dropDataImages'] as const
const sanitization=['forms','hidden','tracking','chrome','main','quotes'] as const
const fields={
  classes:['none','office','all'],divs:['keep','paragraph','unwrap'],phase:['sanitize','normalize','serialize'],shift:[-2,-1,0,1,2],
  eol:['lf','crlf'],indent:[2,4],headingStyle:['atx','setext'],bullet:['-','*'],emphasis:['*','_'],fence:['backtick','tilde'],
  links:['inlined','referenced'],hardBreak:['spaces','slash'],unknown:['html','text','discard'],textLinks:['inline','text','notes'],
  textHeading:['plain','underline','uppercase'],wrap:[0,72,80],textTable:['tsv','ascii'],
} as const
const formatFlags={html:['document','minify','selfClose'],md:['gfm','frontmatter'],text:['textQuotes','textImages']} as const
const formats={html:['indent'],md:['headingStyle','bullet','emphasis','fence','links','hardBreak','unknown'],text:['textLinks','textHeading','wrap','textTable']} as const
const availableTabs=computed<readonly (typeof tabs)[number][]>(()=>state.value.phase==='serialize'?tabs:tabs.filter(id=>id!=='md'&&id!=='text'))
const fmt=computed<State['output']>(()=>state.value.phase==='serialize'&&(tab.value==='md'||tab.value==='text')?tab.value:'html')
const output=computed(()=>result.value?.output[fmt.value]??'')
const markup=computed(()=>result.value ? previewDocument(result.value.root,remote.value) : '')
const segments=computed(()=>fmt.value==='html'?highlightSegments(output.value,'xml'):[{text:output.value,classes:''}])
const table=computed(()=>result.value ? extractTable(result.value.root) : undefined)
const diff=computed(()=>{
  const inputLines=result.value?.input.split(/\r?\n/)??[], outputLines=result.value?.output.html.split(/\r?\n/)??[]
  const length=Math.max(inputLines.length,outputLines.length)
  return {length,rows:Array.from({length:Math.min(300,length)},(_,i)=>({left:inputLines[i]??'',right:outputLines[i]??''}))}
})
function selectTab(value:string) {
  tab.value=value
  if(value==='html'||value==='text'||value==='md')update(next=>{next.output=value})
}
watch(()=>state.value.output,value=>{if(state.value.phase==='serialize'&&['html','md','text'].includes(tab.value))tab.value=value})
watch(availableTabs,items=>{if(!items.some(item=>item===tab.value))tab.value='html'})
function change<K extends keyof State>(key:K,value:State[K]){
  update(d=>{d[key]=value; if(!['output','phase','eol'].includes(key))d.preset='custom'})
}
function selectOption(key:keyof typeof fields,event:Event){
  const value=(event.target as HTMLSelectElement).value
  update(next=>{
    const choice = fields[key].find(item => String(item) === value)
    if(choice!==undefined)Object.assign(next,{[key]:choice})
  })
}
async function run(){
  clearTimeout(timer);cleanTask?.abort()
  if(!ready.value||!input.value.trim())return
  const current=new AbortController()
  cleanTask=current;busy.value=true;error.value='';notice.value='';progress.value=4
  const snapshot=state.value,raw=input.value,zone=base.value
  try{
    await new Promise<void>(resolve=>setTimeout(resolve,0));current.signal.throwIfAborted()
    const processed=await pipeline(raw,snapshot,zone,current.signal,value=>{if(cleanTask===current)progress.value=value})
    await new Promise<void>(resolve=>setTimeout(resolve,0));current.signal.throwIfAborted()
    const output=serialize(processed.root,snapshot,processed.report,processed.title,sourceAddress.value)
    current.signal.throwIfAborted()
    if(cleanTask===current){
      result.value={...processed,output,input:raw}
      progress.value=100;notice.value=t('detail.html-cleaner.completed',{bytes:n(processed.report.cleanBytes)})
    }
  }catch(e){ if(!current.signal.aborted&&cleanTask===current)error.value=e instanceof Error?e.message:l('failure') }
  finally{if(cleanTask===current){busy.value=false;cleanTask=undefined}}
}
watch(input,()=>{remote.value=false})
watch([input,base,ready,()=>{return JSON.stringify({...state.value, output:undefined})}],()=>{
  clearTimeout(timer);cleanTask?.abort();cleanTask=undefined;busy.value=false;result.value=undefined;notice.value=''
  if(ready.value&&input.value.trim()&&inputBytes.value<=autoBytes)timer=setTimeout(()=>{void run()},300)
})
function cancel(){
  clearTimeout(timer);cleanTask?.abort();network?.abort()
  busy.value=false;fetching.value=false;notice.value=l('cancelled')
}
function rememberInput(){
  clearTimeout(rememberTimer)
  if(!edited||!remembersInput.value)return
  if(!input.value||inputBytes.value>maxBytes)void remove('kv',inputKey).catch(()=>{})
  else void writeRememberedInput(inputKey,input.value).catch(()=>{})
}
watch(input,()=>{
  if(restoring)return
  edited=true
  clearTimeout(rememberTimer)
  rememberTimer=setTimeout(rememberInput,300)
},{flush:'sync'})
onMounted(async()=>{
  if(!remembersInput.value)return
  const stored=(await read('kv',inputKey).catch(()=>undefined))?.state
  if(edited||!remembersInput.value||typeof stored!=='string'||sizeOf(stored)>maxBytes)return
  restoring=true
  input.value=stored
  restoring=false
})
onScopeDispose(()=>{rememberInput();cancel()})
function loadText(html:string,name='',origin='',actualEncoding=''){
  if(sizeOf(html)>maxBytes){error.value=l('limit');return}
  error.value='';sourceAddress.value=origin;filename.value=name;usedEncoding.value=actualEncoding
  base.value=origin;input.value=html;remote.value=false
}
function clipboard(event:ClipboardEvent) {
  const box=inputBox.value, data=event.clipboardData
  if(!box || !data)return
  const value=clipboardMarkup(data.getData('text/plain'),data.getData('text/html'))
  if(!value)return
  event.preventDefault()
  const start=box.selectionStart,end=box.selectionEnd
  if(start===0 && end===input.value.length){loadText(value);return}
  const next=input.value.slice(0,start)+value+input.value.slice(end)
  if(sizeOf(next)>maxBytes){error.value=l('limit');return}
  input.value=next
  void nextTick(()=>box.setSelectionRange(start+value.length,start+value.length))
}
async function paste(){
  try{
    if(navigator.clipboard.read){
      const items=await navigator.clipboard.read()
      for(const item of items){
        const readType=async(type:string)=>item.types.includes(type)?(await item.getType(type)).text():''
        const value=clipboardMarkup(await readType('text/plain'),await readType('text/html'))
        if(value){loadText(value);return}
      }
    }
  }catch{ /* Some browsers only grant plain-text clipboard access. */ }
  try {loadText(await navigator.clipboard.readText())}
  catch{error.value=l('clipboardError');inputBox.value?.focus()}
}
async function loadFile(files:File[]){
  const file=files[0]
  if(!file||!/[.](?:html?|xhtml)$/i.test(file.name)){error.value=l('fileError');return}
  if(file.size>maxBytes){error.value=l('limit');return}
  try {const found=decode(new Uint8Array(await file.arrayBuffer()),encoding.value);loadText(found.html,file.name,'',found.encoding)}
  catch(e){error.value=e instanceof Error?e.message:l('failure')}
}
async function retrieve(){
  if(fetching.value)return
  let target:URL
  try{target=webAddress(address.value)}catch(e){error.value=(e as Error).message;return}
  const task=new AbortController()
  network=task;fetching.value=true;error.value='';notice.value=''
  retryProxy.value=false
  const expiry=setTimeout(()=>task.abort('timeout'),45000)
  try{
    const response=await fetchHtml(target,proxy.value.trim(),task.signal,transport.value)
    if(network===task&&!task.signal.aborted){
      loadText(response.html,'',response.base,response.encoding)
      await nextTick()
      if(inputBytes.value>autoBytes && inputBytes.value<=maxBytes)await run()
    }
  }catch(e){
    retryProxy.value=!task.signal.aborted || task.signal.reason==='timeout'
    if(task.signal.reason==='timeout')error.value=l('timeout')
    else if(!task.signal.aborted)error.value=e instanceof TypeError?l(transport.value==='direct'?'cors':'proxyFailure'):e instanceof Error?e.message:l('failure')
  }finally{clearTimeout(expiry);if(network===task){fetching.value=false;network=undefined}}
}
function downloadOutput(){
  if(!output.value)return
  const extension={html:'.html',md:'.md',text:'.txt'}[fmt.value]
  const mime={html:'text/html',md:'text/markdown',text:'text/plain'}[fmt.value]
  download((filename.value.replace(/\.[^.]+$/,'')||'frontkit-limpio')+extension,output.value,mime+';charset=utf-8')
}
async function transfer(dest:'bem'|'a11y-audit'|'table-builder'){
  if(!result.value)return
  if(dest==='table-builder'){
    if(!table.value)return
    sendCleaned(dest,table.value)
  }else sendCleaned(dest,result.value.output.html)
  await router.push({name:dest})
}
function showDiff(){if(!visiblePanels.value.includes('output'))togglePanel('output');tab.value='diff';panel.value='output';void nextTick(()=>diffBox.value?.focus())}
function tabKeys(event:KeyboardEvent){
  if(event.altKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
    const items=availableTabs.value
    const found=items.indexOf(tab.value as typeof tabs[number])
    selectTab(items[(found+(event.key==='ArrowRight'?1:items.length-1))%items.length]!)
    event.preventDefault()
  }
  if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='c'&&output.value){
    event.preventDefault();void copy(output.value)
  }
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();void run()}
}
const outputNumber=computed(()=>({lines:output.value.split(/\r?\n/).length,chars:output.value.length,words:output.value.trim().split(/\s+/).filter(Boolean).length}))
</script>

<template>
  <div class="workspace cleaner" @keydown="tabKeys">
    <header class="tool-heading">
      <div><h1>{{t('tools.html-cleaner.name')}}</h1><p>{{t('tools.html-cleaner.description')}}</p></div>
      <button type="button" class="btn" @click="copy(url())">{{t('tool.share')}}</button>
    </header>
    <div v-if="shared" class="notice actions"><span>{{t('tool.shareLoaded')}}</span><button type="button" class="btn" @click="persist">{{t('tool.keep')}}</button><button type="button" class="btn" @click="discard">{{t('tool.discard')}}</button></div>
    <nav class="desktop-panels actions" :aria-label="l('sections')">
      <strong>{{l('panels')}}</strong>
      <button v-for="section in sections" :key="section" class="btn pill" type="button"
        :aria-controls="'clean-'+section" :aria-pressed="visiblePanels.includes(section)"
        :disabled="visiblePanels.length===1 && visiblePanels.includes(section)" @click="togglePanel(section)">
        <span aria-hidden="true">{{visiblePanels.includes(section)?'−':'+'}}</span> {{l(section)}}
      </button>
    </nav>
    <nav class="mobile-tabs actions" :aria-label="l('sections')">
      <button v-for="section in sections" :key="section" type="button" class="btn" :aria-pressed="panel===section" @click="panel=section">{{l(section)}}</button>
    </nav>
    <div v-if="inputBytes>autoBytes||busy||fetching||error||notice" class="clean-status">        <p v-if="inputBytes>maxBytes" role="alert">{{l('limit')}}</p>
        <p v-else-if="inputBytes>autoBytes" class="hint">{{l('manual')}}</p>
        <progress v-if="busy" :value="progress" max="100" :aria-label="l('progress')" />
        <p v-if="fetching" role="status">{{l('fetching')}}</p>
        <p v-if="error" role="alert">{{error}}</p>
        <p v-if="notice" role="status">{{notice}}</p>
    </div>
    <div class="cleaner-grid" :data-panel="panel" :style="{'--columns':columnWidths}">
      <section id="clean-input" class="panel clean-input" :class="{folded:!visiblePanels.includes('input')}">
        <h2>{{l('input')}}</h2>
        <div class="source-tools">
          <button type="button" class="btn" @click="paste">{{l('paste')}}</button>
          <button type="button" class="btn" @click="loadText('<article><h1>Cuaderno de FrontKit</h1><p><b style=&quot;color:red&quot;>Ejemplo de HTML</b> con un <a href=&quot;/guia?utm_source=boletin&quot;>enlace de prueba</a>.</p></article>')">{{l('example')}}</button>
        </div>
        <label>{{l('inputHtml')}}<textarea ref="inputBox" v-model="input" rows="12" maxlength="2000000" spellcheck="false" @paste="clipboard" /></label>
        <p class="hint">{{n(inputBytes)}} bytes <span v-if="filename">· {{filename}}</span><span v-if="usedEncoding"> · {{usedEncoding}}</span></p>
        <FileDropZone :label="l('file')" accept=".html,.htm,.xhtml,text/html,application/xhtml+xml" @choose="loadFile"/>
        <button v-if="inputBytes>autoBytes" type="button" class="btn primary mobile-run" :disabled="busy||!ready||inputBytes>maxBytes" @click="run">{{l('run')}}</button>
        <label>{{l('encoding')}}<select v-model="encoding"><option v-for="item in encodings" :key="item" :value="item">{{item}}</option></select></label>
        <fieldset class="options-group">
          <legend>{{l('url')}}</legend>
          <label>{{l('address')}}<input v-model.trim="address" type="url" maxlength="2000" placeholder="https://ejemplo.es/articulo" /></label>
          <label>{{l('transport')}}<select v-model="transport"><option v-for="method in (['direct','jina','allorigins','custom'] as const)" :key="method" :value="method">{{l(method==='custom'?'customProxy':method)}}</option></select></label>
          <p class="hint">{{l(transport==='direct'?'network':'proxyDisclosure')}}</p>
          <label v-if="transport==='custom'">{{l('proxy')}}<input v-model.trim="proxy" type="url" maxlength="2000" /></label>
          <p v-if="transport==='custom'" class="hint">{{l('proxyHelp')}}</p>
          <button type="button" class="btn" :disabled="fetching||!address||(transport==='custom'&&!proxy)" @click="retrieve">{{l('fetch')}}</button>
          <button v-if="retryProxy && transport!=='jina'" type="button" class="btn" @click="transport='jina';retrieve()">{{l('retryJina')}}</button>
          <button v-if="retryProxy && transport==='jina'" type="button" class="btn" @click="transport='allorigins';retrieve()">{{l('retryAllOrigins')}}</button>
        </fieldset>
      </section>

      <section id="clean-options" class="panel clean-options" :class="{folded:!visiblePanels.includes('options')}">
        <h2>{{l('options')}}</h2>
        <button type="button" class="btn" @click="resetOptions">{{l('reset')}}</button>
        <label class="check"><input :checked="state.articlePage" type="checkbox" @change="change('articlePage',($event.target as HTMLInputElement).checked)"/>{{l('articlePage')}}</label>
        <label>{{l('presets')}}<select :value="state.preset" @change="replace(defaults(($event.target as HTMLSelectElement).value as State['preset']))"><option v-for="item in presets" :key="item" :value="item">{{l(item)}}</option></select></label>
        <button v-if="suggestion && suggestion!==state.preset" type="button" class="btn" @click="replace(defaults(suggestion))">{{t('detail.html-cleaner.suggest',{preset:l(suggestion)})}}</button>
        <div class="actions"><button class="btn" type="button" :disabled="!canUndo" @click="changeHistory(true)">{{t('tool.undo')}}</button><button class="btn" type="button" :disabled="!canRedo" @click="changeHistory(false)">{{t('tool.redo')}}</button></div>
        <label>{{l('base')}}<input v-model.trim="base" type="url" maxlength="2000"/></label>
        <label>{{l('keep')}}<input :value="state.keep" maxlength="400" placeholder="article, .contenido" @input="change('keep',($event.target as HTMLInputElement).value)"/></label>
        <label>{{l('remove')}}<input :value="state.remove" maxlength="400" placeholder=".anuncio, aside" @input="change('remove',($event.target as HTMLInputElement).value)"/></label>
        <details open><summary>{{l('sanitize')}}</summary><label v-for="flag in sanitization" :key="flag" class="check"><input type="checkbox" :checked="state[flag]" @change="change(flag,($event.target as HTMLInputElement).checked)" />{{l(flag)}}</label></details>
        <details><summary>{{l('normalize')}}</summary>
          <label v-for="flag in normalization" :key="flag" class="check"><input type="checkbox" :checked="state[flag]" @change="change(flag,($event.target as HTMLInputElement).checked)" />{{l(flag)}}</label>
          <label v-for="field in (['classes','divs','shift'] as const)" :key="field">{{l(field)}}<select :value="state[field]" @change="selectOption(field,$event)"><option v-for="value in fields[field]" :key="value" :value="value">{{ typeof value==='number'?value:value==='keep'?l('all'):l(value) }}</option></select></label>
          <label>{{l('dataLimit')}}<input type="number" min="1" max="2048" :value="state.dataLimit" @change="change('dataLimit',Math.min(2048,Math.max(1,Number(($event.target as HTMLInputElement).value)||120)))" /></label>
        </details>
        <details><summary>{{l('formatOptions')}}</summary>
          <label v-for="flag in formatFlags[fmt]" :key="flag" class="check"><input type="checkbox" :checked="state[flag]" @change="change(flag,($event.target as HTMLInputElement).checked)" />{{l(flag)}}</label>
          <label v-for="field in [...formats[fmt],'eol'] as const" :key="field">{{l(field)}}<select :value="state[field]" @change="selectOption(field,$event)"><option v-for="value in fields[field]" :key="value" :value="value">{{ typeof value==='number'||['*','-','_'].includes(value)?value:value==='spaces'?l('spacesBreak'):l(value) }}</option></select></label>
        </details>
        <label>{{l('stop')}}<select :value="state.phase" @change="selectOption('phase',$event)"><option v-for="phase in fields.phase" :key="phase" :value="phase">{{l(phase)}}</option></select></label>
        <button type="button" class="btn primary" :disabled="busy||!ready||!input.trim()||inputBytes>maxBytes" @click="run">{{l('run')}}</button>
        <button v-if="busy||fetching" type="button" class="btn" @click="cancel">{{t('app.cancel')}}</button>
      </section>

      <section id="clean-output" class="panel clean-output" :class="{folded:!visiblePanels.includes('output')}">
        <h2>{{l('output')}}</h2>
        <div class="actions" :aria-label="l('output')"><button v-for="id in availableTabs" :key="id" type="button" class="btn pill" :aria-pressed="tab===id" @click="selectTab(id)">{{l(id)}}</button></div>
        <template v-if="result">
          <template v-if="tab==='html'||tab==='md'||tab==='text'">
            <div class="actions"><button type="button" class="btn" @click="copy(output)">{{t('tool.copy')}}</button><button type="button" class="btn" @click="downloadOutput">{{t('tool.download')}}</button></div>
            <p class="hint">{{t('detail.html-cleaner.stats',outputNumber)}}</p>
            <pre class="code-box" :data-code-theme="settings.data.editor.syntaxTheme"><code><span v-for="(segment,index) in segments" :key="index" :class="segment.classes">{{segment.text}}</span></code></pre>
          </template>
          <template v-else-if="tab==='preview'">
            <label class="check"><input v-model="remote" type="checkbox" />{{l('remote')}}</label>
            <p v-if="remote" class="hint">{{l('remoteHelp')}}</p>
            <iframe v-if="result.report.cleanBytes<=maxBytes" sandbox="" referrerpolicy="no-referrer" :title="l('preview')" :srcdoc="markup"/>
            <p v-else>{{l('limit')}}</p>
          </template>
          <div v-else-if="tab==='diff'" ref="diffBox" class="split-diff" tabindex="0" :aria-label="l('diff')">
            <strong>{{l('original')}}</strong><strong>{{l('cleaned')}}</strong>
            <template v-for="(row,i) in diff.rows" :key="i"><code :class="{changed:row.left!==row.right}">{{row.left||' '}}</code><code :class="{changed:row.left!==row.right}">{{row.right||' '}}</code></template>
            <p v-if="diff.length>300">{{l('diffLimit')}}</p>
            <details><summary>{{l('sanitize')}}</summary><pre>{{result.sanitized.slice(0,22000)}}</pre></details>
          </div>
          <div v-else class="clean-report">
            <p>{{n(result.report.sourceBytes)}} → {{n(result.report.cleanBytes)}} bytes <span v-if="result.report.sourceBytes">({{Math.round((1-result.report.cleanBytes/result.report.sourceBytes)*100)}} % {{l('reduction')}})</span></p>
            <button class="btn" type="button" @click="showDiff">{{l('diff')}}</button>
            <section v-for="[key,counts] in Object.entries({sanitize:result.report.safety,normalize:result.report.normal})" :key="key">
              <h3>{{l(key)}}</h3><p v-if="!Object.keys(counts).length">{{l('noChanges')}}</p>
              <dl v-else><template v-for="(count,name) in counts" :key="name"><dt>{{l('count.'+name)}}</dt><dd>{{count}}</dd></template></dl>
            </section>
            <h3>{{l('histogram')}}</h3>
            <table><thead><tr><th scope="col">{{l('tag')}}</th><th scope="col">{{l('original')}}</th><th scope="col">{{l('cleaned')}}</th></tr></thead><tbody>
              <tr v-for="name in [...new Set([...Object.keys(result.report.before),...Object.keys(result.report.after)])].sort()" :key="name"><th scope="row">{{name}}</th><td>{{result.report.before[name]||0}}</td><td>{{result.report.after[name]||0}}</td></tr>
            </tbody></table>
            <ul v-if="result.report.warnings.length"><li v-for="(item,i) in [...new Set(result.report.warnings)]" :key="i">{{item}}</li></ul>
          </div>
          <div class="actions clean-handoffs">
            <button class="btn" type="button" @click="transfer('bem')">{{l('bem')}}</button>
            <button class="btn" type="button" @click="transfer('a11y-audit')">{{l('audit')}}</button>
            <button v-if="table" class="btn" type="button" @click="transfer('table-builder')">{{l('table')}}</button>
          </div>
        </template>
        <p v-else>{{l('emptyOutput')}}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cleaner-grid { display:grid;grid-template-columns:var(--columns);align-items:start;gap:.65rem; }
.cleaner-grid > section,.options-group,.clean-report { display:grid;gap:.65rem;min-width:0; }
.cleaner label:not(.check) { display:grid;gap:.28rem;min-width:0;font-size:.84rem; }
.cleaner textarea { resize:vertical;font-family:ui-monospace,monospace; }
.cleaner textarea,.cleaner input,.cleaner select { max-width:100%; }
.source-tools { display:flex;flex-wrap:wrap;gap:.4rem; }
.options-group,.clean-options details { border:1px solid var(--line);border-radius:.6rem;padding:.55rem; }
.clean-options details label { margin-block:.25rem; }.clean-options summary,.options-group legend { font-weight:700; }
.hint { color:var(--muted);font-size:.8rem; }
.cleaner iframe { width:100%;min-height:340px;border:1px solid var(--line);border-radius:.55rem;background:white; }
.cleaner .code-box { max-height:570px; }
.split-diff { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));min-width:0;max-height:545px;overflow:auto;gap:2px; }
.split-diff :is(code,strong) { padding:.3rem;overflow-wrap:anywhere;white-space:pre-wrap;font-size:.77rem; }
.split-diff .changed { background:var(--accent-soft); }
.split-diff details,.split-diff p { grid-column:1/-1;min-width:0; }.split-diff pre { overflow:auto; }
.clean-report dl { display:grid;grid-template-columns:1fr auto;margin:0; }.clean-report td,.clean-report th { padding:.25rem;text-align:left;border-bottom:1px solid var(--line); }
.clean-handoffs { padding-top:.4rem;border-top:1px solid var(--line); }
.mobile-tabs,.mobile-run { display:none; }
.clean-status { display:grid;gap:.3rem; }.clean-status p { margin:0; }
@media(min-width:921px){.cleaner-grid > .folded { display:none; }}
.desktop-panels { margin-block:.35rem; }.desktop-panels [aria-pressed=true] { background:var(--accent-soft); }
@media(max-width:920px){.desktop-panels{display:none}.cleaner-grid{grid-template-columns:minmax(0,1fr)}.mobile-tabs{display:flex}.mobile-run{display:inline-flex}.mobile-tabs [aria-pressed=true]{color:var(--accent);background:var(--accent-soft)}
.cleaner-grid[data-panel=input] > :not(.clean-input),.cleaner-grid[data-panel=options] > :not(.clean-options),.cleaner-grid[data-panel=output] > :not(.clean-output){display:none}}
</style>
