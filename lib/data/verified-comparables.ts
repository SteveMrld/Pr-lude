// ============================================================
// BASE DE CHIFFRES VERIFIES DES COMPARABLES HISTORIQUES
// ------------------------------------------------------------
// PROBLEME RESOLU : sur les premieres analyses (Platypus Craft
// audit du 6 mai 2026), les moteurs Contrarian et Pattern ont
// hallucine des chiffres factuellement faux sur des comparables
// connus :
//   - "Airbnb Seed ~1Md$ (2015) acquihire 20Md$" : faux (seed
//     ~600k$ via Sequoia en 2009, Airbnb est public sur NASDAQ
//     depuis 2020, jamais acquihire)
//   - "Figma Seed ~1Md$ (2015), acquihire 20Md$ (2024)" : faux
//     (seed ~4M$ Index/Greylock 2013, l acquisition Adobe a
//     20Md$ a ete annulee fin 2023, Figma reste independante)
//   - "SpaceX IPO 100Md$" : faux (SpaceX n a jamais fait d IPO,
//     valuation est issue de tender offers prives)
//
// RISQUE METIER : si une note Prelude arrive sur le bureau d un
// fonds qui a co-investi dans le comparable cite (Sequoia pour
// Airbnb, a16z pour Stripe, Index/Greylock pour Figma), un chiffre
// faux detruit toute la credibilite de l outil. Le partner sait
// les vrais chiffres parce qu il etait dans le deal.
//
// SOLUTION : base de chiffres verifies injectee dans les prompts.
// Les moteurs LLM ont l interdiction d utiliser des chiffres non
// listes ici. Pour tout chiffre absent, ils doivent omettre
// (preferer "Airbnb a fait sa seed via Y Combinator avant son
// IPO" plutot qu un montant invente).
//
// MAINTENANCE : chaque entree doit etre verifiable via au moins
// une source publique (Crunchbase, PitchBook, communique
// officiel, S-1 prospectus). Les valuations actuelles bougent et
// doivent etre revues periodiquement. Les chiffres historiques
// (seed, IPO pricing day, peak market cap) sont stables.
// ============================================================

export interface VerifiedComparable {
  name: string;
  founded: number;
  founders?: string;
  sectorAssetClass: string;
  keyMilestones: string;
  currentStatus: string;
  notes?: string;
  /**
   * Si true, le comparable a des chiffres flagges en quarantaine
   * volume 3 (audit Steve) ou des valuations 2025-2026 fragiles.
   * Le LLM peut citer la fiche mais doit eviter les chiffres
   * marques "verifier IR" ou similaires, et inviter le lecteur a
   * verifier source primaire avant diffusion.
   */
  needsExternalCheck?: boolean;
}

/**
 * Base des comparables les plus frequemment cites dans les analyses
 * VC. Une cinquantaine de boites, chiffres verifies fin 2024 / debut
 * 2026. Pour chaque entree :
 *   - founded : annee de fondation
 *   - sectorAssetClass : nature business + modele economique en clair,
 *     pour aider le moteur a calibrer la pertinence
 *   - keyMilestones : 2-4 jalons cles avec chiffres verifies, format
 *     conversationnel pour que le moteur puisse citer directement
 *   - currentStatus : etat 2024-2026 (public, prive, acquired, defunct)
 *   - notes : pieges classiques d hallucination ("ne pas confondre
 *     X avec Y", "n a jamais fait Z")
 */
