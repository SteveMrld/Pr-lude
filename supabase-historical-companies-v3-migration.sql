-- ============================================================
-- HISTORICAL COMPANIES V3 - MIGRATION
-- ------------------------------------------------------------
-- Etend la table avec les colonnes de PULSAR V3 :
--   region              : Europe / US / Asia / Israel / NorthAmerica / Global
--   eu_status           : EU / Non-EU / Non-EU mixed
--   state_influence_tag : No / Potential / Probable / Yes/Probable
--   data_quality        : High / Medium / Low
--   primary_source_url  : URL de reference
--   analyst_note        : note narrative (remplace signals_positive/negative
--                         pour les nouvelles lignes qui ne les ont pas)
--   subsector           : sous-categorie precise (ex: Foundation models)
--
-- Strategie : ALTER TABLE pour ajouter les colonnes (idempotent),
-- puis WIPE + RESEED de toute la table avec les 129 lignes V3.
-- Les anciennes lignes V1 sont reinsères avec leurs scores existants
-- conserves (Adyen, Spotify, Sigfox, etc. sont aussi dans V3).
-- ============================================================

-- 1. Ajout colonnes V3 (idempotent)
alter table public.historical_companies add column if not exists region text;
alter table public.historical_companies add column if not exists eu_status text;
alter table public.historical_companies add column if not exists state_influence_tag text;
alter table public.historical_companies add column if not exists data_quality text;
alter table public.historical_companies add column if not exists primary_source_url text;
alter table public.historical_companies add column if not exists analyst_note text;
alter table public.historical_companies add column if not exists subsector text;

-- 2. Wipe et reseed
truncate table public.historical_companies;

-- 3. Insertion V3 - 129 lignes
insert into public.historical_companies
  (name, country, sector, sub_sector, subsector, founded, outcome, exit_type,
   region, eu_status, state_influence_tag, data_quality, primary_source_url, analyst_note,
   confidence_score)
