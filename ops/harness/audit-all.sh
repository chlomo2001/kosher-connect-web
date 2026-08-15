#!/usr/bin/env bash
# Every offline UI check, in one go. Read ops/harness/README.md before acting on
# anything it prints — two of these have limits worth knowing (widths on the
# public pages are font-dependent; a finding is only as good as seed.json).
#
#   bash ops/harness/audit-all.sh
#
# Needs playwright-core. It is not in package.json on purpose: this is a
# development aid, not something the product builds against. Install it for a
# session with:  npm i --no-save playwright-core
set -u
cd "$(dirname "$0")/../.."

if ! node -e "require('playwright-core')" 2>/dev/null; then
  echo "playwright-core is not installed — run: npm i --no-save playwright-core"
  exit 2
fi

fail=0
run() { echo; echo "──── $1"; shift; "$@" || fail=1; }

run "staff app · sideways overflow, every tab, every width" \
  bash -c 'for w in 320 390 768 1280 1440; do node ops/harness/render.mjs --audit --width $w | tail -1; done'

run "staff app · contrast, both themes" \
  bash -c 'for t in light dark; do node ops/harness/render.mjs --contrast --theme $t --width 1280 | tail -1; done'

run "staff app · touch targets (coarse pointer)" \
  bash -c 'node ops/harness/render.mjs --targets --width 390 | tail -1'

# Focus visibility. Everything else here measures geometry or colour; this
# measures a STATE — focus each keyboard stop and check the screen changes.
# Its first run found three kinds that painted nothing at all, so it earns its
# 25 seconds. Both themes: the ring that works on ivory vanished on the navy
# rail, and only a dark run would have caught that.
run "staff app · every keyboard stop shows itself" \
  bash -c 'for t in light dark; do node ops/harness/focus.mjs --theme $t | tail -1; done'

run "staff app · modals open + geometry, 390px both themes" \
  bash -c 'for t in light dark; do node ops/harness/modals.mjs --width 390 --theme $t | tail -1; done'

# 320 as well: the modal sweep had only ever run at 390, and 320 is where a
# footer with a left action and a Cancel+Save group first runs out of room.
run "staff app · modals at 320px" \
  bash -c 'node ops/harness/modals.mjs --width 320 --theme light | tail -1'

# Simple Mode. The third dimension beside width and theme, and the one most
# likely to break a layout: every screen here was laid out against 13px body
# copy and `largest` is 17px. It found Manage Rental's Save button 53px off a
# 390px screen, and nothing had ever run it over the tabs.
#
# The MODAL sweep at largest is deliberately not wired in here yet: the till
# still overflows at 320px from `large` upward (a row of payment-method buttons
# that will not wrap), and until that is fixed adding it would paint this whole
# report red every night and hide the next real finding. Run it by hand:
#   node ops/harness/modals.mjs --width 320 --theme light --fs largest
#
# 320 × largest IS wired in, for the tabs: it is the hardest corner of the grid
# (narrowest screen, biggest type) and the tabs pass it today, so it can only
# ever go red on a regression. The till's problem lives one layer down, in the
# modal sweep, so keeping that one out does not cost this.
run "staff app · Simple Mode text sizes, every tab" \
  bash -c 'for f in large largest; do node ops/harness/render.mjs --audit --width 390 --fs $f | tail -1; done
           node ops/harness/render.mjs --audit --width 320 --fs largest | tail -1
           node ops/harness/render.mjs --targets --width 390 --fs largest | tail -1
           node ops/harness/render.mjs --contrast --theme dark --width 1280 --fs largest | tail -1'

# 320 as well as the default 390/1280: the portal's top bar was overflowing at
# 320 in English and up to 375 in Hebrew, and no sweep had ever run below 390.
run "public pages · render + RTL, en and he" \
  bash -c 'node ops/harness/public.mjs --width 320,390,1280 | tail -1'

run "public pages · touch targets (coarse pointer)" \
  bash -c 'node ops/harness/public.mjs --targets --width 390 | tail -3 | head -1'

# All three states a public page can be painted in. dark-os is not a duplicate
# of dark: /welcome and the legal shell carry their own prefers-color-scheme
# palettes, so it exercises a different set of rules entirely.
run "public pages · contrast, every theme state" \
  bash -c 'for t in light dark dark-os; do node ops/harness/public.mjs --contrast --theme $t | tail -3 | head -1; done'

run "dark rules written only once" \
  node ops/harness/theme-pairs.mjs

echo
[ "$fail" = 0 ] && echo "AUDIT: all checks reported clean." || echo "AUDIT: something needs a look — scroll up."
exit "$fail"
