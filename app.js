/* Sociologie de l'Économie — application monopage (SPA)
   Contenus : data/*.json (versionnés) + base partagée (capability db) pour les contributions,
   commentaires, votes, publicités et publications validées par les éditeurs et les agents. */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mk = s => esc(s).replace(/\*([^*]+)\*/g, "<mark>$1</mark>");
const fold = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const fmt = n => typeof n === "number" ? n.toLocaleString("fr-FR") : esc(n);
const today = () => new Date().toISOString().slice(0, 10);
function toast(t) { const e = $("#toast"); e.textContent = t; e.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = "none", 3200); }
async function copy(t) { try { await navigator.clipboard.writeText(t); toast("Copié dans le presse-papiers"); } catch { toast("Copie impossible : sélectionnez le texte manuellement"); } }
const NIV = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé" };
const THEMES = { informel: "Économie informelle", travail: "Travail & emploi", marches: "Marchés", agriculture: "Agriculture", entrepreneuriat: "Entrepreneuriat", developpement: "Développement", inegalites: "Inégalités", genre: "Genre", finance: "Finance populaire", environnement: "Environnement", organisations: "Organisations", savoir: "Savoir & éducation", numerique: "Numérique", transport: "Transport", dette: "Dette", migrations: "Migrations", politiques: "Politiques publiques" };
const GROUPES = ["Économie informelle", "Emploi des jeunes", "Agriculture & filières", "Numérique", "Genre & économie", "Finance populaire", "Villes & marchés", "Éducation", "Santé", "Environnement"];

let C = {}, COURSES = [], OBS = null, MAP = null, BIB = null;
const S = { db: null, user: null, sample: null, tts: null, dl: null, uid: null, canWrite: null, canEdit: false, published: [], ads: [], comments: [], forum: [], votes: [], subs: [], audit: [] };

