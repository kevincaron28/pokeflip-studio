// Cardstead Drops: pure logic for the Discord server (no network, no database).
// Used by the Supabase functions (Deno) and by tests/discord-bot.test.cjs (Node).

export const COOLDOWN_MS = 30 * 60 * 1000;
export const REPORT_TTL_MS = 30 * 60 * 1000;
export const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const STALE_AFTER = 2;            // "Wasn't there" taps that mark an alert stale
export const TRUSTED_AFTER = 10;         // confirmed reports before the Trusted reporter role
export const MARKETPLACE_RATIO = 1.3;    // price above MSRP x this is not a restock
export const SCALPER_RATIO = 1.5;
export const AMAZON_PRICE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // Amazon API terms: never show an Amazon price older than 24 h
export const FAIR_BAND = 0.05;

// Regions: one channel each, visible to its region role (Discord only notifies members who can see the channel).
export const REGIONS = [
  { key: 'qc-montreal', role: 'Montréal', en: 'Montréal area', fr: 'Région de Montréal' },
  { key: 'qc-quebec-regions', role: 'Québec regions', en: 'Québec City and regions', fr: 'Québec et régions' },
  { key: 'on-gta', role: 'GTA', en: 'Greater Toronto', fr: 'Grand Toronto' },
  { key: 'on-ottawa-other', role: 'Ottawa / Ontario', en: 'Ottawa and rest of Ontario', fr: 'Ottawa et reste de l’Ontario' },
  { key: 'bc', role: 'BC', en: 'British Columbia', fr: 'Colombie-Britannique' },
  { key: 'prairies', role: 'Prairies', en: 'Alberta, Saskatchewan, Manitoba', fr: 'Alberta, Saskatchewan, Manitoba' },
  { key: 'atlantic', role: 'Atlantic', en: 'Atlantic Canada', fr: 'Atlantique' },
  { key: 'online-canada', role: 'Online only', en: 'Online, ships in Canada', fr: 'En ligne, livré au Canada' },
];

// Chains: one channel each, visible to its store role.
export const CHAINS = [
  { key: 'pokemon-center', role: 'Pokémon Center', name: 'Pokémon Center' },
  { key: 'walmart', role: 'Walmart', name: 'Walmart' },
  { key: 'bestbuy-ebgames', role: 'Best Buy / EB Games', name: 'Best Buy / EB Games' },
  { key: 'costco', role: 'Costco', name: 'Costco' },
  { key: 'amazon-ca', role: 'Amazon', name: 'Amazon.ca' },
  { key: 'indigo-mastermind', role: 'Indigo / Mastermind', name: 'Indigo / Mastermind' },
  { key: 'pharmacies-grocery', role: 'Pharmacies & grocery', name: 'Shoppers, London Drugs, Superstore' },
];

// Product roles are the ones pinged. Japanese and Asian products use one role whatever their kind.
export const PRODUCTS = [
  { key: 'booster_box', role: 'Booster boxes' },
  { key: 'etb', role: 'ETB', kinds: ['etb', 'etb_pc'] },
  { key: 'bundle', role: 'Packs, bundles & blisters', kinds: ['pack', 'bundle', 'blister'] },
  { key: 'collection', role: 'Collections & tins', kinds: ['collection', 'tin', 'build_battle', 'other'] },
  { key: 'asian', role: 'Japanese & Asian' },
];
export const DEALS_ROLE = 'eBay deals';
export const TRUSTED_ROLE = 'Trusted reporter';
export const MOD_ROLE = 'Moderator';
export const LANGUAGE_ROLES = ['Français', 'English'];

export const CHANNELS = {
  start: ['bienvenue-welcome', 'how-alerts-work', 'speed-log'],
  chains: CHAINS.map((c) => c.key),
  regions: REGIONS.map((r) => r.key),
  deals: ['ebay-deals', 'under-market'],
  members: ['report-a-drop', 'price-check', 'general', 'général', 'pulls-collections', 'help-aide'],
  mods: ['mod-queue'],
};

const KINDS = ['booster_box', 'etb', 'etb_pc', 'pack', 'bundle', 'blister', 'build_battle', 'collection', 'tin', 'other'];
const LANGS = ['EN', 'FR', 'JP'];
const SOURCES = ['shop_check', 'retailer_email', 'amazon_api', 'member_report'];
const CONF = ['high', 'medium', 'low'];

const cadFmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
export const cad = (v) => (Number.isFinite(v) ? 'CA$' + cadFmt.format(v).replace(/^[^0-9-]+/, '') : '—');
const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const httpsUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };

