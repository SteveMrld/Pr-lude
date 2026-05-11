# Score de Trajectoire (Phase 4)

Fiche de conception produit du module qui mesure l évolution de la
fragilité d un dossier dans le temps en comparant deux ou plusieurs
analyses datées du même dossier. Document de cadrage à valider avant
implémentation. Aucune ligne de code ne se touche tant que cette fiche
n a pas fait l objet d un accord explicite. Voix éditoriale Le Grand
Continent dans la fiche et dans l UI qu elle prescrit, pas de jargon
technique exposé au partner.

## Le geste produit

Les outils VC classiques prennent un instantané. Affinity, Carta,
PitchBook, decks manuels : tous lisent l entreprise comme une photo, à
une date, sur une thèse. Prélude lit déjà autrement parce que chaque
moteur extrait des fragilités structurelles invisibles à l œil nu. Mais
même une lecture de fragilité reste, à analyse unique, un constat à un
instant T. Or les fragilités qui comptent ne sont pas celles qui
existent aujourd hui, ce sont celles qui s aggravent. WeWork en 2017
était une boîte saine si on l observait isolément, c est la trajectoire
2017-2019 qui révèle la doctrine Adam Neumann en pleine cristallisation,
les engagements long terme qui s empilent, la cap table qui se charge en
preferences. Theranos en 2014 paraissait crédible. C est la trajectoire
des prises de parole publiques de Holmes qui dessine, rétrospectivement,
la dérive narrative.

Le Score de Trajectoire est donc le moteur qui transforme Prélude
d outil d instruction à instant T en outil de monitoring temporel. Il
répond à la question doctrinale du moteur : cette entreprise est-elle
en train de devenir plus forte, ou plus fragile sans que le marché ne
le voie encore. C est aussi le module le plus différenciant
commercialement, parce qu il justifie un abonnement récurrent : un
fonds growth qui suit un portfolio sur dix-huit à trente-six mois paie
pour la lecture continue, pas pour l analyse ponctuelle.

## Ce qui existe déjà

Un premier passage du module a été livré en avril 2026 dans
`lib/engines/trajectory/`. Il contient quatre fichiers, tous écrits
sans dette technique apparente. Le `snapshot-extractor` réduit un
payload d analyse complet (typiquement 200 Ko) en un `TrajectorySnapshot`
compact (quelques Ko) qui ne retient que ce qui sert au calcul de
trajectoire : score global, verdict, six dimensions Bloc 1, score et
verdict Fragilité Structurelle, score et verdict Narrative Drift,
scores et verdicts des sept patterns Phase 4, combinaisons
diagnostiques détectées. Le `comparator` calcule les deltas entre deux
snapshots, les transitions de verdict, les combinaisons apparues,
résolues, persistantes, et produit un résumé éditorial. Le
`chain-builder` enchaîne N analyses en N-1 comparaisons successives plus
une comparaison globale début-fin, avec un agrégat (totalDays,
totalDrapeauxRougesApparus, tendanceGlobale). La route
`GET /api/analyses/[id]/trajectory` expose le résultat au client.

L existant a deux limites structurelles qui justifient le présent
travail. La première est la persistance : les snapshots sont
reconstitués à la volée à partir d `analyses_versions`, table qui
stocke chaque version d analyse comme un blob JSON de 200 Ko. Pour
afficher une trajectoire de cinq analyses, il faut charger un mégaoctet
de JSON et le ré-extraire à chaque appel. C est viable pour un dossier
consulté ponctuellement, c est intenable pour le scénario doctrinal qui
fait la valeur du module : un fonds qui veut requêter "tous les
dossiers du portfolio où Fragilité Structurelle a aggravé de plus de
dix points sur les douze derniers mois". La deuxième limite est
l absence d alerte automatique : aucun mécanisme ne notifie le partner
qu un dossier qu il suit a basculé sans qu il ait à ouvrir la note. Le
module est donc passif là où la doctrine attend un module actif.

## Sept arbitrages produit à trancher

Chaque décision se présente avec son dilemme, les options envisagées,
une recommandation, et un rationale doctrinal en deux phrases. L ordre
suit la chaîne logique : on commence par quand on déclenche, on finit
par comment on absorbe les cas limites.

### Décision 1 : mode de déclenchement de la ré-analyse

