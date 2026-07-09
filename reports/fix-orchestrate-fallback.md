# Refonte du fallback orchestrate : trois briques pour arreter de perdre 16 moteurs sur un 529

Rapport de la refonte livree en trois commits sur `main` : `6c82f95`,
`32f2898`, `a579309`. Objet : arreter que le pipeline affiche un
score global 0 et un verdict "A Reinstruire" fabrique de toutes
pieces quand le moteur d orchestration LLM final echoue sur une
surcharge Anthropic 529, alors que les 16 moteurs Bloc 1 ont
parfaitement abouti et que le score mecanique est deja calcule.

## Preuve empirique et diagnostic

Constat prod du 8 juillet 2026 au soir. Un dossier tourne, les
17 moteurs Bloc 1 (14 en early stage plus les 3 d instrumentation
sectorielle et de conflit) resolvent tous sans incident. La
convergence Promise.all est propre. Le mechanicalScore est
calcule ligne 1223 de `app/api/analyze/route.ts` a partir des
six dimensions (team, market, macro, financial, contrarian,
vigilance) et produit un globalScore numerique et un verdict
derive selon les seuils. Puis orchestrate LLM final se prend un
529 Anthropic, epuise ses deux tentatives separees par un backoff
de 2s, le fallback degrade prend la main. UI affiche : verdict
"A Reinstruire", score 0.

Diagnostic detaille dans la conversation. Chaine du bug prouvee
ligne par ligne :

  1. Fallback degrade route.ts:1308-1320 : injecte hard `verdict
     = 'A reinstruire'` et `globalScore = null`, **ignore le
     mechanicalScore disponible dans la closure**.
  2. Ce fallback devient `result.finalRecommendation`.
  3. `result` top-level ne contient pas `mechanicalScore` : grep
     "mechanicalScore" sur les lignes 1294-1399 du result = zero
     hit en top-level.
  4. `extractAnalysisMetadata` (analysis-store.ts:252-261) lit
     exclusivement `result.finalRecommendation.verdict` et
     `.globalScore`. Aucune source de fallback.
  5. `markAnalysisCompleted` persiste `verdict='A reinstruire'`
     et `global_score=null`.
  6. UI rend `null` comme `0` sur l affichage numerique et
     affiche le verdict fabrique.

La doctrine de code, exprimee ligne 1219-1221 du meme fichier,
est pourtant explicite :

> Score mecanique calcule a partir des moteurs Bloc 1. **Source
> de verite pour le score global et le verdict, qui ne sont plus
> produits par l orchestrator LLM.**

Le fallback ne respecte pas la doctrine. C est la faille corrigee.

Sur la politique de retry : ancien code faisait `maxRetries = 1`
avec backoff `attempt === 0 ? 2000 : 5000`. En pratique, le
5000ms n etait jamais atteint car `attempt < maxRetries` est faux
au dernier tour. Deux tentatives separees par 2s. Un 529
Anthropic exige typiquement 5 a 30 secondes de patience. Deux
essais a 2s c est du retry cosmetique.

Taille du prompt orchestrate n est **pas** en cause. Comparaison
mesuree :

  - orchestrator SYSTEM_PROMPT : 17 923 chars
  - team SYSTEM_PROMPT         : 37 274 chars
  - market SYSTEM_PROMPT       : 36 225 chars
  - macro SYSTEM_PROMPT        : 21 207 chars
  - blindspot SYSTEM_PROMPT    : 18 260 chars
  - contrarian SYSTEM_PROMPT   : 24 485 chars

Orchestrator a **le plus petit** system prompt des sept moteurs
Sonnet. UserPrompt estime a 10-15k chars une fois toutes les
syntheses agregees et tronquees a 500 chars. Total input ~7-8k
tokens, moitie moins que team-engine. Le 529 est un signal de
surcharge Anthropic globale, pas un probleme de poids de prompt.

## Trois briques

Le fix couvre trois defauts distincts. Un seul ne suffit pas :

| Brique | Defaut corrige | Commit |
|---|---|---|
| 1 | Fallback degrade fabrique un verdict hors doctrine et perd le score mecanique | `6c82f95` |
| 2 | mechanicalScore n existe pas en top-level du result, extractAnalysisMetadata ne peut pas le retrouver | `32f2898` |
| 3 | Retry 529 sous-dimensionne : 2 tentatives, 2s de backoff, cible sur toute erreur | `a579309` |

## Brique 1 : fallback conforme a la doctrine

Commit `6c82f95`.

`app/api/analyze/route.ts` fallback ligne 1308-1320 :
  - Injecte `verdict: mechanicalScore.verdict` au lieu de
    `'A reinstruire'` (valeur inventee, hors des quatre verdicts
    canoniques de Verdict type : investir / investir avec
    conditions / approfondir / refuser).
  - Injecte `globalScore: mechanicalScore.globalScore` au lieu
    de `null`.
  - Argumentation reformulee : explique explicitement que le
    score est mecanique, opposable, calcule sur 16 moteurs, et
    que ce qui manque c est la mise en recit LLM. Suggere de
    relancer pour completer la narration.
  - `logException` enrichi avec `mechanicalScore` et
    `mechanicalVerdict` capture au moment du fallback, utile
    post-mortem pour verifier quels scores auraient du s afficher.
  - Flag `degraded: true` conserve : signal a l UI qu il manque
    la mise en recit, sans salir le score.

