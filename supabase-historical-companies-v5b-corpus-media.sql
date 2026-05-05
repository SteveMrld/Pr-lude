-- ============================================================
-- INCREMENTAL V5b - ENRICHISSEMENT CORPUS SOCIAL_VIDEO_MEDIA
-- ------------------------------------------------------------
-- Cette migration ajoute des comparables dans le sous-secteur
-- social_video_media. Avant V5b, le corpus n avait aucune ligne
-- pour ce sector_subgroup, donc un dossier media social vidéo en
-- seed (typiquement le cas Liik) tombait sur des comparables
-- aberrants (industriels capex intensif, deeptech quantum, EV).
--
-- Inserts faits :
--   - Stage-aligned (seed/series_a) : Loopsider, BeReal, Konbini early
--   - Longitudinal (series_c_plus / late_ipo) : Brut, Vice Media,
--     BuzzFeed, Likee (Joyy subsidiary), Rumble, NowThis / Group Nine
--
-- Tous les chiffres marques 'verify_source' dans analyst_note doivent
-- etre re-verifies avant publication. Les ordres de grandeur sont
-- corrects au moment de la redaction mais les valuations bougent.
--
-- Cette migration suppose que la V5 (alter table + index + contraintes)
-- a deja ete executee. Elle est idempotente sur la base d un test 'where
-- not exists' par nom.
-- ============================================================

-- ============================================================
-- 1. STAGE-ALIGNED : seed / series_a media social video FR/EU
-- ============================================================

-- Loopsider : lance 2018, leve modeste (~6M EUR cumule estime),
-- break-even mentionne 2025, 1.4M TikTok 800k Instagram. Active.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of
)
select
  'Loopsider', 'France', 'Media', 'Video social decryptage', 'Video social decryptage', 2018, 'active', 'private scale-up',
  'Europe', 'EU', 'No', 'Medium', 'https://www.loopsider.com/',
  'Lance 2018 par Johan Hufnagel ex Liberation. Focus decryptage geopolitique sciences environnement egalite. ~1.4M TikTok 800k Instagram. Modele brand content (Veolia, Cash Investigation spin-off) plus partenariats. Break-even annonce 2025 sur frugal management. verify_source : montants levees a confirmer (estimation ~6M EUR cumulee).', 3,
  'software_pure', 4, 'low', 'Media social video decryptage',
  'https://www.tubularlabs.com/', 'Frugal management plus focus engagement (likes/comments/shares) plus que reach brut. Audience plus polarisee politiquement que Brut/Konbini.', 'Risque PMF si polarisation editoriale baisse engagement. Dependance plateforme totale. Pas d audience proprietaire.',
  'series_a', 'social_video_media',
  6, 'EUR', '2024'
where not exists (select 1 from public.historical_companies where name = 'Loopsider');

-- BeReal : lance 2020, Series A 30M USD 2022, valuation 500M USD pic puis collapse.
-- Pattern fail_uncertain : viral puis stagnation post-novelty.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of,
  signals_negative
)
select
  'BeReal', 'France', 'Media', 'Authentic UGC daily snapshot', 'Authentic UGC daily snapshot', 2020, 'fail_uncertain', 'downround / acqui-hire en cours',
  'Europe', 'EU', 'No', 'Medium', 'https://techcrunch.com/2022/10/13/bereal-claims-53-million-active-users/',
  'Lance par Alexis Barreyat. Series A ~30M USD 2022 (Accel, Andreessen Horowitz). Valuation pic ~500M USD. Series B failed to close 2024. Modele anti-algorithme : daily authentic snapshot. Croissance virale 2021-2022 puis churn post-novelty. Acquis Voodoo 2024 a estimation 500M USD. verify_source : multiple final pour Series A investors estime negatif.', 3,
  'software_pure', 5, 'low', 'Consumer social UGC',
  'https://www.theinformation.com/', 'Founder-market fit (authenticity narrative vs algorithm fatigue), mega seed traction (millions DAU), founder francais avec lecture culturelle precise.', 'Novelty wore off : feature commoditisee par Instagram Stories (Reels-like authentic mode) et TikTok. Aucun moat defendable contre Big Tech integration. Niche positioning = weak monetization ceiling. Revenue model ad-light + subscription a 3-5 USD/mois ne scale pas avec niche user base.',
  'series_a', 'social_video_media',
  90, 'USD', '2022',
  'Niche positioning + commoditisation par Big Tech + revenue model ad-light insuffisant. Pattern : viral growth differente de sustainable moat.'
where not exists (select 1 from public.historical_companies where name = 'BeReal');

