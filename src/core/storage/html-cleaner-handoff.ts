type CleanTable = { headers: string[]; values: string[][] }
type Transfers = {
  bem: string
  'table-builder': CleanTable
  'a11y-audit': string
}
let pending:
  | { destination: keyof Transfers; payload: Transfers[keyof Transfers] }
  | undefined
export function sendCleaned<K extends keyof Transfers>(
  destination: K,
  payload: Transfers[K],
) {
  pending = { destination, payload }
}
export function receiveCleaned<K extends keyof Transfers>(
  destination: K,
): Transfers[K] | undefined {
  if (pending?.destination !== destination) return
  const payload = pending.payload as Transfers[K]
  pending = undefined
  return payload
}
