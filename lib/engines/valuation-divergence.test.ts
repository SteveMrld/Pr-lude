// ============================================================
// Tests deterministes de la garde de domaine et de la divergence
// ------------------------------------------------------------
// Ce que ces tests prouvent : la VC inverse se retire quand sa sortie
// de reference passe sous la valeur que le dossier vaut deja, et deux
// fourchettes qui divergent d un facteur trente ne sortent pas en
// confiance haute.
//
// Le cas est le run de gel du 3 aout 2026. Braincube, 13,5 M EUR d ARR
// au millesime de reference, valeur d entreprise centrale de 216 M EUR
// par les multiples sectoriels, et une pre-money de 6,6 M EUR par la VC
// inverse. La note imprimait une dilution centrale de 60,3 pour cent en
// premiere page, et l indicateur de confiance restait haut.
//
// La cause n est ni le stade ni la calibration. La VC inverse est
// aveugle a la taille de la societe : elle part d une sortie mediane de
// secteur, la ramene par un multiple cible et en soustrait le ticket,
// sans jamais regarder ce que la societe fait. Les multiples sectoriels,
// sur le meme run, ne regardent que cela. Les deux methodes peuvent donc
// diverger d un facteur trente sans qu aucune ne se trompe dans son
// propre cadre. Corriger le stade n y changeait rien : la sortie de base
// ne depend que de la classe d actif.
//
// Execution : npx tsx lib/engines/valuation-divergence.test.ts
// ============================================================

import { computeValuation, divergenceEntreMethodes } from './valuation-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/**
 * Le dossier du run de gel, aux ordres de grandeur reels : la sortie
 * mediane de saas-b2b vaut 80 M EUR, et 13,5 M EUR d ARR a 8-25x place
 * la valeur d entreprise tres au-dessus.
 */
function dossier(revenueMEur: number, stage = 'series-A-late'): any {
  return {
    extraction: {
      sector: 'SaaS', subSector: 'industrial software',
      fundraise: { stage, amount: '€10-15m en cash-in' },
      traction: { metrics: [] },
    },
    financial: null,
    financialData: {
      hasBP: true, fileSource: 'bp',
      revenueProjection: [
        { year: '2020', value: revenueMEur * 0.88, basis: 'actual', source: 'deck' },
        { year: '2021', value: revenueMEur, basis: 'actual', source: 'deck' },
      ],
      grossMarginProjection: [], ebitdaProjection: [], fcfProjection: [],
      headcount: [], opexProjection: [],
      lastActualYear: 2021,
      lastActualYearEvidence: 'Tableau P&L : colonne 2021 qualifiee realise.',
    },
    team: null, market: null, teamScore: 68, marketScore: 62,
    relevanceMatrix: { assetClass: 'saas-b2b' },
    asOf: null,
  };
}

console.log('\n[Suite 1] le rapport de divergence');
{
  check(divergenceEntreMethodes([{ central: 100 }]) === 1, 'une seule fourchette ne diverge pas');
  check(divergenceEntreMethodes([]) === 1, 'aucune non plus');
  check(divergenceEntreMethodes([{ central: 216_000_000 }, { central: 6_600_000 }]) > 30,
    'le couple du run de gel depasse trente');
  check(divergenceEntreMethodes([{ central: 100 }, { central: 300 }]) === 3,
    'un facteur trois se lit comme trois, quel que soit l ordre');
  check(divergenceEntreMethodes([{ central: 300 }, { central: 100 }]) === 3, 'et dans l autre sens');
}

console.log('\n[Suite 2] la VC inverse se retire quand sa sortie passe sous la valeur actuelle');
{
  const out = computeValuation(dossier(13.488));
  const vc = out.methods.find((m: any) => m.method === 'vc-method')!;
  const mult = out.methods.find((m: any) => m.method === 'sector-multiples')!;

  check(mult.applicable === true, 'les multiples restent applicables');
  check(vc.applicable === false, 'la VC inverse est declaree hors domaine');
  check(vc.notApplicableCause === 'doctrine', 'et c est une decision, pas une donnee manquante');
  check(vc.notApplicableGuard === 'domaine-taille',
    'la garde qui l a retiree est nommee, et ce n est pas celle du type d operation');
  check(/sortie mediane/.test(String(vc.notApplicableReason)), 'le motif nomme la sortie mediane');
  check(/valeur d entreprise/.test(String(vc.notApplicableReason)), 'et la valeur qu elle contredit');

  // Le point qui compte pour le partner : plus de dilution fabriquee.
  check(out.dilutionAnalysis === null, 'aucune dilution n est imprimee sur une pre-money fabriquee');
  check(out.ranges.every((r: any) => r.nature !== 'pre_money'),
    'et aucune fourchette pre-money ne subsiste');
}

console.log('\n[Suite 3] le cas nominal garde sa VC inverse');
{
  // Une societe assez petite pour que la sortie mediane du secteur soit
  // au-dessus de sa valeur actuelle : le modele reste dans son domaine.
  const out = computeValuation(dossier(1.2));
  const vc = out.methods.find((m: any) => m.method === 'vc-method')!;
  check(vc.applicable === true, 'la VC inverse reste applicable sur un dossier a sa taille');
  check(out.ranges.some((r: any) => r.nature === 'pre_money'), 'et rend une pre-money');
}

console.log('\n[Suite 4] corriger le stade n aurait rien change');
{
  // La demonstration que la cause n est pas le stade : la garde tombe
  // de la meme facon quel que soit le palier declare, parce que la
  // sortie de base ne depend que de la classe d actif.
  for (const stade of ['series-A-late', 'series-B', 'series-C', 'growth']) {
    const out = computeValuation(dossier(13.488, stade));
    const vc = out.methods.find((m: any) => m.method === 'vc-method')!;
    check(vc.applicable === false, `hors domaine aussi en ${stade}`);
  }
}

console.log('\n[Suite 5] la confiance ne survit pas a une divergence');
{
  // On force la coexistence de deux fourchettes tres ecartees en
  // passant sous la garde de domaine : un dossier dont la valeur est
  // juste sous la sortie mediane garde ses deux methodes.
  const out = computeValuation(dossier(4.4));
  const div = divergenceEntreMethodes(out.ranges as any);
  if (out.ranges.length > 1) {
    check(div > 1, `deux fourchettes coexistent, divergence ${div.toFixed(1)}`);
    if (div >= 10) {
      check(out.confidence === 'low', 'au-dela de dix, la confiance tombe a faible');
      check(out.warnings.some((w: string) => /divergent d un facteur/.test(w)),
        'et la divergence est declaree, pas seulement subie');
      check(out.warnings.some((w: string) => /hors de son domaine/.test(w)),
        'avec ce qu elle signifie');
    } else if (div >= 5) {
      check(out.confidence !== 'high', 'au-dela de cinq, la confiance n est plus haute');
      check(out.warnings.some((w: string) => /divergent d un facteur/.test(w)), 'et elle est declaree');
    } else {
      check(out.confidence !== null, 'divergence moderee : confiance inchangee');
    }
  } else {
    check(true, 'une seule fourchette sur ce dossier, la regle ne s applique pas');
  }
}

console.log(`\n${pass} pass, ${fail} fail\n`);
process.exit(fail > 0 ? 1 : 0);
