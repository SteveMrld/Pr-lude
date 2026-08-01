// ============================================================
// VERSION STAMP - tampon de version de chaque run d analyse
// ------------------------------------------------------------
// Brique 1 du chantier preuve : on instrumente, on ne change
// rien. Chaque analyse persistee est rattachee a la version
// exacte qui l a produite via un objet JSON serialise dans
// result_json.meta.versionStamp.
//
// Le stamp est requetable (champ JSON), assemble dans un seul
// endroit, et concu pour qu une issue reelle (ex divergence
// 33 vs 19 d un run a l autre) puisse plus tard s y rattacher
// par analysisId sans construire le schema de reconciliation
// maintenant.
//
// Contenu :
//   - app.commitSha : SHA du commit applicatif au moment du run
//   - models : modeles LLM utilises (primary, fast) + temperature
//   - engines : fingerprint par moteur (modele, temperature,
//     hash du prompt systeme, version eventuelle)
//   - configs : hash des configurations de calibration
//     (MATCHING_CONFIG, DIMENSION_WEIGHTS, VERDICT_THRESHOLDS)
//   - inputs : hash des entrees (deck base64, texte extrait, BP)
//   - timing : capturedAt + durationMs
//
// Tout est best-effort : si une lecture echoue (fs read-only en
// runtime serverless, git introuvable), le stamp note le sentinel
// 'unreadable' et continue. Le commitSha capture l etat exact du
// code et reste la source de verite ultime.
// ============================================================

import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { MATCHING_CONFIG } from '../comparables/structural-vector';
import {
  DIMENSION_WEIGHTS,
  VERDICT_THRESHOLDS,
} from '../engines/score-calculator';
import { MODEL, FAST_MODEL, isWebSearchEnabled } from '../engines/anthropic-client';
import {
  ENGINE_LLM_BUDGET,
  TEMPERATURE_DIALECTIQUE,
  TEMPERATURE_SCORE,
} from '../engines/engine-budget';
import { PATTERN_LLM_OPTIONS } from '../engines/fragility-structurelle/pattern-interface';

// ============================================================
// SCHEMA VERSION
// ------------------------------------------------------------
// Incrementer a chaque changement structurel du stamp. Permet
// aux consommateurs de gerer plusieurs schemas en parallele.
//
// v2 : la temperature cesse d etre le sentinel 'api-default' partout
// et porte la valeur du site d appel, moteur par moteur. Le bump
// compte parce que la valeur entre dans enginesHash : un stamp v1 et
// un stamp v2 du meme code rendraient des hashes differents pour des
// runs identiques, et le harnais de reproductibilite doit pouvoir
// refuser la comparaison plutot que conclure a une divergence.
// ============================================================

export const VERSION_STAMP_SCHEMA = '2026-08-01-v2';

// ============================================================
// TYPES
// ============================================================

export interface EngineFingerprint {
  /** Identifiant du modele LLM utilise par defaut dans le moteur. */
  model: string;
  /**
   * Temperature effectivement passee au site d appel du moteur.
   *
   * Le champ valait 'api-default' pour les trente moteurs, ce qui etait
   * exact tant qu aucun site d appel ne pouvait en decider : ni
   * callClaude ni callClaudeWithUsage ne construisaient le parametre. Le
   * stamp disait donc la verite sans rien apprendre a personne, et deux
   * runs a temperatures differentes auraient rendu le meme enginesHash.
   *
   * Depuis que la temperature est requise au site d appel, la valeur est
   * portee ici et entre dans enginesHash : deux runs qui ne partagent pas
   * le meme regime d echantillonnage ne peuvent plus etre compares comme
   * s ils l avaient fait. C est la condition pour que le releve de
   * reproductibilite mesure ce qu il pretend mesurer.
   */
  temperature: number;
  /** Hash des system prompts du moteur. Plusieurs si le moteur a plusieurs prompts (dd-contractual). */
  systemPromptHashes: string[];
  /** Longueur totale des system prompts (chars). */
  systemPromptChars: number;
  /** Version explicite si declaree par le moteur (export const PROMPT_VERSION). */
  promptVersion?: string;
  /** Hash du fichier source complet pour capturer aussi le code metier. */
  sourceFileHash: string | 'unreadable';
  /** Chemin source (relatif a la racine repo). */
  sourcePath: string;
}

export interface ConfigFingerprint {
  /** Hash JSON canonique de la config. */
  hash: string;
  /** Valeur de la config au moment du run, pour debug et lisibilite humaine. */
  value: any;
}

