# Mesure de reproductibilite du verdict

Releve du 29 juillet 2026. Harnais `scripts/measure-reproducibility.ts`,
vingt iterations sur l extraction figee du run 2517a288 (In Haircare),
concurrence 2. Reference du run d origine : score 61, verdict investir
avec conditions.

## Perimetre de la mesure

Le harnais rejoue la seule notation, pas le pipeline. Six moteurs
tournent a chaque iteration, ceux qui alimentent `computeMechanicalScore` :
team, market et macro pour les trois premieres dimensions, contrarian et
blindspot pour les singularites et la vigilance, financialCoherence pour
le modele economique. Tout le reste vient du run de reference et ne bouge
pas : extraction, matrice de pertinence, donnees financieres, benchmarks,
et les sorties team market macro telles qu elles alimentent les moteurs
aval. Aucun moteur n est chaine sur la sortie fraiche d un autre, de sorte
que la dispersion mesuree pour un assesseur est la sienne et non celle de
son amont. Les quatre moteurs qui portent le web search tournent en mode
frozen, ce qui l eteint en dur.

La synthese finale est volontairement absente. Depuis 19bb99a le verdict
est derive des seuils par du code et non par le LLM, donc la garder
n aurait ajoute qu une couche de variance par-dessus celle qu on cherche
a mesurer.

Reserve a porter au releve : team, market et macro font leur propre
collecte de donnees reelles avant l appel LLM, hors du mode frozen. Ces
fetchers sont bornes a huit secondes et peuvent rendre autre chose d une
iteration a l autre. Une part de la dispersion des trois premieres
dimensions vient donc possiblement du reseau et non du sampling, et le
harnais ne sait pas separer les deux.

Cout du releve : cent vingt appels Sonnet 4.6 aboutis, 445 620 tokens
d entree, 566 387 de sortie, environ 9,83 USD, quarante minutes de temps
moteur cumule. Aucun echec moteur.

## Tableau de variance

```
dimension                  poids  evaluee    min    max  ecart  ecart-type
Equipe                      0.20    20/20     51     61     10        3.25
Marche                      0.22    20/20     57     62      5        1.39
Macro et timing             0.15    18/20     38     48     10        2.62
Modele economique           0.13    20/20     56     64      8        2.62
Singularites contrariennes  0.15    20/20     48     58     10        2.87
Vigilance critique          0.15    20/20     82     92     10        2.18

score global                        20/20     58     65      7        1.67
```

Macro non evaluee sur deux runs, cause `sous-champs-absents`. Assiette du
score variable entre runs : poids cumules observes 1,00 et 0,85.

Detail des vingt iterations, dans l ordre de lancement :

```
 1  60  investir avec conditions   team 60  mark 59  macr 38  fina 57  cont 58  vigi 86
 2  61  investir avec conditions   team 55  mark 61  macr 42  fina 63  cont 58  vigi 88
 3  59  approfondir                team 54  mark 59  macr 42  fina 59  cont 54  vigi 86
 4  62  investir avec conditions   team 59  mark 61  macr 48  fina 63  cont 54  vigi 88
 5  62  investir avec conditions   team 61  mark 59  macr 48  fina 61  cont 54  vigi 88
 6  59  approfondir                team 51  mark 61  macr 42  fina 59  cont 58  vigi 88
 7  60  investir avec conditions   team 57  mark 62  macr 42  fina 63  cont 54  vigi 82
 8  59  approfondir                team 53  mark 61  macr 42  fina 63  cont 52  vigi 86
 9  62  investir avec conditions   team 55  mark 59  macr na  fina 63  cont 56  vigi 82
10  60  investir avec conditions   team 58  mark 59  macr 42  fina 64  cont 52  vigi 88
11  62  investir avec conditions   team 61  mark 59  macr 48  fina 59  cont 58  vigi 88
12  60  investir avec conditions   team 56  mark 59  macr 42  fina 61  cont 58  vigi 88
13  58  approfondir                team 54  mark 57  macr 42  fina 56  cont 54  vigi 88
14  61  investir avec conditions   team 61  mark 58  macr 42  fina 63  cont 58  vigi 88
15  65  investir avec conditions   team 61  mark 61  macr na  fina 59  cont 58  vigi 88
16  59  approfondir                team 54  mark 58  macr 45  fina 61  cont 48  vigi 88
17  61  investir avec conditions   team 54  mark 59  macr 42  fina 63  cont 58  vigi 92
18  58  approfondir                team 52  mark 57  macr 42  fina 56  cont 54  vigi 88
19  60  investir avec conditions   team 54  mark 60  macr 42  fina 58  cont 58  vigi 88
20  61  investir avec conditions   team 56  mark 59  macr 42  fina 63  cont 58  vigi 88
```

