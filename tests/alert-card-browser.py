"""Restock and price-drop alert cards in the real app shell, at phone and desktop width.
Seeds one watch with two checks (a price drop) and one imported alert, then checks that each card
shows store, price, status, MSRP, market value with its date, contents EV and a coloured verdict.
Set PACK_SHOTS=<folder> to save screenshots. Run: python tests/alert-card-browser.py"""
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
url = f"http://127.0.0.1:{server.server_port}/"
restock = {"watches": [{"id": "w1", "product": "Surging Sparks Elite Trainer Box", "format": "etb", "language": "en", "region": "Montréal", "ceiling": 200, "enabled": True}],
           "observations": [
               {"id": "o1", "watchId": "w1", "status": "in", "price": 179.99, "checkedAt": "2026-11-22T15:00:00.000Z", "store": "EB Games", "url": "https://www.ebgames.ca/", "source": "manual"},
               {"id": "o2", "watchId": "w1", "status": "in", "price": 149.99, "checkedAt": "2026-11-23T15:00:00.000Z", "store": "EB Games", "url": "https://www.ebgames.ca/", "source": "manual"}]}
hub = [{"id": "a1", "source": "pokennoisseur", "product": "Pokemon Surging Sparks Booster Box", "retailer": "Costco.ca", "price": 249.99, "currency": "CAD",
        "url": "https://www.costco.ca/", "status": "in", "observedAt": "2026-11-23T14:00:00.000Z", "notes": ""}]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for width, height in ((1280, 1000), (390, 844)):
            ctx = browser.new_context(viewport={"width": width, "height": height}, service_workers="block")
            ctx.route("https://tcgplayer-cdn.tcgplayer.com/**", lambda r: r.fulfill(status=404, body=""))  # no live network
            ctx.add_init_script(f"localStorage.setItem('pokeflip-restock-v1', {json.dumps(json.dumps(restock))});"
                                f"localStorage.setItem('pokeflip-alert-hub-v1', {json.dumps(json.dumps(hub))});")
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function("typeof go==='function'")
            page.evaluate("go('restock')")
            card = page.locator("#restockWatches .alert-card").first
            card.wait_for(timeout=15000)
            text = card.inner_text()
            for must in ("Price drop", "Surging Sparks Elite Trainer Box", "EB Games", "$149.99", "In stock",
                         "$179.99 → $149.99 CAD (17% off, $30.00 lower)", "MSRP", "Market value (sealed)", "as of", "Expected value of contents"):
                assert must.lower() in text.lower(), (must, text)
            cls = card.get_attribute("class")
            assert any(c in cls for c in ("ac-under", "ac-fair", "ac-over")), cls
            box = page.locator("#alertsRows .alert-card").first
            box.wait_for(timeout=15000)
            bt = box.inner_text()
            for must in ("Restock", "Costco.ca", "$249.99", "US$161.64", "36 packs × pack EV", "Market value (sealed)"):
                assert must.lower() in bt.lower(), (must, bt)
            overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert overflow <= 1, f"horizontal scroll {overflow}px at {width}"
            if SHOTS:
                card.screenshot(path=f"{SHOTS}/alert-price-drop-{width}.png")
                box.screenshot(path=f"{SHOTS}/alert-restock-{width}.png")
            assert not errors, errors
            print(f"PASS alert cards at {width}px: price drop ({cls.split()[-1]}) and restock with value rows")
            ctx.close()
        browser.close()
finally:
    server.shutdown()
