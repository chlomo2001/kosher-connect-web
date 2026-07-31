// Collision-safe record id (#45). Date.now() alone collides when two records
// are minted in the same millisecond — the unique legacy_id index then rejects
// one of them, so a customer created on the second till at the wrong moment
// simply fails to save.
//
// Timestamp + random digits keeps the id numeric-ish, which every existing
// legacy_id already is, while making a same-millisecond clash vanishingly
// unlikely. Six digits rather than three because a bulk import mints far more
// than two rows per millisecond, and the birthday bound bites fast: 3 digits
// gives an even-odds clash at ~37 rows in one millisecond, 6 digits at ~1,180.
//
// public/main.js mirrors this as uid() because the browser has no bundler;
// change both together. Tested in test/uid.test.mjs.

const RAND_DIGITS = 6;

export function uid(now = Date.now(), rnd = Math.random) {
  const max = 10 ** RAND_DIGITS;
  const suffix = Math.floor(rnd() * max).toString().padStart(RAND_DIGITS, '0');
  return String(now) + suffix;
}
