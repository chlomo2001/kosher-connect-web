// Metered tokens → money. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rateFor, costUsd, toGbp, summarise, RATES_USD_PER_M } from '../lib/aiCost.mjs'

test('rateFor — a point release bills at its family rate, not the fallback', () => {
  assert.deepEqual(rateFor('gemini-2.0-flash'), RATES_USD_PER_M['gemini-2.0-flash'])
  // Google appends suffixes over time; the longest known prefix wins.
  assert.deepEqual(rateFor('gemini-2.0-flash-001'), RATES_USD_PER_M['gemini-2.0-flash'])
  assert.deepEqual(rateFor('gemini-1.5-flash-preview-09-2025'), RATES_USD_PER_M['gemini-1.5-flash'])
})

test('rateFor — an unknown model costs SOMETHING, never nothing', () => {
  // A silent £0 would read as "free", which is the one answer certainly wrong.
  const r = rateFor('gemini-9-something-new')
  assert.ok(r.in > 0 && r.out > 0)
  assert.deepEqual(rateFor(''), rateFor(undefined))
})

test('costUsd — input and output are billed at different rates', () => {
  // 1M in + 1M out on 2.0-flash = 0.10 + 0.40.
  const c = costUsd({ model: 'gemini-2.0-flash', promptTokens: 1_000_000, outputTokens: 1_000_000 })
  assert.equal(Math.round(c * 100) / 100, 0.5)
  // Output is dearer, so the same token count costs more coming back.
  const inOnly = costUsd({ model: 'gemini-2.0-flash', promptTokens: 1000, outputTokens: 0 })
  const outOnly = costUsd({ model: 'gemini-2.0-flash', promptTokens: 0, outputTokens: 1000 })
  assert.ok(outOnly > inOnly)
  assert.equal(costUsd({ model: 'gemini-2.0-flash' }), 0)
})

test('toGbp — rounds to the penny, and a bad rate falls back rather than zeroing', () => {
  assert.equal(toGbp(1, 0.79), 0.79)
  assert.equal(toGbp(0.005, 1), 0.01)
  assert.ok(toGbp(10, undefined) > 0)
  assert.ok(toGbp(10, 'nonsense') > 0)
})

test('summarise — totals, and the biggest spender leads', () => {
  const rows = [
    { feature: 'AI reader', model: 'gemini-2.5-flash', prompt_tokens: 100_000, output_tokens: 2000, total_tokens: 102_000 },
    { feature: 'reply drafter', model: 'gemini-2.5-flash', prompt_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
    { feature: 'AI reader', model: 'gemini-2.5-flash', prompt_tokens: 50_000, output_tokens: 1000, total_tokens: 51_000 },
  ]
  const s = summarise(rows)
  assert.equal(s.calls, 3)
  assert.equal(s.tokens, 154_500)
  assert.equal(s.features[0].feature, 'AI reader')   // dearest first
  assert.equal(s.features[0].calls, 2)
  assert.equal(s.features.length, 2)
  // The parts add up to the whole.
  assert.ok(Math.abs(s.features.reduce((n, f) => n + f.usd, 0) - s.usd) < 1e-9)
})

test('summarise — nothing metered is a clean zero, not a crash', () => {
  const s = summarise([])
  assert.deepEqual([s.calls, s.tokens, s.usd, s.gbp, s.features], [0, 0, 0, 0, []])
  assert.equal(summarise(null).calls, 0)
})

test('summarise — a row with no feature is still counted, under a name', () => {
  const s = summarise([{ model: 'gemini-2.5-flash', prompt_tokens: 10, output_tokens: 10, total_tokens: 20 }])
  assert.equal(s.features[0].feature, 'unknown')
  assert.equal(s.calls, 1)
})
