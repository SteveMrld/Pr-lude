// ============================================================
// REFUTATION LAYER, BRIQUE 1 : contradictions chiffrees internes
// ------------------------------------------------------------
// Module pur, aucune I/O, aucun branchement au rendu. Detecte
// deterministiquement les cas ou une meme grandeur financiere,
// sur une meme periode et un meme qualifier, apparait avec deux
// valeurs numeriques incoherentes.
//
// Design conservateur. Le risque de cette brique est le faux
// positif : signaler une contradiction imaginaire detruit la
// credibilite du refutation layer. On prefere manquer une
// contradiction que d en inventer une. Chaque nouvelle metrique,
// chaque nouvelle source prose, chaque nouvel axe de comparaison
// rouvre une classe de faux positifs qu il faut valider par tests
// negatifs explicites avant de considerer l axe comme couvert.
//
// V1.1 : capture du qualifier de periode (A/B/E/F) et regle de
// compatibilite prose-vs-table qui elimine la classe actual/budget.
//
// V2 : elargissement
//   Metriques : ebitda, revenue, opex, fcf, grossMargin (marge
//     brute), headcount. Chacune avec sa normalisation d unite
//     propre (k€, points de %, personnes) et ses seuils adaptes.
//   Sources prose : extraction.rawSummary, financialData.rawNotes,
//     indicators.synthesis, valuation.synthesis, et les
//     indicators.indicators[].rationale.
//   Axes de comparaison : table-vs-prose (V1) + prose-vs-prose
//     entre champs distincts (V2), avec meme discipline qualifier.
//
// V3 : heuristique de contexte pour eliminer la classe de faux
// positifs revelee par le repassage corpus V2 : les mentions
// chiffrees portant un qualificatif de recadrage (ajuste,
// pro-forma, IFRS, France, inclut, ...) ne designent pas la
// meme grandeur que le chiffre standard de la table. On les
// retire du bassin de comparaison. Fenetre bornee a la phrase
// courante pour eviter d avaler un marqueur d une autre phrase.
//
// Cas volontairement NON couverts en V3 :
//   - Divergences table-vs-table (rare, souvent construit par le
//     pipeline lui-meme).
//   - Metriques hors du catalogue (ARR, LTV, CAC, marge nette,
//     churn). Chaque metrique ajoutee ouvre une classe de faux
//     positifs a valider. Extension incrementale.
//   - Prose portant qualifier E (estime) ou F (forecast) : pas de
//     mapping cote source table, on ne signale jamais contre table.
//     Prose-vs-prose reste possible avec meme qualifier E ou F.
//   - Nombres sans unite explicite (ex "300 clients", "10 sessions"),
//     ou headcount sans unite ETP/personnes explicite.
//   - Periodes non-annuelles (Q1, mensuel, semestriel).
//   - Deduplication des paires de contradictions qui pointent
//     sur la meme divergence via deux triangles differents
//     (table-vs-prose1 + table-vs-prose2 + prose1-vs-prose2).
//     On rend les 3 aretes, l analyste voit toutes.
//   - Marqueurs de recadrage tres frequents en francais courant
//     comme "hors" ou "dont" produiront quelques faux negatifs
//     sur des mentions legitimes. Accepte doctrinaire : mieux
//     vaut rater qu inventer.
//   - Bugs de qualite du pipeline en amont (ex : table stockant
//     une marge en % entier au lieu du ratio decimal). Le
//     detecteur revele ces bugs comme divergences, ce qui est
//     un signal utile ; on ne les filtre pas.
// ============================================================

// ============================================================
// Types
// ============================================================

export type FinancialMetric =
  | 'ebitda'
  | 'revenue'
  | 'opex'
  | 'fcf'
  | 'grossMargin'
  | 'headcount';

// Unite canonique interne : normalisation systematique pour rendre
// les comparaisons homogenes.
export type CanonicalUnit = 'keur' | 'percentage_points' | 'headcount';

