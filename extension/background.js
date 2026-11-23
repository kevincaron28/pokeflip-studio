/* Cardstead Drop Assist: background worker (Manifest V3).
 * - Amazon.ca: a gentle background check of each watched product page with the owner's own signed-in session.
 * - Pokémon Center Canada: a pinned watch tab that reloads politely, never during the waiting room.
 * - On a drop: loud alerts (notification, sound, optional phone push through ntfy) and checkout assist in a tab.
 * Nothing here stores passwords or card numbers, solves CAPTCHAs, skips queues or places orders.
 */
importScripts('lib/core.js');
const A=self.CardsteadAssist;
const DEFAULT_SETTINGS={intervalMin:A.DEFAULT_INTERVAL_MIN,assist:'checkout',sound:true,ntfyTopic:'',autoAck:false,dailyCap:0,postalCode:'',street:'',sellerAllowlist:[]};

async function load(){const s=await chrome.storage.local.get(['products','settings','state','log','pending','orders']);
 return {products:s.products||[],settings:{...DEFAULT_SETTINGS,...(s.settings||{})},state:s.state||{},log:s.log||[],pending:s.pending||{},orders:s.orders||[]}}
// Order ledger: every automatic attempt and order, with time, price and quantity (kept 1 year, at most 1000).
async function recordOrder(entry){const {orders}=await load();const i=orders.findIndex(o=>o.attemptId===entry.attemptId);if(i>=0)orders[i]={...orders[i],...entry};else orders.push(entry);await chrome.storage.local.set({orders:orders.filter(o=>Date.now()-Date.parse(o.at)<365*86400000).slice(-1000)})}
async function dropJob(id){const {pending}=await load();const next={...pending};Reflect.deleteProperty(next,id);await chrome.storage.local.set({pending:next})}
async function log(message,productId=null){const {log:l}=await load();l.push({at:new Date().toISOString(),productId,message:String(message).slice(0,300)});await chrome.storage.local.set({log:l.slice(-500)})}
async function setState(id,patch){const {state}=await load();state[id]={...(state[id]||{}),...patch};await chrome.storage.local.set({state})}

chrome.runtime.onInstalled.addListener(()=>{chrome.alarms.create('tick',{periodInMinutes:1});log('Drop Assist installed or updated.')});
chrome.runtime.onStartup.addListener(()=>chrome.alarms.create('tick',{periodInMinutes:1}));
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='tick')tick()});

async function tick(){
 const {products,settings,state,orders}=await load();const now=Date.now();
 // An order click with no confirmation page within 2 minutes is reported, never retried.
 for(const o of orders.filter(o=>o.status==='attempted'&&now-Date.parse(o.at)>2*60000)){await recordOrder({...o,status:'unknown'});const p=products.find(x=>x.id===o.productId)||{name:'Amazon order'};await log('Order result unknown: no confirmation page after 2 minutes. Not retried. Check your Amazon orders.',o.productId);await alertOwner({...p,url:A.cancelUrl(null)},'Check your Amazon orders','Drop Assist pressed Place your order for '+p.name+' but saw no confirmation. It will not try again. Open your orders to check.',true)}
 for(const p of products.filter(p=>p.enabled)){
  const s=state[p.id]||{};
  if(s.backoffUntil&&now<s.backoffUntil)continue;
  if(s.nextAt&&now<s.nextAt)continue;
  await setState(p.id,{nextAt:now+A.nextDelayMs(settings.intervalMin,s.failures||0)});
  if(p.store==='amazon')await checkAmazon(p);else await ensureWatchTab(p,true);
 }
}

async function checkAmazon(p,why='scheduled check'){
 try{
  const res=await fetch(p.url,{credentials:'include',cache:'no-store',redirect:'follow'});
  if(!res.ok)throw Error('HTTP '+res.status);
  await handleObservation(p,A.parseAmazon(await res.text()),why);
  await setState(p.id,{failures:0});
 }catch(e){const {state}=await load();await setState(p.id,{failures:(state[p.id]?.failures||0)+1,lastStatus:'check failed: '+e.message});await log('Check failed: '+e.message,p.id)}
}

/** Pokémon Center: one pinned tab per product; the content script reports each page load. */
async function ensureWatchTab(p,reload){
 const {state}=await load();const s=state[p.id]||{};
 let tab=null;if(s.tabId){try{tab=await chrome.tabs.get(s.tabId)}catch{tab=null}}
 if(!tab){tab=await chrome.tabs.create({url:p.url,pinned:true,active:false});await chrome.tabs.update(tab.id,{autoDiscardable:false});await setState(p.id,{tabId:tab.id});await log('Opened a pinned watch tab for Pokémon Center.',p.id);return}
 if(s.inQueue){return} // never reload while in the waiting room: the queue page moves on its own
 if(reload)await chrome.tabs.reload(tab.id);
}