/** Checks one row from public.drop_events and returns a clean copy, or throws. */
export function normalizeEvent(e) {
  if (!e || typeof e !== 'object') throw Error('event missing');
  const out = {
    id: String(e.id || ''),
    product_key: String(e.product_key || '').slice(0, 200),
    product_name: String(e.product_name || '').trim().slice(0, 200),
    product_lang: String(e.product_lang || 'EN').toUpperCase(),
    product_kind: String(e.product_kind || 'other'),
    store_key: String(e.store_key || '').slice(0, 120),
    store_name: String(e.store_name || '').trim().slice(0, 120),
    chain_key: e.chain_key ? String(e.chain_key) : null,
    region: e.region ? String(e.region) : null,
    city: e.city ? String(e.city).slice(0, 80) : null,
    url: httpsUrl(e.url),
    price_cad: num(e.price_cad),
    msrp_cad: num(e.msrp_cad),
    seller: e.seller === 'marketplace' ? 'marketplace' : 'store',
    in_stock: e.in_stock !== false,
    limit_per_order: Number.isInteger(e.limit_per_order) && e.limit_per_order > 0 ? e.limit_per_order : null,
    source: String(e.source || ''),
    confidence: String(e.confidence || 'low'),
    first_seen_at: e.first_seen_at ? new Date(e.first_seen_at).toISOString() : null,
    market_cad: num(e.market_cad),
    market_source: e.market_source ? String(e.market_source).slice(0, 60) : null,
    market_as_of: e.market_as_of ? String(e.market_as_of).slice(0, 10) : null,
    image_url: httpsUrl(e.image_url),
    cardstead_url: httpsUrl(e.cardstead_url),
    reporter_id: e.reporter_id ? String(e.reporter_id) : null,
    product_upc: e.product_upc ? String(e.product_upc).replace(/\D/g, '').slice(0, 14) || null : null,
    matched_by: e.matched_by === 'title' ? 'title' : e.matched_by === 'barcode' ? 'barcode' : null,
  };
  // A title match is never more than Medium: only a barcode proves it is the same box.
  if (out.matched_by === 'title' && out.confidence === 'high') out.confidence = 'medium';
  if (!out.id || !out.product_key || !out.product_name || !out.store_key || !out.store_name) throw Error('event is missing product or store');
  if (!LANGS.includes(out.product_lang)) throw Error('bad product_lang');
  if (!KINDS.includes(out.product_kind)) throw Error('bad product_kind');
  if (!SOURCES.includes(out.source)) throw Error('bad source');
  if (!CONF.includes(out.confidence)) throw Error('bad confidence');
  if (out.chain_key && !CHAINS.some((c) => c.key === out.chain_key)) throw Error('unknown chain');
  if (!out.chain_key && !REGIONS.some((r) => r.key === out.region)) throw Error('card shop event needs a known region');
  if (!out.first_seen_at || Number.isNaN(Date.parse(out.first_seen_at))) throw Error('bad first_seen_at');
  return out;
}

export const postKey = (e) => `${e.product_key}|${e.store_key}`;
export const channelFor = (e) => e.chain_key || e.region;

export function productRole(e) {
  if (e.product_lang === 'JP') return 'Japanese & Asian';
  return PRODUCTS.find((p) => (p.kinds || [p.key]).includes(e.product_kind))?.role || 'Collections & tins';
}

export function isMarketplace(e) {
  return e.seller === 'marketplace' || (e.msrp_cad > 0 && e.price_cad > e.msrp_cad * MARKETPLACE_RATIO);
}

/** Amazon prices may only be shown when they came from Amazon's own API, and for at most 24 hours. */
export const amazonPriceExpired = (e, now) => e.source === 'amazon_api' && Number.isFinite(now) && now - Date.parse(e.first_seen_at) > AMAZON_PRICE_MAX_AGE_MS;
export const showPrice = (e, now) => e.price_cad !== null && !(e.chain_key === 'amazon-ca' && e.source !== 'amazon_api') && !amazonPriceExpired(e, now);

export function verdict(price, market, msrp) {
  if (!Number.isFinite(price)) return { key: 'unknown', en: 'Value unknown', fr: 'Valeur inconnue' };
  const scalper = Number.isFinite(msrp) && msrp > 0 && price >= msrp * SCALPER_RATIO;
  if (Number.isFinite(market) && market > 0) {
    const d = (price - market) / market;
    if (d < -FAIR_BAND) return { key: 'under', en: `Under value by ${cad(market - price)}`, fr: `Sous la valeur de ${cad(market - price)}` };
    if (d > FAIR_BAND) return scalper
      ? { key: 'scalper', en: `Scalper price, ${cad(price - market)} over value`, fr: `Prix de revendeur, ${cad(price - market)} au-dessus` }
      : { key: 'over', en: `Over value by ${cad(price - market)}`, fr: `Au-dessus de la valeur de ${cad(price - market)}` };
    return { key: 'fair', en: 'Fair', fr: 'Juste' };
  }
  if (scalper) return { key: 'scalper', en: 'Scalper price vs MSRP', fr: 'Prix de revendeur vs PDSF' };
  if (Number.isFinite(msrp) && msrp > 0) {
    if (price < msrp * 0.98) return { key: 'under', en: `Under MSRP by ${cad(msrp - price)}`, fr: `Sous le PDSF de ${cad(msrp - price)}` };
    if (price <= msrp * 1.02) return { key: 'fair', en: 'At MSRP', fr: 'Au PDSF' };
    return { key: 'over', en: `Over MSRP by ${cad(price - msrp)}`, fr: `Au-dessus du PDSF de ${cad(price - msrp)}` };
  }
  return { key: 'unknown', en: 'Value unknown', fr: 'Valeur inconnue' };
}

