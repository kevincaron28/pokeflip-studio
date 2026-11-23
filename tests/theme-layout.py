"""Visual-layout acceptance for the redesigned app, served from the actual checkout."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from functools import partial
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
url = f"http://127.0.0.1:{server.server_port}/"
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for width, height in ((1440, 900), (390, 844)):
            ctx = browser.new_context(viewport={"width": width, "height": height}, service_workers="block")
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            assert response and response.status == 200
            page.locator(".brand-lockup img").wait_for(timeout=12000)
            assert page.locator(".brand-lockup").is_visible()
            assert page.locator(".tab").count() == 5  # Home, Prices, Watch, Collection, Settings
            assert page.evaluate("getComputedStyle(document.querySelector('.brand-lockup')).display") == "flex"
            assert page.evaluate("getComputedStyle(document.querySelector('section>h1')).backgroundImage").find("studio-horizon.svg") > -1
            assert page.evaluate("document.styleSheets.length") >= 2
            header_pos = page.evaluate("getComputedStyle(document.querySelector('header')).position")
            nav_pos = page.evaluate("getComputedStyle(document.querySelector('.tabs')).position")
            assert (header_pos, nav_pos) == (("fixed", "fixed") if width == 1440 else ("relative", "sticky"))
            if width <= 760:
                assert page.locator(".mobile-dock").is_visible()
                assert not page.locator(".tabs").is_visible()
                page.locator('.dock-item[data-dock="inventory"]').click(); page.locator('#subnav [data-page="scan"]').click()
            else:
                page.locator('.tabs [data-tab="inventory"]').click(); page.locator('#subnav [data-page="scan"]').click()
            assert page.locator("section#scan").is_visible()
            if width <= 760:
                page.locator('.dock-item[data-dock="inventory"]').click()
            else:
                page.locator('.tabs [data-tab="inventory"]').click()
            assert page.locator("section#inventory").is_visible()
            assert not errors, errors
            print(f"PASS collector layout: viewport {width}x{height}, navigation and CSS active, zero runtime errors")
            ctx.close()
        browser.close()
finally:
    server.shutdown()
