/* Le Sociologue de l'Économie — module « blog scientifique de Dr Fabrice TANOH »
   Se charge après app.js et redéfinit/ajoute des routes. Données : data/auteur.json, data/recherche.json,
   data/actualites.json, data/rapport.json, data/agents.json (mises à jour chaque jour par les agents IA). */
"use strict";
let AUT = null, RECH = null, ACTU = null, RAPPORT = null, AGENTS_CFG = null, PODCAST = null, PROMO = null;
const PHOTOS = [
  { f: "img/portrait-toge.jpg", c: "Dr Fabrice TANOH" },
  { f: "img/srcd-2019-photobooth.jpg", c: "SRCD 2019 Biennial Meeting (Society for Research in Child Development), Baltimore, 21-23 mars 2019" },
  { f: "img/poster-2019-pauvrete-portrait.jpg", c: "SRCD 2019 : poster « Impact of Poverty on Brain Development, Executive Function, and Literacy in Rural Cocoa Communities in Côte d'Ivoire »" },
  { f: "img/poster-2019-travail-enfants-lecture.jpg", c: "SRCD 2019 : poster « The impact of child labor on children's reading outcomes in rural cocoa-producing communities in Côte d'Ivoire »" },
  { f: "img/poster-2019-memoire-litteratie.jpg", c: "SRCD 2019 : poster « The Impact of Declarative and Procedural Memory Systems on Late Childhood Literacy Development »" },
  { f: "img/equipe-2019.jpg", c: "SRCD 2019 : avec l'équipe de recherche devant le poster sur la pauvreté, le développement cérébral et la littératie" },
  { f: "img/poster-2019-cerveau-pauvrete.jpg", c: "SRCD 2019, Baltimore : session de posters" },
  { f: "img/srcd-2019-sponsors.jpg", c: "SRCD 2019 Biennial Meeting, Baltimore (mars 2019)" },
  { f: "img/seminaire-delaware.jpg", c: "Séminaire à l'University of Delaware : « Why is socioeconomic status a powerful predictor of literacy achievement? »" },
  { f: "img/winneba-ghana.jpg", c: "Rencontre scientifique à l'University of Education, Winneba (Ghana)" },
  { f: "img/atelier-recherche-2022-a.jpg", c: "Animation d'un atelier de recherche qualitative (février 2022)" },
  { f: "img/atelier-recherche-2022-b.jpg", c: "Atelier de recherche : échanges avec les participants (février 2022)" },
  { f: "img/seance-travail.jpg", c: "En séance de travail" },
  { f: "img/distinction.jpg", c: "Remise d'une distinction" },
  { f: "img/detente.jpg", c: "Hors du laboratoire" },
];
const DEB_TYPES = { interview: "Interview thématique", note: "Note de réflexion", pointdevue: "Point de vue", lecture: "Compte rendu de lecture", question: "Question ouverte à la communauté" };
const STATUTS = ["Enseignant·e", "Chercheur·e", "Étudiant·e"];
const POSITIONS = { accord: "Prolongement", nuance: "Nuance", desaccord: "Contre-argument" };
S.debats = [];

/* ---------- chargement des données du blog ---------- */
(async function loadBlog() {
  [AUT, RECH, ACTU, RAPPORT, AGENTS_CFG, PODCAST, PROMO] = await Promise.all(["auteur", "recherche", "actualites", "rapport", "agents", "podcast", "promotion"].map(n => getJSON(`data/${n}.json?v=${Date.now() >> 22}`, null)));
  indexBlog(); renderTicker();
  if (typeof route === "function" && document.readyState !== "loading") route(true);
  setInterval(async () => { const a = await getJSON(`data/actualites.json?t=${Date.now()}`, null); if (a && a.maj !== (ACTU || {}).maj) { ACTU = a; renderTicker(); } }, 30 * 60 * 1000);
  // base partagée : débats publiés
  const wait = setInterval(() => { if (S.db) { clearInterval(wait); S.db.collection("debats").orderBy("date", "desc").limit(300).onSnapshot(s => { S.debats = s.docs.map(d => Object.assign({ _id: d.id }, d.data())); refreshIfAny(); }, () => {}); } }, 800);
  setTimeout(() => clearInterval(wait), 15000);
})();
function indexBlog() {
  const add = (t, u, ty, body) => IDX.push({ t, u, ty, body: String(body || ""), f: fold(t + " " + body) });
  ((PODCAST || {}).episodes || []).forEach(e => add("Podcast — " + e.titre, "#podcast-" + e.id, "Épisode de podcast", [e.resume, ...(e.dialogue || []).map(d => d[1])].join(" ")));
  if (AUT) { add(AUT.nom + " — biographie", "#auteur", "Le chercheur", [AUT.bio_courte, ...(AUT.bio_longue || []), ...(AUT.domaines || [])].join(" "));
    (AUT.publications || []).forEach(p => add(p.titre, "#publications", "Publication de Dr Tanoh", [p.revue, p.annee, (p.auteurs || ""), p.resume].join(" "))); }
  ((RECH || {}).articles || []).forEach(a => add(a.titre, "#recherche", "Article en libre accès", [a.revue, a.annee, (a.auteurs || []).join(", "), a.resume].join(" ")));
  ((ACTU || {}).items || []).forEach(a => add(a.titre, "#accueil", "Actualité", `${a.texte} Source : ${a.source} (${a.date})`));
}

