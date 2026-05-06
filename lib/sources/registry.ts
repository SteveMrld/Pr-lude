// ============================================================
// SOURCES REGISTRY
// ------------------------------------------------------------
// Registre central de toutes les sources de donnees disponibles
// pour l instruction des dossiers. Chaque source est classee par :
//
//   - TIER (1 a 4) : poids editorial dans le scoring
//       Tier 1 = Primaire (registres officiels, brevets, publications)
//       Tier 2 = Premium BYOK (Pitchbook, Crunchbase, Sayari...)
//       Tier 3 = Signaux faibles (LinkedIn, presse spe, Reddit cible)
//       Tier 4 = Contexte (Wikipedia, presse generaliste)
//
//   - ACCESS : modalite d acces
//       'free'       : libre, sans cle
//       'free-byok'  : free tier + cle utilisateur pour quotas eleves
//       'byok'       : abonnement utilisateur obligatoire
//       'api-native' : provider integre par defaut (web search interne...)
//
//   - DOMAINS : domaines d analyse ou la source est pertinente
//       team / ip / financial / market / macro / context
//
// REGLES EDITORIALES
//   - Une citation Tier 4 SEULE ne peut jamais justifier un signal vert
//     ou rouge. Elle sert uniquement de mise en contexte.
//   - Un dossier instruit majoritairement avec du Tier 4 doit declencher
//     un flag 'instruction insuffisante' avant scoring.
//   - Chaque citation dans la note d investissement doit afficher son
//     tier pour permettre au lecteur de calibrer la confiance.
//
// Le registry ne fetch pas. C est une carte declarative consultee par :
//   - Le pipeline (pour savoir quelles sources mobiliser par moteur)
//   - L UI Settings (pour afficher les sources BYOK configurables)
//   - La note d investissement (pour afficher le tier des citations)
// ============================================================

export type SourceTier = 1 | 2 | 3 | 4;

export type AccessMode = 'free' | 'free-byok' | 'byok' | 'api-native';

export type SourceDomain =
  | 'team'        // fondateurs, dirigeants, equipe technique
  | 'ip'          // brevets, publications scientifiques, code public
  | 'financial'   // structure financiere, levees, valorisation, deals
  | 'market'      // taille marche, concurrents, signaux d adoption
  | 'macro'       // contexte reglementaire, geopolitique, monetaire
  | 'corporate'   // structure juridique, beneficiaires effectifs
  | 'context';    // contexte general non decisif

export interface SourceDescriptor {
  /** Identifiant stable, utilise dans les citations et les events */
  id: string;
  /** Nom affichable, marque commerciale */
  name: string;
  /** Tier editorial : poids decisif dans le scoring */
  tier: SourceTier;
  /** Modalite d acces */
  access: AccessMode;
  /** Domaines ou cette source apporte de la valeur */
  domains: SourceDomain[];
  /** URL principale, pour redirection depuis la note ou la page Settings */
  homepage: string;
  /** Description courte, affichee dans Settings */
  description: string;
  /** Indication BYOK : ou aller chercher la cle (page editeur) */
  byokHint?: string;
  /** Cle env / Supabase utilisee si BYOK ou si la source a un free-byok */
  envKey?: string;
  /** Indique si la source est un MUST sur le domaine (sans elle, instruction
      sur ce domaine est consideree insuffisante). Utilise pour le flag
      'instruction insuffisante'. */
  mustHaveForDomain?: SourceDomain[];
  /** Couverture geographique, utile pour decider quelle source mobiliser */
  geoCoverage?: ('FR' | 'EU' | 'US' | 'UK' | 'CN' | 'GLOBAL')[];
}

// ------------------------------------------------------------
// REGISTRE
// ------------------------------------------------------------
// Ordre : Tier 1 puis Tier 2 puis Tier 3 puis Tier 4.
// A l interieur de chaque tier, par domaine.

