// ============================================================
// RELEVANCE MATRIX - Service de pertinence des moteurs
// ------------------------------------------------------------
// Calcule huit criteres structurels du dossier (asset class, modele
// business, chaine de production, expositions supply chain / macro
// / geopolitique, reproductibilite numerique, funnel d acquisition)
// puis derive un verdict de pertinence par moteur ou sous-bloc.
//
// Calcul deterministe sans appel LLM. Les detecteurs raisonnent
// par briques structurelles (composants critiques, dependances
// geographiques, soumission a regulations, intensite physique du
// produit) et non par liste fermee d exemples sectoriels. La
// voiture connectee est une instance d un schema d exposition
// semi-conducteurs, pas un cas particulier hard-code.
//
// Consommation. Chaque moteur Bloc 1 lit le verdict qui le concerne
// et adapte son comportement : full = produit son output normal,
// partial = scope sa reponse aux composantes pertinentes, none =
// se declare non applicable avec un rationnel structurel.
//
// La matrice est aussi serialisee dans le resultJson pour
// alimenter l encart "perimetre d analyse" de la note d
// investissement, qui rend transparent au partner quels moteurs
// ont ete actives ou desactives, et pourquoi.
// ============================================================

import type { ExtractionOutput } from './types';
import { normalizeFrText } from '../data/text-normalize';
import { normalizeAssetClass } from '../data/sector-benchmarks';

// ============================================================
// TYPES
// ============================================================

/**
 * Modele economique structurel du dossier. Determine quelles
 * familles d indicateurs sont applicables (SaaS classique vs
 * fabrication unitaire vs projet long).
 */
export type BusinessModel =
  | 'recurrent-saas'        // abonnement B2B SaaS, ARR, churn, expansion
  | 'consumer-subscription' // abonnement B2C (streaming, fitness app, news)
  | 'unitary-sale'          // fabrication-vente d unites distinctes (Platypus, drones)
  | 'project-based'         // contrats par projet, SPV, cycle long (AIRARO, infrastructures)
  | 'service-on-demand'     // services a l acte (consulting, agence, freelance)
  | 'marketplace'           // plateforme transactionnelle (commissions sur GMV)
  | 'contract-b2g'          // contrats avec etat ou semi-public (defense, sante publique)
  | 'hybrid'                // combinaison non triviale
  | 'unknown';

/**
 * Nature de la chaine de production. Critere central pour la
 * reproductibilite numerique et l applicabilite des metriques SaaS.
 */
export type ProductionChain =
  | 'pure-software'           // SaaS, app mobile, plateforme web
  | 'hardware-physical'       // fabrication d objets physiques
  | 'infrastructure-physical' // genie civil, energie, telecom physique
  | 'wet-biotech'             // medicaments, dispositifs medicaux, biologie experimentale
  | 'content-media'           // production de contenu, edition, streaming
  | 'regulated-service'       // services a forte barriere reglementaire (sante, banque, conseil financier)
  | 'unknown';

/** Niveau d exposition standardise sur une echelle low / medium / high. */
export type ExposureLevel = 'low' | 'medium' | 'high';

/**
 * Etat du funnel d acquisition mesurable. Determine si Payback CAC
 * et metriques de conversion sont applicables.
 */
export type AcquisitionFunnel =
  | 'present'         // acquisition payante mesurable, CAC marketing classique
  | 'b2b-sales-led'   // cycle long account-based, pas de CAC marketing standard
  | 'absent'          // pas d acquisition mesurable (B2G appels d offre, projets uniques)
  | 'unknown';

/**
 * Verdict d applicabilite pour un moteur ou sous-bloc donne.
 *   full    : moteur produit son output normal
 *   partial : moteur produit un output scope sur certaines couches
 *             (ex: aiReplicability evalue uniquement la couche software
 *             d un dossier hybride hardware + software)
 *   none    : moteur se declare non applicable avec un rationnel
 *             structurel
 */
export interface RelevanceVerdict {
  applicable: 'full' | 'partial' | 'none';
  weight: number; // 0-1, contribution au score global
  scope: string[]; // sous-blocs ou couches actives si partial
  rationale: string; // pourquoi cette decision, lisible par le partner
}

/**
 * Output complet du service. Contient les criteres structurels
 * calcules et les verdicts par moteur ou sous-bloc.
 */
export interface RelevanceMatrix {
  // Criteres structurels calcules
  assetClass: string;
  businessModel: BusinessModel;
  productionChain: ProductionChain;
  supplyChainExposure: ExposureLevel;
  supplyChainExposureFactors: string[];
  macroSensitivity: ExposureLevel;
  macroSensitivityFactors: string[];
  geopoliticalExposure: ExposureLevel;
  geopoliticalExposureFactors: string[];
  digitalReproducibility: ExposureLevel;
  digitalReproducibilityFactors: string[];
  acquisitionFunnel: AcquisitionFunnel;

  // Verdicts par moteur ou sous-bloc
  verdicts: {
    macroGeopolitical: RelevanceVerdict;
    macroCyclical: RelevanceVerdict;
    marketAiReplicability: RelevanceVerdict;
    marketAiBusinessModel: RelevanceVerdict;
    indicatorsSaas: RelevanceVerdict;
    indicatorsIndustrial: RelevanceVerdict;
    saasMetricsRetention: RelevanceVerdict;
    saasMetricsUnitEconomics: RelevanceVerdict;
    valuationVcMethod: RelevanceVerdict;
    executionFriction: RelevanceVerdict;
    narrativeDrift: RelevanceVerdict;
    /** Bloc Phase 4 : sept patterns du moteur Fragilite Structurelle.
     *  Active conditionnellement selon stade et nature du dossier. */
    fragiliteStructurelle: {
      'growth-subsidized-model': RelevanceVerdict;
      'infrastructure-hostage': RelevanceVerdict;
      'fixed-cost-trap': RelevanceVerdict;
      'regulatory-time-bomb': RelevanceVerdict;
      'commoditization-drift': RelevanceVerdict;
      'capital-structure-fragility': RelevanceVerdict;
      'scale-mirage-risk': RelevanceVerdict;
    };
  };
}

// Niveau de maturite narrative deductible du stade declare. Le
// pipeline raisonne sur une granularite fine parce que les patterns
// Fragilite Structurelle s activent typiquement a partir de Series A
// late, pas avant : un Series A early avec POC en deploiement n a
// pas la meme exposition qu un Series A late avec deux ans de scale
// derriere lui. Idem au-dela : Series B, C, D et growth produisent
// chacun un signal de profondeur narrative et de risque structurel
// distinct.
export type NarrativeMaturity =
  | 'pre-seed'
  | 'seed'
  | 'series-a-early'
  | 'series-a-late'
  | 'series-b'
  | 'series-c'
  | 'series-d'
  | 'growth'
  | 'pre-ipo'
  | 'unknown';

/**
 * Verite doctrinale : la masse principale du moteur Fragilite
 * Structurelle s active a partir de Series A late. Avant ce stade,
 * seuls les patterns transversaux (regulatory-time-bomb sectoriel,
 * commoditization-drift sur knowledge work, growth-subsidized sur
 * Series A early, infrastructure-hostage sur wrappers LLM) peuvent
 * remonter un signal. Le helper sert aux verdicts qui doivent
 * decider en cascade. Voir docs/patterns/ pour la calibration
 * doctrinale par pattern.
 */
function isLateSeriesAOrAbove(maturity: NarrativeMaturity): boolean {
  return maturity === 'series-a-late'
    || maturity === 'series-b'
    || maturity === 'series-c'
    || maturity === 'series-d'
    || maturity === 'growth'
    || maturity === 'pre-ipo';
}

/**
 * Renvoie le poids de profondeur narrative associe au stade.
 * Sert au verdict narrativeDrift et aux ponderation Fragilite.
 */
