"""Price-alert choice in Settings: hidden until the site says the daily job runs, remembered on this device, French.
No live network. Run: python tests/alerts-browser.py"""
import json
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
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 320, "height": 760}, service_workers="block", locale="en-CA")
        for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/rest/v1/**", "https://api.tcgdex.net/**"):
            ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
        site = {"priceAlerts": False}
        ctx.route("**/api/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(site)))
        page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
        def settings():
            page.goto("about:blank"); page.goto(URL + "#/settings", wait_until="domcontentloaded")
            page.wait_for_function("!document.getElementById('settings').classList.contains('hidden')")
            page.locator("#pushPanel").wait_for()
        with page.expect_response("**/api/config"):
            settings()
        page.wait_for_timeout(300); assert not page.locator("#pushPrices").is_visible()

        site["priceAlerts"] = True; settings()
        box = page.locator("#pushPrices"); box.wait_for(timeout=10000)
        assert not box.is_checked()
        box.check(); page.locator("#pushGood").uncheck()
        settings(); box.wait_for(timeout=10000)
        assert box.is_checked() and not page.locator("#pushGood").is_checked() and page.locator("#pushChains").is_checked()
        page.evaluate("CardsteadI18n.set('fr')")
        page.wait_for_function("document.getElementById('pushPanel').innerText.includes('prix cible')")
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"), "sideways scroll at 320 px"
        assert not errors, errors
        print("PASS price alerts: hidden until the daily job runs, choices remembered, French, 320 px")
        b.close()
finally:
    server.shutdown()
