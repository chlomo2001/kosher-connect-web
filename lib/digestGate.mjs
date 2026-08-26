// Whether the morning digest can actually arrive — the one question
// pages/api/cron/digest.js answers before it does anything, extracted so
// /api/health can answer it too.
//
// This exists because of 26 Aug: the digest had been wired since 21 Aug,
// scheduled at 06:30, returning `{ success: true, skipped: 'no-recipient' }`
// every single morning — a green 200 for a feature that had never once run.
// Nothing anywhere said so. The probe reported email, SMS, Stripe and the
// vault; the schedule reported success; the owner reported no email. A gate
// that can hold a feature shut for a week has to be visible from the outside,
// so both callers now read the same function and Settings → Messaging shows
// its answer beside the other two channels.
//
// Kept as one shared module rather than duplicated in the probe: two copies of
// "is the digest on?" is exactly the second-answer-drifting-from-the-first
// that lib/dailyDigest.mjs's own header refuses to do for task derivation.
import { emailEnabled } from './email.js'

/** Who the digest is addressed to, or '' — the address itself, for the sender. */
export function digestRecipient() {
  return (process.env.DIGEST_TO || '').trim()
}

/**
 * 'on' | 'no-recipient' | 'email-not-configured'.
 *
 * Never the address — /api/health is public and unauthenticated, so this says
 * whether a recipient EXISTS, the same way `vault` says on/off and never the
 * key. The two non-'on' values are the exact strings the cron endpoint reports
 * as `skipped`, so the probe and the run agree word for word.
 */
export function digestStatus() {
  if (!digestRecipient()) return 'no-recipient'
  if (!emailEnabled) return 'email-not-configured'
  return 'on'
}
