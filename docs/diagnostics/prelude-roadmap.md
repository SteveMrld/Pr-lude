Rapport de lecture, aucune écriture, aucun run, aucun commit. Tout ce qui suit est vérifié sur le code sauf mention explicite d'inconnu.

## 1. Reproductibilité et température

Ta lecture est juste sur le fond et fausse sur le mécanisme, et l'écart change l'estimation.

Le paramètre `temperature` n'existe que sur un seul helper, `callClaudeWithPDF` (`lib/engines/anthropic-client.ts:461-468`). Cinq moteurs le passent à zéro : extraction (`:52`), extraction financière (`:118`), saas-metrics (`:403`), industrial-metrics (`:260`), prescan (`:271`). Les deux helpers texte, `callClaude` (`:183`) et `callClaudeWithUsage` (`:317`), n'ont aucun paramètre de température, et `CallClaudeOptions` (`:113-133`) ne porte que le web search, le timeout et les reprises. Tous les moteurs de jugement tournent donc au défaut API, et il n'y a pas de site d'appel à modifier : il n'y a pas de levier du tout. Le périmètre concerné est team, market, macro, pattern, causal, blindspot, contrarian, cohérence financière, narrative-drift, reference-checks, reference-aggregation, tech-claim, les sept patterns de fragilité et la synthèse finale.

Le travail réel est donc en trois temps, pas un. Étendre le type et les deux helpers, ce qui est une demi-heure. Propager dans le version stamp, où `temperature: 'api-default'` est écrit en dur (`lib/instrumentation/version-stamp.ts:305`) avec un commentaire qui dit précisément que si un moteur surcharge la valeur il faudra la remonter : sans ça le cachet ment le jour où tu changes, et comme la calibration segmente sur `modelsHash` (`lib/calibration/calibration-metrics.ts:44-57`), tu mélangerais deux instruments dans le même segment sans le voir. Puis mesurer.

Sur les effets de bord, la doctrine actuelle est écrite noir sur blanc à `anthropic-client.ts:438-452` : la variance interprétative des moteurs de jugement y est revendiquée comme une feature. Passer à zéro est un renversement doctrinal, pas un réglage. Le risque de qualité est réel et concentré sur contrarian et blindspot, dont le produit est précisément une lecture non consensuelle, et sur des sorties de 8000 à 14000 tokens où température zéro pousse au formulaire et à la répétition. Ma recommandation est zéro sur les six moteurs dont un nombre entre dans le score mécanique, et la mesure avant de généraliser, parce que dans ces moteurs le chiffre et la prose sortent du même JSON et qu'on ne peut pas les découpler par la température.

Un point qui manque à ta liste et qui pèse : le harnais qui mesure exactement ce que tu décris existe déjà, `scripts/reproducibility-harness.ts`, 575 lignes, six dimensions, moyenne, écart-type, min, max, étendue, plus vérification que le version stamp est identique sur les N runs. Il n'a jamais tourné. Son répertoire de sortie `scripts/audit-output/` n'existe pas et est gitignoré. Le chiffre de 6 à 11 points n'a donc aucun artefact dans le dépôt. Compte 1 USD et 90 à 180 secondes par run, soit 20 à 25 USD pour dix runs avant et dix après.

Dernière réserve, importante pour ce que tu promets à un fonds : température zéro ne rend pas déterministe. Le diagnostic basis l'établit sur pièce, trois contre trois sur six runs à température zéro prouvée (`prelude-diag-basis.md:5` et `:125`). Ce que tu peux promettre est un verdict reproductible, pas un texte identique, et cette distinction doit être écrite quelque part dans la note.

## 2. Basis actual / budget

Confirmé intégralement, et le diagnostic est plus complet que le résumé que tu en fais. Deux précisions qui changent le chiffrage.

D'abord, il y a deux décisions doctrinales, pas une. La première est celle que tu nommes, quel marqueur l'emporte quand le document en porte deux contradictoires pour le même exercice. La seconde est passée sous silence dans ta liste alors qu'elle est corrélée sans exception sur sept runs (`:110`) : les runs qui classent 2024 en `actual` extraient huit entrées de revenue depuis 2019, ceux qui classent en `budget` en extraient sept depuis 2020. Le modèle ne choisit pas un champ, il choisit une source primaire dans le document, tableau P&L contre graphique, et le périmètre de la série suit. Stabiliser `basis` sans trancher la source primaire ne stabilise pas la série extraite.

