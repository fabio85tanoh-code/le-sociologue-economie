# Format d'un cours — `courses/<CODE>.json`

Un fichier JSON par cours (UTF-8, français soigné, accents). Il alimente À LA FOIS le PowerPoint animé
(générateur `decks/build_deck.js`) et le lecteur de cours du site « Sociologie de l'Économie ».
Les métadonnées (code, titre, niveau, semestre, parcours, volume horaire, enseignant) sont reprises
telles quelles de `courses/manifest.json`.

```json
{
  "code": "ECS2522",
  "titre": "Sociologie et anthropologie économique",
  "niveau": "Licence 2", "semestre": 4, "parcours": "Tronc commun",
  "ue_code": "ECS242", "ue": "Économie et société",
  "cm": 20, "td": 16, "credits": 3, "enseignant_cm": "Prof. SILUÉ Donakpo",
  "niveau_site": "debutant | intermediaire | avance",
  "theme_site": "informel | travail | marches | agriculture | entrepreneuriat | developpement | inegalites | genre | finance | environnement | organisations | savoir",
  "accroche": "Question d'ouverture qui accroche un étudiant ivoirien (≤ 18 mots)",
  "resume": "Résumé du cours en 2-3 phrases (pour le site)",
  "objectifs": ["3 ou 4 objectifs d'apprentissage, verbes d'action (Définir…, Analyser…)"],
  "plan": ["3 ou 4 parties du cours (≤ 7 mots chacune)"],
  "slides": [ /* 8 à 10 diapositives de contenu, voir types ci-dessous */ ],
  "quiz_etudiant": [ /* 5 QCM */ {"q":"…","options":["A","B","C","D"],"bonne":1,"explication":"…"} ],
  "eval_enseignant": {
    "verifier": ["3 indicateurs observables que l'enseignant vérifie en séance"],
    "grille": [{"critere":"…","attendu":"…"}],              // 3 à 4 lignes
    "activite_td": "Consigne d'une activité de TD/évaluation formative (3-4 phrases), ancrée en Côte d'Ivoire",
    "questions_reflexives": ["2-3 questions pour l'enseignant sur sa propre séance"]
  },
  "debat": {"question":"Question de débat scientifique", "pistes":["2-3 pistes, positions contrastées"]},
  "synthese": {"points":["4 idées-forces, ≤ 14 mots chacune"], "a_retenir":"Une phrase-clé"},
  "references": [{"auteur":"…","annee":2005,"titre":"…","editeur":"…"}],   // 5 à 7, RÉELLES
  "video": {"titre":"Titre court du Reel (≤ 6 mots)", "scenes":[ /* 5 à 7 scènes, voir plus bas */ ]}
}
```

## Types de diapositives (`slides[]`) — chaque objet a `type`, `titre` (≤ 8 mots, sans point final) et `notes` (notes orateur, 60-120 mots, ce que dit l'enseignant)

| type | champs | usage |
|---|---|---|
| `concept` | `definition` (≤ 40 mots), `auteur` ("Polanyi, 1944"), `points` [3 × ≤ 14 mots] | définir une notion |
| `auteurs` | `items` [3-4 × {`auteur`,`annee`,`idee` ≤ 16 mots}] | frise des grands auteurs / courants |
| `cas_ci` | `contexte` (≤ 35 mots), `chiffres` [1-3 × {`valeur` ("≈ 90 %"), `label` ≤ 8 mots, `source` ("ANSTAT, ENE 2019")}], `analyse` [2-3 × ≤ 16 mots] | cas ivoirien |
| `monde` | `exemples` [3 × {`pays`,`texte` ≤ 20 mots}] | comparaison internationale (Afrique, Asie, Amériques, Europe) |
| `comparaison` | `gauche` {`titre`,`points`[3]}, `droite` {`titre`,`points`[3]} | opposer deux approches |
| `processus` | `etapes` [3-5 × {`titre` ≤ 4 mots, `texte` ≤ 14 mots}] | mécanisme, méthode |
| `stat` | `valeur` ("63 %"), `label` (≤ 12 mots), `source`, `commentaire` (≤ 30 mots) | chiffre-choc |
| `citation` | `texte` (≤ 30 mots, citation réelle et exacte, sinon paraphrase signalée par « Idée : »), `auteur` | respiration |
| `exercice` | `consigne` (≤ 40 mots), `etapes` [2-3] | mini-activité en séance |

