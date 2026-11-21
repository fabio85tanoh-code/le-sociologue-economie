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

  window.claude = {
    use: async function (name) {
      if (name === "sample") return sample;
      if (name === "db") return db;
      if (name === "user") return user;
      throw new Error("Capacité indisponible sur le site public : " + name);
    }
  };
})();
