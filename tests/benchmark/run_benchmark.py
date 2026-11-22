"""Scanner capture-pipeline benchmark (issue #2 harness).
Runs the app's REAL OCR stack (Tesseract.js in Chromium) over a labelled image set and reports,
per pipeline variant: name top-1, collector-number exact, set-total exact, all-three, detection
rate and median seconds/card. Needs network (Tesseract + language data load from CDN).

usage: python run_benchmark.py IMAGE_DIR [--variants baseline,rectified,roi] [--out report.json] [--limit N]
IMAGE_DIR holds labels.json (see README.md) next to the photos. Exit code is 0 whatever the accuracy:
this is a measurement tool, not a pass/fail test."""
import sys, os, json, time, threading, statistics, argparse, functools
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser(); ap.add_argument("images"); ap.add_argument("--variants", default="baseline,rectified,roi,hybrid,shipped")
ap.add_argument("--out"); ap.add_argument("--limit", type=int); a = ap.parse_args()
IMG = Path(a.images).resolve(); labels = json.loads((IMG/"labels.json").read_text(encoding="utf-8"))["images"][: a.limit or None]

class H(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith("/__bench__/"): return str(IMG / path[len("/__bench__/"):].split("?")[0])
        return str(ROOT / path.lstrip("/").split("?")[0])
    def log_message(self, *x): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"

JS = r"""
async ([url, variant]) => {
  const t0 = performance.now();
  if (variant === 'shipped') { // the exact code the app runs
    if (!window.__w) window.__w = await Tesseract.createWorker(['eng', 'fra']);
    const blob = await (await fetch(url)).blob(), r = await PokeFlipScanPipeline.read(blob, window.__w);
    return { name: r.name, number: r.number, total: r.total, detected: r.detected, ms: performance.now() - t0 };
  }
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const MAX = 1600, s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  let full = cv(Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s)); full.getContext('2d').drawImage(img, 0, 0, full.width, full.height);
  if (!window.__w) window.__w = await Tesseract.createWorker(['eng', 'fra']);
  const w = window.__w;
  const ocr = async c => (await w.recognize(c)).data.text || '';
  const scale = (c, f) => { const o = cv(Math.round(c.width * f), Math.round(c.height * f)); const x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, o.width, o.height); return o; };
  const part = (c, r) => { const x0 = Math.round(r[0] * c.width), y0 = Math.round(r[1] * c.height), ww = Math.round((r[2] - r[0]) * c.width), hh = Math.round((r[3] - r[1]) * c.height); const o = cv(ww, hh); o.getContext('2d').drawImage(c, x0, y0, ww, hh, 0, 0, ww, hh); return o; };
  const strip = c => { // same geometry as app.js cropDetail('left'/'right'): bottom 30%, 55% wide
    const sy = Math.floor(c.height * .70), sh = c.height - sy, sw = Math.ceil(c.width * .55);
    return ['left', 'right'].map(side => { const sx = side === 'left' ? 0 : Math.floor(c.width * .45); const o = cv(Math.min(2400, Math.max(900, sw * 2)), 1); o.height = Math.round(o.width * sh / sw); const x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, sx, sy, sw, sh, 0, 0, o.width, o.height); return o; }); };
  const numOf = t => { const m = [...String(t).toUpperCase().replace(/[|]/g, 'I').matchAll(/\b(\d{1,4}[A-Z]?)\s*\/\s*(\d{1,4})\b/g)]; return m.length ? { n: m.at(-1)[1], total: m.at(-1)[2] } : null; };
  let detected = false, name = '', num = null, source = full;
  if (variant !== 'baseline') {
    const d = full.getContext('2d').getImageData(0, 0, full.width, full.height);
    const r = PokeFlipCardDetect.rectify(d.data, d.width, d.height);
    if (r.ok && r.confidence >= .5) { detected = true; const c = cv(r.image.width, r.image.height); c.getContext('2d').putImageData(new ImageData(r.image.data, r.image.width, r.image.height), 0, 0); source = c; }
  }
  if ((variant === 'roi' || variant === 'hybrid') && detected) {
    const R = PokeFlipCardDetect.ROIS;
    const nameText = await ocr(scale(part(source, R.name), 2.5));
    name = PokeFlipScanHeuristics.headerName(nameText) || PokeFlipScanHeuristics.candidates(nameText)[0] || '';
    num = numOf(await ocr(scale(part(source, R.number), 3)));
    if (!num) { for (const sc of strip(source)) { num = numOf(await ocr(sc)); if (num) break; } }
    if (variant === 'hybrid' && (!num || !name)) { // detection can lock onto an inner frame; fill gaps from the untouched photo
      const text = await ocr(full); name = name || PokeFlipScanHeuristics.candidates(text)[0] || ''; num = num || numOf(text);
      if (!num) { for (const sc of strip(full)) { num = numOf(await ocr(sc)); if (num) break; } }
    }
  } else {
    const text = await ocr(source);
    name = PokeFlipScanHeuristics.candidates(text)[0] || '';
    num = numOf(text);
    if (!num) { for (const sc of strip(source)) { num = numOf(await ocr(sc)); if (num) break; } }
  }
  return { name, number: num && num.n, total: num && num.total, detected, ms: performance.now() - t0 };
}
"""
norm = lambda s: __import__("unicodedata").normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower().strip()
def zero(s): return str(s or "").lstrip("0") or ("0" if s else "")
report = {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH") or None, args=["--no-sandbox"])
    page = b.new_page(); page.goto(base + "/index.html"); page.wait_for_function("window.Tesseract && window.PokeFlipCardDetect", timeout=60000)
    for variant in a.variants.split(","):
        rows = []
        for lab in labels:
            r = page.evaluate(JS, [f"{base}/__bench__/{lab['file']}", variant])
            ok_name = norm(r["name"]) == norm(lab["name"]); ok_num = zero(r["number"]) == zero(lab["localId"]); ok_tot = zero(r["total"]) == zero(lab.get("total"))
            rows.append({**r, "file": lab["file"], "okName": ok_name, "okNumber": ok_num, "okTotal": ok_tot, "okAll": ok_name and ok_num and ok_tot})
            print(variant, lab["file"], "name" if ok_name else "NAME-MISS", "num" if ok_num else "NUM-MISS", flush=True)
        n = len(rows); pct = lambda k: round(100 * sum(1 for x in rows if x[k]) / n, 1)
        report[variant] = {"images": n, "nameTop1%": pct("okName"), "number%": pct("okNumber"), "total%": pct("okTotal"), "allThree%": pct("okAll"),
                           "detected%": pct("detected"), "medianSecPerCard": round(statistics.median(x["ms"] for x in rows) / 1000, 2), "rows": rows}
    b.close()
print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != "rows"} for k, v in report.items()}, indent=1))
if a.out: Path(a.out).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
