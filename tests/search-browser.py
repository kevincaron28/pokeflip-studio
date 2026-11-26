"""Prices search and Add a card at phone width, with the card database (TCGdex) mocked: any card of any set is
found, a French name is translated, "Show more" works, the card opens, and Add a card names the set, leaves out
phone-game cards and shows a placeholder when there is no picture. Run: python tests/search-browser.py"""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import unquote
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
DB = {
    "fr/sets": [{"id": "base1", "name": "Set de Base"}], "en/sets": [{"id": "base1", "name": "Base Set"}],
    "fr/cards?name=dracaufeu": [{"id": "base1-4", "localId": "4", "name": "Dracaufeu"}],
    "en/cards/base1-4": {"id": "base1-4", "localId": "4", "name": "Charizard"},
}
ADD = [{"id": "base1-4", "localId": "4", "name": "Dracaufeu"}, {"id": "A1-036", "localId": "036", "name": "Dracaufeu"}]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block", locale="fr-CA")
        for pat in ("https://tcgplayer-cdn.tcgplayer.com/**", "**/api/**"):
            ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
        def tcgdex(route):
            path = unquote(route.request.url.split("/v2/", 1)[1])
            body = ADD if "pagination" in path and path.startswith("fr/cards?name=Dracaufeu") else DB.get(path)
            route.fulfill(status=200 if body is not None else 404, content_type="application/json", body=json.dumps(body))
        ctx.route("https://api.tcgdex.net/**", tcgdex)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
        page.locator("#pricesResults .prod-list").first.wait_for(timeout=20000)
        results = page.locator("#pricesResults")
        # A card outside the watched list, by its number.
        page.fill("#pricesSearch", "charizard 4/102")
        page.wait_for_function("document.querySelector('#pricesResults').innerText.includes('Base Set ·')", timeout=20000)
        # A French name.
        page.fill("#pricesSearch", "dracaufeu")
        page.wait_for_function("document.querySelector('#pricesResults').innerText.includes('Résultats pour « charizard »')", timeout=20000)
        assert page.locator("#pricesResults .prod-row").count() == 40
        page.locator("#pricesResults [data-more]").click()
        assert page.locator("#pricesResults .prod-row").count() == 80
        page.locator("#pricesResults .prod-row").first.click()
        page.wait_for_function("document.querySelector('#productView h1')", timeout=15000)
        view = page.locator("#productView").inner_text()
        assert "Charizard" in view and "$" in view and "Liste de surveillance eBay" not in view, view[:600]
        # Add a card: set name, no phone-game card, a placeholder without a picture.
        page.evaluate("CardsteadNav.show('mycards')")
        page.locator("#mcAddBtn").click()
        page.select_option("#mcLang", "fr")
        page.fill("#mcQuery", "Dracaufeu"); page.locator("#mcQuery").press("Enter")
        page.locator(".mc-result").first.wait_for(timeout=15000)
        assert page.locator(".mc-result").count() == 1
        text = page.locator(".mc-result").inner_text()
        assert "Set de Base · #4" in text and "base1-4" not in text, text
        box = page.locator(".mc-result .pic-ph").bounding_box()
        assert box and round(box["width"]) == 44, box
        assert page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 1
        assert not errors, errors
        print("PASS search: any card, French name, show more, product view, Add a card with set names")
        browser.close()
finally:
    server.shutdown()
