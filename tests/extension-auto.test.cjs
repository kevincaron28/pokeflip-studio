const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');const A=require('../extension/lib/core.js');
const fx=f=>fs.readFileSync(path.join(root,'tests/fixtures/extension',f),'utf8');
const product={id:'amazon:B0TEST0001',store:'amazon',name:'ETB',maxPrice:70,maxQty:2,maxOrderTotal:160,enabled:true,autoBuy:true};
const settings={autoAck:true,dailyCap:300,postalCode:'J4K 1A1',street:'',sellerAllowlist:[]};
// Automatic checkout is switched off (AUTO_CHECKOUT_ENABLED=false); the guards are still checked, ignoring that one reason.
const OFF=/turned off in this version/;const pass=v=>v.why.every(w=>OFF.test(w));
const check=(f,p=product,s=settings,spent=0,qty=2)=>A.verifyCheckout(p,s,A.parseAmazonCheckout(fx('amazon-spc-'+f+'.html')),qty,spent);

test('a clean checkout passes every guard',()=>{const v=check('ok');assert.equal(pass(v),true,v.why.join('; '));assert.equal(v.total,149.44);assert.equal(v.qty,2);assert.equal(v.unit,64.99)});
test('stops at a payment choice, a CVV, a one-time code or a CAPTCHA',()=>{
 for(const f of ['payment','cvv','otp'])assert.equal(pass(check(f)),false,f);
 assert.equal(pass(A.verifyCheckout(product,settings,A.parseAmazonCheckout(fx('amazon-robot.html')),2)),false);
});
test('stops on seller, address, totals, quantity, extra items and the daily cap',()=>{
 assert.match(check('thirdparty').why.join(),/CardFlipperz/);
 assert.equal(pass(check('thirdparty',product,{...settings,sellerAllowlist:['CardFlipperz']})),true,'allowlisted seller passes');
 assert.match(check('address').why.join(),/postal code/);
 assert.match(check('ok',product,{...settings,street:'200 Autre Rue'}).why.join(),/street/);
 assert.equal(pass(check('ok',product,{...settings,street:'100 Rue Exemple'})),true);
 assert.match(check('total').why.join(),/order total \$189\.44 is above/);
 assert.match(check('ok',{...product,maxPrice:60}).why.join(),/unit price \$64\.99/);
 assert.match(check('ok',product,settings,0,1).why.join(),/quantity is 2, expected 1/);
 assert.match(check('twoitems').why.join(),/more than one item/);
 assert.match(check('ok',product,{...settings,dailyCap:200},100).why.join(),/daily cap/);
});
test('eligibility: Amazon.ca only, switched on per product, warning accepted, caps and postal code set',()=>{
 assert.equal(pass(A.autoEligible(product,settings)),true);
 assert.match(A.autoEligible({...product,store:'pokemoncenter'},settings).why.join(),/Amazon\.ca only/);
 assert.equal(pass(A.autoEligible({...product,autoBuy:false},settings)),false);
 assert.equal(pass(A.autoEligible(product,{...settings,autoAck:false})),false);
 assert.equal(pass(A.autoEligible(product,{...settings,dailyCap:0})),false);
 assert.equal(pass(A.autoEligible(product,{...settings,postalCode:''})),false);
 assert.equal(pass(A.autoEligible({...product,maxOrderTotal:undefined},settings)),false);
});
test('daily spend counts placed and unconfirmed orders of today only',()=>{
 const now=new Date(2026,10,23,15).getTime(),today=new Date(2026,10,23,9).toISOString(),yesterday=new Date(2026,10,22,23).toISOString();
 assert.equal(A.spentToday([{at:today,total:100,status:'placed'},{at:today,total:50,status:'unknown'},{at:today,total:70,status:'not-placed'},{at:yesterday,total:999,status:'placed'}],now),150);
});
test('order confirmation and the cancel link',()=>{
 assert.deepEqual({...A.parseOrderPlaced(fx('amazon-thankyou.html'))},{placed:true,orderId:'702-1234567-7654321'});
 assert.equal(A.parseOrderPlaced(fx('amazon-spc-ok.html'),'https://www.amazon.ca/checkout/p/x/spc').placed,false);
 assert.equal(A.cancelUrl('702-1234567-7654321'),'https://www.amazon.ca/gp/your-account/order-details?orderID=702-1234567-7654321');
 assert.equal(A.cancelUrl(null),'https://www.amazon.ca/gp/css/order-history');
});
test('only two direct presses exist, both in the Amazon automatic path; assist mode still goes through the guard',()=>{
 const src=fs.readFileSync(path.join(root,'extension/content/assist.js'),'utf8');
 const clicks=src.split('\n').filter(l=>/\.click\(\)/.test(l)&&!/function safeClick/.test(l)&&!/^\s*el\.click\(\);return true;/.test(l));
 assert.equal(clicks.length,2,clicks.join('\n'));
 assert.ok(clicks.some(l=>/buy\.click\(\);.*Buy Now, automatic mode only/.test(l)));
 assert.ok(clicks.some(l=>/btn\.click\(\);.*single automatic "Place your order" press/.test(l)));
 assert.ok(/if\(store==='amazon'&&job\.mode==='auto'&&p\.store==='amazon'\)/.test(src),'automatic branch is Amazon only');
 const bg=fs.readFileSync(path.join(root,'extension/background.js'),'utf8');
 assert.ok(/if\(job\.attempted\)\{await log\('Second Place-order attempt refused/.test(bg),'one attempt per drop');
 assert.ok(/A\.verifyCheckout\(p,settings,msg\.parsed/.test(bg),'background re-verifies with stored settings');
});
test('settings page: plain terms warning, no secret fields',()=>{
 const ui=fs.readFileSync(path.join(root,'extension/options.html'),'utf8');
 assert.match(ui,/Amazon's Conditions of Use forbid robots and automated buying/);assert.match(ui,/close your account/);
 for(const input of ui.match(/<input[^>]*>/gi)||[])assert.ok(!/password|\bcard\b|card.?number|cvv|cvc|expir|iban/i.test(input),input);
});

test('automatic checkout is off: nothing is ever eligible or verified, whatever the settings',()=>{
 assert.equal(A.AUTO_CHECKOUT_ENABLED,false);
 assert.equal(A.autoEligible(product,settings).ok,false);assert.match(A.autoEligible(product,settings).why[0],OFF);
 assert.equal(check('ok').ok,false);
});
