/* Cardstead "My area & stores": which stores alerts come from.
 * Default for a new user (the app is Québec-first): every Québec local shop, every Canada-wide online shop
 * and every chain. Local shops in other provinces are off until the user picks that province or ticks them.
 * The exact city is never guessed: region and city stay empty until the user sets them.
 * Stored on this device only (localStorage), like the rest of the restock settings.
 */
(function(root){'use strict';
const KEY='cardstead-area-v1';
const PROVINCES=[['QC','Québec'],['ON','Ontario'],['BC','British Columbia'],['AB','Alberta'],['OTHER','Elsewhere in Canada']];
const QC_REGIONS=[['montreal','Montréal'],['west-island','West Island'],['laval-north-shore','Laval / North Shore'],['south-shore','South Shore (Rive-Sud)'],['vaudreuil-soulanges','Vaudreuil-Soulanges / Valleyfield'],['laurentides','Laurentides'],['outaouais','Outaouais (Gatineau)'],['estrie','Estrie (Sherbrooke)'],['centre-du-quebec','Centre-du-Québec / Mauricie'],['quebec-city','Québec City'],['qc-other','Elsewhere in Québec']];
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const DEFAULT={province:'QC',region:'',city:'',on:[],off:[]};

function clean(p){
 const o={...DEFAULT};if(!p||typeof p!=='object')return o;
 if(PROVINCES.some(([id])=>id===p.province))o.province=p.province;
 if(typeof p.region==='string'&&p.region.length<40)o.region=p.region;
 if(typeof p.city==='string')o.city=p.city.trim().slice(0,80);
 for(const k of ['on','off'])if(Array.isArray(p[k]))o[k]=p[k].filter(x=>typeof x==='string'&&x.length<80).slice(0,500);
 return o;
}
function get(){try{return clean(JSON.parse(root.localStorage?.getItem(KEY)||'null'))}catch{return {...DEFAULT}}}
function save(p){const c=clean(p);try{root.localStorage?.setItem(KEY,JSON.stringify(c))}catch{}return c}

/** Every store alerts can come from, from the shop catalogue and the retailer list. */
function catalogue(shops=root.PokeFlipShops,retailers=root.PokeFlipRetailers){
 const out=[],seen=new Set();
 const regionProv=Object.fromEntries((shops?.REGIONS||[]).map(r=>[r.id,r.province]));
 // Shops the retailer list names as Canada-wide Shopify stores (Tistaminis, Doe's, Rain City) are online shops.
 const onlineHosts=new Set((retailers?.RETAILERS||[]).filter(r=>r.auto==='shopify'&&!r.scope).map(r=>r.host));
 for(const s of shops?.SHOPS||[]){
  const national=s.region==='national'||onlineHosts.has(s.host);
  out.push({key:'shop:'+s.host,name:s.name,host:s.host,kind:national?'online':'local',region:s.region,city:s.city,province:national?'CA':regionProv[s.region]||'OTHER',auto:true});seen.add(s.host);
 }
 for(const r of retailers?.RETAILERS||[]){
  if(seen.has(r.host)&&r.auto==='shopify')continue;
  const kind=r.scope||(r.auto==='shopify'?'online':'chain');
  out.push({key:'retailer:'+r.id,name:r.name,host:r.host,kind,region:r.region||(kind==='local'?'qc-other':null),city:r.city||'',province:kind==='local'?'QC':'CA',auto:r.auto==='shopify'});
 }
 return out;
}
function defaultOn(store,prefs){return store.kind!=='local'||store.province===prefs.province}
function isOn(store,prefs=get()){if(prefs.off.includes(store.key))return false;return prefs.on.includes(store.key)||defaultOn(store,prefs)}
function toggle(store,want,prefs=get()){
 const p={...prefs,on:prefs.on.filter(k=>k!==store.key),off:prefs.off.filter(k=>k!==store.key)};
 if(want!==defaultOn(store,p))(want?p.on:p.off).push(store.key);
 return save(p);
}
/** Region ids to poll for independent shops: the province's regions plus Canada-wide online shops. */
function defaultRegions(prefs=get(),shops=root.PokeFlipShops){
 return (shops?.REGIONS||[]).filter(r=>r.province===prefs.province||r.id==='national').map(r=>r.id);
}
/** Is this shop (by host) one the user follows? */
function hostOn(host,prefs=get(),list=catalogue()){const s=list.find(x=>x.host===host);return s?isOn(s,prefs):true}
/** Match a free-text retailer name from an alert ("Walmart", "EB Games Ste-Foy") to a followed store. */
function storeFor(name,list=catalogue()){
 const n=' '+norm(name)+' ';if(n.trim()==='')return null;
 let best=null,len=0;
 for(const s of list){
  // Domain's main label: shop.shoppersdrugmart.ca -> shoppersdrugmart (never "shop"); myshopify hosts use the name only.
  const parts=String(s.host).split('.'),label=parts.at(-2)==='myshopify'?'':parts.at(-2)||'';
  const keys=[norm(s.name).replace(/ canada$/,''),norm(label)];
  for(const k of keys){if(k.length>=3&&k.length>len&&(n.includes(' '+k+' ')||k.length>=6&&n.replace(/ /g,'').includes(k.replace(/ /g,'')))){best=s;len=k.length}}
 }
 return best;
}
const api={KEY,PROVINCES,QC_REGIONS,DEFAULT,clean,get,save,catalogue,defaultOn,isOn,toggle,defaultRegions,hostOn,storeFor,norm};
root.CardsteadStorePrefs=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
