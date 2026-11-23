#!/usr/bin/env node
/* Builds pack-ev-data.js: a dated snapshot of TCGplayer market prices (single cards and the
 * sealed single booster pack) for English Pokémon sets, plus the Bank of Canada USD→CAD rate.
 *
 * Sources
 *  - TCGplayer prices through tcgcsv.com (daily public mirror of TCGplayer's catalog and market
 *    prices). Its usage guidelines ask apps to download once and serve the saved copy, with a
 *    named User-Agent, so the app never calls tcgcsv.com itself.
 *  - Bank of Canada Valet API, series FXUSDCAD (daily average rate).
 *
 * Run: node tools/build-pack-ev.mjs            (writes ./pack-ev-data.js)
 * No credentials are needed or used.
 */
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = {headers: {'User-Agent': 'Cardstead-PackEV/1.0'}};
const TCGCSV = 'https://tcgcsv.com';
const CATEGORY = 3; // Pokémon (English)
const ERAS = [
  {prefix: /^ME\d*:\s*|^ME:\s*/, era: 'Mega Evolution', code: 'me'},
  {prefix: /^SV\d*:\s*|^SV:\s*/, era: 'Scarlet & Violet', code: 'sv'},
  {prefix: /^SWSH\d*:\s*/, era: 'Sword & Shield', code: 'swsh'},
];
// Product groups that are not booster sets (promos, side galleries, collections, energies).
const NOT_A_SET = /Promo|Energies|Trainer Gallery|Classic Collection|Galarian Gallery|Shiny Vault|Radiant Collection|Battle Academy|Trick or Trade|McDonald|First Partner|My First Battle|Southeast Asia/i;
// Parenthetical suffixes that are not pulled from booster packs.
const NOT_IN_PACKS = /Exclusive|Metal Card|Jumbo|Oversize|Promo|Stamp|Prerelease|Staff|Cosmos Holo|Cracked Ice|Reverse Holofoil/i;
// Parenthetical suffixes that are a separate in-pack print (ball or energy patterns): own pool.
// Anything else in parentheses, e.g. "(Full Art)", "(Secret)" or "(101)", only tells cards apart.
const PRINT_VARIANT = /Pattern|\bBall\b|Team Rocket/i;
const HIT_PRINTING_ORDER = ['Holofoil', 'Normal'];
const BULK_PRINTING_ORDER = ['Normal', 'Holofoil'];
const VARIANT_PRINTING_ORDER = ['Reverse Holofoil', 'Holofoil', 'Normal'];
const BULK = new Set(['Common', 'Uncommon', 'Rare']);

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, UA);
      if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
      return await res.json();
    } catch (error) {
      if (i >= tries) throw error;
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}
async function getText(url) {
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
  return (await res.text()).trim();
}

