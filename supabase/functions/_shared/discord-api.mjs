// Small Discord REST client and request-signature check. fetch is injected so tests can fake it.

const API = 'https://discord.com/api/v10';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function discordClient({ token, appId, fetch: f = globalThis.fetch, wait = sleep }) {
  async function call(method, path, body, { auth = true, retry = 2 } = {}) {
    const headers = { 'content-type': 'application/json', 'user-agent': 'CardsteadDrops (https://pokeflip-studio.vercel.app, 1.0)' };
    if (auth) headers.authorization = `Bot ${token}`;
    const res = await f(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 429 && retry > 0) {
      // Honour Discord's rate limit instead of hammering it.
      const j = await res.json().catch(() => ({}));
      await wait(Math.min(10000, Math.ceil((Number(j.retry_after) || 1) * 1000)));
      return call(method, path, body, { auth, retry: retry - 1 });
    }
    if (res.status === 204) return null;
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) { const e = Error(`Discord ${method} ${path.split('?')[0]} -> ${res.status}: ${data?.message || text}`.slice(0, 300)); e.status = res.status; throw e; }
    return data;
  }
  return {
    call,
    send: (channelId, msg) => call('POST', `/channels/${channelId}/messages`, msg),
    edit: (channelId, messageId, msg) => call('PATCH', `/channels/${channelId}/messages/${messageId}`, msg),
    forumPost: (channelId, name, msg) => call('POST', `/channels/${channelId}/threads`, { name: name.slice(0, 100), message: msg }),
    channels: (guildId) => call('GET', `/guilds/${guildId}/channels`),
    roles: (guildId) => call('GET', `/guilds/${guildId}/roles`),
    createRole: (guildId, role) => call('POST', `/guilds/${guildId}/roles`, role),
    createChannel: (guildId, ch) => call('POST', `/guilds/${guildId}/channels`, ch),
    addRole: (guildId, userId, roleId) => call('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`),
    automodRules: (guildId) => call('GET', `/guilds/${guildId}/auto-moderation/rules`),
    createAutomod: (guildId, rule) => call('POST', `/guilds/${guildId}/auto-moderation/rules`, rule),
    registerCommands: (guildId, cmds) => call('PUT', `/applications/${appId}/guilds/${guildId}/commands`, cmds),
    patchGuild: (guildId, body) => call('PATCH', `/guilds/${guildId}`, body),
    getOnboarding: (guildId) => call('GET', `/guilds/${guildId}/onboarding`),
    putOnboarding: (guildId, body) => call('PUT', `/guilds/${guildId}/onboarding`, body),
    recentMessages: (channelId, limit = 50) => call('GET', `/channels/${channelId}/messages?limit=${limit}`),
    async dm(userId, msg) { const ch = await call('POST', '/users/@me/channels', { recipient_id: userId }); return call('POST', `/channels/${ch.id}/messages`, msg); },
    followUp: (interactionToken, msg) => call('PATCH', `/webhooks/${appId}/${interactionToken}/messages/@original`, msg, { auth: false }),
  };
}

const hex = (s) => new Uint8Array((s.match(/../g) || []).map((b) => parseInt(b, 16)));

/** Discord signs every interaction with Ed25519; reject anything that does not verify. */
export async function verifySignature(publicKeyHex, signatureHex, timestamp, rawBody, subtle = globalThis.crypto.subtle) {
  if (!publicKeyHex || !/^[0-9a-f]{64}$/i.test(publicKeyHex) || !/^[0-9a-f]{128}$/i.test(signatureHex || '') || !timestamp) return false;
  try {
    const key = await subtle.importKey('raw', hex(publicKeyHex), { name: 'Ed25519' }, false, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, key, hex(signatureHex), new TextEncoder().encode(timestamp + rawBody));
  } catch { return false; }
}
