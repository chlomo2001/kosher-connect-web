// Read a request's raw body, capped BEFORE any signature check — used by the
// webhook routes that set `config.api.bodyParser: false` (Stripe, Resend),
// because signature verification needs the exact bytes and, with the parser
// off, there is otherwise no size limit at all. Real events are a few KB;
// 1 MB is generous. One copy on purpose: the two webhooks carried identical
// implementations, and a security cap that exists twice can drift twice.
export function readRaw(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) { req.destroy(); reject(new Error('payload-too-large')); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
