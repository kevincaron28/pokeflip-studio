/* Cardstead eBay listing search on Cloudflare Pages (a Pages Function, which runs as a Worker).
 * Same logic and answers as the Vercel function: see api/_ebay-core.js.
 * Keys: EBAY_CLIENT_ID and EBAY_CLIENT_SECRET as encrypted variables in the Pages project
 * (Settings > Variables and Secrets), never in the repository.
 * On top of the per-instance cache, a successful search is kept in Cloudflare's edge cache (10 minutes, 6 hours for mode=value),
 * shared by every visitor of the same data centre, so repeated searches do not spend eBay calls. */
import core from '../../api/_ebay-core.js';

export async function onRequest({request, env}) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const mode = url.searchParams.get('mode') === 'value' ? 'value' : 'deals';
  const edge = typeof caches !== 'undefined' && request.method === 'GET' && q ? caches.default : null;
  const key = edge ? new Request('https://ebay-cache.cardstead.internal/' + mode + '/' + encodeURIComponent(q)) : null;
  const origin = request.headers.get('Origin') || undefined;
  if (edge) {
    const hit = await edge.match(key);
    if (hit) return withCors(new Response(await hit.text(), {status: 200, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}}), origin, env);
  }
  const r = await core.handle({
    method: request.method, url: request.url, origin,
    ip: request.headers.get('CF-Connecting-IP') || 'unknown', env,
  });
  if (edge && r.status === 200 && r.body) {
    await edge.put(key, new Response(r.body, {headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=' + Math.round(core.MODES[mode].cacheMs / 1000)}}));
  }
  return new Response(r.body, {status: r.status, headers: r.headers});
}

function withCors(res, origin, env) {
  if (origin && core.origins(env).has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
  }
  return res;
}
