-- ============================================================
-- INCREMENTAL V5 - FUNDING_BAND / SECTOR_SUBGROUP / NARRATIVE_SPECIFICITY
-- ------------------------------------------------------------
-- Cette migration corrige un defaut de calibration du moteur de
-- comparables : un dossier en seed 1.5M EUR pouvait etre matche avec
-- une licorne late stage ou un industriel hardware milliardaire,
-- meme apres le hard filter asset_class de la V4.
--
-- Trois axes ajoutes :
--
--   1. funding_band (pre_seed / seed / series_a / series_b /
--      series_c_plus / late_ipo). Le moteur applique un hard filter
--      a plus ou moins une bande pour le bloc stage-aligned. Les
--      comparables longitudinaux (boites a scale qui montrent une
--      trajectoire) restent disponibles dans un bloc separe, sans
--      poids dans le scoring de probabilite.
--
--   2. total_raised_amount + total_raised_currency + total_raised_as_of.
--      Donnee brute pour calcul et audit. Permet de verifier la coherence
--      du funding_band au cas par cas.
--
--   3. sector_subgroup. Granularite plus fine que asset_class, plus
--      fine que sector. Exemples : social_video_media (vs media),
--      ride_hailing (vs mobility), oem_auto (vs mobility),
--      foundation_models (vs ai), battery_cell_manufacturing
--      (vs greentech). Permet d eviter qu une seed mobilite soit
--      comparee a Tesla, ce qui n a aucun sens.
--
--   4. narrative_specificity (jsonb). Champ de garde-fou contre
--      l invocation abusive des comparables vedettes (Ynsect, WeWork,
--      Theranos, Lilium, Fisker, Quibi...). Les LLM les ressortent
--      par disponibilite narrative meme quand le dossier instruit n a
--      rien de structurellement commun. Le champ contient :
--        { tags: [...], requires: { asset_class: [...], 
--          funding_band_min: '...', context: '...' } }
--      Le moteur ne peut invoquer ces comparables que si les conditions
--      requires sont satisfaites par le dossier.
--
--   5. Backfill funding_band sur les lignes existantes par regle
--      deterministe basee sur founded + sector + asset_class. Backfill
--      narrative_specificity sur les comparables vedettes connus.
--
-- ============================================================

-- 1. Ajout colonnes (idempotent)
alter table public.historical_companies add column if not exists funding_band text;
alter table public.historical_companies add column if not exists sector_subgroup text;
alter table public.historical_companies add column if not exists total_raised_amount numeric;
alter table public.historical_companies add column if not exists total_raised_currency text;
alter table public.historical_companies add column if not exists total_raised_as_of text;
alter table public.historical_companies add column if not exists narrative_specificity jsonb;

-- Contrainte sur funding_band (idempotente via DO bloc)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'historical_companies_funding_band_check'
  ) then
    alter table public.historical_companies
      add constraint historical_companies_funding_band_check
      check (funding_band is null or funding_band in (
        'pre_seed', 'seed', 'series_a', 'series_b',
        'series_c_plus', 'late_ipo'
      ));
  end if;
end $$;

-- Contrainte sur total_raised_currency
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'historical_companies_currency_check'
  ) then
    alter table public.historical_companies
      add constraint historical_companies_currency_check
      check (total_raised_currency is null or total_raised_currency in ('EUR', 'USD', 'GBP'));
  end if;
end $$;

-- Index pour les filtres
create index if not exists idx_historical_companies_funding_band
  on public.historical_companies (funding_band);
create index if not exists idx_historical_companies_sector_subgroup
  on public.historical_companies (sector_subgroup);

-- ============================================================
-- 2. BACKFILL FUNDING_BAND
-- ============================================================
-- Regle deterministe : on essaie d inferer le funding_band depuis
-- l outcome et l asset_class. Les boites taggees 'success' ou
-- 'success_private' avec capital_intensity = 'high' ou 'very high'
-- sont presque toujours late ou series_c_plus. Les fail_uncertain
-- early-stage sont seed/series_a. C est imparfait, c est volontaire :
-- la donnee verifySource de chaque comparable doit etre auditee
-- progressivement. Tant que funding_band est null, le comparable est
-- traite comme legacy (matching libre avec disclaimer).

-- Vedettes hardware industrial et infrastructure : late stage / IPO
update public.historical_companies set funding_band = 'late_ipo'
  where funding_band is null
  and name in (
    'Northvolt', 'Ynsect', 'Lilium', 'Boom Supersonic',
    'Relativity Space', 'Joby Aviation', 'Archer Aviation',
    'QuantumScape', 'Form Energy', 'Symbotic', 'PsiQuantum',
    'Skyports', 'Volocopter', 'Lilium NV'
  );

-- Vedettes scale/IPO software
update public.historical_companies set funding_band = 'late_ipo'
  where funding_band is null
  and name in (
    'Spotify', 'Adyen', 'Klarna', 'Wise', 'Revolut', 'Doctolib',
    'Mistral AI', 'Stripe', 'Snowflake', 'Datadog', 'OpenAI',
    'Anthropic', 'Cohere', 'Databricks'
  );

