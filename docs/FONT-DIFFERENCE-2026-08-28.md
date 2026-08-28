# Why it looks different on Shloime's Windows machine

**28 August 2026.** Owner: *"why is the font and overall look feel so different
on shloime's windows than on mine"*.

Because **every webfont in this product is Hebrew-only.** Latin — which is
almost everything on screen — is left to whatever the operating system has, and
Mac and Windows have different things.

## The two font stacks, and what each machine picks

`styles/globals.css` self-hosts two faces, and both carry a `unicode-range`
that limits them to Hebrew:

```css
@font-face { font-family: 'David Libre KC'; src: url('/fonts/david-libre-400-hebrew.woff2');
             unicode-range: U+0590-05FF, … }
@font-face { font-family: 'Heebo KC';       src: url('/fonts/heebo-var-hebrew.woff2');
             unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F }
```

That is deliberate and it is right — it is why a Hebrew date renders in the
classic David face and why the file is 8KB instead of 200. But it means the
Latin never comes from us.

| Surface | Stack | On his Mac | On Shloime's Windows |
| --- | --- | --- | --- |
| Staff app (`body`) | `'David Libre KC', 'SF Pro Display', system-ui, …` | **SF Pro Display** | SF Pro does not exist → `system-ui` → **Segoe UI** |
| Public site (`--sk-fbody`) | `'Heebo KC', system-ui, -apple-system, 'Segoe UI', Roboto, Arial` | `system-ui` → **SF Pro** | **Segoe UI** |
| Public display (`--sk-fdisp`) | `'Heebo KC', 'Helvetica Neue', Arial, system-ui, …` | **Helvetica Neue** | Helvetica Neue absent → **Arial** |

So the headline on `/welcome` is set in **Helvetica Neue** on one machine and
**Arial** on the other. They are close cousins and not the same face: Arial is
wider, its `R` has a straight leg where Helvetica's is curved, and its `G` has
no spur. At display size that is exactly the "different feel" being described,
and no amount of CSS tuning will reconcile it, because it is two different sets
of letterforms.

## What it is not

- Not the browser. Both are Chrome.
- Not zoom or DPI, though those change apparent size — the letterforms differ.
- Not a failed download. The two woff2 files are present and served; they are
  simply not asked to draw Latin.

## The decision

Making the two machines match means **self-hosting one Latin face**, the same
way the Hebrew is already self-hosted. There is no font common to macOS and
Windows that is worth designing on — the shared set is Arial, Georgia,
Times New Roman, Verdana.

That is a brand decision now rather than a technical one, because
`docs/brand/standard.json` governs typography. Roughly:

| | cost | effect |
| --- | --- | --- |
| Leave it | nothing | Every machine renders in its own native face. Fast, and each looks "right" locally — but the shop's own screens do not match each other, and neither will a screenshot in a document |
| Self-host one Latin face | ~2 × 25KB woff2, subset to Latin, `font-display: swap` | Identical everywhere, brand pinned, the standard's type ramp becomes true rather than aspirational |

**Done, 28 Aug: self-hosted.** The Hebrew argument applies to the Latin without
change — a shop whose whole positioning is "you can hand me your number and
your money" should not present two different faces depending on which counter
you are standing at. The cost is one small file on first load, already paid
twice over for Hebrew.

Not done yet, because it changes the typeface of every screen and that is the
owner's call to look at rather than mine to ship.

---

## What was actually done

The owner picked which of the two to keep — *"i liked mine more"*, meaning the
Mac rendering: SF Pro in the app, Helvetica Neue on the site.

Neither can be self-hosted. SF Pro is Apple's and licensed for Apple platforms;
Helvetica Neue is Linotype's. **Inter** is the nearest face that can be — a
neo-grotesque drawn for screen UI, with SF Pro's proportions and Helvetica's
skeleton, under the SIL Open Font License.

**Heebo was tried first and rejected on looking at it.** It was the tidier
argument: already self-hosted for the Hebrew, and drawn as Roboto's Hebrew
companion, so one design would have covered both scripts. But it is a Roboto
relative — rounder and wider than either of the two faces the owner was
choosing between, which is the opposite of what he asked for.

- `public/fonts/inter-var-latin.woff2` — 48KB, variable 100-900, what nearly
  everyone downloads
- `public/fonts/inter-var-latin-ext.woff2` — 85KB, fetched only if a name needs it

Hebrew is untouched: David Libre still leads the app's stack and Heebo still
leads the public site's, both Hebrew-only by `unicode-range`, so Inter picks up
exactly what they do not claim.

Verified against a real server rather than the offline harness, which serves
`file://` and cannot resolve `/fonts/...`: the woff2 returns 200,
`document.fonts.check('40px "Inter KC"')` is true, and the `/welcome` hero
measures 858px — Inter — against 829 for Arial and 753 for the fallback. Only
the `latin` subset is fetched, so the `unicode-range` gating is working.
