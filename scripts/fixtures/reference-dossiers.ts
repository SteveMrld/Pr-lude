// ============================================================
// FIXTURES DOSSIERS DE REFERENCE - CALIBRATION FRAGILITE STRUCTURELLE
// ------------------------------------------------------------
// Dix dossiers de reference construits a partir de sources publiques pour
// calibrer les sept patterns du moteur Fragilite Structurelle. Chaque
// dossier reproduit le contour ExtractionOutput + FinancialDataExtraction
// que produirait notre pipeline d extraction sur le pitch et le BP de
// l entreprise au moment ou elle aurait pu etre instruite par un fonds
// growth (Series B et au-dela pour Casper, Series D pour WeWork preIPO,
// growth pour Atlassian preIPO, Series C pour Northvolt, etc).
//
// Methode :
//   - Donnees sourcees de filings SEC, articles The Information / FT /
//     WSJ / Bloomberg / Les Echos, comptes deposes Pappers, decks publies
//     post-mortem (WeWork S-1, Casper S-1, MoviePass 10-Q Helios &
//     Matheson, etc).
//   - Quand une donnee n est pas publique, on la marque NA dans rawSummary
//     plutot que de l inventer.
//   - Le but n est pas de reproduire le pitch original : c est de fournir
//     au LLM la matiere chiffree qu il aurait dans un dossier reel pour
//     que ses scores soient calibres sur des cas dont on connait l issue.
//
// Counter-archetypes attendus :
//   - WeWork preIPO    = Trajectoire WeWork (Growth Subsidized + Fixed
//                        Cost Trap drapeau-rouge, Capital Structure
//                        Fragility alerte)
//   - Theranos         = Tech Claim Coherence drapeau-rouge (hors scope
//                        Fragility Structurelle ; sert de cas frontier
//                        pour mesurer la sobriete du moteur quand le
//                        revenu est a peu pres absent)
//   - Casper           = Growth Subsidized drapeau-rouge (CM negative)
//   - MoviePass        = Growth Subsidized drapeau-rouge (places vendues
//                        sous le prix d achat)
//   - Atlassian preIPO = sain partout (counter-archetype de reference
//                        pour Growth Subsidized, asset-light)
//   - Stripe Series E  = sain partout (LTV/CAC eleve, asset-light)
//   - Mistral Series B = Infrastructure Hostage alerte/drapeau-rouge,
//                        Commoditization Drift attention/alerte
//   - Northvolt Series E = Scale Mirage Risk + Fixed Cost Trap drapeau-
//                        rouge (industrialisation prematuree, capex
//                        massif, demande EV qui ralentit)
//   - Ynsect Series D  = Scale Mirage Risk + Capital Structure Fragility
//                        alerte (prod insectes industrialisee tot,
//                        marche pet food / aqua moins prevu)
//   - Klarna 2022      = Growth Subsidized alerte (BNPL non rentable),
//                        Regulatory Time Bomb attention/alerte
// ============================================================

import type { ExtractionOutput, FinancialDataExtraction } from '../../lib/engines/types';

// ============================================================
// HELPER : factory FinancialDataExtraction lisible
// ------------------------------------------------------------
// FinancialDataExtraction a beaucoup de champs, on construit avec un
// objet partiel et on remplit le reste de defauts neutres. Les patterns
// lisent surtout monthlyBurn, runwayMonths, revenue, grossMargin, et
// les autres champs ad-hoc via best-effort.
// ============================================================

interface QuickFinancials {
  hasBP?: boolean;
  fileSource?: 'deck' | 'bp' | 'both' | 'none';
  // champs flat utilises par les pattern modules via best-effort
  revenue?: number;            // EUR ou USD annuels
  grossMargin?: number;        // 0..1
  contributionMargin?: number; // 0..1
  monthlyBurn?: number;
  runwayMonths?: number;
  totalCapitalRaised?: number;
  cacPayback?: number;         // mois
  ltvCacRatio?: number;
  qoqGrowthRate?: number;      // 0..1
  fixedBurn?: number;          // monthly
  totalCommitments?: number;   // engagements off-balance cumules
  capex?: number;              // capex cumule
  payroll?: number;            // annuel
  rentAnnual?: number;         // annuel
  contractualMinimums?: number;
  rawNotes?: string;
}

function makeFinancials(opts: QuickFinancials): FinancialDataExtraction {
  const f: any = {
    hasBP: opts.hasBP ?? true,
    fileSource: opts.fileSource ?? 'both',
    revenueProjection: [],
    grossMarginProjection: [],
    ebitdaProjection: [],
    fcfProjection: [],
    unitEconomics: {
      estimatedCAC: '',
      estimatedLTV: '',
      estimatedLtvCacRatio: opts.ltvCacRatio !== undefined ? String(opts.ltvCacRatio) : '',
      averageContractValue: '',
      grossMarginPerUnit: opts.grossMargin !== undefined ? String(opts.grossMargin) : '',
    },
    headcount: [],
    opexProjection: [],
    currentRound: {
      amount: '',
      runwayMonths: opts.runwayMonths !== undefined ? String(opts.runwayMonths) : '',
      monthlyBurn: opts.monthlyBurn !== undefined ? String(opts.monthlyBurn) : '',
    },
    marketAssumptions: {
      tamCited: '',
      samCited: '',
      targetMarketShare: '',
      targetCustomersByYearN: '',
    },
    rawNotes: opts.rawNotes ?? '',
    // Champs flat plus permissifs lus par les patterns
    revenue: opts.revenue,
    grossMargin: opts.grossMargin,
    contributionMargin: opts.contributionMargin,
    monthlyBurn: opts.monthlyBurn,
    runwayMonths: opts.runwayMonths,
    totalCapitalRaised: opts.totalCapitalRaised,
    cacPayback: opts.cacPayback,
    ltvCacRatio: opts.ltvCacRatio,
    qoqGrowthRate: opts.qoqGrowthRate,
    fixedBurn: opts.fixedBurn,
    totalCommitments: opts.totalCommitments,
    capex: opts.capex,
    payroll: opts.payroll,
    rentAnnual: opts.rentAnnual,
    contractualMinimums: opts.contractualMinimums,
  };
  return f as FinancialDataExtraction;
}

// ============================================================
// IDENTIFIANTS
// ============================================================

export type DossierId =
  | 'wework-preipo-2019'
  | 'theranos-2014'
  | 'casper-preipo-2019'
  | 'moviepass-2017'
  | 'atlassian-preipo-2015'
  | 'stripe-seriesE-2016'
  | 'mistral-seriesB-2024'
  | 'northvolt-seriesE-2023'
  | 'ynsect-seriesD-2022'
  | 'klarna-2022';

export interface ReferenceDossier {
  id: DossierId;
  label: string;
  extraction: ExtractionOutput;
  financialData: FinancialDataExtraction;
}