/* ---------- bandeau d'actualités défilant ---------- */
function renderTicker() {
  const el = $("#tkMove"); if (!el) return;
  const it = [...((ACTU || {}).indicateurs || []).map(i => `<span class="tk-i tk-ind"><b>${esc(i.valeur)}</b> ${esc(i.label)} <small>${esc(i.periode || "")} · ${esc(i.source)}</small></span>`),
    ...((ACTU || {}).items || []).map(i => `<a class="tk-i" href="${esc(i.url)}" rel="noopener"><em>${esc(i.theme || "")}</em> ${esc(i.titre)} <small>${esc(i.source)}, ${esc(fmtDate(i.date))}</small></a>`)];
  if (!it.length) { $("#ticker").hidden = true; return; }
  $("#ticker").hidden = false;
  el.innerHTML = `<div class="tk-run">${it.join("")}</div><div class="tk-run" aria-hidden="true">${it.join("")}</div>`;
  el.style.setProperty("--tk-dur", Math.max(60, it.length * 7) + "s");
  $("#tkMaj").textContent = ACTU.maj ? "Mis à jour le " + fmtDate(ACTU.maj.slice(0, 10)) : "";
}
const fmtDate = d => { try { return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };

/* ---------- ACCUEIL : version blog ---------- */
const HOME_OLD = ROUTES.accueil;
ROUTES.accueil = () => {
  const a = AUT || {}; const pubs = (a.publications || []).slice().sort((x, y) => (y.annee || 0) - (x.annee || 0));
  const rech = ((RECH || {}).articles || []).slice().sort((x, y) => (y.annee || 0) - (x.annee || 0));
  const old = HOME_OLD().replace(/<section class="hero">[\s\S]*?<\/section>/, "");
  return `<section class="hero hero-blog"><div class="hero-ring" style="width:560px;height:560px;right:-180px;top:-220px;border:1px solid rgba(247,127,0,.35)"></div><div class="wrap">
    <div><div class="kicker">Le blog scientifique de ${esc(a.nom || "Dr Fabrice TANOH")}</div>
      <h1>Comprendre l'économie ivoirienne par le prisme du social</h1>
      <p class="lead">${esc(a.accroche || "Sociologie économique de la Côte d'Ivoire : recherches, cours animés, données et débats pour tous les étudiants et enseignants en sociologie.")}</p>
      <div class="ctas"><a class="btn btn-o" href="#auteur">Découvrir le chercheur</a><a class="btn btn-g" href="#publications">Ses publications</a><a class="btn btn-g" href="#cours">Les cours animés</a></div>
      <div class="hero-stats"><span><b>${pubs.length || "—"}</b> publications</span><span><b>${COURSES.length}</b> cours animés</span><span><b>${rech.length || "—"}</b> articles en libre accès</span><span><b>${(C.glossaire || []).length}</b> concepts</span></div>
    </div>
    <figure class="hero-portrait"><img src="img/thumbs/portrait-carre.jpg" srcset="img/thumbs/portrait-carre.jpg 900w, img/portrait-carre.jpg 1200w" sizes="(max-width: 860px) 80vw, 420px" alt="Portrait de ${esc(a.nom || "Dr Fabrice TANOH")}" width="900" height="900"><figcaption><b>${esc(a.nom || "Dr Fabrice TANOH")}</b><span>${esc(a.titre || "Sociologue de l'économie")}</span></figcaption></figure>
  </div></section>
  ${pubs.length ? `<section class="s"><div class="wrap"><div class="sh"><div><div class="kicker">Travaux de l'auteur</div><h2>Dernières publications de ${esc(a.nom)}</h2></div><a href="#publications">Toutes les publications →</a></div>
    <div class="grid g3">${pubs.slice(0, 3).map(pubCard).join("")}</div></div></section>` : ""}
  ${rech.length ? `<section class="s alt"><div class="wrap"><div class="sh"><div><div class="kicker">Recherche en libre accès</div><h2>À lire : articles récents de la communauté scientifique</h2><p>Articles publiés dans des revues nationales et internationales, recensés et vérifiés chaque jour.</p></div><a href="#recherche">Tout le catalogue →</a></div>
    <div class="grid g3">${rech.slice(0, 6).map(rechCard).join("")}</div></div></section>` : ""}
  ${old}`;
};
const AFTER_HOME_OLD = AFTER.accueil;
AFTER.accueil = a => { AFTER_HOME_OLD(a); wireCite(); };

/* ---------- LE CHERCHEUR ---------- */
ROUTES.auteur = () => {
  const a = AUT; if (!a) return `<div class="wrap" style="padding:80px 20px">Chargement…</div>`;
  return `<section class="author-hero"><div class="wrap"><img class="author-photo" src="img/portrait-toge.jpg" alt="Portrait de ${esc(a.nom)}"><div>
    <div class="kicker">Le chercheur</div><h1>${esc(a.nom)}</h1><p class="lead">${esc(a.titre || "")}</p><p>${esc(a.accroche || "")}</p>
    <div class="pill-row" style="margin-top:16px">${(a.profils || []).map(p => `<a class="btn btn-g btn-s" href="${esc(p.url)}" rel="noopener">${esc(p.nom)} ↗</a>`).join("")}</div></div></div></section>
  <section class="s"><div class="wrap layout-2"><div class="prose">
    <h2>Biographie</h2>${(a.bio_longue || []).map(p => `<p>${esc(p)}</p>`).join("")}
    ${a.poste ? `<div class="aside-box"><b>Poste actuel —</b> ${esc(a.poste)}</div>` : ""}
    <h2>Parcours</h2><div class="timeline">${[...(a.experiences || []).map(e => ({ d: e.periode, t: e.role, s: e.structure, x: e.detail })), ...(a.formation || []).map(f => ({ d: f.annee, t: f.diplome, s: f.etablissement, x: f.detail, f: 1 }))].map(e => `<div class="tl-i ${e.f ? "tl-f" : ""}"><span class="tl-d">${esc(e.d || "")}</span><div><b>${esc(e.t || "")}</b><br><span style="color:var(--muted)">${esc(e.s || "")}</span>${e.x ? `<p style="margin:.3em 0 0;font-size:.92rem">${esc(e.x)}</p>` : ""}</div></div>`).join("")}</div>
    ${(a.projets || []).length ? `<h2>Projets de recherche</h2>${a.projets.map(p => `<div class="card" style="margin-bottom:12px"><div class="meta"><span class="chip o">${esc(p.periode || "")}</span><span>${esc(p.role || "")}</span></div><h3 style="font-size:1.05rem">${esc(p.titre)}</h3><p>${esc(p.detail || "")}</p>${p.partenaires ? `<small style="color:var(--muted)">Partenaires : ${esc(Array.isArray(p.partenaires) ? p.partenaires.join(", ") : p.partenaires)}</small>` : ""}</div>`).join("")}` : ""}
    ${(a.communications || []).length ? `<h2>Communications</h2><ul>${a.communications.map(c => `<li><b>${esc(c.annee)}</b> — ${esc(c.titre)}${c.evenement ? `, <i>${esc(c.evenement)}</i>` : ""}${c.lieu ? ` (${esc(c.lieu)})` : ""}</li>`).join("")}</ul>` : ""}
  </div><aside>
    <div class="card"><div class="kicker">Domaines d'expertise</div><div class="pill-row" style="margin-top:10px">${(a.domaines || []).map(d => `<span class="chip">${esc(d)}</span>`).join("")}</div></div>
    ${a.metriques && a.metriques.citations != null ? `<div class="card" style="margin-top:20px"><div class="kicker">Indicateurs</div><div class="grid g2" style="margin-top:10px"><div class="stat" style="padding:12px"><b style="font-size:1.6rem">${esc(a.metriques.citations)}</b><span>citations</span></div><div class="stat" style="padding:12px"><b style="font-size:1.6rem">${esc(a.metriques.h_index ?? "—")}</b><span>indice h</span></div></div><small style="color:var(--muted)">Source : ${esc(a.metriques.source)}, ${esc(a.metriques.date || "")}</small></div>` : ""}
    <div class="card" style="margin-top:20px"><div class="kicker">Publications</div><p style="margin:8px 0">${(a.publications || []).length} publications recensées.</p><a class="btn btn-o btn-s" href="#publications">Les consulter</a></div>
  </aside></div></section>
  <section class="s alt"><div class="wrap"><div class="kicker">Galerie</div><h2>En images</h2><div class="gallery">${PHOTOS.map((p, i) => `<figure><button class="gal" data-g="${i}" aria-label="Agrandir : ${esc(p.c)}"><img src="${p.f.replace("img/", "img/thumbs/")}" alt="${esc(p.c)}" loading="lazy" decoding="async"></button><figcaption>${esc(p.c)}</figcaption></figure>`).join("")}</div></div></section>
  <div class="lightbox" id="lb" hidden><button class="ib" id="lbX" aria-label="Fermer">✕</button><img id="lbImg" alt=""><p id="lbCap"></p></div>`;
};
AFTER.auteur = () => {
  $$("[data-g]").forEach(b => b.onclick = () => { const p = PHOTOS[+b.dataset.g]; $("#lbImg").src = p.f; $("#lbImg").alt = p.c; $("#lbCap").textContent = p.c; $("#lb").hidden = false; });
  const lb = $("#lb"); if (lb) { lb.onclick = e => { if (e.target.id === "lb" || e.target.id === "lbX") lb.hidden = true; }; }
};

/* ---------- PUBLICATIONS DE L'AUTEUR ---------- */
const PTYPES = { article: "Article", chapitre: "Chapitre d'ouvrage", these: "Thèse", acte: "Acte de colloque", guide: "Guide / outil", rapport: "Rapport" };
function apa(p) { const au = Array.isArray(p.auteurs) ? p.auteurs.join(", ") : (p.auteurs || ""); return `${au} (${p.annee || "s. d."}). ${p.titre}. ${p.revue ? p.revue + (p.volume ? ", " + p.volume : "") + (p.pages ? ", " + p.pages : "") + "." : ""}${p.doi ? " https://doi.org/" + p.doi.replace(/^https?:\/\/doi.org\//, "") : ""}`.replace(/\s+/g, " ").trim(); }
function pubCard(p) {
  const link = p.url_libre || p.url || (p.doi ? "https://doi.org/" + p.doi.replace(/^https?:\/\/doi.org\//, "") : "");
  return `<article class="card pub"><div class="meta"><span class="chip o">${esc(PTYPES[p.type] || p.type || "Publication")}</span><span>${esc(p.annee || "")}</span>${p.langue ? `<span>${esc(p.langue)}</span>` : ""}</div>
    <h3 style="font-size:1.06rem">${esc(p.titre)}</h3><p style="font-size:.85rem;margin:0 0 6px">${esc(Array.isArray(p.auteurs) ? p.auteurs.join(", ") : p.auteurs || "")}</p>
    ${p.revue ? `<p style="font-size:.85rem;font-style:italic;margin:0 0 8px">${esc(p.revue)}${p.volume ? ", " + esc(p.volume) : ""}${p.pages ? ", " + esc(p.pages) : ""}</p>` : ""}
    <p>${esc(p.resume || "")}</p><div style="display:flex;gap:8px;flex-wrap:wrap">${link ? `<a class="btn btn-b btn-s" href="${esc(link)}" rel="noopener">${p.url_libre ? "Lire / télécharger" : "Voir la publication"} ↗</a>` : `<span class="chip">Version disponible sur demande</span>`}<button class="btn btn-g btn-s" data-cite="${esc(apa(p))}">Citer</button></div></article>`;
}
ROUTES.publications = () => {
  const P = ((AUT || {}).publications || []).slice().sort((x, y) => (y.annee || 0) - (x.annee || 0)); const types = [...new Set(P.map(p => p.type))];
  return head("Publications", `Les travaux de ${(AUT || {}).nom || "Dr Fabrice TANOH"}`, "Articles, chapitres, thèse, actes et outils de recherche, avec liens vers les versions en ligne.", `<a href="#auteur">Le chercheur</a>`) +
  `<section class="s"><div class="wrap"><div class="filters"><select id="puT"><option value="">Tous les types</option>${types.map(t => `<option value="${esc(t)}">${esc(PTYPES[t] || t)}</option>`).join("")}</select><input id="puQ" placeholder="Rechercher dans les publications…" aria-label="Rechercher"></div>
  <div class="grid g2" id="puList">${P.map(p => pubCard(p).replace('<article class="card pub"', `<article class="card pub" data-t="${esc(p.type)}" data-q="${esc(fold(p.titre + " " + p.resume + " " + p.revue))}"`)).join("") || `<div class="empty">Publications en cours de chargement.</div>`}</div>
  <div class="notice i" style="margin-top:24px">Profils complets : ${((AUT || {}).profils || []).map(p => `<a href="${esc(p.url)}" rel="noopener">${esc(p.nom)}</a>`).join(" · ")}</div></div></section>`;
};
AFTER.publications = () => { const f = () => { const t = $("#puT").value, q = fold($("#puQ").value); $$("#puList .pub").forEach(c => c.style.display = (!t || c.dataset.t === t) && (!q || c.dataset.q.includes(q)) ? "" : "none"); }; $("#puT").onchange = f; $("#puQ").oninput = f; wireCite(); };
function wireCite() { $$("[data-cite]").forEach(b => b.onclick = () => copy(b.dataset.cite)); }

/* ---------- RECHERCHE : catalogue d'articles réels en libre accès ---------- */
function rechCard(a) {
  const au = (a.auteurs || []); const auS = au.slice(0, 3).join(", ") + (au.length > 3 ? " et al." : "");
  const cite = `${au.join(", ")} (${a.annee}). ${a.titre}. ${a.revue}${a.volume ? ", " + a.volume : ""}${a.numero ? "(" + a.numero + ")" : ""}${a.pages ? ", " + a.pages : ""}.${a.doi ? " https://doi.org/" + a.doi : ""}`;
  return `<article class="card ra" data-th="${esc(a.theme)}" data-rg="${esc(a.region)}" data-lg="${esc(a.langue)}" data-y="${esc(a.annee)}" data-q="${esc(fold([a.titre, a.revue, au.join(" "), a.resume].join(" ")))}">
    <div class="meta"><span class="chip o">${esc(THEMES[a.theme] || a.theme || "")}</span><span>${esc(a.region || "")}</span><span>${esc(a.annee)}</span><span>${esc((a.langue || "").toUpperCase())}</span>${a.licence ? `<span class="chip g">${esc(a.licence)}</span>` : `<span class="chip g">Libre accès</span>`}</div>
    <h3 style="font-size:1.04rem">${esc(a.titre)}</h3><p style="font-size:.85rem;margin:0 0 4px">${esc(auS)}</p><p style="font-size:.85rem;font-style:italic;margin:0 0 8px">${esc(a.revue)}${a.volume ? ", vol. " + esc(a.volume) : ""}${a.numero ? ", n° " + esc(a.numero) : ""}</p>
    <p>${esc(a.resume || "")}</p><div style="display:flex;gap:8px;flex-wrap:wrap">${a.pdf ? `<a class="btn btn-b btn-s" href="${esc(a.pdf)}" rel="noopener">Télécharger le PDF ↓</a>` : ""}<a class="btn btn-g btn-s" href="${esc(a.url || ("https://doi.org/" + a.doi))}" rel="noopener">Page de l'article ↗</a><button class="btn btn-g btn-s" data-cite="${esc(cite)}">Citer</button></div></article>`;
}
ROUTES.recherche = th => {
  const A = ((RECH || {}).articles || []).slice().sort((x, y) => (y.annee || 0) - (x.annee || 0));
  const years = [...new Set(A.map(a => a.annee))].sort((a, b) => b - a), regions = [...new Set(A.map(a => a.region).filter(Boolean))], themes = [...new Set(A.map(a => a.theme).filter(Boolean))];
  return head("Recherche", "Articles scientifiques en libre accès", "Un catalogue d'articles réels publiés dans des revues nationales et internationales, sur les thèmes de la sociologie économique, recensés et vérifiés par l'agent Recherche. Chaque document est téléchargeable gratuitement à la source.") +
  `<section class="s"><div class="wrap"><div class="filters"><input id="rQ" placeholder="Titre, auteur, revue, mot-clé…" aria-label="Rechercher" style="flex:1;min-width:220px"><select id="rT"><option value="">Tous les thèmes</option>${themes.map(k => `<option value="${k}" ${k === th ? "selected" : ""}>${esc(THEMES[k] || k)}</option>`).join("")}</select><select id="rR"><option value="">Toutes régions</option>${regions.map(r => `<option>${esc(r)}</option>`).join("")}</select><select id="rL"><option value="">Toutes langues</option><option value="fr">Français</option><option value="en">Anglais</option></select><select id="rY"><option value="">Toutes années</option>${years.map(y => `<option>${y}</option>`).join("")}</select><label style="display:flex;gap:6px;align-items:center;font-size:.9rem"><input type="checkbox" id="rP"> PDF direct seulement</label></div>
  <p id="rCount" style="color:var(--muted);font-size:.9rem"></p><div class="grid g2" id="rList">${A.map(rechCard).join("") || `<div class="empty">Le catalogue est en cours de constitution.</div>`}</div>
  <div style="text-align:center;margin-top:20px"><button class="btn btn-g" id="rMore" hidden>Afficher plus</button></div>
  <div class="notice i" style="margin-top:30px"><b>Méthode —</b> ${esc((RECH || {}).methode || "")} Mise à jour : ${esc(fmtDate((RECH || {}).maj || ""))}. Les droits restent ceux des auteurs et des revues : téléchargez depuis la source et citez l'article original.</div>
  <div style="margin-top:30px">${adBox("article-lateral", true)}</div></div></section>`;
};
AFTER.recherche = () => {
  let lim = 20; const all = $$("#rList .ra");
  const f = () => { const q = fold($("#rQ").value), t = $("#rT").value, r = $("#rR").value, l = $("#rL").value, y = $("#rY").value, p = $("#rP").checked; let n = 0, shown = 0;
    all.forEach(c => { const ok = (!q || c.dataset.q.includes(q)) && (!t || c.dataset.th === t) && (!r || c.dataset.rg === r) && (!l || c.dataset.lg === l) && (!y || c.dataset.y === y) && (!p || c.querySelector('a[href][rel="noopener"].btn-b')); if (ok) n++; const vis = ok && shown < lim; if (vis) shown++; c.style.display = vis ? "" : "none"; });
    $("#rCount").textContent = `${n} article${n > 1 ? "s" : ""}`; $("#rMore").hidden = n <= lim; };
  $$("#rQ,#rT,#rR,#rL,#rY,#rP").forEach(e => e.oninput = () => { lim = 20; f(); }); $("#rMore").onclick = () => { lim += 20; f(); }; f(); wireCite();
};

/* ---------- DÉBATS SCIENTIFIQUES (espace contribution) ---------- */
ROUTES.contribuer = () => ROUTES.debats();
ROUTES.communaute = () => ROUTES.debats();
AFTER.contribuer = () => AFTER.debats(); AFTER.communaute = () => AFTER.debats();
ROUTES.debats = (arg) => {
  const L = S.debats.filter(d => d.status !== "retire");
  return head("Débats scientifiques", "Un espace d'échange scientifique et contradictoire", "Interviews thématiques, notes de réflexion, points de vue et comptes rendus de lecture d'enseignants, de chercheurs et d'étudiants. Chaque texte peut recevoir des répliques argumentées : prolongements, nuances ou contre-arguments.") +
  `<section class="s"><div class="wrap layout-2"><div>
    <div class="tabs" id="dbTabs"><button class="tab on" data-dt="">Tous</button>${Object.entries(DEB_TYPES).map(([k, v]) => `<button class="tab" data-dt="${k}">${v}</button>`).join("")}</div>
    <div id="dbList">${L.map(d => `<a class="card db-card" data-k="${esc(d.type)}" href="#debat-${esc(d._id)}" style="margin-bottom:14px"><div class="meta"><span class="chip o">${esc(DEB_TYPES[d.type] || d.type)}</span><span class="chip">${esc(THEMES[d.theme] || d.theme || "")}</span><span>${esc(fmtDate(d.date || ""))}</span><span>${(d.repliques || []).length} réplique(s)</span></div><h3>${esc(d.titre)}</h3><p>${esc(d.chapo || "")}</p><small style="color:var(--muted)">${esc(d.auteur)} · ${esc(d.statut)}${d.institution ? " · " + esc(d.institution) : ""}</small></a>`).join("") ||
      `<div class="empty"><b>Aucun débat publié pour le moment.</b><br>Les premières contributions de la communauté apparaîtront ici après vérification par l'agent Débats et l'éditeur.</div>`}</div>
    <h2 style="margin-top:40px" id="proposer">Proposer une contribution</h2>
    ${canPost() ? debatForm() : `<div class="notice">Les contributions sont ouvertes aux enseignants, chercheurs et étudiants connectés. Une version publique avec inscription est prévue lors de la mise en ligne du blog.</div>`}
  </div><aside>
    <div class="card"><div class="kicker">Formats acceptés</div><ul style="margin:10px 0 0;padding-left:1.1em">${Object.values(DEB_TYPES).map(v => `<li>${v}</li>`).join("")}</ul><p style="font-size:.88rem;margin-top:10px">Ce n'est pas une revue : pas de comité de lecture ni de publication académique. L'objectif est la discussion argumentée entre pairs.</p></div>
    <div class="card" style="margin-top:20px"><div class="kicker">Règles du débat</div><ul style="margin:10px 0 0;padding-left:1.1em;font-size:.92rem"><li>Contributions scientifiques et thématiques uniquement.</li><li>Argumenter, sourcer, citer les données.</li><li>Critiquer les idées, jamais les personnes.</li><li>Signer de son nom et indiquer son statut.</li><li>Pas de propagande partisane, de publicité ni d'attaque personnelle.</li></ul><a href="#chartes" style="font-size:.88rem">Charte de modération →</a></div>
    <div class="card" style="margin-top:20px"><div class="kicker">Modération</div><p style="font-size:.9rem">Chaque texte et chaque réplique est examiné par l'agent Débats (pertinence scientifique, respect de la charte), puis publié. L'éditeur peut retirer un contenu à tout moment.</p></div>
  </aside></div></section>`;
};
function debatForm() {
  return `<form class="card" id="dbForm"><div class="grid g2"><div class="field"><label for="dbTy">Format</label><select id="dbTy">${Object.entries(DEB_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div><div class="field"><label for="dbTh">Thème</label><select id="dbTh">${Object.entries(THEMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div></div>
  <div class="grid g2"><div class="field"><label for="dbAu">Nom et prénom</label><input id="dbAu" required maxlength="80"></div><div class="field"><label for="dbSt">Statut</label><select id="dbSt">${STATUTS.map(s => `<option>${s}</option>`).join("")}</select></div></div>
  <div class="field"><label for="dbIn">Institution ou laboratoire (facultatif)</label><input id="dbIn" maxlength="120"></div>
  <div class="field"><label for="dbTi">Titre</label><input id="dbTi" required maxlength="160"></div>
  <div class="field"><label for="dbCh">Chapeau (2-3 phrases : la question posée et votre thèse)</label><textarea id="dbCh" required maxlength="600" style="min-height:80px"></textarea></div>
  <div class="field"><label for="dbTx">Texte <small id="dbHint" style="color:var(--muted);font-weight:400"></small></label><textarea id="dbTx" required minlength="800" maxlength="18000" style="min-height:260px"></textarea></div>
  <div class="field"><label for="dbRf">Références et sources (une par ligne)</label><textarea id="dbRf" maxlength="3000" style="min-height:80px"></textarea></div>
  <label style="font-size:.88rem;display:flex;gap:8px"><input type="checkbox" required> Je certifie être enseignant·e, chercheur·e ou étudiant·e, être l'auteur·e de ce texte et accepter la charte du débat scientifique.</label>
  <button class="btn btn-o" style="margin-top:14px">Envoyer à la modération</button></form>`;
}
const DB_HINTS = { interview: "Format questions-réponses : 4 à 8 questions sur une thématique, avec l'interviewé·e et l'intervieweur·se identifiés.", note: "800 à 2 500 mots : une idée, des arguments, des données.", pointdevue: "600 à 1 500 mots : une position argumentée sur une question vive.", lecture: "Présentez l'ouvrage ou l'article, résumez, discutez.", question: "Posez une question de recherche ouverte et expliquez pourquoi elle compte." };
AFTER.debats = () => {
  $$("#dbTabs [data-dt]").forEach(b => b.onclick = () => { $$("#dbTabs .tab").forEach(x => x.classList.toggle("on", x === b)); $$("#dbList .db-card").forEach(c => c.style.display = !b.dataset.dt || c.dataset.k === b.dataset.dt ? "" : "none"); });
  const ty = $("#dbTy"); if (ty) { const h = () => $("#dbHint").textContent = DB_HINTS[ty.value] || ""; ty.onchange = h; h(); }
  const f = $("#dbForm"); if (f) f.onsubmit = async e => { e.preventDefault(); if (!S.uid) return toast("Connectez-vous pour contribuer.");
    await pushSubmission({ kind: "contribution", type: $("#dbTy").value, theme: $("#dbTh").value, auteur: $("#dbAu").value.trim(), statut: $("#dbSt").value, institution: $("#dbIn").value.trim(), titre: $("#dbTi").value.trim(), chapo: $("#dbCh").value.trim(), texte: $("#dbTx").value.trim(), references: $("#dbRf").value.split("\n").map(s => s.trim()).filter(Boolean) }) && f.reset(); };
};
async function pushSubmission(item) {
  try { const ref = S.db.doc("submissions/" + S.uid); const g = await ref.get(); const items = (g.exists && g.data().items) || [];
    const res = await ref.set({ items: [...items, Object.assign(item, { status: "soumis", by: S.uid, at: Date.now() })] });
    const st = res && res.status;
    toast(st === "publie" ? "Merci ! Votre texte a passé la modération et il est publié." : st === "refuse" ? "Votre texte ne respecte pas la charte des Débats et n'a pas été publié." : "Merci ! Votre texte est transmis à la modération."); return true; }
  catch (e) { toast((e && e.userMessage) || "Envoi impossible pour ce compte."); return false; }
}
ROUTES.debat = id => {
  const d = S.debats.find(x => x._id === id); if (!d) return S.db ? `<div class="wrap" style="padding:80px 20px">Chargement…</div>` : notFound();
  const reps = (d.repliques || []);
  return head(DEB_TYPES[d.type] || "Débat", d.titre, d.chapo, `<a href="#debats">Débats scientifiques</a>`) + `<section class="s"><div class="wrap layout-2"><article class="article" style="margin:0">
    <div class="meta" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px"><span class="chip">${esc(d.auteur)} · ${esc(d.statut)}</span>${d.institution ? `<span class="chip">${esc(d.institution)}</span>` : ""}<span class="chip o">${esc(THEMES[d.theme] || d.theme || "")}</span><span class="chip g">${esc(fmtDate(d.date || ""))}</span></div>
    ${String(d.texte || "").split(/\n+/).map(p => /^(Q|Question)\s*[:.–-]/i.test(p) ? `<p><b>${esc(p)}</b></p>` : `<p>${esc(p)}</p>`).join("")}
    ${(d.references || []).length ? `<h3>Références</h3><ul>${d.references.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
    <h2 style="margin-top:40px">Répliques (${reps.length})</h2>
    ${reps.map(r => `<div class="replique rp-${esc(r.position)}"><div class="meta"><span class="chip ${r.position === "desaccord" ? "o" : r.position === "accord" ? "g" : ""}">${esc(POSITIONS[r.position] || r.position)}</span><b>${esc(r.auteur)}</b><span>${esc(r.statut)}</span><span>${esc(fmtDate(r.date || ""))}</span></div><p>${esc(r.texte)}</p>${(r.references || []).length ? `<small>Sources : ${r.references.map(esc).join(" ; ")}</small>` : ""}</div>`).join("") || `<p style="color:var(--muted)">Aucune réplique pour l'instant. Apportez un prolongement, une nuance ou un contre-argument.</p>`}
    ${canPost() ? `<form class="card" id="rpForm" style="margin-top:20px"><div class="kicker">Répliquer</div><div class="grid g2" style="margin-top:10px"><div class="field"><label for="rpAu">Nom et prénom</label><input id="rpAu" required maxlength="80"></div><div class="field"><label for="rpSt">Statut</label><select id="rpSt">${STATUTS.map(s => `<option>${s}</option>`).join("")}</select></div></div><div class="field"><label for="rpPo">Nature de la réplique</label><select id="rpPo">${Object.entries(POSITIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div><div class="field"><label for="rpTx">Argument (150 à 1 200 mots)</label><textarea id="rpTx" required minlength="400" maxlength="9000"></textarea></div><div class="field"><label for="rpRf">Sources (une par ligne)</label><textarea id="rpRf" maxlength="2000" style="min-height:70px"></textarea></div><button class="btn btn-b btn-s">Envoyer à la modération</button></form>` : ""}
  </article><aside>${adBox("article-lateral")}</aside></div></section>`;
};
AFTER.debat = id => { const f = $("#rpForm"); if (f) f.onsubmit = async e => { e.preventDefault(); await pushSubmission({ kind: "replique", target: id, auteur: $("#rpAu").value.trim(), statut: $("#rpSt").value, position: $("#rpPo").value, texte: $("#rpTx").value.trim(), references: $("#rpRf").value.split("\n").map(s => s.trim()).filter(Boolean) }) && f.reset(); }; };

/* ---------- CONSOLE : agents, rapport du superviseur, modération des débats ---------- */
const CONSOLE_OLD = ROUTES.console;
ROUTES.console = () => {
  const base = CONSOLE_OLD();
  const ag = (AGENTS_CFG || {}).agents || []; const R = RAPPORT || {};
  const deb = S.canEdit ? S.subs.filter(s => s.kind && (s.status === "soumis" || s.status === "a_revoir")) : [];
  const block = `<section class="s alt"><div class="wrap">
    <div class="sh"><div><div class="kicker">Pilotage automatique</div><h2>Agents IA programmés</h2><p>Chaque agent travaille chaque jour sur sa partie du site ; le superviseur contrôle l'ensemble et rédige un rapport.</p></div></div>
    <div class="grid g3">${ag.map(a => `<div class="card agent"><div class="ico" style="background:${esc(a.couleur || "#0E2A47")}">${esc((a.nom || "?").split(" ").pop()[0])}</div><div><h3 style="margin:0;font-size:1.05rem">${esc(a.nom)}</h3><small style="color:var(--muted)">${esc(a.horaire || "")}</small><p style="margin:.4em 0 0">${esc(a.mission)}</p>${(R.taches || []).filter(t => t.agent === a.id).map(t => `<p style="margin:.4em 0 0;font-size:.85rem"><span class="status ${t.statut === "ok" ? "published" : t.statut === "alerte" ? "rejected" : "pending"}">${esc(t.statut)}</span> ${esc(t.resume || "")}</p>`).join("")}</div></div>`).join("") || `<div class="empty">Configuration des agents en attente.</div>`}</div>
    <div class="card" style="margin-top:24px"><div class="kicker">Rapport du superviseur</div>${R.date ? `<h3>${esc(fmtDate(R.date))} — ${esc(R.titre || "Rapport quotidien")}</h3><p>${esc(R.resume || "")}</p>
      ${(R.controles || []).length ? `<table class="t"><thead><tr><th>Contrôle</th><th>Résultat</th></tr></thead><tbody>${R.controles.map(c => `<tr><td>${esc(c.nom)}</td><td><span class="status ${c.ok ? "published" : "rejected"}">${c.ok ? "OK" : "À corriger"}</span> ${esc(c.detail || "")}</td></tr>`).join("")}</tbody></table>` : ""}
      ${(R.optimisations || []).length ? `<div class="kicker" style="margin-top:14px">Optimisations proposées</div><ul>${R.optimisations.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}` : `<p style="color:var(--muted)">Le premier rapport sera produit après le premier cycle des agents.</p>`}</div>
    ${S.canEdit ? `<div class="card" style="margin-top:24px"><div class="kicker">Débats scientifiques en attente</div>${deb.map(s => `<div class="post">${s.status === "a_revoir" ? `<span class="status rejected">à revoir${s.motif ? " : " + esc(s.motif) : ""}</span> ` : ""}<span class="chip o">${s.kind === "replique" ? "Réplique · " + esc(POSITIONS[s.position] || "") : esc(DEB_TYPES[s.type] || "")}</span> <b>${esc(s.titre || (S.debats.find(d => d._id === s.target) || {}).titre || "")}</b><br><small>${esc(s.auteur)} · ${esc(s.statut)}</small><p style="margin:6px 0">${esc((s.chapo || s.texte || "").slice(0, 300))}…</p><button class="btn btn-b btn-s" data-dbok="${esc(s._id)}">Publier</button> <button class="btn btn-g btn-s" data-dbko="${esc(s._id)}">Refuser</button></div>`).join("") || `<p style="color:var(--muted)">Aucune contribution en attente : l'agent Débats traite les envois chaque jour.</p>`}</div>` : ""}
  </div></section>`;
  return base.replace('<section class="s">', block + '<section class="s">');
};
const CONSOLE_AFTER_OLD = AFTER.console;
AFTER.console = () => { CONSOLE_AFTER_OLD();
  $$("[data-dbok],[data-dbko]").forEach(b => b.onclick = async () => { const s = S.subs.find(x => x._id === (b.dataset.dbok || b.dataset.dbko)); const ok = !!b.dataset.dbok;
    try { const ref = S.db.doc("submissions/" + s._doc); const g = await ref.get(); const items = [...(g.data().items || [])]; items[s._i] = { ...items[s._i], status: ok ? "publie" : "refuse" }; await ref.update({ items });
      if (ok) { const { _id, _doc, _i, by, status, at, kind, target, ...pub } = s;
        if (kind === "contribution") await S.db.collection("debats").add({ ...pub, date: today(), status: "publie", repliques: [] });
        else { const dref = S.db.doc("debats/" + target); const dg = await dref.get(); await dref.update({ repliques: [...((dg.data() || {}).repliques || []), { ...pub, date: today() }] }); } }
      audit("Éditeur", `${ok ? "Publication" : "Refus"} : ${s.titre || "réplique"}`); toast("Décision enregistrée"); } catch { toast("Action impossible."); } }); };

/* ---------- graphiques et schémas dans les diapositives des cours ---------- */
window.drawSlideChart = function (d) {
  const cv = $("#slChart"); if (!cv || !window.Chart) return;
  const pal = ["#F77F00", "#0E2A47", "#009E60"];
  new Chart(cv, { type: d.kind === "line" ? "line" : "bar", data: { labels: d.labels, datasets: (d.series || []).map((s, i) => ({ label: s.nom, data: s.valeurs, backgroundColor: d.kind === "line" ? pal[i] + "33" : pal[i], borderColor: pal[i], borderWidth: 2, tension: .3, fill: d.kind === "line" && i === 0 })) },
    options: { maintainAspectRatio: false, animation: { duration: 1200 }, plugins: { legend: { display: (d.series || []).length > 1, labels: { color: "#2B2D31" } } }, scales: { x: { ticks: { color: "#2B2D31" }, grid: { display: false } }, y: { ticks: { color: "#2B2D31" }, title: { display: !!d.unite, text: d.unite, color: "#2B2D31" } } } } });
};


/* ---------- PODCAST SOCIOLOGIQUE « Socio-Éco » (géré avec l'agent Promotion & vulgarisation) ---------- */
const fmtDuree = s => { s = Math.round(s || 0); return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`; };
const EPS = () => ((PODCAST || {}).episodes || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.numero - a.numero);
function epCard(e, big) {
  return `<article class="card ep-card${big ? " ep-big" : ""}"><div class="ep-num" aria-hidden="true">${String(e.numero).padStart(2, "0")}</div><div class="ep-body">
    <div class="meta"><span class="chip o">Épisode ${e.numero}</span><span class="chip">${esc(THEMES[e.theme] || e.theme || "")}</span><span>${fmtDuree(e.duree_s)}</span><span>${esc(fmtDate(e.date || ""))}</span></div>
    <h3><a href="#podcast-${esc(e.id)}">${esc(e.titre)}</a></h3><p>${esc(e.resume)}</p>
    ${e.audio ? `<audio controls preload="none" src="${esc(e.audio)}" aria-label="Écouter : ${esc(e.titre)}"></audio>` : ""}
    <div class="ep-links"><a href="#podcast-${esc(e.id)}">Transcription et sources →</a>${e.audio ? `<a href="${esc(e.audio)}" download>Télécharger le MP3</a>` : ""}</div></div></article>`;
}
ROUTES.podcast = (arg) => {
  const P = PODCAST || {}; const L = EPS();
  if (arg) {
    const e = L.find(x => x.id === arg); if (!e) return PODCAST ? notFound() : `<div class="wrap" style="padding:80px 20px">Chargement…</div>`;
    const i = L.indexOf(e), prev = L[i + 1], next = L[i - 1];
    return head(`${P.titre || "Podcast"} · épisode ${e.numero}`, e.titre, e.resume, `<a href="#podcast">Podcast sociologique</a>`) +
    `<section class="s"><div class="wrap layout-2"><article>
      <div class="card ep-player">${e.audio ? `<audio controls preload="metadata" src="${esc(e.audio)}" style="width:100%"></audio>` : ""}
        <div class="meta" style="margin-top:10px"><span class="chip">${esc(THEMES[e.theme] || "")}</span><span>${fmtDuree(e.duree_s)}</span><span>${esc(fmtDate(e.date || ""))}</span>${e.audio ? `<a href="${esc(e.audio)}" download>Télécharger le MP3</a>` : ""}<button class="btn btn-g btn-s" id="epShare">Partager</button></div></div>
      <h2 style="margin-top:32px">Transcription</h2>
      <div class="transcript">${(e.dialogue || []).map(([w, t]) => `<p><b class="spk spk-${w === "Aïcha" ? "a" : "m"}">${esc(w)}</b> ${esc(t)}</p>`).join("")}</div>
      ${(e.sources || []).length ? `<h2>Sources</h2><ul class="refs">${e.sources.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <div class="ep-nav">${prev ? `<a class="btn btn-g btn-s" href="#podcast-${esc(prev.id)}">← ${esc(prev.titre)}</a>` : "<span></span>"}${next ? `<a class="btn btn-g btn-s" href="#podcast-${esc(next.id)}">${esc(next.titre)} →</a>` : ""}</div>
    </article><aside>
      ${(e.liens || []).length ? `<div class="card"><div class="kicker">Pour aller plus loin</div><ul style="margin:10px 0 0;padding-left:1.1em">${e.liens.map(l => `<li><a href="${esc(l.url)}">${esc(l.titre)}</a></li>`).join("")}</ul></div>` : ""}
      <div class="card" style="margin-top:20px"><div class="kicker">Réagir</div><p style="font-size:.92rem">Une nuance, un contre-argument, une donnée à ajouter ? Publiez une note ou un point de vue dans l'espace Débats.</p><a class="btn btn-o btn-s" href="#debats">Aller aux Débats</a></div>
      <div class="card" style="margin-top:20px"><p style="font-size:.85rem;color:var(--muted);margin:0">${esc(P.voix || "")}</p></div>
    </aside></div></section>`;
  }
  return head("Podcast sociologique", P.titre || "Socio-Éco, le podcast", P.sous_titre || "") +
  `<section class="s"><div class="wrap layout-2"><div>
    <p class="pod-intro">${esc(P.presentation || "")}</p>
    <div class="tabs" id="epTabs"><button class="tab on" data-et="">Tous</button>${[...new Set(L.map(e => e.theme))].map(t => `<button class="tab" data-et="${esc(t)}">${esc(THEMES[t] || t)}</button>`).join("")}</div>
    <div id="epList">${L.map((e, i) => `<div class="ep-wrap" data-t="${esc(e.theme)}">${epCard(e, i === 0)}</div>`).join("") || `<div class="empty">Les premiers épisodes arrivent bientôt.</div>`}</div>
  </div><aside>
    <div class="card pod-cover"><img src="img/podcast-cover.jpg" alt="Socio-Éco, le podcast de sociologie économique" width="1400" height="1400" loading="lazy" style="width:100%;height:auto;border-radius:16px"><div class="kicker" style="margin-top:14px">Le podcast du blog</div><p style="font-size:.92rem">${L.length} épisode(s) · un nouvel épisode chaque semaine, préparé par l'agent Promotion &amp; vulgarisation et relu avant publication.</p>
      <a class="btn btn-b btn-s" href="podcast.xml" target="_blank" rel="noopener">Flux RSS du podcast</a></div>
    <div class="card" style="margin-top:20px"><div class="kicker">Proposer un épisode</div><p style="font-size:.92rem">Enseignant·e, chercheur·e ou étudiant·e : proposez un thème ou une interview autour de votre recherche. Choisissez le format « Interview thématique » dans le formulaire des Débats.</p><a class="btn btn-o btn-s" href="#debats" data-propose-ep>Proposer une interview</a></div>
    <div class="card" style="margin-top:20px"><p style="font-size:.85rem;color:var(--muted);margin:0">${esc(P.voix || "")}</p></div>
  </aside></div></section>`;
};
AFTER.podcast = (arg) => {
  $$("#epTabs [data-et]").forEach(b => b.onclick = () => { $$("#epTabs .tab").forEach(x => x.classList.toggle("on", x === b)); $$("#epList .ep-wrap").forEach(c => c.style.display = !b.dataset.et || c.dataset.t === b.dataset.et ? "" : "none"); });
  const pr = $("[data-propose-ep]"); if (pr) pr.onclick = () => setTimeout(() => { const t = $("#dbTy"); if (t) { t.value = "interview"; t.dispatchEvent(new Event("change")); } const f = $("#proposer"); if (f) f.scrollIntoView({ behavior: "smooth" }); }, 350);
  // un seul lecteur à la fois
  $$("audio").forEach(a => a.addEventListener("play", () => $$("audio").forEach(o => { if (o !== a) o.pause(); })));
  const sh = $("#epShare"); if (sh) sh.onclick = async () => { const url = location.href; try { if (navigator.share) await navigator.share({ title: document.title, url }); else { await navigator.clipboard.writeText(url); toast("Lien copié"); } } catch {} };
};
// Lien vers le podcast dans l'espace Débats et sur l'accueil
(function () {
  const deb = ROUTES.debats;
  ROUTES.debats = (arg) => { const h = deb(arg); const e = EPS()[0]; if (!e) return h;
    return h.replace("<aside>", `<aside><div class="card pod-teaser"><div class="kicker">Podcast sociologique</div><h3 style="margin:6px 0">${esc(e.titre)}</h3><p style="font-size:.9rem">${esc(e.resume)}</p>${e.audio ? `<audio controls preload="none" src="${esc(e.audio)}" style="width:100%"></audio>` : ""}<a href="#podcast" style="display:inline-block;margin-top:8px">Tous les épisodes →</a></div><div style="height:20px"></div>`); };
  const debA = AFTER.debats; AFTER.debats = (a) => { debA(a); $$("audio").forEach(x => x.addEventListener("play", () => $$("audio").forEach(o => { if (o !== x) o.pause(); }))); };
  const acc = ROUTES.accueil;
  ROUTES.accueil = (arg) => { const h = acc(arg); const L = EPS().slice(0, 3); if (!L.length) return h;
    return h + `<section class="s"><div class="wrap"><div class="sh"><div><div class="kicker">Podcast sociologique</div><h2>Écouter la sociologie économique</h2></div><a href="#podcast">Tous les épisodes →</a></div><div class="grid g3">${L.map(e => `<article class="card"><div class="meta"><span class="chip o">Épisode ${e.numero}</span><span>${fmtDuree(e.duree_s)}</span></div><h3 style="font-size:1.05rem"><a href="#podcast-${esc(e.id)}">${esc(e.titre)}</a></h3>${e.audio ? `<audio controls preload="none" src="${esc(e.audio)}" style="width:100%"></audio>` : ""}</article>`).join("")}</div></div></section>`; };
})();

/* ---------- Console : kit de promotion préparé par l'agent Promotion & vulgarisation ---------- */
(function () {
  const cons = ROUTES.console;
  ROUTES.console = () => { const h = cons(); const P = PROMO; if (!P) return h;
    const block = `<section class="s"><div class="wrap"><div class="sh"><div><div class="kicker">Agent Promotion &amp; vulgarisation</div><h2>Kit de diffusion à valider</h2></div></div>
      <div class="grid g2"><div class="card"><div class="kicker">Publications prêtes pour les réseaux</div>${(P.publications_reseaux || []).slice(-6).reverse().map(p => `<div class="post"><small class="chip">${esc(p.reseau)}</small> <small>${esc(p.statut || "")}</small><p style="margin:6px 0;white-space:pre-wrap">${esc(p.texte)}</p><button class="btn btn-g btn-s" data-copy="${esc(p.texte)}">Copier</button></div>`).join("")}</div>
      <div class="card"><div class="kicker">Institutions ciblées</div><table class="t"><thead><tr><th>Institution</th><th>Statut</th></tr></thead><tbody>${(P.cibles || []).map(c => `<tr><td>${esc(c.nom)}<br><small>${esc(c.angle || "")}</small></td><td>${esc(c.statut || "")}</td></tr>`).join("")}</tbody></table>
      <p style="font-size:.85rem;color:var(--muted)">Les brouillons d'e-mails sont déposés dans votre boîte Gmail (dossier Brouillons) ; rien n'est envoyé sans vous.</p></div></div></div></section>`;
    return h.replace(/(<\/section>)(?![\s\S]*<\/section>)/, "$1" + block); };
  const ca = AFTER.console; AFTER.console = (a) => { ca(a); $$("[data-copy]").forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Texte copié"); } catch {} }); };
})();
