'use strict';
/* A conservative resale scenario calculator. Scenarios do not affect inventory. */
(function(){
 const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
 const fieldIds=['dealAsking','dealGross','dealSellThrough','dealFee','dealOrders','dealOrderCost','dealOther','dealTarget'];
 function analyze(input){
  const {asking,gross,sellThrough,fee,orders,orderCost,other,target}=input;
  if(Object.values(input).some(v=>!Number.isFinite(v)||v<0)||sellThrough>100||fee>100||orders>100000||gross>100000000||asking>100000000)throw Error('Enter valid non-negative numbers; percentages must be 0–100.');
  const realizedGross=gross*sellThrough/100, fees=realizedGross*fee/100, handling=orders*orderCost;
  const netBeforePurchase=realizedGross-fees-handling-other,profit=netBeforePurchase-asking;
  const breakEvenGross=(asking+handling+other)/((sellThrough/100)*(1-fee/100));
  const targetGross=(asking+handling+other+target)/((sellThrough/100)*(1-fee/100));
  const maxBid=Math.max(0,netBeforePurchase-target);
  return {realizedGross,fees,handling,netBeforePurchase,profit,breakEvenGross,targetGross,maxBid,margin:realizedGross>0?profit/realizedGross*100:null,roi:asking>0?profit/asking*100:null};
 }
 function num(id){return Number($(id).value)}
 function formValues(){return {asking:num('dealAsking'),gross:num('dealGross'),sellThrough:num('dealSellThrough'),fee:num('dealFee'),orders:num('dealOrders'),orderCost:num('dealOrderCost'),other:num('dealOther'),target:num('dealTarget')}}
 function show(){const result=$('dealResults');let input=formValues();try{
  const x=analyze(input);
  const good=x.profit>=input.target;
  result.innerHTML=`<div class="deal-verdict ${good?'deal-pass':'deal-risk'}"><strong>${good?'Meets target in this scenario':'Does not meet target'}</strong><span>${good?'This is a scenario, not a purchase recommendation.':'Try a lower offer, better sales evidence or lower expenses.'}</span></div><div class="deal-metrics"><div><span>Expected gross sold</span><strong>${money(x.realizedGross)}</strong></div><div><span>Expected fees and fulfillment</span><strong>${money(x.fees+x.handling+input.other)}</strong></div><div><span>Net after purchase</span><strong class="${x.profit>=0?'good':'bad'}">${money(x.profit)}</strong></div><div><span>Maximum bid for target</span><strong>${money(x.maxBid)}</strong></div></div><p class="note">Break-even listed value: ${Number.isFinite(x.breakEvenGross)?money(x.breakEvenGross):'Not achievable at these assumptions'} · Listed value needed for target: ${Number.isFinite(x.targetGross)?money(x.targetGross):'Not achievable'}.</p><p class="note">Based on ${input.sellThrough}% of estimated total resale value actually selling. Prices, fees, unsold inventory, returns, postage and taxes can differ. This does not guarantee profit.</p>`;
  localStorage.setItem('pokeflip-last-deal',JSON.stringify(input));
 }catch(err){result.textContent=err.message}}
 fieldIds.forEach(id=>$(id).addEventListener('input',show));
 $('dealReset').onclick=()=>{const def={dealAsking:100,dealGross:240,dealSellThrough:65,dealFee:13.25,dealOrders:12,dealOrderCost:2,dealOther:10,dealTarget:40};for(const [id,val] of Object.entries(def))$(id).value=val;show()};
 try{let old=JSON.parse(localStorage.getItem('pokeflip-last-deal')||'null');if(old){for(const [id,key] of [['dealAsking','asking'],['dealGross','gross'],['dealSellThrough','sellThrough'],['dealFee','fee'],['dealOrders','orders'],['dealOrderCost','orderCost'],['dealOther','other'],['dealTarget','target']])if(Number.isFinite(old[key]))$(id).value=old[key]}}catch{}
 show();
 window.pokeflipDeal={analyze};
})();
