<script setup lang="ts">
import { ref } from 'vue'
type Point = { x: number; y: number }
const props = defineProps<{ points: Point[]; label: string; grid?: boolean; title?: (index: number) => string; axis?: (index: number) => 'x' | 'y' }>()
const emit = defineEmits<{ move: [index: number, point: Point]; edge: [point: Point]; remove: [index: number] }>()
const canvas = ref<HTMLElement>()
const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)) * 10) / 10
function position(event: PointerEvent | MouseEvent): Point {
  const box = canvas.value!.getBoundingClientRect()
  return { x: clamp((event.clientX - box.left) / box.width * 100), y: clamp((event.clientY - box.top) / box.height * 100) }
}
function start(event: PointerEvent) {
  if (event.button === 0) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent, index: number) {
  if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) emit('move', index, position(event))
}
function key(event: KeyboardEvent, index: number) {
  if (event.key === 'Delete') { event.preventDefault(); emit('remove', index); return }
  const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const offset = offsets[event.key]
  if (!offset) return
  const axis = props.axis?.(index)
  const step = event.shiftKey ? 10 : 1
  const sign = offset[0] || offset[1]
  const previous = props.points[index]!
  emit('move', index, {
    x: clamp(previous.x + (axis === 'x' ? sign : axis === 'y' ? 0 : offset[0]) * step),
    y: clamp(previous.y + (axis === 'y' ? sign : axis === 'x' ? 0 : offset[1]) * step),
  })
  event.preventDefault()
}
</script>
<template>
  <div ref="canvas" class="point-canvas" :class="{ grid }" role="group" :aria-label="label" @click.self="emit('edge', position($event))">
    <slot />
    <button v-for="(point, index) in points" :key="index" type="button" class="point" role="slider"
      :style="{ left: point.x + '%', top: point.y + '%' }"
      :aria-label="title?.(index) ?? ('Punto ' + (index + 1))"
      :aria-orientation="axis?.(index) === 'y' ? 'vertical' : 'horizontal'"
      :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="axis?.(index) === 'y' ? point.y : point.x"
      :aria-valuetext="point.x + ' %, ' + point.y + ' %'"
      @pointerdown="start" @pointermove="move($event, index)" @keydown="key($event, index)" />
  </div>
</template>
<style scoped>
.point-canvas{position:relative;inline-size:min(100%, 300px);aspect-ratio:1;margin:1rem auto;background:#dce9e2;isolation:isolate}
.grid{background-image:linear-gradient(to right,#31584824 1px,transparent 1px),linear-gradient(to bottom,#31584824 1px,transparent 1px);background-size:10% 10%}
.point{position:absolute;z-index:2;translate:-50% -50%;width:1.25rem;height:1.25rem;padding:0;border:2px solid #fff;background:#134d40;border-radius:50%;box-shadow:0 0 0 1px #11352d;touch-action:none;cursor:grab}
.point:focus-visible{outline:3px solid #e87524;z-index:3}
</style>
