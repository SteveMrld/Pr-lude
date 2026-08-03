# CLAUDE.md

Brief de contexte pour toute session Claude Code lancee dans le
repo Prelude. A lire en entier avant tout travail.

## Identite du projet

Prelude est une plateforme d instruction de dossiers de venture
capital, vendue aux fonds institutionnels (Eurazeo, Tikehau,
Ardian, Axa Equity et homologues europeens). Le positionnement
commercial est Palantir vertical du capital risque, avec un tarif
cible 15 a 25 mille euros par mois et par fonds. La plateforme se
distingue des outils existants (Affinity, Carta, PitchBook, decks
manuels) par sa rigueur doctrinale et son refus de la complaisance.

Le produit livre une note d instruction de 4 a 8 pages pour chaque
dossier analyse, plus un dashboard analytique qui detaille chaque
moteur. La note se lit comme une dissertation Le Grand Continent,
pas comme un rapport SaaS.

## Architecture technique

Stack principale : Next.js 14 App Router, TypeScript, Tailwind, et
Supabase pour la persistence et l auth. Hebergement Vercel.

Le coeur du produit est un pipeline de moteurs d analyse
sequentiel et parallele dans `app/api/analyze/route.ts`. Chaque
moteur est un module dans `lib/engines/` qui implemente une these
analytique calibree sur la doctrine. Le pipeline orchestre quatorze
moteurs en early stage et neuf moteurs en growth, selon le track
choisi par le partner en page d entree.

Les sept patterns du moteur Fragilite structurelle (Phase 4) sont
dans `lib/engines/fragility-structurelle/`. Chaque pattern a sa
fiche doctrinale dans `docs/patterns/` qui sert de source de
verite pour le SYSTEM_PROMPT de l implementation TypeScript.

Le moteur Trajectoire (Score de Trajectoire) est dans
`lib/engines/trajectory/`. Il consomme deux ou plusieurs analyses
du meme dossier pour calculer les deltas de scores et les
combinaisons diagnostiques apparues, resolues, persistantes.

## Preferences personnelles de Steve

Steve communique en voix dictee mobile. Les transcriptions sont
souvent imprecises. Interprete l intention plutot que les mots
exacts. Si la transcription est incoherente avec le contexte,
signale-le et propose ta lecture la plus probable.

Voix editoriale Le Grand Continent ou The Atlantic dans tout ce
que tu produis : prose dense, phrases longues quand le sujet le
justifie, peu de listes a puces, peu de gras, peu de headers
decoratifs.

Pas d em-dashes (—) dans les textes que tu produis. Tirets simples
ou virgules a la place.

Pas de flatterie. Pas de Excellente question, pas de Tu as
raison de, pas de Tout a fait, pas de recap emerveille du
travail accompli.

Tu agis comme tech lead autonome. Tu executes les changements sans
demander de validation a chaque etape. Tu fais des commits propres
tagues (feat, fix, refactor, docs, test, chore). Les messages de
commit sont denses, prose en francais, expliquent le pourquoi et
la portee structurelle, pas juste le quoi.

Tu pushes directement sur GitHub. Tu ne lui envoies jamais de
blocs de code a appliquer manuellement. Si tu n as pas de token
configure, tu le demandes.

Tu ne proposes jamais d arreter une session ou de reporter le
travail. C est Steve qui decide quand on arrete. Tu continues ou
reprends quand il demande, sans suggerer de pause.

Quand Steve demande des modifications, elles doivent etre
structurelles (au niveau des moteurs, des prompts, des matrices
de configuration), pas cosmetiques (juste l affichage ou le
formatage). Un changement structurel beneficie a tout
l ecosysteme, pas seulement a un cas particulier. Toujours
privilegier la racine du probleme sur le symptome visible.

## Discipline tests et build

Avant chaque commit, lance tsc et la suite de tests. Ne commit
jamais avec des erreurs de typage ou des tests rouges. Les
commandes utiles :

```
npx tsc --noEmit
npx tsx lib/engines/<nom>.test.ts
```

La suite globale compte plus de 700 tests deterministes. Les
tests sont en TypeScript pur, executables avec tsx, sans framework
de tests externe (pas de Jest, pas de Vitest). Le pattern :
fonctions check et checkTrue qui incrementent des compteurs pass
et fail, plus un process.exit final.

