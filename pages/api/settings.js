// Pricing configuration — the WebConsole settings-editor pattern:
//   - EDIT ONLY: existing rows/keys only; this endpoint never creates or
//     deletes a key (a typo'd key must never silently break pricing)
//   - server-owned typed validation (money >= 0, percent 0-100, days >= 1)
//   - non-blocking structural warnings (cap below min) — the write happens,
//     the operator is told
// GET returns everything the app needs to price: rental_rates, damage_rates,
// and the settings key/value list.

import { withStaff } from '../../lib/auth.js'
import { db, tablesMode } from '../../lib/db.js'

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
  collect_later_late_pct: { type: 'percent', unit: '%' },
  collect_later_late_min: { type: 'money',   unit: '£' },
  multi_phone_discount_pct: { type: 'percent', unit: '%' },
  multi_sim_discount_pct:   { type: 'percent', unit: '%' },
}

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
          editable: !!SETTING_RULES[s.key],
          unit: SETTING_RULES[s.key]?.unit || '',
        })),
      })
    }

    if (req.method === 'PUT') {
      // Pricing-config writes are OWNER-ONLY (schema §9); helpers read only.
      if (req.staff && req.staff.role !== 'owner') {
        return res.status(403).json({ success: false, error: 'Changing settings is owner-only.' })
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
        const rule = SETTING_RULES[key]
        if (!rule) return res.status(400).json({ success: false, error: `"${key}" is not editable from the app.` })
        const v = validateTyped(rule.type, values?.numValue)
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

    return res.status(405).end()
  } catch (e) {
    console.error('[api/settings]', e)
    return res.status(500).json({ success: false, error: 'Storage error' })
  }
}

export default withStaff(handler)
