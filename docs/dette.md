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
(`app/components/InvestmentNoteView.tsx:3794`), et rien d'autre ne le
lit. La garde post-parse le vide quand aucune composante d'operation
n'est etablie, ce qui couvre le cas de la levee pure, et ne fait rien
au-dela.

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
