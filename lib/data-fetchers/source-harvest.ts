// ============================================================
// JOURNAL DE RECOLTE DES SOURCES EXTERNES
// ------------------------------------------------------------
// Un moteur qui lit un resultat vide venu d une source externe ne
// pouvait pas savoir si la source avait repondu sans rien trouver ou
// si elle avait echoue. Un fondateur dont les recherches OpenAlex,
// GitHub et Wikipedia tombent en timeout produisait exactement le meme
// realData vide qu un fondateur reellement absent de ces sources, et
// le moteur Equipe en tirait un score plancher presente comme « non
// instruit ». C est vrai, et cela ne dit pas que personne n a pu
// instruire.
//
// Le mecanisme d observabilite existait deja : trackedSource distingue
// le hit du miss et du timeout. Il ne sortait jamais de la fonction,
// parce qu il passait par un opts?.emit qu aucun appelant du depot ne
// fournissait. Le moteur Equipe passe explicitement undefined a cette
// position, le moteur macro n envoie qu un argument. Six evenements
// cables, aucun emetteur, depuis l origine.
//
// D ou la forme retenue, et elle est tranchee. Pas un parametre
// optionnel que l appelant doit penser a passer : c est precisement
// celle qui a echoue, et la reconduire en promettant de la brancher
// serait refaire le pari en connaissance de cause. Un journal a portee
// de run, alimente par la couche elle-meme, qu aucun appelant n a a
// transmettre.
//
// L impurete est assumee et bornee. Une couche pure dont
// l observabilite ne s execute jamais vaut moins qu une couche impure
// qui dit la verite. Les bornes :
//
//   - portee de run, via AsyncLocalStorage : deux runs concurrents ne
//     partagent rien, et il n existe aucune remise a zero a oublier
//     puisque la portee est le run lui-meme ;
//   - ecriture seule depuis trackedSource, par recordSourceOutcome ;
//   - lecture seule ailleurs, par readSourceHarvest.
//
// Hors de tout run, l ecriture est un no-op silencieux : un test
// unitaire qui appelle une source sans ouvrir de run ne doit pas
// echouer pour cette raison.
// ============================================================

import { AsyncLocalStorage } from 'async_hooks';
import type { NonProductionCause, NonProductionCauseOrNull } from '../engines/non-production';

/**
 * Issue d une interrogation de source. Distincte de la cause : deux
 * issues differentes peuvent partager une cause, et l issue dit ce qui
 * s est passe la ou la cause dit comment le lire.
 */
export type SourceOutcome = 'hit' | 'empty' | 'failed' | 'skipped';

/**
 * Correspondance issue vers cause, unique et centralisee.
 *
 *   skipped : la source est desactivee par configuration. C est une
 *             decision, donc doctrine.
 *   empty   : la source a repondu et n a rien trouve. Personne n a
 *             echoue, donc absence.
 *   failed  : timeout, erreur reseau, quota. Il y a a reparer, donc
 *             incident.
 *   hit     : la source a rendu quelque chose, aucune cause.
 */
export const OUTCOME_TO_CAUSE: Record<SourceOutcome, NonProductionCauseOrNull> = {
  hit: null,
  empty: 'absence',
  failed: 'incident',
  skipped: 'doctrine',
};

export interface SourceHarvestEntry {
  /** Moteur consommateur, tel que trackedSource le recoit. */
  engine: string;
  /** Source interrogee. */
  source: string;
  outcome: SourceOutcome;
  /** Cause structuree, null sur un hit. Derivee de l issue, jamais posee a la main. */
  cause: NonProductionCauseOrNull;
  elapsedMs: number;
  /** Message d erreur court quand l issue est failed. */
  detail?: string;
}

export interface SourceHarvest {
  entries: SourceHarvestEntry[];
  /** Nombre d interrogations par issue, pour lecture rapide. */
  counts: Record<SourceOutcome, number>;
  /** Sources ayant echoue au moins une fois, dedupliquees. */
  failedSources: string[];
  /** True des qu une interrogation a echoue. */
  hasIncident: boolean;
}

interface HarvestStore {
  entries: SourceHarvestEntry[];
}

const storage = new AsyncLocalStorage<HarvestStore>();

/**
 * Ouvre un journal pour la duree d un run et execute le pipeline
 * dedans. La portee EST le run : il n existe pas d appel de remise a
 * zero separe qu on pourrait sauter, et deux runs concurrents ne se
 * voient pas.
 */
export function withSourceHarvest<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ entries: [] }, fn);
}

/**
 * Enregistre l issue d une interrogation. Appelee par trackedSource et
 * par elle seule. Hors run, no-op silencieux.
 */
export function recordSourceOutcome(entry: {
  engine: string;
  source: string;
  outcome: SourceOutcome;
  elapsedMs: number;
  detail?: string;
}): void {
  const store = storage.getStore();
  if (!store) return;
  store.entries.push({
    engine: entry.engine,
    source: entry.source,
    outcome: entry.outcome,
    cause: OUTCOME_TO_CAUSE[entry.outcome],
    elapsedMs: entry.elapsedMs,
    ...(entry.detail ? { detail: entry.detail.slice(0, 200) } : {}),
  });
}

/** Lecture seule du journal du run courant. Hors run, journal vide. */
export function readSourceHarvest(): SourceHarvest {
  const entries = storage.getStore()?.entries ?? [];
  const counts: Record<SourceOutcome, number> = { hit: 0, empty: 0, failed: 0, skipped: 0 };
  const failed = new Set<string>();
  for (const e of entries) {
    counts[e.outcome]++;
    if (e.outcome === 'failed') failed.add(e.source);
  }
  return {
    entries,
    counts,
    failedSources: Array.from(failed).sort(),
    hasIncident: counts.failed > 0,
  };
}

/**
 * Issues d une source donnee dans le run courant. Sert aux moteurs qui
 * veulent savoir si une source determinante leur a fait defaut.
 */
export function sourceCause(source: string): NonProductionCauseOrNull {
  const entries = storage.getStore()?.entries ?? [];
  const pour = entries.filter((e) => e.source === source);
  if (pour.length === 0) return null;
  // Une source interrogee plusieurs fois, typiquement une par
  // fondateur, est en incident des qu une interrogation a echoue : le
  // moteur doit savoir que sa couverture est trouee, pas qu elle l est
  // en moyenne.
  if (pour.some((e) => e.outcome === 'failed')) return 'incident';
  if (pour.some((e) => e.outcome === 'hit')) return null;
  if (pour.every((e) => e.outcome === 'skipped')) return 'doctrine';
  return 'absence';
}

/**
 * True quand le journal est vide alors que le run a ouvert une portee.
 * Un journal muet est indiscernable d une couche qui n a rien fait, ce
 * qui est exactement la faute que ce module corrige : le cas doit se
 * voir plutot que passer pour un run sans source.
 */
export function harvestIsSilent(): boolean {
  return storage.getStore() !== undefined && (storage.getStore()?.entries.length ?? 0) === 0;
}

/** True quand un run est ouvert. Utile aux gardes et aux tests. */
export function harvestIsOpen(): boolean {
  return storage.getStore() !== undefined;
}
