"""Phase 2 at phone width: older cards shown in My cards, Settings help folded, 2-field watch form with the format
detected from the product name and the area from My area & stores, catalog suggestions, and data saved by an
older version (purchase lot, cards, a watch with old fields) still loading. Set PACK_SHOTS=<folder> for screenshots.
Run: python tests/phase2-browser.py"""
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
# Saved by the previous version: a lot, two cards and a watch made with the old 8-field form.
old_db = {"lots": [{"id": "L1", "name": "Old lot", "cost": 50, "date": "2026-11-01", "source": "Kijiji", "notes": ""}],
          "items": [{"id": "i1", "lotId": "L1", "name": "Pikachu ex", "idCode": "sv8-57", "lang": "fr", "condition": "Near Mint", "finish": "Holo", "qty": 1, "unitPrice": 20, "unitCost": 5, "location": "B-SINGLES", "category": "single", "status": "stored", "image": "", "created": "2026-11-01"},
                    {"id": "i2", "lotId": "L1", "name": "Bulk Commons", "idCode": "", "lang": "en", "condition": "Mixed / not graded", "finish": "Mixed", "qty": 200, "unitPrice": 0.05, "unitCost": None, "location": "D-BULK-EN", "category": "bulk", "status": "stored", "image": "", "created": "2026-11-01"}],
          "sales": []}
old_restock = {"watches": [{"id": "w0", "product": "Prismatic Evolutions Booster Bundle", "format": "bundle", "language": "fr", "region": "Montérégie / Canada", "ceiling": 80, "enabled": True, "quantity": 2, "limit": 2}], "observations": []}
area = {"province": "QC", "region": "south-shore", "city": "Longueuil", "on": [], "off": []}
SEED = "".join(f"localStorage.setItem({json.dumps(k)},{json.dumps(json.dumps(v))});" for k, v in
               (("pokeflip-v1", old_db), ("pokeflip-restock-v1", old_restock), ("cardstead-area-v1", area), ("pokeflip-restock-regions-v1", [])))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", locale="en-CA")
        for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/api/**"):
            ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
        ctx.add_init_script("if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');" + SEED + "}")
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
        page.wait_for_function("typeof CardsteadNav!=='undefined'")
        # The scanner and Business pages are gone; the older version's cards show in My cards.
        assert page.locator("section#dashboard, section#scan, section#inventory").count() == 0
        assert page.locator("h2", has_text="Getting started").count() == 0
        page.evaluate("CardsteadNav.show('mycards')")
        inv = page.locator("#myCards").inner_text()
        assert "Pikachu ex" in inv and "Bulk Commons" in inv, inv
        height = page.evaluate("document.querySelector('#mycards').scrollHeight")
        if SHOTS: page.screenshot(path=f"{SHOTS}/after2-mycards-en-390.png", full_page=True)
        # Settings: help folded into one section.
        page.evaluate("CardsteadNav.show('settings')")
        help_ = page.locator("#settingsHelp")
        assert help_.count() == 1 and not help_.evaluate("d=>d.open")
        assert help_.locator("h2", has_text="Fast checkout tips").count() == 1
        if SHOTS: page.screenshot(path=f"{SHOTS}/after2-settings-en-390.png", full_page=True)
        # Watch form: two fields, the rest under More options; area from My area & stores.
        page.evaluate("CardsteadNav.show('restock')")
        assert page.locator("#restockProduct").is_visible() and page.locator("#restockCeiling").is_visible()
        assert not page.locator("#restockFormat").is_visible() and not page.locator("#restockAutoUrl").is_visible()
        assert page.locator("#restockArea").input_value() == "Longueuil, South Shore (Rive-Sud)"
        page.wait_for_function("document.querySelectorAll('#restockCatalog option').length>500", timeout=20000)
        if SHOTS: page.locator("#restockWatchForm").screenshot(path=f"{SHOTS}/after2-watchform-en-390.png")
        page.fill("#restockProduct", "Surging Sparks Elite Trainer Box"); page.fill("#restockCeiling", "160")
        page.locator("#restockWatchForm button[type=submit]").click()
        saved = json.loads(page.evaluate("localStorage.getItem('pokeflip-restock-v1')"))
        new = [w for w in saved["watches"] if w["product"] == "Surging Sparks Elite Trainer Box"][0]
        assert new["format"] == "etb" and new["region"] == "Longueuil, South Shore (Rive-Sud)" and new["ceiling"] == 160, new
        old = [w for w in saved["watches"] if w["id"] == "w0"][0]
        assert old == old_restock["watches"][0], old   # the old watch is untouched
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 1, overflow
        assert not errors, errors
        print(f"PASS phase 2 (390 px): My cards {height}px with the older cards, Settings help folded, 2-field watch form (format etb detected, area defaulted), catalog suggestions, old data kept")
        b.close()
finally:
    server.shutdown()
