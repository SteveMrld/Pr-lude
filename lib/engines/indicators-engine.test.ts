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
  // les champs y compris les nouveaux computedForYear et baseState.
  const s2020 = JSON.stringify(out2020);
  const s2027 = JSON.stringify(out2027);
  check(s2020 === s2027, 'sortie strictement identique entre horloge 2020 et horloge 2027');

  // Verification que le moteur calcule bien sur refYear=2024, pas 2020 ni 2027
  const rule40 = out2020.indicators.find((i: any) => i.key === 'ruleOf40');
  check(rule40?.computedForYear === 2024, `Rule of 40 calcule sur 2024 (obtenu computedForYear=${rule40?.computedForYear})`);
  check(rule40?.baseState === 'actual', 'Rule of 40 baseState=actual (2024 est dans la projection, <= refYear)');
  const rpe = out2020.indicators.find((i: any) => i.key === 'revenuePerEmployee');
  check(rpe?.computedForYear === 2024, `Revenue par employe calcule sur 2024 (obtenu ${rpe?.computedForYear})`);
  check(rpe?.baseState === 'actual', 'Revenue par employe baseState=actual');
}

// ============================================================
// SUITE 2 - resolveYearForIndicator, regle deterministe
// ============================================================

console.log('\n[Suite 2] resolveYearForIndicator');

{
  // Projection sans basis qualifie
  const projNoBasis = [{ year: '2022', value: 1 }, { year: '2024', value: 2 }, { year: '2026', value: 3 }];
  check(resolveYearForIndicator(projNoBasis, 2024)?.year === 2024, 'refYear present dans projection : retenu');
  check(resolveYearForIndicator(projNoBasis, 2024)?.baseState === 'actual', '  baseState=actual (annee == refYear)');
  // refYear=2023 absent, aucun actual : le fallback prend le premier > refYear (2024) => forward
  const gap = resolveYearForIndicator(projNoBasis, 2023);
  check(gap?.year === 2024, 'refYear=2023 absent, aucun actual : premier > refYear = 2024');
  check(gap?.baseState === 'forward', '  baseState=forward (annee > refYear)');
  // Doctrine brique 17 : refYear null => derniere annee, baseState=unknown, jamais forward
  const nul = resolveYearForIndicator(projNoBasis, null);
  check(nul?.year === 2026, 'refYear null + projection : derniere annee = 2026 (pas la premiere)');
  check(nul?.baseState === 'unknown', '  baseState=unknown (jamais forward sans refYear)');
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
  // refYear=2025 present : retenu directement, baseState=actual (2025 == refYear)
  const r1 = resolveYearForIndicator(projWithBasis, 2025);
  check(r1?.year === 2025 && r1?.baseState === 'actual', 'refYear=2025 present : baseState=actual');
  // refYear=2030 absent : max actual = 2023, 2023 < 2030 => actual
  const r2 = resolveYearForIndicator(projWithBasis, 2030);
  check(r2?.year === 2023 && r2?.baseState === 'actual', 'refYear absent, max actual = 2023, <= 2030 : baseState=actual');
  // refYear=2020 absent : max actual = 2023, 2023 > 2020 => forward
  const r3 = resolveYearForIndicator(projWithBasis, 2020);
  check(r3?.year === 2023 && r3?.baseState === 'forward', 'refYear=2020, max actual = 2023 > 2020 : baseState=forward');
}

// ============================================================
// SUITE 3 - referenceYear=null : baseState unknown, jamais forward
// ------------------------------------------------------------
// Doctrine brique 17. Quand le dossier ne qualifie pas d exercice
// actual, on calcule sur la derniere annee documentee mais on
// refuse d affirmer si c est realise ou projete. unknown est la
// seule reponse honnete, forward serait une invention.
// ============================================================

console.log('\n[Suite 3] referenceYear=null : baseState=unknown, jamais forward');

