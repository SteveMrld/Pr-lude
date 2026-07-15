// ============================================================
// Tests deterministes indicators-engine.ts
// ------------------------------------------------------------
// Le test qui compte est le premier : deux runs simules a deux
// dates systeme differentes doivent produire des valeurs
// strictement identiques sur le meme dossier. C est le seul
// invariant qui rend la note d instruction reproductible et la
// calibration honnete.
//
// Autres suites : resolveYearForIndicator (regle de resolution),
// referenceYear absent = non-applicable explicite, marqueur
// isForwardBase quand seul du projete est disponible.
// ============================================================

import { computeIndicators, resolveYearForIndicator } from './indicators-engine';
import type { ExtractionOutput, FinancialDataExtraction } from './types';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

function makeExtraction(): ExtractionOutput {
  return {
    companyName: 'TestCo', sector: 'tech', subSector: 'saas',
    yearFounded: 2020, geographicHub: 'Paris', country: 'France',
    productDescription: '', businessModel: 'subscription',
    marketPitch: '', rawSummary: '', competitorsCited: [],
    fundraise: { stage: 'seed', amount: '2M' } as any,
    traction: { metrics: {} } as any,
  } as ExtractionOutput;
}

function makeFinancialData(): FinancialDataExtraction {
  // TOLSON-like : historique 2021-2024, projections 2025-2026.
  return {
    revenueProjection: [
      { year: '2021', value: 1.198, source: 'deck+bp' },
      { year: '2022', value: 1.468, source: 'deck+bp' },
      { year: '2023', value: 1.513, source: 'deck+bp' },
      { year: '2024', value: 1.608, source: 'bp' },
      { year: '2025', value: 2.16, source: 'deck+bp' },
      { year: '2026', value: 2.75, source: 'deck+bp' },
    ],
    grossMarginProjection: [
      { year: '2024', value: 95, source: 'bp' },
      { year: '2026', value: 95, source: 'bp' },
    ],
    ebitdaProjection: [
      { year: '2024', value: 0.305, source: 'bp' },
      { year: '2026', value: 0.915, source: 'bp' },
    ],
    fcfProjection: [
      { year: '2024', value: 0.28, source: 'bp' },
      { year: '2026', value: 0.62, source: 'bp' },
    ],
    headcount: [
      { year: '2024', value: 14, source: 'bp' },
      { year: '2025', value: 16, source: 'bp' },
      { year: '2026', value: 18, source: 'bp' },
    ],
    smSpend: [], rdSpend: [], opexProjection: [],
    extractionConfidence: 'high', rawNotes: '',
    unitEconomics: {} as any, currentRound: {} as any,
  } as unknown as FinancialDataExtraction;
}

// ============================================================
// SUITE 1 - TEST DE STABILITE TEMPORELLE (priorite absolue)
// ============================================================

console.log('\n[Suite 1] Stabilite temporelle : deux horloges systeme, sortie identique');

{
  const input = {
    extraction: makeExtraction(),
    financial: null,
    financialData: makeFinancialData(),
    referenceYear: 2024,
  } as any;

  // Monkey-patch de Date pour simuler deux horloges systeme
  // radicalement differentes. Le moteur ne doit consulter aucune
  // horloge : sortie strictement egale entre les deux runs.
  const OriginalDate = Date;
  const FrozenDateFactory = (iso: string) => {
    return class FrozenDate extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) { super(iso); return; }
        super(...(args as [any]));
      }
      static now() { return new OriginalDate(iso).getTime(); }
    };
  };
  const withMockedDate = <T,>(iso: string, fn: () => T): T => {
    (globalThis as any).Date = FrozenDateFactory(iso);
    try { return fn(); } finally { (globalThis as any).Date = OriginalDate; }
  };

  const out2020 = withMockedDate('2020-01-15T12:00:00Z', () => computeIndicators(input));
  const out2027 = withMockedDate('2027-06-30T18:00:00Z', () => computeIndicators(input));

  // Egalite stricte des sorties. On stringifie pour comparer tous
  // les champs y compris les nouveaux computedForYear et isForwardBase.
  const s2020 = JSON.stringify(out2020);
  const s2027 = JSON.stringify(out2027);
  check(s2020 === s2027, 'sortie strictement identique entre horloge 2020 et horloge 2027');

  // Verification que le moteur calcule bien sur refYear=2024, pas 2020 ni 2027
  const rule40 = out2020.indicators.find((i: any) => i.key === 'ruleOf40');
  check(rule40?.computedForYear === 2024, `Rule of 40 calcule sur 2024 (obtenu computedForYear=${rule40?.computedForYear})`);
  check(rule40?.isForwardBase === false, 'Rule of 40 isForwardBase=false (2024 est dans la projection, actual)');
  const rpe = out2020.indicators.find((i: any) => i.key === 'revenuePerEmployee');
  check(rpe?.computedForYear === 2024, `Revenue par employe calcule sur 2024 (obtenu ${rpe?.computedForYear})`);
}

// ============================================================
// SUITE 2 - resolveYearForIndicator, regle deterministe
// ============================================================

console.log('\n[Suite 2] resolveYearForIndicator');

