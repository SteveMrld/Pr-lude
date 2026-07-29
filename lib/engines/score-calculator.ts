// ============================================================
// CALCUL MÉCANIQUE DU SCORE D'INSTRUCTION
// ------------------------------------------------------------
// Ce module est la source de vérité du scoring Prelude. Le score
// global et le verdict ne sont plus produits par l orchestrator
// LLM (qui souffrait d un biais de convergence : tous les dossiers
// APPROFONDIR donnaient ~52, tous les REFUSER ~22, etc., parce
// que le LLM calibrait ses dimensions sur le verdict qu il avait
// choisi). Ils sont calcules de maniere deterministe a partir
// des scores produits par les six moteurs Bloc 1 specialises,
// qui eux n ont aucune connaissance du verdict final.
//
// PRINCIPE DE SEPARATION
//
// Avant : un seul LLM produit verdict + score + dimensions, ce
//         qui revient a juger ET a produire les preuves chiffrees
//         du jugement. Convergence inevitable.
// Apres : le code calcule le score (deterministe, auditable, base
//         sur les moteurs Bloc 1 calibres sur les faits du dossier).
//         Le LLM orchestrator devient narrateur : il argumente le
//         verdict, ne le decide plus. Il peut signaler un desaccord
//         motive si son jugement structurel diverge fortement du
//         calcul mecanique.
//
// EVALUE CONTRE TOMBE
//
// Le calculateur ne recevait longtemps que six objets nullables et
// fondait un moteur tombe dans la moyenne avec un `?? 50`, valeur
// indistinguable d un vrai verdict median. Un dossier dont l equipe
// et le marche avaient timeout sortait donc un score compose a
// 42 % de rien, et la note affirmait que ce rien avait ete
// "produit par le moteur". Le score portait un fantome.
//
// Desormais chaque dimension est classee evaluee ou non evaluee.
// Une dimension est evaluee si son moteur a un statut abouti au
// releve d instrumentation ET si sa racine porte une vraie valeur
// de moteur. Elle est non evaluee si le moteur est absent, failed,
// failed-upstream, timeout, empty_output, ecarte du parcours, ou
// si la racine est une enveloppe sans aucun score exploitable.
// Le distinguo attrape aussi bien la racine nulle que le second
// etage : team et market presents mais sans sous-champs, et les
// sorties skippees du parcours growth qui posent des sous-scores
// a 50 sans qu aucun moteur n ait tourne.
//
// FORMULE
//
// Le score global est la moyenne ponderee des SEULES dimensions
// evaluees, renormalisee sur la somme de leurs poids :
//
// scoreGlobal = clamp(
//     somme( score_i * poids_i pour i evaluee )
//   / somme( poids_i pour i evaluee )
//   , 0, 100)
//
// Poids doctrinaux, inchanges :
//   Equipe 0.20 (composite team-engine)
//   Marche 0.22 (composite market-engine)
//   Macro 0.15 (contraryclicalOpportunity.score)
//   Modele economique 0.13 (financial-coherence.globalCoherenceScore)
//   Contrariens 0.15 (contrarian.globalContrarianScore)
//   Vigilance 0.15 (100 - blindspot.globalBlindspotScore)
//
// Sur un dossier dont les six moteurs ont abouti, le denominateur
// vaut 1.0 et le score est strictement identique a ce qu il etait.
// La renormalisation ne se declenche que sur les runs lacunaires.
//
// Les composites Equipe et Marche appliquent la meme doctrine un
// etage plus bas : ils aggregent les seuls sous-scores reellement
// produits et renormalisent sur leurs poids, au lieu de combler
// les absents par 50.
//
// SOCLE INSUFFISANT, TROISIEME ETAT
//
// En dessous de MINIMUM_EVALUATED_WEIGHT (la moitie du poids
// total), le score global n est pas produit. Le resultat porte
// scoreStatus 'insufficient-basis', globalScore et verdict a null.
// Ce troisieme etat est terminal : il ne rebascule jamais le calcul
// du score vers le LLM. Rendre la main au modele sur un socle
// troue reveillerait exactement le biais de convergence que ce
// module a ete ecrit pour eteindre.
//
// SEUILS DE VERDICT
//
// score >= 75 : INVESTIR
// 60 <= score < 75 : INVESTIR AVEC CONDITIONS
// 45 <= score < 60 : APPROFONDIR
// score < 45 : REFUSER
//
// Ces seuils sont publics et auditables. Un partner peut tracer
// chaque point du score a sa source moteur, et lire dans basis sur
// quelle assiette le score a ete calcule.
// ============================================================

import type {
  TeamAnalysisOutput,
  MarketAnalysisOutput,
  MacroAnalysisOutput,
  BlindspotAnalysisOutput,
  ContrarianAnalysisOutput,
  FinancialCoherenceOutput,
  FinancialCoherenceArchetype,
} from './types';
import { isSkipped } from './skipped-outputs';

export type Verdict = 'investir' | 'investir avec conditions' | 'approfondir' | 'refuser';

