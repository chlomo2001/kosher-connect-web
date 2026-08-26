// The pixel size of a PNG, read from its header — 24 bytes, no decoding.
//
// From 26 Aug: /manual's screenshots are `loading="lazy"` with no reserved
// box, so until each one arrives its <img> has no height at all. The dialog
// thumbnails are wrapped in links, and the nightly touch-target audit measured
// those links at 328×2 — a tappable thing two pixels tall, on every dialog on
// the page. The same missing box is why the manual shunts everything downward
// as the pictures load.
//
// Both are cured by telling the browser the shape up front: width and height
// attributes plus the stylesheet's `width:100%; height:auto` give the box its
// aspect ratio before a single byte of image arrives.
//
// A PNG's IHDR is the first chunk and is fixed-position: 8-byte signature,
// 4-byte length, 4-byte type, then width and height as big-endian uint32.
// Reading 24 bytes off the front of the file is cheaper and far less to go
// wrong than pulling in an image library for two numbers.
import { openSync, readSync, closeSync } from 'node:fs'

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * `{ w, h }` for a PNG, or `{}` if the file is missing, truncated or not a
 * PNG. Never throws: a shot that cannot be measured must still be shown, the
 * same way a missing shot degrades to prose rather than to a broken page.
 */
export function pngSize(file) {
  let fd
  try {
    fd = openSync(file, 'r')
    const head = Buffer.alloc(24)
    if (readSync(fd, head, 0, 24, 0) < 24) return {}
    if (!head.subarray(0, 8).equals(SIG)) return {}
    if (head.subarray(12, 16).toString('latin1') !== 'IHDR') return {}
    const w = head.readUInt32BE(16)
    const h = head.readUInt32BE(20)
    return w > 0 && h > 0 ? { w, h } : {}
  } catch {
    return {}
  } finally {
    if (fd !== undefined) try { closeSync(fd) } catch {}
  }
}
