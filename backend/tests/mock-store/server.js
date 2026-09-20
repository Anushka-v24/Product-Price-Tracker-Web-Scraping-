/**
 * A small fake version of the INE store for automated tests.
 *
 * It reproduces the tricks we saw on the real site, and each one can be switched on per test:
 *   - price hidden until >= 8 mouse moves (>= 40 ms apart) + 600 ms hover
 *   - the first N "Reveal price" clicks are silently ignored
 *   - the price API fails N times (503) before succeeding; the page retries up to 6 times
 *   - decoy prices (hidden .price-value, hidden [data-price], struck-through MRP, "Deal price")
 *   - rotating price formats, rotating class names from /api/layout
 *   - "Updating…" (pending) price on the first load
 *   - catalog pages are random samples + random 429s
 *   - a full-screen cookie overlay that can appear late and needs several clicks
 *
 *   const store = await startMockStore({ priceFailures: 2, format: 'euro' });
 *   ... store.url ...
 *   await store.close();
 */
import http from 'node:http';

const PRODUCTS = Array.from({ length: 120 }, (_, i) => ({
  id: i + 1,
  slug: `product-${i + 1}`,
  name: `Mock Product ${i + 1}`,
  brand: 'Mock',
  category: 'Test',
  sku: `MOC-${10000 + i + 1}`,
}));

