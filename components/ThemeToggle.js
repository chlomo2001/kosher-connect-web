import { useEffect, useState } from 'react'

// Standalone light/dark toggle for the auth pages (login, portal), which don't
// load the main app's main.js. Mirrors public/main.js toggleTheme(): flips
// data-theme on <html> and persists to localStorage['kcTheme']; the pre-paint
// script in _document.js reads it back on the next load so there's no flash.
export default function ThemeToggle({ style }) {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const stored = document.documentElement.getAttribute('data-theme')
    if (stored) { setDark(stored === 'dark'); return }
    // No choice stored yet, and whether the page is dark RIGHT NOW depends on
    // whether this particular page carries an OS-dark palette — /welcome and
    // the legal pages do, the app deliberately does not. So read what the
    // customer is actually looking at instead of guessing per page; otherwise
    // the button offers "go dark" on an already-dark page and the first press
    // does nothing visible.
    const rgb = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || []).map(Number)
    const opaque = rgb.length >= 3 && (rgb[3] === undefined || rgb[3] > 0)
    setDark(opaque && 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 128)
  }, [])
  function flip() {
    // Both states are written out, never removed: an absent attribute means
    // "no choice yet", which is what the OS-dark palettes key on. See the note
    // in _document.js.
    const next = dark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('kcTheme', next) } catch {}
    setDark(!dark)
  }
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={flip}
      title="Light / dark mode"
      aria-label="Toggle light or dark mode"
      style={style}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
