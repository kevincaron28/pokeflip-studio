// Makes the key pair for Web Push (VAPID), once. Run: node tools/make-vapid-keys.mjs
// Put VAPID_PUBLIC_KEY in Vercel / Cloudflare Pages (public: the site gives it to browsers through /api/config)
// and in Supabase Edge Function secrets; put VAPID_PRIVATE_KEY ONLY in Supabase Edge Function secrets. Never commit them.
import { generateKeyPairSync } from 'node:crypto';

export function vapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = publicKey.export({ format: 'jwk' });
  const b = (s) => Buffer.from(s, 'base64url');
  const raw = Buffer.concat([Buffer.from([4]), b(pub.x), b(pub.y)]); // uncompressed point, what browsers expect
  return { publicKey: raw.toString('base64url'), privateKey: jwk.d };
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const k = vapidKeys();
  console.log('VAPID_PUBLIC_KEY=' + k.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + k.privateKey + '   (Supabase secret only)');
}
