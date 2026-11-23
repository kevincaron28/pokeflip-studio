"""eBay deals tab with a mocked /api/ebay-search (no live eBay). Checks the setup notice when keys are
missing, a scan that keeps only real matches, the under/over verdicts with value dates, the Best deals
list, removing a card and adding your own. Set PACK_SHOTS=<folder> to save a screenshot.
Run: python tests/ebay-deals-browser.py"""
import json, os, subprocess
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = os.environ.get("PACK_SHOTS")
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
cards = json.loads(subprocess.check_output(["node", "-e", "const c=require('./sought-cards.js').cards;const d=require('./pack-ev-data.js');console.log(JSON.stringify(c.map(x=>({id:x.id,name:x.name,number:x.number,set:x.set,grade:x.grade,q:x.ebayQuery,usd:d.cardPrices[x.tcgplayerProductId+'|'+x.printing]||x.marketUsd}))))"], cwd=str(ROOT)))
keep = [c for c in cards if c["grade"] == "raw" and c["usd"] and c["usd"] > 50][:2]
assert len(keep) == 2
fx = json.loads(subprocess.check_output(["node", "-e", "console.log(require('./pack-ev-data.js').fx.usdToCad)"], cwd=str(ROOT)))
prefs = {"removed": [c["id"] for c in cards if c not in keep], "custom": [], "targets": {}, "threshold": 0.1, "auto": False}

def listings(card):
    value = card["usd"] * fx
    label = f'{card["name"]} {card["number"]} {card["set"]}'
    return [
        {"id": card["id"] + "-cheap", "title": label + " NM", "price": round(value * 0.7, 2), "currency": "CAD", "shipping": 5.0, "shippingCurrency": "CAD", "url": "https://www.ebay.ca/itm/1", "image": None, "condition": "Ungraded", "country": "CA", "seller": "cardshop", "feedback": 99.8},
        {"id": card["id"] + "-high", "title": label, "price": round(value * 1.5, 2), "currency": "CAD", "shipping": 0, "shippingCurrency": "CAD", "url": "https://www.ebay.ca/itm/2", "image": None, "condition": "Ungraded", "country": "US", "seller": "other", "feedback": 100},
        {"id": card["id"] + "-proxy", "title": label + " PROXY", "price": 3.0, "currency": "CAD", "shipping": 0, "url": "https://www.ebay.ca/itm/3"},
        {"id": card["id"] + "-graded", "title": "PSA 10 " + label, "price": 5.0, "currency": "CAD", "shipping": 0, "url": "https://www.ebay.ca/itm/4"},
    ]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for configured in (False, True):
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
            queries = []
            def api(route):
                q = parse_qs(urlparse(route.request.url).query)
                if not configured:
                    return route.fulfill(status=503, content_type="application/json", body=json.dumps({"configured": False, "message": "not set up"}))
                if q.get("status"):
                    return route.fulfill(status=200, content_type="application/json", body='{"configured":true}')
                queries.append(q["q"][0])
                card = next(c for c in keep if c["q"] == q["q"][0])
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"configured": True, "fetchedAt": "2026-11-23T15:00:00.000Z", "items": listings(card)}))
            ctx.route("**/api/ebay-search*", api)
            ctx.add_init_script(f"localStorage.setItem('cardstead-ebay-watch-v1', {json.dumps(json.dumps(prefs))});")
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
            page.wait_for_function("typeof go==='function'")
            page.locator('.dock-item[data-dock="restock"]').click()
            page.locator('#subnav [data-page="deals"]').click()
            page.wait_for_function("document.querySelector('#dealsWatchCount').innerText.includes('cards watched')", timeout=15000)
            assert "2 cards watched" in page.locator("#dealsWatchCount").inner_text()
            if not configured:
                page.locator("#dealsSetup").wait_for(state="visible", timeout=10000)
                assert "eBay not connected yet" in page.locator("#dealsSetup").inner_text() and "EBAY_CLIENT_ID" in page.locator("#dealsSetup").inner_text()
                assert page.locator("#dealsScan").is_disabled()
                print("PASS eBay deals without keys: setup steps shown, scan disabled, watchlist still works")
            else:
                page.wait_for_function("!document.querySelector('#dealsScan').disabled", timeout=10000)
                assert not page.locator("#dealsSetup").is_visible()
                page.locator("#dealsScan").click()
                page.wait_for_function("document.querySelector('#dealsMessage').innerText.startsWith('Scan finished')", timeout=30000)
                assert sorted(queries) == sorted(c["q"] for c in keep), queries
                deals = page.locator("#dealsList .alert-card")
                assert deals.count() == 2, deals.count()   # only the cheap real listings: no proxy, no graded copy, no overpriced one
                text = deals.first.inner_text()
                for must in ("eBay listing", "Price + shipping", "Market value", "as of", "Under value by", "View on eBay"):
                    assert must.lower() in text.lower(), (must, text)
                assert "proxy" not in page.locator("#dealsList").inner_text().lower()
                assert "ac-under" in deals.first.get_attribute("class")
                if SHOTS:
                    deals.first.screenshot(path=f"{SHOTS}/ebay-deal-390.png")
                # Remove one card, add one of your own.
                page.locator("#dealsWatch .deal-watch button").first.click()
                assert "1 cards watched" in page.locator("#dealsWatchCount").inner_text()
                page.fill("#dealsAddName", "Pikachu ex"); page.fill("#dealsAddQuery", "pikachu ex 238/191 surging sparks"); page.fill("#dealsAddValue", "300")
                page.locator("#dealsAddForm button[type=submit]").click()
                assert "2 cards watched" in page.locator("#dealsWatchCount").inner_text() and "1 added by you" in page.locator("#dealsWatchCount").inner_text()
                overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                assert overflow <= 1, overflow
                print("PASS eBay deals with keys: scan, bad matches filtered, under-value cards with dated values, remove and add cards")
            assert not errors, errors
            ctx.close()
        browser.close()
finally:
    server.shutdown()
