# Pattern Regulatory Time Bomb

Fiche de specification du moteur. Premiere version, redigee en session
conceptuelle. A integrer ulterieurement dans lib/engines/.

## Definition

Une entreprise dont le modele economique repose sur un etat
reglementaire actuel destine a changer dans une fenetre temporelle
previsible, sans que l entreprise ait prepare sa transformation ou
son positionnement post-changement. Le pattern n est pas la simple
existence d un risque reglementaire, qui est inherent a toute
activite regulee, mais l absence de scenario chiffre et execute pour
absorber le changement. Quand la regulation arrive, l entreprise est
prise sans plan.

Trois sous-types canoniques se distinguent par la nature de la
prevision possible et structurent la lecture du moteur.

Le premier sous-type est la regulation a venir connue. Le texte
legislatif est dans le pipeline parlementaire, sa date d entree en
vigueur est publique, son contenu est arbitre. L entreprise opere
comme si la regulation ne s appliquerait pas, ou minore son impact.
C est le cas d Uber face a la Californie AB5 en 2019, dont
l adoption etait deja votee quand l entreprise a continue a operer
en classification contractor sans preparation. C est le cas des
BNPL europeens face a la directive credit consumer revisee CCD2,
publiee en 2023, applicable depuis novembre 2026, qui oblige les
acteurs a passer sous regime etablissement de credit. Klarna a
prepare sa licence credit institution des 2022, BNPL plus jeunes
ont decouvert l obligation au moment de son entree en vigueur.

Le deuxieme sous-type est la regulation existante mal appliquee.
La loi est en place mais le regulateur ne l applique pas activement.
L entreprise opere dans la zone grise, parfois consciemment, parfois
en revendiquant que sa categorie n est pas couverte. Le risque est
l application soudaine, generalement declenchee par un incident
mediatique ou un changement politique. C est le cas d Airbnb face
aux reglements meubles touristiques de Paris, Barcelone, New York,
appliques durement a partir de 2018-2020 alors qu ils existaient
sur le papier depuis longtemps. C est le cas des plateformes crypto
americaines face aux Securities Acts, dont l application par la SEC
s est intensifiee en 2022-2023, declenchant les effondrements en
chaine FTX, Celsius, Voyager, BlockFi.

Le troisieme sous-type est la regulation future probabiliste. Le
texte n existe pas encore mais le precedent politique annonce sa
venue dans 24 a 48 mois. Le moteur ne peut pas conclure
deterministe sur ce sous-type, mais il peut le marquer comme
exposition probabiliste a investiguer. C est le cas de l intelligence
artificielle generative face a l AI Act europeen, dont les
dispositions general purpose AI sont entrees en vigueur en aout
2025 et dont la mise en oeuvre operationnelle se deploie sur
2025-2027. C est le cas des plateformes Web3 face au reglement
MiCA, applicable depuis decembre 2024, dont les implementations
nationales continuent en 2026.

## Stade d application

Pertinent pour tous les stades, des le pre-seed, si le business est
par construction regule ou opere dans une zone grise reglementaire.
Le pattern ne suit pas la logique des autres patterns Phase 4 ou la
matiere apparait progressivement avec la croissance. Une regulation
a venir frappe la jeune boite avec la meme force que la mature.

Critique en Series A et au-dela parce que le passage a l echelle
attire l attention reglementaire et fait basculer le dossier de
zone grise toleree a cible visible. Tres critique en pre-IPO parce
que la diligence legale du book builder sera exhaustive et que les
omissions reglementaires sont parmi les premiers motifs de prix
dilue ou de pull.

S applique aux secteurs explicitement regules : finance, sante,
defense, telecom, media classique, energie, transport, education
formelle, immigration, jeu d argent. S applique aussi aux secteurs
en train de basculer dans le perimetre regulatoire : intelligence
artificielle, plateformes numeriques au-dessus du seuil DSA, crypto
et stablecoins, gig economy, biotech direct-to-consumer, drones et
mobilite aerienne, neurotechnologies.

Ne s applique pas, ou seulement en partial, aux SaaS B2B pure non
regules sectoriellement, aux marketplaces B2B sans flux financier
intermedies, aux dossiers content production hors regulation
specifique.

## Trois axes de mesure

### Axe 1 : exposition reglementaire structurelle

Mesure de la dependance du modele economique a un etat reglementaire
qui peut changer. Trois sous-modules.

