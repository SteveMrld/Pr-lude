# Pattern Commoditization Drift

Fiche de specification du moteur. Premiere version, redigee en session
conceptuelle. A integrer ulterieurement dans lib/engines/.

## Definition

Une entreprise dont la defensibilite repose sur des barrieres
(produit, technique, expertise, contenu, processus) qui sont en
train de devenir reproductibles ou contournables par des outils
d intelligence artificielle generative, ou plus largement par une
baisse de cout technologique observable. La position concurrentielle
s erode mecaniquement, sans que l entreprise ait construit de
nouveaux moats pour la remplacer. Quand l erosion est complete,
l entreprise se retrouve sans avantage structurel et bascule en
competition sur le seul prix, generalement contre des challengers
beaucoup plus capital-efficient.

Le pattern n est pas l absence de moats actuels, qui est le cas de
toute jeune entreprise et qui se construit progressivement avec la
maturite. Le pattern apparait quand un moat existant qui justifiait
la valorisation premium se trouve attaque par une innovation
exterieure qui le rend reproductible en jours plutot qu en annees,
et que l entreprise ne dispose pas d un plan documente de
reconstruction sur un autre axe de defensibilite.

L ere des modeles de langage genereaux a accelere ce pattern de
maniere systemique a partir de fin 2022. Chegg, dont la valeur
reposait sur le tutorat education en ligne et les bibliotheques de
solutions a problemes, a vu sa valorisation s effondrer de 10
milliards de dollars en 2021 a moins d un milliard en 2024 quand
ChatGPT a rendu gratuit ce qu elle vendait par abonnement. Stack
Overflow a vu son trafic se diviser par deux apres la sortie de
GitHub Copilot et ChatGPT, parce que le besoin meme de poser une
question a la communaute disparaissait. Les services de traduction
traditionnels grand public, longtemps proteges par la difficulte
technique de la traduction automatique de qualite, ont vu leur
pricing s effondrer apres la generalisation de DeepL puis des
modeles de langage. Les agences de copywriting de moyen segment ont
perdu une part significative de leurs clients, qui ont remplace une
prestation a 500 euros par une consultation gratuite avec ChatGPT.

Le pattern depasse l intelligence artificielle et touche toute
categorie ou un saut de productivite externe rend obsolete une
specialisation. Les agences SEO ont ete cycliquement attaquees par
les changements d algorithme Google qui rendaient inutiles certaines
pratiques. Les services de gestion de paie traditionnels ont ete
attaques par l automatisation comptable. Les conseillers fiscaux
generalistes face aux outils declaratifs en ligne. Le mecanisme
reste le meme : une expertise qui justifiait un prix premium devient
accessible gratuitement ou a un cout marginal, et la marge
disparait.

## Stade d application

Pertinent des la Series A pour les boites dont la valeur repose sur
du knowledge work, du software ergonomique, ou du contenu cognitif.
Critique en Series B et au-dela parce que c est a ce stade que le
moat est cense exister et tenir, et que la valorisation suppose sa
robustesse.

Tres critique en growth et pre-IPO pour les modeles content,
knowledge work et SaaS legacy. Pour ces dossiers, le moteur est
quasiment automatiquement applicable, et l absence d une analyse
explicite de la robustesse face aux outils IA dans le pitch et le
BP est un signal en soi.

S applique avec un poids special aux modeles SaaS verticaux dont la
valeur principale est l UI complexe permettant l usage d un domaine
metier. Un certain nombre de SaaS ont construit leur defensibilite
sur la difficulte d apprendre une interface specialisee, defensibilite
qui s evapore quand un agent conversationnel peut conduire le meme
travail en langage naturel.

Ne s applique pas, ou seulement en partial, aux modeles
hardware-physical, infrastructure-physical, et aux services a
composante physique forte ou la valeur produite necessite une
presence operationnelle terrain non automatisable a court terme.

## Trois axes de mesure

### Axe 1 : nature et profondeur des moats actuels

