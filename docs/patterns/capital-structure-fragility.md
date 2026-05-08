# Pattern Capital Structure Fragility

Fiche de specification du moteur. Premiere version, redigee en session
conceptuelle. A integrer ulterieurement dans lib/engines/.

## Definition

Une entreprise dont la structure de capital, accumulee a travers
plusieurs tours successifs, introduit des asymetries entre les
classes d actionnaires telles que la trajectoire vers une exit ou
un nouveau tour devient mecaniquement incompatible avec la
valorisation affichee. Le pattern apparait quand les preferences de
liquidation cumulees, les multiples participations, les
anti-dilutions full ratchet, les pay-to-play a venir, l overhang
ESOP non provisionne, ou les clauses de drag-along defavorables
verrouillent l entreprise dans une fourchette d exit etroite, ou
pire, dans un terrain de bataille post-money ou chaque action
strategique declenche un conflit entre classes d actionnaires.

Le pattern est le moins bien traite par les outils VC existants
parce qu il necessite une lecture juridique fine du pacte
d actionnaires, des statuts et de l historique des term sheets.
Une analyse de cap table superficielle ne suffit pas, parce que
deux entreprises avec la meme repartition apparente du capital
peuvent avoir des economies tres differentes selon les preferences
empilees au passif. Le pattern est particulierement diagnostique en
down round, ou il predit avec precision quels dossiers vont se
restructurer par washout ou recap plutot que survivre dans leur
forme.

WeWork avant l IPO refusee de 2019 est le cas d ecole. SoftBank
avait obtenu sur ses derniers tours une preference de liquidation
participation 1x avec senior priority, plus une protection
anti-dilution full ratchet, plus des vetos massifs sur la strategie.
Adam Neumann, de son cote, beneficiait de super voting rights a 20
pour une et de mecanismes de protection contre la dilution
personnelle. La combinaison rendait toute IPO impossible a une
valorisation inferieure a 47 milliards parce qu en dessous, les
clauses se declenchaient en cascade et generaient un conflit
indemnisable entre les classes. Quand la realite economique a
ramene la valorisation possible vers 10 milliards, l IPO a ete
retiree, le fondateur a ete sorti contre un package, et la
restructuration a entraine un washout massif des common et des
employes.

Klarna en 2022 fournit le cas inverse, ou la structure de capital
a fait son travail mais brutalement. Le down round de 46 milliards
a 6 milliards de valorisation a active les protections anti-dilution
des derniers entrants, ramenant les fondateurs et les early
investors a une part residuelle. La structure a sauve les
investisseurs les plus recents au detriment des early et des
common. Aucune fraude, aucune mauvaise gestion ponctuelle, juste
l execution mecanique des clauses contractuelles signees plusieurs
tours en arriere, dont les early et les fondateurs n avaient
manifestement pas anticipe l effet en cas de baisse importante de
valorisation.

## Stade d application

Pertinent des la Series A si le dossier a deja accumule des
preferences creatives au seed. Le moteur cherche dans les statuts
et le pacte les premieres traces de complexite, qui peuvent
apparaitre des le tour seed sur les dossiers anglo-saxons et
quelques dossiers francais sophistiques.

Critique en Series B et au-dela parce que la complexite s accumule
de maniere combinatoire de tour en tour. Chaque nouveau tour ajoute
ses preferences, qui interagissent avec celles des tours
precedents. Au-dela de quatre tours empiles, la cap table devient
illisible sans un waterfall analysis automatique.

Tres critique en growth, pre-IPO et lors d un down round potentiel
ou en cours. Le pattern Capital Structure Fragility est l un des
trois patterns que tout investisseur de growth doit lire avant de
signer une term sheet, avec Growth Subsidized Model et Fixed Cost
Trap.

S applique a tout business model parce que la structure de capital
est independante de la nature du business. Un SaaS Series C peut
etre Capital Structure Fragility, un industriel Series D aussi.
La distinction sectorielle n est pas pertinente sur ce pattern.

## Trois axes de mesure

