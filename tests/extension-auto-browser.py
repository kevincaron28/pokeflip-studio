"""Automatic checkout (Amazon.ca) on synthetic pages, store URLs intercepted, no network.
The background worker is simulated in the page with the real core.js verifyCheckout, so the same guards run.
Checks: one "Place your order" press on a clean checkout and the order id reported; nothing pressed on a wrong
address or a payment prompt; never a second press for the same drop; assist mode and Pokémon Center never press.
Run: python tests/extension-auto-browser.py"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FX = ROOT / "tests/fixtures/extension"
CORE = (ROOT / "extension/lib/core.js").read_text(encoding="utf-8")
ASSIST = (ROOT / "extension/content/assist.js").read_text(encoding="utf-8")
SETTINGS = {"autoAck": True, "dailyCap": 300, "postalCode": "J4K 1A1", "street": "", "sellerAllowlist": []}
AMAZON = {"id": "amazon:B0TEST0001", "store": "amazon", "name": "Surging Sparks ETB", "maxPrice": 70, "maxQty": 2, "maxOrderTotal": 160, "autoBuy": True, "enabled": True}

def stub(product, mode, settings=SETTINGS):
    return """
(()=>{const P=%s,S=%s,MODE=%s;
const job=()=>JSON.parse(sessionStorage.getItem('job')||JSON.stringify({qty:P.maxQty,mode:MODE,expires:Date.now()+600000,attemptId:'a1',attempted:false}));
const save=j=>sessionStorage.setItem('job',JSON.stringify(j));
const note=m=>{const l=JSON.parse(sessionStorage.getItem('msgs')||'[]');l.push(m);sessionStorage.setItem('msgs',JSON.stringify(l))};
window.chrome={runtime:{onMessage:{addListener(){}},sendMessage(msg,cb){note({type:msg.type,orderId:msg.orderId,reason:msg.reason});const j=job();
 if(msg.type==='assist-get'){cb&&cb(sessionStorage.getItem('done')?null:{product:P,job:j});return}
 if(msg.type==='auto-verify'){ // what background.js does: refuse a second attempt, re-verify with stored settings
  if(j.attempted){cb({go:false,why:['already attempted for this drop']});return}
  const v=self.CardsteadAssist.verifyCheckout(P,S,msg.parsed,j.qty,0);
  if(!v.ok){j.mode='checkout';save(j);cb({go:false,why:v.why});return}
  j.attempted=true;save(j);cb({go:true});return}
 if(msg.type==='auto-placed'||msg.type==='assist-done')sessionStorage.setItem('done','1');
 cb&&cb({ok:true})}}};
document.addEventListener('DOMContentLoaded',()=>{(0,eval)(%s);(0,eval)(%s)});})();
""" % (json.dumps(product), json.dumps(settings), json.dumps(mode), json.dumps(CORE), json.dumps(ASSIST))

def context(b, checkout_fixture, product, mode):
    pages = {"https://www.amazon.ca/dp/B0TEST0001": "amazon-buynow.html", "https://www.amazon.ca/checkout/p/test-order/spc": checkout_fixture,
             "https://www.amazon.ca/gp/buy/thankyou/handlers/display.html": "amazon-thankyou.html",
             "https://www.pokemoncenter.com/en-ca/checkout": "amazon-spc-ok.html"}
    ctx = b.new_context()
    def handle(route):
        f = pages.get(route.request.url.split("?")[0])
        route.fulfill(status=200 if f else 404, content_type="text/html; charset=utf-8", body=(FX / f).read_text(encoding="utf-8") if f else "")
    ctx.route("https://www.amazon.ca/**", handle); ctx.route("https://www.pokemoncenter.com/**", handle)
    ctx.add_init_script(stub(product, mode))
    return ctx

def state(page):
    return page.evaluate("({placed:Number(sessionStorage.getItem('placed')||0),buyNow:sessionStorage.getItem('buyNow'),msgs:JSON.parse(sessionStorage.getItem('msgs')||'[]'),banner:(document.getElementById('cardstead-assist-banner')||{}).innerText||''})")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
    # 1. Clean checkout: Buy Now with quantity 2, one Place-your-order press, confirmation with order id.
    ctx = context(b, "amazon-spc-ok.html", AMAZON, "auto"); page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("https://www.amazon.ca/dp/B0TEST0001")
    page.wait_for_url("**/gp/buy/thankyou/**", timeout=20000)
    page.wait_for_function("(JSON.parse(sessionStorage.getItem('msgs')||'[]')).some(m=>m.type==='auto-placed')", timeout=10000)
    s = state(page)
    assert s["buyNow"] == "2" and s["placed"] == 1, s
    placed = [m for m in s["msgs"] if m["type"] == "auto-placed"]
    assert placed and placed[0]["orderId"] == "702-1234567-7654321", s["msgs"]
    assert "ORDER PLACED" in s["banner"], s["banner"]
    # Same drop, back on the checkout page: never a second press.
    page.goto("https://www.amazon.ca/checkout/p/test-order/spc"); page.evaluate("sessionStorage.removeItem('done')"); page.reload(); page.wait_for_timeout(3500)
    assert state(page)["placed"] == 1
    assert not errors, errors
    print("PASS automatic checkout: Buy Now ×2, one Place your order press, order #702-1234567-7654321 reported, no second press")
    ctx.close()
    # 2. Wrong address / payment prompt / CVV / third-party seller: nothing pressed, owner told why.
    for fixture, why in (("amazon-spc-address.html", "postal code"), ("amazon-spc-payment.html", "payment"), ("amazon-spc-cvv.html", "payment"), ("amazon-spc-thirdparty.html", "CardFlipperz"), ("amazon-spc-total.html", "order total")):
        ctx = context(b, fixture, AMAZON, "auto"); page = ctx.new_page()
        page.goto("https://www.amazon.ca/dp/B0TEST0001"); page.wait_for_url("**/checkout/p/test-order/spc**", timeout=20000)
        page.wait_for_function("(document.getElementById('cardstead-assist-banner')||{}).innerText?.includes('Not bought')", timeout=10000)
        s = state(page)
        assert s["placed"] == 0 and why in s["banner"], (fixture, s)
        ctx.close()
    print("PASS automatic checkout refuses: wrong address, payment choice, CVV, third-party seller, total over max (nothing pressed)")
    # 3. Assist mode on the same clean checkout never presses.
    ctx = context(b, "amazon-spc-ok.html", {**AMAZON, "autoBuy": False}, "checkout"); page = ctx.new_page()
    page.goto("https://www.amazon.ca/checkout/p/test-order/spc"); page.wait_for_timeout(3500)
    assert state(page)["placed"] == 0; ctx.close()
    # 4. Pokémon Center is never automatic, even if a job says "auto".
    ctx = context(b, "amazon-spc-ok.html", {**AMAZON, "id": "pokemoncenter:x", "store": "pokemoncenter"}, "auto"); page = ctx.new_page()
    page.goto("https://www.pokemoncenter.com/en-ca/checkout"); page.wait_for_timeout(3500)
    assert state(page)["placed"] == 0; ctx.close()
    print("PASS assist mode and Pokémon Center never press Place order")
    b.close()