Mesure de la solidite des barrieres existantes. Trois sous-modules.

Premier sous-module, identification des moats declares et verification
de leur realite. Le moteur croise les claims du pitch avec les
elements observables. Si le pitch revendique un network effect, le
moteur cherche les marqueurs : croissance non-lineaire des
utilisateurs en fonction de la taille de la base, NRR superieur a
120%, viralite organique mesuree. Si le pitch revendique des donnees
proprietaires, le moteur cherche le volume, la duree d accumulation,
la proprietarite contractuelle, et l absence de sources alternatives.
Si le pitch revendique un brand, le moteur cherche l aided awareness,
le premium pricing, le NPS. Les moats declarés mais non verifiables
sont marques comme tels et ne contribuent pas a l axe.

Deuxieme sous-module, cumul de moats independants. Une defensibilite
qui repose sur un seul moat est fragile par nature. Une defensibilite
qui empile plusieurs moats independants resiste mieux a la
commoditisation parce que l attaquant doit casser plusieurs serrures
en parallele. Stripe combine reseau de banques partenaires, donnees
de detection de fraude, integrations developpeurs cumulees,
agrements bancaires propres, brand. Salesforce combine donnees
clients verrouillees, ecosysteme partenaires, switching cost
operationnel, distribution enterprise. Le moteur compte les moats
distincts vraiment independants.

Troisieme sous-module, capital et temps requis pour repliquer la
position. Plus le replication cost est eleve, plus le moat est
profond. Pour un SaaS dont la valeur est une UI compliquee
verticalement specialisee, le replication cost peut etre de 12 mois
de developpement et 5 millions de dollars, ce qui est faible et
suffit a peine a un moat. Pour un marketplace avec network effects
matures, le replication cost peut etre de 200 millions de dollars
et 7 ans, ce qui est massif. Le moteur cherche un ordre de grandeur.

### Axe 2 : exposition a la dereliction technologique

Mesure de la part de la valeur produite par l entreprise qui peut
etre attaquee par les outils existants ou en developpement
documente. Quatre sous-modules.

Premier sous-module, automatisation par les modeles de langage
generaux. Quel pourcentage de la valeur produite est-il
substituable par une utilisation directe d un LLM general
(ChatGPT, Claude, Gemini), eventuellement avec un peu de prompt
engineering ? Pour les services de copywriting basique, ce
pourcentage est superieur a 80%. Pour les agences de traduction
generaliste, superieur a 90%. Pour les SaaS de helpdesk de niveau
1, superieur a 70%. Pour les fonctions plus specialisees, le
pourcentage diminue mais reste significatif.

Deuxieme sous-module, automatisation par les outils IA verticalises.
Si la categorie de l entreprise a deja vu apparaitre des challengers
IA-native dedies, le moteur les liste avec leur traction. Cursor et
Codeium dans le code, Vercel v0 dans le frontend, Harvey dans le
legal, Hippocratic AI dans le medical, Decagon dans le customer
support. La presence de tels challengers signe une categorie en
attaque active.

Troisieme sous-module, signaux d erosion deja materialises. Le
moteur cherche les marqueurs de pression concurrentielle dans la
trajectoire commerciale recente : pricing en baisse de plus de 10%
sur 12 mois, churn anormalement eleve, NRR en degradation, taux de
conversion en chute, augmentation des cycles de vente. La
materialisation de l erosion transforme une exposition theorique en
risque present.

Quatrieme sous-module, horizon technologique probable. Au-dela de
l etat actuel, le moteur evalue ce qui sera possible dans les 24
prochains mois compte tenu des trajectoires de capabilities
documentees. Les agents autonomes capables d executer des taches
multi-etapes sur ordinateur sont deja en alpha en 2025-2026. Cela
signifie qu une categorie supplementaire de SaaS ergonomique va
basculer dans la zone d attaque a horizon court. Le moteur le note.

### Axe 3 : capacite a reconstruire ou cumuler de nouveaux moats

