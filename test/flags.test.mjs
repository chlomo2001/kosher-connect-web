// Channel flags. public/main.js is a plain browser script, so it cannot import
// lib/flags.js and has to carry its own copy of WHATSAPP_ENABLED. Two constants
// meant to be one switch drift the moment somebody flips only the one they
// happened to open — which would leave WhatsApp live on half the app. This
// keeps them honest. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WHATSAPP_ENABLED } from '../lib/flags.js'

test('public/main.js mirrors WHATSAPP_ENABLED from lib/flags.js', () => {
  const src = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
  const m = src.match(/^const WHATSAPP_ENABLED = (true|false);/m)
  assert.ok(m, 'public/main.js must declare `const WHATSAPP_ENABLED = true|false;` at top level')
  assert.equal(
    m[1] === 'true',
    WHATSAPP_ENABLED,
    'public/main.js and lib/flags.js disagree about WHATSAPP_ENABLED — flip both together'
  )
})

test('main.js declares the flag before the first thing that reads it', () => {
  // `const` is not hoisted for reads: a use above the declaration throws a
  // ReferenceError at runtime, which in this file would take the whole app out.
  const src = readFileSync(new URL('../public/main.js', import.meta.url), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '') // the flag is named in its own explanatory comment
  const decl = src.indexOf('const WHATSAPP_ENABLED =')
  assert.ok(decl >= 0, 'declaration not found')
  // The identifier's own position inside the declaration — the first time the
  // name appears in code must be exactly here, not earlier.
  assert.equal(
    src.indexOf('WHATSAPP_ENABLED'),
    src.indexOf('WHATSAPP_ENABLED', decl),
    'WHATSAPP_ENABLED is read before it is declared'
  )
})
