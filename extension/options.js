/* Settings page and popup: products (max price, max quantity, on/off), global settings, activity log. */
(function(){'use strict';
const A=self.CardsteadAssist,$=id=>document.getElementById(id);
const store=chrome.storage.local;
const fmt=v=>Number.isFinite(v)?'$'+v.toFixed(2):'—';
const el=(t,txt,cls)=>{const n=document.createElement(t);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n};

async function render(){
 const {products=[],state={},settings={},log=[]}=await store.get(['products','state','settings','log']);
 const host=$('products');host.replaceChildren();
 if(!products.length)host.append(el('p','No product yet.','note'));
 for(const p of products){
  const s=state[p.id]||{};const row=el('div',undefined,'prod');
  const info=el('div');info.append(el('strong',p.name),el('div',(p.store==='amazon'?'Amazon.ca':'Pokémon Center Canada')+' · max '+fmt(p.maxPrice)+' · up to '+p.maxQty+(p.store==='amazon'&&p.amazonOnly!==false?' · sold by Amazon.ca only':''),'status'),
   el('div',(p.enabled?'On':'Paused')+(s.lastCheck?' · last check '+new Date(s.lastCheck).toLocaleString('en-CA'):' · not checked yet')+(s.lastStatus?' · '+s.lastStatus:''),'status'));
  const btns=el('div',undefined,'row');
  const toggle=el('button',p.enabled?'Pause':'Turn on');toggle.onclick=()=>update(p.id,{enabled:!p.enabled});
  const check=el('button','Check now');check.onclick=()=>chrome.runtime.sendMessage({type:'check-now',id:p.id},()=>setTimeout(render,1500));
  const del=el('button','Remove');del.onclick=async()=>{const {products:list=[]}=await store.get('products');await store.set({products:list.filter(x=>x.id!==p.id)});render()};
  btns.append(toggle,check,del);
  const edit=el('div',undefined,'grid');
  const field=(lab,val,key,attrs)=>{const w=el('div');const l=el('label',lab);const i=document.createElement('input');Object.assign(i,attrs,{value:val});i.onchange=()=>{const n=Number(i.value);if(n>0)update(p.id,{[key]:key==='maxQty'?Math.min(10,Math.floor(n)):n})};l.htmlFor=i.id=key+'-'+p.id;w.append(l,i);return w};
  edit.append(field('Max price · CAD',p.maxPrice,'maxPrice',{type:'number',min:1,step:0.01}),field('Max quantity',p.maxQty,'maxQty',{type:'number',min:1,max:10,step:1}));
  if(p.store==='amazon'){const w=el('label');const c=document.createElement('input');c.type='checkbox';c.checked=p.amazonOnly!==false;c.onchange=()=>update(p.id,{amazonOnly:c.checked});w.className='row';w.append(c,' Only when sold by Amazon.ca (skips third-party resellers)');edit.append(w);
   // Automatic checkout: off by default, per product, only after the warning is accepted.
   edit.append(field('Max order total incl. tax & shipping · CAD',p.maxOrderTotal??'','maxOrderTotal',{type:'number',min:1,step:0.01}));
   if(A.AUTO_CHECKOUT_ENABLED){const aw=el('label');aw.className='row';const ac=document.createElement('input');ac.type='checkbox';ac.id='auto-'+p.id;ac.checked=!!p.autoBuy;ac.disabled=!settings.autoAck;
   ac.onchange=()=>{if(ac.checked&&!(p.maxOrderTotal>0)){ac.checked=false;alert('Set a max order total for this product first.');return}update(p.id,{autoBuy:ac.checked})};
   aw.append(ac,el('span',' Automatic checkout (places the order for you)',p.autoBuy?'auto-on':''));edit.append(aw);
   if(p.autoBuy){const e2=A.autoEligible(p,settings);if(!e2.ok)edit.append(el('div','Will use checkout assist until fixed: '+e2.why.join('; ')+'.','status'))}
   else if(!settings.autoAck)edit.append(el('div','Automatic checkout needs the Amazon terms warning accepted below.','status'))}}
  row.append(info,btns,edit);host.append(row);
 }
 $('interval').value=settings.intervalMin||A.DEFAULT_INTERVAL_MIN;$('assist').value=settings.assist||'checkout';$('ntfy').value=settings.ntfyTopic||'';$('sound').checked=settings.sound!==false;
 $('autoAck').checked=!!settings.autoAck;$('dailyCap').value=settings.dailyCap||'';$('postalCode').value=settings.postalCode||'';$('street').value=settings.street||'';$('sellers').value=(settings.sellerAllowlist||[]).join(', ');
 const {orders=[]}=await store.get('orders');const spent=A.spentToday(orders);
 $('spent').textContent=settings.dailyCap>0?`Today: ${fmt(spent)} of your ${fmt(Number(settings.dailyCap))} cap.`:'No daily cap set: automatic checkout stays off.';
 $('orders').replaceChildren();
 if(!orders.length)$('orders').textContent='No automatic order or attempt yet.';
 for(const o of orders.slice().reverse()){const line=el('div',`${new Date(o.at).toLocaleString('en-CA')}  ${products.find(x=>x.id===o.productId)?.name||o.productId}  ${o.status.toUpperCase()}  qty ${o.qty??'?'}  unit ${fmt(o.unit)}  total ${fmt(o.total)}${o.reason?'  · '+o.reason:''}  `);
  if(o.status==='placed'||o.status==='unknown'){const a=el('a',o.orderId?'Open order #'+o.orderId+' (cancel)':'Open your orders');a.href=A.cancelUrl(o.orderId);a.target='_blank';a.rel='noopener noreferrer';line.append(a)}
  $('orders').append(line)}
 $('log').textContent=log.slice().reverse().map(l=>`${new Date(l.at).toLocaleString('en-CA')}  ${products.find(p=>p.id===l.productId)?.name||''}  ${l.message}`).join('\n')||'Nothing yet.';
}
async function update(id,patch){const {products=[]}=await store.get('products');await store.set({products:products.map(p=>p.id===id?{...p,...patch}:p)});render()}

$('add').onsubmit=async e=>{e.preventDefault();const msg=$('addMsg');
 const ref=A.productFromInput($('addUrl').value);
 if(!ref){msg.textContent='Use an Amazon.ca product link or ASIN, or a Pokémon Center Canada link (pokemoncenter.com/en-ca/product/…).';return}
 const maxPrice=Number($('addPrice').value),maxQty=Math.min(10,Math.max(1,Math.floor(Number($('addQty').value))));
 const {products=[]}=await store.get('products');
 if(products.some(p=>p.id===ref.id)){msg.textContent='Already watched.';return}
 if(products.length>=15){msg.textContent='15 products at most, to keep the checks polite.';return}
 products.push({...ref,name:$('addName').value.trim().slice(0,80),maxPrice,maxQty,enabled:true,amazonOnly:true});
 await store.set({products});e.target.reset();msg.textContent='Added. The first check runs within a minute.';render()};
$('save').onclick=async()=>{const topic=$('ntfy').value.trim();if(topic&&!A.ntfyTopicOk(topic)){$('saveMsg').textContent='The ntfy topic needs 8 to 64 letters, digits, - or _.';return}
 const {settings:old={}}=await store.get('settings');
 await store.set({settings:{...old,intervalMin:Math.max(A.MIN_INTERVAL_MIN,Math.min(60,Number($('interval').value)||A.DEFAULT_INTERVAL_MIN)),assist:$('assist').value,ntfyTopic:topic,sound:$('sound').checked}});$('saveMsg').textContent='Saved.';render()};
$('saveAuto').onclick=async()=>{const m=$('autoMsg');const {settings:old={},products=[]}=await store.get(['settings','products']);
 const ack=$('autoAck').checked,cap=Number($('dailyCap').value)||0,postal=$('postalCode').value.trim().toUpperCase();
 if(ack&&!(cap>0)){m.textContent='Set a daily spending cap above $0.';return}
 if(ack&&!/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(postal)){m.textContent='Enter the Canadian postal code of the address saved in Amazon (like J4K 1A1).';return}
 const sellers=$('sellers').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,10);
 await store.set({settings:{...old,autoAck:ack,dailyCap:cap,postalCode:postal,street:$('street').value.trim().slice(0,80),sellerAllowlist:sellers}});
 // Turning the acknowledgement off switches automatic checkout off everywhere.
 if(!ack)await store.set({products:products.map(p=>({...p,autoBuy:false}))});
 m.textContent=ack?'Saved. Now switch automatic checkout on for each Amazon.ca product you want.':'Saved. Automatic checkout is off for every product.';render()};
$('clearLog').onclick=async()=>{await store.set({log:[]});render()};
chrome.storage.onChanged.addListener(render);
render();
})();
