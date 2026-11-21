const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function boot(){
 const nodes={};const mocks=new Map();const elem=id=>nodes[id]??(nodes[id]={id,value:'',dataset:{},style:{},checked:false,disabled:false,innerHTML:'',textContent:'',placeholder:'',classList:{toggle(){},add(){},remove(){},contains(){return false}},elements:{date:{value:''}},reset(){},addEventListener(){},showModal(){},close(){},setAttribute(){},removeAttribute(){},remove(){},click(){}});
 const ls=new Map();const storage={getItem:k=>ls.get(k)||null,setItem:(k,v)=>ls.set(k,v)};
 const document={getElementById:elem,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({style:{},click(){},remove(){}}),body:{appendChild(){}}};
 const c={document,localStorage:storage,navigator:{},location:{protocol:'file:'},window:{scrollTo(){},addEventListener(){}},Date,Math,Intl,Number,String,Array,JSON,Set,Map,URL,URLSearchParams,console,alert:(s)=>{throw Error(s)},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},FormData:class{constructor(form){this.form=form}get(k){return this.form.data[k]}},crypto:{randomUUID:()=>String(Math.random())}};
 c.globalThis=c;vm.createContext(c);vm.runInContext(source,c);return {c,elem,ls};
}
test('app boots with empty business data',()=>{const {c,elem}=boot();assert.match(elem('metrics').innerHTML,/Total spent on lots/);assert.equal(c.db,undefined)});
test('purchase lot and bulk inventory and sale account for net proceeds',()=>{
 const {elem,ls}=boot();const l=elem('lotForm');l.data={name:'Lot 1',cost:'75',date:'2026-11-21',source:'Marketplace',notes:''};l.onsubmit({preventDefault(){},target:l});
 const lot=JSON.parse(ls.get('pokeflip-v1')).lots[0];assert.equal(lot.cost,75);
 elem('bulkLot').value=lot.id;elem('bulkLang').value='fr';elem('bulkType').value='Common';elem('bulkQty').value='100';elem('bulkLocation').value='D-BULK-FR';elem('bulkValue').value='10';elem('bulkForm').onsubmit({preventDefault(){},target:elem('bulkForm')});
 let data=JSON.parse(ls.get('pokeflip-v1'));assert.equal(data.items.length,1);assert.equal(data.items[0].qty,100);
 const item=data.items[0];elem('saleItem').value=item.id;elem('saleQty').value='10';elem('saleGross').value='12';elem('saleFees').value='2';elem('saleShip').value='1';elem('saleDate').value='2026-11-21';elem('saleChannel').value='Local';elem('saleForm').onsubmit({preventDefault(){},target:elem('saleForm')});
 data=JSON.parse(ls.get('pokeflip-v1'));assert.equal(data.sales.length,1);assert.equal(data.sales[0].costSnapshot,null);assert.equal(data.sales[0].gross-data.sales[0].fees-data.sales[0].ship,9);
});
test('backup validation rejects orphan inventory and overselling',()=>{
 const {c}=boot();const bad={lots:[],items:[{id:'a',lotId:'missing',name:'A',lang:'fr',qty:1}],sales:[]};assert.throws(()=>vm.runInContext('validateBackup('+JSON.stringify(bad)+')',c),/Invalid inventory/);
 const b={lots:[{id:'L',name:'Lot',cost:1}],items:[{id:'I',lotId:'L',name:'Card',lang:'en',qty:1}],sales:[{id:'S',itemId:'I',qty:2,gross:3,fees:0,ship:0}]};assert.throws(()=>vm.runInContext('validateBackup('+JSON.stringify(b)+')',c),/Sold quantities exceed stock/);
});
test('code has no syntax errors and assets are present',()=>{for(const f of ['index.html','app.js','manifest.webmanifest','sw.js','icon.svg','vercel.json'])assert.ok(fs.existsSync(path.join(__dirname,'..',f)));assert.ok(!source.includes('SERVICE_ROLE_KEY'));});