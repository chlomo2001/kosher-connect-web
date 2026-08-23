// Actually sending one carrier forward — the half lib/mailForward.mjs
// deliberately does not do.
//
// Shared between the approval endpoint (pages/api/mail-forward.js) and the
// auto path in the inbound hook (issue #15: the four safe kinds and, under
// stricter conditions, an OTP forward themselves on arrival). One body
// builder and one marking rule, so an approved forward and an automatic one
// read identically to the customer and to the audit trail.
import { db } from './db.js'
import { sendEmail } from './email.js'

/**
 * What the customer receives.
 *
 * The carrier's own words, quoted, with one line of our own saying why they
 * have it. Not rewritten: a paraphrase of a carrier's message is a new claim
 * made in the shop's name, and this shop should not be making claims about
 * somebody else's network.
 */
export function forwardBody({ name, carrier, subject, snippet, reason }) {
  const hello = name ? `Dear ${name},` : 'Hello,'
  const from = carrier ? `${carrier}` : 'your network'
  const text =
    `${hello}\n\n` +
    `${from} sent us this about your line, and we thought you would want to see it.\n\n` +
    `--- ${subject || '(no subject)'} ---\n${snippet || '(no text)'}\n---\n\n` +
    `${reason}\n\n` +
    `You do not need to reply to this. If anything about it looks wrong, ring us on 0161 531 1386.\n\n` +
    `Kosher Connect`
  const esc = (s) => String(s || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))
  const html =
    `<p>${esc(hello)}</p>` +
    `<p>${esc(from)} sent us this about your line, and we thought you would want to see it.</p>` +
    `<blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:16px 0;">` +
    `<strong>${esc(subject || '(no subject)')}</strong><br>${esc(snippet || '(no text)').replace(/\n/g, '<br>')}` +
    `</blockquote>` +
    `<p>${esc(reason)}</p>` +
    `<p style="color:#666;font-size:13px;">You do not need to reply to this. If anything about it looks wrong, ` +
    `ring us on 0161 531 1386.</p><p>Kosher Connect</p>`
  return { text, html }
}

/**
 * Send one forward and record it — with the marking rule that differs between
 * a human approval and the automatic path:
 *
 *   markHeld: true   (the approval queue) — the owner has SAID send it, so a
 *             HELD build is still marked forwarded; re-offering it tomorrow
 *             would ask them the same question again.
 *   markHeld: false  (auto, the default) — nobody has decided anything. A held
 *             build stays UNMARKED, so it remains in the approval queue and
 *             goes when the owner either approves it or lifts the gate.
 *             Marking it would silently drop it for ever.
 *
 * Returns sendEmail's result, or { ok:false, invalid|error } — never throws.
 */
export async function sendCarrierForward({ row, to, reason, forceLive = false, markHeld = false }) {
  const body = forwardBody({
    name: to.name, carrier: row.carrier, subject: row.subject, snippet: row.snippet, reason,
  })
  let r
  try {
    r = await sendEmail({
      to: to.email,
      subject: `About your line — ${row.subject || 'a message from your network'}`,
      text: body.text,
      html: body.html,
      kind: 'carrier_forward',
      customerId: to.customerId,
      forceLive,
    })
  } catch (e) {
    console.error('[forwardSend]', row.id, e)
    return { ok: false, error: 'provider-refused' }
  }
  if (r && r.invalid) return r
  // Marked forwarded only when the CUSTOMER actually got it (live send), or a
  // human approved it (markHeld — an owner's decision stands whatever the gate
  // did). A HELD build and a TEST-redirect both leave the row unmarked: in
  // test mode the message went to the tester's inbox, not the customer, and
  // marking it would quietly drop it from the approval queue for ever —
  // spotted the day the owner set MAIL_TEST_TO (23 Aug).
  const consumed = !!(r && r.ok && !r.held && !r.redirectedTo)
  if (consumed || markHeld) {
    await db.update('sim_mail', `id=eq.${encodeURIComponent(String(row.id))}`, {
      forwarded_at: new Date().toISOString(),
      forwarded_to: to.email,
    }).catch((e) => console.error('[forwardSend] mark failed', row.id, e))
  }
  return r
}
