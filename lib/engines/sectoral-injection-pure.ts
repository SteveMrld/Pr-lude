// ============================================================
// PRELUDE - Helpers purs de la couche d injection sectorielle
// ------------------------------------------------------------
// Surface client-safe extraite de sectoral-injection.ts. Aucun
// import statique de lib/supabase/server, aucune chaine qui
// remonte vers next/headers : ce fichier peut etre importe par
// des composants 'use client' sans casser le build webpack.
//
// La couche complete (resolveSectoralContext qui lit en Supabase)
// reste dans sectoral-injection.ts. Ce fichier porte les helpers
// purs : seuils doctrinaux de fraicheur, detection de slugs a
// partir du libelle libre extrait par le LLM, mapping doctrinal
// dimensions par moteur, hints d activation des patterns Phase 4.
//
// Voir le bug Vercel resolu : un composant client qui importait
// computeFreshness depuis sectoral-injection.ts tirait toute la
// chaine getLatestBriefForSector -> supabase/server -> next/headers
// et faisait planter le build. La separation isole proprement la
// surface client-safe de la surface server-only.
// ============================================================

import type { ExtractionOutput } from './types';
import type {
  DimensionKey,
  SectoralBrief,
  SectoralDimension,
  SectoralBriefDimensions,
} from './sectoral-intelligence/types';
import {
  DIMENSION_LABELS,
  SECTORS,
} from './sectoral-intelligence/types';

// ============================================================
// FRAICHEUR ET SEUILS DOCTRINAUX
// ------------------------------------------------------------
// Trimestriel plus un trimestre de buffer (>9 mois) declenche
// l avertissement. Au dela d un an, la fiche n est plus injectee :
// le risque de contaminer l analyse avec une lecture sectorielle
// perimee depasse le benefice d un ancrage stale.
// ============================================================

export const STALE_THRESHOLD_DAYS = 9 * 30; // ~270 jours
export const EXPIRED_THRESHOLD_DAYS = 12 * 30; // ~360 jours

export type SectoralFreshness = 'fresh' | 'stale' | 'expired';

export function computeFreshness(generatedAt: string, now: Date = new Date()): {
  freshness: SectoralFreshness;
  ageDays: number;
} {
  const generated = new Date(generatedAt);
  const ageMs = now.getTime() - generated.getTime();
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  let freshness: SectoralFreshness;
  if (ageDays >= EXPIRED_THRESHOLD_DAYS) freshness = 'expired';
  else if (ageDays >= STALE_THRESHOLD_DAYS) freshness = 'stale';
  else freshness = 'fresh';
  return { freshness, ageDays };
}

// ============================================================
// MAPPING SECTEUR LIBRE -> SLUG CATALOGUE
// ------------------------------------------------------------
// extraction.sector et extraction.subSector sont libres (LLM
// d extraction). Cette table de keywords mappe les libelles
// frequents vers les treize slugs du catalogue. Conservatrice
// par discipline : un libelle qu on ne reconnait pas est
// laisse en unknown plutot que mappe par defaut sur un slug
// arbitraire. La note d instruction doit alors signaler que
// le secteur n est pas couvert (cas limite b).
// ============================================================

interface SlugMatcher {
  slug: string;
  // Mots-cle a comparer en lowercase et sans diacritiques. Si
  // un mot-cle apparait dans le texte normalise (sector +
  // subSector + productDescription tronque), le slug est match.
  // Ordre des regles : les plus specifiques en premier pour eviter
  // les collisions (insurtech avant fintech, edtech avant SaaS).
  keywords: string[];
}

