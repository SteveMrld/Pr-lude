# Pattern Fixed Cost Trap

Fiche de specification du moteur. Premiere version, redigee en session
conceptuelle. A integrer ulterieurement dans lib/engines/.

## Definition

Une entreprise dont la base de couts incompressibles, contractee a
long terme et ne pouvant pas etre reduite a proportion d une baisse
de revenu, atteint une masse telle qu une stagnation ou un
ralentissement de la croissance suffit a precipiter l effondrement.
Le modele repose sur l hypothese implicite que la trajectoire de
revenu va continuer a un rythme suffisant pour absorber ces
engagements. Quand cette hypothese se brise, les couts ne suivent
pas le revenu vers le bas. L entreprise sort du regime stable et
bascule en quelques trimestres.

C est le pattern WeWork canonique. Quarante-sept milliards de
dollars d engagements de loyers signes sur des durees de dix a
quinze ans, contre une occupation reelle dont la sensibilite au
cycle economique etait elevee, et un point mort qui supposait une
expansion continue du nombre de bureaux et des taux d occupation.
Quand la dynamique s est ralentie, les loyers sont restes a payer.
Le modele a tenu six trimestres apres l IPO refusee, puis a
fait faillite en novembre 2023.

Le pattern n est pas la presence de couts fixes, qui est inevitable
dans tout modele asset-heavy, manufacturing, real estate, content
production. Le pattern apparait quand le ratio couts fixes contre
revenu sort des marges sectorielles soutenables, quand les
engagements long terme sont signes sur l hypothese d une croissance
ininterrompue, et quand l entreprise n a pas la capacite documentee
de reduire son burn de 30% en moins de 90 jours.

Exemples ulterieurs au cas WeWork. Compass et ses 4500 agents
immobiliers en salaries directs, charges sociales et bureaux fixes
face a une commission qui suit le cycle immobilier residentiel
americain. Quibi et son milliard sept cent millions d engagements
contenus sur des series dont la viabilite dependait d une adoption
mobile qui n a pas eu lieu. MoviePass et son engagement de payer le
prix plein des places de cinema a chaque utilisation pour un
abonnement mensuel infinite a 9,95 dollars. Peloton et son capex
d usines plus son payroll engineering colossal face a une demande
hardware qui s est inversee post-pandemie. Cazoo et ses stocks de
voitures immobilises, ses entrepots et son outil de livraison
nationale, finances par 800 millions de capital pour une marge
unitaire structurellement negative.

## Stade d application

Pertinent des la Series B pour les modeles asset-heavy, ou les
engagements long terme commencent generalement a se materialiser.
Critique en Series C, D, growth et pre-IPO, ou la base de couts
fixes a souvent atteint le point de captivite.

Ne s applique pas aux pre-seed, seed et Series A early ou les
engagements long terme n existent quasiment pas encore. La structure
de couts y reste essentiellement variable et en grande partie liee
au payroll, lui-meme reductible en stress.

S applique de facon discriminante aux modeles asset-heavy : real
estate operationnel, content production, manufacturing avec capex
non transferable, salesforce employee plutot que contractor,
infrastructure dediee non multi-tenant. Ne s applique pas, ou
seulement en partial, aux SaaS pure cloud capables de variabiliser
leurs couts via downscaling cloud, layoff ingenierie, et reduction
marketing rapide.

## Trois axes de mesure

### Axe 1 : ratio couts fixes contre revenu

Mesure quantitative de la dependance a une croissance soutenue pour
absorber le run-rate de couts fixes. Calcul en trois sous-mesures.

Premier sous-module, part du burn mensuel fixee contractuellement a
plus de 12 mois. Si plus de 60% du burn est verrouille pour 12 mois
ou plus sans possibilite de breakage, signal fort. Plus de 75%,
drapeau-rouge. Le calcul inclut les loyers signes, les contrats
fournisseurs avec engagement de minimum, les salaires senior avec
clauses de departage cherchet.

Deuxieme sous-module, run-rate fixed costs au point d arret commercial.
Calcul du burn minimum si le revenu tombe a zero du jour au
lendemain. Pour WeWork au pic, ce calcul donnait environ trois
milliards de dollars par an de loyers et personnel core a payer
meme avec zero membre paye. Si ce run-rate represente plus de douze
mois de cash en banque, l entreprise est sur une trajectoire de
fragilite extreme.

