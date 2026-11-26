import { expect, it } from 'vitest'
import { zip } from './archive'
import { defaults, organize } from './logic'

it('keeps conditional wrappers and associates animations with their module', () => {
  const result = organize(':root{--ink:red}.shell{display:grid}.card{animation:fade 1s;padding:1rem}@media (min-width:40rem){.card{padding:2rem}}@keyframes fade{to{opacity:0}}', { ...defaults(), output: 'files' })
  expect(result.entries.map(row => row.category)).toEqual(['base', 'layout', 'module', 'module', 'module'])
  expect(result.files['modules/card.css']).toContain('@media')
  expect(result.files['modules/card.css']).toContain('@keyframes fade')
  expect(result.files['main.css']).toContain('@import "./base.css";')
})
it('respects review overrides and exposes cascade risks between categories', () => {
  const result = organize('.box{color:red}.is-active{color:blue}', defaults(), { 0: 'layout' })
  expect(result.entries[0].category).toBe('layout')
  expect(result.conflicts).toContainEqual({ property: 'color', groups: ['layout', 'state'] })
  expect(result.css).toContain('@layer base, layout, module, state, theme')
})
it('renames only unambiguous selectors and produces a ZIP directory', () => {
  const result = organize('.active{display:block}.layout{display:grid}.layout:hover{display:flex}', { ...defaults(), prefix: true, output: 'files' })
  expect(result.changes).toEqual([{ before: 'active', after: 'is-active' }])
  expect(result.warnings.join()).toContain('.layout')
  const archive = zip(result.files)
  const view = new DataView(archive.buffer)
  expect(view.getUint32(0, true)).toBe(0x04034b50)
  expect(view.getUint32(archive.length - 22, true)).toBe(0x06054b50)
  expect(view.getUint16(archive.length - 12, true)).toBe(Object.keys(result.files).length)
})