{
  const out = computeIndicators({
    extraction: makeExtraction(),
    financial: null,
    financialData: makeFinancialData(),
    referenceYear: null,
  } as any);
  const rule40 = out.indicators.find((i: any) => i.key === 'ruleOf40');
  check(rule40?.computedForYear !== null && rule40?.computedForYear !== undefined, 'ruleOf40 : computedForYear renseigne');
  check(rule40?.baseState === 'unknown', 'ruleOf40 : baseState=unknown (refYear absent)');
  check(rule40?.baseState !== 'forward', 'ruleOf40 : baseState jamais forward sur refYear null');
  const rpe = out.indicators.find((i: any) => i.key === 'revenuePerEmployee');
  check(rpe?.computedForYear !== null && rpe?.computedForYear !== undefined, 'revenuePerEmployee : computedForYear renseigne');
  check(rpe?.baseState === 'unknown', 'revenuePerEmployee : baseState=unknown');
  check(rpe?.baseState !== 'forward', 'revenuePerEmployee : jamais forward sur refYear null');
  // Rationale prose reflete unknown, doctrine brique 4 : declarer l absence
  check(rule40?.rationale?.includes('non qualifiee') || rule40?.rationale?.includes('inconnu'), 'ruleOf40 rationale mentionne la base non qualifiee');
}

{
  // Cas silence legitime : refYear null ET projection vide => non-applicable
  const empty = { revenueProjection: [], grossMarginProjection: [], ebitdaProjection: [], fcfProjection: [], headcount: [], opexProjection: [], smSpend: [], rdSpend: [], extractionConfidence: 'low', rawNotes: '', unitEconomics: {}, currentRound: {} } as any;
  const out = computeIndicators({
    extraction: makeExtraction(),
    financial: null,
    financialData: empty,
    referenceYear: null,
  } as any);
  const rule40 = out.indicators.find((i: any) => i.key === 'ruleOf40');
  check(rule40?.verdict === 'non-applicable' && rule40?.value === null, 'ruleOf40 non-applicable quand aucune projection exploitable');
  check(rule40?.computedForYear === null || rule40?.computedForYear === undefined, '  computedForYear null');
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
    headcount: [{ year: '2025', value: 16, source: 'bp' }, { year: '2026', value: 18, source: 'bp' }],
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
  check(rpe?.baseState === 'forward', 'baseState=forward (seul du projete disponible, annee > refYear)');
  check(rpe?.rationale?.includes('projetee'), 'rationale mentionne base projetee');
}

// ============================================================
// SUITE 6 - Les trois etats de baseState sont atteignables
// ============================================================

console.log('\n[Suite 6] Atteignabilite des trois etats');

{
  // Etat actual : refYear connu, annee dans projection
  const actual = resolveYearForIndicator(
    [{ year: '2024', value: 1 }, { year: '2025', value: 2 }],
    2024,
  );
  check(actual?.baseState === 'actual', 'etat actual atteignable');
}
{
  // Etat forward : refYear connu, annee retenue > refYear
  const forward = resolveYearForIndicator(
    [{ year: '2025', value: 1 }, { year: '2026', value: 2 }],
    2024,
  );
  check(forward?.baseState === 'forward', 'etat forward atteignable');
}
{
  // Etat unknown : refYear null
  const unk = resolveYearForIndicator(
    [{ year: '2021', value: 1 }, { year: '2025', value: 2 }],
    null,
  );
  check(unk?.baseState === 'unknown', 'etat unknown atteignable');
}

// ============================================================
// SUITE 7 - Suppression du fallback unitEconomics (brique 20)
// ------------------------------------------------------------
// La marge brute d entreprise ne se devine pas depuis une marge
// incrementale par unite. Si grossMarginProjection est absente,
// non-applicable avec motif explicite, jamais un chiffre issu
// d une autre grandeur.
// ============================================================

console.log('\n[Suite 7] Marge brute sans grossMarginProjection : non-applicable, jamais unitEconomics');

