# Sectoral Intelligence Layer

Fiche de conception produit du module qui dote Prélude d une lecture
sectorielle vivante, partagée entre les moteurs d analyse et offerte au
partner comme objet visuel sobre. Document de cadrage à valider avant
implémentation. Aucune ligne de code ne se touche tant que cette fiche
n a pas fait l objet d un accord explicite. Voix éditoriale Le Grand
Continent dans la fiche et dans l UI qu elle prescrit, pas de jargon
technique exposé au partner, pas d em-dashes.

## Le geste produit

Les moteurs d analyse de Prélude lisent aujourd hui chaque dossier comme
un objet relativement clos. Le moteur macro consulte une base
d indicateurs économiques généraux, le moteur Blindspot raisonne sur
des biais propres au pitch, le moteur Contrarian formule ses
contre-thèses à partir de la doctrine et du dossier lui-même. Aucun de
ces moteurs ne dispose d une lecture sectorielle stable, datée, et
auditable du milieu dans lequel l entreprise évolue. La conséquence
opérationnelle est connue : la qualité du verdict sur un dossier
biotech dépend silencieusement de ce que l état de l art du secteur
était dans la mémoire d entraînement du modèle, sans que ni le partner
ni le système ne puisse garantir que cette mémoire est à jour, ni
même la mêmes d un dossier à l autre.

La Sectoral Intelligence Layer répond à ce déficit. Elle introduit
entre le pipeline et le monde une couche intermédiaire qui maintient
en circuit fermé une cartographie de chaque grand secteur du capital
risque européen, structurée selon une grille doctrinale fixe, datée,
versionnée, et régénérée à cadence stable. Chaque dossier qui entre
dans le pipeline est rattaché à un secteur primaire et, le cas
échéant, à des secteurs secondaires. Les moteurs reçoivent en
injection contextuelle non pas une vague indication "fintech française
en 2026" mais la fiche sectorielle fintech fraîche, citée, et lisible.

Le second geste, complémentaire, est visuel. La cartographie
sectorielle se rend en spider chart sobre, sept axes lisibles d un
coup d œil, palette ocre brûlé sur crème, pas de neon ni de gimmick
SaaS. Cette spider chart n est pas un objet décoratif : c est le
premier élément d un langage visuel toile d araignée plus large qui
servira aussi à cartographier les quatorze moteurs Prélude
eux-mêmes, et à transformer l attente pendant l analyse en
démonstration méthodologique animée. Les inspirations assumées sont
les cartes d influences du XIXe siècle, les diagrammes de Edward
Tufte, la prose éditoriale Le Grand Continent. La sobriété est ici
une affirmation doctrinale, pas un choix esthétique facultatif.

## Ce qui existe déjà

Rien. Aucune table Supabase ne contient de fiche sectorielle, aucun
module n agrège de contexte sectoriel pour les moteurs, le moteur
macro consulte une couche d indicateurs économiques généraux mais sans
résolution sectorielle. Le module `lib/visuals/` n existe pas. La
fiche conceptuelle qui suit pose donc l intégralité du périmètre sans
contraintes héritées, à l exception de la voix éditoriale et de la
discipline anti-hallucination qui s appliquent à tout module Prélude.

## Dix arbitrages produit à trancher

Chaque décision se présente avec son dilemme, les options envisagées,
une recommandation, et un rationale doctrinal en deux phrases. L ordre
suit la chaîne logique du module : on commence par quoi on cartographie,
on finit par comment on en rend compte au partner.

### Décision 1 : liste des secteurs couverts au lancement

Trop peu de secteurs (cinq à huit) et la couverture du flow VC est
trouée, beaucoup de dossiers retombent dans une catégorie générique qui
trahit la promesse de granularité. Trop de secteurs (vingt et plus) et
la maintenance trimestrielle devient un poste de fonctionnement à part
entière, sans que la finesse supplémentaire serve la doctrine. Le bon
ordre de grandeur, pour le flow européen institutionnel, est entre douze
et quinze secteurs primaires.

**Recommandation : treize secteurs au lancement.** Logiciel d entreprise
horizontal, IA appliquée et infrastructure d apprentissage, Fintech,
Santé et biotech, Climat et énergie, Mobilité et logistique, Industrie
et hardware, Agritech et foodtech, Commerce et marketplaces verticales,
Cybersécurité et défense, Crypto et infrastructure blockchain, Proptech
et construction, Éducation et future of work. Cette grille couvre
empiriquement plus de quatre-vingt-quinze pour cent des deals européens
Series A à C observés sur 2023 à 2025 dans les bases publiques
Crunchbase et Dealroom. L IA est traitée comme secteur autonome et non
comme couche transverse, parce que l économie des modèles fondation et
des applications verticales a désormais ses propres dynamiques de
moats, de capex et de talent qui ne se laissent plus dissoudre dans
l agrégat logiciel.

### Décision 2 : structure standardisée des fiches sectorielles

Les dimensions choisies déterminent à la fois la lisibilité du spider
chart et la richesse de l injection aux moteurs. Trop peu d axes (quatre
ou cinq) et la lecture devient grossière, trop d axes (neuf ou plus) et
le polygone perd toute lisibilité diagnostique. Les axes doivent être
homogènes en échelle (chacun noté de zéro à cent), doctrinalement
chargés (pas des KPI d ambiance), et orthogonaux entre eux dans la
mesure du possible. Sept est le bon nombre, parce qu un heptagone se
lit bien et que la doctrine couvre naturellement sept tensions
structurelles distinctes.

