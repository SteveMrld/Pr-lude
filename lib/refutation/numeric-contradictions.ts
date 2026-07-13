// ============================================================
// REFUTATION LAYER, BRIQUE 1 : contradictions chiffrees internes
// ------------------------------------------------------------
// Module pur, aucune I/O, aucun branchement au rendu. Detecte
// deterministiquement les cas ou une meme grandeur financiere,
// sur une meme periode, apparait avec deux valeurs numeriques
// incoherentes entre la table structuree (financialData.*Projection)
// et la prose libre du dossier (extraction.rawSummary).
//
// Design conservateur. Le risque de cette brique est le faux
// positif : signaler une contradiction imaginaire detruit la
// credibilite du refutation layer. On prefere manquer une
// contradiction que d en inventer une. Les patterns matches sont
// donc etroits, avec doubles gardes de proximite (annee proche
// du couple valeur+unite, precede de "en " ou "(").
//
// V1.1 : prise en compte du qualifier de periode (A/B/E/F) pour
// eliminer la classe de faux positifs actual contre budget. Un
// dossier VC francais expose systematiquement Actual (BP) et
// Budget (deck) cote a cote sur la meme annee : ce n est PAS
// une contradiction, ce sont deux series distinctes du meme
// exercice. On extrait le qualifier de la prose ("2024B", "2024A",
// "2024E", "2024F") et on infere un qualifier equivalent depuis
// le champ source de la table row ("bp" -> "A", "deck" -> "B",
// mixte ou absent -> null). Regle : ne signale que si les deux
// qualifiers matchent (ou si les deux sont null).
//
// Cas volontairement NON couverts en V1.1 :
//   - Divergences prose-vs-prose (deux passages narratifs
//     contradictoires sans reference table). Introduira un
//     double comptage sans dedup solide. V2.
//   - Divergences table-vs-table (rare, souvent construit par le
//     pipeline lui-meme). V2.
//   - Metriques autres que EBITDA et chiffre d affaires (revenue).
//     OPEX, FCF, headcount, marges brutes, ARR, LTV, CAC : chaque
//     grandeur ajoutee ouvre une classe de faux positifs qu il
//     faut valider une par une. Extension incrementale.
//   - Marges en % (les tables stockent en decimal 0.183, la prose
//     en pourcent 18,3 %). Facteur de conversion additionnel a
//     valider. V2.
//   - Prose portant qualifier E (estime) ou F (forecast) : pas de
//     mapping cote source table, on ne signale jamais. Correct par
//     defaut (safe), extension V2 apres observation du corpus.
//   - Champs prose au-dela de extraction.rawSummary
//     (financialData.rawNotes, preScan.*, finalRecommendation.*).
//     financialData.rawNotes peut mentionner explicitement DEUX
//     valeurs divergentes dans la meme phrase (moteur qui
//     documente la contradiction), ce qui doublerait le compte
//     sans dedup solide. Extension apres design dedup.
//   - Nombres sans unite monetaire explicite (ex "300 clients",
//     "10 sessions") : ambigus, exclus.
//   - Periodes non-annuelles (Q1, mensuel, semestriel). V2.
// ============================================================

// Seuils de tolerance. Double garde : une divergence n est
// signalee que si les DEUX seuils sont franchis simultanement.
// Ce couplage evite deux classes de faux positifs :
//   - petits ecarts absolus sur grosses valeurs (5 k€ sur 10 M€ =
//     0.05%, purement du rendu, ne signaler PAS)
//   - grands ecarts relatifs sur valeurs minuscules (50 % sur
//     100 €, souvent artefact de parsing, ne signaler PAS)
export const TOLERANCE_ABS_KEUR = 2;
export const TOLERANCE_REL = 0.02;

// Convention interne : toutes les valeurs normalisees en kilo-euros
// (k€). Les tables Prelude stockent en millions d euros (M€), on
// multiplie par 1000 a l extraction structurée. La prose peut
// mentionner k€ ou M€, on normalise a l extraction texte.

export type FinancialMetric = 'ebitda' | 'revenue';

interface MetricProbe {
  proseRegex: RegExp;   // detection du mot-cle dans la prose
  projectionField: string;  // champ dans rj.financialData
}

