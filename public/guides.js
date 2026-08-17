// GENERATED FROM lib/guides.mjs — DO NOT EDIT.
// Edit the guides in lib/guides.mjs and run: node scripts/build-guides.cjs
// (next.config.js runs it on every build, however the build was started.)
// "If a screen needs explaining, it has failed." — owner, 17 Aug 2026.
//
// That is the standard, and this file is the admission that no system meets it
// on every screen every day. A helper covering the counter for an afternoon
// should be able to ask the app how to do the job and be walked through it.
//
// CURATED, not generated, and deliberately so. Kosher Connect already has a
// generative assistant (Gemini, /api/assistant/ask) and it is good at
// questions about DATA — who owes money, what is overdue. It is the wrong
// tool for "how do I take a payment", because the person asking that question
// is precisely the person who cannot tell a confident wrong answer from a
// right one, and here a wrong answer costs a mis-charged customer. These steps
// are written once by a person, are then correct every time, work with no
// network and no API key, and cost nothing to ask.
//
// The generative assistant sits BEHIND this, not in front of it: matchGuides
// runs first, and only an unmatched question goes to the model.
//
// Every guide names the screen it belongs to, so test/guides.test.mjs can hold
// the library to one rule: no screen in the app is left without an answer.

/**
 * One guide.
 *   id      stable key
 *   tab     which screen it belongs to (must be a real tab)
 *   q       the question in the words someone would actually use
 *   words   extra words that mean the same thing — matching is plain-word, so
 *           this is where "text", "sms", "message" all reach one guide
 *   steps   what to do, in order, in plain language. No jargon, no shorthand.
 *   go      the label on the button that takes them there
 */
