// What a carrier message MEANS — not merely which SIM it belongs to.
//
// Until 18 Aug 2026 the app filed carrier post and stopped there. A renewal
// reminder, a completed port and a failed payment were all "a message", so the
// Lebara "PortIn" that arrived at 15:07 — "your existing mobile number has been
// successfully moved to the Lebara network" — was filed against a SIM an hour
// later by hand and nothing whatever followed from it. Owner: "a lot of
// customers do pac codes and port ins with us."
//
// A port is not post. It is a JOB the shop did, and the mail is the end of it:
// the number has moved, the SIM record probably still says the old one, and
// somebody should check the line is live before the customer discovers it is
// not. So the kind is worked out, shown, and — for the ones that mean work —
// turned into a task.
//
// Matched on the SUBJECT AND THE BODY, because carriers disagree about which
// carries the meaning: Lebara's subject is the single word "PortIn" while
// Smarty spells it out, and giffgaff puts the whole event in the subject line.
//
// Pure: no I/O, no database. Mirrored into the browser? No — the queue reads
// the kind from the API, so there is one copy and nothing to drift.

/** The kinds, and how each reads on screen. Order matters: first match wins. */
export const KINDS = [
  // Ports first — they are the ones that mean work, and a port confirmation
  // often also says the word "plan" or "renew" further down in the small print.
  ['port_in_complete', 'Port completed', [
    /\bport(ed)?\s*(request\s*)?(is\s*)?(now\s*)?(successful|complete)/i,
    /successfully\s+(moved|ported|transferred)\s+(your|the)?\s*(existing\s+)?(mobile\s+)?number/i,
    /your\s+(existing\s+)?(mobile\s+)?number\s+has\s+been\s+(successfully\s+)?(moved|transferred|ported)/i,
    /^portin$/i,
  ]],
  ['port_requested', 'Port under way', [
    /\bport(ing)?\s*(request|in)\b.*(received|started|in\s+progress|underway|under\s+way|scheduled)/i,
    /we('| a)re\s+(now\s+)?(working\s+on|processing)\s+your\s+port/i,
  ]],
  // A PAC is the customer LEAVING. It is the one piece of carrier post that is
  // bad news for the shop, and it used to look exactly like everything else.
  ['pac_issued', 'PAC code — leaving', [
    /\bPAC\b(?!.*\bnot\b)/,
    /porting\s+authorisation\s+code/i,
    /\bSTAC\b/,
  ]],
  // A sign-in code (issue #15, part 3 — owner approved all three, 23 Aug).
  // Matched NARROWLY on purpose: the auto-forward path treats this kind as
  // time-critical, and a pattern loose enough to catch a payment email would
  // fast-track the wrong thing. After the ports and the PAC so a port email
  // that happens to carry a validation code still raises its port task.
  ['otp', 'Sign-in code', [
    /\bone[- ]?time\s+(pass(code|word)?|pin|code)\b/i,
    /\bverification\s+code\b/i,
    /\b(sign[- ]?in|log[- ]?in|login)\s+code\b/i,
    /\byour\s+(security\s+)?code\s+is\b/i,
    /\bOTP\b/,
  ]],
  // A REMOVED PAYMENT METHOD IS NOT A FAILED PAYMENT — it is worse, and quieter.
  //
  // Owner, 20 Aug, on his own SIM setup for a customer: "i paid with my card,
  // he paid me, i removed my card, and still need to set up a payment method
  // for him (didnt manage to do from app)". That is the shop's normal way of
  // opening a line — the shop's card gets it going, then comes off the account
  // so the shop is not carrying somebody's monthly bill. The gap between the
  // card coming off and the customer's method going on is the dangerous bit:
  // Lebara's own words are "removing the payment method will interrupt your
  // recurring plan", and nothing else in the app will ever mention it again.
  //
  // A failed payment announces itself on the day it fails. This announces
  // itself once, weeks early, and then the line simply stops on renewal day
  // with no warning to anybody. So it raises a task, at high priority, the
  // moment the confirmation lands. Owner: "ALL such emails (remove conf) shall
  // evoke a task."
  //
  // Ahead of payment_failed so a message that manages to read as both is filed
  // as the removal, which is the one with something to do about it.
  ['payment_method_removed', 'Payment method removed', [
    /payment\s+remove\s+confirmation/i,
    /payment\s+(method|details?|card)\s+((has\s+been|was|is)\s+)?(safely\s+)?removed/i,
    // Both apostrophes. Carriers send the curly one — "You’ve removed" — and a
    // pattern written with the typewriter one silently never fires on real mail.
    /\b(we|you)\s*(?:['’]ve|\s+have)?\s*removed\s+your\s+payment\s+(method|details?|card)/i,
    /removing\s+the\s+payment\s+method\s+will\s+interrupt/i,
  ]],
  ['payment_failed', 'Payment problem', [
    /payment\s+(has\s+)?(failed|was\s+declined|unsuccessful)/i,
    // "your payment" and "the payment" both. Lebara — the shop's biggest
    // carrier by a distance — writes "Looks like we couldn't process THE
    // payment for your SIM Only plan", and the article was enough to miss it.
    // This kind is both ACTIONABLE and forwardable, so missing it meant a
    // customer whose payment failed got no task raised for staff AND no
    // forward offered: the one message where being early is worth money.
    // Both apostrophes here too — the same trap payment_method_removed's own
    // comment warns about bit THIS pattern: "couldn’t" with the curly ’ (the
    // one carriers actually send) never matched the typewriter-only class.
    // Caught by test/otpForward.test.mjs while proving otp doesn't fast-track
    // payment mail.
    /we\s+(could\s*n[o'’]t|were\s+unable\s+to)\s+(take|collect|process)\s+(your|the)?\s*payment/i,
    /update\s+your\s+(pool'?s\s+)?(credit\s+)?card/i,
    // The subject line Lebara actually sends with it.
    /payment\s+(method|details)\s+(needs?|requires?)\s+an?\s+update/i,
    /insufficient\s+funds\b/i,
  ]],
  ['expiry_warning', 'About to expire', [
    /\bwill\s+expire\b/i,
    /\bexpires?\s+in\s+\d+\s+days?/i,
    /\b(number|sim)\s+(is\s+)?(about\s+to|due\s+to)\s+expire/i,
  ]],
  ['renewed', 'Renewed', [
    /(has\s+been|was)\s+(successfully\s+)?renewed/i,
    /we\s+have\s+(received|collected)\s+(your\s+)?payment/i,
    /\bauto-?boost\b/i,
  ]],
  // MARKETING LAST, so a real notice always wins the match: a port confirmation
  // or a failed payment that happens to carry an advert in its footer is still
  // a port confirmation. Owner, 19 Aug: "promotion emails filtered to never
  // arrive to app" — a message that lands here is filed nowhere and raises
  // nothing (pages/api/inbound/mail.js), so these patterns must only catch
  // things nobody would ever act on.
  ['marketing', 'Advert — not filed', [
    /\b\d{1,2}%\s*(off|discount)\b/i,
    /\b(black\s+friday|cyber\s+monday|summer|winter|spring|flash)\s+(sale|deal|offer)/i,
    /\b(deal|offer|sale)\s+ends\s+(soon|today|tonight|tomorrow)/i,
    /\brefer\s+a\s+friend\b/i,
    /\bdownload\s+(our|the)\s+app\b/i,
    /\bunsubscribe\s+from\s+(our\s+)?(marketing|newsletter|promotional)/i,
    /\bnewsletter\b/i,
    /\bupgrade\s+(now|today)\b.*\bsave\b/i,
  ]],
  ['renewal_reminder', 'Renewing soon', [
    /auto\s*renew\s+reminder/i,
    /\bis\s+scheduled\s+to\s+renew\b/i,
    /\brenews?\s+on\b/i,
    /\breminder\b/i,
  ]],
]

const LABELS = new Map(KINDS.map(([k, label]) => [k, label]))

/** What to call a kind on screen. Unknown kinds read as nothing at all. */
export function kindLabel(kind) {
  return LABELS.get(kind) || ''
}

/**
 * The kind of a carrier message, or 'other' when nothing matches — an honest
 * shrug, so a queue full of unlabelled post is visible as unlabelled rather
 * than mislabelled.
 */
export function carrierMailKind({ subject = '', snippet = '', text = '' } = {}) {
  // The subject counts for more than the body: "PortIn" as a subject is the
  // whole message, while the word "port" three screens down a renewal email is
  // a footer link about porting to Lebara. So the subject is tested first, on
  // its own, before anything is read from the body.
  const subj = String(subject || '')
  for (const [kind, , patterns] of KINDS) {
    if (patterns.some((re) => re.test(subj))) return kind
  }
  const body = `${String(snippet || '')} ${String(text || '')}`.slice(0, 4000)
  for (const [kind, , patterns] of KINDS) {
    if (patterns.some((re) => re.test(body))) return kind
  }
  return 'other'
}

/**
 * The actionable kinds whose task is raised at HIGH priority — the two that
 * cost the customer their line if nobody gets to them. A completed port and a
 * PAC code are work; these are a deadline.
 */
export const HIGH_PRIORITY_KINDS = new Set(['payment_failed', 'payment_method_removed'])

/** The kinds that mean a person has something to do. */
export const ACTIONABLE = new Set(['port_in_complete', 'pac_issued', 'payment_failed', 'payment_method_removed'])

/**
 * Kinds that are never filed at all. An advert about a plan is not news about
 * a plan: filing it puts a row in the carrier queue that a person has to read
 * and dismiss, which is the queue training them to skim.
 */
export const NEVER_FILE = new Set(['marketing'])

/**
 * The task a message deserves, or null. Written as the thing to DO, because a
 * task titled "Port completed" is a notification and a task titled "check the
 * line is live" is work someone can finish.
 */
export function carrierMailTask(kind, { customerName = '', number = '', carrier = '' } = {}) {
  const who = customerName || number || 'a customer'
  if (kind === 'port_in_complete') {
    return `Port completed — check ${who}'s number is live${carrier ? ` on ${carrier}` : ''} and the SIM record has the right number`
  }
  if (kind === 'pac_issued') {
    return `PAC code issued for ${who} — they are moving to another network. Chase or close the plan`
  }
  if (kind === 'payment_method_removed') {
    return `No payment method on ${who}'s plan${carrier ? ` at ${carrier}` : ''} — the card has been taken off. Set one up before the next renewal or the line stops`
  }
  if (kind === 'payment_failed') {
    return `Payment problem on ${who}'s plan${carrier ? ` at ${carrier}` : ''} — the line stops if it is not fixed`
  }
  return null
}