function narrativeDepthWeight(maturity: NarrativeMaturity): number {
  switch (maturity) {
    case 'pre-seed': return 0.35;
    case 'seed': return 0.55;
    case 'series-a-early': return 0.7;
    case 'series-a-late': return 0.85;
    case 'series-b': return 0.95;
    case 'series-c':
    case 'series-d':
    case 'growth':
    case 'pre-ipo':
      return 1;
    default: return 0.5;
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Concatene les champs textuels exploitables de l extraction en
 * une seule chaine lower-case pour la detection par keywords.
 *
 * Le perimetre inclut le bloc traction (metrics, revenue, growth,
 * customers) parce que les decks FR placent souvent le pricing
 * canonique (ARPU, ARR, HT/mois, engagement contractuel) dans les
 * bullet points traction plutot que dans le champ businessModel
 * extrait. Sans ces champs, le detecteur business-model rate les
 * signaux quantitatifs et bascule a tort sur unknown.
 */
function buildSearchableText(ext: ExtractionOutput): string {
  // Normalisation lowercase + suppression diacritiques pour que
  // les keywords non accentues capturent les libelles accentues
  // (santé, énergie, défense). Voir lib/data/text-normalize.ts.
  const tractionParts: string[] = [];
  if (ext.traction) {
    if (Array.isArray(ext.traction.metrics)) tractionParts.push(ext.traction.metrics.join(' '));
    if (ext.traction.revenue) tractionParts.push(ext.traction.revenue);
    if (ext.traction.growth) tractionParts.push(ext.traction.growth);
    if (ext.traction.customers) tractionParts.push(ext.traction.customers);
  }
  return normalizeFrText([
    ext.sector,
    ext.subSector,
    ext.marketPitch,
    ext.productDescription,
    ext.businessModel,
    ext.rawSummary,
    ext.country,
    ext.geographicHub,
    ...tractionParts,
  ]
    .filter(Boolean)
    .join(' '));
}

/** Test si la chaine contient au moins un des keywords (substring). */
function containsAny(s: string, keywords: readonly string[]): boolean {
  return keywords.some((k) => s.includes(k));
}

/** Compte combien de keywords distincts apparaissent. */
function countMatches(s: string, keywords: readonly string[]): number {
  return keywords.filter((k) => s.includes(k)).length;
}

/** Extrait les keywords matches (pour lister les facteurs). */
function listMatches(s: string, keywords: readonly string[]): string[] {
  return keywords.filter((k) => s.includes(k));
}

// ============================================================
// DETECTEURS DE BRIQUES STRUCTURELLES
// ============================================================

// Composants electroniques avances necessitant des semi-conducteurs
// concentres geographiquement (TSMC, Samsung, SK Hynix). Couvre les
// dossiers automotive, robotique, drones, IoT, dispositifs medicaux
// connectes, voitures connectees, AR/VR.
const SEMICONDUCTOR_KEYWORDS = [
  'semi-conducteur', 'semiconductor', 'silicon', 'chip', 'soc ', 'fpga',
  'gpu', 'asic', 'puce', 'wafer', 'lithographie', 'foundry',
  'voiture connectee', 'voiture connectée', 'electrique', 'électrique',
  'autonomous vehicle', 'véhicule autonome', 'vehicule autonome',
  'drone', 'robotique', 'robot industriel', 'iot', 'embedded',
  'embarque', 'embarqué', 'capteur connecté', 'capteur connecte',
  'object connecte', 'objet connecte', 'objet connecté',
  'edge computing', 'inference hardware',
];

// Materiaux strategiques et terres rares (concentration Chine, Russie,
// quelques pays africains pour cobalt/lithium).
const STRATEGIC_MATERIALS_KEYWORDS = [
  'terres rares', 'rare earth', 'lithium', 'cobalt', 'nickel',
  'tungsten', 'tungstene', 'tungstène', 'graphite naturel',
  'palladium', 'platine', 'neodyme', 'néodyme',
  'batterie lithium', 'lithium-ion', 'cathode', 'anode',
];

// Hydrocarbures et exposition aux marches energetiques tendus
// (detroit Ormuz, gaz russe, petrole golfe).
const ENERGY_FOSSIL_KEYWORDS = [
  'petrole', 'pétrole', 'oil ', 'gaz naturel', 'natural gas',
  'lng', 'gnl', 'hydrocarbures', 'fossile',
  'cracking', 'raffinerie', 'refinery',
  'tres energivore', 'très énergivore', 'energivore', 'énergivore',
  'data center', 'datacenter', 'cloud computing intensif',
];

// Logistique maritime longue passant par detroits sensibles.
const MARITIME_LOGISTICS_KEYWORDS = [
  'logistique maritime', 'shipping', 'fret maritime',
  'porte-conteneurs', 'cargo', 'maritime international',
  'detroit', 'détroit', 'ormuz', 'hormuz', 'suez', 'bab el-mandeb',
  'malacca', 'mer rouge', 'red sea',
  'supply chain asie', 'sourcing chine', 'manufactured in china',
];

// Soumission aux regimes d export controls (ITAR US, EAR US,
// dual-use UE, sanctions Russie/Chine).
const EXPORT_CONTROLS_KEYWORDS = [
  'dual-use', 'dual use', 'double usage',
  'itar', 'ear', 'export control', 'controle export',
  'cryptographie forte', 'strong encryption',
  'defense', 'défense', 'military', 'militaire',
  'aerospace', 'aérospatial', 'space-grade',
  'biens sensibles', 'biens a double usage',
];

// Presence operationnelle ou marches dans des zones a risque pays
// eleve (Moyen-Orient, Russie/CEI, certains pays Afrique, mer de Chine).
const HIGH_RISK_GEOGRAPHIES_KEYWORDS = [
  'moyen-orient', 'middle east', 'iran', 'irak', 'syrie',
  'russie', 'russia', 'belarus', 'biélorussie',
  'afghanistan', 'pakistan',
  'mer de chine', 'south china sea', 'taiwan', 'taïwan',
  'venezuela', 'libye', 'libya',
];

// Chaines de production hardware physique. La detection separe
// deux registres :
//
//   - PRODUCTION : signaux de fabrication propre, d assemblage,
//     d industrialisation, de R&D materielle. Un dossier qui matche
//     ici produit ou assemble lui-meme un objet physique.
//
//   - OBJECT : objet metier mentionne dans le pitch (vehicule, drone,
//     navire). Un objet seul est ambigu : un SaaS de gestion de
//     flottes adresse des vehicules sans en fabriquer. On ne bascule
//     en hardware-physical sur OBJECT seul que si aucun signal
//     SaaS contradictoire n est detecte dans le meme texte.
//
// La separation evite le faux positif des plateformes verticales
// (mobilite, logistique, restauration) qui mentionnent l objet
// metier dans toutes leurs pages sans en fabriquer un seul. Cas
// canonique : Ambulife mentionne ambulances et vehicules a chaque
// paragraphe mais c est une plateforme de reservation SaaS.
const HARDWARE_PRODUCTION_KEYWORDS = [
  // 'usine' est volontairement prefixe d un espace pour eviter de
  // matcher en substring dans 'business' (b-usine-ss), faux positif
  // declenche systematiquement par les decks SaaS B2B qui parlent
  // de leur business recurrent.
  'hardware', 'manufacturing', ' usine', 'fabrication',
  'fabrique', 'fabriqu', 'industrialis',
  'production en serie', 'fabrication en serie',
  'ligne de production', 'ligne d assemblage',
  'prototype', 'composant', 'assemblage',
  'electronique', 'mecanique',
  'r&d hardware', 'r&d materiel',
  'bom ', 'nomenclature matiere',
  'capex outillage', 'capex industriel',
];

const HARDWARE_OBJECT_KEYWORDS = [
  'capteur', 'machine', 'equipement', 'piece',
  'drone', 'vehicule', 'sous-marin', 'aeronef',
  'navire', 'bateau', 'foilboard',
  'paddle', 'submersible', 'semi-submersible',
];

// Indicateurs SaaS / plateforme. Servent a distinguer un dossier
// qui ADRESSE un marche hardware (sans en fabriquer) d un dossier
// qui fabrique. La presence d au moins un signal SaaS + des objets
// hardware sans production explicite indique une plateforme
// verticale, pas un industriel.
const SAAS_INDICATORS_KEYWORDS = [
  'saas', 'software', 'logiciel',
  'application', 'app mobile', 'mobile app',
  'plateforme numerique', 'plateforme web', 'plateforme transversale',
  'plateforme de reservation', 'plateforme transactionnelle',
  'plateforme de gestion', 'plateforme de mise en relation',
  'cloud', 'api ',
  'dashboard', 'tableau de bord', 'interface utilisateur',
  'geolocalisation', 'systeme de gestion',
];

// Infrastructures physiques lourdes (genie civil, energie de reseau,
// telecom physique, traitement d eau, chauffage urbain).
const INFRASTRUCTURE_PHYSICAL_KEYWORDS = [
  'infrastructure', 'genie civil', 'génie civil',
  'genie maritime', 'génie maritime',
  'reseau electrique', 'réseau électrique',
  'reseau de chaleur', 'réseau de chaleur',
  'chauffage urbain', 'district heating',
  'fibre optique', 'antenne 5g',
  'station electrique', 'centrale',
  'eolien', 'éolien', 'photovoltaique', 'photovoltaïque',
  'solaire au sol', 'parc solaire',
  'hydrolien', 'marine renouvelable', 'energies marines',
  'énergies marines', 'swac', 'otec', 'etm',
  'conduite peht', 'conduite pehd',
];

// Biotech humide (R&D wet lab, essais cliniques, dispositifs medicaux
// reglementes), distincte de la digital health.
const WET_BIOTECH_KEYWORDS = [
  'biotech', 'biotechnologie', 'biotechnology',
  'wet lab', 'paillasse', 'molecule', 'molécule',
  'medicament', 'médicament', 'drug discovery',
  'dispositif medical', 'dispositif médical', 'medical device',
  'classe iia', 'classe iib', 'classe iii',
  'essai clinique', 'clinical trial',
  'phase i', 'phase ii', 'phase iii',
  'bioreacteur', 'bioréacteur',
  'culture cellulaire', 'cell line',
  'genetique', 'génétique', 'crispr',
];

// Services regules a forte barriere humaine reglementaire. Le
// perimetre est le tissu FR des professions reglementees (ordres
// professionnels, agrements, autorisations d exercer) et des
// activites a barriere reglementaire forte (sante, banque,
// finance, immobilier, transport sanitaire, accueil ESMS et
// petite enfance, formation diplomante, securite privee). Le
// texte d entree est deja passe dans normalizeFrText, donc on
// liste les keywords sans accents : 'medecin' couvre Médecin,
// 'sante' couvre Santé, etc.
//
// Pas d acronymes courts ambigus (CAC, CIF, MSP, HAD, MAS, SAAD,
// VSL, CFA, SGP). Substring matching sans word-boundary, ces
// trois-quatre lettres apparaissent dans Customer Acquisition
// Cost, Video Sales Letter, Managed Service Provider, etc. On
// privilegie systematiquement la forme longue qui leve l ambiguite.
const REGULATED_SERVICE_KEYWORDS = [
  // Professions juridiques et judiciaires
  'avocat', 'cabinet d avocats', 'barreau',
  'notaire', 'office notarial', 'scp notariale',
  'huissier', 'commissaire de justice', 'commissaire priseur',
  'mandataire judiciaire', 'administrateur judiciaire',
  // Comptabilite, audit, conseil financier reglemente
  'expert-comptable', 'expert comptable',
  'commissaire aux comptes',
  'conseil en investissement',
  'conseiller en gestion de patrimoine',
  'courtier en credit', 'courtier en assurance',
  'iobsp', 'intermediaire en operations de banque',
  // Etablissements financiers et assurantiels. On distingue ici
  // l etablissement reglemente (la societe EST une banque, une
  // assurance, un etablissement de credit) de la simple presence
  // d un agrement reglementaire dans le pipeline. Un fintech
  // logiciel avec agrement ACPR a une production-chain
  // pure-software portant un wrapper reglementaire, pas une
  // production-chain regulated-service. Les keywords agrement
  // ACPR / AMF restent capturees par REGULE_KEYWORDS cote
  // regulatory-time-bomb-pattern, c est leur place doctrinale.
  'banque', 'etablissement de credit', 'societe de financement',
  'etablissement de paiement', 'etablissement de monnaie electronique',
  'societe de gestion de portefeuille',
  'assurance', 'mutuelle', 'institution de prevoyance',
  'plateforme de financement participatif',
  // Sante : professions et etablissements
  'medecin', 'ordre des medecins', 'conseil de l ordre',
  'chirurgien-dentiste', 'dentiste',
  'pharmacien', 'pharmacie', 'officine',
  'infirmier', 'infirmiere', 'sage-femme',
  'kinesitherapeute', 'orthophoniste', 'orthoptiste',
  'psychologue', 'podologue', 'osteopathe',
  'veterinaire', 'ordre des veterinaires',
  'biologie medicale', 'laboratoire d analyses medicales',
  'imagerie medicale', 'radiologie medicale',
  'hopital', 'centre de sante',
  'maison de sante pluriprofessionnelle',
  'agrement ars', 'hospitalisation a domicile',
  // Medico-social et accueil
  'ehpad', 'maison de retraite', 'etablissement medico-social',
  'aide a domicile reglementee',
  'creche', 'etablissement d accueil du jeune enfant',
  'assistante maternelle agreee',
  // Education et formation reglementee
  'etablissement sous contrat', 'centre de formation d apprentis',
  'qualiopi', 'organisme de formation certifie',
  // Transport et mobilite reglementes
  'transport sanitaire', 'ambulance', 'ambulancier',
  'taxi conventionne', 'taxi cpam',
  // Immobilier et urbanisme reglementes
  'agent immobilier', 'carte t hoguet', 'loi hoguet',
  'architecte', 'ordre des architectes', 'geometre-expert',
  // Securite privee et services funeraires
  'securite privee', 'ssiap', 'cnaps',
  'pompes funebres', 'thanatopracteur',
];

// Production / distribution de contenu media.
const CONTENT_MEDIA_KEYWORDS = [
  'edition', 'édition', 'publishing',
  'streaming', 'production audiovisuelle',
  'podcast', 'newsletter editoriale',
  'studio creation', 'studio création',
  'distribution film', 'distribution video',
];

// Vente unitaire d objets fabriques ou de produits retail.
const UNITARY_SALE_KEYWORDS = [
  'vente unitaire', 'vente a l unite', 'vente à l unité',
  'fabrication-vente', 'fabrication a la commande',
  'serie limitee', 'série limitée',
  'prix par unite', 'prix par unité',
  'marge par bateau', 'marge par drone',
  // Retail / DTC : la marque DTC vend des unites discretes
  // (vetements, accessoires, electronique grand public). Modele
  // structurel = vente one-shot, pas recurrence.
  'pret-a-porter', 'prêt-à-porter', 'pret a porter',
  'marque dtc', 'consumer brand', 'vente directe',
  'ecommerce dtc', 'e-commerce dtc',
];

// Modele a projet (SPV, contrats par operation, cycle long).
const PROJECT_BASED_KEYWORDS = [
  'spv', 'special purpose vehicle',
  'project-based', 'project based', 'par projet', 'projet par projet',
  'appel d offres', 'appel d\'offres', 'appels d offres',
  'rfp', 'tender', 'marche public', 'marché public',
  'concession', 'delegation de service public',
  'délégation de service public', 'amo', 'maitrise d ouvrage',
  'maîtrise d ouvrage', 'moe', 'maitrise d oeuvre',
  'maîtrise d oeuvre',
  'contrats de developpement', 'contrats de développement',
  'contrat de developpement', 'contrat de développement',
];

// Modele recurrent SaaS classique. On evite 'subscription model'
// (trop generique, fait penser a tout abonnement consumer ou B2B)
// et on couvre les deux ordres 'b2b saas' / 'saas b2b' qui
// apparaissent indifferemment en deck FR.
//
// Au-dela du vocabulaire SaaS explicite, on capture les signaux
// canoniques de pricing B2B FR (HT/mois, engagement contractuel,
// business recurrent, ARPU) que tout deck B2B utilise meme quand
// il ne se revendique pas SaaS. Sans ces signaux, les dossiers
// vertical B2B (santetech, fintech vertical, plateformes verticales)
// rataient la detection et basculaient en unknown.
const RECURRENT_SAAS_KEYWORDS = [
  'saas', 'software as a service',
  'arr ', 'mrr ', 'acv ', 'tcv ', 'logo retention',
  'abonnement b2b', 'subscription b2b',
  'b2b saas', 'saas b2b', 'enterprise saas',
  'license recurrente', 'logiciel professionnel recurrent',
  'plateforme saas b2b', 'plateforme saas',
  // Pricing B2B canonique FR
  'ht/mois', 'ht / mois', 'ht par mois', 'ht/an', 'ht par an',
  'eur ht', 'euros ht',
  // Recurrence affichee
  'business recurrent', 'revenu recurrent', 'revenus recurrents',
  'ca recurrent', 'chiffre d affaires recurrent',
  'modele recurrent', 'modele d abonnement b2b',
  // Engagement contractuel B2B
  'engagement annuel', 'engagement contractuel', 'engagement pluriannuel',
  'engagement sur 2 ans', 'engagement sur 3 ans',
  'engagement de 2 ans', 'engagement de 3 ans',
  'contrat annuel',
  // Pricing par tete / par compte
  'arpu', 'par utilisateur', 'par siege', 'par seat',
  'tarif entreprise', 'license entreprise', 'abonnement entreprise',
];

// Subscription consumer (B2C abonnement). Le perimetre est strict :
// ce sont des signaux explicitement consumer-facing, pas le simple
// mot abonnement mensuel qui apparait dans tout deck B2B SaaS FR.
// La discrimination fine B2B vs B2C est gerree en aval par les
// AUDIENCE_KEYWORDS qui servent de tie-breaker.
const CONSUMER_SUBSCRIPTION_KEYWORDS = [
  'abonnement b2c', 'abonnement consumer',
  'subscription b2c', 'consumer subscription',
  'box mensuelle', 'subscription box',
  'streaming consumer', 'streaming b2c',
  'app freemium consumer', 'paywall consumer',
  'abonnement grand public', 'app store revenue',
];

// Signaux d audience B2B explicites. Servent a casser les egalites
// entre recurrent-saas et consumer-subscription quand un dossier
// melange les deux vocabulaires (cas frequent : SaaS B2B avec
// mention abonnement mensuel et saas et arr melanges).
//
// On inclut les variantes orthographiques B2B / BtoB / B to B parce
// que les decks FR alternent indifferemment entre les deux formes,
// parfois dans le meme paragraphe. La forme 'btob' couvre aussi
// 'btobtoc' (BtoBtoC) en substring.
const B2B_AUDIENCE_KEYWORDS = [
  'b2b ', ' b2b', 'btob', 'b to b',
  'entreprise cliente', 'enterprise customer',
  'pme cible', 'eti cible', 'mid-market', 'enterprise account',
  'sales cycle', 'sales-led', 'account-based', 'pipeline commercial',
  'go-to-market b2b', 'gtm b2b',
  'crm ', ' crm', 'erp ', ' erp', 'hr saas', 'sales saas',
];

// Signaux d audience B2C explicites. Tie-breaker symetrique.
const B2C_AUDIENCE_KEYWORDS = [
  'b2c ', ' b2c', 'consumer ', ' consumer', 'consommateur',
  'grand public', 'mass market', 'utilisateur final', 'end user',
  'd2c ', 'dtc ', 'dtc brand', 'd2c brand',
  'consumer brand', 'marque consumer', 'marque grand public',
  'app store', 'play store',
];

// Marketplace (commissions sur transactions).
const MARKETPLACE_KEYWORDS = [
  'marketplace', 'place de marche', 'place de marché',
  'commission sur transaction', 'take rate',
  'gmv', 'gross merchandise value',
  'plateforme transactionnelle',
];

// Service a l acte / prestation.
const SERVICE_ON_DEMAND_KEYWORDS = [
  'consulting', 'cabinet de conseil',
  'agence digitale', 'agence creative', 'agence créative',
  'prestation de service', 'service a l acte',
  'mission de conseil', 'freelance',
  'au temps passe', 'au forfait',
];

// Funnel d acquisition payante mesurable.
const ACQUISITION_FUNNEL_KEYWORDS = [
  'cac', 'cost per acquisition', 'cost per click', 'cpc',
  'cost per lead', 'cpl', 'lead generation', 'lead gen',
  'mql', 'sql', 'marketing qualified lead',
  'paid acquisition', 'acquisition payante',
  'sea', 'sem', 'ads facebook', 'ads google',
  'taux de conversion', 'conversion rate', 'cvr',
  'funnel', 'tunnel de conversion',
];

// Sensibilite forte au pouvoir d achat consommateur.
const CONSUMER_DISCRETIONARY_KEYWORDS = [
  'mode', 'fashion', 'pret-a-porter', 'prêt-à-porter',
  'cosmetique', 'cosmétique', 'beauty',
  'restauration', 'restaurant', 'hospitality',
  'tourisme', 'travel', 'voyage',
  'mobilier', 'decoration interieur', 'décoration intérieur',
  'electronique grand public',
  'box food', 'meal kit',
  'sport equipement consumer',
  'consumer brand', 'marque dtc', 'dtc brand',
];

// Taux d interet et capex sensitive (real estate, energie capex,
// infrastructure, automotive).
const RATE_SENSITIVE_KEYWORDS = [
  'leveraged', 'effet de levier financier',
  'capex lourd', 'capex intensive',
  'real estate', 'immobilier',
  'project finance',
  'taux d interet', 'taux d\'intérêt',
];

// ============================================================
// CALCUL DES CRITERES STRUCTURELS
// ============================================================

/**
 * Detecte le modele economique structurel. La detection raisonne
 * par briques (SaaS, marketplace, vente unitaire, projet, services
 * a l acte) et choisit la categorie la plus saillante. En cas de
 * combinaison non triviale, hybrid.
 */
function detectBusinessModel(text: string): BusinessModel {
  const recurrent = countMatches(text, RECURRENT_SAAS_KEYWORDS);
  const consumerSub = countMatches(text, CONSUMER_SUBSCRIPTION_KEYWORDS);
  const unitary = countMatches(text, UNITARY_SALE_KEYWORDS);
  const project = countMatches(text, PROJECT_BASED_KEYWORDS);
  const marketplace = countMatches(text, MARKETPLACE_KEYWORDS);
  const service = countMatches(text, SERVICE_ON_DEMAND_KEYWORDS);
  const b2gMarkers = countMatches(text, [
    'etat', 'public', 'collectivite',
    'ministere', 'defense',
    'gendarmerie', 'police', 'armee',
    'agence nationale', 'parapublic',
  ]);
  // Audience lean B2B vs B2C : sert de tie-breaker quand le
  // dossier mele indifferemment vocabulaire B2B et B2C. Le mot
  // generique "abonnement mensuel" sans contexte est presque
  // toujours du B2B en pitch FR, mais on prefere une discrimination
  // explicite par signaux d audience plutot qu une heuristique
  // implicite.
  const b2bAudience = countMatches(text, B2B_AUDIENCE_KEYWORDS);
  const b2cAudience = countMatches(text, B2C_AUDIENCE_KEYWORDS);
  const audienceLean: 'b2b' | 'b2c' | 'unknown' =
    b2bAudience > b2cAudience + 1 ? 'b2b'
      : b2cAudience > b2bAudience + 1 ? 'b2c'
        : b2bAudience > b2cAudience ? 'b2b'
          : b2cAudience > b2bAudience ? 'b2c'
            : 'unknown';

  // Calcul du score brut par modele
  const scores = {
    recurrent, consumerSub, unitary, project, marketplace, service,
  };

  // Cas dominant (au moins 2 matches, ecart >= 2 avec le second)
  const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [topKey, topVal] = ranked[0];
  const secondVal = ranked[1]?.[1] ?? 0;

  // Si le top score est nul, indetermine
  if (topVal < 1) return 'unknown';

  // Cas B2G : si b2gMarkers fort ET project >= 1, c est contract-b2g
  if (b2gMarkers >= 2 && project >= 1) return 'contract-b2g';

  // Cas critique : recurrent et consumerSub a egalite. Avant on
  // sortait hybrid par defaut, ce qui faisait basculer un B2B SaaS
  // standard mentionnant abonnement mensuel en hybrid. On
  // discrimine maintenant par l audience explicite.
  if (recurrent >= 1 && recurrent === consumerSub && topVal === recurrent) {
    if (audienceLean === 'b2b') return 'recurrent-saas';
    if (audienceLean === 'b2c') return 'consumer-subscription';
    return 'hybrid';
  }

  // Si plusieurs modeles co-existent au meme score top hors couple
  // SaaS / consumer-sub, c est un hybride (ex: vente unitaire plus
  // abonnement dashboard, marque DTC vente plus abonnement box).
  // Si le top est dominant meme par un seul point, on tranche pour
  // la categorie dominante.
  if (topVal === secondVal && topVal >= 1) {
    return 'hybrid';
  }

  switch (topKey) {
    case 'recurrent': return 'recurrent-saas';
    case 'consumerSub': return 'consumer-subscription';
    case 'unitary': return 'unitary-sale';
    case 'project': return 'project-based';
    case 'marketplace': return 'marketplace';
    case 'service': return 'service-on-demand';
    default: return 'unknown';
  }
}

/**
 * Detecte la chaine de production. Un dossier peut combiner
 * software et hardware. On retourne la dominante.
 *
 * Regle de bascule hardware-physical :
 *   1. PRODUCTION >= 2  : signaux de fabrication propre robustes,
 *      bascule meme si SaaS evoque (cas hybride hardware + software
 *      embarque type AutoTech, Platypus).
 *   2. PRODUCTION >= 1 ET OBJECT >= 1 : production declaree plus
 *      objet associe, le dossier fabrique cet objet.
 *   3. OBJECT >= 2 ET SaaS = 0 : plusieurs objets metier mentionnes
 *      sans aucun signal de plateforme, le dossier porte directement
 *      le hardware.
 *
 * Les cas restants (OBJECT seul avec signal SaaS, OBJECT = 1 sans
 * production, etc.) sont traites en aval : la chaine est software
 * ou plateforme, pas hardware. Le SaaS qui adresse un marche
 * vertical d objets physiques n est pas un hardware-producer.
 */
function detectProductionChain(text: string): ProductionChain {
  const hardwareProduction = countMatches(text, HARDWARE_PRODUCTION_KEYWORDS);
  const hardwareObject = countMatches(text, HARDWARE_OBJECT_KEYWORDS);
  const infra = countMatches(text, INFRASTRUCTURE_PHYSICAL_KEYWORDS);
  const biotech = countMatches(text, WET_BIOTECH_KEYWORDS);
  const regulated = countMatches(text, REGULATED_SERVICE_KEYWORDS);
  const content = countMatches(text, CONTENT_MEDIA_KEYWORDS);
  const saasSignal = countMatches(text, SAAS_INDICATORS_KEYWORDS);

  // Infrastructure prioritaire sur hardware si les deux matchent
  // (genie maritime contient des keywords hardware aussi).
  const hardwareTotal = hardwareProduction + hardwareObject;
  if (infra >= 2 && infra >= hardwareTotal) return 'infrastructure-physical';

  // Hardware : production propre forte, OU production + objet, OU
  // objets multiples sans contradiction SaaS.
  if (hardwareProduction >= 2) return 'hardware-physical';
  if (hardwareProduction >= 1 && hardwareObject >= 1) return 'hardware-physical';
  if (hardwareObject >= 2 && saasSignal === 0) return 'hardware-physical';

  if (biotech >= 2) return 'wet-biotech';
  // Regulated-service : reserve aux dossiers qui SONT le service
  // regule (cabinet d avocats, ambulancier, medecin, ehpad...). Une
  // plateforme SaaS qui adresse le marche du service regule sans en
  // exercer l activite n est pas regulated-service. Memes garde-fous
  // doctrinaux que pour hardware-physical : la presence d un signal
  // SaaS bloque la bascule, le dossier reste pure-software.
  if (regulated >= 2 && saasSignal === 0) return 'regulated-service';
  if (content >= 2) return 'content-media';

  // Cas par defaut : pure-software si signal SaaS detecte (plateforme
  // verticale qui adresse un marche hardware sans fabrication) ou si
  // les keywords logiciel canoniques sont presents.
  if (saasSignal >= 1
    || containsAny(text, ['saas', 'software', 'application', 'plateforme web', 'app mobile', 'mobile app', 'cloud', 'api '])) {
    return 'pure-software';
  }

  return 'unknown';
}

/**
 * Calcule l exposition supply chain. Multi-factorielle : composants
 * critiques, materiaux strategiques, hydrocarbures, logistique
 * maritime sensible, export controls. On agrege en niveau global
 * et on liste les facteurs detectes.
 */
function detectSupplyChainExposure(text: string): { level: ExposureLevel; factors: string[] } {
  const factors: string[] = [];

  if (containsAny(text, SEMICONDUCTOR_KEYWORDS)) factors.push('semi-conducteurs');
  if (containsAny(text, STRATEGIC_MATERIALS_KEYWORDS)) factors.push('materiaux strategiques');
  if (containsAny(text, ENERGY_FOSSIL_KEYWORDS)) factors.push('intensite energetique fossile');
  if (containsAny(text, MARITIME_LOGISTICS_KEYWORDS)) factors.push('logistique maritime longue');
  if (containsAny(text, EXPORT_CONTROLS_KEYWORDS)) factors.push('soumission export controls');

  if (factors.length >= 2) return { level: 'high', factors };
  if (factors.length === 1) return { level: 'medium', factors };
  return { level: 'low', factors };
}

/**
 * Calcule la sensibilite macroeconomique. Trois axes : exposition
 * pouvoir d achat consumer (cyclique), capex / taux d interet,
 * dependance B2C discretionnaire. Un B2B SaaS verticalise sante
 * sera low. Une marque DTC consumer milieu de gamme sera high.
 */
function detectMacroSensitivity(text: string, businessModel: BusinessModel): { level: ExposureLevel; factors: string[] } {
  const factors: string[] = [];

  if (containsAny(text, CONSUMER_DISCRETIONARY_KEYWORDS)) factors.push('consommation discretionnaire');
  if (containsAny(text, RATE_SENSITIVE_KEYWORDS)) factors.push('sensibilite taux d interet');
  if (businessModel === 'consumer-subscription' || businessModel === 'marketplace') {
    factors.push('dependance volume B2C');
  }
  if (containsAny(text, ['retail', 'consumer', 'b2c'])) {
    if (!factors.includes('dependance volume B2C')) factors.push('exposition consumer');
  }

  if (factors.length >= 2) return { level: 'high', factors };
  if (factors.length === 1) return { level: 'medium', factors };
  return { level: 'low', factors };
}

/**
 * Calcule l exposition geopolitique. S appuie sur les briques de
 * supply chain (semi-conducteurs, hydrocarbures, materiaux
 * strategiques, maritime) plus la presence dans des zones a risque
 * pays et la soumission aux export controls.
 */
function detectGeopoliticalExposure(text: string, supplyChain: { level: ExposureLevel; factors: string[] }): { level: ExposureLevel; factors: string[] } {
  const factors: string[] = [];

  // Supply chain critique reporte une partie de l exposition geo
  if (supplyChain.factors.includes('semi-conducteurs')) factors.push('chaine semi-conducteurs');
  if (supplyChain.factors.includes('materiaux strategiques')) factors.push('materiaux strategiques');
  if (supplyChain.factors.includes('intensite energetique fossile')) factors.push('exposition prix energie');
  if (supplyChain.factors.includes('logistique maritime longue')) factors.push('routes commerciales sensibles');
  if (supplyChain.factors.includes('soumission export controls')) factors.push('export controls');

  // Presence ou marches dans zones a risque
  if (containsAny(text, HIGH_RISK_GEOGRAPHIES_KEYWORDS)) factors.push('presence zones a risque pays');

  // Defense / dual-use
  if (containsAny(text, ['defense', 'défense', 'military', 'militaire', 'dual-use'])) {
    if (!factors.includes('export controls')) factors.push('secteur defense');
  }

  if (factors.length >= 2) return { level: 'high', factors };
  if (factors.length === 1) return { level: 'medium', factors };
  return { level: 'low', factors };
}

/**
 * Calcule la reproductibilite numerique. Pure software sans
 * protection = high. Hardware physique ou infrastructure = low.
 * Hybride ou pure software avec donnees proprietaires / regulation
 * forte = medium.
 */
function detectDigitalReproducibility(text: string, productionChain: ProductionChain): { level: ExposureLevel; factors: string[] } {
  const factors: string[] = [];

  // Plancher : produit physique = low
  if (productionChain === 'hardware-physical') {
    factors.push('produit hardware physique');
    return { level: 'low', factors };
  }
  if (productionChain === 'infrastructure-physical') {
    factors.push('infrastructure physique non duplicable par logiciel');
    return { level: 'low', factors };
  }
  if (productionChain === 'wet-biotech') {
    factors.push('biotech humide non duplicable par logiciel');
    return { level: 'low', factors };
  }
  if (productionChain === 'regulated-service') {
    factors.push('service regule a barriere humaine');
    return { level: 'low', factors };
  }

  // Si pure software, on regarde les protections
  const protections: string[] = [];
  if (containsAny(text, ['donnees proprietaires', 'données propriétaires', 'proprietary data', 'data moat'])) {
    protections.push('donnees proprietaires');
  }
  if (containsAny(text, ['regulation', 'agrement', 'agrément', 'license bancaire', 'licence bancaire', 'orias', 'acpr', 'cnil'])) {
    protections.push('barriere reglementaire');
  }
  if (containsAny(text, ['network effect', 'effet de reseau', 'effet de réseau', 'two-sided'])) {
    protections.push('network effect');
  }
  if (containsAny(text, ['fine-tuning custom', 'fine tuning', 'modele entraine', 'modèle entrainé', 'modele entraîné'])) {
    protections.push('modele entraine custom');
  }
  if (containsAny(text, ['integration profonde', 'intégration profonde', 'workflow critique', 'core process', 'erp', 'systemes legacy'])) {
    protections.push('integration profonde dans workflows clients');
  }

  if (productionChain === 'pure-software') {
    if (protections.length >= 2) {
      factors.push(...protections);
      factors.push('software protege par barrieres non triviales');
      return { level: 'medium', factors };
    }
    factors.push('software pur sans protection significative detectee');
    return { level: 'high', factors };
  }

  // Content media : duplicable en partie (le code), pas le contenu original
  if (productionChain === 'content-media') {
    factors.push('couche distribution duplicable, contenu original protege par droit d auteur');
    return { level: 'medium', factors };
  }

  // Fallback prudent
  factors.push('chaine de production indeterminee');
  return { level: 'medium', factors };
}

/**
 * Determine la presence d un funnel d acquisition mesurable.
 * Distingue acquisition payante mesurable (CAC marketing classique),
 * vente B2B sales-led (cycle long sans CAC marketing), absence (B2G,
 * projets uniques sans demarche d acquisition standardisee).
 */
function detectAcquisitionFunnel(text: string, businessModel: BusinessModel): AcquisitionFunnel {
  const funnelMarkers = countMatches(text, ACQUISITION_FUNNEL_KEYWORDS);

  if (funnelMarkers >= 2) return 'present';

  if (businessModel === 'project-based' || businessModel === 'contract-b2g') {
    return 'absent';
  }

  if (businessModel === 'recurrent-saas') {
    if (funnelMarkers >= 1) return 'present';
    // SaaS B2B Enterprise sans funnel marketing classique
    if (containsAny(text, ['enterprise', 'grands comptes', 'account based', 'abm', 'vente complexe', 'cycle de vente long'])) {
      return 'b2b-sales-led';
    }
    return 'b2b-sales-led';
  }

  if (businessModel === 'unitary-sale') {
    // Vente unitaire B2B avec sales-led, pas de CAC marketing
    return 'b2b-sales-led';
  }

  if (businessModel === 'consumer-subscription' || businessModel === 'marketplace') {
    // Acquisition payante presque toujours
    return 'present';
  }

  if (businessModel === 'service-on-demand') {
    // Variable. Si markers funnel, present. Sinon b2b-sales-led.
    return funnelMarkers >= 1 ? 'present' : 'b2b-sales-led';
  }

  // Fallback : si on a au moins un marker funnel, present, sinon
  // b2b-sales-led par defaut prudent (pas absent qui est reserve
  // aux modeles structurellement sans acquisition mesurable).
  if (funnelMarkers >= 1) return 'present';
  return 'unknown';
}

// ============================================================
// CONSTRUCTION DES VERDICTS PAR MOTEUR
// ============================================================

function buildMacroGeopoliticalVerdict(geo: ExposureLevel, factors: string[]): RelevanceVerdict {
  if (geo === 'high') {
    return {
      applicable: 'full',
      weight: 1,
      scope: factors,
      rationale: `Exposition geopolitique elevee (${factors.join(', ')}). Le moteur produit une lecture calibree sur les facteurs identifies.`,
    };
  }
  if (geo === 'medium') {
    return {
      applicable: 'partial',
      weight: 0.5,
      scope: factors,
      rationale: `Exposition geopolitique moderee (${factors.join(', ')}). Le moteur produit une lecture cible sur les facteurs identifies, sans elargir au regime geopolitique global.`,
    };
  }
  return {
    applicable: 'none',
    weight: 0,
    scope: [],
    rationale: 'Aucune brique d exposition geopolitique detectee (pas de chaine de composants critiques, pas de presence en zone a risque, pas d exposition energetique). La dimension n est pas significative pour ce dossier et n est pas activee dans la note.',
  };
}

function buildMacroCyclicalVerdict(macro: ExposureLevel, factors: string[]): RelevanceVerdict {
  if (macro === 'high') {
    return {
      applicable: 'full',
      weight: 1,
      scope: factors,
      rationale: `Sensibilite macroeconomique elevee (${factors.join(', ')}). Lecture cyclique complete avec projections FMI WEO.`,
    };
  }
  if (macro === 'medium') {
    return {
      applicable: 'partial',
      weight: 0.6,
      scope: factors,
      rationale: `Sensibilite macroeconomique moderee (${factors.join(', ')}). Lecture cyclique cible.`,
    };
  }
  return {
    applicable: 'none',
    weight: 0,
    scope: [],
    rationale: 'Modele economique peu sensible a la conjoncture (B2B SaaS verticalise, sante, education professionnelle, defense, infrastructure publique). La dimension cyclique n est pas activee.',
  };
}

function buildMarketAiReplicabilityVerdict(reproducibility: ExposureLevel, factors: string[], productionChain: ProductionChain): RelevanceVerdict {
  if (reproducibility === 'high') {
    return {
      applicable: 'full',
      weight: 1,
      scope: ['code', 'interface', 'workflow'],
      rationale: 'Produit a forte reproductibilite numerique : un solo founder avec assistance IA peut reproduire les composants techniques en quelques mois.',
    };
  }
  if (reproducibility === 'medium') {
    return {
      applicable: 'partial',
      weight: 0.5,
      scope: ['couche software', 'interface'],
      rationale: `Reproductibilite partielle. La couche software est exposee a la duplication par IA, le reste du moat (${factors.join(', ')}) ne l est pas. Le moteur evalue uniquement la couche software.`,
    };
  }
  return {
    applicable: 'none',
    weight: 0,
    scope: [],
    rationale: `Produit a chaine ${productionChain} : la reproduction par IA n est pas une menace pertinente (${factors.join(', ')}). Le moteur ne tourne pas sur ce dossier.`,
  };
}

function buildMarketAiBusinessModelVerdict(productionChain: ProductionChain, text: string): RelevanceVerdict {
  // Le moteur aiBusinessModel est pertinent si le produit s appuie
  // structurellement sur un LLM tiers (cout LLM dans COGS, dependance
  // provider). Sur les produits non-software, sans rapport.
  const hasLlmDependency = containsAny(text, [
    'llm', 'gpt', 'claude', 'mistral', 'openai', 'anthropic',
    'modele de langage', 'modèle de langage',
    'foundation model', 'rag', 'genai', 'generative ai',
    'ia generative', 'ia générative',
  ]);

  if (productionChain !== 'pure-software' && productionChain !== 'content-media') {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Produit hors software : la dependance a un LLM tiers comme infrastructure n est pas pertinente.',
    };
  }

  if (!hasLlmDependency) {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Aucune dependance LLM detectee dans le pitch. Le bloc AI-native ne s applique pas.',
    };
  }

  return {
    applicable: 'full',
    weight: 1,
    scope: [],
    rationale: 'Dependance LLM tiers detectee : evaluation marges AI-native, risque commoditisation, sensitivity au prix d API.',
  };
}

