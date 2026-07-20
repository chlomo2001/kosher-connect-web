// Accounts & subscriptions register — owner-only CRUD over business_accounts.
//
//   GET               → { success, accounts: [...] }  (credential NEVER included,
//                        only hasCred so the UI can show a reveal button)
//   POST { op:'save', id?, name, category, url, loginEmail, credential?,
//          monthlyCost, renewalDate, notes }
//                        credential '' = leave as is; the literal string
//                        '-' clears it; anything else replaces it (encrypted).
//   POST { op:'reveal', id }   → { success, credential }   (decrypt on demand)
//   POST { op:'retire', id }   → soft-deactivate (kept for history)
//
// Credentials are secretbox ciphertext at rest; with no SIM_CRED_KEY set the
// save still works but the credential field is refused rather than stored
// as plaintext (fail-closed, same policy as SIM carrier logins).

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'
import { encryptSecret, decryptSecret, secretsEnabled } from '../../lib/secretbox.js'

const CATEGORIES = ['infrastructure', 'telecom', 'ivr', 'email', 'finance', 'other']

const shape = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  url: r.url || '',
  loginEmail: r.login_email || '',
  hasCred: !!r.cred_cipher,
  monthlyCost: r.monthly_cost === null ? null : Number(r.monthly_cost),
  renewalDate: r.renewal_date || null,
  notes: r.notes || '',
  active: r.active,
})

async function handler(req, res) {
  if (!tablesMode) return res.status(503).json({ success: false, error: 'Needs the relational data layer.' })
  if (req.staff && req.staff.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Admin only.' })
  }

  if (req.method === 'GET') {
    const rows = await db.select('business_accounts', 'select=*&order=category.asc,name.asc')
    return res.json({ success: true, accounts: rows.map(shape), credVault: secretsEnabled })
  }

  if (req.method !== 'POST') return res.status(405).end()
  const b = req.body || {}

  try {
    if (b.op === 'reveal') {
      const rows = await db.select('business_accounts', `select=cred_cipher&id=eq.${encodeURIComponent(String(b.id))}`)
      if (!rows.length) return res.status(404).json({ success: false, error: 'Not found.' })
      const plain = decryptSecret(rows[0].cred_cipher)
      if (plain == null) return res.status(400).json({ success: false, error: 'No credential stored (or the vault key is missing).' })
      return res.json({ success: true, credential: plain })
    }

    if (b.op === 'retire') {
      await db.update('business_accounts', `id=eq.${encodeURIComponent(String(b.id))}`, {
        active: false, updated_at: new Date().toISOString(),
      })
      return res.json({ success: true })
    }

    if (b.op === 'save') {
      const name = String(b.name || '').trim().slice(0, 80)
      if (!name) return res.status(400).json({ success: false, error: 'Give the account a name.' })
      const category = CATEGORIES.includes(b.category) ? b.category : 'other'
      const cost = b.monthlyCost === '' || b.monthlyCost == null ? null : Number(b.monthlyCost)
      if (cost !== null && !(Number.isFinite(cost) && cost >= 0)) {
        return res.status(400).json({ success: false, error: 'Monthly cost must be a number (or empty).' })
      }
      const renewal = String(b.renewalDate || '').slice(0, 10)
      const row = {
        name,
        category,
        url: String(b.url || '').trim().slice(0, 300) || null,
        login_email: String(b.loginEmail || '').trim().slice(0, 200) || null,
        monthly_cost: cost,
        renewal_date: /^\d{4}-\d{2}-\d{2}$/.test(renewal) ? renewal : null,
        notes: String(b.notes || '').trim().slice(0, 1000) || null,
        updated_at: new Date().toISOString(),
      }

      // Credential handling: '' = untouched, '-' = clear, else replace.
      const cred = b.credential
      if (cred != null && cred !== '') {
        if (cred === '-') {
          row.cred_cipher = null
        } else {
          if (!secretsEnabled) {
            return res.status(400).json({ success: false, error: 'Credential vault key not configured — credential NOT saved. Set SIM_CRED_KEY first.' })
          }
          row.cred_cipher = encryptSecret(String(cred))
        }
      }

      if (b.id) {
        await db.update('business_accounts', `id=eq.${encodeURIComponent(String(b.id))}`, row)
        return res.json({ success: true, id: b.id })
      }
      const inserted = await db.insert('business_accounts', [{ ...row, active: true }])
      return res.json({ success: true, id: inserted[0]?.id })
    }

    return res.status(400).json({ success: false, error: 'Unknown op.' })
  } catch (e) {
    console.error('[api/business-accounts]', e)
    return res.status(500).json({ success: false, error: 'Could not save.' })
  }
}

export default withStaff(handler)
