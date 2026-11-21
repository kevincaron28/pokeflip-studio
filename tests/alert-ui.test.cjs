const {test}=require('node:test'),assert=require('node:assert/strict');require('../alert-hub.js');const a=globalThis.PokeFlipAlerts;
test('validates imported alert backup array',()=>{assert.equal(typeof a.normalize,'function');assert.throws(()=>a.normalize({source:'other',retailer:'Shop',product:'',price:20,status:'in'}));});