Ensuite, le travail de code une fois la doctrine tranchée. Il faut ajouter au contrat d'extraction le libellé brut et sa localisation, qui n'existent nulle part aujourd'hui, ni dans le JSON du prompt ni dans `ProjectionEntry` (`types.ts:569-574`). Il faut écrire un module résolveur pur qui mappe libellé vers basis selon une règle de priorité versionnée, sur le modèle exact de `lib/analysis/reference-year.ts` qui est le précédent du dépôt, sans aucun import, sans horloge, sans I/O. Il faut dériver `lastActualYear` par du code : la règle est énoncée au modèle à `financial-extraction-engine.ts:84` et n'est jamais exécutée, le pipeline accepte ce que le LLM rend, l'invariant tient par obéissance (`diag §3`). Il faut valider l'énumération, qui ne l'est nulle part : une valeur `"réel"` traverserait tout le pipeline sans être arrêtée (`diag §4`). Et il faut transmettre `basis` à la cohérence financière, qui sérialise aujourd'hui `année: valeur (source)` sans la nature comptable (`financial-coherence-engine.ts:516`), donc le moteur qui juge la cohérence du plan ignore quelles années sont réalisées.

Une session pleine pour le code, plus une demi-session de validation sur corpus avec clé API. L'inconnu que je ne peux pas lever en lecture seule est la fidélité du modèle à rendre le libellé brut sur des decks variés. Le véhicule de mesure existe, `scripts/validate-extraction-corpus.ts:286-299` collecte déjà `basisByYear` par dossier.

## 3. Valorisation

Confirmé. `pickProjectionValue` (`valuation-engine.ts:340-361`) choisit sur l'horloge et jette le `p.year` qu'elle vient de choisir, `extractBaseMetric` (`:368-408`) rend un nombre nu, et le moteur ne lit ni `basis` ni `lastActualYear`.

Tu sous-estimes ce point, pour une raison précise. Le fix nominal est petit : la primitive `deriveDossierReferenceYearWithReason` est pure et appelable telle quelle depuis le moteur puisque `financialData` est déjà dans son input, changer le contrat de retour de deux fonctions pour qu'elles remontent l'année et sa nature, remonter l'année dans `inputs` (`:316-323`) et le `rationale` (`:302-305`). Ce qui est gros, c'est le rayon de bascule. `:170` fait basculer un dossier en `profitable-mature` sur un EBITDA aujourd'hui projeté, 0,785 M€ en 2026 contre 0,138 M€ en 2024 sur In Haircare : brancher sur le réalisé déplace une population entière de dossiers de plage de multiples et de scénarios d'exit. Et `:187`, `isSeedPreRevenue`, se dérive de la non-applicabilité des multiples, donc la politique de rejet que tu retiens redistribue l'applicabilité d'une seconde méthode.

Cela ne se bascule pas à l'aveugle, et le dépôt n'a rien pour le mesurer : aucun script n'importe `computeValuation`. La bonne nouvelle est que ce harnais est faisable sans clé API, la fonction est déterministe et tous ses inputs sont persistés dans `result_json`. Une demi-session pour le harnais de rejeu, une demi-session pour la bascule mesurée. Réserve du diagnostic que je n'ai pas levée : si `teamScore` et `marketScore` ne sont pas persistés tels quels, le rejeu dérive sur `qualitySignal`.

## 4. Dossier de démonstration

C'est le point où je suis le plus en désaccord avec le cadrage. Un `completed` franc n'est pas atteignable aujourd'hui, et l'obstacle n'est pas la qualité du dossier, c'est la topologie du pipeline.

`computeRunStatus()` (`lib/orchestrator/engine-status-recorder.ts:546-547`) rend `completed_with_gaps` dès qu'un moteur manque. Or la porte team est un point de défaillance unique par construction : `teamPromise` ne porte aucun catch, et `route.ts:1062`, `:1081`, `:1094` attendent `Promise.all([teamPromise, marketPromise, macroPromise])` avant leur `try`. Un team qui tombe condamne pattern, blindspot, contrarian, causal et reference-checks à `failed-upstream` avec zéro seconde d'exécution, ce que le run `0142901d` a montré et que le commentaire de `engine-budget.ts:109-123` documente. Le correctif apporté jusqu'ici est budgétaire, la fenêtre passée de 150 à 180 secondes, pas structurel : la cascade est intacte.