### Axe 1 : empilement des preferences de liquidation

Mesure quantitative et qualitative de la masse de preferences au
passif equite. Quatre sous-modules.

Premier sous-module, total des preferences cumulees en valeur
absolue. Le moteur additionne le 1x sur chaque classe preferred,
multiplie par le multiple de participation quand il existe (1x non
participating, 1x participating, 2x participating, parfois plus),
et compare au plafond cap quand il existe. Le total represente le
montant minimum a generer en exit pour que toutes les classes
preferred recuperent leur droit prioritaire avant que les common
ne touchent quoi que ce soit.

Deuxieme sous-module, ratio preferences sur valorisation actuelle.
Le moteur divise le total des preferences cumulees par la
valorisation post-money courante. Au-dela de 50%, les common
deviennent fragiles. Au-dela de 80%, le pattern apparait. Au-dela
de 100%, l entreprise est dans un etat ou meme a sa propre
valorisation declaree, les common ne valent quasi-rien.

Troisieme sous-module, presence de participations multiples. Une
preferred a participation 1x non participating est la version la
moins toxique : elle convertit en common quand l exit est
suffisamment eleve, n exigeant que 1x. Une preferred 1x
participating cumule sa preference plus son partage prorata du
reste, ce qui detruit massivement la valeur des common a exit
moyen. Une preferred 2x ou 3x participating est rare et tres
agressive, signe generalement d un tour de detresse. Le moteur
identifie chaque classe et son comportement de waterfall.

Quatrieme sous-module, hierarchie senior vs pari passu vs blended.
Une structure ou tous les preferreds sont pari passu (au meme niveau)
est plus equilibree que celle ou les derniers entrants ont
negocie une seniority, c est-a-dire le droit de prendre leur 1x
avant les precedents. Les structures a seniority sont
particulierement defavorables aux early investors et aux fondateurs
en down round. Le moteur cherche cette hierarchie dans le pacte.

### Axe 2 : asymetries entre classes au-dela des preferences

Mesure des autres mecanismes contractuels qui creent des asymetries.
Six sous-modules.

Anti-dilution. Le moteur cherche la formule appliquee au pacte.
Full ratchet est la version la plus toxique, qui re-prixe tous les
tours precedents au prix du nouveau tour en cas de down round, ce
qui dilue massivement les fondateurs et les common. Weighted
average broad-based est la version la plus equilibree. Weighted
average narrow-based est intermediaire. Une presence de full
ratchet sur au moins un tour, surtout recent, est un signal fort.

Drag-along thresholds. Le moteur cherche qui controle la decision
d exit. Si le drag-along est declenche par une majorite des
preferred uniquement, les common et les fondateurs n ont pas leur
mot a dire sur le timing et la valorisation d exit. Si le seuil
necessite l accord d une majorite de chaque classe (preferred et
common), l equilibre est meilleur. Une asymetrie forte du
drag-along en faveur des preferreds recents est un drapeau
significatif.

Veto rights. Le moteur cherche les protective provisions ou
matieres reservees au pacte. Une preferred avec un long catalogue
de vetos sur les decisions strategiques (cession d actifs,
embauche du CEO, signature de partenariats au-dessus d un certain
montant, modification des statuts) bloque l agilite operationnelle.
Plus la liste est longue et plus elle est detenue par une seule
classe, plus l asymetrie est forte.

Pay-to-play obligations. Le moteur cherche les clauses qui obligent
les anciens preferreds a participer aux tours suivants pour
maintenir leur protection anti-dilution, sous peine de conversion
automatique en common ou de perte de leurs droits speciaux. Les
pay-to-play ont sauve plusieurs cap tables dans les down rounds
recents, mais ils peuvent aussi piéger des fonds qui ne peuvent
plus follow-on.

Founder equity protection. Le moteur cherche les mecanismes de
protection du fondateur : super voting rights, double trigger
acceleration au vesting, single trigger sur certains evenements,
clauses anti-dilution personnelles. Quand ces mecanismes sont
presents, ils creent une asymetrie supplementaire entre les
fondateurs et les autres common. Quand ils sont absents et que les
fondateurs sont ramenes a 5% ou moins du capital apres plusieurs
tours, l alignement avec leur execution future devient une question.

