/* Cardstead affiliate links: the Amazon Associates tag comes from ONE setting, the host's environment variable
 * AMAZON_ASSOCIATES_TAG (Vercel and Cloudflare Pages), served by /api/config. No tag is written in the code.
 * Without the setting, links stay untagged and the disclosure stays hidden.
 * Only amazon.ca links are changed: product pages and searches get ?tag=, the add-to-cart page gets AssociateTag=.
 * See docs/AMAZON-ASSOCIATES.md. */
(function(root){'use strict';
const KEY='cardstead-config-v1',TTL=12*60*60*1000;
const TAG=/^[a-z0-9][a-z0-9-]{1,38}-20$/; // Amazon.ca tracking ids end in -20
let tag=null;
function setTag(t){tag=typeof t==='string'&&TAG.test(t)?t:null;return tag}
/** The same link with the Associates tag when it is an amazon.ca link and a tag is set; otherwise unchanged. */
function amazon(url,t=tag){
 if(!t||typeof url!=='string')return url;let u;try{u=new URL(url)}catch{return url}
 if(u.protocol!=='https:'||!/^(www\.)?amazon\.ca$/.test(u.hostname))return url;
 if(/^\/gp\/aws\/cart\/add\.html$/.test(u.pathname))u.searchParams.set('AssociateTag',t);else u.searchParams.set('tag',t);
 return u.href;
}
const core={amazon,setTag,get tag(){return tag},TAG};
root.CardsteadAffiliate=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root?.document)return;
const doc=root.document;
function show(){for(const el of doc.querySelectorAll('[data-affiliate-disclosure]'))el.hidden=!tag}
try{const c=JSON.parse(root.localStorage.getItem(KEY)||'null');if(c&&Date.now()-c.at<TTL)setTag(c.amazonTag)}catch{}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',show);else show();
const base=(root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'');
fetch(base+'/api/config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(!j)return;setTag(j.amazonTag);
 try{root.localStorage.setItem(KEY,JSON.stringify({amazonTag:tag,at:Date.now()}))}catch{}show()}).catch(()=>{});
})(typeof window!=='undefined'?window:globalThis);
