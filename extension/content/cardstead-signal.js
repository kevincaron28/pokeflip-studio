/* Cardstead Drop Assist on the Cardstead website: when Cardstead saves a restock alert or stock check,
 * pass the Amazon.ca / Pokémon Center links to the extension so it checks those products right away.
 * Reads only Cardstead's own restock data in this browser; sends nothing anywhere else. */
(function(){'use strict';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
let last='';
function scan(){
 const hub=read('pokeflip-alert-hub-v1')||[],restock=read('pokeflip-restock-v1')||{};
 const since=Date.now()-15*60000;
 const entries=[...hub.filter(a=>a&&a.status==='in'&&Date.parse(a.observedAt)>since),...(restock.observations||[]).filter(o=>o&&o.status==='in'&&Date.parse(o.checkedAt)>since)]
  .map(e=>({url:e.url})).filter(e=>/amazon\.ca|pokemoncenter\.com/i.test(e.url||''));
 const key=JSON.stringify(entries);if(!entries.length||key===last)return;last=key;
 try{chrome.runtime.sendMessage({type:'cardstead-signal',entries})}catch{}
}
window.addEventListener('pokeflip:saved',scan);
scan();
})();
