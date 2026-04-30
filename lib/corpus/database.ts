// Base de données structurée du corpus de 32 cas historiques
// Chaque fiche est un objet exploitable par les moteurs

export type Archetype = 'interpretive' | 'depth' | 'capacity' | 'cumulative-mid' | 'cumulative-long';

export interface CaseRecord {
  id: string;
  num: string;
  name: string;
  country: string;
  geographicHub: string;
  sector: string;
  subSector: string;
  yearFounded: number;
  yearOfRefusal: number;
  archetype: Archetype;
  blindspots: string[];
  proxies: string[];
  // Attributs structurels pour matching
  teamProfile: {
    foundersCount: number;
    pedigreeCanonical: boolean;
    averageAge: 'young' | 'mid' | 'senior';
    sectorExperience: 'high' | 'medium' | 'low' | 'transversal';
    riskTaken: 'high' | 'medium' | 'low';
  };
  marketProfile: {
    perceivedSize: 'massive' | 'large' | 'niche';
    realIntensity: 'extreme' | 'high' | 'medium';
    saturation: 'saturated' | 'fragmented' | 'emerging';
    regulatoryComplexity: 'high' | 'medium' | 'low';
    capitalIntensity: 'high' | 'medium' | 'low';
  };
  macroAtRefusal: {
    cyclePosition: 'pre-bascule' | 'bascule' | 'post-bascule' | 'mature';
    geopolitics: 'stable' | 'tensions' | 'rupture';
    vcCapital: 'underweight' | 'balanced' | 'overweight';
  };
  retrospectiveScore: number; // 0-100, score que la plateforme aurait donné en pré-bascule
  outcome: 'unicorn' | 'public' | 'acquired' | 'leader-segment';
  comparablePatterns: string[]; // Patterns transversaux pour matching
}

