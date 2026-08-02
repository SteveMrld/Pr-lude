# Grappe 2, tete de file

## 1. L interface ne collecte pas la date de reception du deck

Correctif a part entiere, en tete de grappe. Sans lui, la branche 2 de
la regle de millesime posee au brief 22 est inatteignable en
production.

### Ce qui est lu

`app/api/analyze/route.ts:170-171` lit `body.asOf`, valide le format
`YYYY-MM-DD` et le passe au moteur de valorisation ainsi qu au version
stamp. La route est prete.

Le payload construit par l interface ne porte pas ce champ.
`app/HomeClient.tsx:1152-1157` assemble `sessionId`, `ownerKey`,
`files` et `track`, auxquels s ajoutent trois drapeaux de
developpement conditionnels, `forcePrescan`, `forceNarrativeDrift`,
`forceFragility`. Aucun autre champ n est envoye, et aucune saisie de
date de reception n existe dans le fichier : la recherche des libelles
correspondants n y rend rien.

Le seul appelant qui renseigne `asOf` est
`scripts/ingest-jabrilia-corpus.ts:152-160`, qui le passe dans le
corps de sa requete avec `frozen: true`.

La table le confirme sans ambiguite : sur quarante-sept lignes,
vingt-six portent un `as_of` et toutes viennent de l ingestion corpus,
vingt et une n en portent pas et toutes viennent de l interface. Le
run de validation du 2 aout 2026, lance depuis l interface, porte
`meta.asOf` a `null`.

Consequence doctrinale : la regle de millesime tranche par la branche 1
quand le deck qualifie un exercice de realise, et par le refus sinon.
La branche intermediaire, qui concerne vingt dossiers du corpus sur
trente-neuf, ne peut pas se declencher depuis le produit tel qu il est
deploye.

### Ce qui reste a etablir

Ou placer la saisie et avec quelle contrainte. La date de reception est
une donnee d instruction, pas un reglage technique : elle a sa place en
page d entree a cote du selecteur de parcours, et non derriere un
drapeau de developpement. Reste a decider si elle est obligatoire, ce
qui bloquerait le depot, ou optionnelle, ce qui laisserait le refus
s appliquer par defaut.

Si la saisie devient obligatoire, il faut etablir ce qu on fait des
vingt et une analyses existantes sans `as_of` lors d un rejeu.

## 2. La branche 2 ne borne pas l ecart entre l ancre et le millesime

Revele par le rejeu du brief 22 sur le corpus, distinct du defaut
precedent : celui-ci porte sur la regle elle-meme, pas sur sa
disponibilite.

### Ce qui est lu

La branche `as-of-anterior` retient la derniere annee de la serie de
chiffre d affaires strictement anterieure a l annee de `asOf`. La regle
est exacte et deterministe, elle ne mesure jamais la distance entre les
deux.

Sur le dossier OOGarden SAS, mesure au rejeu : `as_of` vaut
`2026-06-08`, la serie de chiffre d affaires court de 2009 a 2017, et
la branche 2 retient donc 2017. Neuf ans separent le millesime retenu
de son ancre. La sortie declare la base sans signaler cet ecart, et un
multiple de marche calibre sur des transactions recentes s appliquerait
a un chiffre d affaires de 2017 comme s il etait d hier.

Le precedent existe dans le depot et n a pas ete suivi ici :
`lib/analysis/reference-year.ts` refuse un `lastActualYear` qui ne
figure pas dans les projections ou qui leur est posterieur. Ces gardes
sont structurelles et sans seuil numerique. La branche 2 n en a aucune.

### Ce qui reste a etablir

Le seuil, et sa nature. Un ecart de un an est normal, un deck recu en
2026 dont le dernier exercice documente est 2025. Un ecart de deux ans
est frequent sur un dossier instruit tard. Neuf ans n est pas un retard
d instruction, c est un document perime. Ou passe la frontiere est une
decision doctrinale a prendre sur le corpus, pas a poser au jugement.

