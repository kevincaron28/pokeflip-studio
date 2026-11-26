'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const F=require('../restock-feed.js');
const now=Date.parse('2026-11-26T12:00:00Z');
const item={name:'Box',lang:'FR',store:'a.example.ca',store_name:'Shop A',city:'Laval',url:'https://a.example.ca/products/box',price_cad:199.99,in_stock:true,seen_at:'2026-11-26T10:00:00Z',market_cad:180,market_as_of:'2026-11-25',image:'https://tcgplayer-cdn.tcgplayer.com/x.jpg'};
test('the feed keeps only rows with a name, a shop, a safe link and a time, newest first',()=>{
  const got=F.clean({checked_at:'2026-11-26T11:55:00Z',shops_checked:'41',items:[item,{...item,name:'Newer',seen_at:'2026-11-26T11:00:00Z',price_cad:null,image:'javascript:alert(1)',in_stock:false},
    {...item,url:'javascript:alert(1)'},{...item,url:'http://a.example.ca/'},{...item,seen_at:'soon'},{...item,name:''},null]});
  assert.deepStrictEqual(got.items.map(x=>x.name),['Newer','Box']);
  assert.equal(got.items[0].price,null);assert.equal(got.items[0].image,null);assert.equal(got.items[0].inStock,false);
  assert.equal(got.items[1].price,199.99);assert.equal(got.shops,41);assert.equal(got.checkedAt,Date.parse('2026-11-26T11:55:00Z'));
  for(const bad of [null,{},{items:null},'x',{message:'Could not find the function'}])assert.equal(F.clean(bad),null);
});
test('stopped checks are called paused, never live',()=>{
  assert.equal(F.status(now-5*60000,now),'live');
  assert.equal(F.status(now-31*60000,now),'paused');
  assert.equal(F.status(null,now),'never');
  assert.equal(F.ago(now-3*60000,now,'en-CA'),'3 minutes ago');
  assert.equal(F.ago(now-5*3600000,now,'fr-CA'),'il y a 5 heures');
});
test('the public database function returns only shop checks and no member data',()=>{
  const sql=fs.readFileSync('migrations/008-restock-feed.sql','utf8');
  assert.match(sql,/e\.source = 'shop_check' and e\.seller = 'store'/);
  assert.match(sql,/security definer set search_path = ''/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm,''),/reporter|discord|auth\.|user_id|disable row level/i);
  const key=/sb_publishable_[A-Za-z0-9_-]+/;
  assert.equal(fs.readFileSync('restock-feed.js','utf8').match(key)[0],fs.readFileSync('cloud-sync.js','utf8').match(key)[0]);
});
test('typical shop price needs three shops, and compares within 5 percent',()=>{
  const got=F.cleanPrices({'a|box|EN':{shops:3,typical:220,low:200,high:300},'b|box|EN':{shops:2,typical:220,low:200,high:300},'c|box|EN':{shops:5,typical:10,low:20,high:30},'d|box|EN':null});
  assert.deepStrictEqual([...got.keys()],['a|box|EN']);
  for(const bad of [null,[],'x'])assert.equal(F.cleanPrices(bad).size,0);
  assert.deepStrictEqual(F.compare(220,220),{code:'same',pct:0});
  assert.deepStrictEqual(F.compare(231,220),{code:'same',pct:5});
  assert.deepStrictEqual(F.compare(275,220),{code:'above',pct:25});
  assert.deepStrictEqual(F.compare(165,220),{code:'below',pct:25});
  assert.equal(F.compare(null,220),null);
  const cat=JSON.parse(fs.readFileSync('data/drop-catalogue.json','utf8')),s=cat.sets.find(x=>x.products.some(p=>p.kind==='box')),box=s.products.find(p=>p.kind==='box');
  assert.deepStrictEqual(F.productKeys(cat,box.id),[{lang:'EN',key:s.slug+'|box|EN'},{lang:'FR',key:s.slug+'|box|FR'}]);
  assert.deepStrictEqual(F.productKeys(cat,'0'),[]);
});
test('typical prices come only from shops with stock that answered lately, three or more',()=>{
  const sql=fs.readFileSync('migrations/009-shop-prices.sql','utf8');
  assert.match(sql,/s\.in_stock and s\.price_cad > 0/);assert.match(sql,/having count\(\*\) >= 3/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm,''),/reporter|discord|auth\.|user_id|disable row level/i);
});
