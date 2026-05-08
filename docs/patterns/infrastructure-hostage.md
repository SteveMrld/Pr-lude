# Pattern Infrastructure Hostage

Fiche de specification du moteur. Premiere version, redigee en session
conceptuelle. A integrer ulterieurement dans lib/engines/.

## Definition

Une entreprise dont la valeur, la marge ou la capacite a operer depend
d un fournisseur d infrastructure tiers qui peut unilateralement
modifier les termes de l acces, le prix, la disponibilite ou la
politique d usage sans que l entreprise ait d alternative viable a
court terme. L entreprise est captive d un goulot d etranglement
structurel qu elle ne controle pas.

C est le pattern le plus universel des fragilites cachees a l ere IA.
La generation de wrappers GPT effondree en 2023 quand OpenAI a baisse
ses prix de 80% et sorti GPT-4 en direct. Jasper et Copy.ai dont la
valorisation s est divisee par cinq en dix-huit mois. Les apps
mobiles a acquisition payante decimees par App Tracking Transparency
d Apple en 2021. Zoom rendue captive de Microsoft Teams par bundling
Office 365. Les fintechs europeennes dont la marge s effondre quand
Stripe ajuste son fee de 0,1 point. Les marketplaces que l App Store
prend a 30% sur tout achat in-app et qui ne peuvent pas y echapper.

Le pattern n est pas l existence d une dependance, qui est partout
inevitable, mais l asymetrie de pouvoir et l absence de chemin de
sortie. Une boite peut dependre de Stripe sans etre Infrastructure
Hostage si elle a un plan documente de migration multi-processor et
qu elle l execute. Elle peut dependre exclusivement d AWS sans etre
captive si son architecture est portable. Le pattern apparait quand
la dependance est concentree, asymetrique en taille de contrepartie,
et sans alternative reellement disponible a 90 jours.

## Stade d application

Pertinent des la Series A pour les boites IA et SaaS, parce que les
modeles d affaires reposant sur des API LLM, des GPU mutualises ou
des hyperscalers se construisent des le premier produit. Application
obligatoire a partir de Series B, ou la dependance s est generalement
verrouillee dans le code et les contrats. Critique en Series C, D,
growth et pre-IPO, ou la valorisation suppose que l infrastructure
restera stable.

S applique aussi aux dossiers seed dont le pitch est explicitement
un wrapper d API tierce sans differenciation structurelle. Pour ces
cas precoces, le pattern remonte directement comme drapeau-rouge si
aucune trajectoire de differenciation n est articulee.

Ne s applique pas aux entreprises hardware-physical et
infrastructure-physical pure, ou la dependance critique est materielle
et deja couverte par le moteur Macro et la matrice de pertinence
(supply chain semi-conducteurs, materiaux strategiques). Le moteur
peut neanmoins s activer en partial pour ces dossiers s ils ont une
couche logicielle ou cloud non triviale.

## Trois axes de mesure

### Axe 1 : intensite de la dependance critique

Mesure quantitative de la concentration des fournisseurs sur la stack
technique et economique du dossier. Calcul en trois sous-mesures.

Premier sous-module, part du COGS technique allouee aux trois plus
gros fournisseurs externes. Si un seul fournisseur represente plus
de 40% du COGS technique, signal fort. Plus de 60%, drapeau-rouge.
Pour un wrapper GPT pur, le ratio peut atteindre 90% avec OpenAI.

Deuxieme sous-module, nombre de fournisseurs critiques sans
alternative de bascule realiste a 90 jours. Critique signifie que la
panne ou la rupture du fournisseur arrete l operation. Trois ou plus,
applicabilite full. Un seul, applicabilite partial.

Troisieme sous-module, switching cost mesure en mois-homme et en
euros. Estimation conservative sur la base de l architecture
declaree. Au-dela de six mois ou d un million d euros pour une
PME-ETI, le switching cost rend la menace credible.

### Axe 2 : pouvoir de marche du fournisseur sur l entreprise

Mesure l asymetrie de pouvoir. Quatre sous-modules a tester.

Asymetrie de taille. Le fournisseur est-il 100x, 1000x plus gros en
capitalisation, en revenu, en effectifs ? OpenAI face a Jasper,
ratio capitalisation 200x environ avant 2024. Apple face a une app
indie, ratio 10000x. Plus l asymetrie est extreme, plus le fournisseur
peut absorber les couts de policy unilaterale.