const GUIDES = [
  {
    id: 'new-rental', tab: 'rentals', q: 'How do I rent a phone to someone?',
    words: ['rent', 'rental', 'hire', 'phone out', 'lend', 'give a phone', 'new rental'],
    go: 'Open New rental',
    steps: [
      'Open Phone Rentals and press "+ New rental".',
      'Type the customer\'s name. If they are new, the list offers to add them — a name and a number is enough.',
      'Pick the dates first: the phone list then only offers handsets that are actually free for those days.',
      'Choose the phone. Numbers this customer had before are listed first, marked "↺ had".',
      'Check the price box. It shows the day rate, any Shabbos and Yom Tov days that are free, and the cap.',
      'Tick what you are giving them — phone, SIM, charger — and press Save.',
    ],
  },
  {
    id: 'return-phone', tab: 'rentals', q: 'How do I take a phone back?',
    words: ['return', 'back', 'came back', 'brought back', 'returned', 'give back', 'finish rental'],
    go: 'Open Phone Rentals',
    steps: [
      'Open Phone Rentals and find the rental — or scan the phone\'s IMEI in the scan box, which finds it for you.',
      'Press "⚙ Manage" on that row.',
      'Turn on "Returned". The app works out any late days and shows what they come to.',
      'If anything is missing or broken, tick it there — charger, SIM, damage — so the charge is on the record.',
      'Take the payment if there is one owing, then Save. The phone goes back into stock straight away.',
    ],
  },
  {
    id: 'take-payment', tab: 'wallet', q: 'How do I take a payment from someone?',
    words: ['payment', 'pay', 'money', 'paid me', 'pay me', 'wants to pay', 'take money', 'settle', 'top up', 'balance'],
    go: 'Open Wallet',
    steps: [
      'Open Wallet and choose the customer.',
      'Enter the amount and how they paid — cash, card or bank transfer.',
      'Press Save. The payment goes on their record and their balance updates at once.',
      'To see what someone owes before taking money, their name in Customers shows the balance on the card.',
    ],
  },
  {
    id: 'till-sale', tab: 'shop', q: 'How do I sell something at the counter?',
    words: ['sell', 'sale', 'till', 'shop', 'counter', 'accessory', 'charger', 'epos', 'checkout'],
    go: 'Open the till',
    steps: [
      'Open Shop and press the till button for the full-screen counter screen.',
      'Scan the barcode, or tap the item tiles to add things to the basket.',
      'If it is for a customer on the books, choose them at the top — otherwise it is a walk-in.',
      'Press the payment method — Cash, Card or Transfer — and take the money.',
      'Press Pay. The stock comes down and the sale is on the day\'s takings immediately.',
      'If someone has to wait, "⏸ Park sale" puts the basket aside and clears the screen for the next person.',
    ],
  },
  {
    id: 'new-sim', tab: 'sim', q: 'How do I set up a SIM plan for someone?',
    words: ['sim', 'plan', 'lebara', 'monthly', 'renewal', 'subscription'],
    go: 'Open SIM Plans',
    steps: [
      'Open SIM Plans and press "+ New SIM plan".',
      'Choose the customer, the provider and the SIM number.',
      'Set the renewal date — this is what drives the reminders, so it matters more than anything else on the form.',
      'Say who pays: "Direct" if the customer pays the network themselves, "Through me" if the shop pays and bills them.',
      'Save. SIMs renewing today or tomorrow show up on the Dashboard.',
    ],
  },
  {
    id: 'new-booking', tab: 'bookings', q: 'How do I book a flight or a ticket?',
    words: ['flight', 'ticket', 'booking', 'travel', 'passport', 'fly', 'trip'],
    go: 'Open Tickets & Flights',
    steps: [
      'Open Tickets & Flights and press "+ New booking".',
      'Choose the customer, then add each passenger.',
      'The passport questions come first, before the booking — a passport that expires before the travel date stops the booking, and a missing copy warns you.',
      'Pick the service and the number of passengers; the fee works itself out.',
      'Save, then take the payment on the booking when the money comes in.',
    ],
  },
  {
    id: 'new-repair', tab: 'repairs', q: 'How do I book in a phone for repair?',
    words: ['repair', 'fix', 'broken', 'screen', 'ticket', 'book in'],
    go: 'Open Repairs',
    steps: [
      'Open Repairs and press "+ New repair".',
      'Choose the customer and describe the fault in plain words — what the customer said is enough.',
      'Put in the price if you know it, and Save.',
      'Move the ticket along as the job goes: In Progress, then Ready when it can be collected.',
      'Marking it Collected is what charges the customer\'s wallet — nothing is charged before that.',
    ],
  },
  {
    id: 'online-print', tab: 'services', q: 'How do I charge for printing or online work?',
    words: ['print', 'printing', 'online', 'service', 'hourly', 'timer', 'tech', 'computer', 'help timer'],
    go: 'Open Online & Print',
    steps: [
      'Open Online & Print and press "+ Charge a service".',
      'Choose the customer and the service from the list — each one carries its own price.',
      'For work charged by time, start the help timer instead: it runs while you work and turns the minutes into a charge when you stop.',
      'The timer bills by the hour with a ten-minute minimum, so a five-minute job still charges ten.',
      'Press "⧉ Float on top" and the timer becomes a small window that stays in front of every other site and program, wherever you drag it. Leave this tab open behind it; closing the tab closes the window.',
      'Save. The charge lands on the customer\'s wallet like any other.',
    ],
  },
  {
    id: 'add-customer', tab: 'customers', q: 'How do I add a new customer?',
    words: ['customer', 'new person', 'add someone', 'register', 'client'],
    go: 'Open Customers',
    steps: [
      'You do not have to leave what you are doing: every place that asks for a customer offers "➕ Add … as a new customer" in the list.',
      'A first name, a surname and a number is all that is needed — the rest can be filled in later.',
      'If the number is already on file, the app says whose it is and offers to use them instead of making a second record.',
      'For the full record — address, notes, house account — open Customers and press "+ New customer".',
    ],
  },
  {
    id: 'cash-up', tab: 'dashboard', q: 'How do I cash up at the end of the day?',
    words: ['cash up', 'cashup', 'end of day', 'close', 'takings', 'z report', 'count'],
    go: 'Open the cash-up screen',
    steps: [
      'Open the cash-up screen from the Dashboard.',
      'It shows what the app expects to be in the drawer, from every sale taken today.',
      'Count the drawer and type in what is actually there.',
      'Save. Any difference between the two is recorded as a variance — that record is the whole point, so do not adjust the count to make it match.',
    ],
  },
  {
    id: 'virtual-number', tab: 'virtual', q: 'How do I give someone a virtual number?',
    words: ['virtual', 'vn', 'us number', 'shortcut', 'divert', 'second number'],
    go: 'Open Virtual Numbers',
    steps: [
      'Open Virtual Numbers and press "+ New number".',
      'Choose the customer and the city prefix they want.',
      'Choose weekly or monthly — the price follows the choice.',
      'Save. A virtual number can also be added to a rental as it is being written up, with the "🔢 Add Virtual Number" tick.',
    ],
  },
  {
    id: 'reminder-sms', tab: 'rentals', q: 'How do I text a customer?',
    words: ['text', 'sms', 'message', 'remind', 'reminder', 'chase', 'whatsapp'],
    go: 'Open Phone Rentals',
    steps: [
      'On a rental row, the ✉️ button drafts the message for you — it never sends without you reading it.',
      'The ⏰ button sets a reminder for yourself instead, which lands in Tasks.',
      'Texts are held until the shop turns sending on, so a draft is exactly that until then.',
      'Settings → Messaging shows every message the system built or sent, and whether it actually arrived.',
    ],
  },
  {
    id: 'kol-torah-job', tab: 'koltorah', q: 'How do I take in a Kol Torah job?',
    words: ['kol torah', 'cd', 'mp3', 'conversion', 'shiur', 'consignment', 'shul'],
    go: 'Open Kol Torah',
    steps: [
      'Open Kol Torah. The "➕ New job" panel is at the top of the conversion list.',
      'Choose the customer, or leave it as walk-in and type a name.',
      'Choose the kind of job, the quantity and the price, and press "+ Add job".',
      'Move it along as it goes — Ready when it can be collected, Collected when it goes out, which is what charges it.',
      'Consignment by shul is the section below: Deliver, Sold and Return move the count; Settle records the money.',
    ],
  },
  {
    id: 'tasks', tab: 'tasks', q: 'How do I keep track of what needs doing?',
    words: ['task', 'todo', 'to do', 'jobs', 'list', 'remember', 'follow up'],
    go: 'Open Tasks',
    steps: [
      'Tasks holds anything that needs doing that is not a rental, a repair or a sale.',
      'Add one with a due date, and it appears on the Dashboard when it is due.',
      'The ⏰ button on any rental, SIM or repair makes a task about that record, so the link back is kept.',
      'Say "remind me tomorrow" style dates in plain words — the date box understands them.',
    ],
  },
  {
    id: 'confirm-data', tab: 'review', q: 'What is Confirm Data for?',
    words: ['confirm', 'review', 'imported', 'seeded', 'unconfirmed', 'check data', 'spreadsheet'],
    go: 'Open Confirm Data',
    steps: [
      'Most of what is on file came in from spreadsheets, not from someone typing it here. Until a person has looked at a record, it is marked unconfirmed.',
      'Confirm Data shows those records one customer at a time.',
      'Read the details against what you know, fix anything wrong, and press Confirm.',
      'A confirmed record loses its badge everywhere in the app. Nothing is blocked in the meantime — the badge is a flag, not a lock.',
    ],
  },
  {
    id: 'carrier-mail', tab: 'mail', q: 'What is Carrier Mail?',
    words: ['carrier', 'mail', 'email', 'lebara email', 'pairing', 'inbox'],
    go: 'Open Carrier Mail',
    steps: [
      'Emails from the networks — activations, top-ups, renewals — arrive here automatically.',
      'Each one is matched to the SIM it is about, using the address it was sent to and any number in the message.',
      'Anything the app could not match with certainty waits here for a person to say which SIM it belongs to.',
      'Once paired, the message shows on that SIM\'s record, so the history of a line is in one place.',
    ],
  },
  {
    id: 'pricing', tab: 'settings', q: 'How do I change prices?',
    words: ['price', 'prices', 'pricing', 'rate', 'cap', 'charge', 'cost', 'change price'],
    go: 'Open Settings',
    steps: [
      'Open Settings → Pricing. Every country has a row.',
      '"£/day" is the day rate, "Min £" the least a hire can cost, and "Cap £" the most it can cost in one 30-day period.',
      '"After-cap £/day" is what each day costs once a hire runs past that period.',
      'Press 💾 on the row to save it.',
      'Rentals already written up keep the price they were given — a rate change only affects new ones.',
    ],
  },
  {
    id: 'who-owes', tab: 'wallet', q: 'How do I see who owes money?',
    words: ['owes', 'owing', 'debt', 'arrears', 'outstanding', 'chase money', 'unpaid'],
    go: 'Open Wallet',
    steps: [
      'The Dashboard shows the total outstanding across everyone.',
      'Wallet lists every customer in debt, largest first.',
      'The 🤖 Ask button answers "who owes money?" directly if you would rather type it.',
      'From a customer\'s card you can take the payment or draft a reminder without leaving it.',
    ],
  },
  {
    id: 'find-anything', tab: 'dashboard', q: 'How do I find a customer or a phone quickly?',
    words: ['find', 'search', 'look up', 'where is', 'lost', 'quick'],
    go: 'Go to the Dashboard',
    steps: [
      'Press Ctrl+K (⌘K on a Mac) anywhere in the app — that is the search for everything.',
      'Type a name, a number or part of an IMEI and press Enter.',
      'It also does jobs, not just searching: type "new rental", "payment" or "text size" and it offers the action.',
      'Press ? at any time for the list of keyboard shortcuts.',
    ],
  },
  {
    id: 'bigger-text', tab: 'settings', q: 'The writing is too small — how do I make it bigger?',
    words: ['text size', 'bigger', 'larger', 'font', 'simple mode', 'small', 'cannot read', 'eyes'],
    go: 'Open Settings',
    steps: [
      'Press the "Aa" button at the top of any screen. Each press steps the whole app up a size.',
      'The setting sticks — it is remembered for next time on this device.',
      'The moon button next to it switches between the light and dark screen.',
      'Every screen in the app is checked at the largest size, so nothing goes off the edge when you turn it up.',
    ],
  },
]

