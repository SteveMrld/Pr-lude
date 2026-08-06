# Registre de dette

Ce que l'on sait faux ou fragile et que l'on n'a pas ferme, avec la
raison de ne pas l'avoir ferme. Une entree se retire quand le defaut
disparait, jamais quand on s'y habitue.

L'ordre est celui du dommage, pas celui de la date.

---

## L'extraction rend des nombres qu'on ne retrouve pas dans le classeur

Ouvert le 5 aout 2026, run b8d0e9ac. En tete du registre parce que
c'est, de tout ce qu'il porte, le seul defaut qu'un fonds peut etablir
tout seul en ouvrant deux fichiers.

Le run Project Hello est le premier des cinquante-trois du corpus a
avoir lu un business plan : `hasBP` vaut vrai, `fileSource` vaut `both`,
et `revenueProjection` est peuplee avec `source: "bp"`, donc depuis le
classeur et non depuis le teaser. Le chemin fonctionne. Ce qu'il rend ne
se retrouve pas dans le document.

Le classeur porte, sur sa feuille Management BP, une ligne « Chiffre
d'affaires » a 153 250, 907 250, 1 059 750 et 1 059 750 euros pour 2025
a 2028, et une ligne B2B a 121 250, 811 250, 963 750 et 963 750.
L'extraction rend 0,101, 0,897, 0,963 et 0,963 million. Aucune de ces
quatre valeurs n'existe dans le classeur, ce que la section « ce que la
mesure a etabli » detaille plus bas.

Ce qui en fait le premier de ce registre est la nature de la faute, pas
son ampleur. Toutes les autres entrees decrivent une chose que le
produit ne fait pas, ou fait mal. Celle-ci decrit un nombre imprime dans
une note d'instruction que le document source ne porte pas. Un partner
qui ouvre le classeur a cote de la note ne trouve pas la ligne, et il
n'a alors aucun moyen de distinguer une erreur de lecture d'une valeur
inventee. C'est exactement le controle que fait une due diligence, il
coute une minute, et il ne laisse aucune place a l'explication : la
rigueur est le positionnement commercial entier de la plateforme.

Un facteur aggravant etait mesure et distinct, et il est ferme depuis le
5 aout 2026. Le convertisseur aplatissait le classeur en CSV puis coupait
a 30 000 caracteres, en silence. Le classeur Hello rend 32 710
caracteres, donc il a ete coupe, et `bpChars` vaut exactement 30 000 dans
le cachet du run. La coupe tombait dans le tableau de financement, apres
le compte de resultat : le P&L survivait, la ligne « Equity levee » a
275 000 et les positions de tresorerie etaient perdues. Un BP coupe se
lisait donc exactement comme un BP complet.

La coupe reste, parce qu'un contexte a une limite. Ce qui change est
qu'elle se declare, dans le texte meme que le modele lit, avec le nombre
de caracteres manquants et l'interdiction de conclure a une absence
depuis un extrait. Elle tombe desormais sur une frontiere de ligne :
couper au milieu d'une ligne de tableau produit une valeur amputee que
rien ne distingue d'une valeur vraie, ce qui est pire qu'une ligne
absente. Et l'avertissement a sa marge reservee, faute de quoi il serait
ajoute puis coupe par le plafond qu'il annonce, et la garde se serait
annulee elle-meme.

### Ce que la mesure a etabli, le 5 aout 2026

Le classeur porte 3334 cellules numeriques. **Aucune ne rend l'une des
quatre valeurs extraites**, a l'arrondi au millier pres. Les quatre sont
des approximations, et leur plus proche voisine se lit ainsi, sur la
feuille Management BP dont les colonnes G a J portent 2025 a 2028 :

| annee | rendu | plus proche cellule | ecart | ce que la cellule est | ce qu'il fallait lire |
|---|---|---|---|---|---|
| 2025 | 0,101 | H18 = 100 150 | 0,84 % | EBITDA **de 2026** | CA 2025 = 153 250 |
| 2026 | 0,897 | H12 = 907 250 | 1,14 % | CA 2026 | CA 2026 = 907 250 |
| 2027 | 0,963 | I10 = 963 750 | 0,08 % | **B2B** 2027 | CA 2027 = 1 059 750 |
| 2028 | 0,963 | J10 = 963 750 | 0,08 % | **B2B** 2028 | CA 2028 = 1 059 750 |

Trois fautes distinctes dans quatre valeurs. La premiere prend une ligne
d'EBITDA pour une ligne de chiffre d'affaires et decale l'annee d'un
cran, ce qui rend 2025 inferieur de trente-quatre pour cent a la verite.
Les deux dernieres prennent la ligne B2B pour le total, ce qui les rend
inferieures de neuf pour cent. La seule qui vise la bonne ligne et la
bonne annee est approximee d'un pour cent.

La troncature est disculpee, et c'est une des trois issues qui tombe.
Les trois libelles de ligne et les quatre chiffres du document sont
presents a l'identique dans le CSV coupe et dans le CSV complet : le
compte de resultat survit entierement a la coupe, qui tombe plus bas
dans le tableau de financement. Elle reste un defaut a fermer pour ce
qu'elle emporte, elle n'est pas la cause de celui-ci.

Les deux autres issues sont realisees ensemble, ce que je n'avais pas
prevu. Le modele lit la mauvaise ligne, et il approxime meme quand il
lit la bonne. La consequence porte sur le correctif : exiger le libelle
de la ligne lue a cote de la valeur, qui etait ma premiere hypothese, ne
suffit pas. Cela rattraperait 2025, 2027 et 2028, et laisserait passer
2026, dont le libelle serait juste et la valeur fausse d'un pour cent.
Ce qui ferme les trois est de faire porter a l'extraction **le chiffre
tel qu'il est ecrit dans le document**, verbatim, a cote de la valeur
normalisee. La comparaison devient alors mecanique et se verrouille par
un test, au lieu de dependre d'une relecture.

Ce qui n'est pas etabli, et se dit : l'attribution par proximite de
valeur est plausible, elle n'est pas une preuve de provenance. Rien
n'exclut que 0,101 vienne d'ailleurs et tombe par hasard a 0,84 % d'une
cellule d'EBITDA. Ce qui est etabli sans hypothese est le negatif, et il
suffit : aucune des quatre valeurs n'existe dans le document.

### Ce que le premier run avec verbatim a etabli, le 6 aout 2026

Le run `0c3e0caf` a exerce la regle pour la premiere fois, sur le meme
classeur. Huit valeurs chiffrees, zero sans verbatim, huit non fondees.

**Le modele ne recopie pas, il calcule.** Aucun des huit verbatims
n'etait un chiffre : tous etaient des expressions additionnant les
colonnes mensuelles du classeur, alors que la feuille porte deja la
ligne annuelle.

L'arithmetique de ces expressions dit le reste, et elle est plus
instructive que le compte.

| annee | somme du verbatim | valeur declaree | ce que la somme vaut |
|---|---|---|---|
| 2025 | 153 250 | 101 000 | exactement la ligne « Chiffre d'affaires » |
| 2026 | 907 250 | 963 000 | exactement la ligne « Chiffre d'affaires » |
| 2027 | 963 750 | 963 000 | la ligne B2B, sans le B2C |
| 2028 | 963 750 | 963 000 | la ligne B2B, sans le B2C |

**Le document a ete lu correctement deux fois sur quatre.** Sur 2025 et
2026, la somme tombe au franc pres sur la bonne ligne du classeur, et la
valeur inscrite a cote ne correspond ni au document ni au propre calcul
du modele. Sur 2027 et 2028, la valeur suit son verbatim, mais le
verbatim additionne le B2B en oubliant le B2C, que le modele avait
pourtant ajoute les deux annees precedentes.

La faute n'est donc pas dans la lecture. **Elle est entre la lecture et
la restitution**, et c'est un endroit que rien n'observait avant ce
champ. Un audit qui n'aurait compare que la valeur au document aurait
conclu a une erreur de lecture sur les quatre lignes ; il aurait eu tort
sur deux d'entre elles, et il n'aurait jamais pu le savoir.

Quatre autres lignes, sur l'opex, portent un ecart d'une troisieme
nature : le verbatim cite un montant mensuel face a une valeur annuelle.
Les deux nombres sont probablement justes et ne se comparent pas.

### Etat au 5 aout 2026

Le correctif est pose et il est general : toute valeur chiffree extraite
d'un document porte le chiffre tel que le document l'ecrit, la valeur
normalisee en descend, un ecart au-dela de ce qu'un arrondi peut couter
est un incident declare, et une valeur sans verbatim est non fondee.
Voir `lib/engines/valeur-citee.ts` et la section de doctrine dans
CLAUDE.md, ou la regle est ecrite comme la troisieme occurrence d'une
meme forme apres les sources web et les montants d'operation.

Ce qui reste ouvert est la verification en conditions reelles. La regle
est verrouillee par trente-trois assertions et par une propriete du
catalogue, mesuree a cinquante et une notes sur cinquante et une, ce qui
est le solde historique attendu puisque aucune analyse anterieure ne
porte de verbatim. Rien n'etablit encore que le modele sache recopier un
chiffre sans le normaliser : c'est ce que le prochain run dira, et c'est
la premiere chose a lire dedans.

Rien ne doit etre montre a un fonds avant cette lecture-la.

### L'arbitrage sur la troisieme issue, rendu le 6 aout 2026 avant le run

Trois issues sont possibles au run qui exerce l'interdiction des
operateurs, et elles ne demandent pas la meme suite. Des cellules
signifient que la consigne porte. Des lignes omises signifient que le
classeur ne porte pas de total annuel, et c'est le document qui est en
cause et non la restitution. Des expressions a nouveau signifient que la
consigne ne tient pas contre l'habitude du modele de calculer.

**La decision sur cette troisieme issue est prise d'avance, et c'est
pour cela qu'elle est ecrite ici plutot qu'apres la lecture.** On ne
renforce pas l'instruction. On la deplace vers le contrat, c'est-a-dire
vers un refus au parse plutot qu'une phrase de plus dans le prompt.

Le motif tient en une ligne et il vaut au-dela de ce champ. Un champ qui
accepte une expression est un champ mal specifie, et une troisieme
tentative d'instruction serait la preuve qu'on demande au prompt ce qui
releve du contrat. Une instruction ne fait qu'exprimer une preference a
un producteur qui reste libre ; un contrat refuse ce qui ne s'y conforme
pas, et il refuse pareil au premier et au centieme run.

L'interet d'ecrire l'arbitrage avant le resultat est qu'il ne peut plus
etre rendu a chaud. Une troisieme instruction est toujours tentante juste
apres une lecture decevante, parce qu'elle coute une phrase et qu'elle a
l'air de repondre ; ecrite a froid, la regle dit que ce cout apparent est
precisement le piege, puisque les deux premieres avaient le meme.

