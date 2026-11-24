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

## Diffusion des Débats par e-mail (listes par thème)

- Inscription publique avec double confirmation : formulaire « Recevoir les nouveaux débats par e-mail » sur `#debats` et les pages de débat (affiché seulement quand l'envoi est configuré) ; `functions/api/abonnements/` (inscription, confirmation, désinscription en un clic, en-tête `List-Unsubscribe`).
- Envoi automatique : chaque contribution publiée (modération automatique ou décision de l'éditeur) est envoyée une fois aux abonnés de son thème et aux abonnés « tous les thèmes ».
- Console `#console` (jeton `ADMIN_TOKEN`) : statistiques des abonnés, envoi ou renvoi manuel d'un débat, invitations de contacts à s'inscrire (un seul e-mail de confirmation, aucune relance des personnes désinscrites) — `functions/api/diffusion.js`.
- Configuration (secrets Cloudflare Pages, puis redéploiement) : `MAIL_PROVIDER` (`resend` ou `brevo`), `MAIL_API_KEY`, `MAIL_FROM` (expéditeur vérifié chez le fournisseur, ex. `Blog Sociologie de l'économie <debats@mondomaine.ci>`), `MAIL_REPLY_TO` (facultatif). Code d'envoi : `lib/mail.js`.
