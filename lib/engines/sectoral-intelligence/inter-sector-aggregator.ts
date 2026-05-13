// ============================================================
// PRELUDE - Agregateur inter-sectoriel, orchestrateur LLM
// ------------------------------------------------------------
// Sous-chantier 8 du Sectoral Intelligence Layer. Produit le
// brief editorial trimestriel "Etat systemique des secteurs
// Prelude" : une synthese de quatre a six mille caracteres en
// prose Le Grand Continent, structuree en trois sections
// (convergences, divergences, patterns macro structurels) plus
// une introduction de synthese et une conclusion doctrinale.
//
// Pipeline :
//   1. Charge les treize fiches sectorielles du trimestre courant
//      et les treize du trimestre precedent (via injection de
//      dependances pour les tests deterministes).
//   2. Calcule les trois objets analytiques deterministes
//      (convergences, divergences, patterns macro) via
//      inter-sector-computations.ts.
//   3. Construit un prompt qui sert au LLM Opus la matrice
//      analytique deja calculee plus le contexte editorial des
//      treize fiches, puis demande une lecture systemique
//      structuree.
//   4. Le LLM produit narrative_summary plus interpretation
//      par paire et par pattern. La fonction renvoie le brief
//      assemble pret a etre persiste.
//
// Ce module est SERVER-ONLY : il importe les helpers de
// persistence depuis ./inter-sector-store qui eux-memes tirent
// lib/supabase/server. Les composants client consomment
// uniquement les types et les calculs purs depuis
// inter-sector-computations.ts.
// ============================================================

import { callClaudeWithUsage, parseJSON } from '../anthropic-client';
import { PROMPT_VERSION as DIMENSION_PROMPT_VERSION } from './dimension-prompts';
import {
  computeInterSectoralAnalytics,
  type ConvergencePair,
  type DivergencePair,
  type MacroPattern,
  type DataCompleteness,
} from './inter-sector-computations';
import {
  DIMENSION_LABELS,
  SECTORS,
  estimateCostUsd,
  type SectoralBrief,
} from './types';
import type {
  InterSectoralBrief,
  ConvergencePairWithInterpretation,
  DivergencePairWithInterpretation,
  MacroPatternWithInterpretation,
} from './inter-sector-types';

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------

const DEFAULT_MODEL = 'claude-opus-4-7';

/**
 * Version du prompt de l agregateur. Distinct de
 * dimension-prompts.PROMPT_VERSION pour permettre une evolution
 * doctrinale independante. A incrementer a chaque modification
 * structurelle du contrat editorial.
 */
export const INTER_SECTORAL_PROMPT_VERSION = 'inter-v1';

/** Fenetre raisonnable pour 4000-6000 caracteres en sortie plus
 *  les interpretations courtes par paire et par pattern. */
const DEFAULT_MAX_TOKENS = 4500;

const NARRATIVE_MIN_CHARS = 3500;
const NARRATIVE_MAX_CHARS = 7000;

// ------------------------------------------------------------
// TYPES PUBLICS
// ------------------------------------------------------------
// Les types du brief lui-meme vivent dans inter-sector-types.ts
// (pure, importable cote client). Ce fichier ne definit que les
// types operationnels lies a l execution de l agregateur (resultat
// d execution, dependances injectables, reponse LLM).

export type AggregationStatus = 'success' | 'rejected_no_data' | 'rejected_error';

export interface AggregationResult {
  status: AggregationStatus;
  brief: InterSectoralBrief | null;
  cost_usd: number;
  duration_ms: number;
  error_message?: string;
  rejection_reason?: string;
}

