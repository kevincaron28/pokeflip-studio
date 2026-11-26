"""Simplified Cardstead at phone width, English and French: four-tab dock (Prices first),
Prices search -> product view with the real price graph (7d/30d/1y) -> one-tap Watch with the detected defaults,
Advanced folded, Settings language switch. Seeded with data saved by the previous version (watch, store checks,
alerts inbox, eBay watchlist choices, area) to prove nothing is lost. Set PACK_SHOTS=<folder> for screenshots.
Run: python tests/simplify-browser.py"""
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
# Data as the previous version saved it.
restock = {"watches": [{"id": "w1", "product": "Surging Sparks Elite Trainer Box", "format": "etb", "language": "en", "region": "Montréal", "ceiling": 200, "enabled": True}],
           "observations": [{"id": "o1", "watchId": "w1", "status": "in", "price": 139.99, "checkedAt": "2026-11-23T14:00:00.000Z", "store": "EB Games", "url": "https://www.ebgames.ca/", "source": "manual"}]}
hub = [{"id": "a1", "source": "pokennoisseur", "product": "Surging Sparks Booster Box", "retailer": "Costco.ca", "price": 249.99, "currency": "CAD", "url": "https://www.costco.ca/", "status": "in", "observedAt": "2026-11-23T13:00:00.000Z", "notes": ""}]
ebay = {"removed": ["rayquaza-star-107-ex-deoxys-psa-9"], "custom": [], "targets": {}, "threshold": 0.15, "auto": False}
area = {"province": "QC", "region": "south-shore", "city": "Longueuil", "on": [], "off": []}
SEED = "".join(f"localStorage.setItem({json.dumps(k)},{json.dumps(json.dumps(v))});" for k, v in
               (("pokeflip-restock-v1", restock), ("pokeflip-alert-hub-v1", hub), ("cardstead-ebay-watch-v1", ebay), ("cardstead-area-v1", area), ("pokeflip-restock-regions-v1", [])))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for lang in ("en", "fr"):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", locale="fr-CA" if lang == "fr" else "en-CA")
            ctx.route("**/rpc/restock_feed", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"items":null}'))  # no live network
            for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/api/**"):
                ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
            ctx.add_init_script("if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');" + SEED + "}")
            page = ctx.new_page(); errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
            # Language detected from the browser; four tabs in the dock.
            assert page.locator(".dock-item").count() == 4
            labels = page.locator(".dock-item span[data-i18n]").all_inner_texts()
            assert labels == (["Prix", "Arrivages", "Liste de suivi", "Réglages"] if lang == "fr" else ["Prices", "Drops", "Watchlist", "Settings"]), labels
            # Prices opens first, with popular products and sparklines from the real price history.
            assert page.locator("section#prices").is_visible()
            page.locator("#pricesResults .prod-list").first.wait_for(timeout=20000)
            assert page.locator("#pricesResults .spark").count() >= 2, "sparklines from price history"
            if SHOTS: page.screenshot(path=f"{SHOTS}/after-prices-{lang}-390.png", full_page=True)
            # Prices: search with short words -> product view with graph, MSRP and Watch.
            page.locator('.dock-item[data-dock="prices"]').click()
            page.fill("#pricesSearch", "surging bb")
            page.locator("#pricesResults .prod-row").first.wait_for(timeout=15000)
            assert "Surging Sparks Booster Box" in page.locator("#pricesResults").inner_text()
            if SHOTS: page.screenshot(path=f"{SHOTS}/after-prices-{lang}-390.png")
            page.locator("#pricesResults .prod-row").first.click()
            page.locator("#productChart .g-svg").wait_for(timeout=15000)
            for r in ("d7", "y1", "d30"):
                page.locator(f'#productChart [data-range="{r}"]').click()
                assert page.locator("#productChart .g-svg").count() == 1, r
            assert page.locator("#productChart .g-msrp").count() == 1, "MSRP line"
            if SHOTS: page.screenshot(path=f"{SHOTS}/after-product-{lang}-390.png", full_page=True)
            page.locator("#watchBox summary").click()
            default = float(page.locator("#watchMax").input_value())
            assert default > 50, default   # today's market value, rounded down
            page.locator("#watchForm button[type=submit]").click()
            page.locator(".prod-watch .pill").wait_for(timeout=5000)
            saved = json.loads(page.evaluate("localStorage.getItem('pokeflip-restock-v1')"))
            new = [w for w in saved["watches"] if w["product"] == "Surging Sparks Booster Box"]
            assert len(saved["watches"]) == 2 and new[0]["format"] == "box" and new[0]["ceiling"] == default, saved["watches"]
            # Watch: alerts and watches visible, power tools folded under one Advanced section.
            page.locator('.dock-item[data-dock="restock"]').click()
            assert page.locator("#restockAdvanced").count() == 1 and not page.locator("#restockAdvanced").evaluate("d=>d.open")
            assert page.locator("#restockWatches .watch-row").count() == 2 and page.locator("#restockWatches .alert-card").count() == 1
            height = page.evaluate("document.querySelector('#restock').scrollHeight")
            if SHOTS: page.screenshot(path=f"{SHOTS}/after-watch-{lang}-390.png", full_page=True)
            # eBay deals keeps the old choices (one card removed, 15% threshold).
            page.locator('#subnav [data-page="deals"]').click()
            removed = "1 retirées" if lang == "fr" else "1 removed"
            page.wait_for_function("t=>document.querySelector('#dealsWatchCount').innerText.includes(t)", arg=removed, timeout=15000)
            assert page.locator("#dealsThreshold").input_value() == "15"
            # Settings: area kept, language switch.
            page.locator('.dock-item[data-dock="settings"]').click()
            assert "Longueuil" in page.locator("#areaSummary").inner_text()
            if SHOTS: page.screenshot(path=f"{SHOTS}/after-settings-{lang}-390.png")
            other = "en" if lang == "fr" else "fr"
            page.select_option("#uiLanguage", other)
            assert page.locator('.dock-item[data-dock="settings"] span[data-i18n]').inner_text() == ("Settings" if other == "en" else "Réglages")
            overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert overflow <= 1, overflow
            assert not errors, errors
            print(f"PASS simplified app ({lang}, 390 px): 4 tabs, Prices first, search -> product graph -> one-tap watch, Advanced folded (Watch page {height}px), old settings kept")
            ctx.close()
        b.close()
finally:
    server.shutdown()
