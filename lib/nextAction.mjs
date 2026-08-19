// What does the person standing here do next?
//
// Port item B2. One row at the top of a screen, phrased as a verb, computed
// from that screen's own data — and when nothing is outstanding it says so and
// loses the button, because an empty queue is a result rather than a blank
// space. For a shop where most screens are quiet most of the time, that is the
// common case, not the edge case.
//
// Three rules, all of which matter:
//
// 1. THE ROW DECIDES NOTHING. Each screen works out its own counts and passes
//    them in; this turns counts into words. Data → decision → words, never
//    words back to decision, so rewording can never change what a screen
//    believes is outstanding.
// 2. THE BROKEN STATE IS UNWRITABLE. A row that names an action and offers no
//    way to do it reads as broken next to the ones that work. `nextAction`
//    throws rather than return one: either it is `clear`, or it carries
//    somewhere to go. The browser wrapper catches and renders nothing, so a
//    mistake costs a row and never a screen.
// 3. GOING THERE MEANS GOING THERE. Enforced in the browser half: an action
//    that only scrolls is the same dead end for anyone not using a mouse, so
//    focusPanel scrolls AND moves keyboard focus into the panel.

export const NOTHING = 'Nothing waiting on you here.'

/**
 * One next-action row, or a refusal to build a broken one.
 *
 * `{ clear: true }`                   — nothing outstanding.
 * `{ text, label, do, count? }`       — something is, and `do` names the way to it.
 *
 * `do` is a KEY, not a function: the browser holds the table of what each key
 * runs (KC_NEXT_DO in public/main.js) and a mirror test holds the two together,
 * so a row naming an action nothing can perform fails a test rather than
 * reaching a screen.
 */
