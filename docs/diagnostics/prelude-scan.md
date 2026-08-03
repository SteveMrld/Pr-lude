# Scan des six motifs restants

Note ecrite au fil de l eau, le 3 aout 2026. Chaque section est
consignee des qu elle est verifiee, avant de passer a la suivante. Le
scan precedent a ete perdu avec le contexte de la session : c est la
deuxieme fois, d ou cette forme.

## Regle de restitution

Aucune occurrence n est citee sans avoir ete ouverte et lue. Chaque
section indique le nombre de candidats produits par le scan et le
nombre effectivement verifie. Un candidat elimine a la lecture est dit
et sa raison d elimination avec, parce que c est la seule facon de
savoir si le scan est trop large ou trop etroit.

Les motifs qui se decident structurellement se scannent. Ceux qui
demandent de comprendre un site d appel se lisent, et le scan n y sert
qu a produire la liste de lecture.

## Etat d avancement

- [x] 1. Le champ optionnel jamais renseigne
- [x] 2. La valeur posee par un repli la ou un choix etait requis
- [x] 3. La regle ecrite dans un commentaire, appliquee a une ligne
- [x] 4. Deux catalogues du meme produit qui ne se confrontent jamais
- [x] 5. Le correctif branche en aval du point de perte
- [x] 6. Le dispositif rendu inatteignable par une couche transverse
- [x] Question laterale : ce qu il faudrait pour exercer Trajectoire

Base : HEAD `a139335`, arbre propre.

## 1. Le champ optionnel jamais renseigne

Verifie 18 candidats sur 79, plus une classe entiere eliminee en bloc.

Le scan est fait par l arbre syntaxique et non par le texte, faute de
quoi il aurait mesure des mentions et non des ecritures. Il collecte
d un cote les proprietes optionnelles declarees, de l autre tous les
sites d ecriture possibles d une propriete de ce nom : affectation
dans un litteral d objet, forme abregee, affectation de membre,
declaration de classe. Sur 520 fichiers, 956 declarations optionnelles
pour 603 noms distincts. Quatre-vingt-dix-neuf noms sortent : 79 que
rien n ecrit nulle part, 9 que seuls des tests ecrivent.

Le rapprochement se fait par nom, ce qui est grossier mais fautif dans
le bon sens : si un nom n apparait dans aucun site d ecriture du depot,
il n est ecrit pour aucun type. Le scan ne peut donc pas manquer une
occurrence, il peut seulement en inventer, d ou la verification.

### Une classe entiere de faux positifs, et pourquoi elle etait prevue

Dix des 79 noms sont des champs de sortie de moteur declares dans
`lib/engines/types.ts` : `aiVelocity`, `declaredVsVerified`,
`evaluability`, `assetClassMatch`, `cautionLevel`,
`pitchAlignmentNote`, `assessorDisagreementRationale`,
`structuringPlan`, `weakSignalsChecks`, `horizon`. Aucun n est ecrit en
TypeScript nulle part, et tous sont pourtant remplis a chaque run.

La raison est que le scan mesurait le mauvais support, ce qui est la
faute que la discipline de mesure nomme au troisieme corollaire. Ces
champs ne sont pas ecrits par du code, ils sont parses depuis le JSON
que rend le modele, et leur veritable site d ecriture est le squelette
JSON du SYSTEM_PROMPT de leur moteur. Verification faite sur les dix :
`cautionLevel` occupe six lignes du prompt de `pattern-engine.ts`, dont
une regle d or qui impose de le remplir pour chaque comparable ;
`weakSignalsChecks` demande trois a six entrees dans
`reference-checks-engine.ts` ; `structuringPlan` est conditionne au
verdict dans `orchestrator.ts`. Les dix sont demandes.

Ce n est pas un defaut du scan, c est la limite qu il fallait connaitre
avant de le lancer : pour tout champ traversant la frontiere du modele,
un scan de code TypeScript ne dit rien, et seule la lecture du prompt
tranche. Je le consigne parce que le prochain scanner refera l erreur
sinon, et parce qu un rapport qui aurait cite ces dix noms aurait rendu
dix faux positifs sur ses premieres lignes.

Meme sort pour les options de seuil de `milestone-detection-selector.ts`
et `sectoral-regeneration-selector.ts`, dont le commentaire de
signature declare l intention : « override des seuils pour les tests,
en prod les valeurs par defaut s appliquent ». Une couture de test
declaree comme telle n est pas un champ oublie.

Restent une quarantaine de props React optionnelles jamais passees, que
je n ai pas ouvertes une a une : `printMode`, `compactMode`,
`onNodeClick`, `ariaLabel` et leurs voisines. Ce sont des surfaces
d interface inertes, sans portee doctrinale, et je le dis comme une
appreciation de classe et non comme une verification.

### Le vrai cas : le moteur Fixed Cost Trap ne recoit aucune donnee financiere

Le candidat `offBalanceRatio`, declare ligne 313 de
`lib/engines/fragility-structurelle/fixed-cost-trap-pattern.ts`, m a
conduit a l interface qui le porte. En la lisant, ce n est pas un champ
qui manque, ce sont les neuf.

