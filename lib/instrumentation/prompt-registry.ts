// ============================================================
// REGISTRE DES PROMPTS SYSTEME
// ------------------------------------------------------------
// Le version stamp hashait les prompts en lisant les fichiers .ts sur
// le disque, par existsSync puis readFileSync sur process.cwd(). Ces
// fichiers n existent plus apres le build : mesure sur les cinq
// derniers runs de production, les vingt-neuf moteurs portent tous
// sourceFileHash a 'unreadable' et systemPromptHashes vide, sans
// exception. Le enginesHash ne portait donc que des constantes du
// registre, modele, temperature et chemin source : il n aurait pas
// bouge si tous les prompts du depot avaient change.
//
// Un stamp qui ne couvre pas les prompts ne permet pas d etablir que
// deux runs ont tourne sur la meme doctrine, ce qui est precisement ce
// qu un fonds demandera en voulant rejouer une instruction.
//
// La lecture prealable a etabli qu aucun prompt systeme n est mouvant.
// Les trente-trois declarations sont au niveau module et leurs seules
// interpolations sont deux constantes importees statiques. Un hash de
// prompt est donc stable entre deux runs du meme code et bouge si un
// prompt change. Un hash mouvant aurait ete pire qu une empreinte
// absente : il aurait donne l illusion d une mesure.
//
// EXHAUSTIVITE. Le registre importe les modules en entier et collecte
// toute exportation dont le nom contient SYSTEM_PROMPT, plutot que de
// nommer les constantes une a une. Ajouter un prompt a un module deja
// reference est donc couvert sans intervention. Ajouter un module
// entier ne l est pas, et c est la limite de la forme : un test compare
// le nombre de declarations du depot au nombre d entrees du registre et
// echoue sur tout ecart. Sans ce test, on aurait reconstruit le
// probleme du bloc 1, ou une chose n existe dans la mesure que si
// quelqu un a pense a l y mettre.
// ============================================================

import { createHash } from 'crypto';
import { DIMENSION_KEYS } from '../engines/sectoral-intelligence/types';
import {
  buildDimensionSystemPrompt,
  buildAggregatorSystemPrompt,
} from '../engines/sectoral-intelligence/dimension-prompts';
import { buildAggregatorSystemPrompt as buildInterSectorSystemPrompt } from '../engines/sectoral-intelligence/inter-sector-aggregator';
import * as m_blindspot_engine from '../engines/blindspot-engine';
import * as m_causal_engine from '../engines/causal-engine';
import * as m_contrarian_engine from '../engines/contrarian-engine';
import * as m_dd_contractual_engine from '../engines/dd-contractual-engine';
import * as m_dd_financial_engine from '../engines/dd-financial-engine';
import * as m_dd_technical_engine from '../engines/dd-technical-engine';
import * as m_execution_friction_engine from '../engines/execution-friction-engine';
import * as m_extraction_engine from '../engines/extraction-engine';
import * as m_financial_coherence_engine from '../engines/financial-coherence-engine';
import * as m_financial_extraction_engine from '../engines/financial-extraction-engine';
import * as m_industrial_metrics_engine from '../engines/industrial-metrics-engine';
import * as m_macro_engine from '../engines/macro-engine';
import * as m_market_engine from '../engines/market-engine';
import * as m_narrative_drift_engine from '../engines/narrative-drift-engine';
import * as m_orchestrator from '../engines/orchestrator';
import * as m_pattern_engine from '../engines/pattern-engine';
import * as m_prescan_engine from '../engines/prescan-engine';
import * as m_reference_aggregation_engine from '../engines/reference-aggregation-engine';
import * as m_reference_checks_engine from '../engines/reference-checks-engine';
import * as m_saas_metrics_engine from '../engines/saas-metrics-engine';
import * as m_team_engine from '../engines/team-engine';
import * as m_tech_claim_coherence_engine from '../engines/tech-claim-coherence-engine';
import * as m_capital_structure_fragility_pattern from '../engines/fragility-structurelle/capital-structure-fragility-pattern';
import * as m_commoditization_drift_pattern from '../engines/fragility-structurelle/commoditization-drift-pattern';
import * as m_fixed_cost_trap_pattern from '../engines/fragility-structurelle/fixed-cost-trap-pattern';
import * as m_growth_subsidized_pattern from '../engines/fragility-structurelle/growth-subsidized-pattern';
import * as m_infrastructure_hostage_pattern from '../engines/fragility-structurelle/infrastructure-hostage-pattern';
import * as m_regulatory_time_bomb_pattern from '../engines/fragility-structurelle/regulatory-time-bomb-pattern';
import * as m_scale_mirage_risk_pattern from '../engines/fragility-structurelle/scale-mirage-risk-pattern';
import * as m_structuration_prompt from '../engines/structuration-entree/prompt';