**Recommandation : sept dimensions standardisées, identiques pour tous
les secteurs, chacune notée de zéro à cent avec définition fixe et
auditable.**

La première dimension est **Intensité capitalistique**. Elle mesure
combien de capital initial et récurrent un acteur du secteur doit
brûler avant d atteindre un palier de soutenabilité économique. Échelle
de zéro (asset-light, payback inférieur à douze mois, marges
contributives élevées dès le premier client) à cent (intensité
capitalistique extrême, payback supérieur à dix ans, capex récurrent
massif). Climate et industrie tirent vers cent, logiciel et IA appliquée
tirent vers vingt à quarante selon le segment.

La seconde dimension est **Pression réglementaire**. Elle agrège la
densité du corpus réglementaire en vigueur, la vélocité du changement
attendu sous vingt-quatre mois, et l agressivité historique des
régulateurs sectoriels. Échelle de zéro (régulation faible, stable,
prévisible) à cent (corpus dense, en mutation rapide, régulateurs
actifs). Santé, fintech, crypto et énergie sont en haut de l échelle,
SaaS horizontal et commerce sont en bas.

La troisième dimension est **Vélocité technologique**. Elle mesure la
demi-vie des stacks technologiques de référence du secteur, le rythme
de publication académique et open source, la probabilité d une rupture
technologique majeure sous vingt-quatre mois. Échelle de zéro (stack
stable depuis dix ans, peu de publications, pas de rupture en vue) à
cent (stack qui se réinvente tous les dix-huit mois). IA tire fort vers
cent, industrie classique tire vers vingt.

La quatrième dimension est **Concentration concurrentielle**. Elle
mesure la part de marché captée par les trois premiers acteurs du
secteur, et la capacité historique d un nouvel entrant à émerger
malgré cette concentration. Échelle de zéro (atomisé, mille acteurs
sans dominant, newcomers émergent régulièrement) à cent (oligopole de
trois acteurs, barrières à l entrée structurelles, dernière émergence
significative remonte à plus de cinq ans). Cloud infrastructure, paiement,
agroalimentaire tirent vers cent, SaaS verticaux et fintech embedded
tirent vers trente.

La cinquième dimension est **Cyclicité macroéconomique**. Elle mesure
la sensibilité du chiffre d affaires et des marges du secteur aux
cycles macro principaux (taux directeurs, croissance du PIB, inflation,
prix de l énergie). Échelle de zéro (secteur acyclique, dépenses
défensives, contrats long-terme stables) à cent (cyclicité extrême,
secteur procyclique sur taux ou matières premières). Proptech, mobilité,
foodtech tirent vers haut, santé et défense tirent vers bas.

La sixième dimension est **Exposition géopolitique**. Elle mesure la
dépendance du secteur à des chaînes d approvisionnement, des marchés
finaux, ou des intrants critiques sous contrôle de puissances étatiques
hostiles ou rivales. Échelle de zéro (chaînes diversifiées, intrants
fongibles, marchés finaux multiples) à cent (intrants critiques
concentrés sur un acteur étatique). Semi-conducteurs, batteries,
terres rares, défense, certains pans climate tirent vers cent, SaaS et
fintech B2B local tirent vers vingt.

La septième dimension est **Tension capital-talent**. Elle mesure la
rareté et le coût du talent critique au secteur, ainsi que la rétention
moyenne sur trois ans. Échelle de zéro (talent abondant, formation
massive en cours, coût stable) à cent (pénurie aiguë, surenchère
salariale, rétention faible). Top chercheurs IA, ingénieurs batterie,
chirurgiens robotique tirent vers cent, développeurs SaaS B2B
classique tirent vers quarante.

Ces sept axes ne sont pas exhaustifs des dimensions imaginables d un
secteur, mais ils ont la propriété décisive d alimenter explicitement
un ou plusieurs moteurs Prélude existants. Intensité capitalistique
nourrit Fragilité Structurelle (patterns Fixed Cost Trap et Capital
Structure Fragility) et Coherence Financière. Pression réglementaire
nourrit Regulatory Time Bomb et Macro. Vélocité technologique nourrit
Commoditization Drift, Tech Claim Coherence et Contrarian. Concentration
concurrentielle nourrit Market et Blindspot. Cyclicité macroéconomique
nourrit Macro. Exposition géopolitique nourrit Macro et Infrastructure
Hostage. Tension capital-talent nourrit Execution Friction et, en early
stage, Team Engine. Aucun axe sans destinataire, aucun moteur sectoriel
sans source documentée.

### Décision 3 : fréquence de régénération

Trois logiques cohabitent. Mensuelle, qui colle au rythme du news flow
mais produit un coût LLM élevé pour un signal majoritairement bruyant.
Trimestrielle, qui s aligne sur les publications macro de référence
(FMI World Economic Outlook, ECB Economic Bulletin, OECD Outlook)
et sur les cycles d investissement institutionnels. Annuelle, qui est
trop lente pour les secteurs à vélocité haute (IA, crypto, climate).
Événementielle, qui réagit à un signal externe (réglementation
majeure, choc géopolitique, faillite de référence) mais qui suppose
un système de détection qu il faudra construire séparément.

