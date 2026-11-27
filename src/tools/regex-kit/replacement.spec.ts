import { describe, expect, it } from 'vitest'
import { createTransformation } from './replacement'

describe('sustitución de RegexKit', () => {
  it('coincide con replace para referencias numeradas, nombradas, inexistentes y opcionales', () => {
    const input = 'a b ab'
    const templates = [
      "$$:$&:$1:$2:$3:$01:$10:$00:$<nombre>:$<falta>:$<no$&>",
      "$" + String.fromCharCode(96) + "/$'/$$$2",
    ]
    for (const regex of [/(?<nombre>a)?b/g, /(a)?b/g, /(?=\w)/g]) {
      for (const template of templates) {
        const run = createTransformation(input, { mode: 'replace', template })
        for (const match of input.matchAll(regex)) run.replace(match)
        expect(run.finish()).toEqual({ text: input.replace(regex, template) })
      }
    }
  })
})
