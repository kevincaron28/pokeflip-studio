// Drop alerts in the Android app (Firebase Cloud Messaging): signed token request, message shape, dead tokens,
// the database switch to app devices, and the web page's app path.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const F=()=>import('../supabase/functions/_shared/fcm.mjs');
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const SA={project_id:'cardstead-test',client_email:'push@cardstead-test.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
const b64=s=>JSON.parse(Buffer.from(s,'base64url').toString());

test('the token request is a JWT signed with the service account key, for the messaging scope only',async()=>{
 const {serviceJwt}=await F();const t=Date.parse('2026-11-24T20:00:00Z');const jwt=await serviceJwt(SA,t);const [h,p,sig]=jwt.split('.');
 assert.deepEqual(b64(h),{alg:'RS256',typ:'JWT'});
 assert.deepEqual(b64(p),{iss:SA.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:t/1000,exp:t/1000+3600});
 assert.ok(crypto.verify('sha256',Buffer.from(h+'.'+p),publicKey,Buffer.from(sig,'base64url')),'signature verifies with the public key');
});

test('sends to the device token with the drop text and store link; reuses the access token; dead tokens are reported gone',async()=>{
 const {fcmSender}=await F();const calls=[];let now=0;
 const fetch=async(url,o)=>{calls.push([url,o]);if(url.includes('oauth2'))return {ok:true,json:async()=>({access_token:'at-1'})};
  const m=JSON.parse(o.body).message;if(m.token==='dead-token')return {ok:false,status:404,text:async()=>'{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}'};
  if(m.token==='busy')return {ok:false,status:503,text:async()=>'unavailable'};return {ok:true}};
 const send=fcmSender({serviceAccount:JSON.stringify(SA),fetch,now:()=>now});
 const payload={title:'In stock: Delta Reign Booster Box',body:'Hasty Cards, Toronto · $249.99',url:'https://hastycards.com/products/dr-box',tag:'hastycards.com|delta-reign|box|EN'};
 assert.deepEqual(await send({kind:'fcm',endpoint:'fcm:abc123'},payload),{ok:true});
 const [url,o]=calls[1];assert.equal(url,'https://fcm.googleapis.com/v1/projects/cardstead-test/messages:send');assert.equal(o.headers.authorization,'Bearer at-1');
 const m=JSON.parse(o.body).message;assert.equal(m.token,'abc123');assert.equal(m.notification.title,payload.title);assert.equal(m.data.url,payload.url);
 assert.equal(m.android.ttl,'1800s');assert.equal(m.android.notification.channel_id,'drops');
 assert.deepEqual(await send({endpoint:'fcm:dead-token'},payload),{ok:false,gone:true});
 assert.deepEqual(await send({endpoint:'fcm:busy'},payload),{ok:false,gone:false},'a temporary error keeps the device');
 assert.equal(calls.filter(c=>c[0].includes('oauth2')).length,1,'one access token for 50 minutes');
 now=51*60000;await send({endpoint:'fcm:abc123'},payload);assert.equal(calls.filter(c=>c[0].includes('oauth2')).length,2,'renewed after 50 minutes');
});

test('the sender sends app devices through Firebase only when the secret is set, and reads each device kind',()=>{
 const idx=fs.readFileSync(path.join(__dirname,'../supabase/functions/push-sender/index.ts'),'utf8');
 assert.match(idx,/env\.FIREBASE_SERVICE_ACCOUNT \? fcmSender/);assert.match(idx,/sub\.kind === 'fcm'/);
 assert.match(fs.readFileSync(path.join(__dirname,'../supabase/functions/_shared/push-core.mjs'),'utf8'),/select=id,kind,endpoint/);
});

test('migration 005: app devices have no Web Push keys, browser rows still need them, only members can save their own token',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../migrations/005-push-fcm.sql'),'utf8');
 assert.match(sql,/check \(kind in \('webpush','fcm'\)\)/);
 assert.match(sql,/kind = 'webpush' and endpoint like 'https:\/\/%'\) or \(kind = 'fcm' and endpoint like 'fcm:%'/);
 assert.match(sql,/check \(\(kind = 'fcm'\) or \(length\(p256dh\) between 40 and 200 and length\(auth\) between 10 and 100\)\)/);
 assert.match(sql,/security definer set search_path = ''/);assert.match(sql,/auth\.uid\(\) is null then raise/);
 assert.match(sql,/revoke all on function public\.push_subscribe_fcm\(text,jsonb,text\) from public, anon/);
 assert.match(sql,/grant execute on function public\.push_subscribe_fcm\(text,jsonb,text\) to authenticated/);
 assert.doesNotMatch(sql,/disable row level security/i);
});

test('inside the app, turning alerts on registers the device token instead of a browser subscription',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../push-link.js'),'utf8');
 assert.ok(src.includes("N.isNative){if(!N.pushAvailable||!N.pushAvailable())"),'app without Firebase config says so');
 assert.ok(src.includes("c.rpc('push_subscribe_fcm',{p_token:token,p_prefs:prefs(),p_lang:lang})"));
 assert.ok(src.includes("push_unsubscribe',{p_endpoint:'fcm:'+t}"),'turning off removes this device only');
});