---

## La synthese est declaree en panne alors qu'elle a abouti

Ouvert le 6 aout 2026 au relevé du run `5585f1c0`. Le statut n'est pas
mesure, il est invente par defaut, et le defaut choisi affirme une panne.

`finalRecommendation` sort `empty_output`. Sa sortie persistee porte
pourtant un verdict, un score global, une argumentation, cinq
`decisionDrivers`, et elle satisfait son contrat minimal quand on le lui
applique. L'appel au modele a abouti : 4131 tokens produits, 83 secondes.

La cause se lit dans `snapshot()`, dans le recorder de statuts. Un moteur
qui a depose une mesure d'appel sans avoir depose d'entree de statut se
voit fabriquer une entree, avec `'empty_output'` en valeur par defaut. La
synthese est exactement dans ce cas : la route depose sa mesure dans un
`finally`, et n'appelle jamais `record` pour son statut. Le commentaire du
code annonce l'intention, documenter le moteur dont l'appel a abouti puis
dont le post-traitement a leve. Mais `empty_output` figure dans
`GAP_STATUSES`, donc la valeur choisie pour dire « je ne sais pas »
affirme une lacune.

C'est la doctrine de la valeur neutre prise au pied de la lettre, et en
pire. Une valeur de repli n'est neutre que si le calcul qui la consomme
sait qu'elle est un remplacement ; ici le repli n'est meme pas neutre, il
penche du cote de l'accusation. Le bulletin de fiabilite du run imprime
en consequence « 1 panne(s) : finalRecommendation », gravite majeure, sur
un run ou la synthese a fonctionne. La reserve la plus grave de la note
porte sur le seul moteur dont la sortie est la premiere page que le
partner lit.

Mesure : trois notes sur les quatre qui portent un releve de statuts
declarent une lacune contredite par leur propre sortie persistee, et les
trois sont `finalRecommendation`. Le denominateur est petit parce que
l'instrument est recent, donc ce chiffre ne borne rien ; il dit seulement
que le cas n'est pas isole sur ce dont on dispose.

La reparation n'est pas de changer la valeur par defaut pour `ok`, ce qui
reproduirait la faute dans l'autre sens. C'est que la route depose le
statut de la synthese comme les autres moteurs deposent le leur, et qu'un
statut fabrique faute d'entree porte un etat distinct des quatre lacunes,
qui dise l'ignorance sans l'affirmer.

## La classe d'actif n'est pas tranchee sur un dossier sur treize

Ouvert le 5 aout 2026. Probleme d'entree et non de comparables, et il
touche autant de dossiers que toutes les classes vides reunies.

Quatre notes sur cinquante-trois, soit sept et demi pour cent, sortent
avec `relevanceMatrix.assetClass` a `unclassified` ou absente. Sur ces
dossiers, tout ce qui depend de la classe tombe : pas de multiples donc
pas de fourchette de valorisation, pas de sortie de reference donc pas
de VC inverse, et desormais pas de seau de comparables donc aucune base
de chiffres verifies servie aux moteurs.

Le chiffre corrige une lecture plus alarmante : ce n'est pas un dossier
sur six. Et il ne domine pas les classes vides, qui touchent exactement
quatre notes elles aussi.

Ce qui ferait tomber ce taux, et ce n'est pas de la collecte. La classe
se derive du seul couple `sector` plus `subSector`, deux champs de
synthese que le modele redige. Trois pistes, par ordre de cout croissant
et non arbitrees.

La premiere est de faire porter au prompt d'extraction la liste des
vingt et une classes normalisees et de lui demander de s'y ranger, au
lieu de laisser un libelle libre que le normaliseur doit ensuite
deviner. C'est le defaut Compagnie des Alpes generalise : le prompt
proposait onze secteurs en francais et le normaliseur n'en connaissait
que la version anglaise.

La deuxieme est d'elargir la lecture au-dela des deux champs de
synthese, vers `productDescription`, `businessModel` et `rawSummary`,
qui portent la matiere que la synthese a resumee.

La troisieme est de demander au modele sa classe et sa citation, comme
pour le type d'operation : une classe sans citation retombe a
`unclassified`, ce qui ne fait pas baisser le taux mais rend la cause
lisible.

Pas ferme aujourd'hui parce que le premier geste touche le prompt
d'extraction, donc l'entree de tout le pipeline, et qu'il ne se mesure
que sur un corpus rejoue.

---

## Les dix sources qui nomment un document sans l'identifier

Ouvert le 5 aout 2026, sur le lot 1 de collecte `ecommerce-dtc`. Se
fermera quand les entites francaises seront traitees au format v1.0 du
referentiel juridique.

Sur les trente-deux refus de source du lot, vingt-deux annoncent une
collecte a faire et partent en collecte. Les dix autres sont d'une autre
nature : elles nomment un type de document sans l'identifier. « comptes
agreges » sur les trois series de Cabaia, « comptes » sur Omie et
Matches, « jugement » sur Poulehouse, « communique d'offre » sur About
You.

**Elles ne se ferment pas par un recollage** parce que la question
qu'elles posent n'est pas ou trouver le document, c'est de quelle entite
il est. Cabaia publie sous Valtex, Sezane sous Benda Bili, Typology sous
Good Brands, Omie sous Foodyssey. « Les comptes de Cabaia » ne designe
rien tant que Valtex n'est pas nomme, et chercher sous le nom commercial
rend soit rien, soit les comptes d'une homonyme. Le referentiel juridique
recense quatre entites candidates pour Missguided, dont une qui porte le
nom de la marque et depose des comptes dormants : la selectionner aurait
produit une serie vide ayant l'apparence d'une serie.

Ce qui les fermera : `LEGAL_ENTITY` avec le registre et le numero,
`ENTITY_BRAND_LINK` date entre la marque et l'entite, `REPORTING_SCOPE`
pour distinguer social et consolide, et la reference `SOURCE` au niveau
du fait. Les huit francaises ont leur perimetre juridique identifie et
attendent leur mise au format v1.0, ce qui est la premiere etape du
chantier corpus.

Quatre du lot sont deja tombees a six : la reprise du 5 aout a nomme le
communique Next, le communique Frasers et le document d'offre Zalando,
qui etaient identifiables sans registre. Les six qui restent sont
exactement les comptes deposes de societes francaises.

---

## Classe candidate : `retail-specialise`

Ouverte le 5 aout 2026. Chiffree, non arbitree.

Jimmy Fairly fait quatre-vingt-treize pour cent de son chiffre en
boutique. Ce n'est ni de la vente directe en ligne, ni un service aux
entreprises : c'est du commerce de detail specialise grand public, et le
catalogue ne porte aucune classe pour cela. Les vingt et une existantes
sont des classes de modele economique ou de secteur technologique, et la
seule qui touche au commerce suppose la vente directe en ligne.

**Ce que la classe couterait : neuf cellules a mesurer.** Quatre
multiples sectoriels par stade, quatre seuils de KPI par stade, une
sortie de reference. Plus un seau de comparables dans la correspondance,
avec sa raison. Aucune de ces neuf valeurs n'existe aujourd'hui.

**Pourquoi elle n'a pas ete ouverte.** Les inventer serait exactement la
precision inventee qui vient d'etre retiree de `baseExits` : dix valeurs
rondes pour vingt et une classes, posees a la main avec une source citee
a cote. Un second defaut ne repare pas le premier.

En attendant, Jimmy Fairly reste en `ecommerce-dtc` avec un piege qui
dit que la classe est conservee faute de mieux et non parce qu'elle
decrit le dossier. Le piege est faible et on le sait : le filtre de seau
ne lit pas la prose. Il est vrai, ce que neuf cellules inventees ne
seraient pas.

La classe s'ouvre le jour ou une collecte peut financer ses neuf
cellules, et pas avant. Deux dossiers du corpus la concerneraient
aujourd'hui.

---

## La famille de chute de contrat, mesuree le 6 aout 2026

Seize passes hors ligne, huit par moteur, reparties avec et sans
recherche web. **Zero chute de contrat.**

| moteur | condition | passes | chutes | durees |
|---|---|---|---|---|
| market | sans web | 4 | 0 | 76,7 a 85,7 s |
| market | avec web | 4 | 0 | 100,9 a 106,1 s |
| team | sans web | 4 | 0 | 83,5 a 86,0 s, plus un depassement a 182,0 s |
| team | avec web | 4 | 0 | 115,0 a 122,9 s |

**Ce que la borne dit exactement.** Huit tirages a zero echec par moteur
rejettent un taux d'un sur trois a quatre-vingt-quinze pour cent. Un sur
dix reste possible : il faudrait vingt-neuf passes pour l'ecarter, et
cette precision ne changerait aucune decision. **La reprise de contrat
est la reponse a cette incertitude, pas la mesure.** Les deux moteurs de
porte la portent depuis le 6 aout.

**L'hypothese de la recherche web n'est ni confirmee ni infirmee.**
Aucune passe n'est tombee, dans aucune des deux conditions. Le signal du
corpus reste ce qu'il etait : sept observations non-`direct` sur neuf du
cote web, treize sur treize `direct` sans. C'est un signal, pas une
cause, et il n'a pas ete reproduit.

**Une donnee de budget que personne n'avait.** La recherche web coute
regulierement vingt a trente-trois secondes sans jamais casser le parse :
plus vingt-quatre secondes sur market, plus trente-trois sur team. C'est
une entree pour tout dimensionnement de fenetre a venir, et elle
n'existait nulle part.

**Un depassement de fenetre a ete observe et il n'etait pas cherche.**
Une passe de team sur huit a rendu « Request timed out » a 181 982 ms,
contre une fenetre de 180 s, et **sans recherche web** alors que les
quatre passes avec web tenaient entre 115 et 123 s. Le nominal de team
est donc de 83 a 123 s selon la condition, avec une queue qui atteint
182 s. Un sur huit, ce qui ne borne rien mais suffit a savoir que la
queue existe. La deadline de team, portee a 380 s par sa reprise de
contrat, heberge deux tentatives de cette longueur, tout juste.

---

## Deux lectures en attente, apres ce qui est engage

Ouvertes le 5 aout 2026. Ce ne sont pas des dettes mais deux relevés a
faire, inscrits ici parce qu'une question qui n'est pas ecrite se perd,
et que celles-ci sont nees d'un correctif dont elles debordent.

### Les fonctions dupliquees entre le serveur et le bundle client