// Qualifier de periode. null = absent (aucun suffixe apres l annee)
// ou non inferable (row table avec source ambigue).
export type PeriodQualifier = 'A' | 'B' | 'E' | 'F' | null;

export interface MetricObservation {
  metric: FinancialMetric;
  period: string;               // annee "2024"
  qualifier: PeriodQualifier;   // A/B/E/F, null si absent
  value: number;                // valeur en unite canonique
  unit: CanonicalUnit;
  location: string;             // chemin JSON dans result_json
  rawSnippet: string;           // extrait source, tronque
  sourceTag?: string;           // table only : "bp"|"deck"|...
}

export interface NumericContradiction {
  metric: FinancialMetric;
  period: string;
  qualifier: PeriodQualifier;
  kind: 'table-vs-prose' | 'prose-vs-prose';
  left: MetricObservation;
  right: MetricObservation;
  absoluteDelta: number;
  relativeDelta: number;
  unit: CanonicalUnit;
}

// ============================================================
// Seuils par unite canonique
// ------------------------------------------------------------
// Double garde : on signale UNIQUEMENT si les deux seuils sont
// franchis simultanement. Ce couplage evite les deux classes de
// faux positifs symetriques (petits ecarts absolus sur grosses
// valeurs, grands ecarts relatifs sur valeurs minuscules).
// ============================================================
export const TOLERANCES: Record<CanonicalUnit, { abs: number; rel: number }> = {
  // Montants monetaires en kilo-euros. 2 k€ absolu absorbe les
  // arrondis a l entier, 2% relatif absorbe les arrondis
  // arithmetiques usuels.
  keur: { abs: 2, rel: 0.02 },

  // Marges en points de pourcentage. 1 point absolu (une marge
  // 18,3% vs 19,0% = 0,7 point, sous seuil), 3% relatif (evite
  // les faux positifs quand les marges sont tres faibles).
  percentage_points: { abs: 1, rel: 0.03 },

  // Effectif entier. 1 personne absolu, 5% relatif. Une divergence
  // de 1 sur 100 (1% relatif) est du bruit demographique, une
  // divergence de 3 sur 14 (21% relatif) est un signal.
  headcount: { abs: 1, rel: 0.05 },
};

// Retrocompatibilite : anciens exports V1 conserves comme alias
// des seuils keur, pour ne pas casser d eventuels consommateurs.
export const TOLERANCE_ABS_KEUR = TOLERANCES.keur.abs;
export const TOLERANCE_REL = TOLERANCES.keur.rel;

// ============================================================
// Catalogue des metriques
// ============================================================

interface MetricConfig {
  key: FinancialMetric;
  proseRegex: RegExp;
  tableField: string;
  tableConverter: (rawValue: number) => number;
  unitPatternSource: string;
  unitConverter: (unitStr: string) => number | null;
  unit: CanonicalUnit;
}

// Unite k€ : montants monetaires normalises en kilo-euros.
const KEUR_UNIT_PATTERN =
  "(?:k€|M€|k\\s*€|M\\s*€|k\\s*eur|M\\s*eur|milliers\\s+d[’']euros|millions\\s+d[’']euros)";
function keurUnitConverter(unit: string): number | null {
  const u = unit.toLowerCase().replace(/\s+/g, ' ').trim();
  if (u === 'k€' || u === 'keur' || u === 'k eur' || u === "milliers d'euros" || u === 'milliers d euros') return 1;
  if (u === 'm€' || u === 'meur' || u === 'm eur' || u === "millions d'euros" || u === 'millions d euros') return 1000;
  return null;
}

// Unite %: exclusivement les mentions explicites de pourcentage
// pour eviter de matcher "0,72" comme 72%. Pas de matching implicite.
const PERCENT_UNIT_PATTERN = "(?:%|pts|points\\s+de\\s+pourcentage)";
function percentUnitConverter(unit: string): number | null {
  const u = unit.toLowerCase().trim();
  if (u === '%' || u === 'pts' || u === 'points de pourcentage') return 1;
  return null;
}