function buildIndicatorsSaasVerdict(businessModel: BusinessModel): RelevanceVerdict {
  if (businessModel === 'recurrent-saas' || businessModel === 'consumer-subscription') {
    return {
      applicable: 'full',
      weight: 1,
      scope: ['burnMultiple', 'ruleOf40', 'ndr', 'magicNumber', 'paybackCac', 'grossMargin', 'revenuePerEmployee'],
      rationale: 'Modele recurrent : les sept KPI canoniques SaaS sont applicables.',
    };
  }
  if (businessModel === 'marketplace') {
    return {
      applicable: 'partial',
      weight: 0.6,
      scope: ['burnMultiple', 'grossMargin', 'revenuePerEmployee'],
      rationale: 'Marketplace : les KPI lies a la recurrence (NDR) sont non applicables, mais burn multiple, marge brute et revenue per employee restent pertinents.',
    };
  }
  return {
    applicable: 'none',
    weight: 0,
    scope: [],
    rationale: 'Modele non recurrent (vente unitaire, projet, B2G, services a l acte). Les KPI SaaS ne s appliquent pas. Voir verdict indicatorsIndustrial pour les metriques de remplacement.',
  };
}

function buildIndicatorsIndustrialVerdict(businessModel: BusinessModel): RelevanceVerdict {
  if (businessModel === 'unitary-sale' || businessModel === 'project-based' || businessModel === 'contract-b2g') {
    return {
      applicable: 'full',
      weight: 1,
      scope: ['margeBruteParUnite', 'cycleCommercial', 'carnetCommandes', 'workingCapitalRatio', 'capexParProjet', 'capaciteIndustrielle', 'tauxGainAppelsOffres'],
      rationale: 'Modele industriel ou par projet : indicateurs de fabrication-vente ou de cycle commercial long applicables.',
    };
  }
  return {
    applicable: 'none',
    weight: 0,
    scope: [],
    rationale: 'Modele non industriel. Voir indicatorsSaas pour les metriques de recurrence.',
  };
}

