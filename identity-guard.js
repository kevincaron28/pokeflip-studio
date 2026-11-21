(function(root){'use strict';
 // Never treat an artwork match as proof of exact printing. Printed set total and collector
 // number are independently observable; a catalogue id alone is not.
 function normalizeNumber(x){return String(x??'').trim().replace(/^0+(?=\d)/,'').toUpperCase();}
 function setCode(id){const t=String(id||'');return t.includes('-')?t.slice(0,t.lastIndexOf('-')).toLowerCase():'';}
 function assess(input){
  const record=input.record||null, observed=input.observed||{}, entered=String(input.enteredId||'').trim(), expected=record?.id||'';
  const reasons=[], verified=[];
  if(!record?.id){reasons.push('No catalog match selected');return {status:'review',reasons,verified};}
  if(entered.toLowerCase()!==String(expected).toLowerCase())reasons.push('Saved card ID differs from selected catalog record');
  if(input.languageAtSelection&&input.language!==input.languageAtSelection)reasons.push('Card language changed since catalog selection');
  if(observed.localId){if(normalizeNumber(observed.localId)!==normalizeNumber(record.localId||record.id.split('-').at(-1)))reasons.push('Photographed collector number disagrees with selected card');else verified.push('Collector number matches photo');}
  const total=Number(observed.total);
  if(Number.isInteger(total)&&total>0){const totals=[record.set?.cardCount?.official,record.set?.cardCount?.total].map(Number).filter(n=>Number.isInteger(n)&&n>0);if(totals.length&& !totals.includes(total))reasons.push('Printed set total differs from catalog');else if(totals.includes(total))verified.push('Printed set total matches catalog');}
  if(observed.setId&&setCode(record.id)!==String(observed.setId).trim().toLowerCase())reasons.push('Selected set differs from confirmed set symbol');
  else if(observed.setId)verified.push('Set symbol selection matches catalog');
  if(input.finish&&record.variants){const map={'Normal':'normal','Holo':'holo','Reverse Holo':'reverse'},key=map[input.finish];if(key&&record.variants[key]===false)reasons.push('Finish unavailable for selected catalog record');}
  const independent=verified.length;
  return {status:reasons.length?'review':independent>=2?'cross-checked':'unverified',reasons,verified};
 }
 const api={assess,normalizeNumber,setCode};root.PokeFlipIdentity=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);