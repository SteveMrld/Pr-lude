# Grappe 3, tete de file

Deux defauts ouverts au brief 23, non traites. Le premier a change de
nature a l etablissement : la premisse de depart etait fausse, et la
cause reelle est plus large.

## 1. Le parcours growth n a aucun multiple sectoriel

### Ce qui est lu

Enonce d ouverture, a corriger : la table de benchmarks n a pas de
trous. Mesuree directement sur `SECTOR_BENCHMARKS`, elle porte
**79 plages reelles sur 84 combinaisons** classe d actif par stade.
Les cinq cases restantes sont neutralisees a zero de facon doctrinale
et documentee sur place : deeptech, defense et industrial-hardware au
seed, profitable-mature au seed et en series-a. La colonne
series-c-plus est renseignee pour les vingt et une classes d actif,
de `saas-b2b` a 4-12x jusqu a `ecommerce-dtc` a 0,4-2,2x.

Ces plages sont inaccessibles. `getSectorMultiples`
(`lib/data/sector-benchmarks.ts:738-747`) repasse ses deux arguments
dans `normalizeAssetClass` et `normalizeStage`, deux fonctions ecrites
pour lire des libelles libres sortis du LLM et non pour accepter des
valeurs deja canoniques. Sur l axe du stade, `normalizeStage`
reconnait 'Series C' et 'growth', qu elle mappe toutes deux vers
'series-c-plus', mais ne reconnait pas 'series-c-plus' lui-meme et
rend 'unknown'. `getSectorMultiples` sort alors null a sa ligne 740,
avant meme de regarder la table.

Or `computeValuation` normalise le stade a l entree puis transmet la
valeur canonique a `computeBySectorMultiples`, qui la repasse dans
`getSectorMultiples`. Tout dossier au stade series-c-plus perd donc
ses multiples, et le motif ecrit dans la note annonce une plage
manquante qui existe.

Mesure sur le corpus, 41 dossiers portant une extraction :
**14 sont au stade series-c-plus, et les 14 perdent leurs multiples
sectoriels**. Les quatorze portent le meme libelle brut, `growth`.
Aucune exception. C est-a-dire l integralite du parcours growth, qui
est une fonctionnalite vendue et non un cas limite.

C est le meme defaut que la bascule profitable-mature ouverte en tete
de la grappe 2, sur un second axe. Le diagnostic d alors nommait la
cause juste, un melange de deux registres sous un meme type `string`,
un libelle a classer et une classe deja classee, mais le mesurait sur
la seule classe d actif. Il porte en fait sur les deux arguments de la
meme fonction. Sur les dossiers ou les deux se cumulent, le motif
affiche `profitable-mature au stade series-c-plus` et les deux valeurs
citees sont canoniques, donc toutes deux illisibles par le
normaliseur.

Un troisieme effet, plus insidieux que la perte. Une plage neutralisee
a zero et une plage inaccessible sortent par la meme phrase, `Pas de
plage de multiples definie pour X au stade Y`. La premiere est une
decision doctrinale, une PME sans EBITDA stable au seed ne se valorise
pas sur des multiples d EBITDA. La seconde est un incident technique.
Le lecteur de la note croit a une non-applicabilite decidee la ou il y
a une lacune de lecture, et il n a aucun moyen de faire la difference.

C est la meme conflation que `empty_output` contre
`skipped_not_applicable`, deja fermee cote statut de moteur au brief
21, reapparue ailleurs. Le patron se repete : un etat qui signifie
« nous avons choisi de ne pas produire » et un etat qui signifie
« nous n avons pas su produire » partagent un canal de sortie, et le
canal est lu comme le premier. Chaque fois que ce patron reapparait,
il transforme une panne en doctrine aux yeux du lecteur. Il vaut la
peine de le chercher ailleurs dans le pipeline plutot que de le
corriger site par site.

### Ce qui reste a etablir

Ou poser la correction, et la question est desormais la meme que celle
laissee ouverte en grappe 2, ce qui plaide pour les traiter ensemble :
rendre les deux normaliseurs idempotents en reconnaissant leurs
propres valeurs de sortie, ce qui traite la classe entiere, ou
court-circuiter la normalisation dans `getSectorMultiples` quand
l argument est deja une clef du catalogue, ce qui est plus etroit. La
seconde demande d etablir qu aucun libelle libre du corpus ne
collisionne avec une clef.

Ce que la correction change en production. Quatorze dossiers du corpus
recuperent une fourchette de multiples qu ils n avaient pas, et les
verdicts qui en dependent bougent. A mesurer par rejeu hors ligne
avant bascule, comme pour la grappe 2.

Comment separer les deux motifs. Une plage neutralisee a zero et une
plage introuvable doivent cesser de partager une phrase. La premiere
est une decision, la seconde un incident.

## 2. Le pipeline presuppose une levee de fonds

