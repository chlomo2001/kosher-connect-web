// Before/after prototype: is the front door obvious, and is anything on the
// dashboard a button nobody needs?
//
//   node ops/harness/proto-simple.mjs
//
// Owner, 25 Aug: "as guessable and simple as it gets — not to need to think too
// much what do I need to press. Also the balance vs overdone — no buttons which
// aren't really needed."
//
// This changes NOTHING in the product. It renders the real app three ways and
// screenshots the top of the dashboard, so the change can be judged by eye
// before it is judged worth building:
//
//   A  as it ships today
//   B  search promoted to a real field; Refresh and the four "New …" gone
//   C  search promoted; Refresh gone; the four "New …" kept but quietened
//
// B and C differ on one bet. B says the four creation buttons duplicate the
// palette's quick actions and each tab's own New button, so the dashboard
// should be about what needs attention. C says a customer standing at the
// counter wanting a rental is the commonest reason to touch this screen, and
// that a visible button beats a remembered shortcut.
import { chromium } from 'playwright-core'
import { buildAppHtml, BROWSER_ENV } from './render.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const file = buildAppHtml()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: BROWSER_ENV })

// The promoted search. Not a new capability — the same openPalette() the small
// button already calls, wearing clothes that say "type here" instead of
// "press me". A field is self-describing; a 128px button labelled "Search" is
// a thing you must first decide to press.
const PROMOTE = `
  const b = document.getElementById('btnPalette'); if (!b) return;
  const f = document.createElement('button');
  f.id = 'btnPalette';
  f.type = 'button';
  f.className = 'kc-findbar';
  f.title = 'Find anyone or anything (Ctrl+K)';
  f.setAttribute('aria-label', 'Find anyone or anything');
  f.innerHTML =
    '<span class="kc-ic kc-ic-search kc-findbar-ic" aria-hidden="true"></span>' +
    '<span class="kc-findbar-hint">Find anyone or anything — a name, a number, an IMEI</span>' +
    '<span class="kc-chord">Ctrl K</span>';
  f.addEventListener('click', () => openPalette());
  b.replaceWith(f);
`

const CSS = `
  .kc-findbar {
    display:flex; align-items:center; gap:10px; flex:1 1 auto;
    min-width:220px; max-width:520px; margin-right:12px;
    height:40px; padding:0 12px; cursor:text; text-align:start;
    background:var(--surface); color:var(--muted);
    border:1px solid var(--border); border-radius:var(--radius-md, 10px);
  }
  .kc-findbar:hover { border-color:var(--kc-blue); }
  .kc-findbar-ic::before { background-color:var(--muted); }
  .kc-findbar-hint {
    flex:1 1 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    font-size:var(--fs-small);
  }
  /* C only: the four creation buttons stay, but stop competing with the
     numbers underneath them. Same targets, same words, same ink colour —
     grey TEXT would read as disabled, which would be a lie. Only the box goes. */
  .dash-actions .kc-quiet {
    border-color:transparent; background:transparent; color:var(--text);
  }
  .dash-actions .kc-quiet:hover { border-color:var(--border); }
`

async function shot(name, tweak) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  await p.goto('file://' + file)
  await p.waitForTimeout(1400)
  await p.addStyleTag({ content: CSS })
  if (tweak) await p.evaluate(tweak)
  await p.waitForTimeout(300)
  await p.screenshot({ path: path.join(HERE, `proto_simple_${name}.png`), clip: { x: 0, y: 0, width: 1280, height: 560 } })
  await ctx.close()
}

const DROP_FIVE = `
  ${PROMOTE}
  document.querySelectorAll('.dash-actions .btn').forEach(el => {
    const t = (el.textContent || '').trim();
    if (t.startsWith('New ') || t.includes('Refresh')) el.remove();
  });
`
const QUIETEN = `
  ${PROMOTE}
  document.querySelectorAll('.dash-actions .btn').forEach(el => {
    const t = (el.textContent || '').trim();
    if (t.includes('Refresh')) el.remove();
    else el.classList.add('kc-quiet');
  });
`

await shot('a_today', null)
await shot('b_stripped', `(() => { ${DROP_FIVE} })()`)
await shot('c_quiet', `(() => { ${QUIETEN} })()`)
await browser.close()
console.log('wrote proto_simple_a_today.png, proto_simple_b_stripped.png, proto_simple_c_quiet.png')