// ============================================================
// SEUILS DE DIVERGENCE ADAPTES A L ARCHETYPE
// ------------------------------------------------------------
// Le bandeau d alerte de divergence (UI) compare le score LLM au
// score mecanique. Un seuil universel etait trop sensible sur les
// dossiers non-SaaS : un dossier hardware ou biotech peut legitimement
// produire un ecart >15 points entre la lecture LLM (qui voit tous
// les outputs des moteurs) et le score mecanique (qui aggrege 6
// scores sources). On adapte le seuil a la couverture des tests
// applicables de l archetype :
//   - A SaaS pur, C marketplace, F consumer DTC : 7 tests applicables,
//     score mecanique pleinement instrumente. Seuil 15.
//   - B hardware, E B2G : 6 tests applicables (T2 LTV/CAC neutralise),
//     score mecanique legerement moins instrumente. Seuil 20.
//   - D biotech pre-approbation : 3 tests applicables seulement.
//     Score mecanique tres polarise, divergence LLM attendue. Seuil 25.
//   - unclassified : matrice non tranchee, 4 tests universels. Seuil 25.
//
// Le seuil 'assessorDisagreement' du LLM dans l orchestrator reste
// fixe a 12 points : il remonte tout desaccord motive dans la note,
// independamment de l archetype. Le bandeau visuel rouge n est
// declenche qu au-dela du seuil archetypal ci-dessous.
// ============================================================
export const DIVERGENCE_THRESHOLDS_BY_ARCHETYPE: Record<FinancialCoherenceArchetype, number> = {
  'A-saas-pur': 15,
  'C-marketplace': 15,
  'F-consumer-dtc': 15,
  'B-hardware-deeptech': 20,
  'E-b2g-defense': 20,
  'D-biotech-pre-approval': 25,
  'unclassified': 25,
};

/** Seuil de divergence par defaut quand l archetype n est pas connu
 *  (legacy / dossiers anterieurs au commit 5184213). Identique au
 *  comportement historique pour preserver la non-regression. */
export const DEFAULT_DIVERGENCE_THRESHOLD = 15;

/**
 * Poids des six dimensions dans le score global. Doivent sommer a 1.0
 * exactement. Calibres pour donner plus de poids aux dimensions qui
 * predisent le mieux le succes long terme dans le corpus historique
 * Prelude (Marche et Equipe representent 42% combine).
 */
export const DIMENSION_WEIGHTS = {
  team: 0.20,
  market: 0.22,
  macro: 0.15,
  financial: 0.13,
  contrarian: 0.15,
  vigilance: 0.15,
} as const;

export type DimensionKey = keyof typeof DIMENSION_WEIGHTS;

/** Ordre canonique des dimensions, utilise partout ou l on itere. */
export const DIMENSION_KEYS: readonly DimensionKey[] = [
  'team', 'market', 'macro', 'financial', 'contrarian', 'vigilance',
] as const;

/** Libelles de dimension pour la prose des rationales et de la base. */
export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  team: 'Equipe',
  market: 'Marche',
  macro: 'Macro et timing',
  financial: 'Modele economique',
  contrarian: 'Singularites contrariennes',
  vigilance: 'Vigilance critique',
};

/**
 * Cle du moteur qui alimente chaque dimension dans le releve
 * d instrumentation (EngineStatusRecorder, cf
 * lib/orchestrator/engine-status-recorder.ts). Les cles sont celles
 * du result_json, pas les libelles courts du wrapper deadline.
 */
export const DIMENSION_ENGINE_KEYS: Record<DimensionKey, string> = {
  team: 'team',
  market: 'market',
  macro: 'macro',
  financial: 'financialCoherence',
  contrarian: 'contrarianAnalysis',
  vigilance: 'blindspotAnalysis',
};

/**
 * Somme de poids evalue en dessous de laquelle aucun score global
 * n est produit. Fixee a la moitie du poids total : un score dont
 * plus de la moitie de l assiette manque n est pas un score
 * lacunaire, c est un chiffre sans socle. Mieux vaut le dire que
 * le produire.
 */
export const MINIMUM_EVALUATED_WEIGHT = 0.5;

/** Tolerance flottante sur la comparaison des poids cumules. Les
 *  poids sont des decimaux a deux chiffres, leur somme partielle
 *  peut valoir 0.4999999999999999. */
const WEIGHT_EPSILON = 1e-9;

/**
 * Seuils de verdict appliques au score mecanique. Entre les seuils,
 * le verdict est strictement determine. Un partner peut adapter ces
 * seuils en modifiant uniquement cette constante : tous les dossiers
 * passes peuvent etre recalcules.
 */
export const VERDICT_THRESHOLDS = {
  invest: 75,
  conditions: 60,
  investigate: 45,
} as const;

/**
 * Cause de non-evaluation d une dimension. Distingue ce qui releve
 * du pipeline (moteur tombe, coupe, ecarte) de ce qui releve du
 * dossier (donnees absentes). Le distinguo est doctrinal : on
 * n accuse pas le dossier d une lacune qui est celle du pipeline.
 */
export type DimensionEvaluationCause =
  | 'moteur-absent'
  | 'moteur-failed'
  | 'moteur-failed-upstream'
  | 'moteur-timeout'
  | 'moteur-empty-output'
  | 'moteur-skipped'
  | 'sous-champs-absents'
  | 'donnees-dossier-absentes';

/** Traduction des statuts du recorder en cause de non-evaluation.
 *  Un statut absent de cette table (ok, ou statut inconnu d une
 *  version future) laisse la decision aux gardes sur la racine. */
