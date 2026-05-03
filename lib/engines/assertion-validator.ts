// Validateur post-LLM d assertions sensibles.
//
// Probleme adresse : sur le rapport UP&CHARGE, le LLM a ajoute dans les
// red flags des noms de cofondateurs absents du pitch ('Emmanuel
// Champenois', 'Neret'), invente des dates ('rejoint en 2021', 'aout
// 2024', 'novembre 2024'), et converti la devise en USD ('1.65M$')
// alors que le pitch est en EUR. Le tagging des sources (fix 4)
// demande au LLM d etre discipline mais ne le force pas.
//
// Ce module verifie mecaniquement, apres parsing du JSON LLM, que
// les noms propres / devises / annees citees dans les textes
// critiques (red flags, drivers, evidence) sont coherents avec les
// faits extraits du pitch. Les violations sont remontees comme des
// warnings structures, pas comme des erreurs bloquantes : on prefere
// un output partiellement valide avec audit qu un crash.

import type { ExtractionOutput } from './types';

// =============================================================================
// LISTES DE NOMS AUTORISES
// =============================================================================

// Construit une liste de noms propres qui peuvent legitimement apparaitre
// dans les textes du rapport, en se basant sur ce que l extraction a
// reellement trouve dans le pitch. Inclut les fondateurs, board, clients,
// concurrents cites + une whitelist de noms generiques (institutions,
// pays, fonds connus) qui passent toujours.
export function buildAllowedNames(extraction: ExtractionOutput): Set<string> {
  const allowed = new Set<string>();

  const add = (s?: string | null) => {
    if (!s) return;
    // Decoupe par mots de >=3 caracteres commencant par majuscule
    const parts = s.split(/[\s,;()\/]+/).filter(p => p.length >= 3);
    for (const p of parts) {
      allowed.add(p.toLowerCase());
    }
    // Ajoute aussi le nom complet en lowercase pour matcher des bigrammes
    allowed.add(s.toLowerCase().trim());
  };

  // Fondateurs : nom + role + background
  for (const f of extraction.founders || []) {
    add(f.name);
    add(f.background);
  }
  // Board / advisors
  for (const b of extraction.boardMembers || []) {
    add(b.name);
    add(b.affiliation);
  }
  // Clients nommes
  for (const c of extraction.clientsNamed || []) {
    add(c.name);
    add(c.company);
  }
  // Concurrents cites
  for (const c of extraction.competitorsCited || []) {
    add(c);
  }
  // Investisseurs
  if (extraction.fundraise) {
    add(extraction?.fundraise?.leadInvestor);
    for (const i of extraction?.fundraise?.coInvestors || []) add(i);
  }
  // Localisation et secteur
  add(extraction.geographicHub);
  add(extraction.country);
  add(extraction.sector);
  add(extraction.subSector);
  add(extraction.companyName);

  return allowed;
}

