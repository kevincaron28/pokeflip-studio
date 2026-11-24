// The server shop checker: reads the public Shopify catalogues of Canadian card shops (plus Indigo and Mastermind Toys),
// finds sealed Pokémon products by set, size and language, and writes a drop event when a product goes from sold out
// (or unseen) to in stock, or back to sold out. The Discord bot and phone push read drop_events.
// Rules kept (docs/DROPS-PIPELINE.md):
//  - Only allowed sources: /products.json and /products/<handle>.js are the shops' own public storefront data, served
//    with no bot wall; a shop that refuses (403/429) is left alone for 30 minutes, then an hour, up to 6 hours.
//  - Polite: a named User-Agent with a contact URL, one request per shop per pass, If-None-Match with the shop's ETag,
//    at most 6 shops at a time, a 10-second timeout. Each shop is read about every 4 to 5 minutes.
//  - Confirmed before alerting: an in-stock change is re-read from the product's own page (/products/<handle>.js);
//    only if that says available too does it become a drop event. Title matches are Medium confidence at most.
//  - Detection lag: first_seen_at is when we saw it; source_updated_at is the shop's own update time for the product.
import { setPhrases, parseTitle, variantKind, upcOf, KIND, REGION } from './drop-match.mjs';

export const UA = 'Cardstead-stock-check/1.0 (+https://pokeflip-studio.vercel.app/privacy.html)';
const MIN_GAP_MS = 4 * 60 * 1000;
const BACKOFF_MIN = [30, 60, 120, 360];

/** In stock and lowest price among the variants that are the product itself (never a pack or case option). Pure. */
export function stockOf(product) {
  const vars = (product.variants || []).filter((v) => { const k = variantKind(v); return !k || k === 'unit'; });
  const avail = vars.filter((v) => v.available === true);
  const pool = avail.length ? avail : vars;
  const prices = pool.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0);
  const updated = (product.variants || []).map((v) => Date.parse(v.updated_at || '')).concat(Date.parse(product.updated_at || '')).filter(Number.isFinite);
  return { inStock: avail.length > 0, price: prices.length ? Math.min(...prices) : null, upc: vars.map(upcOf).find(Boolean) || null,
    updatedAt: updated.length ? new Date(Math.max(...updated)).toISOString() : null, handle: product.handle };
}

/** Catalogue lookup: set phrase + kind -> the reference product (name, market price in CAD, image). Pure. */
export function catalogueIndex(catalogue) {
  const SETP = setPhrases(catalogue.sets.map((s) => s.name).concat(catalogue.extraSets || []));
  const byKey = new Map();
  for (const s of catalogue.sets) for (const p of s.products || []) byKey.set(setPhrases([s.name])[0].p + '|' + p.kind, { set: s, product: p });
  return { SETP, byKey, fx: catalogue.fx };
}

/** Drop events for one shop's catalogue, compared with what was seen before. Pure: no network, no clock. */
export function diffShop({ shop, products, before, index, now }) {
  const nowIso = new Date(now).toISOString();
  const seen = [], changes = [];
  for (const p of products || []) {
    if (!p || typeof p.title !== 'string' || !Array.isArray(p.variants)) continue;
    const m = parseTitle(p.title, index.SETP);
    if (!m) continue;
    const ref = index.byKey.get(m.setPhrase + '|' + m.kind) || null;
    const st = stockOf(p);
    if (st.price === null) continue;
    // Collections, tins and blisters come in many products per set: no shared market value, and the key names which one.
    const marketCad = ref && !m.variant && Number.isFinite(ref.product.marketCad) ? ref.product.marketCad : null;
    // Far under or far over the market value is usually another product sold under the set's name: skip it.
    if (marketCad && m.lang === 'EN' && (st.price < marketCad * 0.4 || st.price > marketCad * 3)) continue;
    const productKey = `${(ref?.set.slug || m.setPhrase.replace(/\s+/g, '-'))}|${m.kind}${m.variant ? ':' + m.variant : ''}|${m.lang}`;
    const row = { store_key: shop.host, product_key: productKey, handle: p.handle, title: p.title.slice(0, 200), in_stock: st.inStock, price_cad: st.price, seen_at: nowIso };
    seen.push(row);
    const prev = before.get(productKey + '|' + p.handle);
    if (prev && prev.in_stock === st.inStock) continue;
    if (!prev && !st.inStock) continue; // first sight of a sold-out product: nothing to say
    changes.push({ row, m, ref, st, marketCad, productKey, product: p });
  }
  return { seen, changes };
}