export function nextAction(spec = {}) {
  if (spec.clear) return { clear: true, text: spec.text || NOTHING }
  const text = String(spec.text || '').trim()
  if (!text) throw new Error('nextAction: a row that is not clear must say what to do')
  const label = String(spec.label || '').trim()
  if (!label) throw new Error(`nextAction: "${text}" names no button`)
  if (!spec.do) {
    throw new Error(`nextAction: "${text}" offers no way to do it — give it a do-key, or mark it clear`)
  }
  return {
    clear: false,
    text,
    label,
    do: String(spec.do),
    count: Number.isFinite(spec.count) ? spec.count : null,
    tone: spec.tone === 'urgent' ? 'urgent' : 'normal',
  }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`

/**
 * The screens, in the order a person meets them, each reading only its own
 * facts. Every entry returns a spec for `nextAction` — never HTML, never a
 * DOM node, so all of this is testable without a browser.
 *
 * `facts` are counts the screen already computes for its own headline numbers.
 * They are passed in rather than derived here so that the row and the number
 * above it can never disagree.
 */
export const SCREEN_ACTIONS = {
  dashboard(f) {
    // The dashboard is the summary, so its next action is the loudest single
    // thing anywhere — otherwise it would be the one screen that says "all
    // clear" while a tab behind it has work on it.
    // A customer who texted a question and has had no answer comes first, above
    // the money. Everything else on this list is the shop's own business going
    // slowly; this one is a person sitting looking at their phone. It is also
    // the shortest-lived: an overdue rental is still overdue tomorrow, an
    // unanswered text at closing time is a customer who thinks they were
    // ignored. Counted only when a reply actually SENT — a reply the safety
    // gate held never reached them (lib/replyQueue.mjs).
    if (f.smsWaiting) return { text: `${plural(f.smsWaiting, 'text')} waiting for an answer`, label: 'Read them', do: 'messages.waiting', count: f.smsWaiting, tone: 'urgent' }
    if (f.overdueRentals) return { text: `${plural(f.overdueRentals, 'phone')} overdue back`, label: 'Chase them', do: 'rentals.overdue', count: f.overdueRentals, tone: 'urgent' }
    if (f.readyRepairs) return { text: `${plural(f.readyRepairs, 'repair')} ready to collect`, label: 'Tell them', do: 'repairs.ready', count: f.readyRepairs }
    if (f.lateRenewals) return { text: `${plural(f.lateRenewals, 'SIM plan')} past the renewal date`, label: 'Check them', do: 'sim.late', count: f.lateRenewals }
    if (f.dueTasks) return { text: `${plural(f.dueTasks, 'task')} due today or overdue`, label: 'Open tasks', do: 'tasks.due', count: f.dueTasks }
    if (f.mailPending) return { text: `${plural(f.mailPending, 'carrier email')} nobody has dealt with`, label: 'Open the mail', do: 'mail.pending', count: f.mailPending }
    return { clear: true }
  },

  customers(f) {
    if (f.unreachable) return { text: `${plural(f.unreachable, 'customer')} with no way to reach them`, label: 'Show them', do: 'customers.unreachable', count: f.unreachable }
    return { clear: true }
  },

  rentals(f) {
    if (f.overdueRentals) return { text: `${plural(f.overdueRentals, 'phone')} overdue back`, label: 'Show them', do: 'rentals.overdue', count: f.overdueRentals, tone: 'urgent' }
    if (f.dueTodayRentals) return { text: `${plural(f.dueTodayRentals, 'rental')} due back today`, label: 'Show them', do: 'rentals.dueToday', count: f.dueTodayRentals }
    return { clear: true }
  },

  // A renewal that happens by itself is news, not work — the owner said so on
  // 19 Aug and the dashboard feed was changed for it. One PAST its date did not
  // happen by itself, which is why only that one is here.
  sim(f) {
    if (f.lateRenewals) return { text: `${plural(f.lateRenewals, 'SIM plan')} past the renewal date`, label: 'Show them', do: 'sim.late', count: f.lateRenewals, tone: 'urgent' }
    return { clear: true }
  },

  bookings(f) {
    if (f.needCheckIn) return { text: `${plural(f.needCheckIn, 'passenger')} flying soon and not checked in`, label: 'Show them', do: 'bookings.upcoming', count: f.needCheckIn, tone: 'urgent' }
    if (f.unparsedTickets) return { text: `${plural(f.unparsedTickets, 'airline email')} waiting to be read`, label: 'Read them', do: 'bookings.tickets', count: f.unparsedTickets }
    return { clear: true }
  },

  wallet(f) {
    if (f.arrears) return { text: `${plural(f.arrears, 'customer')} in arrears`, label: 'Show them', do: 'wallet.arrears', count: f.arrears }
    return { clear: true }
  },

  repairs(f) {
    if (f.readyRepairs) return { text: `${plural(f.readyRepairs, 'repair')} ready to collect`, label: 'Tell them', do: 'repairs.ready', count: f.readyRepairs }
    return { clear: true }
  },

  shop(f) {
    if (f.lowStock) return { text: `${plural(f.lowStock, 'item')} low on stock`, label: 'Show them', do: 'shop.low', count: f.lowStock }
    if (f.openReturns) return { text: `${plural(f.openReturns, 'supplier return')} still open`, label: 'Show them', do: 'shop.returns', count: f.openReturns }
    return { clear: true }
  },

  tasks(f) {
    if (f.dueTasks) return { text: `${plural(f.dueTasks, 'task')} due today or overdue`, label: 'Start at the top', do: 'tasks.due', count: f.dueTasks, tone: f.highTasks ? 'urgent' : 'normal' }
    return { clear: true }
  },

  review(f) {
    if (f.unconfirmed) return { text: `${plural(f.unconfirmed, 'imported record')} nobody has checked`, label: 'Work the batch', do: 'review.batch', count: f.unconfirmed }
    return { clear: true }
  },

  mail(f) {
    if (f.mailPending) return { text: `${plural(f.mailPending, 'carrier email')} nobody has dealt with`, label: 'Show them', do: 'mail.pending', count: f.mailPending }
    return { clear: true }
  },

  // Quiet by design. They are places you go to do a thing, not queues that
  // fill up on their own, and a row inventing work for them would be noise.
  services: () => ({ clear: true }),
  koltorah: () => ({ clear: true }),
  virtual: () => ({ clear: true }),
  settings: () => ({ clear: true }),
}

/** The row for a screen — always a valid row, or a refusal (never a broken one). */
export function screenNextAction(screen, facts = {}) {
  const decide = SCREEN_ACTIONS[screen]
  if (!decide) return nextAction({ clear: true })
  return nextAction(decide(facts) || { clear: true })
}

/** Every screen this knows about, for the tap-count table and the tests. */
export const SCREENS = Object.keys(SCREEN_ACTIONS)

/**
 * Every `do` key any screen can ever emit.
 *
 * Derived by asking each screen for a row with every fact set, rather than
 * written out by hand beside the code it is meant to describe — a hand-kept
 * list is exactly the thing that goes stale without anybody noticing.
 */
export function allActionKeys() {
  const every = {
    overdueRentals: 1, dueTodayRentals: 1, readyRepairs: 1, lateRenewals: 1,
    dueTasks: 1, highTasks: 1, mailPending: 1, unreachable: 1, needCheckIn: 1,
    unparsedTickets: 1, arrears: 1, lowStock: 1, openReturns: 1, unconfirmed: 1,
    smsWaiting: 1,
  }
  const keys = new Set()
  for (const screen of SCREENS) {
    // Peel one fact at a time so the branches BELOW the first `if` are reached
    // too — otherwise this only ever sees each screen's loudest action.
    const facts = { ...every }
    for (let guard = 0; guard < 20; guard++) {
      const row = screenNextAction(screen, facts)
      if (row.clear) break
      keys.add(row.do)
      // Silence whatever produced this row and ask again. Decide WHICH facts to
      // silence against the facts as they are now, then apply them together —
      // zeroing one while still testing the rest against the mutated set
      // cascades, and every screen reports only its loudest action.
      const silence = Object.keys(facts).filter((k) => {
        if (!facts[k]) return false
        return screenNextAction(screen, { ...facts, [k]: 0 }).do !== row.do
      })
      if (!silence.length) break
      for (const k of silence) facts[k] = 0
    }
  }
  return [...keys].sort()
}