Le partner peut vouloir re-comparer un dossier soit parce qu il vient
de l ouvrir et veut voir où il en est, soit parce qu un événement
externe a changé la lecture (annonce de levée, départ d un fondateur,
publication de comptes), soit parce que le simple passage du temps
mérite une vérification de routine. Trois options. La première est le
mode manuel exclusif : le partner clique "ré-analyser" quand il le
décide. La deuxième est l automatique calendaire : tous les six mois,
le système relance la pipeline sur le dossier avec les dernières
données disponibles. La troisième est hybride : manuel par défaut pour
l instruction, automatique sur les dossiers explicitement marqués "en
portfolio" qui justifient un monitoring récurrent.

**Recommandation : hybride.** L instruction d un dossier en pre-deal
relève d un geste partner, déclencher l analyse automatiquement
brouillerait la responsabilité éditoriale du verdict. Le portfolio
post-investissement, lui, vit dans une logique de surveillance
récurrente qui doit fonctionner sans intervention humaine sous peine
de devenir le poste qu on oublie.

### Décision 2 : granularité de la comparaison

Une trajectoire peut se lire à plusieurs profondeurs. Au plus fin, on
compare axe par axe : pour chaque pattern Phase 4, le delta de chacun
des trois axes (axe identitaire, axes périphériques). Au niveau
intermédiaire, on compare pattern par pattern : un score et un verdict
global par pattern. Au niveau le plus grossier, on compare moteur par
moteur (Fragilité, Narrative Drift, Coherence Financière, etc.). Trois
options. Choisir uniquement pattern par pattern, qui est ce que fait le
v1. Choisir uniquement axe par axe, qui décuple le bruit visuel.
Choisir les deux, avec lecture pattern en surface et drill-down axe au
clic.

**Recommandation : les deux, hiérarchisé.** Le partner doit pouvoir
lire la trajectoire d un dossier en trente secondes, ce qui interdit
d ouvrir d emblée vingt-et-un axes ; mais il doit aussi pouvoir
comprendre pourquoi un pattern s aggrave, ce qui exige d aller voir
quel axe précis a bougé. La hiérarchie pattern-puis-axe sert les deux
moments de lecture sans les confondre, et l infrastructure de
comparator existe déjà au niveau pattern, l extension axe-par-axe est
un ajout marginal.

### Décision 3 : mode de calcul des deltas

Trois logiques de calcul cohabitent dans la littérature analytique. La
brute soustrait simplement les deux scores : after moins before. La
pondérée applique un coefficient par pattern selon son poids matriciel
dans la doctrine. La relative exprime le delta en pourcentage du score
de départ (un dossier qui passe de 80 à 70 perd 12,5%, un dossier qui
passe de 40 à 30 perd 25%, l aggravation relative est plus forte sur le
second).

**Recommandation : delta brut comme signal numérique, transition de
verdict comme signal qualitatif, jamais l un sans l autre.** Le delta
relatif crée une fausse symétrie qui flatte les mauvais dossiers (perte
de 5 points sur 30 est mathématiquement plus grave que perte de 5
points sur 80, mais doctrinalement l inverse est vrai parce que les
verdicts ne sont pas linéaires). Le delta pondéré ajoute une couche
d opacité que le partner ne peut pas auditer ; il vaut mieux laisser le
score brut visible et accompagner systématiquement de la transition de
verdict qui porte la lecture qualitative.

### Décision 4 : seuils d alerte

Toute la valeur d un module de trajectoire passive est dans ce qu il
décide de notifier activement. Quatre signaux candidats. Le delta de
score global : une variation de plus de dix points justifie une
notification. La transition de verdict : tout downgrade
(APPROFONDIR vers REFUSER, INVESTIR_AVEC_CONDITIONS vers APPROFONDIR)
justifie une alerte indépendamment du score. La combinaison
diagnostique drapeau-rouge nouvellement apparue : par construction la
plus diagnostique, parce qu une combinaison croise plusieurs patterns
et ne peut pas apparaître par bruit. Le pattern Phase 4 individuel qui
passe de sain à alerte ou drapeau-rouge : signal de bascule sur un axe
de fragilité spécifique.