const METRIC_CATALOG: Record<FinancialMetric, MetricProbe> = {
  ebitda: {
    proseRegex: /\bebitda\b/i,
    projectionField: 'ebitdaProjection',
  },
  revenue: {
    // "chiffre d'affaires" (variantes accentuation apostrophe),
    // "revenue" mot entier. On evite le sigle "CA" seul, trop
    // frequent en faux positif (California, "CA c est nul", etc.).
    proseRegex: /chiffre\s+d[’']affaires|\brevenue\b/i,
    projectionField: 'revenueProjection',
  },
};

// Qualifier de periode : A = Actual (realise), B = Budget
// (previsionnel), E = Estime, F = Forecast. null si absent
// (prose sans suffixe apres l annee) ou non inferable (table row
// avec source ambigue).
export type PeriodQualifier = 'A' | 'B' | 'E' | 'F' | null;

export interface MetricObservation {
  metric: FinancialMetric;
  period: string;             // annee "2024"
  qualifier: PeriodQualifier; // suffixe A/B/E/F, null si absent
  valueKeur: number;          // normalisee en kilo-euros
  location: string;           // chemin JSON dans result_json
  rawSnippet: string;         // extrait source, tronque
  sourceTag?: string;         // table only : "bp"|"deck"|"deck+bp"|...
}

export interface NumericContradiction {
  metric: FinancialMetric;
  period: string;
  table: MetricObservation;
  prose: MetricObservation;
  absoluteDeltaKeur: number;
  relativeDelta: number;
}

// ============================================================
// Parsers atomiques
// ============================================================

// Nombre francais : "293", "1 600", "1,6", "1 600,5"
function parseFrenchNumber(s: string): number {
  const cleaned = s.replace(/[\s ]/g, '').replace(',', '.');
  return parseFloat(cleaned);
}

// Multiplicateur d unite vers k€. null = unite non reconnue.
function unitMultiplierToKeur(unit: string): number | null {
  const u = unit.toLowerCase().replace(/\s+/g, ' ').trim();
  if (u === 'k€' || u === 'keur' || u === 'k eur' || u === "milliers d'euros" || u === 'milliers d euros') return 1;
  if (u === 'm€' || u === 'meur' || u === 'm eur' || u === "millions d'euros" || u === 'millions d euros') return 1000;
  return null;
}

// ============================================================
// Extraction depuis la table structuree
// ============================================================

function extractFromTable(resultJson: any, metric: FinancialMetric): MetricObservation[] {
  const fd = resultJson?.financialData;
  if (!fd || typeof fd !== 'object') return [];
  const field = METRIC_CATALOG[metric].projectionField;
  const arr = fd[field];
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
      qualifier: null,       // table rows n encodent pas A/B directement
      valueKeur: v * 1000,   // convention table = M€
      location: `financialData.${field}[${i}]`,
      rawSnippet: JSON.stringify(row),
      sourceTag: source,
    });
  }
  return out;
}

// Mapping conservateur source table -> qualifier attendu :
// "bp"   -> Actual  (BP contient typiquement les series realisees)
// "deck" -> Budget  (deck marketing porte typiquement le prev)
// "deck+bp", "bp+deck", autres, absent -> null (ambigu, on ne
// deduit rien). Volontairement strict pour eviter les fausses
// equivalences ; ces cas ambigus se traduisent, dans la regle
// de comparaison, par un non-signalement si la prose porte un
// qualifier explicite.
function expectedQualifierFromSource(source: string | undefined): PeriodQualifier {
  if (!source) return null;
  const s = source.trim().toLowerCase();
  if (s === 'bp') return 'A';
  if (s === 'deck') return 'B';
  return null;
}

// ============================================================
// Extraction depuis la prose
// ------------------------------------------------------------
// Deux patterns fermes, tres restrictifs :
//   RE_A : <metric> ... <annee> ... <nombre> <unite>
//          exemple : "chiffre d'affaires 2024 est estime a 1,6 M€"
//   RE_B : <metric> ... <nombre> <unite> ... (en |()<annee>
//          exemple : "EBITDA de 293 k€ (18,3 %) en 2024"
// Distances plafonnees pour eviter les faux positifs longue portee.
// L annee dans RE_B doit imperativement etre precedee de "en " ou
// "(" pour eliminer les mentions accessoires ("depuis 2017", "n° 2019").
// ============================================================

const UNIT_ALT = "(?:k€|M€|k\\s*€|M\\s*€|k\\s*eur|M\\s*eur|milliers\\s+d[’']euros|millions\\s+d[’']euros)";
const NUM_ALT = "(\\d[\\d\\s\\u00a0.,]{0,15})";
// Annee + qualifier optionnel colle a l annee : "2024", "2024A",
// "2024B", "2024E", "2024F", casse indifferente. Le (?!\\d) evite
// de capturer "2024" au sein de "20240" par erreur.
const YEAR_QUALIFIED = "(20\\d{2})([ABEFabef])?(?!\\d)";

