// ============================================================
// SCORE DE TRAJECTOIRE - SNAPSHOT EXTRACTOR
// ------------------------------------------------------------
// Convertit un payload d analyse complet (sortie de
// app/api/analyze/route.ts) en un TrajectorySnapshot compact
// destine a la persistence et a la comparaison.
//
// Ce helper est l interface entre la couche analyse (qui produit
// des donnees riches mais volumineuses) et le module trajectory
// (qui opere sur des snapshots reduits). Permet de stocker en
// base uniquement ce qui sert a la comparaison, et de garder la
// possibilite de regenerer un snapshot a partir d une analyse
// archivee.
//
// La fonction est defensive : elle tolere des payloads partiels
// ou des formats legacy sans les champs Phase 4.
// ============================================================

import type { TrajectorySnapshot, PatternAxesSnapshot } from './types';
import { PATTERN_IDS, type PatternId, type PatternVerdict, type PatternApplicability } from '../fragility-structurelle/types';
import type { Verdict } from '../score-calculator';

/**
 * Forme attendue du payload d analyse en input. On utilise un
 * any partiellement type pour rester souple face aux versions
 * historiques du payload (les anciens dossiers persistes peuvent
 * ne pas avoir les champs Phase 4).
 */
export interface AnalysisPayloadForSnapshot {
  /** Identifiant unique de l analyse. */
  analysisId?: string;
  id?: string;
  /** Timestamp ISO de l analyse. */
  analyzedAt?: string;
  createdAt?: string;
  created_at?: string;
  timestamp?: string;
  /** Score global et verdict. Plusieurs chemins possibles selon
   *  le format historique. */
  globalScore?: number;
  verdict?: Verdict | string;
  finalRecommendation?: {
    globalScore?: number;
    verdict?: Verdict | string;
  };
  /** Score mecanique avec dimensions. */
  mechanicalScore?: {
    globalScore?: number;
    verdict?: Verdict | string;
    dimensions?: {
      team?: { score?: number };
      market?: { score?: number };
      macro?: { score?: number };
      financial?: { score?: number };
      contrarian?: { score?: number };
      vigilance?: { score?: number };
    };
  };
  /** Sortie Fragilite Structurelle. Chaque pattern peut porter en
   *  plus du score global et du verdict ses trois axes (axis1
   *  identitaire, axis2 et axis3 peripheriques). Si les axes ne
   *  sont pas presents dans le payload (snapshots historiques ou
   *  format legacy), l extracteur degrade gracieusement et omet
   *  le champ `axes` dans le snapshot resultant. */
  fragiliteStructurelle?: {
    globalFragilityScore?: number;
    verdict?: PatternVerdict;
    patterns?: Partial<Record<PatternId, {
      globalScore?: number;
      verdict?: PatternVerdict;
      applicabilite?: PatternApplicability;
      axis1?: { score?: number; verdict?: PatternVerdict } | null;
      axis2?: { score?: number; verdict?: PatternVerdict } | null;
      axis3?: { score?: number; verdict?: PatternVerdict } | null;
    } | null>>;
    combinaisons?: Array<{ nom?: string; severite?: 'attention' | 'alerte' | 'drapeau-rouge' }>;
  };
  /** Sortie Narrative Drift. */
  narrativeDrift?: {
    globalDriftScore?: number;
    verdict?: PatternVerdict;
  };
}

/**
 * Extrait un TrajectorySnapshot d un payload d analyse complet.
 * Defensive : retourne null si les champs minimaux (analysisId,
 * analyzedAt, globalScore) sont absents. Le code appelant peut
 * decider quoi faire d un payload non-snapshotable.
 */
/**
 * Extrait le triplet d axes d un pattern si le payload les porte.
 * Retourne null si moins de trois axes valides sont presents, ce
 * qui permet d eviter de stocker un triplet partiel qui induirait
 * en erreur cote drill-down UI.
 */
type PatternPayload = NonNullable<NonNullable<NonNullable<AnalysisPayloadForSnapshot['fragiliteStructurelle']>['patterns']>[PatternId]>;

function extractAxes(p: PatternPayload): PatternAxesSnapshot | null {
  const a1 = p.axis1, a2 = p.axis2, a3 = p.axis3;
  const ok = (a: { score?: number; verdict?: PatternVerdict } | null | undefined): boolean =>
    !!a && typeof a.score === 'number' && !!a.verdict;
  if (!ok(a1) || !ok(a2) || !ok(a3)) return null;
  return {
    axis1: { score: a1!.score!, verdict: a1!.verdict! },
    axis2: { score: a2!.score!, verdict: a2!.verdict! },
    axis3: { score: a3!.score!, verdict: a3!.verdict! },
  };
}