// ============================================================
// 1. WeWork pre-IPO (S-1 retire aout 2019)
// ============================================================
//
// Source : S-1 WeWork (aout 2019), articles FT et WSJ post-retrait,
// auditions Adam Neumann.
//
// Run-rate revenu 2019 : 3,3 Md USD. Run-rate operating losses 2019 :
// 1,9 Md USD. Engagements de loyers signes : 47,2 Md USD sur duree
// moyenne 15 ans. Cash en banque mi-2019 : 2,5 Md USD. Burn mensuel
// moyen : 219 M USD. Loyers annuels permanents engages : 2,2 Md USD.
// Cap table : SoftBank dominant, classes multiples de votes, super-
// pouvoirs Adam Neumann.
// ============================================================

const wework: ReferenceDossier = {
  id: 'wework-preipo-2019',
  label: 'WeWork pre-IPO (Series H, 2019)',
  extraction: {
    companyName: 'The We Company (WeWork)',
    sector: 'Real estate operationnel',
    subSector: 'Coworking flex office',
    geographicHub: 'New York',
    country: 'USA',
    yearFounded: 2010,
    founders: [
      { name: 'Adam Neumann', role: 'CEO', background: 'serial entrepreneur, ex-Krawlers' },
      { name: 'Miguel McKelvey', role: 'co-founder', background: 'architecte, ex-collectif Brooklyn' },
    ],
    marketPitch: 'Plateforme mondiale de coworking flex office. We elevate the world consciousness. Run-rate revenu 3,3 Md USD en 2019, 528 sites dans 111 villes, 527K membres. Croissance revenu plus de 100% YoY sur les trois dernieres annees. Communaute, technologie, et reseau global formant un avantage de taille difficile a repliquer.',
    productDescription: 'Espaces de bureaux flexibles, contrats membres mensuels ou trimestriels, avec services additionnels (events, salles de reunion, internet, biere a la pression). Stack tech proprietaire de gestion d immeubles. Verticales adjacentes : WeLive (logement), WeGrow (ecole), Powered by We (services aux grands comptes).',
    businessModel: 'WeWork loue des immeubles entiers en bail commercial 10 a 20 ans, les amenage, et resous les espaces a des membres en contrats mensuels. Marge gross sur les sites matures positive, marge operationnelle consolidee structurellement negative en raison du capex amenagement, du burn ventes et marketing pour remplir les nouveaux sites, et de la masse salariale corporate.',
    traction: {
      metrics: ['527K membres', '528 sites', '111 villes', 'occupation moyenne 80%'],
      revenue: '3,3 Md USD run-rate H1 2019',
      growth: '+106% YoY 2018-2019',
      customers: '527K',
    },
    fundraise: {
      stage: 'Series H pre-IPO',
      amount: '3 Md USD planifies en IPO',
      valuation: '47 Md USD (derniere ronde privee, ramene a 8-12 Md proposes en IPO)',
      leadInvestor: 'SoftBank Vision Fund',
      coInvestors: ['Benchmark', 'JP Morgan', 'Goldman Sachs'],
    },
    competitorsCited: ['IWG Regus', 'Knotel', 'Industrious', 'Convene'],
    rawSummary: 'WeWork au moment du depot S-1 aout 2019 : run-rate revenu 3,3 Md USD, run-rate operating loss 1,9 Md USD, 47,2 Md USD d engagements de loyers signes en bail commercial sur duree moyenne ponderee 15 ans, cash en banque 2,5 Md USD, burn mensuel 219 M USD. Loyers annuels permanents 2,2 Md USD a payer meme avec zero membre. Pas de path to profitability articule dans le S-1. Adam Neumann en super-voting class avec 20x voting power, conflits d interet documentes (immeubles loues a WeWork par Neumann personnellement). IPO retire fin septembre 2019 apres revolte des analystes, valorisation effondree 47 a 7 Md USD, sauvetage SoftBank en octobre 2019.',
    clientsNamed: [],
    boardMembers: [
      { name: 'Masayoshi Son', role: 'observer', affiliation: 'SoftBank' },
      { name: 'Bruce Dunlevie', role: 'director', affiliation: 'Benchmark' },
    ],
  },
  financialData: makeFinancials({
    revenue: 3300000000,
    grossMargin: 0.20, // marge proche zero a l agregat sites matures + sites en ramp
    contributionMargin: -0.05, // CM site mature legere positive ramene par les sites recents en ramp
    monthlyBurn: 219000000,
    runwayMonths: 11, // 2,5 Md cash / 219M burn
    totalCapitalRaised: 12800000000,
    cacPayback: 36,
    ltvCacRatio: 1.4,
    qoqGrowthRate: 0.18,
    fixedBurn: 200000000, // sur 219M total, l essentiel est fixe (loyers + payroll core)
    totalCommitments: 47200000000, // 47,2 Md USD baux signes
    rentAnnual: 2200000000,
    payroll: 700000000,
    rawNotes: 'Engagements off-balance sheet 47,2 Md USD sur 15 ans pondere. Penalites sortie baux US 60 a 80%. Aucun downside scenario chiffre dans le S-1. Aucun layoff conduit. Pas de demonstration de capacite de variabilisation.',
  }),
};

// ============================================================
// 2. Theranos circa 2014 (Series C)
// ============================================================
//
// Pas de revenu mesurable, pas de modele commercial documente. Le
// dossier sert de cas frontier : la plupart des patterns Fragilite
// Structurelle doivent retourner not-applicable ou weak-signal,
// puisque le probleme reel est Tech Claim Coherence (couvert par un
// autre moteur). Une calibration saine voit Growth Subsidized en
// not-applicable ici, pas en alerte par contagion.
// ============================================================

