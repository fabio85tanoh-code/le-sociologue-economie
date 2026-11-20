/* Le Sociologue de l'Économie — Formations certifiantes gratuites (Savoirs & apprentissage)
   Données : data/formations.json (tenu par l'Agent Savoirs & Certification).
   Progression des modules : navigateur de l'apprenant. Examen final noté côté serveur,
   attestation numérotée, signée (HMAC) et inscrite au registre par /api/certificats (site public). */
"use strict";
(function () {
  const PUBLIC = "https://le-sociologue-economie.pages.dev";
  const onPublic = /\.pages\.dev$/.test(location.hostname) || /sociologue/.test(location.hostname);
  let F = null, loading = null;
  const PROFILS = ["Étudiant·e", "Enseignant·e", "Chercheur·e", "Praticien·ne (ONG, administration, entreprise)", "Journaliste", "Citoyen·ne"];
  const RLINK = { fiche: "#fiche-", article: "#article-", cas: "#cas-", cours: "#cours-", quiz: "#quiz-", debat: "#savoirs-parcours", glossaire: "#savoirs-glossaire" };
  const RLAB = { fiche: "Fiche", article: "Article", cas: "Étude de cas", cours: "Cours animé", quiz: "Quiz", debat: "Débat", glossaire: "Glossaire" };

  function load() {
    if (F) return Promise.resolve(F);
    if (!loading) loading = fetch("data/formations.json").then(r => r.ok ? r.json() : null).catch(() => null).then(d => (F = d));
    return loading;
  }
  function rerender() { load().then(() => route(true)); }
  const P = id => ((F && F.parcours) || []).find(p => p.id === id);
  const prog = () => { try { return JSON.parse(localStorage.getItem("lse-formations") || "{}"); } catch { return {}; } };
  const saveProg = o => { try { localStorage.setItem("lse-formations", JSON.stringify(o)); } catch {} };
  const passed = (pid, mid) => !!((prog()[pid] || {})[mid]);
  const pct = p => Math.round(100 * p.modules.filter(m => passed(p.id, m.id)).length / p.modules.length);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const draw = (qs, n) => shuffle(qs).slice(0, Math.min(n, qs.length)).map(q => { const order = shuffle(q.options.map((_, i) => i)); return { ...q, order }; });

  /* ---------- styles propres au module ---------- */
  const css = `
  .fm-hero{background:linear-gradient(135deg,var(--blue,#0E2A47),#1d4f80);color:#fff;border-radius:var(--r,18px);padding:28px;margin:24px 0}
  .fm-hero h2{font-family:var(--serif);margin:0 0 8px;color:#fff}.fm-hero p{opacity:.92;margin:0 0 14px}
  .fm-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:14px}
  .fm-steps div{background:rgba(255,255,255,.1);border-radius:12px;padding:12px;font-size:.9rem}.fm-steps b{display:block;color:#F7B267}
  .fm-bar{height:8px;border-radius:8px;background:var(--line,#e5e7eb);overflow:hidden;margin:10px 0}.fm-bar i{display:block;height:100%;background:var(--green,#009E60)}
  .fm-mod{border:1px solid var(--line,#e5e7eb);border-radius:var(--r,16px);padding:18px;margin:14px 0;background:var(--card,#fff)}
  .fm-mod.ok{border-color:var(--green,#009E60)}.fm-mod h3{margin:.2em 0}
  .fm-res{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.fm-res a{font-size:.88rem}
  .fm-q{border-top:1px solid var(--line,#e5e7eb);padding:14px 0}.fm-q label{display:block;padding:6px 8px;border-radius:8px;cursor:pointer}
  .fm-q label:hover{background:var(--bg-2,#f3f4f6)}.fm-q .good{background:rgba(0,158,96,.12)}.fm-q .bad{background:rgba(194,65,12,.12)}
  .fm-ex{font-size:.9rem;color:var(--muted,#6b7280);margin-top:6px}
  .fm-mod input,.fm-mod select{max-width:100%;box-sizing:border-box}.fm-q label{overflow-wrap:anywhere}
  .fm-lecon{margin:10px 0;padding:10px 14px;border-radius:10px;background:var(--bg-2,#f3f4f6)}.fm-lecon summary{cursor:pointer}
  .fm-score{font-size:1.4rem;font-weight:800;margin:10px 0}
  .fm-cert{width:100%;max-width:1000px;aspect-ratio:1.414;margin:24px auto;background:#fff;color:#0E2A47;border:10px solid #0E2A47;outline:3px solid #F77F00;outline-offset:-22px;position:relative;padding:5% 7%;box-sizing:border-box;font-family:var(--serif,Georgia,serif);display:flex;flex-direction:column;justify-content:space-between}
  .fm-cert .k{font-family:var(--sans,sans-serif);letter-spacing:.18em;text-transform:uppercase;font-size:clamp(.55rem,1.3vw,.85rem);color:#009E60;font-weight:700}
  .fm-cert h2{font-size:clamp(1.2rem,4vw,2.6rem);margin:.2em 0;color:#0E2A47}.fm-cert .nom{font-size:clamp(1.1rem,3.6vw,2.3rem);font-weight:800;border-bottom:2px solid #F77F00;display:inline-block;padding:0 .4em}
  .fm-cert p{font-size:clamp(.62rem,1.45vw,1rem);margin:.35em 0;line-height:1.45}.fm-cert .bas{display:flex;justify-content:space-between;align-items:flex-end;gap:4%;font-family:var(--sans,sans-serif)}
  .fm-cert .sceau{width:clamp(56px,11vw,110px);height:clamp(56px,11vw,110px);border-radius:50%;border:3px double #0E2A47;display:flex;align-items:center;justify-content:center;text-align:center;font-size:clamp(.42rem,.9vw,.66rem);font-weight:800;color:#0E2A47;line-height:1.2;padding:6px;box-sizing:border-box}
  .fm-cert .qr{width:clamp(64px,12vw,120px)}.fm-cert .qr img,.fm-cert .qr canvas{width:100%!important;height:auto!important}
  .fm-cert .meta{font-size:clamp(.5rem,1.05vw,.75rem);color:#374151}
  .fm-ok{border-left:5px solid var(--green,#009E60);padding:14px 18px;background:rgba(0,158,96,.08);border-radius:10px}
  .fm-ko{border-left:5px solid #C2410C;padding:14px 18px;background:rgba(194,65,12,.08);border-radius:10px}
  @media print{body *{visibility:hidden}.fm-cert,.fm-cert *{visibility:visible}.fm-cert{position:fixed;left:0;top:0;width:100%;max-width:none;margin:0}@page{size:A4 landscape;margin:0}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- navigation ---------- */
  try {
    const nav = document.getElementById("nav");
    if (nav && !nav.querySelector('[data-r="formations"]')) {
      const a = document.createElement("a"); a.href = "#formations"; a.dataset.r = "formations"; a.textContent = "Formations";
      const ref = nav.querySelector('[data-r="savoirs"]'); ref ? ref.after(a) : nav.appendChild(a);
    }
  } catch {}

  const wait = `<div class="wrap" style="padding:60px 20px;color:var(--muted)">Chargement des formations…</div>`;
  const statutChip = p => p.statut === "ouvert" ? `<span class="chip g">Certifiant · ouvert</span>` : `<span class="chip o">En préparation</span>`;

  /* ---------- catalogue ---------- */
  ROUTES.formations = () => {
    if (!F) { rerender(); return wait; }
    const A = F.attestation || {};
    return head("Savoirs & apprentissage", "Formations certifiantes gratuites", "Des parcours complets de sociologie économique de la Côte d'Ivoire, avec évaluations et attestation numérotée, vérifiable en ligne.", `<a href="#savoirs">Savoirs</a> / Formations`) +
      `<div class="wrap">
      <div class="fm-hero"><h2>Se former, être évalué, obtenir une attestation</h2>
        <p>Chaque parcours associe cours animés, fiches, études de cas, glossaire et exercices. L'attestation est délivrée automatiquement au nom de ${esc(A.delivree_par || "Dr Fabrice TANOH")}, ${esc(A.qualite || "")}.</p>
        <div class="fm-steps"><div><b>1. Étudier</b>Ressources de chaque module</div><div><b>2. Valider</b>Quiz de module : ${F.seuil} % requis</div><div><b>3. Examen final</b>${F.regles.examen.nb_questions} questions, ${F.regles.examen.seuil} % requis</div><div><b>4. Attestation</b>Numéro unique, QR code, signature vérifiable</div></div></div>
      <div class="grid g2">${F.parcours.map(p => `<a class="card" href="#formation-${p.id}"><div class="meta">${statutChip(p)}<span class="chip">${esc(NIV[p.niveau] || p.niveau)}</span><span>${p.heures} h · ${p.modules.length} modules</span></div>
        <h3>${esc(p.titre)}</h3><p>${esc(p.description)}</p><div class="fm-bar" aria-label="Progression ${pct(p)} %"><i style="width:${pct(p)}%"></i></div><small>${pct(p)} % des modules validés · Badge « ${esc(p.badge)} »</small></a>`).join("")}</div>
      <p style="margin-top:22px"><a class="btn btn-o" href="#verifier">Vérifier une attestation</a></p>
      <p class="fm-ex">${esc(A.mention_legale || "")}</p></div>`;
  };

  /* ---------- parcours ---------- */
  ROUTES.formation = pid => {
    if (!F) { rerender(); return wait; }
    const p = P(pid); if (!p) return ROUTES.formations();
    const all = p.modules.every(m => passed(p.id, m.id));
    return head(NIV[p.niveau] || "", p.titre, p.description, `<a href="#formations">Formations</a> / ${esc(p.titre)}`) +
      `<div class="wrap"><div class="meta" style="margin:16px 0">${statutChip(p)}<span>${p.heures} heures</span><span>Public : ${esc(p.public)}</span></div>
      <div class="fm-bar"><i style="width:${pct(p)}%"></i></div><p><b>${pct(p)} %</b> des modules validés</p>
      ${p.modules.map((m, i) => `<section class="fm-mod ${passed(p.id, m.id) ? "ok" : ""}"><div class="meta"><span class="chip">Module ${i + 1}</span><span>${m.duree_min} min</span>${passed(p.id, m.id) ? `<span class="chip g">Validé</span>` : ""}</div>
        <h3>${esc(m.titre)}</h3><ul>${m.objectifs.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
        <div class="fm-res">${m.ressources.map(r => `<a class="chip" href="${RLINK[r.type] || "#savoirs"}${r.type === "debat" || r.type === "glossaire" ? "" : esc(r.id)}">${esc(RLAB[r.type] || r.type)} · ${esc(r.titre)}</a>`).join("")}</div>
        ${m.lecon && (m.lecon.sections || []).length ? `<details class="fm-lecon"><summary><b>Leçon du module</b></summary>${m.lecon.sections.map(x => `<h4>${esc(x.titre)}</h4><p>${esc(x.texte)}</p>`).join("")}${(m.lecon.a_retenir || []).length ? `<p><b>À retenir</b></p><ul>${m.lecon.a_retenir.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${(m.lecon.references || []).length ? `<p class="fm-ex">Références : ${m.lecon.references.map(r => esc([r.auteur, r.annee && "(" + r.annee + ")", r.titre && "« " + r.titre + " »", r.editeur].filter(Boolean).join(" "))).join(" ; ")}</p>` : ""}</details>` : ""}
        <p><b>Activité :</b> ${esc(m.activite)}</p>
        ${m.questions.length >= F.regles.min_questions_module ? `<a class="btn btn-s ${passed(p.id, m.id) ? "" : "btn-o"}" href="#fquiz-${p.id}-${m.id}">${passed(p.id, m.id) ? "Refaire le quiz" : "Passer le quiz du module"}</a>` : `<small class="fm-ex">Quiz en cours de rédaction.</small>`}</section>`).join("")}
      <section class="fm-mod"><h3>Examen final et attestation</h3>
      ${p.statut !== "ouvert" ? `<p>Ce parcours est en préparation : l'examen ouvrira dès que toutes les banques de questions seront complètes.</p>` :
        all ? `<p>Tous les modules sont validés. L'examen comporte ${F.regles.examen.nb_questions} questions tirées au hasard dans l'ensemble du parcours ; ${F.regles.examen.seuil} % de bonnes réponses sont nécessaires.</p><a class="btn btn-o" href="#fexamen-${p.id}">Passer l'examen final</a>` :
        `<p>Validez d'abord les ${p.modules.length} modules (${F.seuil} % à chaque quiz).</p>`}</section></div>`;
  };

  /* ---------- quiz de module et examen ---------- */
  let CUR = null;
  const qHTML = (qs, name) => qs.map((q, i) => `<div class="fm-q" data-i="${i}"><b>${i + 1}. ${esc(q.q)}</b>${q.order.map(k => `<label><input type="radio" name="${name}${i}" value="${k}" required> ${esc(q.options[k])}</label>`).join("")}<div class="fm-ex" hidden></div></div>`).join("");
  ROUTES.fquiz = arg => {
    if (!F) { rerender(); return wait; }
    const [pid, mid] = arg.split("-"); const p = P(pid); const m = p && p.modules.find(x => x.id === mid); if (!m) return ROUTES.formations();
    CUR = { pid, mid, qs: draw(m.questions, F.regles.quiz_module.nb_questions) };
    return head(p.titre, "Quiz : " + m.titre, `${CUR.qs.length} questions · ${F.regles.quiz_module.seuil} % requis pour valider le module`, `<a href="#formation-${pid}">${esc(p.titre)}</a> / Quiz`) +
      `<div class="wrap"><form id="fmQuiz">${qHTML(CUR.qs, "q")}<button class="btn btn-o" type="submit">Corriger</button></form><div id="fmRes" aria-live="polite"></div></div>`;
  };
  AFTER.fquiz = () => {
    const f = document.getElementById("fmQuiz"); if (!f || !CUR) return;
    f.onsubmit = e => {
      e.preventDefault(); let ok = 0;
      CUR.qs.forEach((q, i) => {
        const box = f.querySelector(`.fm-q[data-i="${i}"]`); const v = +((f.querySelector(`input[name=q${i}]:checked`) || {}).value ?? -1);
        box.querySelectorAll("label").forEach(l => { const k = +l.querySelector("input").value; if (k === q.bonne) l.classList.add("good"); else if (k === v) l.classList.add("bad"); });
        const ex = box.querySelector(".fm-ex"); ex.hidden = false; ex.textContent = (q.explication || "") + (q.source ? " — " + q.source : "");
        if (v === q.bonne) ok++;
      });
      const s = Math.round(100 * ok / CUR.qs.length), win = s >= F.regles.quiz_module.seuil;
      if (win) { const o = prog(); (o[CUR.pid] = o[CUR.pid] || {})[CUR.mid] = { score: s, date: today() }; saveProg(o); }
      f.querySelector("button[type=submit]").remove();
      document.getElementById("fmRes").innerHTML = `<div class="${win ? "fm-ok" : "fm-ko"}"><div class="fm-score">${s} % (${ok}/${CUR.qs.length})</div>${win ? "Module validé." : `Il faut ${F.regles.quiz_module.seuil} %. Relisez les explications et les ressources, puis réessayez : les questions changent à chaque tentative.`}</div>
        <p style="margin-top:12px"><a class="btn" href="#formation-${CUR.pid}">Retour au parcours</a> ${win ? "" : `<a class="btn btn-o" href="#fquiz-${CUR.pid}-${CUR.mid}" onclick="setTimeout(()=>route(),0)">Nouvelle tentative</a>`}</p>`;
      document.getElementById("fmRes").scrollIntoView({ behavior: "smooth" });
    };
  };

  ROUTES.fexamen = pid => {
    if (!F) { rerender(); return wait; }
    const p = P(pid); if (!p || p.statut !== "ouvert") return ROUTES.formation(pid);
    if (!p.modules.every(m => passed(p.id, m.id))) return ROUTES.formation(pid);
    const pool = p.modules.flatMap(m => m.questions);
    CUR = { pid, exam: true, qs: draw(pool, F.regles.examen.nb_questions) };
    const where = onPublic ? "" : `<div class="fm-ko" style="margin:16px 0">La délivrance des attestations se fait sur le site public. <a href="${PUBLIC}/#formation-${pid}">Passer l'examen sur le-sociologue-economie.pages.dev</a> (votre progression dans les modules est propre à chaque site).</div>`;
    return head(p.titre, "Examen final", `${CUR.qs.length} questions · ${F.regles.examen.seuil} % requis · durée indicative ${F.regles.examen.duree_min} min`, `<a href="#formation-${pid}">${esc(p.titre)}</a> / Examen`) +
      `<div class="wrap">${where}<form id="fmExam">
      <div class="fm-mod"><h3>Vos informations pour l'attestation</h3>
        <label>Nom et prénoms (tels qu'ils figureront sur l'attestation)<br><input id="fmNom" required minlength="4" maxlength="80" autocomplete="name" style="width:100%"></label>
        <label style="display:block;margin-top:10px">Profil<br><select id="fmProf">${PROFILS.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
        <label style="display:block;margin-top:10px"><input type="checkbox" id="fmOk" required> J'atteste répondre seul·e et j'accepte que mon nom, le parcours, la date et le score figurent dans le registre public de vérification des attestations.</label></div>
      ${qHTML(CUR.qs, "e")}<button class="btn btn-o" type="submit" ${onPublic ? "" : "disabled"}>Envoyer mes réponses</button></form><div id="fmRes" aria-live="polite"></div></div>`;
  };
  AFTER.fexamen = () => {
    const f = document.getElementById("fmExam"); if (!f || !CUR) return;
    f.onsubmit = async e => {
      e.preventDefault(); const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Correction en cours…";
      const reponses = CUR.qs.map((q, i) => ({ id: q.id, choix: +((f.querySelector(`input[name=e${i}]:checked`) || {}).value ?? -1) }));
      const modules = Object.entries(prog()[CUR.pid] || {}).map(([id, v]) => ({ id, score: v.score, date: v.date }));
      const out = document.getElementById("fmRes");
      try {
        const r = await fetch("/api/certificats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ parcours: CUR.pid, nom: document.getElementById("fmNom").value.trim(), profil: document.getElementById("fmProf").value, reponses, modules }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Service indisponible (" + r.status + ")");
        if (d.reussi) { out.innerHTML = `<div class="fm-ok"><div class="fm-score">${d.score} % : examen réussi</div>Attestation n° <b>${esc(d.num)}</b> délivrée.</div><p><a class="btn btn-o" href="#attestation-${esc(d.num)}">Voir et imprimer mon attestation</a></p>`; }
        else { out.innerHTML = `<div class="fm-ko"><div class="fm-score">${d.score} %</div>Il faut ${F.regles.examen.seuil} %. Vous pouvez repasser l'examen : les questions sont tirées à nouveau.</div><p><a class="btn" href="#formation-${CUR.pid}">Revoir le parcours</a></p>`; btn.remove(); }
      } catch (err) { out.innerHTML = `<div class="fm-ko">${esc(err.message)}</div>`; btn.disabled = false; btn.textContent = "Envoyer mes réponses"; }
      out.scrollIntoView({ behavior: "smooth" });
    };
  };

  /* ---------- attestation et vérification ---------- */
  async function fetchCert(num) {
    const base = onPublic ? "" : PUBLIC;
    const r = await fetch(base + "/api/certificats?num=" + encodeURIComponent(num)); return r.json();
  }
  ROUTES.attestation = num => head("Attestation de formation", "Attestation n° " + num, "", `<a href="#formations">Formations</a> / Attestation`) + `<div class="wrap"><div id="fmCert">Recherche de l'attestation…</div></div>`;
  AFTER.attestation = async num => {
    const box = document.getElementById("fmCert"); let d;
    try { d = await fetchCert(num); } catch { box.innerHTML = `<div class="fm-ko">Registre injoignable. Réessayez plus tard.</div>`; return; }
    if (!d || !d.valide) { box.innerHTML = `<div class="fm-ko">Aucune attestation valide ne porte ce numéro.</div>`; return; }
    const A = (await load() || {}).attestation || {}; const url = `${PUBLIC}/#verifier-${d.num}`;
    box.innerHTML = `<p><button class="btn btn-o" onclick="print()">Imprimer ou enregistrer en PDF</button> <a class="btn" href="#verifier-${esc(d.num)}">Page de vérification</a></p>
    <div class="fm-cert" role="img" aria-label="Attestation de formation de ${esc(d.nom)}">
      <div><div class="k">Le Sociologue de l'Économie · Formation certifiante</div><h2>Attestation de formation</h2></div>
      <div><p>Dr Fabrice TANOH, ${esc(A.qualite || "Maître-assistant en sociologie économique")}, atteste que</p>
        <p><span class="nom">${esc(d.nom)}</span></p>
        <p>a suivi avec succès le parcours <b>« ${esc(d.titre)} »</b> (${esc(d.heures)} heures, ${esc(d.nb_modules)} modules) et réussi l'examen final avec un score de <b>${esc(d.score)} %</b>.</p>
        <p>Profil : ${esc(d.profil)} · Délivrée le ${new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p></div>
      <div class="bas"><div class="sceau">LE SOCIOLOGUE<br>DE L'ÉCONOMIE<br>· Côte d'Ivoire ·</div>
        <div class="meta" style="flex:1"><b>Dr Fabrice TANOH</b><br>Signature électronique : ${esc(d.sig)}<br>N° ${esc(d.num)}<br>Vérification : ${esc(PUBLIC.replace("https://", ""))}/#verifier<br><i>${esc(A.mention_legale || "")}</i></div>
        <div class="qr" id="fmQR" title="${esc(url)}"></div></div></div>`;
    try { if (window.QRCode) new QRCode(document.getElementById("fmQR"), { text: url, width: 240, height: 240, colorDark: "#0E2A47", colorLight: "#ffffff" }); } catch {}
  };
  ROUTES.verifier = num => head("Registre des attestations", "Vérifier une attestation", "Saisissez le numéro inscrit sur l'attestation (format LSE-AAAA-XXXXXX) ou scannez son QR code.", `<a href="#formations">Formations</a> / Vérifier`) +
    `<div class="wrap"><form id="fmVer" class="fm-mod"><label>Numéro d'attestation<br><input id="fmNum" value="${esc(num || "")}" placeholder="LSE-2026-ABC123" required style="width:100%;max-width:340px;text-transform:uppercase"></label> <button class="btn btn-o" type="submit">Vérifier</button></form><div id="fmVerRes" aria-live="polite"></div></div>`;
  AFTER.verifier = num => {
    const f = document.getElementById("fmVer"); if (!f) return;
    const go = async n => {
      const out = document.getElementById("fmVerRes"); out.textContent = "Vérification…";
      try {
        const d = await fetchCert(n.trim().toUpperCase());
        out.innerHTML = d && d.valide ? `<div class="fm-ok"><div class="fm-score">Attestation authentique</div>N° <b>${esc(d.num)}</b> délivrée le ${esc(d.date)} à <b>${esc(d.nom)}</b> (${esc(d.profil)}) pour le parcours « ${esc(d.titre)} » (${esc(d.heures)} h), score ${esc(d.score)} %.<br>Signature ${esc(d.sig)} conforme au registre. <a href="#attestation-${esc(d.num)}">Afficher l'attestation</a></div>`
          : `<div class="fm-ko"><div class="fm-score">Attestation introuvable ou invalide</div>${esc((d && d.motif) || "Ce numéro ne figure pas au registre, ou l'attestation a été révoquée.")}</div>`;
      } catch { out.innerHTML = `<div class="fm-ko">Registre injoignable. Réessayez plus tard.</div>`; }
    };
    f.onsubmit = e => { e.preventDefault(); go(document.getElementById("fmNum").value); };
    if (num) go(num);
  };

  /* ---------- passerelle depuis la page Savoirs ---------- */
  const SAV = ROUTES.savoirs;
  if (SAV) ROUTES.savoirs = tab => SAV(tab) + `<div class="wrap"><a class="card" href="#formations" style="display:block;margin:20px auto;border-left:5px solid var(--orange,#F77F00)"><div class="meta"><span class="chip o">Nouveau</span><span>Gratuit</span></div><h3>Formations certifiantes : suivez un parcours complet et obtenez une attestation vérifiable</h3></a></div>`;
  load();
})();