**Recommandation : hiérarchie d alertes à quatre crans, du plus
critique au plus indicatif.** Cran 1, combinaison drapeau-rouge
nouvellement détectée, notification immédiate, email et UI. Cran 2,
verdict global downgrade ou pattern qui passe à drapeau-rouge,
notification immédiate UI. Cran 3, delta de score global supérieur ou
égal à dix points en aggravation, ou pattern qui passe de sain à
attention ou alerte, agrégé en digest hebdomadaire. La transition
sain vers non-sain mérite un signal actif et non un simple changement
de couleur, raison pour laquelle elle ne se range pas en cran passif.
Cran 4, variations sub-significatives qui restent dans la zone de
tolerance, visibles en UI à l ouverture du dossier comme indicateur
passif. Ces seuils sont calibrés pour qu un fonds qui suit cinquante
dossiers en portfolio reçoive en moyenne moins d une notification
immédiate par semaine, ce qui préserve le signal contre l effet bruit.

Les canaux de notification du MVP sont volontairement réduits à
deux : email pour les notifications immédiates et pour le digest
hebdomadaire, badge UI pour les transitions vues à l ouverture du
dossier. Slack, webhooks tiers et autres surfaces d intégration sont
écartés à ce stade pour ne pas multiplier les coûts opérationnels
avant signal commercial des premiers fonds clients. Le format du
digest hebdomadaire est une prose éditoriale générée par LLM dans la
voix Le Grand Continent, pas un tableau austère de transitions
chiffrées : la lecture portfolio se tient au même registre que la
note d instruction, parce qu un partner qui balaie quarante dossiers
en deux minutes lit mieux une narration courte qu une grille de
chiffres.

### Décision 5 : affichage UI dans la note d instruction et le dashboard

Le rendu visuel d une trajectoire conditionne sa lisibilité. Trois
formes envisageables. Deux notes côte à côte, lecture parallèle stricte,
laisse au partner le soin de comparer. Une note unique annotée des
deltas, chaque section porte ses transitions inline (le verdict
Fragilité passe d attention à alerte, le pattern Coûts fixes passe de
35 à 52, etc.). Une timeline visuelle, graphique de scores dans le
temps, vue agrégée par dossier ou par portfolio.

**Recommandation : note unique annotée pour la lecture détaillée,
timeline visuelle pour la vue dashboard, jamais le côte à côte.** Le
côte à côte double la masse textuelle sans rien apporter à la lecture
diagnostique et trahit la voix éditoriale (deux dissertations
juxtaposées au lieu d une dissertation enrichie). La note annotée garde
le format Le Grand Continent en y inscrivant les transitions comme on
inscrirait des notes de bas de page sur un texte vivant. La timeline
sert la vue portfolio où le partner balaie quarante dossiers en deux
minutes et veut repérer les courbes qui plongent.

### Décision 6 : persistance Supabase

Le choix de schéma détermine la performance de toutes les requêtes de
trajectoire à venir. Trois options. Option A, statu quo : on continue à
agréger sur `analyses_versions`, table qui stocke le payload complet en
JSONB et qui reconstruit le snapshot à la volée. Option B, table dédiée
`trajectory_snapshots` qui stocke chaque snapshot dans une ligne typée
(colonnes pour score global, verdict, score Fragilité, verdict
Fragilité, plus un champ JSON compact pour les patterns), liée à
`analyses` par `analysis_id`. Option C, hybride : on garde
`analyses_versions` pour l archive complète et on ajoute
`trajectory_snapshots` indexée pour les requêtes.

**Recommandation : option C, hybride.** `analyses_versions` reste la
source de vérité archivale et garde le payload complet (utile pour
restauration, ré-analyse, audit), `trajectory_snapshots` devient la
vue dénormalisée qui sert les requêtes de monitoring portfolio. La
duplication est assumée parce qu elle débloque le scénario commercial
critique : un fonds qui veut requêter en une seconde "quels dossiers de
mon portfolio ont vu apparaître une combinaison drapeau-rouge sur les
six derniers mois" doit interroger une table indexée, pas désérialiser
N blobs JSON. Le coût de stockage est négligeable, la complexité
opérationnelle est encapsulée par un trigger qui écrit dans
`trajectory_snapshots` à chaque insertion dans `analyses_versions`.

### Décision 7 : traitement des cas limites

