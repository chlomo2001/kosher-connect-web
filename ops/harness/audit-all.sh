#!/usr/bin/env bash
# Every offline UI check, in one go. Read ops/harness/README.md before acting on
# anything it prints — two of these have limits worth knowing (widths on the
# public pages are font-dependent; a finding is only as good as seed.json).
#
#   bash ops/harness/audit-all.sh            the full sweep — nightly
#   bash ops/harness/audit-all.sh --smoke    ~90 seconds, before a ship
#
# TWO SPEEDS, and the reason for them. The full sweep is 31 checks and 37
# browser launches, 25-30 minutes. It was being run inline in every session and
# before every ship, which is how a check that is worth having becomes a check
# people route around. From 24 Aug it runs ONCE A NIGHT (the "KC nightly full
# audit" routine, 01:00 London, ahead of the 03:00 UX loop so that loop starts
# with the night's findings), and a ship runs --smoke instead.
#
# --smoke is not a lighter version of the same thing: it is the subset that has
# actually caught regressions on the way out of the door — a tab that overflows,
# a dialog that stopped opening, a control that lost its name, a public page
# that broke, a dark rule written only once. It is a subset in the strict
# sense, so the full sweep does not run it separately; every line below already
# covers it at more widths and both themes.
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
smoke=0
[ "${1:-}" = "--smoke" ] && smoke=1
# Names the check that went red. "AUDIT: something needs a look — scroll up" is
# no help when the thing to look for is an exit code rather than a printed ✗.
run() {
  local what="$1"; echo; echo "──── $what"; shift
  if ! "$@"; then fail=1; echo "✗ FAILED — $what"; fi
}

# Every check below is piped through `tail -1` to keep the log readable, and a
# pipeline's exit status is the LAST command's — so `tail` was reporting success
# on behalf of a check that had just failed. On 17 Aug this printed "1 tab(s)
# overflow at 320px / text largest" and then "AUDIT: all checks reported clean".
#
# One trap comes with it: `… | tail -3 | head -1` now FAILS even when nothing is
# wrong, because `head` closes the pipe after one line and `tail` dies of
# SIGPIPE, which pipefail duly reports. `sed -n 1p` reads its input to the end
# and prints the same line. That cost a sweep to find, which is the point —
# before the exit codes were wired up it could not have been found at all.
#
# pipefail has to be set inside the shell each `run` line starts, not out here,
# and `-e` with it: several of these lines run four checks in a row, and without
# it only the last one's status would survive. So every check below runs under
# `bash -eo pipefail -c` — a red check now stops its group and fails the run.

if [ "$smoke" = 1 ]; then
  run "smoke · every tab renders and none overflows at 390px" \
    bash -eo pipefail -c 'node ops/harness/render.mjs --audit --width 390 | tail -1'
  run "smoke · every dialog still opens, and fits at 390px" \
    bash -eo pipefail -c 'node ops/harness/modals.mjs --width 390 --theme light | tail -1'
  run "smoke · every public page renders, en and he" \
    bash -eo pipefail -c 'node ops/harness/public.mjs --width 390 | grep -v "^✓ "'
  run "smoke · every control says what it is" \
    bash -eo pipefail -c 'node ops/harness/names.mjs | tail -1'
  run "smoke · contrast in dark" \
    bash -eo pipefail -c 'node ops/harness/render.mjs --contrast --theme dark --width 1280 | tail -1'
  run "smoke · dark rules written only once" \
    node ops/harness/theme-pairs.mjs
  # The icon set, and the three ways converting 96 emoji to CSS masks actually
  # broke: a mask that resolves to none, markup landing in an escaped sink and
  # showing as literal text, and markup landing in an ATTRIBUTE and tearing the
  # row apart — which is the one that reached the owner's screen on 24 Aug.
  run "smoke · icons paint, and nothing leaked into a sink" \
    bash -eo pipefail -c 'node ops/harness/icons.mjs | tail -1'

  # A headline number that is also a filter button must equal the list it opens.
  # On 25 Aug the Rentals tile counted rentals stored as 'active' while the list
  # filtered on COMPUTED status, and the banner counted uncollected reservations
  # as "phones overdue back" — one screen, three answers to "how many phones are
  # with customers". Four seconds, and green on arrival, so it goes in.
  run "smoke · every headline matches the list it opens" \
    bash -eo pipefail -c 'node ops/harness/counts.mjs | tail -1'

  # The brand standard, checked against the code rather than admired. Plate 11
  # of the PDF argues that a standard nobody enforces drifts within a month; it
  # would be a poor document if that did not apply to itself. Static, well under
  # a second. First run found 25 stat labels in Title Case against plate 06's
  # sentence-case rule — invisible on screen because .stat-label is uppercased,
  # which is exactly how it drifted.
  run "smoke · the brand standard still describes this app" \
    bash -eo pipefail -c 'node ops/harness/brand.mjs | tail -1'
  echo
  [ "$fail" = 0 ] && echo "SMOKE: clean — the full sweep still runs tonight." \
                  || echo "SMOKE: something needs a look — scroll up."
  exit "$fail"
