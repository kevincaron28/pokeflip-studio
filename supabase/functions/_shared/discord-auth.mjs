// The publisher only runs for callers holding one of this project's server keys:
// the legacy service role key (Authorization: Bearer …) or a new-style secret key (sb_secret_…), which
// Supabase Cron's "Add secret key" preset sends in the apikey header. Supabase provides both to the function
// as SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SECRET_KEYS; nothing is configured by hand.

function same(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (!x.length || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** The server keys from the function's environment. SUPABASE_SECRET_KEYS is a JSON object of name -> key. */
export function serverKeys(env) {
  const keys = [];
  if (env.SUPABASE_SERVICE_ROLE_KEY) keys.push(String(env.SUPABASE_SERVICE_ROLE_KEY));
  const raw = env.SUPABASE_SECRET_KEYS;
  if (raw) {
    try { const j = JSON.parse(raw); for (const v of Object.values(j && typeof j === 'object' ? j : {})) if (typeof v === 'string') keys.push(v); }
    catch { for (const v of String(raw).split(',')) if (v.trim()) keys.push(v.trim()); }
  }
  return keys.filter((k) => k.length >= 20);
}

/** authorization: the Authorization header; apikey: the apikey header; keys: serverKeys(env) (or one key string). */
export function isServiceRole(authorization, keys, apikey = null) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter((k) => typeof k === 'string' && k);
  if (!list.length) return false;
  const presented = [];
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) presented.push(authorization.slice(7));
  if (typeof apikey === 'string' && apikey) presented.push(apikey);
  return presented.some((p) => list.some((k) => same(p, k)));
}
