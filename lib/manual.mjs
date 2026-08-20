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
 *            'frame'  — the chrome around every screen: the menu, the topbar,
 *                       the buttons that are there whatever tab you are on.
 *                       It belongs to no tab, so instead of a tab id it carries
 *                       `anchors` — the ids and attributes of the controls it
 *                       describes, which the test looks up in the source. Rename
 *                       a control and this entry fails with it.
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
 *   example  optional { title, steps[] } — one real situation worked start to
 *            finish. The lists above say what each part IS; an example is the
 *            only thing that shows the ORDER, and order is what someone new
 *            actually gets wrong. Kept scarce on purpose: an example on every
 *            screen would be another wall.
 *   anchors  frame only: source tokens (element ids, data attributes) for the
 *            controls described, so the entry cannot outlive them
 *   status   'written' — finished, and held to the quality checks
 *            'draft'   — the sentence is honest but the detail is not here yet.
 *                        The count is ratcheted in the test: it may go down,
 *                        never up, so a new screen has to be written now.
 */
export const SCREENS = [
  // ── The frame around every screen ──────────────────────────────────────
  {
    id: 'app-frame', kind: 'frame', name: 'The menu and the top bar', status: 'written',
    anchors: ['appSidebar', 'navBurger', 'navGrip', 'pageTitle', 'kcNextAction', 'searchBox',
      'btnNewCustomer', 'btnPalette', 'btnHowTo', 'openAssistantModal',
      'data-theme-btn', 'data-textsize-btn'],
    what: 'The menu, the top bar and the buttons that are there whatever tab you are on — the parts of the app that are not any one screen.',
    parts: [
      ['The menu down the left', 'Every destination, grouped: the people, the counter, the services the shop sells, and the things you manage. Where you are is the one that is lit.'],
      ['The ☰ button', 'On a computer it shrinks the menu to icons and back — the labels come back as tooltips while it is shrunk. On a phone the menu is not there at all until this slides it over the screen.'],
      ['The edge of the menu', 'Drag it to set how wide the menu is; double-click it to put it back. The width is remembered on this device, like the text size.'],
      ['The screen title', 'Says which screen you are on. It is also what the app changes when a button takes you somewhere, so it is worth a glance when something opens unexpectedly.'],
      ['Hebrew dates', 'On the counter screens — SIM renewals, a rental\'s due-back day, a flight\'s travel date and the day a repair came in — the Hebrew date sits under the English one in gold. Only those four: they are the dates said out loud to somebody standing at the counter. Money screens, admin lists and anything texted or emailed to a customer stay in English alone, so nothing sent out and nothing being reconciled grows a second date. It follows the ordinary day, the same as the one on the Dashboard, so it does not turn over at nightfall.'],
      ['The line under the title', 'What this screen needs from you next, said as a thing to do — and one button that goes straight to it, already narrowed to the ones it counted. When there is nothing outstanding it says so and there is no button: an empty queue is an answer, not a blank space. It reads the same numbers the screen\'s own headline figures come from, so the two can never disagree.'],
      ['A text waiting for an answer', 'On the Dashboard this comes before everything else, ahead of the money. The rest of the list is the shop\'s own business going slowly; this one is a person holding their phone, and it is the shortest-lived — a rental overdue today is still overdue tomorrow, a text nobody answered by closing time is a customer who thinks they were ignored. It counts a message as answered only once a reply has actually gone to them, so a reply written while texting is on hold leaves it counted. Staff who cannot open Settings never see this line, because they cannot open the messages either.'],
      ['The search box', 'Searches whatever the screen in front of you lists. It is not the whole-app search — that is the next button along.'],
      ['🔍 Search', 'The one that looks everywhere: customers, rentals, phones, stock, and every screen and tool by name. Ctrl and K opens it from anywhere without touching the mouse.'],
      ['❓ Help', 'One door for every kind of help. It opens on the jobs that belong to the screen you are standing on, under "On this screen", with the rest of the library below — written by hand, the same answer every time. Inside it: 🤖 Ask about the shop\'s numbers, and 📖 The full manual.'],
      ['🤖 Ask about the shop\'s numbers', 'Inside the Help panel, and on Ctrl and K. Questions about the shop\'s own data in plain words — who owes money, what is overdue. It proposes; nothing happens until you tap to confirm it. It is not the place to ask how to do a job: the steps above are written by a person and are right every time.'],
      ['The blue button on the right', 'Whatever creating something means on this screen — a new customer on Customers, a new rental on Phone Rentals. It changes with the tab so the main action is always in the same place.'],
      ['🌙 · Aa', 'Light or dark, and the size of every word in the app. Press Aa to step through Standard, Large and Largest — the button shows which is set with three pips filled to the level and an Aa that grows with it. Both are per device and remembered, so the screen on the counter can be set for whoever stands at it.'],
      ['📖 The manual, under Help in the menu', 'This book, in its own tab: every screen described in order, and the copy to print for somebody starting on Sunday.'],
      ['Your name at the bottom of the menu', 'Who is signed in on this machine, and how to sign out. Worth checking before recording money.'],
    ],
    dialogs: [],
    rules: [
      'Two doors, and it is worth knowing which is which: 🔍 finds THINGS — a customer, a rental, a screen — and ❓ answers QUESTIONS, whether that is how to do a job or what the shop\'s numbers say. The steps in the Help panel are written by a person; the assistant inside it is not, which is why the steps come first. Asking the robot how to take a payment gets a confident answer from something that has never stood at the counter.',
      'The menu is what a helper is allowed to see. A screen missing from someone\'s menu is an access setting, not a fault.',
      'Display choices — the width, the text size, light or dark — are per device, not per person. Setting them on the counter machine does not change the one in the back.',
      'Ctrl and K reaches everything the app can do, including screens and tools that are several clicks deep. It is the fastest way in once the shape of the app is familiar.',
    ],
    wrong: [
      ['A screen you were told about is not in the menu', 'It has not been granted to you. The owner ticks it under what helpers can see, in Settings.'],
      ['The menu is a column of icons with no words', 'It is shrunk. Press ☰ to bring the words back, or hover an icon to read its label.'],
      ['The menu is too narrow and labels look cut off', 'Drag its right-hand edge wider, or double-click that edge to put it back to normal.'],
      ['The search box finds nothing you expected', 'That box only searches the screen you are on. Use 🔍 Search — or Ctrl and K — to look across the whole app.'],
      ['Somebody else\'s name is at the bottom of the menu', 'They are still signed in on this machine. Sign out and back in as yourself before recording anything — the history of who did what depends on it.'],
    ],
  },

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
      ['Needs attention', 'The one list to read first thing. Overdue rentals, repairs waiting to be collected, flights coming up, SIM plans renewing or already past their date, stock running low, returns still open with a supplier, customers with no number anywhere on their record, and high-priority tasks. Every line goes straight to the thing it is about — and to the list already narrowed to what that line counted, not to the whole tab with the filtering left for you to do again.'],
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
      ['The balance column', 'Said the same way as everywhere else in the app: owes the amount, holds that much in credit, settled, or not checked yet. The last is not a fault — it means the wallet figures have not arrived on this screen, either because they are still loading or because this member of staff cannot see the wallet. No balance is shown rather than a guess at one.'],
      ['Filter', 'Narrows the list to one kind of customer: an active rental, a flight coming up, a SIM plan, a virtual number, an open repair, money owed, a passport on file, or nobody-can-ring-them — no number of theirs and no SIM of ours either.'],
      ['Sort', 'Surname or first name, either direction; most owed first when chasing money; recently added after an import; most services first to find the shop\'s busiest customers.'],
      ['Export CSV', 'The list as it is filtered and sorted, as a file — for a mail merge, or for anything the app does not do itself.'],
      ['👥 Duplicates', 'Owner only. Reviews the whole book for records that look like the same person entered twice — matching on the name, the phone line and the person behind an email address — with the evidence and a strength beside each pair.'],
      ['+ New customer', 'Adds someone. A name and a number is enough to start; everything else can follow.'],
      ['Details', 'Opens their card beside the list — the whole history without leaving the list you were working through.'],
      ['⤢ Open as a full page', 'The customer\'s whole record on their own address, which survives a refresh and can be sent to someone else. It has an Overview and an Activity timeline. This is the fuller of the two views: the card beside the list is deliberately compact so you can keep working through the list, and the page is where everything about the person lives.'],
      ['Who they are', 'At the top of the full page: their numbers, their email addresses and their address, each on its own labelled line rather than run together — the card has one line to spend and packs them into a sentence, the record does not. The number rings and the email opens a message. A carrier login is marked as OURS, so it is never mistaken for somewhere to write to them. What is missing is said out loud — "no number on record" rather than a gap, because 143 customers are in exactly that state and a blank reads as a fault rather than as the thing to fix.'],
      ['The three figures on the page', 'Different from the card\'s, on purpose. The card counts what it has no room to list; the page lists it a few inches below, so counting it again says nothing. The page shows what they owe, what they have been worth altogether, and when the shop last did anything for them — the last of which is how you tell a customer who is still with you from one who has drifted.'],
      ['What they have with us', 'On the full page: every service this person has, one row each, and each row opens the thing itself — the SIM plan, the rental, the virtual number, the flight. Anything with a phone number is named by that number, because that is what anyone asking about it says first; the network or the country reads underneath. A flight has no number and is named by its route — nothing is given a number it does not have. A row also shows the date that matters for it — a rental\'s due-back day, a SIM\'s renewal, a flight\'s travel date — in the order they next need somebody, soonest first. A line above says what the person is to the shop in one sentence. Things that have finished — a returned rental, a cancelled plan, a flight already flown — are counted and folded underneath rather than dropped, because what somebody has HAD from the shop is half the record. Repairs and print jobs have no record of their own to open, so those rows go to their screen instead, and the row says so.'],
      ['Two cards at once', 'Grip a card aside by its edge, then open another customer: the second opens BESIDE the first instead of replacing it, so two records can be read against each other. Both are fully editable, and each card\'s buttons only ever act on its own customer — a save on one cannot land on the other. The card with the keyboard in it is the brighter of the two. Escape closes the one on top first.'],
      ['✎ on a timeline entry', 'Corrects a call or note that was logged wrongly. It never erases: the original stays on the row struck through, with who corrected it and when, so the timeline can still be read as evidence of what actually happened rather than as notes somebody has since tidied. Only logged calls and notes carry it — a rental or a payment is a record of a thing that happened, and is corrected by correcting the thing.'],
      ['💬 Contact', 'Draft a reminder (written for you, and nothing is sent from here), draft a reply to a message they sent, or log a call or note so the next person knows what was said.'],
      ['💷 Money', 'Charge the card they have saved, save one for next time, or make a payment link to send them. The card number is entered on Stripe\'s own screen — the shop never sees it and never holds it.'],
      ['Wallet', 'The one place money is offered on the record. It says the balance in the same words as the rest of the app, lists what made it up, and carries a single button — which asks for the payment when they owe and offers to record one when they do not. The balance used to be stated three times on one screen with two buttons doing the same job; two controls of the same shape for one task is how the wrong one gets pressed.'],
      ['⚙️ Manage', 'Set yourself a reminder about them, edit their details, and — for the owner — look up what their line is doing with the carrier.'],
      ['Documents', 'Files shared with the customer, which they see in their own portal, and anything they have sent back. What they upload waits for you to approve or reject it, so nothing lands on the record unread. From four documents up they group into folders by what they are — passports and ID, tickets, receipts, forms, photos — so finding one is a glance rather than a read. The folders are worked out from the filename and are on this screen only; the customer\'s own portal is unchanged.'],
    ],
    dialogs: [
      ['customer-new', 'Adding someone: name, number, address, and how they should be billed.'],
      ['customer-edit', 'The same details afterwards. The carrier-login field appears here and not on the add form.'],
      ['customer-card', 'The card beside the list: balance, everything they have on the go, their history, and the three tool menus.'],
      ['customer-page', 'The same thing as a page of its own, with an address you can refresh or send on.'],
      ['customer-page-log', 'The Activity tab of that page: everything that has ever happened to this customer, newest first. A logged call or note carries a ✎ to correct it — what it used to say stays on the row, struck through, with the name of whoever changed it.'],
      ['remind', 'A reminder for YOU about this customer. It becomes a task on your own list, and nothing reaches them.'],
      ['draft-reminder', 'Writes a chasing message for you to read, correct and send yourself. It is a draft, not a send.'],
      ['log-comm', 'Records a call, a text or a conversation on their history, so the next person picking up the phone knows what was already said.'],
      ['dup-scan', 'The duplicate review: likely pairs strongest first, how strongly each is matched and why, the evidence on each side, and two answers — merge into the record you are keeping, or not the same person.'],
    ],
    rules: [
      'Two records with the same name are as often two brothers as one man typed twice. The duplicate review puts the evidence on the screen — the SIMs, rentals, bookings and money on each side — and says how much it is claiming: a strong match means two signals agree, worth a look means one contact detail, and same name only means just that. A phone or mailbox dozens of records share is the shop\'s own, so it stops counting as a match and the review says so. "Not the same" is remembered, so the pair never asks again.',
      'Nothing on this screen sends anything to a customer. Drafting a reminder writes it; sending it is a separate, deliberate act.',
      'A passport on file is shown as a yes on the list and nowhere as a number. Passport details are the customer\'s private data and the app treats them that way in every list, export and report.',
      'The balance is the one from the ledger, counting charges as well as payments. For a moment after the screen opens you may see the rental-only figure while the real one arrives.',
    ],
    example: {
      title: 'Worked example — somebody rings and you have their number, not their name',
      steps: [
        'Type the last few digits into the search box at the top. It searches numbers as well as names, and it finds an older spelling of the same person when the record carries one.',
        'Open the record. What they have running is at the top — SIMs, rentals, flights, repairs — each one a row you can open, not a badge you cannot.',
        'The balance is said in words as well as figures: owes, holds credit, settled, or not checked yet. The last is a permission or a slow load, not a fault.',
        'Do the job from here — take the payment, start the rental. Anything begun on the record is already attached to them, so nothing is recorded against nobody.',
      ],
    },
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
    example: {
      title: 'Worked example — a phone goes out on Sunday and comes back on Thursday',
      steps: [
        'New rental. Pick the customer, the country and the dates they are away. The price comes from Settings; it is never typed in here.',
        'Tick what actually leaves the shop with them — handset, SIM, charger. What you tick is what the return screen will ask for back, and on a USA phone an unticked SIM changes the rate.',
        'They pay now or it goes on their account. Either way it lands on their wallet, not in a note.',
        'Thursday: find the row, ⚙ Manage, turn on Returned. Do it on the day — late days are counted from the day you mark it, not the day they walked in.',
        'Every item you ticked has to be decided, back or lost. The rental does not close while something is unaccounted for, which is the whole point of ticking them.',
      ],
    },
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
      ['Receives mail at', 'On ⚙ Manage, above the carrier post: every address whose post is filed on this plan. The first is the login email from the plan\'s own details and is changed there. A plan can be written to at more than one address, because it has a separate account at each network, and the rest of the list is those. Removing one stops future post to it being filed here; post already filed stays where it is.'],
      ['+ address', 'Records another address for this plan before any post has gone astray. The other way in is from Carrier Mail, but that only works once a message has already arrived at an unclaimed address and been missed by everybody — when a second network account is opened the address is known that day, so putting it in here means the FIRST message files itself instead of the second. One address belongs to one plan only: if another plan already claims it, this refuses and says whose. It is here rather than on the new-plan form because this list is kept apart from the plan\'s other details, and having it in two places would be two answers to one question.'],
    ],
    dialogs: [
      ['sim-add', 'A new plan or the same details afterwards: customer, network, number, the SIM\'s long number, the login email, the plan itself and the next renewal date. A new plan is only counted once the shop\'s records have taken it: if the save fails, the screen says so and nothing is charged.'],
      ['sim-manage', 'One plan in full — its details, everything that has been done to it, the carrier post filed against it, and the box for adding a charge.'],
    ],
    rules: [
      'The renewal date is the promise this screen exists to keep. A plan running past its date is money going out that nobody agreed to, which is why the dashboard counts those separately from the ones merely coming up.',
      'A plan with no carrier account on file cannot be managed with the network when something goes wrong. The filter for those is a backlog to work through, not a decoration.',
      'What the customer pays and what the network charges are different numbers. Charges are added against the plan so the difference is visible instead of assumed.',
      'The SIM\'s long number identifies the SIM itself rather than the phone number printed on it — it is what the network asks for, and it stays right when a number moves.',
    ],
    wrong: [
      ['You set up a plan and it is not in the list', 'It was not saved. The screen now says so and charges nothing when that happens — but a plan added before 20 August 2026 could show a receipt and save nothing, so a plan from that period may be missing while its setup fee is on the customer\'s wallet. Check the wallet before adding it again, or the fee lands twice.'],
      ['A plan renewed and nobody was charged', 'The renewal date passed without a charge being added. Open ⚙ Manage, add the charge, and move the renewal date on — the dashboard is counting it as overdue until you do.'],
      ['Post has come from the network and it is not clear whose it is', 'Carrier Mail matches letters to a plan and its customer. A plan with the mailbox missing is the usual reason it could not. The other reason is that the network wrote to a second address this plan has not claimed — Carrier Mail can be told, once, that this plan receives there too.'],
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
      ['bank-pick', 'Choosing the sender yourself when the suggestions are wrong or there are none. Type a name to search the book. If nobody matches, it offers to add that person as a new customer and post the payment to them in one step — it asks once, shows the amount and what the bank called them, and keeps their email when the row carries one.'],
    ],
    rules: [
      'Money in is money RECEIVED. Work charged to an account is money owed, and it moves the Outstanding figure, not the takings.',
      'A payment settles what someone owes; a top-up is money held for them in advance. Choosing the wrong one leaves the balance wrong in both directions.',
      'The card number is never typed into this app. Card payments go through Stripe on its own screen, and the shop never sees or holds the number.',
      'A cash-up that is over or short records the difference rather than hiding it. The count is the record — a tidy number that was never counted is worth nothing.',
      'Bank reconciliation is owner-only, and a suggested match is a suggestion: nothing is matched until someone confirms it.',
      'A sender who is not in the book can be added from the bank row itself. The customer is created first and the payment posted after — if creating them fails, no money moves.',
    ],
    example: {
      title: 'Worked example — £280 lands in the bank from someone you cannot place',
      steps: [
        'Open Wallet, then 🏦 Bank & card reconciliation. The row reads “horowits · hershlhorowits@gmail.com · +£280.00”.',
        'Read the suggestions under it. Each states its own case — “amount 280.00 matches exactly”, “counterparty resembles…” — and carries its own confidence. Two that score alike get a warning to compare the reasons before you press anything.',
        'None is right, so press “Choose customer…” and type the name you believe it is.',
        'Nobody matches. The box offers to add that person as a new customer and match the payment together, showing the amount and what the bank called them before it does anything.',
        'Press it. The customer is created first and the payment posts after — so if creating them fails, no money has moved.',
        'The row turns to “✓ On the ledger”. If you got it wrong, Undo posts an equal-and-opposite correction and reopens the row. It never deletes: the ledger is where the accounts come from.',
      ],
    },
    wrong: [
      ['The wallet will not open', 'The screen says what went wrong. A helper without wallet access sees balances on the customer card instead; that is a permission, set in Settings, not a fault.'],
      ['Somebody is in arrears who has definitely paid', 'The payment was either never recorded or went on another record. Check their history first — the customer card lists every entry against them, with the method and the note.'],
      ['A payment is on the wrong customer', 'Do not quietly delete it. The ledger is where the shop\'s accounts come from, so tell the owner what happened and let the correction be made deliberately, with a note that explains it.'],
      ['Money arrived from somebody who is not a customer yet', 'Press "Choose customer…" and type their name. When nothing matches, the same box offers to add them and match the payment together, so the row does not sit open while you go to the Customers screen and back.'],
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
      ['✉️ Tickets from email', "Airline confirmations that have arrived, read and waiting to be confirmed into bookings. Each row says what the message IS — a booking confirmation, an unpaid reservation, a cancellation, or something that is not a booking at all — and only the real bookings offer to become one. ↻ Check now re-reads them on the spot, for the customer standing at the counter who has just forwarded theirs. The timestamp is when the email arrived, in the shop's own time."],
      ['Not paid yet', "An airline holding seats it has not been paid for. It is a real reservation, so it can still be booked in, but the note says to deal with the payment first — the airline cancels it if nobody does."],
      ['Not about a booking', "A privacy notice, an advert, a baggage message — airline post that is not a booking to make. It offers only to be read and dismissed, never to be confirmed into a flight. Most of these never reach the queue; the ones that do are cleared with Dismiss."],
      ['Tick the ones that are nothing', 'Every email in the queue has a tick box, with select-all above them. Ticking several offers to dismiss them together — for the morning when an airline sends thirty circulars and twenty-eight are nothing to do with a journey. Only dismissing works in bulk: confirming a booking charges somebody, so it stays one at a time.'],
      ['Already booked', "When the reference on an email is already live on a booking, the card says so and does not offer to book it again. The two answers it offers instead are that this email IS that booking, or that it is another flight on it."],
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
      'A message the app cannot read for what it is does not pretend to be a booking. It reads as "not about a booking" and offers only to be read and cleared — a guess dressed as a confirmation is how a privacy notice once sat here asking to be booked as a flight.',
    ],
    wrong: [
      ['The booking will not save because of the passport', 'Read the reason on the panel. Either the passport genuinely does not last the trip — a new one is needed before flying — or the app has the wrong expiry and the customer\'s record needs correcting first.'],
      ['A booking says a document needs verifying', 'It is asking a person to look, because it cannot see the document itself. Check it, and record what you saw.'],
      ['The same confirmation has arrived twice', "The second card will say the reference is already booked and will not offer to book it again. File it on the booking it belongs to, or add it as another flight — never make a second booking, or the journey is charged twice."],
      ['The upcoming list is missing someone who is away', 'It should not be. Anyone still travelling belongs on it until the day they land back — if they are missing, the return date is probably missing too.'],
      ['The airline field has passenger names in it', 'That came from an old import. Correct it on the booking; the airline field is what the check-in and the reference are read against.'],
      ['An airline advert or notice is in the queue', 'It is marked "not about a booking" and offers no way to confirm it — Dismiss clears it. If adverts keep arriving, the tickets mailbox is being fed marketing as well as confirmations, which is worth narrowing at the forwarding rule.'],
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
      ['💷 Charge · ⏸ Park sale', 'Both are greyed until something is in the basket, so neither invites a press that can only fail. They wake as soon as the first item is scanned. Ctrl and Enter from the scan box charges without reaching for the mouse — and it still refuses an empty basket, because the keyboard never touches the button.'],
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
      ['stock-item', 'Adding or editing one item: its category (phone, SIM, charger, cable, earphones, case, power bank, memory card, car accessory, repair part, accessory or other), code, barcode, brand, name, cost, selling price, quantity, and the level to warn at.'],
      ['goods-in', 'A delivery being booked in — supplier, date, one line per item, the invoice reference and total, and a note about anything odd.'],
      ['supplier-return', 'Stock going back: the supplier, what is going, what it is worth, and where the claim stands.'],
      ['supplier-return-manage', 'The same return afterwards — moving it along as the supplier replies, and closing it when they settle.'],
    ],
    rules: [
      'Selling through the till is what moves the shelf count. Handing something over without ringing it in leaves the count wrong, and the count is what the reorder list is built from.',
      'A walk-in sale needs no customer; choosing one puts the sale on their record and lets it go on account. Choose deliberately — it decides whether the money is in or owed.',
      'The warn-when-below level is per item, because one of a rare handset is low and one phone case is not.',
      'Cost and selling price are both kept so the margin is real. Booking goods in at the wrong cost quietly makes every profit figure wrong.',
      'A phone counts as a phone, not just as stock: selling one asks for its IMEI at the till and records it as a phone sale. The other categories are labels for finding things and reading the shelf.',
      'Twelve categories are built in and you can add your own in Settings. The built-in ones cannot be removed, a name that repeats one is ignored, and removing one of your own leaves any item already filed under it exactly where it is.',
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
      ['Conversion jobs', 'Each job from drop-off to collection: ✅ Ready when it is done, 📤 Collected when it goes out — which charges a priced job to the account of a job filed against a real customer — and ↩ to put a Ready or Cancelled job back. Collected is final: the money has moved.'],
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
      ['A job was marked collected too soon', 'Collected is final — the money has moved, so the app will not quietly un-collect it. ↩ puts back a Ready or Cancelled job, not a collected one. Tell the owner, who corrects the charge on the account deliberately.'],
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
      ['A card per record', 'The whole batch on one screen, a card each, with everything else that came in for that person beside it — so the decision is made on the whole person, not on a single row, and a batch can be worked without a repaint between every answer.'],
      ['✓ Yes — confirm', 'Accepts the record as it stands. Where other imported rows are attached to the same person, it accepts those too, which is what makes the queue finishable.'],
      ['✏️ Fix first', 'Opens the record to correct it before it is trusted. Confirming something you know is wrong is worse than leaving it in the queue.'],
      ['Skip for now', 'Leaves it for someone who knows. Skipping is a legitimate answer — guessing is not.'],
      ['✓ Confirm all shown', 'Answers for every card on the screen at once, after saying so. It stops at the first record that will not save rather than reporting a finish it did not reach. It never reaches records you have not seen.'],
      ['Load next batch', 'Brings the next set through. The queue is worked in batches so it can be put down and picked up.'],
    ],
    dialogs: [],
    rules: [
      'Confirming means "I know this is right", not "I have read it". An import can carry a name in the wrong field or two people merged into one, and confirmation is the moment that becomes the shop\'s truth.',
      'That rule is why "Confirm all shown" is limited to what is on the screen. A button that could answer for four hundred unseen records would empty the word out, and the column would stop meaning anything.',
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
    what: 'Post arriving from the networks — renewals, ports, warnings, payment problems — matched to the SIM plan it belongs to, and labelled with what it means.',
    parts: [
      ['Needs a human', 'The queue: messages the app could not confidently file. This is the whole job of the screen.'],
      ['↩ Undo match', 'Puts a message that is filed on a SIM back into the queue for somebody to file by hand. Most matches are made automatically and nobody sees them being made, so this is how a wrong one gets corrected. The nightly sweep will not re-match it afterwards — you have said the automatic answer was wrong, and it should not argue with you.'],
      ['📤 Forward to customers', 'Owner only. Carrier mail worth sending on to the person whose line it is — a renewal receipt, a payment that failed, a completed port, something about to expire. It opens a queue showing what would go, to whom, and why, and it shows what will NOT go and what is stopping it, so the rule can be understood rather than guessed at. Nothing here decides whose a message is: it only ever goes to the customer the message is already filed against, and a message covering more than one number goes to nobody at all. The safety gate still decides what happens to an approved message.'],
      ['What the message means', 'Every row says what it IS before it says whose it is — renewing soon, renewed, about to expire, port completed, PAC code, payment problem. The ports and the payment problems are the ones that carry colour, because they are the ones that mean work; the renewals are the wallpaper.'],
      ['Port completed', "A finished port is not post, it is the end of a job: the customer's number has moved onto our SIM, so the plan usually still shows the number it was set up with. Where the carrier names the new number, one press puts it on the plan. Where it does not — Lebara's confirmation names no number, it tells the customer to dial a code — the row says so and opens the plan to be corrected."],
      ['↻ Check now', 'Re-reads the mailbox without leaving the screen — for when somebody is standing there waiting for a message they know has been sent.'],
      ['Tick the ones that are nothing', 'Each message has a tick box and there is a select-all above the list, so a run of identical circulars can be cleared in one press. Pairing a message to a SIM stays one at a time — that answer is different on every row.'],
      ['Filed on a SIM', 'What has been matched, so the letter about a plan is on the plan when someone asks about it.'],
      ['Messages received', 'Everything that has ever arrived, matched or not — including the adverts, which are filed already marked as dealt with so they never reach the queue. They are kept rather than thrown away: an advert nobody reads costs nothing, and a real message wrongly taken for one would otherwise be gone without trace.'],
      ['Which SIM is this?', 'The pairing question on an unmatched message. A shared address can carry hundreds of SIMs, so it offers the likeliest few first — the number named in the message, plans that are live, and plans renewing around the date the message arrived — and says how many there are altogether. Answer it and the message files itself and stays filed.'],
      ['Type a name or number', 'Appears when there are more SIMs on the address than fit. Type any part of a name or a number and the list narrows to it; “+ N more” shows the rest.'],
      ['Add as a new SIM plan', 'For post about a plan the shop has never recorded. It opens the usual new-plan form with the number and network already filled, and files the message on the plan once it is saved.'],
      ['🔗 A line I already have gets mail here', 'The other half of an unmatched message: the plan IS on the books, but the network writes to a mailbox the plan does not claim. The shop gives a plan its own tagged address per network account, so the same phone can be written to at two different addresses and only one of them is recorded. Search for the plan, confirm it, and the message files itself — and so does every later message to that address, which is the point. Nothing is listed until you type: there are hundreds of plans, and a list you scroll invites picking whichever is on top. The search starts filled in with the tag from the address itself — the part after the +, which is usually the customer\'s name — but that is a starting point and nothing more: some tags name nobody and some name eight different people, so the app never files on a tag. Type over it. One address belongs to one plan only; if another plan already claims it, this refuses and says which.'],
      ['Dismiss', 'For post that belongs to nobody — a circular, a wrong number. It leaves the queue without pretending to be filed.'],
    ],
    dialogs: [
      ['forward-queue', 'The approval queue for forwarding carrier mail to customers: every filed message, whether it can go, to whom, and why — including the ones that cannot and what is stopping them.'],
    ],
    rules: [
      'Matching is what makes the post useful. An unfiled warning about a plan is a letter in a drawer.',
      'Post arriving about a plan the shop does not have on record usually means the plan is real and the record is missing — that is worth following up, not dismissing.',
      'A completed port, a PAC code and a payment problem each raise a task by themselves, because each one means somebody has something to do. A PAC code is the one piece of carrier post that is bad news: the customer is moving to another network.',
      'The number on a plan is what every reminder, every carrier lookup and every piece of post keys on. Changing it after a port is the difference between the next reminder reaching the customer and reaching a dead line.',
      'Dismiss means "this belongs to nobody", not "not now". Anything that might matter should stay in the queue.',
      'One mailbox belongs to one plan. Teaching the app that an address belongs to a plan is how post files itself in future, so an address given to the wrong plan quietly sends a stranger\'s post there — it is taken off again from the plan\'s own card.',
    ],
    wrong: [
      ['A message names a number nobody recognises', 'Search the number in the SIM list first. If there is genuinely no plan, adding it from here creates the plan and files the message in one go.'],
      ['The queue is growing', 'It grows when plans have no mailbox recorded, so nothing can be matched automatically. Fixing the plan fixes every future letter about it.'],
      ['The same address keeps coming back unmatched', 'The plan is on the books under a different address. Use “a line I already have gets mail here” once and the address is recorded against the plan — the queue stops asking.'],
    ],
  },
  {
    id: 'settings', kind: 'staff', name: 'Settings', status: 'written',
    what: 'Everything the shop can change without anyone writing code: prices, people, what helpers can see, the public pages, and the safety gates on messaging.',
    parts: [
      ['Shop', 'The public-facing details — the shop\'s own information, the wording on receipts, and the phone guide customers read before choosing a handset. There is a link to view the public page as they see it.'],
      ['People & access', '👥 Team is who works here, with a password reset. 🔓 What helpers can see ticks the screens a helper may open — the owner always sees everything.'],
      ['Prices & charges', '🔎 Figures nobody has checked lists every price and whether a person has ever confirmed it against something — the public welcome page will not quote a rental price until the rental rates are confirmed, and editing a price clears its tick again. Then: rental rates per country with their minimum, cap and cap period; what a lost or broken phone, charger or SIM costs; the fees and rules; the service price menu behind Online & Print; extra charges; repair stages; void reasons; your own stock categories on top of the built-in ones; and the month\'s target that the dashboard measures against.'],
      ['Communications', 'Email and SMS, each with its safety gate, the addresses post arrives at, a test send, and the log of every message — sent and the replies customers text back, marked ↩ so the two directions read apart. A text that came in carries a Reply button, and one nobody has answered says so on its row.'],
      ['Travel', '🛂 Travel requirements: what each destination demands and how long a document must stay valid. This is what the booking screen checks against.'],
      ['Connectivity', 'The providers behind virtual numbers and the phone lines.'],
      ['Workbench', 'The tools for moving a customer from one handset to another, and the converters behind them.'],
      ['Automation', 'The jobs the nightly sweep runs for you, and what each one is allowed to do.'],
      ['Business', 'The accounts and subscriptions the shop pays for, the telecom upstream, and what the AI features have cost this month.'],
    ],
    dialogs: [
      ['sms-reply', 'Reply to a text a customer sent in: their message quoted above, a box for the answer, and a count that warns before the reply becomes two texts. It goes to the number that texted, read from the log entry — the reply cannot be pointed at any other number. The safety gate still decides what happens to it, and while texting is on hold the message stays counted as waiting, because the customer has not had it.'],
      ['task-from-here', 'Turn what you are reading into a task. The box opens with the words already in it and the cursor in them, so a message can become a job to do without retyping. The same box appears on a carrier email and on an airline email — anywhere something arrives.'],
    ],
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
      ['A text still says it is waiting after somebody replied', 'It is waiting until a reply actually goes. On hold, and in test mode, the reply is written and logged but the customer never receives it — so the count is right and the message really is unanswered. Turn live texting on, or ring them.'],
      ['There is no Reply button on a message', 'Only a text that came IN can be replied to, and not one where they texted STOP — that person has asked not to be contacted, so the button is not there to be pressed.'],
      ['A price change did not apply to an existing rental', 'It is not meant to. What was agreed at the counter stays agreed; the new price applies to what is booked next.'],
      ['The welcome page is not showing any prices', 'That is deliberate, and the fix takes two minutes. The public page only quotes a rental price built from rates somebody has confirmed — open 🔎 Figures nobody has checked and confirm the rental rates, saying where you checked each one. Until then it drops the sentence rather than showing a figure nobody stands behind. Inside the app nothing is withheld: you are standing in front of the rate list and can see it.'],
      ['A dropdown somewhere in the app has the wrong choices in it', 'Almost every list you choose from is edited here, and each one says where it shows up. ⚙️ Fees & Rules holds the void reasons, the repair stages, your own stock categories and the IVR providers. 🧾 Service price menu is what Online & Print offers, ➕ Extra charges is what can be added to a bill, and 🛂 Travel requirements is what the booking screen checks. A choice you remove stays on the records that already carry it — history is not rewritten to match a list.'],
      ['Something is asking for a key or a password', 'Do not paste it into a message or into the app. Keys belong with the host, entered once by the owner.'],
    ],
  },

  // ── The pages with their own address ───────────────────────────────────
  {
    id: 'welcome', kind: 'public', name: 'The front page', path: '/welcome', status: 'written',
    what: 'What somebody sees when they find the shop online: what it does, when it is open, and a way to send a message.',
    parts: [
      ['The bands down the page', 'What the shop offers, said plainly. It is written for someone deciding whether to come in, not for someone who already has.'],
      ['Opening hours', 'Read from the shop details in Settings, so the hours on the page are the hours the owner set and not a number frozen into the page.'],
      ['Send us a message', 'The contact form. What someone sends lands as a task in the shop, so an enquiry is work on a list rather than an email somebody has to remember.'],
      ['English / lashon hakodesh', 'The whole page turns over, right to left included. The choice is remembered and shared with the other public pages.'],
      ['My account · sign in', 'The doors into the portal for customers and the app for staff.'],
    ],
    dialogs: [],
    rules: [
      'This is the page the outside world judges the shop by, and the one Google and the card processors look at. It has to work signed out, on a phone, in both languages.',
      'The hours come from Settings. Changing them there changes them here — never by editing the page.',
      'A message sent from here becomes a task. Nobody has to be watching an inbox for it to be picked up.',
    ],
    wrong: [
      ['The hours on the page are wrong', 'Fix them in Settings under the shop details. The page reads them from there every time it loads.'],
      ['Somebody says they filled the form in and heard nothing', 'Look in Tasks. The enquiry lands there, and an unanswered one is a task nobody has closed.'],
    ],
  },
  {
    id: 'portal', kind: 'public', name: 'Customer portal', path: '/portal', status: 'written',
    what: "A customer's own account page — what they have with the shop, what they owe, and the documents between them and us.",
    parts: [
      ['Their account', 'What they have on the go and what their balance is, read-only. It answers the questions the shop is otherwise rung up about.'],
      ['Documents', 'What staff have shared with them to download, and a way to send files back. What they send arrives marked as waiting, and a person approves it before it counts.'],
      ['Pay by card', 'Clears what they owe through Stripe. It says plainly when card payment is not switched on rather than failing quietly.'],
      ['English / lashon hakodesh', 'The same language choice as the front page, because some customers do not read English.'],
    ],
    dialogs: [],
    rules: [
      'The portal is switched off until the shop turns it on. Until then the address is simply not there — nothing customer-facing goes live by accident.',
      'It is read-only about money and records. A customer can see what they owe and pay it; they cannot change what the shop\'s books say.',
      'A file a customer uploads waits for a person. Nothing they send lands on their record unread.',
    ],
    wrong: [
      ['A customer says the portal is not there', 'It is off until the owner enables it. That is a setting, not a fault.'],
      ['They cannot pay by card', 'Card payment needs Stripe to be connected. The page says so; it does not pretend to take a payment it cannot.'],
    ],
  },
  {
    id: 'phone-guide', kind: 'public', name: 'The phone guide', path: '/phone-guide', status: 'written',
    what: 'Every handset the shop sells and stands behind, compared honestly, for the customer trying to choose one.',
    parts: [
      ['The handsets', 'Each phone with its price and the facts people actually ask at the counter — whether it takes two SIMs, whether it does Hebrew, whether it texts, whether the screen is a touch screen.'],
      ['The owner\'s own pros and cons', 'Written by the shop, not lifted from a brochure. It is the honest comparison the counter conversation would give.'],
      ['English / lashon hakodesh', 'The page chrome turns over with the language choice shared across the public pages.'],
    ],
    dialogs: [],
    rules: [
      'The content comes from the phone guide in Settings. Adding a handset or correcting a price is a change the shop makes itself, with no code change and no waiting.',
      'It is a comparison, not a sales page. The honest note about a handset\'s weakness is the reason a customer trusts the rest of it.',
    ],
    wrong: [
      ['A handset is missing or the price is old', 'Settings, phone guide. The public page follows immediately.'],
      ['A customer asks something the page does not answer', 'That is a question worth adding to the guide — if one person asked at the counter, others are wondering online.'],
    ],
  },
  {
    id: 'repair', kind: 'public', name: 'Repair request', path: '/repair', status: 'written',
    what: 'The short form a customer fills in before bringing a phone in, so the bench knows it is coming.',
    parts: [
      ['Who you are', 'Name and a number, so the shop can ring back.'],
      ['Which device · what is wrong', 'Enough to know whether it is worth them making the journey, and whether a part needs ordering.'],
      ['What happens next', 'The request lands as a task in the shop. A real repair ticket is opened when the phone actually arrives.'],
    ],
    dialogs: [],
    rules: [
      'A request is a heads-up, not a booking. Nothing is promised, no price is quoted, and no slot is held — this is a walk-in shop and the form respects that.',
      'It asks two questions fewer than the software it competes with, deliberately. A long form is a form nobody finishes.',
      'The repair ticket is opened on the Repairs screen when the device is in your hand, not from the request.',
    ],
    wrong: [
      ['A customer arrives saying they booked online', 'They sent a request. Open the task, then open a real repair ticket with the phone in front of you.'],
      ['A request has no useful detail', 'Ring them. The number is the part of the form that matters most.'],
    ],
  },
  {
    id: 'login', kind: 'public', name: 'Staff sign-in', path: '/login', status: 'written',
    what: 'Where staff sign in. Nobody reaches the app, or any of the shop\'s data, without coming through here.',
    parts: [
      ['Email and password', 'The ordinary way in, with the address the account was set up under.'],
      ['The code step', 'After the password, a code sent to the email address. Two steps, because one is what a stolen password defeats.'],
      ['Sign in with Google', 'Where the shop has it switched on, the same account without a second password to forget.'],
    ],
    dialogs: [],
    rules: [
      'Every screen in the app is behind this, and so is every action. A tab that looks reachable without signing in is a fault, not a shortcut.',
      'The password is personal, not the shop\'s. Sharing one makes the history of who did what worthless.',
      'A staff member who leaves is removed under People in Settings. That is the step that actually closes the door.',
    ],
    wrong: [
      ['The code never arrives', 'Check the address is the one on the account, and look in junk. The owner can reset a password from Settings.'],
      ['Signed in but a screen is missing', 'That is access, not sign-in: a helper sees the screens they have been granted, and the owner sets that in Settings.'],
    ],
  },
  {
    id: 'tool-contacts', kind: 'public', name: 'Contacts tool', path: '/tools/contacts', status: 'written',
    what: "Staff tool: turns whatever contact list a customer arrives with into one clean file their new phone can import.",
    parts: [
      ['Drop the files', 'Spreadsheets, CSVs and existing contact files, several at once. The page works out what each one is.'],
      ['Map the columns', 'Say which column is the name and which is the number, for a spreadsheet that does not say so itself.'],
      ['Tidy the numbers', 'Puts UK numbers into one consistent form, so the same person is not three different entries.'],
      ['Merge and de-duplicate', 'Everything dropped in becomes one list with the duplicates collapsed.'],
      ['Download', 'One contact file to load onto the new phone.'],
    ],
    dialogs: [],
    rules: [
      'Everything happens in the browser on the machine in front of you. The customer\'s contacts are not uploaded anywhere, which is the entire reason this exists rather than a website.',
      'Charge the work as a service on Online & Print, and save the finished file against the customer, so the next phone change is one click rather than the whole job again.',
    ],
    wrong: [
      ['The columns come out in the wrong places', 'Set them by hand at the mapping step — the guess is only a guess when the spreadsheet has no headings.'],
      ['Some numbers look wrong afterwards', 'They were probably stored oddly to begin with. Fix them here before the download rather than on the new phone.'],
    ],
  },
  {
    id: 'tool-convert', kind: 'public', name: 'Convert tool', path: '/tools/convert', status: 'written',
    what: 'Staff tool: the everyday file conversions — images to and from PDF, pages out of a PDF, several files into one download.',
    parts: [
      ['Drop the file', 'Images or PDFs, one or many.'],
      ['Choose what you want out', 'The conversion is picked from what went in and what is wanted.'],
      ['Download', 'The result, as one file or a bundle where there are several.'],
    ],
    dialogs: [],
    rules: [
      'It all runs on this machine, in the browser. Nothing is uploaded, which matters because these files are usually somebody\'s documents.',
      'A conversion is a service like any other. Charge it on Online & Print rather than doing it for nothing because the tool made it quick.',
    ],
    wrong: [
      ['A very large file is slow', 'The work is happening on this computer rather than on a server. Give it a moment before assuming it has failed.'],
    ],
  },
  {
    id: 'tool-ocr', kind: 'public', name: 'Read-a-document tool', path: '/tools/ocr', status: 'written',
    what: 'Staff tool: gets the text out of a photograph or a scan, in English or Hebrew, ready to copy.',
    parts: [
      ['Drop the picture', 'A photo a customer sent, or something off the scanner.'],
      ['Read it', 'The text comes out on screen to copy into whatever needs it.'],
      ['English or Hebrew', 'Both are read on this machine, with nothing sent away.'],
    ],
    dialogs: [],
    rules: [
      'On this device — the normal way — the document never leaves the computer. These are usually somebody\'s private papers, and that is exactly why this is not a website that wants an upload. The one exception is the ⚠ AI reading option, which sends the picture away to be read; it is opt-in for that reason.',
      'What comes out is a machine reading a picture. Check it against the document before anything is acted on — a mis-read digit in a reference is worth nothing.',
    ],
    wrong: [
      ['The text comes out as nonsense', 'The picture is the problem, not the tool. A flat, straight, well-lit photograph reads; a crumpled one at an angle does not.'],
    ],
  },
  {
    id: 'tool-transfer', kind: 'public', name: 'Transfer tool', path: '/tools/transfer', status: 'written',
    what: 'Staff tool: moves someone from an old phone to a new one — their messages and their contacts, whatever format the old phone gave you.',
    parts: [
      ['Drop what the old phone produced', 'A message backup, a phone\'s own contact file, or an ordinary contact file. The page recognises which it is.'],
      ['It produces what the new phone needs', 'The matching file for the new handset, including UK numbers put right on the way through.'],
      ['Download and load it on', 'One file to restore on the new phone.'],
    ],
    dialogs: [],
    rules: [
      'This is the whole migration in one place, and it runs on this machine — somebody\'s messages are not going up to a website.',
      'Charge it as a service and save the finished file against the customer. The next handset change then starts from something rather than nothing.',
    ],
    wrong: [
      ['The old phone gave a format the page does not know', 'Do not force it. Say what the phone was, and it can be added — a wrong conversion loses messages silently.'],
    ],
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
    id: 'privacy', kind: 'public', name: 'Privacy notice', path: '/privacy', status: 'written',
    what: 'What the shop holds about a customer, why, and what it does with it. Written plainly, and readable without signing in.',
    parts: [
      ['What is collected, and why', 'The details the shop actually keeps, what they are used for, and the grounds for keeping them. It describes this shop rather than repeating a template.'],
      ['Google sign-in', 'Named in its own right, because signing in that way is what a customer will ask about.'],
      ['How it is stored, and who else sees it', 'Where the information sits and which other services are involved in providing the shop\'s own services.'],
      ["A customer's rights", 'What they can ask for, including a copy of what is held and its correction or removal.'],
      ['Cookies, changes and how to reach the shop', 'The remaining sections, and the address to write to.'],
      ['Where it is linked from', 'The front page footer and the sign-up form, so a customer meets it before handing anything over.'],
    ],
    dialogs: [],
    rules: [
      'The address must stay as it is. Sign-in with Google and the card processor both point at it, and moving the page breaks them.',
      'The words are the owner\'s to approve. Changing what the shop actually does with customer data is a change to this page, not the other way round.',
      'It has to open without signing in. A privacy notice behind a login is no notice at all.',
    ],
    wrong: [
      ['A customer asks what is held about them', 'This page is the answer, and it is meant to be honest enough to send them.'],
    ],
  },
  {
    id: 'terms', kind: 'public', name: 'Terms', path: '/terms', status: 'written',
    what: 'The terms a customer is agreeing to when they use the shop\'s services. Plainly written and open to anyone.',
    parts: [
      ['What the shop does · your account', 'The services being agreed to, and what is expected of the person holding an account.'],
      ['Prices and payment', 'How charging works, stated once so the counter and the page agree.'],
      ['Rentals', 'The terms a hire is taken under.'],
      ['Travel bookings and entry requirements', 'The important one: the traveller remains responsible for meeting their destination\'s requirements, and any guidance the shop gives is help rather than a guarantee. The app\'s document checks are that same help — they do not transfer the responsibility.'],
      ['Repairs', 'Asking the customer to back up anything important first, because data can be lost in a repair.'],
      ['Acceptable use, responsibility and the law', 'What the shop is answerable for and what it is not, and which law governs the agreement.'],
      ['Where it is linked from', 'The front page footer, beside the privacy notice and the refund policy.'],
    ],
    dialogs: [],
    rules: [
      'The address must stay as it is — sign-in points at it.',
      'The owner approves the wording. This page is what the shop can be held to, so it should say what the shop actually does.',
    ],
    wrong: [
      ['A customer disputes something not covered here', 'Do not improvise a rule at the counter. Take it to the owner: either the page is wrong or the answer is.'],
    ],
  },
  {
    id: 'refund', kind: 'public', name: 'Refund policy', path: '/refund', status: 'written',
    what: 'When money is given back, when it is not, and how. Required for taking cards, and the answer to an awkward conversation.',
    parts: [
      ['Goods, SIMs and subscriptions', 'What can be brought back and what cannot, kept apart because a physical thing and an airtime service are not the same promise.'],
      ['Repairs', 'Where a repair charge stands if the customer changes their mind.'],
      ['Phone rentals', 'A hire cancelled before the phone is collected is refunded in full; a deposit comes back once the phone is returned on time and checked. Late and damage charges are a cost the shop has incurred, not a purchase to be refunded.'],
      ['Travel bookings', "The airline's rules decide the ticket. The shop's own fee is separate, and comes back only where the work has not been done."],
      ['How a refund is made', 'Money goes back the way it came — a card refund to the same card, account credit to their balance.'],
      ['How to ask', 'What the customer should do, so the counter can point at it instead of improvising.'],
      ['Where it is linked from', 'The front page footer, and it is what the card processor expects to find.'],
    ],
    dialogs: [],
    rules: [
      'The address must stay as it is. Card processing points at this page.',
      'The specifics — the window, how deposits are treated — are the owner\'s to set, and they are written to line up with UK consumer law.',
      'What this page says is what a customer can hold the shop to. Do not agree something different at the counter without asking.',
    ],
    wrong: [
      ['A customer wants money back and you are not sure', 'Read this page with them. If it does not cover their case, it is the owner\'s decision, not the counter\'s.'],
    ],
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
