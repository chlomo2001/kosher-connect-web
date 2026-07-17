// Minimal ZIP read/write with zero dependencies — the piece that lets the
// converter pages stay fully client-side WITHOUT the CDN-loaded JSZip that
// kept failing the owner offline (his own bug reports drove three rewrites).
//
// Read:  central-directory walk; STORE members sliced directly, DEFLATE members
//        inflated with the platform's DecompressionStream('deflate-raw')
//        (Chrome/Firefox/Safari and Node 18+ — the same environments KC runs in).
// Write: STORE-only members with a real CRC-32 — FIG backup zips are small
//        NDJSON files, compression buys nothing worth the code.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(u8) {
  let c = 0xffffffff
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const te = new TextEncoder()
const td = new TextDecoder('utf-8')

async function inflateRaw(u8) {
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([u8]).stream().pipeThrough(ds)
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

// unzip(ArrayBuffer|Uint8Array) → [{ name, dir, size, bytes(): Promise<Uint8Array> }]
export async function unzip(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input)
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)

  // Find End Of Central Directory (scan back through the max comment length).
  let eocd = -1
  const lo = Math.max(0, u8.length - 65558)
  for (let i = u8.length - 22; i >= lo; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a ZIP file (no central directory).')
  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)

  const entries = []
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break
    const method = dv.getUint16(off + 10, true)
    const compSize = dv.getUint32(off + 20, true)
    const nameLen = dv.getUint16(off + 28, true)
    const extraLen = dv.getUint16(off + 30, true)
    const commentLen = dv.getUint16(off + 32, true)
    const localOff = dv.getUint32(off + 42, true)
    const name = td.decode(u8.subarray(off + 46, off + 46 + nameLen))
    entries.push({
      name,
      dir: name.endsWith('/'),
      size: dv.getUint32(off + 24, true),
      bytes: async () => {
        // Local header: sizes may live in the data descriptor; trust central dir.
        const lnl = dv.getUint16(localOff + 26, true)
        const lel = dv.getUint16(localOff + 28, true)
        const start = localOff + 30 + lnl + lel
        const raw = u8.subarray(start, start + compSize)
        if (method === 0) return raw.slice()
        if (method === 8) return inflateRaw(raw)
        throw new Error(`Unsupported ZIP compression method ${method} in ${name}`)
      },
    })
    off += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

// makeZip([{ name, data: Uint8Array|string }]) → Uint8Array (STORE members).
export function makeZip(files) {
  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  const locals = []
  const centrals = []
  let offset = 0
  for (const f of files) {
    const nameB = te.encode(f.name)
    const data = typeof f.data === 'string' ? te.encode(f.data) : f.data
    const crc = crc32(data)

    const local = new Uint8Array(30 + nameB.length + data.length)
    const ldv = new DataView(local.buffer)
    ldv.setUint32(0, 0x04034b50, true)
    ldv.setUint16(4, 20, true)                    // version needed
    ldv.setUint16(8, 0, true)                     // method: STORE
    ldv.setUint16(10, dosTime, true); ldv.setUint16(12, dosDate, true)
    ldv.setUint32(14, crc, true)
    ldv.setUint32(18, data.length, true); ldv.setUint32(22, data.length, true)
    ldv.setUint16(26, nameB.length, true)
    local.set(nameB, 30); local.set(data, 30 + nameB.length)
    locals.push(local)

    const cen = new Uint8Array(46 + nameB.length)
    const cdv = new DataView(cen.buffer)
    cdv.setUint32(0, 0x02014b50, true)
    cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true)
    cdv.setUint16(10, 0, true)
    cdv.setUint16(12, dosTime, true); cdv.setUint16(14, dosDate, true)
    cdv.setUint32(16, crc, true)
    cdv.setUint32(20, data.length, true); cdv.setUint32(24, data.length, true)
    cdv.setUint16(28, nameB.length, true)
    cdv.setUint32(42, offset, true)
    cen.set(nameB, 46)
    centrals.push(cen)

    offset += local.length
  }

  const cdSize = centrals.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true)
  edv.setUint16(8, files.length, true); edv.setUint16(10, files.length, true)
  edv.setUint32(12, cdSize, true)
  edv.setUint32(16, offset, true)

  const total = offset + cdSize + 22
  const out = new Uint8Array(total)
  let p = 0
  for (const b of locals) { out.set(b, p); p += b.length }
  for (const b of centrals) { out.set(b, p); p += b.length }
  out.set(eocd, p)
  return out
}