function buildSaasMetricsRetentionVerdict(businessModel: BusinessModel): RelevanceVerdict {
  if (businessModel === 'recurrent-saas' || businessModel === 'consumer-subscription') {
    return {
      applicable: 'full',
      weight: 1,
      scope: ['ndr', 'grr', 'churn', 'magicNumber'],
      rationale: 'Modele recurrent : NDR, GRR, churn et Magic Number sont structurellement pertinents.',
    };
  }
  return {
    applicable: 'none',
    weight: 0,
    scope: [],
    rationale: 'Modele non recurrent : les metriques de retention (NDR, GRR, churn) et Magic Number ne s appliquent pas. Le moteur saas-metrics-engine court-circuite.',
  };
}

function buildSaasMetricsUnitEconomicsVerdict(funnel: AcquisitionFunnel): RelevanceVerdict {
  if (funnel === 'present') {
    return {
      applicable: 'full',
      weight: 1,
      scope: ['cac', 'cvr', 'paybackCac'],
      rationale: 'Funnel d acquisition payante mesurable : CAC, CVR et Payback CAC pertinents. Extraction LLM dediee activee.',
    };
  }
  if (funnel === 'b2b-sales-led') {
    return {
      applicable: 'partial',
      weight: 0.4,
      scope: ['cycleVenteB2B', 'tauxConversionPipeline'],
      rationale: 'Vente B2B sales-led : pas de CAC marketing classique mais cycle de vente et taux de conversion pipeline restent pertinents.',
    };
  }
  return {
    applicable: 'none',
    weight: 0,
    scope: [],
    rationale: 'Pas de funnel d acquisition mesurable (B2G, projets uniques, appels d offre). Les metriques CAC / CVR / Payback ne s appliquent pas.',
  };
}