`FinancialBurnSnapshot` declare neuf champs. Son unique constructeur,
`extractBurnSnapshot`, en renseigne huit, chacun par un couple de
replis sur `financialData` : `f?.monthlyBurn ?? f?.burnRate`,
`f?.runwayMonths ?? f?.runway`, `f?.totalCommitments ??
f?.offBalanceCommitments`, et ainsi de suite. Or l objet est traverse
par un cast `const f: any = financialData`, et `FinancialDataExtraction`
ne porte aucune de ces treize clefs. Ni `monthlyBurn`, ni `burnRate`,
ni `runwayMonths`, ni `capex`, ni `payroll`, ni `rentAnnual`, ni
`contractualMinimums`. Le moteur d extraction financiere les produit
sous une autre forme : `runwayMonths` et `monthlyBurn` n existent
qu imbriques dans `currentRound`, et comme chaines de caracteres, du
genre « 200K€/mois ».

Le cast `any` est ce qui rend l ensemble silencieux au typage. Sans
lui, `tsc` aurait refuse les treize lectures.

Verification faite en exercant la fonction sur un objet conforme au
squelette JSON que le moteur d extraction demande au modele, et non sur
une fixture batie a l appui de l hypothese, ce qui aurait mesure ma
lecture des donnees au lieu des donnees. Le snapshot rendu est `{}`,
zero champ sur neuf, et le bloc correspondant du prompt vaut :

    # DONNÉES BURN ET ENGAGEMENTS DISPONIBLES

    (aucune donnée structurelle de burn ni d engagement long terme
    disponible, analyse sur la base des éléments qualitatifs du pitch
    et du résumé)

Ce bloc est le seul que le pattern recoive, sur tous les dossiers,
depuis toujours, y compris ceux qui arrivent avec un business plan
complet. Fixed Cost Trap mesure la rigidite contractuelle face a un
choc de demande, son cas canonique est WeWork, et il l a toujours
jugee sur le pitch.

Le repli est ce qui a rendu la panne invisible, et de la plus mauvaise
maniere. La phrase de repli est vraie : il n y a effectivement aucune
donnee dans le snapshot. Elle est simplement vraie pour la mauvaise
raison, et un lecteur du prompt genere conclut a un dossier pauvre en
donnees financieres la ou il faut conclure a un lecteur qui regarde au
mauvais endroit. C est le pendant, cote production, de la discipline
des jeux d essai : une absence indistinguable d une absence legitime ne
se detecte par aucune relecture de sortie.

La correction est de lire `financialData` la ou il est reellement
ecrit, ce qui suppose de parser les chaines de `currentRound` en
nombres, avec la reserve d usage sur les unites. Elle suppose surtout
de retirer le cast `any` en premier, avant d ecrire la moindre ligne de
lecture : c est lui la cause, les treize clefs fantomes n en sont que
la consequence, et toute correction ecrite en le laissant en place
pourra se tromper a nouveau sans que rien ne le dise. Les champs que
l extraction ne produit pas du tout, dont `offBalanceRatio`,
`contractualMinimums` et `capexCumulated`, sont un second sujet :
soit le moteur d extraction financiere apprend a les chercher, soit
ils sortent de l interface. Ils ne peuvent pas y rester declares sans
producteur.

### Cas mineur retenu

`fragiliteVerdicts`, filtre optionnel de `listPortfolioLatestSnapshots`
dans `lib/trajectory-store.ts:265`, est cable jusqu a la requete SQL
(`query.in('fragilite_verdict', ...)`) et aucun appelant ne le passe.
Sans consequence tant que la vue portefeuille ne filtre pas, et cette
question rejoint celle du moteur Trajectoire traitee plus bas.

## 2. La valeur posee par un repli la ou un choix etait requis

Verifie 9 sites sur 187 candidats, un defaut retenu et un signale.

Le scan cherche par arbre syntaxique les expressions `a ?? L` et
`a || L` ou `L` est un litteral. Il en trouve 1291 dans `lib/`, dont
1104 tombent sur une valeur neutralisante (zero, chaine vide, tableau
ou objet vide) qui declare l absence au lieu de la combler. Restent 187
replis qui posent une valeur : un nombre non nul, ou une chaine en
forme de valeur d enum. C est dans ceux-la que le motif vit, et la
lecture seule tranche, parce qu un repli legitime et un repli fautif
ont exactement la meme forme.

Le tri suivant est fait sur la destination : un repli qui alimente une
chaine de prompt (« non precise », « aucun ») remplit un trou de
lecture et n engage rien. Un repli qui alimente un score, un verdict ou
une comparaison engage une conclusion. Neuf sites de la seconde
categorie ont ete ouverts.

### Le snapshot de Trajectoire fabrique des patterns sains

`lib/engines/trajectory/snapshot-extractor.ts` extrait d une analyse le
point qui servira de terme de comparaison a la Trajectoire. Trois de
ses replis posent une valeur la ou l absence etait la reponse.

Le plus grave est ligne 189. Dans la branche ou le pattern est
applicable, l entree est construite ainsi :

    score: p.globalScore ?? 0,
    verdict: p.verdict ?? 'sain',

`PatternAnalysisOutput.globalScore` est declare `number | null` a
`fragility-structurelle/types.ts:225`. Le null n est donc pas une
impossibilite defensive, c est un etat prevu : le pattern etait
applicable et n a pas produit de score. Le repli le convertit en zero,
et son verdict absent en « sain ».

