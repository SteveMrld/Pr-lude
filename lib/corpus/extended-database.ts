// ============================================================
// CORPUS ÉTENDU — Anthologie d'instruction VC européenne
// ------------------------------------------------------------
// Complète le corpus historique (database.ts) avec une typologie
// stratifiée pour casser le biais "licorne = succès". Le moteur
// Pattern Matching et le moteur Aveuglement consultent les deux.
//
// 4 STRATES + 1 SOUS-CORPUS TRANSVERSE
//
//   STRATE A : Succès confirmés - thèse validée, traction durable
//              (à utiliser comme exemple positif)
//   STRATE B : Paris encore ouverts - grosses levées, trajectoire
//              non encore validée (rappel : valorisation ≠ succès)
//   STRATE C : Cas mitigés ou risqués - thèse séduisante mais
//              risques structurels documentés
//   STRATE D : Échecs ou quasi-échecs - levées massives suivies
//              de baisses ou d effondrements (Theranos, WeWork,
//              cas plus subtils du marché européen)
//   QUANTIQUE: Sous-corpus transverse - terrain stratégique distinct
//              (5 acteurs FR du programme PROQCIMA + benchmarks
//              internationaux)
//
// CHAQUE FICHE SUIT TON FORMAT À 12 CHAMPS
// (cf interface ExtendedCaseRecord ci-dessous)
//
// REGLES EDITORIALES
//   - Les chiffres marqués "verifySource" doivent etre re-verifies
//     contre la source publique avant tout usage en production
//     (pas d hallucination de chiffres precis tolerable dans la
//     note d investissement)
//   - Une thèse n est jamais une press release : on cherche le
//     "vrai" pari, pas le storytelling du fonds
//   - Les sources brutes sont indicatives, datees au moment de
//     la redaction du corpus. Si le moteur les cite, il doit
//     ajouter "consulter en direct la source pour version a jour"
// ============================================================

export type ExtendedStrate = 'A-success' | 'B-open' | 'C-risky' | 'D-failure' | 'quantum';

export type WagerType =
  | 'saas-vertical'
  | 'saas-horizontal'
  | 'marketplace'
  | 'deeptech'
  | 'hardware'
  | 'fintech-regulated'
  | 'consumer'
  | 'biotech'
  | 'industrial'
  | 'media-content'
  | 'infrastructure'
  | 'web3'
  | 'genai'
  | 'quantum-hardware';

export type CaseStatus =
  | 'confirmed'      // succès validé, exit ou trajectoire incontestable
  | 'promising'      // forte traction, potentiel élevé, pas encore prouvé
  | 'fragile'        // signaux mixtes, dépendant des prochains jalons
  | 'in-difficulty'  // baisse de valorisation, layoffs, perte de momentum
  | 'too-early';     // < 3 ans d activité, pas assez de recul

export interface ExtendedCaseRecord {
  // 1. Identité
  id: string;
  name: string;
  country: string;
  city?: string;

  // 2. Secteur
  sector: string;
  subSector?: string;

  // 3. Montant levé cumulé (best estimate, en M€ ou M$ selon sourcing)
  totalRaised: {
    amount: number;
    currency: 'EUR' | 'USD';
    asOf: string; // 'YYYY' ou 'YYYY-Q[1-4]'
    verifySource: boolean; // true = chiffre à re-vérifier avant publication
  };

  // 4. Type de pari
  wagerType: WagerType;

  // 5. Thèse initiale
  thesis: string;

  // 6. Pourquoi le fonds a dit oui (la thèse cote investisseur)
  whyYes: string;

  // 7. Pourquoi d autres ont pu / auraient pu dire non
  whyNo: string;

  // 8. Risque principal
  primaryRisk: string;

  // 9. Traction réelle (ce qu on sait de mesurable)
  realTraction: string;

  // 10. Statut actuel
  status: CaseStatus;
  statusContext?: string; // commentaire libre

  // 11. Pattern réutilisable pour le moteur (ce que l outil doit retenir)
  reusablePattern: string;

  // 12. Sources brutes
  sources: string[];

  // Metadata supplementaires
  strate: ExtendedStrate;
  yearFounded: number;
  keyInvestors: string[];
  isQuantum?: boolean; // true si appartient au sous-corpus quantique
}

// ============================================================
// STRATE A — SUCCES CONFIRMES (10 cas)
// ============================================================

