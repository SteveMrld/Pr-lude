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
// REGLE. selectArchetype filtre same asset_class d abord. Si la
// classe ne contient aucun archetype du pole demande pour l axe,
// fallback cross-class avec crossClass=true. Le rendu impose alors
// une clause obligatoire qui cadre l analogie comme comportementale
// sur l axe et non sectorielle.
//
// COMPLETUDE DOCTRINALE. Le roster couvre les principaux asset
// classes normalises par lib/data/sector-benchmarks.ts. Le pole
// saine pour industrial-hardware et climate-tech a ete complete
// (ASML, BYD, Rivian, Apple supply chain, Innovafeed, Orsted,
// Iberdrola, Enphase, Nvidia) pour que les dossiers hardware
// n aient plus de raison de retomber cross-class sur des references
// SaaS. Tesla et Beyond Meat sont volontairement absents du pole
// saine : leur trajectoire post-2018 et post-2022 respectivement
// rend leur citation en counter-archetype sain doctrinalement
// indefendable. Le pole risque pour ces classes inclut Northvolt,
// Britishvolt, Lilium, Faraday, Magic Leap, Hyperloop, Electric
// Last Mile, Quirky, Nikola, Ynsect.
// ============================================================

// ============================================================
// TYPES
// ============================================================

/**
 * Pole d un archetype : trajectoire saine (counter-exemple a citer
 * pour calibrer le dossier vers le haut) ou trajectoire risque
 * (pattern confirme dont la trajectoire connue eclaire le diagnostic
 * negatif).
 */