// Unite headcount : uniquement mentions explicites (personnes,
// ETP, etc.) pour eviter de matcher "300 clients" comme headcount.
const HEADCOUNT_UNIT_PATTERN =
  "(?:personnes|personnels|salari[eé]s|employ[eé]s|collaborateurs|ETP|FTE)";
function headcountUnitConverter(unit: string): number | null {
  const u = unit.toLowerCase().trim();
  const canon = u
    .replace(/é/g, 'e')
    .replace(/è/g, 'e');
  if ([
    'personnes', 'personnels', 'salaries', 'employes',
    'collaborateurs', 'etp', 'fte',
  ].includes(canon)) return 1;
  return null;
}

const METRIC_CATALOG: Record<FinancialMetric, MetricConfig> = {
  ebitda: {
    key: 'ebitda',
    proseRegex: /\bebitda\b/i,
    tableField: 'ebitdaProjection',
    tableConverter: v => v * 1000,
    unitPatternSource: KEUR_UNIT_PATTERN,
    unitConverter: keurUnitConverter,
    unit: 'keur',
  },
  revenue: {
    key: 'revenue',
    // "chiffre d'affaires" (variantes accentuation apostrophe),
    // "revenue" mot entier. Sigle "CA" seul volontairement exclu
    // (trop de faux positifs en francais courant).
    proseRegex: /chiffre\s+d[’']affaires|\brevenue\b/i,
    tableField: 'revenueProjection',
    tableConverter: v => v * 1000,
    unitPatternSource: KEUR_UNIT_PATTERN,
    unitConverter: keurUnitConverter,
    unit: 'keur',
  },
  opex: {
    key: 'opex',
    proseRegex: /\bopex\b|charges\s+op[eé]rationnelles/i,
    tableField: 'opexProjection',
    tableConverter: v => v * 1000,
    unitPatternSource: KEUR_UNIT_PATTERN,
    unitConverter: keurUnitConverter,
    unit: 'keur',
  },
  fcf: {
    key: 'fcf',
    proseRegex: /\bfcf\b|free\s+cash[- ]flow|flux\s+de\s+tr[eé]sorerie(?:\s+libre)?/i,
    tableField: 'fcfProjection',
    tableConverter: v => v * 1000,
    unitPatternSource: KEUR_UNIT_PATTERN,
    unitConverter: keurUnitConverter,
    unit: 'keur',
  },
  grossMargin: {
    key: 'grossMargin',
    proseRegex: /marge\s+brute|gross\s+margin/i,
    tableField: 'grossMarginProjection',
    tableConverter: v => v * 100,   // ratio 0.72 -> 72 points
    unitPatternSource: PERCENT_UNIT_PATTERN,
    unitConverter: percentUnitConverter,
    unit: 'percentage_points',
  },
  headcount: {
    key: 'headcount',
    proseRegex: /\beffectifs?\b|\bETP\b|\bFTE\b|\bheadcount\b/i,
    tableField: 'headcount',
    tableConverter: v => v,
    unitPatternSource: HEADCOUNT_UNIT_PATTERN,
    unitConverter: headcountUnitConverter,
    unit: 'headcount',
  },
};

// ============================================================
// Parsers atomiques
// ============================================================

function parseFrenchNumber(s: string): number {
  const cleaned = s.replace(/[\s ]/g, '').replace(',', '.');
  return parseFloat(cleaned);
}

function normalizeQualifier(raw: string | undefined): PeriodQualifier {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === 'A' || u === 'B' || u === 'E' || u === 'F') return u;
  return null;
}

// ============================================================
// Extraction table
// ============================================================

