/* TD en ligne randomisé — moteur (groupe + enseignant). Dépend de window.TD_ETHIQUE.
   La clé du QCM, les pistes et les grilles sont chiffrées dans T.secret ; l'espace enseignant les déchiffre avec le mot de passe de l'enseignant. */
(function () {
  "use strict";
  const T = window.TD_ETHIQUE;
  const L = "ABCD";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const normCode = c => String(c || "").trim().toUpperCase().replace(/\s+/g, "");

  /* Clé de correction : déchiffrée seulement dans l'espace enseignant (mot de passe). */
  let KEY = null;
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function unlock(pw) {
    const S = T.secret; if (!S || !window.crypto || !crypto.subtle) throw new Error("indisponible");
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(S.salt), iterations: S.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(S.iv) }, key, unb64(S.data));
    KEY = JSON.parse(new TextDecoder().decode(clear));
  }

  /* Variante déterministe : même code de séance + même groupe = même sujet. Groupes voisins = cas différents. */
  function variant(code, g) {
    const base = fnv(normCode(code));
    const r = rng(fnv(normCode(code) + "|G" + g));
    const qs = shuffle(T.qcm, r).slice(0, T.nbQcm).map(q => { const order = shuffle([0, 1, 2, 3], r); return { id: q.id, q: q.q, o: order.map(i => q.o[i]), b: KEY ? order.indexOf(KEY.cle[q.id]) : -1 }; });
    const cas = T.cas[(base + g) % T.cas.length];
    const prod = T.productions[(Math.floor(base / 7) + g) % T.productions.length];
    return { code: normCode(code), g, qs, cas, prod, ref: `${normCode(code)}-G${pad(g)}` };
  }
  function scoreA(v, ans) { let ok = 0; v.qs.forEach((q, i) => { if (ans[i] === q.b) ok++; }); return Math.round((ok * T.bareme.A / v.qs.length) * 100) / 100; }
  const members = txt => String(txt || "").split(/\n+/).map(s => s.trim().replace(/\s+/g, " ")).filter(Boolean);

  /* ---------------- copie ---------------- */
  function buildCopy(st) {
    const v = st.v, now = new Date();
    const verif = `TDETH1|${v.code}|${v.g}|${st.ans.map(a => a < 0 ? "-" : L[a]).join("")}`;
    const lines = [
      "TD EN LIGNE — ÉTHIQUE DE LA RECHERCHE",
      "SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH",
      "",
      `Code de séance : ${v.code}   |   Groupe : ${pad(v.g)}   |   Sujet : ${v.ref}`,
      `Envoyée le : ${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}   |   Durée de travail : ${Math.max(1, Math.round((now - st.t0) / 60000))} min`,
      `Rapporteur : ${st.rapporteur}`,
      "",
      `MEMBRES PRÉSENTS (${st.membres.length}) — chacun reçoit la note du groupe :`,
      ...st.membres.map((m, i) => `${pad(i + 1)}. ${m}`),
      "",
      `PARTIE A — QCM (${T.bareme.A} pts, correction automatique par l'enseignant)`,
      ...v.qs.map((q, i) => `A${i + 1}. ${q.q}\n    → ${st.ans[i] < 0 ? "sans réponse" : L[st.ans[i]] + ") " + q.o[st.ans[i]]}`),
      "",
      `PARTIE B — ÉTUDE DE CAS (${T.bareme.B} pts) : ${v.cas.titre}`,
      ...v.cas.questions.map((q, i) => `B${i + 1}. ${q}\n${st.rep[i] || "(sans réponse)"}\n`),
      `PARTIE C — PRODUCTION (${T.bareme.C} pts) : ${v.prod.titre}`,
      st.prod || "(sans réponse)",
      "",
      "CODE DE VÉRIFICATION (ne pas modifier) :",
      `${verif}|${fnv(verif + "|" + st.membres.join(";")).toString(36).toUpperCase()}`
    ];
    return lines.join("\n");
  }

  /* ---------------- espace groupe ---------------- */
  const st = { v: null, ans: [], rep: ["", "", ""], prod: "", membres: [], rapporteur: "", t0: 0, timer: null };

  function renderStart(box) {
    const opts = Array.from({ length: T.groupes }, (_, i) => `<option value="${i + 1}">Groupe ${pad(i + 1)}</option>`).join("");
    box.innerHTML = `
      <div class="td-card">
        <div class="td-k">Étape 1 sur 3 · Identification du groupe</div>
        <p class="td-muted">Un seul ordinateur ou téléphone par groupe. Le code de séance est donné par l'enseignant au début du TD : chaque groupe reçoit un sujet différent, tiré au sort.</p>
        <div class="td-row">
          <label>Code de séance<input id="tdCode" autocomplete="off" placeholder="Ex. : ETH-0312" maxlength="20"></label>
          <label>Groupe de TD<select id="tdG"><option value="">Choisir…</option>${opts}</select></label>
        </div>
        <label>Nom et prénoms du rapporteur<input id="tdRap" maxlength="80" autocomplete="off"></label>
        <label>Membres présents — un nom par ligne (${T.min} à ${T.max})<textarea id="tdMem" rows="8" placeholder="KOUASSI Aya Marie&#10;TRAORÉ Ibrahim&#10;…"></textarea></label>
        <div class="td-count" id="tdCount">0 membre</div>
        <div class="td-note">Seuls les étudiants inscrits dans cette liste recevront la note du groupe. Les absents ne doivent pas y figurer.</div>
        <button class="td-btn" id="tdGo">Tirer notre sujet et commencer</button>
        <div class="td-err" id="tdErr" role="alert"></div>
      </div>
      <p class="td-muted" style="text-align:right"><a href="#" id="tdProf">Espace enseignant du TD (accès protégé)</a></p>`;
    $("#tdProf").onclick = e => { e.preventDefault(); renderLogin(box); };
    const upd = () => { const n = members($("#tdMem").value).length; const c = $("#tdCount"); c.textContent = `${n} membre${n > 1 ? "s" : ""}`; c.className = "td-count " + (n >= T.min && n <= T.max ? "ok" : n ? "ko" : ""); };
    $("#tdMem").addEventListener("input", upd);
    $("#tdGo").onclick = () => {
      const code = normCode($("#tdCode").value), g = +$("#tdG").value, rap = $("#tdRap").value.trim(), mem = members($("#tdMem").value);
      const err = [];
      if (code.length < 4) err.push("Saisissez le code de séance donné par l'enseignant.");
      if (!g) err.push("Choisissez votre groupe.");
      if (rap.length < 4) err.push("Indiquez le nom du rapporteur.");
      if (mem.length < T.min || mem.length > T.max) err.push(`La liste doit compter entre ${T.min} et ${T.max} membres (actuellement ${mem.length}).`);
      if (new Set(mem.map(m => m.toLowerCase())).size !== mem.length) err.push("Un nom figure deux fois dans la liste.");
      if (err.length) { $("#tdErr").innerHTML = err.map(esc).join("<br>"); return; }
      Object.assign(st, { v: variant(code, g), ans: Array(T.nbQcm).fill(-1), rep: ["", "", ""], prod: "", membres: mem, rapporteur: rap, t0: Date.now() });
      renderWork(box);
    };
  }

  function renderWork(box) {
    const v = st.v;
    box.innerHTML = `
      <div class="td-bar"><span><b>Groupe ${pad(v.g)}</b> · sujet ${esc(v.ref)} · ${st.membres.length} membres</span><span id="tdTime" class="td-time"></span></div>
      <div class="td-card"><div class="td-k">Étape 2 sur 3 · Partie A — QCM (${T.bareme.A} points)</div><p class="td-muted">Une seule bonne réponse par question. Discutez en groupe avant de cocher.</p>
        ${v.qs.map((q, i) => `<fieldset class="td-q"><legend>A${i + 1}. ${esc(q.q)}</legend>${q.o.map((o, j) => `<label class="td-opt"><input type="radio" name="a${i}" value="${j}"> <b>${L[j]}</b> ${esc(o)}</label>`).join("")}</fieldset>`).join("")}
      </div>
      <div class="td-card"><div class="td-k">Partie B — Étude de cas (${T.bareme.B} points)</div><h3>${esc(v.cas.titre)}</h3><p class="td-case">${esc(v.cas.texte)}</p>
        ${v.cas.questions.map((q, i) => `<label class="td-open">B${i + 1}. ${esc(q)}<textarea data-b="${i}" rows="5"></textarea></label>`).join("")}
      </div>
      <div class="td-card"><div class="td-k">Partie C — Production (${T.bareme.C} points)</div><h3>${esc(v.prod.titre)}</h3><p>${esc(v.prod.consigne)}</p><textarea id="tdProd" rows="8"></textarea></div>
      <div class="td-card"><div class="td-k">Étape 3 sur 3 · Remise de la copie</div><p class="td-muted">Vérifiez vos réponses : après validation, la copie n'est plus modifiable.</p><button class="td-btn" id="tdEnd">Valider la copie du groupe</button><div class="td-err" id="tdErr2" role="alert"></div></div>`;
    box.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener("change", e => { st.ans[+e.target.name.slice(1)] = +e.target.value; }));
    box.querySelectorAll("textarea[data-b]").forEach(t => t.addEventListener("input", e => { st.rep[+e.target.dataset.b] = e.target.value.trim(); }));
    $("#tdProd").addEventListener("input", e => { st.prod = e.target.value.trim(); });
    clearInterval(st.timer);
    const tick = () => { const m = Math.floor((Date.now() - st.t0) / 60000); const left = T.duree - m; const e = $("#tdTime"); if (!e) return clearInterval(st.timer); e.textContent = left > 0 ? `${left} min restantes (indicatif)` : `Temps indicatif dépassé de ${-left} min`; e.classList.toggle("late", left <= 5); };
    tick(); st.timer = setInterval(tick, 20000);
    $("#tdEnd").onclick = () => {
      const miss = [];
      st.ans.forEach((a, i) => { if (a < 0) miss.push(`A${i + 1}`); });
      st.rep.forEach((r, i) => { if (r.length < 20) miss.push(`B${i + 1}`); });
      if (st.prod.length < 40) miss.push("C");
      if (miss.length && !confirm(`Réponses manquantes ou très courtes : ${miss.join(", ")}.\nValider quand même la copie ?`)) return;
      clearInterval(st.timer);
      renderDone(box);
    };
    (box.scrollIntoView ? box.scrollIntoView({ block: "start" }) : window.scrollTo(0, 0));
  }

  function renderDone(box) {
    const txt = buildCopy(st);
    const subject = `TD Éthique — ${st.v.code} — Groupe ${pad(st.v.g)}`;
    const href = `mailto:${T.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(txt)}`;
    box.innerHTML = `
      <div class="td-card td-ok"><div class="td-k">Copie validée</div>
        <p><b>Dernière étape obligatoire : envoyez la copie à l'enseignant.</b> Le bouton ouvre votre messagerie avec le message déjà rempli ; il ne reste qu'à appuyer sur « Envoyer ».</p>
        <div class="td-actions"><a class="td-btn" id="tdMail" href="${esc(href)}" target="_blank" rel="noopener">Envoyer la copie par e-mail</a><button class="td-btn td-ghost" id="tdCopy">Copier la copie</button><button class="td-btn td-ghost" id="tdDl">Télécharger (.txt)</button></div>
        <p class="td-muted">Si votre messagerie ne s'ouvre pas ou coupe le texte : cliquez sur « Copier la copie », puis collez-la dans un e-mail adressé à <b>${esc(T.email)}</b> avec pour objet <b>${esc(subject)}</b>.</p>
        <pre class="td-pre">${esc(txt)}</pre></div>`;
    $("#tdCopy").onclick = async () => { try { await navigator.clipboard.writeText(txt); $("#tdCopy").textContent = "Copiée ✓"; } catch { const r = document.createRange(); r.selectNodeContents($(".td-pre")); getSelection().removeAllRanges(); getSelection().addRange(r); $("#tdCopy").textContent = "Texte sélectionné : Ctrl+C"; } };
    $("#tdDl").onclick = () => saveFile(`td-ethique-${st.v.code}-groupe-${pad(st.v.g)}.txt`, txt, "text/plain");
    (box.scrollIntoView ? box.scrollIntoView({ block: "start" }) : window.scrollTo(0, 0));
  }

  async function saveFile(name, text, type) {
    const blob = new Blob(["﻿" + text], { type: type + ";charset=utf-8" });
    try { const d = window.claude && window.claude.use ? await window.claude.use("downloads") : null; if (d) { await d.save({ filename: name, data: blob }); return; } } catch (e) { return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------------- espace enseignant ---------------- */
  function renderLogin(box) {
    if (KEY) return renderTeacher(box);
    box.innerHTML = `
      <div class="td-card"><div class="td-k">Espace enseignant du TD</div>
        <p class="td-muted">Réservé à l'enseignant : les sujets, la clé du QCM et les pistes de correction ne s'affichent qu'avec le mot de passe.</p>
        <label>Mot de passe enseignant<input id="tPw" type="password" autocomplete="current-password"></label>
        <button class="td-btn" id="tLog">Ouvrir l'espace enseignant</button> <button class="td-btn td-ghost" id="tBack">Retour à l'espace des groupes</button>
        <div class="td-err" id="tLogErr" role="alert"></div></div>`;
    const go = async () => { const b = $("#tLog"); b.disabled = true; $("#tLogErr").textContent = ""; try { await unlock($("#tPw").value); renderTeacher(box); } catch (e) { $("#tLogErr").textContent = "Mot de passe incorrect."; b.disabled = false; } };
    $("#tLog").onclick = go; $("#tPw").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    $("#tBack").onclick = () => renderStart(box);
  }
  const releve = [];
  function parseCopy(txt) {
    const m = String(txt).match(/TDETH1\|([A-Z0-9\-_.]+)\|(\d{1,2})\|([A-D\-]+)\|([A-Z0-9]+)/);
    if (!m) return null;
    const mem = [], lines = String(txt).split(/\r?\n/);
    const k = lines.findIndex(l => /^MEMBRES PRÉSENTS/.test(l));
    if (k >= 0) for (let i = k + 1; i < lines.length; i++) { const mm = lines[i].match(/^\s*\d{2}\.\s+(.+)$/); if (!mm) break; mem.push(mm[1].trim()); }
    const verif = `TDETH1|${m[1]}|${m[2]}|${m[3]}`;
    const intact = fnv(verif + "|" + mem.join(";")).toString(36).toUpperCase() === m[4];
    return { code: m[1], g: +m[2], ans: m[3].split("").map(c => L.indexOf(c)), mem, intact };
  }

  function renderTeacher(box) {
    if (!KEY) return renderLogin(box);
    box.innerHTML = `
      <div class="td-card"><div class="td-k">Préparer la séance</div>
        <p class="td-muted">Choisissez un code de séance nouveau pour chaque séance (par exemple ETH-0312) et écrivez-le au tableau. Les 14 sujets en découlent automatiquement.</p>
        <div class="td-row"><label>Code de séance<input id="tCode" placeholder="ETH-0312" maxlength="20"></label><button class="td-btn" id="tShow" style="align-self:end">Voir les 14 sujets et corrigés</button></div>
        <div id="tList"></div></div>
      <div class="td-card"><div class="td-k">Corriger une copie reçue</div>
        <p class="td-muted">Collez ici l'e-mail reçu d'un groupe : la partie A est recalculée automatiquement à partir du code de vérification ; notez les parties B et C avec la grille.</p>
        <textarea id="tPaste" rows="6" placeholder="Collez le texte complet de la copie…"></textarea>
        <button class="td-btn" id="tParse">Analyser la copie</button><div id="tRes"></div></div>
      <div class="td-card"><div class="td-k">Relevé de notes de la séance</div><div id="tReleve" class="td-muted">Aucune copie notée pour l'instant.</div></div>`;
    $("#tShow").onclick = () => {
      const code = normCode($("#tCode").value); if (code.length < 4) return;
      $("#tList").innerHTML = `<table class="td-t"><thead><tr><th>Groupe</th><th>Clé QCM</th><th>Cas (partie B)</th><th>Production (partie C)</th></tr></thead><tbody>${Array.from({ length: T.groupes }, (_, i) => { const v = variant(code, i + 1); return `<tr><td><b>${pad(i + 1)}</b></td><td><code>${v.qs.map(q => L[q.b]).join(" ")}</code></td><td>${esc(v.cas.titre)}</td><td>${esc(v.prod.titre)}</td></tr>`; }).join("")}</tbody></table>`;
    };
    $("#tParse").onclick = () => {
      const p = parseCopy($("#tPaste").value), out = $("#tRes");
      if (!p) { out.innerHTML = `<div class="td-err">Code de vérification introuvable : collez la copie complète, jusqu'à la dernière ligne.</div>`; return; }
      const v = variant(p.code, p.g), a = scoreA(v, p.ans);
      out.innerHTML = `
        <div class="td-res">
          <p><b>Groupe ${pad(p.g)}</b> · séance ${esc(p.code)} · ${p.mem.length} membres · ${p.intact ? '<span class="td-good">copie intacte</span>' : '<span class="td-bad">attention : liste des membres ou réponses modifiées après validation</span>'}</p>
          <p>Partie A : <b>${String(a).replace(".", ",")} / ${T.bareme.A}</b> (${v.qs.filter((q, i) => p.ans[i] === q.b).length} bonnes réponses sur ${v.qs.length} · clé : <code>${v.qs.map(q => L[q.b]).join(" ")}</code>)</p>
          <details open><summary>Pistes de correction — ${esc(v.cas.titre)}</summary><p>${esc(KEY.pistes[v.cas.id])}</p></details>
          <details open><summary>Grille de la production — ${esc(v.prod.titre)}</summary><p>${esc(KEY.grilles[v.prod.id])}</p></details>
          <div class="td-row"><label>Partie B (sur ${T.bareme.B})<input id="tB" type="number" min="0" max="${T.bareme.B}" step="0.5"></label><label>Partie C (sur ${T.bareme.C})<input id="tC" type="number" min="0" max="${T.bareme.C}" step="0.5"></label></div>
          <div class="td-k" style="margin-top:12px">Membres — décochez un étudiant inscrit à tort (absent)</div>
          <div class="td-mem">${p.mem.map((m, i) => `<label><input type="checkbox" data-m="${i}" checked> ${esc(m)}</label>`).join("")}</div>
          <button class="td-btn" id="tAdd">Calculer la note et l'ajouter au relevé</button><div id="tNote"></div>
        </div>`;
      $("#tAdd").onclick = () => {
        const b = Math.min(T.bareme.B, Math.max(0, parseFloat($("#tB").value) || 0)), c = Math.min(T.bareme.C, Math.max(0, parseFloat($("#tC").value) || 0));
        const note = Math.round((a + b + c) * 4) / 4;
        for (let i = releve.length - 1; i >= 0; i--) if (releve[i].code === p.code && releve[i].g === p.g) releve.splice(i, 1);
        p.mem.forEach((m, i) => releve.push({ code: p.code, g: p.g, nom: m, a, b, c, note: $(`[data-m="${i}"]`).checked ? note : "ABS" }));
        $("#tNote").innerHTML = `<p class="td-good">Note du groupe ${pad(p.g)} : <b>${String(note).replace(".", ",")} / 20</b>, attribuée à ${p.mem.filter((_, i) => $(`[data-m="${i}"]`).checked).length} étudiants.</p>`;
        renderReleve();
      };
    };
  }
  function renderReleve() {
    const box = $("#tReleve"); if (!releve.length) return;
    const rows = releve.slice().sort((x, y) => x.g - y.g || x.nom.localeCompare(y.nom, "fr"));
    box.innerHTML = `<table class="td-t"><thead><tr><th>Groupe</th><th>Étudiant</th><th>A</th><th>B</th><th>C</th><th>Note /20</th></tr></thead><tbody>${rows.map(r => `<tr><td>${pad(r.g)}</td><td>${esc(r.nom)}</td><td>${r.a}</td><td>${r.b}</td><td>${r.c}</td><td><b>${r.note}</b></td></tr>`).join("")}</tbody></table>
      <div class="td-actions"><button class="td-btn" id="tCsv">Exporter le relevé (Excel / CSV)</button></div>`;
    $("#tCsv").onclick = () => { const f = n => String(n).replace(".", ","); saveFile(`releve-td-ethique-${rows[0].code}.csv`, ["Séance;Groupe;Étudiant;Partie A;Partie B;Partie C;Note /20", ...rows.map(r => [r.code, pad(r.g), '"' + r.nom.replace(/"/g, '""') + '"', f(r.a), f(r.b), f(r.c), f(r.note)].join(";"))].join("\r\n"), "text/csv"); };
  }

  window.TDEthique = { mount(box, mode) { mode === "enseignant" ? renderLogin(box) : renderStart(box); }, variant, parseCopy };
})();