Un pattern de fragilite applicable qui n a pas abouti est donc
enregistre comme un pattern sain a zero. C est la direction la plus
couteuse possible pour un moteur dont l objet est de detecter ce qui
casse : la panne se lit comme un bulletin de sante.

La consequence se propage au comparateur.
`trajectory/comparator.ts:190` calcule un delta de score des que les
deux snapshots portent le pattern comme applicable, et le zero fantome
en est un. Un pattern tombe au run de mars puis abouti a 70 en aout
produit une degradation de 70 points, et une transition de verdict de
« sain » vers « alerte », alors que rien n a bouge dans le dossier. La
Trajectoire raconte au partner une deterioration qui n est que le
retour en ligne d un detecteur.

Ce qui rend le cas net, c est que la correction est deja ecrite dans le
meme fichier, quarante lignes plus haut, pour les dimensions du score
mecanique. Le commentaire des lignes 140 a 147 raconte precisement ce
bug : « le repli sur globalScore qui existait ici fabriquait des
points : un moteur tombe donnait un fantome a 50 que le run suivant, ou
le moteur avait abouti a 63, transformait en une amelioration de 13
points ». La lecon a ete tiree, ecrite, et appliquee au bloc qui l avait
fait naitre. Le bloc des patterns, deux ecrans plus bas, porte le meme
defaut sous une autre forme.

Meme fichier ligne 135, le verdict global :

    analysis.mechanicalScore?.verdict ?? analysis.finalRecommendation?.verdict
      ?? analysis.verdict ?? 'approfondir'

La cascade des trois premiers termes est juste, elle cherche la valeur
la ou elle peut etre. Le quatrieme la fabrique. Une analyse sans
verdict devient une analyse qui recommande d approfondir, et la
comparaison de verdicts entre deux snapshots part d un terme qui n a
jamais ete rendu.

L orchestrateur de Fragilite, sur le meme champ, fait l inverse et le
fait bien : `orchestrator.ts:237` ecrit `if (p.globalScore === null)
continue;` et sort le pattern de la moyenne ponderee au lieu de le
compter a zero. Deux consommateurs du meme champ nullable, deux
lectures opposees, et c est celle qui alimente la Trajectoire qui se
trompe.

La correction est de rendre `null` sur les trois sites et de laisser le
comparateur faire ce qu il sait deja faire avec un null, puisqu il ne
calcule pas de delta contre une absence. Elle demande de verifier que
le type de snapshot autorise le null sur `score` et `verdict`, ce que
le champ voisin `fragiliteVerdict` fait deja.

### Signale sans etre compte : la presence de donnees financieres presumee

`financial-coherence-engine.ts:332` pose `hasFinancialData:
llmAnalysis.hasFinancialData ?? true`. Une omission du modele est donc
lue comme une affirmation que le dossier porte des donnees financieres.

Le score ne s en trouve pas immediatement fausse, parce que la garde de
`score-calculator.ts:712` est conjonctive : elle exige aussi que
`dataSource` ne vaille pas `'none'` et que le score de coherence
depasse zero. Mais la ligne suivante du meme moteur,
`dataSource: llmAnalysis.dataSource ?? (financialData.hasBP ? 'bp' :
'deck')`, ne peut jamais rendre `'none'`. Des trois conditions, deux
sont donc alimentees par des replis qui affirment la presence, et il
n en reste qu une qui mesure. Je le signale plutot que de le compter :
la garde tient aujourd hui par son troisieme terme, et elle tient
seule.

### Declare et borne, donc pas un defaut

`market-engine.ts:603` normalise `perceivedSize`, `realIntensity` et
`saturation` sur des valeurs par defaut quand le modele les omet. Le
commentaire declare le procede, nomme le dossier qui l a motive (Hello
Planet), et annonce un warning au monitoring. Les trois valeurs
choisies sont les termes medians de leurs echelles respectives. On peut
discuter le principe, qui efface un « non tranche » que la discipline
de precision demanderait plutot de conserver, mais c est un arbitrage
ecrit et instrumente, pas un repli qui se cache.

## 3. La regle ecrite dans un commentaire, appliquee a une seule ligne

Verifie 8 candidats sur 26, une occurrence retenue.

Ce motif ne se scanne pas : une regle enoncee en prose ne se distingue
d un commentaire descriptif que par la lecture. Le scan sert seulement
a fabriquer la liste, par les tournures normatives (« ne doit jamais »,
« doit toujours », « tout consommateur », « systematiquement »), qui
rendent 26 emplacements. J en ai ouvert huit, choisis sur la portee
apparente de la regle.

### La combinaison qui affirme au partner ce que rien n a verifie

`COMBINAISONS_CONFIG`, dans
`lib/engines/fragility-structurelle/orchestrator.ts:75`, porte sept
combinaisons diagnostiques. La septieme, « Exposition reglementaire
convergente », enonce sa propre condition de declenchement dans son
champ `rationale` :

> Pattern declenche en propre quand le moteur Friction d Execution
> Bloc 1 detecte simultanement une friction regulation actuelle.

Cette condition n est evaluee nulle part. `detectCombinaisons` recoit
un seul argument, `patterns`, et sa boucle ne teste que le score de
chaque pattern liste contre `seuilMin`. La combinaison ne liste qu un
pattern, `regulatory-time-bomb`, donc elle se declenche des que ce seul
pattern atteint 60, sans aucun egard pour Friction d Execution.