L'arithmétique de mur aggrave le tableau. Le chemin critique nominal déclaré est de 625 secondes pour cinq moteurs seulement (`NOMINAL_MS:289-295`), sur un plafond Vercel de 800 (`route.ts:79`), avant la couche amont, et le commentaire admet que quatre des cinq durées sont estimées parce qu'aucun de ces moteurs n'a jamais abouti. Le pire cas par fenêtres dépasse le mur, ce que le code assume en le faisant couper par le budget de run, c'est-à-dire en sacrifiant des moteurs.

Donc, pour qu'un dossier sorte six dimensions reproductibles et un `completed` franc, dans l'ordre : dégrader structurellement la porte, un moteur aval doit tourner sur ce qu'il a et déclarer team absent au lieu de mourir avec lui, ce qui est exactement la doctrine que `score-calculator` applique déjà aux dimensions et que la topologie n'applique pas ; puis un run mesuré qui recalibre les fenêtres sur l'instrumentation posée par `4de91a7` et `e0f2cf2a` au lieu des estimations ; puis seulement dix runs du même deck au harnais. TOLSON régénéré est le dernier maillon, pas le premier.

## 5. Finitions, une par une

Le web search de `0f5fc5f` est réel et il est propre : le champ est requis au site d'appel, sept moteurs passent à zéro hop, quatre gardent leur hop unique, et le trou du mode frozen se referme par construction puisque zéro hop éteint l'outil. Ce qui reste n'est pas du code, c'est la validation : le message de commit dit lui-même que les durées vont bouger et que seul un run de mesure dira de combien. Cet item se solde dans le run mesuré de la session 3, il n'a pas de coût propre.

Le rendu de note sur socle partiel est très largement livré, entre `8d60c94` qui fait passer les deux indisponibilités par un rendu distinct d'un vrai score et fait déclarer au score son assiette, `41c2151` qui empêche le troisième état de ressusciter un verdict fantôme, `81b43b4` sur la synthèse et `7f241c5` sur la fragilité. Le résiduel n'est pas dans la note, il est dans le fait que la note doive le dire à chaque run, ce que la session 2 traite. Coût propre quasi nul, une vérification sur run réel.

Les deux zombies, je ne peux pas les confirmer sans interroger Supabase, ce que je n'ai pas fait dans le cadre lecture seule que tu as posé. Ce que le code dit : le cron de nettoyage existe et tourne toutes les quinze minutes avec un seuil de trente minutes et une auth duale secret plus user-agent Vercel. Une ligne qui survit signifie donc soit que le cron ne part pas, soit que ces lignes ne sont pas en `running`, soit qu'elles précèdent le cron. En revanche le knockout est un producteur confirmé d'orphelines : `route.ts:685-699` envoie l'événement SSE, ferme le contrôleur et retourne sans aucune écriture de statut, la ligne créée en amont reste en l'état. Ton item « knockout non persisté » et ton item « deux zombies » sont très probablement le même défaut. Une trentaine de lignes, plus une décision produit, un knockout mérite-t-il une ligne dans l'Historique.

Le palier macro sans clamp est confirmé et je l'élargirais. Le prompt définit cinq paliers et exige que le palier soit documenté (`macro-engine.ts:135-175`), le post-processing déterministe ne réécrit que deux champs de prose selon la matrice de pertinence, et `score-calculator.ts:663` lit le score à travers `realScore` (`:405-407`) qui ne vérifie que `typeof number` et `isFinite`. Un 120 ou un moins 10 entre dans la moyenne pondérée intact et le clamp final 0-100 masque l'anomalie au lieu de la signaler. Le défaut n'est pas macro, il est général : six dimensions lisent six nombres produits par LLM sans aucune garde de plage. Un module de contrat de score couvre les six d'un coup, et la question doctrinale est de savoir si une valeur hors contrat se clampe en silence ou rend la dimension non évaluée. La seconde option est cohérente avec la doctrine du troisième état.

