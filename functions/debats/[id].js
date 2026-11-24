// Lien de partage d'un débat : /debats/<id>
// Page légère avec aperçu (titre, chapô) pour l'e-mail, WhatsApp, LinkedIn ou Facebook,
// puis redirection vers la page du débat dans la plateforme (/#debat-<id>).
import { db } from "../../lib/api.js";

const SITE = "https://le-sociologue-economie.pages.dev";
const BLOG = "SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestGet({ params, env, request }) {
  const id = String(params.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  let d = null;
  try {
    const D = await db(env);
    d = await D.prepare(`SELECT id, type, theme, auteur, statut, institution, titre, chapo, texte, date, repliques FROM debats WHERE id = ? AND status = 'publie'`).bind(id).first();
  } catch {}
  if (!d) return Response.redirect(`${SITE}/debats/`, 302);

  const repondre = new URL(request.url).searchParams.has("repondre");
  const cible = `${SITE}/${repondre ? "?repondre=1" : ""}#debat-${encodeURIComponent(d.id)}`;
  const url = `${SITE}/debats/${encodeURIComponent(d.id)}`;
  const desc = (d.chapo || d.texte || "").replace(/\s+/g, " ").slice(0, 280);
  let nbRep = 0; try { nbRep = JSON.parse(d.repliques || "[]").length; } catch {}
  const paras = String(d.texte || "").split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join("");
  const ld = { "@context": "https://schema.org", "@type": "DiscussionForumPosting", headline: d.titre, text: desc, url, datePublished: d.date, author: { "@type": "Person", name: d.auteur }, commentCount: nbRep, isPartOf: { "@type": "Blog", name: BLOG, url: SITE + "/" } };

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.titre)} | Débats — ${esc(BLOG)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="${esc(BLOG)}">
<meta property="og:title" content="${esc(d.titre)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${SITE}/img/og-image.jpg">
<meta property="og:locale" content="fr_CI"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${esc(cible)}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1f2937}a{color:#0E2A47}</style>
</head><body>
<p><a href="${esc(cible)}">Ouvrir le débat sur le blog et y contribuer →</a></p>
<h1>${esc(d.titre)}</h1>
<p><b>${esc(d.auteur)}</b>${d.statut ? " · " + esc(d.statut) : ""}${d.institution ? " · " + esc(d.institution) : ""}${d.date ? " · " + esc(d.date) : ""}</p>
${d.chapo ? `<p><i>${esc(d.chapo)}</i></p>` : ""}
${paras}
<p><a href="${esc(cible)}">Répondre à ce débat (prolongement, nuance ou contre-argument)</a></p>
<script>location.replace(${JSON.stringify(cible)});</script>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}
