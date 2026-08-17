// The staff stylesheet is generated, not committed: styles/app.css (commented,
// reviewable) becomes public/app.css (comment-free, downloaded). It is built
// HERE, at config load, because that is the only hook that fires however the
// build is started.
//
// The npm `prebuild`/`predev` hooks alone were not enough, and shipped a
// production break: Vercel does not run `npm run build`, it detects Next and
// runs `next build` directly, so npm lifecycle scripts never execute. The file
// was missing from the deployment, /app.css fell through to the [tab] dynamic
// route, and the staff app served its own sign-in page as a stylesheet. The
// public pages were fine, which is exactly why it was easy to miss.
require('./scripts/build-app-css.cjs')
// Same reasoning for the curated "How do I…" library: public/guides.js is
// generated from lib/guides.mjs, and a missing file here would leave the
// counter's help button empty on production only.
require('./scripts/build-guides.cjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        // /join was a second public form that filed the same staff task as the
        // contact form; its fields now live on /welcome#contact. The address
        // is on printed material and in old messages, so it has to keep
        // working. Deliberately temporary (307): a permanent redirect is
        // cached hard by browsers and would be painful to walk back.
        source: '/join',
        destination: '/welcome#contact',
        permanent: false,
      },
    ]
  },
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
        source: '/:img(logo-full-tight-dark|logo-full-tight|logo-full|logo).png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
    // NOTE: /main.js and /app.css are deliberately NOT long-cached here — both
    // change on every deploy and are served from stable paths, so `immutable`
    // would pin a stale build and break the app after a release. Hard-caching
    // them needs content-hashed filenames (prebuild → main.<hash>.js,
    // app.<hash>.css), tracked as an owner-verify item (that one wants a deploy
    // check with the owner present).
    //
    // /app.css is the staff-only half of the stylesheet, generated from
    // styles/app.css by scripts/build-app-css.cjs so the public pages never
    // download it. See components/AppStyles.js for why it is linked from the
    // body rather than the head.
  },
}
module.exports = nextConfig
