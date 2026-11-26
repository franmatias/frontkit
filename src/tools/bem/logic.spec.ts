import { expect, it } from 'vitest'
import { rewriteCss } from '../../lib/rename'
import { apply, defaults, plan } from './logic'

it('keeps attributes and content and emits flat elements with mixed nested blocks', () => {
  const source = '<article class="card"><div class="body"><h2 id="title" class="title">Ficha</h2></div><button class="btn-red is-active" disabled>Aceptar</button></article>'
  const options = defaults()
  const first = apply(source, plan(source, options), options)
  expect(first.html).toContain('id="title" class="card__title">Ficha')
  expect(first.html).toContain('class="card__button btn btn--danger is-active"')
  expect(first.html).toContain('disabled=""')
  expect(first.scss).toContain('&--danger')
  expect(apply(first.html, plan(first.html, options), options).html).toBe(first.html)
})
it('keeps disabled proposals and warns about complex selectors', () => {
  const options = defaults()
  const source = '<div class="card"><span class="title">Texto</span></div>'
  const proposals = plan(source, options)
  const output = apply(source, proposals, options)
  expect(rewriteCss('.title{color:red}.card .title{color:blue}', output.safeChanges).review).toEqual(['.card .title'])
  proposals[1].enabled = false
  expect(apply(source, proposals, options).html).toBe(source)
})