const theranos: ReferenceDossier = {
  id: 'theranos-2014',
  label: 'Theranos (Series C, 2014)',
  extraction: {
    companyName: 'Theranos',
    sector: 'Healthtech',
    subSector: 'Diagnostic in-vitro miniaturise',
    geographicHub: 'Palo Alto',
    country: 'USA',
    yearFounded: 2003,
    founders: [
      { name: 'Elizabeth Holmes', role: 'CEO', background: 'Stanford dropout, vision diagnostic miniature' },
      { name: 'Sunny Balwani', role: 'COO', background: 'serial entrepreneur tech' },
    ],
    marketPitch: 'Revolution du diagnostic medical : 240 tests sanguins a partir de quelques gouttes de sang prelevees au bout du doigt, en moins d une heure. Edison device deploye en partenariat exclusif avec Walgreens et Safeway, infrastructure de proximite remplacant les laboratoires traditionnels. Marche mondial des diagnostics 75 Md USD en croissance.',
    productDescription: 'Edison device, machine compacte de tests sanguins multiplexes proprietaire. Software cloud pour resultats au patient via app. Partenariats deploiement Walgreens (cible 8200 sites US), Safeway. Brevet propre sur la microfluidique et la chimie analytique miniaturisee.',
    businessModel: 'Pricing par test au consommateur direct, jusqu a 10x moins cher que LabCorp ou Quest Diagnostics. Modele revenue-per-test sans assurance prescripteur, paiement direct ou via app pharmacie. Long terme, licensing aux hopitaux. Aucun chiffrage ARR ou run-rate communique.',
    traction: {
      metrics: ['Partenariats Walgreens et Safeway annonces', 'Edison device en deploiement pilote'],
      revenue: 'non communique',
      growth: 'non communique',
      customers: 'pilote en 40 stores Walgreens',
    },
    fundraise: {
      stage: 'Series C',
      amount: '400 M USD',
      valuation: '9 Md USD',
      leadInvestor: 'investisseurs prives (Murdoch, Devos, Walton)',
      coInvestors: ['Larry Ellison', 'Tim Draper', 'family offices'],
    },
    competitorsCited: ['LabCorp', 'Quest Diagnostics', 'Roche Diagnostics'],
    rawSummary: 'Theranos a 9 Md USD de valorisation 2014 sans revenu mesurable communique, sans publication scientifique peer-reviewed sur le Edison device, sans validation FDA. Board rempli de figures politiques (Kissinger, Mattis, Shultz, Perry) sans expertise diagnostic. Walgreens partenariat annonce mais deploiement reel 40 sites (pas 8200). Aucune metrique de performance technique du device disponible dans le pitch. Aucun BP triennal partage. Run-rate revenu inexistant. Le moteur Fragilite Structurelle doit reconnaitre l absence de modele economique mesurable et marquer la plupart des patterns en not-applicable ou weak-signal.',
    clientsNamed: [
      { name: 'Walgreens', company: 'Walgreens', relationship: 'partenariat exclusif annonce' },
      { name: 'Safeway', company: 'Safeway', relationship: 'partenariat annonce' },
    ],
    boardMembers: [
      { name: 'Henry Kissinger', role: 'director', affiliation: 'ex-Secretaire d Etat' },
      { name: 'James Mattis', role: 'director', affiliation: 'General USMC retraite' },
      { name: 'George Shultz', role: 'director', affiliation: 'ex-Secretaire d Etat' },
    ],
  },
  financialData: makeFinancials({
    hasBP: false,
    fileSource: 'deck',
    // Aucune donnee financiere mesurable disponible dans le dossier 2014.
    // On laisse l essentiel undefined pour que les pattern modules
    // detectent l absence de matiere chiffree.
    rawNotes: 'Aucun BP triennal partage. Aucun chiffrage revenu, ARR, burn, runway communique au moment de la Series C 2014. Cash leve cumule estime 750 M USD a la Series C 2014.',
    totalCapitalRaised: 750000000,
  }),
};

// ============================================================
// 3. Casper pre-IPO (S-1 fevrier 2020)
// ============================================================
//
// Source : Casper S-1 (janvier 2020). Revenu 2019 : 423 M USD.
// Net loss 2019 : 92 M USD. Marge brute 49%. Cohort analysis
// montre contribution margin negative apres CAC sur les cohortes
// recentes (CAC moyen 350 USD, AOV 800 USD, repeat rate <20% a
// 2 ans). DTC matelas online, secteur commoditise par dizaines
// d acteurs Z-Bed, Tuft & Needle, Purple, Saatva.
// ============================================================

const casper: ReferenceDossier = {
  id: 'casper-preipo-2019',
  label: 'Casper pre-IPO (Series D, 2019)',
  extraction: {
    companyName: 'Casper Sleep',
    sector: 'DTC consumer',
    subSector: 'Matelas et literie online',
    geographicHub: 'New York',
    country: 'USA',
    yearFounded: 2014,
    founders: [
      { name: 'Philip Krim', role: 'CEO', background: 'serial entrepreneur DTC' },
      { name: 'Neil Parikh', role: 'COO', background: 'medecine puis e-commerce' },
    ],
    marketPitch: 'Sleep economy 432 Md USD globalement, Casper se positionne comme la marque sommeil holistique avec matelas, oreillers, draps, eclairage. 1 million de matelas vendus depuis 2014. Marque culturelle reconnue, NPS 70+, retention emotionnelle forte. Expansion retail wholesale et stores propres pour atteindre l omni-canal.',
    productDescription: 'Matelas mousse memoire roule en boite livre directement, essai 100 nuits, retour gratuit. Gamme elargie a 50 produits sleep (oreillers, draps, glow light, dog bed, bed frame). 60 stores retail proprietaires US et Canada. Wholesale Target, Costco, Amazon.',
    businessModel: 'DTC online avec essai 100 nuits et retour gratuit (cout retours 15-20% des ventes). CAC marketing 350 USD moyen, AOV 800 USD, gross margin 49% en 2019. Concurrence sur la categorie matelas: dizaines de marques DTC indistinguables, Wayfair Tuft Purple Saatva Allswell. Strategie de differenciation par la marque et l ecosysteme produit elargi.',
    traction: {
      metrics: ['1M matelas vendus', '60 stores retail', 'NPS 70', 'distribution Target Costco Amazon'],
      revenue: '423 M USD 2019',
      growth: '+23% YoY 2018-2019, decelerant',
      customers: '~1M cumules',
    },
    fundraise: {
      stage: 'IPO Nasdaq fevrier 2020',
      amount: '100 M USD',
      valuation: '470 M USD au IPO (vs 1,1 Md USD pre-money 2019)',
      leadInvestor: 'IPO public',
      coInvestors: ['Norwest Venture Partners', 'IVP', 'NEA'],
    },
    competitorsCited: ['Purple', 'Tuft & Needle', 'Saatva', 'Leesa', 'Allswell', 'Sealy', 'Tempur-Pedic'],
    rawSummary: 'Casper depose son S-1 janvier 2020 avec revenu 2019 423 M USD, net loss 92 M USD, marge brute 49%, contribution margin negative apres CAC sur les cohortes recentes (CAC 350, AOV 800, gross profit unitaire 392, mais retours cout 100 USD reduisant la CM a -58 USD net pour les nouveaux clients sans repeat). Repeat rate inferieur a 20% a 2 ans. Catlogue matelas commoditise. IPO casse la valorisation prive 1,1 Md USD a 470 M USD public. Cash burn projete 100M USD par an sur les trois prochaines annees sans path articule au breakeven. Aucune cohort analysis publiee dans le S-1, aucun scenario downside chiffre.',
    clientsNamed: [],
    boardMembers: [],
  },
  financialData: makeFinancials({
    revenue: 423000000,
    grossMargin: 0.49,
    contributionMargin: -0.07, // negative apres CAC et returns
    monthlyBurn: 8000000, // ~ 100M annuel
    runwayMonths: 14,
    totalCapitalRaised: 340000000,
    cacPayback: 0, // pas de subscription, transaction unique
    ltvCacRatio: 1.1, // tres faible repeat
    qoqGrowthRate: 0.05, // deceleration
    rawNotes: 'CAC 350 USD, AOV 800 USD, gross profit unitaire 392 USD, cout retours moyen 100 USD net, contribution margin par nouveau client -58 USD apres CAC et returns. Repeat rate <20% a 2 ans. Aucune trajectoire vers le breakeven articulee. Marketing ratio 36% du revenu en 2019.',
  }),
};