function buildValuationVcMethodVerdict(businessModel: BusinessModel): RelevanceVerdict {
  // Le verdict ici complete le filtre stage applique dans le moteur
  // valuation. Au seed pre-revenue, deja gere par le moteur. Pour
  // les modeles industriels lourds, la VC inverse classique (IRR
  // 30% sur 7 ans, exits sectoriels) est moins pertinente parce que
  // les exits ne sont pas representatifs.
  if (businessModel === 'project-based' || businessModel === 'contract-b2g') {
    return {
      applicable: 'partial',
      weight: 0.3,
      scope: ['ancrage qualitatif uniquement'],
      rationale: 'Modele a projet ou B2G : exits VC classiques peu representatifs. La VC inverse fournit un ancrage qualitatif, le central reste tire par les multiples sectoriels et les comparables industriels.',
    };
  }
  return {
    applicable: 'full',
    weight: 1,
    scope: [],
    rationale: 'Modele compatible avec la methode VC inverse standard.',
  };
}

function buildExecutionFrictionVerdict(productionChain: ProductionChain, supplyChainExposure: ExposureLevel): RelevanceVerdict {
  // Le moteur execution-friction est deja conditionnel via la
  // detection de huit flags internes. On preserve son mecanisme
  // mais on aligne le verdict avec la matrice : si chaine
  // physique ou supply chain forte, on attend une activation.
  if (productionChain === 'hardware-physical' || productionChain === 'infrastructure-physical' || productionChain === 'wet-biotech') {
    return {
      applicable: 'full',
      weight: 1,
      scope: [],
      rationale: 'Chaine de production physique ou biotech : friction commerciale et industrielle attendue, le moteur produit son output complet.',
    };
  }
  if (supplyChainExposure === 'high' || supplyChainExposure === 'medium') {
    return {
      applicable: 'full',
      weight: 1,
      scope: [],
      rationale: `Exposition supply chain ${supplyChainExposure} : friction supply chain pertinente.`,
    };
  }
  return {
    applicable: 'partial',
    weight: 0.3,
    scope: ['mecanisme interne moteur conserve'],
    rationale: 'Pas de signal structurel fort de friction. Le moteur applique son mecanisme interne de detection des huit flags et decide tout seul.',
  };
}

