// Which networks does this shop deal with, in which country — and which one
// is actually carrying the signal.
//
// Shloime, 27 August: "At mobile provider, select from dropdown, if country is
// USA, USMobile, Tello, other (asking what provider? and add as provider on
// list if not yet in system) if israel or other country, type in provider
// names, after entered once, it should be saved to dropdown list to this
// country. If USMobile selected, choose from additianal dropdown ATT, Verizon,
// or T-Mobile."
//
// Two ideas in there, and the second is the one that has been missing.
//
// A PROVIDER IS A COUNTRY'S PROVIDER. The list was global: every form offered
// Lebara, O2, Partner, Cellcom and US Mobile together, so putting a USA phone
// on the system meant reading past four British networks and three Israeli
// ones to reach the two that can possibly be right. Scoping the list to the
// country is not a nicety — it is the difference between picking and hunting.
//
// US MOBILE IS NOT A NETWORK. It is an MVNO reselling AT&T, Verizon and
// T-Mobile, and which of the three a line is on decides whether it has signal
// in a given town. The shop needs to record it; the schema already had a
// `sub_brand` column for it and nothing ever filled it in.
//
// LEARNING IS FREE. knownProviders() already builds its list out of the data —
// a provider used once is on a record, and the record is the memory. All this
// adds is the country each one was used in, so nothing new has to be stored
// and nothing can go stale against the rows it describes.

/** What the shop already deals with, before it has learnt anything. */
export const PROVIDER_SEEDS = {
  USA: ['US Mobile', 'Tello'],
  UK: ['Lebara', 'O2', 'Vodafone', 'EE', 'Three', 'giffgaff', 'Lycamobile'],
  Israel: ['HOT Mobile', 'Golan Telecom', 'Partner', 'Cellcom', '019 Mobile'],
  Canada: ['Lucky Mobile'],
  EU: [],
}

/** The three networks US Mobile actually runs on. */
export const US_MOBILE_SUB_BRANDS = ['AT&T', 'Verizon', 'T-Mobile']

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/[\s.]+/g, '')

/** "US Mobile", "usmobile", "U.S. Mobile" — all the same reseller. */
export const isUsMobile = (provider) => norm(provider) === 'usmobile'

/** A sub-brand question only makes sense for US Mobile. */
export const needsSubBrand = (provider) => isUsMobile(provider)

/**
 * The dropdown for a country: what the shop deals with there, plus everything
 * it has ever actually used there.
 *
 * `used` is [{ provider, country }] taken from the live SIMs and lines — no
 * separate list to maintain and nothing to keep in step. A name typed once is
 * in the list from the next render, which is the "saved to dropdown" half of
 * the ask, without a settings key that could disagree with the data.
 *
 * Case and spacing are folded so "us mobile" does not sit beside "US Mobile".
 * The first spelling seen wins, which means the seeds set the house spelling.
 */
export function providersForCountry(country, used = []) {
  const seen = new Map()
  const add = (n) => {
    const name = String(n ?? '').trim()
    if (name && !seen.has(norm(name))) seen.set(norm(name), name)
  }
  ;(PROVIDER_SEEDS[country] || []).forEach(add)
  used.filter((u) => !country || !u.country || u.country === country)
      .forEach((u) => add(u.provider))
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'en-GB'))
}

/**
 * What to do with what the form gave back.
 *
 * Returns { provider, subBrand, error }. A sub-brand on anything other than US
 * Mobile is dropped rather than stored: it would be a fact about a network the
 * line is not on, and a wrong fact is worse than a missing one.
 */
export function resolveProvider({ choice, typed, subBrand }, country) {
  const isOther = choice === '__other__'
  const provider = String((isOther ? typed : choice) ?? '').trim()
  if (!provider) {
    return { provider: '', subBrand: '', error: isOther ? 'Type the provider’s name.' : 'Choose a provider.' }
  }
  if (needsSubBrand(provider)) {
    const sb = String(subBrand ?? '').trim()
    if (!US_MOBILE_SUB_BRANDS.includes(sb)) {
      return { provider, subBrand: '', error: 'US Mobile runs on AT&T, Verizon or T-Mobile — say which.' }
    }
    return { provider, subBrand: sb, error: '' }
  }
  return { provider, subBrand: '', error: '' }
}
