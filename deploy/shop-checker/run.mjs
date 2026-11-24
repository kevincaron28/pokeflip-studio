// Cardstead shop checker, one pass, outside Supabase (the owner's Oracle VM; docs/SHOP-CHECKER-VM.md).
// Same code and rules as the Supabase function (supabase/functions/_shared/shop-checker.mjs): public storefront data
// only, named User-Agent, ETags, back-off after 403/429, in-stock changes confirmed on the product page.
// It writes through the checker_* database functions with the public key plus CHECKER_KEY: no Supabase secret key here.
// Started every 2 minutes by cardstead-checker.timer. Settings come from /etc/cardstead-checker/checker.env.
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPass, checkerRpcStore, UA } from '../../supabase/functions/_shared/shop-checker.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;

export function settings(e = env) {
  const missing = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'CHECKER_KEY'].filter((k) => !e[k]);
  if (missing.length) throw Error('missing in checker.env: ' + missing.join(', '));
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(e.SUPABASE_URL)) throw Error('SUPABASE_URL must look like https://<project>.supabase.co');
  if (/^sb_secret_|service_role/.test(e.SUPABASE_PUBLISHABLE_KEY)) throw Error('SUPABASE_PUBLISHABLE_KEY must be the public key, never a secret key');
  if (!/^[0-9a-f]{64}$/.test(e.CHECKER_KEY.trim())) throw Error('CHECKER_KEY must be the 64-character key from checker_new_key');
  const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || d));
  return {
    url: e.SUPABASE_URL, publishableKey: e.SUPABASE_PUBLISHABLE_KEY, checkerKey: e.CHECKER_KEY.trim(),
    site: (e.CARDSTEAD_URL || 'https://pokeflip-studio.vercel.app/').replace(/\/?$/, '/'),
    maxShops: num(e.CHECKER_MAX_SHOPS, 45, 1, 200), concurrency: num(e.CHECKER_CONCURRENCY, 3, 1, 6), gapMs: num(e.CHECKER_GAP_MS, 0, 0, 10000),
    cacheDir: e.STATE_DIRECTORY || e.CACHE_DIR || join(here, '.cache'),
  };
}

/** The product catalogue, rebuilt daily with the site's prices; kept on disk for 6 hours. */
export async function catalogue({ site, cacheDir, fetch: f = globalThis.fetch, now = Date.now() }) {
  const file = join(cacheDir, 'drop-catalogue.json');
  try { if (now - statSync(file).mtimeMs < 6 * 3600 * 1000) return JSON.parse(readFileSync(file, 'utf8')); } catch {}
  const r = await f(site + 'data/drop-catalogue.json', { headers: { 'user-agent': UA } });
  if (!r.ok) { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { throw Error('catalogue ' + r.status); } }
  const text = await r.text(); const data = JSON.parse(text);
  mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, text);
  return data;
}

async function main() {
  const s = settings();
  const shops = JSON.parse(readFileSync(join(here, '../../supabase/functions/_shared/drop-shops.json'), 'utf8')).shops;
  const summary = await runPass({ store: checkerRpcStore(s), fetch, now: () => Date.now(), shops, catalogue: await catalogue(s),
    maxShops: s.maxShops, concurrency: s.concurrency, gapMs: s.gapMs, log: (m) => console.log(m) });
  console.log(JSON.stringify(summary));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
