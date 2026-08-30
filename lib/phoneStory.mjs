// What has happened to one handset, in order.
//
// Owner, 30 Aug 2026: "i wanna be able to see a history on each phone in
// rentals, at which date it got added to the inventory."
//
// The date was already there and had never been shown. `lines.created_at` is
// NOT NULL and honest — counted that day: 3 handsets on 26 Aug, 31 on 27 Aug
// (Shloime's sheet import), 2 on 30 Aug. What stopped it reaching the screen is
// lib/tableStore.js's listApp, which reads legacy_extras AND ONLY the blob, so
// every typed column beside it is write-only. listPhones now reads created_at
// alongside and merges it on as `addedAt` — and lib/mappers.js strips it again
// on the way in, because a copy of a column inside the blob is a second answer
// that starts drifting the moment it is written (the rule lib/provenance.mjs
// exists to enforce).
//
// ONE HONESTY. For a handset that arrived in an import, this is the day the APP
// learned about it, not the day the shop bought it — 31 of 36 are in that
// position. The label says "on the books here since" rather than "bought",
// because the second would be a claim the data cannot support.
//
// Pure. Mirrored into public/main.js as KC_PHONESTORY.

/** Ordinary calendar days between two ISO dates, or null. */
function daysBetween(a, b) {
  const x = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`)
  const y = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 86400000) : null
}

const iso = (v) => (v ? String(v).slice(0, 10) : null)

/**
 * phoneStory(phone, rentals, today) → events, NEWEST FIRST.
 *
 * Each event: { date, kind, title, detail, rentalId? }
 *
 * `kind` is one of 'added' | 'out' | 'back' | 'retired', which is what a screen
 * colours and what a test can assert on. The words live in `title`/`detail` so
 * a wording change is not a behaviour change.
 *
 * Rentals are filtered by phoneId here rather than by the caller, so every
 * screen showing this trail is showing the same one.
 */
export function phoneStory(phone, rentals = [], today = null, fmt = {}) {
  if (!phone) return []
  const out = []
  const date = (d) => (fmt.date ? fmt.date(d) : d)

  const mine = (rentals || []).filter((r) => r && !r.voided && String(r.phoneId) === String(phone.id))

  const added = iso(phone.addedAt)
  if (added) {
    // A HIRE OLDER THAN THE RECORD IS NORMAL HERE, AND HAS TO SAY SO.
    // Counted on Kc-Live, 30 Aug: 5 rentals start before their handset's
    // created_at, because the handsets arrived in the 27 Aug import and the
    // hires were already running. Left unexplained the trail reads "added on
    // the 26th, out with somebody on the 24th" and looks like a fault in the
    // data rather than a fact about it.
    const earliest = mine.map((r) => iso(r.fromDate)).filter(Boolean).sort()[0] || null
    const usedBefore = earliest && earliest < added
    out.push({
      date: added,
      kind: 'added',
      title: 'Added to the inventory',
      // Named as what it is. See the honesty note at the top of this file.
      detail: [
        phone.dataSource === 'import'
          ? 'Came in with an import, so this is the day the app learned about it'
          : 'Entered here by hand',
        usedBefore
          ? `it was already out on hire from ${date(earliest)}, before there was a record of it`
          : null,
      ].filter(Boolean).join(' \u2014 '),
    })
  }
  for (const r of mine) {
    const from = iso(r.fromDate)
    if (from) {
      const nights = daysBetween(from, iso(r.toDate))
      out.push({
        date: from,
        kind: 'out',
        rentalId: r.id,
        title: `Out with ${r.customerName || 'a customer'}`,
        detail: [
          iso(r.toDate) ? `until ${date(iso(r.toDate))}` : null,
          Number.isFinite(nights) && nights > 0 ? `${nights} day${nights === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · '),
      })
    }
    // A return is its own event and only exists once it has happened. A hire
    // still running has no second row, which is what makes the trail readable
    // as "where is it now" as well as "where has it been".
    const back = iso(r.returnedDate || (r.status === 'returned' ? r.toDate : null))
    if (back) {
      out.push({
        date: back,
        kind: 'back',
        rentalId: r.id,
        title: 'Back on the shelf',
        detail: r.customerName ? `returned by ${r.customerName}` : '',
      })
    }
  }

  if (phone.status === 'retired') {
    // No date is recorded for retirement, so this rides at the end rather than
    // inventing one. Undated events sort last, which is where "we do not know
    // when" belongs.
    out.push({ date: null, kind: 'retired', title: 'Retired', detail: 'No longer offered for hire' })
  }

  // Newest first, undated last. Ties break on kind so 'out' reads before 'back'
  // on a same-day turnaround rather than flipping between renders.
  const rank = { out: 0, back: 1, added: 2, retired: 3 }
  return out.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9)
  })
}

/** "3 hires · on the books since 27 Aug 2026" — the one-line version. */
export function phoneStoryLine(phone, rentals = [], fmt = {}) {
  const date = (d) => (fmt.date ? fmt.date(d) : d)
  const events = phoneStory(phone, rentals, null, fmt)
  const hires = events.filter((e) => e.kind === 'out').length
  const added = events.find((e) => e.kind === 'added')
  const parts = []
  parts.push(hires ? `${hires} hire${hires === 1 ? '' : 's'}` : 'never been out')
  if (added) parts.push(`on the books here since ${date(added.date)}`)
  return parts.join(' · ')
}
