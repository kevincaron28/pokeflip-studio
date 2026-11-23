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
  if(p.store==='amazon'){const w=el('label');const c=document.createElement('input');c.type='checkbox';c.checked=p.amazonOnly!==false;c.onchange=()=>update(p.id,{amazonOnly:c.checked});w.className='row';w.append(c,' Only when sold by Amazon.ca (skips third-party resellers)');edit.append(w)}
  row.append(info,btns,edit);host.append(row);
 }
 $('interval').value=settings.intervalMin||A.DEFAULT_INTERVAL_MIN;$('assist').value=settings.assist||'checkout';$('ntfy').value=settings.ntfyTopic||'';$('sound').checked=settings.sound!==false;
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
 await store.set({settings:{intervalMin:Math.max(A.MIN_INTERVAL_MIN,Math.min(60,Number($('interval').value)||A.DEFAULT_INTERVAL_MIN)),assist:$('assist').value,ntfyTopic:topic,sound:$('sound').checked}});$('saveMsg').textContent='Saved.';render()};
$('clearLog').onclick=async()=>{await store.set({log:[]});render()};
chrome.storage.onChanged.addListener(render);
render();
})();
