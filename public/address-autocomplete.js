// Google Places (New) address autocomplete — framework-agnostic, browser-only.
//
// Attaches a suggestion dropdown to any text <input>. As the user types we ask
// Places (New) for matching UK addresses; picking one fills the field with the
// tidy formatted address (and hands the caller the parsed parts). Used by both
// the operator app (main.js customer form) and the public /join page.
//
// The key is the referrer-restricted NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. It's fine
// in the browser: it's locked to our domain and to Places API (New) only. The
// browser sends the Referer header automatically, so Google's referrer check
// passes. If the key is missing or a request fails, the field silently stays a
// plain text box — address entry is never blocked by this.
//
// Billing note: autocomplete + one details lookup share a session token, so
// Google bills them as a single (cheap/free-tier) Autocomplete session.
(function () {
  if (typeof window === 'undefined') return;
  var BASE = 'https://places.googleapis.com/v1';

  function keyFor(opts) {
    return (opts && opts.key) || window.KC_MAPS_KEY || '';
  }

  // RFC-4122 v4 token (Math.random is fine in browser app code).
  function sessionToken() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // One small stylesheet for the dropdown, injected once. Uses the app's theme
  // variables where they exist (operator app) and sane fallbacks elsewhere.
  function ensureStyle() {
    if (document.getElementById('kc-ac-style')) return;
    var s = document.createElement('style');
    s.id = 'kc-ac-style';
    s.textContent =
      '.kc-ac-menu{position:absolute;z-index:10000;left:0;right:0;margin-top:4px;' +
      'background:var(--card,#fff);color:var(--ink,#0a2540);border:1px solid var(--line,#e2e6ee);' +
      'border-radius:10px;box-shadow:0 8px 28px rgba(10,37,64,.14);overflow:hidden;max-height:280px;' +
      'overflow-y:auto;font-size:14px}' +
      '.kc-ac-item{padding:9px 12px;cursor:pointer;display:block;line-height:1.35;' +
      'border-bottom:1px solid var(--line,#f0f2f7)}' +
      '.kc-ac-item:last-child{border-bottom:0}' +
      '.kc-ac-item:hover,.kc-ac-item.kc-ac-on{background:var(--accent-weak,#eef2ff)}' +
      '.kc-ac-main{font-weight:600}' +
      '.kc-ac-sub{color:var(--muted,#6b7688);font-size:12px}' +
      '.kc-ac-foot{padding:5px 12px;font-size:11px;color:var(--muted,#9aa4b2);text-align:right}';
    document.head.appendChild(s);
  }

  function parseComponents(list) {
    var out = { line1: '', town: '', postcode: '', country: '' };
    var num = '', route = '';
    (list || []).forEach(function (c) {
      var t = c.types || [];
      if (t.indexOf('street_number') >= 0) num = c.longText || c.shortText || '';
      else if (t.indexOf('route') >= 0) route = c.longText || c.shortText || '';
      else if (t.indexOf('postal_town') >= 0 || t.indexOf('locality') >= 0) out.town = c.longText || '';
      else if (t.indexOf('postal_code') >= 0) out.postcode = c.longText || c.shortText || '';
      else if (t.indexOf('country') >= 0) out.country = c.longText || '';
    });
    out.line1 = [num, route].filter(Boolean).join(' ');
    return out;
  }

  // Attach the autocomplete behaviour to an <input>. Idempotent per element.
  //   opts.onSelect(result)  — result = { formatted, line1, town, postcode, country }
  //   opts.country           — ISO region to bias to (default 'gb'); '' = worldwide
  //   opts.key               — override the global key (optional)
  function attach(input, opts) {
    if (!input || input.dataset.kcAc === '1') return;
    opts = opts || {};
    var key = keyFor(opts);
    if (!key) return; // no key configured → leave it a plain text field
    input.dataset.kcAc = '1';
    input.setAttribute('autocomplete', 'off');
    ensureStyle();

    var region = opts.country === undefined ? 'gb' : opts.country;
    var token = sessionToken();
    var menu = null, items = [], active = -1, timer = null, seq = 0;

    // The menu is positioned relative to the input's offset parent; make sure
    // that parent is positioned so absolute placement lands correctly.
    var host = input.parentNode;
    if (host && getComputedStyle(host).position === 'static') host.style.position = 'relative';

    function close() {
      if (menu) { menu.remove(); menu = null; }
      items = []; active = -1;
    }

    function place() {
      if (!menu) return;
      menu.style.top = (input.offsetTop + input.offsetHeight) + 'px';
      menu.style.left = input.offsetLeft + 'px';
      menu.style.width = input.offsetWidth + 'px';
    }

    function render(suggestions) {
      close();
      if (!suggestions.length) return;
      menu = document.createElement('div');
      menu.className = 'kc-ac-menu';
      menu.setAttribute('role', 'listbox');
      suggestions.forEach(function (s, i) {
        var el = document.createElement('div');
        el.className = 'kc-ac-item';
        el.setAttribute('role', 'option');
        var main = (s.structuredFormat && s.structuredFormat.mainText && s.structuredFormat.mainText.text) || s.text || '';
        var sub = (s.structuredFormat && s.structuredFormat.secondaryText && s.structuredFormat.secondaryText.text) || '';
        el.innerHTML = '<span class="kc-ac-main"></span>' + (sub ? '<br><span class="kc-ac-sub"></span>' : '');
        el.querySelector('.kc-ac-main').textContent = main;
        if (sub) el.querySelector('.kc-ac-sub').textContent = sub;
        el.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); });
        menu.appendChild(el);
        items.push({ el: el, placeId: s.placeId });
      });
      var foot = document.createElement('div');
      foot.className = 'kc-ac-foot';
      foot.textContent = 'Powered by Google';
      menu.appendChild(foot);
      host.appendChild(menu);
      place();
    }

    function highlight(n) {
      if (!items.length) return;
      active = (n + items.length) % items.length;
      items.forEach(function (it, i) { it.el.classList.toggle('kc-ac-on', i === active); });
    }

    async function choose(i) {
      var it = items[i]; if (!it) return;
      close();
      try {
        var r = await fetch(BASE + '/places/' + encodeURIComponent(it.placeId) + '?sessionToken=' + token, {
          headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'formattedAddress,addressComponents' },
        });
        token = sessionToken(); // new session after a completed lookup
        if (!r.ok) return;
        var j = await r.json();
        var parts = parseComponents(j.addressComponents);
        var result = {
          formatted: j.formattedAddress || input.value,
          line1: parts.line1, town: parts.town, postcode: parts.postcode, country: parts.country,
        };
        if (opts.onSelect) opts.onSelect(result);
        else {
          input.value = result.formatted;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (e) { /* details failed → keep whatever was typed */ }
    }

    async function query(text) {
      seq += 1; var mine = seq;
      try {
        var body = { input: text, sessionToken: token };
        if (region) body.includedRegionCodes = [region];
        var r = await fetch(BASE + '/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
          body: JSON.stringify(body),
        });
        if (mine !== seq) return; // a newer keystroke has superseded this one
        if (!r.ok) { close(); return; }
        var j = await r.json();
        var sugg = (j.suggestions || [])
          .map(function (s) { return s.placePrediction; })
          .filter(Boolean)
          .map(function (p) {
            return { placeId: p.placeId, text: (p.text && p.text.text) || '', structuredFormat: p.structuredFormat };
          });
        render(sugg);
      } catch (e) { close(); }
    }

    input.addEventListener('input', function () {
      var v = input.value.trim();
      if (timer) clearTimeout(timer);
      if (v.length < 3) { close(); return; }
      timer = setTimeout(function () { query(v); }, 250);
    });

    input.addEventListener('keydown', function (e) {
      if (!menu) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
      else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); choose(active); } }
      else if (e.key === 'Escape') { close(); }
    });

    input.addEventListener('blur', function () { setTimeout(close, 150); });
    window.addEventListener('resize', place);
  }

  window.kcAddressAutocomplete = attach;
})();
