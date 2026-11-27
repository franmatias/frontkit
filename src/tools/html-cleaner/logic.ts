import * as v from 'valibot'
import { defineTool } from '../../core/tool'
export const presets = [
  'word',
  'docs',
  'mail',
  'article',
  'wysiwyg',
  'minimal',
  'strict',
  'custom',
] as const
export const flags = [
  'forms',
  'hidden',
  'tracking',
  'chrome',
  'main',
  'semantic',
  'underline',
  'wordLists',
  'emailTables',
  'quotes',
  'empty',
  'spaces',
  'invisibles',
  'straight',
  'paragraphs',
  'headings',
  'hierarchy',
  'keepId',
  'keepData',
  'keepAria',
  'stripParams',
  'unwrapRedirects',
  'dropDataImages',
  'frontmatter',
  'document',
  'minify',
  'selfClose',
  'gfm',
  'textQuotes',
  'textImages',
] as const
const options = Object.fromEntries(
  flags.map((key) => [key, v.boolean()]),
) as Record<(typeof flags)[number], v.BooleanSchema<undefined>>
const short = (max: number) => v.pipe(v.string(), v.maxLength(max))
const schema = v.strictObject({
  ...options,
  preset: v.picklist(presets),
  articlePage: v.optional(v.boolean(), true),
  keep: short(400),
  remove: short(400),
  classes: v.picklist(['none', 'office', 'all']),
  divs: v.picklist(['keep', 'paragraph', 'unwrap']),
  output: v.picklist(['html', 'md', 'text']),
  phase: v.picklist(['sanitize', 'normalize', 'serialize']),
  eol: v.picklist(['lf', 'crlf']),
  indent: v.picklist([2, 4]),
  shift: v.picklist([-2, -1, 0, 1, 2]),
  headingStyle: v.picklist(['atx', 'setext']),
  bullet: v.picklist(['-', '*']),
  emphasis: v.picklist(['*', '_']),
  fence: v.picklist(['backtick', 'tilde']),
  links: v.picklist(['inlined', 'referenced']),
  hardBreak: v.picklist(['spaces', 'slash']),
  unknown: v.picklist(['html', 'text', 'discard']),
  textLinks: v.picklist(['inline', 'text', 'notes']),
  textHeading: v.picklist(['plain', 'underline', 'uppercase']),
  wrap: v.picklist([0, 72, 80]),
  textTable: v.picklist(['tsv', 'ascii']),
  dataLimit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2048)),
})
export type State = v.InferInput<typeof schema>
export type Preset = State['preset']
const on = [
  'forms',
  'hidden',
  'tracking',
  'semantic',
  'empty',
  'spaces',
  'invisibles',
  'keepAria',
  'stripParams',
  'unwrapRedirects',
  'gfm',
  'textQuotes',
  'textImages',
]
export function defaults(preset: Preset = 'wysiwyg'): State {
  const base = Object.fromEntries(
    flags.map((flag) => [flag, on.includes(flag)]),
  ) as Pick<State, (typeof flags)[number]>
  const common: State = {
    ...base,
    preset,
    articlePage: true,
    keep: '',
    remove: '',
    classes: 'none',
    divs: 'paragraph',
    output: 'html',
    phase: 'serialize',
    eol: 'lf',
    indent: 2,
    shift: 0,
    headingStyle: 'atx',
    bullet: '-',
    emphasis: '*',
    fence: 'backtick',
    links: 'inlined',
    hardBreak: 'spaces',
    unknown: 'text',
    textLinks: 'inline',
    textHeading: 'plain',
    wrap: 0,
    textTable: 'tsv',
    dataLimit: 120,
  }
  switch (preset) {
    case 'word':
      return { ...common, wordLists: true, paragraphs: true }
    case 'docs':
      return { ...common, wordLists: true, paragraphs: true }
    case 'mail':
      return { ...common, emailTables: true, quotes: true, chrome: true }
    case 'article':
      return { ...common, main: true, chrome: true }
    case 'strict':
      return {
        ...common,
        main: true,
        chrome: true,
        hierarchy: true,
        paragraphs: true,
        dropDataImages: true,
      }
    case 'minimal':
      return {
        ...common,
        ...Object.fromEntries(flags.map((flag) => [flag, false])),
        phase: 'sanitize',
        classes: 'all',
        divs: 'keep',
        keepId: true,
        keepData: true,
        keepAria: true,
      }
    default:
      return common
  }
}
export const logic = defineTool<State>({
  id: 'html-cleaner',
  schema,
  defaultState: defaults,
  outputs: {},
  presets: [],
})
export function detect(value: string): Preset | undefined {
  if (
    /msonormal|msolistparagraph|mso-|urn:schemas-microsoft-com:office|microsoft word/i.test(
      value,
    )
  )
    return 'word'
  if (/docs-internal-guid-/i.test(value)) return 'docs'
  if (/gmail_quote|safelinks\.protection\.outlook/i.test(value)) return 'mail'
  if (/<(?:main|article)(?:\s|>)/i.test(value)) return 'article'
}
