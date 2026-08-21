// The pop-up note — Epos Now's Pop Up Notes, in KC's shape.
//
// Notes are a drawer you open; this is the one line the counter must MEET. It
// banners at the top of the profile and toasts at the till the moment the
// customer is picked. The loud channel is kept scarce on purpose: one line,
// 140 characters, its own field — a popup that fires on everyone is a popup
// everyone dismisses unread.
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SRC = readFileSync(path.join(ROOT, 'public/main.js'), 'utf8')
const SHELL = readFileSync(path.join(ROOT, 'components/AppShell.js'), 'utf8')
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

test('the form has the field, and it explains its own scarcity', () => {
  assert.ok(SHELL.includes('id="fPopNote"'), 'no fPopNote input in the customer form')
  assert.match(SHELL, /maxLength=\{140\}/, 'the field must be capped — one line, not a second notes box')
})

test('it saves, refills on edit, and clears for the next add', () => {
  assert.match(CODE, /popNote\s*=\s*document\.getElementById\('fPopNote'\)\?\.value\.trim\(\)\.slice\(0, 140\)/,
    'the save path must collect and cap it')
  assert.match(CODE, /address, notes, popNote,/, 'popNote missing from the save payload')
  assert.match(CODE, /fPopNote'\); if \(n\) n\.value = c\.popNote \|\| ''/, 'edit must refill the field')
  assert.match(CODE, /fPopNote'\); if \(pn\) pn\.value = ''/, 'add must start blank')
})

test('the profile banners it, escaped, above everything', () => {
  const m = CODE.match(/const popNoteHtml = c\.popNote \? `[\s\S]{0,200}?` : ''/)
  assert.ok(m, 'no banner construction found')
  assert.match(m[0], /escHtml\(c\.popNote\)/,
    'customer-typed text straight into innerHTML — must go through escHtml')
  assert.match(m[0], /role="alert"/, 'a screen reader must meet it too')
  const ret = CODE.indexOf('${popNoteHtml}')
  const hdr = CODE.indexOf('${headerHtml}')
  assert.ok(ret > -1 && hdr > -1 && ret < hdr, 'the banner must sit ABOVE the header — unmissable is the contract')
  // BOTH surfaces — the overlay card and the full page. The first version
  // bannered only the page, and the card is the one staff open all day.
  assert.equal((CODE.match(/\$\{popNoteHtml\}/g) || []).length, 2,
    'the banner must appear in both returns of buildCustomerPanelHtml')
})

test('the till toasts it the moment the customer is picked', () => {
  const fn = CODE.match(/function posCustomerChange\(\) \{[\s\S]*?\n\}/)
  assert.ok(fn, 'posCustomerChange not found')
  assert.match(fn[0], /if \(c\?\.popNote\) toast\(`📌 \$\{c\.popNote\}`, 'warning'\)/,
    'picking a customer at the till must surface the note')
})

test('the banner style exists and does not rely on colour alone', () => {
  const css = readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8')
  assert.ok(css.includes('.kc-popnote'), 'no .kc-popnote rule')
  assert.match(css, /\.kc-popnote \{[^}]*border-left-width: 4px/s, 'the flag edge is the non-colour signal')
}
)
