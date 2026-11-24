// Database access for the Discord bot through Supabase's REST API with the service role.
// Runs only inside Supabase functions; the service role key is provided there by Supabase and never leaves the server.

export function supabaseStore({ url, serviceKey, fetch: f = globalThis.fetch }) {
  const base = `${url}/rest/v1`;
  async function q(method, path, body, prefer) {
    const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
    if (prefer) headers.prefer = prefer;
    const res = await f(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) throw Error(`Database ${method} ${path.split('?')[0]} -> ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }
  const e = encodeURIComponent;
  const one = (rows) => (Array.isArray(rows) ? rows[0] || null : rows);
  return {
    newEvents: (limit = 50) => q('GET', `/drop_events?processed_at=is.null&order=created_at.asc&limit=${limit}`),
    markEvent: (id, outcome, now) => q('PATCH', `/drop_events?id=eq.${e(id)}`, { processed_at: new Date(now).toISOString(), discord_outcome: String(outcome).slice(0, 200) }),
    insertEvent: (ev) => q('POST', '/drop_events', ev, 'return=minimal'),
    getPost: async (key) => one(await q('GET', `/discord_posts?key=eq.${e(key)}&limit=1`)),
    getPostById: async (id) => one(await q('GET', `/discord_posts?id=eq.${e(id)}&limit=1`)),
    upsertPost: (row) => q('POST', '/discord_posts?on_conflict=key', row, 'resolution=merge-duplicates,return=minimal'),
    updatePost: (id, patch) => q('PATCH', `/discord_posts?id=eq.${e(id)}`, patch),
    addWasntThere: async (postId, userId) => Number(await q('POST', '/rpc/discord_add_wasnt_there', { p_post: postId, p_user: String(userId) })),
    insertReport: (r) => q('POST', '/discord_reports', r, 'return=minimal'),
    getReport: async (id) => one(await q('GET', `/discord_reports?id=eq.${e(id)}&limit=1`)),
    /** Changes a report only if it still has the expected status; returns the updated row or null (someone else got there first). */
    moveReport: async (id, from, patch) => one(await q('PATCH', `/discord_reports?id=eq.${e(id)}&status=eq.${from}`, patch, 'return=representation')),
    expiredReports: (now) => q('GET', `/discord_reports?status=eq.pending&expires_at=lte.${e(new Date(now).toISOString())}&limit=50`),
    bumpReporter: async (userId, good, bad) => one(await q('POST', '/rpc/discord_bump_reporter', { p_user: String(userId), p_good: good, p_bad: bad })),
    createLinkCode: (code, userId, expiresAt) => q('POST', '/discord_link_codes', { code, discord_user_id: String(userId), expires_at: expiresAt }, 'return=minimal'),
    dmTargets: () => q('POST', '/rpc/discord_dm_targets', {}),
    postsSince: (iso) => q('GET', `/discord_posts?posted_at=gte.${e(iso)}&select=store_name,first_seen_at,posted_at,state&limit=5000`),
  };
}
