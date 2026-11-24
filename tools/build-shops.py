"""Generate canada-shops.js (and the vercel.json connect-src list) from docs/research/shopify-probe-*.json.
Run tools/probe-shopify-shops.py first. Region is derived from the shop's own Shopify meta.json city."""
import json,re,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[1]
# Every probe file counts: the Discord-slug probe and the exact-host probes (tools/quebec-hosts.txt).
probe={"accepted":[r for p in sorted(root.glob("docs/research/shopify-probe-*.json")) for r in json.loads(p.read_text(encoding="utf-8"))["accepted"]]}
def n(s):return re.sub(r"[^a-z]+"," ",unicodedata.normalize("NFKD",s or "").encode("ascii","ignore").decode().lower()).strip()
def norm(x):
    c=n(x);c=re.sub(r"\bst\b","saint",c);return re.sub(r"\bste\b","sainte",c)
QC={"montreal":["cote saint luc","montreal","saint laurent","verdun","outremont","lasalle","lachine","anjou","ahuntsic","saint leonard","villeray"],"west-island":["pointe claire","kirkland","dollard des ormeaux","pierrefonds","beaconsfield","dorval","saint anne de bellevue"],"laval-north-shore":["sainte anne des plaines","charlemagne","laval","blainville","repentigny","terrebonne","mascouche","boisbriand","saint eustache","mirabel","saint jerome","lorraine","rosemere","lachenaie","sainte therese"],"south-shore":["brossard","longueuil","saint lambert","sainte catherine","saint amable","chateauguay","saint jean sur richelieu","candiac","la prairie","kahnawake","boucherville","varennes","saint hubert","greenfield park","saint constant","sainte julie","saint hyacinthe","beloeil","mont saint hilaire","chambly","saint bruno de montarville","sorel tracy","granby"],"outaouais":["gatineau","hull","aylmer"],"laurentides":["saint sauveur","saint jerome","sainte agathe des monts","mont tremblant"],"estrie":["sherbrooke","magog","granby"],"centre-du-quebec":["drummondville","trois rivieres","victoriaville"],"vaudreuil-soulanges":["st polycarpe","saint polycarpe","vaudreuil dorion","salaberry de valleyfield"],"quebec-city":["quebec","levis","beauport","charlesbourg","sainte foy","saint nicolas"]}
ON={"gta":["toronto","north york","markham","brampton","mississauga","oshawa","thornhill","vaughan","richmond hill","pickering","ajax","whitby","scarborough","etobicoke","woodbridge"],"ottawa":["ottawa","nepean","kanata","orleans"]}
BC={"vancouver":["vancouver","burnaby","richmond","surrey","coquitlam","north vancouver","new westminster","langley"]}
AB={"calgary":["calgary","balzac","airdrie","okotoks"],"edmonton":["edmonton","saint albert","sherwood park"]}
def region(city,prov,hint):
    c=norm(city)
    if hint=="ntl":return "national"
    tab={"Quebec":(QC,"qc-other"),"Ontario":(ON,"on-other"),"British Columbia":(BC,"bc-other"),"Alberta":(AB,"ab-other")}.get(prov)
    if not tab:return "other"
    for rid,cities in tab[0].items():
        if c in cities:return rid
    return tab[1]
