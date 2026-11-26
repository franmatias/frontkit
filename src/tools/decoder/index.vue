<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '../../composables/useClipboard'
import { decodeToken, inspectUrl, keyKind, maxInput, possibleEncoding, rebuildUrl, verifyToken, type Verification } from './logic'

const { t } = useI18n()
const label = (key: string) => t('detail.decoder.' + key)
const copy = useClipboard()
const tab = ref<'jwt' | 'url'>('jwt')
const source = ref('')
const material = ref('')
const verification = ref<Verification>()
const checking = ref(false)
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onUnmounted(() => clearInterval(timer))
const decoded = computed(() => source.value.trim() ? decodeToken(source.value, now.value) : undefined)
const token = computed(() => decoded.value && 'token' in decoded.value ? decoded.value.token : undefined)
const type = computed(() => token.value && keyKind(token.value.algorithm))
const claims = ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']
const local = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'medium' })
const relative = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })
function relativeTime(seconds: number) {
  const remaining = seconds - now.value / 1000
  const scale: [Intl.RelativeTimeFormatUnit, number][] = [['year',31536000],['day',86400],['hour',3600],['minute',60],['second',1]]
  const [unit, length] = scale.find(([,length]) => Math.abs(remaining) >= length) ?? scale[4]
  return relative.format(Math.round(remaining / length), unit)
}
let run = 0
watch(source, () => { material.value = '' }, { flush: 'sync' })
watch([source, material], () => {
  run++
  checking.value = false
  verification.value = undefined
}, { flush: 'sync' })
async function verify() {
  if (!token.value || !material.value) return
  const id = ++run
  checking.value = true
  const result = await verifyToken(token.value, material.value)
  if (run === id) {
    verification.value = result
    checking.value = false
  }
}

const link = ref('')
const url = computed(() => inspectUrl(link.value))
const fields = ['protocol', 'host', 'port', 'path', 'query', 'hash'] as const
const params = ref<[string, string][]>([])
const nested = ref<string>()
const component = ref('')
const converted = ref('')
const badComponent = ref(false)
const rebuilt = computed(() => url.value ? rebuildUrl(link.value.trim(), params.value) : '')
const summary = computed(() => url.value ? JSON.stringify(inspectUrl(rebuilt.value), null, 2) : '')
const duplicates = computed(() => {
  const counts = new Map<string, number>()
  for (const [name] of params.value) counts.set(name, (counts.get(name) ?? 0) + 1)
  return counts
})
watch(link, () => {
  params.value = url.value?.params.map(([key, value]) => [key, value]) ?? []
  nested.value = undefined
})
function inspect(value: string) {
  const found = possibleEncoding(value)
  if (found?.kind === 'jwt') {
    source.value = found.text
    tab.value = 'jwt'
  } else nested.value = found?.text
}
function convert(encode: boolean) {
  try { converted.value = encode ? encodeURIComponent(component.value) : decodeURIComponent(component.value); badComponent.value = false }
  catch { converted.value = ''; badComponent.value = true }
}
</script>

