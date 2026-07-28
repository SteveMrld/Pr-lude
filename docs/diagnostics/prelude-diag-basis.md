# Diagnostic basis actual/budget, In Haircare, lecture seule

Brief #11 phase 1. Aucune écriture dans le repo, aucun run de pipeline. Les données de runs proviennent de lectures Supabase sur la table `analyses`, filtrées sur `company_name ilike '%haircare%'`.

Correction factuelle d'entrée : il n'y a pas quatre runs sur le deckHash `0ab52fa927d846c0`, il y en a **sept**, du 15 juillet au 27 juillet 2026. Le partage n'est pas deux contre deux mais **quatre en `budget` contre trois en `actual`**. Le premier des sept est antérieur à l'introduction de temperature 0 (`b68f251`, `fix(engines) temperature 0 sur les moteurs d extraction structuree`, 15 juillet), les six autres sont postérieurs. Sur ces six runs à temperature 0 prouvée, le partage est de trois contre trois. La divergence n'est donc pas un résidu du sampling d'avant la correction, elle survit intégralement à temperature 0.

---

## 1. Où basis est produit, et ce que le modèle est réellement chargé de faire

Le champ est déclaré dans le SYSTEM_PROMPT du moteur d'extraction financière, `lib/engines/financial-extraction-engine.ts:12-16`. La formulation est celle d'une qualification, pas d'une lecture : « Tu qualifies aussi la NATURE TEMPORELLE de chaque exercice via un champ "basis" strictement doctrinal ». Les trois valeurs sont définies par leur nature comptable, et les marqueurs textuels ne viennent qu'en second, entre parenthèses, précédés de « souvent noté » :

- `:13` `actual` : « exercice clos et RÉALISÉ, chiffres audités ou constatés (souvent noté YYYYA dans le document, ou "réalisé", "constaté", "clos") »
- `:14` `budget` : « exercice EN COURS budgété, valeur cible fixée en début d'année (souvent noté YYYYB, ou "budget", "atterrissage") »
- `:15` `projected` : « exercice FUTUR projeté (souvent noté YYYYE / YYYYF / YYYYP, ou "prévision", "estimation", "projection", "cible", "d'ici") »

La règle anti-divination de `:18` interdit de deviner en l'absence de qualifier, et `:86` interdit qu'un chiffre sans qualifier devienne `actual` par défaut. Ces deux gardes couvrent le cas du **silence** du document. Aucune ligne du prompt ne couvre le cas de la **contradiction** du document, qui est précisément le cas In Haircare.

La réponse à la question posée est donc nette. Le modèle ne rend pas un fait, il rend un jugement. Le prompt lui demande de statuer sur la nature comptable d'un exercice, catégorie qui n'existe pas telle quelle dans le document, et lui fournit une table de correspondance entre marqueurs textuels et catégories. Quand le document porte deux marqueurs qui pointent vers deux catégories différentes pour la même année, le prompt ne dit pas lequel l'emporte, et l'arbitrage est laissé au modèle sans qu'aucune trace structurée n'en subsiste.

Le libellé brut de colonne n'est demandé nulle part. Il n'existe aucun champ, ni dans le format JSON de `:24-69`, ni dans le type `ProjectionEntry` de `lib/engines/types.ts:569-574`, qui reçoive le texte de l'en-tête tel quel. `ProjectionEntry` porte `year`, `value`, `source` et `basis`, où `source` désigne la provenance de fichier (deck, bp, deck+bp) et non la localisation dans le document.

## 2. Ce que le deck In Haircare porte réellement pour 2024

Le suffixe « a » de `2024a` est capté, et il l'est dans les sept runs sans exception. Il n'apparaît jamais dans un champ structuré, seulement en prose libre dans `rawNotes` et dans `lastActualYearEvidence`. Le PDF n'étant pas conservé côté base, la reconstitution ci-dessous vient de la convergence des sept `rawNotes`, qui décrivent toutes le même document.

Le deck porte **deux systèmes de libellés qui se contredisent sur 2024** :

| Emplacement | Libellé pour 2024 | Doctrine du prompt |
|---|---|---|
| Slide 10, tableau P&L, en-tête de colonne | « Atterrissage 2024 » | `budget` par `:14`, qui liste explicitement « atterrissage » |
| Slide 2, accroche chiffrée | « 2,1m€ CA 2024a » | `actual` par `:13`, qui liste explicitement le suffixe YYYYA |
| Slide 4, graphique de croissance | barre « 2024a », voisine d'une barre « 2025b » | `actual` par `:13` |
| Slide 11, distribution BtoB | « 24a », « 25b », « 26b » | `actual` par `:13` |
| Slide 12 | « Breakeven en 2024 » | aucun marqueur de basis |