Premier sous-module, dependance du modele a une zone grise actuelle.
Le moteur identifie si une partie significative du revenu repose
sur une categorie d activite dont le statut legal est conteste, mal
defini ou en cours de redefinition. Pour les BNPL avant CCD2, la
zone grise etait la qualification credit a la consommation. Pour
les VTC avant les regulations transport pays par pays, la zone
grise etait la classification chauffeur contractor. Plus de 50% du
revenu en zone grise, signal fort.

Deuxieme sous-module, multiplicite des juridictions exposees. Une
exposition reglementaire dans une seule juridiction est gerable,
souvent par lobbying ou pivot ciblé. Une exposition dans dix
juridictions multiplie la complexite et reduit la marge de manoeuvre.
Le moteur cherche le nombre de pays ou Etats ou la zone grise
existe pour le modele du dossier.

Troisieme sous-module, actions regulatrices deja engagees. Le moteur
cherche les actions formelles initiees contre l entreprise ou contre
des acteurs de sa categorie : enquetes, mises en demeure, sanctions,
rappels, audits formels. Une action engagee transforme l exposition
abstraite en risque materialise.

### Axe 2 : visibilite du changement a venir

Mesure de la prevision possible. Plus le changement est previsible,
plus l absence de preparation est grave parce que le management ne
peut pas plaider la surprise. Trois sous-modules.

Premier sous-module, presence d un texte legislatif date dans le
pipeline parlementaire. Le moteur cherche les textes en debat dans
les parlements pertinents (Union europeenne via le trilogue,
parlements nationaux, Congres americain, parlements asiatiques)
qui visent explicitement la categorie d activite du dossier. Date
prevue d entree en vigueur, contenu connu, deja vote ou en
deuxieme lecture, autant d indicateurs de prevision haute.

Deuxieme sous-module, precedent politique recent. Si une categorie
voisine a deja ete reglementee dans les 24 derniers mois, la
probabilite que le legislateur etende est elevee. Le moteur peut
identifier les chains de regulation type : DSA puis DMA puis AI
Act, ou GDPR puis ePrivacy puis Data Act. La logique d empilage
est connue.

Troisieme sous-module, durcissement des actions des regulateurs sur
la categorie. Le moteur cherche les declarations publiques recentes
des chefs de regulateurs pertinents, les rapports parlementaires,
les avis des autorites independantes. Une convergence de signaux
dans un meme sens, repetee sur plusieurs mois, prefigure une
reglementation. Hindenburg-style sur les SPACs en 2020 a precede
les reformes SEC de 2022.

### Axe 3 : preparation documentee du changement

Mesure de la capacite reelle de l entreprise a absorber le
changement. C est le mitigant majeur du pattern. La presence du
risque reglementaire n est pas une condamnation si l entreprise
l adresse activement.

Existence d une fonction compliance dotee. Le moteur cherche un
compliance officer, un DPO ou un general counsel a l organigramme,
avec un budget et un perimetre defini. Pour les boites a Series B
et au-dela operant dans des secteurs regules, l absence de cette
fonction est un signal fort. Pour les boites plus jeunes, le moteur
cherche au moins un advisor expert ou un cabinet conseil documente.

Plan documente de transition vers le post-changement. Le moteur
cherche dans le pitch et le BP la presence d un scenario qui
modelise l etat post-regulation : revenu attendu, marges, capex
necessaire pour la mise en conformite, calendrier d execution. Si
le plan existe avec des milestones chiffres et un budget, mitigant
significatif. Si le plan est un slide marketing sans details,
mitigant declaratif uniquement.

Lobbying actif documente. Pour les regulations en pipeline, la
presence d une activite de plaidoyer aupres des regulateurs et des
parlementaires est un signal de preparation reelle. Le moteur
cherche les depots aupres des registres de transparence (Union
europeenne, Etats-Unis), les positions publiques de l entreprise,
les associations sectorielles dont elle est membre active. La
Proposition 22 californienne d Uber en 2020 a coute 200 millions
de dollars et a ete une operation de lobbying decisive.

Approbations reglementaires deja obtenues. Pour les categories qui
basculent vers un regime d agrement, la presence d agrements deja
obtenus dans des juridictions cles est un mitigant fort. Klarna a
obtenu sa licence credit institution europeenne avant CCD2,
contournant le pattern. Stripe a obtenu son agrement etablissement
de paiement des 2017 en anticipation PSD2.

## Conditions d application strictes

Le moteur ne se declenche que si le secteur du dossier appartient a
la liste des secteurs regules ou en bascule reglementaire identifies
en stage d application. Pour les secteurs hors de cette liste,
status not-applicable avec rationale clair.

