// Générateur de PowerPoint animés — « SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH »
// node build_deck.js ../courses/ECS2522.json out/ECS2522.pptx
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const fa = require("react-icons/fa");
const sharp = require("sharp");
const SKILL = fs.readdirSync("/root/.claude/skills/synced").map(d => "/root/.claude/skills/synced/" + d + "/pptx").find(p => fs.existsSync(p));
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");

const [, , inFile, outFile] = process.argv;
const K = JSON.parse(fs.readFileSync(inFile, "utf8"));

// Palette : bleu profond, blanc, orange ivoirien, vert, gris anthracite
const HEX = { blue: "0E2A47", blue2: "1F4E79", orange: "F77F00", green: "009E60", anth: "2B2D31", ice: "EAF1F8", mint: "E3F5EC", sand: "FFF1E3", grey: "6B7280", white: "FFFFFF" };
const THEME = {
  name: "SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: HEX.anth, lt1: HEX.white, dk2: HEX.blue, lt2: HEX.ice, accent1: HEX.orange, accent2: HEX.green, accent3: HEX.blue2, accent4: "F2B705", accent5: "7A8CA3", accent6: "C2410C", hlink: HEX.blue2, folHlink: "5B21B6" },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = K.titre;
pres.author = "SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH";
pres.subject = `Sociologie économique · ${K.niveau}`;
const C = pres.SchemeColor;

const FOOT = `SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH  ·  ${K.titre}`;
pres.defineSlideMaster({
  title: "LSE_TITRE", background: { color: HEX.blue },
  objects: [{ text: { text: FOOT, options: { x: 0.5, y: 5.2, w: 8, h: 0.25, fontSize: 9, color: "9FB3C8" } } }],
});
pres.defineSlideMaster({
  title: "LSE_CONTENU", background: { color: HEX.white },
  margin: [0.4, 0.5, 0.5, 0.5],
  objects: [{ text: { text: FOOT, options: { x: 0.5, y: 5.25, w: 8, h: 0.25, fontSize: 9, color: HEX.grey } } }],
  slideNumber: { x: 9.0, y: 5.22, w: 0.5, h: 0.28, fontSize: 9, color: HEX.grey, align: "right" },
});
pres.defineSlideMaster({
  title: "LSE_SOMBRE", background: { color: HEX.blue },
  objects: [{ text: { text: FOOT, options: { x: 0.5, y: 5.25, w: 8, h: 0.25, fontSize: 9, color: "9FB3C8" } } }],
  slideNumber: { x: 9.0, y: 5.22, w: 0.5, h: 0.28, fontSize: 9, color: "9FB3C8", align: "right" },
});

// ---------- icônes ----------
const iconCache = {};
async function icon(name, color) {
  const key = name + color;
  if (!iconCache[key]) {
    const svg = RDS.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + color, size: 256 }));
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    iconCache[key] = "image/png;base64," + buf.toString("base64");
  }
  return iconCache[key];
}
let animN = 0;
const A = () => "A_" + (++animN);   // apparition auto (fondu enchaîné)
const CL = () => "C_" + (++animN);  // apparition au clic (réponses du quiz)

async function iconBadge(slide, name, x, y, d, bg, fg, anim) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg }, objectName: anim || A() });
  slide.addImage({ data: await icon(name, fg), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52, objectName: anim ? anim + "i" : A() });
}
function tag(slide, text, x, y, dark) {
  const w = Math.max(1.0, 0.083 * text.length + 0.45);
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.28, rectRadius: 0.14, fill: { color: dark ? HEX.orange : HEX.sand }, line: { color: dark ? HEX.orange : HEX.sand } });
  slide.addText(text.toUpperCase(), { x, y, w, h: 0.28, fontSize: 9, bold: true, color: dark ? HEX.white : "C2410C", align: "center", valign: "middle", margin: 0, charSpacing: 1, isTextBox: true });
}
function header(slide, kicker, title, dark) {
  tag(slide, kicker, 0.5, 0.3, dark);
  slide.addText(title, { x: 0.5, y: 0.62, w: 9, h: 0.62, fontFace: "Cambria", fontSize: 26, bold: true, color: dark ? HEX.white : HEX.blue, margin: 0, valign: "middle", isTextBox: true });
}
function card(slide, x, y, w, h, color, anim) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color }, line: { color }, objectName: anim || A(), shadow: { type: "outer", color: "0E2A47", blur: 6, offset: 2, angle: 90, opacity: 0.12 } });
}
const T = (slide, text, o) => slide.addText(text, Object.assign({ isTextBox: true, margin: 0, color: HEX.anth, fontSize: 14, valign: "top" }, o));

