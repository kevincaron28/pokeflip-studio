'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const R=require('../routes.js');
const read=f=>fs.readFileSync(f,'utf8'),html=read('index.html'),SITE='https://pokeflip-studio.vercel.app/';
test('page addresses go both ways, and only our own are read',()=>{
  for(const page of Object.keys(R.PAGES))assert.deepStrictEqual(R.parse(R.toHash(page)),{page},page);
  assert.deepStrictEqual(R.parse(R.toHash('sets',24380)),{page:'sets',id:24380});
  for(const id of ['sealed:565606','card:106989:1st Edition Holofoil','card:89151:Holofoil:psa-9','card:42346'])assert.deepStrictEqual(R.parse(R.toHash('product',id)),{page:'product',id},id);
  assert.equal(R.toHash('product'),'');assert.equal(R.toHash('nowhere'),'');
  for(const bad of ['','#fr','#access_token=a&refresh_token=b','#/nowhere','#/product/x','#/product/sealed:1<script>','#/product/%E0%A4%A','#/sets/abc'])assert.equal(R.parse(bad),null,bad);
  assert.equal(R.shareUrl('#/'),SITE);assert.equal(R.shareUrl('#/sets/3'),SITE+'#/sets/3');
});
test('search engines and link previews get a current title, picture and both languages',()=>{
  assert.match(html,/<title>Cardstead \| Pokémon card prices in CA\$ and Canadian restock alerts<\/title>/);
  assert.doesNotMatch(html.slice(0,html.indexOf('<style>'))+read('manifest.webmanifest'),/command center|resale|profits/i);
  assert.ok(html.includes('<link rel="canonical" href="'+SITE+'">'));
  for(const l of ['en','fr'])assert.ok(html.includes('hreflang="'+l+'" href="'+SITE+'?lang='+l+'"'),l);
  assert.ok(html.includes('<meta property="og:image" content="'+SITE+'og-image.jpg">'));
  for(const f of ['og-image.jpg','apple-touch-icon.png','favicon.ico','404.html'])assert.ok(fs.existsSync(f),f);
  assert.match(read('robots.txt'),new RegExp('Sitemap: '+SITE.replace(/\./g,'\\.')+'sitemap\\.xml'));
  assert.match(read('sitemap.xml'),/\?lang=fr<\/loc>/);
  assert.doesNotMatch(read('404.html'),/<script/);
});
