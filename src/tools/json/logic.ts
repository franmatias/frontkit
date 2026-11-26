import * as v from 'valibot'
import { defineTool } from '../../core/tool'

const schema = v.strictObject({
  mode: v.picklist(['format', 'diff']),
  indent: v.picklist(['2', '4', 'tab']),
  sortKeys: v.boolean(),
  allowComments: v.boolean(),
  tolerant: v.boolean(),
  ignoreKeyOrder: v.boolean(),
  ignoreArrayOrder: v.boolean(),
  arrayKey: v.pipe(v.string(), v.maxLength(100)),
  ignorePaths: v.pipe(v.array(v.pipe(v.string(), v.maxLength(200))), v.maxLength(100)),
  numericEquality: v.boolean(),
})
export type Options = v.InferOutput<typeof schema>
export const maxInput = 5 * 1024 * 1024
export const logic = defineTool<Options>({
  id: 'json', schema, defaultState: () => ({
    mode: 'format', indent: '2', sortKeys: false, allowComments: false, tolerant: true,
    ignoreKeyOrder: true, ignoreArrayOrder: false, arrayKey: '', ignorePaths: [], numericEquality: true,
  }),
  outputs: {}, presets: [],
})
