// Builds the all-series and sets data for the Prices > All sets page, from tcgcsv.com (TCGplayer catalogue and
// market prices, English cards), once a day in the refresh workflow:
//   data/sets/index.json       every set: series, release date, card count, set value, top 5 chase cards, sealed prices
//   data/sets/<groupId>.json   one file per set: every card with its number, rarity and market price per printing
// Prices are TCGplayer "market price" (recent sold average), in USD; the page converts to CAD at the Bank of Canada rate
// already stored in pack-ev-data.js. tcgcsv asks for a named User-Agent and one update a day; this makes about
// 2 requests per set (~450), spaced 250 ms apart.
// Set value = one copy of every numbered card, each at its cheapest printing (the normal print, not the reverse holo),
// so it matches "one of each card in the binder". Sealed products, code cards and energy-less extras are not counted.
// Set logos: TCGdex's set logo (assets.tcgdex.net), matched by set name; a set TCGdex does not have keeps no logo.
// Run: node tools/build-sets.mjs  [--only 24831,604]   |   --logos-only adds logos to the existing data/sets/index.json
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/sets');
const UA = {headers: {'User-Agent': 'Cardstead-Sets/1.0 (+https://pokeflip-studio.vercel.app)'}};
const BASE = 'https://tcgcsv.com/tcgplayer/3';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, UA); if (r.ok) return await r.json(); if (r.status === 404) return null; }
    catch {}
    await sleep(2000 * (i + 1));
  }
  throw new Error('tcgcsv: ' + url);
}

