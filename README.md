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
- `functions/debats/[id].js` : lien de partage d'un débat (/debats/<id>, aperçu pour e-mail et réseaux, puis redirection vers le débat ; `?repondre` ouvre le formulaire de réplique). Le bloc « Inviter des participants » (e-mail, Gmail, WhatsApp, LinkedIn, Facebook) est ajouté aux pages de débat par `cloud.js`
- `functions/api/admin.js` : décisions sur les textes « à revoir » (en-tête `Authorization: Bearer <ADMIN_TOKEN>`, secret à définir dans Cloudflare) ; écran de modération intégré à la page `#console` du site public (`cloud.js`), le jeton y est demandé et gardé dans le navigateur
- `cloud.js` : relie l'interface à ces fonctions hors de claude.ai
- `wrangler.toml` : liaisons `AI` et `DB` (base D1 `lse-db`)