`detectPitchCurrency` a du sortir du validateur d'assertions pour que le
moteur de valorisation puisse la lire : le validateur importe la capture
de sources, donc `AsyncLocalStorage`, et le moteur est atteint par
`InvestmentNoteView` puis `HomeClient`. La tentation etait de la
recopier, et c'est la faute a ne pas commettre : deux lectures de la
devise d'un meme dossier ne se contrediraient pas bruyamment, elles se
contrediraient en silence, chacune dans son moteur, et le partner lirait
deux chiffres dont il croirait qu'ils descendent de la meme lecture.

Ce qui reste a faire est le releve de la meme famille. Quelles autres
fonctions du depot existent en deux exemplaires parce qu'une des deux
copies devait echapper a une dependance Node. Le releve se fait sur les
corps de fonction et non sur les noms, puisqu'une copie porte rarement
le meme nom que son original.

C'est le pendant, cote frontiere serveur-client, de ce que
`lecture-montant` a ferme pour les montants : trois lectures d'une meme
chaine ne divergeaient que sur le cas sale, donc jamais bruyamment.

### Les nombres qui portent une source citee sans qu'on sache s'ils en viennent

La discipline ecrite le 5 aout dit qu'une source citee a cote d'un nombre
n'etablit pas que le nombre en vient, et que la citation authentifie ce
qu'elle n'a pas produit. Elle est nee sur `baseExits`, ou dix valeurs
rondes pour vingt et une classes ont refute une source nommee.

Elle vaut au-dela. Deux candidats, dans cet ordre.

`SECTOR_BENCHMARKS` : quatre-vingt-six pour cent des cellules portent
`asOf: 2024`, et le commit fondateur nomme des sources precises,
Bessemer Cloud Index, OpenView SaaS Benchmarks, Atomico State of
European Tech, Carta. La question est de savoir si les valeurs en
viennent ou si les sources ont ete citees a cote comme pour les sorties.

`INDICATOR_BENCHMARKS` : quatre-vingt-dix pour cent en 2024, et
cinquante-sept cellules sur quatre-vingt-quatre ne declarent aucune
confiance. Une cellule sans confiance se lit comme une cellule fiable.

Le test se fait sans ouvrir aucun document : la forme des nombres se lit
avant la source declaree. Des valeurs rondes, repetees, tirees d'une
echelle courte, sont une estimation quoi qu'en dise le commentaire ; des
valeurs a trois chiffres significatifs et toutes distinctes sont une
transcription, meme sans source citee.

Ces deux tables decident de la fourchette de valorisation et des seuils
de KPI, donc du prix et du verdict. Elles viennent apres ce qui est
engage, et pas apres autre chose.

---

## Ce qu'il faut collecter, table par table

Ouvert le 5 aout 2026 apres l'inventaire du corpus de reference. Ce
n'est pas une dette mais un plan de collecte, ecrit pour que le travail
puisse commencer sans moi. L'ordre est celui de l'effet, pas celui de la
difficulte.

### 1. `lib/data/exit-benchmarks.ts` — 21 valeurs, une journee, **premiere ligne**

Vingt et une sorties de reference, une par classe d'actif. L'archeologie
du 5 aout 2026 a etabli ce qu'elles sont : **des ordres de grandeur
poses a la main**, non sourcees, sans devise. Dix valeurs distinctes pour
vingt et une classes, toutes multiples de dix millions, 80 M repete
quatre fois. La mention Crunchbase qui les accompagnait a ete retiree,
une source qui n'a pas produit un nombre ne se cite pas a cote de lui.

La table se declare desormais non fiable **par classe et non en bloc**,
depuis le 6 aout 2026. Le verdict global etait juste au moment ou aucune
entree n'etait mesuree et faux des la premiere collectee : un dossier
SaaS aurait lu une reserve sur une valeur mesuree, au motif que
sportstech ne l'est pas. La reserve nomme donc la classe du dossier, et
elle disparaitra d'elle-meme classe par classe a mesure que la collecte
avance, sans qu'aucun drapeau ne soit a baisser a la main. La garde
continue de fonctionner : sur les trois notes du corpus ou elle se
declenche, la marge va de 157 a 171 pour cent, donc aucune incertitude ne
la ferait basculer. Mais elle repose sur une estimation et elle l'annonce.

### La collecte a ete refaite le 6 aout 2026, et le resultat est structurel

Zero classe sur vingt et une. Neuf interrogations et recuperations sur
Dealroom, Atomico, PitchBook, CB Insights et les agregateurs sectoriels
sante et fintech rendent le meme motif partout : de la valeur totale et
du compte d'operations, jamais une mediane par classe avec son
echantillon.

**Une mediane de valeur de sortie est une statistique que les
observateurs ne publient pas gratuitement, parce qu'elle suppose de
connaitre le prix d'operations majoritairement non divulguees.** Ce
qu'ils publient sans contrepartie est precisement l'agregat qui n'exige
pas cette connaissance : Dealroom rend 7 557 acquisitions europeennes
depuis 2010 pour 513,6 milliards de dollars divulgues, et 1 065
acquisitions deeptech pour 49,8 milliards, sans mediane ni quartile ni
ventilation. Atomico situe la part europeenne a 10 pour cent d'une valeur
de sortie mondiale de 608 milliards en 2025, agregat continental.
PitchBook annonce une mediane de taille de sortie au plus haut historique
mais ses pages rendent 403 : cette source est a declarer non etablie et
non inexistante, ce qui n'est pas la meme chose.

**Et six de nos classes n'existent comme categorie chez personne
d'autre.** `profitable-mature`, `services-b2b`, `hospitality`,
`sportstech`, `mediatech` et `adtech` ne sont pas des decoupages de
marche : aucun observateur de sorties technologiques ne publie ces
lignes, et aucun budget ne les fera apparaitre. Elles resteront declarees
non mesurees, ce qui est le resultat juste et non un manque a combler.

Les quinze autres se repartissent ainsi. Cinq relevent d'une donnee
payante et existent bien comme categorie : `saas-b2b`, `fintech`,
`deeptech`, `healthtech`, `cybersecurity`. Six existent comme categorie
mais sont trop peu peuplees en Europe pour qu'une mediane ait un sens :
`ai-generative`, `climate-tech`, `defense`, `foodtech`, `proptech`,
`edtech`. Quatre sont des decoupages intermediaires que les sources
fondent dans des ensembles plus larges : `marketplace-b2c`,
`ecommerce-dtc`, `logistics`, `industrial-hardware`.

**Aucune classe n'a recu de valeur voisine par defaut.**

Une seule ligne s'approchait d'un usage direct, et elle est conservee
comme exemple plutot que comme donnee. La sante europeenne rend 31,8
milliards d'euros de valeur d'operations sur le premier semestre 2025
pour 418 transactions. Diviser l'un par l'autre donnerait 76 millions, un
nombre qui aurait l'air d'une reponse. C'est une moyenne et non une
mediane, le denominateur inclut des operations sans prix divulgue que le
numerateur ne porte pas, et le perimetre mele des cibles adossees au
capital-risque et des cibles qui ne le sont pas. Deux nombres exacts et
une operation licite produisent une grandeur qui n'existe pas, exactement
comme le rapport entre une valorisation d'introduction en bourse et un
prix de reprise d'actifs apres liquidation.

Une piste reste non confirmee et se note comme telle : un deplacement de
la taille mediane d'operation M&A d'un facteur quatre en deux ans, dont
le document primaire n'a pas pu etre lu. Ce qui merite d'etre retenu est
la forme de l'objection et non sa magnitude. Si l'ordre de grandeur bouge
ainsi, une valeur unique et non datee par classe est fausse par
construction quelle que soit sa valeur, et `asOf` cesse d'etre une
formalite de tracabilite pour devenir une partie de la donnee.

### Le seul consommateur pouvait lire la valeur sans son etat, et il ne le peut plus

Ferme le 6 aout 2026, avant toute collecte, parce que l'ordre importe.
`getExitScenarios` lisait `lireSortieDeReference(classe)?.base` et jetait
l'etat ; la reserve affichee dans la note venait d'un second appel
independant, qui ne tenait que parce que quelqu'un y avait pense. Une
regle portee par la memoire de celui qui l'applique ne tient pas.

La lecture de production rend desormais la valeur et son etat dans le
meme objet, et le compilateur refuse un acces au nombre seul : le
changement de type a fait rougir le seul lecteur restant, ce qui est la
demonstration que la porte etait ouverte. L'etat remonte jusqu'au motif
de la garde, qui nomme la nature du socle employe. L'entree brute reste
exportee pour les inventaires, et un balayage de 152 fichiers de
production refuse qu'un moteur l'appelle, en prouvant qu'il voit la faute
quand on la lui presente.

Sans cette fermeture, cinq classes mesurees auraient rendu les seize
autres plus credibles qu'elles ne sont, par simple voisinage dans la meme
table.

### Un abonnement Dealroom ou PitchBook : decision de Steve, pas chantier

Ce qu'il achete : cinq classes sur vingt et une, sous reserve que le
fournisseur publie bien une mediane par secteur et pas seulement
l'agregat qu'il diffuse gratuitement, ce qui se verifie avant
l'engagement et non apres.

Ce qu'il n'achete pas. Rien pour les six classes qui n'existent comme
categorie chez personne. Rien de directement utilisable pour les six
classes trop peu peuplees, dont le traitement est un arbitrage sur la
fenetre ou la geographie et non une collecte : une mediane europeenne sur
dix ans n'est pas la meme grandeur qu'une mediane europeenne sur trois.
Et pas la correspondance de taxonomie, qui reste a etablir et a dater
entre le decoupage sectoriel du fournisseur et nos vingt et une classes,
sur le modele de celle qui joint deja ces classes aux sept seaux de
comparables.

Ce qu'il faut pour chaque ligne : la statistique exacte, mediane ou
moyenne et de quoi, le perimetre geographique, la fenetre temporelle, la
taille de l'echantillon, **la devise**, et une URL ou une reference
opposable. Ici la valeur bougera, contrairement aux autres tables : il
n'y a rien a confirmer, tout a mesurer.

Pourquoi en premier : cette valeur decide seule de la sortie de domaine
de la VC inverse, c'est-a-dire de la seule methode qui donne un prix
pre-money sur un dossier sans revenus. Vingt et un nombres pour
debloquer le moteur qui donne le prix.

Deux manques structurels a trancher en meme temps, et ils ne sont pas de
la collecte. Aucune dimension de stade : une sortie vaut le meme montant
en seed et en series-C. Aucune geographie : une sortie mediane
europeenne et une americaine different d'un facteur que ces nombres
ignorent, sur un produit vendu a des fonds europeens.

### 2. `lib/data/sector-benchmarks.ts` — 72 cellules sur 84

