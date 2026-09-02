"""Render the Genkai demonstration film.

    python scripts/make-film.py                 # writes assets/genkai-film-1080p.mp4
    python scripts/make-film.py --poster-only   # writes assets/genkai-poster.jpg only

Fifty-five seconds, 1920x1080, 30fps.  Every figure is computed from the same
synthetic scenario the demo runs on (genkai/synthetic.js), so the film and
/genkai/scenario.html can never disagree.  The existing score is muxed back on
unchanged: this is a re-cut, not a new soundtrack.

Terminology: capacity-reach date (physical caps), cap-reach forecast
(consented caps).  The planning officer's word appears nowhere.

Palette follows assets/styles.css.  Shu vermilion is only ever the limit.
"""
import math, os, sys, subprocess, datetime

W, H, FPS = 1920, 1080, 30
BG, CARD, CARD2, BORDER = (18, 22, 28), (27, 34, 43), (32, 41, 52), (42, 52, 65)
INK, MUTED, AMBER = (243, 245, 247), (141, 151, 165), (242, 163, 60)
GREEN, RED, BLUE = (61, 191, 127), (229, 72, 77), (74, 130, 180)
SHU = (226, 71, 43)                      # the limit — nothing else
B1, B2 = (36, 67, 95), (51, 96, 138)

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.environ.get("FONT_DIR", r"C:\Windows\Fonts")
AUDIO_SRC = os.path.join(HERE, "assets", "genkai-film-1080p.mp4")
OUT = os.path.join(HERE, "assets", "genkai-film-1080p.mp4")
POSTER = os.path.join(HERE, "assets", "genkai-poster.jpg")

from PIL import Image, ImageDraw, ImageFont

_fc = {}
def font(name, size):
    key = (name, size)
    if key not in _fc:
        for cand in (name, "segoeui.ttf"):
            try:
                _fc[key] = ImageFont.truetype(os.path.join(FONT_DIR, cand), size); break
            except OSError:
                continue
    return _fc[key]

