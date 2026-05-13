// ============================================================
// PRELUDE - Sectoral Intelligence, couche d injection au pipeline
// ------------------------------------------------------------
// Sous-chantier 4 du chantier Sectoral Intelligence Layer.
// Branche la fiche sectorielle persistee en Supabase
// (sectoral_briefs) sur les six moteurs sectoriels du pipeline :
//
//   - macro-engine                    (Macro et Geopolitique)
//   - blindspot-engine                (Vigilance critique)
//   - contrarian-engine               (Singularites contrariennes)
//   - market-engine                   (Marche)
//   - fragility-structurelle          (Sept patterns Phase 4)
//   - narrative-drift-engine          (Lecture du langage)
//
// Le mapping doctrinal est defini decision 6 de la fiche
// conceptuelle (docs/patterns/sectoral-intelligence.md). Chaque
// moteur recoit en tete le resume editorial commun, puis les
// dimensions sectorielles qui lui sont doctrinalement attribuees.
// L injection est strictement hybride : pas d injection brute,
// pas d injection generique. Chaque moteur lit ce qui lui sert.
//
// Cas limites doctrinaux pris en charge :
//   (a) dossier multi-sectoriel : primaire integral plus encarts
//       courts pour les secondaires
//   (b) secteur emergent non couvert : injection desactivee,
//       methodologyNote pour la note d instruction
//   (c) fiche obsolete (>9 mois) : warning sobre conserve dans
//       le bloc inject pour que les moteurs en aient connaissance
//   (d) fiche perimee (>12 mois) : injection desactivee, retour
//       au fonctionnement sans contexte sectoriel
// ============================================================

