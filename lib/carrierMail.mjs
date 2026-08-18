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
  ['payment_failed', 'Payment problem', [
    /payment\s+(has\s+)?(failed|was\s+declined|unsuccessful)/i,
    /we\s+(could\s*n[o']t|were\s+unable\s+to)\s+(take|collect|process)\s+(your\s+)?payment/i,
    /update\s+your\s+(pool'?s\s+)?(credit\s+)?card/i,
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

/** The kinds that mean a person has something to do. */
export const ACTIONABLE = new Set(['port_in_complete', 'pac_issued', 'payment_failed'])

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
  if (kind === 'payment_failed') {
    return `Payment problem on ${who}'s plan${carrier ? ` at ${carrier}` : ''} — the line stops if it is not fixed`
  }
  return null
}