// Whitelist de noms qu on accepte toujours sans matcher l extraction.
// Inclut institutions financieres et fonds VC standards, pays / regions,
// noms de comparables historiques courants utilises par le moteur
// pattern-matching, et figures publiques de reference.
const ALWAYS_ALLOWED_LOWER = new Set<string>([
  // Pays / regions
  'france', 'europe', 'allemagne', 'italie', 'espagne', 'royaume-uni',
  'angleterre', 'canada', 'usa', 'etats-unis', 'chine', 'japon', 'inde',
  'paris', 'lyon', 'marseille', 'londres', 'berlin', 'munich',
  'amsterdam', 'bruxelles', 'tel aviv', 'silicon valley', 'new york',
  'san francisco', 'boston', 'san diego',
  // UE et institutions
  'ue', 'eu', 'union europeenne', 'commission europeenne', 'parlement',
  'bce', 'ecb', 'fed', 'world bank', 'imf', 'fmi', 'oecd', 'ocde',
  // Fonds VC standards (exemples qui peuvent legitimement apparaitre
  // comme reference de marche meme s ils ne sont pas dans le pitch)
  'sequoia', 'a16z', 'andreessen horowitz', 'index ventures', 'partech',
  'eurazeo', 'idinvest', 'creandum', 'atomico', 'balderton',
  'accel partners', 'kleiner perkins', 'first round capital',
  'y combinator', 'techstars', 'founders fund', 'thrive capital',
  'menlo ventures', 'battery ventures', 'lightspeed', 'general catalyst',
  // Bpifrance et institutions FR
  'bpifrance', 'bpi france', 'bpi', 'caisse des depots', 'cdc',
  // Comparables historiques courants
  'doctolib', 'theranos', 'wework', 'stripe', 'airbnb', 'uber', 'tesla',
  'spacex', 'figma', 'notion', 'linear', 'shopify', 'snowflake',
  'datadog', 'mongodb', 'twilio', 'mistral', 'mistral ai', 'huggingface',
  'hugging face', 'openai', 'anthropic', 'deepseek', 'cohere',
  'backmarket', 'back market', 'blablacar', 'leboncoin', 'vinted',
  'venteprivee', 'vente-privee', 'alan', 'qonto', 'spendesk', 'payfit',
  'sendinblue', 'brevo', 'datadog', 'ovhcloud', 'klarna', 'spotify',
  'ynsect', 'cazoo', 'northvolt', 'volocopter', 'lilium',
  'quantum systems', 'pasqal', 'mirakl',
  // Tech generaux
  'github', 'openalex', 'wikipedia', 'arxiv', 'pubmed', 'pitchbook',
  'crunchbase', 'linkedin', 'google scholar',
  // Cadres / etudes
  'eisenmann', 'menlo', 'atomico soet', 'state of european tech',
  'pitchbook-nvca', 'bain', 'mckinsey', 'bcg', 'gartner', 'forrester',
  'idc', 'pwc', 'deloitte', 'kpmg', 'ey',
  // Reglementations / standards
  'rgpd', 'gdpr', 'csrd', 'ai act', 'mifid', 'basel', 'solvency',
  // Mots organisationnels neutres
  'series a', 'series b', 'series c', 'seed', 'pre-seed', 'arr', 'mrr',
  'capex', 'opex', 'tco', 'roi', 'ebitda', 'cac', 'ltv',
]);

// =============================================================================
// EXTRACTION DES NOMS PROPRES D UN TEXTE
// =============================================================================

// Heuristique simple : on cherche les sequences de 2-4 mots dont chaque
// mot commence par majuscule (sauf prepositions / determinants courts).
// Filtre les debuts de phrase (premier mot d une phrase capitalise mais
// pas un nom propre).
const STOPWORDS = new Set([
  'la', 'le', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'et',
  'ou', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi', 'dont',
  'a', 'à', 'en', 'pour', 'par', 'sur', 'sous', 'dans', 'avec', 'sans',
  'vers', 'chez', 'entre', 'pendant', 'avant', 'apres', 'depuis',
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'to',
  'from', 'as', 'if', 'and', 'or', 'but',
]);

export interface ProperNoun {
  text: string;
  textLower: string;
}

