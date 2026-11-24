// Envoi d'e-mails (listes de diffusion des Débats) via Resend ou Brevo.
// Secrets à définir dans Cloudflare Pages (Settings → Variables and secrets) :
//   MAIL_PROVIDER = "resend" ou "brevo"
//   MAIL_API_KEY  = clé d'API du service
//   MAIL_FROM     = expéditeur vérifié, ex. « Blog Sociologie de l'économie <debats@mondomaine.ci> »
//   MAIL_REPLY_TO = (facultatif) adresse de réponse, ex. l'adresse de Dr Tanoh
import { db } from "./api.js";

export const SITE = "https://le-sociologue-economie.pages.dev";
export const BLOG = "SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH";
export const THEMES = { informel: "Économie informelle", travail: "Travail & emploi", marches: "Marchés", agriculture: "Agriculture", entrepreneuriat: "Entrepreneuriat", developpement: "Développement", inegalites: "Inégalités", genre: "Genre", finance: "Finance populaire", environnement: "Environnement", organisations: "Organisations", savoir: "Savoir & éducation", numerique: "Numérique", transport: "Transport", dette: "Dette", migrations: "Migrations", politiques: "Politiques publiques" };

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const isEmail = s => /^[^@\s<>"']{1,64}@[^@\s<>"']+\.[^@\s<>"']{2,}$/.test(s);
export const token = () => [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(16).padStart(2, "0")).join("");

export function mailConfigured(env) {
  return !!(env.MAIL_API_KEY && env.MAIL_FROM && ["resend", "brevo"].includes(String(env.MAIL_PROVIDER || "resend").toLowerCase()));
}

let tablesReady = false;
export async function mdb(env) {
  const D = await db(env);
  if (!tablesReady) {
    await D.batch([
      D.prepare(`CREATE TABLE IF NOT EXISTS abonnes (email TEXT PRIMARY KEY, themes TEXT DEFAULT '[]', themes_attente TEXT, statut TEXT, token TEXT, source TEXT, created INTEGER, confirmed INTEGER)`),
      D.prepare(`CREATE TABLE IF NOT EXISTS envois (id TEXT PRIMARY KEY, debat_id TEXT, nb INTEGER, created INTEGER, mode TEXT)`),
    ]);
    tablesReady = true;
  }
  return D;
}

// messages : [{ to, subject, html, text, unsubscribe }] ; renvoie le nombre d'e-mails acceptés
export async function sendMany(env, messages) {
  if (!mailConfigured(env)) throw new Error("Envoi d'e-mails non configuré (secrets MAIL_PROVIDER, MAIL_API_KEY, MAIL_FROM).");
  if (!messages.length) return 0;
  const provider = String(env.MAIL_PROVIDER || "resend").toLowerCase();
  let sent = 0;
  if (provider === "resend") {
    for (let i = 0; i < messages.length; i += 100) {
      const lot = messages.slice(i, i + 100).map(m => ({
        from: env.MAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text,
        ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}),
        ...(m.unsubscribe ? { headers: { "List-Unsubscribe": `<${m.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      }));
      const r = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { authorization: `Bearer ${env.MAIL_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify(lot) });
      if (!r.ok) throw new Error(`Resend : ${r.status} ${(await r.text()).slice(0, 300)}`);
      sent += lot.length;
    }
  } else {
    const m = /^(.*)<([^>]+)>\s*$/.exec(env.MAIL_FROM);
    const sender = m ? { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() } : { email: env.MAIL_FROM.trim() };
    // Envoi groupé (messageVersions) : une requête pour 500 destinataires au plus, chacun avec son propre lien de désinscription
    for (let i = 0; i < messages.length; i += 500) {
      const lot = messages.slice(i, i + 500); const first = lot[0];
      const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": env.MAIL_API_KEY, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({
        sender, subject: first.subject, htmlContent: first.html, textContent: first.text,
        ...(env.MAIL_REPLY_TO ? { replyTo: { email: env.MAIL_REPLY_TO } } : {}),
        messageVersions: lot.map(m => ({ to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text })),
      }) });
      if (!r.ok) throw new Error(`Brevo : ${r.status} ${(await r.text()).slice(0, 300)}`);
      sent += lot.length;
    }
  }
  return sent;
}

