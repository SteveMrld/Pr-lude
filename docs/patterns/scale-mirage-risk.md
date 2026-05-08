# Pattern Scale Mirage Risk

Fiche de specification du moteur. Premiere version, redigee en session
conceptuelle. A integrer ulterieurement dans lib/engines/.

## Definition

Une entreprise qui engage des investissements industriels lourds
(usines, lignes de production, capex specialises, equipes
d industrialisation) avant que la demande commerciale ait valide la
traction du produit ou que les couts unitaires aient atteint la
cible economique. Le mirage est l illusion que la mise a l echelle
industrielle creera la demande, alors que c est generalement
l inverse : la demande commerciale tire l industrialisation, et
industrialiser sans demande cree des actifs sous-utilises qui
pesent sur le bilan jusqu a l effondrement.

C est l image miroir de Growth Subsidized Model pour les modeles
industriels et deeptech. Pour Growth Subsidized, c est le revenu
qui croit sans marge unitaire viable. Pour Scale Mirage, c est la
capacite industrielle qui croit sans demande commerciale validee.
Les deux sont dangereux mais le second a une particularite
operationnelle critique : les capex industriels sont presque
irreversibles. Une usine batie ne peut pas etre coupee du jour au
lendemain comme un budget marketing. Une ligne de production
specialisee ne peut pas etre redirigee facilement. Le pattern
Scale Mirage transforme un parient sur la croissance future en une
captivite physique au present.

Le cas Ynsect en 2024 fournit l exemple canonique francais. Plus
de 600 millions levés pour une thes de protein insectes pour feed
aquaculture et petfood. Construction d une usine industrielle a
Amiens d un investissement de 372 millions, censee produire a
l echelle pour un marche dont la demande B2B n a pas decolle au
rythme suppose. Procedure de redressement judiciaire en 2024,
restructuration sans certitude sur la viabilite finale du modele.

Le cas Northvolt en 2024 fournit l equivalent international. Levee
de plus de 15 milliards de dollars de capital et de dette pour
construire des gigafactories de batteries en Europe. Rythme de
construction qui a depasse la capacite du marche EV europeen a
absorber la production a court terme. Defaut Chapter 11 aux
Etats-Unis en novembre 2024 malgre les soutiens politiques massifs
au projet. Les usines existent physiquement, le capex est engage,
mais la demande contracte n a pas suivi.

Britishvolt avant 2023 est le cas pur du Scale Mirage non execute.
Levee de plus de 200 millions sur le projet d une gigafactory au
Royaume-Uni, plans annonces a 3,8 milliards de livres. Faillite en
janvier 2023 sans avoir produit la moindre cellule. Le mirage
etait dans la projection de la capacite, pas dans la capacite reelle.

Le pattern depasse les batteries et la deeptech. Faraday Future et
ses promesses de 9 milliards de capex pour une usine automobile
deployee en parallele d annonces commerciales sans clients fermes.
Magic Leap et ses 3,5 milliards investis dans la production hardware
AR avec des ventes finales tres en dessous des projections initiales.
Lilium en 2024 avec son eVTOL allemand industrialise avant
certification commerciale validee. Hyperloop One et son capex
R&D plus tubes test sans business model commercialise. Electric
Last Mile Solutions et ses usines de vehicules avec demande non
validee. Quirky qui industrialisait des produits crowdsourced sans
validation commerciale en amont.

## Stade d application

Pertinent des la Series A pour les dossiers deeptech et hardware
si des capex significatifs sont deja planifies ou engages. Le
moteur peut detecter un Scale Mirage tres precoce dans des
business plans dont l ambition industrielle precede la validation
commerciale.

Critique en Series B et au-dela parce que c est a ce stade que
l industrialisation s engage typiquement. Le passage de Series A a
Series B sur un dossier deeptech inclut presque toujours une these
sur la mise a l echelle industrielle, qui est souvent le coeur de
la levee. Le moteur detecte si cette these est calibree ou si elle
constitue le mirage.

Tres critique pour les gigafactories (batteries, hydrogene, semi-
conducteurs avances), biotech industriel (insectes, fermentation
de precision, viande cellulaire), agritech industrielle, hardware
grand format (eVTOL, drones industriels, mobilite), pharma a forte
intensite capitalistique. Pour ces secteurs, le moteur est
quasiment toujours applicable et l absence d une analyse explicite
de la calibration capex contre demande dans le pitch est un signal
en soi.