Mesure du plan defensif documente. C est le mitigant majeur du
pattern. La presence d un risque commoditisation n est pas une
condamnation si l entreprise transfere activement sa
defensibilite vers d autres axes.

Construction active de moats hors du perimetre attaquable. Le moteur
cherche les marqueurs concrets : accumulation de donnees
proprietaires non repliquables, construction de network effects
mesures, acquisition d agrements ou de licences exclusives,
partenariats de distribution captive, integrations OS ou plateforme
non disponibles aux challengers. Si l entreprise est en train de
construire activement, mitigant fort.

Plan documente de transition. Le pitch et le BP contiennent-ils une
analyse explicite de la commoditisation potentielle et un plan de
reaction ? La presence d une telle analyse est en soi un signal
positif sur la maturite strategique du management. Son absence sur
un dossier dont la categorie est manifestement attaquee est un
signal negatif majeur.

Execution deja commencee avec marqueurs operationnels. Le moteur
cherche les preuves d execution : acquisitions strategiques recentes
visant a acquerir des moats, recrutements explicitement orientes
vers la construction de differenciation (data engineering pour les
moats data, BD enterprise pour les moats distribution), produits
lances qui materialisent la transition. La distinction entre plan et
execution est cruciale parce que les plans sont gratuits, l execution
ne l est pas.

## Conditions d application strictes

Le moteur ne se declenche que si la nature de l activite du dossier
est clairement identifiable et appartient a la liste des categories
exposees ou non.

- Knowledge work, SaaS ergonomique, content, code, design = full
- Modeles hybrides cognitif et physique = partial (axes 2 et 3
  actifs, axe 1 partiel selon les composantes)
- Hardware-physical, infrastructure-physical, services a forte
  composante physique = not-applicable
- Modeles fortement regules ou avec licences exclusives, meme si
  cognitifs (banque privee, gestion d actifs reglementee, conseil
  juridique avec barreau) = partial avec rationale specifique

Hors scope explicite : le moteur ne formule pas de jugement sur la
qualite du produit ou la valeur intrinseque de la prestation. Il
mesure la capacite de l entreprise a maintenir un avantage
defensable, pas la qualite de ce qu elle vend.

## Evidence factuelle requise pour score >= 60

Au moins trois evidences chiffrees ou citees parmi les suivantes.
Le seuil est exigeant parce que beaucoup de dossiers operent dans
des categories partiellement exposees sans pour autant etre
condamnes, et le moteur doit discriminer.

- Les moats declares dans le pitch reposent principalement sur du
  knowledge work, de l UI complexe, ou de l expertise
  individuelle, sans cumul d autres axes verifiables
- Au moins un challenger IA-native a leve plus de 50 millions de
  dollars dans la categorie ou un acteur generaliste a publie une
  fonctionnalite directement substituable
- Pricing en baisse documentee de plus de 10% sur les 12 derniers
  mois, ou cycles de vente allonges de plus de 30%
- Churn anormalement eleve dans le segment de marche le plus
  expose aux outils IA, comparable au benchmark sectoriel
- Aucune analyse explicite de la commoditisation dans le pitch et le
  BP, ou analyse limitee a une mention generale sans plan
- Aucun moat alternatif en construction documentee : pas
  d acquisition recente orientee data ou distribution, pas de
  recrutement strategique sur les axes hors-cognitif, pas de
  produit lance dans cette direction
- Replication cost de la position estime a moins de 12 mois de
  developpement et moins de 10 millions de dollars
- Categorie attaquee depuis plus de 24 mois sans pivot strategique
  visible

Le moteur doit nommer chaque element avec precision. Pas de
generalite type concurrence IA sans nommer l outil ou le produit
specifique.

## Evidence contradictoire obligatoire

Le moteur cherche symetriquement ce qui contredit le pattern.

- Network effects mesurables et en croissance, avec ratios de
  croissance non-lineaire de la base utilisateurs vs valeur produite
