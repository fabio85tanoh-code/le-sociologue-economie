# Sociologie de l'Économie

Blog scientifique de Dr Fabrice TANOH, Maître-assistant en sociologie économique.

Site statique (HTML, CSS, JavaScript) publié sur Cloudflare Pages à chaque mise à jour de la branche `main`.
Aucune étape de compilation : le dossier racine est servi tel quel.

- `index.html`, `app.js`, `blog.js`, `styles.css` : l'application
- `data/` : contenus (cours, publications, articles en libre accès, actualités, rapports des agents)
- `img/`, `media/` : photos, vidéos et couvertures
- `outils/` : générateurs des PowerPoint de cours

## Fonctions dynamiques (Cloudflare Pages Functions)

- `functions/api/chat.js` : assistant du blog (Workers AI, modèle Llama 3.3 70B), 60 questions par visiteur et par jour
- `functions/api/contributions.js` : dépôt des contributions et répliques des Débats, modération automatique (charte), stockage D1
- `functions/api/debats.js` : liste publique des débats publiés
- `functions/api/newsletter.js` : inscriptions à la lettre
- `functions/api/admin.js` : décisions sur les textes « à revoir » (en-tête `Authorization: Bearer <ADMIN_TOKEN>`, secret à définir dans Cloudflare)
- `cloud.js` : relie l'interface à ces fonctions hors de claude.ai
- `wrangler.toml` : liaisons `AI` et `DB` (base D1 `lse-db`)
