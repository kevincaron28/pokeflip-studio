const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const load=f=>import(path.join(ROOT,'supabase/functions/_shared',f).replace(/\\/g,'/').replace(/^([A-Za-z]):/,'file:///$1:'));

const T0=Date.parse('2026-11-24T19:00:00Z');
const OLD_USER='700000000000000000';                                  // account from 2020
const OLD_USER2='710000000000000000';
const youngUser=now=>String((BigInt(now-86400000)-1420070400000n)<<22n); // one day old

const ev=(o={})=>({id:'e1',product_key:'delta-reign-etb-en',product_name:'Delta Reign Elite Trainer Box',product_lang:'EN',product_kind:'etb',store_key:'boutiquefdb',store_name:'Boutique FDB',region:'qc-montreal',city:'Montréal',url:'https://www.boutiquefdb.com/products/dr-etb',price_cad:94.99,msrp_cad:79.99,seller:'store',in_stock:true,source:'shop_check',confidence:'high',first_seen_at:new Date(T0-60000).toISOString(),market_cad:107,market_source:'TCGplayer',market_as_of:'2026-11-24',...o});

function fakes(now){
 const sent=[],edits=[],dms=[],threads=[],roleAdds=[];let n=0;
 const discord={
  call:async(m,p)=>{if(p==='/users/@me/guilds')return [{id:'G'}];throw Error('unexpected '+p)},
  channels:async()=>[{id:'C-mtl',name:'qc-montreal',type:0},{id:'C-amz',name:'amazon-ca',type:0},{id:'C-rep',name:'report-a-drop',type:15},{id:'C-speed',name:'speed-log',type:0},{id:'C-mod',name:'mod-queue',type:0}],
  roles:async()=>[{id:'R-etb',name:'ETB'},{id:'R-trust',name:'Trusted reporter'},{id:'R-mod',name:'Moderator'}],
  send:async(ch,msg)=>{sent.push({ch,msg});return {id:'M'+(++n)}},
  edit:async(ch,id,msg)=>{edits.push({ch,id,msg});return {}},
  forumPost:async(ch,name,msg)=>{threads.push({ch,name,msg});return {id:'TH'+(++n)}},
  dm:async(u,msg)=>{dms.push({u,msg})},
  addRole:async(g,u,r)=>{roleAdds.push({g,u,r})},
  followUp:async()=>{},
 };
 const db={events:[],posts:new Map(),wt:new Map(),reports:new Map(),reporters:new Map(),codes:[],targets:[]};
 const store={
  newEvents:async()=>db.events.filter(e=>!e.processed_at),
  markEvent:async(id,outcome)=>{const e=db.events.find(x=>x.id===id);e.processed_at=1;e.outcome=outcome},
  insertEvent:async e=>{db.events.push({...e})},
  getPost:async k=>[...db.posts.values()].find(p=>p.key===k)||null,
  getPostById:async id=>db.posts.get(id)||null,
  upsertPost:async row=>{for(const [id,p] of db.posts)if(p.key===row.key)db.posts.delete(id);db.posts.set(row.id,{...row})},
  updatePost:async(id,patch)=>{Object.assign(db.posts.get(id),patch)},
  addWasntThere:async(id,u)=>{const s=db.wt.get(id)||new Set();s.add(u);db.wt.set(id,s);return s.size},
  insertReport:async r=>{db.reports.set(r.id,{...r})},
  getReport:async id=>db.reports.get(id)||null,
  moveReport:async(id,from,patch)=>{const r=db.reports.get(id);if(!r||r.status!==from)return null;Object.assign(r,patch);return {...r}},
  expiredReports:async t=>[...db.reports.values()].filter(r=>r.status==='pending'&&Date.parse(r.expires_at)<=t),
  bumpReporter:async(u,g,b)=>{const r=db.reporters.get(u)||{good:0,bad:0,trusted:false};r.good+=g;r.bad+=b;db.reporters.set(u,r);return {...r}},
  createLinkCode:async(c,u)=>db.codes.push({c,u}),
  dmTargets:async()=>db.targets,
  postsSince:async()=>[...db.posts.values()],
 };
 let ids=0;
 return {discord,store,db,sent,edits,dms,threads,roleAdds,deps:{discord,store,env:{CARDSTEAD_URL:'https://pokeflip-studio.vercel.app/',AMAZON_ASSOCIATE_TAG:'cardstead-20',DISCORD_APP_ID:'APP'},now:()=>now.t,fetch:async()=>({ok:false}),uuid:()=>'u'+(++ids),random:n=>Array.from({length:n},(_,i)=>i*7)}};
}

