# Refonte des gardes de temps du pipeline /api/analyze

Rapport de la refonte livree en trois commits sur `main` les
09fc736, 66f8235 et 5aee1b9. Objet : traiter la cause racine des
`Vercel Runtime Timeout Error` observes en production sur les runs
Food Pilot du 7 juillet 2026 et sur les deux runs successifs
bfbd392f et 24f3cc03 du 8 juillet.

## Preuve empirique et cause racine

Les logs Vercel du run Food Pilot du 7 juillet montrent la
signature suivante sur les appels `api.anthropic.com` :

  - Un premier bloc de reprises en cascade `11.9s x3`.
  - Un second bloc `61s x3`.
  - Run tue au bout d environ 8 minutes.

Cette signature `x3` est exactement celle du default du SDK
Anthropic : `maxRetries: 2` cote client (soit trois tentatives
totales) avec un timeout applicatif implicite autour de 60s par
appel. Cumule sur six moteurs de la couche 1 qui timeoutent en
meme temps sur un incident Anthropic, la convergence de
`Promise.all` attend `max(3 x 61s) = 183s` au lieu des 60s
nominaux. Trois vagues du pipeline empilees et on est deja a
540s. Le retry loop d orchestrate en surcouche (3 tentatives
avec backoff 2s puis 5s) multiplie encore la charge, jusqu au
mur Vercel `maxDuration = 800s` qui tue tout en un
`Runtime Timeout Error` opaque sans stack ni fichier.

Le web_search actif avec `max_uses: 3` amplifiait la latence de
chaque appel Anthropic : Anthropic tapait OpenAlex, GitHub,
Banque mondiale, FMI en cascade cote serveur, chaque upstream
lent allongeait la latence effective de l appel Anthropic
_avant_ meme que le SDK considere le timeout.

Cause univoque, en trois strates :
  1. Aucun plafond sur les reprises SDK Anthropic.
  2. Aucune deadline par moteur cote route.
  3. Aucun budget de temps global au run.

Un seul appel qui coince pouvait donc consommer jusqu a 30 minutes
de wall-clock (trois tentatives x timeout 600s du SDK), bien
au-dela des 800s de Vercel. La ligne `analyses` restait bloquee
en `status='running'` sans jamais basculer en `failed` puisque
`markAnalysisFailed` n avait pas le temps de tourner avant le kill.

## Trois seuils, cumules du plus fin au plus large

Les trois axes de la refonte se composent en profondeur.

| Garde | Constante | Valeur | Emplacement | Commit |
|---|---|---|---|---|
| SDK Anthropic par appel | `timeout` / `maxRetries` | `60_000` ms / `0` | `lib/engines/anthropic-client.ts` | 09fc736 |
| Retry controle orchestrate | boucle `for` | 2 tentatives max (`maxRetries = 1`) | `app/api/analyze/route.ts` | 09fc736 |
| Deadline par moteur | `ENGINE_DEADLINE_MS` | `120_000` ms | `app/api/analyze/route.ts` | 66f8235 |
| Budget global du run | `RUN_BUDGET_MS` | `600_000` ms | `app/api/analyze/route.ts` | 66f8235 |
| `max_uses` web_search analyze | `maxWebSearches` | `1` | `lib/engines/team|market|macro|financial-coherence-engine.ts` | 5aee1b9 |

Le mur Vercel `maxDuration = 800s` reste au bout, non modifie. La
marge de `200s = 800 - 600` est le budget alloue a la sortie propre
apres bascule sur budget epuise : `markAnalysisFailed` lisible,
event SSE dedie, close du stream, liberation du slot rate-limit.

## Axis 1 : SDK 60s + maxRetries 0 + orchestrate ramene a 2 tentatives

Commit `09fc736`.

`lib/engines/anthropic-client.ts` instanciait le client avec les
seuls apiKey. Le SDK appliquait alors ses defaults `timeout = 10 min`
et `maxRetries = 2`. Un seul appel Claude qui coincait pouvait donc
consommer jusqu a 30 minutes de wall-clock, ce qui est plus que le
mur Vercel `maxDuration = 800s`. La reprise silencieuse etait
invisible cote metier, et depensait des tokens sur une base
Anthropic deja en incident.

La fonction `getClient` passe desormais explicitement :

    _client = new Anthropic({
      apiKey,
      timeout: 60_000,
      maxRetries: 0,
    });

