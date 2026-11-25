<script setup lang="ts">
import { useId } from 'vue'
import { clamp } from '../../lib/css'
const props = withDefaults(defineProps<{ label: string; modelValue: number; min: number; max: number; step?: number }>(), { step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const id = useId()
function update(event: Event) {
  const input = event.target as HTMLInputElement
  if (!Number.isFinite(input.valueAsNumber)) {
    input.value = String(props.modelValue)
    return
  }
  const value = clamp(input.valueAsNumber, props.min, props.max)
  input.value = String(value)
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="range-field">
    <label :for="id">{{ label }}</label>
    <input :id="id" type="range" :value="modelValue" :min="min" :max="max" :step="step" @input="update" />
    <input type="number" :aria-label="label" :value="modelValue" :min="min" :max="max" :step="step" @change="update" />
  </div>
</template>
