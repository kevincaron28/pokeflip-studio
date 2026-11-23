"""Compare stores at phone width, English and French: from an alert card (dialog) and on the pack detail
(inline). Seeded with recorded checks only; no live network. Set PACK_SHOTS=<folder> for screenshots.
Run: python tests/compare-stores-browser.py"""
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
restock = {"watches": [
    {"id": "w1", "product": "Surging Sparks Elite Trainer Box", "format": "etb", "language": "en", "region": "Montréal", "ceiling": 200, "enabled": True},
    {"id": "w2", "product": "Surging Sparks Booster Pack", "format": "pack", "language": "en", "region": "Montréal", "ceiling": 20, "enabled": True}],
  "observations": [
    {"id": "o1", "watchId": "w1", "status": "in", "price": 149.99, "checkedAt": "2026-11-23T14:00:00.000Z", "store": "EB Games", "url": "https://www.ebgames.ca/", "source": "manual"},
    {"id": "o2", "watchId": "w1", "status": "out", "price": 129.99, "checkedAt": "2026-11-23T13:00:00.000Z", "store": "Walmart.ca", "url": "https://www.walmart.ca/", "source": "manual"},
    {"id": "o3", "watchId": "w2", "status": "in", "price": 6.49, "checkedAt": "2026-11-23T14:30:00.000Z", "store": "Costco.ca", "url": "https://www.costco.ca/", "source": "manual"},
    {"id": "o4", "watchId": "w2", "status": "in", "price": 7.99, "checkedAt": "2026-11-23T14:10:00.000Z", "store": "Collect-Edition", "url": "https://collect-edition.com/", "source": "manual"}]}
matches = [{"watchId": "w1", "host": "collect-edition.com", "shop": "Collect-Edition", "title": "Pokemon Surging Sparks Elite Trainer Box", "url": "https://collect-edition.com/products/ss-etb", "variantId": 1, "available": True, "price": 139.99, "checkedAt": "2026-11-23T14:20:00.000Z"}]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for lang in ("en", "fr"):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", locale="en-CA")
            ctx.route("**/products.json*", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"products":[]}'))
            ctx.route("https://tcgplayer-cdn.tcgplayer.com/**", lambda r: r.fulfill(status=404, body=""))
            ctx.add_init_script(f"""localStorage.setItem('pokeflip-restock-v1',{json.dumps(json.dumps(restock))});
localStorage.setItem('pokeflip-restock-matches-v1',{json.dumps(json.dumps(matches))});localStorage.setItem('pokeflip-restock-regions-v1','[]');""")
            page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
            page.wait_for_function("typeof go==='function'")
            page.evaluate("go('restock')")
            btn = page.locator("#restockWatches .alert-card [data-compare]").first
            btn.wait_for(timeout=15000); btn.click()
            dlg = page.locator("#compareDialog")
            dlg.locator(".cmp-table").wait_for(timeout=10000)
            if lang == "fr":
                dlg.locator("[data-cmp-lang]").click(); page.wait_for_function("document.querySelector('#compareBody').innerText.includes('Comparer les magasins')")
            text = dlg.inner_text()
            stores = dlg.locator(".cmp-table tbody tr td:first-child strong").all_inner_texts()
            assert stores == ["Collect-Edition", "EB Games", "Walmart.ca"], stores   # in stock first, then cheapest; sold out last
            if lang == "en":
                for must in ("Compare stores", "MSRP", "Market value (sealed)", "as of", "Best in-stock price", "$139.99", "In stock", "Sold out", "Buy", "followed stores with no record"):
                    assert must in text, (must, text)
            else:
                for must in ("Comparer les magasins", "PDSF", "Valeur marchande (scellé)", "Meilleur prix en stock", "139,99", "En stock", "Épuisé", "Acheter", "magasins suivis sans relevé"):
                    assert must in text, (must, text)
            # Unfollowed area: the toggle can only add stores, never invent prices.
            dlg.locator("[data-cmp-all]").check(); page.wait_for_timeout(300)
            assert dlg.locator(".cmp-table tbody tr").count() == 3
            dlg.locator("[data-cmp-all]").uncheck(); page.wait_for_timeout(300)
            overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert overflow <= 1, overflow
            if SHOTS:
                page.screenshot(path=f"{SHOTS}/compare-alert-{lang}-390.png")
            dlg.locator("[data-cmp-close]").click()
            # Pack detail: inline comparison for the set's booster pack (sleeved and plain packs count as the same product).
            page.evaluate("go('packs');CardsteadPackEv.open()")
            page.locator(".pack-table tbody tr").first.wait_for(timeout=15000)
            page.fill("#packSearch", "surging"); page.locator(".pack-table tbody tr").first.click()
            inline = page.locator("#packCompare")
            inline.locator(".cmp-table").wait_for(timeout=10000)
            rows = inline.locator(".cmp-table tbody tr td:first-child strong").all_inner_texts()
            assert rows == ["Costco.ca", "Collect-Edition"], rows
            assert ("Comparer" if lang == "fr" else "Compare stores") in inline.inner_text(), "language choice is remembered"
            if SHOTS:
                inline.screenshot(path=f"{SHOTS}/compare-pack-{lang}-390.png")
            assert not errors, errors
            print(f"PASS compare stores ({lang}, 390 px): alert dialog sorted in-stock-first then cheapest, area toggle, pack detail inline")
            ctx.close()
        b.close()
finally:
    server.shutdown()
