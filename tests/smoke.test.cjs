const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function boot(saved={}){
 const nodes={};const mocks=new Map();const elem=id=>nodes[id]??(nodes[id]={id,value:'',dataset:{},style:{},checked:false,disabled:false,innerHTML:'',textContent:'',placeholder:'',classList:{toggle(){},add(){},remove(){},contains(){return false}},elements:{date:{value:''}},reset(){},addEventListener(){},showModal(){},close(){},setAttribute(){},removeAttribute(){},remove(){},click(){}});
 const ls=new Map(Object.entries(saved));const storage={getItem:k=>ls.get(k)||null,setItem:(k,v)=>ls.set(k,v)};
 const document={getElementById:elem,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({style:{},click(){},remove(){}}),body:{appendChild(){}}};
 const c={document,localStorage:storage,navigator:{},location:{protocol:'file:'},window:{scrollTo(){},addEventListener(){}},Date,Math,Intl,Number,String,Array,JSON,Set,Map,URL,URLSearchParams,console,alert:(s)=>{throw Error(s)},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},FormData:class{constructor(form){this.form=form}get(k){return this.form.data[k]}},crypto:{randomUUID:()=>String(Math.random())}};
 c.globalThis=c;vm.createContext(c);vm.runInContext(source,c);return {c,elem,ls};
}
test('app boots with empty data and gives the other modules read access',()=>{const {c}=boot();const L=c.window.pokeflipLedger;assert.equal(typeof L.getData,'function');assert.equal(JSON.stringify(L.getData()),'{"lots":[],"items":[],"sales":[]}');assert.equal(c.db,undefined)});
test('My cards: one automatic lot, duplicates merged, targets and alert levels checked, nothing lost from older data',()=>{
 const old={lots:[{id:'L1',name:'Old lot',cost:50,date:'2026-11-01',source:'Kijiji',notes:''}],items:[{id:'i1',lotId:'L1',name:'Pikachu ex',idCode:'sv08-057',lang:'fr',condition:'Near Mint',finish:'Holo',qty:2,unitPrice:20,unitCost:5}],sales:[{id:'s1',itemId:'i1',qty:1,gross:25,fees:3,ship:0,date:'2026-11-10',channel:'Marketplace',costSnapshot:5}]};
 const {c,ls}=boot({'pokeflip-v1':JSON.stringify(old)});const L=c.window.pokeflipLedger;
 const r=L.addCard({name:'Charizard',idCode:'base1-4',setName:'Base Set',number:'4/102',lang:'en',finish:'Holo',edition:'unlimited',grade:'raw',qty:'1',paid:'',target:'300',alertPct:'15',image:'https://assets.tcgdex.net/en/base/base1/4/low.webp'});
 assert.equal(r.merged,false);let d=JSON.parse(ls.get('pokeflip-v1'));
 assert.equal(d.lots.length,2);const my=d.lots.find(l=>l.mycards);assert.equal(my.name,'My cards');assert.equal(my.cost,0);
 const ch=d.items.find(i=>i.id===r.id);assert.equal(ch.lotId,my.id);assert.equal(ch.target,300);assert.equal(ch.alertPct,15);assert.equal(ch.unitCost,null);assert.equal(ch.edition,'unlimited');
 assert.equal(L.addCard({name:'Charizard',idCode:'base1-4',lang:'en',finish:'Holo',edition:'unlimited',qty:2,target:250}).merged,true,'same card, printing and grade: one row');
 d=JSON.parse(ls.get('pokeflip-v1'));assert.equal(d.items.find(i=>i.id===r.id).qty,3);assert.equal(d.items.find(i=>i.id===r.id).target,250);
 assert.throws(()=>L.addCard({name:'X',target:'-1'}),/Prices must be numbers of 0 or more/);
 assert.throws(()=>L.addCard({name:'X',alertPct:'95'}),/whole number from 1 to 90/);
 assert.throws(()=>L.addCard({name:''}),/Card name missing/);
 // Editing: a new grade drops the old market value (re-priced by the next check); quantity never below sales.
 L.updateMarkets([['i1',{cad:18.5,confidence:'medium',sources:[],at:'2026-11-24T10:00:00.000Z'}]]);
 L.updateCard('i1',{target:'20',alertPct:'10',paid:'4.5'});d=JSON.parse(ls.get('pokeflip-v1'));let p=d.items.find(i=>i.id==='i1');
 assert.equal(p.target,20);assert.equal(p.alertPct,10);assert.equal(p.unitCost,4.5);assert.equal(p.market.cad,18.5,'same printing: price kept');
 L.updateCard('i1',{grade:'PSA 10'});p=JSON.parse(ls.get('pokeflip-v1')).items.find(i=>i.id==='i1');assert.equal(p.grade,'PSA 10');assert.equal(p.market,undefined);
 assert.throws(()=>L.updateCard('i1',{qty:'0'}),/at least 1/);
 // Removing: a card with a recorded sale is hidden, never deleted; others are deleted.
 assert.equal(L.removeCard('i1'),'hidden');assert.equal(L.removeCard(r.id),'removed');
 d=JSON.parse(ls.get('pokeflip-v1'));assert.equal(d.items.length,1);assert.equal(d.items[0].archived,true);assert.equal(d.sales.length,1);assert.equal(d.lots.find(l=>l.id==='L1').cost,50);
});
test('backup validation rejects orphan inventory and overselling',()=>{
 const {c}=boot();const bad={lots:[],items:[{id:'a',lotId:'missing',name:'A',lang:'fr',qty:1}],sales:[]};assert.throws(()=>vm.runInContext('validateBackup('+JSON.stringify(bad)+')',c),/Invalid inventory/);
 const b={lots:[{id:'L',name:'Lot',cost:1}],items:[{id:'I',lotId:'L',name:'Card',lang:'en',qty:1}],sales:[{id:'S',itemId:'I',qty:2,gross:3,fees:0,ship:0}]};assert.throws(()=>vm.runInContext('validateBackup('+JSON.stringify(b)+')',c),/Sold quantities exceed stock/);
});
test('code has no syntax errors and assets are present',()=>{for(const f of ['index.html','app.js','manifest.webmanifest','sw.js','icon.svg','vercel.json'])assert.ok(fs.existsSync(path.join(__dirname,'..',f)));assert.ok(!source.includes('SERVICE_ROLE_KEY'));});