function extractFromTable(resultJson: any, metric: FinancialMetric): MetricObservation[] {
  const cfg = METRIC_CATALOG[metric];
  const fd = resultJson?.financialData;
  if (!fd || typeof fd !== 'object') return [];
  const arr = fd[cfg.tableField];
  if (!Array.isArray(arr)) return [];
  const out: MetricObservation[] = [];
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    if (!row || typeof row !== 'object') continue;
    const year = String(row.year ?? '');
    if (!/^20\d{2}$/.test(year)) continue;
    const v = typeof row.value === 'number' ? row.value : null;
    if (v === null || !Number.isFinite(v)) continue;
    const source = typeof row.source === 'string' ? row.source : '';
    out.push({
      metric,
      period: year,
      qualifier: null,
      value: cfg.tableConverter(v),
      unit: cfg.unit,
      location: `financialData.${cfg.tableField}[${i}]`,
      rawSnippet: JSON.stringify(row),
      sourceTag: source,
    });
  }
  return out;
}

function expectedQualifierFromSource(source: string | undefined): PeriodQualifier {
  if (!source) return null;
  const s = source.trim().toLowerCase();
  if (s === 'bp') return 'A';
  if (s === 'deck') return 'B';
  return null;
}

// ============================================================
// Extraction prose
// ------------------------------------------------------------
// Deux patterns fermes de proximite pour l extraction :
//   A : metric ANNEE(qualifier?) ... nombre unite
//       exemple : "chiffre d'affaires 2024 est estime a 1,6 M€"
//   B : metric ... nombre unite (en |()annee(qualifier?)
//       exemple : "EBITDA de 293 k€ (18,3 %) en 2024B"
// Distances plafonnees (8 chars entre metric et annee pour A,
// 25 chars entre unite et annee pour B, l annee de B est
// IMPERATIVEMENT precedee de "en " ou "(" pour exclure les
// mentions accessoires type "depuis 2017").
// ============================================================

const NUM_ALT = "(\\d[\\d\\s\\u00a0.,]{0,15})";
const YEAR_QUALIFIED = "(20\\d{2})([ABEFabef])?(?!\\d)";

function buildRegexes(metric: FinancialMetric): { A: RegExp; B: RegExp } {
  const cfg = METRIC_CATALOG[metric];
  const mSrc = cfg.proseRegex.source;
  const A = new RegExp(
    `(${mSrc})[^.\\n]{0,8}?\\b${YEAR_QUALIFIED}[^.\\n]{0,60}?${NUM_ALT}\\s*(${cfg.unitPatternSource})`,
    'gi'
  );
  const B = new RegExp(
    `(${mSrc})[^.\\n]{0,60}?${NUM_ALT}\\s*(${cfg.unitPatternSource})[^.\\n]{0,25}?(?:en\\s+|\\()${YEAR_QUALIFIED}`,
    'gi'
  );
  return { A, B };
}

// ============================================================
// Heuristique de contexte : dictionnaire de recadrage
// ------------------------------------------------------------
// Marqueurs qui, s ils apparaissent dans le voisinage d une
// mention chiffree extraite de la prose, indiquent que ce
// chiffre est une VARIANTE (ajustee, pro-forma, sous-composante,
// referentiel comptable different) et pas la metrique standard.
// La mention est alors retiree du bassin de comparaison.
//
// Quatre familles :
//   1. Ajustement et retraitement
//   2. Referentiel comptable
//   3. Perimetre geographique (liste explicite de pays majeurs +
//      motif generique CA suivi d un pays capitalise)
//   4. Composant inclus ou exclu
//
// Compilation en une seule regex OR pour un test rapide.
// Casse indifferente. Bornes de mot \b partout pour eviter les
// sous-chaines accidentelles (ex "hors" dans "horsain").
// ============================================================
// Bornes de mot Unicode-aware. Le \b de JavaScript est ASCII pur
// et echoue apres "é" ou "è" ("ajusté" suivi d espace : \b entre
// e-accentue (non-word) et espace (non-word) = pas de boundary).
// On remplace par des lookarounds sur \p{L} (toute lettre Unicode)
// avec le flag u sur la regex compilee.
const NLB = '(?<![\\p{L}])';    // borne avant : le char precedent n est pas une lettre
const NLA = '(?![\\p{L}])';     // borne apres : le char suivant n est pas une lettre

