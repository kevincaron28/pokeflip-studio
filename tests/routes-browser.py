"""Page addresses: Back and Forward, links straight to a page, a set, a product or a card, the share button,
titles in both languages and ?lang=fr. No live network. Run: python tests/routes-browser.py"""
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
SITE = "https://pokeflip-studio.vercel.app/"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", locale="en-CA")
        ctx.route("**/rpc/restock_feed", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"items":null}'))  # no live network
        for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/api/**", "https://api.tcgdex.net/**"):
            ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
        ctx.add_init_script("navigator.share=async d=>{window.__shared=d}")
        page = ctx.new_page(); errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
        def at(section, hash_):
            page.wait_for_function("([s,h])=>!document.getElementById(s).classList.contains('hidden')&&location.hash===h", arg=[section, hash_], timeout=20000)
        def load(path=""):
            page.goto("about:blank"); page.goto(URL + path, wait_until="domcontentloaded")
            page.wait_for_function("window.CardsteadRoutes && !!document.body.dataset.group")

        # Tabs write the address; Back and Forward follow it.
        load()
        assert page.title().startswith("Cardstead |"), page.title()
        page.locator('.dock-item[data-dock="restock"]').click(); at("restock", "#/drops")
        assert page.title() == "Drops · Cardstead", page.title()
        page.locator('.dock-item[data-dock="mycards"]').click(); at("mycards", "#/watchlist")
        page.go_back(); at("restock", "#/drops")
        page.go_back(); at("prices", "")
        page.go_forward(); at("restock", "#/drops")

        # A product: address, title, share, the on-screen Back, and a link straight to it.
        load()
        page.fill("#pricesSearch", "surging bb")
        page.locator("#pricesResults .prod-row").first.wait_for(timeout=20000)
        page.locator("#pricesResults .prod-row").first.click()
        page.wait_for_function("location.hash.startsWith('#/product/sealed%3A')")
        link = page.evaluate("location.hash")
        assert page.title() == "Surging Sparks Booster Box · Cardstead", page.title()
        page.locator("#productView [data-share]").click()
        page.wait_for_function("window.__shared")
        assert page.evaluate("window.__shared") == {"title": "Surging Sparks Booster Box", "url": SITE + link}
        page.locator("#productView [data-back]").click(); at("prices", "")
        page.go_forward(); at("product", link)
        load(link); at("product", link)
        assert "Surging Sparks Booster Box" in page.locator("#productView h1").inner_text()
        page.locator("#productView [data-back]").click(); at("prices", "#/")
        # A card that is only in the full card index.
        card = json.loads((ROOT / "data/sets/cards.json").read_text(encoding="utf-8"))["cards"][100]
        ref = f"card:{card[0]}" + (f":{card[4]}" if card[4] else "")
        load("#/product/" + ref.replace(":", "%3A").replace(" ", "%20")); page.wait_for_function("document.querySelector('#productView h1')", timeout=20000)
        assert card[1] in page.locator("#productView h1").inner_text()
        # A link to a product that does not exist shows Prices.
        load("#/product/sealed%3A1"); at("prices", "#/product/sealed%3A1")

        # A set.
        load("#/sets"); at("sets", "#/sets")
        page.locator("#setsView [data-set]").first.wait_for(timeout=20000)
        page.locator("#setsView [data-set]").first.click()
        page.wait_for_function("/^#\\/sets\\/\\d+$/.test(location.hash)")
        link = page.evaluate("location.hash")
        page.locator("#setsView [data-sets-back]").wait_for(timeout=20000)
        page.locator("#setsView [data-sets-back]").click(); at("sets", "#/sets")
        page.locator("#setsView [data-set]").first.wait_for(timeout=10000)
        page.go_forward(); at("sets", link); page.locator("#setsView .sets-head h2").wait_for(timeout=20000)
        load(link); page.locator("#setsView .sets-head h2").wait_for(timeout=20000)
        name = page.locator("#setsView .sets-head h2").inner_text()
        page.wait_for_function("n=>document.title===n+' · Cardstead'", arg=name)
        page.locator("#setsView [data-sets-back]").click(); at("sets", "#/sets")
        page.locator("#setsView [data-set]").first.wait_for(timeout=10000)

        # Sign-in links keep working: their address is not ours.
        load("#access_token=abc&refresh_token=def"); at("prices", "#access_token=abc&refresh_token=def")

        # French: ?lang=fr for someone who has not chosen; a chosen language wins.
        load("?lang=fr#/drops"); at("restock", "#/drops")
        assert page.title() == "Arrivages · Cardstead", page.title()
        load("?lang=fr")
        assert page.title().startswith("Cardstead | Prix des cartes"), page.title()
        assert page.evaluate("document.querySelector('link[rel=canonical]').href") == SITE + "?lang=fr"
        assert "dollars canadiens" in page.evaluate("document.querySelector('meta[name=description]').content")
        page.evaluate("CardsteadI18n.set('en')"); load("?lang=fr")
        assert page.title().startswith("Cardstead | Pokémon card prices"), page.title()
        assert not errors, errors
        print("PASS page addresses: back/forward, product, card and set links, share, titles, ?lang=fr, sign-in links untouched")
        b.close()
finally:
    server.shutdown()
