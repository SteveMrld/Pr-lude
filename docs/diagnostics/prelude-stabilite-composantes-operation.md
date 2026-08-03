# Stabilité des composantes d'opération

Mesure du 3 août 2026. Trois passes d'extraction en série sur
`Project Woodpecker_Info Memo.pdf`, 12 Mo, régime de production.
Outil : `scripts/engine-stability.ts --engine=extraction --serial=true`.

## Pourquoi cette mesure

`fundraise.operationComponents` est devenu le 3 août la source citée du
type d'opération. `operationType` en dérive, et le type décide du
domaine de la dilution : sans composante `cash-in`, la dilution est
déclarée hors domaine et la note ne l'affiche plus. La grandeur qui agit
n'est donc pas le tableau des composantes, ce sont leurs natures, et
leur stabilité n'avait jamais été mesurée.

Le suivi se fait par trois lectures dérivées et non par comparaison du
JSON du tableau. Le tableau porte deux choses de nature différente : les
natures, qui commandent, et les citations, qui se lisent dans la note et
ne commandent rien. Comparer le JSON entier ferait compter un synonyme
dans une citation comme une instabilité de la nature, c'est-à-dire
mesurer le canal visible en croyant mesurer le canal muet.

## Ce que la mesure rend

Trois passes rendues, aucun échec. Durées 56,1 s, 56,8 s et 65,8 s, pour
une fenêtre de 300 s, soit un facteur quatre et demi de marge sur le pire
cas.

Neuf champs stables sur treize.

Les trois lectures des composantes sont stables. Les trois passes rendent
les mêmes trois natures, `cash-in + cession + dette`, dans le même
nombre, avec des citations identiques caractère pour caractère :
« Inject €10-15m in cash-in to support the next growth phase » pour le
cash-in, et leurs homologues pour la cession et la dette. Le type dérivé,
`lbo`, est stable sur les trois passes.

Quatre champs bougent, et ce sont les mêmes qu'avant : `fundraise.amount`
sur la formulation de l'annotation et non sur le montant, `seller`,
`stakeForSale`, `traction.revenue`.

## Ce qui fonde la conclusion

Le compteur de divergences est la mauvaise grandeur, et trois passes ne
le rendent pas concluant : avec zéro divergence sur trois tirages, la
borne haute du taux réel reste vers soixante pour cent. Trois passes ne
séparent donc pas une extraction stable d'une extraction qui bougerait
un tiers du temps.

Ce qui fonde la conclusion est la nature de la tâche, lisible dans les
sorties elles-mêmes. Les trois champs qui bougent demandent tous une
synthèse : `seller` agrège plusieurs cédants en une phrase,
`stakeForSale` résume un périmètre, `traction.revenue` recompose une
série. Les composantes, elles, demandent une copie : la citation est un
passage du document, repris tel quel, et l'identité caractère pour
caractère sur trois passes est la signature d'une reprise et non d'une
reformulation. Un champ de copie n'a pas la même loi de variance qu'un
champ de synthèse, et c'est cela qui borne, pas le compteur.

La garde post-parse ajoute un second appui, indépendant du tirage : une
composante sans citation est refusée, et une nature en double est
écartée. Une passe qui inventerait une quatrième composante sans pouvoir
la citer ne la ferait pas passer.

La réserve à écrire telle quelle : la mesure porte sur un document, et
c'est un mémorandum de LBO, c'est-à-dire le cas où les marqueurs sont les
plus explicites. Un deck de levée pure, où la seule composante `cash-in`
se lit dans une phrase de couverture et non dans une page de structure
d'opération, n'est pas couvert par cette mesure. C'est là qu'il faut la
refaire.

## Effet de bord relevé

L'outil dépendait de deux identifiants pour un seul besoin : la table des
analyses par l'API de gestion et son jeton personnel, le Storage par la
clé de service. Le premier répond 401 depuis le 3 août, et l'outil
tombait entièrement alors que la moitié qui travaille fonctionnait. Les
deux lectures passent maintenant par la clé de service.
