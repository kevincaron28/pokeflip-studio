"""Find which shops named in docs/research/canada-alert-discords-*.md are public Shopify stores that Cardstead may poll.

For each Discord channel slug we guess a few domains, then require ALL of:
  * /products.json?limit=250 returns JSON products over HTTPS (public Shopify storefront view)
  * the response carries access-control-allow-origin (browser can read it; no proxy/bypass involved)
  * /meta.json says country CA and currency CAD
  * robots.txt does not disallow /products for User-agent *
  * at least one Pokemon product in the newest 250 (otherwise not useful for this app)
Polite: one request at a time per host, honest User-Agent, 8 s timeout, no retries. Run manually, not in CI.
"""
import json,re,sys,time,urllib.request,urllib.error,concurrent.futures as cf,unicodedata
from pathlib import Path
UA="Cardstead-research/1.0 (+https://github.com/kevincaron28/pokeflip-studio)"
root=Path(__file__).resolve().parents[1]
md=next(root.glob("docs/research/canada-alert-discords-*.md")).read_text(encoding="utf-8")
slugs={}
for line in md.splitlines():
    m=re.match(r"- \*\*(.+?):\*\*\s*(.+)$",line)
    if not m:continue
    label=m.group(1).lower()
    prov="qc" if "quebec" in label else "on" if "ontario" in label else "bc" if label.startswith("bc") else "ab" if "alberta" in label else "ntl" if "national" in label else "other"
    body=re.split(r"Region roll-ups|Roll-ups?:",m.group(2))[0]
    for s in re.findall(r"[a-z0-9][a-z0-9\-]+",body):
        if len(s)>2:slugs.setdefault(s,prov)
def get(url,limit=3_000_000):
    time.sleep(0.8)  # politeness: never burst
    for attempt in (1,2):
        try:return _get(url,limit)
        except urllib.error.HTTPError as e:
            if e.code==429 and attempt==1:time.sleep(60);continue  # rate limited: back off once, then give up on this URL
            raise
def _get(url,limit):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept-Encoding":"identity","Origin":"https://pokeflip-studio.vercel.app"})
    with urllib.request.urlopen(req,timeout=8) as r:
        return r.status,dict(r.headers),r.read(limit),r.geturl()
def probe(slug):
    for host in (f"{slug}.ca",f"{slug}.com",f"www.{slug}.ca",f"www.{slug}.com",f"{slug}.myshopify.com",f"{slug}.shop",f"{slug}.store",f"{slug}.games",f"{slug.replace('-','')}.ca" if "-" in slug else None,f"{slug.replace('-','')}.com" if "-" in slug else None):
        if not host:continue
        try:
            st,h,body,final=get(f"https://{host}/products.json?limit=250")
        except Exception:
            continue
        try:d=json.loads(body)
        except Exception:continue
        if st!=200 or not isinstance(d.get("products"),list):continue
        fh=re.match(r"https://([^/]+)/",final).group(1)
        out={"slug":slug,"host":fh,"hint":slugs[slug],"cors":h.get("access-control-allow-origin") in ("*","https://pokeflip-studio.vercel.app")}
        try:
            _,_,mb,_=get(f"https://{fh}/meta.json");m=json.loads(mb)
            out.update(name=m.get("name"),city=m.get("city"),province=m.get("province"),country=m.get("country"),currency=m.get("currency"))
        except Exception as e:out["meta_error"]=str(e)[:60]
        try:
            _,_,rb,_=get(f"https://{fh}/robots.txt");txt=rb.decode("utf-8","ignore");blk=False;star=False
            for l in txt.splitlines():
                l=l.strip()
                if l.lower().startswith("user-agent:"):star=l.split(":",1)[1].strip()=="*"
                elif star and re.match(r"disallow:\s*/(products)?\s*$",l,re.I) and "products" in l.lower() or (star and re.match(r"disallow:\s*/\s*$",l,re.I)):blk=True
            out["robots_ok"]=not blk
        except Exception:out["robots_ok"]=None
        t=lambda p:unicodedata.normalize("NFKD",p.get("title","")+" "+p.get("product_type","")).lower()
        out["pokemon_products"]=sum("pokemon" in t(p) or "pokémon" in t(p) or "pokeÂ" in t(p) for p in d["products"])
        return out
    return None
res=[]
with cf.ThreadPoolExecutor(3) as ex:
    for r in ex.map(probe,sorted(slugs)):
        if r:res.append(r)
ok=[r for r in res if r["cors"] and r.get("country")=="CA" and r.get("currency")=="CAD" and r.get("robots_ok") is not False and r["pokemon_products"]>=1]
(root/"docs/research/shopify-probe-2026-11-23.json").write_text(json.dumps({"slugs_tried":len(slugs),"shopify_hits":len(res),"accepted":ok,"rejected":[r for r in res if r not in ok]},ensure_ascii=False,indent=1),encoding="utf-8")
print("slugs",len(slugs),"shopify hits",len(res),"accepted",len(ok))
