import { converter, formatHex, formatHex8, formatHsl, formatRgb, interpolate, parse, wcagContrast } from 'culori'
import { clamp, decimal } from '../css'

const rgb = converter('rgb')
const oklch = converter('oklch')

export { formatHex, formatHsl, formatRgb, wcagContrast }

export function hexWithAlpha(hex: string, opacity: number) {
  const color = rgb(hex)
  if (!color) return hex
  return opacity === 100 ? formatHex(color) : formatHex8({ ...color, alpha: clamp(opacity / 100, 0, 1) })
}

export function formatOklch(hex: string) {
  const color = oklch(parse(hex))
  if (!color) return hex
  return 'oklch(' + decimal(color.l) + ' ' + decimal(color.c) + ' ' + decimal(color.h ?? 0) + ')'
}

export function between(first: string, second: string, ratio: number) {
  return formatHex(interpolate([first, second], 'oklab')(clamp(ratio, 0, 1)))
}

export function harmony(hue: number, lightness: number, chroma = 0.17) {
  return formatHex({ mode: 'oklch', l: lightness, c: chroma, h: hue % 360 })
}
