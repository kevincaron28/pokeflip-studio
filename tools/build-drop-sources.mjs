// Builds the two inputs of the server shop checker (supabase/functions/shop-checker):
//   supabase/functions/_shared/drop-shops.json   the shops it reads: the allow-listed Shopify card shops of
//                                                 canada-shops.js plus Indigo and Mastermind Toys (Shopify, public JSON)
//   data/drop-catalogue.json                      sets and sealed products with their TCGplayer market price in CAD,
//                                                 from pack-ev-data.js (rebuilt by the daily refresh)
// Run: node tools/build-drop-sources.mjs   (the daily refresh workflow runs it after build-pack-ev.mjs)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SH = require(join(ROOT, 'canada-shops.js'));
const R = require(join(ROOT, 'canada-retailers.js'));
const D = require(join(ROOT, 'pack-ev-data.js'));

// Chains on Shopify with open product JSON (checked 24 Nov 2026): standard Shopify robots, no bot wall on the JSON.
const CHAINS = [
  { host: 'www.mastermindtoys.com', name: 'Mastermind Toys', chain: 'indigo-mastermind', city: 'Canada-wide' },
  { host: 'www.indigo.ca', name: 'Indigo', chain: 'indigo-mastermind', city: 'Canada-wide' },
];
const KIND = { pack: 'pack', box: 'box', bundle: 'bundle', etb: 'etb', 'etb-pc': 'etb-pc', blister3: 'blister', bnb: 'bnb', tin: 'tin', collection: 'collection' };
const slug = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function shopsFile() {
  const shops = SH.SHOPS.map((s) => ({ host: s.host, name: s.name, city: s.city || null, region: s.region }));
  for (const c of CHAINS) if (!shops.some((s) => s.host === c.host)) shops.push(c);
  return { built: new Date().toISOString().slice(0, 10), shops };
}
export function catalogueFile() {
  const fx = D.fx.usdToCad;
  const sets = D.sets.map((s) => {
    const products = [], seen = new Set();
    for (const [id, name, type, usd] of s.sealed || []) {
      const kind = KIND[type]; if (!kind || seen.has(kind) || !(usd > 0)) continue; seen.add(kind);
      products.push({ kind, id, name, marketCad: Math.round(usd * fx * 100) / 100, image: `https://tcgplayer-cdn.tcgplayer.com/product/${id}_200w.jpg` });
    }
    return { name: s.name, slug: slug(s.name), era: s.era, released: s.released, asOf: (D.prices.asOf || '').slice(0, 10), products };
  });
  // Sets the matcher knows that have no price data yet (upcoming sets, era names): recognised, but no market value.
  const extraSets = R.SETS.filter((n) => !sets.some((s) => s.name === n));
  return { asOf: D.prices.asOf, fx: { usdToCad: fx, date: D.fx.date }, sets, extraSets };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(ROOT, 'supabase/functions/_shared/drop-shops.json'), JSON.stringify(shopsFile(), null, 1) + '\n');
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'data/drop-catalogue.json'), JSON.stringify(catalogueFile()) + '\n');
  console.log('drop-shops.json and data/drop-catalogue.json written');
}
