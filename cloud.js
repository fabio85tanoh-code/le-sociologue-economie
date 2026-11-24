/* Sociologie de l'Économie — connecteur « hébergement public » (Cloudflare Pages).
   Sur claude.ai, le site utilise les capacités de l'artefact (window.claude).
   Sur le site public, ce fichier fournit les mêmes interfaces en s'appuyant sur les fonctions /api
   (base D1 et assistant Workers AI). Il ne s'active que hors de claude.ai. */
(function () {
  var host = location.hostname;
  var publicHost = /\.pages\.dev$/.test(host) || /sociolog/.test(host);
  if (window.claude || !publicHost) return;

  async function api(path, body) {
    var r = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
    var data = {}; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error(data.error || "Erreur " + r.status); err.userMessage = data.error; throw err; }
    return data;
  }

  function visitorId() {
    try { var v = localStorage.getItem("lse_vid"); if (!v) { v = "v" + Math.random().toString(36).slice(2, 12); localStorage.setItem("lse_vid", v); } return v; }
    catch (e) { return "v-anon"; }
  }

  // Assistant
  async function sample(input, opts) {
    var messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
    var r = await api("/api/chat", { messages: messages });
    if (opts && opts.onText) try { opts.onText({ text: r.text }); } catch (e) {}
    return { text: r.text };
  }
  sample.json = async function () { throw new Error("Non disponible sur le site public"); };

  // Base de données (sous-ensemble utilisé par le blog)
  var debatsListeners = [];
  async function loadDebats() {
    try {
      var r = await api("/api/debats");
      var snap = { docs: (r.items || []).map(function (i) { return { id: i._id, data: function () { return i; } }; }) };
      debatsListeners.forEach(function (cb) { try { cb(snap); } catch (e) {} });
    } catch (e) {}
  }
  setInterval(loadDebats, 120000);

  function query(path) {
    var q = {
      orderBy: function () { return q; }, limit: function () { return q; }, where: function () { return q; },
      onSnapshot: function (cb) {
        if (path === "debats") { debatsListeners.push(cb); loadDebats(); }
        else setTimeout(function () { cb({ docs: [] }); }, 0);
        return function () {};
      },
      get: async function () { return { docs: [] }; },
      add: async function () { throw new Error("Lecture seule"); }
    };
    return q;
  }

  function doc(path) {
    return {
      get: async function () { return { exists: false, data: function () { return {}; } }; },
      update: async function () { throw new Error("Lecture seule"); },
      set: async function (data) {
        if (path.indexOf("submissions/") === 0) {
          var items = (data && data.items) || []; var it = items[items.length - 1] || {};
          var r = await api("/api/contributions", it);
          if (r.status === "publie") setTimeout(loadDebats, 300);
          window.__lseLastStatus = r.status;
          return r;
        }
        if (path.indexOf("newsletter/") === 0) return api("/api/newsletter", { email: data && data.email });
        throw new Error("Lecture seule");
      }
    };
  }

  var db = { collection: query, doc: doc };
  var user = { id: async function () { return visitorId(); }, canEdit: function () { return false; }, can: function () { return true; } };

  // Console : modération des cas « à revoir » (réservée au titulaire du jeton ADMIN_TOKEN)
  var MOD_KEY = "lse_admin_token";
  function modEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function modGetToken() { try { return sessionStorage.getItem(MOD_KEY) || localStorage.getItem(MOD_KEY) || ""; } catch (e) { return ""; } }
  function modSetToken(t, keep) {
    try { sessionStorage.setItem(MOD_KEY, t); if (keep) localStorage.setItem(MOD_KEY, t); else localStorage.removeItem(MOD_KEY); } catch (e) {}
  }
  function modForget() { try { sessionStorage.removeItem(MOD_KEY); localStorage.removeItem(MOD_KEY); } catch (e) {} }
  async function modApi(method, body) {
    var r = await fetch("/api/admin", { method: method, headers: { "authorization": "Bearer " + modGetToken(), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(r.status === 401 ? "Jeton refusé : vérifiez-le ou recollez-le." : (d.error || "Erreur " + r.status));
    return d;
  }
  function modPanel() {
    var box = document.getElementById("lseMod"); if (!box) return;
    var body = box.querySelector(".mod-body");
    if (!modGetToken()) {
      body.innerHTML = '<form id="lseModForm"><div class="field"><label for="lseModTok">Jeton d\'administration (ADMIN_TOKEN)</label>' +
        '<input id="lseModTok" type="password" autocomplete="off" required placeholder="Collez votre jeton"></div>' +
        '<label style="font-size:.85rem;display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="lseModKeep"> Se souvenir sur cet appareil</label>' +
        '<button class="btn btn-o btn-s">Afficher les cas à revoir</button></form>' +
        '<p style="font-size:.82rem;color:var(--muted);margin-top:8px">Le jeton reste dans ce navigateur et n\'est envoyé qu\'au site lui-même. N\'utilisez « Se souvenir » que sur un appareil personnel.</p>';
      body.querySelector("#lseModForm").onsubmit = function (e) { e.preventDefault(); var t = body.querySelector("#lseModTok").value.trim(); if (!t) return; modSetToken(t, body.querySelector("#lseModKeep").checked); modLoad(); };
      return;
    }
    modLoad();
  }
  async function modLoad() {
    var box = document.getElementById("lseMod"); if (!box) return;
    var body = box.querySelector(".mod-body");
    body.innerHTML = '<p style="color:var(--muted)">Chargement…</p>';
    try {
      var d = await modApi("GET");
      var items = d.items || [];
      var html = items.length ? items.map(function (s) {
        var p = s.payload || {};
        var extrait = (p.chapo || p.texte || "").slice(0, 420);
        return '<div class="post" style="padding:12px 0;border-bottom:1px solid var(--line,#e5e7eb)">' +
          '<span class="status rejected">à revoir' + (s.motif ? " : " + modEsc(s.motif) : "") + '</span> ' +
          '<span class="chip o">' + modEsc(s.kind === "replique" ? "Réplique" + (p.position ? " · " + p.position : "") : (p.type || "contribution")) + '</span> ' +
          '<b>' + modEsc(p.titre || "(sans titre)") + '</b><br><small>' + modEsc(p.auteur || "") + (p.statut ? " · " + modEsc(p.statut) : "") + (p.institution ? " · " + modEsc(p.institution) : "") + ' · reçu le ' + modEsc(new Date(s.created).toLocaleDateString("fr-FR")) + '</small>' +
          '<p style="margin:6px 0">' + modEsc(extrait) + ((p.chapo || p.texte || "").length > 420 ? "…" : "") + '</p>' +
          '<details style="margin:4px 0 8px"><summary style="cursor:pointer;font-size:.88rem">Lire le texte complet</summary><div style="white-space:pre-wrap;font-size:.92rem;margin-top:6px">' + modEsc(p.texte || "") + '</div>' +
          ((p.references || []).length ? '<ul style="font-size:.85rem">' + p.references.map(function (r) { return "<li>" + modEsc(r) + "</li>"; }).join("") + "</ul>" : "") + '</details>' +
          '<button class="btn btn-o btn-s" data-modok="' + modEsc(s.id) + '">Publier</button> ' +
          '<button class="btn btn-g btn-s" data-modko="' + modEsc(s.id) + '">Refuser</button></div>';
      }).join("") : '<p>Aucun cas à revoir. Tout est à jour.</p>';
      body.innerHTML = html + '<p style="margin-top:12px"><button class="btn btn-g btn-s" id="lseModRefresh">Actualiser</button> <button class="btn btn-g btn-s" id="lseModOut">Oublier le jeton</button></p>';
      body.querySelector("#lseModRefresh").onclick = modLoad;
      body.querySelector("#lseModOut").onclick = function () { modForget(); modPanel(); };
      Array.prototype.forEach.call(body.querySelectorAll("[data-modok],[data-modko]"), function (b) {
        b.onclick = async function () {
          var ok = !!b.dataset.modok, id = b.dataset.modok || b.dataset.modko;
          if (!confirm(ok ? "Publier ce texte dans l'espace Débats ?" : "Refuser ce texte ? Il ne sera pas publié.")) return;
          b.disabled = true;
          try { await modApi("POST", { id: id, decision: ok ? "publier" : "refuser" }); if (ok) setTimeout(loadDebats, 300); modLoad(); }
          catch (e) { alert(e.message); b.disabled = false; }
        };
      });
    } catch (e) {
      body.innerHTML = '<p style="color:#b91c1c">' + modEsc(e.message) + '</p><p><button class="btn btn-g btn-s" id="lseModRetry">Saisir à nouveau le jeton</button></p>';
      body.querySelector("#lseModRetry").onclick = function () { modForget(); modPanel(); };
    }
  }
  function modMount() {
    if (location.hash.replace(/^#/, "") !== "console") return;
    var main = document.getElementById("main"); if (!main || document.getElementById("lseMod")) return;
    if (!main.querySelector("section")) return; // la page n'est pas encore rendue
    var sec = document.createElement("section");
    sec.className = "s"; sec.id = "lseMod";
    sec.innerHTML = '<div class="wrap"><div class="card"><div class="kicker">Réservé à l\'éditeur</div><h2 style="margin-top:4px">Modération des débats (site public)</h2>' +
      '<p>Contributions et répliques que la modération automatique a classées « à revoir » : publiez-les ou refusez-les en un clic.</p><div class="mod-body"></div></div></div>';
    main.insertBefore(sec, main.firstChild);
    modPanel();
  }
  function modWatch() {
    modMount();
    var main = document.getElementById("main");
    if (main && window.MutationObserver) new MutationObserver(function () { modMount(); }).observe(main, { childList: true });
    window.addEventListener("hashchange", function () { setTimeout(modMount, 50); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", modWatch); else modWatch();

  // Débats : inviter des participants (lien de partage, e-mail, Gmail, WhatsApp, LinkedIn, Facebook)
  var SITE = location.origin;
  var BLOG = "SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH";
  var debatsCache = {};
  debatsListeners.push(function (snap) { snap.docs.forEach(function (d) { debatsCache[d.id] = d.data(); }); invMount(); });
  function invDebatId() { var m = location.hash.match(/^#debat-(.+)$/); return m ? decodeURIComponent(m[1]) : null; }
  function invTheme(t) { try { return (typeof THEMES !== "undefined" && THEMES[t]) || t || ""; } catch (e) { return t || ""; } }
  function invTexts(d, perso) {
    var lien = SITE + "/debats/" + encodeURIComponent(d._id) + "?repondre";
    var sujet = "Invitation à débattre : " + d.titre;
    var corps = "Bonjour,\n\n" + (perso ? perso + "\n\n" : "") +
      "Je vous invite à contribuer au débat scientifique « " + d.titre + " »" + (d.theme ? " (thème : " + invTheme(d.theme) + ")" : "") +
      ", ouvert sur le blog " + BLOG + ".\n\n" + (d.chapo ? d.chapo + "\n\n" : "") +
      "Lire le débat et y répondre (prolongement, nuance ou contre-argument, idéalement à partir d'un terrain, d'une enquête ou d'une source) :\n" + lien +
      "\n\nLes répliques sont publiées après vérification de leur conformité à la charte du blog.\n\nBien cordialement,";
    var court = "Débat scientifique : « " + d.titre + " » — vos prolongements, nuances et contre-arguments sont les bienvenus sur le " + BLOG + " : " + lien;
    return { lien: lien, sujet: sujet, corps: corps, court: court };
  }
  function invEmails(s) {
    var l = String(s || "").split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var ok = l.filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
    return { ok: ok.slice(0, 50), bad: l.filter(function (x) { return ok.indexOf(x) < 0; }) };
  }
  function invMount() {
    var id = invDebatId(); if (!id) return;
    var art = document.querySelector("#main article.article"); var d = debatsCache[id];
    if (!art || !d || document.getElementById("lseInv")) return;
    var t = invTexts(d, "");
    var box = document.createElement("div");
    box.className = "card"; box.id = "lseInv"; box.style.margin = "0 0 24px";
    box.innerHTML = '<div class="kicker">Faire vivre le débat</div><h3 style="margin:4px 0 6px">Inviter des participants</h3>' +
      '<p style="margin:0 0 12px;font-size:.95rem">Envoyez cette question à des collègues, chercheurs ou étudiants travaillant sur la thématique : le lien ouvre directement le débat et son formulaire de réplique.</p>' +
      '<div class="field"><label for="invLien">Lien à partager</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="invLien" readonly value="' + modEsc(t.lien) + '" style="flex:1;min-width:0"><button type="button" class="btn btn-g btn-s" id="invCopy">Copier le lien</button></div></div>' +
      '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">Inviter par e-mail</summary>' +
      '<div class="field" style="margin-top:10px"><label for="invMails">Adresses e-mail des participants</label><textarea id="invMails" rows="2" placeholder="nom1@universite.ci, nom2@exemple.org"></textarea>' +
      '<small style="color:var(--muted)">Séparées par des virgules (50 au plus). Elles sont placées en copie cachée : les destinataires ne voient pas les adresses des autres. Le site ne les enregistre pas : le message part de votre propre messagerie.</small></div>' +
      '<div class="field"><label for="invPerso">Message personnel (facultatif)</label><textarea id="invPerso" rows="2" maxlength="600" placeholder="Ex. : Votre enquête sur les tontines d\'Adjamé éclairerait utilement cette question."></textarea></div>' +
      '<p id="invErr" style="color:#b91c1c;font-size:.88rem;margin:6px 0" hidden></p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-o btn-s" id="invMail">Ouvrir ma messagerie</button><button type="button" class="btn btn-g btn-s" id="invGmail">Ouvrir dans Gmail</button><button type="button" class="btn btn-g btn-s" id="invCopyMsg">Copier le message</button></div></details>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
      '<a class="btn btn-g btn-s" id="invWa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t.court) + '">WhatsApp</a>' +
      '<a class="btn btn-g btn-s" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(t.lien) + '">LinkedIn</a>' +
      '<a class="btn btn-g btn-s" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(t.lien) + '">Facebook</a>' +
      (navigator.share ? '<button type="button" class="btn btn-g btn-s" id="invShare">Autres applications…</button>' : "") + '</div>';
    var h2 = Array.prototype.filter.call(art.querySelectorAll("h2"), function (h) { return /^Répliques/.test(h.textContent); })[0];
    if (h2) { box.style.margin = "32px 0 0"; art.insertBefore(box, h2); } else art.insertBefore(box, art.firstChild);
    function note(m) { if (typeof toast === "function") toast(m); else alert(m); }
    async function copier(txt) { try { await navigator.clipboard.writeText(txt); note("Copié dans le presse-papiers"); } catch (e) { var i = box.querySelector("#invLien"); i.select(); note("Sélectionnez puis copiez (Cmd/Ctrl + C)"); } }
    function prep() {
      var e = invEmails(box.querySelector("#invMails").value); var err = box.querySelector("#invErr");
      if (e.bad.length) { err.textContent = "Adresse(s) non reconnue(s) : " + e.bad.join(", "); err.hidden = false; return null; }
      err.hidden = true; return { mails: e.ok, t: invTexts(d, box.querySelector("#invPerso").value.trim()) };
    }
    box.querySelector("#invCopy").onclick = function () { copier(t.lien); };
    box.querySelector("#invCopyMsg").onclick = function () { var p = prep(); if (p) copier(p.t.sujet + "\n\n" + p.t.corps); };
    box.querySelector("#invMail").onclick = function () { var p = prep(); if (!p) return;
      location.href = "mailto:?" + (p.mails.length ? "bcc=" + encodeURIComponent(p.mails.join(",")) + "&" : "") + "subject=" + encodeURIComponent(p.t.sujet) + "&body=" + encodeURIComponent(p.t.corps); };
    box.querySelector("#invGmail").onclick = function () { var p = prep(); if (!p) return;
      window.open("https://mail.google.com/mail/?view=cm&fs=1" + (p.mails.length ? "&bcc=" + encodeURIComponent(p.mails.join(",")) : "") + "&su=" + encodeURIComponent(p.t.sujet) + "&body=" + encodeURIComponent(p.t.corps), "_blank", "noopener"); };
    var sh = box.querySelector("#invShare"); if (sh) sh.onclick = function () { navigator.share({ title: d.titre, text: t.court, url: t.lien }).catch(function () {}); };
    if (/[?&]repondre\b/.test(location.search)) {
      var tries = 0; (function go() { var f = document.getElementById("rpForm"); if (f) { f.scrollIntoView({ behavior: "smooth", block: "start" }); var a = f.querySelector("input,textarea"); if (a) a.focus({ preventScroll: true }); history.replaceState(null, "", location.pathname + location.hash); } else if (tries++ < 20) setTimeout(go, 250); })();
    }
  }
  function invWatch() {
    var main = document.getElementById("main");
    if (main && window.MutationObserver) new MutationObserver(function () { invMount(); }).observe(main, { childList: true, subtree: false });
    window.addEventListener("hashchange", function () { setTimeout(invMount, 60); });
    invMount();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", invWatch); else invWatch();

  window.claude = {
    use: async function (name) {
      if (name === "sample") return sample;
      if (name === "db") return db;
      if (name === "user") return user;
      throw new Error("Capacité indisponible sur le site public : " + name);
    }
  };
})();