// ---------- choix des diapositives de contenu (8 max pour rester à 15) ----------
let content = (K.slides || []).slice();
const drop = ["citation", "auteurs", "monde", "concept", "comparaison", "processus", "stat", "cas_ci"];
while (content.length > 10) {
  let removed = false;
  for (const t of drop) {
    const idxs = content.map((s, i) => [s, i]).filter(([s]) => s.type === t);
    const keepOne = !["citation"].includes(t);
    if (idxs.length > (keepOne ? 1 : 0)) { content.splice(idxs[idxs.length - 1][1], 1); removed = true; break; }
  }
  if (!removed) content.pop();
}
const KICK = { graphique: "Données", schema: "Schéma", concept: "Concept", auteurs: "Auteurs et courants", cas_ci: "Côte d'Ivoire", monde: "Regards croisés", comparaison: "Comparer", processus: "Mécanisme", stat: "Chiffre clé", citation: "Pour réfléchir", exercice: "À vous de jouer" };

const R = {
  async graphique(s, d) {
    const pal = [HEX.orange, HEX.blue, HEX.green];
    const data = (d.series || []).map(x => ({ name: x.nom, labels: d.labels, values: x.valeurs }));
    const multi = data.length > 1;
    s.addChart(d.kind === "line" ? pres.charts.LINE : pres.charts.BAR, data, { x: 0.5, y: 1.4, w: 5.9, h: 3.65, objectName: A(),
      chartColors: pal.slice(0, Math.max(1, data.length)), barDir: "col", barGapWidthPct: 60, lineSize: 3, lineDataSymbolSize: 7,
      showValue: !multi && d.labels.length <= 8, dataLabelPosition: d.kind === "line" ? "t" : "outEnd", dataLabelFontSize: 10, dataLabelFontFace: "+mn-lt", dataLabelColor: HEX.anth,
      catAxisLabelColor: HEX.grey, valAxisLabelColor: HEX.grey, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E3E8EF", size: 0.5 }, catGridLine: { style: "none" }, showLegend: multi, legendPos: "b", legendFontSize: 10, legendFontFace: "+mn-lt",
      showValAxisTitle: !!d.unite, valAxisTitle: d.unite || "", valAxisTitleFontSize: 10, valAxisTitleColor: HEX.grey, valAxisTitleFontFace: "+mn-lt" });
    card(s, 6.65, 1.45, 2.85, 3.55, HEX.ice);
    await iconBadge(s, "FaChartBar", 6.9, 1.65, 0.5, HEX.blue, HEX.white);
    T(s, d.lecture || "", { x: 6.9, y: 2.3, w: 2.4, h: 1.9, fontSize: 13, fit: "shrink", objectName: A() });
    T(s, "Source : " + (d.source || ""), { x: 6.9, y: 4.25, w: 2.4, h: 0.65, fontSize: 9, italic: true, color: HEX.grey, fit: "shrink", objectName: A() });
  },
  async schema(s, d) {
    const N = (d.noeuds || []).slice(0, 6), n = N.length;
    if (d.kind === "pyramide") {
      for (let i = 0; i < n; i++) { const w = 3.2 + i * (5.6 / Math.max(1, n - 1)), y = 1.45 + i * (3.0 / n);
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5 - w / 2, y, w, h: 3.0 / n - 0.08, rectRadius: 0.08, fill: { color: [HEX.orange, HEX.blue, HEX.blue2, HEX.green, "7A8CA3", HEX.anth][i] }, line: { color: HEX.white }, objectName: A() });
        T(s, [{ text: N[i].label + "  ", options: { bold: true } }, { text: N[i].texte }], { x: 5 - w / 2 + 0.15, y, w: w - 0.3, h: 3.0 / n - 0.08, fontSize: 11.5, color: HEX.white, align: "center", valign: "middle", fit: "shrink", objectName: A() }); }
    } else {
      const bw = Math.min(2.1, (9 - (n - 1) * 0.35) / n), gap = (9 - n * bw) / Math.max(1, n - 1);
      for (let i = 0; i < n; i++) { const x = 0.5 + i * (bw + gap), y = d.kind === "cycle" && i % 2 ? 2.35 : 1.55;
        card(s, x, y, bw, 2.0, [HEX.sand, HEX.ice, HEX.mint][i % 3]);
        T(s, N[i].label, { x: x + 0.1, y: y + 0.12, w: bw - 0.2, h: 0.55, fontSize: 13, bold: true, color: HEX.blue, align: "center", valign: "middle", fit: "shrink", objectName: A() });
        T(s, N[i].texte, { x: x + 0.1, y: y + 0.7, w: bw - 0.2, h: 1.2, fontSize: 11, align: "center", fit: "shrink", objectName: A() });
        if (i < n - 1) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + bw + 0.04, y: y + 0.85, w: gap - 0.08, h: 0.28, fill: { color: HEX.orange }, line: { color: HEX.orange }, objectName: A() }); }
      if (d.kind === "cycle") T(s, "↺ le cycle recommence", { x: 0.5, y: 4.45, w: 3, h: 0.3, fontSize: 11, bold: true, color: HEX.orange, objectName: A() });
    }
    T(s, d.lecture || "", { x: 3.6, y: 4.55, w: 5.9, h: 0.5, fontSize: 12, italic: true, color: HEX.anth, fit: "shrink", objectName: A() });
  },
  async concept(s, d) {
    card(s, 0.5, 1.45, 4.6, 3.55, HEX.blue);
    await iconBadge(s, "FaLightbulb", 0.8, 1.7, 0.6, HEX.orange, HEX.white);
    T(s, d.definition, { x: 0.8, y: 2.45, w: 4.0, h: 1.9, fontSize: 16, italic: true, color: HEX.white, objectName: A() });
    T(s, d.auteur || "", { x: 0.8, y: 4.45, w: 4.0, h: 0.35, fontSize: 13, bold: true, color: HEX.orange, objectName: A() });
    const icons = ["FaBullseye", "FaUsers", "FaGlobeAfrica"];
    for (let i = 0; i < Math.min(3, (d.points || []).length); i++) {
      const y = 1.55 + i * 1.15;
      await iconBadge(s, icons[i], 5.45, y, 0.55, HEX.ice, HEX.blue);
      T(s, d.points[i], { x: 6.2, y: y - 0.05, w: 3.3, h: 0.9, fontSize: 14, valign: "middle", objectName: A() });
    }
  },
  async auteurs(s, d) {
    const it = (d.items || []).slice(0, 4), n = it.length, gap = 9 / n;
    s.addShape(pres.shapes.LINE, { x: 0.7, y: 2.35, w: 8.6, h: 0, line: { color: HEX.orange, width: 2 }, objectName: A() });
    for (let i = 0; i < n; i++) {
      const cx = 0.5 + gap * i + gap / 2;
      s.addShape(pres.shapes.OVAL, { x: cx - 0.22, y: 2.13, w: 0.44, h: 0.44, fill: { color: HEX.blue }, line: { color: HEX.white, width: 2 }, objectName: A() });
      T(s, String(it[i].annee || ""), { x: cx - 1, y: 1.55, w: 2, h: 0.4, fontSize: 18, bold: true, color: HEX.orange, align: "center", objectName: A() });
      card(s, cx - gap / 2 + 0.1, 2.8, gap - 0.2, 2.15, HEX.ice);
      T(s, it[i].auteur, { x: cx - gap / 2 + 0.25, y: 2.95, w: gap - 0.5, h: 0.45, fontSize: 14, bold: true, color: HEX.blue, objectName: A() });
      T(s, it[i].idee, { x: cx - gap / 2 + 0.25, y: 3.45, w: gap - 0.5, h: 1.4, fontSize: 13, objectName: A() });
    }
  },
  async cas_ci(s, d) {
    await iconBadge(s, "FaMapMarkerAlt", 0.5, 1.45, 0.5, HEX.green, HEX.white);
    T(s, d.contexte, { x: 1.15, y: 1.42, w: 4.4, h: 1.25, fontSize: 14, objectName: A() });
    const an = (d.analyse || []).map((t, i, a) => ({ text: t, options: { bullet: { code: "25CF" }, breakLine: i < a.length - 1, paraSpaceAfter: 6 } }));
    card(s, 0.5, 2.8, 5.05, 2.2, HEX.mint);
    T(s, "Lecture sociologique", { x: 0.75, y: 2.95, w: 4.5, h: 0.3, fontSize: 12, bold: true, color: HEX.green, objectName: A() });
    T(s, an, { x: 0.75, y: 3.3, w: 4.6, h: 1.6, fontSize: 14, objectName: A() });
    const ch = (d.chiffres || []).slice(0, 3), h = 3.55 / Math.max(1, ch.length);
    for (let i = 0; i < ch.length; i++) {
      const y = 1.45 + i * h;
      card(s, 5.85, y, 3.65, h - 0.15, i % 2 ? HEX.sand : HEX.blue);
      const dark = i % 2 === 0;
      const ch_h = h - 0.15, big = ch.length < 3;
      T(s, ch[i].valeur, { x: 6.05, y: y + 0.06, w: 3.3, h: big ? 0.7 : 0.45, fontSize: big ? 32 : 24, bold: true, fontFace: "Cambria", color: dark ? HEX.orange : "C2410C", valign: "middle", objectName: A() });
      T(s, ch[i].label, { x: 6.05, y: y + (big ? 0.8 : 0.52), w: 3.3, h: ch_h - (big ? 0.8 : 0.52) - 0.28, fontSize: big ? 13 : 11, bold: true, color: dark ? HEX.white : HEX.anth, fit: "shrink", objectName: A() });
      T(s, "Source : " + ch[i].source, { x: 6.05, y: y + ch_h - 0.27, w: 3.3, h: 0.22, fontSize: 9, italic: true, color: dark ? "C9D6E3" : HEX.grey, objectName: A() });
    }
  },
  async monde(s, d) {
    const ex = (d.exemples || []).slice(0, 3);
    for (let i = 0; i < ex.length; i++) {
      const x = 0.5 + i * 3.05;
      card(s, x, 1.5, 2.85, 3.5, [HEX.ice, HEX.mint, HEX.sand][i]);
      await iconBadge(s, "FaGlobeAfrica", x + 0.25, 1.75, 0.55, [HEX.blue, HEX.green, HEX.orange][i], HEX.white);
      T(s, ex[i].pays, { x: x + 0.25, y: 2.45, w: 2.4, h: 0.45, fontSize: 16, bold: true, color: HEX.blue, objectName: A() });
      T(s, ex[i].texte, { x: x + 0.25, y: 2.95, w: 2.4, h: 1.9, fontSize: 14, objectName: A() });
    }
  },
  async comparaison(s, d) {
    for (const [side, x, bg, col] of [[d.gauche, 0.5, HEX.ice, HEX.blue], [d.droite, 5.2, HEX.mint, HEX.green]]) {
      card(s, x, 1.5, 4.3, 3.5, bg);
      T(s, side.titre, { x: x + 0.3, y: 1.7, w: 3.7, h: 0.5, fontSize: 17, bold: true, color: col, objectName: A() });
      const pts = side.points.map((t, i, a) => ({ text: t, options: { bullet: { code: "25CF" }, breakLine: i < a.length - 1, paraSpaceAfter: 8 } }));
      T(s, pts, { x: x + 0.3, y: 2.3, w: 3.7, h: 2.55, fontSize: 14, objectName: A() });
    }
    s.addShape(pres.shapes.OVAL, { x: 4.62, y: 2.9, w: 0.76, h: 0.76, fill: { color: HEX.orange }, line: { color: HEX.white, width: 3 }, objectName: A() });
    T(s, "VS", { x: 4.62, y: 2.9, w: 0.76, h: 0.76, fontSize: 15, bold: true, color: HEX.white, align: "center", valign: "middle", objectName: A() });
  },
  async processus(s, d) {
    const et = (d.etapes || []).slice(0, 5), n = et.length, w = 9 / n;
    for (let i = 0; i < n; i++) {
      const x = 0.5 + i * w;
      s.addShape(pres.shapes.OVAL, { x: x + w / 2 - 0.4, y: 1.55, w: 0.8, h: 0.8, fill: { color: i === n - 1 ? HEX.orange : HEX.blue }, line: { color: HEX.white }, objectName: A() });
      T(s, String(i + 1).padStart(2, "0"), { x: x + w / 2 - 0.4, y: 1.55, w: 0.8, h: 0.8, fontSize: 18, bold: true, color: HEX.white, align: "center", valign: "middle", objectName: A() });
      if (i < n - 1) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + w / 2 + 0.5, y: 1.85, w: w - 1.0, h: 0.2, fill: { color: "C9D6E3" }, line: { color: "C9D6E3" }, objectName: A() });
      card(s, x + 0.08, 2.65, w - 0.16, 2.35, HEX.ice);
      T(s, et[i].titre, { x: x + 0.2, y: 2.8, w: w - 0.4, h: 0.55, fontSize: 14, bold: true, color: HEX.blue, align: "center", objectName: A() });
      T(s, et[i].texte, { x: x + 0.2, y: 3.4, w: w - 0.4, h: 1.5, fontSize: n > 4 ? 12 : 13, align: "center", objectName: A() });
    }
  },
  async stat(s, d) {
    card(s, 0.5, 1.5, 4.4, 3.5, HEX.blue);
    T(s, d.valeur, { x: 0.7, y: 1.75, w: 4.0, h: 1.4, fontSize: d.valeur.length > 7 ? 44 : 60, bold: true, fontFace: "Cambria", color: HEX.orange, valign: "middle", objectName: A() });
    T(s, d.label, { x: 0.7, y: 3.2, w: 4.0, h: 1.0, fontSize: 16, bold: true, color: HEX.white, objectName: A() });
    T(s, "Source : " + d.source, { x: 0.7, y: 4.3, w: 4.0, h: 0.5, fontSize: 10, italic: true, color: "C9D6E3", objectName: A() });
    await iconBadge(s, "FaChartBar", 5.3, 1.6, 0.6, HEX.sand, "C2410C");
    T(s, d.commentaire, { x: 5.3, y: 2.4, w: 4.2, h: 2.4, fontSize: 16, objectName: A() });
  },
  async citation(s, d) {
    await iconBadge(s, "FaQuoteLeft", 0.5, 1.45, 0.7, HEX.orange, HEX.white);
    T(s, d.texte, { x: 1.4, y: 1.5, w: 7.9, h: 2.6, fontSize: 22, italic: true, fontFace: "Cambria", color: HEX.white, valign: "middle", objectName: A() });
    T(s, "— " + d.auteur, { x: 1.4, y: 4.2, w: 7.9, h: 0.45, fontSize: 15, bold: true, color: HEX.orange, objectName: A() });
  },
  async exercice(s, d) {
    card(s, 0.5, 1.45, 5.3, 3.55, HEX.sand);
    await iconBadge(s, "FaPencilAlt", 0.8, 1.7, 0.6, HEX.orange, HEX.white);
    T(s, d.consigne, { x: 0.8, y: 2.45, w: 4.75, h: 2.4, fontSize: 16, objectName: A() });
    const et = (d.etapes || []).slice(0, 3);
    for (let i = 0; i < et.length; i++) {
      const y = 1.5 + i * 1.18;
      s.addShape(pres.shapes.OVAL, { x: 6.15, y, w: 0.5, h: 0.5, fill: { color: HEX.blue }, line: { color: HEX.blue }, objectName: A() });
      T(s, String(i + 1), { x: 6.15, y, w: 0.5, h: 0.5, fontSize: 14, bold: true, color: HEX.white, align: "center", valign: "middle", objectName: A() });
      T(s, et[i], { x: 6.8, y: y - 0.2, w: 2.7, h: 0.9, fontSize: 14, valign: "middle", objectName: A() });
    }
  },
};