ESOP overhang. Le moteur cherche la taille du pool d options
employees, son refresh a chaque tour, et combien est deja alloue.
Un pool plein a 95% avec un refresh attendu au prochain tour
signifie une dilution future garantie pour les non-preferred. Un
pool a 5% rempli alors que la boite emploie 200 personnes signifie
un sous-provisionnement qui forcera un refresh massif au prochain
tour, dilutif. Les deux extremes sont problematiques.

### Axe 3 : compatibilite de la cap table avec les chemins d exit possibles

Mesure de la zone economique dans laquelle l exit produit un
resultat acceptable pour toutes les classes. C est l axe le plus
diagnostique parce qu il traduit la structure abstraite en
implications operationnelles.

Calcul du seuil de breakeven preferred. Le moteur calcule la
valorisation d exit minimum a laquelle toutes les classes preferred
recuperent leur preference de liquidation, c est-a-dire 1x leur
investissement plus la participation si applicable. En dessous de
ce seuil, les common (fondateurs et employes) ne touchent rien.
Pour WeWork pre-2019, ce seuil etait estime autour de 8 milliards
de dollars. Pour Klarna en 2022, il etait inferieur a la
valorisation effondree, ce qui a sauve les preferences mais
detruit les common.

Calcul du seuil de neutralite. Le moteur calcule la valorisation
au-dessus de laquelle la cap table devient effectivement neutre,
c est-a-dire ou les preferences sont moins avantageuses que la
conversion en common. C est typiquement le seuil cap des
participations, ou la valorisation a partir de laquelle les non
participating se convertissent volontairement. Quand ce seuil est
tres eleve par rapport a la valorisation actuelle, les fondateurs
et common sont effectivement bloques entre les deux pour une plage
de valorisations large.

Plage d exit favorable aux common. Le moteur calcule la fourchette
de valorisations d exit dans laquelle les common recuperent une
fraction significative de la valeur creee. Pour une cap table
saine, cette plage commence des la valorisation actuelle et s elargit
avec la croissance. Pour une cap table fragile, cette plage est
etroite, eloignee de la valorisation actuelle, ou simplement
inexistante. Quand la plage est inexistante, la cap table est
mecaniquement incompatible avec un alignement entre fondateurs et
investisseurs.

Cleanup round historique. Le moteur cherche dans l historique des
operations un eventuel recap, washout volontaire, ou simplification
de la cap table. La presence d un cleanup recent est un mitigant
fort, signe que l entreprise et ses investisseurs ont consciemment
remis a plat les asymetries. Son absence sur une cap table
manifestement complexe est un signe de blocage politique entre
classes.

## Conditions d application strictes

Le moteur ne se declenche que si les documents legaux structurants
sont accessibles, parce que le pattern repose sur une lecture
juridique precise.

- Pacte d actionnaires + statuts + cap table accessibles = full
- Cap table accessible mais pacte partiel = partial (axes 2 et 3
  partiellement actifs selon les clauses identifiables)
- Pas d acces aux documents = not-applicable, recommandation DD
  forte d obtenir le pacte, les statuts et la cap table

Hors scope explicite : le moteur ne formule pas d avis sur la
qualite de l avocat qui a redige le pacte ou sur l intention des
parties au moment de la signature. Il observe la structure
contractuelle telle qu elle est et ses implications mecaniques.
Strictement instrumental.

## Evidence factuelle requise pour score >= 60

Au moins trois evidences chiffrees ou citees parmi les suivantes.
Le seuil est exigeant parce que toute structure preferred au-dela
de la Series A presente un certain niveau de complexite normale qui
ne merite pas d etre marquee comme fragilite.

- Total des preferences cumulees superieur a 80% de la valorisation
  post-money actuelle
- Au moins une classe preferred avec participation multiple, citee
  avec sa formule precise et son tour d origine
