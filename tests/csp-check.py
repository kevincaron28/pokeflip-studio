"""Loads the app under the exact Content-Security-Policy from vercel.json and exercises the
third-party paths (Tesseract OCR from CDN, Supabase client, TCGdex API + artwork). Fails on any CSP
violation or console error. Needs network. Run: python tests/csp-check.py"""
import json, threading, os, sys
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
headers = {h["key"]: h["value"] for h in json.loads((ROOT/"vercel.json").read_text(encoding="utf-8"))["headers"][0]["headers"]}
assert "Content-Security-Policy" in headers, "vercel.json has no CSP"
class H(SimpleHTTPRequestHandler):
    def translate_path(self, p): return str(ROOT / p.lstrip("/").split("?")[0])
    def end_headers(self):
        for k, v in headers.items(): self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
bad = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH") or None)
    pg = b.new_page(); pg.on("console", lambda m: bad.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: bad.append(str(e)))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html"); pg.wait_for_function("window.Tesseract && window.supabase", timeout=30000)
    try:
      r = pg.evaluate("""async () => {
      const out = {};
      const c = document.createElement('canvas'); c.width = 600; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,600,160); g.fillStyle = '#000'; g.font = 'bold 72px Arial'; g.fillText('Pikachu 25/165', 10, 100);
      const w = await Tesseract.createWorker(['eng','fra']); out.ocr = (await w.recognize(c)).data.text.trim(); await w.terminate();
      out.supabase = typeof supabase.createClient('https://fehvorwdcswhhonavyit.supabase.co','sb_publishable_uRWUN4b6l2Op-rd0nDIOOg_r__6Tz-g').auth.getSession;
      const list = await PokeFlipCardLookup.lookup('Pikachu','en'); out.cards = list.length; const withImg = list.find(c => c.image); out.img = withImg && withImg.image;
      const im = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => rej('img'); i.src = out.img + '/low.webp'; });
      out.imgSize = im; return out; }""")
    except Exception as e:
      print('EVAL FAILED', str(e)[:200]); print('console:', bad); sys.exit(1)
    enforced = pg.evaluate("(()=>{const s=document.createElement('script');s.textContent='window.__x=1';document.head.appendChild(s);return window.__x===undefined})()")
    n_before = len(bad)
    b.close()
print(r)
# Negative control: the policy must actually be enforced (inline script blocked).
assert "Pikachu" in r["ocr"] and r["cards"] > 0 and r["supabase"] == "function" and r["imgSize"][0] > 100, r
assert enforced, 'CSP is not enforced: inline script ran'
bad = bad[:n_before-1] if len(bad) >= n_before and 'Content Security Policy' in bad[-1] else bad  # drop the expected control violation
violations = [m for m in bad if "Content Security Policy" in m or "Refused" in m]
assert not violations, violations
assert not bad, bad
print("PASS: app runs under the production CSP (OCR, Supabase client, TCGdex API + artwork), 0 violations")
