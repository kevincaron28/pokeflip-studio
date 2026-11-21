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
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    response = page.goto(URL, wait_until="domcontentloaded", timeout=30000)
    assert response and response.status == 200, "Production homepage not HTTP 200"
    page.locator('[data-tab="dashboard"]').click(timeout=10000)
    page.locator("#metrics .metric").first.wait_for(timeout=15000)
    assert page.locator("#metrics .metric").count() == 4
    assert page.locator(".tab").count() >= 5
    for tab in page.locator(".tab").all():
        tab.click(timeout=4000)
        target = tab.get_attribute("data-tab")
        assert page.locator(f"section#{target}").is_visible(), target
    page.locator('[data-tab="lots"]').click()
    page.locator('#lotForm [name="name"]').fill("Temporary live QA purchase")
    page.locator('#lotForm [name="cost"]').fill("42.50")
    page.locator('#lotForm [name="source"]').fill("QA only")
    page.locator('#lotForm button').click()
    data = page.evaluate("JSON.parse(localStorage.getItem('pokeflip-v1'))")
    assert data and len(data["lots"]) == 1 and data["lots"][0]["cost"] == 42.5
    page.locator('[data-tab="dashboard"]').click()
    assert page.locator(".portfolio-heading").count() == 1
    assert not errors, "JavaScript errors in hosted app: " + repr(errors)
    print("PASS live hosted Chromium: HTTP 200, tabs, metrics, temporary purchase lot, dashboard, zero page errors")
    context.close()
    browser.close()
