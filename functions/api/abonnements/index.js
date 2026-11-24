// Inscription à la liste de diffusion des Débats (double confirmation par e-mail)
import { json, quota, clean } from "../../../lib/api.js";
import { mdb, THEMES, isEmail, token, mailConfigured, sendMany, mailConfirmation } from "../../../lib/mail.js";

export const themesValides = t => [...new Set((Array.isArray(t) ? t : []).filter(x => Object.prototype.hasOwnProperty.call(THEMES, x)))];

// Prépare (ou renouvelle) une inscription en attente et renvoie le message de confirmation, ou null s'il ne faut rien envoyer
export async function preparerInscription(D, email, themes, source, invite) {
  const ex = await D.prepare(`SELECT email, statut, token FROM abonnes WHERE email = ?`).bind(email).first();
  if (invite && ex && (ex.statut === "desinscrit" || ex.statut === "actif")) return null; // on ne relance jamais une personne désinscrite
  const tok = (ex && ex.token) || token(); const now = Date.now(); // jeton stable : les liens de désinscription déjà envoyés restent valables
  if (!ex) await D.prepare(`INSERT INTO abonnes (email, themes, themes_attente, statut, token, source, created) VALUES (?, '[]', ?, 'en_attente', ?, ?, ?)`).bind(email, JSON.stringify(themes), tok, source, now).run();
  else await D.prepare(`UPDATE abonnes SET themes_attente = ?, token = ?, statut = CASE WHEN statut = 'actif' THEN 'actif' ELSE 'en_attente' END WHERE email = ?`).bind(JSON.stringify(themes), tok, email).run();
  return mailConfirmation(email, tok, themes, invite);
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  if (b.website) return json({ ok: true });
  if (!mailConfigured(env)) return json({ error: "La liste de diffusion n'est pas encore ouverte." }, 503);
  const email = clean(b.email, 160).toLowerCase();
  if (!isEmail(email)) return json({ error: "Adresse e-mail invalide." }, 400);
  if (b.consentement !== true) return json({ error: "Merci de cocher la case de consentement." }, 400);
  if (!(await quota(env, request, "abo", 5))) return json({ error: "Trop d'essais aujourd'hui." }, 429);
  const D = await mdb(env);
  const msg = await preparerInscription(D, email, themesValides(b.themes), "site", false);
  try { if (msg) await sendMany(env, [msg]); } catch (e) { return json({ error: "L'e-mail de confirmation n'a pas pu partir. Réessayez plus tard." }, 502); }
  return json({ ok: true });
}

// État public : la liste est-elle ouverte ? (le formulaire du site ne s'affiche que si l'envoi est configuré)
export async function onRequestGet({ env }) {
  return json({ ouvert: mailConfigured(env), themes: THEMES });
}