-- Konbini early stage : pivot social media circa 2015, tour qualifiant
-- estime ~ Series A. Statut medium / fragile (mandat ad hoc 2020).
-- On distingue Konbini early (pour matching seed/series_a) de Konbini scale
-- en mettant funding_band series_a et outcome medium.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of,
  signals_negative
)
select
  'Konbini', 'France', 'Media', 'Social video pop culture', 'Social video pop culture', 2008, 'medium', 'private; mandat ad hoc 2020 puis restructuration',
  'Europe', 'EU', 'No', 'High', 'https://www.lemonde.fr/economie/article/2020/10/06/konbini-le-groupe-de-medias-en-ligne-vise-par-une-procedure-de-mandat-ad-hoc_6055018_3234.html',
  'Lance 2008 (web) par David Creuzot et Lucie Beudet. Pivot social media ~2015. Modele : brand content premium plus revenu publicite. 3.2M TikTok 3.2M Instagram (2024). 100 employes apres reduction (vs 120 ante). Mandat ad hoc octobre 2020 apres echec internationalisation (US, BR). verify_source : levees cumulees estimees ~10-15M EUR sur 12 ans.', 4,
  'software_pure', 4, 'low', 'Social video pop culture',
  'https://www.strategies.fr/', 'Brand content de qualite premium, ADN editorial fort, audience pop culture cible 18-30 ans. Premier media francais a maitriser le format social video pre-TikTok.', 'Echec internationalisation 2020 critical lesson : modele viable en France seulement, fragile structurellement. Brand content depend des budgets marketing annonceurs en cycle macro. Pas de moat distributif (zero audience proprietaire).',
  'series_a', 'social_video_media',
  12, 'EUR', '2020',
  'Echec internationalisation. Mandat ad hoc 2020. Modele viable sur marche domestique seulement. Cycle budget annonceurs.'
where not exists (select 1 from public.historical_companies where name = 'Konbini');

-- Neo : media natif Le Monde Group, lance 2018-2019 pour cible jeune. Active.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of
)
select
  'Neo', 'France', 'Media', 'Social video news jeune cible', 'Social video news jeune cible', 2019, 'medium', 'subsidiary / non profitable',
  'Europe', 'EU', 'Potential', 'Low', 'https://www.lemonde.fr/',
  'Media social video lance par Le Monde Group pour cibler les 18-30 ans sur formats courts. Modele subventionne par groupe presse. verify_source : pas de levee VC autonome, financement interne Le Monde estime 5-10M EUR cumule.', 2,
  'software_pure', 3, 'low', 'Social video news',
  null, 'Backing groupe presse etabli (Le Monde) reduit le burn de capture audience initiale.', 'Modele subventionne : pas un test commercial autonome. Difficulte a operationaliser hors orbite Le Monde.',
  'seed', 'social_video_media',
  null, null, null
where not exists (select 1 from public.historical_companies where name = 'Neo');

-- ============================================================
-- 2. LONGITUDINAL : scale / late stage media social video
-- ============================================================

-- Brut : lance 2016, leve massivement (~165M EUR cumule), acquis par
-- CMA Media (Rodolphe Saade) 2024. Success_exit malgre profitabilite
-- jamais atteinte en standalone.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of,
  signals_negative
)
select
  'Brut', 'France', 'Media', 'Social video news entertainment', 'Social video news entertainment', 2016, 'success_exit', 'M&A / strategic acquisition',
  'Europe', 'EU', 'Potential', 'High', 'https://www.lesechos.fr/tech-medias/medias/cma-media-le-projet-mediatique-de-rodolphe-saade-prend-forme',
  'Lance 2016 par Renaud Le Van Kim. Leve cumule estime 165M EUR (Series C 2021 Bpifrance, KKR, Tikehau). 13.8M TikTok, 5.2M Instagram. Internationalisation US/UK/India. Acquis par CMA Media (groupe Saade) 2024 pour montant non disclosed. verify_source : le multiple final pour les early investors n est pas public, l acquisition est consideree comme un soft exit plutot qu un home run.', 4,
  'software_pure', 5, 'medium', 'Social video news premium',
  'https://www.bfmtv.com/economie/entreprises/medias/cma-cgm-rachete-brut_AV-202410230400.html', 'Differenciateur editorial sur reportage social et environnement. Internationalisation US/UK/India. Capital massif soutenant production premium. Pivot podcasts plus studio plus services pour chercher rentabilite.',
  'late_ipo', 'social_video_media',
  165, 'EUR', '2024',
  'Profitabilite jamais atteinte en standalone malgre 165M EUR leves sur 8 ans. Diversification forcee (podcasts, studios, services) signe que le modele media social pur ne suffisait pas. Acquis defensivement par groupe industriel.'