async function quizSlide(qs, idx, total) {
  const s = pres.addSlide({ masterName: "LSE_CONTENU", sectionTitle: "Évaluation formative" });
  header(s, `Quiz étudiants · ${idx}/${total}`, "Testez vos connaissances");
  const rowH = qs.length === 3 ? 1.22 : 1.75;
  for (let k = 0; k < qs.length; k++) {
    const q = qs[k], y = 1.42 + k * rowH;
    T(s, `${q.num}. ${q.q}`, { x: 0.5, y, w: 9, h: 0.42, fontSize: 14, bold: true, color: HEX.blue, valign: "middle", objectName: A() });
    const ow = 2.2;
    for (let j = 0; j < 4; j++) {
      const x = 0.5 + j * (ow + 0.067), oy = y + 0.46, oh = rowH - 0.62;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: oy, w: ow, h: oh, rectRadius: 0.08, fill: { color: HEX.ice }, line: { color: "C9D6E3" }, objectName: A() });
      if (j === q.bonne) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: oy, w: ow, h: oh, rectRadius: 0.08, fill: { color: HEX.mint }, line: { color: HEX.green, width: 2.5 }, objectName: CL() });
      T(s, `${"ABCD"[j]}. ${q.options[j]}`, { x: x + 0.1, y: oy, w: ow - 0.2, h: oh, fontSize: 11, valign: "middle", objectName: A() });
    }
  }
  T(s, "Cliquez pour révéler les bonnes réponses · explications dans les notes", { x: 0.5, y: 4.98, w: 9, h: 0.24, fontSize: 10, italic: true, color: HEX.grey });
  s.addNotes("Bonnes réponses et explications :\n" + qs.map(q => `${q.num}. ${"ABCD"[q.bonne]} — ${q.explication}`).join("\n"));
}

