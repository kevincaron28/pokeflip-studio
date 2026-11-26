"""Chromium UI acceptance without network navigation (blocked in this runner).
Uses isolated in-memory localStorage; not a test of real persistence or network.
Covers: the four tabs, My cards with data saved by an older version (nothing lost), editing a target and the
at-target flag, 1,200 cards shown 100 at a time, CSV rows with no readable language held as Not confirmed,
and a drop watch with the Android Notification regression.
"""
from pathlib import Path
import tempfile
import os
import json
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text(encoding='utf-8')
head=html.split('<script src=')[0]+'</body></html>'
scripts=re.findall(r'<script src="\./([^"]+)"',html)
AT='2026-11-24T10:00:00.000Z'
OLD={"lots":[{"id":"L1","name":"Old lot","cost":85,"date":"2026-11-01","source":"Local","notes":""}],
     "items":[{"id":"i1","lotId":"L1","name":"Pikachu ex","idCode":"sv08-057","lang":"fr","condition":"Near Mint","finish":"Holo","qty":2,"unitPrice":20,"unitCost":5,"location":"B","category":"single","status":"stored","image":"","created":"2026-11-02",
               "market":{"cad":18.5,"confidence":"medium","sources":[{"name":"TCGplayer","kind":"sold","date":"2026-11-23"}],"at":AT}},
              {"id":"i2","lotId":"L1","name":"Bulk Commons","idCode":"","lang":"en","condition":"Mixed / not graded","finish":"Mixed","qty":100,"unitPrice":0.05,"unitCost":None,"location":"D","category":"bulk","status":"stored","image":"","created":"2026-11-02"}],
     "sales":[{"id":"s1","itemId":"i1","qty":1,"gross":25,"fees":3,"ship":0,"date":"2026-11-10","channel":"Marketplace","costSnapshot":5}]}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},locale='en-CA')
 page.route("**/rpc/restock_feed", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"items":null}'))  # no live network
 errors=[]
 page.on('pageerror', lambda e:errors.append(str(e)))
 page.on('dialog', lambda d:d.accept())
 page.set_content(head,wait_until='domcontentloaded',timeout=6000)
 page.evaluate("""saved => {let data=new Map(Object.entries(saved)); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>Array.from(data.keys())[i]||null,get length(){return data.size}}}); window.fetch=()=>Promise.reject(new Error('offline test'))}""",
  {'pokeflip-v1':json.dumps(OLD),'cardstead-lang-v1':'"en"'})
 for script in scripts:
  page.add_script_tag(content=(ROOT/script).read_text(encoding='utf-8'))
 page.wait_for_timeout(500)
 assert not errors, errors
 assert page.locator('#cloudConfigure').count()==1
 assert page.locator('#alertsRows').count()==1
 assert page.evaluate("document.querySelector('main section:not(.hidden)').id")=='prices','Prices opens first'
 for tab in ['prices','restock','mycards','settings']:
  page.locator(f'.dock-item[data-dock="{tab}"]').click(timeout=5000)
  assert page.locator(f'section#{tab}').is_visible(),tab
 # My cards: the older version's card is there with its price; the bulk entry has no catalogue card; nothing lost.
 print("start My cards",flush=True);page.locator('.dock-item[data-dock="mycards"]').click()
 text=page.locator('#myCards').inner_text()
 assert 'Pikachu ex' in text and 'Bulk Commons' in text and '2 cards' in text,text
 assert '$18.50' in text and 'Medium' in text,text
 assert 'No catalogue card: no price' in text,text
 assert 'older versions stay in your data' in text,text
 # Edit: a target above the price flags the card; saving keeps lots and sales untouched.
 page.locator('[data-mc-edit="i1"]').click()
 page.locator('#mcETarget').fill('20');page.locator('#mcEAlert').fill('15');page.locator('[data-mc-form="i1"] button[type=submit]').click()
 page.wait_for_timeout(200)
 db=page.evaluate("JSON.parse(localStorage.getItem('pokeflip-v1'))")
 i1=[i for i in db['items'] if i['id']=='i1'][0]
 assert i1['target']==20 and i1['alertPct']==15 and i1['market']['cad']==18.5,i1
 assert len(db['lots'])==1 and len(db['sales'])==1 and db['lots'][0]['cost']==85
 assert 'At or under your target' in page.locator('#myCards').inner_text()
 assert page.evaluate("CardsteadMyCards.ebayCards(pokeflipLedger.getData().items).map(c=>c.id).join()")=='my-i1'
 # Add card button opens the search form (searching needs the network: not run here).
 page.locator('#mcAddBtn').click();assert page.locator('#mcQuery').is_visible();page.locator('[data-mc-close]').click()
 assert not errors,errors
 page.screenshot(path=str(Path(tempfile.gettempdir())/'pokeflip-embedded-browser-qa.png'),full_page=True)
 # A large collection must not create thousands of rows at once.
 page.evaluate('''() => {
   const d=window.pokeflipLedger.getData(); const seed=d.items[0];
   const items=Array.from({length:1200},(_,i)=>({...seed,id:'volume-'+i,name:'Card #'+i,qty:1,target:null,alertPct:null}));
   window.pokeflipLedger.replaceFromCloud({lots:d.lots,items,sales:[]},[]);
 }''')
 page.wait_for_timeout(200)
 assert page.locator('.mc-card').count()==100,page.locator('.mc-card').count()
 assert 'Showing 100 of 1200 cards' in page.locator('#myCards').inner_text()
 page.locator('[data-mc-more]').click()
 assert page.locator('.mc-card').count()==200
 page.locator('#mcFilter').fill('Card #1199')
 assert page.locator('.mc-card').count()==1
 assert page.locator('[data-mc-more]').count()==0
 # CSV import: a row with no readable language is held as Not confirmed (no alerts), never silently English or French.
 page.evaluate('''()=>{window.pokeflipLedger.replaceFromCloud({lots:window.pokeflipLedger.getData().lots,items:[],sales:[]},[])}''')
 page.locator('#importCsv').set_input_files(files=[{'name':'in.csv','mimeType':'text/csv','buffer':b'name,qty,language,target_cad\nBlank lang,1,,5\nEnglish card,2,English,\nFrench card,1,fr,\nBad qty,0,en,\n'}])
 page.wait_for_timeout(300)
 rows={i['name']:i for i in page.evaluate("window.pokeflipLedger.getData().items")}
 assert set(rows)=={'Blank lang','English card','French card'},rows.keys()
 assert rows['Blank lang']['category']=='review' and rows['Blank lang']['status']=='unsorted'
 assert rows['English card']['lang']=='en' and rows['English card']['category']=='single'
 assert rows['French card']['lang']=='fr'
 toast=page.locator('#toast').inner_text();assert 'Not confirmed' in toast and 'skipped' in toast,toast
 assert page.evaluate("CardsteadMyCards.ebayCards(pokeflipLedger.getData().items).length")==0,'an unconfirmed card is not sent to eBay deals'
 page.locator('.dock-item[data-dock="mycards"]').click();assert 'Not confirmed' in page.locator('#myCards').inner_text()
 # Regression: Android Chrome throws on new Notification(); a granted permission must not surface an error.
 page.evaluate('''()=>{Object.defineProperty(Notification,'permission',{configurable:true,get:()=>'granted'});window.Notification=function(){throw new TypeError('Illegal constructor')};window.Notification.permission='granted'}''')
 page.evaluate("CardsteadNav.show('restock')")
 page.evaluate("document.querySelectorAll('details.advanced,details.form-more').forEach(d=>d.open=true)")
 page.locator('#restockProduct').fill('Test ETB');page.locator('#restockCeiling').fill('60');page.locator('#restockWatchForm button[type=submit]').click()
 page.locator('#restockWatchSelect').select_option(index=1);page.locator('#restockStatus').select_option('in');page.locator('#restockPrice').fill('50');page.locator('#restockStore').fill('Test store')
 page.locator('#restockRecordForm button[type=submit]').click();page.wait_for_timeout(300)
 assert 'Potential restock' in page.locator('#restockMessage').inner_text(),page.locator('#restockMessage').inner_text()
 assert not errors,errors
 print('PASS: My cards keeps data saved by an older version (cards, lots, sales); target edit flags the card and feeds eBay deals')
 print('PASS: 1,200 cards shown 100 at a time and filtered by name; CSV rows with no readable language held as Not confirmed')
 print('PASS: Chromium mobile-width render, all four tabs, drop watch; 0 runtime exceptions')
 print('LIMITATION: localStorage shim; no live network (card search and price check not run), production site or OAuth tested')
 browser.close()
