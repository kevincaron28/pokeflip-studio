/* PokéFlip card detection + perspective rectification, pure pixel math (no ML, no network).
 * Finds the card in a photo of a card lying on a plain surface, then warps it to an upright
 * 630×880 rectangle so OCR sees the name header and the bottom number strip at known positions.
 * A failed detection returns ok:false and callers MUST fall back to the original photo.
 * Limits: assumes one card, contrasting background, tilt < 45°; cannot tell upside-down cards. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PokeFlipCardDetect=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const OUT_W=630,OUT_H=880,ASPECT=OUT_W/OUT_H;
// Regions of interest on the rectified card, as fractions [x0,y0,x1,y1].
const ROIS={name:[.03,.03,.74,.125],art:[.07,.115,.93,.55],number:[.0,.88,.62,1],bottom:[0,.88,1,1]};
function downscale(rgba,w,h,maxSide){
 const s=Math.min(1,maxSide/Math.max(w,h)),tw=Math.max(1,Math.round(w*s)),th=Math.max(1,Math.round(h*s)),out=new Uint8ClampedArray(tw*th*3);
 for(let y=0;y<th;y++){const y0=Math.floor(y/s),y1=Math.min(h,Math.max(y0+1,Math.floor((y+1)/s)));
  for(let x=0;x<tw;x++){const x0=Math.floor(x/s),x1=Math.min(w,Math.max(x0+1,Math.floor((x+1)/s)));let r=0,g=0,b=0,n=0;
   for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=(yy*w+xx)*4;r+=rgba[i];g+=rgba[i+1];b+=rgba[i+2];n++}
   const o=(y*tw+x)*3;out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n}}
 return {data:out,w:tw,h:th,scale:s};
}
function median(arr){const s=Float32Array.from(arr).sort();return s[s.length>>1]||0}
function otsu(values,bins=64,max=442){
 const hist=new Float64Array(bins);for(const v of values)hist[Math.min(bins-1,Math.floor(v/max*bins))]++;
 const total=values.length;let sum=0;for(let i=0;i<bins;i++)sum+=i*hist[i];
 let wB=0,sB=0,best=-1,thr=0;for(let i=0;i<bins;i++){wB+=hist[i];if(!wB)continue;const wF=total-wB;if(!wF)break;sB+=i*hist[i];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>best){best=v;thr=i}}
 return (thr+1)/bins*max;
}
function largestComponent(mask,w,h){
 const label=new Int32Array(w*h),stack=new Int32Array(w*h);let best=0,bestLabel=0,cur=0;
 for(let s=0;s<w*h;s++){if(!mask[s]||label[s])continue;cur++;let sp=0,count=0;stack[sp++]=s;label[s]=cur;
  while(sp){const p=stack[--sp];count++;const x=p%w,y=(p-x)/w;
   if(x>0&&mask[p-1]&&!label[p-1]){label[p-1]=cur;stack[sp++]=p-1}
   if(x<w-1&&mask[p+1]&&!label[p+1]){label[p+1]=cur;stack[sp++]=p+1}
   if(y>0&&mask[p-w]&&!label[p-w]){label[p-w]=cur;stack[sp++]=p-w}
   if(y<h-1&&mask[p+w]&&!label[p+w]){label[p+w]=cur;stack[sp++]=p+w}}
  if(count>best){best=count;bestLabel=cur}}
 return {label,id:bestLabel,count:best};
}
function fitPlane(pts,px,c){ // least squares z = a + b·u + c·v
 let n=0,su=0,sv=0,suu=0,suv=0,svv=0,sz=0,suz=0,svz=0;for(const p of pts){const u=p[0],v=p[1],z=px[p[2]+c];n++;su+=u;sv+=v;suu+=u*u;suv+=u*v;svv+=v*v;sz+=z;suz+=u*z;svz+=v*z}
 const M=[[n,su,sv,sz],[su,suu,suv,suz],[sv,suv,svv,svz]];for(let i=0;i<3;i++){let p=i;for(let r=i+1;r<3;r++)if(Math.abs(M[r][i])>Math.abs(M[p][i]))p=r;[M[i],M[p]]=[M[p],M[i]];if(Math.abs(M[i][i])<1e-9)return [sz/n,0,0];for(let r=i+1;r<3;r++){const f=M[r][i]/M[i][i];for(let k=i;k<4;k++)M[r][k]-=f*M[i][k]}}
 const cv=[0,0,0];for(let r=2;r>=0;r--){let t=M[r][3];for(let k=r+1;k<3;k++)t-=M[r][k]*cv[k];cv[r]=t/M[r][r]}return cv;
}
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function polygonArea(q){let s=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];s+=a[0]*b[1]-b[0]*a[1]}return Math.abs(s)/2}
/** detect(rgba,width,height) → {ok,reason,quad:[TL,TR,BR,BL] in source pixels,confidence} */
function detect(rgba,width,height){
 const d=downscale(rgba,width,height,400),{w,h,scale}=d,px=d.data;
 // Background colour = per-channel median of a thin border frame.
 // Background = per-channel plane (a+bx+cy) fitted to a thin border frame, so uneven lighting
 // across the table does not leak into the mask. Robust: the fit is done twice, dropping outliers.
 const bw=Math.max(2,Math.round(Math.min(w,h)*.04)),pts=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<bw||x>=w-bw||y<bw||y>=h-bw)pts.push([x/w,y/h,(y*w+x)*3]);
 const planes=[0,1,2].map(c=>{let use=pts,coef=[0,0,0];for(let pass=0;pass<2;pass++){coef=fitPlane(use,px,c);if(!pass){const res=use.map(p=>Math.abs(px[p[2]+c]-(coef[0]+coef[1]*p[0]+coef[2]*p[1])));const lim=median(res)*3+6;use=use.filter((p,i)=>res[i]<=lim);if(use.length<20)use=pts}}return coef}),dd=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*3,u=x/w,v=y/h;dd[y*w+x]=Math.hypot(px[o]-(planes[0][0]+planes[0][1]*u+planes[0][2]*v),px[o+1]-(planes[1][0]+planes[1][1]*u+planes[1][2]*v),px[o+2]-(planes[2][0]+planes[2][1]*u+planes[2][2]*v))}
 const base=otsu(dd);
 // A glare patch or shadow touching the card can merge into it: retry with stricter thresholds.
 let firstCount=0;
 function attempt(thr,vote,retry){
 const mask=new Uint8Array(w*h);for(let i=0;i<w*h;i++)mask[i]=dd[i]>thr?1:0;
 // Remove speckle: a 3×3 majority vote.
 const clean=new Uint8Array(w*h);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)n+=mask[(y+j)*w+x+i];clean[y*w+x]=n>=vote?1:0}
 const comp=largestComponent(clean,w,h);
 if(!comp.count)return {ok:false,reason:'no-object'};
 if(!retry)firstCount=comp.count;else if(comp.count<firstCount*.6)return {ok:false,reason:'shrunk'}; // a stricter threshold may shed glare, not most of the card
 const frac=comp.count/(w*h);if(frac<.08)return {ok:false,reason:'too-small'};if(frac>.92)return {ok:false,reason:'fills-frame'};
 // Extreme points of the component give the four corners of a tilted rectangle.
 let tl=null,tr=null,br2=null,bl=null,minS=1e9,maxS=-1e9,minD=1e9,maxD=-1e9,area=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(comp.label[y*w+x]===comp.id){area++;const s=x+y,df=x-y;
  if(s<minS){minS=s;tl=[x,y]}if(s>maxS){maxS=s;br2=[x,y]}if(df>maxD){maxD=df;tr=[x,y]}if(df<minD){minD=df;bl=[x,y]}}
 let quad=[tl,tr,br2,bl];
 const qa=polygonArea(quad);if(qa<1)return {ok:false,reason:'degenerate'};
 const fill=area/qa;if(fill<.78)return {ok:false,reason:'not-rectangular',fill};
 // Opposite sides must be similar and corners near-square: rejects trapezoids carved out of shadows or glare.
 const sides=[dist(quad[0],quad[1]),dist(quad[1],quad[2]),dist(quad[3],quad[2]),dist(quad[0],quad[3])];
 if(Math.min(sides[0],sides[2])/Math.max(sides[0],sides[2])<.8||Math.min(sides[1],sides[3])/Math.max(sides[1],sides[3])<.8)return {ok:false,reason:'skewed',fill};
 for(let i=0;i<4;i++){const p=quad[(i+3)%4],q=quad[i],n=quad[(i+1)%4],a=Math.atan2(p[1]-q[1],p[0]-q[0]),b=Math.atan2(n[1]-q[1],n[0]-q[0]);let d=Math.abs(a-b)*180/Math.PI;if(d>180)d=360-d;if(d<65||d>115)return {ok:false,reason:'skewed',fill}}
 let wd=(dist(quad[0],quad[1])+dist(quad[3],quad[2]))/2,ht=(dist(quad[0],quad[3])+dist(quad[1],quad[2]))/2;
 if(wd>ht){quad=[quad[3],quad[0],quad[1],quad[2]];[wd,ht]=[ht,wd]} // landscape → rotate corner order to portrait
 const ratio=wd/ht;if(Math.abs(ratio-ASPECT)>.2)return {ok:false,reason:'wrong-aspect',ratio};
 const touches=quad.some(p=>p[0]<=1||p[1]<=1||p[0]>=w-2||p[1]>=h-2);
 const confidence=Math.max(0,Math.min(1,fill*(1-Math.abs(ratio-ASPECT)/.2*.3)*(touches?.6:1)));
 return {ok:true,quad:quad.map(p=>[(p[0]+.5)/scale,(p[1]+.5)/scale]),confidence,fill,ratio,touchesEdge:touches};
 }
 let last={ok:false,reason:'no-object'};
 for(const [mul,vote] of [[.8,5],[1.3,5],[1.9,6]]){last=attempt(Math.max(22,base*mul),vote,mul!==.8);if(last.ok)return last}
 return last;
}
function homography(src,dst){ // 8×8 Gaussian elimination: maps dst coords → src coords
 const A=[],b=[];for(let i=0;i<4;i++){const [x,y]=dst[i],[u,v]=src[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v)}
 const n=8;for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];
  for(let r=c+1;r<n;r++){const f=A[r][c]/A[c][c];for(let k=c;k<n;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c]}}
 const x=new Array(n);for(let r=n-1;r>=0;r--){let s=b[r];for(let k=r+1;k<n;k++)s-=A[r][k]*x[k];x[r]=s/A[r][r]}return x;
}
/** warp(rgba,w,h,quad) → {data,width,height} upright OUT_W×OUT_H RGBA (bilinear). */
function warp(rgba,w,h,quad,outW=OUT_W,outH=OUT_H){
 const H=homography(quad,[[0,0],[outW-1,0],[outW-1,outH-1],[0,outH-1]]),out=new Uint8ClampedArray(outW*outH*4);
 for(let y=0;y<outH;y++)for(let x=0;x<outW;x++){
  const den=H[6]*x+H[7]*y+1,u=(H[0]*x+H[1]*y+H[2])/den,v=(H[3]*x+H[4]*y+H[5])/den,o=(y*outW+x)*4;
  const x0=Math.floor(u),y0=Math.floor(v);if(x0<0||y0<0||x0>=w-1||y0>=h-1){const cx=Math.max(0,Math.min(w-1,Math.round(u))),cy=Math.max(0,Math.min(h-1,Math.round(v))),i=(cy*w+cx)*4;out[o]=rgba[i];out[o+1]=rgba[i+1];out[o+2]=rgba[i+2];out[o+3]=255;continue}
  const fx=u-x0,fy=v-y0,i00=(y0*w+x0)*4,i10=i00+4,i01=i00+w*4,i11=i01+4;
  for(let c=0;c<3;c++)out[o+c]=(rgba[i00+c]*(1-fx)+rgba[i10+c]*fx)*(1-fy)+(rgba[i01+c]*(1-fx)+rgba[i11+c]*fx)*fy;out[o+3]=255}
 return {data:out,width:outW,height:outH};
}
/** Scale a quad about its centre; detection corners sit a pixel or two inside the real edge. */
function grow(quad,f){const cx=quad.reduce((a,p)=>a+p[0],0)/4,cy=quad.reduce((a,p)=>a+p[1],0)/4;return quad.map(p=>[cx+(p[0]-cx)*f,cy+(p[1]-cy)*f])}
function rectify(rgba,w,h){const det=detect(rgba,w,h);if(!det.ok)return det;return {...det,image:warp(rgba,w,h,grow(det.quad,1.03))}}
/** Crop a region (fractions) of an RGBA image. */
function crop(img,roi){const x0=Math.round(roi[0]*img.width),y0=Math.round(roi[1]*img.height),x1=Math.round(roi[2]*img.width),y1=Math.round(roi[3]*img.height),cw=x1-x0,ch=y1-y0,out=new Uint8ClampedArray(cw*ch*4);
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const s=((y0+y)*img.width+x0+x)*4,o=(y*cw+x)*4;out[o]=img.data[s];out[o+1]=img.data[s+1];out[o+2]=img.data[s+2];out[o+3]=255}
 return {data:out,width:cw,height:ch};
}
return {detect,warp,rectify,crop,homography,ROIS,OUT_W,OUT_H,ASPECT};
});
