// The `icon` on each KIND is browser-DISPLAY markup, not data: it is
// interpolated unescaped into a span by public/main.js, which mirrors this
// file (test/customerRecordMirror.test.mjs holds the two identical). It
// became a drawn kc-ic class on 24 Aug so it follows the theme; nothing
// server-side reads it.
// Everything one person has with the shop, as units rather than badges.
//
// Owner, 20 August 2026: the customer card "isn't the correct broadness… should
// it not open as if it was a complete user profile, with his contact, what he
// has with us, all his lines, linked to that sim/vn, in a much more engaging
// and clear vision… as if a patient on the NHS system".
//
// The card and the full page were the SAME body — the page was the card with an
// Activity tab bolted on, so there was no record tier at all. And "Active
// Services" was a row of flat badges of which exactly one kind, the SIM, could
// be pressed; a rental, a virtual number, a flight, a repair were dead text.
// This module is the decision half of the record: which units a person has,
// whether each is still running, and what order they deserve to be read in.
//
// TWO THINGS IT DELIBERATELY DOES NOT DO.
//
// It does not build HTML — the same split as KC_MONEY and KC_NEXT, so the
// wording and the ordering can be argued about in a test rather than in a
// browser.
//
// And it does not pad. 80% of this shop's 610 customers have three items or
// fewer and the average is two; a record shaped for the 46-item customer would
// open as a scaffold of empty headings for four customers in five. Sections
// with nothing in them are absent, not shown as "0" — the same rule the
// document folders already follow.

/**
 * How each kind of thing is read.
 *
 * `ended` answers "is this finished", not "is this bad" — a returned rental and
 * a cancelled SIM are both simply over. `open` is the key the browser resolves
 * to an action; a kind with no opener says so rather than pretending, because a
 * link that goes nowhere is worse than plain text that never promised anything.
 */
export const KINDS = {
  sim: {
    label: 'SIM plan',
    icon: '<i class="kc-ic kc-ic-card" aria-hidden="true"></i>',
    open: 'sim',
    // Written out rather than lower-cased from the label: doing that turns
    // "SIM plan" into "sim plan", and an acronym is not a word.
    one: 'SIM plan',
    many: 'SIM plans',
    ended: (s) => String(s.status || '').toLowerCase() === 'cancelled',
    // The renewal is the date this line costs money again, which is the only
    // date anybody asks a SIM about.
    when: (s) => s.renewalDate || s.expiryDate || '',
    number: (s) => s.simNumber || '',
    name: (s) => s.provider || 'SIM plan',
    detail: () => '',
  },
  rental: {
    label: 'Phone rental',
    icon: '<i class="kc-ic kc-ic-phone" aria-hidden="true"></i>',
    one: 'phone rental',
    many: 'phone rentals',
    open: 'rental',
    ended: (r) => ['returned', 'void', 'cancelled', 'lost'].includes(String(r.status || '').toLowerCase()),
    when: (r) => r.toDate || '',
    number: (r) => r.phoneNumber || '',
    name: (r) => `Rental${r.country ? ` · ${r.country}` : ''}`,
    detail: () => '',
  },
  vn: {
    label: 'Virtual number',
    icon: '<i class="kc-ic kc-ic-digits" aria-hidden="true"></i>',
    one: 'virtual number',
    many: 'virtual numbers',
    open: 'vn',
    // Stored capitalised ('Active'), so compared case-insensitively rather than
    // against the exact string — the one that bit the SIM list.
    ended: (v) => String(v.status || '').toLowerCase() !== 'active',
    when: () => '',
    number: (v) => v.number || '',
    name: () => 'Virtual number',
    detail: () => '',
  },
  booking: {
    label: 'Flight',
    icon: '<i class="kc-ic kc-ic-plane" aria-hidden="true"></i>',
    one: 'flight',
    many: 'flights',
    open: 'booking',
    // A flight is over when it has been flown, not only when it is cancelled.
    // Nothing else in the app treats a past travel date as finished, which is
    // why flown flights sat in "Active Services" for ever.
    ended: (b, today) => String(b.status || '').toLowerCase().startsWith('cancel')
      || (!!b.travelDate && String(b.travelDate) < today),
    when: (b) => b.travelDate || '',
    // A flight has no phone number, and its booking reference is not one —
    // putting a PNR where a number goes would make the column meaningless.
    number: () => '',
    name: (b) => b.route || 'Flight',
    detail: (b) => b.bookingRef || b.airline || '',
  },
  repair: {
    label: 'Repair',
    icon: '<i class="kc-ic kc-ic-wrench" aria-hidden="true"></i>',
    one: 'repair',
    many: 'repairs',
    open: 'repair',
    ended: (r) => ['collected', 'cancelled'].includes(String(r.status || '').toLowerCase()),
    when: (r) => r.openedAt || '',
    number: () => '',
    name: (r) => r.device || 'Repair',
    detail: (r) => r.status || '',
  },
  service: {
    label: 'Print / online job',
    icon: '<i class="kc-ic kc-ic-printer" aria-hidden="true"></i>',
    one: 'print job',
    many: 'print jobs',
    open: 'service',
    // A one-off job is done the moment it is done; it is history, never a
    // running thing.
    ended: () => true,
    when: (o) => o.createdAt || '',
    number: () => '',
    name: (o) => o.serviceName || 'Service',
    detail: () => '',
  },
}

