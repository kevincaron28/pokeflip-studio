// Drop alerts by push notification: which members a drop goes to, what it says, and one pass of the sender.
// Rules (same spirit as the Discord bot): only in-stock sightings, never low confidence, never marketplace sellers,
// one push per member per product at a store per 30 minutes, and by default only at or under the market value + 10%.
// Preferences (prefs, set in Settings > Drop alerts):
//   regions: drop_events regions to follow (empty = all), chains: true to include big chains, kinds: product kinds
//   (empty = all), langs: ['EN','FR'...] (empty = all), goodPriceOnly: true (default) = skip prices over market + 10%.

const COOLDOWN_MS = 30 * 60 * 1000;
const KIND = { booster_box: ['Booster box', 'Boîte de boosters'], etb: ['Elite Trainer Box', 'Coffret Dresseur d’élite'], etb_pc: ['Pokémon Center ETB', 'ETB Pokémon Center'],
  pack: ['Booster pack', 'Paquet booster'], bundle: ['Booster bundle', 'Lot de boosters'], blister: ['Blister', 'Blister'], build_battle: ['Build & Battle', 'Build & Battle'],
  collection: ['Collection', 'Collection'], tin: ['Tin', 'Boîte métal'], other: ['Product', 'Produit'] };

export function dedupeKey(ev) { return `${ev.store_key}|${ev.product_key}`; }

/** Does this drop interest this member? Pure. */
export function matches(ev, prefs = {}) {
  if (!ev || !ev.in_stock || ev.confidence === 'low' || ev.seller === 'marketplace') return false;
  const p = prefs || {};
  if (ev.chain_key) { if (p.chains === false) return false; }
  else if (Array.isArray(p.regions) && p.regions.length && !p.regions.includes(ev.region)) return false;
  if (Array.isArray(p.kinds) && p.kinds.length && !p.kinds.includes(ev.product_kind)) return false;
  if (Array.isArray(p.langs) && p.langs.length && !p.langs.includes(ev.product_lang)) return false;
  if (p.goodPriceOnly !== false && Number(ev.market_cad) > 0 && Number(ev.price_cad) > Number(ev.market_cad) * 1.10) return false;
  if (Number(p.maxPrice) > 0 && Number(ev.price_cad) > Number(p.maxPrice)) return false;
  return true;
}

const money = (v, lang) => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD' }).format(v);
/** Notification text in the member's language. Pure. */
export function message(ev, lang = 'en', site = 'https://pokeflip-studio.vercel.app/') {
  const fr = lang === 'fr';
  const price = Number(ev.price_cad) > 0 ? money(Number(ev.price_cad), lang) : '';
  let verdict = '';
  if (Number(ev.market_cad) > 0 && Number(ev.price_cad) > 0) {
    const d = (Number(ev.market_cad) - Number(ev.price_cad)) / Number(ev.market_cad);
    verdict = d > 0.05 ? (fr ? ` · ${Math.round(d * 100)} % sous le marché` : ` · ${Math.round(d * 100)}% under market`)
      : d < -0.05 ? (fr ? ` · ${Math.round(-d * 100)} % au-dessus du marché` : ` · ${Math.round(-d * 100)}% over market`)
      : (fr ? ' · prix du marché' : ' · market price');
  }
  const where = [ev.store_name, ev.city].filter(Boolean).join(', ');
  return {
    title: (fr ? 'En stock : ' : 'In stock: ') + String(ev.product_name || '').slice(0, 80),
    body: `${where}${price ? ' · ' + price : ''}${verdict}${fr ? ' · vérifie avant de te déplacer' : ' · check before you go'}`,
    url: /^https:\/\//.test(ev.url || '') ? ev.url : site,
    tag: dedupeKey(ev),
    kind: KIND[ev.product_kind]?.[fr ? 1 : 0] || '',
    image: /^https:\/\//.test(ev.image_url || '') ? ev.image_url : undefined,
  };
}

/** One pass: send pending drops to matching members. deps: {store, send(sub, payload) -> {ok, gone}, now, site}. */
export async function runPush({ store, send, now, site, limit = 100 }) {
  // Drop delivery records are only for the 30-minute cooldown (price alerts keep theirs until the price rises again).
  await store.pruneDeliveries?.(new Date(now() - COOLDOWN_MS).toISOString());
  const events = await store.pendingEvents(limit);
  const out = { events: events.length, sent: 0, skipped: 0, removed: 0 };
  if (!events.length) return out;
  const subs = await store.subscriptions();
  for (const ev of events) {
    for (const sub of subs) {
      if (!matches(ev, sub.prefs)) continue;
      const key = dedupeKey(ev), last = await store.lastDelivery(sub.id, key);
      if (last && now() - Date.parse(last) < COOLDOWN_MS) { out.skipped++; continue; }
      const r = await send(sub, message(ev, sub.lang, site));
      if (r.gone) { await store.removeSubscription(sub.id); out.removed++; continue; }
      if (r.ok) { await store.recordDelivery(sub.id, key, new Date(now()).toISOString()); out.sent++; }
    }
    await store.markEvent(ev.id, new Date(now()).toISOString());
  }
  return out;
}

/** Database access for the sender (service role, inside Supabase only). */
export function pushStore({ url, serviceKey, fetch: f = globalThis.fetch }) {
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
    pendingEvents: (limit) => q('GET', `/drop_events?push_processed_at=is.null&order=created_at.asc&limit=${limit}`),
    markEvent: (id, at) => q('PATCH', `/drop_events?id=eq.${e(id)}`, { push_processed_at: at }),
    subscriptions: () => q('GET', '/push_subscriptions?select=id,user_id,kind,endpoint,p256dh,auth,prefs,lang&limit=10000'),
    // Only the saved cards of the backup, and only for members who asked for price alerts (price-alerts.mjs).
    watchlists: (users) => q('GET', `/pokeflip_snapshots?user_id=in.(${users.map(e).join(',')})&select=user_id,items:payload->ledger->items`),
    removeDelivery: (id, key) => q('DELETE', `/push_deliveries?subscription_id=eq.${e(id)}&dedupe_key=eq.${e(key)}`),
    pruneDeliveries: (before) => q('DELETE', `/push_deliveries?sent_at=lt.${e(before)}&dedupe_key=not.like.${e('price|')}*`),
    lastDelivery: async (id, key) => { const r = await q('GET', `/push_deliveries?subscription_id=eq.${e(id)}&dedupe_key=eq.${e(key)}&select=sent_at&limit=1`); return r && r[0] ? r[0].sent_at : null; },
    recordDelivery: (id, key, at) => q('POST', '/push_deliveries?on_conflict=subscription_id,dedupe_key', { subscription_id: id, dedupe_key: key, sent_at: at }, 'resolution=merge-duplicates,return=minimal'),
    removeSubscription: (id) => q('DELETE', `/push_subscriptions?id=eq.${e(id)}`),
  };
}