// ============================================================
// NARRATIVE DRIFT : DETECTION DE LA MATURITE NARRATIVE
// ------------------------------------------------------------
// La derive narrative est mesurable des qu il y a du discours
// accumule. Plus le stade est avance, plus la trace narrative
// est dense (interviews, communiques, posts fondateurs, decks
// successifs) et plus le signal est exploitable. Au pre-seed,
// le moteur tourne mais en lecture partielle : il n y a souvent
// que le pitch courant comme corpus, pas de baseline temporel.
// ============================================================

/**
 * Normalise le champ libre fundraise.stage en paliers exploitables.
 * Tolere les variantes francaises et anglaises.
 *
 * La granularite reconnait pre-seed, seed, series-a-early,
 * series-a-late, series-b, series-c, series-d, growth, pre-ipo.
 * Le palier series-a sans precision early/late retourne
 * series-a-early par defaut (palier conservateur : le moteur
 * Fragilite Structurelle ne se declenche pas en masse). Les
 * variantes "late series A", "post-product-market-fit", "pre-B"
 * basculent en series-a-late.
 */
function detectNarrativeMaturity(stageRaw: string | undefined | null): NarrativeMaturity {
  if (!stageRaw) return 'unknown';
  const s = stageRaw.toLowerCase().trim();

  // Pre-IPO et stages tardifs explicites
  if (/pre[-\s]?ipo|preipo|ipo\s*ready|tour pre-ipo/.test(s)) return 'pre-ipo';

  // Growth, late stage, capital de croissance
  if (/\bgrowth\b|late\s*stage|tour de croissance|capital de croissance|capital growth/.test(s)) return 'growth';

  // Series D
  if (/\bseries?[\s-]+d\b|\btour\s*d\b|\bround\s*d\b/.test(s)) return 'series-d';

  // Series C
  if (/\bseries?[\s-]+c\b|\btour\s*c\b|\bround\s*c\b/.test(s)) return 'series-c';

  // Series B
  if (/\bseries?[\s-]+b\b|\btour\s*b\b|\bround\s*b\b|pre[-\s]?c\b/.test(s)) return 'series-b';

  // Series A late : variantes signalant la phase post-PMF
  if (/late\s*series?\s*a|series?\s*a\s*late|post[-\s]?pmf|pre[-\s]?b\b|series?\s*a\s*plus|series?\s*a\s*\+|series?\s*a2|series?\s*a\.5/.test(s)) {
    return 'series-a-late';
  }

  // Series A : la base sans precision tombe en series-a-early
  if (/\bseries?[\s-]+a\b|\btour\s*a\b|\bround\s*a\b/.test(s)) {
    if (/early\s*series?\s*a|series?\s*a\s*early|series?\s*a1/.test(s)) return 'series-a-early';
    return 'series-a-early';
  }

  // Pre-seed explicite avant le pattern seed generique
  if (/pre[-\s]?seed|preseed|fondation|first money|friends\s*&\s*family|love\s*money/.test(s)) return 'pre-seed';

  // Seed et derives
  if (/seed|amorcage|amorçage|amorcement/.test(s)) {
    return 'seed';
  }

  return 'unknown';
}

function buildNarrativeDriftVerdict(maturity: NarrativeMaturity, hasMinimalCorpus: boolean): RelevanceVerdict {
  // Le moteur fait son propre check fin d applicabilite a partir
  // du nombre de mots reellement disponibles. Le verdict ici sert
  // juste a decider si on l invoque, et avec quel poids dans la
  // note d investissement. La regle transversale du Pipeline
  // Narrative Drift : des que l extraction expose au moins 200
  // mots de prose, le moteur tourne quel que soit le stade. Le
  // poids progresse avec la maturite narrative pour refleter la
  // valeur de la lecture (lecture instantanee a seed, glissement
  // mesurable a partir de series-a-late).
  if (!hasMinimalCorpus) {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Pas de corpus textuel exploitable dans l extraction (moins de 200 mots de prose). Le moteur de derive narrative a besoin d un minimum de matiere pour produire des metriques lexicales.',
    };
  }

  if (maturity === 'pre-ipo' || maturity === 'growth' || maturity === 'series-d' || maturity === 'series-c') {
    return {
      applicable: 'full',
      weight: 1,
      scope: [],
      rationale: 'Stade Series C ou ulterieur : narration accumulee sur plusieurs annees, baseline historique dense, signal de derive maximalement exploitable.',
    };
  }

  if (maturity === 'series-b') {
    return {
      applicable: 'full',
      weight: 0.95,
      scope: [],
      rationale: 'Stade Series B : narration accumulee sur deux ou trois ans, signal de glissement entre recit et fondamentaux exploitable avec confiance.',
    };
  }

  if (maturity === 'series-a-late') {
    return {
      applicable: 'full',
      weight: 0.85,
      scope: [],
      rationale: 'Stade Series A late : la matiere narrative s est consolidee post-PMF, les premiers ecarts entre recit fondateurs et fondamentaux sont mesurables.',
    };
  }

  if (maturity === 'series-a-early') {
    return {
      applicable: 'full',
      weight: 0.7,
      scope: [],
      rationale: 'Stade Series A early : narration suffisante pour produire une lecture transversale, glissement temporel encore court mais signal lexical interpretable.',
    };
  }

  if (maturity === 'seed') {
    return {
      applicable: 'partial',
      weight: 0.55,
      scope: ['lecture instantanee du langage'],
      rationale: 'Stade seed : narration trop jeune pour mesurer une derive temporelle. Le moteur produit une lecture instantanee de la densite concrete du discours, sans interpretation trajectoire.',
    };
  }

  if (maturity === 'pre-seed') {
    return {
      applicable: 'partial',
      weight: 0.35,
      scope: ['signal lexical brut'],
      rationale: 'Stade pre-seed : pas de baseline narratif, le moteur se contente d un signal lexical brut sur le pitch courant. A confirmer par re-evaluation au prochain tour.',
    };
  }

  return {
    applicable: 'partial',
    weight: 0.5,
    scope: ['lecture instantanee du langage'],
    rationale: 'Stade non identifiable : moteur lance en mode lecture instantanee, pertinence a ajuster manuellement par le partner.',
  };
}

// ============================================================
// FRAGILITE STRUCTURELLE : SEPT VERDICTS PATTERNS PHASE 4
// ------------------------------------------------------------
// Chaque pattern a sa propre logique d activation, calibree sur
// la doctrine ecrite dans docs/patterns/. La matrice declenche
// le pattern (full / partial / none) selon stade et secteur, le
// pattern lui-meme fait son check fin d applicabilite a partir
// du contenu du dossier.
//
// Les patterns Phase 4 ne remplacent pas les douze moteurs Bloc 1.
// Ils s y ajoutent pour les dossiers Series B et au-dela
// principalement, avec des activations precoces pour certains
// patterns specifiques (regulatory-time-bomb tous stades si
// secteur regule, commoditization-drift Series A si knowledge
// work).
// ============================================================

/**
 * Active a partir de Series A early en partial, full des Series A
 * late. Hors-scope sur les modeles ou la marge unitaire n est pas
 * mesurable (project-based, contract-b2g).
 */
function buildGrowthSubsidizedVerdict(maturity: NarrativeMaturity, businessModel: BusinessModel): RelevanceVerdict {
  if (businessModel === 'project-based' || businessModel === 'contract-b2g') {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Hors-scope : modele projet ou contrat-public, la marge unitaire n est pas la metrique pertinente.',
    };
  }
  if (isLateSeriesAOrAbove(maturity)) {
    const weight = maturity === 'series-a-late' ? 0.85 : narrativeDepthWeight(maturity);
    return {
      applicable: 'full',
      weight,
      scope: [],
      rationale: maturity === 'series-a-late'
        ? 'Series A late : matiere unit economics suffisante pour mesurer la subvention de croissance, pattern WeWork canonique active.'
        : 'Series B ou au-dela : moment ou Growth Subsidized devient pleinement diagnostique. Le pattern WeWork s exprime typiquement a partir de ce stade.',
    };
  }
  if (maturity === 'series-a-early') {
    return { applicable: 'partial', weight: 0.65, scope: ['lecture indicative unit economics'], rationale: 'Series A early : unit economics commencent a se materialiser mais souvent pas encore stabilisees, lecture indicative.' };
  }
  if (maturity === 'seed') {
    return { applicable: 'partial', weight: 0.5, scope: ['lecture indicative unit economics'], rationale: 'Stade seed : unit economics encore en construction, lecture indicative sur la trajectoire.' };
  }
  if (maturity === 'pre-seed') {
    return { applicable: 'partial', weight: 0.35, scope: ['lecture preventive'], rationale: 'Stade pre-seed : unit economics largement theoriques, pattern en lecture preventive.' };
  }
  return { applicable: 'partial', weight: 0.4, scope: ['lecture indicative'], rationale: 'Stade non identifiable : pattern lance en mode lecture indicative.' };
}

/**
 * Active des Series A early pour SaaS/IA (lecture wrappers LLM),
 * full des Series A late. Hors-scope hardware-physical et
 * infrastructure-physical (geopolitique deja couverte par
 * macroGeopolitical).
 */
