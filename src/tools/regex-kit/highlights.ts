import type { Match } from './model'

export type Span = { text: string; kind?: string }

export function captureHue(group: number) {
  return (213 + (group - 1) * 137.508) % 360
}

type Highlight = { start: number; end: number; color: number }
export function highlights(text: string, matches: Match[]): Span[] {
  const changes = new Map<number, { add: Highlight[]; remove: Highlight[] }>()
  function eventAt(index: number) {
    let event = changes.get(index)
    if (!event) {
      event = { add: [], remove: [] }
      changes.set(index, event)
    }
    return event
  }
  function add([start, end]: [number, number], color: number) {
    if (end <= start) return
    const highlight = { start, end, color }
    eventAt(start).add.push(highlight)
    eventAt(end).remove.push(highlight)
  }
  for (const match of matches) {
    add(match.range, 0)
    match.captures.forEach((capture, index) => {
      if (capture.range) add(capture.range, index + 1)
    })
  }
  const active = new Set<Highlight>()
  const parts: Span[] = []
  let cursor = 0
  let visible: Highlight | undefined
  for (const index of [...changes.keys()].sort((a, b) => a - b)) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), kind: visible && 'match-' + visible.color })
    const event = changes.get(index)!
    for (const range of event.remove) active.delete(range)
    for (const range of event.add) active.add(range)
    visible = undefined
    for (const range of active) {
      if (!visible || (range.color > 0 &&
        (!visible.color || range.end - range.start <= visible.end - visible.start))) visible = range
    }
    cursor = index
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts
}
