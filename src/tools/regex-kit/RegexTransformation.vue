<script setup lang="ts">
import { computed, useId } from 'vue'
import { maxReplacement, maxText, type Transformation, type Transformed } from './model'

const props = defineProps<{ pending: boolean; hasPattern: boolean; error: string; result?: Transformed }>()
const emit = defineEmits<{ copy: [text: string]; apply: [text: string] }>()
const enabled = defineModel<boolean>('enabled', { required: true })
const options = defineModel<Transformation>({ required: true })
const id = useId()
const resultText = computed(() => props.result && 'text' in props.result ? props.result.text : undefined)
function change(key: keyof Transformation, event: Event) {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value
  options.value = { ...options.value, [key]: value }
}
</script>

<template>
  <section class="panel transformation">
    <h2>Sustitución y transformación en vivo</h2>
    <label class="check"><input v-model="enabled" type="checkbox" />Activar transformación</label>
    <div v-if="enabled" class="transformation-fields">
      <div class="transformation-controls">
        <label :for="id + '-mode'">Operación</label>
        <select :id="id + '-mode'" :value="options.mode" @change="change('mode', $event)">
          <option value="replace">Sustituir con referencias a capturas</option>
          <option value="literal">Sustituir con texto literal</option>
          <option value="upper">Convertir coincidencias a mayúsculas</option>
          <option value="lower">Convertir coincidencias a minúsculas</option>
        </select>
        <template v-if="options.mode === 'replace' || options.mode === 'literal'">
          <label :for="id + '-template'">Texto de sustitución</label>
          <textarea :id="id + '-template'" rows="4" :value="options.template" :maxlength="maxReplacement"
            :aria-describedby="id + '-help'" spellcheck="false" @input="change('template', $event)"></textarea>
          <small :id="id + '-help'">
            <template v-if="options.mode === 'replace'"><code>$&amp;</code> inserta la coincidencia, <code>$1</code> el primer grupo,
              <code>$&lt;nombre&gt;</code> un grupo nombrado y <code>$$</code> el signo dólar. </template>
            Deja el texto vacío para eliminar la coincidencia.
          </small>
        </template>
        <small>La bandera <code>g</code> aplica la operación a todas las coincidencias.</small>
      </div>
      <div class="transformation-controls">
        <label :for="id + '-result'">Resultado de la transformación</label>
        <textarea :id="id + '-result'" rows="6" :value="resultText ?? ''" readonly :aria-busy="pending"></textarea>
        <p v-if="pending" role="status">Calculando resultado…</p>
        <p v-else-if="error">El resultado estará disponible cuando se pueda evaluar el patrón.</p>
        <p v-else-if="!hasPattern">Escribe un patrón para empezar.</p>
        <p v-else-if="result && 'limited' in result" role="status">El resultado supera el límite de 200 000 caracteres. Acorta la entrada o el texto de sustitución.</p>
        <p v-else-if="resultText === ''">El resultado está vacío.</p>
        <p v-else-if="resultText && resultText.length > maxText">El resultado es demasiado largo para abrirlo en el editor. Puedes copiarlo.</p>
        <div class="actions">
          <button class="btn" type="button" :disabled="resultText === undefined"
            @click="emit('copy', resultText ?? '')">Copiar resultado</button>
          <button class="btn" type="button" :disabled="resultText === undefined || resultText.length > maxText"
            @click="emit('apply', resultText ?? '')">Usar como texto de prueba</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.transformation { min-width:0;padding:1rem }
.transformation h2 { margin:0 0 .6rem;font-size:1.1rem }
.transformation-fields { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:1rem;margin-top:.65rem }
.transformation-controls { display:grid;align-content:start;gap:.4rem;min-width:0 }
.transformation-controls select,.transformation-controls textarea { width:100%;min-width:0 }
.transformation-controls textarea { padding:.65rem;resize:vertical;font:.88rem/1.5 ui-monospace,Consolas,monospace }
.transformation-controls p,.transformation-controls small { margin:0;color:var(--muted);overflow-wrap:anywhere }
</style>
