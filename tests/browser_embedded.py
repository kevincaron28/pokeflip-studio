"""Chromium UI acceptance without network navigation (blocked in this runner).
Uses isolated in-memory localStorage; not a test of real persistence or network.
"""
from pathlib import Path
import tempfile
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
 page.on('pageerror', lambda e:errors.append(str(e)))
 page.set_content(head,wait_until='domcontentloaded',timeout=6000)
 page.evaluate("""() => {let data=new Map(); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>Array.from(data.keys())[i]||null,get length(){return data.size}}});}""")
 for script in scripts:
  page.add_script_tag(content=(ROOT/script).read_text(encoding='utf-8'))
 page.wait_for_timeout(500)
 assert not errors, errors
 assert page.locator('#metrics .metric').count()==4
 assert page.locator('#cloudConfigure').count()==1
 assert page.locator('#alertsRows').count()==1
 for tab in page.locator('.tab').all():
  tab.click(timeout=5000)
  section=tab.get_attribute('data-tab')
  assert page.locator(f'section#{section}').is_visible(),section
 print("start lots",flush=True);page.locator('[data-tab="lots"]').click(timeout=5000)
 page.locator('#lotForm [name="name"]').fill('QA Test Collection')
 page.locator('#lotForm [name="cost"]').fill('85')
 page.locator('#lotForm [name="source"]').fill('Local')
 page.locator('#lotForm button').click(timeout=2500)
 db=page.evaluate("JSON.parse(localStorage.getItem('pokeflip-v1'))")
 assert db['lots'][0]['cost']==85
 page.locator('#bulkLot').select_option(db['lots'][0]['id'])
 page.locator('#bulkLang').select_option('fr')
 page.locator('#bulkType').select_option(index=1)
 page.locator('#bulkQty').fill('100')
 page.locator('#bulkForm button').click()
 db=page.evaluate("JSON.parse(localStorage.getItem('pokeflip-v1'))")
 assert db['items'][0]['qty']==100
 page.locator('[data-tab="dashboard"]').click()
 assert page.locator(".portfolio-heading").count()==1
 assert not errors,errors
 page.screenshot(path=str(Path(tempfile.gettempdir())/'pokeflip-embedded-browser-qa.png'),full_page=True)
 # A large physical collection must not create thousands of inventory DOM rows at once.
 page.evaluate('''() => {
   const d=window.pokeflipLedger.getData(); const seed=d.items[0];
   const items=Array.from({length:1200},(_,i)=>({...seed,id:'volume-'+i,name:'Card #'+i,qty:1}));
   window.pokeflipLedger.replaceFromCloud({lots:d.lots,items,sales:[]},[]);
 }''')
 page.locator('[data-tab="inventory"]').click()
 assert page.locator('#inventoryTable tbody tr').count()==100
 assert 'Showing 100 of 1200' in page.locator('#inventoryTable').inner_text()
 page.locator('[data-loadinventory]').click()
 assert page.locator('#inventoryTable tbody tr').count()==200
 page.locator('#inventorySearch').fill('Card #1199')
 assert page.locator('#inventoryTable tbody tr').count()==1
 assert page.locator('[data-loadinventory]').count()==0
 # Regression: CSV rows without a readable language must go to Review, never silently become French.
 page.evaluate('''()=>{window.pokeflipLedger.replaceFromCloud({lots:window.pokeflipLedger.getData().lots,items:[],sales:[]},[])}''')
 page.locator('#importCsv').set_input_files(files=[{'name':'in.csv','mimeType':'text/csv','buffer':b'name,qty,language,category\nBlank lang,1,,single\nEnglish card,2,English,single\nFrench card,1,fr,single\nBad qty,0,en,single\n'}])
 page.wait_for_timeout(300)
 rows={i['name']:i for i in page.evaluate("window.pokeflipLedger.getData().items")}
 assert set(rows)=={'Blank lang','English card','French card'},rows.keys()
 assert rows['Blank lang']['category']=='review' and rows['Blank lang']['status']=='unsorted'
 assert rows['English card']['lang']=='en' and rows['English card']['category']=='single'
 assert rows['French card']['lang']=='fr'
 assert 'Review' in page.locator('#toast').inner_text() and 'skipped' in page.locator('#toast').inner_text()
 # Regression: Android Chrome throws on new Notification(); a granted permission must not surface an error.
 page.evaluate('''()=>{Object.defineProperty(Notification,'permission',{configurable:true,get:()=>'granted'});window.Notification=function(){throw new TypeError('Illegal constructor')};window.Notification.permission='granted'}''')
 page.locator('[data-tab="restock"]').click()
 page.locator('#restockProduct').fill('Test ETB');page.locator('#restockCeiling').fill('60');page.locator('#restockWatchForm button[type=submit]').click()
 page.locator('#restockWatchSelect').select_option(index=1);page.locator('#restockStatus').select_option('in');page.locator('#restockPrice').fill('50');page.locator('#restockStore').fill('Test store')
 page.locator('#restockRecordForm button[type=submit]').click();page.wait_for_timeout(300)
 assert 'Potential restock' in page.locator('#restockMessage').inner_text(),page.locator('#restockMessage').inner_text()
 assert not errors,errors
 print('PASS: Large collection (1,200 entries) paginates 100 at a time and filters by card name')
 print('PASS: Chromium mobile-width render, all tab navigation, lot creation, bulk inventory, dashboard; 0 runtime exceptions')
 print('LIMITATION: localStorage shim; no live network, production site, OAuth or actual device camera tested')
 browser.close()
