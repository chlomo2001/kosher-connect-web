// Pricing configuration — the WebConsole settings-editor pattern:
//   - EDIT ONLY: existing rows/keys only; this endpoint never creates or
//     deletes a key (a typo'd key must never silently break pricing)
//   - server-owned typed validation (money >= 0, percent 0-100, days >= 1)
//   - non-blocking structural warnings (cap below min) — the write happens,
//     the operator is told
// GET returns everything the app needs to price: rental_rates, damage_rates,
// and the settings key/value list.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode, STORAGE_ERROR } from '../../lib/db.js'

// Typed rules for editable settings keys. A key not listed here is shown
// read-only and can never be written from the app.
const SETTING_RULES = {
  late_fee_per_day:       { type: 'money',   unit: '£/day' },
  vn_weekly:              { type: 'money',   unit: '£/week' },
  vn_per_30_days:         { type: 'money',   unit: '£/30 days' },
  sim_annual_fee:         { type: 'money',   unit: '£' },
  sim_activation_fee:     { type: 'money',   unit: '£' },
  sim_additional_fee:     { type: 'money',   unit: '£' },
  sim_service_fee:        { type: 'money',   unit: '£' },
  sim_replacement_fee:    { type: 'money',   unit: '£' },
  free_replacements_default: { type: 'count', unit: 'free' },
  online_min_charge:      { type: 'money',   unit: '£' },
  online_hourly_rate:     { type: 'money',   unit: '£/hr' },
  online_repeat_from:     { type: 'count',   unit: 'th unit +' },
  multi_phone_discount_pct: { type: 'percent', unit: '%' },
  multi_sim_discount_pct:   { type: 'percent', unit: '%' },
  multi_phone_discount_from: { type: 'count', unit: 'th phone' },
  multi_sim_discount_from:   { type: 'count', unit: 'th plan' },
  till_opening_float:        { type: 'money',   unit: '£' },
  sim_dd_surcharge_pct:      { type: 'percent', unit: '%' },
  sim_dd_surcharge_min:      { type: 'money',   unit: '£' },
  // Dashboard colour thresholds. Editable like a fee, but they change nothing
  // about what is charged — only when a number on a stat card stops being
  // neutral and starts being a warning. 'count' rejects 2.5 overdue rentals;
  // arrears is money because it is measured in pounds owed.
  dash_arrears_amber:        { type: 'money',   unit: '£ owed' },
  dash_arrears_red:          { type: 'money',   unit: '£ owed' },
  dash_overdue_amber:        { type: 'count',   unit: 'rentals' },
  dash_overdue_red:          { type: 'count',   unit: 'rentals' },
  dash_tasks_amber:          { type: 'count',   unit: 'tasks' },
  dash_tasks_red:            { type: 'count',   unit: 'tasks' },
  dash_phones_amber:         { type: 'count',   unit: 'phones left' },
  dash_phones_red:           { type: 'count',   unit: 'phones left' },
  dash_returning_amber:      { type: 'count',   unit: 'returns' },
  dash_returning_red:        { type: 'count',   unit: 'returns' },
}

// A key is editable if it's in the known-rules whitelist OR it's a custom_
// key the owner added from the app. Custom keys validate/display as money.
const settingEditable = (key) => !!SETTING_RULES[key] || String(key).startsWith('custom_')
const settingType = (key) => SETTING_RULES[key]?.type || 'money'

function validateTyped(type, raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return { ok: false, error: 'Value must be a number.' }
  if (type === 'percent' && (n < 0 || n > 100)) return { ok: false, error: 'Percent must be between 0 and 100.' }
  if (type === 'days' && (!Number.isInteger(n) || n < 1)) return { ok: false, error: 'Must be a whole number of days (≥ 1).' }
  if (type === 'count' && (!Number.isInteger(n) || n < 0)) return { ok: false, error: 'Must be a whole number (≥ 0).' }
  if ((type === 'money') && n < 0) return { ok: false, error: 'Amount cannot be negative.' }
  return { ok: true, value: n }
}

