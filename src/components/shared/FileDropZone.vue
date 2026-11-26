<script setup lang="ts">
import { ref } from 'vue'
const props=defineProps<{label:string;accept:string;multiple?:boolean;disabled?:boolean}>()
const emit=defineEmits<{choose:[files:File[]]}>()
const active=ref(false)
function select(files?:FileList|null){
  if(!files?.length||props.disabled)return
  emit('choose',Array.from(files))
}
function drop(event:DragEvent){
  active.value=false;select(event.dataTransfer?.files)
}
</script>
<template>
  <div class="drop-zone" :class="{active}" @dragover.prevent="active=true" @dragleave="active=false" @drop.prevent="drop">
    <label>{{label}}<input type="file" :accept="accept" :multiple="multiple" :disabled="disabled" @change="select(($event.target as HTMLInputElement).files);($event.target as HTMLInputElement).value=''" /></label>
    <small>También puedes arrastrar archivos aquí.</small>
  </div>
</template>
<style scoped>.drop-zone{border:1px dashed var(--line);border-radius:.6rem;padding:.65rem}.drop-zone.active{background:var(--accent-soft);outline:2px solid var(--accent)}</style>