Les colonnes voisines du même tableau P&L sont libellées « réel » pour 2020 à 2023 et « bp » pour 2025 et 2026. Le tableau est donc cohérent avec lui-même : réel, réel, réel, réel, atterrissage, bp, bp. Le graphique est cohérent avec lui-même : `24a`, `25b`, `26b`. Les deux sont incohérents entre eux, puisque le même exercice 2024 y est « atterrissage » d'un côté et suffixé « a » de l'autre, et que le prompt mappe ces deux marqueurs sur deux valeurs de basis mutuellement exclusives.

Le modèle a donc dans son entrée de quoi trancher sans deviner, deux fois, dans deux directions opposées. **L'ambiguïté est dans le document source, pas dans la lecture qu'en fait le modèle.** Les runs le disent d'ailleurs eux-mêmes, et c'est le point le plus révélateur du dossier : deux runs exposent leur arbitrage à voix haute dans `rawNotes`. Le run `9201a046` écrit « la colonne P&L slide 10 est intitulée 'Atterrissage 2024', ce qui correspond à un budget/atterrissage et non à un réel audité ; basis retenu : 'actual' car le deck qualifie explicitement '2024a' sur les slides 2 et 4 ». Le run `c50bb153` écrit « le 2024 est qualifié 'Atterrissage' dans le tableau P&L, ce qui correspond à la notion de budget/atterrissage en cours d'année ; cependant la page 2 et la page 4 le qualifient explicitement '2024a' (actual). Basis retenu : actual pour 2024 ». Les quatre runs `budget` voient les mêmes deux marqueurs et tranchent dans l'autre sens, en général en présentant `2024a` comme « cohérent avec l'atterrissage » (`7d50d2b2`, `c487a8b2`).

Sur le fond comptable, les deux marqueurs se réconcilient sans peine : un atterrissage sur un exercice déjà clos mais non encore audité est un réalisé provisoire, ce qui est exactement ce que « 2024a » revendique et ce que « Breakeven en 2024 » suppose. Cette réconciliation relève d'une doctrine à arrêter, pas d'un fait lisible dans le document. Le document, lui, dit les deux.

## 3. Dérivation exacte de lastActualYear et comportement quand elle est nulle

La règle est posée dans le prompt à `lib/engines/financial-extraction-engine.ts:84` : « lastActualYear = max des années dont basis === "actual" dans revenueProjection. Si aucune année actual, lastActualYear = null. » L'exigence de citation est à `:85` : sans citation extractible, `lastActualYearEvidence = null` et `lastActualYear = null` également.

Point capital : **cette dérivation n'est jamais exécutée par du code.** Elle est énoncée au modèle, qui l'applique lui-même et livre le résultat. Le seul traitement côté code est le défaut d'absence, `:136-137` pour la branche sans BP et `:178-179` pour la branche avec BP, qui convertit `undefined` en `null` et rien d'autre. Le commentaire de `:133-135` le revendique comme contrat : « le pipeline ne fabrique jamais cette valeur, il l accepte telle quelle du LLM ou reste silencieux ». Aucun `Math.max` sur les basis `actual`, aucune vérification que la valeur rendue coïncide avec ce que les basis impliquent. Sur les sept runs observés, l'invariant tient (le `lastActualYear` égale toujours le max des années `actual`), mais il tient par obéissance du modèle, pas par construction.

Le champ peut valoir `null`, le type l'autorise, `lib/engines/types.ts:622` le déclare `number | null` optionnel, et la doctrine de `:615-620` en fait un état légitime.

En aval, `null` déclenche une chaîne d'abstention explicite. `lib/analysis/reference-year.ts:110-111` retourne `year: null` avec le motif `last-actual-year-absent`. `lib/engines/indicators-engine.ts:190-191` bascule alors sur la dernière année de projection avec `baseState: 'unknown'` pour les indicateurs qui peuvent encore se calculer, et `:390-391` marque `ruleOf40` non-applicable avec le motif « Annee de reference du dossier non derivable. Indicateur non calculable sans base temporelle validee, jamais devine sur l horloge systeme ». `:1410-1412` remonte un warning nommant explicitement les indicateurs neutralisés. Le comportement en absence est propre et documenté. Ce n'est pas le point de fragilité.

## 4. La frontière actuelle entre modèle et code

Il n'y a pas de frontière. Le code ne post-traite rien sur `basis`.

