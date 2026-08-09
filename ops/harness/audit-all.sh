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

run "staff app · modals open + geometry, 390px both themes" \
  bash -c 'for t in light dark; do node ops/harness/modals.mjs --width 390 --theme $t | tail -1; done'

run "public pages · render + RTL, en and he" \
  bash -c 'node ops/harness/public.mjs | tail -1'

run "public pages · touch targets (coarse pointer)" \
  bash -c 'node ops/harness/public.mjs --targets --width 390 | tail -3 | head -1'

run "public pages · contrast, both themes" \
  bash -c 'for t in light dark; do node ops/harness/public.mjs --contrast --theme $t | tail -3 | head -1; done'

run "dark rules written only once" \
  node ops/harness/theme-pairs.mjs

echo
[ "$fail" = 0 ] && echo "AUDIT: all checks reported clean." || echo "AUDIT: something needs a look — scroll up."
exit "$fail"