fi

run "staff app · sideways overflow, every tab, every width" \
  bash -eo pipefail -c 'for w in 320 390 768 1280 1440; do node ops/harness/render.mjs --audit --width $w | tail -1; done'

run "staff app · contrast, both themes" \
  bash -eo pipefail -c 'for t in light dark; do node ops/harness/render.mjs --contrast --theme $t --width 1280 | tail -1; done'

run "staff app · touch targets (coarse pointer)" \
  bash -eo pipefail -c 'node ops/harness/render.mjs --targets --width 390 | tail -1'

# Every everyday job still reachable by navigating AND by the palette. This sat
# unwired until 25 Aug and printed a broken route nobody read — the break was in
# its own route table, which is what an unrun check earns you. Sixteen browser
# runs, so it is a nightly line and not a smoke one.
run "staff app · every job still reachable, navigate and palette" \
  bash -eo pipefail -c 'node ops/harness/paths.mjs | tail -1'

# Day one. Every collection empty is a real state — a new shop, and any search
# that matched nothing — and the seed is deliberately full, so no sweep could
# reach it. An empty tab must still render (the audit fails a tab that painted
# nothing) and must not overflow: an empty state is usually a centred block,
# which is exactly the shape that escapes a narrow column when nobody looks.
run "staff app · day one, every collection empty" \
  bash -eo pipefail -c 'node ops/harness/render.mjs --audit --empty --width 390 | tail -1'

# …and the other end of the same axis. The seed's names are short and tidy
# ("Menachem Adler", "Nokia 105"); the shop's are "Yakov Mendl Bindinger
# (TomTom)" and "Tomtom S/N ZO1357I02581". Stretching every string to something
# the shop plausibly holds is how a cell that only fits neat data says so.
run "staff app · real-length names and models" \
  bash -eo pipefail -c 'for w in 320 390; do node ops/harness/render.mjs --audit --long --width $w | tail -1; done'

# Focus visibility. Everything else here measures geometry or colour; this
# measures a STATE — focus each keyboard stop and check the screen changes.
# Its first run found three kinds that painted nothing at all, so it earns its
# 25 seconds. Both themes: the ring that works on ivory vanished on the navy
# rail, and only a dark run would have caught that.
run "staff app · every keyboard stop shows itself" \
  bash -eo pipefail -c 'for t in light dark; do node ops/harness/focus.mjs --theme $t | tail -1; done'

# The other invisible-in-one-render failure. Simple Mode looks fine at Standard
# and fine-ish at Largest; only a DIFF of the two shows a line that stayed 15px
# while its neighbours grew 30%. `body` was that line for every element which
# never set a size of its own, through nine Simple Mode sweeps.
run "staff app · Simple Mode reaches every word" \
  bash -eo pipefail -c 'node ops/harness/textscale.mjs | tail -1'

# The 24×24 sweep proves you can HIT a control and the contrast sweep proves you
# can SEE it. This asks whether it says what it is.
run "staff app · every control says what it is" \
  bash -eo pipefail -c 'node ops/harness/names.mjs | tail -1'

# names.mjs asks whether a control HAS a label. This asks whether you can read
# it: a placeholder or a selected option cut off by its own box. Both sizes,
# because every one of the first seven was clean at standard and broken at
# largest — pixel widths against text that grows 30%.
# All four corners, 390 × largest included — the hardest one, and green since
# the owner settled the wording on 18 Aug. The verb came off the two search
# placeholders (the magnifier already says it) and Kol Torah's example was kept
# as it is, which is why clipped.mjs knows the difference between a label and an
# example.
run "staff app · no control hides its own label" \
  bash -eo pipefail -c 'for w in 1280 390; do for f in standard largest; do node ops/harness/clipped.mjs --width $w --fs $f | tail -1; done; done'