const HOW = {
  shop_check: { en: 'shop data seen twice', fr: 'données de la boutique vues deux fois' },
  retailer_email: { en: "retailer's own email", fr: 'courriel du détaillant' },
  amazon_api: { en: "Amazon's API, sold by Amazon.ca", fr: 'API d’Amazon, vendu par Amazon.ca' },
  member_report: { en: 'member report', fr: 'signalement de membre' },
};

/**
 * Decides what to do with a new event given the existing post for the same product at the same store.
 * Returns { action: 'post'|'edit'|'skip', state, ping, reason }.
 * One ping per restock: only a sold-out (or never seen) -> in-stock change pings, and never within 30 min of the last ping.
 */
export function planAlert(e, prev, now) {
  if (e.confidence === 'low') return { action: 'skip', reason: 'low confidence is never posted' };
  if (amazonPriceExpired(e, now)) return { action: 'skip', reason: 'Amazon price older than 24 h' };
  const live = prev && prev.state === 'live';
  if (!e.in_stock) return live ? { action: 'edit', state: 'sold_out', ping: false, reason: 'sold out' } : { action: 'skip', reason: 'sold out, nothing live' };
  const market = isMarketplace(e);
  if (live) return { action: 'edit', state: 'live', ping: false, reason: 'still in stock' };
  const cooling = prev && prev.pinged_at && now - Date.parse(prev.pinged_at) < COOLDOWN_MS;
  if (prev && cooling) return { action: 'edit', state: 'live', ping: false, reason: 'back in stock inside cooldown' };
  return { action: 'post', state: 'live', ping: !market, marketplace: market, reason: market ? 'marketplace price' : 'restock' };
}

// Same rules as the app's affiliate.js (one setting: AMAZON_ASSOCIATES_TAG, served by the site's /api/config).
export const AMAZON_TAG = /^[a-z0-9][a-z0-9-]{1,38}-20$/;
export function amazonLink(url, tag) {
  if (!tag || !AMAZON_TAG.test(tag) || typeof url !== 'string') return url;
  let u; try { u = new URL(url); } catch { return url; }
  if (u.protocol !== 'https:' || !/^(www\.)?amazon\.ca$/.test(u.hostname)) return url;
  if (/^\/gp\/aws\/cart\/add\.html$/.test(u.pathname)) u.searchParams.set('AssociateTag', tag); else u.searchParams.set('tag', tag);
  return u.href;
}

const COLORS = { under: 0x2fbf71, fair: 0x3fa7d6, over: 0xe0a030, scalper: 0xd9534f, unknown: 0x8a96a3, sold_out: 0x5c6670, stale: 0x5c6670, marketplace: 0xe0a030 };
const unix = (iso) => Math.floor(Date.parse(iso) / 1000);

/**
 * Builds the Discord message (content + embed + buttons) for an alert.
 * state: 'live' | 'sold_out' | 'stale'. opts: { ping, roleIds:{name:id}, postId, siteUrl, amazonTag, seenAt, wasntThere }
 */
