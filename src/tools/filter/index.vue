<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RangeField from '../../components/shared/RangeField.vue'
import ToolWorkspace from '../../components/shared/ToolWorkspace.vue'
import { effect, filterKeys, filters, logic, samples, type FilterState } from './logic'
import { sampleImage } from './samples'

const { t } = useI18n()
const label = (key: string) => t('detail.filter.' + key)
const split = ref(50)
const image = ref('')
const notice = ref('')
const value = (event: Event) => (event.target as HTMLInputElement).value
const source = (state: FilterState) => image.value || sampleImage(state.sample)
const shadowDimensions = ['x', 'y', 'blur'] as const
function clear() {
  if (image.value) URL.revokeObjectURL(image.value)
  image.value = ''
}
function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!/^image\/(?:png|jpeg|webp|avif|gif|bmp|svg\+xml)$/.test(file.type) || file.size > 20 * 1024 * 1024) {
    notice.value = label('invalid')
    return
  }
  clear()
  image.value = URL.createObjectURL(file)
  notice.value = label('local')
}
function slide(event: PointerEvent) {
  const slider = event.currentTarget as HTMLElement
  if (!slider.hasPointerCapture(event.pointerId)) return
  const rect = slider.getBoundingClientRect()
  split.value = Math.min(100, Math.max(0, Math.round((event.clientX - rect.left) / rect.width * 100)))
}
function key(event: KeyboardEvent) {
  const step = event.shiftKey ? 10 : 1
  const values: Record<string, number> = { ArrowLeft: split.value - step, ArrowDown: split.value - step,
    ArrowRight: split.value + step, ArrowUp: split.value + step, Home: 0, End: 100 }
  if (!(event.key in values)) return
  event.preventDefault()
  split.value = Math.min(100, Math.max(0, values[event.key]))
}
onUnmounted(clear)
</script>
<template>
  <ToolWorkspace :logic="logic">
    <template #controls="{ state, update }">
      <div class="field-grid">
        <label>{{ label('target') }}
          <select :value="state.target" @change="update(d => { d.target = value($event) === 'backdrop-filter' ? 'backdrop-filter' : 'filter' })">
            <option>filter</option><option>backdrop-filter</option>
          </select>
        </label>
        <label>{{ label('sample') }}
          <select :value="image ? 'custom' : state.sample" @change="clear(); notice = ''; update(d => { d.sample = value($event) as FilterState['sample'] })">
            <option v-if="image" value="custom" disabled>{{ label('custom') }}</option>
            <option v-for="item in samples" :key="item" :value="item">{{ label(item) }}</option>
          </select>
        </label>
      </div>
      <label>{{ label('upload') }}<input type="file" accept="image/*" @change="upload" /></label>
      <p v-if="notice" role="status" class="notice">{{ notice }}</p>
      <RangeField v-for="key in filterKeys" :key="key" :label="label(key)" :min="filters[key][0]" :max="filters[key][1]"
        :model-value="state[key]" @update:model-value="update(d => { d[key] = $event }, key)" />
      <fieldset v-if="state.target === 'filter'" class="shadow-controls">
        <legend>drop-shadow</legend>
        <label class="check"><input type="checkbox" :checked="state.dropShadow.enabled" @change="update(d => { d.dropShadow.enabled = !d.dropShadow.enabled })" />{{ label('dropShadow') }}</label>
        <template v-if="state.dropShadow.enabled">
          <RangeField v-for="field in shadowDimensions" :key="field" :label="label(field)" :min="field === 'blur' ? 0 : -40" :max="40"
            :model-value="state.dropShadow[field]" @update:model-value="update(d => { d.dropShadow[field] = $event }, 'shadow-' + field)" />
          <label>{{ t('tool.color') }}<input type="color" :value="state.dropShadow.color" @input="update(d => { d.dropShadow.color = value($event) }, 'shadow-color')" /></label>
        </template>
      </fieldset>
    </template>
    <template #preview="{ state }">
      <div class="comparison" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="split"
        :aria-label="label('comparison')" :style="{ '--split': split + '%' }"
        @pointerdown="($event.currentTarget as HTMLElement).setPointerCapture($event.pointerId); slide($event)"
        @pointermove="slide" @keydown="key">
        <img :src="source(state)" alt="" draggable="false" @error="image && (clear(), notice = label('invalid'))" />
        <img v-if="state.target === 'filter'" class="after" :style="{ filter: effect(state) }" :src="source(state)" alt="" draggable="false" />
        <div v-else class="glass-area"><div class="glass" :style="{ backdropFilter: effect(state) }">{{ label('glass') }}</div></div>
        <span class="caption after-caption">{{ label('after') }}</span><span class="caption before-caption">{{ label('before') }}</span>
        <span class="split" aria-hidden="true"><span>↔</span></span>
      </div>
    </template>
  </ToolWorkspace>
</template>
<style scoped>
.comparison { width:100%;aspect-ratio:16/10;position:relative;overflow:hidden;border-radius:10px;cursor:ew-resize;touch-action:pan-y;
  background:repeating-conic-gradient(#d3e0d8 0% 25%,#eef4ef 0% 50%) 0 0/20px 20px; }
.comparison img,.glass-area { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none; }
.comparison .after { clip-path:inset(0 calc(100% - var(--split)) 0 0); }
.glass-area { clip-path:inset(0 calc(100% - var(--split)) 0 0);display:grid;place-items:center; }
.glass { width:58%;height:58%;display:grid;place-items:center;border:1px solid #ffffffa0;border-radius:15px;background:#ffffff35;color:#142f26;text-shadow:0 0 5px #fff;font-weight:700; }
.split { position:absolute;left:var(--split);top:0;bottom:0;width:2px;background:white;box-shadow:0 0 6px #000;pointer-events:none; }
.split span { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#203a30;color:white;border-radius:1rem;padding:0 .35rem; }
.caption { position:absolute;top:.35rem;background:#203a30;color:white;border-radius:5px;padding:.1rem .35rem;font-size:.8rem;pointer-events:none; }
.after-caption { left:.4rem; }.before-caption { right:.4rem; }
.shadow-controls { border:1px solid var(--line);border-radius:8px;padding:.55rem;min-width:0; }
</style>
