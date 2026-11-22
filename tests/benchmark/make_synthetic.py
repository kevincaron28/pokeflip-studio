"""Generate a deterministic SYNTHETIC card-photo set (original artwork, MIT-style, no Pokemon art).
Cards are drawn from scratch (name header, procedural art, collector-number strip) and photographed
virtually: random rotation, perspective, background, blur, noise, glare. Ground truth is exact.
This measures the capture pipeline (detection/crop/OCR), NOT real-card recognition accuracy:
real accuracy needs the owner's labelled photos (see README.md).
usage: python make_synthetic.py OUT_DIR [count] [seed]"""
import sys, json, random, math, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
NAMES = ["Pikachu","Bulbizarre","Salamèche","Carapuce","Évoli","Mewtwo","Ronflex","Dracaufeu","Lucario","Gengar",
 "Tortank","Leviator","Aquali","Pyroli","Voltali","Mentali","Noctali","Gardevoir","Rayquaza","Arcanin",
 "Dracolosse","Tyranocif","Métalosse","Lokhlass","Granbull","Seedot","Grainipiot","Miaouss","Psykokwak","Magicarpe"]
FONTS = [r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\segoeuib.ttf", "DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
def font(size):
    for f in FONTS:
        try: return ImageFont.truetype(f, size)
        except Exception: pass
    return ImageFont.load_default()
def make_card(rng, name, number, total, setcode):
    W, H = 630, 880
    base = rng.choice([(236,201,60),(200,60,50),(60,120,200),(70,160,90),(150,90,170),(210,210,215)])
    im = Image.new("RGB", (W, H), base); d = ImageDraw.Draw(im)
    d.rounded_rectangle((18,18,W-18,H-18), 22, fill=tuple(min(255,c+25) for c in base), outline=(40,40,40), width=4)
    d.text((40,34), name, font=font(46), fill=(15,15,15)); d.text((W-150,40), f"HP {rng.choice([60,90,120,180,230])}", font=font(34), fill=(15,15,15))
    # procedural art window
    art = Image.new("RGB", (540, 400)); ad = ImageDraw.Draw(art)
    c1, c2 = [tuple(rng.randrange(40,230) for _ in range(3)) for _ in range(2)]
    for y in range(400): t = y/399; ad.line((0,y,540,y), fill=tuple(int(c1[i]*(1-t)+c2[i]*t) for i in range(3)))
    for _ in range(14):
        x, y, r = rng.randrange(540), rng.randrange(400), rng.randrange(20,90)
        ad.ellipse((x-r,y-r,x+r,y+r), fill=tuple(rng.randrange(256) for _ in range(3)))
    im.paste(art, (45, 105)); d.rectangle((45,105,585,505), outline=(30,30,30), width=3)
    for i in range(4): d.text((45, 530+i*50), rng.choice(["Attack 30","Rayon Chargé 60+","Flammèche 40","Coup d'Boule 20"]) if i%2==0 else "Ce Pokémon peut attaquer le tour suivant.", font=font(24 if i%2 else 28), fill=(20,20,20))
    d.text((40, 828), f"{number}/{total}", font=font(26), fill=(10,10,10)); d.text((170, 830), f"{setcode} EN", font=font(20), fill=(10,10,10))
    d.text((W-250, 832), "Illus. Synthetic Test", font=font(16), fill=(30,30,30))
    return im
def photograph(rng, card, W=1600, H=1200):
    bgc = rng.choice([(60,45,35),(25,70,40),(200,200,205),(35,35,60),(120,100,80),(20,20,20),(235,235,225)])
    bg = Image.new("RGB",(W,H),bgc); arr = np.array(bg).astype(np.float32)
    yy, xx = np.mgrid[0:H,0:W]; arr *= (0.85+0.3*(xx/W))[...,None]  # lighting gradient
    arr += np.random.default_rng(rng.randrange(1<<30)).normal(0,6,(H,W,1))
    bg = Image.fromarray(np.clip(arr,0,255).astype(np.uint8))
    cw = rng.uniform(.38,.62)*H*0.716*1.6; scale = cw/card.width
    cs = card.resize((int(card.width*scale), int(card.height*scale)), Image.LANCZOS)
    angle = rng.uniform(-14,14); rot = cs.rotate(angle, expand=True, resample=Image.BICUBIC, fillcolor=(0,0,0))
    mask = Image.new("L", cs.size, 255).rotate(angle, expand=True)
    # perspective: jitter the corners a little
    w, h = rot.size; j = lambda: rng.uniform(-.045,.045)
    dst = [(w*j(),h*j()),(w*(1+j()),h*j()),(w*(1+j()),h*(1+j())),(w*j(),h*(1+j()))]
    src = [(0,0),(w,0),(w,h),(0,h)]
    A=[];B=[]
    for (x,y),(u,v) in zip(dst,src):
        A+= [[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]];B+=[u,v]
    coef = np.linalg.solve(np.array(A,float),np.array(B,float)).tolist()
    rot = rot.transform((w,h), Image.PERSPECTIVE, coef, Image.BICUBIC); mask = mask.transform((w,h), Image.PERSPECTIVE, coef, Image.BICUBIC)
    ox = rng.randrange(60, max(61, W-w-60)); oy = rng.randrange(60, max(61, H-h-60))
    shadow = Image.new("L", bg.size, 0); shadow.paste(mask.point(lambda v: v//2), (ox+10,oy+14)); shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    bg = Image.composite(Image.new("RGB",bg.size,(0,0,0)), bg, shadow); bg.paste(rot, (ox,oy), mask)
    if rng.random()<.35:  # glare
        gl = Image.new("L", bg.size, 0); g = ImageDraw.Draw(gl); cx, cy = ox+rng.randrange(w), oy+rng.randrange(h//2)
        g.ellipse((cx-120,cy-60,cx+120,cy+60), fill=150); gl = gl.filter(ImageFilter.GaussianBlur(40)); bg = Image.composite(Image.new("RGB",bg.size,(255,255,255)), bg, gl)
    bg = bg.filter(ImageFilter.GaussianBlur(rng.choice([0,0.6,1.2])))
    return bg
def main():
    out = Path(sys.argv[1]); n = int(sys.argv[2]) if len(sys.argv)>2 else 40; seed = int(sys.argv[3]) if len(sys.argv)>3 else 7
    rng = random.Random(seed); out.mkdir(parents=True, exist_ok=True); labels = []
    for i in range(n):
        name = NAMES[i % len(NAMES)]; total = rng.choice([102,165,191,198,203]); number = str(rng.randint(1,total)).zfill(3)
        setcode = rng.choice(["SVI","PAL","OBF","MEW","PAR","TEF"])
        img = photograph(rng, make_card(rng, name, number, total, setcode))
        f = f"synthetic-{i:03d}.jpg"; img.save(out/f, quality=88)
        labels.append({"file": f, "name": name, "localId": str(int(number)), "total": str(total), "setCode": setcode, "language": "fr", "synthetic": True})
    (out/"labels.json").write_text(json.dumps({"description":"synthetic, original art; ground truth exact","images":labels}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", n, "images to", out)
if __name__ == "__main__":
    main()
