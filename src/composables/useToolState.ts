import { onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onExternalChange, read, write } from '../core/storage/db'
import type { ToolLogic } from '../core/tool'
import { useNotificationsStore } from '../stores/notifications'
import { decodeShare, encodeShare } from './share'

export function useToolState<S extends object>(logic: ToolLogic<S>) {
  const state = shallowRef(logic.defaultState()) as Ref<S>
  const ready = ref(false)
  const shared = ref(false)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const route = useRoute()
  const router = useRouter()
  const notices = useNotificationsStore()
  const before: S[] = []
  const after: S[] = []
  let saved = logic.defaultState()
  let writeTimer: ReturnType<typeof setTimeout> | undefined
  let lastGroup = ''
  let lastChange = 0
  let revision = 0
  let closed = false
  let saving = false

  function syncHistory() {
    canUndo.value = before.length > 0
    canRedo.value = after.length > 0
  }

  async function flush() {
    if (writeTimer === undefined) return
    clearTimeout(writeTimer)
    writeTimer = undefined
    const next = state.value
    saving = true
    try {
      await write('toolStates', logic.id, next, logic.schemaVersion)
      saved = next
    } catch { /* Storage announces write failures. */ }
    finally { saving = false }
  }

  async function loadStored(external = false) {
    if (external && (writeTimer !== undefined || saving || shared.value)) return
    const atStart = revision
    let stored = logic.defaultState()
    try {
      const record = await read('toolStates', logic.id)
      if (record) stored = logic.migrate(record.state, record.schemaVersion)
    } catch { notices.push('tool.corrupt') }
    if (closed || atStart !== revision) return
    if (external && JSON.stringify(stored) === JSON.stringify(saved)) return
    saved = stored
    state.value = stored
    before.length = 0
    after.length = 0
    syncHistory()
  }

  function clearFragment() {
    if (route.hash.startsWith('#s=')) void router.replace({ path: route.path, query: route.query, hash: '' })
  }
  function persist() {
    revision++
    if (shared.value) {
      shared.value = false
      clearFragment()
    }
    if (writeTimer !== undefined) clearTimeout(writeTimer)
    writeTimer = setTimeout(flush, 300)
  }
  function update(apply: (draft: S) => void, group = '') {
    if (!ready.value) return
    const current = state.value
    const next = structuredClone(current)
    apply(next)
    if (JSON.stringify(next) === JSON.stringify(current)) return
    const now = performance.now()
    if (!group || group !== lastGroup || now - lastChange > 650) {
      before.push(current)
      if (before.length > 100) before.shift()
    }
    lastGroup = group
    lastChange = now
    after.length = 0
    state.value = next
    syncHistory()
    persist()
  }
  function replace(next: S) {
    if (!ready.value) return
    before.push(state.value)
    if (before.length > 100) before.shift()
    after.length = 0
    lastGroup = ''
    state.value = structuredClone(next)
    syncHistory()
    persist()
  }
  function changeHistory(undo: boolean) {
    const source = undo ? before : after
    const destination = undo ? after : before
    const next = source.pop()
    if (!next) return
    destination.push(state.value)
    state.value = next
    lastGroup = ''
    syncHistory()
    persist()
  }
  function discard() {
    state.value = saved
    shared.value = false
    clearFragment()
  }
  function url() {
    const link = new URL(location.href)
    link.hash = encodeShare(logic, state.value)
    return link.href
  }
  function loadFragment(hash: string) {
    if (!hash.startsWith('#s=')) return
    revision++
    void flush()
    before.length = 0
    after.length = 0
    lastGroup = ''
    syncHistory()
    try {
      state.value = decodeShare(logic, hash)
      shared.value = true
    } catch {
      state.value = logic.defaultState()
      shared.value = false
      notices.push('tool.shareError')
    }
  }
  watch(() => route.hash, hash => {
    if (ready.value && route.meta.toolId === logic.id) loadFragment(hash)
  })
  const stop = onExternalChange(() => { void loadStored(true) })
  function visibility() {
    if (document.visibilityState === 'hidden') void flush()
  }
  onMounted(async () => {
    document.addEventListener('visibilitychange', visibility)
    await loadStored()
    if (closed) return
    loadFragment(route.hash)
    ready.value = true
  })
  onUnmounted(() => {
    closed = true
    stop()
    document.removeEventListener('visibilitychange', visibility)
    void flush()
  })
  return { state, ready, shared, canUndo, canRedo, update, replace, changeHistory, persist, discard, url }
}
