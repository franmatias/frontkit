const cache = new Map<string, string>()
export function sampleImage(id: 'landscape' | 'portrait' | 'transparent') {
  const existing = cache.get(id)
  if (existing) return existing
  if (id === 'transparent') {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380"><path fill="#1cb78a" d="M132 285 255 63 375 285Z"/><circle cx="398" cy="168" r="94" fill="#eea541"/><rect x="238" y="198" width="221" height="102" rx="28" fill="#9565ce"/></svg>'
    return 'data:image/svg+xml,' + encodeURIComponent(svg)
  }
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 380
  const c = canvas.getContext('2d')
  if (!c) return ''
  const fill = (color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(x, y, w, h) }
  const oval = (color: string, x: number, y: number, w: number, h: number) => {
    c.beginPath()
    c.ellipse(x, y, w, h, 0, 0, 2 * Math.PI)
    c.fillStyle = color
    c.fill()
  }
  const bg = c.createLinearGradient(0, 0, 0, 380)
  bg.addColorStop(0, id === 'landscape' ? '#3489bd' : '#4d426f')
  bg.addColorStop(1, id === 'landscape' ? '#ffcf95' : '#a6a0c6')
  c.fillStyle = bg
  c.fillRect(0, 0, 640, 380)
  if (id === 'landscape') {
    oval('#ffce5e', 480, 109, 42, 42)
    for (const [y, color] of [[255, '#728ba3'], [292, '#436b70'], [318, '#22584d']] as const) {
      c.beginPath()
      c.moveTo(0, y)
      for (let x = 0; x <= 640; x += 16) c.lineTo(x, y + Math.sin(x * .019 + y) * 28 + Math.sin(x * .008 + y) * 33)
      c.lineTo(640, 380)
      c.lineTo(0, 380)
      c.fillStyle = color
      c.fill()
    }
    for (let i = 0; i < 32; i++) fill(i % 2 ? '#2a755c' : '#123a32', i * 21, 355 + Math.sin(i) * 12, 3, 10)
  } else {
    oval('#302b38', 320, 170, 102, 137)
    oval('#176e73', 320, 435, 159, 177)
    fill('#b67864', 288, 216, 64, 87)
    oval('#dca28b', 320, 163, 78, 111)
    oval('#302b38', 314, 78, 86, 48)
    oval('#573646', 286, 158, 9, 5)
    oval('#573646', 354, 158, 9, 5)
    oval('#a7505f', 321, 211, 24, 8)
    oval('#f9bc75', 246, 200, 8, 16)
    oval('#f9bc75', 394, 200, 8, 16)
  }
  const image = canvas.toDataURL('image/png')
  cache.set(id, image)
  return image
}
