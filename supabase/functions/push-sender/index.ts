// Cardstead drop alerts by Web Push. Supabase Cron calls it every minute with {"task":"tick"}: it reads new drop_events
// and sends one notification per drop to the members whose preferences match. See docs/DROPS-PIPELINE.md.
// Secrets (Supabase > Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (from tools/make-vapid-keys.mjs),
// VAPID_SUBJECT (a contact, e.g. https://pokeflip-studio.vercel.app/privacy.html). Only server-key callers are accepted.
import webpush from 'npm:web-push@3.6.7';
import { runPush, pushStore } from '../_shared/push-core.mjs';
import { isServiceRole, serverKeys } from '../_shared/discord-auth.mjs';

const env = Deno.env.toObject();
const SITE = (env.CARDSTEAD_URL || 'https://pokeflip-studio.vercel.app/').replace(/\/?$/, '/');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!isServiceRole(req.headers.get('authorization'), serverKeys(env), req.headers.get('apikey'))) return new Response('Forbidden', { status: 403 });
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return Response.json({ error: 'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets are not set' }, { status: 500 });
  webpush.setVapidDetails(env.VAPID_SUBJECT || SITE + 'privacy.html', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const send = async (sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 1800, urgency: 'high' });
      return { ok: true };
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      return { ok: false, gone: code === 404 || code === 410 };
    }
  };
  try {
    const out = await runPush({ store: pushStore({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }), send, now: () => Date.now(), site: SITE });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
});