# The gap every other check here leaves. They all measure the PAGE; this
# measures the BOX. A settings heading ran 7px past its own card at 320 in
# Simple Mode and eight sweeps had passed over it, because the page did not
# scroll and the control was readable — it just looked broken (owner, 19 Aug).
# 1750 because that is where Shop splits into two columns, and until 26 Aug no
# sweep here had ever run above 1280 — so the only layout in the app that needs
# a wide monitor to appear at all had never been measured. It was wrong: the
# split was sized at Standard with 2px to spare, and at `largest` the Sell
# button on every stock row sat 49px past the edge of its card.
run "staff app · nothing painted outside its card" \
  bash -eo pipefail -c 'for w in 320 390 1280 1750; do node ops/harness/cardfit.mjs --width $w --fs largest | tail -1; done
           node ops/harness/cardfit.mjs --width 390 --fs standard | tail -1'

run "staff app · modals open + geometry, 390px both themes" \
  bash -eo pipefail -c 'for t in light dark; do node ops/harness/modals.mjs --width 390 --theme $t | tail -1; done'

# --contrast, which this sweep had NEVER passed. modals.mjs measures contrast
# while the dialog is actually on screen, and the comment beside that code says
# why it exists: the page-level --contrast sweep renders a static page, so every
# dialog, the palette and the toasts were never measured at all, and that is how
# a 2.92:1 error toast survived every clean audit. The measurement was written,
# and then nothing ran it — three modal lines here and not one of them asked for
# it. First run found two: the bank reconciliation's confidence badges at 4.32:1
# and 4.41:1 against the 4.5 an 11px label needs.
#
# Both themes, because a tint that passes on white can fail on the dark surface
# and the dark palette is a different set of tokens, not a filter over the light
# one.
run "staff app · modals, contrast on the live dialog" \
  bash -eo pipefail -c 'for t in light dark; do node ops/harness/modals.mjs --width 390 --contrast --theme $t | grep -v "^✓ "; done'

# 320 as well: the modal sweep had only ever run at 390, and 320 is where a
# footer with a left action and a Cancel+Save group first runs out of room.
run "staff app · modals at 320px" \
  bash -eo pipefail -c 'node ops/harness/modals.mjs --width 320 --theme light | tail -1'

# Simple Mode. The third dimension beside width and theme, and the one most
# likely to break a layout: every screen here was laid out against 13px body
# copy and `largest` is 17px. It found Manage Rental's Save button 53px off a
# 390px screen, and nothing had ever run it over the tabs.
#
# 320 × largest is the hardest corner of the grid — narrowest screen, biggest
# type — and both sweeps pass it today, so from here they can only go red on a
# regression. The MODAL half was held out until 08-17 because the till really
# did overflow there (a row of payment-method buttons that would not wrap,
# taking .pos-main, .pos-cats and .pos-tiles with it); .pos-methods now wraps,
# the sweep is clean, and it is wired in below.
run "staff app · modals at 320px, text largest" \
  bash -eo pipefail -c 'node ops/harness/modals.mjs --width 320 --theme light --fs largest | tail -1'

# The two controls that are the same everywhere or nowhere: one customer picker
# built by one function (11 places), and the help timer's always-on-top window,
# which has its own document and its own copies of the buttons and would
# otherwise rot unwatched.
run "one customer picker, everywhere" \
  bash -eo pipefail -c 'node ops/harness/picker.mjs | tail -3'

run "help timer · floating window, both themes" \
  bash -eo pipefail -c 'node ops/harness/popout.mjs | tail -3'

run "loading · no flash, and the ghost reaches the fold" \
  bash -eo pipefail -c 'node ops/harness/loading.mjs | tail -3'

# The next action on every screen (B2). Not geometry: it presses every action
# and checks it lands on the right tab with the keyboard moved with it.
run "every screen names its next action, and every action lands" \
  bash -eo pipefail -c 'for w in 390 1280; do node ops/harness/nextaction.mjs --width $w | tail -1; done
           node ops/harness/nextaction.mjs --width 390 --theme dark --fs largest | tail -1'

# Two customer cards at once (owner item 22). The owner chose both cards fully
# editable, so this checks the thing that choice creates: each card's buttons
# carry its OWN customer's id, and the two do not overlap.
run "two customer cards · beside each other, each writing to its own customer" \
  bash -eo pipefail -c 'node ops/harness/twocards.mjs | tail -2'