**Recommandation : trimestrielle de base, plus événementielle sur
déclencheur explicite.** Le rythme trimestriel cale Prélude sur les
publications de référence et permet une lecture stable comparable d un
trimestre à l autre. La couche événementielle traite les chocs majeurs
qui ne peuvent pas attendre le prochain cycle (AI Act adopté, faillite
SVB, invasion d un pays exportateur d intrants critiques) en
ré-générant ad hoc le secteur concerné. Le cycle mensuel est écarté
pour ne pas confondre signal et bruit, le cycle annuel est écarté pour
ne pas laisser les secteurs à vélocité haute dériver entre deux fiches.

### Décision 4 : sources de données mobilisées par dimension

Chaque dimension impose ses propres sources et son propre fetcher. La
fiche sectorielle est régénérée par un agent LLM orchestré qui
consomme, pour chaque dimension, un brief de sources prédéfini.

Intensité capitalistique consulte les bases World Bank et OECD sur
l intensité capitalistique sectorielle, les comptes consolidés des
acteurs cotés du secteur (via SEC Edgar et Euronext disclosures), et
les études McKinsey, BCG et Bain accessibles par web search ciblée.

Pression réglementaire consulte EUR-Lex pour le corpus européen,
Federal Register pour le corpus américain, les publications de l ACPR,
AMF, FCA, BCE, et OpenAlex pour la littérature académique récente en
économie politique sectorielle.

Vélocité technologique consulte OpenAlex et Arxiv pour les taux de
publication par domaine, GitHub pour l activité open source mesurée
en commits et stars sur les dépôts de référence sectoriels, et les
preprints des laboratoires industriels (Google DeepMind, Meta FAIR,
Anthropic, plus équivalents européens).

Concentration concurrentielle consulte les rapports sectoriels OCDE
et IMF, les agrégats Crunchbase et Dealroom sur la structure des
levées, et les analyses de banques d affaires accessibles par web
search.

Cyclicité macroéconomique consulte le FMI (World Economic Outlook
trimestriel), la Banque de France (notes de conjoncture), l ECB
Economic Bulletin, et la BCE Statistical Data Warehouse pour les
séries longues.

Exposition géopolitique consulte les publications des think tanks
Bruegel, IFRI, CFR, ECFR, RUSI, plus les indices de risque pays
Coface et Allianz Trade, plus une web search ciblée sur les
événements géopolitiques des douze derniers mois affectant le secteur.

Tension capital-talent consulte OpenAlex pour la mobilité des auteurs
académiques, les rapports LinkedIn Economic Graph (accessibles
partiellement en public), les baromètres Glassdoor et Hired sur les
salaires sectoriels, et la web search ciblée pour les fuites de talent
récentes.

**Recommandation : un fetcher dédié par source structurée (FMI, World
Bank, EUR-Lex, OpenAlex, Arxiv, GitHub API), plus une couche web
search via tool use sur Anthropic API pour les sources non structurées
ou récentes.** Chaque source citée par le LLM régénérateur est
conservée dans le payload de la fiche sous forme de référence
auditable (url, date d accès, citation textuelle si pertinente).

### Décision 5 : mécanique de régénération

Le déclenchement trimestriel peut se faire en bloc (treize secteurs
régénérés la même semaine) ou en cycle décalé (un secteur par semaine
pendant treize semaines, retour au début). L approche en bloc concentre
le coût LLM et le risque de saturation API sur une fenêtre courte mais
produit une cohérence temporelle stricte. L approche décalée amortit
le coût et la charge mais rend la comparaison inter-sectorielle moins
nette puisque deux secteurs ne sont jamais lus au même instant.

**Recommandation : cycle trimestriel décalé sur quatre semaines, trois
à quatre secteurs régénérés par semaine.** Le décalage est assumé pour
des raisons opérationnelles (coût, charge API, possibilité d intervention
manuelle sur une fiche qui sort anormale avant que la suivante ne
parte) et la comparaison inter-sectorielle reste pertinente à l échelle
trimestrielle. Chaque régénération d une fiche est une orchestration
de sept appels LLM (un par dimension) plus un appel final d agrégation
qui produit le résumé éditorial. La granularité dimension par dimension
permet de re-régénérer surgicalement une dimension qui sort anormale
sans tout refaire.

Le coût LLM estimé par fiche complète est de l ordre de un à deux
dollars (modèle Sonnet pour les appels par dimension, Opus pour
l agrégation finale qui produit la prose). Treize secteurs par trimestre
représentent vingt à trente dollars de coût récurrent par cycle, ce
qui est négligeable au regard du tarif cible.

### Décision 6 : intégration au pipeline

L injection brute de la fiche sectorielle complète dans chaque prompt
moteur saturerait le contexte (sept blocs descriptifs détaillés plus
références plus résumé éditorial représentent typiquement quatre à
six mille tokens). Trois logiques possibles d injection. L injection
intégrale, lourde et redondante. L injection sélective par dimension
(chaque moteur reçoit les axes pertinents), légère mais qui prive
chaque moteur d une lecture d ensemble. L injection hybride (résumé
éditorial commun plus dimensions sélectives), qui combine vue
d ensemble et profondeur ciblée.

**Recommandation : injection hybride.** Tous les moteurs sectoriels
(macro, blindspot, contrarian, market, fragility, narrative drift)
reçoivent en tête de prompt le résumé éditorial sectoriel court, mille
cinq cents caractères maximum, qui pose le récit dominant du secteur
au moment de l analyse. Ce résumé est commun à tous les moteurs et
sert d ancrage. Chaque moteur reçoit ensuite, en injection dimensionnée,
les axes qui le concernent doctrinalement, avec leur score, leur
définition courte et les sources qui ont nourri leur évaluation.

