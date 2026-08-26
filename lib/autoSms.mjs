// Automated customer reminders: what they say, and the four locks in front of
// them. Pure — no I/O, so every branch is testable without a network.
//
// Owner asked for this on 26 Aug, for two triggers only: a passport expiring
// before a trip, and a SIM about to renew. Both were chosen because the fact is
// objective and the message is welcome — the customer is glad to be told. Money
// chasing was deliberately left as a task for a human: this is a shop whose
// customers are neighbours, and an automatic chaser sent to somebody who paid
// cash yesterday costs more than the debt.
//
// FOUR LOCKS, and all four must be open before anything leaves:
//
//   1. No rule uses it.   `send_sms` is an action a rule has to be given. The
//                         one rule live today raises a task, as they all did.
//   2. AUTO_SMS_LIVE.     Unset → the sweep composes the message, records what
//                         it WOULD have sent, and sends nothing. This is the
//                         switch the owner flips, and it is deploy config
//                         rather than a database row, so it cannot be turned on
//                         by a mis-click in Settings.
//   3. Not a quiet day.   Never Shabbos, never yom tov (lib/yomTov.mjs).
//   4. SMS_LIVE.          The house-wide gate underneath, unchanged. Every
//                         message still goes through sendSms, so HOLD and TEST
//                         behave exactly as they do for a receipt.
//
// Lock 2 exists because of the digest: a feature that has never once run in
// production is a feature nobody has actually seen. The dry-run trail means the
// owner can read a week of what it WOULD have said before arming it.
import { isQuietDay } from './yomTov.mjs'

/** The actions a rule may carry. Anything else is refused at the API. */
export const RULE_ACTIONS = ['create_task', 'send_sms']

/** Which triggers may text a customer. The others raise tasks and only tasks. */
export const SMS_TRIGGERS = ['passport_in_days', 'sim_renewal_in_days']

const armed = () => String(process.env.AUTO_SMS_LIVE || '').trim().toLowerCase() === 'true'

/**
 * May this run send at all today? Returns why not, so the sweep can report it
 * rather than going quiet — the failure this codebase keeps meeting is not
 * things breaking, it is things not happening and saying nothing.
 */
export function autoSmsGate(today) {
  if (!armed()) return { send: false, why: 'not-armed' }
  if (isQuietDay(today)) return { send: false, why: 'quiet-day' }
  return { send: true, why: 'armed' }
}

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there'

// Straight quotes and no dashes fancier than a hyphen, on purpose: one
// non-GSM-7 character turns a 160-character text into a 70-character one and
// the shop pays for two segments to say the same thing.
const SHOP = 'Kosher Connect'
const PHONE = '0161 531 1386'

/**
 * The message, or null if this trigger does not text.
 *
 * `when` and `travel` arrive already formatted for reading (12 Sep), because
 * formatting a date is the caller's job and this module has no locale.
 */
export function autoSmsBody(trigger, { name, when, travel, provider } = {}) {
  const who = first(name)
  if (trigger === 'passport_in_days') {
    if (!when) return null
    const trip = travel ? `, before your trip ${travel}` : ''
    return `${SHOP}: hi ${who}, your passport expires ${when}${trip}. Airlines want 6 months left on it. Call ${PHONE}.`
  }
  if (trigger === 'sim_renewal_in_days') {
    if (!when) return null
    const net = provider ? `${provider} ` : ''
    return `${SHOP}: hi ${who}, your ${net}SIM renews ${when}. Nothing to do if that suits - call ${PHONE} to change or stop it.`
  }
  return null
}

/** One text per customer per event, for ever. The key the sweep claims. */
export const autoSmsKey = (ruleId, entityId) => `AUTOSMS-${ruleId}-${entityId}`