<template>
  <div class="workspace decoder">
    <header class="tool-heading">
      <div><p class="kicker">{{ t('category.data') }}</p><h1>{{ t('tools.decoder.name') }}</h1><p>{{ t('tools.decoder.description') }}</p></div>
    </header>
    <p class="notice">{{ label('private') }}</p>
    <div class="actions" role="group" :aria-label="label('mode')">
      <button v-for="mode in ['jwt','url'] as const" :key="mode" type="button" class="btn" :aria-pressed="tab === mode" @click="tab = mode">{{ mode.toUpperCase() }}</button>
    </div>
    <template v-if="tab === 'jwt'">
      <section class="panel">
        <p class="notice">{{ label('decodeOnly') }}</p>
        <label>{{ label('jwt') }}<textarea v-model="source" :maxlength="maxInput" spellcheck="false" autocomplete="off" autocapitalize="off" /></label>
        <div class="actions">
          <button class="btn" type="button" :disabled="!source" @click="source = ''">{{ label('clear') }}</button>
          <strong v-if="token">{{ label('algorithm') }} {{ token.algorithm }} · {{ label('states.' + token.status) }}</strong>
        </div>
        <p v-if="decoded && 'error' in decoded" class="notice" role="alert">{{ label('errors.' + decoded.error) }}</p>
      </section>
      <template v-if="token">
        <ul v-if="token.warnings.length" class="notice"><li v-for="warning in new Set(token.warnings)" :key="warning">{{ label('warnings.' + warning) }}</li></ul>
        <div class="parts">
          <section v-for="part in ['header','payload'] as const" :key="part" class="panel">
            <div class="panel-top"><h2>{{ label(part) }}</h2><button class="btn" type="button" @click="copy(token[part])">{{ t('tool.copy') }}</button></div>
            <pre><code>{{ token[part] }}</code></pre>
          </section>
        </div>
        <section v-if="token.dates.length" class="panel">
          <h2>{{ label('dates') }}</h2>
          <div class="table-scroll" tabindex="0" role="region" :aria-label="label('dates')">
            <table><thead><tr><th scope="col">{{ label('claim') }}</th><th scope="col">{{ label('local') }}</th><th scope="col">UTC</th><th scope="col">{{ label('relative') }}</th></tr></thead>
              <tbody><tr v-for="date in token.dates" :key="date.name">
                <th scope="row">{{ date.name }}</th><td>{{ local.format(date.seconds * 1000) }}</td>
                <td>{{ new Date(date.seconds * 1000).toISOString() }}</td><td>{{ relativeTime(date.seconds) }}</td>
              </tr></tbody></table>
          </div>
        </section>
        <section v-if="type" class="panel">
          <h2>{{ label('verify') }}</h2>
          <p>{{ label('verificationScope') }}</p>
          <label v-if="type === 'secret'">{{ label('secret') }}<input v-model="material" type="password" :maxlength="maxInput" autocomplete="off" /></label>
          <label v-else>{{ label('public') }}<textarea v-model="material" :maxlength="maxInput" autocomplete="off" spellcheck="false" /></label>
          <button type="button" class="btn" :disabled="!material || checking" @click="verify">{{ label(checking ? 'checking' : 'verify') }}</button>
          <p v-if="verification" role="status">{{ label('results.' + verification) }}</p>
        </section>
        <details class="panel">
          <summary>{{ label('standard') }}</summary>
          <dl><template v-for="claim in claims" :key="claim"><dt><code>{{ claim }}</code></dt><dd>{{ label('claims.' + claim) }}</dd></template></dl>
        </details>
      </template>
    </template>
    <template v-else>
      <section class="panel">
        <label>{{ label('url') }}<textarea v-model="link" :maxlength="maxInput" spellcheck="false" autocomplete="off" /></label>
        <p v-if="link.trim() && !url" class="notice" role="alert">{{ label('errors.url') }}</p>
        <dl v-if="url" class="url-fields"><template v-for="field in fields" :key="field"><dt>{{ label(field) }}</dt><dd><code>{{ url[field] || '—' }}</code></dd></template></dl>
      </section>
      <section v-if="url" class="panel">
        <div class="panel-top"><h2>{{ label('parameters') }}</h2><button type="button" class="btn" :disabled="params.length >= 200"
          @click="params.push(['',''])">{{ label('add') }}</button></div>
        <p v-if="params.length > 200" class="notice">{{ label('limitParams') }}</p>
        <div v-for="(pair, index) in params.slice(0, 200)" :key="index" class="parameter">
          <label>{{ label('key') }} {{ index + 1 }}<input v-model="pair[0]" /></label>
          <label>{{ label('value') }} {{ index + 1 }}<input v-model="pair[1]" /></label>
          <div class="actions">
            <span v-if="pair[0].endsWith('[]')" class="badge">Array</span>
            <span v-if="(duplicates.get(pair[0]) ?? 0) > 1" class="badge">{{ label('repeated') }}</span>
            <button type="button" class="btn" :aria-label="label('remove') + ' ' + (index + 1)" @click="params.splice(index, 1)">{{ label('remove') }}</button>
            <button v-if="possibleEncoding(pair[1])" type="button" class="btn" @click="inspect(pair[1])">{{ label('inspect') }} {{ possibleEncoding(pair[1])?.kind.toUpperCase() }}</button>
          </div>
        </div>
        <pre v-if="nested !== undefined"><code>{{ nested }}</code></pre>
        <div class="actions">
          <button type="button" class="btn" @click="copy(rebuilt)">{{ label('copyUrl') }}</button>
          <button type="button" class="btn" @click="copy(summary)">{{ label('copyJson') }}</button>
        </div>
        <pre><code>{{ rebuilt }}</code></pre>
      </section>
      <section class="panel">
        <h2>{{ label('component') }}</h2>
        <label>{{ label('componentInput') }}<input v-model="component" :maxlength="maxInput" autocomplete="off" /></label>
        <div class="actions">
          <button class="btn" type="button" @click="convert(true)">{{ label('encode') }}</button>
          <button class="btn" type="button" @click="convert(false)">{{ label('decode') }}</button>
          <button class="btn" type="button" :disabled="!converted" @click="copy(converted)">{{ t('tool.copy') }}</button>
        </div>
        <p v-if="badComponent" role="alert">{{ label('errors.component') }}</p>
        <pre v-if="converted"><code>{{ converted }}</code></pre>
      </section>
    </template>
  </div>
</template>
<style scoped>
.parts,.parameter { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem; }
.parameter { padding:.55rem 0;border-bottom:1px solid var(--line); }
.parameter .actions { grid-column:1/-1; }
.parts section { min-width:0; }
.url-fields { display:grid;grid-template-columns:max-content minmax(0,1fr);gap:.35rem .6rem; }
textarea { display:block;width:100%;min-height:6.5rem;margin:.25rem 0 .5rem;padding:.6rem;border:1px solid var(--line);border-radius:8px;resize:vertical;font:.85rem/1.5 ui-monospace,monospace; }
pre { max-height:22rem;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere; }
code { overflow-wrap:anywhere; }
table { border-collapse:collapse;width:100%; }
td,th { text-align:left;padding:.45rem;border-bottom:1px solid var(--line); }
.table-scroll { overflow:auto; }
@media(max-width:760px){.parts,.parameter { grid-template-columns:minmax(0,1fr); }}
</style>
