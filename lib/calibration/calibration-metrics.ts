// ============================================================
// CALIBRATION METRICS - probabilite predite vs frequence reelle
// ------------------------------------------------------------
// Pilier preuve, brique reconciliation et calibration.
//
// Calcule la courbe de calibration, le score de Brier et un
// indicateur de discrimination a partir d un jeu de paires
// (probabilite predite, issue binaire realisee).
//
// Point crucial : tout est SEGMENTE par fingerprint de version
// stamp. On ne melange jamais des predictions de versions
// differentes du systeme comme si c etait le meme instrument.
// Une refonte de prompt ou un nouveau modele LLM produit un
// nouveau fingerprint, donc une nouvelle courbe.
//
// Sous le seuil de donnees (par defaut N=10 par segment), on
// retourne un etat "donnees insuffisantes" plutot qu une
// metrique trompeuse. Echec honnete.
//
// Module pur : pas d I/O. Le store appelle, on calcule.
// ============================================================

export const DEFAULT_MIN_RESOLVED_PER_SEGMENT = 10;

/**
 * Bins de calibration. Dix bins de largeur 0.1 (0-10%, 10-20%, ...).
 * Choix classique pour rester lisible sans sur-discretiser sur des
 * jeux de petite taille.
 */
export const DEFAULT_CALIBRATION_BINS = 10;

// ============================================================
// Types entree / sortie
// ============================================================

export interface CalibrationInput {
  /** Probabilite predite [0, 1]. */
  predicted: number;
  /** Issue realisee binaire : 1 = succes, 0 = echec. */
  observed: 0 | 1;
  /** Fingerprint du version stamp (clef de segmentation). */
  stampFingerprint: StampFingerprintKey;
}

/**
 * Sous-ensemble du StampFingerprint utilise comme clef de
 * segmentation. On ne segmente PAS par inputs (chaque dossier
 * a des inputs differents par construction) : la clef pertinente
 * est commit + configs + engines + models. Deux predictions avec
 * la meme clef sont issues du meme instrument applique sur des
 * dossiers differents.
 */
export interface StampFingerprintKey {
  commitSha: string | null;
  configsHash: string | null;
  enginesHash: string | null;
  modelsHash: string | null;
}

export interface CalibrationBin {
  /** Borne inferieure du bin [0, 1]. */
  binLower: number;
  /** Borne superieure du bin [0, 1]. */
  binUpper: number;
  /** Nombre de predictions tombant dans ce bin. */
  count: number;
  /** Moyenne des probabilites predites dans ce bin. */
  meanPredicted: number;
  /** Frequence reelle des succes observes dans ce bin. */
  observedFrequency: number;
}

export type CalibrationSegmentResult =
  | {
      calibrable: true;
      segmentKey: StampFingerprintKey;
      resolvedCount: number;
      /** Score de Brier (0 = parfait, 0.25 = aleatoire equilibre, plus haut = pire). */
      brier: number;
      /**
       * Indicateur de discrimination (Mann-Whitney U / AUC equivalent).
       * 0.5 = aleatoire. > 0.5 = le modele tend a predire plus haut pour
       * les succes que pour les echecs. < 0.5 = inversion. Calcule a
       * partir du rang des probabilites predites entre les deux classes.
       */
      discrimination: number;
      /** Courbe de calibration : bins de probabilite predite avec leur
       *  frequence reelle d issue positive. */
      bins: CalibrationBin[];
    }
  | {
      calibrable: false;
      segmentKey: StampFingerprintKey;
      resolvedCount: number;
      requiredCount: number;
      reason: 'insufficient-data';
    };

export interface CalibrationReport {
  /** Etat global, agrege sur tous les segments. */
  totalResolved: number;
  /** Nombre de records non resolus exclus. */
  totalUnresolved: number;
  /** Segments individuels, un par fingerprint distinct. */
  segments: CalibrationSegmentResult[];
  /** Seuil applique. */
  minResolvedPerSegment: number;
  /** Au moins un segment a-t-il franchi le seuil ? Si false, la vue
   *  UI doit afficher "non calibrable encore". */
  anyCalibrable: boolean;
}

// ============================================================
// Helpers internes
// ============================================================

function segmentKeyToString(k: StampFingerprintKey): string {
  return [
    k.commitSha ?? 'NULL',
    k.configsHash ?? 'NULL',
    k.enginesHash ?? 'NULL',
    k.modelsHash ?? 'NULL',
  ].join('|');
}

function groupBySegment(
  inputs: CalibrationInput[],
): Map<string, { key: StampFingerprintKey; rows: CalibrationInput[] }> {
  const groups = new Map<string, { key: StampFingerprintKey; rows: CalibrationInput[] }>();
  for (const row of inputs) {
    const sk = segmentKeyToString(row.stampFingerprint);
    let bucket = groups.get(sk);
    if (!bucket) {
      bucket = { key: row.stampFingerprint, rows: [] };
      groups.set(sk, bucket);
    }
    bucket.rows.push(row);
  }
  return groups;
}

/**
 * Score de Brier : moyenne quadratique des ecarts entre proba
 * predite et issue binaire. 0 = parfait, 0.25 = aleatoire equilibre.
 */
function computeBrierScore(rows: CalibrationInput[]): number {
  if (rows.length === 0) return 0;
  let sumSq = 0;
  for (const r of rows) {
    const d = r.predicted - r.observed;
    sumSq += d * d;
  }
  return sumSq / rows.length;
}