Troisieme sous-module, ratio couts fixes contre revenu compare au
benchmark sectoriel. Le moteur a besoin du benchmark pour eviter
l accusation generique. Pour le real estate operationnel, fixed
costs typiquement 35-45% du revenu chez les acteurs etablis. Pour
le content streaming, 50-65%. Pour le manufacturing hardware,
30-40%. Si le dossier sort de plus de 15 points au-dessus de son
benchmark sectoriel, signal a investiguer.

### Axe 2 : engagements long terme non resiliables

Mesure la dimension contractuelle des couts fixes. Trois
sous-modules.

Total des engagements off-balance sheet rapporte au revenu annuel
courant. Pour WeWork preIPO, le ratio etait de 47 milliards
d engagements pour environ 1,8 milliard de revenu, soit 26x. Au-dela
de 5x, le ratio devient menacant si la croissance ralentit. Au-dela
de 15x, l entreprise a depasse le point de retour normal sans
restructuration significative.

Duree moyenne ponderee des engagements. Plus la duree est longue,
plus l entreprise est captive d un scenario macroeconomique qui
peut bouger. Au-dela de cinq ans pondere, l exposition cycle est
significative. Au-dela de huit ans, l exposition est massive et
suppose que l entreprise prend une position implicite sur le cycle.

Penalites de sortie en cas de breakage volontaire. Pour les baux
immobiliers commerciaux, les penalites incluent generalement la
totalite des loyers restants moins la valeur de relocation, soit
typiquement 60-80% des engagements pour les baux US et 50-70% pour
les baux UE. Pour les contrats fournisseurs avec minimum, les
penalites sont contractuelles et explicites. Le moteur cherche le
chiffre.

### Axe 3 : elasticite reelle des couts en cas de stress

Mesure de la capacite documentee a variabiliser les couts en
situation defavorable. C est le mitigant majeur du pattern.
L existence de couts fixes n est pas en soi un drapeau-rouge si
l entreprise a un plan demontre et execute pour les reduire en cas
de besoin.

Capacite documentee de reduction du burn de 30% en moins de 90
jours. L entreprise a-t-elle un downside scenario chiffre dans son
BP ? A-t-elle deja conduit une telle reduction dans son histoire
recente ? Le management a-t-il identifie ce qui peut etre coupe ?
Plus la reponse est documentee, plus le pattern est mitige.

Track record de variabilisation reussie dans le passe. Si
l entreprise a deja conduit un layoff, ferme un site, ou rompu un
contrat fournisseur dans les 36 derniers mois sans degradation
operationnelle majeure, la capacite est demontree. Si elle ne l a
jamais fait, capacite presumable mais non confirmee.

Asset-lightness deliberee. Certaines entreprises ont fait le choix
strategique d eviter les couts fixes structurels. Airbnb sur le real
estate, Booking sur les chambres d hotel, Uber sur les vehicules.
Cette discipline de modele est un anti-pattern qui renverse le
diagnostic. Le moteur la reconnait quand elle est articulee
explicitement dans le pitch et alignee sur l execution operationnelle.

## Conditions d application strictes

Le moteur ne se declenche que si la structure de couts du dossier
est lisible a partir du BP ou des comptes deposes. Sans ces
donnees, status not-applicable et recommandation d aller chercher
le breakdown en DD financiere.

- BP detaille avec breakdown couts fixes contre variables = full
- BP avec totaux mais sans breakdown granulaire = partial (axes 1
  et 2 desactives sur les sous-modules quantitatifs fins)
- Pas de BP ou comptes non lisibles = not-applicable

Hors scope explicite : les modeles d affaires ou la structure de
couts fixes lourde est consubstantielle et acceptee par le marche
parce qu elle correspond a la nature meme du business (distribution
electrique reseau cuivre, telecom infrastructures fibre, banques de
detail avec agences). Pour ces secteurs, le pattern est tautologique.
Le moteur le note dans la liste des patterns hors-scope mais ne
genere pas de score.

## Evidence factuelle requise pour score >= 60

