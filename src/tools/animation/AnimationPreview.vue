<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { frameStyle, sorted, timingFunction, type State } from './logic'

const props = defineProps<{ state: State }>()
const { t } = useI18n()
const label = (key: string) => t('detail.animation.' + key)
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = ref(media.matches)
const force = ref(false)
const speed = ref(1)
const playing = ref(true)
const shape = ref('square')
const sample = ref<HTMLElement>()
let animation: Animation | undefined
function reset(autoplay = playing.value) {
  animation?.cancel()
  animation = undefined
  if (!sample.value) return
  const state = props.state
  const easing = timingFunction(state)
  const frames = sorted(state).map(k => ({
    ...frameStyle(k), offset: k.percentage / 100, easing: CSS.supports('animation-timing-function', easing) ? easing : 'linear',
  }))
  animation = sample.value.animate(frames, {
    duration: state.duration, delay: state.delay, iterations: state.iterations || Infinity, direction: state.direction, fill: state.fillMode,
  })
  animation.playbackRate = speed.value
  animation.onfinish = () => { playing.value = false }
  playing.value = autoplay && (!reduced.value || force.value)
  if (!playing.value) animation.pause()
}
function play() {
  if (reduced.value && !force.value) return
  if (!animation || animation.playState === 'finished') reset(true)
  else { animation.play(); playing.value = true }
}
function pause() {
  animation?.pause()
  playing.value = false
}
function sync() {
  reduced.value = media.matches
}
onMounted(() => {
  media.addEventListener('change', sync)
  reset(props.state.playState === 'running')
})
onUnmounted(() => {
  media.removeEventListener('change', sync)
  animation?.cancel()
})
watch(() => props.state, (next, previous) => reset(next.playState === previous.playState ? playing.value : next.playState === 'running'), { flush: 'post' })
watch([shape, reduced, force], () => reset(props.state.playState === 'running'), { flush: 'post' })
watch(speed, rate => { animation?.updatePlaybackRate(rate) })
</script>
<template>
  <div class="preview-content">
    <div class="actions">
      <button class="btn" type="button" :disabled="playing || (reduced && !force)" @click="play">{{ label('play') }}</button>
      <button class="btn" type="button" :disabled="!playing" @click="pause">{{ label('pause') }}</button>
      <button class="btn" type="button" @click="reset(true)">{{ label('restart') }}</button>
      <label>{{ label('speed') }}<select v-model.number="speed"><option :value=".5">0.5×</option><option :value="1">1×</option><option :value="2">2×</option></select></label>
      <label>{{ label('sample') }}<select v-model="shape">
        <option v-for="item in ['square','button','text','icon']" :key="item" :value="item">{{ label(item) }}</option>
      </select></label>
    </div>
    <label v-if="reduced" class="check"><input v-model="force" type="checkbox" />{{ label('force') }}</label>
    <div class="stage">
      <div ref="sample" class="sample" :class="shape">{{ shape === 'icon' ? '✦' : shape !== 'square' ? 'FrontKit' : '' }}</div>
    </div>
  </div>
</template>
<style scoped>
.preview-content { width:100%;min-width:0;display:grid;gap:.6rem; }
.stage { min-height:20rem;display:grid;place-items:center;border:1px dashed #83978b;border-radius:10px;overflow:hidden;background:#e3eee7; }
.sample { height:76px;min-width:76px;padding:.35rem .65rem;display:grid;place-items:center;border-radius:16px;background:#24664f;color:white;font-weight:750; }
.sample.button { height:46px; }
.sample.text,.sample.icon { background:transparent;color:#174d3a;font-size:1.5rem; }
.sample.icon { font-size:3rem; }
</style>
