// ============================================================
// Tests deterministes engine-roots.ts
// ------------------------------------------------------------
// Ce que ces tests prouvent : une racine moteur absente ne fait plus
// lever une lecture de propriete, et le repli declare par
// l interpolation est bien celui qui s applique.
//
// Le cas rejoue est litteralement celui de c487a8b2 :
// patternMatching resolu null par le wrapper deadline, puis
// ${(patternMatching.comparables || []).slice(0, 3)} qui levait
// Cannot read properties of null (reading 'comparables') avant
// d atteindre son propre || [].
// ============================================================

import { protectEngineRoots } from './engine-roots';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] une racine absente devient un objet vide');

{
  const E = protectEngineRoots({
    team: { systemicCoverage: { score: 72 } },
    patternMatching: null,
    blindspotAnalysis: undefined,
  });

  check(typeof E.patternMatching === 'object' && E.patternMatching !== null, 'racine null remplacee par un objet');
  check(typeof E.blindspotAnalysis === 'object' && E.blindspotAnalysis !== null, 'racine undefined remplacee par un objet');
  check(Object.keys(E.patternMatching as any).length === 0, 'la racine de remplacement est vide');
  check((E.team as any).systemicCoverage.score === 72, 'racine presente conservee telle quelle');
}

console.log('\n[Suite 2] les replis declares s appliquent au lieu de lever');

{
  const E = protectEngineRoots({
    patternMatching: null,
    blindspotAnalysis: null,
    contrarianAnalysis: null,
    macro: null,
  });

  let threw = false;
  let comparables = 'non evalue';
  try {
    // Reproduction exacte de lib/engines/orchestrator.ts, ligne du
    // Top comparables, celle qui a leve sur c487a8b2.
    comparables = (E.patternMatching!.comparables || []).slice(0, 3)
      .map((c: any) => `${c.name} (${c.proximity}%)`).join(' · ');
  } catch {
    threw = true;
  }
  check(!threw, 'patternMatching null ne leve plus sur comparables');
  check(comparables === '', 'le || [] declare produit la chaine vide');

  let threw2 = false;
  let vigilance: any = null;
  try {
    vigilance = E.blindspotAnalysis!.globalBlindspotScore || 0;
  } catch { threw2 = true; }
  check(!threw2, 'blindspotAnalysis null ne leve plus');
  check(vigilance === 0, 'le || 0 declare produit zero');

  let threw3 = false;
  let cyclique: any = null;
  try {
    cyclique = E.macro!.contraryclicalOpportunity?.score ?? '?';
  } catch { threw3 = true; }
  check(!threw3, 'macro null ne leve plus');
  check(cyclique === '?', 'le ?? declare produit le point d interrogation');

  let threw4 = false;
  let signaux = -1;
  try {
    signaux = Object.values(E.contrarianAnalysis!.signals || {}).length;
  } catch { threw4 = true; }
  check(!threw4, 'contrarianAnalysis null ne leve plus sur Object.values');
  check(signaux === 0, 'Object.values retombe sur l objet vide');
}

console.log('\n[Suite 3] toutes racines absentes, aucune lecture ne leve');

{
  const E = protectEngineRoots({
    extraction: null, team: null, market: null, macro: null,
    patternMatching: null, causalReversal: null,
    blindspotAnalysis: null, contrarianAnalysis: null,
  });

  let threw = false;
  try {
    // Un echantillon representatif de chaque famille d interpolation
    // du userPrompt, deux niveaux compris.
    void `${(E.extraction as any).companyName ?? '?'}`;
    void `${(E.extraction as any).fundraise?.valuation || 'non précisée'}`;
    void `${(E.team as any).systemicCoverage?.score ?? '?'}`;
    void `${(E.market as any).needIntensity?.score ?? '?'}`;
    void `${(E.macro as any).cyclePosition ?? '?'}`;
    void `${((E.patternMatching as any).comparables || []).length}`;
    void `${Object.values((E.causalReversal as any).blindspotsScores || {}).length}`;
    void `${((E.blindspotAnalysis as any).alertesCritiques || []).join(' · ') || 'aucune'}`;
    void `${((E.contrarianAnalysis as any).comparablesContrariens || []).length}`;
  } catch {
    threw = true;
  }
  check(!threw, 'les huit racines absentes se lisent sans exception');
}

console.log('\n[Suite 4] l objet de remplacement n est pas partage');

{
  const E = protectEngineRoots({ a: null, b: null });
  (E.a as any).marqueur = 1;
  check((E.b as any).marqueur === undefined, 'deux racines absentes ne partagent pas le meme objet');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
