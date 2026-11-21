/* PokéFlip mobile experience: a small persistent dock and focused scanner capture.
   Navigation delegates to the existing .tab handlers; no business data is changed here. */
(function(root){'use strict';
if(!root?.document)return;
const $=id=>document.getElementById(id);
const primary=['dashboard','scan','inventory','lots'];
function init(){
 const mainNav=[...document.querySelectorAll('.tabs .tab')];
 const drawer=$('mobileDrawer'),more=$('mobileMore'),scrim=$('mobileScrim'),links=$('mobileDrawerLinks');
 if(!drawer||!more||!links)return;
 // Clone navigation labels without copying existing tab semantics, for a single source of truth.
 for(const tab of mainNav){
  const button=document.createElement('button');button.type='button';
  button.className='drawer-link';button.dataset.target=tab.dataset.tab;
  button.textContent=tab.querySelector('.nav-caption')?.textContent||tab.textContent.trim();
  button.addEventListener('click',()=>navigate(tab.dataset.tab));
  links.append(button);
 }
 function close(){
  document.body.classList.remove('mobile-menu-open');
  more.setAttribute('aria-expanded','false');
  drawer.setAttribute('aria-hidden','true');
  scrim.hidden=true;
 }
 function open(){
  document.body.classList.add('mobile-menu-open');
  more.setAttribute('aria-expanded','true');
  drawer.setAttribute('aria-hidden','false');
  scrim.hidden=false;
  drawer.querySelector('button')?.focus();
 }
 function active(){
  const id=mainNav.find(x=>x.classList.contains('on'))?.dataset.tab||'dashboard';
  for(const btn of document.querySelectorAll('.dock-item[data-dock]')){
   const current=btn.dataset.dock===id;
   btn.classList.toggle('on',current);btn.setAttribute('aria-current',current?'page':'false');
  }
  for(const btn of links.querySelectorAll('.drawer-link')){
   btn.classList.toggle('on',btn.dataset.target===id);
   btn.setAttribute('aria-current',btn.dataset.target===id?'page':'false');
  }
  document.body.dataset.activeSection=id;
 }
 function navigate(id){
  const target=mainNav.find(x=>x.dataset.tab===id);
  if(!target)return;
  close();target.click();active();
 }
 for(const btn of document.querySelectorAll('.dock-item[data-dock]')){
  btn.addEventListener('click',()=>navigate(btn.dataset.dock));
 }
 more.addEventListener('click',()=>document.body.classList.contains('mobile-menu-open')?close():open());
 $('mobileClose')?.addEventListener('click',close);
 scrim.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('mobile-menu-open')){close();more.focus()}});
 // Most routes also navigate via data-goto: track tab state without changing app.js.
 const observer=new MutationObserver(active);
 for(const t of mainNav)observer.observe(t,{attributes:true,attributeFilter:['class']});
 active();
 // Preserve all existing scanner controls while folding deep-review tools on small screens.
 for(const [node,title] of [
  [document.querySelector('#setDetailPreview')?.closest('.panel'),'Set details & symbol matching'],
  [document.querySelector('#conditionScreen'),'Grading potential · front / back review'],
  [document.querySelector('#marketPanel'),'Advanced marketplace price references'],
  [document.querySelector('#scanMarketQuotes')?.closest('.panel'),'Extra market context']
 ]){
  if(!node||node.closest('.scan-advanced-details'))continue;
  const details=document.createElement('details');
  details.className='scan-advanced-details';
  details.open=root.matchMedia('(min-width:761px)').matches;
  const summary=document.createElement('summary');
  summary.textContent=title;
  node.parentNode.insertBefore(details,node);
  details.append(summary,node);
 }
 // Show the real queued image in the primary camera viewport; never fabricate a match.
 const photo=$('currentPhoto'),preview=$('mobilePhotoPreview'),finder=$('scan')?.querySelector('.scan-finder');
 function mirrorPhoto(){
  if(!photo||!preview)return;
  const src=photo.getAttribute('src');
  const visible=!!src&&!photo.classList.contains('hidden');
  preview.hidden=!visible;
  if(visible)preview.src=src;else preview.removeAttribute('src');
  finder?.classList.toggle('has-photo',visible);
 }
 if(photo&&preview){new MutationObserver(mirrorPhoto).observe(photo,{attributes:true,attributeFilter:['src','class']});mirrorPhoto()}
 // Keep essential card fields in view; put optional bookkeeping in a single disclosure.
 const cardForm=$('cardForm'),cardFields=cardForm?.querySelector(':scope > .grid2');
 if(cardForm&&cardFields){
  const optional=['cardPrice','cardPriceSource','cardAllocated','cardLocation','cardStatus'];
  const advanced=document.createElement('details');advanced.className='scan-advanced-details scan-card-optional';
  advanced.open=root.matchMedia('(min-width:761px)').matches;
  const title=document.createElement('summary');title.textContent='Optional pricing, storage & status';
  const grid=document.createElement('div');grid.className='grid2';grid.style.marginTop='12px';
  for(const id of optional){const el=$(id);const wrapper=el?.parentElement;if(wrapper&&cardFields.contains(wrapper))grid.append(wrapper)}
  advanced.append(title,grid);
  cardFields.insertAdjacentElement('afterend',advanced);
 }
 // Single-camera capture shares the existing, tested queue handler with normal batch uploads.
 const camera=$('mobileCameraInput'),batch=$('photoInput'),queueStatus=$('scanQueueStatus'),mobileStatus=$('mobileScanStatus');
 function syncStatus(){if(queueStatus&&mobileStatus)mobileStatus.textContent=queueStatus.textContent}
 if(queueStatus&&mobileStatus){new MutationObserver(syncStatus).observe(queueStatus,{subtree:true,characterData:true,childList:true});syncStatus()}
 if(camera&&batch)camera.addEventListener('change',()=>{
  const files=[...(camera.files||[])].filter(f=>f.type.startsWith('image/'));
  if(!files.length)return;
  try{
   const transfer=new DataTransfer();files.forEach(f=>transfer.items.add(f));
   batch.files=transfer.files;
   batch.dispatchEvent(new Event('change',{bubbles:true}));
   navigate('scan');
   root.setTimeout(()=>{$('currentPhoto')?.scrollIntoView({behavior:'smooth',block:'center'})},300);
  }catch(err){if(mobileStatus)mobileStatus.textContent='Could not send the camera image to the scan queue. Try Choose photos instead.'}
  camera.value='';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:undefined);
