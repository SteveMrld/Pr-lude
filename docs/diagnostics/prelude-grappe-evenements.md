# Grappe evenement externe structure

Ouverte le 3 aout 2026, non traitee. Elle sort du bloc 5 du brief 30,
qui a livre le module de validite d operation avec une detection
provisoire par lecture de prose, et qui a nomme cette detection comme
une dette et non comme un dispositif.

## Le fait

Les evenements externes dates existent dans le pipeline, mais comme
phrases. La levee de 83 millions d euros de novembre 2023 qui a ouvert
tout ce chantier vit dans `team.greenFlags[]` et dans
`team.declaredVsVerified.verifiedClaims[]`, qui sont typees
`string[]`. Verification faite sur `types.ts` : il n existe aucun type
d evenement externe dans le depot, ni intitule, ni date, ni source, ni
nature.

Le moteur Equipe les fabrique deja. Il les fabrique en meme temps qu il
les redige, et c est precisement le probleme : la donnee et sa
formulation naissent dans le meme geste, donc la donnee n existe pas
separement.

## Ce que la detection provisoire fait a leur place

`detecterEvenementsDansLaProse`, dans `lib/engines/operation-validity.ts`.
Elle reconnait quatre natures par expression reguliere, extrait une
annee et parfois un mois, recupere le tag de source, et rend des
`EvenementDate` marques `luDansLaProse: true`.

Sa precision est mediocre et mesuree : sur les six dossiers du corpus
portant un millesime exploitable, elle rend deux candidats dont un faux
positif, une donnee de traction prise pour un evenement. Ce taux est
acceptable tant que la mention pose une question ; il ne le serait plus
si elle concluait.

Elle viole la regle de la grappe 3, aucun consommateur en aval ne lit
un message pour decider. La violation est assumee, declaree dans le
code et dans la note, et bornee par le fait que sa sortie est
exactement l interface que le moteur Equipe doit produire.

## Le plafond du procede, et pourquoi il ne faut pas essayer de sauver le palliatif

Ecrit le 3 aout 2026 apres un resserrage qui a divise le taux de faux
positifs par deux sans le supprimer.

Le probleme n est pas le seuil. Il est que **les moteurs ecrivent
constamment des phrases de la forme d un evenement**, et que le
detecteur cherche un fait date dans une prose qui n en contient presque
jamais. « Un tour documente existe », « la structure de financement
cumulee est legere pour un SaaS fonde en 2007 », « le CIM Clipperton
Q2-2023 documente la repartition actionnariale » : ce sont des constats
d analyse, ils portent un vocabulaire de financement et une annee, et
aucune regle de forme ne les distinguera durablement d une levee
annoncee en novembre 2023.

Mesure du resserrage, sur les quarante-huit analyses persistees, par
rejeu partiel et sans un appel au modele :

```
                              avant    apres
reserves levees                  4        3
evenements retenus              15       11
dont constats d analyse          5        2
taux de faux positifs          33%      18%
```

Le faux positif d In Haircare disparait, le vrai positif de Braincube
survit. Mais une reserve sur trois affiche encore, comme evenement
principal, une phrase qui n en est pas une.

**Ne pas essayer de sauver le palliatif.** Chaque resserrage ecarte une
famille de faux positifs et laisse la suivante ; il n existe pas de
regle de forme qui separe un fait d un constat quand les deux sont
ecrits dans la meme langue par le meme moteur. Le prochain qui lira ce
code trouvera un taux residuel et sera tente d ajouter un marqueur,
puis un autre. Chaque ajout rendra le detecteur plus difficile a
comprendre sans le rendre juste, et le rendra surtout plus credible :
c est le danger propre a ce composant, sa sortie etant redigee pour
convaincre un lecteur.

La reponse est de ne plus chercher un evenement dans de la prose. Le
moteur Equipe sait ce qu il a trouve au moment ou il le trouve ; il
doit le rendre comme donnee. Tant que cette grappe n est pas traitee,
la regle d usage est simple : **une reserve levee se lit avant d etre
montree**.

## Perimetre de la grappe

### L enumeration des natures

Quatre natures sont posees aujourd hui, financement, changement de
controle, dirigeant, procedure collective, plus un `indetermine` qui
n est jamais produit par la detection provisoire. L enumeration est a
trancher, pas a reconduire. Questions ouvertes : une levee et une
introduction en bourse relevent-elles de la meme nature ; un
changement de dirigeant est-il un evenement au sens de ce module ou un
signal du moteur Equipe qui n a rien a faire ici ; faut-il une nature
pour les evenements de marche, perte d un client majeur, rappel
produit, sanction reglementaire, qui contredisent l operation sans etre
financiers.

Le critere de tranchage n est pas la richesse de la taxonomie mais son
usage : une nature n existe que si la regle asymetrique par type
d operation en fait quelque chose de different.

### Les dates partielles

Le module compare au mois et traite un evenement sans mois comme
survenu en fin d annee, pour ne pas lui preter une anteriorite qu il n a
pas etablie. La source, elle, donne rarement mieux qu un mois, et
parfois moins : « fin 2023 », « courant 2024 », « au premier semestre ».
La structure doit porter la precision reellement disponible et non une
date normalisee qui l inventerait, exactement comme `documentDate` porte
YYYY, YYYY-MM ou YYYY-MM-DD selon ce que le document donne.

A trancher : faut-il un champ de precision explicite plutot que
l inference depuis la presence du mois, et comment representer un
intervalle du type « entre juin et septembre 2024 ».

### Le contrat de sortie du moteur Equipe

C est la piece lourde. Le moteur rend aujourd hui des `string[]` que la
note affiche telles quelles, et les toucher change son contrat avec
tous ses consommateurs. Trois voies possibles, a arbitrer.

Ajouter un champ `evenementsExternes: EvenementDate[]` a cote des
listes existantes, sans y toucher. C est la voie la moins risquee et
elle laisse la redondance en place : le meme fait existe deux fois, en
prose et en donnee, et les deux peuvent diverger.

Faire produire au moteur les evenements structures et deriver la prose
depuis eux. C est la voie propre, et elle suppose de revoir la
redaction du prompt, puisque la phrase cesse d etre ce que le modele
produit pour devenir ce que le code compose.

Laisser le moteur rediger et faire extraire les evenements par un
second passage deterministe sur sa sortie. C est la detection
provisoire promue en dispositif, et il faut se garder de la retenir par
inertie : elle a ete ecrite comme une dette, la reconduire reviendrait
a decider que la prose est le format canonique.

### Ce qui suivra mecaniquement

Le champ `luDansLaProse` et la valeur `prose-provisoire` de
`natureDeLaLecture` disparaissent quand la grappe est traitee. Ils sont
des marqueurs de transition et leur presence dans le code est le
meilleur indicateur que la grappe reste ouverte.

## Ce qui n est pas dans le perimetre

La recherche de nouveaux evenements. Le moteur Equipe interroge deja
des sources externes et trouve ce qu il trouve ; la grappe porte sur la
forme de ce qu il rend, pas sur l elargissement de sa collecte. Un
elargissement serait une autre grappe, et elle dependrait de celle-ci.
