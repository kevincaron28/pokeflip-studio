// Shop checker outside Supabase (Oracle VM): pacing, the 429 probe, the scoped database calls, settings that refuse
// secret keys, and the install files (memory limits, key made on the server and never printed).
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const S=()=>import('../supabase/functions/_shared/shop-checker.mjs');
const R=(...p)=>path.join(__dirname,'..',...p);
const shops=n=>Array.from({length:n},(_,i)=>({host:`shop${i}.example.ca`,name:'Shop '+i,region:'qc-montreal'}));
const memStore=()=>({states:[],shopStates:async function(){return this.states},saveShopState:async()=>{},shopStock:async()=>[],saveShopStock:async()=>{},insertEvent:async()=>{}});

test('pacing: concurrency 1 with a gap reads one shop at a time and pauses between shops, not before the first',async()=>{
 const {runPass}=await S();const log=[];let active=0,maxActive=0;
 const fetch=async url=>{active++;maxActive=Math.max(maxActive,active);log.push('get '+new URL(url).host);await new Promise(r=>setTimeout(r,2));active--;return {status:429,ok:false,headers:new Map()}};
 const r=await runPass({store:memStore(),fetch,now:()=>0,shops:shops(3),catalogue:{sets:[]},concurrency:1,gapMs:3000,sleep:async ms=>log.push('wait '+ms)});
 assert.equal(maxActive,1);assert.equal(r.refused,3);
 assert.deepEqual(log,['get shop0.example.ca','wait 3000','get shop1.example.ca','wait 3000','get shop2.example.ca']);
});

test('probe: one small request per shop, a gap between them, statuses counted, nothing saved',async()=>{
 const {probeShops,UA}=await S();const seen=[],waits=[];
 const fetch=async(url,o)=>{seen.push([url,o.headers['user-agent']]);const h=new URL(url).host;return {status:h.startsWith('shop1')?429:200,headers:new Map([['retry-after',h.startsWith('shop1')?'60':null]])}};
 const r=await probeShops({fetch,shops:shops(3),gapMs:4000,sleep:async ms=>waits.push(ms)});
 assert.deepEqual(r.byStatus,{200:2,429:1});assert.equal(r.results[1].retryAfter,'60');assert.deepEqual(waits,[4000,4000]);
 assert.equal(seen[0][0],'https://shop0.example.ca/products.json?limit=1');assert.equal(seen[0][1],UA);
});

test('the VM store calls only the checker_* functions, with the public key and the checker key',async()=>{
 const {checkerRpcStore}=await S();const calls=[];
 const fetch=async(url,o)=>{calls.push({url,headers:o.headers,body:JSON.parse(o.body)});return {ok:true,text:async()=>url.endsWith('checker_states')?'[{"host":"a.ca"}]':''}};
 const st=checkerRpcStore({url:'https://x.supabase.co',publishableKey:'sb_publishable_abc',checkerKey:'k'.repeat(64),fetch});
 assert.deepEqual(await st.shopStates(),[{host:'a.ca'}]);
 await st.saveShopState({host:'a.ca'});await st.shopStock('a.ca');await st.saveShopStock([{x:1}]);await st.insertEvent({source:'shop_check'});
 assert.deepEqual(calls.map(c=>c.url.split('/rpc/')[1]),['checker_states','checker_save_state','checker_stock','checker_save_stock','checker_add_event']);
 assert.ok(calls.every(c=>c.headers.apikey==='sb_publishable_abc'&&c.body.p_key==='k'.repeat(64)));
 assert.deepEqual(calls[2].body,{p_key:'k'.repeat(64),p_host:'a.ca'});
 const bad=checkerRpcStore({url:'https://x.supabase.co',publishableKey:'p',checkerKey:'k',fetch:async()=>({ok:false,status:403,text:async()=>'checker key not accepted'})});
 await assert.rejects(bad.shopStates(),/checker_states -> 403/);
});

test('VM settings: the three values are required, a secret key is refused, pacing is bounded',async()=>{
 const {settings}=await import('../deploy/shop-checker/run.mjs');
 const ok={SUPABASE_URL:'https://fehvorwdcswhhonavyit.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_x',CHECKER_KEY:'a'.repeat(64)};
 assert.throws(()=>settings({}),/SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CHECKER_KEY/);
 assert.throws(()=>settings({...ok,SUPABASE_PUBLISHABLE_KEY:'sb_secret_abc'}),/never a secret key/);
 assert.throws(()=>settings({...ok,SUPABASE_URL:'http://evil.example'}),/supabase\.co/);
 const s=settings({...ok,CHECKER_CONCURRENCY:'50',CHECKER_GAP_MS:'-5'});assert.equal(s.concurrency,6);assert.equal(s.gapMs,0);assert.equal(s.maxShops,45);
});

test('migration 006: only the hash is stored; functions check the key; events are shop_check from a store only',()=>{
 const sql=fs.readFileSync(R('migrations/006-checker-key.sql'),'utf8');
 assert.match(sql,/token_hash text not null unique check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
 assert.match(sql,/alter table public\.checker_keys enable row level security/);
 assert.equal((sql.match(/perform public\.checker_auth\(p_key\);/g)||[]).length,5,'every checker function checks the key');
 assert.match(sql,/e\.source is distinct from 'shop_check' or e\.seller is distinct from 'store' or e\.confidence = 'high'/);
 assert.match(sql,/revoke all on function public\.checker_auth\(text\) from public, anon, authenticated/);
 assert.doesNotMatch(sql,/disable row level security/i);
});

test('install files: memory-capped low-priority service, key made on the server and never printed, timer off until the owner turns it on',()=>{
 const unit=fs.readFileSync(R('deploy/shop-checker/cardstead-checker.service'),'utf8');
 for(const re of [/^User=cardstead$/m,/^EnvironmentFile=\/etc\/cardstead-checker\/checker\.env$/m,/^MemoryMax=192M$/m,/^Nice=15$/m,/^NoNewPrivileges=yes$/m,/^ProtectSystem=strict$/m]) assert.match(unit,re);
 const ex=fs.readFileSync(R('deploy/shop-checker/checker.env.example'),'utf8');
 assert.match(ex,/^CHECKER_KEY=$/m);assert.doesNotMatch(ex,/sb_secret_|service_role/);
 const inst=fs.readFileSync(R('deploy/shop-checker/install.sh'),'utf8');
 assert.match(inst,/openssl rand -hex 32/);assert.match(inst,/MemAvailable/);assert.doesNotMatch(inst,/echo[^\n]*\$\{?key\}?/,'the key is never echoed');
 assert.doesNotMatch(inst,/^\s*systemctl enable/m,'the owner turns the timer on after the first pass');
 try{execFileSync('bash',['-n',R('deploy/shop-checker/install.sh')]);execFileSync('bash',['-n',R('deploy/shop-checker/run.sh')])}catch(e){if(e.code!=='ENOENT')throw e}
});