Deux comportements possibles au-dela du seuil, a trancher : refuser la
base comme le fait la branche 3, ou la retenir en la declarant perimee
et en propageant l avertissement jusqu a la note. Le premier est
coherent avec la doctrine de refus deja retenue, le second preserve une
fourchette la ou le partner peut juger lui-meme.

Dans tous les cas l ecart doit figurer dans la sortie, au meme titre que
la branche et le millesime. Un chiffre dont on ne peut pas lire l age
n est pas auditable.

## 3. Le as_of du corpus est la date d ingestion, pas celle du deck

Defaut de donnee, distinct du precedent : la regle de branche 2 peut
etre juste et rendre un resultat faux si son ancre l est.

### Ce qui est lu

Les vingt-six lignes qui portent un `as_of` portent toutes la meme
valeur, `2026-06-08`. C est le jour ou le corpus a ete ingere.

`scripts/ingest-jabrilia-corpus.ts` prend `asOf` en parametre et le
transmet tel quel a la route pour chaque dossier de la campagne. La
valeur n est donc pas derivee du document, elle est constante sur toute
l ingestion.

Or le champ est defini comme la date de reception du deck, et c est a
ce titre que la branche 2 s en sert pour designer le dernier exercice
utilisable. Sur les vingt-six lignes, l ancre ne dit pas ce qu elle
pretend dire. OOGarden en donne la mesure : un IM dont la serie s
arrete en 2017 se voit attribuer une reception en juin 2026, ce qui
produit mecaniquement l ecart de neuf ans du point precedent. Les deux
defauts se composent et l un amplifie l autre, mais ils se corrigent
separement.

Le version stamp n est pas affecte : `asOf` y est documente comme
provenance pure et n entre pas dans le hash de configuration.

### Ce qui reste a etablir

D ou tirer la vraie date. Trois sources possibles, aucune verifiee :
une saisie par dossier au moment de l ingestion, une extraction depuis
le document lui-meme quand il porte une date de publication, ou la date
de derniere modification du fichier source. La premiere est la seule
qui ne soit pas une inference.

Que faire des vingt-six lignes existantes. Les laisser en l etat avec
une valeur fausse, les vider pour que la branche 2 cesse de s appuyer
dessus, ou les corriger une par une. La deuxieme option a un effet
mecanique a mesurer : elle bascule ces dossiers en branche 3, donc en
refus, et supprime leur fourchette de multiples.

## 4. La bascule profitable-mature est inerte

Ouvert au brief 22, ecarte volontairement de cette grappe : le
correctif toucherait `lib/engines/valuation-engine.ts`, moteur deja
modifie par le bloc 1, et la methode de grappe interdit deux
correctifs sur un meme moteur dans une meme passe.

### Ce qui est lu

`computeValuation` bascule un dossier vers l asset class
`profitable-mature` quand trois conditions se rencontrent : un EBITDA
positif au millesime de reference, un stade series-b ou series-c-plus,
et une classe d actif qui n est ni saas-b2b, ni cybersecurity, ni
ai-generative (`valuation-engine.ts:262-263`). La bascule est
doctrinalement fondee : sur une PME rentable, les multiples EBITDA
donnent une fourchette plus juste que les multiples de revenu, et
`SECTOR_BENCHMARKS['profitable-mature']` porte pour cela une plage
series-b de 6x a 15x calibree sur l Argos Index
(`lib/data/sector-benchmarks.ts:522-534`).

Cette plage n est jamais atteinte. `computeBySectorMultiples` appelle
`getSectorMultiples(assetClass, stage)`, qui commence par repasser son
argument dans `normalizeAssetClass` (`sector-benchmarks.ts:738`). Or
cette fonction est ecrite pour lire un libelle sectoriel libre sorti du
LLM d extraction, pas pour accepter une classe deja normalisee : elle
cherche des mots-cle de secteur, et `profitable-mature` n en porte
aucun. Elle rend donc `unclassified`, `getSectorMultiples` rend `null`
a la ligne suivante, et la methode ressort non applicable avec le motif
`Pas de plage de multiples definie pour profitable-mature au stade
series-b`.

