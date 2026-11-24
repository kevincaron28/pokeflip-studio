// The publisher only runs for callers that send this project's service role key (Supabase Cron, the dashboard tester).
export function isServiceRole(authorization, serviceKey) {
  if (!serviceKey || typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return false;
  const a = new TextEncoder().encode(authorization.slice(7)), b = new TextEncoder().encode(serviceKey);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