def sans(s, bold=False):   return font("segoeuib.ttf" if bold else "segoeui.ttf", s)
def mono(s):
    for c in ("consola.ttf", "cour.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(os.path.join(FONT_DIR, c), s)
        except OSError:
            continue
def jp(s):                 return font("YuGothM.ttc", s)

# ------------------------------------------------------------------ model ---
WEEK0 = datetime.date(2026, 1, 5)
TODAY_W = (datetime.date(2026, 9, 1) - WEEK0).days // 7
MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

def wdate(w):  return WEEK0 + datetime.timedelta(weeks=w)
def fmonth(w): d = wdate(w); return f"{MON[d.month-1]} {d.year}"

def headcount(scale=1.0, shift=0):
    out = []
    for w in range(104):
        t = w - shift
        ramp = 3400 / (1 + math.exp(-(t - 31) / 9))
        fall = math.exp(-(t - 68) / 14) if t > 68 else 1
        wob = 1 + 0.03 * math.sin(w / 3.1) + 0.02 * math.cos(w / 5.7)
        out.append(round(max(380, ramp * fall * wob * scale)))
    return out

HC = headcount()
PEAK_W = HC.index(max(HC))

REMEDY_CONSENT = {"exempt": 0, "s5_declaration": 6, "permission": 26, "cemp_variation": 6}
ROUTES = {"agreement_under_condition": 8, "non_material_amendment": 12, "parallel_application": 26}

DOMAINS = [
    dict(id="beds", name="Beds & travel-to-work", unit="beds within 45 min", cap_type="physical", ratio=0.34,
         steps=[(0, 760)], remedies=[("Block-book a hostel", 120, 10, "exempt", 180_000),
                                     ("Temporary worker village", 400, 30, "permission", 2_400_000)]),
    dict(id="parking", name="Worker parking", unit="spaces", cap_type="consented", ratio=0.62,
         steps=[(0, 1180)], route="non_material_amendment",
         quote="On-site parking for construction personnel shall not exceed 1,180 spaces at any time during the construction phase.",
         clause="CTMP rev C \u00a74.2 (fictional)",
         remedies=[("Staggered shift starts", 90, 3, "exempt", 25_000), ("Remote lot with shuttle", 350, 14, "permission", 620_000),
                   ("Deck the north car park", 500, 22, "permission", 1_900_000)]),
    dict(id="welfare", name="Welfare", unit="WCs", cap_type="physical", ratio=1/25,
         steps=[(0, 96), (40, 112)], remedies=[("Hired welfare units, plumbed", 24, 6, "exempt", 90_000),
                                               ("Fifth welfare block", 40, 16, "s5_declaration", 410_000)]),
    dict(id="gates", name="Gates, access & induction", unit="inductions/day", cap_type="physical", ratio=0.052,
         steps=[(0, 88)], remedies=[("Third induction room", 44, 5, "exempt", 60_000),
                                    ("Off-site induction centre", 120, 12, "cemp_variation", 340_000)]),
    dict(id="hgv", name="Deliveries & vehicles", unit="HGV movements/day", cap_type="consented", ratio=0.078,
         steps=[(0, 240)], route="agreement_under_condition",
         quote="Construction-related HGV movements to and from the site shall not exceed 240 per day (120 in, 120 out) Monday to Friday.",
         clause="Condition 14(b) of the parent permission (fictional)",
         remedies=[("Consolidation centre", 60, 12, "cemp_variation", 520_000), ("Rail-fed aggregate", 40, 20, "permission", 900_000)]),
    dict(id="laydown", name="Laydown & warehousing", unit="m\u00b2 serviced", cap_type="physical", ratio=7.4,
         steps=[(0, 19500), (55, 26000)], remedies=[("Open the east field early", 6500, 8, "exempt", 240_000),
                                                    ("Off-site warehouse", 8000, 10, "exempt", 380_000)]),
    dict(id="bus", name="Bussing & park-and-ride", unit="seats", cap_type="physical", ratio=0.29,
         steps=[(0, 840)], remedies=[("Two more coaches", 120, 4, "exempt", 110_000),
                                     ("Second park-and-ride", 400, 18, "permission", 760_000)]),
    dict(id="canteen", name="Canteens", unit="covers", cap_type="physical", ratio=0.41,
         steps=[(0, 1080)], remedies=[("Third sitting", 300, 3, "exempt", 40_000),
                                      ("Fourth canteen", 400, 14, "s5_declaration", 520_000)]),
]

def capcurve(d, n=104):
    steps = sorted(d["steps"]); out, cur = [], steps[0][1]
    for w in range(n):
        for f, v in steps:
            if f == w: cur = v
        out.append(cur)
    return out

def evaluate(d):
    dem = [round(h * d["ratio"]) for h in HC]
    cap = capcurve(d)
    reach = next((w for w in range(104) if dem[w] > cap[w]), None)
    short = max(dem[w] - cap[w] for w in range(104))
    route = ROUTES[d["route"]] if d["cap_type"] == "consented" else 0
    # Same rule as genkai/middleware.js chooseRemedy: the cheapest remedy that
    # covers the peak shortfall, else the one that adds the most.
    opts = [dict(name=n, add=a, total=b + max(REMEDY_CONSENT[c], route), consent=c, cost=k)
            for n, a, b, c, k in d["remedies"]]
    covering = [o for o in opts if o["add"] >= short]
    best = min(covering, key=lambda o: o["cost"]) if covering else max(opts, key=lambda o: o["add"])
    decide = None if reach is None else reach - best["total"]
    status = "clear"
    if reach is not None:
        status = "reached" if reach <= TODAY_W else ("decide passed" if decide < TODAY_W else "watch")
    return dict(d, dem=dem, cap=cap, reach=reach, short=short, remedy=best, decide=decide, status=status,
                label="cap-reach forecast" if d["cap_type"] == "consented" else "capacity-reach date")

EV = [evaluate(d) for d in DOMAINS]
WEL = next(e for e in EV if e["id"] == "welfare")
PARK = next(e for e in EV if e["id"] == "parking")

# --------------------------------------------------------------- drawing ---
def ease(t):  return t * t * (3 - 2 * t)
def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def mix(c1, c2, t): return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
def fade(c, t):     return mix(BG, c, clamp(t))

def tracked(d, xy, text, f, fill, tr):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + tr
    return x

def wrap(d, text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def logomark(d, x, y, s=1.0, alpha=1.0):
    """Three bars under a shu rule — the mark."""
    bw, gap = int(13 * s), int(7 * s)
    hs = [int(46 * s), int(30 * s), int(56 * s)]
    top = y + int(14 * s)
    d.rectangle([x, y, x + bw * 3 + gap * 2, y + int(5 * s)], fill=fade(SHU, alpha))
    for i, hh in enumerate(hs):
        bx = x + i * (bw + gap)
        col = fade(INK if i != 1 else (150, 165, 185), alpha)
        d.rectangle([bx, top + (max(hs) - hh), bx + bw, top + max(hs)], fill=col)

def chrome(d, alpha=1.0):
    """Header mark, synthetic pill, footer."""
    logomark(d, 96, 58, 0.62, alpha)
    tracked(d, (150, 60), "GENKAI", sans(23, True), fade(INK, alpha), 5)
    tracked(d, (151, 90), "BY DGMO CONSULTANCY", sans(11), fade(MUTED, alpha), 3)
    f = sans(14, True)
    txt = "SYNTHETIC DEMONSTRATION DATA"
    wpx = d.textlength(txt, font=f) + 3 * len(txt)
    x0 = W - 96 - wpx - 46
    d.rounded_rectangle([x0, 58, W - 96, 96], 19, outline=fade(AMBER, alpha * 0.85), width=1)
    d.ellipse([x0 + 18, 73, x0 + 26, 81], fill=fade(AMBER, alpha))
    tracked(d, (x0 + 34, 68), txt, f, fade(AMBER, alpha), 3)
    fm = mono(15)
    d.text((96, H - 74), "GENKAI  \u00b7  by DGMO Consultancy", font=fm, fill=fade(MUTED, alpha * 0.85))
    r = "DC-North Campus  \u00b7  a campus that does not exist"
    d.text((W - 96 - d.textlength(r, font=fm), H - 74), r, font=fm, fill=fade(MUTED, alpha * 0.85))

def heading(d, overline, title, sub, a_over, a_title, a_sub, sub_max=1180):
    tracked(d, (96, 176), overline, sans(15, True), fade(AMBER, a_over), 6)
    d.text((96, 212), title, font=sans(62, True), fill=fade(INK, a_title))
    if sub:
        f = sans(24)
        for i, ln in enumerate(wrap(d, sub, f, sub_max)):
            d.text((96, 300 + i * 34), ln, font=f, fill=fade(MUTED, a_sub))

# ---- chart -----------------------------------------------------------------
CL, CR, CT, CB = 210, W - 130, 400, H - 150

def ticks(top, want=4):
    """Gridlines on round numbers, so the axis never reads 3,985."""
    raw = top / want
    mag = 10 ** math.floor(math.log10(raw))
    step = next(mm * mag for mm in (1, 2, 2.5, 5, 10) if mm * mag >= raw)
    out, v = [], 0.0
    while v <= top:
        out.append(v); v += step
    return out

def chart(d, dem, cap, unit, reveal=1.0, show_cap=0.0, shade=0.0,
          mark_reach=0.0, mark_decide=0.0, reach=None, decide=None, ymax=None):
    n = len(dem)
    top = ymax or max(max(dem), max(cap)) * 1.16
    X = lambda w: CL + (w / (n - 1)) * (CR - CL)
    Y = lambda v: CT + (1 - v / top) * (CB - CT)
    for v in ticks(top):
        d.line([CL, Y(v), CR, Y(v)], fill=BORDER)
        lbl = f"{round(v):,}"
        d.text((CL - 16 - d.textlength(lbl, font=mono(16)), Y(v) - 10), lbl, font=mono(16), fill=MUTED)
    for w in range(0, n, 13):
        lbl = fmonth(w)
        d.text((X(w) - d.textlength(lbl, font=mono(16)) / 2, CB + 16), lbl, font=mono(16), fill=MUTED)
    d.text((CR - d.textlength(unit, font=mono(17)), CT - 30), unit, font=mono(17), fill=MUTED)

    upto = max(2, int(n * clamp(reveal)))

    if show_cap > 0:
        cn = max(2, int(n * clamp(show_cap)))
        pts = []
        for w in range(cn):
            if w and cap[w] != cap[w - 1]:
                pts.append((X(w), Y(cap[w - 1])))
            pts.append((X(w), Y(cap[w])))
        d.line(pts, fill=fade(SHU, min(1.0, show_cap * 2)), width=4, joint="curve")

    if shade > 0 and reach is not None:
        end = reach + int((upto - reach) * clamp(shade)) if upto > reach else reach
        poly = [(X(w), Y(dem[w])) for w in range(reach, max(reach + 1, end)) if dem[w] > cap[w]]
        if len(poly) > 1:
            back = [(X(w), Y(cap[w])) for w in range(max(reach + 1, end) - 1, reach - 1, -1)]
            ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(ov).polygon(poly + back, fill=SHU + (66,))
            d._image.paste(Image.alpha_composite(d._image.convert("RGBA"), ov).convert("RGB"), (0, 0))

    d.line([(X(w), Y(dem[w])) for w in range(upto)], fill=AMBER, width=5, joint="curve")

    def marker(w, label, col, t, dash=True):
        if w is None or t <= 0: return
        a = clamp(t)
        y1 = CT + (1 - a) * (CB - CT) * 0.25
        if dash:
            yy = CT
            while yy < CB:
                d.line([X(w), yy, X(w), min(yy + 9, CB)], fill=fade(col, a), width=2); yy += 18
        else:
            d.line([X(w), y1, X(w), CB], fill=fade(col, a), width=3)
        d.text((X(w) + 10, CT - 4), label, font=mono(17), fill=fade(col, a))

    marker(TODAY_W, "NOW", MUTED, 1.0)
    marker(reach, "REACHES CAPACITY", INK, mark_reach, dash=False)
    marker(decide, "DECIDE BY", AMBER, mark_decide)

# ---- domain board ----------------------------------------------------------
STCOL = {"clear": GREEN, "watch": BLUE, "decide passed": AMBER, "reached": RED}

def board(d, t):
    cw, ch, gx, gy = 400, 176, 32, 30
    x0, y0 = 96, 414
    fb, fv, fu, fm = sans(19, True), mono(27), mono(14), mono(16)
    for i, e in enumerate(EV):
        a = clamp((t - i * 0.055) / 0.28)
        if a <= 0: continue
        cx, cy = x0 + (i % 4) * (cw + gx), y0 + (i // 4) * (ch + gy)
        col = STCOL[e["status"]]
        d.rounded_rectangle([cx, cy, cx + cw, cy + ch], 12, fill=fade(CARD, a), outline=fade(BORDER, a))
        d.rectangle([cx, cy + 2, cx + 4, cy + ch - 2], fill=fade(col, a))

        # status badge top-right; the name wraps inside the column it leaves
        st = e["status"].upper()
        bw = d.textlength(st, font=fm) + 22
        d.rounded_rectangle([cx + cw - 20 - bw, cy + 18, cx + cw - 20, cy + 44], 13, outline=fade(col, a))
        d.text((cx + cw - 9 - bw, cy + 22), st, font=fm, fill=fade(col, a))

        d.text((cx + 24, cy + 20), f"{i+1}", font=fb, fill=fade(MUTED, a))
        for j, ln in enumerate(wrap(d, e["name"], fb, cw - 92 - bw)):
            d.text((cx + 48, cy + 20 + j * 24), ln, font=fb, fill=fade(INK, a))

        v = f"{e['dem'][TODAY_W]:,} / {e['cap'][TODAY_W]:,}"
        d.text((cx + 24, cy + 80), v, font=fv, fill=fade(INK, a))
        d.text((cx + 30 + d.textlength(v, font=fv), cy + 92), e["unit"], font=fu, fill=fade(MUTED, a))

        rdate = fmonth(e["reach"]) if e["reach"] is not None else "—"
        if e["reach"] is None:
            d.text((cx + 24, cy + 130), "no crossing on this curve", font=fm, fill=fade(GREEN, a))
        else:
            d.text((cx + 24, cy + 128), f"{e['label']} {rdate}", font=fm, fill=fade(MUTED, a))
            d.text((cx + 24, cy + 150), f"decide {fmonth(e['decide'])}", font=fm, fill=fade(MUTED, a))

def collision(d, t):
    x0, x1 = 560, W - 150
    X = lambda w: x0 + (w / 103) * (x1 - x0)
    for w in range(0, 104, 13):
        d.line([X(w), 400, X(w), 890], fill=BORDER)
        lbl = fmonth(w)
        d.text((X(w) - d.textlength(lbl, font=mono(16)) / 2, 904), lbl, font=mono(16), fill=MUTED)
    for i, e in enumerate(EV):
        a = clamp((t - i * 0.06) / 0.3)
        if a <= 0: continue
        y = 434 + i * 56
        d.text((x0 - 24 - d.textlength(f"{i+1} {e['name']}", font=sans(21)), y - 12),
               f"{i+1} {e['name']}", font=sans(21), fill=fade(INK, a))
        if e["reach"] is None:
            d.text((X(0) + 12, y - 10), "no crossing on the current curve", font=mono(17), fill=fade(GREEN, a))
            continue
        col = STCOL[e["status"]]
        s, ee = X(max(0, e["decide"])), X(e["reach"])
        w = max(6, (ee - s) * a)
        d.rounded_rectangle([s, y - 11, s + w, y + 11], 6, fill=fade(col, a * 0.9))
        d.line([ee, y - 18, ee, y + 18], fill=fade(SHU, a), width=4)
    d.line([X(TODAY_W), 400, X(TODAY_W), 890], fill=MUTED, width=2)
    d.text((X(TODAY_W) + 10, 372), "NOW", font=mono(17), fill=MUTED)

# ----------------------------------------------------------------- scenes ---
SCENES = []
def scene(dur):
    def deco(fn): SCENES.append((dur, fn)); return fn
    return deco

@scene(4.0)
def s_open(d, p):
    a = clamp(p / 0.22) * clamp((1 - p) / 0.16)
    logomark(d, W // 2 - 60, 372, 2.1, a)
    tracked(d, (W // 2 - 232, 508), "GENKAI", sans(84, True), fade(INK, a), 20)
    x = W // 2 - 150
    d.text((x, 632), "\u9650\u754c", font=jp(30), fill=fade(MUTED, a))
    d.ellipse([x + 84, 646, x + 92, 654], fill=fade(MUTED, a))
    tracked(d, (x + 112, 634), "THE LIMIT", sans(24, True), fade(MUTED, a), 8)
    tracked(d, (W // 2 - 156, 700), "BY DGMO CONSULTANCY", sans(15), fade(MUTED, a * 0.8), 5)

@scene(7.0)
def s_board(d, p):
    a = clamp(p / 0.09) * clamp((1 - p) / 0.07)
    chrome(d, a)
    heading(d, "THE ESTATE", "Eight shared services. One campus.",
            "Every one of them is drawn on by every contractor, and nobody is commissioned to add them up.",
            a, a, a * clamp((p - 0.07) / 0.12))
    board(d, clamp((p - 0.12) / 0.55) * a)

@scene(6.0)
def s_curve(d, p):
    a = clamp(p / 0.10) * clamp((1 - p) / 0.08)
    chrome(d, a)
    heading(d, "THE INPUT", "One workforce curve.",
            f"Everything that follows is derived from it. Peak {max(HC):,} on site, {fmonth(PEAK_W)}.",
            a, a, a * clamp((p - 0.08) / 0.12))
    chart(d, HC, [0] * 104, "persons on site", reveal=ease(clamp((p - 0.14) / 0.62)), ymax=max(HC) * 1.16)

@scene(6.5)
def s_demand(d, p):
    a = clamp(p / 0.10) * clamp((1 - p) / 0.08)
    chrome(d, a)
    heading(d, "THE DEMAND", "What the site needs.",
            "Workers times the statutory welfare ratio, week by week \u2014 one WC per twenty-five persons. "
            "The ratio is an input carrying its instrument and its date, not a constant.",
            a, a, a * clamp((p - 0.08) / 0.12))
    chart(d, WEL["dem"], WEL["cap"], WEL["unit"], reveal=ease(clamp((p - 0.16) / 0.6)),
          ymax=max(WEL["dem"]) * 1.16)

@scene(6.5)
def s_capacity(d, p):
    a = clamp(p / 0.10) * clamp((1 - p) / 0.08)
    chrome(d, a)
    heading(d, "THE CAPACITY", "What is actually installed.",
            "Drawn as a staircase, because provision arrives on dates. Not as a smooth line.",
            a, a, a * clamp((p - 0.08) / 0.12))
    chart(d, WEL["dem"], WEL["cap"], WEL["unit"], show_cap=ease(clamp((p - 0.14) / 0.55)),
          ymax=max(WEL["dem"]) * 1.16)

@scene(6.5)
def s_cross(d, p):
    a = clamp(p / 0.10) * clamp((1 - p) / 0.08)
    chrome(d, a)
    heading(d, "THE CROSSING", f"It reaches capacity in {fmonth(WEL['reach'])}.",
            "Shading appears only above the rule and only after the crossing \u2014 that area is the shortfall itself.",
            a, a, a * clamp((p - 0.08) / 0.12))
    chart(d, WEL["dem"], WEL["cap"], WEL["unit"], show_cap=1.0,
          shade=ease(clamp((p - 0.2) / 0.5)), mark_reach=clamp((p - 0.16) / 0.16),
          reach=WEL["reach"], ymax=max(WEL["dem"]) * 1.16)

@scene(6.5)
def s_decide(d, p):
    a = clamp(p / 0.10) * clamp((1 - p) / 0.08)
    chrome(d, a)
    heading(d, "THE DATE THAT MATTERS", f"The remedy takes {WEL['remedy']['total']} weeks.",
            f"{WEL['remedy']['name']} \u2014 sixteen weeks to build, six for the consent step. "
            f"So the decision was due {fmonth(WEL['decide'])}, and that is the date most programmes never hold.",
            a, a, a * clamp((p - 0.08) / 0.12))
    chart(d, WEL["dem"], WEL["cap"], WEL["unit"], show_cap=1.0, shade=1.0, mark_reach=1.0,
          mark_decide=ease(clamp((p - 0.2) / 0.26)), reach=WEL["reach"], decide=WEL["decide"],
          ymax=max(WEL["dem"]) * 1.16)

@scene(5.0)
def s_consent(d, p):
    a = clamp(p / 0.12) * clamp((1 - p) / 0.10)
    chrome(d, a)
    heading(d, "THE CONSENT", "Not every limit is physical.",
            "Some caps are written into a consent. Those get a cap-reach forecast, "
            "the instrument quoted and the route to relief named.",
            a, a, a * clamp((p - 0.10) / 0.12))
    ab = a * clamp((p - 0.2) / 0.2)
    d.rounded_rectangle([96, 420, W - 96, 700], 14, fill=fade(CARD, ab), outline=fade(BORDER, ab))
    tracked(d, (140, 456), "WORKER PARKING  \u00b7  CONSENTED CAP", sans(15, True), fade(AMBER, ab), 5)
    f = sans(30)
    for i, ln in enumerate(wrap(d, "\u201c" + PARK["quote"] + "\u201d", f, W - 320)):
        d.text((140, 496 + i * 42), ln, font=f, fill=fade(INK, ab))
    fm = mono(19)
    d.text((140, 600), PARK["clause"], font=fm, fill=fade(MUTED, ab))
    d.text((140, 636), "Route to relief: non-material amendment  \u00b7  12 weeks  \u00b7  "
                       "signed by: planning advice required", font=fm, fill=fade(MUTED, ab))
    d.text((140, 664), f"Cap-reach forecast {fmonth(PARK['reach'])}  \u00b7  the lead time comes from the route, "
                       f"never typed by hand", font=fm, fill=fade(MUTED, ab))

@scene(4.0)
def s_collision(d, p):
    a = clamp(p / 0.14) * clamp((1 - p) / 0.10)
    chrome(d, a)
    heading(d, "THE COLLISION", "Put them on one axis.",
            "Each bar runs from the decide-by date to the date capacity is reached \u2014 "
            "the window in which a decision is still cheap.", a, a, a * clamp((p - 0.10) / 0.12))
    collision(d, clamp((p - 0.14) / 0.6) * a)

@scene(3.3)
def s_close(d, p):
    a = clamp(p / 0.2)
    logomark(d, W // 2 - 60, 340, 2.1, a)
    tracked(d, (W // 2 - 232, 476), "GENKAI", sans(84, True), fade(INK, a), 20)
    f = sans(34, True)
    for i, ln in enumerate(["Know when you run out \u2014", "months before you do."]):
        d.text((W // 2 - d.textlength(ln, font=f) / 2, 604 + i * 46), ln, font=f, fill=fade(INK, a))
    t = "dgmoconsultancy.com/genkai/"
    d.text((W // 2 - d.textlength(t, font=mono(22)) / 2, 712), t, font=mono(22), fill=fade(AMBER, a))
    fm = mono(17)
    for i, ln in enumerate(["Every figure in this film is invented for demonstration.",
                            "No client data appears anywhere in it."]):
        d.text((W // 2 - d.textlength(ln, font=fm) / 2, 800 + i * 26), ln, font=fm, fill=fade(MUTED, a * 0.8))

# ------------------------------------------------------------------ render --
def render(idx):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img); d._image = img
    d.rectangle([0, 0, W, 6], fill=SHU)                 # the ceiling
    d.polygon([(W - 96, 0), (W - 78, 18), (W - 96, 36), (W - 114, 18)], fill=SHU)
    t, acc = idx / FPS, 0.0
    for dur, fn in SCENES:
        if t < acc + dur or (dur, fn) is SCENES[-1] and t >= acc:
            fn(d, clamp((t - acc) / dur)); break
        acc += dur
    return img

def main():
    total = sum(d for d, _ in SCENES)
    frames = int(total * FPS)
    ff = __import__("imageio_ffmpeg").get_ffmpeg_exe()

    if "--poster-only" in sys.argv:
        render(int(7.4 * FPS)).save(POSTER, quality=88, optimize=True)
        print("wrote", POSTER); return

    tmp = OUT + ".tmp.mp4"
    cmd = [ff, "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", AUDIO_SRC, "-map", "0:v", "-map", "1:a?",
           "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", tmp]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    poster_at = int(7.4 * FPS)
    for i in range(frames):
        im = render(i)
        if i == poster_at:
            im.save(POSTER, quality=88, optimize=True)
        p.stdin.write(im.tobytes())
        if i % 150 == 0:
            print(f"  {i}/{frames}  {i/FPS:5.1f}s", flush=True)
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit("ffmpeg failed")
    os.replace(tmp, OUT)
    print("wrote", OUT, os.path.getsize(OUT), "bytes;", POSTER)
    print(f"duration {total:.2f}s, {frames} frames")

if __name__ == "__main__":
    main()