L orchestrateur ne pourrait d ailleurs pas l evaluer :
`analyzeFragiliteStructurelle` prend `input`, `relevanceMatrix` et
`analysisId`, et la sortie de Friction d Execution ne figure dans
aucun des trois. La regle n est pas mal appliquee, elle est inapplicable
en l etat, et personne ne l a remarque parce qu elle est ecrite dans
une chaine de caracteres que le compilateur ne lit pas.

Ce qui fait passer le cas d une negligence a une faute editoriale est
la destination de cette chaine. `comb.rationale` est rendu tel quel
dans la note, sous l intitule « Convergences detectees », a
`app/components/InvestmentNoteView.tsx:3339`. Le partner lit donc, en
severite alerte, qu une friction reglementaire actuelle a ete detectee
simultanement par un autre moteur. Rien ne l a ete. C est une
affirmation de fait produite par une absence de verification, ce qui
est plus grave qu un score mal calibre : un score se discute, une
affirmation fausse dans une note d instruction se paie au comite.

Deux corrections possibles et elles ne se valent pas. Passer la sortie
de Friction d Execution a l orchestrateur de Fragilite et evaluer la
condition, ce qui est ce que la doctrine dit. Ou retirer cette entree
de `COMBINAISONS_CONFIG`, puisqu une combinaison d un seul terme n est
pas une convergence et que le pattern remonte deja son propre verdict
dans la section qui lui revient. La seconde est la plus honnete tant
que la premiere n est pas faite, parce qu elle supprime l affirmation
plutot que de la laisser sans fondement.

Le remede de fond est le meme que pour les autres cas de ce motif :
une regle de declenchement qui vit dans un champ de prose n est portee
par rien. Si `CombinaisonDiagnostique` portait un predicat au lieu
d une liste de patterns, la condition serait du code, le compilateur
exigerait ses entrees, et l ecart entre ce que la combinaison affirme
et ce qu elle verifie ne pourrait pas s ouvrir.

### Deux regles verifiees et correctement portees

L arbitrage de classe d actif contre la chaine de production, dont
`lib/engines/relevance-matrix.ts:1685` enonce qu « elle ne doit jamais
contredire » l autre, est effectivement porte partout. Les cinq sites
qui derivent une classe ont ete lus : `valuation-engine.ts:441` et
`indicators-engine.ts:1331` preferent la classe arbitree de la matrice
et ne retombent sur `normalizeAssetClass` que si la matrice est absente,
ce qui est la double branche que la non-retroactivite demande ;
`route.ts:927` alimente la matrice en indice brut, l arbitrage se
faisant a l interieur. Le cas Platypus Craft cite en commentaire ne
peut plus se reproduire par ces chemins.

La regle « tout consommateur ecrit apres cette date lit les
composantes », posee sur `operationComponents` a
`lib/engines/types.ts:108`, est tenue par les trois consommateurs
serveurs, qui portent chacun les deux branches :
`valuation-engine.ts:556` et `1201`, `operation-validity.ts:212`,
`note/operation-vocabulary.ts:31`.

### Le cas qui ne compte pas, et pourquoi

Le rejeu client de la valorisation,
`app/components/InvestmentNoteView.tsx:561`, ne passe ni matrice de
pertinence, ni composantes d operation, ni verdict de validite, et
applique donc les regles d aujourd hui a des donnees d hier. C est
exactement le motif, et je ne le compte pas : le commentaire qui le
precede le dit deja mot pour mot, y compris qu on choisit de ne pas le
corriger et pourquoi. « On ne le corrige pas en lui passant les bonnes
entrees : cela le rendrait plus credible sans le rendre plus vrai. On
le nomme. »

C est la difference que ce motif demande de tenir. Une regle qu un
commentaire enonce sans que rien ne la porte est un defaut. Une limite
qu un commentaire nomme, avec sa raison et son arbitrage, est une
decision. La premiere se corrige, la seconde se relit le jour ou son
cout change.

## 4. Deux catalogues du meme produit qui ne se confrontent jamais

Cinq paires confrontees, une divergente. Cinq candidats bruts sur la
paire divergente, trois retenus apres verification.

Chaque confrontation est faite en important les deux catalogues et en
parcourant leurs entrees, ou en les extrayant de l arbre syntaxique
quand ils ne sont pas exportes. Aucune n est faite par comptage de
litteraux.

### Les quatre paires qui tiennent

Les ids emis par le flux SSE, `SSE_EMITTED_ENGINE_IDS` dans
`lib/pipeline-toile/mapping.ts`, contre les appels reels a `sendStart`
et `sendDone` dans `app/api/analyze/route.ts` : dix-sept contre
dix-sept, exactement les memes.

Le fait merite d etre dit precisement parce qu il est bon, et la
maniere dont il l est ne tient a rien. Le catalogue declare sa propre
source de verite en commentaire : « Source de verite : grep dans
`app/api/analyze/route.ts`. A maintenir si un nouveau `sendStart` est
introduit. » Le test de coherence annonce juste en dessous confronte
bien quelque chose, mais c est la topologie de la toile, derivee
dynamiquement, et non la route. La seule chose qui garde le catalogue
aligne sur ce que la route emet est la memoire de celui qui ajoutera
le dix-huitieme moteur. C est un cas de la discipline des regles
ecrites : la regle est juste, elle est ecrite au bon endroit, et rien
ne la porte. La confrontation manquante tient en vingt lignes, sur le
modele du test qui compare deja le matcher du middleware aux six
chemins de `vercel.json`.

