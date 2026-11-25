import * as v from 'valibot'

export const numberBetween = (min: number, max: number) => v.pipe(v.number(), v.minValue(min), v.maxValue(max))
export const percentage = numberBetween(0, 100)
export const hexColor = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i))
export const identifier = v.pipe(v.string(), v.regex(/^[a-z0-9-]{1,64}$/i))
