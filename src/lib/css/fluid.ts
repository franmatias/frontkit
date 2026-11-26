export interface FluidRange {
  start: number
  end: number
  minViewport: number
  maxViewport: number
  root: number
  unit: 'px' | 'rem'
}
export const rounded = (value: number) => Number(value.toFixed(4))
function slope(range: FluidRange) {
  if (range.maxViewport <= range.minViewport || range.root <= 0) throw new RangeError('Invalid fluid range')
  return (range.end - range.start) / (range.maxViewport - range.minViewport)
}
export function fluidValue(range: FluidRange, viewport: number) {
  const gradient = slope(range)
  return range.start + gradient * (Math.max(range.minViewport, Math.min(range.maxViewport, viewport)) - range.minViewport)
}
export function fluidClamp(range: FluidRange) {
  const k = slope(range)
  const divisor = range.unit === 'rem' ? range.root : 1
  const unit = (px: number) => rounded(px / divisor) + range.unit
  const vw = rounded(k * 100)
  if (vw === 0) return unit(range.start)
  const intercept = unit(range.start - k * range.minViewport)
  return 'clamp(' + unit(Math.min(range.start, range.end)) + ', ' + intercept + (vw < 0 ? ' - ' : ' + ') + Math.abs(vw) + 'vw, ' +
    unit(Math.max(range.start, range.end)) + ')'
}
export const sassFluid = '@use "sass:math";\n\n@function fluid($min, $max, $vwMin, $vwMax, $root: 16, $useRem: true) {\n' +
  '  @if $vwMin >= $vwMax { @error "El viewport máximo debe superar al mínimo."; }\n' +
  '  $k: math.div($max - $min, $vwMax - $vwMin);\n  $b: $min - $k * $vwMin;\n' +
  '  @if $useRem {\n    @return clamp(math.div(math.min($min,$max),$root) * 1rem, calc(#{math.div($b,$root)}rem + #{$k * 100}vw), math.div(math.max($min,$max),$root) * 1rem);\n  }\n' +
  '  @return clamp(math.min($min,$max) * 1px, calc(#{$b}px + #{$k * 100}vw), math.max($min,$max) * 1px);\n}'
