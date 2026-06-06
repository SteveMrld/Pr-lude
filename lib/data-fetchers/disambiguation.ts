// ============================================================
// DESAMBIGUISATION DES SOURCES FONDATEURS
// ------------------------------------------------------------
// Module pur (sans I/O) qui applique trois portes a tout candidat
// retourne par OpenAlex, GitHub, Wikipedia, arXiv :
//
//   1. Porte temporelle : la trace doit etre compatible avec une
//      fenetre active plausible du fondateur. Si l age ou l annee
//      de naissance est connu, fenetre = [naissance + 18, aujourd hui].
//      Sinon fallback conservateur : exclure tout signal anterieur a
//      aujourd hui moins 50 ans.
//
//   2. Porte de coherence de domaine : le champ de la publication
//      doit etre coherent avec le secteur du dossier. Des marqueurs
//      flagrants d obsolescence (magnetisme animal, revolutions du
//      globe, etc.) sont rejetes en dur.
//
//   3. Echec ferme par defaut : si les signaux survivants sont
//      insuffisants pour conclure, la decision est
//      'insufficient_disambiguation' et l appelant DOIT mettre le
//      score correspondant a null (non evaluable) plutot que de
//      sortir un chiffre objectif faussement rassurant.
//
// Ce module est conçu pour etre teste unitairement sans appel reseau.
// Le cas Platypus (fondateur ~50 ans avec publis 1863 et 1974 attribuees
// par OpenAlex) est le cas de non-regression de reference.
// ============================================================

const ADULT_OFFSET_YEARS = 18;
const FALLBACK_MAX_YEARS = 50;
const DEFAULT_MIN_KEEP_RATIO = 0.5;

export interface FounderDisambiguationContext {
  /** Nom du fondateur tel qu il est passe au matching */
  name: string;
  /** Secteur du dossier (extraction.sector) */
  sector?: string;
  /** Sous-secteur eventuel (extraction.subSector) */
  subSector?: string;
  /** Annee de naissance si connue (recommande) */
  birthYear?: number;
  /** Age declare ou estime si annee de naissance inconnue */
  ageHint?: number;
}

export interface DisambiguationGate {
  passed: boolean;
  reason: string;
}

export type DisambiguationDecision = 'evaluable' | 'insufficient_disambiguation';

export interface DisambiguationResult<T> {
  kept: T[];
  rejected: Array<{ item: T; reason: string }>;
  decision: DisambiguationDecision;
  rationale: string;
}

export interface PlausibleWindow {
  min: number;
  max: number;
  source: 'birth' | 'age' | 'fallback';
}

export function plausibleWindow(
  person: FounderDisambiguationContext,
  today: number = new Date().getFullYear(),
): PlausibleWindow {
  if (person.birthYear && person.birthYear > 1900 && person.birthYear <= today) {
    return { min: person.birthYear + ADULT_OFFSET_YEARS, max: today, source: 'birth' };
  }
  if (person.ageHint && person.ageHint > 0 && person.ageHint < 120) {
    const birthYear = today - person.ageHint;
    return { min: birthYear + ADULT_OFFSET_YEARS, max: today, source: 'age' };
  }
  return { min: today - FALLBACK_MAX_YEARS, max: today, source: 'fallback' };
}

export function temporalGate(
  year: number | null | undefined,
  person: FounderDisambiguationContext,
  today: number = new Date().getFullYear(),
): DisambiguationGate {
  if (!year || year < 1500) {
    return { passed: false, reason: `annee invalide (${year ?? 'inconnue'})` };
  }
  const w = plausibleWindow(person, today);
  if (year < w.min) {
    return {
      passed: false,
      reason: `annee ${year} anterieure a la fenetre plausible [${w.min}, ${w.max}] (source: ${w.source})`,
    };
  }
  if (year > w.max + 1) {
    return { passed: false, reason: `annee ${year} posterieure a aujourd hui (${w.max})` };
  }
  return { passed: true, reason: `annee ${year} dans la fenetre [${w.min}, ${w.max}] (source: ${w.source})` };
}