Capacite de cannibalisation directe. Le fournisseur peut-il sortir
un produit qui rend l entreprise non-pertinente ? Tres haut pour les
wrappers d API LLM, ou OpenAI a deja remplace une dizaine de
categories de produits en un trimestre par des features integrees.
Tres bas pour les produits qui apportent de la valeur metier
specialisee au-dessus de l API.

Track record de changements unilateraux recents du fournisseur. Le
fournisseur a-t-il deja modifie les termes, les prix, la policy
d usage ou les acces dans les vingt-quatre derniers mois sans
preavis significatif ? Apple ATT en 2021, OpenAI policy on
relationship apps en 2023, AWS pricing changes egress fees rendus
plus complexes en 2024, Twitter API monetization en 2023. Si oui,
la dependance n est pas theorique mais documentee comme volatile.

Position dominante du fournisseur sur son marche. Le fournisseur
detient-il plus de 30% de part de marche structurelle ? Nvidia sur
les GPU IA training, environ 95%. AWS plus Azure plus GCP cumules,
environ 65% du cloud public. Stripe plus Adyen plus PayPal cumules,
environ 50% du paiement online B2B. Plus la position du fournisseur
est dominante, moins l entreprise a de levier negociation.

### Axe 3 : path to deverrouillage

Mesure de la capacite reelle de l entreprise a reduire sa dependance.
La presence du pattern n est pas une condamnation, c est une
fragilite qui peut etre adressee. Les boites saines ont un plan, les
boites en hostage n en ont pas ou ne l executent pas.

Existence d un plan documente de reduction de la dependance.
Multi-cloud, fine-tuning de modeles locaux, build interne des
composants critiques, contrats long-terme avec verrouillage de prix,
diversification de processeurs paiement. Si le plan existe sur slide
mais sans echeancier ni KPIs de bascule, c est de la communication.
Si le plan existe avec milestones chiffres, c est un mitigant reel.

Progres mesurable depuis 12 mois sur l execution du plan. Une
entreprise qui declare vouloir devenir multi-cloud depuis trois ans
sans avoir migre un seul service hors d AWS n est pas en train
d adresser la dependance, elle est en train de raconter qu elle le
fait. Le moteur cherche des marqueurs concrets : pourcentage de
charge migree, contrats signes avec second fournisseur, recrutements
explicitement dedies a la portabilite.

Architecture portable par construction. Certaines architectures sont
captives par design (utilisation intensive de services proprietaires
tels que DynamoDB, Lambda, Vertex AI, Azure OpenAI Service).
D autres sont portables par construction (Kubernetes vanilla,
Postgres open-source, modeles open-weight self-hosted). La portabilite
architecturale est un mitigant majeur meme en l absence de plan
explicite.

## Conditions d application strictes

Le moteur ne se declenche que si la stack technique du dossier est
identifiable a partir du pitch, du BP ou du dossier technique.

- Stack identifiee + dependances chiffrees = full
- Stack identifiee mais dependances non chiffrees = partial (axe 1
  desactive sur les sous-modules quantitatifs)
- Stack non identifiable = not-applicable, le moteur recommande
  d aller chercher l information en DD technique

Hors scope explicite : les modeles d affaires ou la dependance
infrastructure est consubstantielle et acceptee par le marche
(banques de detail dependant des reseaux interbancaires, distribution
food retail dependant des grossistes). Pour ces secteurs, le pattern
est tautologique et n apporte pas d information differenciante.

## Evidence factuelle requise pour score >= 60

Au moins deux evidences chiffrees convergentes parmi les suivantes.
Une evidence isolee ne suffit pas a forcer un score eleve, le moteur
doit produire un faisceau.

- Une dependance unique sur plus de 40% du COGS technique, nommee
  precisement (le fournisseur, le service, le pourcentage)
- Aucun plan documente de reduction de la dependance dans le BP ou
  le pitch
- Plan documente mais aucun progres mesurable depuis 12 mois (slides
  presque identiques sur deux versions de pitch consecutives)
- Au moins un changement unilateral recent du fournisseur impactant
  la marge ou la capacite operationnelle, date et cite
- Le fournisseur a sorti dans les 12 derniers mois un produit qui
  cannibalise directement la value proposition de l entreprise
- Asymetrie de taille superieure a 100x avec position dominante du
  fournisseur sur son marche
- Architecture explicitement captive par design (services managed
  proprietaires utilises massivement)

Le moteur doit nommer chaque evidence avec son chiffre precis et
sa source. Pas de generalite type tres dependant a OpenAI sans
pourcentage et sans citation.

## Evidence contradictoire obligatoire