Au moins trois evidences chiffrees convergentes parmi les suivantes.
Le seuil est plus exigeant que sur Growth Subsidized parce que le
pattern Fixed Cost Trap se confond facilement avec les structures
de couts normales des modeles asset-heavy. Le moteur doit
discriminer.

- Ratio engagements off-balance sheet contre revenu superieur a 5x
- Plus de 60% du burn mensuel verrouille contractuellement a 12 mois
  ou plus
- Run-rate fixed costs au point d arret commercial superieur a 12
  mois de cash en banque
- Aucun downside scenario chiffre dans le BP ni dans les minutes du
  board ni dans la communication aux investisseurs
- Aucun layoff, fermeture de site, ou breakage contractuel
  documentes dans les 36 derniers mois en depit d une croissance
  inferieure aux objectifs annonces
- Ratio couts fixes contre revenu superieur de plus de 15 points au
  benchmark sectoriel etabli
- Penalites de sortie cumulees superieures a 50% du total des
  engagements long terme
- Duree moyenne ponderee des engagements superieure a 7 ans

Le moteur doit nommer chaque evidence avec son chiffre precis et la
source. Pas de generalite type beaucoup de loyers sans le chiffre,
beaucoup de personnel sans le ratio.

## Evidence contradictoire obligatoire

Le moteur cherche symetriquement ce qui contredit le pattern. La
symetrie est cle parce que le diagnostic Fixed Cost Trap est
particulierement traumatique pour le management qui se voit accuse
de mauvaise gestion structurelle, parfois a tort.

- Asset-lightness deliberee documentee dans la strategie et alignee
  sur l execution operationnelle
- Variabilisation reussie demontree par precedents : layoffs, site
  closures, breakage contractuels conduits sans degradation majeure
- Downside scenario chiffre dans le BP avec plan d action explicite
  pour reduire le burn de 30% ou plus en moins de 90 jours
- Clauses de break early dans les contrats long terme avec
  activation a moins de 25% de penalite
- Engagements long terme alignes sur des contrats clients eux-memes
  long terme et garantis (cas Salesforce ou les engagements data
  center sont compenses par des contrats client multi-annee)
- Ratio couts fixes contre revenu dans le quartile bas du secteur,
  signe d efficacite structurelle
- Capacite documentee a transferer les couts fixes a des partenaires
  par sale-leaseback, sublease, ou outsourcing operationnel

Si l evidence contraire pese 50 quand l evidence pro pese 60, le
pattern est marque unresolved. Sur ce pattern specifiquement, le
moteur a tendance a sur-detecter sur les modeles asset-heavy
sectoriellement normaux. La symetrie est la garde principale.

## Counter-archetypes

### Patterns confirmes (effondrement ou near-death)

WeWork avant l IPO refusee de 2019 et la faillite de 2023, 47
milliards d engagements de loyers contre 1,8 milliard de revenu au
moment de l IPO refusee, run-rate de 3 milliards de loyers a payer
meme a zero occupation. Compass entre 2019 et 2022, 4500 agents en
salarie direct face a un marche immobilier residentiel cyclique,
valorisation effondree de 23 milliards a 800 millions. Quibi en
2020, 1,75 milliard d engagements contenus pour des series qui ont
ete annulees apres six mois, dissolution complete fin 2020.
MoviePass entre 2017 et 2019, places de cinema vendues sous le prix
d achat structurel sans reduction possible cote couts.
Peloton entre 2021 et 2023, capex usine plus stocks plus payroll
ingenierie face a une demande hardware divisee par trois,
restructuration majeure et plusieurs vagues de layoffs.
Cazoo entre 2019 et 2023, stocks voitures plus entrepots plus
livraison nationale finances par 800 millions de capital, marge
unitaire structurellement negative et baisse de la demande,
delisting et restructuration.
Helio en 2008, infrastructure telecom fixe pour un MVNO en perte,
liquidation. AOL post-2002, data centers et personnel pour
l infrastructure dial-up qui devenait obsolete face au broadband.

### Counter-archetypes sains

Airbnb, asset-light explicitement, pas de propriete immobiliere ou
de stock, juste la plateforme. La discipline de modele a survecu a
toutes les phases de croissance de l entreprise. La structure de
couts variable a permis l absorption de la chute de demande
pandemique 2020 sans collapse.

