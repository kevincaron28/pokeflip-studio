/* Cardstead pictures: one way to show a product or card image everywhere.
 * Sources (only hosts the site's Content-Security-Policy allows, all public catalogue or listing images):
 *   - TCGplayer catalogue image of a product (sealed products and the preloaded cards: tcgplayer-cdn.tcgplayer.com,
 *     the same image TCGplayer's catalogue and tcgcsv.com give for each product id);
 *   - TCGdex card images and set logos (assets.tcgdex.net);
 *   - the eBay listing's own image (i.ebayimg.com).
 * Every image is lazy-loaded; a missing one is replaced by a neutral placeholder (no broken-image icon). */
(function(root){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const OK=/^https:\/\/(assets\.tcgdex\.net|tcgplayer-cdn\.tcgplayer\.com|i\.ebayimg\.com)\//;
/** Image of a TCGplayer product id (200 px wide, the size the CDN serves), or '' for no id. Pure. */
function tcgSrc(id){const n=Number(id);return Number.isInteger(n)&&n>0?`https://tcgplayer-cdn.tcgplayer.com/product/${n}_200w.jpg`:''}
/** An <img> for an allowed image URL, lazy, with the placeholder class; '' when the URL is not allowed. Pure. */
function img(src,{cls='pic',alt=''}={}){return src&&OK.test(src)?`<img class="${esc(cls)}" loading="lazy" decoding="async" alt="${esc(alt)}" src="${esc(src)}">`:''}
/** The same, or a placeholder box when there is no image. Pure. */
function imgOr(src,opts={}){return img(src,opts)||`<span class="${esc(opts.cls||'pic')} pic-ph" aria-hidden="true"></span>`}
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
/** TCGplayer id of a sealed product by its name (watches are saved by name). items: product.js catalogue. Pure. */
function sealedId(name,items){const n=norm(name);if(!n)return null;const it=(items||[]).find(x=>x.kind==='sealed'&&norm(x.name)===n);return it?it.id:null}
const core={tcgSrc,img,imgOr,sealedId,OK};
root.CardsteadPics=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;
// Any picture that fails to load becomes a placeholder of the same size.
doc.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG'&&t.classList&&t.classList.contains('pic')&&!t.dataset.failed){t.dataset.failed='1';const ph=doc.createElement('span');ph.className=t.className+' pic-ph';ph.setAttribute('aria-hidden','true');t.replaceWith(ph)}},true);
})(typeof window!=='undefined'?window:globalThis);