Les identifiants de patterns dans `COMBINAISONS_CONFIG`
(`lib/engines/fragility-structurelle/orchestrator.ts:75`) sont typees
`PatternId[]`, donc confrontees au registre par le compilateur. Rien a
faire.

Les trois catalogues sectoriels sont alignes : treize fiches dans
`sectoral-intelligence/types.ts`, treize slugs couverts par les
mots-cle de `SLUG_MATCHERS`, douze slugs atteignables par arbitrage de
classe d actif. Aucun orphelin dans aucun sens. Le seul ecart est
`crypto-blockchain`, qu aucune classe d actif n impose et que les
mots-cle atteignent, ce qui est coherent.

Les sept fiches doctrinales de `docs/patterns/` correspondent une a une
aux sept modules implementes. La confrontation qui compterait vraiment,
celle du contenu de la fiche avec le SYSTEM_PROMPT dont CLAUDE.md dit
qu elle est la source de verite, est une comparaison de prose a prose
et ne se mecanise pas. Elle appartient a la calibration, pas a un
scanner.

### La paire divergente : le registre des appels au modele

`LLM_ENGINES`, dans `lib/instrumentation/version-stamp.ts:307`, declare
vingt-neuf moteurs avec leur chemin, leur modele et leur temperature.
Son objet est de produire `enginesHash`, l empreinte qui segmente les
runs pour la calibration : deux runs qui ne partagent pas leurs prompts
ne doivent pas se comparer. Confronte a la realite, c est-a-dire aux
fichiers qui appellent effectivement `callClaude`,
`callClaudeWithUsage`, `callClaudeWithPDF` ou `getClient`, il en manque
trois.

Deux des cinq candidats bruts sont des faux positifs de mon propre
scan, et je les donne parce qu ils disent ou le scan est fragile.
`.tmp-run/p1.ts` est un fichier de travail ignore par git, que je
n excluais pas. `lib/analysis-store.ts` porte une fonction locale
`getClient` qui rend un client Supabase : une collision de nom, pas un
appel au modele. Un scan par nom d appel ne distingue pas les deux, et
c est exactement le genre d entree qui gonfle une liste non verifiee.

Les trois qui restent :

`lib/engines/sectoral-intelligence/regenerator.ts` et
`inter-sector-aggregator.ts` produisent les fiches sectorielles. Ces
fiches ne sont pas un produit annexe : `buildSectoralPromptBlock` les
injecte en tete du prompt utilisateur de la plupart des moteurs, y
compris des sept patterns de Fragilite. Une modification du prompt du
regenerateur change donc ce que voient les moteurs, et ne change pas
`enginesHash`. Les deux runs se rangent dans le meme segment de
calibration alors qu ils n ont pas lu la meme chose.

`lib/engines/structuration-entree/index.ts` appelle `callClaude` et
n est pas dans le registre. Il n est pas non plus dans
`app/api/analyze/route.ts` : il est servi a la demande par
`app/api/analyses/[id]/structuration/route.ts`, donc hors du run
principal. Son absence du stamp est defendable pour cette raison, et je
la signale sans la compter comme une faute.

`lib/cron/milestone-detection-runner.ts` appelle `callClaude` depuis la
tache planifiee de detection de jalons. Meme raisonnement : hors run
d analyse, hors perimetre du stamp. Signale, non compte.

Le cas materiel est donc celui des deux moteurs sectoriels, et il a
deja eu lieu une fois dans ce meme fichier. Le commentaire de la ligne
218 raconte un `enginesHash` qui etait « aveugle a tout ce qu il
pretendait tracer ». Le defaut a ete corrige pour les prompts des
moteurs et laisse entier pour les generateurs de ce qu on injecte dans
ces prompts.

La correction n est pas d ajouter deux lignes au tableau. Un registre
tenu a la main redivergera, et celui-ci l a fait dans les deux mois qui
ont suivi sa correction precedente. La forme qui tient est le point de
passage unique que la discipline des regles ecrites cite en premier :
l enregistrement se fait dans le client Anthropic, sur l appel, et non
sur une liste de sites d appel. A defaut, le test qui compare le
declare au reel, dont ce scan vient d ecrire la version jetable.

## 5. Le correctif branche en aval du point ou la donnee s est perdue

Verifie 6 sites sur 30 candidats. Deux hypotheses refutees, une
occurrence retenue.

Ce motif ne se scanne pas davantage que le troisieme : il faut savoir
ou une donnee s abime et ou on la repare, et seuls les commentaires qui
racontent une reparation donnent un point de depart. Trente en parlent,
six ont ete ouverts.

### La regle d alignement par annee s arrete a la note