const STATUS_TO_CAUSE: Record<string, DimensionEvaluationCause> = {
  'failed': 'moteur-failed',
  'failed-upstream': 'moteur-failed-upstream',
  'timeout': 'moteur-timeout',
  'empty_output': 'moteur-empty-output',
  'skipped_not_applicable': 'moteur-skipped',
};

/** Prose de la cause, employee dans les rationales et dans la base. */
const CAUSE_LABELS: Record<DimensionEvaluationCause, string> = {
  'moteur-absent': 'le moteur n a produit aucune sortie sur ce run',
  'moteur-failed': 'le moteur a echoue sur son propre appel',
  'moteur-failed-upstream': 'le moteur n a jamais tourne, une de ses dependances amont a echoue',
  'moteur-timeout': 'le moteur a ete coupe par sa deadline avant de rendre sa sortie',
  'moteur-empty-output': 'le moteur a repondu sans contenu recevable',
  'moteur-skipped': 'le moteur a ete ecarte du parcours retenu pour ce dossier',
  'sous-champs-absents': 'le moteur a rendu une enveloppe sans aucun score exploitable',
  'donnees-dossier-absentes': 'le dossier ne porte pas les donnees necessaires a cette dimension',
};

/** Vue minimale du releve d instrumentation consommee ici. Volontairement
 *  structurelle plutot qu un import du type recorder : le calculateur
 *  ne doit dependre que de la presence d un champ status. */
export interface EngineStatusLike {
  status?: string;
}

export type EngineStatusMap = Record<string, EngineStatusLike | undefined | null>;

export interface DimensionBreakdown {
  /** Score brut sur 100 retenu pour cette dimension. Quand la dimension
   *  n est pas evaluee, porte la valeur neutre 50 heritee du modele
   *  historique, qui n entre PAS dans le calcul global. Ne jamais
   *  l afficher sans consulter `evaluated` au prealable. */
  score: number;
  /** Poids de la dimension dans le score global (somme = 1.0). */
  weight: number;
  /** Contribution arrondie au score global (score * weight). Vaut 0
   *  quand la dimension n est pas evaluee : elle ne contribue a rien. */
  contribution: number;
  /** Synthese textuelle des sous-scores qui composent ce score, ou
   *  enonce de la non-evaluation et de sa cause. */
  rationale: string;
  /** Sous-scores individuels qui ont nourri le composite (Equipe / Marche). */
  subScores?: Array<{ name: string; score: number; weight: number }>;
  /**
   * True si un moteur a reellement produit la valeur portee par cette
   * dimension. False si le moteur est tombe, a ete coupe, a ete ecarte
   * du parcours, ou n a rendu aucune valeur exploitable. Seules les
   * dimensions evaluees entrent dans le score global.
   */
  evaluated: boolean;
  /** Cause de non-evaluation. Absent quand evaluated vaut true. */
  evaluationCause?: DimensionEvaluationCause;
  /** Statut releve par l instrumentation pour le moteur de cette
   *  dimension, quand il est connu. Absent sur les runs anterieurs
   *  au recorder, ou la disponibilite est deduite des racines. */
  engineStatus?: string;
  /**
   * True si la dimension n a pas pu etre evaluee faute de donnees
   * COTE DOSSIER (ex : modele economique sans business plan fourni).
   * Distinct de `evaluated: false` qui couvre aussi et surtout les
   * defauts de pipeline. Un dossier sans BP porte les deux drapeaux ;
   * un moteur tombe ne porte que `evaluated: false`.
   */
  notEvaluable?: boolean;
}

/**
 * Assiette du calcul. Declare sur quoi le score a ete calcule, ce qui
 * en a ete exclu et pourquoi. Rendu tel quel dans la note : un score
 * qui ne dit pas sa base est un score qui ment par omission.
 */
export interface ScoreBasis {
  /** Nombre de dimensions reellement evaluees. */
  evaluatedCount: number;
  /** Nombre total de dimensions du modele. Six. */
  totalCount: number;
  /** Somme des poids des dimensions evaluees, sur 1.0. */
  evaluatedWeight: number;
  /** Cles des dimensions evaluees. */
  evaluated: DimensionKey[];
  /** Dimensions exclues du calcul, avec leur cause et le statut releve. */
  notEvaluated: Array<{
    dimension: DimensionKey;
    label: string;
    cause: DimensionEvaluationCause;
    engineStatus?: string;
  }>;
  /** Seuil de poids cumule en dessous duquel aucun score n est produit. */
  minimumWeight: number;
  /** True si le socle autorise la production d un score global. */
  sufficient: boolean;
  /** Phrase declarative prete a afficher. */
  label: string;
}

export type MechanicalScoreStatus = 'computed' | 'insufficient-basis';

