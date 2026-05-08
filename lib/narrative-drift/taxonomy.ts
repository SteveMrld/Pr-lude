// ============================================================
// TAXONOMIE LEXICALE - NARRATIVE DRIFT ENGINE
// ------------------------------------------------------------
// Trois couches de mots utilisees pour mesurer la densite
// concrete et le ratio abstrait/concret d une communication.
// La densite et le ratio sont les proxys mesurables de la
// derive narrative.
//
// Methode : on tokenise le texte, on compte le nombre de mots
// par couche, on calcule les metriques. Voir score-text.ts.
//
// Cette taxonomie est versionnee. V1 : initiale, basee sur
// l analyse comparative de communications business publiques.
// A enrichir au fil des dossiers reels.
// ============================================================

export type LexicalLayer = 'concrete' | 'semi-abstract' | 'abstract';

// ------------------------------------------------------------
// COUCHE 1 : CONCRET UNIVERSEL
// ------------------------------------------------------------
// Mots qui designent des grandeurs mesurables, des entites
// identifiables, ou des actions verifiables. Restent concrets
// dans tous les contextes business.
// ------------------------------------------------------------

export const CONCRETE_WORDS = new Set<string>([
  // Mesures financieres et commerciales
  'revenue', 'revenues', 'revenu', 'revenus', 'sales',
  'arr', 'mrr', 'gmv', 'ebitda', 'ebit', 'cogs',
  'margin', 'margins', 'marge', 'marges',
  'profit', 'profits', 'profitability', 'profitable',
  'loss', 'losses', 'perte', 'pertes',
  'burn', 'runway', 'cash', 'liquidity', 'tresorerie',
  'valuation', 'valorisation',
  'fundraise', 'fundraising', 'levee', 'levees', 'raised',
  'dilution', 'ownership',
  'churn', 'retention', 'attrition',
  'ltv', 'cac', 'payback', 'nrr', 'grr', 'arpu',
  'price', 'prices', 'pricing', 'prix', 'tarif', 'tarifs',
  'cost', 'costs', 'cout', 'couts',
  'expense', 'expenses', 'depense', 'depenses',
  'capex', 'opex', 'amortization', 'depreciation',
  'gross', 'net', 'operating',

  // Entites identifiables
  'customer', 'customers', 'client', 'clients',
  'subscriber', 'subscribers', 'abonne', 'abonnes',
  'user', 'users', 'utilisateur', 'utilisateurs',
  'prospect', 'prospects',
  'contract', 'contracts', 'contrat', 'contrats',
  'poc', 'pocs', 'pilot', 'pilots',
  'loi', 'lois',
  'supplier', 'suppliers', 'fournisseur', 'fournisseurs',
  'vendor', 'vendors',
  'employee', 'employees', 'employes', 'salarie', 'salaries',
  'engineer', 'engineers', 'ingenieur', 'ingenieurs',
  'developer', 'developers', 'developpeur', 'developpeurs',
  'founder', 'founders', 'fondateur', 'fondateurs',
  'board', 'directors', 'administrateur', 'administrateurs',
  'investor', 'investors', 'investisseur', 'investisseurs',
  'shareholder', 'shareholders', 'actionnaire', 'actionnaires',

  // Actions verifiables
  'signed', 'signe', 'signed',
  'shipped', 'delivered', 'livre',
  'deployed', 'deploye',
  'launched', 'lance',
  'closed', 'ferme',
  'opened', 'ouvert',
  'sold', 'vendu',
  'purchased', 'achete',
  'acquired', 'acquis',
  'hired', 'embauche', 'recruited', 'recrute',
  'fired', 'laid', 'licencie',
  'invoiced', 'facture',
  'paid', 'paye', 'paid',
  'collected', 'encaisse',
  'announced', 'annonce',

  // Metriques d usage chiffrables
  'session', 'sessions',
  'transaction', 'transactions',
  'request', 'requests', 'requete', 'requetes',
  'query', 'queries',
  'conversion', 'conversions',
  'click', 'clicks',
  'view', 'views',
  'download', 'downloads',
  'install', 'installs',
  'mau', 'dau', 'wau',
  'latency', 'latence',
  'throughput',
  'uptime', 'downtime',
  'sla', 'slo',

  // Temporel precis
  'quarter', 'trimestre',
  'q1', 'q2', 'q3', 'q4',
  'fy', 'fiscal',
  'h1', 'h2',
  'month', 'months', 'mois',
  'week', 'weeks', 'semaine', 'semaines',
  'day', 'days', 'jour', 'jours',
  'deadline',
  'milestone', 'milestones', 'jalon', 'jalons',

  // Quantifications usuelles
  'number', 'count', 'nombre',
  'percentage', 'pourcentage', 'percent', 'pourcent',
  'increase', 'decrease', 'hausse', 'baisse',
  'growth',
  'reduction',
  'million', 'millions',
  'billion', 'billions', 'milliard', 'milliards',
  'thousand', 'thousands', 'millier', 'milliers',
  'year', 'years', 'annee', 'annees', 'an', 'ans',
  'dollar', 'dollars', 'usd',
  'euro', 'euros', 'eur',
  'pound', 'pounds', 'gbp',

  // Operations concretes
  'production', 'manufacturing', 'fabrication',
  'inventory', 'stock', 'stocks',
  'warehouse', 'entrepot',
  'shipment', 'expedition',
  'logistics', 'logistique',
  'unit', 'units', 'unite', 'unites',
]);

