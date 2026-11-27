<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { converter, formatCss } from 'culori'
import RangeField from '../../components/shared/RangeField.vue'
import FileDropZone from '../../components/shared/FileDropZone.vue'

const props = defineProps<{ color: string }>()
const emit = defineEmits<{ pick: [color: string, group: string] }>()
const toLch = converter('oklch')
const channels = computed(() => toLch(props.color) ?? { mode: 'oklch' as const, l: .6, c: 0, h: 0 })
const rounded = (value: number, scale: number) => Math.round(value * scale) / scale
function change(channel: 'l' | 'c' | 'h', value: number) {
  const next = { ...channels.value, h: channels.value.h ?? 0, [channel]: channel === 'l' ? value / 100 : value }
  emit('pick', formatCss(next), 'oklch-' + channel)
}

const picture = shallowRef<HTMLImageElement>()
const point = ref({ x: 0, y: 0 })
const message = ref('')
let revision = 0
async function load(files: File[]) {
  const current = ++revision
  const file = files[0]
  if (!file) return
  if (!/^image\/(png|jpeg|webp|avif|gif|bmp)$/i.test(file.type) || file.size > 20 * 1024 * 1024) {
    message.value = 'Elige una imagen bitmap de hasta 20 MB.'
    return
  }
  const next = new Image()
  next.src = URL.createObjectURL(file)
  try {
    await next.decode()
    if (current !== revision) return
    if (picture.value) URL.revokeObjectURL(picture.value.src)
    picture.value = next
    point.value = { x: Math.floor(next.naturalWidth / 2), y: Math.floor(next.naturalHeight / 2) }
    message.value = ''
  } catch {
    if (current === revision) message.value = 'No se pudo leer la imagen.'
  } finally {
    if (picture.value !== next) URL.revokeObjectURL(next.src)
  }
}
onUnmounted(() => {
  revision++
  if (picture.value) URL.revokeObjectURL(picture.value.src)
})
function sample() {
  const image = picture.value
  if (!image) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { x, y } = point.value
  ctx.drawImage(image, x, y, 1, 1, 0, 0, 1, 1)
  const bytes = ctx.getImageData(0, 0, 1, 1).data
  const color = '#' + Array.from(bytes.slice(0, bytes[3] === 255 ? 3 : 4), n => n.toString(16).padStart(2, '0')).join('')
  emit('pick', color, '')
  message.value = 'Píxel (' + x + ', ' + y + ') · ' + color
}
function click(event: MouseEvent) {
  const image = picture.value
  if (!image) return
  if (event.detail) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const index = (fraction: number, size: number) => Math.max(0, Math.min(size - 1, Math.floor(fraction * size)))
    point.value = { x: index((event.clientX - rect.left) / rect.width, image.naturalWidth),
      y: index((event.clientY - rect.top) / rect.height, image.naturalHeight) }
  }
  sample()
}
function move(event: KeyboardEvent) {
  const delta: Record<string, [number, number]> = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }
  const step = delta[event.key], image = picture.value
  if (!step || !image) return
  event.preventDefault()
  point.value = { x: Math.max(0,Math.min(image.naturalWidth-1,point.value.x+step[0])),
    y: Math.max(0,Math.min(image.naturalHeight-1,point.value.y+step[1])) }
}
</script>
<template>
  <fieldset class="channels">
    <legend>Selector OKLCH</legend>
    <RangeField label="Luminosidad (%)" :min="0" :max="100" :step=".1" :model-value="rounded(channels.l * 100,10)" @update:model-value="change('l',$event)" />
    <RangeField label="Croma" :min="0" :max="Math.max(.4,channels.c)" :step=".001" :model-value="rounded(channels.c,1000)" @update:model-value="change('c',$event)" />
    <RangeField label="Tono (°)" :min="0" :max="360" :step="1" :model-value="Math.round(channels.h ?? 0)" @update:model-value="change('h',$event)" />
  </fieldset>
  <div class="image-picker">
    <FileDropZone label="Cargar imagen para el cuentagotas" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp" @choose="load" />
    <template v-if="picture">
      <small>Pulsa un píxel o mueve la mira con las flechas y confirma con Intro.</small>
      <button class="target" type="button" aria-label="Elegir píxel de la imagen" @click="click" @keydown="move">
        <img :src="picture.src" alt="" />
        <span :style="{ left: (point.x+.5)/picture.naturalWidth*100+'%', top: (point.y+.5)/picture.naturalHeight*100+'%' }" />
      </button>
    </template>
    <p v-if="message" role="status">{{ message }}</p>
  </div>
</template>
<style scoped>
.channels,.image-picker { display:grid;gap:.5rem;min-width:0; }
.channels { border:1px solid var(--line);border-radius:.65rem;padding:.55rem .75rem; }
.channels legend { padding-inline:.35rem;font-weight:650; }
.target { position:relative;display:block;justify-self:start;max-width:100%;padding:0;border:0;overflow:hidden;cursor:crosshair; }
.target img { display:block;width:auto;height:auto;max-width:100%;max-height:20rem; }
.target span { position:absolute;transform:translate(-50%,-50%);width:.85rem;height:.85rem;border:2px solid white;border-radius:50%;box-shadow:0 0 0 1px black,inset 0 0 0 1px black;pointer-events:none; }
</style>