### Ce qui est lu

Le contrat d extraction ne porte aucune notion de type d operation.
`ExtractionOutput` (`lib/engines/types.ts:24-30`) expose un unique
bloc `fundraise` avec `stage`, `amount`, `valuation`, `leadInvestor`,
`coInvestors`. Le prompt d extraction ne mentionne ni cession, ni
acquisition, ni LBO, ni operation majoritaire ou minoritaire : la
recherche de ces termes dans `extraction-engine.ts` ne rend que la
declaration du bloc `fundraise` lui-meme. La levee n est pas une
hypothese parmi d autres, c est le seul cadre que le pipeline sache
representer.

Le cas mesure, run OOGarden du 2 aout 2026. Le deck annonce « Cession
de 100% du capital (transaction M&A, non levée de fonds) », phrase que
l extraction range telle quelle dans `fundraise.amount`.
`parseFinancialNumber` y lit le nombre 100, le trouve inferieur a
1000, applique son heuristique conservatrice et rend **100 millions
d euros de ticket**. Un pourcentage de detention est devenu un montant
de levee.

La suite se deroule sans qu aucune garde ne se declenche. La VC
inverse compare ce ticket a une post-money implicite de 21 M€, le
juge absurde et se neutralise, ce qui est le bon comportement pour la
mauvaise raison. La dilution ne se calcule pas, faute de fourchette
pre-money, et non parce que la notion de dilution n a pas de sens sur
une cession integrale. Le cadrage editorial de la note parle de tour
et de partner qui negocie un prix d entree, sur une operation ou il n y
a pas d entree au capital mais un rachat.

Le stade normalise vaut `series-c-plus` sur ces dossiers parce que
`normalizeStage` mappe `growth` vers ce palier. Les quatorze dossiers
growth du corpus sont des memorandums d information de cession ou de
LBO, pas des decks de levee. Le parcours growth du produit est donc
peuple d operations que le contrat d extraction ne sait pas nommer.

### Ce qui reste a etablir

Le perimetre produit, qui se tranche a l ouverture de la grappe et non
ici. Aucun correctif n est propose : le defaut de parsing est reel
mais second, et le corriger sans trancher le perimetre rendrait un
ticket nul la ou il rend aujourd hui un ticket faux, sans que la note
cesse pour autant de parler de levee.

Quelle proportion du corpus est concernee, au-dela des quatorze
dossiers growth. Rien ne dit que tous soient des cessions, ni qu aucun
dossier early ne le soit. La mesure demande une lecture des
memorandums, pas une requete.

Quels moteurs presupposent une levee au-dela des trois releves ici,
VC inverse, dilution et cadrage de la note. La recherche n a porte que
sur le contrat d extraction et le moteur de valorisation.

## 3. Un insert qui echoue entierement sur une colonne inconnue

Ouvert par la regression du 2 aout, deja programme en correctif au
brief 23 point 2. Consigne ici pour memoire de l etablissement demande.

### Ce qui est lu

`createPendingAnalysis` (`lib/analysis-store.ts:635-660`) ecrit
`as_of_source` depuis le commit b36bf0e, colonne que la migration
`supabase-as-of-source-migration.sql` ajoute et qui n a pas encore ete
appliquee. PostgREST rejette l insert entier, la fonction rend null, et
la ligne d analyse n est creee qu en fin de pipeline par le chemin de
secours, qui n ecrit ni `as_of`, ni `frozen`, ni `started_at`.

Le run OOGarden le montre sur piece : `meta.asOf` vaut `2026-08-02` et
`meta.asOfSource` vaut `deck-receipt`, donc la saisie de l interface a
bien transmis et le moteur a bien travaille, mais la colonne `as_of`
de la ligne est nulle et `started_at` absent, la ou les deux runs
precedents du meme jour les portent.

Le cout depasse la colonne manquante. Pendant les 625 secondes du run,
aucune ligne n existait : pas de reprise possible apres coupure SSE,
aucune progression ecrite, et le balayage des mort-nees pose au meme
brief n avait rien a balayer.

Etat de l ecart schema contre code, mesure sur les trente noms de
colonnes que `lib/analysis-store.ts` ecrit dans `analyses` : une seule
manque en base, `as_of_source`. Le depot n a donc pas d autre insert
en dette de migration a cet instant. La fragilite n est pas dans le
nombre de sites, elle est dans le mode d echec : sur les vingt et un
sites d insert du depot, aucun ne distingue une colonne inconnue d une
erreur metier, et tous abandonnent la ligne entiere.

### Ce qui reste a etablir

Jusqu ou porter la tolerance. Retirer la colonne fautive et rejouer
l insert traite le cas, mais un insert qui se re-tente en boucle en
retirant des champs peut ecrire une ligne silencieusement amputee.
Une ligne incomplete ecrite sans bruit serait pire que l echec actuel,
qui au moins se voit.