Un grep sur `basis` dans tout le repo, hors `node_modules`, hors le champ homonyme du CAC dans `saas-metrics-engine.ts:150-153` qui désigne une tout autre notion (per-customer, per-lead, per-mql), donne ceci : le champ est écrit par le LLM, typé à `lib/engines/types.ts:567`, et lu tel quel par ses consommateurs. Aucune fonction ne le valide, ne le normalise, ne le corrige, ne le recoupe. Une valeur hors énumération, `"réel"` par exemple, traverserait le pipeline sans être arrêtée : `parseJSON` ne valide pas contre le type, et les garde-fous de `:121-137` ne touchent que la présence des tableaux.

Le contraste avec `lastActualYear` est instructif. Cette valeur-là, elle, subit une garde de vraisemblance côté code, dans `lib/analysis/reference-year.ts`, dont l'en-tête à `:16-25` revendique explicitement le principe : « La garde de vraisemblance est dans le code, pas dans la suite de tests. » Trois contrôles s'appliquent, la plage `[2000, 2100]` à `:117-118`, la présence d'une citation non vide à `:122-128`, et deux gardes structurelles à `:141-158`, appartenance de l'année aux années des projections et non-postériorité à la dernière projection. Le déplacement de décision que Steve envisage a donc déjà un précédent dans le repo, sur le champ voisin, avec la même doctrine et un module dédié.

Mais cette garde ne peut rien contre le cas In Haircare, et c'est le nœud. Les deux valeurs candidates, 2023 et 2024, passent toutes les deux l'intégralité des contrôles : toutes deux dans la plage, toutes deux accompagnées d'une citation textuelle réelle et vérifiable, toutes deux présentes dans `revenueProjection`, aucune postérieure à 2026. La garde valide la vraisemblance, jamais la véracité. Elle attrape un `lastActualYear=2013` sur un dossier 2021-2026, elle ne peut pas départager deux lectures également plausibles du même document.

## 5. Ce qu'un déplacement de décision vers le code exigerait

Ce que le modèle n'extrait pas aujourd'hui et devrait extraire : **le texte de l'en-tête, et l'endroit d'où il vient**. Aucun champ ne porte aujourd'hui l'un ni l'autre.

Le deck In Haircare fournit trois signaux, tous stables entre les sept runs, tous absents des champs structurés :

1. Le libellé de colonne du tableau P&L, « réel » / « Atterrissage » / « bp ». Stable, présent dans les sept `rawNotes`.
2. Le suffixe de libellé de graphique, `24a` / `25b` / `26b`. Stable, présent dans les sept `rawNotes`.
3. La localisation, slide 10 pour le tableau, slides 2, 4 et 11 pour les mentions suffixées.

Le signal existe donc, il est déterministe, et il est déjà lu par le modèle à chaque run. Ce qui n'est pas déterministe, c'est l'arbitrage entre les signaux 1 et 2, et l'arbitrage est aujourd'hui rejoué à chaque run sans mémoire ni trace structurée.

Il faut être exact sur ce que le déplacement achèterait. **Il n'élimine pas le jugement, il le déplace et le rend unique.** Décider qu'un libellé de tableau P&L prime sur un suffixe de graphique, ou l'inverse, ou qu'un exercice portant les deux marqueurs est un réalisé provisoire, reste une doctrine. La différence est qu'une doctrine posée dans le code est écrite une fois, versionnée, testable sur corpus, opposable à un partner qui conteste, et identique aux sept runs. Aujourd'hui elle est réinventée à chaque appel, par un modèle qui n'a pas de raison de trancher deux fois pareil, et dont la justification finit dans un champ de prose libre que rien ne lit.

Une réserve de faisabilité, sur laquelle le code ne tranche pas et que je ne peux pas lever en lecture seule : **inconnu**, la capacité du modèle à rendre le libellé brut fidèlement sur un corpus de decks variés n'est pas mesurable ici. Le script `scripts/validate-extraction-corpus.ts:286-299` collecte déjà `basisByYear` par dossier sur le corpus et serait le véhicule naturel de cette mesure, mais il exige une clé API et sort du cadre de cette phase.

## 6. Les consommateurs de basis et de lastActualYear

**`basis`**, quatre lecteurs, tous en lecture directe :