values
  ('Adyen', 'Netherlands', 'Fintech', 'Payments', 'Payments', null, 'success', 'IPO', 'Europe', 'EU', 'No', 'High', 'https://www.adyen.com/ir', 'European payments infrastructure winner; compare with Stripe/Checkout.com.', 4),
  ('Spotify', 'Sweden', 'Consumer', 'Streaming', 'Streaming', null, 'success', 'Direct listing', 'Europe', 'EU', 'No', 'High', 'https://investors.spotify.com/financials/default.aspx', 'Founder/product/timing pattern for consumer subscription platform.', 4),
  ('UiPath', 'Romania/US', 'Enterprise Software', 'Automation/RPA', 'Automation/RPA', null, 'success', 'IPO', 'Europe', 'Non-EU mixed', 'No', 'High', 'https://investor.uipath.com/financials/sec-filings/default.aspx', 'Romanian-origin automation company; useful EU-to-US scaling case.', 4),
  ('Klarna', 'Sweden', 'Fintech', 'BNPL', 'BNPL', null, 'volatile_private', 'Private/secondary', 'Europe', 'EU', 'No', 'Medium', 'https://www.klarna.com/international/press/', 'Important positive + drawdown/valuation volatility case.', 3),
  ('Dataiku', 'France', 'AI', 'Enterprise AI/MLOps', 'Enterprise AI/MLOps', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.dataiku.com/news/', 'Enterprise AI platform; active late-stage case.', 3),
  ('Doctolib', 'France', 'Healthtech', 'Care access/SaaS', 'Care access/SaaS', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://about.doctolib.com/news/', 'Healthtech network effects + regulation.', 3),
  ('Alan', 'France', 'Insurtech', 'Health insurance', 'Health insurance', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://alan.com/press', 'Regulated fintech/health insurance.', 3),
  ('BlaBlaCar', 'France', 'Mobility', 'Marketplace', 'Marketplace', null, 'medium', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://blog.blablacar.com/newsroom', 'European network effects, monetization friction.', 3),
  ('Deezer', 'France', 'Consumer', 'Streaming', 'Streaming', null, 'medium', 'SPAC/IPO', 'Europe', 'EU', 'No', 'High', 'https://www.deezer-investors.com/', 'Useful counterexample vs Spotify.', 4),
  ('OVHcloud', 'France', 'Cloud', 'Infrastructure', 'Infrastructure', null, 'medium', 'IPO', 'Europe', 'EU', 'No', 'High', 'https://corporate.ovhcloud.com/en/investor-relations/', 'European sovereign cloud vs hyperscalers.', 4),
  ('Sigfox', 'France', 'IoT', 'Connectivity', 'Connectivity', null, 'fail_uncertain', 'Receivership/acquisition', 'Europe', 'EU', 'No', 'Medium', 'https://www.sigfox.com/news/', 'Deeptech/IoT cautionary case: CAPEX + business model.', 3),
  ('Ynsect', 'France', 'Greentech', 'Alternative protein/agritech', 'Alternative protein/agritech', null, 'fail_uncertain', 'Restructuring', 'Europe', 'EU', 'No', 'Medium', 'https://ynsect.com/news/', 'Industrial scale-up risk; do not classify as success.', 3),
  ('Take Eat Easy', 'Belgium', 'Mobility/Food', 'Delivery', 'Delivery', null, 'fail', 'Liquidation', 'Europe', 'EU', 'No', 'High', 'https://techcrunch.com/2016/07/26/take-eat-easy-shuts-down/', 'Unit economics failure; include as negative example.', 4),
  ('Cazoo', 'UK', 'Mobility/Ecommerce', 'Online car retail', 'Online car retail', null, 'fail_uncertain', 'SPAC/IPO then administration', 'Europe', 'Non-EU', 'No', 'High', 'https://investors.cazoo.co.uk/', 'Burn-heavy auto ecommerce cautionary case.', 4),
  ('Gorillas', 'Germany', 'Mobility/Food', 'Quick commerce', 'Quick commerce', null, 'fail_weak_exit', 'Acquisition', 'Europe', 'EU', 'No', 'Medium', 'https://www.getir.com/news/', 'Quick commerce unit economics failure case.', 3),
  ('N26', 'Germany', 'Fintech', 'Neobank', 'Neobank', null, 'active', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://n26.com/en-eu/press', 'Regulatory risk + monetization case.', 3),
  ('Revolut', 'UK', 'Fintech', 'Neobank/super-app', 'Neobank/super-app', null, 'success_private', 'Private', 'Europe', 'Non-EU', 'No', 'Medium', 'https://www.revolut.com/news/', 'High-growth fintech, regulatory risk.', 3),
  ('Back Market', 'France', 'Marketplace', 'Refurbished electronics', 'Refurbished electronics', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.backmarket.com/en-us/c/newsroom', 'Circular economy marketplace.', 3),
  ('Vinted', 'Lithuania', 'Marketplace', 'Secondhand fashion', 'Secondhand fashion', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.vinted.com/newsroom', 'Network effects + consumer marketplace.', 3),
  ('Contentsquare', 'France', 'SaaS', 'Digital experience analytics', 'Digital experience analytics', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://contentsquare.com/press/', 'B2B SaaS scale-up.', 3),
  ('Checkout.com', 'UK', 'Fintech', 'Payments', 'Payments', null, 'success_private', 'Private', 'Europe', 'Non-EU', 'No', 'Medium', 'https://www.checkout.com/newsroom', 'Payments infrastructure; compare Stripe/Adyen.', 3),
  ('Wise', 'UK', 'Fintech', 'FX/payments', 'FX/payments', null, 'success', 'Direct listing', 'Europe', 'Non-EU', 'No', 'High', 'https://wise.com/owners/', 'Strong product-led fintech economics.', 4),
  ('Delivery Hero', 'Germany', 'Mobility/Food', 'Delivery marketplace', 'Delivery marketplace', null, 'volatile_private', 'IPO', 'Europe', 'EU', 'No', 'High', 'https://www.deliveryhero.com/investor-relations/', 'Scale marketplace with profitability challenges.', 4),
  ('Zalando', 'Germany', 'E-commerce', 'Fashion retail', 'Fashion retail', null, 'success', 'IPO', 'Europe', 'EU', 'No', 'High', 'https://corporate.zalando.com/en/investor-relations', 'European ecommerce winner.', 4),
  ('HelloFresh', 'Germany', 'Foodtech', 'Meal kits', 'Meal kits', null, 'success', 'IPO', 'Europe', 'EU', 'No', 'High', 'https://ir.hellofreshgroup.com/', 'Subscription food logistics case.', 4),
  ('King', 'Sweden/UK', 'Gaming', 'Mobile games', 'Mobile games', null, 'success', 'Acquisition', 'Europe', 'Non-EU mixed', 'No', 'High', 'https://investor.activision.com/news-releases/news-release-details/activision-blizzard-completes-king-acquisition', 'Hit-driven gaming exit case.', 4),
  ('Supercell', 'Finland', 'Gaming', 'Mobile games', 'Mobile games', null, 'success', 'Majority acquisition', 'Europe', 'EU', 'Potential', 'Medium', 'https://supercell.com/en/news/', 'Small-team, high-ROI gaming model.', 3),
  ('Just Eat', 'UK', 'Mobility/Food', 'Food delivery marketplace', 'Food delivery marketplace', null, 'success', 'IPO/M&A', 'Europe', 'Non-EU', 'No', 'High', 'https://www.justeattakeaway.com/investors/', 'Marketplace aggregation case.', 4),
  ('Farfetch', 'UK', 'E-commerce', 'Luxury marketplace', 'Luxury marketplace', null, 'fail_uncertain', 'IPO then rescue/acquisition', 'Europe', 'Non-EU', 'No', 'High', 'https://www.farfetchinvestors.com/', 'Luxury marketplace / public market cautionary case.', 4),
  ('Glovo', 'Spain', 'Mobility/Food', 'Delivery', 'Delivery', null, 'success_exit', 'Acquisition', 'Europe', 'EU', 'No', 'Medium', 'https://about.glovoapp.com/en/newsroom/', 'European delivery consolidation case.', 3),
  ('Auto1', 'Germany', 'Mobility/Ecommerce', 'Used car marketplace', 'Used car marketplace', null, 'medium', 'IPO', 'Europe', 'EU', 'No', 'High', 'https://ir.auto1-group.com/', 'Used car marketplace / margin challenge.', 4),
  ('Vestiaire Collective', 'France', 'Marketplace', 'Luxury resale', 'Luxury resale', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.vestiairecollective.com/journal/press/', 'Circular fashion marketplace.', 3),
  ('ManoMano', 'France', 'E-commerce', 'DIY marketplace', 'DIY marketplace', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.manomano.com/press', 'Vertical marketplace.', 3),
  ('Sorare', 'France', 'Web3/Gaming', 'Fantasy sports NFT', 'Fantasy sports NFT', null, 'volatile_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://sorare.com/blog', 'Speculative cycle + sports licensing.', 3),
  ('Ledger', 'France', 'Cybersecurity/Crypto', 'Hardware wallet', 'Hardware wallet', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.ledger.com/press', 'Hardware security, crypto cycle.', 3),
  ('Mirakl', 'France', 'SaaS', 'Marketplace infrastructure', 'Marketplace infrastructure', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.mirakl.com/news', 'Enterprise marketplace SaaS.', 3),
  ('Algolia', 'France/US', 'SaaS', 'Search/API', 'Search/API', null, 'success_private', 'Private', 'Europe', 'Non-EU mixed', 'No', 'Medium', 'https://www.algolia.com/about/news/', 'Developer-first SaaS/API.', 3),
  ('Aircall', 'France/US', 'SaaS', 'Cloud communications', 'Cloud communications', null, 'success_private', 'Private', 'Europe', 'Non-EU mixed', 'No', 'Medium', 'https://aircall.io/newsroom/', 'SaaS communications.', 3),
  ('Qonto', 'France', 'Fintech', 'SME banking', 'SME banking', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://qonto.com/en/press', 'SMB fintech + regulatory moat.', 3),
  ('Spendesk', 'France', 'Fintech', 'Spend management', 'Spend management', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.spendesk.com/press/', 'B2B fintech / spend management.', 3),
  ('Stripe', 'US/Ireland', 'Fintech', 'Payments', 'Payments', null, 'success_private', 'Private/secondary', 'Europe', 'Non-EU mixed', 'No', 'Medium', 'https://stripe.com/newsroom', 'Core US/EU payments benchmark.', 3),
  ('Airbnb', 'US', 'Marketplace', 'Travel marketplace', 'Travel marketplace', null, 'success', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://www.sec.gov/Archives/edgar/data/1559720/000119312520294801/d81668ds1.htm', 'Marketplace/network effects winner.', 4),
  ('Uber', 'US', 'Mobility', 'Ride-hailing/delivery', 'Ride-hailing/delivery', null, 'volatile_private', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://investor.uber.com/financials/default.aspx', 'Blitzscaling + unit economics case.', 4),
  ('Snowflake', 'US', 'Enterprise Software', 'Cloud data warehouse', 'Cloud data warehouse', null, 'success', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://investors.snowflake.com/financials/sec-filings/default.aspx', 'Enterprise data infrastructure IPO winner.', 4),
  ('Datadog', 'US', 'Enterprise Software', 'Observability', 'Observability', null, 'success', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://investors.datadoghq.com/financials/sec-filings/default.aspx', 'Developer-led SaaS infrastructure.', 4),
  ('Palantir', 'US', 'AI/Data', 'Data analytics/defense', 'Data analytics/defense', null, 'success', 'Direct listing', 'US', 'Non-EU', 'No', 'High', 'https://www.sec.gov/Archives/edgar/data/1321655/000119312520230013/d904406ds1.htm', 'Defense/government + enterprise data platform.', 4),
  ('Coinbase', 'US', 'Crypto/Fintech', 'Exchange', 'Exchange', null, 'volatile_private', 'Direct listing', 'US', 'Non-EU', 'No', 'High', 'https://investor.coinbase.com/financials/sec-filings/default.aspx', 'Crypto cycle + compliance.', 4),
  ('DoorDash', 'US', 'Mobility/Food', 'Delivery marketplace', 'Delivery marketplace', null, 'volatile_private', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://ir.doordash.com/financials/sec-filings/default.aspx', 'Food delivery unit economics + scale.', 4),
  ('Zoom', 'US', 'SaaS', 'Video communications', 'Video communications', null, 'success', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://investors.zoom.us/financials/sec-filings/default.aspx', 'Product-led SaaS, pandemic acceleration.', 4),
  ('Slack', 'US', 'SaaS', 'Work collaboration', 'Work collaboration', null, 'success', 'Direct listing + acquisition', 'US', 'Non-EU', 'No', 'High', 'https://investor.salesforce.com/press-releases/press-release-details/2021/Salesforce-Completes-Acquisition-of-Slack/default.aspx', 'Collaboration SaaS, strategic M&A.', 4),
  ('CrowdStrike', 'US', 'Cybersecurity', 'Endpoint/cloud security', 'Endpoint/cloud security', null, 'success', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://ir.crowdstrike.com/sec-filings', 'Cybersecurity cloud-native winner.', 4),
  ('Zscaler', 'US', 'Cybersecurity', 'Cloud security/SASE', 'Cloud security/SASE', null, 'success', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://ir.zscaler.com/financials/sec-filings/default.aspx', 'SASE/cloud security winner.', 4),
  ('Okta', 'US', 'Cybersecurity', 'Identity', 'Identity', null, 'success', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://investor.okta.com/financials/sec-filings/default.aspx', 'Identity security platform.', 4),
  ('Mandiant', 'US', 'Cybersecurity', 'Threat intelligence/incident response', 'Threat intelligence/incident response', null, 'success', 'Acquisition', 'US', 'Non-EU', 'No', 'High', 'https://cloud.google.com/blog/products/identity-security/google-completes-mandiant-acquisition', 'Strategic cyber acquisition.', 4),
  ('Proofpoint', 'US', 'Cybersecurity', 'Email security', 'Email security', null, 'success', 'Take-private acquisition', 'US', 'Non-EU', 'No', 'High', 'https://www.proofpoint.com/us/newsroom/press-releases/proofpoint-completes-acquisition-thoma-bravo', 'Cybersecurity take-private outcome.', 4),
  ('Wiz', 'Israel/US', 'Cybersecurity', 'Cloud security', 'Cloud security', null, 'success', 'Acquisition', 'Israel', 'Non-EU', 'No', 'High', 'https://blog.google/company-news/inside-google/company-announcements/google-agreement-acquire-wiz/', 'Massive cloud-security exit; include completion source too.', 4),
  ('Auth0', 'Canada/US', 'Cybersecurity', 'Identity/customer IAM', 'Identity/customer IAM', null, 'success', 'Acquisition', 'NorthAmerica', 'Non-EU', 'No', 'High', 'https://auth0.com/blog/okta-auth0-announcement/', 'Identity security strategic exit.', 4),
  ('SentinelOne', 'US', 'Cybersecurity', 'Endpoint/XDR', 'Endpoint/XDR', null, 'volatile_private', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://investors.sentinelone.com/financials/sec-filings/default.aspx', 'AI endpoint security IPO case.', 4),
  ('Snyk', 'UK/US', 'Cybersecurity', 'Developer security', 'Developer security', null, 'success_private', 'Private', 'US', 'Non-EU', 'No', 'Medium', 'https://snyk.io/news/', 'Developer security private scale-up.', 3),
  ('Tanium', 'US', 'Cybersecurity', 'Endpoint management/security', 'Endpoint management/security', null, 'success_private', 'Private', 'US', 'Non-EU', 'No', 'Medium', 'https://www.tanium.com/newsroom/', 'Endpoint platform; private long-duration case.', 3),
  ('OpenAI', 'US', 'AI', 'Foundation models', 'Foundation models', null, 'success_private', 'Private/strategic investment', 'US', 'Non-EU', 'No', 'High', 'https://blogs.microsoft.com/blog/2023/01/23/microsoftandopenaiextendpartnership/', 'Foundation model lab; governance/economic terms complex.', 4),
  ('Anthropic', 'US', 'AI', 'Foundation models', 'Foundation models', null, 'success_private', 'Private/strategic investment', 'US', 'Non-EU', 'No', 'High', 'https://www.anthropic.com/news/anthropic-amazon-compute', 'Foundation model lab; cloud-provider financing pattern.', 4),
  ('Scale AI', 'US', 'AI', 'Data labeling/AI infrastructure', 'Data labeling/AI infrastructure', null, 'success_private', 'Private', 'US', 'Non-EU', 'No', 'Medium', 'https://scale.com/newsroom', 'AI data infrastructure.', 3),
  ('Databricks', 'US', 'AI/Data', 'Lakehouse/data platform', 'Lakehouse/data platform', null, 'success_private', 'Private', 'US', 'Non-EU', 'No', 'Medium', 'https://www.databricks.com/company/newsroom', 'AI/data infrastructure late-stage case.', 3),
  ('Anduril', 'US', 'AI/Defense', 'Autonomous defense systems', 'Autonomous defense systems', null, 'success_private', 'Private/funding', 'US', 'Non-EU', 'No', 'High', 'https://www.reuters.com/business/anduril-secures-305-billion-valuation-latest-fund-raise-2025-06-05/', 'Defense AI; government-contract scaling.', 4),
  ('Shield AI', 'US', 'AI/Defense', 'Autonomous aircraft software', 'Autonomous aircraft software', null, 'success_private', 'Private/funding', 'US', 'Non-EU', 'No', 'High', 'https://shield.ai/shield-ai-raises-240m-at-5-3b-valuation-to-scale-hivemind-enterprise-an-ai-powered-autonomy-developer-platform/', 'Autonomous systems, defense tech.', 4),
  ('Hugging Face', 'US/France', 'AI', 'Open-source AI platform', 'Open-source AI platform', null, 'success_private', 'Private', 'Europe', 'Non-EU mixed', 'No', 'Medium', 'https://huggingface.co/blog', 'Open-source ecosystem/platform dynamics.', 3),
  ('Character.AI', 'US', 'AI', 'Consumer AI/chatbots', 'Consumer AI/chatbots', null, 'active', 'Private/licensing/acqui-hire-like deal', 'US', 'Non-EU', 'No', 'Medium', 'https://blog.character.ai/', 'Consumer AI monetization/retention case.', 3),
  ('Perplexity', 'US', 'AI', 'AI search', 'AI search', null, 'active', 'Private', 'US', 'Non-EU', 'No', 'Medium', 'https://www.perplexity.ai/hub/blog', 'AI search/product-led growth case.', 3),
  ('xAI', 'US', 'AI', 'Foundation models', 'Foundation models', null, 'active', 'Private', 'US', 'Non-EU', 'No', 'Medium', 'https://x.ai/news', 'Foundation model competitor; financing/dependency risk.', 3),
  ('IonQ', 'US', 'Quantum', 'Quantum computing hardware', 'Quantum computing hardware', null, 'volatile_private', 'SPAC/public listing', 'US', 'Non-EU', 'No', 'High', 'https://investors.ionq.com/financials/sec-filings/default.aspx', 'Public quantum pure-play; high uncertainty.', 4),
  ('Rigetti', 'US', 'Quantum', 'Quantum computing hardware', 'Quantum computing hardware', null, 'volatile_private', 'SPAC/public listing', 'US', 'Non-EU', 'No', 'High', 'https://investors.rigetti.com/financials/sec-filings/default.aspx', 'Quantum public-market volatility case.', 4),
  ('D-Wave', 'Canada', 'Quantum', 'Quantum computing hardware/services', 'Quantum computing hardware/services', null, 'volatile_private', 'SPAC/public listing', 'NorthAmerica', 'Non-EU', 'No', 'High', 'https://ir.dwavesys.com/financials/sec-filings/default.aspx', 'Quantum commercialization case.', 4),
  ('PsiQuantum', 'US', 'Quantum', 'Photonic quantum computing', 'Photonic quantum computing', null, 'active', 'Private', 'US', 'Non-EU', 'No', 'Medium', 'https://www.psiquantum.com/news', 'Photonic quantum; long time horizon.', 3),
  ('Quantinuum', 'UK/US', 'Quantum', 'Full-stack quantum', 'Full-stack quantum', null, 'active', 'Private/IPO planned', 'US', 'Non-EU', 'No', 'Medium', 'https://www.reuters.com/business/honeywell-announces-quantinuums-plan-file-ipo-2026-01-14/', 'Full-stack quantum; corporate carveout context.', 3),
  ('Rivian', 'US', 'Greentech/Mobility', 'Electric vehicles', 'Electric vehicles', null, 'volatile_private', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://rivian.com/investors', 'EV capital intensity + public-market volatility.', 4),
  ('Tesla', 'US', 'Greentech/Mobility', 'Electric vehicles/energy', 'Electric vehicles/energy', null, 'success', 'IPO', 'US', 'Non-EU', 'No', 'High', 'https://ir.tesla.com/', 'Canonical EV/energy venture outcome; older benchmark.', 4),
  ('Lucid', 'US', 'Greentech/Mobility', 'Electric vehicles', 'Electric vehicles', null, 'volatile_private', 'SPAC/public listing', 'US', 'Non-EU', 'No', 'High', 'https://ir.lucidmotors.com/financials/sec-filings/default.aspx', 'EV SPAC volatility / capital intensity.', 4),
  ('ChargePoint', 'US', 'Greentech/Mobility', 'EV charging', 'EV charging', null, 'volatile_private', 'SPAC/public listing', 'US', 'Non-EU', 'No', 'High', 'https://investors.chargepoint.com/financials/sec-filings/default.aspx', 'Charging infrastructure public comp.', 4),
  ('Joby Aviation', 'US', 'Mobility', 'eVTOL/aviation', 'eVTOL/aviation', null, 'volatile_private', 'SPAC/public listing', 'US', 'Non-EU', 'No', 'High', 'https://ir.jobyaviation.com/financials/sec-filings/default.aspx', 'Deep mobility certification risk.', 4),
  ('Archer Aviation', 'US', 'Mobility', 'eVTOL/aviation', 'eVTOL/aviation', null, 'volatile_private', 'SPAC/public listing', 'US', 'Non-EU', 'No', 'High', 'https://investors.archer.com/financials/sec-filings/default.aspx', 'Deep mobility certification risk.', 4),
  ('Aurora Innovation', 'US', 'Mobility/AI', 'Autonomous trucking', 'Autonomous trucking', null, 'volatile_private', 'SPAC/public listing', 'US', 'Non-EU', 'No', 'High', 'https://ir.aurora.tech/financials/sec-filings/default.aspx', 'Autonomous mobility timeline risk.', 4),
  ('Cruise', 'US', 'Mobility/AI', 'Autonomous vehicles', 'Autonomous vehicles', null, 'medium', 'Acquisition/investment by GM', 'US', 'Non-EU', 'No', 'Medium', 'https://getcruise.com/news/', 'Autonomous vehicle regulatory/safety risk.', 3),
  ('Waymo', 'US', 'Mobility/AI', 'Autonomous vehicles', 'Autonomous vehicles', null, 'active', 'Alphabet subsidiary/private funding', 'US', 'Non-EU', 'No', 'Medium', 'https://waymo.com/blog/', 'Strategic corporate-backed AV benchmark.', 3),
  ('Shopify', 'Canada', 'SaaS/E-commerce', 'Merchant commerce platform', 'Merchant commerce platform', null, 'success', 'IPO', 'NorthAmerica', 'Non-EU', 'No', 'High', 'https://investors.shopify.com/financials/default.aspx', 'SMB ecommerce infrastructure winner.', 4),
  ('Cohere', 'Canada', 'AI', 'Enterprise foundation models', 'Enterprise foundation models', null, 'active', 'Private', 'NorthAmerica', 'Non-EU', 'No', 'Medium', 'https://cohere.com/blog', 'Enterprise AI model provider.', 3),
  ('Xanadu', 'Canada', 'Quantum', 'Photonic quantum computing', 'Photonic quantum computing', null, 'active', 'Private', 'NorthAmerica', 'Non-EU', 'No', 'Medium', 'https://www.xanadu.ai/newsroom', 'Photonic quantum software/hardware.', 3),
  ('Mobileye', 'Israel', 'Mobility/AI', 'ADAS/autonomous driving', 'ADAS/autonomous driving', null, 'success', 'Acquisition + IPO', 'Israel', 'Non-EU', 'No', 'High', 'https://ir.mobileye.com/financials/sec-filings/default.aspx', 'ADAS and mobility AI benchmark.', 4),
  ('Waze', 'Israel', 'Mobility', 'Navigation/social traffic', 'Navigation/social traffic', null, 'success', 'Acquisition', 'Israel', 'Non-EU', 'No', 'Medium', 'https://blog.google/products/maps/waze-outsmarting-traffic-together/', 'Consumer mobility network effects.', 3),
  ('Monday.com', 'Israel', 'SaaS', 'Work management', 'Work management', null, 'success', 'IPO', 'Israel', 'Non-EU', 'No', 'High', 'https://ir.monday.com/financials/sec-filings/default.aspx', 'SaaS GTM efficiency/product-led case.', 4),
  ('CyberArk', 'Israel', 'Cybersecurity', 'Identity/PAM', 'Identity/PAM', null, 'success', 'IPO', 'Israel', 'Non-EU', 'No', 'High', 'https://investors.cyberark.com/financials/sec-filings/default.aspx', 'Privileged access management winner.', 4),
  ('Grab', 'Singapore', 'Mobility/Fintech', 'Super-app/ride-hailing', 'Super-app/ride-hailing', null, 'volatile_private', 'SPAC/public listing', 'Asia', 'Non-EU', 'No', 'High', 'https://investors.grab.com/financials/sec-filings/default.aspx', 'Super-app scale + profitability path.', 4),
  ('Sea Limited', 'Singapore', 'Gaming/E-commerce/Fintech', 'Digital ecosystem', 'Digital ecosystem', null, 'volatile_private', 'IPO', 'Asia', 'Non-EU', 'No', 'High', 'https://www.sea.com/investor/annualreports', 'Gaming-to-ecommerce platform scaling.', 4),
  ('Flipkart', 'India', 'E-commerce', 'Marketplace', 'Marketplace', null, 'success', 'Majority acquisition/investment', 'Asia', 'Non-EU', 'No', 'High', 'https://corporate.walmart.com/news/2018/08/18/walmart-and-flipkart-announce-completion-of-walmart-investment-in-flipkart-indias-leading-marketplace-ecommerce-platform', 'Major strategic e-commerce outcome.', 4),
  ('Ola Electric', 'India', 'Greentech/Mobility', 'Electric two-wheelers', 'Electric two-wheelers', null, 'success', 'IPO', 'Asia', 'Non-EU', 'No', 'High', 'https://www.olaelectric.com/investor-relations', 'EV two-wheeler capital intensity / subsidy exposure.', 4),
  ('Razorpay', 'India', 'Fintech', 'Payments', 'Payments', null, 'success_private', 'Private', 'Asia', 'Non-EU', 'No', 'Medium', 'https://razorpay.com/newsroom/', 'India payments infrastructure.', 3),
  ('Paytm', 'India', 'Fintech', 'Payments/super-app', 'Payments/super-app', null, 'volatile_private', 'IPO', 'Asia', 'Non-EU', 'No', 'High', 'https://ir.paytm.com/financials', 'Fintech public-market/regulatory volatility.', 4),
  ('Gojek', 'Indonesia', 'Mobility/Fintech', 'Super-app', 'Super-app', null, 'success_exit', 'Merger', 'Asia', 'Non-EU', 'No', 'Medium', 'https://www.gotocompany.com/en/news', 'Super-app merger path.', 3),
  ('Tokopedia', 'Indonesia', 'E-commerce', 'Marketplace', 'Marketplace', null, 'success_exit', 'Merger/acquisition', 'Asia', 'Non-EU', 'No', 'Medium', 'https://www.gotocompany.com/en/news', 'Ecommerce consolidation / strategic capital.', 3),
  ('Coupang', 'South Korea/US', 'E-commerce', 'Retail/logistics', 'Retail/logistics', null, 'success', 'IPO', 'Asia', 'Non-EU', 'No', 'High', 'https://ir.aboutcoupang.com/financials/sec-filings/default.aspx', 'Logistics-heavy ecommerce winner.', 4),
  ('Kakao Mobility', 'South Korea', 'Mobility', 'Ride-hailing/platform', 'Ride-hailing/platform', null, 'active', 'Private', 'Asia', 'Non-EU', 'No', 'Medium', 'https://www.kakaomobility.com/en/news/', 'Mobility platform under local regulatory context.', 3),
  ('Carousell', 'Singapore', 'Marketplace', 'Classifieds/recommerce', 'Classifieds/recommerce', null, 'active', 'Private', 'Asia', 'Non-EU', 'No', 'Medium', 'https://press.carousell.com/', 'Marketplace/recommerce.', 3),
  ('Trax', 'Singapore/Israel', 'AI', 'Retail computer vision', 'Retail computer vision', null, 'active', 'Private', 'Asia', 'Non-EU', 'No', 'Medium', 'https://traxretail.com/news/', 'Computer vision retail analytics.', 3),
  ('Zomato', 'India', 'Food/Mobility', 'Food delivery', 'Food delivery', null, 'volatile_private', 'IPO', 'Asia', 'Non-EU', 'No', 'High', 'https://www.zomato.com/investor-relations', 'Food delivery/quick commerce path.', 4),
  ('ByteDance', 'China', 'AI/Consumer', 'Short video/content platform', 'Short video/content platform', null, 'success_private', 'Private', 'Asia', 'Non-EU', 'Probable', 'Medium', 'https://www.bytedance.com/en/news', 'AI content platform; compare only with China-adjusted lens.', 3),
  ('Alibaba', 'China', 'E-commerce/Cloud', 'Marketplace/cloud/fintech ecosystem', 'Marketplace/cloud/fintech ecosystem', null, 'success', 'IPO', 'Asia', 'Non-EU', 'Yes/Probable', 'High', 'https://www.alibabagroup.com/en-US/ir-filings-sec', 'Historical startup-to-platform; state influence/regulatory context.', 4),
  ('Tencent', 'China', 'Consumer/Platform', 'Social/gaming/payments', 'Social/gaming/payments', null, 'success', 'IPO', 'Asia', 'Non-EU', 'Yes/Probable', 'High', 'https://www.tencent.com/en-us/investors.html', 'Platform winner; state influence context.', 4),
  ('Didi', 'China', 'Mobility', 'Ride-hailing', 'Ride-hailing', null, 'volatile_private', 'IPO/delisting/relisting path', 'Asia', 'Non-EU', 'Yes/Probable', 'High', 'https://ir.didiglobal.com/financials/sec-filings/default.aspx', 'Mobility platform with regulatory shock.', 4),
  ('Meituan', 'China', 'Food/Mobility', 'Local services/delivery', 'Local services/delivery', null, 'success', 'IPO', 'Asia', 'Non-EU', 'Yes/Probable', 'High', 'https://about.meituan.com/en/investor-relations', 'Local services super-app.', 4),
  ('NIO', 'China', 'Greentech/Mobility', 'Electric vehicles', 'Electric vehicles', null, 'volatile_private', 'IPO', 'Asia', 'Non-EU', 'Yes/Probable', 'High', 'https://ir.nio.com/financials/sec-filings/default.aspx', 'EV with government/regulatory/subsidy context.', 4),
  ('XPeng', 'China', 'Greentech/Mobility', 'Electric vehicles', 'Electric vehicles', null, 'volatile_private', 'IPO', 'Asia', 'Non-EU', 'Yes/Probable', 'High', 'https://ir.xiaopeng.com/financials/sec-filings', 'EV public-market volatility.', 4),
  ('CATL', 'China', 'Greentech', 'Batteries', 'Batteries', null, 'success', 'IPO', 'Asia', 'Non-EU', 'Yes/Probable', 'High', 'https://www.catl.com/en/investor_relations/', 'Battery giant; not classic VC-backed benchmark but strategic climate industrial comp.', 4),
  ('SenseTime', 'China', 'AI', 'Computer vision', 'Computer vision', null, 'volatile_private', 'IPO', 'Asia', 'Non-EU', 'Yes/Probable', 'Medium', 'https://www.sensetime.com/en/investor-relations', 'AI/computer vision under geopolitical/regulatory constraints.', 3),
  ('Megvii', 'China', 'AI', 'Computer vision', 'Computer vision', null, 'active', 'Private/IPO attempts', 'Asia', 'Non-EU', 'Yes/Probable', 'Low', 'https://en.megvii.com/news', 'AI + surveillance/regulatory/geopolitical risk.', 2),
  ('Pony.ai', 'China/US', 'Mobility/AI', 'Autonomous driving', 'Autonomous driving', null, 'active', 'Public/private transition', 'Asia', 'Non-EU', 'Yes/Probable', 'Medium', 'https://pony.ai/news/', 'AV under China/US regulatory context.', 3),
  ('Momenta', 'China', 'Mobility/AI', 'Autonomous driving software', 'Autonomous driving software', null, 'active', 'Private', 'Asia', 'Non-EU', 'Yes/Probable', 'Low', 'https://www.momenta.cn/en/news', 'Autonomous driving supplier.', 2),
  ('Horizon Robotics', 'China', 'AI/Mobility', 'Automotive AI chips', 'Automotive AI chips', null, 'success', 'IPO', 'Asia', 'Non-EU', 'Yes/Probable', 'Medium', 'https://www.horizon.cc/en/news', 'Automotive AI semiconductors.', 3),
  ('Mistral AI', 'France', 'AI', 'Foundation models', 'Foundation models', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://mistral.ai/news/', 'European foundation model champion.', 3),
  ('Helsing', 'Germany', 'AI/Defense', 'Defense AI', 'Defense AI', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://helsing.ai/news', 'European defense AI.', 3),
  ('Darktrace', 'UK', 'Cybersecurity/AI', 'AI cyber defense', 'AI cyber defense', null, 'success', 'IPO/take-private', 'Europe', 'Non-EU', 'No', 'High', 'https://ir.darktrace.com/', 'UK cyber/AI exit path.', 4),
  ('Graphcore', 'UK', 'AI/Semiconductors', 'AI chips', 'AI chips', null, 'fail_weak_exit', 'Acquisition', 'Europe', 'Non-EU', 'No', 'Medium', 'https://www.graphcore.ai/posts/softbank-group-acquires-graphcore', 'AI hardware cautionary case.', 3),
  ('Celonis', 'Germany', 'SaaS/AI', 'Process mining', 'Process mining', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.celonis.com/newsroom/', 'European enterprise software scale-up.', 3),
  ('Northvolt', 'Sweden', 'Greentech', 'Batteries', 'Batteries', null, 'fail_uncertain', 'Bankruptcy/restructuring', 'Europe', 'EU', 'No', 'Medium', 'https://northvolt.com/articles/', 'Battery gigafactory / capital intensity failure risk.', 3),
  ('Lilium', 'Germany', 'Mobility', 'eVTOL aviation', 'eVTOL aviation', null, 'fail_uncertain', 'SPAC/public then insolvency/restructuring', 'Europe', 'EU', 'No', 'High', 'https://investors.lilium.com/financials/sec-filings/default.aspx', 'eVTOL capital intensity and certification risk.', 4),
  ('Arrival', 'UK', 'Greentech/Mobility', 'Electric vans/buses', 'Electric vans/buses', null, 'fail_uncertain', 'SPAC/public then administration', 'Europe', 'Non-EU', 'No', 'High', 'https://investors.arrival.com/financials/sec-filings/default.aspx', 'EV manufacturing failure/capital intensity.', 4),
  ('Bolt', 'Estonia', 'Mobility', 'Ride-hailing/delivery', 'Ride-hailing/delivery', null, 'success_private', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://bolt.eu/en/press/', 'European mobility super-app.', 3),
  ('Quantum Motion', 'UK', 'Quantum', 'Silicon quantum computing', 'Silicon quantum computing', null, 'active', 'Private', 'Europe', 'Non-EU', 'No', 'Medium', 'https://quantummotion.tech/news/', 'European quantum hardware.', 3),
  ('Pasqal', 'France', 'Quantum', 'Neutral-atom quantum computing', 'Neutral-atom quantum computing', null, 'active', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://www.pasqal.com/news/', 'European quantum hardware.', 3),
  ('Alice & Bob', 'France', 'Quantum', 'Fault-tolerant quantum computing', 'Fault-tolerant quantum computing', null, 'active', 'Private', 'Europe', 'EU', 'No', 'Medium', 'https://alice-bob.com/newsroom/', 'European quantum hardware/software.', 3);


-- 4. Index sur les nouvelles colonnes
create index if not exists idx_historical_companies_region on public.historical_companies (region);
create index if not exists idx_historical_companies_data_quality on public.historical_companies (data_quality);