async function handleObservation(p,obs,why){
 const {state,settings}=await load();const s=state[p.id]||{};
 const d=A.decide(p,obs,s);
 await setState(p.id,{lastCheck:new Date().toISOString(),lastStatus:d.reason,lastPrice:obs.price??null,inQueue:d.action==='queue'});
 if(d.action==='backoff'){await setState(p.id,{backoffUntil:d.until});await log(d.reason,p.id);await alertOwner(p,'Amazon robot check',d.reason,false);return}
 if(d.action==='queue'){if(!s.inQueue){await log('Entered the Pokémon Center waiting room. The tab stays in line; Drop Assist will not reload it.',p.id);await alertOwner(p,'In the Pokémon Center line',`${p.name}: keep the pinned tab open. You will get an alert when you are through.`,false)}return}
 if(s.inQueue){await log('Through the Pokémon Center waiting room.',p.id);await alertOwner(p,'Through the Pokémon Center line!',`${p.name}: the product page is open now.`,true)}
 if(d.action!=='drop')return;
 const qty=A.quantity(p,obs.maxQty,obs.limit);
 await setState(p.id,{lastDropAt:Date.now()});
 // Automatic only when every precondition holds and the estimate fits today's cap; otherwise assist.
 let mode=settings.assist;
 if(mode==='checkout'&&p.autoBuy){const el=A.autoEligible(p,settings);const {orders}=await load();const est=obs.price*qty;
  if(!el.ok)await log('Automatic checkout skipped: '+el.why.join('; ')+'. Using checkout assist.',p.id);
  else if(A.spentToday(orders)+est>settings.dailyCap)await log(`Automatic checkout skipped: about ${est.toFixed(2)} would pass today's cap. Using checkout assist.`,p.id);
  else mode='auto'}
 await log(`DROP (${why}): ${d.reason}. ${mode==='auto'?'AUTOMATIC CHECKOUT for '+qty+' (checked again on the checkout page).':mode==='checkout'?'Opening checkout assist for '+qty+'.':'Alert only.'}`,p.id);
 await alertOwner(p,'DROP: '+p.name,`${d.reason}. ${mode==='auto'?'Automatic checkout is running: you will get an alert with a cancel link if an order is placed.':mode==='checkout'?'Cart and checkout are opening: review and click Place order yourself.':'Open the product now.'}`,true);
 const {pending}=await load();pending[p.id]={qty,mode,expires:Date.now()+A.ASSIST_TTL_MIN*60000,step:'product',attemptId:p.id+'@'+Date.now(),attempted:false};await chrome.storage.local.set({pending});
 const tabId=state[p.id]?.tabId;
 if(p.store==='pokemoncenter'&&tabId){try{await chrome.tabs.update(tabId,{active:true,pinned:false});const t=await chrome.tabs.get(tabId);await chrome.windows.update(t.windowId,{focused:true});await chrome.tabs.sendMessage(tabId,{type:'assist-start'});return}catch{}}
 const tab=await chrome.tabs.create({url:p.url,active:true});await chrome.windows.update(tab.windowId,{focused:true});
}

async function alertOwner(p,title,message,loud){
 const {settings}=await load();
 const nid='drop-'+p.id+'-'+Date.now();links[nid]=p.url;
 chrome.notifications.create(nid,{type:'basic',iconUrl:'icons/icon-192.png',title,message,priority:loud?2:1,requireInteraction:loud});
 if(loud&&settings.sound)await playSound();
 if(settings.ntfyTopic&&A.ntfyTopicOk(settings.ntfyTopic)){
  try{await fetch('https://ntfy.sh/'+settings.ntfyTopic,{method:'POST',body:message,headers:{Title:title.replace(/[^\x20-\x7E]/g,''),Priority:loud?'urgent':'default',Click:p.url,Tags:loud?'rotating_light':'hourglass'}})}catch(e){await log('Phone push failed: '+e.message,p.id)}
 }
}
async function playSound(){
 try{const has=await chrome.offscreen.hasDocument?.();if(!has)await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['AUDIO_PLAYBACK'],justification:'Loud alert when a watched product drops'});chrome.runtime.sendMessage({type:'play-alarm'})}catch{}
}

