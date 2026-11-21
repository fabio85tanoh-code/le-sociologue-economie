# Référencement (SEO) du blog SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH

Le blog interactif est une application monopage (adresses en `#...`), mal indexée par les moteurs.
`seo/build_seo.py` génère à partir de `data/*.json` une vraie page HTML par contenu :

- `/cours/<id>/`, `/savoirs/<fiche>/`, `/articles/<titre>/`, `/etudes-de-cas/<titre>/`, `/glossaire/`
- `/formations/`, `/recherche/` et `/recherche/<thème>/`, `/publications/`, `/dr-fabrice-tanoh/`
- `/podcast/` et `/podcast/<épisode>/` (transcriptions), `/observatoire/`, `/actualites/`, `/bibliotheque/`
- `/debats/`, `/a-propos/`, `/chartes/`, `/plan-du-site/`
- `sitemap.xml`, `robots.txt`, `assets/seo.css`, le fichier de clé IndexNow, et un bloc statique dans `index.html`

Chaque page a un titre, une description, une URL canonique, des balises Open Graph et des données
structurées schema.org (Course, Article, ScholarlyArticle, PodcastEpisode, Dataset, Person, FAQPage…).

**Régénération automatique** : `.github/workflows/seo.yml` relance le générateur à chaque mise à jour de
`main` (synchronisation quotidienne comprise) et signale les pages modifiées à IndexNow.
À la main : `python3 seo/build_seo.py .` puis `python3 seo/indexnow.py`.

**Réglages** (`seo/config.json`) :
- `base_url` : adresse publique. À remplacer par le nom de domaine `.com` quand il sera acheté et relié au projet Cloudflare Pages.
- `google_site_verification` : code de la balise HTML fourni par Google Search Console (méthode « Balise HTML »).
- `bing_site_verification` : code fourni par Bing Webmaster Tools (facultatif si import depuis Google).

Ne pas modifier à la main les dossiers générés : ils sont effacés et recréés à chaque passage.