`lib/note/financial-table-alignment.ts` existe parce qu un tableau de
la note affichait des valeurs decalees d un an. Son en-tete raconte le
cas : sur le dossier InHairCare, `revenueProjection` portait huit
entrees de 2019 a 2026 et `ebitdaProjection` sept entrees de 2020 a
2026, l alignement se faisait par position, et la note affichait EBITDA
2024 a 0,402 quand la vraie valeur de 2024 valait 0,138. Le module pose
le contrat juste : `unionYears` construit l en-tete, `alignSeriesToYears`
projette chaque serie sur les annees de reference, et l alignement se
fait par cle annee et non par position.

Le contrat n a ete branche que sur le tableau. Il est juste, il est
teste, et il vit dans `lib/note/`, c est-a-dire dans le rendu, alors
que la perte se produit chez tout consommateur qui suppose que
l indice d une serie designe une annee.

`lib/engines/dd-financial-engine.ts` fait exactement cette supposition,
et il ne rend pas un tableau, il rend des drapeaux de due diligence.

Sa primitive de resolution d annee, `getCurrentYearProjection` ligne
119, cherche l annee exacte puis, si elle ne la trouve pas, retourne
`projection[0]`, la premiere entree de la serie, quelle que soit son
annee. Sa jumelle `getNextYearProjection` ligne 133 ne cherche rien du
tout : elle retourne `projection[1]`, sans arithmetique d annee. L annee
suivante y est definie comme le second element du tableau.

Trois tests deterministes consomment ces deux primitives, et le
troisieme est le plus expose. `testGrowthTrajectory` ligne 395 resout
`proj0` par la premiere regle et `proj1` par la seconde, puis calcule
`(proj1 - proj0) / proj0` et nomme le resultat « BP croissance Y+1 ».
Les deux termes sont resolus par des regles incompatibles : rien ne
garantit qu ils soient consecutifs, ni meme dans l ordre. Sur une serie
de la forme InHairCare ou l annee de reference du grand livre tombe sur
un indice avance, `proj0` vaut cette annee-la et `proj1` vaut la
deuxieme entree de la serie, soit une annee anterieure. La croissance
projetee sort negative, elle est confrontee a la croissance reelle
observee sur le grand livre, et le test qualifie l ecart en points.

`testGrossMarginGap` ligne 190 porte la meme faute sous une forme
residuelle : apres avoir resolu `projected`, il recherche la valeur par
annee, puis retombe sur `fd.grossMarginProjection[0]?.value`, puis sur
`0`. Le meme fichier, aux lignes 211 a 214, porte le journal d une
seance de debogage laissee en place, dont une variable `projectedPct`
calculee et jamais utilisee, et un commentaire qui suppose une unite :
« ici on suppose pct direct ». La discipline de precision dit qu un
montant sans unite n est pas un montant. Ici l unite est supposee en
commentaire, et la supposition decide de la severite d un test de DD.

La correction n est pas de reparer `dd-financial-engine.ts` sur place.
La lecture d une serie a une annee donnee est ecrite quatre fois dans
le depot, et c est la vraie racine :

- `lib/note/financial-table-alignment.ts`, exportee et testee, la seule
  qui soit un module partage ;
- `pickProjectionValueAtYear` dans `valuation-engine.ts:822`, privee ;
- `pickProjectionValueAtYear` dans `indicators-engine.ts:145`, privee,
  et pas identique a la precedente : celle de valuation ecarte une
  valeur non numerique par `!isNaN(v)`, celle d indicators ne le fait
  pas et rend `NaN` la ou l autre rend `null` ;
- `getCurrentYearProjection` / `getNextYearProjection` dans
  `dd-financial-engine.ts:119`, positionnelles.

Quatre implementations d une meme primitive, dont deux se croient
identiques et divergent sur le cas non numerique, et une troisieme qui
resout par position. C est le motif des catalogues qui ne se
confrontent jamais, applique a du code au lieu de donnees. La
correction est d exporter une primitive unique et de brancher les
quatre sites dessus, ce qui elimine du meme coup la divergence
`NaN`/`null` que personne n a encore rencontree.

### Deux hypotheses refutees, et c est utile de le dire

J ai suppose que le correctif du heartbeat, commite la veille, laissait
les lignes anterieures a la migration avec un `heartbeat_at` a NULL,
qu aucune comparaison ne satisfait, donc invisibles au balayage a
jamais. C est faux, et la migration
`supabase-heartbeat-at-migration.sql` traite le cas de front : backfill
par `COALESCE(progress->>'heartbeatAt', started_at, created_at)`
trigger desactive, puis `SET NOT NULL`, avec le raisonnement ecrit
explicitement, « une ligne sans heartbeat ne serait jamais balayee ».
Reste une verification qui ne se fait pas depuis le depot : savoir si
la migration a ete appliquee en production. Le code en depend, et son
absence rendrait le balayage inerte.

J ai suppose ensuite que `computeEngineAvailability` pouvait etre
appele sur la sortie de `protectEngineRoots`, ce que son propre
commentaire interdit puisque la protection remplace les moteurs absents
par des objets vides et les rend indistinguables des presents. C est
faux aussi : `orchestrator.ts:589` le rappelle sur les racines brutes,
pas sur `E`.

Un defaut mineur subsiste a cote du premier : la documentation de
`markStaleRunningAsFailed`, `analysis-store.ts:1310`, annonce encore un
balayage « dont `updated_at` est anterieur au seuil » alors que la
requete filtre sur `heartbeat_at`. Le commentaire contredit le code
qu il surplombe, dans la fonction meme dont la voisine explique
pourquoi `updated_at` ne mesure rien.

