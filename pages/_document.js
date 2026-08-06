import { Html, Head, Main, NextScript } from 'next/document'

// en-GB, not a bare "en": this is a British-English product (Salford shop,
// British copy throughout). The tag drives the spell-check dictionary in every
// notes/description textarea staff type into — under plain "en" the browser
// flags "colour", "organise" and "authorised" as misspellings — as well as
// screen-reader pronunciation and hyphenation. Chromium also reads it for
// <input type="date"> field ordering, though that half could NOT be confirmed
// here: headless Chromium renders mm/dd/yyyy regardless of page lang or
// browser locale, so the date claim is unverified and rests on the spec.
// The public pages set their own lang on the .sk / portal subtree, so the
// Hebrew and Yiddish switches are unaffected.
export default function Document() {
  return (
    <Html lang="en-GB">
      <Head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f3ea" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0d11" />
        {/* Apply the saved theme before first paint — no flash of light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('kcTheme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}`,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