test('events from the pipeline are checked before anything is posted',async()=>{
 const C=await load('discord-core.mjs');
 assert.equal(C.normalizeEvent(ev()).price_cad,94.99);
 assert.throws(()=>C.normalizeEvent(ev({product_lang:'DE'})),/product_lang/);
 assert.throws(()=>C.normalizeEvent(ev({region:null})),/region/);
 assert.throws(()=>C.normalizeEvent(ev({chain_key:'target'})),/chain/);
 assert.equal(C.normalizeEvent(ev({url:'http://evil.test/'})).url,null,'only https links');
});

test('one ping per restock, 30-minute cooldown, sold out edits the same message',async()=>{
 const C=await load('discord-core.mjs');const e=C.normalizeEvent(ev());
 assert.deepEqual([C.planAlert(e,null,T0).action,C.planAlert(e,null,T0).ping],['post',true]);
 const live={state:'live',pinged_at:new Date(T0).toISOString()};
 assert.equal(C.planAlert(e,live,T0+60000).action,'edit');
 assert.equal(C.planAlert(e,live,T0+60000).ping,false);
 assert.equal(C.planAlert({...e,in_stock:false},live,T0).state,'sold_out');
 assert.equal(C.planAlert({...e,in_stock:false},null,T0).action,'skip');
 const out={state:'sold_out',pinged_at:new Date(T0).toISOString()};
 assert.deepEqual([C.planAlert(e,out,T0+10*60000).action,C.planAlert(e,out,T0+10*60000).ping],['edit',false],'back inside 30 min: no new ping');
 assert.deepEqual([C.planAlert(e,out,T0+31*60000).action,C.planAlert(e,out,T0+31*60000).ping],['post',true]);
 assert.equal(C.planAlert({...e,confidence:'low'},null,T0).action,'skip','low confidence is never posted');
 const mk=C.planAlert({...e,price_cad:149.99},null,T0);
 assert.deepEqual([mk.action,mk.ping,mk.marketplace],['post',false,true],'above 1.3x MSRP is a marketplace price, no ping');
 assert.equal(C.planAlert({...e,seller:'marketplace'},null,T0).ping,false);
});

test('alert card: bilingual, CA$ verdict, seller, confidence, role ping only, Wasn\'t there button',async()=>{
 const C=await load('discord-core.mjs');const e=C.normalizeEvent(ev());
 const m=C.alertMessage(e,'live',{ping:true,roleIds:{ETB:'R-etb'},postId:'p1',siteUrl:'https://pokeflip-studio.vercel.app/'});
 assert.equal(m.content,'<@&R-etb>');
 assert.deepEqual(m.allowed_mentions,{parse:[],roles:['R-etb']},'never @everyone');
 const em=m.embeds[0],f=Object.fromEntries(em.fields.map(x=>[x.name,x.value]));
 assert.equal(em.title,'Restock · Retour en stock');
 assert.match(f['Price · Prix'],/^CA\$94\.99$/);
 assert.match(f['Value · Valeur'],/Under value by CA\$12\.01\nSous la valeur/);
 assert.match(f['Seller · Vendeur'],/The store/);
 assert.match(f['Confidence · Confiance'],/High · Élevée\nshop data seen twice/);
 assert.match(f['First seen · Vu'],/^<t:\d+:R>$/);
 const b=m.components[0].components;
 assert.deepEqual(b.map(x=>x.label),['Open at store · Ouvrir','View in Cardstead',"Wasn't there · Pas là"]);
 assert.equal(b[2].custom_id,'wt:p1');
 const sold=C.alertMessage(e,'sold_out',{postId:'p1'});
 assert.equal(sold.embeds[0].title,'Sold out · Épuisé');assert.equal(sold.content,'');
 assert.ok(!sold.components[0]?.components.some(x=>x.custom_id),'no button on a sold-out card');
 const jp=C.normalizeEvent(ev({product_lang:'JP',product_kind:'booster_box'}));assert.equal(C.productRole(jp),'Japanese & Asian');
});

