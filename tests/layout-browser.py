"""Layout and wording: desktop sidebar, smallest text, the floating buttons, the hidden Discord panel,
the short "Compare stores" panel and the opt-in eBay checks. No live network.
Set PACK_SHOTS=<folder> for screenshots. Run: python tests/layout-browser.py"""
import json, os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = os.environ.get("PACK_SHOTS")
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{server.server_port}/"
SMALL = """()=>{const out=[];for(const e of document.querySelectorAll('body *')){
 if(!e.getClientRects().length||![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
 const s=parseFloat(getComputedStyle(e).fontSize);if(s<12)out.push(e.tagName+'.'+e.className+' '+s)}return out}"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for lang, width, height in (("fr", 1280, 800), ("en", 900, 640), ("fr", 320, 700), ("en", 390, 844)):
            ctx = b.new_context(viewport={"width": width, "height": height}, service_workers="block", locale="fr-CA" if lang == "fr" else "en-CA")
            ctx.route("**/rpc/{restock_feed,shop_prices}", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"items":null}'))  # no live network
            for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/api/**"):
                ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
            page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(URL, wait_until="domcontentloaded")
            page.wait_for_function("typeof go==='function' && !!document.body.dataset.group")
            page.locator("#pricesResults .prod-list").first.wait_for(timeout=20000)
            for tab in ("prices", "restock", "mycards", "settings"):
                page.evaluate(f"CardsteadNav.show('{tab}')"); page.wait_for_timeout(300)
                assert page.locator("#addCardFab").is_visible() == (tab in ("prices", "mycards")), ("Add card", tab)
                assert page.evaluate(SMALL) == [], (tab, width, page.evaluate(SMALL))
                over = page.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
                assert over <= 1, (tab, width, over)
                if SHOTS: page.screenshot(path=f"{SHOTS}/layout-{tab}-{lang}-{width}.png")
            if width > 760:   # the sidebar buttons start below Export backup, whatever the language
                gap = page.evaluate("document.querySelector('.tabs').getBoundingClientRect().top-document.querySelector('#backupTop').getBoundingClientRect().bottom")
                assert gap >= 4, ("sidebar overlap", lang, width, gap)
            assert page.locator("#discordPanel").is_hidden(), "no invite and no linked account"
            for box in ("#pushGood", "#pushChains"):
                bb = page.locator(box).bounding_box()
                assert bb["width"] <= 28, ("checkbox stretched", box, bb)
            page.evaluate("CardsteadNav.show('restock')"); page.wait_for_timeout(200)
            assert page.locator("#restockEmpty img").evaluate("i=>i.complete||new Promise(r=>i.onload=()=>r(true))")
            assert page.locator("#restockAdvanced #alertsHub").count() == 1, "alerts inbox folded"
            # Back to top appears on a long page and works.
            page.evaluate("CardsteadNav.show('settings')")
            page.evaluate("document.querySelector('#settings').style.minHeight='5000px';scrollTo(0,3000)")
            page.locator("#toTop").wait_for(state="visible", timeout=3000)
            page.locator("#toTop").click()
            page.wait_for_function("scrollY<50", timeout=5000)
            page.locator("#toTop").wait_for(state="hidden", timeout=3000)
            # Compare stores with nothing recorded: no rows of "unknown", no verdict.
            page.evaluate("document.querySelector('#compareDialog').showModal();CardsteadCompare.render(document.querySelector('#compareBody'),{product:'Surging Sparks Booster Box',format:'box'})")
            page.locator("#compareBody .cmp-values").wait_for(timeout=10000)
            assert page.locator("#compareBody .cmp-verdict").count() == 0
            assert page.locator("#compareBody [data-cmp-all]").count() == 1
            if SHOTS: page.screenshot(path=f"{SHOTS}/layout-compare-empty-{lang}-{width}.png")
            assert not errors, errors
            print(f"PASS layout ({lang}, {width}x{height}): text 12 px or more, Add card on Prices and Watchlist, short empty comparison")
            ctx.close()

        # eBay: a new visitor causes no search; someone with a target price gets only that card checked.
        ids = None
        for label, prefs in (("new visitor", None), ("one target", "target")):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", locale="en-CA")
            ctx.route("**/rpc/{restock_feed,shop_prices}", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"items":null}'))  # no live network
            calls = []
            def ebay(route):
                url = route.request.url; calls.append(url)
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"configured": True} if "status=1" in url else {"items": [], "fetchedAt": "2026-11-26T12:00:00Z"}))
            ctx.route("**/api/**", lambda r: r.fulfill(status=404, body=""))
            ctx.route("**/api/ebay-search*", ebay)
            for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**"):
                ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
            if prefs:
                saved = {"removed": [], "custom": [], "targets": {ids[0]: 5}, "threshold": 0.1, "auto": True}
                ctx.add_init_script(f"localStorage.setItem('cardstead-ebay-watch-v1',{json.dumps(json.dumps(saved))});")
            page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
            page.clock.install()
            page.goto(URL, wait_until="load")
            page.clock.run_for(25000)
            if prefs:
                for _ in range(40):
                    if any("q=" in u for u in calls): break
                    page.wait_for_timeout(250); page.clock.run_for(1500)
                page.clock.run_for(10000); page.wait_for_timeout(500)
                searches = [u for u in calls if "q=" in u]
                assert len(searches) == 1, (label, searches)
            else:
                page.wait_for_timeout(1500)
                assert calls == [], (label, calls)
                page.add_script_tag(url="./sought-cards.js"); ids = page.evaluate("CardsteadSoughtCards.cards.map(c=>c.id)")
                page.evaluate("CardsteadNav.show('deals')"); page.wait_for_function("document.querySelector('#dealsAuto').value==='mine'")
            assert not errors, errors
            print(f"PASS eBay automatic checks: {label}")
            ctx.close()
        b.close()
finally:
    server.shutdown()
