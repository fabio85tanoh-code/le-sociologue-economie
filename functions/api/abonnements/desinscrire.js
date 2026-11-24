// Désinscription : page avec bouton (GET) et désinscription en un clic (POST, en-tête List-Unsubscribe-Post)
import { mdb, pageHtml, esc } from "../../../lib/mail.js";

const clean = t => String(t || "").replace(/[^a-f0-9]/g, "").slice(0, 64);

export async function onRequestGet({ request, env }) {
  const t = clean(new URL(request.url).searchParams.get("t"));
  const D = await mdb(env);
  const a = t && await D.prepare(`SELECT email, statut FROM abonnes WHERE token = ?`).bind(t).first();
  if (!a) return pageHtml("Lien non reconnu", "Ce lien de désinscription n'est pas reconnu. Si vous recevez encore des messages, répondez simplement à l'un d'eux.");
  if (a.statut === "desinscrit") return pageHtml("Déjà désinscrit(e)", `L'adresse <b>${esc(a.email)}</b> ne reçoit plus aucun message des Débats.`);
  return pageHtml("Se désinscrire", `Ne plus recevoir les débats du blog à l'adresse <b>${esc(a.email)}</b> ?</p>
<form method="post"><input type="hidden" name="t" value="${esc(t)}"><button style="background:#0E2A47;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:bold;font-size:16px;cursor:pointer">Me désinscrire</button></form><p>`);
}

export async function onRequestPost({ request, env }) {
  let t = clean(new URL(request.url).searchParams.get("t"));
  if (!t) { const f = await request.formData().catch(() => null); t = clean(f && f.get("t")); }
  const D = await mdb(env);
  const a = t && await D.prepare(`SELECT email FROM abonnes WHERE token = ?`).bind(t).first();
  if (a) await D.prepare(`UPDATE abonnes SET statut = 'desinscrit', themes_attente = NULL WHERE token = ?`).bind(t).run();
  return pageHtml("Désinscription confirmée", "Vous ne recevrez plus aucun message des Débats du blog. Vous pourrez vous réinscrire à tout moment depuis la page Débats.");
}
