<script setup lang="ts">
import { BookOpen, ChevronDown } from 'lucide-vue-next'
import { flagOptions, presets, presetState, type RegexState } from './model'
import { glossary } from './tokens'

const emit = defineEmits<{ load: [state: RegexState] }>()
const examples = [
  { name: 'Probar anclas por línea', id: 'slug' },
  { name: 'Probar grupos con nombre', id: 'date' },
  { name: 'Probar una referencia a un grupo', id: 'repeated' },
]
function tryExample(id: string) {
  const example = presets.find(item => item.id === id)
  if (example) emit('load', presetState(example))
}
</script>

<template>
  <details class="panel regex-reference regex-guide">
    <summary class="guide-toggle">
      <BookOpen :size="18" aria-hidden="true" />
      <span>Guía rápida de expresiones regulares</span>
      <ChevronDown :size="18" class="guide-chevron" aria-hidden="true" />
    </summary>
    <p>Consulta la sintaxis y las banderas de las expresiones regulares de JavaScript.</p>
    <div class="reference-scroll" tabindex="0" role="region" aria-label="Tarjetas de sintaxis y banderas">
      <div class="regex-card-grid">
        <article v-for="item in glossary" :key="item.text" class="regex-card" :data-kind="item.kind">
          <header><code>{{ item.text }}</code><h3>{{ item.title }}</h3></header>
          <p>{{ item.description }}</p>
        </article>
        <article v-for="[flag, label, explanation] in flagOptions" :key="'flag-' + flag" class="regex-card">
          <header><code>{{ flag }}</code><h3>{{ label }}</h3></header>
          <p>{{ explanation }}</p>
        </article>
      </div>
    </div>
    <details class="guide-examples">
      <summary>Construir y probar un patrón</summary>
      <ol>
        <li>Escribe <code>hola</code> en Patrón y <code>Hola, hola</code> en Texto de prueba. Usa el patrón sin las barras de <code>/hola/gi</code>.</li>
        <li>Activa <code>i</code> y <code>g</code> para encontrar las dos coincidencias.</li>
        <li>Prueba <code>^\d{5}$</code> con <code>18001</code> y <code>CP 18001</code>. Las anclas exigen que el texto completo tenga cinco dígitos.</li>
      </ol>
      <div class="actions">
        <button v-for="example in examples" :key="example.id" class="btn" type="button" @click="tryExample(example.id)">{{ example.name }}</button>
      </div>
      <p><a href="https://developer.mozilla.org/es/docs/Web/JavaScript/Guide/Regular_expressions" target="_blank" rel="noopener noreferrer">Más ejemplos en MDN</a></p>
    </details>
  </details>
</template>

<style src="./cards.css" scoped></style>
<style scoped>
.guide-toggle { display:flex;align-items:center;gap:.55rem;font-weight:650;list-style:none }
.guide-toggle::-webkit-details-marker { display:none }
.guide-toggle svg { color:var(--accent);flex:none }
.guide-chevron { margin-inline-start:auto;transform:rotate(-90deg) }
.regex-guide[open] .guide-chevron { transform:none }
.reference-scroll { max-height:19rem;overflow:auto;padding-inline-end:.3rem;scrollbar-gutter:stable }
.regex-guide .regex-card h3 { text-align:end }
.guide-examples { margin-top:.8rem }
.guide-examples li + li { margin-top:.35rem }
</style>
