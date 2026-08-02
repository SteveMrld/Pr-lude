# Grappe 4, tete de file

Ordre d execution arrete au brief 24. Le chantier commence par la
ligne de contexte des sept moteurs, poste le plus large et le moins
couteux : sept lectures dialectiques d une cession ecrites comme s il
s agissait d un tour de table produisent une note de travers bien
au-dela d un ticket faux. Le detail du cadrage vit dans la note de
grappe 3, section 3.

Le bloc ci-dessous s y ajoute, ouvert par le run du 2 aout 2026.

## 1. La matrice ne tranche pas le secteur d une societe etablie

### Ce qui est lu

Le run de production du 2 aout sur le memorandum Compagnie des Alpes,
portefeuille de six parcs de loisirs, sort avec
`relevanceMatrix.assetClass` a `unclassified`. Consequence immediate :
`computeValuation` neutralise les quatre methodes de valorisation en
amont de toute autre question, avec la cause `doctrine`, et le dossier
ne recoit aucune fourchette. Ni la reparation du normaliseur, ni la
regle de millesime, ni les benchmarks n ont l occasion de servir.

La matrice echoue sur trois axes simultanement, et pas seulement sur
la classe d actif : `productionChain` et `businessModel` sortent tous
deux a `unknown` sur le meme dossier.

Mesure sur le corpus, quarante-deux dossiers portant une matrice :
**deux sortent en unclassified, soit 5%**, et ce sont deux runs du
meme dossier. Le taux est faible, la coincidence ne l est pas, puisque
c est precisement ce dossier qui est passe en production.

Le profil qui se degage n est pas celui d un secteur exotique. Le
libelle extrait est « Hospitalite / Parcs de loisirs regionaux », et le
catalogue porte une classe `hospitality`, sur laquelle deux autres
dossiers du corpus sont correctement classes. Le normaliseur reconnait
`hospitality`, `travel`, `tourism` et `hotellerie`, mais pas
`hospitalite` en francais, ni `parcs de loisirs`, ni `loisirs`. Le mot
que le modele d extraction a choisi est la traduction francaise du mot
que la table attend en anglais.

C est donc une lacune de vocabulaire de la table de mots-cle, sur un
secteur deja couvert, et non un secteur hors perimetre.

### La question reste ouverte, et elle est rattachee au type d operation

Le correctif evident est d ajouter `hospitalite` et `parcs de loisirs`
a la table de mots-cle. Il n est pas fait, et deliberement : il
traiterait le symptome d un dossier et laisserait entier ce que
`productionChain` et `businessModel` signalent en echouant sur le meme
dossier.

L hypothese a instruire est que la matrice de pertinence est elle
aussi cadree par la presupposition de levee. Un memorandum de cession
decrit un actif et son exploitation, un portefeuille de six parcs et
leur frequentation. La matrice cherche un produit et un modele de
revenus, parce que c est ce qu un deck de levee presente. Si
l hypothese tient, les trois axes n echouent pas par coincidence :
ils echouent ensemble parce qu ils interrogent tous les trois un objet
que le document ne decrit pas.

C est la meme racine que la ligne `Tour : stade montant` injectee dans
sept prompts, ouverte au bloc 1 de cette grappe. Dans les deux cas, un
cadre concu pour la levee est applique a une operation qui n en est
pas une, et dans les deux cas le symptome visible, un ticket faux ici,
une classe non tranchee la, est moins interessant que le cadre.

Le lien a une consequence d ordonnancement : la matrice ne se corrige
pas avant que le type d operation existe. Une fois qu il existe, la
question devient tranchable, puisqu on saura si les dossiers
`unclassified` sont des cessions.

Deux dossiers ne suffisent de toute facon pas a conclure, et ce sont
deux runs du meme. La mesure se refera quand le corpus aura grossi.

### Ce qui reste a etablir

Le cout d une classe non tranchee est disproportionne a sa cause. Un
mot manquant dans une table de mots-cle neutralise quatre methodes de
valorisation et sept indicateurs, et le lecteur recoit une note sans
aucun ancrage chiffre. Il faut decider si `unclassified` doit rester
un veto global ou devenir un signal qui degrade sans tout neutraliser.

Comment le dossier doit se comporter en attendant. Aujourd hui la note
dit que la classification est a confirmer, ce qui est honnete, mais
elle le dit apres avoir supprime tout le contenu chiffre.
