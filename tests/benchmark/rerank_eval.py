"""Measures artwork-similarity re-ranking on REAL catalogue artwork without storing it.
For a few names, takes TCGdex search results (the list the app shows), picks target cards, renders each as a
virtual photo on a table (rotation/perspective/blur/glare; same photographer as make_synthetic.py), then asks:
where does the true card sit in the lookup order vs after PokeFlipScanPipeline.rerank?
Card images are fetched at run time for private measurement only (like the app does); nothing is saved in the repo.
usage: python rerank_eval.py [names comma separated] [targets per name]   (needs network)"""
import sys, os, io, json, random, threading, tempfile, urllib.request, urllib.parse
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
from PIL import Image, ImageEnhance
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
src = Path(__file__).with_name("make_synthetic.py").read_text(encoding="utf-8").replace("\nmain()\n", "\n")
ns = {"__name__": "ms"}; exec(compile(src, "make_synthetic.py", "exec"), ns)
names = (sys.argv[1] if len(sys.argv) > 1 else "Pikachu,Eevee,Charizard").split(","); per = int(sys.argv[2]) if len(sys.argv) > 2 else 6
tmp = Path(tempfile.mkdtemp()); rng = random.Random(11)
class H(SimpleHTTPRequestHandler):
    def translate_path(self, p): return str(tmp / p[9:].split("?")[0]) if p.startswith("/__img__/") else str(ROOT / p.lstrip("/").split("?")[0])
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
def get(url): return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "pokeflip-bench"}), timeout=30).read()
JS = """async ([name, photos]) => {
  const list = await PokeFlipCardLookup.lookup(name, 'en'); const top = list.filter(c => c.image).slice(0, 30);
  const out = [];
  for (const [id, file] of photos) {
    const idx = top.findIndex(c => c.id === id); if (idx < 0) continue;
    const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = '/__img__/' + file; });
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = img.naturalWidth * s; c.height = img.naturalHeight * s;
    const g = c.getContext('2d', {willReadFrequently: true}); g.drawImage(img, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height);
    const r = PokeFlipCardDetect.rectify(d.data, d.width, d.height); if (!r.ok) { out.push({id, detected: false, before: idx}); continue; }
    const card = document.createElement('canvas'); card.width = r.image.width; card.height = r.image.height; card.getContext('2d').putImageData(new ImageData(r.image.data, card.width, card.height), 0, 0);
    const ranked = await PokeFlipScanPipeline.rerank(card, top, c => c.image + '/low.webp');
    out.push({id, detected: true, before: idx, after: ranked.findIndex(c => c.id === id), n: top.length});
  } return out; }"""
rows = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH") or None); (tmp/"blank.html").write_text("<!doctype html><title>x</title>" + "".join(f'<script src="/{m}"></script>' for m in ["scan-heuristics.js","card-lookup.js","card-detect.js","art-rank.js","scan-pipeline.js"]), encoding="utf-8")
    pg = b.new_page(); pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/__img__/blank.html")
    pg.wait_for_function("window.PokeFlipScanPipeline", timeout=30000)
    for name in names:
        lst = json.loads(get("https://api.tcgdex.net/v2/en/cards?" + urllib.parse.urlencode({"name": name, "pagination:itemsPerPage": "100"})))
        # same ordering the app applies: exact name first, then id
        import unicodedata; n = lambda s: unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()
        lst = sorted(lst, key=lambda c: (0 if n(c["name"]) == n(name) else 1, c["id"]))
        cand = [c for c in lst if c.get("image")][:30]; picks = rng.sample(cand, min(per, len(cand))); photos = []
        for c in picks:
            try: im = Image.open(io.BytesIO(get(c["image"] + "/high.webp"))).convert("RGB")
            except Exception: continue
            # harder than a clean copy: white-balance cast, exposure, contrast, saturation, heavier JPEG
            a = np.asarray(im).astype(np.float32) * np.array([rng.uniform(.86, 1.14) for _ in range(3)]); im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
            for E, lo, hi in ((ImageEnhance.Brightness, .75, 1.2), (ImageEnhance.Contrast, .75, 1.1), (ImageEnhance.Color, .7, 1.3)): im = E(im).enhance(rng.uniform(lo, hi))
            f = f"{c['id']}.jpg".replace("/", "_"); ns["photograph"](rng, im, 1600, 1200).save(tmp / f, quality=60); photos.append([c["id"], f])
        r = pg.evaluate(JS, [name, photos]); [x.update(name=name) for x in r]; rows += r; print(name, len(r), "targets", flush=True)
    b.close()
det = [x for x in rows if x["detected"]]
res = {"targets": len(rows), "detected": len(det), "top1_before_%": round(100 * sum(1 for x in det if x["before"] == 0) / max(1, len(det)), 1),
       "top1_after_%": round(100 * sum(1 for x in det if x["after"] == 0) / max(1, len(det)), 1),
       "top3_before_%": round(100 * sum(1 for x in det if x["before"] < 3) / max(1, len(det)), 1), "top3_after_%": round(100 * sum(1 for x in det if x["after"] < 3) / max(1, len(det)), 1),
       "mean_rank_before": round(sum(x["before"] for x in det) / max(1, len(det)), 2), "mean_rank_after": round(sum(x["after"] for x in det) / max(1, len(det)), 2)}
print(json.dumps(res, indent=1))