-- Cas WeWork / Theranos / FTX : late stage avec collapse
update public.historical_companies set funding_band = 'late_ipo'
  where funding_band is null
  and name in (
    'WeWork', 'Theranos', 'FTX', 'Quibi', 'Bird', 'Hopin',
    'Better.com', 'Fisker', 'Casper', 'Peloton'
  );

-- Series C+ (croissance avancee mais pas late stage)
update public.historical_companies set funding_band = 'series_c_plus'
  where funding_band is null
  and name in (
    'Alan', 'Back Market', 'ManoMano', 'Brevo', 'Qonto',
    'Pasqal', 'Atom Computing', 'Sila Nanotechnologies',
    'Sierra Space', 'Carbon Inc.', '1X Technologies', 'Apptronik',
    'Sanctuary AI'
  );

-- Fallback : si capital_intensity = 'very high' et pas backfilled,
-- on suppose late_ipo
update public.historical_companies set funding_band = 'late_ipo'
  where funding_band is null
  and capital_intensity = 'very high';

-- Fallback : si capital_intensity = 'high', series_c_plus
update public.historical_companies set funding_band = 'series_c_plus'
  where funding_band is null
  and capital_intensity = 'high';

-- ============================================================
-- 3. BACKFILL SECTOR_SUBGROUP
-- ============================================================
-- Granularite plus fine que sector. On commence par les sous-secteurs
-- les plus utilises pour eviter les comparaisons absurdes.

-- Foundation models / LLMs (vs SaaS AI generique)
update public.historical_companies set sector_subgroup = 'foundation_models'
  where sector_subgroup is null
  and name in ('Mistral AI', 'OpenAI', 'Anthropic', 'Cohere', 'Databricks');

-- Quantum hardware (vs deep_tech generic)
update public.historical_companies set sector_subgroup = 'quantum_hardware'
  where sector_subgroup is null
  and (sector ilike 'Quantum%' or vertical_v4 ilike '%quantum%');

-- eVTOL / aviation electrique
update public.historical_companies set sector_subgroup = 'evtol_aviation'
  where sector_subgroup is null
  and name in ('Joby Aviation', 'Archer Aviation', 'Lilium', 'Volocopter', 'Skyports', 'Lilium NV');

-- Battery cell manufacturing (vs greentech generic)
update public.historical_companies set sector_subgroup = 'battery_cell_manufacturing'
  where sector_subgroup is null
  and name in ('Northvolt', 'QuantumScape', 'Form Energy', 'Sila Nanotechnologies', 'Verkor', 'ACC');

-- OEM auto (vs ride hailing)
update public.historical_companies set sector_subgroup = 'oem_auto'
  where sector_subgroup is null
  and name in ('Tesla', 'Rivian', 'Lucid Motors', 'Fisker', 'Polestar');

-- Ride hailing (vs OEM)
update public.historical_companies set sector_subgroup = 'ride_hailing'
  where sector_subgroup is null
  and name in ('Uber', 'Lyft', 'BlaBlaCar', 'Heetch', 'Free Now', 'Bolt', 'Yassir', 'Careem');

-- Insectes / biotech alternative protein
update public.historical_companies set sector_subgroup = 'alternative_protein'
  where sector_subgroup is null
  and name in ('Ynsect', 'InnovaFeed', 'Beyond Meat', 'Impossible Foods');

-- Real estate tech
update public.historical_companies set sector_subgroup = 'real_estate_tech'
  where sector_subgroup is null
  and name in ('WeWork', 'Compass', 'Opendoor', 'Better.com');

-- Humanoid robotics (vs warehouse robotics)
update public.historical_companies set sector_subgroup = 'humanoid_robotics'
  where sector_subgroup is null
  and name in ('1X Technologies', 'Apptronik', 'Sanctuary AI', 'Figure AI', 'Agility Robotics');

-- Warehouse robotics (vs humanoid)
update public.historical_companies set sector_subgroup = 'warehouse_robotics'
  where sector_subgroup is null
  and name in ('Symbotic', 'Exotec', 'Berkshire Grey');

-- ============================================================
-- 4. BACKFILL NARRATIVE_SPECIFICITY
-- ============================================================
-- Tag les comparables vedettes avec les conditions requises pour
-- pouvoir les invoquer. Le moteur filtrera leur sortie si le dossier
-- ne matche pas les conditions. Empeche que Ynsect ne soit invoque
-- pour une seed media social, ou que WeWork ne sorte sur une fintech B2B.

-- Ynsect : echec structurel sur unit economics non scaling, hardware
-- industrial intensif. Ne pas sortir si dossier asset light ou software pur.
update public.historical_companies set narrative_specificity = jsonb_build_object(
  'tags', jsonb_build_array(
    'capex_intensive_collapse',
    'unit_economics_non_scaling',
    'overfunded_industrial'
  ),
  'requires', jsonb_build_object(
    'asset_class', jsonb_build_array('hardware_industrial', 'infrastructure_physical'),
    'funding_band_min', 'series_b',
    'context', 'Echec structurel post-scale sur economics non viables. Invoquer uniquement pour des dossiers hardware ou infra qui levent gros sur des projections de scale non eprouvees.'
  )
) where name = 'Ynsect' and narrative_specificity is null;

