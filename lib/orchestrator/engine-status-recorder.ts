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
// Six statuts distincts :
//   ok                        moteur a produit un sortant recevable
//   failed                    moteur a effectivement appele son LLM
//                             et cet appel a rejete (timeout SDK,
//                             429, 529, JSON invalide, exception)
//   failed-upstream           moteur n a jamais appele son LLM parce
//                             qu une de ses dependances a rejete
//                             avant. Le releve nomme la dependance
//                             fautive, pas le message propage
//   timeout                   deadline externe (withEngineDeadline)
//                             a coupe le moteur au bout de son budget
//                             wall-clock, avant tout retour LLM
//   skipped_not_applicable    matrice de pertinence a ecarte le moteur
//                             (comportement voulu, jamais un defaut)
//   empty_output              moteur a repondu sans lever d erreur
//                             mais son sortant est null, vide, ou
//                             sans le champ minimum attendu
//
// La distinction failed / failed-upstream est centrale. Sans elle,
// un run comme In Haircare du 15 juillet affichait neuf moteurs
// failed avec le message "Request timed out.", alors que seuls trois
// avaient reellement appele Anthropic. Les six autres avaient herite
// de la rejection en cascade via Promise.all, sans jamais consommer
// un appel reseau. Le diagnostic devient net : trois incidents cote
// Anthropic, six cascades locales.
//
// La distinction ok / empty_output reste centrale. Le cas TOLSON
// (marche, narrative-drift, fragilite structurelle, decisionDrivers
// vide) est precisement un empty_output silencieux qui a passe
// pour ok dans l ancien systeme.
// ============================================================

export type EngineStatus =
  | 'ok'
  | 'failed'
  | 'failed-upstream'
  | 'timeout'
  | 'skipped_not_applicable'
  | 'empty_output';

/** Statuts consideres comme lacune (gap) qui empechent un run
 *  de sortir en completed nu. skipped_not_applicable n en fait
 *  pas partie : c est un choix doctrinal, pas un defaut.
 *  failed-upstream en fait partie : le moteur n a rien produit
 *  meme si l origine du defaut est en amont. */
export const GAP_STATUSES: readonly EngineStatus[] = ['failed', 'failed-upstream', 'timeout', 'empty_output'] as const;

export interface EngineStatusEntry {
  engine: string;
  status: EngineStatus;
  /** Duree totale observee entre markStart et record, en ms.
   *  Somme du temps d attente sur les dependances plus le temps
   *  d execution reel. Conservee pour compatibilite ascendante. */
  durationMs: number;
  /** Nombre de tentatives. 1 par defaut, superieur si retry. */
  attempts: number;
  /** Message d erreur brut si status failed ou timeout. Pour
   *  failed-upstream, message structure nommant la ou les
   *  dependances fautives, jamais le message propage. */
  errorMessage?: string;
  /** Temps ecoule entre markStart (entree du moteur dans la fenetre
   *  pipeline) et markLLMStart (premier appel LLM effectif). Isole
   *  l attente sur les dependances. Absent si le moteur n a jamais
   *  atteint son appel LLM (failed-upstream, timeout amont). */
  waitDurationMs?: number;
  /** Temps ecoule entre markLLMStart et record. Represente le cout
   *  reel de l execution du moteur. Zero si le moteur n a pas
   *  appele son LLM. */
  executionDurationMs?: number;
  /** Pour failed-upstream, liste des cles moteurs de dependance qui
   *  etaient en failed, failed-upstream ou timeout au moment de la
   *  rejection en cascade. Permet de tracer la chaine de defaut. */
  failedDependencies?: string[];
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

/** Statuts d une dependance qui la font compter comme fautive dans
 *  la promotion failed -> failed-upstream. failed-upstream inclus
 *  car une cascade peut elle-meme etre la seule dependance visible
 *  quand la racine timeout est encore en cours d enregistrement. */
const UPSTREAM_FAIL_STATUSES: ReadonlySet<EngineStatus> = new Set<EngineStatus>([
  'failed',
  'failed-upstream',
  'timeout',
]);

export class EngineStatusRecorder {
  private entries: Map<string, EngineStatusEntry> = new Map();
  private startTimes: Map<string, number> = new Map();
  private llmStartTimes: Map<string, number> = new Map();
  private declaredDeps: Map<string, string[]> = new Map();

  /** Enregistre l entree du moteur dans la fenetre pipeline.
   *  Idempotent : les appels suivants sont ignores. Le parametre
   *  optionnel deps declare les cles moteurs de dependance, utilise
   *  pour nommer la cause d une rejection en cascade. */
  markStart(engine: string, deps?: string[]): void {
    if (!this.startTimes.has(engine)) {
      this.startTimes.set(engine, Date.now());
    }
    if (deps && deps.length > 0 && !this.declaredDeps.has(engine)) {
      this.declaredDeps.set(engine, deps.slice());
    }
  }

