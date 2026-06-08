# Brique 3 ingestion corpus, rapport de fondation

Date : 2026-06-08

## Resume

La passe ce soir prepare l infrastructure complete d ingestion du
corpus Jabrilia. Les decks arrivent demain dans ~/jabrilia-corpus,
aucun run n a tourne pour de vrai. Cinq sous-systemes livres et
testes en local, build vert, prets a etre actives quand les decks
seront la et que la migration aura ete appliquee en prod via
scripts/apply-migration.ts.

## Ce qui est en place

### 1. Migration reference_dossiers et provenance corpus

Fichier supabase-reference-dossiers-schema.sql, non applique en
prod ce soir. Trois operations groupees dans la meme migration
parce qu elles forment une livraison coherente :

- ALTER TABLE public.analyses ADD COLUMN as_of DATE, frozen BOOLEAN
  NOT NULL DEFAULT false. Provenance corpus, lisible en SQL sans
  rejoindre prediction_records. Le defaut frozen=false ne touche
  pas le flux courant.
- ALTER TABLE public.analysis_outcomes ADD COLUMN multiple_at_exit
  NUMERIC, irr NUMERIC. Elargit l outcome au-dela du qualitatif
  sans casser l unicite UNIQUE(analysis_id) deja en place.
- CREATE TABLE public.reference_dossiers, idempotente par
  UNIQUE(analysis_id) et UNIQUE(source_pdf_filename). Couche
  humaine ex-post : partner_verdict, partner_reasoning,
  decision_motifs en text array valide applicativement,
  post_investment_deviations, ingestion_status sous CHECK
  constraint a quatre etats. RLS lecture authenticated + ecriture
  service_role.

L outcome de marche n est PAS dans reference_dossiers, il reste
dans analysis_outcomes. Les deux se rejoignent par jointure sur
analysis_id quand on calibre.

### 2. Mode frozen traversant et version stamp

Le flag frozen rentre dans le fingerprint via runMode dans
version-stamp. configs.runMode hash { frozen } et entre dans
configsHash via fingerprintStamp. Un re-run frozen sur un deck
identique a un run live produit donc un configsHash distinct, ce
qui garantit l etancheite du segment corpus en calibration.

asOf reste provenance pure : top-level dans le stamp et colonne
sur analyses, mais hors du hash. Deux re-runs frozen pris a des
dates differentes du meme deck restent dans le meme segment de
calibration.

Le flag traverse :

- app/api/analyze/route.ts (lecture body.frozen, body.asOf),
- lib/analysis-store.ts createPendingAnalysis (colonnes
  analyses.frozen et analyses.as_of),
- lib/instrumentation/version-stamp.ts (runMode top-level plus
  configs.runMode pour le hash),
- lib/engines/anthropic-client.ts (helper applyRunOptions qui
  force enableWebSearch:false quand frozen=true, surpassant
  ENABLE_WEB_SEARCH),
- les quatre moteurs concernes (team-engine, market-engine,
  macro-engine, financial-coherence-engine) recoivent un nouvel
  argument runOptions et propagent au callClaude.

### 3. Store reference-dossiers

lib/reference-dossiers-store.ts. CRUD complet plus
findReferenceDossierForIngestion qui sert d helper d idempotence
au script d ingestion (verifie source_pdf_filename OU
company_name avant insert).

Le vocabulaire (DECISION_MOTIFS, INGESTION_STATUS_VALUES,
validateDecisionMotifs) est extrait en sous-module
lib/reference-dossiers-vocabulary.ts sans la directive
server-only, ce qui le rend importable depuis tsx en CLI et
testable directement.

### 4. Scripts

Trois scripts dans scripts/ :