// ============================================================
// PORTE COHERENCE DE DOMAINE
// ============================================================

const SECTOR_KEYWORDS: Record<string, string[]> = {
  software: [
    'software', 'computer science', 'computing', 'algorithm', 'programming',
    'data science', 'logiciel', 'informatique', 'cybersecurity',
  ],
  ai: [
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'natural language processing', 'computer vision', 'transformer', 'llm',
    'reinforcement learning', 'intelligence artificielle',
  ],
  hardware: [
    'hardware', 'electronics', 'semiconductor', 'circuit', 'embedded',
    'mechanical engineering', 'mechatronics',
  ],
  naval: [
    'naval', 'marine', 'maritime', 'shipbuilding', 'shipping', 'vessel',
    'ocean engineering', 'submarine', 'port', 'cargo', 'navire',
  ],
  aerospace: [
    'aerospace', 'aeronautics', 'aviation', 'rocket', 'spacecraft', 'satellite',
    'drone', 'uav', 'avionics', 'aeronautique',
  ],
  automotive: [
    'automotive', 'vehicle', 'transportation engineering', 'mobility',
    'autonomous driving',
  ],
  energy: [
    'energy', 'renewable', 'solar', 'wind', 'battery', 'electric power',
    'photovoltaic', 'grid', 'hydrogen', 'nuclear',
  ],
  biotech: [
    'biotechnology', 'molecular biology', 'genomics', 'pharmacology', 'medicine',
    'biochemistry', 'biology', 'oncology', 'immunology', 'biotech',
  ],
  medtech: [
    'medical device', 'health', 'clinical', 'diagnostic', 'therapy',
    'medtech', 'healthcare',
  ],
  fintech: [
    'finance', 'banking', 'payment', 'blockchain', 'cryptocurrency',
    'economics', 'fintech', 'insurance',
  ],
  climate: [
    'climate', 'carbon', 'sustainability', 'environment', 'greenhouse',
    'climatech', 'decarbonation',
  ],
  agritech: [
    'agriculture', 'agronomy', 'farming', 'crop', 'food science',
    'agritech', 'foodtech',
  ],
  industrial: [
    'industrial', 'manufacturing', 'usine', 'factory', 'supply chain',
    'logistics', 'robotics',
  ],
};

