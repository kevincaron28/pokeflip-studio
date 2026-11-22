# Scanner benchmark (release gate #2)

Measures the capture pipeline on labelled photos so accuracy claims are numbers, not impressions.
Photos of the owner's own cards are **never committed** (see `.gitignore`); only the format and tools live here.

## 1. Add real photos (owner)
Put photos and a `labels.json` in a folder outside git, e.g. `C:\pokeflip-bench\`:

```json
{ "images": [
  { "file": "IMG_001.jpg", "name": "Pikachu", "localId": "25", "total": "165",
    "language": "fr", "cardId": "sv3pt5-025", "finish": "Normal", "condition": "Near Mint" }
] }
```
- `name`, `localId` (number printed left of `/`), `total` (printed right of `/`) are used by the OCR accuracy report.
- `cardId` is the TCGdex id of the exact printing (optional but needed for printing-level accuracy; ground truth must come from the physical card, not from the app).
- Aim for >= 100 cards: FR and EN, holo/reverse, reprints of the same art in different sets, vintage symbols, a few on awkward backgrounds, sleeves, glare.
- One card per photo, shot the way the live scanner sees it (phone, card on a table).

## 2. Run
```powershell
pip install playwright==1.56.0 pillow numpy ; python -m playwright install chromium
$env:PYTHONUTF8=1
python tests/benchmark/run_benchmark.py C:\pokeflip-bench --out report.json
```
Variants: `baseline` (whole-photo OCR = pre-v4.3 behaviour), `rectified`, `roi`, `hybrid`, `shipped` (the exact code in `scan-pipeline.js`).
Reports per variant: name top-1, collector-number, set-total, all-three, card-detected %, median seconds per card. Needs network (Tesseract + language data).

## 3. Artwork re-ranking
`python tests/benchmark/rerank_eval.py "Pikachu,Eevee" 8` renders real catalogue artwork as virtual photos (private, fetched at run time, not stored) and reports where the true card sits in the lookup order before/after artwork re-ranking. It is a development measurement, not an accuracy claim: virtual photos are easier than physical ones.

## 4. Synthetic set (no real cards, no Pokemon art)
`python tests/benchmark/make_synthetic.py OUT_DIR 40 7` draws original cards, "photographs" them with rotation, perspective, uneven light, glare, blur and noise, and writes exact labels. It measures detection and OCR plumbing only.

## What is NOT measured here
Exact-printing accuracy on real cards, language/foil/condition recognition, sleeves/top-loaders, and false-positive rate on cards missing from the catalogue. Those need the owner's labelled photos (step 1) and are required before the app may advertise automatic identification.