/* ---------------- chargement ---------------- */
async function getJSON(p, fb) { try { const r = await fetch(p); if (!r.ok) throw 0; return await r.json(); } catch { return fb; } }
async function boot() {
  try { if (localStorage.getItem("lse-theme") === "dark" || (!localStorage.getItem("lse-theme") && matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.dataset.theme = "dark"; } catch {}
  [C, COURSES, OBS, MAP, BIB] = await Promise.all([getJSON("data/content.json", {}), getJSON("data/courses.json", []), getJSON("data/observatoire.json", null), getJSON("data/carte_ci.json", null), getJSON("data/bibliotheque.json", null)]);
  buildIndex();
  window.addEventListener("hashchange", route);
  route();
  initCaps();
}

/* ---------------- capacités (base partagée, IA, voix, téléchargements) ---------------- */
async function initCaps() {
  if (!window.claude || !window.claude.use) return;
  claude.use("sample").then(s => { S.sample = s; }).catch(() => {});
  claude.use("tts").then(t => { S.tts = t; refreshIfAny(); }).catch(() => {});
  claude.use("downloads").then(d => { S.dl = d; refreshIfAny(); }).catch(() => {});
  try {
    S.user = await claude.use("user");
    if (S.user) {
      S.uid = await S.user.id().catch(() => null);
      S.canEdit = !!(await Promise.resolve(S.user.canEdit()).catch(() => false));
      S.canWrite = await Promise.resolve(S.user.can("data.write")).catch(() => null);
    }
  } catch {}
  try {
    S.db = await claude.use("db");
    if (!S.db) return;
    const sub = (path, key, q) => {
      let ref = S.db.collection(path); if (q) ref = q(ref);
      ref.onSnapshot(snap => { S[key] = snap.docs.map(d => Object.assign({ _id: d.id }, d.data())); refreshIfAny(key); }, () => {});
    };
    sub("published", "published", r => r.orderBy("date", "desc").limit(200));
    sub("ads", "ads");
    sub("comments", "comments", r => r.orderBy("at", "desc").limit(400));
    sub("forum", "forum", r => r.orderBy("at", "desc").limit(200));
    sub("votes", "votes");
    if (S.canEdit) { S.db.collection("submissions").onSnapshot(snap => { S.subs = snap.docs.flatMap(d => ((d.data() || {}).items || []).map((it, i) => Object.assign({ _id: d.id + "~" + i, _doc: d.id, _i: i }, it))).sort((a, b) => b.at - a.at); refreshIfAny(); }, () => {}); sub("audit", "audit", r => r.orderBy("at", "desc").limit(60)); }
  } catch {}
}
let refreshT;
function refreshIfAny() { clearTimeout(refreshT); refreshT = setTimeout(() => { const y = scrollY; const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.value) return; route(true); scrollTo(0, y); }, 250); }
const canPost = () => S.db && S.canWrite !== false;
async function audit(agent, action) { if (!S.db || !S.canEdit) return; try { await S.db.collection("audit").add({ agent, action, by: S.uid || "", at: Date.now() }); } catch {} }

/* ---------------- routeur ---------------- */
const ROUTES = {};
function route(keep) {
  const h = (location.hash || "#accueil").slice(1);
  const [base, ...rest] = h.split("-"); const arg = rest.join("-");
  const fn = ROUTES[h] || ROUTES[base] || ROUTES.accueil;
  const main = $("#main");
  main.innerHTML = fn(arg) || "";
  $$("#nav a").forEach(a => a.classList.toggle("on", a.dataset.r === base || (base === "cours" && a.dataset.r === "cours")));
  $("#nav").classList.remove("open");
  const seo = (C.seo || {})[{ accueil: "accueil", savoirs: "savoirs", recherche: "recherche", observatoire: "donnees", communaute: "communaute", contribuer: "contribuer", medias: "medias", "a": "a-propos", partenaires: "partenaires" }[base] || ""];
  const pt = pageTitle(base, arg); const BRAND = "SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH";
  document.title = (seo && seo.title) || (pt ? pt + " — " + BRAND : BRAND);
  if (!keep) { scrollTo(0, 0); main.focus({ preventScroll: true }); }
  (AFTER[base] || (() => {}))(arg);
}
function pageTitle(b, a) { return ({ cours: a ? "Cours" : "Cours gratuits de sociologie économique", article: "Article", fiche: "Fiche", savoirs: "Savoirs", recherche: "Recherche en libre accès", auteur: "Dr Fabrice TANOH, sociologue de l'économie", publications: "Publications de Dr Fabrice TANOH", podcast: "Podcast Socio-Éco", debats: "Débats scientifiques", debat: "Débat", observatoire: "Observatoire de l'économie ivoirienne", bibliotheque: "Bibliothèque ouverte", formations: "Formations certifiantes gratuites", formation: "Formation", chartes: "Chartes", transparence: "Transparence", partenaires: "Partenaires", cas: "Étude de cas", quiz: "Quiz", parcours: "Parcours" }[b] || ""); }
const AFTER = {};
const head = (k, t, p, crumb) => `<div class="ph"><div class="wrap">${crumb ? `<div class="crumb">${crumb}</div>` : ""}<div class="kicker">${esc(k)}</div><h1>${esc(t)}</h1>${p ? `<p>${esc(p)}</p>` : ""}</div></div>`;
const seoIntro = k => ((C.seo || {})[k] || {}).texte_intro || "";

/* ---------------- publicité éthique ---------------- */
const HOUSE = [
  { _id: "house1", partenaire: "Sociologie de l'Économie", titre: "Votre institution ici, en toute transparence", texte: "Universités, ONG, fondations, entreprises responsables : soutenez la recherche ivoirienne avec un emplacement clairement identifié, sans influence sur nos contenus.", lien: "#partenaires", couleur: "#0E2A47", maison: true },
  { _id: "house2", partenaire: "Sociologie de l'Économie", titre: "Formations certifiantes en enquête de terrain", texte: "Ateliers méthodologiques pour étudiants, ONG et administrations : questionnaires, entretiens, analyse de données.", lien: "#partenaires", couleur: "#009E60", maison: true },
];
function adsFor(slot) {
  const d = today();
  const live = S.ads.filter(a => a.actif && (!a.slot || a.slot === slot || a.slot === "tous") && (!a.debut || a.debut <= d) && (!a.fin || a.fin >= d));
  return live.length ? live : HOUSE;
}
function adBox(slot, banner) {
  const list = adsFor(slot); const a = list[Math.floor(Math.random() * list.length)];
  const initials = esc((a.partenaire || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase());
  return `<aside class="ad ${banner ? "ad-banner" : ""}" aria-label="Contenu sponsorisé"><span class="ad-l">${a.maison ? "Annonce" : "Sponsorisé"}</span>
    ${banner ? `<div class="ad-mark" style="background:${esc(a.couleur || "#0E2A47")}">${initials}</div>` : ""}
    <div style="flex:1;min-width:200px"><small style="color:var(--muted)">${esc(a.partenaire)}</small><h4>${esc(a.titre)}</h4><p>${esc(a.texte)}</p>
    <a class="btn btn-g btn-s" href="${esc(a.lien || "#partenaires")}" data-ad="${esc(a._id)}" rel="sponsored noopener">En savoir plus</a></div></aside>`;
}
document.addEventListener("click", async e => {
  const a = e.target.closest("[data-ad]"); if (!a || !S.db || a.dataset.ad.startsWith("house") || S.canWrite === false) return;
  try { const ref = S.db.doc(`adstats/${a.dataset.ad}_${today()}`); const g = await ref.get(); await ref.set({ ad: a.dataset.ad, jour: today(), clics: ((g.exists && g.data().clics) || 0) + 1 }); } catch {}
});

/* ---------------- ACCUEIL ---------------- */
function mapSVG(cls, values) {
  if (!MAP) return "";
  const vals = values ? Object.values(values).filter(v => typeof v === "number") : [];
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
  const col = v => { if (typeof v !== "number") return ""; const t = (v - mn) / ((mx - mn) || 1); const a = [234, 241, 248], b = [14, 42, 71]; return `fill:rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * Math.pow(t, .6))).join(",")})`; };
  return `<svg class="${cls || ""}" viewBox="${MAP.viewBox}" role="img" aria-label="Carte des 14 districts de Côte d'Ivoire">${Object.entries(MAP.paths).map(([n, d]) => `<path d="${d}" data-d="${esc(n)}" style="${values ? col(values[n]) : ""}"><title>${esc(n)}</title></path>`).join("")}</svg>`;
}
ROUTES.accueil = () => {
  const A = C.accueil || {}; const arts = C.articles || [];
  const pub = S.published.filter(p => p.status === "publie");
  const latest = [...pub.map(p => ({ t: p.titre, u: `#publication-${p._id}`, ty: p.type || "Contribution", d: p.date })), ...arts.map(a => ({ t: a.titre, u: `#article-${slug(a.id)}`, ty: a.type || "Article de fond", d: a.date }))].slice(0, 6);
  const q = A.question_semaine || {};
  const qid = slug(q.question || "q");
  const myVote = S.votes.find(v => v._id === S.uid && v.qid === qid);
  const counts = (q.options || []).map((_, i) => S.votes.filter(v => v.qid === qid && v.choix === i).length); const tot = counts.reduce((a, b) => a + b, 0);
  const reelCourse = COURSES.find(c => c.video && c.video.scenes);
  return `
  <section class="hero"><div class="hero-ring" style="width:520px;height:520px;right:-160px;top:-200px;border:1px solid rgba(247,127,0,.35)"></div><div class="wrap">
    <div><div class="kicker">Sociologie économique · Côte d'Ivoire</div>
      <h1>${esc(A.hero_titre || "Comprendre l'économie ivoirienne par le prisme du social")}</h1>
      <p class="lead">${esc(A.hero_sous_titre || "Cours, recherches, données et débats pour éclairer l'informel, le travail, les marchés et le développement.")}</p>
      <div class="ctas"><a class="btn btn-o" href="#savoirs">Explorer les savoirs</a><a class="btn btn-g" href="#contribuer">Publier une contribution</a><a class="btn btn-g" href="#communaute">Rejoindre la communauté</a></div>
      <div style="display:flex;gap:22px;margin-top:30px;color:#C9D6E3;font-size:.9rem;flex-wrap:wrap"><span><b style="color:#fff;font-size:1.3rem">${COURSES.length}</b> cours animés</span><span><b style="color:#fff;font-size:1.3rem">${arts.length + pub.length}</b> articles &amp; publications</span><span><b style="color:#fff;font-size:1.3rem">${(C.glossaire || []).length}</b> concepts clés</span></div>
    </div>
    <div class="hero-art">${mapSVG()}<div style="text-align:center;color:#9FB3C8;font-size:.8rem;margin-top:6px">Les 14 districts — survolez la carte</div></div>
  </div></section>

  <section class="s"><div class="wrap">
    <div class="sh"><div><div class="kicker">À la une</div><h2>Articles de fond</h2></div><a href="#recherche">Toutes les publications →</a></div>
    <div class="grid g3">${arts.slice(0, 5).map((a, i) => artCard(a, i === 0)).join("") || `<div class="empty">Les articles arrivent.</div>`}</div>
  </div></section>

  <div class="wrap">${adBox("accueil-banniere", true)}</div>

  <section class="s"><div class="wrap">
    <div class="sh"><div><div class="kicker">Chiffres clés</div><h2>L'économie ivoirienne en repères</h2></div><a href="#observatoire">Ouvrir l'observatoire →</a></div>
    <div class="grid g3">${(A.chiffres_cles || []).map(c => `<div class="stat"><b>${esc(c.valeur)}</b><span>${esc(c.label)}</span><small>Source : ${esc(c.source)}${c.annee ? ", " + esc(c.annee) : ""}</small></div>`).join("")}</div>
  </div></section>

  <section class="s alt"><div class="wrap grid g2" style="align-items:start">
    <div><div class="kicker">Question de la semaine</div><h2>${esc(q.question || "")}</h2><p style="color:var(--muted)">${esc(q.contexte || "")}</p>
      <div id="qsem">${(q.options || []).map((o, i) => `<button class="qopt ${myVote && myVote.choix === i ? "ok" : ""}" data-v="${i}">${esc(o)}${myVote || !canPost() ? `<span style="float:right;color:var(--muted)">${tot ? Math.round(counts[i] * 100 / tot) : 0} %</span>` : ""}</button>`).join("")}</div>
      <p style="font-size:.85rem;color:var(--muted)">${canPost() ? (myVote ? `Merci ! ${tot} participation${tot > 1 ? "s" : ""}.` : "Un vote par personne, modifiable.") : "Le vote est ouvert aux membres connectés (niveau contributeur)."}</p></div>
    <div><div class="kicker">5 minutes pour comprendre</div><h2>${esc(reelCourse ? reelCourse.video.titre : "Nos vidéos")}</h2>
      ${reelCourse ? `<div id="homeReel"></div><p style="text-align:center;margin-top:12px"><a href="#cours-${reelCourse.id}">Voir le cours complet →</a></p>` : ""}</div>
  </div></section>

  <section class="s"><div class="wrap">
    <div class="sh"><div><div class="kicker">Cours animés</div><h2>Les cours animés de sociologie économique</h2><p>PowerPoint animés, vidéos courtes et évaluations formatives, du niveau débutant au niveau avancé.</p></div><a href="#cours">Tous les cours →</a></div>
    <div class="grid g4">${COURSES.slice(0, 8).map(courseCard).join("")}</div>
  </div></section>

  <section class="s alt"><div class="wrap grid g2">
    <div><div class="sh"><div><div class="kicker">Dernières publications</div><h2>Fil de la recherche</h2></div></div>
      ${latest.map(l => `<a class="card" style="margin-bottom:12px" href="${l.u}"><div class="meta"><span class="chip">${esc(l.ty)}</span><span>${esc(l.d || "")}</span></div><h3 style="font-size:1.05rem">${esc(l.t)}</h3></a>`).join("")}</div>
    <div><div class="sh"><div><div class="kicker">Agenda</div><h2>Événements</h2></div></div>
      ${(C.evenements || []).map(ev => `<div class="card" style="margin-bottom:12px"><div class="meta"><span class="chip o">${esc(ev.type || "Événement")}</span><span>${esc(ev.date || "")}</span><span>${esc(ev.lieu || "")}</span>${ev.exemple ? `<span class="chip">Exemple</span>` : ""}</div><h3 style="font-size:1.05rem">${esc(ev.titre)}</h3><p>${esc(ev.description || "")}</p></div>`).join("")}</div>
  </div></section>

  <section class="s"><div class="wrap">
    <div class="sh"><div><div class="kicker">Thèmes populaires</div><h2>Explorer par thème</h2></div></div>
    <div class="pill-row">${Object.entries(THEMES).map(([k, v]) => `<a class="theme-pill" href="#recherche-${k}">${v}</a>`).join("")}</div>
  </div></section>

  <section class="s alt"><div class="wrap grid g2" style="align-items:center">
    <div><div class="kicker">Newsletter</div><h2>La lettre de Sociologie de l’Économie</h2><p style="color:var(--muted)">${esc(A.newsletter_texte || "Chaque mois : un article de fond, une donnée décryptée, un cours, un événement.")}</p></div>
    <form class="card" id="nlForm"><div class="field"><label for="nlMail">Adresse e-mail</label><input id="nlMail" type="email" required placeholder="prenom.nom@exemple.ci"></div>
      <div class="field"><label for="nlProf">Vous êtes</label><select id="nlProf">${["Étudiant·e", "Chercheur·e", "Enseignant·e", "Journaliste", "Entrepreneur·e", "Décideur·e", "ONG", "Citoyen·ne"].map(p => `<option>${p}</option>`).join("")}</select></div>
      <label style="font-size:.85rem;display:flex;gap:8px;align-items:start"><input type="checkbox" required> J'accepte que mon adresse soit utilisée uniquement pour l'envoi de la lettre (désinscription à tout moment).</label>
      <button class="btn btn-o" style="margin-top:12px" ${canPost() ? "" : "disabled"}>${canPost() ? "S'abonner" : "Inscription réservée aux membres connectés"}</button></form>
  </div></section>`;
};
AFTER.accueil = () => {
  const rc = COURSES.find(c => c.video && c.video.scenes); if (rc && $("#homeReel")) reel($("#homeReel"), rc.video, false);
  const q = (C.accueil || {}).question_semaine || {}; const qid = slug(q.question || "q");
  $$("#qsem .qopt").forEach(b => b.onclick = async () => {
    if (!canPost() || !S.uid) return toast("Connectez-vous avec un accès contributeur pour voter.");
    try { await S.db.doc("votes/" + S.uid).set({ qid, choix: +b.dataset.v, at: Date.now() }); toast("Vote enregistré"); } catch { toast("Vote impossible pour ce compte."); }
  });
  const f = $("#nlForm"); if (f) f.onsubmit = async e => { e.preventDefault(); if (!canPost() || !S.uid) return; try { await S.db.doc("newsletter/" + S.uid).set({ email: $("#nlMail").value, profil: $("#nlProf").value, at: Date.now() }); toast("Inscription confirmée. Bienvenue !"); f.reset(); } catch { toast("Inscription impossible pour ce compte."); } };
  $$(".hero-art path").forEach(p => { p.onmousemove = e => tip(e, p.dataset.d); p.onmouseleave = () => tip(); p.onclick = () => location.hash = "observatoire"; });
};
function tip(e, t) { const el = $("#tip"); if (!e) return el.style.display = "none"; el.innerHTML = t; el.style.display = "block"; el.style.left = e.clientX + 14 + "px"; el.style.top = e.clientY + 14 + "px"; }
function artCard(a, feat) {
  return `<a class="card ${feat ? "feat" : ""}" href="#article-${slug(a.id)}"><div class="meta"><span class="chip o">${esc(THEMES[a.theme] || a.theme || "Article")}</span><span>${esc(a.region || "")}</span><span>${esc(a.temps_lecture || "")}</span></div><h3>${esc(a.titre)}</h3><p>${esc(a.chapo || "")}</p></a>`;
}
function courseCard(c) {
  return `<a class="card" href="#cours-${c.id}"><div class="meta"><span class="chip g">${esc(c.niveau)}</span></div><h3 style="font-size:1.08rem">${esc(c.titre)}</h3><p style="font-size:.88rem">${esc(c.accroche || "")}</p><div class="meta"><span>${esc(THEMES[c.theme_site] || "")}</span></div></a>`;
}

/* ---------------- SAVOIRS ---------------- */
ROUTES.savoirs = (tab) => {
  tab = tab || "fiches";
  const tabs = [["fiches", "Fiches de cours"], ["parcours", "Parcours"], ["glossaire", "Glossaire"], ["quiz", "Quiz"], ["cas", "Études de cas"]];
  let body = "";
  if (tab === "fiches") body = `<div class="filters"><select id="fNiv"><option value="">Tous niveaux</option>${Object.entries(NIV).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
     <div class="grid g3" id="fichesList">${(C.fiches || []).map(f => `<a class="card" data-niv="${esc(f.niveau)}" href="#fiche-${slug(f.id)}"><div class="meta"><span class="chip g">${esc(NIV[f.niveau] || f.niveau)}</span><span>${esc(f.discipline || "")}</span><span>${esc(f.duree_min || "")} min</span></div><h3>${esc(f.titre)}</h3><p>${esc(f.resume)}</p></a>`).join("")}</div>`;
  if (tab === "parcours") body = `<div class="grid g2">${(C.parcours || []).map(p => `<a class="card" href="#parcours-${slug(p.id)}"><div class="meta"><span class="chip o">${esc(p.duree || "")}</span><span>${esc(p.public || "")}</span></div><h3>${esc(p.titre)}</h3><p>${(p.etapes || []).length} étapes · badge « ${esc(p.badge || "")} »</p></a>`).join("")}</div>`;
  if (tab === "glossaire") { const g = [...(C.glossaire || [])].sort((a, b) => fold(a.terme).localeCompare(fold(b.terme))); const L = [...new Set(g.map(x => fold(x.terme)[0].toUpperCase()))];
    body = `<div class="filters"><input id="gSearch" placeholder="Filtrer les concepts…" aria-label="Filtrer le glossaire"></div><div class="letters">${L.map(l => `<button data-l="${l}">${l}</button>`).join("")}</div>
     <div id="gList">${g.map(x => `<details class="gl-item" id="g-${slug(x.terme)}" data-t="${esc(fold(x.terme + " " + x.definition))}" data-l="${fold(x.terme)[0].toUpperCase()}"><summary>${esc(x.terme)}</summary><p style="margin-top:10px">${esc(x.definition)}</p><p><b>Auteurs :</b> ${esc(Array.isArray(x.auteurs) ? x.auteurs.join(", ") : x.auteurs || "")}</p><div class="aside-box"><b>En Côte d'Ivoire —</b> ${esc(x.exemple_ci || "")}</div>${(x.voir_aussi || []).length ? `<p style="font-size:.9rem">Voir aussi : ${x.voir_aussi.map(v => `<a href="#savoirs-glossaire" data-gl="${slug(v)}">${esc(v)}</a>`).join(", ")}</p>` : ""}</details>`).join("")}</div>`; }
  if (tab === "quiz") body = `<div class="grid g3">${(C.quiz || []).map(q => `<a class="card" href="#quiz-${slug(q.id)}"><div class="meta"><span class="chip g">${esc(NIV[q.niveau] || q.niveau || "")}</span><span>${(q.questions || []).length} questions</span></div><h3>${esc(q.titre)}</h3></a>`).join("")}${COURSES.map(c => `<a class="card" href="#cours-${c.id}" data-tab="quiz"><div class="meta"><span class="chip">${esc(c.id)}</span><span>5 questions</span></div><h3 style="font-size:1.02rem">Quiz du cours : ${esc(c.titre)}</h3></a>`).join("")}</div>`;
  if (tab === "cas") body = `<div class="grid g2">${(C.etudes_cas || []).map(c => `<a class="card" href="#cas-${slug(c.id)}"><div class="meta"><span class="chip o">Étude de cas</span><span>${esc(c.lieu || "")}</span></div><h3>${esc(c.titre)}</h3><p>${esc((c.contexte || "").slice(0, 180))}…</p></a>`).join("")}</div>`;
  return head("Savoirs & apprentissage", "Apprendre la sociologie économique", seoIntro("savoirs") || "Fiches, parcours, glossaire interactif, quiz et études de cas ancrés dans les réalités ivoiriennes.") +
    `<section class="s"><div class="wrap"><div class="tabs" role="tablist">${tabs.map(([k, v]) => `<a class="tab ${k === tab ? "on" : ""}" role="tab" href="#savoirs-${k}">${v}</a>`).join("")}<a class="tab" href="#cours">Cours animés →</a></div>${body}</div></section>`;
};
AFTER.savoirs = () => {
  const f = $("#fNiv"); if (f) f.onchange = () => $$("#fichesList .card").forEach(c => c.style.display = !f.value || c.dataset.niv === f.value ? "" : "none");
  const g = $("#gSearch"); if (g) g.oninput = () => { const v = fold(g.value); $$("#gList .gl-item").forEach(d => d.style.display = d.dataset.t.includes(v) ? "" : "none"); };
  $$(".letters button").forEach(b => b.onclick = () => $$("#gList .gl-item").forEach(d => d.style.display = d.dataset.l === b.dataset.l ? "" : "none"));
  $$("[data-gl]").forEach(a => a.onclick = e => { e.preventDefault(); const d = $("#g-" + a.dataset.gl); if (d) { $$("#gList .gl-item").forEach(x => x.style.display = ""); d.open = true; d.scrollIntoView({ behavior: "smooth" }); } });
};
ROUTES.fiche = id => { const f = (C.fiches || []).find(x => slug(x.id) === id); if (!f) return notFound();
  return head(f.discipline || "Fiche de cours", f.titre, f.resume, `<a href="#savoirs">Savoirs</a> / Fiches`) + `<section class="s"><div class="wrap layout-2"><article class="article prose" style="margin:0">
   <div class="meta" style="margin-bottom:20px"><span class="chip g">${esc(NIV[f.niveau] || f.niveau)}</span><span class="chip">${esc(f.duree_min)} min</span><button class="btn btn-g btn-s" data-speak="fiche">Écouter la fiche</button></div>
   ${(f.sections || []).map(s => `<h3>${esc(s.titre)}</h3><p>${esc(s.texte)}</p>`).join("")}
   <div class="aside-box"><b>Points clés</b><ul>${(f.points_cles || []).map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>
   <h3>Pour aller plus loin</h3><ul>${(f.pour_aller_plus_loin || []).map(p => `<li>${esc(typeof p === "string" ? p : `${p.auteur || ""} (${p.annee || ""}). ${p.titre || ""}`)}</li>`).join("")}</ul></article><div>${adBox("article-lateral")}</div></div></section>`; };
AFTER.fiche = id => { const f = (C.fiches || []).find(x => slug(x.id) === id); const b = $("[data-speak]"); if (b) speakBtn(b, () => [f.titre, ...(f.sections || []).map(s => s.titre + ". " + s.texte)]); };
ROUTES.parcours = id => { const p = (C.parcours || []).find(x => slug(x.id) === id); if (!p) return ROUTES.savoirs("parcours");
  let done = []; try { done = JSON.parse(localStorage.getItem("lse-p-" + id) || "[]"); } catch {}
  return head("Parcours d'apprentissage", p.titre, `${p.public || ""} · ${p.duree || ""}`, `<a href="#savoirs-parcours">Parcours</a>`) + `<section class="s"><div class="wrap" style="max-width:860px">
  <div class="notice i" style="margin-bottom:20px">Progression : <b id="pProg">${done.length}/${(p.etapes || []).length}</b> étapes · badge à obtenir : <b>${esc(p.badge || "")}</b></div>
  ${(p.etapes || []).map((e, i) => `<div class="card" style="margin-bottom:14px;display:flex;gap:16px"><div class="av" style="background:${done.includes(i) ? "var(--green)" : "var(--blue-2)"}">${i + 1}</div><div style="flex:1"><h3 style="margin-top:4px">${esc(e.titre)}</h3><p><b>Contenu :</b> ${esc(e.contenu_lie || "")}</p><p><b>Activité :</b> ${esc(e.activite || "")}</p><label style="font-size:.9rem"><input type="checkbox" data-st="${i}" ${done.includes(i) ? "checked" : ""}> Étape terminée</label></div></div>`).join("")}</div></section>`; };
AFTER.parcours = id => $$("[data-st]").forEach(c => c.onchange = () => { let d = $$("[data-st]").filter(x => x.checked).map(x => +x.dataset.st); try { localStorage.setItem("lse-p-" + id, JSON.stringify(d)); } catch {} $("#pProg").textContent = d.length + "/" + $$("[data-st]").length; if (d.length === $$("[data-st]").length) toast("Parcours terminé : badge obtenu !"); });
ROUTES.cas = id => { const c = (C.etudes_cas || []).find(x => slug(x.id) === id); if (!c) return notFound();
  return head("Étude de cas · " + (c.lieu || ""), c.titre, c.contexte, `<a href="#savoirs-cas">Études de cas</a>`) + `<section class="s"><div class="wrap layout-2"><article class="article" style="margin:0">
   <div class="grid g2" style="margin-bottom:20px"><div class="aside-box" style="margin:0"><b>Acteurs</b><p>${esc(Array.isArray(c.acteurs) ? c.acteurs.join(", ") : c.acteurs)}</p></div><div class="aside-box" style="margin:0;background:var(--sand)"><b>Enjeux</b><p>${esc(Array.isArray(c.enjeux) ? c.enjeux.join(", ") : c.enjeux)}</p></div></div>
   <h3>Analyse</h3>${String(c.analyse || "").split(/\n+/).map(p => `<p>${esc(p)}</p>`).join("")}
   <h3>Questions pour le TD</h3><ol>${(c.questions || []).map(q => `<li>${esc(q)}</li>`).join("")}</ol>
   <h3>Sources</h3><ul>${(c.sources || []).map(s => `<li>${esc(typeof s === "string" ? s : JSON.stringify(s))}</li>`).join("")}</ul></article><div>${adBox("article-lateral")}</div></div></section>`; };
ROUTES.quiz = id => { const q = (C.quiz || []).find(x => slug(x.id) === id); if (!q) return notFound();
  return head("Quiz", q.titre, `${(q.questions || []).length} questions · niveau ${NIV[q.niveau] || q.niveau || ""}`, `<a href="#savoirs-quiz">Quiz</a>`) + `<section class="s"><div class="wrap" style="max-width:780px" id="quizBox"></div></section>`; };
AFTER.quiz = id => { const q = (C.quiz || []).find(x => slug(x.id) === id); if (q) quizPlayer($("#quizBox"), q.questions); };
function quizPlayer(box, qs) {
  let score = 0, answered = 0;
  box.innerHTML = qs.map((q, i) => `<div class="card" style="margin-bottom:16px"><div class="kicker">Question ${i + 1}/${qs.length}</div><h3 style="margin-top:6px">${esc(q.q)}</h3>${q.options.map((o, j) => `<button class="qopt" data-q="${i}" data-o="${j}">${"ABCD"[j]}. ${esc(o)}</button>`).join("")}<div class="expl" id="ex${i}" hidden></div></div>`).join("") + `<div class="card" id="qScore" hidden></div>`;
  $$(".qopt", box).forEach(b => b.onclick = () => {
    const i = +b.dataset.q, j = +b.dataset.o, q = qs[i]; const all = $$(`[data-q="${i}"]`, box); if (all.some(x => x.disabled)) return;
    all.forEach(x => { x.disabled = true; if (+x.dataset.o === q.bonne) x.classList.add("ok"); }); if (j !== q.bonne) b.classList.add("ko"); else score++;
    const ex = $("#ex" + i, box); ex.hidden = false; ex.innerHTML = `<b>${j === q.bonne ? "Bonne réponse." : "Pas tout à fait."}</b> ${esc(q.explication || "")}`;
    if (++answered === qs.length) { const s = $("#qScore", box); s.hidden = false; s.innerHTML = `<div class="kicker">Résultat</div><div class="score">${score}/${qs.length}</div><p>${score === qs.length ? "Excellent : notions maîtrisées." : score >= qs.length / 2 ? "Bonne base : relisez les explications des erreurs." : "À retravailler : reprenez la fiche ou la synthèse du cours."}</p><button class="btn btn-b btn-s" onclick="route(true)">Recommencer</button>`; s.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });
}

/* ---------------- COURS ANIMÉS ---------------- */
ROUTES.cours = code => {
  if (code) return courseView(code);
  const niveaux = [...new Set(COURSES.map(c => c.niveau))], themes = [...new Set(COURSES.map(c => c.theme_site).filter(Boolean))];
  return head("Cours animés", "Les cours de sociologie économique", "Des cours complets, du niveau débutant au niveau avancé, pour tous les étudiants et enseignants en sociologie : diaporama animé, vidéo courte, quiz pour les étudiants et espace enseignant pour l'évaluation formative.") +
  `<section class="s"><div class="wrap"><div class="filters"><select id="cNiv"><option value="">Tous les niveaux</option>${["Débutant", "Intermédiaire", "Avancé"].filter(n => niveaux.includes(n)).map(n => `<option>${n}</option>`).join("")}</select><select id="cPar"><option value="">Tous les thèmes</option>${themes.map(n => `<option value="${esc(n)}">${esc(THEMES[n] || n)}</option>`).join("")}</select></div>
  <div class="grid g4" id="cList">${COURSES.map(c => courseCard(c).replace('class="card"', `class="card" data-n="${esc(c.niveau)}" data-p="${esc(c.theme_site || "")}"`)).join("") || `<div class="empty">Les cours sont en cours de préparation.</div>`}</div></div></section>`;
};
AFTER.cours = code => {
  if (code) return courseAfter(code);
  const f = () => $$("#cList .card").forEach(c => c.style.display = (!$("#cNiv").value || c.dataset.n === $("#cNiv").value) && (!$("#cPar").value || c.dataset.p === $("#cPar").value) ? "" : "none");
  $("#cNiv").onchange = f; $("#cPar").onchange = f;
};
let CV = { i: 0, tab: "diapo" };
function deckSlides(c) {
  const sl = [{ type: "titre" }, { type: "objectifs" }, ...(c.slides || []), { type: "synthese" }];
  return sl;
}
function slideHTML(c, d, n, tot) {
  const A = (i) => `style="animation-delay:${(i * .14).toFixed(2)}s"`;
  let inner = "", dark = false, k = "";
  const li = arr => `<ul>${(arr || []).map((p, i) => `<li class="anim" ${A(i + 2)}>${esc(p)}</li>`).join("")}</ul>`;
  switch (d.type) {
    case "titre": dark = true; inner = `<span class="k anim">Sociologie économique · ${esc(c.niveau)}</span><h3 class="anim" ${A(1)} style="font-size:clamp(1.6rem,4vw,3rem);margin-top:auto">${esc(c.titre)}</h3><p class="anim" ${A(2)} style="color:#F77F00;font-style:italic;font-size:1.1em">${esc(c.accroche)}</p><p class="anim" ${A(3)} style="color:#C9D6E3;font-size:.85em;margin-top:auto">Ressource pédagogique libre · étudiants et enseignants en sociologie<br>Niveau : ${esc(c.niveau)}</p>`; break;
    case "objectifs": k = "Feuille de route"; inner = `<h3>Objectifs et plan</h3><div class="body cols c2"><div class="box anim" ${A(1)}><b>Vous saurez :</b>${li(c.objectifs)}</div><div>${(c.plan || []).map((p, i) => `<div class="box anim ${i === 0 ? "s" : ""}" ${A(i + 2)} style="margin-bottom:8px"><b>${["I", "II", "III", "IV"][i]}.</b> ${esc(p)}</div>`).join("")}</div></div>`; break;
    case "concept": k = "Concept"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c2"><div class="box b anim" ${A(1)}><p style="font-style:italic;font-size:1.08em">${esc(d.definition)}</p><b style="color:#F77F00">${esc(d.auteur || "")}</b></div><div>${li(d.points)}</div></div>`; break;
    case "auteurs": k = "Auteurs et courants"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c${Math.min(4, (d.items || []).length)}">${(d.items || []).map((x, i) => `<div class="box anim" ${A(i + 1)}><div class="big" style="font-size:1.6em">${esc(x.annee)}</div><b>${esc(x.auteur)}</b><p style="margin:.4em 0 0">${esc(x.idee)}</p></div>`).join("")}</div>`; break;
    case "cas_ci": k = "Côte d'Ivoire"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c2"><div><p class="anim" ${A(1)}>${esc(d.contexte)}</p><div class="box m anim" ${A(2)}><b style="color:#007A4B">Lecture sociologique</b>${li(d.analyse)}</div></div><div>${(d.chiffres || []).map((x, i) => `<div class="box ${i % 2 ? "s" : "b"} anim" ${A(i + 2)} style="margin-bottom:8px"><div class="big" style="font-size:2em">${esc(x.valeur)}</div><b>${esc(x.label)}</b><div class="src">Source : ${esc(x.source)}</div></div>`).join("")}</div></div>`; break;
    case "monde": k = "Regards croisés"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c3">${(d.exemples || []).map((x, i) => `<div class="box ${["", "m", "s"][i]} anim" ${A(i + 1)}><b style="font-size:1.1em">${esc(x.pays)}</b><p style="margin:.4em 0 0">${esc(x.texte)}</p></div>`).join("")}</div>`; break;
    case "comparaison": k = "Comparer"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c2">${[d.gauche, d.droite].map((x, i) => `<div class="box ${i ? "m" : ""} anim" ${A(i + 1)}><b style="font-size:1.1em">${esc(x.titre)}</b>${li(x.points)}</div>`).join("")}</div>`; break;
    case "processus": k = "Mécanisme"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c${Math.min(4, (d.etapes || []).length)}">${(d.etapes || []).map((x, i) => `<div class="box anim" ${A(i + 1)}><div class="big" style="font-size:1.5em">${String(i + 1).padStart(2, "0")}</div><b>${esc(x.titre)}</b><p style="margin:.3em 0 0">${esc(x.texte)}</p></div>`).join("")}</div>`; break;
    case "stat": k = "Chiffre clé"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c2"><div class="box b anim" ${A(1)}><div class="big">${esc(d.valeur)}</div><p style="font-weight:700;font-size:1.1em">${esc(d.label)}</p><div class="src">Source : ${esc(d.source)}</div></div><p class="anim" ${A(2)} style="font-size:1.1em">${esc(d.commentaire)}</p></div>`; break;
    case "citation": dark = true; k = "Pour réfléchir"; inner = `<h3 class="anim" ${A(1)} style="font-style:italic;margin-top:auto">« ${esc(d.texte)} »</h3><p class="anim" ${A(2)} style="color:#F77F00;font-weight:700;margin-bottom:auto">— ${esc(d.auteur)}</p>`; break;
    case "exercice": k = "À vous de jouer"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c2"><div class="box s anim" ${A(1)}><p style="font-size:1.05em">${esc(d.consigne)}</p></div><ol>${(d.etapes || []).map((x, i) => `<li class="anim" ${A(i + 2)}>${esc(x)}</li>`).join("")}</ol></div>`; break;
    case "graphique": k = "Données"; inner = `<h3>${esc(d.titre)}</h3><div class="body cols c2" style="grid-template-columns:1.5fr 1fr"><div class="box anim" ${A(1)} style="background:#fff;border:1px solid #E3E8EF;position:relative;min-height:220px"><canvas id="slChart" aria-label="${esc(d.titre)}"></canvas></div><div><p class="anim" ${A(2)} style="font-size:1.05em">${esc(d.lecture || "")}</p><div class="src anim" ${A(3)}>Source : ${d.url ? `<a href="${esc(d.url)}" rel="noopener">${esc(d.source)}</a>` : esc(d.source)}${d.unite ? " · unité : " + esc(d.unite) : ""}</div></div></div>`; break;
    case "schema": { k = "Schéma"; const N = d.noeuds || []; const cyc = d.kind === "cycle"; const pyr = d.kind === "pyramide";
      inner = `<h3>${esc(d.titre)}</h3><div class="body"><div class="schema sch-${esc(d.kind || "flux")}">${N.map((n, i) => `<div class="sch-n anim" ${A(i + 1)} style="${pyr ? `width:${40 + i * (60 / Math.max(1, N.length - 1))}%` : ""}"><b>${esc(n.label)}</b><span>${esc(n.texte)}</span></div>${!pyr && (i < N.length - 1 || cyc) ? `<div class="sch-a anim" ${A(i + 1.5)}>${cyc && i === N.length - 1 ? "↺" : "→"}</div>` : ""}`).join("")}</div><p class="anim" ${A(N.length + 1)} style="margin:0">${esc(d.lecture || "")}</p></div>`; break; }
    case "synthese": dark = true; k = "Synthèse"; inner = `<h3>Ce qu'il faut retenir</h3><div class="body cols c2"><div>${li((c.synthese || {}).points)}<div class="box anim" ${A(6)} style="background:#F77F00"><b>${esc((c.synthese || {}).a_retenir)}</b></div></div><div class="box anim" ${A(3)}><b style="color:#F77F00">Débat scientifique</b><p style="font-weight:700;font-style:italic">${esc((c.debat || {}).question)}</p>${li((c.debat || {}).pistes)}</div></div>`; break;
  }
  return { html: `<div class="sl">${k ? `<span class="k">${esc(k)}</span>` : ""}${inner}<div style="position:absolute;right:4%;bottom:3%;font-size:.7rem;opacity:.6">${n}/${tot}</div></div>`, dark };
}
function courseView(code) {
  const c = COURSES.find(x => x.id === code); if (!c) return notFound();
  const tabs = [["diapo", "Diaporama animé"], ["video", "Vidéo 5 min"], ["quiz", "Quiz étudiants"], ["enseignant", "Espace enseignant"], ["biblio", "Bibliographie"]];
  return `<div class="ph"><div class="wrap"><div class="crumb"><a href="#cours">Cours animés</a> / ${esc(c.niveau)}</div><div class="course-head"><div><div class="kicker">Sociologie économique · ${esc(THEMES[c.theme_site] || "")}</div><h1 style="font-size:clamp(1.7rem,4vw,2.6rem)">${esc(c.titre)}</h1><p>${esc(c.resume || "")}</p>
   <div class="meta" style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip g">Niveau : ${esc(c.niveau)}</span><span class="chip o">Ressource libre</span></div></div></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-o" id="dlPpt">Télécharger le PowerPoint animé</button></div></div></div></div>
   <section class="s" style="padding-top:28px"><div class="wrap"><div class="tabs">${tabs.map(([k, v]) => `<button class="tab ${CV.tab === k ? "on" : ""}" data-ct="${k}">${v}</button>`).join("")}</div><div id="cvBody"></div><div style="margin-top:28px">${adBox("cours-bas", true)}</div></div></section>`;
}
function courseAfter(code) {
  const c = COURSES.find(x => x.id === code); if (!c) return;
  $$("[data-ct]").forEach(b => b.onclick = () => { CV.tab = b.dataset.ct; $$("[data-ct]").forEach(x => x.classList.toggle("on", x === b)); renderCV(c); });
  $("#dlPpt").onclick = () => downloadPpt(c);
  renderCV(c);
}
function renderCV(c) {
  const box = $("#cvBody"); if (S.tts) try { S.tts.stop(); } catch {}
  if (CV.tab === "diapo") {
    const sl = deckSlides(c); CV.i = Math.min(CV.i, sl.length - 1);
    box.innerHTML = `<div class="viewer"><div class="stage" id="stage"></div><div class="ctrl"><button class="btn btn-g btn-s" id="pv" aria-label="Diapositive précédente">←</button><div class="prog"><i id="pg"></i></div><span id="pn" style="font-size:.85rem;color:var(--muted)"></span><button class="btn btn-b btn-s" id="nx" aria-label="Diapositive suivante">→</button>${S.tts ? `<button class="btn btn-o btn-s" id="say">Écouter l'explication</button>` : ""}<button class="btn btn-g btn-s" id="fs">Plein écran</button></div><div class="notes" id="nt"></div></div>`;
    const draw = () => { const d = sl[CV.i]; const r = slideHTML(c, d, CV.i + 1, sl.length); const st = $("#stage"); st.className = "stage" + (r.dark ? " dark" : ""); st.innerHTML = r.html; $("#pg").style.width = ((CV.i + 1) * 100 / sl.length) + "%"; $("#pn").textContent = `${CV.i + 1} / ${sl.length}`;
      const note = d.notes || (d.type === "titre" ? c.resume : d.type === "objectifs" ? "Les objectifs seront vérifiés par le quiz et l'évaluation formative." : d.type === "synthese" ? (c.synthese || {}).a_retenir : ""); $("#nt").innerHTML = note ? `<b>Explication de l'enseignant —</b> ${esc(note)}` : ""; CV.note = note; if (d.type === "graphique" && window.drawSlideChart) setTimeout(() => drawSlideChart(d), 120); };
    $("#pv").onclick = () => { CV.i = Math.max(0, CV.i - 1); draw(); }; $("#nx").onclick = () => { CV.i = Math.min(sl.length - 1, CV.i + 1); draw(); };
    $("#fs").onclick = () => { const v = $(".viewer"); (v.requestFullscreen ? v.requestFullscreen() : Promise.reject()).catch(() => toast("Plein écran indisponible ici")); };
    if ($("#say")) speakBtn($("#say"), () => [sl[CV.i].titre || c.titre, CV.note || ""]);
    box.onkeydown = null; document.onkeydown = e => { if (!$("#stage")) return document.onkeydown = null; if (e.key === "ArrowRight") $("#nx").click(); if (e.key === "ArrowLeft") $("#pv").click(); };
    draw();
  } else if (CV.tab === "video") {
    box.innerHTML = `<div class="grid g2" style="align-items:start"><div><div class="reel" style="background:#000"><video src="media/${c.id}.mp4" poster="media/${c.id}_cover.jpg" controls playsinline preload="none" style="width:100%;height:100%;object-fit:cover" aria-label="Vidéo du module ${esc(c.titre)}"></video></div><p style="text-align:center;font-size:.85rem;color:var(--muted);margin-top:8px">Version MP4 (Reel 9:16, ${S.dl ? "téléchargeable ci-dessous" : "prête pour les réseaux sociaux"})</p>${S.dl ? `<p style="text-align:center"><button class="btn btn-g btn-s" id="dlMp4">Télécharger la vidéo</button></p>` : ""}</div><div><div class="kicker">Version interactive</div><div id="reelBox" style="margin-top:10px"></div><div><div class="kicker">Format « 5 minutes pour comprendre »</div><h2>${esc((c.video || {}).titre || c.titre)}</h2><p style="color:var(--muted)">Une vidéo verticale animée, pensée pour le téléphone et les réseaux sociaux : une idée par écran, les mots-clés surlignés. ${S.tts ? "Activez la narration pour l'écouter." : ""}</p><p style="color:var(--muted);font-size:.9rem">Le fichier vidéo MP4 du module est également fourni à l'équipe pédagogique pour diffusion sur Instagram, TikTok, WhatsApp et Facebook.</p></div></div></div>`;
    const dm = $("#dlMp4"); if (dm) dm.onclick = async () => { try { const b = await (await fetch(`media/${c.id}.mp4`)).blob(); await S.dl.save({ filename: `${c.id}-5-minutes.mp4`, data: b }); } catch { toast("Téléchargement annulé ou indisponible."); } };
    reel($("#reelBox"), c.video || { scenes: [] }, true);
  } else if (CV.tab === "quiz") {
    box.innerHTML = `<div style="max-width:780px"><div class="notice i" style="margin-bottom:18px">Évaluation formative : répondez, lisez l'explication, puis comparez votre score aux objectifs du cours.</div><div id="cq"></div></div>`; quizPlayer($("#cq"), c.quiz_etudiant || []);
  } else if (CV.tab === "enseignant") {
    const E = c.eval_enseignant || {};
    box.innerHTML = `<div class="grid g2"><div class="card"><div class="kicker">À observer en séance</div><ul>${(E.verifier || []).map(v => `<li>${esc(v)}</li>`).join("")}</ul><div class="kicker" style="margin-top:16px">Questions réflexives</div><ul>${(E.questions_reflexives || []).map(v => `<li>${esc(v)}</li>`).join("")}</ul></div>
    <div class="card"><div class="kicker">Grille d'évaluation</div><table class="t"><thead><tr><th>Critère</th><th>Niveau attendu</th><th>Atteint ?</th></tr></thead><tbody>${(E.grille || []).map((g, i) => `<tr><td><b>${esc(g.critere)}</b></td><td>${esc(g.attendu)}</td><td><select aria-label="Niveau atteint" data-gr="${i}"><option>—</option><option>Non</option><option>Partiel</option><option>Oui</option></select></td></tr>`).join("")}</tbody></table></div>
    <div class="card" style="grid-column:1/-1;background:var(--sand)"><div class="kicker">Activité de TD / évaluation formative</div><p style="margin-top:8px">${esc(E.activite_td || "")}</p>
    <div class="kicker" style="margin-top:16px">Objectifs du cours</div><ul>${(c.objectifs || []).map(v => `<li>${esc(v)}</li>`).join("")}</ul>
    ${S.sample ? `<button class="btn btn-b btn-s" id="genTD">Générer un sujet de TD supplémentaire (agent pédagogique)</button><div class="out" id="tdOut" hidden></div>` : ""}</div></div>`;
    const g = $("#genTD"); if (g) g.onclick = async () => { const o = $("#tdOut"); o.hidden = false; o.textContent = "L'agent pédagogique rédige…"; g.disabled = true;
      try { const r = await S.sample(`Tu es l'agent pédagogique de la plateforme Sociologie de l'Économie, destinée à tous les étudiants et enseignants en sociologie. Rédige en français un sujet de TD d'évaluation formative (consigne, document support à chercher sur le terrain ivoirien, 3 questions graduées, barème sur 20, critères de réussite) pour le cours « ${c.titre} » (${c.niveau}), objectifs : ${(c.objectifs || []).join(" ; ")}. N'invente aucun chiffre : si une donnée est nécessaire, indique « à collecter » et la source à consulter. Texte brut, sans markdown.`, { modelTier: "default", onText: ({ text }) => { o.textContent = text; } }); o.textContent = r.text; } catch (e) { o.textContent = "Génération indisponible pour le moment."; } g.disabled = false; };
  } else {
    box.innerHTML = `<div class="card" style="max-width:900px"><div class="kicker">Références</div><ol>${(c.references || []).map(r => `<li style="margin-bottom:10px">${esc(r.auteur)} (${esc(r.annee)}). <i>${esc(r.titre)}</i>. ${esc(r.editeur || "")}<br>${oaLinks(r.titre + " " + String(r.auteur).split(/[ ,]/)[0])}</li>`).join("")}</ol><div class="notice i" style="margin-top:14px">Les liens lancent une recherche dans des moteurs académiques ouverts ; privilégiez les versions en libre accès (HAL, OpenEdition, Persée, CODESRIA, AJOL). Voir aussi la <a href="#bibliotheque">Bibliothèque ouverte</a>.</div></div>`;
  }
}
async function downloadPpt(c) {
  if (!S.dl) return toast("Téléchargement indisponible dans cette vue : demandez le fichier à l'équipe pédagogique.");
  toast("Préparation du PowerPoint…");
  try { const j = await getJSON(`data/ppt/${c.id}.json`, null); if (!j) throw 0; const bin = Uint8Array.from(atob(j.b64), ch => ch.charCodeAt(0));
    await S.dl.save({ filename: `${slug(c.titre)}.pptx`, data: new Blob([bin], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }) });
  } catch { toast("Téléchargement annulé ou indisponible."); }
}

/* ---------------- lecteur vidéo (Reel 9:16) ---------------- */
function reel(box, v, withVoice) {
  const sc = v.scenes || []; if (!sc.length) { box.innerHTML = `<div class="empty">Vidéo en préparation.</div>`; return; }
  box.innerHTML = `<div class="reel" tabindex="0" aria-label="Vidéo animée : ${esc(v.titre || "")}"><div class="bar">${sc.map(() => `<i><b></b></i>`).join("")}</div><div id="rs"></div></div><div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap"><button class="btn btn-b btn-s" data-r="play">Lire</button>${withVoice && S.tts ? `<button class="btn btn-o btn-s" data-r="voice">Narration : non</button>` : ""}</div>`;
  let i = 0, timer = null, voice = false, playing = false;
  const words = t => mk(t).split(/(\s+)/).map((w, k) => /^\s+$/.test(w) ? w : `<span class="w" style="animation-delay:${(k * .05).toFixed(2)}s">${w}</span>`).join("");
  const plain = s => [s.tag, s.texte, s.valeur, s.label, s.titre, ...(s.items || []), s.gauche, s.droite, s.sous].filter(Boolean).join(". ").replace(/\*/g, "");
  const show = () => {
    const s = sc[i]; const cls = { question: "", motcle: "light", stat: "", etapes: "light", compare: "light", retenir: "night" }[s.type] || "";
    let h = "";
    if (s.type === "question") h = `<span class="tg">Question</span><div class="tt">${words(s.texte)}</div>`;
    else if (s.type === "motcle") h = `<span class="tg">${esc(s.tag || "Notion")}</span><div class="tt">${words(s.texte)}</div>${s.sous ? `<p class="w" style="animation-delay:.6s">${esc(s.sous)}</p>` : ""}`;
    else if (s.type === "stat") h = `<span class="tg">Chiffre clé</span><div class="bigv w">${esc(s.valeur)}</div><div class="tt" style="font-size:1.4rem">${words(s.label)}</div><small class="w" style="animation-delay:.8s;opacity:.8">Source : ${esc(s.source || "")}</small>`;
    else if (s.type === "etapes") h = `<span class="tg">${esc(s.titre || "Étapes")}</span>${(s.items || []).map((x, k) => `<div class="step w" style="animation-delay:${(.3 + k * .35).toFixed(2)}s"><span>0${k + 1}</span>${mk(x)}</div>`).join("")}`;
    else if (s.type === "compare") h = `<span class="tg">${esc(s.titre || "Comparer")}</span><div class="step w"><span style="background:#C2410C">✕</span>${mk(s.gauche)}</div><div class="step w" style="animation-delay:.5s"><span style="background:#009E60">✓</span>${mk(s.droite)}</div>`;
    else h = `<span class="tg">À retenir</span><div class="tt">${words(s.texte)}</div>`;
    $("#rs", box).innerHTML = `<div class="sc ${cls}">${h}</div>`;
    $$(".bar b", box).forEach((b, k) => { b.style.transition = "none"; b.style.width = k < i ? "100%" : "0"; });
    const cur = $$(".bar b", box)[i]; requestAnimationFrame(() => { cur.style.transition = `width ${dur(s)}ms linear`; cur.style.width = playing ? "100%" : "0"; });
    if (voice && S.tts) S.tts.speak(plain(s), { language: "fr" }).catch(() => {});
  };
  const dur = s => Math.max(3800, plain(s).length * 70);
  const next = () => { clearTimeout(timer); if (!playing) return; timer = setTimeout(() => { if (i < sc.length - 1) { i++; show(); next(); } else { playing = false; $("[data-r=play]", box.parentNode).textContent = "Revoir"; } }, dur(sc[i])); };
  $("[data-r=play]", box).onclick = e => { if (playing) { playing = false; clearTimeout(timer); e.target.textContent = "Reprendre"; if (S.tts) try { S.tts.stop(); } catch {} return; } if (i >= sc.length - 1 && e.target.textContent === "Revoir") i = 0; playing = true; e.target.textContent = "Pause"; show(); next(); };
  const vb = $("[data-r=voice]", box); if (vb) vb.onclick = () => { voice = !voice; vb.textContent = "Narration : " + (voice ? "oui" : "non"); };
  show();
}
function speakBtn(btn, getText) {
  if (!S.tts) { btn.style.display = "none"; return; }
  let on = false;
  btn.onclick = async () => { if (on) { try { S.tts.stop(); } catch {} return; } on = true; const old = btn.textContent; btn.textContent = "Arrêter la lecture";
    try { await S.tts.speak(getText().filter(Boolean).map(t => ({ text: String(t).slice(0, 1900), language: "fr" }))); } catch {} on = false; btn.textContent = old; };
}

/* ---------------- RECHERCHE & PUBLICATIONS ---------------- */
function allPubs() {
  const a = (C.articles || []).map(x => ({ id: "article-" + slug(x.id), titre: x.titre, chapo: x.chapo, theme: x.theme, region: x.region, type: x.type || "Article de fond", annee: (x.date || "2026").slice(0, 4), auteur: x.auteur }));
  const c = (C.etudes_cas || []).map(x => ({ id: "cas-" + slug(x.id), titre: x.titre, chapo: (x.contexte || "").slice(0, 160), theme: x.theme || "", region: x.lieu, type: "Étude de cas", annee: "2026", auteur: "Rédaction" }));
  const p = S.published.filter(x => x.status === "publie").map(x => ({ id: "publication-" + x._id, titre: x.titre, chapo: x.chapo || x.resume, theme: x.theme, region: x.region, type: x.type || "Contribution", annee: (x.date || "2026").slice(0, 4), auteur: x.auteur }));
  return [...p, ...a, ...c];
}
ROUTES.recherche = th => {
  const P = allPubs(); const types = [...new Set(P.map(x => x.type))], regions = [...new Set(P.map(x => x.region).filter(Boolean))], years = [...new Set(P.map(x => x.annee))];
  return head("Recherche & publications", "Articles, études, notes et contributions", seoIntro("recherche") || "Filtrez par thème, région, type de document et année.") + `<section class="s"><div class="wrap">
  <div class="filters"><input id="rQ" placeholder="Mots-clés…" aria-label="Mots-clés"><select id="rT"><option value="">Tous thèmes</option>${Object.entries(THEMES).map(([k, v]) => `<option value="${k}" ${k === th ? "selected" : ""}>${v}</option>`).join("")}</select><select id="rTy"><option value="">Tous types</option>${types.map(t => `<option>${esc(t)}</option>`).join("")}</select><select id="rR"><option value="">Toutes régions</option>${regions.map(t => `<option>${esc(t)}</option>`).join("")}</select><select id="rY"><option value="">Toutes années</option>${years.map(t => `<option>${esc(t)}</option>`).join("")}</select><select disabled aria-label="Langue"><option>Français</option></select></div>
  <div class="layout-2"><div id="rList"></div><div>${adBox("article-lateral")}<div class="card" style="margin-top:20px"><div class="kicker">Publier</div><h3>Déposez votre travail</h3><p>Résumés, prépublications, posters, communications : relecture par les pairs avant publication.</p><a class="btn btn-o btn-s" href="#contribuer">Soumettre</a></div></div></div></div></section>`;
};
AFTER.recherche = () => {
  const P = allPubs();
  const f = () => { const q = fold($("#rQ").value), t = $("#rT").value, ty = $("#rTy").value, r = $("#rR").value, y = $("#rY").value;
    const L = P.filter(x => (!q || fold(x.titre + " " + x.chapo).includes(q)) && (!t || x.theme === t) && (!ty || x.type === ty) && (!r || x.region === r) && (!y || x.annee === y));
    $("#rList").innerHTML = L.map(x => `<a class="card" style="margin-bottom:14px" href="#${x.id}"><div class="meta"><span class="chip">${esc(x.type)}</span><span class="chip o">${esc(THEMES[x.theme] || x.theme || "")}</span><span>${esc(x.region || "")}</span><span>${esc(x.annee)}</span></div><h3>${esc(x.titre)}</h3><p>${esc(x.chapo || "")}</p></a>`).join("") || `<div class="empty">Aucun résultat avec ces filtres.</div>`; };
  $$("#rQ,#rT,#rTy,#rR,#rY").forEach(e => e.oninput = f); f();
};
function citeBlock(a, id) {
  const y = (a.date || "2026").slice(0, 4), au = a.auteur || "Rédaction LSE", key = slug(au.split(/\s/)[0]) + y + slug(a.titre).split("-").slice(0, 2).join("");
  const apa = `${au} (${y}). ${a.titre}. Sociologie de l'Économie. Identifiant : LSE-${id}.`;
  const bib = `@article{${key},\n  author = {${au}},\n  title = {${a.titre}},\n  journal = {Sociologie de l'Économie},\n  year = {${y}},\n  note = {Identifiant LSE-${id}}\n}`;
  return `<div class="card" style="margin-top:30px"><div class="kicker">Citer ce document</div><p style="margin-top:8px">${esc(apa)}</p><div class="cite" id="bib">${esc(bib)}</div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn btn-g btn-s" data-copy="apa">Copier la référence</button><button class="btn btn-g btn-s" data-copy="bib">Copier le BibTeX</button>${S.dl ? `<button class="btn btn-g btn-s" data-dlbib>Exporter .bib</button>` : ""}</div><textarea hidden id="apaT">${esc(apa)}</textarea><textarea hidden id="bibT">${esc(bib)}</textarea></div>`;
}
function commentsBlock(target) {
  const L = S.comments.filter(c => c.target === target && (c.status === "approuve" || (S.canEdit && c.status !== "rejete")));
  return `<div class="card" style="margin-top:24px"><div class="kicker">Discussion</div><h3>Commentaires (${L.filter(c => c.status === "approuve").length})</h3>
  ${L.map(c => `<div class="post"><div style="display:flex;gap:10px;align-items:center"><div class="av">${esc((c.nom || "?")[0])}</div><div><span class="who">${esc(c.nom)}</span> <small style="color:var(--muted)">${esc(c.profil || "")} · ${new Date(c.at).toLocaleDateString("fr-FR")}</small> ${c.status !== "approuve" ? `<span class="status pending">en attente de modération</span>` : ""}</div></div><p style="margin:8px 0 0">${esc(c.texte)}</p></div>`).join("") || `<p style="color:var(--muted)">Soyez la première personne à réagir.</p>`}
  ${canPost() ? `<form id="cmForm" style="margin-top:16px"><div class="grid g2"><div class="field"><label for="cmN">Nom affiché</label><input id="cmN" required maxlength="60"></div><div class="field"><label for="cmP">Profil</label><select id="cmP">${["Étudiant·e", "Chercheur·e", "Enseignant·e", "Journaliste", "Entrepreneur·e", "Décideur·e", "ONG", "Citoyen·ne"].map(p => `<option>${p}</option>`).join("")}</select></div></div><div class="field"><label for="cmT">Votre commentaire</label><textarea id="cmT" required maxlength="2000"></textarea></div><p style="font-size:.82rem;color:var(--muted)">Les commentaires sont publiés après modération, selon la <a href="#chartes">charte de modération</a>.</p><button class="btn btn-b btn-s">Envoyer</button></form>` : `<div class="notice" style="margin-top:12px">Les commentaires sont ouverts aux membres connectés avec un accès contributeur.</div>`}</div>`;
}
function wireComments(target) {
  const f = $("#cmForm"); if (f) f.onsubmit = async e => { e.preventDefault();
    try { await S.db.collection("comments").add({ target, nom: $("#cmN").value.trim(), profil: $("#cmP").value, texte: $("#cmT").value.trim(), status: S.canEdit ? "approuve" : "en_attente", by: S.uid || "", at: Date.now() }); toast("Merci ! Votre commentaire est en attente de modération."); f.reset(); } catch { toast("Envoi impossible pour ce compte."); } };
  $$("[data-copy]").forEach(b => b.onclick = () => copy($(b.dataset.copy === "apa" ? "#apaT" : "#bibT").value));
  const d = $("[data-dlbib]"); if (d) d.onclick = () => S.dl.save({ filename: "reference.bib", data: new Blob([$("#bibT").value], { type: "text/plain" }) }).catch(() => {});
}
ROUTES.article = id => { const a = (C.articles || []).find(x => slug(x.id) === id); if (!a) return notFound();
  return head(THEMES[a.theme] || a.theme || "Article de fond", a.titre, "", `<a href="#recherche">Recherche</a> / ${esc(a.type || "Article de fond")}`) + `<section class="s"><div class="wrap layout-2"><article class="article" style="margin:0">
  <p class="chapo">${esc(a.chapo)}</p><div class="meta" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px"><span class="chip">${esc(a.auteur || "Rédaction")}</span><span class="chip o">${esc(a.region || "")}</span><span class="chip g">${esc(a.temps_lecture || "")}</span><button class="btn btn-g btn-s" data-speak>Écouter l'article</button></div>
  ${(a.corps || []).map(p => `<p>${esc(p)}</p>`).join("")}
  ${a.infographie ? `<div class="aside-box"><b>Infographie à venir —</b> ${esc(a.infographie)}</div>` : ""}
  <h3>Sources</h3><ul>${(a.sources || []).map(s => `<li>${esc(typeof s === "string" ? s : [s.auteur, s.annee && `(${s.annee})`, s.titre].filter(Boolean).join(" "))}</li>`).join("")}</ul>
  <div class="meta" style="display:flex;gap:6px;flex-wrap:wrap">${(a.mots_cles || []).map(m => `<span class="chip">#${esc(m)}</span>`).join("")}</div>
  ${a.appel_contribution ? `<div class="notice" style="margin-top:20px"><b>Appel à contribution —</b> ${esc(a.appel_contribution)} <a href="#contribuer">Proposer un texte →</a></div>` : ""}
  ${citeBlock(a, "A-" + id.toUpperCase().slice(0, 12))}${commentsBlock("article-" + id)}</article><div>${adBox("article-lateral")}<div style="height:20px"></div>${adBox("article-lateral")}</div></div></section>`; };
AFTER.article = id => { const a = (C.articles || []).find(x => slug(x.id) === id); if (!a) return; wireComments("article-" + id); const b = $("[data-speak]"); if (b) speakBtn(b, () => [a.titre, a.chapo, ...(a.corps || [])]); };
ROUTES.publication = id => { const a = S.published.find(x => x._id === id); if (!a) return S.db ? `<div class="wrap" style="padding:60px 20px">Chargement…</div>` : notFound();
  return head(a.type || "Contribution", a.titre, "", `<a href="#recherche">Recherche</a>`) + `<section class="s"><div class="wrap layout-2"><article class="article" style="margin:0"><p class="chapo">${esc(a.chapo || a.resume || "")}</p><div class="meta" style="margin-bottom:16px"><span class="chip">${esc(a.auteur || "")}</span><span class="chip o">${esc(a.region || "")}</span><span class="chip g">Relu et validé par l'équipe éditoriale</span></div>${(a.corps || []).map(p => `<p>${esc(p)}</p>`).join("")}${(a.sources || []).length ? `<h3>Sources</h3><ul>${a.sources.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}${citeBlock(a, "P-" + id.slice(0, 8))}${commentsBlock("publication-" + id)}</article><div>${adBox("article-lateral")}</div></div></section>`; };
AFTER.publication = id => wireComments("publication-" + id);

/* ---------------- OBSERVATOIRE ---------------- */
ROUTES.observatoire = () => {
  if (!OBS) return head("Données & observatoire", "Observatoire", "Les données sont en cours de chargement.");
  const D = OBS.districts || {};
  return head("Données & observatoire", "L'économie ivoirienne en données ouvertes", seoIntro("donnees") || "Séries temporelles, carte des districts et données téléchargeables, avec sources et méthodologie.") + `<section class="s"><div class="wrap">
  <div class="grid g2" style="align-items:start"><div class="card"><div class="sh" style="margin-bottom:8px"><div><div class="kicker">Séries temporelles</div><h3 id="sTitle" style="margin:4px 0"></h3></div><select id="sSel" aria-label="Choisir une série">${(OBS.series || []).map((s, i) => `<option value="${i}">${esc(s.titre)}</option>`).join("")}</select></div><div class="chart-box"><canvas id="chart" aria-label="Graphique de la série"></canvas></div><p id="sMeta" style="font-size:.85rem;color:var(--muted);margin-top:12px"></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-g btn-s" id="csv">Copier en CSV</button>${S.dl ? `<button class="btn btn-g btn-s" id="csvDl">Télécharger le CSV</button>` : ""}</div></div>
  <div class="card map"><div class="kicker">Carte interactive</div><h3 style="margin:4px 0 10px">${esc(D.indicateur || "Districts")}</h3><select id="mSel" aria-label="Indicateur de la carte" style="margin-bottom:10px;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card)"><option value="-1">${esc(D.indicateur || "")}</option>${(D.autres_indicateurs || []).map((x, i) => `<option value="${i}">${esc(x.indicateur)}</option>`).join("")}</select><div id="mapBox"></div><div class="legend" style="margin-top:8px"><span>faible</span><i></i><span>élevé</span></div><p id="mSrc" style="font-size:.8rem;color:var(--muted);margin-top:8px"></p><div id="mInfo" class="notice i" style="margin-top:8px">Survolez ou touchez un district.</div></div></div>
  <h2 style="margin-top:50px">Data stories</h2><div class="grid g2">${(OBS.data_stories || []).map(d => `<div class="card"><div class="kicker">Data story</div><h3>${esc(d.titre)}</h3><p style="color:var(--text)">${esc(d.texte)}</p></div>`).join("")}</div>
  <h2 style="margin-top:50px">Catalogue des jeux de données</h2><div class="card" style="overflow:auto"><table class="t"><thead><tr><th>Série</th><th>Thème</th><th>Période</th><th>Source</th><th>Méthodologie</th></tr></thead><tbody>${(OBS.series || []).map(s => { const p = (s.points || []).filter(x => x.valeur != null); return `<tr><td><b>${esc(s.titre)}</b><br><small>${esc(s.unite)}</small></td><td>${esc(s.theme)}</td><td>${p.length ? p[0].annee + "–" + p[p.length - 1].annee : ""}</td><td>${s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.source)}</a>` : esc(s.source)}</td><td style="font-size:.85rem">${esc(s.methodologie || "")} ${s.note ? `<i>${esc(s.note)}</i>` : ""}</td></tr>`; }).join("")}</tbody></table><p style="font-size:.8rem;color:var(--muted)">Dernière mise à jour : ${esc(OBS.maj || "")}. Les données restent la propriété de leurs producteurs ; citez toujours la source d'origine.</p></div>
  </div></section>`;
};
let chart;
AFTER.observatoire = () => {
  if (!OBS) return;
  const draw = () => { const s = OBS.series[+$("#sSel").value]; const p = (s.points || []).filter(x => x.valeur != null); $("#sTitle").textContent = `${s.titre} (${s.unite})`;
    $("#sMeta").innerHTML = `Source : ${s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.source)}</a>` : esc(s.source)}. ${esc(s.methodologie || "")} ${s.note ? esc(s.note) : ""}`;
    if (!window.Chart) { $(".chart-box").innerHTML = `<table class="t">${p.map(x => `<tr><td>${x.annee}</td><td>${fmt(x.valeur)}</td></tr>`).join("")}</table>`; return; }
    const dark = document.documentElement.dataset.theme === "dark"; if (chart) chart.destroy();
    chart = new Chart($("#chart"), { type: p.length > 6 ? "line" : "bar", data: { labels: p.map(x => x.annee), datasets: [{ label: s.titre, data: p.map(x => x.valeur), borderColor: "#F77F00", backgroundColor: p.length > 6 ? "rgba(247,127,0,.15)" : "#0E2A47", fill: true, tension: .3, pointRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: dark ? "#9AA8B8" : "#5B6472" }, grid: { display: false } }, y: { ticks: { color: dark ? "#9AA8B8" : "#5B6472" }, grid: { color: dark ? "#22344D" : "#E3E8EF" } } } } });
    CSV = "annee;valeur\n" + p.map(x => `${x.annee};${x.valeur}`).join("\n"); };
  let CSV = ""; $("#sSel").onchange = draw; draw();
  $("#csv").onclick = () => copy(CSV); const dl = $("#csvDl"); if (dl) dl.onclick = () => S.dl.save({ filename: slug($("#sTitle").textContent) + ".csv", data: new Blob([CSV], { type: "text/csv" }) }).catch(() => {});
  const D = OBS.districts || {};
  const drawMap = () => { const k = +$("#mSel").value; const I = k < 0 ? D : D.autres_indicateurs[k]; const vals = I.valeurs || {};
    $("#mapBox").innerHTML = mapSVG("", vals); $("#mSrc").innerHTML = `Source : ${I.url ? `<a href="${esc(I.url)}" rel="noopener">${esc(I.source)}</a>` : esc(I.source || "")}${I.annee ? ", " + esc(I.annee) : ""}`;
    $$("#mapBox path").forEach(p => { const show = () => $("#mInfo").innerHTML = `<b>${esc(p.dataset.d)}</b> : ${vals[p.dataset.d] != null ? fmt(vals[p.dataset.d]) + " " + esc(I.unite || "") : "donnée non disponible"}`; p.onmouseenter = show; p.onclick = show; }); };
  $("#mSel").onchange = drawMap; drawMap();
};

