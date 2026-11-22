"""Local Chromium smoke test; no external account or retailer API required."""
import http.server, socketserver, threading, os, time
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(__file__))
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=ROOT,**kwargs)
 def log_message(self,*a):pass
server=socketserver.TCPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_address[1]}/index.html'
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.goto(url,wait_until='domcontentloaded');page.wait_for_timeout(1600)
 assert page.locator('#metrics').count()==1
 assert page.locator('#cloudConfigure').count()==1
 assert page.locator('#alertsRows').count()==1
 page.screenshot(path='/mnt/data/pokeflip-mobile-qa.png',full_page=True)
 # Verify app initial startup across all tabs without runtime errors
 tabs=page.locator('.tab').all()
 for t in tabs:
  try:t.click(timeout=4000)
  except Exception as e:errors.append('tab click '+str(e)[:130])
 page.locator('[data-tab="lots"]').first.click()
 page.locator('#lotForm [name="name"]').fill('QA Test Collection')
 page.locator('#lotForm [name="cost"]').fill('85')
 page.locator('#lotForm [name="source"]').fill('Local')
 page.locator('#lotForm button[type="submit"]').click()
 data=page.evaluate("JSON.parse(localStorage.getItem('pokeflip-v1'))")
 assert data['lots'][0]['cost']==85
 page.locator('#bulkLot').select_option(data['lots'][0]['id'])
 page.locator('#bulkLang').select_option('fr')
 page.locator('#bulkType').select_option(index=1)
 page.locator('#bulkQty').fill('100')
 page.locator('#bulkForm button[type="submit"]').click()
 data=page.evaluate("JSON.parse(localStorage.getItem('pokeflip-v1'))")
 assert data['items'][0]['qty']==100
 assert page.evaluate('typeof window.PokeFlipAlerts.getData')=='function'
 assert page.evaluate('typeof window.PokeFlipCloudCore.validUrl')=='function'
 assert not errors,errors
 print('Browser QA PASS: mobile page render, all navigation tabs, lot creation, bulk entry, alert hub, cloud client availability')
 browser.close()
server.shutdown()