// Series by name first, then by release date (TCGplayer has no series field).
const ERAS = [
  ['mega-evolution', 'Mega Evolution', '2025-09-01'], ['scarlet-violet', 'Scarlet & Violet', '2023-03-01'],
  ['sword-shield', 'Sword & Shield', '2020-02-01'], ['sun-moon', 'Sun & Moon', '2017-02-01'], ['xy', 'XY', '2014-02-01'],
  ['black-white', 'Black & White', '2011-04-01'], ['hgss', 'HeartGold & SoulSilver', '2010-02-01'], ['platinum', 'Platinum', '2009-02-01'],
  ['diamond-pearl', 'Diamond & Pearl', '2007-05-01'], ['ex', 'EX', '2003-06-01'], ['e-card', 'e-Card', '2002-09-01'],
  ['neo', 'Neo', '2000-12-01'], ['wotc', 'Base, Jungle, Fossil & Gym', '1999-01-01'],
];
const OTHER = /promo|mcdonald|burger king|trainer kit|deck|jumbo|prize pack|miscellaneous|battle academy|my first battle|first partner|trick or trade|pop series|world championship|league|kit|collection 20|placement|sample|box topper/i;
export function seriesOf(g) {
  if (OTHER.test(g.name) || g.isSupplemental) return {id: 'other', name: 'Promos & special products'};
  const n = g.name.toLowerCase();
  if (/^me\d*:|^me:/.test(n)) return {id: 'mega-evolution', name: 'Mega Evolution'};
  if (/^sv\d*:|^sv:/.test(n)) return {id: 'scarlet-violet', name: 'Scarlet & Violet'};
  if (/^swsh/.test(n) || /crown zenith|celebrations|shining fates|champion's path|pokemon go/.test(n)) return {id: 'sword-shield', name: 'Sword & Shield'};
  if (/^sm |^sm -|hidden fates|dragon majesty|detective pikachu/.test(n)) return {id: 'sun-moon', name: 'Sun & Moon'};
  if (/^xy|generations|double crisis/.test(n)) return {id: 'xy', name: 'XY'};
  const d = (g.publishedOn || '').slice(0, 10);
  for (const [id, name, from] of ERAS) if (d >= from) return {id, name};
  return {id: 'wotc', name: 'Base, Jungle, Fossil & Gym'};
}
const ext = (p, k) => (p.extendedData || []).find(e => e.name === k)?.value ?? null;
const SEALED = [['etb-pc', /pokemon center elite trainer box/i], ['etb', /elite trainer box/i], ['box', /booster box(?! case)/i],
  ['bundle', /booster bundle(?! case)/i], ['pack', /booster pack$|^[^|]*booster pack(?! art)/i]];
const UPCOMING_KIND = [['etb-pc', /pokemon center elite trainer box/i], ['etb', /elite trainer box/i], ['box', /booster box/i], ['bundle', /booster bundle/i],
  ['bnb', /build (&|and) battle/i], ['blister', /blister/i], ['tin', /\btins?\b/i], ['pack', /booster pack/i], ['collection', /collection|premium|box/i]];
export function cleanSetName(name) { return name.replace(/^(ME\d*|SV\d*|SWSH\d*):\s*/i, '').replace(/^(SM|XY)\s*-\s*/i, '').trim(); }

/** Logo URL per set name, from TCGdex's set list. Names compared without accents, punctuation or case. Pure (given the list). */
export function logoMap(tcgdexSets) {
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const m = new Map();
  for (const s of tcgdexSets || []) if (s && s.logo && /^https:\/\/assets\.tcgdex\.net\//.test(s.logo) && !m.has(norm(s.name))) m.set(norm(s.name), s.logo + '.webp');
  // Also: 'Scarlet & Violet Base Set' is 'Scarlet & Violet' there, 'Scarlet & Violet 151' is '151' (never the 1999 Base Set).
  return name => { const n = norm(name), noBase = n.replace(/ base set$/, ''), noSeries = n.replace(/^(scarlet and violet|sword and shield|sun and moon|black and white|xy) /, '');
    return m.get(n) || (noBase !== n ? m.get(noBase) : null) || (noSeries !== n && noSeries !== 'base set' ? m.get(noSeries) : null) || null; };
}
async function addLogos(index) {
  let list = null; try { list = await getJson('https://api.tcgdex.net/v2/en/sets'); } catch { return index; }
  const logo = logoMap(list);
  for (const s of index) { const l = logo(s.name); if (l) s.logo = l; else delete s.logo; }
  return index;
}
async function main() {
  if (process.argv.includes('--logos-only')) {
    const file = join(OUT, 'index.json'), data = JSON.parse(readFileSync(file, 'utf8'));
    await addLogos(data.sets); writeFileSync(file, JSON.stringify(data));
    console.log(data.sets.filter(s => s.logo).length + ' of ' + data.sets.length + ' sets have a logo'); return;
  }
  const groups = (await getJson(BASE + '/groups')).results
    .filter(g => !only.length || only.includes(g.groupId));
  const today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  mkdirSync(OUT, {recursive: true});
  const index = [], upcoming = [];
  for (const g of groups) {
    const [prods, prices] = [await getJson(`${BASE}/${g.groupId}/products`), (await sleep(250), await getJson(`${BASE}/${g.groupId}/prices`))];
    await sleep(250);
    if (!prods) continue;
    const byId = new Map();
    // Market price (recent sales) per printing; the listing mid price is kept only for cards with no market price at all
    // (promos, jumbos...): shown as a TCGplayer listing price with low confidence, never as a sale.
    const mids = new Map();
    for (const p of prices?.results || []) { if (!byId.has(p.productId)) byId.set(p.productId, {}); if (p.marketPrice > 0) byId.get(p.productId)[p.subTypeName] = Math.round(p.marketPrice * 100) / 100;
      if (p.midPrice > 0) { if (!mids.has(p.productId)) mids.set(p.productId, {}); mids.get(p.productId)[p.subTypeName] = Math.round(p.midPrice * 100) / 100; } }
    const cards = [], sealed = {};
    for (const p of prods.results) {
      const number = ext(p, 'Number'), prints = byId.get(p.productId) || {};
      // Release calendar: sealed products TCGplayer sells as presale, with its estimated release (shipping) date.
      const pre = p.presaleInfo || {}, rel = String(pre.releasedOn || '').slice(0, 10);
      if (!number && pre.isPresale && rel >= today && !/\bcase\b|code card|display\b|set of \d/i.test(p.name)) {
        const kind = UPCOMING_KIND.find(([, re]) => re.test(p.name))?.[0] || 'other', v = Object.values(prints)[0];
        upcoming.push({date: rel, setId: g.groupId, set: cleanSetName(g.name), code: g.abbreviation || '', productId: p.productId, name: p.name, kind, marketUsd: v > 0 ? Math.round(v * 100) / 100 : null});
      }
      if (number) {
        const row = [p.productId, p.name, number, ext(p, 'Rarity') || '', prints];
        if (!Object.keys(prints).length && mids.has(p.productId)) row.push(mids.get(p.productId)); // [5]: listing mid prices
        cards.push(row);
      } else {
        const kind = SEALED.find(([, re]) => re.test(p.name))?.[0];
        const v = Object.values(prints)[0];
        if (kind && v && !(kind in sealed)) sealed[kind] = [p.productId, Math.round(v * 100) / 100];
      }
    }
    if (!cards.length || g.publishedOn.slice(0, 10) > soon) continue; // the sets page lists released (or imminent) sets only
    cards.sort((a, b) => String(a[2]).localeCompare(String(b[2]), 'en', {numeric: true}));
    const base = c => { const v = Object.values(c[4]); return v.length ? Math.min(...v) : null; };
    const top = c => { const v = Object.values(c[4]); return v.length ? Math.max(...v) : null; };
    const priced = cards.filter(c => base(c) !== null), listed = cards.filter(c => base(c) === null && c[5]).length;
    const setValue = Math.round(priced.reduce((n, c) => n + base(c), 0) * 100) / 100;
    const chase = cards.filter(c => top(c) !== null).sort((a, b) => top(b) - top(a)).slice(0, 5)
      .map(c => [c[0], c[1], c[2], c[3], top(c)]);
    const s = seriesOf(g);
    index.push({id: g.groupId, name: cleanSetName(g.name), code: g.abbreviation || '', released: g.publishedOn.slice(0, 10), series: s.id, seriesName: s.name,
      cards: cards.length, priced: priced.length, listed, setValueUsd: setValue, chase, sealed});
    writeFileSync(join(OUT, g.groupId + '.json'), JSON.stringify({id: g.groupId, name: cleanSetName(g.name), cards}));
    process.stdout.write('.');
  }
  index.sort((a, b) => (b.released.localeCompare(a.released)) || a.name.localeCompare(b.name));
  await addLogos(index);
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({asOf: new Date().toISOString(), currency: 'USD', source: 'TCGplayer market price via tcgcsv.com',
    setValueRule: 'one of each numbered card at its cheapest printing', sets: index}));
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.set.localeCompare(b.set) || a.name.localeCompare(b.name));
  writeFileSync(join(ROOT, 'data/release-calendar.json'), JSON.stringify({asOf: new Date().toISOString(), source: 'TCGplayer presale products via tcgcsv.com (estimated release dates)', items: upcoming}) + '\n');
  console.log(`\n${index.length} sets written to data/sets/, ${upcoming.length} upcoming products to data/release-calendar.json`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(e => { console.error(e); process.exit(1); });