const STRATE_A: ExtendedCaseRecord[] = [
  {
    id: 'mistral-ai',
    name: 'Mistral AI',
    country: 'France',
    city: 'Paris',
    sector: 'IA générative',
    subSector: 'Foundation models',
    totalRaised: { amount: 1100, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'genai',
    thesis: "Construire des modèles de langage open-weight performants et plus efficients que les concurrents américains, en pariant sur la souveraineté européenne et l efficacité plutôt que la course aux paramètres.",
    whyYes: "Équipe scientifique de premier plan (DeepMind, Meta), pari de souveraineté européenne au moment précis où l Europe cherchait un champion IA, capacité de recrutement unique, momentum de levée extraordinaire (105M€ seed sans produit), thèse 'efficiency is the new scale' qui parle aux fonds anti-OpenAI.",
    whyNo: "Pas de produit au seed, ticket d entrée jugé excessif (105M€ pour une boîte de 4 semaines), course aux paramètres considérée comme perdue d avance face aux GAFAM, doute sur la capacité d execution commerciale (équipe 100% recherche).",
    primaryRisk: "Compression des marges si les LLM open-source deviennent commodities, dépendance à des contrats stratégiques (Microsoft, partenariats souverains), course infinie au capital pour rester dans le tempo.",
    realTraction: "Modèles Mixtral et Mistral Large adoptés rapidement, partenariat Microsoft Azure 2024, contrats souverains annoncés (BNP, French gov), valorisation 6Mds€ atteinte en 18 mois.",
    status: 'promising',
    statusContext: "Trajectoire spectaculaire mais le test de la rentabilité unitaire face aux GAFAM reste à venir. Brûle cash-intensive du segment.",
    reusablePattern: "Equipe scientifique top-tier sans pedigree commercial peut signer une mega-seed si le moment macro est aligné (souveraineté EU, Europe cherchant un champion). Le pari est sur la rétention de talents, pas sur la traction.",
    sources: [
      'https://mistral.ai',
      'https://www.indexventures.com (memos publics)',
      'Press : Le Monde, Sifted 2023-2024',
    ],
    strate: 'A-success',
    yearFounded: 2023,
    keyInvestors: ['Andreessen Horowitz', 'Lightspeed', 'General Catalyst', 'Index Ventures', 'BNF', 'Microsoft'],
  },
  {
    id: 'doctolib',
    name: 'Doctolib',
    country: 'France',
    city: 'Paris',
    sector: 'HealthTech',
    subSector: 'SaaS médical',
    totalRaised: { amount: 800, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'saas-vertical',
    thesis: "Devenir l infrastructure logicielle des professionnels de santé européens en partant d un cas d usage simple (réduction des no-shows) puis en élargissant à toute la stack médicale (téléconsultation, dossier patient, gestion administrative).",
    whyYes: "Équipe de fondateurs serial (Stanislas Niox-Chateau, Ivan Schneider), modèle SaaS B2B avec ROI immédiat pour le médecin (no-shows réduits de 75%), effet de réseau bilatéral (médecins ↔ patients), expansion européenne crédible (DACH avant USA).",
    whyNo: "Vendre à une profession 'non-digitale' notoirement réfractaire au changement, corporatisme médical français, faibles marges sur l abonnement initial, concurrence frontale avec acteurs locaux historiques (Medical, Cegedim).",
    primaryRisk: "Régulation européenne sur les données de santé, dépendance à un seul ARS / régulateur national, possibilité que les ordres professionnels développent leur propre solution.",
    realTraction: "+340 000 personnels de santé utilisateurs (2024), >70M de prises de RDV mensuelles, expansion DACH validée, pivot téléconsultation 2020 transformé en avantage stratégique pendant le COVID.",
    status: 'confirmed',
    statusContext: "Considéré comme l infrastructure de référence sur le marché européen de la santé.",
    reusablePattern: "Un SaaS vertical résout un point de douleur opérationnel (no-shows) avant de devenir une plateforme. L expansion produit suit la confiance gagnée sur le cas d usage initial. C est l inverse d une marketplace.",
    sources: [
      'https://www.doctolib.fr',
      'Accel blog posts',
      'Sifted, Maddyness 2019-2024',
    ],
    strate: 'A-success',
    yearFounded: 2013,
    keyInvestors: ['Accel', 'General Atlantic', 'Eurazeo', 'Bpifrance'],
  },
  {
    id: 'qonto',
    name: 'Qonto',
    country: 'France',
    city: 'Paris',
    sector: 'FinTech',
    subSector: 'Néobanque B2B',
    totalRaised: { amount: 700, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'fintech-regulated',
    thesis: "Devenir le système d exploitation financier des PME européennes : compte bancaire pro avec UX irréprochable, automatisation comptable, et expansion progressive vers le spend management complet.",
    whyYes: "Équipe ex-Smile, pari sur l UX comme arme face aux banques traditionnelles, marché européen sous-équipé (PME mal servies), agrément établissement de paiement obtenu rapidement, expansion DACH/IT/ES validée par les chiffres.",
    whyNo: "Concurrence directe avec néobanques B2B existantes (N26, Revolut Business), thématique bancaire à barrières réglementaires lourdes, marges fines, dépendance aux taux d intérêt.",
    primaryRisk: "Compression des marges d intérêt en cas de baisse de taux, durcissement réglementaire (BCE, ACPR), saturation du marché PME européen.",
    realTraction: "+500 000 entreprises clientes (2024), expansion confirmée DACH/IT/ES, profitabilité opérationnelle annoncée 2024.",
    status: 'confirmed',
    reusablePattern: "Un produit fintech B2B peut s imposer face aux banques traditionnelles sur le segment PME précisément parce que ce segment est mal servi par les acteurs historiques. UX = moat plus puissant que prix.",
    sources: [
      'https://qonto.com',
      'Press : Les Echos, Sifted 2020-2024',
    ],
    strate: 'A-success',
    yearFounded: 2017,
    keyInvestors: ['Valar Ventures', 'DST Global', 'Tencent', 'Tiger Global', 'Alven'],
  },
  {
    id: 'alan',
    name: 'Alan',
    country: 'France',
    city: 'Paris',
    sector: 'InsurTech',
    subSector: 'Assurance santé directe',
    totalRaised: { amount: 600, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'fintech-regulated',
    thesis: "Devenir l assureur santé full-stack le plus aimé d Europe : licence d assurance propre (pas de réassurance cachée), remboursement instantané, app moderne, et extension progressive vers le wellness/préventif.",
    whyYes: "Première licence d assurance accordée par l ACPR depuis 1986 (barrière réglementaire franchie), équipe ex-Polytechnique/Drivy, NPS 70+ inédit dans l assurance, pari sur la transparence comme avantage culturel, modèle full-stack contre les courtiers blancs.",
    whyNo: "Doute sur la capacité d une startup à gérer Solvabilité II et fonds de réserve, marché de l assurance complémentaire santé saturé en France, marketing B2B coûteux, exit difficile (les assureurs traditionnels rachètent peu de tech).",
    primaryRisk: "Sinistralité non maîtrisée (un cycle d arrêts maladie élevés peut casser la marge), concurrence des assureurs historiques qui copient le digital, durcissement de Solvabilité.",
    realTraction: "+500 000 bénéficiaires (2024), >25 000 entreprises clientes, expansion BE/ES annoncée, NPS maintenu à 70+.",
    status: 'promising',
    statusContext: "Trajectoire forte mais la profitabilité reste à atteindre sur un segment où les marges sont structurellement faibles.",
    reusablePattern: "La licence régulée n est pas qu une barrière : elle est aussi le moat. Posséder l infra (licence) transforme une startup en assureur de plein droit qui contrôle toute la chaîne de valeur.",
    sources: ['https://alan.com'],
    strate: 'A-success',
    yearFounded: 2016,
    keyInvestors: ['Index Ventures', 'Coatue', 'DST Global', 'Temasek'],
  },
  {
    id: 'contentsquare',
    name: 'Contentsquare',
    country: 'France',
    city: 'Paris',
    sector: 'MarTech',
    subSector: 'UX Analytics',
    totalRaised: { amount: 1200, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'saas-horizontal',
    thesis: "Capturer non pas ce que l utilisateur clique mais comment il interagit (mouvements, hésitations, rage clicks) pour donner aux retailers et publishers les moyens d optimiser concrètement les conversions.",
    whyYes: "Différenciation claire face à Google Analytics (le 'pourquoi' vs le 'quoi'), expansion US ultra-agressive validée par l acquisition Clicktale, contrats Fortune 500 (ASOS, BMW, Walmart), équipe internationale.",
    whyNo: "Catégorie 'session replay' déjà occupée (FullStory, Hotjar), risque de commoditisation, dépendance aux budgets marketing cycliques.",
    primaryRisk: "Compression du marché analytics suite à la fin des cookies tiers, durcissement RGPD/privacy, concurrence des acteurs qui intègrent verticalement (Adobe, Salesforce).",
    realTraction: ">1Md$ de revenue annoncé en 2024, +1000 entreprises clientes Fortune 500, profitabilité atteinte.",
    status: 'confirmed',
    reusablePattern: "Une catégorie peut être créée par redéfinition du problème (cliquer vs interagir). L acquisition stratégique d un concurrent (Clicktale) consolide la catégorie et accélère le passage à leader mondial.",
    sources: ['https://contentsquare.com'],
    strate: 'A-success',
    yearFounded: 2012,
    keyInvestors: ['SoftBank', 'Eurazeo', 'BlackRock', 'Highland Europe'],
  },
  {
    id: 'dataiku',
    name: 'Dataiku',
    country: 'France',
    city: 'Paris / New York',
    sector: 'Data / AI',
    subSector: 'Plateforme data science',
    totalRaised: { amount: 850, currency: 'USD', asOf: '2023', verifySource: true },
    wagerType: 'saas-horizontal',
    thesis: "Démocratiser la data science en créant un espace collaboratif où data engineers, scientists et business users travaillent sur le même projet, en s opposant à la fragmentation des outils américains.",
    whyYes: "Pari early sur la collaboration multi-profils dans la data, déplacement du HQ à NYC qui débloque l accès aux talents US, leadership Gartner Magic Quadrant, ARR croissance >50% annuelle pendant 6 ans.",
    whyNo: "Catégorie 'data platform' surchargée (Databricks, Snowflake, Palantir), risque d être squeezé par les hyperscalers (AWS SageMaker), positionnement perçu comme 'low-code' donc moins technique que les concurrents.",
    primaryRisk: "Commoditisation par les hyperscalers, dépendance aux gros contrats Fortune 500, IPO retardée plusieurs fois.",
    realTraction: ">600 entreprises clientes (Fortune 500), valorisation 3,7Mds$, leader Gartner.",
    status: 'confirmed',
    reusablePattern: "Une boîte française peut devenir leader mondial à condition d accepter de migrer son centre de gravité commercial aux US. Le HQ à NY n est pas un détail, c est une décision structurelle.",
    sources: ['https://dataiku.com'],
    strate: 'A-success',
    yearFounded: 2013,
    keyInvestors: ['Tiger Global', 'Battery Ventures', 'Capital One Growth', 'Insight Partners'],
  },
  {
    id: 'mirakl',
    name: 'Mirakl',
    country: 'France',
    city: 'Paris',
    sector: 'E-commerce SaaS',
    subSector: 'Marketplace platform',
    totalRaised: { amount: 900, currency: 'USD', asOf: '2023', verifySource: true },
    wagerType: 'saas-vertical',
    thesis: "Permettre à tous les retailers traditionnels (Carrefour, Macy s, Kroger) de se transformer en marketplaces sans construire la techno eux-mêmes, en pariant sur le fait qu Amazon ne peut pas tout gagner.",
    whyYes: "Pari early et solitaire sur la marketplace-as-a-service, contrats avec retailers tier-1 mondiaux, effet réseau (plus de marchands tiers = plus de catalogue = plus de retailers signent), GMV >4Mds$.",
    whyNo: "Cycle de vente très long (12-18 mois pour un grand retailer), ticket élevé qui exclut les PME, dépendance à la santé économique des retailers traditionnels.",
    primaryRisk: "Cycles d achat retail longs, consolidation du retail (un client perdu = millions perdus), concurrence d Amazon Marketplace as a Service.",
    realTraction: "+450 marketplaces lancées, +4Mds$ de GMV transitant, expansion JP/US/EU validée.",
    status: 'confirmed',
    reusablePattern: "Vendre les outils de l affrontement plutôt que d affronter. Mirakl ne combat pas Amazon, il vend aux retailers les outils pour exister face à Amazon. Le 'arms dealer' wins.",
    sources: ['https://mirakl.com'],
    strate: 'A-success',
    yearFounded: 2012,
    keyInvestors: ['Permira', 'Silver Lake', '83North', 'Bain Capital Ventures'],
  },
  {
    id: 'exotec',
    name: 'Exotec',
    country: 'France',
    city: 'Croix (Lille)',
    sector: 'Robotique industrielle',
    subSector: 'Robotique d entrepôt',
    totalRaised: { amount: 450, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'hardware',
    thesis: "Devenir le standard mondial de la robotique d entrepôt en exploitant la 3D (robots Skypod qui grimpent aux étagères) au lieu de la 2D des concurrents américains, pour multiplier par 5 la densité de stockage.",
    whyYes: "Différenciation technologique réelle (3D vs 2D), contrats massifs Uniqlo / Carrefour / Gap, pari deeptech français crédible avec ingénierie de pointe (Polytechnique, Centrale), 1ère licorne industrielle hors capitale.",
    whyNo: "Capex massif (chaque déploiement coûte des millions), risque industriel à scale (production des robots), concurrence frontale avec acteurs établis (Symbotic, AutoStore, Berkshire Grey).",
    primaryRisk: "Capex client en cas de récession (les warehouses retardent les investissements), pression sur les marges si AutoStore/Symbotic baissent leurs prix, dépendance aux supply chains semi-conducteurs.",
    realTraction: "+30 sites déployés mondialement, contrats récurrents avec Uniqlo, Carrefour, Gap, Decathlon, valorisation 2Mds$.",
    status: 'confirmed',
    statusContext: "Pari industriel hardware réussi, ce qui est très rare en Europe. Reste à voir la résilience en cas de récession globale.",
    reusablePattern: "Une thèse hardware deeptech française peut s imposer mondialement si la différenciation technique est mesurable (5x densité) ET que les premiers clients sont des références internationales (Uniqlo).",
    sources: ['https://exotec.com'],
    strate: 'A-success',
    yearFounded: 2015,
    keyInvestors: ['Goldman Sachs', '83North', 'Iris Capital', 'Bpifrance'],
  },
  {
    id: 'pennylane',
    name: 'Pennylane',
    country: 'France',
    city: 'Paris',
    sector: 'FinTech',
    subSector: 'Comptabilité SaaS',
    totalRaised: { amount: 250, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'saas-vertical',
    thesis: "Construire le système d exploitation financier des PME en s alliant aux experts-comptables (et non en les concurrençant), pour devenir la couche unique où le dirigeant et son comptable travaillent sur la même donnée temps-réel.",
    whyYes: "Pivot stratégique réussi (cabinet d expertise comptable hybride → 100% SaaS), réseau de cabinets-prescripteurs construit au lieu de combat frontal, dernière licorne française annoncée 2024, équipe Sequoia-backed.",
    whyNo: "Concurrence directe Cegid, Sage, EBP (acteurs historiques), marché de la comptabilité PME perçu comme saturé, pivot risqué (abandon du cabinet propre).",
    primaryRisk: "Lenteur d adoption par les cabinets traditionnels, risque concurrentiel si Cegid/Sage migrent leur infra cloud, dépendance aux régulations fiscales nationales.",
    realTraction: ">250 000 PME utilisatrices, ~3 000 cabinets partenaires, valorisation 2Mds€ (2024).",
    status: 'promising',
    statusContext: "Statut licorne récent, à confirmer sur 24 mois. Le risque de plateau d adoption est réel.",
    reusablePattern: "S allier aux prescripteurs traditionnels (comptables) plutôt que les concurrencer = thèse stratégique gagnante en B2B vertical réglementé. C est l opposé du 'disrupt or die'.",
    sources: ['https://pennylane.com'],
    strate: 'A-success',
    yearFounded: 2020,
    keyInvestors: ['Sequoia', 'DST Global', 'Partech', 'Global Founders Capital'],
  },
  {
    id: 'ecovadis',
    name: 'EcoVadis',
    country: 'France',
    city: 'Paris',
    sector: 'GovTech / RSE',
    subSector: 'Notation extra-financière',
    totalRaised: { amount: 750, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'saas-horizontal',
    thesis: "Devenir le 'Moody s du développement durable' en notant les pratiques RSE des fournisseurs de la chaîne d approvisionnement mondiale, en pariant sur le fait que la régulation européenne (CSRD) va imposer ces audits.",
    whyYes: "Pari early sur la régulation extra-financière qui s est confirmé avec CSRD, position de standard de fait (15 ans d antériorité), effet réseau sur le scoring, ARR récurrent fort.",
    whyNo: "Catégorie 'ESG' considérée comme effet de mode, dépendance aux orientations politiques (un Trump 2.0 peut casser la dynamique RSE US), concurrence des Big4 qui descendent sur le segment.",
    primaryRisk: "Backlash anti-ESG aux US, ralentissement de la régulation européenne (omnibus simplification CSRD 2025), concurrence Big4 (KPMG, EY) sur le scoring.",
    realTraction: "+125 000 entreprises notées, plus de 1Mds$ de chiffre d affaires impliqué, présence dans 175 pays.",
    status: 'confirmed',
    reusablePattern: "Anticiper la régulation est plus puissant que la suivre. EcoVadis a 15 ans d avance sur CSRD parce qu ils ont parié sur la trajectoire normative, pas sur la demande spontanée des entreprises.",
    sources: ['https://ecovadis.com'],
    strate: 'A-success',
    yearFounded: 2007,
    keyInvestors: ['CVC Capital Partners', 'GIC', 'Astorg'],
  },
];

// ============================================================
// STRATE B — PARIS ENCORE OUVERTS (10 cas)
// ============================================================

const STRATE_B: ExtendedCaseRecord[] = [
  {
    id: 'sorare',
    name: 'Sorare',
    country: 'France',
    city: 'Paris',
    sector: 'Web3 / Sport',
    subSector: 'Fantasy sport NFT',
    totalRaised: { amount: 740, currency: 'USD', asOf: '2021', verifySource: true },
    wagerType: 'web3',
    thesis: "Créer le fantasy sport mondial sur blockchain en s appuyant sur la rareté digitale des cartes de joueurs, sécurisée par les licences exclusives des ligues officielles.",
    whyYes: "Licences exclusives MLB / Premier League / Liga / Bundesliga (vrai moat), équipe internationale, pari early sur le NFT 'utility' vs 'pure spec', tour record européen 680M$ Série B 2021.",
    whyNo: "Régulation jeu d argent dans plusieurs pays (notamment France), dépendance au cycle crypto, modèle perçu comme spéculatif par les investisseurs traditionnels.",
    primaryRisk: "Crypto winter prolongé impacte volume et engagement, qualification 'jeux d argent' par l ANJ qui imposerait régulation lourde, baisse de l intérêt pour les NFT.",
    realTraction: "Volume de transactions 150M$+ en pic 2021, baisse significative depuis 2022, layoffs annoncés, pivot produit en cours.",
    status: 'fragile',
    statusContext: "Levée à 4,3Mds$ valorisation au pic, situation actuelle plus tendue. Le test du second souffle est en cours.",
    reusablePattern: "Une thèse contrariennne (NFT utility vs spec) peut générer une mega-levée si elle est validée par des partenaires institutionnels (ligues officielles). Mais la valorisation doit être justifiée hors cycle de hype.",
    sources: ['https://sorare.com'],
    strate: 'B-open',
    yearFounded: 2018,
    keyInvestors: ['SoftBank', 'Atomico', 'Benchmark', 'Headline'],
  },
  {
    id: 'ledger',
    name: 'Ledger',
    country: 'France',
    city: 'Paris',
    sector: 'Crypto / Sécurité',
    subSector: 'Hardware wallet',
    totalRaised: { amount: 580, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'hardware',
    thesis: "Devenir l infrastructure de sécurité de référence pour la possession crypto en vendant les 'pelles et pioches' (hardware wallets) plutôt qu en pariant sur les cours.",
    whyYes: "Position de leader mondial confirmée (>6M de wallets vendus), thèse 'be your own bank' validée par les fails CEX (FTX, Celsius), équipe technique forte sur la cryptographie.",
    whyNo: "Marché ultra-cyclique (hardware wallet sales corrélées au prix BTC), controverse Ledger Recover 2023 qui a fragilisé la base utilisateurs, concurrence émergente Trezor/Coldcard.",
    primaryRisk: "Crypto winter prolongé, controverse sur la sécurité (recover service), risque de désintermédiation si les exchanges deviennent crédibles à nouveau.",
    realTraction: ">6M de wallets vendus, valorisation 1,5Md$ confirmée 2023, mais croissance ralentie depuis 2022.",
    status: 'fragile',
    statusContext: "Statut licorne maintenu mais croissance dépendante du cycle crypto. Le test 2025-2027 sera crucial.",
    reusablePattern: "Vendre les outils de la spéculation sans spéculer = position défensive forte mais cyclique. La thèse 'arms dealer' échappe partiellement aux krachs sectoriels mais pas complètement.",
    sources: ['https://ledger.com'],
    strate: 'B-open',
    yearFounded: 2014,
    keyInvestors: ['10T Holdings', 'Cathay Innovation', 'Cité Gestion', 'Draper Esprit'],
  },
  {
    id: 'swile',
    name: 'Swile',
    country: 'France',
    city: 'Montpellier / Paris',
    sector: 'FinTech RH',
    subSector: 'Avantages salariés',
    totalRaised: { amount: 280, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'fintech-regulated',
    thesis: "Le ticket-restaurant est un cheval de Troie pour devenir la super-app de l engagement collaborateur (cagnottes, primes, sondages, épargne salariale).",
    whyYes: "Pari early sur la dématérialisation des titres-resto, rachat Bimpli BPCE qui a accéléré la base installée, thèse super-app séduisante pour SoftBank/Index.",
    whyNo: "Concurrence frontale Edenred/Pluxee (acteurs historiques massifs), dépendance régulation titres-resto, vrai test du super-app pas encore atteint, ARR par utilisateur faible.",
    primaryRisk: "Edenred peut écraser par le réseau marchands, possible révision réglementaire des titres-resto, super-app reste théorique (faible adoption des modules au-delà du resto).",
    realTraction: ">5 000 entreprises clientes, base installée significative post-Bimpli, mais profitabilité non communiquée.",
    status: 'fragile',
    statusContext: "Levée à 1Md$+ au pic 2021. Depuis, le test de la rentabilité reste à venir.",
    reusablePattern: "Le 'cheval de Troie' (titre-resto) ne suffit pas à construire une super-app si l adoption des modules secondaires reste faible. La thèse super-app est rare et difficile à valider.",
    sources: ['https://swile.co'],
    strate: 'B-open',
    yearFounded: 2018,
    keyInvestors: ['SoftBank', 'Index Ventures', 'Bpifrance'],
  },
  {
    id: 'manomano',
    name: 'ManoMano',
    country: 'France',
    city: 'Paris',
    sector: 'E-commerce',
    subSector: 'Marketplace bricolage',
    totalRaised: { amount: 600, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'marketplace',
    thesis: "Devenir le verticaliste du DIY/bricolage en Europe, en s appuyant sur l expertise (communauté de Manodvisors) pour battre Amazon sur la pertinence des conseils.",
    whyYes: "Pari verticaliste cohérent (Amazon ne sait pas conseiller sur une perceuse), accélération COVID confirmée, expansion européenne validée, communauté Manodvisors comme moat.",
    whyNo: "Capex logistique massif (produits lourds/encombrants), marges marketplace faibles, concurrence Leroy Merlin / Castorama qui digitalisent rapidement.",
    primaryRisk: "Resserrement du pouvoir d achat (DIY est cyclique), concurrence des retailers traditionnels qui passent au omnichannel, layoffs déjà annoncés en 2023.",
    realTraction: "+7M de clients actifs, présence FR/IT/ES/DE/UK, mais layoffs 2023 et baisse de valorisation rumored.",
    status: 'in-difficulty',
    statusContext: "Levée à 2,6Mds$ valorisation au pic 2021. Layoffs annoncés en 2023. Trajectoire à confirmer.",
    reusablePattern: "Une thèse verticaliste peut être supérieure à un horizontaliste sur le conseil (DIY), mais ne survit qu en cycle haussier. La consumer discretionary est cyclique structurellement.",
    sources: ['https://manomano.com'],
    strate: 'B-open',
    yearFounded: 2013,
    keyInvestors: ['General Atlantic', 'Temasek', 'Eurazeo', 'Bpifrance'],
  },
  {
    id: 'vestiaire-collective',
    name: 'Vestiaire Collective',
    country: 'France',
    city: 'Paris',
    sector: 'E-commerce / Luxe',
    subSector: 'Marketplace seconde main luxe',
    totalRaised: { amount: 470, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'marketplace',
    thesis: "Devenir la marketplace mondiale de référence du luxe seconde main en pariant sur l authentification physique comme moat anti-contrefaçon, et sur l adoption circulaire chez les millennials/Gen Z.",
    whyYes: "Marché seconde main luxe en croissance 4× le neuf, validation Kering au capital qui transforme les maisons de luxe d ennemies en partenaires, équipe internationale, expansion US.",
    whyNo: "Marges marketplace faibles, capex authentification massif, concurrence The RealReal / Rebag déjà installée aux US, fashion volatile.",
    primaryRisk: "Récession qui impacte le luxe (cyclique), concurrence montante (Vinted Pro, eBay Luxury), pression marges si TheRealReal baisse les commissions.",
    realTraction: "+25M d utilisateurs, +10M d articles listés, layoffs 2023, profitabilité non atteinte.",
    status: 'fragile',
    statusContext: "Statut licorne (1,7Md$ pic 2021) mais layoffs et restructuration en cours. Trajectoire à reconstruire.",
    reusablePattern: "Le luxe + circulaire est une thèse alignée avec les méga-tendances (climat, Gen Z), mais la marketplace seconde main reste un modèle à marges fines difficile à rentabiliser.",
    sources: ['https://vestiairecollective.com'],
    strate: 'B-open',
    yearFounded: 2009,
    keyInvestors: ['Kering', 'Tiger Global', 'Eurazeo', 'Bpifrance'],
  },
  {
    id: 'back-market',
    name: 'Back Market',
    country: 'France',
    city: 'Paris',
    sector: 'E-commerce',
    subSector: 'Reconditionné électronique',
    totalRaised: { amount: 800, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'marketplace',
    thesis: "Faire du reconditionné un marché premium et fiable en notant les usines de reconditionnement et en garantissant les produits, pour transformer un marché 'gris' en marque mondiale.",
    whyYes: "Pari early sur l économie circulaire validé par les méga-tendances climat, validation Aglaé (Bernard Arnault) qui crédibilise auprès du retail premium, expansion US/JP.",
    whyNo: "Marges marketplace faibles, dépendance au cycle smartphone (iPhone reconditionnés = 60% du volume), pression Amazon Renewed, vérification qualité difficile à scaler.",
    primaryRisk: "Cycle smartphone ralentit globalement, Amazon Renewed agressif, layoffs déjà annoncés en 2024.",
    realTraction: "+6M de clients, présence dans 18 pays, mais layoffs 2024 et baisse de valorisation rumored vs pic 2022 (5,7Mds$).",
    status: 'fragile',
    reusablePattern: "Une thèse circulaire est puissante mais reste un modèle marketplace donc à marges fines. Le test est la défense du moat (notation usines) face à Amazon Renewed.",
    sources: ['https://backmarket.com'],
    strate: 'B-open',
    yearFounded: 2014,
    keyInvestors: ['General Atlantic', 'Aglaé Ventures', 'Eurazeo', 'Goldman Sachs'],
  },
  {
    id: 'payfit',
    name: 'PayFit',
    country: 'France',
    city: 'Paris',
    sector: 'HR Tech',
    subSector: 'Paie + SIRH',
    totalRaised: { amount: 380, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'saas-vertical',
    thesis: "Industrialiser la paie et le SIRH pour PME européennes en codant les règles du droit du travail dans un langage propriétaire (JetLang), pour scaler par traduction de règles et non par recoding pays par pays.",
    whyYes: "Approche technique différenciante (JetLang), expansion européenne validée FR/UK/ES/DE/IT, ticket B2B PME large et récurrent.",
    whyNo: "Concurrence ADP / Sage / Cegid / Silae, marchés paie nationaux silotés (chaque pays = relégalisation), dépendance aux changements législatifs.",
    primaryRisk: "Layoffs annoncés 2023 (-20% effectifs), retrait du marché allemand 2023 (DACH), profitabilité non atteinte.",
    realTraction: "+15 000 PME clientes, mais retrait DACH = signal négatif sur la stratégie d expansion.",
    status: 'in-difficulty',
    statusContext: "Layoffs et retrait DACH 2023. Re-focus FR/UK/ES, qui rétrécit la thèse initiale.",
    reusablePattern: "L expansion européenne peut être plus dure que prévu même avec une thèse technique forte. JetLang est puissant mais la complexité GTM (sales locales, partenariats comptables) reste sous-estimée.",
    sources: ['https://payfit.com'],
    strate: 'B-open',
    yearFounded: 2015,
    keyInvestors: ['Eurazeo', 'General Atlantic', 'Accel', 'Bpifrance'],
  },
  {
    id: 'believe',
    name: 'Believe',
    country: 'France',
    city: 'Paris',
    sector: 'Music Tech',
    subSector: 'Distribution musicale digitale',
    totalRaised: { amount: 300, currency: 'EUR', asOf: '2021', verifySource: true },
    wagerType: 'media-content',
    thesis: "Démocratiser la distribution musicale en signant des artistes indépendants partout dans le monde, en pariant sur le streaming pour bouleverser le modèle des majors.",
    whyYes: "Pari early sur le streaming, échelle internationale (Inde, Asie), IPO Euronext 2021 qui a validé la maturité du modèle.",
    whyNo: "Pression sur les marges (Spotify garde la majorité), concurrence des majors qui copient le modèle indé (UMG / Virgin), modèle scale-dépendant.",
    primaryRisk: "OPA réussie de TCV / Warner / EQT en 2024 à 1,5Md€, valorisation très inférieure au pic post-IPO. Sortie de la cote 2024.",
    realTraction: "+50 000 artistes signés, profitable, mais valorisation chute >50% vs IPO 2021.",
    status: 'in-difficulty',
    statusContext: "OPA 2024 à 1,5Mds€, valorisation très en-dessous du pic IPO 2021. Le pari publique a été dur.",
    reusablePattern: "L IPO n est pas un statut de succès permanent. Une trajectoire qui paraissait validée à l IPO peut s effriter en 24 mois si le marché change d humeur sur la catégorie (music tech).",
    sources: ['https://believe.com'],
    strate: 'B-open',
    yearFounded: 2005,
    keyInvestors: ['TCV', 'Warner Music', 'EQT (post-OPA)'],
  },
  {
    id: 'ovhcloud',
    name: 'OVHcloud',
    country: 'France',
    city: 'Roubaix',
    sector: 'Cloud Infrastructure',
    subSector: 'IaaS souverain',
    totalRaised: { amount: 350, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'infrastructure',
    thesis: "Construire le cloud souverain européen en contrôlant toute la chaîne (serveurs maison, watercooling, datacenters propres), pour offrir une alternative crédible aux GAFAM à 30% moins cher.",
    whyYes: "Pari souveraineté validé par les régulations européennes (Cloud Act, RGPD), modèle hardware-intégré différenciant, expansion européenne réelle.",
    whyNo: "Concurrence frontale AWS/Azure/GCP avec budgets infinis, marges fines, incident Strasbourg 2021 (incendie datacenter) qui a fragilisé la confiance.",
    primaryRisk: "Capex massif difficile à amortir, dépendance aux supply chains (puces, baies serveurs), perception 'low-cost' qui empêche le saut vers les contrats mid/large enterprise.",
    realTraction: "Près de 1Md€ de CA, IPO 2021, mais cours de bourse en baisse continue depuis (-40% vs IPO), valorisation actuelle ~1,8Mds€.",
    status: 'fragile',
    statusContext: "IPO 2021 à 3,5Mds€. Cours en baisse continue. Valorisation actuelle ~50% du pic.",
    reusablePattern: "La thèse souveraineté est puissante mais ne se traduit pas automatiquement en multiples boursiers. Le marché valorise la croissance avant la souveraineté.",
    sources: ['https://ovhcloud.com'],
    strate: 'B-open',
    yearFounded: 1999,
    keyInvestors: ['Klaba family', 'KKR (sortie 2021)', 'TowerBrook', 'Public (Euronext)'],
  },
  {
    id: 'sorare-bis',
    name: 'Spendesk',
    country: 'France',
    city: 'Paris',
    sector: 'FinTech',
    subSector: 'Spend management',
    totalRaised: { amount: 300, currency: 'USD', asOf: '2022', verifySource: true },
    wagerType: 'fintech-regulated',
    thesis: "Industrialiser la gestion des dépenses pro avec cartes virtuelles, validation amont des achats, et intégration comptable, pour libérer les équipes finance des reçus papier.",
    whyYes: "Pari sur la fin du remboursement personnel pro, accélération COVID/télétravail, équipe Index/Eight Roads, ARR croissance forte 2020-2021.",
    whyNo: "Concurrence directe Pleo / Mooncard / Qonto qui ajoutent du spend management, marges fines (intermédiation Mastercard), saturation du segment européen.",
    primaryRisk: "Layoffs annoncés 2023, valorisation possiblement réduite vs pic 2022 (1,5Mds$), Qonto qui descend sur le segment.",
    realTraction: "+5 000 entreprises clientes, mais layoffs 2023.",
    status: 'fragile',
    statusContext: "Statut licorne 2022 mais réajustement opérationnel 2023.",
    reusablePattern: "Une catégorie B2B fintech peut atteindre licorne rapidement en cycle haussier mais le retour à la profitabilité teste la vraie résilience du modèle.",
    sources: ['https://spendesk.com'],
    strate: 'B-open',
    yearFounded: 2016,
    keyInvestors: ['Index Ventures', 'General Atlantic', 'Eight Roads'],
  },
];

// ============================================================
// STRATE C — CAS MITIGES OU RISQUES (8 cas)
// ============================================================

const STRATE_C: ExtendedCaseRecord[] = [
  {
    id: 'verkor',
    name: 'Verkor',
    country: 'France',
    city: 'Grenoble',
    sector: 'Industrie / Battery',
    subSector: 'Gigafactory batteries',
    totalRaised: { amount: 1300, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'industrial',
    thesis: "Construire la gigafactory bas-carbone française pour batteries automobiles haute performance, en se positionnant sur le segment premium (Renault, Stellantis) face aux acteurs asiatiques.",
    whyYes: "Soutien public massif (France 2030, Pacte Vert), partenariats Renault/Stellantis, équipe ex-Tesla / Northvolt, alignement souveraineté batteries européenne.",
    whyNo: "Capex colossal (>2Mds€), Northvolt (référence européenne) déjà en difficulté financière, concurrence chinoise (CATL, BYD) ultra-agressive, time-to-market long (2027+).",
    primaryRisk: "Trajectoire Northvolt (faillite 2024) qui crée un précédent inquiétant pour toute gigafactory européenne. Capex industriel non récupérable si la demande BEV ralentit.",
    realTraction: "Construction Dunkerque en cours, première ligne prévue 2025, contrats Renault Alpine annoncés.",
    status: 'too-early',
    statusContext: "Pari industriel grand format. Le faillite Northvolt 2024 est un signal très négatif pour le secteur. Verdict en 2026-2027.",
    reusablePattern: "Une gigafactory n est jamais juste un projet industriel : c est un pari sur la stabilité géopolitique de l Europe ET la persistance de la demande BEV. Deux variables non contrôlables.",
    sources: ['https://verkor.com'],
    strate: 'C-risky',
    yearFounded: 2020,
    keyInvestors: ['Macquarie', 'Meridiam', 'Renault', 'Crédit Agricole', 'Bpifrance'],
  },
  {
    id: 'photoroom',
    name: 'Photoroom',
    country: 'France',
    city: 'Paris',
    sector: 'GenAI / Consumer',
    subSector: 'Image editing AI',
    totalRaised: { amount: 60, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'genai',
    thesis: "Devenir l outil d édition photo IA n°1 pour e-commerçants et créateurs en pariant sur l intégration verticale (modèle propriétaire + UX consumer parfaite).",
    whyYes: "Croissance organique très forte (>200M de photos éditées), équipe ex-Apple, modèle propriétaire propre (vs API OpenAI), thèse 'thin AI app on top of LLM' qui marche.",
    whyNo: "Risque de commoditisation par les modèles génériques (Gemini, GPT-4V), dépendance aux app stores (Apple/Google taxe 30%), concurrence Canva / Adobe Firefly.",
    primaryRisk: "Si Apple/Google intègrent l édition IA en natif, Photoroom perd son segment. Adobe peut écraser via Creative Cloud.",
    realTraction: "+200M photos éditées, app dans top 10 photo dans plusieurs pays, ARR significatif non communiqué.",
    status: 'promising',
    statusContext: "Pari mince (thin layer on AI) qui dépend de la résilience face aux acteurs verticaux. Dans 24 mois, on saura.",
    reusablePattern: "Les 'thin AI apps' peuvent réussir si elles construisent une distribution propre (app store, communauté) avant que les modèles génériques rattrapent. C est une course contre la commoditisation.",
    sources: ['https://photoroom.com'],
    strate: 'C-risky',
    yearFounded: 2019,
    keyInvestors: ['Balderton Capital', 'Y Combinator', 'Aglaé Ventures'],
  },
  {
    id: 'electra',
    name: 'Electra',
    country: 'France',
    city: 'Paris',
    sector: 'Mobilité / Energy',
    subSector: 'Recharge ultra-rapide BEV',
    totalRaised: { amount: 750, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'industrial',
    thesis: "Déployer le réseau de recharge ultra-rapide (300kW+) le plus dense d Europe en pariant sur l explosion de la demande BEV et le besoin de stations en hub urbain.",
    whyYes: "Soutien public, partenariats fonciers (Carrefour, Indigo), capex amorti par les flux de recharge récurrents, équipe ex-Total/Engie.",
    whyNo: "Concurrence Tesla Supercharger / Ionity / Allego, dépendance au taux de pénétration BEV (cyclique), capex massif par station (~500k€).",
    primaryRisk: "Si la pénétration BEV ralentit (récession ou retournement politique anti-BEV), les stations ne se rentabilisent pas. Le risque est binaire.",
    realTraction: "+200 stations déployées (objectif 2200 en 2030), partenariats fonciers signés.",
    status: 'too-early',
    statusContext: "Modèle CapEx infrastructure, jugement vrai en 2027+.",
    reusablePattern: "Les modèles infrastructure CapEx dépendent à 100% de la trajectoire macro de la demande. Sans pénétration BEV soutenue, l investissement perd toute valeur.",
    sources: ['https://go-electra.com'],
    strate: 'C-risky',
    yearFounded: 2021,
    keyInvestors: ['PIF', 'Bpifrance', 'RIVE Private Investment'],
  },
  {
    id: 'wandercraft',
    name: 'Wandercraft',
    country: 'France',
    city: 'Paris',
    sector: 'MedTech / Robotique',
    subSector: 'Exosquelettes médicaux',
    totalRaised: { amount: 130, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'deeptech',
    thesis: "Devenir le leader mondial des exosquelettes pour patients paraplégiques en certifiant un produit médical autonome (sans béquilles), et étendre vers l industrie/militaire.",
    whyYes: "Différenciation technique réelle (autonomie sans béquilles), certification FDA US obtenue 2022, partenariats hôpitaux US.",
    whyNo: "Marché médical étroit (patients paraplégiques), prix élevé (~150k$ par exo), remboursement santé incertain, dépendance aux systèmes hospitaliers.",
    primaryRisk: "Adoption hospitalière lente (cycles d achat 18-36 mois), refus de prise en charge par les assureurs santé, capex industriel par unité élevé.",
    realTraction: "+80 unités déployées en hôpitaux US/EU, partenariats Mount Sinai, Crawford Memorial.",
    status: 'promising',
    statusContext: "Validation médicale obtenue, passage à scale industriel à confirmer.",
    reusablePattern: "Les deeptech medical-grade peuvent obtenir leur certification mais l adoption commerciale reste un challenge distinct. La 'route certifiée' n est pas la 'route commerciale'.",
    sources: ['https://wandercraft.eu'],
    strate: 'C-risky',
    yearFounded: 2012,
    keyInvestors: ['LBO France', 'Bpifrance', 'Idinvest'],
  },
  {
    id: 'h-company',
    name: 'H Company',
    country: 'France',
    city: 'Paris',
    sector: 'GenAI',
    subSector: 'Agents IA',
    totalRaised: { amount: 220, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'genai',
    thesis: "Construire des agents IA généralistes (web automation, action) qui remplacent l interaction humaine répétitive avec les outils numériques.",
    whyYes: "Mega-seed 220M$ sans produit (record européen), équipe ex-DeepMind / Google Brain, thèse 'agents' alignée avec la prochaine vague IA, narratif souveraineté EU.",
    whyNo: "Pas de produit au seed, concurrence frontale Adept / Cognition / Imbue, dépendance aux progrès des modèles fondation (LLM tiers), brûle cash gigantesque.",
    primaryRisk: "Démissions des co-fondateurs annoncées 2024 (équipe scindée en plusieurs morceaux), produit non encore lancé, brûle cash massif.",
    realTraction: "Aucun produit lancé publiquement, départ partiel des cofondateurs, restructuration en cours.",
    status: 'in-difficulty',
    statusContext: "Plusieurs cofondateurs ont quitté en 2024 quelques mois après la mega-seed. Signal très négatif sur le pari.",
    reusablePattern: "Une mega-seed sans produit est un pari sur la cohésion d équipe. Si l équipe se scinde dans les 12 mois, la thèse est cassée. Le 'team risk' est sous-estimé sur les mega-seeds.",
    sources: ['https://www.h.company'],
    strate: 'C-risky',
    yearFounded: 2024,
    keyInvestors: ['Accel', 'Eurazeo', 'Amazon', 'Samsung'],
  },
  {
    id: 'jimmy-energy',
    name: 'Jimmy Energy',
    country: 'France',
    city: 'Paris',
    sector: 'Energy / Nuclear',
    subSector: 'SMR (Small Modular Reactors)',
    totalRaised: { amount: 30, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'deeptech',
    thesis: "Construire des micro-réacteurs nucléaires (10MW thermique) pour fournir de la chaleur décarbonée à l industrie, en pariant sur la régulation nucléaire française favorable.",
    whyYes: "Pari souveraineté énergétique, soutien France 2030, équipe issue de polytechniciens/ingénieurs nucléaires, thèse SMR validée mondialement (NuScale, Rolls-Royce).",
    whyNo: "Régulation ASN (autorité de sûreté) longue (5-10 ans), capex énorme par site, comparable mondial NuScale qui a annulé son projet phare US 2023.",
    primaryRisk: "Approbation réglementaire ASN incertaine, pas de prototype, dépendance à l acceptabilité sociale du nucléaire.",
    realTraction: "Premier site annoncé pour 2026, mais pas encore d approbation finale.",
    status: 'too-early',
    statusContext: "Pari deeptech long-cycle, jugement réel en 2028-2030.",
    reusablePattern: "Les deeptech regulated (nucléaire, pharmaceutique, défense) ont des cycles de validation 5-10x plus longs que la software. La régulation est le vrai goulot, pas la technique.",
    sources: ['https://jimmy.energy'],
    strate: 'C-risky',
    yearFounded: 2020,
    keyInvestors: ['Bpifrance', 'Doaktree', 'Founders Future'],
  },
  {
    id: 'aledia',
    name: 'Aledia',
    country: 'France',
    city: 'Grenoble',
    sector: 'Hardware / Display',
    subSector: 'MicroLED 3D',
    totalRaised: { amount: 200, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'deeptech',
    thesis: "Industrialiser les microLED 3D sur substrats silicium pour produire des écrans révolutionnaires (luminosité, efficacité, couleur) à coût compétitif vs OLED.",
    whyYes: "Différenciation technique (microLED 3D inédit), partenariats Apple/Samsung rumored, soutien France 2030 et fonds deeptech, équipe scientifique CEA.",
    whyNo: "Capex industriel énorme (fab semi-conducteurs), commercialisation reportée plusieurs fois, concurrence asiatique (Samsung, BOE) qui maîtrise déjà la microLED 2D.",
    primaryRisk: "Time-to-market repoussé (production prévue 2025-2026), risque que Samsung/Apple commoditisent avant le lancement, capex non amorti si volumes faibles.",
    realTraction: "Lignes pilotes Grenoble, pas encore de production industrielle, partenariats annoncés mais peu de chiffres publics.",
    status: 'too-early',
    statusContext: "Pari deeptech sur 5+ ans, validation à venir en 2026-2027.",
    reusablePattern: "La fenêtre de tir d une deeptech hardware se ferme vite. Si le time-to-market dérape de 2-3 ans, les leaders mondiaux ont rattrapé.",
    sources: ['https://aledia.com'],
    strate: 'C-risky',
    yearFounded: 2011,
    keyInvestors: ['Bpifrance', 'Intel Capital', 'Sofinnova Partners'],
  },
  {
    id: 'prophesee',
    name: 'Prophesee',
    country: 'France',
    city: 'Paris',
    sector: 'Hardware / Vision',
    subSector: 'Event-based vision sensors',
    totalRaised: { amount: 150, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'deeptech',
    thesis: "Révolutionner la vision artificielle avec des capteurs neuromorphiques 'event-based' (qui ne capturent que les changements vs. images entières) pour gagner en latence et énergie.",
    whyYes: "Différenciation technique inédite, partenariats Sony/Bosch, applications automotive/AR/IoT, équipe scientifique de pointe.",
    whyNo: "Catégorie inédite donc pas de marché établi, dépendance à l adoption par OEM (Sony, Bosch), commercialisation à grande échelle pas encore actée.",
    primaryRisk: "Adoption industrielle lente, concurrence des capteurs CMOS classiques qui s améliorent, dépendance aux roadmaps automotive des grands OEM.",
    realTraction: "Partenariat Sony confirmé, lignes de capteurs en production, mais volumes commerciaux limités.",
    status: 'too-early',
    statusContext: "Pari deeptech valide à 7-10 ans. Les premières adoptions automotive en 2025-2026 seront le test.",
    reusablePattern: "Une catégorie inédite a un avantage 'first mover' mais paie le coût d éducation marché. Le pari deeptech est sur la patience des fondateurs ET du capital.",
    sources: ['https://prophesee.ai'],
    strate: 'C-risky',
    yearFounded: 2014,
    keyInvestors: ['Xilinx', 'Sony', 'Bpifrance', 'Supernova Invest'],
  },
];

// ============================================================
// STRATE D — ECHECS OU QUASI-ECHECS (5 cas)
// ============================================================

const STRATE_D: ExtendedCaseRecord[] = [
  {
    id: 'ynsect',
    name: 'Ÿnsect',
    country: 'France',
    city: 'Évry / Amiens',
    sector: 'AgriTech',
    subSector: 'Insectes pour alimentation animale',
    totalRaised: { amount: 600, currency: 'USD', asOf: '2022', verifySource: true },
    wagerType: 'industrial',
    thesis: "Industrialiser la production de protéines d insectes (scarabée Molitor) à très grande échelle pour pisciculture et petfood, avec 98% de terres en moins que l élevage classique.",
    whyYes: "Pari deeptech green crédible, soutien européen massif (autorisation insectes pour consommation), première ferme verticale industrielle au monde, équipe scientifique forte.",
    whyNo: "Capex massif (usines à 300M€+ chacune), risque industriel non maîtrisé (production biologique à grande échelle inédite), unit economics non démontrées, modèle SaaS-incompatible (pas de récurrence digitale).",
    primaryRisk: "Restructuration et procédure de redressement annoncée 2024 / 2025. La thèse 'gigafactory protéines' a échoué sur l économie unitaire réelle.",
    realTraction: "Usine Amiens partiellement opérationnelle, mais difficultés financières majeures, restructuration en cours, layoffs massifs.",
    status: 'in-difficulty',
    statusContext: "Cas d école : grosse levée + thèse séduisante + capex industriel massif = trajectoire fragile. La validation à scale industrielle n a pas tenu.",
    reusablePattern: "PATTERN CRITIQUE pour Prélude : grosse levée VC ne valide pas le modèle industriel. Quand le capex est massif et que l économie unitaire n est pas démontrée à 50% de scale, le risque est binaire.",
    sources: ['https://ynsect.com', 'Press : Les Echos, Le Monde 2024'],
    strate: 'D-failure',
    yearFounded: 2011,
    keyInvestors: ['Astanor Ventures', 'Footprint Coalition', 'Bpifrance', 'Robert Downey Jr'],
  },
  {
    id: 'cazoo',
    name: 'Cazoo',
    country: 'UK',
    city: 'Londres',
    sector: 'E-commerce',
    subSector: 'Voitures d occasion en ligne',
    totalRaised: { amount: 2000, currency: 'USD', asOf: '2021', verifySource: true },
    wagerType: 'marketplace',
    thesis: "Devenir l Amazon de la voiture d occasion en Europe en pariant sur la digitalisation totale (achat 100% en ligne, livraison à domicile, retour 7 jours).",
    whyYes: "IPO SPAC à 7Mds$ (2021), équipe Alex Chesterman (Zoopla), pari early sur la digitalisation post-COVID, ambition européenne.",
    whyNo: "Modèle capex ultra-intensif (stocks de voitures), unit economics non démontrées, marges fines, concurrence Carvana qui a déjà subi le même crash US.",
    primaryRisk: "Crash boursier 2022-2023, restructuration, sortie de la cote, valorisation -99% vs IPO. Dépôt de bilan partiel 2023.",
    realTraction: "+150 000 voitures vendues au pic, mais effondrement total du modèle économique 2022-2023.",
    status: 'in-difficulty',
    statusContext: "Cas d école absolu : valorisation IPO 7Mds$ → near-zero en 24 mois. La thèse marketplace + capex stocks était structurellement instable.",
    reusablePattern: "PATTERN CRITIQUE : modèle 'Amazon de X' avec capex de stockage massif est fragile structurellement. Carvana a planté avant Cazoo, signal ignoré.",
    sources: ['Press : FT, Sifted 2022-2024'],
    strate: 'D-failure',
    yearFounded: 2018,
    keyInvestors: ['DMG Ventures', 'General Catalyst', 'Mubadala'],
  },
  {
    id: 'klarna-revue',
    name: 'Klarna (revue critique)',
    country: 'Suède',
    city: 'Stockholm',
    sector: 'FinTech',
    subSector: 'Buy Now Pay Later',
    totalRaised: { amount: 4500, currency: 'USD', asOf: '2021', verifySource: true },
    wagerType: 'fintech-regulated',
    thesis: "Démocratiser le crédit consommateur via le Buy Now Pay Later (BNPL) intégré dans le checkout e-commerce, en se positionnant comme alternative à la carte de crédit.",
    whyYes: "Adoption rapide du BNPL post-COVID, équipe scandinave, partenariats e-commerce massifs, valorisation 45,6Mds$ pic 2021.",
    whyNo: "Régulation BNPL en cours (UK, EU, US), risque de défaut consommateur en récession, concurrence Apple Pay Later / Affirm / PayPal Pay Later.",
    primaryRisk: "Crash de valorisation -85% (45,6Mds$ → 6,7Mds$ en 2022), licenciements massifs (-10% effectifs), durcissement réglementaire BNPL.",
    realTraction: ">150M utilisateurs, mais profitabilité dégradée 2022-2023, valorisation toujours en-dessous du pic.",
    status: 'fragile',
    statusContext: "Pas un échec total mais un avertissement : -85% de valorisation en 12 mois sur une boîte 'leader catégorie'. Le statut licorne ne protège pas du retournement de cycle.",
    reusablePattern: "PATTERN CRITIQUE : la 'décote BNPL' est un cas d école de cycle bull → bear sur fintech consumer credit. La valorisation 2021 reflétait une thèse macro qui s est inversée.",
    sources: ['Press : FT, Bloomberg 2021-2024'],
    strate: 'D-failure',
    yearFounded: 2005,
    keyInvestors: ['Sequoia', 'SoftBank', 'Silver Lake'],
  },
  {
    id: 'northvolt-revue',
    name: 'Northvolt',
    country: 'Suède',
    city: 'Stockholm',
    sector: 'Industrie / Battery',
    subSector: 'Gigafactory batteries',
    totalRaised: { amount: 15000, currency: 'USD', asOf: '2024', verifySource: true },
    wagerType: 'industrial',
    thesis: "Construire la première gigafactory batteries européenne souveraine pour serveir Volkswagen, BMW, Volvo et libérer l Europe de la dépendance asiatique.",
    whyYes: "Soutien massif EU/Etats, contrats VW/BMW/Volvo, équipe ex-Tesla, valorisation pic 12Mds$ (2023).",
    whyNo: "Capex industriel colossal (>15Mds$ au total levés), production réelle largement en deçà des objectifs, concurrence chinoise CATL ultra-agressive sur prix.",
    primaryRisk: "Dépôt de bilan Chapter 11 annoncé novembre 2024. Échec industriel majeur européen.",
    realTraction: "Production très en-deçà des objectifs (3GWh livrés vs 16GWh attendus 2024), problèmes qualité, contrat BMW annulé.",
    status: 'in-difficulty',
    statusContext: "ÉCHEC INDUSTRIEL MAJEUR. La gigafactory européenne avec le plus de capital levé au monde a déposé bilan en 2024. Précédent terrible pour Verkor / ACC / autres.",
    reusablePattern: "PATTERN CRITIQUE : 15Mds$ levés ne suffisent pas à industrialiser une gigafactory batterie face à CATL. Le pari souveraineté ne bat pas l économie unitaire chinoise. Toute gigafactory européenne en cours doit être lue à travers ce prisme.",
    sources: ['Press : FT, Reuters 2024'],
    strate: 'D-failure',
    yearFounded: 2016,
    keyInvestors: ['Volkswagen', 'Goldman Sachs', 'BMW', 'Sweden public funds'],
  },
  {
    id: 'wework-eu',
    name: 'WeWork (lecture européenne)',
    country: 'USA / EU',
    city: 'NY / multi',
    sector: 'Real Estate',
    subSector: 'Coworking',
    totalRaised: { amount: 22000, currency: 'USD', asOf: '2023', verifySource: true },
    wagerType: 'consumer',
    thesis: "Réinventer le bureau en pariant sur la flexibilité comme nouveau standard, et utiliser la marque + l UX pour transformer l immobilier commercial en service.",
    whyYes: "SoftBank vision, expansion mondiale ultra-rapide, narratif 'tech company', valorisation pic 47Mds$ (2019).",
    whyNo: "Pas de moat technique, capex baux ultra-longs (10-20 ans), modèle non profitable depuis l origine, gouvernance fondateur problématique (Adam Neumann).",
    primaryRisk: "IPO annulée 2019, restructuration, dépôt de bilan Chapter 11 2023.",
    realTraction: "Pic 800 sites mondiaux, mais dépôt de bilan 2023, sortie de Chapter 11 avec actionnaires lessivés.",
    status: 'in-difficulty',
    statusContext: "Cas d école absolu d aveuglement collectif VC. Référence du moteur Pattern Matching / Aveuglement de Prélude.",
    reusablePattern: "PATTERN CRITIQUE : un narratif tech sur un business immobilier (capex baux longs) est structurellement vicié. La sophistication UX ne change pas l économie unitaire d un real estate play. Référence universelle.",
    sources: ['Press : WSJ, FT 2019-2024'],
    strate: 'D-failure',
    yearFounded: 2010,
    keyInvestors: ['SoftBank Vision Fund', 'Goldman Sachs', 'JP Morgan'],
  },
];

// ============================================================
// SOUS-CORPUS QUANTIQUE (transverse - 6 cas)
// ============================================================
//
// Le quantique mérite un traitement à part : marché frontière où les
// fonds investissent avant tout revenu, sur une combinaison science +
// souveraineté + équipe + horizon 10 ans + capital public massif.
//
// 5 acteurs FR du programme PROQCIMA + 1 benchmark européen (IQM).
// PROQCIMA : programme français du Ministère des Armées qui finance
// jusqu à 500M€ pour atteindre des prototypes quantiques tolérants
// aux fautes (objectif horizon 2030+).

const QUANTUM: ExtendedCaseRecord[] = [
  {
    id: 'alice-bob',
    name: 'Alice & Bob',
    country: 'France',
    city: 'Paris',
    sector: 'Quantum Computing',
    subSector: 'Cat qubits supraconducteurs',
    totalRaised: { amount: 130, currency: 'EUR', asOf: '2025', verifySource: true },
    wagerType: 'quantum-hardware',
    thesis: "Construire un ordinateur quantique tolérant aux fautes basé sur les 'cat qubits', en pariant sur une architecture qui réduit drastiquement le nombre de qubits physiques nécessaires pour un qubit logique fiable.",
    whyYes: "Approche cat qubits originale et brevet propre, sélection PROQCIMA (500M€ public), levée 100M€ 2025 confirme la traction, équipe scientifique CNRS/ENS.",
    whyNo: "Horizon 2030+ avant ordinateur opérationnel, concurrence IBM/Google/IonQ avec budgets infinis, pari binaire sur l architecture.",
    primaryRisk: "Architecture cat qubits doit prouver sa supériorité face aux qubits supraconducteurs classiques. Si pas de bench>=concurrent à T+5 ans, capital public se déplace.",
    realTraction: "Levée 100M€ 2025, sélection PROQCIMA, prototype qubits logiques annoncé 2025-2026.",
    status: 'too-early',
    statusContext: "Pari long-cycle deep tech. Verdict 2028-2030.",
    reusablePattern: "Le quantique est un terrain où le pari fond se calibre sur 4 axes : science (architecture), souveraineté (programme étatique), équipe (chercheurs top-tier), horizon (10 ans). Cycle hors revenus.",
    sources: [
      'https://alice-bob.com',
      'https://www.lemonde.fr/economie/article/2025/01/28/alice-bob-leve-100-millions-d-euros',
    ],
    strate: 'quantum',
    yearFounded: 2020,
    keyInvestors: ['Future French Champions', 'AXA Venture Partners', 'Elaia', 'Bpifrance'],
    isQuantum: true,
  },
  {
    id: 'pasqal',
    name: 'Pasqal',
    country: 'France',
    city: 'Massy',
    sector: 'Quantum Computing',
    subSector: 'Atomes neutres',
    totalRaised: { amount: 140, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'quantum-hardware',
    thesis: "Construire des ordinateurs quantiques à atomes neutres pour optimisation, simulation chimique et calcul scientifique, avec une architecture potentiellement scalable au-delà de 1000 qubits.",
    whyYes: "Approche atomes neutres validée scientifiquement (Institut d Optique Saclay), sélection PROQCIMA, partenariats LBNL/CINECA, équipe Alain Aspect (Nobel 2022) au conseil scientifique.",
    whyNo: "Concurrence cold-atoms QuEra (US), horizon long, capex R&D massif, marché applications quantiques pas encore mature.",
    primaryRisk: "Si IBM/Google atteignent 1000+ qubits supraconducteurs avant Pasqal sur atomes neutres, le pari architecture est cassé.",
    realTraction: "Machines 100+ qubits déployées (1ère machine livrée Jülich 2024), partenariats institutionnels solides.",
    status: 'too-early',
    statusContext: "Validation scientifique solide, validation commerciale en cours.",
    reusablePattern: "Le quantique a plusieurs architectures concurrentes (supra, atomes neutres, photons, ions piégés, silicium). Investir dans le quantique = parier sur UNE architecture, le risque est concentré.",
    sources: [
      'https://pasqal.com',
      'https://thenextweb.com/news/france-quantum-computing-alice-bob-proqcima-europe',
    ],
    strate: 'quantum',
    yearFounded: 2019,
    keyInvestors: ['Temasek', 'Wa Capital', 'Quantonation', 'Bpifrance'],
    isQuantum: true,
  },
  {
    id: 'quandela',
    name: 'Quandela',
    country: 'France',
    city: 'Massy',
    sector: 'Quantum Computing',
    subSector: 'Quantum photonique',
    totalRaised: { amount: 90, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'quantum-hardware',
    thesis: "Construire des ordinateurs quantiques photoniques, en pariant sur les photons comme support de calcul et sur la connectivité naturelle avec les réseaux télécom.",
    whyYes: "Approche photonique validée scientifiquement, sélection PROQCIMA, machine MosaiQ déployée OVHcloud (1ère intégration cloud quantique européenne).",
    whyNo: "Concurrence PsiQuantum (US, +700M$ levés), architecture photonique nécessite encore prouver scalabilité.",
    primaryRisk: "PsiQuantum peut commoditiser la photonique avant Quandela, malgré les capitaux moindres en France.",
    realTraction: "Machine MosaiQ chez OVHcloud, partenariats académiques, équipe scientifique CNRS.",
    status: 'too-early',
    reusablePattern: "Le quantique photonique a un avantage de connectivité (compatible fibre télécom) mais les volumes de capital européens (~10x moins que US) imposent une stratégie de différenciation, pas de course frontale.",
    sources: [
      'https://quandela.com',
      'https://thenextweb.com/news/france-quantum-computing-alice-bob-proqcima-europe',
    ],
    strate: 'quantum',
    yearFounded: 2017,
    keyInvestors: ['Bpifrance', 'Quantonation', 'OVHcloud (partenariat)'],
    isQuantum: true,
  },
  {
    id: 'c12',
    name: 'C12',
    country: 'France',
    city: 'Paris',
    sector: 'Quantum Computing',
    subSector: 'Nanotubes carbone',
    totalRaised: { amount: 28, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'quantum-hardware',
    thesis: "Construire des qubits à partir de nanotubes de carbone pour atteindre une fidélité supérieure aux qubits supraconducteurs, avec une architecture issue de la recherche française de pointe.",
    whyYes: "Approche nanotubes carbone très différenciante, issue de l ENS Paris, sélection PROQCIMA, capital public soutenu.",
    whyNo: "Architecture inédite donc risque scientifique majeur, capital levé largement inférieur à concurrents internationaux, sortie longue.",
    primaryRisk: "Si la fidélité réelle des nanotubes ne dépasse pas celle des supraconducteurs, le pari est perdu.",
    realTraction: "Levée 18M€ second tour 2024, sélection PROQCIMA, premiers prototypes à venir.",
    status: 'too-early',
    statusContext: "Pari deeptech extrêmement précoce. Verdict 2028+.",
    reusablePattern: "Le 'capital français' (~30M€) ne suffit pas à rivaliser avec les volumes US (~500M$+ par boîte) sur une architecture comparable. La différenciation scientifique est obligatoire.",
    sources: [
      'https://c12quantum.com',
      'https://www.polytechnique.edu/en/news/new-round-financing-c12-quantum-processors-start-launched-two-x-alumni',
    ],
    strate: 'quantum',
    yearFounded: 2020,
    keyInvestors: ['Varsity Capital', '360 Capital', 'Bpifrance'],
    isQuantum: true,
  },
  {
    id: 'quobly',
    name: 'Quobly',
    country: 'France',
    city: 'Grenoble',
    sector: 'Quantum Computing',
    subSector: 'Silicon spin qubits',
    totalRaised: { amount: 19, currency: 'EUR', asOf: '2024', verifySource: true },
    wagerType: 'quantum-hardware',
    thesis: "Construire des qubits à partir de silicium spin (technologies semi-conducteurs standard) pour rapprocher le quantique des procédés industriels existants et accélérer la fabrication massive.",
    whyYes: "Approche silicium = compatibilité industrielle avec foundries (TSMC, GlobalFoundries), sélection PROQCIMA, équipe CEA-Leti.",
    whyNo: "Concurrence Intel (silicium spin également), horizon long, capital limité.",
    primaryRisk: "Intel peut commoditiser le silicium spin avec ses fabs avant Quobly. Capital public est crucial.",
    realTraction: "Levée 19M€ seed 2024, sélection PROQCIMA, partenariat CEA-Leti.",
    status: 'too-early',
    statusContext: "Pari deeptech long-cycle.",
    reusablePattern: "Le silicium spin est l architecture la plus 'scalable industriellement' mais aussi la plus contestée (Intel y est). C est un pari sur l exécution française vs US.",
    sources: [
      'https://quobly.io',
      'https://thenextweb.com/news/france-quantum-computing-alice-bob-proqcima-europe',
    ],
    strate: 'quantum',
    yearFounded: 2022,
    keyInvestors: ['Bpifrance', 'CEA Investissement', 'Quantonation'],
    isQuantum: true,
  },
  {
    id: 'iqm-benchmark',
    name: 'IQM Quantum Computers',
    country: 'Finlande',
    city: 'Espoo',
    sector: 'Quantum Computing',
    subSector: 'Supraconducteurs',
    totalRaised: { amount: 600, currency: 'USD', asOf: '2025', verifySource: true },
    wagerType: 'quantum-hardware',
    thesis: "Construire le leader européen du quantique supraconducteur, en pariant sur l intégration verticale (R&D + production + cloud) et l accélération via capitaux importants.",
    whyYes: "+600M$ levés (record européen quantique), équipe expérimentée VTT/Aalto, contrats institutionnels (Leibniz, EPFL), positionnement leader européen sur supraconducteurs.",
    whyNo: "Architecture supraconducteurs = concurrence frontale IBM/Google qui ont 100x plus de ressources, horizon long, applications quantiques pas encore matures.",
    primaryRisk: "IBM/Google atteignent l avantage quantique avant IQM. Capital européen reste insuffisant face aux GAFAM.",
    realTraction: "Machine 54 qubits Garmisch (Allemagne), contrats Leibniz Computing Centre, présence cloud AWS/Azure.",
    status: 'promising',
    statusContext: "BENCHMARK européen pour mesurer les acteurs français. Avec +600M$ levés, IQM est dans une autre catégorie de capital que les FR (90-140M€).",
    reusablePattern: "BENCHMARK : quand on évalue un acteur français du quantique, on doit le situer face à IQM (FI, +600M$) et aux US (PsiQuantum +700M$, Quantinuum, etc.). Le ratio capital FR/EU/US est typiquement 1/2/10.",
    sources: [
      'https://meetiqm.com',
      'https://www.investors.com/news/technology/iqm-europe-quantum-computing-stocks/',
    ],
    strate: 'quantum',
    yearFounded: 2018,
    keyInvestors: ['Tesi', 'EIC', 'OurCrowd', 'Maki.vc'],
    isQuantum: true,
  },
];

// ============================================================
// CORPUS COMPLET + HELPERS
// ============================================================

export const EXTENDED_CORPUS: ExtendedCaseRecord[] = [
  ...STRATE_A,
  ...STRATE_B,
  ...STRATE_C,
  ...STRATE_D,
  ...QUANTUM,
];

export function findExtendedById(id: string): ExtendedCaseRecord | undefined {
  return EXTENDED_CORPUS.find((c) => c.id === id);
}

export function findByStrate(strate: ExtendedStrate): ExtendedCaseRecord[] {
  return EXTENDED_CORPUS.filter((c) => c.strate === strate);
}

export function findByWagerType(wagerType: WagerType): ExtendedCaseRecord[] {
  return EXTENDED_CORPUS.filter((c) => c.wagerType === wagerType);
}

export function findByStatus(status: CaseStatus): ExtendedCaseRecord[] {
  return EXTENDED_CORPUS.filter((c) => c.status === status);
}

export function getQuantumCorpus(): ExtendedCaseRecord[] {
  return EXTENDED_CORPUS.filter((c) => c.isQuantum === true);
}

/**
 * Statistiques rapides pour debug / display.
 */
export function getCorpusStats() {
  return {
    total: EXTENDED_CORPUS.length,
    byStrate: {
      'A-success': findByStrate('A-success').length,
      'B-open': findByStrate('B-open').length,
      'C-risky': findByStrate('C-risky').length,
      'D-failure': findByStrate('D-failure').length,
      quantum: findByStrate('quantum').length,
    },
    byStatus: {
      confirmed: findByStatus('confirmed').length,
      promising: findByStatus('promising').length,
      fragile: findByStatus('fragile').length,
      'in-difficulty': findByStatus('in-difficulty').length,
      'too-early': findByStatus('too-early').length,
    },
  };
}
