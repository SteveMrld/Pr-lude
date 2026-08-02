// ============================================================
// REGISTRE DES APPELS AU MODELE
// ------------------------------------------------------------
// Sur les quarante-quatre sites d appel au modele que compte le
// depot, quatorze deposaient une mesure et trente n en deposaient
// aucune. Les sept patterns de fragilite, les quatre appels du DD
// contractuel, l extraction, le pre-scan, les metriques SaaS et
// industrielles, la coherence de revendication technique : muets.
//
// La cause n est pas la negligence, c est la forme. `addCall`
// commence par `if (!sink) return`, et `measure` est un parametre
// optionnel sur les onze signatures qui l acceptent. Un moteur est
// donc mesure si et seulement si quelqu un a pense a lui passer un
// collecteur, et la route a bien construit onze `newMeasure()`. La
// discipline a tenu onze fois et cede trente fois en six briefs.
//
// C est exactement le `FetcherOpts` de la grappe 5, dont on a etabli
// empiriquement qu il ne tenait pas : six evenements cables, aucun
// emetteur, depuis l origine. On applique donc la solution qui a
// marche la-bas plutot que d ajouter trente appels qu il faudrait
// maintenir.
//
// Le registre est a portee de run et alimente depuis le point de
// passage unique de l appel au modele, `getClient()` dans
// anthropic-client. Tout helper y passe, y compris
// `callClaudeMultiDocs` qui vit dans dd-technical-engine et
// n emprunte aucun des trois helpers exportes. Aucun site d appel
// n a rien a transmettre, et un moteur branche demain est mesure par
// construction et non par discipline.
//
// L impurete est la meme qu au journal de recolte, et bornee de la
// meme facon : portee de run via AsyncLocalStorage, donc deux runs
// concurrents ne partagent rien et il n existe pas de remise a zero a
// oublier ; ecriture depuis le seul client instrumente ; lecture
// partout ailleurs. Hors run, l ecriture est un no-op silencieux,
// pour qu un script hors pipeline n echoue pas pour cette raison.
// ============================================================

import { AsyncLocalStorage } from 'async_hooks';

export interface LlmCallRecord {
  /** Modele effectivement appele, tel que le SDK l a recu. */
  model: string;
  /** Duree de l appel reseau seul, en ms. */
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  /** Plafond demande, quand l appelant en a pose un. */
  maxTokens: number | null;
  /** True quand l appel a leve. Les tokens sont alors a zero. */
  failed: boolean;
  /** Message d erreur court, present seulement si failed. */
  error?: string;
}

export interface LlmLedger {
  calls: LlmCallRecord[];
  totalCalls: number;
  failedCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
  /** Nombre d appels par modele, pour lire d un coup la repartition
   *  entre le modele principal et le rapide. */
  byModel: Record<string, number>;
}

interface LedgerStore {
  calls: LlmCallRecord[];
}

const storage = new AsyncLocalStorage<LedgerStore>();

/**
 * Ouvre un registre pour la duree d un run et execute le pipeline
 * dedans. La portee EST le run : aucun appel de remise a zero separe
 * ne peut etre saute.
 */
export function withLlmLedger<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ calls: [] }, fn);
}

/**
 * Enregistre un appel. Appelee par le client instrumente et par lui
 * seul. Hors run, no-op silencieux.
 */
export function recordLlmCall(record: LlmCallRecord): void {
  const store = storage.getStore();
  if (!store) return;
  store.calls.push(record);
}

/** Lecture seule du registre du run courant. */
export function readLlmLedger(): LlmLedger {
  const calls = storage.getStore()?.calls ?? [];
  const byModel: Record<string, number> = {};
  let inTok = 0, outTok = 0, dur = 0, failed = 0;
  for (const c of calls) {
    byModel[c.model] = (byModel[c.model] ?? 0) + 1;
    inTok += c.inputTokens;
    outTok += c.outputTokens;
    dur += c.durationMs;
    if (c.failed) failed++;
  }
  return {
    calls,
    totalCalls: calls.length,
    failedCalls: failed,
    totalInputTokens: inTok,
    totalOutputTokens: outTok,
    totalDurationMs: dur,
    byModel,
  };
}

/**
 * True quand un run est ouvert et qu aucun appel n a ete enregistre.
 * Meme role que harvestIsSilent au journal de recolte : un registre
 * muet a la fin d un run qui a forcement appele le modele est
 * indiscernable d une instrumentation debranchee, ce qui est
 * exactement la faute corrigee ici. Le cas doit se voir.
 */
export function ledgerIsSilent(): boolean {
  const store = storage.getStore();
  return store !== undefined && store.calls.length === 0;
}

/** True quand un run est ouvert. Utile aux gardes et aux tests. */
export function ledgerIsOpen(): boolean {
  return storage.getStore() !== undefined;
}
