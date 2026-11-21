(function(){'use strict';
const $=id=>document.getElementById(id),match=window.PokeFlipSymbolMatcher;
if(!match||!$('matchSymbol'))return;
let file=null,catalog=null,epoch=0;
const status=t=>$('symbolStatus').textContent=t;
function safeUrl(url){return typeof url==='string'&&/^https:\/\/assets\.tcgdex\.net\//.test(url)?url.replace(/\.(png|webp|jpg)$/,'')+'.png':null}
function image(url){return new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Image unavailable or cross-origin access blocked'));im.src=url;});}
function pixels(im){const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);return ctx.getImageData(0,0,c.width,c.height)}
async function sets(){if(catalog)return catalog;const res=await fetch('https://api.tcgdex.net/v2/en/sets');if(!res.ok)throw Error('TCGdex set catalog unavailable');const data=await res.json();if(!Array.isArray(data))throw Error('Unexpected catalog format');catalog=data.filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&safeUrl(s.symbol));return catalog;}
$('symbolPhoto').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;if(!f.type.startsWith('image/'))return status('Choose a JPEG, PNG or WebP image.');if(f.size>12*1024*1024)return status('Image too large (maximum 12 MB).');file=f;const p=$('symbolPreview');if(p.dataset.blob)URL.revokeObjectURL(p.dataset.blob);p.dataset.blob=URL.createObjectURL(f);p.src=p.dataset.blob;p.classList.remove('hidden');$('matchSymbol').disabled=false;$('symbolMatches').replaceChildren();status('Symbol photo ready. Tap Find matching symbols.');});
$('matchSymbol').addEventListener('click',async()=>{
 if(!file)return;const id=++epoch,button=$('matchSymbol');button.disabled=true;$('symbolMatches').replaceChildren();
 try{
  status('Preparing symbol crop…');const uploadUrl=URL.createObjectURL(file);let im;try{im=await image(uploadUrl);}finally{URL.revokeObjectURL(uploadUrl);}let query=match.normalize(pixels(im).data,im.naturalWidth,im.naturalHeight);const all=await sets();
  let filter=$('symbolFilter').value.trim().toLocaleLowerCase(),total=Number($('symbolTotal').value),candidates=all.filter(s=>!filter||s.name.toLocaleLowerCase().includes(filter)||s.id.toLowerCase().includes(filter));
  if(total>0)candidates=candidates.filter(s=>{const v=s.cardCount||{};return Number(v.official)===total||Number(v.total)===total});
  if(!candidates.length)throw Error('No sets match those filters. Clear the name or printed total.');
  // Keep reasonable bandwidth and device CPU usage. Narrow searches on older phones.
  if(candidates.length>180)throw Error('Too many possible sets ('+candidates.length+'). Enter a set name or printed set total to narrow the match below 180.');
  status('Comparing '+candidates.length+' published symbols locally…');let refs=[],failed=0;
  for(let i=0;i<candidates.length;i+=12){const batch=candidates.slice(i,i+12);await Promise.all(batch.map(async s=>{try{const im=await image(safeUrl(s.symbol)),d=pixels(im);refs.push({id:s.id,name:s.name,url:safeUrl(s.symbol),signature:match.normalize(d.data,d.width,d.height)});}catch{failed++}}));if(id!==epoch)return;status('Compared '+Math.min(i+12,candidates.length)+' / '+candidates.length+' references…');}
  if(!refs.length)throw Error('No readable symbol templates loaded. Check network access and image permissions.');
  const ranked=match.rank(query,refs,8);let parent=$('symbolMatches');for(let r of ranked){let el=document.createElement('div');el.className='candidate';const img=document.createElement('img');img.src=r.url;img.alt=r.name+' expansion symbol';img.loading='lazy';const side=document.createElement('div');side.className='grow';const heading=document.createElement('b');heading.textContent=r.name;const detail=document.createElement('div');detail.className='small muted';detail.textContent=r.id+' · visual similarity '+Math.round(r.score*100)+'% (NOT probability)';side.append(heading,detail);const btn=document.createElement('button');btn.className='btn smallbtn';btn.textContent='Use set';btn.type='button';btn.addEventListener('click',()=>{$('setHint').value=r.id;status('Selected '+r.name+' ('+r.id+'). Now search by collector number and verify the card artwork before saving.');$('cardQuery').focus();});el.append(img,side,btn);parent.append(el);}
  status('Found '+ranked.length+' suggestions from '+refs.length+' symbols ('+failed+' unavailable). Confirm visually; a low or close score means unresolved.');
 }catch(err){status('Match unavailable: '+err.message);}finally{button.disabled=false;}
});
})();