export function eventFor({ shop, change, now, confirmedAt }) {
  const { row, m, ref, st, marketCad, productKey, product } = change;
  const kindLabel = { box: 'Booster Box', etb: 'Elite Trainer Box', 'etb-pc': 'Pokémon Center Elite Trainer Box', pack: 'Booster Pack', bundle: 'Booster Bundle', blister: 'Blister', bnb: 'Build & Battle Box', collection: 'Collection', tin: 'Tin' }[m.kind];
  const hour = new Date(now).toISOString().slice(0, 13);
  return {
    product_key: productKey,
    product_name: (ref ? `${ref.set.name} ${kindLabel}` : product.title).slice(0, 160) + (m.lang === 'FR' ? ' (FR)' : ''),
    product_lang: m.lang, product_kind: KIND[m.kind], product_upc: st.upc && /^\d{8,14}$/.test(st.upc) ? st.upc : null, matched_by: 'title',
    store_key: shop.host, store_name: shop.name, chain_key: shop.chain || null, region: shop.chain ? null : (REGION[shop.region] || 'online-canada'), city: shop.city || null,
    url: `https://${shop.host}/products/${encodeURIComponent(product.handle)}`, price_cad: row.price_cad, msrp_cad: null, seller: 'store',
    in_stock: row.in_stock, limit_per_order: null, source: 'shop_check', confidence: 'medium',
    event_key: `${shop.host}|${productKey}|${row.in_stock}|${hour}`, first_seen_at: confirmedAt || new Date(now).toISOString(),
    market_cad: marketCad, market_source: marketCad ? 'TCGplayer market price' : null, market_as_of: ref ? ref.set.asOf || null : null,
    image_url: ref?.product.image || null, source_updated_at: st.updatedAt,
  };
}

/** One pass over the shops that are due. deps: {store, fetch, now, shops, catalogue}. */
export async function runPass({ store, fetch: f, now, shops, catalogue, maxShops = 45, concurrency = 6, gapMs = 0, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} }) {
  const index = catalogueIndex(catalogue);
  const states = new Map((await store.shopStates()).map((s) => [s.host, s]));
  const t = now();
  const due = shops.filter((s) => { const st = states.get(s.host); if (!st) return true;
    if (st.backoff_until && Date.parse(st.backoff_until) > t) return false;
    return !st.last_checked_at || t - Date.parse(st.last_checked_at) >= MIN_GAP_MS; })
    .sort((a, b) => (Date.parse(states.get(a.host)?.last_checked_at || 0) || 0) - (Date.parse(states.get(b.host)?.last_checked_at || 0) || 0))
    .slice(0, maxShops);
  const summary = { shops: due.length, unchanged: 0, read: 0, refused: 0, failed: 0, events: 0 };
  const queue = due.slice();
  async function one(shop) {
    const st = states.get(shop.host) || { host: shop.host, fails: 0 };
    const headers = { 'user-agent': UA, accept: 'application/json' };
    if (st.etag) headers['if-none-match'] = st.etag;
    let res;
    try { res = await f(`https://${shop.host}/products.json?limit=250`, { headers, redirect: 'follow', signal: AbortSignal.timeout(10000) }); }
    catch (e) { summary.failed++; await store.saveShopState({ host: shop.host, last_checked_at: new Date(now()).toISOString(), last_status: 0, fails: (st.fails || 0) + 1 }); return; }
    const base = { host: shop.host, last_checked_at: new Date(now()).toISOString(), last_status: res.status };
    if (res.status === 304) { summary.unchanged++; await store.saveShopState({ ...base, fails: 0 }); return; }
    if (res.status === 403 || res.status === 429) {
      summary.refused++; const fails = (st.fails || 0) + 1, mins = BACKOFF_MIN[Math.min(fails - 1, BACKOFF_MIN.length - 1)];
      await store.saveShopState({ ...base, fails, backoff_until: new Date(now() + mins * 60000).toISOString() }); log(`${shop.host}: ${res.status}, back off ${mins} min`); return; }
    if (!res.ok) { summary.failed++; await store.saveShopState({ ...base, fails: (st.fails || 0) + 1 }); return; }
    let body; try { body = await res.json(); } catch { summary.failed++; await store.saveShopState({ ...base, fails: (st.fails || 0) + 1 }); return; }
    summary.read++;
    const before = new Map((await store.shopStock(shop.host)).map((r) => [r.product_key + '|' + r.handle, r]));
    const { seen, changes } = diffShop({ shop, products: body.products, before, index, now: now() });
    // First successful read of a shop: record what is there without alerting (it was not a restock we saw happen).
    if (!st.last_ok_at) changes.length = 0;
    const changedRows = [];
    for (const c of changes) {
      // Confirm an in-stock change on the product's own page before telling anyone.
      if (c.row.in_stock) {
        try { const r = await f(`https://${shop.host}/products/${encodeURIComponent(c.product.handle)}.js`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) });
          const j = r.ok ? await r.json() : null; if (!j || !(j.variants || []).some((v) => v.available === true)) continue; }
        catch { continue; }
      }
      await store.insertEvent(eventFor({ shop, change: c, now: now(), confirmedAt: new Date(now()).toISOString() }));
      summary.events++; changedRows.push({ ...c.row, changed_at: new Date(now()).toISOString() });
    }
    // Save what we now know. A change that was not confirmed keeps the old state, so the next pass looks again.
    const keep = [];
    for (const r of seen) {
      const key = r.product_key + '|' + r.handle, prev = before.get(key);
      const confirmed = changedRows.find((x) => x.product_key === r.product_key && x.handle === r.handle);
      if (confirmed) keep.push(confirmed);
      else if (changes.some((c) => c.row === r)) { if (prev) keep.push({ ...r, in_stock: prev.in_stock, changed_at: prev.changed_at }); }
      else keep.push({ ...r, changed_at: prev?.changed_at || r.seen_at });
    }
    if (keep.length) await store.saveShopStock(keep);
    await store.saveShopState({ ...base, etag: res.headers.get('etag') || null, last_ok_at: base.last_checked_at, fails: 0, backoff_until: null });
  }
  // gapMs: pause between two shops in the same worker (concurrency 1 + a gap = one shop at a time, spaced out).
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => { let first = true;
    while (queue.length) { if (!first && gapMs) await sleep(gapMs); first = false; await one(queue.shift()); } }));
  return summary;
}

