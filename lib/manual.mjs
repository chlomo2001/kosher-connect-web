// The manual: one entry per screen, for the person standing in front of it.
//
// lib/guides.mjs answers "how do I do this job" — 20 walk-throughs, task
// shaped, for the moment someone is stuck. This file is the other half: what
// every screen IS, what each part of it does, which rules bite there, and what
// to do when it misbehaves. Guides are for doing; the manual is for knowing.
//
// WHY IT IS CODE AND NOT A DOCUMENT. docs/ holds thirty-odd markdown files and
// most of them are dated snapshots — true on the day they were written and
// never touched again. A manual that goes stale is worse than no manual,
// because the helper covering the counter believes it. So this one is held by
// test/manual.test.mjs, which fails the build when:
//
//   • a screen exists with no entry here          (ALL_TABS, harness PAGES)
//   • a dialog exists with no entry here          (the harness MODALS registry)
//   • a screen is renamed and the entry is not    (TAB_META label + primary)
//   • the printed manual is out of date           (docs/MANUAL.md is generated)
//
// Add a tab, add a modal, rename a button — npm test goes red and the gate
// will not ship until someone has written the sentence. That is the whole
// mechanism. Nothing here relies on anyone remembering.
//
// NO NUMBERS. Rates, the free-day calendar, cap windows, deposit amounts —
// those live in BUSINESS_RULES.md and in Settings, and copying them here would
// create a second price list to disagree with the till. The manual says where
// a number comes from and what changes it, never what it is.
//
// Dependency-free on purpose, like lib/guides.mjs: it has to be readable by a
// generator, a test, a Next page, and one day a plain browser script.

/**
 * One screen.
 *   id       tab id (staff) or harness page key (public)
 *   kind     'staff' — inside the app, behind the sidebar
 *            'public' — a page with its own URL; customers or staff reach it directly
 *   name     what it is called on screen. For a staff screen this MUST match
 *            the TAB_META label, and the test checks it.
 *   path     public screens only: the URL a person types
 *   what     one sentence: what this screen is for. Required, drafts included.
 *   parts    [label, what it does] — the panels and buttons on the screen
 *   dialogs  [harness modal id, what the dialog is for] — every box that opens
 *            on top of this screen. The ids come from ops/harness/modals.mjs
 *            and the test holds the two lists together.
 *   rules    the rules that bite here, in words, pointing at where they live
 *   wrong    [what you are seeing, what to do about it]
 *   status   'written' — finished, and held to the quality checks
 *            'draft'   — the sentence is honest but the detail is not here yet.
 *                        The count is ratcheted in the test: it may go down,
 *                        never up, so a new screen has to be written now.
 */
