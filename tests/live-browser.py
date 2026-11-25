"""Open the *published* PokéFlip website in real Chromium.
Creates only test records in an isolated browser profile (no Supabase login).
"""
import os
from playwright.sync_api import sync_playwright
URL = os.getenv("POKEFLIP_URL", "https://pokeflip-studio.vercel.app/")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        service_workers="block",
        accept_downloads=False,
        locale="en-CA",
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    response = page.goto(URL, wait_until="domcontentloaded", timeout=30000)
    assert response and response.status == 200, "Production homepage not HTTP 200"
    assert page.locator(".brand-lockup img").is_visible(), "Collector crest missing"
    assert page.evaluate("getComputedStyle(document.querySelector('header')).position") == "relative"
    assert page.evaluate("getComputedStyle(document.querySelector('.tabs')).position") == "sticky"
    assert "studio-horizon.svg" in page.evaluate("getComputedStyle(document.querySelector('section>h1')).backgroundImage")
    # Four tabs since 25 Nov 2026 (Prices, Drops, My cards, Settings); Prices opens first.
    assert page.locator(".tab").count() == 4
    assert page.locator("section#prices").is_visible()
    for target in ("prices","sets","restock","calendar","deals","mycards","settings","deal","ebay","sealed"):
        page.evaluate(f"CardsteadNav.show('{target}')")
        assert page.locator(f"section#{target}").is_visible(), target
    # A temporary card in this isolated profile only (no cloud account).
    page.evaluate("pokeflipLedger.addCard({name:'Temporary live QA card',idCode:'sv01-25',lang:'en',finish:'Holo',target:'1'})")
    data = page.evaluate("JSON.parse(localStorage.getItem('pokeflip-v1'))")
    assert data and len(data["items"]) == 1 and data["items"][0]["target"] == 1 and data["lots"][0]["mycards"] is True
    page.evaluate("CardsteadNav.show('mycards')")
    assert "Temporary live QA card" in page.locator("#myCards").inner_text()
    assert not errors, "JavaScript errors in hosted app: " + repr(errors)
    print("PASS live hosted Chromium: HTTP 200, four tabs, every page, temporary card in My cards, zero page errors")
    context.close()
    browser.close()