function buildInfrastructureHostageVerdict(maturity: NarrativeMaturity, productionChain: ProductionChain): RelevanceVerdict {
  if (productionChain === 'hardware-physical' || productionChain === 'infrastructure-physical' || productionChain === 'wet-biotech') {
    return {
      applicable: 'partial',
      weight: 0.3,
      scope: ['couche logicielle ou cloud uniquement'],
      rationale: 'Modele hardware ou biotech : exposition fournisseur deja couverte par macroGeopolitical pour les composants strategiques. Le pattern reste actif sur la couche logicielle ou cloud non triviale si elle existe.',
    };
  }
  if (isLateSeriesAOrAbove(maturity)) {
    return {
      applicable: 'full',
      weight: maturity === 'series-a-late' ? 0.85 : narrativeDepthWeight(maturity),
      scope: [],
      rationale: maturity === 'series-a-late'
        ? 'Series A late : la stack technique est consolidee, l evaluation de la concentration fournisseur est diagnostique.'
        : 'Stade growth : la dependance s est generalement verrouillee dans le code et les contrats, le pattern est pleinement diagnostique.',
    };
  }
  if (maturity === 'series-a-early') {
    return { applicable: 'partial', weight: 0.65, scope: ['lecture stack en construction'], rationale: 'Series A early : la stack technique se forme, lecture utile sur les choix d infrastructure recents et la dependance LLM eventuelle.' };
  }
  if (maturity === 'seed') {
    return { applicable: 'partial', weight: 0.45, scope: ['lecture stack actuelle'], rationale: 'Stade seed : pattern utile principalement pour les wrappers d API LLM pure-play sans differenciation.' };
  }
  if (maturity === 'pre-seed') {
    return { applicable: 'partial', weight: 0.3, scope: ['lecture stack actuelle'], rationale: 'Stade pre-seed : stack pas encore formee, pattern actif uniquement pour les wrappers LLM purs.' };
  }
  return { applicable: 'partial', weight: 0.35, scope: ['lecture stack actuelle'], rationale: 'Stade non identifiable : pattern lance en mode lecture stack actuelle.' };
}

/**
 * Critique en Series B+ pour asset-heavy. Hors-scope SaaS pure
 * cloud (variabilisation rapide possible) et project-based.
 */
function buildFixedCostTrapVerdict(maturity: NarrativeMaturity, productionChain: ProductionChain, businessModel: BusinessModel): RelevanceVerdict {
  // SaaS pure cloud sans composante hardware lourde : fixed costs
  // dominees par payroll, generalement variabilisable. Hors scope
  // sauf cas specifique.
  if (productionChain === 'pure-software' && businessModel === 'recurrent-saas') {
    return {
      applicable: 'partial',
      weight: 0.3,
      scope: ['payroll et engagements long-terme uniquement'],
      rationale: 'SaaS pure cloud : fixed costs typiquement variabilisables (cloud downscaling, layoff). Pattern en lecture limitee sur les engagements long-terme contractuels eventuels.',
    };
  }
  if (businessModel === 'project-based' || businessModel === 'contract-b2g') {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Hors-scope : modele projet ou contrat-public, structure de couts intrinsequement consubstantielle au business.',
    };
  }
  if (maturity === 'series-b' || maturity === 'series-c' || maturity === 'series-d' || maturity === 'growth' || maturity === 'pre-ipo') {
    return { applicable: 'full', weight: maturity === 'series-b' ? 0.95 : 1, scope: [], rationale: 'Stade growth pour modele asset-heavy : moment ou Fixed Cost Trap est typiquement diagnostique. Pattern WeWork canonique.' };
  }
  if (maturity === 'series-a-late') {
    return { applicable: 'partial', weight: 0.7, scope: ['premiers engagements long-terme materialises'], rationale: 'Series A late : les premiers engagements long-terme sont contractes, le pattern devient mesurable.' };
  }
  if (maturity === 'series-a-early') {
    return { applicable: 'partial', weight: 0.45, scope: ['lecture des engagements emergents'], rationale: 'Series A early : les engagements long-terme commencent a se materialiser, lecture utile.' };
  }
  return {
    applicable: 'partial',
    weight: 0.3,
    scope: ['lecture indicative'],
    rationale: 'Stade precoce : peu d engagements long-terme typiquement, pattern en lecture indicative.',
  };
}

/**
 * Tous stades si secteur regule ou en zone grise. Hors-scope SaaS
 * B2B pur non regule, content marketplaces sans flux financier.
 *
 * La detection sectorielle est partielle : la matrice n a pas
 * acces a une categorisation reglementaire fine, le pattern fait
 * sa propre detection avec web search en aval.
 */
function buildRegulatoryTimeBombVerdict(text: string, businessModel: BusinessModel): RelevanceVerdict {
  // Mots-cles indicatifs de secteur regule. Pas exhaustif, le
  // pattern lui-meme verifie en aval. Word boundaries pour eviter
  // les faux positifs (ai dans paie ou plain).
  const reguleKeywords = /\b(finance|fintech|banque|bank|credit|paiement|payment|assurance|insurance|sante|health|biotech|pharma|defense|defence|telecom|crypto|blockchain|drone|autonomous|gig|livreur|chauffeur|driver|ai|artificial intelligence|machine learning|llm|foundation model)\b|ride[ -]?hailing|food delivery|airbnb|location courte duree|short[ -]?term rental/i;
  const isRegule = reguleKeywords.test(text);

  // Marketplaces et contract-b2g sont par nature regules ou en
  // contact direct avec le regulateur.
  const marketplaceOrPublic = businessModel === 'marketplace' || businessModel === 'contract-b2g';

  if (!isRegule && !marketplaceOrPublic) {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Aucune exposition réglementaire significative détectée au pre-screen sur ce secteur. Le pattern peut être activé manuellement par le partner si une nuance sectorielle le justifie.',
    };
  }
  // Secteur regule : pattern actif a tous stades, full
  return {
    applicable: 'full',
    weight: 0.85,
    scope: [],
    rationale: `Secteur regule ou en zone grise detecte (${marketplaceOrPublic ? 'marketplace ou contrat public' : 'mots-cles reglementaires presents'}). Pattern actif independamment du stade : une regulation a venir frappe la jeune boite avec la meme force que la mature.`,
  };
}

/**
 * Active des Series A pour knowledge work et SaaS. Full Series B+
 * avec poids special pour les SaaS verticaux ergonomiques.
 * Hors-scope hardware-physical et services a forte composante
 * physique.
 */
function buildCommoditizationDriftVerdict(maturity: NarrativeMaturity, productionChain: ProductionChain, businessModel: BusinessModel): RelevanceVerdict {
  if (productionChain === 'hardware-physical' || productionChain === 'infrastructure-physical' || productionChain === 'wet-biotech') {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Hors-scope : modele physique, valeur produite necessite presence operationnelle terrain non automatisable a court terme.',
    };
  }
  if (businessModel === 'project-based' || businessModel === 'contract-b2g') {
    return {
      applicable: 'partial',
      weight: 0.4,
      scope: ['couche cognitive du contrat uniquement'],
      rationale: 'Modele projet ou contrat-public : la commoditisation IA peut attaquer la couche conseil ou production cognitive, mais pas la relation contractuelle elle-meme.',
    };
  }
  if (isLateSeriesAOrAbove(maturity)) {
    return {
      applicable: 'full',
      weight: maturity === 'series-a-late' ? 0.85 : narrativeDepthWeight(maturity),
      scope: [],
      rationale: maturity === 'series-a-late'
        ? 'Series A late pour knowledge work : la position concurrentielle est consolidee, l erosion par les outils IA generalistes est mesurable.'
        : 'Growth pour knowledge work : moment ou les moats sont censes tenir et ou la valorisation suppose leur robustesse face aux outils IA.',
    };
  }
  if (maturity === 'series-a-early') {
    return { applicable: 'full', weight: 0.7, scope: [], rationale: 'Series A early pour knowledge work : la position concurrentielle commence a se cristalliser, l erosion devient observable.' };
  }
  return { applicable: 'partial', weight: 0.5, scope: ['lecture moats actuels'], rationale: 'Stade seed/precoce : pattern utile pour identifier les wrappers IA pure-play sans differenciation des le pre-seed.' };
}

/**
 * Critique en Series B+. Pertinent en Series A si premieres
 * preferences creatives accumulees. Independant du business model
 * parce que la cap table est un sujet equity, pas operationnel.
 */
function buildCapitalStructureFragilityVerdict(maturity: NarrativeMaturity): RelevanceVerdict {
  if (maturity === 'pre-ipo' || maturity === 'growth' || maturity === 'series-d' || maturity === 'series-c') {
    return { applicable: 'full', weight: 1, scope: [], rationale: 'Stade growth ou pre-IPO : la complexite cap table s est accumulee de maniere combinatoire de tour en tour. Pattern critique a l approche d un exit et lors d un down round potentiel.' };
  }
  if (maturity === 'series-b') {
    return { applicable: 'full', weight: 0.9, scope: [], rationale: 'Series B : les preferences contractuelles se sont stratifiees sur trois tours, le risque structurel cap table devient diagnostique.' };
  }
  if (maturity === 'series-a-late') {
    return { applicable: 'full', weight: 0.75, scope: [], rationale: 'Series A late : trois rounds de preferences accumulees, le pattern devient mesurable en propre.' };
  }
  if (maturity === 'series-a-early') {
    return { applicable: 'partial', weight: 0.45, scope: ['premieres preferences accumulees'], rationale: 'Series A early : pattern actif si premieres preferences creatives au seed, sinon en lecture preventive sur la term sheet courante.' };
  }
  return {
    applicable: 'partial',
    weight: 0.3,
    scope: ['lecture preventive term sheet courante'],
    rationale: 'Stade precoce : peu de complexite typiquement, pattern actif en lecture preventive sur la term sheet en cours de negociation.',
  };
}

/**
 * Active des Series A pour deeptech/hardware/industriel. Critique
 * Series B+ ou s engage typiquement l industrialisation. Hors-scope
 * SaaS pure cloud, services pure, content marketplaces.
 */
function buildScaleMirageRiskVerdict(maturity: NarrativeMaturity, productionChain: ProductionChain): RelevanceVerdict {
  if (productionChain === 'pure-software') {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Hors-scope : pure software sans capex industriel. Le pattern reste activable manuellement si data centers proprietaires significatifs.',
    };
  }
  if (isLateSeriesAOrAbove(maturity)) {
    return {
      applicable: 'full',
      weight: maturity === 'series-a-late' ? 0.8 : narrativeDepthWeight(maturity),
      scope: [],
      rationale: maturity === 'series-a-late'
        ? 'Series A late pour deeptech ou hardware : la these de mise a l echelle industrielle se materialise, le pattern detecte le mirage de calibration.'
        : 'Stade growth pour modele industriel : moment ou s engage typiquement l industrialisation. Pattern Ynsect canonique.',
    };
  }
  if (maturity === 'series-a-early') {
    return { applicable: 'partial', weight: 0.6, scope: ['lecture plan industrialisation'], rationale: 'Series A early pour deeptech ou hardware : le plan d industrialisation est generalement detaille dans la levee, lecture pre-industrialisation.' };
  }
  if (maturity === 'seed') {
    return { applicable: 'partial', weight: 0.4, scope: ['lecture plan industrialisation'], rationale: 'Stade seed : capex pas encore engages mais le plan d industrialisation est lisible et evaluable.' };
  }
  if (maturity === 'pre-seed') {
    return { applicable: 'partial', weight: 0.3, scope: ['lecture plan industrialisation'], rationale: 'Stade pre-seed : plan d industrialisation encore theorique, lecture preventive sur la calibration declaree.' };
  }
  return { applicable: 'partial', weight: 0.3, scope: ['lecture plan industrialisation'], rationale: 'Stade non identifiable : lecture du plan industrialisation declare.' };
}