function buildRegexes(metric: FinancialMetric): { A: RegExp; B: RegExp } {
  const mSrc = METRIC_CATALOG[metric].proseRegex.source;
  // A : metric ANNEE ... nombre unite. Fenetre 8 chars entre le
  // mot-cle metric et l annee, pour capturer "chiffre d'affaires
  // 2024 est estime a X M€" (1 char de separation) tout en
  // rejetant "EBITDA de 293 k€ (18,3 %) en 2024" (22 chars, cet
  // ordre-la est traite par le pattern B).
  const A = new RegExp(
    `(${mSrc})[^.\\n]{0,8}?\\b${YEAR_QUALIFIED}[^.\\n]{0,60}?${NUM_ALT}\\s*(${UNIT_ALT})`,
    'gi'
  );
  // B : metric ... nombre unite (en |()annee (annee apres unite)
  const B = new RegExp(
    `(${mSrc})[^.\\n]{0,60}?${NUM_ALT}\\s*(${UNIT_ALT})[^.\\n]{0,25}?(?:en\\s+|\\()${YEAR_QUALIFIED}`,
    'gi'
  );
  return { A, B };
}

function normalizeQualifier(raw: string | undefined): PeriodQualifier {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === 'A' || u === 'B' || u === 'E' || u === 'F') return u;
  return null;
}

function extractFromProse(text: string, metric: FinancialMetric, location: string): MetricObservation[] {
  if (typeof text !== 'string' || text.length === 0) return [];
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
    const mult = unitMultiplierToKeur(unitStr);
    if (mult === null) return;
    const valueKeur = num * mult;
    const qualifier = normalizeQualifier(qualifierRaw);
    const key = `${yearStr}|${qualifier ?? ''}|${valueKeur}|${matchText.slice(0, 40)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      metric,
      period: yearStr,
      qualifier,
      valueKeur,
      location,
      rawSnippet: matchText.slice(0, 200),
    });
  };

  let m: RegExpExecArray | null;
  // Pattern A groups : 1=metric, 2=year, 3=qualifier?, 4=number, 5=unit
  A.lastIndex = 0;
  while ((m = A.exec(text)) !== null) {
    push(m[4], m[5], m[2], m[3], m[0]);
  }
  // Pattern B groups : 1=metric, 2=number, 3=unit, 4=year, 5=qualifier?
  B.lastIndex = 0;
  while ((m = B.exec(text)) !== null) {
    push(m[2], m[3], m[4], m[5], m[0]);
  }

  return out;
}

// ============================================================
// API publique
// ============================================================

export function detectNumericContradictions(resultJson: any): NumericContradiction[] {
  if (!resultJson || typeof resultJson !== 'object') return [];

  const contradictions: NumericContradiction[] = [];

  // Sources prose autorisees en V1. Restrictif deliberement.
  // Champs ajoutables en V2 apres design du dedup contre les
  // notes qui documentent elles-memes la contradiction (ex
  // financialData.rawNotes).
  const proseSources: { text: unknown; path: string }[] = [
    { text: resultJson?.extraction?.rawSummary, path: 'extraction.rawSummary' },
  ];

  for (const metric of Object.keys(METRIC_CATALOG) as FinancialMetric[]) {
    const tableObs = extractFromTable(resultJson, metric);
    if (tableObs.length === 0) continue;

    const proseObs: MetricObservation[] = [];
    for (const src of proseSources) {
      if (typeof src.text === 'string') {
        proseObs.push(...extractFromProse(src.text, metric, src.path));
      }
    }
    if (proseObs.length === 0) continue;

    // Dedupe cote prose : meme (period, qualifier, valueKeur)
    // plusieurs fois dans le meme snippet ne compte qu une fois.
    const proseSeen = new Set<string>();
    for (const pObs of proseObs) {
      const dkey = `${pObs.period}|${pObs.qualifier ?? ''}|${pObs.valueKeur}`;
      if (proseSeen.has(dkey)) continue;
      proseSeen.add(dkey);

      const tObs = tableObs.find(t => t.period === pObs.period);
      if (!tObs) continue;

      // Regle de compatibilite qualifier :
      //  - prose sans qualifier : on compare (comportement V1)
      //  - prose avec qualifier : on ne compare QUE si le qualifier
      //    infere depuis table.sourceTag matche exactement. Sinon
      //    ce sont deux series distinctes du meme exercice
      //    (actual vs budget), on ne signale pas.
      if (pObs.qualifier !== null) {
        const tableQualifier = expectedQualifierFromSource(tObs.sourceTag);
        if (tableQualifier === null || tableQualifier !== pObs.qualifier) continue;
      }

      const absDelta = Math.abs(tObs.valueKeur - pObs.valueKeur);
      const denom = Math.max(Math.abs(tObs.valueKeur), Math.abs(pObs.valueKeur));
      const relDelta = denom > 0 ? absDelta / denom : 0;
      if (absDelta > TOLERANCE_ABS_KEUR && relDelta > TOLERANCE_REL) {
        contradictions.push({
          metric,
          period: tObs.period,
          table: tObs,
          prose: pObs,
          absoluteDeltaKeur: absDelta,
          relativeDelta: relDelta,
        });
      }
    }
  }

  return contradictions;
}