S applique partiellement aux modeles SaaS avec composante data
center proprietaire significative. La construction de data centers
proprietaires, particulierement frequente dans les acteurs de l IA
en 2024-2026, peut declencher le pattern si le burn d operation et
le capex de construction excedent la trajectoire de revenu.

Ne s applique pas aux SaaS pure cloud, aux services pure, aux
content marketplaces sans capex materiel.

## Trois axes de mesure

### Axe 1 : disproportion entre capex engage et demande validee

Mesure de l asymetrie quantitative entre l investissement industriel
et la matiere commerciale qui doit l absorber. Trois sous-modules.

Premier sous-module, ratio capex industriel cumule sur revenu annuel
courant. Le moteur additionne le capex deja engage et celui planifie
sur les 24 prochains mois, et compare au revenu annualise sur les
12 derniers mois. Au-dela de 5x, signal d exposition. Au-dela de
10x, signal fort. Au-dela de 20x, drapeau-rouge sauf evidence
contraire majeure. Pour Ynsect au moment du peak capex, le ratio
etait estime au-dela de 30x.

Deuxieme sous-module, capacite de production prevue contre demande
commerciale validee par contrats fermes ou letters of intent
qualifiees. Le moteur cherche les contrats clients long terme qui
seraient des engagements d achat de la production prevue. Pour les
gigafactories EV, l absence de contrats fermes avec OEMs au-dela
de 30% de la capacite prevue est un signal majeur. Pour les
proteines insectes, l absence de contrats avec des grands de
l aquaculture ou du petfood est un signal equivalent. La
distinction entre LOI qualifiee (signee, datee, avec montant) et
LOI marketing (intention generique) est cruciale.

Troisieme sous-module, decalage entre la mise en service planifiee
de l usine et le besoin commercial reel. Le moteur cherche la date
de production effective prevue par le BP et la croise avec les
projections de demande contractee a la meme date. Si l usine est
prevue d etre operationnelle en 2026 alors que les premiers
contrats fermes ne couvrent que 2028, le decalage genere du capital
qui dort, ce qui est economiquement destructeur sauf en cas de
financement public massif compensatoire.

### Axe 2 : maturite technologique au moment de l industrialisation

Mesure de la solidite technique du produit industrialise. Quatre
sous-modules.

Technology Readiness Level au moment du commitment industriel. Le
moteur cherche dans la DD technique, dans les declarations
publiques et dans les rapports d experts cites le TRL effectif du
produit principal. Le TRL 9 correspond a un produit en operation
commerciale eprouvee. TRL 8 correspond a une demonstration en
environnement operationnel. TRL 7 a une demonstration en
environnement representatif. En dessous de TRL 8, l industrialisation
massive est generalement prematuree. Beaucoup de Scale Mirage
documentes ont engage les capex industriels a TRL 6 ou 7.

Coute unitaire actuel contre cible business. Le moteur cherche le
cout de production a la sortie d une serie de prototypes ou d une
preserie, et le compare au cout cible necessaire pour que le
modele economique tienne. Si le cout unitaire actuel est superieur
de plus de 50% a la cible et que le BP suppose une descente
abrupte par economies d echelle non documentees, le pattern apparait.
Pour Britishvolt, le cout unitaire celle preserie etait estime
plus du double de la cible BYD/CATL au moment de la faillite.

Fiabilite operationnelle demontree. Le moteur cherche les indicateurs
de fiabilite : taux de yield en production, taux de defaut, MTBF,
duree de vie demontree. Ces metriques sont rarement dans le pitch
et necessitent une DD technique pour etre obtenues. Leur absence
sur un dossier qui pretend a l industrialisation imminente est
signe d immaturite.

Variance entre les claims R&D et la performance industrielle. Le
moteur croise les claims du pitch avec les performances mesurees
dans les preseries quand elles sont accessibles. Les Scale Mirage
sont generalement caracterises par une promesse R&D plus brillante
que les preseries effectives. Le moteur identifie les ecarts.

### Axe 3 : flexibilite du modele industriel

Mesure de la reversibilite et de la capacite d adaptation. C est le
mitigant majeur du pattern. Une boite peut sur-investir et survivre
si ses actifs industriels sont reutilisables ou redirigeables.

