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

// Niveau de maturite narrative deductible du stade declare. Sert
// uniquement pour le verdict narrativeDrift : plus le stade est
// avance, plus la matiere narrative accumulee est consistante et
// plus le moteur a de quoi mordre.
export type NarrativeMaturity = 'pre-seed' | 'seed' | 'series-a' | 'series-b-plus' | 'unknown';

// ============================================================
// HELPERS
// ============================================================

/**
 * Concatene les champs textuels exploitables de l extraction en
 * une seule chaine lower-case pour la detection par keywords.
 */
function buildSearchableText(ext: ExtractionOutput): string {
  // Normalisation lowercase + suppression diacritiques pour que
  // les keywords non accentues capturent les libelles accentues
  // (santé, énergie, défense). Voir lib/data/text-normalize.ts.
  return normalizeFrText([
    ext.sector,
    ext.subSector,
    ext.marketPitch,
    ext.productDescription,
    ext.businessModel,
    ext.rawSummary,
    ext.country,
    ext.geographicHub,
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

// Chaines de production hardware physique (fabrication d objets,
// pas du logiciel ni des services).
const HARDWARE_PHYSICAL_KEYWORDS = [
  'hardware', 'manufacturing', 'usine', 'fabrication',
  'fabrique', 'fabriqu', 'industrialis', 'serie',
  'prototype', 'composant', 'assemblage', 'capteur',
  'electronique', 'électronique', 'mecanique', 'mécanique',
  'machine', 'equipement', 'équipement', 'piece', 'pièce',
  'drone', 'vehicule', 'véhicule', 'sous-marin',
  'aeronef', 'aéronef', 'navire', 'bateau', 'foilboard',
  'sup', 'paddle', 'submersible', 'semi-submersible',
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

// Services regules a forte barriere humaine reglementaire.
const REGULATED_SERVICE_KEYWORDS = [
  'avocat', 'cabinet d avocats', 'barreau',
  'expert-comptable', 'commissaire aux comptes',
  'conseil en investissement', 'cif',
  'banque', 'etablissement de credit',
  'assurance', 'courtier en assurance',
  'medecin', 'médecin', 'ordre des medecins',
  'pharmacien', 'pharmacie',
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

// Modele recurrent SaaS classique.
const RECURRENT_SAAS_KEYWORDS = [
  'saas', 'software as a service',
  'arr', 'mrr', 'abonnement b2b', 'subscription b2b',
  'b2b saas', 'subscription model',
  'license recurrente', 'licence récurrente',
];

// Subscription consumer (B2C abonnement).
const CONSUMER_SUBSCRIPTION_KEYWORDS = [
  'abonnement b2c', 'abonnement consumer',
  'subscription b2c', 'consumer subscription',
  'abonnement mensuel', 'box mensuelle',
  'streaming consumer', 'app freemium',
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
    'etat', 'état', 'public', 'collectivite', 'collectivité',
    'ministere', 'ministère', 'defense', 'défense',
    'gendarmerie', 'police', 'armee', 'armée',
    'agence nationale', 'parapublic',
  ]);

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

  // Si plusieurs modeles co-existent au meme score top, c est un
  // hybride (ex: vente unitaire + abonnement dashboard, marque DTC
  // vente + abonnement box). Si le top est dominant meme par un
  // seul point, on tranche pour la categorie dominante.
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
 */
function detectProductionChain(text: string): ProductionChain {
  const hardware = countMatches(text, HARDWARE_PHYSICAL_KEYWORDS);
  const infra = countMatches(text, INFRASTRUCTURE_PHYSICAL_KEYWORDS);
  const biotech = countMatches(text, WET_BIOTECH_KEYWORDS);
  const regulated = countMatches(text, REGULATED_SERVICE_KEYWORDS);
  const content = countMatches(text, CONTENT_MEDIA_KEYWORDS);

  // Infrastructure prioritaire sur hardware si les deux matchent
  // (genie maritime contient des keywords hardware aussi).
  if (infra >= 2 && infra >= hardware) return 'infrastructure-physical';
  if (hardware >= 2) return 'hardware-physical';
  if (biotech >= 2) return 'wet-biotech';
  if (regulated >= 2) return 'regulated-service';
  if (content >= 2) return 'content-media';

  // Cas par defaut : pure-software si rien de physique detecte et
  // que le texte mentionne les keywords logiciel.
  if (containsAny(text, ['saas', 'software', 'application', 'plateforme web', 'app mobile', 'mobile app', 'cloud', 'api '])) {
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
 * Normalise le champ libre fundraise.stage en cinq paliers
 * exploitables. Tolere les variantes francaises et anglaises.
 */
function detectNarrativeMaturity(stageRaw: string | undefined | null): NarrativeMaturity {
  if (!stageRaw) return 'unknown';
  const s = stageRaw.toLowerCase().trim();

  // Series B et au-dela : narration accumulee, dense, exploitable
  if (/\bseries?[\s-]+[b-z]\b/.test(s)) return 'series-b-plus';
  if (/growth|late\s*stage|tour de croissance|capital de croissance/.test(s)) return 'series-b-plus';

  // Series A : narration suffisante pour mesurer un glissement
  if (/\bseries?[\s-]+a\b/.test(s) || /\btour\s*a\b/.test(s) || /\bround\s*a\b/.test(s)) return 'series-a';

  // Seed et derives
  if (/seed|amorcage|amorçage|amorcement/.test(s)) {
    if (/pre[-\s]?seed|preseed/.test(s)) return 'pre-seed';
    return 'seed';
  }

  // Pre-seed explicite
  if (/pre[-\s]?seed|preseed|fondation|first money/.test(s)) return 'pre-seed';

  return 'unknown';
}

function buildNarrativeDriftVerdict(maturity: NarrativeMaturity, hasMinimalCorpus: boolean): RelevanceVerdict {
  // Le moteur fait son propre check fin d applicabilite a partir
  // du nombre de mots reellement disponibles. Le verdict ici
  // sert juste a decider si on l invoque, et avec quel poids
  // dans la note d investissement.
  if (!hasMinimalCorpus) {
    return {
      applicable: 'none',
      weight: 0,
      scope: [],
      rationale: 'Pas de corpus textuel exploitable dans l extraction. Le moteur de derive narrative a besoin d un minimum de prose pour produire des metriques lexicales.',
    };
  }

  if (maturity === 'series-b-plus') {
    return {
      applicable: 'full',
      weight: 1,
      scope: [],
      rationale: 'Stade Series B ou ulterieur : narration accumulee sur plusieurs annees, baseline historique probable, signal de derive maximalement exploitable.',
    };
  }

  if (maturity === 'series-a') {
    return {
      applicable: 'full',
      weight: 0.85,
      scope: [],
      rationale: 'Stade Series A : matiere narrative suffisante pour mesurer un glissement abstrait/concret et identifier les premiers ecarts entre recit et fondamentaux.',
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
 * Active a partir de Series A en partial, Series B+ en full.
 * Hors-scope sur les modeles ou la marge unitaire n est pas
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
  if (maturity === 'series-b-plus') {
    return { applicable: 'full', weight: 1, scope: [], rationale: 'Series B et au-dela : moment ou Growth Subsidized devient diagnostique. Le pattern WeWork s exprime typiquement a partir de ce stade.' };
  }
  if (maturity === 'series-a') {
    return { applicable: 'full', weight: 0.85, scope: [], rationale: 'Series A : matiere unit economics suffisante pour mesurer la subvention de croissance.' };
  }
  if (maturity === 'seed') {
    return { applicable: 'partial', weight: 0.5, scope: ['lecture indicative unit economics'], rationale: 'Stade seed : unit economics encore en construction, lecture indicative sur la trajectoire.' };
  }
  return { applicable: 'partial', weight: 0.4, scope: ['lecture indicative'], rationale: 'Stade non identifiable : pattern lance en mode lecture indicative.' };
}

/**
 * Active des Series A pour SaaS/IA, full des Series B+. Hors-scope
 * hardware-physical et infrastructure-physical (geopolitique deja
 * couverte par macroGeopolitical).
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
  if (maturity === 'series-b-plus') {
    return { applicable: 'full', weight: 1, scope: [], rationale: 'Stade growth : la dependance s est generalement verrouillee dans le code et les contrats, le pattern est pleinement diagnostique.' };
  }
  if (maturity === 'series-a') {
    return { applicable: 'full', weight: 0.85, scope: [], rationale: 'Series A : la stack technique est suffisamment formee pour evaluer la concentration des fournisseurs.' };
  }
  if (maturity === 'seed') {
    return { applicable: 'partial', weight: 0.45, scope: ['lecture stack actuelle'], rationale: 'Stade seed : pattern utile principalement pour les wrappers d API LLM pure-play sans differenciation.' };
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
  if (maturity === 'series-b-plus') {
    return { applicable: 'full', weight: 1, scope: [], rationale: 'Stade growth pour modele asset-heavy : moment ou Fixed Cost Trap est typiquement diagnostique. Pattern WeWork canonique.' };
  }
  if (maturity === 'series-a') {
    return { applicable: 'partial', weight: 0.55, scope: ['premiers engagements long-terme'], rationale: 'Series A : les engagements long-terme commencent a se materialiser, lecture utile.' };
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
      rationale: 'Secteur sans exposition reglementaire significative detectable au pre-screen. Le pattern reste activable manuellement par le partner si necessaire.',
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
  if (maturity === 'series-b-plus') {
    return { applicable: 'full', weight: 1, scope: [], rationale: 'Growth pour knowledge work : moment ou les moats sont censes tenir et ou la valorisation suppose leur robustesse face aux outils IA.' };
  }
  if (maturity === 'series-a') {
    return { applicable: 'full', weight: 0.85, scope: [], rationale: 'Series A pour knowledge work : la position concurrentielle commence a se cristalliser, l erosion est mesurable.' };
  }
  return { applicable: 'partial', weight: 0.5, scope: ['lecture moats actuels'], rationale: 'Stade seed/precoce : pattern utile pour identifier les wrappers IA pure-play sans differenciation des le pre-seed.' };
}

/**
 * Critique en Series B+. Pertinent en Series A si premieres
 * preferences creatives accumulees. Independant du business model
 * parce que la cap table est un sujet equity, pas operationnel.
 */
function buildCapitalStructureFragilityVerdict(maturity: NarrativeMaturity): RelevanceVerdict {
  if (maturity === 'series-b-plus') {
    return { applicable: 'full', weight: 1, scope: [], rationale: 'Stade growth : la complexite cap table s accumule de maniere combinatoire de tour en tour. Pattern critique en pre-IPO et lors d un down round potentiel.' };
  }
  if (maturity === 'series-a') {
    return { applicable: 'partial', weight: 0.55, scope: ['premieres preferences accumulees'], rationale: 'Series A : pattern actif si premieres preferences creatives au seed, sinon en lecture preventive sur la term sheet courante.' };
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
  if (maturity === 'series-b-plus') {
    return { applicable: 'full', weight: 1, scope: [], rationale: 'Stade growth pour modele industriel : moment ou s engage typiquement l industrialisation. Pattern Ynsect canonique.' };
  }
  if (maturity === 'series-a') {
    return { applicable: 'full', weight: 0.8, scope: [], rationale: 'Series A pour deeptech ou hardware : la these de mise a l echelle industrielle est souvent au coeur de la levee, le pattern detecte le mirage de calibration.' };
  }
  if (maturity === 'seed') {
    return { applicable: 'partial', weight: 0.4, scope: ['lecture plan industrialisation'], rationale: 'Stade seed : capex pas encore engages mais le plan d industrialisation est lisible et evaluable.' };
  }
  return { applicable: 'partial', weight: 0.3, scope: ['lecture plan industrialisation'], rationale: 'Stade non identifiable : lecture du plan industrialisation declare.' };
}

// ============================================================
// POINT D ENTREE
// ============================================================

/**
 * Calcule la matrice de pertinence complete du dossier. Toutes les
 * decisions sont deterministes. La matrice est ensuite consommee par
 * chaque moteur Bloc 1 pour scoper son comportement.
 */
export function computeRelevanceMatrix(extraction: ExtractionOutput, assetClass: string): RelevanceMatrix {
  const text = buildSearchableText(extraction);

  // Calcul des criteres dans l ordre de dependance
  const businessModel = detectBusinessModel(text);
  const productionChain = detectProductionChain(text);
  const supplyChain = detectSupplyChainExposure(text);
  const macroSensitivity = detectMacroSensitivity(text, businessModel);
  const geopolitical = detectGeopoliticalExposure(text, supplyChain);
  const reproducibility = detectDigitalReproducibility(text, productionChain);
  const acquisitionFunnel = detectAcquisitionFunnel(text, businessModel);

  // Maturite narrative pour le verdict narrativeDrift. Le test de
  // corpus minimal regarde si l extraction contient au moins du
  // texte exploitable (pas seulement des champs vides).
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
  const hasMinimalCorpus = corpusBuffer.length >= 40;

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
    assetClass,
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