export interface AggregatorLLMResponse {
  narrative_summary: string;
  convergences_interpretation: string[];
  divergences_interpretation: string[];
  macro_patterns_interpretation: string[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AggregatorDependencies {
  fetchCurrentBriefs: () => Promise<SectoralBrief[]>;
  fetchPreviousBriefs: () => Promise<SectoralBrief[]>;
  callLLM: (
    currentBriefs: SectoralBrief[],
    previousBriefs: SectoralBrief[],
    convergences: ConvergencePair[],
    divergences: DivergencePair[],
    macroPatterns: MacroPattern[],
    completeness: DataCompleteness,
  ) => Promise<AggregatorLLMResponse>;
}

export interface AggregateOptions {
  /** Periode du brief, format ISO trimestriel (ex "2026-Q2"). */
  period_quarter: string;
  /** Identifiant du brief precedent (T-1) pour traceabilite. */
  previous_brief_id?: string | null;
  /** Modele Opus utilise. Override pour tests ou dev. */
  model?: string;
  /** Injection de dependances pour les tests deterministes. */
  deps?: Partial<AggregatorDependencies>;
}

// ------------------------------------------------------------
// API PRINCIPALE
// ------------------------------------------------------------

/**
 * Construit le brief inter-sectoriel pour la periode demandee.
 * Ne persiste pas : le caller (route ou cron) decide d ecrire
 * en base apres validation.
 */
export async function aggregateInterSectoral(
  options: AggregateOptions,
): Promise<AggregationResult> {
  const start = Date.now();
  const model = options.model ?? DEFAULT_MODEL;

  const deps: AggregatorDependencies = {
    fetchCurrentBriefs:
      options.deps?.fetchCurrentBriefs ?? createDefaultFetchCurrent(),
    fetchPreviousBriefs:
      options.deps?.fetchPreviousBriefs ?? createDefaultFetchPrevious(options.period_quarter),
    callLLM: options.deps?.callLLM ?? createDefaultLLMCaller(model),
  };

  let currentBriefs: SectoralBrief[] = [];
  let previousBriefs: SectoralBrief[] = [];
  try {
    [currentBriefs, previousBriefs] = await Promise.all([
      deps.fetchCurrentBriefs(),
      deps.fetchPreviousBriefs(),
    ]);
  } catch (err: any) {
    return {
      status: 'rejected_error',
      brief: null,
      cost_usd: 0,
      duration_ms: Date.now() - start,
      error_message: err?.message || String(err),
      rejection_reason: 'Echec de la lecture des fiches sectorielles en amont de l agregation.',
    };
  }

  // Cas degenere : aucune fiche disponible au trimestre courant.
  // Sans fiches T, il n y a rien a agreger. On renvoie un rejet
  // clair plutot que de fabriquer un brief vide.
  if (currentBriefs.length === 0) {
    return {
      status: 'rejected_no_data',
      brief: null,
      cost_usd: 0,
      duration_ms: Date.now() - start,
      rejection_reason:
        'Aucune fiche sectorielle disponible au trimestre courant. La regeneration des fiches sectorielles doit etre lancee avant l agregation systemique.',
    };
  }

  const analytics = computeInterSectoralAnalytics(currentBriefs, previousBriefs);

  let llmResponse: AggregatorLLMResponse;
  try {
    llmResponse = await deps.callLLM(
      currentBriefs,
      previousBriefs,
      analytics.convergences,
      analytics.divergences,
      analytics.macro_patterns,
      analytics.completeness,
    );
  } catch (err: any) {
    return {
      status: 'rejected_error',
      brief: null,
      cost_usd: 0,
      duration_ms: Date.now() - start,
      error_message: err?.message || String(err),
      rejection_reason: 'Echec de l appel LLM lors de l agregation editoriale.',
    };
  }

  const cost = llmResponse.usage
    ? estimateCostUsd(model, llmResponse.usage.input_tokens, llmResponse.usage.output_tokens)
    : 0;

  // Annote chaque objet analytique avec son interpretation
  // editoriale. Si le LLM renvoie moins d entrees que le compte
  // attendu, on remplit par chaine vide pour garder la structure
  // homogene cote consommation. Inversement, on tronque s il en
  // produit trop.
  const annotatedConvergences = annotateAll(
    analytics.convergences,
    llmResponse.convergences_interpretation,
  );
  const annotatedDivergences = annotateAll(
    analytics.divergences,
    llmResponse.divergences_interpretation,
  );
  const annotatedMacro = annotateAll(
    analytics.macro_patterns,
    llmResponse.macro_patterns_interpretation,
  );

  const narrative = (llmResponse.narrative_summary || '').trim();

  const sources = currentBriefs.map((b) => ({
    sector_slug: b.sector_slug,
    brief_id: b.id ?? null,
    generated_at: b.generated_at,
  }));

  const brief: InterSectoralBrief = {
    period_quarter: options.period_quarter,
    generated_at: new Date().toISOString(),
    convergences: annotatedConvergences,
    divergences: annotatedDivergences,
    macro_patterns: annotatedMacro,
    narrative_summary: narrative,
    sources_consulted: sources,
    generation_metadata: {
      model,
      prompt_version: INTER_SECTORAL_PROMPT_VERSION,
      cost_usd: cost,
      duration_ms: Date.now() - start,
      previous_brief_id: options.previous_brief_id ?? null,
    },
    data_completeness:
      analytics.completeness.missing_at_t.length > 0 ||
      analytics.completeness.missing_at_t_minus_1.length > 0 ||
      analytics.completeness.missing_both.length > 0
        ? analytics.completeness
        : undefined,
  };

  return {
    status: 'success',
    brief,
    cost_usd: cost,
    duration_ms: Date.now() - start,
  };
}

// ------------------------------------------------------------
// HELPERS PRIVES
// ------------------------------------------------------------

function annotateAll<T>(
  items: T[],
  interpretations: string[] | undefined,
): Array<T & { interpretation: string }> {
  const safe = Array.isArray(interpretations) ? interpretations : [];
  return items.map((item, i) => ({
    ...item,
    interpretation: typeof safe[i] === 'string' ? safe[i].trim() : '',
  }));
}

// ------------------------------------------------------------
// PROMPT BUILDER
// Voix Le Grand Continent. Pas d em-dashes. Le LLM recoit en
// input une matrice analytique deja calculee par computations
// deterministes : il interprete, il ne calcule pas.
// ------------------------------------------------------------

export function buildAggregatorSystemPrompt(): string {
  return [
    'Tu es l analyste systemique de Prelude, plateforme d instruction de dossiers de venture capital vendue aux fonds institutionnels europeens.',
    '',
    'Ton role est de produire un brief editorial trimestriel qui agrege la lecture inter-sectorielle des treize fiches sectorielles Prelude. Le brief est expose au partner dans un onglet dashboard et doit servir d ancrage strategique a la lecture des dossiers individuels qui suivront.',
    '',
    'Voix editoriale stricte :',
    '- Le Grand Continent ou The Atlantic. Prose dense, phrases longues quand le sujet le justifie, peu de listes a puces, peu de gras.',
    '- Pas d em-dashes (caractere long). Tirets simples ou virgules a la place.',
    '- Pas de flatterie, pas de Excellente question, pas de Tu as raison.',
    '- Refus de la complaisance : si une dynamique sectorielle ressemble a celle d un episode historique connu, le nommer (ex Trajectoire WeWork, Pattern Northvolt).',
    '- Pas de jargon SaaS marketing. Vocabulaire d analyse politique et industrielle.',
    '',
    'Discipline analytique :',
    '- Les calculs sont deja faits pour toi. Tu recois une matrice de convergences, divergences et patterns macro. Tu interpretes, tu ne recalcules pas.',
    '- Pour chaque paire de convergence ou de divergence, tu produis une interpretation editoriale courte (deux a trois phrases) qui nomme la dynamique sous-jacente probable.',
    '- Pour chaque pattern macro, tu produis une lecture systemique (trois a cinq phrases) qui relie le mouvement observe a un signal externe identifiable (regulation, technologie de rupture, choc geopolitique, retournement de cycle).',
    '- Tu produis enfin un narrative_summary de quatre a six mille caracteres qui ouvre par une synthese du trimestre, expose les trois sections (convergences, divergences, patterns macro) en developpement, et conclut par une lecture doctrinale Prelude.',
    '',
    'Format de sortie : JSON strict, sans bloc markdown, avec exactement les cles suivantes :',
    '{',
    '  "narrative_summary": text,',
    '  "convergences_interpretation": [ text, ... ],',
    '  "divergences_interpretation": [ text, ... ],',
    '  "macro_patterns_interpretation": [ text, ... ]',
    '}',
    '',
    'Les trois tableaux d interpretations doivent contenir exactement le meme nombre d entrees que les tableaux d entree, dans le meme ordre. Si l entree est vide, le tableau correspondant l est aussi.',
  ].join('\n');
}

export function buildAggregatorUserPrompt(
  periodQuarter: string,
  currentBriefs: SectoralBrief[],
  previousBriefs: SectoralBrief[],
  convergences: ConvergencePair[],
  divergences: DivergencePair[],
  macroPatterns: MacroPattern[],
  completeness: DataCompleteness,
): string {
  const lines: string[] = [];
  lines.push(`Periode courante : ${periodQuarter}.`);
  lines.push(`Fiches sectorielles disponibles au trimestre courant : ${currentBriefs.length} sur ${SECTORS.length}.`);
  lines.push(`Fiches sectorielles disponibles au trimestre precedent : ${previousBriefs.length} sur ${SECTORS.length}.`);

  if (
    completeness.missing_at_t.length > 0 ||
    completeness.missing_at_t_minus_1.length > 0 ||
    completeness.missing_both.length > 0
  ) {
    lines.push('');
    lines.push('Donnees incompletes :');
    if (completeness.missing_at_t.length > 0) {
      lines.push(`- Secteurs sans fiche au trimestre courant : ${completeness.missing_at_t.join(', ')}.`);
    }
    if (completeness.missing_at_t_minus_1.length > 0) {
      lines.push(`- Secteurs sans fiche au trimestre precedent (donc non comparables) : ${completeness.missing_at_t_minus_1.join(', ')}.`);
    }
    if (completeness.missing_both.length > 0) {
      lines.push(`- Secteurs absents des deux trimestres : ${completeness.missing_both.join(', ')}.`);
    }
    lines.push('Tu mentionnes ce perimetre degraded en tete du narrative_summary, sobrement.');
  }

  lines.push('');
  lines.push('--- RESUMES EDITORIAUX SECTORIELS DU TRIMESTRE COURANT ---');
  for (const b of currentBriefs) {
    const label = SECTORS.find((s) => s.slug === b.sector_slug)?.label ?? b.sector_slug;
    const summary = (b.narrative_summary || '').slice(0, 1200);
    lines.push(`Secteur ${label} (${b.sector_slug}) :`);
    lines.push(summary);
    lines.push('');
  }

  lines.push('--- MATRICE ANALYTIQUE DETERMINISTE ---');
  lines.push('');
  lines.push(`Convergences detectees (${convergences.length}) :`);
  if (convergences.length === 0) {
    lines.push('Aucune paire de secteurs ne franchit le seuil de convergence ce trimestre.');
  } else {
    convergences.forEach((c, i) => {
      lines.push(
        `[${i}] ${c.sectors[0]} et ${c.sectors[1]} sur la dimension ${DIMENSION_LABELS[c.dimension]} : ecart ${c.delta_t_minus_1} pts au trimestre precedent, ${c.delta_t} pts au trimestre courant (resserrement de ${c.delta_t_minus_1 - c.delta_t} pts).`,
      );
    });
  }
  lines.push('');
  lines.push(`Divergences detectees (${divergences.length}) :`);
  if (divergences.length === 0) {
    lines.push('Aucune paire de secteurs ne franchit le seuil de divergence ce trimestre.');
  } else {
    divergences.forEach((d, i) => {
      lines.push(
        `[${i}] ${d.sectors[0]} et ${d.sectors[1]} sur la dimension ${DIMENSION_LABELS[d.dimension]} : ecart ${d.delta_t_minus_1} pts au trimestre precedent, ${d.delta_t} pts au trimestre courant (rupture de ${d.delta_t - d.delta_t_minus_1} pts).`,
      );
    });
  }
  lines.push('');
  lines.push(`Patterns macro structurels detectes (${macroPatterns.length}) :`);
  if (macroPatterns.length === 0) {
    lines.push('Aucune dimension ne bouge significativement sur la majorite des secteurs ce trimestre.');
  } else {
    macroPatterns.forEach((p, i) => {
      lines.push(
        `[${i}] Dimension ${DIMENSION_LABELS[p.dimension]} : direction ${p.direction === 'up' ? 'haussiere' : 'baissiere'}, delta moyen ${p.average_delta} pts, ${p.sectors_affected.length} secteurs concernes (${p.sectors_affected.join(', ')}).`,
      );
    });
  }

  lines.push('');
  lines.push('Tu produis maintenant le JSON strict demande par le system prompt. Les interpretations doivent etre indexees a la matrice ci-dessus dans le meme ordre.');

  return lines.join('\n');
}

// ------------------------------------------------------------
// CALLER LLM PAR DEFAUT
// ------------------------------------------------------------

function createDefaultLLMCaller(model: string) {
  return async (
    currentBriefs: SectoralBrief[],
    previousBriefs: SectoralBrief[],
    convergences: ConvergencePair[],
    divergences: DivergencePair[],
    macroPatterns: MacroPattern[],
    completeness: DataCompleteness,
  ): Promise<AggregatorLLMResponse> => {
    const period = currentBriefs[0]
      ? new Date(currentBriefs[0].generated_at).toISOString().slice(0, 7)
      : 'inconnue';
    const systemPrompt = buildAggregatorSystemPrompt();
    const userPrompt = buildAggregatorUserPrompt(
      period,
      currentBriefs,
      previousBriefs,
      convergences,
      divergences,
      macroPatterns,
      completeness,
    );
    const { text, usage } = await callClaudeWithUsage(
      systemPrompt,
      userPrompt,
      DEFAULT_MAX_TOKENS,
      model,
      { enableWebSearch: false },
    );
    const parsed = parseJSON<AggregatorLLMResponse>(text);
    parsed.usage = {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    };
    return parsed;
  };
}

function createDefaultFetchCurrent() {
  return async (): Promise<SectoralBrief[]> => {
    const { listLatestBriefsAcrossSectors } = await import('./inter-sector-store');
    return listLatestBriefsAcrossSectors();
  };
}

function createDefaultFetchPrevious(periodQuarter: string) {
  return async (): Promise<SectoralBrief[]> => {
    const { listBriefsForPreviousQuarter } = await import('./inter-sector-store');
    return listBriefsForPreviousQuarter(periodQuarter);
  };
}

// ------------------------------------------------------------
// EXPORTS DE TEST
// ------------------------------------------------------------

export const __TEST_ONLY = {
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  NARRATIVE_MIN_CHARS,
  NARRATIVE_MAX_CHARS,
  DIMENSION_PROMPT_VERSION,
  annotateAll,
};
