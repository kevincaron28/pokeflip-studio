// Cardstead server shop checker. Supabase Cron calls it every 2 minutes with {"task":"tick"}; each call reads the shops
// that are due (each shop about every 4-5 minutes) and writes drop events. See docs/DROPS-PIPELINE.md.
// Only callers holding a server key (service role or sb_secret_) are accepted, like discord-publisher.
import { runPass, checkerStore } from '../_shared/shop-checker.mjs';
import { isServiceRole, serverKeys } from '../_shared/discord-auth.mjs';
import shops from '../_shared/drop-shops.json' with { type: 'json' };

const env = Deno.env.toObject();
const SITE = (env.CARDSTEAD_URL || 'https://pokeflip-studio.vercel.app/').replace(/\/?$/, '/');
let catalogue: unknown = null, catalogueAt = 0;

async function loadCatalogue() {
  // The product catalogue (sets, sealed products, market prices in CAD) is rebuilt daily with the site's price data.
  if (catalogue && Date.now() - catalogueAt < 6 * 3600 * 1000) return catalogue;
  const r = await fetch(SITE + 'data/drop-catalogue.json', { headers: { 'user-agent': 'Cardstead-shop-checker/1.0' } });
  if (!r.ok) throw new Error('catalogue ' + r.status);
  catalogue = await r.json(); catalogueAt = Date.now();
  return catalogue;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!isServiceRole(req.headers.get('authorization'), serverKeys(env), req.headers.get('apikey'))) return new Response('Forbidden', { status: 403 });
  const { task = 'tick' } = await req.json().catch(() => ({}));
  if (task !== 'tick') return Response.json({ error: 'unknown task' }, { status: 400 });
  try {
    const summary = await runPass({
      store: checkerStore({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }),
      fetch, now: () => Date.now(), shops: (shops as { shops: unknown[] }).shops, catalogue: await loadCatalogue(),
      log: (m: string) => console.log(m),
    });
    return Response.json(summary);
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
});
