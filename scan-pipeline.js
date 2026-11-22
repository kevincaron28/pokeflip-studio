/* PokéFlip scan pipeline (browser): photo -> card detection + perspective crop -> OCR of the name
 * header and the collector-number strip -> optional artwork-similarity re-ranking of catalogue hits.
 * Everything is a suggestion. A failed or doubtful detection falls back to OCR of the untouched photo,
 * and nothing here ever confirms a printing, price or condition. Photos never leave the device. */
(function(root){'use strict';
if(!root?.document)return;
const D=()=>root.PokeFlipCardDetect,H=()=>root.PokeFlipScanHeuristics,A=()=>root.PokeFlipArtRank;
const MAX_SIDE=1600,MIN_CONFIDENCE=.5;
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c};
async function toCanvas(source){
 let bmp;try{bmp=await createImageBitmap(source)}catch{bmp=await new Promise((res,rej)=>{const i=new Image(),u=URL.createObjectURL(source);i.onload=()=>{URL.revokeObjectURL(u);res(i)};i.onerror=()=>{URL.revokeObjectURL(u);rej(Error('Could not decode photo'))};i.src=u})}
 const w=bmp.width||bmp.naturalWidth,h=bmp.height||bmp.naturalHeight,s=Math.min(1,MAX_SIDE/Math.max(w,h)),c=mk(w*s,h*s);c.getContext('2d',{willReadFrequently:true}).drawImage(bmp,0,0,c.width,c.height);bmp.close?.();return c;
}
function part(c,r){const x0=Math.round(r[0]*c.width),y0=Math.round(r[1]*c.height),w=Math.round((r[2]-r[0])*c.width),h=Math.round((r[3]-r[1])*c.height),o=mk(w,h);o.getContext('2d').drawImage(c,x0,y0,w,h,0,0,w,h);return o}
function scale(c,f){const o=mk(c.width*f,c.height*f),g=o.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(c,0,0,o.width,o.height);return o}
function numOf(t){const m=[...String(t||'').toUpperCase().replace(/[|]/g,'I').matchAll(/\b(\d{1,4}[A-Z]?)\s*\/\s*(\d{1,4})\b/g)];return m.length?{number:m.at(-1)[1],total:m.at(-1)[2]}:null}
function strips(c){ // same geometry as the manual "Read set details" button: bottom 30%, left and right 55%
 const sy=Math.floor(c.height*.70),sh=c.height-sy,sw=Math.ceil(c.width*.55);
 return ['left','right'].map(side=>{const sx=side==='left'?0:Math.floor(c.width*.45),w=Math.min(2400,Math.max(900,sw*2)),o=mk(w,w*sh/sw),g=o.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(c,sx,sy,sw,sh,0,0,o.width,o.height);return o})}
async function ocr(worker,c){return (await worker.recognize(c)).data.text||''}
async function numberFrom(worker,c){for(const s of strips(c)){const n=numOf(await ocr(worker,s));if(n)return n}return null}
/** read(file, tesseractWorker) -> {name, number, total, detected, usedFallback, raw, card} */
async function read(file,worker){
 const full=await toCanvas(file);let card=null,detection=null;
 try{if(D()){const g=full.getContext('2d',{willReadFrequently:true}).getImageData(0,0,full.width,full.height),r=D().rectify(g.data,g.width,g.height);detection=r.ok?{confidence:r.confidence,ratio:r.ratio}:{reason:r.reason};
  if(r.ok&&r.confidence>=MIN_CONFIDENCE){card=mk(r.image.width,r.image.height);card.getContext('2d').putImageData(new ImageData(r.image.data,r.image.width,r.image.height),0,0)}}}catch{card=null}
 let name='',num=null,raw='',usedFallback=false;
 if(card){
  const R=D().ROIS,nameText=await ocr(worker,scale(part(card,R.name),2.5));
  name=H().headerName(nameText);raw=nameText;
  num=numOf(await ocr(worker,scale(part(card,R.number),3)))||await numberFrom(worker,card);
 }
 if(!card||!name||!num){ // no card found, or the crop read nothing: use the untouched photo for whatever is still missing
  usedFallback=true;const text=await ocr(worker,full);raw=raw||text;
  if(!name)name=H().candidates(text)[0]||'';if(!num)num=numOf(text)||await numberFrom(worker,full);
 }
 return {name,number:num?.number||null,total:num?.total||null,detected:!!card,usedFallback,detection,raw,card};
}
function loadImage(url){return new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';const t=setTimeout(()=>rej(Error('timeout')),8000);i.onload=()=>{clearTimeout(t);res(i)};i.onerror=()=>{clearTimeout(t);rej(Error('image'))};i.src=url})}
function sigOfImage(img){const c=mk(img.naturalWidth,img.naturalHeight),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height);return A().signature(d.data,d.width,d.height)}
/** rerank(cardCanvas, matches, imageUrl) -> matches ordered by artwork similarity, each with artScore 0..1 (aid, not proof). */
async function rerank(card,matches,imageUrl){
 if(!card||!A()||!Array.isArray(matches)||matches.length<2)return matches;
 const g=card.getContext('2d',{willReadFrequently:true}).getImageData(0,0,card.width,card.height),photo=A().signature(g.data,g.width,g.height),top=matches.slice(0,30);
 const scored=[];for(let i=0;i<top.length;i+=6)await Promise.all(top.slice(i,i+6).map(async(m,k)=>{try{const u=imageUrl(m);if(!u)return;scored.push({m,i:i+k,sig:sigOfImage(await loadImage(u))})}catch{}}));
 if(scored.length<2)return matches;
 const ranked=A().rank(photo,scored.map(s=>({id:s.i,sig:s.sig}))),order=new Map(ranked.map((r,n)=>[r.id,{n,score:r.score}]));
 const withScore=top.map((m,i)=>order.has(i)?{...m,artScore:order.get(i).score,_o:order.get(i).n}:{...m,_o:1e6+i}).sort((a,b)=>a._o-b._o).map(({_o,...m})=>m);
 return [...withScore,...matches.slice(30)];
}
root.PokeFlipScanPipeline={read,rerank,numOf};
})(typeof window!=='undefined'?window:undefined);
