/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Content-stable branded assets: font weights are encoded in the
        // filename and the logos never change in place, so they're safe to cache
        // hard. Next serves /public with max-age=0 by default, re-validating
        // these ~180KB every load; immutable makes repeat loads instant.
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:img(logo-full-tight-dark|logo-full-tight|logo-full|logo|cursor-orb-dark|cursor-orb).png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
    // NOTE: /main.js is deliberately NOT long-cached here — it changes on every
    // deploy and is served from a stable path, so `immutable` would pin a stale
    // build and break the app after a release. Hard-caching it needs a
    // content-hashed filename (prebuild minify → main.<hash>.js), tracked as an
    // owner-verify item (that one wants a deploy check with the owner present).
  },
}
module.exports = nextConfig
