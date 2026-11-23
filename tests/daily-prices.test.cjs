const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const H=require('../price-history.js');
const day=s=>new Date(s+'T00:00:00Z');

test('prices refresh every day at a quiet hour in Québec, after tcgcsv.com updates',()=>{
 const w=read('.github/workflows/refresh-prices.yml');
 assert.match(w,/- cron: '30 8 \* \* \*'/,'08:30 UTC daily = 03:30 Eastern (04:30 in summer)');
 assert.ok(!/--backfill/.test(w),'CI never re-reads old archives');
 assert.match(w,/data\/price-refresh/,'one rolling pull request, not one per day');
 assert.match(w,/PRICE_REFRESH_PUBLISH/,'publishing to main only when the owner sets the variable');
});

test('the history builder keeps published points and downloads only new days, politely',()=>{
 const b=read('tools/build-price-history.py');
 assert.match(b,/def previous\(\)/);assert.match(b,/if not backfill: continue/);
 assert.match(b,/User-Agent": "Cardstead-PackEV\/1\.0"/);assert.match(b,/time\.sleep\(0\.25\)/);
});

test('price history: one point per day for 35 days, then Mondays to a year; small enough for phones',()=>{
 const d=H.dates;assert.equal(new Set(d).size,d.length,'one point per date');
 assert.deepEqual([...d].sort(),d);
 const last=day(d.at(-1));
 const recent=d.filter(x=>(last-day(x))/864e5<35),older=d.filter(x=>(last-day(x))/864e5>=35);
 assert.equal(recent.length,35,'every one of the last 35 days');
 assert.ok(older.every(x=>day(x).getUTCDay()===1),'older points are Mondays, so they never move');
 assert.ok((last-day(d[0]))/864e5<=365);
 assert.ok(older.length>=45,'about a year of weekly points for the 1y graph');
 assert.ok(fs.statSync(path.join(ROOT,'price-history.js')).size<450*1024);
 for(const v of Object.values(H.series))assert.equal(v.length,d.length);
 assert.equal(H.fx.length,d.length);
});
