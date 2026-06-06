// ============================================================
// ARCHETYPE SELECTOR - SELECTEUR CENTRAL D ARCHETYPES
// ------------------------------------------------------------
// Source de verite unique pour le choix d archetype proche et de
// counter-archetype dans tous les moteurs qui en assignent un :
// les sept patterns Fragilite Structurelle (Phase 4) et le moteur
// Lecture du langage (Narrative Drift).
//
// PROBLEME RESOLU. Chaque moteur dupliquait sa propre liste prose
// dans son SYSTEM_PROMPT. Adyen apparaissait comme counter-archetype
// sain dans cinq patterns differents sans gating asset_class. Un
// dossier infrastructure_physical (AIRARO type energies marines)
// recevait Adyen comme reference saine alors qu il n y a aucune
// proximite sectorielle avec un acquereur de paiements. Corriger
// dans un moteur laissait le bug ailleurs.
//
// REGLE 1 (asset_class). selectArchetype filtre same asset_class
// d abord. Si la classe ne contient aucun archetype du pole demande
// pour l axe, fallback cross-class avec crossClass=true. Le rendu
// impose alors une clause obligatoire qui cadre l analogie comme
// comportementale sur l axe et non sectorielle.
//
// REGLE 2 (outcome). Chaque entree porte un champ outcome verifie
// (success, failure, ongoing, contested). C est la source unique de
// verite. Le pole est derive deterministiquement : outcome=success
// donne pole=saine, tout autre outcome donne pole=risque. Une boite
// dont l outcome n est pas success ne peut JAMAIS occuper un slot
// reference positive ou trajectoire saine. Si une donnee est
// invalide (Hyperloop One classee saine, Rivian classe saine apres
// effondrement public), un guard runtime au chargement du module
// lance une erreur explicite. Le statut success/failure n est jamais
// infere par un LLM : il est code en dur, verifiable contre une
// source primaire.
//
// REGLE 3 (cadrage cross-echelle). Une entree mature (cotee depuis
// dix ans, leader mondial, multi-decennie de capex amortie) citee
// face a un dossier seed pre-revenue est cross-echelle. Le rendu
// impose alors une clause de cadrage qui exige une justification
// explicite (pari disruptif, modele singulier, validation long
// terme). Sans cadrage, le LLM doit retirer le comparable, pas
// l afficher nu. La regle se cumule avec la clause cross-class :
// une entree peut etre cross-class ET cross-echelle, on prefixe les
// deux clauses dans l ordre echelle puis classe.
//
// COMPLETUDE DOCTRINALE. Le roster couvre les principaux asset
// classes normalises par lib/data/sector-benchmarks.ts. Le pole
// saine pour industrial-hardware et climate-tech inclut les leaders
// matures verifies success (ASML, BYD, Apple supply chain, Orsted,
// Iberdrola, Enphase, Nvidia). Innovafeed et Rivian ne sont plus
// citables en saine : Innovafeed n a pas encore prouve sa rampe
// (outcome=ongoing) et Rivian a vu sa valuation s effondrer depuis
// l IPO (outcome=contested). Tesla et Beyond Meat restent
// volontairement absents du pole saine. Le pole risque pour ces
// classes inclut Northvolt, Britishvolt, Lilium, Faraday, Magic
// Leap, Hyperloop One (liquidee fin 2023), Electric Last Mile,
// Quirky, Nikola, Ynsect, Juicero.
// ============================================================

// ============================================================
// TYPES
// ============================================================

/**
 * Pole d un archetype : trajectoire saine (counter-exemple a citer
 * pour calibrer le dossier vers le haut) ou trajectoire risque
 * (pattern confirme dont la trajectoire connue eclaire le diagnostic
 * negatif).
 *
 * Derive de outcome (source unique de verite). success donne saine,
 * tout autre outcome donne risque. Le champ pole est conserve
 * denormalise dans le roster pour la lisibilite editoriale et pour
 * les requetes filtrees, mais un guard runtime au chargement verifie
 * la coherence avec outcome.
 */
export type ArchetypePole = 'saine' | 'risque';

/**
 * Outcome verifie d une entreprise du corpus. Champ unique, jamais
 * infere par un LLM. La valeur doit etre triangulable par une source
 * primaire (IPO public, communique officiel de liquidation, Chapter
 * 11 documente, repricing trade-press triangule).
 *
 * - success : la boite a delivre sa trajectoire. Cotation stable a
 *   long terme, prive solide avec marche d echange triangule, ou
 *   acquisition strategique pleinement realisee. Seul outcome
 *   eligible au pole saine.
 * - failure : liquidation, Chapter 11 sans relance creanciers, fraude
 *   documentee, defunct. Pole risque par construction.
 * - ongoing : boite encore en activite mais trajectoire non concluante
 *   (rampe non prouvee, valuation indeterminee). Pole risque par
 *   construction : on ne peut pas citer en counter-exemple sain ce qui
 *   n est pas encore prouve.
 * - contested : valuation effondree, repricing massif, restructuration
 *   en cours mais sans liquidation. Pole risque par construction.
 *   Citable comme contre-exemple explicitement nomme, jamais en
 *   reference positive.
 */
export type ArchetypeOutcome = 'success' | 'failure' | 'ongoing' | 'contested';