La fiche sectorielle inversée est confirmée, et c'est pire qu'un bug, c'est une heuristique sans doctrine. `detectSectorSlugs` (`sectoral-injection-pure.ts:225-254`) parcourt `SLUG_MATCHERS` dans l'ordre de la table et le premier hit devient primaire, `resolveSectoralContext:125` prend `slugs[0]`. La priorité est donc l'ordre du tableau, pas la réalité du dossier, et les commentaires du tableau montrent qu'il a été réordonné au cas par cas, défense avant industrie pour que « drone » ne parte pas en hardware (`:85`), industrie avant climat parce que le pitch naval de Platypus Craft partait en climat-énergie (`:118-123`). Chaque nouveau dossier qui s'inverse ajoute un réordonnancement susceptible d'en casser un précédent. Une demi-session si tu continues à patcher, une session pleine si tu remplaces l'ordre par un score, comptage des mots-clés pondéré par champ avec argmax et égalité déclarée plutôt qu'arbitrée. C'est exactement le type de changement que ton CLAUDE.md demande, la racine plutôt que le symptôme.

## 6. La boucle de calibration et réconciliation

Elle est nettement plus construite que ta formulation ne le suggère. Sont présents et testés : `lib/calibration/calibration-metrics.ts` avec courbe de calibration, score de Brier, discrimination, segmentation par empreinte de version stamp et échec honnête sous dix résolus par segment ; `lib/calibration/corpus-selection.ts` avec une règle déterministe anti-biais du sélectionneur dont la signature interdit d'écarter un dossier nommément ; la taxonomie d'outcomes ; le store de prediction records en cliché immuable ; l'agrégateur, la narration, le préremplissage et le store de réconciliation ; l'UI `app/reconciliation` avec `CalibrationSummary`, `PredictionSnapshot`, `OutcomeTracking` ; les schémas Supabase avec les migrations reliability et taxonomy v2 ; les scripts de backfill, de sonde et d'amorçage.

La réponse à ta question est donc nette : c'est de la donnée, pas du code. Mais il y a un obstacle structurel que ta liste ne voit pas et qui est peut-être la décision la plus rentable de tout ce rapport. Le seuil est de dix résolus par segment et le segment est la clé `commitSha` plus `configsHash` plus `enginesHash` plus `modelsHash`. À ton rythme de commits, chaque session crée un segment neuf. Dix dossiers résolus dans un même segment ne sont pas atteignables tant que l'instrument bouge tous les jours. Soit tu versionnes l'instrument explicitement, une version de doctrine que tu incrémentes volontairement, et tu segmentes là-dessus, soit la calibration ne commence qu'au gel du code. Tant que ce n'est pas tranché, le moat ne peut pas commencer à accumuler, quel que soit le nombre d'outcomes que tu collectes.

Le second levier est que la collecte n'a pas à attendre des années de calendrier. Le dépôt anticipe déjà les dossiers historiques, migrations v3 à v5b, ingestion de corpus, dossiers de référence. Instruire dix à vingt dossiers à issue connue en mode `frozen` donne un segment en semaines. Et ce mode ne fonctionne réellement que depuis `0f5fc5f` : avant, sept moteurs sur onze interrogeaient le web dans un run censé être gelé, donc lisaient potentiellement l'issue qu'on leur demandait de prédire. Ce commit débloque le moat autant qu'il corrige un budget.

## Ce que ta liste oublie

La cascade de la porte team, développée au point 4. C'est le défaut le plus grave du lot parce qu'il rend tous les autres non mesurables.

L'absence de lanceur de tests et de CI. `npm test` exécute deux fichiers sur quatre-vingt-dix-huit, et le dépôt porte 2519 assertions `check()` que rien ne fait tourner ensemble. Il n'y a pas de `.github/workflows`. Ton CLAUDE.md ordonne de lancer la suite avant chaque commit et la commande n'existe pas. C'est l'item le moins cher et le plus rentable de la liste entière.

L'absence de contrat sur les scores, développée au point 5, dont le palier macro n'est qu'un cas.

Le parcours growth, qui figure dans ton CLAUDE.md et dans aucun de tes six points : la note et le dashboard ne cachent pas les moteurs skippés. Un fonds qui instruit un dossier growth lit une note dont plusieurs sections déclarent une absence. Ce n'est pas un défaut technique, c'est une expérience qui se lit comme un défaut.

L'auth. `ENABLE_AUTH` est un drapeau avec repli solo et `env-flags` avertit sur le repli. Les fichiers SQL portent du RLS mais rien dans le dépôt ne prouve que les politiques tiennent avec une seconde organisation. Un test à deux tenants est une demi-session, et c'est la première question que posera la DSI d'un fonds.