- `lib/engines/indicators-engine.ts:200-202`, dans `resolveYearForIndicator`. Le basis n'intervient qu'en règle 4, quand `refYear` n'est pas présent parmi les années de la projection : le max des années `basis === 'actual'` est alors préféré. Sur In Haircare, `refYear` figure toujours dans la projection, donc cette branche ne se déclenche pas et `basis` n'agit qu'indirectement, via le `lastActualYear` qu'il détermine en amont.
- `lib/note/financial-table-alignment.ts:42`, où `basis` figure dans le type `YearValueEntry` mais n'est utilisé par aucune des deux fonctions du module. Champ traversant, non consommé.
- `lib/engines/financial-coherence-engine.ts:516`, en creux et c'est le point à retenir : le prompt du moteur de cohérence financière sérialise `revenueProjection` sous la forme `${r.year}: ${r.value}M€ (source: ${r.source})`. **Le basis n'est pas transmis.** Le moteur qui juge la cohérence du plan financier ne sait pas quelles années sont réalisées et quelles années sont budgétées. Idem pour les trois autres séries à `:519-528`.
- Les suites de tests, `indicators-engine.test.ts:143-148` et `label-calculation-contradictions.test.ts:244-271`.

Le champ n'est **jamais affiché**. Aucun composant de `app/` ne le rend. Le lecteur de la note voit une ligne de chiffres dont la nature comptable est invisible, y compris dans le tableau Profil financier.

**`lastActualYear`**, rayon nettement plus large, via la primitive `deriveDossierReferenceYear` :

- `app/api/analyze/route.ts:1319-1331`, pipeline de production, alimente `computeIndicators`.
- `app/components/InvestmentNoteView.tsx:551-574`, recalcul client pour les analyses antérieures au déploiement du moteur d'indicateurs.
- `lib/refutation/label-calculation-contradictions.ts:85-98`, module de refutation.
- `scripts/validate-extraction-corpus.ts:301`, validation de corpus.
- Dans `indicators-engine.ts`, la valeur circule sous le nom `refYear` et gouverne l'année de calcul de sept indicateurs, aux appels `:291`, `:385`, `:762`, `:853`, `:1042`, `:1093`, plus le warning de `:1410-1412` et l'ancrage de fraîcheur des benchmarks à `:1417`.

Le moteur de valorisation, lui, **ne lit ni l'un ni l'autre**. `lib/engines/valuation-engine.ts:340-361`, `pickProjectionValue`, choisit son année sur l'horloge système et ignore `basis` intégralement. Les deux runs comparés au point 7 le confirment : `baseMetric = 6 552 000`, soit le CA 2026, dans les deux cas. C'est le chantier que le brief met hors périmètre, mais il faut noter qu'il est **orthogonal** à celui-ci : stabiliser `basis` ne corrigera pas à lui seul la valorisation, puisque la valorisation ne consulte pas `basis`.

## 7. La stabilité réelle du reste de l'extraction

`basis` n'est pas le seul champ qui varie, mais c'est le seul dont la variance change un verdict.

**Ce qui est parfaitement stable sur les sept runs** : toutes les valeurs numériques, sans exception. `revenueProjection` 0,48 / 1,56 / 1,752 / 1,483 / 2,113 / 3,697 / 6,552. `ebitdaProjection` 0,157 / 0,136 / -0,53 / -0,422 / 0,138 / 0,402 / 0,785. `grossMarginProjection` 85 / 84 / 76 / 76 / 77 / 73 / 69. `opexProjection` identique aux sept runs. `headcount` et `fcfProjection` vides aux sept runs. `hasBP` false, `fileSource` deck. `currentRound.amount` à 800k€ aux sept, à une casse près sur « Equity ». Le TAM cité, 747m€, identique aux sept.

**Ce qui varie**, par ordre de gravité :

*Premier, le basis de 2024*, quatre `budget` contre trois `actual`, dont trois contre trois sur les six runs à temperature 0.

*Deuxième, et corrélé au premier de façon parfaite, la composition même de la série.* Les trois runs qui classent 2024 en `actual` extraient **huit** entrées de revenue, commençant à 2019 avec 0,2 M€. Les quatre runs qui classent 2024 en `budget` en extraient **sept**, commençant à 2020. Corrélation sans exception sur sept runs. La lecture la plus économique est que le modèle ancre sa lecture sur l'une ou l'autre des deux représentations du document : le tableau P&L de la slide 10, qui commence en 2020 et dit « Atterrissage », ou le graphique de la slide 4, qui commence en 2019 et dit « 2024a ». Le basis n'est alors pas un champ instable isolé, c'est la trace d'un choix de source primaire non contraint, qui emporte avec lui le périmètre de la série. Cette instabilité-là est déjà connue du repo et a été traitée en aval, à l'affichage : l'en-tête de `lib/note/financial-table-alignment.ts:1-17` documente le run `9201a046` nommément, revenue à huit entrées contre grossMargin et ebitda à sept, et le décalage d'un an que l'alignement positionnel produisait dans le tableau de la note. Le symptôme a été corrigé par `f963bd8`. La cause est ici.

