import { onScopeDispose, ref, shallowRef } from 'vue'

export function useWorker<Request, Result>(create: () => Worker) {
  const result = shallowRef<Result>()
  const busy = ref(false)
  const progress = ref(0)
  const failed = ref(false)
  let worker: Worker | undefined
  function cancel() {
    worker?.terminate()
    worker = undefined
    busy.value = false
  }
  function send(data: Request) {
    cancel()
    failed.value = false
    progress.value = 0
    result.value = undefined
    try {
      const active = create()
      worker = active
      busy.value = true
      active.onmessage = ({ data }: MessageEvent<Result | { kind: 'progress'; progress: number }>) => {
        if (worker !== active) return
        if (data && typeof data === 'object' && 'kind' in data && data.kind === 'progress' && 'progress' in data && typeof data.progress === 'number') {
          progress.value = data.progress
          return
        }
        result.value = data as Result
        cancel()
      }
      active.onerror = () => {
        if (worker !== active) return
        failed.value = true
        cancel()
      }
      active.postMessage(data)
    } catch {
      failed.value = true
      cancel()
    }
  }
  onScopeDispose(cancel)
  return { result, busy, failed, progress, send, cancel }
}