  /** Enregistre le debut effectif de l appel LLM du moteur, apres
   *  resolution de ses dependances. Idempotent. Sa presence distingue
   *  un moteur qui a reellement appele Anthropic d un moteur rejete
   *  en cascade sans avoir jamais touche au reseau. */
  markLLMStart(engine: string): void {
    if (!this.llmStartTimes.has(engine)) {
      this.llmStartTimes.set(engine, Date.now());
    }
  }

  /** Enregistre le resultat d un moteur avec calcul automatique
   *  de la duree si markStart a ete appelle en amont. Si status
   *  est 'failed' et que markLLMStart n a jamais ete appele apres
   *  un markStart valide, promeut automatiquement en 'failed-upstream'
   *  et remplace errorMessage par un message structure nommant les
   *  dependances fautives. */
  record(entry: Omit<EngineStatusEntry, 'durationMs' | 'waitDurationMs' | 'executionDurationMs' | 'failedDependencies'> & { durationMs?: number }): void {
    const startedAt = this.startTimes.get(entry.engine);
    const llmStartedAt = this.llmStartTimes.get(entry.engine);
    const now = Date.now();

    let totalDurationMs = entry.durationMs;
    if (totalDurationMs === undefined) {
      totalDurationMs = startedAt !== undefined ? now - startedAt : 0;
    }

    let waitDurationMs: number | undefined;
    let executionDurationMs: number | undefined;
    if (startedAt !== undefined) {
      if (llmStartedAt !== undefined) {
        waitDurationMs = Math.max(0, llmStartedAt - startedAt);
        executionDurationMs = Math.max(0, now - llmStartedAt);
      } else {
        waitDurationMs = totalDurationMs;
        executionDurationMs = 0;
      }
    }

    let status: EngineStatus = entry.status;
    let errorMessage = entry.errorMessage;
    let failedDependencies: string[] | undefined;

    // Promotion failed -> failed-upstream : le moteur a rejette sans
    // avoir jamais appele son LLM. Seulement si markStart a ete
    // appele (sinon on est sur un record externe legacy dont on ne
    // sait rien du cycle de vie).
    if (status === 'failed' && startedAt !== undefined && llmStartedAt === undefined) {
      status = 'failed-upstream';
      failedDependencies = this.findFailedDependencies(entry.engine);
      errorMessage = failedDependencies.length > 0
        ? `dependency failed: ${failedDependencies.join(', ')}`
        : 'dependency failed (source non identifiee dans le releve courant)';
    }

    const record: EngineStatusEntry = {
      engine: entry.engine,
      status,
      durationMs: totalDurationMs,
      attempts: entry.attempts,
    };
    if (errorMessage !== undefined) record.errorMessage = errorMessage;
    if (waitDurationMs !== undefined) record.waitDurationMs = waitDurationMs;
    if (executionDurationMs !== undefined) record.executionDurationMs = executionDurationMs;
    if (failedDependencies !== undefined) record.failedDependencies = failedDependencies;
    this.entries.set(entry.engine, record);
  }

  /** Identifie parmi les dependances declarees celles qui sont
   *  actuellement en etat d echec. Si aucune dependance n a ete
   *  declaree au markStart, tombe sur un balayage de toutes les
   *  entrees existantes en etat d echec. */
  private findFailedDependencies(engine: string): string[] {
    const declared = this.declaredDeps.get(engine);
    const candidates = declared && declared.length > 0
      ? declared
      : Array.from(this.entries.keys()).filter((e) => e !== engine);
    return candidates.filter((d) => {
      const dep = this.entries.get(d);
      return dep !== undefined && UPSTREAM_FAIL_STATUSES.has(dep.status);
    });
  }

  /** Inspecte un result_json final et complete les entrees manquantes
   *  ou marquees ok en verifiant le contrat minimal de chaque moteur.
   *  Un moteur deja marque failed, failed-upstream ou timeout garde
   *  son statut. Un moteur non present est enregistre comme
   *  empty_output si son slot dans result_json ne satisfait pas le
   *  contrat. */
  finalizeFromResult(result: Record<string, any>, engineToResultKey: Record<string, string>): void {
    for (const [engine, resultKey] of Object.entries(engineToResultKey)) {
      const existing = this.entries.get(engine);
      // Ne pas ecraser un failed / failed-upstream / timeout deja enregistre.
      if (existing && (
        existing.status === 'failed'
        || existing.status === 'failed-upstream'
        || existing.status === 'timeout'
      )) continue;
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
   *  statut. Retourne null si aucune lacune. failed et
   *  failed-upstream sont groupes separement pour que le releve ne
   *  confonde pas un incident Anthropic reel avec une cascade
   *  locale. */
  computeErrorMessage(): string | null {
    const gaps = this.gaps();
    if (gaps.length === 0) return null;
    const byStatus: Record<string, string[]> = {};
    for (const g of gaps) {
      if (!byStatus[g.status]) byStatus[g.status] = [];
      byStatus[g.status].push(g.engine);
    }
    const parts: string[] = [];
    for (const status of ['failed', 'timeout', 'failed-upstream', 'empty_output'] as const) {
      if (byStatus[status]) parts.push(`${status}: ${byStatus[status].join(', ')}`);
    }
    return parts.join(' ; ');
  }
}