-- WeWork : narratif tech masquant economie immobiliere. Ne pas sortir
-- pour des dossiers software pur ou seed.
update public.historical_companies set narrative_specificity = jsonb_build_object(
  'tags', jsonb_build_array(
    'tech_narrative_masking_capex',
    'governance_failure',
    'overvaluation_collapse'
  ),
  'requires', jsonb_build_object(
    'asset_class', jsonb_build_array('hardware_industrial', 'infrastructure_physical', 'software_with_hardware'),
    'funding_band_min', 'series_c_plus',
    'context', 'Late stage avec narratif tech sur business capex intensif. Invoquer pour dossiers ou la valuation decroche du modele economique reel.'
  )
) where name = 'WeWork' and narrative_specificity is null;

-- Theranos : fraude scientifique. Ne pas sortir hors deeptech / biotech.
update public.historical_companies set narrative_specificity = jsonb_build_object(
  'tags', jsonb_build_array(
    'scientific_fraud',
    'overclaiming_tech_capability',
    'governance_failure'
  ),
  'requires', jsonb_build_object(
    'asset_class', jsonb_build_array('deep_tech_research', 'hardware_consumer'),
    'funding_band_min', 'series_b',
    'context', 'Fraude scientifique avec validation tech non auditable. Invoquer pour deeptech ou medtech qui claim performance non reproductible.'
  )
) where name = 'Theranos' and narrative_specificity is null;

-- Lilium / Fisker : pre-revenue scale, contrats LOI vs fermes
update public.historical_companies set narrative_specificity = jsonb_build_object(
  'tags', jsonb_build_array(
    'pre_revenue_scale_failure',
    'loi_vs_firm_backlog_confusion',
    'capex_burn_collapse'
  ),
  'requires', jsonb_build_object(
    'asset_class', jsonb_build_array('hardware_industrial'),
    'funding_band_min', 'series_b',
    'context', 'Echec post-IPO sur confusion entre intentions commerciales (LOI, MoU) et carnet ferme. Invoquer pour hardware industriel pre-revenu.'
  )
) where name in ('Lilium', 'Lilium NV', 'Fisker') and narrative_specificity is null;

-- Quibi : product-market fit absent sur financement massif
update public.historical_companies set narrative_specificity = jsonb_build_object(
  'tags', jsonb_build_array(
    'overfunded_no_pmf',
    'consumer_short_form_collapse',
    'distribution_capture_failure'
  ),
  'requires', jsonb_build_object(
    'asset_class', jsonb_build_array('software_pure'),
    'funding_band_min', 'series_b',
    'context', 'Levee massive sans validation PMF, segment consumer media. Invoquer pour dossiers consumer qui leve gros sans signaux organiques.'
  )
) where name = 'Quibi' and narrative_specificity is null;

-- Bird / scooters : unit economics fleet management
update public.historical_companies set narrative_specificity = jsonb_build_object(
  'tags', jsonb_build_array(
    'fleet_unit_economics_failure',
    'capex_per_unit_unsustainable'
  ),
  'requires', jsonb_build_object(
    'asset_class', jsonb_build_array('hardware_industrial', 'software_with_hardware'),
    'funding_band_min', 'series_b',
    'context', 'Echec sur unit economics par actif deploye dans un modele fleet. Invoquer pour mobility, micromobility, ou fleet-as-a-service.'
  )
) where name = 'Bird' and narrative_specificity is null;

-- Northvolt : industrial scale execution failure (post hoc, 2024)
update public.historical_companies set narrative_specificity = jsonb_build_object(
  'tags', jsonb_build_array(
    'industrial_scale_execution_failure',
    'capex_overrun',
    'manufacturing_yield_collapse'
  ),
  'requires', jsonb_build_object(
    'asset_class', jsonb_build_array('infrastructure_physical', 'hardware_industrial'),
    'funding_band_min', 'series_b',
    'context', 'Echec d execution industrielle sur usine grande echelle. Invoquer pour infrastructure physique ou battery cell manufacturing qui leve sur projections de yield non eprouvees.'
  )
) where name = 'Northvolt' and narrative_specificity is null;

-- ============================================================
-- 5. NOTES
-- ============================================================
-- Les comparables sans narrative_specificity sont invocables librement
-- (comportement V4 conserve). Le tag est un filtre additionnel, pas
-- substitutif. La logique cote moteur :
--   1. Hard filter asset_class (V4)
--   2. Hard filter funding_band a +/- 1 bande (V5, sauf bloc longitudinal)
--   3. Filtre narrative_specificity sur les vedettes (V5)
-- Le sector_subgroup est utilise comme boost de similarite, pas comme
-- hard filter (un foundation_models peut etre compare a un consumer AI
-- si l asset_class et le funding_band matchent).
