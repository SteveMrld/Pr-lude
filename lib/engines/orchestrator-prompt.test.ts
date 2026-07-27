// ============================================================
// Tests deterministes du prompt de synthese finale
// ------------------------------------------------------------
// Deux proprietes prouvees ici.
//
// La premiere : aucune combinaison de moteurs absents ne fait plus
// lever la construction du prompt. C est le defaut de c487a8b2, ou
// patternMatching resolu null levait a la lecture de comparables,
// faisait sortir orchestrate par son catch, et renvoyait le
// fallback degrade a decisionDrivers vide, donc un
// finalRecommendation classe empty_output et une section Facteurs
// decisifs muette dans la note.
//
// La seconde : le prompt declare son socle. Un run partiel doit se
// dire partiel, nommer les moteurs muets, et interdire au modele de
// lire un silence instrumental comme un signal favorable.
//
// LIMITE ASSUMEE : ces tests ne prouvent pas le contenu que le
// modele renvoie. Qu une synthese sur socle complet produise des
// decisionDrivers non vides releve de l appel LLM reel, hors suite
// deterministe. Ce qui est prouve ici est le maillon qui cassait :
// le prompt se construit, donc le fallback degrade n est plus
// atteint par ce chemin, donc la classification empty_output n est
// plus mecaniquement forcee. La derniere assertion documente ce
// couplage sur le contrat du recorder plutot que de le supposer.
// ============================================================

import {
  buildOrchestratorUserPrompt,
  computeEngineAvailability,
  buildSocleBlock,
  SOCLE_ENGINE_LABELS,
} from './orchestrator';
import { passesMinimalContract } from '../orchestrator/engine-status-recorder';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ------------------------------------------------------------
// Fixtures minimales, une par moteur du socle. Volontairement
// pauvres : on teste la robustesse de la construction, pas la
// richesse du contenu.
// ------------------------------------------------------------
const FIXTURES: Record<string, any> = {
  extraction: {
    companyName: 'Dossier Temoin',
    sector: 'Deeptech',
    subSector: 'Photonique',
    fundraise: { stage: 'Series A', amount: '8 M€', valuation: '32 M€' },
  },
  team: {
    systemicCoverage: { score: 68 },
    collectiveAntiFragility: { score: 54 },
    experienceTransposition: { score: 61 },
    founderObsession: { score: 73 },
    redFlags: ['dependance fondateur'],
    greenFlags: ['duo complementaire'],
  },
  market: {
    needIntensity: { score: 57 },
    organicSignals: { score: 44 },
    defensibility: { score: 62 },
    perceivedSize: 'large',
    realIntensity: 'medium',
    saturation: 'fragmented',
  },
  macro: {
    cyclePosition: 'milieu de cycle',
    vcCapitalOnSegment: 'en contraction',
    criticalTimingWindow: { exists: true, horizon: '18 mois' },
    contraryclicalOpportunity: { score: 49 },
  },
  patternMatching: {
    archetypeDominant: 'infrastructure B2B',
    comparables: [
      { name: 'Stripe', proximity: 71 },
      { name: 'Datadog', proximity: 63 },
    ],
    retrospectiveBenchmark: { averageScore: 58 },
  },
  causalReversal: {
    blindspotsScores: {
      marche: { score: 52, alerte: false },
      equipe: { score: 41, alerte: true },
    },
  },
  blindspotAnalysis: {
    globalBlindspotScore: 47,
    alertesCritiques: ['concentration client'],
    patternsHistoriques: [{ case: 'Northvolt', outcome: 'echec', similarity: 38 }],
    syntheseAveuglement: 'Vigilance moderee, une alerte de concentration.',
    patterns: {
      concentration: { detected: true, intensity: 66, patternName: 'Concentration', evidence: 'top 3 clients' },
    },
  },
  contrarianAnalysis: {
    globalContrarianScore: 55,
    comparablesContrariens: [{ name: 'Mistral', outcome: 'succes' }],
    syntheseSingularite: 'Une singularite technique reelle mais peu documentee.',
    signals: {
      technique: { detected: true, strength: 62, signalName: 'Avance technique', evidence: 'brevet depose' },
    },
  },
};