export const SOURCES_REGISTRY: SourceDescriptor[] = [
  // ===========================================================
  // TIER 1 - PRIMAIRES (registres officiels, brevets, publications)
  // ===========================================================
  {
    id: 'pappers',
    name: 'Pappers',
    tier: 1,
    access: 'free-byok',
    domains: ['corporate', 'financial', 'team'],
    homepage: 'https://www.pappers.fr',
    description:
      'Registre des entreprises francaises (SIREN, dirigeants, comptes annuels deposes, beneficiaires effectifs).',
    envKey: 'PAPPERS_API_KEY',
    byokHint: 'https://www.pappers.fr/api',
    mustHaveForDomain: ['corporate'],
    geoCoverage: ['FR'],
  },
  {
    id: 'inpi',
    name: 'INPI',
    tier: 1,
    access: 'free',
    domains: ['ip', 'corporate'],
    homepage: 'https://data.inpi.fr',
    description:
      "Registre national du commerce et des societes, marques et brevets deposes en France.",
    geoCoverage: ['FR'],
  },
  {
    id: 'bodacc',
    name: 'BODACC',
    tier: 1,
    access: 'free',
    domains: ['corporate'],
    homepage: 'https://www.bodacc.fr',
    description:
      "Bulletin officiel des annonces civiles et commerciales : creations, modifications, procedures collectives.",
    geoCoverage: ['FR'],
  },
  {
    id: 'companies-house',
    name: 'Companies House',
    tier: 1,
    access: 'free',
    domains: ['corporate', 'financial', 'team'],
    homepage: 'https://www.gov.uk/government/organisations/companies-house',
    description:
      'Registre officiel des entreprises britanniques (statuts, dirigeants, comptes annuels).',
    geoCoverage: ['UK'],
  },
  {
    id: 'opencorporates',
    name: 'OpenCorporates',
    tier: 1,
    access: 'free-byok',
    domains: ['corporate'],
    homepage: 'https://opencorporates.com',
    description:
      "Plus large base de donnees ouverte sur les entreprises mondiales, agrege +200 juridictions.",
    envKey: 'OPENCORPORATES_API_KEY',
    byokHint: 'https://opencorporates.com/api_accounts/new',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'epo-espacenet',
    name: 'EPO Espacenet',
    tier: 1,
    access: 'free-byok',
    domains: ['ip'],
    homepage: 'https://worldwide.espacenet.com',
    description:
      'Office europeen des brevets, base mondiale unifiee. Verification de propriete intellectuelle, antecedence, citations.',
    envKey: 'EPO_OPS_KEY',
    byokHint: 'https://developers.epo.org',
    mustHaveForDomain: ['ip'],
    geoCoverage: ['EU', 'GLOBAL'],
  },
  {
    id: 'wipo',
    name: 'WIPO PatentScope',
    tier: 1,
    access: 'free',
    domains: ['ip'],
    homepage: 'https://patentscope.wipo.int',
    description:
      'Organisation mondiale de la propriete intellectuelle, demandes PCT et brevets nationaux.',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'openalex',
    name: 'OpenAlex',
    tier: 1,
    access: 'free',
    domains: ['team', 'ip'],
    homepage: 'https://openalex.org',
    description:
      "Base ouverte des publications scientifiques mondiales (~250M oeuvres, 90k revues). Index successeur de MAG.",
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'arxiv',
    name: 'arXiv',
    tier: 1,
    access: 'free',
    domains: ['team', 'ip'],
    homepage: 'https://arxiv.org',
    description:
      'Archive de prepublications scientifiques (physique, math, CS, finance quantitative).',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'pubmed',
    name: 'PubMed',
    tier: 1,
    access: 'free',
    domains: ['team', 'ip'],
    homepage: 'https://pubmed.ncbi.nlm.nih.gov',
    description:
      'Base de reference biomedicale et sciences de la vie, NIH/NLM.',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'github',
    name: 'GitHub',
    tier: 1,
    access: 'free-byok',
    domains: ['team', 'ip'],
    homepage: 'https://github.com',
    description:
      'Hebergeur de code public. Verification de l empreinte technique reelle des fondateurs et de l equipe.',
    envKey: 'GITHUB_TOKEN',
    byokHint: 'https://github.com/settings/tokens',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'eur-lex',
    name: 'EUR-Lex',
    tier: 1,
    access: 'free',
    domains: ['macro'],
    homepage: 'https://eur-lex.europa.eu',
    description:
      "Acces officiel au droit de l UE (reglements, directives, jurisprudence).",
    geoCoverage: ['EU'],
  },
  {
    id: 'eu-open-data',
    name: 'EU Open Data Portal',
    tier: 1,
    access: 'free',
    domains: ['macro', 'market'],
    homepage: 'https://data.europa.eu',
    description:
      "Donnees ouvertes des institutions europeennes (Eurostat, Commission, agences sectorielles).",
    geoCoverage: ['EU'],
  },
  {
    id: 'worldbank',
    name: 'World Bank',
    tier: 1,
    access: 'free',
    domains: ['macro'],
    homepage: 'https://data.worldbank.org',
    description:
      'Indicateurs macroeconomiques mondiaux (PIB, inflation, demographie, dette publique).',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'ecb',
    name: 'European Central Bank',
    tier: 1,
    access: 'free',
    domains: ['macro'],
    homepage: 'https://data.ecb.europa.eu',
    description:
      "Statistiques monetaires et financieres de la zone euro.",
    geoCoverage: ['EU'],
  },

  // ===========================================================
  // TIER 2 - PREMIUM BYOK (deal data, financial, corporate intel)
  // ===========================================================
  {
    id: 'pitchbook',
    name: 'PitchBook',
    tier: 2,
    access: 'byok',
    domains: ['financial', 'market', 'team'],
    homepage: 'https://pitchbook.com',
    description:
      "Reference deal data VC/PE/M&A, profils investisseurs, comparables transactionnels.",
    envKey: 'PITCHBOOK_API_KEY',
    byokHint: 'https://pitchbook.com/data',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'crunchbase',
    name: 'Crunchbase Pro',
    tier: 2,
    access: 'byok',
    domains: ['financial', 'team'],
    homepage: 'https://www.crunchbase.com',
    description:
      "Base de donnees startups : levees, fondateurs, acquisitions. Tier 2 sur Pro, Tier 3 en gratuit.",
    envKey: 'CRUNCHBASE_API_KEY',
    byokHint: 'https://data.crunchbase.com',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'dealroom',
    name: 'Dealroom',
    tier: 2,
    access: 'byok',
    domains: ['financial', 'market'],
    homepage: 'https://dealroom.co',
    description:
      'Base europeenne de reference sur les startups et les levees, forte couverture EU/UK.',
    envKey: 'DEALROOM_API_KEY',
    byokHint: 'https://dealroom.co/api',
    geoCoverage: ['EU', 'UK'],
  },
  {
    id: 'cb-insights',
    name: 'CB Insights',
    tier: 2,
    access: 'byok',
    domains: ['market', 'financial'],
    homepage: 'https://www.cbinsights.com',
    description:
      'Intelligence sur les marches emergents, technologies, paysages competitifs.',
    envKey: 'CBINSIGHTS_API_KEY',
    byokHint: 'https://www.cbinsights.com/research',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'preqin',
    name: 'Preqin',
    tier: 2,
    access: 'byok',
    domains: ['financial'],
    homepage: 'https://www.preqin.com',
    description:
      'Reference sur les actifs alternatifs (PE, VC, immobilier, infrastructure, dette privee).',
    envKey: 'PREQIN_API_KEY',
    byokHint: 'https://www.preqin.com/api',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'sayari',
    name: 'Sayari',
    tier: 2,
    access: 'byok',
    domains: ['corporate'],
    homepage: 'https://sayari.com',
    description:
      "Specialiste des structures opaques : graphe global beneficiaires effectifs, juridictions offshore, sanctions.",
    envKey: 'SAYARI_API_KEY',
    byokHint: 'https://sayari.com/products/api',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'privco',
    name: 'PrivCo',
    tier: 2,
    access: 'byok',
    domains: ['financial'],
    homepage: 'https://www.privco.com',
    description:
      'Donnees financieres sur les entreprises privees americaines non cotees.',
    envKey: 'PRIVCO_API_KEY',
    geoCoverage: ['US'],
  },
  {
    id: 'bloomberg',
    name: 'Bloomberg Terminal',
    tier: 2,
    access: 'byok',
    domains: ['financial', 'macro', 'market'],
    homepage: 'https://www.bloomberg.com/professional',
    description:
      'Reference institutionnelle pour donnees marches, news, analytics, comparables cotes.',
    envKey: 'BLOOMBERG_API_KEY',
    byokHint: 'https://www.bloomberg.com/professional/support/api-library',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'refinitiv',
    name: 'Refinitiv',
    tier: 2,
    access: 'byok',
    domains: ['financial', 'market'],
    homepage: 'https://www.refinitiv.com',
    description:
      'Donnees de marche, fundamentals, M&A, deals (anciennement Thomson Reuters).',
    envKey: 'REFINITIV_API_KEY',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'sp-capital-iq',
    name: 'S&P Capital IQ',
    tier: 2,
    access: 'byok',
    domains: ['financial', 'market'],
    homepage: 'https://www.spglobal.com/marketintelligence',
    description:
      'Plateforme S&P : fundamentals, transactions, comparables sectoriels.',
    envKey: 'CAPITALIQ_API_KEY',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'factset',
    name: 'FactSet',
    tier: 2,
    access: 'byok',
    domains: ['financial', 'market'],
    homepage: 'https://www.factset.com',
    description:
      "Plateforme financiere institutionnelle, fundamentals et estimations consensus.",
    envKey: 'FACTSET_API_KEY',
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'patsnap',
    name: 'PatSnap',
    tier: 2,
    access: 'byok',
    domains: ['ip'],
    homepage: 'https://www.patsnap.com',
    description:
      'IP intelligence professionnelle : analyses portefeuilles brevets, freedom-to-operate, citations.',
    envKey: 'PATSNAP_API_KEY',
    geoCoverage: ['GLOBAL'],
  },

  // ===========================================================
  // TIER 3 - SIGNAUX FAIBLES (LinkedIn, presse spe, communautes)
  // ===========================================================
  {
    id: 'linkedin-proxycurl',
    name: 'LinkedIn (via Proxycurl)',
    tier: 3,
    access: 'byok',
    domains: ['team'],
    homepage: 'https://nubela.co/proxycurl',
    description:
      "Acces structure aux profils LinkedIn via API tierce. Verification de l existence reelle d un fondateur, parcours, contacts cles.",
    envKey: 'PROXYCURL_API_KEY',
    byokHint: 'https://nubela.co/proxycurl/pricing',
    mustHaveForDomain: ['team'],
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'reddit',
    name: 'Reddit',
    tier: 3,
    access: 'free',
    domains: ['market'],
    homepage: 'https://www.reddit.com',
    description:
      "Signal d adoption produit cote utilisateurs (subreddits cibles). Pertinent surtout pour consumer, gaming, crypto.",
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    tier: 3,
    access: 'free',
    domains: ['market', 'team'],
    homepage: 'https://news.ycombinator.com',
    description:
      "Signal communautaire technique : visibilite produit, mention d un fondateur, traction developpeurs.",
    geoCoverage: ['GLOBAL'],
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    tier: 3,
    access: 'free',
    domains: ['market'],
    homepage: 'https://www.producthunt.com',
    description:
      'Signal de lancement produit, traction early adopters, retours communaute.',
    geoCoverage: ['GLOBAL'],
  },

  // ===========================================================
  // TIER 4 - CONTEXTE (jamais decisif a soi seul)
  // ===========================================================
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    tier: 4,
    access: 'free',
    domains: ['context', 'market'],
    homepage: 'https://www.wikipedia.org',
    description:
      "Mise en contexte historique, sectorielle ou biographique. JAMAIS source decisive seule. Sert uniquement a situer un acteur, un marche, une trajectoire.",
    geoCoverage: ['GLOBAL'],
  },
];

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

