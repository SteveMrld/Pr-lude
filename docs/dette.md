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
L'extraction rend 0,101, 0,897, 0,963 et 0,963 million. Les deux
dernieres annees tombent exactement sur la ligne B2B ; les deux
premieres ne tombent sur aucune des deux. Le releve s'arrete la : je
n'ai pas etabli d'ou viennent 0,101 et 0,897, et l'hypothese d'une
lecture partielle n'est qu'une hypothese.

Ce qui en fait le premier de ce registre est la nature de la faute, pas
son ampleur. Toutes les autres entrees decrivent une chose que le
produit ne fait pas, ou fait mal. Celle-ci decrit un nombre imprime dans
une note d'instruction que le document source ne porte pas. Un partner
qui ouvre le classeur a cote de la note ne trouve pas la ligne, et il
n'a alors aucun moyen de distinguer une erreur de lecture d'une valeur
inventee. C'est exactement le controle que fait une due diligence, il
coute une minute, et il ne laisse aucune place a l'explication : la
rigueur est le positionnement commercial entier de la plateforme.

Un facteur aggravant est mesure et il est distinct. Le convertisseur
aplatit le classeur en CSV puis coupe a 30 000 caracteres, en silence.
Le classeur Hello rend 32 710 caracteres, donc il a ete coupe, et
`bpChars` vaut exactement 30 000 dans le cachet du run. La coupe tombe
dans le tableau de financement, apres le compte de resultat : le P&L
survit, la ligne « Equity levee » a 275 000 et les positions de
tresorerie sont perdues. Un BP coupe se lit donc exactement comme un BP
complet. C'est la forme du chiffre juste sur une part qui se lit comme
un chiffre sur le tout, et elle vaut d'etre fermee meme si elle n'est
pas la cause de l'ecart ci-dessus.

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

Rien ne doit etre montre a un fonds avant que le correctif soit pose.
C'est le seul point de ce registre dont je dirais cela.

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