export function extractSnapshot(analysis: AnalysisPayloadForSnapshot): TrajectorySnapshot | null {
  // Identifiant : on accepte plusieurs noms possibles
  const analysisId = analysis.analysisId ?? analysis.id;
  if (!analysisId) return null;

  // Timestamp : plusieurs noms possibles
  const analyzedAt = analysis.analyzedAt
    ?? analysis.createdAt
    ?? analysis.created_at
    ?? analysis.timestamp;
  if (!analyzedAt) return null;

  // Score global : peut venir du score mecanique, du
  // finalRecommendation, ou directement de la racine
  const globalScore = analysis.mechanicalScore?.globalScore
    ?? analysis.finalRecommendation?.globalScore
    ?? analysis.globalScore;
  if (typeof globalScore !== 'number') return null;

  // Verdict : meme logique
  const verdict = (analysis.mechanicalScore?.verdict
    ?? analysis.finalRecommendation?.verdict
    ?? analysis.verdict
    ?? 'approfondir') as Verdict;

  // Dimensions : on tolere l absence de certaines, fallback 50
  // (valeur neutre mediane). Si le score mecanique est absent, on
  // reconstruit a partir de globalScore en mode degrade.
  const dim = analysis.mechanicalScore?.dimensions ?? {};
  const dimensions = {
    team: dim.team?.score ?? globalScore,
    market: dim.market?.score ?? globalScore,
    macro: dim.macro?.score ?? globalScore,
    financial: dim.financial?.score ?? globalScore,
    contrarian: dim.contrarian?.score ?? globalScore,
    vigilance: dim.vigilance?.score ?? globalScore,
  };

  // Fragilite Structurelle : null si moteur non present ou tous
  // patterns non applicables
  const fs = analysis.fragiliteStructurelle;
  const fragiliteScore = fs?.globalFragilityScore ?? null;
  const fragiliteVerdict: PatternVerdict | null = fs?.verdict ?? null;

  // Narrative Drift : null si moteur non present
  const nd = analysis.narrativeDrift;
  const narrativeDriftScore = nd?.globalDriftScore ?? null;
  const narrativeDriftVerdict: PatternVerdict | null = nd?.verdict ?? null;

  // Patterns Phase 4 : on extrait pour chacun le score, le verdict
  // et l applicabilite. Patterns absents du payload sont marques
  // not-applicable avec score 0. Si le payload porte les trois
  // axes (cas patterns Phase 4 modernes), on extrait aussi le
  // triplet pour le drill-down ; sinon le champ `axes` est omis.
  const patterns: TrajectorySnapshot['patterns'] = {};
  for (const patternId of PATTERN_IDS) {
    const p = fs?.patterns?.[patternId];
    if (p && p.applicabilite && p.applicabilite !== 'not-applicable') {
      const entry: NonNullable<TrajectorySnapshot['patterns'][PatternId]> = {
        score: p.globalScore ?? 0,
        verdict: p.verdict ?? 'sain',
        applicabilite: p.applicabilite,
      };
      const axes = extractAxes(p);
      if (axes) entry.axes = axes;
      patterns[patternId] = entry;
    } else if (p) {
      patterns[patternId] = {
        score: 0,
        verdict: 'non-applicable',
        applicabilite: p.applicabilite ?? 'not-applicable',
      };
    }
    // Patterns absents du payload : on les omet (ils seront traites
    // comme not-applicable par le comparator)
  }

  // Combinaisons : on copie en filtrant les entrees malformees
  // (nom absent ou vide, severite manquante)
  const combinaisons = (fs?.combinaisons ?? [])
    .filter((c): c is { nom: string; severite: 'attention' | 'alerte' | 'drapeau-rouge' } =>
      !!c && typeof c.nom === 'string' && c.nom.trim().length > 0 && !!c.severite)
    .map(c => ({ nom: c.nom, severite: c.severite }));

  return {
    analysisId,
    analyzedAt,
    globalScore,
    verdict,
    dimensions,
    fragiliteScore,
    fragiliteVerdict,
    narrativeDriftScore,
    narrativeDriftVerdict,
    patterns,
    combinaisons,
  };
}
