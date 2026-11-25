import { describe, expect, it } from 'vitest'
import messages from '../i18n/locales/es-ES/common.json'
import { tools } from './registry'

describe('tool registry', () => {
  it('uses one kebab-case id and a corresponding translation entry per tool', () => {
    expect(new Set(tools.map(tool => tool.id)).size).toBe(tools.length)
    expect(tools.every(tool => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(tool.id))).toBe(true)
    expect(tools.map(tool => tool.id).sort()).toEqual(Object.keys(messages.tools).sort())
  })
})