(async () => {
  // 1. Titre
  pres.addSection({ title: "Introduction" });
  let s = pres.addSlide({ masterName: "LSE_TITRE", sectionTitle: "Introduction" });
  s.addShape(pres.shapes.OVAL, { x: 7.0, y: -1.2, w: 4.2, h: 4.2, fill: { color: HEX.orange, transparency: 85 }, line: { color: HEX.orange, transparency: 60, width: 1.5 } });
  s.addShape(pres.shapes.OVAL, { x: 7.9, y: 2.7, w: 2.8, h: 2.8, fill: { color: HEX.green, transparency: 80 }, line: { color: HEX.green, transparency: 50, width: 1.5 } });
  tag(s, `Sociologie économique · Niveau ${K.niveau.toLowerCase()}`, 0.6, 0.6, true);
  T(s, K.titre, { x: 0.6, y: 1.05, w: 7.2, h: 1.6, fontFace: "Cambria", fontSize: 36, bold: true, color: HEX.white, valign: "bottom", objectName: A() });
  T(s, K.accroche, { x: 0.6, y: 2.8, w: 6.8, h: 0.9, fontSize: 18, italic: true, color: HEX.orange, objectName: A() });
  T(s, [
    { text: "Ressource pédagogique libre pour les étudiants et enseignants en sociologie", options: { breakLine: true } },
    { text: "SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH" },
  ], { x: 0.6, y: 3.85, w: 7.0, h: 0.95, fontSize: 12, color: "C9D6E3", objectName: A() });
  s.addNotes(`Accueil de la séance. Poser la question d'accroche et recueillir 3 ou 4 réponses spontanées avant de présenter les objectifs. ${K.resume || ""}`);

  // 2. Objectifs + plan
  s = pres.addSlide({ masterName: "LSE_CONTENU", sectionTitle: "Introduction" });
  header(s, "Feuille de route", "Objectifs et plan de la séance");
  card(s, 0.5, 1.45, 4.55, 3.55, HEX.ice);
  T(s, "À la fin de ce module, vous saurez :", { x: 0.75, y: 1.6, w: 4.1, h: 0.35, fontSize: 13, bold: true, color: HEX.blue, objectName: A() });
  for (let i = 0; i < Math.min(4, K.objectifs.length); i++) {
    const y = 2.05 + i * 0.72;
    s.addImage({ data: await icon("FaCheckCircle", HEX.green), x: 0.75, y: y + 0.04, w: 0.28, h: 0.28, objectName: A() });
    T(s, K.objectifs[i], { x: 1.15, y, w: 3.75, h: 0.68, fontSize: 13, objectName: A() });
  }
  for (let i = 0; i < Math.min(4, K.plan.length); i++) {
    const y = 1.5 + i * 0.88;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.4, y, w: 0.7, h: 0.7, rectRadius: 0.12, fill: { color: i === 0 ? HEX.orange : HEX.blue }, line: { color: HEX.white }, objectName: A() });
    T(s, ["I", "II", "III", "IV"][i], { x: 5.4, y, w: 0.7, h: 0.7, fontSize: 16, bold: true, fontFace: "Cambria", color: HEX.white, align: "center", valign: "middle", objectName: A() });
    T(s, K.plan[i], { x: 6.3, y, w: 3.2, h: 0.7, fontSize: 15, bold: true, color: HEX.anth, valign: "middle", objectName: A() });
  }
  s.addNotes("Présenter les objectifs comme un contrat pédagogique : ils seront vérifiés par le quiz final et l'évaluation formative.");

  // 3. Contenu
  pres.addSection({ title: "Cours" });
  for (const d of content) {
    const dark = d.type === "citation";
    s = pres.addSlide({ masterName: dark ? "LSE_SOMBRE" : "LSE_CONTENU", sectionTitle: "Cours" });
    header(s, KICK[d.type] || "Cours", d.titre, dark);
    await (R[d.type] || R.concept)(s, d);
    if (d.notes) s.addNotes(d.notes);
  }

  // 4. Évaluation formative étudiants (2 diapositives)
  pres.addSection({ title: "Évaluation formative" });
  const qz = (K.quiz_etudiant || []).slice(0, 5).map((q, i) => Object.assign({ num: i + 1 }, q));
  await quizSlide(qz.slice(0, 3), 1, 2);
  await quizSlide(qz.slice(3, 5), 2, 2);

  // 5. Évaluation enseignant
  const E = K.eval_enseignant || {};
  s = pres.addSlide({ masterName: "LSE_CONTENU", sectionTitle: "Évaluation formative" });
  header(s, "Espace enseignant", "Vérifier les apprentissages");
  await iconBadge(s, "FaChalkboardTeacher", 0.5, 1.45, 0.5, HEX.blue, HEX.white);
  T(s, "À observer en séance", { x: 1.1, y: 1.5, w: 3.2, h: 0.4, fontSize: 14, bold: true, color: HEX.blue, valign: "middle", objectName: A() });
  T(s, (E.verifier || []).slice(0, 3).map((t, i, a) => ({ text: t, options: { bullet: { code: "2610" }, breakLine: i < a.length - 1, paraSpaceAfter: 6 } })), { x: 0.5, y: 2.05, w: 3.9, h: 1.55, fontSize: 12, objectName: A() });
  const rows = [[{ text: "Critère", options: { bold: true, color: HEX.white, fill: { color: HEX.blue } } }, { text: "Niveau attendu", options: { bold: true, color: HEX.white, fill: { color: HEX.blue } } }]]
    .concat((E.grille || []).slice(0, 4).map(g => [{ text: g.critere, options: { bold: true } }, { text: g.attendu }]));
  s.addTable(rows, { x: 4.65, y: 1.45, w: 4.85, colW: [1.6, 3.25], fontSize: 10.5, fontFace: "Calibri", color: HEX.anth, border: { type: "solid", pt: 0.75, color: "C9D6E3" }, fill: { color: HEX.white }, valign: "middle", margin: 0.05, objectName: A() });
  card(s, 0.5, 3.75, 9.0, 1.3, HEX.sand);
  T(s, [{ text: "Activité de TD / évaluation formative  ", options: { bold: true, color: "C2410C" } }, { text: E.activite_td || "" }], { x: 0.7, y: 3.85, w: 8.6, h: 1.12, fontSize: 12, valign: "middle", objectName: A() });
  s.addNotes("Questions réflexives pour l'enseignant :\n" + (E.questions_reflexives || []).map(q => "- " + q).join("\n"));

  // 6. Synthèse + débat
  pres.addSection({ title: "Conclusion" });
  s = pres.addSlide({ masterName: "LSE_SOMBRE", sectionTitle: "Conclusion" });
  header(s, "Synthèse", "Ce qu'il faut retenir", true);
  const pts = (K.synthese.points || []).slice(0, 4);
  for (let i = 0; i < pts.length; i++) {
    const y = 1.45 + i * 0.66;
    s.addImage({ data: await icon("FaStar", HEX.orange), x: 0.5, y: y + 0.08, w: 0.26, h: 0.26, objectName: A() });
    T(s, pts[i], { x: 0.9, y, w: 4.6, h: 0.6, fontSize: 14, color: HEX.white, objectName: A() });
  }
  card(s, 0.5, 4.15, 5.0, 0.85, HEX.orange);
  T(s, K.synthese.a_retenir, { x: 0.7, y: 4.18, w: 4.6, h: 0.8, fontSize: 13, bold: true, color: HEX.white, valign: "middle", objectName: A() });
  card(s, 5.85, 1.45, 3.65, 3.55, HEX.blue2);
  await iconBadge(s, "FaComments", 6.1, 1.65, 0.5, HEX.green, HEX.white);
  T(s, "Débat scientifique", { x: 6.75, y: 1.7, w: 2.6, h: 0.4, fontSize: 13, bold: true, color: HEX.orange, valign: "middle", objectName: A() });
  T(s, K.debat.question, { x: 6.1, y: 2.25, w: 3.2, h: 1.05, fontSize: 12.5, bold: true, italic: true, color: HEX.white, fit: "shrink", objectName: A() });
  T(s, (K.debat.pistes || []).slice(0, 3).map((t, i, a) => ({ text: t, options: { bullet: { code: "25B8" }, breakLine: i < a.length - 1, paraSpaceAfter: 4 } })), { x: 6.1, y: 3.35, w: 3.25, h: 1.6, fontSize: 9.5, color: "DCE6F0", fit: "shrink", objectName: A() });
  s.addNotes("Organiser le débat en deux groupes (10 min), puis restitution croisée. Pistes : " + (K.debat.pistes || []).join(" / "));

  // 7. Références
  s = pres.addSlide({ masterName: "LSE_CONTENU", sectionTitle: "Conclusion" });
  header(s, "Bibliographie", "Pour aller plus loin");
  await iconBadge(s, "FaBook", 0.5, 1.5, 0.55, HEX.ice, HEX.blue);
  const refs = (K.references || []).slice(0, 7).map((r, i, a) => ({ text: `${r.auteur} (${r.annee}). ${r.titre}. ${r.editeur || ""}`.replace(/\.\s*\.$/, ".").trim(), options: { breakLine: i < a.length - 1, paraSpaceAfter: 7, bullet: { code: "25AA" } } }));
  T(s, refs, { x: 1.3, y: 1.45, w: 8.2, h: 3.6, fontSize: refs.length > 6 ? 12 : 13, objectName: A() });
  s.addNotes("Les ressources complémentaires, le quiz interactif et la vidéo du module sont disponibles sur la plateforme SOCIOLOGIE DE L'ÉCONOMIE - Blog Dr Fabrice TANOH.");

  await pres.writeFile({ fileName: outFile });
  await applyTheme(outFile, THEME);
  console.log("OK", outFile, (content.length + 7) + " diapositives");
})().catch(e => { console.error(e); process.exit(1); });
