import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup'
import { initStorage, read, resetStorage, restore, snapshot, write } from './db'

beforeAll(async () => { expect(await initStorage()).toBe(true) })
beforeEach(async () => { await resetStorage() })

describe('IndexedDB', () => {
  it('serializes writes and restores a versioned backup', async () => {
    await Promise.all([write('kv', 'favorites', ['border']), write('kv', 'favorites', ['gradient'])])
    const original = await snapshot()
    const backup = parseBackup(JSON.stringify(await createBackup()))
    await write('kv', 'recent', ['shadow'])
    await restore(backup, true)
    expect(await read('kv', 'recent')).toBeUndefined()
    expect(await read('kv', 'favorites')).toEqual(original.kv.favorites)
  })
  it('rejects unknown versions and dangerous keys', () => {
    expect(() => parseBackup('{"app":"frontkit","backupVersion":2}')).toThrow()
    expect(() => parseBackup('{"data":{"constructor":{}}}')).toThrow()
  })
})