import type { ExtractionOutput } from './types';
import type {
  DimensionKey,
  SectoralBrief,
  SectoralDimension,
} from './sectoral-intelligence/types';
import {
  DIMENSION_LABELS,
  SECTORS,
} from './sectoral-intelligence/types';
import { getLatestBriefForSector } from './sectoral-intelligence';

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
  { slug: 'cybersecurite-defense', keywords: [
    'defense', 'defence', 'militaire', 'isr', 'cybersecurite', 'cybersecurity',
    'cyber', 'securite cloud', 'souverainete numerique', 'dual-use', 'drone militaire',
    'identity security', 'edr', 'siem',
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
  ]},
  // Sante et biotech
  { slug: 'sante-biotech', keywords: [
    'sante', 'health', 'medtech', 'biotech', 'pharma', 'therapeutique', 'diagnostic',
    'digital health', 'medical device', 'dispositif medical', 'drug discovery',
    'clinical', 'clinique',
  ]},
  // Climat et energie
  { slug: 'climat-energie', keywords: [
    'climat', 'climate', 'energie', 'energy', 'renouvelable', 'renewable',
    'hydrogene', 'hydrogen', 'captation carbone', 'carbon', 'batterie', 'battery',
    'efficacite energetique', 'cleantech', 'solar', 'wind',
  ]},
  // Mobilite et logistique
  { slug: 'mobilite-logistique', keywords: [
    'mobilite', 'mobility', 'logistique', 'logistics', 'transport',
    'supply chain', 'fret', 'last mile', 'autonome', 'autonomous',
    'vehicule electrique', 'ev', 'rail', 'aviation', 'maritime',
  ]},
  // Industrie et hardware
  { slug: 'industrie-hardware', keywords: [
    'manufacturing', 'industrie', 'hardware', 'robotique', 'robotics',
    'semi-conducteur', 'semiconductor', 'deeptech industriel', 'industrie 4.0',
    'electronique', 'embarque', 'iot industriel',
  ]},
  // Agritech et foodtech
  { slug: 'agritech-foodtech', keywords: [
    'agritech', 'foodtech', 'agriculture', 'agroalimentaire', 'alternative protein',
    'agriculture verticale', 'vertical farming', 'biotech vegetal', 'packaging durable',
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
// CONTEXTE SECTORIEL TRANSPORTE AUX MOTEURS
// ------------------------------------------------------------
// Un objet unique partage par les six moteurs. Le champ mode
// porte la decision d injection. Les champs primary et
// secondaries portent les fiches reelles si mode='applied'.
// methodologyNote est destine a la section methode de la note
// d instruction : trace honnete de ce qui a ete fait ou non.
// ============================================================

export type SectoralContextMode =
  | 'applied'        // une fiche fraiche ou stale est injectee
  | 'unknown_sector' // secteur emergent non couvert dans le catalogue
  | 'no_brief'       // secteur reconnu mais aucune fiche persistee
  | 'expired';       // fiche perimee >12 mois, fallback no-injection

export interface SectoralPrimary {
  brief: SectoralBrief;
  freshness: SectoralFreshness; // 'fresh' ou 'stale' uniquement quand mode=applied
  ageDays: number;
}

export interface SectoralSecondary {
  brief: SectoralBrief;
  freshness: SectoralFreshness;
  ageDays: number;
}

export interface SectoralContext {
  mode: SectoralContextMode;
  detectedSlugs: string[];      // brut de detectSectorSlugs, audit
  primary: SectoralPrimary | null;
  secondaries: SectoralSecondary[];
  // Trace pour la section methode de la note d instruction. Toujours
  // renseigne, meme en mode applied (mention sobre du contexte).
  methodologyNote: string;
}

// ============================================================
// MAPPING DOCTRINAL DIMENSIONS PAR MOTEUR
// ------------------------------------------------------------
// Decision 6 de la fiche conceptuelle. Une cle par moteur, une
// liste de dimensions a injecter en sus du resume editorial.
// L ordre du tableau est l ordre d apparition dans le bloc
// inject : on commence par la dimension la plus structurante
// pour le moteur cible.
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
    // Pas d autre dimension : Market regoit en sus le narrative_summary
    // (resume editorial), traite comme bloc commun. La dimension figure
    // ici pour transporter la charge concurrentielle structurelle.
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

// Mapping des patterns Phase 4 que l injection sectorielle active
// prioritairement dans le prompt fragility-structurelle. Decision 6
// de la fiche : intensite haute active Fixed Cost Trap, combinaison
// intensite + cyclicite active Capital Structure Fragility, tension
// capital-talent eleve active Execution Friction (signal pour le
// pattern Regulatory Time Bomb si secteur lourdement regule par
// ailleurs). Le LLM recoit la mention, charge a lui de pondereer
// avec les autres signaux du dossier.
const FRAGILITY_PATTERN_ACTIVATION_HINTS: Array<{
  trigger: (dims: SectoralBrief['dimensions']) => boolean;
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
// RESOLUTION DU CONTEXTE SECTORIEL
// ------------------------------------------------------------
// Charge la fiche primaire en Supabase via getLatestBriefForSector
// et les fiches secondaires (au plus deux). Determine le mode
// d injection selon la fraicheur et le succes des lookups. Aucun
// throw : toute erreur Supabase ramene un contexte 'no_brief' avec
// methodologyNote explicite, le pipeline doit pouvoir continuer.
// ============================================================

export interface ResolveOptions {
  /** Injection de dependance pour les tests deterministes. Si absent,
   *  utilise getLatestBriefForSector(slug) sur Supabase. */
  fetchBrief?: (slug: string) => Promise<SectoralBrief | null>;
  /** Date courante mockable pour les tests de fraicheur. */
  now?: Date;
}

export async function resolveSectoralContext(
  extraction: ExtractionOutput,
  options: ResolveOptions = {},
): Promise<SectoralContext> {
  const now = options.now ?? new Date();
  const fetchBrief = options.fetchBrief ?? getLatestBriefForSector;

  const slugs = detectSectorSlugs(extraction);
  if (slugs.length === 0) {
    return {
      mode: 'unknown_sector',
      detectedSlugs: [],
      primary: null,
      secondaries: [],
      methodologyNote:
        'Ce dossier opere dans un secteur emergent qui ne fait pas encore l objet d une fiche sectorielle Prelude active. La lecture s appuie donc sur le seul contenu du dossier et sur la doctrine generale des moteurs.',
    };
  }

  const primarySlug = slugs[0];
  const secondarySlugs = slugs.slice(1, 3);

  let primaryBrief: SectoralBrief | null = null;
  try {
    primaryBrief = await fetchBrief(primarySlug);
  } catch (err: any) {
    // Acces Supabase en echec : on ne casse pas le pipeline.
    console.warn(`[sectoral-injection] fetch primary brief failed for ${primarySlug}:`, err?.message);
    primaryBrief = null;
  }

  if (!primaryBrief) {
    const label = SECTORS.find((s) => s.slug === primarySlug)?.label ?? primarySlug;
    return {
      mode: 'no_brief',
      detectedSlugs: slugs,
      primary: null,
      secondaries: [],
      methodologyNote: `Le secteur primaire detecte est ${label} mais aucune fiche sectorielle Prelude n est encore persistee pour ce secteur. La lecture s appuie sur le seul contenu du dossier en attendant la prochaine regeneration trimestrielle.`,
    };
  }

  const primaryFreshness = computeFreshness(primaryBrief.generated_at, now);

  if (primaryFreshness.freshness === 'expired') {
    const label = SECTORS.find((s) => s.slug === primarySlug)?.label ?? primarySlug;
    return {
      mode: 'expired',
      detectedSlugs: slugs,
      primary: null,
      secondaries: [],
      methodologyNote: `La fiche sectorielle ${label} disponible date du ${formatDate(primaryBrief.generated_at)} et depasse le seuil de douze mois sans regeneration. L injection sectorielle est desactivee pour ne pas contaminer l analyse avec une lecture perimee.`,
    };
  }

  // Mode applied : on tente de recuperer les secondaires, sans bloquer
  // sur leurs eventuelles absences ou peremptions.
  const secondaries: SectoralSecondary[] = [];
  for (const slug of secondarySlugs) {
    let brief: SectoralBrief | null = null;
    try {
      brief = await fetchBrief(slug);
    } catch (err: any) {
      console.warn(`[sectoral-injection] fetch secondary brief failed for ${slug}:`, err?.message);
      continue;
    }
    if (!brief) continue;
    const sFreshness = computeFreshness(brief.generated_at, now);
    if (sFreshness.freshness === 'expired') continue;
    secondaries.push({
      brief,
      freshness: sFreshness.freshness,
      ageDays: sFreshness.ageDays,
    });
  }

  const primaryLabel = SECTORS.find((s) => s.slug === primaryBrief!.sector_slug)?.label
    ?? primaryBrief!.sector_slug;
  const secondaryLabels = secondaries
    .map((s) => SECTORS.find((sd) => sd.slug === s.brief.sector_slug)?.label ?? s.brief.sector_slug)
    .filter(Boolean);

  let methodologyNote = `Secteur primaire ${primaryLabel}, fiche du ${formatDate(primaryBrief.generated_at)}`;
  if (secondaryLabels.length > 0) {
    methodologyNote += `, secteurs secondaires ${secondaryLabels.join(' et ')}`;
  }
  methodologyNote += '.';
  if (primaryFreshness.freshness === 'stale') {
    methodologyNote += ` La fiche depasse neuf mois (age ${Math.floor(primaryFreshness.ageDays / 30)} mois), une regeneration est attendue au prochain cycle trimestriel.`;
  }

  return {
    mode: 'applied',
    detectedSlugs: slugs,
    primary: {
      brief: primaryBrief,
      freshness: primaryFreshness.freshness,
      ageDays: primaryFreshness.ageDays,
    },
    secondaries,
    methodologyNote,
  };
}

function formatDate(iso: string): string {
  // Format court FR sans em-dash. Tolerant aux entrees malformees.
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

// ============================================================
// CONSTRUCTION DU BLOC INJECTE DANS LE PROMPT MOTEUR
// ------------------------------------------------------------
// Helper unique partage par les six moteurs. Retourne chaine
// vide si mode != applied : le moteur tourne alors sans contexte
// sectoriel, comportement legacy preserve.
//
// Format du bloc : voix editoriale Le Grand Continent, prose
// dense, peu de listes. Le resume editorial commun ouvre, puis
// les dimensions selectives, puis pour fragility le rappel des
// patterns Phase 4 actives, puis pour les dossiers multi-sectoriels
// l encart secondaires.
// ============================================================

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

  // Resume editorial commun. Tronque a 1500 caracteres pour rester
  // dans le contrat doctrinal (decision 6).
  const summary = (primary.brief.narrative_summary || '').slice(0, TRUNCATE_NARRATIVE_SUMMARY_CHARS);
  if (summary.length > 0) {
    lines.push('Resume editorial sectoriel (recit dominant du secteur au moment de l analyse) :');
    lines.push(summary);
    lines.push('');
  }

  // Dimensions selectives selon le mapping doctrinal.
  const dimensionKeys = ENGINE_DIMENSION_MAP[engineKey];
  if (dimensionKeys && dimensionKeys.length > 0) {
    lines.push('Dimensions sectorielles attribuees doctrinalement a ce moteur :');
    for (const key of dimensionKeys) {
      const dim = primary.brief.dimensions[key];
      lines.push(renderDimension(key, dim));
    }
    lines.push('');
  }

  // Pour Fragilite Structurelle, on rappelle les patterns Phase 4
  // actives prioritairement par la fiche sectorielle. Le LLM
  // pattern-specifique peut prendre l information ou la mettre en
  // sourdine selon ce qu il observe sur le dossier lui-meme.
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

  // Encart secondaires pour les dossiers multi-sectoriels. Court par
  // discipline (un paragraphe par secteur secondaire).
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
  // On limite la definition appliquee a 240 caracteres pour ne pas
  // gonfler le prompt avec la fiche doctrinale complete.
  const definition = (dim.definition_applied || '').slice(0, 240);
  const notes = (dim.notes || '').slice(0, 240);
  let line = `- ${label} : score ${score}${confidence}.`;
  if (definition) line += ` Definition appliquee : ${definition}`;
  if (notes) line += ` Lecture editoriale : ${notes}`;
  return line;
}