- Anti-dilution full ratchet present sur au moins un tour, cite
  avec sa formule precise
- Hierarchie senior preferred etablie en faveur des derniers
  entrants au detriment des plus anciens, avec impact chiffre en
  cas de down round
- Drag-along controle exclusivement par une majorite des preferred,
  excluant les common de la decision d exit
- ESOP overhang superieur a 15% non encore alloue, ou inferieur a
  5% pour une entreprise de plus de 100 employes (les deux extremes
  signalent un mauvais provisionnement)
- Founder equity inferieur a 10% du capital fully diluted apres
  plusieurs tours, sans mecanisme de protection compensatoire
- Aucun cleanup round dans l historique alors que la complexite
  cap table est manifestement excessive
- Calcul de waterfall montrant une plage d exit favorable aux
  common etroite ou nulle a la valorisation actuelle

Le moteur doit citer chaque clause avec sa reference precise au
pacte ou aux statuts. Pas de generalite type cap table compliquee
sans pointer la clause exacte.

## Evidence contradictoire obligatoire

Le moteur cherche symetriquement ce qui contredit le pattern.

- Structure preferred simple sans participation multiple, en 1x non
  participating sur tous les tours
- Anti-dilution weighted average broad-based seulement, formule
  standard et equilibree
- Hierarchie pari passu entre toutes les classes preferred
- Drag-along necessitant une majorite de chaque classe (preferred
  et common) plutot qu une majorite globale dominee par les
  preferred
- ESOP refresh raisonnable et planifie dans le BP, sans surprise au
  prochain tour
- Founder equity protege par mecanismes raisonnables (vesting
  acceleration sur double trigger, super voting rights moderes
  type 5 pour 1 plutot que 20 pour 1)
- Cleanup round recent ayant nettoye la structure heritee de tours
  precedents
- Conversion automatique des preferred en common a un seuil bas
  (1x ou 1.5x valorisation), evitant les blocages prolonges
- Plage d exit favorable aux common large des la valorisation
  actuelle

Si l evidence contraire pese 50 quand l evidence pro pese 60, le
pattern est marque unresolved. Le moteur a tendance a sur-detecter
sur les structures de Series C et D ou la complexite est legitime,
la symetrie est la garde principale.

## Counter-archetypes

### Patterns confirmes (washout, recap force ou IPO impossible)

WeWork avant 2019, structure SoftBank avec preferences cumulees,
participation forte et seniority, plus super voting fondateur,
incompatible avec une IPO sous 47 milliards. Restructuration et
washout des common en 2020-2023.

Quibi en 2020, 1,75 milliard leve avec preferences senior si fortes
que les common ne pouvaient recuperer quoi que ce soit sauf en cas
d exit superieur a 5 milliards de dollars. Dissolution complete six
mois apres le lancement.

Cazoo entre 2021 et 2023, tours successifs en preferred avec
preferences cumulees superieures a la capitalisation finale apres
delisting, common erosion totale.

Klarna en 2022, down round de 46 milliards a 6 milliards qui a
active les protections anti-dilution des derniers entrants,
ramenant les fondateurs et les early investors a une part
residuelle. Cas d ecole de structure qui execute mecaniquement
contre les anciens en cas de baisse.

Compass entre 2021 et 2023, recaps successifs avec wash-down des
common, valorisation residuelle eparpillee entre les classes
preferred selon leur seniority.

Magic Leap, preferences cumulees massives sur faible traction
operationnelle, restructurations successives qui ont erose la
position des common.

Theranos, tours successifs avec preferences senior a participation
multiple sur des valorisations de plus en plus eloignees des
fondamentaux, structure qui a permis aux derniers investisseurs de
maximiser leur recovery dans la liquidation au detriment des
premiers.

### Counter-archetypes sains

Stripe, structure preferred simple sur l ensemble des tours, peu
de classes differenciees, pas de participation multiple, pas de
ratchet agressif. La cap table est lisible sur une page meme apres
plusieurs tours.