export function getSourceById(id: string): SourceDescriptor | undefined {
  return SOURCES_REGISTRY.find((s) => s.id === id);
}

export function getSourcesByTier(tier: SourceTier): SourceDescriptor[] {
  return SOURCES_REGISTRY.filter((s) => s.tier === tier);
}

export function getSourcesByDomain(domain: SourceDomain): SourceDescriptor[] {
  return SOURCES_REGISTRY.filter((s) => s.domains.includes(domain));
}

export function getSourcesByAccess(access: AccessMode): SourceDescriptor[] {
  return SOURCES_REGISTRY.filter((s) => s.access === access);
}

/**
 * Sources BYOK configurables par l utilisateur dans Settings.
 * Inclut les 'byok' et les 'free-byok' (cles optionnelles pour quotas
 * eleves). Triees par tier puis par nom.
 */
export function getByokSources(): SourceDescriptor[] {
  return SOURCES_REGISTRY.filter(
    (s) => s.access === 'byok' || s.access === 'free-byok',
  ).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}

/**
 * Sources MUST-HAVE pour un domaine donne. Si aucune n est mobilisee
 * ou activee, le pipeline doit lever un flag 'instruction insuffisante'
 * sur ce domaine.
 */
export function getMustHaveSourcesForDomain(domain: SourceDomain): SourceDescriptor[] {
  return SOURCES_REGISTRY.filter((s) =>
    (s.mustHaveForDomain || []).includes(domain),
  );
}

