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
- Refactor de app/HomeClient.tsx (6000 lignes, decouper en
  sous-composants).
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
4. Refactor HomeClient.tsx
5. Narrative Drift V2
6. Persistence dediee snapshots Trajectoire

Ne propose jamais cette liste de but en blanc. Steve la connait.
Reagis a ce qu il demande, et trace.
