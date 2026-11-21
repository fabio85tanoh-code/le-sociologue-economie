// Attestations de formation : correction de l'examen final, délivrance, signature et registre public.
// À déployer en functions/api/certificats.js (Cloudflare Pages). Secret requis : CERT_SECRET (≥ 32 caractères).
// POST /api/certificats {parcours, nom, profil, reponses:[{id, choix}], modules:[...]} → {reussi, score, num?}
// GET  /api/certificats?num=LSE-AAAA-XXXXXX → {valide, num, nom, profil, titre, heures, nb_modules, score, date, sig}
import { json, db, quota, clean, ipHash, today } from "../../lib/api.js";

const PROFILS = ["Étudiant·e", "Enseignant·e", "Chercheur·e", "Praticien·ne (ONG, administration, entreprise)", "Journaliste", "Citoyen·ne"];
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function table(env) {
  const D = await db(env);
  await D.prepare(`CREATE TABLE IF NOT EXISTS certificats (num TEXT PRIMARY KEY, nom TEXT, profil TEXT, parcours TEXT, titre TEXT, heures INTEGER, nb_modules INTEGER, score INTEGER, date TEXT, sig TEXT, statut TEXT DEFAULT 'valide', ip_hash TEXT, created INTEGER)`).run();
  return D;
}
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  const hex = [...s].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return hex.match(/.{4}/g).join("-");
}
const payload = c => [c.num, c.nom, c.parcours, c.date, c.score, c.heures].join("|");
async function formations(request, env) {
  const url = new URL("/data/formations.json", request.url);
  const r = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
  if (!r.ok) throw new Error("Catalogue des formations indisponible");
  return r.json();
}
function newNum() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return `LSE-${new Date().getUTCFullYear()}-${[...b].map(x => ALPHA[x % ALPHA.length]).join("")}`;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.CERT_SECRET || env.CERT_SECRET.length < 32) return json({ error: "La délivrance des attestations n'est pas encore configurée." }, 503);
    if (!(await quota(env, request, "cert", 12))) return json({ error: "Trop de tentatives aujourd'hui. Réessayez demain." }, 429);
    const b = await request.json().catch(() => ({}));
    const nom = clean(b.nom, 80).replace(/\s+/g, " ");
    if (nom.length < 4 || !/[A-Za-zÀ-ÿ]/.test(nom)) return json({ error: "Indiquez votre nom et vos prénoms." }, 400);
    const profil = PROFILS.includes(b.profil) ? b.profil : "Citoyen·ne";
    const F = await formations(request, env);
    const p = (F.parcours || []).find(x => x.id === b.parcours);
    if (!p || p.statut !== "ouvert") return json({ error: "Ce parcours n'est pas ouvert à la certification." }, 400);
    const bank = new Map(p.modules.flatMap(m => m.questions).map(q => [q.id, q]));
    const need = (F.regles && F.regles.examen && F.regles.examen.nb_questions) || 20;
    const seuil = (F.regles && F.regles.examen && F.regles.examen.seuil) || F.seuil || 80;
    const seen = new Set(); let ok = 0, n = 0;
    for (const r of Array.isArray(b.reponses) ? b.reponses.slice(0, 60) : []) {
      const q = bank.get(String(r.id)); if (!q || seen.has(q.id)) continue;
      seen.add(q.id); n++; if (Number(r.choix) === q.bonne) ok++;
    }
    if (n < Math.min(need, bank.size)) return json({ error: "Examen incomplet : répondez à toutes les questions." }, 400);
    const score = Math.round((100 * ok) / n);
    if (score < seuil) return json({ reussi: false, score });
    const D = await table(env);
    const c = { num: newNum(), nom, profil, parcours: p.id, titre: p.titre, heures: p.heures, nb_modules: p.modules.length, score, date: today() };
    c.sig = await hmac(env.CERT_SECRET, payload(c));
    await D.prepare(`INSERT INTO certificats (num, nom, profil, parcours, titre, heures, nb_modules, score, date, sig, statut, ip_hash, created) VALUES (?,?,?,?,?,?,?,?,?,?,'valide',?,?)`)
      .bind(c.num, c.nom, c.profil, c.parcours, c.titre, c.heures, c.nb_modules, c.score, c.date, c.sig, await ipHash(request), Date.now()).run();
    return json({ reussi: true, score, num: c.num });
  } catch (e) { return json({ error: "Service des attestations indisponible." }, 500); }
}

export async function onRequestGet({ request, env }) {
  try {
    const num = clean(new URL(request.url).searchParams.get("num"), 20).toUpperCase();
    if (!/^LSE-\d{4}-[A-Z0-9]{6}$/.test(num)) return json({ valide: false, motif: "Format de numéro invalide." });
    const D = await table(env);
    const c = await D.prepare(`SELECT * FROM certificats WHERE num = ?`).bind(num).first();
    if (!c) return json({ valide: false, motif: "Ce numéro ne figure pas au registre." });
    if (c.statut !== "valide") return json({ valide: false, motif: "Cette attestation a été révoquée." });
    if (!env.CERT_SECRET || (await hmac(env.CERT_SECRET, payload(c))) !== c.sig) return json({ valide: false, motif: "Signature non conforme." });
    return json({ valide: true, num: c.num, nom: c.nom, profil: c.profil, parcours: c.parcours, titre: c.titre, heures: c.heures, nb_modules: c.nb_modules, score: c.score, date: c.date, sig: c.sig });
  } catch { return json({ valide: false, motif: "Registre indisponible." }); }
}