Le mapping précis est le suivant. Macro reçoit Cyclicité, Exposition
géopolitique, Pression réglementaire. Blindspot reçoit Concentration
concurrentielle, Vélocité technologique. Contrarian reçoit Vélocité
technologique, Concentration concurrentielle, Intensité capitalistique.
Market reçoit Concentration concurrentielle, plus une description
narrative du marché final. Fragilité Structurelle reçoit Intensité
capitalistique, Cyclicité, Tension capital-talent, plus une mention
explicite des patterns Phase 4 que ces dimensions activent prioritairement
(Fixed Cost Trap si intensité haute, Capital Structure Fragility si
intensité et cyclicité hautes simultanément). Narrative Drift reçoit
le résumé éditorial sectoriel seul, parce que ce moteur compare le
discours dossier au narratif sectoriel ambiant et n a pas besoin des
scores dimensionnels.

L overhead total ajouté par l injection sectorielle est de l ordre de
mille à deux mille tokens par moteur, ce qui reste très en deçà des
limites de contexte des modèles utilisés.

### Décision 7 : persistance et versioning

Le choix de schéma Supabase détermine la performance des requêtes
historiques et la viabilité de la comparaison temporelle (axe T versus
axe T-12 mois, l un des trois usages prioritaires de la spider chart).
Trois options. Table unique avec overwrite à chaque régénération, qui
détruit l historique et interdit la comparaison temporelle. Table
unique avec historique inline (chaque fiche conserve sa version
précédente en JSONB), qui complique les requêtes. Table dédiée
versionnée avec une ligne par génération, indexée sur (sector_slug,
generated_at).

**Recommandation : table dédiée versionnée, historique intégral
conservé sans suppression.** Le schéma est `sectoral_briefs` avec les
colonnes sector_slug, generated_at, dimensions JSONB (sept entrées
nominatives avec score, définition appliquée, sources citées, niveau de
confiance), narrative_summary TEXT, regeneration_trigger ENUM (cron,
manual, event), supersedes_id (référence à la fiche précédente),
generation_metadata JSONB (modèle, prompt version, coût). L index
composite (sector_slug, generated_at DESC) sert les requêtes courantes,
un index trigram sur narrative_summary permet la recherche textuelle.

À treize secteurs régénérés trimestriellement, l archive représente
cinquante-deux fiches par an, soit moins de trois cents fiches sur cinq
ans. Le coût de stockage est nul à l échelle Supabase, le bénéfice
doctrinal est élevé puisque la comparaison T versus T-12mois devient
trivialement disponible et que l archive elle-même devient un corpus
exploitable (voir Propositions Claude Code section 11).

### Décision 8 : UI de visualisation, trois usages prioritaires

Le spider chart est l objet visuel central du module. Trois usages
prioritaires sont identifiés à la livraison, avec un objet visuel
strict pour chacun.

**Usage A, fiche sectorielle isolée.** Un seul polygone tracé sur un
heptagone, sept axes étiquetés en serif, graduations à 25, 50, 75, 100,
palette ocre brûlé sur crème stricte. Le polygone est en ligne pleine
ocre brûlé un et demi pixel d épaisseur, rempli en aplat ocre brûlé à
douze pour cent d opacité. Les points de mesure sont des cercles pleins
de trois pixels de diamètre, ocre brûlé. En tête de la fiche, le nom du
secteur en serif gros corps, sous-titre avec la date de génération et
le déclencheur (cron, manuel, événementiel). Sous le spider chart, les
sept dimensions sont reprises en prose dense avec le score, la
définition appliquée, les sources citées.

**Usage B, superposition de deux secteurs.** Deux polygones tracés sur
le même heptagone, l un en ocre brûlé plein, l autre en ocre éteint
(version plus claire de la même teinte). Légende sobre en bas à droite
avec deux carrés de couleur et les noms de secteurs. Aucune utilisation
de couleurs primaires distinctes, parce que la comparaison doit se
faire dans le même registre chromatique et pas par opposition franche
qui suggérerait à tort une dichotomie. Sous la superposition, un
paragraphe éditorial généré par LLM signale les axes de convergence
(écart inférieur à dix points) et les axes de divergence (écart
supérieur à trente points), avec lecture doctrinale courte.

**Usage C, comparaison d un secteur à sa version d il y a douze mois.**
Le polygone actuel est tracé en ligne pleine ocre brûlé, le polygone
historique est tracé en pointillé ocre brûlé à soixante pour cent
d opacité. La date de chaque tracé est portée dans la légende. Sous le
graphique, le paragraphe éditorial est un texte court qui nomme les
dimensions qui ont bougé significativement (delta supérieur à dix
points), distingue les évolutions naturelles (rythme attendu du
secteur) des évolutions surprenantes (rythme inattendu), et en tire
une lecture doctrinale en deux phrases.

Aucun de ces trois usages n introduit d animation, de hover state
décoratif, ou de tooltip flottant. La sobriété est doctrinale, pas une
contrainte technique. L animation est réservée à l usage futur
(animation pendant l analyse) et n a pas sa place dans la lecture
posée d une fiche sectorielle.

### Décision 9 : UI admin de déclenchement manuel

Une interface admin doit permettre à un opérateur Prélude de
déclencher manuellement la régénération d une fiche, soit complète
soit dimension par dimension, en dehors du cycle trimestriel. Les
options sont une interface CLI séparée (rapide à développer mais
opaque), une page dédiée dans le dashboard Prélude (lourde mais
intégrée), une page admin minimaliste accessible uniquement aux
utilisateurs avec un rôle admin (juste milieu).