Adyen, IPO 2018 avec une structure tres propre a l arrivee en
bourse, sans complexite residuelle des tours precedents.

Mistral, tours rapides en valorisation tres elevee mais avec
structure preservee pour les fondateurs et avec des preferences
classiques 1x non participating. Le timing de levee a permis
d eviter les structures defensives generalement vues en down round.

Atlassian, IPO 2015 avec common dominant, peu de tours prives, pas
de structure preferred complexe heritee.

Snowflake, structure relativement propre malgre les tours pre-IPO.
Le management a explicitement evite les preferences agressives sur
les tours growth.

Datadog, peu de complexite cap table, fondateurs proteges sans super
voting excessif, structure d exit alignee.

La distinction structurale n est jamais le simple fait d avoir des
preferences. C est l accumulation de plusieurs couches d asymetries
qui se renforcent mutuellement. Une preference 1x non participating
sur tous les tours, sans seniority, sans full ratchet, sans veto
massif, est compatible avec une exit a une large gamme de
valorisations. WeWork avait l accumulation de tous les axes
defavorables, qui ont rendu l entreprise mecaniquement incapable
d aller en bourse.

## Sources que le moteur doit interroger

Pacte d actionnaires comme source primaire. Le moteur a besoin du
texte integral pour identifier les clauses precises. Sans pacte,
l analyse est partielle. Le moteur recommande systematiquement son
obtention en DD.

Statuts de la societe pour les classes d actions, leurs droits, et
les modalites de gouvernance. Les statuts sont generalement
publics au registre du commerce (RCS via Pappers en France,
homologues europeens, SEC pour les boites americaines cotees).

Cap table detaillee avec breakdown par classe, par investisseur, et
avec waterfall pre-built. Les outils Carta, Pulley, ou les tableurs
internes des fonds servent de support. Le moteur ne peut pas
calculer les seuils sans ce niveau de detail.

Term sheets historiques quand disponibles. Elles documentent les
intentions a chaque tour et permettent de comprendre l evolution
des asymetries. La presence d une term sheet pay-to-play sur le
dernier tour est un signal a part entiere.

Filings publics pour les boites cotees ou ayant filed un S-1. Le
S-1 contient generalement une description detaillee de la cap
table pre-IPO, qui revele les structures complexes heritees du
prive.

Verification automatique simple : le moteur peut compter le nombre
de classes au pacte et verifier la coherence avec la cap table.
Une discordance est un signal de DD a approfondir.

## Format de l output

Pour chaque axe, score 0-100, evidence pro citee avec reference
precise au pacte ou aux statuts, evidence contra citee de la meme
maniere, confidence. Score global Capital Structure Fragility.
Counter-archetype le plus proche identifie et justifie.

Tableau structure des classes d actions identifiees avec pour
chaque ligne : nom de la classe, tour d origine, montant investi,
multiple de preference, participation oui ou non, plafond cap,
seniority, anti-dilution, droits de veto resumes. Ce tableau est
le livrable principal du pattern.

Calcul de waterfall a trois niveaux de valorisation d exit (50% de
la valuation actuelle, 100%, 200%). Pour chaque niveau, la part
recuperee par chaque classe et par les fondateurs. Le tableau
visualise immediatement la zone d exit defavorable aux common si
elle existe.

Recommandation DD specifique. Sur ce pattern, la recommandation
est typiquement une demande d entretien avec les fondateurs et les
lead investors actuels sur la perception de la cap table, plus une
demande d opinion legale externe sur l interpretation des clauses
ambiguës, plus eventuellement une simulation de cleanup round.
Pour les cap tables les plus fragiles, le moteur peut recommander
de conditionner toute term sheet a un cleanup prealable.

## Conditions de remontee a la couverture de la note

Pattern remonte sur la page de couverture si score global superieur
ou egal a 60 ET au moins deux axes individuels superieurs ou egaux
a 50. Pour les dossiers ou la plage d exit favorable aux common
est inexistante a la valorisation actuelle (axe 3 score superieur a
80), remontee directe en drapeau-rouge meme si les autres axes
sont moderes, parce que cela signifie une incompatibilite mecanique
entre la cap table et toute trajectoire d exit alignee.