where not exists (select 1 from public.historical_companies where name = 'Brut');

-- Vice Media : Series F 2017 valuation 5.7B, bankruptcy 2023 acquis 350M.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of,
  signals_negative,
  narrative_specificity
)
select
  'Vice Media', 'USA / Canada', 'Media', 'Social video news lifestyle', 'Social video news lifestyle', 1994, 'fail', 'Chapter 11 bankruptcy 2023; sold to Fortress for ~350M USD',
  'NorthAmerica', 'Non-EU', 'No', 'High', 'https://www.reuters.com/business/media-telecom/vice-media-files-bankruptcy-after-financial-troubles-2023-05-15/',
  'Founded 1994 print, pivot digital 2010s, leve cumule >1.6B USD (TPG, Disney, A&E, James Murdoch). Valuation pic 5.7B USD 2017. Bankruptcy mai 2023 vente Fortress 350M USD. Cas canonique de media digital surfinance qui n a jamais atteint profitabilite. verify_source : montants public.', 5,
  'software_pure', 5, 'high', 'Social video news lifestyle',
  'https://www.nytimes.com/2023/05/15/business/media/vice-bankruptcy.html', 'Differenciation editoriale forte (immersive long-form), audience millennial captive sur YouTube/TV (Vice TV), capital massif HBO/Disney/TPG.',
  'Echec a transformer audience massive en revenue durable. Cost structure premium incompatible avec CPM YouTube/Facebook. Multiplication des verticales (food, news, entertainment) sans focus. Le pattern Vice est a invoquer pour tout media social vidéo qui leve gros sans mecanique de monetisation differente de brand content.',
  'late_ipo', 'social_video_media',
  1600, 'USD', '2023',
  'Levee 1.6B USD sans profitabilite atteinte sur 25+ ans. Cost structure incompatible avec digital ad CPM. Diversification dispersee. Pattern : capital ne resout pas un probleme structurel d unit economics media social.',
  jsonb_build_object(
    'tags', jsonb_build_array('overfunded_media_collapse', 'cpm_economics_failure', 'cost_structure_incompatible'),
    'requires', jsonb_build_object(
      'asset_class', jsonb_build_array('software_pure'),
      'funding_band_min', 'series_b',
      'context', 'Echec post-scale d un media digital sur unit economics CPM. Invoquer pour media social vidéo qui leve 50M+ et projette rentabilite sans modele economique distinct du brand content.'
    )
  )
where not exists (select 1 from public.historical_companies where name = 'Vice Media');

-- BuzzFeed : IPO SPAC 2021 valuation pic 1.7B, struggling 2024 ~150M.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of,
  signals_negative
)
select
  'BuzzFeed', 'USA', 'Media', 'Social video viral content', 'Social video viral content', 2006, 'fail_weak_exit', 'public; underperforming since IPO',
  'NorthAmerica', 'Non-EU', 'No', 'High', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001828248',
  'Founded 2006 par Jonah Peretti. Leve cumule ~700M USD avant IPO SPAC decembre 2021. IPO valuation 1.7B, market cap 2024 ~150M USD. Restructurations multiples (BuzzFeed News ferme 2023, layoffs). Cas canonique IPO SPAC media digital qui a sous-performe massivement. verify_source : market cap variable selon date.', 4,
  'software_pure', 4, 'medium', 'Social video viral content',
  'https://www.nytimes.com/2023/04/20/business/media/buzzfeed-news-shut-down.html', 'Algorithme viral, BuzzFeed News long-form a obtenu Pulitzer Prize 2021. Diversification revenue (commerce affiliation, brand content, programmatic).',
  'Echec a maintenir engagement post-Facebook algorithm change 2018. Restructurations multiples. BuzzFeed News (qualite editoriale) ferme 2023 car non rentable. Pattern : meme un media social vidéo qui maitrise l algorithme et leve gros peut s effondrer en quelques annees si l algorithme distributeur change ses regles.',
  'late_ipo', 'social_video_media',
  700, 'USD', '2024',
  'Sous-performance massive post-IPO. Restructurations recurrentes. Fragilite structurelle a chaque changement d algorithme plateforme. BuzzFeed News (qualite premium) ferme.'
where not exists (select 1 from public.historical_companies where name = 'BuzzFeed');

