// Outils partagés des fonctions Cloudflare Pages (base D1 + Workers AI)
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

let ready = false;
export async function db(env) {
  if (!env.DB) throw new Error("Base D1 non liée (binding DB)");
  if (!ready) {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS debats (id TEXT PRIMARY KEY, type TEXT, theme TEXT, auteur TEXT, statut TEXT, institution TEXT, titre TEXT, chapo TEXT, texte TEXT, refs TEXT, repliques TEXT DEFAULT '[]', status TEXT, date TEXT, created INTEGER)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS soumissions (id TEXT PRIMARY KEY, kind TEXT, target TEXT, payload TEXT, status TEXT, motif TEXT, uid TEXT, ip_hash TEXT, created INTEGER)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS newsletter (email TEXT PRIMARY KEY, created INTEGER)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS quotas (k TEXT PRIMARY KEY, n INTEGER)`),
    ]);
    ready = true;
  }
  return env.DB;
}

export async function ipHash(request) {
  const ip = request.headers.get("cf-connecting-ip") || "0";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lse:" + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Quota journalier par visiteur (anti-abus) ; renvoie false si dépassé
export async function quota(env, request, name, max) {
  const D = await db(env); const k = `${name}:${new Date().toISOString().slice(0, 10)}:${await ipHash(request)}`;
  const r = await D.prepare(`INSERT INTO quotas (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`).bind(k).first();
  return (r && r.n) <= max;
}

export const clean = (s, max) => String(s || "").replace(/<[^>]*>/g, "").trim().slice(0, max);
export const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
export const today = () => new Date().toISOString().slice(0, 10);

export function isAdmin(request, env) {
  const t = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return !!env.ADMIN_TOKEN && t.length > 20 && t === env.ADMIN_TOKEN;
}

export const rowToDebat = r => ({ _id: r.id, type: r.type, theme: r.theme, auteur: r.auteur, statut: r.statut, institution: r.institution, titre: r.titre, chapo: r.chapo, texte: r.texte, references: JSON.parse(r.refs || "[]"), repliques: JSON.parse(r.repliques || "[]"), status: r.status, date: r.date });