const SOCLE_KEYS = Object.keys(SOCLE_ENGINE_LABELS);

/** Construit le jeu d entrees en annulant les moteurs demandes. */
function buildParams(nullKeys: string[] = []) {
  const p: any = {
    conflictBlock: '',
    annotationsBlock: '',
    fundNote: null,
    mechanicalScore: {
      globalScore: 53,
      verdict: 'approfondir',
      dimensions: {
        team: { score: 62, contribution: 12 },
        market: { score: 48, contribution: 11 },
        macro: { score: 55, contribution: 8 },
        financial: { score: 44, contribution: 6 },
        contrarian: { score: 57, contribution: 9 },
        vigilance: { score: 39, contribution: 6 },
      },
    },
    narrativeDrift: null,
    fragiliteStructurelle: null,
  };
  for (const key of SOCLE_KEYS) {
    p[key] = nullKeys.includes(key) ? null : FIXTURES[key];
  }
  return p;
}

function buildSafely(nullKeys: string[]): { threw: boolean; prompt: string; err?: string } {
  try {
    return { threw: false, prompt: buildOrchestratorUserPrompt(buildParams(nullKeys)) };
  } catch (err: any) {
    return { threw: true, prompt: '', err: err?.message };
  }
}

// ============================================================
// SUITE 1 - Cas nominal, socle complet
// ============================================================

console.log('\n[Suite 1] socle complet, huit moteurs presents');

{
  const r = buildSafely([]);
  check(!r.threw, 'la construction aboutit');
  check(r.prompt.includes('Dossier Temoin'), 'le prompt porte le dossier');
  check(r.prompt.includes('Stripe (71%)'), 'les comparables Pattern Matching sont interpoles');
  check(r.prompt.includes('Couverture systémique : 68/100'), 'les scores Equipe sont interpoles');
  check(r.prompt.includes('Les 8 moteurs du socle ont abouti'), 'le socle complet est declare');
  check(!r.prompt.includes('INDISPONIBLES'), 'aucune lacune annoncee sur socle complet');

  const a = computeEngineAvailability(buildParams([]));
  check(a.available.length === 8 && a.missing.length === 0, 'disponibilite : huit presents, zero absent');
}

// ============================================================
// SUITE 2 - patternMatching absent, le cas c487a8b2
// ============================================================

console.log('\n[Suite 2] patternMatching absent');

{
  const r = buildSafely(['patternMatching']);
  check(!r.threw, 'la construction ne leve plus (c487a8b2 levait ici)');
  check(r.prompt.includes('Top comparables : \n') || r.prompt.includes('Top comparables : '), 'la ligne comparables retombe sur son repli vide');
  check(r.prompt.includes('Archétype : ?'), 'l archetype retombe sur le point d interrogation');
  check(r.prompt.includes('Moteurs INDISPONIBLES sur ce run : Pattern Matching'), 'le prompt nomme Pattern Matching indisponible');
  check(r.prompt.includes('ce run est partiel'), 'le prompt annonce un run partiel');
  check(r.prompt.includes('JAMAIS une lacune comme une absence de risque'), 'l interdiction de lire une lacune comme un signal est portee');

  const a = computeEngineAvailability(buildParams(['patternMatching']));
  check(a.missingKeys.length === 1 && a.missingKeys[0] === 'patternMatching', 'disponibilite : une seule lacune identifiee');
  check(!a.available.includes('Pattern Matching'), 'Pattern Matching hors des moteurs ayant abouti');
}

// ============================================================
// SUITE 3 - Trois moteurs absents
// ============================================================

console.log('\n[Suite 3] trois moteurs absents');

