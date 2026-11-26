"""Automatic Shopify check + manual retailer links in the real app shell (shop responses are mocked; no live network)."""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
hits=[]
def shop(route):
    hits.append(route.request.url)
    route.fulfill(status=200,content_type="application/json",headers={"access-control-allow-origin":"*"},
        body=json.dumps({"title":"Test ETB","variants":[{"id":987654,"available":True,"price":5499}]}))
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  ctx=b.new_context(viewport={"width":390,"height":844},service_workers="block", locale="en-CA")
  ctx.route("**/rpc/{restock_feed,shop_prices}", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"items":null}'))  # no live network
  # This test covers the single-shop check, so the user follows no region (the Québec default follows them all).
  ctx.add_init_script("localStorage.setItem('pokeflip-restock-regions-v1','[]')")
  page=ctx.new_page();errors=[]
  page.on("pageerror",lambda e:errors.append(str(e)))
  ext=[]
  page.on("request",lambda r:ext.append(r.url) if r.url.startswith("http") and not r.url.startswith("http://127.0.0.1") else None)
  page.route("https://tistaminis.com/**",shop)
  page.goto(f"http://127.0.0.1:{server.server_port}/",wait_until="domcontentloaded")
  page.evaluate("go && go('restock')") if page.evaluate("typeof go")=="function" else page.locator('[data-tab="restock"]').first.evaluate("e=>e.click()")
  page.evaluate("document.querySelectorAll('details.advanced,details.form-more').forEach(d=>d.open=true)")
  page.locator("#restockRetailers .source-row").first.wait_for(timeout=5000)
  rows=page.locator("#restockRetailers .source-row")
  assert rows.count()>=13, rows.count()
  texts=page.locator("#restockRetailers").inner_text()
  for n in ("Costco","EB Games","Walmart","Best Buy","Amazon.ca","Canadian Tire","Tistaminis"):assert n in texts,n
  # manual retailers must be plain links to the retailer site, opened in a new tab with noopener
  a=page.locator("#restockRetailers a").first
  assert a.get_attribute("rel")=="noopener noreferrer" and a.get_attribute("target")=="_blank" and a.get_attribute("href").startswith("https://")
  # an automatic watch on a non-allow-listed host is rejected
  page.fill("#restockProduct","Test ETB");page.fill("#restockCeiling","60");page.fill("#restockAutoUrl","https://www.walmart.ca/en/ip/x")
  page.locator("#restockWatchForm button[type=submit]").evaluate("b=>b.click()")
  assert "Invalid watch rule" in page.locator("#restockMessage").inner_text()
  assert page.evaluate("PokeFlipRestock.getData().watches.length")==0
  # valid allow-listed watch -> automatic check records an observation, tags it auto, and qualifies under the ceiling
  page.fill("#restockAutoUrl","https://tistaminis.com/products/test-etb")
  page.fill("#restockQuantity","3");page.fill("#restockLimit","2")
  page.locator("#restockWatchForm button[type=submit]").evaluate("b=>b.click()")
  page.wait_for_function("PokeFlipRestock.getData().observations.length>=1",timeout=12000)
  d=page.evaluate("PokeFlipRestock.getData()")
  o=d["observations"][0]
  assert o["source"]=="auto" and o["status"]=="in" and abs(o["price"]-54.99)<0.001 and o["store"]=="tistaminis.com", o
  assert d["watches"][0]["autoUrl"]=="https://tistaminis.com/products/test-etb"
  assert "Potential restock" in page.locator("#restockMessage").inner_text()
  # Ready to buy: cart link with variant id and quantity capped by the shop limit; a normal link the user opens (nothing submitted)
  buy=page.locator("#restockBuy a",has_text="Buy now").first
  assert buy.get_attribute("href")=="https://tistaminis.com/cart/987654:2", buy.get_attribute("href")
  assert "Buy now" in buy.inner_text() and buy.get_attribute("rel")=="noopener noreferrer"
  assert "never sees or stores payment details" in page.locator("#restockBuy").inner_text()
  row=page.locator("#restockWatches a",has_text="Buy now");assert row.count()==1 and row.get_attribute("href")=="https://tistaminis.com/cart/987654:2"
  assert page.evaluate("PokeFlipRestock.getData().observations[0].variantId")==987654
  assert page.locator("#checkoutTips").count()==1
  assert hits==["https://tistaminis.com/products/test-etb.js"], hits
  # modest polling: a second immediate pass must not call the shop again
  page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_timeout(2500)
  assert len(hits)==1, hits
  assert not errors, errors
  assert [u for u in ext if "tistaminis" not in u and "tcgdex" not in u and "jsdelivr" not in u and "supabase" not in u]==[], ext
  print("PASS restock: retailer links, allow-list enforced, automatic Shopify check recorded once, rate-limited, no runtime errors")
  b.close()
finally:
 server.shutdown()