export type ArchetypePole = 'saine' | 'risque';

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
  /** Pole structurel de l entree. */
  pole: ArchetypePole;
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
  // POLE SAINE
  // ----------------------------------------------------------

  // saas-b2b
  {
    name: 'Atlassian',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['growth-subsidized', 'narrative-drift', 'capital-structure-fragility'],
    rationale: 'gross margin >= 80%, CAC efficient, IPO 2015 common dominant, sobriete narrative durable',
  },
  {
    name: 'Datadog',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['growth-subsidized', 'infrastructure-hostage', 'commoditization-drift', 'narrative-drift', 'capital-structure-fragility'],
    rationale: 'unit economics SaaS classique, contribution margin saine, +500 integrations qui protegent de la captivite, structure cap table simple',
  },
  {
    name: 'Snowflake',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['infrastructure-hostage', 'narrative-drift', 'capital-structure-fragility', 'growth-subsidized'],
    rationale: 'architecture multi-cloud par construction, bascule AWS Azure GCP au niveau compte client, rigueur S-1 reference, net retention 165%',
  },
  {
    name: 'Salesforce',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['infrastructure-hostage', 'commoditization-drift', 'fixed-cost-trap'],
    rationale: 'infras propres construites sur plusieurs decennies multi-cloud, ecosysteme partenaires verrouille, engagements data center alignes sur contrats clients long terme',
  },
  {
    name: 'GitLab',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['infrastructure-hostage'],
    rationale: 'portable on-premise par construction deployable chez le client',
  },
  {
    name: 'HubSpot',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['narrative-drift'],
    rationale: 'changement de KPIs justifie strategiquement, communication financiere stable',
  },
  {
    name: 'Clio',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['commoditization-drift'],
    rationale: 'SaaS legal vertical, switching cost workflow cabinet d avocats',
  },
  {
    name: 'Toast',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['commoditization-drift'],
    rationale: 'SaaS restauration vertical, hardware integre, switching cost POS',
  },
  {
    name: 'Procore',
    assetClasses: ['saas-b2b'],
    pole: 'saine',
    axes: ['commoditization-drift'],
    rationale: 'SaaS construction vertical, expansion reseau chantiers',
  },

  // fintech (multi-class avec saas-b2b pour Stripe et Adyen, dont le
  // profil narratif est exemplaire pour les deux classes)
  {
    name: 'Stripe',
    assetClasses: ['fintech', 'saas-b2b'],
    pole: 'saine',
    axes: ['growth-subsidized', 'infrastructure-hostage', 'capital-structure-fragility', 'regulatory-time-bomb', 'commoditization-drift', 'narrative-drift'],
    rationale: 'ratio LTV/CAC eleve avec switching cost API integree, plus de cinq processeurs en parallele, structure preferred 1x non participating, agrement etablissement de paiement obtenu en anticipation PSD2 des 2017, precision systematique meme en parlant de mission',
  },
  {
    name: 'Adyen',
    assetClasses: ['fintech', 'saas-b2b'],
    pole: 'saine',
    axes: ['growth-subsidized', 'infrastructure-hostage', 'capital-structure-fragility', 'regulatory-time-bomb', 'commoditization-drift', 'narrative-drift'],
    rationale: 'commission paiement avec marge transparente et stable, licences bancaires europeennes propres operant ses propres rails, IPO 2018 structure tres propre, agrement etablissement paiement obtenu en propre des 2010, constance financiere',
  },
  {
    name: 'Plaid',
    assetClasses: ['fintech'],
    pole: 'saine',
    axes: ['regulatory-time-bomb'],
    rationale: 'anticipation open banking US et Europe via partenariats banques avant l obligation reglementaire',
  },
  {
    name: 'Bloomberg',
    assetClasses: ['fintech', 'mediatech'],
    pole: 'saine',
    axes: ['commoditization-drift'],
    rationale: 'donnees proprietaires plus community plus workflows trading plus hardware terminal, cumul de quatre moats',
  },

  // ai-generative
  {
    name: 'Anthropic',
    assetClasses: ['ai-generative'],
    pole: 'saine',
    axes: ['infrastructure-hostage', 'regulatory-time-bomb'],
    rationale: 'depend de Nvidia mais avec contrats long-terme et plans TPU AMD silicon proprietaire, lab safety policy publique et dialogues continus avec AI Office europeen',
  },
  {
    name: 'Mistral',
    assetClasses: ['ai-generative'],
    pole: 'saine',
    axes: ['capital-structure-fragility'],
    rationale: 'tours rapides valorisation tres elevee structure preferred 1x non participating preservee fondateurs',
  },

  // marketplace-b2c / hospitality
  {
    name: 'Booking',
    assetClasses: ['marketplace-b2c', 'hospitality'],
    pole: 'saine',
    axes: ['growth-subsidized', 'fixed-cost-trap', 'commoditization-drift'],
    rationale: 'commission only pas de stock hotelier, marketplace asset-light avec marges stables',
  },
  {
    name: 'Airbnb',
    assetClasses: ['marketplace-b2c', 'hospitality'],
    pole: 'saine',
    axes: ['fixed-cost-trap', 'commoditization-drift', 'regulatory-time-bomb'],
    rationale: 'asset-light explicitement sans propriete immobiliere ni stock, post-2018 transition compliance ville par ville et accords municipalites',
  },
  {
    name: 'Uber',
    assetClasses: ['marketplace-b2c'],
    pole: 'saine',
    axes: ['fixed-cost-trap'],
    rationale: 'post-2019 reduction massive couts fixes via automation et fermeture marches non rentables',
  },
  {
    name: 'Doctolib',
    assetClasses: ['healthtech', 'saas-b2b'],
    pole: 'saine',
    axes: ['commoditization-drift'],
    rationale: 'SaaS sante multi-pays, switching cost praticien et agenda patient',
  },

  // mediatech
  {
    name: 'Spotify',
    assetClasses: ['mediatech'],
    pole: 'saine',
    axes: ['growth-subsidized', 'commoditization-drift', 'fixed-cost-trap'],
    rationale: 'streaming avec marges streaming >= 25% et croissantes, engagements minimum garantis labels qui scalent avec revenu',
  },
  {
    name: 'Netflix',
    assetClasses: ['mediatech'],
    pole: 'saine',
    axes: ['fixed-cost-trap'],
    rationale: 'engagements production massifs avec ROI mesure et flexibilite cancellation, amortissement par marche',
  },
  {
    name: 'Schibsted',
    assetClasses: ['mediatech'],
    pole: 'saine',
    axes: ['commoditization-drift'],
    rationale: 'mediatech defensible par marketplaces verticales matures',
  },

  // industrial-hardware (pole saine elargi pour AIRARO et homologues)
  {
    name: 'ASML',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    axes: ['scale-mirage-risk', 'fixed-cost-trap', 'capital-structure-fragility', 'commoditization-drift'],
    rationale: 'capex industriel systematiquement lie a contrats long terme foundries TSMC Samsung Intel, demande precede capacite, monopole structurel lithographie EUV',
  },
  {
    name: 'BYD',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    axes: ['scale-mirage-risk', 'growth-subsidized', 'capital-structure-fragility'],
    rationale: 'extension industrielle Chine au rythme demande validee, financement par cash flow operationnel sur quinze ans, integration verticale batterie et vehicule',
  },
  {
    name: 'Rivian',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    axes: ['scale-mirage-risk'],
    rationale: 'capex usine Normal Illinois adosse a contrat ancrage Amazon 100000 vehicules en filet, evite trajectoire Britishvolt',
  },
  {
    name: 'Apple supply chain',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    axes: ['scale-mirage-risk', 'fixed-cost-trap'],
    rationale: 'capex Foxconn calibre demande mesuree iPhone, ajustement trimestriel, modele asset-light en aval',
  },
  {
    name: 'Innovafeed',
    assetClasses: ['industrial-hardware', 'foodtech'],
    pole: 'saine',
    axes: ['scale-mirage-risk', 'growth-subsidized'],
    rationale: 'contrats ADM offtake securises capacite ancree dans demande contractee, contraste explicite avec Ynsect',
  },
  {
    name: 'Orsted',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'saine',
    axes: ['scale-mirage-risk', 'fixed-cost-trap', 'capital-structure-fragility'],
    rationale: 'pivot offshore wind execute avec discipline capital, capex absorbe par PPA long terme et concessions',
  },
  {
    name: 'Iberdrola',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'saine',
    axes: ['fixed-cost-trap', 'capital-structure-fragility'],
    rationale: 'infrastructure energetique scale durable, dette projet adossee aux flux concession',
  },
  {
    name: 'Enphase Energy',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'saine',
    axes: ['scale-mirage-risk', 'growth-subsidized'],
    rationale: 'microinverter scale-up profitable, unit economics positives sur hardware distribue, marge brute robuste',
  },
  {
    name: 'Nvidia',
    assetClasses: ['industrial-hardware'],
    pole: 'saine',
    axes: ['narrative-drift'],
    rationale: 'technique au coeur de toute communication, sobriete narrative meme en croissance exponentielle',
  },

  // climate-tech / foodtech additionnels
  {
    name: 'Amazon',
    assetClasses: ['marketplace-b2c', 'mediatech'],
    pole: 'saine',
    axes: ['narrative-drift'],
    rationale: 'discours historiquement concret centre sur operations et customer obsession',
  },

  // ----------------------------------------------------------
  // POLE RISQUE
  // ----------------------------------------------------------

  // proptech
  {
    name: 'WeWork',
    assetClasses: ['proptech'],
    pole: 'risque',
    axes: ['growth-subsidized', 'fixed-cost-trap', 'capital-structure-fragility', 'narrative-drift', 'scale-mirage-risk'],
    rationale: 'locations sub-pricees vs cout reel, 47Md engagements pour 1,8Md revenu run-rate, SoftBank preferences cumulees plus seniority plus super voting fondateur incompatible IPO sous 47Md, passage real estate puis community puis consciousness',
  },
  {
    name: 'Compass',
    assetClasses: ['proptech'],
    pole: 'risque',
    axes: ['fixed-cost-trap', 'capital-structure-fragility'],
    rationale: '4500 agents en salarie direct face cycle immobilier residentiel, recaps successifs wash-down common',
  },

  // healthtech
  {
    name: 'Theranos',
    assetClasses: ['healthtech'],
    pole: 'risque',
    axes: ['regulatory-time-bomb', 'narrative-drift', 'scale-mirage-risk', 'capital-structure-fragility'],
    rationale: 'claims marketing depassant approbations FDA, refus structure de chiffres, moralisation extreme, hardware Edison deploye en pharmacie sans validation FDA, tours successifs preferences senior participation multiple sur valorisations eloignees fondamentaux',
  },

  // mediatech
  {
    name: 'MoviePass',
    assetClasses: ['mediatech'],
    pole: 'risque',
    axes: ['growth-subsidized', 'infrastructure-hostage', 'fixed-cost-trap'],
    rationale: 'places de cinema vendues sous le prix d achat structurel, dependance prix exhibitors',
  },
  {
    name: 'Quibi',
    assetClasses: ['mediatech'],
    pole: 'risque',
    axes: ['growth-subsidized', 'fixed-cost-trap', 'capital-structure-fragility', 'narrative-drift'],
    rationale: '1,75Md engagements contenus sans business model viable, substitution video platform par content revolution, 1,75Md preferences senior si fortes que common ne pouvaient recuperer rien sauf exit > 5Md',
  },
  {
    name: 'Zynga',
    assetClasses: ['mediatech'],
    pole: 'risque',
    axes: ['infrastructure-hostage'],
    rationale: 'avant 2014 captive de Facebook viralite',
  },
  {
    name: 'AOL',
    assetClasses: ['mediatech'],
    pole: 'risque',
    axes: ['fixed-cost-trap'],
    rationale: 'post-2002 data centers et personnel infrastructure dial-up obsolete face transition broadband',
  },

  // ecommerce-dtc
  {
    name: 'Casper',
    assetClasses: ['ecommerce-dtc'],
    pole: 'risque',
    axes: ['growth-subsidized', 'fixed-cost-trap'],
    rationale: 'DTC matelas, contribution margin negative documentee jusqu a la depreciation post-IPO 2020',
  },
  {
    name: 'Cazoo',
    assetClasses: ['ecommerce-dtc'],
    pole: 'risque',
    axes: ['growth-subsidized', 'fixed-cost-trap', 'capital-structure-fragility', 'narrative-drift', 'scale-mirage-risk'],
    rationale: 'vente vehicules sub-marge avec retour quasi-nul, stocks voitures plus entrepots, delisting et restructuration, tours successifs preferred preferences cumulees superieures a capitalisation finale',
  },
  {
    name: 'Peloton',
    assetClasses: ['ecommerce-dtc'],
    pole: 'risque',
    axes: ['fixed-cost-trap'],
    rationale: 'capex usine plus stocks plus payroll ingenierie face a demande divisee par 3 post-COVID',
  },
  {
    name: 'Helio',
    assetClasses: ['ecommerce-dtc'],
    pole: 'risque',
    axes: ['fixed-cost-trap'],
    rationale: 'infrastructure telecom fixe MVNO en perte 2008',
  },
  {
    name: 'Quirky',
    assetClasses: ['ecommerce-dtc', 'industrial-hardware'],
    pole: 'risque',
    axes: ['scale-mirage-risk'],
    rationale: 'industrialisait produits crowdsources sans validation, faillite 2015',
  },

  // fintech
  {
    name: 'Fast',
    assetClasses: ['fintech'],
    pole: 'risque',
    axes: ['growth-subsidized', 'commoditization-drift', 'narrative-drift'],
    rationale: 'checkout startup brulant 10M par mois sans path, multiplication features sans rentabilite',
  },
  {
    name: 'FTX',
    assetClasses: ['fintech'],
    pole: 'risque',
    axes: ['regulatory-time-bomb', 'narrative-drift'],
    rationale: 'operation crypto US sans qualification Securities Acts, substitution exchange par infrastructure',
  },
  {
    name: 'Celsius',
    assetClasses: ['fintech'],
    pole: 'risque',
    axes: ['regulatory-time-bomb'],
    rationale: 'crypto lending sans agrement clair, intensification SEC effondrement domino 2022',
  },
  {
    name: 'Voyager',
    assetClasses: ['fintech'],
    pole: 'risque',
    axes: ['regulatory-time-bomb'],
    rationale: 'crypto broker sans qualification Securities Acts, Chapter 11 2022',
  },
  {
    name: 'BlockFi',
    assetClasses: ['fintech'],
    pole: 'risque',
    axes: ['regulatory-time-bomb'],
    rationale: 'crypto lending sous enquete SEC des 2021, faillite cascade post-FTX',
  },
  {
    name: 'Wirecard',
    assetClasses: ['fintech'],
    pole: 'risque',
    axes: ['regulatory-time-bomb', 'narrative-drift', 'capital-structure-fragility'],
    rationale: '2020 fraude comptable plus defaillances regulatoires BaFin, audit defaillant',
  },
  {
    name: 'N26',
    assetClasses: ['fintech'],
    pole: 'risque',
    axes: ['regulatory-time-bomb'],
    rationale: 'sanctionne BaFin 2021 plafond impose acquisition clients pendant deux ans pour KYC insuffisant',
  },
  {
    name: 'Klarna',
    assetClasses: ['fintech'],
    pole: 'risque',
    axes: ['capital-structure-fragility', 'regulatory-time-bomb'],
    rationale: '2022 down round 46Md a 6Md active anti-dilution derniers entrants ramene fondateurs et early a residuel, BNPL sous pression reglementaire UE CCD2',
  },

  // ai-generative pole risque (wrappers LLM)
  {
    name: 'Jasper',
    assetClasses: ['ai-generative'],
    pole: 'risque',
    axes: ['infrastructure-hostage', 'commoditization-drift'],
    rationale: '2023 squeeze par OpenAI baisse prix 80% plus integration ChatGPT, pricing power erode',
  },
  {
    name: 'Copy.ai',
    assetClasses: ['ai-generative'],
    pole: 'risque',
    axes: ['infrastructure-hostage', 'commoditization-drift'],
    rationale: 'wrapper OpenAI sans differenciation metier, pricing power erode 2023',
  },
  {
    name: 'Replika',
    assetClasses: ['ai-generative'],
    pole: 'risque',
    axes: ['infrastructure-hostage'],
    rationale: '2023 policy changes OpenAI sur apps relations, impact direct produit',
  },

  // adtech / mediatech ATT / algorithmes
  {
    name: 'Snap Lens',
    assetClasses: ['mediatech', 'adtech'],
    pole: 'risque',
    axes: ['infrastructure-hostage'],
    rationale: '2017 hardware dependance ecosysteme partenaires fragmente',
  },
  {
    name: 'Pinterest',
    assetClasses: ['mediatech', 'adtech'],
    pole: 'risque',
    axes: ['infrastructure-hostage'],
    rationale: 'trafic divise par 2 par algorithme Google 2023',
  },

  // edtech / saas pole risque commoditization
  {
    name: 'Chegg',
    assetClasses: ['edtech'],
    pole: 'risque',
    axes: ['commoditization-drift'],
    rationale: '2022-2024 valorisation effondree de 10Md a moins d un Md apres ChatGPT, solutions homework commoditisees',
  },
  {
    name: 'Stack Overflow',
    assetClasses: ['saas-b2b', 'mediatech'],
    pole: 'risque',
    axes: ['commoditization-drift'],
    rationale: '2023-2025 trafic divise par deux apres GitHub Copilot et ChatGPT, Q&A developpeurs cannibalise',
  },

  // marketplace-b2c regulatory
  {
    name: 'Foodora',
    assetClasses: ['marketplace-b2c'],
    pole: 'risque',
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
    axes: ['scale-mirage-risk', 'capital-structure-fragility', 'fixed-cost-trap'],
    rationale: 'novembre 2024 gigafactories europeennes Chapter 11 malgre 15Md leves cumule, retard rampe production',
  },
  {
    name: 'Britishvolt',
    assetClasses: ['industrial-hardware', 'climate-tech'],
    pole: 'risque',
    axes: ['scale-mirage-risk', 'fixed-cost-trap'],
    rationale: 'janvier 2023 plans gigafactory UK 3,8Md livres faillite sans avoir produit cellule, capex sans pre-commandes auto verrouillees',
  },
  {
    name: 'Lilium',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    axes: ['scale-mirage-risk', 'capital-structure-fragility'],
    rationale: '2024 eVTOL allemand industrialise avant certification, levees successives diluees, restructuration',
  },
  {
    name: 'Faraday Future',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    axes: ['scale-mirage-risk'],
    rationale: '9Md promis usine automobile, retards multi-anniversaires, defaillance',
  },
  {
    name: 'Magic Leap',
    assetClasses: ['industrial-hardware', 'deeptech'],
    pole: 'risque',
    axes: ['scale-mirage-risk', 'capital-structure-fragility'],
    rationale: '3,5Md leves hardware AR ventes en dessous de 1% projections, restructurations successives, preferences cumulees massives sur faible traction',
  },
  {
    name: 'Hyperloop One',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    axes: ['scale-mirage-risk'],
    rationale: 'tubes test sans business model commercialise, fermeture 2023',
  },
  {
    name: 'Electric Last Mile',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    axes: ['scale-mirage-risk'],
    rationale: 'usines vehicules demande non validee, Chapter 11 2022',
  },
  {
    name: 'Nikola',
    assetClasses: ['industrial-hardware'],
    pole: 'risque',
    axes: ['narrative-drift', 'scale-mirage-risk'],
    rationale: 'revendications techniques non etayees, video truquee camion',
  },
  {
    name: 'Ynsect',
    assetClasses: ['foodtech', 'industrial-hardware'],
    pole: 'risque',
    axes: ['scale-mirage-risk', 'capital-structure-fragility'],
    rationale: '2024 600M leves usine Amiens 372M demande B2B feed insuffisante, redressement judiciaire',
  },
];

