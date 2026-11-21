#!/usr/bin/env python3
"""Générateur des pages indexables du blog « SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH ».

Le blog est une application monopage (adresses en #...) que les moteurs de recherche
indexent mal. Ce script produit, à partir des fichiers data/*.json, une vraie page HTML
statique par contenu (cours, fiches, articles, études de cas, épisodes, publications,
catalogue de recherche, glossaire, etc.), plus sitemap.xml, robots.txt, le fichier de clé
IndexNow et un bloc HTML statique dans index.html (liens visibles sans JavaScript).

Usage : python3 seo/build_seo.py [dossier_du_site]
Aucune dépendance : bibliothèque standard Python 3.8+. Sortie déterministe.
"""
import html, json, os, re, shutil, sys, unicodedata

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), ".."))
CFG = json.load(open(os.path.join(ROOT, "seo", "config.json"), encoding="utf-8"))
BASE = CFG["base_url"].rstrip("/")
SITE = CFG["site_name"]
SHORT = CFG.get("site_short", "Sociologie de l'Économie")
GENERATED_DIRS = ["cours", "savoirs", "glossaire", "etudes-de-cas", "articles", "formations", "recherche",
                  "publications", "dr-fabrice-tanoh", "podcast", "observatoire", "actualites", "bibliotheque",
                  "debats", "a-propos", "chartes", "plan-du-site"]
THEMES = {"informel": "Économie informelle", "travail": "Travail & emploi", "marches": "Marchés", "agriculture": "Agriculture",
          "entrepreneuriat": "Entrepreneuriat", "developpement": "Développement", "inegalites": "Inégalités", "genre": "Genre",
          "finance": "Finance populaire", "environnement": "Environnement", "organisations": "Organisations",
          "savoir": "Savoir & éducation", "numerique": "Numérique", "transport": "Transport", "dette": "Dette",
          "migrations": "Migrations", "politiques": "Politiques publiques"}
NIVEAUX = {"debutant": "Débutant", "intermediaire": "Intermédiaire", "avance": "Avancé"}
INSTIT = [("Université Peleforo Gon Coulibaly (Korhogo)", "https://www.univ-pgc.edu.ci/"),
          ("CAMES – Conseil africain et malgache pour l'enseignement supérieur", "https://www.lecames.org/")]


def load(name, default=None):
    p = os.path.join(ROOT, "data", name)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


C = load("content.json", {}) or {}
COURSES = load("courses.json", []) or []
AUT = load("auteur.json", {}) or {}
POD = load("podcast.json", {}) or {}
FORM = load("formations.json", {}) or {}
OBS = load("observatoire.json", {}) or {}
REC = load("recherche.json", {}) or {}
BIB = load("bibliotheque.json", {}) or {}
ACT = load("actualites.json", {}) or {}

URLS = []  # (chemin, lastmod, priorité)


def e(x):
    return html.escape("" if x is None else str(x), quote=True)


def slug(s, n=80):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:n].rstrip("-") or "page"


def clip(s, n=158):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def d10(x):
    m = re.match(r"\d{4}-\d{2}-\d{2}", str(x or ""))
    return m.group(0) if m else None


SITE_MAJ = max([d for d in [d10(C.get("maj")), d10(AUT.get("maj")), d10(POD.get("maj")), d10(FORM.get("maj")),
                            d10(OBS.get("maj")), d10(REC.get("maj")), d10(BIB.get("maj")), d10(ACT.get("maj"))] if d] or ["2026-11-21"])


def md(text):
    """Markdown minimal (titres, listes, gras) -> HTML."""
    out, lst = [], False
    for line in str(text or "").split("\n"):
        t = line.strip()
        if not t:
            if lst:
                out.append("</ul>"); lst = False
            continue
        t2 = e(t)
        t2 = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t2)
        if t.startswith("#"):
            if lst:
                out.append("</ul>"); lst = False
            lvl = min(4, max(2, len(t) - len(t.lstrip("#")) + 1))
            out.append(f"<h{lvl}>{t2.lstrip('#').strip()}</h{lvl}>")
        elif re.match(r"^[-*•] ", t):
            if not lst:
                out.append("<ul>"); lst = True
            out.append(f"<li>{t2[2:]}</li>")
        else:
            if lst:
                out.append("</ul>"); lst = False
            out.append(f"<p>{t2}</p>")
    if lst:
        out.append("</ul>")
    return "\n".join(out)


def paras(x):
    if isinstance(x, list):
        return "".join(f"<p>{e(p)}</p>" for p in x if p)
    return "".join(f"<p>{e(p)}</p>" for p in str(x or "").split("\n") if p.strip())


def ul(items):
    items = [i for i in (items or []) if i]
    return "<ul>" + "".join(f"<li>{e(i)}</li>" for i in items) + "</ul>" if items else ""


SKIP = {"type", "kind", "couleur", "icone", "id", "image", "anim", "animation", "layout", "style", "titre"}
LABELS = {"definition": "Définition", "contexte": "Contexte", "source": "Source", "commentaire": "Commentaire",
          "question": "Question", "analyse": "Analyse", "exemple": "Exemple", "lecon": "Leçon", "texte": ""}


def render_any(v, depth=0):
    if v is None or v == "" or v == []:
        return ""
    if isinstance(v, (str, int, float)):
        return f"<p>{e(v)}</p>"
    if isinstance(v, list):
        if all(isinstance(i, (str, int, float)) for i in v):
            return ul(v)
        lis = []
        for i in v:
            if isinstance(i, dict):
                parts = [str(i[k]) for k in i if k not in SKIP and isinstance(i[k], (str, int, float)) and str(i[k]).strip()]
                head = i.get("titre") or i.get("label") or i.get("auteur") or i.get("pays") or i.get("nom")
                rest = [p for p in parts if p != str(head)] if head else parts
                sub = "".join(render_any(i[k], depth + 1) for k in i if k not in SKIP and isinstance(i[k], (list, dict)))
                lis.append("<li>" + (f"<b>{e(head)}</b> — " if head else "") + e(" — ".join(rest)) + sub + "</li>")
            else:
                lis.append(f"<li>{render_any(i, depth + 1)}</li>")
        return "<ul>" + "".join(lis) + "</ul>"
    if isinstance(v, dict):
        out = []
        for k, val in v.items():
            if k in SKIP and k != "titre":
                continue
            if k == "titre" and depth > 0:
                out.append(f"<p><b>{e(val)}</b></p>"); continue
            if k == "titre":
                continue
            lab = LABELS.get(k)
            inner = render_any(val, depth + 1)
            if not inner:
                continue
            if lab and isinstance(val, str):
                out.append(f"<p><b>{e(lab)} :</b> {e(val)}</p>")
            else:
                out.append(inner)
        return "".join(out)
    return ""


def table_graph(sl):
    labels = sl.get("labels") or []
    series = sl.get("series") or []
    if not labels or not series:
        return ""
    th = "".join(f"<th>{e(s.get('nom', ''))}</th>" for s in series)
    rows = []
    for i, lab in enumerate(labels):
        tds = "".join(f"<td>{e((s.get('valeurs') or [None] * len(labels))[i] if i < len(s.get('valeurs') or []) else '')}</td>" for s in series)
        rows.append(f"<tr><th scope=\"row\">{e(lab)}</th>{tds}</tr>")
    cap = e(sl.get("unite") or sl.get("label") or "")
    src = sl.get("source")
    url = sl.get("url")
    s = f"<div class=\"tw\"><table><caption>{cap}</caption><thead><tr><th></th>{th}</tr></thead><tbody>{''.join(rows)}</tbody></table></div>"
    if src:
        s += f"<p class=\"src\">Source : {f'<a href={chr(34)}{e(url)}{chr(34)} rel={chr(34)}noopener{chr(34)}>{e(src)}</a>' if url else e(src)}</p>"
    if sl.get("commentaire") or sl.get("lecture"):
        s += f"<p>{e(sl.get('commentaire') or sl.get('lecture'))}</p>"
    return s


def render_slide(sl):
    t = sl.get("titre", "")
    body = table_graph(sl) if sl.get("type") == "graphique" else render_any({k: v for k, v in sl.items() if k not in ("labels", "series")})
    return f"<section class=\"slide\"><h3>{e(t)}</h3>{body}</section>"


