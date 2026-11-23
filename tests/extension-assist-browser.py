"""Drop Assist content script on synthetic Amazon.ca and Pokémon Center pages (store URLs intercepted, no network):
quantity set within limits, Add to Cart pressed, cart -> checkout, then it STOPS: "Place order" / "Buy Now" never pressed.
Also loads the real unpacked extension in Chromium and checks its worker and settings page.
Run: python tests/extension-assist-browser.py"""
import json, os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FX = ROOT / "tests/fixtures/extension"
SHOTS = os.environ.get("PACK_SHOTS")
CORE = (ROOT / "extension/lib/core.js").read_text(encoding="utf-8")
ASSIST = (ROOT / "extension/content/assist.js").read_text(encoding="utf-8")
PAGES = {
    "https://www.amazon.ca/dp/B0TEST0001": "amazon-in-stock.html",
    "https://www.amazon.ca/gp/cart/view.html": "amazon-cart.html",
    "https://www.amazon.ca/gp/buy/spc/handlers/display.html": "amazon-checkout.html",
    "https://www.pokemoncenter.com/en-ca/product/10-10037-118/surging-sparks-pc-etb": "pc-in-stock.html",
    "https://www.pokemoncenter.com/en-ca/cart": "pc-cart.html",
    "https://www.pokemoncenter.com/en-ca/checkout": "pc-checkout.html",
    "https://www.pokemoncenter.com/en-ca/product/10-99999-001/queued": "pc-queue.html",
}
def stub(product):
    return """
window.chrome={runtime:{onMessage:{addListener(){}},sendMessage(msg,cb){
  const log=JSON.parse(sessionStorage.getItem('msgs')||'[]');log.push(msg);sessionStorage.setItem('msgs',JSON.stringify(log));
  if(msg.type==='assist-get'){const done=sessionStorage.getItem('done');cb&&cb(done?null:{product:%s,job:{qty:%d,mode:'checkout',expires:Date.now()+600000}});return}
  if(msg.type==='assist-done')sessionStorage.setItem('done','1');
  cb&&cb({ok:true})}}};
document.addEventListener('DOMContentLoaded',()=>{(0,eval)(%s);(0,eval)(%s)});
""" % (json.dumps(product), product["maxQty"], json.dumps(CORE), json.dumps(ASSIST))

def route_all(ctx):
    def handle(route):
        url = route.request.url.split("?")[0]
        f = PAGES.get(url)
        if f: route.fulfill(status=200, content_type="text/html; charset=utf-8", body=(FX / f).read_text(encoding="utf-8"))
        else: route.fulfill(status=404, body="")
    ctx.route("https://www.amazon.ca/**", handle)
    ctx.route("https://www.pokemoncenter.com/**", handle)
    ctx.route("https://static.queue-it.net/**", lambda r: r.fulfill(status=200, body=""))

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
    # Amazon: owner max 5, page allows 3 -> 3 added; ends on checkout without placing the order.
    ctx = b.new_context(); route_all(ctx)
    ctx.add_init_script(stub({"id": "amazon:B0TEST0001", "store": "amazon", "name": "Surging Sparks ETB", "maxQty": 5}))
    page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("https://www.amazon.ca/dp/B0TEST0001")
    page.wait_for_url("**/gp/buy/spc/handlers/display.html**", timeout=20000)
    page.wait_for_function("document.getElementById('cardstead-assist-banner')", timeout=10000)
    assert "Place order yourself" in page.locator("#cardstead-assist-banner").inner_text()
    page.wait_for_timeout(1500)
    s = page.evaluate("({added:sessionStorage.getItem('added'),buyNow:sessionStorage.getItem('buyNow'),placed:sessionStorage.getItem('placed'),msgs:JSON.parse(sessionStorage.getItem('msgs')||'[]').map(m=>m.type)})")
    assert s["added"] == "3", s
    assert s["buyNow"] is None and s["placed"] is None, s
    assert "assist-done" in s["msgs"], s
    if SHOTS: page.set_viewport_size({"width":900,"height":360}); page.screenshot(path=f"{SHOTS}/extension-checkout-banner.png")
    assert not errors, errors
    print("PASS Amazon assist: quantity 3 (page max), Add to Cart, cart, checkout reached; Buy Now and Place order never pressed")
    ctx.close()
    # Pokémon Center: owner max 4, store limit 2 -> 2 added; ends on checkout without placing the order.
    ctx = b.new_context(); route_all(ctx)
    ctx.add_init_script(stub({"id": "pokemoncenter:10-10037-118", "store": "pokemoncenter", "name": "Surging Sparks PC ETB", "maxQty": 4}))
    page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("https://www.pokemoncenter.com/en-ca/product/10-10037-118/surging-sparks-pc-etb")
    page.wait_for_url("**/en-ca/checkout", timeout=20000)
    page.wait_for_function("document.getElementById('cardstead-assist-banner')", timeout=10000)
    page.wait_for_timeout(1000)
    s = page.evaluate("({added:sessionStorage.getItem('added'),placed:sessionStorage.getItem('placed')})")
    assert s == {"added": "2", "placed": None}, s
    assert not errors, errors
    print("PASS Pokémon Center assist: quantity capped at the store limit (2), cart, checkout reached; Place Order never pressed")
    ctx.close()
    # Waiting room: the tab reports the queue and does nothing else.
    ctx = b.new_context(); route_all(ctx)
    ctx.add_init_script(stub({"id": "pokemoncenter:10-99999-001", "store": "pokemoncenter", "name": "Queued", "maxQty": 1}))
    page = ctx.new_page(); page.goto("https://www.pokemoncenter.com/en-ca/product/10-99999-001/queued"); page.wait_for_timeout(1500)
    msgs = page.evaluate("JSON.parse(sessionStorage.getItem('msgs')||'[]')")
    status = [m for m in msgs if m["type"] == "pc-status"]
    assert status and status[0]["obs"]["queue"] is True, msgs
    assert page.url.endswith("/queued"), page.url
    print("PASS Pokémon Center waiting room: reported as queue, page left alone")
    ctx.close(); b.close()

    # The real unpacked extension loads: service worker runs, settings page adds a product, no errors.
    ext = str(ROOT / "extension")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        try:
            ctx = p.chromium.launch_persistent_context(profile, channel="chromium", headless=True, args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}", "--no-sandbox"])
        except Exception as e:
            print("SKIP extension load (this Chromium build cannot load extensions headless):", str(e)[:120]); ctx = None
        if ctx:
            sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=15000)
            ext_id = sw.url.split("/")[2]
            page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"chrome-extension://{ext_id}/options.html")
            page.fill("#addUrl", "https://www.amazon.ca/dp/B0TEST0001"); page.fill("#addName", "Test ETB"); page.fill("#addPrice", "70"); page.fill("#addQty", "2")
            page.locator("#add button[type=submit]").click()
            page.wait_for_function("document.getElementById('products').innerText.includes('Test ETB')", timeout=5000)
            stored = sw.evaluate("chrome.storage.local.get('products').then(x=>x.products)")
            assert stored[0]["id"] == "amazon:B0TEST0001" and stored[0]["maxQty"] == 2, stored
            if SHOTS: page.set_viewport_size({"width":420,"height":1100}); page.screenshot(path=f"{SHOTS}/extension-settings.png", full_page=True)
            assert not errors, errors
            print("PASS unpacked extension: worker running, settings page saves a product")
            ctx.close()