# Money wording (C1). The unit tests prove the vocabulary is right and the
# mirror test proves the browser copy agrees; neither proves the SCREENS call
# either of them. This reads what a person reads — and its first run found the
# customers list saying "£45.00 debt" in a vocabulary of its own.
run "money · one vocabulary on screen, and an unknown balance refused" \
  bash -eo pipefail -c 'node ops/harness/money.mjs | tail -1
           node ops/harness/money.mjs --width 390 --theme dark | tail -1'

# The customer record (owner, 20 Aug). Two halves that only fail as a pair: on
# the page every service opens something and the finished ones are folded; on
# the card it is still the compact badge row, because two cards fit side by
# side only while the card stays small.
run "customer record · every service opens, and the card stayed a card" \
  bash -eo pipefail -c 'node ops/harness/record.mjs | tail -1
           node ops/harness/record.mjs --width 390 --theme dark | tail -1'

run "dialogs · eight grips, snap, and plain on a phone" \
  bash -eo pipefail -c 'node ops/harness/window.mjs | tail -3'

# The handover the unit tests cannot see: fields read out of an airline email
# have to arrive in the boxes someone presses save on, and a euro price must
# never land in the pounds box.
run "tickets from email · into the booking form" \
  bash -eo pipefail -c 'node ops/harness/tickets.mjs | tail -3'

run "staff app · Simple Mode text sizes, every tab" \
  bash -eo pipefail -c 'for f in large largest; do node ops/harness/render.mjs --audit --width 390 --fs $f | tail -1; done
           node ops/harness/render.mjs --audit --width 320 --fs largest | tail -1
           node ops/harness/render.mjs --targets --width 390 --fs largest | tail -1
           node ops/harness/render.mjs --audit --width 1750 --fs largest | tail -1
           node ops/harness/render.mjs --contrast --theme dark --width 1280 --fs largest | tail -1'

# 320 as well as the default 390/1280: the portal's top bar was overflowing at
# 320 in English and up to 375 in Hebrew, and no sweep had ever run below 390.
# `tail -3 | sed -n 1p` picked ONE line out of the tail, and when a check found
# more than one thing that line was whichever failure happened to land third
# from the end. On 21 Aug the touch-target check found the /manual contents
# links short in BOTH languages and this printed only the Hebrew one — half a
# finding reads as a smaller problem than it is. Drop the per-page ✓ lines
# instead of counting from the end: every ✗ survives, the verdict survives, and
# the log stays about as short. (grep -v always has the verdict line to print,
# so it cannot exit 1 on a clean run and invent a failure under pipefail.)
run "public pages · render + RTL, en and he" \
  bash -eo pipefail -c 'node ops/harness/public.mjs --width 320,390,1280 | grep -v "^✓ "'

run "public pages · touch targets (coarse pointer)" \
  bash -eo pipefail -c 'node ops/harness/public.mjs --targets --width 390 | grep -v "^✓ "'

# All three states a public page can be painted in. dark-os is not a duplicate
# of dark: /welcome and the legal shell carry their own prefers-color-scheme
# palettes, so it exercises a different set of rules entirely.
run "public pages · contrast, every theme state" \
  bash -eo pipefail -c 'for t in light dark dark-os; do node ops/harness/public.mjs --contrast --theme $t | grep -v "^✓ "; done'

# The structure a screen reader navigates by — landmarks, heading order,
# accessible names, alt text, and the skip link. Every other line here measures
# what a sighted mouse user meets; this measures what is left when the screen is
# not being looked at. Written 26 Aug after auditing it by hand once, and that
# pass found the app's only Level A failure (2.4.1: no skip link anywhere, nine
# of thirteen public pages with no <main>), two heading-level skips — each of
# them hiding a CSS rule that had never matched anything — and /login with no
# <h1> at all. None of it was visible to a check already running here.
#
# Both languages: the Hebrew pages are a different tree, not a filter over the
# English one, and the skip link is a separate string in each.
#
# Nightly and not smoke, on this file's own rule: --smoke is the subset that has
# actually caught something on the way out of the door, and this has never yet
# run before a ship. It moves up if it earns it.
run "every surface · landmarks, heading order, names, alt text, skip link" \
  bash -eo pipefail -c 'for l in en he; do node ops/harness/a11y.mjs --lang $l | tail -1; done'

run "dark rules written only once" \
  node ops/harness/theme-pairs.mjs

run "icons · every mask paints in both themes, and nothing leaked into a sink" \
  bash -eo pipefail -c 'node ops/harness/icons.mjs | tail -1'

echo
[ "$fail" = 0 ] && echo "AUDIT: all checks reported clean." || echo "AUDIT: something needs a look — scroll up."
exit "$fail"