export interface MechanicalScoreResult {
  /** Score global sur 100, calcule sur les seules dimensions evaluees.
   *  Null quand le socle est insuffisant : c est un etat terminal, pas
   *  une invitation a redemander le score au modele. */
  globalScore: number | null;
  /** Verdict derive deterministe via les seuils. Null quand le socle
   *  est insuffisant : sans score il n y a pas de verdict a deriver. */
  verdict: Verdict | null;
  /** Etat du calcul. 'insufficient-basis' est le troisieme etat : ni
   *  un nombre, ni un retour au LLM. */
  scoreStatus: MechanicalScoreStatus;
  /** Assiette du calcul, declaree. */
  basis: ScoreBasis;
  /** Archetype economique du dossier (issu de financial-coherence,
   *  passe au score-calculator pour transparence des rationales et
   *  adaptation du seuil de divergence affiche dans l UI). N affecte
   *  PAS le calcul du score lui-meme (ponderations strictement
   *  identiques peu importe l archetype). */
  archetype?: FinancialCoherenceArchetype;
  /** Seuil de divergence applicable a ce dossier, en points (15 / 20 /
   *  25). Lu par l UI pour adapter le bandeau d alerte rouge a la
   *  couverture des tests applicables de l archetype. */
  divergenceThreshold: number;
  /** Detail du calcul par dimension, expose dans l UI pour auditabilite. */
  dimensions: Record<DimensionKey, DimensionBreakdown>;
  /** Formule lisible exposee a l UI, base incluse. */
  formula: string;
  /** Seuils de verdict utilises, pour affichage et auditabilite. */
  thresholds: typeof VERDICT_THRESHOLDS;
}

// ============================================================
// GARDES D EVALUATION
// ============================================================

/** Valeur numerique reellement produite, ou null. Un 50 rendu par un
 *  moteur est une vraie valeur et le reste : c est le 50 injecte par
 *  un repli qui est un fantome, pas le 50 median d un verdict. */
function realScore(v: any): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null;
}

/** Presence d une racine moteur exploitable. Meme regle que
 *  computeEngineAvailability (lib/engines/orchestrator.ts) : un objet
 *  vide compte comme absent, un moteur qui a repondu sans aucun champ
 *  n a rien instruit. */
function hasEngineRoot(root: any): boolean {
  return !!root && typeof root === 'object' && Object.keys(root).length > 0;
}

interface Gate {
  ok: boolean;
  cause?: DimensionEvaluationCause;
  engineStatus?: string;
}

/**
 * Premiere garde : le moteur de cette dimension a-t-il abouti.
 *
 * Le releve d instrumentation prime quand il porte un statut pour ce
 * moteur. A defaut, sur les dossiers persistes avant le recorder, on
 * recalcule la disponibilite sur la racine, comme le fait
 * computeEngineAvailability, pour que le fix vaille aussi sur eux.
 *
 * Note de sequencement : au point d appel du pipeline
 * (app/api/analyze/route.ts), le recorder ne porte encore que les
 * statuts poses par le wrapper deadline (ok, failed, failed-upstream,
 * timeout). empty_output et skipped_not_applicable ne sont poses qu a
 * la finalisation, apres l orchestration. Les gardes sur la racine
 * ci-dessous couvrent ces deux cas en propre, la table de statuts les
 * traite quand elle les porte deja.
 */
function engineGate(
  dimension: DimensionKey,
  root: any,
  statuses: EngineStatusMap | null | undefined,
): Gate {
  const engineKey = DIMENSION_ENGINE_KEYS[dimension];
  const engineStatus = statuses?.[engineKey]?.status;
  const mapped = engineStatus ? STATUS_TO_CAUSE[engineStatus] : undefined;
  if (mapped) return { ok: false, cause: mapped, engineStatus };
  if (isSkipped(root)) return { ok: false, cause: 'moteur-skipped', engineStatus };
  if (!hasEngineRoot(root)) return { ok: false, cause: 'moteur-absent', engineStatus };
  return { ok: true, engineStatus };
}

/** Rationale d une dimension non evaluee. Ne dit jamais qu une valeur
 *  a ete produite par le moteur : elle ne l a pas ete. */
function buildUnevaluatedRationale(
  dimension: DimensionKey,
  cause: DimensionEvaluationCause,
  engineStatus: string | undefined,
): string {
  const weightPct = Math.round(DIMENSION_WEIGHTS[dimension] * 100);
  const statusFragment = engineStatus ? ` Statut releve pour le moteur : ${engineStatus}.` : '';
  return `${DIMENSION_LABELS[dimension]} non evaluee sur ce run : ${CAUSE_LABELS[cause]}.${statusFragment} `
    + `Aucun score n est attribue a cette dimension et son poids de ${weightPct} % est retire de l assiette du score global, `
    + `qui est renormalise sur les dimensions restantes.`;
}

// ============================================================
// COMPOSITES EQUIPE ET MARCHE
// ============================================================

interface CompositeParts {
  name: string;
  raw: any;
  weight: number;
}

interface CompositeResult {
  score: number;
  subScores: Array<{ name: string; score: number; weight: number }>;
  /** Noms des sous-scores absents, pour que le rationale les nomme. */
  missing: string[];
  /** Somme des poids des sous-scores reellement produits. */
  coveredWeight: number;
}

/**
 * Aggrege les sous-scores reellement produits et renormalise sur leurs
 * poids. La doctrine du niveau superieur appliquee un etage plus bas :
 * un sous-module muet ne devient pas un 50 neutre qui dilue les autres,
 * il sort de l assiette. Retourne null si aucun sous-score n existe,
 * cas ou la dimension entiere bascule en non evaluee.
 */
