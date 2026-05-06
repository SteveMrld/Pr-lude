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
  sectorAssetClass: string;
  keyMilestones: string;
  currentStatus: string;
  notes?: string;
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
    sectorAssetClass: 'marketplace B2C / hospitality / asset-light',
    keyMilestones: 'YC W2009 + seed Sequoia ~600k$. Series A 2010 ~7M$. Series B 2011 ~112M$ DST. IPO NASDAQ:ABNB decembre 2020, pricing ~68$/share, valuation pricing day ~100Md$.',
    currentStatus: 'Public NASDAQ:ABNB. Market cap variable ~80-100Md$ selon periode 2024-2026.',
    notes: 'Pas d acquihire. NE PAS confondre seed (~600k$ Sequoia) avec rounds ulterieurs. Investisseurs cles : Sequoia (Greg McAdoo).',
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
    founded: 2016,
    sectorAssetClass: 'SaaS B2B / productivity / capital-efficient',
    keyMilestones: 'Seed/Series A 2019 ~10M$. Series B 2020 ~50M$ Index/Coatue valuation ~800M$. Series C 2021 ~275M$ valuation 10Md$.',
    currentStatus: 'Prive. Valuation 2024-2026 stable autour 10Md$.',
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
  },
  anduril: {
    name: 'Anduril',
    founded: 2017,
    sectorAssetClass: 'hardware deeptech / defense autonomous systems / capex modere',
    keyMilestones: 'Fondation 2017 par Palmer Luckey. Series E 2022 ~1.48Md$ valuation 8.5Md$. Series F 2024 ~1.5Md$ valuation 14Md$.',
    currentStatus: 'Prive.',
  },

  // ============ AI / FONDATION MODELS ============
  anthropic: {
    name: 'Anthropic',
    founded: 2021,
    sectorAssetClass: 'AI deeptech / fondation models / capex GPU lourd',
    keyMilestones: 'Fondation 2021 Dario Amodei, Daniela Amodei et autres ex-OpenAI. Series A 2022 ~124M$. Series C 2023 ~450M$ Spark Capital. Investissement Amazon cumule 2023-2024 jusqu a 8Md$. Valuation fin 2024 ~60Md$.',
    currentStatus: 'Prive. Valuation 2024-2026 ~60Md$ et croissante.',
  },
  openai: {
    name: 'OpenAI',
    founded: 2015,
    sectorAssetClass: 'AI deeptech / fondation models / capex GPU lourd',
    keyMilestones: 'Non-profit OpenAI Inc fondee decembre 2015 par Musk, Altman et autres avec engagement 1Md$. OpenAI LP for-profit creee 2019 + 1Md$ Microsoft. 10Md$ Microsoft 2023. Tender octobre 2024 6.6Md$ valuation 157Md$.',
    currentStatus: 'Prive (structure non-profit + LP for-profit). Valuation 2024-2026 ~157Md$.',
  },
  mistral: {
    name: 'Mistral AI',
    founded: 2023,
    sectorAssetClass: 'AI deeptech / fondation models open-weights / capex GPU',
    keyMilestones: 'Fondation 2023 Arthur Mensch, Guillaume Lample, Timothee Lacroix (ex-Meta, ex-DeepMind). Seed juin 2023 ~105M$ Lightspeed valuation ~260M$. Series A decembre 2023 ~415M$ valuation ~2Md$. Series B juin 2024 ~600M$ valuation ~6Md$.',
    currentStatus: 'Prive. Valuation 2024-2026 ~6-12Md$ selon tenders.',
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
    currentStatus: 'Prive. IPO depose mais reporte. Valuation 2024-2026 ~14-15Md$.',
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
};

/**
 * Genere un bloc texte structure pour injection dans les prompts LLM
 * (contrarian-engine, pattern-engine). Compact mais lisible : le LLM
 * peut chercher rapidement un comparable et trouver les chiffres
 * verifies sans avoir a parser un JSON.
 */
export function buildVerifiedComparablesBlock(): string {
  const lines: string[] = [];
  lines.push('# BASE DE CHIFFRES VERIFIES DES COMPARABLES (NE PAS DEROGER)');
  lines.push('');
  lines.push('Tu trouves ci-dessous la base des chiffres verifies pour les comparables les plus frequemment cites. REGLE ABSOLUE : tu n utilises QUE les chiffres listes ici. Pour TOUT chiffre absent de cette base, tu OMETS plutot que d inventer. Mieux vaut "Airbnb a fait sa seed via Y Combinator avant son IPO 2020" que d inventer un montant. Un chiffre faux dans une note d instruction d un comparable connu (Airbnb, Stripe, Figma...) detruit immediatement la credibilite de l analyse devant un partner qui a co-investi dans ce comparable.');
  lines.push('');
  lines.push('Pour chaque comparable cite avec un chiffre, ce chiffre DOIT venir de cette base. Si tu cites un comparable qui n est PAS dans cette base, ne cite aucun chiffre precis (preferer "early stage seed", "Series A", "valuation multi-milliard", etc.).');
  lines.push('');
  for (const key of Object.keys(VERIFIED_COMPARABLES)) {
    const c = VERIFIED_COMPARABLES[key];
    lines.push(`## ${c.name} (${c.founded}) · ${c.sectorAssetClass}`);
    lines.push(`Jalons : ${c.keyMilestones}`);
    lines.push(`Statut : ${c.currentStatus}`);
    if (c.notes) {
      lines.push(`Pieges a eviter : ${c.notes}`);
    }
    lines.push('');
  }
  lines.push('# RAPPEL FINAL');
  lines.push('Si tu cites un comparable hors de cette base, tu peux mentionner son nom et le contexte qualitatif (annee fondation, secteur), mais AUCUN chiffre precis (ni seed, ni Series, ni valuation, ni multiple). Tu peux dire "early stage", "scale-up", "succes IPO", "rachat", sans chiffrer. Toute violation de cette regle = faute critique a corriger.');
  return lines.join('\n');
}