const FRAMING_MARKERS_SOURCE =
  // Famille 1 : ajustement / retraitement
  NLB + 'ajust[eé]e?s?' + NLA +
  '|' + NLB + 'retrait[eé]e?s?' + NLA +
  '|' + NLB + 'pro[- ]?forma' + NLA +
  '|' + NLB + 'normalis[eé]e?s?' + NLA +
  '|' + NLB + 'standalone' + NLA +
  '|' + NLB + 'consolid[eé]e?s?' + NLA +
  '|hors\\s+acquisitions?' +
  '|post[- ]?acquisitions?' +
  '|' + NLB + 'retraitement' + NLA +
  // Famille 2 : referentiel comptable
  '|' + NLB + 'IFRS' + NLA +
  '|' + NLB + 'GAAP' + NLA +
  '|' + NLB + 'statutory' + NLA +
  '|' + NLB + 'r[eé]glementaire' + NLA +
  '|' + NLB + 'combin[eé]e?s?' + NLA +
  '|comptes?\\s+sociaux' +
  // Famille 3 : perimetre geographique (pays majeurs + generique CA + XX)
  '|' + NLB + '(?:France|Belgique|Espagne|Allemagne|Italie|Portugal|Suisse|Luxembourg|Pays-Bas|Royaume-Uni|Autriche|Pologne|Gr[eè]ce|Irlande|Danemark|Su[eè]de|Norv[eè]ge|Finlande|USA|Etats-Unis|Chine|Inde|Japon|Br[eé]sil|Cor[eé]e|Turquie|Maroc|Alg[eé]rie|Tunisie|Australie|Canada|Mexique|Europe|monde|international)' + NLA +
  '|' + NLB + 'CA\\s+[A-Z][a-z\\u00c0-\\u017f]+' +
  // Famille 4 : composant inclus ou exclu
  '|' + NLB + 'inclut' + NLA +
  '|' + NLB + 'incluant' + NLA +
  '|' + NLB + 'hors' + NLA +
  '|' + NLB + 'y\\s+compris' + NLA +
  '|' + NLB + 'dont' + NLA +
  '|' + NLB + 'avant' + NLA +
  '|' + NLB + 'apr[eè]s' + NLA;
const FRAMING_REGEX = new RegExp(FRAMING_MARKERS_SOURCE, 'iu');

// Fenetre de contexte de +/- 60 caracteres, bornee a la phrase
// courante. Ponctuation forte qui coupe : "." ";" et retour ligne.
// On ne franchit PAS ces separateurs pour rattacher un marqueur
// a un chiffre. Bornage conservateur documente en tete du module.
const CONTEXT_RADIUS = 60;
const SENTENCE_BOUNDARIES = new Set<string>(['.', ';', '\n', '\r']);

function extractSentenceWindow(
  text: string,
  matchStart: number,
  matchEnd: number,
): string {
  const lowerBound = Math.max(0, matchStart - CONTEXT_RADIUS);
  const upperBound = Math.min(text.length, matchEnd + CONTEXT_RADIUS);

  // Chercher la borne gauche : dernier separateur avant matchStart,
  // borne par lowerBound.
  let start = lowerBound;
  for (let i = matchStart - 1; i >= lowerBound; i--) {
    if (SENTENCE_BOUNDARIES.has(text[i])) {
      start = i + 1;
      break;
    }
  }

  // Chercher la borne droite : premier separateur apres matchEnd,
  // borne par upperBound.
  let end = upperBound;
  for (let i = matchEnd; i < upperBound; i++) {
    if (SENTENCE_BOUNDARIES.has(text[i])) {
      end = i;
      break;
    }
  }

  return text.substring(start, end);
}