export async function startMockStore(options = {}) {
  const opts = {
    price: 2690,
    mrp: 3022,
    stock: 19,
    format: 'default',
    priceTag: 'b',
    priceFailures: 0,
    ignoredClicks: 0,
    pendingFirst: false,
    layoutFails: false,
    catalog429Rate: 0.2,
    removePriceBlock: false,
    cookieDelayMs: 0, // like the real store: the banner can appear 1.5-5 s after load
    cookieClicks: 1, // ...and may need up to 3 clicks to close
    ...options,
  };
  let priceCalls = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/api/layout') {
      if (opts.layoutFails) return json(500, { error: 'boom' });
      return json(200, { revision: 1, variant: 2, classes: { priceValue: 'pv-t1' }, priceTag: opts.priceTag });
    }
    if (url.pathname.startsWith('/api/price/')) {
      priceCalls++;
      if (priceCalls <= opts.priceFailures) return json(503, { error: 'unavailable' });
      const pending = opts.pendingFirst && priceCalls === opts.priceFailures + 1;
      return json(200, { shown: opts.price, mrp: opts.mrp, stock: opts.stock, format: opts.format, pending });
    }
    if (url.pathname === '/api/catalog') {
      if (Math.random() < opts.catalog429Rate) return json(429, { error: 'rate_limited' }, { 'retry-after': '0' });
      const size = Math.min(60, Number(url.searchParams.get('pageSize')) || 20);
      const sample = [...PRODUCTS].sort(() => Math.random() - 0.5).slice(0, size);
      return json(200, { page: 1, pageSize: size, pages: Math.ceil(PRODUCTS.length / size), total: PRODUCTS.length, items: sample });
    }
    const productMatch = url.pathname.match(/^\/api\/product\/(\d+)$/);
    if (productMatch) {
      const product = PRODUCTS.find((p) => p.id === Number(productMatch[1]));
      return product ? json(200, product) : json(404, { error: 'not_found' });
    }
    if (url.pathname.startsWith('/product/')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(pageHtml(opts));
    }
    json(404, { error: 'not_found' });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    get priceCalls() {
      return priceCalls;
    },
    /** Change the store's behaviour mid-test, e.g. store.set({ price: 2500 }) */
    set(changes) {
      Object.assign(opts, changes);
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function pageHtml(opts) {
  return `<!doctype html><html><head><title>Mock INE Store</title></head><body>
<main style="padding-top:80px"><h1>Mock product</h1><div id="slot"></div></main>
<script>
const OPTS = ${JSON.stringify({ ignoredClicks: opts.ignoredClicks, removePriceBlock: opts.removePriceBlock, cookieDelayMs: opts.cookieDelayMs, cookieClicks: opts.cookieClicks })};
setTimeout(() => {
  let left = OPTS.cookieClicks;
  const overlay = document.createElement('div');
  overlay.className = 'cookie-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.3)';
  overlay.innerHTML = '<div role="dialog" aria-label="Cookie consent" style="position:fixed;bottom:20px;left:20px;background:#fff;padding:10px">' +
    'We use cookies <button type="button" aria-label="Accept cookies">Accept</button>' +
    '<button type="button" aria-label="Decline cookies">Decline</button></div>';
  overlay.querySelectorAll('button').forEach((b) => { b.onclick = () => { if (--left <= 0) overlay.remove(); }; });
  document.body.appendChild(overlay);
}, OPTS.cookieDelayMs);
const slot = document.getElementById('slot');
let layout = null, state = { phase: 'idle', attempt: 0 }, moves = 0, lastMove = 0, hoverAt = 0, clicks = 0;
const fmt = (n) => '\\u20B9' + n.toLocaleString('en-IN');
const FORMATS = {
  default: (n) => fmt(n),
  spaced: (n) => fmt(n).replace(/,/g, ' '),
  euro: (n) => fmt(n).replace(/,/g, '.') + ',00',
  trailing: (n) => fmt(n) + '/- (incl. of all taxes)',
  unicode: (n) => fmt(n).replace(/[0-9]/g, (d) => String.fromCharCode(65296 + Number(d))),
  nbsp: (n) => fmt(n).split('').join('\\u00A0\\u200B'),
  lakh: (n) => 'Rs.\\u00A0' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
};
const ready = () => moves >= 8 && hoverAt && Date.now() - hoverAt >= 600;

function render() {
  if (OPTS.removePriceBlock) { slot.innerHTML = '<div class="something-else">Price</div>'; return; }
  const cls = layout ? layout.classes.priceValue : '';
  if (state.phase === 'idle') {
    slot.innerHTML = '<div class="price-block price-idle" style="width:400px;height:110px;border:1px solid #999">' +
      '<p class="price-status">Price hidden</p><p class="price-substatus">' + (ready() ? 'Check the price' : 'Hover over the price area') + '</p>' +
      '<button type="button" aria-label="Reveal price"' + (ready() ? '' : ' disabled') + '>Reveal price</button></div>';
    const btn = slot.querySelector('button');
    btn.onclick = () => { clicks++; if (clicks > OPTS.ignoredClicks) load(); };
  } else if (state.phase === 'loading') {
    slot.innerHTML = '<div class="price-block" aria-busy="true"><p class="price-status">Loading (attempt ' + state.attempt + ')</p></div>';
  } else if (state.phase === 'error') {
    slot.innerHTML = '<div class="price-block price-error"><p class="price-status">Could not load</p><p class="price-substatus">store down</p></div>';
  } else {
    const q = state.quote, tag = (layout && layout.priceTag) || 'span';
    slot.innerHTML = '<div class="price-block price-success"><div class="price-main">' +
      '<span class="price-value" aria-hidden="true" style="display:none">' + fmt(q.shown + 247) + '</span>' +
      '<span style="text-decoration:line-through;opacity:.55">' + fmt(q.mrp) + '</span>' +
      '<span style="opacity:.75">Deal price ' + fmt(q.shown + 50) + '</span>' +
      '<' + tag + ' class="vabc123 ' + cls + '">' + FORMATS[q.format](q.shown) + '</' + tag + '>' +
      '<span>4% off</span>' + (q.pending ? '<span>Updating\\u2026</span>' : '') +
      '<span class="amount" data-price="true" aria-hidden="true" style="display:none">' + fmt(q.shown + 612) + '</span>' +
      '</div><div class="price-facets"><span class="stock-badge ' + (q.stock > 0 ? 'in-stock">Hurry, just ' + q.stock + ' left' : 'out-stock">Out of stock') + '</span></div>' +
      '<div class="price-meta"><span>Loaded in ' + state.attempt + ' attempts</span>' +
      '<button type="button" onclick="load()">Refresh price</button></div></div>';
  }
  const block = slot.querySelector('.price-block');
  block.onmouseenter = () => { hoverAt = hoverAt || Date.now(); };
  block.onmousemove = () => { const t = Date.now(); if (t - lastMove < 40) return; lastMove = t; hoverAt = hoverAt || t; moves++; };
}

async function load() {
  for (let attempt = 1; attempt <= 6; attempt++) {
    state = { phase: 'loading', attempt }; render();
    const r = await fetch('/api/price/1');
    if (r.ok) { state = { phase: 'success', attempt, quote: await r.json() }; render(); return; }
    await new Promise((s) => setTimeout(s, 100 * attempt));
  }
  state = { phase: 'error', attempt: 6 }; render();
}

fetch('/api/layout').then((r) => (r.ok ? r.json() : null)).then((l) => { layout = l; render(); }).catch(() => render());
setInterval(() => { if (state.phase === 'idle') { const b = slot.querySelector('button'); if (b) b.disabled = !ready(); } }, 100);
</script></body></html>`;
}
