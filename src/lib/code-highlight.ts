import highlight from 'highlight.js/lib/core'

type Segment = { text: string; classes: string }

export function highlightSegments(code: string, language: string): Segment[] {
  if (code.length > 100_000) return [{ text: code, classes: '' }]
  const rendered = highlight.highlight(code, { language }).value
  const parsed = new DOMParser().parseFromString(rendered, 'text/html')
  const segments: Segment[] = []
  function collect(node: Node, classes = '') {
    if (node.nodeType === Node.TEXT_NODE)
      segments.push({ text: node.textContent ?? '', classes })
    else if (node instanceof Element) {
      const next = [classes, node.className].filter(Boolean).join(' ')
      for (const child of node.childNodes) collect(child, next)
    }
  }
  collect(parsed.body)
  return segments
}
