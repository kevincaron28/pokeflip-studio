// Firebase Cloud Messaging (HTTP v1) for drop alerts in the Android app.
// Needs the Supabase secret FIREBASE_SERVICE_ACCOUNT: the JSON key of a Firebase service account allowed to send messages
// (Firebase console > Project settings > Service accounts > Generate new private key). Without it, app devices are skipped.
// Uses only WebCrypto and fetch, so it runs in Supabase (Deno) and in Node tests.

const b64url = (buf) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** A signed JWT asking Google for a messaging access token. */
export async function serviceJwt(sa, now = Date.now(), subtle = globalThis.crypto.subtle) {
  const pem = String(sa.private_key || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const iat = Math.floor(now / 1000);
  const body = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 });
  const sig = await subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body));
  return body + '.' + b64url(sig);
}

/** sender(sub, payload) -> {ok, gone} for kind 'fcm' subscriptions. Caches the access token for 50 minutes. */
export function fcmSender({ serviceAccount, fetch: f = globalThis.fetch, now = () => Date.now() }) {
  const sa = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
  let token = null, until = 0;
  async function access() {
    if (token && now() < until) return token;
    const r = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(await serviceJwt(sa, now())) });
    if (!r.ok) throw Error('Google token ' + r.status);
    const j = await r.json(); token = j.access_token; until = now() + 50 * 60 * 1000; return token;
  }
  return async function send(sub, payload) {
    const deviceToken = String(sub.endpoint || '').replace(/^fcm:/, '');
    const message = { token: deviceToken, notification: { title: payload.title, body: payload.body, ...(payload.image ? { image: payload.image } : {}) },
      data: { url: String(payload.url || ''), tag: String(payload.tag || '') },
      android: { priority: 'high', ttl: '1800s', notification: { tag: String(payload.tag || '').slice(0, 100), channel_id: 'drops' } } };
    const r = await f(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
      method: 'POST', headers: { authorization: 'Bearer ' + await access(), 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
    if (r.ok) return { ok: true };
    const text = await r.text().catch(() => '');
    return { ok: false, gone: r.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(text) };
  };
}