- Donnees proprietaires non repliquables avec volume, duree
  d accumulation, et proprietarite contractuelle clairs
- Verrouillage reglementaire ou licensing exclusifs documentes
- Distribution captive : integrations OS ou plateforme exclusives,
  partenariats long-terme avec breakage couteux
- Brand reconnu avec premium pricing maintenu malgre l arrivee de
  challengers, NPS eleve documente
- Switching costs structurels eleves : workflow operationnels
  enchasses, formation utilisateurs, integrations multi-systemes,
  donnees historiques verrouillees
- Cumul de plusieurs moats independants
- Pivot strategique deja conduit avec succes en reaction a une
  vague precedente de commoditisation
- Acquisitions ou partenariats recents orientes vers la construction
  de moats hors-cognitif

Si l evidence contraire pese 50 quand l evidence pro pese 60, le
pattern est marque unresolved. Sur ce pattern, le risque de
sur-detection est eleve parce que la couverture mediatique sur l IA
genere un biais de confirmation. Le moteur doit garder la rigueur.

## Counter-archetypes

### Patterns confirmes (erosion materialisee)

Chegg sur la periode 2022-2024, valorisation effondree de 10
milliards a moins d un milliard, abonnements en chute libre apres
la generalisation de ChatGPT. Stack Overflow sur la periode
2023-2025, trafic divise par deux apres GitHub Copilot et ChatGPT,
restructuration et licenciements. Les services de traduction
generaliste grand public, dont une grande partie de l offre a ete
cannibalisee par DeepL puis par les LLMs. Les sites de questions-
reponses generalistes type Quora et autres, dont la fonction
sociale subsiste mais dont la fonction d acquisition de connaissance
a basculé vers les modeles. Les plateformes de freelance pour
copywriting basique et traduction generale, marges en compression
et volumes en baisse. Une partie significative des SaaS de
helpdesk de niveau 1, attaqués par les bots conversationnels et les
solutions integres dans les CRM. Les outils de generation de logo
et de stock photo basique, attaqués par Midjourney et DALL-E. Les
plateformes de tutoring generaliste, en compression sur le segment
academic standard.

### Counter-archetypes sains

Stripe, dont la defensibilite repose sur un cumul de moats
independants : reseau de banques partenaires construit sur quinze
ans, donnees de detection de fraude au volume sans equivalent,
integrations developpeurs cumulees, agrements bancaires propres, et
brand. La commoditisation d une fonctionnalite isolee n attaque
qu une partie d un edifice multi-couches.

Salesforce, dont la defensibilite repose sur des donnees clients
verrouillees, un ecosysteme partenaires gigantesque, des switching
costs operationnels enormes, et une distribution enterprise nee de
trois decennies de presence. Les outils IA peuvent ameliorer
l usage de Salesforce, ils ne peuvent pas remplacer Salesforce sans
attaquer ces quatre couches en parallele.

Bloomberg, dont la defensibilite combine des donnees proprietaires
financieres, une plateforme de communication community,
l integration historique dans les workflows de trading, et un
hardware terminal exclusif. La commoditisation des modeles de
langage attaque la production de notes de marche, mais Bloomberg a
rapidement integre les LLMs dans son terminal sans entamer ses
moats structurels.

Adyen, dont la defensibilite combine des licences bancaires propres
dans plusieurs juridictions, des donnees de flux paiement
proprietaires, et des contrats enterprise long terme. Le
positionnement reglementaire est par construction difficile a
commoditiser.

Verticales avec donnees proprietaires structurelles. Clio dans le
legal accumule des donnees workflow juridique non publiques. Toast
dans la restauration accumule des donnees de transaction et
operations restaurants. Procore dans la construction accumule des
donnees de chantier multi-acteurs. Ces categories beneficient d un
moat data qui se renforce avec le temps et que les LLMs ne peuvent
pas combler.