# ---------------------------------------------------------------- gabarit
CSS = """:root{--b:#0E2A47;--o:#F77F00;--g:#009E60;--t:#1f2937;--m:#5b6472;--bg:#fff;--c:#f5f7fa;--l:#e3e8ef;--a:#1d5fa8}
@media (prefers-color-scheme:dark){:root{--t:#e6ebf2;--m:#a8b3c2;--bg:#0d1520;--c:#152233;--l:#23344a;--a:#7fb4ff}}
*{box-sizing:border-box}td,.src,.meta,li,p{overflow-wrap:anywhere}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--t);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
a{color:var(--a)}a:hover{color:var(--o)}img{max-width:100%;height:auto}
.w{max-width:1040px;margin:0 auto;padding:0 18px}
.sh{background:var(--b);color:#fff;position:sticky;top:0;z-index:5}.sh .w{display:flex;flex-wrap:wrap;align-items:center;gap:8px 22px;padding-top:10px;padding-bottom:10px}
.brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.3px;line-height:1.15}.brand small{display:block;font-weight:500;color:#f7b25c;font-size:.78rem;letter-spacing:1.5px;text-transform:uppercase}.brand svg{width:38px;height:38px;flex:none}
.sh nav{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.92rem}.sh nav a{color:#dfe8f3;text-decoration:none}.sh nav a:hover{color:#fff;text-decoration:underline}
main{padding:22px 0 40px}.crumb{font-size:.86rem;color:var(--m);margin:6px 0 14px}.crumb a{color:var(--m)}
h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.2;margin:.2em 0 .4em;color:var(--t)}
h2{font-family:Georgia,"Times New Roman",serif;font-size:1.45rem;margin:1.8em 0 .5em;padding-top:.3em;border-top:3px solid var(--o);display:inline-block}
h3{font-size:1.12rem;margin:1.3em 0 .4em}.lead{font-size:1.15rem;color:var(--m)}
.kick{text-transform:uppercase;letter-spacing:2px;font-size:.78rem;font-weight:700;color:var(--g)}
.meta{color:var(--m);font-size:.92rem}.chip{display:inline-block;background:var(--c);border:1px solid var(--l);border-radius:99px;padding:1px 10px;margin:2px 4px 2px 0;font-size:.82rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px;margin:14px 0}
.card{background:var(--c);border:1px solid var(--l);border-radius:14px;padding:16px 18px}.card h3{margin-top:0}.card p{margin:.4em 0}
.slide{border-left:4px solid var(--g);padding:2px 0 2px 16px;margin:18px 0}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.92rem;margin:8px 0}th,td{border:1px solid var(--l);padding:5px 8px;text-align:left}caption{text-align:left;color:var(--m);font-size:.85rem}
.src{font-size:.85rem;color:var(--m)}
.btn{display:inline-block;background:var(--o);color:#fff!important;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px;margin:6px 8px 6px 0}.btn.s{background:var(--b)}
.cta{margin:26px 0;padding:18px;background:var(--c);border-radius:14px;border:1px solid var(--l)}
.dlg p{margin:.35em 0}.dlg b{color:var(--g)}
details{background:var(--c);border:1px solid var(--l);border-radius:10px;padding:8px 14px;margin:8px 0}summary{cursor:pointer;font-weight:600}
@media(max-width:700px){.sh{position:static}.sh nav{font-size:.86rem}}
footer{background:var(--b);color:#cfdbe9;font-size:.92rem;padding:26px 0}footer a{color:#fff}footer .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}
footer h4{color:#fff;margin:0 0 6px}footer ul{list-style:none;padding:0;margin:0}footer li{margin:3px 0}
"""

LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#0b2340"/><path d="M9 29V14l7 9 7-9v15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="12" r="4" fill="#F77F00"/><circle cx="30" cy="26" r="3" fill="#009E60"/></svg>'
NAV = [("Le chercheur", "/dr-fabrice-tanoh/"), ("Publications", "/publications/"), ("Cours", "/cours/"), ("Savoirs", "/savoirs/"),
       ("Formations", "/formations/"), ("Recherche", "/recherche/"), ("Podcast", "/podcast/"), ("Observatoire", "/observatoire/"),
       ("Débats", "/debats/"), ("Actualités", "/actualites/")]


def person_ld():
    prof = [p.get("url") for p in AUT.get("profils", []) if p.get("url")]
    return {"@type": "Person", "@id": BASE + "/#auteur", "name": "Fabrice TANOH", "honorificPrefix": "Dr",
            "jobTitle": "Maître-assistant en sociologie économique", "url": BASE + "/dr-fabrice-tanoh/",
            "image": BASE + "/img/portrait-carre.jpg", "description": AUT.get("bio_courte", ""),
            "worksFor": {"@type": "CollegeOrUniversity", "name": "Université Peleforo Gon Coulibaly", "url": INSTIT[0][1],
                         "address": {"@type": "PostalAddress", "addressLocality": "Korhogo", "addressCountry": "CI"}},
            "alumniOf": {"@type": "CollegeOrUniversity", "name": "Université Félix Houphouët-Boigny"},
            "knowsAbout": AUT.get("domaines", []), "sameAs": prof}


def page(path, title, desc, body, crumbs=None, ld=None, interactive=None, lastmod=None, prio="0.6", ogtype="article", image=None):
    """Écrit <path>/index.html. path commence et finit par « / »."""
    url = BASE + path
    full_title = f"{title} | {SHORT} – Blog Dr Fabrice TANOH" if path != "/plan-du-site/" or True else title
    if len(full_title) > 95:
        full_title = f"{title} | {SHORT}"
    crumbs = crumbs or []
    bc = [("Accueil", "/")] + crumbs
    crumb_html = " › ".join(f'<a href="{u}">{e(n)}</a>' if u else e(n) for n, u in bc)
    graph = [{"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": BASE + (u or path)} for i, (n, u) in enumerate(bc + [(title, path)])]}]
    if ld:
        graph += ld if isinstance(ld, list) else [ld]
    jsonld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")
    img = image or BASE + "/img/og-image.jpg"
    cta = ""
    if interactive:
        cta = (f'<div class="cta"><b>Version interactive</b> — diaporamas animés, quiz, recherche, assistant et espace de contribution : '
               f'<br><a class="btn" href="/{interactive}">Ouvrir dans le blog interactif</a></div>')
    verif = ""
    if CFG.get("google_site_verification"):
        verif += f'<meta name="google-site-verification" content="{e(CFG["google_site_verification"])}">\n'
    if CFG.get("bing_site_verification"):
        verif += f'<meta name="msvalidate.01" content="{e(CFG["bing_site_verification"])}">\n'
    doc = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(full_title)}</title>