/** Every screen the library covers. */
function guideTabs(guides = GUIDES) {
  return [...new Set(guides.map(g => g.tab))]
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

// Words too common to tell one guide from another. Without this, "how do I
// take a payment" matches every guide containing the word "how".
const NOISE = new Set(['how', 'do', 'i', 'a', 'an', 'the', 'to', 'my', 'me', 'is', 'in', 'on',
  'of', 'for', 'and', 'it', 'that', 'this', 'what', 'can', 'you', 'we', 'with', 'from', 'at',
  'be', 'are', 'was', 'if', 'then', 'get', 'got', 'does', 'need'])

/**
 * Guides that answer this question, best first.
 *
 * Plain-word matching on purpose: someone types "phone came back" or "took a
 * phone back", not "process rental return". A phrase in `words` that appears
 * whole in the question is the strongest signal; single words score less, and
 * a word appearing in both a guide's question and its words does not score
 * twice.
 *
 * Returns [] when nothing matches — an honest miss, so the caller can hand the
 * question to the generative assistant rather than showing a wrong answer.
 */
function matchGuides(query, guides = GUIDES, { limit = 5 } = {}) {
  const q = norm(query)
  if (!q) return []
  const asked = new Set(q.split(' ').filter(w => w && !NOISE.has(w)))
  if (!asked.size) return []

  const scored = guides.map(g => {
    const phrases = g.words.filter(w => w.includes(' '))
    // A word in `words` was put there ON PURPOSE to catch this question, so it
    // counts for more than a word that merely happens to be in the guide's own
    // sentence: "the phone came back" must reach the return guide, not the one
    // about renting a phone out, and both sentences contain "phone".
    const hints = new Set(g.words.filter(w => !w.includes(' ')).map(norm))
    const asWritten = new Set(norm(g.q).split(' ').filter(w => w && !NOISE.has(w)))
    let score = 0
    for (const p of phrases) if (q.includes(norm(p))) score += 3
    for (const w of asked) {
      if (hints.has(w)) score += 2
      else if (asWritten.has(w)) score += 1
    }
    // A question that is nearly the guide's own question wins outright.
    if (norm(g.q).includes(q) || q.includes(norm(g.q))) score += 5
    return { guide: g, score }
  }).filter(x => x.score > 0)

  scored.sort((a, b) => b.score - a.score || a.guide.id.localeCompare(b.guide.id))
  return scored.slice(0, limit).map(x => x.guide)
}

/** The single best answer, or null when the library genuinely has none. */
function bestGuide(query, guides = GUIDES) {
  return matchGuides(query, guides, { limit: 1 })[0] || null
}

window.KC_GUIDES = GUIDES
window.kcMatchGuides = matchGuides
window.kcBestGuide = bestGuide