test('Amazon: no price unless from Amazon\'s API, tagged link, disclosure',async()=>{
 const C=await load('discord-core.mjs');
 const a=C.normalizeEvent(ev({chain_key:'amazon-ca',region:null,store_key:'amazon',store_name:'Amazon.ca',url:'https://www.amazon.ca/dp/B0TEST',source:'retailer_email'}));
 const m=C.alertMessage(a,'live',{amazonTag:'cardstead-20'}),f=Object.fromEntries(m.embeds[0].fields.map(x=>[x.name,x.value]));
 assert.match(f['Price · Prix'],/Check price at Amazon/);
 assert.match(m.embeds[0].footer.text,/As an Amazon Associate I earn from qualifying purchases\./);
 assert.equal(m.components[0].components[0].url,'https://www.amazon.ca/dp/B0TEST?tag=cardstead-20');
 const api=C.alertMessage({...a,source:'amazon_api'},'live',{});
 assert.match(api.embeds[0].fields[1].value,/CA\$94\.99/);
 assert.equal(C.alertMessage(C.normalizeEvent(ev()),'live',{amazonTag:'x'}).components[0].components[0].url,'https://www.boutiquefdb.com/products/dr-etb','tag only on amazon.ca');
});

test('value verdict uses the same 5% band as the app',async()=>{
 const C=await load('discord-core.mjs');
 assert.equal(C.verdict(100,100,null).key,'fair');assert.equal(C.verdict(104,100,null).key,'fair');
 assert.equal(C.verdict(90,100,null).key,'under');assert.equal(C.verdict(120,100,100).key,'over');
 assert.equal(C.verdict(160,100,100).key,'scalper');assert.equal(C.verdict(50,null,null).key,'unknown');
});

test('publisher posts to the region channel, dedupes, and DMs only linked members whose watch matches',async()=>{
 const {service}=await load('discord-service.mjs');const now={t:T0};const F=fakes(now);
 F.db.targets=[{discord_user_id:'D1',watches:[{product:'Delta Reign ETB',enabled:true,ceiling:100,language:'en',format:'etb'}]},{discord_user_id:'D2',watches:[{product:'Delta Reign ETB',enabled:true,ceiling:80,language:'any',format:'any'}]},{discord_user_id:'D3',watches:[{product:'Pitch Black ETB',enabled:true,ceiling:200,language:'any',format:'any'}]}];
 F.db.events.push(ev(),ev({id:'e2'}),ev({id:'e3',product_lang:'XX'}));
 const out=await service(F.deps).publishPending();
 assert.match(out[0].outcome,/^posted: restock, pinged, 1 DM/);
 assert.match(out[1].outcome,/^edited: still in stock/);
 assert.match(out[2].outcome,/^rejected/);
 assert.equal(F.sent.length,1);assert.equal(F.sent[0].ch,'C-mtl');
 assert.deepEqual(F.dms.map(d=>d.u),['D1'],'D2 max price too low, D3 other product');
 assert.ok(F.dms[0].msg.components[0].components.every(b=>b.style===5),'no Wasn\'t there button in DMs');
 now.t+=5*60000;F.db.events.push(ev({id:'e4',in_stock:false}));await service(F.deps).publishPending();
 assert.equal(F.edits.at(-1).msg.embeds[0].title,'Sold out · Épuisé');
 now.t+=40*60000;F.db.events.push(ev({id:'e5',first_seen_at:new Date(now.t).toISOString()}));const o5=await service(F.deps).publishPending();
 assert.match(o5[0].outcome,/pinged/,'a new restock after the cooldown pings again');
 assert.equal(F.sent.length,2);
});