LABEL={"montreal":"Montréal","west-island":"West Island","laval-north-shore":"Laval / North Shore","south-shore":"South Shore (Rive-Sud)","quebec-city":"Québec City","outaouais":"Outaouais (Gatineau)","laurentides":"Laurentides","estrie":"Estrie (Sherbrooke)","centre-du-quebec":"Centre-du-Québec / Mauricie","vaudreuil-soulanges":"Vaudreuil-Soulanges / Valleyfield","qc-other":"Québec — elsewhere","gta":"Greater Toronto Area","ottawa":"Ottawa","on-other":"Ontario — elsewhere","vancouver":"Vancouver area","bc-other":"BC — elsewhere","calgary":"Calgary area","edmonton":"Edmonton area","ab-other":"Alberta — elsewhere","national":"Canada-wide online shops"}
PROV={"montreal":"QC","west-island":"QC","laval-north-shore":"QC","south-shore":"QC","quebec-city":"QC","outaouais":"QC","laurentides":"QC","estrie":"QC","centre-du-quebec":"QC","vaudreuil-soulanges":"QC","qc-other":"QC","gta":"ON","ottawa":"ON","on-other":"ON","vancouver":"BC","bc-other":"BC","calgary":"AB","edmonton":"AB","ab-other":"AB","national":"CA"}
extra=[{"host":"boutiquelapioche.com","name":"La Pioche - Boutique de jeux","city":"Québec","province":"Quebec","hint":"qc"},{"host":"carddynasty.ca","name":"Card Dynasty","city":"Saint-Sauveur","province":"Quebec","hint":"qc"},{"host":"luniversdelacarte.ca","name":"L'Univers de la Carte","city":"Charlemagne","province":"Quebec","hint":"qc"},{"host":"www.3dragons.ca","name":"3 Dragons","city":"Sainte-Thérèse","province":"Quebec","hint":"qc"},{"host":"www.boutiqueawesome.com","name":"Boutique Awesome","city":"Saint-Hubert","province":"Quebec","hint":"qc"},{"host":"www.cardchasersmtl.com","name":"CardChasers","city":"Laval","province":"Quebec","hint":"qc"},{"host":"www.multivers.ca","name":"Multivers","city":"Sainte-Anne-des-Plaines","province":"Quebec","hint":"qc"},{"host":"tistaminis.com","name":"Tistaminis","city":"Hamilton","province":"Ontario","hint":"on"},{"host":"doescards.ca","name":"Doe's Cards","city":"Brampton","province":"Ontario","hint":"on"},{"host":"www.raincity.games","name":"Rain City Games","city":"Vancouver","province":"British Columbia","hint":"bc"}]
# Accepted by the probe but not polled (reason kept for the next review):
EXCLUDE={"cartessportivesrivesud.com":"same store as cartessportivesrivesud.ca (identical product ids, 2026-11-24)",
 "kingcardsvalley.com":"redirects to leroidescartesvalley.com, whose robots.txt could not be read (domain did not resolve, 2026-11-24): manual until confirmed",
 "shop.pokemontcgcanada.ca":"independent shop (Moncton, NB) with a brand-like name: owner to confirm the operator before it is listed"}
rows=[{"host":r["host"],"name":r["name"].strip(),"city":r["city"],"province":r["province"],"hint":r["hint"]} for r in probe["accepted"] if r["host"] not in EXCLUDE]
have={r["host"] for r in rows}
rows+= [e for e in extra if e["host"] not in have]
# Second stores the Shopify meta.json does not list (sweep of 24 Nov 2026).
CITY={"zonecollection.ca":"Saint-Jean-sur-Richelieu, Saint-Hyacinthe","pokejeux.ca":"Boucherville, La Prairie (opening 9 Dec 2026)"}
shops=[]
for r in sorted(rows,key=lambda r:(r["province"],r["city"],r["name"])):
    shops.append({"id":re.sub(r"[^a-z0-9]+","-",r["host"].replace("www.","").split(".")[0]),"name":r["name"],"host":r["host"],"city":CITY.get(r["host"],r["city"]),"region":region(r["city"],r["province"],r["hint"])})
regs=sorted({s["region"] for s in shops},key=lambda x:list(LABEL).index(x))
js="/* GENERATED by tools/build-shops.py from tools/probe-shopify-shops.py results (docs/research/shopify-probe-*.json). Do not edit by hand.\n   Every host: public Shopify /products.json served with CORS, robots.txt not blocking /products, meta.json country CA + currency CAD, Pokémon products present at probe time (2026-11-23).\n   Names/cities are what each shop reports about itself. Domains were matched from Discord channel names by guessing, then validated; verify before relying on any one shop. */\n(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PokeFlipShops=api;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';\n const SHOPS="+json.dumps(shops,ensure_ascii=False,indent=0).replace("\n","")+";\n const REGIONS="+json.dumps([{"id":r,"name":LABEL[r],"province":PROV[r]} for r in regs],ensure_ascii=False)+";\n const inRegions=ids=>SHOPS.filter(s=>ids.includes(s.region));\n return {SHOPS,REGIONS,inRegions};\n});\n"
(root/"canada-shops.js").write_text(js,encoding="utf-8")
vj=root/"vercel.json";txt=vj.read_text(encoding="utf-8")
hosts=sorted({"https://"+s["host"] for s in shops})
m=re.search(r"connect-src ([^;]+);",txt);base=[h for h in m.group(1).split(" ") if h not in hosts and not re.match(r"https://(tistaminis\.com|doescards\.ca|www\.raincity\.games)$",h)]
base+=hosts
vj.write_text(txt.replace(m.group(0),"connect-src "+" ".join(base)+";"),encoding="utf-8")
print(len(shops),"shops;",{r:sum(s['region']==r for s in shops) for r in regs})