export const VERIFIED_COMPARABLES: Record<string, VerifiedComparable> = {
  // ============ MARKETPLACE B2C / HOSPITALITY ============
  airbnb: {
    name: 'Airbnb',
    founded: 2008,
    founders: 'Brian Chesky, Joe Gebbia, Nathan Blecharczyk',
    sectorAssetClass: 'marketplace B2C / hospitality / asset-light',
    keyMilestones: 'YC W2009 + seed Sequoia ~615k$ [TechCrunch]. Series A 2010 ~7M$. Series B 2011 ~112M$ a16z + DST valuation ~1,3Md$ [TechCrunch + Crunchbase]. Series E 2015 1,5Md$ General Atlantic valuation ~25,5Md$ [WSJ + Reuters]. IPO NASDAQ:ABNB decembre 2020 pricing 68$/share valuation pricing day ~100Md$ [S-1 SEC].',
    currentStatus: 'Public NASDAQ:ABNB. Market cap a rafraichir par finance tool (variable selon periode 2024-2026).',
    notes: 'Pas d acquihire. Ne pas confondre seed avec rounds ulterieurs. Plateforme d intermediation, pas operateur hotelier.',
  },
  uber: {
    name: 'Uber',
    founded: 2009,
    sectorAssetClass: 'marketplace B2C / mobility / asset-light',
    keyMilestones: 'Seed 2010 ~1.6M$ (First Round, Lowercase). Series A 2011 ~11M$ Benchmark. IPO NYSE:UBER mai 2019 ~45$/share, valuation pricing day ~75Md$.',
    currentStatus: 'Public NYSE:UBER. Market cap variable 2024-2026.',
  },
  doordash: {
    name: 'DoorDash',
    founded: 2013,
    sectorAssetClass: 'marketplace B2C / food delivery',
    keyMilestones: 'YC S2013 seed ~120k$ + Series A 2014 17M$ Sequoia. IPO NYSE:DASH decembre 2020, pricing ~102$/share, valuation pricing day ~39Md$.',
    currentStatus: 'Public NYSE:DASH.',
  },

  // ============ SAAS B2B ============
  stripe: {
    name: 'Stripe',
    founded: 2010,
    sectorAssetClass: 'SaaS B2B / payments infrastructure / capital-efficient',
    keyMilestones: 'YC S2010 + seed ~2M$ a16z, Sequoia, Conway. Series A 2012 ~18M$. Series H 2021 ~600M$ peak valuation 95Md$. Tender 2023 valuation ~50Md$. Tender 2024 valuation ~65Md$.',
    currentStatus: 'Prive. Pas d IPO. Valuation 2024-2026 ~65Md$ (tender offers).',
    notes: 'NE JAMAIS dire "IPO Stripe" : Stripe n a jamais fait d IPO. Investisseurs : a16z, Sequoia, GIC, Allianz X.',
  },
  figma: {
    name: 'Figma',
    founded: 2012,
    sectorAssetClass: 'SaaS B2B / design collaborative / capital-efficient',
    keyMilestones: 'Seed 2013 ~4M$ Index Ventures et Greylock. Series A 2018 ~14M$ Index. Series B 2019 ~25M$ Sequoia. Series C 2020 ~50M$ valuation 2Md$. Series E 2021 ~200M$ valuation 10Md$.',
    currentStatus: 'Prive. Acquisition Adobe annoncee septembre 2022 a 20Md$, ANNULEE decembre 2023 (regulateurs UK CMA et UE). Figma reste independante. Tender 2024 valuation ~12.5Md$.',
    notes: 'NE JAMAIS dire "rachat Adobe 20Md$" sans preciser que c est ANNULE. Figma n a pas ete acquise. Seed ~4M$, pas plus.',
  },
  notion: {
    name: 'Notion',
    founded: 2013,
    founders: 'Ivan Zhao, Simon Last',
    sectorAssetClass: 'SaaS B2B+B2C / productivity / capital efficient',
    keyMilestones: 'Funding 2021 275M$ Coatue + Sequoia valuation 10Md$ [Forbes + TechCrunch].',
    currentStatus: 'Prive. Derniere valuation publique : 10Md$ en 2021. Valuation 2024-2026 inconnue sans source secondaire a verifier.',
    notes: 'Fondation 2013, quasi-faillite 2015, recapitalisation et pivot vers re-launch 2016. Notion n est pas public.',
  },
  datadog: {
    name: 'Datadog',
    founded: 2010,
    sectorAssetClass: 'SaaS B2B / observability monitoring',
    keyMilestones: 'Seed 2010 ~1M$ Index. Series A 2011 ~6M$ Index. IPO NASDAQ:DDOG septembre 2019, pricing ~27$/share, valuation pricing day ~8Md$.',
    currentStatus: 'Public NASDAQ:DDOG. Market cap 2024-2026 variable ~30-50Md$.',
  },
  snowflake: {
    name: 'Snowflake',
    founded: 2012,
    sectorAssetClass: 'SaaS B2B / cloud data warehouse',
    keyMilestones: 'Seed 2012 5M$ Sutter Hill. Series F 2020 ~479M$ valuation ~12Md$. IPO NYSE:SNOW septembre 2020, pricing ~120$/share, valuation pricing day ~33Md$, peak day ~70Md$.',
    currentStatus: 'Public NYSE:SNOW.',
  },
  zoom: {
    name: 'Zoom',
    founded: 2011,
    sectorAssetClass: 'SaaS B2B / video conferencing',
    keyMilestones: 'Series A 2013 ~6M$ Qualcomm Ventures. Series D 2017 ~115M$ Sequoia valuation 1Md$. IPO NASDAQ:ZM avril 2019, pricing ~36$/share, valuation pricing day ~9Md$. Peak market cap 2020 ~160Md$ (COVID).',
    currentStatus: 'Public NASDAQ:ZM. Market cap 2024-2026 ~20-25Md$.',
  },
  slack: {
    name: 'Slack',
    founded: 2009,
    sectorAssetClass: 'SaaS B2B / team messaging',
    keyMilestones: 'Pivot de Tiny Speck (jeu Glitch) en 2013. Series F 2018 ~427M$ valuation ~7Md$. Direct listing NYSE:WORK juin 2019, valuation reference ~16Md$. Acquis par Salesforce decembre 2020/juillet 2021 pour ~27.7Md$.',
    currentStatus: 'Filiale Salesforce depuis juillet 2021. Plus de cotation independante.',
  },
  shopify: {
    name: 'Shopify',
    founded: 2006,
    sectorAssetClass: 'SaaS B2B / e-commerce platform',
    keyMilestones: 'Bootstrapped jusqu en 2009. Series B 2009 ~7M$. IPO NYSE:SHOP / TSX:SHOP mai 2015, pricing 17$/share, valuation pricing day ~1.3Md$. Peak market cap 2021 ~200Md$.',
    currentStatus: 'Public NYSE:SHOP. Market cap 2024-2026 ~80-150Md$ variable.',
  },

  // ============ HARDWARE DEEPTECH / AEROSPACE / EV ============
  spacex: {
    name: 'SpaceX',
    founded: 2002,
    sectorAssetClass: 'hardware deeptech / aerospace / capex lourd / cycle long R&D',
    keyMilestones: 'Fondation 2002 par Elon Musk avec ~100M$ propres. Falcon 1 succes orbital 2008. NASA COTS contract 1.6Md$ 2008. Series E 2015 1Md$ Google + Fidelity valuation ~12Md$. Tenders 2020-2024 valuation progressive : 46Md$ (2020), 100Md$ (2021), 150Md$ (2023), ~210Md$ (2024).',
    currentStatus: 'Prive. Pas d IPO. Valuation 2024-2026 ~210-350Md$ (tender offers).',
    notes: 'NE JAMAIS dire "IPO SpaceX" : SpaceX n a jamais fait d IPO. La valuation est issue de tender offers et secondary sales, pas d un marche public.',
  },
  tesla: {
    name: 'Tesla',
    founded: 2003,
    sectorAssetClass: 'hardware deeptech / automotive EV / capex lourd / cycle long R&D',
    keyMilestones: 'Fondation 2003 Eberhard et Tarpenning. Musk arrive 2004 Series A ~6.5M$. IPO NASDAQ:TSLA juin 2010, pricing 17$/share (split-adjusted ~1.13$), valuation pricing day ~1.7Md$. Peak market cap novembre 2021 ~1.2Tn$.',
    currentStatus: 'Public NASDAQ:TSLA. Market cap 2024-2026 variable 600Md$-1.2Tn$.',
  },
  rivian: {
    name: 'Rivian',
    founded: 2009,
    sectorAssetClass: 'hardware deeptech / automotive EV trucks / capex lourd',
    keyMilestones: 'Fondation 2009 par RJ Scaringe. Series A 2015 ~1.1Md$ cumule pre-IPO. IPO NASDAQ:RIVN novembre 2021, pricing 78$/share, valuation pricing day ~66Md$, peak day ~100Md$.',
    currentStatus: 'Public NASDAQ:RIVN. Market cap 2024-2026 chute massive ~10-20Md$.',
  },
  joby: {
    name: 'Joby Aviation',
    founded: 2009,
    sectorAssetClass: 'hardware deeptech / eVTOL aviation / capex lourd / cycle long certification FAA',
    keyMilestones: 'Fondation 2009 par JoeBen Bevirt. Series C 2020 ~590M$ valuation 2.6Md$. SPAC merger NYSE:JOBY aout 2021, valuation deal ~6.6Md$.',
    currentStatus: 'Public NYSE:JOBY. Market cap 2024-2026 ~3-5Md$.',
  },
  saildrone: {
    name: 'Saildrone',
    founded: 2012,
    sectorAssetClass: 'hardware deeptech / autonomous maritime drones / capex modere / cycle long',
    keyMilestones: 'Fondation 2012 par Richard Jenkins. Series B 2018 ~60M$. Series C 2021 ~100M$ valuation ~1Md$ devient unicorne.',
    currentStatus: 'Prive. Pas d IPO ni acquisition. Valuation 2024-2026 ~1.2Md$ (tender).',
  },
  quantumscape: {
    name: 'QuantumScape',
    founded: 2010,
    sectorAssetClass: 'hardware deeptech / solid-state batteries / capex lourd / cycle long R&D',
    keyMilestones: 'Spinoff Stanford 2010. SPAC merger NYSE:QS novembre 2020 valuation deal ~3.3Md$. Peak market cap decembre 2020 ~50Md$.',
    currentStatus: 'Public NYSE:QS. Market cap 2024-2026 effondre ~3-5Md$.',
  },
  formenergy: {
    name: 'Form Energy',
    founded: 2017,
    sectorAssetClass: 'hardware deeptech / iron-air batteries / capex lourd / cycle long',
    keyMilestones: 'Fondation 2017 Mateo Jaramillo (ex-Tesla). Series E 2024 ~405M$ valuation ~2.6Md$.',
    currentStatus: 'Prive. Valuation 2024-2026 ~2.6Md$.',
  },
  helion: {
    name: 'Helion Energy',
    founded: 2013,
    sectorAssetClass: 'hardware deeptech / fusion energy / capex lourd / cycle long R&D',
    keyMilestones: 'Fondation 2013 par David Kirtley. Series E 2021 ~500M$ Sam Altman + Mithril. Series F 2024 ~425M$ valuation ~5.4Md$.',
    currentStatus: 'Prive.',
    notes: 'Series G-1 2026 500M$ / 15Md$ rapportee mais en quarantaine sans communique officiel triangule.',
    needsExternalCheck: true,
  },
  anduril: {
    name: 'Anduril',
    founded: 2017,
    sectorAssetClass: 'hardware deeptech / defense autonomous systems / capex modere',
    keyMilestones: 'Fondation 2017 par Palmer Luckey. Series E 2022 ~1.48Md$ valuation 8.5Md$. Series F 2024 ~1.5Md$ valuation 14Md$.',
    currentStatus: 'Prive.',
    notes: 'Valuation 2026 60Md$+ rapportee mais en quarantaine sans communique officiel triangule.',
    needsExternalCheck: true,
  },

  // ============ AI / FONDATION MODELS ============
  anthropic: {
    name: 'Anthropic',
    founded: 2021,
    sectorAssetClass: 'AI deeptech / fondation models / capex GPU lourd',
    keyMilestones: 'Fondation 2021 Dario Amodei, Daniela Amodei et autres ex-OpenAI. Series A 2022 ~124M$. Series C 2023 ~450M$ Spark Capital. Investissement Amazon cumule 2023-2024 jusqu a 8Md$. Valuation fin 2024 ~60Md$.',
    currentStatus: 'Prive. Valuation fin 2024 ~60Md$.',
    notes: 'Valuation 2026 380Md$ rapportee mais en quarantaine sans communique officiel triangule. Verifier Anthropic IR avant diffusion.',
    needsExternalCheck: true,
  },
  openai: {
    name: 'OpenAI',
    founded: 2015,
    sectorAssetClass: 'AI deeptech / fondation models / capex GPU lourd',
    keyMilestones: 'Non-profit OpenAI Inc fondee decembre 2015 par Musk, Altman et autres avec engagement 1Md$. OpenAI LP for-profit creee 2019 + 1Md$ Microsoft. 10Md$ Microsoft 2023. Tender octobre 2024 6.6Md$ valuation 157Md$.',
    currentStatus: 'Prive (structure non-profit + LP for-profit). Valuation fin 2024 ~157Md$.',
    notes: 'Valuation 2026 852Md$ rapportee mais en quarantaine sans communique officiel triangule.',
    needsExternalCheck: true,
  },
  mistral: {
    name: 'Mistral AI',
    founded: 2023,
    sectorAssetClass: 'AI deeptech / fondation models open-weights / capex GPU',
    keyMilestones: 'Fondation 2023 Arthur Mensch, Guillaume Lample, Timothee Lacroix (ex-Meta, ex-DeepMind). Seed juin 2023 ~105M$ Lightspeed valuation ~260M$. Series A decembre 2023 ~415M$ valuation ~2Md$. Series B juin 2024 ~600M$ valuation ~6Md$.',
    currentStatus: 'Prive. Valuation 2024 ~6Md$.',
    notes: 'Series C 2025 ASML 1,7Md EUR / 11,7Md EUR rapportee mais en quarantaine sans communique officiel triangule.',
    needsExternalCheck: true,
  },
  huggingface: {
    name: 'Hugging Face',
    founded: 2016,
    sectorAssetClass: 'AI deeptech / ML platform / capital-efficient',
    keyMilestones: 'Fondation 2016 Clement Delangue, Julien Chaumond, Thomas Wolf. Series C 2022 ~100M$ valuation 2Md$. Series D aout 2023 ~235M$ valuation 4.5Md$.',
    currentStatus: 'Prive. Valuation 2024-2026 ~4.5Md$.',
  },

  // ============ FINTECH ============
  coinbase: {
    name: 'Coinbase',
    founded: 2012,
    sectorAssetClass: 'fintech B2C / crypto exchange',
    keyMilestones: 'YC S2012 seed ~600k$. Series E 2018 ~300M$ valuation 8Md$. Direct listing NASDAQ:COIN avril 2021, reference 250$/share, valuation pricing day ~86Md$.',
    currentStatus: 'Public NASDAQ:COIN. Market cap 2024-2026 ~50-90Md$ variable.',
  },
  klarna: {
    name: 'Klarna',
    founded: 2005,
    sectorAssetClass: 'fintech B2C / BNPL',
    keyMilestones: 'Fondation 2005 Sebastian Siemiatkowski. Peak valuation Series H 2021 ~45.6Md$ Softbank. Repricing 2022 a ~6.7Md$.',
    currentStatus: 'Statut public NYSE:KLAR rapporte mais a verifier via IR/NYSE avant diffusion.',
    notes: 'Verifier statut public et details IPO 2026 via IR/NYSE avant diffusion. Repricing massif 2022 a marque le marche.',
    needsExternalCheck: true,
  },
  nubank: {
    name: 'Nubank',
    founded: 2013,
    sectorAssetClass: 'fintech B2C / neobank LatAm',
    keyMilestones: 'Fondation 2013 Sao Paulo. Series G 2021 ~750M$ Berkshire Hathaway. IPO NYSE:NU decembre 2021, pricing 9$/share, valuation pricing day ~41Md$.',
    currentStatus: 'Public NYSE:NU.',
  },
  revolut: {
    name: 'Revolut',
    founded: 2015,
    sectorAssetClass: 'fintech B2C / neobank EU',
    keyMilestones: 'Fondation 2015 Nikolay Storonsky. Series E 2021 ~800M$ Softbank valuation 33Md$. Tender 2024 valuation ~45Md$.',
    currentStatus: 'Prive.',
  },

  // ============ BIOTECH / MEDTECH ============
  moderna: {
    name: 'Moderna',
    founded: 2010,
    sectorAssetClass: 'biotech / mRNA therapeutics / capex lourd / cycle long R&D',
    keyMilestones: 'Fondation 2010 Robert Langer. Plusieurs rounds prives. IPO NASDAQ:MRNA decembre 2018, pricing 23$/share, valuation pricing day ~7.5Md$. Peak market cap 2021 ~200Md$ (vaccin COVID).',
    currentStatus: 'Public NASDAQ:MRNA. Market cap 2024-2026 ~15-30Md$ variable.',
  },
  biontech: {
    name: 'BioNTech',
    founded: 2008,
    sectorAssetClass: 'biotech / mRNA therapeutics / capex lourd / cycle long R&D',
    keyMilestones: 'Fondation 2008 Ugur Sahin et Ozlem Tureci en Allemagne. IPO NASDAQ:BNTX octobre 2019, pricing 15$/share, valuation pricing day ~3.4Md$. Peak market cap 2021 ~100Md$.',
    currentStatus: 'Public NASDAQ:BNTX.',
  },

  // ============ ECHECS / CAUTIONARY TALES ============
  ynsect: {
    name: 'Ynsect',
    founded: 2011,
    sectorAssetClass: 'foodtech deeptech / insect protein / capex usine lourd',
    keyMilestones: 'Fondation 2011. Levees cumulees 2012-2023 ~600M$ (Series A a F). Annonce usine Amiens 200k tonnes 2018. CA cumule reporte ~37M$ sur la duree. Liquidation judiciaire 2025.',
    currentStatus: 'Liquidation judiciaire 2025. Cas d ecole capex sans validation commerciale.',
    notes: 'A citer comme cautionary tale pour deeptech industriel capex lourd avec surinvestissement avant validation marche.',
  },
  northvolt: {
    name: 'Northvolt',
    founded: 2016,
    sectorAssetClass: 'hardware deeptech / battery gigafactory / capex lourd',
    keyMilestones: 'Fondation 2016 Stockholm par ex-Tesla Peter Carlsson. Levees cumulees 2017-2023 ~15Md$ (equity + debt). Chapter 11 USA novembre 2024.',
    currentStatus: 'Chapter 11 USA novembre 2024. Restructuration en cours.',
    notes: 'A citer comme cautionary tale pour deeptech industriel + souverainete EU avec surinvestissement avant scaling commercial.',
  },
  wework: {
    name: 'WeWork',
    founded: 2010,
    sectorAssetClass: 'real estate deguise tech / coworking / asset-heavy',
    keyMilestones: 'Fondation 2010 Adam Neumann. Levees cumulees ~12.8Md$ pre-IPO (Softbank principalement). IPO ratee septembre 2019. SPAC NYSE:WE octobre 2021 valuation ~9Md$. Chapter 11 novembre 2023.',
    currentStatus: 'Chapter 11 novembre 2023. Restructure 2024.',
    notes: 'A citer comme cautionary tale pour business asset-heavy maquille en tech.',
  },
  theranos: {
    name: 'Theranos',
    founded: 2003,
    sectorAssetClass: 'medtech deeptech / blood diagnostics / fraude',
    keyMilestones: 'Fondation 2003 Elizabeth Holmes. Levees cumulees ~700M$ valuation peak ~9Md$ 2014. Wall Street Journal expose 2015. Dissolution 2018. Holmes condamnee 2022 pour fraude.',
    currentStatus: 'Dissout 2018. Cas de fraude documentee.',
    notes: 'A citer comme cautionary tale pour deeptech avec revendication scientifique non verifiee.',
  },
  quibi: {
    name: 'Quibi',
    founded: 2018,
    sectorAssetClass: 'media B2C / streaming premium short-form',
    keyMilestones: 'Fondation 2018 Jeffrey Katzenberg, Meg Whitman. Levees pre-launch ~1.75Md$ Disney/Sony/Alibaba. Lancement avril 2020. Fermeture decembre 2020.',
    currentStatus: 'Defunct decembre 2020. Cas d ecole capital-intensive content sans PMF.',
  },

  // ============ LICORNES EU REFERENCEES ============
  doctolib: {
    name: 'Doctolib',
    founded: 2013,
    sectorAssetClass: 'SaaS verticalise B2B medical / marketplace patient',
    keyMilestones: 'Fondation 2013 Stanislas Niox-Chateau. Series E 2019 ~150M€ valuation ~1Md€ devient licorne. Series F 2022 ~500M€ valuation 5.8Md€.',
    currentStatus: 'Prive. Valuation 2024-2026 ~5.8Md€.',
  },
  qonto: {
    name: 'Qonto',
    founded: 2016,
    sectorAssetClass: 'fintech B2B / neobank PME',
    keyMilestones: 'Fondation 2016 Alexandre Prot et Steve Anavi. Series D 2022 ~486M€ valuation 4.4Md€.',
    currentStatus: 'Prive. Valuation 2024-2026 ~4.4Md€.',
  },
  alan: {
    name: 'Alan',
    founded: 2016,
    sectorAssetClass: 'insurtech B2B / sante',
    keyMilestones: 'Fondation 2016. Series E 2023 ~183M€ valuation 4Md€.',
    currentStatus: 'Prive.',
  },
  spotify: {
    name: 'Spotify',
    founded: 2006,
    sectorAssetClass: 'streaming B2C / audio',
    keyMilestones: 'Fondation 2006 Stockholm par Daniel Ek. Direct listing NYSE:SPOT avril 2018, valuation reference ~26.5Md$.',
    currentStatus: 'Public NYSE:SPOT.',
  },
  adyen: {
    name: 'Adyen',
    founded: 2006,
    sectorAssetClass: 'SaaS B2B / payments infrastructure',
    keyMilestones: 'Fondation 2006 Pays-Bas. IPO Euronext Amsterdam:ADYEN juin 2018, valuation pricing day ~7.1Md€, peak day ~14Md€.',
    currentStatus: 'Public Euronext:ADYEN.',
  },

  // ============ MARKETPLACES BC2/EU non couverts ============
  vinted: {
    name: 'Vinted',
    founded: 2008,
    founders: 'Milda Mitkute, Justas Janauskas',
    sectorAssetClass: 'marketplace C2C / second-hand fashion / asset-light',
    keyMilestones: 'Series F 2019 128M EUR Lightspeed valuation >1Md EUR [Sifted]. Series F 2021 250M EUR EQT Growth valuation ~4,5Md EUR post-money [communique EQT]. Secondary 2026 valuation 8Md EUR [communique officiel Vinted].',
    currentStatus: 'Prive. Derniere valorisation 8Md EUR (2026, secondary).',
    notes: 'Le tour 2026 est SECONDARY, pas primary equity. Origine Lituanie. Thomas Plantenga est CEO mais pas fondateur.',
  },
  etsy: {
    name: 'Etsy',
    founded: 2005,
    founders: 'Robert Kalin, Chris Maguire, Haim Schoppik',
    sectorAssetClass: 'marketplace C2C+B2C / handmade et vintage / asset-light',
    keyMilestones: 'Series C 2008 ~27M$ Accel. Series F 2012 ~40M$ Index Ventures. IPO NASDAQ:ETSY avril 2015 pricing 16$/share valuation pricing day ~1,8Md$ [S-1 SEC]. Acquisition Reverb 2019. Acquisition Depop 2021 ~1,6Md$.',
    currentStatus: 'Public NASDAQ:ETSY.',
  },

  // ============ SAAS B2B complements v2 ============
  mongodb: {
    name: 'MongoDB',
    founded: 2007,
    founders: 'Dwight Merriman, Eliot Horowitz, Kevin Ryan',
    sectorAssetClass: 'SaaS B2B / NoSQL database / capital efficient',
    keyMilestones: 'IPO NASDAQ:MDB octobre 2017 pricing 24$/share [S-1 SEC].',
    currentStatus: 'Public NASDAQ:MDB. Market cap a rafraichir par finance tool.',
    notes: 'Pivot 10gen vers MongoDB en 2013. Modele open-source + Atlas managed. Ne pas confondre MongoDB Inc avec projet open-source initial.',
  },
  twilio: {
    name: 'Twilio',
    founded: 2008,
    founders: 'Jeff Lawson, Evan Cooke, John Wolthuis',
    sectorAssetClass: 'SaaS B2B / communications API / B2B usage-based',
    keyMilestones: 'IPO NYSE:TWLO juin 2016 pricing 15$/share [S-1 SEC]. Acquisition SendGrid 2018 ~2Md$. Acquisition Segment 2020 ~3.2Md$.',
    currentStatus: 'Public NYSE:TWLO.',
    notes: 'Pas SaaS pur : revenus fortement usage/API. Repricing massif 2022-2023.',
  },
  hashicorp: {
    name: 'HashiCorp',
    founded: 2012,
    founders: 'Mitchell Hashimoto, Armon Dadgar',
    sectorAssetClass: 'SaaS B2B / infrastructure as code (Terraform Vault Consul) / capital efficient',
    keyMilestones: 'IPO NASDAQ:HCP decembre 2021 pricing 80$/share valuation pricing day ~14Md$ [S-1 SEC]. Annonce acquisition IBM avril 2024 ~6.4Md$ enterprise value [communique IBM].',
    currentStatus: 'Acquisition IBM annoncee avril 2024, finalisation prevue 2025. Verifier statut closing avant usage final.',
    notes: 'Acquisition IBM 6.4Md$ inferieure a valuation IPO 14Md$. Controversy 2023 sur changement licence Terraform (creation OpenTofu en reponse).',
    needsExternalCheck: true,
  },
  confluent: {
    name: 'Confluent',
    founded: 2014,
    founders: 'Jay Kreps, Neha Narkhede, Jun Rao (ex-LinkedIn createurs Apache Kafka)',
    sectorAssetClass: 'SaaS B2B / data streaming Kafka commercial / capital efficient',
    keyMilestones: 'IPO NASDAQ:CFLT juin 2021 pricing 36$/share valuation pricing day ~9.1Md$ [S-1 SEC].',
    currentStatus: 'Public NASDAQ:CFLT.',
    notes: 'Spinoff de LinkedIn. Ne pas confondre Apache Kafka open-source et Confluent entreprise commerciale.',
  },
  airtable: {
    name: 'Airtable',
    founded: 2012,
    founders: 'Howie Liu, Andrew Ofstad, Emmett Nicholas',
    sectorAssetClass: 'SaaS B2B / no-code database / capital efficient',
    keyMilestones: 'Series C 2018 ~100M$ Benchmark valuation ~1.1Md$ devient licorne. Series F 2021 735M$ XN + Franklin Templeton + Salesforce Ventures valuation 11.7Md$ [Airtable communique]. Repricing tender 2024 valuation ~7Md$.',
    currentStatus: 'Prive. Repricing 2023-2024.',
    notes: 'Plusieurs vagues de licenciements 2022-2024. Ne pas extrapoler valuation 2021 apres compression SaaS.',
  },
  toast: {
    name: 'Toast',
    founded: 2011,
    founders: 'Steve Fredette, Aman Narang, Jonathan Grimm',
    sectorAssetClass: 'SaaS B2B vertical / restaurants POS + payments / capex hardware modere',
    keyMilestones: 'IPO NYSE:TOST septembre 2021 pricing 40$/share valuation pricing day ~20Md$ [S-1 SEC].',
    currentStatus: 'Public NYSE:TOST.',
    notes: 'SaaS verticale specialisee restaurants. Pas SaaS pur : payments et hardware POS importants.',
  },
  klaviyo: {
    name: 'Klaviyo',
    founded: 2012,
    founders: 'Andrew Bialecki, Ed Hallen',
    sectorAssetClass: 'SaaS B2B / marketing automation pour e-commerce / capital efficient (bootstrap initial)',
    keyMilestones: 'Series A 2017 15M$ Summit Partners. Series B 2020 200M$ Accel valuation 4.15Md$. Investissement Shopify 2022 100M$ pour ~5%. IPO NYSE:KVYO septembre 2023 pricing 30$/share valuation pricing day ~9Md$ [S-1 SEC].',
    currentStatus: 'Public NYSE:KVYO depuis septembre 2023.',
    notes: 'Bootstrap pendant 4-5 ans avant premiere levee. Forte dependance ecosysteme Shopify mais societe separee.',
  },
  atlassian: {
    name: 'Atlassian',
    founded: 2002,
    founders: 'Mike Cannon-Brookes, Scott Farquhar (Australie)',
    sectorAssetClass: 'SaaS B2B / dev collaboration tools (Jira Confluence Trello) / capital efficient',
    keyMilestones: 'Bootstrap 2002-2010 aucune levee VC. Secondary 2010 60M$ Accel. Secondary 2014 150M$ T. Rowe Price. IPO NASDAQ:TEAM decembre 2015 pricing 21$/share valuation pricing day ~4.4Md$ [S-1 SEC]. Acquisition Trello 2017 ~425M$. Acquisition Loom 2023 ~975M$.',
    currentStatus: 'Public NASDAQ:TEAM.',
    notes: 'Cas d ecole de bootstrap reussi sur 8 ans avant premiere levee.',
  },
  gitlab: {
    name: 'GitLab',
    founded: 2011,
    founders: 'Sytse Sijbrandij, Dmitriy Zaporozhets',
    sectorAssetClass: 'SaaS B2B / DevOps platform / capital efficient (open-core)',
    keyMilestones: 'IPO NASDAQ:GTLB octobre 2021 pricing 77$/share valuation pricing day ~11Md$ [S-1 SEC].',
    currentStatus: 'Public NASDAQ:GTLB.',
    notes: 'Open-source core + enterprise edition. Fully-remote. Ne pas confondre avec GitHub.',
  },
  github: {
    name: 'GitHub',
    founded: 2008,
    founders: 'Tom Preston-Werner, Chris Wanstrath, PJ Hyett',
    sectorAssetClass: 'SaaS B2B+B2C / code hosting et collaboration / capital efficient',
    keyMilestones: 'Bootstrap 2008-2012. Series A 2012 100M$ Andreessen Horowitz valuation ~750M$. Series B 2015 250M$ valuation ~2Md$. Annonce acquisition Microsoft octobre 2018 7.5Md$ en actions [communique Microsoft].',
    currentStatus: 'Filiale Microsoft depuis octobre 2018. Pas d IPO.',
    notes: '4 ans bootstrap avant Series A. GitHub Copilot est post-acquisition.',
  },
  vercel: {
    name: 'Vercel',
    founded: 2015,
    founders: 'Guillermo Rauch (createur Next.js)',
    sectorAssetClass: 'SaaS B2B / frontend cloud platform / capital efficient',
    keyMilestones: 'Series A 2020 21M$ Accel. Series B 2021 102M$ Bedrock + Geodesic valuation 1.1Md$ devient licorne. Series D 2021 150M$ GGV/Accel/Bedrock valuation 2.5Md$ [Vercel communique]. Series E 2024 250M$ Accel valuation 3.25Md$ [TechCrunch + The Information mai 2024].',
    currentStatus: 'Prive. Valuation 2024 ~3.25Md$.',
    notes: 'Rauch est OSS heavyweight. Modele freemium agressif vers self-serve developers. Ne pas confondre Vercel avec Next.js open-source.',
  },
  supabase: {
    name: 'Supabase',
    founded: 2020,
    founders: 'Paul Copplestone, Ant Wilson',
    sectorAssetClass: 'SaaS B2B / backend-as-a-service open-source / capital efficient',
    keyMilestones: 'YC S2020. Series A 2021 30M$ Coatue + Felicis. Series B 2022 80M$ Felicis valuation ~2Md$. Series C avril 2024 80M$ Peak XV valuation 2Md$ [TechCrunch].',
    currentStatus: 'Prive. Valuation 2024 ~2Md$.',
    notes: 'Open-source PostgreSQL stack. Plateforme autour de Postgres, pas Postgres lui-meme.',
  },

  // ============ CYBERSECURITE ============
  wiz: {
    name: 'Wiz',
    founded: 2020,
    founders: 'Assaf Rappaport, Yinon Costica, Ami Luttwak, Roy Reznik (ex-Microsoft Cloud Security, ex-Adallom)',
    sectorAssetClass: 'SaaS B2B / cloud security CNAPP / capital efficient mais croissance ARR exceptionnelle',
    keyMilestones: 'Series B 2021 250M$ Sequoia valuation ~1.7Md$ devient licorne. Series C 2021 250M$ valuation 6Md$. Series D 2023 300M$ valuation 10Md$. Series E mai 2024 1Md$ valuation 12Md$ [Bloomberg + WSJ]. Juillet 2024 Google annonce offre acquisition 23Md$, REFUSEE par Wiz [WSJ juillet 2024].',
    currentStatus: 'Prive. Annonce IPO future apres refus Google. Valuation 2024 ~12Md$.',
    notes: 'NE PAS dire rachat Google 23Md$ : l offre a ete REFUSEE. Croissance ARR la plus rapide jamais observee en SaaS infra. Founders ex-Adallom (acquise par Microsoft 320M$ en 2015).',
    needsExternalCheck: true,
  },
  crowdstrike: {
    name: 'CrowdStrike',
    founded: 2011,
    founders: 'George Kurtz, Dmitri Alperovitch',
    sectorAssetClass: 'SaaS B2B / endpoint security cloud-native / capital efficient',
    keyMilestones: 'Series C 2017 100M$ Accel valuation 1Md$. IPO NASDAQ:CRWD juin 2019 pricing 34$/share valuation pricing day ~6.7Md$ [S-1 SEC].',
    currentStatus: 'Public NASDAQ:CRWD.',
    notes: 'Panne mondiale juillet 2024 (Falcon update bug) qui a fait chuter market cap d environ 30-40% en quelques semaines.',
  },
  sentinelone: {
    name: 'SentinelOne',
    founded: 2013,
    founders: 'Tomer Weingarten, Almog Cohen, Ehud Shamir',
    sectorAssetClass: 'SaaS B2B / endpoint security IA-driven XDR / capital efficient',
    keyMilestones: 'IPO NYSE:S juin 2021 pricing 35$/share [S-1 SEC].',
    currentStatus: 'Public NYSE:S. Repricing massif 2022-2024.',
    notes: 'Ticker S. Ne pas confondre avec CrowdStrike.',
  },
  cloudflare: {
    name: 'Cloudflare',
    founded: 2009,
    founders: 'Matthew Prince, Michelle Zatlyn, Lee Holloway',
    sectorAssetClass: 'SaaS B2B / CDN, security, edge compute / capital efficient',
    keyMilestones: 'IPO NYSE:NET septembre 2019 pricing 15$/share valuation pricing day ~4.4Md$ [S-1 SEC].',
    currentStatus: 'Public NYSE:NET.',
    notes: 'Michelle Zatlyn cofondatrice femme. Modele freemium.',
  },
  snyk: {
    name: 'Snyk',
    founded: 2015,
    founders: 'Guy Podjarny, Assaf Hefetz, Danny Grander',
    sectorAssetClass: 'SaaS B2B / developer security / capital efficient',
    keyMilestones: 'Series F 2021 530M$ valuation 8.5Md$. Series G 2022 196M$ valuation 7.4Md$ (repricing). Tender 2024 valuation ~7-9Md$.',
    currentStatus: 'Prive, IPO repoussee.',
    notes: 'ARR estime ~250M$ fin 2023 [The Information].',
    needsExternalCheck: true,
  },
  onepassword: {
    name: '1Password',
    founded: 2005,
    founders: 'Dave Teare, Roustem Karimov, Sara Teare (Toronto)',
    sectorAssetClass: 'SaaS B2B+B2C / password manager / capital efficient (bootstrap 14 ans)',
    keyMilestones: 'Bootstrap integral 2005-2019. Series A 2019 200M$ Accel valuation ~1Md$ devient licorne (record bootstrap-to-unicorn). Series C 2022 620M$ ICONIQ Growth valuation 6.8Md$ [1Password communique].',
    currentStatus: 'Prive. Derniere valuation publique : 6.8Md$ (2022).',
    notes: '14 ans de bootstrap avant premiere levee, cas d ecole absolu de capital efficiency.',
  },
  paloalto: {
    name: 'Palo Alto Networks',
    founded: 2005,
    founders: 'Nir Zuk',
    sectorAssetClass: 'cybersecurity platform / hardware appliances + SaaS subscriptions / capital efficient a l echelle',
    keyMilestones: 'IPO NASDAQ:PANW juillet 2012 pricing 42$/share pre-split [S-1 SEC].',
    currentStatus: 'Public NASDAQ:PANW.',
    notes: 'Pas une startup recente. A utiliser comme reference legacy.',
  },
  okta: {
    name: 'Okta',
    founded: 2009,
    founders: 'Todd McKinnon (ex-Salesforce), Frederic Kerrest',
    sectorAssetClass: 'SaaS B2B / identity-as-a-service / capital efficient',
    keyMilestones: 'IPO NASDAQ:OKTA avril 2017 pricing 17$/share valuation pricing day ~1.7Md$ [S-1 SEC]. Acquisition Auth0 2021 ~6.5Md$.',
    currentStatus: 'Public NASDAQ:OKTA.',
    notes: 'Auth0 acquise 2021. Breach 2022 (Lapsus$).',
  },

  // ============ HARDWARE DEEPTECH complements ============
  lucid: {
    name: 'Lucid Motors',
    founded: 2007,
    founders: 'Bernard Tse, Sam Weng',
    sectorAssetClass: 'hardware deeptech / automotive EV luxe / capex lourd',
    keyMilestones: 'SPAC merger NASDAQ:LCID juillet 2021 avec Churchill Capital IV equity value ~24Md$ [SEC/proxy]. Peak market cap ~90Md$ novembre 2021.',
    currentStatus: 'Public NASDAQ:LCID.',
    notes: 'SPAC, pas IPO classique. Saudi PIF actionnaire majoritaire (>60%). Cas d ecole d effondrement post-SPAC.',
  },
  commonwealthfusion: {
    name: 'Commonwealth Fusion Systems',
    founded: 2018,
    founders: 'Bob Mumgaard (collectif issu MIT PSFC)',
    sectorAssetClass: 'hardware deeptech / fusion magnetique / capex tres lourd / cycle long R&D',
    keyMilestones: 'Series B 2021 1.8Md$ Tiger Global + Bill Gates + Khosla [CFS communique].',
    currentStatus: 'Prive.',
    notes: 'Aucune centrale commerciale livree. Cycle long R&D, objectif fusion nette ~2030.',
  },
  shieldai: {
    name: 'Shield AI',
    founded: 2015,
    founders: 'Ryan Tseng, Brandon Tseng, Andrew Reiter',
    sectorAssetClass: 'hardware deeptech / defense autonomy drones / B2B+B2G',
    keyMilestones: 'Series F 2023-2024 200M$ valuation ~2.7Md$ [Shield AI communique].',
    currentStatus: 'Prive.',
    notes: 'Defense tech, pas SaaS classique.',
  },
  skydio: {
    name: 'Skydio',
    founded: 2014,
    founders: 'Adam Bry, Abe Bachrach, Matt Donahoe',
    sectorAssetClass: 'hardware deeptech / drones autonomes / capex modere',
    keyMilestones: 'Series E 2023 230M$ Linse Capital valuation 2.2Md$ [Skydio communique].',
    currentStatus: 'Prive.',
    notes: 'A quitte le marche consumer en 2023 pour se concentrer enterprise/public sector.',
  },
  boom: {
    name: 'Boom Supersonic',
    founded: 2014,
    founders: 'Blake Scholl',
    sectorAssetClass: 'hardware deeptech / aerospace supersonic / capex lourd / certification',
    keyMilestones: 'Levees cumulees ~700M$ documentees. Premier vol XB-1 mars 2024.',
    currentStatus: 'Prive.',
    notes: 'Programme Overture en developpement, pas avions commerciaux livres. Commande United Airlines 2021 et Japan Airlines.',
  },
  heart: {
    name: 'Heart Aerospace',
    founded: 2018,
    founders: 'Anders Forslund (Suede)',
    sectorAssetClass: 'hardware deeptech / electric aviation regional / capex lourd',
    keyMilestones: 'Levees Series A et B cumulees ~130M$ EQT et autres.',
    currentStatus: 'Prive. Difficultes 2024 (reduction d objectifs, repricing).',
    notes: 'Pivot 2023 du concept ES-19 19-passagers vers ES-30 hybride.',
    needsExternalCheck: true,
  },

  // ============ CLIMATE complements ============
  climeworks: {
    name: 'Climeworks',
    founded: 2009,
    founders: 'Christoph Gebald, Jan Wurzbacher (Suisse)',
    sectorAssetClass: 'hardware deeptech / direct air capture (DAC) / capex lourd',
    keyMilestones: 'Equity round 2022 650M$ Partners Group + GIC [Climeworks communique].',
    currentStatus: 'Prive.',
    notes: 'DAC = infrastructure lourde, pas SaaS carbon accounting. Plus grosse usine DAC mondiale (Orca puis Mammoth Islande).',
  },
  carbonengineering: {
    name: 'Carbon Engineering',
    founded: 2009,
    founders: 'David Keith (Canada)',
    sectorAssetClass: 'hardware deeptech / direct air capture / capex lourd',
    keyMilestones: 'Acquisition annoncee par Occidental/1PointFive 2023 ~1.1Md$ [Occidental communique].',
    currentStatus: 'Filiale Occidental/1PointFive depuis 2023.',
  },
  sila: {
    name: 'Sila Nanotechnologies',
    founded: 2011,
    founders: 'Gene Berdichevsky (ex-Tesla), Gleb Yushin, Alex Jacobs',
    sectorAssetClass: 'hardware deeptech / battery anode silicon / capex lourd',
    keyMilestones: 'Series F 2021 590M$ Coatue valuation 3.3Md$ [Sila communique].',
    currentStatus: 'Prive.',
  },
  redwood: {
    name: 'Redwood Materials',
    founded: 2017,
    founders: 'JB Straubel (ex-Tesla cofounder)',
    sectorAssetClass: 'hardware deeptech / battery recycling / capex lourd',
    keyMilestones: 'Series D 2023 >1Md$ Goldman Sachs Asset Management + Capricorn [Redwood communique]. Subvention DOE 2023 2Md$.',
    currentStatus: 'Prive.',
    notes: 'Recyclage batterie, ne pas confondre avec cell manufacturing pur.',
  },
  verkor: {
    name: 'Verkor',
    founded: 2020,
    founders: 'Benoit Lemaignan (France)',
    sectorAssetClass: 'hardware deeptech / battery gigafactory FR / capex lourd',
    keyMilestones: 'Series C 2023 850M EUR equity + financements EIB et BPI environ 2Md EUR cumules [communique Verkor + Sifted].',
    currentStatus: 'Prive. Construction usine Dunkerque en cours.',
    notes: 'Verifier comptes via Pappers pour structure capitalistique exacte.',
    needsExternalCheck: true,
  },

  // ============ ROBOTICS ============
  bostondynamics: {
    name: 'Boston Dynamics',
    founded: 1992,
    founders: 'Marc Raibert (MIT spinoff)',
    sectorAssetClass: 'hardware deeptech / robotique avancee / capex lourd',
    keyMilestones: 'Acquisition Google 2013, vente SoftBank 2017, vente Hyundai 2020 ~1.1Md$ pour 80%.',
    currentStatus: 'Filiale Hyundai depuis 2020. Pas d IPO.',
    notes: '30+ ans de R&D avant traction commerciale. Valuation 2026 >20Md$ rapportee mais en quarantaine.',
    needsExternalCheck: true,
  },
  symbotic: {
    name: 'Symbotic',
    founded: 2007,
    founders: 'Rick Cohen',
    sectorAssetClass: 'hardware deeptech / warehouse robotics / capex modere',
    keyMilestones: 'SPAC merger NASDAQ:SYM juin 2022 valuation deal ~5.5Md$.',
    currentStatus: 'Public NASDAQ:SYM.',
    notes: 'Partenariat majeur avec Walmart.',
  },

  // ============ AI complements ============
  cohere: {
    name: 'Cohere',
    founded: 2019,
    founders: 'Aidan Gomez (ex-Google Brain coauteur Attention is All You Need)',
    sectorAssetClass: 'AI deeptech / enterprise LLMs / capex GPU',
    keyMilestones: 'Series C 2023 270M$ Inovia + NVIDIA valuation 2.2Md$. Levee 2024 500M$ valuation ~5.5Md$ [WSJ juillet 2024].',
    currentStatus: 'Prive.',
    notes: 'Positionnement enterprise B2B (vs Anthropic ou OpenAI plus generalistes).',
    needsExternalCheck: true,
  },
  stabilityai: {
    name: 'Stability AI',
    founded: 2019,
    founders: 'Emad Mostaque (demissionne mars 2024)',
    sectorAssetClass: 'AI deeptech / text-to-image (Stable Diffusion) / capex GPU',
    keyMilestones: 'Series A 2022 101M$ valuation ~1Md$. Crise gouvernance 2023-2024, demission Mostaque mars 2024.',
    currentStatus: 'Prive. Restructuration 2024.',
    notes: 'Cautionary tale partielle : crise gouvernance et capex IA non soutenable.',
  },

  // ============ FINTECH complements ============
  chime: {
    name: 'Chime',
    founded: 2012,
    founders: 'Chris Britt, Ryan King',
    sectorAssetClass: 'fintech B2C / neobank US / scale rapide',
    keyMilestones: 'Series G 2021 750M$ Sequoia valuation ~25Md$. Repricing 2023 valuation ~6Md$ via tender [WSJ].',
    currentStatus: 'Prive. IPO repoussee.',
    notes: 'Pas une banque chartee classique au depart, partenaire bancaire.',
  },
  robinhood: {
    name: 'Robinhood',
    founded: 2013,
    founders: 'Vlad Tenev, Baiju Bhatt',
    sectorAssetClass: 'fintech B2C / brokerage / regulatory risk',
    keyMilestones: 'IPO NASDAQ:HOOD juillet 2021 pricing 38$/share valuation pricing day ~32Md$ [S-1 SEC].',
    currentStatus: 'Public NASDAQ:HOOD.',
    notes: 'PFOF/regulatory exposure importante.',
  },
  affirm: {
    name: 'Affirm',
    founded: 2012,
    founders: 'Max Levchin (ex-PayPal cofounder), Nathan Gettings, Jeffrey Kaditz',
    sectorAssetClass: 'fintech B2C+B2B2C / BNPL / credit cycle',
    keyMilestones: 'IPO NASDAQ:AFRM janvier 2021 pricing 49$/share valuation pricing day ~12Md$ [S-1 SEC].',
    currentStatus: 'Public NASDAQ:AFRM.',
    notes: 'Credit losses/funding costs : pas SaaS.',
  },

  // ============ BIOTECH complements ============
  recursion: {
    name: 'Recursion',
    founded: 2013,
    founders: 'Chris Gibson, Dean Li, Blake Borgeson',
    sectorAssetClass: 'biotech / AI drug discovery / capex modere / cycle long R&D',
    keyMilestones: 'IPO NASDAQ:RXRX avril 2021 pricing 18$/share valuation pricing day ~2.9Md$ [S-1 SEC]. Acquisition Exscientia 2024 ~690M$.',
    currentStatus: 'Public NASDAQ:RXRX.',
    notes: 'Revenue de collaborations/licensing different de drug sales recurrentes.',
  },
  insitro: {
    name: 'Insitro',
    founded: 2018,
    founders: 'Daphne Koller (ex-Coursera cofondatrice)',
    sectorAssetClass: 'biotech / AI drug discovery / capex modere',
    keyMilestones: 'Series C 2021 400M$ CPP Investments [insitro communique].',
    currentStatus: 'Prive.',
    notes: 'Pas de medicament commercialise a traiter comme pharma mature.',
  },
  owkin: {
    name: 'Owkin',
    founded: 2016,
    founders: 'Thomas Clozel, Gilles Wainrib (France)',
    sectorAssetClass: 'biotech / AI federated learning healthcare / capex modere',
    keyMilestones: 'Series B 2021 180M$ Sanofi devient licorne valuation 1Md$. Joint-venture Sanofi 180M$ 2022.',
    currentStatus: 'Prive.',
    notes: 'Verifier via Pappers pour comptes annuels.',
    needsExternalCheck: true,
  },
  tempus: {
    name: 'Tempus AI',
    founded: 2015,
    founders: 'Eric Lefkofsky (cofondateur Groupon)',
    sectorAssetClass: 'biotech / AI clinical data / capex modere',
    keyMilestones: 'IPO NASDAQ:TEM juin 2024 pricing 37$/share valuation pricing day ~6.1Md$ [S-1 SEC].',
    currentStatus: 'Public NASDAQ:TEM.',
    notes: 'Ne pas confondre Tempus AI avec Tempus Labs historiques.',
  },

  // ============ HEALTHTECH SCALE-UPS ============
  adahealth: {
    name: 'Ada Health',
    founded: 2011,
    founders: 'Claire Novorol, Martin Hirsch, Daniel Nathrath',
    sectorAssetClass: 'medtech / AI symptom assessment / regulatory',
    keyMilestones: 'Series B 2021 90M$ Leaps by Bayer [Ada communique].',
    currentStatus: 'Prive.',
    notes: 'Ne pas presenter comme dispositif medical universel sans verifier approvals.',
  },
  cardiologs: {
    name: 'Cardiologs',
    founded: 2014,
    founders: 'Yann Fleureau, Jia Li (France)',
    sectorAssetClass: 'medtech / AI cardiology diagnostics / regulatory',
    keyMilestones: 'Acquisition Philips 2021 montant non communique [Philips communique].',
    currentStatus: 'Acquis par Philips en 2021.',
    notes: 'Montant acquisition non public, ne pas inventer.',
  },

  // ============ CAUTIONARY TALES complements ============
  better: {
    name: 'Better.com',
    founded: 2016,
    founders: 'Vishal Garg',
    sectorAssetClass: 'fintech / digital mortgage / rate-cycle sensitive',
    keyMilestones: 'SPAC completion 2023 avec Aurora Acquisition Corp ticker BETR.',
    currentStatus: 'Public via SPAC, verifier delisting/reverse split/current status.',
    notes: 'Mass layoffs Zoom decembre 2021 (900 personnes, video virale). Chute post-SPAC majeure.',
  },
  jawbone: {
    name: 'Jawbone',
    founded: 1999,
    founders: 'Hosain Rahman, Alexander Asseily',
    sectorAssetClass: 'hardware grand public / wearables et speakers',
    keyMilestones: 'Levees cumulees ~900M$. Liquidation 2017.',
    currentStatus: 'Liquidation 2017.',
    notes: 'Ne pas confondre avec Jawbone Health, entite post-liquidation.',
  },
  cazoo: {
    name: 'Cazoo',
    founded: 2018,
    founders: 'Alex Chesterman (ex-Zoopla, UK)',
    sectorAssetClass: 'e-commerce auto UK / capex stock physique',
    keyMilestones: 'SPAC merger NYSE:CZOO aout 2021 valuation ~7Md$. Effondrement 2022-2023. Faillite 2024.',
    currentStatus: 'Faillite 2024.',
    notes: 'Cautionary recent : modele asset-heavy deguise en tech.',
    needsExternalCheck: true,
  },
  hopin: {
    name: 'Hopin',
    founded: 2019,
    founders: 'Johnny Boufarhat',
    sectorAssetClass: 'SaaS B2B / virtual events / pandemic pull-forward',
    keyMilestones: 'Series D 2021 450M$ Arena/Altimeter valuation 7.75Md$. Activites principales vendues a RingCentral 2023.',
    currentStatus: 'Restructuree autour StreamYard 2023+.',
    notes: 'Pic COVID non soutenable, ne pas utiliser 2021 comme reference.',
  },
  convoy: {
    name: 'Convoy',
    founded: 2015,
    founders: 'Dan Lewis, Grant Goodale',
    sectorAssetClass: 'B2B marketplace / digital freight / cyclical/logistics',
    keyMilestones: 'Series E 2022 260M$ equity + debt valuation 3.8Md$. Fermeture operations 2023, actifs Flexport.',
    currentStatus: 'Fermeture operations 2023.',
    notes: 'Freight brokerage different de SaaS.',
  },
  bird: {
    name: 'Bird',
    founded: 2017,
    founders: 'Travis VanderZanden',
    sectorAssetClass: 'micromobility hardware/services / capex/fleet maintenance',
    keyMilestones: 'SPAC merger 2021 valuation ~2.3Md$. Chapter 11 US decembre 2023.',
    currentStatus: 'Chapter 11 decembre 2023, restructuration 2024.',
    notes: 'Ne pas confondre croissance rides avec rentabilite unitaire.',
  },
  oliveai: {
    name: 'Olive AI',
    founded: 2012,
    founders: 'Sean Lane',
    sectorAssetClass: 'B2B SaaS+services / healthcare automation / execution risk',
    keyMilestones: 'Series H 2021 400M$ Vista Equity Partners valuation 4Md$. Fermeture/cessation 2023.',
    currentStatus: 'Fermeture annoncee 2023.',
    notes: 'Hypergrowth financee puis effondrement.',
  },
  pollen: {
    name: 'Pollen',
    founded: 2014,
    founders: 'Callum Negus-Fancey, Liam Negus-Fancey',
    sectorAssetClass: 'B2C marketplace / events/travel / cashflow risk',
    keyMilestones: 'Administration UK 2022 [Companies House].',
    currentStatus: 'Administration/insolvency 2022.',
    notes: 'Ne pas confondre avec Pollen Robotics.',
  },
  pets: {
    name: 'Pets.com',
    founded: 1998,
    founders: 'Greg McLemore puis Julie Wainwright',
    sectorAssetClass: 'e-commerce B2C / pet supplies',
    keyMilestones: 'IPO NASDAQ:IPET fevrier 2000 valuation pricing day ~290M$. Faillite novembre 2000 (9 mois post-IPO).',
    currentStatus: 'Defunct novembre 2000.',
    notes: 'Symbole dotcom bust. Sock puppet mascotte celebre.',
  },
  webvan: {
    name: 'Webvan',
    founded: 1996,
    founders: 'Louis Borders',
    sectorAssetClass: 'e-commerce B2C / grocery delivery / capex lourd',
    keyMilestones: 'IPO NASDAQ:WBVN novembre 1999 valuation pricing day ~8Md$. Chapter 11 juillet 2001.',
    currentStatus: 'Defunct juillet 2001.',
    notes: 'Symbole dotcom bust. Idee reprise 20 ans plus tard avec succes par Instacart et Amazon Fresh.',
  },
  juicero: {
    name: 'Juicero',
    founded: 2013,
    founders: 'Doug Evans',
    sectorAssetClass: 'hardware grand public / connected juicer',
    keyMilestones: 'Levees 120M$ Kleiner Perkins + Google Ventures. Fermeture septembre 2017 (16 mois post-launch).',
    currentStatus: 'Defunct septembre 2017.',
    notes: 'Bloomberg avril 2017 demontre que les sachets peuvent etre presses a la main sans la machine 400$. Cas d ecole de produit absurde.',
  },
  solyndra: {
    name: 'Solyndra',
    founded: 2005,
    sectorAssetClass: 'hardware deeptech / solar (cylindrical CIGS) / capex lourd',
    keyMilestones: 'Levees privees ~1Md$ + garantie DOE 535M$ 2009. Faillite septembre 2011.',
    currentStatus: 'Defunct septembre 2011.',
    notes: 'Cas d ecole subvention publique sur technologie non competitive.',
  },
  magicleap: {
    name: 'Magic Leap',
    founded: 2010,
    founders: 'Rony Abovitz',
    sectorAssetClass: 'hardware deeptech / AR headsets / capex lourd',
    keyMilestones: 'Levees cumulees ~3.5Md$ valuation peak 6.4Md$ 2018. Repricing massif et licenciements 2020. Pivot enterprise 2021. Saudi PIF 450M$ 2022.',
    currentStatus: 'Prive fragile.',
    notes: 'Cas d ecole hype consumer hardware sans PMF.',
  },

  // ============ LICORNES EU complements ============
  contentsquare: {
    name: 'ContentSquare',
    founded: 2012,
    founders: 'Jonathan Cherki (France)',
    sectorAssetClass: 'SaaS B2B / digital experience analytics / capital efficient',
    keyMilestones: 'Series E 2021 500M$ SoftBank valuation 2.8Md$. Series F 2022 600M$ valuation 5.6Md$. Acquisition Heap 2024 ~500M$.',
    currentStatus: 'Prive.',
    notes: 'Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  mirakl: {
    name: 'Mirakl',
    founded: 2012,
    founders: 'Adrien Nussenbaum, Philippe Corrot (France)',
    sectorAssetClass: 'SaaS B2B / marketplace platform / capital efficient',
    keyMilestones: 'Series E 2021 555M$ Silver Lake valuation 3.5Md$.',
    currentStatus: 'Prive.',
    notes: 'Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  dataiku: {
    name: 'Dataiku',
    founded: 2013,
    founders: 'Florian Douetteau (France)',
    sectorAssetClass: 'SaaS B2B / data science platform / capital efficient',
    keyMilestones: 'Series F 2022 200M$ Tiger Global valuation 3.7Md$.',
    currentStatus: 'Prive.',
    notes: 'Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  backmarket: {
    name: 'BackMarket',
    founded: 2014,
    founders: 'Thibaud Hug de Larauze, Vianney Vaute, Quentin Le Brouster (France)',
    sectorAssetClass: 'marketplace B2C / refurbished electronics / asset-light',
    keyMilestones: 'Series E 2022 510M$ Sprints Capital valuation 5.7Md$ [Back Market communique]. Repricing tender 2024 valuation ~2-3Md EUR.',
    currentStatus: 'Prive.',
    notes: 'Marketplace reconditionne, pas fabricant hardware. Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  sorare: {
    name: 'Sorare',
    founded: 2018,
    founders: 'Nicolas Julia, Adrien Montfort (France)',
    sectorAssetClass: 'web3 fantasy sports NFT / asset-light / crypto/regulatory volatility',
    keyMilestones: 'Series B 2021 680M$ SoftBank valuation 4.3Md$ [Sorare communique]. Repricing significatif 2022-2023 dans crypto winter.',
    currentStatus: 'Prive.',
    notes: 'Valuation 2021 a ne pas extrapoler apres correction crypto/NFT. Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  ledger: {
    name: 'Ledger',
    founded: 2014,
    founders: 'Eric Larcheveque (et autres, France)',
    sectorAssetClass: 'hardware crypto wallet / capex modere',
    keyMilestones: 'Series C 2021 380M$ 10T Holdings valuation 1.5Md$. Series C extension 2023 ~100M$ valuation ~1.4Md$.',
    currentStatus: 'Prive.',
    notes: 'Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  believe: {
    name: 'Believe',
    founded: 2005,
    founders: 'Denis Ladegaillerie (France)',
    sectorAssetClass: 'music distribution digitale / capital efficient',
    keyMilestones: 'IPO Euronext Paris juin 2021 pricing 19.5 EUR/share valuation pricing day ~1.9Md EUR. Tentative OPA 2024.',
    currentStatus: 'Public Euronext Paris.',
    notes: 'Cours en baisse depuis IPO.',
  },
  ovhcloud: {
    name: 'OVHcloud',
    founded: 1999,
    founders: 'Octave Klaba (France)',
    sectorAssetClass: 'cloud infrastructure EU / capex lourd',
    keyMilestones: 'IPO Euronext Paris octobre 2021 pricing 18.5 EUR/share valuation pricing day ~3.5Md EUR.',
    currentStatus: 'Public Euronext Paris.',
  },
  ecovadis: {
    name: 'EcoVadis',
    founded: 2007,
    founders: 'Pierre-Francois Thaler, Frederic Trinel (France)',
    sectorAssetClass: 'SaaS B2B / supply chain ESG ratings / capital efficient',
    keyMilestones: 'Levee 2022 ~500M$ valuation 1Md$ devient licorne.',
    currentStatus: 'Prive.',
    notes: 'Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },

  // ============ CLIMATE SOFTWARE ============
  patch: {
    name: 'Patch',
    founded: 2020,
    founders: 'Brennan Spellacy, Aaron Grunfeld',
    sectorAssetClass: 'B2B software/marketplace / carbon removal API / capital efficient',
    keyMilestones: 'Series B 2022 55M$ Energize Ventures [Patch communique].',
    currentStatus: 'Prive.',
    notes: 'Marketplace/API carbone, pas developpeur direct de projets uniquement.',
  },
  pachama: {
    name: 'Pachama',
    founded: 2018,
    founders: 'Diego Saez Gil, Tomas Aftalion',
    sectorAssetClass: 'B2B software/marketplace / forest carbon monitoring / capital efficient',
    keyMilestones: 'Series B 2022 55M$ Future Positive [Pachama communique].',
    currentStatus: 'Prive.',
    notes: 'Verifier qualite/controverses credits carbone avant benchmark.',
  },
  persefoni: {
    name: 'Persefoni',
    founded: 2020,
    founders: 'Kentaro Kawamori, Jason Offerman',
    sectorAssetClass: 'SaaS B2B / carbon accounting / capital efficient',
    keyMilestones: 'Series B 2021 101M$ Prelude/TPG Rise [Persefoni communique].',
    currentStatus: 'Prive.',
    notes: 'CSRD/SEC climate disclosure changes peuvent affecter demande.',
  },
  plana: {
    name: 'Plan A',
    founded: 2017,
    founders: 'Lubomila Jordanova, Nathan Bonnisseau',
    sectorAssetClass: 'SaaS B2B / carbon accounting/ESG / capital efficient',
    keyMilestones: 'Series A extension 2023 27M$ Lightspeed [Plan A communique].',
    currentStatus: 'Prive.',
    notes: 'Ne pas confondre Plan A avec Plan A Technologies.',
  },
  kayrros: {
    name: 'Kayrros',
    founded: 2016,
    founders: 'Antoine Rostand, Alexandre d Aspremont, Laurent El Ghaoui (France)',
    sectorAssetClass: 'B2B data/SaaS / climate/energy intelligence satellite / deeptech data infra',
    keyMilestones: 'Donnees rounds incompletes a verifier via Dealroom/PitchBook.',
    currentStatus: 'Prive.',
    notes: 'Verifier comptes FR via Pappers/Societe.com. Data intelligence, pas carbon accounting SaaS pur.',
    needsExternalCheck: true,
  },

  // ============ SCALE-UPS INTERMEDIAIRES FR/EU ============
  brevo: {
    name: 'Brevo (ex-Sendinblue)',
    founded: 2012,
    founders: 'Armand Thiberge, Kapil Sharma (France)',
    sectorAssetClass: 'SaaS B2B / marketing automation / capital efficient',
    keyMilestones: 'Series B 2020 160M$ Bridgepoint Development Capital [Brevo communique]. Sendinblue rebrande en Brevo en 2023.',
    currentStatus: 'Prive.',
    notes: 'Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  pigment: {
    name: 'Pigment',
    founded: 2019,
    founders: 'Eleonore Crespo, Romain Niccoli (France)',
    sectorAssetClass: 'SaaS B2B / enterprise planning EPM / capital efficient',
    keyMilestones: 'Series D 2024 145M$ ICONIQ Growth valuation ~1Md$ [Pigment communique].',
    currentStatus: 'Prive.',
    notes: 'Ne pas confondre avec Anaplan. Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  talkdesk: {
    name: 'Talkdesk',
    founded: 2011,
    founders: 'Tiago Paiva, Cristina Fonseca',
    sectorAssetClass: 'SaaS B2B / contact center / scale rapide',
    keyMilestones: 'Series D 2021 230M$ Whale Rock + TI Platform valuation 10Md$ [Talkdesk communique].',
    currentStatus: 'Prive.',
    notes: 'Valuation 2021 a verifier en contexte SaaS 2022-2026.',
  },
  faire: {
    name: 'Faire',
    founded: 2017,
    founders: 'Max Rhodes, Marcelo Cortes, Daniele Perito',
    sectorAssetClass: 'B2B marketplace / wholesale / scale rapide',
    keyMilestones: 'Series G 2021 400M$ Durable/Dragoneer valuation 12.4Md$ [Faire communique].',
    currentStatus: 'Prive.',
    notes: 'B2B marketplace, pas retail DTC.',
  },
  vestiaire: {
    name: 'Vestiaire Collective',
    founded: 2009,
    founders: 'Fanny Moizant, Sophie Hersan, Alexandre Cognard (France)',
    sectorAssetClass: 'marketplace B2C+C2C / luxury resale / authentication/logistics',
    keyMilestones: 'Funding 2021 178M EUR Kering + Tiger Global valuation >1Md$ [Vestiaire communique].',
    currentStatus: 'Prive.',
    notes: 'Authentification/logistique rendent le modele plus operationnel qu une marketplace pure. Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
  manomano: {
    name: 'ManoMano',
    founded: 2013,
    founders: 'Philippe de Chanville, Christian Raisson (France)',
    sectorAssetClass: 'marketplace B2C+B2B / DIY/garden / scale rapide',
    keyMilestones: 'Series F 2021 355M$ Dragoneer valuation 2.6Md$ [ManoMano communique].',
    currentStatus: 'Prive.',
    notes: 'Ne pas confondre GMV et revenue. Verifier comptes via Pappers.',
    needsExternalCheck: true,
  },
};

/**
 * Genere un bloc texte structure pour injection dans les prompts LLM
 * (contrarian-engine, pattern-engine, blindspot-engine). Compact mais
 * lisible : le LLM peut chercher rapidement un comparable et trouver
 * les chiffres verifies sans avoir a parser un JSON.
 *
 * Si filterAssetClass est fourni, le bloc est filtre aux comparables
 * pertinents pour cet asset class plus une whitelist universelle de
 * reperes (Stripe, Airbnb, Uber, Theranos, WeWork, Ynsect, Helsing).
 * Cela divise par ~3 la taille du bloc injecte (de ~20k a ~6-7k tokens
 * sur Sonnet 4.5) et reduit le bruit dans le contexte LLM. Pour un
 * dossier deeptech defense, le LLM n a aucun usage des 34 comparables
 * SaaS B2B. Le filtrage est lossy : certains cas borderline (AI deep-
 * tech avec composante SaaS) gardent les deux univers grace au
 * matching tolerant.
 *
 * Si filterAssetClass est null ou 'all', le bloc complet est genere
 * (compatibilite avec les usages existants et fallback si la detection
 * echoue).
 */
export type ComparablesAssetClass =
  | 'saas'
  | 'deeptech_hardware'
  | 'ai_deeptech'
  | 'biotech_medtech'
  | 'fintech'
  | 'marketplace'
  | 'consumer'
  | 'all';

/**
 * Whitelist universelle. Ces comparables sont toujours injectes parce
 * qu ils servent de reperes archetypaux que tout VC connait. Ajouter
 * a la marge si un cas devient incontournable.
 */
const UNIVERSAL_KEYS = new Set([
  'airbnb', 'uber', 'stripe', 'theranos', 'wework', 'ynsect', 'helsing',
  'doctolib', 'datadog', 'figma',
]);

/**
 * Mapping de mots-cles trouves dans sectorAssetClass vers nos
 * categories canoniques. Le matching est sur sous-chaine inclusive
 * (case-insensitive). Un comparable peut matcher plusieurs categories
 * (ex : 'AI deeptech / SaaS B2B' matche saas ET ai_deeptech).
 */
const CLASS_KEYWORDS: Record<Exclude<ComparablesAssetClass, 'all'>, string[]> = {
  saas: ['saas', 'b2b software', 'software b2b', 'plateforme saas', 'logiciel'],
  deeptech_hardware: ['hardware deeptech', 'hardware industriel', 'hardware grand public', 'capex', 'industriel', 'manufacturing', 'aerospace', 'defense', 'fleet'],
  ai_deeptech: ['ai deeptech', 'fondation models', 'gpu', 'llm', 'ai infrastructure'],
  biotech_medtech: ['biotech', 'medtech', 'mrna', 'therapeutics', 'pharma', 'cardiology', 'diagnostics'],
  fintech: ['fintech', 'bnpl', 'paiement', 'banque', 'credit conso', 'insurance'],
  marketplace: ['marketplace', 'c2c', 'b2c+c2c', 'b2c+b2b'],
  consumer: ['consumer', 'e-commerce b2c', 'd2c', 'streaming', 'media', 'gaming', 'food delivery', 'mobility'],
};

function matchesAssetClass(sectorAssetClass: string, klass: Exclude<ComparablesAssetClass, 'all'>): boolean {
  const lower = sectorAssetClass.toLowerCase();
  return CLASS_KEYWORDS[klass].some(kw => lower.includes(kw));
}

/**
 * Detecte l asset class dominant d un dossier a partir des champs
 * d extraction. Heuristique deterministe : on scanne sector,
 * subSector, businessModel, productDescription pour des signaux
 * caracteristiques. Retourne 'all' si rien de net.
 */
export function detectAssetClass(extraction: any): ComparablesAssetClass {
  const text = [
    extraction?.sector,
    extraction?.subSector,
    extraction?.businessModel,
    extraction?.productDescription,
    extraction?.marketPitch,
  ].filter(Boolean).join(' ').toLowerCase();

  if (!text) return 'all';

  // Ordre de priorite : on classe selon la categorie qui a le plus
  // de signaux discriminants. Deeptech industriel/hardware passe
  // avant SaaS parce qu un dossier peut etre 'SaaS pour usine' qui
  // est en realite un dossier industriel.
  const signals = [
    { klass: 'biotech_medtech' as const, kw: ['biotech', 'medtech', 'pharmaceut', 'therapeutic', 'mrna', 'clinical', 'diagnost', 'medical device'] },
    { klass: 'deeptech_hardware' as const, kw: ['hardware', 'manufacturing', 'industrial', 'industriel', 'defense', 'défense', 'aerospace', 'aéronautique', 'spatial', 'robotic', 'capex', 'fleet', 'composant', 'production'] },
    { klass: 'ai_deeptech' as const, kw: ['foundation model', 'llm', 'large language', 'modele de fondation', 'gpu', 'training cluster', 'ai infrastructure'] },
    { klass: 'fintech' as const, kw: ['fintech', 'banque', 'banking', 'credit', 'paiement', 'payment', 'bnpl', 'insurtech', 'insurance'] },
    { klass: 'marketplace' as const, kw: ['marketplace', 'place de marché', 'two-sided', 'multi-sided', 'plateforme c2c'] },
    { klass: 'consumer' as const, kw: ['d2c', 'e-commerce', 'consumer goods', 'streaming', 'media', 'gaming', 'food delivery', 'micromobility', 'consumer brand'] },
    { klass: 'saas' as const, kw: ['saas', 'software', 'logiciel', 'b2b platform', 'plateforme b2b'] },
  ];

  for (const s of signals) {
    if (s.kw.some(k => text.includes(k))) return s.klass;
  }

  return 'all';
}

export function buildVerifiedComparablesBlock(filterAssetClass?: ComparablesAssetClass | null): string {
  const lines: string[] = [];
  lines.push('# BASE DE CHIFFRES VERIFIES DES COMPARABLES (NE PAS DEROGER)');
  lines.push('');
  lines.push('Tu trouves ci-dessous la base des chiffres verifies pour les comparables les plus frequemment cites. REGLE ABSOLUE : tu n utilises QUE les chiffres listes ici. Pour TOUT chiffre absent de cette base, tu OMETS plutot que d inventer. Mieux vaut "Airbnb a fait sa seed via Y Combinator avant son IPO 2020" que d inventer un montant. Un chiffre faux dans une note d instruction d un comparable connu (Airbnb, Stripe, Figma...) detruit immediatement la credibilite de l analyse devant un partner qui a co-investi dans ce comparable.');
  lines.push('');
  lines.push('Pour chaque comparable cite avec un chiffre, ce chiffre DOIT venir de cette base. Si tu cites un comparable qui n est PAS dans cette base, ne cite aucun chiffre precis (preferer "early stage seed", "Series A", "valuation multi-milliard", etc.).');
  lines.push('');
  lines.push('Pour les fiches marquees [verifier via source primaire], les chiffres recents 2025-2026 ou les valuations particulierement fragiles ne sont PAS triangules par communique officiel. Tu peux citer la fiche mais tu ajoutes "(a verifier via source primaire avant diffusion)" ou tu omets le chiffre fragile.');
  lines.push('');

  // Filtrage par asset class si demande. Cas par cas :
  // - 'all' ou null/undefined : on injecte tout (legacy)
  // - autre : on garde les comparables qui matchent la classe + la
  //   whitelist universelle (Stripe, Airbnb, etc. comme reperes)
  const useFilter = filterAssetClass && filterAssetClass !== 'all';
  const keys = Object.keys(VERIFIED_COMPARABLES).filter(key => {
    if (!useFilter) return true;
    if (UNIVERSAL_KEYS.has(key)) return true;
    return matchesAssetClass(VERIFIED_COMPARABLES[key].sectorAssetClass, filterAssetClass);
  });

  if (useFilter) {
    lines.push(`# Filtrage applique : asset class principal du dossier identifie comme '${filterAssetClass}'. La selection ci-dessous comporte ${keys.length} comparables pertinents pour ce profil, plus les reperes universels (Stripe, Airbnb, Uber, etc.). Les comparables hors profil ont ete retires pour reduire le bruit dans le contexte.`);
    lines.push('');
  }

  for (const key of keys) {
    const c = VERIFIED_COMPARABLES[key];
    const checkMark = c.needsExternalCheck ? ' [verifier via source primaire]' : '';
    lines.push(`## ${c.name} (${c.founded}) · ${c.sectorAssetClass}${checkMark}`);
    if (c.founders) {
      lines.push(`Fondateurs : ${c.founders}`);
    }
    lines.push(`Jalons : ${c.keyMilestones}`);
    lines.push(`Statut : ${c.currentStatus}`);
    if (c.notes) {
      lines.push(`Pieges a eviter : ${c.notes}`);
    }
    lines.push('');
  }
  lines.push('# RAPPEL FINAL');
  lines.push('Si tu cites un comparable hors de cette base, tu peux mentionner son nom et le contexte qualitatif (annee fondation, secteur), mais AUCUN chiffre precis (ni seed, ni Series, ni valuation, ni multiple). Tu peux dire "early stage", "scale-up", "succes IPO", "rachat", sans chiffrer. Toute violation de cette regle = faute critique a corriger.');
  lines.push('');
  lines.push('Pour les market caps actuelles et les valuations 2025-2026, ne pas extrapoler. Si la fiche dit "a rafraichir par finance tool" ou est marquee [verifier via source primaire], omet le chiffre exact ou indique "valuation a actualiser par source primaire".');
  return lines.join('\n');
}