// ------------------------------------------------------------
// COUCHE 2 : SEMI-ABSTRAIT CONTEXTUEL
// ------------------------------------------------------------
// Mots qui peuvent etre concrets ou vagues selon le contexte.
// Le moteur applique une regle de contextualisation pour
// trancher : presence d un chiffre adjacent ou d une definition
// operationnelle dans la meme phrase = compte comme concret.
// Sinon = compte comme abstrait.
// ------------------------------------------------------------

export const SEMI_ABSTRACT_WORDS = new Set<string>([
  // Engagement et traction
  'engagement', 'adoption', 'traction',
  'momentum', 'velocity',
  'scaling', 'scale',
  // 'growth' vit dans CONCRETE car presque toujours accompagne d un chiffre
  // dans une comm business serieuse. Si "growth" devient abstrait dans un
  // contexte (forte croissance de l engagement), c est detecte par les mots
  // adjacents (engagement abstrait) plutot qu en tagant growth lui-meme.
  'expansion',
  'acceleration',
  'penetration',

  // Plateformes et reseaux
  'platform', 'plateforme',
  'ecosystem', 'ecosysteme',
  'network', 'reseau',
  'infrastructure',
  'community', 'communaute',
  'marketplace',

  // Technologie
  'technology', 'technologie',
  'innovation',
  'intelligence',
  'automation', 'automatisation',
  'optimization', 'optimisation',
  'digital', 'digitalisation',
  'cloud',
  'data',

  // Produit
  'product', 'produit',
  'service', 'services',
  'solution', 'solutions',
  'offering', 'offre',
  'feature', 'features', 'fonctionnalite',
  'capability', 'capabilities',

  // Strategie
  'strategy', 'strategie',
  'approach', 'approche',
  'method', 'methode',
  'process', 'processus',
  'framework',
  'model', 'modele',
]);

// ------------------------------------------------------------
// COUCHE 3 : ABSTRAIT UNIVERSEL
// ------------------------------------------------------------
// Mots qui restent abstraits dans tous les contextes business
// serieux. Leur presence n est pas un probleme en soi (toute
// communication contient une dimension narrative), c est leur
// densite et leur dominance par rapport a la Couche 1 qui
// devient le signal.
// ------------------------------------------------------------

export const ABSTRACT_WORDS = new Set<string>([
  // Vision et finalite
  'vision', 'visionary',
  'mission', 'missionary',
  'purpose',
  'meaning',
  'destiny', 'destinee',
  'ambition',
  'aspiration', 'aspirations',
  'dream', 'reve',
  'belief', 'croyance',

  // Transformation et rupture
  'transformation', 'transformer', 'transform', 'transforming',
  'revolution', 'revolutionary', 'revolutionner',
  'disruption', 'disrupt', 'disruptive', 'disrupting',
  'paradigm', 'paradigme',
  'era', 'ere',
  'epoch', 'epoque',
  'future', 'futur',
  'tomorrow', 'demain',
  'reinvent', 'reinvention', 'reinventing',
  'redefine', 'redefining',
  'reimagine', 'reimagining',

  // Echelle planetaire
  'humanity', 'humanite',
  'civilization', 'civilisation',
  'world', 'monde', 'global', 'mondial',
  'planet', 'planete',
  'society', 'societe',
  'generation', 'generations',

  // Conscience et valeur
  'consciousness', 'conscience',
  'conviction',
  'philosophy', 'philosophie',
  'wisdom', 'sagesse',
  'principle', 'principes', 'principle',
  'value', 'values', 'valeur', 'valeurs',
  'culture',
  'soul', 'ame',
  'heart', 'coeur',
  'spirit', 'esprit',

  // Excellence et distinction
  'excellence',
  'leadership',
  'premium',
  'signature',
  'elite',
  'distinction',
  'unparalleled',
  'unrivaled',
  'unmatched',
  'unprecedented',
  'extraordinary', 'extraordinaire',

  // Empowerment et impact
  'empower', 'empowerment',
  'enable', 'enablement',
  'unleash',
  'unlock',
  'transform', // duplicate intentionnel, mot tres fort
  'impact',
  'change',
  'movement', 'mouvement',

  // Connectivite emotionnelle
  'magic', 'magie',
  'wonder',
  'inspiration', 'inspire',
  'passion',
  'love', 'amour',
  'happiness', 'bonheur',
  'wellbeing', 'wellness', 'bienetre',

  // Holistique et systemique
  'holistic', 'holistique',
  'seamless',
  'frictionless',
  'effortless',
  'organic', 'organique',
  'natural', 'naturel',
  'sustainable', 'durable', 'sustainability', 'durabilite',
]);

