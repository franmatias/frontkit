import type { GenericSchema } from 'valibot'
import { parse } from 'valibot'

export interface Preset<S> {
  id: string
  nameKey?: string
  name?: string
  state: S
  builtin: boolean
}

export interface ToolLogic<S> {
  id: string
  schemaVersion: number
  defaultState: () => S
  schema: GenericSchema<S>
  migrate: (raw: unknown, fromVersion: number) => S
  transient?: (keyof S)[]
  shareExclude?: (keyof S)[]
  neverPersist?: (keyof S)[]
  outputs: Record<string, (state: S) => string>
  presets: Preset<S>[]
  random?: () => S
}

export function defineTool<S>(tool: Omit<ToolLogic<S>, 'schemaVersion' | 'migrate'>): ToolLogic<S> {
  return {
    ...tool,
    schemaVersion: 1,
    migrate(raw, fromVersion) {
      if (fromVersion !== 1) throw new Error('Unsupported schema version')
      const cleaned = raw && typeof raw === 'object' && tool.neverPersist?.length ? { ...raw } : raw
      if (cleaned !== raw && cleaned && typeof cleaned === 'object') {
        for (const key of tool.neverPersist ?? []) Reflect.deleteProperty(cleaned, key)
      }
      return parse(tool.schema, cleaned)
    },
  }
}

export const encoderPrivateFields = ['hmacKey', 'hashInput'] as const
export function projectToolState<S>(logic: ToolLogic<S>, state: S, purpose: 'share' | 'store') {
  const selected = { ...state }
  for (const key of [...(logic.neverPersist ?? []), ...((purpose === 'share' ? logic.shareExclude : logic.transient) ?? [])]) delete selected[key]
  return selected
}