/**
 * Stade structurel d une entree du roster, utilise pour declencher
 * la clause de cadrage cross-echelle.
 *
 * - startup : early stage, pre-PMF ou PMF naissant, pre-revenue ou
 *   ARR sous 10M. Compatible avec un dossier seed sans cadrage
 *   special.
 * - scaleup : PMF confirme, expansion commerciale, ARR 10 a 100M ou
 *   equivalent. Citable face a un dossier seed avec une legere
 *   note de cadrage (decalage de stade).
 * - mature : cotation stable depuis >5 ans, leader marche etabli,
 *   capex amorti sur multi-decennie, ou licorne late stage en
 *   exploitation prouvee. Citable face a un dossier seed pre-revenue
 *   UNIQUEMENT avec la clause cadrage cross-echelle obligatoire
 *   prefixee dans la rationale.
 */
export type ArchetypeStade = 'startup' | 'scaleup' | 'mature';

/**
 * Stade du dossier en cours d analyse, derive de extraction.stage.
 * Aligne sur la granularite editoriale de l extraction primaire.
 */
export type DossierStade = ArchetypeStade;

/**
 * Derive le pole deterministiquement de l outcome. Source unique de
 * verite : un changement d outcome propage automatiquement au pole.
 */
export function poleFromOutcome(outcome: ArchetypeOutcome): ArchetypePole {
  return outcome === 'success' ? 'saine' : 'risque';
}

/**
 * Mappe le champ stage de l extraction primaire (granularite fine)
 * vers le stade structurel utilise par le selecteur. Sert a comparer
 * le dossier au stade des archetypes pour decider du cadrage cross-
 * echelle.
 */
export function stageToStade(stage: string | null | undefined): DossierStade {
  const s = (stage || '').toLowerCase().trim();
  if (!s) return 'startup';
  if (s.startsWith('pre-seed') || s.startsWith('seed') || s.startsWith('series-a')) return 'startup';
  if (s.startsWith('series-b') || s.startsWith('series-c')) return 'scaleup';
  if (s.startsWith('series-d') || s.startsWith('growth') || s.startsWith('pre-ipo')) return 'mature';
  return 'startup';
}

/**
 * Axes des moteurs qui peuvent assigner un archetype. Chaque axe
 * correspond a un pattern Phase 4 ou au moteur Narrative Drift.
 * L axe sert de gating supplementaire : un archetype peut etre
 * exemplaire sur certains axes seulement (Stripe sur unit economics
 * mais pas sur scale-mirage, ASML sur scale-mirage mais pas sur
 * narrative-drift).
 */
export type ArchetypeAxis =
  | 'growth-subsidized'
  | 'infrastructure-hostage'
  | 'fixed-cost-trap'
  | 'commoditization-drift'
  | 'capital-structure-fragility'
  | 'regulatory-time-bomb'
  | 'scale-mirage-risk'
  | 'narrative-drift';

/**
 * Une entree du roster. Multi-classes possibles : Adyen est citable
 * en fintech ET en saas-b2b parce que sa stack rails de paiement et
 * son contrat B2B le rendent narrativement exemplaire pour les deux
 * classes. WeWork reste exclusivement proptech parce que sa fragilite
 * ne se transpose pas hors immobilier.
 */
export interface ArchetypeEntry {
  /** Nom canonique editorial. Pas de variantes. */
  name: string;
  /** Asset classes auxquelles l entree appartient. Au moins une. */
  assetClasses: string[];
  /** Pole structurel de l entree. DOIT etre coherent avec outcome :
   *  outcome=success implique pole=saine, autre outcome implique
   *  pole=risque. Verifie au chargement du module. */
  pole: ArchetypePole;
  /** Outcome verifie, source unique de verite. */
  outcome: ArchetypeOutcome;
  /** Stade structurel : startup, scaleup, mature. Sert au declenchement
   *  de la clause de cadrage cross-echelle. */
  stade: ArchetypeStade;
  /** Axes pour lesquels l entree est exemplaire et citable. */
  axes: ArchetypeAxis[];
  /** Rationale court (une phrase) que le moteur peut injecter au LLM
   *  pour calibrer le pourquoi de l exemplarite. */
  rationale: string;
}

/**
 * Sortie du selecteur. Le LLM doit choisir UNIQUEMENT parmi les
 * candidats. crossClass=true declenche la clause obligatoire dans
 * le rendu de counterArchetype.
 */
export interface ArchetypeSelection {
  axis: ArchetypeAxis;
  pole: ArchetypePole;
  assetClass: string;
  candidates: ArchetypeEntry[];
  crossClass: boolean;
}

// ============================================================
// ROSTER
// ------------------------------------------------------------
// Inventaire central. Toute nouvelle entree doit decider explicitement
// son asset_class, son pole et ses axes citables. Pas d entree
// universelle non-gatee.
// ============================================================

