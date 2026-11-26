// Cardstead drop alerts by Web Push. Supabase Cron calls it every minute with {"task":"tick"}: it reads new drop_events
// and sends one notification per drop to the members whose preferences match. See docs/DROPS-PIPELINE.md.
// A second, daily job posts {"task":"prices"}: price alerts for members who asked (docs/DROPS-PUSH.md).
// Secrets (Supabase > Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (from tools/make-vapid-keys.mjs),
// VAPID_SUBJECT (a contact, e.g. https://pokeflip-studio.vercel.app/privacy.html). Only server-key callers are accepted.
import webpush from 'npm:web-push@3.6.7';
import { runPush, pushStore } from '../_shared/push-core.mjs';
import { runPriceAlerts } from '../_shared/price-alerts.mjs';
import { fcmSender } from '../_shared/fcm.mjs';
import { isServiceRole, serverKeys } from '../_shared/discord-auth.mjs';

const env = Deno.env.toObject();
const SITE = (env.CARDSTEAD_URL || 'https://pokeflip-studio.vercel.app/').replace(/\/?$/, '/');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!isServiceRole(req.headers.get('authorization'), serverKeys(env), req.headers.get('apikey'))) return new Response('Forbidden', { status: 403 });
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return Response.json({ error: 'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets are not set' }, { status: 500 });
  webpush.setVapidDetails(env.VAPID_SUBJECT || SITE + 'privacy.html', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  // App devices (kind 'fcm') go through Firebase when FIREBASE_SERVICE_ACCOUNT is set; otherwise they are skipped.
  const fcm = env.FIREBASE_SERVICE_ACCOUNT ? fcmSender({ serviceAccount: env.FIREBASE_SERVICE_ACCOUNT }) : null;
  const send = async (sub: { kind?: string; endpoint: string; p256dh: string; auth: string }, payload: { title: string; body: string; url: string; tag: string; image?: string }) => {
    if (sub.kind === 'fcm') return fcm ? fcm(sub, payload) : { ok: false, skipped: true };
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 1800, urgency: 'high' });
      return { ok: true };
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      return { ok: false, gone: code === 404 || code === 410 };
    }
  };
  try {
    const { task } = await req.json().catch(() => ({}));
    const deps = { store: pushStore({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }), send, now: () => Date.now(), site: SITE };
    const getJson = async (url: string) => { const r = await fetch(url, { headers: { 'user-agent': 'Cardstead-price-alerts/1.0' } }); if (!r.ok) throw Error(`${url} -> ${r.status}`); return r.json(); };
    const out = task === 'prices' ? await runPriceAlerts({ ...deps, getJson }) : await runPush(deps);
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
});
