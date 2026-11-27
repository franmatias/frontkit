<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Token, TokenKind } from './tokens'

const props = defineProps<{ tokens: Token[] }>()
const pageSize = 36
const visible = ref(pageSize)
watch(() => props.tokens, () => { visible.value = pageSize })
const labels: Record<TokenKind, string> = {
  literal: 'Literal', escape: 'Escape', class: 'Clase', anchor: 'Ancla',
  group: 'Grupo', quantifier: 'Cuantificador', operator: 'Operador', reference: 'Referencia',
}
</script>

<template>
  <div class="regex-reference token-breakdown" tabindex="0" role="region" aria-label="Tarjetas del desglose léxico">
    <p>Explora el patrón en orden, desde el primer carácter hasta el último.</p>
    <p v-if="!tokens.length">Escribe un patrón para ver su desglose.</p>
    <div v-else class="regex-card-grid">
      <article v-for="(token, index) in tokens.slice(0, visible)" :key="index" class="regex-card" :data-kind="token.kind">
        <header><code>{{ token.text }}</code><small>{{ labels[token.kind] }}</small></header>
        <h3>{{ token.title }}</h3>
        <p>{{ token.description }}</p>
      </article>
    </div>
    <button v-if="visible < tokens.length" class="btn more" type="button" @click="visible += pageSize">
      Mostrar más tokens ({{ tokens.length - visible }})
    </button>
  </div>
</template>

<style src="./cards.css" scoped></style>
<style scoped>
.token-breakdown { max-height:25rem;overflow:auto;scrollbar-gutter:stable }
.token-breakdown > p:first-child { margin-top:0 }
.regex-card-grid { grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr)) }
.more { margin-top:.7rem }
</style>
