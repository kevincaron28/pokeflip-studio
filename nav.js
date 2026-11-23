/* Cardstead navigation: five tabs (Home, Prices, Watch, Collection, Settings) with a row of chips for the pages
 * inside each tab. Every existing page keeps its id, data and code: this only regroups them.
 * - window.go (app.js) is wrapped so tab highlight, chips and page loaders follow every navigation.
 * - Hidden .tab-legacy buttons keep the old per-page loaders (Pack value, eBay deals, Sealed) working.
 * - Restock power tools fold into one "Advanced" section; My area & stores moves to Settings. */
(function(root){'use strict';
const GROUPS=[
 {id:'home',tab:'home',pages:['home'],chips:[]},
 {id:'prices',tab:'prices',pages:['prices','product','packs'],chips:[['prices','chip.find'],['packs','chip.packs']]},
 {id:'watch',tab:'restock',pages:['restock','deals'],chips:[['restock','chip.watches'],['deals','chip.ebay']]},
 {id:'collection',tab:'inventory',pages:['scan','inventory','lots','sales','dashboard'],chips:[['scan','chip.scan'],['inventory','chip.cards'],['lots','chip.lots'],['sales','chip.sales'],['dashboard','chip.business']]},
 {id:'settings',tab:'settings',pages:['settings','deal','ebay','sealed'],chips:[['settings','chip.settings'],['|','chip.advanced'],['deal','chip.deal'],['ebay','chip.ebaySold'],['sealed','chip.sealed']]},
];
const groupOf=page=>GROUPS.find(g=>g.pages.includes(page))||GROUPS[0];
// Restock panels that are power tools: folded into one Advanced section (matched by their heading).
const ADVANCED=[/^Canadian restock sources/i,/^Follow a region/i,/^Check Canadian retailers now/i,/^Record a stock check/i,/^Recent stock observations/i];
const core={GROUPS,groupOf,ADVANCED};
root.CardsteadNav=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;
const $=id=>doc.getElementById(id);
const I=()=>root.CardsteadI18n;
let current='home';

function chips(page){
 const host=$('subnav');if(!host)return;const g=groupOf(page),t=k=>I()?I().t(k):k;
 host.hidden=!g.chips.length;
 host.innerHTML=g.chips.map(([p,k])=>p==='|'?`<span class="chip-label">${t(k)}</span>`:`<button type="button" class="chip${p===page||(page==='product'&&p==='prices')?' on':''}" data-page="${p}"${p===page?' aria-current="page"':''}>${t(k)}</button>`).join('');
}
function highlight(page){
 const g=groupOf(page);
 doc.querySelectorAll('.tabs .tab').forEach(b=>{const on=b.dataset.tab===g.tab;b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false')});
 doc.body.dataset.group=g.id;
}
function after(page){
 current=page;
 const legacy=doc.querySelector(`.tab-legacy[data-tab="${page}"]`);if(legacy)legacy.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 highlight(page);chips(page);
 root.dispatchEvent(new CustomEvent('cardstead:show',{detail:page}));
}
function show(page){root.go(page)}
function foldRestock(){
 const sec=$('restock');if(!sec||$('restockAdvanced'))return;
 const det=doc.createElement('details');det.id='restockAdvanced';det.className='panel advanced';
 const sum=doc.createElement('summary');sum.dataset.i18n='w.advanced';sum.textContent='Advanced restock tools';det.append(sum);
 for(const panel of [...sec.querySelectorAll(':scope > .panel')]){const h=panel.querySelector('h2');if(h&&ADVANCED.some(re=>re.test(h.textContent.trim())))det.append(panel)}
 sec.append(det);
 // "Record check" on a watch opens the folded form first.
 sec.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/Record check/.test(b.textContent))det.open=true},true);
 const area=$('areaPanel'),settings=$('settings');if(area&&settings)settings.insertBefore(area,settings.querySelector('.panel'));
}
function init(){
 if(typeof root.go!=='function')return;
 const orig=root.go;
 root.go=function(page){orig(page);after(page)};
 doc.addEventListener('click',e=>{const c=e.target.closest('#subnav [data-page],[data-page-link]');if(c){e.preventDefault();show(c.dataset.page||c.dataset.pageLink)}});
 foldRestock();
 const sel=$('uiLanguage');if(sel&&I()){sel.value=I().lang();sel.onchange=()=>I().set(sel.value)}
 root.addEventListener('cardstead:lang',()=>{chips(current);I()?.apply()});
 I()?.apply();
 show('home');
}
core.show=show;core.current=()=>current;
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