export interface InputFingerprint {
  /** Hash sha256 (16 chars) du deck PDF en base64, null si non fourni. */
  deckHash: string | null;
  /** Taille du deck en bytes. */
  deckBytes: number;
  /** Hash sha256 (16 chars) du texte de pitch fourni en complement, null si non fourni. */
  textHash: string | null;
  /** Longueur du texte (chars). */
  textChars: number;
  /** Hash du BP (xlsx/csv/word converti en string), null si non fourni. */
  bpHash: string | null;
  /** Taille du BP source (chars de la chaine extraite). */
  bpChars: number;
  /** Noms additionnels des fichiers fournis (informatif, non hashe individuellement). */
  additionalFiles: string[];
}

/**
 * Mode de run, capture par le stamp pour rendre les segments de
 * calibration etanches. frozen=true marque un run avec web search
 * coupe en dur (corpus ingestion, replays deterministes), et entre
 * dans le fingerprint via configs.runMode. asOf est purement
 * provenance : date a laquelle le deck a ete recu, ne contraint
 * pas l API web search a des resultats historiques, n entre pas
 * dans le hash.
 */
export interface RunMode {
  frozen: boolean;
  asOf: string | null;
}

export interface VersionStamp {
  schemaVersion: string;
  capturedAt: string;
  /** Rempli en fin de run via stampWithDuration. */
  durationMs?: number;
  app: {
    commitSha: string | null;
    runtimeNode: string;
    runtimePlatform: string;
  };
  models: {
    primary: string;
    fast: string;
    /**
     * Il n y a plus de temperature par defaut a l echelle du run.
     *
     * Le champ valait 'api-default' parce que le code n en fixait aucune
     * et que la valeur etait donc uniforme par omission. Elle est
     * desormais decidee moteur par moteur, selon que la sortie alimente
     * une dimension du score ou non, et se lit dans engines[id]
     * .temperature. Le libelle acte cette bascule plutot que de
     * conserver un champ devenu faux : un stamp qui affirme un defaut
     * global la ou il y a deux regimes induit en erreur exactement
     * l analyse qu il doit servir.
     */
    defaultTemperature: 'per-engine';
  };
  configs: Record<string, ConfigFingerprint>;
  engines: Record<string, EngineFingerprint>;
  inputs: InputFingerprint;
  webSearchEnabled: boolean;
  runMode: RunMode;
}

// ============================================================
// HELPERS DE HASH
// ============================================================

const HASH_TRUNCATE = 16;

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex').slice(0, HASH_TRUNCATE);
}

/**
 * Serialisation deterministe : cles triees a tous les niveaux, ordre
 * des tableaux preserve puisqu il porte du sens (systemPromptHashes
 * suit l ordre de declaration des prompts dans le fichier).
 */
function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value).sort()) out[k] = canonicalize(value[k]);
    return out;
  }
  return value;
}

/**
 * Hash JSON deterministe, invariant a l ordre des cles.
 *
 * L implementation precedente passait Object.keys(value).sort() en
 * second argument de JSON.stringify. Ce parametre n est pas un
 * comparateur de tri : c est une liste blanche de noms de proprietes,
 * appliquee a TOUS les niveaux de l objet. Sur une structure plate,
 * elle se comportait comme un tri et le resultat etait juste. Sur une
 * structure imbriquee, elle ne retenait dans chaque sous-objet que les
 * proprietes portant le nom d une cle de premier niveau, c est-a-dire
 * aucune : canonicalHash de la carte des moteurs rendait
 * {"blindspot":{},"causal":{},...}.
 *
 * enginesHash etait donc aveugle a tout ce qu il pretendait tracer,
 * modele, hash de prompt, hash de source, et desormais temperature. Il
 * ne bougeait que si la liste des moteurs changeait. Les tests ne le
 * voyaient pas parce qu ils n assertaient que son invariance entre deux
 * runs identiques, propriete qu un hash constant satisfait toujours.
 *
 * Consequence pour la lecture des runs anterieurs : leur enginesHash
 * ne vaut rien et ne doit pas etre invoque pour affirmer que deux runs
 * ont tourne sur le meme code moteur. C est aussi pourquoi le schema
 * passe en v2.
 */
export function canonicalHash(value: any): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

// ============================================================
// COMMIT SHA - lecture best-effort
// ------------------------------------------------------------
// Priorite : env var (Vercel injecte VERCEL_GIT_COMMIT_SHA), puis
// git rev-parse HEAD si le binaire est dispo, puis null.
// ============================================================

