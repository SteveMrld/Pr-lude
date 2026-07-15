// ============================================================
// REFUTATION LAYER, BRIQUE 3 : contradictions label contre calcul
// ------------------------------------------------------------
// Module pur, aucune I/O, aucun branchement au rendu. Detecte
// deterministiquement les cas ou une metrique derivee est
// presentee sans qualification, alors que son calcul repose sur
// une base temporelle projetee ou non declaree.
//
// Cas cible V1 : Rule of 40 et Revenue par employe, tous deux
// calcules par indicators-engine.ts sur `new Date().getFullYear()`
// (annee courante du calendrier). Sur un dossier dont l annee de
// reference est anterieure (deck de 2024 rejoue en 2026, dernier
// exercice A = 2024A), la base de calcul est en fait projetee sur
// N+2 alors que le label ne dit pas forward.
//
// La brique lit la base temporelle reellement utilisee par le
// calcul (deduite du rationale ou de la structure des projections)
// puis compare a l annee de reference du dossier (deduite du champ
// as_of, du nom de fichier, ou du rawNotes financial via les
// qualifiers A/B/E/F). Si base > reference et si le libelle ou le
// contexte proche ne portent aucune qualification forward, signale.
//
// Design conservateur, meme discipline que les deux premieres
// briques du refutation layer. En cas de doute sur la qualification,
// ne signale pas. Si aucun ancrage temporel n est extractible, ne
// signale pas.
//
// Cas volontairement NON couverts en V1 :
//   - Autres indicateurs (Burn multiple, NDR, Magic Number, Payback
//     CAC, Marge brute). Chacun a une semantique temporelle propre
//     qui merite une extension incrementale et sa propre validation.
//     Marge brute mentionne "pour l annee courante" dans son
//     rationale, ce qui pourrait etre considere comme qualification
//     insuffisante mais reste ambigu, on ne signale pas.
//   - Metriques d indicateurs industriels (unitMargin, orderBacklog,
//     etc.) qui ont une temporalite mixte projet vs annuelle.
//   - Fourchettes de valorisation dont le multiple est applique
//     sur un ARR forward sans le dire. Different ordre d analyse.
//   - Contradictions entre plusieurs indicateurs (ex Rule of 40
//     forward + Payback CAC actual, incoherence de base temporelle).
//     Necessite un rule dedie multi indicateurs.
//   - Analyses ou l annee de reference du dossier n est pas
//     detectable. Le module reste silencieux, mieux vaut manquer
//     que d inventer.
// ============================================================

// ============================================================
// Types
// ============================================================

export type TargetedIndicatorKey = 'ruleOf40' | 'revenuePerEmployee';

export interface LabelCalculationContradiction {
  ruleId: 'derived-metric-forward-base-unqualified';
  indicatorKey: TargetedIndicatorKey;
  indicatorLabel: string;
  baseYearOfCalculation: number;
  dossierRefYear: number;
  yearsForward: number;
  labelExcerpt: string;
  rationaleExcerpt: string;
  message: string;
}

// ============================================================
// Regex de qualification et d ancrage temporel
// ------------------------------------------------------------
// Groupes de mots qui suffisent, s ils apparaissent dans le label
// ou le rationale, a considerer que le lecteur a ete averti de la
// nature forward de la metrique. On accepte large : mieux vaut
// manquer une contradiction que d en inventer une.
// ============================================================

