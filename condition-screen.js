(function(){'use strict';
 const $=id=>document.getElementById(id);
 const keys=['gradeCenter','gradeCorners','gradeEdges','gradeSurface'];
 let quality={front:null,back:null},result=null;
 function evaluate(values,photos){
  if(values.some(x=>x==='major'))return {level:'Unlikely high-grade candidate',reason:'At least one major visible concern'};
  if(values.includes('unknown'))return {level:'Needs inspection',reason:'One or more grading factors were not inspected'};
  if(values.includes('minor'))return {level:'Inspect further',reason:'Minor visible concern; professional grading outcome uncertain'};
  if(!photos.front||!photos.back)return {level:'Needs inspection',reason:'Front and back images are required for a promising-card screen'};
  if(photos.front.status!=='usable'||photos.back.status!=='usable')return {level:'Retake photos',reason:'Image quality is insufficient to screen reliably'};
  return {level:'Potential grading candidate',reason:'No obvious problems reported; not an official grade or guarantee'};
 }
 function imageData(file){return new Promise((resolve,reject)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{try{const max=640,scale=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*scale);c.height=Math.round(im.naturalHeight*scale);const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,c.width,c.height);const data=x.getImageData(0,0,c.width,c.height);resolve({data,width:c.width,height:c.height,sourceWidth:im.naturalWidth,sourceHeight:im.naturalHeight});}catch(e){reject(e);}finally{URL.revokeObjectURL(u);}};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('Cannot read photo'))};im.src=u;});}
 function metrics(pic){const {data,width:w,height:h,sourceWidth:sw,sourceHeight:sh}=pic;const d=data.data;let n=0,glare=0,contrastSum=0,contrastSq=0,edges=0;
  for(let y=1;y<h-1;y+=2)for(let x=1;x<w-1;x+=2){const p=(y*w+x)*4;const lum=.2126*d[p]+.7152*d[p+1]+.0722*d[p+2];const px=((y*w+x+1)*4),py=(((y+1)*w+x)*4);const lx=.2126*d[px]+.7152*d[px+1]+.0722*d[px+2],ly=.2126*d[py]+.7152*d[py+1]+.0722*d[py+2];n++;glare+=(d[p]>248&&d[p+1]>248&&d[p+2]>248)?1:0;contrastSum+=lum;contrastSq+=lum*lum;edges+=Math.abs(lum-lx)+Math.abs(lum-ly);}
  const glareRatio=glare/Math.max(n,1),sharpness=edges/Math.max(n,1),contrast=Math.sqrt(Math.max(0,contrastSq/n-Math.pow(contrastSum/n,2)));
  // These thresholds identify obviously unusable images only, not surface defects.
  const status=Math.min(sw,sh)<650||sharpness<5||contrast<13||glareRatio>.20?'retake':'usable';
  return {status,glarePercent:Math.round(glareRatio*100),sharpness:Math.round(sharpness),pixels:[sw,sh]};
 }
 async function analyze(){result=null;for(const side of ['front','back']){let file=$('grade'+side[0].toUpperCase()+side.slice(1)).files[0];quality[side]=file?metrics(await imageData(file)):null;}const sides=['front','back'].map(s=>s+': '+(quality[s]?quality[s].status+' ('+quality[s].pixels.join('×')+' px, bright areas '+quality[s].glarePercent+'%)':'missing'));$('gradeQuality').textContent=sides.join(' · ')+'. Automatic image checks cannot detect scratches or assign grades.';$('gradeResult').textContent='Review all four factors and run assessment.';return quality;}
 function assess(){const values=keys.map(k=>$(k).value),out=evaluate(values,quality);result={...out,center:values[0],corners:values[1],edges:values[2],surface:values[3],photoQuality:{...quality},date:new Date().toISOString()};$('gradeResult').textContent=out.level+' — '+out.reason+'. Professional grading requires physical examination.';return result;}
 function read(){return result;}
 function reset(){result=null;quality={front:null,back:null};for(const k of keys)$(k).value='unknown';for(const id of ['gradeFront','gradeBack'])$(id).value='';$('gradeQuality').textContent='Add front and back photos to check image quality.';$('gradeResult').textContent='Not assessed. Unknown is the safe default.';}
 $('gradeAnalyze').addEventListener('click',()=>analyze().catch(e=>$('gradeQuality').textContent=e.message));$('gradeAssess').addEventListener('click',assess);$('gradeReset').addEventListener('click',reset);
 for(const id of ['gradeFront','gradeBack',...keys])$(id).addEventListener('change',()=>{result=null;$('gradeResult').textContent='Input changed. Re-run assessment before saving.';});
 window.PokeFlipCondition={evaluate,metrics,read,reset};
})();