function computeComposite(parts: CompositeParts[]): CompositeResult | null {
  const resolved = parts.map(p => ({ ...p, score: realScore(p.raw) }));
  const present = resolved.filter(p => p.score !== null);
  if (present.length === 0) return null;
  const coveredWeight = present.reduce((s, p) => s + p.weight, 0);
  const weighted = present.reduce((s, p) => s + (p.score as number) * p.weight, 0);
  return {
    score: Math.round(weighted / coveredWeight),
    subScores: present.map(p => ({ name: p.name, score: p.score as number, weight: p.weight })),
    missing: resolved.filter(p => p.score === null).map(p => p.name),
    coveredWeight,
  };
}

/**
 * Composite Equipe a partir des quatre sous-scores du moteur
 * team-engine. Pondere : couverture systemique 0.30 (la plus
 * discriminante), anti-fragilite collective 0.25 (capacite a traverser
 * les crises), transposition d experience 0.25 (founder-market fit
 * applique), obsession produit 0.20 (intensite founder).
 */
function computeTeamComposite(team: TeamAnalysisOutput | null | undefined): CompositeResult | null {
  return computeComposite([
    { name: 'Couverture systemique', raw: (team as any)?.systemicCoverage?.score, weight: 0.30 },
    { name: 'Anti-fragilite collective', raw: (team as any)?.collectiveAntiFragility?.score, weight: 0.25 },
    { name: 'Transposition d experience', raw: (team as any)?.experienceTransposition?.score, weight: 0.25 },
    { name: 'Obsession produit', raw: (team as any)?.founderObsession?.score, weight: 0.20 },
  ]);
}

/**
 * Composite Marche a partir des trois sous-scores du moteur
 * market-engine. Pondere : intensite besoin 0.45 (le pain point est
 * central), defensibilite 0.35 (les moats determinent la durabilite),
 * signaux organiques 0.20 (proxy de traction bottom-up).
 */
function computeMarketComposite(market: MarketAnalysisOutput | null | undefined): CompositeResult | null {
  return computeComposite([
    { name: 'Intensite du besoin', raw: (market as any)?.needIntensity?.score, weight: 0.45 },
    { name: 'Defensibilite', raw: (market as any)?.defensibility?.score, weight: 0.35 },
    { name: 'Signaux organiques', raw: (market as any)?.organicSignals?.score, weight: 0.20 },
  ]);
}

/** Prose du composite, qui declare sa propre couverture quand elle
 *  est partielle. */
function buildCompositeRationale(
  intro: string,
  composite: CompositeResult,
): string {
  const detail = composite.subScores.map(s => `${s.name.toLowerCase()} ${s.score}`).join(', ');
  if (composite.missing.length === 0) {
    return `${intro} : ${detail}.`;
  }
  const missingLabel = composite.missing.map(m => m.toLowerCase()).join(', ');
  return `${intro} : ${detail}. Sous-scores absents de la sortie du moteur et retires de l assiette du composite : ${missingLabel}. `
    + `Le composite est renormalise sur ${Math.round(composite.coveredWeight * 100)} % de sa ponderation nominale.`;
}

/**
 * Derive le verdict du score selon les seuils stricts.
 */
export function deriveVerdict(score: number): Verdict {
  if (score >= VERDICT_THRESHOLDS.invest) return 'investir';
  if (score >= VERDICT_THRESHOLDS.conditions) return 'investir avec conditions';
  if (score >= VERDICT_THRESHOLDS.investigate) return 'approfondir';
  return 'refuser';
}

// ============================================================
// ASSEMBLAGE D UNE DIMENSION
// ============================================================

/** Valeur neutre historique portee par `score` quand la dimension n est
 *  pas evaluee. Elle n entre dans aucun calcul, elle ne survit que pour
 *  ne pas casser les consommateurs qui lisent le champ sans consulter
 *  `evaluated`. Tout nouveau consommateur doit lire `evaluated`. */
const NEUTRAL_PLACEHOLDER = 50;

function unevaluatedDimension(
  dimension: DimensionKey,
  cause: DimensionEvaluationCause,
  engineStatus: string | undefined,
  extra?: Partial<DimensionBreakdown>,
): DimensionBreakdown {
  const breakdown: DimensionBreakdown = {
    score: NEUTRAL_PLACEHOLDER,
    weight: DIMENSION_WEIGHTS[dimension],
    contribution: 0,
    rationale: buildUnevaluatedRationale(dimension, cause, engineStatus),
    evaluated: false,
    evaluationCause: cause,
    ...extra,
  };
  if (engineStatus) breakdown.engineStatus = engineStatus;
  return breakdown;
}

function evaluatedDimension(
  dimension: DimensionKey,
  score: number,
  rationale: string,
  engineStatus: string | undefined,
  subScores?: Array<{ name: string; score: number; weight: number }>,
): DimensionBreakdown {
  const weight = DIMENSION_WEIGHTS[dimension];
  const breakdown: DimensionBreakdown = {
    score,
    weight,
    contribution: Math.round(score * weight * 100) / 100,
    rationale,
    evaluated: true,
  };
  if (subScores) breakdown.subScores = subScores;
  if (engineStatus) breakdown.engineStatus = engineStatus;
  return breakdown;
}

/**
 * Fonction principale : calcule le score mecanique a partir des sorties
 * des moteurs Bloc 1 et du releve d instrumentation du run. Retourne un
 * MechanicalScoreResult complet expose tel quel a l UI pour auditabilite.
 */
