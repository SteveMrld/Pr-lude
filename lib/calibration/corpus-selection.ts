// ============================================================
// CORPUS SELECTION - regle deterministe anti biais du selectionneur
// ------------------------------------------------------------
// Pilier preuve, brique reconciliation et calibration.
//
// Historique. Le corpus de calibration etait constitue au fil de
// l eau par saisie manuelle : chaque batch decidait au cas par cas
// quels dossiers entraient dans le calcul discriminant. Cette
// pratique laisse une porte ouverte au biais du selectionneur, celui
// qui choisit les dossiers a inclure peut, consciemment ou non,
// pousser la calibration dans la direction qui l arrange. Un
// examinateur externe ne peut pas prouver que la selection est
// honnete tant qu elle depend de la main humaine.
//
// La regle est objectivee ici. Elle prend en entree l ensemble des
// candidats en base et retourne, pour chacun, une decision motivee
// d inclusion ou d exclusion. Aucun parametre par dossier n existe
// dans la signature : impossible d ecarter un cas nommement. Le seul
// levier disponible est le critere lui meme, et changer le critere
// change la calibration de tout le corpus d un bloc, pas ligne par
// ligne. C est la garantie anti audit.
//
// Ce module est pur, sans I/O. Il ne lit pas Supabase, il ne connait
// pas les noms de societes. Le nom d entreprise transporte dans la
// decision est purement informatif pour l affichage d audit, il n a
// aucun poids dans la decision qui repose exclusivement sur l etat
// resolu et le niveau de fiabilite.
// ============================================================

import {
  type MarketOutcome,
  isResolvedOutcome,
} from '../analysis-outcomes-taxonomy';

// ============================================================
// Niveau de fiabilite structure
// ------------------------------------------------------------
// Trois niveaux volontairement discrets pour eviter le halo de la
// fiabilite en continu. haute = temoignage direct ou source primaire
// verifiable. bonne = source publique fiable (registres, presse
// serieuse, comptes deposes) sans confirmation par le porteur.
// moyenne = proxy d etat, inference plausible mais non confirmee
// par la source qui detient l information.
//
// Les niveaux sont ordonnes : passer de moyenne a bonne exige un
// upgrade de source, pas une reappreciation subjective.
// ============================================================

export type Reliability = 'haute' | 'bonne' | 'moyenne';

export const RELIABILITY_VALUES: readonly Reliability[] = ['haute', 'bonne', 'moyenne'] as const;

export function isReliability(x: unknown): x is Reliability {
  return typeof x === 'string' && (RELIABILITY_VALUES as readonly string[]).includes(x);
}

// ============================================================
// Types de decision
// ============================================================

export interface SelectionCandidate {
  /** Identifiant du dossier, uniquement pour tracer l audit. Aucun
   *  effet sur la decision. */
  analysisId: string;
  /** Nom de societe, purement decoratif dans la sortie d audit. */
  companyName: string | null;
  /** Etat resolu ou non selon la taxonomie. */
  marketOutcome: MarketOutcome;
  /** Niveau de fiabilite structure. null si non renseigne. */
  reliability: Reliability | null;
}

export type ExclusionReason =
  | 'unresolved-outcome'
  | 'reliability-below-threshold'
  | 'reliability-missing';

export interface SelectionDecision {
  analysisId: string;
  companyName: string | null;
  marketOutcome: MarketOutcome;
  reliability: Reliability | null;
  included: boolean;
  exclusionReason: ExclusionReason | null;
}

export interface SelectionAudit {
  decisions: SelectionDecision[];
  includedCount: number;
  excludedCount: number;
  countsByExclusion: Record<ExclusionReason, number>;
}

// ============================================================
// Seuil de fiabilite retenu comme discriminant
// ------------------------------------------------------------
// haute et bonne entrent, moyenne reste en base et visible mais
// n alimente pas le calcul. Le seuil est expose comme constante
// pour que la doctrine soit lisible dans une revue de code. Le
// baisser reviendrait a admettre des proxys dans le discriminant,
// decision qui doit se prendre explicitement, pas par derive.
// ============================================================

export const DISCRIMINANT_RELIABILITY_SET: readonly Reliability[] = ['haute', 'bonne'] as const;

function passesReliability(r: Reliability | null): { pass: true } | { pass: false; reason: ExclusionReason } {
  if (r === null) return { pass: false, reason: 'reliability-missing' };
  if (!(DISCRIMINANT_RELIABILITY_SET as readonly string[]).includes(r)) {
    return { pass: false, reason: 'reliability-below-threshold' };
  }
  return { pass: true };
}

