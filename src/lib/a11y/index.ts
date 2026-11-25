export function sliderKey(event: KeyboardEvent, value: number, min: number, max: number) {
  const step = event.shiftKey ? 10 : 1
  const changes: Record<string, number> = {
    ArrowUp: value + step, ArrowRight: value + step, ArrowDown: value - step,
    ArrowLeft: value - step, Home: min, End: max,
  }
  if (!Object.hasOwn(changes, event.key)) return undefined
  event.preventDefault()
  return Math.max(min, Math.min(max, changes[event.key]))
}

export function move<T>(list: T[], index: number, offset: number) {
  const target = index + offset
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
}