{
  const nulls = ['patternMatching', 'blindspotAnalysis', 'contrarianAnalysis'];
  const r = buildSafely(nulls);
  check(!r.threw, 'la construction aboutit sur trois lacunes');
  check(r.prompt.includes('3 moteurs du socle sont indisponibles'), 'le compte de lacunes est annonce');
  check(r.prompt.includes('Pattern Matching'), 'lacune 1 nommee');
  check(r.prompt.includes('Aveuglement'), 'lacune 2 nommee');
  check(r.prompt.includes('Singularites contrariennes'), 'lacune 3 nommee');
  check(r.prompt.includes('Score global de vigilance : 0/100'), 'le repli || 0 s applique au lieu de lever');
  check(r.prompt.includes('Moteurs ayant abouti : Extraction, Equipe, Marche, Macro et timing, Retournement causal'),
    'les cinq moteurs restants sont nommes comme socle disponible');

  const a = computeEngineAvailability(buildParams(nulls));
  check(a.missing.length === 3 && a.available.length === 5, 'disponibilite : trois absents, cinq presents');

  // Le maillon qui cassait. Avant la garde, ce chemin levait, donc
  // route.ts renvoyait le fallback degrade a decisionDrivers vide,
  // que le contrat minimal classe empty_output. Le prompt se
  // construisant, la synthese reelle est de nouveau atteignable et
  // sa sortie normale satisfait le contrat.
  const fallbackDegrade = { verdict: 'approfondir', decisionDrivers: [], argumentation: '', degraded: true };
  const sortieNormale = { verdict: 'approfondir', decisionDrivers: ['facteur 1', 'facteur 2', 'facteur 3'] };
  check(passesMinimalContract('finalRecommendation', fallbackDegrade) === false,
    'le fallback degrade ne satisfait pas le contrat, il serait classe empty_output');
  check(passesMinimalContract('finalRecommendation', sortieNormale) === true,
    'une sortie de synthese normale satisfait le contrat, donc classee ok');
}

// ============================================================
// SUITE 4 - Tout le socle absent sauf un
// ============================================================

console.log('\n[Suite 4] socle reduit a un seul moteur');

{
  for (const survivant of SOCLE_KEYS) {
    const nulls = SOCLE_KEYS.filter(k => k !== survivant);
    const r = buildSafely(nulls);
    if (r.threw) {
      check(false, `survivant ${survivant} : la construction leve (${r.err})`);
      continue;
    }
    const a = computeEngineAvailability(buildParams(nulls));
    const ok = r.prompt.includes('ce run est partiel')
      && r.prompt.includes('7 moteurs du socle sont indisponibles')
      && r.prompt.includes(`Moteurs ayant abouti : ${SOCLE_ENGINE_LABELS[survivant]}`)
      && a.available.length === 1
      && a.missing.length === 7;
    check(ok, `survivant ${survivant} : degrade sans lever et declare son socle`);
  }
}

// ============================================================
// SUITE 5 - Socle entierement absent
// ============================================================

console.log('\n[Suite 5] aucun moteur du socle');

{
  const r = buildSafely(SOCLE_KEYS);
  check(!r.threw, 'la construction aboutit meme sans aucun moteur');
  check(r.prompt.includes('Moteurs ayant abouti : aucun'), 'le socle vide est declare comme tel');
  check(r.prompt.includes('8 moteurs du socle sont indisponibles'), 'les huit lacunes sont annoncees');
}

// ============================================================
// SUITE 6 - Le bloc socle isole
// ============================================================

console.log('\n[Suite 6] bloc socle');

{
  const complet = buildSocleBlock({ available: ['Equipe'], missing: [], missingKeys: [] });
  check(complet.includes('Aucun axe n est muet'), 'socle complet : le bloc est emis quand meme');

  const un = buildSocleBlock({ available: ['Equipe'], missing: ['Macro et timing'], missingKeys: ['macro'] });
  check(un.includes('1 moteur du socle est indisponible'), 'accord au singulier sur une lacune');

  const deux = buildSocleBlock({ available: [], missing: ['A', 'B'], missingKeys: ['a', 'b'] });
  check(deux.includes('2 moteurs du socle sont indisponibles'), 'accord au pluriel sur deux lacunes');

  // Un objet vide vaut absence : un moteur qui a repondu sans aucun
  // champ n a rien instruit.
  const vide = computeEngineAvailability({ team: {}, market: FIXTURES.market });
  check(vide.missingKeys.includes('team'), 'un objet vide compte comme moteur absent');
  check(vide.available.includes('Marche'), 'un moteur renseigne compte comme present');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
