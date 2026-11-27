<script setup lang="ts">
import { onMounted, onScopeDispose, ref, shallowRef, useId } from 'vue'
import { onExternalChange, remove, snapshot, write } from '../../core/storage/db'
import { changeFlag, flagOptions, maxPattern, maxText, presetState, type RegexState } from './model'

const props = defineProps<{ current: RegexState }>()
const emit = defineEmits<{ load: [state: RegexState] }>()
type PersonalTemplate = { id: string; name: string; state: RegexState }

const prefix = 'regex-kit:'
const nameLimit = 80
const templates = shallowRef<PersonalTemplate[]>([])
const dialog = ref<HTMLDialogElement>()
const dialogTitle = useId()
const name = ref('')
const draft = ref<RegexState>({ pattern: '', flags: '', text: '' })
const editing = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
let refreshId = 0

async function refresh() {
  const request = ++refreshId
  try {
    const entries = Object.entries((await snapshot()).userPresets)
    if (request !== refreshId) return
    templates.value = entries.flatMap(([key, entry]) => {
      if (!key.startsWith(prefix) || entry.schemaVersion !== 1) return []
      const data = entry.state as { name?: unknown; state?: Partial<RegexState> } | undefined
      if (typeof data?.name !== 'string' || !data.name.trim() || data.name.length > nameLimit) return []
      const state = data.state
      if (typeof state?.pattern !== 'string' || !state.pattern || state.pattern.length > maxPattern ||
        typeof state?.text !== 'string' || state.text.length > maxText ||
        typeof state.flags !== 'string' || !/^[dgimsuvy]*$/.test(state.flags) ||
        new Set(state.flags).size !== state.flags.length || (state.flags.includes('u') && state.flags.includes('v'))) return []
      return [{ id: key.slice(prefix.length), name: data.name, state: presetState(state as RegexState) }]
    }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  } catch {
    if (request === refreshId) notice.value = 'No se pudieron leer las plantillas guardadas.'
  }
}
onMounted(() => { void refresh() })
const stop = onExternalChange(() => { void refresh() })
onScopeDispose(() => { refreshId++; stop() })

function open(item?: PersonalTemplate) {
  editing.value = item?.id ?? ''
  name.value = item?.name ?? ''
  draft.value = presetState(item?.state ?? props.current)
  error.value = ''
  dialog.value?.showModal()
}
async function save() {
  const label = name.value.trim()
  if (busy.value || !label || !draft.value.pattern) return
  const id = editing.value || crypto.randomUUID()
  busy.value = true
  error.value = ''
  try {
    await write('userPresets', prefix + id, { name: label, state: presetState(draft.value) })
    notice.value = editing.value ? 'Cambios guardados.' : 'Plantilla guardada.'
    dialog.value?.close()
    await refresh()
  } catch {
    error.value = 'No se pudo guardar la plantilla.'
  } finally {
    busy.value = false
  }
}
async function deleteTemplate(item: PersonalTemplate) {
  if (busy.value || !confirm('¿Eliminar la plantilla «' + item.name + '»?')) return
  busy.value = true
  try {
    await remove('userPresets', prefix + item.id)
    notice.value = 'Plantilla eliminada.'
    await refresh()
  } catch {
    notice.value = 'No se pudo eliminar la plantilla.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <details class="regex-templates">
    <summary>Mis plantillas<span v-if="templates.length"> ({{ templates.length }})</span></summary>
    <p>Guarda el patrón, las banderas y el texto de prueba en este navegador.</p>
    <button class="btn" type="button" :disabled="!current.pattern || busy" @click="open()">Guardar plantilla actual</button>
    <ul v-if="templates.length" class="personal-list">
      <li v-for="item in templates" :key="item.id">
        <div><strong>{{ item.name }}</strong><code>{{ item.state.pattern }}</code></div>
        <div class="actions">
          <button class="btn" type="button" :aria-label="'Cargar ' + item.name" @click="emit('load', presetState(item.state))">Cargar</button>
          <button class="btn" type="button" :disabled="busy" :aria-label="'Editar ' + item.name" @click="open(item)">Editar</button>
          <button class="btn danger" type="button" :disabled="busy" :aria-label="'Eliminar ' + item.name" @click="deleteTemplate(item)">Eliminar</button>
        </div>
      </li>
    </ul>
    <p v-if="notice" role="status">{{ notice }}</p>
  </details>

  <dialog ref="dialog" class="dialog-card template-dialog" :aria-labelledby="dialogTitle" @cancel="busy && $event.preventDefault()">
    <h2 :id="dialogTitle">{{ editing ? 'Editar plantilla' : 'Nueva plantilla' }}</h2>
    <form @submit.prevent="save">
      <label>Nombre<input v-model="name" :maxlength="nameLimit" required autofocus /></label>
      <label>Patrón de la plantilla<textarea v-model="draft.pattern" rows="3" :maxlength="maxPattern" required spellcheck="false"></textarea></label>
      <fieldset>
        <legend>Banderas de la plantilla</legend>
        <label v-for="[flag, label] in flagOptions" :key="flag" :title="label">
          <input type="checkbox" :checked="draft.flags.includes(flag)" :aria-label="flag + ' en plantilla · ' + label"
            @change="draft.flags = changeFlag(draft.flags, flag, ($event.target as HTMLInputElement).checked)" />
          <code>{{ flag }}</code>
        </label>
      </fieldset>
      <label>Texto de prueba de la plantilla<textarea v-model="draft.text" rows="4" :maxlength="maxText" spellcheck="false"></textarea></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="actions">
        <button type="button" class="btn" :disabled="busy" @click="dialog?.close()">Cancelar</button>
        <button type="submit" class="btn primary" :disabled="busy || !name.trim() || !draft.pattern">Guardar</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.regex-templates { min-width:0;padding:.7rem;border:1px solid var(--line);border-radius:.65rem }
.regex-templates summary { font-weight:650 }
.regex-templates p { margin:.55rem 0;color:var(--muted) }
.personal-list { display:grid;gap:.5rem;list-style:none;margin:.6rem 0 0;padding:0 }
.personal-list li { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.4rem .8rem;padding:.5rem 0;border-top:1px solid var(--line) }
.personal-list li > div:first-child { display:grid;gap:.2rem;min-width:0;overflow-wrap:anywhere }
.template-dialog { width:min(36rem,calc(100% - 2rem));max-height:calc(100dvh - 2rem);overflow:auto }
.template-dialog form { display:grid;gap:.7rem }
.template-dialog form > label { display:grid;gap:.25rem }
.template-dialog textarea { width:100%;min-width:0;resize:vertical;font-family:ui-monospace,Consolas,monospace }
.template-dialog fieldset { display:flex;flex-wrap:wrap;gap:.5rem 1rem }
.template-dialog fieldset label { display:flex;align-items:center;gap:.25rem }
</style>