**Recommandation : page admin minimaliste à `/admin/sectoral`,
réservée au rôle admin via auth Supabase.** Liste tabulaire des
treize secteurs, date de dernière régénération, état (à jour, à
régénérer, en cours de régénération), bouton "Régénérer la fiche
complète" et bouton "Régénérer une dimension" par secteur. Au
déclenchement, le job part en background via une queue (Vercel Cron
ou Inngest selon ce qui est déjà en place dans le repo, à confirmer
en implémentation). Un log de régénération récente est affiché en
bas de page (modèle utilisé, coût estimé, durée, dimension par
dimension). Aucune fonctionnalité de modification manuelle des scores
ou des définitions, parce que toute édition humaine d une fiche
sectorielle sortirait du cadre doctrinal anti-hallucination (une fiche
est soit régénérée par LLM avec sources auditables, soit elle ne
l est pas).

### Décision 10 : transparence dans la note d instruction

Le partner doit pouvoir auditer le contexte sectoriel qui a nourri
l analyse de son dossier. Trois logiques d intégration possibles. Pas
d intégration explicite (le contexte est invisible, ce qui trahit la
discipline anti-hallucination de Prélude). Une annexe textuelle en
fin de note qui liste les dimensions et les sources. Un mini spider
chart intégré en tête de note plus une annexe complète en fin de note.

**Recommandation : mini spider chart en tête de la section méthode de
la note, annexe complète en fin de note.** Le mini spider chart est de
format réduit (cent cinquante pixels de côté), même palette et même
typographie que la version pleine, avec mention "Secteur primaire :
[nom], fiche du [date]". Il est cliquable dans la version web de la
note et ouvre la fiche complète. En annexe de fin de note, la liste
exhaustive des sept dimensions avec scores et définitions appliquées,
plus la liste des sources citées par le LLM régénérateur pour chaque
dimension, plus un lien permanent vers la version exacte de la fiche
qui a été consommée par l analyse (URL versionnée du type
`/sectoral/fintech/2026-Q2`). La présence visible du mini spider chart
en tête de note transforme la transparence sectorielle d obligation
technique en signal éditorial : le partner voit immédiatement quel
contexte sectoriel encadre la lecture du dossier.

## Le langage visuel toile d araignée

Les dix décisions ci-dessus prescrivent la première application du
langage visuel toile d araignée, mais ce langage est conçu pour servir
deux livraisons ultérieures non implémentées dans ce chantier. La
première est une carte statique des quatorze moteurs Prélude et de
leurs interconnexions, affichable sur la landing page commerciale et
en mode "à propos de la méthode" dans la note d instruction. La
seconde est une animation pendant l analyse, qui éclaire les moteurs
un à un et trace les liens entre eux pendant que le pipeline tourne,
transformant les vingt à soixante secondes d attente en démonstration
visible de la profondeur méthodologique. La fiche pose ici les
fondations communes pour que ces deux livraisons s appuient sur un
substrat partagé.

**Palette.** Crème de fond, hex `#F5EFE6` ou voisin. Ocre brûlé
principal, hex approximatif `#9C5A2A`, utilisé pour les tracés
primaires, les remplissages, et les éléments de premier plan. Ocre
éteint secondaire, version désaturée et plus claire du même teinte,
hex approximatif `#C8A988`, utilisé pour les tracés de comparaison et
les éléments de second plan. Sépia profond, hex approximatif `#6B5841`,
utilisé pour les graduations, les axes radiaux, les labels secondaires.
Encre, hex approximatif `#2B2B2B`, utilisé pour le texte principal et
les labels d axes. Aucune autre couleur n est admise dans le langage
visuel. Les états (sain, attention, alerte, drapeau rouge) ne se
codent pas par couleur mais par densité de tracé, opacité, ou
typographie, pour préserver la cohérence chromatique.

**Typographie.** Les noms de secteurs, les titres de moteurs, et les
labels d axes sont en serif de lecture. Le choix précis (Source Serif
Pro, Lyon Display, Tiempos Text, ou équivalent licencié déjà présent
dans le projet) est tranché en implémentation. Les graduations
chiffrées, les unités, et les éléments tabulaires sont en grotesque
condensée (Söhne Mono Condensed, Inter Condensed, ou équivalent). Le
choix sert la lisibilité du heptagone : serif pour les éléments
nommés que l œil lit en bloc, grotesque condensée pour les éléments
chiffrés que l œil scanne. Aucune utilisation de capitales pour les
labels d axes (l interpolation avec la prose serif de la note s en
trouverait rompue), réserver les capitales aux titres de section et
aux mentions techniques.

**Grammaire des lignes.** Lignes radiales depuis le centre vers chaque
sommet du polygone régulier : zéro virgule cinq pixel d épaisseur,
trait plein sépia, opacité zéro virgule trois. Cercles concentriques
de graduation à 25, 50, 75, 100 : zéro virgule cinq pixel d épaisseur,
trait pointillé sépia, opacité zéro virgule vingt-cinq. Tracé du
polygone de mesure : un virgule cinq pixel d épaisseur, ligne pleine
ocre brûlé, fill ocre brûlé à douze pour cent d opacité. Points de
mesure aux sommets : cercles pleins de trois pixels de diamètre, ocre
brûlé sans contour. Labels d axes : serif onze pixels, encre, ancrés
radialement à dix-huit pixels au-delà du sommet de l heptagone, avec
ajustement d alignement horizontal selon la position cardinale du
sommet (left si à droite, right si à gauche, center si haut ou bas).