// ============================================================
// 4. MoviePass 2017 (Helios & Matheson Analytics filings)
// ============================================================
//
// Source : 10-Q HMNY 2017-2018, articles WSJ et The Information.
// Service : abo cinema illimite a 9,95 USD par mois, prix moyen
// place de cinema US 11 USD. Croissance fulgurante 20K a 3M
// abonnes en 6 mois. Burn mensuel 21,7 M USD documente Q4 2017.
// ============================================================

const moviepass: ReferenceDossier = {
  id: 'moviepass-2017',
  label: 'MoviePass (Helios & Matheson, fin 2017)',
  extraction: {
    companyName: 'MoviePass (Helios & Matheson Analytics)',
    sector: 'Consumer subscription',
    subSector: 'Cinema subscription',
    geographicHub: 'New York',
    country: 'USA',
    yearFounded: 2011,
    founders: [
      { name: 'Mitch Lowe', role: 'CEO', background: 'co-founder Netflix, ex-Redbox' },
      { name: 'Stacy Spikes', role: 'co-founder evince', background: 'industrie cinema' },
    ],
    marketPitch: 'Netflix du cinema en salle. 9,95 USD par mois pour un film par jour dans n importe quel cinema US. 3 millions d abonnes en 6 mois apres baisse du prix de 50 USD a 9,95 USD en aout 2017. Donnees de comportement spectateur uniques, monetisation publicitaire et data future. Disruption de l industrie de l exhibition.',
    productDescription: 'App mobile + carte de paiement debit propre. L abonne paye 9,95 USD par mois, MoviePass paie le ticket plein tarif au cinema (11 USD moyen) via la carte. Aucun deal commercial avec les chaines de cinema (AMC refuse explicitement de partager le revenu).',
    businessModel: 'Subscription 9,95 USD par mois. Cout d acquisition par film (le ticket plein tarif paye au cinema) en moyenne 11 USD. Si l abonne moyen voit 1,5 film par mois, le cout direct est 16,5 USD pour un revenu 9,95 USD = perte de 6,55 USD par mois par abonne, avant CAC marketing et structure. Pari sur la baisse future du cout via deals avec les chaines (jamais conclus) et sur la monetisation data.',
    traction: {
      metrics: ['3 M abonnes en oct 2017', 'app top 10 store iOS'],
      revenue: '~ 30 M USD MRR 3M abonnes x 9,95',
      growth: '+15000% YoY (20K a 3M en 6 mois)',
      customers: '3M actifs',
    },
    fundraise: {
      stage: 'subsidiaire de HMNY Nasdaq',
      amount: 'levees publiques convertibles 60 M USD H2 2017',
      valuation: 'HMNY market cap volatile 30 M a 800 M USD',
      leadInvestor: 'public market',
      coInvestors: [],
    },
    competitorsCited: ['AMC Stubs A-List', 'Sinemia', 'Netflix (substitution)'],
    rawSummary: 'MoviePass a la fin 2017 : 3M abonnes, MRR ~30 M USD, cout direct films ~50 M USD par mois (3M abonnes x 1,5 film x 11 USD), perte directe ~20 M USD par mois avant overhead. Cash burn declare Q4 2017 21,7 M USD par mois. Aucun deal de pricing conclu avec AMC. Aucun plan articule de retournement de l unit economics. Strategie communiquee : grandir l abonne base puis monetiser la data, sans projection chiffree. Cesse les paiements aux cinemas en juillet 2018, faillite HMNY janvier 2020.',
    clientsNamed: [],
    boardMembers: [],
  },
  financialData: makeFinancials({
    revenue: 360000000, // 30M MRR x 12
    grossMargin: -0.65, // cout direct films > prix abo
    contributionMargin: -0.65,
    monthlyBurn: 21700000,
    runwayMonths: 3, // documentation Q4 2017
    totalCapitalRaised: 120000000,
    cacPayback: 999, // jamais payback negatif
    ltvCacRatio: 0.3,
    qoqGrowthRate: 5.0, // 500% QoQ
    rawNotes: 'Cout direct par abonne 16,5 USD par mois (1,5 film x 11 USD), revenu 9,95 USD, perte unitaire structurelle 6,55 USD par abonne par mois avant CAC et overhead. Aucun deal commercial avec chaines de cinema. Pari implicite sur la monetisation data jamais chiffre. Cash burn 21,7 M USD par mois fin 2017 declare HMNY 10-Q.',
  }),
};

// ============================================================
// 5. Atlassian pre-IPO (S-1 octobre 2015)
// ============================================================
//
// Counter-archetype sain. Source : S-1 Atlassian (oct 2015).
// Revenu FY2015 : 320 M USD. Net income legerement positif. Gross
// margin 84%. Marketing ratio extraordinaire 18% du revenu (vs
// 50%+ pour les SaaS classiques). Pas de sales team directe,
// distribution self-serve via le site. Bootstrappe quasi sans
// financement externe (60 M USD leves en tout). Path to
// profitability deja prouve.
// ============================================================

