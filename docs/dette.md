# Registre de dette

Ce que l'on sait faux ou fragile et que l'on n'a pas ferme, avec la
raison de ne pas l'avoir ferme. Une entree se retire quand le defaut
disparait, jamais quand on s'y habitue.

L'ordre est celui du dommage, pas celui de la date.

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

## Le pre-scan tombe a cent pages, et rien ne mesure la page

Ouvert le 3 aout 2026.

L'API n'accepte pas le meme nombre de pages selon le modele qui lit :
six cents pour un modele a large fenetre, cent pour un modele a deux
cent mille jetons de contexte. Le depot passe par deux modeles.
`MODEL` vaut `claude-sonnet-4-6`, `FAST_MODEL` vaut
`claude-haiku-4-5-20251001`, et c'est le second qui porte le plafond de
cent pages.

La mesure a ete faite sur l'objet et non sur son nom : en interrogeant
`getEngineFingerprints()`, trente et un moteurs portent une empreinte,
quatre appellent le modele rapide, et un seul de ces quatre envoie le
PDF plutot que du texte. C'est `lib/engines/prescan-engine.ts:296`, qui
passe `pitchDeckBase64` a `callClaudeWithPDF` avec `FAST_MODEL`. Les
autres appels PDF, extraction, extraction financiere, metriques SaaS,
metriques industrielles, contractuel, passent tous par `MODEL` et
tiennent jusqu'a six cents pages. Le moteur perdu est donc un et il est
nomme, ce qui vaut mieux que la proportion.

Ce que cela coute. Le pre-scan est le triage d'entree : six tests
eliminatoires universels, plus quatre tests de fit these quand un profil
de fonds est fourni. Au-dela de cent pages il ne s'execute pas, et il ne
s'execute jamais sur la seule categorie de dossier ou il aurait le plus
de valeur, le memorandum de due diligence volumineux, celui dont
l'instruction complete coute le plus cher. Le gating knockout, dont
l'economie entiere repose sur le fait d'arreter tot un dossier qui ne
passe pas, est desarme exactement la ou l'arret economiserait le plus.

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