// ============================================================
// REGLE PRINCIPALE
// ------------------------------------------------------------
// Fonction pure, une seule entree, une seule sortie. La signature
// (candidates) est le SEUL levier. Toute tentative future d ajouter
// un parametre du type excludeIds, whitelist, forceInclude, etc,
// contredirait la doctrine anti biais et doit etre refusee en revue.
//
// Contrat verifie par le test de garde correspondant :
//   applyCorpusSelectionRule.length === 1
// ============================================================

export function applyCorpusSelectionRule(candidates: SelectionCandidate[]): SelectionAudit {
  const decisions: SelectionDecision[] = candidates.map((c): SelectionDecision => {
    if (!isResolvedOutcome(c.marketOutcome)) {
      return {
        analysisId: c.analysisId,
        companyName: c.companyName,
        marketOutcome: c.marketOutcome,
        reliability: c.reliability,
        included: false,
        exclusionReason: 'unresolved-outcome',
      };
    }
    const r = passesReliability(c.reliability);
    if (r.pass === false) {
      return {
        analysisId: c.analysisId,
        companyName: c.companyName,
        marketOutcome: c.marketOutcome,
        reliability: c.reliability,
        included: false,
        exclusionReason: r.reason,
      };
    }
    return {
      analysisId: c.analysisId,
      companyName: c.companyName,
      marketOutcome: c.marketOutcome,
      reliability: c.reliability,
      included: true,
      exclusionReason: null,
    };
  });

  const countsByExclusion: Record<ExclusionReason, number> = {
    'unresolved-outcome': 0,
    'reliability-below-threshold': 0,
    'reliability-missing': 0,
  };
  let includedCount = 0;
  for (const d of decisions) {
    if (d.included) includedCount++;
    else if (d.exclusionReason) countsByExclusion[d.exclusionReason]++;
  }

  return {
    decisions,
    includedCount,
    excludedCount: decisions.length - includedCount,
    countsByExclusion,
  };
}

// ============================================================
// HELPER FUTUR - inference de fiabilite depuis notes texte libre
// ------------------------------------------------------------
// A utiliser dans le script de retro remplissage propose dans
// docs/corpus-selection-rule.md. N est appele nulle part en
// production a ce stade : la calibration n applique pas encore la
// regle au corpus reel, cette bascule est un brick separe.
//
// La regle d inference est intentionnellement conservatrice : en
// cas d ambiguite ou d absence de mot cle, on retourne null pour
// forcer une saisie explicite plutot que d imputer un niveau qui
// biaiserait le discriminant.
// ============================================================

export function parseReliabilityFromNotes(notes: string | null): Reliability | null {
  if (!notes) return null;
  const lower = notes.toLowerCase();
  const m = lower.match(/fiabilit[eé]\s*(haute|bonne|moyenne)/);
  if (m) return m[1] as Reliability;
  return null;
}

// ============================================================
// Rendu texte de l audit, format prevu pour la console et pour
// l export en salle de due diligence. Reste dans le module pour
// que la representation d audit soit versionnee avec la regle
// elle meme.
// ============================================================

export function renderAuditPlain(audit: SelectionAudit): string {
  const lines: string[] = [];
  lines.push(`Corpus : ${audit.decisions.length} candidats, ${audit.includedCount} inclus, ${audit.excludedCount} exclus`);
  lines.push(`Exclusions par motif : unresolved=${audit.countsByExclusion['unresolved-outcome']}, reliability-below=${audit.countsByExclusion['reliability-below-threshold']}, reliability-missing=${audit.countsByExclusion['reliability-missing']}`);
  lines.push('');
  lines.push('id                                    | dossier                 | outcome         | fiabilite | inclus | motif');
  lines.push('-'.repeat(140));
  const sorted = [...audit.decisions].sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1;
    return (a.companyName || '').localeCompare(b.companyName || '');
  });
  for (const d of sorted) {
    const idCol = d.analysisId.padEnd(37);
    const name = (d.companyName || '(?)').padEnd(23);
    const outcome = d.marketOutcome.padEnd(15);
    const rel = (d.reliability || '(null)').padEnd(9);
    const inc = d.included ? 'OUI   ' : 'NON   ';
    const motif = d.exclusionReason || '';
    lines.push(`${idCol} | ${name} | ${outcome} | ${rel} | ${inc} | ${motif}`);
  }
  return lines.join('\n');
}