Quatre-vingt-six pour cent des cellules portent `asOf: 2024`, aucune
2026. Douze sont deja en 2025 et peuvent attendre.

L'ordre a l'interieur de la table est donne par la confiance : dix-sept
cellules sont en `low`, et ce sont des classes entieres. `defense`,
`ai-generative` et `sportstech` le sont sur leurs quatre stades ;
s'ajoutent `deeptech` en seed et series-A, `industrial-hardware` en
seed, `profitable-mature` en seed et series-A.

`ai-generative` passe avant tout le reste : c'est la classe vers
laquelle l'arbitrage route tous les dossiers IA, et elle n'a pas une
cellule au-dessus de basse.

Ce qu'il faut par cellule : le multiple (min, central, max), le type
(ARR, revenu, EBITDA), la source, le millesime, et la taille de
l'echantillon quand elle existe.

### 3. `lib/data/indicator-benchmarks.ts` — 84 cellules, dont 57 muettes

Quatre-vingt-dix pour cent en 2024. Surtout, **cinquante-sept cellules
sur quatre-vingt-quatre ne declarent aucune confiance du tout**, vingt-
trois sont basses, quatre moyennes, zero haute.

Le premier geste n'est donc pas de collecter mais de declarer : une
cellule sans confiance se lit comme une cellule fiable, et il y en a
deux sur trois. Declarer d'abord, collecter ensuite.

### 4. `lib/data/verified-comparables.ts` — classe par classe

**La ligne qui decide, et il n'y en a pas d'autre : la table est riche
la ou le corpus ne va pas.** Trente fiches deeptech pour zero dossier,
quinze marketplace pour zero, seize fintech pour un, pendant que
`ecommerce-dtc` porte vingt-huit pour cent du corpus avec cinq fiches.
La collecte se trie sur ce croisement et sur aucun autre critere.

L'arbitrage de taxonomie est rendu depuis le 5 aout : correspondance des
vingt et une classes vers les sept seaux, pas d'elargissement. La
collecte enrichit donc les seaux existants, et une classe qui emprunte
le seau d'une voisine profite de tout ce qu'on y ajoute.

| classe | notes du corpus | fiches | cible | pourquoi |
|---|---|---|---|---|
| `ecommerce-dtc` | 15 (28 %) | 5 | 15 | premier du corpus, cinq fiches, dont deux echecs |
| `industrial-hardware` | 11 (21 %) | 6 | 12 | second du corpus |
| `hospitality` | 2 | 0 | 5 | vide et rencontree |
| `healthtech` | 2 | 1 | 8 | la seule fiche est Olive AI, un echec |
| `edtech` | 2 | 1 | 6 | Pluralsight seul |
| `logistics` | 2 | 2 | 6 | |
| `defense` | 1 | 0 | 5 | vide et rencontree, classe en croissance |
| `services-b2b` | 1 | 0 | 5 | vide et rencontree |
| `climate-tech` | 1 | 2 | 6 | |
| `mediatech` | 1 | 3 | 5 | |
| `saas-b2b` | 9 (17 %) | 22 | 22 | deja couverte, ne rien faire |
| `ai-generative` | 1 | 14 | 14 | deja couverte |
| `fintech` | 1 | 16 | 16 | deja couverte |

Jamais rencontrees sur le corpus : `adtech`, `foodtech`,
`profitable-mature`, `sportstech`, `proptech`, `cybersecurity`,
`deeptech`, `marketplace-b2c`. **Ne rien collecter pour elles.** Les
quatre dernieres sont pourtant les mieux fournies de la base, ce qui est
exactement le desequilibre a ne pas aggraver. `proptech` en particulier
n'apparait sur aucun dossier, donc WeWork comme unique comparable ne
coute rien aujourd'hui.

**Ce qu'une fiche doit porter pour etre utilisable par le moteur.** Sept
champs, tous obligatoires, et la fiche est refusee si l'un manque.

`name` : le nom exact de la societe, tel qu'elle s'ecrit elle-meme.

`founded` : l'annee de fondation, en nombre.

`sectorAssetClass` : la nature du business et le modele economique en
clair, en une ligne, par exemple « marketplace B2C / hospitality /
asset-light ». C'est ce libelle qui rattache la fiche a un seau.

`keyMilestones` : deux a quatre jalons chiffres, chacun avec sa source
entre crochets. Format conversationnel pour que le moteur puisse citer
directement. Exemple : « Series A 2010 ~7M$ [TechCrunch]. IPO NASDAQ
decembre 2020 pricing 68$/share [S-1 SEC] ». **Un jalon sans source
entre crochets ne doit pas etre ecrit.** C'est la regle qui donne sa
valeur a la base : le prompt interdit aux moteurs de citer un chiffre
absent d'ici.

`currentStatus` : l'etat aujourd'hui, en clair. Public avec son ticker,
prive, acquis par qui et quand, ou disparu et quand.

`notes` : les pieges d'hallucination connus sur cette societe. « Ne pas
confondre X avec Y », « n'a jamais fait de series C », « la valorisation
de 2021 a ete divisee par quatre en 2023 ». C'est le champ qui evite au
moteur de repeter une erreur repandue.

`outcome` : `success`, `failure`, `ongoing` ou `contested`. Il decide du
registre dans lequel le moteur cite la fiche, et il doit etre triangule
par une source primaire. Une trajectoire non concluante est `ongoing` et
non `success`.

**Regle de composition d'un seau.** Un seau utilisable ne peut pas etre
fait que de reussites : un contre-exemple nomme vaut autant qu'un
succes, et une fiche `failure` par tranche de quatre est un plancher
raisonnable. Une classe tenue par une seule fiche qui est un echec, cas
actuel de `healthtech` avec Olive AI, est pire qu'une classe vide, parce
qu'elle a l'air d'etre une reponse.

### 5. `lib/corpus/database.ts` et `extended-database.ts`

Cinquante-deux cas retrospectifs dont le plus recent date de 2023, et
quarante-cinq cas etendus dont trente portent un montant date 2024.

Ce n'est pas une urgence : le corpus retrospectif est retrospectif par
conception, et un cas de 2012 garde sa valeur pedagogique. Ce qui
vieillit est l'absence de cas recents, donc l'incapacite a reconnaitre
un motif apparu depuis trois ans.

### Ce qui ne se collecte pas

Les six modules macro — valuations-by-stage, exits-trajectories,
geographic, power-law, macro-context, ai-vs-non-ai — ont chacun un seul
commit et datent du 1er mai 2026. Ils portent des constantes de marche
qui vieillissent par trimestre. Les remettre a jour a la main reconduit
le probleme au trimestre suivant ; c'est la couche sectorielle
automatique qui doit les couvrir, pas une passe de collecte.

---

## `seller` fait entrer et sortir une personne physique selon le tirage

Ouvert le 3 aout 2026.

Le champ `seller` du bloc `fundraise` doit porter l'entite qui cede sur
une cession ou un LBO : un groupe cote qui se separe d'une filiale, un
industriel qui cede une activite, un fonds sponsor en sortie. Sur le
tirage de stabilite, il rend tantot cette entite, tantot le nom d'une
cofondatrice de la societe. Le libelle change d'un run a l'autre sur le
meme document.

Aucun calcul n'en depend. Le champ a un seul consommateur, la ligne
« Cedant » du tableau d'operation de la note d'instruction
(`app/components/InvestmentNoteView.tsx`), et rien d'autre ne le lit. La
garde post-parse le vide quand aucune composante d'operation n'est
etablie, ce qui couvre le cas de la levee pure, et ne fait rien au-dela.

Ce qui en fait une dette et non une imprecision : le champ imprime un
nom de personne physique dans un document vendu a des fonds
institutionnels. Une note qui designe une cofondatrice comme cedante
d'une operation ou elle ne cede rien est fausse sur une personne
nommee, ce qui n'est pas du meme ordre qu'un chiffre approximatif. Elle
est fausse a l'endroit ou le lecteur ne verifie pas, puisqu'un nom
propre porte sa propre autorite. Et elle est instable, donc deux
lectures du meme dossier peuvent la contredire.

Le risque est editorial et il est asymetrique. Un partner qui remarque
l'erreur remet en cause la lecture entiere ; un partner qui ne la
remarque pas la transmet.

La sortie n'est pas cosmetique. Le champ n'a ni citation ni garde,
comme `amount` et `valuation` avant le 3 aout, et la reparation est la
meme forme : `sellerEvidence` obligatoire, refus sans citation, et une
regle de prompt qui dit qu'un cedant est une entite distincte de la
societe, ce que le libelle actuel suppose sans l'ecrire. Le contrat des
composantes d'operation donne d'ailleurs un meilleur ancrage que le
champ libre : la composante `cession` porte deja sa citation et son
perimetre, et le cedant se lit dans cette citation ou nulle part.

Pas ferme aujourd'hui parce que la brique appartient au meme chantier
que la stabilite des composantes d'operation, qui est en cours de
mesure, et qu'il vaut mieux poser la garde une fois sur un contrat
arrete que deux fois sur un contrat qui bouge.

---

## Le declenchement du moteur tech repose sur la formulation de l'extraction

Ouvert le 3 aout 2026.

`analyzeTechClaimCoherence` decide de s'appliquer ou non en cherchant
des mots-cles dans un texte qui n'est pas le document. Le texte scanne
est la concatenation de `companyName`, `productDescription`,
`businessModel`, `marketPitch` et `rawSummary`, c'est-a-dire cinq champs
que le moteur d'extraction a rediges, en francais, par synthese.

La consequence est que l'activation d'un moteur depend du vocabulaire
qu'un modele a choisi pour resumer, et non de ce que le dossier
revendique. « Algorithme proprietaire » declenche ; « algorithme
proprietaire » remplace par « moteur d'analyse developpe en interne »,
qui dit la meme chose, ne declenche pas.

Ce qui rend la dette serieuse est le croisement avec la mesure de
stabilite du meme jour. Les champs de l'extraction qui varient d'un
tirage a l'autre sont exactement les champs de synthese, la ou les
champs de copie sont stables caractere pour caractere. Le declencheur du
moteur tech est donc pose sur le canal le moins stable de l'extraction,
et une section entiere de la note peut apparaitre ou disparaitre pour
une raison qui n'est pas dans le dossier.

Mesure disponible, et elle ne condamne pas le moteur : sur les quatre
runs de `Project Woodpecker` qui portent une extraction, du 8 juin au
3 aout, le declenchement est stable et le mot trouve est le meme,
« algorithme proprietaire ». Sur vingt-huit dossiers distincts, quatre
declenchent. Rien n'etablit donc un defaut constate ; ce qui est etabli
est une dependance a un canal dont on sait par ailleurs qu'il bouge.