// ============================================================
// DERIVATION DE L ASSET CLASS DEPUIS LA CHAINE DE PRODUCTION
// ------------------------------------------------------------
// La classe d actif ne doit jamais contredire la chaine de production
// detectee sur le corpus complet du dossier. Un dossier dont le
// productionChain est hardware-physical ne peut pas ressortir en
// saas-b2b, meme si le sector extrait par le LLM est lacunaire ou
// francophone (cas Platypus Craft : sector "Nautique" sans keyword
// reconnu, retombait en saas-b2b par defaut dans normalizeAssetClass,
// pollluait valuation et comparables historiques).
//
// Regle structurelle. La fonction prend l indice sectoriel
// normalizeAssetClass, le confronte au productionChain detecte sur le
// texte exhaustif (rawSummary + productDescription + businessModel +
// marketPitch), et arbitre :
//   - hardware-physical / infrastructure-physical : industrial-hardware
//     par defaut, sauf indices forts vers defense / climate-tech /
//     deeptech qui prennent la main.
//   - wet-biotech : healthtech ou deeptech selon les keywords biotech
//     R&D vs medtech.
//   - regulated-service : healthtech / fintech / services-b2b selon
//     le contexte texte.
//   - pure-software : preserve l indice si reconnu (saas-b2b, fintech,
//     cybersecurity, etc.), sinon saas-b2b (la signature software
//     ETANT le signal).
//   - content-media : mediatech.
//   - unknown : on conserve l indice tel quel, y compris 'unclassified'
//     si rien n a matche. Pas de promotion silencieuse vers saas-b2b.
// ============================================================
function deriveAssetClass(
  productionChain: ProductionChain,
  rawAssetClass: string,
  searchableText: string,
): string {
  const hint = normalizeAssetClass(rawAssetClass);
  const t = searchableText; // deja normalise lowercase + sans diacritiques

  // Helpers de detection thematique sur le texte complet.
  const hasDefenseSignal = /\b(defense|defence|militaire|military|dual.use|aerospace|armement|drone militaire)\b/.test(t);
  const hasClimateSignal = /\b(climate|cleantech|greentech|decarbon|carbon capture|hydrogene|renouvelable|energie marine|marine energy|ocean energy|emr|solaire|eolien|hydrolien|photovoltaique)\b/.test(t);
  const hasDeeptechSignal = /\b(quantum|fusion|semiconducteur|semiconductor|materials|materiaux avances|crispr|nanotech|deep tech|deeptech|biotech)\b/.test(t);
  const hasMedtechSignal = /\b(medical|medecin|medecine|sante|health|clinique|hopital|dispositif medical|medtech|pharma|essai clinique)\b/.test(t);
  const hasFintechSignal = /\b(banque|banking|bank|paiement|payment|insurtech|assurance|lending|credit|fintech)\b/.test(t);

  switch (productionChain) {
    case 'hardware-physical': {
      // Signal sectoriel reconnu cote hardware : on respecte l indice.
      if (hint === 'defense' || hint === 'climate-tech' || hint === 'deeptech'
        || hint === 'industrial-hardware' || hint === 'healthtech') {
        return hint;
      }
      // Sinon on arbitre par le texte.
      if (hasDefenseSignal) return 'defense';
      if (hasDeeptechSignal) return 'deeptech';
      if (hasClimateSignal) return 'climate-tech';
      if (hasMedtechSignal) return 'healthtech';
      return 'industrial-hardware';
    }
    case 'infrastructure-physical': {
      if (hint === 'climate-tech' || hint === 'industrial-hardware'
        || hint === 'defense' || hint === 'deeptech') {
        return hint;
      }
      if (hasClimateSignal) return 'climate-tech';
      if (hasDefenseSignal) return 'defense';
      return 'industrial-hardware';
    }
    case 'wet-biotech': {
      if (hint === 'deeptech' || hint === 'healthtech') return hint;
      if (hasMedtechSignal) return 'healthtech';
      return 'deeptech';
    }
    case 'regulated-service': {
      if (hint === 'healthtech' || hint === 'fintech'
        || hint === 'services-b2b' || hint === 'edtech') {
        return hint;
      }
      if (hasMedtechSignal) return 'healthtech';
      if (hasFintechSignal) return 'fintech';
      return 'services-b2b';
    }
    case 'content-media': {
      if (hint === 'mediatech' || hint === 'adtech' || hint === 'sportstech') return hint;
      return 'mediatech';
    }
    case 'pure-software': {
      // Indice reconnu : on le conserve. Sinon, la signature software
      // legitime la classe saas-b2b comme defaut applicable.
      if (hint !== 'unclassified') return hint;
      return 'saas-b2b';
    }
    case 'unknown':
    default:
      // Pas de fallback silencieux : on garde l indice tel quel,
      // 'unclassified' inclus, pour que la valuation et les indicateurs
      // se declarent non applicables plutot que de simuler un
      // ancrage SaaS factice.
      return hint;
  }
}

// ============================================================
// POINT D ENTREE
// ============================================================

/**
 * Calcule la matrice de pertinence complete du dossier. Toutes les
 * decisions sont deterministes. La matrice est ensuite consommee par
 * chaque moteur Bloc 1 pour scoper son comportement.
 *
 * Source de verite unique pour l asset class : la matrice arbitre
 * entre l indice sectoriel (extraction.sector + subSector) et le
 * productionChain detecte sur le texte complet. Les moteurs aval
 * (valuation, indicateurs, comparables historiques) lisent
 * matrix.assetClass, ils ne re-derivent plus de leur cote.
 */
export function computeRelevanceMatrix(extraction: ExtractionOutput, assetClass: string): RelevanceMatrix {
  const text = buildSearchableText(extraction);

  // Calcul des criteres dans l ordre de dependance
  const businessModel = detectBusinessModel(text);
  const productionChain = detectProductionChain(text);

  // Arbitrage assetClass : l indice sectoriel passe en argument peut
  // etre lacunaire (vocabulaire FR non reconnu, secteur extrait
  // partiellement). On le confronte au productionChain detecte sur le
  // texte complet pour garantir qu un dossier hardware-physical ne
  // ressort jamais en saas-b2b par accident. Voir deriveAssetClass et
  // bug Platypus Craft, mai 2026.
  const resolvedAssetClass = deriveAssetClass(productionChain, assetClass, text);
  const supplyChain = detectSupplyChainExposure(text);
  const macroSensitivity = detectMacroSensitivity(text, businessModel);
  const geopolitical = detectGeopoliticalExposure(text, supplyChain);
  const reproducibility = detectDigitalReproducibility(text, productionChain);
  const acquisitionFunnel = detectAcquisitionFunnel(text, businessModel);

  // Maturite narrative pour le verdict narrativeDrift. Le seuil
  // d activation est doctrinal : le moteur tourne transversalement
  // des que l extraction expose au moins 200 mots de prose, peu
  // importe le stade. Avant ce seuil, la matiere lexicale est trop
  // courte pour produire un signal interpretable.
  const narrativeMaturity = detectNarrativeMaturity(extraction.fundraise?.stage);
  const corpusBuffer = [
    extraction.marketPitch,
    extraction.productDescription,
    extraction.businessModel,
    extraction.rawSummary,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  const corpusWordCount = corpusBuffer ? corpusBuffer.split(/\s+/).filter(w => w.length > 0).length : 0;
  const hasMinimalCorpus = corpusWordCount >= 200;

  // Construction des verdicts par moteur
  const verdicts = {
    macroGeopolitical: buildMacroGeopoliticalVerdict(geopolitical.level, geopolitical.factors),
    macroCyclical: buildMacroCyclicalVerdict(macroSensitivity.level, macroSensitivity.factors),
    marketAiReplicability: buildMarketAiReplicabilityVerdict(reproducibility.level, reproducibility.factors, productionChain),
    marketAiBusinessModel: buildMarketAiBusinessModelVerdict(productionChain, text),
    indicatorsSaas: buildIndicatorsSaasVerdict(businessModel),
    indicatorsIndustrial: buildIndicatorsIndustrialVerdict(businessModel),
    saasMetricsRetention: buildSaasMetricsRetentionVerdict(businessModel),
    saasMetricsUnitEconomics: buildSaasMetricsUnitEconomicsVerdict(acquisitionFunnel),
    valuationVcMethod: buildValuationVcMethodVerdict(businessModel),
    executionFriction: buildExecutionFrictionVerdict(productionChain, supplyChain.level),
    narrativeDrift: buildNarrativeDriftVerdict(narrativeMaturity, hasMinimalCorpus),
    fragiliteStructurelle: {
      'growth-subsidized-model': buildGrowthSubsidizedVerdict(narrativeMaturity, businessModel),
      'infrastructure-hostage': buildInfrastructureHostageVerdict(narrativeMaturity, productionChain),
      'fixed-cost-trap': buildFixedCostTrapVerdict(narrativeMaturity, productionChain, businessModel),
      'regulatory-time-bomb': buildRegulatoryTimeBombVerdict(text, businessModel),
      'commoditization-drift': buildCommoditizationDriftVerdict(narrativeMaturity, productionChain, businessModel),
      'capital-structure-fragility': buildCapitalStructureFragilityVerdict(narrativeMaturity),
      'scale-mirage-risk': buildScaleMirageRiskVerdict(narrativeMaturity, productionChain),
    },
  };

  return {
    assetClass: resolvedAssetClass,
    businessModel,
    productionChain,
    supplyChainExposure: supplyChain.level,
    supplyChainExposureFactors: supplyChain.factors,
    macroSensitivity: macroSensitivity.level,
    macroSensitivityFactors: macroSensitivity.factors,
    geopoliticalExposure: geopolitical.level,
    geopoliticalExposureFactors: geopolitical.factors,
    digitalReproducibility: reproducibility.level,
    digitalReproducibilityFactors: reproducibility.factors,
    acquisitionFunnel,
    verdicts,
  };
}

/**
 * Expose la detection de maturite narrative pour les tests et pour
 * d eventuels usages downstream qui voudraient lire la categorie sans
 * recalculer la matrice complete.
 */
export { detectNarrativeMaturity };
