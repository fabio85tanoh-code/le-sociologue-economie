// Assistant du blog : Workers AI (offre gratuite Cloudflare), sans clé externe
import { json, quota } from "../../lib/api.js";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: "Assistant non configuré (binding AI)" }, 503);
  if (!(await quota(env, request, "chat", 60))) return json({ error: "Limite quotidienne atteinte, revenez demain." }, 429);
  let body; try { body = await request.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const msgs = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "Question manquante" }, 400);
  const system = "Tu es l'assistant du blog scientifique « Le Sociologue de l'Économie » de Dr Fabrice TANOH. Réponds toujours en français, de façon claire, rigoureuse et non partisane. N'invente jamais de chiffre, de citation ni de référence.";
  try {
    const r = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, ...msgs], max_tokens: 700, temperature: 0.3 });
    return json({ text: (r && (r.response || r.result || "")).trim() });
  } catch (e) {
    return json({ error: "Assistant momentanément indisponible" }, 503);
  }
}