test('Wasn\'t there: two members mark the alert stale and count against the reporter',async()=>{
 const {service}=await load('discord-service.mjs');const now={t:T0};const F=fakes(now);
 F.db.events.push(ev({source:'member_report',reporter_id:'REP'}));const bot=service(F.deps);await bot.publishPending();
 const postId=[...F.db.posts.keys()][0];
 const click=u=>bot.interaction({type:3,guild_id:'G',member:{user:{id:u},roles:[]},data:{custom_id:'wt:'+postId}});
 let r=await click('A');await r.after();r=await click('A');await r.after();
 assert.equal(F.db.posts.get(postId).state,'live','the same member twice counts once');
 r=await click('B');await r.after();
 assert.equal(F.db.posts.get(postId).state,'stale');
 assert.equal(F.edits.at(-1).msg.embeds[0].title,'Reported not there · Signalé absent');
 assert.equal(F.db.reporters.get('REP').bad,1);
});

test('member reports: checks, second-member confirmation, 30-minute expiry, trusted reporters',async()=>{
 const C=await load('discord-core.mjs');const {service}=await load('discord-service.mjs');
 const base={product:'Delta Reign ETB',store:'Walmart Laval',region:'qc-montreal',chain:'walmart',price:69.97,link:'https://www.walmart.ca/x'};
 assert.match(C.validateReport(base,youngUser(T0),T0).error,/7 days/);
 assert.match(C.validateReport({...base,link:undefined},OLD_USER,T0).error,/link or a photo/);
 assert.match(C.validateReport({...base,link:'http://x.test'},OLD_USER,T0).error,/https/);
 assert.equal(C.validateReport(base,OLD_USER,T0).report.product_kind,'etb');
 const now={t:T0};const F=fakes(now);const bot=service(F.deps);
 const cmd=(u,roles=[])=>bot.interaction({type:2,guild_id:'G',token:'tok',member:{user:{id:u},roles},data:{name:'report',options:Object.entries(base).map(([name,value])=>({name,value}))}});
 let r=await cmd(OLD_USER);assert.equal(r.response.type,5);await r.after();
 assert.equal(F.threads.length,1);assert.equal(F.threads[0].ch,'C-rep');
 const rep=[...F.db.reports.values()][0];assert.equal(rep.status,'pending');
 const confirm=(u,roles=[])=>bot.interaction({type:3,guild_id:'G',member:{user:{id:u},roles},data:{custom_id:'rc:'+rep.id}});
 assert.match((await confirm(OLD_USER)).response.data.content,/second member/,'reporter cannot confirm');
 assert.match((await confirm(youngUser(T0))).response.data.content,/7 days/);
 r=await confirm(OLD_USER2);assert.equal(r.response.type,7);await r.after();
 assert.equal(F.db.reports.get(rep.id).status,'confirmed');
 const e=F.db.events.at(-1);assert.deepEqual([e.source,e.confidence,e.chain_key],['member_report','high','walmart']);
 assert.equal(F.db.reporters.get(OLD_USER).good,1);
 assert.match((await confirm('720000000000000000')).response.data.content,/closed/);
 r=await cmd(OLD_USER);await r.after();const rep2=[...F.db.reports.values()].at(-1);
 now.t+=31*60000;await bot.expireReports();
 assert.equal(F.db.reports.get(rep2.id).status,'expired');
 assert.match(F.edits.at(-1).msg.embeds[0].title,/Expired/);
 const before=F.db.events.length;r=await cmd(OLD_USER,['R-trust']);await r.after();
 assert.equal(F.db.events.length,before+1);assert.equal(F.db.events.at(-1).confidence,'medium','trusted reports post at Medium without waiting');
});

test('reporters become trusted after 10 good reports, not with many false ones',async()=>{
 const C=await load('discord-core.mjs');
 assert.equal(C.isTrustedNow({good:10,bad:0}),true);assert.equal(C.isTrustedNow({good:9,bad:0}),false);assert.equal(C.isTrustedNow({good:12,bad:4}),false);
});

