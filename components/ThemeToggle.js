import { useEffect, useState } from 'react'

// Standalone light/dark toggle for the auth pages (login, portal), which don't
// load the main app's main.js. Mirrors public/main.js toggleTheme(): flips
// data-theme on <html> and persists to localStorage['kcTheme']; the pre-paint
// script in _document.js reads it back on the next load so there's no flash.
export default function ThemeToggle({ style }) {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])
  function flip() {
    const el = document.documentElement
    const nowDark = el.getAttribute('data-theme') === 'dark'
    if (nowDark) {
      // Written, not removed — an absent attribute means "no choice yet", and
      // the OS-dark palettes key on :root:not([data-theme]). See _document.js.
      el.setAttribute('data-theme', 'light')
      try { localStorage.setItem('kcTheme', 'light') } catch {}
    } else {
      el.setAttribute('data-theme', 'dark')
      try { localStorage.setItem('kcTheme', 'dark') } catch {}
    }
    setDark(!nowDark)
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