`app/components/pipeline-toile-renderers/orchestrator-renderer.tsx`
banner degrade ligne 54-69 :
  - Titre change : "Mode degrade" devient "Synthese narrative
    indisponible".
  - Texte reformule : score et verdict ne sont plus "indicatifs",
    ils sont "veridiques et opposables". Ce qui manque, c est la
    mise en recit du retournement causal, la resolution
    dialectique blindspots / contrarien, les decision drivers et
    le plan de chantiers. Suggere de relancer.
  - Cause technique reste affichee en italique pour l analyste
    qui veut savoir si le probleme etait 529, timeout ou autre.

## Brique 2 : mechanicalScore top-level du result

Commit `32f2898`.

`app/api/analyze/route.ts` result object ligne 1447 et suivantes :
  - Ajoute `mechanicalScore` comme champ top-level du result.
  - Le `resultJson` persiste desormais `dimensions`, `formula`,
    `thresholds`, `archetype`, `divergenceThreshold`, `globalScore`,
    `verdict` tels que calcules par `computeMechanicalScore`.
  - Disponible pour re-hydratation cote client, dashboard
    analytique, calibration retrospective, tout consumer downstream
    qui voudra afficher le detail par dimension.

`lib/analysis-store.ts` `extractAnalysisMetadata` ligne 242-289 :
  - Lit desormais `result.mechanicalScore` comme source de
    fallback.
  - Ordre de preference verdict : `reco.verdict > reco.recommendation
    > mech.verdict > 'approfondir'`.
  - Ordre de preference globalScore : `reco.globalScore >
    reco.confidence > mech.globalScore > null`.
  - Ce fallback couvre le cas des runs persistes avant brique 1
    dont le finalRecommendation aurait `globalScore=null verdict
    'A reinstruire'`. Un refresh via `getAnalysis` recupere
    maintenant le vrai verdict via le mechanicalScore embarque
    dans le resultJson.
  - Effet de bord positif : tout appelant qui persiste un result
    sans passer par la route analyze (backfill, re-run offline)
    beneficie du meme fallback si finalRecommendation est incomplet.

## Brique 3 : retry 529 refondu

Commit `a579309`.

`app/api/analyze/route.ts` retry loop d orchestrate ligne 1270-1330 :

Politique retenue, avec constantes explicites en tete de fonction :

  ```
  MAX_ATTEMPTS = 3
  RETRY_BACKOFFS_MS = [5_000, 15_000, 30_000]
  JITTER_RATIO = 0.25
  ORCHESTRATE_ATTEMPT_ESTIMATE_MS = 60_000
  EXIT_MARGIN_MS = 30_000
  ```

Trois helpers internes :

  - `isRetryableAnthropicOverload(err)` : detecte les codes 529 /
    429, ou les messages contenant `overloaded_error` /
    `rate_limit_error` / `rate_limit_exceeded` / `529` / `overloaded`.
    Toute autre erreur (400 payload, 401 auth, 500 bug moteur,
    timeout SDK 60s) retourne false et provoque un abandon
    immediat sans backoff.
  - `computeBackoffMs(attemptIndex)` : lit RETRY_BACKOFFS_MS et
    applique un jitter uniforme +/- 25%. Min 1000ms de safety
    pour eviter un backoff nul en cas de jitter negatif extreme.
  - `budgetRemainingMs()` : `RUN_BUDGET_MS - (Date.now() - startTime)`,
    pour verifier avant chaque backoff qu on a la place de faire
    la prochaine tentative sans depasser le mur Vercel.

Sequence type sur un 529 durable :
  - attempt 0 : appel Anthropic, 529.
    check retryable=true, remaining OK.
    backoff ~5s (avec jitter +/- 1.25s).
  - attempt 1 : appel Anthropic, 529.
    check retryable=true, remaining OK.
    backoff ~15s (avec jitter +/- 3.75s).
  - attempt 2 : appel Anthropic, 529.
    Derniere tentative, pas de backoff, sortie de loop.
  - fallback conforme (brique 1) injecte mechanicalScore,
    logException instrumente.

Sequence type sur budget epuise :
  - attempt 0 : 529.
    check retryable=true.
    remaining = 40s. needed = 5s + 60s + 30s = 95s.
    95 > 40 -> abandon immediat.
  - fallback conforme.

Sequence type sur erreur non retryable (400 payload) :
  - attempt 0 : 400.
    check retryable=false.
    abandon immediat sans backoff.
  - fallback conforme.

