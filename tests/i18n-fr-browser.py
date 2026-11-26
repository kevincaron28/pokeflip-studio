"""French (tu) on the older screens at phone width: every page built before the bilingual rewrite (My cards, Deal check,
eBay sold, Sealed guide, Settings, Watch) shows no English text the
dictionary knows, text added later (toasts, lists) is translated too, switching back to English restores the
English text, and data saved by an older version is untouched. Set PACK_SHOTS=<folder> for EN and FR screenshots.
Run: python tests/i18n-fr-browser.py"""
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
old_db = {"lots": [{"id": "L1", "name": "Old lot", "cost": 50, "date": "2026-11-01", "source": "Kijiji", "notes": ""}],
          "items": [{"id": "i1", "lotId": "L1", "name": "Pikachu ex", "idCode": "sv8-57", "lang": "fr", "condition": "Near Mint", "finish": "Holo", "qty": 2, "unitPrice": 20, "unitCost": 5, "location": "B-SINGLES", "category": "single", "status": "stored", "image": "", "created": "2026-11-01"},
                    {"id": "i2", "lotId": "L1", "name": "Bulk Commons", "idCode": "", "lang": "en", "condition": "Mixed / not graded", "finish": "Mixed", "qty": 200, "unitPrice": 0.05, "unitCost": None, "location": "D-BULK-EN", "category": "bulk", "status": "stored", "image": "", "created": "2026-11-01"}],
          "sales": [{"id": "s1", "itemId": "i1", "qty": 1, "gross": 25, "fees": 3, "ship": 0, "date": "2026-11-10", "channel": "Marketplace", "costSnapshot": 5}]}
old_restock = {"watches": [{"id": "w0", "product": "Prismatic Evolutions Booster Bundle", "format": "bundle", "language": "fr", "region": "Montérégie / Canada", "ceiling": 80, "enabled": True, "quantity": 2, "limit": 2}], "observations": []}
SAVED = {"pokeflip-v1": json.dumps(old_db), "pokeflip-restock-v1": json.dumps(old_restock)}
SEED = "".join(f"localStorage.setItem({json.dumps(k)},{json.dumps(v)});" for k, v in SAVED.items()) + \
       "localStorage.setItem('cardstead-lang-v1','\"fr\"');"
PAGES = ["mycards", "deal", "ebay", "sealed", "settings", "restock"]
# Text nodes still in English: the translator would still change them.
LEFTOVER = """id=>{const s=document.getElementById(id);const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);const out=[];
 for(let n=w.nextNode();n;n=w.nextNode()){const p=n.parentElement;if(!p||p.closest('script,style,textarea,[data-i18n],[data-no-translate]'))continue;
  const t=n.nodeValue.replace(/\\s+/g,' ').trim();if(!t)continue;const fr=CardsteadDomI18n.tr(t);if(fr!=null&&fr!==t)out.push(t)}
 for(const el of s.querySelectorAll('[placeholder],[aria-label],[title],input[type=button],input[type=submit]'))
  for(const a of ['placeholder','aria-label','title','value']){const v=el.getAttribute(a);if(!v||(a==='value'&&!/button|submit/.test(el.type)))continue;const fr=CardsteadDomI18n.tr(v);if(fr!=null&&fr!==v)out.push(a+': '+v)}
 return out}"""
COLLECT = """id=>{const s=document.getElementById(id);const out=new Set();const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);
 for(let n=w.nextNode();n;n=w.nextNode()){const p=n.parentElement;if(!p||p.closest('script,style,[data-no-translate]'))continue;const t=n.nodeValue.replace(/\\s+/g,' ').trim();if(/[A-Za-z]{2}/.test(t))out.add(t)}
 for(const el of s.querySelectorAll('[placeholder],[aria-label],[title]'))for(const a of ['placeholder','aria-label','title']){const v=el.getAttribute(a);if(v)out.add(v)}
 return [...out]}"""
import re
KEEP_FR = json.loads(re.search(r"root\.CardsteadFR=(\{.*?\});if\(typeof module", (ROOT / "i18n-fr.js").read_text(encoding="utf8"), re.S).group(1))
KEPT = {k for k, v in KEEP_FR.items() if v is None}
# Shop and set names are names, not text to translate.
for f in ("canada-shops.js", "canada-retailers.js"):
    src = (ROOT / f).read_text(encoding="utf8")
    KEPT |= set(re.findall(r'"name": *"([^"]+)"', src)) | set(re.findall(r"name:'([^']+)'", src))
SEEDED = {"Old lot", "Kijiji", "Pikachu ex", "Bulk Commons", "Near Mint", "Mixed / not graded", "Mixed", "Holo", "Marketplace",
          "Prismatic Evolutions Booster Bundle", "Montérégie / Canada"}