export function computeMechanicalScore(input: {
  team: TeamAnalysisOutput | null | undefined;
  market: MarketAnalysisOutput | null | undefined;
  macro: MacroAnalysisOutput | null | undefined;
  financial: FinancialCoherenceOutput | null | undefined;
  contrarian: ContrarianAnalysisOutput | null | undefined;
  blindspot: BlindspotAnalysisOutput | null | undefined;
  /** Releve per-moteur du run (EngineStatusRecorder.snapshot()). Absent
   *  sur les runs anterieurs a l instrumentation : la disponibilite est
   *  alors recalculee sur les racines. */
  engineStatuses?: EngineStatusMap | null;
}): MechanicalScoreResult {
  const statuses = input.engineStatuses ?? null;

  // ---------- Equipe ----------
  const teamGate = engineGate('team', input.team, statuses);
  const teamComposite = teamGate.ok ? computeTeamComposite(input.team) : null;
  const teamDim = !teamGate.ok
    ? unevaluatedDimension('team', teamGate.cause!, teamGate.engineStatus)
    : teamComposite === null
      ? unevaluatedDimension('team', 'sous-champs-absents', teamGate.engineStatus)
      : evaluatedDimension(
          'team',
          teamComposite.score,
          buildCompositeRationale('Composite des sous-scores de l equipe', teamComposite),
          teamGate.engineStatus,
          teamComposite.subScores,
        );

  // ---------- Marche ----------
  const marketGate = engineGate('market', input.market, statuses);
  const marketComposite = marketGate.ok ? computeMarketComposite(input.market) : null;
  const marketDim = !marketGate.ok
    ? unevaluatedDimension('market', marketGate.cause!, marketGate.engineStatus)
    : marketComposite === null
      ? unevaluatedDimension('market', 'sous-champs-absents', marketGate.engineStatus)
      : evaluatedDimension(
          'market',
          marketComposite.score,
          buildCompositeRationale('Composite des sous-scores du marche', marketComposite),
          marketGate.engineStatus,
          marketComposite.subScores,
        );

  // ---------- Macro ----------
  const macroGate = engineGate('macro', input.macro, statuses);
  const macroRaw = macroGate.ok
    ? realScore((input.macro as any)?.contraryclicalOpportunity?.score)
    : null;
  const macroDim = !macroGate.ok
    ? unevaluatedDimension('macro', macroGate.cause!, macroGate.engineStatus)
    : macroRaw === null
      ? unevaluatedDimension('macro', 'sous-champs-absents', macroGate.engineStatus)
      : evaluatedDimension(
          'macro',
          macroRaw,
          `Score d opportunite contracyclique ${macroRaw} produit par le moteur macro a partir du regime de taux, de la geopolitique et de la capitalisation VC sur le segment.`,
          macroGate.engineStatus,
        );

  // ---------- Modele economique ----------
  // Deux causes de non-evaluation a ne surtout pas confondre. Si le
  // moteur Coherence financiere est tombe, la lacune est celle du
  // pipeline et le rationale ne doit pas accuser le dossier de ne pas
  // avoir fourni de business plan. Si le moteur a bien tourne mais que
  // le dossier ne porte aucun BP exploitable (hasFinancialData=false,
  // dataSource='none', ou globalCoherenceScore a 0), alors la lacune
  // est bien cote dossier et notEvaluable la nomme.
  //
  // Dans les deux cas la dimension sort de l assiette. Le neutre 50
  // pondere qui existait avant ne penalisait pas le dossier mais il
  // diluait les cinq autres dimensions d un treizieme de rien.
  const financialGate = engineGate('financial', input.financial, statuses);
  const financialScore = financialGate.ok
    ? realScore((input.financial as any)?.globalCoherenceScore)
    : null;
  const financialHasDossierData = !!(
    input.financial
    && (input.financial as any).hasFinancialData !== false
    && (input.financial as any).dataSource !== 'none'
    && (financialScore ?? 0) > 0
  );
  const financialDim = !financialGate.ok
    ? unevaluatedDimension('financial', financialGate.cause!, financialGate.engineStatus)
    : !financialHasDossierData
      ? unevaluatedDimension(
          'financial',
          'donnees-dossier-absentes',
          financialGate.engineStatus,
          {
            notEvaluable: true,
            rationale: `Modele economique non evaluable : le moteur Coherence financiere a tourne mais aucun business plan exploitable n a ete fourni avec ce dossier (dataSource='${(input.financial as any)?.dataSource ?? 'none'}'). `
              + `La lacune est celle du dossier, pas du pipeline. La dimension sort de l assiette du score global, son poids de 13 % est retire et le score est renormalise sur les dimensions restantes. `
              + `Demander le business plan au fondateur avant decision finale.`,
          },
        )
      : evaluatedDimension(
          'financial',
          financialScore as number,
          buildFinancialRationale(financialScore as number, input.financial),
          financialGate.engineStatus,
        );

  // ---------- Singularites contrariennes ----------
  const contrarianGate = engineGate('contrarian', input.contrarian, statuses);
  const contrarianRaw = contrarianGate.ok
    ? realScore((input.contrarian as any)?.globalContrarianScore)
    : null;
  const contrarianDim = !contrarianGate.ok
    ? unevaluatedDimension('contrarian', contrarianGate.cause!, contrarianGate.engineStatus)
    : contrarianRaw === null
      ? unevaluatedDimension('contrarian', 'sous-champs-absents', contrarianGate.engineStatus)
      : evaluatedDimension(
          'contrarian',
          contrarianRaw,
          `Score contrarien ${contrarianRaw} produit par le moteur Singularités contrariennes sur les dix signaux S1-S10.`,
          contrarianGate.engineStatus,
        );

  // ---------- Vigilance critique ----------
  // Vigilance est inversee : un fort score blindspot = beaucoup de patterns
  // critiques detectes = score de risque maitrise faible. On inverse pour
  // que le composite global soit dans le sens "plus c est haut, mieux c est".
  const vigilanceGate = engineGate('vigilance', input.blindspot, statuses);
  const vigilanceRaw = vigilanceGate.ok
    ? realScore((input.blindspot as any)?.globalBlindspotScore)
    : null;
  const vigilanceDim = !vigilanceGate.ok
    ? unevaluatedDimension('vigilance', vigilanceGate.cause!, vigilanceGate.engineStatus)
    : vigilanceRaw === null
      ? unevaluatedDimension('vigilance', 'sous-champs-absents', vigilanceGate.engineStatus)
      : evaluatedDimension(
          'vigilance',
          Math.max(0, Math.min(100, 100 - vigilanceRaw)),
          `Score de risque maitrise ${Math.max(0, Math.min(100, 100 - vigilanceRaw))} (inverse du globalBlindspotScore ${vigilanceRaw} produit par le moteur Vigilance critique sur les dix patterns P1-P10).`,
          vigilanceGate.engineStatus,
        );

  const dimensions: Record<DimensionKey, DimensionBreakdown> = {
    team: teamDim,
    market: marketDim,
    macro: macroDim,
    financial: financialDim,
    contrarian: contrarianDim,
    vigilance: vigilanceDim,
  };

  // ============================================================
  // RENORMALISATION SUR L ASSIETTE EVALUEE
  // ============================================================
  const evaluatedKeys = DIMENSION_KEYS.filter(k => dimensions[k].evaluated);
  const notEvaluated = DIMENSION_KEYS
    .filter(k => !dimensions[k].evaluated)
    .map(k => {
      const d = dimensions[k];
      const entry: ScoreBasis['notEvaluated'][number] = {
        dimension: k,
        label: DIMENSION_LABELS[k],
        cause: d.evaluationCause as DimensionEvaluationCause,
      };
      if (d.engineStatus) entry.engineStatus = d.engineStatus;
      return entry;
    });

  const evaluatedWeight = evaluatedKeys.reduce((s, k) => s + dimensions[k].weight, 0);
  const sufficient = evaluatedWeight + WEIGHT_EPSILON >= MINIMUM_EVALUATED_WEIGHT;

  const basis: ScoreBasis = {
    evaluatedCount: evaluatedKeys.length,
    totalCount: DIMENSION_KEYS.length,
    evaluatedWeight: Math.round(evaluatedWeight * 100) / 100,
    evaluated: evaluatedKeys.slice(),
    notEvaluated,
    minimumWeight: MINIMUM_EVALUATED_WEIGHT,
    sufficient,
    label: buildBasisLabel(evaluatedKeys.length, DIMENSION_KEYS.length, evaluatedWeight, notEvaluated, sufficient),
  };

  // Archetype passe au resultat pour transparence dans l UI (rationale
  // de la dimension Financial, adaptation du seuil de divergence visuel).
  // N affecte PAS le calcul du score lui-meme : les ponderations restent
  // strictement identiques peu importe l archetype, le score d un dossier
  // SaaS canonique reste exactement ce qu il etait.
  const archetype = (input.financial as any)?.archetype as FinancialCoherenceArchetype | undefined;
  const divergenceThreshold = archetype
    ? DIVERGENCE_THRESHOLDS_BY_ARCHETYPE[archetype]
    : DEFAULT_DIVERGENCE_THRESHOLD;

  if (!sufficient) {
    return {
      globalScore: null,
      verdict: null,
      scoreStatus: 'insufficient-basis',
      basis,
      archetype,
      divergenceThreshold,
      dimensions,
      formula: buildFormula(basis, null),
      thresholds: VERDICT_THRESHOLDS,
    };
  }

  const weightedSum = evaluatedKeys.reduce((s, k) => s + dimensions[k].score * dimensions[k].weight, 0);
  const globalScore = Math.max(0, Math.min(100, Math.round(weightedSum / evaluatedWeight)));
  const verdict = deriveVerdict(globalScore);

  return {
    globalScore,
    verdict,
    scoreStatus: 'computed',
    basis,
    archetype,
    divergenceThreshold,
    dimensions,
    formula: buildFormula(basis, globalScore),
    thresholds: VERDICT_THRESHOLDS,
  };
}