**Logique de traçage.** Interpolation strictement linéaire entre les
sept sommets, pas de courbes Bézier, pas de spline. Une interpolation
courbe donnerait un faux signal de continuité entre des dimensions qui
sont par construction discrètes. Antialiasing standard SVG, pas de
filtre flou, pas d ombre portée. Le rendu doit être net comme une
gravure XIXe.

**Animation timing.** Pour les usages statiques (fiche sectorielle,
mini spider chart dans la note, comparaison), aucune animation. Pour
l usage animé futur (cartographie des quatorze moteurs Prélude pendant
l analyse), le timing prescrit est le suivant. Apparition séquentielle
des moteurs : un moteur tous les deux cents millisecondes, ordre
respectant la topologie réelle du pipeline (extraction d abord, puis
moteurs parallèles, puis orchestration finale). Tracé des liens entre
moteurs : stroke-dasharray plus animation de stroke-dashoffset, durée
quatre cents millisecondes par lien, easing cubic-bezier zéro virgule
quatre zéro zéro virgule deux un. Le total de l animation pour
quatorze moteurs et leurs liens est de l ordre de trois secondes, ce
qui occupe le partner sans devenir gimmick. Aucun bounce, aucun
overshoot, aucun easing élastique qui trahirait la voix éditoriale.

**Module `lib/visuals/spiderweb.ts`.** Tous les helpers sont isolés
dans ce module unique pour garantir la cohérence visuelle entre les
trois usages présents (fiches, comparaisons, mini chart note) et les
deux usages futurs (carte moteurs, animation analyse). Les exports
prévus sont `renderSpiderChart(data, options)` qui retourne une chaîne
SVG pour les trois usages prioritaires, `renderEngineMap(engines,
connections, options)` qui retourne une chaîne SVG pour la carte
statique des quatorze moteurs, `renderEngineAnimation(engines,
connections, options)` qui retourne du SVG plus du CSS d animation
pour l usage pendant l analyse. Plus des helpers internes pour la
géométrie polygonale (calcul des sommets d un n-gone régulier),
l interpolation linéaire, la conversion des coordonnées radiales en
cartésiennes, et l alignement des labels selon la position cardinale.
Les constantes de palette et de typographie sont exportées sous forme
nommée (`PALETTE`, `TYPOGRAPHY`) pour usage par les composants React
qui consomment le module sans dupliquer les valeurs.

Le module est en TypeScript pur, sans dépendance externe au-delà de
ce que le projet utilise déjà, et il rend du SVG inline pour que la
totalité de l output soit lisible, auditable, et embarquable dans la
note d instruction PDF (la note se rend déjà via un pipeline de
génération qui consomme du SVG inline).

## Cas limites doctrinaux

**Dossier multi-sectoriel.** Le pipeline rencontrera régulièrement des
dossiers qui ne se rangent pas dans un secteur unique (un acteur qui
fait à la fois fintech et proptech, une plateforme qui croise SaaS
horizontal et IA appliquée, un projet climate qui touche aussi
industrie). Recommandation : l extraction-engine identifie un secteur
primaire (le plus représentatif de l essentiel du modèle économique)
et jusqu à deux secteurs secondaires. Les moteurs reçoivent la fiche
primaire intégrale (résumé éditorial plus dimensions sélectives), plus
un encart de quelques cents caractères pour chaque secteur secondaire
qui résume sa fiche. La spider chart affichée dans la note d
instruction est celle du secteur primaire, avec mention typographique
des secteurs secondaires en sous-titre. Cette dégradation contrôlée
préserve la lisibilité visuelle (un seul polygone par mini chart) sans
perdre l information transversale.

**Secteur émergent non couvert.** Certains dossiers opéreront dans des
secteurs qui ne figurent pas dans la grille des treize (quantum
computing commercial, fusion nucléaire, neurotechnologie commerciale,
robotique humanoïde générale). Recommandation : l extraction-engine
signale "secteur non couvert par la matrice sectorielle Prélude". Le
pipeline tourne sans injection sectorielle, et la section méthode de
la note s ouvre par une phrase explicite : "ce dossier opère dans un
secteur émergent qui ne fait pas encore l objet d une fiche
sectorielle Prélude active, la lecture s appuie donc sur le seul
contenu du dossier et sur la doctrine générale du moteur". Cette
honnêteté méthodologique est plus précieuse que l illusion d une
couverture exhaustive. Si la demande devient récurrente sur un secteur
émergent (trois dossiers ou plus en six mois), l admin Prélude
déclenche la création d une nouvelle fiche sectorielle, ce qui élargit
la grille à quatorze.