export const ARCHETYPE_ROSTER: ArchetypeEntry[] = [
  // ----------------------------------------------------------
  // POLE SAINE (outcome=success obligatoire)
  // ----------------------------------------------------------

  // saas-b2b
  {
    name: 'Atlassian',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['growth-subsidized', 'narrative-drift', 'capital-structure-fragility'],
    rationale: 'gross margin >= 80%, CAC efficient, IPO 2015 common dominant, sobriete narrative durable',
  },
  {
    name: 'Datadog',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['growth-subsidized', 'infrastructure-hostage', 'commoditization-drift', 'narrative-drift', 'capital-structure-fragility'],
    rationale: 'unit economics SaaS classique, contribution margin saine, +500 integrations qui protegent de la captivite, structure cap table simple',
  },
  {
    name: 'Snowflake',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['infrastructure-hostage', 'narrative-drift', 'capital-structure-fragility', 'growth-subsidized'],
    rationale: 'architecture multi-cloud par construction, bascule AWS Azure GCP au niveau compte client, rigueur S-1 reference, net retention 165%',
  },
  {
    name: 'Salesforce',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['infrastructure-hostage', 'commoditization-drift', 'fixed-cost-trap'],
    rationale: 'infras propres construites sur plusieurs decennies multi-cloud, ecosysteme partenaires verrouille, engagements data center alignes sur contrats clients long terme',
  },
  {
    name: 'GitLab',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['infrastructure-hostage'],
    rationale: 'portable on-premise par construction deployable chez le client',
  },
  {
    name: 'HubSpot',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['narrative-drift'],
    rationale: 'changement de KPIs justifie strategiquement, communication financiere stable',
  },
  {
    name: 'Clio',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'scaleup',
    axes: ['commoditization-drift'],
    rationale: 'SaaS legal vertical, switching cost workflow cabinet d avocats',
  },
  {
    name: 'Toast',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['commoditization-drift'],
    rationale: 'SaaS restauration vertical, hardware integre, switching cost POS',
  },
  {
    name: 'Procore',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['commoditization-drift'],
    rationale: 'SaaS construction vertical, expansion reseau chantiers',
  },

  // fintech (multi-class avec saas-b2b pour Stripe et Adyen, dont le
  // profil narratif est exemplaire pour les deux classes)
  {
    name: 'Stripe',
    assetClasses: ['fintech', 'saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['growth-subsidized', 'infrastructure-hostage', 'capital-structure-fragility', 'regulatory-time-bomb', 'commoditization-drift', 'narrative-drift'],
    rationale: 'ratio LTV/CAC eleve avec switching cost API integree, plus de cinq processeurs en parallele, structure preferred 1x non participating, agrement etablissement de paiement obtenu en anticipation PSD2 des 2017, precision systematique meme en parlant de mission',
  },
  {
    name: 'Adyen',
    assetClasses: ['fintech', 'saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['growth-subsidized', 'infrastructure-hostage', 'capital-structure-fragility', 'regulatory-time-bomb', 'commoditization-drift', 'narrative-drift'],
    rationale: 'commission paiement avec marge transparente et stable, licences bancaires europeennes propres operant ses propres rails, IPO 2018 structure tres propre, agrement etablissement paiement obtenu en propre des 2010, constance financiere',
  },
  {
    name: 'Plaid',
    assetClasses: ['fintech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'scaleup',
    axes: ['regulatory-time-bomb'],
    rationale: 'anticipation open banking US et Europe via partenariats banques avant l obligation reglementaire',
  },
  {
    name: 'Bloomberg',
    assetClasses: ['fintech', 'mediatech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['commoditization-drift'],
    rationale: 'donnees proprietaires plus community plus workflows trading plus hardware terminal, cumul de quatre moats',
  },

  // ai-generative
  {
    name: 'Anthropic',
    assetClasses: ['ai-generative'],
    pole: 'saine',
    outcome: 'success',
    stade: 'scaleup',
    axes: ['infrastructure-hostage', 'regulatory-time-bomb'],
    rationale: 'depend de Nvidia mais avec contrats long-terme et plans TPU AMD silicon proprietaire, lab safety policy publique et dialogues continus avec AI Office europeen',
  },
  {
    name: 'Mistral',
    assetClasses: ['ai-generative'],
    pole: 'saine',
    outcome: 'success',
    stade: 'scaleup',
    axes: ['capital-structure-fragility'],
    rationale: 'tours rapides valorisation tres elevee structure preferred 1x non participating preservee fondateurs',
  },

  // marketplace-b2c / hospitality
  {
    name: 'Booking',
    assetClasses: ['marketplace-b2c', 'hospitality'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['growth-subsidized', 'fixed-cost-trap', 'commoditization-drift'],
    rationale: 'commission only pas de stock hotelier, marketplace asset-light avec marges stables',
  },
  {
    name: 'Airbnb',
    assetClasses: ['marketplace-b2c', 'hospitality'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['fixed-cost-trap', 'commoditization-drift', 'regulatory-time-bomb'],
    rationale: 'asset-light explicitement sans propriete immobiliere ni stock, post-2018 transition compliance ville par ville et accords municipalites',
  },
  {
    name: 'Uber',
    assetClasses: ['marketplace-b2c'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['fixed-cost-trap'],
    rationale: 'post-2019 reduction massive couts fixes via automation et fermeture marches non rentables',
  },
  {
    name: 'Doctolib',
    assetClasses: ['healthtech', 'saas-b2b'],
    pole: 'saine',
    outcome: 'success',
    stade: 'scaleup',
    axes: ['commoditization-drift'],
    rationale: 'SaaS sante multi-pays, switching cost praticien et agenda patient',
  },

  // mediatech
  {
    name: 'Spotify',
    assetClasses: ['mediatech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['growth-subsidized', 'commoditization-drift', 'fixed-cost-trap'],
    rationale: 'streaming avec marges streaming >= 25% et croissantes, engagements minimum garantis labels qui scalent avec revenu',
  },
  {
    name: 'Netflix',
    assetClasses: ['mediatech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['fixed-cost-trap'],
    rationale: 'engagements production massifs avec ROI mesure et flexibilite cancellation, amortissement par marche',
  },
  {
    name: 'Schibsted',
    assetClasses: ['mediatech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['commoditization-drift'],
    rationale: 'mediatech defensible par marketplaces verticales matures',
  },

  // industrial-hardware (pole saine cantonne aux leaders matures
  // success verifies. Rivian et Innovafeed retires : Rivian a un
  // outcome=contested apres effondrement -80% post-IPO, Innovafeed un
  // outcome=ongoing avec rampe industrielle non encore validee. Les
  // entrees restantes sont toutes outcome=success triangule).
  {
    name: 'ASML',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['scale-mirage-risk', 'fixed-cost-trap', 'capital-structure-fragility', 'commoditization-drift'],
    rationale: 'capex industriel systematiquement lie a contrats long terme foundries TSMC Samsung Intel, demande precede capacite, monopole structurel lithographie EUV',
  },
  {
    name: 'BYD',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['scale-mirage-risk', 'growth-subsidized', 'capital-structure-fragility'],
    rationale: 'extension industrielle Chine au rythme demande validee, financement par cash flow operationnel sur quinze ans, integration verticale batterie et vehicule',
  },
  {
    name: 'Apple supply chain',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['scale-mirage-risk', 'fixed-cost-trap'],
    rationale: 'capex Foxconn calibre demande mesuree iPhone, ajustement trimestriel, modele asset-light en aval',
  },
  {
    name: 'Orsted',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['scale-mirage-risk', 'fixed-cost-trap', 'capital-structure-fragility'],
    rationale: 'pivot offshore wind execute avec discipline capital, capex absorbe par PPA long terme et concessions',
  },
  {
    name: 'Iberdrola',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['fixed-cost-trap', 'capital-structure-fragility'],
    rationale: 'infrastructure energetique scale durable, dette projet adossee aux flux concession',
  },
  {
    name: 'Enphase Energy',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['scale-mirage-risk', 'growth-subsidized'],
    rationale: 'microinverter scale-up profitable, unit economics positives sur hardware distribue, marge brute robuste',
  },
  {
    name: 'Nvidia',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['narrative-drift'],
    rationale: 'technique au coeur de toute communication, sobriete narrative meme en croissance exponentielle',
  },

  // climate-tech / foodtech additionnels
  {
    name: 'Amazon',
    assetClasses: ['marketplace-b2c', 'mediatech'],
    pole: 'saine',
    outcome: 'success',
    stade: 'mature',
    axes: ['narrative-drift'],
    rationale: 'discours historiquement concret centre sur operations et customer obsession',
  },

  // ----------------------------------------------------------
  // POLE RISQUE (outcome failure / ongoing / contested)
  // ----------------------------------------------------------

  // proptech
  {
    name: 'WeWork',
    assetClasses: ['proptech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['growth-subsidized', 'fixed-cost-trap', 'capital-structure-fragility', 'narrative-drift', 'scale-mirage-risk'],
    rationale: 'locations sub-pricees vs cout reel, 47Md engagements pour 1,8Md revenu run-rate, SoftBank preferences cumulees plus seniority plus super voting fondateur incompatible IPO sous 47Md, passage real estate puis community puis consciousness',
  },
  {
    name: 'Compass',
    assetClasses: ['proptech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['fixed-cost-trap', 'capital-structure-fragility'],
    rationale: '4500 agents en salarie direct face cycle immobilier residentiel, recaps successifs wash-down common',
  },

  // healthtech
  {
    name: 'Theranos',
    assetClasses: ['healthtech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['regulatory-time-bomb', 'narrative-drift', 'scale-mirage-risk', 'capital-structure-fragility'],
    rationale: 'claims marketing depassant approbations FDA, refus structure de chiffres, moralisation extreme, hardware Edison deploye en pharmacie sans validation FDA, tours successifs preferences senior participation multiple sur valorisations eloignees fondamentaux',
  },

  // mediatech
  {
    name: 'MoviePass',
    assetClasses: ['mediatech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['growth-subsidized', 'infrastructure-hostage', 'fixed-cost-trap'],
    rationale: 'places de cinema vendues sous le prix d achat structurel, dependance prix exhibitors',
  },
  {
    name: 'Quibi',
    assetClasses: ['mediatech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['growth-subsidized', 'fixed-cost-trap', 'capital-structure-fragility', 'narrative-drift'],
    rationale: '1,75Md engagements contenus sans business model viable, substitution video platform par content revolution, 1,75Md preferences senior si fortes que common ne pouvaient recuperer rien sauf exit > 5Md',
  },
  {
    name: 'Zynga',
    assetClasses: ['mediatech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['infrastructure-hostage'],
    rationale: 'avant 2014 captive de Facebook viralite',
  },
  {
    name: 'AOL',
    assetClasses: ['mediatech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['fixed-cost-trap'],
    rationale: 'post-2002 data centers et personnel infrastructure dial-up obsolete face transition broadband',
  },

  // ecommerce-dtc
  {
    name: 'Casper',
    assetClasses: ['ecommerce-dtc'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['growth-subsidized', 'fixed-cost-trap'],
    rationale: 'DTC matelas, contribution margin negative documentee jusqu a la depreciation post-IPO 2020',
  },
  {
    name: 'Cazoo',
    assetClasses: ['ecommerce-dtc'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['growth-subsidized', 'fixed-cost-trap', 'capital-structure-fragility', 'narrative-drift', 'scale-mirage-risk'],
    rationale: 'vente vehicules sub-marge avec retour quasi-nul, stocks voitures plus entrepots, delisting et restructuration, tours successifs preferred preferences cumulees superieures a capitalisation finale',
  },
  {
    name: 'Peloton',
    assetClasses: ['ecommerce-dtc'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['fixed-cost-trap'],
    rationale: 'capex usine plus stocks plus payroll ingenierie face a demande divisee par 3 post-COVID',
  },
  {
    name: 'Helio',
    assetClasses: ['ecommerce-dtc'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['fixed-cost-trap'],
    rationale: 'infrastructure telecom fixe MVNO en perte 2008',
  },
  {
    name: 'Quirky',
    assetClasses: ['ecommerce-dtc', 'industrial-hardware'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['scale-mirage-risk'],
    rationale: 'industrialisait produits crowdsources sans validation, faillite 2015',
  },

  // fintech
  {
    name: 'Fast',
    assetClasses: ['fintech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'startup',
    axes: ['growth-subsidized', 'commoditization-drift', 'narrative-drift'],
    rationale: 'checkout startup brulant 10M par mois sans path, multiplication features sans rentabilite',
  },
  {
    name: 'FTX',
    assetClasses: ['fintech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['regulatory-time-bomb', 'narrative-drift'],
    rationale: 'operation crypto US sans qualification Securities Acts, substitution exchange par infrastructure',
  },
  {
    name: 'Celsius',
    assetClasses: ['fintech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['regulatory-time-bomb'],
    rationale: 'crypto lending sans agrement clair, intensification SEC effondrement domino 2022',
  },
  {
    name: 'Voyager',
    assetClasses: ['fintech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['regulatory-time-bomb'],
    rationale: 'crypto broker sans qualification Securities Acts, Chapter 11 2022',
  },
  {
    name: 'BlockFi',
    assetClasses: ['fintech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['regulatory-time-bomb'],
    rationale: 'crypto lending sous enquete SEC des 2021, faillite cascade post-FTX',
  },
  {
    name: 'Wirecard',
    assetClasses: ['fintech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['regulatory-time-bomb', 'narrative-drift', 'capital-structure-fragility'],
    rationale: '2020 fraude comptable plus defaillances regulatoires BaFin, audit defaillant',
  },
  {
    name: 'N26',
    assetClasses: ['fintech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'scaleup',
    axes: ['regulatory-time-bomb'],
    rationale: 'sanctionne BaFin 2021 plafond impose acquisition clients pendant deux ans pour KYC insuffisant',
  },
  {
    name: 'Klarna',
    assetClasses: ['fintech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['capital-structure-fragility', 'regulatory-time-bomb'],
    rationale: '2022 down round 46Md a 6Md active anti-dilution derniers entrants ramene fondateurs et early a residuel, BNPL sous pression reglementaire UE CCD2',
  },

  // ai-generative pole risque (wrappers LLM)
  {
    name: 'Jasper',
    assetClasses: ['ai-generative'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'startup',
    axes: ['infrastructure-hostage', 'commoditization-drift'],
    rationale: '2023 squeeze par OpenAI baisse prix 80% plus integration ChatGPT, pricing power erode',
  },
  {
    name: 'Copy.ai',
    assetClasses: ['ai-generative'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'startup',
    axes: ['infrastructure-hostage', 'commoditization-drift'],
    rationale: 'wrapper OpenAI sans differenciation metier, pricing power erode 2023',
  },
  {
    name: 'Replika',
    assetClasses: ['ai-generative'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'startup',
    axes: ['infrastructure-hostage'],
    rationale: '2023 policy changes OpenAI sur apps relations, impact direct produit',
  },

  // adtech / mediatech ATT / algorithmes
  {
    name: 'Snap Lens',
    assetClasses: ['mediatech', 'adtech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['infrastructure-hostage'],
    rationale: '2017 hardware dependance ecosysteme partenaires fragmente, division Lens abandonnee',
  },
  {
    name: 'Pinterest',
    assetClasses: ['mediatech', 'adtech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['infrastructure-hostage'],
    rationale: 'trafic divise par 2 par algorithme Google 2023',
  },

  // edtech / saas pole risque commoditization
  {
    name: 'Chegg',
    assetClasses: ['edtech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['commoditization-drift'],
    rationale: '2022-2024 valorisation effondree de 10Md a moins d un Md apres ChatGPT, solutions homework commoditisees',
  },
  {
    name: 'Stack Overflow',
    assetClasses: ['saas-b2b', 'mediatech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'mature',
    axes: ['commoditization-drift'],
    rationale: '2023-2025 trafic divise par deux apres GitHub Copilot et ChatGPT, Q&A developpeurs cannibalise',
  },

  // marketplace-b2c regulatory
  {
    name: 'Foodora',
    assetClasses: ['marketplace-b2c'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['regulatory-time-bomb'],
    rationale: '2018-2022 requalification livreurs en employes, restructurations en chaine, sortie marches',
  },

  // industrial-hardware pole risque (couverture etendue Britishvolt
  // Lilium et homologues, pour que les dossiers hardware aient une
  // ancre same-class sur l axe scale-mirage)
  {
    name: 'Northvolt',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['scale-mirage-risk', 'capital-structure-fragility', 'fixed-cost-trap'],
    rationale: 'novembre 2024 gigafactories europeennes Chapter 11 malgre 15Md leves cumule, retard rampe production',
  },
  {
    name: 'Britishvolt',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['scale-mirage-risk', 'fixed-cost-trap'],
    rationale: 'janvier 2023 plans gigafactory UK 3,8Md livres faillite sans avoir produit cellule, capex sans pre-commandes auto verrouillees',
  },
  {
    name: 'Lilium',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['scale-mirage-risk', 'capital-structure-fragility'],
    rationale: '2024 eVTOL allemand industrialise avant certification, levees successives diluees, restructuration',
  },
  {
    name: 'Faraday Future',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['scale-mirage-risk'],
    rationale: '9Md promis usine automobile, retards multi-anniversaires, defaillance',
  },
  {
    name: 'Magic Leap',
    assetClasses: ['industrial-hardware', 'deeptech'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'scaleup',
    axes: ['scale-mirage-risk', 'capital-structure-fragility'],
    rationale: '3,5Md leves hardware AR ventes en dessous de 1% projections, restructurations successives, preferences cumulees massives sur faible traction',
  },
  {
    name: 'Hyperloop One',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['scale-mirage-risk'],
    rationale: 'tubes test sans business model commercialise, liquidation fin 2023',
  },
  {
    name: 'Virgin Hyperloop',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['scale-mirage-risk'],
    rationale: 'pivot 2022 hyperloop passagers vers fret apres licenciement 50% des effectifs, liquidation fin 2023',
  },
  {
    name: 'Electric Last Mile',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['scale-mirage-risk'],
    rationale: 'usines vehicules demande non validee, Chapter 11 2022',
  },
  {
    name: 'Nikola',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    outcome: 'contested',
    stade: 'scaleup',
    axes: ['narrative-drift', 'scale-mirage-risk'],
    rationale: 'revendications techniques non etayees, video truquee camion, condamnation fraude fondateur',
  },
  {
    name: 'Ynsect',
    assetClasses: ['foodtech', 'industrial-hardware'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'mature',
    axes: ['scale-mirage-risk', 'capital-structure-fragility'],
    rationale: '2024 600M leves usine Amiens 372M demande B2B feed insuffisante, redressement judiciaire puis liquidation 2025',
  },
  {
    name: 'Juicero',
    assetClasses: ['ecommerce-dtc', 'industrial-hardware'],
    pole: 'risque',
    outcome: 'failure',
    stade: 'scaleup',
    axes: ['scale-mirage-risk', 'growth-subsidized'],
    rationale: '2017 fermeture, hardware presse 400 USD industrialise avant validation utilite produit, sachets pouvaient etre presses a la main',
  },
];

// ============================================================
// INVARIANTS RUNTIME
// ------------------------------------------------------------
// Garde au chargement du module : verifie la coherence outcome ->
// pole. Une donnee qui viole l invariant doit etre corrigee a la
// source, pas masquee. On lance une erreur explicite pour que la
// CI / les tests / le boot serveur la voient immediatement.
// ============================================================

(function assertRosterIntegrity() {
  const errors: string[] = [];
  for (const entry of ARCHETYPE_ROSTER) {
    const expectedPole = poleFromOutcome(entry.outcome);
    if (entry.pole !== expectedPole) {
      errors.push(
        `${entry.name} : pole=${entry.pole} mais outcome=${entry.outcome} implique pole=${expectedPole}. Corriger la donnee a la source.`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `ARCHETYPE_ROSTER : violation invariant outcome/pole sur ${errors.length} entree(s)\n  - ${errors.join('\n  - ')}`,
    );
  }
})();

// ============================================================
// SELECTION
// ============================================================

/**
 * Filtre les candidats du roster pour un asset_class, un pole et un
 * axe donnes. Si la classe contient au moins une entree valide, on
 * retourne les same-class. Sinon on retombe sur tous les archetypes
 * du pole pour cet axe, avec crossClass=true qui declenche la clause
 * obligatoire dans le rendu.
 *
 * Defense en profondeur : on filtre toujours par outcome derive du
 * pole demande. Une entree pole=saine avec outcome != success serait
 * deja une violation d invariant (verifiee au chargement), mais on
 * applique le filtre pour eviter qu un drift de donnees ne propage
 * un counter-exemple sain factice.
 */
export function selectArchetype(
  assetClass: string,
  pole: ArchetypePole,
  axis: ArchetypeAxis,
): ArchetypeSelection {
  const isValidForPole = (e: ArchetypeEntry) =>
    pole === 'saine' ? e.outcome === 'success' : e.outcome !== 'success';
  const sameClass = ARCHETYPE_ROSTER.filter((e) =>
    e.assetClasses.includes(assetClass)
    && e.pole === pole
    && isValidForPole(e)
    && e.axes.includes(axis),
  );
  if (sameClass.length > 0) {
    return { axis, pole, assetClass, candidates: sameClass, crossClass: false };
  }
  const crossClass = ARCHETYPE_ROSTER.filter((e) =>
    e.pole === pole && isValidForPole(e) && e.axes.includes(axis),
  );
  return { axis, pole, assetClass, candidates: crossClass, crossClass: true };
}

// ============================================================
// RENDU PROMPT
// ============================================================

/**
 * Libelle francais lisible de l axe, utilise dans la clause cross-class.
 */
export function getAxisLabel(axis: ArchetypeAxis): string {
  switch (axis) {
    case 'growth-subsidized': return 'unit economics et trajectoire de subvention';
    case 'infrastructure-hostage': return 'dependance d infrastructure critique';
    case 'fixed-cost-trap': return 'couts fixes incompressibles';
    case 'commoditization-drift': return 'erosion de defensibilite';
    case 'capital-structure-fragility': return 'fragilite cap table';
    case 'regulatory-time-bomb': return 'risque reglementaire date';
    case 'scale-mirage-risk': return 'industrialisation prematuree';
    case 'narrative-drift': return 'derive narrative';
  }
}

/**
 * Construit la clause obligatoire de cadrage cross-class. Doit etre
 * prefixee au rationale du counterArchetype quand le nom choisi est
 * cross-class. Voir decorateCounterArchetype.
 */
export function buildCrossClassClause(axis: ArchetypeAxis): string {
  return `Archetype cross-class : analogie comportementale sur ${getAxisLabel(axis)}, pas une comparaison sectorielle.`;
}

/**
 * Construit la clause obligatoire de cadrage cross-echelle. Prefixee
 * au rationale d un counterArchetype mature face a un dossier startup
 * (typiquement ASML, BYD, Stripe ou Adyen cite face a une seed pre-
 * revenue). Le LLM doit completer en nommant la dimension qui
 * justifie l analogie : pari disruptif, modele singulier, validation
 * long terme. Sans cette completion, le comparable doit etre retire,
 * pas affiche nu.
 */
export function buildScaleClause(axis: ArchetypeAxis): string {
  return `Comparable cross-echelle : ${getAxisLabel(axis)} citee sur un dossier early stage alors que le comparable est mature. L analogie ne tient que si on nomme la dimension qui la justifie (pari disruptif partage, modele singulier identifie, validation long terme du meme mecanisme). A defaut, retirer ce comparable au lieu de l afficher nu.`;
}

/**
 * Detecte si une entree du roster requiert le cadrage cross-echelle
 * face au stade du dossier. Regle : entry stade=mature face a un
 * dossier startup, OU entry stade=scaleup face a un dossier startup
 * tres precoce (seed pre-revenue).
 *
 * Le cas scaleup vs startup n est PAS cadre par defaut, car la
 * difference d echelle est limitee et l intuition d analogie reste
 * lisible. Seul l ecart mature vs startup declenche la clause.
 */
export function requiresScaleCadrage(
  entryStade: ArchetypeStade,
  dossierStade: DossierStade,
): boolean {
  if (dossierStade === 'startup' && entryStade === 'mature') return true;
  return false;
}

/**
 * Construit le bloc COUNTER-ARCHETYPES a injecter dans le SYSTEM_PROMPT
 * d un moteur. Remplace les listes prose codees en dur dans chaque
 * pattern. Le LLM doit choisir UNIQUEMENT parmi les noms listes ici.
 *
 * Le parametre dossierStade declenche la clause cross-echelle quand le
 * dossier est early stage et que des candidats matures sont presents.
 * Default 'startup' : c est le cas de la majorite des dossiers Prelude
 * et la position prudente. Un orchestrateur qui dispose du stade
 * extrait passe la valeur reelle.
 */
export function buildArchetypePromptBlock(
  axis: ArchetypeAxis,
  assetClass: string,
  dossierStade: DossierStade = 'startup',
): string {
  const risque = selectArchetype(assetClass, 'risque', axis);
  const saine = selectArchetype(assetClass, 'saine', axis);
  const axisLabel = getAxisLabel(axis);

  const fmt = (e: ArchetypeEntry) => {
    const scaleTag = requiresScaleCadrage(e.stade, dossierStade) ? ' [cross-echelle]' : '';
    return `${e.name}${scaleTag} (outcome ${e.outcome}, ${e.rationale})`;
  };

  const risqueLine = risque.candidates.length > 0
    ? `Patterns confirmes ${risque.crossClass ? 'cross-class' : 'meme asset class'} : ${risque.candidates.map(fmt).join(' ; ')}.`
    : 'Aucun pattern confirme disponible pour cet axe et cette classe.';

  const saineLine = saine.candidates.length > 0
    ? `Counter-archetypes sains ${saine.crossClass ? 'cross-class' : 'meme asset class'} : ${saine.candidates.map(fmt).join(' ; ')}.`
    : 'Aucun counter-archetype sain disponible pour cet axe et cette classe.';

  const crossClassClause = (risque.crossClass || saine.crossClass)
    ? `\n\nCONTRAINTE CROSS-CLASS. Si le nom que tu choisis est marque cross-class ci-dessus, ta rationale du champ counterArchetype DOIT s ouvrir EXACTEMENT par cette phrase : "${buildCrossClassClause(axis)}" Aucun nom hors-classe ne doit apparaitre nu, sans cette clause prefixee. Le moteur post-traite et rejette les rationales non conformes.`
    : '';

  const anyCrossScale = [...risque.candidates, ...saine.candidates]
    .some((e) => requiresScaleCadrage(e.stade, dossierStade));
  const crossScaleClause = anyCrossScale
    ? `\n\nCONTRAINTE CROSS-ECHELLE. Si le nom que tu choisis est marque [cross-echelle] ci-dessus, ta rationale du champ counterArchetype DOIT s ouvrir EXACTEMENT par cette phrase : "${buildScaleClause(axis)}" et tu DOIS nommer la dimension qui tient l analogie (pari disruptif, modele singulier, validation long terme). Si tu ne peux pas nommer la dimension, choisis un autre archetype same-echelle ou retire le comparable.`
    : '';

  return `# COUNTER-ARCHETYPES (selecteur gate par asset_class : ${assetClass}, stade dossier : ${dossierStade})

Tu DOIS choisir l archetype le plus proche UNIQUEMENT parmi les noms listes ci-dessous. Toute autre boite, meme celebre, a ete ecartee par le selecteur central parce qu elle ne correspond pas a l asset class du dossier ou a l axe d analyse. L outcome (success / failure / ongoing / contested) est verifie a la source : une boite outcome != success ne peut JAMAIS apparaitre en counter-archetype sain.

${risqueLine}

${saineLine}${crossClassClause}${crossScaleClause}

Tu nommes UN archetype proche dans counterArchetype.closest, tu poses sa direction ("derive-confirmee" si pole risque, "trajectoire-saine" si pole saine), et tu expliques en deux phrases pourquoi ce dossier s en rapproche sur l axe ${axisLabel}, en citant un signal concret du dossier.`;
}

// ============================================================
// POST-PROCESSING
// ============================================================

/**
 * Sortie standardisee partagee entre tous les moteurs (sept patterns
 * Fragilite Structurelle et Narrative Drift). Le champ direction
 * accepte les deux variantes editoriales presentes dans la base de
 * code historique.
 */
export interface CounterArchetypeOutput {
  closest: string;
  direction: 'derive-confirmee' | 'trajectoire-saine' | 'non determine';
  rationale: string;
}

/**
 * Garantit que le rendu final respecte les deux clauses obligatoires
 * (cross-class, cross-echelle) et la regle de derivation outcome ->
 * pole.
 *
 * Comportement :
 *   1. Si le nom n est pas dans le roster, on remonte
 *      crossClass=false, crossScale=false ET on remplit unknownEntry=
 *      true. C est au consommateur aval de logger ou de rejeter.
 *   2. Si l entree est trouvee mais que sa direction declaree
 *      ('trajectoire-saine' vs 'derive-confirmee') ne correspond pas
 *      a son outcome reel (saine impose outcome=success), on force
 *      direction='non determine' et on marque outcomeMismatch=true.
 *      C est la garantie qu une boite outcome != success ne sera
 *      jamais affichee en counter-exemple sain.
 *   3. La clause cross-class est prefixee si necessaire.
 *   4. La clause cross-echelle est prefixee en plus si necessaire,
 *      AVANT la clause cross-class pour preserver l ordre echelle ->
 *      classe (de l ecart le plus visible au plus subtil).
 *
 * Les drapeaux crossClass / crossScale / outcomeMismatch / unknownEntry
 * remontent aux consommateurs aval (note d instruction, UI dashboard)
 * pour qu ils puissent decider d afficher un badge ou de retirer le
 * comparable.
 */
export function decorateCounterArchetype(
  counterArchetype: CounterArchetypeOutput,
  axis: ArchetypeAxis,
  dossierAssetClass: string,
  dossierStade: DossierStade = 'startup',
): CounterArchetypeOutput & {
  crossClass: boolean;
  crossScale: boolean;
  outcomeMismatch: boolean;
  unknownEntry: boolean;
} {
  const entry = ARCHETYPE_ROSTER.find((e) => e.name === counterArchetype.closest);
  if (!entry) {
    return {
      ...counterArchetype,
      crossClass: false,
      crossScale: false,
      outcomeMismatch: false,
      unknownEntry: true,
    };
  }

  const isCrossClass = !entry.assetClasses.includes(dossierAssetClass);
  const isCrossScale = requiresScaleCadrage(entry.stade, dossierStade);

  // Coherence direction vs outcome. Un LLM peut ranger Klarna en
  // trajectoire-saine si la prose le confond ; on rebascule sur la
  // direction qui correspond reellement a l outcome verifie. Une
  // boite outcome != success ne peut jamais sortir en trajectoire-
  // saine. Une boite outcome = success ne peut jamais sortir en
  // derive-confirmee.
  const directionImpliesSaine = counterArchetype.direction === 'trajectoire-saine';
  const directionImpliesRisque = counterArchetype.direction === 'derive-confirmee';
  const outcomeMismatch =
    (directionImpliesSaine && entry.outcome !== 'success')
    || (directionImpliesRisque && entry.outcome === 'success');

  let rationale = (counterArchetype.rationale || '').trim();
  let direction = counterArchetype.direction;
  if (outcomeMismatch) {
    const correctedDirection: CounterArchetypeOutput['direction'] =
      entry.outcome === 'success' ? 'trajectoire-saine' : 'derive-confirmee';
    direction = correctedDirection;
    rationale = `Coherence outcome verifiee : ${entry.name} a un outcome ${entry.outcome}, direction reclassee en ${correctedDirection}. ${rationale}`.trim();
  }

  if (isCrossClass) {
    const clause = buildCrossClassClause(axis);
    const alreadyClass = rationale.startsWith('Archetype cross-class')
      || rationale.startsWith('Archétype cross-class');
    if (!alreadyClass) {
      rationale = `${clause} ${rationale}`.trim();
    }
  }

  if (isCrossScale) {
    const clause = buildScaleClause(axis);
    const alreadyScale = rationale.startsWith('Comparable cross-echelle')
      || rationale.startsWith('Comparable cross-échelle');
    if (!alreadyScale) {
      rationale = `${clause} ${rationale}`.trim();
    }
  }

  return {
    ...counterArchetype,
    direction,
    rationale,
    crossClass: isCrossClass,
    crossScale: isCrossScale,
    outcomeMismatch,
    unknownEntry: false,
  };
}