Instrumentation :
  - `console.warn` a chaque tentative avec le flag `retryable` et
    la duree du backoff choisi, pour reconstitution en logs Vercel.
  - `logException` au fallback enrichi de `MAX_ATTEMPTS`,
    `retryable` sur la derniere erreur, `budgetRemainingMs` a la
    sortie de loop, `mechanicalScore` et `mechanicalVerdict` qui
    seront persistes.

## Verification et discipline tests

  - `npx tsc --noEmit` : silencieux apres chaque brique.
  - `npx tsx lib/engines/pipeline-topology.test.ts` : 15 pass / 0
    fail apres chaque brique.
  - `npx tsx lib/engines/orchestrator-phase4.test.ts` : 32/32 apres
    chaque brique.
  - `npx tsx lib/engines/anthropic-client.test.ts` : 7/7 apres
    chaque brique.
  - `npm run build` : succes apres chaque brique.

Aucun test deterministe existant ne teste explicitement le
fallback degrade ou l extraction de metadonnees en cas d absence
de finalRecommendation.globalScore. La regression avait donc pu
passer inapercue en CI. A ajouter dans un commit ulterieur : test
unitaire de `extractAnalysisMetadata` avec un `result` dont
`finalRecommendation.globalScore = null` et `mechanicalScore.globalScore
= 62`, verifiant que la sortie contient `globalScore: 62`.

## Verification post-deploy

Une fois Vercel deploye, verifier sur un vrai run que orchestrate
qui echoue produit maintenant une note utile :

### 1. Run nominal aboutit avec score reel

Ouvrir un dossier standard, laisser le pipeline finir. Le
resultJson en base doit contenir `mechanicalScore` en top-level
avec `globalScore` numerique, `verdict` canonique, `dimensions`
complete, `formula` lisible, `archetype` renseigne.

Requete SQL :

  ```sql
  select
    id,
    verdict,
    global_score,
    result_json->'mechanicalScore'->>'globalScore' as mech_score,
    result_json->'mechanicalScore'->>'verdict' as mech_verdict,
    result_json->'finalRecommendation'->>'degraded' as degraded
  from analyses
  where status = 'completed'
  order by created_at desc
  limit 10;
  ```

Sur les runs post-deploy, `mech_score` et `mech_verdict` doivent
etre renseignes, `degraded` doit etre `null` ou `false` sur les
runs nominaux.

### 2. Run avec orchestrate en echec produit une note valide

Impossible a declencher artificiellement en production sans
saboter Anthropic. En cas d incident reel, la signature attendue :

  - `analyses.status = 'completed'` (pas failed).
  - `analyses.global_score` numerique (le score mecanique).
  - `analyses.verdict` in ('investir', 'investir avec conditions',
    'approfondir', 'refuser'). Plus jamais 'A reinstruire'.
  - `result_json->'finalRecommendation'->>'degraded' = 'true'`.
  - `result_json->'finalRecommendation'->>'degradedReason'` renseigne
    avec la cause technique.
  - `result_json->'mechanicalScore'` complet.
  - Entry dans `error_logs` avec `source='pipeline.orchestrate'`,
    `severity='error'`, `context.mechanicalScore` renseigne pour
    audit post-mortem.
  - UI affiche le bandeau "Synthese narrative indisponible" avec
    la reformulation.

### 3. Anciens runs "A Reinstruire" recuperables

Les runs persistes AVANT brique 1 qui contiennent `verdict='A
reinstruire'` et `global_score=null` mais dont le `resultJson` a
un `mechanicalScore` (si le run avait aussi la brique 2 partielle)
ne sont pas automatiquement corriges en base. `extractAnalysisMetadata`
avec fallback est utilise uniquement au moment de la persistance,
pas au re-affichage. Un backfill SQL une fois est envisageable :

  ```sql
  update analyses
  set
    verdict = coalesce(
      nullif(result_json->'mechanicalScore'->>'verdict', ''),
      'approfondir'
    ),
    global_score = (result_json->'mechanicalScore'->>'globalScore')::int
  where verdict = 'A reinstruire'
    and result_json->'mechanicalScore'->>'globalScore' is not null;
  ```

A executer en une passe si tu constates que des dossiers historiques
etaient marques "A Reinstruire" alors que leur mechanicalScore etait
disponible dans le resultJson.

## Ce qui reste ouvert

  - Test unitaire deterministe de `extractAnalysisMetadata` avec
    un `result` degrade. A ecrire pour eviter toute regression sur
    la priorite mechanicalScore.
  - Idem pour la politique de retry : simuler une sequence 529 x3
    et verifier que le fallback conforme injecte les bonnes
    valeurs et que le budget bornant fonctionne. Necessite un
    mock du client Anthropic, ce que la suite deterministe ne
    fait pas aujourd hui.
  - Le message d argumentation du fallback est fige en francais.
    Si Prelude doit un jour servir des fonds anglophones, il
    faudra i18n. Hors scope actuel.
  - Le seuil `EXIT_MARGIN_MS = 30_000` est une estimation. A
    calibrer sur donnees prod : combien de temps prennent
    reellement `markAnalysisCompleted`, `insertPredictionRecord`,
    `dispatchSlackNotifications` et le `controller.close()` ?
