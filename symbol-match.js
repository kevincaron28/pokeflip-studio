/* PokéFlip symbol reference matcher. No ML inference, no uploaded photos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PokeFlipSymbolMatcher=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const SIZE=36;
function normalize(pixels,width,height){
 if(!pixels||width<4||height<4)throw Error('Symbol crop is too small');
 const n=width*height,lum=new Float32Array(n),alpha=new Float32Array(n);let opaque=0;
 for(let i=0;i<n;i++){const a=pixels[i*4+3]/255;alpha[i]=a;lum[i]=.2126*pixels[i*4]+.7152*pixels[i*4+1]+.0722*pixels[i*4+2];if(a>.2)opaque++}
 const transparent=opaque<n*.92;let mask=new Uint8Array(n);
 if(transparent){for(let i=0;i<n;i++)mask[i]=alpha[i]>.22 && lum[i]<247?1:0;}
 else{
  // The outer rim estimates the physical card background; ink may be light or dark.
  let border=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x<width*.12||x>width*.88||y<height*.12||y>height*.88)border.push(lum[y*width+x]);
  border.sort((a,b)=>a-b);const bg=border[Math.floor(border.length/2)]||255;
  for(let i=0;i<n;i++)mask[i]=Math.abs(lum[i]-bg)>Math.max(28,bg*.16)?1:0;
 }
 let x0=width,y0=height,x1=-1,y1=-1,count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);count++}
 if(count<n*.002||count>n*.82||x1-x0<2||y1-y0<2)throw Error('No isolated symbol found. Crop more tightly around the symbol.');
 const side=Math.max(x1-x0+1,y1-y0+1),pad=side*.12,scale=(SIZE-1)/(side+2*pad),cx=(x0+x1)/2,cy=(y0+y1)/2,out=new Uint8Array(SIZE*SIZE);
 for(let oy=0;oy<SIZE;oy++)for(let ox=0;ox<SIZE;ox++){
  let x=Math.round(cx+(ox-(SIZE-1)/2)/scale),y=Math.round(cy+(oy-(SIZE-1)/2)/scale);
  out[oy*SIZE+ox]=x>=0&&y>=0&&x<width&&y<height?mask[y*width+x]:0;
 }
 return out;
}
function compare(a,b){if(a.length!==SIZE*SIZE||b.length!==SIZE*SIZE)throw Error('Invalid symbol signature');let best=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
 let intersection=0,union=0;for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const av=a[y*SIZE+x],bx=x+dx,by=y+dy,bv=(bx>=0&&bx<SIZE&&by>=0&&by<SIZE)?b[by*SIZE+bx]:0;
  if(av&&bv)intersection++;if(av||bv)union++;
 }best=Math.max(best,union?intersection/union:0);
 }return best;}
function rank(query,refs,limit=8){return refs.map(r=>({...r,score:compare(query,r.signature)})).sort((a,b)=>b.score-a.score).slice(0,limit)}
return {normalize,compare,rank,SIZE};
});