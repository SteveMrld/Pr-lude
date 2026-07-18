// ============================================================
// EXPECTATIONS CALIBRATION FRAGILITE STRUCTURELLE
// ------------------------------------------------------------
// Pour chaque pattern × dossier, le verdict que la doctrine impose.
// Source : fiches docs/patterns/, sections "counter-archetypes" et
// "conditions de remontee a la couverture".
//
// Verdict expected :
//   - drapeau-rouge : pattern verifie en plein, signal majeur
//   - alerte        : pattern verifie partiellement, signal fort
//   - attention     : signal mitige ou en gestation
//   - sain          : pattern explicitement contredit (counter-
//                     archetype canonique)
//   - non-applicable : matiere insuffisante ou dossier hors scope
//
// Score range : fourchette tolerable autour du verdict. Sert au
// rapport de calibration pour signaler les ecarts notables sans
// chercher une correspondance numerique exacte.
// ============================================================

import type { PatternId, PatternVerdict } from '../../lib/engines/fragility-structurelle/types';
import type { DossierId } from './reference-dossiers';

export interface DossierExpectation {
  /** Verdict editorial attendu sur ce pattern pour ce dossier. */
  expectedVerdict: PatternVerdict;
  /** Fourchette de score globale toleree. Calibration acceptable
   *  si score LLM tombe dans cette fourchette OU si le verdict
   *  match exact. */
  expectedScoreRange: [number, number];
  /** Justification doctrinale en une a deux phrases. Sert au
   *  partner et au lecteur du rapport pour comprendre l attendu. */
  doctrineRationale: string;
}

export type ExpectationGrid = Record<PatternId, Record<DossierId, DossierExpectation>>;

// ============================================================
// GRILLE COMPLETE
// ============================================================

