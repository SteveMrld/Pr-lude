-- ============================================================
-- HISTORICAL COMPANIES SCHEMA
-- ------------------------------------------------------------
-- Memoire institutionnelle factuelle : 40 startups europeennes
-- avec leurs scores au moment de l investissement (pas seulement
-- l outcome final). Sert au moteur de comparables historiques
-- pour repondre a la question "ce dossier ressemble a quels
-- cas passes du marche europeen ?".
--
-- Inspiration : PULSAR VC Global Blueprint V1.
-- Principe : ne pas s entrainer que sur les winners. Le corpus
-- contient des successes, des outcomes moyens, des fails et des
-- actifs en cours.
--
-- Confidence score : qualite de l estimation des scores au
-- moment du lever. 5 = source documentaire solide, 1 = inference
-- analytique du chercheur. Tous les scores ci-dessous sont des
-- inferences analytiques V1 qui doivent etre sourcees avant tout
-- usage investisseur.
-- ============================================================

create table if not exists public.historical_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  sector text not null,
  sub_sector text,
  founded integer,
  outcome text not null check (outcome in (
    'success', 'success_private', 'success_exit',
    'medium', 'active',
    'fail', 'fail_uncertain', 'fail_weak_exit',
    'volatile_private'
  )),
  exit_type text, -- IPO, M&A, late_private, shutdown, etc.

  -- 6 dimensions PULSAR au moment du tour qualifiant
  -- (typiquement seriesA ou seriesB selon disponibilite des donnees)
  founder_score integer check (founder_score between 0 and 100),
  market_score integer check (market_score between 0 and 100),
  traction_score integer check (traction_score between 0 and 100),
  deal_score integer check (deal_score between 0 and 100),
  defensibility_score integer check (defensibility_score between 0 and 100),
  risk_score integer check (risk_score between 0 and 100),
  final_score integer check (final_score between 0 and 100),

  signals_positive text,
  signals_negative text,
  notes text,
  source_urls text,
  confidence_score integer check (confidence_score between 1 and 5),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_historical_companies_sector
  on public.historical_companies (sector);
create index if not exists idx_historical_companies_outcome
  on public.historical_companies (outcome);
create index if not exists idx_historical_companies_country
  on public.historical_companies (country);

-- Lecture seule pour les users authentifies (table partagee global,
-- pas de filtrage user_id ou organization_id).
alter table public.historical_companies enable row level security;
create policy "historical_companies_read_all"
  on public.historical_companies for select
  using (true);

-- ============================================================
-- SEED DATA : 40 startups europeennes (PULSAR V1)
-- ============================================================
-- Convention : tous les scores sont des inferences V1 (confidence=2)
-- a sourcer avant usage. Le final_score est calcule selon la formule
-- PULSAR : 0.20*founder + 0.20*market + 0.20*traction + 0.15*deal
-- + 0.15*defensibility - 0.10*risk, arrondi.
-- ============================================================

insert into public.historical_companies
  (name, country, sector, sub_sector, founded, outcome, exit_type,
   founder_score, market_score, traction_score, deal_score, defensibility_score, risk_score,
   final_score, signals_positive, signals_negative, confidence_score)