let _commitShaCache: string | null | undefined;

export function getAppCommitSha(): string | null {
  if (_commitShaCache !== undefined) return _commitShaCache;

  // Vercel
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  if (vercel) {
    _commitShaCache = vercel;
    return vercel;
  }

  // Local : appel git rev-parse. Echec silencieux si git introuvable
  // ou si le cwd n est pas un repo.
  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (/^[0-9a-f]{40}$/.test(sha)) {
      _commitShaCache = sha;
      return sha;
    }
  } catch {
    // continue
  }

  _commitShaCache = null;
  return null;
}

// ============================================================
// REGISTRY MOTEURS LLM
// ------------------------------------------------------------
// Liste explicite des moteurs qui appellent Anthropic. Pour
// chacun, on connait son fichier source, le modele applique et
// la temperature passee a son site d appel.
//
// La temperature est derivee de la source unique partout ou elle
// existe : ENGINE_LLM_BUDGET pour les huit moteurs budgetes,
// PATTERN_LLM_OPTIONS pour les sept patterns de fragilite. Un
// reglage change dans la table se propage donc au stamp sans
// qu on ait a y penser, et un stamp ne peut pas affirmer une
// temperature que le moteur n a pas eue. Les quinze autres la
// declarent en dur ici parce que leur site d appel porte un
// litteral et qu il n existe aucune table a lire : ceux-la
// peuvent diverger, et c est le prix du litteral au site
// d appel, pas un choix de ce module.
// ============================================================

interface EngineRegistryEntry {
  id: string;
  path: string;
  model: 'primary' | 'fast' | 'mixed';
  /** Temperature du site d appel. Lue dans la table du moteur quand il
   *  en a une, declaree ici quand son site d appel porte un litteral. */
  temperature: number;
  promptVersion?: string;
}

/** Temperature des cinq moteurs d extraction, qui passent 0 en sixieme
 *  argument de callClaudeWithPDF depuis l origine. Nommee pour que le
 *  registry se lise comme une doctrine et non comme une liste de zeros. */
const TEMPERATURE_EXTRACTION = 0;

