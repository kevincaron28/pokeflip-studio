"""Chromium UI acceptance without network navigation (blocked in this runner).
Uses isolated in-memory localStorage; not a test of real persistence or network.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
head=html.split('<script src=')[0]+'</body></html>'
scripts=re.findall(r'<script src="\./([^"]+)"',html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844})
 errors=[]
 page.on('pageerror', lambda e:errors.append(str(e)))
 page.set_content(head,wait_until='domcontentloaded',timeout=6000)
 page.evaluate("""() => {let data=new Map(); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>Array.from(data.keys())[i]||null,get length(){return data.size}}});}""")
 for script in scripts:
  page.add_script_tag(content=(ROOT/script).read_text())
 page.wait_for_timeout(500)
 assert not errors, errors
 assert page.locator('#metrics .metric').count()==4
 assert page.locator('#cloudConfigure').count()==1
 assert page.locator('#alertsRows').count()==1
 for tab in page.locator('.tab').all():
  tab.click(timeout=1800)
  section=tab.get_attribute('data-tab')
  assert page.locator(f'section#{section}').is_visible(),section
 print("start lots",flush=True);page.locator('[data-tab="lots"]').click(timeout=1800)
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
 page.screenshot(path='/mnt/data/pokeflip-embedded-browser-qa.png',full_page=True)
 print('PASS: Chromium mobile-width render, all tab navigation, lot creation, bulk inventory, dashboard; 0 runtime exceptions')
 print('LIMITATION: localStorage shim; no live network, production site, OAuth or actual device camera tested')
 browser.close()
