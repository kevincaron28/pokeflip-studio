"""Pack value tab in Chromium at desktop and phone width: the snapshot loads lazily, the list
renders and filters, a set's detail opens with its EV breakdown and sources, no horizontal page
scroll at 390 px, zero runtime errors. Set PACK_SHOTS=<folder> to save screenshots.
Run: python tests/pack-ev-browser.py"""
import os
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
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for width, height in ((1440, 1000), (390, 844)):
            ctx = browser.new_context(viewport={"width": width, "height": height}, service_workers="block", locale="en-CA")
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.goto(url, wait_until="domcontentloaded")
            # Home (the start page) loads the price snapshot for its verdicts; Pack value reuses it.
            page.wait_for_function("!!window.CardsteadPackData", timeout=15000)
            if width <= 760:
                page.locator('.dock-item[data-dock="prices"]').click()
                page.locator('#subnav [data-page="packs"]').click()
            else:
                page.locator('[data-tab="prices"]').click()
                page.locator('#subnav [data-page="packs"]').click()
            page.locator(".pack-table tbody tr").first.wait_for(timeout=15000)
            assert page.locator("section#packs").is_visible()
            status = page.locator("#packStatus").inner_text()
            assert "as of" in status and "Bank of Canada" in status, status
            total = page.locator(".pack-table tbody tr").count()
            assert total >= 20, total
            page.select_option("#packEra", "me")
            assert 0 < page.locator(".pack-table tbody tr").count() < total
            page.select_option("#packEra", "")
            page.fill("#packSearch", "surging")
            assert page.locator(".pack-table tbody tr").count() == 1
            if SHOTS and width <= 760:
                page.fill("#packSearch", "")
                page.screenshot(path=f"{SHOTS}/pack-list-{width}.png", full_page=False)
                page.fill("#packSearch", "surging")
            page.locator(".pack-table tbody tr").first.click()
            detail = page.locator("#packDetail")
            detail.wait_for(state="visible")
            text = detail.inner_text()
            for must in ("Surging Sparks booster pack", "EV by rarity slot", "Top hits", "Sources", "Pull rates:", "MSRP"):
                assert must in text, must
            page.fill("#packYourPrice", "7.99")
            assert page.locator("#packYourResult").inner_text().strip()
            page.locator("#packFees").check()
            assert "after 13.25% selling fees" in detail.inner_text()
            overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert overflow <= 1, f"horizontal page scroll at {width}px: {overflow}px"
            if SHOTS:
                page.screenshot(path=f"{SHOTS}/pack-detail-{width}.png", full_page=True)
                if width > 760:
                    page.locator("#packClose").click()
                    page.fill("#packSearch", "")
                    page.locator("#packFees").uncheck()
                    page.screenshot(path=f"{SHOTS}/pack-list-{width}.png", full_page=False)
            assert not errors, errors
            print(f"PASS pack value tab at {width}x{height}: {total} sets, detail, filters, no overflow, no errors")
            ctx.close()
        browser.close()
finally:
    server.shutdown()