Si Capital Structure Fragility remonte ET que Growth Subsidized
Model ou Fixed Cost Trap remontent aussi, la combinaison est
marquee sur la couverture comme exposition triple : la cap table
ne supportera pas une periode de stress economique, et la stress
economique est probable du fait des autres patterns. La trajectoire
WeWork etait precisement cette triple exposition.

## Methode anti-hallucination

Le LLM ne peut pas conclure a Capital Structure Fragility sur des
impressions type cap table compliquee. Il doit nommer la classe
preferred concernee, le tour d origine, le multiple, la formule
exacte, et citer la clause du pacte ou de la term sheet. Tag
obligatoire :

- [pacte] pour les clauses du pacte d actionnaires
- [statuts] pour les dispositions statutaires
- [captable] pour les chiffres de la cap table
- [termsheet] pour les references aux term sheets historiques
- [s1] pour les filings SEC
- [pappers] pour les comptes deposes au registre du commerce
- [inference] pour les calculs derives, en particulier les
  waterfalls, avec la formule explicite

Si le LLM dit preference massive, il doit donner le multiple et le
total cumule en pourcentage de la valorisation. Si le LLM dit
ratchet defavorable, il doit nommer le tour, la formule precise et
l effet attendu en cas de down round.

Contrainte de coherence avec les metriques objectives. Si total
des preferences cumulees superieur a 90% de la valorisation ET au
moins une participation multiple ET full ratchet present,
globalCapitalStructureFragilityScore superieur ou egal a 75 force.
Si structure 1x non participating uniformement sur toutes les
classes ET pari passu ET aucun ratchet agressif, score inferieur
ou egal a 30 sauf evidence forte d autres asymetries non
preference.

## Difference avec les patterns voisins

Avec Growth Subsidized Model, Fixed Cost Trap et Infrastructure
Hostage. Ces trois patterns regardent des fragilites economiques :
unit economics, base de couts, dependance fournisseurs. Capital
Structure Fragility regarde une fragilite du passif equite, qui est
de nature contractuelle et juridique. Une entreprise saine
economiquement peut etre Capital Structure Fragility si elle a
accumule une cap table toxique. Inversement, une entreprise dont
l economie est fragile peut avoir une cap table propre, ce qui
limite l ampleur du desastre en cas de difficulte.

Avec le moteur DD contractuelle du Bloc 2 actuel. La DD contractuelle
examine les clauses individuelles avec leur citation exacte. Capital
Structure Fragility regarde l effet systemique de l empilement des
clauses, c est-a-dire ce que produit l interaction entre tous les
tours et toutes les classes. Les deux modules sont complementaires :
DD contractuelle fournit la matiere premiere lecture par lecture,
Capital Structure Fragility en synthetise les implications.

Avec le moteur valuation du Bloc 1 actuel. Le moteur valuation
calcule une fourchette de valorisation par methodes multiples
(VC inverse, multiples sectoriels, comparables historiques).
Capital Structure Fragility regarde si cette fourchette est
compatible avec la cap table accumulee. Une boite peut avoir une
fourchette valuation saine et une cap table fragile, ce qui force
le repositionnement du discount applique au prix de term sheet.
Les deux modules se nourrissent : valuation fournit la fourchette,
Capital Structure Fragility fournit le minimum d alignement
exigible avec les common.

Avec Aveuglement Cap Table du moteur 8 actuel. Le moteur 8 detecte
un eventuel deni psychologique du fondateur sur sa propre dilution
ou sur les implications de sa structure. Capital Structure Fragility
detecte la realite structurelle de la cap table independamment de
la posture mentale du fondateur. Un fondateur peut etre lucide sur
sa cap table fragile et le dire ouvertement, ce qui annule le deni
mais pas Capital Structure Fragility. Le pattern reste a traiter
en pre-IC parce que la mecanique financiere ne change pas avec la
lucidite mentale.