## Le verdict n est pas constant

Quatorze iterations sur vingt rendent investir avec conditions, six
rendent approfondir, avec douze transitions entre runs consecutifs. Sur
le meme dossier, la meme extraction, les memes prompts et sans qu une
seule donnee du dossier ait bouge, le partner qui relance l analyse deux
fois de suite a environ une chance sur trois de voir la recommandation
changer. C est le fait central du releve, et c est une objection
commerciale de premier ordre pour un produit qui vend la rigueur
doctrinale a un fonds institutionnel.

## La cause n est pas l amplitude, c est la position

L intuition naturelle veut que l instabilite du verdict vienne d une
dispersion excessive des moteurs. La mesure dit le contraire. Un
ecart-type de 1,67 point sur le score global est serre, et l agregation
ponderee fait exactement le travail de moyennage qu on attend d elle
puisque aucune dimension ne descend sous 1,39 d ecart-type et que trois
d entre elles depassent 2,6. Le bruit individuel des assesseurs est
absorbe par la ponderation.

Le probleme est ailleurs. La moyenne du score global s etablit a 60,45 et
le seuil de bascule vers investir avec conditions est a 60. Le seuil
traverse le centre de la distribution. C est le seul seuil franchi par
l intervalle observe, les autres sont hors de portee, mais celui-la
suffit : tant qu un dossier atterrit la, aucune reduction plausible du
bruit de sampling ne stabilisera le verdict. Il faudrait ramener
l ecart-type sous un demi-point pour que l intervalle cesse de chevaucher
la frontiere, ce qui n est pas atteignable avec des assesseurs LLM.

La consequence doctrinale est qu il ne sert a rien de chasser la variance
des moteurs pour resoudre ce cas. Ce qui est en cause est la nature meme
d un seuil dur applique a une quantite bruitee. Un dossier dont le score
tombe a moins de deux ecarts-types d une frontiere n a pas un verdict, il
a une zone. La reponse structurelle est de nommer cette zone dans le
calculateur plutot que de faire semblant de trancher, ou a defaut
d exposer au partner l intervalle et la marge au seuil le plus proche
plutot que le seul point.

## Deux defauts structurels du cote macro

Le premier est un defaut d evaluation. La dimension macro sort non
evaluee sur deux iterations sur vingt, avec la cause `sous-champs-absents`,
soit un taux de dix pour cent qui reproduit celui observe lors d un
releve anterieur. La sortie du moteur macro n est donc pas fiable dans sa
forme, independamment de son contenu.

Le second est plus grave parce qu il inverse le sens du score. Quand la
macro echoue, l assiette passe de 1,00 a 0,85 et la dimension disparait
du calcul. Or la macro est de tres loin la dimension la plus faible de ce
dossier, entre 38 et 48 quand les cinq autres se tiennent au-dessus de
51. Son retrait tire donc mecaniquement le global vers le haut. Les deux
iterations concernees sortent a 62 et 65, cette derniere etant le maximum
de la serie entiere. Une defaillance d evaluation est ici recompensee par
un meilleur score et par un verdict plus favorable. C est une inversion
qui appartient au calculateur et non au moteur macro : renormaliser sur
l assiette evaluee revient a supposer que la dimension manquante aurait
valu la moyenne des autres, hypothese fausse des lors qu une dimension
est structurellement basse sur un dossier.

## Ce que la dispersion par dimension indique par ailleurs

L equipe porte la plus forte dispersion de la serie, 3,25 points
d ecart-type, pour le deuxieme poids le plus lourd. C est elle qui
alimente le plus la variance residuelle du global. La reserve enoncee
plus haut s applique en priorite ici : une part de ces 3,25 points peut
venir de la collecte reseau hors mode frozen plutot que du sampling du
modele, et il faudrait un releve dedie, avec les fetchers eux-memes
figes, pour trancher.

Le marche est a l inverse la dimension la plus stable, 1,39 point, ce qui
est coherent avec un assesseur qui travaille sur une matrice de
pertinence figee et un corpus de benchmarks constant.

La vigilance critique se tient tres haut, entre 82 et 92, avec une
dispersion moyenne. Un tel plancher sur vingt tirages interroge la
calibration de la dimension autant que sa variance : une note qui ne
descend jamais sous 82 discrimine peu.