/* ---------------- COMMUNAUTÉ ---------------- */
ROUTES.communaute = () => {
  const posts = S.forum.filter(p => p.status !== "rejete" && (p.status === "approuve" || S.canEdit || p.by === S.uid));
  return head("Communauté & interaction", "Débattre, questionner, coopérer", seoIntro("communaute") || "Forums modérés, questions-réponses, groupes thématiques et événements.") + `<section class="s"><div class="wrap layout-2"><div>
  <div class="sh"><div><div class="kicker">Questions-réponses & forum</div><h2>Le fil de la communauté</h2></div></div>
  ${canPost() ? `<form id="fmForm" class="card" style="margin-bottom:20px"><div class="grid g2"><div class="field"><label for="fmN">Nom affiché</label><input id="fmN" required maxlength="60"></div><div class="field"><label for="fmG">Groupe</label><select id="fmG">${GROUPES.map(g => `<option>${g}</option>`).join("")}</select></div></div><div class="field"><label for="fmT">Question ou sujet de discussion</label><textarea id="fmT" required maxlength="3000" placeholder="Ex. : Quelles sources pour étudier les tontines en milieu urbain ?"></textarea></div><button class="btn btn-b btn-s">Publier (après modération)</button></form>` : `<div class="notice" style="margin-bottom:20px">La participation est ouverte aux membres connectés avec un accès contributeur. Lisez la <a href="#chartes">charte de modération</a>.</div>`}
  <div id="fmList">${posts.map(p => `<div class="post"><div style="display:flex;gap:10px;align-items:center"><div class="av" style="background:var(--blue-2)">${esc((p.nom || "?")[0])}</div><div><span class="who">${esc(p.nom)}</span> <span class="chip">${esc(p.groupe)}</span> <small style="color:var(--muted)">${new Date(p.at).toLocaleDateString("fr-FR")}</small> ${p.status !== "approuve" ? `<span class="status pending">en modération</span>` : ""}</div></div><p style="margin:8px 0 0">${esc(p.texte)}</p>${(p.reponses || []).map(r => `<div style="margin:10px 0 0 46px;padding-left:12px;border-left:3px solid var(--orange)"><b>${esc(r.nom)}</b> — ${esc(r.texte)}</div>`).join("")}${canPost() && p.status === "approuve" ? `<details style="margin:8px 0 0 46px"><summary style="cursor:pointer;color:var(--blue-3);font-size:.9rem">Répondre</summary><form data-rep="${esc(p._id)}" style="margin-top:8px"><input placeholder="Nom" required maxlength="60" style="padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--card);margin-bottom:6px;width:100%"><textarea required maxlength="1500" style="width:100%;padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--card)"></textarea><button class="btn btn-g btn-s">Répondre</button></form></details>` : ""}</div>`).join("") || `<div class="empty">Aucune discussion pour l'instant : lancez la première !</div>`}</div></div>
  <div><div class="card"><div class="kicker">Groupes thématiques</div><div class="badge-row" style="margin-top:10px">${GROUPES.map(g => `<span class="chip">${g}</span>`).join("")}</div></div>
  <div class="card" style="margin-top:20px"><div class="kicker">Profils</div><p>Étudiant·e, chercheur·e, enseignant·e, journaliste, entrepreneur·e, décideur·e, ONG, citoyen·ne : chacun suit ses auteurs et thèmes favoris.</p><div class="kicker" style="margin-top:12px">Badges</div><div class="badge-row" style="margin-top:8px">${["Auteur", "Réviseur", "Expert", "Modérateur", "Contributeur de données"].map(b => `<span class="chip o">${b}</span>`).join("")}</div></div>
  <div class="card" style="margin-top:20px"><div class="kicker">Événements</div>${(C.evenements || []).map(e => `<p style="margin:10px 0 0"><b>${esc(e.titre)}</b><br><small style="color:var(--muted)">${esc(e.date || "")} · ${esc(e.lieu || "")}${e.exemple ? " · exemple" : ""}</small></p>`).join("")}</div>
  <div style="margin-top:20px">${adBox("article-lateral")}</div></div></div></section>`;
};
AFTER.communaute = () => {
  const f = $("#fmForm"); if (f) f.onsubmit = async e => { e.preventDefault(); try { await S.db.collection("forum").add({ nom: $("#fmN").value.trim(), groupe: $("#fmG").value, texte: $("#fmT").value.trim(), status: S.canEdit ? "approuve" : "en_attente", by: S.uid || "", at: Date.now(), reponses: [] }); f.reset(); toast("Publié : visible après modération."); } catch { toast("Publication impossible pour ce compte."); } };
  $$("[data-rep]").forEach(fr => fr.onsubmit = async e => { e.preventDefault(); const p = S.forum.find(x => x._id === fr.dataset.rep); const [n, t] = [$("input", fr).value.trim(), $("textarea", fr).value.trim()];
    try { await S.db.doc("forum/" + p._id).update({ reponses: [...(p.reponses || []), { nom: n, texte: t, at: Date.now() }] }); toast("Réponse publiée"); } catch { toast("Réponse impossible pour ce compte."); } });
};

/* ---------------- CONTRIBUER ---------------- */
ROUTES.contribuer = () => head("Espace contributeurs", "Publier une contribution", seoIntro("contribuer") || "Articles, études, données, questions ou propositions d'événements : chaque contribution suit un circuit éditorial transparent.") + `<section class="s"><div class="wrap layout-2"><div>
  <div class="grid g4" style="margin-bottom:26px">${["Soumission", "Vérification", "Relecture par les pairs", "Publication"].map((t, i) => `<div class="stat" style="padding:16px"><b style="font-size:1.6rem">0${i + 1}</b><span>${t}</span></div>`).join("")}</div>
  ${canPost() ? `<form class="card" id="sbForm"><div class="grid g2"><div class="field"><label for="sbTy">Type de contribution</label><select id="sbTy">${["Article", "Working paper", "Note de synthèse", "Tribune", "Résumé / prépublication", "Poster / communication", "Jeu de données", "Question de recherche", "Proposition d'événement"].map(t => `<option>${t}</option>`).join("")}</select></div><div class="field"><label for="sbTh">Thème</label><select id="sbTh">${Object.entries(THEMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div></div>
  <div class="field"><label for="sbTi">Titre</label><input id="sbTi" required maxlength="180"></div><div class="field"><label for="sbRe">Résumé (250 mots maximum)</label><textarea id="sbRe" required maxlength="2200"></textarea></div><div class="field"><label for="sbCo">Texte ou lien vers le document</label><textarea id="sbCo" maxlength="20000" placeholder="Collez le texte, ou indiquez où l'équipe peut récupérer le fichier."></textarea></div>
  <div class="grid g2"><div class="field"><label for="sbAu">Auteur·e(s)</label><input id="sbAu" required maxlength="200"></div><div class="field"><label for="sbAf">Affiliation</label><input id="sbAf" maxlength="200" placeholder="Ex. : université, laboratoire, institution"></div></div><div class="grid g2"><div class="field"><label for="sbRg">Région / district concerné</label><input id="sbRg" maxlength="80"></div><div class="field"><label for="sbMl">E-mail de contact</label><input id="sbMl" type="email" required></div></div>
  <label style="font-size:.88rem;display:flex;gap:8px"><input type="checkbox" required> Je certifie que ce travail est original, que ses sources sont citées et j'accepte la <a href="#chartes">charte scientifique et éthique</a>.</label><button class="btn btn-o" style="margin-top:14px">Soumettre au comité éditorial</button></form>` : `<div class="notice">Le dépôt est ouvert aux membres connectés avec un accès contributeur. Sans compte, écrivez au comité éditorial (adresse en page À propos).</div>`}</div>
  <div><div class="card"><div class="kicker">Rôles</div><table class="t" style="margin-top:8px"><tr><td><b>Visiteur</b></td><td>lit, cherche, utilise l'assistant</td></tr><tr><td><b>Membre</b></td><td>commente, vote, participe aux forums</td></tr><tr><td><b>Auteur</b></td><td>soumet des contributions</td></tr><tr><td><b>Éditeur</b></td><td>vérifie, organise la relecture, publie</td></tr><tr><td><b>Modérateur</b></td><td>valide commentaires et discussions</td></tr><tr><td><b>Administrateur</b></td><td>rôles, partenaires, agents</td></tr></table></div>
  <div class="card" style="margin-top:20px"><div class="kicker">Charte scientifique</div><p>Rigueur, sources vérifiables, transparence des méthodes, respect, non-discrimination, protection des données et absence de plagiat.</p><a href="#chartes">Lire les chartes →</a></div></div></div></section>`;
AFTER.contribuer = () => { const f = $("#sbForm"); if (f) f.onsubmit = async e => { e.preventDefault();
  if (!S.uid) return toast("Connectez-vous pour soumettre."); try { const ref = S.db.doc("submissions/" + S.uid); const g = await ref.get(); const items = (g.exists && g.data().items) || []; await ref.set({ items: [...items, { type: $("#sbTy").value, theme: $("#sbTh").value, titre: $("#sbTi").value.trim(), resume: $("#sbRe").value.trim(), contenu: $("#sbCo").value.trim(), auteur: $("#sbAu").value.trim(), affiliation: $("#sbAf").value.trim(), region: $("#sbRg").value.trim(), email: $("#sbMl").value.trim(), status: "soumis", by: S.uid || "", at: Date.now() }] }); f.reset(); toast("Contribution reçue : le comité éditorial vous répondra."); } catch { toast("Envoi impossible pour ce compte."); } }; };

/* ---------------- MÉDIAS ---------------- */
ROUTES.medias = () => head("Médias & vulgarisation", "Podcasts, vidéos et formats courts", seoIntro("medias") || "Interviews, « 5 minutes pour comprendre », infographies et contenus pour les réseaux sociaux.") + `<section class="s"><div class="wrap">
  <h2>« 5 minutes pour comprendre » — les vidéos des cours</h2><div class="grid g4" style="margin-bottom:50px">${COURSES.filter(c => c.video).map(c => `<a class="card" href="#cours-${c.id}" data-vid="${c.id}"><div class="meta"><span class="chip o">Vidéo 9:16</span><span>${esc(c.id)}</span></div><h3 style="font-size:1.05rem">${esc(c.video.titre)}</h3><p style="font-size:.88rem">${esc(c.titre)}</p></a>`).join("")}</div>
  <h2>Programmation éditoriale</h2><div class="grid g3">${(C.medias || []).map(m => `<div class="card"><div class="meta"><span class="chip ${/podcast/i.test(m.format) ? "" : "o"}">${esc(m.format)}</span><span>${esc(m.duree || "")}</span></div><h3>${esc(m.titre)}</h3><p>${esc(m.pitch)}</p><p style="font-size:.85rem"><b>Invité·e :</b> ${esc(m.invite_type || "")}<br><b>Diffusion :</b> ${esc(Array.isArray(m.plateformes) ? m.plateformes.join(", ") : m.plateformes || "")}</p></div>`).join("")}</div>
  <div style="margin-top:40px">${adBox("accueil-banniere", true)}</div></div></section>`;
AFTER.medias = () => $$("[data-vid]").forEach(a => a.onclick = () => { CV.tab = "video"; CV.i = 0; });

/* ---------------- À PROPOS / CHARTES / TRANSPARENCE / PARTENAIRES ---------------- */
const prose = t => String(t || "").split(/\n+/).map(l => /^#{1,3}\s/.test(l) ? `<h3>${esc(l.replace(/^#+\s*/, ""))}</h3>` : /^[-•]\s/.test(l) ? `<p>• ${esc(l.slice(2))}</p>` : `<p>${esc(l)}</p>`).join("");
const txt = v => typeof v === "string" ? prose(v) : Array.isArray(v) ? v.map(txt).join("") : v && typeof v === "object" ? Object.entries(v).map(([k, x]) => (typeof x === "string" && x.length < 90 && /titre/i.test(k)) ? `<h3>${esc(x)}</h3>` : txt(x)).join("") : "";
ROUTES.a = () => ROUTES["a-propos"]();
ROUTES["a-propos"] = () => head("À propos & gouvernance", "Une plateforme scientifique, pédagogique et citoyenne", C.mission || "") + `<section class="s"><div class="wrap layout-2"><div class="prose">
  <h2>Mission</h2>${txt(C.mission)}<h2>Vision</h2>${txt(C.vision)}<h2>Valeurs</h2><ul>${(C.valeurs || []).map(v => `<li>${esc(typeof v === "string" ? v : v.nom + " — " + (v.description || ""))}</li>`).join("")}</ul>
  <h2>Équipe</h2><p>Projet porté par des enseignants-chercheurs en sociologie économique, ouvert à tous les étudiants, enseignants et chercheurs en sociologie de Côte d'Ivoire et d'ailleurs. Le comité éditorial et le conseil scientifique seront présentés à l'ouverture publique.</p>
  <h2>Foire aux questions</h2>${(C.faq || []).map(f => `<details class="gl-item"><summary>${esc(f.question || f.q)}</summary><p style="margin-top:8px">${esc(f.reponse || f.r)}</p></details>`).join("")}
  <h2>Contact & presse</h2><p>Comité éditorial et espace presse : contact@lesociologuedeleconomie.ci (adresse à activer à la mise en ligne).</p>
  <h2>Liens institutionnels</h2><ul><li><a href="https://www.univ-pgc.edu.ci/" target="_blank" rel="noopener">Université Peleforo Gon Coulibaly (UPGC), Korhogo</a> — université d'attache de Dr Fabrice TANOH (Département de sociologie).</li><li><a href="https://www.lecames.org/" target="_blank" rel="noopener">CAMES – Conseil africain et malgache pour l'enseignement supérieur</a> — institution qui coordonne l'enseignement supérieur et la recherche dans ses pays membres.</li></ul></div>
  <div><div class="card"><a href="#chartes">Chartes éditoriale et de modération →</a><br><a href="#transparence">Transparence et financement →</a><br><a href="#partenaires">Devenir partenaire →</a></div></div></div></section>`;
ROUTES.chartes = () => head("Gouvernance", "Chartes éditoriale et de modération") + `<section class="s"><div class="wrap article prose"><h2>Charte éditoriale et scientifique</h2>${txt(C.charte_editoriale)}<h2>Charte de modération</h2>${txt(C.charte_moderation)}<h2>Politique publicitaire</h2>${txt(C.politique_publicite)}</div></section>`;
ROUTES.transparence = () => head("Gouvernance", "Transparence") + `<section class="s"><div class="wrap article prose">${txt(C.transparence)}<h2>Politique publicitaire</h2>${txt(C.politique_publicite)}</div></section>`;
ROUTES.partenaires = () => head("Partenariats & publicité éthique", "Soutenir la plateforme sans en orienter les contenus", seoIntro("partenaires") || "") + `<section class="s"><div class="wrap">
  <div class="grid g3">${[["Bannière d'accueil", "Visibilité maximale, en dessous des articles à la une. Format texte + logo, mention « Sponsorisé »."], ["Encart latéral", "À côté des articles, études de cas et publications, jamais à l'intérieur du texte."], ["Bandeau de cours", "Sous les cours animés : idéal pour les formations, bourses, programmes d'insertion."], ["Parrainage d'un parcours", "Un parcours d'apprentissage ou un événement soutenu, avec mention du parrain et indépendance garantie."], ["Data story partenaire", "Valorisation d'une base de données ouverte, analysée par la rédaction selon ses propres règles."], ["Formations & études", "Ateliers méthodologiques et services d'études réalisés sous charte scientifique."]].map(([t, d]) => `<div class="card"><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
  <div class="card prose" style="margin-top:30px"><h2>Nos règles</h2>${txt(C.politique_publicite)}</div>
  <div class="notice i" style="margin-top:20px">Pour devenir partenaire, écrivez au comité : partenaires@lesociologuedeleconomie.ci (à activer). Chaque campagne est validée par l'agent « partenaires » puis par un éditeur humain.</div></div></section>`;

/* ---------------- CONSOLE DES AGENTS (éditeurs) ---------------- */
const AGENTS = [
  ["edito", "Agent éditorial", "#0E2A47", "Rédige un brouillon d'article à partir d'un thème ; un éditeur humain relit, corrige et publie."],
  ["modo", "Agent de modération", "#C2410C", "Analyse commentaires et discussions en attente au regard de la charte et propose une décision ; un modérateur tranche."],
  ["pedago", "Agent pédagogique", "#009E60", "Génère quiz, sujets de TD et fiches de révision à partir des cours de la plateforme."],
  ["news", "Agent newsletter & réseaux", "#1F4E79", "Compose la lettre mensuelle et les publications courtes pour les réseaux sociaux."],
  ["pub", "Agent partenaires & publicité", "#F77F00", "Vérifie la conformité des annonces à la politique publicitaire, gère les campagnes et les statistiques de clics."],
  ["data", "Agent observatoire", "#2E6DA4", "Rédige des « Data stories » à partir des séries de l'observatoire, sans extrapoler les chiffres."],
];
ROUTES.console = () => {
  const intro = head("Administration", "Console des agents", "Six agents IA assistent l'équipe : ils préparent, l'humain valide. Chaque action est journalisée.");
  if (!S.canEdit) return intro + `<section class="s"><div class="wrap"><div class="notice">La console est réservée aux éditeurs et administrateurs de la plateforme.</div><div class="grid g3" style="margin-top:24px">${AGENTS.map(a => `<div class="card agent"><div class="ico" style="background:${a[2]}">${a[1].split(" ")[1][0]}</div><div><h3 style="margin:0">${a[1]}</h3><p>${a[3]}</p></div></div>`).join("")}</div></div></section>`;
  const pending = S.comments.filter(c => c.status === "en_attente").map(c => ({ ...c, col: "comments" })).concat(S.forum.filter(c => c.status === "en_attente").map(c => ({ ...c, col: "forum" })));
  return intro + `<section class="s"><div class="wrap">
  ${!S.sample ? `<div class="notice" style="margin-bottom:20px">Les fonctions de génération IA ne sont pas disponibles dans cette vue ; la gestion des contenus reste possible.</div>` : ""}
  <div class="grid g2">
   <div class="card"><div class="agent"><div class="ico" style="background:#0E2A47">É</div><div><h3 style="margin:0">Agent éditorial</h3><p>${AGENTS[0][3]}</p></div></div><div class="field"><label for="edT">Thème ou angle</label><input id="edT" placeholder="Ex. : les vendeuses de garba et le crédit fournisseur à Yopougon"></div><button class="btn btn-b btn-s" data-ag="edito" ${S.sample ? "" : "disabled"}>Rédiger un brouillon</button><div class="out" id="out-edito" hidden></div><button class="btn btn-o btn-s" id="edSave" hidden style="margin-top:8px">Envoyer en relecture</button></div>
   <div class="card"><div class="agent"><div class="ico" style="background:#C2410C">M</div><div><h3 style="margin:0">Agent de modération</h3><p>${pending.length} élément(s) en attente.</p></div></div>
     ${pending.slice(0, 8).map(p => `<div class="post"><small class="chip">${p.col === "forum" ? "Forum" : "Commentaire"}</small> <b>${esc(p.nom)}</b><p style="margin:6px 0">${esc(p.texte.slice(0, 280))}</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-g btn-s" data-mod="${p.col}/${p._id}" data-act="ia" ${S.sample ? "" : "disabled"}>Avis de l'agent</button><button class="btn btn-b btn-s" data-mod="${p.col}/${p._id}" data-act="approuve">Approuver</button><button class="btn btn-g btn-s" data-mod="${p.col}/${p._id}" data-act="rejete">Rejeter</button></div><div class="out" hidden></div></div>`).join("") || `<p style="color:var(--muted)">Rien à modérer.</p>`}</div>
   <div class="card"><div class="agent"><div class="ico" style="background:#009E60">P</div><div><h3 style="margin:0">Agent pédagogique</h3><p>${AGENTS[2][3]}</p></div></div><div class="filters"><select id="pgC">${COURSES.map(c => `<option value="${c.id}">${esc(c.titre)} (${esc(c.niveau)})</option>`).join("")}</select><select id="pgK"><option>5 nouvelles questions de quiz</option><option>Fiche de révision d'une page</option><option>Sujet d'examen et corrigé indicatif</option></select></div><button class="btn btn-b btn-s" data-ag="pedago" ${S.sample ? "" : "disabled"}>Générer</button><div class="out" id="out-pedago" hidden></div></div>
   <div class="card"><div class="agent"><div class="ico" style="background:#1F4E79">N</div><div><h3 style="margin:0">Agent newsletter & réseaux</h3><p>${AGENTS[3][3]}</p></div></div><button class="btn btn-b btn-s" data-ag="news" ${S.sample ? "" : "disabled"}>Composer la lettre du mois</button> <button class="btn btn-g btn-s" data-ag="social" ${S.sample ? "" : "disabled"}>5 posts réseaux sociaux</button><div class="out" id="out-news" hidden></div></div>
   <div class="card"><div class="agent"><div class="ico" style="background:#2E6DA4">D</div><div><h3 style="margin:0">Agent observatoire</h3><p>${AGENTS[5][3]}</p></div></div><select id="dtS" style="padding:8px;border-radius:10px;border:1px solid var(--line);background:var(--card)">${((OBS || {}).series || []).map((s, i) => `<option value="${i}">${esc(s.titre)}</option>`).join("")}</select> <button class="btn btn-b btn-s" data-ag="data" ${S.sample ? "" : "disabled"}>Rédiger une data story</button><div class="out" id="out-data" hidden></div></div>
   <div class="card"><div class="agent"><div class="ico" style="background:#F77F00">€</div><div><h3 style="margin:0">Agent partenaires & publicité</h3><p>${S.ads.length} campagne(s).</p></div></div>
     <form id="adForm"><div class="grid g2"><div class="field"><label>Partenaire</label><input name="partenaire" required></div><div class="field"><label>Emplacement</label><select name="slot"><option value="accueil-banniere">Bannière d'accueil</option><option value="article-lateral">Encart latéral</option><option value="cours-bas">Bandeau de cours</option><option value="tous">Tous</option></select></div></div><div class="field"><label>Titre</label><input name="titre" required maxlength="90"></div><div class="field"><label>Texte</label><textarea name="texte" required maxlength="260" style="min-height:70px"></textarea></div><div class="grid g2"><div class="field"><label>Lien</label><input name="lien" placeholder="https://"></div><div class="field"><label>Couleur</label><input name="couleur" type="color" value="#0E2A47"></div></div><div class="grid g2"><div class="field"><label>Début</label><input name="debut" type="date"></div><div class="field"><label>Fin</label><input name="fin" type="date"></div></div><button class="btn btn-g btn-s" type="button" id="adCheck" ${S.sample ? "" : "disabled"}>Vérifier la conformité</button> <button class="btn btn-o btn-s">Enregistrer (inactive)</button><div class="out" id="out-pub" hidden></div></form>
     <table class="t" style="margin-top:14px"><thead><tr><th>Campagne</th><th>Emplacement</th><th>État</th><th></th></tr></thead><tbody>${S.ads.map(a => `<tr><td><b>${esc(a.partenaire)}</b><br><small>${esc(a.titre)}</small></td><td>${esc(a.slot)}</td><td><span class="status ${a.actif ? "published" : "pending"}">${a.actif ? "active" : "inactive"}</span></td><td><button class="btn btn-g btn-s" data-adt="${a._id}">${a.actif ? "Suspendre" : "Activer"}</button> <button class="btn btn-g btn-s" data-adst="${a._id}">Clics</button></td></tr>`).join("")}</tbody></table></div>
  </div>
  <h2 style="margin-top:50px">Circuit éditorial</h2><div class="card" style="overflow:auto"><table class="t"><thead><tr><th>Contribution</th><th>Auteur</th><th>Statut</th><th>Action</th></tr></thead><tbody>${S.subs.filter(s => !s.kind).map(s => `<tr><td><b>${esc(s.titre)}</b><br><small>${esc(s.type)} · ${esc(THEMES[s.theme] || s.theme)}</small><details><summary style="cursor:pointer;font-size:.85rem">Résumé</summary><p style="font-size:.88rem">${esc(s.resume)}</p></details></td><td>${esc(s.auteur)}<br><small>${esc(s.affiliation || "")}</small></td><td><span class="status ${s.status === "publie" ? "published" : s.status === "rejete" ? "rejected" : "pending"}">${esc(s.status)}</span></td><td><select data-sub="${s._id}"><option value="">Changer…</option>${["verification", "relecture", "publie", "rejete"].map(x => `<option>${x}</option>`).join("")}</select></td></tr>`).join("") || `<tr><td colspan="4" style="color:var(--muted)">Aucune soumission.</td></tr>`}
  ${S.published.filter(p => p.status === "relecture").map(p => `<tr><td><b>${esc(p.titre)}</b><br><small>Brouillon de l'agent éditorial</small></td><td>${esc(p.auteur)}</td><td><span class="status pending">relecture</span></td><td><button class="btn btn-b btn-s" data-pubok="${p._id}">Publier</button> <button class="btn btn-g btn-s" data-pubko="${p._id}">Rejeter</button></td></tr>`).join("")}</tbody></table></div>
  <h2 style="margin-top:50px">Journal d'audit des agents</h2><div class="card"><table class="t"><tbody>${S.audit.map(a => `<tr><td>${new Date(a.at).toLocaleString("fr-FR")}</td><td><b>${esc(a.agent)}</b></td><td>${esc(a.action)}</td></tr>`).join("") || `<tr><td style="color:var(--muted)">Aucune action journalisée.</td></tr>`}</tbody></table></div>
  </div></section>`;
};
let DRAFT = null;
async function ask(prompt, out, tier) { out.hidden = false; out.textContent = "L'agent travaille…"; try { const r = await S.sample(prompt, { modelTier: tier || "default", onText: ({ text }) => out.textContent = text }); out.textContent = r.text; return r.text; } catch (e) { out.textContent = e && e.code === "rate_limited" ? "Trop de demandes : réessayez dans un instant." : "Agent indisponible pour le moment."; return null; } }
AFTER.console = () => {
  if (!S.canEdit) return;
  $$("[data-ag]").forEach(b => b.onclick = async () => { const k = b.dataset.ag; b.disabled = true;
    if (k === "edito") { const th = $("#edT").value.trim(); if (!th) { b.disabled = false; return toast("Indiquez un thème."); }
      const out = $("#out-edito"); out.hidden = false; out.textContent = "L'agent rédige…";
      try { DRAFT = await S.sample.json(`Tu es l'agent éditorial de « Sociologie de l'Économie » (sociologie économique, Côte d'Ivoire, ton scientifique et accessible, non partisan). Rédige un BROUILLON d'article sur : « ${th} ». Règles : aucun chiffre ni citation inventés — quand une donnée est nécessaire, écris [DONNÉE À VÉRIFIER : source suggérée] ; pas de personnes réelles inventées. Réponds UNIQUEMENT en JSON : {"titre":"","chapo":"","corps":["5 paragraphes"],"mots_cles":["5"],"sources_a_verifier":["références réelles à vérifier"],"theme":"un de: ${Object.keys(THEMES).join(", ")}","region":""}`, { modelTier: "complex" });
        out.textContent = `${DRAFT.titre}\n\n${DRAFT.chapo}\n\n${(DRAFT.corps || []).join("\n\n")}\n\nSources à vérifier : ${(DRAFT.sources_a_verifier || []).join(" ; ")}`; $("#edSave").hidden = false; audit("Agent éditorial", "Brouillon : " + DRAFT.titre);
      } catch { out.textContent = "Agent indisponible pour le moment."; } }
    if (k === "pedago") { const c = COURSES.find(x => x.id === $("#pgC").value); const t = await ask(`Tu es l'agent pédagogique de la plateforme Sociologie de l'Économie. Produis en français : ${$("#pgK").value} pour le cours « ${c.titre} » (${c.niveau}). Objectifs : ${c.objectifs.join(" ; ")}. Points du cours : ${(c.synthese || {}).points?.join(" ; ")}. Aucun chiffre inventé. Texte brut.`, $("#out-pedago")); if (t) audit("Agent pédagogique", $("#pgK").value + " — " + c.id); }
    if (k === "news" || k === "social") { const items = allPubs().slice(0, 6).map(p => `- ${p.titre} (#${p.id})`).join("\n"); const cs = COURSES.slice(0, 4).map(c => `- Cours ${c.titre} (#cours-${c.id})`).join("\n");
      const t = await ask(k === "news" ? `Tu es l'agent newsletter de « Sociologie de l'Économie ». Compose la lettre mensuelle (objet, accroche, 4 rubriques courtes : article du mois, cours du mois, donnée du mois, agenda, appel à contribution) à partir de ces contenus, sans rien inventer :\n${items}\n${cs}\nTexte brut en français.` : `Tu es l'agent réseaux sociaux de « Sociologie de l'Économie ». Rédige 5 publications courtes (LinkedIn, Facebook, X, WhatsApp, Instagram) en français pour faire découvrir ces contenus, sans rien inventer, avec 3 hashtags chacune :\n${items}\n${cs}`, $("#out-news")); if (t) audit("Agent newsletter", k === "news" ? "Lettre mensuelle" : "Posts réseaux sociaux"); }
    if (k === "data") { const s = OBS.series[+$("#dtS").value]; const t = await ask(`Tu es l'agent observatoire. Rédige une « Data story » de 180 mots en français, avec un titre, à partir UNIQUEMENT de cette série (ne cite aucun autre chiffre, n'extrapole pas, mentionne la source) : ${JSON.stringify({ titre: s.titre, unite: s.unite, source: s.source, points: s.points })}. Propose une lecture sociologique prudente.`, $("#out-data")); if (t) audit("Agent observatoire", "Data story : " + s.titre); }
    b.disabled = false; });
  const es = $("#edSave"); if (es) es.onclick = async () => { if (!DRAFT) return; try { await S.db.collection("published").add({ ...DRAFT, sources: DRAFT.sources_a_verifier || [], type: "Article", auteur: "Rédaction LSE", status: "relecture", date: today(), by: S.uid || "", at: Date.now() }); audit("Agent éditorial", "Envoyé en relecture : " + DRAFT.titre); toast("Brouillon envoyé en relecture"); es.hidden = true; } catch { toast("Enregistrement impossible."); } };
  $$("[data-mod]").forEach(b => b.onclick = async () => { const [col, id] = b.dataset.mod.split("/"); const item = (col === "forum" ? S.forum : S.comments).find(x => x._id === id);
    if (b.dataset.act === "ia") { const o = b.parentNode.nextElementSibling; const t = await ask(`Tu es l'agent de modération. Charte : ${String(C.charte_moderation || "").slice(0, 2500)}\n\nMessage à évaluer : « ${item.texte} »\nRéponds en 3 lignes : décision proposée (approuver / rejeter / demander une reformulation), motif au regard de la charte, reformulation éventuelle.`, o, "quick"); if (t) audit("Agent de modération", "Avis sur " + col + "/" + id); return; }
    try { await S.db.doc(`${col}/${id}`).update({ status: b.dataset.act }); audit("Modérateur", `${b.dataset.act} ${col}/${id}`); toast("Décision enregistrée"); } catch { toast("Action impossible."); } });
  $("#adCheck").onclick = async () => { const f = new FormData($("#adForm")); await ask(`Tu es l'agent partenaires. Politique publicitaire : ${String(C.politique_publicite || "").slice(0, 2000)}\nAnnonce : ${JSON.stringify(Object.fromEntries(f))}\nIndique en 4 lignes si l'annonce est conforme, les problèmes éventuels et une version corrigée.`, $("#out-pub"), "quick"); audit("Agent partenaires", "Contrôle de conformité : " + f.get("partenaire")); };
  $("#adForm").onsubmit = async e => { e.preventDefault(); const o = Object.fromEntries(new FormData(e.target)); try { await S.db.collection("ads").add({ ...o, actif: false, at: Date.now() }); audit("Agent partenaires", "Nouvelle campagne : " + o.partenaire); toast("Campagne enregistrée (inactive)"); e.target.reset(); } catch { toast("Enregistrement impossible."); } };
  $$("[data-adt]").forEach(b => b.onclick = async () => { const a = S.ads.find(x => x._id === b.dataset.adt); try { await S.db.doc("ads/" + a._id).update({ actif: !a.actif }); audit("Administrateur", (a.actif ? "Suspension" : "Activation") + " : " + a.partenaire); } catch { toast("Action impossible."); } });
  $$("[data-adst]").forEach(b => b.onclick = async () => { try { const s = await S.db.collection("adstats").where("ad", "==", b.dataset.adst).get(); const n = s.docs.reduce((t, d) => t + (d.data().clics || 0), 0); toast(`${n} clic(s) enregistrés (statistiques agrégées, anonymes)`); } catch { toast("Statistiques indisponibles."); } });
  $$("[data-sub]").forEach(sel => sel.onchange = async () => { const s = S.subs.find(x => x._id === sel.dataset.sub); const st = sel.value; if (!st) return;
    try { const ref = S.db.doc("submissions/" + s._doc); const g = await ref.get(); const items = [...(g.data().items || [])]; items[s._i] = { ...items[s._i], status: st }; await ref.update({ items }); if (st === "publie") await S.db.collection("published").add({ titre: s.titre, chapo: s.resume, corps: String(s.contenu || "").split(/\n+/).filter(Boolean), auteur: s.auteur + (s.affiliation ? " (" + s.affiliation + ")" : ""), theme: s.theme, region: s.region, type: s.type, status: "publie", date: today(), at: Date.now() }); audit("Éditeur", `Soumission « ${s.titre} » → ${st}`); toast("Statut mis à jour"); } catch { toast("Action impossible."); } });
  $$("[data-pubok],[data-pubko]").forEach(b => b.onclick = async () => { const id = b.dataset.pubok || b.dataset.pubko; try { await S.db.doc("published/" + id).update({ status: b.dataset.pubok ? "publie" : "rejete", date: today() }); audit("Éditeur", (b.dataset.pubok ? "Publication" : "Rejet") + " du brouillon " + id); } catch { toast("Action impossible."); } });
};


/* ---------------- BIBLIOTHÈQUE OUVERTE ---------------- */
function oaLinks(q) {
  const e = encodeURIComponent(q);
  return `<span style="font-size:.82rem;display:inline-flex;gap:10px;flex-wrap:wrap"><a href="https://scholar.google.com/scholar?q=${e}" rel="noopener">Google Scholar</a><a href="https://openalex.org/works?search=${e}" rel="noopener">OpenAlex</a><a href="https://hal.science/search/index/?q=${e}" rel="noopener">HAL</a><a href="https://www.base-search.net/Search/Results?lookfor=${e}" rel="noopener">BASE</a></span>`;
}
ROUTES.bibliotheque = cat => {
  if (!BIB) return head("Bibliothèque ouverte", "Documents scientifiques en libre accès et revues de sociologie", "La bibliothèque est en cours de préparation.");
  const cats = [...new Set((BIB.revues || []).map(r => r.categorie))];
  return head("Bibliothèque ouverte", "Documents scientifiques en libre accès et revues de sociologie", seoIntro("bibliotheque") || "Archives ouvertes, portails de revues, moteurs de recherche académiques et revues de référence : tout ce qu'il faut pour lire, citer et publier en sociologie économique, gratuitement quand c'est possible.") + `<section class="s"><div class="wrap">
  <div class="card" style="margin-bottom:36px"><div class="kicker">Rechercher un document en libre accès</div><form id="oaF" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px"><input id="oaQ" required placeholder="Ex. : économie informelle Abidjan, tontines, coopératives cacao…" style="flex:1;min-width:240px;padding:12px 16px;border-radius:999px;border:1px solid var(--line);background:var(--card)"><button class="btn btn-o">Chercher</button></form><div id="oaR" style="margin-top:12px"></div></div>
  <div class="sh"><div><div class="kicker">Archives et portails</div><h2>Où trouver des documents scientifiques gratuits</h2></div></div>
  <div class="grid g3">${(BIB.archives || []).map(a => `<div class="card"><div class="meta"><span class="chip g">${esc(a.acces || "libre")}</span><span class="chip">${esc(a.type || "")}</span></div><h3><a href="${esc(a.url)}" rel="noopener">${esc(a.nom)}</a></h3><p>${esc(a.description)}</p>${a.astuce ? `<p style="font-size:.85rem"><b>Astuce :</b> ${esc(a.astuce)}</p>` : ""}<small style="color:var(--muted)">${esc(a.langues || "")}</small></div>`).join("")}</div>
  <div class="sh" style="margin-top:56px"><div><div class="kicker">Revues</div><h2>Revues de sociologie et de sciences sociales</h2></div></div>
  <div class="filters"><select id="rvC"><option value="">Toutes les catégories</option>${cats.map(c => `<option ${c === decodeURIComponent(cat || "") ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><select id="rvA"><option value="">Tous les accès</option><option value="libre">Libre accès</option><option value="partiel">Libre partiel</option><option value="abonnement">Abonnement</option></select><input id="rvQ" placeholder="Filtrer…" aria-label="Filtrer les revues"></div>
  <div class="card" style="overflow:auto"><table class="t" id="rvT"><thead><tr><th>Revue</th><th>Éditeur · pays</th><th>Accès</th><th>Catégorie</th></tr></thead><tbody>${(BIB.revues || []).map(r => `<tr data-c="${esc(r.categorie)}" data-a="${esc(fold(r.acces))}" data-t="${esc(fold(r.titre + " " + r.description + " " + r.editeur))}"><td><a href="${esc(r.url)}" rel="noopener"><b>${esc(r.titre)}</b></a><br><small style="color:var(--muted)">${esc(r.description || "")}${r.issn ? " · ISSN " + esc(r.issn) : ""}</small></td><td>${esc(r.editeur || "")}<br><small>${esc(r.pays || "")} · ${esc(r.langue || "")}</small></td><td><span class="status ${/^libre$/i.test(r.acces) ? "published" : /partiel|mobile/i.test(r.acces) ? "pending" : ""}">${esc(r.acces)}</span></td><td style="font-size:.85rem">${esc(r.categorie)}</td></tr>`).join("")}</tbody></table></div>
  <div class="sh" style="margin-top:56px"><div><div class="kicker">Méthode</div><h2>Guides pratiques</h2></div></div>
  <div class="grid g3">${(BIB.guides || []).map(g => `<div class="card"><h3>${esc(g.titre)}</h3><ol style="padding-left:1.2em">${(g.etapes || []).map(e => `<li style="margin-bottom:6px">${esc(e)}</li>`).join("")}</ol></div>`).join("")}</div>
  <p style="font-size:.8rem;color:var(--muted);margin-top:20px">Liens vérifiés le ${esc(BIB.maj || "")}. Signalez un lien cassé dans la communauté.</p>
  <div style="margin-top:30px">${adBox("accueil-banniere", true)}</div></div></section>`;
};
AFTER.bibliotheque = () => {
  if (!BIB) return;
  $("#oaF").onsubmit = e => { e.preventDefault(); const q = $("#oaQ").value.trim(); $("#oaR").innerHTML = `<p style="margin:0 0 6px">Ouvrir la recherche « ${esc(q)} » dans :</p>${oaLinks(q)}`; };
  const f = () => { const c = $("#rvC").value, a = $("#rvA").value, q = fold($("#rvQ").value);
    $$("#rvT tbody tr").forEach(tr => tr.style.display = (!c || tr.dataset.c === c) && (!a || (a === "libre" ? /^libre$/.test(tr.dataset.a) : a === "partiel" ? /partiel|mobile/.test(tr.dataset.a) : /abonnement/.test(tr.dataset.a))) && (!q || tr.dataset.t.includes(q)) ? "" : "none"); };
  $$("#rvC,#rvA,#rvQ").forEach(x => x.oninput = f); f();
};

const notFound = () => `<div class="wrap" style="padding:80px 20px"><h1>Page introuvable</h1><p><a href="#accueil">Retour à l'accueil</a></p></div>`;

/* ---------------- RECHERCHE GLOBALE + INDEX ---------------- */
let IDX = [];
function buildIndex() {
  const add = (t, u, ty, body) => IDX.push({ t, u, ty, body: String(body || ""), f: fold(t + " " + body) });
  (C.articles || []).forEach(a => add(a.titre, "#article-" + slug(a.id), "Article", [a.chapo, ...(a.corps || [])].join(" ")));
  (C.fiches || []).forEach(a => add(a.titre, "#fiche-" + slug(a.id), "Fiche", [a.resume, ...(a.sections || []).map(s => s.texte)].join(" ")));
  (C.glossaire || []).forEach(a => add(a.terme, "#savoirs-glossaire", "Concept", a.definition + " " + (a.exemple_ci || "")));
  (C.etudes_cas || []).forEach(a => add(a.titre, "#cas-" + slug(a.id), "Étude de cas", a.contexte + " " + a.analyse));
  (C.parcours || []).forEach(a => add(a.titre, "#parcours-" + slug(a.id), "Parcours", (a.etapes || []).map(e => e.titre + " " + e.contenu_lie).join(" ")));
  (C.debats || []).forEach(a => add(a.question, "#savoirs-fiches", "Débat", [a.enjeu, a.position_a, a.position_b].join(" ")));
  (C.faq || []).forEach(a => add(a.question || a.q, "#a-propos", "FAQ", a.reponse || a.r));
  COURSES.forEach(c => { add(c.titre, "#cours-" + c.id, "Cours " + c.niveau, [c.resume, c.accroche, ...(c.objectifs || []), ...(c.slides || []).map(s => [s.titre, s.definition, s.contexte, s.commentaire, ...(s.points || []), ...(s.analyse || []), ...((s.items || []).map(i => i.auteur + " " + i.idee)), ...((s.chiffres || []).map(x => x.valeur + " " + x.label + " (" + x.source + ")")), s.notes].filter(Boolean).join(" ")), ...((c.synthese || {}).points || [])].join(" ")); });
  ((OBS || {}).series || []).forEach(s => add(s.titre, "#observatoire", "Donnée", `${s.unite}. Source : ${s.source}. ${(s.points || []).filter(p => p.valeur != null).map(p => p.annee + " : " + p.valeur).join(", ")}`));
  ((BIB || {}).archives || []).forEach(a => add(a.nom, "#bibliotheque", "Archive ouverte", a.description + " " + (a.astuce || "")));
  ((BIB || {}).revues || []).forEach(r => add(r.titre, "#bibliotheque", "Revue", [r.description, r.editeur, r.categorie, r.acces].join(" ")));
  ((OBS || {}).data_stories || []).forEach(s => add(s.titre, "#observatoire", "Data story", s.texte));
}
function searchIdx(q, n = 8) {
  const terms = fold(q).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !["les", "des", "une", "est", "que", "qui", "pour", "dans", "sur", "aux", "avec", "quoi", "comment", "quel", "quelle", "quels"].includes(w));
  if (!terms.length) return [];
  return IDX.map(d => { let s = 0; terms.forEach(t => { const tf = d.f.split(t).length - 1; if (tf) s += (1 + Math.log(tf)) * (fold(d.t).includes(t) ? 3 : 1); }); return [s, d]; }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}
function snippet(d, q) { const terms = fold(q).split(/\W+/).filter(w => w.length > 3); const f = fold(d.body); let i = Math.max(0, Math.min(...terms.map(t => { const k = f.indexOf(t); return k < 0 ? 1e9 : k; }))); if (i > 1e8) i = 0; return (i > 60 ? "…" : "") + d.body.slice(Math.max(0, i - 60), i + 200) + "…"; }
function openSearch() { $("#so").classList.add("open"); $("#soIn").value = ""; $("#soRes").innerHTML = `<div style="padding:18px 22px;color:var(--muted)">Tapez au moins trois lettres.</div>`; setTimeout(() => $("#soIn").focus(), 30); }
$("#btnSearch").onclick = openSearch;
$("#soIn").oninput = e => { const r = searchIdx(e.target.value, 12); $("#soRes").innerHTML = r.map(d => `<a href="${d.u}"><b>${esc(d.t)}</b><small>${esc(d.ty)} — ${esc(snippet(d, e.target.value).slice(0, 140))}</small></a>`).join("") || `<div style="padding:18px 22px;color:var(--muted)">Aucun résultat.</div>`; };
$("#so").onclick = e => { if (e.target.id === "so" || e.target.closest("a")) $("#so").classList.remove("open"); };
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); } if (e.key === "Escape") { $("#so").classList.remove("open"); $("#cb").classList.remove("open"); } });
$("#btnTheme").onclick = () => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === "dark" ? "" : "dark"; try { localStorage.setItem("lse-theme", d.dataset.theme || "light"); } catch {} if (location.hash.startsWith("#observatoire")) route(true); };
$("#btnMenu").onclick = () => { const n = $("#nav"); n.classList.toggle("open"); $("#btnMenu").setAttribute("aria-expanded", n.classList.contains("open")); };

