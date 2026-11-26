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
      return parse(tool.schema, raw)
    },
  }
}
