/* Security headers on Cloudflare Pages, read from vercel.json so both hosts send the same ones.
 * Why a Function: Pages' _headers file allows at most 2,000 characters per line, and Cardstead's
 * Content-Security-Policy (it lists every shop the restock checks may call) is longer. _headers still
 * carries the short headers for every static file; this middleware runs only for the paths in
 * _routes.json (the pages, the service worker and /api/*), where a CSP matters, so ordinary static files
 * stay free and unlimited and only these requests count toward the Workers free plan (100,000 a day). */
import vercel from '../vercel.json' with {type: 'json'};

export const SECURITY_HEADERS = vercel.headers.find(h => h.source === '/(.*)').headers;

export async function onRequest({next}) {
  const res = await next();
  const out = new Response(res.body, res);
  for (const {key, value} of SECURITY_HEADERS) out.headers.set(key, value);
  return out;
}
