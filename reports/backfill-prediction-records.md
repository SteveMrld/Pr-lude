# Backfill prediction_records, rapport d execution

Date : 2026-06-07T19:50:28.801Z
Mode : APPLY
Brique source : commit a259c0d (insertion automatique post-markAnalysisCompleted)

## Tampon de version legacy applique

Tous les records backfilles partagent un fingerprint distinct du segment courant :

```
commitSha    : legacy-pre-a259c0d
configsHash  : legacy
enginesHash  : legacy
modelsHash   : legacy
inputsHash   : legacy::<sourceAnalysisId-prefix>
schemaVersion: legacy-v1
```

La couche de calibration segmente sur (commitSha + configsHash + enginesHash + modelsHash) :
le segment legacy est donc unique et ne se melangera jamais avec les segments produits par
les runs courants ou futurs.

## Compteurs

| Categorie | Compte |
|---|---|
| Total analyses completed | 4 |
| Skipped (record deja present) | 0 |
| Skipped (verdict absent, invalide) | 0 |
| Insertes | 4 |
| Echecs | 0 |

## Discipline

Script idempotent : relancable autant de fois que necessaire, jamais de doublon.
Le filtre d entree est `status=completed` plus l absence d un record en base.
Aucune analyse pending ou failed n est touchee : leur verdict est approximatif et
elles ne meritent pas d entrer dans la calibration.

La couche de calibration filtre elle-meme les records sans successProbability
(cf calibration-aggregator.ts) : la majorite des records legacy auront
successProbability=null parce que les anciens runs ne portaient pas ce champ.
Ils restent visibles comme historique mais ne biaisent pas le Brier.