/* ---------------- CHATBOT ---------------- */
const CHAT = [];
function addMsg(role, text) {
  const el = document.createElement("div"); el.className = "m " + (role === "user" ? "u" : "a");
  el.innerHTML = role === "user" ? esc(text) : esc(text).replace(/\[([^\]]+)\]\((#[a-zA-Z0-9-]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  $("#cbMsgs").appendChild(el); $("#cbMsgs").scrollTop = 1e9; return el;
}
$("#cbBtn").onclick = () => { const cb = $("#cb"); cb.classList.toggle("open"); if (cb.classList.contains("open") && !$("#cbMsgs").children.length) {
  addMsg("a", "Bonjour ! Je réponds à vos questions de sociologie économique à partir des cours, articles, concepts et données de la plateforme, en citant mes sources. Que voulez-vous savoir ?");
  $("#cbSugg").innerHTML = ["Qu'est-ce que l'encastrement ?", "Que disent les cours sur les tontines ?", "Quel est le poids de l'informel en Côte d'Ivoire ?", "Par quel cours commencer quand on débute ?"].map(s => `<button>${s}</button>`).join("");
  $$("#cbSugg button").forEach(b => b.onclick = () => { $("#cbIn").value = b.textContent; $("#cbForm").requestSubmit(); }); } $("#cbIn").focus(); };
$("#cbClose").onclick = () => $("#cb").classList.remove("open");
$("#cbForm").onsubmit = async e => {
  e.preventDefault(); const q = $("#cbIn").value.trim(); if (!q) return; $("#cbIn").value = ""; $("#cbSugg").innerHTML = ""; addMsg("user", q); CHAT.push({ role: "user", content: q });
  const hits = searchIdx(q + " " + CHAT.filter(m => m.role === "user").slice(-2, -1).map(m => m.content).join(" "), 6);
  if (!S.sample) {
    const t = hits.length ? "Voici les contenus de la plateforme les plus proches de votre question :\n\n" + hits.slice(0, 4).map(h => `• [${h.t}](${h.u}) — ${snippet(h, q).slice(0, 180)}`).join("\n\n") : "Je n'ai rien trouvé sur ce point dans la plateforme. Reformulez, ou posez la question à la communauté.";
    addMsg("a", t); CHAT.push({ role: "assistant", content: t }); return;
  }
  const el = addMsg("a", "…");
  const ctx = hits.map((h, i) => `[${i + 1}] ${h.t} (${h.ty}) — lien ${h.u}\n${h.body.slice(0, 1400)}`).join("\n\n");
  const sys = `Tu es l'assistant de « Sociologie de l'Économie », le blog scientifique de Dr Fabrice TANOH, plateforme de sociologie économique de la Côte d'Ivoire, ouverte à tous les étudiants et enseignants en sociologie. Réponds en français, clairement, en 120 à 220 mots, comme un enseignant bienveillant. Appuie-toi d'abord sur les EXTRAITS DE LA PLATEFORME ci-dessous ; cite les pages utilisées sous la forme [Titre](#lien) avec exactement les liens fournis. Tu peux compléter par des connaissances générales solides en sociologie économique en le signalant (« plus largement… »), mais n'invente jamais de chiffre, de citation ni de référence ; si un chiffre n'est pas dans les extraits, dis-le. Reste non partisan. Si la question sort du champ (sociologie, économie, société ivoirienne, méthodes, plateforme), réoriente poliment. Utilise l'outil chercher_plateforme si les extraits ne suffisent pas.\n\nEXTRAITS DE LA PLATEFORME :\n${ctx || "(aucun extrait pertinent)"}`;
  const msgs = [{ role: "user", content: sys + "\n\nQUESTION : " + q }];
  const hist = CHAT.slice(-7, -1); const input = hist.length ? [...hist.map((m, i) => i === 0 && m.role === "assistant" ? { role: "user", content: "(suite)" } : m), ...msgs] : msgs;
  const norm = []; input.forEach(m => { if (norm.length && norm[norm.length - 1].role === m.role) norm[norm.length - 1].content += "\n" + m.content; else norm.push({ ...m }); }); if (norm[0].role !== "user") norm.shift();
  try {
    const r = await S.sample(norm, { modelTier: "default", cache: false, onText: ({ text }) => { el.innerHTML = esc(text).replace(/\[([^\]]+)\]\((#[a-zA-Z0-9-]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); $("#cbMsgs").scrollTop = 1e9; },
      tools: [{ name: "chercher_plateforme", description: "Recherche plein texte dans les cours, articles, concepts, études de cas et données de la plateforme. Renvoie titres, liens et extraits.", inputSchema: { type: "object", properties: { requete: { type: "string" } }, required: ["requete"] }, execute: ({ requete }) => searchIdx(requete, 5).map(h => ({ titre: h.t, lien: h.u, type: h.ty, extrait: h.body.slice(0, 900) })) }] });
    el.innerHTML = esc(r.text).replace(/\[([^\]]+)\]\((#[a-zA-Z0-9-]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); CHAT.push({ role: "assistant", content: r.text });
  } catch (err) {
    const t = hits.length ? "L'assistant IA n'est pas disponible ici, mais voici les contenus les plus proches :\n\n" + hits.slice(0, 4).map(h => `• [${h.t}](${h.u})`).join("\n") : "L'assistant n'est pas disponible pour le moment.";
    el.innerHTML = esc(t).replace(/\[([^\]]+)\]\((#[a-zA-Z0-9-]+)\)/g, '<a href="$2">$1</a>'); CHAT.push({ role: "assistant", content: t });
  }
};
$("#cbMsgs").addEventListener("click", e => { if (e.target.closest("a") && innerWidth < 700) $("#cb").classList.remove("open"); });

boot();