function hasFramingMarker(
  text: string,
  matchStart: number,
  matchEnd: number,
): boolean {
  const window = extractSentenceWindow(text, matchStart, matchEnd);
  return FRAMING_REGEX.test(window);
}

function extractFromProse(
  text: string,
  metric: FinancialMetric,
  location: string,
): MetricObservation[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const cfg = METRIC_CATALOG[metric];
  const { A, B } = buildRegexes(metric);
  const out: MetricObservation[] = [];
  const seen = new Set<string>();

  const push = (
    numStr: string,
    unitStr: string,
    yearStr: string,
    qualifierRaw: string | undefined,
    matchText: string,
  ) => {
    const num = parseFrenchNumber(numStr);
    if (!Number.isFinite(num)) return;
    const mult = cfg.unitConverter(unitStr);
    if (mult === null) return;
    const value = num * mult;
    const qualifier = normalizeQualifier(qualifierRaw);
    const key = `${yearStr}|${qualifier ?? ''}|${value}|${matchText.slice(0, 40)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      metric,
      period: yearStr,
      qualifier,
      value,
      unit: cfg.unit,
      location,
      rawSnippet: matchText.slice(0, 200),
    });
  };

  let m: RegExpExecArray | null;
  // Pattern A groups : 1=metric, 2=year, 3=qualifier?, 4=number, 5=unit
  A.lastIndex = 0;
  while ((m = A.exec(text)) !== null) {
    if (hasFramingMarker(text, m.index, m.index + m[0].length)) continue;
    push(m[4], m[5], m[2], m[3], m[0]);
  }
  // Pattern B groups : 1=metric, 2=number, 3=unit, 4=year, 5=qualifier?
  B.lastIndex = 0;
  while ((m = B.exec(text)) !== null) {
    if (hasFramingMarker(text, m.index, m.index + m[0].length)) continue;
    push(m[2], m[3], m[4], m[5], m[0]);
  }

  return out;
}

// ============================================================
// Sources prose autorisees
// ------------------------------------------------------------
// Champ path + fonction d extraction du texte. financialData.rawNotes
// est inclus meme s il documente parfois lui-meme les divergences
// actual/budget : la regle qualifier suffit a ne pas les
// re-signaler (prose 2024A vs table source=deck+bp = ambigu = non
// signale).
// ============================================================

function collectProseSources(rj: any): { text: string; path: string }[] {
  const out: { text: string; path: string }[] = [];
  const push = (text: unknown, path: string) => {
    if (typeof text === 'string' && text.length > 0) out.push({ text, path });
  };
  push(rj?.extraction?.rawSummary, 'extraction.rawSummary');
  push(rj?.financialData?.rawNotes, 'financialData.rawNotes');
  push(rj?.indicators?.synthesis, 'indicators.synthesis');
  push(rj?.valuation?.synthesis, 'valuation.synthesis');
  const inds = rj?.indicators?.indicators;
  if (Array.isArray(inds)) {
    for (let i = 0; i < inds.length; i++) {
      push(inds[i]?.rationale, `indicators.indicators[${i}].rationale`);
    }
  }
  return out;
}

// ============================================================
// Comparaisons
// ============================================================

function makeContradiction(
  metric: FinancialMetric,
  period: string,
  qualifier: PeriodQualifier,
  kind: 'table-vs-prose' | 'prose-vs-prose',
  left: MetricObservation,
  right: MetricObservation,
): NumericContradiction | null {
  const cfg = METRIC_CATALOG[metric];
  const tol = TOLERANCES[cfg.unit];
  const absDelta = Math.abs(left.value - right.value);
  const denom = Math.max(Math.abs(left.value), Math.abs(right.value));
  const relDelta = denom > 0 ? absDelta / denom : 0;
  if (absDelta <= tol.abs || relDelta <= tol.rel) return null;
  return {
    metric,
    period,
    qualifier,
    kind,
    left,
    right,
    absoluteDelta: absDelta,
    relativeDelta: relDelta,
    unit: cfg.unit,
  };
}

function crossTableVsProse(
  tableObs: MetricObservation[],
  proseObs: MetricObservation[],
  metric: FinancialMetric,
): NumericContradiction[] {
  const out: NumericContradiction[] = [];
  const proseSeen = new Set<string>();
  for (const pObs of proseObs) {
    const dkey = `${pObs.period}|${pObs.qualifier ?? ''}|${pObs.value}`;
    if (proseSeen.has(dkey)) continue;
    proseSeen.add(dkey);

    const tObs = tableObs.find(t => t.period === pObs.period);
    if (!tObs) continue;

    // Regle de compatibilite qualifier / source :
    //  - prose sans qualifier : on compare (V1).
    //  - prose avec qualifier : on ne compare QUE si le qualifier
    //    infere depuis table.sourceTag matche exactement. Sinon
    //    ce sont deux series distinctes du meme exercice.
    if (pObs.qualifier !== null) {
      const tQualifier = expectedQualifierFromSource(tObs.sourceTag);
      if (tQualifier === null || tQualifier !== pObs.qualifier) continue;
    }

    const c = makeContradiction(metric, tObs.period, pObs.qualifier, 'table-vs-prose', tObs, pObs);
    if (c) out.push(c);
  }
  return out;
}

// Prose-vs-prose : deux mentions dans des CHAMPS DIFFERENTS (pas
// deux extractions du meme champ, pas la meme source_tag), avec
// meme (metric, period, qualifier), et valeurs divergentes. La
// discipline qualifier reste appliquee : qualifiers differents,
// on ne compare pas.
function crossProseVsProse(
  proseObs: MetricObservation[],
  metric: FinancialMetric,
): NumericContradiction[] {
  // Grouper par (period, qualifier)
  const groups = new Map<string, MetricObservation[]>();
  for (const o of proseObs) {
    const key = `${o.period}|${o.qualifier ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }
  const out: NumericContradiction[] = [];
  const emittedPairs = new Set<string>();
  for (const [gkey, obs] of Array.from(groups.entries())) {
    if (obs.length < 2) continue;
    for (let i = 0; i < obs.length; i++) {
      for (let j = i + 1; j < obs.length; j++) {
        const a = obs[i];
        const b = obs[j];
        // Ignorer les paires du MEME champ (doublon regex ou meme
        // sentence) : elles ne materialisent pas une contradiction
        // entre deux moteurs.
        if (a.location === b.location) continue;
        // Ignorer si valeurs strictement egales.
        if (a.value === b.value) continue;
        // Dedupe pair par (locations triees) pour ne pas emettre
        // deux fois la meme arete si l ordre change.
        const pairKey = [a.location, b.location].sort().join('|') + '|' + gkey;
        if (emittedPairs.has(pairKey)) continue;
        emittedPairs.add(pairKey);
        const c = makeContradiction(metric, a.period, a.qualifier, 'prose-vs-prose', a, b);
        if (c) out.push(c);
      }
    }
  }
  return out;
}

// ============================================================
// API publique
// ============================================================

export function detectNumericContradictions(resultJson: any): NumericContradiction[] {
  if (!resultJson || typeof resultJson !== 'object') return [];

  const proseSources = collectProseSources(resultJson);
  const out: NumericContradiction[] = [];

  for (const metric of Object.keys(METRIC_CATALOG) as FinancialMetric[]) {
    const tableObs = extractFromTable(resultJson, metric);

    const proseObs: MetricObservation[] = [];
    for (const src of proseSources) {
      proseObs.push(...extractFromProse(src.text, metric, src.path));
    }

    if (tableObs.length > 0 && proseObs.length > 0) {
      out.push(...crossTableVsProse(tableObs, proseObs, metric));
    }
    if (proseObs.length >= 2) {
      out.push(...crossProseVsProse(proseObs, metric));
    }
  }

  return out;
}