export const FORWARD_QUALIFIER_REGEX =
  /(?:forward|projet[eé]|projection|estim[eé]|pr[eé]vision(?:nel)?|budg[eé]t[eé]?|cible|forecast|d['’]?ici|\bfy\s*\+\s*\d\b|20\d{2}\s*[BEFP]\b|annee\s+projet|previsionnel)/i;

// Reconnaitre une mention explicite d annee dans le rationale
// avec qualifier (2024A, 2026E, 2025F, 2024B).
const YEAR_QUALIFIER_REGEX = /(20\d{2})\s*([ABEFP])\b/gi;

// ============================================================
// Detection de l annee de reference du dossier
// ============================================================

/**
 * Ordre de precedence :
 *   1. option refYearOverride (injection test ou config)
 *   2. as_of / frozen_as_of du champ analyses (annee extraite)
 *   3. Max annee A ou B trouvee dans financialData.rawNotes ou
 *      extraction.rawSummary via YEAR_QUALIFIER_REGEX
 *   4. Annee extraite du source_filename (motif YYYY.MM.DD)
 *   5. null, la regle reste silencieuse
 */
export function detectDossierRefYear(
  rj: any,
  meta: { asOf?: string | null; sourceFilename?: string | null; refYearOverride?: number },
): number | null {
  if (meta.refYearOverride && Number.isFinite(meta.refYearOverride)) return meta.refYearOverride;

  if (typeof meta.asOf === 'string') {
    const y = parseInt(meta.asOf.slice(0, 4), 10);
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
  }

  const notes = String(rj?.financialData?.rawNotes || '') + ' ' + String(rj?.extraction?.rawSummary || '');
  let maxActualYear = 0;
  YEAR_QUALIFIER_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = YEAR_QUALIFIER_REGEX.exec(notes)) !== null) {
    const y = parseInt(m[1], 10);
    const q = m[2].toUpperCase();
    if (q === 'A' || q === 'B') {
      if (y > maxActualYear && y >= 2000 && y <= 2100) maxActualYear = y;
    }
  }
  if (maxActualYear > 0) return maxActualYear;

  if (typeof meta.sourceFilename === 'string') {
    const fm = meta.sourceFilename.match(/(20\d{2})[.\-_](\d{2})[.\-_](\d{2})/);
    if (fm) {
      const y = parseInt(fm[1], 10);
      if (Number.isFinite(y)) return y;
    }
    // Fallback : premiere annee 20XX presente dans le nom
    const fm2 = meta.sourceFilename.match(/(20\d{2})/);
    if (fm2) {
      const y = parseInt(fm2[1], 10);
      if (Number.isFinite(y)) return y;
    }
  }

  return null;
}

// ============================================================
// Detection de l annee de base du calcul
// ------------------------------------------------------------
// Le rationale mentionne parfois explicitement la valeur numerique
// (Revenue par employe : "Revenue 2,75M€ / 18 ETP = ..."). On
// extrait la valeur et on cherche dans financialData.revenueProjection
// l annee correspondante (a 1% pres). Si aucun match, on tombe
// sur `nowYear` (heuristique : indicators-engine.ts calcule sur
// new Date().getFullYear()).
//
// Pour Rule of 40, le rationale expose des pourcentages sans
// revenu absolu. On utilise directement le fallback nowYear
// clampe au max annee de revenueProjection, ce qui reproduit le
// comportement observe du moteur.
// ============================================================

function extractRevenueFromRationale(rationale: string): number | null {
  const rx = /(\d+(?:[.,]\d+)?)\s*(k|m|md|mds)?\s*(?:€|eur)/i;
  const m = rationale.match(rx);
  if (!m) return null;
  let v = parseFloat(m[1].replace(',', '.'));
  const s = (m[2] || '').toLowerCase();
  if (s === 'k') v *= 1_000;
  else if (s === 'm') v *= 1_000_000;
  else if (s === 'md' || s === 'mds') v *= 1_000_000_000;
  return Number.isFinite(v) ? v : null;
}

function findYearForRevenue(
  projection: Array<{ year: string | number; value: number }> | undefined,
  targetValueEur: number,
): number | null {
  if (!Array.isArray(projection) || projection.length === 0) return null;
  // revenueProjection.value est en M€ dans TOLSON (1.6 pour 1.6M€).
  // targetValueEur est en EUR. On normalise en EUR.
  let best: { year: number; delta: number } | null = null;
  for (const p of projection) {
    const y = parseInt(String(p.year), 10);
    if (!Number.isFinite(y)) continue;
    const vEur = p.value * 1_000_000;
    const delta = Math.abs(vEur - targetValueEur) / Math.max(vEur, targetValueEur);
    if (delta < 0.05 && (!best || delta < best.delta)) best = { year: y, delta };
  }
  return best ? best.year : null;
}