export function alertMessage(e, state, opts = {}) {
  const v = verdict(e.price_cad, e.market_cad, e.msrp_cad);
  const market = isMarketplace(e);
  const head = state === 'sold_out' ? 'Sold out · Épuisé'
    : state === 'stale' ? 'Reported not there · Signalé absent'
      : market ? 'Marketplace price, not a restock · Prix d’un vendeur tiers' : 'Restock · Retour en stock';
  const where = e.city || (e.chain_key ? null : REGIONS.find((r) => r.key === e.region)?.en) || 'Online · En ligne';
  const fields = [
    { name: 'Store · Boutique', value: `${e.store_name}${where ? `\n${where}` : ''}`, inline: true },
    { name: 'Price · Prix', value: showPrice(e, opts.now) ? cad(e.price_cad) : 'Check price at Amazon · Voir le prix sur Amazon', inline: true },
    { name: 'Value · Valeur', value: showPrice(e, opts.now) ? `${v.en}\n${v.fr}` : '—', inline: true },
    { name: 'Seller · Vendeur', value: market ? 'Marketplace seller · Vendeur tiers' : 'The store · Le magasin', inline: true },
    { name: 'Confidence · Confiance', value: `${e.confidence === 'high' ? 'High · Élevée' : 'Medium · Moyenne'}\n${e.source === 'shop_check' && e.matched_by === 'title' ? 'shop data, matched by title' : HOW[e.source].en}`, inline: true },
    { name: 'First seen · Vu', value: `<t:${unix(e.first_seen_at)}:R>`, inline: true },
  ];
  if (e.limit_per_order) fields.push({ name: 'Limit · Limite', value: `${e.limit_per_order} per order · par commande`, inline: true });
  if (opts.wasntThere) fields.push({ name: "Wasn't there · Pas là", value: `${opts.wasntThere} member(s) · membre(s)`, inline: true });
  const foot = [];
  if (e.market_cad) foot.push(`Market ${cad(e.market_cad)}${e.market_source ? ` (${e.market_source}${e.market_as_of ? ', ' + e.market_as_of : ''})` : ''}`);
  else foot.push('No market match · Aucune valeur de marché');
  if (e.msrp_cad) foot.push(`MSRP ${cad(e.msrp_cad)}`);
  if (e.matched_by === 'title') foot.push('Matched by title, not barcode · Associé par le titre');
  if (e.chain_key === 'amazon-ca') foot.push('As an Amazon Associate I earn from qualifying purchases.');
  if (opts.seenAt && state === 'live') foot.push('Still in stock · Toujours en stock');
  const embed = {
    title: head,
    description: `**${e.product_name}** · ${e.product_lang}`,
    color: COLORS[state === 'live' ? (market ? 'marketplace' : v.key) : state],
    fields,
    footer: { text: foot.join(' · ').slice(0, 2000) },
    timestamp: opts.seenAt || e.first_seen_at,
  };
  if (e.image_url) embed.thumbnail = { url: e.image_url };
  const buttons = [];
  const storeUrl = e.chain_key === 'amazon-ca' ? amazonLink(e.url, opts.amazonTag) : e.url;
  if (storeUrl && state !== 'sold_out') buttons.push({ type: 2, style: 5, label: 'Open at store · Ouvrir', url: storeUrl });
  const cs = e.cardstead_url || opts.siteUrl;
  if (cs) buttons.push({ type: 2, style: 5, label: 'View in Cardstead', url: cs });
  if (opts.postId && state === 'live') buttons.push({ type: 2, style: 2, label: "Wasn't there · Pas là", custom_id: `wt:${opts.postId}` });
  const roleId = opts.ping ? opts.roleIds?.[productRole(e)] : null;
  return {
    content: roleId ? `<@&${roleId}>` : '',
    embeds: [embed],
    components: buttons.length ? [{ type: 1, components: buttons }] : [],
    allowed_mentions: { parse: [], roles: roleId ? [roleId] : [] },
  };
}

// ---------- Member reports ----------

const DISCORD_EPOCH = 1420070400000n;
export function accountCreatedAt(snowflake) {
  try { return Number((BigInt(snowflake) >> 22n) + DISCORD_EPOCH); } catch { return NaN; }
}
export const oldEnough = (userId, now) => now - accountCreatedAt(userId) >= MIN_ACCOUNT_AGE_MS;

export function kindFromText(t) {
  const s = String(t).toLowerCase();
  if (/\b(etb|elite trainer|coffret dresseur)/.test(s)) return /pok[eé]mon center|\bpc\b/.test(s) ? 'etb_pc' : 'etb';
  if (/build (&|and) battle|avant-premi[eè]re/.test(s)) return 'build_battle';
  if (/booster (box|display)|bo[iî]te de boosters|display\b/.test(s)) return 'booster_box';
  if (/bundle|lot de boosters/.test(s)) return 'bundle';
  if (/blister|3-pack|three-booster|tripack/.test(s)) return 'blister';
  if (/booster pack|\bpack\b|sachet/.test(s)) return 'pack';
  if (/\btin\b|boîte métal|pokéball tin/.test(s)) return 'tin';
  if (/collection|coffret|premium|box\b/.test(s)) return 'collection';
  return 'other';
}
const slug = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Validates the /report options. Returns { report } or { error } (bilingual message). */
export function validateReport(o, userId, now) {
  const product = String(o.product || '').trim();
  const store = String(o.store || '').trim();
  const region = String(o.region || '');
  const chain = o.chain ? String(o.chain) : null;
  const link = o.link ? httpsUrl(o.link) : null;
  const photo = o.photo ? httpsUrl(o.photo) : null;
  const price = num(o.price);
  if (!oldEnough(userId, now)) return { error: 'Reports need a Discord account at least 7 days old. · Il faut un compte Discord d’au moins 7 jours.' };
  if (product.length < 4 || product.length > 160) return { error: 'Name the product (4 to 160 characters). · Indique le produit.' };
  if (store.length < 2 || store.length > 100) return { error: 'Name the store. · Indique le magasin.' };
  if (!REGIONS.some((r) => r.key === region)) return { error: 'Pick a region. · Choisis une région.' };
  if (chain && !CHAINS.some((c) => c.key === chain)) return { error: 'Unknown chain. · Chaîne inconnue.' };
  if (o.link && !link) return { error: 'The link must start with https://. · Le lien doit commencer par https://.' };
  if (!link && !photo) return { error: 'Add a link or a photo so others can check. · Ajoute un lien ou une photo.' };
  if (price !== null && (price <= 0 || price > 20000)) return { error: 'Price looks wrong. · Le prix semble erroné.' };
  const lang = LANGS.includes(String(o.lang || 'EN').toUpperCase()) ? String(o.lang || 'EN').toUpperCase() : 'EN';
  return {
    report: {
      reporter_id: String(userId), product_name: product, product_lang: lang, product_kind: kindFromText(product),
      product_key: `report:${slug(product)}:${lang}`, store_name: store, store_key: `report:${slug(store)}:${region}`,
      region, chain_key: chain, city: o.city ? String(o.city).slice(0, 80) : null, price_cad: price, link, photo,
      status: 'pending', created_at: new Date(now).toISOString(), expires_at: new Date(now + REPORT_TTL_MS).toISOString(),
    },
  };
}