/** Diagnostic: one plain request per shop, one at a time with a gap, nothing saved. Reports each shop's HTTP status. */
export async function probeShops({ fetch: f, shops, gapMs = 4000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const out = [];
  for (const [i, shop] of shops.entries()) {
    if (i && gapMs) await sleep(gapMs);
    const t0 = Date.now();
    try { const r = await f(`https://${shop.host}/products.json?limit=1`, { headers: { 'user-agent': UA, accept: 'application/json' }, redirect: 'follow', signal: AbortSignal.timeout(10000) });
      out.push({ host: shop.host, status: r.status, retryAfter: r.headers.get('retry-after'), ms: Date.now() - t0 }); await r.body?.cancel?.(); }
    catch (e) { out.push({ host: shop.host, status: 0, error: String(e && e.name || e), ms: Date.now() - t0 }); }
  }
  const by = {}; for (const r of out) by[r.status] = (by[r.status] || 0) + 1;
  return { shops: out.length, byStatus: by, results: out };
}

/** Database access for the checker (service role, inside Supabase only). */
export function checkerStore({ url, serviceKey, fetch: f = globalThis.fetch }) {
  const base = `${url}/rest/v1`;
  async function q(method, path, body, prefer) {
    const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
    if (prefer) headers.prefer = prefer;
    const res = await f(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) throw Error(`Database ${method} ${path.split('?')[0]} -> ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }
  const e = encodeURIComponent;
  return {
    shopStates: () => q('GET', '/shop_check_state?select=*&limit=1000'),
    saveShopState: (row) => q('POST', '/shop_check_state?on_conflict=host', row, 'resolution=merge-duplicates,return=minimal'),
    shopStock: (host) => q('GET', `/shop_stock?store_key=eq.${e(host)}&select=*&limit=2000`),
    saveShopStock: (rows) => q('POST', '/shop_stock?on_conflict=store_key,product_key,handle', rows, 'resolution=merge-duplicates,return=minimal'),
    insertEvent: (ev) => q('POST', '/drop_events?on_conflict=event_key', ev, 'resolution=ignore-duplicates,return=minimal'),
  };
}

/** Database access for a checker running outside Supabase (deploy/shop-checker/): the public key plus a checker key,
 *  through the five checker_* functions of migrations/006-checker-key.sql. No Supabase secret key on that machine. */
export function checkerRpcStore({ url, publishableKey, checkerKey, fetch: f = globalThis.fetch }) {
  async function rpc(name, args) {
    const res = await f(`${url}/rest/v1/rpc/${name}`, { method: 'POST',
      headers: { apikey: publishableKey, authorization: `Bearer ${publishableKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_key: checkerKey, ...args }) });
    const text = await res.text();
    if (!res.ok) throw Error(`Database ${name} -> ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }
  return {
    shopStates: () => rpc('checker_states', {}),
    saveShopState: (row) => rpc('checker_save_state', { p_row: row }),
    shopStock: (host) => rpc('checker_stock', { p_host: host }),
    saveShopStock: (rows) => rpc('checker_save_stock', { p_rows: rows }),
    insertEvent: (ev) => rpc('checker_add_event', { p_event: ev }),
  };
}