const MODULES: Array<[string, Record<string, unknown>]> = [
  ['blindspot-engine', m_blindspot_engine],
  ['causal-engine', m_causal_engine],
  ['contrarian-engine', m_contrarian_engine],
  ['dd-contractual-engine', m_dd_contractual_engine],
  ['dd-financial-engine', m_dd_financial_engine],
  ['dd-technical-engine', m_dd_technical_engine],
  ['execution-friction-engine', m_execution_friction_engine],
  ['extraction-engine', m_extraction_engine],
  ['financial-coherence-engine', m_financial_coherence_engine],
  ['financial-extraction-engine', m_financial_extraction_engine],
  ['industrial-metrics-engine', m_industrial_metrics_engine],
  ['macro-engine', m_macro_engine],
  ['market-engine', m_market_engine],
  ['narrative-drift-engine', m_narrative_drift_engine],
  ['orchestrator', m_orchestrator],
  ['pattern-engine', m_pattern_engine],
  ['prescan-engine', m_prescan_engine],
  ['reference-aggregation-engine', m_reference_aggregation_engine],
  ['reference-checks-engine', m_reference_checks_engine],
  ['saas-metrics-engine', m_saas_metrics_engine],
  ['team-engine', m_team_engine],
  ['tech-claim-coherence-engine', m_tech_claim_coherence_engine],
  ['fragility-structurelle/capital-structure-fragility-pattern', m_capital_structure_fragility_pattern],
  ['fragility-structurelle/commoditization-drift-pattern', m_commoditization_drift_pattern],
  ['fragility-structurelle/fixed-cost-trap-pattern', m_fixed_cost_trap_pattern],
  ['fragility-structurelle/growth-subsidized-pattern', m_growth_subsidized_pattern],
  ['fragility-structurelle/infrastructure-hostage-pattern', m_infrastructure_hostage_pattern],
  ['fragility-structurelle/regulatory-time-bomb-pattern', m_regulatory_time_bomb_pattern],
  ['fragility-structurelle/scale-mirage-risk-pattern', m_scale_mirage_risk_pattern],
  ['structuration-entree/prompt', m_structuration_prompt],
];

