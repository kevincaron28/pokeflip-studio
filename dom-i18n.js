/* Cardstead: French for the screens built before the bilingual rewrite (Scanner, Lots, Inventory, Sales,
 * Business, Settings, Watch, Sealed guide, eBay sold…). When the language is French it translates the text,
 * placeholders, labels and dialogs on the page with the dictionary in i18n-fr.js:
 *   1. the whole text, exactly;
 *   2. a pattern with {0}, {1}… for text that has numbers or names in it;
 *   3. known English phrases inside a longer sentence built from pieces.
 * Text added later (lists, toasts, results) is translated as it appears. Switching back to English puts the
 * original text back. Saved data is never touched: only what is on screen. Newer screens use ui-i18n.js. */
(function(root){
'use strict';
const ATTRS=['placeholder','aria-label','title','alt'];
const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','CODE','PRE','NOSCRIPT','svg']);
// Screens built bilingual (ui-i18n.js) translate themselves.
const OWN='[data-i18n],[data-no-translate],#home,#prices,#product,#packs,#deals,#compareDialog';
const norm=s=>String(s).replace(/\s+/g,' ').trim();
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function build(dict){
 const exact=new Map(),patterns=[],frags=[];
 for(const [en,fr] of Object.entries(dict||{})){
  if(fr==null)continue;
  if(/\{\d+\}/.test(en)){
   const names=[];const rx=en.split(/(\{\d+\})/).map(p=>{const m=/^\{(\d+)\}$/.exec(p);if(m){names.push(+m[1]);return '(.+?)'}return esc(p)}).join('');
   patterns.push({rx:new RegExp('^'+rx+'$'),names,fr,len:en.length});
  }else{
   exact.set(en,fr);
   // Inside longer text only sentence pieces count: a Title Case phrase is a product or place name there
   // ("Surging Sparks Elite Trainer Box" stays as is).
   if(/\s/.test(en)&&en.length>=8&&!en.split(/\s+/).every(w=>!/^[a-z]/.test(w)))frags.push(en);
  }
 }
 patterns.sort((a,b)=>b.len-a.len);
 frags.sort((a,b)=>b.length-a.length);
 const fragRx=frags.length?new RegExp('(^|[^A-Za-z])('+frags.map(esc).join('|')+')(?=$|[^A-Za-z])','g'):null;
 return {exact,patterns,fragRx};
}

function makeTranslator(dict){
 const {exact,patterns,fragRx}=build(dict);
 function one(t){
  if(exact.has(t))return exact.get(t);
  for(const p of patterns){const m=p.rx.exec(t);if(m){let out=p.fr;p.names.forEach((n,i)=>{const v=m[i+1];out=out.split('{'+n+'}').join(exact.get(v)??v)});return out}}
  return null;
 }
 /** English text → French, or null when nothing is known. */
 return function tr(text){
  if(text==null)return null;
  const t=norm(text);if(!t||!/[A-Za-z]/.test(t))return null;
  const whole=one(t);if(whole!=null)return whole;
  // A text ending in ":" or "…" etc. may be a known phrase plus punctuation.
  const m=/^(.*?)([:.!?…]+)$/.exec(t);if(m&&m[1]){const w=one(m[1]);if(w!=null)return w+m[2]}
  if(!fragRx)return null;
  let hit=false;const out=t.replace(fragRx,(all,pre,en)=>{hit=true;return pre+exact.get(en)});
  return hit?out:null;
 };
}

function createDomTranslator(doc,dict,opts={}){
 const tr=makeTranslator(dict);
 const texts=new Map();   // Text node -> {orig, fr}
 const attrs=new Map();   // Element -> {attr: {orig, fr}}
 let on=false,busy=false,observer=null;
 const win=doc.defaultView||root;
 const origAlert=win.alert,origConfirm=win.confirm,origPrompt=win.prompt;

 function skipped(el){for(let e=el;e&&e.nodeType===1;e=e.parentNode){if(SKIP.has(e.nodeName)||e.matches(OWN)||e.isContentEditable)return true}return false}
 function doText(node){
  const v=node.nodeValue;const rec=texts.get(node);
  if(rec&&v===rec.fr)return;
  const fr=tr(v);if(fr==null){texts.delete(node);return}
  const lead=/^\s*/.exec(v)[0],trail=/\s*$/.exec(v)[0];const out=lead+fr+trail;
  texts.set(node,{orig:v,fr:out});node.nodeValue=out;
 }
 function doAttrs(el){
  const list=[...ATTRS];if(el.nodeName==='INPUT'&&/^(button|submit|reset)$/i.test(el.type))list.push('value');
  for(const a of list){
   if(!el.hasAttribute(a))continue;const v=el.getAttribute(a);const rec=attrs.get(el)?.[a];
   if(rec&&v===rec.fr)continue;const fr=tr(v);if(fr==null)continue;
   const m=attrs.get(el)||{};m[a]={orig:v,fr};attrs.set(el,m);el.setAttribute(a,fr);
  }
 }
 function walk(rootNode){
  if(!rootNode)return;
  if(rootNode.nodeType===3){if(!skipped(rootNode.parentNode))doText(rootNode);return}
  if(rootNode.nodeType!==1&&rootNode.nodeType!==9&&rootNode.nodeType!==11)return;
  if(rootNode.nodeType===1&&rootNode.nodeName==='TEXTAREA'&&!skipped(rootNode.parentNode)){doAttrs(rootNode);return}
  if(rootNode.nodeType===1&&skipped(rootNode))return;
  if(rootNode.nodeType===1)doAttrs(rootNode);
  const w=doc.createTreeWalker(rootNode,5/*element|text*/,{acceptNode:n=>n.nodeName==='TEXTAREA'?(doAttrs(n),2):n.nodeType===1&&(SKIP.has(n.nodeName)||n.matches(OWN))?2:1});
  for(let n=w.nextNode();n;n=w.nextNode()){if(n.nodeType===3)doText(n);else doAttrs(n)}
 }
 function run(fn){busy=true;try{fn()}finally{observer?.takeRecords();busy=false}}
 function onMutations(list){
  if(busy||!on)return;
  run(()=>{for(const m of list){
   if(m.type==='characterData')walk(m.target);
   else if(m.type==='attributes')doAttrs(m.target);
   else m.addedNodes.forEach(walk);
  }});
 }
 function enable(){
  if(on)return;on=true;
  run(()=>walk(doc.body||doc.documentElement));
  if(win.MutationObserver){observer=new win.MutationObserver(onMutations);observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...ATTRS,'value']})}
  if(opts.dialogs!==false){
   if(origAlert)win.alert=m=>origAlert.call(win,tr(m)??m);
   if(origConfirm)win.confirm=m=>origConfirm.call(win,tr(m)??m);
   if(origPrompt)win.prompt=(m,d)=>origPrompt.call(win,tr(m)??m,d);
  }
 }
 function disable(){
  if(!on)return;on=false;observer?.disconnect();observer=null;
  run(()=>{
   for(const [node,rec] of texts)if(node.nodeValue===rec.fr)node.nodeValue=rec.orig;
   for(const [el,m] of attrs)for(const a in m)if(el.getAttribute(a)===m[a].fr)el.setAttribute(a,m[a].orig);
  });
  texts.clear();attrs.clear();
  if(opts.dialogs!==false){win.alert=origAlert;win.confirm=origConfirm;win.prompt=origPrompt}
 }
 return {tr,enable,disable,get on(){return on}};
}

const api={makeTranslator,createDomTranslator};
if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
root.CardsteadDomI18n=api;
const doc=root.document;if(!doc)return;
let dom=null;
function sync(){
 const fr=root.CardsteadI18n?root.CardsteadI18n.lang()==='fr':false;
 if(!dom&&root.CardsteadFR)dom=createDomTranslator(doc,root.CardsteadFR);
 if(!dom)return;
 if(fr)dom.enable();else dom.disable();
}
api.sync=sync;api.tr=s=>dom?dom.tr(s):null;
root.addEventListener('cardstead:lang',sync);
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',sync);else sync();
})(typeof window!=='undefined'?window:globalThis);
