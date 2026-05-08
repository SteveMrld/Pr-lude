// ============================================================
// TESTS DETERMINISTES DE compute-top-risks
// ------------------------------------------------------------
// Verifient :
//   1. La selection des patterns avec intensity >= 60 (seuil
//      abaisse vs ancien seuil 70 pour capter les patterns
//      moderement-eleves).
//   2. La deduplication entre patterns detectes et alertes
//      critiques portant le meme label normalise. Cas observe
//      sur UP&CHARGE : pattern P3 "Inversion industrialisation/
//      validation" intensity 65 ET alerte critique du meme
//      nom intensity hardcodee 80, produisait deux cartouches
//      contradictoires sur la couverture.
//   3. L extraction du label discriminant depuis le texte de
//      l alerte (cascade colonMatch / sentenceMatch / truncate).
//   4. Le tri par intensity decroissante.
//
// Lance : tsx lib/compute-top-risks.test.ts
// ============================================================

import { computeTopRisks } from './compute-top-risks';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS  ${message}`);
  } else {
    failed++;
    console.log(`  FAIL  ${message}`);
  }
}

// ------------------------------------------------------------
// Test 1 : Patterns avec intensity >= 60 sont remontes
// ------------------------------------------------------------
{
  const result = {
    blindspotAnalysis: {
      patterns: {
        p1: { detected: true, intensity: 75, patternName: 'Pattern A', evidence: 'evidence A' },
        p2: { detected: true, intensity: 65, patternName: 'Pattern B', evidence: 'evidence B' },
        p3: { detected: true, intensity: 55, patternName: 'Pattern C', evidence: 'evidence C' },
      },
      alertesCritiques: [],
    },
  };
  const risks = computeTopRisks(result, 3);
  assert(risks.length === 2, 'Pattern intensity 55 (sous seuil 60) est exclu');
  assert(risks[0].intensity === 75, 'Pattern intensity 75 remonte en premier');
  assert(risks[1].intensity === 65, 'Pattern intensity 65 remonte en second');
}

// ------------------------------------------------------------
// Test 2 : Deduplication patterns / alertes critiques
// ------------------------------------------------------------
{
  // Cas UP&CHARGE : pattern P3 "Inversion industrialisation/validation"
  // intensity 65 + alerte critique du meme nom
  const result = {
    blindspotAnalysis: {
      patterns: {
        p1: {
          detected: true,
          intensity: 65,
          patternName: 'Inversion industrialisation/validation',
          evidence: 'evidence pattern',
        },
      },
      alertesCritiques: [
        'Inversion industrialisation/validation critique : Le dossier propose de lever 15M EUR Series A...',
        'Deni des unit economics : Le pitch ne fournit aucune donnee chiffree...',
      ],
    },
  };
  const risks = computeTopRisks(result, 3);
  // L alerte critique avec meme label que le pattern doit etre dedupliquee
  const labels = risks.map(r => r.label);
  const inversionCount = labels.filter(l => l.toLowerCase().includes('inversion industrialisation')).length;
  assert(inversionCount === 1, 'Pas de doublon entre pattern et alerte critique au meme label');

  // Le pattern garde son intensity reelle 65, pas 80 hardcode
  const inversion = risks.find(r => r.label.toLowerCase().includes('inversion industrialisation'));
  assert(inversion?.intensity === 65, 'Pattern intensity 65 preservee (pas ecrasee par 80 hardcode)');

  // L alerte "Deni des unit economics" non doublonnee remonte avec intensity 70
  const deni = risks.find(r => r.label.toLowerCase().includes('deni'));
  assert(deni !== undefined, 'Alerte critique non-doublonnee est remontee');
  assert(deni?.intensity === 70, 'Intensity par defaut alerte critique = 70 (pas 80)');
}

// ------------------------------------------------------------
// Test 3 : Extraction du label discriminant depuis le texte
// ------------------------------------------------------------
{
  const result = {
    blindspotAnalysis: {
      patterns: {},
      alertesCritiques: [
        'Concentration clients : Trois clients pesent 80% du CA, avec un risque de defaillance...',
        'Effet de meute legitimation. Le dossier s appuie sur Bpifrance comme argument...',
      ],
    },
  };
  const risks = computeTopRisks(result, 3);
  assert(risks.length === 2, 'Deux alertes critiques remontees sans patterns');
  assert(
    risks[0].label.toLowerCase().includes('concentration'),
    'Label extrait par colonMatch (Categorie : description)',
  );
  assert(
    risks[1].label.toLowerCase().includes('effet de meute'),
    'Label extrait par sentenceMatch (premiere phrase courte)',
  );
  assert(
    risks.every(r => r.label !== 'Alerte critique'),
    'Aucun risque ne porte le label generique "Alerte critique"',
  );
}

// ------------------------------------------------------------
// Test 4 : Tri par intensity decroissante
// ------------------------------------------------------------
{
  const result = {
    blindspotAnalysis: {
      patterns: {
        p1: { detected: true, intensity: 65, patternName: 'A', evidence: '' },
        p2: { detected: true, intensity: 85, patternName: 'B', evidence: '' },
        p3: { detected: true, intensity: 72, patternName: 'C', evidence: '' },
      },
      alertesCritiques: [],
    },
  };
  const risks = computeTopRisks(result, 3);
  assert(risks[0].intensity === 85, 'Tri intensity decroissante : 85 en premier');
  assert(risks[1].intensity === 72, 'Tri intensity decroissante : 72 en second');
  assert(risks[2].intensity === 65, 'Tri intensity decroissante : 65 en troisieme');
}

// ------------------------------------------------------------
// Test 5 : Limit respecte
// ------------------------------------------------------------
{
  const result = {
    blindspotAnalysis: {
      patterns: {
        p1: { detected: true, intensity: 90, patternName: 'A', evidence: '' },
        p2: { detected: true, intensity: 80, patternName: 'B', evidence: '' },
        p3: { detected: true, intensity: 70, patternName: 'C', evidence: '' },
        p4: { detected: true, intensity: 65, patternName: 'D', evidence: '' },
      },
      alertesCritiques: [],
    },
  };
  const risks3 = computeTopRisks(result, 3);
  assert(risks3.length === 3, 'Limit 3 respecte avec 4 patterns disponibles');

  const risks2 = computeTopRisks(result, 2);
  assert(risks2.length === 2, 'Limit 2 respecte avec 4 patterns disponibles');
}

// ------------------------------------------------------------
// Test 6 : Pas de pattern detecte, completion par alertes
// ------------------------------------------------------------
{
  const result = {
    blindspotAnalysis: {
      patterns: {
        p1: { detected: false, intensity: 80, patternName: 'Non detecte', evidence: '' },
      },
      alertesCritiques: [
        'Risque A : description...',
        'Risque B : description...',
      ],
    },
  };
  const risks = computeTopRisks(result, 3);
  assert(risks.length === 2, 'Patterns non-detectes sont ignores, alertes remontent');
  assert(risks.every(r => r.intensity === 70), 'Toutes les alertes prennent intensity 70 par defaut');
}

// ------------------------------------------------------------
// Test 7 : Deduplication par chevauchement de mots-cles
// ------------------------------------------------------------
{
  // Cas ou le label du pattern et de l alerte se ressemblent
  // sans etre strictement identiques (ordre de mots, ponctuation)
  const result = {
    blindspotAnalysis: {
      patterns: {
        p1: {
          detected: true,
          intensity: 78,
          patternName: 'Deni des unit economics',
          evidence: '',
        },
      },
      alertesCritiques: [
        'Deni unit economics structurel : Le pitch ne fournit aucune donnee...',
      ],
    },
  };
  const risks = computeTopRisks(result, 3);
  // Doit detecter le chevauchement "deni / unit / economics" et ne pas dupliquer
  const labels = risks.map(r => r.label.toLowerCase());
  const deniCount = labels.filter(l => l.includes('deni') && l.includes('economics')).length;
  assert(deniCount === 1, 'Chevauchement de mots-cles detecte, pas de doublon');
}

// ------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} tests passes`);
if (failed > 0) {
  process.exit(1);
}
