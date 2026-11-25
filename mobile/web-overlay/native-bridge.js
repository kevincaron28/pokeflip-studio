/* Android app only (Capacitor). Connects the web app to the phone: back button, status bar, splash,
 * sign-in deep links and local notifications. Plugins are reached through window.Capacitor.Plugins so the
 * website needs no bundler. Everything degrades to a no-op in a normal browser. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PokeFlipNative=api;})(typeof window!=='undefined'?window:undefined,function(root){
'use strict';
const SCHEME='top.kcaron.cardstudio',AUTH_URL=SCHEME+'://auth';
/** Parse a sign-in link such as top.kcaron.cardstudio://auth#access_token=..&refresh_token=.. (or ?code=..). */
function parseAuthUrl(url){
 try{
  const u=new URL(url);if(u.protocol!==SCHEME+':')return null;
  const p=new URLSearchParams((u.hash||'').replace(/^#/,''));for(const [k,v] of new URLSearchParams(u.search))if(!p.has(k))p.set(k,v);
  if(p.get('error')||p.get('error_description'))return {error:p.get('error_description')||p.get('error')};
  if(p.get('access_token')&&p.get('refresh_token'))return {accessToken:p.get('access_token'),refreshToken:p.get('refresh_token')};
  if(p.get('code'))return {code:p.get('code')};
  return null;
 }catch{return null}
}
const cap=root&&root.Capacitor,isNative=!!(cap&&cap.isNativePlatform&&cap.isNativePlatform()),P=()=>(cap&&cap.Plugins)||{};
let pending=null;
function deliver(url){const a=parseAuthUrl(url);if(!a)return;pending=a;root.dispatchEvent(new CustomEvent('pokeflip:authlink',{detail:a}))}
function takePendingAuth(){const a=pending;pending=null;return a}
async function handleBack(){
 const doc=root.document,dialog=doc.querySelector('dialog[open]');
 if(dialog){dialog.close();return}
 const drawer=doc.getElementById('mobileDrawer');if(drawer&&drawer.getAttribute('aria-hidden')==='false'){doc.getElementById('mobileScrim')?.click();return}
 // Back from any page goes to Prices (the first tab); from Prices it leaves the app.
 const open=doc.querySelector('main section:not(.hidden)');
 if(open&&open.id!=='prices'&&typeof root.go==='function'){root.go('prices');return}
 await P().App?.exitApp?.();
}
async function requestNotifications(){try{const r=await P().LocalNotifications.requestPermissions();return r.display==='granted'}catch{return false}}
// Checkout and retailer pages open in the system browser (Chrome Custom Tab) so saved logins, Shop Pay and autofill work.
async function openExternal(url){try{if(!/^https:\/\//i.test(String(url)))return false;const B=P().Browser;if(B&&B.open){await B.open({url:String(url)});return true}}catch{}try{root.open(String(url),'_blank','noopener');return true}catch{return false}}
// App push through Firebase Cloud Messaging. Switched off unless the build found mobile/android/app/google-services.json
// (build-web.mjs writes window.CARDSTEAD_FCM into fcm-config.js). registerPush() resolves with the device token.
function pushAvailable(){return !!(isNative&&root.CARDSTEAD_FCM===true&&P().PushNotifications)}
function registerPush(){const PN=P().PushNotifications;if(!pushAvailable())return Promise.reject(Error('App push is not set up in this build.'));
 return new Promise(async(resolve,reject)=>{const subs=[];const done=f=>v=>{subs.forEach(h=>h&&h.remove&&h.remove());f(v)};
  try{subs.push(await PN.addListener('registration',t=>done(resolve)(t&&t.value)));subs.push(await PN.addListener('registrationError',e=>done(reject)(Error((e&&e.error)||'Push registration failed'))));
   const perm=await PN.requestPermissions();if(perm.receive!=='granted'){done(reject)(Error('Notifications are not allowed for Cardstead. Allow them in Android settings, then try again.'));return}
   try{await PN.createChannel?.({id:'drops',name:'Drop alerts',description:'Sealed products back in stock',importance:4,visibility:1})}catch{}
   await PN.register()}catch(e){done(reject)(e)}
  setTimeout(()=>done(reject)(Error('Push registration timed out')),20000)})}
async function notify(title,body){
 try{const LN=P().LocalNotifications;if(!LN)return false;const perm=await LN.checkPermissions();if(perm.display!=='granted')return false;
  await LN.schedule({notifications:[{id:Math.floor(Date.now()%2147483000),title,body,schedule:{at:new Date(Date.now()+400)}}]});return true}catch{return false}
}
if(isNative&&root.document){
 const plugins=P();
 plugins.App?.addListener?.('backButton',()=>{handleBack().catch(()=>{})});
 plugins.App?.addListener?.('appUrlOpen',e=>deliver(e&&e.url));
 plugins.App?.getLaunchUrl?.().then(r=>{if(r&&r.url)deliver(r.url)}).catch(()=>{});
 plugins.StatusBar?.setBackgroundColor?.({color:'#111a2e'});plugins.StatusBar?.setStyle?.({style:'DARK'});
 root.addEventListener('load',()=>setTimeout(()=>plugins.SplashScreen?.hide?.(),150));
 // Tapping a drop alert opens the store's page in the system browser.
 if(root.CARDSTEAD_FCM===true)plugins.PushNotifications?.addListener?.('pushNotificationActionPerformed',a=>{const u=a&&a.notification&&a.notification.data&&a.notification.data.url;if(u)openExternal(u)});
}
return {isNative,AUTH_URL,SCHEME,parseAuthUrl,takePendingAuth,notify,requestNotifications,openExternal,pushAvailable,registerPush};
});