{
  // Projection vide + unitEconomics.grossMarginPerUnit renseigne comme TOLSON
  const fd = {
    revenueProjection: [{ year: '2024', value: 1.6, source: 'bp' }],
    grossMarginProjection: [],
    ebitdaProjection: [], fcfProjection: [], opexProjection: [],
    headcount: [{ year: '2024', value: 14, source: 'bp' }],
    smSpend: [], rdSpend: [],
    extractionConfidence: 'high', rawNotes: '',
    unitEconomics: {
      grossMarginPerUnit: '~95% de marge incrementale par nouveau client',
      estimatedCAC: '', estimatedLTV: '', estimatedLtvCacRatio: '', averageContractValue: '',
    },
    currentRound: {},
  } as any;
  const out = computeIndicators({
    extraction: makeExtraction(),
    financial: null,
    financialData: fd,
    referenceYear: 2024,
  } as any);
  const gm = out.indicators.find((i: any) => i.key === 'grossMargin');
  check(gm?.verdict === 'non-applicable', 'grossMarginProjection vide : non-applicable (branche 3 supprimee)');
  check(gm?.value === null, '  value null malgre grossMarginPerUnit renseigne');
  check(!!gm?.rationale?.includes('Projection de marge brute absente'), '  rationale mentionne projection absente');
  check(!gm?.rationale?.includes('marge incrementale'), '  rationale ne cite pas la marge incrementale unitaire');
}

{
  // Verification que le rationale n affirme jamais une moyenne
  // quand aucune projection n existe. Projection vide + unitEco vide.
  const fd = {
    revenueProjection: [{ year: '2024', value: 1.6, source: 'bp' }],
    grossMarginProjection: [],
    ebitdaProjection: [], fcfProjection: [], opexProjection: [],
    headcount: [], smSpend: [], rdSpend: [],
    extractionConfidence: 'high', rawNotes: '',
    unitEconomics: {},
    currentRound: {},
  } as any;
  const out = computeIndicators({
    extraction: makeExtraction(),
    financial: null,
    financialData: fd,
    referenceYear: 2024,
  } as any);
  const gm = out.indicators.find((i: any) => i.key === 'grossMargin');
  check(gm?.value === null, 'projection vide + unitEco vide : value null');
  check(!gm?.rationale?.includes('moyenne'), '  rationale ne dit pas "moyenne" quand aucune projection');
}

{
  // La branche 2 reste vivante sur projection avec years non parseables.
  // Cas de bord Smart&co du corpus. On verifie que le rationale
  // decrit honnetement la moyenne dans ce cas.
  const fd = {
    revenueProjection: [{ year: '2024', value: 1.0, source: 'bp' }],
    grossMarginProjection: [
      { year: 'NaN', value: 44.3, source: 'bp' } as any,
      { year: 'NaN', value: 45.6, source: 'bp' } as any,
      { year: 'invalide', value: 46.1, source: 'bp' } as any,
    ],
    ebitdaProjection: [], fcfProjection: [], opexProjection: [],
    headcount: [], smSpend: [], rdSpend: [],
    extractionConfidence: 'high', rawNotes: '',
    unitEconomics: {},
    currentRound: {},
  } as any;
  const out = computeIndicators({
    extraction: makeExtraction(),
    financial: null,
    financialData: fd,
    referenceYear: 2024,
  } as any);
  const gm = out.indicators.find((i: any) => i.key === 'grossMargin');
  check(gm?.value !== null && Math.abs(gm.value - 45.3) < 0.5, `moyenne branche 2 sur years non parseables : obtenu ${gm?.value}`);
  check(!!gm?.rationale?.includes('moyenne des projections disponibles'), '  rationale dit honnetement moyenne des projections disponibles');
  check(gm?.computedForYear === null, '  computedForYear null (moyenne, pas d annee ponctuelle)');
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