export function extractProperNouns(text: string): ProperNoun[] {
  if (!text) return [];
  const found: ProperNoun[] = [];
  // Sequence de 1-4 mots commencant par majuscule (apres un espace ou
  // debut de chaine), incluant tirets et apostrophes
  const re = /(?:^|[\s\(])((?:[A-ZÉÈÀÂÊÎÔÛÄËÏÖÜÇ][\wÉèàâêîôûäëïöüç'-]{1,}\s?){1,4})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim().replace(/[.,;:!?]+$/, '');
    if (raw.length < 3) continue;
    // Filtre debut de phrase : si le caractere precedent est . ou debut de
    // chaine, on accepte uniquement si c est un nom multi-mot ou bien
    // present dans la whitelist
    const startIdx = m.index === 0 ? 0 : m.index;
    const before = startIdx > 0 ? text.slice(Math.max(0, startIdx - 2), startIdx) : '';
    const isStartOfSentence = startIdx === 0 || /[.!?]\s*$/.test(before);
    const words = raw.split(/\s+/);
    // Si debut de phrase et mot unique, on skip (probablement debut de
    // phrase capitalise sans etre un nom propre)
    if (isStartOfSentence && words.length === 1 && !ALWAYS_ALLOWED_LOWER.has(raw.toLowerCase())) {
      continue;
    }
    // Skip les mots qui sont uniquement des stopwords
    if (words.every(w => STOPWORDS.has(w.toLowerCase()))) continue;
    found.push({ text: raw, textLower: raw.toLowerCase() });
  }
  return found;
}

// =============================================================================
// VALIDATIONS SPECIFIQUES
// =============================================================================

export interface ValidationWarning {
  category: 'unknown_name' | 'currency_mismatch' | 'invented_date' | 'unsupported_claim';
  severity: 'critical' | 'warning' | 'info';
  field: string; // chemin dans l output, ex 'redFlags[2]'
  message: string;
  excerpt: string; // extrait du texte concerne
}

// Detecte les noms propres dans un texte qui ne sont pas dans la liste
// allowed. Les noms taggues [web] ou [inference] sont consideres comme
// declares par le LLM, donc passent : on ne flagge que les noms
// presentes comme des faits sans tag.
export function findUnknownNames(
  text: string,
  allowed: Set<string>,
  field: string
): ValidationWarning[] {
  if (!text) return [];
  const warnings: ValidationWarning[] = [];
  const nouns = extractProperNouns(text);
  const seen = new Set<string>();

  for (const n of nouns) {
    if (seen.has(n.textLower)) continue;
    seen.add(n.textLower);

    // Match exact ou partiel sur la liste allowed
    if (allowed.has(n.textLower)) continue;
    if (ALWAYS_ALLOWED_LOWER.has(n.textLower)) continue;
    // Match partiel : si un mot du nom est dans allowed, on accepte
    const words = n.textLower.split(/\s+/);
    const anyWordAllowed = words.some(w => allowed.has(w) || ALWAYS_ALLOWED_LOWER.has(w));
    if (anyWordAllowed) continue;

    // Verifier si le nom est dans un contexte tagge [web] ou [inference]
    // ou [corpus] : si oui on ne flagge pas (le LLM a explicitement
    // declare qu il ne vient pas du pitch)
    const idx = text.toLowerCase().indexOf(n.textLower);
    if (idx >= 0) {
      const after = text.slice(idx, Math.min(text.length, idx + n.text.length + 80));
      if (/\[(web|inf[ée]rence|corpus)[^\]]*\]/i.test(after)) continue;
    }

    warnings.push({
      category: 'unknown_name',
      severity: 'warning',
      field,
      message: `Nom propre "${n.text}" cite sans tag de source et absent des donnees extraites du pitch (fondateurs, board, clients, concurrents). Soit l ajouter au pitch, soit le tagger [web] / [inference], soit le supprimer.`,
      excerpt: text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + n.text.length + 30)),
    });
  }
  return warnings;
}

// Detecte les conversions de devise non taggees. Si le pitch est en
// EUR (ou inversement), un montant en USD doit etre tagge [web]
// (conversion) ou [inference], sinon c est suspect.
export function findCurrencyMismatch(
  text: string,
  pitchCurrency: 'EUR' | 'USD' | 'unknown',
  field: string
): ValidationWarning[] {
  if (!text || pitchCurrency === 'unknown') return [];
  const warnings: ValidationWarning[] = [];

  // On cherche les montants en USD si le pitch est EUR, et inversement
  const targetSymbols = pitchCurrency === 'EUR'
    ? [/(\$|USD|US\$)\s?\d/g]
    : [/€\s?\d|EUR\s?\d/g];

  for (const re of targetSymbols) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      // Verifier presence d un tag dans les 80 chars suivants
      const after = text.slice(idx, Math.min(text.length, idx + 80));
      if (/\[(web|inf[ée]rence|corpus)[^\]]*\]/i.test(after)) continue;
      // Verifier presence d une mention de conversion ('environ',
      // 'soit', '~', 'equivalent') dans les 30 chars precedents
      const before = text.slice(Math.max(0, idx - 40), idx);
      if (/(environ|soit|~|equivalent|equiv\.|approximativement)/i.test(before)) continue;

      warnings.push({
        category: 'currency_mismatch',
        severity: 'warning',
        field,
        message: `Montant cite dans une devise differente du pitch (pitch en ${pitchCurrency}) sans tag de source ni mention de conversion. Le pitch UP&CHARGE est en EUR, ne pas inventer de montants USD.`,
        excerpt: text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 40)),
      });
    }
  }
  return warnings;
}

// Detecte les annees citees qui ne sont ni dans le pitch ni taggees.
// Utilise la liste des annees mentionnees dans les champs extraction
// + une fenetre raisonnable autour de l annee de fondation.
export function findInventedDates(
  text: string,
  pitchYears: Set<number>,
  field: string
): ValidationWarning[] {
  if (!text) return [];
  const warnings: ValidationWarning[] = [];

  // Cherche annees 4 chiffres (1990-2050)
  const re = /\b(19[9]\d|20[0-4]\d|2050)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const year = parseInt(m[1], 10);
    if (pitchYears.has(year)) continue;

    // Tolerance : annees +/- 5 d une annee dans le pitch (projection,
    // planning, retrospective). Au-dela, on flagge.
    const closeToPitch = Array.from(pitchYears).some(y => Math.abs(y - year) <= 5);
    if (closeToPitch) continue;

    // Tolerance pour annees actuelles +/- 2 (le LLM a connaissance de
    // l annee courante via training data)
    const currentYear = new Date().getFullYear();
    if (Math.abs(year - currentYear) <= 2) continue;

    // Verifier presence d un tag
    const idx = m.index;
    const after = text.slice(idx, Math.min(text.length, idx + 60));
    if (/\[(web|inf[ée]rence|corpus|pitch)[^\]]*\]/i.test(after)) continue;

    warnings.push({
      category: 'invented_date',
      severity: 'info',
      field,
      message: `Annee ${year} citee sans tag de source et sans correspondance dans le pitch. Verifier que l information est sourcee.`,
      excerpt: text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 30)),
    });
  }
  return warnings;
}

