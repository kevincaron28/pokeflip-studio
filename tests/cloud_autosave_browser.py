"""Browser acceptance for owner-isolated cloud sync using deterministic fake Supabase RPC.
This tests app interactions and revision conflicts, NOT live Supabase authentication.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text(encoding='utf-8')
head=html.split('<script src=')[0]+'</body></html>'
scripts=re.findall(r'<script src="\./([^"]+)"',html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844})
 errors=[]
 page.on('pageerror',lambda err: errors.append(str(err)))
 page.set_default_timeout(4000)
 page.set_content(head,wait_until='domcontentloaded')
 page.evaluate("""() => {
  let data=new Map();
  Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear()}});
  window.confirm=()=>true;
  const user={id:'test-user-a',email:'test@example.invalid'};
  const state=window.fakeCloud={revision:0,payload:null,rpcCalls:0};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const api={auth:{getUser:async()=>({data:{user},error:null}),onAuthStateChange:cb=>{queueMicrotask(()=>cb('SIGNED_IN',{user}));return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({error:null})},
   from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:state.revision?{revision:state.revision,payload:clone(state.payload)}:null,error:null})})})}),
   rpc:async(name,{expected_revision,next_payload})=>{state.rpcCalls++;if(name!=='pokeflip_save_snapshot'||state.revision!==expected_revision)return {data:null,error:{message:'SYNC_CONFLICT'}};state.revision++;state.payload=clone(next_payload);return {data:state.revision,error:null}}};
  window.supabase={createClient:()=>api};
 }""")
 for script in scripts:
  page.add_script_tag(content=(ROOT/script).read_text(encoding='utf-8'))
 page.wait_for_timeout(200)
 page.locator('[data-tab="settings"]').click()
 print('Cloud:',page.locator('#cloudStatus').inner_text(),'visible:',page.locator('#cloudPush').is_visible(),'enabled:',page.locator('#cloudPush').is_enabled(),'errors:',errors,flush=True)
 page.locator('#cloudPush').click()
 page.wait_for_function("window.fakeCloud.revision===1")
 page.locator('#cloudAutoToggle').click()
 page.wait_for_function("localStorage.getItem('pokeflip-cloud-autosave-v1')!==null")
 page.locator('[data-tab="lots"]').click()
 page.locator('#lotForm [name="name"]').fill('Autobackup lot')
 page.locator('#lotForm [name="cost"]').fill('60')
 page.locator('#lotForm button').click()
 page.wait_for_function("window.fakeCloud.revision===2",timeout=12000)
 assert page.evaluate("window.fakeCloud.payload.ledger.lots.length") == 1
 # A second device changes the cloud revision; the next local edit MUST NOT overwrite it.
 page.evaluate("window.fakeCloud.revision++")
 page.locator('[data-tab="lots"]').click()
 page.locator('#lotForm [name="name"]').fill('Conflicting local lot')
 page.locator('#lotForm [name="cost"]').fill('10')
 page.locator('#lotForm button').click()
 page.wait_for_function("localStorage.getItem('pokeflip-cloud-autosave-v1')===null",timeout=12000)
 assert page.evaluate("window.fakeCloud.revision") == 3
 assert page.evaluate("window.fakeCloud.payload.ledger.lots.length") == 1
 assert 'another device changed' in page.locator('#cloudStatus').inner_text().lower()
 assert not errors,errors
 print('PASS: First cloud upload, opt-in autosave and strict revision conflict stop; no runtime errors')
 browser.close()