<meta name="description" content="{e(clip(desc))}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="Dr Fabrice TANOH">
<link rel="canonical" href="{url}">
{verif}<meta property="og:type" content="{ogtype}">
<meta property="og:site_name" content="{e(SITE)}">
<meta property="og:locale" content="fr_CI">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(clip(desc, 200))}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{e(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E2A47">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/img/icon-180.png">
<link rel="alternate" type="application/rss+xml" title="Socio-Éco, le podcast" href="/podcast.xml">
<link rel="stylesheet" href="/assets/seo.css">
<script type="application/ld+json">{jsonld}</script>
</head>
<body>
<header class="sh"><div class="w"><a class="brand" href="/">{LOGO}<span>SOCIOLOGIE DE L'ÉCONOMIE<small>Blog Dr Fabrice TANOH</small></span></a>
<nav aria-label="Navigation principale">{''.join(f'<a href="{u}">{e(n)}</a>' for n, u in NAV)}</nav></div></header>
<main class="w" id="contenu">
<nav class="crumb" aria-label="Fil d'Ariane">{crumb_html}</nav>
{body}
{cta}
</main>
{footer()}
</body>
</html>
"""
    out = os.path.join(ROOT, path.strip("/"), "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(doc)
    URLS.append((path, lastmod or SITE_MAJ, prio))


def footer():
    inst = "".join(f'<li><a href="{u}" rel="noopener">{e(n)}</a></li>' for n, u in INSTIT)
    return f"""<footer><div class="w cols">
<div><h4>SOCIOLOGIE DE L'ÉCONOMIE</h4><p>Blog scientifique de Dr Fabrice TANOH, Maître-assistant en sociologie économique. Comprendre l'économie ivoirienne par le prisme du social.</p></div>
<div><h4>Explorer</h4><ul><li><a href="/cours/">Cours gratuits</a></li><li><a href="/savoirs/">Fiches, glossaire et études de cas</a></li><li><a href="/recherche/">Articles en libre accès</a></li><li><a href="/observatoire/">Données et observatoire</a></li><li><a href="/podcast/">Podcast Socio-Éco</a></li><li><a href="/plan-du-site/">Plan du site</a></li></ul></div>
<div><h4>Liens institutionnels</h4><ul>{inst}<li><a href="/a-propos/">À propos et transparence</a></li></ul></div>
</div><div class="w" style="margin-top:14px;font-size:.85rem">© 2026 {e(SITE)} · Côte d'Ivoire · Contenus sous licence CC BY-NC 4.0 sauf mention contraire</div></footer>"""


def card(title, href, text="", meta=""):
    return (f'<div class="card"><h3><a href="{href}">{e(title)}</a></h3>' + (f'<p class="meta">{meta}</p>' if meta else "") +
            (f"<p>{e(clip(text, 220))}</p>" if text else "") + "</div>")


# ---------------------------------------------------------------- pages
def course_level(c):
    return c.get("niveau") or NIVEAUX.get(c.get("niveau_site"), "")


def build_cours():
    by = {}
    for c in COURSES:
        by.setdefault(course_level(c), []).append(c)
    body = ['<p class="kick">Cours libres et gratuits</p><h1>Cours de sociologie économique</h1>',
            f'<p class="lead">{len(COURSES)} cours complets en accès libre, classés par niveau : notions, auteurs, exemples ivoiriens, données sourcées, quiz, diaporamas animés et vidéos courtes.</p>']
    for lvl in ["Débutant", "Intermédiaire", "Avancé"] + [k for k in by if k not in ("Débutant", "Intermédiaire", "Avancé")]:
        if lvl not in by:
            continue
        body.append(f"<h2>Niveau {e(lvl.lower())}</h2><div class=\"grid\">" + "".join(
            card(c["titre"], f"/cours/{c['id']}/", c.get("resume") or c.get("accroche"), e(THEMES.get(c.get("theme_site"), ""))) for c in by[lvl]) + "</div>")
    items = [{"@type": "ListItem", "position": i + 1, "url": f"{BASE}/cours/{c['id']}/", "name": c["titre"]} for i, c in enumerate(COURSES)]
    page("/cours/", "Cours gratuits de sociologie économique (Côte d'Ivoire)",
         "Cours gratuits de sociologie économique en français, du niveau débutant au niveau avancé : informel, travail, capital social, entrepreneuriat, monde rural, développement, avec exemples ivoiriens.",
         "".join(body), [("Cours", None)], {"@type": "ItemList", "name": "Cours de sociologie économique", "itemListElement": items},
         "#cours", prio="0.9", ogtype="website")
    for c in COURSES:
        cid = c["id"]
        parts = [f'<p class="kick">Cours · niveau {e(course_level(c).lower())} · {e(THEMES.get(c.get("theme_site"), ""))}</p><h1>{e(c["titre"])}</h1>']
        if c.get("accroche"):
            parts.append(f'<p class="lead">{e(c["accroche"])}</p>')
        parts.append(paras(c.get("resume")))
        if os.path.exists(os.path.join(ROOT, "media", cid + ".mp4")):
            parts.append(f'<video controls preload="none" playsinline poster="/media/{cid}_cover.jpg" style="width:100%;max-width:720px;border-radius:12px" src="/media/{cid}.mp4"></video>')
        if c.get("objectifs"):
            parts.append("<h2>Objectifs d'apprentissage</h2>" + ul(c["objectifs"]))
        if c.get("plan"):
            parts.append("<h2>Plan du cours</h2><ol>" + "".join(f"<li>{e(p)}</li>" for p in c["plan"]) + "</ol>")
        if c.get("slides"):
            parts.append("<h2>Contenu du cours</h2>" + "".join(render_slide(s) for s in c["slides"]))
        syn = c.get("synthese")
        if syn:
            parts.append("<h2>À retenir</h2>" + (ul(syn.get("points")) if isinstance(syn, dict) else render_any(syn)))
        deb = c.get("debat")
        if isinstance(deb, dict) and deb.get("question"):
            parts.append(f"<h2>Question de débat</h2><p><b>{e(deb['question'])}</b></p>" + render_any({k: v for k, v in deb.items() if k != "question"}))
        q = c.get("quiz_etudiant") or []
        if q:
            parts.append("<h2>Testez-vous</h2>" + "".join(
                f"<details><summary>{e(x.get('q'))}</summary>{ul(x.get('options'))}" +
                (f"<p><b>Réponse :</b> {e(x['options'][x['bonne']])}" + (f" — {e(x.get('explication'))}" if x.get("explication") else "") + "</p>"
                 if isinstance(x.get("bonne"), int) and x.get("options") and 0 <= x["bonne"] < len(x["options"]) else "") + "</details>" for x in q[:10]))
        refs = c.get("references") or []
        if refs:
            parts.append("<h2>Références</h2><ul>" + "".join(
                f"<li>{e(r.get('auteur', ''))} ({e(r.get('annee', ''))}), <i>{e(r.get('titre', ''))}</i>{', ' + e(r.get('editeur')) if r.get('editeur') else ''}.</li>" if isinstance(r, dict) else f"<li>{e(r)}</li>" for r in refs) + "</ul>")
        others = [o for o in COURSES if o["id"] != cid and course_level(o) == course_level(c)][:4]
        if others:
            parts.append("<h2>Autres cours du même niveau</h2><ul>" + "".join(f'<li><a href="/cours/{o["id"]}/">{e(o["titre"])}</a></li>' for o in others) + "</ul>")
        ld = {"@type": "Course", "name": c["titre"], "description": clip(c.get("resume") or c.get("accroche"), 300), "inLanguage": "fr",
              "educationalLevel": course_level(c), "isAccessibleForFree": True, "url": f"{BASE}/cours/{cid}/",
              "provider": {"@type": "Organization", "name": SITE, "url": BASE + "/"}, "author": {"@id": BASE + "/#auteur"},
              "teaches": c.get("objectifs", [])[:6],
              "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "online", "courseWorkload": "PT3H"},
              "offers": {"@type": "Offer", "price": 0, "priceCurrency": "XOF", "category": "Free"}}
        page(f"/cours/{cid}/", f"Cours : {c['titre']}", c.get("resume") or c.get("accroche") or c["titre"], "".join(parts),
             [("Cours", "/cours/")], ld, f"#cours-{cid}", d10(c.get("maj_densification")), "0.8",
             image=f"{BASE}/media/{cid}_cover.jpg" if os.path.exists(os.path.join(ROOT, "media", cid + "_cover.jpg")) else None)


def build_savoirs():
    F, A, G, CAS, PAR, Q = (C.get(k, []) for k in ("fiches", "articles", "glossaire", "etudes_cas", "parcours", "quiz"))
    body = ['<p class="kick">Savoirs &amp; apprentissage</p><h1>Fiches de cours, articles, glossaire et études de cas</h1>',
            paras(((C.get("seo") or {}).get("savoirs") or {}).get("texte_intro") or "Ressources pédagogiques de sociologie économique appliquées à la Côte d'Ivoire.")]
    body.append("<h2>Fiches pédagogiques</h2><div class=\"grid\">" + "".join(card(f["titre"], f"/savoirs/{slug(f['id'])}/", f.get("resume"), e(NIVEAUX.get(f.get("niveau"), f.get("niveau", "")))) for f in F) + "</div>")
    body.append("<h2>Articles de fond</h2><div class=\"grid\">" + "".join(card(a["titre"], f"/articles/{slug(a['titre'])}/", a.get("chapo"), e(a.get("theme", ""))) for a in A) + "</div>")
    body.append("<h2>Études de cas ivoiriennes</h2><div class=\"grid\">" + "".join(card(c["titre"], f"/etudes-de-cas/{slug(c['titre'])}/", c.get("contexte"), e(c.get("lieu", ""))) for c in CAS) + "</div>")
    body.append(f'<h2>Glossaire</h2><p><a href="/glossaire/">{len(G)} concepts clés de la sociologie économique</a> : définition, auteurs de référence et exemple ivoirien.</p>')
    if PAR:
        body.append("<h2>Parcours d'apprentissage</h2><ul>" + "".join(f"<li><b>{e(p['titre'])}</b> — {e(p.get('public', ''))} ({e(p.get('duree', ''))})</li>" for p in PAR) + '</ul><p><a href="/formations/">Voir les formations certifiantes gratuites →</a></p>')
    if Q:
        body.append("<h2>Quiz</h2><ul>" + "".join(f"<li>{e(q['titre'])} ({len(q.get('questions', []))} questions)</li>" for q in Q) + "</ul>")
    page("/savoirs/", "Savoirs : fiches, articles, glossaire et études de cas", "Fiches de cours, articles de fond, études de cas ivoiriennes, glossaire et quiz de sociologie économique, en accès libre.",
         "".join(body), [("Savoirs", None)], None, "#savoirs", prio="0.8", ogtype="website")
    for f in F:
        b = [f'<p class="kick">Fiche · {e(NIVEAUX.get(f.get("niveau"), f.get("niveau", "")))} · {e(f.get("discipline", ""))} · {e(f.get("duree_min", ""))} min</p><h1>{e(f["titre"])}</h1>', f'<p class="lead">{e(f.get("resume", ""))}</p>']
        for s in f.get("sections", []):
            b.append(f"<h2>{e(s.get('titre'))}</h2>{paras(s.get('texte'))}")
        if f.get("points_cles"):
            b.append("<h2>Points clés</h2>" + ul(f["points_cles"]))
        if f.get("pour_aller_plus_loin"):
            b.append("<h2>Pour aller plus loin</h2>" + render_any(f["pour_aller_plus_loin"]))
        page(f"/savoirs/{slug(f['id'])}/", f["titre"], f.get("resume") or f["titre"], "".join(b), [("Savoirs", "/savoirs/")],
             {"@type": "LearningResource", "name": f["titre"], "inLanguage": "fr", "learningResourceType": "fiche de cours",
              "educationalLevel": NIVEAUX.get(f.get("niveau"), ""), "isAccessibleForFree": True, "author": {"@id": BASE + "/#auteur"}},
             f"#fiche-{slug(f['id'])}", prio="0.7")
    for a in A:
        b = [f'<p class="kick">{e(a.get("type", "Article"))} · {e(a.get("theme", ""))}</p><h1>{e(a["titre"])}</h1>',
             f'<p class="meta">{e(a.get("region", ""))} · {e(a.get("date", ""))} · lecture {e(a.get("temps_lecture", ""))}</p>',
             f'<p class="lead">{e(a.get("chapo", ""))}</p>', paras(a.get("corps"))]
        if a.get("sources"):
            b.append("<h2>Sources</h2>" + render_any(a["sources"]))
        if a.get("mots_cles"):
            b.append("<p>" + "".join(f'<span class="chip">{e(k)}</span>' for k in a["mots_cles"]) + "</p>")
        if a.get("appel_contribution"):
            b.append(f"<h2>Contribuer</h2><p>{e(a['appel_contribution'])}</p>")
        page(f"/articles/{slug(a['titre'])}/", a["titre"], a.get("chapo") or a["titre"], "".join(b), [("Savoirs", "/savoirs/"), ("Articles", "/articles/")],
             {"@type": "Article", "headline": clip(a["titre"], 110), "description": clip(a.get("chapo"), 300), "inLanguage": "fr",
              "datePublished": d10(a.get("date")), "author": {"@type": "Organization", "name": "Rédaction " + SHORT},
              "publisher": {"@type": "Organization", "name": SITE, "logo": {"@type": "ImageObject", "url": BASE + "/img/icon-512.png"}},
              "keywords": ", ".join(a.get("mots_cles", [])), "image": BASE + "/img/og-image.jpg", "mainEntityOfPage": f"{BASE}/articles/{slug(a['titre'])}/"},
             f"#article-{slug(a['id'])}", d10(a.get("date")), "0.8")
    for c in CAS:
        b = [f'<p class="kick">Étude de cas · {e(c.get("lieu", ""))}</p><h1>{e(c["titre"])}</h1>']
        for k, lab in [("contexte", "Contexte"), ("acteurs", "Acteurs"), ("enjeux", "Enjeux"), ("analyse", "Analyse")]:
            if c.get(k):
                b.append(f"<h2>{lab}</h2>" + (paras(c[k]) if isinstance(c[k], (str, list)) and not (isinstance(c[k], list) and c[k] and isinstance(c[k][0], dict)) else render_any(c[k])))
        if c.get("questions"):
            b.append("<h2>Questions d'analyse</h2>" + render_any(c["questions"]))
        for k in c:
            if k not in ("id", "titre", "lieu", "contexte", "acteurs", "enjeux", "analyse", "questions", "sources") and c[k]:
                b.append(f"<h2>{e(k.replace('_', ' ').capitalize())}</h2>" + render_any(c[k]))
        if c.get("sources"):
            b.append("<h2>Sources</h2>" + render_any(c["sources"]))
        page(f"/etudes-de-cas/{slug(c['titre'])}/", f"Étude de cas : {c['titre']}", c.get("contexte") or c["titre"], "".join(b),
             [("Savoirs", "/savoirs/"), ("Études de cas", "/etudes-de-cas/")], {"@type": "LearningResource", "name": c["titre"], "learningResourceType": "étude de cas", "inLanguage": "fr", "isAccessibleForFree": True},
             f"#cas-{slug(c['id'])}", prio="0.7")
    page("/articles/", "Articles de fond sur l'économie ivoirienne", "Articles de fond de sociologie économique sur l'économie ivoirienne : informel à Abidjan, marchés, travail des jeunes, cacao, transport, numérique, genre, dette.",
         '<p class="kick">Articles de fond</p><h1>Articles de fond sur l\'économie ivoirienne</h1><div class="grid">' + "".join(card(a["titre"], f"/articles/{slug(a['titre'])}/", a.get("chapo"), e(a.get("theme", ""))) for a in A) + "</div>",
         [("Savoirs", "/savoirs/"), ("Articles", None)], None, "#savoirs", prio="0.8", ogtype="website")
    page("/etudes-de-cas/", "Études de cas ivoiriennes en sociologie économique", "Études de cas pédagogiques ivoiriennes : transport artisanal, marchés, coopératives, mobile money, avec questions d'analyse et sources.",
         '<p class="kick">Études de cas</p><h1>Études de cas ivoiriennes</h1><div class="grid">' + "".join(card(c["titre"], f"/etudes-de-cas/{slug(c['titre'])}/", c.get("contexte"), e(c.get("lieu", ""))) for c in CAS) + "</div>",
         [("Savoirs", "/savoirs/"), ("Études de cas", None)], None, "#savoirs-cas", prio="0.7", ogtype="website")
    # glossaire
    terms = sorted(G, key=lambda t: slug(t.get("terme", "")))
    b = ['<p class="kick">Glossaire interactif</p><h1>Glossaire de la sociologie économique</h1>',
         f'<p class="lead">{len(terms)} concepts définis rigoureusement, avec leurs auteurs de référence et un exemple tiré de la vie économique ivoirienne.</p>',
         "<p>" + " · ".join(f'<a href="#{slug(t["terme"])}">{e(t["terme"])}</a>' for t in terms) + "</p>"]
    for t in terms:
        b.append(f'<h2 id="{slug(t["terme"])}">{e(t["terme"])}</h2><p>{e(t.get("definition"))}</p>' +
                 (f"<p><b>Auteurs :</b> {e(t['auteurs'])}</p>" if t.get("auteurs") else "") +
                 (f"<p><b>Exemple ivoirien :</b> {e(t['exemple_ci'])}</p>" if t.get("exemple_ci") else "") +
                 (f"<p class=\"meta\">Voir aussi : {e(', '.join(t['voir_aussi']))}</p>" if t.get("voir_aussi") else ""))
    page("/glossaire/", "Glossaire de la sociologie économique : capital social, informalité, encastrement…",
         "Définitions des concepts clés de la sociologie économique (capital social, informalité, encastrement, précarité, rente, clientélisme, inclusion financière…) avec auteurs et exemples ivoiriens.",
         "".join(b), [("Savoirs", "/savoirs/"), ("Glossaire", None)],
         {"@type": "DefinedTermSet", "name": "Glossaire de la sociologie économique", "inLanguage": "fr",
          "hasDefinedTerm": [{"@type": "DefinedTerm", "name": t["terme"], "description": clip(t.get("definition"), 300), "url": f"{BASE}/glossaire/#{slug(t['terme'])}"} for t in terms]},
         "#savoirs-glossaire", prio="0.8")


def build_formations():
    P = FORM.get("parcours", [])
    if not P:
        return
    b = ['<p class="kick">Formations certifiantes gratuites</p><h1>Formations en ligne gratuites en sociologie économique</h1>',
         f'<p class="lead">Parcours de formation libres et gratuits, avec quiz par module, examen final et attestation de suivi et de réussite vérifiable en ligne (seuil de réussite : {e(FORM.get("seuil", 80))} %).</p>']
    for p in P:
        b.append(f'<h2 id="{e(p["id"])}">{e(p["titre"])}</h2><p class="meta">Niveau {e(NIVEAUX.get(p.get("niveau"), p.get("niveau", "")))} · {e(p.get("heures", ""))} h · {e("ouvert à la certification" if p.get("statut") == "ouvert" else "en préparation")} · badge « {e(p.get("badge", ""))} »</p>'
                 f'<p>{e(p.get("description", ""))}</p><p><b>Public :</b> {e(p.get("public", ""))}</p><ol>' +
                 "".join(f"<li><b>{e(m.get('titre'))}</b>" + (f" — {e('; '.join(m.get('objectifs', [])))}" if m.get("objectifs") else "") + "</li>" for m in p.get("modules", [])) +
                 f'</ol><p><a class="btn s" href="/#formation-{e(p["id"])}">Suivre ce parcours</a></p>')
    page("/formations/", "Formations certifiantes gratuites en sociologie économique", "Parcours de formation en ligne gratuits avec quiz, examen et attestation vérifiable : comprendre l'informel, lire les inégalités, entrepreneuriat et réseaux, politiques publiques, méthodes d'enquête de terrain.",
         "".join(b), [("Formations", None)],
         [{"@type": "Course", "name": p["titre"], "description": clip(p.get("description"), 300), "inLanguage": "fr", "isAccessibleForFree": True,
           "provider": {"@type": "Organization", "name": SITE, "url": BASE + "/"}, "url": f"{BASE}/formations/#{p['id']}",
           "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "online", "courseWorkload": f"PT{p.get('heures', 6)}H"},
           "offers": {"@type": "Offer", "price": 0, "priceCurrency": "XOF", "category": "Free"}} for p in P],
         "#formations", d10(FORM.get("maj")), "0.8", ogtype="website")


def art_line(a):
    au = ", ".join(a.get("auteurs", [])) if isinstance(a.get("auteurs"), list) else a.get("auteurs", "")
    doi = a.get("doi")
    links = []
    if a.get("url"):
        links.append(f'<a href="{e(a["url"])}" rel="noopener">page de l\'article</a>')
    if a.get("pdf"):
        links.append(f'<a href="{e(a["pdf"])}" rel="noopener">PDF en libre accès</a>')
    if doi and not str(doi).startswith("hal"):
        links.append(f'<a href="https://doi.org/{e(doi)}" rel="noopener">DOI {e(doi)}</a>')
    return (f'<div class="card"><h3>{e(a.get("titre"))}</h3><p class="meta">{e(au)} ({e(a.get("annee", ""))}), <i>{e(a.get("revue", ""))}</i>'
            f'{" · " + e(a.get("region")) if a.get("region") else ""}</p><p>{e(a.get("resume", ""))}</p><p>{" · ".join(links)}</p></div>')


def build_recherche():
    A = REC.get("articles", [])
    if not A:
        return
    themes = {}
    for a in A:
        themes.setdefault(a.get("theme") or "autres", []).append(a)
    order = sorted(themes, key=lambda t: -len(themes[t]))
    b = ['<p class="kick">Recherche en libre accès</p><h1>Articles scientifiques en libre accès sur les économies ouest-africaines</h1>',
         f'<p class="lead">{len(A)} articles réels publiés dans des revues nationales et internationales, en libre accès, avec résumé en français, DOI et lien direct vers le texte intégral. Catalogue mis à jour le {e(REC.get("maj", ""))}.</p>',
         "<h2>Par thème</h2><ul>" + "".join(f'<li><a href="/recherche/{t}/">{e(THEMES.get(t, t.capitalize()))}</a> ({len(themes[t])} articles)</li>' for t in order) + "</ul>",
         "<h2>Ajouts récents</h2>" + "".join(art_line(a) for a in sorted(A, key=lambda x: -(x.get("annee") or 0))[:12])]
    if REC.get("methode"):
        b.append("<h2>Méthode</h2>" + paras(REC["methode"]))
    page("/recherche/", "Recherche en libre accès : articles de sociologie économique sur l'Afrique de l'Ouest",
         f"{len(A)} articles scientifiques en libre accès sur l'économie informelle, le travail, l'agriculture, le genre, la finance et le développement en Côte d'Ivoire et en Afrique de l'Ouest.",
         "".join(b), [("Recherche", None)], None, "#recherche", d10(REC.get("maj")), "0.9", ogtype="website")
    for t in order:
        L = sorted(themes[t], key=lambda x: -(x.get("annee") or 0))
        lab = THEMES.get(t, t.capitalize())
        page(f"/recherche/{t}/", f"{lab} : articles scientifiques en libre accès",
             f"{len(L)} articles scientifiques en libre accès sur le thème « {lab} » (Côte d'Ivoire, Afrique de l'Ouest), avec résumés en français et liens vers les textes intégraux.",
             f'<p class="kick">Recherche · {e(lab)}</p><h1>{e(lab)} : articles en libre accès</h1>' + "".join(art_line(a) for a in L),
             [("Recherche", "/recherche/"), (lab, None)],
             {"@type": "ItemList", "name": f"Articles en libre accès : {lab}", "itemListElement": [
                 {"@type": "ListItem", "position": i + 1, "item": {"@type": "ScholarlyArticle", "headline": clip(a.get("titre"), 110),
                  "author": [{"@type": "Person", "name": n} for n in (a.get("auteurs") or [])[:6]] if isinstance(a.get("auteurs"), list) else a.get("auteurs"),
                  "datePublished": str(a.get("annee", "")), "isPartOf": a.get("revue"), "url": a.get("url"), "isAccessibleForFree": True}}
                 for i, a in enumerate(L)]},
             f"#recherche-{t}", d10(REC.get("maj")), "0.7")


def build_auteur():
    if not AUT:
        return
    a = AUT
    b = [f'<p class="kick">Le chercheur</p><h1>Dr Fabrice TANOH, sociologue de l\'économie</h1>',
         '<img src="/img/thumbs/portrait-carre.jpg" alt="Portrait de Dr Fabrice TANOH" width="220" height="220" style="float:right;border-radius:50%;margin:0 0 12px 18px;max-width:40%">',
         f'<p class="lead">{e(a.get("titre", ""))}</p><p>{e(a.get("accroche", ""))}</p>', paras(a.get("bio_longue") or a.get("bio_courte"))]
    if a.get("poste"):
        b.append(f'<p><b>Poste actuel :</b> {e(a["poste"])}.</p>')
    b.append("<p><b>Liens institutionnels :</b> " + " · ".join(f'<a href="{u}" rel="noopener">{e(n)}</a>' for n, u in INSTIT) + "</p>")
    if a.get("domaines"):
        b.append("<h2>Domaines d'expertise</h2><p>" + "".join(f'<span class="chip">{e(d)}</span>' for d in a["domaines"]) + "</p>")
    if a.get("formation"):
        b.append("<h2>Formation</h2><ul>" + "".join(f"<li><b>{e(f.get('annee'))}</b> — {e(f.get('diplome'))}, {e(f.get('etablissement'))}. {e(f.get('detail', ''))}</li>" for f in a["formation"]) + "</ul>")
    if a.get("experiences"):
        b.append("<h2>Parcours professionnel</h2><ul>" + "".join(f"<li><b>{e(x.get('periode'))}</b> — {e(x.get('role'))}, {e(x.get('structure'))}. {e(x.get('detail', ''))}</li>" for x in a["experiences"]) + "</ul>")
    if a.get("projets"):
        b.append("<h2>Projets de recherche</h2><ul>" + "".join(f"<li><b>{e(p.get('titre'))}</b> ({e(p.get('periode'))}, {e(p.get('role', ''))}) — {e(p.get('detail', ''))}</li>" for p in a["projets"]) + "</ul>")
    b.append(f'<h2>Publications</h2><p>{len(a.get("publications", []))} publications scientifiques (articles, chapitres, thèse, prépublications) : <a href="/publications/">voir la liste complète avec résumés</a>.</p>')
    if a.get("communications"):
        b.append("<h2>Communications</h2><ul>" + "".join(f"<li><b>{e(c.get('annee'))}</b> — {e(c.get('titre'))}{', ' + e(c.get('evenement')) if c.get('evenement') else ''}{' (' + e(c.get('lieu')) + ')' if c.get('lieu') else ''}</li>" for c in a["communications"]) + "</ul>")
    m = a.get("metriques") or {}
    if m.get("citations") is not None:
        b.append(f"<p class=\"meta\">Indicateurs : {e(m.get('citations'))} citations, indice h {e(m.get('h_index'))} (source : {e(m.get('source', ''))}, {e(m.get('date', ''))}).</p>")
    if a.get("profils"):
        b.append("<h2>Profils scientifiques</h2><ul>" + "".join(f'<li><a href="{e(p["url"])}" rel="noopener me">{e(p["nom"])}</a></li>' for p in a["profils"]) + "</ul>")
    page("/dr-fabrice-tanoh/", "Dr Fabrice TANOH, sociologue de l'économie (Université Peleforo Gon Coulibaly)",
         a.get("bio_courte") or "Dr Fabrice TANOH, Maître-assistant en sociologie économique à l'Université Peleforo Gon Coulibaly de Korhogo.",
         "".join(b), [("Le chercheur", None)], [dict(person_ld(), **{"@type": "Person"}),
                                                 {"@type": "ProfilePage", "mainEntity": {"@id": BASE + "/#auteur"}, "url": BASE + "/dr-fabrice-tanoh/", "dateModified": d10(a.get("maj"))}],
         "#auteur", d10(a.get("maj")), "1.0", ogtype="profile", image=BASE + "/img/portrait-carre.jpg")
    P = sorted(a.get("publications", []), key=lambda p: -(p.get("annee") or 0))
    b = ['<p class="kick">Publications</p><h1>Publications scientifiques de Dr Fabrice TANOH</h1>',
         f'<p class="lead">{len(P)} travaux : épargne et consommation des ménages producteurs de cacao, précarité, éducation, littératie et travail des enfants en milieu rural ivoirien.</p>']
    ld = []
    for p in P:
        links = []
        if p.get("url_libre"):
            links.append(f'<a href="{e(p["url_libre"])}" rel="noopener">texte en libre accès</a>')
        if p.get("url"):
            links.append(f'<a href="{e(p["url"])}" rel="noopener">page de l\'éditeur</a>')
        if p.get("doi"):
            links.append(f'<a href="https://doi.org/{e(p["doi"])}" rel="noopener">DOI {e(p["doi"])}</a>')
        b.append(f'<div class="card" id="{e(p.get("id", ""))}"><h3>{e(p.get("titre"))}</h3><p class="meta">{e(p.get("auteurs", ""))} ({e(p.get("annee", ""))}). <i>{e(p.get("revue", ""))}</i>'
                 f'{", " + e(p.get("volume")) if p.get("volume") else ""}{", " + e(p.get("pages")) if p.get("pages") else ""} · {e(p.get("type", ""))}</p>'
                 f'{"<p>" + e(p.get("resume")) + "</p>" if p.get("resume") else ""}<p>{" · ".join(links)}</p></div>')
        ld.append({"@type": "ScholarlyArticle", "headline": clip(p.get("titre"), 110), "datePublished": str(p.get("annee", "")),
                   "author": [{"@type": "Person", "name": n.strip()} for n in re.split(r",| et | and ", str(p.get("auteurs", ""))) if n.strip()][:8],
                   "isPartOf": p.get("revue"), "inLanguage": p.get("langue") or "fr",
                   **({"sameAs": "https://doi.org/" + p["doi"]} if p.get("doi") else {})})
    page("/publications/", "Publications de Dr Fabrice TANOH : épargne, cacao, précarité, éducation",
         "Liste complète des publications scientifiques de Dr Fabrice TANOH, sociologue de l'économie : articles, chapitres et thèse, avec résumés, DOI et liens en libre accès.",
         "".join(b), [("Le chercheur", "/dr-fabrice-tanoh/"), ("Publications", None)], ld, "#publications", d10(a.get("maj")), "0.9")


def build_podcast():
    E = sorted(POD.get("episodes", []), key=lambda x: -(x.get("numero") or 0))
    if not E:
        return
    b = [f'<p class="kick">Podcast</p><h1>{e(POD.get("titre", "Socio-Éco, le podcast"))}</h1>', f'<p class="lead">{e(POD.get("sous_titre", ""))}</p>',
         paras(POD.get("presentation")), f'<p class="meta">{e(POD.get("voix", ""))}</p>', '<p><a href="/podcast.xml">Flux RSS du podcast</a></p>',
         "<h2>Épisodes</h2><div class=\"grid\">" + "".join(card(f"Épisode {x.get('numero')} : {x['titre']}", f"/podcast/{x['id']}/", x.get("resume"), e(THEMES.get(x.get("theme"), ""))) for x in E) + "</div>"]
    INV = POD.get("invitations", [])
    if INV:
        b.append("<h2>Entretiens et émissions invitées</h2>" + "".join(
            f'<div class="card"><h3>{e(i.get("titre"))}</h3><p class="meta">{e(i.get("emission", ""))} — {e(i.get("producteur", ""))}, {e(i.get("date", ""))}</p><p>{e(i.get("resume", ""))}</p>'
            + (f'<p><a href="{e(i.get("page") or i.get("source"))}" rel="noopener">Écouter</a></p>' if (i.get("page") or i.get("source")) else "") + "</div>" for i in INV))
    page("/podcast/", "Socio-Éco, le podcast de sociologie économique de la Côte d'Ivoire", POD.get("presentation") or POD.get("sous_titre") or "Podcast",
         "".join(b), [("Podcast", None)], {"@type": "PodcastSeries", "name": POD.get("titre"), "url": BASE + "/podcast/", "webFeed": BASE + "/podcast.xml", "inLanguage": "fr",
                                           "author": {"@id": BASE + "/#auteur"}, "image": BASE + "/img/podcast-cover.jpg"},
         "#podcast", d10(POD.get("maj")), "0.8", ogtype="website", image=BASE + "/img/podcast-cover.jpg")
    for x in E:
        dl = "".join(f"<p><b>{e(r[0])} :</b> {e(r[1])}</p>" for r in x.get("dialogue", []) if isinstance(r, list) and len(r) >= 2)
        links = "".join(f'<li><a href="{("/" + l["url"]) if str(l.get("url", "")).startswith("#") else e(l.get("url"))}">{e(l.get("titre"))}</a></li>' for l in x.get("liens", []))
        b = [f'<p class="kick">Socio-Éco · épisode {e(x.get("numero"))} · {e(THEMES.get(x.get("theme"), ""))}</p><h1>{e(x["titre"])}</h1>',
             f'<p class="lead">{e(x.get("resume", ""))}</p>']
        if x.get("audio"):
            b.append(f'<audio controls preload="none" src="/{e(x["audio"])}" style="width:100%"></audio><p class="meta">Durée : {int(x.get("duree_s") or 0) // 60} min {int(x.get("duree_s") or 0) % 60:02d} s · publié le {e(x.get("date", ""))}</p>')
        b.append(f"<h2>Transcription</h2><div class=\"dlg\">{dl}</div>")
        if x.get("sources"):
            b.append("<h2>Sources</h2>" + ul(x["sources"]))
        if links:
            b.append(f"<h2>Pour aller plus loin sur le blog</h2><ul>{links}</ul>")
        page(f"/podcast/{x['id']}/", f"{x['titre']} (podcast Socio-Éco, épisode {x.get('numero')})", x.get("resume") or x["titre"], "".join(b),
             [("Podcast", "/podcast/")], {"@type": "PodcastEpisode", "name": x["titre"], "episodeNumber": x.get("numero"), "datePublished": d10(x.get("date")),
                                          "description": clip(x.get("resume"), 300), "inLanguage": "fr", "url": f"{BASE}/podcast/{x['id']}/",
                                          "partOfSeries": {"@type": "PodcastSeries", "name": POD.get("titre"), "url": BASE + "/podcast/"},
                                          "associatedMedia": {"@type": "MediaObject", "contentUrl": BASE + "/" + x.get("audio", ""), "encodingFormat": "audio/mpeg",
                                                              "duration": f"PT{int(x.get('duree_s') or 0)}S"}},
             f"#podcast-{x['id']}", d10(x.get("date")), "0.7", image=BASE + "/img/podcast-cover.jpg")


def build_observatoire():
    S = OBS.get("series", [])
    b = ['<p class="kick">Données &amp; observatoire</p><h1>Observatoire de l\'économie ivoirienne : données ouvertes et sourcées</h1>',
         '<p class="lead">Séries statistiques sur la croissance, l\'emploi, l\'informel, les prix, l\'agriculture, l\'éducation et la pauvreté, avec source, méthodologie et date de mise à jour.</p>']
    IND = ACT.get("indicateurs", [])
    if IND:
        b.append("<h2>Indicateurs clés</h2><div class=\"tw\"><table><thead><tr><th>Indicateur</th><th>Valeur</th><th>Période</th><th>Source</th></tr></thead><tbody>" +
                 "".join(f'<tr><td>{e(i.get("label"))}</td><td>{e(i.get("valeur"))}</td><td>{e(i.get("periode"))}</td><td><a href="{e(i.get("url"))}" rel="noopener">{e(i.get("source"))}</a></td></tr>' for i in IND) + "</tbody></table></div>")
    for s in S:
        pts = s.get("points", [])
        b.append(f'<h2>{e(s.get("titre"))}</h2><p>{e(s.get("methodologie", ""))}</p>' +
                 ("<div class=\"tw\"><table><thead><tr><th>Année</th><th>Valeur (" + e(s.get("unite", "")) + ")</th></tr></thead><tbody>" +
                  "".join(f'<tr><td>{e(p.get("annee"))}</td><td>{e(p.get("valeur"))}</td></tr>' for p in pts) + "</tbody></table></div>" if pts else "") +
                 f'<p class="src">Source : <a href="{e(s.get("url"))}" rel="noopener">{e(s.get("source"))}</a></p>' + (f"<p class=\"meta\">{e(s.get('note'))}</p>" if s.get("note") else ""))
    D = OBS.get("districts") or {}
    if D.get("valeurs"):
        b.append(f'<h2>{e(D.get("indicateur", "Par district"))} par district</h2><div class="tw"><table><tbody>' +
                 "".join(f"<tr><th scope=\"row\">{e(k)}</th><td>{e(f'{v:,}'.replace(',', ' ') if isinstance(v, int) else v)}</td></tr>" for k, v in D["valeurs"].items()) +
                 f'</tbody></table></div><p class="src">Source : <a href="{e(D.get("url"))}" rel="noopener">{e(D.get("source"))}</a></p>')
    for ds in OBS.get("data_stories", []):
        b.append(f"<h2>Data story : {e(ds.get('titre'))}</h2>{paras(ds.get('texte'))}")
    page("/observatoire/", "Observatoire : chiffres et données ouvertes sur l'économie ivoirienne",
         "Données ouvertes et sourcées sur l'économie de la Côte d'Ivoire : croissance, emploi informel, inflation, cacao, pauvreté, inclusion financière, population par district.",
         "".join(b), [("Observatoire", None)],
         [{"@type": "Dataset", "name": s.get("titre"), "description": clip(s.get("methodologie") or s.get("titre"), 300), "inLanguage": "fr",
           "spatialCoverage": "Côte d'Ivoire", "creator": {"@type": "Organization", "name": str(s.get("source", "")).split(",")[0]},
           "isBasedOn": s.get("url"), "license": "https://creativecommons.org/licenses/by-nc/4.0/",
           "temporalCoverage": f"{s['points'][0].get('annee')}/{s['points'][-1].get('annee')}" if s.get("points") else None} for s in S],
         "#observatoire", d10(OBS.get("maj")), "0.8", ogtype="website")


def build_actualites():
    I = sorted(ACT.get("items", []), key=lambda x: x.get("date", ""), reverse=True)
    if not I:
        return
    b = ['<p class="kick">Actualités</p><h1>Actualités économiques et sociales de la Côte d\'Ivoire et de l\'Afrique de l\'Ouest</h1>',
         f'<p class="lead">Veille quotidienne : chiffres clés, budgets, prix agricoles, emploi, inclusion financière. Mise à jour : {e(d10(ACT.get("maj")) or "")}.</p>']
    for i in I:
        b.append(f'<div class="card"><p class="meta">{e(i.get("date"))} · {e(i.get("theme", ""))}</p><h3>{e(i.get("titre"))}</h3><p>{e(i.get("texte"))}</p><p class="src">Source : <a href="{e(i.get("url"))}" rel="noopener">{e(i.get("source"))}</a></p></div>')
    page("/actualites/", "Actualités socio-économiques de la Côte d'Ivoire", "Veille quotidienne sur l'économie et la société ivoiriennes et ouest-africaines : budget, inflation, cacao, emploi des jeunes, inclusion financière, foncier.",
         "".join(b), [("Actualités", None)], None, "#accueil", d10(ACT.get("maj")), "0.7", ogtype="website")


def build_bibliotheque():
    if not BIB:
        return
    b = ['<p class="kick">Bibliothèque ouverte</p><h1>Bibliothèque ouverte : archives, revues et guides de recherche documentaire</h1>']
    if BIB.get("archives"):
        b.append("<h2>Archives ouvertes et bases documentaires</h2>" + "".join(f'<div class="card"><h3><a href="{e(a.get("url"))}" rel="noopener">{e(a.get("nom"))}</a></h3><p class="meta">{e(a.get("type", ""))} · {e(a.get("langues", ""))} · {e(a.get("acces", ""))}</p><p>{e(a.get("description", ""))}</p>' + (f"<p><b>Astuce :</b> {e(a.get('astuce'))}</p>" if a.get("astuce") else "") + "</div>" for a in BIB["archives"]))
    if BIB.get("revues"):
        b.append("<h2>Revues de sciences sociales</h2>" + "".join(f'<div class="card"><h3><a href="{e(r.get("url"))}" rel="noopener">{e(r.get("titre"))}</a></h3><p class="meta">{e(r.get("editeur", ""))} · {e(r.get("pays", ""))} · {e(r.get("langue", ""))} · {e(r.get("acces", ""))}</p><p>{e(r.get("description", ""))}</p></div>' for r in BIB["revues"]))
    for g in BIB.get("guides", []):
        b.append(f"<h2>{e(g.get('titre'))}</h2><ol>" + "".join(f"<li>{e(s)}</li>" for s in g.get("etapes", [])) + "</ol>")
    page("/bibliotheque/", "Bibliothèque ouverte : revues et archives en sciences sociales", "Sélection d'archives ouvertes, de revues de sociologie et d'économie et de guides pour trouver des articles scientifiques en libre accès.",
         "".join(b), [("Bibliothèque", None)], None, "#bibliotheque", d10(BIB.get("maj")), "0.6", ogtype="website")


def build_debats():
    D = C.get("debats", [])
    b = ['<p class="kick">Débats scientifiques</p><h1>Débats scientifiques en sociologie économique</h1>',
         "<p class=\"lead\">Un espace d'échange contradictoire entre enseignants, chercheurs et étudiants : interviews thématiques, notes de réflexion, points de vue, comptes rendus de lecture et questions ouvertes, publiés après modération selon la charte.</p>",
         '<p><a class="btn" href="/#debats">Lire les débats publiés et contribuer</a></p>', "<h2>Grandes questions en débat</h2>"]
    for d in D:
        b.append(f"<div class=\"card\"><h3>{e(d.get('question'))}</h3><p><b>Enjeu :</b> {e(d.get('enjeu', ''))}</p><p><b>Position A :</b> {e(d.get('position_a', ''))}</p><p><b>Position B :</b> {e(d.get('position_b', ''))}</p>" +
                 (f"<p class=\"meta\">Lectures : {e(' ; '.join(d.get('lectures', [])))}</p>" if d.get("lectures") else "") + "</div>")
    page("/debats/", "Débats scientifiques : informel, inégalités, développement", "Espace de débats scientifiques entre enseignants, chercheurs et étudiants en sociologie économique : grandes controverses ivoiriennes et contributions publiées après modération.",
         "".join(b), [("Débats", None)], None, "#debats", prio="0.7", ogtype="website")


def build_apropos():
    b = ['<p class="kick">À propos</p><h1>À propos du blog SOCIOLOGIE DE L\'ÉCONOMIE</h1>', md(C.get("mission", "")), "<h2>Vision</h2>" + md(C.get("vision", ""))]
    if C.get("valeurs"):
        b.append("<h2>Valeurs</h2>" + ul([v if isinstance(v, str) else f"{v.get('nom')} — {v.get('description', '')}" for v in C["valeurs"]]))
    b.append("<h2>Liens institutionnels</h2><ul>" + "".join(f'<li><a href="{u}" rel="noopener">{e(n)}</a></li>' for n, u in INSTIT) + "</ul>")
    if C.get("faq"):
        b.append("<h2>Questions fréquentes</h2>" + "".join(f"<details><summary>{e(f.get('question'))}</summary><p>{e(f.get('reponse'))}</p></details>" for f in C["faq"]))
    if C.get("transparence"):
        b.append("<h2>Transparence</h2>" + md(C["transparence"]))
    b.append('<p><a href="/chartes/">Chartes éditoriale et de modération →</a></p>')
    page("/a-propos/", "À propos : mission, valeurs, transparence", C.get("mission") or "À propos du blog", "".join(b), [("À propos", None)],
         {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": f.get("question"), "acceptedAnswer": {"@type": "Answer", "text": f.get("reponse")}} for f in C.get("faq", [])]} if C.get("faq") else None,
         "#a-propos", prio="0.5", ogtype="website")
    b = ['<p class="kick">Gouvernance</p><h1>Chartes éditoriale et de modération</h1>', md(C.get("charte_editoriale", "")), md(C.get("charte_moderation", ""))]
    if C.get("politique_publicite"):
        b.append("<h2>Politique publicitaire</h2>" + md(C["politique_publicite"]))
    page("/chartes/", "Charte éditoriale et charte de modération", "Charte éditoriale et scientifique, charte de modération et politique publicitaire du blog SOCIOLOGIE DE L'ÉCONOMIE.",
         "".join(b), [("À propos", "/a-propos/"), ("Chartes", None)], None, "#chartes", prio="0.4", ogtype="website")


def build_plan():
    groups = {}
    for p, _, _ in URLS:
        top = p.strip("/").split("/")[0] or "accueil"
        groups.setdefault(top, []).append(p)
    titles = {}
    for p, _, _ in URLS:
        f = os.path.join(ROOT, p.strip("/"), "index.html")
        m = re.search(r"<h1>(.*?)</h1>", open(f, encoding="utf-8").read(), re.S)
        titles[p] = html.unescape(re.sub("<[^>]+>", "", m.group(1))) if m else p
    b = ['<h1>Plan du site</h1>', '<p><a href="/">Accueil du blog interactif</a></p>']
    for g in sorted(groups, key=lambda k: GENERATED_DIRS.index(k) if k in GENERATED_DIRS else 99):
        b.append(f"<h2>{e(g.replace('-', ' ').capitalize())}</h2><ul>" + "".join(f'<li><a href="{p}">{e(titles[p])}</a></li>' for p in sorted(groups[g])) + "</ul>")
    page("/plan-du-site/", "Plan du site", "Plan complet du blog SOCIOLOGIE DE L'ÉCONOMIE : cours, fiches, articles, études de cas, recherche, publications, podcast, observatoire.",
         "".join(b), [("Plan du site", None)], None, None, prio="0.3", ogtype="website")


def home_block():
    """Bloc statique de la page d'accueil (visible sans JavaScript, remplacé par l'application)."""
    intro = ((C.get("seo") or {}).get("accueil") or {}).get("texte_intro", "")
    L = [f'<div class="wrap" style="padding:40px 20px" id="seo-static">',
         "<h1>SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH</h1>",
         "<p><b>Comprendre l'économie ivoirienne par le prisme du social.</b> " + e(intro) + "</p>",
         '<p>Blog scientifique de <a href="/dr-fabrice-tanoh/">Dr Fabrice TANOH</a>, Maître-assistant en sociologie économique à l\'<a href="https://www.univ-pgc.edu.ci/" rel="noopener">Université Peleforo Gon Coulibaly</a> (Korhogo).</p>',
         "<h2>Cours gratuits de sociologie économique</h2><ul>" + "".join(f'<li><a href="/cours/{c["id"]}/">{e(c["titre"])}</a> ({e(course_level(c).lower())})</li>' for c in COURSES) + "</ul>",
         '<h2>Explorer</h2><ul><li><a href="/savoirs/">Fiches, articles de fond et études de cas</a></li><li><a href="/glossaire/">Glossaire de la sociologie économique</a></li>'
         '<li><a href="/formations/">Formations certifiantes gratuites</a></li><li><a href="/recherche/">Articles scientifiques en libre accès</a></li>'
         '<li><a href="/publications/">Publications de Dr Fabrice TANOH</a></li><li><a href="/podcast/">Podcast Socio-Éco</a></li>'
         '<li><a href="/observatoire/">Observatoire : données sur l\'économie ivoirienne</a></li><li><a href="/actualites/">Actualités socio-économiques</a></li>'
         '<li><a href="/debats/">Débats scientifiques</a></li><li><a href="/bibliotheque/">Bibliothèque ouverte</a></li><li><a href="/plan-du-site/">Plan du site</a></li></ul>',
         '<p style="color:#6B7280">Chargement de la version interactive…</p></div>']
    return "".join(L)


def patch_index():
    p = os.path.join(ROOT, "index.html")
    s = open(p, encoding="utf-8").read()
    s2 = re.sub(r'(<main id="main"[^>]*>)(.*?)(</main>)', lambda m: m.group(1) + home_block() + m.group(3), s, count=1, flags=re.S)
    head = "<!--SEO-->"
    s2 = re.sub(r"<!--SEO-->.*?<!--/SEO-->\n?", "", s2, flags=re.S)
    extra = ""
    if 'rel="canonical"' not in s2:
        extra += f'<link rel="canonical" href="{BASE}/">\n'
    if CFG.get("google_site_verification"):
        extra += f'<meta name="google-site-verification" content="{e(CFG["google_site_verification"])}">\n'
    if CFG.get("bing_site_verification"):
        extra += f'<meta name="msvalidate.01" content="{e(CFG["bing_site_verification"])}">\n'
    extra += '<link rel="sitemap" type="application/xml" href="/sitemap.xml">\n'
    s2 = s2.replace("</head>", f"{head}\n{extra}<!--/SEO-->\n</head>", 1)
    if s2 != s:
        open(p, "w", encoding="utf-8").write(s2)


def write_static():
    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    open(os.path.join(ROOT, "assets", "seo.css"), "w", encoding="utf-8").write(CSS)
    urls = [("/", SITE_MAJ, "1.0")] + URLS
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, lm, pr in urls:
        sm.append(f"  <url><loc>{BASE}{path}</loc><lastmod>{lm}</lastmod><priority>{pr}</priority></url>")
    sm.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(sm) + "\n")
    open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8").write(
        "User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: " + BASE + "/sitemap.xml\n")
    key = CFG.get("indexnow_key")
    if key:
        open(os.path.join(ROOT, key + ".txt"), "w", encoding="utf-8").write(key)
    return urls


def main():
    for d in GENERATED_DIRS:
        shutil.rmtree(os.path.join(ROOT, d), ignore_errors=True)
    build_auteur(); build_cours(); build_savoirs(); build_formations(); build_recherche(); build_podcast()
    build_observatoire(); build_actualites(); build_bibliotheque(); build_debats(); build_apropos(); build_plan()
    urls = write_static()
    patch_index()
    print(f"{len(urls)} URL dans sitemap.xml ({BASE})")


if __name__ == "__main__":
    main()