// Construit l ensemble des annees mentionnees dans l extraction (pitch).
export function buildPitchYears(extraction: ExtractionOutput): Set<number> {
  const years = new Set<number>();
  if (extraction.yearFounded && extraction.yearFounded > 0) years.add(extraction.yearFounded);
  // Cherche dans les textes libres
  const texts = [
    extraction.marketPitch || '',
    extraction.productDescription || '',
    extraction.businessModel || '',
    extraction.rawSummary || '',
    extraction.fundraise?.amount || '',
    extraction.fundraise?.valuation || '',
    extraction.traction?.revenue || '',
    extraction.traction?.growth || '',
    ...(extraction.traction?.metrics || []),
  ].join(' ');
  const re = /\b(19[9]\d|20[0-4]\d|2050)\b/g;
  let m;
  while ((m = re.exec(texts)) !== null) {
    years.add(parseInt(m[1], 10));
  }
  return years;
}

// Detecte la devise dominante du pitch a partir du fundraise et des
// metrics traction.
export function detectPitchCurrency(extraction: ExtractionOutput): 'EUR' | 'USD' | 'unknown' {
  const texts = [
    extraction.fundraise?.amount || '',
    extraction.fundraise?.valuation || '',
    extraction.traction?.revenue || '',
    ...(extraction.traction?.metrics || []),
    extraction.rawSummary || '',
  ].join(' ').toLowerCase();

  const eurCount = (texts.match(/€|eur\b|euros?/g) || []).length;
  const usdCount = (texts.match(/\$|usd\b|us\$|dollars?/g) || []).length;

  if (eurCount > usdCount * 2) return 'EUR';
  if (usdCount > eurCount * 2) return 'USD';
  if (eurCount > 0 && eurCount >= usdCount) return 'EUR';
  if (usdCount > 0) return 'USD';
  return 'unknown';
}

// =============================================================================
// VALIDATION GLOBALE D UN OUTPUT D ENGINE
// =============================================================================

export interface AssertionAuditReport {
  totalWarnings: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  warnings: ValidationWarning[];
}

export function auditAssertions(
  output: unknown,
  extraction: ExtractionOutput,
  options?: {
    fields?: string[]; // chemins JSON specifiques a auditer (sinon tout)
    skipCurrencyCheck?: boolean;
  },
): AssertionAuditReport {
  const allowed = buildAllowedNames(extraction);
  const pitchYears = buildPitchYears(extraction);
  const pitchCurrency = options?.skipCurrencyCheck ? 'unknown' : detectPitchCurrency(extraction);

  const allWarnings: ValidationWarning[] = [];

  // Parcours recursif de l output : on collecte tous les champs string
  // > 40 caracteres et on les valide.
  const visit = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (node.length < 40) return;
      allWarnings.push(...findUnknownNames(node, allowed, path));
      if (pitchCurrency !== 'unknown') {
        allWarnings.push(...findCurrencyMismatch(node, pitchCurrency, path));
      }
      allWarnings.push(...findInventedDates(node, pitchYears, path));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        visit(v, path ? `${path}.${k}` : k);
      }
    }
  };
  visit(output, '');

  // Deduplication : meme message + meme excerpt = un seul warning
  const seen = new Set<string>();
  const dedup: ValidationWarning[] = [];
  for (const w of allWarnings) {
    const key = `${w.category}|${w.message.slice(0, 80)}|${w.excerpt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(w);
  }

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const w of dedup) {
    byCategory[w.category] = (byCategory[w.category] || 0) + 1;
    bySeverity[w.severity] = (bySeverity[w.severity] || 0) + 1;
  }

  return {
    totalWarnings: dedup.length,
    byCategory,
    bySeverity,
    warnings: dedup,
  };
}