export const SCREENS = [
  // ── The staff app ──────────────────────────────────────────────────────
  {
    id: 'dashboard', kind: 'staff', name: 'Dashboard', status: 'draft',
    what: 'The morning and evening screen: what the shop took today, what needs attention now, and the end-of-day cash up.',
    parts: [], rules: [], wrong: [],
    dialogs: [['cashup', ''], ['business-summary', '']],
  },
  {
    id: 'customers', kind: 'staff', name: 'Customers', status: 'draft',
    what: 'Everyone on the books — how to reach them, what they owe, everything they have ever had from the shop.',
    parts: [], rules: [], wrong: [],
    dialogs: [['customer-new', ''], ['customer-edit', ''], ['customer-card', ''],
      ['customer-page', ''], ['customer-page-log', ''], ['remind', ''],
      ['draft-reminder', ''], ['log-comm', ''], ['dup-scan', '']],
  },
  {
    id: 'rentals', kind: 'staff', name: 'Phone Rentals', status: 'written',
    what: 'Every phone the shop hires out: what is out with whom, what is due back, and what is free to rent today.',
    parts: [
      ['📱 New rental', 'Starts a hire. Customer, then dates, then handset — in that order, because the phone list only offers handsets that are actually free for those days.'],
      ['📷 Scan IMEI — out or back', 'Scanning the phone finds its rental for you, whether it is going out or coming back. Faster than searching, and it cannot pick the wrong record.'],
      ['Search rentals + inventory', 'One box over both lists: a customer name finds the hire, a phone number or IMEI finds the handset.'],
      ['Active & Recent Rentals', 'The working list. Filters sit above it, and ✈️ Upcoming travel narrows it to customers who are away or about to be — a customer stays on that list until the day they land back, not the day they fly.'],
      ['⚙ Manage', 'Everything that happens to a live hire: extend it, mark it returned, record damage or a missing charger, take the money owing.'],
      ['📥 Mark returned', 'Tick several rows and close them together — the after-Yom-Tov queue, where a family brings four phones back at once.'],
      ['Phone Inventory', 'The handsets themselves, not the hires: what each one is, whose it is, and whether it is out, free or retired.'],
      ['⚙️ Manage phones', 'Add a handset, retire one, correct a number or an IMEI.'],
      ['📶 Pools', 'Groups of handsets that are interchangeable, so a booking can be promised a phone without naming which one until it is handed over.'],
      ['📅 Availability', 'The calendar view — which phones are committed on which days. Use it before promising a phone for a date.'],
    ],
    dialogs: [
      ['rental-new', 'The hire itself: who, which dates, which handset, and what you handed over — phone, SIM, charger.'],
      ['rental-manage', 'The live hire. Returning, extending, damage, missing items, and what is owed.'],
      ['pool-new', 'Creates a pool of interchangeable handsets.'],
      ['done-panel', 'The confirmation after a rental is saved — what was agreed and what to hand over, so it can be read back to the customer.'],
    ],
    rules: [
      'The price comes from the phone type and the dates, not from what was charged last time. Shabbos and Yom Tov are not chargeable days, there is a minimum charge and a cap, and every rate lives in BUSINESS_RULES.md and Settings — never typed in by hand at the counter.',
      'A phone shown as free is free for the dates in the form. Change the dates and the list changes with them.',
      'What you tick as given — SIM, charger — is what the return screen expects back, and an unticked SIM changes the rate on a USA phone.',
    ],
    wrong: [
      ['The handset you want is not in the list', 'It is on hire, or committed to another booking, over those dates. Availability shows who has it and until when.'],
      ['The price is not what you expected', 'Open the price box in the form — it shows the day rate, the free days it has taken off and the cap it has applied. If the rate itself is wrong, that is Settings, not the rental.'],
      ['A phone came back but the rental still shows as out', 'The return was never saved. Find it, ⚙ Manage, turn on Returned — late days are worked out from the day you mark it, so do it on the day.'],
    ],
  },
  {
    id: 'sim', kind: 'staff', name: 'SIM Plans', status: 'draft',
    what: 'UK SIM-only plans the shop manages for customers — which network, which plan, what it renews at.',
    parts: [], rules: [], wrong: [],
    dialogs: [['sim-add', ''], ['sim-manage', '']],
  },
  {
    id: 'wallet', kind: 'staff', name: 'Wallet', status: 'draft',
    what: 'Money in and out against a customer: payments taken, charges raised, and what the balance is now.',
    parts: [], rules: [], wrong: [],
    dialogs: [['wallet', ''], ['bank-recon', '']],
  },
  {
    id: 'bookings', kind: 'staff', name: 'Tickets & Flights', status: 'draft',
    what: 'Flights booked for customers: the ticket, who is travelling, what it cost, and whether their documents will still be valid.',
    parts: [], rules: [], wrong: [],
    dialogs: [['booking-new', '']],
  },
  {
    id: 'repairs', kind: 'staff', name: 'Repairs', status: 'draft',
    what: 'Phones handed in for repair: what is wrong, where it is up to, and what to tell the customer when they ring.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'services', kind: 'staff', name: 'Online & Print', status: 'draft',
    what: 'The one-off jobs done at the counter — printing, forms, online tasks — charged to a customer or taken as a walk-in.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'shop', kind: 'staff', name: 'Shop', status: 'draft',
    what: 'Stock and the till: what is on the shelf, what it costs, and the full-screen counter screen for selling it.',
    parts: [], rules: [], wrong: [],
    dialogs: [['stock-item', ''], ['goods-in', ''], ['supplier-return', ''], ['supplier-return-manage', '']],
  },
  {
    id: 'koltorah', kind: 'staff', name: 'Kol Torah', status: 'draft',
    what: 'The Kol Torah consignment jobs the shop handles, kept apart from ordinary shop sales.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'virtual', kind: 'staff', name: 'Virtual Numbers', status: 'draft',
    what: 'Numbers rented to customers that ring through to somewhere else — who has which, and until when.',
    parts: [], rules: [], wrong: [],
    dialogs: [['vn-new', '']],
  },
  {
    id: 'tasks', kind: 'staff', name: 'Tasks', status: 'draft',
    what: "The shop's own to-do list, including the jobs the app files itself when something needs a person.",
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'review', kind: 'staff', name: 'Confirm Data', status: 'draft',
    what: 'Imported records the app is not willing to trust on its own — read them, correct them, confirm them into the books.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'mail', kind: 'staff', name: 'Carrier Mail', status: 'draft',
    what: 'Letters and emails that arrive from the networks, matched to the customer and SIM they belong to.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'settings', kind: 'staff', name: 'Settings', status: 'draft',
    what: 'Everything the shop can change without a code change: prices, the free-day calendar, what helpers may see, the public phone guide.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },

  // ── The pages with their own address ───────────────────────────────────
  {
    id: 'welcome', kind: 'public', name: 'The front page', path: '/welcome', status: 'draft',
    what: 'What a customer sees first: what the shop does, where it is, and the form that files an enquiry as a task.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'portal', kind: 'public', name: 'Customer portal', path: '/portal', status: 'draft',
    what: "A customer's own page — their rentals, bookings and balance, without ringing the shop to ask.",
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'phone-guide', kind: 'public', name: 'The phone guide', path: '/phone-guide', status: 'draft',
    what: 'Every handset the shop stands behind, compared honestly. The content is owner-written in Settings, not in code.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'repair', kind: 'public', name: 'Repair request', path: '/repair', status: 'draft',
    what: 'The form a customer fills in to book a repair before coming in.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'login', kind: 'public', name: 'Staff sign-in', path: '/login', status: 'draft',
    what: 'Where staff sign in. Nobody reaches the app without passing through here.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'tool-contacts', kind: 'public', name: 'Contacts tool', path: '/tools/contacts', status: 'draft',
    what: 'Staff tool: turns a list of contacts into a file a phone can import.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'tool-convert', kind: 'public', name: 'Convert tool', path: '/tools/convert', status: 'draft',
    what: 'Staff tool: converts a file a customer has brought in into a format that is usable.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'tool-ocr', kind: 'public', name: 'Read-a-document tool', path: '/tools/ocr', status: 'draft',
    what: 'Staff tool: reads the text off a photographed or scanned document.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'tool-transfer', kind: 'public', name: 'Transfer tool', path: '/tools/transfer', status: 'draft',
    what: 'Staff tool: moves a large file between the shop and a customer.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'manual', kind: 'public', name: 'The manual', path: '/manual', status: 'written',
    what: 'This page: every screen in the system described in order, on one page that prints.',
    parts: [
      ['Contents', 'Jumps to any screen. It is hidden when the page is printed, because a printed list of links is dead paper.'],
      ['🖨 Print', "Prints the whole manual, laid out so a screen's description is never split across two sheets. This is the copy to hand someone starting on Sunday."],
      ['← Back to the app', 'Returns to the app. The manual opens in its own tab from the help panel, so it can be read alongside the work rather than instead of it.'],
      ['❓ How do I…?', 'The other half, inside the app: the same knowledge as steps for the job in front of you. Ask it in your own words.'],
    ],
    dialogs: [],
    rules: [
      'The manual never quotes a price, a rate or a free-day list. Those live in Settings and in BUSINESS_RULES.md, so that there is one price list in the business and the till is holding it.',
      'It is written in one place and read in three — this page, the copy in the repository, and the help panel. Correcting a sentence here corrects it everywhere.',
      'It cannot quietly fall behind: adding a screen or a box, or renaming a button, fails the tests until the manual is updated to match.',
    ],
    wrong: [
      ['A screen says it is not written out in full yet', 'That entry is honest about being short — the one sentence is true, the detail has not been written. Ask for that screen next and it gets written.'],
      ['The manual and the app disagree', 'Believe the app and say so. A wrong manual is worse than a missing one, and a disagreement is a fault to be fixed, not a difference of opinion.'],
    ],
  },
  {
    id: 'privacy', kind: 'public', name: 'Privacy notice', path: '/privacy', status: 'draft',
    what: 'What the shop holds about a customer and why. Linked from the front page footer and the sign-up form.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'terms', kind: 'public', name: 'Terms', path: '/terms', status: 'draft',
    what: 'The terms a customer is agreeing to. Linked from the front page footer.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
  {
    id: 'refund', kind: 'public', name: 'Refund policy', path: '/refund', status: 'draft',
    what: 'When money is given back and how. Linked from the front page footer.',
    parts: [], rules: [], wrong: [], dialogs: [],
  },
]

/** One screen by id, or null. */
export function screen(id, screens = SCREENS) {
  return screens.find(s => s.id === String(id || '')) || null
}

/** The screens of one kind, in the order they are declared. */
export function screensOf(kind, screens = SCREENS) {
  return screens.filter(s => s.kind === kind)
}

/** The entries still waiting to be written out in full. */
export function draftScreens(screens = SCREENS) {
  return screens.filter(s => s.status === 'draft')
}

/** Every dialog id the manual claims to cover, screen by screen. */
export function manualDialogs(screens = SCREENS) {
  return screens.flatMap(s => (s.dialogs || []).map(([id]) => id))
}

/** How much of the manual is actually written, for the page footer. */
export function manualProgress(screens = SCREENS) {
  const total = screens.length
  const written = screens.filter(s => s.status === 'written').length
  return { total, written, drafts: total - written }
}