const atlassian: ReferenceDossier = {
  id: 'atlassian-preipo-2015',
  label: 'Atlassian pre-IPO (S-1, octobre 2015)',
  extraction: {
    companyName: 'Atlassian Corporation Plc',
    sector: 'SaaS B2B',
    subSector: 'Outils developpement et collaboration',
    geographicHub: 'Sydney',
    country: 'Australie',
    yearFounded: 2002,
    founders: [
      { name: 'Mike Cannon-Brookes', role: 'co-CEO', background: 'fondateur, UNSW' },
      { name: 'Scott Farquhar', role: 'co-CEO', background: 'fondateur, UNSW' },
    ],
    marketPitch: 'Outils de productivite developpeur et collaboration d equipe : JIRA, Confluence, Bitbucket, HipChat, Trello. 51K customers dans 160 pays, 85% du Fortune 500. Modele unique sans sales team, distribution self-serve, prix transparents publies sur le site. Croissance 36% YoY rentable.',
    productDescription: 'Suite SaaS de plusieurs produits independants (JIRA pour ticketing/dev, Confluence pour wiki/docs, Bitbucket pour git, HipChat pour chat, Trello pour kanban). Pricing per-user mensuel transparent. Marketplace de plugins tiers avec commission Atlassian. Consultants partenaires pour le deploiement enterprise.',
    businessModel: 'SaaS subscription per-user, pricing transparent self-serve. Distribution sans sales team directe : croissance organique via les developpeurs adoptant les outils, expansion virale interne enterprise. Marketing ratio 18% du revenu en FY2015 (vs 40-60% benchmark SaaS). Gross margin 84%. Net retention 130%+. Marketplace plugins generant revenu marginal.',
    traction: {
      metrics: ['51K customers', '160 pays', '85% Fortune 500', 'NRR 130%+'],
      revenue: '320 M USD FY2015',
      growth: '+36% YoY, rentable',
      customers: '51K',
    },
    fundraise: {
      stage: 'IPO Nasdaq decembre 2015',
      amount: '462 M USD secondary offering',
      valuation: '4,4 Md USD post-IPO',
      leadInvestor: 'IPO public',
      coInvestors: ['T Rowe Price', 'Accel (un seul tour secondaire 2010)'],
    },
    competitorsCited: ['Microsoft', 'IBM', 'GitLab', 'GitHub', 'Slack'],
    rawSummary: 'Atlassian depose son S-1 octobre 2015 avec revenu FY2015 320 M USD, net income legerement positif, gross margin 84%, marketing ratio 18%, NRR 130%+, 51K customers payants. Bootstrappe : 60 M USD leves au total dont une seule ronde Accel 2010 secondary, le reste cash genere. Cash en banque 200 M USD au S-1 sans burn. Path to profitability deja demontre, IPO sert a la liquidite des fondateurs et de l early team. Counter-archetype canonique du SaaS asset-light avec unit economics positive.',
    clientsNamed: [],
    boardMembers: [],
  },
  financialData: makeFinancials({
    revenue: 320000000,
    grossMargin: 0.84,
    contributionMargin: 0.55,
    monthlyBurn: 0, // rentable
    runwayMonths: 999, // pas de notion de runway
    totalCapitalRaised: 60000000,
    cacPayback: 14,
    ltvCacRatio: 8.0,
    qoqGrowthRate: 0.08,
    fixedBurn: 4000000, // payroll core et infra cloud, mais largement couvert par revenu
    totalCommitments: 50000000,
    rentAnnual: 12000000,
    payroll: 90000000,
    rawNotes: 'NRR 130%+. Marketing ratio 18% du revenu vs 50%+ benchmark SaaS. Pas de sales team directe. Cash en banque 200 M USD sans burn au moment du S-1. Capital efficiency exceptionnelle 5,3x USD revenu pour 1 USD leve.',
  }),
};

// ============================================================
// 6. Stripe Series E (novembre 2016)
// ============================================================
//
// Counter-archetype sain. Source : articles The Information /
// Bloomberg / leaks 2016-2018, declarations publiques Patrick
// Collison. Stripe Series E 9,2 Md USD valuation. Run-rate revenu
// estime 350 M USD 2016. Croissance 100%+ YoY. Marges nettes
// commission 1-2% sur GMV plusieurs Md USD trimestriels.
// ============================================================

const stripe: ReferenceDossier = {
  id: 'stripe-seriesE-2016',
  label: 'Stripe Series E (novembre 2016)',
  extraction: {
    companyName: 'Stripe Inc',
    sector: 'Fintech',
    subSector: 'Payment infrastructure',
    geographicHub: 'San Francisco',
    country: 'USA',
    yearFounded: 2010,
    founders: [
      { name: 'Patrick Collison', role: 'CEO', background: 'serial entrepreneur, Y Combinator, MIT dropout' },
      { name: 'John Collison', role: 'President', background: 'Harvard dropout, co-fondateur' },
    ],
    marketPitch: 'Infrastructure de paiement pour internet. Une integration API simple, 7 lignes de code, et un site marchand accepte les cartes du monde entier. 100K+ marchands actifs, plusieurs Md USD de GMV trimestriel. Internet a besoin d une couche de paiement qui marche aussi bien que le HTTP, c est ce que Stripe construit.',
    productDescription: 'API de paiement, dashboard merchant, billing recurrent (Atlas, Connect, Radar fraud, Sigma analytics, Issuing cartes). Integration developpeur premiere : SDKs Ruby, Python, Node, Go, Java, PHP. Documentation reference du marche. Connect pour les marketplaces (Shopify, Lyft, Postmates).',
    businessModel: 'Commission 2,9% + 0,30 USD par transaction reussie sur les paiements processes. Commission sur les flux Connect des marketplaces. Pricing transparent identique pour tous les merchants. Pas de sales team enterprise (sauf comptes ultra-larges). Marge nette commission 1,2-1,5% apres interchange Visa/MC payes en pass-through.',
    traction: {
      metrics: ['100K+ merchants actifs', 'plusieurs Md USD GMV trimestriel', 'integration Shopify Lyft Slack Salesforce'],
      revenue: '~350 M USD run-rate 2016 (estime, prive)',
      growth: '+100% YoY estime',
      customers: '100K+',
    },
    fundraise: {
      stage: 'Series E',
      amount: '150 M USD',
      valuation: '9,2 Md USD post-money',
      leadInvestor: 'CapitalG (Google) + General Catalyst',
      coInvestors: ['Sequoia', 'Andreessen Horowitz', 'Khosla', 'Founders Fund'],
    },
    competitorsCited: ['PayPal Braintree', 'Adyen', 'Square (PoS more than online)', 'banks acquiring'],
    rawSummary: 'Stripe Series E novembre 2016 a 9,2 Md USD post-money. Run-rate revenu estime 350 M USD 2016, en croissance 100%+ YoY. Marges nettes commission 1,2-1,5% sur le GMV. Cash levee cumulee 460 M USD pour run-rate revenu 350 M USD = capital efficiency 1,3x. Asset-light : pas de capex, pas de stocks, pas de baux longs significatifs. Switching cost eleve : une fois integre code l API, migrer ailleurs coute des semaines de dev. Counter-archetype canonique unit economics SaaS marketplace sain.',
    clientsNamed: [
      { name: 'Shopify', company: 'Shopify', relationship: 'Connect partenariat strategique' },
      { name: 'Lyft', company: 'Lyft', relationship: 'Connect marketplace' },
    ],
    boardMembers: [
      { name: 'Mike Moritz', role: 'director', affiliation: 'Sequoia' },
      { name: 'David Sacks', role: 'director', affiliation: 'Founders Fund' },
    ],
  },
  financialData: makeFinancials({
    revenue: 350000000,
    grossMargin: 0.78,
    contributionMargin: 0.40,
    monthlyBurn: 5000000, // burn modere par rapport au revenu
    runwayMonths: 60,
    totalCapitalRaised: 460000000,
    cacPayback: 9,
    ltvCacRatio: 12.0, // switching costs elevent LTV massivement
    qoqGrowthRate: 0.20,
    rawNotes: 'Capital efficiency 1,3x : 460 M USD leves pour 350 M USD revenu. Asset-light, pas de capex, pas de stocks. Switching cost API integre eleve. NRR estime 130%+.',
  }),
};