Marketplaces avec network effects matures. Booking, Airbnb dans le
voyage. Doctolib dans la sante. Schibsted classifieds dans plusieurs
pays nordiques. Le coute de reconstruction d un side du
marketplace est massif et croit avec la maturite.

La distinction structurale n est jamais le simple fait d operer dans
une categorie cognitive. C est la nature et le cumul des moats. Une
agence de copywriting basique avec un seul moat (la qualite de
prestation) est exposee. Bloomberg avec quatre moats independants
ne l est pas, meme dans une categorie cognitive. La commoditisation
attaque les monomoats.

## Sources que le moteur doit interroger

Pitch deck pour les claims sur la defensibilite. La presence ou
l absence d une analyse explicite des moats et de leur robustesse
face aux outils IA est un signal sur la maturite strategique du
management.

BP pour les marges, le pricing, les unit economics. La trajectoire
de pricing dans le BP est revelatrice : un BP qui projette une
hausse de pricing dans une categorie attaquee est en deni, un BP
qui projette une baisse assume la realite et merite credit.

Web search agressif sur les concurrents IA-native dans la categorie.
Recherches type categorie + AI + startup + funding sur les 24
derniers mois. Le moteur cherche la traction comparative : levees,
clients revendiques, presse specialisee.

G2, Capterra, Product Hunt pour le sentiment utilisateur sur la
categorie. Une evolution recente du sentiment ou de la nombre de
reviews vers les solutions IA-native indique une bascule en cours.

LinkedIn pour les recrutements strategiques recents de l entreprise.
Le moteur cherche les nouveaux postes orientes data engineering,
acquisition strategy, BD enterprise, distribution. Si tous les
recrutements restent sur les fonctions historiques, signal de
status quo.

Filings et compte rendus financiers pour les boites cotees ou ayant
des donnees publiques. Le moteur cherche les commentaires de
direction sur la commoditisation et la reponse strategique.

Les counter-archetypes Stripe, Salesforce, Bloomberg, Adyen sont des
references constantes. Le moteur les invoque systematiquement comme
points de comparaison pour qualifier la robustesse des moats du
dossier.

## Format de l output

Pour chaque axe, score 0-100, evidence pro chiffree ou citee,
evidence contra chiffree ou citee, confidence. Score global
Commoditization Drift. Counter-archetype le plus proche identifie et
justifie.

Tableau structure des moats identifies avec pour chaque ligne : nom
du moat, type (network effect, data, distribution, brand, regulation,
expertise, switching cost), verifiabilite (verifie, declare,
incontrole), profondeur estimee, exposition aux outils IA, plan de
renforcement observe. Ce tableau est le livrable principal du
pattern, plus important que le score lui-meme.

Recommandation DD specifique. Sur ce pattern, la recommandation est
typiquement une demande d analyse comparative avec deux ou trois
challengers IA-native cites par le moteur, plus une demande de plan
strategique ecrit sur la robustesse des moats face a un horizon 24
mois IA. Pour les categories les plus attaquees, le moteur peut
recommander un test utilisateur direct comparant la prestation du
dossier avec une utilisation directe d un LLM general.

## Conditions de remontee a la couverture de la note

Pattern remonte sur la page de couverture si score global superieur
ou egal a 60 ET au moins deux axes individuels superieurs ou egaux
a 50. Pour les dossiers dans des categories deja effondrees ou en
effondrement actif (knowledge Q&A, copywriting basique, traduction
generaliste, helpdesk niveau 1), remontee directe en drapeau-rouge
meme a score modere, parce que la trajectoire est connue.

Si Commoditization Drift remonte ET que Growth Subsidized Model
remonte aussi, la combinaison est marquee sur la couverture comme
exposition double. La marge unitaire dejà negative ne peut pas etre
restauree par hausse de pricing dans une categorie commoditisee. La
trajectoire converge vers la faillite.

## Methode anti-hallucination