Les tests qui necessitent un appel LLM reel (calibration des
patterns, tests E2E du pipeline) ne sont pas dans la suite
deterministe. Ils sont dans des scripts a lancer separement avec
ANTHROPIC_API_KEY configuree.

## Discipline de mesure

Une mesure de couverture qui trouve des trous se confirme en lisant la
structure, jamais en comptant des occurrences de texte.

La regle est nee de trois erreurs en une semaine, toutes de la meme
forme. Une mesure de la table de benchmarks par appel a
getSectorMultiples a conclu que la colonne series-c-plus etait vide sur
les vingt et une classes : elle mesurait en fait un normaliseur qui ne
lisait pas sa propre sortie, et la table etait complete. Une mesure de
couverture de baseExits par expression reguliere a conclu que trois
classes manquaient : la regex excluait les chiffres, et saas-b2b,
marketplace-b2c et services-b2b portent tous un chiffre dans leur nom.
Une mesure du nombre de sites portant une cause de non-production a
compte des occurrences de type et de commentaire avec les vrais sites.

Deux de ces trois erreurs ont fait ecrire un diagnostic faux dans un
brief avant d etre corrigees.

En pratique, quand une mesure conclut a une lacune, refaire la lecture
en interrogeant l objet et non son texte : parcourir les clefs de la
table plutot que grepper ses litteraux, appeler la fonction sur chaque
valeur du catalogue plutot que compter ses branches, lire le type
plutot que ses mentions. Le cout est de quelques lignes de script, et
il se paie une fois contre un diagnostic faux qui oriente un brief
entier.

Le corollaire vaut aussi : une mesure qui ne trouve aucun trou est
moins suspecte, mais elle merite la meme lecture structurelle quand
elle sert a affirmer qu un correctif couvre tout.

## Discipline de precision

Une precision non donnee ne doit pas produire une severite qu elle ne
fonde pas.

La regle est nee le 3 aout 2026 sur l ancre temporelle du module de
validite d operation, mais elle ne lui appartient pas. Un document qui
porte « 2023 » sans mois n autorise pas a le traiter comme s il datait
de janvier : le lire ainsi ferait declencher une reserve sur tout
evenement de l annee, alors que le document a pu etre ecrit en
decembre. L ancre se pose donc en fin d annee, et seul un evenement
clairement ulterieur declenche quelque chose.

Le principe se formule sans son cas : quand une donnee arrive moins
precise que le calcul qui la consomme, l arrondi se fait du cote qui
retient la conclusion, pas du cote qui la produit. Une date partielle
s arrondit vers le tard quand on cherche ce qui lui est posterieur, et
vers le tot quand on cherche ce qui lui est anterieur. Un montant sans
unite n est pas un montant. Un stade non revendique n est pas un stade
deduit du chiffre d affaires.

C est le pendant de la regle anti-divination, qui interdit d inventer
une valeur absente. Celle-ci interdit d inventer une precision absente,
ce qui est la meme faute a un cran de subtilite : la valeur est bien
la, mais on lui prete une finesse qu elle n a pas, et cette finesse
seule suffit a faire basculer une conclusion.

## Discipline de provenance

Une mention de provenance ne doit jamais etre la seule chose qui
distingue une decision d une panne. Si le lecteur en a besoin pour
savoir si l outil a decide, la decision n a pas ete ecrite.

La regle est nee le 3 aout 2026 sur la reserve de validite d operation,
et elle porte sur la place autant que sur le contenu. La mention etait
exacte, elle disait que la reserve reposait sur une lecture de prose et
non sur une donnee structuree. Placee en troisieme phrase d un
paragraphe qui refusait de discuter un prix, elle devenait un aveu de
faiblesse au milieu meme de la justification, et un partner y lisait un
echec la ou il fallait lire un arbitrage.

Ce qui fonde une affirmation se lit apres elle, ce qui la limite se lit
avec elle. La provenance fonde, elle ne limite pas, donc elle suit, en
retrait typographique. Rien n est cache, l ordre seul change, et
l ordre decide de ce que le lecteur comprend.