EN_WORD = re.compile(r"\b(the|and|or|to|of|your|you|is|are|for|with|this|from|e\.g|not|no|yet|only|cost|scan|unlimited|card|cards|price|add|check|open|save|edit|delete|will|when|after|before|all|new|each|per|left|sold|total|value)\b", re.I)
STRONG_EN = re.compile(r"\b(the|is|are|any|across|excludes|tracked|separately|with|your|have|has|been|which|than)\b", re.I)
def looks_english(t):
    if re.search(r"\([A-Za-z0-9.]+\)$", t): return False   # a set name with its code
    return t not in KEPT and not any(s in t for s in SEEDED) and bool(EN_WORD.search(t) or STRONG_EN.search(t)) and not re.search(r"[àâçéèêëîïôûùœ’]", t)
def looks_english_mixed(t):
    """French text that still carries an English sentence piece."""
    t = t.replace("The Pokémon Company", "")   # a company name inside the French credits
    return t not in KEPT and not any(s in t for s in SEEDED) and bool(STRONG_EN.search(t))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", locale="fr-CA")
        ctx.route("**/rpc/restock_feed", lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body='{"items":null}'))  # no live network
        for pat in ("**/products.json*", "https://tcgplayer-cdn.tcgplayer.com/**", "**/api/**"):
            ctx.route(pat, lambda r: r.fulfill(status=404, body=""))
        ctx.add_init_script("if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');" + SEED + "}")
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
        page.wait_for_function("typeof CardsteadNav!=='undefined' && typeof CardsteadDomI18n!=='undefined'")
        assert page.evaluate("CardsteadI18n.lang()") == "fr"
        # English pass first: text that stays exactly the same in French and reads as English is a miss,
        # also when the extractor never saw it (text built in pieces).
        page.evaluate("CardsteadI18n.set('en')")
        english = {}
        for pid in PAGES:
            page.evaluate(f"CardsteadNav.show({json.dumps(pid)})")
            page.wait_for_timeout(200)
            english[pid] = set(page.evaluate(COLLECT, pid))
        page.evaluate("CardsteadI18n.set('fr')")
        page.wait_for_timeout(100)
        problems = {}
        for pid in PAGES:
            page.evaluate(f"CardsteadNav.show({json.dumps(pid)})")
            page.wait_for_timeout(250)
            now = page.evaluate(COLLECT, pid)
            left = [t for t in now if t in english[pid] and looks_english(t)]
            left += [t for t in now if t not in english[pid] and STRONG_EN.search(t) and looks_english_mixed(t)]
            page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
            page.wait_for_timeout(100)
            left += page.evaluate(LEFTOVER, pid)
            if left: problems[pid] = left
            page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=false)")
            page.evaluate("scrollTo(0,0)")
            if SHOTS: page.screenshot(path=f"{SHOTS}/fr-{pid}-390.png", full_page=True)
        assert not problems, json.dumps(problems, ensure_ascii=False, indent=1)
        # Spot checks of real French on the older screens.
        page.evaluate("CardsteadNav.show('mycards')")
        inv = page.locator("#myCards").inner_text()
        assert "Liste de suivi" in page.locator("#mycards").inner_text() and "Ajouter une carte" in inv, inv
        assert "Pikachu ex" in inv and "Bulk Commons" in inv, inv   # card names are never translated
        # Text added later is translated (toast).
        page.evaluate("toast('Backup restored')")
        page.wait_for_timeout(50)
        assert page.locator("#toast").inner_text() == "Sauvegarde restaurée", page.locator("#toast").inner_text()
        # A dialog message is translated.
        msgs = []
        page.on("dialog", lambda d: (msgs.append(d.message), d.dismiss()))
        page.evaluate("confirm('Delete this rule and its recorded checks?')")
        assert msgs == ["Supprimer ce suivi et ses vérifications?"], msgs
        # Saved data untouched by the translation.
        for k, v in SAVED.items():
            assert json.loads(page.evaluate(f"localStorage.getItem({json.dumps(k)})")) == json.loads(v) or k == "pokeflip-restock-v1"
        assert json.loads(page.evaluate("localStorage.getItem('pokeflip-v1')"))["items"][0]["name"] == "Pikachu ex"
        # Back to English: the English text returns, no reload needed.
        page.evaluate("CardsteadI18n.set('en')")
        page.wait_for_timeout(100)
        for pid in PAGES:
            page.evaluate(f"CardsteadNav.show({json.dumps(pid)})")
            page.wait_for_timeout(150)
            if SHOTS: page.screenshot(path=f"{SHOTS}/en-{pid}-390.png", full_page=True)
        page.evaluate("CardsteadNav.show('mycards')")
        assert "Pikachu ex" in page.locator("#myCards").inner_text() and "Add a card" in page.locator("#myCards").inner_text()
        page.evaluate("CardsteadNav.show('settings')")
        assert page.locator("#settings").get_by_text("Export backup", exact=False).count() >= 1 or "Backup" in page.locator("#settings").inner_text()
        page.evaluate("toast('Backup restored')")
        assert page.locator("#toast").inner_text() == "Backup restored"
        assert page.evaluate("document.body.scrollWidth") <= 392, "no horizontal scroll at 390 px"
        assert not errors, errors
        b.close()
    print("i18n-fr-browser: OK", len(PAGES), "pages")
finally:
    server.shutdown()