function cadre(titre, corpsHtml, pied) {
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#F3F5F8;font-family:Arial,Helvetica,sans-serif;color:#1F2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0E2A47;color:#ffffff;padding:18px 24px;font-weight:bold;font-size:15px">${esc(BLOG)}</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;line-height:1.3;margin:0 0 14px;color:#0E2A47">${esc(titre)}</h1>${corpsHtml}</td></tr>
<tr><td style="padding:16px 24px;background:#F8FAFC;color:#6B7280;font-size:12px;line-height:1.5">${pied}</td></tr>
</table></td></tr></table></body></html>`;
}
const bouton = (href, txt) => `<p style="margin:22px 0"><a href="${esc(href)}" style="background:#F77F00;color:#0B1420;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;display:inline-block">${esc(txt)}</a></p>`;
const listeThemes = themes => themes.length ? themes.map(t => THEMES[t] || t).join(", ") : "tous les thèmes";

export function mailConfirmation(email, tok, themes, invite) {
  const lien = `${SITE}/api/abonnements/confirmer?t=${tok}`;
  const intro = invite
    ? `<p>Dr Fabrice TANOH vous invite à recevoir par e-mail les nouveaux débats scientifiques du blog sur : <b>${esc(listeThemes(themes))}</b>.</p>`
    : `<p>Vous avez demandé à recevoir par e-mail les nouveaux débats scientifiques du blog sur : <b>${esc(listeThemes(themes))}</b>.</p>`;
  const html = cadre("Confirmez votre inscription aux Débats", `${intro}<p>Pour activer l'envoi, confirmez votre adresse :</p>${bouton(lien, "Je confirme mon inscription")}<p style="font-size:13px;color:#6B7280">Sans confirmation, vous ne recevrez aucun autre message et votre adresse sera effacée.</p>`,
    `Vous recevez ce message unique parce que cette adresse (${esc(email)}) a été proposée pour la liste de diffusion des Débats. Si vous n'êtes pas à l'origine de cette demande, ignorez-le.`);
  const text = `${invite ? "Dr Fabrice TANOH vous invite à recevoir" : "Vous avez demandé à recevoir"} par e-mail les nouveaux débats du blog ${BLOG} (${listeThemes(themes)}).\n\nConfirmez votre inscription : ${lien}\n\nSans confirmation, vous ne recevrez aucun autre message.`;
  return { to: email, subject: "Confirmez votre inscription aux Débats du blog", html, text };
}

export function mailDebat(d, abonne) {
  const lien = `${SITE}/debats/${encodeURIComponent(d.id)}?repondre`;
  const desinscr = `${SITE}/api/abonnements/desinscrire?t=${abonne.token}`;
  const theme = THEMES[d.theme] || d.theme || "";
  const html = cadre(d.titre, `<p style="margin:0 0 6px;color:#C2410C;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em">Nouveau débat${theme ? " · " + esc(theme) : ""}</p>
<p style="margin:0 0 12px;font-size:14px;color:#4B5563">${esc(d.auteur)}${d.statut ? " · " + esc(d.statut) : ""}${d.institution ? " · " + esc(d.institution) : ""}</p>
${d.chapo ? `<p style="font-size:16px;line-height:1.55">${esc(d.chapo)}</p>` : ""}
<p style="font-size:15px;line-height:1.55">Enseignants, chercheurs, étudiants : apportez un prolongement, une nuance ou un contre-argument, idéalement à partir d'un terrain, d'une enquête ou d'une source.</p>
${bouton(lien, "Lire le débat et répondre")}`,
    `Vous recevez cet e-mail car vous êtes inscrit(e) à la liste des Débats (${esc(listeThemes(JSON.parse(abonne.themes || "[]")))}). <a href="${esc(desinscr)}" style="color:#6B7280">Se désinscrire en un clic</a>.`);
  const text = `Nouveau débat${theme ? " (" + theme + ")" : ""} sur le blog ${BLOG}\n\n${d.titre}\n${d.auteur}${d.statut ? " · " + d.statut : ""}\n\n${d.chapo || ""}\n\nLire le débat et répondre : ${lien}\n\nSe désinscrire : ${desinscr}`;
  return { to: abonne.email, subject: `Nouveau débat : ${d.titre}`, html, text, unsubscribe: desinscr };
}

// Abonnés actifs concernés par un thème (abonnés « tous les thèmes » compris)
export async function abonnesDuTheme(D, theme) {
  const { results } = await D.prepare(`SELECT email, themes, token FROM abonnes WHERE statut = 'actif'`).all();
  return results.filter(a => { const t = JSON.parse(a.themes || "[]"); return !t.length || (theme && t.includes(theme)); });
}

// Diffuse un débat publié à ses abonnés (une seule fois par débat, sauf force)
export async function diffuserDebat(env, debatId, { force = false, mode = "auto" } = {}) {
  if (!mailConfigured(env)) return { ok: false, raison: "non_configure" };
  const D = await mdb(env);
  const d = await D.prepare(`SELECT id, type, theme, auteur, statut, institution, titre, chapo, date FROM debats WHERE id = ? AND status = 'publie'`).bind(debatId).first();
  if (!d) return { ok: false, raison: "introuvable" };
  if (!force) { const deja = await D.prepare(`SELECT id FROM envois WHERE debat_id = ?`).bind(debatId).first(); if (deja) return { ok: false, raison: "deja_envoye" }; }
  const abonnes = await abonnesDuTheme(D, d.theme);
  const nb = await sendMany(env, abonnes.map(a => mailDebat(d, a)));
  await D.prepare(`INSERT INTO envois (id, debat_id, nb, created, mode) VALUES (?,?,?,?,?)`).bind(token().slice(0, 20), debatId, nb, Date.now(), mode).run();
  return { ok: true, nb };
}

export function pageHtml(titre, message) {
  return new Response(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titre)} — ${esc(BLOG)}</title><meta name="robots" content="noindex">
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 16px;color:#1F2937}h1{color:#0E2A47}a{color:#0E2A47}</style></head>
<body><h1>${esc(titre)}</h1><p>${message}</p><p><a href="${SITE}/#debats">Voir les débats du blog →</a></p></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
