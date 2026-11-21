/* Exact-set Pokémon card lookup; prevents capped global name searches from hiding a set printing. */
(function(root){'use strict';
function normal(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ')}
function parseId(s){const x=String(s||'').trim().match(/^([a-z0-9]{2,24})-([a-z0-9]{1,12})$/i);return x?{set:x[1].toLowerCase(),number:x[2].toLowerCase()}:null}
function numeric(s){return /^\d{1,4}[a-z]?$/i.test(String(s||'').trim())}
function sameNumber(a,b){return String(a||'').toLowerCase().replace(/^0+(?=\d)/,'')===String(b||'').toLowerCase().replace(/^0+(?=\d)/,'')}
async function lookup(query,language,setHint,request=fetch){let q=String(query||'').trim(),set=String(setHint||'').trim().toLowerCase(),lang=language==='fr'?'fr':'en';if(!q)return [];
 if(set&&!/^[a-z0-9]{2,24}$/.test(set))throw Error('Invalid set ID');
 const full=parseId(q);if(full&&set&&full.set!==set)throw Error('Card ID conflicts with selected expansion');
 async function get(path){let res=await request('https://api.tcgdex.net/v2/'+lang+path);if(res.status===404)return null;if(!res.ok)throw Error('TCGdex request failed ('+res.status+')');return res.json()}
 if(full||set&&numeric(q)){
  let card=await get(full?'/cards/'+encodeURIComponent(q):'/sets/'+encodeURIComponent(set)+'/'+encodeURIComponent(q));
  if(!card||!card.id)return [];if(set&&!card.id.toLowerCase().startsWith(set+'-'))return [];
  if(set&&numeric(q)&&!sameNumber(card.localId,q))return [];
  return [card];
 }
 if(set){let details=await get('/sets/'+encodeURIComponent(set));if(!details)return[];
  let cards=Array.isArray(details.cards)?details.cards:[];
  let found=cards.filter(c=>normal(c.name).includes(normal(q))&&String(c.id||'').toLowerCase().startsWith(set+'-'));
  return found.slice(0,40);
 }
 const params=new URLSearchParams();if(numeric(q))params.set('localId',q);else params.set('name',q);
 params.set('pagination:page','1');params.set('pagination:itemsPerPage','60');
 let list=await get('/cards?'+params);return Array.isArray(list)?list.slice(0,40):[];
}
root.PokeFlipCardLookup={lookup,normal,parseId,sameNumber};
})(typeof window!=='undefined'?window:globalThis);