function maxYearInProjection(projection: Array<{ year: string | number }> | undefined): number | null {
  if (!Array.isArray(projection) || projection.length === 0) return null;
  let max = 0;
  for (const p of projection) {
    const y = parseInt(String(p.year), 10);
    if (Number.isFinite(y) && y > max) max = y;
  }
  return max > 0 ? max : null;
}

function detectBaseYearForIndicator(
  indicator: { key: string; rationale?: string | null },
  rj: any,
  nowYear: number,
): number | null {
  const rationale = String(indicator.rationale || '');
  // 1. Parse revenu absolu dans rationale (marche pour revenuePerEmployee)
  const rev = extractRevenueFromRationale(rationale);
  if (rev !== null) {
    const y = findYearForRevenue(rj?.financialData?.revenueProjection, rev);
    if (y !== null) return y;
  }
  // 2. Fallback : indicators-engine calcule sur new Date().getFullYear()
  //    clampe au max annee de la projection revenue
  const maxProj = maxYearInProjection(rj?.financialData?.revenueProjection);
  if (maxProj === null) return null;
  return Math.min(nowYear, maxProj);
}

// ============================================================
// Detection de qualification dans label + rationale
// ------------------------------------------------------------
// Si le label ou le rationale contiennent un mot cle forward,
// projete, estime, budget, cible, forecast, ou une mention
// explicite YYYY[BEFP], on considere que le lecteur est prevenu.
// ============================================================

function isQualifiedAsForward(label: string, rationale: string): boolean {
  const combined = `${label} ${rationale}`;
  return FORWARD_QUALIFIER_REGEX.test(combined);
}

// ============================================================
// API publique
// ============================================================

export interface DetectOptions {
  /** Annee courante calendaire, injectable pour tests deterministes. */
  nowYear?: number;
  /** Annee de reference du dossier, injectable pour forcer la valeur. */
  refYearOverride?: number;
  /** Champ as_of de la ligne analyses. */
  asOf?: string | null;
  /** Nom du fichier source de l analyse. */
  sourceFilename?: string | null;
}

const TARGETED_KEYS: TargetedIndicatorKey[] = ['ruleOf40', 'revenuePerEmployee'];

export function detectLabelCalculationContradictions(
  resultJson: any,
  opts: DetectOptions = {},
): LabelCalculationContradiction[] {
  if (!resultJson || typeof resultJson !== 'object') return [];
  const nowYear = opts.nowYear ?? new Date().getFullYear();

  const refYear = detectDossierRefYear(resultJson, {
    asOf: opts.asOf ?? null,
    sourceFilename: opts.sourceFilename ?? null,
    refYearOverride: opts.refYearOverride,
  });
  if (refYear === null) return [];

  const indicators = resultJson?.indicators?.indicators;
  if (!Array.isArray(indicators)) return [];

  const out: LabelCalculationContradiction[] = [];
  for (const ind of indicators) {
    if (!ind || typeof ind !== 'object') continue;
    const key = ind.key;
    if (!TARGETED_KEYS.includes(key)) continue;
    if (ind.verdict === 'non-applicable' || ind.value === null || ind.value === undefined) continue;

    const label = String(ind.label || '');
    const rationale = String(ind.rationale || '');
    if (isQualifiedAsForward(label, rationale)) continue;

    const baseYear = detectBaseYearForIndicator(ind, resultJson, nowYear);
    if (baseYear === null) continue;
    if (baseYear <= refYear) continue;

    const yearsForward = baseYear - refYear;
    out.push({
      ruleId: 'derived-metric-forward-base-unqualified',
      indicatorKey: key,
      indicatorLabel: label,
      baseYearOfCalculation: baseYear,
      dossierRefYear: refYear,
      yearsForward,
      labelExcerpt: label,
      rationaleExcerpt: rationale.slice(0, 200),
      message: `${label} calculé sur ${baseYear} (${yearsForward} an${yearsForward > 1 ? 's' : ''} après l’année de référence ${refYear} du dossier), sans qualification forward dans le libellé ni le rationale.`,
    });
  }
  return out;
}
