// ============================================================
// PRELUDE - Bloc 3 : moteur de recommandation de structuration
// ------------------------------------------------------------
// Module a la demande. Lit le result_json d une analyse existante,
// appelle Claude Sonnet avec un user prompt qui injecte les signaux
// pertinents, parse la reponse JSON typee.
//
// Read-only sur le pipeline principal. Aucun effet de bord en dehors
// de l appel LLM et du retour de l output.
// ============================================================

import { callClaude, MODEL } from '../anthropic-client';
import { normalizeFrenchPunctuation } from '../../normalize-punctuation';
import {
  STRUCTURATION_SYSTEM_PROMPT,
  buildStructurationUserPrompt,
} from './prompt';
import {
  type StructurationEntreeOutput,
  type StructurationSection,
  type PostureGenerale,
  InsufficientInputError,
} from './types';

export {
  STRUCTURATION_SYSTEM_PROMPT,
  buildStructurationUserPrompt,
} from './prompt';
export type {
  StructurationEntreeOutput,
  StructurationSection,
  PostureGenerale,
} from './types';
export { InsufficientInputError } from './types';

const VALID_POSTURES: PostureGenerale[] = ['protection-forte', 'standard', 'souple'];

function asString(v: unknown, fallback = ''): string {
  if (typeof v !== 'string') return fallback;
  return normalizeFrenchPunctuation(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string')
    .map((x) => normalizeFrenchPunctuation(x as string));
}

function asSection(raw: any, label: string): StructurationSection {
  const status = raw?.status === 'data-missing' ? 'data-missing' : 'applicable';
  const recommendation = asString(raw?.recommendation, '');
  const anchors = asStringArray(raw?.anchors);
  const missingReason = asString(raw?.missingReason, '');

  // Garde-fou : status applicable sans recommendation est incoherent.
  // On retombe en data-missing pour ne pas afficher une bulle vide.
  if (status === 'applicable' && recommendation.trim().length === 0) {
    return {
      status: 'data-missing',
      recommendation: `Recommandation absente sur la rubrique ${label}.`,
      anchors: [],
      missingReason: 'Le moteur n a pas produit de prose exploitable pour cette rubrique.',
    };
  }

  // Garde-fou de discipline de citation : si la rubrique est marquee
  // applicable mais n a aucun anchor, on retrograde en data-missing
  // pour preserver la contrainte centrale du Bloc 3.
  if (status === 'applicable' && anchors.length === 0) {
    return {
      status: 'data-missing',
      recommendation: recommendation,
      anchors: [],
      missingReason: 'Aucun signal de l analyse n a pu etre cite pour appuyer cette rubrique.',
    };
  }

  const section: StructurationSection = { status, recommendation, anchors };
  if (status === 'data-missing' && missingReason) {
    section.missingReason = missingReason;
  }
  return section;
}

/**
 * Extrait le premier bloc JSON valide de la reponse. Le LLM peut
 * encadrer le JSON de quelques caracteres, on tolere.
 */
function extractJson(text: string): any {
  const trimmed = text.trim();
  // Cas direct
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }
  // Cherche le premier { et le dernier } correspondants
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('Reponse Claude sans bloc JSON parsable');
  }
  const slice = trimmed.slice(first, last + 1);
  return JSON.parse(slice);
}

/**
 * Decrit la disponibilite des grands champs d entree pour audit.
 * Permet au consommateur de comprendre les data-missing.
 */
function describeInput(resultJson: any): StructurationEntreeOutput['meta']['inputDigest'] {
  const r = resultJson || {};
  const reco = r.finalRecommendation || {};
  return {
    hasFinalRecommendation: !!r.finalRecommendation,
    hasValuation: !!r.valuation,
    hasFragiliteStructurelle: !!r.fragiliteStructurelle,
    hasNarrativeDrift: !!r.narrativeDrift,
    hasPatternMatching: !!r.patternMatching,
    hasIndicators: !!r.indicators,
    hasDecisionDrivers: Array.isArray(reco.decisionDrivers) && reco.decisionDrivers.length > 0,
    hasKeyConditions: Array.isArray(reco.keyConditions) && reco.keyConditions.length > 0,
  };
}

/**
 * Garde-fou en amont : sans finalRecommendation ou sans verdict, on
 * n a pas la matiere de base pour structurer. Le caller doit traiter
 * ce cas en presentant un message clair plutot qu en appelant pour rien.
 */
function assertSufficientInput(resultJson: any): void {
  if (!resultJson || typeof resultJson !== 'object') {
    throw new InsufficientInputError('result_json absent ou invalide.');
  }
  const reco = resultJson.finalRecommendation;
  if (!reco || typeof reco !== 'object' || !reco.verdict) {
    throw new InsufficientInputError(
      'finalRecommendation absent : l instruction Bloc 1 n a pas produit de verdict, la structuration ne peut pas etre derivee.',
    );
  }
  if (reco.verdict === 'refuser') {
    throw new InsufficientInputError(
      'Verdict refuser : la structuration a l entree n est pas applicable a un dossier rejete.',
    );
  }
}

/**
 * Entry point du moteur Bloc 3. Throw InsufficientInputError si
 * l input est inadequat. Throw une erreur generique si Claude
 * refuse ou retourne un JSON invalide.
 */
export async function analyzeStructurationEntree(
  resultJson: any,
): Promise<StructurationEntreeOutput> {
  assertSufficientInput(resultJson);

  const userPrompt = buildStructurationUserPrompt(resultJson);
  const raw = await callClaude(
    STRUCTURATION_SYSTEM_PROMPT,
    userPrompt,
    4000,
    MODEL,
    { enableWebSearch: false },
  );

  const parsed = extractJson(raw);

  const postureGenerale: PostureGenerale = VALID_POSTURES.includes(parsed.postureGenerale)
    ? parsed.postureGenerale
    : 'standard';

  const output: StructurationEntreeOutput = {
    postureGenerale,
    postureRationale: asString(parsed.postureRationale, ''),
    preambule: asString(parsed.preambule, ''),
    gouvernanceBoard: asSection(parsed.gouvernanceBoard, 'gouvernance et board'),
    clausesProtectrices: asSection(parsed.clausesProtectrices, 'clauses protectrices'),
    tranchingMilestones: asSection(parsed.tranchingMilestones, 'tranching milestones'),
    preferenceLiquidationAntiDilution: asSection(
      parsed.preferenceLiquidationAntiDilution,
      'preference de liquidation et anti-dilution',
    ),
    droitsInformationReporting: asSection(
      parsed.droitsInformationReporting,
      'droits d information et reporting',
    ),
    cadrageScenariosSortie: asSection(parsed.cadrageScenariosSortie, 'cadrage des scenarios de sortie'),
    meta: {
      generatedAt: new Date().toISOString(),
      model: MODEL,
      inputDigest: describeInput(resultJson),
    },
  };

  return output;
}