// ============================================================
// SELECTION
// ============================================================

/**
 * Filtre les candidats du roster pour un asset_class, un pole et un
 * axe donnes. Si la classe contient au moins une entree valide, on
 * retourne les same-class. Sinon on retombe sur tous les archetypes
 * du pole pour cet axe, avec crossClass=true qui declenche la clause
 * obligatoire dans le rendu.
 */
export function selectArchetype(
  assetClass: string,
  pole: ArchetypePole,
  axis: ArchetypeAxis,
): ArchetypeSelection {
  const sameClass = ARCHETYPE_ROSTER.filter((e) =>
    e.assetClasses.includes(assetClass)
    && e.pole === pole
    && e.axes.includes(axis),
  );
  if (sameClass.length > 0) {
    return { axis, pole, assetClass, candidates: sameClass, crossClass: false };
  }
  const crossClass = ARCHETYPE_ROSTER.filter((e) =>
    e.pole === pole && e.axes.includes(axis),
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
 * Construit le bloc COUNTER-ARCHETYPES a injecter dans le SYSTEM_PROMPT
 * d un moteur. Remplace les listes prose codees en dur dans chaque
 * pattern. Le LLM doit choisir UNIQUEMENT parmi les noms listes ici.
 */
export function buildArchetypePromptBlock(
  axis: ArchetypeAxis,
  assetClass: string,
): string {
  const risque = selectArchetype(assetClass, 'risque', axis);
  const saine = selectArchetype(assetClass, 'saine', axis);
  const axisLabel = getAxisLabel(axis);

  const fmt = (e: ArchetypeEntry) => `${e.name} (${e.rationale})`;

  const risqueLine = risque.candidates.length > 0
    ? `Patterns confirmes ${risque.crossClass ? 'cross-class' : 'meme asset class'} : ${risque.candidates.map(fmt).join(' ; ')}.`
    : 'Aucun pattern confirme disponible pour cet axe et cette classe.';

  const saineLine = saine.candidates.length > 0
    ? `Counter-archetypes sains ${saine.crossClass ? 'cross-class' : 'meme asset class'} : ${saine.candidates.map(fmt).join(' ; ')}.`
    : 'Aucun counter-archetype sain disponible pour cet axe et cette classe.';

  const crossClause = (risque.crossClass || saine.crossClass)
    ? `\n\nCONTRAINTE CROSS-CLASS. Si le nom que tu choisis est marque cross-class ci-dessus, ta rationale du champ counterArchetype DOIT s ouvrir EXACTEMENT par cette phrase : "${buildCrossClassClause(axis)}" Aucun nom hors-classe ne doit apparaitre nu, sans cette clause prefixee. Le moteur post-traite et rejette les rationales non conformes.`
    : '';

  return `# COUNTER-ARCHETYPES (selecteur gate par asset_class : ${assetClass})

Tu DOIS choisir l archetype le plus proche UNIQUEMENT parmi les noms listes ci-dessous. Toute autre boite, meme celebre, a ete ecartee par le selecteur central parce qu elle ne correspond pas a l asset class du dossier ou a l axe d analyse.

${risqueLine}

${saineLine}${crossClause}

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
 * Garantit que le rendu final respecte la clause cross-class. Si le
 * LLM a choisi un nom du roster qui ne partage pas l asset_class du
 * dossier, on prefixe la clause au rationale (sauf si elle est deja
 * presente). Si le nom n est pas dans le roster, on laisse passer sans
 * decoration : ce cas remonte un warning structurel ailleurs.
 *
 * Le drapeau crossClass renvoye permet aux consommateurs aval (note
 * d instruction, UI dashboard) de matter le badge correspondant si
 * besoin.
 */
export function decorateCounterArchetype(
  counterArchetype: CounterArchetypeOutput,
  axis: ArchetypeAxis,
  dossierAssetClass: string,
): CounterArchetypeOutput & { crossClass: boolean } {
  const entry = ARCHETYPE_ROSTER.find((e) => e.name === counterArchetype.closest);
  if (!entry) {
    return { ...counterArchetype, crossClass: false };
  }
  const isCross = !entry.assetClasses.includes(dossierAssetClass);
  if (!isCross) {
    return { ...counterArchetype, crossClass: false };
  }
  const clause = buildCrossClassClause(axis);
  const trimmed = (counterArchetype.rationale || '').trim();
  const already = trimmed.startsWith('Archetype cross-class')
    || trimmed.startsWith('Archétype cross-class');
  const rationale = already
    ? counterArchetype.rationale
    : `${clause} ${trimmed}`.trim();
  return { ...counterArchetype, rationale, crossClass: true };
}