Mesure sur les vingt et une asset classes du catalogue :
`normalizeAssetClass` est idempotente sur vingt d entre elles.
`profitable-mature` est la seule exception, et c est exactement la
seule qui ne soit pas produite par `normalizeAssetClass` mais derivee
par le moteur de valorisation lui-meme. Le defaut n est donc pas un
oubli dans une liste de mots-cle, c est un melange de deux registres
sous un meme type `string` : un libelle a classer et une classe deja
classee.

Le defaut precede le brief 22 et n a pas ete introduit par lui. Le
bloc 1 en change toutefois la population : la bascule se decide
desormais sur l EBITDA realise et non plus sur l EBITDA d horloge, donc
les dossiers qui l atteignent ne sont plus les memes.

Cout de l effet en production : nul en apparence, ce qui est le pire
cas. Un dossier series-b rentable ne sort pas avec une fourchette
fausse, il sort sans fourchette de multiples du tout, et la
valorisation retombe sur la seule VC inverse. Aucun warning ne dit que
la plage EBITDA existait et n a pas ete lue.

### Ce qui reste a etablir

Combien de dossiers du corpus atteignent la bascule, et ce que la plage
EBITDA leur donnerait. Le rejeu hors ligne est faisable sans cle API,
`computeValuation` etant deterministe et tous ses inputs persistes dans
`result_json` ; c est le meme harnais que celui utilise pour mesurer le
bloc 1.

Ou poser la correction. Deux options qui ne se valent pas. Rendre
`normalizeAssetClass` idempotente en reconnaissant les classes du
catalogue en entree traite la classe entiere de defauts, mais elargit
le contrat d une fonction que trois classificateurs appellent.
Contourner l appel dans `getSectorMultiples` quand l argument est deja
une clef de `SECTOR_BENCHMARKS` est plus etroit et plus sur. La seconde
demande d etablir qu aucun libelle libre du corpus ne collisionne avec
une clef du catalogue.

Si la plage EBITDA doit rester non applicable dans certains cas, par
exemple faute d EBITDA au millesime retenu, le motif ecrit doit le
dire. Aujourd hui il annonce une plage inexistante, ce qui envoie sur
une fausse piste quiconque enquete.

## 5. Le perimetre reel du chantier design

Chiffre pose ici parce qu il sera utile le jour ou le chantier
s ouvrira, et parce qu il contredit l intuition que le depot donne de
lui-meme.

Le code applicatif suivi par git pese 113 549 lignes au 2 aout 2026.
L interface en represente 35,1 pour cent : 21 424 lignes de composants
et 18 423 lignes de pages et de clients, soit 39 847 lignes sur 84
fichiers. Les moteurs, qui sont le coeur du produit et ce que le fonds
achete, pesent 33 701 lignes sur 77 fichiers, soit 29,7 pour cent.
L interface est donc le premier poste du depot, devant les moteurs, et
l ecart de cinq points et demi represente environ six mille lignes.

Deux fichiers portent a eux seuls 14 023 lignes, soit plus du tiers de
l interface : `app/HomeClient.tsx` a 7 015 lignes et
`app/components/InvestmentNoteView.tsx` a 7 008. Le second est le
fichier le plus souvent touche du depot, puisque toute evolution de la
note d instruction y passe, y compris les affichages ajoutes par le
brief 22.

Ce que ce chiffre ne dit pas, et qu il faudra etablir avant d ouvrir le
chantier : quelle part de ces 39 847 lignes est du style inline plutot
que de la structure. Le depot suit par ailleurs 5 520 lignes de CSS
dans un fichier unique, ce qui suggere que les deux regimes coexistent
sans frontiere ecrite. Un decoupage en sous-composants qui ne
trancherait pas cette question deplacerait le volume sans le reduire.