/**
 * AUC equivalent par formule de Mann-Whitney U normalisee :
 *   AUC = (somme des rangs des positifs - n_pos * (n_pos + 1) / 2)
 *         / (n_pos * n_neg)
 * Gere correctement les egalites (mid-rank).
 *
 * Si toutes les issues sont du meme type (n_pos=0 ou n_neg=0), la
 * discrimination n est pas definie. On retourne 0.5 (neutre).
 */
function computeDiscrimination(rows: CalibrationInput[]): number {
  const nPos = rows.filter(r => r.observed === 1).length;
  const nNeg = rows.length - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;

  // Rangs avec mid-rank pour les egalites
  const sorted = [...rows].sort((a, b) => a.predicted - b.predicted);
  const ranks = new Map<CalibrationInput, number>();
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].predicted === sorted[i].predicted) j++;
    const midRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks.set(sorted[k], midRank);
    i = j + 1;
  }

  let sumRankPos = 0;
  for (const r of rows) {
    if (r.observed === 1) sumRankPos += ranks.get(r) || 0;
  }
  return (sumRankPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/**
 * Decoupe l espace [0, 1] en bins et calcule pour chacun la frequence
 * reelle observee. Les bins vides sont omis.
 */
function computeCalibrationCurve(
  rows: CalibrationInput[],
  bins: number,
): CalibrationBin[] {
  const buckets: { sumPred: number; sumObs: number; count: number; lower: number; upper: number }[] =
    Array.from({ length: bins }, (_, i) => ({
      sumPred: 0,
      sumObs: 0,
      count: 0,
      lower: i / bins,
      upper: (i + 1) / bins,
    }));

  for (const r of rows) {
    // Clamp dans [0, 1] puis bucket index. Le dernier bin inclut 1.0.
    const p = Math.max(0, Math.min(1, r.predicted));
    let idx = Math.floor(p * bins);
    if (idx >= bins) idx = bins - 1;
    const b = buckets[idx];
    b.sumPred += p;
    b.sumObs += r.observed;
    b.count++;
  }

  return buckets
    .filter(b => b.count > 0)
    .map(b => ({
      binLower: b.lower,
      binUpper: b.upper,
      count: b.count,
      meanPredicted: b.sumPred / b.count,
      observedFrequency: b.sumObs / b.count,
    }));
}

// ============================================================
// API publique
// ============================================================

export interface ComputeCalibrationOptions {
  /** Seuil minimal de records resolus pour qu un segment soit calibrable.
   *  Defaut DEFAULT_MIN_RESOLVED_PER_SEGMENT. */
  minResolvedPerSegment?: number;
  /** Nombre de bins de la courbe. Defaut DEFAULT_CALIBRATION_BINS. */
  bins?: number;
}

/**
 * Calcule la calibration segmentee. C est la fonction principale du
 * module : prend une liste de paires (predicted, observed,
 * stampFingerprint) deja resolues, et retourne un rapport segmente
 * par fingerprint avec, par segment, soit les metriques calculees
 * soit l etat "donnees insuffisantes".
 *
 * Doit etre alimentee par le store, qui filtre lui-meme sur les
 * records dont l outcome est explicitement resolu (exit / fail).
 * Les non-resolus (alive / flat) ne doivent pas arriver ici.
 */
export function computeCalibration(
  inputs: CalibrationInput[],
  opts: ComputeCalibrationOptions = {},
): CalibrationReport {
  const minResolved = opts.minResolvedPerSegment ?? DEFAULT_MIN_RESOLVED_PER_SEGMENT;
  const bins = opts.bins ?? DEFAULT_CALIBRATION_BINS;

  const groups = groupBySegment(inputs);
  const segments: CalibrationSegmentResult[] = [];
  let anyCalibrable = false;

  for (const { key, rows } of Array.from(groups.values())) {
    if (rows.length < minResolved) {
      segments.push({
        calibrable: false,
        segmentKey: key,
        resolvedCount: rows.length,
        requiredCount: minResolved,
        reason: 'insufficient-data',
      });
      continue;
    }
    segments.push({
      calibrable: true,
      segmentKey: key,
      resolvedCount: rows.length,
      brier: computeBrierScore(rows),
      discrimination: computeDiscrimination(rows),
      bins: computeCalibrationCurve(rows, bins),
    });
    anyCalibrable = true;
  }

  return {
    totalResolved: inputs.length,
    totalUnresolved: 0,
    segments,
    minResolvedPerSegment: minResolved,
    anyCalibrable,
  };
}

/**
 * Variante pratique qui accepte aussi les records non resolus (avec
 * observed=null) et les exclut elle-meme. Renvoie en plus le compte
 * des non-resolus pour que l UI puisse dire "X dossiers resolus sur
 * N predictions logges". C est ce qu utilise le store en pratique.
 */
export interface CalibrationInputMaybeResolved {
  predicted: number;
  observed: 0 | 1 | null;
  stampFingerprint: StampFingerprintKey;
}

export function computeCalibrationFromMixed(
  inputs: CalibrationInputMaybeResolved[],
  opts: ComputeCalibrationOptions = {},
): CalibrationReport {
  const resolved: CalibrationInput[] = [];
  let unresolved = 0;
  for (const r of inputs) {
    if (r.observed === 0 || r.observed === 1) {
      resolved.push({
        predicted: r.predicted,
        observed: r.observed,
        stampFingerprint: r.stampFingerprint,
      });
    } else {
      unresolved++;
    }
  }
  const report = computeCalibration(resolved, opts);
  report.totalUnresolved = unresolved;
  return report;
}
