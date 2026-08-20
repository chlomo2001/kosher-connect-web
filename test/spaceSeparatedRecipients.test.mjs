// A recipient header with two addresses separated by a SPACE.
//
// Owner, 20 Aug, on a Lebara welcome mail: "in app it says it was forwarded to
// app from 'gitt.bilg@gmail.com', here not." It was not. The message reached
// the app carrying `5311386k@gmail.com sims-in@kosher-connect.com` in one
// header field. The splitter only knew commas and semicolons, so that whole
// string was treated as one address; it ends in the shop's own hop domain, so
// the hop filter threw it away — and threw away the Gmail address in front of
// the space, which was the only thing that could have named a SIM.
//
// 27 messages in the live queue arrived that way.
import test from 'node:test'
import assert from 'node:assert'
import { addressesOf, pairableRecipients, deliveryRoute } from '../lib/inboundMail.mjs'

const HOP = 'kosher-connect.com'

test('a space-separated header yields both addresses', () => {
  assert.deepEqual(
    addressesOf('5311386k@gmail.com sims-in@kosher-connect.com'),
    ['5311386k@gmail.com', 'sims-in@kosher-connect.com']
  )
})

test('the pairable address survives the hop that shared its field', () => {
  const payload = { deliveredTo: 'hasho.mr.im.m.cr+fedf@gmail.com sims-in@kosher-connect.com' }
  assert.deepEqual(pairableRecipients(payload, HOP), ['hasho.mr.im.m.cr+fedf@gmail.com'])
  // the hop is still recorded as a fact about how it got here
  assert.ok(deliveryRoute(payload).includes('sims-in@kosher-connect.com'))
})

test('a display name keeps its spaces', () => {
  assert.deepEqual(
    addressesOf('Gitt Bilig <gitt.bilig+m@gmail.com>, Other Name <o@x.com>'),
    ['gitt.bilig+m@gmail.com', 'o@x.com']
  )
})

test('mixed separators in one field', () => {
  assert.deepEqual(
    addressesOf('a@x.com b@x.com, c@x.com;  d@x.com'),
    ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com']
  )
})

test('tabs and newlines separate too, and blanks add nothing', () => {
  assert.deepEqual(addressesOf('a@x.com\tb@x.com\nc@x.com'), ['a@x.com', 'b@x.com', 'c@x.com'])
  assert.deepEqual(addressesOf('  ,  ; '), [])
})
