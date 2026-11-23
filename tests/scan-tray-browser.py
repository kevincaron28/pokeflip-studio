"""Scanner tray at phone width (EN + FR): undo the last photo, remove any recent photo from the strip, review and
undo cards saved this session, remembered language/condition/finish. No OCR or network involved.
Set PACK_SHOTS=<folder> for screenshots. Run: python tests/scan-tray-browser.py"""
import json, os
from base64 import b64decode
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
PNG = b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZtacAAAAASUVORK5CYII=")
photos = [{"name": f"card{i}.png", "mimeType": "image/png", "buffer": PNG} for i in range(1, 4)]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for lang in ("en", "fr"):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", locale="fr-CA" if lang == "fr" else "en-CA")
            for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/api/**", "https://cdn.jsdelivr.net/npm/tesseract*/**"):
                ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
            page = ctx.new_page(); errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
            page.wait_for_function("typeof CardsteadNav!=='undefined'")
            # A purchase lot to save cards into.
            page.evaluate("CardsteadNav.show('lots')")
            page.locator('#lotForm [name="name"]').fill("Tray test"); page.locator('#lotForm [name="cost"]').fill("10"); page.locator("#lotForm button").click()
            page.evaluate("CardsteadNav.show('scan')")
            page.evaluate("document.querySelector('#autoOCR').checked=false")
            tray = page.locator("#scanTray")
            undo = tray.locator("[data-tray-undo]")
            assert undo.is_disabled(), "Undo only lights up when there is a photo to remove"
            page.locator("#photoInput").set_input_files(photos)
            page.wait_for_function("document.querySelectorAll('#scanTray .tray-item').length===3")
            assert tray.locator(".tray-current").count() == 1
            # 1. Undo the last photo: one tap.
            undo.click()
            assert tray.locator(".tray-item").count() == 2
            # 2. Save the card on screen; it appears in "saved this scan session".
            page.locator("#cardName").fill("Pikachu ex"); page.locator("#cardId").fill("sv8-57")
            page.evaluate("document.getElementById('cardForm').requestSubmit()")
            page.wait_for_function("document.querySelectorAll('#scanTray .tray-list li').length===1")
            if SHOTS: tray.screenshot(path=f"{SHOTS}/scan-tray-{lang}-390.png")
            # 3. Remove the already-saved photo from the strip with its ×.
            tray.locator(".tray-done [data-tray-remove]").click()
            assert tray.locator(".tray-item").count() == 1 and tray.locator(".tray-current").count() == 1
            # 4. Undo the saved card: it leaves the inventory.
            db = json.loads(page.evaluate("localStorage.getItem('pokeflip-v1')"))
            assert [i["name"] for i in db["items"]] == ["Pikachu ex"], db["items"]
            tray.locator("[data-tray-undo-card]").click()
            db = json.loads(page.evaluate("localStorage.getItem('pokeflip-v1')"))
            assert db["items"] == [], db["items"]
            assert tray.locator(".tray-list li").count() == 0
            # 5. Language / condition / finish are remembered for the next scan.
            page.select_option("#scanLang", "en" if lang == "fr" else "fr")
            chosen = page.locator("#scanLang").input_value()
            page.reload(); page.wait_for_function("typeof CardsteadNav!=='undefined'")
            assert page.locator("#scanLang").input_value() == chosen
            label = page.locator("#scanTray [data-tray-undo]").inner_text()
            assert ("Annuler la dernière photo" if lang == "fr" else "Undo last photo") in label, label
            assert not errors, errors
            print(f"PASS scan tray ({lang}, 390 px): undo last photo, remove from strip, saved-session review and undo, remembered defaults")
            ctx.close()
        b.close()
finally:
    server.shutdown()