const SLUG_MATCHERS: SlugMatcher[] = [
  // Defense et cybersecurite (avant industrie/hardware qui peut sinon capturer drone)
  // FR ajoute : armement, armee, dga, naval group, mbda, thales, safran
  // (ecosysteme defense francais frequent en pitch).
  { slug: 'cybersecurite-defense', keywords: [
    'defense', 'defence', 'militaire', 'isr', 'cybersecurite', 'cybersecurity',
    'cyber', 'securite cloud', 'souverainete numerique', 'dual-use', 'drone militaire',
    'identity security', 'edr', 'siem',
    'armement', 'armee', 'army', 'dga', 'mbda', 'naval group', 'thales', 'safran',
    'gendarmerie', 'arianegroup',
  ]},
  // Crypto et blockchain
  { slug: 'crypto-blockchain', keywords: [
    'crypto', 'blockchain', 'defi', 'web3', 'stablecoin', 'token',
    'tokenisation', 'l1', 'l2', 'custody',
  ]},
  // Insurtech et fintech (insurtech avant fintech pour priorite, meme slug ici)
  { slug: 'fintech', keywords: [
    'fintech', 'insurtech', 'banque', 'banking', 'neobanque', 'paiement', 'payment',
    'kyc', 'wealth tech', 'lending', 'pret', 'embedded finance', 'bnpl',
    'compliance financiere', 'aml',
    'assurance', 'mutuelle', 'agrement acpr', 'orias', 'amf',
  ]},
  // Sante et biotech
  // FR ajoute : hopital, medecin, ehpad, ars, cpam, soins, infirmier
  // (etablissements et professions reglementees frequents en pitch FR).
  { slug: 'sante-biotech', keywords: [
    'sante', 'health', 'medtech', 'biotech', 'pharma', 'therapeutique', 'diagnostic',
    'digital health', 'medical device', 'dispositif medical', 'drug discovery',
    'clinical', 'clinique',
    'hopital', 'medecin', 'medecine', 'ehpad', 'soins', 'infirmier', 'kinesitherapeute',
    'pharmacie', 'officine', 'imagerie medicale', 'biologie medicale',
    'agrement ars', 'taxi cpam', 'transport sanitaire',
  ]},
  // Industrie et hardware. DEPLACE AVANT climat-energie : un dossier
  // industriel qui mentionne batterie / energie / decarbonation matche
  // les deux en substring, mais doctrinalement c est avant tout un
  // hardware. Cas Platypus Craft : pitch construction navale mentionnant
  // propulsion electrique marine matchait climat-energie en primaire
  // avant ce reordering.
  //
  // FR ajoute : naval, navale, navire, nautique, nautisme, bateau,
  // sous-marin, submersible, chantier naval, shipbuilding (construction
  // hardware maritime, cas Platypus Craft). Le mot 'maritime' SEUL est
  // intentionnellement EXCLU : trop large, matchait aussi les dossiers
  // d energies marines (hydrolien, EMR) et de fret maritime. Pour
  // capturer la construction navale FR, on s appuie sur les keywords
  // doctrinaux precis (naval, navire, chantier naval, etc.).
  { slug: 'industrie-hardware', keywords: [
    'manufacturing', 'industrie', 'hardware', 'robotique', 'robotics',
    'semi-conducteur', 'semiconductor', 'deeptech industriel', 'industrie 4.0',
    'electronique', 'embarque', 'iot industriel',
    // FR maritime / naval (vocabulaire de construction navale propre,
    // sans 'maritime' generique)
    'naval', 'navale', 'navire', 'navires', 'nautique', 'nautisme',
    'bateau', 'bateaux', 'sous-marin', 'submersible',
    'semi-submersible', 'chantier naval', 'shipbuilding', 'shipyard',
    'foilboard',
    // FR industrie elargie
    'usine', 'fabrication', 'industrialisation', 'aerospatial', 'aeronautique',
    'spatial', 'aerospace', 'satellite',
  ]},
  // Climat et energie
  // FR ajoute : energies marines / EMR, eolien, photovoltaique, hydrolien,
  // geothermie, solaire (vocabulaire energie FR frequent).
  { slug: 'climat-energie', keywords: [
    'climat', 'climate', 'energie', 'energy', 'renouvelable', 'renewable',
    'hydrogene', 'hydrogen', 'captation carbone', 'carbon', 'batterie', 'battery',
    'efficacite energetique', 'cleantech', 'solar', 'wind',
    'eolien', 'eolien offshore', 'photovoltaique', 'hydrolien',
    'energies marines', 'energie marine', 'emr', 'geothermie',
    'solaire', 'biomasse', 'transition energetique',
  ]},
  // Mobilite et logistique. ATTENTION : 'maritime' a ete retire des
  // keywords pour ne plus siphonner les dossiers de construction navale
  // (cas Platypus Craft : maritime matchait ici, le dossier ressortait
  // en mobilite-logistique au lieu d industrie-hardware). Le fret
  // maritime reste capture par 'fret', 'shipping', 'last mile'.
  { slug: 'mobilite-logistique', keywords: [
    'mobilite', 'mobility', 'logistique', 'logistics', 'transport',
    'supply chain', 'fret', 'last mile', 'autonome', 'autonomous',
    'vehicule electrique', 'ev', 'rail', 'ferroviaire', 'aviation civile',
    'shipping', 'freight forwarding',
  ]},
  // Agritech et foodtech
  // FR ajoute : aquaculture, pisciculture, elevage, viticulture
  // (filieres agri FR frequentes).
  { slug: 'agritech-foodtech', keywords: [
    'agritech', 'foodtech', 'agriculture', 'agroalimentaire', 'alternative protein',
    'agriculture verticale', 'vertical farming', 'biotech vegetal', 'packaging durable',
    'aquaculture', 'pisciculture', 'elevage', 'viticulture', 'oenologie',
    'ferme', 'maraichage', 'horticulture',
  ]},
  // Proptech et construction
  { slug: 'proptech-construction', keywords: [
    'proptech', 'immobilier', 'real estate', 'construction', 'bim',
    'materiaux bas carbone', 'gestion locative', 'marketplace immobiliere',
  ]},
  // Education et future of work (avant SaaS horizontal pour edtech, hr tech advance)
  { slug: 'education-future-of-work', keywords: [
    'edtech', 'education', 'formation', 'certification', 'marketplace talent',
    'future of work', 'apprenant',
  ]},
  // IA appliquee (avant logiciel horizontal : un dossier IA peut etre mal classe SaaS)
  { slug: 'ia-appliquee', keywords: [
    'ia', 'ai', 'intelligence artificielle', 'machine learning', 'ml',
    'llm', 'generative ai', 'agent autonome', 'rag', 'fine-tuning',
    'mlops', 'gpu cloud', 'foundation model', 'modele fondation',
  ]},
  // Commerce et marketplaces verticales
  { slug: 'commerce-marketplaces', keywords: [
    'e-commerce', 'ecommerce', 'commerce', 'marketplace', 'd2c', 'dtc',
    'social commerce', 'retail tech', 'retail',
  ]},
  // Logiciel d entreprise horizontal (dernier filet : englobe SaaS generique)
  { slug: 'logiciel-entreprise-horizontal', keywords: [
    'saas', 'b2b software', 'productivity', 'collaboration', 'dev tools',
    'erp', 'crm', 'itsm', 'hr tech', 'cloud', 'enterprise software',
    'logiciel entreprise',
  ]},
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Identifie le secteur primaire et au plus deux secondaires a partir de
 * l extraction. Ordre des matchers preserve : on parcourt SLUG_MATCHERS
 * et on collecte les slugs hits dans l ordre rencontre. Le premier hit
 * est le primaire, les deux suivants (distincts) sont les secondaires.
 *
 * Retourne un tableau vide si aucun mapping ne se laisse trancher : la
 * couche d injection cale alors le mode sur 'sector_unknown'.
 */
export function detectSectorSlugs(extraction: ExtractionOutput): string[] {
  const haystack = normalize(
    [
      extraction.sector || '',
      extraction.subSector || '',
      // On limite le productDescription a 400 caracteres pour ne pas
      // diluer le signal sectoriel dans les details produit.
      (extraction.productDescription || '').slice(0, 400),
    ].join(' '),
  );

  const matched: string[] = [];
  for (const matcher of SLUG_MATCHERS) {
    for (const kw of matcher.keywords) {
      // Recherche de mot complet pour eviter que "ia" matche "via",
      // "ai" matche "main", etc. On accepte les frontieres
      // alphanumeriques sur les keywords courts.
      const pattern = kw.length <= 3
        ? new RegExp(`(^|\\s)${kw}(\\s|$)`, 'i')
        : new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (pattern.test(haystack)) {
        if (!matched.includes(matcher.slug)) matched.push(matcher.slug);
        break;
      }
    }
    if (matched.length >= 3) break;
  }

  return matched;
}

// ============================================================
// TYPES DE CONTEXTE SECTORIEL
// ------------------------------------------------------------
// Resultat de resolveSectoralContext (defini dans sectoral-injection.ts).
// Les types vivent ici parce qu ils sont consommes par
// buildSectoralPromptBlock (pur) et par certains tests qui
// n ont pas besoin de la resolution Supabase.
// ============================================================

export type SectoralContextMode =
  | 'applied'
  | 'unknown_sector'
  | 'no_brief'
  | 'expired';

export interface SectoralPrimary {
  brief: SectoralBrief;
  freshness: SectoralFreshness;
  ageDays: number;
}

export interface SectoralSecondary {
  brief: SectoralBrief;
  freshness: SectoralFreshness;
  ageDays: number;
}

export interface SectoralContext {
  mode: SectoralContextMode;
  detectedSlugs: string[];
  primary: SectoralPrimary | null;
  secondaries: SectoralSecondary[];
  methodologyNote: string;
}

// ============================================================
// MAPPING DOCTRINAL DIMENSIONS PAR MOTEUR
// ============================================================

export type SectoralEngineKey =
  | 'macro'
  | 'blindspot'
  | 'contrarian'
  | 'market'
  | 'fragility-structurelle'
  | 'narrative-drift';

export const ENGINE_DIMENSION_MAP: Record<SectoralEngineKey, DimensionKey[]> = {
  macro: [
    'cyclicite_macroeconomique',
    'exposition_geopolitique',
    'pression_reglementaire',
  ],
  blindspot: [
    'concentration_concurrentielle',
    'velocite_technologique',
  ],
  contrarian: [
    'velocite_technologique',
    'concentration_concurrentielle',
    'intensite_capitalistique',
  ],
  market: [
    'concentration_concurrentielle',
  ],
  'fragility-structurelle': [
    'intensite_capitalistique',
    'cyclicite_macroeconomique',
    'tension_capital_talent',
  ],
  'narrative-drift': [
    'vulnerabilite_narrative_sectorielle',
  ],
};

// Hints d activation des patterns Phase 4 selon la fiche
// sectorielle. Aucun appel Supabase, c est de la logique pure.
export const FRAGILITY_PATTERN_ACTIVATION_HINTS: Array<{
  trigger: (dims: SectoralBriefDimensions) => boolean;
  pattern: string;
  rationale: string;
}> = [
  {
    trigger: (d) => (d.intensite_capitalistique?.score ?? 0) >= 65,
    pattern: 'Fixed Cost Trap',
    rationale: 'intensite capitalistique sectorielle haute, structure de couts incompressibles probable',
  },
  {
    trigger: (d) =>
      (d.intensite_capitalistique?.score ?? 0) >= 60 &&
      (d.cyclicite_macroeconomique?.score ?? 0) >= 60,
    pattern: 'Capital Structure Fragility',
    rationale: 'intensite plus cyclicite hautes simultanement, sensibilite forte aux deratings de cycle',
  },
  {
    trigger: (d) => (d.tension_capital_talent?.score ?? 0) >= 70,
    pattern: 'Execution Friction (signal RH)',
    rationale: 'tension capital-talent sectorielle elevee, friction de recrutement et retention probable',
  },
];

// ============================================================
// HELPERS DE FORMATAGE ET CONSTRUCTION DU BLOC PROMPT
// ============================================================

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

const TRUNCATE_NARRATIVE_SUMMARY_CHARS = 1500;

export function buildSectoralPromptBlock(
  context: SectoralContext | null | undefined,
  engineKey: SectoralEngineKey,
): string {
  if (!context || context.mode !== 'applied' || !context.primary) {
    return '';
  }

  const { primary, secondaries } = context;
  const primaryLabel = SECTORS.find((s) => s.slug === primary.brief.sector_slug)?.label
    ?? primary.brief.sector_slug;

  const lines: string[] = [];
  lines.push('--- LECTURE SECTORIELLE PRELUDE (injection hybride) ---');
  lines.push('');
  lines.push(`Secteur primaire du dossier : ${primaryLabel}. Fiche generee le ${formatDate(primary.brief.generated_at)}, age ${primary.ageDays} jours.`);
  if (primary.freshness === 'stale') {
    lines.push('Avertissement : la fiche depasse neuf mois, une regeneration est attendue au prochain cycle trimestriel. Pondere les signaux les plus mobiles (vulnerabilite narrative, pression reglementaire, velocite technologique) en consequence.');
  }
  lines.push('');

  const summary = (primary.brief.narrative_summary || '').slice(0, TRUNCATE_NARRATIVE_SUMMARY_CHARS);
  if (summary.length > 0) {
    lines.push('Resume editorial sectoriel (recit dominant du secteur au moment de l analyse) :');
    lines.push(summary);
    lines.push('');
  }

  const dimensionKeys = ENGINE_DIMENSION_MAP[engineKey];
  if (dimensionKeys && dimensionKeys.length > 0) {
    lines.push('Dimensions sectorielles attribuees doctrinalement a ce moteur :');
    for (const key of dimensionKeys) {
      const dim = primary.brief.dimensions[key];
      lines.push(renderDimension(key, dim));
    }
    lines.push('');
  }

  if (engineKey === 'fragility-structurelle') {
    const hints = FRAGILITY_PATTERN_ACTIVATION_HINTS.filter((h) => h.trigger(primary.brief.dimensions));
    if (hints.length > 0) {
      lines.push('Patterns Phase 4 que cette fiche sectorielle active prioritairement :');
      for (const h of hints) {
        lines.push(`- ${h.pattern} : ${h.rationale}.`);
      }
      lines.push('Ces signaux sectoriels ne forcent pas la detection du pattern sur ce dossier, ils calibrent la sensibilite. Tu confirmes par les faits du dossier, sinon tu acquittes l absence.');
      lines.push('');
    }
  }

  if (secondaries.length > 0) {
    lines.push('Secteurs secondaires (le dossier croise plusieurs secteurs) :');
    for (const sec of secondaries) {
      const secLabel = SECTORS.find((s) => s.slug === sec.brief.sector_slug)?.label ?? sec.brief.sector_slug;
      const secSummary = (sec.brief.narrative_summary || '').slice(0, 600);
      lines.push(`- ${secLabel} (fiche du ${formatDate(sec.brief.generated_at)}) : ${secSummary}`);
    }
    lines.push('');
  }

  lines.push('Tu integres cette lecture sectorielle dans ton analyse en l articulant aux signaux du dossier. Tu ne dois pas la recopier passivement. Quand la lecture sectorielle contredit le pitch (ex : pitch qui revendique un marche fragmente sur un secteur dont la fiche acte une concentration extreme), tu le signales explicitement.');
  lines.push('--- FIN LECTURE SECTORIELLE ---');
  lines.push('');

  return lines.join('\n');
}

function renderDimension(key: DimensionKey, dim: SectoralDimension | undefined): string {
  const label = DIMENSION_LABELS[key];
  if (!dim || dim.data_missing) {
    return `- ${label} : donnee insuffisante dans la fiche, dimension non pondereable par ce moteur.`;
  }
  const score = dim.score === null ? 'non chiffre' : `${dim.score}/100`;
  const confidence = dim.confidence ? ` (confiance ${dim.confidence})` : '';
  const definition = (dim.definition_applied || '').slice(0, 240);
  const notes = (dim.notes || '').slice(0, 240);
  let line = `- ${label} : score ${score}${confidence}.`;
  if (definition) line += ` Definition appliquee : ${definition}`;
  if (notes) line += ` Lecture editoriale : ${notes}`;
  return line;
}
