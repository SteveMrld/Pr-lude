# Backfill prediction_records, rapport d execution

Date : 2026-06-07T16:57:49.032Z
Mode : DRY-RUN
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

## Schema non encore applique

La table `public.prediction_records` n a pas ete trouvee dans le schema Supabase.
Le backfill ne peut pas s executer tant que le schema dedie n est pas applique.

Etapes pour debloquer :

1. Ouvrir le SQL Editor du projet Supabase Prelude.
2. Coller le contenu de `supabase-prediction-records-schema.sql` (cree par le commit a259c0d).
3. Executer la requete : deux tables creees (`prediction_records`, `analysis_outcomes`),
   plus les index, RLS et trigger updated_at.
4. Relancer ce script en dry-run pour valider, puis avec --apply.

### Candidats au backfill (4)

Les analyses suivantes seront eligibles dès que la table existera :

| analysis_id | societe | verdict | score |
|---|---|---|---|
| 9c294975-12b2-40c4-b024-a78c948d06f5 | Mistral AI | investir avec conditions | 68 |
| 09ebeb03-ba68-424f-8245-f40ac9dba736 | BlueAi | refuser | 42 |
| a1c41e72-843a-4b0c-8f11-e9b2efb0aa65 | JNAN Hotels | investir avec conditions | 63 |
| f305f444-cb01-4775-a432-b56f31b07062 | PEN GROUP | approfondir | 51 |

## Compteurs

| Categorie | Compte |
|---|---|
| Total analyses completed | 4 |
| Skipped (record deja present) | 0 |
| Skipped (verdict absent, invalide) | 0 |
| A inserer | 0 |
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
