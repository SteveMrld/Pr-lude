// ============================================================
// ENGINE STATUS RECORDER
// ------------------------------------------------------------
// Instrumentation observationnelle de l orchestrateur. Enregistre
// pour chaque moteur du pipeline son statut, sa duree, son nombre
// de tentatives et le message d erreur brut si echec. Persiste
// l ensemble dans analyses.pipeline_engines_status (JSONB) et
// permet a l orchestrateur de calculer un statut de run qui
// reflete fidelement les lacunes.
//
// Cette brique OBSERVE, elle ne corrige rien. Aucun contenu de
// moteur n est modifie, aucun score, aucun seuil, aucun prompt.
// Elle rend visible ce qui etait silencieux.
//
// Cinq statuts distincts :
//   ok                        moteur a produit un sortant recevable
//   failed                    moteur a rejette (exception ou throw)
//   timeout                   moteur n a pas repondu dans le deadline
//   skipped_not_applicable    matrice de pertinence a ecarte le moteur
//                             (comportement voulu, jamais un defaut)
//   empty_output              moteur a repondu sans lever d erreur
//                             mais son sortant est null, vide, ou
//                             sans le champ minimum attendu
//
// La distinction ok / empty_output est centrale. Le cas TOLSON
// (marche, narrative-drift, fragilite structurelle, decisionDrivers
// vide) est precisement un empty_output silencieux qui a passe
// pour ok dans l ancien systeme.
// ============================================================

export type EngineStatus =
  | 'ok'
  | 'failed'
  | 'timeout'
  | 'skipped_not_applicable'
  | 'empty_output';

/** Statuts consideres comme lacune (gap) qui empechent un run
 *  de sortir en completed nu. skipped_not_applicable n en fait
 *  pas partie : c est un choix doctrinal, pas un defaut. */
export const GAP_STATUSES: readonly EngineStatus[] = ['failed', 'timeout', 'empty_output'] as const;

export interface EngineStatusEntry {
  engine: string;
  status: EngineStatus;
  /** Duree observee entre le start et l end du moteur, en ms. */
  durationMs: number;
  /** Nombre de tentatives. 1 par defaut, superieur si retry. */
  attempts: number;
  /** Message d erreur brut si status failed ou timeout, sinon undefined. */
  errorMessage?: string;
}

// ============================================================
// Contrats minimaux par moteur
// ------------------------------------------------------------
// Chaque moteur du Bloc 1 a une definition de "sortant minimal
// recevable". Sous ce contrat, le sortant est marque empty_output.
// Contrats volontairement laxistes : un seul champ suffit, on ne
// juge pas la qualite du contenu, seulement sa presence.
//
// La table est incomplete pour laisser une porte : un moteur non
// liste tombe sur le contrat generique (non-null, non-vide).
// Ajouter un moteur ici resserre la garde, ne le pas laisse la
// garde generique.
// ============================================================

type ContractCheck = (value: any) => boolean;

function hasArrayLen(v: any, key: string): boolean {
  return !!(v && Array.isArray(v[key]) && v[key].length > 0);
}

function hasStringField(v: any, key: string): boolean {
  return !!(v && typeof v[key] === 'string' && v[key].length > 0);
}

function hasAny(v: any, keys: string[]): boolean {
  return !!(v && keys.some(k => v[k] !== undefined && v[k] !== null && v[k] !== ''));
}

export const MINIMAL_CONTRACTS: Record<string, ContractCheck> = {
  extraction: v => hasStringField(v, 'companyName'),
  team: v => hasAny(v, ['foundersCount', 'founderMarketFit', 'systemicCoverage']),
  market: v => hasAny(v, ['perceivedSize', 'needIntensity', 'defensibility', 'realIntensity', 'saturation']),
  macro: v => hasAny(v, ['cyclePosition', 'demandCycle', 'trends', 'regulatory']),
  financialData: v => hasArrayLen(v, 'revenueProjection') || hasArrayLen(v, 'ebitdaProjection'),
  blindspotAnalysis: v => !!(v && v.patterns && typeof v.patterns === 'object' && Object.keys(v.patterns).length > 0),
  contrarianAnalysis: v => !!(v && v.signals && typeof v.signals === 'object' && Object.keys(v.signals).length > 0),
  financialCoherence: v => hasArrayLen(v, 'tests') || hasAny(v, ['globalCoherenceScore', 'archetype']),
  techClaimCoherence: v => !!(v && (v.triggers || v.tests)),
  executionFriction: v => !!(v && (v.axes || v.overallScore !== undefined)),
  narrativeDrift: v => hasAny(v, ['verdict', 'drift', 'kpiExtinction', 'opacity']),
  fragiliteStructurelle: v => hasArrayLen(v, 'patterns') || hasAny(v, ['overallScore', 'combinations']),
  patternMatching: v => hasArrayLen(v, 'comparables') || hasAny(v, ['averageScore', 'insights']),
  causalReversal: v => !!(v && (v.blindspotsScores || v.reversalNarrative)),
  referenceChecks: v => !!(v && (Array.isArray(v.founderChecks) || Array.isArray(v.customerChecks))),
  finalRecommendation: v => hasStringField(v, 'verdict') && hasArrayLen(v, 'decisionDrivers'),
  indicators: v => hasArrayLen(v, 'indicators'),
  valuation: v => !!(v && (v.centralValue !== undefined || v.methods)),
  preScan: v => hasStringField(v, 'recommendation') || hasStringField(v, 'summary'),
  saasMetrics: v => !!(v && (v.ndr !== undefined || v.magicNumber !== undefined)),
  industrialMetrics: v => !!(v && (v.indicators || v.__skipped)),
};