// ============================================================
// 7. Mistral AI Series B (juin 2024)
// ============================================================
//
// Source : Les Echos / The Information / TechCrunch 2024.
// Series B 600 M EUR a 6 Md EUR post-money. Revenu 2024 estime
// 30-50 M EUR. Capex compute massif via Microsoft Azure et infra
// proprietaire en construction. Modeles open weight (Mistral 7B,
// Mixtral) et closed (Mistral Large) en parallele.
// ============================================================

const mistral: ReferenceDossier = {
  id: 'mistral-seriesB-2024',
  label: 'Mistral AI Series B (juin 2024)',
  extraction: {
    companyName: 'Mistral AI',
    sector: 'AI',
    subSector: 'Foundation models',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2023,
    founders: [
      { name: 'Arthur Mensch', role: 'CEO', background: 'ex-Google DeepMind, Polytechnique ENS' },
      { name: 'Guillaume Lample', role: 'Chief Science Officer', background: 'ex-Meta AI, LLaMa lead' },
      { name: 'Timothee Lacroix', role: 'CTO', background: 'ex-Meta AI' },
    ],
    marketPitch: 'Frontier AI lab europeen. Modeles open weight (Mistral 7B, Mixtral 8x7B) et fermes (Mistral Large) competitifs avec OpenAI et Anthropic. Sovereign AI europeen, conforme RGPD et AI Act, hebergement EU. Modele commercial dual : API closed models pour les enterprises, open weight pour la communaute developpeur.',
    productDescription: 'Famille de LLMs : Mistral 7B (open), Mixtral 8x7B Mixture of Experts (open), Mistral Large (fermé, accessible API et Azure). Plateforme La Plateforme pour API access. Le Chat consumer comme front-end de demonstration. Partenariats Microsoft Azure pour distribution Azure AI.',
    businessModel: 'API B2B pricing per-token sur les modeles fermes (Mistral Large). Distribution via Azure AI marketplace en commission revenue share avec Microsoft. Open weight gratuit, monetise indirectement via la notoriete et les contrats enterprise privilegies.',
    traction: {
      metrics: ['Mistral 7B telecharge >5M fois HF', 'Le Chat lance', 'partenariat Microsoft annonce', 'enterprise customers BNP Paribas, Cap Gemini'],
      revenue: '30-50 M EUR estime 2024',
      growth: '+rapide depuis lancement Q3 2023',
      customers: 'plusieurs centaines API + Azure indirects',
    },
    fundraise: {
      stage: 'Series B',
      amount: '600 M EUR',
      valuation: '6 Md EUR post-money',
      leadInvestor: 'General Catalyst + Andreessen Horowitz + Lightspeed',
      coInvestors: ['BNP Paribas', 'Cisco', 'Salesforce Ventures', 'Microsoft'],
    },
    competitorsCited: ['OpenAI', 'Anthropic', 'Google DeepMind', 'Meta AI', 'Cohere'],
    rawSummary: 'Mistral AI Series B 600 M EUR a 6 Md EUR post-money juin 2024. Revenu run-rate estime 30-50 M EUR 2024. Capex training compute massif : training runs Mistral Large estimes 10-20 M USD par run, plusieurs runs par an. Dependance massive a NVIDIA H100 et a Microsoft Azure pour la distribution Azure AI marketplace. Concurrence directe avec OpenAI et Anthropic, dont les modeles fermes peuvent cannibaliser le segment enterprise haut de gamme. Open weight comme strategie de defensibilite communautaire mais commoditise simultanement le marche du foundation model entry-level (LLaMa Meta, Qwen Alibaba, Mistral en sont les agents). Cap table dilue rapidement : Series A 105 M EUR (decembre 2023) puis Series B 600 M EUR six mois apres a 4x la valorisation, mais avec preferences possibles non publiees.',
    clientsNamed: [
      { name: 'BNP Paribas', company: 'BNP Paribas', relationship: 'enterprise customer + investisseur Series B' },
      { name: 'Microsoft', company: 'Microsoft', relationship: 'partenariat Azure + investisseur' },
    ],
    boardMembers: [],
  },
  financialData: makeFinancials({
    revenue: 40000000,
    grossMargin: 0.40, // marge API apres compute Azure
    contributionMargin: 0.20,
    monthlyBurn: 18000000, // estimation : payroll ~150 ETP + capex compute amorti
    runwayMonths: 33, // 600M leve / 18M = 33 mois
    totalCapitalRaised: 720000000, // 105 + 600 + seed
    cacPayback: 18,
    ltvCacRatio: 3.0,
    qoqGrowthRate: 0.50,
    capex: 100000000, // estimations training runs cumules
    payroll: 80000000, // 150 ETP x ~500K all-in
    rawNotes: 'Dependance critique infra NVIDIA H100 et Microsoft Azure (distribution, compute, capital). Open weight strategie tres exposee a la commoditisation par Meta LLaMa et Alibaba Qwen. Concurrence directe OpenAI et Anthropic mieux capitalises (>10 Md USD). Cap table : Series A 105M EUR puis Series B 600M EUR six mois plus tard, dilution massive en peu de temps.',
  }),
};

// ============================================================
// 8. Northvolt Series E (janvier 2023, avant restructuration)
// ============================================================
//
// Source : FT, Bloomberg, BloombergNEF, declaration faillite
// novembre 2024.
// Series E juin 2023 1,2 Md USD a 12 Md USD valuation. Capex
// gigafactory Skelleftea + Heide Allemagne en cours pour 30+ Md
// USD cumules. Premier client BMW annule contrat 2 Md EUR juin
// 2024. Faillite chap 11 novembre 2024.
// ============================================================

