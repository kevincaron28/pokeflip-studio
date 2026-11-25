/* Cardstead mobile experience: a small persistent dock and a navigation drawer.
   Navigation delegates to the existing .tab handlers; no business data is changed here. */
(function(root){'use strict';
if(!root?.document)return;
const $=id=>document.getElementById(id);
function init(){
 const mainNav=[...document.querySelectorAll('.tabs .tab')];
 const drawer=$('mobileDrawer'),more=$('mobileMore'),scrim=$('mobileScrim'),links=$('mobileDrawerLinks');
 if(!drawer||!links)return;
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
  more?.setAttribute('aria-expanded','false');
  drawer.setAttribute('aria-hidden','true');
  scrim.hidden=true;
 }
 function open(){
  document.body.classList.add('mobile-menu-open');
  more?.setAttribute('aria-expanded','true');
  drawer.setAttribute('aria-hidden','false');
  scrim.hidden=false;
  drawer.querySelector('button')?.focus();
 }
 function active(){
  const id=mainNav.find(x=>x.classList.contains('on'))?.dataset.tab||'prices';
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
 more?.addEventListener('click',()=>document.body.classList.contains('mobile-menu-open')?close():open());
 $('mobileClose')?.addEventListener('click',close);
 scrim.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('mobile-menu-open')){close();more?.focus()}});
 // Most routes also navigate via data-goto: track tab state without changing app.js.
 const observer=new MutationObserver(active);
 for(const t of mainNav)observer.observe(t,{attributes:true,attributeFilter:['class']});
 active();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:undefined);