/**
 * Every unit for one customer, each already knowing whether it is finished.
 *
 * `number` and `name` are kept apart rather than pre-joined into one title,
 * because which of them leads is a presentation decision and this module makes
 * none — but WHICH FIELD IS THE NUMBER is a fact about the kind, and that is
 * decided here where it can be tested. A booking reference is not a phone
 * number and must never arrive in the number field: 838 numbers across 502
 * customers are what this shop recognises a line by, and a column that
 * sometimes holds a PNR stops being that.
 */
export function serviceUnits(lists = {}, today = '') {
  const day = today || new Date().toISOString().slice(0, 10)
  const out = []
  for (const [kind, spec] of Object.entries(KINDS)) {
    for (const row of lists[kind] || []) {
      if (!row) continue
      out.push({
        kind,
        id: row.id,
        icon: spec.icon,
        label: spec.label,
        open: spec.open,
        number: String(spec.number(row) || ''),
        name: String(spec.name(row) || spec.label),
        detail: String(spec.detail(row) || ''),
        status: String(row.status || ''),
        when: String(spec.when(row) || ''),
        ended: !!spec.ended(row, day),
      })
    }
  }
  return out
}

/**
 * The record, split and ordered.
 *
 * Running things are ordered by the date they next need somebody — soonest
 * first, undated last — because that is the order a person reads them in when
 * they are deciding what to do. Finished things are newest first, because
 * nobody scrolls a closed list looking for the oldest.
 */
export function groupUnits(units = []) {
  const running = units.filter((u) => !u.ended)
  const finished = units.filter((u) => u.ended)
  running.sort((a, b) => {
    // An undated running thing has no deadline, so it cannot jump the queue
    // ahead of one that has.
    if (!a.when && !b.when) return a.name.localeCompare(b.name)
    if (!a.when) return 1
    if (!b.when) return -1
    return a.when.localeCompare(b.when)
  })
  finished.sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')))
  return { running, finished }
}

/**
 * What the section headings say.
 *
 * Said in full rather than as bare numbers: "2 running" beside "5 finished" is
 * a table of contents, and the point of the record is that somebody can see at
 * a glance whether this person is a live customer or an old one.
 */
export function recordSummary(units = []) {
  const { running, finished } = groupUnits(units)
  const byKind = new Map()
  for (const u of running) byKind.set(u.kind, (byKind.get(u.kind) || 0) + 1)
  return {
    running: running.length,
    finished: finished.length,
    total: units.length,
    // Nothing at all is its own state, and it is not the same as everything
    // having finished — one is a new customer, the other is a lapsed one.
    state: units.length === 0 ? 'none' : running.length === 0 ? 'lapsed' : 'active',
    kinds: [...byKind.entries()].map(([kind, n]) => ({ kind, n, label: KINDS[kind].label })),
  }
}

/** The one-line answer to "what is this person to us". */
export function recordHeadline(summary) {
  if (!summary || summary.state === 'none') return 'Nothing on the books yet'
  if (summary.state === 'lapsed') {
    return `Nothing running — ${summary.finished} finished ${summary.finished === 1 ? 'item' : 'items'} on record`
  }
  const parts = summary.kinds.map((k) => `${k.n} ${k.n === 1 ? KINDS[k.kind].one : KINDS[k.kind].many}`)
  return parts.join(' · ')
}