## Conventions de commit

Tag obligatoire en prefixe : feat / fix / refactor / docs / test /
chore. Le scope est utile mais optionnel : feat(orchestrator),
test(trajectory).

Le corps du message explique le pourquoi structurel, pas le quoi.
Pour les commits qui changent l architecture, decrire la motivation
et les implications pour la suite.

Pas d em-dashes dans les messages de commit. Voix editoriale meme
en commit.

## Etat actuel du projet (mai 2026)

Livre et en production :
- Pipeline early stage avec quatorze moteurs (extraction, equipe,
  marche, macro, pattern matching, retournement causal, aveuglement,
  contrarien, financier, tech claim, friction d execution, lecture
  du langage, fragilite structurelle, orchestration finale).
- Moteur Fragilite structurelle (Phase 4) avec sept patterns
  calibres en doctrine : Growth Subsidized Model, Infrastructure
  Hostage, Fixed Cost Trap, Regulatory Time Bomb, Commoditization
  Drift, Capital Structure Fragility, Scale Mirage Risk. Plus sept
  combinaisons diagnostiques cross-patterns (Trajectoire WeWork,
  Pattern Britishvolt, Pattern Northvolt, Wrapper sans
  differenciation, etc).
- Moteur Trajectoire (Score de Trajectoire) avec API et UI dans
  l onglet Decision du dashboard.
- Selecteur de parcours en page d entree : early stage versus
  growth. En growth, les moteurs Equipe, Pattern Matching,
  Aveuglement, Causal sont skip. Pipeline allege a neuf moteurs.

Reste a faire avant prod commerciale :
- Calibration LLM reelle des sept patterns Fragilite structurelle
  sur dossiers de reference (WeWork, Theranos, Casper, MoviePass,
  Atlassian, Stripe, Mistral, Northvolt, Ynsect, Klarna). Une demi-
  journee par pattern. Necessite cle API. C est l item numero un.
- Tests E2E du pipeline en conditions reelles avec PDF reels.
- Adaptation de la note d instruction et du dashboard pour le
  parcours growth (cacher les sections moteurs skipped, mettre
  Fragilite structurelle et Trajectoire en couverture).

Reste a faire en optimisation :
- Persistence dediee snapshots Trajectoire en table Supabase
  separee (actuellement on agrege sur les versions existantes).
- Refactor des deux gros fichiers d interface, a egalite et non plus
  un seul : app/HomeClient.tsx (7015 lignes) et
  app/components/InvestmentNoteView.tsx (7008 lignes), a decouper en
  sous-composants. Le second est le fichier le plus souvent touche du
  depot, puisque toute evolution de la note d instruction y passe.
  Mesure au 2 aout 2026.
- Narrative Drift V2 (ingestion communications externes pour
  activer le sous-module KPI_EXTINCTION).

## Commandes utiles

```
# Build local
npm run build

# Lancer le serveur dev
npm run dev

# Type check
npx tsc --noEmit

# Lancer un test specifique
npx tsx lib/engines/<nom>.test.ts

# Lancer toute la suite tests deterministes (a configurer si pas
# encore fait : un script run-all-tests.sh qui boucle sur les
# fichiers .test.ts)

# Voir les commits recents
git log --oneline -20

# Voir l etat
git status
```

## Variables d environnement

Pour faire tourner le pipeline en local avec appels LLM reels, il
faut au minimum :
- ANTHROPIC_API_KEY pour les appels Claude
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY pour la persistence
- ENABLE_AUTH (true ou false) pour activer ou non le flow auth

Le fichier .env.local ne doit jamais etre commit. Le repo a un
.env.example qui liste les variables attendues.

## Hierarchie d urgence pour cette session

Si Steve demande quoi faire en priorite, l ordre est :
1. Calibration LLM des sept patterns Fragilite structurelle
2. Tests E2E pipeline sur dossier reel
3. Adaptation note et dashboard pour parcours growth
4. Refactor HomeClient.tsx et InvestmentNoteView.tsx
5. Narrative Drift V2
6. Persistence dediee snapshots Trajectoire

Ne propose jamais cette liste de but en blanc. Steve la connait.
Reagis a ce qu il demande, et trace.
