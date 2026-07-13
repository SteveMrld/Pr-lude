// ============================================================
// PRELUDE — Fallback editorial des sections de note
// ------------------------------------------------------------
// Source unique de la copie affichee quand une dimension n a
// pas pu etre instruite. Deux principes doctrinaux :
//
//   1. Absent egale neutre a suivre, jamais erreur brute, jamais
//      penalite. La regle "non evaluable egale neutre pas zero"
//      s applique au texte comme au score.
//
//   2. Aucune fuite technique dans le rendu partner. Zero
//      occurrence de "529", "Anthropic", "orchestrate",
//      "orchestrateur", "incident transitoire", "surcharge LLM",
//      "Relancer l analyse". Ces termes sont des symptomes
//      d ingenierie, pas des lectures editoriales.
//
// Ce module remplit deux offices :
//
//   - sectionFallbackCopy(kind) : renvoie la copie neutre pour
//     une section absente, avec accents et apostrophes
//     typographiques UTF-8. La copie ne mentionne aucune cause
//     technique, aucun imperatif "relancer".
//
//   - sanitizeNarrative(text) : filtre de dernier rempart qui
//     detecte tout residu d echec technique dans un texte narratif
//     et le remplace par la copie neutre de section correspondante.
//     Ceinture et bretelles : meme un moteur futur mal cable ne
//     doit rien pouvoir laisser passer jusqu au rendu.
//
// Tout ajout de section instructible doit passer par ici. Si un
// composant emet une chaine d echec sans utiliser ce module, c est
// un bug de discipline a corriger, pas une exception a autoriser.
// ============================================================

export type SectionKind =
  | 'orchestrator'
  | 'narrative-drift'
  | 'fragility-structurelle'
  | 'team'
  | 'market'
  | 'macro'
  | 'pattern'
  | 'contrarian'
  | 'blindspot'
  | 'causal'
  | 'financial'
  | 'tech-claim'
  | 'execution-friction'
  | 'reference-checks'
  // Sections rendues dans la note d instruction avec un titre statique
  // mais dont le corps peut etre vide au moment du rendu fige. La copie
  // doctrinale associee reste factuelle, sans imperatif technique.
  | 'portfolio'
  | 'comparables'
  | 'suivi-reconciliation'
  | 'green-flags'
  | 'red-flags'
  | 'patterns-transversaux'
  | 'benchmark-retrospectif'
  | 'questions-instruire'
  | 'operateurs-lift'
  | 'proxies-calculer'
  | 'section-generic'
  | 'default';

// Copie neutre par section. Voix editoriale Le Grand Continent :
// prose sobre, factuelle, sans dramatisation, sans imperatif
// d action technique. Le "A reprendre en DD Bloc 2" positionne
// naturellement la reprise dans le circuit doctrinal (Bloc 1 =
// instruction preliminaire, Bloc 2 = due diligence approfondie),
// sans jamais evoquer un incident.
const FALLBACK_COPY: Record<SectionKind, string> = {
  'orchestrator':
    'La synthèse narrative finale n’a pas été produite pour ce dossier dans ce run. Le score et le verdict restent véridiques et opposables, fondés sur les moteurs d’instruction qui ont abouti. La mise en récit complète, retournement causal, résolution dialectique, drivers et chantiers, sera reprise en DD Bloc 2.',
  'narrative-drift':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'fragility-structurelle':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'team':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'market':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'macro':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'pattern':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'contrarian':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'blindspot':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'causal':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'financial':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'tech-claim':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'execution-friction':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  'reference-checks':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
  // Sections dont l absence de contenu dans un rendu fige n a rien a
  // voir avec un echec moteur : soit la donnee n existe pas encore
  // (portfolio a moins de deux dossiers, section 6 avant saisie), soit
  // la brique est volontairement masquee (comparables faux, chantier
  // moteur separe). Copie neutre courte, aucun imperatif.
  'portfolio':
    'Section non renseignée dans cette version de la note.',
  'comparables':
    'Comparables sectoriels en cours de consolidation.',
  'suivi-reconciliation':
    'Section non renseignée dans cette version de la note.',
  'green-flags':
    'Aucun signal positif consolidé à ce stade de l’instruction.',
  'red-flags':
    'Aucun signal d’alerte consolidé à ce stade de l’instruction.',
  'patterns-transversaux':
    'Aucun pattern transversal remonté à ce stade de l’instruction.',
  'benchmark-retrospectif':
    'Benchmark rétrospectif non renseigné pour ce dossier.',
  'questions-instruire':
    'Aucune question d’instruction n’a été formalisée à ce stade.',
  'operateurs-lift':
    'Aucun opérateur lift-the-hood recommandé à ce stade.',
  'proxies-calculer':
    'Aucun proxy à calculer n’a été remonté par le retournement causal.',
  'section-generic':
    'Section non renseignée dans cette version de la note.',
  'default':
    'Cette dimension n’a pas pu être instruite dans ce run. À reprendre en DD Bloc 2.',
};

