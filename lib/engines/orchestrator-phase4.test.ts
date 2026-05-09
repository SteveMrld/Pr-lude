// ============================================================
// Tests orchestrateur final : injection des blocs Phase 4
// ------------------------------------------------------------
// Vérifie que les helpers buildNarrativeDriftBlock et
// buildFragiliteStructurelleBlock produisent un bloc cohérent
// quand le payload est présent et une chaîne vide quand il est
// absent. Couvre les cas limites (payload partiel, recommandations
// vides, patterns tous non applicables).
//
// Execution : tsx lib/engines/orchestrator-phase4.test.ts
// ============================================================

import { buildNarrativeDriftBlock, buildFragiliteStructurelleBlock } from './orchestrator';
import type { NarrativeDriftAnalysisOutput } from './narrative-drift-engine';
import type { FragiliteStructurelleAnalysisOutput } from './fragility-structurelle/types';

let pass = 0, fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, condition: boolean) {
  check(label, condition, true);
}

const truncate = (s: string | undefined, max: number = 400): string => {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max) + '...';
};

// ============================================================
// Test 1 : buildNarrativeDriftBlock avec payload null
// ============================================================

console.log('\n=== Test 1 : Narrative Drift block null ===');
{
  check('null retourne chaine vide', buildNarrativeDriftBlock(null, truncate), '');
  check('undefined retourne chaine vide', buildNarrativeDriftBlock(undefined, truncate), '');
}

// ============================================================
// Test 2 : buildNarrativeDriftBlock avec payload complet
// ============================================================

console.log('\n=== Test 2 : Narrative Drift block complet ===');
{
  const nd: NarrativeDriftAnalysisOutput = {
    applicabilite: 'full',
    applicabiliteRationale: 'Corpus suffisant.',
    metriquesLexicales: {
      densiteConcrete: 0.42,
      ratioAbstraitConcret: 1.8,
      opaciteScore: 65,
      totalWordsAnalyses: 1200,
      topAbstractWords: [],
      topConcreteWords: [],
    },
    glissementIndicateurs: { score: 70, verdict: 'alerte', rationale: 'r', evidencePro: [], evidenceContra: [], confidence: 80 } as any,
    opaciteProgressive: { score: 65, verdict: 'alerte', rationale: 'r', evidencePro: [], evidenceContra: [], confidence: 75 } as any,
    narrativePremiumCollapse: { score: 60, verdict: 'attention', rationale: 'r', evidencePro: [], evidenceContra: [], confidence: 70 } as any,
    globalDriftScore: 65,
    verdict: 'alerte',
    counterArchetype: {
      closest: 'WeWork pre-2019',
      direction: 'derive-confirmee',
      rationale: 'Profil narratif comparable.',
    },
    recommandationDD: 'Demander grille de KPIs operationnels reproductibles.',
  } as NarrativeDriftAnalysisOutput;

  const block = buildNarrativeDriftBlock(nd, truncate);
  checkTrue('block contient titre Narrative Drift', block.includes('LECTURE DU LANGAGE'));
  checkTrue('block contient score 65', block.includes('65/100'));
  checkTrue('block contient verdict ALERTE', block.includes('ALERTE'));
  checkTrue('block contient densite concrete', block.includes('0.42'));
  checkTrue('block contient ratio abstrait/concret', block.includes('1.8'));
  checkTrue('block contient opacite 65', block.includes('Opacité : 65') || block.includes('Opacité: 65'));
  checkTrue('block contient counter-archetype WeWork', block.includes('WeWork'));
  checkTrue('block contient direction derive-confirmee', block.includes('derive-confirmee'));
  checkTrue('block contient scores des trois axes', block.includes('70/100') && block.includes('60/100'));
  checkTrue('block contient recommandation DD', block.includes('grille de KPIs'));
}

// ============================================================
// Test 3 : Narrative Drift sans recommandation DD
// ============================================================

console.log('\n=== Test 3 : Narrative Drift sans recommandation DD ===');
{
  const nd: any = {
    globalDriftScore: 30,
    verdict: 'sain',
    metriquesLexicales: { densiteConcrete: 0.6, ratioAbstraitConcret: 0.9, opaciteScore: 25 },
    counterArchetype: { closest: 'Stripe', direction: 'sain' },
    glissementIndicateurs: { score: 25 },
    opaciteProgressive: { score: 30 },
    narrativePremiumCollapse: { score: 28 },
    recommandationDD: '',
  };
  const block = buildNarrativeDriftBlock(nd, truncate);
  checkTrue('block produit malgre recommandation vide', block.length > 50);
  checkTrue('pas de ligne Recommandation DD', !block.includes('Recommandation DD'));
}

// ============================================================
// Test 4 : buildFragiliteStructurelleBlock avec null
// ============================================================

console.log('\n=== Test 4 : Fragilite Structurelle block null ===');
{
  check('null retourne chaine vide', buildFragiliteStructurelleBlock(null, truncate), '');
  check('undefined retourne chaine vide', buildFragiliteStructurelleBlock(undefined, truncate), '');
}

// ============================================================
// Test 5 : Fragilite Structurelle avec patterns actifs et combinaisons
// ============================================================