Reversibilite du capex. Le moteur cherche la part du capex
industriel qui pourrait etre revendue, sous-louée ou redirigée vers
un autre usage en cas de pivot. Une usine generaliste de
fabrication metallique a une certaine reversibilite : elle peut
produire d autres types de pieces. Une usine d elevage d insectes
specialisee n a quasiment aucune reversibilite : les bioreacteurs
et les chaines de tri sont dedies. Les actifs ultra-specialises
sont la signature des Scale Mirage les plus dangereux.

Capacite de pivot vers d autres marches ou produits avec les memes
actifs. Si la demande primaire ne se materialise pas, l entreprise
peut-elle servir un marche secondaire ? Northvolt avait theoriquement
la possibilite de servir le stationary storage en plus de l EV mais
la maturite des deux marches au moment du commitment industriel
n etait pas suffisante pour absorber la capacite. Innovafeed, en
revanche, a structure ses contrats avec ADM pour avoir un offtake
diversifie qui reduit l exposition a un seul vertical.

Profil d amortissement et burn industriel associe. Le moteur calcule
le burn industriel mensuel attendu une fois l usine operationnelle :
amortissement du capex plus couts d operation a capacite
sous-utilisee. Si ce burn industriel represente plus de 50% du
burn total, l entreprise est mecaniquement dans une situation ou
toute deviation par rapport au plan tire le runway de maniere
disproportionnee. Le moteur calcule le runway specifique post mise
en service en supposant une montee en cadence retardee de 12 ou 24
mois par rapport au plan.

## Conditions d application strictes

Le moteur ne se declenche que si la nature industrielle du dossier
est confirmee et que les chiffres capex sont accessibles dans le BP.

- Deeptech ou hardware avec BP detaillant capex et ramp-up = full
- Hybride avec composante industrielle minoritaire (moins de 30%
  du burn) = partial
- SaaS pure cloud, services pure, content marketplaces sans capex
  materiel = not-applicable
- BP non detaille sur le volet capex pour un dossier industriel =
  partial avec recommandation DD obligatoire d obtenir le breakdown

Hors scope explicite : le moteur ne formule pas de jugement sur le
choix sectoriel ou la valeur scientifique du produit. Il mesure
l alignement entre l ambition industrielle et la matiere commerciale
qui doit l absorber. Strictement instrumental.

## Evidence factuelle requise pour score >= 60

Au moins trois evidences chiffrees parmi les suivantes. Le seuil
necessite une combinaison parce que le pattern se confond facilement
avec une simple avance industrielle calibree, qui n est pas
disqualifiante en soi.

- Ratio capex industriel cumule sur revenu annuel courant superieur
  a 5x
- Capacite de production prevue couverte a moins de 30% par des
  contrats fermes ou des LOI qualifiees
- Decalage de plus de 18 mois entre la mise en service planifiee de
  l usine et le besoin commercial valide
- Technology Readiness Level inferieur a 8 au moment du commitment
  industriel, identifie par DD technique ou par croisement de
  declarations publiques
- Cout unitaire actuel superieur de plus de 50% a la cible business
  necessaire pour que le modele tienne, sans documentation chiffree
  de la trajectoire de descente
- Aucun contrat client long terme couvrant plus de 30% de la
  capacite prevue
- Modele industriel non reversible : actifs ultra-specialises a un
  seul produit ou un seul marche
- Burn industriel post mise en service representant plus de 50% du
  burn total prevu
- Runway specifique post mise en service inferieur a 18 mois en
  scenario nominal et inferieur a 12 mois en scenario degrade

Le moteur doit nommer chaque evidence avec son chiffre precis et
sa source. Pas de generalite type investissement risque sans le
chiffre.

## Evidence contradictoire obligatoire

Le moteur cherche symetriquement ce qui contredit le pattern.

- Contrats clients long terme couvrant plus de 60% de la capacite
  prevue avec acteurs etablis et solidite financiere
- Montee en cadence progressive validee trimestre apres trimestre
  avec marqueurs publics : annonces de production effective, taux
  de yield publies, livraisons clients tracees
- Technology Readiness Level superieur ou egal a 8 au moment du
  commitment, demontre par operations en environnement reel
