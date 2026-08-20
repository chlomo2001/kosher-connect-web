// How to use the thing you just took home. Customer-facing. Pure — no I/O.
//
// Owner, 20 Aug: "eventually also attaching a manual (per service)." (#18)
//
// THIS IS NOT THE STAFF MANUAL. lib/manual.mjs describes the app, one entry per
// screen, for whoever is behind the counter; lib/guides.mjs walks staff through
// a job. Neither is any use to a customer standing in an airport at midnight
// wondering why the phone says No Service. That reader is this file's whole
// audience.
//
// LINKED, NOT ATTACHED. A receipt points at /help/<id>. A PDF stapled to an
// email gets stripped by filters, bloats the send, and — the part that matters
// — cannot be corrected after it has gone. The day a carrier changes a code,
// this file changes and every receipt ever sent is right again.
//
// NO PRICES, NO RATES, NO PERIODS. Same rule the manual keeps and for the same
// reason: the business has one price list, it lives in Settings and
// BUSINESS_RULES.md, and a second copy in a customer-facing document is a
// second copy that will be wrong. test/serviceGuides.test.mjs enforces it.
//
// British English, and written for the community — same standard as every
// other customer-facing surface.

/**
 * One guide.
 *   id       the URL slug, /help/<id>, and the key a receipt asks for
 *   service  which thing the shop sold — matches the receipt kinds
 *   title    the page heading
 *   intro    one or two sentences: what this is and when to read it
 *   sections [{ heading, points: [] }] — points are whole sentences
 *   updated  shown on the page, so a customer can see it is current
 */