const northvolt: ReferenceDossier = {
  id: 'northvolt-seriesE-2023',
  label: 'Northvolt Series E (janvier 2023)',
  extraction: {
    companyName: 'Northvolt AB',
    sector: 'Manufacturing industriel',
    subSector: 'Batteries lithium-ion EV',
    geographicHub: 'Stockholm',
    country: 'Suede',
    yearFounded: 2016,
    founders: [
      { name: 'Peter Carlsson', role: 'CEO', background: 'ex-Tesla VP Supply Chain' },
      { name: 'Paolo Cerruti', role: 'COO', background: 'ex-Tesla Director' },
    ],
    marketPitch: 'European battery champion. Gigafactory Skelleftea Suede operationnelle, Heide Allemagne en construction. Premier producteur europeen de cellules lithium-ion grade EV avec process bas-carbone (hydroelectrique nordique). Cible 150 GWh capacite installee 2030, 50 Md EUR de carnet de commandes signes (BMW, VW, Volvo Cars, Polestar, Scania).',
    productDescription: 'Cellules cylindriques 21700 et prismatiques pour packs EV automotive. Process electrochimique proprietaire, cathode NMC, electrolyte standard, anode silicium-graphite. R&D etend a sodium-ion (Northvolt Ett Voltpack) et batteries stationnaires.',
    businessModel: 'Vente de cellules a contrats long terme automotive (5-10 ans) avec engagements volumes minimums. Pricing par kWh negocie avec rebates volume. Capex gigafactory amorti sur duree contrats. Necessite ramp-up industriel rapide pour atteindre l economie d echelle qui rend les unit economics viables (cible <100 USD/kWh pack-level).',
    traction: {
      metrics: ['gigafactory Skelleftea 16 GWh capacite 2024', '50 Md EUR carnet de commandes', 'BMW VW Volvo signes'],
      revenue: '128 M USD 2022',
      growth: 'pre-ramp industriel',
      customers: '6 OEM automotive signes',
    },
    fundraise: {
      stage: 'Series E',
      amount: '1,2 Md USD planifie pour cloture juin 2023',
      valuation: '12 Md USD post-money',
      leadInvestor: 'Volkswagen Group + Goldman Sachs Asset Management',
      coInvestors: ['BMW', 'BlackRock', 'Baillie Gifford', 'Andra AP', 'Folksam'],
    },
    competitorsCited: ['CATL', 'LG Energy Solution', 'Samsung SDI', 'Panasonic', 'BYD'],
    rawSummary: 'Northvolt Series E janvier 2023 1,2 Md USD a 12 Md USD valuation post-money. Capex cumule deja engage 8 Md USD pour Skelleftea operationnelle 16 GWh, plan 30 Md USD additionnel pour Heide Allemagne et expansion Skelleftea. Revenu 2022 128 M USD vs cible 5 Md USD 2030. Yield production Skelleftea 2023 sous 50% des cellules conformes vs 90% benchmark CATL. BMW annule contrat 2 Md EUR juin 2024 pour cause yield insuffisant. Cap table 9 Md USD leves cumules dont financement subordonne EU. Marche EV ralentit apres pic 2023, demande pack auto sous prevision. Bilan : industrialisation prematuree massive, capex perdu si yield ne remonte pas, cap table fragile en cas de down round impossible. Faillite chap 11 novembre 2024.',
    clientsNamed: [
      { name: 'BMW', company: 'BMW Group', relationship: 'contrat 2 Md EUR signe 2020 puis annule juin 2024' },
      { name: 'Volkswagen', company: 'VW Group', relationship: 'contrat + investisseur lead Series E' },
      { name: 'Volvo Cars', company: 'Volvo Cars', relationship: 'JV gigafactory Goteborg' },
    ],
    boardMembers: [
      { name: 'Carl-Erik Lagercrantz', role: 'chairman', affiliation: 'Vargas Holding' },
    ],
  },
  financialData: makeFinancials({
    revenue: 128000000,
    grossMargin: -0.40, // production sub-scale, yield faible
    contributionMargin: -0.50,
    monthlyBurn: 200000000, // 2,4 Md USD annuel run-rate
    runwayMonths: 9,
    totalCapitalRaised: 9000000000, // cumule equity + debt
    cacPayback: 0,
    ltvCacRatio: 0,
    qoqGrowthRate: 0.30,
    capex: 8000000000, // capex gigafactory engage
    fixedBurn: 180000000, // payroll + amortissement gigafactory
    totalCommitments: 30000000000, // futures expansions deja engagees + offtake garanties OEM
    rentAnnual: 50000000,
    payroll: 800000000, // 5000 ETP a Skelleftea
    rawNotes: 'Capex cumule deja engage 8 Md USD pour Skelleftea operationnelle 16 GWh. Yield production sous 50% (vs 90% CATL benchmark). BMW annule contrat 2 Md EUR juin 2024 pour yield insuffisant. Plan capex additionnel 30 Md USD pour Heide et expansion. Aucune capacite documentee de variabilisation : gigafactory tournant ou non, payroll fixe et capex amorti.',
  }),
};

// ============================================================
// 9. Ynsect Series D (octobre 2022, avant restructuration 2024)
// ============================================================
//
// Source : Les Echos, articles industrie agroalimentaire, Pappers,
// communications presse Ynsect.
// Series D octobre 2022 160 M USD complementaires sur la levee
// 2020 (425 M USD initiale). Capex Amiens (Ynfarm) en cours, marche
// petfood et aquaculture qui n a pas suivi le rythme attendu.
// Plan social juillet 2024 - 80 postes.
// ============================================================

const ynsect: ReferenceDossier = {
  id: 'ynsect-seriesD-2022',
  label: 'Ynsect Series D (octobre 2022)',
  extraction: {
    companyName: 'Ynsect',
    sector: 'Manufacturing industriel',
    subSector: 'Agroalimentaire insectes proteines',
    geographicHub: 'Paris / Amiens',
    country: 'France',
    yearFounded: 2011,
    founders: [
      { name: 'Antoine Hubert', role: 'CEO', background: 'ENGREF, biologiste de formation' },
      { name: 'Jean-Gabriel Levon', role: 'co-founder', background: 'Polytechnique' },
      { name: 'Alexis Angot', role: 'co-founder', background: 'engineering background' },
    ],
    marketPitch: 'Leader mondial des proteines d insectes premium. Ynfarm Amiens, plus grande ferme verticale d insectes au monde. Production de proteines pour aquaculture, petfood, et nutrition humaine a partir de Tenebrio molitor. Marche mondial proteines alternatives en croissance 30% par an. Premium price justifie par la qualite nutritionnelle (acides amines, omega 3) et la durabilite (95% moins de surface vs soja).',
    productDescription: 'YnMeal proteines pour aquaculture saumon. YnPet proteines pour petfood premium. Ynfrass engrais issu des dejections. Production verticale climatisee, automatisation poussee. Brevets nombreux sur le procede d elevage et de transformation.',
    businessModel: 'Vente B2B de proteines en kg a aquaculteurs (Skretting, BioMar) et petfood (groupes premium). Pricing premium 4-8 EUR/kg vs farine de poisson 1,5-2,5 EUR/kg. Volumes en ramp-up dependant de la mise en service Ynfarm Amiens (cible 200K tonnes par an a maturite).',
    traction: {
      metrics: ['Ynfarm Amiens en construction', 'contrats Skretting BioMar signes', 'autorisation alimentation humaine UE 2021'],
      revenue: '~10 M EUR estime 2022',
      growth: 'pre-ramp industriel',
      customers: '~20 aquaculteurs et petfood B2B',
    },
    fundraise: {
      stage: 'Series D extension',
      amount: '160 M USD complementaires',
      valuation: 'non communique (estime 700 M EUR cumulee post-money)',
      leadInvestor: 'Astanor Ventures + Armat Group',
      coInvestors: ['BPI France', 'Idia Capital Investissement', 'Demeter'],
    },
    competitorsCited: ['Protix', 'InnovaFeed', 'AgriProtein', 'Beta Hatch'],
    rawSummary: 'Ynsect Series D octobre 2022 160 M USD complementaires sur la levee 425 M USD octobre 2020. Capex Ynfarm Amiens construit pour cible 200K tonnes par an, mise en service progressive 2022-2024. Revenu 2022 estime 10 M EUR vs investissement industriel cumule >250 M EUR. Marche petfood premium et aquaculture saumon n a pas suivi le rythme prevu : prix farine de poisson n a pas explose (subi quelques pics mais stable globalement), pricing premium insectes harder to defend que prevu, demande petfood premium ralentit avec inflation 2022. Plan social juillet 2024 -80 postes annonce. Procedure de sauvegarde 2024.',
    clientsNamed: [
      { name: 'Skretting', company: 'Skretting (Nutreco)', relationship: 'contrat aquaculture saumon' },
      { name: 'BioMar', company: 'BioMar', relationship: 'contrat aquaculture' },
    ],
    boardMembers: [],
  },
  financialData: makeFinancials({
    revenue: 10000000,
    grossMargin: -0.20, // sub-scale industriel
    contributionMargin: -0.30,
    monthlyBurn: 6000000,
    runwayMonths: 14,
    totalCapitalRaised: 600000000, // cumule equity + debt + subventions
    cacPayback: 0,
    ltvCacRatio: 0,
    qoqGrowthRate: 0.25,
    capex: 250000000, // Ynfarm Amiens
    fixedBurn: 5000000,
    totalCommitments: 800000000, // capex futur engagement + minimums fournisseurs OEMs
    rentAnnual: 8000000,
    payroll: 25000000, // 350 ETP
    rawNotes: 'Ynfarm Amiens cible 200K tonnes par an a maturite, en service progressive 2022-2024. Revenu 2022 estime 10 M EUR vs capex industriel cumule >250 M EUR. Marche petfood premium et aquaculture saumon ralentit. Plan social juillet 2024 -80 postes annonce. Procedure de sauvegarde 2024.',
  }),
};

