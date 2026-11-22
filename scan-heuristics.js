/* OCR name/noise parsing, prioritizing the large card header over move text.
 * Suggested recognition is NOT proof of exact printing.
 */
(function(root){'use strict';
const stop=/^(?:basic|stage\s*[12]?|stage|pokemon|pokémon|trainer|energy|hp\s*\d+|pv\s*\d+|ability|talent|weakness|resistance|retreat|faiblesse|résistance|retraite|illus(?:trator)?|item|supporter|evolution|évolution|attack|damage|search|shuffle|draw|bench|active|flip|coin|opponent|once during|you may|the defending|attach|retreat cost|artist|©|\d+|[a-z]?\d+\/?\d+)$/i;
function candidates(raw){
 const lines=String(raw||'').split(/\r?\n/).map(x=>x.replace(/[©®™•*\[\]{}|]+/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 let out=[];
 for(let i=0;i<Math.min(lines.length,22);i++){
  let text=lines[i].replace(/^(?:basic|stage\s*[12]?|pokémon|pokemon|de base)\s*[:—-]?\s*/i,'').replace(/\s+(?:HP|PV)\s*\d+.*$/i,'').trim();
  if(text.length<3||text.length>28||!/^\p{L}[\p{L}\p{M}'’ .\-]*$/u.test(text)||stop.test(text)||/\b(?:damage|effect|energy|cards?|discard|attack|weakness|retreat|shuffle|choose|opponent|attacks|your|dans|de votre|carte|piochez|défaussez|votre|adverse)\b/i.test(text))continue;
  if(text.split(/\s+/).length>4)continue;
  let score=100-i*8;
  if(i<5)score+=35;
  if(/^(?:basic|stage|pok[eé]mon)/i.test(lines[i]))score+=25;
  if(/[.!?]$/.test(text))score-=20;
  out.push({text,score});
 }
 return out.sort((a,b)=>b.score-a.score).map(x=>x.text);
}
function number(raw){
 const arr=[...String(raw||'').matchAll(/\b(\d{1,4}[A-Z]?)\s*\/\s*(\d{1,4})\b/gi)];
 return arr.length?{number:arr.at(-1)[1],total:arr.at(-1)[2]}:null;
}
/** Name from an OCR of ONLY the (rectified) header strip: first plausible line, HP/stage noise and
 * trailing 1-2 character debris removed. Returns '' when nothing letter-like remains. */
function headerName(raw){
 for(const line of String(raw||'').split(/\r?\n/)){
  let t=line.replace(/[©®™•*\[\]{}|_=~<>]+/g,' ').replace(/\s+/g,' ').trim();
  t=t.replace(/^(?:basic|stage\s*[12]?|stade\s*[12]?|pok[eé]mon|de base)\s*[:—-]?\s+/i,'').replace(/\s+(?:HP|PV)\b.*$/i,'').replace(/\s+\d+\s*$/,'');
  const words=t.split(' ').filter(Boolean);while(words.length>1&&words.at(-1).length<=2&&!/^(?:ex|gx|v)$/i.test(words.at(-1)))words.pop();
  t=words.join(' ');if(/^\p{L}[\p{L}\p{M}'’ .\-]{2,27}$/u.test(t))return t;
 }
 return '';
}
root.PokeFlipScanHeuristics={candidates,number,headerName};
})(typeof window!=='undefined'?window:globalThis);
