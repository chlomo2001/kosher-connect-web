# The office-PC converters, read and accounted for

**27 August 2026.** Shloime sent the whole program folder — twelve distinct
tools plus a Python GUI. This is what each one does, whether the app already
does it, and what reading them changed.

The headline: **the app now covers every job on that PC.** The Contact Tools
card in Settings has no office-PC row left.

## The inventory

| File | Title | Job | Verdict |
| --- | --- | --- | --- |
| `Nokia IB to VCF.html` | Nokia 215 Phonebook Converter | `.IB` → VCF | **Identical** to `parseNokiaIb` |
| `Nokia_C2_to_FIG.html` | FIG: Nokia NBF → messages.ndjson ZIP | NBF messages → FIG | Same output schema as ours |
| `Nokia_C2_to_FIG (1).html` | — | — | Byte-identical duplicate of the above |
| `nbftofig.html` | FIG: Nokia NBF → messages.zip | NBF messages → FIG | Earlier generation of the same |
| `kosher-connect-fig-nbf.html` | Kosher Connect • FIG NBF Converter | NBF messages → FIG | Third generation; needs a CDN |
| `NEW GOOD XML to FIG.html` | XML to FIG ZIP NDJSON (Enhanced) | SMS XML → FIG | See below — differences both ways |
| `xml_to_fig_zip_converter.html` | XML to FIG ZIP NDJSON | SMS XML → FIG | Earlier generation of the above |
| `excel-to-vcf.html` | Excel → VCF (Auto .xls/.xlsx) | Spreadsheet → VCF | Covered, except legacy `.xls` |
| `excel_to_vcf.html` | Excel → VCF (UK) | Spreadsheet → VCF | Earlier generation |
| `excel_to_vcf_gui.py` | — (tkinter + pandas) | Spreadsheet → VCF | Desktop version of the same |
| `csv_to_vcf_uk_offline.html` | CSV/Excel → VCF (UK) — Offline | CSV → VCF | Covered by Contacts Converter |
| `vcf_uk_prefix_converter.html` | VCF UK Prefix Converter | Numbers → +44 | Covered — and **ours is safer**, see below |
| `vcard_cleaner.html` | VCF Duplicate Remover | Dedupe a VCF | Covered by `dedupeCards` |

Six of the twelve are earlier generations of three jobs. That is not untidiness,
it is the normal shape of a tool that got fixed by being rewritten — and it is
the argument for having one of each in the app instead of five in a folder,
where the next person cannot tell which is current. `NEW GOOD …` is named that
way for exactly this reason.

## The question this was meant to settle

The Contact Tools card carried a row called **NokiaB→VCF** — "contacts out of a
Nokia .NBF" — as the one job the app genuinely could not do.

**There is no such tool.** All three NBF converters read `predefmessages/1` and
`predefmessages/3`, which are *messages*, and every one of them writes a FIG
messages archive. None of them mentions vCard at all. Our `parseNbf` reads the
same two directories and does the same thing.

So the row was a mislabel, and it is gone. Contacts come off a Nokia by way of
the phonebook `.IB` file, which the Transfer Wizard already reads.

## What reading them actually changed

**The `<smses>` root.** His XML converter never checked for one and ours
demanded it, so a file his tool ate happily was refused by ours. Relaxed — the
messages are the test, not the wrapper.

**A body containing `>`.** His matcher is `/<sms\s+([^>]+?)\s*\/>/g`; `[^>]`
stops at the first `>`, so "u there? ->" never matches and the message is
dropped in silence. Ours already handled that. On a three-message file: his 2,
ours 3. **Every one of his XML → FIG conversions has been losing messages that
contain a `>`.**

**Blank records — ours alone.** Both attribute matchers read only
double-quoted values, but his skips a tag it cannot read
(`if (attrs.address || attrs.body)`) while ours pushed the record regardless. A
single-quoted export therefore produced the right number of entirely empty
messages. Fixed, and his guard adopted.

## Two things on that PC that are worth knowing about

**The UK prefix converter corrupts Israeli numbers.** `toUkPrefix()` turns any
number starting `0` with 10–12 digits into `+44…`. An Israeli mobile is
`05x-xxx-xxxx` — ten digits, leading zero — so it comes out as a UK number that
does not exist. Our `normalizeUkNumber` checks Israel *before* the UK
catch-all (`/^05\d{8}$/` → `+972`) precisely because this customer base carries
those daily; it was a real defect here once, found in the 2 Aug sweep. The PC
tool still has it.

**Half of them need the internet.** `excel-to-vcf`, `excel_to_vcf`,
`kosher-connect-fig-nbf` and `vcard_cleaner` pull SheetJS or Tailwind off a CDN.
On a shop machine with no connection — or the day one of those CDNs moves — they
stop working, silently and mid-job. The in-app tools have no external requests
at all, which is the point of them.

## The one real capability difference, and why it stands

`excel-to-vcf.html` reads legacy `.xls` (via SheetJS); `lib/sheetLite.mjs` does
not, and says so in its header: *"Legacy .xls (BIFF) is intentionally NOT
parsed — the page asks for a re-save as .xlsx/.csv instead of shipping a binary
BIFF decoder."*

That trade stands. BIFF is a large binary format to carry for a case that
resolves with "open it and Save As", and the tool that does handle it needs a
CDN to do so. Worth revisiting only if a customer actually turns up with an
`.xls` nobody can re-save.