*Troisième, le basis de 2025 et 2026.* Six runs disent `projected`, le run `9201a046` dit `budget`. Troisième variante, sur un axe encore différent.

*Quatrième, la prose libre.* `unitEconomics.averageContractValue` oscille entre « 86€ panier moyen e-commerce », « panier moyen e-commerce : 86€ » et, pour `9201a046`, « non communiqué », le chiffre disparaissant purement et simplement. `tamCited` gagne ou perd « en France ». `targetCustomersByYearN` gagne ou perd « (2024) ». `rawNotes` diverge à chaque run, ce qui est attendu d'un champ de prose libre.

**La contradiction avec le récap.** Le récap indique que temperature 0 a stabilisé le Rule of 40 entre runs consécutifs. Les données ne le confirment pas. Les runs `7dd40680` et `7d50d2b2` partagent le **même commit `f963bd8`**, le même deck, la même temperature 0, et sont espacés de deux heures le 16 juillet. Leur Rule of 40 :

| Run | lastActualYear | Année de calcul | Croissance YoY | Marge EBITDA | Rule of 40 | Verdict |
|---|---|---|---|---|---|---|
| `7dd40680` | 2024 | 2024 | +42,5% | +6,5% | **+49** | best-in-class |
| `7d50d2b2` | 2023 | 2023 | -15,4% | -28,5% | **-43,8** | rouge |

L'arithmétique se vérifie exactement sur les valeurs stockées, via `lib/engines/indicators-engine.ts:400-432` : croissance YoY plus marge EBITDA de l'année retenue. Sur 2024, (2,113-1,483)/1,483 = +42,5% et 0,138/2,113 = +6,5%. Sur 2023, (1,483-1,752)/1,752 = -15,4% et -0,422/1,483 = -28,5%. Le dossier bascule de best-in-class à rouge, 93 points d'écart, sur un unique arbitrage de classification. La marge brute suit, 77% contre 76%, et le score global passe de 51 à 56.

Ce que temperature 0 a effectivement stabilisé, ce sont les **valeurs** lues dans le document, et le gain est réel : les sept séries numériques sont identiques au centime près sur sept runs. Ce qu'elle n'a pas stabilisé, et ne pouvait pas stabiliser, c'est l'**arbitrage** entre deux marqueurs contradictoires du document. Temperature 0 supprime le sampling stochastique, elle ne fournit pas de règle de priorité là où le prompt n'en donne aucune, et la doctrine énoncée à `lib/engines/anthropic-client.ts:438-452` ne prétend d'ailleurs rien de plus : le modèle « choisit toujours le token le plus probable », ce qui donne « un output stable a partir d un input stable ». L'input n'est stable qu'en apparence. Le PDF est identique, mais le contexte effectif de l'appel ne l'est pas : ces appels passent par le prompt caching d'Anthropic, `lib/engines/anthropic-client.ts:473`, et l'extraction financière est le deuxième à cinquième lecteur du même PDF selon l'ordonnancement du pipeline. Je ne peux pas établir en lecture seule que c'est là l'origine du basculement, et je ne l'affirme pas : **inconnu**, ce que le code ne tranche pas. Ce qui est établi, c'est que temperature 0 ne rend pas déterministe une décision que le document lui-même laisse ouverte.

---

## Ce que la lecture établit

La classification `basis` n'est pas un champ d'extraction qui dérive, c'est une **décision doctrinale déléguée au modèle sans règle d'arbitrage**, sur un document qui porte deux qualifications contradictoires pour le même exercice. Le prompt couvre le silence du document, `financial-extraction-engine.ts:18` et `:86`, jamais sa contradiction. Le code ne post-traite rien, ne valide rien, et la seule garde existante, `reference-year.ts:141-158`, valide la vraisemblance sans pouvoir départager deux lectures également vraisemblables. Le libellé brut de colonne, seul objet réellement factuel de toute cette chaîne, est lu par le modèle à chaque run, cité dans sa prose, et jeté avant d'atteindre le moindre champ structuré. Le rayon est étroit en nombre de lecteurs mais profond en conséquence : un seul arbitrage fait passer le Rule of 40 de +49 à -43,8 sur le même deck, et emporte avec lui le périmètre de la série extraite.
