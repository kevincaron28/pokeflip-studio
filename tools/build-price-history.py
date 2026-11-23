"""Builds price-history.js: real TCGplayer market price history for the sealed products and watchlist cards
Cardstead shows, from tcgcsv.com's daily price archives (one 7z file per day, all of TCGplayer), plus the
Bank of Canada USD/CAD rate for each date so graphs can be drawn in CAD.

Dates: every day of the last 35 days, then one per week back to a year (archives start 2024-02-08).
Archives are cached in tools/.cache/ (gitignored), so later runs only download new days.

Needs Node (to read pack-ev-data.js and sought-cards.js) and py7zr:  python -m pip install py7zr
Run: python tools/build-price-history.py
"""
import datetime as dt, json, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
import py7zr

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tools/.cache/tcgcsv-archive"; CACHE.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Cardstead-PackEV/1.0"}
FIRST = dt.date(2024, 2, 8)
# Sealed kinds worth a graph (cases, displays and code cards are left out by the snapshot builder already).
KINDS = {"pack", "sleeved", "box", "bundle", "etb", "etb-pc", "blister3", "bnb", "tin", "collection"}

def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: return r.read()
        except Exception:
            if i == 2: raise
            time.sleep(3 * (i + 1))

def targets():
    js = ("const d=require('./pack-ev-data.js'),s=require('./sought-cards.js');const out=[];"
          "for(const set of d.sets)for(const [id,name,type] of set.sealed||[])out.push({key:String(id),group:set.groupId,id,sub:'Normal',kind:type});"
          "for(const c of s.cards)if(c.tcgplayerProductId&&c.tcgplayerGroupId)out.push({key:c.tcgplayerProductId+'|'+c.printing,group:c.tcgplayerGroupId,id:c.tcgplayerProductId,sub:c.printing,kind:'card'});"
          "console.log(JSON.stringify({asOf:d.prices.asOf,items:out}))")
    data = json.loads(subprocess.check_output(["node", "-e", js], cwd=str(ROOT)))
    data["items"] = [t for t in data["items"] if t["kind"] in KINDS or t["kind"] == "card"]
    return data

def schedule(last):
    days = [last - dt.timedelta(days=i) for i in range(35)]
    d = last - dt.timedelta(days=35)
    while d >= max(FIRST, last - dt.timedelta(days=365)):
        days.append(d); d -= dt.timedelta(days=7)
    return sorted(set(days))

def archive(day):
    f = CACHE / f"prices-{day.isoformat()}.ppmd.7z"
    if not f.exists():
        f.write_bytes(get(f"https://tcgcsv.com/archive/tcgplayer/prices-{day.isoformat()}.ppmd.7z"))
    return f

def fx_rates(start, end):
    url = f"https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date={start}&end_date={end}"
    obs = json.loads(get(url))["observations"]
    return {o["d"]: float(o["FXUSDCAD"]["v"]) for o in obs}

def main():
    t = targets()
    last = dt.date.fromisoformat(t["asOf"][:10])
    days = schedule(last)
    groups = sorted({x["group"] for x in t["items"]})
    series = {x["key"]: [None] * len(days) for x in t["items"]}
    by_group = {}
    for x in t["items"]: by_group.setdefault(x["group"], []).append(x)
    for i, day in enumerate(days):
        f = archive(day)
        names = [f"{day.isoformat()}/3/{g}/prices" for g in groups]
        with py7zr.SevenZipFile(f) as z:
            have = set(z.getnames()); want = [n for n in names if n in have]
        files = {}
        if want:
            with tempfile.TemporaryDirectory() as tmp:
                with py7zr.SevenZipFile(f) as z:
                    z.extract(path=tmp, targets=want)
                for n in want:
                    p = Path(tmp) / n
                    if p.exists(): files[n] = p.read_bytes()
        for name, raw in files.items():
            g = int(name.split("/")[2])
            rows = json.loads(raw).get("results", [])
            idx = {(r["productId"], r["subTypeName"]): r.get("marketPrice") for r in rows}
            for x in by_group.get(g, []):
                v = idx.get((x["id"], x["sub"]))
                if isinstance(v, (int, float)) and v > 0: series[x["key"]][i] = round(v, 2)
        print(".", end="", flush=True)
    fx = fx_rates((days[0] - dt.timedelta(days=7)).isoformat(), days[-1].isoformat())  # a week earlier: the first day may be a weekend
    fx_line, lastfx = [], None
    for day in days:  # Bank of Canada publishes business days: weekends and holidays carry the last rate
        k = day.isoformat()
        for back in range(0, 7):
            kk = (day - dt.timedelta(days=back)).isoformat()
            if kk in fx: lastfx = fx[kk]; break
        fx_line.append(lastfx)
    series = {k: v for k, v in series.items() if sum(1 for p in v if p is not None) >= 2}
    out = {"built": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
           "source": "TCGplayer market price (Near Mint, English) from tcgcsv.com daily archives; USD/CAD: Bank of Canada FXUSDCAD",
           "currency": "USD", "dates": [d.isoformat() for d in days], "fx": fx_line, "series": series}
    body = ("/* Generated by tools/build-price-history.py. Do not edit by hand: rerun the tool. */\n"
            "(function(root){root.CardsteadPriceHistory=" + json.dumps(out, separators=(",", ":")) + ";"
            "if(typeof module!=='undefined'&&module.exports)module.exports=root.CardsteadPriceHistory;"
            "})(typeof window!=='undefined'?window:globalThis);\n")
    (ROOT / "price-history.js").write_text(body, encoding="utf-8")
    print(f"\nWrote price-history.js: {len(series)} products, {len(days)} dates ({days[0]} to {days[-1]}), {len(body)//1024} KB")

if __name__ == "__main__":
    main()