Booking, commission only sur les chambres d hotel, pas de stock
hotelier, capacite a absorber les chocs cycliques tourisme.

Spotify, engagements minimum garantis aux labels significatifs mais
ces engagements scalent avec le revenu publicite et premium, pas en
absolu. Le ratio coute / revenu est stable dans le temps, signe
d alignement structurel.

Netflix, engagements de production de contenu massifs mais avec un
ROI mesure par titre, une flexibilite de cancellation des
productions non engagees, et une internationalisation progressive
qui amortit le cout fixe par marche. Le contre-exemple Quibi montre
qu un meme modele peut etre saine ou trap selon l execution.

Uber post-2019, reduction massive des couts fixes via automation
customer support, simplification structure operationnelle, fermeture
des marches non rentables, layoffs cibles sur les fonctions
non-core. La capacite de variabilisation a ete demontree et a
permis le retour a la profitabilite operationnelle.

Salesforce, engagements data center importants mais alignes sur des
contrats clients eux-memes long terme et garantis. Le ratio
engagement off-balance sheet contre revenu reste dans le decile bas
du SaaS sectoriel.

La distinction fondamentale n est jamais le simple fait d avoir des
couts fixes. C est l alignement entre la nature long terme des
engagements et la previsibilite long terme du revenu, plus la
capacite documentee a reduire le burn quand cet alignement
deraille. Salesforce a des engagements long terme alignes sur des
contrats client long terme. WeWork avait des engagements long
terme alignes sur des occupations courtes au choix du membre.
La meme structure de coute peut etre saine ou trap selon ce que
le revenu sous-jacent permet de soutenir.

## Sources que le moteur doit interroger

BP du dossier comme source primaire pour le breakdown couts fixes
contre variables. Le moteur a besoin du detail ligne a ligne pour
calculer les ratios. Si le BP n est pas detaille, recommandation DD
de demander la decomposition.

Comptes deposes au registre RCS via Pappers (FR, BE, LU) pour les
comptes annuels qui montrent les engagements hors bilan. Les notes
annexes obligatoires en IFRS et en plan comptable francais incluent
le tableau des engagements donnes pour les loyers, contrats
fournisseurs, et clauses de minimum. Le moteur cherche directement
ce tableau.

Filings SEC pour les boites US cotees, qui obligent la declaration
des operating leases et des purchase commitments dans les 10K
annuels (Item 7A et notes financieres). Le moteur peut faire un
fetch direct des derniers filings disponibles.

Web search pour reperer les signaux de stress recents : layoffs,
restructurations, fermetures de sites, defaut sur engagements
fournisseurs, news de difficultes. Si le moteur trouve plusieurs
articles documentant des layoffs sans qu ils apparaissent dans la
communication officielle de l entreprise, signal divergent a noter.

Pitch deck pour les claims sur l asset-lightness, la discipline de
couts, ou au contraire les claims expansionnistes sur les site
openings, les recrutements massifs, les capex annonces.

DD financiere si elle est disponible : breakdown granulaire des
loyers par site, des contrats fournisseurs, des clauses de minimum.
La DD financiere est presque toujours necessaire pour conclure
solidement sur ce pattern.

## Format de l output

Pour chaque axe, score 0-100, evidence pro chiffree, evidence
contra chiffree, confidence. Score global Fixed Cost Trap. Counter-
archetype le plus proche identifie et justifie.

Tableau structure des engagements long terme identifies, avec pour
chaque engagement : categorie (loyer, contrat fournisseur, payroll
senior, capex), montant total, duree restante, penalite de sortie
estimee, alignement avec un revenu garanti. Ce tableau est la
livrable principal du pattern, plus important que le score lui-meme.

Recommandation DD specifique. Sur ce pattern, la recommandation est
toujours une demande de breakdown granulaire des couts fixes par
categorie plus un downside scenario chiffre a -30% revenu et a -50%
revenu, avec plan d action correspondant. Le moteur peut formuler
la demande comme une question precise au CFO du dossier.

## Conditions de remontee a la couverture de la note

Pattern remonte sur la page de couverture si score global superieur
ou egal a 65 ET au moins deux axes individuels superieurs ou egaux
a 55. Le seuil est plus eleve que sur Growth Subsidized parce que
les modeles asset-heavy declenchent regulierement des scores
intermediaires legitimes qui ne meritent pas la couverture.