export const SERVICE_GUIDES = [
  {
    id: 'phone-rental',
    service: 'rental',
    title: 'Your rented phone',
    updated: '21 August 2026',
    intro: 'Everything about the handset you are travelling with — getting it working, what to do if it stops, and bringing it back.',
    sections: [
      {
        heading: 'Before you fly',
        points: [
          'Charge it fully at home. The charger we gave you is the one to take; a phone that arrives flat is a phone you cannot use to ring us.',
          'Send yourself a test message from it while you are still in the shop, so you know the number works before you need it.',
          'Save our number in it: 0161 531 1386, and from abroad +44 161 531 1386.',
          'Tell the people who need to reach you what the rented number is. It is on your receipt.',
        ],
      },
      {
        heading: 'When you land',
        points: [
          'Turn the phone off and on again once you are through the airport. That is what makes it look for the local network, and it is the fix for most of what looks broken in the first hour.',
          'Give it a few minutes. Finding a network in a new country is not instant.',
          'If it still says No Service after a restart and ten minutes, ring us — do not start changing settings.',
        ],
      },
      {
        heading: 'If something goes wrong',
        points: [
          'Ring the shop. We can see the line from here and most problems are sorted in a couple of minutes without you doing anything.',
          'If the handset is lost or stolen, tell us the same day. We can stop the line so nobody else can use it.',
          'Do not put your own SIM in it, and do not let anyone else take it apart. If it comes back opened, it is treated as damaged.',
        ],
      },
      {
        heading: 'Bringing it back',
        points: [
          'The day it is due back is on your receipt. Bring the handset, the SIM and the charger — the return is not finished until all of it is accounted for.',
          'If your trip is extended, ring us before the due date rather than after. Extending is easy; a late return is charged.',
          'Anything still owed can be settled at the counter when you bring it in, or online from the link on your receipt.',
        ],
      },
    ],
  },
  {
    id: 'sim-plan',
    service: 'sim',
    title: 'Your SIM plan',
    updated: '21 August 2026',
    intro: 'The plan we set up for you, how it renews, and what to do when something stops working.',
    sections: [
      {
        heading: 'Your account',
        points: [
          'The network holds your account under an email address that we set up for you. It is on your account page, and it is the address you sign in with at the network — not an address to write to us at.',
          'If you need to sign in and cannot, ring us. We can read you what you need or send it on.',
        ],
      },
      {
        heading: 'Renewals',
        points: [
          'Your plan renews on a set day each month; the date is on your account page.',
          'A plan renews only if the network has a way to take the money. If the card on the account is removed or expires, the line stops on renewal day with no other warning.',
          'If we manage the payment for you, you will see it on your account with us rather than at the network.',
        ],
      },
      {
        heading: 'When the line stops working',
        points: [
          'Turn the phone off and on again first. It fixes more than people expect.',
          'Then ring us. Most of the time we can see what the network is doing without you having to explain it.',
          'If you are moving your number to us or away from us, that takes a few working days and the line keeps working throughout. We will tell you when it has finished.',
        ],
      },
    ],
  },
  {
    id: 'repair',
    service: 'repair',
    title: 'Your repair',
    updated: '21 August 2026',
    intro: 'What happens to your handset while it is with us, and what to expect when it is ready.',
    sections: [
      {
        heading: 'While it is with us',
        points: [
          'We will tell you what is wrong and what it will cost before any work is done. Nothing is charged that you have not agreed to.',
          'Back up anything you can before you hand a phone in. Some repairs cannot be done without wiping the handset, and we will always say so first.',
          'If we cannot fix the fault, you pay only any diagnostic fee that was agreed at the start.',
        ],
      },
      {
        heading: 'When it is ready',
        points: [
          'We will ring or message you. The phone waits here until you collect it.',
          'Bring your receipt or tell us the name it is under.',
          'The work is covered for the same fault. If it goes wrong again in the same way, bring it back and we will look at it.',
        ],
      },
    ],
  },
  {
    id: 'flight-booking',
    service: 'booking',
    title: 'Your flight booking',
    updated: '21 August 2026',
    intro: 'What we have booked, what you need at the airport, and who to ring if the airline changes something.',
    sections: [
      {
        heading: 'Check what we sent you',
        points: [
          'Check that every name on the booking matches the passport it will be travelled on, exactly. Airlines charge to change a name and some will not change one at all.',
          'Check the dates and the airports. A booking is easiest to fix on the day it is made.',
          'Keep the booking reference. It is what the airline asks for.',
        ],
      },
      {
        heading: 'Before you travel',
        points: [
          'Check that every passport is valid for long enough for where you are going — some countries want six months left on it.',
          'Where a visa or travel authorisation is needed, it is needed before you fly, not at the airport.',
          'If we are checking you in, we will do it and send you what you need. If you are doing it yourself, do not leave it to the day.',
        ],
      },
      {
        heading: 'If the airline changes something',
        points: [
          'Ring us rather than the airline. We hold the booking and can usually sort it faster.',
          'Airline cancellations and refunds follow the airline’s own rules, which we will explain at the time.',
        ],
      },
    ],
  },
  {
    id: 'virtual-number',
    service: 'virtual_number',
    title: 'Your virtual number',
    updated: '21 August 2026',
    intro: 'A number in another country that rings through to you here.',
    sections: [
      {
        heading: 'How it works',
        points: [
          'People ring the number as if you were in that country, and it reaches you wherever you are.',
          'Give the number out exactly as we wrote it on your receipt, including the country code.',
        ],
      },
      {
        heading: 'Keeping it',
        points: [
          'The number runs for as long as it is paid for. If it lapses, the number can be given to somebody else and we cannot get it back.',
          'If you no longer need it, tell us before the next period rather than after.',
        ],
      },
    ],
  },
]

const BY_ID = new Map(SERVICE_GUIDES.map((g) => [g.id, g]))
const BY_SERVICE = new Map(SERVICE_GUIDES.map((g) => [g.service, g]))

/** One guide by its slug, or null. */
export const guideById = (id) => BY_ID.get(String(id || '')) || null

/** The guide for a thing the shop sold — 'rental', 'sim', 'repair'… or null. */
export const guideForService = (service) => BY_SERVICE.get(String(service || '')) || null

/** Every slug, for the router and for the tests. */
export const guideIds = () => SERVICE_GUIDES.map((g) => g.id)

/**
 * The link a receipt carries. Relative to the site, absolute in the email —
 * a mail client has no base URL to resolve a relative href against.
 */
export function guideUrl(service, base = '') {
  const g = guideForService(service)
  if (!g) return ''
  return `${String(base || '').replace(/\/$/, '')}/help/${g.id}`
}