test('weekly speed log: median minutes and false-alert share per store',async()=>{
 const C=await load('discord-core.mjs');
 const p=(s,mins,state='live')=>({store_name:s,first_seen_at:new Date(T0).toISOString(),posted_at:new Date(T0+mins*60000).toISOString(),state});
 const {rows,message}=C.speedLog([p('Boutique FDB',1),p('Boutique FDB',3),p('Boutique FDB',2,'stale'),p('Walmart',20)],T0);
 assert.deepEqual(rows[0],{store:'Boutique FDB',alerts:3,minutes:2,stale:1});
 assert.match(message.embeds[0].description,/Boutique FDB\*\* · 3 alert\(s\) · 2 min median · 33% wasn't there/);
});

test('price check: CAD from TCGplayer and Cardmarket, confidence from agreement, query parsing',async()=>{
 const C=await load('discord-core.mjs');
 const card={name:'Umbreon VMAX',localId:'215',set:{name:'Evolving Skies',cardCount:{official:203}},pricing:{tcgplayer:{unit:'USD',updated:'2026-11-23',holofoil:{marketPrice:2000}},cardmarket:{unit:'EUR',trend:1700}}};
 const q=C.priceQuotes(card,{USD:1.4,EUR:1.55});
 assert.equal(Math.round(q.quotes[0].cad),2800);assert.equal(q.confidence,'high');
 assert.equal(C.priceQuotes({pricing:{tcgplayer:{holofoil:{marketPrice:100}},cardmarket:{trend:200}}},{USD:1,EUR:1}).confidence,'low');
 assert.deepEqual(C.parseCardQuery('umbreon vmax 215/203'),{name:'umbreon vmax',number:'215'});
 assert.deepEqual(C.parseCardQuery('charizard'),{name:'charizard',number:null});
 const m=C.priceMessage(card,q.quotes,q.confidence,'fr','https://x.test/');
 assert.match(m.embeds[0].description,/not Canadian sales/);assert.match(m.embeds[0].footer.text,/English listing/);
});

test('interactions are signature-checked; publisher needs the service role key',async()=>{
 const {verifySignature}=await load('discord-api.mjs');const {isServiceRole}=await load('discord-auth.mjs');
 const {subtle}=globalThis.crypto;const kp=await subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const pub=Buffer.from(await subtle.exportKey('raw',kp.publicKey)).toString('hex');
 const body='{"type":1}',ts='1700000000';
 const sig=Buffer.from(await subtle.sign({name:'Ed25519'},kp.privateKey,new TextEncoder().encode(ts+body))).toString('hex');
 assert.equal(await verifySignature(pub,sig,ts,body),true);
 assert.equal(await verifySignature(pub,sig,ts,body+' '),false);
 assert.equal(await verifySignature(pub,'00'.repeat(64),ts,body),false);
 assert.equal(await verifySignature('',sig,ts,body),false);
 assert.equal(isServiceRole('Bearer secret-key','secret-key'),true);
 assert.equal(isServiceRole('Bearer secret-kez','secret-key'),false);
 assert.equal(isServiceRole(null,'secret-key'),false);assert.equal(isServiceRole('Bearer x',''),false);
});

test('rate limits: the client waits as Discord asks instead of retrying at once',async()=>{
 const {discordClient}=await load('discord-api.mjs');const waits=[];let calls=0;
 const fetch=async()=>(++calls===1?{status:429,ok:false,json:async()=>({retry_after:1.5})}:{status:200,ok:true,text:async()=>'{"id":"M1"}'});
 const c=discordClient({token:'t',appId:'a',fetch,wait:async ms=>waits.push(ms)});
 assert.deepEqual(await c.send('C',{content:'x'}),{id:'M1'});assert.deepEqual(waits,[1500]);
});

test('setup creates roles, read-only alert channels and spam rules, and is safe to run twice',async()=>{
 const {service}=await load('discord-service.mjs');const now={t:T0};const F=fakes(now);
 const roles=[],chans=[],rules=[];let cmds=null;
 Object.assign(F.discord,{roles:async()=>roles.map((r,i)=>({id:'R'+i,name:r.name})),channels:async()=>chans.map((c,i)=>({id:'C'+i,...c})),createRole:async(g,r)=>{roles.push(r);return r},createChannel:async(g,c)=>{chans.push(c);return {id:'C'+(chans.length-1)}},registerCommands:async(g,c)=>{cmds=c},automodRules:async()=>rules,createAutomod:async(g,r)=>{rules.push(r)}});
 const bot=service(F.deps);await bot.setup();
 const names=chans.map(c=>c.name);
 for(const n of ['qc-montreal','on-gta','online-canada','pokemon-center','amazon-ca','report-a-drop','general','général','speed-log','mod-queue'])assert.ok(names.includes(n),n);
 const mtl=chans.find(c=>c.name==='qc-montreal');const everyone=mtl.permission_overwrites.find(p=>p.id==='G');
 assert.ok(BigInt(everyone.deny)&(1n<<10n),'region channel hidden from members without the region role');
 const welcome=chans.find(c=>c.name==='bienvenue-welcome').permission_overwrites.find(p=>p.id==='G');
 assert.ok(BigInt(welcome.deny)&(1n<<11n),'alert and info channels are read-only');
 assert.equal(chans.find(c=>c.name==='report-a-drop').type,15);
 assert.ok(roles.every(r=>r.mentionable===false),'members cannot ping roles');
 assert.deepEqual(cmds.map(c=>c.name),['price','prix','report','link','flag']);
 assert.equal(rules.length,3);
 const counts=[roles.length,chans.length,rules.length];await bot.setup();
 assert.deepEqual([roles.length,chans.length,rules.length],counts,'second run creates nothing');
});

test('/link gives a one-time code; the Settings panel accepts only that shape',async()=>{
 const {service}=await load('discord-service.mjs');const F=fakes({t:T0});
 const r=await service(F.deps).interaction({type:2,guild_id:'G',member:{user:{id:OLD_USER},roles:[]},data:{name:'link'}});
 const code=r.response.data.content.match(/\*\*([A-Z2-9]{8})\*\*/)[1];assert.equal(r.response.data.flags,64,'only the member sees it');
 assert.deepEqual(F.db.codes,[{c:code,u:OLD_USER}]);
 require('../discord-link.js');const L=globalThis.CardsteadDiscordCore;
 assert.equal(L.cleanCode(' '+code.toLowerCase()+' '),code);assert.equal(L.cleanCode('ABC'),'');assert.equal(L.cleanCode('ABCDEFG1'),'','no I, O, 0 or 1');
 assert.match(L.statusText({linked:true,dms_enabled:false}),/DMs are off/);
});

test('database: every Discord table has RLS on and nothing is granted to anonymous visitors',()=>{
 const sql=fs.readFileSync(path.join(ROOT,'migrations/002-discord-drops.sql'),'utf8');
 const tables=[...sql.matchAll(/create table if not exists public\.(\w+)/g)].map(m=>m[1]);
 assert.deepEqual(tables,['drop_events','discord_posts','discord_wasnt_there','discord_reports','discord_reporters','discord_link_codes','discord_links']);
 assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on public\.%I from public, anon, authenticated/);
 assert.doesNotMatch(sql,/grant [^;]* to anon/i);
 assert.doesNotMatch(sql,/create policy/i,'no policies: only the service role reads these tables');
 assert.match(sql,/discord_dm_targets[\s\S]*where l\.dms_enabled/,'DMs only for members who turned them on');
 const cfg=fs.readFileSync(path.join(ROOT,'supabase/config.toml'),'utf8');assert.match(cfg,/discord-interactions\]\nverify_jwt = false/);
 for(const f of ['discord-interactions','discord-publisher'])assert.doesNotMatch(fs.readFileSync(path.join(ROOT,'supabase/functions',f,'index.ts'),'utf8'),/sk_|Bot [A-Za-z0-9]{20}/,'no token in code');
});
