/* Cardstead public settings on Cloudflare Pages. Same answers as the Vercel function: see api/_config-core.js.
 * Setting: AMAZON_ASSOCIATES_TAG as a variable in the Pages project (Settings > Variables and Secrets). */
import core from '../../api/_config-core.js';

export async function onRequest({request, env}) {
  const r = core.handle({method: request.method, origin: request.headers.get('Origin') || undefined, env});
  return new Response(r.body, {status: r.status, headers: r.headers});
}
