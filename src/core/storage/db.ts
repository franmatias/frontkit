import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

export const stores = ['kv', 'toolStates', 'userPresets', 'projects', 'handoff', 'meta'] as const
export type Store = (typeof stores)[number]
export interface RecordValue {
  schemaVersion: number
  updatedAt: number
  state: unknown
}
type Entry = { key: string; value: RecordValue }
interface Database extends DBSchema {
  kv: Entry
  toolStates: Entry
  userPresets: Entry
  projects: Entry
  handoff: Entry
  meta: Entry
}
type Change = { store: Store; key: string; value?: RecordValue }
export type Snapshot = Record<Store, Record<string, RecordValue>>

export const emptySnapshot = (): Snapshot => ({
  kv: Object.create(null),
  toolStates: Object.create(null),
  userPresets: Object.create(null),
  projects: Object.create(null),
  handoff: Object.create(null),
  meta: Object.create(null),
})

let database: IDBPDatabase<Database> | undefined
let memory = emptySnapshot()
let channel: BroadcastChannel | undefined
let queue = Promise.resolve()
let requestedPersistence = false
const changes = new EventTarget()
const failures = new EventTarget()

export async function initStorage() {
  try {
    database = await openDB<Database>('frontkit', 1, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) for (const store of stores) db.createObjectStore(store)
      },
    })
  } catch {
    return false
  }
  if (typeof BroadcastChannel === 'function') {
    channel = new BroadcastChannel('frontkit')
    channel.addEventListener('message', () => changes.dispatchEvent(new Event('change')))
  }
  return true
}

export function onExternalChange(listener: () => void) {
  changes.addEventListener('change', listener)
  return () => changes.removeEventListener('change', listener)
}

export function onWriteFailure(listener: () => void) {
  failures.addEventListener('failure', listener)
}

export function read(store: Store, key: string) {
  return database ? database.get(store, key) : Promise.resolve(memory[store][key])
}

export async function snapshot(): Promise<Snapshot> {
  if (!database) return structuredClone(memory)
  const tx = database.transaction([...stores], 'readonly')
  const result = emptySnapshot()
  await Promise.all(stores.map(async name => {
    let cursor = await tx.objectStore(name).openCursor()
    while (cursor) {
      result[name][cursor.key] = cursor.value
      cursor = await cursor.continue()
    }
  }))
  await tx.done
  return result
}

function enqueue(operation: () => Promise<void>) {
  const run = queue.then(operation)
  queue = run.catch(() => failures.dispatchEvent(new Event('failure'))).then(() => undefined)
  return run
}

function commit(entries: Change[], clear: readonly Store[] = []) {
  return enqueue(async () => {
    if (database) {
      const names = [...new Set([...clear, ...entries.map(entry => entry.store)])]
      if (!names.length) return
      const tx = database.transaction(names, 'readwrite')
      const operations = [...clear.map(name => tx.objectStore(name).clear())]
      await Promise.all([
        ...operations,
        ...entries.map(({ store, key, value }) => value
          ? tx.objectStore(store).put(value, key)
          : tx.objectStore(store).delete(key)),
        tx.done,
      ])
    } else {
      for (const store of clear) memory[store] = Object.create(null)
      for (const { store, key, value } of entries) {
        if (value) memory[store][key] = value
        else delete memory[store][key]
      }
    }
    channel?.postMessage('change')
  })
}

function requestPersistence() {
  if (!requestedPersistence && database) {
    requestedPersistence = true
    void navigator.storage?.persist?.().catch(() => {})
  }
}
const record = (state: unknown, schemaVersion = 1): RecordValue => ({ schemaVersion, state: structuredClone(state), updatedAt: Date.now() })
export function write(store: Store, key: string, state: unknown, schemaVersion = 1) {
  requestPersistence()
  return commit([{ store, key, value: record(state, schemaVersion) }])
}
const rememberedKeys = ['readability:text', 'json:input'] as const
export function writeSettings(state: unknown, rememberInput: boolean) {
  requestPersistence()
  const entries: Change[] = [{ store: 'kv', key: 'settings', value: record(state) }]
  if (!rememberInput) for (const key of rememberedKeys) entries.push({ store: 'kv', key })
  return commit(entries)
}
function permitsRemembering(current: unknown) {
  if (!current || typeof current !== 'object' || !('preferences' in current)) return true
  const preferences = current.preferences
  return !preferences || typeof preferences !== 'object' || !('rememberInput' in preferences) || preferences.rememberInput !== false
}
export function writeRememberedInput(key: (typeof rememberedKeys)[number], state: unknown) {
  const value = record(state)
  return enqueue(async () => {
    if (database) {
      const tx = database.transaction('kv', 'readwrite')
      const settings = await tx.store.get('settings')
      if (permitsRemembering(settings?.state)) await tx.store.put(value, key)
      await tx.done
    } else if (permitsRemembering(memory.kv.settings?.state)) {
      memory.kv[key] = value
    }
  })
}

export const remove = (store: Store, key: string) => commit([{ store, key }])
export const resetStorage = () => commit([], stores)
export const clearToolStates = () => commit([], ['toolStates'])

export function restore(data: Snapshot, replace: boolean) {
  const entries = stores.flatMap(store => Object.entries(data[store]).map(([key, value]) => ({
    store, key, value,
  })))
  return commit(entries, replace ? stores : [])
}