Un depassement 60s sur un appel individuel est un signal
d incident. On abandonne au lieu de persister. La seule
redondance conservee dans le pipeline est le retry loop explicite
d orchestrate, ramene de 3 a 2 tentatives (`maxRetries = 1` dans
la boucle `for` de `app/api/analyze/route.ts`) pour ne plus
ampiler la latence.

## Axis 2 : deadline 120s par moteur et budget 600s par run

Commit `66f8235`.

Deux gardes ajoutees dans `app/api/analyze/route.ts`, l une au
niveau de chaque moteur, l autre au niveau du run entier.

**`ENGINE_DEADLINE_MS = 120_000`** avec le wrapper
`withEngineDeadline` qui enveloppe chacune des 17 promesses du
`Promise.all` central. Au trigger, il :

  - Loggue `deadline-exceeded` dans `error_logs` avec le nom du
    moteur, la deadline en ms, et un contexte engine + phase.
  - Emet `sendDone(engine, null)` au client pour maintenir
    `Promise.all` vivant et signaler au client que ce moteur
    specifique a echoue proprement.
  - Resoud la promesse sur `null`. Les autres moteurs continuent
    leur execution. Downstream (`orchestrator`, `mechanical-score`,
    `valuation`, `indicators`) accepte deja le `null` pour les
    moteurs conditionnels et retombera dans son fallback degrade
    pour les moteurs critiques.

`sendDone` devient idempotent via un `Set<string>` : la promesse
sous-jacente peut resoudre plus tard avec le vrai output, un second
appel a `sendDone` est alors silencieusement ignore. `send` devient
safe contre le `controller` deja ferme.

Orchestrate n est pas wrappe : sa boucle de retry propre absorbe
les 529 transitoires Anthropic sur ce moteur seul, et sa marge
theorique (`2 x 60s + backoff 2s = 122s`) sort tout juste de la
deadline uniforme, mieux vaut lui laisser sa logique propre. Le
budget global couvre son cas.

**`RUN_BUDGET_MS = 600_000`** avec un `AbortController` arme des
l entree du stream. Un `budgetPromise` rejette a l abort avec le
message tag `PIPELINE_BUDGET_EXHAUSTED:<ms>`. Ce tag est
reconnu par le catch general du stream qui :

  - Loggue via `logException('api.analyze.pipeline', ..., { context: { budgetExhausted: true, enginesCompleted: [...] }})`.
  - Construit un `userMessage` lisible listant les moteurs qui
    ont eu le temps d aboutir via `engineDurations`, et signalant
    ceux qui n ont pas resolu. Message final horodate.
  - Emet un event SSE dedie `run-budget-exhausted` avec
    `enginesCompleted[]` et `enginesCompletedCount` pour que le
    client puisse afficher une note partielle plutot qu une
    banniere d erreur brute.
  - Ecrit `markAnalysisFailed(analysisId, userMessage)` avec le
    message construit. La ligne `analyses` bascule en `failed`
    avec l explication complete, plus jamais de ligne `running`
    fantome apres un timeout.

Le `budgetTimer` est desarme dans le `finally` du stream pour ne
pas fire en arriere-plan et polluer un run suivant sur le meme
worker Vercel.

Le `Promise.race([Promise.all([...]), budgetPromise])` central
couvre la convergence des 17 moteurs. Un second race protege
`orchestratePromise` pour couper court si son retry cumul avec
un incident Anthropic prolonge saturait le budget residuel.

## Axis 3 : max_uses reduit a 1 sur les moteurs analyze

Commit `5aee1b9`.

Reduction du multiplicateur de latence : chaque hop `web_search`
enchaine des upstreams externes cote serveur Anthropic. Multi-hop
= temps par appel x nombre de hops en cascade. Avec un budget
moteur de 120s, un multi-hop TAM + concurrents + dynamique
pouvait a lui seul saturer la deadline sur un upstream degrade.

`maxWebSearches` passe de valeurs 2/3/4 a `1` sur les quatre
moteurs LLM du chemin critique :

  - `team-engine.ts` : 4 -> 1
  - `market-engine.ts` : 4 -> 1
  - `macro-engine.ts` : 2 -> 1
  - `financial-coherence-engine.ts` : 3 -> 1

Les moteurs sectoriels du cron (`sectoral-intelligence/regenerator.ts`
avec 4 et `cron/milestone-detection-runner.ts` avec 5) ne sont pas
touches : ils tournent hors chemin critique utilisateur, en
background, et beneficient reellement du multi-hop pour croiser
plusieurs sources en produisant leurs fiches sectorielles agregees.

