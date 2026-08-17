#!/usr/bin/env bash
# One command, one project folder — macOS and Linux.
#
#   bash new-project.sh kosher-connect
#   bash new-project.sh kosher-connect https://github.com/psic770-ai/kosher-connect-web.git
#
# Makes the five-folder shape under ~/Projects and, if you pass a git URL,
# clones it into repo/. Safe to run twice: it never overwrites a file that is
# already there, so running it again on an existing project just fills in
# whatever is missing.
set -euo pipefail

NAME="${1:-}"
GIT_URL="${2:-}"
ROOT="${PROJECTS_ROOT:-$HOME/Projects}"

if [ -z "$NAME" ]; then
  echo "Usage: bash new-project.sh <project-name> [git-url]" >&2
  exit 1
fi

DIR="$ROOT/$NAME"
mkdir -p "$DIR"/{repo,owner/suppliers,owner/screenshots,handover,scratch}

# `write` never clobbers: an existing file is left exactly as it is.
write() {
  local path="$1"
  if [ -e "$path" ]; then echo "  kept    $path"; return; fi
  cat > "$path"
  echo "  created $path"
}

write "$DIR/README.md" <<EOF
# $NAME

What this is:
Where it is deployed:
Who to call:

## The folders

- \`repo/\`      the git clone. The only folder Claude works in.
- \`owner/\`     yours. Never committed. Contracts, invoices, screenshots.
- \`handover/\`  what a new person or the accountant would need.
- \`scratch/\`   throwaway. Safe to delete without thinking.

Anything Claude needs to know goes in \`repo/CLAUDE.md\` or \`repo/docs/\` —
a decision that lives only in \`owner/\` is invisible to it and gets
re-litigated.
EOF

write "$DIR/owner/decisions.md" <<EOF
# Decisions — $NAME

Dated one-liners. What was decided and why, not how it was built.
Anything that should change how the work is done belongs in repo/CLAUDE.md
as well, or it will not be followed.

## $(date +%Y-%m-%d)
- Project folder created.
EOF

write "$DIR/handover/README.md" <<EOF
# Handover — $NAME

For someone picking this up cold.

- What the business does:
- What the system does:
- Logins and where they live (names only — never the passwords themselves):
- Who hosts it:
- What breaks most often, and what to do:
EOF

write "$DIR/scratch/.keep" <<EOF
EOF

if [ -n "$GIT_URL" ]; then
  if [ -d "$DIR/repo/.git" ]; then
    echo "  kept    $DIR/repo (already a clone)"
  else
    echo "  cloning $GIT_URL"
    git clone "$GIT_URL" "$DIR/repo"
  fi
fi

echo
echo "Ready: $DIR"
echo "Next:  cd \"$DIR/repo\""
