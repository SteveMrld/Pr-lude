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

## 2. Mesure du type d operation sur le corpus

Rejeu hors ligne des quarante-deux dossiers, avant tout run.

Precision de methode, elle conditionne la lecture des chiffres : le
classement est estime en appliquant aux textes deja persistes les
memes marqueurs que le prompt nomme desormais. Ce n est pas une
re-extraction par le modele. Les chiffres donnent un ordre de grandeur
et une repartition, pas un decompte definitif.

| valeur | dossiers |
|---|---:|
| levee | 14 |
| cession partielle | 11 |
| cession totale | 4 |
| LBO | 1 |
| non etabli | 12 |

Seize dossiers sur quarante-deux, soit 38%, ne sont pas des levees.
C est plus que les quatorze dossiers growth qui avaient ouvert le
sujet : des memorandums de cession se trouvent aussi hors du parcours
growth. Douze restent non etablis, ce qui est le comportement voulu
d une regle qui refuse de deviner, et non un echec de classement.

Consequences mesurees. Dix dossiers perdent leur VC inverse, un seul
perd sa dilution, et seize voient leur vocabulaire de note changer.
L ecart entre dix et un s explique : la dilution ne se neutralise que
sur cession totale, et les quatre dossiers concernes n avaient pour la
plupart pas de fourchette pre-money a diluer, la VC inverse etant deja
neutralisee par ailleurs.

Le chiffre demande sur les conseils vendeurs mal ranges : **un seul
dossier**, ZargesTubesca, dont le champ leadInvestor porte
« Rothschild GmbH (conseiller financier des vendeurs) ». Le cas est
donc isole et non un peuplement.

Il reste que le champ sellSideAdvisor se justifie par autre chose que
sa frequence : sans lui, les quinze autres dossiers de cession
laissaient simplement l information de cote, ce qui ne se voit nulle
part. Un champ absent ne produit pas d erreur visible, il produit un
silence, et un silence ne se mesure pas.

C est le raisonnement de la grappe fetchers applique en amont de la
chaine. La-bas, une source externe qui echoue rend un vide
indiscernable d une absence de signal, et le moteur conclut sur ce
vide. Ici, une information que le contrat n a pas de case pour
recevoir disparait sans laisser de trace, et la note conclut sans elle.
Dans les deux cas, ce qui manque ne remonte pas, donc rien ne le
signale, donc le defaut dure. La difference tient a l endroit : le
premier est une perte a la collecte, le second une perte au contrat.
Le remede est le meme, ouvrir la case et rendre le manque visible
plutot que de compter sur sa frequence pour le decouvrir.

## 3. L ecart onze contre sept, quatrieme occurrence

Le brief 25 annoncait sept moteurs portant la ligne « Tour : stade
montant ». La mesure en a rendu onze, pour douze sites.

La cause est ma propre mesure du brief 24, faite par une recherche trop
etroite qui n avait pas capte les variantes d ecriture du meme
gabarit : `${extraction.fundraise.amount}` sans repli,
`${extraction.fundraise.amount || ''}`,
`${extraction?.fundraise?.amount ?? '?'}`, et la variante au point
median de reference-checks.

C est la quatrieme occurrence de la meme famille dans la semaine, apres
la table de benchmarks mesuree a travers un normaliseur defaillant, la
couverture de baseExits mesuree par une regex qui excluait les
chiffres, et le denombrement des sites de cause qui melangeait types,
commentaires et sites reels.

C est aussi la premiere ou la regle a joue **avant** l ecriture plutot
qu apres. Les trois precedentes ont ete decouvertes une fois le
diagnostic ecrit, dont deux une fois le brief redige. Celle-ci a ete
vue en verifiant le chiffre du brief avant de toucher au code, ce qui
est exactement l usage prevu de la regle inscrite dans CLAUDE.md. Le
cout de la verification a ete d une commande.
