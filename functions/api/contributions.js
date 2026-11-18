// Dépôt d'une contribution ou d'une réplique, avec modération automatique (Workers AI)
import { json, db, quota, clean, uid, today, ipHash } from "../../lib/api.js";

const TYPES = ["interview", "note", "pointdevue", "lecture", "question"];
const STATUTS = ["Enseignant·e", "Chercheur·e", "Étudiant·e"];
const POSITIONS = ["accord", "nuance", "desaccord"];
const MOD_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

async function moderer(env, p) {
  if (!env.AI) return { decision: "a_revoir", motif: "Modération IA indisponible" };
  const prompt = `Tu modères l'espace « Débats scientifiques » d'un blog de sociologie économique (Côte d'Ivoire). Charte : contributions thématiques d'enseignants, chercheurs ou étudiants ; ton respectueux ; argumentation ; pas de spam, de publicité, d'attaque personnelle, de propos discriminatoires, de données personnelles d'autrui, ni de hors-sujet. Ce n'est pas une revue : on accepte un texte court s'il est pertinent et argumenté.
Réponds UNIQUEMENT par un objet JSON {"decision":"publier"|"refuser"|"a_revoir","motif":"une phrase"}. Utilise "a_revoir" en cas de doute.
TEXTE À MODÉRER :
${JSON.stringify(p).slice(0, 9000)}`;
  try {
    const r = await env.AI.run(MOD_MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 120, temperature: 0 });
    const m = String(r.response || "").match(/\{[\s\S]*\}/); const o = m ? JSON.parse(m[0]) : {};
    const d = ["publier", "refuser", "a_revoir"].includes(o.decision) ? o.decision : "a_revoir";
    return { decision: d, motif: clean(o.motif, 300) };
  } catch { return { decision: "a_revoir", motif: "Modération IA en échec" }; }
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  if (b.website) return json({ ok: true }); // pot de miel anti-robots
  if (!(await quota(env, request, "contrib", 6))) return json({ error: "Trop d'envois aujourd'hui." }, 429);
  const D = await db(env);
  const kind = b.kind === "replique" ? "replique" : "contribution";
  const base = { auteur: clean(b.auteur, 120), statut: STATUTS.includes(b.statut) ? b.statut : "Chercheur·e", texte: clean(b.texte, 30000), references: (Array.isArray(b.references) ? b.references : []).slice(0, 30).map(r => clean(r, 400)).filter(Boolean) };
  let p;
  if (kind === "contribution") {
    p = { ...base, type: TYPES.includes(b.type) ? b.type : "note", theme: clean(b.theme, 60), institution: clean(b.institution, 160), titre: clean(b.titre, 220), chapo: clean(b.chapo, 600) };
    if (p.auteur.length < 3 || p.titre.length < 8 || p.texte.length < 300) return json({ error: "Texte incomplet : nom, titre et au moins 300 caractères sont requis." }, 400);
  } else {
    p = { ...base, position: POSITIONS.includes(b.position) ? b.position : "nuance" };
    const target = clean(b.target, 40);
    const t = await D.prepare(`SELECT id FROM debats WHERE id = ? AND status = 'publie'`).bind(target).first();
    if (!t) return json({ error: "Débat introuvable." }, 404);
    p.target = target;
    if (p.auteur.length < 3 || p.texte.length < 80) return json({ error: "Réplique trop courte (80 caractères minimum)." }, 400);
  }
  const id = uid(); const now = Date.now();
  const { decision, motif } = await moderer(env, p);
  const status = decision === "publier" ? "publie" : decision === "refuser" ? "refuse" : "a_revoir";
  await D.prepare(`INSERT INTO soumissions (id, kind, target, payload, status, motif, uid, ip_hash, created) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(id, kind, p.target || null, JSON.stringify(p), status, motif, clean(b.by, 60), await ipHash(request), now).run();
  if (status === "publie") await publier(D, kind, p, id, now);
  return json({ ok: true, status });
}

export async function publier(D, kind, p, id, now) {
  if (kind === "contribution") {
    await D.prepare(`INSERT OR IGNORE INTO debats (id, type, theme, auteur, statut, institution, titre, chapo, texte, refs, repliques, status, date, created) VALUES (?,?,?,?,?,?,?,?,?,?,'[]','publie',?,?)`)
      .bind(id, p.type, p.theme, p.auteur, p.statut, p.institution, p.titre, p.chapo, p.texte, JSON.stringify(p.references || []), today(), now).run();
  } else {
    const row = await D.prepare(`SELECT repliques FROM debats WHERE id = ?`).bind(p.target).first();
    if (!row) return;
    const reps = JSON.parse(row.repliques || "[]"); const { target, ...rep } = p;
    reps.push({ ...rep, date: today() });
    await D.prepare(`UPDATE debats SET repliques = ? WHERE id = ?`).bind(JSON.stringify(reps), p.target).run();
  }
}
