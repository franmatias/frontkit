import * as v from 'valibot'
import { type Snapshot, snapshot, stores } from './db'

const name = v.pipe(v.string(), v.regex(/^[a-z0-9-]+(?::[a-z0-9-]+)?$/), v.maxLength(120))
const entry = v.strictObject({
  schemaVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  updatedAt: v.pipe(v.number(), v.minValue(0)),
  state: v.unknown(),
})
const record = v.record(name, entry)
const backupSchema = v.strictObject({
  app: v.literal('frontkit'),
  backupVersion: v.literal(1),
  exportedAt: v.pipe(v.string(), v.isoTimestamp()),
  data: v.strictObject({
    kv: record, toolStates: record, userPresets: record, projects: record,
    handoff: record, meta: record,
  }),
})

export async function createBackup() {
  return { app: 'frontkit', backupVersion: 1, exportedAt: new Date().toISOString(), data: await snapshot() }
}

export function parseBackup(raw: string): Snapshot {
  return v.parse(backupSchema, safeJson(raw)).data
}

export function safeJson(raw: string): unknown {
  return JSON.parse(raw, (key: string, value: unknown) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe JSON key')
    return value
  })
}

export function countEntries(data: Snapshot) {
  return stores.reduce((total, store) => total + Object.keys(data[store]).length, 0)
}