const LLM_ENGINES: EngineRegistryEntry[] = [
  // Bloc 0
  { id: 'prescan', path: 'lib/engines/prescan-engine.ts', model: 'fast', temperature: TEMPERATURE_EXTRACTION },
  // Bloc 1 - extraction
  { id: 'extraction', path: 'lib/engines/extraction-engine.ts', model: 'primary', temperature: TEMPERATURE_EXTRACTION },
  { id: 'financial-extraction', path: 'lib/engines/financial-extraction-engine.ts', model: 'primary', temperature: TEMPERATURE_EXTRACTION },
  { id: 'saas-metrics', path: 'lib/engines/saas-metrics-engine.ts', model: 'primary', temperature: TEMPERATURE_EXTRACTION },
  { id: 'industrial-metrics', path: 'lib/engines/industrial-metrics-engine.ts', model: 'primary', temperature: TEMPERATURE_EXTRACTION },
  // Bloc 1 - analyse
  { id: 'team', path: 'lib/engines/team-engine.ts', model: 'primary', temperature: ENGINE_LLM_BUDGET.team.temperature },
  { id: 'market', path: 'lib/engines/market-engine.ts', model: 'primary', temperature: TEMPERATURE_SCORE },
  { id: 'macro', path: 'lib/engines/macro-engine.ts', model: 'primary', temperature: TEMPERATURE_SCORE },
  { id: 'pattern', path: 'lib/engines/pattern-engine.ts', model: 'primary', temperature: ENGINE_LLM_BUDGET.patternMatching.temperature },
  { id: 'causal', path: 'lib/engines/causal-engine.ts', model: 'primary', temperature: ENGINE_LLM_BUDGET.causalReversal.temperature },
  { id: 'blindspot', path: 'lib/engines/blindspot-engine.ts', model: 'primary', temperature: ENGINE_LLM_BUDGET.blindspotAnalysis.temperature },
  { id: 'contrarian', path: 'lib/engines/contrarian-engine.ts', model: 'primary', temperature: ENGINE_LLM_BUDGET.contrarianAnalysis.temperature },
  { id: 'financial-coherence', path: 'lib/engines/financial-coherence-engine.ts', model: 'primary', temperature: TEMPERATURE_SCORE },
  { id: 'tech-claim', path: 'lib/engines/tech-claim-coherence-engine.ts', model: 'fast', temperature: TEMPERATURE_DIALECTIQUE },
  { id: 'execution-friction', path: 'lib/engines/execution-friction-engine.ts', model: 'primary', temperature: TEMPERATURE_DIALECTIQUE },
  { id: 'narrative-drift', path: 'lib/engines/narrative-drift-engine.ts', model: 'primary', temperature: ENGINE_LLM_BUDGET.narrativeDrift.temperature },
  { id: 'reference-checks', path: 'lib/engines/reference-checks-engine.ts', model: 'mixed', temperature: ENGINE_LLM_BUDGET.referenceChecks.temperature },
  { id: 'reference-aggregation', path: 'lib/engines/reference-aggregation-engine.ts', model: 'mixed', temperature: TEMPERATURE_DIALECTIQUE },
  { id: 'orchestrator', path: 'lib/engines/orchestrator.ts', model: 'primary', temperature: ENGINE_LLM_BUDGET.finalRecommendation.temperature },
  // Fragilite Structurelle (7 patterns)
  { id: 'fragility-growth-subsidized', path: 'lib/engines/fragility-structurelle/growth-subsidized-pattern.ts', model: 'primary', temperature: PATTERN_LLM_OPTIONS.temperature },
  { id: 'fragility-infrastructure-hostage', path: 'lib/engines/fragility-structurelle/infrastructure-hostage-pattern.ts', model: 'primary', temperature: PATTERN_LLM_OPTIONS.temperature },
  { id: 'fragility-fixed-cost-trap', path: 'lib/engines/fragility-structurelle/fixed-cost-trap-pattern.ts', model: 'primary', temperature: PATTERN_LLM_OPTIONS.temperature },
  { id: 'fragility-regulatory-time-bomb', path: 'lib/engines/fragility-structurelle/regulatory-time-bomb-pattern.ts', model: 'primary', temperature: PATTERN_LLM_OPTIONS.temperature },
  { id: 'fragility-commoditization-drift', path: 'lib/engines/fragility-structurelle/commoditization-drift-pattern.ts', model: 'primary', temperature: PATTERN_LLM_OPTIONS.temperature },
  { id: 'fragility-capital-structure', path: 'lib/engines/fragility-structurelle/capital-structure-fragility-pattern.ts', model: 'primary', temperature: PATTERN_LLM_OPTIONS.temperature },
  { id: 'fragility-scale-mirage', path: 'lib/engines/fragility-structurelle/scale-mirage-risk-pattern.ts', model: 'primary', temperature: PATTERN_LLM_OPTIONS.temperature },
  // Bloc 2 - DD
  { id: 'dd-financial', path: 'lib/engines/dd-financial-engine.ts', model: 'primary', temperature: TEMPERATURE_DIALECTIQUE },
  { id: 'dd-contractual', path: 'lib/engines/dd-contractual-engine.ts', model: 'primary', temperature: TEMPERATURE_DIALECTIQUE },
  { id: 'dd-technical', path: 'lib/engines/dd-technical-engine.ts', model: 'primary', temperature: TEMPERATURE_DIALECTIQUE },
];

// ============================================================
// LECTURE BEST-EFFORT DES FICHIERS MOTEURS
// ------------------------------------------------------------
// Regex sur le contenu : capture toutes les constantes nommees
// *SYSTEM_PROMPT*, calcule un hash de chaque. Echec gracieux :
// si le fichier n est pas accessible (runtime serverless sans
// .ts dans le bundle), on retourne sourceFileHash='unreadable'
// et systemPromptHashes=[].
// ============================================================

let _engineFingerprintCache: Record<string, EngineFingerprint> | undefined;

function modelOf(entry: EngineRegistryEntry): string {
  if (entry.model === 'primary') return MODEL;
  if (entry.model === 'fast') return FAST_MODEL;
  return `${MODEL}+${FAST_MODEL}`;
}