**Fiche sectorielle obsolète.** Une fiche dont la date de génération
dépasse neuf mois (trimestriel plus un trimestre de buffer) est
marquée comme "à régénérer" dans l interface admin, et un warning
sobre apparaît dans la note d instruction ("la fiche sectorielle
consommée date du [date], une régénération est en cours ou
recommandée"). Une fiche dont la date dépasse douze mois sans
régénération n est plus injectée dans les prompts moteurs : retour au
fonctionnement sans contexte sectoriel, avec mention explicite dans la
section méthode de la note. Cette dégradation est préférable à
l injection d une fiche périmée qui contaminerait silencieusement
l analyse.

**Donnée manquante sur une dimension.** Le LLM régénérateur peut
légitimement échouer à trouver des sources fiables sur une dimension
pour un secteur donné (typiquement : exposition géopolitique sur un
secteur trop neuf, tension capital-talent sur un sous-secteur où les
baromètres salariaux n existent pas encore). Recommandation : la
dimension est marquée `confidence: low` ou `data_missing`, et le score
est soit absent soit accompagné d un intervalle de confiance large. Sur
la spider chart, la branche concernée est rendue en pointillé clair
plutôt qu en trait plein, sans valeur affichée, avec une note marginale
discrète "donnée insuffisante". Les moteurs qui dépendent de cette
dimension reçoivent un flag `dimension_missing: [nom]` dans le prompt
et le mentionnent dans leur analyse au lieu de fabriquer un score. La
visualisation honnête d une absence vaut mieux qu un chiffre inventé.

## Propositions Claude Code

Section ouverte à discussion, pas de décisions arrêtées. Trois à cinq
angles auxquels l humain n a pas explicitement pensé et qui rendraient
le Sectoral Intelligence Layer plus puissant ou plus différenciant.
L humain valide, rejette ou ajuste avant toute implémentation. Chaque
proposition porte un rationale doctrinal en deux phrases et un coût
d implémentation en heures Claude Code. La hiérarchie en valeur ajoutée
attendue va de haute à exploratoire.

**Proposition 1 (haute valeur). Moteur de lecture inter-sectorielle.**
Au-delà des fiches isolées, mécanique trimestrielle qui compare les
treize secteurs entre eux et identifie les patterns systémiques : deux
secteurs qui dérivent simultanément sur la même dimension (climate et
mobilité convergent sur "tension capital-talent" suite à pénurie
d ingénieurs batterie), deux secteurs dont la divergence inattendue
révèle un déplacement de capital (logiciel horizontal et IA appliquée
divergent brutalement sur "vélocité technologique"), une dimension qui
bouge dans plus de la moitié des secteurs (signal macro structurel
plutôt que sectoriel). Rationale doctrinal : les fragilités les plus
diagnostiques sont souvent inter-sectorielles, la crise SVB de 2023 a
frappé tech et biotech ensemble parce qu elles partageaient le même
profil de dépôt, et un Prélude qui lit le système et pas seulement les
secteurs isolés capture ces co-mouvements que les outils existants
manquent. Coût estimé : douze heures pour la mécanique d agrégation et
le prompt LLM cross-sector, plus quatre heures de pass LLM par cycle
trimestriel, plus six heures pour l UI dédiée (une vue "État des
secteurs" dans le dashboard partner).

**Proposition 2 (haute valeur). Huitième dimension : Vulnérabilité
narrative sectorielle.** Une dimension supplémentaire qui mesure la
dépendance du secteur à un narratif dominant susceptible de s effondrer
(foodtech 2021 sur "future of meat", crypto 2021 sur "infrastructure
financière du futur", IA 2024 sur "transformation économique massive",
proptech 2018 sur "WeWork-comme-techno"). Échelle de zéro (narratif
secteur diversifié, plusieurs récits coexistent, robustesse à
l effondrement d un récit) à cent (un seul récit dominant porte
l intégralité du capital et de l attention médiatique, effondrement de
ce récit produirait un re-pricing massif). Rationale doctrinal :
Prélude lit déjà la narrative drift au niveau dossier, la mesurer au
niveau sectoriel permet de détecter quand un dossier surfe sur un
narratif sectoriel surévalué dont l effondrement le frappera
indépendamment de ses propres mérites. Coût estimé : six heures pour
l ajout de la huitième dimension (définition, intégration au prompt
régénérateur, propagation au moteur Narrative Drift) plus l implication
que le spider chart passe à huit axes (octogone), ce qui reste lisible
mais oblige à reconsidérer la disposition des labels.

**Proposition 3 (haute valeur). Cross-pollination amont entre
dimensions sectorielles et matrice de pertinence des patterns Phase 4.**
Liaison explicite et calibrée entre les scores des dimensions
sectorielles et la probabilité a priori d activation des patterns
Phase 4. Une "Intensité capitalistique" haute biaise positivement la
pertinence du pattern Fixed Cost Trap. Une "Pression réglementaire"
haute biaise positivement Regulatory Time Bomb. Une "Concentration
concurrentielle" basse plus "Vélocité technologique" haute biaisent
positivement Commoditization Drift. Rationale doctrinal : la matrice
de pertinence actuelle est binaire (un pattern est applicable ou
n est pas applicable selon le stade et l archetype), une matrice
graduée par contexte sectoriel rendrait la lecture plus fine et
permettrait de détecter des fragilités latentes plus tôt (un dossier
fintech early stage est statistiquement plus exposé à Regulatory
Time Bomb même si le pattern n est pas formellement déclenché par les
seuils binaires actuels). Coût estimé : huit heures pour le refactor
de `lib/engines/relevance-matrix.ts` qui intègre les scores sectoriels
en input, plus quatre heures de tests sur la suite déterministe pour
préserver la calibration existante, plus deux heures de documentation
des nouveaux seuils dans la doctrine.

**Proposition 4 (valeur moyenne). L archive sectorielle comme corpus
public.** Au bout de trois à cinq ans de fiches trimestrielles
archivées, Prélude détient un corpus unique sur l évolution sectorielle
européenne, structuré, daté, sourcé, et lisible. Cette archive peut
devenir un produit dérivé public : rapport trimestriel "État des
secteurs Prélude" publié en open access, sans aucun verdict de dossier
client (confidentialité absolue), juste les évolutions agrégées des
treize secteurs et les patterns inter-sectoriels notables (cf
proposition 1). Rationale doctrinal : ce positionnement éditorial
renforce la singularité Prélude face aux outils transactionnels
(Affinity, Carta) qui ne produisent pas d intelligence sectorielle
publique, et alimente un canal d acquisition partner crédible (un fonds
qui lit le rapport trimestriel Prélude prend connaissance de la qualité
analytique avant même de prendre un rendez-vous commercial). Coût
estimé : seize heures pour le layout de publication trimestrielle (un
gabarit éditorial unique réutilisé trimestre après trimestre), plus
huit heures pour le pipeline de génération éditoriale (orchestrateur
LLM qui consomme les fiches du trimestre et produit la prose
synthétique), plus un coût LLM marginal par cycle.

**Proposition 5 (valeur exploratoire). Quatrième usage du langage
visuel : spider chart du dossier sur les patterns Phase 4.** Réutiliser
le module `lib/visuals/spiderweb.ts` pour produire un quatrième usage
non listé dans la décision 8 : un spider chart par dossier qui
visualise les sept patterns du moteur Fragilité Structurelle avec
leurs scores. Le partner voit en un coup d œil sur quels axes le
dossier respire et sur quels axes il s étrangle. Rationale doctrinal :
cohérence visuelle entre niveau sectoriel et niveau dossier dans un
même langage graphique unifié, le partner navigue dans un univers
visuel cohérent qui renforce la lisibilité de la doctrine Prélude et
en fait un produit visuellement reconnaissable. Coût estimé : six
heures pour le composant React qui consomme les scores Fragilité
Structurelle déjà calculés par le pipeline, plus l intégration dans la
note d instruction (deux heures) et dans le dashboard (deux heures).
Hiérarchisé exploratoire et non haute valeur parce que le bénéfice
diagnostique de cette visualisation est marginal par rapport aux
verdicts textuels déjà produits par le moteur, mais la cohérence
visuelle qu il apporte au produit global est significative.

Ces cinq propositions s ajoutent aux dix décisions sectorielles et au
langage visuel sans en remplacer aucune. Elles peuvent être adoptées
intégralement, partiellement, ou pas du tout. La propositions 1 et 2
sont les plus directement complémentaires de la doctrine Prélude (lire
ce qui est systémique et ce qui est narratif au-delà du visible). La
proposition 3 est un refactor structurel qui touche la matrice de
pertinence et mérite à elle seule une fiche de cadrage dédiée si elle
est retenue. Les propositions 4 et 5 relèvent d enrichissements de
surface plutôt que de structure.

## Périmètre d implémentation prévu, session suivante

Une fois cette fiche validée, la deuxième session attaque dans cet
ordre. Migration Supabase, création de `sectoral_briefs` avec ses
index et ses contraintes. Module `lib/visuals/spiderweb.ts`, helpers
géométriques et constantes de palette et typographie, puis
`renderSpiderChart` pour les trois usages prioritaires. Module
`lib/engines/sectoral-intelligence/` avec le régénérateur LLM,
l orchestrateur dimension par dimension, et les fetchers par source
(IMF, World Bank, EUR-Lex, OpenAlex, Arxiv, GitHub, web search).
Initialisation des treize fiches sectorielles par un premier passage
LLM complet (coût estimé vingt à trente dollars, durée deux à trois
heures sur un cycle décalé manuel). Couche d injection au pipeline,
modification des prompts de Macro, Blindspot, Contrarian, Market,
Fragility, Narrative Drift pour consommer la fiche sectorielle.
Composants React de visualisation pour les trois usages (fiche isolée,
superposition, comparaison temporelle), intégrés au dashboard et à la
note d instruction. Page admin `/admin/sectoral` pour le déclenchement
manuel. Cron trimestriel décalé via le job runner déjà en place
(Vercel Cron ou Inngest, à confirmer en début d implémentation).
Tests déterministes sur les helpers de spider chart (géométrie,
interpolation, alignement labels), tests d intégration sur l injection
au pipeline (un dossier mocké voit bien sa fiche sectorielle injectée
dans les prompts), audit E2E sur trois dossiers de référence couvrant
trois secteurs distincts. Le travail est estimé à deux à trois
semaines de session Claude Code, plusieurs commits tagués
`feat(sectoral-intelligence)`, calibration finale par une lecture
partner de trois fiches sectorielles avant ouverture commerciale.

Les propositions Claude Code de la section 11 sont volontairement
laissées hors de ce périmètre tant que l humain ne les a pas validées.

## Ce que la fiche laisse explicitement ouvert

Le choix précis du job runner pour le cron trimestriel (Vercel Cron,
Inngest, ou autre déjà présent dans le repo) est laissé à
l implémentation après inspection rapide de l état actuel du projet.
Le choix de la police serif et de la grotesque condensée est laissé
à l implémentation, sous contrainte que la licence soit déjà acquise
par le projet ou facilement acquérable. La question de la couverture
géographique des fiches sectorielles (Europe centrée, ou inclusion
explicite des dynamiques nord-américaines et asiatiques en complément)
est tranchée par défaut en faveur d une lecture européenne avec
mention des dynamiques externes seulement quand elles affectent
directement le marché européen ; cette décision peut être revue si
les premiers fonds clients ont des thèses cross-Atlantiques fortes.
Aucune autre question structurelle n est laissée en suspens.