const round = (v, d = 2) => Math.round((v + Number.EPSILON) * 10 ** d) / 10 ** d;
const median = a => {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const ext = (p, key) => (p.extendedData || []).find(e => e.name === key)?.value ?? null;

/** Sealed product kind from a TCGplayer product name, or null for cases, displays and code cards. */
export function sealedType(name) {
  const n = String(name);
  if (/\bCase\b|Display|Code Card|Half Booster Box|Fun Pack|Bundle \[Set of|Art Bundle/i.test(n)) return null;
  if (/Pokemon Center Elite Trainer Box/i.test(n)) return 'etb-pc';
  if (/Elite Trainer Box/i.test(n)) return 'etb';
  if (/Booster Box$/i.test(n)) return 'box';
  if (/Booster Bundle/i.test(n)) return 'bundle';
  if (/3 Pack Blister/i.test(n)) return 'blister3';
  if (/Premium Checklane Blister/i.test(n)) return 'blister-premium';
  if (/Single Pack Blister|Checklane Blister/i.test(n)) return 'blister1';
  if (/Sleeved Booster Pack$/i.test(n)) return 'sleeved';
  if (/ Booster Pack$/i.test(n)) return 'pack';
  if (/Build & Battle Stadium/i.test(n)) return 'bnb-stadium';
  if (/Build & Battle Box$/i.test(n)) return 'bnb';
  if (/\bTin\b/i.test(n)) return 'tin';
  if (/Collection|Premium|Box\b/i.test(n)) return 'collection';
  return 'other';
}

export function variantOf(name) {
  const m = String(name).match(/\(([^()]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

/** Summarise one set's products and prices into rarity pools. Pure, exported for tests. */
export function summariseSet(products, prices) {
  const byProduct = new Map();
  for (const row of prices) {
    if (!byProduct.has(row.productId)) byProduct.set(row.productId, {});
    byProduct.get(row.productId)[row.subTypeName] = row;
  }
  const pools = {}, reverse = [], cards = [], sealed = [];
  let pack = null;
  for (const p of products) {
    const rarity = ext(p, 'Rarity');
    const quotes = byProduct.get(p.productId) || {};
    if (!rarity) {
      const q = quotes.Normal || Object.values(quotes)[0];
      if (/ Booster Pack$/.test(p.name) && !/Code Card|Sleeved|Case|Display|Bundle|Blister/i.test(p.name)) {
        pack = {id: p.productId, name: p.name,
          market: q?.marketPrice ?? null, low: q?.lowPrice ?? null, mid: q?.midPrice ?? null};
      }
      const type = sealedType(p.name);
      // Compact rows [productId, name, type, market USD]: matched against restock alerts.
      if (type) sealed.push([p.productId, p.name, type, q?.marketPrice > 0 ? q.marketPrice : null]);
      continue;
    }
    if (rarity === 'Code Card' || rarity === 'Promo') continue;
    const suffix = variantOf(p.name);
    if (suffix && NOT_IN_PACKS.test(suffix)) continue;
    const variant = suffix && PRINT_VARIANT.test(suffix) ? suffix : null;
    // Pattern prints are listed by TCGplayer under the "Reverse Holofoil" printing.
    const order = variant ? VARIANT_PRINTING_ORDER : BULK.has(rarity) ? BULK_PRINTING_ORDER : HIT_PRINTING_ORDER;
    const printing = order.find(k => quotes[k]?.marketPrice > 0) || null;
    const price = printing ? quotes[printing].marketPrice : null;
    const poolKey = variant || rarity;
    const pool = pools[poolKey] ||= {count: 0, prices: [], top: []};
    pool.count++;
    const card = {name: variant ? p.name.replace(/\s*\([^()]*\)\s*$/, '').trim() : p.name, number: ext(p, 'Number'),
      rarity, variant, printing, price, id: p.productId};
    if (price !== null) { pool.prices.push(price); pool.top.push(card); cards.push(card); }
    const rev = quotes['Reverse Holofoil'];
    if (!variant && BULK.has(rarity) && rev?.marketPrice > 0) reverse.push(rev.marketPrice);
  }
  const out = {};
  for (const [key, pool] of Object.entries(pools)) {
    const sum = pool.prices.reduce((a, b) => a + b, 0);
    out[key] = {count: pool.count, priced: pool.prices.length,
      mean: pool.prices.length ? round(sum / pool.prices.length, 4) : null,
      median: pool.prices.length ? round(median(pool.prices), 4) : null,
      best: pool.top.sort((a, b) => b.price - a.price)[0] || null};
  }
  return {
    pack,
    sealed,
    pools: out,
    reverseHolo: {priced: reverse.length,
      mean: reverse.length ? round(reverse.reduce((a, b) => a + b, 0) / reverse.length, 4) : null},
    top: cards.sort((a, b) => b.price - a.price).slice(0, 8),
  };
}

export function eraOf(groupName) {
  for (const e of ERAS) if (e.prefix.test(groupName)) return {era: e.era, eraCode: e.code, name: groupName.replace(e.prefix, '').trim()};
  return null;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const pricesAsOf = await getText(TCGCSV + '/last-updated.txt');
  const groups = (await getJson(`${TCGCSV}/tcgplayer/${CATEGORY}/groups`)).results;
  const fxJson = await getJson('https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1');
  const fxObs = fxJson.observations.at(-1);
  const fx = {usdToCad: Number(fxObs.FXUSDCAD.v), date: fxObs.d, source: 'Bank of Canada daily average (FXUSDCAD)',
    url: 'https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/'};
  if (!(fx.usdToCad > 0.5 && fx.usdToCad < 3)) throw new Error('Implausible USD/CAD rate ' + fx.usdToCad);
  // EUR/CAD too: the scanner shows Cardmarket (EUR) quotes with their CAD equivalent.
  const eurObs = (await getJson('https://www.bankofcanada.ca/valet/observations/FXEURCAD/json?recent=1')).observations.at(-1);
  fx.eurToCad = Number(eurObs.FXEURCAD.v); fx.eurDate = eurObs.d;
  if (!(fx.eurToCad > 0.5 && fx.eurToCad < 3)) throw new Error('Implausible EUR/CAD rate ' + fx.eurToCad);

  const sets = [];
  for (const g of groups) {
    const era = eraOf(g.name);
    if (!era || NOT_A_SET.test(g.name)) continue;
    const released = String(g.publishedOn || '').slice(0, 10);
    if (!released || released > today) continue; // not released yet: no card list or prices
    const [products, prices] = await Promise.all([
      getJson(`${TCGCSV}/tcgplayer/${CATEGORY}/${g.groupId}/products`),
      getJson(`${TCGCSV}/tcgplayer/${CATEGORY}/${g.groupId}/prices`),
    ]);
    const summary = summariseSet(products.results, prices.results);
    if (!summary.pack) continue; // no single booster pack product on TCGplayer
    sets.push({groupId: g.groupId, name: era.name, code: g.abbreviation || null, era: era.era, eraCode: era.eraCode,
      released, ...summary});
    process.stdout.write('.');
  }
  sets.sort((a, b) => b.released.localeCompare(a.released));
  // eBay watchlist (sought-cards.js): today's TCGplayer market price for each card priced from TCGplayer.
  const sought = createRequire(import.meta.url)(path.join(ROOT, 'sought-cards.js'));
  const cardPrices = {};
  for (const gid of new Set(sought.cards.filter(c => c.marketSource === 'TCGplayer via tcgcsv').map(c => c.tcgplayerGroupId))) {
    const rows = (await getJson(`${TCGCSV}/tcgplayer/${CATEGORY}/${gid}/prices`)).results;
    for (const c of sought.cards.filter(c => c.tcgplayerGroupId === gid && c.marketSource === 'TCGplayer via tcgcsv')) {
      const row = rows.find(r => r.productId === c.tcgplayerProductId && r.subTypeName === c.printing);
      if (row?.marketPrice > 0) cardPrices[c.tcgplayerProductId + '|' + c.printing] = row.marketPrice;
    }
    process.stdout.write('+');
  }
  const data = {
    generated: new Date().toISOString(),
    prices: {asOf: pricesAsOf, currency: 'USD', source: 'TCGplayer market price', via: 'tcgcsv.com',
      url: 'https://tcgcsv.com/', note: 'Market price = TCGplayer\'s recent sold average for Near Mint English copies.'},
    fx,
    sets,
    cardPrices,
  };
  const body = '/* Generated by tools/build-pack-ev.mjs. Do not edit by hand: rerun the tool. */\n' +
    '(function(root){root.CardsteadPackData=' + JSON.stringify(data) + ';' +
    "if(typeof module!=='undefined'&&module.exports)module.exports=root.CardsteadPackData;" +
    "})(typeof window!=='undefined'?window:globalThis);\n";
  await writeFile(path.join(ROOT, 'pack-ev-data.js'), body);
  console.log(`\nWrote pack-ev-data.js: ${sets.length} sets, prices as of ${pricesAsOf}, USD/CAD ${fx.usdToCad} (${fx.date}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exit(1); });
}