### Ce qui manque pour trancher, et ce qu'il faudrait pour l'obtenir

La mesure directe n'existe pas. `scripts/engine-stability.ts` suit dix
champs de l'extraction, tous factuels, et aucun des cinq champs de
synthese sur lesquels le declencheur travaille. On sait donc que les
champs de synthese sont la famille qui derive, on ne sait pas de combien,
et on ne sait rien du tout de la frequence a laquelle cette derive fait
basculer une activation.

Ce qu'il faudrait, en quatre points, aucun n'etant fait aujourd'hui.

**Observer le verdict et non la prose.** Comparer les
`productDescription` de N passes ne repond pas a la question : deux
formulations differentes qui declenchent toutes deux comptent comme une
divergence alors qu'elles ne changent rien. La grandeur qui agit est le
booleen de declenchement et l'ensemble des mots-cles trouves. Le script
doit donc suivre `moatClaimDetected.detected`, la liste des mots trouves,
et `budgetAllocationDetected.detected`, en lecture derivee, comme il le
fait deja pour les composantes d'operation. Sans quoi la mesure retombe
dans la confusion entre le canal visible et le canal muet.

**Entrer par la porte de la production.** `detectMoatClaim` et
`detectBudgetAllocation` ne sont pas exportees. Il faut les exporter et
que le script les appelle, jamais recopier leur balayage de mots-cles :
une copie mesurerait son accord avec elle-meme et resterait verte le jour
ou la liste de mots-cles du moteur changerait.

**Choisir un dossier a la limite, et le choisir par une mesure et non
par intuition.** Woodpecker declenche quatre fois sur quatre : il est
loin du seuil, et vingt passes de plus n'y apprendraient rien. Le dossier
utile est celui dont la synthese frole le declenchement. Ce reperage se
fait hors ligne et sans appel au modele, sur les vingt-huit extractions
deja persistees : passer chacune dans le detecteur, et retenir celles qui
ne declenchent pas mais dont la prose porte un vocabulaire voisin d'un
mot-cle de la liste. C'est la premiere chose a faire, elle est gratuite,
et elle conditionne le reste.

**Prevoir le bon nombre de passes.** L'evenement mesure est binaire, et
il n'y a pas de grandeur continue sous-jacente dont le seuil serait
connu, comme la duree l'etait pour le depassement de fenetre. La
substitution qui a permis de conclure en trois tirages sur la fenetre
n'est donc pas disponible ici, et il faut l'ordre de grandeur au-dessus :
vingt a trente passes en serie sur le dossier retenu. Le cout est
modere, une extraction de ce format tourne en une minute pour quelques
dizaines de centimes, soit une trentaine de minutes et quelques euros.
C'est le prix a annoncer avant de lancer, pas apres.

La mesure reste inutile si elle sert a decider s'il faut allonger la
liste de mots-cles. Elle sert a decider si le declencheur doit quitter la
prose, ce qui est la sortie decrite ci-dessous.

La sortie probable n'est pas d'allonger la liste de mots-cles, qui
deplacerait le seuil sans changer sa nature. Elle est de faire declarer
la revendication technologique par le contrat d'extraction, avec sa
citation, comme le type d'operation et le montant : un champ que le
modele remplit en lisant le document, et non un mot que le pipeline
cherche dans une prose que le modele a ecrite.

