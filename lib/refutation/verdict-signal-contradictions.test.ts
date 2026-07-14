// ============================================================
// Tests deterministes verdict-signal-contradictions.ts (V1)
// ------------------------------------------------------------
// Suite 1 : cas positif obligatoire TOLSON, contradiction signalee.
// Suite 2 : cas negatifs, coherence entre verdict et signaux, silence.
// Suite 3 : cas de garde, absence de verdict, absence de signaux,
//           un seul signal, structures invalides.
// Suite 4 : parsing bornes, chiffres en lettres ignores, unites
//           absentes ignorees, periodes trop courtes ignorees.
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectVerdictSignalContradictions,
  THRESHOLDS,
} from './verdict-signal-contradictions';

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Cas positif obligatoire : TOLSON
// ============================================================

console.log('\n[Suite 1] TOLSON : contradiction verdict-signal declenchee');
{
  const tolson = JSON.parse(readFileSync(join(__dirname, 'fixtures/tolson-verdict-signal.fixture.json'), 'utf-8'));
  const contradictions = detectVerdictSignalContradictions(tolson, { nowYear: 2026 });
  check(contradictions.length === 1, `TOLSON signale exactement 1 contradiction (obtenu ${contradictions.length})`);
  if (contradictions[0]) {
    const c = contradictions[0];
    check(c.ruleId === 'ai-replicability-vs-durability-signals', '  ruleId correct');
    check(c.verdict.source === 'relevanceMatrix.digitalReproducibility', '  source verdict = relevanceMatrix');
    check(c.verdict.value === 'high', '  verdict value = high');
    check(c.signals.length >= THRESHOLDS.minConcurrentSignals, `  au moins ${THRESHOLDS.minConcurrentSignals} signaux (obtenu ${c.signals.length})`);
    const kinds = c.signals.map(s => s.kind);
    check(kinds.includes('long-term-retention'), '  signal retention detecte');
    check(kinds.includes('enterprise-base'), '  signal grands comptes detecte');
    check(kinds.includes('company-age'), '  signal anciennete detecte');
    check(kinds.includes('long-tenure-clients'), '  signal adherence longue detecte');
  }
}

// ============================================================
// SUITE 2 - Cas negatifs
// ============================================================

console.log('\n[Suite 2] Coherence verdict-signal : aucun declenchement');

{
  // Verdict facile de repliquer + aucun signal de moat : coherent
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 2023,
      traction: {
        customers: '3 pilotes en cours',
        metrics: ['ARR 120 k€', 'churn 40% annuel'],
      },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'jeune boite sans moat + verdict high : silencieux');
}

{
  // Verdict "protected" + presence de moats : coherent, silencieux
  const rj = {
    market: {
      defensibility: {
        aiReplicability: { verdict: 'protected', reasoning: 'donnees proprietaires + reseau exclusif' },
      },
    },
    extraction: {
      yearFounded: 2011,
      traction: {
        customers: '40 grands comptes',
        metrics: ['Taux de churn de 8 % sur 5 ans', '15 membres présents depuis 2018'],
      },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'verdict protected + moats : silencieux (coherent)');
}

{
  // Verdict "medium_risk" + moats forts : silencieux (V1 ne cible que high)
  const rj = {
    market: {
      defensibility: {
        aiReplicability: { verdict: 'medium_risk', reasoning: 'replicable techniquement mais barrieres' },
      },
    },
    extraction: {
      yearFounded: 2010,
      traction: {
        customers: '50 entreprises clientes',
        metrics: ['churn 10% sur 3 ans'],
      },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'verdict medium_risk : silencieux (V1 ne cible que high)');
}

// ============================================================
// SUITE 3 - Cas de garde
// ============================================================

console.log('\n[Suite 3] Cas de garde');

{
  // Absence totale de verdict de reproductibilite
  const rj = {
    extraction: {
      yearFounded: 2011,
      traction: {
        customers: '40 grands comptes',
        metrics: ['churn 8% sur 5 ans', '15 membres présents depuis 2018'],
      },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'absence de verdict : silencieux meme avec 4 signaux');
}

{
  // Verdict high mais un seul signal : sous seuil de garde
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 2011,
      traction: { customers: '3 pilotes', metrics: [] },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'un seul signal (anciennete) : sous seuil, silencieux');
}

{
  // Result_json vide, null, mauvais type
  check(detectVerdictSignalContradictions(null).length === 0, 'null : silencieux');
  check(detectVerdictSignalContradictions(undefined as any).length === 0, 'undefined : silencieux');
  check(detectVerdictSignalContradictions({} as any).length === 0, 'objet vide : silencieux');
  check(detectVerdictSignalContradictions('string' as any).length === 0, 'type primitif : silencieux');
}

{
  // Traction avec structures invalides
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 'pas-un-nombre',
      traction: {
        customers: null,
        metrics: 'pas-un-array',
      },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'structures invalides : silencieux, pas de crash');
}

// ============================================================
// SUITE 4 - Parsing bornes
// ============================================================

console.log('\n[Suite 4] Parsing bornes');

{
  // Retention 85% sur 2 ans : pile sur les seuils, doit compter
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 2014, // 12 ans en 2026, franchit anciennete
      traction: { customers: '', metrics: ['churn 15% sur 2 ans'] },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 1, 'retention 85% sur 2 ans + anciennete 12 ans : declenche');
}

{
  // Retention 84% sous seuil : ne compte pas comme signal
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 2011,
      traction: { customers: '', metrics: ['churn 16% sur 3 ans'] },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'retention 84% : sous seuil, un seul signal (age), silencieux');
}

{
  // Churn sur 1 an : periode trop courte, ne compte pas
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 2011,
      traction: { customers: '', metrics: ['churn 5% sur 1 an'] },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'churn sur 1 an : periode sous seuil, un seul signal, silencieux');
}

{
  // 19 grands comptes : sous seuil enterprise-base
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 2011,
      traction: { customers: '19 entreprises clientes', metrics: [] },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, '19 grands comptes : sous seuil, un seul signal, silencieux');
}

{
  // Chiffres en lettres : ignores volontairement
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 2011,
      traction: { customers: 'quarante grands comptes', metrics: [] },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'quarante en lettres : non parse, un seul signal age, silencieux');
}

{
  // Anciennete 9 ans : sous seuil
  const rj = {
    relevanceMatrix: { digitalReproducibility: 'high' },
    extraction: {
      yearFounded: 2018,
      traction: { customers: '40 grands comptes', metrics: [] },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 0, 'anciennete 8 ans : sous seuil, un seul signal grands comptes, silencieux');
}

{
  // Priorite market.defensibility.aiReplicability sur relevanceMatrix
  const rj = {
    market: {
      defensibility: {
        aiReplicability: {
          verdict: 'high_risk',
          reasoning: 'code trivial, reproductible en 3 mois',
        },
      },
    },
    relevanceMatrix: { digitalReproducibility: 'low' }, // contradictoire, mais prioritaire au moteur
    extraction: {
      yearFounded: 2011,
      traction: {
        customers: '40 grands comptes',
        metrics: ['churn 10% sur 3 ans'],
      },
    },
  };
  const c = detectVerdictSignalContradictions(rj, { nowYear: 2026 });
  check(c.length === 1, 'market.aiReplicability=high_risk prioritaire, declenche');
  check(c[0]?.verdict.source === 'market.defensibility.aiReplicability', '  source = market moteur');
}

// ============================================================
// SORTIE
// ============================================================

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