Le moteur cherche symetriquement ce qui contredit le pattern. La
symetrie est la protection cle contre la condamnation par analogie.

- Multi-fournisseur effectif documente, avec switching deja effectue
  sur au moins une partie de la charge
- Contrat long-terme signe avec verrouillage de prix et de policy sur
  trois ans ou plus
- Differenciation reelle sur la couche metier au-dessus du fournisseur
  (proprietary data, network effects, vertical-specific workflows)
  qui rend la cannibalisation directe couteuse pour le fournisseur
- Track record de basculement reussi entre fournisseurs dans le passe
  recent de l entreprise
- Architecture portable par construction documentee dans la DD
  technique
- Position negociation forte du fait d un volume significatif chez le
  fournisseur (au-dela d un million de dollars annuel, l entreprise
  obtient des conditions personnalisees chez la plupart des
  hyperscalers)

Si l evidence contraire pese 50 quand l evidence pro pese 60, le
pattern est marque unresolved. Le rationale doit le dire et la
recommandation DD doit pointer ce qu il faut aller chercher pour
trancher.

## Counter-archetypes

### Patterns confirmes (squeeze marque ou effondrement)

Jasper et Copy.ai en 2023, valorisation divisee par cinq quand OpenAI
a baisse ses prix de 80% et integre des features de copywriting
directes dans ChatGPT. Replika en 2023, business model menace par les
policy changes OpenAI sur les apps de relations. La premiere generation
de wrapper GPT pure-play sans value-add metier, dont la grande majorite
n existe plus en tant qu entreprise independante. Zynga avant 2014,
captive de Facebook qui changeait unilateralement les regles
d acquisition virale. MoviePass dependante des cinemas pour fixer le
prix. Les apps mobiles a acquisition payante avant et apres ATT iOS,
parce que le passage au consentement explicite a divise le ROAS par
trois sur Facebook Ads et Google Ads. Apps Snap qui dependaient du
hardware Lens en 2017. Tribune face a Google News policies. Pinterest
trafic divise par deux sur les algo changes Google Search 2023.

### Counter-archetypes sains

Salesforce qui a construit ses propres infras et abstractions sur
plusieurs decennies, capable de migrer ses workloads cloud sans
disruption. Snowflake architecturee multi-cloud par construction des
le jour un, peut basculer AWS / Azure / GCP au niveau du compte
client. Stripe qui depend des banques et des reseaux carte mais avec
redondance massive et plus de cinq processeurs en parallele sur
chaque corridor. Anthropic et OpenAI qui dependent de Nvidia mais
avec des contrats long-terme et des plans documentes TPU Google,
AMD et silicon proprietaire. GitLab portable par construction,
deployable on-premises chez le client. Datadog qui agrege plus de
500 integrations avec un coeur produit qui ne depend d aucune
specifique. Adyen qui contrairement a Stripe est detenteur de
licences bancaires europeennes et opere ses propres rails, donc
sans dependance processeur.

La distinction n est jamais le simple fait de dependre d un
fournisseur. C est l asymetrie, l absence de plan de sortie et
l absence de differenciation au-dessus du fournisseur. Snowflake
depend d AWS plus qu une PME francaise typique, mais Snowflake n est
pas Infrastructure Hostage parce que la dependance est diversifiee,
contractualisee, et la valeur produite est specifiquement au-dessus
de l infrastructure.

## Sources que le moteur doit interroger

Pitch deck pour les claims sur la stack technique, les partenariats
strategiques et la differenciation. BP pour la ligne COGS detaillee
par fournisseur quand elle est disponible (sinon on travaille sur
les agregats et on demande la decomposition en DD).

Web search agressif sur les annonces recentes des fournisseurs
critiques identifies. Pour OpenAI, Anthropic, Google AI, on cherche
les changements de pricing et de policy des 12 derniers mois. Pour
AWS, Azure, GCP, on cherche les egress fees, les changements de
service tier, les annonces strategiques. Pour Stripe et Adyen, on
cherche les changements de fee. Pour Apple et Google App Stores, on
cherche les arrets ou modifications de regles.

Documentation publique des fournisseurs, terms of service, pricing
pages. Le moteur peut faire un fetch direct des pages de pricing
des fournisseurs cites pour verifier les claims du pitch sur les
couts unitaires.

DD technique quand elle est disponible : architecture, dependances
explicites, plan de portabilite. Le moteur recommande
systematiquement la DD technique dans la liste des actions a mener
quand le pattern est detecte avec score moyen ou eleve.