- Cout unitaire actuel deja conforme ou proche de la cible
- Actifs industriels generiques utilisables sur plusieurs marches
  ou plusieurs produits, avec exemples de pivot deja realises ou
  realisables a court terme
- Track record d industrialisation reussie de l equipe sur des
  produits anterieurs comparables
- Subventions et financements publics couvrant une part
  significative du capex, reduisant l exposition equity et
  permettant un horizon plus patient
- Architecture industrielle modulaire permettant d ajouter de la
  capacite par increments plutot que par engagement initial massif

Si l evidence contraire pese 50 quand l evidence pro pese 60, le
pattern est marque unresolved. Sur ce pattern, la presence de
soutiens publics significatifs ou de contrats long terme avec des
contreparties solides est souvent suffisante pour basculer le
diagnostic en partial plutot qu en alerte.

## Counter-archetypes

### Patterns confirmes (faillite, redressement ou capex devalue)

Ynsect en 2024, plus de 600 millions levés et usine d Amiens a 372
millions, demande B2B feed aquaculture insuffisante au rythme
suppose, redressement judiciaire et restructuration en cours.

Northvolt en novembre 2024, gigafactories europennes deployees a un
rythme depassant l absorption EV court terme, Chapter 11 aux
Etats-Unis malgre 15 milliards leves cumules en capital et dette.

Britishvolt en janvier 2023, plans gigafactory UK a 3,8 milliards
de livres, faillite sans avoir produit la moindre cellule, capex
deja engage perdu.

Faraday Future, 9 milliards promis pour usine automobile, retards
multi-anniversaires, defaillance technique et financiere.

Magic Leap, 3,5 milliards leves pour hardware AR, ventes au-dessous
de 1% des projections initiales, restructurations successives.

Lilium en 2024, eVTOL allemand industrialise avant certification
commerciale validee, faillite et liquidation.

Hyperloop One et Virgin Hyperloop, capex R&D et tubes test
significatifs sans business model commercialise, fermeture en 2023.

Electric Last Mile Solutions, usines vehicules deployees avec
demande non validee, faillite Chapter 11 en 2022.

Quirky, plateforme de produits crowdsourced avec usine de
prototypage et industrialisation declenchee sans demande validee
en amont, faillite 2015.

Theranos sur le volet hardware Edison, machines deployees en
pharmacie sans validation FDA, ne s est jamais materialise en
revenue.

WeWork sur l axe physique des bureaux entre 2017 et 2019, ouverture
rapide de sites avant validation locale de la demande, conjugue au
Fixed Cost Trap, a accelere l effondrement.

### Counter-archetypes sains

Tesla entre 2008 et 2012, capex Roadster mesure et premier vehicule
produit en 2008 avec Lotus en partenariat reduisant le capex
specifique. Montee en cadence Model S a partir de 2012 avec usine
Fremont rachetee a Toyota et NUMMI plutot que construite ex nihilo.
Chaque etape industrielle validee par la precedente avant
engagement de la suivante.

ASML, capex industriel mesure et systematiquement lie a des
contrats long terme avec foundries (TSMC, Samsung, Intel). La
demande precede la capacite. Le ratio capex sur backlog reste dans
des fourchettes prudentes meme dans les phases d expansion.

BYD, extension industrielle en Chine au rythme de la demande validee,
montee en cadence progressive et financement par cash flow operationnel
sur plus de quinze ans.

Rivian en cas mixte. Capex usine significatif a Normal Illinois, mais
avec contrat ancrage Amazon de 100000 vehicules en filet, plus la
production R1T R1S valide en environnement reel. Le contrat Amazon
n a pas suffi a absorber tout le capex mais il a evite la trajectoire
Britishvolt.

Beyond Meat avant 2022, extension industrielle progressive validee
par contrats retail successifs (Whole Foods, Walmart, McDonald s
plant burgers tests). La phase post-2022 a basculé pour d autres
raisons concurrentielles, mais la phase initiale d industrialisation
etait calibree.

Apple sur sa supply chain, capex realise chez Foxconn et fournisseurs
asiatiques calibre sur la demande mesuree iPhone, avec ajustement
trimestriel des allocations. Le modele asset-light sur la production
hardware finale evite l exposition Scale Mirage de fait.