Ordre conseillé : concept → auteurs → (comparaison/processus) → cas_ci → stat → monde → exercice … ; au
moins 2 `cas_ci` ou `stat` ivoiriens, au moins 1 `monde`, 1 `exercice`. Le générateur ajoute lui-même :
titre, objectifs + plan, quiz étudiants, évaluation enseignant, débat, synthèse, références → 14-15 diapositives.

## Scènes vidéo (`video.scenes[]`) — Reel 9:16 d'environ 45-60 s, une idée par écran
`{"type":"question","texte":"…"}` · `{"type":"motcle","tag":"…","texte":"…","sous":"…"}` ·
`{"type":"stat","valeur":"…","label":"…","source":"…"}` · `{"type":"etapes","titre":"…","items":["…","…","…"]}` ·
`{"type":"compare","gauche":"…","droite":"…","titre":"…"}` · `{"type":"retenir","texte":"…"}`
Textes très courts (titre ≤ 6 mots, items 1-3 mots). Marquage : `*mot*` = mot-clé surligné.

## Exigences de qualité (non négociables)
- **Aucun chiffre inventé.** Chaque chiffre vient d'une source vérifiée par recherche web (ANSTAT/INS,
  ENE, EHCVM, Banque mondiale, BCEAO, OIT, FAO, PNUD, Conseil Café-Cacao, ministères…) avec année.
  En cas de doute : arrondir (« près de 9 sur 10 ») et citer, ou ne pas mettre de chiffre.
- **Références réelles uniquement** (auteur, année, titre exacts). Mélanger classiques (Weber, Polanyi,
  Granovetter, Bourdieu, Becker, Coleman, Mauss, Hart, Olivier de Sardan, Chauveau…) et travaux
  africains / ivoiriens.
- Réalités ivoiriennes concrètes (Adjamé, Yopougon, Korhogo, cacao, anacarde, gbaka, woro-woro,
  tontines, Mobile Money, coopératives, CMU, FDFP…) ET mondiales.
- Ton : universitaire, clair, vivant ; pas d'emoji ; écriture française (guillemets « », espaces).
- Valider le JSON : `python3 -c "import json;json.load(open('courses/CODE.json'))"`.

## Nouveaux types (densification) — ajoutés le 18/11/2026
| type | champs | usage |
|---|---|---|
| `graphique` | `kind` ("bar" \| "line"), `labels` [3-12 années ou catégories], `series` [1-3 × {`nom`, `valeurs` [nombres, même longueur que labels]}], `unite` ("%", "milliers de tonnes"…), `source` ("Banque mondiale, WDI, indicateur SL.EMP.VULN.ZS"), `url` (page ou API d'où viennent les données), `maj` ("2026-11"), `lecture` (≤ 40 mots : ce que montre le graphique, lecture sociologique prudente) | données réelles issues de bases ouvertes (Banque mondiale WDI, ILOSTAT, FAOSTAT, BCEAO, ANSTAT, PNUD HDR, Findex, OurWorldInData…). Aucune valeur estimée ou extrapolée. |
| `schema` | `kind` ("cycle" \| "flux" \| "pyramide"), `noeuds` [3-6 × {`label` ≤ 4 mots, `texte` ≤ 14 mots}], `lecture` (≤ 30 mots) | schéma conceptuel (mécanisme, chaîne de valeur, cycle de la tontine, hiérarchie des acteurs…) |
Chaque diapositive garde `titre` (≤ 8 mots) et `notes` (60-120 mots). Ces types sont rendus dans le PowerPoint (graphique natif) et sur le site (Chart.js / schéma animé).
