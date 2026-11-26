// Price alerts while Cardstead is closed. Once a day: the target prices in a member's own cloud backup against
// TCGplayer's daily market prices (the website's data/sets files, the same figures the app shows).
// Only cards that match exactly are checked: ungraded, English, Near Mint, added from a set page (TCGplayer product,
// set and printing), and priced from sales, never from asking prices. Anything else is left alone.
// One notification per card and target; it can come again after the price has gone back above the target.

const MAX_AGE_MS = 3 * 24 * 3600 * 1000; // older price data is not worth waking anyone for
const num = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const id = (v) => Number.isInteger(v) && v > 0;

/** Can this saved watchlist card be priced exactly? Pure. */
export function eligible(i) {
  return !!i && typeof i.id === 'string' && i.id.length <= 100 && !i.archived && i.category !== 'review' && (i.grade || 'raw') === 'raw'
    && i.lang === 'en' && (!i.condition || i.condition === 'Near Mint') && !i.idCode
    && id(i.tcgplayerId) && id(i.tcgGroup) && typeof i.tcgPrint === 'string' && num(i.target);
}
/** The card's TCGplayer market price (recent sales) in CA$, or null. Pure. */
export function priceCad(setFile, item, usdToCad) {
  const card = (setFile?.cards || []).find((c) => c[0] === item.tcgplayerId);
  const usd = card?.[4]?.[item.tcgPrint];
  return num(usd) && num(usdToCad) ? Math.round(usd * usdToCad * 100) / 100 : null;
}
export const alertKey = (item) => `price|${item.id}|${item.target}`;

/** One notification for the cards that reached their target, in the member's language. Pure. */
export function priceMessage(hits, lang, asOf, site) {
  const fr = lang === 'fr', locale = fr ? 'fr-CA' : 'en-CA';
  const money = (v) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(v);
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(asOf));
  const name = (i) => [String(i.name || '').slice(0, 60), String(i.number || '').slice(0, 20)].filter(Boolean).join(' ');
  const line = (h) => `${name(h.item)}: ${money(h.cad)} (${fr ? 'cible' : 'target'} ${money(h.item.target)})`;
  const more = hits.length - 3;
  return {
    title: hits.length === 1 ? (fr ? `Prix cible atteint : ${name(hits[0].item)}` : `Target price reached: ${name(hits[0].item)}`)
      : (fr ? `${hits.length} cartes à ton prix cible` : `${hits.length} cards at your target price`),
    body: hits.slice(0, 3).map(line).join(' · ') + (more > 0 ? (fr ? ` · et ${more} de plus` : ` · and ${more} more`) : '')
      + (fr ? ` · prix du marché TCGplayer du ${date}` : ` · TCGplayer market price, ${date}`),
    url: site + '#/watchlist',
    tag: 'cardstead-price',
  };
}

/** One daily pass. deps: {store, send(sub, payload) -> {ok, gone}, getJson(url), now, site}. */
export async function runPriceAlerts({ store, send, getJson, now, site }) {
  const out = { members: 0, checked: 0, sent: 0, removed: 0, stale: false };
  const subs = (await store.subscriptions()).filter((s) => s.prefs?.priceAlerts === true && s.user_id);
  if (!subs.length) return out;
  const index = await getJson(site + 'data/sets/index.json');
  const asOf = Date.parse(index?.asOf || '');
  const fx = (await getJson(site + 'data/drop-catalogue.json'))?.fx?.usdToCad;
  if (!Number.isFinite(asOf) || now() - asOf > MAX_AGE_MS || !num(fx)) return { ...out, stale: true };
  const users = [...new Set(subs.map((s) => s.user_id))];
  out.members = users.length;
  const files = new Map();
  const setFile = async (group) => {
    if (!files.has(group)) files.set(group, await getJson(`${site}data/sets/${group}.json`).catch(() => null));
    return files.get(group);
  };
  for (let n = 0; n < users.length; n += 20) {
    // A few backups at a time: each can be large.
    for (const list of await store.watchlists(users.slice(n, n + 20))) {
      const cards = (Array.isArray(list.items) ? list.items : []).filter(eligible).slice(0, 500);
      const priced = [];
      for (const item of cards) {
        const cad = priceCad(await setFile(item.tcgGroup), item, fx);
        if (cad !== null) priced.push({ item, cad });
      }
      out.checked += priced.length;
      for (const sub of subs.filter((s) => s.user_id === list.user_id)) {
        const hits = [];
        for (const p of priced) {
          const key = alertKey(p.item), sent = await store.lastDelivery(sub.id, key);
          if (p.cad <= p.item.target) { if (!sent) hits.push(p); }
          else if (sent) await store.removeDelivery(sub.id, key);
        }
        if (!hits.length) continue;
        const r = await send(sub, priceMessage(hits, sub.lang, asOf, site));
        if (r.gone) { await store.removeSubscription(sub.id); out.removed++; continue; }
        if (!r.ok) continue;
        for (const h of hits) await store.recordDelivery(sub.id, alertKey(h.item), new Date(now()).toISOString());
        out.sent++;
      }
    }
  }
  return out;
}
