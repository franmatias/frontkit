import { converter, formatHex } from 'culori'

export const visionModes = ['normal', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'] as const
export type Vision = (typeof visionModes)[number]
const linear = converter('lrgb')
const rgb = converter('rgb')
// Machado, Oliveira and Fernandes (2009), severity 1.0. Coefficients act on linear sRGB.
const matrices = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
  achromatopsia: Array.from({ length: 3 }, () => [0.2126, 0.7152, 0.0722]),
}
export function simulateVision(color: string, mode: Vision) {
  if (mode === 'normal') return color
  const input = linear(color)
  if (!input) return color
  const channels = [input.r, input.g, input.b]
  const [r, g, b] = matrices[mode].map(row => row.reduce((sum, weight, i) => sum + weight * channels[i], 0))
  return formatHex({ mode: 'lrgb', r, g, b })
}

// APCA-W3 0.1.9 (0.0.98G-4g), https://apcaw3.myndex.com/docs/APCA-W3-LaTeX.html
export function apca(text: string, background: string) {
  function luminance(hex: string) {
    const c = rgb(hex)
    if (!c) return 0
    const y = 0.2126729 * c.r ** 2.4 + 0.7151522 * c.g ** 2.4 + 0.0721750 * c.b ** 2.4
    return y < 0.022 ? y + (0.022 - y) ** 1.414 : y
  }
  const foreground = luminance(text)
  const backdrop = luminance(background)
  if (Math.abs(foreground - backdrop) < 0.0005) return 0
  const contrast = backdrop > foreground
    ? (backdrop ** 0.56 - foreground ** 0.57) * 1.14
    : (backdrop ** 0.65 - foreground ** 0.62) * 1.14
  return Math.abs(contrast) < 0.1 ? 0 : (contrast - Math.sign(contrast) * 0.027) * 100
}
