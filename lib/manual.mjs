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
    id: 'dashboard', kind: 'staff', name: 'Dashboard', status: 'written',
    what: 'The morning and evening screen: what the shop took today, what needs doing now, and a way into whichever job is shouting loudest.',
    parts: [
      ['The date line', "Today in English and in Hebrew, with a running clock. The greeting uses your own first name, so it is obvious whose sign-in the screen is on."],
      ['↻ Refresh', 'Re-reads today\'s money and tasks. The screen paints from what it already had and then updates, so an old figure for a moment is normal; this forces it.'],
      ['📊 Summary', 'Takings broken down by what earned them — rentals, tickets, the till — for the week and the month. Owner only: it is not on the screen for a helper.'],
      ['📱 New rental · ✈️ New booking · 🔧 New repair · 👤 New customer', 'The four jobs that start at the counter, opened from here without hunting for the right tab first.'],
      ['Money in today', 'What has actually come in today — not what has been invoiced. Underneath: what was charged out, how the week compares with the last one, and progress against the month\'s target if one is set.'],
      ['Outstanding', 'What the shop is owed, then the customers who owe it, biggest first. Press a name to open that customer. A walk-in has no name to open, so it is marked as one.'],
      ['The row of counts', 'Active rentals, open repairs, flights, SIM renewals and open tasks. Each is a button: it opens the tab it counts, already on the right list.'],
      ['Needs attention', 'The one list to read first thing. Overdue rentals, repairs waiting to be collected, flights coming up, SIM plans renewing or already past their date, stock running low, returns still open with a supplier, customers with no number anywhere on their record, and high-priority tasks. Every line goes straight to the thing it is about.'],
      ['Recent wallet activity', 'The last payments and charges as they land, so money going on the books is visible without opening the ledger.'],
    ],
    dialogs: [
      ['business-summary', 'The owner\'s read of the business: what each service earned this week and this month.'],
    ],
    rules: [
      "\"Today\" is the shop's own day, not the clock in a data centre — the takings line changes at midnight here, and cash-up counts the same day it does.",
      'Needs attention shows the ten most pressing lines and no more. It is a queue to work through, not an inbox: a long tail of renewals is rolled into one line so it cannot push an overdue rental off the bottom.',
      'The flights count asks who is DEPARTING in the week ahead. A customer already abroad is not on it and should not be — the trip-long checks live on their booking.',
      'Nothing here is a place to fix anything. Every line hands you to the screen that owns it, so a correction is made once, where the record lives.',
    ],
    wrong: [
      ['The figures look wrong or stale', 'Press ↻ Refresh. The screen shows what it last read while the new numbers arrive, so a figure can lag a change made seconds ago on another screen.'],
      ['"All clear" but you know something is outstanding', 'The feed only knows what has been recorded. A rental never marked returned, a repair left on the wrong stage or a payment taken but not entered are all invisible here — and all fixable on their own tab.'],
      ['Money in today looks too low', 'It counts money RECEIVED today. Work done today and charged to an account is money owed, not money in — it shows under Outstanding until they pay.'],
      ['📊 Summary is not on the screen', 'It is owner-only. A helper signed in sees the rest of the dashboard without it.'],
    ],
  },
  {
    id: 'customers', kind: 'staff', name: 'Customers', status: 'written',
    what: 'Everyone on the books: how to reach them, what they owe, and everything they have ever had from the shop in one place.',
    parts: [
      ['The counts along the top', 'How many customers are registered, how many rentals and SIM plans are running, and what the shop has taken from rentals all told.'],
      ['Customer List', 'The list itself, surname first so it reads the way you would say it. A row shows their number, what they have on the go, and their balance.'],
      ['Filter', 'Narrows the list to one kind of customer: an active rental, a flight coming up, a SIM plan, a virtual number, an open repair, money owed, a passport on file, or nobody-can-ring-them — no number of theirs and no SIM of ours either.'],
      ['Sort', 'Surname or first name, either direction; most owed first when chasing money; recently added after an import; most services first to find the shop\'s busiest customers.'],
      ['Export CSV', 'The list as it is filtered and sorted, as a file — for a mail merge, or for anything the app does not do itself.'],
      ['👥 Duplicates', 'Owner only. Reviews the whole book for records that look like the same person entered twice, with the evidence beside each pair.'],
      ['+ New customer', 'Adds someone. A name and a number is enough to start; everything else can follow.'],
      ['Details', 'Opens their card beside the list — the whole history without leaving the list you were working through.'],
      ['⤢ Open as a full page', 'The same customer on their own address, which survives a refresh and can be sent to someone else. It has an Overview and an Activity timeline.'],
      ['💬 Contact', 'Draft a reminder (written for you, and nothing is sent from here), draft a reply to a message they sent, or log a call or note so the next person knows what was said.'],
      ['💷 Money', 'Charge the card they have saved, save one for next time, or make a payment link to send them. The card number is entered on Stripe\'s own screen — the shop never sees it and never holds it.'],
      ['⚙️ Manage', 'Set yourself a reminder about them, edit their details, and — for the owner — look up what their line is doing with the carrier.'],
      ['Documents', 'Files shared with the customer, which they see in their own portal, and anything they have sent back. What they upload waits for you to approve or reject it, so nothing lands on the record unread.'],
    ],
    dialogs: [
      ['customer-new', 'Adding someone: name, number, address, and how they should be billed.'],
      ['customer-edit', 'The same details afterwards. The carrier-login field appears here and not on the add form.'],
      ['customer-card', 'The card beside the list: balance, everything they have on the go, their history, and the three tool menus.'],
      ['customer-page', 'The same thing as a page of its own, with an address you can refresh or send on.'],
      ['customer-page-log', 'The Activity tab of that page: everything that has ever happened to this customer, newest first.'],
      ['remind', 'A reminder for YOU about this customer. It becomes a task on your own list, and nothing reaches them.'],
      ['draft-reminder', 'Writes a chasing message for you to read, correct and send yourself. It is a draft, not a send.'],
      ['log-comm', 'Records a call, a text or a conversation on their history, so the next person picking up the phone knows what was already said.'],
      ['dup-scan', 'The duplicate review: likely pairs, the evidence on each side, and two answers — merge into the record you are keeping, or not the same person.'],
    ],
    rules: [
      'Two records with the same name are as often two brothers as one man typed twice. The duplicate review puts the evidence on the screen — the SIMs, rentals, bookings and money on each side — and "not the same" is remembered, so the pair never asks again.',
      'Nothing on this screen sends anything to a customer. Drafting a reminder writes it; sending it is a separate, deliberate act.',
      'A passport on file is shown as a yes on the list and nowhere as a number. Passport details are the customer\'s private data and the app treats them that way in every list, export and report.',
      'The balance is the one from the ledger, counting charges as well as payments. For a moment after the screen opens you may see the rental-only figure while the real one arrives.',
    ],
    wrong: [
      ['The list is empty', 'Read the words. "No customers yet" and "could not load your customers" are different screens on purpose — the second offers a retry, and is not a reason to start typing the book back in.'],
      ['A search finds nobody', 'The empty result offers ✕ Clear search. The term stays in the box until you clear it, which is why the next search can look broken.'],
      ['The same person is on the list twice', 'Owner: 👥 Duplicates. Merge into the record you want to keep — history from both sides follows the merge, so keep the one with the better details.'],
      ['The balance is not what you expected', 'Open their wallet. The card shows what the ledger says, and a charge raised but not yet paid moves the balance exactly as a payment does.'],
      ['👥 Duplicates or the carrier lookup is missing', 'Both are owner-only. A helper signed in has the rest of the screen.'],
    ],
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
    id: 'wallet', kind: 'staff', name: 'Wallet', status: 'written',
    what: 'The money side of the shop: what came in today, who owes, who is in credit, and every payment and charge as it lands.',
    parts: [
      ['The four figures', 'Money in today, charged out today, what the shop is owed altogether, and how much prepaid credit it is holding for people.'],
      ['Choose a customer · 💰 Record payment / credit', 'The way in: pick the person, then record what they handed over. Nothing is recorded against nobody.'],
      ['🧾 Cash-up', 'The end-of-day count. What the app says came in, by method, against what is actually in the drawer.'],
      ['🏦 Bank & card reconciliation', 'Owner only. What the bank says arrived, matched against what the books say was taken.'],
      ['In arrears', 'Everyone who owes, largest first. Take the payment straight from the row, or press the name to open them.'],
      ['In credit', 'Everyone the shop is holding money for, so a prepayment is never quietly forgotten when they come in.'],
      ['Recent activity', 'The last payments and charges in order, each showing the customer, what it was for and how they paid.'],
    ],
    dialogs: [
      ['wallet', 'Recording money: payment (settles what they owe) or top-up (credit for later), the amount, how they paid — cash, card, bank transfer, voucher — and a note. There is a button that fills in exactly what they owe.'],
      ['cashup', 'The day\'s count: what came in by method, what you counted in cash, the difference either way, and room for a note. It can count an earlier day, and says clearly when it is doing so.'],
      ['bank-recon', 'Owner only. Bank lines beside the shop\'s own record, with a suggested match and how confident it is, filtered by account or by what is still open. A match is only made when you confirm it.'],
    ],
    rules: [
      'Money in is money RECEIVED. Work charged to an account is money owed, and it moves the Outstanding figure, not the takings.',
      'A payment settles what someone owes; a top-up is money held for them in advance. Choosing the wrong one leaves the balance wrong in both directions.',
      'The card number is never typed into this app. Card payments go through Stripe on its own screen, and the shop never sees or holds the number.',
      'A cash-up that is over or short records the difference rather than hiding it. The count is the record — a tidy number that was never counted is worth nothing.',
      'Bank reconciliation is owner-only, and a suggested match is a suggestion: nothing is matched until someone confirms it.',
    ],
    wrong: [
      ['The wallet will not open', 'The screen says what went wrong. A helper without wallet access sees balances on the customer card instead; that is a permission, set in Settings, not a fault.'],
      ['Somebody is in arrears who has definitely paid', 'The payment was either never recorded or went on another record. Check their history first — the customer card lists every entry against them, with the method and the note.'],
      ['A payment is on the wrong customer', 'Do not quietly delete it. The ledger is where the shop\'s accounts come from, so tell the owner what happened and let the correction be made deliberately, with a note that explains it.'],
      ['The drawer does not match the cash-up', 'Record what you actually counted and write what you think happened in the note — a float top-up, a customer given change from the wrong pocket. The difference is the useful part.'],
    ],
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
