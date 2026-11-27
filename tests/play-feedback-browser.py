"""The Play testing feedback in a real browser: the website, and the Android app with its phone plugins stood in.
Keyboard, in-app privacy policy, share, rating, report a problem, Help & FAQ, walkthrough, Back to exit.
No live network. Run: python tests/play-feedback-browser.py [--shots <folder>]"""
import json, sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path(sys.argv[sys.argv.index("--shots") + 1]) if "--shots" in sys.argv else None
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{server.server_port}/"

# What the app's phone plugins would do, recorded in window.__calls.
PHONE = """
window.__calls = [];
const log = (name, data) => { window.__calls.push([name, data || null]); };
window.Capacitor = { isNativePlatform: () => true, Plugins: {
  App: { addListener: () => {}, getLaunchUrl: async () => null, exitApp: async () => log('exit'), getInfo: async () => ({ version: '4.7.0', build: '40700' }) },
  Share: { share: async d => log('share', d) },
  AppReview: { request: async () => log('review') },
  LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }), schedule: async () => {} },
  Browser: { open: async d => log('browser', d) }, StatusBar: {}, SplashScreen: {},
} };
"""

def context(browser, native=False, width=360, locale="en-CA"):
    ctx = browser.new_context(viewport={"width": width, "height": 780}, service_workers="block", locale=locale, device_scale_factor=2 if SHOTS else 1,
                              **({"user_agent": PHONE_AGENT} if native else {}))
    for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/rest/v1/**", "https://api.tcgdex.net/**", "https://cdn.jsdelivr.net/**"):
        ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
    ctx.route("**/api/**", lambda r: r.fulfill(status=200, content_type="application/json", body="{}"))
    # The Android app asks the public website for the daily data; here that is the local copy.
    def site(route):
        path = route.request.url.split("vercel.app/", 1)[1].split("?")[0]
        if path.startswith("data/") and ".." not in path and (ROOT / path).is_file():
            route.fulfill(status=200, content_type="application/json", body=(ROOT / path).read_bytes(), headers={"Access-Control-Allow-Origin": "*"})
        else:
            route.fulfill(status=200 if path.startswith("api/") else 404, content_type="application/json", body="{}", headers={"Access-Control-Allow-Origin": "*"})
    ctx.route("https://pokeflip-studio.vercel.app/**", site)
    if native:
        ctx.add_init_script(PHONE + (ROOT / "mobile/web-overlay/native-bridge.js").read_text(encoding="utf-8"))
    return ctx

PHONE_AGENT = "Mozilla/5.0 (Linux; Android 15; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36"

def shot(page, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        # Let scrolling settle, and keep the earlier Back message and the contact address out of the picture.
        page.wait_for_timeout(600)
        page.evaluate("""n => { if (!n.includes('back-again')) document.getElementById('toast').style.display = 'none';
          document.querySelectorAll('#privacyDialog a[href^="mailto:"]').forEach(a => a.textContent = 'contact@example.com') }""", name)
        page.screenshot(path=str(SHOTS / f"{name}.png"))

def calls(page, name):
    return [d for n, d in page.evaluate("window.__calls") if n == name]

def no_sideways(page, where):
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"), f"sideways scroll: {where}"
    assert page.evaluate("[...document.querySelectorAll('dialog[open]')].every(d=>d.scrollWidth<=d.clientWidth+1)"), f"dialog scrolls sideways: {where}"

def website(browser):
    ctx = context(browser, width=320); page = ctx.new_page(); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="load")
    page.wait_for_function("window.CardsteadHelp && window.CardsteadActions && document.body.dataset.page==='prices'")
    assert not page.locator("dialog[open]").count(), "the website never opens the walkthrough by itself"
    page.locator('.dock-item[data-dock="settings"]').click()
    about = page.locator("#aboutPanel"); about.wait_for()
    assert not about.locator("[data-rate]").is_visible(), "rating is for the Android app"

    about.get_by_role("button", name="Help & FAQ").click()
    page.locator("#help details.faq").first.wait_for()
    assert page.evaluate("location.hash") == "#/help" and page.locator("#help details.faq").count() == 7
    page.locator('#help details[data-topic="prices"] summary').click()
    assert "Bank of Canada" in page.locator('#help details[data-topic="prices"]').inner_text()
    page.evaluate("CardsteadI18n.set('fr')")
    page.wait_for_function("document.querySelector('#help h1').textContent==='Aide et FAQ'")
    assert "Banque du Canada" in page.locator('#help details[data-topic="prices"]').inner_text(), "stays open, in French"
    no_sideways(page, "help fr 320")

    page.locator("#help [data-privacy]").click()
    policy = page.locator("#privacyDialog .doc-body h1"); policy.wait_for()
    assert policy.inner_text() == "Politique de confidentialité de Cardstead" and len(ctx.pages) == 1
    no_sideways(page, "privacy fr 320")
    page.locator("#privacyDialog [data-close]").click()
    page.evaluate("CardsteadI18n.set('en')")
    page.locator("#help [data-tour]").click(); page.locator("#tourDialog[open]").wait_for()
    page.locator("#tourDialog [data-tour-skip]").click(); assert not page.locator("dialog[open]").count()
    page.reload(wait_until="load"); page.wait_for_function("!document.getElementById('help').classList.contains('hidden')")
    assert page.locator("#help details.faq").count() == 7, "#/help opens directly"
    assert not errors, errors
    ctx.close()

def app(browser, lang):
    fr = lang == "fr"
    ctx = context(browser, native=True, locale="fr-CA" if fr else "en-CA"); page = ctx.new_page(); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="load")

    # First run: four steps, then never again.
    tour = page.locator("#tourDialog[open]"); tour.wait_for()
    heading = tour.locator("h2")
    assert heading.inner_text() == ("Des prix en dollars canadiens" if fr else "Prices in Canadian dollars")
    for n in range(1, 5):
        no_sideways(page, f"tour {n}"); shot(page, f"{lang}-01-walkthrough-{n}")
        if n < 4: tour.locator("[data-tour-next]").click()
    assert not tour.locator("[data-tour-skip]").is_visible()
    tour.locator("[data-tour-next]").click(); assert not page.locator("dialog[open]").count()
    page.reload(wait_until="load"); page.wait_for_function("document.body.dataset.page==='prices'")
    page.wait_for_timeout(200); assert not page.locator("dialog[open]").count()
    assert not calls(page, "review"), "no rating request at launch"

    # Back on the first page: ask, then leave.
    page.evaluate("PokeFlipNative.handleBack()")
    toast = page.locator("#toast"); toast.wait_for()
    assert toast.inner_text() == ("Appuie encore sur Retour pour quitter" if fr else "Press Back again to exit") and not calls(page, "exit")
    box = toast.bounding_box(); dock = page.locator(".mobile-dock").bounding_box()
    assert box["y"] + box["height"] <= dock["y"], "the message is above the bottom bar"
    page.evaluate("PokeFlipNative.handleBack()"); assert len(calls(page, "exit")) == 1
    if SHOTS:
        page.evaluate("PokeFlipNative.handleBack()"); shot(page, f"{lang}-07-back-again")

    # Settings → Help and about.
    page.locator('.dock-item[data-dock="settings"]').click()
    about = page.locator("#aboutPanel"); about.wait_for(); about.scroll_into_view_if_needed()
    assert about.locator("[data-rate]").is_visible()
    no_sideways(page, "settings"); shot(page, f"{lang}-02-settings-help-and-about")
    about.locator("[data-share-app]").click()
    page.wait_for_function("window.__calls.some(c=>c[0]==='share')")
    shared = calls(page, "share")[0]
    assert shared["url"] == "https://pokeflip-studio.vercel.app/" and shared["title"] == "Cardstead" and shared["dialogTitle"] == "Cardstead"

    about.locator('[data-page-link="help"]').click(); page.locator("#help details.faq").first.wait_for()
    shot(page, f"{lang}-03-help")
    page.locator('#help details[data-topic="alerts"] summary').click(); no_sideways(page, "help"); shot(page, f"{lang}-04-help-open")
    # Back goes to Settings, not out of the app.
    page.evaluate("PokeFlipNative.handleBack()"); page.wait_for_function("document.body.dataset.page==='settings'")

    # Privacy policy in the app, with its sections; Back closes it.
    page.locator("#accountPanel [data-privacy='']").click()
    d = page.locator("#privacyDialog[open]"); d.locator(".doc-body h2").first.wait_for()
    assert d.locator(".doc-toc button").count() == d.locator(".doc-body h2").count() >= 10
    assert not d.locator('a[href="#fr"]').count() and not calls(page, "browser") and len(ctx.pages) == 1
    no_sideways(page, "privacy"); shot(page, f"{lang}-05-privacy")
    d.locator(".doc-toc summary").click(); shot(page, f"{lang}-05-privacy-sections")
    d.locator(".doc-toc button").nth(4).click()
    page.evaluate("PokeFlipNative.handleBack()"); assert not page.locator("dialog[open]").count()
    page.locator("#accountPanel [data-privacy='delete']").click()
    target = page.locator('#privacyDialog [data-anchor="%s"]' % ("supprimer" if fr else "delete")); target.wait_for()
    page.wait_for_function("document.getElementById('privacyDialog').scrollTop>200")
    assert target.bounding_box()["y"] < 400, "opens at the deletion section"
    page.locator("#privacyDialog [data-close]").click()

    # Report a problem: needs words, shows what it adds, hands a draft to the mail app.
    page.evaluate("() => { window.__mail = []; CardsteadActions.mail = h => window.__mail.push(h) }")
    about.locator("[data-report]").click()
    r = page.locator("#reportDialog[open]"); r.wait_for()
    assert "4.7.0 (40700)" in r.locator(".report-details").inner_text()
    r.locator("button[type=submit]").click(); assert not page.evaluate("window.__mail.length")
    r.locator("#reportKind").select_option("price"); r.locator("#reportText").fill("Test report: the price of a card looks wrong.")
    no_sideways(page, "report"); shot(page, f"{lang}-06-report")
    r.locator("button[type=submit]").click(); page.wait_for_function("window.__mail.length===1")
    mail = page.evaluate("window.__mail[0]")
    assert mail.startswith("mailto:") and "40700" in mail and "Test%20report" in mail
    r.locator("#reportDetails").uncheck(); r.locator("button[type=submit]").click(); page.wait_for_function("window.__mail.length===2")
    assert "40700" not in page.evaluate("window.__mail[1]")
    # Some Android WebViews refuse the clipboard: the text appears on the page, selected, to copy by hand.
    page.evaluate("() => { navigator.clipboard.writeText = () => Promise.reject(Error('refused')); document.execCommand = () => false; window.__prompts = 0; window.prompt = () => { window.__prompts++; return null } }")
    r.locator("#reportCopy").click()
    box = r.locator("#reportCopyText"); box.wait_for()
    text = box.input_value()
    assert "Test report" in text and "@" in text
    assert page.evaluate("document.getElementById('reportCopyText').selectionEnd") == len(text), "the text is selected"
    assert not page.evaluate("window.__prompts")
    assert ("Sélectionne" if fr else "Select the text") in r.locator("#reportStatus").inner_text()
    no_sideways(page, "report copy"); shot(page, f"{lang}-06b-report-copy")
    r.locator("#reportText").fill("Test report: changed."); assert not box.count(), "an edited report drops the old copy"
    page.evaluate("PokeFlipNative.handleBack()"); assert not page.locator("dialog[open]").count()

    # Keyboard: the page gets shorter, the bottom bar steps aside and the field stays in view.
    email = page.locator("#cloudEmail"); email.scroll_into_view_if_needed(); email.focus()
    page.set_viewport_size({"width": 360, "height": 420})
    page.wait_for_function("document.body.classList.contains('kb-open')")
    assert not page.locator(".mobile-dock").is_visible()
    page.wait_for_timeout(200); b = email.bounding_box()
    assert b["y"] >= 40 and b["y"] + b["height"] <= 420, ("the e-mail field is in view", b)
    no_sideways(page, "keyboard"); shot(page, f"{lang}-08-keyboard-sign-in")
    # The keyboard closes while the field keeps the focus: the bar comes back.
    page.set_viewport_size({"width": 360, "height": 780})
    page.wait_for_function("!document.body.classList.contains('kb-open')"); assert page.locator(".mobile-dock").is_visible()
    email.blur()

    # The rating card is requested once, after a first saved watch.
    page.evaluate("CardsteadActions.reviewWait=50; localStorage.removeItem(CardsteadActions.REVIEW_KEY)")
    page.evaluate("PokeFlipRestock.addWatch({product:'Test Elite Trainer Box',ceiling:70})")
    page.wait_for_function("window.__calls.some(c=>c[0]==='review')")
    page.evaluate("PokeFlipRestock.addWatch({product:'Second Test Box',ceiling:70})"); page.wait_for_timeout(300)
    assert len(calls(page, "review")) == 1
    about.locator("[data-rate]").scroll_into_view_if_needed()
    assert not errors, errors
    ctx.close()

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        website(browser)
        for lang in ("en", "fr"):
            app(browser, lang)
        print("PASS play feedback: keyboard, in-app privacy, Back to exit, share, rating once, report, Help & FAQ, walkthrough (EN/FR, 320 and 360 px)")
        browser.close()
finally:
    server.shutdown()