- Secteur regule + texte ou action documente = full
- Secteur en zone grise sans texte mais avec actions recentes = full
- Secteur en zone grise sans actions = partial (axes 1 et 3 actifs,
  axe 2 desactive faute de visibilite)
- Secteur hors regulation significative = not-applicable

Hors scope explicite : le moteur ne formule pas d avis sur
l opportunite politique d une regulation. Il observe le risque, il
ne prend pas position sur la justesse. La fiche de pattern reste
strictement instrumentale.

## Evidence factuelle requise pour score >= 60

Au moins deux evidences chiffrees ou documentees parmi les
suivantes. Le seuil necessite une combinaison entre exposition reelle
et absence de preparation, parce que l exposition seule est
inevitable dans certains secteurs.

- Au moins une juridiction ou une action regulatrice formelle est
  en cours ou pendante contre l entreprise ou des acteurs directs
  de sa categorie, citee avec source
- Un texte legislatif date avec contenu connu dans le pipeline
  parlementaire impactant directement le modele, cite avec
  reference et date d entree en vigueur prevue
- Aucun compliance officer ou DPO ou general counsel documente dans
  l organigramme du dossier alors que le secteur l exige a ce stade
- Aucune ligne budgetaire dediee a la mise en conformite dans le BP,
  alors que la regulation a venir necessite manifestement des
  investissements
- Le pitch et le BP ne mentionnent pas le risque reglementaire ou le
  minorent en une phrase generale sans plan d action
- Aucun agrement obtenu dans les juridictions ou il deviendra
  obligatoire dans les 24 prochains mois, sans timeline d obtention
- Track record de retard sur les obligations passees (depots tardifs,
  notifications oubliees, sanctions deja recues) demontrant une
  maturite compliance basse

Le moteur doit nommer chaque regulation precisement : texte, article
si pertinent, juridiction, date d entree en vigueur. Pas de
generalite type risques GDPR sans designation specifique.

## Evidence contradictoire obligatoire

Le moteur cherche symetriquement ce qui contredit le pattern. La
symetrie est cle parce que beaucoup de dossiers operent dans des
secteurs regules avec une compliance saine, et le pattern doit eviter
de criminaliser cette normalite.

- Compliance team structuree et dotee, avec roles documentes
  (compliance officer, DPO, general counsel) et budget visible
- Plan documente de transition vers le post-regulation avec
  milestones chiffres, budget, calendrier
- Lobbying actif et documente, avec depots transparency, positions
  publiques, membership associations sectorielles
- Approbations reglementaires deja obtenues dans les juridictions
  cles, avec dates et perimetre
- Pivots de modele deja conduits avec succes en reponse a des
  regulations passees, demontrant la capacite operationnelle
- Partenariats strategiques avec des acteurs regulatoires ou des
  acteurs deja conformes (banques pour les fintech, hopitaux pour
  les healthtech, operateurs telecom pour les services telecom)
- Architecture produit explicitement modulaire pour absorber les
  changements de regulation par couche (cas Adyen avec sa licence
  bancaire propre)
- Track record de proactivite : agrements obtenus avant
  l obligation, conformity ahead of schedule

Si l evidence contraire pese 50 quand l evidence pro pese 60, le
pattern est marque unresolved. Le rationale doit le dire explicitement
et la recommandation DD doit pointer ce qu il faut aller chercher
pour trancher : entretien avec le compliance officer, lecture des
agrements obtenus, audit du lobbying.

## Counter-archetypes

### Patterns confirmes (sanction, faillite ou pivot impose)

Theranos entre 2015 et 2018, claims marketing depassant les
approbations FDA reelles, declenchement d enquetes en serie SEC,
DOJ, FDA, CMS, faillite et procès penal. FTX et la chaine Celsius,
Voyager, BlockFi en 2022-2023, operation crypto US sans
qualification Securities Acts, intensification SEC, effondrements
domino. Uber dans la periode AB5 californienne 2019-2020,
classification contractor contestee, obligation Proposition 22 a
200 millions de dollars, accords subsequents pays par pays. Foodora
et plusieurs plateformes livraison europeennes 2018-2022,
requalification livreurs en employes dans plusieurs juridictions,
restructurations en chaine. Wirecard 2020, fraude comptable plus
defaillances regulatoires BaFin. N26 sanctionne par BaFin en 2021
pour insuffisance compliance lutte blanchiment, plafond impose sur
le rythme d acquisition clients pendant deux ans. Direct-to-consumer
genetics dans les annees 2010 face a la FDA, plusieurs entreprises
contraintes a retirer leurs produits du marche.