// ============================================================
// HELPERS - DECLARATION DE LA BASE
// ============================================================

function buildBasisLabel(
  evaluatedCount: number,
  totalCount: number,
  evaluatedWeight: number,
  notEvaluated: ScoreBasis['notEvaluated'],
  sufficient: boolean,
): string {
  const weightPct = Math.round(evaluatedWeight * 100);
  if (!sufficient) {
    const excluded = notEvaluated.map(n => `${n.label} (${CAUSE_LABELS[n.cause]})`).join(' ; ');
    return `Socle insuffisant : ${evaluatedCount} dimension${evaluatedCount > 1 ? 's' : ''} evaluee${evaluatedCount > 1 ? 's' : ''} sur ${totalCount}, `
      + `poids evalue cumule ${weightPct} % pour un minimum requis de ${Math.round(MINIMUM_EVALUATED_WEIGHT * 100)} %. `
      + `Aucun score global n est produit. Dimensions manquantes : ${excluded || 'aucune'}.`;
  }
  if (evaluatedCount === totalCount) {
    return `Calcule sur les ${totalCount} dimensions, poids evalue cumule 100 %.`;
  }
  const excluded = notEvaluated.map(n => `${n.label} (${CAUSE_LABELS[n.cause]})`).join(' ; ');
  return `Calcule sur ${evaluatedCount} dimensions sur ${totalCount}, poids evalue cumule ${weightPct} %, renormalise sur cette assiette. `
    + `Dimensions exclues : ${excluded}.`;
}

