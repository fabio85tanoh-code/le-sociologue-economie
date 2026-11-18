// Liste publique des débats publiés
import { json, db, rowToDebat } from "../../lib/api.js";

export async function onRequestGet({ env }) {
  try {
    const D = await db(env);
    const { results } = await D.prepare(`SELECT * FROM debats WHERE status = 'publie' ORDER BY date DESC, created DESC LIMIT 300`).all();
    return json({ items: results.map(rowToDebat) });
  } catch { return json({ items: [] }); }
}