### Counter-archetypes sains

Stripe et son anticipation PSD2 des 2017, agrement etablissement de
paiement obtenu en avance de phase, evitement complet de la fenetre
de risque que d autres ont subi. Plaid et son anticipation Open
Banking aux Etats-Unis et en Europe, partenariats banques noues
avant l obligation reglementaire. Anthropic et son anticipation AI
Act europeen, frontier model commitments unilaterales en 2023, lab
safety policy publique, dialogues continus avec l AI Office
europeen depuis sa creation.

Airbnb post-2018 et sa transition compliance ville par ville, equipes
juridiques locales, accords avec municipalites, integration des
declarations dans le produit. Klarna apres 2022 et sa preparation
CCD2, obtention de la licence credit institution europeenne avant
l entree en vigueur, transition operationnelle reussie. Adyen et son
agrement etablissement de paiement obtenu en propre des 2010,
positionnant l entreprise au-dessus du regime PSP simple, mitigant
massif sur l ensemble des regulations bancaires europeennes
ulterieures.

La distinction structurale n est jamais le simple fait d operer dans
un secteur regule. C est l alignement entre la trajectoire
reglementaire previsible et la preparation operationnelle de
l entreprise. Stripe et Klarna operent dans le meme paysage
reglementaire que les BNPL aujourd hui en difficulte. La difference
est l anticipation. Airbnb et les plateformes meubles touristiques
operent dans le meme paysage reglementaire municipal. La difference
est l adaptation locale.

## Sources que le moteur doit interroger

Pitch deck pour les claims sur la regulation. La presence ou
l absence d une section reglementaire dans le pitch est en
elle-meme un signal sur la maturite compliance du management.

BP pour les lignes budgetaires compliance, juridique, lobbying.
Pour les boites Series B et au-dela operant dans un secteur regule,
l absence de ces lignes est un drapeau-rouge en soi.

EUR-Lex pour les textes europeens en pipeline et applicables. Le
moteur peut faire un fetch direct des textes pertinents quand
identifies. Pour les boites americaines, federalregister.gov,
sec.gov, ftc.gov, cfpb.gov pour les actions et proposed rules
recentes. Pour les boites britanniques, gov.uk et FCA.

Registres de transparence pour le lobbying. Registre europeen
transparency.europa.eu, registre americain LDA system,
homologues nationaux. La presence ou l absence de l entreprise et
la nature des activites declarees informe sur la maturite politique.

Web search agressif sur les actions regulatrices recentes contre
l entreprise et contre les acteurs de sa categorie. Recherches
ciblees du type entreprise + nom_regulateur, categorie + sanction,
secteur + investigation. Le moteur cherche les news des 24 derniers
mois en priorite.

Documents legaux quand ils sont disponibles : agrements, licenses,
filings reglementaires. Pour les boites US cotees, les 10K et 10Q
contiennent des sections detaillees sur les risques regulatoires,
exigees par la SEC.

DD juridique en cas d acces : avis externe sur la regulation
applicable, opinion legale sur la classification du modele,
historique des contentieux. La DD juridique est presque toujours
necessaire pour conclure solidement sur ce pattern, le moteur la
recommande systematiquement.

## Format de l output

Pour chaque axe, score 0-100, evidence pro chiffree ou citee,
evidence contra chiffree ou citee, confidence. Score global
Regulatory Time Bomb. Counter-archetype le plus proche identifie et
justifie.

Tableau structure des risques reglementaires identifies, avec pour
chaque ligne : nom du texte ou de l action, juridiction, statut
actuel (en pipeline, en vigueur, en application progressive), date
estimee de materialisation pour le dossier, impact estime sur le
revenu et la marge, etat de preparation observe. Ce tableau est le
livrable principal du pattern.

Recommandation DD specifique. Sur ce pattern, la recommandation est
typiquement une demande d entretien avec le compliance officer
quand il existe, plus un audit externe leger sur la conformite
actuelle dans la juridiction principale, plus une opinion legale sur
le scenario de classification post-changement. Quand le moteur
detecte une absence de fonction compliance dans un secteur qui
l exige, la recommandation devient un drapeau a remonter en pre-IC.

## Conditions de remontee a la couverture de la note

Pattern remonte sur la page de couverture si score global superieur
ou egal a 60 ET au moins deux axes individuels superieurs ou egaux
a 50. Pour les dossiers en zone grise reglementaire avec absence
totale de fonction compliance documentee, remontee directe en
drapeau-rouge meme a score modere, parce que la trajectoire est
empiriquement connue.

