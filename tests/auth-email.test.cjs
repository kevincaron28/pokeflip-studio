const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const TEMPLATES=['supabase/email-templates/magic-link.html','supabase/email-templates/confirm-signup.html'];

test('sign-in emails carry the typed code and the link, in French (tu) and English',()=>{
 for(const f of TEMPLATES){
  const t=read(f);
  assert.ok((t.match(/\{\{ \.Token \}\}/g)||[]).length>=2,f+': the 6-digit code the app asks for');
  assert.match(t,/href="\{\{ \.ConfirmationURL \}\}"/,f+': the sign-in link');
  assert.match(t,/\bton code\b|\bTon code\b|Voici ton code|entre ce code/i,f+': French');
  assert.match(t,/code/i);assert.match(t,/Cardstead/);
  assert.ok(!/\bvous\b|\bvotre\b|\bvos\b/i.test(t),f+': tu, never vous');
  assert.ok(!/<script|<img|<link|https?:\/\//i.test(t),f+': no scripts, images or outside links (only Supabase variables)');
  // Only variables Supabase provides
  for(const v of t.matchAll(/\{\{ ?\.(\w+) ?\}\}/g))assert.ok(['Token','ConfirmationURL','SiteURL','Email'].includes(v[1]),f+': unknown variable '+v[1]);
 }
});

test('owner guide: provider, domain records and Supabase fields, never a key',()=>{
 const g=read('docs/AUTH-EMAIL-SMTP.md');
 for(const s of ['smtp.resend.com','465','`resend`','mail.kcaron.top','_dmarc','resend._domainkey','Sender email','Sender name','/auth/smtp','/auth/rate-limits','magic-link.html','confirm-signup.html'])assert.ok(g.includes(s),s);
 assert.ok(!/re_[A-Za-z0-9]{16,}|xkeysib-|SG\.[\w-]{20,}/.test(g),'no API key in the guide');
});

test('the app accepts the emailed code',()=>{
 assert.match(read('cloud-sync.js'),/verifyOtp\(\{email:[^}]*token:\$\('cloudOtp'\)\.value\.trim\(\),type:'email'\}\)/);
 assert.match(read('index.html'),/id="cloudOtp"[^>]*autocomplete="one-time-code"/);
});
