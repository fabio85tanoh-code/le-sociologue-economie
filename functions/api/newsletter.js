import { json, db, quota, clean } from "../../lib/api.js";
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const email = clean(b.email, 160).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Adresse invalide" }, 400);
  if (!(await quota(env, request, "news", 5))) return json({ error: "Trop d'essais." }, 429);
  const D = await db(env);
  await D.prepare(`INSERT OR IGNORE INTO newsletter (email, created) VALUES (?, ?)`).bind(email, Date.now()).run();
  return json({ ok: true });
}
