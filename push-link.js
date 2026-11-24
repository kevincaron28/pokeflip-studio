/* Settings -> Drop alerts on this device: Web Push for restocks found by the drops pipeline (drop_events).
 * Needs a signed-in Cardstead account (cloud sync) so the subscription is tied to you and can be removed.
 * Preferences: your area (from My area & stores), big chains on or off, and "good prices only" (at or under market + 10%).
 * The Android app's web view has no Web Push: there, alerts come through the website in Chrome until app push exists. */
(function(root){'use strict';
const REGIONS={QC:['qc-montreal','qc-quebec-regions'],ON:['on-gta','on-ottawa-other'],BC:['bc'],AB:['prairies'],MB:['prairies'],SK:['prairies'],NB:['atlantic'],NS:['atlantic'],PE:['atlantic'],NL:['atlantic']};
const core={
 /** Default preferences from the province in My area & stores. Pure. */
 prefsFor(province,{chains=true,goodPriceOnly=true}={}){return {regions:[...(REGIONS[province]||[]),'online-canada'],chains:!!chains,goodPriceOnly:!!goodPriceOnly,kinds:[],langs:[]}},
 /** base64url VAPID key -> Uint8Array for pushManager.subscribe. Pure. */
 keyBytes(b64){const s=String(b64||'').replace(/-/g,'+').replace(/_/g,'/');const pad=s+'='.repeat((4-s.length%4)%4);const bin=typeof atob==='function'?atob(pad):Buffer.from(pad,'base64').toString('binary');return Uint8Array.from(bin,c=>c.charCodeAt(0))},
 supported(w){return !!(w&&w.navigator&&'serviceWorker' in w.navigator&&'PushManager' in w&&'Notification' in w)},
};
root.CardsteadPush=core;
if(typeof document==='undefined'){if(typeof module!=='undefined'&&module.exports)module.exports=core;return}
const $=id=>document.getElementById(id);
const say=t=>{const m=$('pushStatus');if(m)m.textContent=t};
const base=()=>root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'';
async function client(){const c=root.PokeFlipCloudClient&&root.PokeFlipCloudClient();if(!c)throw Error('Set up cloud sync and sign in first (Settings > Backup and cloud).');const {data}=await c.auth.getUser();if(!data?.user)throw Error('Sign in first (Settings > Backup and cloud).');return c}
async function vapidKey(){const r=await fetch(base()+'/api/config',{cache:'no-store'});const j=r.ok?await r.json():{};if(!j.vapidPublicKey)throw Error('Drop alerts are not switched on for this site yet.');return j.vapidPublicKey}
function prefs(){const P=root.CardsteadStorePrefs;const p=P?P.get():{};return core.prefsFor(p.province||'QC',{chains:$('pushChains')?.checked!==false,goodPriceOnly:$('pushGood')?.checked!==false})}
async function turnOn(){
 const N=root.PokeFlipNative;
 if(N&&N.isNative){if(!N.pushAvailable||!N.pushAvailable()){say('The Android app cannot receive these alerts yet. Open Cardstead in Chrome on this phone and turn them on there.');return}
  try{const c=await client();const token=await N.registerPush();const lang=root.CardsteadI18n?.lang?.()==='fr'?'fr':'en';
   const {error}=await c.rpc('push_subscribe_fcm',{p_token:token,p_prefs:prefs(),p_lang:lang});if(error)throw error;try{localStorage.setItem('cardstead-fcm-token',token)}catch{}say('Drop alerts are on for this device.');refresh()}catch(e){say(e.message||String(e))}return}
 if(!core.supported(root)){say('This browser cannot receive push alerts. On iPhone, add Cardstead to the Home Screen first.');return}
 try{const c=await client();const key=await vapidKey();
  const perm=await Notification.requestPermission();if(perm!=='granted'){say('Notifications are blocked for this site. Allow them in the browser settings, then try again.');return}
  const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:core.keyBytes(key)});
  const j=sub.toJSON();const lang=root.CardsteadI18n?.lang?.()==='fr'?'fr':'en';
  const {error}=await c.rpc('push_subscribe',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_prefs:prefs(),p_lang:lang});if(error)throw error;
  say('Drop alerts are on for this device.');refresh()}
 catch(e){say(e.message||String(e))}
}
async function turnOff(){const N=root.PokeFlipNative;if(N&&N.isNative){try{const t=localStorage.getItem('cardstead-fcm-token');if(t){const c=await client();await c.rpc('push_unsubscribe',{p_endpoint:'fcm:'+t});localStorage.removeItem('cardstead-fcm-token')}say('Drop alerts are off for this device.');refresh()}catch(e){say(e.message||String(e))}return}
 try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){const c=await client();await c.rpc('push_unsubscribe',{p_endpoint:sub.endpoint});await sub.unsubscribe()}say('Drop alerts are off for this device.');refresh()}catch(e){say(e.message||String(e))}}
async function refresh(){const on=$('pushOn'),off=$('pushOff');if(!on)return;let has=false;if(root.PokeFlipNative&&root.PokeFlipNative.isNative){try{has=!!localStorage.getItem('cardstead-fcm-token')}catch{}on.hidden=has;off.hidden=!has;return}try{const reg=core.supported(root)?await navigator.serviceWorker.getRegistration():null;has=!!(reg&&await reg.pushManager.getSubscription())}catch{}on.hidden=has;off.hidden=!has}
function wire(){if(!$('pushOn'))return;$('pushOn').onclick=turnOn;$('pushOff').onclick=turnOff;
 for(const id of ['pushChains','pushGood']){const el=$(id);if(el)el.onchange=()=>{refresh().then(()=>{if(!$('pushOff').hidden)turnOn()})}}refresh()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})(typeof window!=='undefined'?window:globalThis);
