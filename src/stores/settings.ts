import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as v from 'valibot'
import { read, write } from '../core/storage/db'

const range = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max))
const schema = v.strictObject({
  theme: v.picklist(['light', 'dark', 'system']),
  locale: v.literal('es-ES'),
  editor: v.strictObject({
    fontSize: range(10, 32), tabSize: range(1, 8), wordWrap: v.boolean(),
    minimap: v.boolean(), autoRun: v.boolean(), autoRunDelayMs: range(100, 5000),
  }),
  preferences: v.strictObject({
    defaultColorFormat: v.picklist(['hex', 'rgb', 'hsl', 'oklch']),
    defaultUnit: v.picklist(['px', '%', 'rem']), autoCopyOnClick: v.boolean(),
    showTailwindByDefault: v.boolean(), colorContrastMethod: v.picklist(['wcag', 'apca']),
  }),
})
export type Settings = v.InferOutput<typeof schema>

const defaults = (): Settings => ({
  theme: 'system', locale: 'es-ES',
  editor: { fontSize: 14, tabSize: 2, wordWrap: true, minimap: false, autoRun: false, autoRunDelayMs: 600 },
  preferences: {
    defaultColorFormat: 'hex', defaultUnit: 'px', autoCopyOnClick: false,
    showTailwindByDefault: false, colorContrastMethod: 'wcag',
  },
})

export const useSettingsStore = defineStore('settings', () => {
  const data = ref(defaults())
  async function hydrate() {
    const stored = await read('kv', 'settings')
    const result = v.safeParse(schema, stored?.state)
    data.value = stored?.schemaVersion === 1 && result.success ? result.output : defaults()
  }
  function save() {
    const result = v.safeParse(schema, data.value)
    if (result.success) void write('kv', 'settings', result.output).catch(() => {})
  }
  function cycleTheme() {
    const values = ['light', 'dark', 'system'] as const
    data.value.theme = values[(values.indexOf(data.value.theme) + 1) % values.length]
    save()
  }
  return { data, hydrate, save, cycleTheme }
})
