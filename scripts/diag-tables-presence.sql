-- A coller dans le SQL Editor Supabase. Court (<400 caracteres), pas
-- de risque de troncature clipboard. Sort un verdict binaire sur la
-- presence reelle des deux tables en base et leur nombre de colonnes.
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('prediction_records', 'analysis_outcomes')
ORDER BY table_name;