// Titres neutres. On evite "indisponible" qui a une connotation
// d echec. "Non instruite dans ce run" est factuel et doctrinal.
const FALLBACK_TITLE: Record<SectionKind, string> = {
  'orchestrator': 'Synthèse narrative',
  'narrative-drift': 'Lecture du langage',
  'fragility-structurelle': 'Fragilité structurelle',
  'team': 'Équipe',
  'market': 'Marché',
  'macro': 'Contexte macro',
  'pattern': 'Pattern matching',
  'contrarian': 'Lecture contrarienne',
  'blindspot': 'Aveuglement',
  'causal': 'Retournement causal',
  'financial': 'Lecture financière',
  'tech-claim': 'Revendications techniques',
  'execution-friction': 'Friction d’exécution',
  'reference-checks': 'Reference checks',
  'portfolio': 'Positionnement portfolio',
  'comparables': 'Comparables historiques',
  'suivi-reconciliation': 'Suivi & réconciliation',
  'green-flags': 'Green flags',
  'red-flags': 'Red flags',
  'patterns-transversaux': 'Patterns transversaux',
  'benchmark-retrospectif': 'Benchmark rétrospectif',
  'questions-instruire': 'Questions à instruire',
  'operateurs-lift': 'Opérateurs lift-the-hood',
  'proxies-calculer': 'Proxies à calculer',
  'section-generic': 'Section',
  'default': 'Section',
};

/**
 * Retourne la copie neutre de fallback pour une section donnee.
 * La copie ne mentionne jamais de cause technique, ne demande
 * jamais de relancer l analyse, et positionne naturellement la
 * reprise en DD Bloc 2. Une seule source pour tout le rendu.
 */
export function sectionFallbackCopy(kind: SectionKind = 'default'): string {
  return FALLBACK_COPY[kind] ?? FALLBACK_COPY['default'];
}

/**
 * Retourne le titre neutre pour une section absente. Utilise pour
 * les composants qui affichent un h3 au-dessus du fallback.
 */
export function sectionFallbackTitle(kind: SectionKind = 'default'): string {
  return FALLBACK_TITLE[kind] ?? FALLBACK_TITLE['default'];
}

// Marqueurs techniques a bannir de tout rendu partner. Detection
// insensible a la casse et aux variations d accentuation. Chaque
// entree traduit une categorie de fuite deja observee en prod.
const TECHNICAL_MARKERS: RegExp[] = [
  /\b529\b/gi,
  /\bAnthropic\b/gi,
  /\borchestrat(?:e|es|ed|ing|eur|ion|ionnel|ionnelle)\b/gi,
  /\bLLM\b/gi,
  /\bincident\s+transitoire\b/gi,
  /\bsurcharge\s+(?:Anthropic|LLM|transitoire)\b/gi,
  /\b[Rr]elancer\s+l['’]?\s?analyse\b/gi,
  /\b[Rr]e[- ]?instruire\b/gi,
  /\bcause\s+technique\b/gi,
  /\bfallback\b/gi,
  /\btimeout\b/gi,
];

// Si le texte contient un de ces marqueurs, on considere qu il
// s agit d une chaine d echec brute et on remplace integralement
// par la copie neutre de la section correspondante. Sinon, on
// tente un strip chirurgical des residus.
const FAILURE_SENTINEL_MARKERS: RegExp[] = [
  /529/,
  /Anthropic/i,
  /orchestrat(?:e|eur|ion)/i,
  /incident transitoire/i,
  /surcharge\s+(?:Anthropic|LLM|transitoire)/i,
  /relancer.{0,10}analyse/i,
  /cause technique/i,
];

/**
 * Detecte si un texte narratif est en fait une chaine d echec
 * brute. Utilise pour decider entre strip chirurgical et
 * remplacement complet par la copie neutre.
 */
export function looksLikeFailureCopy(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return FAILURE_SENTINEL_MARKERS.some((rx) => rx.test(text));
}

/**
 * Filtre de dernier rempart avant rendu. Deux modes selon la
 * densite de marqueurs techniques detectes :
 *
 *   1. Texte manifestement genere comme fallback d echec (au moins
 *      un sentinel marker present) : remplacement integral par la
 *      copie neutre de section correspondante. Le texte original
 *      n a de sens qu en tant que log technique, il ne merite
 *      aucun affichage editorial.
 *
 *   2. Texte narratif legitime qui contiendrait par accident un
 *      terme banni (par ex. une mention "Anthropic" dans un
 *      benchmark) : strip chirurgical des occurrences, preservation
 *      du reste. Le rendu peut avoir un mot manquant ici ou la mais
 *      ne trahit jamais l ingenierie.
 *
 * Cette fonction doit etre appliquee sur TOUS les champs narratifs
 * juste avant rendu : argumentation, resolution dialectique,
 * decision drivers, keyConditions, degradedReason, etc.
 */
export function sanitizeNarrative(
  text: unknown,
  kind: SectionKind = 'default',
): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (looksLikeFailureCopy(trimmed)) {
    return sectionFallbackCopy(kind);
  }

  let out = trimmed;
  for (const rx of TECHNICAL_MARKERS) {
    out = out.replace(rx, '');
  }
  // Compresser les espaces resultant du strip, corriger la
  // ponctuation orpheline (ex: "erreur ." -> "erreur.").
  out = out.replace(/\s+([.,;:!?])/g, '$1');
  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/\(\s*\)/g, '');
  out = out.trim();

  return out || sectionFallbackCopy(kind);
}

/**
 * Sanitise un tableau de chaines (decisionDrivers, keyConditions).
 * Elements vides ou reduits a du bruit sont eliminees ; on
 * conserve la copie neutre si le tableau finit vide.
 */
export function sanitizeNarrativeList(
  items: unknown,
  kind: SectionKind = 'default',
): string[] {
  if (!Array.isArray(items)) return [];
  const cleaned = items
    .map((item) => {
      if (typeof item === 'string') return sanitizeNarrative(item, kind);
      if (item && typeof item === 'object') {
        try {
          return sanitizeNarrative(JSON.stringify(item), kind);
        } catch {
          return '';
        }
      }
      return '';
    })
    .filter((s) => s.length > 0);
  return cleaned;
}