## 6. Le dispositif rendu inatteignable par une couche transverse

Verifie 2 candidats sur 2, tires d une population de 53 routes.

La methode ne consiste pas a relire les 53 routes, mais a se demander
laquelle a un appelant legitime qui ne porte pas de cookie de session,
puisque c est exactement ce que le middleware exige. Deux facons de le
savoir, croisees : les routes qui lisent un en-tete d autorisation
plutot qu une session, et les chemins effectivement appeles depuis
l interface. La premiere donne deux routes, la seconde donne vingt et
un chemins dont aucun ne recouvre les deux premieres.

### `/api/sectoral/event-trigger` est redirige en 307 depuis sa mise en service

C est la septieme occurrence du motif des six crons, restee dans
l ombre parce que la correction a porte sur le prefixe `/api/cron/` et
que cette route n y est pas.

Le webhook s authentifie par `Authorization: Bearer
<SECTORAL_EVENT_TOKEN>`, verifie en premiere ligne de son handler. Son
appelant est un systeme externe ou un script manuel, jamais un
navigateur porteur de session. Sous `ENABLE_AUTH=true`, le middleware
l intercepte : le chemin n est pas dans `PUBLIC_PATHS`, qui ne contient
que `/`, `/login`, `/auth/callback` et `/demo` ; il n est pas exclu par
le matcher, dont la seule branche applicative est `api/cron/` ; il
tombe donc sur la redirection vers `/login` ligne 108 de
`middleware.ts`. L appelant recoit un 307 vers une page de connexion,
la garde par token n est jamais atteinte, et la regeneration
evenementielle n a jamais eu lieu.

Le dispositif est complet a tous les autres egards, ce qui est le
propre du motif. La route valide son payload, tient un mode de
defaillance sur : token absent cote serveur rend 503 plutot que
d ouvrir. Les helpers purs sont extraits dans
`lib/cron/sectoral-event-trigger.ts`. Deux fichiers de tests
l exercent, dont un qui verifie que `CRON_SECRET` ne deverrouille pas
`event-trigger`. Tout ce qui pouvait etre pense l a ete, sauf la
couche qui ne se voit depuis aucun de ces fichiers.

Deux faits aggravent le diagnostic et meritent d etre dits parce qu ils
ne se lisent pas dans le code. `SECTORAL_EVENT_TOKEN` n est declare
nulle part : ni dans un `.env.example`, qui n existe pas dans le depot
contrairement a ce qu affirme CLAUDE.md, ni dans la moindre page de
documentation. Une route dont le secret n est documente nulle part n a
pas d appelant configure. Le 307 n est donc pas ce qui a empeche la
regeneration evenementielle de tourner, il est ce qui l aurait empechee
si quelqu un avait essaye. La panne est reelle et n a encore rien
coute, ce qui est la seule bonne nouvelle de cette section.

La correction est de la meme forme que celle des crons : sortir avant
toute lecture de session, sur une condition de chemin, et exclure du
matcher. Elle ne doit pas etre ecrite comme un second cas particulier a
cote de `isCronPath`. Ce qui distingue ces routes n est pas leur
prefixe, c est leur mode d authentification : elles se gardent par
en-tete. La bonne forme est un unique predicat des chemins gardes par
en-tete, dont `/api/cron/` et `/api/sectoral/event-trigger` sont les
deux membres actuels, teste contre la liste reelle des routes qui
lisent `authorization`, sur le modele du test qui compare deja le
matcher aux six chemins de `vercel.json`. Sans ce verrou, la huitieme
route posera le probleme une troisieme fois.

### Constat adjacent : quatre routes qui travaillent apres avoir repondu

Le meme scan a fait apparaitre un motif voisin, que je consigne sans le
confondre avec le precedent : la couche transverse n y rend pas le
dispositif inatteignable, elle le rend ininterrompu seulement par
chance.

Quatre sites lancent un travail de fond apres avoir retourne un 202 :
`app/api/sectoral/event-trigger/route.ts:157`,
`app/api/inter-sectoral/regenerate/route.ts:133`, et
`app/api/admin/sectoral/regenerate/route.ts` en deux endroits, lignes
147 et 222. Tous suivent la forme `void job()`, ou `job` contient un
appel LLM d une minute. Sur l execution serverless de Vercel,
l instance peut etre gelee des la reponse rendue : le travail lance et
non attendu n a aucune garantie d achevement, et le mecanisme prevu
pour cela, `waitUntil`, n est importe nulle part dans le depot. La
seule occurrence du mot est une option de Puppeteer dans
`export-pdf/route.ts:163`, sans rapport.

Je le donne comme un risque structurel et non comme une panne
constatee, parce que je ne l ai pas mesure en production : une
regeneration qui aboutit et une regeneration coupee a mi-course se
distinguent dans les fiches persistees, pas dans le code. La
verification tient en une lecture des fiches sectorielles regenerees
par declencheur `admin` et de leur taux d aboutissement, et elle est a
faire avant de decider quoi que ce soit.

## Question laterale : ce qu il faudrait pour exercer Trajectoire

La question posait que le moteur n a jamais tourne faute de dossier en
portefeuille. La lecture du code deplace le diagnostic : le drapeau
portefeuille ne bloque qu un des deux chemins, et ce qui bloque l autre
est plus interessant.