export const EXPECTATIONS: ExpectationGrid = {
  // ----------------------------------------------------------
  // GROWTH SUBSIDIZED MODEL
  // Counter-archetypes derive : Casper, MoviePass, WeWork, Cazoo, Klarna 2022
  // Counter-archetypes sains : Atlassian, Stripe, Datadog
  // ----------------------------------------------------------
  'growth-subsidized-model': {
    'wework-preipo-2019': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [70, 95],
      doctrineRationale: 'Cite explicitement par la doctrine (axe unit economics WeWork). CM negative documentee, burn 219M/mois, runway 11 mois, pas de path to profitability. Pattern canonique.',
    },
    'theranos-2014': {
      expectedVerdict: 'non-applicable',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Aucun revenu mesurable, aucun BP partage, pas d unit economics evaluable. La doctrine reserve le pattern aux Series A+ avec revenus mesurables. Doit retourner not-applicable.',
    },
    'casper-preipo-2019': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [70, 90],
      doctrineRationale: 'Counter-archetype canonique (cite nommement dans la doctrine). CM negative documentee apres CAC et returns, repeat <20%, marketing 36% du revenu, pas de path articule.',
    },
    'moviepass-2017': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [80, 100],
      doctrineRationale: 'Counter-archetype canonique. Cout direct par abonne 16,5 USD pour revenu 9,95 USD, perte unitaire structurelle 6,55 USD avant CAC. Pattern le plus pur de subvention de croissance.',
    },
    'atlassian-preipo-2015': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Counter-archetype sain canonique (cite nommement). Gross margin 84%, payback rapide, marketing 18% du revenu, deja rentable au S-1.',
    },
    'stripe-seriesE-2016': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Counter-archetype sain canonique (cite nommement). LTV/CAC eleve avec switching costs, capital efficiency 1,3x, marges nettes commission stables et positives.',
    },
    'mistral-seriesB-2024': {
      expectedVerdict: 'attention',
      expectedScoreRange: [30, 60],
      doctrineRationale: 'Modele commercial dual non commoditise mais capex training massif et marges API encore en construction. Pattern present a niveau modere, pas drapeau-rouge faute de signaux pleins.',
    },
    'northvolt-seriesE-2023': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 85],
      doctrineRationale: 'Modele industriel pre-ramp avec marge brute negative et capex non amorti. Le pattern Growth Subsidized s applique partiellement (la subvention est ici industrielle non commerciale), Scale Mirage Risk porte la lecture principale.',
    },
    'ynsect-seriesD-2022': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'Industriel pre-ramp marge negative documentee, capex 250M EUR pour revenu 10M EUR, demande petfood premium ralentit. Variation industrielle du pattern.',
    },
    'klarna-2022': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'Cite nommement dans la doctrine (Klarna 2021-2022). BNPL non rentable, expansion US a perte massive, cost-of-credit x5. Pattern net mais scale revenu limite la severite vs MoviePass/Casper.',
    },
  },

  // ----------------------------------------------------------
  // INFRASTRUCTURE HOSTAGE
  // Pattern : dependance critique a un fournisseur d infrastructure
  // qui detient le pricing power et peut cannibaliser le client.
  // Cas pur : wrappers OpenAI (Jasper, Copy.ai), Mistral sur Azure.
  // ----------------------------------------------------------
  'infrastructure-hostage': {
    'wework-preipo-2019': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 30],
      doctrineRationale: 'WeWork est le preneur des baux, pas captif d un fournisseur tech. Pattern non applicable au modele real estate operationnel.',
    },
    'theranos-2014': {
      expectedVerdict: 'non-applicable',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Aucune infrastructure tierce evaluable dans le pitch. Pattern non applicable.',
    },
    'casper-preipo-2019': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: 'Distribution Amazon/Target plus fournisseurs matelas en sous-traitance, mais pas de captivite extreme. Pattern present a niveau modere.',
    },
    'moviepass-2017': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [80, 100],
      doctrineRationale: '100 percent COGS captif chaines exhibitor, asymetrie taille AMC vs HMNY 7:1, zero plan deverrouillage chiffre = patron pur de captivite fournisseur. Le fournisseur (AMC, Regal, Cinemark) est aussi le produit vendu et refuse explicitement la negociation commerciale, configuration extreme du pattern.',
    },
    'atlassian-preipo-2015': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Stack proprietaire, infra cloud diversifie, pas de captivite. Counter-archetype implicite.',
    },
    'stripe-seriesE-2016': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 30],
      doctrineRationale: 'Stripe est l infrastructure, pas le captif. Stack proprietaire dominant.',
    },
    'mistral-seriesB-2024': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 85],
      doctrineRationale: 'Dependance massive NVIDIA H100 plus distribution Azure marketplace plus capital Microsoft (investisseur). Triple captivite documentee.',
    },
    'northvolt-seriesE-2023': {
      expectedVerdict: 'attention',
      expectedScoreRange: [30, 55],
      doctrineRationale: 'Dependance OEM auto pour offtake (top 3 OEMs concentrent les contrats). Captivite asymetrique mais pas terminale en isolation.',
    },
    'ynsect-seriesD-2022': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: 'Dependance aquaculteurs et petfood pour offtake mais marche fragmente, pas de captivite extreme.',
    },
    'klarna-2022': {
      expectedVerdict: 'attention',
      expectedScoreRange: [30, 55],
      doctrineRationale: 'Dependance partenaires marchands pour le checkout integration. Apple Pay Later entre comme infrastructure concurrente potentiellement cannibalisante.',
    },
  },

  // ----------------------------------------------------------
  // FIXED COST TRAP
  // Counter-archetypes derive : WeWork (canonique), Compass, Quibi,
  //   MoviePass (places fixes), Peloton, Cazoo, AOL post-2002.
  // Counter-archetypes sains : Airbnb, Booking, Spotify, Netflix
  //   (cancellation), Uber post-2019, Salesforce.
  // ----------------------------------------------------------
  'fixed-cost-trap': {
    'wework-preipo-2019': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [80, 100],
      doctrineRationale: 'Counter-archetype canonique. 47,2 Md USD baux signes, 2,2 Md USD loyers annuels permanents, ratio off-balance 26x revenu, aucun downside scenario chiffre. Pattern le plus pur.',
    },
    'theranos-2014': {
      expectedVerdict: 'non-applicable',
      expectedScoreRange: [0, 30],
      doctrineRationale: 'Pas de structure de couts fixes documentee. Pattern non evaluable.',
    },
    'casper-preipo-2019': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: '60 stores retail engages plus warehouses plus marketing constant, mais pas le degre WeWork. Pattern present a niveau modere.',
    },
    'moviepass-2017': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: 'Couts variables (tickets) dominent, pas de baux ni capex industriel. Pattern partiel : payroll fixe et tech infra mais pas de trap structural.',
    },
    'atlassian-preipo-2015': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'SaaS asset-light, pas de capex industriel, baux limites. Counter-archetype.',
    },
    'stripe-seriesE-2016': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Asset-light, pas de capex, payroll variable a la croissance. Counter-archetype.',
    },
    'mistral-seriesB-2024': {
      expectedVerdict: 'attention',
      expectedScoreRange: [30, 55],
      doctrineRationale: 'Capex compute (training runs reserves H100) et payroll senior eleve, mais pas d engagements baux long terme. Pattern partiel.',
    },
    'northvolt-seriesE-2023': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [75, 100],
      doctrineRationale: 'Capex gigafactory 8 Md USD engage plus 30 Md USD additionnel planifie, payroll 800 M USD annuel, gigafactory tournant ou non. Pattern Britishvolt nomme dans la doctrine.',
    },
    'ynsect-seriesD-2022': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [80, 95],
      doctrineRationale: 'Ratio engagements/revenu 80:1 vs WeWork 26:1, depasse de 3x le canonique, scoring rule FCT force drapeau-rouge a partir de 5x. Capex Ynfarm Amiens 250M EUR irreversible, payroll industriel fixe, marche petfood ralentit. Variation francaise du pattern Britishvolt en sevérité maximale.',
    },
    'klarna-2022': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 30],
      doctrineRationale: 'Fintech asset-light, pas de capex, payroll variable. Le probleme est cost-of-credit (variable) pas couts fixes.',
    },
  },

  // ----------------------------------------------------------
  // REGULATORY TIME BOMB
  // Pattern : exposition reglementaire datable (changement de
  // regle prevu, alignement reglementaire en cours, dossier dans
  // le viseur d un regulateur).
  // ----------------------------------------------------------
  'regulatory-time-bomb': {
    'wework-preipo-2019': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: 'Risque accounting baux (IFRS 16 venait d entrer en vigueur 2019, capitalisation des leases) plus exposition gouvernance (Adam Neumann). Pattern present mais pas central.',
    },
    'theranos-2014': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [50, 80],
      doctrineRationale: 'CLIA et FDA en train d auditer le device, regulation diagnostic stricte, exposition CMS pour les remboursements assurance. Le bomb va sauter mais pas date precise.',
    },
    'casper-preipo-2019': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Pas d exposition reglementaire significative documentee. DTC matelas non regule.',
    },
    'moviepass-2017': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 30],
      doctrineRationale: 'Pas d exposition reglementaire. Le risque est business, pas regulatoire.',
    },
    'atlassian-preipo-2015': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'SaaS B2B sans exposition reglementaire significative au moment du S-1.',
    },
    'stripe-seriesE-2016': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: 'Fintech sous PSD2 EU et regulations US par etat (KYC, AML, money transmitter licenses). Conforme et provisionne, mais regulation evolutive.',
    },
    'mistral-seriesB-2024': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 55],
      doctrineRationale: 'AI Act EU adopte 2024, obligations transparence et evaluation de risque sur foundation models. Mistral revendique sovereignty mais doit absorber les obligations.',
    },
    'northvolt-seriesE-2023': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: 'Reglementation EU sur batteries (Battery Regulation 2023) et critical raw materials. Pas de bomb mais friction reglementaire continue.',
    },
    'ynsect-seriesD-2022': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: 'Approbation alimentation humaine UE 2021 obtenue mais autres juridictions en attente. Standards vetos contention insectes evolutifs.',
    },
    'klarna-2022': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'CFPB US ouvre formellement enquete BNPL 2021-2022. Reglementation europeenne CCD-2 en cours qui imposerait au BNPL le statut credit a la consommation. Bomb a date.',
    },
  },

  // ----------------------------------------------------------
  // COMMODITIZATION DRIFT
  // Pattern : erosion de la defensibilite, faux moats, le moat
  // narre dans le pitch ne tient pas a l examen (commoditisation
  // produit, IA generative qui reproduit la valeur, etc).
  // ----------------------------------------------------------
  'commoditization-drift': {
    'wework-preipo-2019': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [50, 75],
      doctrineRationale: 'Coworking n a pas de moat technologique. IWG Regus fait la meme chose depuis 30 ans. Knotel, Industrious, Convene reproductibles. Le moat WeWork etait la marque et la croissance, pas un avantage structurel.',
    },
    'theranos-2014': {
      expectedVerdict: 'non-applicable',
      expectedScoreRange: [0, 30],
      doctrineRationale: 'Le produit n existe pas vraiment. Commoditisation n est pas le bon angle. Pattern non applicable.',
    },
    'casper-preipo-2019': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [70, 95],
      doctrineRationale: 'Categorie matelas DTC entierement commoditisee : Purple, Tuft, Saatva, Leesa, Allswell, dizaines d autres. Aucun moat technique ou logistique. Differenciation par marque uniquement, fragile sur cette categorie.',
    },
    'moviepass-2017': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'Le produit (acces cinema) n est pas defensible. AMC Stubs A-List lance directement en concurrence en 2018. Pas de moat technologique ni reseau.',
    },
    'atlassian-preipo-2015': {
      expectedVerdict: 'sain',
      expectedScoreRange: [10, 35],
      doctrineRationale: 'JIRA/Confluence enracines dans les workflows dev, switching cost eleve, marketplace plugins amplifie l effet. Counter-archetype.',
    },
    'stripe-seriesE-2016': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'API integration crée un switching cost massif (refactoring des paiements). Network effect Connect. Counter-archetype.',
    },
    'mistral-seriesB-2024': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'Open weight strategie expose au LLaMa Meta et Qwen Alibaba. Closed model attaque par OpenAI et Anthropic mieux finances. Pricing per-token converge mecaniquement.',
    },
    'northvolt-seriesE-2023': {
      expectedVerdict: 'attention',
      expectedScoreRange: [30, 55],
      doctrineRationale: 'CATL, LG Energy, Samsung SDI tres en avance sur le yield et le cost-per-kWh. Mais batterie EV reste differenciable par chemistry et localisation. Pattern partiel.',
    },
    'ynsect-seriesD-2022': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 50],
      doctrineRationale: 'Protix et InnovaFeed concurrents directs. Differenciation par scale et brevets process mais peu de moat structural.',
    },
    'klarna-2022': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'Pay in 4 reproductible : PayPal, Affirm, Apple Pay Later, Block Afterpay font le meme produit. Differenciation se reduit a la base merchant et la brand.',
    },
  },

  // ----------------------------------------------------------
  // CAPITAL STRUCTURE FRAGILITY
  // Pattern : cap table fragile (preferences elevees, dilution
  // massive recente, classes multiples avec super-voting,
  // protections anti-down-round qui menacent la common).
  // ----------------------------------------------------------
  'capital-structure-fragility': {
    'wework-preipo-2019': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'Adam Neumann classes super-voting 20x, conflits d interet documentes (immeubles loues a WeWork par Neumann). SoftBank dominant avec preferences. Cap table tres opaque.',
    },
    'theranos-2014': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 55],
      doctrineRationale: 'Holmes en super-voting class. Mais sans BP ni round terms publies, la lecture est limitee. Pattern partial.',
    },
    'casper-preipo-2019': {
      expectedVerdict: 'attention',
      expectedScoreRange: [30, 55],
      doctrineRationale: 'Multiple rondes a peak valuation 2019 (1,1 Md USD pre-money) puis IPO casse a 470 M USD. Preferences VC actives au down round. Pattern partiel.',
    },
    'moviepass-2017': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [50, 80],
      doctrineRationale: 'Subsidiaire de HMNY public, financements convertibles dilutifs successifs sur le ticker public. Spirale dilution death-by-1000-cuts.',
    },
    'atlassian-preipo-2015': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Bootstrappe, 60 M USD leves au total dont une seule ronde Accel secondary. Cap table propre, pas de preferences agressives.',
    },
    'stripe-seriesE-2016': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 30],
      doctrineRationale: 'Capital efficiency 1,3x, rondes regulieres a valorisation montante, fondateurs dominants. Cap table saine au moment de la Series E.',
    },
    'mistral-seriesB-2024': {
      expectedVerdict: 'attention',
      expectedScoreRange: [30, 60],
      doctrineRationale: 'Series A 105 M EUR puis Series B 600 M EUR six mois plus tard a 4x la valorisation. Dilution rapide, preferences possibles non publiees. Pattern present mais flou faute de termes.',
    },
    'northvolt-seriesE-2023': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'Cap table 9 Md USD leves cumules dont financement subordonne EU. Preferences elevees, down round impossible sans declencher protections defavorables fondateurs et common. Pattern Northvolt nomme dans la doctrine.',
    },
    'ynsect-seriesD-2022': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [50, 75],
      doctrineRationale: 'Cap table tres dilue, debt financing BPI, preferences VC elevees apres Series D extension a la baisse implicite. Procedure de sauvegarde 2024.',
    },
    'klarna-2022': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [70, 95],
      doctrineRationale: 'Down round juillet 2022 -85% valuation. Preferences anti-dilution declenchees, common diluee massivement, cap table 4,5 Md USD leves cumules avec preferences en cascade.',
    },
  },

  // ----------------------------------------------------------
  // SCALE MIRAGE RISK
  // Pattern : industrialisation prematuree, capacite installee
  // avant que la demande ne soit prouvee, capex perdu si la
  // demande ne suit pas.
  // Counter-archetype derive : Britishvolt, Northvolt, Quibi (capex
  // contenu), Quayside, Ynsect, Casper (infrastructure stores).
  // Counter-archetype sain : Stripe (scale par layer logiciel),
  // Atlassian (scale sans infra), Airbnb (asset chez les hosts).
  // ----------------------------------------------------------
  'scale-mirage-risk': {
    'wework-preipo-2019': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [55, 80],
      doctrineRationale: 'Expansion 528 sites en 4 ans, occupation 80% mais marge encore negative au scale. Industrialisation realisee, risque que la demande ne suive pas la capacite installee.',
    },
    'theranos-2014': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 55],
      doctrineRationale: 'Annonce deploiement 8200 stores Walgreens vs realite 40 sites pilote. Mirage de scale annonce sans la capacite reellement deployee.',
    },
    'casper-preipo-2019': {
      expectedVerdict: 'alerte',
      expectedScoreRange: [50, 75],
      doctrineRationale: '60 stores retail proprietaires construits, capex amenagement sans demande prouvee a l unit economics positive. Variation DTC du pattern.',
    },
    'moviepass-2017': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 55],
      doctrineRationale: 'Pas de capex industriel mais scale acquisition agressive (3M abonnes en 6 mois) sans path to profitability. Pattern partiel.',
    },
    'atlassian-preipo-2015': {
      expectedVerdict: 'sain',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Scale par layer logiciel sans capex industriel. Counter-archetype.',
    },
    'stripe-seriesE-2016': {
      expectedVerdict: 'non-applicable',
      expectedScoreRange: [0, 25],
      doctrineRationale: 'Stripe est un pure software sans capex industriel ni infrastructure proprietaire significative (compute loue chez AWS puis multi-cloud, aucune ligne de production, aucun amenagement physique scale-dependent). Le pattern Scale Mirage Risk n a aucun sens structurel pour ce business model. Counter-archetype canonique not-applicable, a distinguer du counter-archetype sain qui suppose un capex maitrisé.',
    },
    'mistral-seriesB-2024': {
      expectedVerdict: 'attention',
      expectedScoreRange: [30, 55],
      doctrineRationale: 'Capex training compute eleve mais reproductible et reutilisable. Pas une industrialisation prematuree au sens Northvolt. Pattern modere.',
    },
    'northvolt-seriesE-2023': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [80, 100],
      doctrineRationale: 'Pattern Britishvolt nomme dans la doctrine. Gigafactory Skelleftea 16 GWh capex 8 Md USD avec yield <50%. Plan Heide 30 Md USD additionnel. Demande EV ralentit. Mirage de scale industriel canonique.',
    },
    'ynsect-seriesD-2022': {
      expectedVerdict: 'drapeau-rouge',
      expectedScoreRange: [70, 95],
      doctrineRationale: 'Ynfarm Amiens 200K tonnes par an cible avec capex 250M EUR pour revenu 10M EUR au moment de la Series D. Marche petfood premium ralentit. Pattern industriel pur.',
    },
    'klarna-2022': {
      expectedVerdict: 'attention',
      expectedScoreRange: [25, 55],
      doctrineRationale: 'Scale acquisition merchants et consumers agressive aux US sans unit economics prouvee. Pattern partiel cote subscriber acquisition, pas industriel.',
    },
  },
};

