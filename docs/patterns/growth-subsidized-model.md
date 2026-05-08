# Pattern Growth Subsidized Model

Fiche de specification du moteur. Premiere version, redigee en session
conceptuelle. A integrer ulterieurement dans lib/engines/.

## Definition

Une entreprise dont la croissance est financee par injection externe de
capital plutot que par les flux generes par le modele lui-meme. Le revenu
existe, parfois en augmentation rapide, mais la marge unitaire est negative
ou la marge globale ne couvre ni les couts variables ni les couts
d acquisition. Le modele ne tient que tant qu il y a des tours de
financement disponibles. Quand le marche du capital se ferme, l entreprise
s effondre en quelques trimestres.

C est le pattern le plus universel des effondrements growth recents.
WeWork a 8 milliards de loyers signes sans path to profitability. Cazoo
a 5 milliards de valorisation pour une marge unitaire negative sur chaque
voiture vendue. Klarna 2022 dont la croissance reposait sur une expansion
BNPL non rentable. Fast Checkout qui a brule 100 millions en 18 mois sans
atteindre le break-even.

## Stade d application

Pertinent des la Series A pour les boites avec revenus mesurables.
Application obligatoire a partir de Series B. Devient critique en Series C,
D, growth, pre-IPO.

Ne s applique pas aux pre-seed et seed pre-revenue. Pour ces stades, on
garde le pattern Deni des Unit Economics du moteur 8 actuel.

## Trois axes de mesure

### Axe 1 : deficit unitaire structurel

Mesure si chaque transaction marginale detruit ou cree de la valeur. Calcul :
marge unitaire apres tous les couts variables (CAC inclus pour les modeles
SaaS et marketplace, COGS variables pour les modeles produit). Si la marge
unitaire est negative, le modele perd de l argent a chaque vente.

### Axe 2 : dependance fundraising

Mesure le ratio entre cash sortant (burn) et cash entrant non-financier.
Calcul : runway organique en mois (cash actuel / burn moyen) hors
injections futures. Si runway organique < 12 mois et marge unitaire ne
devient pas positive dans cette fenetre, l entreprise est en dependance
structurelle.

### Axe 3 : pente de la convergence vers le break-even

Mesure l evolution dans le temps de la marge unitaire et du ratio CAC/LTV.
Une boite saine voit ces ratios s ameliorer trimestre apres trimestre.
Une boite en growth subsidized voit ces ratios stagner ou se degrader
malgre la croissance du revenu.

## Conditions d application strictes

Le moteur ne se declenche que si le dossier fournit au minimum un BP ou
des projections financieres chiffrees sur trois ans. Sans ces donnees,
status not-applicable.

- BP triennal complet + cohort analysis = full
- BP a 1 an seulement = partial (axe 3 desactive)
- Pas de BP = not-applicable

## Evidence factuelle requise pour score >= 60

Au moins deux evidences chiffrees convergentes parmi :

- Marge unitaire negative demontree sur les 12 derniers mois
- Ratio LTV/CAC < 2 sur la cohorte la plus recente (sain >= 5)
- Runway organique < 12 mois hors injections de capital prevues
- Croissance revenue > 50% mais marge brute en degradation sequentielle
- Levee cumulee > 3x le revenu demontre
- Burn multiple > 2 (montant brule pour generer un dollar de revenu)

Une evidence isolee ne suffit pas.

## Evidence contradictoire obligatoire

Le moteur cherche symetriquement ce qui contredit le pattern :

- Marge unitaire qui s ameliore trimestre apres trimestre malgre marge
  globale encore negative
- LTV/CAC qui s ameliore avec l allongement de la cohorte
- Diminution mesurable du burn comme part du revenu sur 12 mois
- Presence d un segment du business deja rentable qui finance les
  segments en croissance (cas Amazon AWS finançant les expansions)

## Counter-archetypes

### Patterns confirmes (effondrement ou near-death)

WeWork avant l IPO refusee. Cazoo entre 2019 et 2022 (800M leves pour
marge unitaire systematiquement negative). Klarna 2021-2022 (chute de
46Md a 6Md de valorisation). Fast Checkout (100M brules en 18 mois).
Quibi (1.75Md brules avant fermeture). MoviePass (places de cinema
vendues sous le prix d achat).

### Counter-archetypes sains

Stripe (annees non-rentables mais marge unitaire positive et
amelioration constante). Datadog (NRR > 130% justifiant le payback).
Snowflake (investissement sales massif sans marge unitaire negative
masquee). HubSpot (payback < 24 mois sur cohortes recentes). Adyen
(approche capital-efficient en depit de la croissance internationale).

La distinction n est jamais le simple fait de bruler du cash. C est la
trajectoire de la marge unitaire et du capital efficiency. Stripe
brulait, sa pente convergeait. WeWork brulait, sa pente divergeait.

## Sources que le moteur doit interroger

BP du dossier (toujours), cohort analysis si disponible, pitch deck
pour les claims sur la traction.

Pour boites US cotees en growth (Series F+, pre-IPO), filings SEC
permettent verification tierce. Pour boites europeennes, comptes
deposes au registre RCS via Pappers (quand active) confirment ou
contredisent les claims. Pour comparables sectoriels, web search.

## Format de l output

Pour chaque axe : score 0-100, evidence pro chiffrees, evidence contra
chiffrees, confidence. Score global Growth Subsidized. Trajectoire si
BP triennal disponible. Counter-archetype le plus proche identifie,
justifie. Recommandation DD specifique.

Sur ce pattern, la recommandation est presque toujours une demande de
cohort analysis detaillee par segment et par millesime, avec
decomposition LTV/CAC mesuree et pas projetee.

## Conditions de remontee a la couverture de la note

Pattern remonte sur la page de couverture si score global >= 60 ET au
moins deux axes individuels >= 50.

## Methode anti-hallucination

Le LLM ne peut pas conclure a un Growth Subsidized sur des impressions.
Il doit citer des chiffres precis du BP. Tag obligatoire :

- [bp] pour les chiffres du business plan
- [pitch] pour les declarations du pitch
- [web] pour les benchmarks tiers
- [inference] pour les calculs derives

Si le LLM dit "marge unitaire negative" il doit nommer la marge en
pourcentage et citer la ligne du BP.

Contrainte de coherence : si marge brute < 30% ET LTV/CAC < 2,
globalGrowthSubsidizedScore >= 70 force. Si marge brute > 70% ET
LTV/CAC > 4, score <= 30 sauf evidence forte de degradation
trajectoire.

## Difference avec Deni des Unit Economics du moteur 8 actuel

Le moteur 8 detecte le DENI psychologique du fondateur, c est a dire la
posture mentale qui refuse de regarder les chiffres. Growth Subsidized
Model detecte la REALITE structurelle du modele, c est a dire ce que les
chiffres disent objectivement.

Un fondateur peut etre parfaitement lucide sur son unit economics
negative et le dire ouvertement, ce qui annule le pattern de deni mais
pas le pattern Growth Subsidized. Inversement, un fondateur peut nier
la realite tout en ayant un modele structurellement sain.

La matrice de pertinence active Deni en early stage et Growth Subsidized
en growth stage.
