"""My area & stores: Québec defaults, store toggles, followed regions and the inbox "My stores" filter.
No live network (shop catalogues are mocked). Set PACK_SHOTS=<folder> to save a screenshot.
Run: python tests/area-stores-browser.py"""
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
hub = [{"id": "a1", "source": "pokennoisseur", "product": "Surging Sparks Booster Bundle", "retailer": "Collect-Edition", "price": 59.99, "currency": "CAD", "url": "https://collect-edition.com/", "status": "in", "observedAt": "2026-11-23T14:00:00.000Z", "notes": ""},
       {"id": "a2", "source": "pokennoisseur", "product": "Surging Sparks Booster Bundle", "retailer": "401 Games", "price": 61.99, "currency": "CAD", "url": "https://store.401games.ca/", "status": "in", "observedAt": "2026-11-23T13:00:00.000Z", "notes": ""}]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        ctx.route("**/products.json*", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"products":[]}'))
        ctx.route("https://tcgplayer-cdn.tcgplayer.com/**", lambda r: r.fulfill(status=404, body=""))
        ctx.add_init_script(f"localStorage.setItem('pokeflip-alert-hub-v1', {json.dumps(json.dumps(hub))});")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
        page.wait_for_function("typeof go==='function'")
        page.evaluate("go('restock')")
        assert page.locator("#areaProvince").input_value() == "QC"
        assert page.locator("#areaRegion").input_value() == "", "region is never guessed"
        summary = page.locator("#areaSummary").inner_text()
        assert summary.startswith("Québec: following"), summary
        # Every Québec region and the Canada-wide online shops are followed by default; Ontario is not.
        checked = page.eval_on_selector_all("#restockRegions label", "ls=>ls.filter(l=>l.querySelector('input').checked).map(l=>l.innerText)")
        assert any("Montréal" in c for c in checked) and any("Outaouais" in c for c in checked) and any("Canada-wide" in c for c in checked), checked
        assert not any("Toronto" in c for c in checked), checked
        # The inbox defaults to "My stores": the Québec shop shows, the Ontario shop does not.
        assert page.locator("#alertsFilter").input_value() == "mine"
        page.locator("#alertsRows .alert-card").first.wait_for(timeout=15000)
        inbox = page.locator("#alertsRows").inner_text()
        assert "Collect-Edition" in inbox and "401 Games" not in inbox, inbox
        page.select_option("#alertsFilter", "all")
        assert "401 Games" in page.locator("#alertsRows").inner_text()
        # Set a region and city, untick one store.
        page.select_option("#areaRegion", "south-shore")
        page.fill("#areaCity", "Longueuil"); page.locator("#areaCity").dispatch_event("change")
        page.locator(".area-stores > summary").click()
        first = page.locator(".area-group").first
        assert "Local card shops near you" in first.inner_text()
        before = page.locator("#areaSummary").inner_text()
        first.locator("input[type=checkbox]").first.uncheck()
        after = page.locator("#areaSummary").inner_text()
        assert before != after and after.startswith("Longueuil, South Shore (Rive-Sud), Québec: following"), (before, after)
        saved = json.loads(page.evaluate("localStorage.getItem('cardstead-area-v1')"))
        assert saved["region"] == "south-shore" and saved["city"] == "Longueuil" and len(saved["off"]) == 1, saved
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 1, overflow
        if SHOTS:
            page.locator("#areaPanel").screenshot(path=f"{SHOTS}/area-stores-390.png")
        assert not errors, errors
        print("PASS my area & stores: Québec default, no guessed city, region/city saved, store toggle, inbox My stores filter")
        browser.close()
finally:
    server.shutdown()