const OBSOLETE_OR_OFF_DOMAIN_MARKERS = [
  'magnetisme animal', 'animal magnetism', 'mesmer',
  'revolutions du globe', 'phlogiston', 'alchemy', 'alchimie',
  'natural philosophy', 'theologie', 'theology',
  'medieval studies', 'classical antiquity',
  'phrenologie', 'phrenology', 'spiritisme', 'spiritism',
];

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function gatherSectorKeywords(sector?: string, subSector?: string): string[] {
  const both = [sector, subSector].filter(Boolean).map(normalize).join(' ');
  if (!both) return [];
  const matched: Set<string> = new Set();
  for (const [, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    for (const kw of keywords) {
      const nkw = normalize(kw);
      if (both.includes(nkw) || nkw.includes(both.split(/\s+/)[0])) {
        keywords.forEach((k) => matched.add(k));
        break;
      }
    }
  }
  return Array.from(matched);
}

export interface DomainSignals {
  concepts?: string[];
  title?: string;
  venue?: string;
  description?: string;
}

export function domainGate(
  signals: DomainSignals,
  person: FounderDisambiguationContext,
): DisambiguationGate {
  const haystack = normalize([
    ...(signals.concepts || []),
    signals.title || '',
    signals.venue || '',
    signals.description || '',
  ].join(' | '));

  for (const marker of OBSOLETE_OR_OFF_DOMAIN_MARKERS) {
    if (haystack.includes(normalize(marker))) {
      return { passed: false, reason: `domaine hors-champ flagrant ("${marker}")` };
    }
  }

  const matched = gatherSectorKeywords(person.sector, person.subSector);
  if (matched.length === 0) {
    return { passed: true, reason: 'secteur du dossier non mappe, coherence non evaluable' };
  }

  for (const kw of matched) {
    if (haystack.includes(normalize(kw))) {
      return { passed: true, reason: `coherence domaine confirmee ("${kw}")` };
    }
  }

  return {
    passed: false,
    reason: `aucune coherence avec le secteur du dossier (${person.sector || ''})`,
  };
}

// ============================================================
// DESAMBIGUISATION DES PUBLICATIONS (OpenAlex, arXiv)
// ============================================================

export interface PublicationLike {
  year: number;
  title?: string;
  venue?: string;
  concepts?: string[];
}

export interface DisambiguatePublicationsOptions {
  minKeepRatio?: number;
  treatDomainSoftSignalAsHardReject?: boolean;
}

export function disambiguatePublications<T extends PublicationLike>(
  pubs: T[],
  person: FounderDisambiguationContext,
  options: DisambiguatePublicationsOptions = {},
): DisambiguationResult<T> {
  const minKeepRatio = options.minKeepRatio ?? DEFAULT_MIN_KEEP_RATIO;
  const domainHardReject = options.treatDomainSoftSignalAsHardReject ?? false;

  const kept: T[] = [];
  const rejected: Array<{ item: T; reason: string }> = [];

  for (const p of pubs) {
    const tg = temporalGate(p.year, person);
    if (!tg.passed) {
      rejected.push({ item: p, reason: `porte temporelle: ${tg.reason}` });
      continue;
    }
    const dg = domainGate(
      { concepts: p.concepts, title: p.title, venue: p.venue },
      person,
    );
    if (!dg.passed) {
      const isHardMarker = dg.reason.startsWith('domaine hors-champ flagrant');
      if (isHardMarker || domainHardReject) {
        rejected.push({ item: p, reason: `porte domaine: ${dg.reason}` });
        continue;
      }
    }
    kept.push(p);
  }

  if (pubs.length > 0 && kept.length === 0) {
    return {
      kept,
      rejected,
      decision: 'insufficient_disambiguation',
      rationale: `${pubs.length} publication(s) candidate(s) toutes rejetees: ${rejected.slice(0, 3).map((r) => r.reason).join(' ; ')}`,
    };
  }

  if (pubs.length >= 2 && kept.length / pubs.length < minKeepRatio) {
    return {
      kept,
      rejected,
      decision: 'insufficient_disambiguation',
      rationale: `seulement ${kept.length}/${pubs.length} publication(s) compatibles, ratio insuffisant pour lever l homonymie`,
    };
  }

  return {
    kept,
    rejected,
    decision: 'evaluable',
    rationale: pubs.length === 0
      ? 'aucune publication candidate'
      : `${kept.length}/${pubs.length} publication(s) coherente(s) avec la fenetre du fondateur`,
  };
}

// ============================================================
// DESAMBIGUISATION WIKIPEDIA
// ------------------------------------------------------------
// Wikipedia retourne un extract qui contient souvent l annee de
// naissance (ou les bornes pour les figures historiques). On extrait
// les dates plausibles et on applique la porte temporelle. La porte
// domaine s applique sur l extract complet.
// ============================================================

export function extractYearsFromText(text: string): number[] {
  const matches = (text || '').match(/\b(1[5-9]\d{2}|20\d{2})\b/g) || [];
  return matches.map((m) => parseInt(m, 10)).filter((y) => y >= 1500 && y <= new Date().getFullYear() + 1);
}

export function disambiguateWikipedia(
  extract: string,
  title: string,
  person: FounderDisambiguationContext,
): DisambiguationResult<{ year: number }> {
  const years = extractYearsFromText(extract);

  // Cas typique d une page Wikipedia sur un homonyme historique :
  // l extract contient une annee de naissance / mort tres ancienne.
  // Pour Wikipedia, la borne basse n est pas birthYear + 18 (utile pour
  // une publication) mais l annee de naissance plausible elle-meme : un
  // extract qui mentionne "ne en 1976" doit etre accepte pour un fondateur
  // de 50 ans, ce n est pas une activite anterieure a sa fenetre adulte.
  if (years.length > 0) {
    const earliest = Math.min(...years);
    const today = new Date().getFullYear();
    let minBornYear: number;
    if (person.birthYear && person.birthYear > 1900) {
      minBornYear = person.birthYear - 2;
    } else if (person.ageHint && person.ageHint > 0 && person.ageHint < 120) {
      minBornYear = today - person.ageHint - 2;
    } else {
      minBornYear = today - 80;
    }
    if (earliest < minBornYear) {
      return {
        kept: [],
        rejected: [{ item: { year: earliest }, reason: `extract Wikipedia mentionne ${earliest}, anterieur a la naissance plausible du fondateur (>= ${minBornYear})` }],
        decision: 'insufficient_disambiguation',
        rationale: `extract Wikipedia mentionne ${earliest} (date la plus ancienne) anterieur a la naissance plausible du fondateur`,
      };
    }
  }

  const dg = domainGate({ description: extract, title }, person);
  if (!dg.passed && dg.reason.startsWith('domaine hors-champ flagrant')) {
    return {
      kept: [],
      rejected: [{ item: { year: years[0] || 0 }, reason: `porte domaine Wikipedia: ${dg.reason}` }],
      decision: 'insufficient_disambiguation',
      rationale: `extract Wikipedia matche un marqueur hors-champ flagrant`,
    };
  }

  return {
    kept: years.length > 0 ? years.map((y) => ({ year: y })) : [{ year: 0 }],
    rejected: [],
    decision: 'evaluable',
    rationale: 'extract Wikipedia compatible avec la fenetre du fondateur',
  };
}

// ============================================================
// DESAMBIGUISATION GITHUB
// ------------------------------------------------------------
// GitHub n existe que depuis 2008, la porte temporelle pure ne
// s applique pas. On utilise la porte de coherence de domaine sur
// la bio + le top repo. Un compte GitHub avec une bio "musicologie
// medievale" pour un fondateur supposement deeptech IA est un
// faux match.
// ============================================================

export interface GithubDisambiguationSignals {
  bio?: string | null;
  company?: string | null;
  topRepoNames?: string[];
  topRepoDescriptions?: string[];
}

export function disambiguateGithub(
  signals: GithubDisambiguationSignals,
  person: FounderDisambiguationContext,
): DisambiguationResult<string> {
  const description = [
    signals.bio || '',
    signals.company || '',
    ...(signals.topRepoNames || []),
    ...(signals.topRepoDescriptions || []),
  ].join(' | ');

  // S il n y a strictement rien a analyser, on ne peut pas trancher :
  // on considere evaluable par defaut (autres signaux feront foi).
  if (!description.trim()) {
    return {
      kept: [],
      rejected: [],
      decision: 'evaluable',
      rationale: 'aucune bio ni repo a analyser, pas de rejet possible',
    };
  }

  const dg = domainGate({ description }, person);
  if (!dg.passed && dg.reason.startsWith('domaine hors-champ flagrant')) {
    return {
      kept: [],
      rejected: [{ item: description, reason: `porte domaine GitHub: ${dg.reason}` }],
      decision: 'insufficient_disambiguation',
      rationale: 'profil GitHub matche un marqueur hors-champ flagrant',
    };
  }

  return {
    kept: [description],
    rejected: [],
    decision: 'evaluable',
    rationale: dg.passed ? dg.reason : 'profil GitHub: pas de signal de rejet flagrant',
  };
}
