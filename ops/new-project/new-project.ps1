# One command, one project folder — Windows PowerShell.
#
#   .\new-project.ps1 kosher-connect
#   .\new-project.ps1 kosher-connect https://github.com/psic770-ai/kosher-connect-web.git
#
# Same shape and the same promise as new-project.sh: safe to run twice, and it
# never overwrites a file that is already there.
#
# If Windows refuses to run it ("running scripts is disabled"), this session
# only:  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$GitUrl
)

$ErrorActionPreference = 'Stop'
$root = if ($env:PROJECTS_ROOT) { $env:PROJECTS_ROOT } else { Join-Path $HOME 'Projects' }
$dir = Join-Path $root $Name

foreach ($sub in @('repo', 'owner\suppliers', 'owner\screenshots', 'handover', 'scratch')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $dir $sub) | Out-Null
}

function Write-IfMissing($path, $body) {
  if (Test-Path $path) { Write-Host "  kept    $path" }
  else {
    Set-Content -Path $path -Value $body -Encoding UTF8
    Write-Host "  created $path"
  }
}

Write-IfMissing (Join-Path $dir 'README.md') @"
# $Name

What this is:
Where it is deployed:
Who to call:

## The folders

- ``repo/``      the git clone. The only folder Claude works in.
- ``owner/``     yours. Never committed. Contracts, invoices, screenshots.
- ``handover/``  what a new person or the accountant would need.
- ``scratch/``   throwaway. Safe to delete without thinking.

Anything Claude needs to know goes in ``repo/CLAUDE.md`` or ``repo/docs/`` —
a decision that lives only in ``owner/`` is invisible to it and gets
re-litigated.
"@

Write-IfMissing (Join-Path $dir 'owner\decisions.md') @"
# Decisions — $Name

Dated one-liners. What was decided and why, not how it was built.
Anything that should change how the work is done belongs in repo/CLAUDE.md
as well, or it will not be followed.

## $(Get-Date -Format 'yyyy-MM-dd')
- Project folder created.
"@

Write-IfMissing (Join-Path $dir 'handover\README.md') @"
# Handover — $Name

For someone picking this up cold.

- What the business does:
- What the system does:
- Logins and where they live (names only — never the passwords themselves):
- Who hosts it:
- What breaks most often, and what to do:
"@

Write-IfMissing (Join-Path $dir 'scratch\.keep') ''

if ($GitUrl) {
  if (Test-Path (Join-Path $dir 'repo\.git')) { Write-Host "  kept    $dir\repo (already a clone)" }
  else {
    Write-Host "  cloning $GitUrl"
    git clone $GitUrl (Join-Path $dir 'repo')
  }
}

Write-Host ''
Write-Host "Ready: $dir"
Write-Host "Next:  cd `"$dir\repo`""
