// The morning digest, as an email. No I/O — it renders, it does not send.
//
// Split from lib/dailyDigest.mjs deliberately. That module decides WHAT today
// needs and imports nothing, so it stays testable as plain data; this one is
// allowed to reach for the house shell, and reaching is all it does. Whoever
// wires the sending gets `{ subject, html }` and takes it from there.
//
// It does not send, and it cannot: live email is HOLD-gated until the owner
// flips it on, and the read that would fetch the tasks is his half too. This is
// the half that can be written and proved without either.
import { esc, brandShell } from './email.js'
import { digestSubject } from './dailyDigest.mjs'

const GOLD = '#c19161'
const INK = '#1f2430'
const MUTED = '#64748b'

// A line's own weight, shown rather than described. The reader is scanning at
// eight in the morning; "high priority" as words is one more thing to read.
function marker(line) {
  if (line.overdue) return `<span style="color:#b4462f;font-weight:700" title="past its date">●</span>`
  if (line.priority === 'high') return `<span style="color:${GOLD};font-weight:700" title="high priority">●</span>`
  return `<span style="color:#cbd5e1">●</span>`
}

/**
 * `{ subject, html }` for a digest, or `{ subject: '', html: '' }` when there
 * is nothing worth sending — a caller that forwards an empty digest anyway is
 * training the reader to ignore the next one.
 */
export function digestEmail(digest, { date = '' } = {}) {
  if (!digest || digest.quiet) return { subject: '', html: '' }

  const opener = digest.urgent
    ? `${digest.urgent} of these ${digest.urgent === 1 ? 'is' : 'are'} either marked urgent or past a date somebody set. The rest can wait for a quiet moment.`
    : 'Nothing here is urgent or overdue — this is the whole list, in the order worth working it.'

  const groups = digest.groups.map((g) => `
    <tr><td colspan="2" style="padding:18px 0 6px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.09em;color:${GOLD};font-weight:700">${esc(g.title)}</div>
      ${g.blurb ? `<div style="font-size:12px;color:${MUTED};padding-top:2px">${esc(g.blurb)}</div>` : ''}
    </td></tr>
    ${g.lines.map((l) => `<tr>
      <td width="18" valign="top" style="padding:5px 0;font-size:14px;line-height:1.5">${marker(l)}</td>
      <td style="padding:5px 0;font-size:14px;line-height:1.5;color:${INK}">${esc(l.title)}</td>
    </tr>`).join('')}
    ${g.more ? `<tr><td></td><td style="padding:3px 0 0;font-size:12px;color:${MUTED}">…and ${g.more} more like ${g.more === 1 ? 'it' : 'these'}.</td></tr>` : ''}
  `).join('')

  return {
    subject: digestSubject(digest, { date }),
    html: brandShell({
      title: date ? `What today needs — ${date}` : 'What today needs',
      // The preheader is the line the inbox shows beside the subject, so it
      // repeats the count rather than the greeting.
      preheader: `${digest.total} open${digest.urgent ? `, ${digest.urgent} needing you` : ''}.`,
      bodyRows: `
        <tr><td colspan="2" style="padding:0 0 6px;color:#334155;font-size:14px;line-height:1.55">${esc(opener)}</td></tr>
        ${groups}
      `,
      // Claims only what is true (claims re-sweep, 22 Aug): the Tasks screen
      // SHOWS snoozed tasks in their own lane; the digest deliberately drops
      // them — a snooze is somebody's "not yet", honoured. And each pile is
      // capped, announcing what it leaves out. "Everything open, the same list
      // the screen shows" was false on both counts.
      footNote: 'The Tasks screen\u2019s open list, ordered for reading. Anything you have snoozed is left to sleep, and a long pile says how many it left out.',
    }),
  }
}
