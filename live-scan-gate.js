/* Continuous scan gate: wait for a clear, stable, changed image before queueing.
   This is a motion/stability detector, not Pokémon recognition. */
(function(root){'use strict';
const DIFF_STABLE=0.043,DIFF_NEW=0.14;
function difference(a,b){
 if(!a||!b||a.length!==b.length||!a.length)return 1;
 let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);
 return sum/(255*a.length);
}
function makeGate(options={}){
 const stableFrames=options.stableFrames||3;
 const stableThreshold=options.stableThreshold||DIFF_STABLE;
 const newThreshold=options.newThreshold||DIFF_NEW;
 const cooldown=options.cooldownMs||1800;
 let last=null,lastCaptured=null,steady=0,needsChange=false,changed=0,lastCaptureTime=-Infinity,captures=0;
 return {
  inspect(fingerprint,time=Date.now(),valid=true){
   if(!valid||!fingerprint||!fingerprint.length){last=null;steady=0;if(needsChange)changed++;return {capture:false,reason:'no-card'};}
   const motion=difference(fingerprint,last);const novel=difference(fingerprint,lastCaptured);
   if(motion<=stableThreshold)steady++;else steady=1;
   last=Uint8Array.from(fingerprint);
   if(needsChange){
    if(novel>newThreshold)changed++;else changed=0;
    if(changed>=2&&steady>=stableFrames){needsChange=false;changed=0}
    else return {capture:false,reason:'move-next',motion,novel};
   }
   if(time-lastCaptureTime<cooldown)return {capture:false,reason:'cooldown'};
   if(lastCaptured&&novel<=newThreshold)return {capture:false,reason:'same-card'};
   if(steady<stableFrames)return {capture:false,reason:'hold-still',steady,motion};
   lastCaptured=Uint8Array.from(fingerprint);
   lastCaptureTime=time;needsChange=true;steady=0;changed=0;captures++;
   return {capture:true,reason:'stable',captures};
  },
  reset(){last=null;lastCaptured=null;steady=0;needsChange=false;changed=0;lastCaptureTime=-Infinity;captures=0},
  get captures(){return captures}
 };
}
function sample(ctx,width,height){
 const size=16,h=20;
 const data=ctx.getImageData(0,0,width,height).data;
 const result=new Uint8Array(size*h);
 let mean=0,min=255,max=0,edge=0;
 for(let y=0;y<h;y++)for(let x=0;x<size;x++){
  const px=Math.max(0,Math.min(width-1,Math.floor((x+.5)*width/size)));
  const py=Math.max(0,Math.min(height-1,Math.floor((y+.5)*height/h)));
  const i=(py*width+px)*4,val=Math.round(data[i]*.299+data[i+1]*.587+data[i+2]*.114);
  result[y*size+x]=val;mean+=val;min=Math.min(min,val);max=Math.max(max,val);
  if(x>0)edge+=Math.abs(val-result[y*size+x-1]);
 }
 mean/=size*h;
 // Reject dark/washed out/out-of-focus cards, blank mats and almost uniform frames.
 return {fingerprint:result,valid:mean>28&&mean<229&&(max-min)>62&&edge/(h*(size-1))>12};
}
root.PokeFlipLiveGate={makeGate,difference,sample};
})(typeof window!=='undefined'?window:globalThis);
