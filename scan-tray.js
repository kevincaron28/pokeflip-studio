/* Cardstead scan tray: undo and review while scanning (inspired by CardCastle's one-tap Undo, ManaBox's
 * scanned-cards list and TCGplayer's remembered batch settings).
 * - "Undo last photo": one tap removes the most recent capture; it is only enabled when there is one.
 * - Recent photos strip: the last 8 captures with a × to remove any one (pending, current or already done).
 * - "Saved this scan session": every card saved since the page opened, to check in one place:
 *   Edit opens the usual editor, × removes a card saved by mistake (never one with a recorded sale).
 * - Card language, condition and finish are remembered for the next scan.
 * Works with the scanner's own queue (app.js: queue, index, showPhoto, db, save): no data format changes. */
(function(root){'use strict';
const KEY='cardstead-scan-defaults-v1';
const MAX_STRIP=8;
/** Remove queue[i] and return the new current index (the scanner's "index"). Pure. */
function removeAt(q,i,cur){
 if(i<0||i>=q.length)return {queue:q,index:cur,current:false};
 const next=q.slice(0,i).concat(q.slice(i+1));
 return {queue:next,index:i<cur?cur-1:cur,current:i===cur};
}
/** Ids added between two snapshots of the inventory (cards saved by one scan). Pure. */
function added(before,after){const was=new Set(before);return after.filter(id=>!was.has(id))}
const S={
 en:{undo:'Undo last photo',undone:'Last photo removed.',recent:'Recent photos',remove:'Remove photo',saved:n=>`Saved this scan session (${n})`,edit:'Edit',del:'Remove',
  removed:'Card removed from inventory.',hasSale:'This card has a recorded sale: undo the sale first.',current:'now',done:'done',next:'next',empty:'Photos you take appear here; tap × to remove one.',undoCard:'Undo last saved card'},
 fr:{undo:'Annuler la dernière photo',undone:'Dernière photo retirée.',recent:'Photos récentes',remove:'Retirer la photo',saved:n=>`Enregistrées pendant ce scan (${n})`,edit:'Modifier',del:'Retirer',
  removed:'Carte retirée de l’inventaire.',hasSale:'Cette carte a une vente notée : annule la vente d’abord.',current:'actuelle',done:'faite',next:'à venir',empty:'Tes photos apparaissent ici; touche × pour en retirer une.',undoCard:'Annuler la dernière carte enregistrée'}
};
const core={removeAt,added,S,KEY};
root.CardsteadScanTray=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;
// app.js keeps the scanner state in top-level bindings shared by classic scripts.
if(typeof queue==='undefined'||typeof showPhoto!=='function'||typeof db==='undefined')return;
const $=id=>doc.getElementById(id);
const L=()=>S[root.CardsteadI18n?.lang?.()==='fr'?'fr':'en'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const urls=new WeakMap();const thumb=f=>{if(!urls.has(f))urls.set(f,URL.createObjectURL(f));return urls.get(f)};
const session=[]; // {id, file}
let before=null,photoAtSave=null;

function render(){
 const host=$('scanTray');if(!host)return;const t=L();
 const start=Math.max(0,queue.length-MAX_STRIP);
 const strip=queue.slice(start).map((f,k)=>{const i=start+k,state=i<index?'done':i===index?'current':'next';
  return `<li class="tray-item tray-${state}"><img src="${esc(thumb(f))}" alt=""><span class="tray-state">${esc(t[state])}</span><button type="button" class="tray-x" data-tray-remove="${i}" aria-label="${esc(t.remove+' '+(i+1))}">×</button></li>`}).join('');
 const items=session.map(s=>({s,item:db.items.find(x=>x.id===s.id)})).filter(x=>x.item).reverse();
 host.innerHTML=`<div class="tray-bar"><button type="button" class="btn smallbtn" data-tray-undo ${queue.length?'':'disabled'}>↶ ${esc(t.undo)}</button>${items.length?`<button type="button" class="btn smallbtn" data-tray-undo-card>↶ ${esc(t.undoCard)}</button>`:''}</div>
 ${queue.length?`<p class="note tray-title">${esc(t.recent)}</p><ul class="tray-strip">${strip}</ul>`:`<p class="note">${esc(t.empty)}</p>`}
 ${items.length?`<details class="tray-review" open><summary>${esc(t.saved(items.length))}</summary><ul class="tray-list">${items.map(({s,item})=>`<li>${s.file?`<img src="${esc(thumb(s.file))}" alt="">`:'<span class="tray-noimg"></span>'}<span class="tray-name"><strong>${esc(item.name)}</strong><span class="note">${esc(item.idCode||'')} · ${esc(String(item.lang||'').toUpperCase())} · ${esc(item.condition||'')} · ×${item.qty}</span></span><button type="button" class="btn smallbtn" data-tray-edit="${esc(item.id)}">${esc(t.edit)}</button><button type="button" class="tray-x" data-tray-del="${esc(item.id)}" aria-label="${esc(t.del+' '+item.name)}">×</button></li>`).join('')}</ul></details>`:''}`;
}
function removePhoto(i){
 const r=removeAt(queue,i,index);const f=queue[i];
 queue.length=0;queue.push(...r.queue);index=r.index; // keep the same array object the scanner uses
 if(r.current)showPhoto();else if(typeof queueStatus==='function')queueStatus();
 if(f&&urls.has(f)&&!session.some(s=>s.file===f)){URL.revokeObjectURL(urls.get(f));urls.delete(f)}
 render();
}
function removeCard(id){
 const t=L();
 if(db.sales.some(s=>s.itemId===id)){toast(t.hasSale);return}
 db.items=db.items.filter(x=>x.id!==id);const k=session.findIndex(s=>s.id===id);if(k>=0)session.splice(k,1);
 save();toast(t.removed);render();
}
function remember(){
 const v={};for(const id of ['scanLang','scanCondition','scanFinish']){const el=$(id);if(el)v[id]=el.value}
 try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}
}
function restore(){
 let v=null;try{v=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
 if(!v)return;for(const [id,val] of Object.entries(v)){const el=$(id);if(el&&[...el.options].some(o=>o.value===val))el.value=val}
}
function init(){
 const anchor=$('scanProgress')?.parentElement;if(!anchor||$('scanTray'))return;
 const host=doc.createElement('div');host.id='scanTray';host.className='scan-tray';host.setAttribute('aria-live','polite');anchor.after(host);
 // Captures: every photo source goes through #photoInput; app.js adds them to the queue.
 doc.addEventListener('change',e=>{if(e.target?.id==='photoInput')setTimeout(render,0)});
 // Saves: note which cards one card-form submit adds, with the photo that was on screen.
 doc.addEventListener('submit',e=>{if(e.target?.id==='cardForm'){before=db.items.map(x=>x.id);photoAtSave=queue[index]||null}},true);
 doc.addEventListener('submit',e=>{if(e.target?.id==='cardForm'&&before){for(const id of added(before,db.items.map(x=>x.id)))session.push({id,file:photoAtSave});before=null;setTimeout(render,0)}});
 doc.getElementById('skipPhoto')?.addEventListener('click',()=>setTimeout(render,0));
 host.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-tray-undo')){if(queue.length){removePhoto(queue.length-1);toast(L().undone)}}
  else if(b.hasAttribute('data-tray-undo-card')){const last=session[session.length-1];if(last)removeCard(last.id)}
  else if(b.dataset.trayRemove!==undefined)removePhoto(Number(b.dataset.trayRemove));
  else if(b.dataset.trayDel)removeCard(b.dataset.trayDel);
  else if(b.dataset.trayEdit&&typeof editItem==='function')editItem(b.dataset.trayEdit);
 });
 for(const id of ['scanLang','scanCondition','scanFinish'])$(id)?.addEventListener('change',remember);
 restore();
 root.addEventListener('cardstead:lang',render);
 root.addEventListener('pokeflip:saved',()=>setTimeout(render,0));
 render();
}
core.render=render;core.removePhoto=removePhoto;
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