Innovafeed dans les proteines insectes, contraste explicite avec
Ynsect. Innovafeed a structure des l origine ses contrats avec ADM
(Archer Daniels Midland) pour secure l offtake d une part majeure
de la production. La capacite industrielle deployee est ancree dans
de la demande contractee, pas dans une projection de marche.

La distinction structurale n est jamais le simple fait de batir une
usine. C est l alignement entre le capex engage et la matiere
commerciale qui doit l absorber, mesuree en contrats fermes plutot
qu en projections marche. Ynsect et Innovafeed operent dans la meme
categorie deeptech, avec des produits comparables sur l axe
proteine insectes. La difference structurelle est dans la securisation
de la demande commerciale en amont du capex.

## Sources que le moteur doit interroger

Pitch deck pour les claims sur la capacite industrielle, le ramp-up,
les contrats clients evoques. Le moteur evalue la specificite et la
materialite des claims.

BP financier comme source primaire pour les chiffres capex, le
profil d amortissement, et le burn industriel projete. Sans BP
detaille sur le volet industriel, l analyse reste partielle et le
moteur recommande la DD financiere.

Comptes deposes pour les capex deja engages, identifiables dans les
immobilisations corporelles et les engagements donnes en notes
annexes. Pappers et homologues pour les boites europeennes, SEC pour
les boites americaines cotees.

DD technique pour le TRL, les couts unitaires actuels, la fiabilite
mesuree, la variance R&D contre industrialisation. La DD technique
est presque toujours necessaire pour conclure solidement sur ce
pattern, le moteur la recommande systematiquement.

Web search agressif sur les retards d industrialisation et les
problemes operationnels declares ou rapportés. Les Scale Mirage
genererent typiquement une trace mediatique : retards d ouverture
d usine, accidents techniques, departs d ingenieurs cles, audits
publics negatifs. Le moteur cherche ces signaux dans la presse
specialisee.

Verification des contrats clients revendiques. Quand l entreprise
revendique un contrat anchor, le moteur cherche la confirmation
publique du cote du client. Une signature d annonce mutuelle est un
signal de credibilite. Une seule annonce unilaterale est un signal
de prudence.

## Format de l output

Pour chaque axe, score 0-100, evidence pro chiffree, evidence
contra chiffree, confidence. Score global Scale Mirage Risk.
Counter-archetype le plus proche identifie et justifie.

Tableau structure des actifs industriels engages avec pour chaque
ligne : type d actif (usine, ligne, equipement specialise, equipe),
montant capex investi ou prevu, capacite produite, demande couverte
par contrats fermes, reversibilite estimee, profil d amortissement.
Ce tableau est le livrable principal du pattern.

Calcul du runway specifique post mise en service en deux scenarios :
nominal selon le BP, et degrade avec retard montee en cadence de
24 mois. Le contraste entre les deux runways est le marqueur
diagnostic principal.

Recommandation DD specifique. Sur ce pattern, la recommandation est
typiquement une demande de breakdown granulaire des capex par site
et par categorie d actif, plus une exigence de production des
contrats clients revendiques en piece justificative, plus un audit
TRL externe sur le produit principal. Pour les dossiers les plus
exposes, le moteur peut recommander de conditionner toute term
sheet a une securisation contractuelle prealable de la demande
commerciale au-dessus d un seuil de couverture defini.

## Conditions de remontee a la couverture de la note

Pattern remonte sur la page de couverture si score global superieur
ou egal a 65 ET au moins deux axes individuels superieurs ou egaux
a 55. Le seuil est legerement plus eleve que sur les autres patterns
parce que les modeles deeptech declenchent regulierement des scores
intermediaires legitimes qui correspondent a une avance industrielle
calibree non disqualifiante.

Si Scale Mirage Risk remonte ET que Fixed Cost Trap remonte aussi,
la combinaison est marquee sur la couverture comme exposition
industrielle convergente : non seulement le capex initial est
disproportionne, mais les couts d operation associes sont
difficilement reductibles. Le pattern Britishvolt etait precisement
cette combinaison.

Si Scale Mirage Risk remonte ET que Capital Structure Fragility
remonte aussi, le pattern est exceptionnellement defavorable parce
que la cap table fragile ne supportera pas un down round dont la
necessite sera quasi-mecanique en cas de retard d industrialisation.
Le pattern Northvolt s en approche.

