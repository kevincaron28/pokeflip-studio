/* TCGdex lookup with bilingual recovery and exact-set identity protection.
 * A foreign-language result is a suggestion only; physical language must be checked.
 */
(function(root){'use strict';
function normal(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ')}
function parseId(s){const x=String(s||'').trim().match(/^([a-z0-9]{2,24})-([a-z0-9]{1,12})$/i);return x?{set:x[1].toLowerCase(),number:x[2].toLowerCase()}:null}
function numeric(s){return /^\d{1,4}[a-z]?$/i.test(String(s||'').trim())}
function sameNumber(a,b){return String(a||'').toLowerCase().replace(/^0+(?=\d)/,'')===String(b||'').toLowerCase().replace(/^0+(?=\d)/,'')}
/** A card of the phone game (Pokémon TCG Pocket: sets A1, B1a, P-A…), not one you can hold or sell. Pure. */
function pocket(c){return /^(?:[AB]\d{1,2}[a-z]?|P-[AB])(?:-|$)/.test(String(c?.id||''))||/\/tcgp\//.test(String(c?.image||c?.logo||''))}
/** The set a card belongs to: its id without the card number. Pure. */
function setOf(c){const id=String(c?.id||''),n=String(c?.localId||'');return n&&id.endsWith('-'+n)?id.slice(0,-n.length-1):id.replace(/-[^-]*$/,'')}
const names={};
/** Set id → set name in that language, asked once per visit; {} when the database cannot be reached. */
function setNames(language,request=fetch){
 const lang=language==='fr'?'fr':'en';
 return names[lang]||(names[lang]=(async()=>{const res=await request('https://api.tcgdex.net/v2/'+lang+'/sets');if(!res.ok)throw Error('sets '+res.status);
  return Object.fromEntries((await res.json()).map(s=>[s.id,s.name]))})().catch(()=>{delete names[lang];return {}}));
}
function label(items,lang,selected){return (items||[]).filter(c=>c&&c.id&&!pocket(c)).map(c=>lang===selected?c:{...c,lookupLanguage:lang})}
function rank(cards,q){const n=normal(q);return cards.sort((a,b)=>{const aExact=normal(a.name)===n?1:0,bExact=normal(b.name)===n?1:0;return bExact-aExact||String(a.id).localeCompare(String(b.id))})}
async function lookup(query,language,setHint,request=fetch){
 let q=String(query||'').trim(),set=String(setHint||'').trim().toLowerCase(),lang=language==='fr'?'fr':'en';if(!q)return [];
 if(set&&!/^[a-z0-9]{2,24}$/.test(set))throw Error('Invalid set ID');
 const full=parseId(q);if(full&&set&&full.set!==set)throw Error('Card ID conflicts with selected expansion');
 async function get(path,inLang=lang){let res=await request('https://api.tcgdex.net/v2/'+inLang+path);if(res.status===404)return null;if(!res.ok)throw Error('TCGdex request failed ('+res.status+')');return res.json()}
 if(full||set&&numeric(q)){
  const path=full?'/cards/'+encodeURIComponent(q):'/sets/'+encodeURIComponent(set)+'/'+encodeURIComponent(q);
  let card=await get(path);let resultLang=lang;
  if(!card||!card.id){card=await get(path,lang==='fr'?'en':'fr');resultLang=lang==='fr'?'en':'fr'}
  if(!card||!card.id)return [];
  if(set&&!card.id.toLowerCase().startsWith(set+'-'))return [];
  if(set&&numeric(q)&&!sameNumber(card.localId,q))return [];
  return label([card],resultLang,lang);
 }
 if(set){
  let details=await get('/sets/'+encodeURIComponent(set));let resultLang=lang;
  if(!details){details=await get('/sets/'+encodeURIComponent(set),lang==='fr'?'en':'fr');resultLang=lang==='fr'?'en':'fr'}
  if(!details)return[];
  const cards=Array.isArray(details.cards)?details.cards:[];
  let found=cards.filter(c=>normal(c.name).includes(normal(q))&&String(c.id||'').toLowerCase().startsWith(set+'-'));
  if(!found.length){
   const alt=lang==='fr'?'en':'fr',other=await get('/sets/'+encodeURIComponent(set),alt);
   found=(Array.isArray(other?.cards)?other.cards:[]).filter(c=>normal(c.name).includes(normal(q))&&String(c.id||'').toLowerCase().startsWith(set+'-'));
   if(found.length)resultLang=alt;
  }
  return rank(label(found,resultLang,lang),q).slice(0,60);
 }
 const search=async inLang=>{
  const params=new URLSearchParams();
  if(numeric(q))params.set('localId',q);else params.set('name',q);
  params.set('pagination:itemsPerPage','100');
  let cards=[];
  for(let page=1;page<=2;page++){
   params.set('pagination:page',String(page));
   const list=await get('/cards?'+params,inLang);
   if(!Array.isArray(list))break;
   cards.push(...list);
   if(list.length<100)break;
  }
  return rank(label(cards,inLang,lang),q).slice(0,60);
 };
 let results=await search(lang);
 if(results.length)return results;
 // Seedot vs Grainipiot: try the opposite catalog only if the selected-language
 // catalog cannot find a name. Never silently change the physical card's language.
 return search(lang==='fr'?'en':'fr');
}
root.PokeFlipCardLookup={lookup,pocket,setOf,setNames,normal,parseId,sameNumber,rank};
})(typeof window!=='undefined'?window:globalThis);