Outils tiers : G2 et StackShare pour cross-verifier les stacks
declarees. LinkedIn job postings pour reperer les recrutements
explicitement multi-cloud ou portability-focused, signal indirect
de plan de sortie.

## Format de l output

Pour chaque axe, score 0-100, evidence pro chiffrees, evidence
contra chiffrees, confidence. Score global Infrastructure Hostage.
Counter-archetype le plus proche identifie et justifie.

Liste structuree des dependances critiques identifiees, avec pour
chacune : nom du fournisseur, service utilise, part estimee du COGS,
existence d un plan de sortie, presence d alternatives qualifiees.

Recommandation DD specifique. Sur ce pattern, la recommandation est
presque toujours une demande de stack diagram complet avec ratios
de cout par fournisseur, plus une demande explicite de plan de
portabilite chiffre quand il n est pas dans le pitch.

## Conditions de remontee a la couverture de la note

Pattern remonte sur la page de couverture si score global superieur
ou egal a 60 ET au moins deux axes individuels superieurs ou egaux
a 50. Pour les wrappers d API LLM pure-play en seed sans plan de
differenciation articule, remontee directe en drapeau-rouge meme a
score modere, parce que la trajectoire est connue.

## Methode anti-hallucination

Le LLM ne peut pas conclure a Infrastructure Hostage sur des
impressions du type cette boite est trop dependante a OpenAI. Il
doit nommer le fournisseur precis, le service precis, le pourcentage
de dependance ou la mesure d asymetrie, et citer la source dans le
dossier ou sur le web. Tag obligatoire :

- [pitch] pour les declarations du pitch
- [bp] pour les chiffres du business plan
- [tech] pour la DD technique quand disponible
- [web] pour les changements documentes des fournisseurs et pour
  les benchmarks tiers
- [inference] pour les calculs derives, avec la formule explicite

Si le LLM dit dependance critique a Nvidia, il doit nommer le
pourcentage de la stack ou la chaine de valeur exacte. Si le LLM
dit pas de plan de sortie, il doit avoir verifie l absence dans
le pitch et le BP, pas l avoir presumee.

Contrainte de coherence avec les metriques objectives. Si plus de
60% du COGS technique est sur un seul fournisseur ET aucun plan de
bascule documente, globalInfrastructureHostageScore superieur ou
egal a 70 force. Si moins de 25% de COGS sur le fournisseur le plus
gros ET architecture portable documentee, score inferieur ou egal a
30 sauf evidence forte de cannibalisation directe.

## Difference avec les patterns voisins

Avec Macro Geopolitical de la matrice de pertinence existante. Le
moteur Macro regarde l exposition geopolitique d un dossier UE ayant
un hyperscaler hors-UE, a la lumiere du cycle reglementaire, des
sanctions, des relations sino-americaines. Infrastructure Hostage
regarde l asymetrie economique et la captivite, independamment de
la geopolitique. Les deux peuvent s activer ensemble sur un meme
dossier sans redondance, parce que ce sont deux lectures
distinctes : politique pour Macro, economique pour Hostage.

Avec Internal Reality Leak du moteur Narrative Drift. Internal Reality
Leak est le miroir narratif d Infrastructure Hostage, il regarde si
la communication de l entreprise minore ou cache la dependance.
Infrastructure Hostage regarde la realite structurelle, Internal
Reality Leak regarde la verite du discours sur cette realite. Une
boite peut etre Infrastructure Hostage sans Narrative Drift si elle
est lucide et le dit ouvertement. Inversement, une boite peut etre
en Narrative Drift sans Infrastructure Hostage si la dependance est
maitrisee mais que la communication brouille les pistes.

Avec Commoditization Drift du futur moteur Fragilite Structurelle.
Commoditization Drift regarde la perte de moats face aux outils IA
qui rendent imitable ce qui etait differencie. Infrastructure Hostage
regarde la captivite vis-a-vis des fournisseurs. Une boite peut etre
captive d OpenAI sans etre commoditisee, et une boite peut etre
commoditisee par les outils IA sans etre captive d un fournisseur
unique.

Avec Aveuglement aux Couts Caches du moteur 8 actuel. Le moteur 8
detecte l aveuglement psychologique du fondateur sur les couts. Il
porte sur le DENI. Infrastructure Hostage detecte la realite
structurelle de la dependance. Un fondateur peut parfaitement etre
lucide sur sa dependance Nvidia sans avoir d alternative, ce qui
annule l aveuglement mais pas Infrastructure Hostage. La matrice de
pertinence active aveuglement en early stage et Infrastructure
Hostage en growth stage.