## Methode anti-hallucination

Le LLM ne peut pas conclure a Scale Mirage Risk sur des impressions
type capex eleve. Il doit nommer le capex precis, la capacite prevue,
la demande validee, et le decalage temporel s il existe. Tag
obligatoire :

- [pitch] pour les claims du pitch
- [bp] pour les chiffres capex et ramp-up
- [comptes] pour les capex deja engages dans les immobilisations
- [tech] pour la DD technique : TRL, couts unitaires, fiabilite
- [contracts] pour les contrats clients verifiables
- [web] pour les signaux mediatiques de retards ou problemes
- [inference] pour les calculs derives, en particulier les runways
  scenarios, avec la formule explicite

Si le LLM dit capex disproportionne, il doit donner le ratio capex
sur revenu et la couverture par contrats fermes. Si le LLM dit
TRL insuffisant, il doit citer le TRL effectif et la source.

Contrainte de coherence avec les metriques objectives. Si capex
cumule superieur a 10x le revenu annuel ET TRL inferieur a 8 ET
couverture contractuelle inferieure a 30% de la capacite,
globalScaleMirageRiskScore superieur ou egal a 75 force. Si capex
proportionne au revenu (ratio inferieur a 3x) ET contrats long
terme couvrant plus de 60% de la capacite ET TRL superieur ou egal
a 8, score inferieur ou egal a 30 sauf evidence forte de retard
operationnel deja materialise.

## Difference avec les patterns voisins

Avec Growth Subsidized Model. Growth Subsidized regarde la marge
unitaire negative cote revenu : chaque transaction marginale
detruit de la valeur. Scale Mirage regarde l investissement
industriel non valide cote capex : la capacite construite excede la
demande qui peut l absorber. Les deux peuvent se cumuler et
souvent le font dans les modeles industriels en difficulte. Une
usine sous-utilisee produit a couts unitaires eleves, ce qui
declenche Growth Subsidized en aval. Le moteur les active en
parallele et combine leurs verdicts en cas de detection conjointe.

Avec Fixed Cost Trap. Fixed Cost Trap regarde les engagements long
terme contractuels qui ne peuvent pas etre reduits avec le revenu
(loyers, salaires senior, contrats fournisseurs). Scale Mirage
regarde les engagements industriels capex specifiquement. Les deux
patterns convergent souvent : une usine batie est a la fois un
capex non recuperable (Scale Mirage) et un cout fixe d operation
(Fixed Cost Trap). La distinction analytique est utile parce que
les mitigants different : pour Scale Mirage, la securisation
contractuelle de la demande en amont, pour Fixed Cost Trap, la
variabilisation des couts operationnels.

Avec le moteur Friction d Execution Bloc 1 axe industrialisation.
Friction d Execution regarde le frottement operationnel actuel sur
les huit axes go-to-market, financement transactionnel,
industrialisation, supply chain, ecosysteme, regulation,
referencement, talent rare. Scale Mirage regarde la disproportion
structurelle entre capacite et demande, qui est de nature plus
strategique. Une boite peut avoir une friction d execution
industrielle sans Scale Mirage si la capacite construite est
calibree mais que la mise en route est difficile. Inversement, une
boite peut avoir Scale Mirage sans friction d execution actuelle si
l industrialisation se passe bien techniquement mais sur la mauvaise
echelle.

Avec Aveuglement Maturite Execution du moteur 8 actuel. Le moteur 8
detecte le DENI psychologique du fondateur sur la maturite de son
execution. Scale Mirage detecte la REALITE structurelle de la
disproportion capex contre demande. Un fondateur peut etre
parfaitement lucide sur Scale Mirage en cours et le dire ouvertement,
ce qui annule le deni mais pas le pattern. La matrice de pertinence
active aveuglement en early stage et Scale Mirage en growth ou en
phase d industrialisation.

Avec Infrastructure Hostage. Hostage regarde la captivite externe
vis-a-vis des fournisseurs. Scale Mirage regarde la captivite
interne creee par le capex engage. La symetrie est utile : Hostage
est subi du fait de fournisseurs, Scale Mirage est choisi par le
management. Les mitigants different : pour Hostage, plan de
portabilite, pour Scale Mirage, securisation de la demande en
amont.