Si le pattern Fixed Cost Trap remonte ET que Growth Subsidized
Model remonte aussi sur le meme dossier, la combinaison est marquee
sur la couverture comme exposition double, signal d alerte renforce
parce que la trajectoire WeWork etait precisement cette combinaison.

## Methode anti-hallucination

Le LLM ne peut pas conclure a Fixed Cost Trap sur des impressions
type structure de couts trop lourde. Il doit nommer les engagements
specifiques, leur montant, leur duree, leur penalite de sortie, et
citer la ligne du BP ou la note annexe des comptes. Tag obligatoire :

- [bp] pour les chiffres du business plan
- [pitch] pour les declarations du pitch
- [comptes] pour les engagements lus dans les comptes deposes
- [sec] pour les filings SEC
- [web] pour les news de stress recents et les benchmarks tiers
- [inference] pour les calculs derives, avec la formule explicite

Si le LLM dit beaucoup de loyers, il doit donner le total des
engagements et la duree. Si le LLM dit pas de variabilisation
possible, il doit avoir verifie l absence de track record et
l absence de downside scenario, pas l avoir presumee.

Contrainte de coherence avec les metriques objectives. Si plus de
70% du burn est verrouille contractuellement ET aucun downside
scenario chiffre dans le BP, globalFixedCostTrapScore superieur ou
egal a 70 force. Si moins de 35% de couts fixes ET track record de
variabilisation reussie documente, score inferieur ou egal a 30
sauf evidence forte de durcissement recent du modele.

## Difference avec les patterns voisins

Avec Growth Subsidized Model. Growth Subsidized regarde si chaque
transaction marginale cree de la valeur, c est un probleme d unit
economics. Fixed Cost Trap regarde si la base de couts incompressibles
peut tuer l entreprise independamment de la qualite des transactions
marginales. Les deux peuvent coexister sur le meme dossier (WeWork
avait les deux), mais ils peuvent aussi exister separement. Une
boite peut avoir une marge unitaire saine ET un Fixed Cost Trap, par
exemple un real estate operateur avec marge bonne par metre carre
mais expansion trop rapide en absolu. Inversement, une boite peut
avoir une marge unitaire negative sans Fixed Cost Trap si elle peut
scaler down ses couts variables, par exemple une fintech BNPL qui
peut reduire son exposition credit en arretant de prendre du nouveau
business. Le moteur Phase 4 active les deux en parallele et combine
leurs verdicts en cas de detection conjointe.

Avec Infrastructure Hostage. Infrastructure Hostage regarde la
captivite externe vis-a-vis des fournisseurs. Fixed Cost Trap regarde
les engagements internes pris par l entreprise elle-meme. Les deux
sont des fragilites de couts mais avec causalite opposee : Hostage
subit, Trap a choisi. Le mitigant differe en consequence : pour
Hostage on cherche un plan de portabilite, pour Trap on cherche une
discipline de variabilisation.

Avec Aveuglement aux Couts Caches du moteur 8 actuel. Le moteur 8
detecte le DENI psychologique du fondateur sur la nature de ses
couts. Il porte sur la posture mentale. Fixed Cost Trap detecte la
REALITE structurelle des engagements contractuels. Un fondateur peut
etre parfaitement lucide sur ses 3 milliards d engagements
contractuels et le dire ouvertement, ce qui annule le pattern de
deni mais pas Fixed Cost Trap. La matrice de pertinence active
aveuglement en early stage et Fixed Cost Trap en growth stage.

Avec Friction d Execution du moteur 12 actuel. Friction d Execution
regarde le frottement operationnel sur les huit axes go-to-market,
financement transactionnel, industrialisation, supply chain,
ecosysteme, regulation, referencement, talent rare. Fixed Cost Trap
regarde la base de couts contractuelle. Les deux peuvent s activer
ensemble : un dossier en industrialisation prematuree (Friction
d Execution sur l axe industrialisation) qui aurait deja signe
trop d engagements de site (Fixed Cost Trap) cumule les deux
patterns. La distinction reste claire : Friction est un probleme
de pace, Trap est un probleme de structure de couts.