function buildFormula(basis: ScoreBasis, globalScore: number | null): string {
  const weightPct = Math.round(basis.evaluatedWeight * 100);
  if (globalScore === null) {
    return `Aucun score produit. ${basis.label} Les seuils de verdict (<45 refuser, 45-59 approfondir, 60-74 investir avec conditions, >=75 investir) ne sont pas applicables sans score.`;
  }
  if (basis.evaluatedCount === basis.totalCount) {
    return `score = 0.20 * Equipe + 0.22 * Marche + 0.15 * Macro + 0.13 * Modele economique + 0.15 * Contrariens + 0.15 * Vigilance (inversee). `
      + `Base : les six dimensions ont ete evaluees, poids cumule 100 %. `
      + `Verdict derive : <45 = refuser, 45-59 = approfondir, 60-74 = investir avec conditions, >=75 = investir.`;
  }
  const terms = basis.evaluated
    .map(k => `${DIMENSION_WEIGHTS[k].toFixed(2)} * ${DIMENSION_LABELS[k]}`)
    .join(' + ');
  return `score = (${terms}) / ${basis.evaluatedWeight.toFixed(2)}. `
    + `Base : ${basis.evaluatedCount} dimensions sur ${basis.totalCount}, poids evalue cumule ${weightPct} %, le calcul est renormalise sur cette assiette et non sur 1.00. `
    + `Verdict derive : <45 = refuser, 45-59 = approfondir, 60-74 = investir avec conditions, >=75 = investir.`;
}

// ============================================================
// HELPERS - RATIONALE EDITORIAL DE LA DIMENSION FINANCIAL
// ============================================================

const ARCHETYPE_SHORT_LABEL: Record<FinancialCoherenceArchetype, string> = {
  'A-saas-pur': 'SaaS pur',
  'B-hardware-deeptech': 'hardware ou deeptech',
  'C-marketplace': 'marketplace',
  'D-biotech-pre-approval': 'biotech pre-approbation',
  'E-b2g-defense': 'B2G ou defense',
  'F-consumer-dtc': 'consumer DTC',
  'unclassified': 'non classifie',
};

/**
 * Construit un rationale editorial pour la dimension Financial qui
 * dit la verite sur la couverture reelle des tests applicables.
 * Avant ce fix le texte mentionnait systematiquement "sept tests
 * structures T1-T7" meme quand l archetype en neutralisait certains
 * (cas hardware : T2 neutralise ; cas biotech : T1, T2, T5, T6
 * neutralises). Desormais le rationale enonce le nombre exact de
 * tests appliques et l archetype detecte, pour que le partner sache
 * sur quelle base le score a ete calcule.
 */
function buildFinancialRationale(
  score: number,
  financial: FinancialCoherenceOutput | null | undefined,
): string {
  if (!financial) {
    return `Score de coherence financiere ${score} aggrege sur les sept tests structures (T1-T7) du moteur Cohérence financière.`;
  }
  const archetype = financial.archetype;
  const applicable = financial.applicableTests;
  if (!archetype || !applicable || applicable.length === 0) {
    // Compatibilite ascendante : si l output Coherence ne porte pas
    // encore archetype / applicableTests (analyses anterieures au
    // commit 5184213), on retombe sur le texte historique pour ne
    // pas casser l affichage des dossiers deja persistes.
    return `Score de coherence financiere ${score} aggrege sur les sept tests structures (T1-T7) du moteur Cohérence financière.`;
  }
  const total = 7;
  const n = applicable.length;
  const neutralized: string[] = [];
  for (const t of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']) {
    if (!applicable.includes(t)) neutralized.push(t);
  }
  const label = ARCHETYPE_SHORT_LABEL[archetype];
  if (n === total) {
    return `Score de coherence financiere ${score} aggrege sur les sept tests structures (T1-T7) du moteur Cohérence financière. Archetype detecte : ${label}, tous les tests applicables.`;
  }
  const neutralizedLabel = neutralized.length === 1
    ? `${neutralized[0]} neutralise`
    : `${neutralized.join(', ')} neutralises`;
  return `Score de coherence financiere ${score} calcule sur ${n} tests applicables (sur ${total} doctrinaux) du moteur Cohérence financière. Archetype detecte : ${label}, ${neutralizedLabel} cote code car non pertinent pour ce modele economique.`;
}
