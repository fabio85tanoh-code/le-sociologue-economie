// Confirmation d'inscription : la page affiche un bouton (les robots qui « cliquent » les liens n'inscrivent personne)
import { mdb, pageHtml, esc, THEMES } from "../../../lib/mail.js";

const tokOf = url => String(new URL(url).searchParams.get("t") || "").replace(/[^a-f0-9]/g, "").slice(0, 64);

export async function onRequestGet({ request, env }) {
  const t = tokOf(request.url);
  const D = await mdb(env);
  const a = t && await D.prepare(`SELECT email, themes_attente FROM abonnes WHERE token = ?`).bind(t).first();
  if (!a) return pageHtml("Lien expiré", "Ce lien de confirmation n'est plus valable. Vous pouvez vous inscrire à nouveau depuis la page Débats du blog.");
  const th = JSON.parse(a.themes_attente || "[]");
  return pageHtml("Confirmer votre inscription", `Adresse : <b>${esc(a.email)}</b><br>Thèmes : <b>${esc(th.length ? th.map(x => THEMES[x] || x).join(", ") : "tous les thèmes")}</b></p>
<form method="post"><input type="hidden" name="t" value="${esc(t)}"><button style="background:#F77F00;color:#0B1420;border:0;border-radius:8px;padding:12px 20px;font-weight:bold;font-size:16px;cursor:pointer">Je confirme mon inscription</button></form><p style="font-size:14px;color:#6B7280">Vous pourrez vous désinscrire en un clic depuis chaque e-mail.`);
}

export async function onRequestPost({ request, env }) {
  const f = await request.formData().catch(() => null);
  const t = String((f && f.get("t")) || "").replace(/[^a-f0-9]/g, "").slice(0, 64);
  const D = await mdb(env);
  const a = t && await D.prepare(`SELECT email, themes_attente FROM abonnes WHERE token = ?`).bind(t).first();
  if (!a) return pageHtml("Lien expiré", "Ce lien de confirmation n'est plus valable.");
  await D.prepare(`UPDATE abonnes SET statut = 'actif', themes = COALESCE(themes_attente, themes), themes_attente = NULL, confirmed = ? WHERE token = ?`).bind(Date.now(), t).run();
  return pageHtml("Inscription confirmée", "Merci ! Vous recevrez désormais par e-mail les nouveaux débats scientifiques correspondant à vos thèmes. Chaque message contient un lien de désinscription.");
}