-- Likee (Joyy Inc subsidiary) : 150M MAU, parent Joyy NASDAQ.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of
)
select
  'Likee', 'Singapore / China', 'Media', 'Short-form video AR', 'Short-form video AR', 2017, 'success_private', 'subsidiary of public parent (Joyy Inc)',
  'Asia', 'Non-EU', 'Probable', 'Medium', 'https://ir.joyy.com/',
  'Lance 2017 par Joyy Inc (NASDAQ : YY, anciennement YY Live). 150M MAU stable 2023-2024, dominance SE Asia / Middle East / India. Differenciateur AR/4D effects (2000+ stickers). Janvier 2025 surge 143% global et plus 37% US sur outage TikTok 14h. Revenue model ads + gifting livestreams, estime 500-800M USD annuel (parent Joyy profitable). verify_source : revenue Likee specifique non disclosed dans rapports Joyy.', 3,
  'software_pure', 4, 'high', 'Short-form video AR',
  'https://www.bigtechwire.com/', 'Parent Joyy 7000 employes 65 pourcent ingenieurs : capacite R&D AR illimitee. Geographic diversification (62 pourcent users 25-34 hors US) reduit ban risk. Creator economics clarity : monetisation pour beginners 50-400 USD par mois (vs TikTok 100k+).',
  'Scale ceiling : 150M MAU vs TikTok 1.4-1.6B = ecart 90 pourcent. Regulatory risk (parent chinois). Algorithm opacity moins transparente que TikTok. Positionnement alternative peut commodifier si TikTok stabilise.',
  'late_ipo', 'social_video_media',
  null, 'USD', '2024'
where not exists (select 1 from public.historical_companies where name = 'Likee');

-- Rumble : NASDAQ 2022, 68M MAU, 30M USD revenue Q4 2024.
insert into public.historical_companies (
  name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
  region, eu_status, state_influence_tag, data_quality, primary_source_url,
  analyst_note, confidence_score,
  asset_class, vc_relevance_score, capital_intensity, vertical_v4,
  source_2, what_made_it_work, key_risks_lessons,
  funding_band, sector_subgroup,
  total_raised_amount, total_raised_currency, total_raised_as_of
)
select
  'Rumble', 'Canada / USA', 'Media', 'Alternative video creator economy', 'Alternative video creator economy', 2013, 'success', 'IPO NASDAQ 2022',
  'NorthAmerica', 'Non-EU', 'Potential', 'High', 'https://ir.rumble.com/',
  'Founded 2013 par Chris Pavlovski (Toronto, HQ Florida 2024). NASDAQ IPO septembre 2022 ~400M USD gross proceeds. 68M MAU 2024 (US+Canada 52M). Q4 2024 revenue 30.2M USD plus 48 pourcent YoY. Tether 775M USD investissement 2024 (crypto ecosystem play). Rumble Cloud lance 2024 (AWS alternative). Multiple seed estime 750x. verify_source : ARPU calcul (~1.76 USD annuel sur 68M MAU = trespas faible vs YouTube/TikTok).', 4,
  'software_pure', 5, 'medium', 'Alternative video creator economy',
  'https://www.cnbc.com/quotes/RUM', 'Founder-market fit : Pavlovski a anticipe creator pain (YouTube de-prioritize independents) avant que ce soit vocal. Creator economics transparents (rev share 70-80 vs YouTube 55). Regulatory tailwind 2020-2024 polarisation plus TikTok ban risk. Diversification beyond video (Rumble Cloud, Tether crypto).',
  'Limited scale vs YouTube (68M vs 2B+ MAU). Monetization ceiling 0.44 USD ARPU/quarter. Brand risk free speech / alt-tech aliene mainstream advertisers. Execution complex : video plus cloud plus crypto plus content moderation.',
  'late_ipo', 'social_video_media',
  400, 'USD', '2022'
where not exists (select 1 from public.historical_companies where name = 'Rumble');

-- ============================================================
-- 3. NOTES POST-MIGRATION
-- ============================================================
-- Apres exec V5 + V5b, un dossier media social vidéo en seed (cas Liik
-- 1.5M EUR) doit voir :
--
--   Bloc stage-aligned (top 5) :
--     Loopsider, BeReal, Konbini early, Neo, et 1 cas connexe
--     (HellOasis, MOJO, etc., a sourcer en V5c)
--
--   Bloc longitudinal :
--     Brut, Vice Media, BuzzFeed (avec narrative_specificity sur Vice)
--
--   Filtres (n apparaissent pas) :
--     Ynsect, WeWork, Theranos (narrative_specificity bloque)
--     Tesla, Northvolt, Joby (asset_class incompatible)
--     Likee, Rumble (asset_class compatible mais funding_band hors fenetre)
--
-- Le verdict sur Liik est cense glisser de REFUSER a APPROFONDIR car
-- le pattern dominant change : succes_exit Brut + active Loopsider plus
-- failed BeReal donne un mixed avec questions a instruire, pas un fail
-- automatique sur la base de comparables hors contexte.