// Clicking a notification opens its link (after an order: the order page with Amazon's cancel button).
const links={};
chrome.notifications.onClicked.addListener(id=>{if(links[id])chrome.tabs.create({url:links[id]})});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{(async()=>{
 const {products,pending}=await load();
 if(msg.type==='pc-status'){
  const p=products.find(x=>x.store==='pokemoncenter'&&(x.id===msg.id||sender.tab&&x.url.split('/').slice(0,6).join('/')===String(msg.url||'').split('/').slice(0,6).join('/')));
  if(p){await setState(p.id,{tabId:sender.tab?.id});await handleObservation(p,msg.obs,'watch tab')}
  reply({ok:true});return}
 if(msg.type==='assist-get'){
  const p=products.find(x=>msg.url&&A.productFromInput(msg.url)?.id===x.id)||products.find(x=>pending[x.id]&&x.store===msg.store);
  const job=p&&pending[p.id];reply(job&&job.expires>Date.now()?{product:p,job}:null);return}
 if(msg.type==='assist-step'){const p=products.find(x=>x.id===msg.id);if(p){if(pending[p.id]){pending[p.id].step=msg.step;await chrome.storage.local.set({pending})}await log(msg.message,p.id)}reply({ok:true});return}
 if(msg.type==='assist-done'){delete pending[msg.id];await chrome.storage.local.set({pending});await log(msg.message||'Checkout page reached: waiting for you to place the order.',msg.id);reply({ok:true});return}
 if(msg.type==='auto-verify'){
  // Re-checked here with the stored settings: the page script's word is not enough.
  const p=products.find(x=>x.id===msg.id),job=p&&pending[p.id];
  if(!p||!job||job.mode!=='auto'||job.expires<Date.now()){reply({go:false,why:['no automatic checkout pending']});return}
  if(job.attempted){await log('Second Place-order attempt refused: at most one per drop.',p.id);reply({go:false,why:['already attempted for this drop']});return}
  const {settings,orders}=await load();
  const el=A.autoEligible(p,settings);
  const v=el.ok?A.verifyCheckout(p,settings,msg.parsed,job.qty,A.spentToday(orders)):{ok:false,why:el.why};
  if(!v.ok){job.mode='checkout';await chrome.storage.local.set({pending});await recordOrder({attemptId:job.attemptId,at:new Date().toISOString(),productId:p.id,status:'not-placed',qty:job.qty,total:msg.parsed?.orderTotal??null,reason:v.why.join('; ')});
   await log('NOT BOUGHT automatically: '+v.why.join('; ')+'. Checkout left open for you.',p.id);
   await alertOwner(p,'Not bought: check '+p.name,'Automatic checkout stopped: '+v.why.join('; ')+'. Checkout is open: review it and place the order yourself if it is right.',true);reply({go:false,why:v.why});return}
  job.attempted=true;await chrome.storage.local.set({pending});
  await recordOrder({attemptId:job.attemptId,at:new Date().toISOString(),productId:p.id,status:'attempted',qty:v.qty,unit:v.unit,total:v.total});
  await log(`PLACING ORDER automatically: ${v.qty} × ${p.name}, unit ${(v.unit||0).toFixed(2)}, total ${v.total.toFixed(2)} (incl. tax and shipping).`,p.id);
  reply({go:true});return}
 if(msg.type==='auto-placed'){
  const p=products.find(x=>x.id===msg.id),job=p&&pending[p.id];
  if(p&&job){await recordOrder({attemptId:job.attemptId,status:'placed',orderId:msg.orderId||null,placedAt:new Date().toISOString()});await dropJob(p.id);
   const url=A.cancelUrl(msg.orderId);await log('ORDER PLACED'+(msg.orderId?' #'+msg.orderId:'')+'. Cancel link: '+url,p.id);
   await alertOwner({...p,url},'ORDER PLACED: '+p.name,'Amazon confirmed the order'+(msg.orderId?' #'+msg.orderId:'')+'. Tap to open it and cancel if you need to.',true)}
  reply({ok:true});return}
 if(msg.type==='auto-unconfirmed'){
  const p=products.find(x=>x.id===msg.id),job=p&&pending[p.id];
  if(p&&job){await recordOrder({attemptId:job.attemptId,status:'unknown',reason:msg.reason||'no confirmation page'});await dropJob(p.id);
   await log('Order result unknown: '+(msg.reason||'no confirmation page')+'. Not retried.',p.id);
   await alertOwner({...p,url:A.cancelUrl(null)},'Check your Amazon orders',p.name+': Place your order was pressed but no confirmation appeared. It will not try again.',true)}
  reply({ok:true});return}
 if(msg.type==='cardstead-signal'){
  const ids=A.signalsFromCardstead(msg.entries,products);
  for(const id of ids){const p=products.find(x=>x.id===id);if(!p?.enabled)continue;const {state}=await load();const s=state[id]||{};
   if(s.lastCheck&&Date.now()-Date.parse(s.lastCheck)<60000)continue; // never more than once a minute
   await log('Cardstead restock alert: checking now.',id);if(p.store==='amazon')await checkAmazon(p,'Cardstead alert');else await ensureWatchTab(p,true)}
  reply({checked:ids.length});return}
 if(msg.type==='check-now'){const p=products.find(x=>x.id===msg.id);if(p){if(p.store==='amazon')await checkAmazon(p,'manual check');else await ensureWatchTab(p,true)}reply({ok:true});return}
 reply(null);
})();return true});