export const CORPUS: CaseRecord[] = [
  {
    id: 'helsing',
    num: '001',
    name: 'Helsing',
    country: 'Allemagne',
    geographicHub: 'Munich',
    sector: 'Défense',
    subSector: 'Logiciel défense IA',
    yearFounded: 2021,
    yearOfRefusal: 2021,
    archetype: 'interpretive',
    blindspots: ['marche-classe-hors-these', 'pedigree-non-canonique', 'anti-fragilite-collective', 'timing-pre-bascule'],
    proxies: ['autorite-pairs-tour', 'couverture-systemique-equipe', 'anti-fragilite-collective'],
    teamProfile: {
      foundersCount: 3, pedigreeCanonical: false, averageAge: 'mid',
      sectorExperience: 'transversal', riskTaken: 'high'
    },
    marketProfile: {
      perceivedSize: 'niche', realIntensity: 'extreme',
      saturation: 'emerging', regulatoryComplexity: 'high', capitalIntensity: 'high'
    },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'tensions', vcCapital: 'underweight' },
    retrospectiveScore: 88,
    outcome: 'unicorn',
    comparablePatterns: ['defense-eu-pre-ukraine', 'scientifique-au-defense', 'mafia-deep-tech']
  },
  {
    id: 'doctolib',
    num: '002',
    name: 'Doctolib',
    country: 'France',
    geographicHub: 'Paris',
    sector: 'Santé',
    subSector: 'Santé numérique B2B2C',
    yearFounded: 2013,
    yearOfRefusal: 2013,
    archetype: 'depth',
    blindspots: ['intensite-besoin-sous-evaluee', 'transposition-experience-non-lue', 'jeunesse-penalisee'],
    proxies: ['intensite-besoin-signaux-organiques', 'transposition-experience-secteurs-analogues', 'qualite-fundraise-anti-fragilite'],
    teamProfile: {
      foundersCount: 3, pedigreeCanonical: false, averageAge: 'young',
      sectorExperience: 'transversal', riskTaken: 'medium'
    },
    marketProfile: {
      perceivedSize: 'niche', realIntensity: 'extreme',
      saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'medium'
    },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 85,
    outcome: 'unicorn',
    comparablePatterns: ['marche-regule-francais', 'intensite-vs-taille', 'transposition-marketplace']
  },
  {
    id: 'mistral',
    num: '003',
    name: 'Mistral AI',
    country: 'France',
    geographicHub: 'Paris',
    sector: 'IA',
    subSector: 'IA générative LLM',
    yearFounded: 2023,
    yearOfRefusal: 2023,
    archetype: 'capacity',
    blindspots: ['capacite-ticket-insuffisante', 'velocite-decision-insuffisante', 'conviction-souverainete'],
    proxies: ['signature-scientifique-equipe', 'fenetre-temporelle-critique', 'signature-business-angel-conviction'],
    teamProfile: {
      foundersCount: 3, pedigreeCanonical: true, averageAge: 'mid',
      sectorExperience: 'high', riskTaken: 'medium'
    },
    marketProfile: {
      perceivedSize: 'massive', realIntensity: 'extreme',
      saturation: 'emerging', regulatoryComplexity: 'medium', capitalIntensity: 'high'
    },
    macroAtRefusal: { cyclePosition: 'bascule', geopolitics: 'tensions', vcCapital: 'overweight' },
    retrospectiveScore: 92,
    outcome: 'unicorn',
    comparablePatterns: ['fenetre-fondation-critique', 'scientifique-deep-tech', 'defaut-leadership-eu']
  },
  {
    id: 'quantum',
    num: '004',
    name: 'Quantum Systems',
    country: 'Allemagne',
    geographicHub: 'Munich',
    sector: 'Défense',
    subSector: 'Drones hardware ISR',
    yearFounded: 2015,
    yearOfRefusal: 2015,
    archetype: 'cumulative-mid',
    blindspots: ['geographie-sous-ponderee', 'pedigree-inclassable', 'hardware-software-penalise', 'dual-use-mal-lu'],
    proxies: ['reference-client-institutionnel', 'resilience-longitudinale', 'potentiel-bascule-macro'],
    teamProfile: {
      foundersCount: 3, pedigreeCanonical: false, averageAge: 'mid',
      sectorExperience: 'transversal', riskTaken: 'medium'
    },
    marketProfile: {
      perceivedSize: 'niche', realIntensity: 'high',
      saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'high'
    },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 76,
    outcome: 'unicorn',
    comparablePatterns: ['defense-eu-pre-ukraine', 'hardware-software-hybride', 'patience-industrielle']
  },
  {
    id: 'tekever',
    num: '005',
    name: 'Tekever',
    country: 'Portugal',
    geographicHub: 'Lisbonne',
    sector: 'Défense',
    subSector: 'ISR maritime drones',
    yearFounded: 2001,
    yearOfRefusal: 2010,
    archetype: 'cumulative-long',
    blindspots: ['geographie-portugaise', 'patience-industrielle', 'validation-publique-tardive'],
    proxies: ['pertinence-geographique-sectorielle', 'coherence-longitudinale', 'validation-institutionnelle-eu'],
    teamProfile: {
      foundersCount: 1, pedigreeCanonical: false, averageAge: 'mid',
      sectorExperience: 'high', riskTaken: 'medium'
    },
    marketProfile: {
      perceivedSize: 'niche', realIntensity: 'high',
      saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'high'
    },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 72,
    outcome: 'unicorn',
    comparablePatterns: ['defense-eu-pre-ukraine', 'patience-extreme', 'geographie-marges-eu']
  },
  {
    id: 'airbnb',
    num: '006',
    name: 'Airbnb',
    country: 'États-Unis',
    geographicHub: 'San Francisco',
    sector: 'Hospitalité',
    subSector: 'Marketplace P2P',
    yearFounded: 2008,
    yearOfRefusal: 2008,
    archetype: 'interpretive',
    blindspots: ['marche-perçu-inexistant', 'comportement-invraisemblable', 'pedigree-design', 'timing-contracyclique'],
    proxies: ['obsession-produit-fondateur', 'anti-fragilite-historique-contraintes', 'qualite-cohorte'],
    teamProfile: {
      foundersCount: 3, pedigreeCanonical: false, averageAge: 'young',
      sectorExperience: 'transversal', riskTaken: 'high'
    },
    marketProfile: {
      perceivedSize: 'niche', realIntensity: 'extreme',
      saturation: 'emerging', regulatoryComplexity: 'medium', capitalIntensity: 'low'
    },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'tensions', vcCapital: 'underweight' },
    retrospectiveScore: 91,
    outcome: 'public',
    comparablePatterns: ['marketplace-2-cotes', 'crise-comme-fenetre', 'design-fondateurs']
  },
  {
    id: 'slack',
    num: '007',
    name: 'Slack',
    country: 'États-Unis',
    geographicHub: 'San Francisco',
    sector: 'SaaS',
    subSector: 'Communication B2B',
    yearFounded: 2013,
    yearOfRefusal: 2013,
    archetype: 'cumulative-mid',
    blindspots: ['pivot-post-echec', 'cohesion-equipe-epreuve', 'validation-produit-interne'],
    proxies: ['cohesion-equipe-epreuve', 'qualite-produit-interne', 'transposition-experience'],
    teamProfile: {
      foundersCount: 4, pedigreeCanonical: true, averageAge: 'mid',
      sectorExperience: 'transversal', riskTaken: 'high'
    },
    marketProfile: {
      perceivedSize: 'large', realIntensity: 'high',
      saturation: 'saturated', regulatoryComplexity: 'low', capitalIntensity: 'low'
    },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 86,
    outcome: 'acquired',
    comparablePatterns: ['pivot-success', 'mafia-flickr', 'saturation-vs-mal-servi']
  },
  {
    id: 'shopify',
    num: '008',
    name: 'Shopify',
    country: 'Canada',
    geographicHub: 'Ottawa',
    sector: 'E-commerce',
    subSector: 'Plateforme marchands',
    yearFounded: 2006,
    yearOfRefusal: 2008,
    archetype: 'depth',
    blindspots: ['longue-traine-sous-evaluee', 'effet-plateforme-non-anticipe', 'geographie-ottawa'],
    proxies: ['potentiel-plateforme', 'qualite-cohorte-retentionniste', 'signature-communaute-technique'],
    teamProfile: {
      foundersCount: 3, pedigreeCanonical: false, averageAge: 'mid',
      sectorExperience: 'transversal', riskTaken: 'medium'
    },
    marketProfile: {
      perceivedSize: 'niche', realIntensity: 'high',
      saturation: 'fragmented', regulatoryComplexity: 'low', capitalIntensity: 'low'
    },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 82,
    outcome: 'public',
    comparablePatterns: ['longue-traine', 'plateforme-emergente', 'geographie-non-hub']
  },
  {
    id: 'zoom',
    num: '009',
    name: 'Zoom',
    country: 'États-Unis',
    geographicHub: 'San Jose',
    sector: 'SaaS',
    subSector: 'Vidéoconférence',
    yearFounded: 2011,
    yearOfRefusal: 2011,
    archetype: 'depth',
    blindspots: ['marche-percu-sature', 'execution-non-valorisee', 'pedigree-cadre-dirigeant'],
    proxies: ['experience-produit-testee', 'avantage-connaissance-interne'],
    teamProfile: {
      foundersCount: 1, pedigreeCanonical: true, averageAge: 'senior',
      sectorExperience: 'high', riskTaken: 'medium'
    },
    marketProfile: {
      perceivedSize: 'large', realIntensity: 'high',
      saturation: 'saturated', regulatoryComplexity: 'low', capitalIntensity: 'medium'
    },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 89,
    outcome: 'public',
    comparablePatterns: ['saturation-vs-mal-servi', 'cadre-dirigeant-leader', 'execution-comme-moat']
  },
  {
    id: 'stripe',
    num: '010',
    name: 'Stripe',
    country: 'Irlande/USA',
    geographicHub: 'San Francisco',
    sector: 'Fintech',
    subSector: 'Infrastructure paiement',
    yearFounded: 2010,
    yearOfRefusal: 2010,
    archetype: 'capacity',
    blindspots: ['pedigree-tres-jeune-eu', 'mafia-paypal-mal-lue', 'marche-percu-sature'],
    proxies: ['signature-business-angel-mafia', 'cofondation-familiale', 'intensite-besoin-developpeur'],
    teamProfile: {
      foundersCount: 2, pedigreeCanonical: false, averageAge: 'young',
      sectorExperience: 'transversal', riskTaken: 'high'
    },
    marketProfile: {
      perceivedSize: 'massive', realIntensity: 'extreme',
      saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'medium'
    },
    macroAtRefusal: { cyclePosition: 'bascule', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 94,
    outcome: 'unicorn',
    comparablePatterns: ['mafia-paypal', 'fondateurs-tres-jeunes', 'api-economy-emergente', 'defaut-leadership-eu']
  },
  // Fiches résumées pour les autres cas (structure complète mais détails compactés)
  {
    id: 'backmarket', num: '011', name: 'Backmarket', country: 'France', geographicHub: 'Paris',
    sector: 'E-commerce', subSector: 'Reconditionné', yearFounded: 2014, yearOfRefusal: 2014,
    archetype: 'depth', blindspots: ['niche-percue', 'tendance-environnement-tardive'],
    proxies: ['convergence-pouvoir-achat-environnement', 'potentiel-plateforme-reconditionne'],
    teamProfile: { foundersCount: 3, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'niche', realIntensity: 'high', saturation: 'fragmented', regulatoryComplexity: 'low', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 78, outcome: 'unicorn',
    comparablePatterns: ['niche-vers-massif', 'tendance-environnement']
  },
  {
    id: 'blablacar', num: '012', name: 'BlaBlaCar', country: 'France', geographicHub: 'Paris',
    sector: 'Mobilité', subSector: 'Marketplace covoiturage', yearFounded: 2006, yearOfRefusal: 2006,
    archetype: 'depth', blindspots: ['marche-percu-niche', 'economie-partage-pre-mainstream'],
    proxies: ['effet-reseau-densifiant', 'patience-longitudinale', 'opportunite-eu-non-anglophone'],
    teamProfile: { foundersCount: 3, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'niche', realIntensity: 'high', saturation: 'emerging', regulatoryComplexity: 'medium', capitalIntensity: 'low' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 80, outcome: 'unicorn',
    comparablePatterns: ['economie-partage-emergente', 'eu-non-anglophone']
  },
  {
    id: 'vinted', num: '013', name: 'Vinted', country: 'Lituanie', geographicHub: 'Vilnius',
    sector: 'E-commerce', subSector: 'C2C seconde main', yearFounded: 2008, yearOfRefusal: 2008,
    archetype: 'depth', blindspots: ['geographie-balte', 'segment-c2c-niche', 'patience-longitudinale'],
    proxies: ['pertinence-geographique', 'patience-longitudinale', 'effet-reseau-c2c'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'niche', realIntensity: 'high', saturation: 'fragmented', regulatoryComplexity: 'low', capitalIntensity: 'low' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 76, outcome: 'unicorn',
    comparablePatterns: ['geographie-marges-eu', 'c2c-densifiant']
  },
  {
    id: 'manomano', num: '014', name: 'ManoMano', country: 'France', geographicHub: 'Paris',
    sector: 'E-commerce', subSector: 'Bricolage', yearFounded: 2013, yearOfRefusal: 2013,
    archetype: 'depth', blindspots: ['concurrence-traditionnelle-surevaluee', 'verticalisation-comme-moat'],
    proxies: ['verticalisation-moat', 'expertise-sectorielle-profonde'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'medium', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'medium', saturation: 'saturated', regulatoryComplexity: 'low', capitalIntensity: 'low' },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 72, outcome: 'unicorn',
    comparablePatterns: ['verticale-vs-horizontale', 'expertise-comme-moat']
  },
  {
    id: 'veepee', num: '015', name: 'Veepee', country: 'France', geographicHub: 'Paris',
    sector: 'E-commerce', subSector: 'Ventes événementielles', yearFounded: 2001, yearOfRefusal: 2001,
    archetype: 'depth', blindspots: ['e-commerce-pre-boom', 'modele-ventes-privees-non-internalise'],
    proxies: ['patience-longitudinale', 'anti-fragilite-culturelle-fr'],
    teamProfile: { foundersCount: 1, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'high', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'niche', realIntensity: 'high', saturation: 'emerging', regulatoryComplexity: 'low', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 75, outcome: 'leader-segment',
    comparablePatterns: ['pionnier-modele-mondial', 'patience-extreme']
  },
  {
    id: 'alan', num: '016', name: 'Alan', country: 'France', geographicHub: 'Paris',
    sector: 'Insurtech', subSector: 'Assurance santé régulée', yearFounded: 2016, yearOfRefusal: 2016,
    archetype: 'cumulative-mid', blindspots: ['barriere-reglementaire-redhibitoire', 'pedigree-non-sectoriel', 'capital-intensive-mal-lu'],
    proxies: ['capacite-regulation-complexe', 'avantage-capital-intensif', 'internationalisation-these'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: true, averageAge: 'young', sectorExperience: 'transversal', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'massive', realIntensity: 'high', saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'high' },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 84, outcome: 'unicorn',
    comparablePatterns: ['barriere-reglementaire-protectrice', 'insurtech-challenger']
  },
  {
    id: 'qonto', num: '017', name: 'Qonto', country: 'France', geographicHub: 'Paris',
    sector: 'Fintech', subSector: 'Néobanque B2B', yearFounded: 2016, yearOfRefusal: 2016,
    archetype: 'depth', blindspots: ['b2b-sous-pondere', 'cannibalisation-incorrecte', 'thiel-mal-pondere'],
    proxies: ['effet-reseau-b2b-specifique', 'intensite-frustration-pme', 'signature-haute-conviction'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: true, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'high', saturation: 'fragmented', regulatoryComplexity: 'high', capitalIntensity: 'high' },
    macroAtRefusal: { cyclePosition: 'bascule', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 82, outcome: 'unicorn',
    comparablePatterns: ['b2b-vs-consumer-fintech', 'mafia-paypal-bis']
  },
  {
    id: 'spendesk', num: '018', name: 'Spendesk', country: 'France', geographicHub: 'Paris',
    sector: 'SaaS', subSector: 'Spend management', yearFounded: 2016, yearOfRefusal: 2016,
    archetype: 'depth', blindspots: ['niche-percue-segment-massif', 'pedigree-non-finance', 'modele-hybride'],
    proxies: ['intensite-besoin-frustration', 'qualite-cohorte', 'segment-niche-vers-massif'],
    teamProfile: { foundersCount: 3, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'niche', realIntensity: 'high', saturation: 'fragmented', regulatoryComplexity: 'medium', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 78, outcome: 'unicorn',
    comparablePatterns: ['saas-finance-niche-vers-massif', 'modele-hybride-saas-banque']
  },
  {
    id: 'payfit', num: '019', name: 'PayFit', country: 'France', geographicHub: 'Paris',
    sector: 'SaaS', subSector: 'Paie HR', yearFounded: 2015, yearOfRefusal: 2015,
    archetype: 'cumulative-mid', blindspots: ['complexite-reglementaire', 'concurrence-etablis-surevaluee', 'desintermediation-sous-anticipee'],
    proxies: ['intensite-frustration-pme', 'capacite-reglementaire', 'desintermediation-progressive'],
    teamProfile: { foundersCount: 3, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'high', saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 76, outcome: 'unicorn',
    comparablePatterns: ['saas-rh-regule', 'desintermediation-experts-comptables']
  },
  {
    id: 'brevo', num: '020', name: 'Brevo', country: 'France', geographicHub: 'Paris',
    sector: 'SaaS', subSector: 'Marketing automation', yearFounded: 2012, yearOfRefusal: 2014,
    archetype: 'depth', blindspots: ['marche-percu-sature-mailchimp', 'internationalisation-marges', 'evolution-progressive'],
    proxies: ['apprentissage-organisationnel-cumulatif', 'opportunite-geographique-fragmentee', 'internationalisation-marges'],
    teamProfile: { foundersCount: 1, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'medium', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'medium', saturation: 'saturated', regulatoryComplexity: 'low', capitalIntensity: 'low' },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 71, outcome: 'unicorn',
    comparablePatterns: ['fragmentation-geographique', 'patience-evolution']
  },
  {
    id: 'huggingface', num: '021', name: 'Hugging Face', country: 'France/USA', geographicHub: 'Paris/NYC',
    sector: 'IA', subSector: 'Plateforme open-source', yearFounded: 2016, yearOfRefusal: 2016,
    archetype: 'capacity', blindspots: ['open-source-sous-valorisee', 'migration-non-corrigee', 'cadre-ia-absent-eu'],
    proxies: ['traction-communautaire-tech', 'signature-scientifique', 'strategie-open-source-plateforme'],
    teamProfile: { foundersCount: 3, pedigreeCanonical: true, averageAge: 'mid', sectorExperience: 'high', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'extreme', saturation: 'emerging', regulatoryComplexity: 'low', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 87, outcome: 'unicorn',
    comparablePatterns: ['migration-fr-vers-us', 'open-source-plateforme', 'avant-mistral']
  },
  {
    id: 'datadog', num: '022', name: 'Datadog', country: 'France/USA', geographicHub: 'NYC',
    sector: 'SaaS', subSector: 'Monitoring infrastructure', yearFounded: 2010, yearOfRefusal: 2010,
    archetype: 'capacity', blindspots: ['categorie-emergente-non-reconnue', 'open-source-mal-lue', 'migration-fondateurs'],
    proxies: ['opportunite-categories-emergentes', 'communaute-technique', 'plateforme-multi-produits'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'high', saturation: 'fragmented', regulatoryComplexity: 'low', capitalIntensity: 'low' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 85, outcome: 'public',
    comparablePatterns: ['migration-fr-vers-us', 'cloud-native-emergent', 'avant-stripe']
  },
  {
    id: 'ovhcloud', num: '023', name: 'OVHcloud', country: 'France', geographicHub: 'Roubaix',
    sector: 'Cloud', subSector: 'IaaS souverain', yearFounded: 1999, yearOfRefusal: 2010,
    archetype: 'cumulative-long', blindspots: ['capital-intensive-incompatible-vc', 'cloud-souverain-these-politique', 'patience-extreme'],
    proxies: ['asset-strategique-eu', 'patience-longitudinale', 'souverainete'],
    teamProfile: { foundersCount: 1, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'high', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'massive', realIntensity: 'high', saturation: 'saturated', regulatoryComplexity: 'medium', capitalIntensity: 'high' },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 65, outcome: 'public',
    comparablePatterns: ['hors-vc-strategique', 'souverainete-eu']
  },
  {
    id: 'klarna', num: '024', name: 'Klarna', country: 'Suède', geographicHub: 'Stockholm',
    sector: 'Fintech', subSector: 'BNPL', yearFounded: 2005, yearOfRefusal: 2005,
    archetype: 'capacity', blindspots: ['bnpl-non-reconnue', 'pedigree-tres-jeune', 'geographie-nordique'],
    proxies: ['categorie-emergente', 'elasticite-panier-paiement-differe', 'signature-culturelle-nordique'],
    teamProfile: { foundersCount: 3, pedigreeCanonical: false, averageAge: 'young', sectorExperience: 'transversal', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'high', saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'high' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 78, outcome: 'public',
    comparablePatterns: ['bnpl-emergent', 'fondateurs-tres-jeunes', 'nordique-sous-pondere']
  },
  {
    id: 'spotify', num: '025', name: 'Spotify', country: 'Suède', geographicHub: 'Stockholm',
    sector: 'Media', subSector: 'Streaming musical', yearFounded: 2006, yearOfRefusal: 2006,
    archetype: 'interpretive', blindspots: ['industrie-intraitable', 'negociation-institutionnelle', 'freemium-audacieux'],
    proxies: ['negociation-institutionnelle', 'effet-reseau-plateforme'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: true, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'massive', realIntensity: 'high', saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 88, outcome: 'public',
    comparablePatterns: ['industrie-en-transition', 'negociation-majors']
  },
  {
    id: 'believe', num: '026', name: 'Believe', country: 'France', geographicHub: 'Paris',
    sector: 'Media', subSector: 'Distribution musicale', yearFounded: 2005, yearOfRefusal: 2008,
    archetype: 'cumulative-long', blindspots: ['segment-musique-independante', 'patience-longitudinale', 'internationalisation-marges'],
    proxies: ['patience-longitudinale', 'internationalisation-marges', 'modele-hybride'],
    teamProfile: { foundersCount: 1, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'medium', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'niche', realIntensity: 'medium', saturation: 'saturated', regulatoryComplexity: 'medium', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 68, outcome: 'public',
    comparablePatterns: ['patience-eu-fr', 'internationalisation-marges']
  },
  {
    id: 'adyen', num: '027', name: 'Adyen', country: 'Pays-Bas', geographicHub: 'Amsterdam',
    sector: 'Fintech', subSector: 'Paiement enterprise', yearFounded: 2006, yearOfRefusal: 2008,
    archetype: 'cumulative-mid', blindspots: ['pedigree-ex-leader', 'paiement-enterprise-domine', 'patience-non-valorisee'],
    proxies: ['avantage-connaissance-interne', 'patience-longitudinale', 'plateforme-omnicanal'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: true, averageAge: 'senior', sectorExperience: 'high', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'massive', realIntensity: 'high', saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'mature', geopolitics: 'stable', vcCapital: 'balanced' },
    retrospectiveScore: 84, outcome: 'public',
    comparablePatterns: ['cadre-dirigeant-leader', 'patience-eu']
  },
  {
    id: 'uipath', num: '028', name: 'UiPath', country: 'Roumanie', geographicHub: 'Bucarest',
    sector: 'SaaS', subSector: 'RPA automatisation', yearFounded: 2005, yearOfRefusal: 2012,
    archetype: 'cumulative-long', blindspots: ['geographie-eu-centrale', 'rpa-non-reconnue', 'patience-longitudinale'],
    proxies: ['pertinence-geographique', 'patience-longitudinale', 'categorie-emergente'],
    teamProfile: { foundersCount: 1, pedigreeCanonical: false, averageAge: 'mid', sectorExperience: 'high', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'high', saturation: 'emerging', regulatoryComplexity: 'low', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 82, outcome: 'public',
    comparablePatterns: ['geographie-marges-eu', 'patience-extreme', 'rpa-emergent']
  },
  {
    id: 'uber', num: '029', name: 'Uber', country: 'États-Unis', geographicHub: 'San Francisco',
    sector: 'Mobilité', subSector: 'Marketplace transport', yearFounded: 2009, yearOfRefusal: 2010,
    archetype: 'interpretive', blindspots: ['marche-regule-fragmente', 'risque-reglementaire', 'modele-percu-simple'],
    proxies: ['intensite-besoin-urbain', 'convergence-technologique', 'economie-agglomeration-urbaine'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: true, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'massive', realIntensity: 'extreme', saturation: 'saturated', regulatoryComplexity: 'high', capitalIntensity: 'medium' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 89, outcome: 'public',
    comparablePatterns: ['marketplace-vs-traditionnel-regule', 'convergence-mobile-gps-paiement']
  },
  {
    id: 'dropbox', num: '030', name: 'Dropbox', country: 'États-Unis', geographicHub: 'San Francisco',
    sector: 'SaaS', subSector: 'Stockage cloud', yearFounded: 2007, yearOfRefusal: 2008,
    archetype: 'depth', blindspots: ['marche-percu-sature', 'execution-fluidite-invisible', 'effet-reseau-collaboration'],
    proxies: ['experience-produit-testee', 'engagement-freemium', 'effet-reseau-collaboration'],
    teamProfile: { foundersCount: 2, pedigreeCanonical: true, averageAge: 'young', sectorExperience: 'medium', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'high', saturation: 'saturated', regulatoryComplexity: 'low', capitalIntensity: 'low' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 81, outcome: 'public',
    comparablePatterns: ['saturation-vs-mal-servi', 'execution-fluidite']
  },
  {
    id: 'facebook', num: '031', name: 'Facebook', country: 'États-Unis', geographicHub: 'Cambridge/SF',
    sector: 'Media', subSector: 'Réseau social', yearFounded: 2004, yearOfRefusal: 2004,
    archetype: 'interpretive', blindspots: ['niche-universitaire', 'pedigree-tres-jeune', 'effet-reseau-densifiant'],
    proxies: ['effet-reseau-local-densifiant', 'expansion-couches-verrouillees', 'engagement-utilisateur'],
    teamProfile: { foundersCount: 4, pedigreeCanonical: false, averageAge: 'young', sectorExperience: 'transversal', riskTaken: 'high' },
    marketProfile: { perceivedSize: 'massive', realIntensity: 'extreme', saturation: 'saturated', regulatoryComplexity: 'low', capitalIntensity: 'low' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 92, outcome: 'public',
    comparablePatterns: ['niche-vers-massif', 'fondateurs-tres-jeunes', 'reseau-densifiant']
  },
  {
    id: 'linkedin', num: '032', name: 'LinkedIn', country: 'États-Unis', geographicHub: 'Mountain View',
    sector: 'Media', subSector: 'Réseau social pro', yearFounded: 2002, yearOfRefusal: 2003,
    archetype: 'cumulative-mid', blindspots: ['croissance-lente-mal-lue', 'reseau-pro-densifiant', 'mafia-paypal'],
    proxies: ['signature-mafia-paypal', 'patience-longitudinale', 'effet-reseau-pro'],
    teamProfile: { foundersCount: 5, pedigreeCanonical: true, averageAge: 'mid', sectorExperience: 'transversal', riskTaken: 'medium' },
    marketProfile: { perceivedSize: 'large', realIntensity: 'high', saturation: 'emerging', regulatoryComplexity: 'low', capitalIntensity: 'low' },
    macroAtRefusal: { cyclePosition: 'pre-bascule', geopolitics: 'stable', vcCapital: 'underweight' },
    retrospectiveScore: 86, outcome: 'acquired',
    comparablePatterns: ['mafia-paypal', 'patience-saas-pro', 'reseau-densifiant']
  },
];

export function findCorpusById(id: string): CaseRecord | undefined {
  return CORPUS.find(c => c.id === id);
}

export function findByPattern(pattern: string): CaseRecord[] {
  return CORPUS.filter(c => c.comparablePatterns.includes(pattern));
}

export function findByArchetype(archetype: Archetype): CaseRecord[] {
  return CORPUS.filter(c => c.archetype === archetype);
}
