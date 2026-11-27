<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { checks, defaults, httpUrl, logic, type State } from './logic'
const published={title:'Título',siteName:'Nombre del sitio',url:'URL canónica',locale:'Idioma y región',image:'URL de la imagen',imageAlt:'Texto alternativo',site:'Cuenta del sitio en X',creator:'Cuenta del autor en X'} as const
const limits={title:180,siteName:90,url:600,locale:15,image:600,imageAlt:180,site:80,creator:80} as const
const allowed=ref(''), local=ref(''), localBytes=ref(0), error=ref('')
const network=ref(false)
const val=(e:Event)=>(e.target as HTMLInputElement).value
const cards=[['Open Graph','Facebook y otros servicios'],['LinkedIn','LinkedIn'],['X','Tarjeta en X'],['WhatsApp','Enlace enviado'],['Discord','Vista en Discord']] as const
function approve(s:State){
  error.value=''
  const url=httpUrl(s.image)
  if(!url){error.value='Introduce una URL HTTP o HTTPS absoluta.';return}
  allowed.value=url;network.value=true
}
function removeLocal(){
  if(local.value)URL.revokeObjectURL(local.value)
  local.value='';localBytes.value=0
}
function loadExample(update: (apply: (draft: State) => void) => void) {
  removeLocal()
  error.value = ''
  const cover = new URL(import.meta.env.BASE_URL + 'icon-512.png', window.location.origin).href
  allowed.value = cover
  network.value = true
  update(draft => Object.assign(draft, defaults(), {
    type: 'article', title: 'Una paleta accesible para la web',
    description: 'Aprende a elegir colores, comprobar el contraste y compartir una paleta accesible desde tu primer proyecto web.',
    url: 'https://example.org/aula/paleta-accesible', siteName: 'Cuaderno de diseño',
    author: 'Aula de diseño web', image: cover, imageAlt: 'Icono de FrontKit',
    width: 512, height: 512, card: 'summary', published: '2026-10-01T09:00',
  }))
}
function selectFile(event:Event){
  const file=(event.target as HTMLInputElement).files?.[0]
  error.value=''
  if(!file)return
  if(!/^image\/(png|jpeg|webp|avif|gif)$/.test(file.type)||file.size>10_000_000){error.value='Selecciona una imagen PNG, JPEG, WebP, AVIF o GIF de hasta 10 MB.';return}
  removeLocal();allowed.value='';network.value=false;local.value=URL.createObjectURL(file);localBytes.value=file.size
}
onScopeDispose(removeLocal)
function imageFor(s:State){return local.value || (network.value&&httpUrl(s.image)===allowed.value?allowed.value:'')}
function size(e:Event,s:State){
  const img=e.target as HTMLImageElement
  if(s.width===img.naturalWidth&&s.height===img.naturalHeight)return
  return {width:Math.min(img.naturalWidth,16384),height:Math.min(img.naturalHeight,16384)}
}
function hostname(url:string){return httpUrl(url)?new URL(url).hostname:''}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{state,update}">
      <div class="usage-example">
        <button class="btn" type="button" @click="loadExample(update)">Cargar ejemplo de artículo</button>
        <small>Modifica el título y la descripción, compara las tarjetas y copia las etiquetas generadas al &lt;head&gt; de tu página.</small>
      </div>
      <label v-for="(label,key) in published" :key="key">{{label}}<input type="text" :maxlength="limits[key]" :value="state[key]" @input="update(s=>{if(key==='image'){network=false;allowed=''}s[key]=val($event)},key)" /></label>
      <label class="description-field" for="meta-description">Descripción</label>
      <textarea id="meta-description" class="description-input" rows="4" maxlength="420" :value="state.description"
        aria-describedby="description-count" @input="update(s=>{s.description=val($event)},'description')" />
      <small id="description-count">{{state.description.length}} / 420 caracteres · Para buscadores se recomiendan hasta 155.</small>
      <div class="field-grid">
        <label>Tipo Open Graph<select :value="state.type" @change="update(s=>{s.type=val($event) as State['type']})"><option>website</option><option>article</option></select></label>
        <label>Tarjeta en X<select :value="state.card" @change="update(s=>{s.card=val($event) as State['card']})"><option>summary_large_image</option><option>summary</option></select></label>
        <label>Robots<select :value="state.robots" @change="update(s=>{s.robots=val($event) as State['robots']})"><option v-for="value in ['index, follow','noindex, follow','noindex, nofollow','index, nofollow']" :key="value">{{value}}</option></select></label>
        <label>Color del tema<input type="color" :value="state.themeColor" @input="update(s=>{s.themeColor=val($event)},'theme')" /></label>
        <label v-for="(name,key) in {width:'Ancho de imagen',height:'Alto de imagen'}" :key="key">{{name}}<input type="number" min="0" max="16384" :value="state[key]" @change="update(s=>{s[key]=Math.min(16384,Math.max(0,Number(val($event))||0))})" /></label>
      </div>
      <template v-if="state.type==='article'">
        <label>Autor del artículo<input type="text" maxlength="150" :value="state.author" @input="update(s=>{s.author=val($event)},'author')" /></label>
        <label>Fecha de publicación<input type="datetime-local" :value="state.published" @change="update(s=>{s.published=val($event)})" /></label>
      </template>
      <label>Imagen local para la vista previa<input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" @change="selectFile" /></label>
      <button v-if="local" type="button" class="btn" @click="removeLocal">Quitar imagen local</button>
      <p>La vista remota contacta con el servidor de la imagen. La vista local conserva el archivo en este navegador.</p>
      <button v-if="state.image&&!local" type="button" class="btn" :aria-pressed="network" @click="network?network=false:approve(state)">{{network?'Desactivar imagen remota':'Permitir vista remota de esta imagen'}}</button>
      <p v-if="error" role="alert">{{error}}</p>
    </template>
    <template #preview="{state,update}">
      <div class="social">
        <p>Simulaciones aproximadas. Referencia consultada el 26 de noviembre de 2026.</p>
        <article v-for="([platform,caption],index) in cards" :key="platform" :class="{compact:platform==='X'&&state.card==='summary'}">
          <p><strong>{{platform}}</strong> <small>{{caption}}</small></p>
          <img v-if="imageFor(state)" :src="imageFor(state)" :alt="state.imageAlt" referrerpolicy="no-referrer"
            @load="event=>{if(index===0){const dims=size(event,state);if(dims)update(s=>Object.assign(s,dims),'image-dimensions')}}"
            @error="error='No se pudo abrir la imagen seleccionada.'" />
          <div v-else class="social-placeholder" aria-hidden="true" />
          <h3>{{state.title || 'Sin título'}}</h3><p>{{state.description}}</p><small>{{hostname(state.url) || state.siteName}}</small>
        </article>
        <h3>Comprobaciones de metadatos</h3>
        <ul><li v-for="rule in checks(state,localBytes)" :key="rule.text"><strong>{{rule.level}}</strong> · {{rule.platform}} · {{rule.text}}</li></ul>
        <p><a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener noreferrer">Depurador de Facebook</a> · <a href="https://www.linkedin.com/post-inspector/" target="_blank" rel="noopener noreferrer">Inspector de LinkedIn</a></p>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.usage-example { display:grid;justify-items:start;gap:.45rem; }
.description-input { width:100%;box-sizing:border-box;min-height:6rem;resize:vertical;padding:.65rem;font:inherit;line-height:1.5;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:.5rem; }

.social{display:grid;gap:.65rem;width:100%}.social article{overflow:hidden;padding:.75rem;border:1px solid var(--line);border-radius:.65rem;background:var(--surface);overflow-wrap:anywhere}.social article img,.social-placeholder{width:100%;aspect-ratio:1.91;object-fit:cover;border-radius:.35rem}.social-placeholder{background:linear-gradient(135deg,#1b534a,#599779 62%,#e7b14b)}.social .compact img,.social .compact .social-placeholder{width:24%;aspect-ratio:1;float:inline-start;margin-inline-end:.75rem}.social h3{margin:.35rem 0}
</style>
