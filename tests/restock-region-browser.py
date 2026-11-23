"""Follow-a-region flow: possible matches from mocked shop catalogues; no live network."""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
shops=json.loads(__import__("subprocess").check_output(["node","-e","console.log(JSON.stringify(require('./canada-shops.js').inRegions(['south-shore'])))"],cwd=str(root)))
assert shops,"south-shore has shops"
hits=[]
def shop(route):
    hits.append(route.request.url)
    route.fulfill(status=200,content_type="application/json",headers={"access-control-allow-origin":"*"},body=json.dumps({"products":[
      {"title":"Pokemon - Mega Evolution - Flowing Fist - Booster Bundle","handle":"flowing-fist-bundle","variants":[{"id":555001,"available":True,"price":"54.99"}]},
      {"title":"Unrelated Sleeves","handle":"sleeves","variants":[{"available":True,"price":"9.00"}]}]}))
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  ctx=b.new_context(viewport={"width":390,"height":844},service_workers="block")
  # An existing user who follows no region (a new Québec user follows every Québec region: tests/store-prefs.test.cjs)
  ctx.add_init_script("localStorage.setItem('pokeflip-restock-regions-v1','[]')");page=ctx.new_page();errors=[]
  page.on("pageerror",lambda e:errors.append(str(e)))
  page.route("**/products.json*",shop)
  page.goto(f"http://127.0.0.1:{server.server_port}/",wait_until="domcontentloaded")
  page.locator('[data-tab="restock"]').first.evaluate("e=>e.click()")
  page.locator("#restockRegions label").first.wait_for(timeout=5000)
  assert "South Shore" in page.locator("#restockRegions").inner_text()
  page.fill("#restockProduct","Mega Evolution Flowing Fist Booster Bundle");page.fill("#restockCeiling","60")
  page.locator("#restockWatchForm button[type=submit]").evaluate("b=>b.click()")
  page.locator("#restockRegions label:has-text('South Shore') input").check()
  page.wait_for_function("document.querySelector('#restockRegionMatches').innerText.includes('Flowing Fist')",timeout=30000)
  txt=page.locator("#restockRegionMatches").inner_text()
  assert "possible match" in txt and "Available" in txt and "$54.99" in txt and "Unrelated" not in txt, txt
  assert "Possible match for" in page.locator("#restockMessage").inner_text()
  assert page.evaluate("PokeFlipRestock.getData().observations.length")==0
  # regional possible match appears in Ready to buy with a quantity-bearing cart link (watch has quantity 1 by default)
  href=page.locator("#restockBuy a",has_text="Buy now").first.get_attribute("href");assert href.endswith("/cart/555001:1"), href
  assert page.locator("#restockWatches a",has_text="Buy now").count()==1
  page.wait_for_function('true');page.wait_for_timeout(2500*len(shops)+3000)
  assert all(u.endswith("/products.json?limit=250") for u in hits) and len(hits)==len(shops)>=1, (hits,len(shops))
  n=len(hits);page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_timeout(2500);assert len(hits)==n
  assert not errors,errors
  print("PASS regions: follow region, possible matches listed, alert once, nothing recorded as a verified observation, throttled, no runtime errors")
  b.close()
finally:
 server.shutdown()
