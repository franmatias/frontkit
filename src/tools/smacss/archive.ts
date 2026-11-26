const encoder = new TextEncoder()
function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function zip(files: Record<string, string>) {
  const entries = Object.entries(files).map(([name, content]) => ({ name: encoder.encode(name), data: encoder.encode(content) }))
  const localSize = entries.reduce((n, file) => n + 30 + file.name.length + file.data.length, 0)
  const directorySize = entries.reduce((n, file) => n + 46 + file.name.length, 0)
  const out = new Uint8Array(localSize + directorySize + 22)
  const view = new DataView(out.buffer)
  const u16 = (pos: number, value: number) => view.setUint16(pos, value, true)
  const u32 = (pos: number, value: number) => view.setUint32(pos, value, true)
  let offset = 0, directory = localSize
  for (const { name, data } of entries) {
    const hash = crc32(data)
    u32(offset, 0x04034b50); u16(offset + 4, 20); u16(offset + 6, 0x800); u16(offset + 12, 33)
    u32(offset + 14, hash); u32(offset + 18, data.length); u32(offset + 22, data.length); u16(offset + 26, name.length)
    out.set(name, offset + 30); out.set(data, offset + 30 + name.length)
    u32(directory, 0x02014b50); u16(directory + 4, 20); u16(directory + 6, 20); u16(directory + 8, 0x800); u16(directory + 14, 33)
    u32(directory + 16, hash); u32(directory + 20, data.length); u32(directory + 24, data.length); u16(directory + 28, name.length)
    u32(directory + 42, offset); out.set(name, directory + 46)
    offset += 30 + name.length + data.length
    directory += 46 + name.length
  }
  u32(directory, 0x06054b50); u16(directory + 8, entries.length); u16(directory + 10, entries.length)
  u32(directory + 12, directorySize); u32(directory + 16, localSize)
  return out
}
