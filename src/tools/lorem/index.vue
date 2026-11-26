<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { useClipboard } from '../../composables/useClipboard'
import { cleanText, invisibleCount, markedText, pastedHtml } from '../../lib/text/clean'
import { blocks, limits, logic, type State } from './logic'

const { t } = useI18n()
const label = (key: string) => t('detail.lorem.' + key)
const copy = useClipboard()
const input = ref('')
const flags = ['stripInvisible', 'replaceNbsp', 'straightQuotes', 'collapse', 'markdown'] as const
const value = (event: Event) => (event.target as HTMLInputElement).value
const marks = computed(() => markedText(input.value.slice(0, 10000)))
const count = computed(() => invisibleCount(input.value))
function paste(event: ClipboardEvent, state: State) {
  const html = event.clipboardData?.getData('text/html')
  const plain = event.clipboardData?.getData('text/plain')
  if (!html && plain === undefined) return
  event.preventDefault()
  try {
    const text = html ? pastedHtml(html, state.markdown) : plain
    input.value = (text ?? '').slice(0, 100 * 1024)
  } catch { input.value = (plain ?? '').slice(0, 100 * 1024) }
}
function changeMode(draft: State, mode: State['mode']) {
  draft.mode = mode
  draft.count = Math.min(draft.count, limits[mode])
}
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <div class="field-grid">
        <label>{{ label('mode') }}<select :value="state.mode" @change="update(d => changeMode(d, value($event) as State['mode']))">
          <option v-for="mode in Object.keys(limits)" :key="mode" :value="mode">{{ label(mode) }}</option>
        </select></label>
        <label>{{ label('language') }}<select :value="state.language" @change="update(d => { d.language = value($event) === 'es' ? 'es' : 'latin' })">
          <option value="latin">{{ label('latin') }}</option><option value="es">{{ label('spanish') }}</option>
        </select></label>
        <label>{{ label('structure') }}<select :value="state.structure" @change="update(d => { d.structure = value($event) as State['structure'] })">
          <option v-for="structure in ['paragraph','list','heading']" :key="structure" :value="structure">{{ label(structure) }}</option>
        </select></label>
        <label>{{ label('seed') }}<input :value="state.seed" maxlength="80" @change="update(d => { d.seed = value($event) })" /></label>
      </div>
      <RangeField :label="label('count')" :min="1" :max="limits[state.mode]" :model-value="Math.min(state.count, limits[state.mode])"
        @update:model-value="update(d => { d.count = Math.round($event) }, 'count')" />
      <label class="check"><input :checked="state.opening" type="checkbox" @change="update(d => { d.opening = !d.opening })" />{{ label('opening') }}</label>
      <label v-if="state.mode === 'characters'" class="check"><input :checked="state.exact" type="checkbox" @change="update(d => { d.exact = !d.exact })" />{{ label('exact') }}</label>
      <div class="control-group">
        <h3>{{ label('truncate') }}</h3>
        <RangeField :label="label('width')" :min="12" :max="100" :model-value="state.width" @update:model-value="update(d => { d.width = Math.round($event) }, 'width')" />
        <RangeField v-if="!state.singleLine" :label="label('lineCount')" :min="1" :max="8" :model-value="state.lines"
          @update:model-value="update(d => { d.lines = Math.round($event) }, 'lines')" />
        <label class="check"><input :checked="state.singleLine" type="checkbox" @change="update(d => { d.singleLine = !d.singleLine })" />{{ label('single') }}</label>
      </div>
      <details class="clean-options" open>
        <summary>{{ label('cleaner') }}</summary>
        <label v-for="key in flags" :key="key" class="check"><input type="checkbox" :checked="state[key]" @change="update(d => { d[key] = !d[key] })" />{{ label(key) }}</label>
      </details>
    </template>
    <template #preview="{ state }">
      <div class="examples">
        <div class="truncation">
          <h3>{{ label('truncate') }}</h3>
          <p class="sample" :class="{single:state.singleLine}" :style="{ width: state.width + 'ch', '-webkit-line-clamp': state.lines }">{{ blocks(state).slice(0, 4).join(' ') }}</p>
        </div>
        <div class="cleaner">
          <h3>{{ label('cleaner') }}</h3>
          <label>{{ label('paste') }}<textarea v-model="input" maxlength="102400" spellcheck="false" @paste="paste($event, state)" /></label>
          <div class="actions">
            <button class="btn" type="button" :disabled="!input" @click="copy(cleanText(input,state))">{{ label('copyClean') }}</button>
            <span role="status">{{ label('invisible') }} {{ count }} · {{ label('removed') }} {{ state.stripInvisible ? count : 0 }}</span>
          </div>
          <pre v-if="input" class="clean-result">{{ cleanText(input, state) }}</pre>
          <details v-if="count"><summary>{{ label('inspect') }}</summary><pre class="clean-result"><template v-for="(piece, i) in marks" :key="i"><mark v-if="piece.code">{{ piece.code }}</mark><span v-else>{{ piece.text }}</span></template></pre></details>
        </div>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.examples { width:100%;min-width:0;display:grid;gap:.8rem; }
.truncation,.cleaner { background:var(--surface);min-width:0;padding:.7rem;border:1px solid var(--line);border-radius:8px; }
.sample { display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;max-width:100%;border-left:3px solid var(--accent);padding-left:.35rem; }
.sample.single { display:block;white-space:nowrap;text-overflow:ellipsis; }
textarea { width:100%;min-height:6rem;resize:vertical;padding:.55rem;border:1px solid var(--line);border-radius:8px; }
.clean-result { max-height:13rem;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere; }
.clean-result mark { margin-inline:.2rem;padding:.1rem; }
summary { cursor:pointer; }
</style>