// ============================================================
// HELPERS POUR LE HARNAIS
// ============================================================

import type { DossierId as DossierIdAlias } from './reference-dossiers';
export type { DossierIdAlias };

/** Verdicts dans l ordre de severite croissante. Sert au calcul de
 *  l ecart entre attendu et obtenu. */
const VERDICT_ORDER: Record<PatternVerdict, number> = {
  'sain': 0,
  'attention': 1,
  'alerte': 2,
  'drapeau-rouge': 3,
  'non-applicable': -1, // hors echelle, traite a part
  'non-concluant': -1, // hors echelle, meme traitement que non-applicable
};

export function verdictGap(expected: PatternVerdict, actual: PatternVerdict): number {
  // non-applicable et non-concluant sont hors echelle : ecart 0 si
  // egaux, 99 sinon. Ces deux etats meta n admettent pas de proximite
  // avec les verdicts gradues (sain -> drapeau-rouge).
  const outOfScale = (v: PatternVerdict) => v === 'non-applicable' || v === 'non-concluant';
  if (outOfScale(expected) || outOfScale(actual)) {
    return expected === actual ? 0 : 99;
  }
  return Math.abs(VERDICT_ORDER[expected] - VERDICT_ORDER[actual]);
}

/** Calibration acceptable si verdict matche exactement OU si le score
 *  obtenu tombe dans la fourchette. Tolerance verdict adjacent
 *  acceptable avec un asterisque dans le rapport. */
export function calibrationStatus(
  expected: DossierExpectation,
  actualVerdict: PatternVerdict,
  actualScore: number,
): 'match' | 'close' | 'mismatch' {
  if (actualVerdict === expected.expectedVerdict) return 'match';
  const inRange = actualScore >= expected.expectedScoreRange[0]
    && actualScore <= expected.expectedScoreRange[1];
  if (inRange) return 'match';
  const gap = verdictGap(expected.expectedVerdict, actualVerdict);
  if (gap === 1) return 'close';
  return 'mismatch';
}