async function handler(req, res) {
  if (!tablesMode) {
    return res.status(503).json({ success: false, error: 'Settings need the relational data layer.' })
  }

  try {
    if (req.method === 'GET') {
      const [rates, damage, settings] = await Promise.all([
        db.select('rental_rates', 'order=country_code.asc'),
        db.select('damage_rates', 'order=country_code.asc'),
        db.select('settings', 'order=key.asc'),
      ])
      return res.json({
        success: true,
        rentalRates: rates.map(r => ({
          countryCode: r.country_code,
          displayName: r.display_name,
          ratePerDay: Number(r.rate_per_day),
          minCharge: Number(r.min_charge),
          cap: Number(r.cap),
          capPeriodDays: r.cap_period_days,
          vnWeekly: r.vn_weekly === null ? null : Number(r.vn_weekly),
          vnPer30Days: r.vn_per_30_days === null ? null : Number(r.vn_per_30_days),
          active: r.active,
        })),
        damageRates: damage.map(d => ({
          countryCode: d.country_code,
          phoneDamageLoss: Number(d.phone_damage_loss),
          chargerMissing: Number(d.charger_missing),
          simMissing: Number(d.sim_missing),
        })),
        settings: settings.map(s => ({
          key: s.key,
          numValue: s.num_value === null ? null : Number(s.num_value),
          textValue: s.text_value,
          description: s.description || '',
          editable: settingEditable(s.key),
          custom: s.key.startsWith('custom_'),
          unit: SETTING_RULES[s.key]?.unit || (s.key.startsWith('custom_') ? '£' : ''),
        })),
      })
    }

    // ── Add a new row to any of the three cards (admin-only) ──
    if (req.method === 'POST') {
      if (req.staff && req.staff.role !== 'owner') {
        return res.status(403).json({ success: false, error: 'Adding settings is admin-only.' })
      }
      const b = req.body || {}
      const t = b.table

      if (t === 'rental_rates') {
        const code = String(b.countryCode || '').trim()
        if (!code) return res.status(400).json({ success: false, error: 'Country code is required (e.g. FR).' })
        const exists = await db.select('rental_rates', `select=country_code&country_code=eq.${encodeURIComponent(code)}`)
        if (exists.length) return res.status(400).json({ success: false, error: `Country "${code}" already exists — edit it instead.` })
        const nums = {}
        for (const [f, col, type] of [['ratePerDay', 'rate_per_day', 'money'], ['minCharge', 'min_charge', 'money'],
          ['cap', 'cap', 'money'], ['capPeriodDays', 'cap_period_days', 'days'],
          ['vnWeekly', 'vn_weekly', 'money'], ['vnPer30Days', 'vn_per_30_days', 'money']]) {
          if (b[f] === undefined || b[f] === '') { nums[col] = col === 'cap_period_days' ? 30 : (col.startsWith('vn_') ? null : 0); continue }
          const v = validateTyped(type, b[f])
          if (!v.ok) return res.status(400).json({ success: false, error: `${f}: ${v.error}` })
          nums[col] = v.value
        }
        await db.insert('rental_rates', [{
          country_code: code,
          display_name: String(b.displayName || code).trim(),
          ...nums,
          active: true,
        }])
        return res.json({ success: true })
      }

      if (t === 'damage_rates') {
        const code = String(b.countryCode || '').trim()
        if (!code) return res.status(400).json({ success: false, error: 'Country code is required.' })
        const exists = await db.select('damage_rates', `select=country_code&country_code=eq.${encodeURIComponent(code)}`)
        if (exists.length) return res.status(400).json({ success: false, error: `Country "${code}" already exists — edit it instead.` })
        const cols = {}
        for (const [f, col] of [['phoneDamageLoss', 'phone_damage_loss'], ['chargerMissing', 'charger_missing'], ['simMissing', 'sim_missing']]) {
          const v = validateTyped('money', b[f] === undefined || b[f] === '' ? 0 : b[f])
          if (!v.ok) return res.status(400).json({ success: false, error: `${f}: ${v.error}` })
          cols[col] = v.value
        }
        await db.insert('damage_rates', [{ country_code: code, ...cols }])
        return res.json({ success: true })
      }

      if (t === 'settings') {
        // Custom owner-defined value. Prefixed 'custom_' so it's clearly not a
        // code-consumed key and stays editable/removable from the app.
        const raw = String(b.key || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        if (!raw) return res.status(400).json({ success: false, error: 'Give the setting a name.' })
        const key = raw.startsWith('custom_') ? raw : `custom_${raw}`
        const exists = await db.select('settings', `select=key&key=eq.${encodeURIComponent(key)}`)
        if (exists.length) return res.status(400).json({ success: false, error: `"${key}" already exists.` })
        const v = validateTyped('money', b.numValue === undefined || b.numValue === '' ? 0 : b.numValue)
        if (!v.ok) return res.status(400).json({ success: false, error: v.error })
        await db.insert('settings', [{
          key, num_value: v.value,
          description: String(b.description || '').trim() || 'Custom value',
        }])
        return res.json({ success: true })
      }

      return res.status(400).json({ success: false, error: 'table must be rental_rates, damage_rates, or settings.' })
    }

    if (req.method === 'PUT') {
      // Pricing-config writes are OWNER-ONLY (schema §9); helpers read only.
      if (req.staff && req.staff.role !== 'owner') {
        return res.status(403).json({ success: false, error: 'Changing settings is admin-only.' })
      }
      const { table, key, values } = req.body || {}
      const warnings = []

      // Helper-visibility list (text CSV, validated against known tabs).
      if (table === 'settings' && key === 'helper_tabs') {
        const ALL = ['dashboard', 'customers', 'rentals', 'sim', 'wallet',
          'bookings', 'repairs', 'services', 'shop', 'virtual', 'tasks', 'settings']
        const list = String(values?.textValue || '').split(',').map(s => s.trim()).filter(t => ALL.includes(t))
        if (!list.length) return res.status(400).json({ success: false, error: 'Helpers need at least one tab.' })
        await db.update('settings', `key=eq.helper_tabs`, {
          text_value: list.join(','),
          updated_at: new Date().toISOString(),
        })
        return res.json({ success: true, warnings })
      }

      // IVR / VN provider list (text CSV). Owner-managed so a new phone
      // provider can be added without a code change (feature #10). Names are
      // sanitised to a safe character set and de-duplicated case-insensitively.
      if (table === 'settings' && key === 'ivr_platforms') {
        const seen = new Set()
        const list = []
        for (const raw of String(values?.textValue || '').split(',')) {
          const name = raw.replace(/[^\w .+\-\/&]/g, '').trim().slice(0, 40).trim()
          if (!name) continue
          const k = name.toLowerCase()
          if (seen.has(k)) continue
          seen.add(k); list.push(name)
        }
        if (!list.length) return res.status(400).json({ success: false, error: 'Add at least one provider.' })
        if (list.length > 30) return res.status(400).json({ success: false, error: 'That is a lot of providers — keep it under 30.' })
        const updated = await db.update('settings', `key=eq.ivr_platforms`, {
          text_value: list.join(','),
          updated_at: new Date().toISOString(),
        })
        if (!updated.length) {
          await db.insert('settings', [{
            key: 'ivr_platforms',
            text_value: list.join(','),
            description: 'IVR / phone providers a virtual number can use (owner-managed)',
          }])
        }
        return res.json({ success: true, warnings, list })
      }

      // Rental phone pools (JSON). A pool is one carrier plan shared by
      // several lines, activated for a window: [{name, from, till}]. The
      // client mirrors the window onto member phones' poolExpiry — the field
      // all rental availability/ranking logic already reads.
      if (table === 'settings' && key === 'rental_pools') {
        let pools
        try { pools = JSON.parse(String(values?.textValue || '[]')) } catch { pools = null }
        if (!Array.isArray(pools)) return res.status(400).json({ success: false, error: 'Bad pool list.' })
        if (pools.length > 30) return res.status(400).json({ success: false, error: 'That is a lot of pools — keep it under 30.' })
        const seen = new Set()
        const clean = []
        const iso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : ''
        for (const p of pools) {
          const name = String(p?.name || '').replace(/[^\w .+\-\/&]/g, '').trim().slice(0, 40)
          if (!name) continue
          const k = name.toLowerCase()
          if (seen.has(k)) continue
          seen.add(k)
          clean.push({ name, from: iso(p?.from), till: iso(p?.till) })
        }
        const text = JSON.stringify(clean)
        const updated = await db.update('settings', `key=eq.rental_pools`, {
          text_value: text,
          updated_at: new Date().toISOString(),
        })
        if (!updated.length) {
          await db.insert('settings', [{
            key: 'rental_pools',
            text_value: text,
            description: 'Rental phone pools — name + activation window (owner-managed)',
          }])
        }
        return res.json({ success: true, warnings, pools: clean })
      }

      // Shop opening hours — free text, shown on the public welcome page.
      // Owner edits it in Settings; no code change needed to update the site.
      if (table === 'settings' && key === 'opening_hours') {
        const text = String(values?.textValue || '').replace(/\s+/g, ' ').trim().slice(0, 120)
        if (!text) return res.status(400).json({ success: false, error: 'Enter the opening hours.' })
        const updated = await db.update('settings', `key=eq.opening_hours`, {
          text_value: text,
          updated_at: new Date().toISOString(),
        })
        if (!updated.length) {
          await db.insert('settings', [{
            key: 'opening_hours',
            text_value: text,
            description: 'Shop opening hours shown on the public welcome page',
          }])
        }
        return res.json({ success: true, warnings })
      }

      if (table === 'rental_rates') {
        const patch = {}
        for (const [field, type] of [['ratePerDay', 'money'], ['minCharge', 'money'], ['cap', 'money'], ['capPeriodDays', 'days'], ['vnWeekly', 'money'], ['vnPer30Days', 'money']]) {
          if (values?.[field] === undefined) continue
          const v = validateTyped(type, values[field])
          if (!v.ok) return res.status(400).json({ success: false, error: `${field}: ${v.error}` })
          patch[{
            ratePerDay: 'rate_per_day', minCharge: 'min_charge', cap: 'cap',
            capPeriodDays: 'cap_period_days', vnWeekly: 'vn_weekly', vnPer30Days: 'vn_per_30_days',
          }[field]] = v.value
        }
        if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })
        patch.updated_at = new Date().toISOString()
        const updated = await db.update('rental_rates', `country_code=eq.${encodeURIComponent(String(key))}`, patch)
        if (!updated.length) return res.status(404).json({ success: false, error: `Unknown country "${key}" — adding rates is not allowed here.` })
        const row = updated[0]
        if (Number(row.cap) < Number(row.min_charge)) {
          warnings.push(`Cap £${row.cap} is below Min £${row.min_charge} — the minimum will always bind.`)
        }
        if (Number(row.rate_per_day) === 0) warnings.push('Rate set to £0 — rentals for this country will be free.')
        return res.json({ success: true, warnings })
      }

      if (table === 'damage_rates') {
        const patch = {}
        for (const [field, col] of [['phoneDamageLoss', 'phone_damage_loss'], ['chargerMissing', 'charger_missing'], ['simMissing', 'sim_missing']]) {
          if (values?.[field] === undefined) continue
          const v = validateTyped('money', values[field])
          if (!v.ok) return res.status(400).json({ success: false, error: `${field}: ${v.error}` })
          patch[col] = v.value
        }
        if (!Object.keys(patch).length) return res.status(400).json({ success: false, error: 'Nothing to update.' })
        patch.updated_at = new Date().toISOString()
        const updated = await db.update('damage_rates', `country_code=eq.${encodeURIComponent(String(key))}`, patch)
        if (!updated.length) return res.status(404).json({ success: false, error: `Unknown country "${key}".` })
        return res.json({ success: true, warnings })
      }

      if (table === 'settings') {
        if (!settingEditable(key)) return res.status(400).json({ success: false, error: `"${key}" is not editable from the app.` })
        const v = validateTyped(settingType(key), values?.numValue)
        if (!v.ok) return res.status(400).json({ success: false, error: v.error })
        if (v.value === 0) warnings.push('Set to 0 — this zeroes/disables this charge.')
        const updated = await db.update('settings', `key=eq.${encodeURIComponent(String(key))}`, {
          num_value: v.value,
          updated_at: new Date().toISOString(),
        })
        if (!updated.length) return res.status(404).json({ success: false, error: `Key "${key}" does not exist — adding keys is not allowed.` })
        return res.json({ success: true, warnings })
      }

      return res.status(400).json({ success: false, error: 'table must be rental_rates, damage_rates, or settings.' })
    }

    // ── Remove a row (admin-only). Custom settings + country rate rows only;
    // built-in setting keys are never deletable (code reads them by name). ──
    if (req.method === 'DELETE') {
      if (req.staff && req.staff.role !== 'owner') {
        return res.status(403).json({ success: false, error: 'Removing settings is admin-only.' })
      }
      const table = String(req.query.table || '')
      const key = String(req.query.key || '')
      if (!key) return res.status(400).json({ success: false, error: 'Nothing to remove.' })
      if (table === 'rental_rates') {
        await db.delete('rental_rates', `country_code=eq.${encodeURIComponent(key)}`)
        await db.delete('damage_rates', `country_code=eq.${encodeURIComponent(key)}`).catch(() => {})
        return res.json({ success: true })
      }
      if (table === 'damage_rates') {
        await db.delete('damage_rates', `country_code=eq.${encodeURIComponent(key)}`)
        return res.json({ success: true })
      }
      if (table === 'settings') {
        if (!key.startsWith('custom_')) {
          return res.status(400).json({ success: false, error: 'Only custom values can be removed; built-in fees are edit-only.' })
        }
        await db.delete('settings', `key=eq.${encodeURIComponent(key)}`)
        return res.json({ success: true })
      }
      return res.status(400).json({ success: false, error: 'Unknown table.' })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[api/settings]', e)
    return res.status(500).json({ success: false, error: STORAGE_ERROR })
  }
}

export default withStaff(handler)