{
  // Projection sans basis qualifie : aucune annee actual disponible
  const projNoBasis = [{ year: '2022', value: 1 }, { year: '2024', value: 2 }, { year: '2026', value: 3 }];
  check(resolveYearForIndicator(projNoBasis, 2024)?.year === 2024, 'refYear present dans projection : retenu');
  check(resolveYearForIndicator(projNoBasis, 2024)?.isForward === false, '  isForward=false');
  // refYear absent, aucun basis actual => min projection avec isForward=true
  check(resolveYearForIndicator(projNoBasis, 2023)?.year === 2022, 'refYear absent, aucun actual : min projection = 2022');
  check(resolveYearForIndicator(projNoBasis, 2023)?.isForward === true, '  isForward=true (aucun actual, projete)');
  check(resolveYearForIndicator(projNoBasis, null) === null, 'refYear null : null');
  check(resolveYearForIndicator([], 2024) === null, 'projection vide : null');
  check(resolveYearForIndicator(undefined, 2024) === null, 'projection undefined : null');
}

{
  // Projection avec basis explicites : preference actual sur les autres
  const projWithBasis = [
    { year: '2022', value: 1, basis: 'actual' as const },
    { year: '2023', value: 1.5, basis: 'actual' as const },
    { year: '2024', value: 2, basis: 'budget' as const },
    { year: '2025', value: 2.5, basis: 'projected' as const },
  ];
  // refYear=2025 present : retenu directement
  check(resolveYearForIndicator(projWithBasis, 2025)?.year === 2025, 'refYear=2025 present : retenu');
  // refYear=2030 absent : plus grande annee actual = 2023
  check(resolveYearForIndicator(projWithBasis, 2030)?.year === 2023, 'refYear absent : plus grande annee actual (2023) retenue');
  check(resolveYearForIndicator(projWithBasis, 2030)?.isForward === false, '  isForward=false (actual retrouve)');
  // refYear=2020 absent, actual disponible : max actual meme si posterieur a refYear
  check(resolveYearForIndicator(projWithBasis, 2020)?.year === 2023, 'refYear=2020 absent : max actual (2023) meme si posterieur a refYear');
}

// ============================================================
// SUITE 3 - referenceYear=null => non-applicable
// ============================================================

console.log('\n[Suite 3] referenceYear=null : indicateurs non-applicable, jamais chiffre devine');

{
  const out = computeIndicators({
    extraction: makeExtraction(),
    financial: null,
    financialData: makeFinancialData(),
    referenceYear: null,
  } as any);
  for (const ind of out.indicators) {
    if (ind.key === 'ndr' || ind.key === 'magicNumber' || ind.key === 'paybackCac') continue; // pas de dep annee
    check(
      ind.verdict === 'non-applicable' && ind.value === null,
      `${ind.key} : non-applicable + value null (refYear absent)`
    );
    check(ind.computedForYear === null, `  ${ind.key} : computedForYear = null`);
  }
}

// ============================================================
// SUITE 4 - Marqueur forward dans la donnee (pas dans la prose)
// ============================================================

console.log('\n[Suite 4] Marqueur forward dans la donnee');

{
  // Dossier avec seulement du projete post-refYear
  const forwardOnly: FinancialDataExtraction = {
    revenueProjection: [
      { year: '2025', value: 2.16, source: 'bp' },
      { year: '2026', value: 2.75, source: 'bp' },
    ],
    grossMarginProjection: [], ebitdaProjection: [],
    fcfProjection: [{ year: '2026', value: 0.5, source: 'bp' }],
    headcount: [{ year: '2026', value: 18, source: 'bp' }],
    smSpend: [], rdSpend: [], opexProjection: [],
    extractionConfidence: 'high', rawNotes: '',
    unitEconomics: {} as any, currentRound: {} as any,
  } as unknown as FinancialDataExtraction;

  const out = computeIndicators({
    extraction: makeExtraction(),
    financial: null,
    financialData: forwardOnly,
    referenceYear: 2024,
  } as any);
  const rpe = out.indicators.find((i: any) => i.key === 'revenuePerEmployee');
  check(rpe?.computedForYear === 2025 || rpe?.computedForYear === 2026, `Revenue par employe base > refYear (obtenu ${rpe?.computedForYear})`);
  check(rpe?.isForwardBase === true, 'isForwardBase=true (seul du projete disponible)');
}

// ============================================================
// SUITE 5 - Aucune lecture d horloge dans le source
// ============================================================

console.log('\n[Suite 5] Contrat source : aucune lecture d horloge dans indicators-engine.ts');

{
  const src = require('fs').readFileSync('/home/steve/Pr-lude/lib/engines/indicators-engine.ts', 'utf-8') as string;
  // Interdits absolus : lecture de l horloge systeme
  const bareNewDate = (src.match(/new\s+Date\s*\(\s*\)/g) || []).length;
  const dateNow = (src.match(/Date\.now\s*\(/g) || []).length;
  const getFullYear = /\.getFullYear\s*\(/.test(src);
  check(bareNewDate === 0, `aucun new Date() sans argument dans indicators-engine.ts (obtenu ${bareNewDate})`);
  check(dateNow === 0, `aucun Date.now() dans indicators-engine.ts (obtenu ${dateNow})`);
  check(!getFullYear, 'aucun getFullYear() dans indicators-engine.ts');
  // Autorise : new Date(Date.UTC(refYear, ...)) qui construit une date
  // deterministe a partir de l annee de reference du dossier. Le test
  // ne verifie pas cette forme, mais on garantit qu elle n injecte
  // pas d horloge dans les 3 checks au-dessus.
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
