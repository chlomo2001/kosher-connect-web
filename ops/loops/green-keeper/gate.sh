#!/usr/bin/env bash
# ── Green-Keeper objective gate ────────────────────────────────────────────
# The article's rule: the verifier must be a test that PASSES or FAILS with no
# opinion — "a dumber gate", not a second agent grading the work. This is it.
#
# Exit 0  => the branch is shippable (all checks green).
# Exit !0 => something is red; the loop must NOT open a ready PR.
#
# Usage:  bash ops/loops/green-keeper/gate.sh
#   GATE_SKIP_BUILD=1  skip the (slow) production build for a quick inner loop.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 3
fail() { echo "GATE: FAIL — $1"; exit 1; }

# CI's first step is `npm ci`, which fails outright if package.json and
# package-lock.json disagree — and it installs ONLY what the lockfile declares.
# This container ships extra packages (playwright-core arrived that way), so a
# test importing one of them passed here and threw in CI. That cost 17 hours of
# red builds from 19 Aug before anyone read the failure mail. --dry-run does
# the resolution without touching node_modules, in under a second.
echo "GATE: package-lock agrees with package.json (what CI installs)…"
npm ci --dry-run >/dev/null 2>&1 || fail "npm ci would fail — package.json and package-lock.json disagree"

echo "GATE: money/customer/rental tests (default TZ)…"
npm test --silent               || fail "npm test (default TZ)"

echo "GATE: money tests (TZ=Asia/Jerusalem — guards the day-count timezone bug)…"
TZ=Asia/Jerusalem npm test --silent || fail "npm test (Asia/Jerusalem)"

if [ "${GATE_SKIP_BUILD:-0}" != "1" ]; then
  echo "GATE: production build…"
  NEXT_TELEMETRY_DISABLED=1 npm run build >/dev/null 2>&1 || fail "npm run build"
fi

echo "GATE: PASS — branch is shippable."
