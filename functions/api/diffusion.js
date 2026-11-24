// Diffusion des Débats par e-mail — réservé au titulaire du secret ADMIN_TOKEN
//   GET  : état (configuration, abonnés par thème, débats publiés et envois déjà faits)
//   POST : { action: "envoyer", debat_id, force }  → envoie le débat aux abonnés de son thème
//          { action: "inviter", emails: [...], themes: [...] } → invitations à s'inscrire (double confirmation)
import { json, isAdmin } from "../../lib/api.js";
import { mdb, THEMES, isEmail, mailConfigured, sendMany, diffuserDebat } from "../../lib/mail.js";
import { preparerInscription, themesValides } from "./abonnements/index.js";

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Accès refusé" }, 401);
  const D = await mdb(env);
  const { results: abos } = await D.prepare(`SELECT themes, statut FROM abonnes`).all();
  const parTheme = {}; let actifs = 0, attente = 0, desinscrits = 0, tous = 0;
  for (const a of abos) {
    if (a.statut === "en_attente") { attente++; continue; }
    if (a.statut === "desinscrit") { desinscrits++; continue; }
    actifs++; const t = JSON.parse(a.themes || "[]");
    if (!t.length) tous++; else t.forEach(x => { parTheme[x] = (parTheme[x] || 0) + 1; });
  }
  const { results: debats } = await D.prepare(`SELECT id, titre, theme, date FROM debats WHERE status = 'publie' ORDER BY date DESC, created DESC LIMIT 50`).all();
  const { results: envois } = await D.prepare(`SELECT debat_id, SUM(nb) AS nb, MAX(created) AS dernier FROM envois GROUP BY debat_id`).all();
  const env2 = Object.fromEntries(envois.map(e => [e.debat_id, e]));
  return json({
    configure: mailConfigured(env), fournisseur: String(env.MAIL_PROVIDER || "resend").toLowerCase(),
    abonnes: { actifs, en_attente: attente, desinscrits, tous_themes: tous, par_theme: parTheme },
    themes: THEMES,
    debats: debats.map(d => ({ ...d, envoye: env2[d.id] ? { nb: env2[d.id].nb, date: env2[d.id].dernier } : null })),
  });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Accès refusé" }, 401);
  if (!mailConfigured(env)) return json({ error: "Envoi non configuré : ajoutez les secrets MAIL_PROVIDER, MAIL_API_KEY et MAIL_FROM dans Cloudflare, puis redéployez." }, 503);
  const b = await request.json().catch(() => ({}));
  try {
    if (b.action === "envoyer") {
      const r = await diffuserDebat(env, String(b.debat_id || ""), { force: !!b.force, mode: "manuel" });
      if (!r.ok) return json({ error: r.raison === "deja_envoye" ? "Ce débat a déjà été envoyé (bouton « Renvoyer » pour l'envoyer à nouveau)." : "Débat introuvable." }, 409);
      return json({ ok: true, nb: r.nb });
    }
    if (b.action === "inviter") {
      const emails = [...new Set((Array.isArray(b.emails) ? b.emails : []).map(e => String(e).trim().toLowerCase()).filter(isEmail))].slice(0, 50);
      if (!emails.length) return json({ error: "Aucune adresse valide." }, 400);
      const D = await mdb(env); const themes = themesValides(b.themes); const msgs = [];
      for (const e of emails) { const m = await preparerInscription(D, e, themes, "invitation", true); if (m) msgs.push(m); }
      const nb = await sendMany(env, msgs);
      return json({ ok: true, invites: nb, ignores: emails.length - nb });
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (e) { return json({ error: String(e.message || e).slice(0, 300) }, 502); }
}
