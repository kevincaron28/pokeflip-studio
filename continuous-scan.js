/* PokéFlip Continuous Scan: camera stays open while cards are exchanged.
   Stable video frames are captured locally into the regular review queue.
   Exact printing and price are never auto-confirmed by OCR alone. */
(function(root){'use strict';
if(!root?.document)return;
const $=id=>document.getElementById(id);
function init(){
 const launch=document.querySelector('.scan-launch'),frame=launch?.querySelector('.scan-finder');
 if(!launch||!frame||!root.PokeFlipLiveGate)return;
 const controls=document.createElement('div');controls.className='live-controls';
 controls.innerHTML='<div class="live-heading"><strong>Continuous bulk scan</strong><span id="liveBadge" class="pill">Camera off</span></div>'+
 '<p class="live-description">Choose one card at a time or stack 20–50 cards beneath a fixed camera.</p>'+
 '<div class="live-options"><label for="liveMode">Scanning mode</label><select id="liveMode" aria-label="Scanning mode"><option value="single">Single Card — tap capture</option><option value="stack">Stack Mode — automatic</option></select><label>Cards in stack <input id="liveTarget" type="number" min="0" max="10000" step="1" value="0" aria-label="Scan target, zero for unlimited"> <small>0 = unlimited</small></label></div>'+
 '<div class="live-actions"><button id="liveStart" type="button" class="btn primary">Start camera</button><button id="liveManual" type="button" class="btn primary" hidden>Capture this card</button><button id="liveStop" type="button" class="btn" hidden>Stop camera</button></div>'+
 '<div class="live-progress"><span id="liveCount">0 captured</span><span id="livePrompt">Center the card in the frame</span></div>'+
 '<p class="live-disclaimer" id="liveMessage" role="status" aria-live="polite">Card photos stay on this device. Check each suggested printing before saving.</p>';
 launch.insertAdjacentElement('afterbegin',controls);
 const video=document.createElement('video');video.id='liveCamera';video.autoplay=true;video.muted=true;video.playsInline=true;video.hidden=true;
 frame.insertAdjacentElement('afterbegin',video);
 const stage=document.createElement('canvas');stage.width=160;stage.height=200;
 const ctx=stage.getContext('2d',{willReadFrequently:true});
 let gate=root.PokeFlipLiveGate.makeGate();
 let stream=null,timer=null,saving=false,captured=0;
 const status=msg=>{$('liveMessage').textContent=msg};
 const paint=()=>{$('liveBadge').textContent=stream?'● Live':'Camera off';$('liveBadge').classList.toggle('green',!!stream);
  $('liveStart').hidden=!!stream;$('liveManual').hidden=!stream;$('liveManual').textContent=$('liveMode').value==='stack'?'Capture missed card':'Capture this card';$('liveStop').hidden=!stream;$('liveCount').textContent=captured+' captured';
  frame.classList.toggle('live-on',!!stream)};
 const stop=()=>{
  if(timer!==null){root.clearTimeout(timer);timer=null}
  for(const track of stream?.getTracks()||[])track.stop();
  stream=null;video.srcObject=null;video.hidden=true;gate.reset();paint();
  status('Camera stopped. Captured photos remain in the review queue.');
 };
 function nextFrame(){
  if(!stream)return;
  timer=root.setTimeout(()=>{timer=null;inspect().finally(nextFrame)},380);
 }
 async function enqueueFrame(manual=false){
  if(saving||!stream)return;
  saving=true;
  try{
   const canvas=document.createElement('canvas');
   const scale=Math.min(1,1280/(video.videoWidth||1280));
   canvas.width=Math.max(1,Math.floor(video.videoWidth*scale));
   canvas.height=Math.max(1,Math.floor(video.videoHeight*scale));
   canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
   if(!blob)throw Error('Unable to capture current video frame');
   const file=new File([blob],'pokeflip-live-'+Date.now()+'.jpg',{type:'image/jpeg'});
   const transfer=new DataTransfer();transfer.items.add(file);
   const input=$('photoInput');input.files=transfer.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
   if(manual){ctx.drawImage(video,0,0,stage.width,stage.height);const snap=root.PokeFlipLiveGate.sample(ctx,stage.width,stage.height);gate.markManual(snap.fingerprint,Date.now())}
   captured++;paint();
   const target=Math.max(0,Math.floor(Number($('liveTarget').value)||0));
   if(target>0&&captured>=target){stop();status('Target reached: '+captured+' cards captured. Review and confirm the queue below.');return}
   $('livePrompt').textContent=$('liveMode').value==='stack'?'Add the next card on top':'Place the next card when ready';
   status('Captured '+captured+'. '+($('liveMode').value==='stack'?'Place the next card directly on top.':'Tap Capture this card when you are ready for another.')+' Review below.');
   root.navigator.vibrate?.(35);
  }catch(e){status('Auto-capture failed. Use Open camera or Choose photos instead.');}
  finally{saving=false}
 }
 async function inspect(){
  if(!stream||saving||document.hidden||$('liveMode').value!=='stack')return;
  if($('scan').classList.contains('hidden')){stop();return}
  if(video.readyState<2||video.videoWidth===0)return;
  try{
   ctx.drawImage(video,0,0,stage.width,stage.height);
   const photo=root.PokeFlipLiveGate.sample(ctx,stage.width,stage.height);
   const result=gate.inspect(photo.fingerprint,Date.now(),photo.valid);
   if(result.capture){await enqueueFrame();return}
   const messages={'no-card':'Place the next card on the stack','hold-still':'Hold the card still','move-next':'Add the next card on top','same-card':'Waiting for next card','cooldown':'Reading…','remove-first':'Add the next card on top'};
   $('livePrompt').textContent=messages[result.reason]||'Center the card in the frame';
  }catch(e){status('Live frame processing paused. You can still capture photos manually.')}
 }
 async function start(){
  if(stream)return;
  if(!root.navigator.mediaDevices?.getUserMedia){status('Live camera is not available in this browser. Try Chrome or the Open camera button.');return}
  status('Requesting rear-camera access…');
  try{
   const acquired=await root.navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1920}}});
   if($('scan').classList.contains('hidden')){acquired.getTracks().forEach(t=>t.stop());return}
   stream=acquired;video.srcObject=stream;video.hidden=false;
   try{await video.play()}catch(e){/* autoplay may settle after metadata */}
   captured=0;gate=root.PokeFlipLiveGate.makeGate();paint();$('autoOCR').checked=true;
   status($('liveMode').value==='stack'?'Stack Mode: place a card, let it settle, then place the next directly on top.':'Single Card: tap Capture this card whenever the card is ready.');
   if($('liveMode').value==='stack')nextFrame();
  }catch(e){status('Could not start camera. Grant access in Chrome, or use Open camera instead.')}
 }
 $('liveMode').addEventListener('change',()=>{if(stream)stop();paint();status($('liveMode').value==='stack'?'Stack Mode will capture automatically after each card settles.':'Single Card will capture only when you tap the button.')});
 $('liveManual').addEventListener('click',()=>{if(stream)enqueueFrame(true)});
 $('liveStart').addEventListener('click',start);
 $('liveStop').addEventListener('click',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&stream)stop()});
 const nav=new MutationObserver(()=>{if(stream&&$('scan').classList.contains('hidden'))stop()});
 nav.observe($('scan'),{attributes:true,attributeFilter:['class']});
 root.addEventListener('pagehide',stop);
 paint();
 root.PokeFlipLiveScan={start,stop,isRunning:()=>!!stream};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:undefined);