/** Can this member confirm this report? */
export function canConfirm(report, userId, memberRoleNames, now) {
  if (!report || report.status !== 'pending') return { ok: false, why: 'This report is closed. · Ce signalement est fermé.' };
  if (Date.parse(report.expires_at) <= now) return { ok: false, why: 'This report expired. · Ce signalement a expiré.' };
  if (String(userId) === String(report.reporter_id)) return { ok: false, why: 'A second member has to confirm. · Un autre membre doit confirmer.' };
  const vouched = memberRoleNames.includes(TRUSTED_ROLE) || memberRoleNames.includes(MOD_ROLE);
  if (!vouched && !oldEnough(userId, now)) return { ok: false, why: 'Confirming needs a Discord account at least 7 days old. · Il faut un compte d’au moins 7 jours.' };
  return { ok: true };
}

/** Turns a confirmed (or trusted) report into a drop event the publisher handles like any other. */
export function reportToEvent(r, { id, confirmed, now }) {
  return {
    id, product_key: r.product_key, product_name: r.product_name, product_lang: r.product_lang, product_kind: r.product_kind,
    store_key: r.store_key, store_name: r.store_name, chain_key: r.chain_key, region: r.region, city: r.city,
    url: r.link || r.photo, price_cad: r.price_cad, seller: 'store', in_stock: true, source: 'member_report',
    confidence: confirmed ? 'high' : 'medium', first_seen_at: r.created_at, reporter_id: r.reporter_id,
    event_key: eventKey(r.store_key, r.product_key, true, now), created_at: new Date(now).toISOString(),
  };
}

/** Producers' idempotency key: store|product|in_stock|UTC date-hour. */
export const eventKey = (store, product, inStock, now) => `${store}|${product}|${inStock}|${new Date(now).toISOString().slice(0, 13)}`;

export function reportMessage(r, state) {
  const label = { pending: 'Waiting for a second member · En attente d’un 2e membre', confirmed: 'Confirmed · Confirmé', expired: 'Expired, not confirmed · Expiré', posted: 'Posted by a trusted reporter · Publié par un membre de confiance' }[state];
  const embed = {
    title: `Member report · Signalement — ${label}`,
    description: `**${r.product_name}** · ${r.product_lang}`,
    color: state === 'expired' ? 0x5c6670 : state === 'pending' ? 0xe0a030 : 0x2fbf71,
    fields: [
      { name: 'Store · Boutique', value: `${r.store_name}${r.city ? `, ${r.city}` : ''}`, inline: true },
      { name: 'Price · Prix', value: r.price_cad ? cad(r.price_cad) : '—', inline: true },
      { name: 'Reported by · Par', value: `<@${r.reporter_id}>`, inline: true },
    ],
    timestamp: r.created_at,
  };
  if (r.photo) embed.image = { url: r.photo };
  const buttons = [];
  if (r.link) buttons.push({ type: 2, style: 5, label: 'Open link · Ouvrir', url: r.link });
  if (state === 'pending') buttons.push({ type: 2, style: 3, label: 'I see it too · Je le vois aussi', custom_id: `rc:${r.id}` });
  return { content: '', embeds: [embed], components: buttons.length ? [{ type: 1, components: buttons }] : [], allowed_mentions: { parse: [] } };
}

export const isTrustedNow = (stats) => stats.good >= TRUSTED_AFTER && stats.bad * 3 < stats.good;

// ---------- Opt-in DMs for linked Cardstead members ----------

// "Elite Trainer Box", "ETB" and "coffret dresseur d'élite" are the same thing.
const words = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/elite trainer box/g, 'etb').replace(/coffret dresseur d.?elite/g, 'etb')
  .split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
const FORMAT_KINDS = { box: ['booster_box'], etb: ['etb', 'etb_pc'], bundle: ['bundle', 'blister'], pack: ['pack', 'blister', 'bundle'], collection: ['collection', 'tin', 'build_battle'], tin: ['tin', 'collection'], any: KINDS };