Si le pattern Regulatory Time Bomb remonte ET que le moteur 12
Friction d Execution detecte simultanement une friction sur l axe
regulation actuel, la combinaison est marquee sur la couverture
comme exposition reglementaire convergente. Le management subit
deja un frottement et n est pas prepare pour le suivant.

## Methode anti-hallucination

Le LLM ne peut pas conclure a Regulatory Time Bomb sur des
impressions type secteur risque reglementairement. Il doit nommer
chaque regulation avec precision : texte legislatif, article si
pertinent, juridiction, date d entree en vigueur, action
regulatrice citee avec source. Tag obligatoire :

- [pitch] pour les declarations du pitch
- [bp] pour les chiffres du business plan et les lignes
  budgetaires compliance
- [legal] pour les avis juridiques, agrements, licenses
- [eurlex] pour les textes europeens
- [sec] pour les filings SEC
- [news] pour les actions regulatrices documentees dans la presse
- [transparency] pour les depots lobbying
- [inference] pour les calculs derives ou les jugements
  probabilistes, avec la base explicite

Si le LLM dit risque AI Act, il doit nommer l article precis
(GPAI Article 51 par exemple) et le calendrier d application
correspondant. Si le LLM dit pas de compliance officer, il doit
avoir verifie l absence dans l organigramme communique, pas
l avoir presumee.

Contrainte de coherence avec les metriques objectives. Si exposition
documentee a une regulation a venir dans moins de 24 mois ET pas de
plan documente, globalRegulatoryTimeBombScore superieur ou egal a
70 force. Si secteur regule mais agrement principal deja obtenu ET
plan de transition documente, score inferieur ou egal a 35 sauf
evidence forte d exposition residuelle non couverte.

## Difference avec les patterns voisins

Avec Macro Geopolitical de la matrice de pertinence existante. Macro
Geopolitical regarde l exposition pays et geopolitique : sanctions,
controle des exports, dependance materiaux strategiques venant de
zones a risque. Regulatory Time Bomb regarde une regulation specifique
datee a venir, independamment de la geopolitique generale. Une boite
peut etre exposee Regulatory Time Bomb sans exposition geopolitique,
par exemple un acteur fintech europeen qui n opere qu en Europe et
ne touche pas aux flux internationaux mais doit s adapter a CCD2 ou
PSD3. Inversement, une boite peut etre exposee Macro Geopolitical
sans Regulatory Time Bomb si son modele economique est legalement
stable mais ses approvisionnements viennent d une zone tendue.

Avec Friction d Execution du moteur 12 axe regulation. Friction
d Execution regarde le frottement operationnel actuel face a la
regulation existante, c est-a-dire les difficultes presentes pour se
conformer aux regles deja en vigueur. Regulatory Time Bomb regarde
le changement a venir pour lequel l entreprise n est pas preparee.
Les deux peuvent s activer ensemble sur un meme dossier, ce qui est
particulierement defavorable parce que cela montre une entreprise qui
deja gere mal le present et qui ne se prepare pas au futur. La
matrice de pertinence active les deux moteurs en parallele quand le
secteur le justifie.

Avec Aveuglement Reglementaire du moteur 8 actuel. Le moteur 8
detecte le DENI psychologique du fondateur sur la regulation,
typiquement traduit par des affirmations type cette regle ne nous
concerne pas, le legislateur n osera pas, on est trop petit pour
etre vise. Regulatory Time Bomb detecte la REALITE structurelle du
risque et de l absence de preparation. Un fondateur peut etre
parfaitement lucide sur l AI Act et le dire ouvertement, ce qui
annule le pattern de deni mais pas Regulatory Time Bomb si la
preparation reelle est insuffisante. La matrice de pertinence active
aveuglement en early stage et Regulatory Time Bomb a tous les stades
des que le secteur est regule.

Avec Internal Reality Leak du moteur Narrative Drift. Internal
Reality Leak regarde si la communication de l entreprise minore ou
cache la realite reglementaire. Regulatory Time Bomb regarde la
realite reglementaire elle-meme. Une boite peut etre Regulatory Time
Bomb sans Narrative Drift si elle est lucide et le dit ouvertement
mais ne fait rien. Inversement, une boite peut etre en Narrative
Drift sans Regulatory Time Bomb si la regulation est maitrisee mais
que la communication brouille les pistes pour rendre l ensemble plus
sexy.