values
  ('Adyen', 'Netherlands', 'Fintech', 'Payment infrastructure', 2006, 'success', 'IPO',
   88, 90, 85, 82, 88, 45, 83,
   'Repeat fintech founders, marquee enterprise customers, single-platform unification, profitable from early',
   'Long sales cycles, complex regulation, intense incumbent competition', 2),

  ('Spotify', 'Sweden', 'Consumer Platform', 'Music streaming', 2006, 'success', 'Direct listing',
   85, 92, 88, 78, 75, 65, 82,
   'First-mover in legal streaming, label deals secured, viral growth, pricing power',
   'Razor-thin margins on label payouts, label dependence, slow path to profitability', 2),

  ('UiPath', 'Romania', 'Enterprise Automation', 'RPA', 2005, 'success', 'IPO',
   82, 85, 80, 75, 80, 60, 78,
   'Category creator in RPA, top-tier enterprise customers, very high NRR',
   'Long pivot from outsourcing services, intense competition from big tech (Microsoft Power Automate)', 2),

  ('Klarna', 'Sweden', 'Fintech', 'BNPL', 2005, 'success', 'late_private',
   80, 85, 82, 70, 65, 80, 71,
   'Massive consumer brand, retailer network effects, product velocity',
   'BNPL regulation tightening globally, credit losses spiking, valuation compression 2022-2023', 2),

  ('Dataiku', 'France', 'AI SaaS', 'Data science platform', 2013, 'success_private', 'late_private',
   83, 80, 78, 80, 75, 55, 76,
   'Strong product-led growth, top enterprise logos, ecosystem partnerships',
   'Crowded MLOps market, open source pressure, US incumbents (Databricks, DataRobot)', 2),

  ('Doctolib', 'France', 'Healthtech', 'Booking SaaS', 2013, 'success_private', 'late_private',
   85, 82, 80, 78, 80, 60, 77,
   'Massive practitioner adoption France/Germany, two-sided network effects, COVID acceleration',
   'Regulatory exposure, government dependency (DMP), monetization stretch', 2),

  ('Alan', 'France', 'Insurtech', 'Health insurance', 2016, 'success_private', 'late_private',
   82, 78, 70, 75, 75, 62, 72,
   'Tech-first insurer, repeat fintech founder, design-led, employee experience',
   'Capital-intensive, regulatory mandates, slow path to profitability, competition from incumbents going digital', 2),

  ('BlaBlaCar', 'France', 'Marketplace', 'Carpooling', 2006, 'medium', 'late_private',
   78, 80, 82, 72, 78, 55, 75,
   'Strong network effects EU-wide, profitable in core markets, brand recognition',
   'Geographic expansion difficulties (BR, MX, RU), pivot to bus a tough adjacency, monetization challenges', 2),

  ('Deezer', 'France', 'Streaming', 'Music streaming', 2007, 'medium', 'SPAC',
   65, 80, 65, 55, 50, 68, 61,
   'Early mover in France, telco distribution deals, French champion narrative',
   'Lost the global race to Spotify, sub-scale internationally, label payments crushing margins', 2),

  ('OVHcloud', 'France', 'Cloud', 'IaaS', 1999, 'medium', 'IPO',
   70, 75, 70, 60, 70, 70, 63,
   'Sovereign EU cloud narrative, huge owned infrastructure, profitable',
   'Trails AWS/Azure/GCP heavily, fire incident 2021 reputational damage, margin pressure', 2),

  ('Sigfox', 'France', 'IoT', 'LPWAN networks', 2010, 'fail', 'fire_sale',
   60, 55, 50, 55, 45, 88, 53,
   'First-mover in low-power IoT networks, French deep-tech narrative',
   'NB-IoT and LTE-M from telcos crushed the proprietary network thesis, no path to profitability, capital-intensive', 2),

  ('Ynsect', 'France', 'Agritech', 'Insect protein', 2011, 'fail_uncertain', 'restructuring',
   72, 70, 50, 65, 70, 86, 55,
   'Deep-tech IP, regulatory tailwinds (EU novel food), prestige investors',
   'Insect protein adoption much slower than projected, capex blowout on industrial plant, repeated layoffs 2024', 2),

  ('Take Eat Easy', 'Belgium', 'Food Delivery', 'Last-mile food', 2013, 'fail', 'shutdown',
   60, 75, 55, 45, 40, 92, 47,
   'Early entrant in EU food delivery, riders network',
   'Outspent by Deliveroo and Foodora, never reached gross margin viability, ran out of cash 2016', 2),

  ('Cazoo', 'UK', 'E-commerce Auto', 'Used car retail', 2018, 'fail', 'delisted',
   65, 65, 65, 55, 50, 95, 56,
   'Repeat exit founder, fast scaling, marquee VCs, SPAC funding',
   'Massive cash burn on inventory, post-COVID demand collapse, unit economics never proven, delisted 2024', 2),

  ('Gorillas', 'Germany', 'Quick Commerce', '10-min delivery', 2020, 'fail_weak_exit', 'acquired_distress',
   62, 70, 75, 50, 35, 98, 55,
   'Hyper-fast growth, hyped category, blitzscaling playbook',
   'No path to unit economics, CAC unsustainable, category implosion 2022, sold to Getir at 75% discount', 2),

  ('N26', 'Germany', 'Fintech', 'Neobank', 2013, 'active', 'private',
   75, 80, 75, 72, 70, 78, 68,
   'Strong consumer brand EU, mobile-first execution, several million customers',
   'BaFin regulatory cap, repeated AML issues, profitability still elusive', 2),

  ('Revolut', 'UK', 'Fintech', 'Neobank', 2015, 'success_private', 'late_private',
   85, 85, 88, 80, 75, 78, 76,
   'Aggressive product velocity, super-app strategy, large customer base, profitable 2023',
   'Banking license delays in major markets, regulatory scrutiny, governance concerns', 2),

  ('Back Market', 'France', 'Marketplace', 'Refurbished electronics', 2014, 'success_private', 'late_private',
   78, 80, 78, 75, 75, 60, 75,
   'ESG narrative aligned with consumer trends, two-sided marketplace, international expansion',
   'Margin pressure from refurbisher consolidation, brand authenticity battles, US scaling difficult', 2),

  ('Vinted', 'Lithuania', 'Marketplace', 'Secondhand fashion', 2008, 'success_private', 'late_private',
   80, 82, 85, 75, 75, 55, 78,
   'Massive consumer adoption, pure peer-to-peer model, profitable, low CAC',
   'Take rate caps, fraud and counterfeit issues, intense competition (Depop, Wallapop)', 2),

  ('Contentsquare', 'France', 'SaaS Analytics', 'Digital experience', 2012, 'success_private', 'late_private',
   78, 78, 75, 78, 75, 58, 74,
   'Leadership in digital experience analytics, top enterprise logos, global expansion',
   'Crowded analytics space (FullStory, Glassbox), Heap acquisition signals consolidation pressure', 2),

  ('Checkout.com', 'UK', 'Fintech', 'Payment infrastructure', 2012, 'success_private', 'late_private',
   85, 88, 80, 75, 80, 65, 78,
   'Profitable from day one, top-tier enterprise customers, geographic breadth',
   'Valuation cut from $40B to $11B internally 2023, intense competition (Adyen, Stripe)', 2),

  ('Wise', 'UK', 'Fintech', 'Cross-border payments', 2010, 'success', 'IPO',
   85, 85, 82, 78, 80, 55, 78,
   'Cost transparency moat, strong consumer brand, profitable, direct listing successful',
   'Margin compression, fintech competition (Revolut, Remitly), regulation evolving', 2),

  ('Delivery Hero', 'Germany', 'Food Delivery', 'Aggregator', 2011, 'success', 'IPO',
   72, 75, 78, 65, 60, 78, 67,
   'Geographic breadth, M&A roll-up, marquee VCs',
   'Margin pressure, capital-intensive, post-IPO performance volatile, dark stores write-downs', 2),

  ('Zalando', 'Germany', 'E-commerce', 'Fashion retail', 2008, 'success', 'IPO',
   75, 80, 80, 72, 70, 65, 72,
   'Pan-EU brand, fashion category leadership, platform pivot',
   'Margin pressure, returns logistics, marketplace transition slower than peers (ASOS, About You)', 2),

  ('HelloFresh', 'Germany', 'FoodTech', 'Meal kits', 2011, 'success', 'IPO',
   70, 72, 78, 65, 60, 72, 67,
   'Subscription scale, COVID acceleration, brand recognition',
   'High CAC, churn issues, post-COVID normalization, share price collapse 2022-2023', 2),

  ('King', 'Sweden', 'Gaming', 'Mobile gaming', 2003, 'success', 'M&A',
   75, 80, 85, 70, 65, 70, 72,
   'Candy Crush franchise, mobile-first execution, profitable, sold to Activision $5.9B',
   'Hit-driven business model, Candy Crush concentration risk, slow follow-up hits', 2),

  ('Supercell', 'Finland', 'Gaming', 'Mobile gaming', 2010, 'success', 'M&A_majority',
   85, 80, 88, 75, 75, 68, 76,
   'Multiple billion-dollar franchises, small-team culture, exceptional retention',
   'Slowing release cadence, Tencent dependency, mobile gaming market plateau', 2),

  ('Just Eat', 'UK', 'FoodTech', 'Aggregator', 2001, 'success', 'IPO_then_merger',
   72, 75, 80, 70, 65, 68, 71,
   'Early mover advantage, network effects, profitable in core markets',
   'Grubhub merger value-destructive, intense competition (Deliveroo, Uber Eats), share price collapse', 2),

  ('Farfetch', 'UK', 'FashionTech', 'Luxury marketplace', 2007, 'medium', 'rescue_sale',
   72, 75, 70, 65, 60, 82, 65,
   'Luxury category leadership, brand partnerships, marketplace moat',
   'Burnt cash on YNAP integration, China exposure, sold to Coupang at distressed price 2023', 2),

  ('Glovo', 'Spain', 'Delivery', 'Quick commerce', 2015, 'success_exit', 'M&A',
   72, 75, 78, 65, 55, 85, 65,
   'Geographic breadth (LATAM, EMEA), category breadth (food, retail, q-comm), sold to Delivery Hero',
   'Unit economics never proven, repeated layoffs, categorical risk', 2),

  ('Auto1', 'Germany', 'Marketplace Auto', 'Used cars B2B', 2012, 'medium', 'IPO',
   72, 75, 78, 65, 65, 78, 65,
   'European leadership in used car remarketing, scale advantages, IPO 2021',
   'Margin pressure, Cazoo-style exposure to demand normalization, share price under IPO', 2),

  ('Vestiaire Collective', 'France', 'Marketplace Luxury', 'Secondhand luxury', 2009, 'success_private', 'late_private',
   78, 78, 70, 72, 72, 62, 72,
   'Authentication moat, global luxury network effects, ESG narrative',
   'Take rate compression from competition (TheRealReal, Rebag), authentication scaling cost', 2),

  ('ManoMano', 'France', 'E-commerce', 'DIY marketplace', 2013, 'success_private', 'late_private',
   75, 75, 72, 70, 68, 66, 69,
   'DIY category leadership EU, B2B expansion, profitable in France',
   'International expansion challenges (UK, IT, ES), Amazon DIY pressure, supply chain volatility', 2),

  ('Sorare', 'France', 'Web3 Gaming', 'NFT fantasy sports', 2018, 'volatile_private', 'late_private',
   75, 70, 65, 65, 50, 92, 63,
   'Marquee partnerships (NBA, MLB, Premier League), strong fundraise 2021',
   'NFT market collapse 2022, regulatory uncertainty (gambling classification UK/FR), declining DAU 2023-2024', 2),

  ('Ledger', 'France', 'Crypto Hardware', 'Hardware wallets', 2014, 'success_private', 'late_private',
   78, 75, 72, 70, 75, 80, 70,
   'Hardware wallet leadership, brand trust post-FTX, profitable',
   'Crypto market cyclical, brand crisis Connect Recover 2023, regulatory exposure', 2),

  ('Mirakl', 'France', 'SaaS Marketplace', 'Marketplace platform', 2012, 'success_private', 'late_private',
   80, 78, 75, 75, 78, 58, 75,
   'Category creator B2B marketplace SaaS, top retailer logos, profitable',
   'Marketplace pivot wave subsiding, Amazon shadow, shopify competition', 2),

  ('Algolia', 'France', 'SaaS Search', 'Search-as-a-service', 2012, 'success_private', 'late_private',
   78, 75, 75, 72, 70, 62, 72,
   'Developer-led growth, top consumer brand integrations, technical excellence',
   'AI search disruption (vector DB, OpenAI), Elastic and Typesense competition', 2),

  ('Aircall', 'France', 'SaaS', 'Cloud telephony', 2014, 'success_private', 'late_private',
   75, 75, 70, 70, 65, 65, 69,
   'Strong PMF in SMB cloud telephony, channel partnerships (Salesforce, HubSpot)',
   'Enterprise upmarket challenges, RingCentral and Dialpad pressure, AI voice disruption', 2),

  ('Qonto', 'France', 'Fintech', 'SMB neobanking', 2016, 'success_private', 'late_private',
   80, 80, 78, 75, 70, 68, 75,
   'EU SMB neobank leadership, repeat fintech founders, profitable in France',
   'Penta acquisition execution, German market difficult, BaFin regulatory exposure', 2),

  ('Spendesk', 'France', 'Fintech', 'Spend management', 2016, 'success_private', 'late_private',
   78, 75, 72, 72, 68, 68, 71,
   'Strong PMF in EU SMB spend management, Series C 2022 at $1B+',
   'Brex/Ramp pressure, valuation compression, layoffs 2023, slow path to profitability', 2);
