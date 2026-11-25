export const decimal = (n: number) => Number(n.toFixed(3))
export const px = (n: number) => decimal(n) + 'px'
export const pct = (n: number) => decimal(n) + '%'
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export function shorthand(values: [string, string, string, string]) {
  const [top, right, bottom, left] = values
  if (right !== left) return values.join(' ')
  if (top !== bottom) return [top, right, bottom].join(' ')
  return top === right ? top : [top, right].join(' ')
}
