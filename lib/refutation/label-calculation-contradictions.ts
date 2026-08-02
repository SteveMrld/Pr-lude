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
// La brique lit la base temporelle reellement utilisee par le calcul
// puis la compare a l annee de reference du dossier. Si base >
// reference et si le libelle ou le contexte proche ne portent aucune
// qualification forward, elle signale.
//
// Depuis quelle source elle lit cette base, brique 22 :
//
//   1. indicator.computedForYear, quand le champ est present. C est
//      le moteur d indicateurs lui-meme qui declare l annee sur
//      laquelle il a calcule, a cote d un baseState tri-etat. Aucune
//      reconstruction ne peut battre une declaration.
//
//   2. A defaut, et seulement sur les result_json anterieurs a
//      l existence du champ, une reconstruction par mesure : on
//      cherche dans le rationale une grandeur qui identifie l annee de
//      facon falsifiable, montant de revenu absolu ou taux de
//      croissance annuel, et on la recroise avec revenueProjection.
//
//   3. A defaut, silence.
//
// Ce qui a disparu, et pourquoi : la brique retombait sur
// min(annee courante, derniere annee des projections) des que le
// rationale ne portait pas de montant. Elle reproduisait ainsi
// l ancien comportement d horloge du moteur d indicateurs, en pariant
// que les deux horloges disaient la meme chose. Depuis que le moteur
// calcule sur l annee de reference du dossier, le pari est faux et la
// brique fabriquait la contradiction qu elle pretendait detecter : sur
// le dossier de reference du corpus, Rule of 40 porte
// computedForYear 2023 et baseState actual, la brique annoncait une
// base 2026 et signalait trois ans de projection non qualifiee. Une
// contradiction inventee coute plus cher qu une contradiction
// manquee : elle apprend au lecteur a ignorer le cartouche.
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

// ============================================================
// Detection de l annee de reference du dossier
// ------------------------------------------------------------
// Delegue a la primitive partagee lib/analysis/reference-year.ts.
// Signature de compatibilite conservee ici pour ne pas casser les
// consommateurs, mais la logique unique vit en amont.
// ============================================================

import { deriveDossierReferenceYear } from '../analysis/reference-year';

// Wrapper de compatibilite. Signature legacy conservee mais tous
// les fallbacks (asOf, sourceFilename, refYearOverride) sont
// desormais ignores. L annee de reference vit uniquement dans
// financialData.lastActualYear avec evidence textuelle. Sur les
// dossiers du corpus actuel qui n ont pas ce champ, la primitive
// retourne null : le detecteur perdra ses declenchements sur ces
// dossiers, ce qui est le comportement correct.
export function detectDossierRefYear(
  rj: any,
  _meta?: { asOf?: string | null; sourceFilename?: string | null; refYearOverride?: number },
): number | null {
  return deriveDossierReferenceYear(rj);
}

// ============================================================
// Detection de l annee de base du calcul
// ------------------------------------------------------------
// Source primaire : indicator.computedForYear, declare par
// indicators-engine a cote de baseState. Les deux reconstructions
// qui suivent ne servent qu aux result_json produits avant que le
// champ n existe, et elles ont en commun de mesurer une grandeur
// que le calcul a reellement utilisee, non de deviner.
//
//   - Montant de revenu absolu dans le rationale, cas Revenue par
//     employe : "Revenue 2,75M€ / 18 ETP = ...". On recroise avec
//     revenueProjection a 5% pres.
//   - Taux de croissance annuel dans le rationale, cas Rule of 40 :
//     "Croissance YoY 27,3% + Marge FCF 22,5%". Une seule paire
//     d annees consecutives de la serie produit ce taux, ce qui
//     designe l annee de calcul sans ambiguite.
//
// Les deux sont falsifiables : si aucune annee de la serie ne rend
// la grandeur lue, la fonction ne retourne rien.
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

/**
 * Extrait un taux de croissance annuel du rationale. Cible la forme
 * produite par indicators-engine pour Rule of 40, "Croissance YoY
 * 27.3% + Marge FCF 22.5%", ou le signe et la virgule decimale sont
 * tous deux possibles. Retourne le taux en points de pourcentage.
 */
function extractYoYGrowthFromRationale(rationale: string): number | null {
  const m = rationale.match(/croissance\s+yoy\s+(-?\d+(?:[.,]\d+)?)\s*%/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

/**
 * Identifie l annee N telle que la croissance de N-1 vers N reproduit
 * le taux lu dans le rationale. Tolerance 0,5 point, qui absorbe
 * l arrondi a une decimale du rationale sans rendre deux paires
 * voisines confondables sur des series reelles. Une seule annee
 * candidate est acceptee : si deux paires produisent le meme taux, la
 * mesure ne designe rien et la fonction se tait.
 */
function findYearForYoYGrowth(
  projection: Array<{ year: string | number; value: number }> | undefined,
  targetPct: number,
): number | null {
  if (!Array.isArray(projection) || projection.length < 2) return null;
  const byYear = new Map<number, number>();
  for (const p of projection) {
    const y = parseInt(String(p.year), 10);
    const v = Number(p.value);
    if (Number.isFinite(y) && Number.isFinite(v) && !byYear.has(y)) byYear.set(y, v);
  }
  const matches: number[] = [];
  for (const [y, v] of Array.from(byYear.entries())) {
    const prev = byYear.get(y - 1);
    if (prev === undefined || prev === 0) continue;
    const pct = ((v - prev) / Math.abs(prev)) * 100;
    if (Math.abs(pct - targetPct) <= 0.5) matches.push(y);
  }
  return matches.length === 1 ? matches[0] : null;
}

function detectBaseYearForIndicator(
  indicator: { key: string; rationale?: string | null; computedForYear?: unknown },
  rj: any,
): number | null {
  // 1. Declaration du moteur. Prime sur toute reconstruction : c est
  //    l annee que le calcul a effectivement utilisee, pas une lecture
  //    de sa prose de sortie.
  const declared = indicator.computedForYear;
  if (typeof declared === 'number' && Number.isFinite(declared)) return declared;

  // 2 et 3. Chemin legacy, result_json anterieurs au champ. Deux
  //    mesures falsifiables, aucune heuristique de position ni
  //    d horloge. Silence si aucune ne designe une annee.
  const rationale = String(indicator.rationale || '');
  const projection = rj?.financialData?.revenueProjection;

  const rev = extractRevenueFromRationale(rationale);
  if (rev !== null) {
    const y = findYearForRevenue(projection, rev);
    if (y !== null) return y;
  }

  const growth = extractYoYGrowthFromRationale(rationale);
  if (growth !== null) {
    const y = findYearForYoYGrowth(projection, growth);
    if (y !== null) return y;
  }

  return null;
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
  /**
   * Ignore. La brique ne lit plus d horloge : l annee de base vient de
   * indicator.computedForYear, a defaut d une mesure recroisee avec
   * revenueProjection. Le champ reste dans la signature pour ne pas
   * casser les appelants, au meme titre que les trois options legacy
   * ci-dessous.
   */
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

    const baseYear = detectBaseYearForIndicator(ind, resultJson);
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