- ingest-jabrilia-corpus.ts : --dry-run par defaut, --apply
  explicite, chemin par defaut ~/jabrilia-corpus, override
  positionnel. Idempotent par lookup reference_dossiers avant
  toute action. Sur apply : upload Storage, POST sur
  ${BASE_URL}/api/analyze avec frozen=true et asOf, parse le
  stream SSE jusqu a l event complete, recupere l analysis_id et
  cree la ligne reference_dossiers en statut
  human_layer_pending. Le serveur dev doit tourner. BASE_URL
  configurable via env var (defaut http://localhost:3000).
- set-corpus-outcome.ts : --company --outcome
  (exit/fail/flat/alive) [--multiple N] [--irr N]
  [--observed-at YYYY-MM-DD] [--notes "..."]. Resout company vers
  analysis_id via reference_dossiers, upsert dans
  analysis_outcomes.
- set-corpus-verdict.ts : --company --verdict --reasoning
  --motifs csv --deviations. Valide la liste des motifs contre
  le vocabulaire controle, rejette tout l ecriture si un motif
  inconnu est present (pas d ecriture silencieuse de fautes de
  frappe). Patch reference_dossiers, passe le statut a complete.

Le script d ingestion extrait ses helpers purs dans
scripts/ingest-helpers.ts (parseCliArgs, deriveCompanyName,
discoverPdfs) pour permettre le test deterministe.

### 5. Tests deterministes

Quatre nouvelles suites, 93 tests verts au total.

- lib/instrumentation/version-stamp.test.ts etendu de 12 tests
  sur runMode : frozen change configsHash, asOf seul ne change
  pas configsHash, runMode top-level reflete les inputs, frozen
  force webSearchEnabled=false meme avec
  ENABLE_WEB_SEARCH=true.
- lib/reference-dossiers-store.test.ts (22 tests) : presence
  des six motifs et quatre statuts, validation des motifs,
  rejet des motifs inconnus, dedup, trim.
- lib/engines/anthropic-client.test.ts (7 tests) :
  applyRunOptions defaut identite, frozen=true force
  enableWebSearch=false, ecrase enableWebSearch=true
  preexistant, idempotent.
- scripts/ingest-helpers.test.ts (21 tests) : parseCliArgs
  defaut applyMode=false (garde-fou structurel du dry-run par
  defaut), deriveCompanyName sur cinq cas typiques,
  discoverPdfs sur dossier inexistant, fichier au lieu d un
  dossier, listing filtre .pdf et tri stable, dry-run ne
  modifie pas le filesystem.

Tests de non-regression : prediction-records-store (13 pass),
financial-coherence-archetype (44 pass), archetype-selector
(201 pass), orchestrator-phase4 (32 pass). Tous verts.

tsc --noEmit propre. npm run build propre.

## Etapes restantes avant exploitation

1. Appliquer la migration en prod via apply-migration.ts demain.
   Necessite que SUPABASE_PAT soit injecte dans .env.local (cf
   setkey-supabase-pat.ts) :
   `npx tsx scripts/apply-migration.ts supabase-reference-dossiers-schema.sql`

2. Placer les decks dans ~/jabrilia-corpus/.

3. Lancer npm run dev (le script ingest poste sur
   localhost:3000/api/analyze).

4. Dry-run pour valider la decouverte :
   `npx tsx --env-file=.env.local scripts/ingest-jabrilia-corpus.ts`

5. Apply pour declencher les runs frozen :
   `npx tsx --env-file=.env.local scripts/ingest-jabrilia-corpus.ts --apply`

6. Saisie progressive par dossier :
   ```
   npx tsx --env-file=.env.local scripts/set-corpus-outcome.ts \
     --company "WeWork" --outcome fail --multiple 0.1 --irr -0.45
   npx tsx --env-file=.env.local scripts/set-corpus-verdict.ts \
     --company "WeWork" \
     --verdict "refuser" \
     --reasoning "Modele growth-subsidized incompatible doctrine." \
     --motifs unit_economics,signal_contrarien \
     --deviations "Sortie chaotique 2024."
   ```

## Notes de doctrine

L outcome de marche vit dans analysis_outcomes et nulle part
ailleurs. Toute lecture combinee (couche humaine plus outcome)
se fait par jointure sur analysis_id. Pas de duplication
silencieuse.

Le segment corpus est etanche au niveau du fingerprint via
runMode.frozen. Sans cela, la calibration agregerait des
predictions live et corpus, ce qui melangerait des distributions
hetorogenes. La separation est imposee par construction, pas par
discipline operationnelle.

asOf est provenance, pas contrainte. Le mode frozen empeche les
fuites par web search ; aucune contrainte historique n est
imposee a l API LLM. Si demain le moteur extraction passait sur
un modele plus recent qui connait l outcome de WeWork, frozen ne
suffirait pas seul et il faudrait aussi un nouveau commitSha
dans le fingerprint (ce que la version-stamp capture
automatiquement). La doctrine reste : un dossier corpus se
calibre dans son segment, pas dans le bassin global.

La taxonomie des motifs est validee applicativement, pas en SQL.
Trois consequences : extension du vocabulaire sans migration,
historique interpretable apres reduction (les motifs retires du
vocabulaire restent lisibles avec un warning), validation
testable de bout en bout sans toucher a la base.
