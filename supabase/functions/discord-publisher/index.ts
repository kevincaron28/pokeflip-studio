// Runs on a schedule (Supabase Cron) and on demand from the dashboard.
// Body {"task":"tick"} every minute: post new drop events, expire member reports.
// Body {"task":"speed-log"} weekly. Body {"task":"coming-drops"} daily (release calendar in #coming-drops). Body {"task":"setup"} once after inviting the bot.
// Only callers holding a server key (service role or sb_secret_, as Supabase Cron and the dashboard tester send) are accepted.
import { discordClient } from '../_shared/discord-api.mjs';
import { supabaseStore } from '../_shared/discord-store.mjs';
import { service } from '../_shared/discord-service.mjs';
import { isServiceRole, serverKeys } from '../_shared/discord-auth.mjs';

const env = Deno.env.toObject();
const bot = service({
  discord: discordClient({ token: env.DISCORD_BOT_TOKEN, appId: env.DISCORD_APP_ID }),
  store: supabaseStore({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }),
  env,
  now: () => Date.now(),
  fetch,
  uuid: () => crypto.randomUUID(),
  random: (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n))),
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!isServiceRole(req.headers.get('authorization'), serverKeys(env), req.headers.get('apikey'))) return new Response('Forbidden', { status: 403 });
  if (!env.DISCORD_BOT_TOKEN) return Response.json({ error: 'DISCORD_BOT_TOKEN secret is not set' }, { status: 500 });
  const { task = 'tick' } = await req.json().catch(() => ({}));
  try {
    if (task === 'tick') return Response.json({ published: await bot.publishPending(), expired: await bot.expireReports() });
    if (task === 'speed-log') return Response.json({ stores: await bot.weeklySpeedLog() });
    if (task === 'coming-drops') return Response.json(await bot.comingDrops());
    if (task === 'setup') return Response.json({ created: await bot.setup() });
    return Response.json({ error: 'unknown task' }, { status: 400 });
  } catch (e) {
    console.error(task, (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
