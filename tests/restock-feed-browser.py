"""Recent restocks on the Drops page: hidden until the database answers, my stores / every shop, paused checks said
plainly, French, narrow phone. No live network. Run: python tests/restock-feed-browser.py"""
import json
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{server.server_port}/"
ago = lambda **k: (datetime.now(timezone.utc) - timedelta(**k)).isoformat()
def item(name, host, **k):
    return {"name": name, "lang": "EN", "store": host, "store_name": "Shop " + name, "city": "Calgary", "url": f"https://{host}/products/x",
            "price_cad": 59.99, "in_stock": True, "seen_at": ago(hours=2), "market_cad": 48.5, "market_as_of": "2026-11-25", "image": None, **k}
# A Canada-wide online shop is followed by default; an Alberta local shop is not for a new Québec user.
FEED = {"checked_at": ago(minutes=3), "shops_checked": 41, "items": [
    item("Followed <b>box</b>", "shopverse.com"), item("Far away tin", "bentogaming.ca", in_stock=False, seen_at=ago(hours=1))]}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 320, "height": 760}, service_workers="block", locale="en-CA")
        for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/api/**", "https://api.tcgdex.net/**"):
            ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
        answer = {"status": 404, "body": {"message": "Could not find the function"}}; asked = []
        def rpc(r):
            asked.append(r.request.headers.get("apikey"))
            r.fulfill(status=answer["status"], content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps(answer["body"]))
        ctx.route("**/rest/v1/rpc/restock_feed", rpc)
        page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
        def drops():
            page.goto("about:blank"); page.goto(URL + "#/drops", wait_until="domcontentloaded")
            page.wait_for_function("window.CardsteadRestockFeed && !document.getElementById('restock').classList.contains('hidden')")

        # Nothing is asked until Drops is opened; before the database function exists the panel stays away.
        page.goto(URL, wait_until="domcontentloaded"); page.wait_for_function("!!document.body.dataset.group")
        page.wait_for_timeout(500); assert asked == [], asked
        with page.expect_response("**/rpc/restock_feed"):
            page.locator('.dock-item[data-dock="restock"]').click()
        assert asked[0].startswith("sb_publishable_"), asked
        page.wait_for_timeout(300); assert not page.locator("#restockFeed").is_visible()

        answer.update(status=200, body=FEED); drops()
        panel = page.locator("#restockFeed"); panel.wait_for(timeout=10000)
        text = panel.inner_text()
        assert "Shops last checked 3 minutes ago (41 in the past hour)." in text, text
        assert "Followed <b>box</b>" in text and "Far away tin" not in text, text
        assert "Shop price $59.99" in text and "TCGplayer market price $48.50" in text and "Seen in stock 2 hours ago" in text, text
        page.locator("#feedMine").uncheck()
        text = panel.inner_text()
        assert "Far away tin" in text and "Sold out 1 hour ago" in text, text
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"), "sideways scroll at 320 px"
        page.evaluate("CardsteadI18n.set('fr')")
        text = panel.inner_text()
        assert "Arrivages récents" in text and "Boutiques vérifiées il y a 3 minutes" in text and "Épuisé" in text, text

        # Stopped checks are said plainly.
        answer.update(body={**FEED, "checked_at": ago(hours=6), "shops_checked": 0}); drops()
        page.locator("#restockFeed .feed-paused").wait_for(timeout=10000)
        assert "arrêtées" in page.locator("#restockFeed .feed-paused").inner_text()
        assert not errors, errors
        print("PASS recent restocks: hidden without the database function, my stores / all shops, paused checks, French, 320 px")
        b.close()
finally:
    server.shutdown()