// ------------------------------------------------------------
// MOTS POLYSEMIQUES (pour contextualisation sectorielle)
// ------------------------------------------------------------
// Liste reduite des mots dont la couche depend du secteur.
// Utilises par la fonction classifyWordContextually() qui
// decide concret / semi-abstrait / abstrait selon le contexte
// metier du dossier (extrait par le moteur Marche).
// ------------------------------------------------------------

export const POLYSEMIC_WORDS: Record<string, {
  concreteIn: string[];
  abstractIn: string[];
  rationale: string;
}> = {
  'platform': {
    concreteIn: ['saas-infrastructure', 'api', 'developer-tools', 'cloud'],
    abstractIn: ['real-estate', 'lifestyle', 'wellness', 'consulting'],
    rationale: 'Concret quand designe une realite technique precise (Stripe platform, AWS platform). Abstrait quand designe une vision englobante (WeWork platform of community).',
  },
  'community': {
    concreteIn: ['gaming', 'open-source', 'developer-tools', 'creator-economy'],
    abstractIn: ['b2b-saas', 'enterprise', 'real-estate'],
    rationale: 'Concret en gaming et open source ou la communaute est un objet identifiable. Abstrait en B2B SaaS ou il sert souvent de remplacement a "clientele".',
  },
  'ecosystem': {
    concreteIn: ['developer-tools', 'api', 'platform-tech'],
    abstractIn: ['*'],
    rationale: 'Concret uniquement quand designe une integration technique precise (the iOS ecosystem of apps). Abstrait dans tous les autres usages.',
  },
  'network': {
    concreteIn: ['telecoms', 'infrastructure', 'logistics'],
    abstractIn: ['social', 'b2b', 'consulting'],
    rationale: 'Concret en telecoms et infra (network capacity, network latency). Semi-abstrait en social. Abstrait quand utilise sans dimension mesurable.',
  },
  'solution': {
    concreteIn: ['*'],
    abstractIn: ['*'],
    rationale: 'Concret quand suivi d une description precise dans la meme phrase. Abstrait quand utilise seul ou comme categorie generale. Regle contextuelle, pas sectorielle.',
  },
  'model': {
    concreteIn: ['ai-ml', 'finance', 'consulting'],
    abstractIn: ['lifestyle', 'wellness'],
    rationale: 'Concret en finance (revenue model, pricing model), en IA (large language model). Plus abstrait quand utilise sans qualificatif (notre model change le monde).',
  },
};

// ------------------------------------------------------------
// CLASSIFICATION D UN MOT EN COUCHE
// ------------------------------------------------------------

export function classifyWord(word: string): LexicalLayer | null {
  const lower = word.toLowerCase().trim();
  if (!lower) return null;
  if (CONCRETE_WORDS.has(lower)) return 'concrete';
  if (ABSTRACT_WORDS.has(lower)) return 'abstract';
  if (SEMI_ABSTRACT_WORDS.has(lower)) return 'semi-abstract';
  return null;
}

// Estimation du nombre de mots par couche pour la documentation
export const TAXONOMY_STATS = {
  concreteCount: CONCRETE_WORDS.size,
  semiAbstractCount: SEMI_ABSTRACT_WORDS.size,
  abstractCount: ABSTRACT_WORDS.size,
  polysemicCount: Object.keys(POLYSEMIC_WORDS).length,
};
