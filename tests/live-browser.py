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
    def navigate(section):
        # Since the simplified app (5 tabs): every older page is still reachable through CardsteadNav.
        if page.evaluate("typeof CardsteadNav!=='undefined'"):
            page.evaluate(f"CardsteadNav.show('{section}')")
        elif not page.locator(".mobile-dock").is_visible():
            page.locator(f'.tab[data-tab="{section}"]').click(timeout=10000)
        elif section in ("dashboard","scan","inventory","lots"):
            page.locator(f'.dock-item[data-dock="{section}"]').click(timeout=10000)
        else:
            page.locator("#mobileMore").click(timeout=10000)
            page.locator(f'.drawer-link[data-target="{section}"]').click(timeout=10000)
    navigate("dashboard")
    assert page.locator("section#dashboard").is_visible()
    assert page.locator("#metrics .metric").count() == 4  # inside collapsed legacy details
    assert page.locator(".portfolio-heading").is_visible()  # current dashboard
    assert page.locator(".tab").count() >= 4
    for target in ("dashboard","scan","deal","lots","inventory","sales","ebay","sealed","restock","settings"):
        navigate(target)
        assert page.locator(f"section#{target}").is_visible(), target
    navigate("lots")
    page.locator('#lotForm [name="name"]').fill("Temporary live QA purchase")
    page.locator('#lotForm [name="cost"]').fill("42.50")
    page.locator('#lotForm [name="source"]').fill("QA only")
    page.locator('#lotForm button').click()
    data = page.evaluate("JSON.parse(localStorage.getItem('pokeflip-v1'))")
    assert data and len(data["lots"]) == 1 and data["lots"][0]["cost"] == 42.5
    navigate("dashboard")
    assert page.locator(".portfolio-heading").count() == 1
    assert not errors, "JavaScript errors in hosted app: " + repr(errors)
    print("PASS live hosted Chromium: HTTP 200, tabs, metrics, temporary purchase lot, dashboard, zero page errors")
    context.close()
    browser.close()
