// Modération manuelle (cas « à revoir ») : réservé au titulaire du secret ADMIN_TOKEN
import { json, db, isAdmin } from "../../lib/api.js";
import { publier } from "./contributions.js";

export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Accès refusé" }, 401);
  const D = await db(env);
  const { results } = await D.prepare(`SELECT id, kind, target, payload, status, motif, created FROM soumissions WHERE status = 'a_revoir' ORDER BY created DESC LIMIT 100`).all();
  return json({ items: results.map(r => ({ ...r, payload: JSON.parse(r.payload) })) });
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Accès refusé" }, 401);
  const { id, decision } = await request.json().catch(() => ({}));
  const D = await db(env);
  const s = await D.prepare(`SELECT * FROM soumissions WHERE id = ?`).bind(id).first();
  if (!s) return json({ error: "Introuvable" }, 404);
  const status = decision === "publier" ? "publie" : "refuse";
  await D.prepare(`UPDATE soumissions SET status = ?, motif = 'Décision de l''éditeur' WHERE id = ?`).bind(status, id).run();
  if (status === "publie") await publier(D, s.kind, JSON.parse(s.payload), s.id, s.created, env);
  return json({ ok: true, status });
}