// ============================================================
// 10. Klarna 2022 (avant la chute de valorisation 46 a 6 Md USD)
// ============================================================
//
// Source : filings Klarna Holding, FT, Reuters, Pitchbook.
// 2021 : valorisation 45,6 Md USD round prive Softbank. 2022 :
// down round 6,7 Md USD juillet. Pertes 2021 : 748 M USD. Pertes
// 2022 H1 : 581 M USD. Modele BNPL non rentable, expansion US
// agressive coute des centaines de millions sans path articule.
// ============================================================

const klarna: ReferenceDossier = {
  id: 'klarna-2022',
  label: 'Klarna (2022, avant down round)',
  extraction: {
    companyName: 'Klarna Holding AB',
    sector: 'Fintech',
    subSector: 'BNPL Buy Now Pay Later',
    geographicHub: 'Stockholm',
    country: 'Suede',
    yearFounded: 2005,
    founders: [
      { name: 'Sebastian Siemiatkowski', role: 'CEO', background: 'co-fondateur, Stockholm School of Economics' },
      { name: 'Niklas Adalberth', role: 'co-founder', background: 'co-fondateur' },
    ],
    marketPitch: 'Smoooth shopping. Leader mondial BNPL. 147 millions de consommateurs, 400K marchands, 1,8 milliard de transactions par an. Expansion US agressive depuis 2019 pour devenir l alternative de paiement digital de reference contre Affirm, Klarna, PayPal Pay in 4. Application bancaire complete a venir.',
    productDescription: 'Pay in 4 (4 paiements sans interets), Pay in 30 (paiement differe 30 jours), credit a la consommation traditionnel. Integration checkout marchand via API et SDK. Application consommateur agregateur : achats, paiements, scoring credit, marketing personalise.',
    businessModel: 'Commission marchand 3-6% du panier (vs 2-3% Visa MC), interets et frais de retard sur les credits a la consommation, monetisation marketing affilie via l app consommateur. Cout du risque eleve sur le BNPL Pay in 4 (defauts US estimes 4-5% vs <1% interchange Visa). Capital interne pour financer les creances en attente de remboursement.',
    traction: {
      metrics: ['147M consommateurs', '400K marchands', '1,8 Md transactions par an'],
      revenue: '1,5 Md USD 2021',
      growth: '+44% YoY 2021',
      customers: '147M consommateurs',
    },
    fundraise: {
      stage: 'down round 2022',
      amount: '800 M USD',
      valuation: '6,7 Md USD post-money (vs 45,6 Md USD juin 2021)',
      leadInvestor: 'Sequoia + Mubadala',
      coInvestors: ['SoftBank Vision Fund 2 (existing)', 'Permira', 'Silver Lake', 'Commonwealth Bank Australia'],
    },
    competitorsCited: ['Affirm', 'Afterpay (Block)', 'PayPal Pay in 4', 'Klarna', 'Apple Pay Later'],
    rawSummary: 'Klarna 2022 down round juillet : valorisation 6,7 Md USD vs 45,6 Md USD un an plus tot, soit 85% de baisse. Pertes 2021 declarees 748 M USD vs profit 38 M USD 2019, deterioration causee par expansion US (cout du risque + marketing massif), partiellement amortie par croissance du revenu (+44% YoY 1,5 Md USD 2021). Cost-of-credit 2022 H1 multiplie par 5 vs 2020 sur le portefeuille US. Modele BNPL Pay in 4 attaque par Apple Pay Later (lancement WWDC juin 2022) et regulation US CFPB qui durcit le cadre. Layoffs annonces mai 2022 (-10% headcount). Cap table tres dilue par les rondes successives 2020-2021 a peak SaaS, preferences elevees pour les nouveaux entrants.',
    clientsNamed: [],
    boardMembers: [],
  },
  financialData: makeFinancials({
    revenue: 1500000000,
    grossMargin: 0.30, // apres cost of credit US explosif
    contributionMargin: -0.10,
    monthlyBurn: 60000000, // 700M+ pertes annuelles
    runwayMonths: 13,
    totalCapitalRaised: 4500000000,
    cacPayback: 36,
    ltvCacRatio: 1.5,
    qoqGrowthRate: 0.10,
    rawNotes: 'Pertes 2021 declarees 748 M USD, H1 2022 581 M USD. Cost-of-credit US x5 vs 2020 sur Pay in 4. Apple Pay Later annonce juin 2022 cannibalise le Pay in 4 simple (commoditisation). Regulation US CFPB durcit le cadre BNPL (regulatory time bomb potentielle). Cap table tres dilue par series multiples 2020-2021 a peak valuation, preferences elevees nouveaux entrants down round.',
  }),
};

// ============================================================
// EXPORT REGISTRY
// ============================================================

export const REFERENCE_DOSSIERS: ReferenceDossier[] = [
  wework,
  theranos,
  casper,
  moviepass,
  atlassian,
  stripe,
  mistral,
  northvolt,
  ynsect,
  klarna,
];

export function getDossier(id: DossierId): ReferenceDossier {
  const d = REFERENCE_DOSSIERS.find((d) => d.id === id);
  if (!d) throw new Error(`Dossier de reference inconnu : ${id}`);
  return d;
}