Note de correction : cette entree a d'abord ete formulee comme un defaut
de langue, un moteur qui ne se declencherait pas sur un memorandum en
anglais. C'etait faux, et faux d'une facon precise : le declencheur ne
lit jamais le document, il lit la synthese francaise que l'extraction en
a faite, donc la langue du document ne l'atteint pas. `Project
Woodpecker`, memorandum en anglais, declenche sur les quatre runs. La
lecture du code a change la nature du defaut, pas seulement sa taille.

---

## Une annee nue reste candidate a la lecture d'un montant

Ouvert le 3 aout 2026.

`lib/engines/lecture-montant.ts` retire les jetons pris dans un fragment
de date, ce qui ferme « Dec-22a », « FY24 », « Q3 2024 » et les dates
numeriques. Une annee nue n'est pas un fragment de date : « 2024 :
4 M€ » rend deux mille vingt-quatre des lors qu'une devise figure
ailleurs dans le libelle.

Non ferme parce que la fermeture demande un arbitrage et non un
correctif. Ecarter tout nombre de quatre chiffres compris entre 1900 et
2100 fermerait ce cas et en ouvrirait un autre, celui du montant qui
tombe legitimement dans cette plage. La frequence relative des deux
n'est pas mesuree sur le corpus, et c'est cette mesure qui manque, pas
le code.

---

## Le pre-scan est desarme la ou l'arret economiserait le plus

Ouvert le 3 aout 2026.

Un seul moteur tombe au-dela de cent pages, et ce qui rend le defaut
couteux n'est pas ce nombre, c'est lequel. Le pre-scan est le triage
d'entree : six tests eliminatoires universels, plus quatre tests de fit
these quand un profil de fonds est fourni, pour deux centimes et huit
secondes. Son economie entiere repose sur l'arret precoce, sur le fait
de refuser un dossier avant de payer les trente moteurs qui suivent.
Au-dela de cent pages il ne s'execute pas, et la categorie de document
qui depasse cent pages est le memorandum de due diligence volumineux,
c'est-a-dire le dossier dont l'instruction complete coute le plus cher.
Le gating knockout est donc desarme exactement la ou l'arret
economiserait le plus, et il fonctionne sur les teasers de vingt pages
ou l'economie est la plus faible. Un moteur perdu sur trente et un
serait une perte proportionnelle ; celui-ci est une perte inversement
correlee a l'enjeu.

D'ou vient le plafond. L'API n'accepte pas le meme nombre de pages selon
le modele qui lit : six cents pour un modele a large fenetre, cent pour
un modele a deux cent mille jetons de contexte. Le depot passe par deux
modeles. `MODEL` vaut `claude-sonnet-4-6`, `FAST_MODEL` vaut
`claude-haiku-4-5-20251001`, et c'est le second qui porte le plafond de
cent pages. Le choix du modele rapide pour le pre-scan est le bon choix,
puisqu'il fonde son cout ; le plafond en est la contrepartie non prevue.

La mesure a ete faite sur l'objet et non sur son nom : en interrogeant
`getEngineFingerprints()`, trente et un moteurs portent une empreinte,
quatre appellent le modele rapide, et un seul de ces quatre envoie le
PDF plutot que du texte. C'est `lib/engines/prescan-engine.ts:296`, qui
passe `pitchDeckBase64` a `callClaudeWithPDF` avec `FAST_MODEL`. Les
autres appels PDF, extraction, extraction financiere, metriques SaaS,
metriques industrielles, contractuel, passent tous par `MODEL` et
tiennent jusqu'a six cents pages. Le moteur perdu est donc un et il est
nomme, ce qui vaut mieux que la proportion.

Ce qui est deja fait, et pourquoi cela ne suffit pas. Le defaut ne
provoque plus de silence : `runPreScan` attrape l'erreur et rend un
pre-scan non produit, et `motifIncident` reconnait la forme
`maximum of N PDF pages` pour ecrire « Document au-dela de la limite de
cent pages acceptee par le modele ». Le partner lit donc pourquoi le
triage manque. Il le lit apres coup, apres avoir paye l'appel, et rien
en amont ne le lui epargne : aucun code du depot ne compte les pages
d'un PDF. Le releve est net, ni `numPages`, ni `page_count`, ni
`pdf-lib`, ni `pdfjs` n'apparaissent dans `lib/`, `app/` et `scripts/`.
La seule grandeur que le depot lit d'un PDF est sa taille en octets,
dans `fenetreSelonTaille`, qui regle un delai d'attente et ne borne rien.

Non ferme parce que les trois sorties coutent chacune quelque chose et
qu'aucune n'est evidemment la bonne. Faire tourner le pre-scan sur
`MODEL` supprime le plafond et supprime aussi la raison d'etre du
moteur, qui est de trier a cinq fois moins cher que le pipeline qu'il
protege. Decouper le document et n'envoyer que les cent premieres pages
change ce que le moteur juge sans le dire : un test eliminatoire rendu
sur un extrait n'est pas le meme test, et il faudrait qu'il le declare.
Compter les pages en amont pour choisir le modele selon la taille est le
plus honnete et introduit une dependance de lecture de PDF que le depot
n'a pas, plus un arbitrage de cout qui n'est pas le mien a rendre.

Ce qui manque pour trancher est un chiffre : la part des dossiers du
corpus qui depasse cent pages. Elle n'est pas mesuree, et elle se mesure
sans lancer un seul run.

---

## La regle de divergence n'a jamais ete exercee sur des donnees reelles

Ouvert le 3 aout 2026. Dette de couverture, pas de correction.

La regle est celle de `determineConfidence` : au-dela d'un rapport de
cinq entre les points centraux des fourchettes consolidees, la confiance
ne peut plus etre haute, au-dela de dix elle tombe a faible, et la
divergence se declare en avertissement. Elle est couverte par ses tests
et par eux seuls. Le rejeu du run de gel `b299ab62` sur le moteur
corrige ne l'exerce pas, et l'echec est structurel plutot
qu'accidentel : la garde de domaine retire la fourchette pre-money avant
que la divergence ait deux points centraux a comparer. Le rapport vaut
donc un, la regle ne se declenche pas, et la seule chose qu'on puisse
dire du couple d'origine est un calcul sur des nombres perimes,
216 765 648 sur 6 574 097, soit trente-trois. C'est une arithmetique sur
l'ancienne sortie, pas un chemin parcouru par le code actuel.

Le profil de dossier qui l'exercerait a ete mesure en balayant
`computeValuation` elle-meme, et non en rejouant sa regle dans un script
a cote. Sur `saas-b2b` au stade series-a, avec un ticket de dix millions
et la table de sorties actuelle :

- rapport superieur a dix, donc confiance ramenee a faible : chiffre
  d'affaires du millesime retenu entre 4,2 et 5,0 M EUR ;
- rapport entre cinq et dix, donc plafond ramene a moyen : entre 2,1 et
  4,1 M EUR.

A 4,2 M EUR de chiffre d'affaires la valeur d'entreprise centrale vaut
67,0 M et la pre-money 6,6 M, soit un rapport de 10,2. A 5,0 M EUR,
79,8 M contre 6,6 M, rapport 12,1.

Deux choses rendent cette bande etroite, et elles se lisent dans les
chiffres. D'abord son plafond n'est pas une propriete de la regle, c'est
la garde de domaine : au-dela de 5,0 M EUR la valeur d'entreprise
depasse la sortie mediane de 80 M et la VC inverse sort, donc la
divergence n'a plus rien a comparer. Ensuite le plancher depend du
ticket et pas du dossier : la VC inverse ignore le chiffre d'affaires,
sa pre-money vaut la sortie mediane ramenee par le multiple cible moins
le ticket, donc c'est la taille du ticket qui creuse l'ecart. Avec un
ticket de trois millions au lieu de dix, la meme table ne produit aucune
bande a dix : le maximum atteint est 5,9 sur le meme dossier a 5,0 M EUR.

Mais lire cette etroitesse comme un partage de terrain entre deux gardes
adjacentes serait une erreur, et c'est celle qu'une premiere version de
cette entree a commise. Les deux gardes ne se partagent pas un terrain,
elles se relaient selon la classe d'actif. La bande etroite est une
propriete de `saas-b2b`, ou les multiples sectoriels sont eleves et la
sortie mediane basse, donc ou la garde de taille couvre presque tout.
Sur une classe dont les multiples sont plus bas, la valeur d'entreprise
ne depasse plus la sortie mediane, la garde de taille ne se declenche
jamais, et la regle de divergence devient le seul controle.

La mesure le montre sur le meme document. L'extraction du run de gel,
passee dans `computeValuation` en forcant la classe, rend en `saas-b2b`
une valeur d'entreprise centrale de 215,2 M, la garde de taille tombe,
aucune dilution n'est produite. En `industrial-hardware` elle rend
36,9 M, la sortie mediane de la classe est au-dessus, la garde ne se
declenche pas, la VC inverse reste applicable avec une pre-money de
4,5 M, et la dilution centrale ressort a soixante-neuf pour cent. Sur
cette branche la divergence vaut 8,2, l'avertissement est emis et la
confiance est ramenee de haute a moyenne. Le meme dossier, selon sa
classe, tombe dans le domaine de l'une ou de l'autre.

La regle de divergence n'est donc pas une garde qui ne se declenchera
jamais, et la question ouverte plus bas trouve la sa reponse : elle
couvre exactement la branche ou la garde de taille est aveugle. Ce qui
reste vrai est qu'elle n'a pas ete vue s'exercer en production, et
qu'un seuil dont on connait le code et pas l'effet reste a verifier.

Ce qu'il faut noter, et qui limite ce soulagement : a 8,2 la divergence
declare et plafonne, elle n'empeche pas la dilution de soixante-neuf
pour cent de s'imprimer. Elle informe le lecteur, elle ne le protege
pas. Le veritable amont de ce chiffre n'est ni la VC inverse ni la
divergence, c'est l'instabilite de l'arbitrage de classe d'actif, qui a
sa propre entree.

Le profil a chercher au depot est donc precis : dossier logiciel B2B au
stade series-a, chiffre d'affaires du dernier exercice realise entre
quatre et cinq millions d'euros, ticket demande de l'ordre de dix
millions. Un dossier de ce profil ferme cette entree en un run, et il
ferme aussi la question de l'affichage, puisqu'il est le seul cas ou la
note doit imprimer a la fois deux fourchettes de natures differentes,
l'avertissement de divergence et une confiance basse.

Non ferme parce que rien ne se corrige : le code fait ce qu'on lui
demande, et ce qui manque est un dossier, pas une ligne. La bande sera
d'ailleurs a remesurer le jour ou la table des sorties ou celle des
multiples bouge, puisque ses deux bornes en descendent.

Ce qui reste a mesurer, et qui se mesure sans lancer un run : la
distribution du chiffre d'affaires, du ticket et de la classe sur les
analyses persistees, qui dirait combien de dossiers deja instruits
seraient tombes dans le domaine de la regle. La question n'est plus de
savoir si la regle sert, la mesure de la classe y a repondu ; elle est
de savoir a quelle frequence, ce qui decide s'il faut la calibrer plutot
que de la laisser en l'etat.

---

## La reserve de validite parait ou disparait selon le tirage et le parcours

Ouvert le 4 aout 2026. C'est l'entree qui interdit le gel.

Le meme document, analyse deux fois a dix-sept heures d'intervalle,
porte une reserve de validite d'operation sur le premier run et aucune
sur le second. Un partner qui lit le second y lit qu'aucun evenement
posterieur n'a ete releve. Ce n'est pas ce que le moteur sait, c'est ce
qu'il a recu.

Ce qui alimente la reserve, lu dans la route et non suppose :
`detecterEvenementsDansLaProse` est appelee sur la prose de trois
moteurs et de trois seulement, Equipe, Fragilite structurelle et
Narrative Drift (`app/api/analyze/route.ts:1678`). Le fait est ensuite
classe et le mieux fonde est cite. La chaine est bonne. Sa fragilite est
que ses trois sources sont des moteurs LLM, donc que l'existence meme du
fait depend de ce qu'ils ont choisi de citer ce jour-la.

La mesure, faite en rejouant le detecteur source par source sur les deux
resultats persistes :

- run du 3 aout, parcours early stage. Equipe rend 140 lignes de prose,
  six mentions de la levee de 83 millions, trois evenements detectes.
  Fragilite rend 198 lignes, deux mentions, un evenement. Total quatre.
- run du 4 aout, parcours growth. Equipe rend 4 lignes, c'est le talon
  d'un moteur neutralise, zero evenement. Fragilite rend 192 lignes,
  volume comparable au run precedent, et zero mention de la levee, donc
  zero evenement. Narrative Drift rend 27 lignes dans les deux cas et
  n'a jamais rien detecte.

Deux causes independantes se sont donc additionnees. Le parcours growth
neutralise le moteur Equipe, qui portait trois des quatre evenements :
c'est structurel et previsible. Et le moteur Fragilite, qui a tourne
normalement avec un volume de prose equivalent, n'a pas cite la levee la
seconde fois : c'est de la variance de tirage sur le choix des faits
externes, a code constant pour ce moteur, ce que le diff entre les deux
commits confirme puisqu'il ne touche ni Fragilite ni la couche web. Une
seule des deux causes aurait laisse au moins un evenement. Les deux
ensemble ont rendu zero.

Pourquoi c'est plus grave que ce que la formulation laisse croire. Le
parcours growth est celui des memorandums de cession et de LBO,
c'est-a-dire exactement les operations les plus susceptibles d'avoir ete
depassees par un evenement posterieur, puisque leur document circule
pendant des mois. La reserve est donc affaiblie sur le parcours ou elle
protegerait le plus, ce qui est la meme forme que le plafond de cent
pages du pre-scan : un controle desarme la ou son enjeu est maximal.

Ce n'est pas un defaut du correctif de classement des faits, et il faut
l'ecrire pour ne pas le chercher au mauvais endroit. Rejoue sur les
donnees reelles du run du 3 aout, le moteur corrige range la levee en
`prose-datee` et le jugement du moteur Equipe en `jugement-de-moteur`,
cite le premier, nomme ses deux sources et place la provenance en fin de
paragraphe. Il fait exactement ce qu'on lui demande. Il n'a simplement
jamais eu l'occasion de le faire en production.

Deux corrections ont ete apportees le 4 aout, et ce qui reste ouvert est
nomme apres elles. La collecte ne nomme plus de moteurs : elle retient
ceux dont la prose porte une citation de source externe, ce qui est une
propriete des donnees et non un nom, donc un critere qui se deplace avec
le pipeline. Exercee sur le run growth persiste, elle lit six moteurs la
ou l'ancienne liste en lisait un et demi. Et le verdict distingue
desormais `aucune-reserve`, qui suppose des sources lues, de
`non-instruit`, qui declare qu'aucune ne l'a ete ; le motif du premier
nomme les moteurs consultes, de sorte qu'une affirmation d'absence porte
toujours sa borne.

Ce qui reste ouvert est le vice de conception, que ces deux corrections
ne touchent pas. Faire dependre une reserve de la citation spontanee
d'un moteur de jugement reste fragile : le 4 aout, le moteur Fragilite
a tourne normalement, avec un volume de prose equivalent au run
precedent, et n'a pas cite la levee une seule fois. Aucune borne de
collecte ne rattrape cela. Il faudrait une source de faits qui ne soit
pas un sous-produit d'une analyse, c'est-a-dire une recherche
d'evenements posterieurs conduite pour elle-meme, avec sa propre requete
et son propre budget. Le cout est un appel de plus par dossier, et c'est
un arbitrage a rendre.

---

## Motif : un controle affaibli la ou son enjeu est maximal

Ouvert le 4 aout 2026. Ce n'est pas une dette, c'est la forme commune de
deux d'entre elles, ecrite pour qu'on la reconnaisse la prochaine fois.

Deux entrees de ce registre ont la meme structure, et elle n'est pas
celle qu'on cherche d'ordinaire. Un controle n'est pas absent, il n'est
pas faux, il ne se declenche pas au hasard : il est correlativement
affaibli avec l'enjeu qu'il protege. Le pre-scan tombe au-dela de cent
pages, donc il trie les teasers de vingt pages ou l'economie de l'arret
precoce est la plus faible, et disparait sur les memorandums de due
diligence ou elle serait la plus forte. La reserve de validite se
nourrit de moteurs que le parcours growth neutralise, donc elle protege
les levees early stage, dont le document circule peu, et s'affaiblit sur
les cessions et les LBO, dont le document circule des mois et qui sont
les seules operations qu'un evenement posterieur peut annuler.

Ce qui rend le motif difficile a voir est que chaque cas se justifie
localement. Le modele rapide fonde le cout du pre-scan. Le parcours
growth allege un pipeline pour des dossiers ou quatre moteurs early
stage n'ont pas d'objet. Aucune des deux decisions n'est fautive, et
c'est leur croisement avec un enjeu qui l'est. Une revue de code ne le
trouve pas, parce qu'il n'existe dans aucun fichier ; il n'apparait
qu'en posant, pour chaque controle, la question de savoir sur quelle
population il ne s'applique pas et si cette population est la plus
exposee.

La recherche d'une troisieme occurrence a ete conduite et n'a rien rendu
de solide, ce qui se declare plutot que se tait. Le soupcon portait sur
les verifications de reference, alimentees par trois moteurs que le
growth neutralise ; la mesure sur les deux runs persistes rend trois
fiches fondateurs de part et d'autre et seize fiches clients sur growth
contre six sur early, donc la sortie ne se degrade pas. Le releve est
mince, un dossier et deux runs, et il ne borne rien au-dela de ce cas.

La question a poser aux controles restants est ecrite ici pour la
prochaine fois : sur quels dossiers ce controle ne s'applique-t-il pas,
et ces dossiers sont-ils ceux ou il servirait le plus. Quand la reponse
est oui, l'affaiblissement doit etre declare dans la note plutot que
subi, ce qui est exactement ce que le verdict `non-instruit` fait pour
la validite d'operation.

---

## Chantier : recalibrer les quatre moteurs early stage pour le growth

Ouvert le 4 aout 2026. Chantier chiffre, pas defaut a corriger.

Le parcours growth neutralise quatre moteurs, et le code dit pourquoi
sans detour : « Moteur Equipe : skip en parcours growth, calibre early
stage », et les trois mots identiques pour Pattern Matching, Aveuglement
et Retournement causal. Aucun de ces commentaires n'affirme que la
dimension compte moins sur une cession ou un LBO. Tous disent que le
moteur est calibre ailleurs. L'exclusion est donc faute de moteur
adapte, et non par doctrine, ce qui est exactement la distinction qui
decide ou porte le correctif.

Le sens commercial va d'ailleurs a rebours de l'exclusion. Un sponsor de
LBO parie sur la continuite du management ; la qualite de l'equipe
fondatrice y pese au moins autant qu'en levee, souvent davantage, parce
que le fonds sortant part et que celui qui entre achete une equipe en
place. Exclure Equipe du growth revient a retirer du calcul la dimension
qui porte le risque principal de l'operation la plus risquee.

Ce que l'exclusion coute aujourd'hui, mesure et non estime. Le parcours
growth exclut Equipe (poids 0,20) et Vigilance critique (0,15), donc il
tourne par construction a soixante-cinq pour cent du poids. A cette
assiette, la garde de comparabilite etablit qu'aucun verdict des bandes
centrales ne se compare a un verdict early stage, puisque le
deplacement possible, 8,75 points, depasse la demi-bande de 7,5. Toute
note growth porte donc desormais la reserve de non-comparabilite. C'est
la bonne reponse en attendant, et c'est aussi la mesure de ce que le
chantier vaut : il rend au parcours growth la capacite de conclure.

**Ordre par enjeu, et cout par moteur.**

Equipe d'abord. C'est le poids le plus lourd des deux exclues, 0,20,
c'est la dimension dont l'absence a fait basculer le verdict du dossier
du 4 aout, et c'est la seule des quatre qui consulte des sources
externes, donc la seule dont l'absence prive aussi la reserve de
validite d'operation de sa principale source de faits. La recalibrer
resout deux entrees de ce registre a la fois. Cout : une demi-journee de
doctrine pour reecrire les criteres en termes de management en place
plutot que de fondateurs en amorcage, plus une passe de calibration sur
dossiers de reference growth, dont le corpus ne porte aujourd'hui que
trois memorandums de cession ou de LBO. Le budget du moteur est deja
pose, fenetre de 180 secondes et une recherche web autorisee.

Vigilance critique ensuite, poids 0,15. Elle complete l'assiette a cent
pour cent avec Equipe, ce qui suffit a retirer la reserve de
comparabilite sans toucher aux deux autres moteurs. Sa calibration porte
sur la lecture du discours fondateur, qui n'a pas d'equivalent direct
dans un memorandum de banque d'affaires ; c'est le moteur dont la
transposition demande le plus de doctrine nouvelle et le moins de
technique. Cout : une journee, dont l'essentiel en ecriture de fiche.

Pattern Matching et Retournement causal ne pesent pas dans le score
mecanique et viennent donc apres, malgre leur valeur editoriale. Leur
absence appauvrit la note sans deplacer le verdict, ce qui les met hors
du chemin critique. Cout indicatif : une demi-journee chacun, la
difficulte etant de reecrire les archetypes early en archetypes de
sortie.

**Ce qui se fait avant tout code.** Le corpus growth est trop mince pour
calibrer quoi que ce soit : trois memorandums, dont deux du meme
dossier. Rassembler une dizaine de documents de cession et de LBO est le
prealable, et il ne coute pas de developpement. Calibrer sur trois
dossiers reproduirait la faute que ce registre documente ailleurs, un
instrument regle sur le cas qui l'a revele.

---

## Chantier : la relation de corpus, et l'arbitrage a rendre avant de l'ecrire

Ouvert le 5 aout 2026. Arbitrage a trancher, pas defaut a corriger. Rien
n'est ecrit et rien ne doit l'etre avant que la question ci-dessous soit
tranchee, parce qu'elle decide de la forme du code et non de son detail.

Le catalogue de `lib/controle/proprietes.ts` sait dire d'une note si elle
respecte une regle. Il ne sait rien dire de deux notes prises ensemble.
La distinction n'est pas une lacune d'implementation : une propriete
recoit une note et rien d'autre, et cette cloture est la condition qui
permet au bulletin de fiabilite de l'appliquer a une note fraiche, au
moment ou elle est produite, la ou le corpus n'existe pas encore.

Le releve du 5 aout a etabli la frontiere par un echec. La garde de
confidentialite, ecrite comme propriete de note, rend sept notes touchees
et sept faux positifs : deux sur « Project Manager » et « Project
Engineer », qui sont des intitules de poste, quatre sur leur propre nom
de code sous une forme que le fichier source n'ecrit pas, « Projet
Pegasus » pour un fichier nomme Pegasus. Cent pour cent, sur une
propriete qu'on aurait juree fondee.

**Ce que l'echec apprend, et qui vaut d'etre garde tel quel.** Le motif
ne se repare pas en l'affinant. Distinguer un nom de code d'un mot
commun demande de savoir quels noms appartiennent aux autres dossiers, et
cette information n'existe qu'a un seul endroit. Les noms de code ne
s'ecrivent pas, ils se derivent des `companyName` de toutes les autres
analyses du corpus. C'est ce qui retire le motif au lieu de le deplacer :
une liste ecrite a la main aurait ete la faute que ce registre documente
partout ailleurs, tandis qu'une derivation se recalcule a chaque passage
et fait entrer un dossier ingere demain sans qu'on y pense.

**Ce que la relation couvrirait au-dela des noms de dossier.** La fuite
de confidentialite est le cas d'entree et le seul qui menace directement
une vente : un nom de code, un nom de client, un montant de levee ou un
nom de fondateur d'un dossier apparaissant dans la note d'un autre. La
meme signature repond a quatre autres questions que rien ne pose
aujourd'hui. La variance a code egal, qui est un rapport entre deux runs
du meme dossier au meme `enginesHash` et jamais une propriete d'un run.
Le doublon d'ingestion, le meme deck entre deux fois sous deux noms de
fichier, qui fausse tout denominateur du releve sans que rien ne le
signale. La reutilisation de prose, un paragraphe identique entre deux
dossiers sans rapport, signature d'un repli ou d'un gabarit et non d'une
analyse. Et la derive de calibration, la distribution des verdicts par
segment d'empreinte, qu'aucune lecture note a note ne peut voir puisque
chaque note prise seule est plausible.

**L'arbitrage, avec le cout des deux voies. Il n'est pas tranche.**

Premiere voie, la relation reste interne et le bulletin ne la voit pas.
Le controleur de corpus l'execute hors ligne, sans cout et sans reseau,
et la note livree au fonds ne porte rien de ce que la relation constate.
Ce que cela coute est doctrinal et c'est le plus cher des deux : le
catalogue cesse d'avoir un seul consommateur. Le partage entre le
controleur et le bulletin etait le garde-fou qui empechait le controle
interne et le controle client de diverger, et celui que le client lit
d'etre le moins tenu des deux. Une famille de controles qui n'existe que
du cote interne rouvre exactement cet ecart, et elle le rouvre sur la
famille dont l'enjeu commercial est le plus direct, puisqu'une fuite de
confidentialite se decouvre chez le fonds ou nulle part.

Seconde voie, le bulletin lit le corpus au moment de la production. La
note fraiche est confrontee aux autres analyses avant d'etre rendue, et
le controle que le client lit couvre alors la meme surface que le
controle interne. Ce que cela coute est architectural : un acces Supabase
entre dans le chemin de production d'une note, la ou il n'y en a pas
aujourd'hui. Le pipeline gagne une dependance reseau sur un chemin qui
n'en avait pas, une latence sur la derniere etape, et un mode de panne
nouveau, celui ou la base repond mal et ou il faut decider si la note
sort quand meme. Ce dernier point est le vrai sujet : un controle qui
peut echouer silencieusement en production est precisement la garde
inerte que ce registre documente ailleurs.

Les deux voies sont tenables et le choix ne se deduit pas. Il se tranche.

**Le vocabulaire se tranche avant la premiere ligne.** Une propriete rend
un nombre de notes sur une portee. Une relation rend des paires, et une
paire fautive touche deux notes dont une seule est en cause. Le mot
« touche » ne s'y applique donc pas, et le taux qu'une relation rendrait
n'a pas le meme denominateur que ceux du tableau de proprietes. Ecrire la
premiere relation sans avoir tranche ce point produirait un chiffre qu'on
lirait comme les autres alors qu'il ne dit pas la meme chose, ce qui est
la faute que le dispositif entier a ete construit pour empecher.

**Cout algorithmique, pour memoire, et il est le moindre des trois.**
Cinquante-deux notes font mille trois cent vingt-six paires, ce qui passe
en force brute. La comparaison portant sur de la prose, la force brute
cesse de passer vers quelques centaines de notes, et un index
d'empreintes la ramene au lineaire. Ce travail se fait une fois et ne
conditionne aucune des deux voies.

---

## Chantier : strictNullChecks, soixante erreurs et vingt-sept fichiers

Ouvert le 5 aout 2026. Chantier chiffre, pas defaut a corriger.

`tsconfig.json` porte `"strict": false`, donc `strictNullChecks` est
inactif. L'en-tete de `lib/engines/engine-roots.ts` en tire deja la
conclusion et la pose comme une contrainte de conception : « le
compilateur ne signalera jamais cette famille de defauts, la discipline
ne peut pas venir du typage, elle doit venir d'une mecanique
explicite ». Le module a ete ecrit pour cela apres l'incident c487a8b2
du 27 juillet, et il fonctionne.

Le run b8d0e9ac a montre la limite de la mecanique explicite : elle
n'empeche pas de l'oublier. `protectEngineRoots` etait appele dans le
constructeur de prompt et pas dans le calcul du score, et la synthese
s'est arretee sur `blindspotAnalysis.globalBlindspotScore` lu sur null.
Une mecanique qui depend de celui qui l'applique ne tient pas, ce que ce
depot a deja ecrit trois fois ailleurs.

La mesure, faite le jour meme et non estimee : `npx tsc --noEmit
--strictNullChecks` rend soixante erreurs sur vingt-sept fichiers, dont
six dans l'orchestrateur. Ce n'est pas une refonte, c'est une journee.
L'ordre de grandeur change la nature de la question : ce n'etait pas
« faut-il un jour passer en strict », c'etait « pourquoi pas ».

Ce que le passage achete, mesure sur le cas. Le releve des autres
deferencements de sorties amont dans l'orchestrateur a ete fait par le
compilateur sous ce drapeau plutot qu'a la main, et il a rendu une
lecture non gardee que la recherche manuelle n'avait pas trouvee, la
decote forcee de `successProbability`, cinquante lignes sous celle qui
avait leve. Un balayage a la main aurait ferme la ligne qu'on regardait.

Ce qu'il ne faut pas en attendre. Le compilateur voit les racines
declarees nullables, il ne voit rien des parametres typees `any`, et le
constructeur de prompt de l'orchestrateur les porte toutes. Passer en
strict sans typer ces signatures laisserait quinze lectures amont
invisibles. Le chantier est donc en deux temps et le second est le plus
long, activer le drapeau puis retirer les `any` des signatures qui
recoivent des sorties de moteur.

Pas ferme aujourd'hui parce qu'il touche vingt-sept fichiers a la veille
d'une demonstration, et qu'un correctif de typage large est exactement
ce qu'on ne veut pas avoir a relire en meme temps qu'un run.

---

## Chantier : le dossier de demonstration, et ce que l'anonymisation demande

Ouvert le 6 aout 2026. Le point n'avait pas ete pose et il deplace la
sequence : **toutes les analyses du corpus portent des dossiers reels de
clients, donc rien de ce qui a ete produit cette semaine n'est montrable
en l'etat.** La garde de confidentialite des prompts existe pour cette
raison exacte, un nom de client dans la note d'un autre client etant
disqualifiant devant un fonds. Ce qu'on montrerait aujourd'hui n'existe
pas.

### La question qui vient avant les trois voies

Une anonymisation se fait-elle apres coup sur une note produite, ou
demande-t-elle un mode de run. La reponse est ni l'un ni l'autre, et
c'est le releve en lecture seule du 6 aout qui l'etablit, sur le run
`5585f1c0`.

Le nom de la societe apparait 175 fois dans 18 sections de premier
niveau, dont 47 dans la fragilite structurelle et 28 dans le pattern
matching. Cette part est tractable : c'est une substitution de chaine, et
elle se ferait apres coup sans rien casser.

Ce qui ne se substitue pas est ce qui rend la note credible, et il y en a
trois couches.

Le nom n'est pas ce qui identifie. L'extraction porte un fondateur nomme,
un client nomme, un libelle de secteur qui vaut empreinte a lui seul, un
pays et une annee de fondation. Le releve le montre sur ce dossier : un
chiffre d'affaires, un secteur, une geographie et une annee de fondation
suffisent, et il s'y ajoute ici un client de premier rang cite en clair.

La capture des sources est non anonymisable par construction. Le run a
atteint 129 pages et cite 7 sources. Ces adresses nomment la vraie
societe. Les conserver identifie ; les retirer detruit precisement ce
que la semaine a construit, puisqu'une revendication de lecture que la
capture ne porte pas devient non fondee et que la note le declarerait.
Une note de demonstration sans source externe montre donc moins que le
produit ne fait.

Les verbatims le sont aussi. La doctrine veut que le verbatim soit la
cellule telle que le document l'ecrit et que la valeur en descende.
Reecrire un verbatim apres coup inverse la dependance, ce que la doctrine
nomme et interdit : le systeme fabriquerait un verbatim depuis une valeur
et ne prouverait plus rien. Les chiffres ne peuvent donc pas etre
deplaces apres coup sans casser la chaine qui les fonde. Et 125 extraits
du validateur d'assertions citent cette prose telle quelle.

**Conclusion : l'anonymisation n'est pas un post-traitement et ce n'est
pas non plus un mode de run.** Un mode existe et il est cable,
`frozen=true` coupe le web search au client par un point de passage
unique, mais il ne rend pas la note anonyme : il la rend muette sur ses
sources. L'anonymisation doit porter sur le document d'entree, avant le
run, ce qui en fait une preparation de dossier et non un chantier de
pipeline.

Le corollaire est que la troisieme voie, bien comprise, est la deuxieme
avec un squelette reel. Et c'est ce qui la rend meilleure : la coherence
des chiffres est heritee au lieu d'etre inventee.

### Ce que chaque voie coute

**L'accord ecrit d'une societe du corpus.** Cout d'ingenierie nul, c'est
une demarche. Trois couts non nuls ailleurs. Le calendrier ne nous
appartient pas, il depend du juridique d'un tiers. La note enseigne a
tout prospect ce que nous avons compris d'une societe qu'il peut
connaitre, y compris ses fragilites, ce qui est le contraire du service
rendu a celle qui a signe. Et l'accord porte sur une version : toute
evolution de la note redemande un arbitrage, ou bien la demonstration se
fige sur un etat ancien du produit.

**Un dossier fictif construit.** Cout juridique nul, risque de
credibilite non borne, et c'est le point a peser. Un memorandum se
reconnait a la coherence de ses chiffres, et nos propres moteurs sont
faits pour la mesurer : la coherence financiere, la chaine du verbatim,
le recoupement du business plan. Un dossier invente serait juge par nos
instruments avant de l'etre par un partner, et un partner qui voit une
couture cesse de croire au reste, exactement comme un ratio faux detruit
la confiance dans les ratios justes qui l'accompagnent. Le cout reel est
donc de construire un dossier qui passe nos propres controles, ce qui
n'est pas une redaction mais une modelisation.

**Une note anonymisee.** Cout le plus eleve des trois et il n'est pas la
ou on le croit : il est dans la preparation du document, pas dans le
code. Il faut retirer le nom, le fondateur, les clients cites, resserrer
le libelle de secteur, decaler la geographie et l'annee de fondation, et
deplacer les chiffres, ce dernier point cassant la chaine du verbatim
sauf si le document lui-meme est reecrit avec ses nouvelles cellules. Et
si la societe sous-jacente reste reconnaissable, il faut le meme confort
juridique que la premiere voie sans en avoir le benefice.

### Une quatrieme voie, qui n'etait pas dans la liste

Elle merite d'etre posee parce qu'elle dissout le dilemme : un dossier
reconstruit a partir des documents publics d'une societe cotee, sortie ou
liquidee. Les chiffres sont coherents parce qu'ils sont vrais, il n'y a
aucune confidentialite a proteger puisqu'ils sont publies, et la
recherche web trouve de vraies sources, donc la capture fonctionne et la
note montre le produit entier.

Le corpus etendu porte deja plusieurs de ces societes, avec leurs
trajectoires documentees. Le cout est de reconstituer un memorandum a la
date d'avant l'issue, a partir de comptes publies, ce qui est un travail
d'archive et non d'invention. Et la demonstration gagne une propriete
qu'aucune des trois autres n'a : l'issue est connue, donc la note peut
etre confrontee a ce qui est arrive.

Ce que cette voie coute en propre : le choix de la societe est un
arbitrage editorial, puisque montrer une faillite qu'on a su lire est
plus demonstratif et plus risque que montrer une reussite.

---

## Chantier : le decoupage des deux gros fichiers, et le critere de coupe

Ouvert au 2 aout 2026 pour la mesure, precise le 6 aout pour la methode.
`app/HomeClient.tsx` et `app/components/InvestmentNoteView.tsx`, environ
sept mille lignes chacun, a egalite. Le second est le fichier le plus
souvent touche du depot puisque toute evolution de la note d'instruction y
passe.

**Un decoupage sans doctrine reproduirait la structure actuelle en plus
petit.** C'est le risque principal et il n'est pas theorique : couper par
proximite visuelle, une fonction par section de la note, rendrait trente
fichiers dont chacun connait le meme objet geant et dont aucun ne peut
etre lu seul. Le nombre de lignes par fichier baisserait et rien
d'autre.

Le critere de coupe s'ecrit donc avant de couper, et la question a poser
n'est pas « ou sont les frontieres visuelles » mais **de quoi chaque
morceau a-t-il besoin pour se rendre**. Un composant qui recoit
l'analyse entiere n'a pas de frontiere ; un composant qui recoit trois
champs nommes en a une, et cette frontiere se lit dans sa signature
plutot que dans sa position.

Trois consequences de ce critere, a verifier au moment de couper.

Le decoupage se mesure a la surface d'entree et non a la taille. Un
fichier de six cents lignes qui prend quatre champs est mieux coupe qu'un
fichier de cent lignes qui prend l'objet entier.

Un morceau qui ne peut pas nommer ses entrees signale que la donnee est
mal formee et non que la coupe est mauvaise. C'est alors la sortie du
pipeline qu'il faut structurer, pas le composant qu'il faut deplacer, et
c'est le seul cas ou le decoupage doit s'arreter pour laisser passer un
autre chantier.

L'ordre suit la frequence de modification et non la taille.
`InvestmentNoteView` passe avant `HomeClient` a taille egale, parce que le
cout d'un fichier mal coupe est paye a chaque modification et que celui-la
est le plus souvent touche.

---

## Chantier : le design de la note, et ce que la semaine vient de rendre possible

Ouvert le 6 aout 2026. Rien n'est consigne sur ce que la note donne a
voir. Tout ce qui a ete ecrit porte sur la justesse de ce qu'elle
affirme, pas sur ce qu'un partner lit en premier ni dans quel ordre. La
seule regle de mise en page que le depot porte est la discipline de
provenance, qui dit que ce qui fonde une affirmation se lit apres elle et
que ce qui la limite se lit avec elle ; elle a ete ecrite pour un cas
particulier et elle vaut plus largement.

La place du bulletin de fiabilite en tete de note est aujourd'hui la
seule decision de mise en page prise, et elle l'a ete par defaut.

**Ce que la semaine vient de rendre possible, et qui n'existait pas
lundi.** La toile lira des durees reelles par moteur et des causes
structurees, la ou elle n'avait que des etats binaires. Le relevé de
statuts porte desormais, par moteur, la duree d'attente, la duree
d'execution, le nombre de tentatives, le nombre d'appels au modele, les
tokens d'entree et de sortie, le mode de parse, et un statut qui
distingue l'echec propre de la cascade, du depassement de fenetre, de
l'ecart de la matrice, de la sortie vide et desormais de l'inconnu. Le
texte fautif d'un refus de format est conserve. Les causes de
non-production distinguent la doctrine, l'incident et l'absence.

Le chantier est donc mieux place maintenant qu'il ne l'aurait ete avant :
un design fait la semaine derniere aurait affiche des voyants, et il peut
desormais afficher une chronologie et des raisons. C'est une difference
de nature et pas de finition, parce qu'un voyant demande de croire et
qu'une duree avec sa cause se verifie.