export interface PromptFingerprint {
  /** Chemin du module, relatif a lib/engines. */
  module: string;
  /** Nom de la constante exportee. */
  name: string;
  /** sha256 tronque a 16 caracteres du contenu du prompt. */
  hash: string;
  chars: number;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Empreintes de tous les prompts systeme atteignables par import.
 * Triees par module puis par nom, de sorte que l ordre de declaration
 * n influe pas sur le hash agrege.
 */
// ============================================================
// PROMPTS CONSTRUITS PAR FONCTION
// ------------------------------------------------------------
// Le parcours ci-dessus collecte les exportations dont le nom porte
// SYSTEM_PROMPT et dont la valeur est une chaine. Trois prompts
// n entrent pas dans cette forme : ceux de sectoral-intelligence, qui
// se construisent par fonction parce qu il y en a un par dimension.
//
// Les ignorer aurait rendu la correction du registre creuse. Les deux
// moteurs sectoriels viennent d entrer dans LLM_ENGINES parce que
// leurs fiches sont injectees en tete du prompt de la plupart des
// moteurs ; s ils y entraient sans empreinte de prompt, modifier un
// prompt sectoriel continuerait de ne pas bouger enginesHash, et la
// correction n aurait deplace que le symptome.
//
// Les trois builders sont purs et deterministes : meme code, meme
// sortie. Leur hash est donc stable entre deux runs du meme code et
// bouge des qu un prompt change, ce que la doctrine de ce module
// exige. Et ils sont lus par import, pas sur le disque, donc ils
// survivent au build comme le reste du registre.
// ============================================================

const PROMPTS_CONSTRUITS: Array<{ module: string; name: string; build: () => string }> = [
  ...DIMENSION_KEYS.map((k) => ({
    module: 'sectoral-intelligence/regenerator',
    name: `DIMENSION_SYSTEM_PROMPT[${k}]`,
    build: () => buildDimensionSystemPrompt(k),
  })),
  {
    module: 'sectoral-intelligence/regenerator',
    name: 'AGGREGATOR_SYSTEM_PROMPT',
    build: buildAggregatorSystemPrompt,
  },
  {
    module: 'sectoral-intelligence/inter-sector-aggregator',
    name: 'INTER_SECTOR_SYSTEM_PROMPT',
    build: buildInterSectorSystemPrompt,
  },
];

export function collectPromptFingerprints(): PromptFingerprint[] {
  const out: PromptFingerprint[] = [];
  for (const [mod, ns] of MODULES) {
    for (const name of Object.keys(ns)) {
      if (!/SYSTEM_PROMPT/.test(name)) continue;
      const value = (ns as any)[name];
      if (typeof value !== 'string') continue;
      out.push({ module: mod, name, hash: sha256(value), chars: value.length });
    }
  }
  for (const p of PROMPTS_CONSTRUITS) {
    const value = p.build();
    out.push({ module: p.module, name: p.name, hash: sha256(value), chars: value.length });
  }
  out.sort((a, b) => (a.module + a.name).localeCompare(b.module + b.name));
  return out;
}

/**
 * Texte integral de tous les prompts systeme atteignables. Meme
 * parcours que collectPromptFingerprints, dont c est la variante non
 * hachee.
 *
 * Existe pour une garde et une seule : verifier qu aucun nom de dossier
 * traite par la plateforme ne se retrouve ecrit en dur dans un prompt.
 * Un nom de client dans le prompt d un autre client est disqualifiant,
 * et la seule facon de l empecher durablement est de relire tous les
 * prompts a chaque execution de la suite plutot que de corriger les
 * occurrences une a une.
 */
export function collectPromptTexts(): Array<{ module: string; name: string; text: string }> {
  const out: Array<{ module: string; name: string; text: string }> = [];
  for (const [mod, ns] of MODULES) {
    for (const name of Object.keys(ns)) {
      if (!/SYSTEM_PROMPT/.test(name)) continue;
      const value = (ns as any)[name];
      if (typeof value !== 'string') continue;
      out.push({ module: mod, name, text: value });
    }
  }
  // Les prompts construits passent aussi par la garde de
  // confidentialite : un nom de dossier ecrit en dur dans un prompt
  // sectoriel serait aussi disqualifiant qu ailleurs.
  for (const p of PROMPTS_CONSTRUITS) {
    out.push({ module: p.module, name: p.name, text: p.build() });
  }
  return out;
}

/** Modules references par le registre. Lu par le test d exhaustivite. */
export function registeredModules(): string[] {
  return MODULES.map(([m]) => m).sort();
}

/**
 * Hash agrege de la doctrine. Deux runs qui le partagent ont tourne
 * sur les memes prompts systeme, quel que soit l ordre de declaration.
 */
export function promptsDoctrineHash(): string {
  const fps = collectPromptFingerprints();
  return sha256(fps.map((f) => `${f.module}:${f.name}:${f.hash}`).join('|'));
}
