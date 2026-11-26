<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { fieldName, fieldTypes, newField, type Field, type FieldType } from './logic'

const props = defineProps<{ fields: Field[]; depth: number }>()
const emit = defineEmits<{ edit: [fields: Field[]] }>()
const { t } = useI18n()
const label = (key: string) => t('detail.mock-data.' + key)
const value = (event: Event) => (event.target as HTMLInputElement).value
const number = (event: Event) => Number.parseInt(value(event), 10)
const compound = (field: Field) => field.type === 'object' || field.type === 'array'
const ranged = (field: Field) => ['autoincrement','integer','decimal','array'].includes(field.type)
function add() {
  let index = props.fields.length + 1
  while (props.fields.some(field => field.name === 'campo' + index)) index++
  emit('edit', [...props.fields, newField(crypto.randomUUID(), 'campo' + index)])
}
function patch(index: number, patch: Partial<Field>) {
  emit('edit', props.fields.map((field, i) => i === index ? { ...field, ...patch } : field))
}
function rename(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const name = input.value.trim()
  if (!fieldName.test(name) || props.fields.some((field, i) => i !== index && field.name === name)) {
    input.setCustomValidity(label('errors.name'))
    input.reportValidity()
    return
  }
  patch(index, { name })
}
function changeType(index: number, field: Field, type: FieldType) {
  patch(index, { type, ...(type === 'array' ? { from: 1, to: 3 } : {}),
    children: (type === 'object' || type === 'array') && !field.children.length
      ? [newField(crypto.randomUUID(), 'valor')] : field.children,
  })
}
function reviseRange(index: number, field: Field, key: 'from' | 'to', event: Event) {
  const amount = number(event)
  const min = field.type === 'array' ? 0 : -999999
  const max = field.type === 'array' ? 5 : 999999
  if (Number.isFinite(amount)) patch(index, { [key]: Math.min(max, Math.max(min, amount)) })
}
function reorder(index: number, offset: number) {
  const fields = [...props.fields]
  fields.splice(index + offset, 0, fields.splice(index, 1)[0])
  emit('edit', fields)
}
</script>

<template>
  <div class="fields">
    <details v-for="(field, i) in fields" :key="field.id" class="field">
      <summary><code>{{ field.name }}</code> <small>{{ label('types.' + field.type) }}</small></summary>
      <div class="field-grid">
        <label>{{ label('fieldName') }}<input :value="field.name" maxlength="40" @input="($event.target as HTMLInputElement).setCustomValidity('')" @change="rename(i, $event)" /></label>
        <label>{{ label('type') }}<select :value="field.type" @change="changeType(i, field, value($event) as FieldType)">
          <option v-for="type in fieldTypes.filter(type => depth < 3 || (type !== 'object' && type !== 'array'))" :key="type" :value="type">{{ label('types.' + type) }}</option>
        </select></label>
        <label>{{ label('nullable') }}<input type="number" min="0" max="100" :value="field.nullablePercent"
          @change="patch(i, { nullablePercent: Math.min(100, Math.max(0, number($event) || 0)) })" /></label>
        <label class="check"><input type="checkbox" :checked="field.unique" @change="patch(i, { unique: !field.unique })" />{{ label('unique') }}</label>
        <template v-if="ranged(field)">
          <label>{{ label('from') }}<input type="number" :value="field.from" @change="reviseRange(i, field, 'from', $event)" /></label>
          <label v-if="field.type !== 'autoincrement'">{{ label('to') }}<input type="number" :value="field.to" @change="reviseRange(i, field, 'to', $event)" /></label>
        </template>
        <template v-if="field.type === 'date' || field.type === 'datetime'">
          <label>{{ label('dateStart') }}<input type="date" :value="field.dateStart" @change="value($event) && patch(i, {dateStart: value($event)})" /></label>
          <label>{{ label('dateEnd') }}<input type="date" :value="field.dateEnd" @change="value($event) && patch(i, {dateEnd: value($event)})" /></label>
          <label class="check"><input type="checkbox" :checked="field.epoch" @change="patch(i, {epoch: !field.epoch})" />{{ label('epoch') }}</label>
        </template>
        <label v-if="field.type === 'enum' || field.type === 'pattern' || field.type === 'reference'">{{ label(field.type) }}
          <input :value="field.text" maxlength="160" :placeholder="field.type === 'pattern' ? 'USR-{####}' : field.type === 'enum' ? 'activo:3, pendiente:1' : 'id'"
            @change="patch(i, { text: value($event) })" /></label>
      </div>
      <div class="actions">
        <button type="button" class="btn" :disabled="i === 0" :aria-label="label('up') + ' ' + field.name" @click="reorder(i,-1)">↑</button>
        <button type="button" class="btn" :disabled="i + 1 === fields.length" :aria-label="label('down') + ' ' + field.name" @click="reorder(i,1)">↓</button>
        <button type="button" class="btn" :disabled="fields.length === 1" @click="emit('edit', fields.filter((_, index) => i !== index))">{{ label('remove') }}</button>
      </div>
      <FieldEditor v-if="compound(field) && depth < 3" :fields="field.children" :depth="depth + 1" @edit="patch(i, {children: $event})" />
    </details>
    <button type="button" class="btn" :disabled="fields.length >= (depth === 1 ? 16 : 12)" @click="add">{{ label('add') }}</button>
  </div>
</template>
<style scoped>
.fields { display:grid;gap:.4rem;margin:.6rem 0;min-width:0; }
.field { padding:.45rem;border:1px solid var(--line);border-radius:6px;min-width:0; }
.field summary { cursor:pointer;overflow-wrap:anywhere; }
summary small { color:var(--muted); }
</style>