/** Cardstead restock watch rule (from the user's cloud backup) that matches this alert, or null. */
export function matchingWatch(e, watches, now) {
  if (!Array.isArray(watches) || !e.in_stock || isMarketplace(e) || !showPrice(e, now)) return null;
  const have = new Set(words(e.product_name));
  for (const w of watches) {
    if (!w || !w.enabled || !(w.ceiling >= e.price_cad)) continue;
    if (w.language && w.language !== 'any' && w.language.toUpperCase() !== e.product_lang) continue;
    if (!(FORMAT_KINDS[w.format] || KINDS).includes(e.product_kind)) continue;
    const need = words(w.product);
    // The Pokémon Center ETB is its own product: only a watch that names it matches.
    if (e.product_kind === 'etb_pc' && !need.includes('center')) continue;
    if (need.length >= 2 && need.every((x) => have.has(x))) return w;
  }
  return null;
}

// ---------- Weekly speed log ----------

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** posts: [{ store_name, first_seen_at, posted_at, state, wasnt_there }] from the last 7 days. */
export function speedLog(posts, now) {
  const by = new Map();
  for (const p of posts) {
    const k = p.store_name; if (!by.has(k)) by.set(k, []); by.get(k).push(p);
  }
  const rows = [...by.entries()].map(([store, ps]) => ({
    store, alerts: ps.length,
    minutes: median(ps.map((p) => (Date.parse(p.posted_at) - Date.parse(p.first_seen_at)) / 60000).filter((m) => m >= 0)),
    stale: ps.filter((p) => p.state === 'stale').length,
  })).sort((a, b) => b.alerts - a.alerts);
  const from = new Date(now - 7 * 864e5).toISOString().slice(0, 10), to = new Date(now).toISOString().slice(0, 10);
  const lines = rows.slice(0, 25).map((r) => `**${r.store}** · ${r.alerts} alert(s) · ${r.minutes === null ? '—' : `${Math.round(r.minutes * 10) / 10} min`} median · ${r.stale ? `${Math.round((r.stale / r.alerts) * 100)}% wasn't there` : 'no false alerts'}`);
  const total = rows.reduce((s, r) => s + r.alerts, 0), stale = rows.reduce((s, r) => s + r.stale, 0);
  return {
    rows,
    message: {
      content: '',
      embeds: [{
        title: `Speed log · Rapidité — ${from} → ${to}`,
        description: (lines.length ? lines.join('\n') : 'No alerts this week. · Aucune alerte cette semaine.').slice(0, 4000),
        color: 0x3fa7d6,
        footer: { text: `${total} alert(s), ${stale} reported not there. Minutes = first seen → posted. · Minutes = première vue → publication.` },
      }],
      allowed_mentions: { parse: [] },
    },
  };
}

// ---------- Price check ----------

const TG_KEYS = ['holofoil', 'normal', 'reverse-holofoil', '1stEditionHolofoil', '1stEditionNormal', 'unlimitedHolofoil'];
/** Reference quotes for one TCGdex card in CAD. fx = { USD, EUR } -> CAD. */
export function priceQuotes(card, fx) {
  const out = [];
  const tg = card?.pricing?.tcgplayer, cm = card?.pricing?.cardmarket;
  if (tg && (!tg.unit || tg.unit === 'USD') && fx.USD) {
    for (const k of TG_KEYS) { const p = num(tg[k]?.marketPrice); if (p > 0) { out.push({ source: `TCGplayer (${k}, sold)`, cad: p * fx.USD, date: String(tg.updated || '').slice(0, 10) }); break; } }
  }
  if (cm && (!cm.unit || cm.unit === 'EUR') && fx.EUR) { const p = num(cm.trend) || num(cm.avg); if (p > 0) out.push({ source: 'Cardmarket (trend, EU)', cad: p * fx.EUR, date: String(cm.updated || '').slice(0, 10) }); }
  let confidence = out.length ? 'low' : null;
  if (out.length === 2) { const [a, b] = out.map((q) => q.cad), gap = Math.abs(a - b) / Math.min(a, b); confidence = gap <= 0.25 ? 'high' : gap <= 0.4 ? 'medium' : 'low'; }
  return { quotes: out, confidence };
}

export function priceMessage(card, quotes, confidence, lang, siteUrl) {
  if (!card) return { content: lang === 'fr' ? 'Aucune carte trouvée. Essaie « nom numéro », par ex. « noctali 215 ».' : 'No card found. Try "name number", e.g. "umbreon 215".', allowed_mentions: { parse: [] } };
  const conf = { high: 'High · Élevée', medium: 'Medium · Moyenne', low: 'Low · Faible (one source or sources disagree)' }[confidence] || 'None · Aucune';
  const embed = {
    title: `${card.name} · ${card.localId}${card.set?.cardCount?.official ? '/' + card.set.cardCount.official : ''}`,
    description: `${card.set?.name || ''} · ${lang === 'fr' ? 'FR' : 'EN'}\nReference prices, not Canadian sales · Prix de référence, pas des ventes au Canada`,
    color: 0x3fa7d6,
    fields: quotes.length ? quotes.map((q) => ({ name: q.source, value: `${cad(q.cad)}${q.date ? ` · ${q.date}` : ''}`, inline: true })) : [{ name: 'Price · Prix', value: 'No price data · Aucune donnée de prix' }],
    footer: { text: `Confidence · Confiance: ${conf}. Converted at Bank of Canada rates. Near Mint, raw. · Taux de la Banque du Canada.` },
  };
  if (card.image) embed.thumbnail = { url: `${card.image}/low.webp` };
  if (lang === 'fr' && quotes.length) embed.footer.text += ' French card priced from the English listing. · Carte FR évaluée d’après l’anglais.';
  return { content: '', embeds: [embed], components: siteUrl ? [{ type: 1, components: [{ type: 2, style: 5, label: 'View in Cardstead', url: siteUrl }] }] : [], allowed_mentions: { parse: [] } };
}

/** "umbreon vmax 215" -> { name: 'umbreon vmax', number: '215' } */
export function parseCardQuery(q) {
  const s = String(q || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const m = s.match(/^(.*?)\s+#?(\d{1,3}[a-z]?)(?:\/\d+)?$/i);
  return m ? { name: m[1], number: m[2] } : { name: s, number: null };
}

// ---------- Slash commands ----------

const regionChoices = REGIONS.map((r) => ({ name: `${r.en} · ${r.fr}`.slice(0, 100), value: r.key }));
const chainChoices = CHAINS.map((c) => ({ name: c.name, value: c.key }));
export const COMMANDS = [
  { name: 'price', description: 'Card value in CA$ with sources and confidence', options: [{ type: 3, name: 'card', description: 'Name and number, e.g. umbreon 215', required: true }] },
  { name: 'prix', description: 'Valeur d’une carte en $ CA avec sources et confiance', options: [{ type: 3, name: 'carte', description: 'Nom et numéro, ex. noctali 215', required: true }] },
  {
    name: 'report', description: 'Report a drop you see in stock · Signaler un drop', options: [
      { type: 3, name: 'product', description: 'Product, e.g. Delta Reign ETB', required: true },
      { type: 3, name: 'store', description: 'Store name', required: true },
      { type: 3, name: 'region', description: 'Region', required: true, choices: regionChoices },
      { type: 3, name: 'chain', description: 'Chain, if it is one', required: false, choices: chainChoices },
      { type: 3, name: 'city', description: 'City or store location', required: false },
      { type: 10, name: 'price', description: 'Price in CA$', required: false },
      { type: 3, name: 'link', description: 'https:// link to the product page', required: false },
      { type: 11, name: 'photo', description: 'Photo of the shelf or page', required: false },
      { type: 3, name: 'lang', description: 'Product language', required: false, choices: [{ name: 'English', value: 'EN' }, { name: 'Français', value: 'FR' }, { name: 'Japanese', value: 'JP' }] },
    ],
  },
  { name: 'link', description: 'Link Cardstead for DMs about your own watches · Lier Cardstead' },
  { name: 'flag', description: 'Send a message to the moderators · Alerter les modérateurs', options: [{ type: 3, name: 'reason', description: 'What is wrong', required: true }] },
];

export function linkCode(rand) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, (_, i) => abc[rand[i] % abc.length]).join('');
}

// ---------- Onboarding and the welcome message ----------

export const WELCOME_TITLE = 'Cardstead Drops: rules and how alerts work · Règles et fonctionnement';
const ONBOARDING_EPOCH = 1420070400000n;
/** A snowflake-shaped id for a new onboarding prompt or option (Discord keeps ids we send; existing ones are reused). */
export const newSnowflake = (now, i) => String(((BigInt(now) - ONBOARDING_EPOCH) << 22n) + BigInt(i));

/** The channels anyone can see on joining. Discord asks for at least 7, at least 5 of them where @everyone can write. */
export const ONBOARDING_DEFAULT_CHANNELS = ['bienvenue-welcome', 'how-alerts-work', 'speed-log', 'ebay-deals', 'under-market', 'price-check', 'general', 'général', 'pulls-collections', 'help-aide'];
export const ONBOARDING_WRITABLE = ['price-check', 'general', 'général', 'pulls-collections', 'help-aide'];

/**
 * PUT /guilds/{id}/onboarding body. roles/channels: name -> id. existing: the current onboarding (GET), whose prompt and
 * option ids are reused by title so a re-run edits instead of replacing. Throws if a role or channel is missing.
 */
export function onboardingBody({ roles, channels, existing, now }) {
  let n = 0;
  const old = new Map((existing?.prompts || []).map((p) => [p.title, p]));
  const need = (map, name, what) => { if (!map[name]) throw Error(`missing ${what} ${name} (run setup first)`); return map[name]; };
  const prompt = (title, single, options) => {
    const was = old.get(title);
    const oldOpt = new Map((was?.options || []).map((o) => [o.title, o.id]));
    return {
      id: was?.id || newSnowflake(now, n++), type: 0, title, single_select: single, required: false, in_onboarding: true,
      options: options.map(([t, desc, roleName]) => ({ id: oldOpt.get(t) || newSnowflake(now, n++), title: t.slice(0, 50), description: desc ? desc.slice(0, 100) : null, role_ids: [need(roles, roleName, 'role')], channel_ids: [] })),
    };
  };
  const prompts = [
    prompt('Region / Région', false, REGIONS.map((r) => [r.role, `${r.en} · ${r.fr}`, r.role])),
    prompt('Stores / Magasins', false, [...CHAINS.map((c) => [c.role, c.name, c.role]), ['Online only', 'Online shops that ship in Canada · Boutiques en ligne', 'Online only']]),
    prompt('Products / Produits', false, [...PRODUCTS.map((p) => [p.role, null, p.role]), [DEALS_ROLE, 'eBay.ca listings under value · Annonces eBay.ca sous la valeur', DEALS_ROLE]]),
    prompt('Language / Langue', true, LANGUAGE_ROLES.map((l) => [l, l === 'Français' ? 'Discussion en français' : 'English chat', l])),
  ];
  return { prompts, default_channel_ids: ONBOARDING_DEFAULT_CHANNELS.map((c) => need(channels, c, 'channel')), enabled: true, mode: 0 };
}

/** The one message in #bienvenue-welcome: rules and how alerts work, English then French. Re-runs edit it. */
export function welcomeMessage(siteUrl) {
  const site = siteUrl || 'https://pokeflip-studio.vercel.app/';
  const en = [
    '**Welcome!** Free Pokémon TCG drop alerts for Canada, run by Cardstead. No paid tiers, no paid speed.',
    '',
    '**Pick your pings:** Channels & Roles (top of the channel list) → your region, stores, products and language. You are pinged only for products you picked, in places you picked.',
    '',
    '**How alerts work**',
    '• Card shops, Indigo and Mastermind: their public shop data is checked every few minutes and must be seen twice.',
    '• Big chains (Walmart, Best Buy, EB Games, Costco, Pokémon Center): their own emails and member reports. We never get around their bot protection, so these can be minutes behind other servers.',
    '• Every alert shows the CA$ price against market value, the seller and a confidence level. Marketplace sellers are never posted as restocks.',
    '• Tap **Wasn’t there** when an alert is wrong; two taps mark it stale. Weekly speed and accuracy go to #speed-log.',
    '• Saw stock yourself? `/report` with a link or photo. A second member confirms it.',
    '',
    '**Rules**',
    '1. Be kind. No harassment, hate or spam.',
    '2. No selling, trading, invites to other servers or “DM me” offers.',
    '3. No bots, auto-checkout tools or anything that gets around a store’s rules.',
    '4. Reports must be real: false reports cost the Trusted reporter role.',
    '5. English in #general, French in #général. Use `/flag` to reach the moderators.',
    '',
    `Prices are asking prices or market references, never guaranteed. Privacy: ${site}privacy.html`,
    'As an Amazon Associate Cardstead earns from qualifying purchases.',
  ];
  const fr = [
    '**Bienvenue!** Alertes gratuites de drops Pokémon TCG au Canada, par Cardstead. Pas d’abonnement, pas de vitesse payante.',
    '',
    '**Choisis tes alertes :** Salons et rôles (en haut de la liste) → ta région, tes magasins, tes produits et ta langue. Tu es mentionné seulement pour ce que tu as choisi.',
    '',
    '**Fonctionnement**',
    '• Boutiques, Indigo et Mastermind : leurs données publiques sont vérifiées aux quelques minutes et doivent être vues deux fois.',
    '• Grandes chaînes (Walmart, Best Buy, EB Games, Costco, Pokémon Center) : leurs propres courriels et les signalements des membres. On ne contourne jamais leur protection anti-robots, donc ces alertes peuvent avoir quelques minutes de retard.',
    '• Chaque alerte montre le prix en $ CA face à la valeur du marché, le vendeur et un niveau de confiance. Les vendeurs tiers ne sont jamais publiés comme un réassort.',
    '• Clique **Pas là** si une alerte est fausse; deux clics la marquent périmée. La rapidité et la précision de la semaine vont dans #speed-log.',
    '• Tu vois du stock? `/report` avec un lien ou une photo. Un autre membre confirme.',
    '',
    '**Règles**',
    '1. Sois respectueux. Pas de harcèlement, de haine ni de pourriel.',
    '2. Pas de vente, d’échange, d’invitations vers d’autres serveurs ni d’offres « écris-moi en privé ».',
    '3. Pas de robots, d’outils d’achat automatique ni rien qui contourne les règles d’un magasin.',
    '4. Les signalements doivent être vrais : les faux font perdre le rôle de membre de confiance.',
    '5. Anglais dans #general, français dans #général. Utilise `/flag` pour joindre les modérateurs.',
    '',
    `Les prix sont des prix demandés ou des références, jamais garantis. Confidentialité : ${site}privacy.html`,
  ];
  return {
    content: '',
    allowed_mentions: { parse: [] },
    embeds: [
      { title: WELCOME_TITLE, color: 0x3fa7d6, description: en.join('\n').slice(0, 4000) },
      { title: 'Version française', color: 0x3fa7d6, description: fr.join('\n').slice(0, 4000) },
    ],
  };
}
