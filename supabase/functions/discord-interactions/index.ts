// Discord calls this URL for slash commands and buttons. Every request is signature-checked.
// Paste https://<project>.supabase.co/functions/v1/discord-interactions as the "Interactions Endpoint URL" in the Developer Portal.
import { verifySignature, discordClient } from '../_shared/discord-api.mjs';
import { supabaseStore } from '../_shared/discord-store.mjs';
import { service } from '../_shared/discord-service.mjs';

const env = Deno.env.toObject();
const bot = service({
  discord: discordClient({ token: env.DISCORD_BOT_TOKEN, appId: env.DISCORD_APP_ID }),
  store: supabaseStore({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }),
  env,
  now: () => Date.now(),
  fetch: (u: string, o?: RequestInit) => fetch(u, { ...o, headers: { 'user-agent': 'CardsteadDrops/1.0 (+https://pokeflip-studio.vercel.app)', ...(o?.headers || {}) } }),
  uuid: () => crypto.randomUUID(),
  random: (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n))),
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  const ok = await verifySignature(env.DISCORD_PUBLIC_KEY, req.headers.get('x-signature-ed25519') || '', req.headers.get('x-signature-timestamp') || '', raw);
  if (!ok) return new Response('Bad signature', { status: 401 });
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }
  try {
    const { response, after } = await bot.interaction(body);
    if (after) {
      // @ts-ignore EdgeRuntime is provided by Supabase
      EdgeRuntime.waitUntil(Promise.resolve().then(after).catch((e: Error) => console.error('interaction follow-up failed', e.message)));
    }
    return Response.json(response);
  } catch (e) {
    console.error('interaction failed', (e as Error).message);
    return Response.json({ type: 4, data: { content: 'Something went wrong; try again in a minute. · Erreur, réessaie dans une minute.', flags: 64 } });
  }
});