console.log('\n=== Test 5 : Fragilite Structurelle avec combinaison Trajectoire WeWork ===');
{
  const fs: any = {
    globalFragilityScore: 72,
    verdict: 'drapeau-rouge',
    patterns: {
      'growth-subsidized-model': { patternId: 'growth-subsidized-model', applicabilite: 'full', globalScore: 75, verdict: 'alerte' },
      'fixed-cost-trap': { patternId: 'fixed-cost-trap', applicabilite: 'full', globalScore: 70, verdict: 'alerte' },
      'commoditization-drift': { patternId: 'commoditization-drift', applicabilite: 'full', globalScore: 30, verdict: 'sain' },
      'infrastructure-hostage': { applicabilite: 'not-applicable' },
      'regulatory-time-bomb': { applicabilite: 'not-applicable' },
      'capital-structure-fragility': { applicabilite: 'not-applicable' },
      'scale-mirage-risk': { applicabilite: 'not-applicable' },
    },
    resumeEditorial: 'Profil Fragilite Structurelle marque par la combinaison Trajectoire WeWork.',
    combinaisons: [
      {
        nom: 'Trajectoire WeWork',
        patterns: ['growth-subsidized-model', 'fixed-cost-trap'],
        rationale: 'Marge unitaire negative plus base de couts incompressibles, trajectoire mecanique vers la restructuration.',
        severite: 'drapeau-rouge',
      },
    ],
    recommandationsDD: [
      'Demander breakdown contribution margin par cohorte.',
      'Demander downside scenario chiffre.',
    ],
  };

  const block = buildFragiliteStructurelleBlock(fs, truncate);
  checkTrue('block contient titre Fragilite Structurelle', block.includes('FRAGILITÉ STRUCTURELLE'));
  checkTrue('block contient score 72', block.includes('72/100'));
  checkTrue('block contient verdict DRAPEAU-ROUGE', block.includes('DRAPEAU-ROUGE'));
  checkTrue('block compte 3 patterns actifs sur 7', block.includes('3/7'));
  checkTrue('block liste les deux patterns remontes', block.includes('growth-subsidized-model') && block.includes('fixed-cost-trap'));
  checkTrue('block ne liste pas le pattern sain dans remontes', !block.match(/Patterns remontés.*commoditization-drift/));
  checkTrue('block contient combinaison Trajectoire WeWork', block.includes('Trajectoire WeWork'));
  checkTrue('block contient severite drapeau-rouge dans combinaison', block.includes('drapeau-rouge'));
  checkTrue('block contient rationale combinaison', block.includes('trajectoire mecanique'));
  checkTrue('block contient resume editorial', block.includes('Profil Fragilite Structurelle'));
  checkTrue('block contient recommandations DD', block.includes('contribution margin'));
}

// ============================================================
// Test 6 : Fragilite Structurelle avec tous patterns non applicables
// ============================================================

console.log('\n=== Test 6 : Fragilite Structurelle tous non applicables ===');
{
  const fs: any = {
    globalFragilityScore: 0,
    verdict: 'sain',
    patterns: {
      'growth-subsidized-model': { applicabilite: 'not-applicable' },
      'infrastructure-hostage': { applicabilite: 'not-applicable' },
      'fixed-cost-trap': { applicabilite: 'not-applicable' },
      'regulatory-time-bomb': { applicabilite: 'not-applicable' },
      'commoditization-drift': { applicabilite: 'not-applicable' },
      'capital-structure-fragility': { applicabilite: 'not-applicable' },
      'scale-mirage-risk': { applicabilite: 'not-applicable' },
    },
    resumeEditorial: 'Aucun pattern applicable sur ce dossier.',
    combinaisons: [],
    recommandationsDD: [],
  };
  const block = buildFragiliteStructurelleBlock(fs, truncate);
  checkTrue('block contient 0/7 patterns actifs', block.includes('0/7'));
  checkTrue('block contient aucun pattern remonte', block.includes('aucun'));
  checkTrue('block contient aucune combinaison', block.includes('aucune'));
}

// ============================================================
// Test 7 : Fragilite Structurelle plusieurs combinaisons
// ============================================================

console.log('\n=== Test 7 : Fragilite Structurelle exposition triple WeWork ===');
{
  const fs: any = {
    globalFragilityScore: 78,
    verdict: 'drapeau-rouge',
    patterns: {
      'growth-subsidized-model': { patternId: 'growth-subsidized-model', applicabilite: 'full', globalScore: 70, verdict: 'alerte' },
      'fixed-cost-trap': { patternId: 'fixed-cost-trap', applicabilite: 'full', globalScore: 65, verdict: 'alerte' },
      'capital-structure-fragility': { patternId: 'capital-structure-fragility', applicabilite: 'full', globalScore: 60, verdict: 'alerte' },
      'commoditization-drift': { applicabilite: 'not-applicable' },
      'infrastructure-hostage': { applicabilite: 'not-applicable' },
      'regulatory-time-bomb': { applicabilite: 'not-applicable' },
      'scale-mirage-risk': { applicabilite: 'not-applicable' },
    },
    resumeEditorial: 'Triple exposition WeWork.',
    combinaisons: [
      { nom: 'Trajectoire WeWork', patterns: ['growth-subsidized-model', 'fixed-cost-trap'], rationale: 'r1', severite: 'drapeau-rouge' },
      { nom: 'Exposition triple WeWork', patterns: ['capital-structure-fragility', 'growth-subsidized-model', 'fixed-cost-trap'], rationale: 'r2', severite: 'drapeau-rouge' },
    ],
    recommandationsDD: [],
  };
  const block = buildFragiliteStructurelleBlock(fs, truncate);
  checkTrue('block liste les deux combinaisons', block.includes('Trajectoire WeWork') && block.includes('Exposition triple WeWork'));
  checkTrue('block separe par double pipe les rationales', block.includes('||'));
}

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
