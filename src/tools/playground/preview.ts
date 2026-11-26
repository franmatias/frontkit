import bridge from './bridge.js?raw'
import { parse, type Node } from 'acorn'
import type { Source } from './project'

export function protectLoops(source: string, guard: string) {
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'script' })
  const insertions: { at: number; value: string }[] = []
  function visit(node: Node) {
    if (['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type)) {
      const { body } = node as Node & { body: Node }
      insertions.push({ at: body.start, value: '{' + guard + '();' }, { at: body.end, value: '}' })
    }
    for (const value of Object.values(node)) {
      const children = Array.isArray(value) ? value : [value]
      for (const child of children) if (child && typeof child.type === 'string') visit(child)
    }
  }
  visit(tree)
  let result = source
  for (const edit of insertions.sort((a, b) => b.at - a.at)) result = result.slice(0, edit.at) + edit.value + result.slice(edit.at)
  return result
}

function guardName(nonce: string) {
  return '__frontkit_' + nonce.replaceAll('-', '')
}

export function consoleScript(source: string, nonce: string, protection: boolean) {
  const guard = guardName(nonce)
  const expression = '(' + source + '\n)'
  let script: string
  try {
    parse(expression, { ecmaVersion: 'latest' })
    script = 'window.' + guard + '_result(' + expression + ')'
  } catch {
    parse(source, { ecmaVersion: 'latest' })
    script = source
  }
  return protection ? protectLoops(script, guard) : script
}

export const levels = ['log', 'info', 'warn', 'error', 'clear'] as const
export type Level = (typeof levels)[number]


export function previewDocument(source: Source, nonce: string, protection: boolean, loopMessage: string) {
  const guard = guardName(nonce)
  let js = source.js
  let parsed = true
  if (protection) {
    try { js = protectLoops(js, guard) } catch { parsed = false }
  }
  const args = JSON.stringify([{ ...source, js }, nonce, guard, loopMessage]).replaceAll('<', '\\u003c')
  const policy = "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'; img-src data: blob:; base-uri 'none'; form-action 'none'"
  return { parsed, html: '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy
    + '"></head><body><script nonce="' + nonce + '">(' + bridge.trim() + ')(...' + args + ')</script></body></html>' }
}
