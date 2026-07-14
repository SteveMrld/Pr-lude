# Regle de selection deterministe du corpus de calibration

Document doctrinal accompagnant `lib/calibration/corpus-selection.ts`. La
regle est ecrite en code, ce document explique la doctrine, la migration
proposee pour la structurer, et la sortie d audit qui prouve l application
sans exception.

## Etat actuel de la selection, avant regle

Le pipeline actuel n applique aucun filtre autre que le mapping taxonomique
vers observed binaire. Concretement, `buildCalibrationSummary` dans
`lib/calibration/calibration-aggregator.ts` charge la totalite des lignes
`analysis_outcomes` du user, les joint aux `prediction_records`, et passe
au calcul chaque paire dont l issue est resolue (exit, alive_thriving,
fail). La segmentation par version stamp est en place, le seuil de dix
resolus par segment est en place, mais la selection intra segment est
implicite, toutes les issues resolues presentes en base sont utilisees.

Le niveau de fiabilite existe deja dans les faits, il est saisi en texte
libre dans le champ `source_notes` de chaque outcome. Une inspection
rapide des dix issues en base montre trois formes recurrentes,
« Fiabilite haute », « Fiabilite bonne » et « Fiabilite moyenne » avec
variations d accentuation et de casse. Ce texte n est pas exploitable
par une regle deterministe, il ne peut pas etre requete, il peut etre
modifie silencieusement sans historique, il ne porte aucune contrainte
d integrite.

Cette situation ouvre deux vulnerabilites. Un, le biais du selectionneur,
qui peut choisir d ecarter une issue en la degradant informellement dans
la note plutot qu en la retirant du corpus. Deux, l opacite d audit, il
n existe aucun moyen de prouver a un examinateur externe que la
selection est appliquee sans exception, puisque le critere lui meme est
en langage naturel.

## Formalisation proposee du niveau de fiabilite

Le niveau de fiabilite devient un champ structure dedie sur
`analysis_outcomes`, avec trois valeurs discretes controlees par une
contrainte CHECK cote base. Le choix de trois niveaux est intentionnel,
un continuum encourage la reappreciation subjective, une echelle discrete
force a nommer explicitement le passage d un niveau a l autre.

Definitions doctrinales des trois niveaux.

**haute**. Temoignage direct du fondateur, du porteur du dossier ou de la
partie ayant l information de premiere main. Ou source primaire
verifiable, greffe de tribunal, communique officiel de sortie, document
enregistre au registre du commerce donnant l information sans
interpretation.

**bonne**. Source publique fiable sans confirmation par la partie qui
detient l information. Registres publics, presse economique serieuse,
comptes deposes recents. La source est solide mais un delai ou une
zone d ombre subsiste entre l evenement et sa constatation par le
canal utilise.

**moyenne**. Proxy d etat, inference plausible non confirmee par la
source qui detient l information. Cas typique, une societe est visible
comme active dans les registres avec des chiffres coherents, mais le
deal dont on evalue la these d instruction n a pas ete public. Le proxy
est utile pour tracer la ligne, il ne peut pas fonder un discriminant
de calibration.

## Migration proposee, non appliquee

Une migration SQL ajoute le champ. Elle n est pas executee dans ce brick,
elle est proposee ici pour revue. Elle sera appliquee dans le brick
suivant, en meme temps que le retro remplissage des dix issues existantes.

```sql
ALTER TABLE public.analysis_outcomes
  ADD COLUMN reliability text;

ALTER TABLE public.analysis_outcomes
  ADD CONSTRAINT analysis_outcomes_reliability_check
  CHECK (reliability IS NULL OR reliability IN ('haute', 'bonne', 'moyenne'));

NOTIFY pgrst, 'reload schema';
```

Le retro remplissage utilisera la fonction `parseReliabilityFromNotes`
deja exposee dans `lib/calibration/corpus-selection.ts`. La regex
capture les trois formes texte connues avec tolerance de casse et
d accentuation. Toute ligne dont la note ne contient pas de mention
explicite reste avec `reliability = null`, ce qui la classera
automatiquement en `reliability-missing` dans l audit et forcera une
saisie propre plutot qu une imputation automatique risquant de biaiser
le discriminant.

Le brick suivant devra egalement adapter `AnalysisOutcome` dans
`lib/analysis-outcomes-store.ts` pour transporter le champ, adapter
`upsertAnalysisOutcome` pour l accepter, et brancher
`buildCalibrationSummary` pour appliquer `applyCorpusSelectionRule` avant
`computeCalibrationFromMixed`. Rien de tout cela n est fait dans ce
brick, on construit la regle et on la teste.

## La regle, en une phrase

Une issue entre dans le calcul discriminant si et seulement si son etat
est resolu au sens de la taxonomie et si sa fiabilite est haute ou
bonne. Les issues de fiabilite moyenne restent en base, visibles dans
les rapports, marquees comme non discriminantes, et attendent qu une
meilleure source les upgrade avant d etre comptees.

La regle vit dans `applyCorpusSelectionRule`, fonction pure sans effet
de bord, sans I/O, dont le seul parametre est la liste des candidats.
La signature interdit techniquement d ecarter un dossier nommement, il
n existe aucun parametre du type `excludeIds`, `whitelist` ou
`overrideMap`. Le test de garde `applyCorpusSelectionRule.length === 1`
verifie ce contrat a chaque run de la suite, tout ajout futur de
parametre casse le test et bloque le merge.

## La sortie d audit

`renderAuditPlain` produit un rapport lisible en salle. Il affiche
l en tete des comptes (candidats, inclus, exclus, motifs), puis la liste
ligne par ligne avec pour chaque dossier son id, son nom, son etat
resolu ou non, son niveau de fiabilite, sa decision et le motif
d exclusion s il y a lieu. Le tri place les inclus en tete, puis les
exclus, chaque bloc trie par nom pour la lisibilite.

Un examinateur peut donc, en lisant l audit et en connaissant la regle,
reconstituer mentalement chaque decision et verifier qu aucun cas
n echappe au critere. Si un dossier X est exclu et que sa fiche montre
`reliability = haute` et un etat resolu, l audit contredit la regle et
la faille est visible en une lecture.

## Ce qui n est PAS dans ce brick

Aucune modification des dix issues existantes. Aucune migration executee.
Aucun rebranchement de `buildCalibrationSummary`. Aucun retro remplissage
de reliability. Ce brick construit la regle, sa doctrine et sa suite de
tests. Le brick suivant appliquera la regle et migrera la donnee.
