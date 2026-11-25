// Cardstead Drops: what the bot does. Dependencies are injected: { discord, store, env, now(), fetch, uuid(), random(n) }.
import * as C from './discord-core.mjs';

const EPHEMERAL = 64;
const say = (content) => ({ type: 4, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });

export function service(deps) {
  const { discord, store, env } = deps;
  const now = () => deps.now();
  let guildCache = null;
  let tagCache = null;

  /** The Amazon.ca Associates tag, read from the site's /api/config (the AMAZON_ASSOCIATES_TAG setting on Vercel); cached 12 h. */
  async function amazonTag() {
    if (tagCache && now() - tagCache.at < 12 * 3600e3) return tagCache.tag;
    let tag = null;
    try { const r = await deps.fetch(new URL('api/config', env.CARDSTEAD_URL).href); const j = r.ok ? await r.json() : null; tag = C.AMAZON_TAG.test(String(j?.amazonTag || '')) ? j.amazonTag : null; } catch { /* untagged links */ }
    tagCache = { tag, at: now() };
    return tag;
  }

  async function guildId() {
    if (env.DISCORD_GUILD_ID) return env.DISCORD_GUILD_ID;
    const gs = await discord.call('GET', '/users/@me/guilds');
    if (gs.length !== 1) throw Error(`Set DISCORD_GUILD_ID: the bot is in ${gs.length} servers`);
    return gs[0].id;
  }

  /** Channel and role IDs by name, read from the server so nobody has to copy IDs. */
  async function guild(refresh = false) {
    if (guildCache && !refresh) return guildCache;
    const id = await guildId();
    const [chs, roles] = await Promise.all([discord.channels(id), discord.roles(id)]);
    guildCache = {
      id,
      channels: Object.fromEntries(chs.filter((c) => c.type !== 4).map((c) => [c.name, c.id])),
      categories: Object.fromEntries(chs.filter((c) => c.type === 4).map((c) => [c.name, c.id])),
      roles: Object.fromEntries(roles.map((r) => [r.name, r.id])),
      roleNames: Object.fromEntries(roles.map((r) => [r.id, r.name])),
    };
    return guildCache;
  }

  // ---------- Publishing alerts from the pipeline ----------

  async function publishEvent(raw) {
    let e;
    try { e = C.normalizeEvent(raw); } catch (err) { return `rejected: ${err.message}`; }
    const g = await guild();
    const key = C.postKey(e);
    const prev = await store.getPost(key);
    const plan = C.planAlert(e, prev, now());
    if (plan.action === 'skip') return `skipped: ${plan.reason}`;
    const opts = { roleIds: g.roles, siteUrl: env.CARDSTEAD_URL, amazonTag: e.chain_key === 'amazon-ca' ? await amazonTag() : null, now: now() };
    const t = new Date(now()).toISOString();
    if (plan.action === 'edit') {
      await discord.edit(prev.channel_id, prev.message_id, C.alertMessage(e, plan.state, { ...opts, postId: prev.id, seenAt: t, wasntThere: prev.wasnt_there }));
      await store.updatePost(prev.id, { state: plan.state, last_seen_at: t, event: e });
      return `edited: ${plan.reason}`;
    }
    const channelId = g.channels[C.channelFor(e)];
    if (!channelId) return `rejected: no channel #${C.channelFor(e)} (run setup)`;
    const id = deps.uuid();
    const msg = await discord.send(channelId, C.alertMessage(e, 'live', { ...opts, postId: id, ping: plan.ping }));
    await store.upsertPost({
      id, key, channel_id: channelId, message_id: msg.id, state: 'live', posted_at: t, last_seen_at: t,
      pinged_at: plan.ping ? t : prev?.pinged_at || null, first_seen_at: e.first_seen_at, store_name: e.store_name,
      wasnt_there: 0, reporter_id: e.reporter_id, event: e,
    });
    let dms = 0;
    if (plan.ping) dms = await directMessages(e, opts);
    return `posted: ${plan.reason}${plan.ping ? ', pinged' : ''}${dms ? `, ${dms} DM(s)` : ''}`;
  }

  async function directMessages(e, opts) {
    let sent = 0;
    let targets = [];
    try { targets = (await store.dmTargets()) || []; } catch { return 0; }
    for (const t of targets) {
      const w = C.matchingWatch(e, t.watches, now());
      if (!w) continue;
      const m = C.alertMessage(e, 'live', { ...opts, ping: false });
      m.content = `Matches your Cardstead watch “${String(w.product).slice(0, 120)}” (max ${C.cad(w.ceiling)}). · Correspond à ta surveillance Cardstead.`;
      m.components = m.components.map((row) => ({ ...row, components: row.components.filter((b) => b.style === 5) }));
      try { await discord.dm(t.discord_user_id, m); sent++; } catch { /* member left or closed DMs */ }
    }
    return sent;
  }

  async function publishPending() {
    const events = (await store.newEvents(50)) || [];
    const out = [];
    for (const ev of events) {
      let outcome;
      try { outcome = await publishEvent(ev); } catch (err) { outcome = `error: ${err.message}`; }
      await store.markEvent(ev.id, outcome, now());
      out.push({ id: ev.id, outcome });
    }
    return out;
  }

  async function expireReports() {
    const g = await guild();
    const rows = (await store.expiredReports(now())) || [];
    for (const r of rows) {
      const moved = await store.moveReport(r.id, 'pending', { status: 'expired' });
      if (moved?.thread_id) await discord.edit(moved.thread_id, moved.message_id, C.reportMessage(moved, 'expired')).catch(() => {});
    }
    return rows.length && g ? rows.length : 0;
  }

  async function weeklySpeedLog() {
    const g = await guild();
    const since = new Date(now() - 7 * 864e5).toISOString();
    const { message, rows } = C.speedLog((await store.postsSince(since)) || [], now());
    const ch = g.channels['speed-log'];
    if (!ch) throw Error('No #speed-log channel (run setup)');
    await discord.send(ch, message);
    return rows.length;
  }

  // ---------- Interactions (slash commands and buttons) ----------

  /** Returns { response, after? }. `after` runs once the response has been sent (Discord wants an answer within 3 s). */
  async function interaction(body) {
    if (body.type === 1) return { response: { type: 1 } };
    const user = body.member?.user || body.user;
    if (!body.guild_id || !user) return { response: say('Use this inside the Cardstead Drops server. · Utilise-le dans le serveur Cardstead Drops.') };
    if (body.type === 2) return command(body, user);
    if (body.type === 3) return button(body, user);
    return { response: say('Unsupported. · Non pris en charge.') };
  }

  const opt = (body, name) => body.data.options?.find((o) => o.name === name)?.value;

  async function command(body, user) {
    const name = body.data.name;
    if (name === 'price' || name === 'prix') {
      const q = opt(body, name === 'prix' ? 'carte' : 'card');
      const lang = name === 'prix' ? 'fr' : 'en';
      return { response: { type: 5 }, after: async () => discord.followUp(body.token, await priceCheck(q, lang)) };
    }
    if (name === 'report') return { response: { type: 5, data: { flags: EPHEMERAL } }, after: async () => discord.followUp(body.token, { content: await report(body, user), allowed_mentions: { parse: [] } }) };
    if (name === 'link') {
      const code = C.linkCode(deps.random(8));
      await store.createLinkCode(code, user.id, new Date(now() + 15 * 60000).toISOString());
      return { response: say(`Your code: **${code}** (valid 15 minutes). In Cardstead, open Settings → Discord alerts, sign in, and enter it. You can turn DMs off there any time.\nTon code : **${code}** (15 minutes). Dans Cardstead : Réglages → Alertes Discord.`) };
    }
    if (name === 'flag') {
      const g = await guild();
      const ch = g.channels['mod-queue'];
      if (ch) await discord.send(ch, { content: `Flag from <@${user.id}> in <#${body.channel_id}>: ${String(opt(body, 'reason') || '').slice(0, 1500)}`, allowed_mentions: { parse: [] } });
      return { response: say('Sent to the moderators. · Envoyé aux modérateurs.') };
    }
    return { response: say('Unknown command. · Commande inconnue.') };
  }

  async function report(body, user) {
    const o = Object.fromEntries((body.data.options || []).map((x) => [x.name, x.value]));
    if (o.photo) o.photo = body.data.resolved?.attachments?.[o.photo]?.url || null;
    const v = C.validateReport(o, user.id, now());
    if (v.error) return v.error;
    const g = await guild();
    const r = { id: deps.uuid(), ...v.report };
    const memberRoles = (body.member?.roles || []).map((id) => g.roleNames[id]);
    if (memberRoles.includes(C.TRUSTED_ROLE) || memberRoles.includes(C.MOD_ROLE)) {
      r.status = 'posted';
      await store.insertReport(r);
      await store.insertEvent(C.reportToEvent(r, { id: deps.uuid(), confirmed: false, now: now() }));
      return 'Thanks, posted right away as a trusted reporter. · Merci, publié tout de suite.';
    }
    const forum = g.channels['report-a-drop'];
    if (!forum) return 'Reports are not set up yet. · Les signalements ne sont pas encore prêts.';
    const thread = await discord.forumPost(forum, `${r.product_name} · ${r.store_name}`, C.reportMessage(r, 'pending'));
    r.thread_id = thread.id;
    r.message_id = thread.message?.id || thread.id; // a forum post's first message has the thread's ID
    await store.insertReport(r);
    return 'Thanks! Your report waits for a second member for 30 minutes. · Merci! Ton signalement attend un 2e membre pendant 30 minutes.';
  }

  async function button(body, user) {
    const [kind, id] = String(body.data.custom_id || '').split(':');
    if (kind === 'wt') return { response: say('Thanks, noted. · Merci, c’est noté.'), after: () => wasntThere(id, user) };
    if (kind === 'rc') return confirmReport(id, body, user);
    return { response: say('Unknown button. · Bouton inconnu.') };
  }

  async function wasntThere(postId, user) {
    const post = await store.getPostById(postId);
    if (!post || post.state !== 'live') return;
    const count = await store.addWasntThere(postId, user.id);
    const stale = count >= C.STALE_AFTER;
    await store.updatePost(postId, { wasnt_there: count, ...(stale ? { state: 'stale' } : {}) });
    await discord.edit(post.channel_id, post.message_id, C.alertMessage(post.event, stale ? 'stale' : 'live', { postId, siteUrl: env.CARDSTEAD_URL, amazonTag: post.event.chain_key === 'amazon-ca' ? await amazonTag() : null, wasntThere: count, now: now() }));
    if (stale && post.reporter_id) await reporterScore(post.reporter_id, 0, 1);
  }

  async function confirmReport(id, body, user) {
    const g = await guild();
    const r = await store.getReport(id);
    const roles = (body.member?.roles || []).map((x) => g.roleNames[x]);
    const ok = C.canConfirm(r, user.id, roles, now());
    if (!ok.ok) return { response: say(ok.why) };
    const moved = await store.moveReport(id, 'pending', { status: 'confirmed', confirmer_id: String(user.id), confirmed_at: new Date(now()).toISOString() });
    if (!moved) return { response: say('Someone already confirmed it. · Déjà confirmé.') };
    return {
      response: { type: 7, data: C.reportMessage(moved, 'confirmed') }, // updates the report message in place
      after: async () => {
        await store.insertEvent(C.reportToEvent(moved, { id: deps.uuid(), confirmed: true, now: now() }));
        await reporterScore(moved.reporter_id, 1, 0);
      },
    };
  }

  async function reporterScore(userId, good, bad) {
    const s = await store.bumpReporter(userId, good, bad);
    if (s && !s.trusted && C.isTrustedNow(s)) {
      const g = await guild();
      const role = g.roles[C.TRUSTED_ROLE];
      if (role) await discord.addRole(g.id, userId, role).catch(() => {});
    }
  }

  async function priceCheck(query, lang) {
    const f = deps.fetch;
    const { name, number } = C.parseCardQuery(query);
    if (name.length < 2) return C.priceMessage(null, [], null, lang);
    const base = `https://api.tcgdex.net/v2/${lang}`;
    const list = await f(`${base}/cards?name=${encodeURIComponent(name)}${number ? `&localId=${encodeURIComponent(number)}` : ''}&pagination:itemsPerPage=5`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    if (!Array.isArray(list) || !list.length) return C.priceMessage(null, [], null, lang);
    const card = await f(`${base}/cards/${encodeURIComponent(list[0].id)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const fx = await fxRates(f);
    const { quotes, confidence } = C.priceQuotes(card, fx);
    return C.priceMessage(card, quotes, confidence, lang, env.CARDSTEAD_URL);
  }

  async function fxRates(f) {
    try {
      const j = await f('https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXEURCAD/json?recent=1').then((r) => r.json());
      const o = j.observations?.[0] || {};
      return { USD: Number(o.FXUSDCAD?.v) || null, EUR: Number(o.FXEURCAD?.v) || null };
    } catch { return { USD: null, EUR: null }; }
  }

  // ---------- One-time server setup ----------

  const P = { VIEW: 1n << 10n, SEND: 1n << 11n, EMBED: 1n << 14n, HISTORY: 1n << 16n, MENTION: 1n << 17n, MANAGE_MSG: 1n << 13n, THREADS_SEND: 1n << 38n, THREADS_CREATE: 1n << 35n, REACT: 1n << 6n };
  const s = (n) => n.toString();

  /** Creates any missing roles, channels (with read-only alert channels), slash commands and spam rules. Safe to run again. */
  async function setup() {
    const log = [];
    const g0 = await guild(true);
    const gid = g0.id;
    const botId = env.DISCORD_APP_ID;
    const roleNames = [...C.REGIONS.map((r) => r.role), ...C.CHAINS.map((c) => c.role), ...C.PRODUCTS.map((p) => p.role), C.DEALS_ROLE, ...C.LANGUAGE_ROLES, C.TRUSTED_ROLE, C.MOD_ROLE];
    for (const name of roleNames) {
      if (g0.roles[name]) continue;
      await discord.createRole(gid, { name, mentionable: false, hoist: name === C.MOD_ROLE, permissions: '0' });
      log.push(`role ${name}`);
    }
    const g = await guild(true);
    const R = (n) => g.roles[n];
    const bot = { id: botId, type: 1, allow: s(P.VIEW | P.SEND | P.EMBED | P.HISTORY | P.MENTION | P.MANAGE_MSG | P.THREADS_SEND | P.THREADS_CREATE), deny: '0' };
    const mods = { id: R(C.MOD_ROLE), type: 0, allow: s(P.VIEW | P.SEND | P.MANAGE_MSG), deny: '0' };
    const readOnly = (extra = []) => [{ id: gid, type: 0, allow: s(P.VIEW | P.HISTORY), deny: s(P.SEND | P.THREADS_CREATE | P.THREADS_SEND) }, bot, mods, ...extra];
    const onlyFor = (role) => [{ id: gid, type: 0, allow: '0', deny: s(P.VIEW | P.SEND) }, { id: R(role), type: 0, allow: s(P.VIEW | P.HISTORY), deny: s(P.SEND) }, bot, mods];
    const layout = [
      { cat: 'Start here · Commencer', chans: [
        ['bienvenue-welcome', 0, readOnly(), 'Rules and how to pick your pings · Règles et choix des alertes'],
        ['how-alerts-work', 0, readOnly(), 'Sources, confidence, and why big chains are slower · Sources et confiance'],
        ['speed-log', 0, readOnly(), 'Weekly: minutes to alert and false alerts · Rapidité chaque semaine']] },
      { cat: 'Chains · Chaînes', chans: C.CHAINS.map((c) => [c.key, 0, onlyFor(c.role), `${c.name} alerts. Retailer emails and member reports; never automated checks of their site.${c.key === 'amazon-ca' ? ' As an Amazon Associate I earn from qualifying purchases.' : ''}`]) },
      { cat: 'Card shops by region · Boutiques', chans: C.REGIONS.map((r) => [r.key, 0, onlyFor(r.role), `${r.en} · ${r.fr}. Card shops checked every 2–5 minutes.`]) },
      { cat: 'Deals · Aubaines', chans: [
        ['ebay-deals', 0, readOnly(), 'eBay.ca listings that pass the exact-card filter. Asking prices, not sales.'],
        ['under-market', 0, readOnly(), 'Sealed product below market value · Produits scellés sous la valeur']] },
      { cat: 'Members · Membres', chans: [
        ['report-a-drop', 15, readOnly(), 'Use /report. A second member confirms with the button. · Utilise /report.'],
        ['price-check', 0, null, 'Use /price or /prix'],
        ['general', 0, null, 'English chat'], ['général', 0, null, 'Discussion en français'],
        ['pulls-collections', 0, null, 'Pulls and collections · Ouvertures et collections'],
        ['help-aide', 0, null, 'Questions about the server or Cardstead · Questions']] },
      { cat: 'Moderators', chans: [['mod-queue', 0, [{ id: gid, type: 0, allow: '0', deny: s(P.VIEW) }, bot, mods], 'Flags from /flag']] },
    ];
    for (const block of layout) {
      let catId = g.categories[block.cat];
      if (!catId) { catId = (await discord.createChannel(gid, { name: block.cat, type: 4 })).id; log.push(`category ${block.cat}`); }
      for (const [name, type, perms, topic] of block.chans) {
        if (g.channels[name]) continue;
        const ch = { name, type, parent_id: catId, topic };
        if (perms) ch.permission_overwrites = perms.filter((p) => p.id);
        await discord.createChannel(gid, ch);
        log.push(`#${name}`);
      }
    }
    await discord.registerCommands(gid, C.COMMANDS);
    log.push(`${C.COMMANDS.length} commands`);
    const existing = await discord.automodRules(gid).catch(() => []);
    const has = (n) => existing.some((r) => r.name === n);
    const rules = [
      { name: 'Cardstead: scam links and phrases', event_type: 1, trigger_type: 1, trigger_metadata: { keyword_filter: ['*discord.gg/*', '*discord.com/invite*', '*free nitro*', '*nitro gift*', '*steamcommunity.com/gift*', '*bit.ly/*', '*tinyurl.com/*', '*dm me to buy*', '*dm me for*'] }, actions: [{ type: 1, metadata: { custom_message: 'Links to other servers, shorteners and DM sales are blocked here. · Bloqué.' } }], enabled: true },
      { name: 'Cardstead: mass mentions', event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true }, actions: [{ type: 1 }], enabled: true }, // block only: a timeout action needs Moderate Members, which the bot is not given
      { name: 'Cardstead: spam', event_type: 1, trigger_type: 3, trigger_metadata: {}, actions: [{ type: 1 }], enabled: true },
    ];
    for (const r of rules) {
      if (has(r.name)) continue;
      try { await discord.createAutomod(gid, r); log.push(`automod ${r.name}`); } catch (err) { log.push(`automod ${r.name} failed: ${err.message}`); }
    }
    // Verification level Medium: a Discord account registered for at least 5 minutes, with a verified email.
    try { await discord.patchGuild(gid, { verification_level: 2 }); log.push('verification medium'); } catch (err) { log.push(`verification failed: ${err.message}`); }
    const g2 = await guild(true);
    // Onboarding: four questions that hand out the roles, and the channels everyone sees. Ids are reused on re-runs.
    try {
      const existing = await discord.getOnboarding(gid).catch(() => null);
      const body = C.onboardingBody({ roles: g2.roles, channels: g2.channels, existing, now: now() });
      await discord.putOnboarding(gid, body);
      log.push(`onboarding ${body.prompts.length} questions, ${body.default_channel_ids.length} default channels`);
    } catch (err) { log.push(`onboarding failed: ${err.message}`); }
    // Rules and how it works: one message in #bienvenue-welcome, edited (never duplicated) on re-runs.
    try {
      const ch = g2.channels['bienvenue-welcome'];
      if (!ch) throw Error('no #bienvenue-welcome');
      const msg = C.welcomeMessage(env.CARDSTEAD_URL);
      const mine = ((await discord.recentMessages(ch)) || []).find((m) => m.author?.id === botId && m.embeds?.[0]?.title === C.WELCOME_TITLE);
      if (mine) { await discord.edit(ch, mine.id, msg); log.push('welcome message updated'); } else { await discord.send(ch, msg); log.push('welcome message posted'); }
    } catch (err) { log.push(`welcome message failed: ${err.message}`); }
    guildCache = null;
    return log;
  }

  return { publishEvent, publishPending, expireReports, weeklySpeedLog, interaction, setup, priceCheck };
}