Trois cas limites doctrinaux émergent dans la pratique. Stades
différents entre les deux analyses : un dossier analysé en Series A
puis ré-analysé en Series C voit la matrice de pertinence activer des
patterns qui n étaient pas applicables en Series A (Scale Mirage Risk,
Capital Structure Fragility). Comparer des scores quand le périmètre
des moteurs activés change est techniquement possible mais
doctrinalement piégeux. Business model change : un dossier qui pivote
de marketplace à SaaS pur entre deux analyses ne se compare pas trait
pour trait. Changement de fondateurs : une re-fondation post départ
CEO produit une rupture de continuité narrative qui mérite d être
nommée.

**Recommandation : chaque snapshot porte explicitement son contexte
(stade, business model, fondateurs majeurs), et la synthèse de
trajectoire signale les ruptures de contexte en première phrase.**
Pour les patterns nouvellement applicables, le `comparator` produit
déjà la transition `newly-applicable`, il suffit d ajouter un libellé
éditorial qui dit au partner "ce pattern est apparu dans la lecture
parce que le dossier est passé en Series C, pas parce qu il s est
aggravé". Pour les ruptures structurelles (business model, fondateurs),
la trajectoire reste calculable mais s annonce d entrée comme
"trajectoire interrompue par re-fondation" plutôt que de laisser
croire à une continuité.

## Cas limites secondaires à traiter en passant

Quelques cas mineurs méritent d être tranchés sans en faire des
décisions structurelles. Analyse unique : pas de comparison, la
trajectoire s affiche en mode "snapshot initial, prochaine ré-analyse
créera la première comparaison", pas d erreur. Deux analyses très
rapprochées (moins de trente jours) : on calcule la comparison mais on
signale dans la synthèse "écart temporel court, les deltas peuvent
refléter une variabilité d analyse plus qu une évolution réelle".
Pattern présent à T-1 et absent à T en raison d un changement de
matrice : transition `newly-not-applicable`, déjà gérée, libellée
éditorialement comme "pattern devenu hors-scope". Dossier supprimé
puis ré-uploadé avec un nouvel `analysis_id` : la chaîne de trajectoire
se reconstitue par `company_name` plus `user_id` plutôt que par
`analysis_id` strict, ce qui suppose un index supplémentaire sur
`analyses (user_id, company_name)`.

## Périmètre d implémentation prévu (session suivante)

Une fois cette fiche validée, la deuxième session attaque dans cet
ordre. Migration Supabase, création de `trajectory_snapshots` et de son
trigger d écriture depuis `analyses_versions`. Couche persistance,
fonctions `saveTrajectorySnapshot` et `listTrajectorySnapshots` dans un
nouveau `lib/trajectory-store.ts`. Refactor de `comparator.ts` et
`chain-builder.ts` pour consommer la nouvelle table plutôt que de
ré-extraire depuis `analyses_versions`. Extension de la granularité
axe-par-axe dans le `TrajectorySnapshot` et le `comparator`. Module
d alertes, fonction `evaluateTrajectoryAlerts` qui produit une liste
hiérarchisée à quatre crans, branchement sur un canal de notification
(mail, UI badge, digest hebdomadaire). UI annotée dans
`InvestmentNoteView`, blocs `delta-annotation` inline dans chaque
section concernée. Timeline visuelle dans le dashboard, composant
`TrajectoryTimeline` qui consomme la chaîne. Mode hybride de
déclenchement, marquage `in_portfolio` sur la table `analyses` et job
cron qui relance la pipeline tous les six mois sur ces dossiers. Tests
déterministes pour les helpers de comparaison, les seuils d alerte, le
traitement des ruptures de contexte. Audit E2E sur trois dossiers de
référence avec ré-analyses simulées (WeWork t0/t1/t2, Theranos t0/t1,
Stripe t0/t1 comme contrôle sain).

Le travail est estimé à une à deux semaines de session Claude Code,
plusieurs commits tagués `feat(trajectoire)`, calibration finale sur un
dossier de portfolio réel avant ouverture commerciale.

## Ce que la fiche laisse explicitement ouvert

Une seule question reste en suspens et relève d un arbitrage hors
périmètre technique. Le tarif différentiel entre l abonnement
instruction (analyse à la demande) et l abonnement monitoring
(trajectoire active sur portfolio) est laissé volontairement ouvert,
à finaliser commercialement avec les premiers fonds clients. Les
deux autres questions qui figuraient en ouverture lors de la première
version de cette fiche, à savoir le canal de notification et le
format du digest hebdomadaire, sont tranchées dans la section
seuils d alerte ci-dessus : email plus UI pour le MVP, prose
éditoriale LLM pour le digest.
