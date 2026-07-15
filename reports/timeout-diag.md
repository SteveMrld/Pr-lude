# Diagnostic timeout SDK team / market / macro

## 4. Confirmé : timeout SDK 60 s structurellement trop court pour team et market.

Durées runs OK, corpus **100 % pré-commit 66f8235** (aucun run post-commit n'a de team/market/macro OK exploitable — TOLSON avait ses trois sorties `null`) :

| moteur | p50 | p90 | > 60 s |
|---|--:|--:|:--:|
| team | **105 s** | 143 s | **50 %+ des runs** |
| market | **94 s** | 128 s | **50 %+ des runs** |
| macro | 50 s | 68 s | ~30 % des runs |

- **team p50 = 105 s > 60 s** : la médiane dépasse le timeout. Un run team médian se fait couper puis retry avec le nouveau timeout de 60 s — le retry timeoutera à son tour au même endroit puisque le moteur a besoin de plus de temps que le budget accordé. Le retry n'est pas un antidote à un timeout structurellement sous-dimensionné, il ne l'est qu'à un incident transitoire.
- **market p50 = 94 s > 60 s** : même verdict.
- **macro p50 = 50 s** : sous timeout au median, mais p90 = 68 s → 10-30 % des runs coupés.

Le retry `maxRetries=1` mordu par un timeout de 60 s est efficace contre un 429/529/burst transitoire mais aveugle face à une génération lente structurelle. Sur team et market, on a affaire à ce second cas, pas au premier.

## 2. Timeout SDK 60 s couvre l'aller-retour complet, hops web_search inclus.

`web_search_20250305` s'exécute côté serveur Anthropic, transparent pour le client. `client.messages.create(...)` reste **un seul POST HTTP** vers `api.anthropic.com/v1/messages` : connect + send + wait TTFB + réception body streamé. Anthropic gère en interne la boucle génération → détection `tool_use` → exécution recherche upstream (OpenAlex, GitHub, Bing) → reprise génération avec résultats en contexte → finalisation, mais tout ceci s'inscrit dans le même roundtrip HTTP côté client.

Vérifié dans `node_modules/@anthropic-ai/sdk/src/core.ts:291-315` : le champ `timeout` est appliqué au fetch complet, pas ré-armé à chaque tool_use. La documentation Anthropic ne mentionne aucun mécanisme de "timeout hop-only".

Conséquence : chaque hop web_search consomme du budget des 60 s au même titre qu'une génération pure. Un moteur team qui fait 30 s de génération + 15 s de web_search + 20 s de post-génération = 65 s, coupé net.

## 3. Durées split pre/post commit 66f8235.

Split par `created_at` versus `2026-07-08T17:15:28Z` (commit 66f8235). Corpus 30 dossiers `completed / completed_with_gaps` interrogés.

| moteur | phase | n | min | p50 | p90 | max |
|---|---|--:|--:|--:|--:|--:|
| team | pre-commit | 27 | 58 739 | 109 696 | 145 585 | 174 276 |
| team | post-commit | **0** | — | — | — | — |
| market | pre-commit | 27 | 85 373 | 94 563 | 128 760 | 171 721 |
| market | post-commit | **0** | — | — | — | — |
| macro | pre-commit | 27 | 42 031 | 50 339 | 68 705 | 95 614 |
| macro | post-commit | **0** | — | — | — | — |

Zéro sample post-commit pour ces trois moteurs. Les seuls runs post-8 juillet dans le corpus (TOLSON 12 juillet, In Haircare 15 juillet x2) ont **tous** team/market/macro en échec (null output ou failed). Le corpus mesuré est donc entièrement issu de l'ancienne configuration SDK (timeout SDK défaut 10 min, maxRetries défaut 2) où ces moteurs pouvaient prendre 100-170 s sans être coupés.

Sous la nouvelle configuration (timeout 60 s), aucun de ces runs pré-commit ne serait complété. C'est mécaniquement compatible avec l'observation In Haircare : team/market/macro échouent systématiquement parce que le nouveau plafond de 60 s est en-dessous de leur régime nominal historique. Le retry ne masque pas ce fait, il l'amplifie en enregistrant deux tentatives échouées à ~60 s chacune.

## 5. Timeout configurable par appel via l'API du SDK, mais pas exposé dans nos helpers.

Le SDK Anthropic supporte un timeout **per-request** : `client.messages.create(params, { timeout: 150_000 })`. Confirmé dans `node_modules/@anthropic-ai/sdk/src/core.ts:303-304` : `const timeout = options.timeout ?? this.timeout;` — l'override request-scoped prend le pas sur le client-scoped sans toucher au client partagé.

Actuellement, nos helpers `callClaude` et `callClaudeWithPDF` (`anthropic-client.ts:175, 298, 430`) appellent `client.messages.create(requestParams)` **sans passer d'options** — le timeout est donc toujours celui du client (60 000 ms). Le paramètre n'est pas exposé aux moteurs.

Pour brancher un timeout par moteur, il faut :

- ajouter un paramètre optionnel `timeout?: number` à `callClaude` et `callClaudeWithPDF`
- le propager en second argument de `messages.create`
- l'appeler depuis team-engine, market-engine, macro-engine

Budget avec `timeout=150s` sur team/market/macro :

| config | pire cas par moteur | vs deadline 200 s |
|---|--:|---|
| timeout=150s + maxRetries=1 | 150 + backoff + 150 ≈ **301 s** | **casse la deadline** (coupée au bord des 200 s, retry inutile) |
| timeout=150s + maxRetries=0 | 150 s | tient (150 < 200) mais on perd le retry |
| timeout=90s + maxRetries=1 | 90 + backoff + 90 ≈ **181 s** | tient (181 < 200), retry fonctionnel |
| timeout=180s + maxRetries=0 | 180 s | tient (180 < 200), pas de retry |

Cas nominal souhaité : couvrir p90 team (143 s) avec un retry qui reste utile. `timeout=90s` mord le p90 mais laisse un retry effectif → team p90 tombe sur second essai (90 + 90 = 180 s > 143 s, donc succès probable si l'incident est transitoire). Compromis raisonnable pour team et market.

Pour macro (p90 = 68 s), `timeout=90s` couvre p95+ en un essai. Retry rare, utile en 429.

**RUN_BUDGET_MS 600 s tient-il avec `timeout=90s` sur les trois moteurs lourds ?** Chaîne critique série pathologique tous retries : 5 × 181 = 905 s → au-dessus. Chaîne critique typique (p50) : 105 + 40 + 50 + 20 + 40 = 255 s → sous. Comme aujourd'hui, seul le pathologique multi-retry casse le budget, et `budgetPromise` coupe cleanly.

Trois options à trancher :

1. **`timeout=90s` sur team/market/macro + maxRetries=1 inchangé** : retry actif, couvre p90, tient dans deadline 200 s. Recommandé si on veut garder la reprise.
2. **`timeout=180s` sur team/market/macro + maxRetries=0** : couvre p95, pas de retry sur ces trois moteurs, retry conservé sur les autres. Simple.
3. **Remonter deadline 200 → 300 + timeout 150 + maxRetries=1** : couvre p90 avec retry, mais casse la marge budget (chaîne critique pire cas 5 × 301 = 1 505 s bien au-dessus de 600 s, budget cut fréquent).

Sans instruction, aucune modification effectuée.
