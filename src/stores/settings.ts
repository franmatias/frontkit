import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as v from 'valibot'
import { read, write, writeSettings } from '../core/storage/db'

const range = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max))
const schema = v.strictObject({
  theme: v.picklist(['light', 'dark', 'system']),
  locale: v.literal('es-ES'),
  editor: v.strictObject({
    fontSize: range(10, 32), tabSize: range(1, 8), wordWrap: v.boolean(),
    minimap: v.boolean(), autoRun: v.boolean(), loopProtection: v.optional(v.boolean(), true), autoRunDelayMs: range(100, 5000),
  }),
  preferences: v.strictObject({
    defaultColorFormat: v.picklist(['hex', 'rgb', 'hsl', 'oklch']),
    defaultUnit: v.picklist(['px', '%', 'rem']), autoCopyOnClick: v.boolean(),
    rememberInput: v.optional(v.boolean(), true), showTailwindByDefault: v.boolean(), colorContrastMethod: v.picklist(['wcag', 'apca']),
  }),
})
export type Settings = v.InferOutput<typeof schema>

const defaults = (): Settings => ({
  theme: 'system', locale: 'es-ES',
  editor: { fontSize: 14, tabSize: 2, wordWrap: true, minimap: false, autoRun: false, loopProtection: true, autoRunDelayMs: 350 },
  preferences: {
    defaultColorFormat: 'hex', defaultUnit: 'px', autoCopyOnClick: false,
    rememberInput: true, showTailwindByDefault: false, colorContrastMethod: 'wcag',
  },
})

export const useSettingsStore = defineStore('settings', () => {
  const data = ref(defaults())
  const googleFonts = ref(false)
  const setGoogleFonts = (value: boolean) => {
    googleFonts.value = value
    void write('kv', 'consent:google-fonts', value).catch(() => {})
  }
  async function hydrate() {
    const [stored, consent] = await Promise.all([read('kv', 'settings'), read('kv', 'consent:google-fonts')])
    googleFonts.value = consent?.state === true
    const result = v.safeParse(schema, stored?.state)
    data.value = stored?.schemaVersion === 1 && result.success ? result.output : defaults()
  }
  function save() {
    const result = v.safeParse(schema, data.value)
    if (!result.success) return
    void writeSettings(result.output, result.output.preferences.rememberInput).catch(() => {})
  }
  function cycleTheme() {
    const values = ['light', 'dark', 'system'] as const
    data.value.theme = values[(values.indexOf(data.value.theme) + 1) % values.length]
    save()
  }
  return { data, googleFonts, setGoogleFonts, hydrate, save, cycleTheme }
})
