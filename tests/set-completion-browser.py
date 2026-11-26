"""Set completion at phone width on a 250-card set: first 60 tiles drawn fast, more on scroll; tap ticks, long-press
sheet sets quantities per printing; Set vs Master; owned/missing value; filters and sort; undo; watch the missing
cards (priciest first, exact printing, TCGplayer price); My sets chip; French; no runtime errors.
Run: python tests/set-completion-browser.py"""
import json, time
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
idx = json.loads((ROOT / "data/sets/index.json").read_text(encoding="utf8"))
SET = next(s for s in idx["sets"] if s["name"] == "Surging Sparks")
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for lang in ("en", "fr"):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="fr-CA" if lang == "fr" else "en-CA", service_workers="block")
            ctx.route("**/api/**", lambda r: r.fulfill(status=503, body='{"configured":false}', content_type="application/json"))
            ctx.route("https://tcgplayer-cdn.tcgplayer.com/**", lambda r: r.fulfill(status=404, body=""))
            ctx.route("https://api.tcgdex.net/**", lambda r: r.fulfill(status=404, body=""))
            ctx.add_init_script(f"localStorage.setItem('cardstead-lang-v1','\"{lang}\"')")
            page = ctx.new_page(); errors = []
            page.on("pageerror", lambda e: errors.append(str(e))); page.on("dialog", lambda d: d.accept())
            page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="domcontentloaded")
            page.wait_for_function("typeof CardsteadNav!=='undefined'&&typeof CardsteadSetCompletion!=='undefined'")
            page.evaluate("CardsteadNav.show('sets')"); page.wait_for_selector("#setsSearch")
            page.fill("#setsSearch", SET["name"])
            t0 = time.time(); page.locator(f'[data-set="{SET["id"]}"]').click(); page.wait_for_selector("#scGrid li"); ms = (time.time() - t0) * 1000
            assert page.locator("#scGrid li").count() == 60, "first batch only"
            count = page.locator("#scProgress .sc-count").inner_text()
            assert ("0 of 191" if lang == "en" else "0 sur 191") in count and ("61 secret" if lang == "en" else "61 secrètes") in count, count
            tiles = page.locator("#scGrid li")
            for i in range(3): tiles.nth(i).locator(".sc-tap").click()
            assert page.locator("#scGrid li.own").count() == 3
            assert ("3 of 191" if lang == "en" else "3 sur 191") in page.locator("#scProgress .sc-count").inner_text()
            box = tiles.nth(3).locator(".sc-tap").bounding_box()
            page.mouse.move(box["x"] + 20, box["y"] + 20); page.mouse.down(); page.wait_for_timeout(700); page.mouse.up()
            assert page.locator("#scSheet").is_visible(), "long press opens quantities"
            page.locator("#scSheet [data-sc-inc]").first.click(); page.locator("#scSheet [data-sc-inc]").first.click(); page.locator("#scSheet [data-sc-close]").click()
            st = page.evaluate("CardsteadSetCompletion.get()")["sets"][str(SET["id"])]
            assert len(st) == 4 and max(max(v.values()) for v in st.values()) == 2, st
            page.locator('[data-sc-mode="master"]').click()
            assert ("of 417" if lang == "en" else "sur 417") in page.locator("#scProgress .sc-count").inner_text()
            page.locator('[data-sc-mode="set"]').click()
            page.locator('[data-sc-filter="owned"]').click(); assert page.locator("#scGrid li").count() == 4
            page.locator('[data-sc-filter="missing"]').click(); page.locator('[data-sort="missing-price"]').click()
            page.mouse.wheel(0, 40000); page.wait_for_timeout(600); assert page.locator("#scGrid li").count() > 60, "more cards drawn on scroll"
            page.locator("[data-sc-undo]").click()
            assert max(max(v.values()) for v in page.evaluate("CardsteadSetCompletion.get()")["sets"][str(SET["id"])].values()) == 1, "undo"
            page.locator("[data-sc-watch]").click(); page.wait_for_timeout(300)
            items = page.evaluate("pokeflipLedger.getData().items")
            assert len(items) == 150 and items[0]["tcgplayerId"] and items[0]["tcgPrint"] and items[0]["market"]["confidence"] in ("medium", "low"), items[0]
            prices = [i["market"]["cad"] for i in items if i.get("market")]
            assert prices[0] >= prices[-1], "the most valuable missing cards first"
            page.locator("[data-sets-back]").click(); page.wait_for_selector('[data-series="mine"]')
            assert page.locator(".sc-row-progress").count() >= 1
            assert not errors, errors
            print(f"PASS set completion ({lang}, 390 px): {SET['cards']} cards, first 60 drawn in {ms:.0f} ms, tap/long-press/master/filters/undo/watch missing, My sets")
            ctx.close()
        b.close()
finally:
    server.shutdown()