/** Contrat generique : non-null, non-primitif vide, non-objet vide. */
function passesGenericMinimalContract(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

/** Retourne true si le sortant du moteur satisfait le contrat minimal. */
export function passesMinimalContract(engine: string, value: any): boolean {
  const contract = MINIMAL_CONTRACTS[engine];
  if (contract) return contract(value);
  return passesGenericMinimalContract(value);
}

/** Detecte le marqueur skipped_not_applicable de la matrice de
 *  pertinence. Convention : le moteur retourne un objet avec
 *  __skipped: true (voir lib/engines/skipped-outputs.ts). */
export function isSkippedByRelevanceMatrix(value: any): boolean {
  return !!(value && typeof value === 'object' && value.__skipped === true);
}

// ============================================================
// Recorder
// ============================================================

export class EngineStatusRecorder {
  private entries: Map<string, EngineStatusEntry> = new Map();
  private startTimes: Map<string, number> = new Map();

  /** Enregistre le debut d execution d un moteur. */
  markStart(engine: string): void {
    this.startTimes.set(engine, Date.now());
  }

  /** Enregistre le resultat d un moteur avec calcul automatique
   *  de la duree si markStart a ete appelle en amont. */
  record(entry: Omit<EngineStatusEntry, 'durationMs'> & { durationMs?: number }): void {
    let durationMs = entry.durationMs;
    if (durationMs === undefined) {
      const start = this.startTimes.get(entry.engine);
      durationMs = start ? Date.now() - start : 0;
    }
    this.entries.set(entry.engine, {
      engine: entry.engine,
      status: entry.status,
      durationMs,
      attempts: entry.attempts,
      ...(entry.errorMessage !== undefined ? { errorMessage: entry.errorMessage } : {}),
    });
  }

  /** Inspecte un result_json final et complete les entrees manquantes
   *  ou marquees ok en verifiant le contrat minimal de chaque moteur.
   *  Un moteur deja marque failed ou timeout garde son statut. Un
   *  moteur non present est enregistre comme empty_output si son
   *  slot dans result_json ne satisfait pas le contrat. */
  finalizeFromResult(result: Record<string, any>, engineToResultKey: Record<string, string>): void {
    for (const [engine, resultKey] of Object.entries(engineToResultKey)) {
      const existing = this.entries.get(engine);
      // Ne pas ecraser un failed / timeout deja enregistre.
      if (existing && (existing.status === 'failed' || existing.status === 'timeout')) continue;
      const value = result[resultKey];
      if (isSkippedByRelevanceMatrix(value)) {
        this.entries.set(engine, {
          engine,
          status: 'skipped_not_applicable',
          durationMs: existing?.durationMs ?? 0,
          attempts: existing?.attempts ?? 1,
        });
        continue;
      }
      if (passesMinimalContract(engine, value)) {
        this.entries.set(engine, {
          engine,
          status: 'ok',
          durationMs: existing?.durationMs ?? 0,
          attempts: existing?.attempts ?? 1,
        });
      } else {
        this.entries.set(engine, {
          engine,
          status: 'empty_output',
          durationMs: existing?.durationMs ?? 0,
          attempts: existing?.attempts ?? 1,
        });
      }
    }
  }

  /** Snapshot immuable des entrees, format persistance JSONB. */
  snapshot(): Record<string, EngineStatusEntry> {
    const out: Record<string, EngineStatusEntry> = {};
    this.entries.forEach((v, k) => { out[k] = { ...v }; });
    return out;
  }

  /** Liste plate des entrees. */
  entries_(): EngineStatusEntry[] {
    return Array.from(this.entries.values());
  }

  /** Retourne la liste des moteurs en lacune (failed, timeout ou empty_output). */
  gaps(): EngineStatusEntry[] {
    return this.entries_().filter(e => (GAP_STATUSES as readonly string[]).includes(e.status));
  }

  /** Statut de run derive : completed si aucune lacune, sinon
   *  completed_with_gaps. Reserve failed_terminal pour le futur
   *  (deadline global exhausted, plusieurs moteurs critiques
   *  simultanes). */
  computeRunStatus(): 'completed' | 'completed_with_gaps' {
    return this.gaps().length > 0 ? 'completed_with_gaps' : 'completed';
  }

  /** Message d erreur consolide, liste les moteurs defaillants par
   *  statut. Retourne null si aucune lacune. */
  computeErrorMessage(): string | null {
    const gaps = this.gaps();
    if (gaps.length === 0) return null;
    const byStatus: Record<string, string[]> = {};
    for (const g of gaps) {
      if (!byStatus[g.status]) byStatus[g.status] = [];
      byStatus[g.status].push(g.engine);
    }
    const parts: string[] = [];
    for (const status of ['failed', 'timeout', 'empty_output'] as const) {
      if (byStatus[status]) parts.push(`${status}: ${byStatus[status].join(', ')}`);
    }
    return parts.join(' ; ');
  }
}