### Deux chemins, un seul bloque par le portefeuille

Le chemin automatique est le cron `trajectory-reanalysis`. Il liste les
dossiers marques `in_portfolio`, retient ceux dont le dernier snapshot
a plus de 180 jours, relance le sous-ensemble reutilisable du pipeline
et persiste une version. Celui-la exige effectivement un dossier en
portefeuille, et il en exigeait deux autres choses : que le cron
atteigne son handler, ce qui n etait pas le cas jusqu a la correction
du middleware, et que le dernier snapshot ait plus de six mois, ce
qu aucun dossier ne peut avoir tant qu aucun snapshot n existe.

Le chemin a la demande est la route
`GET /api/analyses/[id]/trajectory`. Il ne regarde jamais
`in_portfolio`. Il lit les versions du dossier dans
`analyses_versions`, en extrait un snapshot chacune, et compare. Le
portefeuille n a rien a voir avec lui.

### Ce qui bloque vraiment : la premiere analyse est detruite, pas versionnee

`persist-analysis.ts:148` cree une version uniquement en cas de
collision, c est-a-dire quand un dossier du meme nom d entreprise
existe deja. Et la version qu il cree porte `snapshotJson:
input.result`, le resultat du run **nouveau**, apres quoi
`updateAnalysisLive` ecrase la ligne vivante avec ce meme resultat
nouveau.

La consequence se deroule ainsi. Le premier run cree une ligne
`analyses` et zero version. Le deuxieme run du meme nom cree une
version portant le resultat du deuxieme run, et ecrase la ligne vivante
avec ce meme resultat. Le resultat du premier run n a donc jamais ete
versionne et vient d etre detruit. Le troisieme run cree une deuxieme
version, et c est seulement la que la route dispose de deux termes.

Trois runs complets pour une premiere comparaison, a une vingtaine de
dollars et dix minutes chacun, alors que deux suffiraient si le
versionnement figeait l etat sortant plutot que l etat entrant. Et la
premiere analyse de chaque dossier du depot est perdue sans retour,
ce qui vaut pour le passe autant que pour l avenir.

La route porte bien une branche degeneree quand aucune version n existe,
mais elle est exclusive : des qu il existe au moins une version, la
chaine se construit sur les seules versions et la ligne vivante n y
entre pas. Un dossier a une version rend donc un snapshot unique et
aucune comparaison, alors que la ligne vivante en fournirait un second.

### Le protocole le moins cher

Il existe deja et ne coute aucun appel au modele.
`POST /api/analyses/[id]/versions` sans corps fige le `resultJson`
courant en version, ce que son propre commentaire nomme « fige une
version a l etat actuel sans re-run ».

Sur n importe quel dossier deja analyse : geler l etat courant en
version, ce qui coute zero et sauve au passage une premiere analyse de
la destruction, puis relancer le pipeline une fois. Deux versions
existent, la route rend une comparaison, et le moteur est exerce de
bout en bout pour un seul run.

Pour exercer aussi le chemin cron sans attendre six mois, le meme
dossier marque `in_portfolio` via `PATCH /api/analyses/[id]`, et le
seuil du selecteur abaisse le temps d un declenchement manuel. Le
selecteur accepte deja un seuil en parametre, `thresholdDays`, avec 180
par defaut.

### A faire d abord, dans cet ordre

Le defaut du snapshot decrit au motif 2 est sur ce chemin exactement.
Exercer Trajectoire aujourd hui produirait, sur le premier dossier dont
un pattern applicable n a pas abouti, une trajectoire portant des
patterns sains a zero et une degradation fantome au run suivant. La
premiere trajectoire jamais produite par la plateforme serait fausse
d une maniere que sa forme ne trahit pas.

L ordre est donc : corriger les trois replis de `snapshot-extractor.ts`
d abord, verifier que le trigger Postgres
`trajectory_snapshot_after_version_insert` du schema
`supabase-trajectory-snapshots-schema.sql` est bien applique en
production, puis geler une version et relancer un run.

Le schema porte aussi une fonction `backfill_trajectory_snapshots`,
qui projetterait les versions deja existantes vers la table de
snapshots. Elle merite d etre regardee avant tout run : s il existe
deja des dossiers a plusieurs versions dans la base, la matiere de la
premiere trajectoire est peut-etre deja la, et le run ne serait meme
pas necessaire.

### Un point secondaire, deja note

`listPortfolioLatestSnapshots` expose un filtre `fragiliteVerdicts`
cable jusqu a la requete SQL et qu aucun appelant ne passe. Sans
consequence tant que la vue portefeuille n existe pas, a brancher le
jour ou elle existera.

## Ce que ce scan n a pas couvert

Les quarante props React optionnelles jamais passees ont ete traitees
en classe et non une a une. La confrontation des sept fiches
doctrinales de `docs/patterns/` avec les SYSTEM_PROMPT qu elles sont
censees fonder n a pas ete faite : elle est de nature editoriale et
appartient a la calibration. Le risque des quatre routes qui
travaillent apres avoir repondu n a pas ete mesure en production, faute
d acces aux fiches persistees depuis le depot. Et l application
effective de la migration `heartbeat_at` en production reste a
verifier ailleurs qu ici.
