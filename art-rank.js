/* PokéFlip artwork similarity: ranks catalogue candidates by how much their artwork window
 * looks like the photographed card. Pure pixel math, no ML, no uploads. It is an AID that
 * re-orders the existing TCGdex lookup results; it never confirms a printing.
 * Signature = 16x16 difference hash (structure) + 4x4 grid of lighting-normalised colours.
 * Both inputs must be upright cards (a rectified photo, or the catalogue card image). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PokeFlipArtRank=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const ART=[.07,.115,.93,.55],N=16,G=4;
function sampleGrid(rgba,w,h,box,cols,rows){ // box-average a region of an RGBA image into cols×rows RGB cells
 const x0=box[0]*w,y0=box[1]*h,cw=(box[2]-box[0])*w/cols,ch=(box[3]-box[1])*h/rows,out=new Float32Array(cols*rows*3);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){let sr=0,sg=0,sb=0,n=0;const xa=Math.floor(x0+c*cw),xb=Math.max(xa+1,Math.floor(x0+(c+1)*cw)),ya=Math.floor(y0+r*ch),yb=Math.max(ya+1,Math.floor(y0+(r+1)*ch));
  const sx=Math.max(1,Math.floor((xb-xa)/6)),sy=Math.max(1,Math.floor((yb-ya)/6));
  for(let y=ya;y<yb&&y<h;y+=sy)for(let x=xa;x<xb&&x<w;x+=sx){const i=(y*w+x)*4;sr+=rgba[i];sg+=rgba[i+1];sb+=rgba[i+2];n++}
  const o=(r*cols+c)*3;if(n){out[o]=sr/n;out[o+1]=sg/n;out[o+2]=sb/n}}
 return out;
}
function signature(rgba,w,h,box=ART){
 if(!rgba||w<16||h<16)throw Error('Image too small');
 const g=sampleGrid(rgba,w,h,box,N+1,N),lum=new Float32Array((N+1)*N);
 for(let i=0;i<lum.length;i++)lum[i]=.299*g[i*3]+.587*g[i*3+1]+.114*g[i*3+2];
 const hash=new Uint8Array(N*N);for(let r=0;r<N;r++)for(let c=0;c<N;c++)hash[r*N+c]=lum[r*(N+1)+c]>lum[r*(N+1)+c+1]?1:0;
 const col=sampleGrid(rgba,w,h,box,G,G);let mean=[0,0,0];for(let i=0;i<G*G;i++)for(let k=0;k<3;k++)mean[k]+=col[i*3+k]/(G*G);
 const total=(mean[0]+mean[1]+mean[2])/3||1,vec=new Float32Array(G*G*3);
 for(let i=0;i<G*G;i++)for(let k=0;k<3;k++)vec[i*3+k]=(col[i*3+k]-mean[k])/total; // removes overall brightness & white-balance cast
 return {hash,vec};
}
/** Similarity 0..1 (1 = identical). Not a probability. */
function similarity(a,b){
 let ham=0;for(let i=0;i<a.hash.length;i++)if(a.hash[i]!==b.hash[i])ham++;
 let l1=0;for(let i=0;i<a.vec.length;i++)l1+=Math.abs(a.vec[i]-b.vec[i]);
 const structure=1-ham/a.hash.length,colour=Math.max(0,1-l1/(a.vec.length*.5));
 return .4*structure+.6*colour;
}
/** rank(photoSig,[{id,sig}]) → same items + score, best first; ties keep catalogue order. */
function rank(photo,items){return items.map((it,i)=>({...it,score:similarity(photo,it.sig),i})).sort((x,y)=>y.score-x.score||x.i-y.i)}
return {signature,similarity,rank,ART};
});
