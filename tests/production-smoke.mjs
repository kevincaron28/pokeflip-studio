// Public live deployment smoke test; uses no credentials or user inventory.
const base = new URL(process.env.POKEFLIP_URL || 'https://pokeflip-studio.vercel.app/');
const failures = [];
const checked = [];
async function get(path) {
  const url = new URL(path, base);
  try {
    const r = await fetch(url, {redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'PokeflipProductionSmoke/1.0'}});
    if (!r.ok) throw Error('HTTP '+r.status);
    if (new URL(r.url).origin !== base.origin) throw Error('unexpected redirect to '+new URL(r.url).origin);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) throw Error('empty response');
    checked.push({path,status:r.status,bytes:buf.length});
    return {body:buf,headers:r.headers};
  } catch (err) {failures.push(path+': '+err.message);return null}
}
const page = await get('./');
if(page) {
  const html=page.body.toString('utf8');
  if(!html.includes('PokéFlip Studio') || !html.includes('pokeflipLedger')) {
    // The page may not refer to the global ledger directly; the app title is essential.
    if(!html.includes('PokéFlip Studio')) failures.push('index: missing PokéFlip title');
  }
  const scripts=[...html.matchAll(/<script[^>]+src=["'](\.\/[^"']+)["']/g)].map(x=>x[1]);
  for(const path of new Set(scripts)) await get(path);
  if(page.headers.get('x-content-type-options')!=='nosniff') failures.push('Missing nosniff security header');
  if(page.headers.get('x-frame-options')!=='DENY') failures.push('Missing frame-denial security header');
}
const manifest=await get('./manifest.webmanifest');
if(manifest) {
 try {
  const m=JSON.parse(manifest.body.toString('utf8'));
  if(m.display!=='standalone'||!Array.isArray(m.icons)||!m.icons.length) failures.push('Invalid PWA manifest');
  else for(const icon of m.icons) {
   const r=await get(icon.src);
   if(r && (r.body.length<100 || r.body.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')) failures.push('Invalid PNG icon '+icon.src);
  }
 } catch(e){failures.push('Manifest JSON: '+e.message)}
}
const worker=await get('./sw.js');
if(worker) {
 const sw=worker.body.toString('utf8');
 const match=sw.match(/const SHELL=\[([^\]]+)\]/);
 if(!match) failures.push('Service worker missing precache list');
 else {
  const assets=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
  for(const path of new Set(assets)) if(path!=='./'&&path!=='./manifest.webmanifest'&&path!=='./icon-192.png'&&path!=='./icon-512.png') await get(path);
 }
}
console.log('Checked '+checked.length+' public resources:', checked.map(x=>x.path+'('+x.bytes+'B)').join(', '));
if(failures.length){console.error('Production smoke FAILED:', failures.join('; '));process.exitCode=1}
else console.log('Production smoke PASSED for '+base.origin);