Le coût par dossier. L'instrumentation par moteur mesure désormais les tokens, personne n'a encore produit le coût d'un run complet. À 15 à 25 mille euros par mois on te le demandera. Ce n'est pas un chantier, c'est un sous-produit du run mesuré.

## Découpage en sessions

Session 1, preuve exécutable, pur code, aucune doctrine. Lanceur de suite complète, CI GitHub Actions sur `tsc` plus la suite, module de contrat de score couvrant les six dimensions dont le palier macro, persistance du statut sur le chemin knockout, purge des orphelines. Livre une suite verte en une commande, une CI qui bloque le rouge, plus aucun run fantôme, plus aucun score hors contrat.

Session 2, le mur du run. Dégradation structurelle de la porte, la doctrine évalué / non évalué de `score-calculator` appliquée à la topologie du pipeline. Recalibration des fenêtres sur l'instrumentation en place. Une seule décision pour toi, une note sans team est-elle publiable. Livre un run qui tient dans son mur et qui dégrade proprement.

Session 3, reproductibilité mesurée. Dépend de la 2. Extension de `CallClaudeOptions` et des deux helpers texte, propagation dans le version stamp, dix runs avant et dix après au harnais existant. Doctrine pour toi : quels moteurs passent à zéro, et ce que tu promets commercialement, verdict reproductible ou texte identique. Livre le chiffre de variance, mesuré, et sa valeur après correction. 25 à 50 USD d'API.

Session 4 et demie de session 4, basis. Doctrine d'abord, de toi, sur les deux arbitrages, marqueur prioritaire et source primaire donc périmètre de série. Puis libellé brut et localisation dans le contrat, module résolveur pur, dérivation de `lastActualYear` par le code, validation de l'énumération, transmission du basis à la cohérence financière. Puis mesure sur corpus avec clé.

Session 5, valorisation. Dépend de la 4. Demi-session de harnais de rejeu hors ligne sur le corpus persisté, sans clé API, puis bascule mesurée. Doctrine de toi : la politique de rejet, je recommande la troisième option du diagnostic, le tri-état de `resolveYearForIndicator`, et la bascule d'asset class sur l'EBITDA réalisé en sachant qu'elle déplace une population.

Session 6, fiche sectorielle. Remplacement de l'ordre de table par un score pondéré avec égalité déclarée. Autonome, insérable n'importe où.

Session 7, dossier de démonstration. Dépend de 1 à 5. Un deck, dix runs, six dimensions avec leur dispersion mesurée, un `completed` franc, la note lue de bout en bout. C'est l'artefact que tu montres.

Session 8, amorce du moat. Doctrine de toi, et c'est la décisive : segmenter la calibration sur une version de doctrine explicite plutôt que sur le SHA, sinon le compteur se remet à zéro à chaque commit. Puis ingestion de dix à vingt dossiers historiques à issue connue, en mode gelé. Livre le premier segment de calibration non vide. Peut démarrer en parallèle de la session 4 dès que la doctrine de segmentation est arrêtée.

Neuf à dix sessions jusqu'à une démonstration défendable, dont quatre avant qu'une seule mesure soit fiable. Les sessions 6 et 8 sont parallélisables, le reste est séquentiel par dépendance réelle.

## Décisions qui sont les tiennes

L'arbitrage basis et le périmètre de série. La doctrine de température par moteur et ce que reproductible veut dire dans un contrat commercial. La politique de rejet en valorisation et la bascule d'asset class. Un knockout mérite-t-il une ligne d'historique. La segmentation de calibration sur version de doctrine plutôt que sur SHA. Une note privée de team est-elle publiable.

## Inconnus assumés

Les deux orphelines, non vérifiées faute d'interrogation base, hors du cadre lecture seule que tu as posé. La fidélité du modèle à rendre un libellé brut sur decks variés, non mesurable sans clé. La persistance de `teamScore` et `marketScore` dans `result_json`, qui conditionne le harnais de rejeu valorisation. La durée réelle des deux échecs team à 152 secondes, coupés exactement à leur plafond, donc inconnue par construction. Et le chiffre de 6 à 11 points, qui n'a aucun artefact dans le dépôt puisque le harnais n'a jamais produit de sortie.