/**
 * Calcule le tier dominant d un ensemble de sources mobilisees.
 * Utilise pour qualifier le niveau global d instruction d un dossier.
 *   - tier 1-2 : instruction solide
 *   - tier 3   : instruction partielle, complement requis
 *   - tier 4   : instruction insuffisante, scoring non fiable
 */
export function dominantTier(sourceIds: string[]): SourceTier | null {
  if (sourceIds.length === 0) return null;
  const tiers = sourceIds
    .map(getSourceById)
    .filter((s): s is SourceDescriptor => Boolean(s))
    .map((s) => s.tier);
  if (tiers.length === 0) return null;
  // Le tier dominant est le plus FORT (le plus petit numero) parmi les
  // sources mobilisees, ponderé par presence : si on a au moins 2 sources
  // de tier N, le tier dominant est N.
  const counts: Record<number, number> = {};
  for (const t of tiers) counts[t] = (counts[t] || 0) + 1;
  // On prend le tier le plus fort qui apparait au moins 2 fois, sinon
  // le plus fort tout court.
  for (const t of [1, 2, 3, 4] as SourceTier[]) {
    if ((counts[t] || 0) >= 2) return t;
  }
  return Math.min(...tiers) as SourceTier;
}

/**
 * Verdict d instruction global.
 * - 'solid'        : tier dominant 1 ou 2 ET au moins 3 sources differentes
 * - 'partial'      : tier dominant 3 OU moins de 3 sources differentes
 * - 'insufficient' : tier dominant 4 (essentiellement Wikipedia + presse)
 */
export type InstructionLevel = 'solid' | 'partial' | 'insufficient';

export function instructionLevel(sourceIds: string[]): InstructionLevel {
  const dom = dominantTier(sourceIds);
  if (dom == null) return 'insufficient';
  const uniqueCount = new Set(sourceIds).size;
  if (dom <= 2 && uniqueCount >= 3) return 'solid';
  if (dom === 4) return 'insufficient';
  return 'partial';
}

/**
 * Libelle court affichable a cote d une citation pour qualifier le tier.
 * Format : 'Tier 1 · Primaire' / 'Tier 4 · Contexte'.
 */
export function tierLabel(tier: SourceTier): string {
  switch (tier) {
    case 1: return 'Tier 1 · Primaire';
    case 2: return 'Tier 2 · Premium';
    case 3: return 'Tier 3 · Signal faible';
    case 4: return 'Tier 4 · Contexte';
  }
}
