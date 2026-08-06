# Ce que Prelude ne garantit pas

Etabli le 6 aout 2026, a l'arret du developpement precedant le gel.

Ce document s'adresse a qui evalue la plateforme de l'exterieur. Il
n'enumere pas des defauts constates mais des affirmations que nous ne
sommes pas en mesure de soutenir, ce qui n'est pas la meme chose. Un
defaut se corrige ; une limite se declare, et c'est ce que nous faisons
ici plutot que de laisser un lecteur la decouvrir seul.

Aucun des cinq points ci-dessous ne rend une note fausse. Chacun designe
un endroit ou notre dispositif de controle est moins etendu que ce que sa
presence pourrait laisser croire, et c'est precisement cet ecart que nous
tenons a nommer. Un controle qui parait couvrir plus qu'il ne couvre est
plus dangereux qu'un controle absent, parce qu'il fait cesser la
recherche.

## Le diagnostic d'un refus de format n'a jamais ete exerce en conditions reelles

Chaque moteur d'analyse doit rendre une structure conforme a un contrat.
Quand il n'y parvient pas, la plateforme conserve desormais le texte
refuse, afin qu'un incident puisse etre instruit apres coup plutot que
constate. Ce mecanisme a ete verifie a l'endroit ou l'erreur est levee,
mais son trajet complet jusqu'a l'enregistrement ne l'a pas ete, faute
d'incident survenu depuis son ecriture. Seize passes de mesure hors ligne
n'ont produit aucun refus de format, ce qui est une bonne nouvelle sur la
stabilite et laisse ce diagnostic non eprouve.

Consequence pratique : si un incident de format survenait, la
reconstitution pourrait etre moins complete qu'annonce. Elle ne serait
pas absente, et l'incident lui-meme resterait signale comme tel.

## La reserve sur les valeurs de sortie s'affiche par classe, et cette bascule n'a pas encore joue

Une des methodes de valorisation compare la taille actuelle de la societe
a une valeur de sortie de reference propre a sa classe d'actif. Quand
cette valeur repose sur une estimation plutot que sur une mesure, la note
le declare. Cette declaration suivait jusqu'ici la table entiere ; elle
suit desormais la classe du dossier, afin de disparaitre d'elle-meme a
mesure que la collecte avance, sans intervention.

Le mecanisme est verifie par des tests deterministes. Il n'a pas encore
ete exerce sur un dossier reel, parce que le dernier dossier analyse
n'appelait pas cette garde. La reserve reste donc affichee partout
aujourd'hui, ce qui est la lecture juste, et sa levee progressive sera
constatee au premier dossier concerne.

## La devise du dossier est lue, mais nous ne conservons pas la trace de cette lecture

La plateforme detecte la monnaie dans laquelle un dossier presente ses
chiffres, et s'en sert pour refuser une comparaison entre des montants
libelles differemment. Cette lecture n'est pas conservee dans l'analyse
enregistree. Nous ne pouvons donc pas, aujourd'hui, montrer a posteriori
ce que la plateforme avait lu sur un dossier donne.

C'est une limite de tracabilite et non de traitement. La comparaison
refusee l'est bien, et la note porte son refus ; ce qui manque est la
piece justificative permettant de rejouer la decision plusieurs mois
apres. Nous tenons cette distinction pour importante, parce que notre
propre doctrine veut qu'une donnee acquise ailleurs que dans le
raisonnement porte la trace de son acquisition.

## Les vingt et une valeurs de sortie de reference sont des ordres de grandeur, et nous ne les presentons pas autrement

La table qui associe une valeur de sortie a chaque classe d'actif
comportait une mention de source. L'examen de son origine a etabli que
cette source n'avait pas produit ces nombres : vingt et une classes y
portent dix valeurs distinctes, toutes multiples de dix millions, dont
une revient quatre fois. Vingt et une medianes publiees ne tombent pas
sur une echelle de dix barreaux ronds. Ce sont des ordres de grandeur
poses a la main.

La mention de source a ete retiree, parce qu'une source qui n'a pas
produit un nombre ne se cite pas a cote de lui : elle l'authentifie sans
l'avoir mesure. La collecte a ete tentee et n'a rien rendu au niveau
d'exigence que nous nous imposons, a savoir une statistique nommee, un
perimetre geographique, une fenetre temporelle, une taille d'echantillon,
une devise et une reference opposable. Ce qui existe en acces ouvert est
de l'agrege ou des multiples de valorisation, qui sont une autre mesure.
Aucune classe n'a recu par defaut la valeur d'une classe voisine.

Consequence pratique : la methode de valorisation qui s'appuie sur ces
valeurs annonce, dans la note, que son socle est une estimation. Sur les
dossiers du corpus ou cette garde se declenche, la marge est de 157 a 171
pour cent, de sorte qu'aucune incertitude raisonnable sur ces nombres ne
ferait basculer sa conclusion. Nous le disons pour ce que cela vaut, et
non comme une justification de ne pas les mesurer.

## Le comparatif entre deux analyses ne conclut que lorsque le code n'a pas bouge

Nous comparons desormais chaque nouvelle analyse d'un dossier a la
precedente, champ par champ, en distinguant ce qui est calcule de ce qui
est ecrit par un modele. Un champ calcule qui se deplace sans qu'aucune
de ses entrees se soit deplacee est un defaut, et il est signale comme
tel.

Ce verdict n'a de sens qu'entre deux analyses ayant rencontre le meme
code. Sur notre corpus, quatorze paires d'analyses successives sur
vingt-sept partagent leur empreinte de code ; sur les treize autres, un
ecart mesure l'evolution du produit et non une instabilite, et le
comparatif s'abstient de conclure. Il l'ecrit a cote de son resultat,
pour qu'un solde nul ne se lise pas comme une couverture complete.

Cette proportion s'ameliorera d'elle-meme des lors que le rythme de
developpement ralentira, sans qu'aucun travail y soit consacre.

## Ce que nous promettons, et ce que nous ne promettons pas

Nous ne promettons pas que deux analyses du meme dossier rendent le meme
texte. La plateforme interroge des sources exterieures, le monde bouge
entre deux interrogations, et c'est ce que nous lui demandons de faire.

Nous promettons que tout fait exterieur porte l'adresse d'ou il vient, la
date a laquelle il a ete lu et le passage cite, de sorte qu'un tiers
puisse refaire le chemin. Nous promettons qu'un nombre extrait d'un
document porte le chiffre tel que le document l'ecrit, et qu'un ecart
entre les deux au-dela de ce qu'un arrondi peut couter est declare plutot
que corrige en silence. Nous promettons qu'une methode d'analyse qui
sort de son domaine de validite le dise dans la note au lieu de rendre un
resultat.

Et nous promettons de tenir ce document a jour, y compris quand il
s'allonge.
