// ============================================================
// PRESCAN OVERRIDE
// ------------------------------------------------------------
// Logique pure invoquee par /api/analyze quand le partner force
// l analyse complete apres un knockout pre-scan. Permet de skip
// le re-trigger du moteur Haiku 4.5 (5-8 secondes, 0.02 USD)
// tout en preservant la trace du verdict d origine dans le
// resultJson final.
//
// Deux cas de figure :
//   1. Le client a renvoye le verdict d origine (priorPreScan
//      non null) : on le reinjecte tel quel, avec un drapeau
//      __overrideReason qui signale l override au consommateur
//      aval (note finale, persistance, audit).
//   2. Le client a perdu le verdict (reload de la page, nouvel
//      onglet, etc.) : on synthetise un stub minimal marque
//      __skipped pour signaler que le triage Bloc 0 n a pas
//      tourne sur cette execution sans perdre la coherence des
//      types attendus par le pipeline.
//
// La fonction est isolee dans son propre module pour pouvoir
// etre testee deterministe sans toucher au moteur LLM.
// ============================================================

import type { PreScanOutput } from './prescan-engine';

export type PreScanOverrideOutput = (PreScanOutput & {
  __overrideReason?: string;
  __skipped?: boolean;
}) | (Partial<PreScanOutput> & {
  __overrideReason: 'force-prescan';
  __skipped: true;
});

/**
 * Resout le payload pre-scan a emettre quand forcePrescan=true.
 *
 * Si priorPreScan est fourni et porte les champs minimum d un
 * PreScanOutput (recommendation, summary), on le marque comme
 * override et on le retourne. Si priorPreScan est null ou
 * incomplet, on synthetise un stub minimal compatible avec la
 * suite du pipeline.
 */
export function resolvePreScanOverride(priorPreScan: any): PreScanOverrideOutput {
  if (
    priorPreScan &&
    typeof priorPreScan === 'object' &&
    typeof priorPreScan.recommendation === 'string' &&
    typeof priorPreScan.summary === 'string'
  ) {
    return {
      ...priorPreScan,
      __overrideReason: 'force-prescan',
    };
  }

  return {
    score: null as unknown as number,
    totalTests: 0,
    recommendation: 'pipeline_with_caveats',
    summary: 'Pre-scan non relance : le partner a force l analyse complete apres un verdict de triage defavorable.',
    tests: [],
    failedTests: [],
    __skipped: true,
    __overrideReason: 'force-prescan',
  };
}