Le LLM ne peut pas conclure a Commoditization Drift sur des
impressions type categorie menacee par l IA. Il doit nommer le
moat precis attaque, le mecanisme d erosion, et idealement le ou
les outils ou produits qui materialisent l attaque. Tag obligatoire :

- [pitch] pour les declarations du pitch
- [bp] pour les chiffres et trajectoires du business plan
- [web] pour les concurrents IA-native, les annonces de produits,
  les benchmarks tiers
- [g2] pour les signaux utilisateurs
- [linkedin] pour les recrutements strategiques
- [filings] pour les commentaires direction des boites cotees
- [inference] pour les calculs derives ou les jugements
  probabilistes sur les capabilities futures, avec la base
  explicite

Si le LLM dit moat fragile, il doit nommer le moat et le mecanisme
specifique d erosion. Si le LLM dit pas de plan strategique, il
doit avoir verifie l absence dans le pitch et le BP, pas l avoir
presumee. Si le LLM cite un challenger IA-native, il doit nommer le
produit, l entreprise et le montant leve recent.

Contrainte de coherence avec les metriques objectives. Si valeur
principale en knowledge work ET pas de network effects ET pricing en
baisse documentee, globalCommoditizationDriftScore superieur ou
egal a 70 force. Si cumul demontré de trois moats independants ET
absence de signaux d erosion materialises, score inferieur ou egal
a 30 sauf evidence forte de basculement imminent.

## Difference avec les patterns voisins

Avec Infrastructure Hostage. Hostage regarde la captivite externe
vis-a-vis des fournisseurs : l entreprise est captive d AWS, OpenAI,
Stripe. Commoditization Drift regarde l erosion cote demande : les
clients de l entreprise peuvent desormais se servir directement
d outils generaux et n ont plus besoin de la prestation. Les deux
patterns peuvent se cumuler sur un meme dossier, ce qui est
particulierement defavorable. Une boite peut etre captive d OpenAI
ET commoditisee par OpenAI au meme moment, le pattern ultime du
wrapper sans differenciation.

Avec Growth Subsidized Model. Growth Subsidized regarde si chaque
transaction marginale cree de la valeur, c est un probleme d unit
economics. Commoditization Drift regarde si la position
concurrentielle reste defendable, c est un probleme de pricing
power. La combinaison des deux patterns est une signature de fin
de cycle : la marge est negative ET la pricing power s erode, donc
l unit economics ne peut pas etre restauree. La trajectoire est
quasi mecanique.

Avec marketAiReplicability de la matrice de pertinence existante.
La matrice regarde la reproductibilite numerique du modele : peut-il
etre copie digitalement par un nouvel entrant. C est une mesure de
barriere a l entree. Commoditization Drift regarde l erosion active
des moats face aux outils IA, c est-a-dire la dynamique dans le
temps. Une boite peut avoir une faible reproductibilite numerique
(donc une barriere haute) ET subir un Commoditization Drift si les
outils IA changent l economie de la categorie au-dela de la simple
question de la reproductibilite. Les deux mesures sont
complementaires.

Avec Aveuglement Concurrentiel du moteur 8 actuel. Le moteur 8
detecte le DENI psychologique du fondateur sur les concurrents et la
trajectoire competitive. Commoditization Drift detecte la REALITE
structurelle de l erosion. Un fondateur peut etre parfaitement
lucide sur l attaque IA et le dire ouvertement, ce qui annule le
deni mais pas Commoditization Drift si la position est effectivement
en train de s eroder. Inversement, un fondateur peut etre dans le
deni alors que la position est solide, ce qui declenche
l aveuglement mais pas Commoditization Drift.

Avec Internal Reality Leak du moteur Narrative Drift. Internal
Reality Leak regarde si la communication de l entreprise minore ou
cache les signaux d erosion. Commoditization Drift regarde l erosion
elle-meme. Les deux peuvent se cumuler, et la combinaison est
particulierement diagnostique : une entreprise dont les moats
s erodent et dont le discours cache cette erosion converge vers le
pattern Theranos en version commerciale plutot que medicale.