Rationale de la reduction sans perte de qualite : les benchmarks
sectoriels de cadrage sont deja injectes dans les prompts des
moteurs Bloc 1 via `sectoralContext` et `relevanceMatrix`. Un
hop unique de verification sur un signal ponctuel suffit,
l essentiel du corpus est deja pre-charge en input.

## Verification et discipline tests

  - `npx tsc --noEmit` : silencieux apres chaque axis, pas
    d erreur de typage.
  - `npx tsx lib/engines/pipeline-topology.test.ts` : 15 pass /
    0 fail apres axis 1 et axis 2.
  - `npx tsx lib/engines/orchestrator-phase4.test.ts` : 32/32
    apres axis 2.
  - `npx tsx lib/engines/anthropic-client.test.ts` : 7/7 apres
    chaque axis.
  - `npm run build` : succes apres chaque axis.

Les tests deterministes ne cassent pas parce que la nouvelle
architecture preserve la topologie du pipeline (Promise.all
central, engines dep-driven) et se contente d ajouter des
enveloppes sans changer la semantique des promesses reussies.
La seule difference observable est qu une promesse qui devrait
resoudre en plus de 120s ou qu un run qui devrait durer plus de
600s bascule desormais sur un chemin degrade propre.

## Verification post-deploy

Une fois le build Vercel deploye, deux verifications a executer :

### 1. Run nominal aboutit toujours a une note complete

Uploader un dossier de reference (par exemple un des dossiers
Jabrilia deja calibres). Le run devrait :

  - Emettre `analysis-created` puis `files-received`.
  - Emettre `engine-start` puis `engine-done` pour chacun des 17
    moteurs (14 en early stage, 9 en growth).
  - Emettre `complete` avec le payload complet.
  - Persister en `status='completed'` avec le `result_json`
    complet et le verdict rempli.
  - Duree totale attendue : 90 a 180s comme mesure historique.

### 2. Run qui depasse le budget produit une note partielle

Impossible a declencher artificiellement en production sans
saboter Anthropic. En cas d incident reel qui se produirait, les
signaux a verifier dans les logs Vercel et Supabase :

  - Event SSE `run-budget-exhausted` recu par le client avec
    `enginesCompleted[]` et `enginesCompletedCount`.
  - Ligne `analyses` en `status='failed'` avec `error_message`
    lisible qui commence par `Budget de temps du run epuise
    (600s) a <iso>. N moteur(s) abouti(s) : <liste>. Les moteurs
    restants n ont pas eu le temps de resoudre. Relance le
    dossier pour obtenir une note complete.`
  - Entree dans `error_logs` avec `source = api.analyze.pipeline`,
    `severity = error`, `context.budgetExhausted = true`,
    `context.enginesCompleted = [...]`.

Requetes SQL de verification :

    -- Analyses en statut failed avec message de budget epuise
    select id, error_message, updated_at
    from analyses
    where status = 'failed'
      and error_message like 'Budget de temps du run epuise%'
    order by updated_at desc
    limit 20;

    -- Absence de ligne running fantome au-dela de 15 minutes
    select id, created_at, updated_at, status
    from analyses
    where status = 'running'
      and created_at < now() - interval '15 minutes'
    order by created_at;

Si la seconde requete renvoie plus de zero ligne apres deploy,
c est que la deadline ou le budget n a pas ete atteint, ou que
`markAnalysisFailed` a lui-meme echoue. Le cron
`cleanup-stale-running` (deja fixe au commit `f9043a3`) rattrapera
en filet de securite au bout de 30 minutes.

## Ce qui reste ouvert

  - La deadline par moteur est uniforme a 120s pour les 17
    moteurs. Certains moteurs plus lourds (orchestrate,
    financial-coherence sur dossiers denses) pourraient meriter
    un budget dedie plus large. A calibrer sur donnees prod des
    prochaines semaines.
  - Le retour `null` sur deadline expose downstream a des
    branches null qui pourraient etre plus propres a rendre
    explicites via un type `EngineResult<T> = { ok: T } | { failed: 'deadline' | 'error' }`.
    Refactor a envisager si le pattern se repete.
  - La marge de 200s entre budget 600s et mur Vercel 800s est
    generosite : la sortie propre prend en pratique 2-5s. On
    pourrait remonter le budget a 700s pour laisser plus de
    latitude en debut de vague sans perdre en securite. A
    trancher apres observation.