function fingerprintEngine(entry: EngineRegistryEntry): EngineFingerprint {
  const absPath = join(process.cwd(), entry.path);
  let sourceFileHash: string | 'unreadable' = 'unreadable';
  const systemPromptHashes: string[] = [];
  let systemPromptChars = 0;
  let promptVersion = entry.promptVersion;

  if (existsSync(absPath)) {
    try {
      const content = readFileSync(absPath, 'utf8');
      sourceFileHash = sha256(content);

      // Capture les constantes XYZ_SYSTEM_PROMPT = `...` ou
      // const SYSTEM_PROMPT = `...`. Le pattern accepte les
      // template literals et les chaines simples ou doubles.
      const tmplRegex = /const\s+\w*SYSTEM_PROMPT\w*\s*=\s*`([\s\S]*?)`/g;
      let match: RegExpExecArray | null;
      while ((match = tmplRegex.exec(content)) !== null) {
        systemPromptChars += match[1].length;
        systemPromptHashes.push(sha256(match[1]));
      }

      // Capture aussi const PROMPT_VERSION = '...' si present
      const verMatch = content.match(/export\s+const\s+\w*PROMPT_VERSION\w*\s*=\s*['"`]([^'"`]+)['"`]/);
      if (verMatch && !promptVersion) promptVersion = verMatch[1];
    } catch {
      sourceFileHash = 'unreadable';
    }
  }

  return {
    model: modelOf(entry),
    temperature: entry.temperature,
    systemPromptHashes,
    systemPromptChars,
    promptVersion,
    sourceFileHash,
    sourcePath: entry.path,
  };
}

export function getEngineFingerprints(): Record<string, EngineFingerprint> {
  if (_engineFingerprintCache) return _engineFingerprintCache;
  const out: Record<string, EngineFingerprint> = {};
  for (const entry of LLM_ENGINES) {
    out[entry.id] = fingerprintEngine(entry);
  }
  _engineFingerprintCache = out;
  return out;
}

// ============================================================
// CONFIGS HASHEES
// ------------------------------------------------------------
// On hash uniquement la valeur deterministe et serialisable des
// configs critiques pour le scoring. Si demain un changement
// touche les poids ou le plancher de comparables, le hash bouge
// et c est ce qu on veut. La valeur est embarquee a cote pour
// lisibilite humaine sans aller relire le code.
// ============================================================

function getConfigFingerprints(runMode: RunMode): Record<string, ConfigFingerprint> {
  // Seul frozen entre dans le hash : asOf est provenance pure et
  // n alimente pas le fingerprint. Si demain on veut segmenter aussi
  // par date de capture, c est une ligne a ajouter ici, pas une
  // refonte. Le choix actuel garde le segment corpus stable a travers
  // les decks pris a des dates differentes.
  const runModeForHash = { frozen: runMode.frozen };
  return {
    dimensionWeights: {
      hash: canonicalHash(DIMENSION_WEIGHTS),
      value: DIMENSION_WEIGHTS,
    },
    verdictThresholds: {
      hash: canonicalHash(VERDICT_THRESHOLDS),
      value: VERDICT_THRESHOLDS,
    },
    comparablesMatching: {
      hash: canonicalHash(MATCHING_CONFIG),
      value: MATCHING_CONFIG,
    },
    runMode: {
      hash: canonicalHash(runModeForHash),
      value: runModeForHash,
    },
  };
}

// ============================================================
// INPUTS HASHES
// ============================================================

export interface BuildStampInputs {
  /** PDF base64 du deck principal. */
  deckBase64?: string | null;
  /** Taille originale du deck en bytes (avant base64). */
  deckBytes?: number | null;
  /** Texte de pitch fourni en complement (cas saisie manuelle). */
  pitchText?: string | null;
  /** Contenu textuel extrait du BP (xlsx/csv/docx). */
  bpText?: string | null;
  /** Noms des fichiers additionnels (informatif). */
  additionalFiles?: string[] | null;
}

function fingerprintInputs(inputs: BuildStampInputs): InputFingerprint {
  const deckBase64 = inputs.deckBase64 || null;
  const deckBytes = inputs.deckBytes ?? (deckBase64 ? Math.floor((deckBase64.length * 3) / 4) : 0);
  const pitchText = inputs.pitchText || null;
  const bpText = inputs.bpText || null;
  return {
    deckHash: deckBase64 ? sha256(deckBase64) : null,
    deckBytes,
    textHash: pitchText ? sha256(pitchText) : null,
    textChars: pitchText ? pitchText.length : 0,
    bpHash: bpText ? sha256(bpText) : null,
    bpChars: bpText ? bpText.length : 0,
    additionalFiles: inputs.additionalFiles || [],
  };
}

// ============================================================
// API PUBLIQUE
// ============================================================

export interface BuildStampOptions {
  inputs: BuildStampInputs;
  /** Override l horodatage de capture (utile aux tests deterministes). */
  capturedAt?: string;
  /**
   * Mode de run. Defaut : frozen=false, asOf=null (run courant). Pour
   * une ingestion corpus, l appelant fournit explicitement frozen=true
   * et la date de reception du deck.
   */
  runMode?: Partial<RunMode>;
}

/**
 * Assemble un version stamp complet a partir des entrees du
 * dossier. Synchrone, pas d I/O reseau, lecture fs best-effort.
 * Tournera meme si git ou les .ts ne sont pas accessibles
 * (Vercel runtime), avec sentinels 'unreadable' / null.
 */
export function buildVersionStamp(opts: BuildStampOptions): VersionStamp {
  const runMode: RunMode = {
    frozen: opts.runMode?.frozen === true,
    asOf: opts.runMode?.asOf ?? null,
  };
  // Web search effectif : frozen=true coupe en dur l indicateur, meme
  // si ENABLE_WEB_SEARCH=true sur Vercel. Garantit que le stamp d un
  // run corpus reflete la realite (pas d ouverture reseau) et que le
  // hash configs (qui contient runMode.frozen) etanche le segment.
  const webSearchEnabled = !runMode.frozen && isWebSearchEnabled();
  return {
    schemaVersion: VERSION_STAMP_SCHEMA,
    capturedAt: opts.capturedAt || new Date().toISOString(),
    app: {
      commitSha: getAppCommitSha(),
      runtimeNode: process.version || 'unknown',
      runtimePlatform: process.platform || 'unknown',
    },
    models: {
      primary: MODEL,
      fast: FAST_MODEL,
      defaultTemperature: 'per-engine',
    },
    configs: getConfigFingerprints(runMode),
    engines: getEngineFingerprints(),
    inputs: fingerprintInputs(opts.inputs),
    webSearchEnabled,
    runMode,
  };
}

/**
 * Cloturer un stamp en y ajoutant la duree de run. Utilise par
 * la route /api/analyze a la fin du pipeline.
 */
export function sealVersionStamp(stamp: VersionStamp, durationMs: number): VersionStamp {
  return { ...stamp, durationMs };
}

/**
 * Sous-ensemble utilisable comme cle de groupement : deux runs
 * avec le meme fingerprint ont strictement la meme version de
 * code, de configs et d entrees. Une variance observee entre
 * eux est donc 100% imputable a la stochasticite LLM.
 */
export interface StampFingerprint {
  commitSha: string | null;
  configsHash: string;
  enginesHash: string;
  inputsHash: string;
  modelsHash: string;
}

export function fingerprintStamp(stamp: VersionStamp): StampFingerprint {
  return {
    commitSha: stamp.app.commitSha,
    configsHash: canonicalHash(
      Object.fromEntries(
        Object.entries(stamp.configs).map(([k, v]) => [k, v.hash]),
      ),
    ),
    enginesHash: canonicalHash(
      Object.fromEntries(
        Object.entries(stamp.engines).map(([k, v]) => [k, {
          model: v.model,
          temperature: v.temperature,
          systemPromptHashes: v.systemPromptHashes,
          promptVersion: v.promptVersion,
          sourceFileHash: v.sourceFileHash,
        }]),
      ),
    ),
    inputsHash: canonicalHash(stamp.inputs),
    modelsHash: canonicalHash(stamp.models),
  };
}

/**
 * Compare deux stamps cote a cote, retourne la liste des champs
 * qui different. Utile au harnais de reproductibilite pour
 * verifier que la variance observee n est pas due a une derive
 * d entree ou de config.
 */
export function diffStamps(a: VersionStamp, b: VersionStamp): string[] {
  const fa = fingerprintStamp(a);
  const fb = fingerprintStamp(b);
  const diffs: string[] = [];
  if (fa.commitSha !== fb.commitSha) diffs.push(`commitSha: ${fa.commitSha} vs ${fb.commitSha}`);
  if (fa.configsHash !== fb.configsHash) diffs.push(`configs: ${fa.configsHash} vs ${fb.configsHash}`);
  if (fa.enginesHash !== fb.enginesHash) diffs.push(`engines: ${fa.enginesHash} vs ${fb.enginesHash}`);
  if (fa.inputsHash !== fb.inputsHash) diffs.push(`inputs: ${fa.inputsHash} vs ${fb.inputsHash}`);
  if (fa.modelsHash !== fb.modelsHash) diffs.push(`models: ${fa.modelsHash} vs ${fb.modelsHash}`);
  return diffs;
}
