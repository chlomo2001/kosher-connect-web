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
    id: 'sim', kind: 'staff', name: 'SIM Plans', status: 'written',
    what: 'The UK SIM-only plans the shop manages for customers: whose number is on which network, what it renews at, and what has been charged for it.',
    parts: [
      ['The four counts', 'How many plans there are, how many are running, how many renew shortly, and what they have brought in.'],
      ['+ New SIM plan', 'Puts a plan on the books: the customer, the network, the number, the SIM\'s own long number, the login email at the provider, what the plan is, and when it renews next.'],
      ['Filter and sort', 'Renewal soonest is the working order — it is the list of what is about to cost money. There is also a filter for plans with no carrier account on file, which are the ones nobody can log in and manage.'],
      ['The list', 'Customer, network, number, plan, mailbox, renewal date, how it is paid and whether it is running.'],
      ['⚙ Manage', 'Everything about one plan: the details, its service history, the letters and emails that have come in from the carrier about it, and adding a charge for it.'],
      ['Mailbox', 'The address the carrier writes to for this plan, which is what lets post about it find its way to the right customer.'],
    ],
    dialogs: [
      ['sim-add', 'A new plan or the same details afterwards: customer, network, number, the SIM\'s long number, the login email, the plan itself and the next renewal date.'],
      ['sim-manage', 'One plan in full — its details, everything that has been done to it, the carrier post filed against it, and the box for adding a charge.'],
    ],
    rules: [
      'The renewal date is the promise this screen exists to keep. A plan running past its date is money going out that nobody agreed to, which is why the dashboard counts those separately from the ones merely coming up.',
      'A plan with no carrier account on file cannot be managed with the network when something goes wrong. The filter for those is a backlog to work through, not a decoration.',
      'What the customer pays and what the network charges are different numbers. Charges are added against the plan so the difference is visible instead of assumed.',
      'The SIM\'s long number identifies the SIM itself rather than the phone number printed on it — it is what the network asks for, and it stays right when a number moves.',
    ],
    wrong: [
      ['A plan renewed and nobody was charged', 'The renewal date passed without a charge being added. Open ⚙ Manage, add the charge, and move the renewal date on — the dashboard is counting it as overdue until you do.'],
      ['Post has come from the network and it is not clear whose it is', 'Carrier Mail matches letters to a plan and its customer. A plan with the mailbox missing is the usual reason it could not.'],
      ['A customer says they cancelled', 'Set the plan\'s status rather than deleting it. The history of what was charged has to survive the plan ending.'],
    ],
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
    id: 'bookings', kind: 'staff', name: 'Tickets & Flights', status: 'written',
    what: 'Flights booked for customers: the ticket and what it cost, who is travelling, whether their documents last the whole trip, and who is doing the check-in.',
    parts: [
      ['+ New booking', 'The ticket: customer, passengers, route, airline, the airline\'s reference when it comes, the travel date, the return date if it is a round trip, the price and the shop\'s fee, and whether they paid or it goes on account.'],
      ['Travel documents panel', 'The check that runs on every booking as you fill it in. It blocks a booking where the passport dies before they are home, asks you to verify what it cannot see, and passes what is genuinely fine.'],
      ['Filter and sort', 'Upcoming travel is the working list — and a customer already abroad stays on it until they land back, because they are still away.'],
      ['The list', 'Customer, route, airline and reference, the travel date with a mark for a return leg, price, fee, status, and where the check-in has got to.'],
      ['🛫 Online check-in', 'Records who is doing the check-in and when it has been done, so a flight nobody has checked in for is visible before it is too late to matter.'],
      ['👥 Passengers', 'Who is actually flying, with the details the airline needs. Passport details are the customer\'s private data — the app holds what it must and shows it nowhere it is not needed.'],
      ['⏰ Remind me', 'A reminder for you about this booking, on your own task list.'],
    ],
    dialogs: [
      ['booking-new', 'The booking form, with the travel-document check running live beneath it as the dates and the customer are filled in.'],
    ],
    rules: [
      'Every document check is measured against the LAST day of the trip, not the day they fly. A passport that expires while they are away strands them abroad, which is worse than being turned away at Manchester.',
      'A blocked booking is a stop, not a suggestion. It means the trip cannot legally be taken as booked — fix the document or the dates, do not book around it.',
      'A round trip needs its return date. Without one the app can only judge the outbound, and it will say so rather than pretend.',
      'The ticket price and the shop\'s fee are separate numbers on purpose: one is the airline\'s money passing through, the other is what the shop earned.',
      'Nothing is sent to the airline or the customer from here. The booking is made where it is always made; this is the shop\'s record of it.',
    ],
    wrong: [
      ['The booking will not save because of the passport', 'Read the reason on the panel. Either the passport genuinely does not last the trip — a new one is needed before flying — or the app has the wrong expiry and the customer\'s record needs correcting first.'],
      ['A booking says a document needs verifying', 'It is asking a person to look, because it cannot see the document itself. Check it, and record what you saw.'],
      ['The upcoming list is missing someone who is away', 'It should not be. Anyone still travelling belongs on it until the day they land back — if they are missing, the return date is probably missing too.'],
      ['The airline field has passenger names in it', 'That came from an old import. Correct it on the booking; the airline field is what the check-in and the reference are read against.'],
    ],
  },
  {
    id: 'repairs', kind: 'staff', name: 'Repairs', status: 'written',
    what: 'Phones handed in to be fixed: what is wrong with each one, where it has got to, and what to tell the customer when they ring.',
    parts: [
      ['The four counts', 'Tickets open, phones waiting to be collected, what repairs have earned, and how many tickets there have ever been.'],
      ['+ New repair', 'Opens a ticket: the customer, the handset in your hand, and the work from the price list. Notes are for what the customer told you — that matters later.'],
      ['Filter', 'Open and in progress, waiting for collection, collected, or cancelled. Waiting-for-collection is the one to work through: those phones are done and the money is not in.'],
      ['The status box on each row', 'Moves the ticket along without opening anything. The shop can add stages of its own in Settings — a phone parked on "waiting for a part" is still open work and still counts as open.'],
      ['💬 Ready-to-collect message', 'Appears once a repair is marked ready: the message written for you, to open in WhatsApp or copy. It is a draft — you send it.'],
      ['⏰ Remind me', 'Sets yourself a reminder about this ticket. It becomes a task on your own list, not a message to them.'],
      ['The list', 'Customer, device, the work, the total and where it has got to — enough to answer the phone from without opening the ticket.'],
    ],
    dialogs: [],
    rules: [
      'The prices come from the repairs price list in Settings, not from memory at the counter. A job that is not on the list is a conversation with the owner, not a number typed in.',
      'Open means not finished, not cancelled and not yet ready. That is why a stage the shop invented itself still counts as open — the count would otherwise quietly drop the custom stages.',
      'Ready means the phone is done and sitting here. Every ready ticket is a phone taking up space and money not yet taken.',
      'Nothing is sent to the customer by the app. The collect message is written for you to send yourself.',
    ],
    wrong: [
      ['A phone is fixed but the customer has not been told', 'Set the ticket to Ready — the 💬 button appears on the row, with the message written.'],
      ['The repair count on the dashboard looks too high', 'It counts everything not finished, including anything parked on a stage the shop added. Filter to open and in progress here and the same tickets are in front of you.'],
      ['The work you did is not on the price list', 'Ask the owner to add it in Settings rather than inventing a price. The list is also what the customer was quoted from.'],
    ],
  },
  {
    id: 'services', kind: 'staff', name: 'Online & Print', status: 'written',
    what: 'The jobs done for someone at the counter — printing, forms, sorting something out online — charged either by the job or by the time it took.',
    parts: [
      ['+ Charge a service', 'The straightforward way: the customer, the job from the price list, how many, the total, and whether they paid now or it goes on their account.'],
      ['▶ Start timer', 'For help that has no fixed price. Say who you are helping and start it; the time banks while you work.'],
      ['⏸ Pause · ▶ Resume', 'Stops the clock when you break off to serve somebody else, so the customer is charged for the help and not for the queue.'],
      ['⧉ Float on top', 'Keeps the running timer visible while you work on another screen — which is where the actual helping happens.'],
      ['⏹ Stop & charge', 'Ends the session and takes you to the charge with the time already on it.'],
      ['✕ Discard', 'Throws the session away without charging. For the times it turned out to be nothing.'],
      ['Price list', 'What each job costs, with a lower price once someone wants several of the same thing. Both prices are set in Settings.'],
      ['Recent orders', 'What has been charged, to whom, and for what — including the notes, which are usually the only record of what the job actually was.'],
    ],
    dialogs: [],
    rules: [
      'The price list has a first price and a cheaper repeat price, and the app applies the change itself once the quantity passes the point set in Settings. It is not worked out by hand at the counter.',
      'A timed session bills the time that was actually running. Pausing when you break off is what makes that number honest.',
      'Money taken now and money put on account are both recorded, and they are not the same thing: one is in the till, the other is in their balance.',
      'The note is the record. "Printing" tells the next person nothing when the customer rings up querying it a week later.',
    ],
    wrong: [
      ['The timer was left running overnight', 'Discard it and charge what the job was actually worth. A number nobody believes is worse than no number.'],
      ['The timer will not start', 'It asks who you are helping first, on purpose — time with nobody attached to it cannot be charged to anyone.'],
      ['The price came out lower than expected', 'Check the quantity. Past the repeat point the cheaper price applies automatically, which is the intended behaviour and worth explaining to the customer rather than overriding.'],
    ],
  },
  {
    id: 'shop', kind: 'staff', name: 'Shop', status: 'written',
    what: 'Stock and the counter: what is on the shelf, what it cost and sells for, and the full-screen till for selling it.',
    parts: [
      ['🧾 Open Till', 'The counter screen. It takes over the page — scan or tap items into a basket, choose the customer if they are on the books, take the money, and the stock and the day\'s takings both move at once. A sale can be parked to serve the next person and picked up again.'],
      ['💰 Cash up', 'The same end-of-day count as on the Wallet screen, here because this is where the drawer is.'],
      ['➕ Add item', 'Puts something new on the shelf: code, barcode, brand, name, what it cost, what it sells for, how many, and when to warn that it is running out.'],
      ['↩️ Return to supplier', 'Records a bag of faulty stock going back, what it is worth, and where the claim has got to — so it nags until the supplier settles.'],
      ['📦 Goods in', 'Books a delivery in: supplier, date, the lines, the invoice reference and total. This is what makes the shelf count true again.'],
      ['Inventory', 'Every item with its cost, price and margin. Filter to low or out of stock to build the reorder list.'],
      ['On order', 'What has been ordered and not yet arrived, so the same box is not ordered twice.'],
      ['Returns to supplier', 'Claims still open with a supplier, and what each is worth.'],
      ['Goods in', 'Recent deliveries, and what is still owed on them.'],
    ],
    dialogs: [
      ['stock-item', 'Adding or editing one item: category, code, barcode, brand, name, cost, selling price, quantity, and the level to warn at.'],
      ['goods-in', 'A delivery being booked in — supplier, date, one line per item, the invoice reference and total, and a note about anything odd.'],
      ['supplier-return', 'Stock going back: the supplier, what is going, what it is worth, and where the claim stands.'],
      ['supplier-return-manage', 'The same return afterwards — moving it along as the supplier replies, and closing it when they settle.'],
    ],
    rules: [
      'Selling through the till is what moves the shelf count. Handing something over without ringing it in leaves the count wrong, and the count is what the reorder list is built from.',
      'A walk-in sale needs no customer; choosing one puts the sale on their record and lets it go on account. Choose deliberately — it decides whether the money is in or owed.',
      'The warn-when-below level is per item, because one of a rare handset is low and one phone case is not.',
      'Cost and selling price are both kept so the margin is real. Booking goods in at the wrong cost quietly makes every profit figure wrong.',
    ],
    wrong: [
      ['The shelf count does not match the shelf', 'Something went out without being sold, or a delivery was never booked in. Fix it by booking the delivery in or correcting the item — and say what happened in the note.'],
      ['An item does not scan', 'It has no barcode saved against it. Edit the item and put the barcode in once; it will scan from then on.'],
      ['A customer has to wait mid-sale', 'Park the sale. It puts the basket aside, clears the screen for the next person, and can be resumed from the till.'],
      ['Faulty stock is sitting in the back', 'Record it as a return to supplier. Once it is on the list it shows on the dashboard until the supplier settles, which is the only reason those claims ever get chased.'],
    ],
  },
  {
    id: 'koltorah', kind: 'staff', name: 'Kol Torah', status: 'written',
    what: 'The audio side of the business: conversion jobs brought in by customers, CDs left with shuls on consignment, and the money each shul owes back.',
    parts: [
      ['+ New job (top of the screen) · + Add job (on the jobs list)', 'The same drop-off form either way — the button at the top scrolls you to it and puts the cursor in the customer box. Whose it is, and what is wanted: CD to MP3, CD to an SD card, copying, or other audio work.'],
      ['Conversion jobs', 'Each job from drop-off to collection: ✅ Ready when it is done, 📤 Collected when it goes out — which charges a priced job to their account — and ↩ to put it back if it was pressed too soon.'],
      ['Consignment by shul', 'What is out with each shul. 📦 Deliver adds to what they are holding, 💿 Sold moves it to what they owe for, ↩ Return brings unsold stock back, and 🧾 Settle records the money coming in.'],
      ['Titles catalogue', 'The recordings themselves — code, title, speaker and price. A title no longer sold is retired rather than deleted, so old sales still make sense.'],
      ['Takings — recent settlements', 'What each shul sold and what was actually collected, with the method and any note.'],
    ],
    dialogs: [],
    rules: [
      'Consignment is not a sale. Stock sitting in a shul still belongs to the shop — Deliver moves the count, and only Sold and Settle move money.',
      'Settling a shul that is linked to a customer record puts the money through the books like any other payment, so Kol Torah takings are in the same ledger as everything else and not on a separate sheet.',
      'Collecting a priced job charges it to the customer, which is what puts it in their balance rather than in nobody\'s.',
      'Retire a title instead of removing it. Deleting the record of something that was sold is how a settlement stops adding up.',
    ],
    wrong: [
      ['A shul\'s count is wrong', 'Look at what has been recorded against them — a delivery entered twice, or stock sold and never marked. Deliver, Sold and Return are the three that move the count, and each one shows in their history.'],
      ['A job was marked collected too soon', 'Put it back with ↩. The money follows the status, so leaving it wrong leaves a charge on somebody who has not had their disc.'],
      ['A settlement does not match what the shul says they sold', 'Record what was actually collected and put the difference in the note. A settlement is the money that changed hands, not the money that should have.'],
    ],
  },
  {
    id: 'virtual', kind: 'staff', name: 'Virtual Numbers', status: 'written',
    what: 'Numbers rented to customers that ring through to somewhere else: who has which, on which platform, and what it bills.',
    parts: [
      ['+ New number', 'Puts a number on the books against a customer, with the platform it lives on.'],
      ['Filter and sort', 'Active or not, and the ones with billing switched on — those are the ones that take money by themselves and are worth reading down.'],
      ['The list', 'The number, whose it is, the platform, what it bills and when next, whether it is active, and a link straight into the platform where one is saved.'],
      ['💷 Billing', 'What this number charges and how often. Switching billing on is what makes it charge; it does not follow from the number merely existing.'],
      ['⏸ Deactivate · ▶ Activate', 'Stops or restarts a number without losing it or its history.'],
      ['⏰ Remind me', 'A reminder for you about this number — chasing the platform, or a customer who asked for it to end.'],
    ],
    dialogs: [
      ['vn-new', 'A new number: the customer it is for, the number itself, and the platform that carries it.'],
    ],
    rules: [
      'A number that is active is a number the shop is paying for. Deactivating is the step people forget, and it is the one that stops the cost.',
      'Billing on a number is set here and charges from here. If a customer is not being billed for a number they have, that switch is where to look first.',
      'The platform link is a convenience, not the record. What is charged and to whom lives in the shop\'s own books.',
    ],
    wrong: [
      ['A customer is being billed for a number they gave up', 'Deactivate the number and switch its billing off. Both, and in that order — one without the other leaves either the cost or the charge running.'],
      ['A number rings nowhere', 'That is on the platform, not here. Open it with the link on the row and check where the number is pointed.'],
    ],
  },
  {
    id: 'tasks', kind: 'staff', name: 'Tasks', status: 'written',
    what: "The shop's own to-do list, including the jobs the app files by itself when something it noticed needs a person.",
    parts: [
      ['🔥 Now · 📋 Next · 💤 Snoozed · 💡 Suggestions', 'Four lanes. Now is what today needs, Next is everything else, Snoozed is deliberately parked, and Suggestions are jobs the app thinks are worth doing and is waiting for you to agree to.'],
      ['✓ Accept', 'Turns a suggestion into a real task. Until you accept it, it is the app\'s opinion and nothing more.'],
      ['Filter', 'What you wrote yourself, what the app filed, tasks attached to a customer, and anything overdue.'],
      ['Sort: Smart', 'The default. It puts what is due and what is urgent at the top instead of making you read the whole list to find them.'],
      ['The buttons on a task', 'A task about a person carries the action with it: add them as a customer, confirm a booking\'s details, record a payment, or message them. The work happens from the task, not after hunting for the screen.'],
      ['Snooze · ⏰ Wake now', 'Puts a task out of sight until a date, and brings it back early when the reason disappears. Snoozed tasks are off the dashboard on purpose.'],
    ],
    dialogs: [],
    rules: [
      'A snoozed task is parked, not done. It is deliberately invisible on the dashboard, so snoozing something you will not act on is a way of losing it.',
      'The app files tasks for things it noticed and cannot decide alone. Deleting one does not fix what it noticed — it will usually be filed again.',
      'A suggestion is not a task until someone accepts it. Nothing acts on a suggestion by itself.',
    ],
    wrong: [
      ['The same task keeps coming back', 'The condition behind it is still true. Fix the thing it is pointing at — the customer with no number, the booking with no reference — and it stops.'],
      ['A task is about a customer who no longer exists', 'It was filed before the records were merged or tidied. Close it; nothing is lost, because the record it referred to is gone.'],
      ['Nothing is in Now but the shop is clearly busy', 'Check Snoozed. Work parked with a date is out of every other view until it wakes.'],
    ],
  },
  {
    id: 'review', kind: 'staff', name: 'Confirm Data', status: 'written',
    what: 'Records that came in from an import and are not yet trusted: read each one against what you know, and confirm it into the books or fix it first.',
    parts: [
      ['The three counts', 'How many records were imported, how many have been confirmed, and how many are still waiting on a person.'],
      ['A card per record', 'One customer at a time, with everything else that came in for them beside it — so the decision is made on the whole person, not on a single row.'],
      ['✓ Yes — confirm', 'Accepts the record as it stands. Where other imported rows are attached to the same person, it accepts those too, which is what makes the queue finishable.'],
      ['✏️ Fix first', 'Opens the record to correct it before it is trusted. Confirming something you know is wrong is worse than leaving it in the queue.'],
      ['Skip for now', 'Leaves it for someone who knows. Skipping is a legitimate answer — guessing is not.'],
      ['Load next batch', 'Brings the next set through. The queue is worked in batches so it can be put down and picked up.'],
    ],
    dialogs: [],
    rules: [
      'Confirming means "I know this is right", not "I have read it". An import can carry a name in the wrong field or two people merged into one, and confirmation is the moment that becomes the shop\'s truth.',
      'The counts come from what the server actually saved, not from what the screen assumed it saved. What it says is what happened.',
      'This tab is only useful while it is being worked. A long queue is a book nobody quite trusts.',
    ],
    wrong: [
      ['You do not recognise the person', 'Skip it. Someone who knows them will confirm it; a wrong confirmation is invisible afterwards, which is precisely what makes it expensive.'],
      ['The details are nearly right', 'Fix first, then confirm. The point of the queue is to catch exactly that.'],
      ['The tab is not in the sidebar', 'It is a tab like any other and can be turned off for helpers in Settings. It once shipped hidden from everybody, which is why the tab lists are now held together by a test.'],
    ],
  },
  {
    id: 'mail', kind: 'staff', name: 'Carrier Mail', status: 'written',
    what: 'Post arriving from the networks — bills, warnings, confirmations — matched to the SIM plan and the customer it belongs to.',
    parts: [
      ['Needs a human', 'The queue: messages the app could not confidently file. This is the whole job of the screen.'],
      ['Filed on a SIM', 'What has been matched, so the letter about a plan is on the plan when someone asks about it.'],
      ['Messages received', 'Everything that has ever arrived, matched or not.'],
      ['Which SIM is this?', 'The pairing question on an unmatched message, with the number it mentions. Answer it and the message files itself and stays filed.'],
      ['Add as a new SIM plan', 'For post about a plan the shop has never recorded. It opens the usual new-plan form with the number and network already filled, and files the message on the plan once it is saved.'],
      ['Dismiss', 'For post that belongs to nobody — a circular, a wrong number. It leaves the queue without pretending to be filed.'],
    ],
    dialogs: [],
    rules: [
      'Matching is what makes the post useful. An unfiled warning about a plan is a letter in a drawer.',
      'Post arriving about a plan the shop does not have on record usually means the plan is real and the record is missing — that is worth following up, not dismissing.',
      'Dismiss means "this belongs to nobody", not "not now". Anything that might matter should stay in the queue.',
    ],
    wrong: [
      ['A message names a number nobody recognises', 'Search the number in the SIM list first. If there is genuinely no plan, adding it from here creates the plan and files the message in one go.'],
      ['The queue is growing', 'It grows when plans have no mailbox recorded, so nothing can be matched automatically. Fixing the plan fixes every future letter about it.'],
    ],
  },
  {
    id: 'settings', kind: 'staff', name: 'Settings', status: 'written',
    what: 'Everything the shop can change without anyone writing code: prices, people, what helpers can see, the public pages, and the safety gates on messaging.',
    parts: [
      ['Shop', 'The public-facing details — the shop\'s own information, the wording on receipts, and the phone guide customers read before choosing a handset. There is a link to view the public page as they see it.'],
      ['People & access', '👥 Team is who works here, with a password reset. 🔓 What helpers can see ticks the screens a helper may open — the owner always sees everything.'],
      ['Prices & charges', 'Rental rates per country with their minimum, cap and cap period; what a lost or broken phone, charger or SIM costs; the fees and rules; the service price menu behind Online & Print; extra charges; repair stages; void reasons; and the month\'s target that the dashboard measures against.'],
      ['Communications', 'Email and SMS, each with its safety gate, the addresses post arrives at, a test send, and the log of everything that has gone out.'],
      ['Travel', '🛂 Travel requirements: what each destination demands and how long a document must stay valid. This is what the booking screen checks against.'],
      ['Connectivity', 'The providers behind virtual numbers and the phone lines.'],
      ['Workbench', 'The tools for moving a customer from one handset to another, and the converters behind them.'],
      ['Automation', 'The jobs the nightly sweep runs for you, and what each one is allowed to do.'],
      ['Business', 'The accounts and subscriptions the shop pays for, the telecom upstream, and what the AI features have cost this month.'],
    ],
    dialogs: [],
    rules: [
      'This screen is where the numbers live. Every rate, cap, fee and damage charge the rest of the app applies is read from here — which is why nothing else in this manual quotes one.',
      'Messaging has three modes and they mean exactly what they say: hold builds the message and sends nothing, test sends everything to the shop\'s own address or number whatever you type, and live reaches real customers. It stays on hold until the owner deliberately changes it.',
      'What helpers can see is an access list, and it fails closed: if it is empty or broken, helpers are stopped from making changes rather than quietly promoted to full access.',
      'Secrets — keys, tokens, passwords for other services — are never kept in this app or in the code. They live with the host, and nobody should ever be asked to paste one into a message.',
      'A price changed here changes what the shop charges from that moment. It does not rewrite what was already agreed on an existing rental or ticket.',
    ],
    wrong: [
      ['A helper cannot see a screen they need', 'Tick it under What helpers can see and save. If the tick box is not there at all, the screen is genuinely not grantable and that is a fault worth reporting.'],
      ['Messages are not reaching customers', 'Check which mode messaging is in before assuming anything is broken. On hold, everything is built and logged and nothing is sent — that is it working as intended.'],
      ['A price change did not apply to an existing rental', 'It is not meant to. What was agreed at the counter stays agreed; the new price applies to what is booked next.'],
      ['Something is asking for a key or a password', 'Do not paste it into a message or into the app. Keys belong with the host, entered once by the owner.'],
    ],
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
