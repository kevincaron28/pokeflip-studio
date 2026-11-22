const test=require('node:test');const assert=require('node:assert/strict');
const D=require('../card-detect.js'),A=require('../art-rank.js');
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
// Draw an upright "card" texture function: yellow marker top-left, blue marker bottom-right, mid-grey elsewhere.
function cardColour(u,v){if(u<.15&&v<.1)return[250,230,20];if(u>.85&&v>.9)return[20,40,220];if(u<.05||u>.95||v<.03||v>.97)return[30,30,30];return[200,90+Math.round(u*80),70+Math.round(v*100)]}
function scene(W,H,{cx,cy,cw,ch,angle,bg=[70,55,40],tilt=0,seed=1,glare=false}){
 const r=rng(seed),px=new Uint8ClampedArray(W*H*4),cos=Math.cos(angle),sin=Math.sin(angle);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const lx=(x-cx)*cos+(y-cy)*sin,ly=-(x-cx)*sin+(y-cy)*cos,u=lx/cw+.5,v=ly/ch+.5,o=(y*W+x)*4;
  let c=(u>=0&&u<=1&&v>=0&&v<=1)?cardColour(u,v):bg.map(b=>b*(.9+.2*x/W+tilt*y/H));
  px[o]=c[0]+(r()-.5)*8;px[o+1]=c[1]+(r()-.5)*8;px[o+2]=c[2]+(r()-.5)*8;px[o+3]=255}
 return px;
}
test('detects a rotated card on a lit table and rectifies it upright',()=>{
 const W=800,H=600,px=scene(W,H,{cx:400,cy:300,cw:260,ch:363,angle:.25});
 const r=D.rectify(px,W,H);assert.ok(r.ok,r.reason);assert.ok(r.confidence>.6);
 assert.equal(r.image.width,630);assert.equal(r.image.height,880);
 const at=(u,v)=>{const x=Math.round(u*629),y=Math.round(v*879),i=(y*630+x)*4;return[...r.image.data.slice(i,i+3)]};
 const yel=at(.08,.05),blu=at(.92,.95);
 assert.ok(yel[0]>200&&yel[1]>180&&yel[2]<90,'yellow marker top-left '+yel);
 assert.ok(blu[2]>150&&blu[0]<80,'blue marker bottom-right '+blu);
});
test('landscape-lying card is turned portrait',()=>{
 const W=800,H=600,px=scene(W,H,{cx:400,cy:300,cw:260,ch:363,angle:Math.PI/2+.1});
 const r=D.detect(px,W,H);assert.ok(r.ok,r.reason);assert.ok(Math.abs(r.ratio-D.ASPECT)<.08);
});
test('uneven lighting across the table does not break detection',()=>{
 const W=800,H=600,px=scene(W,H,{cx:380,cy:310,cw:240,ch:335,angle:-.2,bg:[110,100,90],tilt:.5});
 assert.ok(D.detect(px,W,H).ok);
});
test('empty table, or a frame-filling object, is rejected so callers fall back to the original photo',()=>{
 const W=400,H=300,flat=new Uint8ClampedArray(W*H*4).fill(120);for(let i=3;i<flat.length;i+=4)flat[i]=255;
 assert.equal(D.detect(flat,W,H).ok,false);
 const wide=scene(W,H,{cx:200,cy:150,cw:900,ch:900,angle:0});assert.equal(D.detect(wide,W,H).ok,false);
});
test('a square block (not card-shaped) is rejected',()=>{
 const W=600,H=600,px=scene(W,H,{cx:300,cy:300,cw:300,ch:300,angle:0});const r=D.detect(px,W,H);assert.equal(r.ok,false);
});
test('ROIs are inside the card and ordered',()=>{
 for(const [k,[x0,y0,x1,y1]] of Object.entries(D.ROIS)){assert.ok(x0>=0&&y0>=0&&x1<=1&&y1<=1&&x0<x1&&y0<y1,k)}
 assert.ok(D.ROIS.name[1]<D.ROIS.art[1]&&D.ROIS.art[3]<D.ROIS.number[1]);
});
// ---- artwork similarity
function art(seed,w=120,h=168){const r=rng(seed),px=new Uint8ClampedArray(w*h*4),c1=[r()*200,r()*200,r()*200],c2=[r()*255,r()*255,r()*255],blobs=[];
 for(let i=0;i<10;i++)blobs.push({x:r()*w,y:r()*h*.5+h*.1,rad:20+r()*20,c:[r()*255,r()*255,r()*255]});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const t=y/h,o=(y*w+x)*4;let c=[0,1,2].map(k=>c1[k]*(1-t)+c2[k]*t);for(const b of blobs)if(Math.hypot(x-b.x,y-b.y)<b.rad)c=b.c;px[o]=c[0];px[o+1]=c[1];px[o+2]=c[2];px[o+3]=255}
 return {px,w,h}}
function photo(src,seed){const r=rng(seed),{px,w,h}=src,o=new Uint8ClampedArray(px.length),dx=Math.round((r()-.5)*.03*w),dy=Math.round((r()-.5)*.03*h),gain=[.8+r()*.2,.85+r()*.15,.9+r()*.2],gamma=.85+r()*.3;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(w-1,Math.max(0,x+dx)),sy=Math.min(h-1,Math.max(0,y+dy)),i=(sy*w+sx)*4,j=(y*w+x)*4;for(let k=0;k<3;k++)o[j+k]=255*Math.pow(px[i+k]/255,gamma)*gain[k]+(r()-.5)*14;o[j+3]=255}
 return {px:o,w,h}}
test('artwork similarity picks the right card among 20 unrelated artworks under lighting/shift/noise changes',()=>{
 let hit=0,trials=20;
 for(let t=0;t<trials;t++){
  const cards=Array.from({length:20},(_,i)=>art(1000*t+i+1)),truth=t%20,ph=photo(cards[truth],7000+t);
  const ranked=A.rank(A.signature(ph.px,ph.w,ph.h),cards.map((c,i)=>({id:i,sig:A.signature(c.px,c.w,c.h)})));
  if(ranked[0].id===truth)hit++;
 }
 assert.ok(hit/trials>=.9,'top-1 '+hit+'/'+trials);
});
test('similarity is 1 for identical art and ties keep catalogue order',()=>{
 const c=art(5),s=A.signature(c.px,c.w,c.h);assert.ok(Math.abs(A.similarity(s,s)-1)<1e-9);
 const r=A.rank(s,[{id:'a',sig:s},{id:'b',sig:s}]);assert.deepEqual(r.map(x=>x.id),['a','b']);
});
test('headerName strips HP/stage noise and rejects junk',()=>{
 require('../scan-heuristics.js');const h=globalThis.PokeFlipScanHeuristics;
 assert.equal(h.headerName('Carapuce F'),'Carapuce');assert.equal(h.headerName('Basic Pikachu HP 60'),'Pikachu');
 assert.equal(h.headerName('Stade 1 Roucarnage PV 120'),'Roucarnage');assert.equal(h.headerName('| |'),'');
});
