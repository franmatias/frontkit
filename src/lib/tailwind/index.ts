export function escapeArbitrary(value: string) {
  return value.replaceAll('_', '\\_').replace(/\s+/g, '_')
}

export const arbitrary = (utility: string, value: string) => utility + '-[' + escapeArbitrary(value) + ']'
export const property = (name: string, value: string) => '[' + name + ':' + escapeArbitrary(value) + ']'
